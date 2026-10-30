#!/usr/bin/env bash
set -euo pipefail
paint_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec python3 -m http.server "${PAINT_PORT:-8765}" --bind 127.0.0.1 --directory "$paint_root/dist"
