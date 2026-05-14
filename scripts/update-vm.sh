#!/usr/bin/env bash
# Routine update: git pull, refresh images per .env, restart containers.

set -euo pipefail

cd "$(dirname "$0")/.."

git pull --ff-only

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

docker image prune -f
