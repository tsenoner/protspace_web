from __future__ import annotations
import logging
from typing import Optional

from fastapi import FastAPI

from .api import make_router
from .config import Settings, load_settings
from .jobs import JobContext, JobRegistry, PipelineFn
from .pipeline import run_protspace_prepare

logger = logging.getLogger("protspace_prep")


def _default_pipeline(settings: Settings) -> PipelineFn:
    async def _pipeline(ctx: JobContext, emit):
        return await run_protspace_prepare(ctx, emit, settings)

    return _pipeline


def create_app(*, pipeline: Optional[PipelineFn] = None) -> FastAPI:
    settings = load_settings()
    settings.job_root.mkdir(parents=True, exist_ok=True)

    registry = JobRegistry(
        job_root=settings.job_root,
        max_concurrent=settings.max_concurrent_jobs,
        pipeline=pipeline or _default_pipeline(settings),
    )

    app = FastAPI(title="protspace-prep", version="0.1.0")
    app.state.registry = registry
    app.state.settings = settings

    @app.get("/healthz")
    async def healthz() -> dict:
        return {"ok": True, "jobs": registry.counts()}

    app.include_router(make_router(registry, settings))
    return app


app = create_app()
