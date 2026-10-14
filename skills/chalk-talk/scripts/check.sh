#!/usr/bin/env bash
# Lint a built chalk talk and take a PNG of every step with headless Chrome.
#
#   check.sh talk.html [snap-dir]
#
# Prints the engine's layout report (overlaps, arrows through boxes, crowded steps, long text)
# and writes step-1.png ... step-N.png. Problem areas are boxed in red on the PNGs.
# Exit code: 0 = clean or warnings only, 1 = errors to fix, 2 = no Chrome found.
# Set CHROME=/path/to/chrome to pick a browser, CHALK_THEME=dark for dark snapshots,
# CHALK_STYLE=blueprint (or studio, editorial) to check another style than the scene's own.
set -euo pipefail

src="${1:?usage: check.sh talk.html [snap-dir]}"
[ -f "$src" ] || { echo "check: no such file: $src" >&2; exit 1; }
html="$(cd "$(dirname "$src")" && pwd)/$(basename "$src")"
snaps="${2:-${html%.html}-snaps}"

find_chrome() {
  if [ -n "${CHROME:-}" ]; then echo "$CHROME"; return 0; fi
  local c
  for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
           "/Applications/Chromium.app/Contents/MacOS/Chromium" \
           "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
           "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"; do
    [ -x "$c" ] && { echo "$c"; return 0; }
  done
  for c in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge brave-browser; do
    command -v "$c" >/dev/null 2>&1 && { command -v "$c"; return 0; }
  done
  return 1
}
chrome="$(find_chrome)" || { echo "check: no Chrome/Chromium found; set CHROME=/path/to/chrome" >&2; exit 2; }

url="file://$(printf '%s' "$html" | sed -e 's/%/%25/g' -e 's/ /%20/g' -e 's/#/%23/g' -e 's/?/%3F/g')"
theme="${CHALK_THEME:-light}"
extra="theme=$theme${CHALK_STYLE:+&style=$CHALK_STYLE}"
profile="$(mktemp -d "${TMPDIR:-/tmp}/chalk-talk-chrome.XXXXXX")"
trap 'rm -rf "$profile"' EXIT
flags=(--headless=new --disable-gpu --hide-scrollbars --no-first-run --no-default-browser-check
       --virtual-time-budget=8000 --user-data-dir="$profile")

# Some Chrome builds finish their work but never exit in headless mode,
# so each run gets a watchdog: stop as soon as the output is complete (max ~30 s).
chrome_dump() {  # url outfile
  : > "$2"
  "$chrome" "${flags[@]}" --dump-dom "$1" > "$2" 2>/dev/null &
  local pid=$! i=0
  while kill -0 "$pid" 2>/dev/null && [ $i -lt 150 ]; do
    grep -q '</html>' "$2" 2>/dev/null && break
    sleep 0.2; i=$((i + 1))
  done
  kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null || true
}
chrome_shot() {  # url png
  rm -f "$2"
  "$chrome" "${flags[@]}" --force-device-scale-factor=1 --window-size=1600,1060 --screenshot="$2" "$1" >/dev/null 2>&1 &
  local pid=$! i=0 last=-1 size
  while kill -0 "$pid" 2>/dev/null && [ $i -lt 150 ]; do
    if [ -s "$2" ]; then size=$(wc -c < "$2"); [ "$size" = "$last" ] && break; last=$size; fi
    sleep 0.2; i=$((i + 1))
  done
  kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null || true
}

chrome_dump "$url?snap&$extra" "$profile/dom.html"
report="$(tr '\n' ' ' < "$profile/dom.html" | sed -n 's/.*id="chalk-report"[^>]*>\([^<]*\)<\/script>.*/\1/p')"
[ -n "$report" ] || { echo "check: the page did not produce a report (JS error? open it in a browser and check the console)" >&2; exit 1; }

summary() {
  if command -v python3 >/dev/null 2>&1; then
    python3 -I -c '
import json, sys
r = json.loads(sys.argv[1])
iss = r["issues"]
errs = [i for i in iss if i["level"] == "error"]
print("steps: %d   errors: %d   warnings: %d" % (r["steps"], len(errs), len(iss) - len(errs)))
for i in iss:
    print(("  ERROR " if i["level"] == "error" else "  warn  ") + i["where"] + ": " + i["msg"])
print("STEPS=%d" % r["steps"])
print("ERRORS=%d" % len(errs))
' "$1"
  else
    node -e '
const r = JSON.parse(process.argv[1]); const errs = r.issues.filter(i => i.level === "error");
console.log(`steps: ${r.steps}   errors: ${errs.length}   warnings: ${r.issues.length - errs.length}`);
for (const i of r.issues) console.log((i.level === "error" ? "  ERROR " : "  warn  ") + i.where + ": " + i.msg);
console.log("STEPS=" + r.steps); console.log("ERRORS=" + errs.length);
' "$1"
  fi
}
out="$(summary "$report")"
printf '%s\n' "$out" | grep -v -e '^STEPS=' -e '^ERRORS='
steps="$(printf '%s\n' "$out" | sed -n 's/^STEPS=//p')"
errors="$(printf '%s\n' "$out" | sed -n 's/^ERRORS=//p')"

mkdir -p "$snaps"
for i in $(seq 1 "${steps:-0}"); do
  chrome_shot "$url?snap&debug&$extra#$i" "$snaps/step-$i.png"
done
echo "snapshots: $snaps/step-1.png ... step-${steps}.png"
[ "${errors:-0}" = "0" ] || exit 1
