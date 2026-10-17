#!/usr/bin/env bash
# Lint a built chalk talk and take a PNG of every step with headless Chrome. The work is done by check.mjs.
#   check.sh talk.html [snap-dir]
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
command -v node >/dev/null 2>&1 || { echo "check: needs Node.js >= 18 (https://nodejs.org)" >&2; exit 1; }
exec node "$here/check.mjs" "$@"
