from pathlib import Path

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from protspace_prep.app import create_app
from protspace_prep.jobs import JobContext, PipelineFailure


async def _fake_success(ctx: JobContext, emit) -> Path:
    await emit("embedding", {})
    await emit("bundling", {})
    out = ctx.output_dir / "data.parquetbundle"
    out.write_bytes(b"FAKE_BUNDLE")
    return out


async def _fake_failure(ctx: JobContext, emit) -> Path:
    await emit("embedding", {})
    raise PipelineFailure("Biocentral returned 503: nope")


@pytest.fixture
def app_factory(tmp_path, monkeypatch):
    monkeypatch.setenv("PREP_JOB_ROOT", str(tmp_path / "jobs"))

    def _make(pipeline=_fake_success):
        return create_app(pipeline=pipeline)

    return _make


async def _client(app):
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


async def test_post_prepare_rejects_oversized_upload(app_factory, monkeypatch):
    monkeypatch.setenv("PREP_UPLOAD_MAX_BYTES", "10")
    app = app_factory()
    async with await _client(app) as c:
        files = {"file": ("seq.fasta", b">a\nMKTKTKTKTKT\n", "text/plain")}
        r = await c.post("/api/prepare", files=files)
    assert r.status_code == 400
    assert r.json()["code"] == "FILE_TOO_LARGE"


async def test_post_prepare_rejects_malformed(app_factory):
    app = app_factory()
    async with await _client(app) as c:
        files = {"file": ("seq.fasta", b"no header here\n", "text/plain")}
        r = await c.post("/api/prepare", files=files)
    assert r.status_code == 400
    assert r.json()["code"] == "MALFORMED_FASTA"


async def test_post_prepare_returns_job_id_and_sse_drives_to_done(app_factory):
    app = app_factory()
    async with await _client(app) as c:
        files = {"file": ("seq.fasta", b">P12345\nMKTAYIAK\n", "text/plain")}
        r = await c.post("/api/prepare", files=files)
        assert r.status_code == 202
        job_id = r.json()["job_id"]

        async with c.stream("GET", f"/api/prepare/{job_id}/events") as stream:
            assert stream.status_code == 200
            events = []
            async for chunk in stream.aiter_lines():
                if chunk.startswith("event: "):
                    events.append(chunk[len("event: "):])
                if "event: done" in chunk or "event: error" in chunk:
                    pass
        assert "queued" in events
        assert "done" in events

        r = await c.get(f"/api/prepare/{job_id}/bundle")
        assert r.status_code == 200
        assert r.content == b"FAKE_BUNDLE"

        r = await c.get(f"/api/prepare/{job_id}/bundle")
        assert r.status_code == 410


async def test_failure_surfaces_error_event_and_no_download(app_factory):
    app = app_factory(pipeline=_fake_failure)
    async with await _client(app) as c:
        files = {"file": ("seq.fasta", b">P12345\nMKTAYIAK\n", "text/plain")}
        r = await c.post("/api/prepare", files=files)
        job_id = r.json()["job_id"]
        async with c.stream("GET", f"/api/prepare/{job_id}/events") as stream:
            text = "".join([chunk async for chunk in stream.aiter_text()])
        assert "event: error" in text
        assert "Biocentral returned 503" in text
        r = await c.get(f"/api/prepare/{job_id}/bundle")
        assert r.status_code == 409


async def test_unknown_job_id_returns_404(app_factory):
    app = app_factory()
    async with await _client(app) as c:
        r = await c.get("/api/prepare/does-not-exist/events")
        assert r.status_code == 404
        r = await c.get("/api/prepare/does-not-exist/bundle")
        assert r.status_code == 404


async def test_healthz_reflects_running_jobs(app_factory):
    app = app_factory()
    async with await _client(app) as c:
        r = await c.get("/healthz")
        assert r.status_code == 200
        assert r.json()["jobs"] == {"running": 0, "queued": 0}
