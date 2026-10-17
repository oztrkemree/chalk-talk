# Changelog

## Unreleased

- **New skill: `frames`.** Explain anything (pitches, PRDs, strategy, incidents, lessons, code) as a 60–120 s story in one HTML file: one idea per frame, eight lenses, ink-on-paper style with one accent, present mode with notes, phone layout. Seven example stories in `skills/frames/examples/`.
- `check.mjs` (frames) drives one headless Chrome at below-normal priority over the DevTools protocol and removes its temp profile.

## 0.2.0

- **Proof.** Every arrow can cite the line it happens on (`code`) and the call that proves it (`calls`). The build checks each one and marks it ✓ verified, ? inferred (with the reason) or ! broken. `V` shows which hops are proven; the recap says "6 of 7 hops traced to code".
- **Change mode.** Explain a pull request or branch: parts marked `added`, `changed` or `removed`, a PR chip with `+2 ~1 −1`, and `D` flips before / after.
- **Click an arrow, see its line.** Edges with code open the code panel with the matching line highlighted.
- **GIF export.** `node scripts/record.mjs talk.html` records a talk to an animated GIF for READMEs, PRs and chat.
- **Cross-platform scripts.** `build.mjs`, `check.mjs` and `record.mjs` are plain Node with no dependencies; Windows works. `build.sh` / `check.sh` remain as wrappers. `embed.py` is gone.
- **Any agent.** Install with `npx skills add oztrkemree/chalk-talk` for Codex, Cursor, Gemini CLI, OpenCode, Copilot and others.
- **Gallery.** Talks on Express, Vite, Redis, git, Codex, FastAPI and a real Express PR, every arrow traced.
- Deterministic playback API: `chalk.ready`, `chalk.steps()`, `chalk.duration(k)`, `chalk.seek(k, ms)`.

## 0.1.0

- First release: isometric step-by-step talks in one HTML file, sequence layout, studio / blueprint / editorial styles, code panel with GitHub permalinks.
