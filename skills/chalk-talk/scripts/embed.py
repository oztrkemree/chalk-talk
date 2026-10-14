"""Resolve "code" fields in a chalk-talk scene and write the scene with the snippets embedded.

    python3 -I embed.py scene.json out.json

A node or edge can point at the real code:
    "code": "src/auth/login.ts:12-40"      lines 12..40
    "code": "src/auth/login.ts:18"         from line 18, that line marked
    "code": "src/auth/login.ts"            the top of the file
    "code": { "file": "...", "lines": [12, 40], "mark": [18, 22] }

Paths resolve against the scene's "root" (relative to the scene file), else the current
directory, else the scene's directory. The snippet, its line range, an absolute path for
"open in editor" links and, inside a GitHub checkout, a permalink are stored next to it.
CHALK_SHARE=1 leaves the absolute path out (for pages sent to other people).
"""
import json
import os
import re
import subprocess
import sys

MAX_LINES = 120
TOP_LINES = 40
AFTER_ONE = 24

scene_path, out_path = sys.argv[1], sys.argv[2]
with open(scene_path, encoding="utf-8") as f:
    scene = json.load(f)
scene_dir = os.path.dirname(os.path.abspath(scene_path))
share = os.environ.get("CHALK_SHARE") == "1"
warnings = []


def roots():
    out = []
    if isinstance(scene.get("root"), str):
        out.append(os.path.normpath(os.path.join(scene_dir, scene["root"])))
    out += [os.getcwd(), scene_dir]
    return out


def parse(spec):
    if isinstance(spec, str):
        m = re.match(r"^(.*?)(?::(\d+)(?:-(\d+))?)?$", spec.strip())
        file, a, b = m.group(1), m.group(2), m.group(3)
        if a and not b:
            return file, int(a), int(a) + AFTER_ONE, [int(a), int(a)]
        return file, int(a) if a else None, int(b) if b else None, None
    if isinstance(spec, dict) and isinstance(spec.get("file"), str):
        lines = spec.get("lines") or []
        lines = [lines] if isinstance(lines, int) else lines
        mark = spec.get("mark")
        mark = [mark, mark] if isinstance(mark, int) else mark
        a = lines[0] if len(lines) > 0 else None
        b = lines[1] if len(lines) > 1 else (a + AFTER_ONE if a else None)
        return spec["file"], a, b, mark if isinstance(mark, list) and len(mark) == 2 else None
    return None


def git_permalink(abs_path):
    """https://github.com/owner/repo/blob/<sha>/<path> when the file sits in a GitHub checkout."""
    d = os.path.dirname(abs_path)
    try:
        run = lambda *a: subprocess.run(["git", "-C", d, *a], capture_output=True, text=True, timeout=5).stdout.strip()
        top, url, sha = run("rev-parse", "--show-toplevel"), run("remote", "get-url", "origin"), run("rev-parse", "HEAD")
        if not (top and url and sha) or run("ls-files", "--error-unmatch", abs_path) == "":
            return None
    except Exception:
        return None
    m = re.match(r"^(?:git@github\.com:|https://github\.com/|ssh://git@github\.com/)([^/]+/[^/]+?)(?:\.git)?/?$", url)
    if not m:
        return None
    rel = os.path.relpath(abs_path, top).replace(os.sep, "/")
    return f"https://github.com/{m.group(1)}/blob/{sha}/{rel}"


def resolve(where, spec):
    p = parse(spec)
    if not p:
        warnings.append(f'{where}: "code" should be "path:start-end" or {{"file", "lines"}}')
        return None
    file, a, b, mark = p
    abs_path = next((os.path.join(r, file) for r in roots() if os.path.isfile(os.path.join(r, file))), None)
    if not abs_path:
        warnings.append(f"{where}: code file not found: {file}")
        return {"file": file, "missing": True}
    with open(abs_path, encoding="utf-8", errors="replace") as f:
        lines = f.read().splitlines()
    start = max(1, a or 1)
    end = min(len(lines), b or (start + TOP_LINES - 1))
    if end < start:
        warnings.append(f"{where}: {file} has {len(lines)} lines, asked for {start}-{b}")
        start, end = 1, min(len(lines), TOP_LINES)
    if end - start + 1 > MAX_LINES:
        warnings.append(f"{where}: {file}:{start}-{end} is long; showing the first {MAX_LINES} lines")
        end = start + MAX_LINES - 1
    out = {"file": file, "start": start, "end": end, "text": "\n".join(lines[start - 1:end])}
    if mark:
        out["mark"] = mark
    if not share:
        out["abs"] = os.path.abspath(abs_path)
    link = git_permalink(os.path.abspath(abs_path))
    if link:
        out["url"] = f"{link}#L{start}-L{end}"
    return out


for kind in ("nodes", "edges"):
    for i, item in enumerate(scene.get(kind) or []):
        if isinstance(item, dict) and "code" in item:
            item["code"] = resolve(item.get("id") or f"{kind}[{i}]", item["code"])

for w in warnings:
    print("build: warn " + w, file=sys.stderr)

text = json.dumps(scene, ensure_ascii=False, indent=1)
# a literal "</script" (common in HTML snippets) would close the page's script tag
text = text.replace("</", "<\\/")
with open(out_path, "w", encoding="utf-8") as f:
    f.write(text + "\n")
