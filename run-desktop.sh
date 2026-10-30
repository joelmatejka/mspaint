#!/usr/bin/env bash
set -euo pipefail
paint_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [[ -x "$paint_root/node_modules/electron/dist/electron" ]]; then
  exec "$paint_root/node_modules/electron/dist/electron" "$paint_root" "$@"
fi
if command -v npm >/dev/null 2>&1; then
  cd "$paint_root"
  exec npm run desktop -- "$@"
fi
printf '%s\n' 'Install Node.js 22.12 or newer, then run npm ci and npm run desktop.' >&2
exit 1
