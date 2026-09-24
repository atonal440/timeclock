#!/bin/bash
# Install npm dependencies at the start of Claude Code on the web sessions so
# lint, unit tests, and builds work immediately. No-op on local machines.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
npm install --no-audit --no-fund
