/* chalk-talk frames · lens: title  (reference lens — copy this shape)
 *
 * Fields: headline (≤ 8 words, *word* = accent italic), sub, kind: open | ask | section | close,
 *         items (ask / close, ≤ 3 short lines), sign (ask, e.g. "onay?" — an empty stamp waiting for a yes),
 *         label (section: replaces the "PART 01" counter; close: a small masthead, e.g. "in one line").
 * close = the calm ending of a lesson / walkthrough: the takeaway, up to 3 things to remember, no sign,
 *         and the open frame's colophon again as a bookend.
 *
 * How a lens is written:
 *  1. Register once:  chalk.lens('title', { render(frame, ctx) { ... } }).
 *  2. Read fields with defaults and report problems with ctx.issue('warn' | 'error', msg); never throw
 *     for bad content (core catches throws, but shows a placeholder instead of your frame).
 *  3. Compose natively for both stages: ctx.aspect is 'wide' (1600×900) or 'tall' (900×1400).
 *     Measure first (ctx.text / ctx.rich return { w, h, top, runs }), then place. A common trick, used
 *     below: draw a block at y = 0 inside a <g>, read its height, then translate the <g> into place.
 *  4. Draw the FINAL picture. Beats (ms) only describe how things arrive; when motion is off
 *     (?snap, reduced motion, chalk.go) the same DOM is shown as is, and chalk.seek freezes beats.
 *  5. Ink, not pixels: colors from ctx.t, fonts by role, ctx.rough(el) for the hand-made line,
 *     ctx.rand(seed) for any variation (never Math.random or Date). The accent marks only what is new.
 */
(function () {
  'use strict';

  const WORDS = {
    tr: { frames: 'kare', sec: 'sn', section: 'Bölüm', sign: 'imza', date: 'tarih', end: 'son' },
    en: { frames: 'frames', sec: 's', section: 'Part', sign: 'signature', date: 'date', end: 'the end' },
  };

  chalk.lens('title', {
    render(frame, ctx) {
      const kind = frame.kind || 'open';
      if (!['open', 'ask', 'section', 'close'].includes(kind)) ctx.issue('warn', `unknown title kind "${kind}" (open | ask | section | close); drawn as open`);
      if (!frame.headline) ctx.issue('warn', 'title frame without a headline; story title used');
      const n = ctx.plain(frame.headline || '').split(/\s+/).filter(Boolean).length;
      if (n > 8) ctx.issue('warn', `headline has ${n} words (≤ 8)`);
      const w = WORDS[String(ctx.lang).slice(0, 2)] || WORDS.en;
      if (kind === 'ask') ask(frame, ctx, w);
      else if (kind === 'section') section(frame, ctx, w);
      else if (kind === 'close') close(frame, ctx, w);
      else open(frame, ctx, w);
    },
  });

  /* ---- shared pieces ---- */

  // the headline: big serif, tight, accent italic words get a hand-inked swash under them
  function headline(ctx, parent, frame, x, y, o) {
    const tall = ctx.aspect === 'tall';
    const hl = ctx.rich(parent, frame.headline || ctx.story.title || '', x, y, Object.assign({
      size: tall ? 132 : 140, minSize: tall ? 64 : 76, lines: tall ? 5 : 3,
      weight: 500, lh: 1.02, ls: -0.02, balance: true,
    }, o));
    const swashes = hl.runs.filter(r => r.st === 'em' && r.w > 0).map((r, k) =>
      swash(ctx, parent, r.x - hl.size * 0.02, r.x + r.w + hl.size * 0.05, r.y + hl.size * 0.17, hl.size * 0.07, `${ctx.index}-${k}`));
    return { hl, swashes };
  }

  // a tapered brush stroke, slightly rising, filled with the accent
  function swash(ctx, parent, x0, x1, y, th, seed) {
    const r = ctx.rand('swash-' + seed), w = x1 - x0, lift = th * (0.5 + r() * 0.6);
    const d = `M${x0} ${y + th * 0.25}`
      + `C${x0 + w * 0.3} ${y - th * 0.35} ${x0 + w * 0.68} ${y - th * 0.55 - lift} ${x1} ${y - lift - th * 0.15}`
      + `C${x1 - w * 0.02} ${y - lift + th * 0.35} ${x0 + w * 0.7} ${y + th * 0.25 - lift * 0.4} ${x0 + w * 0.32} ${y + th * 0.75}`
      + `C${x0 + w * 0.15} ${y + th * 0.95} ${x0 + w * 0.04} ${y + th * 0.85} ${x0} ${y + th * 0.25}Z`;
    return ctx.rough(ctx.el('path', { d, fill: ctx.t.accent, opacity: 0.92 }, parent), 1);
  }

  // short ink rule + small caps label, e.g. "—— ÜRÜN ÖNERİSİ · VP SUNUMU"
  function label(ctx, parent, str, x, y, o = {}) {
    const g = ctx.el('g', {}, parent), rule = 34, gap = 16;
    const t = ctx.text(g, str, x + rule + gap, y, { font: 'mono', size: o.size || 20, ls: 0.16, upper: true, color: o.color || 'ink2', weight: 500, lines: 1, maxW: o.maxW || 1200 });
    ctx.el('path', { d: `M${x} ${y + t.h / 2}H${x + rule}`, stroke: ctx.t.ink, 'stroke-width': 1.6, opacity: 0.6 }, g);
    return { el: g, h: t.h };
  }

  // tall poster placement: the block's middle sits ~42% down the space between masthead and colophon
  // (the optical centre, a little above the middle), kept clear of both. Returns the block's dy.
  function poster(top, foot, y0, y1) {
    const want = top + (foot - top) * 0.42 - (y0 + y1) / 2;
    return Math.max(top + 70 - y0, Math.min(want, foot - 90 - y1));
  }

  /* ---- kind: open — the cover ---- */
  function open(frame, ctx, w) {
    const { W, H, t, story } = ctx, tall = ctx.aspect === 'tall';
    const M = tall ? 84 : 150, maxW = tall ? W - M * 2 : 1180;
    const block = ctx.el('g', {}, ctx.stage);
    // wide: one centred block (label, headline, sub). tall: a poster — label as a masthead on top,
    // headline and sub in the upper-middle (optical centre), the colophon at the foot.
    let y = 0, lab = null;
    if (story.subtitle) {
      lab = label(ctx, tall ? ctx.stage : block, story.subtitle, M, tall ? 92 : 0, { size: tall ? 26 : 20, maxW: maxW - 50 });
      if (!tall) y = lab.h + 40;
    }
    const { hl, swashes } = headline(ctx, block, frame, M, y, { maxW });
    let bottom = hl.top + hl.h, sub = null;
    if (frame.sub) {
      sub = ctx.rich(block, frame.sub, M, bottom + (tall ? 46 : 42), { font: 'sans', size: tall ? 38 : 34, color: 'ink2', maxW: tall ? maxW : 920, lines: 3, lh: 1.38 });
      bottom = sub.top + sub.h;
    }
    // colophon: a ruled foot line with the story's name and its length
    const cy = H - (tall ? 118 : 96);
    const mast = lab ? 92 + lab.h : 40;
    const dy = Math.round(tall ? poster(mast, cy, hl.top, bottom) : H * 0.47 - bottom / 2);
    block.setAttribute('transform', `translate(0 ${dy})`);
    if (tall && lab && dy + hl.top < mast + 60) ctx.issue('warn', 'title block runs into the masthead; shorten the headline or sub');
    if (dy + bottom > cy - 36) ctx.issue('warn', 'title block runs into the colophon; shorten the headline or sub');
    const foot = ctx.el('g', {}, ctx.stage);
    // hairlines stay clean: the wobble filter breaks strokes thinner than ~2.5 units
    const rule = ctx.el('path', { d: `M${M} ${cy}H${W - M}`, stroke: t.ink, 'stroke-width': tall ? 2 : 1.6, opacity: 0.4, fill: 'none' }, foot);
    if (story.title && story.title !== frame.headline) ctx.text(foot, story.title, M, cy + 22, { size: tall ? 34 : 26, italic: true, weight: 500, maxW: (W - M * 2) * 0.6, lines: 1 });
    const n = story.frames.length;
    ctx.text(foot, `${n} ${w.frames} · ~${ctx.runtime} ${w.sec}`, W - M, cy + (tall ? 28 : 27), { font: 'mono', size: tall ? 25 : 17, ls: 0.08, color: 'muted', anchor: 'end' });

    // motion: label, headline, sub arrive in reading order; the swash is drawn last, under the idea
    if (lab) ctx.beat(lab.el, 'fade', { at: 0, dy: 8 });
    ctx.beat(hl.el, 'fade', { at: 140, dur: 820, dy: 22 });
    if (sub) ctx.beat(sub.el, 'fade', { at: 560, dur: 700, dy: 14 });
    swashes.forEach((s, k) => ctx.beat(s, 'grow', { at: 980 + k * 180, dur: 620, from: 'left' }));
    ctx.beat(rule, 'draw', { at: 700, dur: 1100 });
    [...foot.querySelectorAll('text')].forEach(e => ctx.beat(e, 'fade', { at: 1200, dy: 0 }));
  }

  /* ---- kind: section — a chapter divider ---- */
  function section(frame, ctx, w) {
    const { W, H, t, story } = ctx, tall = ctx.aspect === 'tall';
    // a section counts only among the unlabelled ones; a "label" replaces the counter (e.g. a takeaway)
    const own = typeof frame.label === 'string' && frame.label.trim() ? frame.label.trim() : null;
    const num = story.frames.slice(0, ctx.index + 1).filter(f => f.lens === 'title' && f.kind === 'section' && !(typeof f.label === 'string' && f.label.trim())).length;
    const cx = W / 2, maxW = tall ? W - 150 : 1240;
    const block = ctx.el('g', {}, ctx.stage);
    const lab = ctx.text(block, own || `${w.section} ${String(num).padStart(2, '0')}`, cx, 0, { maxW, lines: 1, font: 'mono', size: tall ? 26 : 20, ls: 0.2, upper: true, color: 'accent', weight: 500, anchor: 'middle' });
    const ruleY = lab.h + 26;
    const rule = ctx.rough(ctx.el('path', { d: `M${cx - 30} ${ruleY}H${cx + 30}`, stroke: t.ink, 'stroke-width': 3, 'stroke-linecap': 'round', fill: 'none' }, block), 1);
    const { hl, swashes } = headline(ctx, block, frame, cx, ruleY + 46, { anchor: 'middle', maxW, size: tall ? 132 : 120, lines: tall ? 5 : 3 });
    let bottom = hl.top + hl.h, sub = null;
    if (frame.sub) {
      sub = ctx.rich(block, frame.sub, cx, bottom + 40, { font: 'sans', size: tall ? 36 : 32, color: 'ink2', maxW: tall ? maxW : 980, lines: 3, lh: 1.38, anchor: 'middle' });
      bottom = sub.top + sub.h;
    }
    block.setAttribute('transform', `translate(0 ${Math.round(H / 2 - bottom / 2)})`);
    ctx.beat(lab.el, 'fade', { at: 0, dy: 8 });
    ctx.beat(rule, 'draw', { at: 200, dur: 500 });
    ctx.beat(hl.el, 'fade', { at: 300, dur: 800, dy: 20 });
    if (sub) ctx.beat(sub.el, 'fade', { at: 700, dur: 700, dy: 12 });
    swashes.forEach((s, k) => ctx.beat(s, 'grow', { at: 1100 + k * 180, dur: 620, from: 'left' }));
  }

  /* ---- kind: close — the calm ending: the takeaway, up to 3 things to keep, the colophon as a bookend ---- */
  function close(frame, ctx, w) {
    const { W, H, t, story } = ctx, tall = ctx.aspect === 'tall';
    const all = Array.isArray(frame.items) ? frame.items : [];
    if (all.length > 3) ctx.issue('warn', `close has ${all.length} items (≤ 3); the rest are left out`);
    if (frame.sign) ctx.issue('warn', 'close has no sign; use kind "ask" for a request');
    const items = all.slice(0, 3);
    const M = tall ? 84 : 150, colW = W - M * 2;
    const block = ctx.el('g', {}, ctx.stage);
    let y = 0, lab = null;
    if (typeof frame.label === 'string' && frame.label.trim()) {
      lab = label(ctx, block, frame.label, M, 0, { size: tall ? 24 : 19, color: 'accent', maxW: colW - 50 });
      y = lab.h + (tall ? 40 : 32);
    }
    const { hl, swashes } = headline(ctx, block, frame, M, y, { maxW: tall ? colW : 1180, size: tall ? 124 : 116, minSize: tall ? 60 : 68, lines: tall ? 4 : 2 });
    let bottom = hl.top + hl.h, sub = null;
    if (frame.sub) {
      sub = ctx.rich(block, frame.sub, M, bottom + (tall ? 40 : 34), { font: 'sans', size: tall ? 36 : 30, color: 'ink2', maxW: tall ? colW : 980, lines: 3, lh: 1.38 });
      bottom = sub.top + sub.h;
    }
    // the things to keep: side by side in wide (the story in a row), stacked in tall; each under a hairline
    const rows = [];
    if (items.length) {
      const top = bottom + (tall ? 70 : 64), gap = 56;
      const n = items.length, cw = tall ? colW : (colW - gap * (n - 1)) / n;
      let ty = top;
      items.forEach((it, k) => {
        const x = tall ? M : M + k * (cw + gap), y0 = tall ? ty : top;
        const row = ctx.el('g', {}, block);
        const rule = ctx.el('path', { d: `M${x} ${y0}H${x + cw}`, stroke: t.ink, 'stroke-width': 1.4, opacity: 0.28, fill: 'none' }, row);
        const num = ctx.text(row, String(k + 1).padStart(2, '0'), x, y0 + 20, { font: 'mono', size: tall ? 24 : 18, color: 'accent', weight: 500, ls: 0.08 });
        const txt = ctx.rich(row, it, x, num.top + num.h + 12, { size: tall ? 42 : 34, maxW: cw, lines: tall ? 2 : 3, lh: 1.2 });
        bottom = Math.max(bottom, txt.top + txt.h);
        ty = txt.top + txt.h + 30;
        rows.push({ row, rule });
      });
    }
    // colophon: the open frame's foot line again, closing the book
    const cy = H - (tall ? 118 : 96);
    const dy = Math.round(tall ? poster(70, cy, lab ? 0 : hl.top, bottom) : Math.min(H * 0.45 - bottom / 2, cy - 70 - bottom));
    block.setAttribute('transform', `translate(0 ${dy})`);
    if (dy + bottom > cy - 36) ctx.issue('warn', 'close runs into the colophon; shorten the headline or items');
    const foot = ctx.el('g', {}, ctx.stage);
    const rule = ctx.el('path', { d: `M${M} ${cy}H${W - M}`, stroke: t.ink, 'stroke-width': tall ? 2 : 1.6, opacity: 0.4, fill: 'none' }, foot);
    if (story.title && story.title !== frame.headline) ctx.text(foot, story.title, M, cy + 22, { size: tall ? 34 : 26, italic: true, weight: 500, maxW: (W - M * 2) * 0.6, lines: 1 });
    ctx.text(foot, w.end, W - M, cy + (tall ? 28 : 27), { font: 'mono', size: tall ? 25 : 17, ls: 0.14, upper: true, color: 'muted', anchor: 'end' });

    // motion: calm, in reading order; nothing breathes, the story is over
    if (lab) ctx.beat(lab.el, 'fade', { at: 0, dy: 8 });
    ctx.beat(hl.el, 'fade', { at: 120, dur: 820, dy: 18 });
    if (sub) ctx.beat(sub.el, 'fade', { at: 480, dur: 650, dy: 12 });
    swashes.forEach((s, k) => ctx.beat(s, 'grow', { at: 900 + k * 180, dur: 620, from: 'left' }));
    rows.forEach((r, k) => {
      ctx.beat(r.rule, 'grow', { at: 700 + k * 220, dur: 700, from: 'left' });
      [...r.row.querySelectorAll('text')].forEach(e => ctx.beat(e, 'fade', { at: 820 + k * 220, dur: 600, dy: 10 }));
    });
    ctx.beat(rule, 'draw', { at: 1000, dur: 1100 });
    [...foot.querySelectorAll('text')].forEach(e => ctx.beat(e, 'fade', { at: 1500, dy: 0 }));
  }

  /* ---- kind: ask — the closing request, with an empty stamp waiting for a yes ---- */
  function ask(frame, ctx, w) {
    const { W, H, t } = ctx, tall = ctx.aspect === 'tall';
    const items = Array.isArray(frame.items) ? frame.items : [];
    if (items.length > 3) ctx.issue('warn', `ask has ${items.length} items (≤ 3)`);
    const hasSign = !!frame.sign;
    const M = tall ? 84 : 150, colW = tall ? W - M * 2 : hasSign ? 820 : 1180;
    const block = ctx.el('g', {}, ctx.stage);
    const { hl, swashes } = headline(ctx, block, frame, M, 0, { maxW: colW, size: tall ? 140 : 136, lines: tall ? 4 : 3 });
    let y = hl.top + hl.h, sub = null;
    if (frame.sub) {
      sub = ctx.rich(block, frame.sub, M, y + 34, { font: 'sans', size: tall ? 36 : 32, color: 'ink2', maxW: colW, lines: 3, lh: 1.38 });
      y = sub.top + sub.h;
    }
    const rows = [];
    if (items.length) {
      y += tall ? 64 : 54;
      const rowFont = tall ? 46 : 38, numW = tall ? 78 : 64;
      items.forEach((it, k) => {
        const row = ctx.el('g', {}, block);
        const rule = ctx.el('path', { d: `M${M} ${y}H${M + colW}`, stroke: t.ink, 'stroke-width': 1.4, opacity: 0.28, fill: 'none' }, row);
        const txt = ctx.rich(row, it, M + numW, y + 24, { size: rowFont, maxW: colW - numW, lines: 2, lh: 1.2 });
        ctx.text(row, String(k + 1).padStart(2, '0'), M, txt.baseline, { font: 'mono', size: tall ? 26 : 18, color: 'accent', weight: 500, ls: 0.08, valign: 'baseline' });
        y = txt.top + txt.h + 24;
        rows.push({ row, rule });
      });
      rows.push({ rule: ctx.el('path', { d: `M${M} ${y}H${M + colW}`, stroke: t.ink, 'stroke-width': 1.4, opacity: 0.28, fill: 'none' }, block) });
    }
    const bottom = y;

    // place: wide → column centred on the left, stamp on the right; tall → column high, stamp below
    let sign = null;
    if (!hasSign) {
      block.setAttribute('transform', `translate(0 ${Math.round(H * 0.48 - bottom / 2)})`);
    } else if (!tall) {
      block.setAttribute('transform', `translate(0 ${Math.round(H * 0.5 - bottom / 2)})`);
      sign = drawSign(ctx, frame.sign, W - 340, H * 0.5, 1, w);
    } else {
      const s = 1.1, sh = 260 * s;
      const top = Math.max(110, Math.round((H - (bottom + 90 + sh)) / 2 - 20));
      block.setAttribute('transform', `translate(0 ${top})`);
      const cy = Math.min(top + bottom + 90 + sh / 2, H - 70 - sh / 2);
      if (top + bottom + 40 > cy - sh / 2) ctx.issue('warn', 'ask content runs into the sign; shorten the headline or items');
      sign = drawSign(ctx, frame.sign, W / 2, cy, s, w);
    }

    // motion: the ask lands, the terms list in, then the empty stamp is drawn and gently breathes
    ctx.beat(hl.el, 'fade', { at: 80, dur: 800, dy: 20 });
    if (sub) ctx.beat(sub.el, 'fade', { at: 420, dur: 650, dy: 12 });
    swashes.forEach((s, k) => ctx.beat(s, 'grow', { at: 820 + k * 180, dur: 600, from: 'left' }));
    rows.forEach((r, k) => {
      ctx.beat(r.rule, 'grow', { at: 520 + k * 170, dur: 700, from: 'left' });
      if (r.row) [...r.row.querySelectorAll('text')].forEach(e => ctx.beat(e, 'fade', { at: 640 + k * 170, dur: 560, dy: 10 }));
    });
    if (sign) {
      const at = 1100 + rows.length * 120;
      ctx.beat(sign.frame, 'draw', { at, dur: 1100 });
      ctx.beat(sign.label, 'fade', { at: at + 650, dur: 500, dy: 0 });
      ctx.beat(sign.line, 'fade', { at: at + 900, dur: 500, dy: 0 });
      ctx.anim(sign.el, [{ transform: 'scale(1)' }, { transform: 'scale(1.025)' }, { transform: 'scale(1)' }],
        { at: at + 1800, duration: 3800, iterations: Infinity, easing: 'ease-in-out', fill: 'none' });
    }
  }

  // the sign: a double-ruled rubber stamp in the accent, label on top, an empty signature line below
  function drawSign(ctx, text, cx, cy, s, w) {
    const W0 = 430 * s, H0 = 260 * s;
    const st = ctx.stamp(ctx.stage, text, cx, cy, { w: W0, h: H0, size: 46 * s, rotate: -6, labelY: H0 * 0.3 });
    const line = ctx.el('g', {}, st.inner);
    const ly = st.y0 + H0 * 0.74, lx0 = st.x0 + 46 * s, lx1 = st.x0 + W0 - 46 * s;
    ctx.el('path', { d: `M${lx0} ${ly}H${lx1}`, stroke: ctx.t.accent, 'stroke-width': 2 * s, 'stroke-dasharray': `${3 * s} ${7 * s}`, 'stroke-linecap': 'round', fill: 'none' }, line);
    ctx.text(line, w.sign, lx0, ly + 14 * s, { font: 'mono', size: (ctx.aspect === 'tall' ? 20 : 15) * s, color: 'accent', ls: 0.14, upper: true });
    ctx.text(line, w.date, lx1, ly + 14 * s, { font: 'mono', size: (ctx.aspect === 'tall' ? 20 : 15) * s, color: 'accent', ls: 0.14, upper: true, anchor: 'end' });
    const frame = ctx.el('g', {}, st.inner);
    st.inner.querySelectorAll(':scope > rect').forEach(r => frame.appendChild(r));
    st.inner.insertBefore(frame, st.inner.firstChild);
    return { el: st.el, frame, label: st.label, line };
  }
})();
