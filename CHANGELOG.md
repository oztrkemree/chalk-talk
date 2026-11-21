# Changelog

## Unreleased

- **Film style.** `"style": "film"` draws characters and things instead of blocks, on a lit stage: people with faces, a robot for an agent (`bot`), a guard's booth for a hook (`gate`), little buildings, a chest of drawers, notebooks, and an envelope for what travels. The caption becomes one large narrated line. First slice: the props, the envelope and the caption; stop and stamp beats, speech bubbles and the close-up panel are not in yet.
- **Stage.** `"stage": true` (or `?stage`) plays an iso talk as a lit scene: a dark house, a spotlight with a visible beam that glides to what each step is about, paths that light up behind the packets, a ring and sparks where they land, every active block throwing its colour on the floor, the caption arriving word by word, and the title alone in the dark before step one. The recap brings the house lights up with the whole trip glowing.
- **The camera directs.** It moves in on what each step is about (up to 1.6x) and pulls back for the recap. `"camera": "wide"` keeps the old framing.
- **Receipts.** When a packet lands on a verified edge, a card shows the matched line of code and `✓ file:line`.
- **Sound.** Five short synthesized cues; `M` mutes, `"sound": false` starts muted.
- **Autoplay you can see.** The current progress segment fills while a step is on, steps end between two packet passes, and an idle board rests after three passes.
- **Contrast.** Text-sized colours reach 4.5:1 in every style and theme. In the default light look, packet labels on the coral accent are now dark and the semantic colours are a little deeper.
- Keyboard and touch: a focused button keeps Space and Enter, the code panel keeps its scroll keys and returns focus when it closes, progress segments have a 23px hit area, pinch-zoom works on the board.

## 0.3.0

- **Stricter proof** (both skills). A `calls` string now has to match whole names (`"t("` no longer passes because the range contains `split(`), a match on a comment line doesn't count, and a range over 120 lines with `calls` is `broken` instead of proving anything. A talk that passed only by one of these turns `!` on the next build.
- `build.mjs --strict` exits 1 when a proof is broken, so CI can catch a talk whose code has moved. The page is still written.
- Tests for the proof rules: `node --test test/proof.test.mjs`.
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
