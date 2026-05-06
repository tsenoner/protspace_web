from __future__ import annotations
import asyncio
import logging
import shutil
from pathlib import Path
from typing import Awaitable, Callable, Sequence

from protspace.data.loaders.h5 import parse_identifier

from .config import Settings
from .jobs import JobContext, PipelineFailure

logger = logging.getLogger("protspace_prep.pipeline")

EmitFn = Callable[[str, dict], Awaitable[None]]


def _normalize_fasta_headers(input_path: Path, output_path: Path) -> None:
    """Rewrite *input_path* into *output_path* with parsed-identifier headers.

    `protspace embed` keys H5 by the first whitespace-delimited token of the
    FASTA header (e.g. ``sp|P12345|NAME_HUMAN``), and `protspace project`
    propagates that raw key into ``projections_data.identifier``. But
    `protspace annotate` runs the same header through ``parse_identifier``
    (``sp|P12345|NAME_HUMAN`` → ``P12345``), and `protspace bundle` renames
    that to ``protein_id``. The bundle then carries two different keys for
    the same protein, and the frontend join in
    ``packages/core/src/components/data-loader/utils/bundle.ts`` produces
    zero merged annotations.

    Normalising headers up-front means both downstream paths see — and emit —
    identical identifiers, so the join holds. Plain headers (no UniProt
    pattern, no pipes) are left untouched, matching ``parse_identifier``'s
    fall-through behaviour.
    """
    with open(input_path) as fin, open(output_path, "w") as fout:
        for line in fin:
            if line.startswith(">"):
                stripped = line[1:].strip()
                if not stripped:
                    fout.write(line)
                    continue
                token = stripped.split()[0]
                fout.write(f">{parse_identifier(token)}\n")
            else:
                fout.write(line)


async def run_protspace_prepare(
    ctx: JobContext,
    emit: EmitFn,
    settings: Settings,
) -> Path:
    """Drive the protspace pipeline as four subprocess calls.

    `embed` (Biocentral) and `annotate` (UniProt) are network-bound and
    independent, so they run in parallel. `project` then `bundle` run in
    sequence. The whole run shares a single wall-clock budget set by
    ``settings.pipeline_timeout_seconds`` so the overall watchdog still
    matches the SSE contract.
    """
    embed_dir = ctx.output_dir / "embed"
    project_dir = ctx.output_dir / "project"
    annotations_path = ctx.output_dir / "annotations.parquet"
    bundle_path = ctx.output_dir / "data.parquetbundle"
    embed_dir.mkdir(parents=True, exist_ok=True)
    project_dir.mkdir(parents=True, exist_ok=True)

    normalized_fasta = ctx.output_dir / "input.normalized.fasta"
    _normalize_fasta_headers(ctx.fasta_path, normalized_fasta)

    embed_cmd = [
        "protspace",
        "embed",
        "-i",
        str(normalized_fasta),
        "-e",
        settings.embedder,
        "-o",
        str(embed_dir),
    ]
    annotate_cmd = [
        "protspace",
        "annotate",
        "-i",
        str(normalized_fasta),
        "-a",
        settings.annotations,
        "-o",
        str(annotations_path),
    ]

    try:
        async with asyncio.timeout(settings.pipeline_timeout_seconds):
            await emit("embedding", {})
            await emit("annotating", {})
            try:
                async with asyncio.TaskGroup() as tg:
                    tg.create_task(_run_step(ctx.job_id, "embed", embed_cmd))
                    tg.create_task(_run_step(ctx.job_id, "annotate", annotate_cmd))
            except* PipelineFailure as eg:
                raise eg.exceptions[0]

            h5_files = sorted(embed_dir.glob("*.h5"))
            if not h5_files:
                raise PipelineFailure("protspace embed produced no HDF5 file.")

            await emit("projecting", {})
            project_cmd = [
                "protspace",
                "project",
                "-i",
                str(h5_files[0]),
                "-m",
                settings.methods,
                "-o",
                str(project_dir),
            ]
            await _run_step(ctx.job_id, "project", project_cmd)

            await emit("bundling", {})
            bundle_cmd = [
                "protspace",
                "bundle",
                "-p",
                str(project_dir),
                "-a",
                str(annotations_path),
                "-o",
                str(bundle_path),
            ]
            await _run_step(ctx.job_id, "bundle", bundle_cmd)
    except asyncio.TimeoutError:
        raise PipelineFailure(
            f"protspace pipeline timed out after {settings.pipeline_timeout_seconds}s."
        )

    if not bundle_path.exists():
        raise PipelineFailure(
            "protspace bundle reported success but produced no .parquetbundle file."
        )
    return bundle_path


async def _run_step(job_id: str, name: str, cmd: Sequence[str]) -> None:
    """Run one protspace subcommand. Raise PipelineFailure on non-zero exit.

    Stderr is consumed line-by-line so the subprocess never blocks on a
    full pipe; the last 50 lines are kept for inclusion in failure messages.
    Cancellation (e.g. from a sibling failure in the TaskGroup, or the
    overall ``asyncio.timeout``) kills the subprocess before propagating.
    """
    logger.info("job=%s step=%s cmd=%s", job_id, name, " ".join(cmd))
    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.PIPE,
    )

    last_lines: list[str] = []

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
        return await process.wait()

    try:
        returncode = await _drain()
    except asyncio.CancelledError:
        process.kill()
        try:
            await asyncio.wait_for(process.wait(), timeout=5)
        except asyncio.TimeoutError:
            pass
        raise

    if returncode != 0:
        tail = "\n".join(last_lines[-10:]) or "no output"
        raise PipelineFailure(
            f"protspace {name} exited with code {returncode}: {tail}"
        )


def cleanup_job_dir(output_dir: Path) -> None:
    """Best-effort delete of a job's output directory."""
    shutil.rmtree(output_dir, ignore_errors=True)
