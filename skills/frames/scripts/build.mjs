#!/usr/bin/env node
// Build a chalk-talk frames story: check the story, then inline the engine and the story into one HTML file.
//
//   node build.mjs path/to/name.story.json [out.html]
//
// Default output: the story path with ".story.json" (or ".json") replaced by ".html".
// Errors (unknown lens, missing fields, broken references, bad whatif expressions) stop the build;
// warnings and hints are printed and the page is still written. Rules: ../SPEC.md.
//
// Code dialect of `flow`: an actor or a flow can point at real code, the snippet gets embedded:
//   "code": "src/auth/login.ts:12-40"      lines 12..40
//   "code": "src/auth/login.ts:18"         from line 18, that line marked
//   "code": "src/auth/login.ts"            the top of the file
//   "code": { "file": "...", "lines": [12, 40], "mark": [18, 22] }
// Paths resolve against the story's "root" (relative to the story file), else the current
// directory, else the story's directory. Inside a GitHub checkout a permalink is added.
// CHALK_SHARE=1 leaves local absolute paths out (for pages sent to other people).
// Proof: every flow gets proof.status verified | cited | inferred | unproven | broken
// ("calls" strings must appear in the cited lines, whitespace ignored; "inferred" is an honest guess).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MAX_LINES = 120, TOP_LINES = 40, AFTER_ONE = 24;
const here = path.dirname(fileURLToPath(import.meta.url));
const engineDir = path.join(here, '..', 'engine');
const arr = v => v == null ? [] : Array.isArray(v) ? v : [v];
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const isStr = v => typeof v === 'string' && v.trim() !== '';
const isNum = v => typeof v === 'number' && isFinite(v);

/* ---------- vocabulary (SPEC.md) ---------- */
const ACCENTS = ['tomato', 'blue', 'green', 'amber', 'plum'];
const THEMES = ['paper', 'night'];
const SPOTS = ['left', 'center-left', 'center', 'center-right', 'right'];
const COMMON = ['lens', 'kicker', 'caption', 'dur', 'stamp', 'notes', 'id'];
const LENSES = {
  title: ['headline', 'sub', 'kind', 'items', 'sign', 'label'],
  moment: ['set', 'shot', 'people', 'props', 'insert', 'split', 'highlight'],
  flow: ['actors', 'flows', 'continue', 'compare', 'focus'],
  number: ['big', 'label', 'sub', 'viz', 'who'],
  whatif: ['headline', 'vars', 'outputs', 'viz'],
  compare: ['left', 'right', 'before', 'after'],
  screen: ['device', 'ui', 'annotate'],
  timeline: ['items'],
};
const ENUM = {
  kind: ['open', 'ask', 'section', 'close'],
  set: ['table', 'office', 'street', 'home', 'store', 'classroom', 'meeting', 'blank'],
  shot: ['wide', 'close', 'insert', 'split'],
  pose: ['stand', 'sit', 'phone', 'point', 'cheer', 'think', 'walk', 'shrug', 'type'],
  mood: ['happy', 'neutral', 'sad', 'annoyed', 'surprised', 'tired'],
  prop: ['phone', 'laptop', 'receipt', 'money', 'bag', 'food', 'coffee', 'box', 'chart', 'clock', 'calendar', 'letter', 'store', 'car', 'plant', 'whiteboard', 'cake', 'chat'],
  actor: ['person', 'group', 'company', 'app', 'store', 'bank', 'payment', 'truck', 'warehouse', 'doc', 'phone', 'server', 'db', 'queue', 'fn', 'browser', 'cloud'],
  flowType: ['money', 'goods', 'info', 'link', 'request', 'response', 'event', 'data'],
  state: ['before', 'after'],
  viz: ['bars', 'dots', 'line', 'donut', 'icons'],
  format: ['₺', '$', '€', '£', '%', 'n', 'x', '×', 'currency', 'compact'],
  tone: ['muted', 'accent'],
  device: ['phone', 'laptop'],
  ui: ['header', 'text', 'amount', 'button', 'list', 'avatars', 'toast', 'input', 'progress', 'check', 'image', 'divider'],
};
const TOP_KEYS = ['title', 'subtitle', 'lang', 'accent', 'theme', 'cast', 'frames', 'root', 'proof'];

/* ---------- small helpers ---------- */
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const didYouMean = (v, list) => {
  const s = String(v).toLowerCase();
  const best = list.map(x => [x, lev(s, String(x).toLowerCase())]).sort((p, q) => p[1] - q[1])[0];
  return best && best[1] <= Math.max(1, Math.round(s.length * 0.4)) ? ` (did you mean "${best[0]}"?)` : '';
};
const oneOf = list => list.map(x => `"${x}"`).join(', ');
const plain = s => String(s).replace(/\*\*|[*`]/g, '');
const words = s => plain(s).split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
const accents = s => (String(s).replace(/\*\*[^*]*\*\*/g, '').match(/\*[^*]+\*/g) || []).length;   // *em* spans

/* ---------- whatif expressions: numbers, var ids, + - * / ( ) — parsed, never eval'd ---------- */
const LOOKALIKE = { '×': '*', '·': '*', '÷': '/', '−': '-', '–': '-', ',': '. (decimal point)' };
export function parseExpr(src, vars) {
  const toks = [], re = /\s+|(\d+(?:\.\d+)?|\.\d+)|([A-Za-z_][A-Za-z0-9_]*)|([-+*/()])/y;
  let i = 0;
  while (i < src.length) {
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) {
      const c = src[i];
      throw new Error(`"${c}" at position ${i + 1} is not allowed` + (LOOKALIKE[c] ? `; write ${LOOKALIKE[c]} instead` : '; only numbers, var ids, + - * / and ( ) are'));
    }
    if (m[1]) toks.push({ n: +m[1] });
    else if (m[2]) {
      if (!vars.includes(m[2])) throw new Error(`unknown var "${m[2]}"${didYouMean(m[2], vars)}; vars here: ${vars.join(', ') || 'none'}`);
      toks.push({ v: m[2] });
    } else if (m[3]) toks.push({ op: m[3] });
    i = re.lastIndex;
  }
  let p = 0;
  const peek = () => toks[p], end = () => p >= toks.length;
  const fail = what => { throw new Error(end() ? `ends early, expected ${what}` : `unexpected "${toks[p].op ?? toks[p].v ?? toks[p].n}", expected ${what}`); };
  const primary = () => {
    const t = peek();
    if (!t) fail('a number or var');
    if (t.n != null) { p++; return () => t.n; }
    if (t.v) { p++; return env => env[t.v]; }
    if (t.op === '(') { p++; const e = expr(); if (!peek() || peek().op !== ')') fail('")"'); p++; return e; }
    if (t.op === '-' || t.op === '+') { p++; const u = primary(); return t.op === '-' ? env => -u(env) : u; }
    return fail('a number or var');
  };
  const binary = (next, ops) => () => {
    let left = next();
    while (peek() && ops.includes(peek().op)) {
      const op = toks[p++].op, l = left, r = next();
      left = op === '+' ? e => l(e) + r(e) : op === '-' ? e => l(e) - r(e) : op === '*' ? e => l(e) * r(e) : e => l(e) / r(e);
    }
    return left;
  };
  const term = binary(primary, ['*', '/']), expr = binary(term, ['+', '-']);
  if (!toks.length) throw new Error('is empty');
  const fn = expr();
  if (!end()) fail('an operator');
  return fn;
}

/* ---------- validation ---------- */
// returns { errors, warnings, hints }: arrays of "where: message"
export function validate(story, { lenses: registered } = {}) {
  const errors = [], warnings = [], hints = [];
  const E = (w, m) => errors.push(`${w}: ${m}`), W = (w, m) => warnings.push(`${w}: ${m}`), H = (w, m) => hints.push(`${w}: ${m}`);
  if (!isObj(story)) { E('story', 'the file must hold one JSON object { "title", "cast", "frames": [...] }'); return { errors, warnings, hints }; }
  const unknownKeys = (where, obj, allowed) => {
    for (const k of Object.keys(obj)) if (!allowed.includes(k)) W(where, `unknown field "${k}"${didYouMean(k, allowed)}; it is ignored`);
  };
  const enumCheck = (where, field, v, list, warn = true) => {
    if (v == null) return;
    if (!list.includes(v)) (warn ? W : E)(where, `${field} "${v}" is not one of ${oneOf(list)}${didYouMean(v, list)}`);
  };
  unknownKeys('story', story, TOP_KEYS);
  if (!isStr(story.title)) W('story', 'no "title" (used for the page title and the first frame)');
  if (story.accent != null && !ACCENTS.includes(story.accent) && !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(story.accent))
    W('story', `accent "${story.accent}" is not one of ${oneOf(ACCENTS)} or a #hex color${didYouMean(story.accent, ACCENTS)}`);
  enumCheck('story', 'theme', story.theme, THEMES);

  // cast
  const castIds = [];
  if (story.cast != null && !Array.isArray(story.cast)) E('story', '"cast" must be a list of { "id", "name", "look" }');
  arr(story.cast).forEach((c, i) => {
    const w = `cast[${i}]`;
    if (!isObj(c)) return E(w, 'must be an object { "id", "name", "look" }');
    if (!isStr(c.id)) return E(w, 'needs an "id" (frames refer to people by it)');
    if (castIds.includes(c.id)) E(w, `duplicate cast id "${c.id}"`);
    castIds.push(c.id);
    if (!isStr(c.name)) W(`cast "${c.id}"`, 'no "name"');
    if (c.look != null && !isObj(c.look)) E(`cast "${c.id}"`, '"look" must be an object like { "hair": "bob", "top": "sweater" }');
  });
  if (arr(story.cast).filter(c => isObj(c) && c.hero).length > 1) H('cast', 'more than one "hero"; a story reads best with one protagonist');
  const castRef = (where, field, id, warn) => {
    if (id == null) return;
    if (!castIds.includes(id)) (warn ? W : E)(where, `${field} "${id}" is not in the cast${didYouMean(id, castIds)}; cast ids: ${castIds.join(', ') || 'none (add a "cast" list)'}`);
  };

  // number formats: ₺ $ € £ % n x compact, or "currency" with an ISO code ("currency": "EUR")
  const formatCheck = (where, o) => {
    enumCheck(where, 'format', o.format, ENUM.format);
    if (o.format === 'currency' && !(typeof o.currency === 'string' && /^[A-Za-z]{3}$/.test(o.currency)))
      W(where, `format "currency" needs a 3-letter "currency" code like "EUR", got ${JSON.stringify(o.currency)}; plain numbers shown`);
    if (o.currency != null && o.format !== 'currency' && o.format != null) H(where, `"currency" is only used with format "currency"`);
  };
  const vizExtras = (where, v) => {
    if (v.format != null) formatCheck(`${where} viz`, v);
    if (v.zero != null && typeof v.zero !== 'boolean') W(`${where} viz`, `"zero" must be true or false (start the axis at 0), got ${JSON.stringify(v.zero)}`);
  };

  // frames
  if (!Array.isArray(story.frames)) { E('story', '"frames" must be a list of frames, each with a "lens"'); return { errors, warnings, hints }; }
  const n = story.frames.length;
  if (n < 3 || n > 14) W('story', `${n} frames; a 60–120 s story usually has 3–14 (one idea per frame)`);
  const allLenses = [...new Set([...Object.keys(LENSES), ...(registered || [])])];
  const frameIds = new Set();
  let flowActors = null;                    // actor ids carried by the last flow frame (for "continue")
  story.frames.forEach((f, i) => {
    const w0 = `frame ${i + 1}`;
    if (!isObj(f)) return E(w0, 'must be an object with a "lens"');
    if (!isStr(f.lens)) return E(w0, `needs a "lens": one of ${oneOf(Object.keys(LENSES))}`);
    const w = `${w0} (${f.lens})`;
    if (!allLenses.includes(f.lens)) return E(w0, `unknown lens "${f.lens}"${didYouMean(f.lens, allLenses)}; lenses: ${oneOf(allLenses)}`);
    if (registered && !registered.includes(f.lens)) W(w, `no engine/lens-*.js registers the "${f.lens}" lens yet; this frame will not draw`);
    if (LENSES[f.lens]) unknownKeys(w, f, [...COMMON, ...LENSES[f.lens]]);
    if (f.id != null) { if (frameIds.has(f.id)) E(w, `duplicate frame id "${f.id}"`); frameIds.add(f.id); }
    for (const k of ['kicker', 'caption', 'stamp', 'notes']) if (f[k] != null && typeof f[k] !== 'string') E(w, `"${k}" must be text`);
    if (typeof f.caption === 'string') {
      const c = words(f.caption);
      if (c > 20) W(w, `caption has ${c} words; keep it ≤ 20 (one idea per frame)`);
      if (accents(f.caption) > 1) H(w, 'caption has more than one *accent*; the accent marks only the one new thing');
    } else if (f.lens !== 'title') W(w, 'no "caption"; every frame should say its one idea in ≤ 20 words');
    if (typeof f.kicker === 'string' && words(f.kicker) > 3) W(w, `kicker "${f.kicker}" is ${words(f.kicker)} words; 2–3 words read best`);
    if (f.dur != null && !(isNum(f.dur) && f.dur > 0)) E(w, `"dur" must be a positive number of seconds, got ${JSON.stringify(f.dur)}`);
    const need = (k, what) => { if (f[k] == null || (Array.isArray(f[k]) && !f[k].length) || f[k] === '') { E(w, `needs "${k}" (${what})`); return false; } return true; };
    const list = (k, where = w) => { if (f[k] != null && !Array.isArray(f[k])) { E(where, `"${k}" must be a list`); return []; } return arr(f[k]); };
    const accentCount = (n2, what) => { if (n2 > 1) H(w, `${n2} ${what}; the accent marks only the one new/important thing`); };

    switch (f.lens) {
      case 'title': {
        need('headline', '≤ 8 words, *word* for the accent');
        if (typeof f.headline === 'string') {
          if (words(f.headline) > 8) W(w, `headline has ${words(f.headline)} words; keep it ≤ 8`);
          accentCount(accents(f.headline), '*accent* spans in the headline');
        }
        enumCheck(w, 'kind', f.kind, ENUM.kind);
        const items = list('items');
        if (items.length > 3) W(w, `${items.length} items; ${f.kind === 'close' ? 'a close' : 'an ask'} shows ≤ 3 lines`);
        if (items.length && f.kind !== 'ask' && f.kind !== 'close') W(w, '"items" only show on kind "ask" or "close"');
        if (f.sign != null && f.kind !== 'ask') W(w, '"sign" only shows on kind "ask"' + (f.kind === 'close' ? '; a close has no sign' : ''));
        if (f.label != null) {
          if (!isStr(f.label)) E(w, '"label" must be text');
          else if (f.kind !== 'section' && f.kind !== 'close') W(w, '"label" only shows on kind "section" (instead of "PART 01") or "close"');
          else if (words(f.label) > 6) W(w, `label "${f.label}" is ${words(f.label)} words; a label reads best ≤ 6`);
        }
        break;
      }
      case 'moment': {
        enumCheck(w, 'set', f.set, ENUM.set);
        enumCheck(w, 'shot', f.shot, ENUM.shot);
        const shot = f.shot || 'wide';
        const people = (ps, where) => ps.forEach((p, j) => {
          const pw = `${where} people[${j}]`;
          if (!isObj(p)) return E(pw, 'must be an object { "who", "pose", "mood", "at" }');
          if (p.who == null) E(pw, 'needs "who" (a cast id)'); else castRef(pw, 'who', p.who);
          enumCheck(pw, 'pose', p.pose, ENUM.pose);
          enumCheck(pw, 'mood', p.mood, ENUM.mood);
          enumCheck(pw, 'at', p.at, SPOTS);
          for (const k of ['say', 'think']) if (typeof p[k] === 'string' && words(p[k]) > 8) W(pw, `"${k}" bubble has ${words(p[k])} words; bubbles read best ≤ 8`);
        });
        const props = (ps, where) => ps.forEach((p, j) => {
          const pw = `${where} props[${j}]`;
          if (!isObj(p)) return E(pw, 'must be an object { "kind", "at" }');
          if (p.kind == null) E(pw, `needs "kind": one of ${oneOf(ENUM.prop)}`); else enumCheck(pw, 'kind', p.kind, ENUM.prop);
          enumCheck(pw, 'at', p.at, SPOTS);
        });
        const ps = list('people'), pr = list('props');
        people(ps, w); props(pr, w);
        if (f.insert != null) {
          if (!isObj(f.insert)) E(w, '"insert" must be an object like { "kind": "phone", "screen": [...] }');
          else {
            if (f.insert.kind == null) E(w, 'insert needs "kind" (phone, chat, receipt, ...)');
            else if (f.insert.kind !== 'chat') enumCheck(`${w} insert`, 'kind', f.insert.kind, ENUM.prop);
            arr(f.insert.messages).forEach((m, j) => { if (isObj(m)) castRef(`${w} insert.messages[${j}]`, 'from', m.from, true); });
          }
        }
        if (shot === 'insert' && f.insert == null) E(w, 'shot "insert" needs an "insert" object (the thing that fills the frame)');
        if (shot === 'split') {
          const sp = list('split');
          if (sp.length < 2 || sp.length > 4) E(w, `shot "split" needs "split" with 2–4 panels, got ${sp.length}`);
          sp.forEach((p, j) => { if (!isObj(p)) return E(`${w} split[${j}]`, 'must be an object { "people", "props", "label" }'); people(arr(p.people), `${w} split[${j}]`); props(arr(p.props), `${w} split[${j}]`); });
        }
        if ((shot === 'wide' || shot === 'close') && !ps.length && !pr.length && f.insert == null) E(w, `shot "${shot}" has nothing to draw; add "people" or "props"`);
        // a split frame's highlight may name anyone in any panel (each panel may also carry its own)
        const panels = shot === 'split' ? arr(f.split).filter(isObj) : [];
        const allPeople = [...ps, ...panels.flatMap(p => arr(p.people))], allProps = [pr, ...panels.map(p => arr(p.props))];
        if (f.highlight != null) {
          if (typeof f.highlight === 'number') { if (!allProps.some(l => l[f.highlight])) E(w, `highlight ${f.highlight} is not a props index (0..${Math.max(...allProps.map(l => l.length)) - 1})`); }
          else if (!allPeople.some(p => isObj(p) && p.who === f.highlight)) E(w, `highlight "${f.highlight}" is not one of this frame's people${castIds.includes(f.highlight) ? '' : didYouMean(f.highlight, castIds)}`);
        }
        break;
      }
      case 'flow': {
        const own = [];
        let known = [];
        if (f.continue) {
          if (!flowActors) E(w, '"continue": true but there is no earlier flow frame to continue');
          else known = [...flowActors];    // the chain skips frames of other lenses in between
        } else need('actors', 'the boxes: [{ "id", "kind", "label", "at": [col,row] }]');
        const cells = new Map();
        list('actors').forEach((a, j) => {
          const aw = `${w} actors[${j}]`;
          if (!isObj(a)) return E(aw, 'must be an object { "id", "kind", "label" }');
          if (!isStr(a.id)) return E(aw, 'needs an "id" (flows refer to it)');
          if (own.includes(a.id)) E(aw, `duplicate actor id "${a.id}"`);
          own.push(a.id);
          const an = `${w} actor "${a.id}"`;
          const update = known.includes(a.id);    // continue: { id, sub } changes an earlier actor, the rest is inherited
          if (a.kind == null) { if (!update) W(an, `no "kind"; one of ${oneOf(ENUM.actor)}`); } else enumCheck(an, 'kind', a.kind, ENUM.actor);
          if (!isStr(a.label) && !(update && a.label == null)) W(an, 'no "label"');
          enumCheck(an, 'state', a.state, ENUM.state);
          if (a.at != null) {
            if (!Array.isArray(a.at) || a.at.length !== 2 || !a.at.every(Number.isInteger)) E(an, `"at" must be [col, row], got ${JSON.stringify(a.at)}`);
            else {
              if (a.at[0] < 0 || a.at[0] > 3 || a.at[1] < 0 || a.at[1] > 2) W(an, `"at" ${JSON.stringify(a.at)} is outside the 4×3 grid (col 0–3, row 0–2)`);
              const key = a.at.join(','), st = a.state || 'both';
              const clash = (cells.get(key) || []).find(o => o.st === 'both' || st === 'both' || o.st === st);
              if (clash) W(an, `shares grid cell ${JSON.stringify(a.at)} with "${clash.id}"`);
              cells.set(key, [...(cells.get(key) || []), { id: a.id, st }]);
            }
          }
        });
        known = [...new Set([...known, ...own])];
        flowActors = known;
        const fl = list('flows');
        fl.forEach((x, j) => {
          const xw = `${w} flows[${j}]` + (x && x.id ? ` "${x.id}"` : '');
          if (!isObj(x)) return E(xw, 'must be an object { "from", "to", "type", "label" }');
          for (const k of ['from', 'to']) {
            if (x[k] == null) E(xw, `needs "${k}" (an actor id)`);
            else if (!known.includes(x[k])) E(xw, `${k} "${x[k]}" is not an actor${didYouMean(x[k], known)}; actors: ${known.join(', ') || 'none'}`);
          }
          enumCheck(xw, 'type', x.type, ENUM.flowType);
          enumCheck(xw, 'state', x.state, ENUM.state);
          if (x.calls != null && x.code == null) W(xw, '"calls" needs a "code" range to check against; ignored');
          if (x.inferred != null && x.code != null) H(xw, 'has both "code" and "inferred"; the code wins');
        });
        if (f.compare && ![...arr(f.actors), ...fl].some(x => isObj(x) && x.state)) W(w, '"compare": true but no actor or flow has a "state" ("before" / "after"); the toggle changes nothing');
        if (!f.compare && [...arr(f.actors), ...fl].some(x => isObj(x) && x.state === 'before')) W(w, 'some items have state "before" but "compare" is not true; they are hidden');
        const news = fl.filter(x => isObj(x) && x.new && (!f.compare || x.state !== 'before')).length;
        accentCount(news, 'flows marked "new"');
        list('focus').forEach(id => { if (!known.includes(id)) E(w, `focus "${id}" is not an actor${didYouMean(id, known)}`); });
        break;
      }
      case 'number': {
        need('big', 'the one number, e.g. "%31" or "1.240 ₺"');
        if (typeof f.big === 'string' && f.big.length > 12) W(w, `big "${f.big}" is long; the big number reads best ≤ 12 characters`);
        castRef(w, 'who', f.who);
        if (f.viz != null) {
          if (!isObj(f.viz)) { E(w, '"viz" must be an object { "kind", "data" }'); break; }
          if (f.viz.kind == null) E(w, `viz needs "kind": one of ${oneOf(ENUM.viz)}`); else enumCheck(w, 'viz.kind', f.viz.kind, ENUM.viz);
          const data = arr(f.viz.data);
          if (!data.length) E(w, 'viz needs "data": [{ "label", "value" }]');
          data.forEach((d, j) => { if (!isObj(d) || !isNum(d.value)) E(`${w} viz.data[${j}]`, `needs a numeric "value", got ${JSON.stringify(d && d.value)}`); });
          vizExtras(w, f.viz);
          accentCount(data.filter(d => isObj(d) && d.accent).length, 'viz data points with "accent"');
        }
        if (!f.stamp) H(w, 'no "stamp"; if the number is an example, say so ("stamp": "örnek veri")');
        break;
      }
      case 'whatif': {
        const ids = [], env = {};
        if (isObj(f.viz)) vizExtras(w, f.viz);
        if (need('vars', '[{ "id", "label", "min", "max", "step", "value" }]')) list('vars').forEach((v, j) => {
          const vw = `${w} vars[${j}]`;
          if (!isObj(v)) return E(vw, 'must be an object { "id", "label", "min", "max", "value" }');
          if (typeof v.id !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(v.id)) return E(vw, `"id" must be a plain name like "friends" (letters, digits, _), got ${JSON.stringify(v.id)}`);
          if (ids.includes(v.id)) E(vw, `duplicate var id "${v.id}"`);
          ids.push(v.id);
          const vn = `${w} var "${v.id}"`;
          for (const k of ['min', 'max', 'value']) if (!isNum(v[k])) E(vn, `needs a numeric "${k}"`);
          if (v.step != null && !(isNum(v.step) && v.step > 0)) E(vn, `"step" must be a positive number`);
          if (isNum(v.min) && isNum(v.max) && v.min >= v.max) E(vn, `min ${v.min} must be below max ${v.max}`);
          if (isNum(v.value) && isNum(v.min) && isNum(v.max) && (v.value < v.min || v.value > v.max)) W(vn, `value ${v.value} is outside ${v.min}..${v.max}`);
          if (!isStr(v.label)) W(vn, 'no "label" for the slider');
          env[v.id] = v.value;
        });
        if (need('outputs', '[{ "label", "expr", "format" }]')) list('outputs').forEach((o, j) => {
          const ow = `${w} outputs[${j}]`;
          if (!isObj(o)) return E(ow, 'must be an object { "label", "expr", "format" }');
          if (!isStr(o.label)) W(ow, 'no "label"');
          formatCheck(ow, o);
          if (typeof o.expr !== 'string') return E(ow, 'needs "expr", e.g. "(friends - 1) * 310"');
          try {
            const val = parseExpr(o.expr, ids)(env);
            if (!isFinite(val)) W(ow, `expr "${o.expr}" gives ${val} at the starting values (division by zero?)`);
          } catch (err) { E(ow, `expr "${o.expr}": ${err.message}`); }
        });
        break;
      }
      case 'compare': {
        const lr = f.left != null || f.right != null, ba = f.before != null || f.after != null;
        if (!lr && !ba) { E(w, 'needs "left" and "right" ({ "label", "tone", "lines" }), or "before" and "after" moments'); break; }
        if (lr && ba) W(w, 'has both left/right and before/after; use one pair');
        for (const k of lr ? ['left', 'right'] : ['before', 'after']) {
          const s = f[k];
          if (s == null) { E(w, `needs "${k}" too`); continue; }
          if (!isObj(s)) { E(w, `"${k}" must be an object`); continue; }
          if (lr) {
            if (!isStr(s.label)) W(`${w} ${k}`, 'no "label"');
            enumCheck(`${w} ${k}`, 'tone', s.tone, ENUM.tone);
            const ls = arr(s.lines);
            if (ls.length > 3) W(`${w} ${k}`, `${ls.length} lines; keep it ≤ 3 short lines`);
            ls.forEach((l, j) => { if (typeof l === 'string' && words(l) > 6) W(`${w} ${k}.lines[${j}]`, `${words(l)} words; short lines (≤ 6 words) read best`); });
          } else arr(s.people).forEach((p, j) => { if (isObj(p)) castRef(`${w} ${k}.people[${j}]`, 'who', p.who); });
        }
        if (lr && f.left?.tone === 'accent' && f.right?.tone === 'accent') H(w, 'both sides have tone "accent"; give the accent to the side that is new');
        break;
      }
      case 'screen': {
        enumCheck(w, 'device', f.device, ENUM.device);
        const ui = need('ui', '[{ "type", "text" }]') ? list('ui') : [];
        ui.forEach((u, j) => {
          if (!isObj(u)) return E(`${w} ui[${j}]`, 'must be an object { "type", "text" }');
          if (u.type == null) E(`${w} ui[${j}]`, `needs "type": one of ${oneOf(ENUM.ui)}`); else enumCheck(`${w} ui[${j}]`, 'type', u.type, ENUM.ui);
          if (u.icon != null && !isStr(u.icon)) W(`${w} ui[${j}]`, `"icon" must be an icon name like "heart", got ${JSON.stringify(u.icon)}`);
        });
        accentCount(ui.filter(u => isObj(u) && u.accent).length, 'ui elements with "accent"');
        list('annotate').forEach((a, j) => {
          if (!isObj(a)) return E(`${w} annotate[${j}]`, 'must be an object { "at", "text" }');
          if (!Number.isInteger(a.at) || !ui[a.at]) E(`${w} annotate[${j}]`, `"at" must be a ui index 0..${ui.length - 1}, got ${JSON.stringify(a.at)}`);
        });
        break;
      }
      case 'timeline': {
        const items = need('items', '[{ "when", "what" }]') ? list('items') : [];
        if (items.length > 6) W(w, `${items.length} items; a timeline shows ≤ 6`);
        items.forEach((t, j) => {
          if (!isObj(t)) return E(`${w} items[${j}]`, 'must be an object { "when", "what" }');
          if (!isStr(t.when) || !isStr(t.what)) E(`${w} items[${j}]`, 'needs "when" and "what"');
        });
        accentCount(items.filter(t => isObj(t) && t.accent).length, 'items with "accent"');
        break;
      }
    }
  });
  return { errors, warnings, hints };
}

/* ---------- code embedding + proof (same rules as chalk-talk 0.2) ---------- */
function parseSpec(spec) {
  if (typeof spec === 'string') {
    const [, file, a, b] = spec.trim().match(/^(.*?)(?::(\d+)(?:-(\d+))?)?$/);
    if (a && !b) return { file, a: +a, b: +a + AFTER_ONE, mark: [+a, +a] };
    return { file, a: a ? +a : null, b: b ? +b : null, mark: null };
  }
  if (spec && typeof spec === 'object' && typeof spec.file === 'string') {
    const lines = arr(spec.lines);
    const mark = typeof spec.mark === 'number' ? [spec.mark, spec.mark] : spec.mark;
    const a = lines.length > 0 ? lines[0] : null;
    const b = lines.length > 1 ? lines[1] : (a ? a + AFTER_ONE : null);
    return { file: spec.file, a, b, mark: Array.isArray(mark) && mark.length === 2 ? mark : null };
  }
  return null;
}
const gitCache = new Map();
function gitInfo(dir) {    // { top, repo, sha } when dir sits in a GitHub checkout
  if (gitCache.has(dir)) return gitCache.get(dir);
  const run = (...a) => { try { return execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
  const top = run('rev-parse', '--show-toplevel'), url = run('remote', 'get-url', 'origin'), sha = run('rev-parse', 'HEAD');
  const m = url.match(/^(?:git@github\.com:|https:\/\/github\.com\/|ssh:\/\/git@github\.com\/)([^/]+\/[^/]+?)(?:\.git)?\/?$/);
  const info = top && sha && m ? { top, repo: m[1], sha, run } : null;
  gitCache.set(dir, info);
  return info;
}
function permalink(abs) {
  const g = gitInfo(path.dirname(abs));
  if (!g || g.run('ls-files', '--error-unmatch', abs) === '') return null;
  return `https://github.com/${g.repo}/blob/${g.sha}/${path.relative(g.top, abs).split(path.sep).join('/')}`;
}
const fileLines = abs => {    // same split as Python's str.splitlines()
  const ls = fs.readFileSync(abs, 'utf8').split(/\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/);
  if (ls.length && ls[ls.length - 1] === '') ls.pop();
  return ls;
};
function findCall(src, needle) {    // line of `needle` in the cited range, all whitespace ignored; 0 = absent
  const want = String(needle).replace(/\s+/g, '');
  if (!want) return 0;
  let flat = '';
  const lineOf = [];
  for (let ln = src.start; ln <= src.end; ln++) {
    const s = src.lines[ln - 1].replace(/\s+/g, '');
    flat += s;
    for (let i = 0; i < s.length; i++) lineOf.push(ln);
  }
  const at = flat.indexOf(want);
  return at < 0 ? 0 : lineOf[at];
}
function proofOf(flow, src) {
  if (src) {
    const range = src.start ? `${src.file}:${src.start}-${src.end}` : src.file;
    if (src.bad) return { status: 'broken', why: 'code is not "path:start-end" or {"file", "lines"}' };
    if (src.missing) return { status: 'broken', file: src.file, why: `file ${src.file} not found` };
    if (src.outOfRange) return { status: 'broken', file: src.file, why: `lines ${src.start}-${src.asked} not in ${src.file} (${src.lines.length} lines)` };
    const at = { file: src.file, start: src.start, end: src.end };
    const calls = arr(flow.calls);
    if (!calls.length) return { status: 'cited', ...at };
    let hit = 0;
    for (const c of calls) {
      const ln = findCall(src, c);
      if (!ln) return { status: 'broken', ...at, why: `calls ${JSON.stringify(String(c))} not found in ${range}` };
      hit = hit || ln;
    }
    return { status: 'verified', ...at, hit };
  }
  if (typeof flow.inferred === 'string' && flow.inferred.trim()) return { status: 'inferred', why: flow.inferred };
  return { status: 'unproven' };
}
export const proofLine = s => `proof: ${s.verified + s.cited}/${s.total} hops traced to code (${s.verified} verified, ${s.cited} cited) · ${s.inferred} inferred` +
  (s.unproven ? ` · ${s.unproven} unproven` : '') + ` · ${s.broken} broken`;

// mutates the story: embeds code, sets flow.proof and story.proofSummary. Returns warnings.
export function proveStory(story, storyDir, share) {
  const warnings = [];
  const roots = [...(typeof story.root === 'string' ? [path.resolve(storyDir, story.root)] : []), process.cwd(), storyDir];
  const resolve = (where, spec) => {
    const p = parseSpec(spec);
    if (!p) { warnings.push(`${where}: "code" should be "path:start-end" or {"file", "lines"}`); return { code: null, src: { bad: true } }; }
    const abs = roots.map(r => path.resolve(r, p.file)).find(f => { try { return fs.statSync(f).isFile(); } catch { return false; } });
    if (!abs) { warnings.push(`${where}: code file not found: ${p.file}`); return { code: { file: p.file, missing: true }, src: { file: p.file, missing: true } }; }
    const lines = fileLines(abs);
    let start = Math.max(1, p.a || 1);
    let end = Math.min(lines.length, p.b || (start + TOP_LINES - 1));
    const src = { file: p.file, start, end, lines, outOfRange: end < start, asked: p.b };
    if (end < start) {
      warnings.push(`${where}: ${p.file} has ${lines.length} lines, asked for ${start}-${p.b}`);
      start = 1; end = Math.min(lines.length, TOP_LINES);
    }
    if (end - start + 1 > MAX_LINES) {
      warnings.push(`${where}: ${p.file}:${start}-${end} is long; showing the first ${MAX_LINES} lines`);
      end = start + MAX_LINES - 1;
    }
    const code = { file: p.file, start, end, text: lines.slice(start - 1, end).join('\n') };
    if (p.mark) code.mark = p.mark;
    if (!share) code.abs = abs;
    const link = permalink(abs);
    if (link) code.url = `${link}#L${start}-L${end}`;
    return { code, src };
  };
  const frames = arr(story.frames).map((f, i) => [f, i]).filter(([f]) => isObj(f) && f.lens === 'flow');
  const all = frames.flatMap(([f, i]) => arr(f.flows).filter(isObj).map((x, j) => ({ x, where: `frame ${i + 1} flows[${j}]` + (x.id ? ` "${x.id}"` : '') })));
  const actors = frames.flatMap(([f, i]) => arr(f.actors).filter(isObj).map(a => ({ a, where: `frame ${i + 1} actor "${a.id}"` })));
  const proofOn = story.proof !== false && (story.proof === true ||
    [...all.map(o => o.x), ...actors.map(o => o.a)].some(x => 'code' in x) || all.some(o => o.x.inferred != null));
  if (!proofOn) return { warnings, summary: null };
  for (const { a, where } of actors) if ('code' in a) a.code = resolve(where, a.code).code;
  const sources = new Map();
  for (const { x, where } of all) if ('code' in x) { const r = resolve(where, x.code); x.code = r.code; sources.set(x, r.src); }
  const sum = { total: all.length, verified: 0, cited: 0, inferred: 0, unproven: 0, broken: 0 };
  for (const { x, where } of all) {
    x.proof = proofOf(x, sources.get(x));
    sum[x.proof.status]++;
    if (x.proof.status === 'broken') warnings.push(`proof: ${where} -> ${x.proof.why}`);
  }
  story.proofSummary = sum;
  return { warnings, summary: sum };
}

/* ---------- engine ---------- */
const ORDER = ['core.js', 'lens-title.js', 'lens-moment.js', 'lens-flow.js', 'lens-card.js'];
export function engineFiles(dir = engineDir) {
  const lenses = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /^lens-.+\.js$/.test(f)) : [];
  const rank = f => { const k = ORDER.indexOf(f); return k < 0 ? ORDER.length : k; };
  return ['core.js', ...lenses.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))].map(f => path.join(dir, f));
}
// lens names the engine files register: chalk.lens('name', ...)
export const registeredLenses = files => [...new Set(files.filter(f => fs.existsSync(f))
  .flatMap(f => [...fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '').matchAll(/\.lens\(\s*['"]([\w-]+)['"]/g)].map(m => m[1])))];

/* ---------- main ---------- */
function main() {
  const die = msg => { console.error('build: ' + msg); process.exit(1); };
  const [storyPath, outArg] = process.argv.slice(2);
  if (!storyPath) die('usage: node build.mjs story.json [out.html]');
  if (!fs.existsSync(storyPath) || !fs.statSync(storyPath).isFile()) die('no such story file: ' + storyPath);
  const out = outArg || (storyPath.endsWith('.story.json') ? storyPath.slice(0, -11) + '.html'
    : storyPath.endsWith('.json') ? storyPath.slice(0, -5) + '.html' : storyPath + '.html');
  const shellDir = process.env.CHALK_ENGINE ? path.resolve(process.env.CHALK_ENGINE) : engineDir;   // CHALK_ENGINE: test engines

  const raw = fs.readFileSync(storyPath, 'utf8').replace(/^\uFEFF/, '');
  let story;
  try { story = JSON.parse(raw); } catch (err) {
    const pos = +(err.message.match(/position (\d+)/) || [])[1];
    const where = isFinite(pos) ? ` (line ${raw.slice(0, pos).split('\n').length}, column ${pos - raw.lastIndexOf('\n', pos - 1)})` : '';
    die(`${storyPath} is not valid JSON${where}: ${err.message}` + (/\/\/|\/\*/.test(raw) ? '\n       JSON has no comments; remove the // or /* */ notes' : ''));
  }

  const files = engineFiles(shellDir);
  const regs = registeredLenses(files);
  const { errors, warnings, hints } = validate(story, { lenses: regs.length ? regs : null });
  for (const h of hints) console.error('build: hint  ' + h);
  for (const w of warnings) console.error('build: warn  ' + w);
  for (const e of errors) console.error('build: ERROR ' + e);
  if (errors.length) die(`${errors.length} error${errors.length > 1 ? 's' : ''} in ${storyPath}; nothing written`);

  const proof = proveStory(story, path.dirname(path.resolve(storyPath)), process.env.CHALK_SHARE === '1');
  for (const w of proof.warnings) console.error((w.startsWith('proof:') ? 'WARNING ' : 'build: warn  ') + w);
  if (proof.summary) console.error(proofLine(proof.summary));

  const shell = path.join(shellDir, 'shell.html');
  if (!fs.existsSync(shell)) die(`no engine shell at ${shell}`);
  const read = f => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
  const css = fs.existsSync(path.join(shellDir, 'skin.css')) ? read(path.join(shellDir, 'skin.css')) : '';
  const missing = files.filter(f => !fs.existsSync(f));
  if (missing.length) die(`engine file missing: ${missing.join(', ')}`);
  // a literal "</script" inside the engine or the story would close the page's script tag; "<\/" means the same in JS/JSON
  const js = files.map(f => `/* ---- ${path.basename(f)} ---- */\n` + read(f)).join('\n\n').replace(/<\/script/gi, '<\\/script');
  const json = JSON.stringify(story).replace(/<\//g, '<\\/');
  const tpl = read(shell);
  for (const slot of ['__CSS__', '__JS__', '__STORY__']) if (!tpl.includes(slot)) die(`engine/shell.html has no ${slot} slot`);
  const page = tpl.replace(/__(CSS|JS|STORY)__/g, (_, k) => ({ CSS: css, JS: js, STORY: json })[k]);   // one pass: inserted text is never re-scanned
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, page);
  console.log(out);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
