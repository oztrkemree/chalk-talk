#!/usr/bin/env bash
# Build a chalk talk (scene JSON -> one self-contained HTML file). The work is done by build.mjs.
#   build.sh path/to/name.scene.json [out.html]
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
command -v node >/dev/null 2>&1 || { echo "build: needs Node.js >= 18 (https://nodejs.org)" >&2; exit 1; }
exec node "$here/build.mjs" "$@"
