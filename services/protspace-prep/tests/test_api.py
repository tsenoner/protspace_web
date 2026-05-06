from pathlib import Path
from unittest.mock import patch

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from protspace_prep.app import create_app
from protspace_prep.jobs import JobContext, PipelineFailure
from protspace_prep.api import _safe_download_name


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


# ---------------------------------------------------------------------------
# Fix 1 — Content-Disposition header injection
# ---------------------------------------------------------------------------

class TestSafeDownloadName:
    def test_normal_name(self):
        assert _safe_download_name("my_sequences.fasta") == "my_sequences.parquetbundle"

    def test_strips_extension(self):
        assert _safe_download_name("data.txt") == "data.parquetbundle"

    def test_hostile_double_quote(self):
        result = _safe_download_name('foo".bar')
        assert '"' not in result
        assert result.endswith(".parquetbundle")

    def test_hostile_crlf(self):
        result = _safe_download_name("evil\r\nX-Header: pwn")
        assert "\r" not in result
        assert "\n" not in result
        assert result.endswith(".parquetbundle")

    def test_empty_stem_falls_back_to_protspace(self):
        result = _safe_download_name(".fasta")
        assert result == "protspace.parquetbundle"

    def test_long_stem_is_capped(self):
        long_name = "a" * 200 + ".fasta"
        result = _safe_download_name(long_name)
        stem = result[: -len(".parquetbundle")]
        assert len(stem) <= 80

    def test_no_extension_input(self):
        result = _safe_download_name("myfile")
        assert result == "myfile.parquetbundle"


async def test_bundle_download_with_hostile_filename_produces_safe_header(app_factory):
    """End-to-end: upload a file with a hostile name; Content-Disposition must be clean."""
    app = app_factory()
    async with await _client(app) as c:
        hostile = 'evil"\r\nX-Injected: pwn'
        files = {"file": (hostile, b">P12345\nMKTAYIAK\n", "text/plain")}
        r = await c.post("/api/prepare", files=files)
        assert r.status_code == 202
        job_id = r.json()["job_id"]

        # Drain SSE to completion
        async with c.stream("GET", f"/api/prepare/{job_id}/events") as stream:
            async for chunk in stream.aiter_lines():
                if "done" in chunk or "error" in chunk:
                    pass

        r = await c.get(f"/api/prepare/{job_id}/bundle")
        assert r.status_code == 200

        cd = r.headers.get("content-disposition", "")
        assert '"' not in cd.split("filename=", 1)[-1].lstrip('"').rstrip('"') or cd.count('"') == 2
        assert "\r" not in cd
        assert "\n" not in cd
        assert "X-Injected" not in r.headers


# ---------------------------------------------------------------------------
# Fix 2 — SSE keep-alive frames
# ---------------------------------------------------------------------------

async def test_sse_keepalive_frame_emitted_on_slow_pipeline(app_factory, monkeypatch):
    """When no event arrives within the keepalive interval, a comment frame is sent."""
    import asyncio
    import protspace_prep.api as api_module

    # Speed up: use a very short keepalive interval so the test doesn't take 15s.
    monkeypatch.setattr(api_module, "_KEEPALIVE_INTERVAL_SECONDS", 0.05)

    gate = asyncio.Event()

    async def gated_pipeline(ctx, emit):
        await gate.wait()
        out = ctx.output_dir / "data.parquetbundle"
        out.write_bytes(b"BUNDLE")
        return out

    app = app_factory(pipeline=gated_pipeline)
    async with await _client(app) as c:
        files = {"file": ("seq.fasta", b">P12345\nMKTAYIAK\n", "text/plain")}
        r = await c.post("/api/prepare", files=files)
        assert r.status_code == 202
        job_id = r.json()["job_id"]

        received: list[bytes] = []

        async def collect_briefly():
            async with c.stream("GET", f"/api/prepare/{job_id}/events") as stream:
                async for chunk in stream.aiter_bytes():
                    received.append(chunk)
                    # Stop after we've seen a keepalive or done event
                    combined = b"".join(received)
                    if b":\n\n" in combined or b"event: done" in combined:
                        break

        # Let SSE run briefly (pipeline is gated), collect until keepalive appears
        await asyncio.wait_for(collect_briefly(), timeout=2.0)

        combined = b"".join(received)
        assert b":\n\n" in combined, "Expected SSE keepalive comment frame"

        # Ungate so the pipeline can finish and resources are cleaned up
        gate.set()


# ---------------------------------------------------------------------------
# Fix 6 — bundle() marks consumed before read
# ---------------------------------------------------------------------------

async def test_bundle_read_error_does_not_consume(app_factory, monkeypatch, tmp_path):
    """If read_bytes raises OSError, consumed flag must NOT be set (retry possible)."""
    import protspace_prep.api as api_module

    app = app_factory()
    async with await _client(app) as c:
        files = {"file": ("seq.fasta", b">P12345\nMKTAYIAK\n", "text/plain")}
        r = await c.post("/api/prepare", files=files)
        assert r.status_code == 202
        job_id = r.json()["job_id"]

        # Wait for job to finish
        async with c.stream("GET", f"/api/prepare/{job_id}/events") as stream:
            async for chunk in stream.aiter_lines():
                if "done" in chunk or "error" in chunk:
                    pass

        # Patch Path.read_bytes to raise PermissionError on first call only
        original_read_bytes = Path.read_bytes
        call_count = 0

        def failing_read_bytes(self):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise PermissionError("simulated permission denied")
            return original_read_bytes(self)

        monkeypatch.setattr(Path, "read_bytes", failing_read_bytes)

        # First download attempt should fail with 500
        r1 = await c.get(f"/api/prepare/{job_id}/bundle")
        assert r1.status_code == 500

        # Restore normal read_bytes
        monkeypatch.setattr(Path, "read_bytes", original_read_bytes)

        # Second attempt should succeed (bundle not yet consumed)
        r2 = await c.get(f"/api/prepare/{job_id}/bundle")
        assert r2.status_code == 200
        assert r2.content == b"FAKE_BUNDLE"
