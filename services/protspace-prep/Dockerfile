FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_NO_CACHE=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/*

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

CMD ["uvicorn", "protspace_prep.app:app", "--host", "0.0.0.0", "--port", "8000"]
