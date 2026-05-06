from __future__ import annotations
import asyncio
import logging
from contextlib import asynccontextmanager
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

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        async def _sweep_loop():
            while True:
                try:
                    await asyncio.sleep(settings.sweep_interval_seconds)
                    registry.sweep_expired(settings.bundle_ttl_seconds)
                except asyncio.CancelledError:
                    break
                except Exception:
                    logger.exception("sweeper iteration failed")

        sweeper = asyncio.create_task(_sweep_loop())
        try:
            yield
        finally:
            sweeper.cancel()
            try:
                await sweeper
            except asyncio.CancelledError:
                pass

    app = FastAPI(title="protspace-prep", version="0.1.0", lifespan=lifespan)
    app.state.registry = registry
    app.state.settings = settings

    @app.get("/healthz")
    async def healthz() -> dict:
        return {"ok": True, "jobs": registry.counts()}

    app.include_router(make_router(registry, settings))
    return app


app = create_app()
