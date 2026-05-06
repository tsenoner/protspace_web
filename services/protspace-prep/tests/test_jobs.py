import asyncio
from pathlib import Path

import pytest

from protspace_prep.jobs import (
    JobRegistry,
    JobStatus,
    PipelineFailure,
)


@pytest.fixture
def tmp_job_root(tmp_path: Path) -> Path:
    return tmp_path / "jobs"


async def _fake_pipeline_success(ctx, emit):
    await emit("embedding", {"current": 1, "total": 1})
    await emit("projecting", {})
    bundle = ctx.output_dir / "data.parquetbundle"
    bundle.parent.mkdir(parents=True, exist_ok=True)
    bundle.write_bytes(b"fake-bundle-bytes")
    return bundle


async def _fake_pipeline_failure(ctx, emit):
    await emit("embedding", {})
    raise PipelineFailure("Biocentral returned 503: unavailable")


async def test_submit_runs_pipeline_and_publishes_terminal_done(tmp_job_root):
    registry = JobRegistry(
        job_root=tmp_job_root,
        max_concurrent=2,
        pipeline=_fake_pipeline_success,
    )
    job_id = await registry.submit(b">id\nMKT\n", original_name="t.fasta")
    events = []
    async for event in registry.subscribe(job_id):
        events.append(event)
    statuses = [e.event for e in events]
    assert statuses[0] == "queued"
    assert statuses[-1] == "done"
    state = registry.get(job_id)
    assert state.status is JobStatus.DONE
    assert state.bundle_path is not None
    assert state.bundle_path.read_bytes() == b"fake-bundle-bytes"


async def test_submit_runs_pipeline_and_publishes_terminal_error(tmp_job_root):
    registry = JobRegistry(
        job_root=tmp_job_root,
        max_concurrent=2,
        pipeline=_fake_pipeline_failure,
    )
    job_id = await registry.submit(b">id\nMKT\n", original_name="t.fasta")
    events = [e async for e in registry.subscribe(job_id)]
    assert events[-1].event == "error"
    assert "Biocentral returned 503" in events[-1].data["message"]
    state = registry.get(job_id)
    assert state.status is JobStatus.ERROR


async def test_semaphore_caps_active_jobs(tmp_job_root):
    started = asyncio.Event()
    release = asyncio.Event()
    active = 0
    peak = 0

    async def slow_pipeline(ctx, emit):
        nonlocal active, peak
        active += 1
        peak = max(peak, active)
        started.set()
        await release.wait()
        active -= 1
        bundle = ctx.output_dir / "data.parquetbundle"
        bundle.parent.mkdir(parents=True, exist_ok=True)
        bundle.write_bytes(b"x")
        return bundle

    registry = JobRegistry(
        job_root=tmp_job_root,
        max_concurrent=2,
        pipeline=slow_pipeline,
    )
    job_ids = [await registry.submit(b">i\nM\n", original_name="t.fasta") for _ in range(4)]
    await started.wait()
    await asyncio.sleep(0.05)
    assert peak == 2
    release.set()
    for job_id in job_ids:
        async for _ in registry.subscribe(job_id):
            pass
    assert peak == 2


async def test_multiple_concurrent_subscribers_each_receive_full_stream(tmp_job_root):
    release = asyncio.Event()

    async def gated_pipeline(ctx, emit):
        await emit("embedding", {})
        await release.wait()
        await emit("bundling", {})
        bundle = ctx.output_dir / "data.parquetbundle"
        bundle.parent.mkdir(parents=True, exist_ok=True)
        bundle.write_bytes(b"x")
        return bundle

    registry = JobRegistry(
        job_root=tmp_job_root,
        max_concurrent=1,
        pipeline=gated_pipeline,
    )
    job_id = await registry.submit(b">id\nMKT\n", original_name="t.fasta")

    async def collect():
        return [e async for e in registry.subscribe(job_id)]

    await asyncio.sleep(0.05)
    a = asyncio.create_task(collect())
    b = asyncio.create_task(collect())
    await asyncio.sleep(0.05)
    release.set()
    events_a, events_b = await asyncio.gather(a, b)
    stages_a = [e.event for e in events_a]
    stages_b = [e.event for e in events_b]
    assert stages_a[-1] == "done" and stages_b[-1] == "done"
    assert "progress" in stages_a and "progress" in stages_b


async def test_late_subscriber_receives_terminal_event_only(tmp_job_root):
    registry = JobRegistry(
        job_root=tmp_job_root,
        max_concurrent=1,
        pipeline=_fake_pipeline_success,
    )
    job_id = await registry.submit(b">id\nMKT\n", original_name="t.fasta")
    async for _ in registry.subscribe(job_id):
        pass
    events = [e async for e in registry.subscribe(job_id)]
    assert len(events) == 1
    assert events[0].event in {"done", "error"}


async def test_get_returns_none_for_unknown_job(tmp_job_root):
    registry = JobRegistry(
        job_root=tmp_job_root,
        max_concurrent=1,
        pipeline=_fake_pipeline_success,
    )
    assert registry.get("does-not-exist") is None


async def test_consume_bundle_returns_path_then_marks_consumed(tmp_job_root):
    registry = JobRegistry(
        job_root=tmp_job_root,
        max_concurrent=1,
        pipeline=_fake_pipeline_success,
    )
    job_id = await registry.submit(b">id\nMKT\n", original_name="t.fasta")
    async for _ in registry.subscribe(job_id):
        pass
    first = registry.consume_bundle(job_id)
    assert first is not None and first.exists()
    second = registry.consume_bundle(job_id)
    assert second is None


async def test_running_and_queued_counts(tmp_job_root):
    release = asyncio.Event()

    async def gated(ctx, emit):
        await release.wait()
        bundle = ctx.output_dir / "data.parquetbundle"
        bundle.parent.mkdir(parents=True, exist_ok=True)
        bundle.write_bytes(b"x")
        return bundle

    registry = JobRegistry(job_root=tmp_job_root, max_concurrent=1, pipeline=gated)
    a = await registry.submit(b">a\nM\n", original_name="t.fasta")
    b = await registry.submit(b">b\nM\n", original_name="t.fasta")
    await asyncio.sleep(0.05)
    assert registry.counts() == {"running": 1, "queued": 1}
    release.set()
    async for _ in registry.subscribe(a): pass
    async for _ in registry.subscribe(b): pass
    assert registry.counts() == {"running": 0, "queued": 0}
