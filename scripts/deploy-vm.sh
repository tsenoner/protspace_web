#!/usr/bin/env bash
# First-time deploy on a fresh VM. Run from a checkout of this repo.
# After this, use update-vm.sh for routine pulls.

set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
    echo "ERROR: .env not found. Copy .env.example to .env and edit it." >&2
    exit 1
fi

docker compose \
    -f docker-compose.yml \
    -f docker-compose.prod.yml \
    --env-file .env \
    pull

docker compose \
    -f docker-compose.yml \
    -f docker-compose.prod.yml \
    --env-file .env \
    up -d

docker compose \
    -f docker-compose.yml \
    -f docker-compose.prod.yml \
    --env-file .env \
    ps
