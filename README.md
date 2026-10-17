<div align="center">

# chalk-talk

### Don't read the map. Watch the journey.

Ask your coding agent *"how does this work?"* and get a step-by-step animated walkthrough of the
real code path, in one HTML file, where **every arrow is traced to the line of code it happens on**
or honestly marked as a guess.

[**Live site & gallery**](https://oztrkemree.github.io/chalk-talk/) · [Install](#install) · [Proof](#every-arrow-has-a-receipt) · [Explain a PR](#explain-a-pull-request) · [Scene format](skills/chalk-talk/references/scene-spec.md)

![MIT license](https://img.shields.io/badge/license-MIT-blue) ![One HTML file](https://img.shields.io/badge/output-one%20HTML%20file-ff5a5f) ![No dependencies](https://img.shields.io/badge/dependencies-none-2ea44f) ![Agent Skills](https://img.shields.io/badge/Agent%20Skills-Claude%20Code%20%C2%B7%20Codex%20%C2%B7%20Cursor%20%C2%B7%20Gemini-d97757)

English · [简体中文](docs/i18n/README.zh-CN.md) · [日本語](docs/i18n/README.ja.md) · [한국어](docs/i18n/README.ko.md) · [Español](docs/i18n/README.es.md) · [Türkçe](docs/i18n/README.tr.md)

![What git commit writes to disk, drawn on a chalkboard: objects appear one by one and packets travel between them](docs/media/hero-chalk.gif)

<sub>`git commit`, explained from git's own source. 9 of 9 hops traced to code. <a href="https://oztrkemree.github.io/chalk-talk/gallery/git-commit/git-commit.html?style=chalk">Open it live →</a></sub>

</div>

## Why

Diagrams and knowledge graphs show you **what exists**. When you're new to a codebase, or staring
at a PR an AI wrote, the question is **what happens, in what order, and where in the code**.

chalk-talk answers that the way a good engineer at a whiteboard would: one thing at a time. The
first box, one sentence, an arrow, a packet moving along it ("`JWT`", "`order #42`",
"`SELECT`"). Earlier parts fade back; the new part is lit. At the end the whole trip replays.
Click any block or arrow and the exact lines open, with a GitHub permalink.

Your agent writes a tiny scene file. The engine does the layout, routing, 3D drawing and
animation, then screenshots every step so the agent checks its own work before you see it.

## Every arrow has a receipt

An animated diagram that's wrong is worse than no diagram: it's a *more convincing*
hallucination. So in chalk-talk an arrow isn't just drawn. It's **cited**:

```json
{ "from": "router", "to": "layer", "label": "match(path)",
  "code": "router/index.js:230-247", "calls": "matchLayer(layer, path)" }
```

The build opens the file, reads those lines and checks that `matchLayer(layer, path)` is really
there. Then every arrow gets a mark:

| mark | means |
|---|---|
| ✓ **verified** | the cited lines exist and contain the call |
| **?** **inferred** | no line to point at (network boundary, dynamic dispatch), with the reason |
| **!** **broken** | the call isn't in those lines. The build warns, the agent fixes it |

```
$ node scripts/build.mjs express-request.scene.json
proof: 7/9 hops traced to code (7 verified, 0 cited) · 2 inferred · 0 broken
```

Press **`V`** in any talk to see which hops are proven. The recap says it out loud:
*"7 of 9 hops traced to code · 2 inferred"*.

![Proof view: Express 5 request journey, every proven arrow with a check mark, the two inferred hops dotted with a question mark](docs/media/proof-view.png)

## Gallery

Every talk below was written by an agent from the real source, and every arrow is checked.

| talk | repo | proof |
|---|---|---|
| [What git commit writes to disk](https://oztrkemree.github.io/chalk-talk/gallery/git-commit/git-commit.html) | git/git | 9/9 traced |
| [How Codex CLI runs a shell command](https://oztrkemree.github.io/chalk-talk/gallery/codex-exec/codex-exec.html) | openai/codex | 10/10 traced |
| [How Vite hot-updates a module](https://oztrkemree.github.io/chalk-talk/gallery/vite-hmr/vite-hmr.html) | vitejs/vite | 7/8 traced, 1 inferred |
| [What Redis does with `SET greeting hello`](https://oztrkemree.github.io/chalk-talk/gallery/redis-set/redis-set.html) | redis/redis | 8/9 traced, 1 inferred |
| [How FastAPI calls your function](https://oztrkemree.github.io/chalk-talk/gallery/fastapi-request/fastapi-request.html) | fastapi/fastapi | 8/9 traced, 1 inferred |
| [What happens when a request hits `app.get()`](https://oztrkemree.github.io/chalk-talk/gallery/express-request/express-request.html) | expressjs/express | 7/9 traced, 2 inferred |
| [PR #7459: chunked responses get their ETag back](https://oztrkemree.github.io/chalk-talk/gallery/express-pr/express-pr.html) | expressjs/express | 5/6 traced, 1 inferred |
| [How chalk-talk proves every arrow](https://oztrkemree.github.io/chalk-talk/skills/chalk-talk/examples/build.html) | this repo | 6/7 traced, 1 inferred |

`→` / `space` steps, `P` plays, `V` proof view, `T` light/dark, click a block or arrow for its code.

## Frames: explain anything, not just code

The second skill, **`frames`**, turns anything you need to explain into a 60–120 second story in
one HTML file: a pitch, a PRD, a strategy memo, an incident review, a lesson, a code walkthrough.
One idea per frame, each drawn with the lens that fits its question (`title`, `moment`, `flow`,
`number`, `whatif`, `compare`, `screen`, `timeline`), in one calm ink-on-paper style with a
single accent color. It plays by itself when forwarded, presents live (`F`, notes with `N`) and
reflows to a phone.

> pitch the split-bill feature to my VP as a story

| story | for |
|---|---|
| [Ödeyen kişi cezalandırılmasın](https://oztrkemree.github.io/chalk-talk/skills/frames/examples/hesabi-bol.html) | product pitch to a VP (Turkish) |
| [Your bedtime voice, wherever you are](https://oztrkemree.github.io/chalk-talk/skills/frames/examples/startup-pitch.html) | seed pitch |
| [Free forever ends](https://oztrkemree.github.io/chalk-talk/skills/frames/examples/strategy-memo.html) | strategy memo, all hands |
| [One config change stopped checkout](https://oztrkemree.github.io/chalk-talk/skills/frames/examples/incident-review.html) | incident review |
| [Save swaps one module, not the page](https://oztrkemree.github.io/chalk-talk/skills/frames/examples/code-onboarding.html) | code onboarding (Vite HMR, arrows proven) |
| [A vaccine is a practice run](https://oztrkemree.github.io/chalk-talk/skills/frames/examples/lesson-vaccines.html) | lesson |
| [İlk haftan](https://oztrkemree.github.io/chalk-talk/skills/frames/examples/ise-baslama.html) | onboarding a new hire (Turkish) |

The agent writes a small story file ([SPEC](skills/frames/SPEC.md)); the engine draws and lays
it out. `node skills/frames/scripts/build.mjs story.json` validates and builds,
`check.mjs` renders every frame wide and tall to PNG, `record.mjs` makes a GIF.

## Explain a pull request

> explain this PR with a chalk talk

The agent reads the diff and tells the journey **as it is after the change**, with what changed
lit up: `NEW`, `CHANGED`, `REMOVED`, a `PR #7459 · +2 ~4` chip, and **`D`** to flip between before
and after. Drop the GIF into the PR description and reviewers see the change before they read it.

![Change mode: Express PR #7459, the changed blocks ringed in amber, the new handler in green, the PR chip in the corner](docs/media/change-mode.png)

## Install

**Claude Code**

```
/plugin marketplace add oztrkemree/chalk-talk
/plugin install chalk-talk@chalk-talk
```

**Codex, Cursor, Gemini CLI, OpenCode, Copilot and [40+ other agents](https://agentskills.io)**

```bash
npx skills add oztrkemree/chalk-talk
```

**By hand**: copy `skills/chalk-talk` into your agent's skills folder (`~/.claude/skills/`, `~/.codex/skills/`, ...).

The scripts need Node 18+ (Windows, macOS, Linux). The visual self-check uses any installed
Chrome, Edge, Brave or Chromium.

## Use

Just ask, in any language:

> how does auth work in this repo?
>
> walk me through what happens when a webhook arrives
>
> explain this PR with a chalk talk
>
> bu kuyruk sistemi nasıl çalışıyor, çizerek anlat

or call it directly: `/chalk-talk the checkout flow`.

The agent writes `chalk-talks/<name>.scene.json`, builds `chalk-talks/<name>.html`, checks every
step as a screenshot and opens it. Keep the scene file: ask for changes ("split step 3", "show
the retry path") and the agent edits it.

| key | does |
|---|---|
| `→` / `space` / click | next step |
| `←` | previous step |
| `P` | autoplay (`?play=loop` in the URL loops) |
| `V` | proof view: which hops are traced to code |
| `D` | before / after, in a PR talk |
| `C` / click a block or arrow | the code behind it |
| `T` | light ↔ dark |
| `1`–`9` | jump to a step (also `#3` in the URL) |

On a phone the board turns portrait and follows the part each step is about.

## Share it

A talk is **one HTML file**: no server, works offline, send it to anyone.
`CHALK_SHARE=1` leaves your local paths out and keeps the GitHub permalinks.

Need it inline, in a README, a PR or Slack?

```bash
node skills/chalk-talk/scripts/record.mjs chalk-talks/auth.html --out auth.gif --style chalk
```

`record.mjs` drives your installed Chrome frame by frame (no ffmpeg, no npm packages) and writes
a looping GIF. `--steps 2-5`, `--width 960`, `--theme dark`.

## Styles

| | |
|---|---|
| **iso** (default) | little 3D blocks on an isometric floor; servers blink when a packet lands, databases ripple on a write, queues fill and drain |
| **chalk** | the same board drawn in chalk on a slate: hand-drawn strokes, pastel hatching |
| **studio** · **blueprint** · **editorial** | flat card layouts for bigger systems |

`"style": "chalk"` in the scene, or `?style=chalk` on any talk.

## How it works

```
your question ──▶ agent reads the code ──▶ scene.json ──▶ build.mjs ──▶ talk.html
                                               ▲          (proof check)      │
                                               └──── check.mjs: report + PNG per step
```

A scene is plain JSON: nodes on a coarse grid, edges between them (with the code that proves
them), and steps that say what to show, what flows and what to say:

```json
{
  "title": "How logging in works",
  "nodes": [
    { "id": "web", "kind": "browser", "label": "Web app", "at": [0, 0] },
    { "id": "api", "label": "Auth API", "sub": "POST /login", "icon": "key", "at": [1, 0],
      "code": "src/auth/login.ts:12-40" }
  ],
  "edges": [
    { "id": "req", "from": "web", "to": "api", "label": "POST /login", "packet": "email, pw",
      "code": "src/web/login.tsx:31-38", "calls": "fetch('/login'" }
  ],
  "steps": [
    { "title": "The request", "say": "The web app sends both to the **Auth API**.", "show": ["req"], "flow": ["req"] }
  ]
}
```

The engine (one HTML template, no dependencies) projects the grid onto an isometric floor, draws
each node as a 3D object, routes paths around blocks, places labels where they cover nothing,
and reports what it couldn't fix (`arrow api -> db runs through cache`) so the agent changes the
scene. Nine kinds of blocks, 37 icons, a sequence layout for handshakes and OAuth, five styles.
Everything is in the [scene reference](skills/chalk-talk/references/scene-spec.md).

Build a talk by hand, no agent needed:

```bash
node skills/chalk-talk/scripts/build.mjs my-talk.scene.json   # writes my-talk.html, checks proof
node skills/chalk-talk/scripts/check.mjs my-talk.html         # layout report + a PNG per step
```

## FAQ

**Can it still be wrong?** Yes: an agent can pick the wrong story or oversimplify. What it can't
do silently is draw an arrow that claims a call that isn't in the code: that's a `!` and a build
warning. The `?` marks show you exactly where the talk relies on judgment, not a line.

**Is my code sent anywhere?** No. chalk-talk is a skill your agent runs locally. The page is a
file on your disk; nothing is uploaded.

**Big repos?** One journey per talk, about 8 blocks. Ask for the next journey and you get the
next talk. Small focused talks beat one unreadable map.

## Credits

- Fonts: [Geist](https://vercel.com/font) by Vercel, [IBM Plex](https://www.ibm.com/plex/) by IBM,
  [Inter Tight](https://rsms.me/inter/), [Newsreader](https://fonts.google.com/specimen/Newsreader),
  [Caveat](https://fonts.google.com/specimen/Caveat) and
  [Patrick Hand](https://fonts.google.com/specimen/Patrick+Hand), all under the SIL Open Font
  License, loaded from Google Fonts and not bundled.
- The step-through idea owes a lot to Nicky Case's explorable explanations and Julia Evans' zines.

## License

[MIT](LICENSE). Use it, fork it, ship it. If it helped you understand something, a ⭐ helps others find it.
