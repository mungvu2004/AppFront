#!/usr/bin/env bash
# code-search: grep source for a pattern. Prefers ripgrep, falls back to grep.
# Usage: code-search.sh <pattern> [path]
set -euo pipefail
IFS=$'\n\t'

if [ "$#" -lt 1 ]; then
  echo "usage: code-search.sh <pattern> [path]" >&2
  exit 2
fi

PATTERN="$1"
SEARCH_PATH="${2:-src}"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

if [ ! -e "$SEARCH_PATH" ]; then
  echo "path not found: $SEARCH_PATH" >&2
  exit 0
fi

# ripgrep is not in available_binaries; guard and fall back to grep.
if command -v rg >/dev/null 2>&1; then
  rg --line-number --no-heading --color never -- "$PATTERN" "$SEARCH_PATH" || true
else
  # grep -r is portable; exclude common noise dirs.
  grep -rIn \
    --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist \
    -- "$PATTERN" "$SEARCH_PATH" || true
fi
exit 0
