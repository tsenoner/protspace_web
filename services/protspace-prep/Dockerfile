FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_NO_CACHE=1

# System deps required by protspace's transitive scientific stack.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv.
RUN pip install --no-cache-dir uv==0.5.0

WORKDIR /app
COPY pyproject.toml ./
COPY src ./src

RUN uv pip install --system --no-cache .

RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /var/lib/protspace-prep/jobs \
    && chown -R appuser:appuser /var/lib/protspace-prep

USER appuser

ENV PREP_JOB_ROOT=/var/lib/protspace-prep/jobs
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:8000/healthz || exit 1

CMD ["uvicorn", "protspace_prep.app:app", "--host", "0.0.0.0", "--port", "8000"]
