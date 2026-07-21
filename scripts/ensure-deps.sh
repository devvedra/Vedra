#!/bin/sh
# Install workspace dependencies if node_modules is missing
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ ! -d "$ROOT/node_modules" ]; then
  echo "node_modules missing — running pnpm install..."
  cd "$ROOT" && pnpm install --frozen-lockfile
fi
