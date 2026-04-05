#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
ENV_FILE="$ROOT_DIR/.env.local-first"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE. Create it from .env.local-first.example first." >&2
  exit 1
fi

exec bun --env-file="$ENV_FILE" ./src/entrypoints/cli.tsx "$@"
