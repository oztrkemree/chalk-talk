---
name: frames
description: >-
  Turns anything someone needs to explain into a 60–120 second story in one HTML file: frame by
  frame, one idea per frame, drawn in a calm hand-made ink style, that plays by itself when
  forwarded, can be presented live and works on a phone. Use it when someone wants to explain,
  pitch or present something to other people: a product or feature idea, a PRD, a Slack thread or
  meeting notes, a strategy or business model, a launch, an incident, a decision that needs
  approval, a lesson or concept, how a piece of code works ("explain this to my team",
  "make this a story", "pitch this to my VP", "turn these notes into something people will
  actually read", "storyboard this feature", "bunu yöneticime anlat", "sunum yap", "hikâyeleştir").
  Not for data dashboards, long documents or editing slides in PowerPoint/Keynote.
argument-hint: "[what to explain and to whom, e.g. 'pitch the split-bill feature to my VP' or a file/thread to turn into a story]"
license: MIT
---

# Frames

People don't read decks, PRDs or long messages. They watch a good story told one beat at a time.
This skill turns what the user gives you into that story: **frames**, each making one point with
the visual **lens** that fits its question, in one calm language (paper, ink, one accent color).
You write a small story file; the engine draws, lays out, animates, and adapts it to a phone.

You never draw, write SVG, CSS or coordinates. If something looks wrong, change the story.

## Steps

1. **Understand the job.** Who is the audience (VP, team, investors, customers, students)? What
   should they think or do at the end (approve, understand, choose, remember)? If the user gave
   material (a PRD, notes, a thread, a doc, a repo), read all of it first. If a fact or number is
   missing, don't invent it: leave it out, ask, or use an example value with `"stamp": "örnek veri"`
   / `"example data"`. One question to the user is fine if the audience or the ask is unclear;
   otherwise pick the most likely and say so.

2. **Find the spine** (7–10 frames, 60–120 seconds):
   - **Frame 1 is the answer** (`title`, kind `open`): the claim in ≤8 words. People decide in
     seconds; give them the conclusion first (BLUF), then earn it.
   - **Then the human moment** (`moment`): the person who has the problem, in a concrete scene.
     Concrete before abstract.
   - **Then why it matters** (`number`, maybe `whatif`): one figure, sized and honest.
   - **Then the change** (`screen`, `flow`, `compare`): what we do, how it works, what's different.
   - **End with the ask** (`title`, kind `ask`): what you need, from whom, by when.
   Adapt the spine to the job: a lesson ends with the takeaway, an incident review with the fix and
   the follow-ups, a code walkthrough with the whole trip.

3. **Pick a lens per frame by its question.**

   | the frame answers | lens | e.g. |
   |---|---|---|
   | the claim, the ask, a section | `title` | "Ödeyen kişi *cezalandırılmasın.*" |
   | who, when, what they live through | `moment` | Deniz pays and chases friends for a week |
   | how it works, where money/goods/data flow | `flow` | table → payment provider → restaurant |
   | how much | `number` | %31 of orders, with one bar chart |
   | what if | `whatif` | sliders: group size × unpaid share → money lost |
   | what changes, before vs after | `compare` | Today / With split bill |
   | what it looks like | `screen` | the checkout screen with the new button |
   | when | `timeline` | 6-week plan |
   | how code works | `flow` with tech actors + `code`/`calls` | request → API → DB, every arrow proven |

   Rules: one idea per frame; no two frames in a row with the same lens unless they build one
   picture (`flow` with `"continue": true`); at most one `whatif`; the accent marks only the one
   new or important thing in each frame.

4. **Write captions like subtitles.** ≤20 words, what happens **and why it matters**. `**bold**`
   for the key phrase, `*em*` for an accent word. Kickers are 1–3 words ("SORUN", "ÇÖZÜM",
   "ETKİ"). Write in the user's language.

5. **Write the story** to `<out>/<slug>.story.json` (default `./frames/` in the current project).
   Full format: [SPEC.md](SPEC.md). Put the speaker's extra context in `notes` (present mode only).

6. **Build and check.**
   ```bash
   node <skill-dir>/scripts/build.mjs <out>/<slug>.story.json    # validates, writes <out>/<slug>.html
   node <skill-dir>/scripts/check.mjs <out>/<slug>.html          # report + PNG per frame, wide and tall
   ```
   Fix every error the build or check prints by editing the story. Then open 3 PNGs (the first, the
   busiest, a tall one) and look as the audience would: is each frame's point obvious in three
   seconds? Is anything invented? At most 3 rounds.

7. **Deliver.** Open the HTML. Reply in 2–4 lines: the story in one sentence, frame count and
   length, and how to use it: ←/→ or tap to step, `P` plays it, `F` presents with notes (`N`),
   send the file as is (it works offline, on a phone). For a social post or a PR description:
   `node <skill-dir>/scripts/record.mjs <file>.html --aspect tall` writes a vertical GIF.

## Cast

Stories with people get a small fixed cast (2–4) in `cast`, one of them `"hero": true` (drawn in
the accent). Give them real-feeling names that fit the audience and language, and a `look`
(`hair`, `top`, `glasses`) so they stay recognizable across frames. Reuse the same people; don't
introduce someone new in the last frames.

## Code

When the story is about code, `flow` frames use tech actors (`browser`, `server`, `db`, `queue`,
`fn`, `cloud`) and every flow on the main path cites the line it happens on (`code`) and the call
that proves it (`calls`); a hop you can't pin to a line gets `"inferred": "<why>"`. The build checks
each one and the page marks it ✓ / ? / !. Never guess a line to make an arrow look proven.

## Avoid

- Text walls: if a caption needs two sentences, it's two frames.
- Starting with background or agenda. Start with the answer.
- Invented numbers, quotes, names or results. Example values are stamped.
- More than one accent thing per frame; decoration that teaches nothing.
- Explaining the drawing ("here we see a box") instead of the meaning.
