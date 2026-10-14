# Scene file reference

A scene is one JSON object. `scripts/build.sh` puts it into `assets/template.html` and writes a
single HTML file (no other files; the fonts load from Google Fonts). Everything below is
optional except `nodes` and `steps`. A literal `</script` inside any string would end the
page's script tag early; write it as `<\/script` (valid JSON, same text).

## Contents

1. [Top level](#top-level)
2. [Nodes](#nodes)
3. [Edges](#edges)
4. [Code](#code)
5. [Groups](#groups)
6. [Steps](#steps)
7. [Notes and tags](#notes-and-tags)
8. [Sequence layout](#sequence-layout)
9. [Styles](#styles)
10. [Layout rules the engine applies](#layout-rules-the-engine-applies)
11. [Report messages and how to fix them](#report-messages-and-how-to-fix-them)

## Top level

| field | type | default | what it does |
|---|---|---|---|
| `title` | string | none | Large title, top-left. Also the page title. |
| `subtitle` | string | none | One line under the title. |
| `eyebrow` | string | "How it works" in `lang` | Small accent line above the title. `""` hides it. |
| `lang` | string | `"en"` | `<html lang>` and the default eyebrow; set it to the caption language (`"tr"`, `"de"`, ...). |
| `layout` | `"map"` \| `"sequence"` | `"map"` | Map: nodes on a grid. Sequence: participants in a row with lifelines, edges as messages going down. |
| `style` | `"iso"` \| `"studio"` \| `"blueprint"` \| `"editorial"` | `"iso"` | Visual style, see [Styles](#styles). |
| `theme` | `"auto"` \| `"light"` \| `"dark"` | `"auto"` | Starting theme. Auto follows the viewer's OS (blueprint starts dark). The viewer flips it with `T`. |
| `spacing` | number | `1` | Multiplies the gaps between grid tracks. `0.8` tighter, `1.3` airier. |
| `root` | string | none | Directory that node and edge `code` paths are relative to, itself relative to the scene file. Default: where `build.sh` runs, then the scene's folder. |
| `editor` | `"vscode"` \| `"cursor"` \| `"zed"` \| `"idea"` \| `"none"` | `"vscode"` | Which editor the code panel's "open" link targets. Shown only when the page is opened from the author's disk. |
| `camera` | boolean | `true` | Early steps with few things get a gentle zoom (max 1.3x) that eases out as the board fills. |
| `center` | boolean | `true` | Centers the drawing in the board area. |
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
| `code` | string or object | | The call site behind this arrow, see [Code](#code). A click on its label shows it. |

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

`build.sh` reads the lines (with python3) and embeds them, so the page stays one file. A
single line shows that line and the 24 after it, marked; a bare path shows the top 40 lines;
at most 120 lines are kept. Paths resolve against `root`, then the directory `build.sh` runs
in, then the scene's folder. Inside a GitHub checkout the panel also links to the exact lines
at the current commit. The absolute path is stored for the "open in editor" link unless the
page is built with `CHALK_SHARE=1`.

In the page, a node with code gets a `</>` badge on its label; a click (or `C`, which picks the
step's focus, then the edges it flows, then what it adds) slides in the panel. `Esc` or a click
on the board closes it. A file that was missing at build time is reported as a warning.

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
| `iso` (default) | Isometric toy blocks on a soft floor grid; labels in floating pills, packets as balls hopping along floor paths, a glowing floor ring for focus. Light: pale blue-gray floor. Dark: night navy. Best up to 4 columns × 3 rows. | Geist, Geist Mono | coral |
| `studio` | Product documentation: soft rounded white cards with a gentle shadow on a light dotted canvas, tinted icon tiles, numbered black badges. Dark theme is near-black. | Geist, Geist Mono | indigo |
| `blueprint` | Engineering drawing: navy grid paper, thin light lines, outlined icon tiles, registration ticks at card corners, open arrowheads. Light theme is a white "whiteprint". Starts dark. | IBM Plex Mono, IBM Plex Sans | amber (dark) / orange (light) |
| `editorial` | Newspaper explainer: warm paper, barely rounded corners, black outlines, solid color icon tiles, serif title and italic serif notes. | Newsreader, Inter Tight, IBM Plex Mono | red |

The three flat styles share one layout, so switching between them never moves anything; iso
uses the same `[col, row]` positions on its floor grid. `?style=` in the URL
previews another style without editing the scene; `CHALK_STYLE=` does the same for `check.sh`.

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

## Report messages and how to fix them

`check.sh` prints these (also in `window.chalk.report` and the `#chalk-report` JSON in the page).

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
| `code snippet not embedded` / `code file not found` | Build with `scripts/build.sh` on a machine with python3, from the project root (or set `root`); check the path. |
| `fonts did not load in time` | The viewer was offline when checked. Not an error in the scene. |
| `unknown kind / color / icon / tone / style` | Use a value from the lists above. |
| `... does not exist` | A step names an id that isn't defined. Check spelling. |
