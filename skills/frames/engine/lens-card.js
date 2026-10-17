/* chalk-talk frames · lens-card: number, whatif, compare, screen, timeline
 *
 * The editorial lenses (Dan Roam's "how much", "what if", "why / what changes", "what it looks like", "when").
 * Fields (SPEC.md):
 *  number   big ("1.240 ₺", "%31", "3,1 milyon"), label, sub, who (cast id → small head byline),
 *           viz { kind: bars | dots | line | donut | icons, data: [{ label, value, accent }], unit, format, icon }
 *  whatif   headline, vars [{ id, label, min, max, step, value, unit }], outputs [{ label, expr, format, accent }],
 *           viz (as number, but data items may carry `expr` instead of `value`; redrawn live)
 *  compare  left / right { label, tone: muted | accent, lines (≤3), art: icon name | { icon } | { people, props } },
 *           or before / after { label, lines, people, props } (drawn as muted / accent sides)
 *  screen   device: phone | laptop, ui [{ type, text, items, label, value, sub, accent }], annotate [{ at, text }]
 *  timeline items [{ when, what, accent }] (≤ 6)
 * Extras: viz.format ('₺' | '%' | 'n' | 'x') formats data values; outputs[].accent picks the accent tile
 * (default: the last output); viz.icon picks the icons-kind glyph (default person).
 * Whatif expressions: numbers, var ids, + - * / ( ), unary minus; × · ÷ − – are accepted as aliases. Never eval'd.
 */
(function () {
  'use strict';

  const WORDS = {
    tr: { before: 'Önce', after: 'Sonra' },
    en: { before: 'Before', after: 'After' },
  };
  const words = ctx => WORDS[String(ctx.lang).slice(0, 2)] || WORDS.en;
  const isTall = ctx => ctx.aspect === 'tall';
  const arr = v => (Array.isArray(v) ? v : v == null ? [] : [v]);
  const fin = v => typeof v === 'number' && isFinite(v);
  const str = v => (v == null ? '' : String(v));

  /* ---------- numbers ---------- */
  const NF = new Map();
  function nf(lang, o) {
    const k = lang + '|' + JSON.stringify(o || {});
    let f = NF.get(k);
    if (!f) { try { f = new Intl.NumberFormat(lang, o); } catch (_) { f = new Intl.NumberFormat('en', o); } NF.set(k, f); }
    return f;
  }
  // ₺ → "1.240 ₺" (tr) / "1,240 ₺" (en); % → "%31" (tr) / "31%" (en); x → "2,5×"; n → plain
  // $ € £ → Intl currency in the story lang ("$1,240", "1.240 €"); "currency" + an ISO `currency` code ("JPY")
  // a trailing "k" ("$k", "₺k", "nk"), format "compact" or compact: true → short compact ("$22k", "3,1 mn ₺"); ≥ 1e6 is always compact
  const CUR = { $: 'USD', '€': 'EUR', '£': 'GBP', '₺': 'TRY' };
  const isFmt = f => /^((\$|€|£|₺|%|x|×|n|currency)k?|compact)$/.test(str(f));
  const spec = o => (o && typeof o === 'object' ? { format: o.format, currency: o.currency, compact: o.compact } : { format: o });
  function fmt(v, f, lang) {
    if (!fin(v)) return '—';
    f = spec(f);
    let format = str(f.format || 'n'), short = !!f.compact;
    if (format === 'compact') format = 'nk';
    if (format.length > 1 && format.endsWith('k')) { format = format.slice(0, -1); short = true; }
    const big = Math.abs(v) >= 1e6;
    const c = short && Math.abs(v) >= 1e3 ? { notation: 'compact', compactDisplay: 'short', maximumFractionDigits: Math.abs(v) < 1e4 || big ? 1 : 0 }
      : big ? { notation: 'compact', compactDisplay: 'long', maximumFractionDigits: 1 } : null;
    const tidy = s => s.replace(/(\d)\s?K\b/, '$1k').replace(/\bMn\b/, 'mn').replace(/\bMr\b/, 'mr').replace(/(\d) B\b/, '$1 b');   // "$22k", "3,1 mn"
    const code = format === 'currency' ? str(f.currency).toUpperCase() : CUR[format];
    switch (format) {
      case '%': return nf(lang, { style: 'percent', maximumFractionDigits: Math.abs(v) < 10 && v % 1 ? 1 : 0 }).format(v / 100);
      case 'x': case '×': return nf(lang, { maximumFractionDigits: 1 }).format(v) + '×';
      case '₺': return tidy(nf(lang, c || { maximumFractionDigits: 0 }).format(v)) + ' ₺';   // Turkish style, symbol after, in every lang
      case 'n': return tidy(nf(lang, c || { maximumFractionDigits: Math.abs(v) < 100 ? 1 : 0 }).format(v));
      default: {
        if (!/^[A-Z]{3}$/.test(code || '')) return fmt(v, Object.assign({}, f, { format: short ? 'nk' : 'n' }), lang);
        const o = Object.assign({ style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }, c || { maximumFractionDigits: Math.abs(v) < 100 && v % 1 ? 2 : 0 });
        return tidy(nf(lang, o).format(v));
      }
    }
  }
  function fmtUnit(v, unit, lang) {
    if (isFmt(unit)) return fmt(v, unit, lang);
    return fmt(v, 'n', lang) + (unit ? ' ' + unit : '');
  }

  /* ---------- whatif expressions: a tiny recursive-descent parser, never eval ---------- */
  function compile(src, ids) {
    const s = str(src).replace(/[×·]/g, '*').replace(/[−–]/g, '-').replace(/÷/g, '/');
    const toks = s.match(/\d+(?:\.\d+)?|\.\d+|[A-Za-z_]\w*|[-+*/()]|\S/g) || [];
    let p = 0;
    const bad = () => { throw new Error(p >= toks.length ? 'ends early' : `unexpected "${toks[p]}"`); };
    const prim = () => {
      const tk = toks[p];
      if (tk == null) bad();
      if (/^[\d.]/.test(tk)) { p++; const n = +tk; return () => n; }
      if (/^[A-Za-z_]/.test(tk)) {
        if (!ids.includes(tk)) throw new Error(`unknown var "${tk}" (vars: ${ids.join(', ') || 'none'})`);
        p++; return e => e[tk];
      }
      if (tk === '(') { p++; const f = add(); if (toks[p] !== ')') bad(); p++; return f; }
      if (tk === '-') { p++; const f = prim(); return e => -f(e); }
      if (tk === '+') { p++; return prim(); }
      return bad();
    };
    const bin = (next, ops) => () => {
      let l = next();
      while (ops.includes(toks[p])) {
        const op = toks[p++], a = l, b = next();
        l = op === '+' ? e => a(e) + b(e) : op === '-' ? e => a(e) - b(e) : op === '*' ? e => a(e) * b(e) : e => a(e) / b(e);
      }
      return l;
    };
    const mul = bin(prim, ['*', '/']), add = bin(mul, ['+', '-']);
    if (!toks.length) throw new Error('is empty');
    const fn = add();
    if (p < toks.length) bad();
    return fn;
  }

  /* ---------- shared ink pieces ---------- */
  function swash(ctx, parent, x0, x1, y, th, seed) {   // same brush stroke as the title lens
    const r = ctx.rand('swash-' + seed), w = x1 - x0, lift = th * (0.5 + r() * 0.6);
    const d = `M${x0} ${y + th * 0.25}`
      + `C${x0 + w * 0.3} ${y - th * 0.35} ${x0 + w * 0.68} ${y - th * 0.55 - lift} ${x1} ${y - lift - th * 0.15}`
      + `C${x1 - w * 0.02} ${y - lift + th * 0.35} ${x0 + w * 0.7} ${y + th * 0.25 - lift * 0.4} ${x0 + w * 0.32} ${y + th * 0.75}`
      + `C${x0 + w * 0.15} ${y + th * 0.95} ${x0 + w * 0.04} ${y + th * 0.85} ${x0} ${y + th * 0.25}Z`;
    return ctx.rough(ctx.el('path', { d, fill: ctx.t.accent, opacity: 0.92 }, parent), 1);
  }
  function headline(ctx, parent, src, x, y, o) {
    const hl = ctx.rich(parent, src, x, y, Object.assign({ weight: 500, lh: 1.04, ls: -0.018, balance: true }, o));
    const sw = hl.runs.filter(r => r.st === 'em' && r.w > 0).map((r, k) =>
      swash(ctx, parent, r.x - hl.size * 0.02, r.x + r.w + hl.size * 0.04, r.y + hl.size * 0.17, hl.size * 0.07, `${ctx.index}-${k}`));
    return { hl, sw };
  }
  const hair = (ctx, d, extra = '') => `<path d="${d}" fill="${ctx.t.ink}"${extra}/>`;
  const CAP = 'M-1 -.1A1 1 0 0 1 1 -.1C.75 -.5 .25 -.62 -.25 -.56C-.6 -.5 -.85 -.36 -1 -.1Z';
  const HAIRS = {   // face radius 1, centre 0 0; [behind the face, over the face]
    short: ctx => ['', hair(ctx, CAP)],
    bob: ctx => [hair(ctx, 'M-1.24 .8V-.25A1.24 1.24 0 0 1 1.24 -.25V.8Q1.24 1 1.04 1H-1.04Q-1.24 1 -1.24 .8Z'), hair(ctx, 'M-1 .02A1 1 0 0 1 1 .02C.6 -.4 -.25 -.42 -1 .02Z')],
    long: ctx => [hair(ctx, 'M-1.2 -.15A1.2 1.2 0 0 1 1.2 -.15L1.36 1.6H-1.36Z'), hair(ctx, 'M-1 .1A1 1 0 0 1 1 .1C.72 -.36 .22 -.46 0 -.72C-.22 -.46 -.72 -.36 -1 .1Z')],
    curly: ctx => ['', [[-0.74, -0.66, 0.38], [-0.28, -0.92, 0.4], [0.22, -0.94, 0.4], [0.68, -0.7, 0.38], [0.98, -0.28, 0.28], [-1.0, -0.26, 0.28]]
      .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${ctx.t.ink}"/>`).join('')],
    beanie: (ctx, sw) => ['', `<path d="M-1.02 -.3C-1.02 -1.42 1.02 -1.42 1.02 -.3Z" fill="${ctx.t.ink2}" stroke="${ctx.t.ink}" stroke-width="${sw}"/><rect x="-1.14" y="-.46" width="2.28" height=".34" rx=".12" fill="${ctx.t.ink2}" stroke="${ctx.t.ink}" stroke-width="${sw}"/><circle cx="0" cy="-1.24" r=".2" fill="${ctx.t.ink2}" stroke="${ctx.t.ink}" stroke-width="${sw}"/>`],
    bun: ctx => [`<circle cx="0" cy="-1.12" r=".38" fill="${ctx.t.ink}"/>`, hair(ctx, CAP)],
    ponytail: ctx => [hair(ctx, 'M.62 -.66C1.62 -.66 1.62 .62 1.26 1C1.1 .42 1.02 -.08 .7 -.3Z'), hair(ctx, CAP)],
    cap: (ctx, sw) => ['', `<path d="M-1.04 -.22C-1.04 -1.3 1.04 -1.3 1.04 -.22Z" fill="${ctx.t.ink2}" stroke="${ctx.t.ink}" stroke-width="${sw}"/><path d="M-1.04 -.22H1.62Q1.56 .02 1.1 .02H-1.04Z" fill="${ctx.t.ink2}" stroke="${ctx.t.ink}" stroke-width="${sw}"/>`],
    bald: () => ['', ''],
  };
  const MOUTH = {
    happy: 'M-.34 .4Q0 .72 .34 .4', neutral: 'M-.22 .5H.22', sad: 'M-.28 .6Q0 .4 .28 .6',
    annoyed: 'M-.24 .54L.24 .48', tired: 'M-.2 .52H.2', smile: 'M-.28 .44Q0 .62 .28 .44',
  };
  // a cast head: round face, hair from look.hair, dot eyes; optional shoulders. Same spirit as the moment lens.
  function head(ctx, parent, member, cx, cy, r, o = {}) {
    const t = ctx.t, look = (member && member.look) || {}, sw = (o.sw || 2.6) / r;
    const [back, front] = (HAIRS[look.hair] || HAIRS.short)(ctx, sw);
    const mood = o.mood || 'smile';
    let s = '';
    if (o.body !== false) s += `<path d="M-1.75 2.7C-1.75 1.62 -1.02 1.06 0 1.06S1.75 1.62 1.75 2.7Z" fill="${o.bodyFill || t.line}" stroke="${t.ink}" stroke-width="${sw}"/>`;
    s += back + `<circle r="1" fill="${t.paper2}" stroke="${t.ink}" stroke-width="${sw}"/>` + front;
    if (mood === 'tired') s += `<path d="M-.5 .12H-.22M.22 .12H.5" stroke="${t.ink}" stroke-width="${sw}" fill="none"/>`;
    else s += `<circle cx="-.36" cy=".12" r=".1" fill="${t.ink}"/><circle cx=".36" cy=".12" r=".1" fill="${t.ink}"/>`;
    if (mood === 'annoyed') s += `<path d="M-.55 -.16L-.2 -.06M.55 -.16L.2 -.06" stroke="${t.ink}" stroke-width="${sw}" fill="none"/>`;
    s += mood === 'surprised' ? `<ellipse cx="0" cy=".52" rx=".11" ry=".14" fill="${t.ink}"/>`
      : `<path d="${MOUTH[mood] || MOUTH.smile}" fill="none" stroke="${t.ink}" stroke-width="${sw}"/>`;
    if (look.glasses) s += `<g fill="none" stroke="${t.ink}" stroke-width="${sw}"><circle cx="-.36" cy=".12" r=".27"/><circle cx=".36" cy=".12" r=".27"/><path d="M-.09 .1H.09"/></g>`;
    const g = ctx.el('g', { transform: `translate(${cx} ${cy}) scale(${r})`, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'ct-head' }, parent);
    g.innerHTML = s;
    if (r * sw >= 2.5) ctx.rough(g, 1);
    return g;
  }
  const findCast = (ctx, key) => {
    const k = str(key).trim().toLowerCase();
    return (ctx.story.cast || []).find(m => str(m.id).toLowerCase() === k || str(m.name).toLowerCase() === k) || null;
  };

  /* ---------- viz: bars | dots | line | donut | icons, one accent datum ---------- */
  // neutral data tones: paper → ink steps, so they read in both themes (the line token vanishes at night)
  function mix(a, b, k) {
    const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const A = p(a), B = p(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('');
  }
  function tones(ctx) { const t = ctx.t; return [0.2, 0.42, 0.62, 0.1].map(k => mix(t.paper, t.ink, k)); }
  function fills(ctx, data) { let k = 0; const tn = tones(ctx); return data.map(d => (d.accent ? ctx.t.accent : tn[k++ % tn.length])); }
  function vizData(ctx, viz) {
    return arr(viz && viz.data).filter(d => d && typeof d === 'object').map(d => ({ label: str(d.label), value: +d.value, accent: !!d.accent, expr: d.expr }));
  }
  function legend(ctx, g, data, cols, x, y, w, o) {
    const tall = isTall(ctx), fs = tall ? 27 : 19, sq = fs * 0.8, gap = fs * 1.4;
    const items = data.map((d, k) => ({ d, k, text: d.label + (o.values === false ? '' : ' · ' + fmt(d.value, o.format, ctx.lang)) }));
    items.forEach(it => { it.w = sq + 10 + Math.min(ctx.measure(it.text, { font: 'sans', size: fs, weight: it.d.accent ? 600 : 400 }), w - sq - 10); });
    const rows = [[]]; let rw = 0;
    items.forEach(it => { if (rw && rw + gap + it.w > w) { rows.push([]); rw = 0; } rows[rows.length - 1].push(it); rw += (rw ? gap : 0) + it.w; });
    rows.forEach((row, ri) => {
      const tw = row.reduce((a, it) => a + it.w, 0) + gap * (row.length - 1);
      let cx = x + (w - tw) / 2;
      const cy = y + ri * fs * 1.7;
      row.forEach(it => {
        ctx.el('rect', { x: cx, y: cy + (fs * 1.2 - sq) / 2, width: sq, height: sq, rx: sq * 0.25, fill: cols[it.k], stroke: ctx.t.ink, 'stroke-width': 1.6 }, g);
        ctx.text(g, it.text, cx + sq + 10, cy, { font: 'sans', size: fs, color: it.d.accent ? 'ink' : 'ink2', weight: it.d.accent ? 600 : 400, maxW: w - sq - 10, lines: 1, lh: 1.2 });
        cx += it.w + gap;
      });
    });
    return rows.length * fs * 1.7;
  }
  function legendH(ctx, data) { return (isTall(ctx) ? 27 : 19) * 1.7 * (data.length > 3 ? 2 : 1); }

  function viz(ctx, g, kind, data, b, o) {
    if (!data.length) return;
    o = Object.assign({ beats: true, at: 0 }, o);
    const fn = { bars, dots, line, donut, icons }[kind];
    if (!fn) { ctx.issue('warn', `unknown viz kind "${kind}" (bars | dots | line | donut | icons); drew bars`); return bars(ctx, g, data, b, o); }
    return fn(ctx, g, data, b, o);
  }
  function unitLine(ctx, g, o, b) {
    if (!o.unit) return 0;
    const fs = isTall(ctx) ? 26 : 18;
    ctx.text(g, o.unit, b.x, b.y, { font: 'mono', size: fs, ls: 0.12, upper: true, color: 'ink2', maxW: b.w, lines: 1, weight: 500 });
    return fs * 2.4;
  }
  function bars(ctx, g, data, b, o) {
    // bars are told apart by position, so every non-accent bar shares one neutral tone and the accent datum stands out
    const t = ctx.t, tall = isTall(ctx), fs = tall ? 28 : 20, vs = tall ? 32 : 24, n = data.length, neutral = tones(ctx)[0], cols = data.map(d => (d.accent ? t.accent : neutral));
    const top = unitLine(ctx, g, o, b), labH = fs * 1.25 * 2 + 18, valH = vs * 1.6;
    const max = o.max || Math.max(0, ...data.map(d => d.value)) || 1;
    const slot = b.w / n, bw = Math.min(tall ? 170 : 140, slot * 0.6), y0 = b.y + b.h - labH, hMax = Math.max(40, b.h - labH - valH - top);
    const base = ctx.rough(ctx.el('path', { d: `M${b.x} ${y0}H${b.x + b.w}`, stroke: t.ink, 'stroke-width': 3, 'stroke-linecap': 'round', fill: 'none' }, g), 1);
    if (o.beats) ctx.beat(base, 'draw', { at: o.at, dur: 600 });
    data.forEach((d, k) => {
      const cx = b.x + slot * (k + 0.5), h = Math.max(3, Math.min(hMax, Math.max(0, d.value) / max * hMax));
      const bar = ctx.rough(ctx.el('rect', { x: cx - bw / 2, y: y0 - h, width: bw, height: h, fill: cols[k], stroke: t.ink, 'stroke-width': 2.8, 'stroke-linejoin': 'round' }, g), 1);
      const val = ctx.text(g, fmt(d.value, o.format, ctx.lang), cx, y0 - h - 12, { font: 'mono', size: vs, weight: d.accent ? 600 : 500, color: d.accent ? 'accent' : 'ink', anchor: 'middle', valign: 'bottom', maxW: slot - 8, lines: 1 });
      const lab = ctx.text(g, d.label, cx, y0 + 16, { font: 'sans', size: fs, weight: d.accent ? 600 : 400, color: d.accent ? 'ink' : 'ink2', anchor: 'middle', maxW: slot - 12, lines: 2, lh: 1.25 });
      if (o.beats) {
        ctx.beat(bar, 'grow', { at: o.at + 200 + k * 140, dur: 900, from: 'bottom' });
        ctx.beat(val.el, 'fade', { at: o.at + 800 + k * 140, dy: 8 });
        ctx.beat(lab.el, 'fade', { at: o.at + 100, dy: 0 });
      }
    });
  }
  function shares(data, total) {   // largest remainder → integers summing to `total`
    const sum = data.reduce((a, d) => a + Math.max(0, d.value), 0) || 1;
    const raw = data.map(d => Math.max(0, d.value) / sum * total), out = raw.map(Math.floor);
    let left = total - out.reduce((a, v) => a + v, 0);
    raw.map((v, k) => [v - Math.floor(v), k]).sort((a, z) => z[0] - a[0]).forEach(([, k]) => { if (left > 0) { out[k]++; left--; } });
    return out;
  }
  function dots(ctx, g, data, b, o) {
    const t = ctx.t, cols = fills(ctx, data), top = unitLine(ctx, g, o, b), lh = legendH(ctx, data) + 24;
    const sum = data.reduce((a, d) => a + Math.max(0, d.value), 0);
    const counts = sum <= 100 && data.every(d => Number.isInteger(d.value)) ? data.map(d => Math.max(0, d.value)) : shares(data, 100);
    const grid = Math.min(b.w, b.h - lh - top), cell = grid / 10, x0 = b.x + (b.w - grid) / 2, y0 = b.y + top;
    const dg = ctx.rough(ctx.el('g', {}, g), 1), rest = ctx.el('g', {}, dg);
    let i = 0, pops = 0;
    data.forEach((d, k) => {
      for (let c = 0; c < counts[k] && i < 100; c++, i++) {
        const r = ctx.el('rect', { x: x0 + (i % 10) * cell + cell * 0.11, y: y0 + Math.floor(i / 10) * cell + cell * 0.11, width: cell * 0.78, height: cell * 0.78, rx: cell * 0.2, fill: cols[k], stroke: d.accent ? t.ink : 'none', 'stroke-width': 2 }, d.accent ? dg : rest);
        if (o.beats && d.accent) ctx.beat(r, 'pop', { at: o.at + 300 + (pops++) * 16, dur: 360 });
      }
    });
    for (; i < 100; i++) ctx.el('rect', { x: x0 + (i % 10) * cell + cell * 0.13, y: y0 + Math.floor(i / 10) * cell + cell * 0.13, width: cell * 0.74, height: cell * 0.74, rx: cell * 0.2, fill: 'none', stroke: t.line, 'stroke-width': 2 }, rest);
    if (o.beats) ctx.beat(rest, 'fade', { at: o.at + 100, dy: 0 });
    const lg = ctx.el('g', {}, g);
    legend(ctx, lg, data.map((d, k) => Object.assign({}, d, { value: counts[k] })), cols, b.x, y0 + grid + 24, b.w, { format: o.format || 'n', values: true });
    if (o.beats) ctx.beat(lg, 'fade', { at: o.at + 500, dy: 6 });
  }
  function line(ctx, g, data, b, o) {
    const t = ctx.t, tall = isTall(ctx), fs = tall ? 26 : 19, vs = tall ? 30 : 23, n = data.length;
    const top = unitLine(ctx, g, o, b) + vs * 1.6, bot = fs * 2.2;
    const vals = data.map(d => d.value);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    // honest by default: the y axis includes 0; "zero": false zooms to the data and the axis gets a break mark
    const cut = o.zero === false;
    if (cut) { const span = hi - lo || Math.abs(hi) || 1; lo -= span * 0.15; hi += span * 0.02; } else { lo = Math.min(0, lo); hi = Math.max(0, hi); }
    if (hi === lo) { hi += 1; lo -= 1; }
    const pad = b.w * 0.06, X = k => b.x + pad + (n > 1 ? k / (n - 1) : 0.5) * (b.w - pad * 2);
    const y1 = b.y + b.h - bot, Y = v => y1 - (v - lo) / (hi - lo) * (y1 - b.y - top);
    const ay = lo < 0 && hi > 0 ? Y(0) : y1;
    ctx.el('path', { d: `M${b.x} ${ay}H${b.x + b.w}`, stroke: t.ink, 'stroke-width': 1.8, opacity: 0.45, fill: 'none' }, g);
    if (cut) {   // two slanted ink strokes across the axis, paper between them
      const bx = b.x + Math.min(22, pad * 0.5), k = tall ? 1.3 : 1;
      ctx.el('path', { d: `M${bx - 7 * k} ${y1 + 11 * k}L${bx + 1 * k} ${y1 - 11 * k}H${bx + 9 * k}L${bx + 1 * k} ${y1 + 11 * k}Z`, fill: t.paper, stroke: 'none' }, g);
      ctx.el('path', { d: `M${bx - 7 * k} ${y1 + 11 * k}L${bx + 1 * k} ${y1 - 11 * k}M${bx + 1 * k} ${y1 + 11 * k}L${bx + 9 * k} ${y1 - 11 * k}`, stroke: t.ink, 'stroke-width': 2.6, 'stroke-linecap': 'round', fill: 'none', class: 'ct-axis-break' }, g);
    }
    const pts = data.map((d, k) => [X(k), Y(d.value)]);
    const ln = ctx.rough(ctx.el('path', { d: 'M' + pts.map(p => p.map(v => v.toFixed(1)).join(' ')).join('L'), stroke: t.ink, 'stroke-width': 4, fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g), 1);
    if (o.beats) ctx.beat(ln, 'draw', { at: o.at + 200, dur: 1300 });
    let mark = data.findIndex(d => d.accent);
    if (mark < 0) mark = n - 1;
    const every = n <= 7;
    data.forEach((d, k) => {
      const [x, y] = pts[k], hot = k === mark && data[k].accent;
      const dot = ctx.el('circle', { cx: x, cy: y, r: hot ? 13 : 6.5, fill: hot ? t.accent : t.paper2, stroke: t.ink, 'stroke-width': hot ? 3 : 2.6 }, g);
      if (o.beats) ctx.beat(dot, hot ? 'pop' : 'fade', { at: o.at + 200 + (n > 1 ? k / (n - 1) : 0) * 1300, dur: hot ? 520 : 300, dy: 0 });
      if (every || k === 0 || k === n - 1 || k === mark) {
        const lab = ctx.text(g, d.label, x, y1 + 14, { font: 'sans', size: fs, color: k === mark ? 'ink' : 'ink2', weight: k === mark ? 600 : 400, anchor: k === 0 && !every ? 'start' : k === n - 1 && !every ? 'end' : 'middle', maxW: every ? (b.w - pad * 2) / Math.max(1, n - 1) : b.w / 3, lines: 1 });
        if (o.beats) ctx.beat(lab.el, 'fade', { at: o.at + 100, dy: 0 });
      }
      if (k === mark) {
        const vl = ctx.text(g, fmt(d.value, o.format, ctx.lang), x, y - (hot ? 26 : 18), { font: 'mono', size: vs, weight: 600, color: hot ? 'accent' : 'ink', anchor: k === n - 1 && n > 1 ? 'end' : k === 0 && n > 1 ? 'start' : 'middle', valign: 'bottom', lines: 1 });
        if (o.beats) ctx.beat(vl.el, 'fade', { at: o.at + 1500, dy: 8 });
      }
    });
  }
  function donut(ctx, g, data, b, o) {
    const t = ctx.t, tall = isTall(ctx), cols = fills(ctx, data), top = unitLine(ctx, g, o, b);
    const side = !tall && b.w > (b.h - top) * 1.45, lw = side ? b.w * 0.42 : b.w;
    const lh = side ? 0 : legendH(ctx, data) + 30;
    const r = Math.min((side ? b.w - lw - 30 : b.w) / 2, (b.h - top - lh) / 2) * 0.84, sw = r * 0.34;
    const cx = side ? b.x + (b.w - lw - 30) / 2 : b.x + b.w / 2, cy = b.y + top + (b.h - top - lh) / 2;
    const total = data.reduce((a, d) => a + Math.max(0, d.value), 0) || 1, gap = data.length > 1 ? 0.035 : 0;
    let a0 = -Math.PI / 2, cum = 0;
    const P = a => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
    data.forEach((d, k) => {
      const share = Math.max(0, d.value) / total, a1 = a0 + share * Math.PI * 2;
      if (share > 0) {
        const s0 = a0 + gap / 2, s1 = Math.max(s0 + 0.01, a1 - gap / 2);
        const seg = ctx.rough(ctx.el('path', { d: share >= 0.999 ? `M${P(-Math.PI / 2)}A${r} ${r} 0 1 1 ${P(Math.PI * 1.5 - 0.001)}` : `M${P(s0)}A${r} ${r} 0 ${s1 - s0 > Math.PI ? 1 : 0} 1 ${P(s1)}`, stroke: cols[k], 'stroke-width': sw, fill: 'none' }, g), 1);
        if (o.beats) ctx.beat(seg, 'draw', { at: o.at + 200 + cum * 1100, dur: Math.max(250, share * 1100) });
      }
      cum += share; a0 = a1;
    });
    ctx.el('circle', { cx, cy, r: r + sw / 2, fill: 'none', stroke: t.ink, 'stroke-width': 1.6, opacity: 0.35 }, g);
    ctx.el('circle', { cx, cy, r: r - sw / 2, fill: 'none', stroke: t.ink, 'stroke-width': 1.6, opacity: 0.35 }, g);
    const hot = data.find(d => d.accent) || data[0];
    const cg = ctx.el('g', {}, g);
    const v = ctx.text(cg, fmt(hot.value, o.format, ctx.lang), cx, cy + r * 0.06, { font: 'serif', size: r * 0.42, weight: 500, color: hot.accent ? 'accent' : 'ink', anchor: 'middle', valign: 'bottom', maxW: (r - sw / 2) * 1.7, minSize: r * 0.2, lines: 1, ls: -0.02 });
    ctx.text(cg, hot.label, cx, v.top + v.h + 4, { font: 'sans', size: tall ? 26 : 19, color: 'ink2', anchor: 'middle', maxW: (r - sw / 2) * 1.5, lines: 2, lh: 1.2 });
    if (o.beats) ctx.beat(cg, 'fade', { at: o.at + 900, dy: 6 });
    const lg = ctx.el('g', {}, g);
    if (side) {
      const fs = tall ? 27 : 20, lx = b.x + b.w - lw;
      let ly = cy - data.length * fs * 1.9 / 2;
      data.forEach((d, k) => {
        ctx.el('rect', { x: lx, y: ly + fs * 0.2, width: fs * 0.85, height: fs * 0.85, rx: fs * 0.2, fill: cols[k], stroke: t.ink, 'stroke-width': 1.6 }, lg);
        ctx.text(lg, d.label, lx + fs * 1.4, ly, { font: 'sans', size: fs, weight: d.accent ? 600 : 400, color: d.accent ? 'ink' : 'ink2', maxW: lw - fs * 1.4 - 110, lines: 1 });
        ctx.text(lg, fmt(d.value, o.format, ctx.lang), lx + lw, ly, { font: 'mono', size: fs, weight: 500, color: d.accent ? 'accent' : 'ink', anchor: 'end', lines: 1 });
        ly += fs * 1.9;
      });
    } else legend(ctx, lg, data, cols, b.x, cy + r + sw / 2 + 30, b.w, { format: o.format });
    if (o.beats) ctx.beat(lg, 'fade', { at: o.at + 500, dy: 6 });
  }
  function icons(ctx, g, data, b, o) {
    const top = unitLine(ctx, g, o, b), lh = legendH(ctx, data) + 26;
    let counts = data.map(d => Math.max(0, Math.round(d.value)));
    let total = counts.reduce((a, v) => a + v, 0);
    if (total > 40) { counts = shares(data, 20); total = 20; }
    if (!total) return;
    const tn = [ctx.t.paper2, ctx.t.line, ctx.t.muted];
    let nk = 0;
    const cols = data.map(d => (d.accent ? ctx.t.accent : tn[nk++ % tn.length]));
    const perRow = total <= 10 ? total : Math.ceil(total / Math.ceil(total / 10)), rows = Math.ceil(total / perRow);
    const cell = Math.min(b.w / perRow, (b.h - top - lh) / rows, 230);   // a single row of a few big glyphs reads better than slivers
    const x0 = b.x + (b.w - cell * perRow) / 2, y0 = b.y + top + (b.h - top - lh - cell * rows) / 2;
    let i = 0;
    data.forEach((d, k) => {
      for (let c = 0; c < counts[k]; c++, i++) {
        const ic = ctx.icon(g, o.icon || 'person', x0 + (i % perRow + 0.5) * cell, y0 + (Math.floor(i / perRow) + 0.5) * cell, cell * 0.86, { fill: cols[k], sw: 2.6 });
        if (o.beats) ctx.beat(ic, 'pop', { at: o.at + 250 + i * 70, dur: 420 });
      }
    });
    const lg = ctx.el('g', {}, g);
    legend(ctx, lg, data.map((d, k) => Object.assign({}, d, { value: counts[k] })), cols, b.x, y0 + cell * rows + 26, b.w, { format: 'n' });
    if (o.beats) ctx.beat(lg, 'fade', { at: o.at + 400, dy: 6 });
  }

  /* ---------- number ---------- */
  chalk.lens('number', {
    render(frame, ctx) {
      const { W, H } = ctx, tall = isTall(ctx);
      const vz0 = frame.viz && typeof frame.viz === 'object' ? frame.viz : {};
      // a numeric big is formatted like the viz (or the frame's own format / currency / compact): 22000 + "$k" → "$22k"
      const big = fin(frame.big) ? fmt(frame.big, frame.format ? spec(frame) : spec(vz0), ctx.lang) : str(frame.big).trim();
      if (!big) ctx.issue('warn', 'number frame without "big"');
      const vz = frame.viz && typeof frame.viz === 'object' ? frame.viz : null, data = vizData(ctx, vz).filter(d => fin(d.value));
      if (vz && !data.length) ctx.issue('warn', 'viz has no numeric data; drawn without it');
      if (data.filter(d => d.accent).length > 1) ctx.issue('warn', 'more than one accent datum; the accent marks one thing');
      const member = frame.who ? ctx.cast(frame.who) : null;
      const hasViz = data.length > 0;
      const M = tall ? 84 : 150, colW = tall ? W - M * 2 : hasViz ? 640 : 1100;
      const block = ctx.el('g', {}, ctx.stage);
      let y = 0, byline = null;
      if (member) {
        byline = ctx.el('g', {}, block);
        const r = tall ? 40 : 32;
        head(ctx, byline, member, M + r, y + r * 1.15, r * 0.62, { body: true, bodyFill: ctx.t.line });
        ctx.text(byline, member.name || member.id, M + r * 2 + 16, y + r * 1.15, { font: 'mono', size: tall ? 26 : 19, ls: 0.14, upper: true, color: 'ink2', weight: 500, valign: 'middle', maxW: colW - r * 2, lines: 1 });
        // clearance over the figure: "$", "€", "£", "(" and ascenders (k, l, d…) rise above the digits' cap height
        const bs = tall ? 300 : hasViz ? 290 : 360;
        y += r * 2.3 + (tall ? 30 : 22) + bs * (/^[\d\s.,%+−-]*$/.test(big) ? 0.06 : 0.22);
      }
      const bigT = ctx.text(block, big, M - (tall ? 6 : 8), y, { font: 'serif', size: tall ? 300 : hasViz ? 290 : 360, minSize: tall ? 120 : 110, maxW: colW, lines: 1, weight: 500, ls: -0.035, lh: 0.94 });
      y = bigT.top + bigT.h;
      let sw = null;
      if (!hasViz && bigT.w > 0) { sw = swash(ctx, block, M, M + bigT.w, y + bigT.size * 0.02, bigT.size * 0.06, ctx.index); y += bigT.size * 0.1; }
      let lab = null, sub = null;
      if (frame.label) { lab = ctx.rich(block, frame.label, M, y + (tall ? 26 : 20), { size: tall ? 56 : 50, weight: 500, lh: 1.08, ls: -0.012, maxW: colW, lines: 2, balance: true }); y = lab.top + lab.h; }
      if (frame.sub) { sub = ctx.rich(block, frame.sub, M, y + (tall ? 26 : 22), { font: 'sans', size: tall ? 32 : 27, color: 'ink2', lh: 1.42, maxW: tall ? colW : Math.min(colW, 620), lines: 3 }); y = sub.top + sub.h; }
      const textH = y;
      let vb = null;
      if (tall) {
        const minTop = frame.stamp ? 130 : 80, gap = hasViz ? 70 : 0;
        const vh = hasViz ? Math.min(620, H - minTop - 60 - textH - gap) : 0;
        if (hasViz && vh < 300) ctx.issue('warn', 'number text leaves little room for the viz in tall; shorten label or sub');
        const top = Math.max(minTop, Math.round((H - (textH + gap + vh)) / 2));
        block.setAttribute('transform', `translate(0 ${top})`);
        if (hasViz) vb = { x: M, y: top + textH + gap, w: W - M * 2, h: Math.max(240, vh) };
        if (top + textH + gap + vh > H - 40) ctx.issue('warn', 'number content runs off the bottom in tall');
      } else {
        block.setAttribute('transform', `translate(0 ${Math.round(H / 2 - textH / 2)})`);
        if (hasViz) vb = { x: 880, y: 190, w: 590, h: 540 };
      }
      if (vb) {
        const vg = ctx.el('g', { class: 'ct-viz' }, ctx.stage);
        viz(ctx, vg, vz.kind || 'bars', data, vb, { unit: vz.unit, format: spec(vz), zero: vz.zero, icon: vz.icon, at: 600 });
      }
      // motion: byline, the figure counts up from 0, then the words, then the viz
      if (byline) ctx.beat(byline, 'fade', { at: 0, dy: 8 });
      ctx.beat(bigT.el, 'fade', { at: 80, dur: 500, dy: 16 });
      if (countable(ctx, big)) ctx.beat(bigT.el, 'count', { at: 120, dur: 1200 });
      if (sw) ctx.beat(sw, 'grow', { at: 1250, dur: 620, from: 'left' });
      if (lab) ctx.beat(lab.el, 'fade', { at: 520, dy: 12 });
      if (sub) ctx.beat(sub.el, 'fade', { at: 760, dy: 10 });
    },
  });
  // count only when re-formatting the parsed number gives the same digits back ("2026" in tr would become "2.026")
  function countable(ctx, s) {
    const m = s.match(/\d[\d.,\s]*\d|\d/);
    if (!m) return false;
    const parts = new Intl.NumberFormat(ctx.lang).formatToParts(12345.6);
    const group = (parts.find(p => p.type === 'group') || {}).value || ',', dec = (parts.find(p => p.type === 'decimal') || {}).value || '.';
    const raw = m[0].replace(/\s/g, ''), d = (raw.split(dec)[1] || '').length;
    const n = parseFloat(raw.split(group).join('').replace(dec, '.'));
    return isFinite(n) && nf(ctx.lang, { minimumFractionDigits: d, maximumFractionDigits: d }).format(n) === raw;
  }

  /* ---------- whatif ---------- */
  const CSS = `
.ct-wi{position:absolute;display:flex;flex-direction:column;gap:var(--gap);font-family:var(--sans);color:var(--ink);
  --ls:31px;--os:54px;--hit:80px;--th:46px;--tk:7px;--tb:4px;--gap:22px}
.ct-wi.tall{--ls:34px;--os:54px;--hit:118px;--th:66px;--tk:9px;--tb:5px;--gap:6px}
.ct-wi label{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:baseline;column-gap:24px;cursor:default}
.ct-wi label>span{font-size:var(--ls);font-weight:500;line-height:1.2}
.ct-wi output{font:500 var(--os)/1 var(--serif);font-variant-numeric:tabular-nums;letter-spacing:-.01em;white-space:nowrap}
.ct-wi input{grid-column:1/-1;-webkit-appearance:none;appearance:none;width:100%;height:var(--hit);margin:0;padding:0;background:transparent;cursor:grab;touch-action:none}
.ct-wi input:active{cursor:grabbing}
.ct-wi input:focus{outline:none}
.ct-wi input::-webkit-slider-runnable-track{height:var(--tk);border-radius:99px;background:linear-gradient(var(--ink),var(--ink)) 0/var(--f,50%) 100% no-repeat,var(--line)}
.ct-wi input::-webkit-slider-thumb{-webkit-appearance:none;box-sizing:border-box;width:var(--th);height:var(--th);margin-top:calc((var(--tk) - var(--th))/2);border-radius:50%;background:var(--accent);border:var(--tb) solid var(--ink)}
.ct-wi input::-moz-range-track{height:var(--tk);border-radius:99px;background:var(--line)}
.ct-wi input::-moz-range-progress{height:var(--tk);border-radius:99px;background:var(--ink)}
.ct-wi input::-moz-range-thumb{box-sizing:border-box;width:var(--th);height:var(--th);border-radius:50%;background:var(--accent);border:var(--tb) solid var(--ink)}
.ct-wi input:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 var(--tb) var(--paper),0 0 0 calc(var(--tb) * 2) var(--accent)}
.ct-wi input:focus-visible::-moz-range-thumb{box-shadow:0 0 0 var(--tb) var(--paper),0 0 0 calc(var(--tb) * 2) var(--accent)}`;
  function injectCSS() {
    if (document.getElementById('ct-card-css')) return;
    const s = document.createElement('style');
    s.id = 'ct-card-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  chalk.lens('whatif', {
    render(frame, ctx) {
      injectCSS();
      const { W, H, t } = ctx, tall = isTall(ctx), lang = ctx.lang;
      const vars = arr(frame.vars).filter(v => v && typeof v === 'object' && /^[A-Za-z_]\w*$/.test(str(v.id))).map(v => {
        const min = fin(+v.min) ? +v.min : 0, max = fin(+v.max) && +v.max > min ? +v.max : min + 100;
        const step = +v.step > 0 ? +v.step : 1, value = Math.min(max, Math.max(min, fin(+v.value) ? +v.value : min));
        return { id: v.id, label: str(v.label || v.id), min, max, step, value, unit: str(v.unit) };
      });
      if (!vars.length) ctx.issue('warn', 'whatif without vars; nothing to slide');
      const ids = vars.map(v => v.id);
      const comp = (e, where) => {
        try { return compile(e, ids); } catch (err) { ctx.issue('error', `${where} expr "${e}": ${err.message}`); return null; }
      };
      const outs = arr(frame.outputs).filter(o => o && typeof o === 'object').map((o, k) => ({ label: str(o.label), format: spec(o), accent: !!o.accent, fn: comp(o.expr, `outputs[${k}]`) }));
      if (outs.length && !outs.some(o => o.accent)) outs[outs.length - 1].accent = true;
      if (outs.length > 3) ctx.issue('warn', `${outs.length} outputs; ≤ 3 read best (first 3 drawn)`);
      outs.length = Math.min(outs.length, 3);
      const vz = frame.viz && typeof frame.viz === 'object' ? frame.viz : null;
      const vdata = vz ? arr(vz.data).filter(d => d && typeof d === 'object').map((d, k) => ({
        label: str(d.label), accent: !!d.accent, value: +d.value, fn: d.expr != null ? comp(d.expr, `viz.data[${k}]`) : null,
      })) : [];
      const env0 = Object.fromEntries(vars.map(v => [v.id, v.value]));
      const vizNow = env => vdata.map(d => ({ label: d.label, accent: d.accent, value: d.fn ? d.fn(env) : d.value })).filter(d => fin(d.value));
      // bars keep one scale while sliding: the start plus headroom; a value past it grows the scale (never clips)
      const vmax = vdata.length ? Math.max(0, ...vizNow(env0).map(d => d.value)) * 1.25 : 0;

      // layout
      const hlSrc = frame.headline || '';
      let sliderBox, tileBox, vizBox = null;
      const hg = ctx.el('g', {}, ctx.stage);
      let H1;
      if (!tall) {
        const L = 96, LW = 690;
        H1 = headline(ctx, hg, hlSrc, L, 0, { size: 84, minSize: 52, maxW: LW, lines: 3 });
        const sh = vars.length * (54 + 80) + Math.max(0, vars.length - 1) * 22;   // matches the wide .ct-wi row: output line + hit area, gap
        const total = H1.hl.h + 60 + sh, top = Math.max(70, Math.round((H - total) / 2));
        hg.setAttribute('transform', `translate(0 ${top})`);
        sliderBox = { x: L, y: top + H1.hl.h + 60, w: LW };
        if (top + total > H - 30) ctx.issue('warn', 'whatif left column overflows; shorten the headline or use fewer vars');
        const R = 862, RW = 642;
        if (vdata.length) {
          // horizontal tiles (label left, value right) stacked above the viz
          const n = Math.max(1, outs.length), lo = frame.stamp ? 150 : 70, vmin = Math.round(H * 0.4);
          const th = Math.max(84, Math.min(n === 1 ? 150 : n === 2 ? 124 : 104, (H - 50 - lo - 44 - vmin - (n - 1) * 16) / n)), tt = n * th + (n - 1) * 16;
          const vh = Math.max(vmin, Math.min(n > 2 ? 380 : 440, H - 50 - lo - tt - 44));
          const ty = Math.max(lo, Math.round((H - (tt + 44 + vh)) / 2) + 10);
          tileBox = { x: R, y: ty, w: RW, h: th, row: false, horiz: true, gap: 16 };
          vizBox = { x: R, y: ty + tt + 44, w: RW, h: vh };
        } else {   // the tiles share the left column's top and bottom edges, so the two halves balance
          const n = Math.max(1, outs.length), th = Math.round(Math.max(170, Math.min(320, (total - 24 * (n - 1)) / n))), tot = n * th + (n - 1) * 24;
          tileBox = { x: R, y: Math.round(top + (total - tot) / 2), w: RW, h: th, row: false };
        }
      } else {
        const M = 72, MW = W - M * 2, top0 = frame.stamp ? 118 : 64;
        H1 = headline(ctx, hg, hlSrc, M, 0, { size: 74, minSize: 52, maxW: MW, lines: 3 });
        hg.setAttribute('transform', `translate(0 ${top0})`);
        const sh = vars.length * (34 * 1.2 + 118) + Math.max(0, vars.length - 1) * 6;
        const sy = H - 56 - sh;
        sliderBox = { x: M, y: sy, w: MW };
        const ty = top0 + H1.hl.h + 48;
        if (vdata.length) {
          const n = Math.max(1, outs.length), horiz = n !== 2, th = n === 1 ? 150 : horiz ? 104 : 220, tt = horiz ? n * th + (n - 1) * 14 : th;
          const room = sy - 44 - (ty + tt + 40);
          tileBox = { x: M, y: ty, w: MW, h: th, row: !horiz, horiz, gap: 14 };
          if (room < 160) ctx.issue('warn', 'no room for the whatif viz in tall (dropped there); shorten the headline or use fewer vars/outputs');
          else vizBox = { x: M, y: ty + tt + 40, w: MW, h: Math.min(580, room) };
        } else {   // no viz: the outputs stack and take the room between the claim and the sliders
          const n = Math.max(1, outs.length), avail = sy - 50 - ty, th = Math.max(150, Math.min(250, (avail - 24 * (n - 1)) / n));
          const tot = n * th + 24 * (n - 1);
          tileBox = { x: M, y: Math.round(ty + Math.max(0, (avail - tot) / 2)), w: MW, h: th, row: false };
          if (tot > avail) ctx.issue('warn', 'whatif content overlaps the sliders in tall; shorten the headline or use fewer vars');
        }
      }

      // output tiles (SVG), updated live
      const tg = ctx.el('g', {}, ctx.stage), tiles = [];
      const n = Math.max(1, outs.length), gap = tileBox.gap || 24, hz = !!tileBox.horiz;
      outs.forEach((o, k) => {
        const tw = tileBox.row ? (tileBox.w - gap * (n - 1)) / n : tileBox.w, th = tileBox.h;
        const x = tileBox.row ? tileBox.x + k * (tw + gap) : tileBox.x, y = tileBox.row ? tileBox.y : tileBox.y + k * (th + gap);
        const g = ctx.el('g', {}, tg), pad = tall ? 26 : 32, ls = tall ? 27 : hz ? 23 : 27;
        if (o.accent) ctx.rough(ctx.el('rect', { x, y, width: tw, height: th, rx: 18, fill: t.paper2, stroke: t.ink, 'stroke-width': 3 }, g), 1);
        else ctx.el('rect', { x: x + 1, y: y + 1, width: tw - 2, height: th - 2, rx: 18, fill: 'none', stroke: t.muted, 'stroke-width': 2, opacity: 0.7 }, g);
        let v, base, maxW;
        if (hz) {   // label left, value right
          ctx.text(g, o.label, x + pad, y + th / 2, { font: 'sans', size: ls, weight: 500, color: o.accent ? 'ink' : 'ink2', maxW: tw * 0.42, lines: 2, lh: 1.2, valign: 'middle' });
          base = Math.min(76, th * 0.56); maxW = tw * 0.58 - pad * 1.5;
          v = ctx.text(g, '0', x + tw - pad, y + th / 2 + base * 0.34, { font: 'serif', size: base, weight: 500, color: o.accent ? 'accent' : 'ink', valign: 'baseline', anchor: 'end', ls: -0.02, lines: 1 });
        } else {
          ctx.text(g, o.label, x + pad, y + pad - 4, { font: 'sans', size: ls, weight: 500, color: o.accent ? 'ink' : 'ink2', maxW: tw - pad * 2, lines: 2, lh: 1.2 });
          base = Math.min(tileBox.row ? (n > 2 ? 64 : tall ? 88 : 80) : 136, th * (tileBox.row ? 0.46 : 0.52)); maxW = tw - pad * 2;
          v = ctx.text(g, '0', x + pad - 2, y + th - pad + 2, { font: 'serif', size: base, weight: 500, color: o.accent ? 'accent' : 'ink', valign: 'baseline', ls: -0.02, lines: 1 });
        }
        tiles.push({ o, g, v, base, maxW });
      });

      // sliders (HTML over the stage, in stage units)
      const box = document.createElement('div');
      box.className = 'ct-wi' + (tall ? ' tall' : '');
      box.setAttribute('data-nonav', '');
      Object.assign(box.style, { left: sliderBox.x + 'px', top: sliderBox.y + 'px', width: sliderBox.w + 'px' });
      const inputs = vars.map(v => {
        const lab = document.createElement('label');
        const span = document.createElement('span'), out = document.createElement('output'), inp = document.createElement('input');
        span.textContent = ctx.plain(v.label);
        Object.assign(inp, { type: 'range', min: v.min, max: v.max, step: v.step });
        inp.value = v.value;
        inp.setAttribute('aria-label', ctx.plain(v.label));
        lab.append(span, out, inp);
        box.appendChild(lab);
        inp.addEventListener('input', update);
        return { v, inp, out };
      });
      ctx.html.appendChild(box);

      const vg = vizBox ? ctx.el('g', { class: 'ct-viz' }, ctx.stage) : null;
      const vopts = vz ? { unit: vz.unit, format: spec(vz), zero: vz.zero, icon: vz.icon } : null;
      function update(first) {
        const env = {};
        inputs.forEach(({ v, inp, out }) => {
          const val = +inp.value;
          env[v.id] = val;
          const s = fmtUnit(val, v.unit, lang);
          out.textContent = s;
          inp.setAttribute('aria-valuetext', s);
          inp.style.setProperty('--f', ((val - v.min) / (v.max - v.min) * 100) + '%');
        });
        tiles.forEach(tl => {
          let val = NaN;
          try { val = tl.o.fn ? tl.o.fn(env) : NaN; } catch (_) { /* keep NaN */ }
          const s = fmt(val, tl.o.format, lang), w = ctx.measure(s, { font: 'serif', size: tl.base, weight: 500, ls: -0.02 });
          tl.v.el.setAttribute('font-size', w > tl.maxW ? Math.max(20, tl.base * tl.maxW / w) : tl.base);
          tl.v.el.firstChild.textContent = s;
        });
        if (vg) {
          vg.textContent = '';
          const cur = vizNow(env);
          viz(ctx, vg, vz.kind || 'bars', cur, vizBox, Object.assign({ beats: first === true, at: 700, max: Math.max(vmax, ...cur.map(d => d.value)) || undefined }, vopts));
        }
      }
      update(true);

      // motion: the claim, then the numbers, then the controls you can touch
      ctx.beat(H1.hl.el, 'fade', { at: 60, dur: 760, dy: 18 });
      H1.sw.forEach((s, k) => ctx.beat(s, 'grow', { at: 800 + k * 160, dur: 600, from: 'left' }));
      tiles.forEach((tl, k) => ctx.beat(tl.g, 'fade', { at: 380 + k * 160, dy: 14 }));
      ctx.beat(box, 'fade', { at: 900, dur: 600, dy: 16 });
    },
  });

  /* ---------- compare ---------- */
  function art(ctx, g, a, x, cy, size, accent) {
    if (!a) return 0;
    const fill = accent ? 'accentSoft' : 'paper2', color = accent ? 'ink' : 'ink2';
    if (typeof a === 'string') { ctx.icon(g, a, x + size / 2, cy, size, { fill, color, sw: 2.4 }); return size; }
    if (a.icon) { ctx.icon(g, a.icon, x + size / 2, cy, size, { fill, color, sw: 2.4 }); return size; }
    let cx = x;
    arr(a.people).forEach(p => {
      // the bust (hair top ≈ -1.3r … shoulders +2.7r) sits inside the art box, so it never touches the label below
      const who = typeof p === 'string' ? p : p && p.who, m = ctx.cast(who), r = size * (arr(a.people).length === 1 && !arr(a.props).length ? 0.25 : 0.22);
      head(ctx, g, m, cx + r * 1.75, cy + size / 2 - r * 2.7, r, { mood: (p && p.mood) || (accent ? 'happy' : 'neutral'), bodyFill: accent && m && m.hero ? ctx.t.accent : ctx.t.line });
      cx += r * 3.4;
    });
    arr(a.props).forEach(p => {
      const kind = typeof p === 'string' ? p : p && p.kind;
      ctx.icon(g, kind, cx + size * 0.4, cy, size * 0.8, { fill, color, sw: 2.4 });
      cx += size * 0.9;
    });
    return cx > x ? size : 0;
  }
  // one side of a compare: art (or the hero's face), big label, ✗ / ✓ lines; k scales everything (fit loop)
  function side(ctx, parent, s, accent, x, y, w, k) {
    const tall = isTall(ctx), g = ctx.el('g', {}, parent), marks = [], z = v => Math.round(v * k);
    let cy = y;
    const aSize = z(tall ? 150 : 170);
    if (s.art) { const ah = art(ctx, g, s.art, x, cy + aSize / 2, aSize, accent); if (ah) cy += ah + z(tall ? 22 : 26); }
    const lab = ctx.rich(g, s.label || '', x, cy, { size: z(tall ? 76 : 80), minSize: z(52), weight: 500, lh: 1.02, ls: -0.018, color: accent ? 'ink' : 'ink2', maxW: w, lines: 2, balance: true });
    cy = lab.top + lab.h + z(tall ? 30 : 36);
    const lines = arr(s.lines).map(str).filter(Boolean);
    if (lines.length > 3) ctx.issue('warn', `${lines.length} compare lines; ≤ 3 read best`);
    const ms = z(tall ? 50 : 50), fs = z(tall ? 41 : 38), gap = z(tall ? 22 : 24);
    lines.forEach((ln, j) => {
      const txt = ctx.rich(g, ln, x + ms + z(22), cy, { font: 'sans', size: fs, weight: accent ? 500 : 400, color: accent ? 'ink' : 'ink2', maxW: w - ms - z(22), lines: 3, lh: 1.26 });
      marks.push(ctx.icon(g, accent ? 'check' : 'cross', x + ms / 2, cy + fs * 0.64, ms, { color: accent ? 'accent' : 'muted', sw: accent ? 4 : 3.2 }));
      cy = txt.top + txt.h + (j < lines.length - 1 ? gap : 0);
    });
    return { g, h: cy - y, marks };
  }
  chalk.lens('compare', {
    render(frame, ctx) {
      const { W, H, t } = ctx, tall = isTall(ctx), wd = words(ctx);
      let L = frame.left, R = frame.right;
      if (!L && !R && (frame.before || frame.after)) {   // before / after moments → muted / accent sides
        const mk = (m, label, tone) => m && { label: m.label || label, tone, lines: m.lines || (m.say ? [m.say] : []), art: (m.people || m.props) ? { people: m.people, props: m.props } : m.art };
        L = mk(frame.before, wd.before, 'muted'); R = mk(frame.after, wd.after, 'accent');
      }
      L = L || { label: '', lines: [] }; R = R || { label: '', lines: [] };
      if (!frame.left && !frame.before) ctx.issue('warn', 'compare needs left/right or before/after');
      // the accent side is the new one; default right
      let lAcc = L.tone === 'accent', rAcc = R.tone ? R.tone === 'accent' : !lAcc;
      if (lAcc && rAcc) { ctx.issue('warn', 'both compare sides are accent; only the right one kept it'); lAcc = false; }
      // concrete before abstract: with no art on either side, the hero's face carries the change (sad → happy)
      const hero = (ctx.story.cast || []).find(m => m && m.hero);
      if (hero && !L.art && !R.art) {
        L = Object.assign({}, L, { art: { people: [{ who: hero.id, mood: lAcc ? 'happy' : 'sad' }] } });
        R = Object.assign({}, R, { art: { people: [{ who: hero.id, mood: rAcc ? 'happy' : 'sad' }] } });
      }
      const stage = ctx.stage, back = ctx.el('g', {}, stage), top = frame.stamp ? 120 : 44, bot = 36, avail = H - top - bot;
      // both sides are laid out at k = 1, then shrunk once if they do not fit the stage
      const lay = (k, x, w, lx2) => {
        const pad = Math.round((tall ? 48 : 56) * k);
        const a = side(ctx, stage, L, lAcc, x + pad, pad, w - pad * 2, k), b = side(ctx, stage, R, rAcc, (lx2 == null ? x : lx2) + pad, pad, w - pad * 2, k);
        return { a, b, pad };
      };
      let lS, rS, card, ghost, arrow;
      const cardAt = (x, y, w, h, acc) => acc
        ? ctx.rough(ctx.el('rect', { x, y, width: w, height: h, rx: 26, fill: t.paper2, stroke: t.ink, 'stroke-width': 3.2 }, back), 1)
        : ctx.rough(ctx.el('rect', { x: x + 2, y: y + 2, width: w - 4, height: h - 4, rx: 26, fill: 'none', stroke: t.muted, 'stroke-width': 2.4, 'stroke-dasharray': '12 11' }, back), 1);
      if (!tall) {
        const M = 64, gap = 132, cw = (W - M * 2 - gap) / 2, lx = M, rx = M + cw + gap;
        let o = lay(1, lx, cw, rx), h = Math.max(o.a.h, o.b.h) + o.pad * 2;
        if (h > avail) { o.a.g.remove(); o.b.g.remove(); o = lay(Math.max(0.6, avail / h), lx, cw, rx); h = Math.max(o.a.h, o.b.h) + o.pad * 2; }
        lS = o.a; rS = o.b;
        const y0 = Math.round(top + Math.max(0, (avail - h) / 2));
        [lS, rS].forEach(s => s.g.setAttribute('transform', `translate(0 ${y0})`));
        const c1 = cardAt(lx, y0, cw, h, lAcc), c2 = cardAt(rx, y0, cw, h, rAcc);
        card = lAcc ? c1 : c2; ghost = lAcc ? c2 : c1;
        arrow = pointer(ctx, back, W / 2, y0 + h / 2, 'right');
        if (h > avail + 1) ctx.issue('warn', 'compare sides are taller than the stage; shorten the lines');
      } else {
        const x = 52, w = W - 104, gap = 118;
        let o = lay(1, x, w), tot = o.a.h + o.b.h + o.pad * 4 + gap;
        if (tot > avail) { o.a.g.remove(); o.b.g.remove(); o = lay(Math.max(0.6, (avail - gap) / (tot - gap)), x, w); tot = o.a.h + o.b.h + o.pad * 4 + gap; }
        lS = o.a; rS = o.b;
        const lh = lS.h + o.pad * 2, rh = rS.h + o.pad * 2, y0 = Math.round(top + Math.max(0, (avail - tot) / 2)), ry = y0 + lh + gap;
        lS.g.setAttribute('transform', `translate(0 ${y0})`);
        rS.g.setAttribute('transform', `translate(0 ${ry})`);
        const c1 = cardAt(x, y0, w, lh, lAcc), c2 = cardAt(x, ry, w, rh, rAcc);
        card = lAcc ? c1 : c2; ghost = lAcc ? c2 : c1;
        arrow = pointer(ctx, back, W / 2, y0 + lh + gap / 2, 'down');
        if (tot > avail + 1) ctx.issue('warn', 'compare sides are taller than the stage in tall; shorten the lines');
      }
      // motion: the old way, the turn, then the new way arrives second and its marks are inked
      const first = lAcc ? rS : lS, second = lAcc ? lS : rS;
      const off = (s, d) => (tall ? { dx: 0, dy: d } : { dx: s === lS ? -d : d, dy: 0 });
      ctx.beat(ghost, 'fade', Object.assign({ at: 60, dur: 700 }, off(first, 36)));
      ctx.beat(first.g, 'fade', Object.assign({ at: 100, dur: 700 }, off(first, 36)));
      ctx.beat(arrow, 'pop', { at: 800 });
      ctx.beat(card, 'fade', Object.assign({ at: 1100, dur: 700 }, off(second, 36)));
      ctx.beat(second.g, 'fade', Object.assign({ at: 1150, dur: 700 }, off(second, 36)));
      second.marks.forEach((m, k) => ctx.beat(m, 'draw', { at: 1700 + k * 180, dur: 420 }));
    },
  });
  // the turn between the sides: a bold ink arrow in a paper disc
  function pointer(ctx, parent, cx, cy, dir) {
    const t = ctx.t, g = ctx.el('g', {}, parent), r = isTall(ctx) ? 44 : 46;
    ctx.rough(ctx.el('circle', { cx, cy, r, fill: t.paper, stroke: t.ink, 'stroke-width': 3.2 }, g), 1);
    const a = r * 0.46, d = dir === 'down' ? `M${cx} ${cy - a}V${cy + a}M${cx - a * 0.72} ${cy + a * 0.28}L${cx} ${cy + a}L${cx + a * 0.72} ${cy + a * 0.28}`
      : `M${cx - a} ${cy}H${cx + a}M${cx + a * 0.28} ${cy - a * 0.72}L${cx + a} ${cy}L${cx + a * 0.28} ${cy + a * 0.72}`;
    ctx.rough(ctx.el('path', { d, stroke: t.ink, 'stroke-width': 4.4, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g), 1);
    return g;
  }

  /* ---------- screen ---------- */
  // UI is laid out in device units (phone 390 wide) and the device group is scaled onto the stage.
  function uiItem(u, it, y) {
    const { ctx, g, x, w, f, t } = u, type = it.type, acc = !!it.accent, text = str(it.text);
    const T = (s, xx, yy, o) => ctx.rich(g, s, xx, yy, Object.assign({ font: 'sans', lines: 1 }, o));
    switch (type) {
      case 'header': {
        let tx = x;
        if (!u.laptop) {
          ctx.el('path', { d: `M${x + 12} ${y + f(30) * 0.25}l-11 ${f(30) * 0.37}l11 ${f(30) * 0.37}`, stroke: t.ink, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
          tx = x + 30;
        }
        const h1 = T(text, tx, y, { size: f(30), weight: 600, maxW: x + w - tx, lines: 2, lh: 1.12, ls: -0.01, color: acc ? 'accent' : 'ink' });
        let h = h1.h;
        if (it.sub) h += T(it.sub, tx, y + h + 4, { size: f(19), color: 'ink2', maxW: x + w - tx }).h + 4;
        return h;
      }
      case 'text':
        return T(text, x, y, { size: f(21), color: acc ? 'ink' : 'ink2', weight: acc ? 500 : 400, maxW: w, lines: 4, lh: 1.42 }).h;
      case 'amount': {
        let h = 0;
        if (it.label) h += T(it.label, x, y, { size: f(19), color: 'ink2', maxW: w }).h + 2;
        h += T(text, x - 2, y + h, { font: 'serif', size: f(58), weight: 500, ls: -0.02, color: acc ? 'accent' : 'ink', maxW: w, minSize: f(30), lh: 1.05 }).h;
        return h;
      }
      case 'button': {
        const fs = f(22), h = Math.max(58, fs * 2.6);
        const r = ctx.el('rect', { x, y, width: w, height: h, rx: h / 2, fill: acc ? t.accent : t.paper, stroke: t.ink, 'stroke-width': acc ? 3 : 2.6 }, g);
        ctx.rough(r, 1);
        T(text, x + w / 2, y + h / 2, { size: fs, weight: 600, color: acc ? t.paper2 : 'ink', anchor: 'middle', valign: 'middle', maxW: w - 40 });
        u.hot = acc ? { cx: x + w / 2, cy: y + h / 2, r: h * 0.5 } : u.hot;
        return h;
      }
      case 'list': {
        const items = arr(it.items).map(s => (typeof s === 'object' && s ? [str(s.text || s.label), str(s.value)] : str(s).split(/\s+[·|—]\s+/)));
        const fs = f(21), rh = fs * 2.5;
        items.forEach((p, k) => {
          const ry = y + k * rh;
          if (k) ctx.el('path', { d: `M${x} ${ry}H${x + w}`, stroke: t.line, 'stroke-width': 1.6, fill: 'none' }, g);
          ctx.el('circle', { cx: x + fs * 0.45, cy: ry + rh / 2, r: fs * 0.3, fill: acc ? t.accent : 'none', stroke: acc ? t.ink : t.ink2, 'stroke-width': 2 }, g);
          const right = p.slice(1).join(' · ');
          const rw = right ? ctx.measure(right, { font: 'mono', size: f(19), weight: 500 }) + 16 : 0;
          T(p[0], x + fs * 1.3, ry + rh / 2, { size: fs, valign: 'middle', maxW: w - fs * 1.3 - rw });
          if (right) T(right, x + w, ry + rh / 2, { font: 'mono', size: f(19), weight: 500, color: 'ink2', anchor: 'end', valign: 'middle' });
        });
        return items.length * rh;
      }
      case 'avatars': {
        // round busts, like app avatars: head and shoulders clipped to a circle; the accent rings the first
        const names = arr(it.items).map(str).slice(0, 6), n = Math.max(1, names.length);
        const R = Math.min(34, w / n / 2.5), slot = w / n;
        names.forEach((nm, k) => {
          const m = findCast(ctx, nm), cx = x + slot * (k + 0.5), cy = y + R + 4, hot = acc && k === 0;
          if (hot) ctx.el('circle', { cx, cy, r: R + 6, fill: 'none', stroke: t.accent, 'stroke-width': 3 }, g);
          ctx.el('circle', { cx, cy, r: R, fill: hot ? t.accentSoft : t.line }, g);
          if (m) {
            const id = ctx.id('av'), cp = ctx.el('clipPath', { id }, g);
            ctx.el('circle', { cx, cy, r: R }, cp);
            head(ctx, ctx.el('g', { 'clip-path': `url(#${id})` }, g), m, cx, cy - R * 0.1, R * 0.47, { bodyFill: hot ? t.accent : t.paper2, sw: 2 });
          } else T(nm.slice(0, 1).toLocaleUpperCase(ctx.lang), cx, cy, { size: R * 0.9, weight: 600, anchor: 'middle', valign: 'middle', color: 'ink2' });
          ctx.el('circle', { cx, cy, r: R, fill: 'none', stroke: t.ink, 'stroke-width': 2.2 }, g);
          T(nm, cx, y + R * 2 + 16, { size: f(17), color: hot ? 'ink' : 'ink2', weight: hot ? 600 : 400, anchor: 'middle', maxW: slot - 4 });
        });
        let h = R * 2 + 16 + f(17) * 1.25;
        if (text) h += T(text, x, y + h + 8, { size: f(19), color: 'ink2', maxW: w, lines: 2, lh: 1.35 }).h + 8;
        return h;
      }
      case 'toast': {
        const fs = f(20), h = fs * 2.7, tw = Math.min(w, ctx.measure(ctx.plain(text), { font: 'sans', size: fs, weight: 500 }) + h * 1.6), tx = x + (w - tw) / 2;
        ctx.el('rect', { x: tx, y, width: tw, height: h, rx: h / 2, fill: t.ink }, g);
        ctx.el('circle', { cx: tx + h / 2, cy: y + h / 2, r: h * 0.26, fill: acc ? t.accent : t.paper2 }, g);
        ctx.el('path', { d: `M${tx + h / 2 - h * 0.11} ${y + h / 2}l${h * 0.08} ${h * 0.08}l${h * 0.14} -${h * 0.15}`, stroke: acc ? t.paper2 : t.ink, 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
        T(text, tx + h * 0.95, y + h / 2, { size: fs, weight: 500, color: t.paper, valign: 'middle', maxW: tw - h * 1.2 });
        return h;
      }
      case 'input': {
        let h = 0;
        if (it.label) h += T(it.label, x, y, { size: f(18), color: 'ink2', weight: 500, maxW: w }).h + 8;
        const fs = f(21), fh = fs * 2.6;
        ctx.el('rect', { x, y: y + h, width: w, height: fh, rx: 14, fill: t.paper, stroke: acc ? t.accent : t.ink2, 'stroke-width': acc ? 3 : 2 }, g);
        const val = it.value != null ? str(it.value) : '', s = val || text;
        const tt = T(s, x + 20, y + h + fh / 2, { size: fs, color: val ? 'ink' : 'muted', valign: 'middle', maxW: w - 40 });
        if (acc) ctx.el('path', { d: `M${x + 22 + (val ? tt.w + 4 : 0)} ${y + h + fh * 0.26}V${y + h + fh * 0.74}`, stroke: t.accent, 'stroke-width': 2.4 }, g);
        return h + fh;
      }
      case 'progress': {
        const m = text.match(/(\d+)\s*\/\s*(\d+)/), pc = text.match(/(\d+(?:[.,]\d+)?)\s*%|%\s*(\d+(?:[.,]\d+)?)/);
        let p = fin(+it.value) ? (+it.value > 1 ? +it.value / 100 : +it.value) : m ? +m[1] / Math.max(1, +m[2]) : pc ? parseFloat((pc[1] || pc[2]).replace(',', '.')) / 100 : 0.5;
        p = Math.max(0, Math.min(1, p));
        const fs = f(20);
        const lt = T(text || it.label || '', x, y, { size: fs, weight: 500, maxW: w });
        const ty = y + lt.h + 12, th = 14;
        ctx.el('rect', { x, y: ty, width: w, height: th, rx: th / 2, fill: t.line }, g);
        if (p > 0) ctx.el('rect', { x, y: ty, width: Math.max(th, w * p), height: th, rx: th / 2, fill: acc ? t.accent : t.ink }, g);
        return lt.h + 12 + th;
      }
      case 'check': {
        const rows = it.items ? arr(it.items).map(str) : [text], fs = f(21), rh = fs * 2.1;
        rows.forEach((s, k) => {
          const cy = y + k * rh + rh / 2, cr = fs * 0.62;
          ctx.el('circle', { cx: x + cr, cy, r: cr, fill: acc ? t.accent : t.ink }, g);
          ctx.el('path', { d: `M${x + cr * 0.55} ${cy + cr * 0.02}l${cr * 0.32} ${cr * 0.32}l${cr * 0.6} -${cr * 0.62}`, stroke: t.paper2, 'stroke-width': 2.6, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
          T(s, x + cr * 2 + 14, cy, { size: fs, valign: 'middle', maxW: w - cr * 2 - 14, weight: acc ? 500 : 400 });
        });
        return rows.length * rh;
      }
      case 'image': {
        // "icon": a core icon drawn large, ink on paper2, in a soft panel; no icon: a soft hatched panel with a small picture glyph
        const ih = Math.round(w * (u.laptop ? 0.42 : 0.56)), bx = x + w / 2, by = y + ih / 2, m = Math.min(w, ih);
        ctx.el('rect', { x, y, width: w, height: ih, rx: 18, fill: acc ? t.accentSoft : t.paper }, g);
        if (it.icon) {
          const s = m * 0.56;
          ctx.icon(g, str(it.icon), bx, by, s, { color: 'ink', fill: 'paper2', sw: 3.2 * 48 / s });
        } else {
          const id = ctx.id('hatch'), pat = ctx.el('pattern', { id, width: 16, height: 16, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, g);
          ctx.el('path', { d: 'M0 0V16', stroke: acc ? t.accent : t.line, 'stroke-width': 2.2, opacity: acc ? 0.35 : 1 }, pat);
          ctx.el('rect', { x, y, width: w, height: ih, rx: 18, fill: `url(#${id})` }, g);
          const r = m * 0.17, gs = r * 1.1;
          ctx.el('circle', { cx: bx, cy: by, r, fill: t.paper2, stroke: t.ink2, 'stroke-width': 2.4 }, g);
          const ig = ctx.el('g', { fill: 'none', stroke: acc ? t.accent : t.ink2, 'stroke-width': 2.4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g);
          ctx.el('rect', { x: bx - gs / 2, y: by - gs * 0.4, width: gs, height: gs * 0.8, rx: gs * 0.12 }, ig);
          ctx.el('path', { d: `M${bx - gs / 2} ${by + gs * 0.28}L${bx - gs * 0.12} ${by - gs * 0.06}L${bx + gs * 0.14} ${by + gs * 0.16}L${bx + gs * 0.28} ${by + gs * 0.04}L${bx + gs / 2} ${by + gs * 0.22}` }, ig);
          ctx.el('circle', { cx: bx + gs * 0.24, cy: by - gs * 0.17, r: gs * 0.08 }, ig);
        }
        ctx.rough(ctx.el('rect', { x, y, width: w, height: ih, rx: 18, fill: 'none', stroke: acc ? t.accent : t.ink2, 'stroke-width': 2, opacity: acc ? 1 : 0.5 }, g), 1);
        let h = ih;
        const cap = it.caption != null ? str(it.caption) : text;   // "caption" or "text": the line under the picture
        if (cap) h += T(cap, x, y + ih + 10, { size: f(18), color: 'ink2', maxW: w, lines: 2, lh: 1.3 }).h + 10;
        return h;
      }
      case 'divider': {
        const fs = f(17);
        if (!text) { ctx.el('path', { d: `M${x} ${y + 10}H${x + w}`, stroke: t.line, 'stroke-width': 2, fill: 'none' }, g); return 20; }
        const tw = ctx.measure(ctx.plain(text), { font: 'sans', size: fs }) + 28, my = y + fs * 0.7;
        ctx.el('path', { d: `M${x} ${my}H${x + (w - tw) / 2}M${x + (w + tw) / 2} ${my}H${x + w}`, stroke: t.line, 'stroke-width': 2, fill: 'none' }, g);
        T(text, x + w / 2, my, { size: fs, color: 'muted', anchor: 'middle', valign: 'middle' });
        return fs * 1.4;
      }
      default:
        ctx.issue('warn', `unknown ui type "${type}" (header | text | amount | button | list | avatars | toast | input | progress | check | image | divider); drawn as text`);
        return text ? T(text, x, y, { size: f(21), color: 'ink2', maxW: w, lines: 3, lh: 1.4 }).h : 0;
    }
  }
  chalk.lens('screen', {
    render(frame, ctx) {
      const { W, H, t } = ctx, tall = isTall(ctx);
      const laptop = frame.device === 'laptop';
      const ui = arr(frame.ui).filter(it => it && typeof it === 'object');
      const notes = arr(frame.annotate).filter(a => a && Number.isInteger(a.at) && ui[a.at] && a.text);
      if (arr(frame.annotate).length !== notes.length) ctx.issue('warn', 'some annotate entries have no valid "at" (ui index) or "text"; skipped');
      if (ui.filter(it => it.accent).length > 1) ctx.issue('warn', 'more than one accent ui element; the accent marks one thing');
      // device geometry, device units
      const D = laptop ? { w: 1040, h: 650, bz: 16, rx: 26, sx: 16, sy: 16, sw: 1008, sh: 618, cw: 800 } : { w: 390, h: 800, bz: 12, rx: 60, sx: 12, sy: 12, sw: 366, sh: 776, cw: 318 };
      const baseH = laptop ? 46 : 0;
      let s, px, py;
      if (!tall) {
        s = laptop ? (notes.length ? 0.86 : 1.08) : 0.985;
        const dw = (laptop ? D.w + 120 : D.w) * s;
        px = notes.length ? (laptop ? 90 + 60 * s : 470) : (W - D.w * s) / 2;
        if (notes.length && !laptop) px = Math.min(px, W / 2 - dw / 2 - 120);
        py = (H - (D.h + baseH) * s) / 2;
      } else {
        s = laptop ? 0.74 : notes.length ? 1.2 : 1.4;
        px = (W - D.w * s) / 2;
        py = Math.max(frame.stamp ? 110 : 40, (H - (D.h + baseH) * s) / 2);
      }
      const minFont = (tall ? 26 : 17) / s, f = size => Math.max(Math.round(size * (laptop ? 1.3 : 1)), Math.ceil(minFont));
      const dev = ctx.el('g', { transform: `translate(${px.toFixed(1)} ${py.toFixed(1)}) scale(${s.toFixed(4)})` }, ctx.stage);
      const body = ctx.el('g', {}, dev);
      ctx.rough(ctx.el('rect', { x: 0, y: 0, width: D.w, height: D.h, rx: D.rx, fill: t.ink, stroke: t.ink, 'stroke-width': 3 }, body), 1);
      ctx.el('rect', { x: D.sx, y: D.sy, width: D.sw, height: D.sh, rx: laptop ? 8 : D.rx - D.bz, fill: t.paper2 }, body);
      let top;
      if (laptop) {
        ctx.rough(ctx.el('path', { d: `M-60 ${D.h}H${D.w + 60}L${D.w + 30} ${D.h + baseH}H-30Z`, fill: t.paper2, stroke: t.ink, 'stroke-width': 3, 'stroke-linejoin': 'round' }, body), 1);
        ctx.el('path', { d: `M${D.w / 2 - 70} ${D.h + 1.5}v8h140v-8`, stroke: t.ink, 'stroke-width': 2.4, fill: 'none' }, body);
        // browser bar
        ctx.el('path', { d: `M${D.sx} ${D.sy + 58}H${D.sx + D.sw}`, stroke: t.line, 'stroke-width': 2, fill: 'none' }, body);
        [0, 1, 2].forEach(k => ctx.el('circle', { cx: D.sx + 30 + k * 24, cy: D.sy + 29, r: 7, fill: 'none', stroke: t.muted, 'stroke-width': 2 }, body));
        ctx.el('rect', { x: D.sx + D.sw / 2 - 210, y: D.sy + 13, width: 420, height: 32, rx: 16, fill: t.paper, stroke: t.line, 'stroke-width': 2 }, body);
        top = D.sy + 58 + 44;
      } else {
        ctx.el('rect', { x: D.w / 2 - 54, y: D.sy + 14, width: 108, height: 32, rx: 16, fill: t.ink }, body);
        ctx.text(body, '9:41', D.sx + 34, D.sy + 30, { font: 'sans', size: f(18), weight: 600, valign: 'middle' });
        const bx = D.sx + D.sw - 70, by = D.sy + 24;
        [0, 1, 2, 3].forEach(k => ctx.el('rect', { x: bx - 34 + k * 7, y: by + 10 - k * 3, width: 4.5, height: 4 + k * 3, rx: 1, fill: t.ink }, body));
        ctx.el('rect', { x: bx, y: by, width: 30, height: 14, rx: 4, fill: 'none', stroke: t.ink, 'stroke-width': 1.8 }, body);
        ctx.el('rect', { x: bx + 3, y: by + 3, width: 20, height: 8, rx: 2, fill: t.ink }, body);
        ctx.el('rect', { x: D.w / 2 - 66, y: D.sy + D.sh - 20, width: 132, height: 6, rx: 3, fill: t.ink }, body);
        [[-3, 150, 70], [D.w - 1, 190, 100]].forEach(([x, y, h]) => ctx.el('rect', { x, y, width: 4, height: h, rx: 2, fill: t.ink }, body));
        top = D.sy + 76;
      }
      const cx0 = laptop ? D.sx + (D.sw - D.cw) / 2 : D.sx + (D.sw - D.cw) / 2;
      const content = ctx.el('g', {}, dev);
      let u, boxes;
      const layout = gap => {
        content.textContent = '';
        u = { ctx, x: cx0, w: D.cw, f, t, laptop, hot: null };
        boxes = [];
        let y = top;
        ui.forEach(it => {
          const g = ctx.el('g', {}, content);
          u.g = g;
          if (it.type === 'toast' || it.type === 'button') y += 4;
          const h = uiItem(u, it, y);
          boxes.push({ g, y0: y, y1: y + h, it });
          y += h + gap + (it.type === 'header' ? 8 : 0);
        });
        return y - gap;
      };
      const bottom = D.sy + D.sh - (laptop ? 30 : 40), gap0 = laptop ? 24 : 22;
      let need = layout(gap0);
      if (need > bottom && ui.length > 1) need = layout(Math.max(8, gap0 - (need - bottom) / (ui.length - 1)));   // tighten first, shrink last
      // short screens read top-down with a little more air (no empty middle); "align": "center" centres them.
      // Only a nearly full phone screen pins its first button / toast (and what follows) to the bottom, like a sticky CTA.
      const shift = (from, dy) => {
        boxes.slice(from).forEach(b => { b.g.setAttribute('transform', `translate(0 ${dy})`); b.y0 += dy; b.y1 += dy; });
        if (u.hot && u.hot.cy > boxes[from].y0 - dy) u.hot.cy += dy;
      };
      const pin = ui.findIndex(it => it.type === 'button' || it.type === 'toast'), room = bottom - top;
      if (bottom - need > room * 0.14 && ui.length > 1) need = layout(Math.min(gap0 * 1.6, gap0 + (bottom - need) * 0.5 / ui.length));
      const free = bottom - need;
      if (free > 0 && frame.align === 'center') shift(0, Math.round(free / 2));
      else if (!laptop && pin > 0 && free > 0 && free <= room * 0.14) shift(pin, free);
      if (need > bottom + 1) {
        const k = (bottom - top) / (need - top);
        content.setAttribute('transform', `translate(${cx0 * (1 - k)} ${top * (1 - k)}) scale(${k})`);
        boxes.forEach(b => { b.y0 = top + (b.y0 - top) * k; b.y1 = top + (b.y1 - top) * k; b.k = k; });
        if (need - bottom > 6) ctx.issue('warn', `screen ui is ${Math.round(need - bottom)} units taller than the ${laptop ? 'laptop' : 'phone'} screen; content shrunk to ${Math.round(k * 100)}%, trim items`);
      }
      // a tap on the accent button: one ripple, ends invisible (the natural state)
      let ripple = null;
      if (u.hot) ripple = ctx.el('circle', { cx: u.hot.cx, cy: u.hot.cy, r: u.hot.r, fill: 'none', stroke: t.paper2, 'stroke-width': 4, opacity: 0 }, content);

      // annotations: hand-written callouts with leader lines, outside the device
      const toStage = (dx, dy) => [px + dx * s, py + dy * s];
      const ag = ctx.el('g', {}, ctx.stage), calls = [];
      const hs = tall ? 28 : 30;
      const placed = notes.map((a, j) => {
        const b = boxes[a.at];
        let right = cx0 + D.cw, left = cx0;
        try { const bb = b.g.getBBox(); if (bb.width) { right = bb.x + bb.width; left = bb.x; } } catch (_) { /* detached */ }
        if (b.k) { right = cx0 + (right - cx0) * b.k; left = cx0 + (left - cx0) * b.k; }
        const ym = (b.y0 + b.y1) / 2;
        const sideR = !tall || (!laptop && j % 2 === 0);
        const [ex, ey] = toStage(sideR ? right + 8 : left - 8, ym);
        return { a, ex, ey, sideR, at: a.at };
      }).sort((p, q) => p.ey - q.ey);
      const devL = px, devR = px + (laptop ? D.w : D.w) * s;
      const last = { true: -Infinity, false: -Infinity };
      const below = tall && laptop;   // a laptop fills the tall stage's width: notes go under it
      let by = py + (D.h + baseH) * s + 70;
      placed.forEach(p => {
        if (below) {
          const g = ctx.el('g', {}, ag), tx = 120;
          const tt = ctx.rich(g, p.a.text, tx, by, { font: 'hand', size: hs, weight: 500, maxW: W - tx - 60, lines: 2, lh: 1.18 });
          const sy = by + hs * 0.6;
          const leader = ctx.el('path', { d: `M${tx - 14} ${sy.toFixed(1)}C${tx - 60} ${sy.toFixed(1)} ${(p.ex - 50).toFixed(1)} ${p.ey.toFixed(1)} ${p.ex.toFixed(1)} ${p.ey.toFixed(1)}`, stroke: t.ink, 'stroke-width': 2.2, fill: 'none', 'stroke-linecap': 'round' }, g);
          const dot = ctx.el('circle', { cx: p.ex, cy: p.ey, r: 6, fill: ui[p.at].accent ? t.accent : t.ink, stroke: t.ink, 'stroke-width': 1.6 }, g);
          calls.push({ at: p.at, leader, dot, text: tt.el });
          by = tt.top + tt.h + 30;
          if (by > H - 20) ctx.issue('warn', 'annotations run off the bottom in tall; fewer or shorter notes');
          return;
        }
        const tx = p.sideR ? (tall ? devR + 26 : devR + (laptop ? 140 : 120)) : (tall ? devL - 26 : devL - 120);
        const maxW = p.sideR ? W - tx - (tall ? 14 : 70) : tx - (tall ? 14 : 70);
        if (maxW < 120) ctx.issue('warn', 'annotation has little room beside the device');
        const g = ctx.el('g', {}, ag);
        const tt = ctx.rich(g, p.a.text, tx, 0, { font: 'hand', size: hs, weight: 500, color: 'ink', maxW: Math.max(120, maxW), lines: 3, lh: 1.18, anchor: p.sideR ? 'start' : 'end' });
        let ty = Math.max(p.ey - tt.h / 2, last[p.sideR] + 24, 20);
        if (ty + tt.h > H - 20) ty = H - 20 - tt.h;
        last[p.sideR] = ty + tt.h;
        tt.el.setAttribute('transform', `translate(0 ${ty.toFixed(1)})`);
        const sx = p.sideR ? tx - 14 : tx + 14, sy = ty + Math.min(tt.h, hs * 1.18) / 2;
        const bend = (p.sideR ? 1 : -1) * Math.max(40, Math.abs(sx - p.ex) * 0.45);
        const leader = ctx.el('path', { d: `M${sx.toFixed(1)} ${sy.toFixed(1)}C${(sx - bend).toFixed(1)} ${sy.toFixed(1)} ${(p.ex + bend).toFixed(1)} ${p.ey.toFixed(1)} ${p.ex.toFixed(1)} ${p.ey.toFixed(1)}`, stroke: t.ink, 'stroke-width': 2.2, fill: 'none', 'stroke-linecap': 'round' }, g);
        const dot = ctx.el('circle', { cx: p.ex, cy: p.ey, r: 6, fill: ui[p.at].accent ? t.accent : t.ink, stroke: t.ink, 'stroke-width': 1.6 }, g);
        calls.push({ at: p.at, leader, dot, text: tt.el });
      });

      // motion: the device lands, its screen fills top-down, the tap, then the notes are written
      ctx.beat(body, 'fade', { at: 0, dur: 700, dy: 28 });
      const t0 = 450, step = Math.min(150, 1300 / Math.max(1, ui.length));
      boxes.forEach((b, k) => ctx.beat(b.g, 'fade', { at: t0 + k * step, dur: 480, dy: 12 }));
      const done = t0 + boxes.length * step;
      if (ripple) ctx.anim(ripple, [{ opacity: 0.95, transform: 'scale(.4)' }, { opacity: 0, transform: 'scale(1.6)' }], { at: done + 200, duration: 700, easing: 'ease-out', fill: 'none' });
      calls.sort((p, q) => p.at - q.at).forEach((c, k) => {
        const at = done + 400 + k * 320;
        ctx.beat(c.leader, 'draw', { at, dur: 560 });
        ctx.beat(c.dot, 'pop', { at: at + 420, dur: 360 });
        ctx.beat(c.text, 'fade', { at: at + 260, dur: 500, dy: 6 });
      });
    },
  });

  /* ---------- timeline ---------- */
  chalk.lens('timeline', {
    render(frame, ctx) {
      const { W, H, t } = ctx, tall = isTall(ctx);
      const items = arr(frame.items).filter(it => it && typeof it === 'object');
      if (!items.length) { ctx.issue('warn', 'timeline without items'); return; }
      if (items.length > 6) ctx.issue('warn', `${items.length} timeline items; ≤ 6 read best`);
      const n = items.length, g = ctx.el('g', {}, ctx.stage), drawDur = 1500, t0 = 200;
      const back = ctx.el('g', {}, g);   // the accent milestone's card sits under the axis
      const nodes = [];
      let card = null;
      const cardAt = (x, y, w, h) => ctx.rough(ctx.el('rect', { x, y, width: w, height: h, rx: 24, fill: t.paper2, stroke: t.ink, 'stroke-width': 3 }, back), 1);
      if (!tall) {
        // laid out around ay = 0, then the whole strip is centred on the stage
        const x0 = 84, x1 = W - 84, span = (x1 - x0) / n, ay = 0;
        const fw = n <= 4 ? 40 : n === 5 ? 36 : 32, fa = n <= 4 ? 60 : n === 5 ? 52 : 46, fwh = n <= 4 ? 30 : 27;
        const axis = ctx.rough(ctx.el('path', { d: `M${x0 - 20} ${ay}H${x1 + 10}`, stroke: t.ink, 'stroke-width': 3.6, fill: 'none', 'stroke-linecap': 'round' }, g), 1);
        const head = ctx.rough(ctx.el('path', { d: `M${x1 - 6} ${ay - 15}L${x1 + 14} ${ay}L${x1 - 6} ${ay + 15}`, stroke: t.ink, 'stroke-width': 3.6, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g), 1);
        ctx.beat(axis, 'draw', { at: t0, dur: drawDur });
        ctx.beat(head, 'fade', { at: t0 + drawDur - 100, dy: 0, dx: -8 });
        let top = 0, bot = 0;
        items.forEach((it, k) => {
          const x = x0 + span * (k + 0.5), acc = !!it.accent, ig = ctx.el('g', {}, g);
          const when = ctx.text(ig, str(it.when), x, ay - (acc ? 60 : 50), { font: 'mono', size: acc ? fwh + 4 : fwh, weight: acc ? 600 : 500, ls: 0.06, color: acc ? 'accent' : 'ink2', anchor: 'middle', valign: 'bottom', maxW: span - 28, lines: 2, lh: 1.25 });
          const what = ctx.rich(ig, str(it.what), x, ay + (acc ? 62 : 54), { font: acc ? 'serif' : 'sans', size: acc ? fa : fw, weight: acc ? 500 : 400, color: acc ? 'ink' : 'ink', anchor: 'middle', maxW: span - (acc ? 48 : 30), minSize: acc ? 36 : 26, lines: acc ? 3 : 4, lh: acc ? 1.04 : 1.26, balance: true });
          let b = what.top + what.h;
          if (acc) {
            swash(ctx, ig, x - what.w / 2, x + what.w / 2, b + 10, 12, `tl-${ctx.index}-${k}`); b += 28;
            card = { k, x: x - span / 2 + 8, w: span - 16, y: when.top - 30, b: b + 26 };
          }
          top = Math.min(top, when.top - (acc ? 30 : 0)); bot = Math.max(bot, b + (acc ? 26 : 0));
          const dot = node(ctx, g, x, ay, acc);
          nodes.push({ ig, dot, at: t0 + ((x - x0 + 20) / (x1 - x0 + 30)) * drawDur });
        });
        if (card) card.el = cardAt(card.x, card.y, card.w, card.b - card.y);
        g.setAttribute('transform', `translate(0 ${Math.round(H / 2 - (top + bot) / 2)})`);
      } else {
        const ax = 104, lo = frame.stamp ? 150 : 90, hi = H - 70;
        const span = Math.min(300, (hi - lo) / n), y0 = Math.round((lo + hi) / 2 - span * n / 2), y1 = y0 + span * n;
        const axis = ctx.rough(ctx.el('path', { d: `M${ax} ${y0 - 10}V${y1 + 10}`, stroke: t.ink, 'stroke-width': 3.8, fill: 'none', 'stroke-linecap': 'round' }, g), 1);
        const head = ctx.rough(ctx.el('path', { d: `M${ax - 15} ${y1 - 6}L${ax} ${y1 + 14}L${ax + 15} ${y1 - 6}`, stroke: t.ink, 'stroke-width': 3.8, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g), 1);
        ctx.beat(axis, 'draw', { at: t0, dur: drawDur });
        ctx.beat(head, 'fade', { at: t0 + drawDur - 100, dy: -8 });
        const tx = ax + 70, maxW = W - tx - 72;
        const fw = n <= 4 ? 48 : 42, fa = n <= 4 ? 66 : 56;
        items.forEach((it, k) => {
          const y = y0 + span * (k + 0.5), acc = !!it.accent, ig = ctx.el('g', {}, g);
          const when = ctx.text(ig, str(it.when), tx, y + 6, { font: 'mono', size: acc ? 34 : 31, weight: acc ? 600 : 500, ls: 0.06, color: acc ? 'accent' : 'ink2', maxW, lines: 1, valign: 'bottom', lh: 1.2 });
          const what = ctx.rich(ig, str(it.what), tx, when.top + when.h + 6, { font: acc ? 'serif' : 'sans', size: acc ? fa : fw, weight: acc ? 500 : 400, maxW, minSize: acc ? 40 : 32, lines: 2, lh: acc ? 1.04 : 1.16 });
          let b = what.top + what.h;
          if (b > y + span * 0.66) ctx.issue('warn', `timeline item "${ctx.plain(str(it.what)).slice(0, 30)}" is tall for its slot in tall`);
          if (acc) {
            swash(ctx, ig, tx, tx + what.w, b + 10, 12, `tl-${ctx.index}-${k}`); b += 26;
            card = { x: ax - 46, w: W - 40 - (ax - 46), y: when.top - 26, b: b + 22 };
            card.el = cardAt(card.x, card.y, card.w, card.b - card.y);
          }
          const dot = node(ctx, g, ax, y, acc);
          nodes.push({ ig, dot, at: t0 + ((y - y0 + 10) / (y1 - y0 + 20)) * drawDur });
        });
      }
      // motion: the line is drawn in reading order; each stop pops as the pen passes it; the milestone's card lands with it
      nodes.forEach((nd, k) => {
        ctx.beat(nd.dot, 'pop', { at: nd.at - 80, dur: 460 });
        ctx.beat(nd.ig, 'fade', { at: nd.at, dur: 520, dy: tall ? 0 : 10, dx: tall ? 14 : 0 });
        if (card && card.el && items[k].accent) ctx.beat(card.el, 'fade', { at: nd.at - 120, dur: 600, dy: 0 });
      });
    },
  });
  function node(ctx, parent, x, y, acc) {
    const t = ctx.t, g = ctx.el('g', {}, parent);
    if (acc) {
      ctx.el('circle', { cx: x, cy: y, r: 34, fill: t.accentSoft, stroke: 'none' }, g);
      ctx.rough(ctx.el('circle', { cx: x, cy: y, r: 20, fill: t.accent, stroke: t.ink, 'stroke-width': 3.4 }, g), 1);
    } else ctx.rough(ctx.el('circle', { cx: x, cy: y, r: 13, fill: t.paper2, stroke: t.ink, 'stroke-width': 3.4 }, g), 1);
    return g;
  }
})();
