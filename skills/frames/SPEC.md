# chalk-talk frames — spec (internal; agents build against this)

## The product in one line
Give your agent anything you need to explain (a feature idea, a PRD, a Slack thread, meeting notes, a
strategy, a repo, a lesson) and get a **60–120 second story in one HTML file**: frame by frame, one idea
per frame, drawn in one calm human-made language (paper, ink, ONE accent color), that plays by itself
when forwarded and can be presented live, beautiful on a phone. Each frame uses the **lens** that fits its
question (Dan Roam): who/when → `moment`, how/where things flow → `flow`, how much → `number`,
what if → `whatif`, why/what changes → `compare`, what it looks like → `screen`, when → `timeline`,
the claim / the ask → `title`. Code explanations are a dialect of `flow` (tech actors + proof marks).

Research behind this (read the summaries): `C:/Users/oztrk/Projects/Brutex-Playground/notes/2026-10-17-yeni-anlatim-dili.md`.
Visual references (study them, they are the quality bar and the look we unify):
`C:/Users/oztrk/Projects/chalk-talk/explore/storyboard/index.html` (moment), `explore/zukai/index.html` (flow),
`explore/kartlar/index.html` (number / whatif / compare). Each folder has frame-*.png screenshots.

## Non-negotiable design rules
1. One idea per frame. Caption ≤ 20 words. Big text only for the one thing that matters.
2. Paper + ink + one accent. The accent marks only what is new/important in this frame. No gradients, glow, purple, drop-shadow stacks, glassmorphism, emoji.
3. Hand-made line: confident ink strokes with a subtle deterministic wobble (seeded SVG turbulence/displacement, or seeded path jitter). Same seed → same pixels.
4. Concrete before abstract: abstract frames keep a small concrete trace (the protagonist's head next to the metric).
5. Motion only shows change (something appears, moves, fills, flips). No idle loops except a single slow "breathe" on the focus.
6. Phone is first-class: every lens lays out natively in `tall` (portrait) and `wide`.
7. Honest: numbers carry a stamp when they are examples (`"stamp": "örnek veri"`); code flows carry proof marks.
8. Deterministic and seekable: every animation goes through `ctx.beat` / `ctx.anim` so `chalk.seek(k, ms)` renders the same frame every time.

## Files and ownership
```
skills/frames/
  SPEC.md                    (coordinator)
  engine/shell.html          core agent   — page skeleton with __CSS__, __JS__, __STORY__ slots
  engine/skin.css            core agent   — tokens, fonts, layout, controls, both themes
  engine/core.js             core agent   — runtime, ctx, navigation, modes, seek, report, stamps
  engine/lens-title.js       core agent   — reference lens (title / ask)
  engine/lens-moment.js      moment agent — storyboard lens + its character/prop/set kit
  engine/lens-flow.js        flow agent   — zukai lens + code dialect + proof marks
  engine/lens-card.js        card agent   — number, whatif, compare, screen, timeline lenses
  engine/dev.html            core agent   — loads the source files directly + a story by ?story=path, no build step
  scripts/build.mjs, check.mjs, record.mjs   scripts agent
  examples/*.story.json      coordinator / showcase agents
```
Load order inside the built page: skin.css; core.js, then every lens-*.js (each registers itself), then boot.

## Story file (`*.story.json`)
```json
{
  "title": "Hesabı böl",
  "subtitle": "ürün önerisi · VP sunumu",
  "lang": "tr",
  "accent": "tomato",                    // tomato | blue | green | amber | plum | or a #hex
  "theme": "paper",                      // paper | night
  "cast": [
    { "id": "deniz", "name": "Deniz", "look": { "hair": "bob", "top": "sweater", "glasses": false }, "hero": true },
    { "id": "ece", "name": "Ece", "look": { "hair": "beanie" } }
  ],
  "frames": [ { "lens": "title", ... }, { "lens": "moment", ... } ]
}
```
Common frame fields: `lens` (required), `kicker` (2–3 words, e.g. "SORUN"), `caption` (≤20 words; `**bold**` = ink bold, `*em*` = accent italic, `` `code` ``), `dur` (seconds on autoplay; default from word count), `stamp` (small rubber stamp text), `notes` (speaker notes, shown in present mode only), `id`.

### Lenses
- **title** — `headline` (≤8 words; `*word*` in accent italic), `sub`, `kind`: "open" | "ask" | "section". `ask` frames may have `items` (≤3 lines, e.g. "2 mühendis × 6 hafta") and a `sign` ("onay?") empty stamp.
- **moment** — storyboard shot.
  `set`: table | office | street | home | store | classroom | meeting | blank.
  `shot`: wide | close | insert | split.
  `people`: [{ `who` (cast id), `pose`: stand | sit | phone | point | cheer | think | walk | shrug | type, `mood`: happy | neutral | sad | annoyed | surprised | tired, `at`: left | center-left | center | center-right | right, `say`: "speech bubble", `think`: "thought bubble" }].
  `props`: [{ `kind`: phone | laptop | receipt | money | bag | food | coffee | box | chart | clock | calendar | letter | store | car | plant | whiteboard | cake | chat, `at`, `label`, `screen` (for phone/laptop: a `screen` lens ui list, rendered small) }].
  `insert`: for shot "insert"/"close": the object filling the frame, e.g. { "kind": "phone", "screen": [...] } or { "kind": "chat", "messages": [{ "from": "deniz", "text": "...", "time": "Pzt" }] }.
  `split`: for shot "split": 2–4 small panels, each a mini moment `{ people, props, label }`.
  `highlight`: cast id or prop index to carry the accent.
- **flow** — zukai diagram (business) or system diagram (code dialect).
  `actors`: [{ `id`, `kind`: person | group | company | app | store | bank | payment | truck | warehouse | doc | phone | server | db | queue | fn | browser | cloud, `label`, `sub`, `at`: [col,row] (grid up to 4×3), `members` (names, for group), `state`: "before" | "after" }].
  `flows`: [{ `from`, `to`, `type`: money | goods | info | link | request | response | event | data, `label`, `value`, `new` (true → accent), `state`: before | after, `code`, `calls`, `inferred` }].
  `continue`: true → keep the previous flow frame's actors/flows and only animate what this frame adds (build-up across frames).
  `compare`: true → before/after toggle (core shows the chip, calls render again with `ctx.state`).
  `focus`: [actor ids]. Code proof marks (✓ verified / ? inferred / ! broken) come from `flow.proof` injected by the build (same rules as chalk-talk 0.2).
- **number** — `big` ("1.240 ₺" / "%31"), `label`, `sub`, `viz`: { `kind`: bars | dots | line | donut | icons, `data`: [{ `label`, `value`, `accent` }], `unit` }, optional `who` (cast id: small head for the concrete trace).
- **whatif** — `headline`, `vars`: [{ `id`, `label`, `min`, `max`, `step`, `value`, `unit` }], `outputs`: [{ `label`, `expr` ("friends * 310 * unpaid / 100"), `format`: "₺" | "%" | "n" | "x" }], optional `viz`. Expressions: + − × / ( ) numbers and var ids only (write a tiny parser; never `eval`).
- **compare** — `left` / `right`: { `label`, `tone`: "muted" | "accent", `lines` (≤3 short), `art` (optional mini moment or icon kind) }. Or `before` / `after` moments.
- **screen** — `device`: phone | laptop, `ui`: [{ `type`: header | text | amount | button | list | avatars | toast | input | progress | check | image | divider, `text`, `items`, `accent` }], `annotate`: [{ `at` (ui index), `text` }]. Must look like a real, tasteful app screen in ink on paper (not a gray wireframe).
- **timeline** — `items`: [{ `when`, `what`, `accent` }] (≤6).

## ctx contract (core provides, lenses use)
```js
chalk.lens('moment', { render(frame, ctx) { /* draw into ctx.stage */ } });
ctx = {
  W, H, aspect,            // 1600×900 'wide' or 900×1400 'tall'; render natively for both
  stage,                   // <g> to draw into (SVG, viewBox 0 0 W H)
  html,                    // absolutely-positioned HTML layer over the stage (for sliders/inputs), same coordinate box
  story, frame, index, prev, // prev = previous frame object (for continue)
  state,                   // 'after' (default) | 'before' when the compare toggle is set
  t: tokens,               // { paper, paper2, ink, ink2, muted, line, accent, accentSoft, ok, warn, error }
  f: fonts,                // { serif, sans, mono, hand }
  el(tag, attrs, parent),  // SVG element helper
  text(parent, str, x, y, { size, font, weight, anchor, maxW, lines, color, italic }), // wraps, returns {el, w, h}
  rich(parent, str, x, y, opts),   // same but parses **bold**, *accent em*, `code`
  rough(el, level),        // apply the shared seeded wobble filter (0..2)
  rand(seed),              // deterministic PRNG
  cast(id),                // cast member { id, name, look, hero }
  beat(el, kind, { at, dur, from, to, dx, dy }), // kinds: fade | pop | draw | grow | fly | count | type | flip; returns the Animation
  anim(el, keyframes, opts),       // raw WAAPI, registered for seek
  issue(level, msg),       // report layout problems ('error' | 'warn')
  icon(parent, name, x, y, size),  // shared ink icon set (core ships ~40: person, group, store, bank, card, money, phone, laptop, server, db, queue, doc, truck, box, clock, check, cross, link, chat, mail, key, lock, gear, chart, star, heart, bolt, globe, home, cart, bag, food, coffee, car, calendar, flag, search, eye, warn, sparkle)
}
```
Core owns: caption bar, kicker, stamps, progress, controls, toggle chip, keyboard/swipe, present mode (`?present` or `F`: bigger type, speaker notes with `N`), autoplay (`P`, `?play`, `?play=loop`), deep links `#N`, theme `?theme=night`, aspect switch on resize (re-render), `?aspect=tall|wide` override, reduced motion, `?snap` still frames, and `window.chalk = { ready, steps(), duration(k), seek(k, ms), go(k), report }` (steps 1-based, same contract as chalk-talk 0.2 so record works).

## Definition of done for every lens
Renders every field above in wide and tall, in paper and night; looks as good as (or better than) the matching explore prototype; reports overflow via `ctx.issue`; all motion seekable; tested with `examples/hesabi-bol.story.json` and its own small test stories in `skills/frames/.scratch/` (gitignored).
