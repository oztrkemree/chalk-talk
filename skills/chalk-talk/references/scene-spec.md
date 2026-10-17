# Scene file reference

A scene is one JSON object. `scripts/build.mjs` puts it into `assets/template.html` and writes a
single HTML file (no other files; the fonts load from Google Fonts). Everything below is
optional except `nodes` and `steps`. A literal `</script` inside any string would end the
page's script tag early; write it as `<\/script` (valid JSON, same text).

## Contents

1. [Top level](#top-level)
2. [Nodes](#nodes)
3. [Edges](#edges)
4. [Code](#code)
5. [Proof](#proof)
6. [Change mode](#change-mode)
7. [Groups](#groups)
8. [Steps](#steps)
9. [Notes and tags](#notes-and-tags)
10. [Sequence layout](#sequence-layout)
11. [Styles](#styles)
12. [Layout rules the engine applies](#layout-rules-the-engine-applies)
13. [Viewer controls and URL options](#viewer-controls-and-url-options)
14. [Recording API](#recording-api)
15. [Report messages and how to fix them](#report-messages-and-how-to-fix-them)

## Top level

| field | type | default | what it does |
|---|---|---|---|
| `title` | string | none | Large title, top-left. Also the page title. |
| `subtitle` | string | none | One line under the title. |
| `eyebrow` | string | "How it works" in `lang` | Small accent line above the title. `""` hides it. |
| `lang` | string | `"en"` | `<html lang>` and the default eyebrow; set it to the caption language (`"tr"`, `"de"`, ...). |
| `layout` | `"map"` \| `"sequence"` | `"map"` | Map: nodes on a grid. Sequence: participants in a row with lifelines, edges as messages going down. |
| `style` | `"iso"` \| `"chalk"` \| `"studio"` \| `"blueprint"` \| `"editorial"` | `"iso"` | Visual style, see [Styles](#styles). |
| `theme` | `"auto"` \| `"light"` \| `"dark"` | `"auto"` | Starting theme. Auto follows the viewer's OS (blueprint starts dark). The viewer flips it with `T`. |
| `spacing` | number | `1` | Multiplies the gaps between grid tracks. `0.8` tighter, `1.3` airier. |
| `root` | string | none | Directory that node and edge `code` paths are relative to, itself relative to the scene file. Default: where the build runs, then the scene's folder. |
| `editor` | `"vscode"` \| `"cursor"` \| `"zed"` \| `"idea"` \| `"none"` | `"vscode"` | Which editor the code panel's "open" link targets. Shown only when the page is opened from the author's disk. |
| `camera` | boolean | `true` | Early steps with few things get a gentle zoom (max 1.3x) that eases out as the board fills. |
| `center` | boolean | `true` | Centers the drawing in the board area. |
| `proof` | boolean | `true` when any node or edge has `code` (or an edge has `inferred`) | `false` hides all proof UI (marks, proof view, summary line). See [Proof](#proof). |
| `diff` | object | none | Turns on [change mode](#change-mode): `{ "title": "PR #123 · Add retry queue", "base": "main", "head": "feat/x", "url": "https://github.com/..." }`. Only `title` is needed. |
| `nodes`, `edges`, `groups`, `steps` | arrays | | See below. |

## Nodes

```json
{ "id": "api", "kind": "box", "label": "Auth API", "sub": "auth/login.ts", "icon": "key", "color": "green", "at": [2, 1] }
```

In the default `iso` style every node is a small 3D object standing on the floor with a label
pill floating above it (see the table in SKILL.md). In the flat styles every node except
`actor` and `text` is a card: a colored icon tile on the left, the label, and the `sub` line
under it in monospace.

| field | type | default | what it does |
|---|---|---|---|
| `id` | string | `n1`, `n2`... | Referenced by edges, groups and steps. Short and readable. |
| `kind` | string | `"box"` | `box`, `pill`, `db`, `queue`, `cloud`, `actor`, `browser`, `phone`, `file`, `text`. Aliases: `service`/`server` → box, `process`/`function` → pill, `database`/`storage`/`cache` → db, `topic`/`stream` → queue, `external`/`internet` → cloud, `user`/`person` → actor, `client`/`web` → browser, `mobile`/`app` → phone, `doc` → file. `cloud` cards get a dashed border (outside your system); `pill` cards are fully rounded; `actor` is a round avatar with the label below. |
| `label` | string | | Main text. Wraps to balanced lines (at most ~190px in iso, ~230px in the flat styles); `\n` forces a break. Keep under ~28 characters. |
| `sub` | string | | Monospace line under the label: the real identifier (file, endpoint, table, topic). |
| `at` | `[col, row]` | appended to row 0 | Grid position. Integers are cells; fractions (`[1.5, 0]`) sit between cells. |
| `nudge` | `[dx, dy]` | `[0, 0]` | Pixel nudge after layout. Last resort. |
| `color` | string | by kind | Tints the object (iso) or the icon tile (flat styles): `blue`, `green`, `amber`, `violet`, `orange`, `red`, `teal`, `stone`, `neutral` (or the older `sky`, `mint`, `butter`, `lilac`, `peach`, `rose`, `sage`, `sand`, `white`). Defaults: box/pill green, db amber, queue violet, cloud and file neutral, actor orange, browser/phone blue. |
| `icon` | string | by kind | Icon painted on top of the object (iso: box, pill, db, file, cloud) or in the tile (flat styles). Defaults: box cube, pill code, db db, queue queue, cloud cloud, actor user, browser window, phone phone, file file. Full list in SKILL.md. |
| `maxWidth` | number | 230 (190 for actor) | Wrap width for the label. |
| `code` | string or object | | The real code behind this node, see [Code](#code). Adds a `</>` badge; a click shows the code. |
| `change` | `"added"` \| `"changed"` \| `"removed"` | | What a PR / branch does to this node, see [Change mode](#change-mode). |
| `width`, `height` | number | measured | Force a size. Rarely needed. |

## Edges

```json
{ "id": "req", "from": "web", "to": "api", "label": "POST /login", "num": 1, "packet": "email, pw" }
```

| field | type | default | what it does |
|---|---|---|---|
| `id` | string | `e1`, `e2`... | Referenced by steps. |
| `from`, `to` | node id | required | Arrow direction. Self-loops only in the sequence layout; in a map use a note. |
| `label` | string | | Verb or payload. Sits on the longest straight stretch of the arrow (with a background knockout), or beside it when the stretch is short. |
| `num` | number | | Small numbered badge before the label. Main path only, in order. |
| `packet` | string | | Default text of the packet that travels this edge in `flow`. No packet text → a small dot. |
| `style` | `"solid"` \| `"dashed"` | `"solid"` | Dashed = async / event / optional. Dashed edges fade in instead of drawing on. |
| `tone` | string | `"ink"` | `ink`, `muted`, `accent`, `ok`, `error`, `warn`, `info`. Colors the line, head and (if not ink) the packet. |
| `both` | boolean | `false` | Arrowheads on both ends. |
| `arrow` | boolean | `true` | `false` draws a plain line (an association, not a flow). |
| `code` | string or object | | The call site behind this arrow, same forms as node `code`, see [Code](#code) and [Proof](#proof). A click on its label shows it. |
| `calls` | string or array | | Literal text that must appear inside the cited lines and proves the hop: `"db.query("`, `"res.send("`, `"publish('order.placed'"`. Whitespace runs are ignored when matching. The build marks the edge `verified` when every string is found. |
| `inferred` | string | | The honest reason a hop can't be pinned to a line: `"network boundary: browser fetch()"`, `"framework routes POST /orders here"`, `"user action"`. Shown as `?`. Use it instead of a `calls` you can't back up. |
| `change` | `"added"` \| `"changed"` \| `"removed"` | | What a PR / branch does to this arrow, see [Change mode](#change-mode). |

Arrows are orthogonal: in iso they are paths on the floor that run along the two floor axes,
with arrowheads lying flat; in the flat styles they leave and enter a card through the middle
of a side and run only horizontally or vertically, with rounded corners. The engine picks, per edge, a straight line
(cards share a row or column), an L with one turn, or a Z with two, skipping any shape that
would cut through another card. Ends that share a side of a card are spread out, so a request
and its reply run in parallel lanes instead of on top of each other.

## Code

```json
"code": "src/auth/login.ts:12-40"
"code": "src/auth/login.ts:18"
"code": { "file": "src/auth/login.ts", "lines": [12, 40], "mark": [18, 22] }
```

The build script reads the lines and embeds them, so the page stays one file. A
single line shows that line and the 24 after it, marked; a bare path shows the top 40 lines;
at most 120 lines are kept. Paths resolve against `root`, then the directory the build runs
in, then the scene's folder. Inside a GitHub checkout the panel also links to the exact lines
at the current commit. The absolute path is stored for the "open in editor" link unless the
page is built with `CHALK_SHARE=1`.

In the page, a node with code gets a `</>` badge on its label; a click (or `C`, which picks the
step's focus, then the edges it flows, then what it adds) slides in the panel. `Esc` or a click
on the board closes it. A file that was missing at build time is reported as a warning.

## Proof

Every arrow tells the viewer how much to trust it. Give each main-path edge the `code` that
makes the hop and the `calls` text that proves it; mark the hops you can't pin to a line with
`inferred` and a reason. Never invent a `calls` string: the build checks it.

```json
{ "id": "insert", "from": "api", "to": "db", "label": "INSERT order",
  "code": "src/orders.js:5-13", "calls": "db.query(" }
{ "id": "req", "from": "web", "to": "api", "label": "POST /orders",
  "inferred": "network boundary: fetch() in the browser bundle" }
```

The build verifies each edge and writes `proof: { status, file, start, end, hit, why }` into
it, plus `proofSummary: { total, verified, cited, inferred, unproven, broken }` for the scene
(counted over the edges used in any step's `flow`, else all edges):

| status | when | mark on the label |
|---|---|---|
| `verified` | code cited, lines exist, every `calls` string found (`hit` = line of the first match) | small check, ok tone |
| `cited` | code cited, lines exist, no `calls` given | small check, ok tone |
| `inferred` | the edge has `inferred` (`why` = the reason, shown as the tooltip) | `?`, warn tone |
| `unproven` | no code, no `inferred` | none (a muted `?` on the path in proof view) |
| `broken` | the file or range is missing, or a `calls` string isn't there (`why` says which) | `!`, error tone; the build warns and the report has an **error** |

A scene loaded without the build falls back to: has `code` → `cited`, has `inferred` →
`inferred`, else `unproven`. With proof on, an edge label's mark replaces its `</>` badge; a
click on the label opens the code panel with the cited lines, the `mark` lines and the `hit`
line highlighted, and the proof status under the file name. Hovering a mark shows the same
status as a tooltip.

**Proof view** (`V`, or the shield button): verified and cited arrows turn solid, inferred and
unproven ones dotted with a `?` on the path, broken ones red; nothing is faded, and a legend
chip appears top right ("PROOF ✓ 5 traced ? 1 inferred ? 1 unproven"). The recap step, and
any step in proof view, add a summary line under the caption: "6 of 7 hops traced to code · 1
inferred". The same counts are in `window.chalk.report.proof`.

## Change mode

For "explain this PR / branch / diff": tell the journey as it is **after** the change, and mark
what the change touched.

```json
"diff": { "title": "PR #123 · Add retry queue", "base": "main", "head": "feat/retry-queue" },
"nodes": [ { "id": "q", "kind": "queue", "label": "Retry queue", "at": [2, 0], "change": "added" } ],
"edges": [ { "id": "direct", "from": "api", "to": "mailer", "label": "send mail", "change": "removed" } ]
```

| `change` | drawn as |
|---|---|
| `added` | green ring (a glowing ring on the floor in iso, a soft outline around the card in the flat styles) and a small `NEW` tag on the label; an added arrow gets a soft green band under it and the tag inside its label |
| `changed` | the same in amber, tag `CHANGED` |
| `removed` | a red ghost: faded (and gray in iso), dashed red ring or dashed red arrow, tag `REMOVED` |

A chip top right sums it up: `PR #123 · Add retry queue  +2 ~1 −1 | AFTER` (counts nodes and
edges; without `diff` it says "Changes"). `D` (or the ± button, or a click on the chip) flips
between **after** (default: removed things stay as faint ghosts, so the reader sees what went
away) and **before** (added things and anything attached to them are hidden, removed things are
drawn normally; their tags stay). Tags follow `lang` (`tr`: YENİ, DEĞİŞTİ, SİLİNDİ). Point
`code` at the head revision.

## Groups

```json
{ "id": "backend", "label": "backend", "members": ["api", "users", "sessions"] }
```

In iso, a thin platform on the floor under its members, with a small uppercase name tag just
outside it. In the flat styles, a dashed rounded boundary with a faint fill and a label
top-left. Members should be neighbors on the grid; a group that ends up covering a non-member
is reported. Groups appear when listed in a step's `show` (or in recap) and never dim.

## Steps

```json
{
  "title": "Is it really you?",
  "say": "The API compares **password hashes**. The real password is never stored.",
  "show": ["backend", "lookup"],
  "flow": ["lookup", { "edge": "lookup", "reverse": true, "packet": "hash" }],
  "focus": ["api"],
  "notes": [{ "on": "api", "text": "bcrypt compare", "side": "bottom" }]
}
```

| field | type | what it does |
|---|---|---|
| `title` | string | Short heading in the caption bar (2–5 words). |
| `say` | string | The narration: 1–2 sentences. `**bold**` is emphasized, `` `code` `` becomes a code chip. |
| `show` | ids | Adds nodes, edges or groups. They stay for later steps. Showing an edge also shows both ends. |
| `hide` | ids | Removes things from this step on. |
| `flow` | edge ids or objects | Packets travel these edges, in order, looping while the step is open. Object form: `{ "edge": "id", "packet": "text", "reverse": true, "tone": "ok" }`. |
| `together` | boolean | Run all flows of the step at the same time instead of one after another. |
| `focus` | ids | Accent outline with a soft halo around a node or group; an edge turns accent and thicker. |
| `active` | ids | Keep these at full strength without outlining them (they'd otherwise fade as "old"). |
| `notes` | array | See below. |
| `recap` | boolean | Shows everything, fades nothing. Use for the last step with the main-path `flow`. |
| `dim` | boolean | Default: earlier things fade on every step after the first, except in recap. `false` keeps all at full strength. |
| `wait` | number | Seconds this step stays during autoplay. Default: from caption length, at least one full flow. |

Anything referenced in `flow`, `focus` or `notes` is shown automatically, so a step can be just
`{ "say": "...", "flow": ["reply"] }`.

What stays bright in a step: what it added, what it focuses, the edges it flows and their
ends, note targets and `active`. Everything else visible fades to about a quarter.

## Notes and tags

```json
{ "on": "api", "text": "bcrypt compare", "side": "bottom", "tone": "accent" }
{ "on": "sessions", "kind": "tag", "text": "expires in 7 days", "tone": "warn" }
{ "at": [1.5, 2], "text": "nothing else touches this" }
```

| field | what it does |
|---|---|
| `text` | The note. Under ~6 words reads best; wraps at 250px. |
| `on` | Node, edge or group id. Notes get a thin leader line ending in a dot on the target. |
| `at` | `[col, row]` grid position for a free-standing note (no leader). |
| `side` | Notes: `top`, `bottom`, `left`, `right`, `top-right`, `top-left`, `bottom-right`, `bottom-left`. Tags: one of the four corners. If it would collide, the engine tries the others. |
| `tone` | `ink` (default), `accent`, `error`, `ok`, `warn`, `info`. Colors the note's side rule and leader, or the tag. |
| `kind` | `"note"` (default: text with a thin colored rule on its left) or `"tag"` (small uppercase status badge sitting on the target card's border; on an arrow it sits beside the label). |
| `arrow` | `false` drops the leader line. |

Notes belong to their step only. Repeat a note in a later step if it should stay.

## Sequence layout

```json
{ "layout": "sequence",
  "nodes": [ { "id": "web", "kind": "browser", "label": "Your app" }, { "id": "google", "kind": "cloud", "label": "Google" } ],
  "edges": [ { "id": "authorize", "from": "web", "to": "google", "num": 1, "label": "redirect to /authorize", "packet": "client_id" },
             { "id": "code", "from": "google", "to": "web", "num": 2, "label": "redirect back ?code=", "packet": "code" } ],
  "steps": [ { "say": "...", "flow": ["authorize"] }, { "say": "...", "flow": ["code"] } ] }
```

- **Participants** are the nodes, left to right in array order (or by `at[0]` when given). Any
  kind works; cards are aligned and each gets a dashed lifeline down the board.
- **Messages** are the edges. Each sits on its own row; the row order is the order in which the
  steps first mention the edge (`show`, `flow`, `focus`, notes), then any never-mentioned edges.
  Labels sit just above the arrow. `from` = `to` draws a small loop (to the left on the last
  participant). `style`, `tone`, `num`, `packet` and `both` work as usual.
- **About 10 messages** fit on one board (rows shrink down to the label height, then the report
  errors). Split longer exchanges into two talks or summarize repeated round trips in one message.
- Groups are not drawn. Notes, tags, focus, packets, dimming and the camera all work.

## Styles

| style | look | fonts | accent |
|---|---|---|---|
| `iso` (default) | Isometric toy blocks on a soft floor grid, with small hardware (drive bays, vents, status lights, a database lid, messages waiting on a queue); labels in floating pills, packets as glowing balls with a short trail hopping along floor paths, a glowing floor ring for focus. Light: pale blue-gray floor. Dark: night navy. Best up to 4 columns × 3 rows. | Geist, Geist Mono | coral |
| `chalk` | The same isometric board drawn on a chalkboard: slightly rough chalk lines, faces shaded by hatching instead of paint, pastel chalk colors, chalk-dot packets, handwritten labels. Light: green slate. Dark: black slate. Works with `"layout": "sequence"` too. | Caveat (titles), Patrick Hand, Geist Mono | yellow chalk |
| `studio` | Product documentation: soft rounded white cards with a gentle shadow on a light dotted canvas, tinted icon tiles, numbered black badges. Dark theme is near-black. | Geist, Geist Mono | indigo |
| `blueprint` | Engineering drawing: navy grid paper, thin light lines, outlined icon tiles, registration ticks at card corners, open arrowheads. Light theme is a white "whiteprint". Starts dark. | IBM Plex Mono, IBM Plex Sans | amber (dark) / orange (light) |
| `editorial` | Newspaper explainer: warm paper, barely rounded corners, black outlines, solid color icon tiles, serif title and italic serif notes. | Newsreader, Inter Tight, IBM Plex Mono | red |

The three flat styles share one layout, so switching between them never moves anything; iso
and chalk use the same `[col, row]` positions on their floor grid (chalk's handwriting is a little
wider, so a crowded board may place a few labels differently). `?style=` in the URL
previews another style without editing the scene; `CHALK_STYLE=` does the same for `check.mjs`.

**Micro-life (iso and chalk).** A packet landing makes its target answer: it bumps, a ring spreads on
the floor, its status light blinks, a server's bays light up, a database lid ripples (a write), a
browser or phone screen flashes, a message drops onto a queue; a packet leaving a queue takes the
head message and the rest move up. The focused block settles once and its light breathes slowly.
Nothing else moves on an idle board. All of it is driven by the step clock, so `chalk.seek(k, ms)`
draws the same frame every time; `?snap` and reduced motion show the calm still picture.

## Layout rules the engine applies

- **Iso floor.** Every grid cell is the same size; the engine picks the largest cell that fits
  the board (up to 300px × `spacing`), shrinks the objects to as little as 78% when the board is
  tight, and warns below ~165px per cell. Objects are drawn back to front so nearer blocks
  overlap farther ones naturally. Labels are screen-facing pills above each object.
- **Grid tracks are sized by content** (flat styles). A column is as wide as its widest card; the gap to the
  next column opens until every labelled arrow crossing it fits its label. Rows work the same
  with heights. Then all gaps scale together to fill the board (never above 1.45x, never below
  0.45x). When it has to squeeze hard, long labels wrap to two lines and the layout runs again.
- **The drawing is centered** in the board area under the title (1480 × 682 of the 1600 × 900 board).
- **Arrows** are orthogonal connectors (see [Edges](#edges)).
- **Edge labels** try the middle of the longest straight stretch first, then other points on the
  straight stretches, then beside them, avoiding cards, other labels and other lines.
- **Notes** try the preferred side, then the other seven, at three distances, avoiding cards,
  labels, lines, the title and each other.
- **Still frames** (`?snap`) park packets where they cover nothing; a packet with no clean spot
  is left out of the still (it still animates in the live page).

## Viewer controls and URL options

← / → / space step, `P` autoplay, `T` light / dark, `C` code of the current step, `V` proof
view, `D` before / after, `1`–`9` jump, `Esc` closes the code panel; `#3` opens step 3. URL:
`?theme=dark`, `?style=studio`, `?play` (autoplay; `?play=loop` starts over after the recap), `?proof` (start in proof view), `?diff=before`, `?snap` (still
frame), `?debug` (boxes problems in red).

## Recording API

For recorders (`scripts/record.mjs`). Steps are numbered from 1, like `#3` and `chalk.go`.

| call | returns |
|---|---|
| `await window.chalk.ready` | resolves once the page is laid out and the first step is shown |
| `chalk.steps()` | number of steps |
| `chalk.duration(k)` | ms until step k, entered from step k-1, has finished moving: entrances, notes, focus, camera and one pass of its packets (the live page then rests ~1.4 s and loops the packets) |
| `chalk.seek(k, ms)` | draws step k frozen at `ms`: every animation paused at that time, packets, camera and dimming computed from the same clock, so the same call always gives the same frame |
| `chalk.go(k)` | jumps to step k (interactive) |
| `chalk.report` | the layout report, including `proof` |

The first `seek` or `duration` call stops playback and leaves the page in this frozen mode;
reload for the interactive page. `?proof` and `?diff=before` work while recording.

## Report messages and how to fix them

`check.mjs` prints these (also in `window.chalk.report` and the `#chalk-report` JSON in the page).

| message | fix |
|---|---|
| `nodes overlap` / `nodes overlap on the floor` | Move one to a free cell, or shorten its label / move detail to `sub`. |
| `their labels collide` | Iso: two label pills or a pill and a block touch. Move one node to another cell or shorten a label. |
| `the isometric board is tight` | Use at most 4 columns and 3 rows, split the talk, or switch to `"style": "studio"`. |
| `drawing is WxH, board fits ...` | Too many columns or rows. Merge nodes, drop a column, or split the talk. |
| `node is outside the board` | Same as above; or remove a `nudge`. |
| `arrow A -> B runs through C` | Move C off the row/column between A and B, or move A or B to another cell. |
| `label ... has no free spot` | Something is crowded around that arrow. Spread the grid or drop a label on a side path. |
| `label ... does not fit beside its Npx arrow` | Shorten the label, drop the packet text, or fold a long row into an L/U shape. |
| `note ... has no free spot near X` | Give `side` a different value, shorten it, or put the point in the caption. |
| `group "g" covers non-member "n"` | Move `n` outside the group's rows/columns or add it to the group. |
| `group "g" is drawn around ... before they appear` | Show the group in the step where its last member appears (or in the recap only). |
| `step N adds K things at once` | Split the step. One point per step. |
| `N packets in one step` | Split the step; the eye follows about three moving things. |
| `caption is N chars` | Shorten `say`; move detail into a note or the next step. |
| `N nodes` / `N steps` | Above ~12 nodes or 10 steps the talk gets crowded. Split by journey. |
| `N messages do not fit on one board` | Sequence layout: split the exchange or merge round trips. |
| `self-loops need the sequence layout` | In a map, describe the internal step with a note instead. |
| `code snippet not embedded` / `code file not found` | Build with `node scripts/build.mjs` (Node 18+), from the project root (or set `root`); check the path. |
| `proof: calls "x" not found in file:a-b` (or another `proof:` error) | The cited lines don't contain that text. Re-read the code: fix the range or the `calls` string, or replace both with `inferred` and a reason. Never loosen it just to pass. |
| `unknown change` | Use `added`, `changed` or `removed`. |
| `fonts did not load in time` | The viewer was offline when checked. Not an error in the scene. |
| `unknown kind / color / icon / tone / style` | Use a value from the lists above. |
| `... does not exist` | A step names an id that isn't defined. Check spelling. |
