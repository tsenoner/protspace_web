import asyncio
from pathlib import Path
from unittest.mock import patch, AsyncMock, MagicMock

import pytest

from protspace_prep.config import load_settings
from protspace_prep.jobs import JobContext, PipelineFailure
from protspace_prep.pipeline import run_protspace_prepare


@pytest.fixture
def ctx(tmp_path: Path):
    job_dir = tmp_path / "jobs" / "abc"
    job_dir.mkdir(parents=True)
    fasta = job_dir / "input.fasta"
    fasta.write_text(">id\nMKT\n")
    return JobContext(
        job_id="abc",
        fasta_path=fasta,
        output_dir=job_dir,
        original_name="t.fasta",
    )


def _mock_subprocess(returncode: int, stderr_lines: list[bytes]):
    proc = MagicMock()
    proc.returncode = returncode

    async def _wait():
        return returncode

    proc.wait = _wait
    proc.stderr = MagicMock()

    async def _readline_side_effect():
        for line in stderr_lines:
            yield line
        yield b""  # EOF

    iterator = _readline_side_effect()

    async def _readline():
        try:
            return await iterator.__anext__()
        except StopAsyncIteration:
            return b""

    proc.stderr.readline = _readline
    proc.kill = MagicMock()
    return proc


async def test_success_path_writes_bundle_and_emits_stages(ctx, tmp_path: Path):
    bundle_path = ctx.output_dir / "data.parquetbundle"
    stderr = [
        b"INFO Loading FASTA\n",
        b"INFO Embedding sequences via Biocentral\n",
        b"INFO Running PCA projection\n",
        b"INFO Fetching annotations\n",
        b"INFO Bundling output\n",
    ]
    proc = _mock_subprocess(returncode=0, stderr_lines=stderr)

    async def fake_create(*args, **kwargs):
        bundle_path.write_bytes(b"BUNDLE")
        return proc

    emitted = []

    async def emit(stage, payload):
        emitted.append((stage, payload))

    settings = load_settings()
    with patch("asyncio.create_subprocess_exec", new=fake_create):
        result = await run_protspace_prepare(ctx, emit, settings)
    assert result == bundle_path
    stages = [stage for stage, _ in emitted]
    assert "embedding" in stages
    assert "projecting" in stages
    assert "annotating" in stages
    assert "bundling" in stages


async def test_nonzero_exit_raises_pipeline_failure(ctx):
    stderr = [b"ERROR Biocentral returned 503: unavailable\n"]
    proc = _mock_subprocess(returncode=2, stderr_lines=stderr)

    async def fake_create(*args, **kwargs):
        return proc

    settings = load_settings()
    with patch("asyncio.create_subprocess_exec", new=fake_create):
        with pytest.raises(PipelineFailure) as exc:
            await run_protspace_prepare(ctx, AsyncMock(), settings)
    assert "Biocentral returned 503" in str(exc.value)


async def test_pipeline_timeout_kills_subprocess_and_raises(ctx, monkeypatch):
    proc = MagicMock()
    proc.returncode = None
    proc.kill = MagicMock()
    proc.stderr = MagicMock()

    async def _readline():
        await asyncio.sleep(60)
        return b""

    proc.stderr.readline = _readline

    async def _wait():
        await asyncio.sleep(60)
        return 0

    proc.wait = _wait

    async def fake_create(*args, **kwargs):
        return proc

    base = load_settings()
    fields = {k: getattr(base, k) for k in base.__slots__}
    fields["pipeline_timeout_seconds"] = 0
    settings = type(base)(**fields)
    with patch("asyncio.create_subprocess_exec", new=fake_create):
        with pytest.raises(PipelineFailure) as exc:
            await run_protspace_prepare(ctx, AsyncMock(), settings)
    assert "timed out" in str(exc.value).lower()
    assert proc.kill.called


async def test_missing_bundle_after_success_raises_pipeline_failure(ctx):
    proc = _mock_subprocess(returncode=0, stderr_lines=[])

    async def fake_create(*args, **kwargs):
        return proc  # bundle file never created

    settings = load_settings()
    with patch("asyncio.create_subprocess_exec", new=fake_create):
        with pytest.raises(PipelineFailure):
            await run_protspace_prepare(ctx, AsyncMock(), settings)
