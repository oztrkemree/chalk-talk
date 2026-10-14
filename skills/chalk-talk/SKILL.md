---
name: chalk-talk
description: >-
  Explains how a system, code path, architecture, protocol or concept works as a step-by-step
  animated isometric diorama: one self-contained HTML page (light or dark) where services,
  databases, queues and people appear as little 3D toy blocks on a floor grid, named data
  packets hop along the paths between them, earlier parts fade back and a short caption says
  what happens and why. Use it whenever someone asks
  "how does X work", "walk me through", "what happens when...", "explain this flow /
  architecture / pipeline / lifecycle / handshake", "draw / visualize / diagram how ...",
  "bu sistem nasıl çalışıyor", "akışı anlat / göster", "görsel anlat", "çizerek anlat", or wants
  to onboard someone onto a part of a codebase, even if they never say "diagram". Not for data
  charts, UI mockups or a single static illustration.
argument-hint: "[what to explain, e.g. 'the checkout flow' or 'how auth works in this repo']"
license: MIT
---

# Chalk Talk

A good explanation is someone at a whiteboard: one thing at a time, pointing at what matters,
and at the end the whole picture is on the board. This skill makes that page as a small
isometric diorama: every part of the system is a toy block standing on a floor grid (a server
block, a database cylinder, a queue with messages on top, a laptop, a phone, a cloud, a little
person), arrows are paths on the floor, labels float above the blocks. You write the **story**
as a small scene file; the engine does all the drawing: 3D objects, layout, path routing,
label placement, animation, collision checks.

You never write SVG, CSS or coordinates. If something looks wrong, change the scene.

## Steps

1. **Find the real story.** Decide which single journey to tell ("a user logs in", "a push
   becomes a deploy", "a message reaches the other phone"), not the whole system. If there is
   code, read it: the entry point, the calls in the order they happen, where data is written,
   what comes back, where it can fail. Collect the real names (services, files, endpoints,
   tables, events, queues). Never invent a name or a number; if you don't know it, leave it out.
   Note the **file and line range** behind each part as you read (`src/auth/login.ts:12-40`):
   it becomes the node's `code`, and the viewer can click the block to see that code.
   No code involved (a protocol, a concept)? Use the real, well-known names (`ns1.google.com`,
   `SYN`, `ClientHello`); an example value is fine when it reads as one (`8.8.8.8`), made-up
   statistics are not. If the request is too vague to pick a journey, pick the most common one
   and say which.

2. **Storyboard.** 4–8 steps, each one making **one** point:
   - **First step**, the hook: who starts it and with what. 2–3 things on the board, nothing more.
   - **Middle steps**: one movement each. Something new appears *and* something moves.
   - **Last step**: `"recap": true`, replaying the main path with numbered arrows.
   Each step gets a `title` (2–5 words) and a `say` caption: 1–2 short sentences (under ~25
   words) about what happens **and why it matters**. "The API never stores your password, only a
   hash, so a leaked table is not a leaked password" teaches; "an arrow goes from API to DB" doesn't.

3. **Pick the layout, then place things.**
   - **Map** (default): parts of a system and how data moves between them. Every node gets
     `"at": [col, row]`.
   - **Sequence** (`"layout": "sequence"`): a conversation between a few parties where the
     *order of messages* is the point: handshakes, OAuth, webhooks with retries, a request
     bouncing through services. Participants stand in a row (array order, or `at[0]`), each
     edge is one message one row lower, in the order the steps first use them. A message from
     a node to itself draws a small loop ("check signature"). No rows, no groups.

   For a map, think of `[col, row]` as floor tiles. On screen, columns run down-right and
   rows run down-left, so the main path along one row reads as a diagonal from top-left to
   bottom-right. Put the main path on one row (people and clients at column 0, then services,
   then storage), and put side systems on the neighboring rows: a third party one row up
   (row 0), a database one row down. Paths run only along the floor axes, so nodes in the same
   row or column connect with a straight path and everything else with one or two turns.
   Don't put a node between two connected nodes on the same row or column.
   **Keep it compact: at most 4 columns and 3 rows (about 8 nodes).** The isometric board
   loses room fast; the engine shrinks blocks a little when it gets tight and warns when it
   is too tight. A bigger system becomes several talks, or uses `"style": "studio"` (a flat
   card layout that fits more).

4. **Write the scene** to `<out>/<slug>.scene.json` (format below, full spec in
   [references/scene-spec.md](references/scene-spec.md)). Default `<out>` is `./chalk-talks/`
   in the current project unless the user names a place.

5. **Build and check.**
   ```bash
   <skill-dir>/scripts/build.sh <out>/<slug>.scene.json      # writes <out>/<slug>.html
   <skill-dir>/scripts/check.sh <out>/<slug>.html            # report + one PNG per step
   ```
   `check.sh` prints the engine's layout report and saves `<slug>-snaps/step-N.png` next to the
   HTML, with problems boxed in red. Fix every **ERROR** by editing the scene (move a node to
   another cell, shorten a label, split a step), rebuild, recheck. Treat warnings as advice.
   Still frames leave out a packet that has no clean spot beside its arrow; the live page
   still animates it. Then open 2–3 PNGs (the first, the busiest, the recap) and look as a
   newcomer would: is the point of each step obvious in three seconds? At most 3 rounds.
   If no Chrome is available, `check.sh` says so; open the HTML in any browser tool you have
   and read `window.chalk.report`, or skip the visual check and say you did.

6. **Deliver.** Open the HTML for the user (`open <file>` on macOS, `xdg-open` on Linux, or
   your file/browser tool). Reply in 2–4 lines: what journey it explains, how many steps, the
   blocks that open their code (if any),
   path, and that ←/→ or space steps through it. Don't retell the talk in chat; the page is the
   explanation. Keep the `.scene.json`: it is the editable source for follow-up changes.

## Scene format

```json
{
  "title": "How logging in works",
  "subtitle": "from the password box to a session",
  "lang": "en",
  "nodes": [
    { "id": "you",   "kind": "actor",   "label": "You", "at": [0, 1] },
    { "id": "web",   "kind": "browser", "label": "Web app", "sub": "login.tsx", "at": [1, 1] },
    { "id": "api",   "label": "Auth API", "sub": "POST /login", "icon": "key", "at": [2, 1],
      "code": "src/auth/login.ts:12-40" },
    { "id": "users", "kind": "db", "label": "Postgres", "sub": "users", "at": [3, 2] }
  ],
  "groups": [{ "id": "backend", "label": "backend", "members": ["api", "users"] }],
  "edges": [
    { "id": "req",    "from": "web", "to": "api",   "num": 1, "label": "POST /login", "packet": "email, pw" },
    { "id": "lookup", "from": "api", "to": "users", "num": 2, "label": "find user",   "packet": "SELECT" }
  ],
  "steps": [
    { "title": "The request", "say": "The web app sends both to the **Auth API**.",
      "show": ["req"], "flow": ["req"], "notes": [{ "on": "req", "text": "always over HTTPS" }] },
    { "title": "Is it you?", "say": "The API compares **hashes**, never the real password.",
      "show": ["backend", "lookup"], "flow": ["lookup", { "edge": "lookup", "reverse": true, "packet": "hash" }],
      "focus": ["api"] },
    { "title": "The whole trip", "say": "Send, check, answer.", "recap": true, "flow": ["req", "lookup"] }
  ]
}
```

How steps work: the board **builds up**. `show` adds things and they stay; showing an edge
also shows its two ends; anything named in `flow`, `focus` or `notes` appears automatically.
Things added earlier fade back so the eye lands on what's new (`"dim": false` turns that off).
`flow` sends a packet along each listed edge, one after another (`"together": true` for all at
once; `"reverse": true` for a reply on the same arrow). `focus` outlines a node or highlights an
edge. `active` keeps something at full strength without outlining it (use it when the caption
talks about an older part). `hide` removes something from that step on. Captions support
`**bold**` and `` `code` ``. Show a group in the step where its last member appears, or it
frames things that aren't there yet.

## Visual vocabulary

Every node is a small 3D object with a floating label pill above it (the label, and the
`sub` line in monospace under it). Keep meanings consistent inside one talk; the reader learns
the code in two steps.

| kind | drawn as | use it for |
|---|---|---|
| `box` (default) | a server block with slots and a status light, icon painted on top | a service, module, worker, function |
| `pill` | a smaller, flatter block | a small step inside a process, a function call |
| `db` | a striped cylinder | database, cache, bucket, any store |
| `queue` | a long low block with message cubes waiting on top | queue, topic, stream, event bus |
| `cloud` | a floating cloud | third-party or external system (Stripe, S3, an LLM API) |
| `browser` | an open laptop | web app, dashboard, any browser client |
| `phone` | a standing phone | mobile app |
| `file` | a small stack of sheets | file, config, document, artifact |
| `actor` | a little person | user, admin, on-call engineer |
| `text` | just the label | a free label |

**Colors** tint the object: `blue` clients, `green` your services, `amber` storage,
`violet` queues/async, `orange` people, `red` the hot spot or the thing that breaks, `teal`
and `stone` spares, `neutral` external. The defaults per kind already follow this; use 3–4
in a talk.

**Icons** are painted on the top of blocks, files and cylinders (`icon` overrides the kind's
default): key, lock, mail, clock, gear, bolt, check,
cross, warn, user, users, globe, window, file, search, bell, card, code, server, chat, money,
cart, refresh, star, heart, box, bot, hourglass, shield, cloud, eye, phone, db, queue, sparkle,
trash, flag.

**Paths** (edges): solid = a call that waits for an answer; `"style": "dashed"` = async, event,
fire-and-forget or optional; `"tone": "error"` = the failure path, `"ok"` = the happy answer.
The label is a verb or the thing sent ("POST /orders", "publishes OrderPlaced"). Put `num`
only on the main path, in order. **Packets** name what travels ("JWT", "order #42",
"SELECT ..."): this is what makes a flow click, so name them on every main-path edge.

**Notes** are short annotations with a thin leader line: under ~6 words (~40 characters), at
most 2 per step, and only things the caption doesn't say (a gotcha, a limit, the why).
`"kind": "tag"` makes a small status badge on the node's label pill instead (`"tone": "warn"`
for limits, `"error"` for failure, `"info"`, `"ok"`).

**Code**: when the talk is about code, give every node (and any arrow that is one specific
call) a `code` field pointing at the real lines: `"path:start-end"`, a path relative to where
you run `build.sh` (or to `"root"` in the scene). `build.sh` embeds those lines; the block gets
a small `</>` badge, and a click (or `C`) slides in a panel with the code, the marked lines, a
GitHub permalink inside a GitHub checkout, and an "open in editor" link on the author's machine.
Keep ranges tight (the function, not the file; under ~60 lines) and use
`{ "file": "...", "lines": [12, 40], "mark": [18, 22] }` to highlight the lines that matter.
Only reference lines you actually read. `CHALK_SHARE=1 build.sh ...` leaves local paths out
of a page that will be sent to other people.

**Theme**: the page follows the viewer's light/dark setting and `T` flips it. `"theme": "dark"`
or `"light"` in the scene picks the starting look (use it when the user asks for one).

**Styles**: the isometric look is the default (`"style": "iso"`). For systems too big for the
isometric board there are flat card styles: `"studio"` (product docs), `"blueprint"`
(engineering drawing) and `"editorial"` (newspaper explainer). Use iso unless the diagram
doesn't fit or the user asks for a flat look.

## What makes a talk good

- **One claim per step.** If a caption needs "and then", it's two steps.
- **Introduce each thing when it matters,** not all in step one. The empty board is a feature.
- **Real names, human labels.** `label` is how a person says it ("Auth API"); `sub` carries
  the real identifier (`auth/login.ts`, `POST /login`, `orders` table).
- **Show the why.** The caption explains consequences: what this design buys, what breaks
  without it, what's surprising.
- **Failure paths only when they are the point.** A dashed red arrow with an error packet
  in its own step beats squeezing errors into every step.
- **Language:** captions, labels and notes in the user's language; code identifiers as they are.
- **Size:** 4–8 steps, up to ~10 nodes. A bigger system gets several talks, one per journey;
  say so and offer the next one.

## Avoid

- Everything on the board in step one, then captions walking over a finished picture.
- Captions that describe the drawing instead of the meaning.
- Generic boxes ("Frontend", "Backend", "DB") when the code has real names.
- Unlabeled arrows on the main path; numbers on side paths.
- Colors that mean nothing; more than one focus per step.
- Editing `template.html` or hand-writing SVG for one talk. If the engine can't express
  something, use a note or split the step; mention the gap to the user.

## Viewer controls (tell the user once if useful)

← / → or space step through, `P` autoplays, `T` flips light / dark, `C` shows the code behind
the current step (or click a block with a `</>` badge), `1`–`9` jump, `#3` in the
URL opens step 3, swipe works on phones. `?theme=dark` forces dark, `?style=studio` previews
the flat style, `?snap` renders a still frame (used by `check.sh`, which also takes
`CHALK_THEME=dark` and `CHALK_STYLE=studio`).
