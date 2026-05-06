from __future__ import annotations
import logging
from typing import AsyncIterator

from fastapi import APIRouter, FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.responses import JSONResponse, StreamingResponse, Response

from .config import Settings
from .jobs import JobRegistry, JobStatus
from .sse import KEEPALIVE_FRAME, format_event
from .validation import FastaValidationError, ValidationCode, parse_and_validate

logger = logging.getLogger("protspace_prep.api")


def make_router(registry: JobRegistry, settings: Settings) -> APIRouter:
    router = APIRouter()

    @router.post("/api/prepare", status_code=status.HTTP_202_ACCEPTED)
    async def submit(file: UploadFile = File(...)):
        body = await file.read(settings.upload_max_bytes + 1)
        if len(body) > settings.upload_max_bytes:
            return JSONResponse(
                status_code=400,
                content={
                    "error": f"File exceeds {settings.upload_max_bytes} bytes.",
                    "code": ValidationCode.FILE_TOO_LARGE.value,
                },
            )
        try:
            text = body.decode("utf-8")
        except UnicodeDecodeError:
            return JSONResponse(
                status_code=400,
                content={
                    "error": "FASTA must be UTF-8 text.",
                    "code": ValidationCode.MALFORMED_FASTA.value,
                },
            )
        try:
            parse_and_validate(text, settings)
        except FastaValidationError as exc:
            return JSONResponse(
                status_code=400,
                content={"error": exc.message, "code": exc.code.value},
            )
        job_id = await registry.submit(body, original_name=file.filename or "input.fasta")
        return {"job_id": job_id}

    @router.get("/api/prepare/{job_id}/events")
    async def events(job_id: str, request: Request):
        if registry.get(job_id) is None:
            raise HTTPException(status_code=404, detail="Unknown job_id")

        async def stream() -> AsyncIterator[bytes]:
            try:
                async for event in registry.subscribe(job_id):
                    if await request.is_disconnected():
                        return
                    yield format_event(event.event, event.data).encode("utf-8")
                    if event.event in {"done", "error"}:
                        return
            except Exception:
                logger.exception("SSE stream error for job %s", job_id)
                yield format_event(
                    "error", {"message": "Internal server error."}
                ).encode("utf-8")

        headers = {
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        }
        return StreamingResponse(stream(), media_type="text/event-stream", headers=headers)

    @router.get("/api/prepare/{job_id}/bundle")
    async def bundle(job_id: str):
        state = registry.get(job_id)
        if state is None:
            raise HTTPException(status_code=404, detail="Unknown job_id")
        if state.status is JobStatus.ERROR:
            raise HTTPException(status_code=409, detail=state.error_message or "Job failed.")
        if state.status is not JobStatus.DONE:
            raise HTTPException(status_code=409, detail="Job not finished.")
        if state.consumed:
            raise HTTPException(status_code=410, detail="Bundle already downloaded.")
        path = registry.consume_bundle(job_id)
        if path is None or not path.exists():
            raise HTTPException(status_code=410, detail="Bundle expired.")
        download_name = (state.original_name.rsplit(".", 1)[0] or "protspace") + ".parquetbundle"
        try:
            content = path.read_bytes()
        except FileNotFoundError:
            raise HTTPException(status_code=410, detail="Bundle expired.")
        path.unlink(missing_ok=True)
        return Response(
            content=content,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{download_name}"'},
        )

    return router
