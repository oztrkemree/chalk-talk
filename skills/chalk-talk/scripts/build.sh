#!/usr/bin/env bash
# Build a chalk talk: put a scene JSON into the template and write one self-contained HTML file.
#
#   build.sh path/to/name.scene.json [out.html]
#
# Default output: the scene path with ".scene.json" (or ".json") replaced by ".html".
# CHALK_SHARE=1 leaves local absolute paths out of embedded code (for pages sent to others).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
tpl="$here/../assets/template.html"
scene="${1:?usage: build.sh scene.json [out.html]}"
[ -f "$scene" ] || { echo "build: no such scene file: $scene" >&2; exit 1; }

if [ $# -ge 2 ]; then out="$2"
else
  case "$scene" in
    *.scene.json) out="${scene%.scene.json}.html" ;;
    *.json)       out="${scene%.json}.html" ;;
    *)            out="$scene.html" ;;
  esac
fi

# Fail early on broken JSON, with the parser's line/column, when a parser is available.
if command -v python3 >/dev/null 2>&1; then
  python3 -I -c 'import json,sys; json.load(open(sys.argv[1], encoding="utf-8"))' "$scene" \
    || { echo "build: $scene is not valid JSON" >&2; exit 1; }
elif command -v node >/dev/null 2>&1; then
  node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' "$scene" \
    || { echo "build: $scene is not valid JSON" >&2; exit 1; }
else
  echo "build: no python3 or node found, JSON not validated here; the page reports parse errors itself" >&2
fi

# A literal "</script" in a label would close the scene tag early. JSON allows "<\/script" instead.
if grep -qi '</script' "$scene"; then
  echo "build: scene contains '</script'; write it as '<\\/script'" >&2; exit 1
fi

mkdir -p "$(dirname "$out")"

# Nodes and edges with a "code" field get the real snippet embedded, so clicking them in the
# page shows the code. That needs python3; without it the page shows the file name only.
src="$scene"
if grep -q '"code"' "$scene"; then
  if command -v python3 >/dev/null 2>&1; then
    tmp="$(mktemp "${TMPDIR:-/tmp}/chalk-scene.XXXXXX")"
    trap 'rm -f "$tmp"' EXIT
    python3 -I "$here/embed.py" "$scene" "$tmp" || { echo "build: could not embed code snippets" >&2; exit 1; }
    src="$tmp"
  else
    echo "build: no python3 found, code snippets not embedded (the page shows file names only)" >&2
  fi
fi

awk -v f="$src" '$0 == "__SCENE__" { while ((getline line < f) > 0) print line; next } { print }' "$tpl" > "$out"
echo "$out"
