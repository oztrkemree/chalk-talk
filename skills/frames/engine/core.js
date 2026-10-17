/* chalk-talk frames · core runtime
 *
 * Owns the page: chrome (progress, header, slate/kicker, caption, controls, notes), navigation,
 * autoplay, present mode, before/after toggle, themes, accents, aspect, stamps, the report and the
 * deterministic clock. Lenses only draw: they register with
 *
 *     chalk.lens('name', { render(frame, ctx) { ... } });
 *
 * and draw into ctx.stage (SVG, viewBox 0 0 W H) for every frame that uses them. See SPEC.md for the
 * contract and lens-title.js for a worked example. Notes on the contract as implemented here:
 *
 *  - ctx.index is 0-based (ctx.index + 1 is the frame number shown to people).
 *  - Times in ctx.beat / ctx.anim are milliseconds (`at` = delay from frame start, `dur` = length).
 *    The frame's own `dur` field in the story is seconds (autoplay dwell).
 *  - Every beat leaves the element in its natural DOM state when it ends (fill: backwards), so the
 *    animated end state and a still render (?snap, reduced motion, chalk.go) are identical. Draw the
 *    final picture; beats only describe how it arrives.
 *  - Beats that move or scale an element that has a `transform` attribute wrap it in a fresh <g>
 *    first (CSS transforms would replace the attribute). Keep your references; they stay valid.
 *  - ctx.text / ctx.rich: `y` is the top of the text block (valign 'top'); also 'middle', 'bottom',
 *    'baseline'. Options: size, font (serif|sans|mono|hand or a CSS family), weight, anchor
 *    (start|middle|end), maxW, lines, color (token name or CSS color), italic, lh (line height ×),
 *    ls (letter spacing in em), upper, minSize (shrink until it fits `lines`), balance (even line
 *    lengths, for headlines), emColor. Short emphasised phrases and 1–2 letter words never break.
 *    Returns { el, w, h, lines, size, top, baseline, runs:[{text, st, x, y, w, line}] }.
 *  - ctx.icon(parent, name, cx, cy, size = 48, { color, fill, sw, rough }) is centred on (cx, cy).
 *  - Extras beyond SPEC (additive): ctx.stamp(parent, text, x, y, opts), ctx.measure(str, opts),
 *    ctx.plain(str), ctx.id(prefix) (unique ids for markers/clipPaths), ctx.lang, ctx.runtime
 *    (estimated autoplay seconds of the whole story), ctx.stampAt = {x, y, rotate} (set it in render
 *    to move the frame's stamp), beat kind 'stamp', frame.compareLabels [before, after],
 *    chalk.dwell(k), chalk.boot(story), chalk.lenses(), ?accent=.
 *  - ctx.rough(el, 1|2) suits strokes ≥ 2.5 units and fills; it breaks hairlines, so leave those clean.
 *  - Legibility: the tall stage shows at ~0.4× on a phone, so keep tall text ≥ 26 units (wide ≥ 17).
 */
(function () {
'use strict';

const qs = new URLSearchParams(location.search);
const SNAP = qs.has('snap');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const LOOP = qs.get('play') === 'loop';
let ANIM = !SNAP && !REDUCED;            // seek() turns it on for recorders
const NS = 'http://www.w3.org/2000/svg';
const SIZES = { wide: [1600, 900], tall: [900, 1400] };
const FONTS = {
  serif: "'Newsreader', Georgia, serif",
  sans: "'IBM Plex Sans', system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
  hand: "'Shantell Sans', 'Comic Sans MS', cursive",
};
// [paper, night] — night values are lifted so they read on warm black
const ACCENTS = {
  tomato: ['#E2552C', '#F07650'],
  blue:   ['#2C5BB5', '#86A8F0'],
  green:  ['#2F7A50', '#78C091'],
  amber:  ['#C27E0E', '#EBB353'],
  plum:   ['#8A3A6A', '#D68BB9'],
};
const TOKEN_FALLBACK = {
  paper: { paper: '#F1ECE3', paper2: '#F8F4EC', ink: '#1E1A16', ink2: '#5C544A', muted: '#968C7E', line: '#DCD3C4', ok: '#3B7A50', warn: '#B47A1C', error: '#B4402C' },
  night: { paper: '#191714', paper2: '#221F1B', ink: '#EEE6D6', ink2: '#B9AF9F', muted: '#7F766A', line: '#37322B', ok: '#7DBA8C', warn: '#E2AE55', error: '#EE806A' },
};
const L10N = {
  tr: { prev: 'Önceki kare', next: 'Sonraki kare', play: 'Oynat', pause: 'Durdur', before: 'Önce', after: 'Sonra',
        present: 'Sunum modu (F)', notes: 'Konuşmacı notu', noNotes: 'Bu kare için not yok.', upNext: 'Sıradaki', end: 'Son kare',
        frames: 'Kareler', frame: 'Kare', lens: 'lens', missing: 'Bu kare henüz çizilmedi.', broken: 'Bu kare çizilirken bir sorun çıktı.',
        soon: 'Lens yüklenince burada görünecek.', hint: '<kbd>←</kbd> <kbd>→</kbd> gezin · <kbd>P</kbd> oynat · <kbd>F</kbd> sunum' },
  en: { prev: 'Previous frame', next: 'Next frame', play: 'Play', pause: 'Pause', before: 'Before', after: 'After',
        present: 'Present mode (F)', notes: 'Speaker notes', noNotes: 'No notes for this frame.', upNext: 'Up next', end: 'Last frame',
        frames: 'Frames', frame: 'Frame', lens: 'lens', missing: 'This frame is not drawn yet.', broken: 'Something went wrong drawing this frame.',
        soon: 'It will appear here once the lens is loaded.', hint: '<kbd>←</kbd> <kbd>→</kbd> move · <kbd>P</kbd> play · <kbd>F</kbd> present' },
};

const lenses = Object.create(null);
const report = { ok: true, steps: 0, issues: [] };
const seenIssues = new Set();
let readyResolve, published = false;
let S = null, T = null, lang = 'en', tx = L10N.en, seed = 7, uid = 0, runtime = 0;
let cur = -1, aspect = 'wide', state = 'after', theme = 'paper';
let running = [], tickers = [], tickRAF = 0;
let playing = false, timer = 0, present = false, notesOpen = false;
let seekMode = false, seekI = -1;
const $ = {};
let LIVE = null, OFF = null;

const chalk = window.chalk = Object.assign(window.chalk || {}, {
  report,
  ready: new Promise(r => { readyResolve = r; }),
  lens(name, def) {
    if (!name || !def || typeof def.render !== 'function') { console.error('[chalk] chalk.lens(name, { render(frame, ctx) }) expected'); return; }
    lenses[name] = def;
  },
  lenses: () => Object.keys(lenses),
  steps: () => (S ? S.frames.length : 0),
  go: k => { if (!S) return; seekI = -1; show(idx(k), { instant: true }); },
  seek, duration,
  dwell: k => (S ? dwell(idx(k), duration(k)) : 0),
  boot,
});

/* ---------- small utils ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const idx = k => clamp(Math.round(+k || 1) - 1, 0, S.frames.length - 1);
const pad2 = n => String(n).padStart(2, '0');
const words = s => (s ? String(s).trim().split(/\s+/).filter(Boolean).length : 0);
function hashStr(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rand(sd = 1) {   // mulberry32; numbers or strings
  let a = typeof sd === 'number' ? (sd >>> 0) : hashStr(sd);
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hex(c) {
  c = String(c || '').trim();
  if (/^#[0-9a-f]{3}$/i.test(c)) c = '#' + [...c.slice(1)].map(x => x + x).join('');
  return /^#[0-9a-f]{6}$/i.test(c) ? c.toUpperCase() : null;
}
function mix(a, b, t) {
  const A = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), B = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase();
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

/* ---------- rich text: **bold**, *accent em*, `code` ---------- */
function parseRich(str) {
  const s = str == null ? '' : String(str), out = [], re = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ text: s.slice(last, m.index), st: '' });
    out.push(m[1] != null ? { text: m[1], st: 'b' } : m[2] != null ? { text: m[2], st: 'em' } : { text: m[3], st: 'code' });
    last = re.lastIndex;
  }
  if (last < s.length) out.push({ text: s.slice(last), st: '' });
  return out;
}
const plain = s => parseRich(s).map(r => r.text).join('');
const richHTML = s => parseRich(s).map(r => r.st === 'b' ? `<b>${esc(r.text)}</b>` : r.st === 'em' ? `<em>${esc(r.text)}</em>` : r.st === 'code' ? `<code>${esc(r.text)}</code>` : esc(r.text)).join('');

/* ---------- issues + report ---------- */
function addIssue(level, where, msg) {
  const key = level + '|' + where + '|' + msg;
  if (seenIssues.has(key)) return;
  seenIssues.add(key);
  report.issues.push({ level, where, msg });
  report.ok = !report.issues.some(i => i.level === 'error');
  (level === 'error' ? console.error : console.warn)(`[chalk] ${where}: ${msg}`);
  if (published) publish();
}
function publish() {
  published = true;
  report.ok = !report.issues.some(i => i.level === 'error');
  report.steps = S ? S.frames.length : 0;
  let node = document.getElementById('chalk-report');
  if (!node) { node = document.createElement('script'); node.type = 'application/json'; node.id = 'chalk-report'; document.body.appendChild(node); }
  node.textContent = JSON.stringify(report).replace(/</g, '\\u003c');
}
function fatal(msg) {
  document.body.innerHTML = '';
  const pre = document.createElement('pre'); pre.className = 'ct-fatal'; pre.textContent = '[chalk] ' + msg; document.body.appendChild(pre);
  report.ok = false; report.issues.push({ level: 'error', where: 'story', msg });
  publish();
  document.documentElement.dataset.chalk = 'ready';
  readyResolve(chalk);
}

/* ---------- text measurement + layout ---------- */
const mcache = new Map();
function fontOf(o, st) {
  const fam = FONTS[o.font] || o.font || FONTS.serif;
  if (st === 'code') return { fam: FONTS.mono, size: o.size * 0.88, weight: Math.min(500, o.weight), italic: false };
  return { fam, size: o.size, weight: st === 'b' ? clamp(o.weight + 200, 600, 800) : o.weight, italic: st === 'em' ? true : !!o.italic };
}
function measure(str, f, ls = 0) {
  const k = `${f.italic ? 1 : 0}|${f.weight}|${f.size}|${f.fam}|${ls}|${str}`;
  let w = mcache.get(k);
  if (w != null) return w;
  const t = $.mtext;
  t.setAttribute('font-family', f.fam); t.setAttribute('font-size', f.size); t.setAttribute('font-weight', f.weight);
  t.setAttribute('font-style', f.italic ? 'italic' : 'normal'); t.setAttribute('letter-spacing', ls || 0);
  t.textContent = str;
  w = str ? t.getComputedTextLength() : 0;
  mcache.set(k, w);
  return w;
}
function wrap(runs, o) {
  const ls = (o.ls || 0) * o.size;
  const list = [];   // words (arrays of segs) and null = forced line break
  let word = null;
  // a short emphasised phrase (≤ 3 words) never breaks across lines: "*6 hafta.*" stays together
  const pieces = r => {
    if (!r.st || r.text.trim().split(/\s+/).length > 3 || /\n/.test(r.text)) return r.text.split(/(\s+)/);
    const m = r.text.match(/^(\s*)([\s\S]*?)(\s*)$/);
    return [m[1], m[2], m[3]];
  };
  for (const r of runs) for (const part of pieces(r)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) { word = null; const nl = (part.match(/\n/g) || []).length; for (let k = 0; k < nl; k++) list.push(null); continue; }
    if (!word) { word = []; list.push(word); }
    word.push({ text: part, st: r.st });
  }
  // a 1–2 character word ("2", "ve", "a") is bound to the next one, so it never hangs alone at a line end
  for (let k = list.length - 2; k >= 0; k--) {
    const w = list[k], nx = list[k + 1];
    if (w && nx && !nx.bound && w.reduce((a, s) => a + s.text.length, 0) <= 2) list.splice(k, 2, Object.assign([...w, { ...nx[0], text: ' ' + nx[0].text }, ...nx.slice(1)], { bound: true }));
  }
  const segW = s => measure(s.text, fontOf(o, s.st), ls);
  const f0 = fontOf(o, '');
  const space = measure('a a', f0, ls) - measure('aa', f0, ls);
  const lines = []; let line = null, over = '';
  const flush = () => { if (line) lines.push(line); line = null; };
  for (const w of list) {
    if (w === null) { if (!line) line = { segs: [], w: 0 }; flush(); continue; }
    const ww = w.reduce((a, s) => a + segW(s), 0);
    if (ww > o.maxW + 0.5 && !over) over = w.map(s => s.text).join('');
    if (line && line.segs.length && line.w + space + ww > o.maxW + 0.5) flush();
    if (!line) line = { segs: [], w: 0 };
    if (!line.segs.length) { line.segs.push(...w.map(s => ({ ...s }))); line.w = ww; }
    else { line.segs.push({ ...w[0], text: ' ' + w[0].text }, ...w.slice(1).map(s => ({ ...s }))); line.w += space + ww; }
  }
  flush();
  for (const l of lines) {
    l.segs = l.segs.reduce((acc, s) => { const p = acc[acc.length - 1]; if (p && p.st === s.st) p.text += s.text; else acc.push({ ...s }); return acc; }, []);
    l.w = l.segs.reduce((a, s) => a + segW(s), 0);
  }
  return { lines, over, space, ls, segW };
}
const col = (ctx, c) => (c && ctx.t[c]) || c || ctx.t.ink;
function textBlock(ctx, parent, runs, x, y, opts) {
  const o = Object.assign({ size: 32, font: 'serif', weight: 400, anchor: 'start', maxW: Infinity, lines: Infinity, color: 'ink', lh: 1.22, ls: 0, valign: 'top' }, opts || {});
  if (o.upper) runs = runs.map(r => ({ ...r, text: r.text.toLocaleUpperCase(ctx.lang) }));
  let L = wrap(runs, o);
  if (o.minSize) while ((L.lines.length > o.lines || L.over) && o.size > o.minSize) { o.size = Math.max(o.minSize, Math.round(o.size * 0.94 * 10) / 10); L = wrap(runs, o); }
  if (o.balance && L.lines.length > 1 && L.lines.length <= o.lines && isFinite(o.maxW)) {   // even out ragged lines
    const n = L.lines.length, full = o.maxW;
    let lo = full * 0.4, hi = full;
    for (let k = 0; k < 9; k++) { const mid = (lo + hi) / 2; o.maxW = mid; const T2 = wrap(runs, o); if (T2.lines.length === n && !T2.over) hi = mid; else lo = mid; }
    o.maxW = hi; L = wrap(runs, o); o.maxW = full;
  }
  const preview = runs.map(r => r.text).join('').slice(0, 48);
  if (L.over) ctx.issue('warn', `a word is wider than maxW ${Math.round(o.maxW)}: "${L.over}"`);
  if (L.lines.length > o.lines) {
    ctx.issue('warn', `text cut to ${o.lines} line(s): "${preview}"`);
    L.lines.length = o.lines;
    const last = L.lines[o.lines - 1], seg = last.segs[last.segs.length - 1];
    if (seg) {
      const base = seg.text.replace(/\s+$/, '');
      let k = base.length;
      const widthWith = n => last.w - L.segW(seg) + L.segW({ text: base.slice(0, n) + '…', st: seg.st });
      while (k > 1 && widthWith(k) > o.maxW) k--;
      seg.text = base.slice(0, k).replace(/[\s,.;:]+$/, '') + '…';
      last.w = last.segs.reduce((a, s) => a + L.segW(s), 0);
    }
  }
  const lhPx = o.size * o.lh, n = L.lines.length, h = n * lhPx;
  const asc = (lhPx - o.size) / 2 + o.size * 0.8;
  let top = y;
  if (o.valign === 'middle') top = y - h / 2;
  else if (o.valign === 'bottom') top = y - h;
  else if (o.valign === 'baseline') top = y - asc;
  const base0 = top + asc, f0 = fontOf(o, '');
  const t = el('text', {
    x, 'font-family': f0.fam, 'font-size': o.size, 'font-weight': o.weight, 'font-style': o.italic ? 'italic' : null,
    fill: col(ctx, o.color), 'text-anchor': o.anchor !== 'start' ? o.anchor : null, 'letter-spacing': L.ls || null,
    style: 'white-space:pre',
  }, parent);
  const out = []; let wmax = 0;
  L.lines.forEach((l, li) => {
    const by = base0 + li * lhPx;
    wmax = Math.max(wmax, l.w);
    let sx = o.anchor === 'middle' ? x - l.w / 2 : o.anchor === 'end' ? x - l.w : x;
    l.segs.forEach((s, si) => {
      const f = fontOf(o, s.st);
      const ts = el('tspan', si === 0 ? { x, y: by } : null, t);
      if (s.st === 'b') ts.setAttribute('font-weight', f.weight);
      if (s.st === 'em') { ts.setAttribute('font-style', 'italic'); ts.setAttribute('fill', col(ctx, o.emColor || 'accent')); }
      if (s.st === 'code') { ts.setAttribute('font-family', f.fam); ts.setAttribute('font-size', f.size); ts.setAttribute('font-weight', f.weight); ts.setAttribute('font-style', 'normal'); }
      ts.textContent = s.text;
      const sw = L.segW(s), lead = s.text.startsWith(' ') ? L.space : 0;
      out.push({ text: s.text.trimStart(), st: s.st, x: sx + lead, y: by, w: sw - lead - (L.ls || 0), line: li });
      sx += sw;
    });
  });
  return { el: t, w: wmax - (L.ls || 0), h, lines: n, size: o.size, top, baseline: base0, runs: out };
}

/* ---------- motion: every animation is registered so seek() can freeze it ---------- */
const EASE = { out: 'cubic-bezier(.2,.8,.25,1)', io: 'cubic-bezier(.6,0,.25,1)', pop: 'cubic-bezier(.3,.7,.4,1)' };
const ORIGIN = { left: '0% 50%', right: '100% 50%', top: '50% 0%', bottom: '50% 100%', center: '50% 50%' };
function liftTarget(e, needsTransform) {
  if (!needsTransform || !(e instanceof SVGElement) || !e.hasAttribute('transform') || !e.parentNode) return e;
  const g = document.createElementNS(NS, 'g');
  e.parentNode.insertBefore(g, e); g.appendChild(e);
  return g;
}
function reg(ctx, a) {
  ctx._anims.push(a);
  if (!ctx._animate) { if (isFinite(a.effect.getComputedTiming().endTime)) a.finish(); else a.cancel(); }
  return a;
}
function beat(ctx, e, kind, o) {
  if (!e) return null;
  o = o || {};
  const at = +o.at || 0;
  let kf, dur, easing = EASE.out, tgt, origin = ORIGIN.center;
  switch (kind) {
    case 'fade':
      if (o.to != null) e.style.opacity = o.to;     // natural state = end state
      dur = o.dur || 560; tgt = liftTarget(e, true);
      kf = [{ opacity: 0, transform: `translate(${o.dx || 0}px,${o.dy ?? 12}px)` }, { opacity: o.to ?? 1, transform: 'translate(0px,0px)' }];
      break;
    case 'pop':
      dur = o.dur || 520; tgt = liftTarget(e, true); easing = EASE.pop;
      kf = [{ opacity: 0, transform: 'scale(.55)' }, { opacity: 1, transform: 'scale(1.06)', offset: 0.6 }, { opacity: 1, transform: 'scale(1)' }];
      break;
    case 'stamp':
      dur = o.dur || 440; tgt = liftTarget(e, true); easing = 'cubic-bezier(.55,0,.7,1)';
      kf = [{ opacity: 0, transform: 'scale(1.8)' }, { opacity: 1, transform: 'scale(.95)', offset: 0.72 }, { opacity: 1, transform: 'scale(1)' }];
      break;
    case 'grow': {
      dur = o.dur || 760; tgt = liftTarget(e, true); easing = 'cubic-bezier(.5,0,.2,1)';
      const from = typeof o.from === 'string' ? o.from : 'left';
      origin = ORIGIN[from] || ORIGIN.left;
      kf = [{ transform: from === 'center' ? 'scale(0)' : /top|bottom/.test(from) ? 'scaleY(0)' : 'scaleX(0)' }, { transform: 'scale(1)' }];
      break;
    }
    case 'fly':
      dur = o.dur || 900; tgt = liftTarget(e, true); easing = 'cubic-bezier(.5,0,.15,1)';
      kf = [{ opacity: 0, transform: `translate(${o.dx ?? 0}px,${o.dy ?? 60}px)` }, { opacity: 1, offset: 0.25 }, { opacity: 1, transform: 'translate(0px,0px)' }];
      break;
    case 'flip':
      dur = o.dur || 620; tgt = liftTarget(e, true); easing = 'cubic-bezier(.3,1.3,.5,1)';
      kf = [{ opacity: 0, transform: 'scaleX(0)' }, { opacity: 1, offset: 0.2 }, { opacity: 1, transform: 'scaleX(1)' }];
      break;
    case 'draw': return drawBeat(ctx, e, o);
    case 'count': case 'type': return textBeat(ctx, e, kind, o);
    default:
      ctx.issue('warn', `unknown beat "${kind}" (fade|pop|draw|grow|fly|count|type|flip); used fade`);
      return beat(ctx, e, 'fade', o);
  }
  tgt.style.transformOrigin = origin;
  if (tgt instanceof SVGElement) tgt.style.transformBox = 'fill-box';
  return reg(ctx, tgt.animate(kf, { duration: dur, delay: at, easing, fill: 'backwards' }));
}
function drawBeat(ctx, e, o) {
  const GEO = 'path,line,polyline,polygon,circle,ellipse,rect';
  const list = e.matches && e.matches(GEO) ? [e] : [...e.querySelectorAll(GEO)];
  const at = +o.at || 0, dur = o.dur || 900;
  let first = null;
  const rest = [];
  for (const p of list) {
    const cs = getComputedStyle(p);
    if ((cs.strokeDasharray && cs.strokeDasharray !== 'none') || cs.stroke === 'none') { rest.push(p); continue; }
    let len = 0;
    try { len = p.getTotalLength(); } catch (_) { /* not a geometry */ }
    if (!len) { rest.push(p); continue; }
    const fo = cs.fill !== 'none' ? +cs.fillOpacity : null;
    const k0 = { strokeDasharray: `${len} ${len}`, strokeDashoffset: len }, k1 = { strokeDasharray: `${len} ${len}`, strokeDashoffset: 0 };
    const kf = fo == null ? [k0, k1] : [{ ...k0, fillOpacity: 0 }, { fillOpacity: 0, offset: 0.55 }, { ...k1, fillOpacity: fo }];
    const a = reg(ctx, p.animate(kf, { duration: dur, delay: at, easing: 'cubic-bezier(.55,.05,.3,1)', fill: 'backwards' }));
    first = first || a;
  }
  for (const p of rest) { const a = beat(ctx, p, 'fade', { at: at + dur * 0.35, dur: dur * 0.65, dy: 0 }); first = first || a; }
  return first || beat(ctx, e, 'fade', { at, dur, dy: 0 });
}
function textBeat(ctx, e, kind, o) {
  const nodes = [];
  (function walk(n) { for (const c of n.childNodes) c.nodeType === 3 ? nodes.push(c) : walk(c); })(e);
  if (!nodes.length) return beat(ctx, e, 'fade', o);
  const full = nodes.map(n => n.data);
  let fn, dur;
  if (kind === 'type') {
    const total = full.reduce((a, s) => a + s.length, 0);
    dur = o.dur || clamp(total * 38, 300, 2600);
    fn = p => { let k = Math.round(p * total); nodes.forEach((n, j) => { n.data = full[j].slice(0, Math.max(0, k)); k -= full[j].length; }); };
  } else {
    const j = full.findIndex(s => /\d/.test(s));
    if (j < 0) { ctx.issue('warn', 'count beat on text without a number'); return beat(ctx, e, 'fade', o); }
    const m = full[j].match(/\d[\d.,\s]*\d|\d/);
    const parts = new Intl.NumberFormat(ctx.lang).formatToParts(12345.6);
    const group = (parts.find(p => p.type === 'group') || {}).value || ',';
    const decimal = (parts.find(p => p.type === 'decimal') || {}).value || '.';
    const raw = m[0].replace(/\s/g, '');
    const dec = (raw.split(decimal)[1] || '').length;
    const num = parseFloat(raw.split(group).join('').replace(decimal, '.')) || 0;
    const to = o.to ?? num, from = o.from ?? 0;
    const nf = new Intl.NumberFormat(ctx.lang, { minimumFractionDigits: dec, maximumFractionDigits: dec });
    const pre = full[j].slice(0, m.index), post = full[j].slice(m.index + m[0].length);
    dur = o.dur || 1000;
    fn = p => { nodes[j].data = pre + nf.format(from + (to - from) * p) + post; };
  }
  const a = reg(ctx, e.animate([], { duration: dur, delay: +o.at || 0, fill: 'both', easing: kind === 'count' ? 'cubic-bezier(.2,.7,.2,1)' : 'linear' }));
  if (ctx._animate) { ctx._ticks.push({ a, fn }); fn(0); startTick(); } else fn(1);
  return a;
}
function anim(ctx, e, kf, o) {
  if (!e) return null;
  o = Object.assign({}, o);
  const frames = Array.isArray(kf) ? kf : [kf];
  const hasT = frames.some(k => k && 'transform' in k) || ('transform' in (kf || {}));
  const tgt = liftTarget(e, hasT);
  if (hasT && tgt instanceof SVGElement) { tgt.style.transformBox = 'fill-box'; tgt.style.transformOrigin = o.origin || ORIGIN.center; }
  if (o.at != null) o.delay = +o.at;
  delete o.at; delete o.origin;
  return reg(ctx, tgt.animate(kf, Object.assign({ fill: 'backwards', easing: EASE.out, duration: 600 }, o)));
}
function tick() {
  for (const k of tickers) { const p = k.a.effect.getComputedTiming().progress; if (p != null) k.fn(p); }
}
function startTick() {
  if (tickRAF || seekMode) return;
  const loop = () => {
    tick();
    tickRAF = tickers.some(k => k.a.playState === 'running' || k.a.pending) ? requestAnimationFrame(loop) : 0;
  };
  tickRAF = requestAnimationFrame(loop);
}

/* ---------- ink: wobble filter, icons, stamps ---------- */
function rough(e, level = 1) {
  if (!e) return e;
  const l = Math.round(clamp(+level || 0, 0, 2));
  if (l) e.setAttribute('filter', `url(#ct-rough-${l})`); else e.removeAttribute('filter');
  return e;
}
function buildDefs() {
  const k = theme === 'night' ? 0.85 : 1, R = 'filterUnits="userSpaceOnUse" x="-900" y="-900" width="3400" height="3200"';
  $.defs.innerHTML = `
    <filter id="ct-rough-1" ${R}><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="${seed}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${(2.6 * k).toFixed(2)}" xChannelSelector="R" yChannelSelector="G"/></filter>
    <filter id="ct-rough-2" ${R}><feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="3" seed="${seed}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${(5 * k).toFixed(2)}" xChannelSelector="R" yChannelSelector="G"/></filter>
    <filter id="ct-stamp" ${R}><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="${seed + 3}" result="g"/><feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -3.2 0 0 0 2.35" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in" result="w"/><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="${seed}" result="n"/><feDisplacementMap in="w" in2="n" scale="3.4" xChannelSelector="R" yChannelSelector="G"/></filter>`;
}
function gearPath() {
  let d = '';
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, p = (r, da) => `${(24 + r * Math.cos(a + da)).toFixed(2)} ${(24 + r * Math.sin(a + da)).toFixed(2)}`;
    d += `${i ? 'L' : 'M'}${p(13.5, -0.3)}L${p(18, -0.17)}L${p(18, 0.17)}L${p(13.5, 0.3)}`;
  }
  return d + 'Z';
}
function starPath() {
  let d = '';
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 7.6 : 18.5, a = -Math.PI / 2 + i * Math.PI / 5; d += `${i ? 'L' : 'M'}${(24 + r * Math.cos(a)).toFixed(2)} ${(25.5 + r * Math.sin(a)).toFixed(2)}`; }
  return d + 'Z';
}
// 48×48 box, ~2.3 stroke. P = paper fill (occludes what is behind), K = ink fill.
const ICONS = {
  person: '<circle cx="24" cy="14.5" r="7" fill="P"/><path d="M9.5 42c0-9 6.4-15 14.5-15s14.5 6 14.5 15z" fill="P"/>',
  group: '<circle cx="32" cy="13" r="5.5" fill="P"/><path d="M22.5 36c.6-7.6 4.4-12 9.5-12s9 4.4 9.5 12z" fill="P"/><circle cx="18.5" cy="17.5" r="6.5" fill="P"/><path d="M5.5 43c0-8.2 5.6-13.5 13-13.5s13 5.3 13 13.5z" fill="P"/>',
  store: '<path d="M10 21v20h28V21" fill="P"/><path d="M20.5 41V31h7v10"/><path d="M8 10h32l3 9q-4.75 6-9.5 0-4.75 6-9.5 0-4.75 6-9.5 0-4.75 6-9.5 0z" fill="P"/><path d="M17.5 10l-2 9M24 10v9M30.5 10l2 9"/>',
  bank: '<path d="M6 17.5 24 7l18 10.5z" fill="P"/><path d="M11 21.5v13M19 21.5v13M29 21.5v13M37 21.5v13M7.5 38.5h33M5.5 42.5h37"/>',
  card: '<rect x="5" y="11" width="38" height="26" rx="4" fill="P"/><path d="M5 17h38v6H5z" fill="K" stroke="none"/><path d="M11 30.5h9"/>',
  money: '<rect x="4.5" y="12.5" width="39" height="23" rx="3" fill="P"/><circle cx="24" cy="24" r="5.5"/><path d="M10.5 24h.01M37.5 24h.01" stroke-width="3.6"/>',
  phone: '<rect x="13.5" y="4.5" width="21" height="39" rx="4.5" fill="P"/><path d="M21 9.5h6M22 38.5h4"/>',
  laptop: '<rect x="9.5" y="9.5" width="29" height="20" rx="2.5" fill="P"/><path d="M4.5 34.5h39l-3.5 5h-32z" fill="P"/>',
  server: '<rect x="8.5" y="7.5" width="31" height="14" rx="2.5" fill="P"/><rect x="8.5" y="26.5" width="31" height="14" rx="2.5" fill="P"/><path d="M14.5 14.5h.01M14.5 33.5h.01" stroke-width="3.6"/><path d="M28 14.5h6M28 33.5h6"/>',
  db: '<path d="M10 11v26c0 3.3 6.3 6 14 6s14-2.7 14-6V11" fill="P"/><ellipse cx="24" cy="11" rx="14" ry="6" fill="P"/><path d="M10 24c0 3.3 6.3 6 14 6s14-2.7 14-6"/>',
  queue: '<rect x="4.5" y="13.5" width="10" height="16" rx="2" fill="P"/><rect x="19" y="13.5" width="10" height="16" rx="2" fill="P"/><rect x="33.5" y="13.5" width="10" height="16" rx="2" fill="K"/><path d="M6 38h34m-4-3.5 4 3.5-4 3.5"/>',
  doc: '<path d="M11.5 4.5h17l8 8v31h-25z" fill="P"/><path d="M28.5 4.5v8h8M17 21h14M17 27h14M17 33h9"/>',
  truck: '<path d="M3.5 12.5h25v21h-25z" fill="P"/><path d="M28.5 18.5h8l6 7.5v7.5h-14z" fill="P"/><circle cx="12" cy="35" r="4.5" fill="P"/><circle cx="35" cy="35" r="4.5" fill="P"/>',
  box: '<path d="M7.5 15.5 24 8.5l16.5 7v18L24 40.5l-16.5-7z" fill="P"/><path d="M7.5 15.5 24 22.5l16.5-7M24 22.5v18M15.5 12l16.5 7"/>',
  clock: '<circle cx="24" cy="24" r="17.5" fill="P"/><path d="M24 13.5V24l7 4.5"/>',
  check: '<path d="M10.5 25.5 19.5 34 37.5 13.5" stroke-width="3.2"/>',
  cross: '<path d="M14 14l20 20M34 14 14 34" stroke-width="3.2"/>',
  link: '<path d="M21 17.5l3.2-3.2a6.6 6.6 0 0 1 9.4 9.4l-3.2 3.2M27 30.5l-3.2 3.2a6.6 6.6 0 0 1-9.4-9.4l3.2-3.2M19.5 28.5l9-9"/>',
  chat: '<path d="M9 9.5h30a4 4 0 0 1 4 4v15a4 4 0 0 1-4 4H22l-8.5 6.5v-6.5H9a4 4 0 0 1-4-4v-15a4 4 0 0 1 4-4z" fill="P"/><path d="M16 21h.01M24 21h.01M32 21h.01" stroke-width="3.6"/>',
  mail: '<rect x="5.5" y="10.5" width="37" height="27" rx="3" fill="P"/><path d="M6.5 12.5 24 26l17.5-13.5"/>',
  key: '<circle cx="15" cy="24" r="7.5" fill="P"/><path d="M22.5 24h19M35.5 24v6M41 24v5"/>',
  lock: '<path d="M16 21v-5.5a8 8 0 0 1 16 0V21"/><rect x="10.5" y="21" width="27" height="20" rx="3" fill="P"/><path d="M24 28.5v5"/>',
  gear: () => `<path d="${gearPath()}" fill="P"/><circle cx="24" cy="24" r="5.5"/>`,
  chart: '<path d="M7 7v34h35"/><path d="M13.5 41V27h6v14zM23.5 41V19h6v22zM33.5 41V12h6v29z" fill="P"/>',
  star: () => `<path d="${starPath()}" fill="P"/>`,
  heart: '<path d="M24 40.5C11 32 6.5 24.5 7.5 17.5 8.6 10.3 17.6 8 24 15.5 30.4 8 39.4 10.3 40.5 17.5c1 7-3.5 14.5-16.5 23z" fill="P"/>',
  bolt: '<path d="M27.5 4.5 10.5 27h12.5l-2.5 16.5L37.5 21H25z" fill="P"/>',
  globe: '<circle cx="24" cy="24" r="17.5" fill="P"/><ellipse cx="24" cy="24" rx="7.5" ry="17.5"/><path d="M6.5 24h35M9 15h30M9 33h30"/>',
  home: '<path d="M10.5 20.5V41h27V20.5" fill="P"/><path d="M6 23 24 7.5 42 23"/><path d="M20 41V30.5h8V41"/>',
  cart: '<path d="M4 8.5h5.5l5 22.5h22.5l4.5-15.5H11.5"/><circle cx="17" cy="38" r="3"/><circle cx="34" cy="38" r="3"/>',
  bag: '<path d="M9.5 16h29l2 26.5h-33z" fill="P"/><path d="M17 20v-6.5a7 7 0 0 1 14 0V20"/>',
  food: '<path d="M5.5 23.5h37c0 9.5-8.3 16-18.5 16S5.5 33 5.5 23.5z" fill="P"/><path d="M17 17.5c-2.5-3 2.5-5 0-9M24 17.5c-2.5-3 2.5-5 0-9M31 17.5c-2.5-3 2.5-5 0-9"/>',
  coffee: '<path d="M9.5 18.5h22v12a9 9 0 0 1-9 9h-4a9 9 0 0 1-9-9z" fill="P"/><path d="M31.5 21.5h3a5 5 0 0 1 0 10h-3M15.5 13.5c-2-2.5 2-4 0-7M22.5 13.5c-2-2.5 2-4 0-7M7 43.5h27"/>',
  car: '<path d="M4.5 33v-6.5l5-2 5.5-8.5h17l6.5 8.5 5 2V33z" fill="P"/><path d="M15.5 24.5l3.5-5.5h11l4 5.5z"/><circle cx="14" cy="33.5" r="4.5" fill="P"/><circle cx="34" cy="33.5" r="4.5" fill="P"/>',
  calendar: '<rect x="6.5" y="9.5" width="35" height="32" rx="3.5" fill="P"/><path d="M6.5 18.5h35M16 5.5v8M32 5.5v8"/><path d="M14 26h.01M24 26h.01M34 26h.01M14 34h.01M24 34h.01" stroke-width="3.4"/>',
  flag: '<path d="M11.5 43.5V5.5"/><path d="M11.5 7.5h26l-5 8 5 8h-26z" fill="P"/>',
  search: '<circle cx="20.5" cy="20.5" r="12.5" fill="P"/><path d="M30 30l11.5 11.5" stroke-width="3.4"/>',
  eye: '<path d="M3.5 24C9.5 13.5 17 9.5 24 9.5S38.5 13.5 44.5 24C38.5 34.5 31 38.5 24 38.5S9.5 34.5 3.5 24z" fill="P"/><circle cx="24" cy="24" r="6.5"/><circle cx="24" cy="24" r="2.2" fill="K" stroke="none"/>',
  warn: '<path d="M24 6 43 39.5H5z" fill="P"/><path d="M24 18v10"/><path d="M24 33.5h.01" stroke-width="3.6"/>',
  sparkle: '<path d="M22 6c1.2 10.8 5.2 14.8 16 16-10.8 1.2-14.8 5.2-16 16-1.2-10.8-5.2-14.8-16-16 10.8-1.2 14.8-5.2 16-16z" fill="P"/><path d="M38 5.5c.5 3.6 1.9 5 5.5 5.5-3.6.5-5 1.9-5.5 5.5-.5-3.6-1.9-5-5.5-5.5 3.6-.5 5-1.9 5.5-5.5z"/>',
};
function icon(ctx, parent, name, x, y, size = 48, o = {}) {
  let src = ICONS[name];
  if (!src) { ctx.issue('warn', `unknown icon "${name}"`); src = '<circle cx="24" cy="24" r="16" fill="P"/><path d="M19.5 19.5a4.5 4.5 0 1 1 6 4.2c-1 .5-1.5 1.3-1.5 2.3v1M24 33h.01" />'; }
  if (typeof src === 'function') src = src();
  const s = size / 48, stroke = col(ctx, o.color || 'ink'), fill = col(ctx, o.fill || 'paper2');
  const g = el('g', {
    transform: `translate(${x - size / 2} ${y - size / 2}) scale(${s})`, fill: 'none', stroke,
    'stroke-width': o.sw || 2.3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'ct-icon ct-icon-' + name,
  }, parent);
  g.innerHTML = src.replace(/fill="P"/g, `fill="${fill}"`).replace(/fill="K"/g, `fill="${stroke}"`);
  if (o.rough !== 0) rough(g, o.rough || 1);
  return g;
}
function stamp(ctx, parent, str, x, y, o = {}) {
  const size = o.size || 24, color = col(ctx, o.color || 'accent');
  const label = String(str).toLocaleUpperCase(ctx.lang);
  const g = el('g', { transform: `translate(${x} ${y}) rotate(${o.rotate ?? -5})`, class: 'ct-stamp', opacity: 0.92 }, parent);
  const inner = el('g', { filter: 'url(#ct-stamp)' }, g);
  const ls = 0.14 * size, tw = measure(label, { fam: FONTS.mono, size, weight: 500, italic: false }, ls) - ls;
  const w = o.w || tw + size * 1.7, h = o.h || size * 2.2;
  const x0 = o.anchor === 'end' ? -w : o.anchor === 'start' ? 0 : -w / 2, y0 = -h / 2;
  el('rect', { x: x0, y: y0, width: w, height: h, rx: size * 0.28, fill: 'none', stroke: color, 'stroke-width': size * 0.12 }, inner);
  el('rect', { x: x0 + size * 0.24, y: y0 + size * 0.24, width: w - size * 0.48, height: h - size * 0.48, rx: size * 0.14, fill: 'none', stroke: color, 'stroke-width': size * 0.05 }, inner);
  const lab = textBlock(ctx, inner, [{ text: label, st: '' }], x0 + w / 2 + ls / 2, o.labelY != null ? y0 + o.labelY : 0,
    { size, font: 'mono', weight: 500, color, anchor: 'middle', ls: 0.14, valign: 'middle', lh: 1 });
  if (o.at != null) ctx.beat(g, 'stamp', { at: o.at });
  return { el: g, inner, label: lab.el, w, h, x0, y0 };
}

/* ---------- frames ---------- */
function makeCtx(tgt, i, asp, animate) {
  const fr = S.frames[i], [W, H] = SIZES[asp];
  const where = `frame ${i + 1} (${fr.lens}, ${asp}${tgt.state === 'before' ? ', before' : ''})`;
  const ctx = {
    W, H, aspect: asp, stage: tgt.stage, html: tgt.html, story: S, frame: fr, index: i,
    prev: i > 0 ? S.frames[i - 1] : null, state: tgt.state, lang, runtime,
    t: Object.assign({}, T), f: FONTS,
    el, rand, rough, plain,
    text: (p, s, x, y, o) => textBlock(ctx, p, [{ text: s == null ? '' : String(s), st: '' }], x, y, o),
    rich: (p, s, x, y, o) => textBlock(ctx, p, parseRich(s), x, y, o),
    measure: (s, o) => { o = Object.assign({ size: 32, font: 'serif', weight: 400 }, o); return measure(String(s), fontOf(o, ''), (o.ls || 0) * o.size); },
    cast: id => {
      const c = (S.cast || []).find(m => m.id === id);
      if (!c) { ctx.issue('warn', `unknown cast id "${id}"`); return { id, name: String(id || '?'), look: {}, hero: false }; }
      return c;
    },
    beat: (e, kind, o) => beat(ctx, e, kind, o),
    anim: (e, kf, o) => anim(ctx, e, kf, o),
    issue: (level, msg) => addIssue(level === 'error' ? 'error' : 'warn', where, String(msg)),
    icon: (p, name, x, y, size, o) => icon(ctx, p, name, x, y, size, o),
    stamp: (p, s, x, y, o) => stamp(ctx, p, s, x, y, o),
    id: (p = 'ct') => `${p}-${++uid}`,
    _anims: [], _ticks: [], _animate: animate,
  };
  return ctx;
}
function placeholder(ctx, err) {
  const { W, H, t } = ctx, fr = ctx.frame, tall = ctx.aspect === 'tall';
  const w = tall ? W * 0.82 : W * 0.56, h = tall ? H * 0.44 : H * 0.58, x = (W - w) / 2, y = (H - h) / 2, p = tall ? 52 : 60;
  const g = el('g', { class: 'ct-placeholder' }, ctx.stage);
  rough(el('rect', { x, y, width: w, height: h, rx: 16, fill: t.paper2, stroke: t.muted, 'stroke-width': 2.4, 'stroke-dasharray': '12 11' }, g), 1);
  ctx.text(g, `${tx.lens} · ${fr.lens || '?'}`, x + p, y + p, { font: 'mono', size: tall ? 26 : 19, ls: 0.16, upper: true, color: 'accent', weight: 500 });
  const head = ctx.text(g, err ? tx.broken : tx.missing, x + p, y + p + 44, { size: tall ? 60 : 52, weight: 500, maxW: w - p * 2, lines: 3, lh: 1.08, ls: -0.01 });
  const gist = fr.headline || fr.big || fr.caption;
  if (gist) ctx.text(g, plain(gist), x + p, head.top + head.h + 22, { font: 'sans', size: tall ? 32 : 25, color: 'ink2', maxW: w - p * 2, lines: 3, lh: 1.4 });
  ctx.text(g, err || tx.soon, x + p, y + h - p + 6, { font: 'mono', size: tall ? 22 : 16, color: 'muted', maxW: w - p * 2, lines: 2, valign: 'bottom', lh: 1.4 });
  ctx.beat(g, 'fade', { at: 60, dy: 8 });
}
function render(tgt, i, asp, animate) {
  tgt.stage.textContent = ''; tgt.over.textContent = ''; tgt.html.textContent = '';
  const [W, H] = SIZES[asp], fr = S.frames[i];
  tgt.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  tgt.html.style.width = W + 'px'; tgt.html.style.height = H + 'px';
  const ctx = makeCtx(tgt, i, asp, animate);
  const lens = lenses[fr.lens];
  try {
    if (!lens) throw Object.assign(new Error(`lens "${fr.lens}" is not registered; placeholder shown (loaded: ${Object.keys(lenses).join(', ') || 'none'})`), { missing: true });
    lens.render(fr, ctx);
  } catch (err) {
    ctx._anims.forEach(a => a.cancel()); ctx._anims.length = 0; ctx._ticks.length = 0;
    tgt.stage.textContent = ''; tgt.html.textContent = '';
    ctx.issue('error', err.missing ? err.message : `render failed: ${err && err.message}`);
    if (!err.missing) console.error(err);
    placeholder(ctx, err.missing ? null : String(err && err.message || err));
  }
  if (fr.stamp) {
    const at = ctx.stampAt || {}, m = asp === 'tall' ? 44 : 56;
    stamp(ctx, tgt.over, fr.stamp, at.x ?? W - m, at.y ?? m + 8, { anchor: at.x == null ? 'end' : 'middle', rotate: at.rotate ?? -4, at: animate ? 700 : null, size: asp === 'tall' ? 26 : 24 });
  }
  if (tgt === OFF) {   // overflow check, only on the still validation render
    for (const g of [tgt.stage, tgt.over]) {
      // a lens may crop on purpose (data-crop: a nested <svg> viewport); getBBox ignores the crop, so skip it
      const crops = [...g.querySelectorAll('[data-crop]')];
      crops.forEach(c => { c.style.display = 'none'; });
      let b; try { b = g.getBBox(); } catch (_) { b = null; }
      crops.forEach(c => { c.style.display = ''; });
      if (!b) continue;
      if (!b.width && !b.height) continue;
      const o = Math.max(-b.x, -b.y, b.x + b.width - W, b.y + b.height - H);
      if (o > 4) ctx.issue('warn', `drawing overflows the ${W}×${H} stage by ${Math.round(o)} units`);
    }
  }
  return ctx;
}
function readMs(fr) {
  return 1600 + 330 * words(plain(fr.caption)) + 200 * words(plain(fr.headline || fr.big || ''));
}
function dwell(i, motionEnd = 1200) {
  const fr = S.frames[i];
  if (+fr.dur > 0) return fr.dur * 1000;
  return clamp(Math.max(readMs(fr), motionEnd + 1800), 3500, 18000);
}
function motionEnd() {
  let end = 0;
  running.forEach(a => { const t = a.effect.getComputedTiming().endTime; if (isFinite(t)) end = Math.max(end, t); });
  return Math.ceil(end);
}
function renderLive(i, animate) {
  running.forEach(a => a.cancel()); running = []; tickers = [];
  if (tickRAF) { cancelAnimationFrame(tickRAF); tickRAF = 0; }
  LIVE.state = state;
  const ctx = render(LIVE, i, aspect, animate);
  running = ctx._anims; tickers = ctx._ticks;
  if (tickers.length) startTick();
}
function show(i, { instant = false, keepState = false } = {}) {
  if (!S) return;
  i = clamp(i, 0, S.frames.length - 1);
  if (i !== cur && !keepState) state = 'after';
  cur = i;
  const animate = !instant && ANIM;
  renderLive(i, animate);
  updateChrome(animate);
  if (!seekMode) {
    try { history.replaceState(null, '', '#' + (i + 1)); } catch (_) { /* sandboxed */ }
    if (playing) schedule();
  }
}
function updateChrome(animate) {
  const fr = S.frames[cur], n = S.frames.length;
  $.cap.innerHTML = richHTML(fr.caption || '');
  $.svg.setAttribute('aria-label', plain(fr.caption || fr.headline || ''));
  $.kickNum.textContent = pad2(cur + 1);
  $.kickTxt.textContent = (fr.kicker || '').toLocaleUpperCase(lang);
  $.kick.classList.toggle('bare', !fr.kicker);
  $.count.innerHTML = `<b>${pad2(cur + 1)}</b> / ${pad2(n)}`;
  $.segs.forEach((s, k) => { s.classList.toggle('done', k < cur); s.classList.toggle('cur', k === cur); s.classList.remove('run'); s.setAttribute('aria-current', k === cur ? 'step' : 'false'); });
  $.prev.disabled = cur === 0;
  $.next.disabled = cur === n - 1 && !LOOP;
  $.chip.hidden = !fr.compare;
  if (fr.compare) {
    const lab = Array.isArray(fr.compareLabels) ? fr.compareLabels : [tx.before, tx.after];
    $.chipB.firstChild.textContent = lab[0]; $.chipA.firstChild.textContent = lab[1];
    $.chipB.setAttribute('aria-pressed', String(state === 'before'));
    $.chipA.setAttribute('aria-pressed', String(state === 'after'));
  }
  $.notesB.textContent = fr.notes || tx.noNotes;
  $.notesB.classList.toggle('empty', !fr.notes);
  const nx = S.frames[cur + 1];
  $.notesN.innerHTML = nx ? `<b>${esc(tx.upNext)}</b>${esc(nx.kicker ? nx.kicker + ' · ' : '')}${esc(plain(nx.caption || nx.headline || ''))}` : `<b>${esc(tx.end)}</b>`;
  if (animate) running.push($.cap.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 480, delay: 140, easing: EASE.out, fill: 'backwards' }));
}

/* ---------- autoplay, modes ---------- */
function updatePlayBtn() {
  $.root.classList.toggle('playing', playing);
  $.playLabel.textContent = playing ? tx.pause : tx.play;
  $.play.setAttribute('aria-label', (playing ? tx.pause : tx.play) + ' (P)');
}
function schedule() {
  clearTimeout(timer);
  if (!playing) return;
  const d = dwell(cur, motionEnd()), seg = $.segs[cur];
  seg.style.setProperty('--dur', d + 'ms'); seg.classList.remove('run'); void seg.offsetWidth; seg.classList.add('run');
  timer = setTimeout(() => {
    if (cur < S.frames.length - 1) show(cur + 1);
    else if (LOOP) show(0);
    else stop();
  }, d);
}
function play() {
  if (!S || seekMode) return;
  playing = true; updatePlayBtn();
  if (cur >= S.frames.length - 1) show(0); else schedule();
}
function stop() {
  playing = false; clearTimeout(timer); updatePlayBtn();
  $.segs.forEach(s => s.classList.remove('run'));
}
function nav(d) {
  const n = S.frames.length;
  let k = cur + d;
  if (k >= n) { if (!LOOP) return; k = 0; }
  if (k < 0) return;
  show(k);
}
function setPresent(v) {
  present = v; notesOpen = v;
  $.root.classList.toggle('present', v);
  setNotes(v);
}
function setNotes(v) {
  notesOpen = v;
  $.notes.hidden = !v;
  $.root.classList.toggle('notes', v);
}
function setState(s) {
  if (!S.frames[cur].compare || s === state) return;
  state = s;
  renderLive(cur, ANIM && !seekMode);
  updateChrome(false);
}
function applyTheme(name) {
  theme = name === 'night' ? 'night' : 'paper';
  const root = document.documentElement;
  root.dataset.theme = theme;
  const cs = getComputedStyle(root), fb = TOKEN_FALLBACK[theme];
  const v = k => hex(cs.getPropertyValue('--' + k)) || fb[k];
  T = { paper: v('paper'), paper2: v('paper2'), ink: v('ink'), ink2: v('ink2'), muted: v('muted'), line: v('line'), ok: v('ok'), warn: v('warn'), error: v('error') };
  T.accent = accentFor(qs.get('accent') || S.accent);
  T.accentSoft = mix(T.accent, T.paper, theme === 'night' ? 0.7 : 0.78);
  root.style.setProperty('--accent', T.accent);
  root.style.setProperty('--accent-soft', T.accentSoft);
  buildDefs();
}
function accentFor(a) {
  const night = theme === 'night';
  if (ACCENTS[a]) return ACCENTS[a][night ? 1 : 0];
  const h = hex(a);
  if (h) return night ? mix(h, '#FFFFFF', 0.22) : h;
  if (a) addIssue('warn', 'story', `unknown accent "${a}" (tomato|blue|green|amber|plum|#hex); using tomato`);
  return ACCENTS.tomato[night ? 1 : 0];
}
function chooseAspect() {
  const q = qs.get('aspect');
  if (q === 'tall' || q === 'wide') return q;
  if (!innerWidth || !innerHeight) return 'wide';   // hidden/headless pane
  return (innerWidth / innerHeight < 0.9 || innerWidth < 560) ? 'tall' : 'wide';
}
function fit() {
  const [W, H] = SIZES[aspect], aw = $.area.clientWidth, ah = $.area.clientHeight;
  if (!aw || !ah) return;
  const s = Math.max(0.05, Math.min(aw / W, ah / H, 1.25));
  const bw = Math.floor(W * s), bh = Math.floor(H * s);
  $.root.style.setProperty('--bw', bw + 'px');
  $.root.style.setProperty('--bh', bh + 'px');
  $.html.style.transform = `scale(${bw / W})`;
}
function setAspect(a) {
  aspect = a;
  $.root.classList.toggle('ct-tall', a === 'tall');
  $.root.classList.toggle('ct-wide', a === 'wide');
}

/* ---------- deterministic time, for recorders ----------
   seek(k, ms) draws frame k exactly as it looks ms after it starts: the frame is rendered with motion
   on, then every registered animation (beats, ctx.anim, the caption) is paused at that time and the
   count/type text is set from the same clock. The first call stops playback and leaves the page in
   this frozen mode (no CSS transitions, no autoplay). */
function seek(k, ms = 0) {
  if (!S) return;
  const i = idx(k);
  if (!seekMode) {
    seekMode = true; ANIM = true; stop();
    if (tickRAF) { cancelAnimationFrame(tickRAF); tickRAF = 0; }
    document.documentElement.classList.add('seeking');
  }
  if (i !== seekI || i !== cur) { show(i, { instant: false }); seekI = i; }
  ms = Math.max(0, +ms || 0);
  running.forEach(a => { a.pause(); a.currentTime = ms; });
  tick();
}
// ms until frame k has finished moving (entrances, beats, caption); infinite loops are ignored
function duration(k) {
  if (!S) return 0;
  seek(k, 0);
  return motionEnd();
}

/* ---------- chrome ---------- */
const ICON_PREV = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 3.5 5.5 9l5.5 5.5"/></svg>';
const ICON_NEXT = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3.5 12.5 9 7 14.5"/></svg>';
const ICON_PLAY = '<svg class="i-play" viewBox="0 0 14 14"><path d="M3 1.8v10.4c0 .5.5.8.9.5l8.2-5.2a.6.6 0 0 0 0-1L3.9 1.3c-.4-.3-.9 0-.9.5z" fill="currentColor"/></svg><svg class="i-pause" viewBox="0 0 14 14"><rect x="2.5" y="1.5" width="3.2" height="11" rx="1" fill="currentColor"/><rect x="8.3" y="1.5" width="3.2" height="11" rx="1" fill="currentColor"/></svg>';
const ICON_PRESENT = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="3.5" width="15" height="10" rx="1.5"/><path d="M10 13.5v3M6.5 16.5h7"/></svg>';
function buildChrome() {
  const root = document.createElement('div');
  root.className = 'ct'; root.id = 'ct';
  root.innerHTML = `
  <nav class="ct-prog" aria-label="${esc(tx.frames)}"></nav>
  <header class="ct-head"><div class="ct-title"><b></b><span></span></div><div class="ct-hint">${tx.hint}</div></header>
  <main class="ct-main">
    <div class="ct-slate"><span class="ct-kick"><em></em><i></i><span></span></span><span class="ct-slate-r"></span></div>
    <div class="ct-area"><div class="ct-box">
      <svg class="ct-svg" xmlns="${NS}" role="img" preserveAspectRatio="xMidYMid meet"><defs></defs><g class="ct-stage"></g><g class="ct-over"></g></svg>
      <div class="ct-html"></div>
    </div></div>
  </main>
  <section class="ct-cap"><p aria-live="polite"></p></section>
  <div class="ct-ctrl">
    <div class="ct-side ct-left"></div>
    <div class="ct-mid">
      <button class="ct-btn" data-act="prev" aria-label="${esc(tx.prev)} (←)">${ICON_PREV}</button>
      <span class="ct-count"></span>
      <button class="ct-btn ct-play" data-act="play">${ICON_PLAY}<span></span></button>
      <button class="ct-btn" data-act="next" aria-label="${esc(tx.next)} (→)">${ICON_NEXT}</button>
    </div>
    <div class="ct-side ct-right">
      <div class="ct-chip" role="group" hidden><button data-state="before" aria-pressed="false">${esc(tx.before)}</button><button data-state="after" aria-pressed="true">${esc(tx.after)} <kbd>D</kbd></button></div>
      <button class="ct-btn ct-ghost" data-act="present" aria-label="${esc(tx.present)}" title="${esc(tx.present)}">${ICON_PRESENT}</button>
    </div>
  </div>
  <aside class="ct-notes" hidden><div class="ct-notes-h">${esc(tx.notes)} · N</div><div class="ct-notes-b"></div><div class="ct-notes-n"></div></aside>
  <svg class="ct-measure" aria-hidden="true"><text></text></svg>
  <div class="ct-off" aria-hidden="true"><svg xmlns="${NS}"><g></g><g></g></svg><div></div></div>`;
  document.body.appendChild(root);
  const q = s => root.querySelector(s);
  Object.assign($, {
    root, prog: q('.ct-prog'), title: q('.ct-title b'), sub: q('.ct-title span'), kick: q('.ct-kick'), kickNum: q('.ct-kick em'),
    kickTxt: q('.ct-kick span'), area: q('.ct-area'), box: q('.ct-box'), svg: q('.ct-svg'), defs: q('.ct-svg defs'),
    html: q('.ct-html'), cap: q('.ct-cap p'), count: q('.ct-count'), prev: q('[data-act="prev"]'), next: q('[data-act="next"]'),
    play: q('[data-act="play"]'), playLabel: q('.ct-play span'), chip: q('.ct-chip'), chipB: q('.ct-chip [data-state="before"]'),
    chipA: q('.ct-chip [data-state="after"]'), notes: q('.ct-notes'), notesB: q('.ct-notes-b'), notesN: q('.ct-notes-n'),
    mtext: q('.ct-measure text'),
  });
  LIVE = { svg: $.svg, stage: q('.ct-stage'), over: q('.ct-over'), html: $.html, state: 'after' };
  const off = q('.ct-off svg');
  OFF = { svg: off, stage: off.children[0], over: off.children[1], html: q('.ct-off > div'), state: 'after' };
  $.title.textContent = S.title || '';
  $.sub.textContent = S.subtitle || '';
  $.segs = S.frames.map((fr, k) => {
    const b = document.createElement('button');
    b.className = 'ct-seg'; b.innerHTML = '<i></i>';
    b.setAttribute('aria-label', `${tx.frame} ${k + 1}${fr.kicker ? ' · ' + fr.kicker : ''}`);
    b.addEventListener('click', () => { stop(); show(k); });
    $.prog.appendChild(b);
    return b;
  });
}
function wire() {
  $.prev.addEventListener('click', () => { stop(); nav(-1); });
  $.next.addEventListener('click', () => { stop(); nav(1); });
  $.play.addEventListener('click', () => (playing ? stop() : play()));
  $.chipB.addEventListener('click', () => setState('before'));
  $.chipA.addEventListener('click', () => setState('after'));
  $.root.querySelector('[data-act="present"]').addEventListener('click', () => setPresent(!present));
  const interactive = t => t.closest && t.closest('input,button,select,textarea,a,label,[data-nonav]');
  let p0 = null;
  $.area.addEventListener('pointerdown', e => { p0 = interactive(e.target) ? null : { x: e.clientX, y: e.clientY }; });
  $.area.addEventListener('pointercancel', () => { p0 = null; });
  $.area.addEventListener('pointerup', e => {
    if (!p0) return;
    const dx = e.clientX - p0.x, dy = e.clientY - p0.y;
    p0 = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) { stop(); nav(dx < 0 ? 1 : -1); return; }
    if (Math.hypot(dx, dy) < 10) { const r = $.box.getBoundingClientRect(); stop(); nav(e.clientX < r.left + r.width * 0.22 ? -1 : 1); }
  });
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const k = e.key;
    if (k === 'ArrowRight' || k === 'PageDown' || k === ' ' || k === 'Enter') {
      if ((k === ' ' || k === 'Enter') && t && t.tagName === 'BUTTON') return;   // let the button act
      e.preventDefault(); stop(); nav(1);
    } else if (k === 'ArrowLeft' || k === 'PageUp' || k === 'Backspace') { e.preventDefault(); stop(); nav(-1); }
    else if (k === 'Home') { stop(); show(0); }
    else if (k === 'End') { stop(); show(S.frames.length - 1); }
    else if (/^[1-9]$/.test(k)) { const i = +k - 1; if (i < S.frames.length) { stop(); show(i); } }
    else if (k === 'p' || k === 'P') playing ? stop() : play();
    else if (k === 'f' || k === 'F') setPresent(!present);
    else if (k === 'n' || k === 'N') setNotes(!notesOpen);
    else if (k === 'd' || k === 'D') setState(state === 'after' ? 'before' : 'after');
    else if (k === 't' || k === 'T') { applyTheme(theme === 'paper' ? 'night' : 'paper'); renderLive(cur, false); }
    else if (k === 'Escape' && present) setPresent(false);
  });
  addEventListener('hashchange', () => {
    const k = parseInt(location.hash.slice(1), 10) - 1;
    if (k >= 0 && k < S.frames.length && k !== cur) { stop(); show(k); }
  });
  addEventListener('resize', () => {
    const a = chooseAspect();
    if (a !== aspect) { setAspect(a); seekI = -1; renderLive(cur, false); }
    fit();
  });
  new ResizeObserver(fit).observe($.area);
}

/* ---------- boot ---------- */
async function loadFonts() {
  if (!document.fonts || !document.fonts.load) return;
  const sample = JSON.stringify(S).slice(0, 4000) + ' ğüşıöçİĞÜŞÖÇ₺→×·';
  const specs = ['400 32px Newsreader', '500 32px Newsreader', '600 32px Newsreader', 'italic 400 32px Newsreader', 'italic 500 32px Newsreader',
    '400 20px "IBM Plex Sans"', '500 20px "IBM Plex Sans"', '600 20px "IBM Plex Sans"', 'italic 400 20px "IBM Plex Sans"',
    '400 20px "IBM Plex Mono"', '500 20px "IBM Plex Mono"', '400 20px "Shantell Sans"', '600 20px "Shantell Sans"'];
  let timedOut = false;
  const all = Promise.all(specs.map(s => document.fonts.load(s, sample).catch(() => null)));
  await Promise.race([all, new Promise(r => setTimeout(() => { timedOut = true; r(); }, 3500))]);
  if (timedOut) {
    addIssue('warn', 'fonts', 'fonts did not load in time (offline?); fallback fonts used');
    all.then(() => { mcache.clear(); if (cur >= 0 && !seekMode) renderLive(cur, false); });
  }
}
function validate() {
  for (const asp of ['wide', 'tall']) S.frames.forEach((fr, i) => {
    for (const st of fr.compare ? ['after', 'before'] : ['after']) { OFF.state = st; render(OFF, i, asp, false); }
  });
  OFF.stage.textContent = ''; OFF.over.textContent = ''; OFF.html.textContent = ''; OFF.state = 'after';
}
async function boot(story) {
  if (S) return chalk.ready;
  try {
    if (typeof story === 'string') story = JSON.parse(story);
    if (!story || !Array.isArray(story.frames) || !story.frames.length) throw new Error('story needs a non-empty "frames" array');
  } catch (err) { fatal('story could not be read: ' + err.message); return chalk.ready; }
  S = story;
  S.frames = S.frames.map((fr, i) => {
    if (!fr || typeof fr !== 'object') { addIssue('error', `frame ${i + 1}`, 'frame is not an object'); return { lens: '?' }; }
    if (!fr.lens) addIssue('error', `frame ${i + 1}`, 'frame has no "lens"');
    const n = words(plain(fr.caption));
    if (n > 20) addIssue('warn', `frame ${i + 1}`, `caption has ${n} words (≤ 20)`);
    return fr;
  });
  lang = String(S.lang || 'en');
  tx = L10N[lang.slice(0, 2).toLowerCase()] || L10N.en;
  seed = (hashStr(S.title || 'chalk-talk') % 997) + 1;
  runtime = Math.round(S.frames.reduce((a, fr, i) => a + dwell(i), 0) / 1000);
  document.documentElement.lang = lang;
  document.title = S.title ? S.title + (S.subtitle ? ' · ' + S.subtitle : '') : 'chalk-talk';
  buildChrome();
  if (!ANIM) document.documentElement.classList.add('still');
  applyTheme(qs.get('theme') || S.theme || 'paper');
  setAspect(chooseAspect());
  updatePlayBtn();
  await loadFonts();
  validate();
  fit();
  const h = parseInt(location.hash.slice(1), 10);
  show(h >= 1 && h <= S.frames.length ? h - 1 : 0, { instant: !ANIM });
  wire();
  if (qs.has('present')) setPresent(true);
  if (qs.has('play') && ANIM) play();
  publish();
  document.documentElement.dataset.chalk = 'ready';
  readyResolve(chalk);
  return chalk.ready;
}
// built pages carry the story inline; dev.html calls chalk.boot(story) itself
function autoBoot() {
  const node = document.getElementById('story');
  if (node && !S) boot(node.textContent);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoBoot); else setTimeout(autoBoot, 0);
})();
