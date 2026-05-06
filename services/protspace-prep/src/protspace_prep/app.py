from __future__ import annotations
from fastapi import FastAPI

from .config import load_settings


def create_app() -> FastAPI:
    settings = load_settings()
    app = FastAPI(title="protspace-prep", version="0.1.0")
    app.state.settings = settings
    app.state.running_jobs = 0
    app.state.queued_jobs = 0

    @app.get("/healthz")
    async def healthz() -> dict:
        return {
            "ok": True,
            "jobs": {
                "running": app.state.running_jobs,
                "queued": app.state.queued_jobs,
            },
        }

    return app


app = create_app()
