from __future__ import annotations
import asyncio
import logging
import re
import shutil
from pathlib import Path
from typing import Awaitable, Callable

from .config import Settings
from .jobs import JobContext, PipelineFailure

logger = logging.getLogger("protspace_prep.pipeline")

_STAGE_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\bembed", re.IGNORECASE), "embedding"),
    (re.compile(r"\bproject|\bPCA|\bUMAP|\btSNE", re.IGNORECASE), "projecting"),
    (re.compile(r"\bannotat", re.IGNORECASE), "annotating"),
    (re.compile(r"\bbundl", re.IGNORECASE), "bundling"),
)

EmitFn = Callable[[str, dict], Awaitable[None]]


async def run_protspace_prepare(
    ctx: JobContext,
    emit: EmitFn,
    settings: Settings,
) -> Path:
    """Drive `protspace prepare` as a subprocess.

    Stage transitions are derived from CLI stderr lines. Returns the resulting
    bundle path on success; raises PipelineFailure on any failure mode.
    """
    cmd = [
        "protspace",
        "prepare",
        "-i",
        str(ctx.fasta_path),
        "-e",
        settings.embedder,
        "-m",
        settings.methods,
        "-a",
        settings.annotations,
        "-o",
        str(ctx.output_dir),
    ]
    logger.info("job=%s cmd=%s", ctx.job_id, " ".join(cmd))

    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.PIPE,
    )

    last_lines: list[str] = []
    seen_stages: set[str] = set()

    async def _drain() -> int:
        assert process.stderr is not None
        while True:
            raw = await process.stderr.readline()
            if not raw:
                break
            line = raw.decode("utf-8", errors="replace").rstrip()
            if not line:
                continue
            last_lines.append(line)
            if len(last_lines) > 50:
                last_lines.pop(0)
            for pattern, stage in _STAGE_PATTERNS:
                if stage in seen_stages:
                    continue
                if pattern.search(line):
                    seen_stages.add(stage)
                    await emit(stage, {})
                    break
        return await process.wait()

    try:
        returncode = await asyncio.wait_for(
            _drain(), timeout=settings.pipeline_timeout_seconds
        )
    except asyncio.TimeoutError:
        process.kill()
        try:
            await asyncio.wait_for(process.wait(), timeout=5)
        except asyncio.TimeoutError:
            pass
        raise PipelineFailure(
            f"protspace prepare timed out after {settings.pipeline_timeout_seconds}s."
        )
    except asyncio.CancelledError:
        process.kill()
        raise

    if returncode != 0:
        tail = "\n".join(last_lines[-10:]) or "no output"
        raise PipelineFailure(
            f"protspace prepare exited with code {returncode}: {tail}"
        )

    bundle = _find_bundle(ctx.output_dir)
    if bundle is None:
        raise PipelineFailure(
            "protspace prepare reported success but produced no .parquetbundle file."
        )
    return bundle


def _find_bundle(output_dir: Path) -> Path | None:
    for path in output_dir.rglob("*.parquetbundle"):
        return path
    return None


def cleanup_job_dir(output_dir: Path) -> None:
    """Best-effort delete of a job's output directory."""
    shutil.rmtree(output_dir, ignore_errors=True)
