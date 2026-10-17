/* chalk-talk frames · lens: flow  (zukai 図解 business diagram + the code dialect)
 *
 * Fields: actors [{ id, kind, label, sub, at: [col,row] (4×3 grid), members (group), state, code }],
 *         flows [{ from, to, type, label, value, new, state, code, calls, inferred, proof }],
 *         continue (build on the previous flow frame), compare (before/after toggle), focus [actor ids].
 *
 * How it works:
 *  - Layout is computed on the UNION of everything the diagram will ever show: all states and every frame
 *    of a `continue` chain (back to the base frame and forward to the last continuing frame). So actors,
 *    routes and labels never jump between build-up frames or when the before/after chip is toggled;
 *    each render only decides what is visible and what arrives.
 *  - Grid: only the used columns/rows take room; columns/rows grow for wide groups and for the labels
 *    between joined neighbours. Tall re-flows the grid (columns become rows) when the diagram is wider than
 *    high, or when that is clearly less crowded. A sparse diagram zooms up (pictograms, type, lines, gaps) until
 *    it fills the stage, and the fit may grow it a little more; rows spread to use the height.
 *  - A group stretches over the free cells above/below it in its column (a place, like the zukai "masa"), meets
 *    each neighbour on that neighbour's row, and takes a generous share of its cells (members grow with it),
 *    never eating the room its neighbours' flow labels need. Skipped when stretching would crowd a full stage.
 *  - The legend is one quiet strip just above the drawing, flush with its right edge (left when a stamp is there).
 *  - Routing is orthogonal with rounded corners: straight, L, or Z/U through the channels between cells,
 *    scored by actor cells crossed, then by crossings/overlaps with the other flows. Lanes split flows
 *    sharing an actor side (nested turns never cross; request/response pairs sit a pill apart).
 *  - Flow labels + value pills are placed by scoring spots along the route (on the line or beside it)
 *    against actors, labels and other lines; misses are reported with ctx.issue.
 *  - Ink: solid pictograms with the wobble filter; lines bow a hair per straight run (seeded) instead,
 *    because the filter breaks thin and dashed strokes. Out-of-focus flows are faded ink, not opacity.
 *  - Motion: actors arrive, then each flow draws along its route (a mask that exists only while drawing),
 *    its value pill rides the tip to its spot, accent (new) flows last. `continue` frames animate only what
 *    they add; toggling the chip fades out what leaves and draws what comes.
 *  - Code dialect: tech actor kinds (server db queue fn browser cloud) and proof marks on flow labels from
 *    flow.proof (injected by build.mjs): ✓ verified/cited, ? inferred/unproven, ! broken; why as <title>.
 */
(function () {
  'use strict';

  const WORDS = {
    tr: { money: 'para', goods: 'ürün', info: 'bilgi', link: 'link', request: 'istek', response: 'yanıt', event: 'olay', data: 'veri', new: 'yeni',
          verified: 'koda bağlı, doğrulandı', cited: 'koda bağlı', inferred: 'tahmin', unproven: 'kanıt yok', broken: 'kırık' },
    en: { money: 'money', goods: 'goods', info: 'info', link: 'link', request: 'request', response: 'response', event: 'event', data: 'data', new: 'new',
          verified: 'traced to code, verified', cited: 'traced to code', inferred: 'inferred', unproven: 'no evidence', broken: 'broken' },
  };
  const TYPES = ['money', 'goods', 'info', 'link', 'request', 'response', 'event', 'data'];
  // one consistent line per type (wide units; tall ×1.12): weight, dash, double rail, head shape.
  const STYLE = {
    money:    { w: 4.6, head: 'fill', hl: 20, hw: 10 },
    goods:    { w: 16, inner: 7, head: 'hollow', hl: 26, hw: 17 },
    info:     { w: 2.8, head: 'open', hl: 15, hw: 8.5 },
    link:     { w: 4.6, dash: [0.01, 11], head: 'open', hl: 15, hw: 9 },
    request:  { w: 3.2, head: 'fill', hl: 17, hw: 8 },
    response: { w: 3, dash: [12, 9], head: 'open', hl: 15, hw: 8.5 },
    event:    { w: 3, dash: [18, 8, 0.01, 8], head: 'open', hl: 15, hw: 8.5, tail: true },
    data:     { w: 10, inner: 4, head: 'fill', hl: 20, hw: 11 },
  };
  const EASE_DRAW = 'cubic-bezier(.55,.05,.3,1)';

  // solid ink pictograms, 48×48: K = ink, P = paper (cut-outs). The zukai vocabulary.
  const win = (xs, ys, s = 4) => xs.flatMap(x => ys.map(y => `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="P"/>`)).join('');
  const PICTO = {
    person: '<circle cx="24" cy="12.5" r="8.5" fill="K"/><path d="M7.5 44v-7.5C7.5 29.6 13 25 20 25h8c7 0 12.5 4.6 12.5 11.5V44z" fill="K"/>',
    group: '<circle cx="31.5" cy="11" r="7" fill="K"/><path d="M19 38v-6c0-6 4.6-10 10.5-10h4C39.4 22 44 26 44 32v6z" fill="K"/>'
      + '<circle cx="17" cy="16" r="8" fill="K" stroke="P" stroke-width="2.6"/><path d="M2.5 45v-6.5C2.5 32 7.4 28 14 28h6c6.6 0 11.5 4 11.5 10.5V45z" fill="K" stroke="P" stroke-width="2.6"/>',
    company: '<path d="M8 45V8l21-4v41z" fill="K"/><path d="M29 45V17h12v28z" fill="K"/>' + win([12.5, 20], [11, 18, 25]) + win([33.5], [21, 28, 35])
      + '<rect x="14.5" y="35" width="7" height="10" fill="P"/>',
    app: '<rect x="12" y="3" width="24" height="42" rx="5" fill="K"/><rect x="15" y="8" width="18" height="30" rx="1.5" fill="P"/>'
      + '<rect x="17.5" y="11.5" width="5.5" height="5.5" rx="1.4" fill="K"/><rect x="25" y="11.5" width="5.5" height="5.5" rx="1.4" fill="K"/>'
      + '<rect x="17.5" y="19" width="5.5" height="5.5" rx="1.4" fill="K"/><rect x="25" y="19" width="5.5" height="5.5" rx="1.4" fill="K"/>'
      + '<rect x="21" y="40.5" width="6" height="2" rx="1" fill="P"/>',
    phone: '<rect x="12" y="3" width="24" height="42" rx="5" fill="K"/><rect x="15" y="9" width="18" height="29" rx="1.5" fill="P"/>'
      + '<rect x="21" y="5.2" width="6" height="1.8" rx=".9" fill="P"/><circle cx="24" cy="41.5" r="1.8" fill="P"/>'
      + '<rect x="18" y="14" width="12" height="3" rx="1.5" fill="K"/><rect x="18" y="20" width="8" height="3" rx="1.5" fill="K"/>',
    store: '<path d="M5 4h38l3.5 11h-45z" fill="K"/><path d="M1.5 15a5.6 5.6 0 0 0 11.25 0a5.6 5.6 0 0 0 11.25 0a5.6 5.6 0 0 0 11.25 0a5.6 5.6 0 0 0 11.25 0z" fill="K"/>'
      + '<path d="M6.5 21v23h35V21" fill="none" stroke="K" stroke-width="3.4"/><rect x="27" y="29" width="9" height="15" fill="K"/>'
      + '<rect x="11.5" y="27.5" width="10" height="8" fill="none" stroke="K" stroke-width="2.6"/>',
    bank: '<path d="M24 3 45 14H3z" fill="K"/><circle cx="24" cy="10" r="2.6" fill="P"/><rect x="4" y="15.5" width="40" height="3.5" fill="K"/>'
      + [8, 17, 26.5, 35.5].map(x => `<rect x="${x}" y="21" width="4.5" height="16" fill="K"/>`).join('')
      + '<rect x="5" y="38.5" width="38" height="3" fill="K"/><rect x="2.5" y="42.5" width="43" height="3" fill="K"/>',
    payment: '<rect x="2" y="10" width="44" height="29" rx="4.5" fill="K"/><rect x="2" y="16" width="44" height="5.5" fill="P"/><rect x="8" y="28" width="12" height="5" rx="1.5" fill="P"/>',
    truck: '<path d="M2 10h28v25H2z" fill="K"/><path d="M31.5 17H39l7 9v9H31.5z" fill="K"/><path d="M34.5 20h3.5l4.5 6h-8z" fill="P"/>'
      + '<circle cx="11" cy="37.5" r="5.2" fill="K" stroke="P" stroke-width="2.4"/><circle cx="38" cy="37.5" r="5.2" fill="K" stroke="P" stroke-width="2.4"/>',
    warehouse: '<path d="M2 17 24 5l22 12v28H2z" fill="K"/><rect x="12" y="25" width="24" height="20" fill="P"/><path d="M12 30.5h24M12 35.5h24M12 40.5h24" stroke="K" stroke-width="2.6"/>',
    doc: '<path d="M9 3h20l10 10v32H9z" fill="K"/><path d="M29 3.5V13h9.5z" fill="P"/>'
      + '<rect x="14" y="20" width="20" height="3" rx="1.5" fill="P"/><rect x="14" y="27" width="20" height="3" rx="1.5" fill="P"/><rect x="14" y="34" width="13" height="3" rx="1.5" fill="P"/>',
    server: '<rect x="5" y="5" width="38" height="17" rx="3" fill="K"/><rect x="5" y="26" width="38" height="17" rx="3" fill="K"/>'
      + '<circle cx="11.5" cy="13.5" r="2.3" fill="P"/><circle cx="11.5" cy="34.5" r="2.3" fill="P"/>'
      + '<rect x="25" y="12" width="12" height="3" rx="1.5" fill="P"/><rect x="25" y="33" width="12" height="3" rx="1.5" fill="P"/>',
    db: '<path d="M7 10v28c0 3.9 7.6 7 17 7s17-3.1 17-7V10z" fill="K"/><ellipse cx="24" cy="10" rx="17" ry="7" fill="K"/>'
      + ['M7 11.5c0 3.9 7.6 7 17 7s17-3.1 17-7', 'M7 22c0 3.9 7.6 7 17 7s17-3.1 17-7', 'M7 32c0 3.9 7.6 7 17 7s17-3.1 17-7']
        .map(d => `<path d="${d}" fill="none" stroke="P" stroke-width="2.4"/>`).join(''),
    queue: '<rect x="3" y="9" width="11" height="20" rx="2.5" fill="K"/><rect x="18.5" y="9" width="11" height="20" rx="2.5" fill="K"/>'
      + '<rect x="35.5" y="10.5" width="9" height="17" rx="2" fill="none" stroke="K" stroke-width="3"/>'
      + '<path d="M5 38.5h31" stroke="K" stroke-width="3.2" stroke-linecap="round"/><path d="M35 33l8 5.5-8 5.5z" fill="K"/>',
    fn: '<rect x="4" y="4" width="40" height="40" rx="9" fill="K"/><path d="M16 12.5h3.5c1.4 0 2.3.6 2.9 2L33 36" fill="none" stroke="P" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/>'
      + '<path d="M25.5 22.5 16 36" fill="none" stroke="P" stroke-width="3.8" stroke-linecap="round"/>',
    browser: '<rect x="2" y="6" width="44" height="36" rx="4" fill="K"/><rect x="5" y="15" width="38" height="24" rx="1.5" fill="P"/>'
      + '<circle cx="8" cy="10.5" r="1.7" fill="P"/><circle cx="13.5" cy="10.5" r="1.7" fill="P"/><circle cx="19" cy="10.5" r="1.7" fill="P"/>'
      + '<rect x="9" y="20" width="18" height="3.5" rx="1.75" fill="K"/><rect x="9" y="27" width="28" height="2.6" rx="1.3" fill="K"/><rect x="9" y="32.5" width="22" height="2.6" rx="1.3" fill="K"/>',
    cloud: '<path d="M13.5 39C7.7 39 3 34.9 3 29.5c0-5 3.9-9 9-9.4C13.4 13.6 19 9 25.5 9c7.3 0 13.2 5.6 13.8 12.7C43.2 22.6 46 26 46 30.2 46 35 42 39 37 39z" fill="K"/>',
  };

  // core's ctx.icon set (SPEC): any of these is a valid actor kind too, drawn as the core line icon
  const CORE_ICONS = new Set(('person group store bank card money phone laptop server db queue doc truck box clock check cross link chat mail '
    + 'key lock gear chart star heart bolt globe home cart bag food coffee car calendar flag search eye warn sparkle').split(' '));
  const MEM = new WeakMap();   // last render per stage → detects a before/after toggle
  const arr = v => (Array.isArray(v) ? v : v == null ? [] : [v]);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sum = a => a.reduce((s, v) => s + v, 0);
  const r1 = v => Math.round(v * 10) / 10;
  const mix = (a, b, k) => {   // #rrggbb blend, for faded (out of focus) ink
    const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), A = p(a), B = p(b);
    return /^#[0-9a-f]{6}$/i.test(a) && /^#[0-9a-f]{6}$/i.test(b) ? '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('') : a;
  };

  chalk.lens('flow', { render: draw });

  function draw(frame, ctx) {
    const { W, t } = ctx, tall = ctx.aspect === 'tall';
    const w = WORDS[String(ctx.lang).slice(0, 2)] || WORDS.en;
    // sizes at zoom 1 (the smallest a flow frame gets); the layout zooms them up to fill the stage
    const Z0 = tall
      ? { S: 94, name: 34, sub: 27, lab: 30, pill: 27, leg: 26, tab: 26, mem: 28, memS: 66, lane: 28, r: 28, gap: 12, nameW: 280, k: 1.12,
          gx: 70, gy: 120, labW: 300, capC: 430, capR: 340, cw: 168, mark: 15 }
      : { S: 84, name: 28, sub: 21, lab: 23, pill: 22, leg: 19, tab: 19, mem: 23, memS: 64, lane: 24, r: 26, gap: 10, nameW: 300, k: 1,
          gx: 100, gy: 100, labW: 300, capC: 440, capR: 380, cw: 140, mark: 12 };
    const ZMAX = tall ? 1.3 : 1.42, FILL = 0.94;
    const zoomed = z => { const o = { u: z }; for (const k in Z0) o[k] = Z0[k] * z; o.k = Z0.k * Math.sqrt(z); return o; };
    const fontsOf = Z => ({ name: { font: 'sans', weight: 600, size: Z.name, lh: 1.12 }, sub: { font: 'sans', weight: 400, size: Z.sub, lh: 1.2 },
      lab: { font: 'sans', weight: 500, size: Z.lab, lh: 1.15 }, pill: { font: 'mono', weight: 500, size: Z.pill, lh: 1 },
      mem: { font: 'sans', weight: 500, size: Z.mem, lh: 1.1 } });
    let Z = zoomed(1), FN = fontsOf(Z);

    /* ---- what exists (union, for layout) and what this frame shows ---- */
    const F = ctx.story.frames;
    const { chain, group } = chainOf(ctx, F);
    const U = collect(ctx, F, group, false), C = collect(ctx, F, chain, true);
    if (!U.actors.size) { ctx.issue('warn', 'flow frame has no actors'); return; }
    const state = frame.compare && ctx.state === 'before' ? 'before' : 'after';
    const other = state === 'after' ? 'before' : 'after';
    const vA = (Cx, id, s) => { const a = Cx.actors.get(id); return !!a && (!a.state || a.state === s); };
    const vF = (Cx, x, s) => (!x.state || x.state === s) && vA(Cx, x.from, s) && vA(Cx, x.to, s);
    const visA = (id, s) => vA(C, id, s), visF = (x, s) => vF(C, x, s);
    const mem = MEM.get(ctx.stage);
    const toggle = !!(frame.compare && mem && mem.index === ctx.index && mem.aspect === ctx.aspect && mem.state !== state);
    MEM.set(ctx.stage, { index: ctx.index, aspect: ctx.aspect, state });
    const mode = (item, vis) => {          // static | enter | leave | null
      const now = vis(item, state);
      if (toggle) { const was = vis(item, other); return now && was ? 'static' : now ? 'enter' : was ? 'leave' : null; }
      return now ? (item._k === ctx.index ? 'enter' : 'static') : null;
    };
    if (frame.compare && ![...C.actors.values(), ...C.flows].some(x => x.state)) ctx.issue('warn', '"compare": true but nothing has a "state"; the toggle changes nothing');

    /* ---- legend: only the types on screen (both states on a compare frame, so it never jumps) ---- */
    const shown = C.flows.filter(x => visF(x, state) || (frame.compare && visF(x, other)));
    const types = TYPES.filter(ty => shown.some(x => x.type === ty));
    const accentOf = x => x._newAt === ctx.index;
    const hasNew = shown.some(accentOf);
    const leg = legend(ctx, types, hasNew, w, Z0, tall, !!frame.stamp);

    /* ---- grid ---- */
    const cells = placeCells(ctx, U.actors);
    const cs = [...cells.values()];
    const c0 = Math.min(...cs.map(c => c[0])), c1 = Math.max(...cs.map(c => c[0]));
    const rr0 = Math.min(...cs.map(c => c[1])), rr1 = Math.max(...cs.map(c => c[1]));
    const A = tall ? { x0: 40, x1: W - 40, y0: leg.bottom + 44, y1: 1366 } : { x0: 70, x1: W - 70, y0: Math.max(leg.bottom + 34, frame.stamp ? 126 : 0), y1: 868 };

    const nodes = new Map();
    for (const a of U.actors.values()) nodes.set(a.id, { id: a.id, a, cell: cells.get(a.id), members: membersOf(ctx, a) });
    const sizeNodes = () => nodes.forEach(n => {   // footprint of every actor at the current zoom
      const a = n.a;
      if (a.kind === 'group' && n.members.length) Object.assign(n, groupGeom(ctx, a, n.members, Z));
      else {
        const nm = est(ctx, a.label != null ? a.label : a.id, FN.name, Z.nameW, 2), sb = a.sub ? est(ctx, a.sub, FN.sub, Z.nameW, 2) : null;
        Object.assign(n, { fw: Math.max(Z.S, nm.w, sb ? sb.w : 0), fh: Z.S + 12 * Z.u + nm.h + (sb ? sb.h + 4 : 0) });
      }
    });
    sizeNodes();
    const sizes = (need, span, cap) => {
      const base = Math.min(span / need.length, cap);
      let s = need.map(v => Math.max(base, v));
      const tot = sum(s);
      if (tot > span) s = s.map(v => v * span / tot);
      return s;
    };
    // what every column / row needs: its widest actor, plus room for the labels between joined neighbours
    // the row of n that faces o (a stretched group meets each neighbour on its own row)
    const rowOf = (n, o) => clamp(o.gr, n.r0, n.r1), edgeRow = (n, ch) => (ch > n.r1 ? n.r1 : n.r0);
    const tw = x => Math.max(x.label ? est(ctx, x.label, FN.lab, Z.labW, 2).w : 0, x.value ? ctx.measure(String(x.value), FN.pill) + Z.pill * 1.15 : 0);
    const th = x => Math.max(x.value ? Z.pill * 1.7 : 0, x.label ? Z.lab * 1.2 : 0) + 22 * Z.u;
    const needs = (flip, stretch = true) => {
      const nc = (flip ? rr1 - rr0 : c1 - c0) + 1, nr = (flip ? c1 - c0 : rr1 - rr0) + 1;
      nodes.forEach(n => { const [c, r] = n.cell; n.gc = flip ? r - rr0 : c - c0; n.gr = n.r0 = n.r1 = flip ? c - c0 : r - rr0; });
      // a group with free cells above / below it in its column stretches over them: a place, not a dot
      const taken = new Set([...nodes.values()].map(n => n.gc + ',' + n.gr)), free = (c, r) => !taken.has(c + ',' + r);
      nodes.forEach(n => {
        if (!n.group || !stretch) return;
        while (n.r0 > 0 && free(n.gc, n.r0 - 1)) taken.add(n.gc + ',' + --n.r0);
        while (n.r1 < nr - 1 && free(n.gc, n.r1 + 1)) taken.add(n.gc + ',' + ++n.r1);
      });
      const colNeed = Array(nc).fill(0), rowNeed = Array(nr).fill(0);
      nodes.forEach(n => {
        colNeed[n.gc] = Math.max(colNeed[n.gc], n.fw + Z.gx);
        for (let r = n.r0; r <= n.r1; r++) rowNeed[r] = Math.max(rowNeed[r], (n.fh + Z.gy) / (n.r1 - n.r0 + 1));
      });
      const pairs = new Map();
      for (const x of U.flows) {
        const a = nodes.get(x.from), b = nodes.get(x.to);
        if (!a || !b || a === b || Math.abs(a.gc - b.gc) + Math.abs(rowOf(a, b) - rowOf(b, a)) !== 1) continue;
        const k = [a.id, b.id].sort().join('\u0000');
        if (!pairs.has(k)) pairs.set(k, { a, b, list: [] });
        pairs.get(k).list.push(x);
      }
      pairs.forEach(({ a, b, list }) => {
        const end = (n, k) => (n.group ? n[k] / 2 : Z.S / 2 + Z.gap);
        if (rowOf(a, b) === rowOf(b, a)) {
          const need = Math.max(...list.map(tw)) + 70 * Z.u + end(a, 'fw') + end(b, 'fw');
          for (const c of [a.gc, b.gc]) colNeed[c] = Math.max(colNeed[c], need);
        } else {
          const need = sum(list.map(th)) + 60 * Z.u + end(a, 'fh') + end(b, 'fh') + (a.group || b.group ? 0 : Z.name * 1.2);
          for (const r of [rowOf(a, b), rowOf(b, a)]) rowNeed[r] = Math.max(rowNeed[r], need);
        }
      });
      return { stretch, nc, nr, colNeed, rowNeed, crowd: Math.max(sum(colNeed) / (A.x1 - A.x0), sum(rowNeed) / (A.y1 - A.y0)) };
    };
    // wide keeps the author's grid; tall turns it (columns become rows) when it is wider than high, or when
    // turning it is clearly less crowded
    // a stretched group must not make a full stage more crowded
    const needs2 = f => { const g = needs(f); if (g.crowd <= 1) return g; const g2 = needs(f, false); return g2.crowd < g.crowd ? g2 : needs(f); };
    let flip = tall && (c1 - c0) > (rr1 - rr0), G = needs2(flip);
    if (tall && G.crowd > 1) { const G2 = needs2(!flip); if (G2.crowd < G.crowd * 0.9) { flip = !flip; G = G2; } else G = needs2(flip); }
    // zoom: a sparse diagram grows (pictograms, type, lines, gaps) until it fills the stage; crowd ~ zoom
    const zoom = clamp(FILL / G.crowd, 1, ZMAX);
    if (zoom > 1.01) { Z = zoomed(zoom); FN = fontsOf(Z); sizeNodes(); G = needs(flip, G.stretch); }
    const { nc, nr, colNeed, rowNeed } = G;
    const centers = (s, mid) => { let x = mid - sum(s) / 2; return s.map(v => { const c = x + v / 2; x += v; return c; }); };
    const colW = sizes(colNeed, A.x1 - A.x0, Z.capC), rowH = sizes(rowNeed, A.y1 - A.y0, Z.capR);
    const X = centers(colW, (A.x0 + A.x1) / 2), Y = centers(rowH, (A.y0 + A.y1) / 2);
    nodes.forEach(n => { n.x = X[n.gc]; n.y = (Y[n.r0] + Y[n.r1]) / 2; });
    nodes.forEach(n => {
      if (n.group) {   // a group is a place: it takes a generous share of its cell(s), members spread out
        let aw = colW[n.gc] - Z.gx, ah = sum(rowH.slice(n.r0, n.r1 + 1)) - Z.gy;
        const span = n.r1 > n.r0;
        for (const x of U.flows) {   // ...but keeps the room its neighbours' flow labels need
          const m = nodes.get(x.from === n.id ? x.to : x.to === n.id ? x.from : null);
          if (!m || m === n) continue;
          const mh = m.group ? m.bh / 2 : Z.S / 2 + Z.gap, mw = m.group ? m.bw / 2 : Z.S / 2 + Z.gap;
          if (rowOf(n, m) === rowOf(m, n)) aw = Math.min(aw, 2 * (Math.abs(m.x - n.x) - mw - tw(x) - 70 * Z.u));
          else if (m.gc === n.gc) ah = Math.min(ah, 2 * (Math.abs(m.y - n.y) - mh - th(x) - 60 * Z.u - (m.group ? 0 : Z.name * 1.2)));
        }
        const ms = clamp(Math.min(aw / n.bw, ah / n.bh) * 0.86, 1, 1.4);   // members grow with the room they get
        if (ms > 1.02) Object.assign(n, groupGeom(ctx, n.a, n.members, Z, ms));
        // a stretched group reaches every row it faces, so lines from there meet its side straight on
        const reach = span ? Y[n.r1] - Y[n.r0] + 2 * (Z.lane + 40 * Z.u) : 0;
        const bw = Math.max(n.bw, Math.min(n.bw * 1.12, aw)), bh = Math.max(n.bh, reach, Math.min(n.bh * (span ? 1.25 : 1.12), ah));
        n.cw += (bw - n.bw) * 0.7 / n.cols; n.chh += (bh - n.bh) * 0.6 / n.rows; n.bw = bw; n.bh = bh;
      }
      if (n.group) { n.hw = n.bw / 2 + 4; n.hh = n.bh / 2 + 4; } else n.hw = n.hh = Z.S / 2 + Z.gap;
    });
    // channels between cells (b = boundary after column/row b; -1 and n-1 are the outer margins)
    const chX = b => (b < 0 ? X[0] - colW[0] / 2 : X[b] + colW[b] / 2);
    const chY = b => (b < 0 ? Y[0] - rowH[0] / 2 : Y[b] + rowH[b] / 2);
    {   // two actors in one cell, same state
      const seen = new Map();
      nodes.forEach(n => {
        const key = n.gc + ',' + n.gr, o = seen.get(key);
        if (o && (!o.a.state || !n.a.state || o.a.state === n.a.state)) ctx.issue('warn', `actors "${o.id}" and "${n.id}" share a grid cell`);
        seen.set(key, n);
      });
    }

    const segsP = P => P.slice(1).map((q, k) => ({ a: P[k], b: q, k })), segsOf = pl => segsP(pl.pts);
    const segBox = (s, pad) => ({ x0: Math.min(s.a[0], s.b[0]) - pad, y0: Math.min(s.a[1], s.b[1]) - pad, x1: Math.max(s.a[0], s.b[0]) + pad, y1: Math.max(s.a[1], s.b[1]) + pad });
    const ov = (p, q) => Math.max(0, Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0)) * Math.max(0, Math.min(p.y1, q.y1) - Math.max(p.y0, q.y0));

    // an actor's name + sub: below by default, else above, beside, or (every side taken) beside the line(s)
    // leaving below. u = the sides flows use; offs(n, side) = their lane offsets there
    const labelOf = (n, u, offs) => {
      const half = Z.S / 2, L = {};
      const row = [...nodes.values()].filter(m => m !== n && m.gr === n.gr);
      const near = dir => row.filter(m => (m.x - n.x) * dir > 0).sort((p, q) => Math.abs(p.x - n.x) - Math.abs(q.x - n.x))[0];
      const edgeX = dir => (dir > 0 ? A.x1 + 20 : A.x0 - 20);
      const room = dir => {   // free width beside the icon
        const nb = near(dir), edge = nb ? nb.x - dir * (nb.fw / 2 + 30) : edgeX(dir);
        return Math.abs(edge - n.x) - half - 18;
      };
      // a centred label (below / above) may take its half of the gap to each row neighbour
      const span = dir => {
        const nb = near(dir), d = Math.abs((nb ? nb.x : edgeX(dir)) - n.x);
        return !nb ? 2 * d : nb.group ? 2 * (d - nb.bw / 2 - 16) : d - 24;
      };
      const nameStr = ctx.plain(n.a.label != null ? String(n.a.label) : n.id), nameW1 = ctx.measure(nameStr, FN.name);
      const word = Math.max(...nameStr.split(/\s+/).map(x => ctx.measure(x, FN.name)), n.a.sub ? Math.max(...ctx.plain(String(n.a.sub)).split(/\s+/).map(x => ctx.measure(x, FN.sub))) : 0);
      const colMax = Math.min(Z.nameW, Math.max(colW[n.gc] - 30, Math.min(span(1), span(-1))));
      const opts = ['S', 'N', 'E', 'W'].filter(s => !u.has(s))
        .filter(s => s === 'S' || s === 'N' || room(s === 'E' ? 1 : -1) >= Math.max(word + 4, Math.min(nameW1 * 0.62, 200)));
      L.side = opts[0];
      L.anchor = L.side === 'E' ? 'start' : L.side === 'W' ? 'end' : 'middle';
      L.maxW = !L.side || L.side === 'S' || L.side === 'N' ? colMax : clamp(room(L.side === 'E' ? 1 : -1), 120, Z.nameW);
      L.lx = null;
      if (!L.side) {
        // every side carries a flow: sit below (or above) the icon, beside the vertical line(s) leaving there
        L.side = offs(n, 'S').length <= offs(n, 'N').length ? 'S' : 'N';
        const o = offs(n, L.side), hi = Math.max(...o) + 16, lo = Math.min(...o) - 16;
        const right = room(1) + half - hi, left = room(-1) + half + lo;
        if (right >= left) { L.anchor = 'start'; L.lx = n.x + hi; L.maxW = clamp(right, 110, Z.nameW); }
        else { L.anchor = 'end'; L.lx = n.x + lo; L.maxW = clamp(left, 110, Z.nameW); }
      }
      const nm = est(ctx, n.a.label != null ? n.a.label : n.id, FN.name, L.maxW, 2), sb = n.a.sub ? est(ctx, n.a.sub, FN.sub, L.maxW, 2) : null;
      const lw = Math.max(nm.w, sb ? sb.w : 0), lh = nm.h + (sb ? sb.h + 4 : 0), gap = 12;
      L.nm = nm; L.sb = sb;
      if (L.side === 'E') L.lx = n.x + half + 18;
      if (L.side === 'W') L.lx = n.x - half - 18;
      if (L.lx == null) L.lx = n.x;
      const x0 = L.anchor === 'start' ? L.lx : L.anchor === 'end' ? L.lx - lw : L.lx - lw / 2;
      const y0 = L.side === 'S' ? n.y + half + gap : L.side === 'N' ? n.y - half - gap - lh : n.y - lh / 2;
      L.lbox = { x0, y0, x1: x0 + lw, y1: y0 + lh };
      return L;
    };

    /* ---- routes ---- */
    const flows =U.flows.filter(x => nodes.has(x.from) && nodes.has(x.to) && x.from !== x.to);
    const occ = new Set([...nodes.values()].flatMap(n => { const o = []; for (let r = n.r0; r <= n.r1; r++) o.push(n.gc + ',' + r); return o; }));
    const isOcc = (c, r) => (occ.has(c + ',' + r) ? 1 : 0);
    const between = (a, b) => { const out = []; for (let k = Math.floor(Math.min(a, b)) + 1; k < Math.max(a, b); k++) out.push(k); return out; };
    const blkH = (r, ca, cb) => sum(between(ca, cb).map(c => isOcc(c, r)));
    const blkV = (c, ra, rb) => sum(between(ra, rb).map(r => isOcc(c, r)));
    const plans = flows.map((f, i) => {
      const a = nodes.get(f.from), b = nodes.get(f.to), ar = rowOf(a, b), br = rowOf(b, a), dc = b.gc - a.gc, dr = br - ar, cands = [];
      if (!dr) cands.push({ shape: 'h', sa: dc > 0 ? 'E' : 'W', sb: dc > 0 ? 'W' : 'E', score: blkH(ar, a.gc, b.gc) * 10 + Math.abs(dc) * 0.3 });
      if (!dc) cands.push({ shape: 'v', sa: dr > 0 ? 'S' : 'N', sb: dr > 0 ? 'N' : 'S', score: blkV(a.gc, ar, br) * 10 + Math.abs(dr) * 0.3 });
      if (dc && dr) {
        const len = (Math.abs(dc) + Math.abs(dr)) * 0.3, pref = tall ? 'vh' : 'hv';
        cands.push({ shape: 'hv', sa: dc > 0 ? 'E' : 'W', sb: dr > 0 ? 'N' : 'S', score: (isOcc(b.gc, ar) + blkH(ar, a.gc, b.gc) + blkV(b.gc, ar, br)) * 10 + len + (pref === 'hv' ? 0 : 0.05) });
        cands.push({ shape: 'vh', sa: dr > 0 ? 'S' : 'N', sb: dc > 0 ? 'W' : 'E', score: (isOcc(a.gc, br) + blkV(a.gc, ar, br) + blkH(br, a.gc, b.gc)) * 10 + len + (pref === 'vh' ? 0 : 0.05) });
      }
      for (let k = -1; k < nc && dr; k++) {
        const ch = k + 0.5;
        cands.push({ shape: 'hvh', ch: k, sa: ch > a.gc ? 'E' : 'W', sb: ch > b.gc ? 'E' : 'W',
          score: (blkH(ar, a.gc, ch) + blkH(br, ch, b.gc)) * 10 + (Math.abs(ch - a.gc) + Math.abs(dr) + Math.abs(ch - b.gc)) * 0.3 + 1 + (k < 0 || k >= nc - 1 ? 0.4 : 0) });
      }
      for (let k = -1; k < nr && dc; k++) {
        const ch = k + 0.5, ea = edgeRow(a, ch), eb = edgeRow(b, ch);
        if ((k >= a.r0 && k < a.r1) || (k >= b.r0 && k < b.r1)) continue;   // that channel runs through a stretched group
        cands.push({ shape: 'vhv', ch: k, sa: ch > ea ? 'S' : 'N', sb: ch > eb ? 'S' : 'N',
          score: (blkV(a.gc, ea, ch) + blkV(b.gc, ch, eb)) * 10 + (Math.abs(ch - ea) + Math.abs(dc) + Math.abs(ch - eb)) * 0.3 + 1 + (k < 0 || k >= nr - 1 ? 0.4 : 0) });
      }
      const p = cands.reduce((m, c) => (c.score < m.score ? c : m));
      return { f, i, p, a, b, cands, oa: 0, ob: 0, oz: 0 };
    });
    // second pass: also avoid crossing (or running along) the other flows, on lane-free centre lines
    // where a line meets n on `side`, `o` along it; a stretched group's E/W ports sit on the row facing `to`
    const port = (n, side, o, to) => {
      const y = n.r1 > n.r0 && to ? clamp(Y[rowOf(n, to)] + o, n.y - n.hh + 24, n.y + n.hh - 24) : n.y + o;
      return side === 'E' ? [n.x + n.hw, y] : side === 'W' ? [n.x - n.hw, y] : side === 'S' ? [n.x + o, n.y + n.hh] : [n.x + o, n.y - n.hh];
    };
    const rough0 = (a, b, p) => {
      const s = port(a, p.sa, 0, b), e = port(b, p.sb, 0, a);
      if (p.shape === 'h') { if (a.r1 > a.r0) s[1] = e[1]; else e[1] = s[1]; }
      return p.shape === 'h' || p.shape === 'v' ? [s, e] : p.shape === 'hv' ? [s, [e[0], s[1]], e] : p.shape === 'vh' ? [s, [s[0], e[1]], e]
        : p.shape === 'hvh' ? [s, [chX(p.ch), s[1]], [chX(p.ch), e[1]], e] : [s, [s[0], chY(p.ch)], [e[0], chY(p.ch)], e];
    };
    const segs0 = pts => pts.slice(1).map((q, k) => [pts[k], q]);
    const clash = (P, Q, kin) => {   // crossings + collinear overlaps (kin 2 = same pair, lanes split them; 1 = share an actor)
      let n = 0;
      for (const [a, b] of segs0(P)) for (const [c, d] of segs0(Q)) {
        const ha = Math.abs(a[1] - b[1]) < 1, hc = Math.abs(c[1] - d[1]) < 1;
        const inside = (v, p, q) => v > Math.min(p, q) + 2 && v < Math.max(p, q) - 2;
        if (ha !== hc) { const [h0, h1, v0, v1] = ha ? [a, b, c, d] : [c, d, a, b]; if (inside(v0[0], h0[0], h1[0]) && inside(h0[1], v0[1], v1[1])) n += 1; }
        else if (ha ? Math.abs(a[1] - c[1]) < 2 : Math.abs(a[0] - c[0]) < 2) {
          const k = ha ? 0 : 1, lo = Math.max(Math.min(a[k], b[k]), Math.min(c[k], d[k])), hi = Math.min(Math.max(a[k], b[k]), Math.max(c[k], d[k]));
          if (hi - lo > 12) n += kin === 2 ? 0 : kin ? 1 : 3;
        }
      }
      return n;
    };
    plans.forEach(pl => { pl.rp = rough0(pl.a, pl.b, pl.p); });
    // actor labels are obstacles too: predict where each label goes (it takes a side no flow uses) and count
    // the route segments running through it, the candidate's own sides included
    const labelHits = (pl, c, rp) => {
      const u = new Map([...nodes.keys()].map(id => [id, new Set()]));
      plans.forEach(o => { const p = o === pl ? c : o.p; u.get(o.a.id).add(p.sa); u.get(o.b.id).add(p.sb); });
      const routes = plans.map(o => (o === pl ? rp : o.rp));
      let n = 0;
      nodes.forEach(m => {
        if (m.group) return;
        const lb = labelOf(m, u.get(m.id), (q, side) => (u.get(q.id).has(side) ? [0] : [])).lbox;
        routes.forEach(P => segsP(P).forEach(s => { if (ov(segBox(s, 6), lb) > 0) n++; }));
      });
      return n;
    };
    for (let pass = 0; pass < 2; pass++) plans.forEach(pl => {
      let best = null;
      for (const c of pl.cands) {
        const rp = rough0(pl.a, pl.b, c);
        const sc = c.score + 4 * labelHits(pl, c, rp) + 1.2 * sum(plans.map(o => (o === pl ? 0 : clash(rp, o.rp, (o.a === pl.a || o.a === pl.b) && (o.b === pl.a || o.b === pl.b) ? 2 : [o.a, o.b].some(n => n === pl.a || n === pl.b) ? 1 : 0))));
        if (!best || sc < best.sc) best = { c, rp, sc };
      }
      pl.p = best.c; pl.rp = best.rp;
    });
    plans.forEach(pl => { if (pl.p.score >= 10) ctx.issue('warn', `flow ${pl.f.from} → ${pl.f.to} has to cross another actor; move one of them on the grid`); });
    // port lanes: flows sharing a side of an actor are spread along it, ordered by where they go
    // (nested turns: the line that turns first takes the slot on the side it turns to, so they never cross)
    const sides = new Map();
    const slotKey = (pl, end, side) => {
      const P = end === 'oa' ? pl.rp : pl.rp.slice().reverse(), ax = side === 'E' || side === 'W' ? 1 : 0;
      if (P.length < 3) { const n = end === 'oa' ? pl.a : pl.b, o = end === 'oa' ? pl.b : pl.a; return ax ? o.y - n.y : o.x - n.x; }
      return Math.sign(P[2][ax] - P[1][ax]) * (1e5 - Math.abs(P[1][1 - ax] - P[0][1 - ax]));
    };
    plans.forEach(pl => {
      for (const [end, n, side] of [['oa', pl.a, pl.p.sa], ['ob', pl.b, pl.p.sb]]) {
        const o = n === pl.a ? pl.b : pl.a, key = n.id + '\u0000' + side + (n.r1 > n.r0 && (side === 'E' || side === 'W') ? rowOf(n, o) : '');
        if (!sides.has(key)) sides.set(key, { n, side, list: [] });
        sides.get(key).list.push({ pl, end, key: slotKey(pl, end, side) });
      }
    });
    sides.forEach(({ n, side, list }) => {
      list.sort((u, v) => u.key - v.key || u.pl.i - v.pl.i);
      // a request/response pair keeps its value pills on separate lines, so its lanes sit a pill apart
      const pair = list.some((e, j) => list.some((o, k) => k !== j && (o.pl.a === e.pl.b && o.pl.b === e.pl.a || o.pl.a === e.pl.a && o.pl.b === e.pl.b)));
      const half = side === 'E' || side === 'W' ? n.hh : n.hw, lane = Math.max(n.group ? Z.lane * 1.6 : Z.lane, pair ? Z.pill * 1.7 + 10 : 0);
      list.forEach((e, j) => { e.pl[e.end] = clamp((j - (list.length - 1) / 2) * lane, -(half - 10), half - 10); });
    });
    const chans = new Map();
    plans.forEach(pl => { if (pl.p.ch != null) { const k = pl.p.shape + pl.p.ch; if (!chans.has(k)) chans.set(k, []); chans.get(k).push(pl); } });
    chans.forEach(list => list.forEach((pl, j) => { pl.oz = (j - (list.length - 1) / 2) * Z.lane; }));
    plans.forEach(pl => {
      const { p, a, b } = pl;
      let pts;
      if (p.shape === 'h' || p.shape === 'v') {
        const o = (pl.oa + pl.ob) / 2;
        pts = [port(a, p.sa, o, b), port(b, p.sb, o, a)];
        if (p.shape === 'h') { if (a.r1 > a.r0) pts[0][1] = pts[1][1]; else pts[1][1] = pts[0][1]; }
      } else {
        const s = port(a, p.sa, pl.oa, b), e = port(b, p.sb, pl.ob, a);
        if (p.shape === 'hv') pts = [s, [e[0], s[1]], e];
        else if (p.shape === 'vh') pts = [s, [s[0], e[1]], e];
        else if (p.shape === 'hvh') { const x = chX(p.ch) + pl.oz; pts = [s, [x, s[1]], [x, e[1]], e]; }
        else { const y = chY(p.ch) + pl.oz; pts = [s, [s[0], y], [e[0], y], e]; }
      }
      pl.pts = pts.filter((q, k) => !k || Math.hypot(q[0] - pts[k - 1][0], q[1] - pts[k - 1][1]) > 0.5).map(q => [r1(q[0]), r1(q[1])]);
      pl.style = STYLE[pl.f.type];
      pl.sw = pl.style.w * Z.k;
    });

    /* ---- actor label sides: below by default, else wherever no flow leaves ---- */
    const used = new Map();
    sides.forEach(({ n, side }) => { if (!used.has(n.id)) used.set(n.id, new Set()); used.get(n.id).add(side); });
    const offsOf = (n, side) => [...sides.values()].filter(v => v.n === n && v.side === side).flatMap(v => v.list.map(e => e.pl[e.end]));
    const boxes = [];   // obstacles for flow labels: {x0,y0,x1,y1}
    nodes.forEach(n => {
      const u = used.get(n.id) || new Set(), half = Z.S / 2;
      if (n.group) {   // the name tab sits on the top border, or the bottom one when flows come in from above
        n.tabBottom = u.has('N') && !u.has('S');
        n.box = { x0: n.x - n.bw / 2, y0: n.y - n.bh / 2 - Z.tab * 0.75, x1: n.x + n.bw / 2, y1: n.y + n.bh / 2 + Z.tab * 0.75 };
        boxes.push(n.box);
        return;
      }
      Object.assign(n, labelOf(n, u, offsOf));
      n.box = { x0: n.x - half, y0: n.y - half, x1: n.x + half, y1: n.y + half };
      boxes.push(n.box, n.lbox);
    });
    plans.forEach(pl => nodes.forEach(n => {
      if (n.lbox && segsOf(pl).some(s => ov(segBox(s, 2), n.lbox) > 0)) ctx.issue('warn', `flow ${pl.f.from} → ${pl.f.to} crosses the label of "${n.id}"; move one of them on the grid`);
    }));

    /* ---- flow labels + value pills: first spot along the route that hits nothing ---- */
    const lines = plans.map(pl => segsOf(pl).map(s => ({ pl, box: segBox(s, pl.sw / 2 + 4) })));
    const placed = [];
    const markR = Z.mark;
    plans.forEach(pl => {
      const f = pl.f, label = f.label != null && f.label !== '' ? String(f.label) : '', value = f.value != null && f.value !== '' ? String(f.value) : '';
      const proof = proofOf(f);
      if (!label && !value && !proof) return;
      const pw = value ? ctx.measure(value, FN.pill) + Z.pill * 1.15 : 0, ph = value ? Z.pill * 1.7 : 0;
      const segs = segsOf(pl), lens = segs.map(s => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1])), maxLen = Math.max(...lens);
      const longWord = label ? Math.max(...ctx.plain(label).split(/\s+/).map(x => ctx.measure(x, FN.lab))) + 2 : 0;
      let best = null;
      segs.forEach((s, si) => {
        const len = lens[si], horiz = Math.abs(s.a[1] - s.b[1]) < 0.5;
        if (len < 40) return;
        // room for the label: the run's length (horizontal) or the gap beside it, never narrower than its longest word
        const tw0 = clamp(Math.max(horiz ? len - 40 : (tall ? 230 : 250) * Z.u, longWord), 150 * Z.u, 320 * Z.u);
        const T = label ? est(ctx, label, FN.lab, tw0, 2) : { w: 0, h: 0 };
        const mw = proof ? markR * 2 + 8 : 0;
        for (const tt of [0.5, 0.36, 0.64, 0.22, 0.78]) {
          const P = [s.a[0] + (s.b[0] - s.a[0]) * tt, s.a[1] + (s.b[1] - s.a[1]) * tt];
          // on a vertical line a wide pill would cover a parallel neighbour, so it may also sit beside the line
          for (const [side, beside] of [[0, false], [1, false], ...(!horiz && value ? [[0, true], [1, true]] : [])]) {
            const c = { si, tt, side, P, horiz, maxW: tw0, T, mw, pw, ph };
            const parts = [];
            const pdx = beside ? (side ? -1 : 1) * (pl.sw / 2 + 12 + pw / 2) : 0;
            if (value) parts.push(c.pill = { x0: P[0] + pdx - pw / 2, y0: P[1] - ph / 2, x1: P[0] + pdx + pw / 2, y1: P[1] + ph / 2 });
            if (label || proof) {
              const tw = T.w + mw, th = Math.max(T.h, proof ? markR * 2 : 0);
              if (horiz) {
                const off = (value ? ph / 2 : pl.sw / 2) + 8;
                c.text = side ? { x0: P[0] - tw / 2, y0: P[1] + off, x1: P[0] + tw / 2, y1: P[1] + off + th } : { x0: P[0] - tw / 2, y0: P[1] - off - th, x1: P[0] + tw / 2, y1: P[1] - off };
              } else {
                const off = (value ? (beside ? pl.sw / 2 + 12 + pw + 10 : pw / 2 + 14) : pl.sw / 2 + 14);
                c.text = side ? { x0: P[0] - off - tw, y0: P[1] - th / 2, x1: P[0] - off, y1: P[1] + th / 2 } : { x0: P[0] + off, y0: P[1] - th / 2, x1: P[0] + off + tw, y1: P[1] + th / 2 };
              }
              parts.push(c.text);
            }
            // value pill must sit on the straight part of its segment
            let score = (1 - len / maxLen) * 30 + Math.abs(tt - 0.5) * 40 + side * 4 + (beside ? 12 : 0);
            if (value && Math.min(tt, 1 - tt) * len < (horiz ? pw : ph) / 2 + Z.r) score += 400;
            for (const p of parts) {
              for (const b of boxes) score += ov(p, b);
              for (const q of placed) score += ov(p, q) * 2;
              lines.forEach((ls, li) => ls.forEach(l => { if (plans[li] !== pl || p === c.text) score += ov(p, l.box) * (plans[li] === pl ? 0.6 : 1.5); }));
              score += Math.max(0, A.x0 - 40 - p.x0, p.x1 - A.x1 - 40, A.y0 - 20 - p.y0, p.y1 - A.y1 - 20) * 8;
            }
            c.score = score;
            if (!best || score < best.score) best = c;
          }
        }
      });
      if (!best) return;
      pl.lab = Object.assign(best, { label, value, proof });
      if (best.pill) placed.push(best.pill);
      if (best.text) placed.push(best.text);
      if (best.score > 600) ctx.issue('warn', `flow ${f.from} → ${f.to}: no clear spot for its label; it overlaps something`);
    });

    /* ---- camera: the layout is the union (stable), the framing fits what this frame shows ---- */
    // what is on screen in Cx for the given states: actors + their labels, flow lines + their labels
    const frameBox = (Cx, sts) => {
      const bb = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      const grow = b => { if (!b) return; bb.x0 = Math.min(bb.x0, b.x0); bb.y0 = Math.min(bb.y0, b.y0); bb.x1 = Math.max(bb.x1, b.x1); bb.y1 = Math.max(bb.y1, b.y1); };
      const keys = new Set(Cx.flows.filter(x => sts.some(st => vF(Cx, x, st))).map(x => x.key));
      nodes.forEach(n => { if (sts.some(st => vA(Cx, n.id, st))) { grow(n.box); grow(n.lbox); } });
      plans.forEach((pl, i) => { if (keys.has(pl.f.key)) { lines[i].forEach(l => grow(l.box)); if (pl.lab) { grow(pl.lab.pill); grow(pl.lab.text); } } });
      return isFinite(bb.x0) ? bb : null;
    };
    // fit + centre; inside a continue chain the camera may come closer (type up to ~1.6× its base size)
    const cap = group.length > 1 ? 1.6 / Z.u : 1.12;
    const cam = bb => {
      const s = Math.min(cap, (A.x1 - A.x0) / (bb.x1 - bb.x0), (A.y1 - A.y0) / (bb.y1 - bb.y0));
      return { bb, s, tx: (A.x0 + A.x1) / 2 - s * (bb.x0 + bb.x1) / 2, ty: (A.y0 + A.y1) / 2 - s * (bb.y0 + bb.y1) / 2 };
    };
    const both = ['after', 'before'];
    const K = cam(frameBox(C, frame.compare ? both : [state]) || frameBox(U, both));
    const { bb, s, tx, ty } = K;
    if (s < 0.84) ctx.issue('warn', `diagram is crowded (scaled to ${Math.round(s * 100)}%); use fewer actors or shorter labels`);
    const defs = ctx.el('defs', {}, ctx.stage);
    const root = ctx.el('g', { class: 'flow', transform: `translate(${r1(tx)} ${r1(ty)})${s !== 1 ? ` scale(${s.toFixed(4)})` : ''}` }, ctx.stage);
    const gLines = ctx.el('g', {}, root), gActors = ctx.el('g', {}, root), gLabels = ctx.el('g', {}, root);
    leg.place(tx + s * bb.x0, tx + s * bb.x1, ty + s * bb.y0);
    // a continue frame starts at the previous frame's framing and glides to this one (seekable; ends natural)
    let camMs = 0;
    if (chain.length > 1 && !toggle) {
      const pk = chain[chain.length - 2], pb = frameBox(collect(ctx, F, chain.slice(0, -1), false), F[pk].compare ? both : ['after']);
      const P = pb && cam(pb), k = P ? P.s / s : 1;
      if (P && (Math.abs(k - 1) > 0.004 || Math.hypot(P.tx - tx, P.ty - ty) > 1)) {
        camMs = 1000;
        const a = ctx.anim(root, [{ transform: `translate(${r1(P.tx - k * tx)}px,${r1(P.ty - k * ty)}px) scale(${k.toFixed(4)})` }, { transform: 'translate(0px,0px) scale(1)' }],
          { at: 0, duration: camMs, easing: 'cubic-bezier(.6,0,.25,1)' });
        // the move is in stage units about the stage origin, like the root's own transform attribute
        if (a && a.effect && a.effect.target) Object.assign(a.effect.target.style, { transformBox: 'view-box', transformOrigin: '0px 0px' });
      }
    }

    /* ---- focus ---- */
    const focus = new Set(arr(frame.focus).map(String).filter(id => { if (!nodes.has(id)) ctx.issue('warn', `focus "${id}" is not an actor`); return nodes.has(id); }));
    const opA = id => (focus.size && !focus.has(id) ? 0.22 : 1);
    const opF = f => (!focus.size ? 1 : focus.size === 1 ? (focus.has(f.from) || focus.has(f.to) ? 1 : 0.22) : (focus.has(f.from) && focus.has(f.to) ? 1 : 0.22));

    /* ---- draw + motion ---- */
    const halo = (o, size) => { o.el.setAttribute('stroke', t.paper); o.el.setAttribute('stroke-width', r1(size * 0.32)); o.el.setAttribute('stroke-linejoin', 'round'); o.el.setAttribute('paint-order', 'stroke'); return o; };
    const enterA = [], leaveEls = [];
    nodes.forEach(n => {
      const a = C.actors.get(n.id);
      const m = a ? mode(a, (x, st) => visA(x.id, st)) : null;
      if (!m) return;
      const g = ctx.el('g', { class: 'flow-actor' }, gActors);
      if (a.code) ctx.el('title', {}, g).textContent = codeRef(a.code);
      const parts = n.group ? drawGroup(ctx, g, n, Z, FN) : drawActor(ctx, g, n, a, Z, FN, halo);
      const op = opA(n.id);
      if (m === 'leave') { g.setAttribute('opacity', 0); leaveEls.push([g, op]); }
      else if (m === 'enter') enterA.push({ n, g, op, parts });
      else if (op < 1) g.setAttribute('opacity', op);
    });

    const enterF = [];
    plans.forEach(pl => {
      const x = C.flows.find(c => c.key === pl.f.key);
      const m = x ? mode(x, visF) : null;
      if (!m) return;
      // out of focus = faded ink (not opacity), so value pills still cover the line under them
      const accent = accentOf(x), op = opF(x), dim = op < 1 ? c => mix(c, t.paper, 0.72) : c => c, color = dim(accent ? t.accent : t.ink);
      const ln = drawLine(ctx, gLines, pl.pts, x.type, color, Z);
      const lab = pl.lab ? drawLabel(ctx, gLabels, pl, x, color, accent, Z, FN, markR, w, halo, dim) : null;
      const els = [ln.g, lab && lab.g].filter(Boolean);
      if (m === 'leave') els.forEach(e => { e.setAttribute('opacity', 0); leaveEls.push([e, 1]); });
      else if (m === 'enter') enterF.push({ pl, ln, lab, accent });
    });

    // motion: leave first (toggle), then actors in reading order, then flows one by one, accent last
    leaveEls.forEach(([e, op]) => ctx.anim(e, [{ opacity: op }, { opacity: 0 }], { at: 0, duration: 420, easing: 'ease-in' }));
    const base = (toggle ? 260 : 120) + camMs * 0.5, stepA = toggle ? 90 : 110;
    enterA.sort((p, q) => (tall ? p.n.y - q.n.y || p.n.x - q.n.x : p.n.x - q.n.x || p.n.y - q.n.y));
    enterA.forEach(({ n, g, op, parts }, k) => {
      const at = base + k * stepA;
      if (n.group) {
        ctx.beat(parts.box, 'draw', { at, dur: 900 });
        ctx.beat(parts.tab, 'fade', { at: at + 300, dy: 0 });
        parts.members.forEach((e, j) => ctx.beat(e, 'pop', { at: at + 260 + j * 90 }));
        if (op < 1) g.setAttribute('opacity', op);
      } else ctx.beat(g, 'fade', { at, dur: 600, dy: 10, to: op < 1 ? op : null });
    });
    let tf = enterA.length ? base + (enterA.length - 1) * stepA + (toggle ? 380 : 520) : (toggle ? 420 : 200) + camMs * 0.6;
    const order = enterF.filter(e => !e.accent).concat(enterF.filter(e => e.accent));
    const stagger = clamp(3200 / Math.max(1, order.length), 380, 640);
    order.forEach((e, k) => {
      if (e.accent && k > 0 && !order[k - 1].accent) tf += 300;   // a beat of quiet before the new thing
      const dur = clamp(e.ln.len * 0.8, 520, 1150);
      animateFlow(ctx, defs, e, tf, dur);
      tf += e.accent ? Math.max(stagger, dur * 0.7) : stagger;
    });
    if (!toggle && !C.inherited) ctx.beat(leg.g, 'fade', { at: 60, dy: 0 });
  }

  /* ---------- data ---------- */

  // frames that make up this diagram: chain = base … this frame; group = base … last frame that continues it
  function chainOf(ctx, F) {
    const isFlow = f => f && f.lens === 'flow';
    const chain = [ctx.index];
    while (F[chain[0]].continue) {
      let k = chain[0] - 1;
      while (k >= 0 && !isFlow(F[k])) k--;
      if (k < 0) { ctx.issue('warn', '"continue": true but there is no earlier flow frame'); break; }
      chain.unshift(k);
    }
    const group = chain.slice();
    for (let k = ctx.index + 1; k < F.length; k++) { if (!isFlow(F[k])) continue; if (!F[k].continue) break; group.push(k); }
    return { chain, group };
  }

  function collect(ctx, F, idxs, report) {
    const actors = new Map(), flows = new Map();
    const say = (msg) => { if (report) ctx.issue('warn', msg); };
    for (const k of idxs) {
      const f = F[k];
      for (const a of arr(f.actors)) {
        if (!a || a.id == null) { say('actor without an "id"'); continue; }
        const id = String(a.id), old = actors.get(id);
        actors.set(id, Object.assign({}, old, a, { id, _k: old ? old._k : k }));
      }
      for (const x of arr(f.flows)) {
        if (!x || x.from == null || x.to == null) { say('flow needs "from" and "to"'); continue; }
        const key = x.id != null ? 'id:' + x.id : `${x.from}>${x.to}|${x.type || ''}|${ctx.plain(String(x.label || ''))}`;
        const old = flows.get(key);
        flows.set(key, Object.assign({}, old, x, { key, from: String(x.from), to: String(x.to), _k: old ? old._k : k, _newAt: x.new ? k : undefined }));
      }
    }
    for (const x of flows.values()) {
      if (!STYLE[x.type]) { if (x.type != null) say(`unknown flow type "${x.type}" (${TYPES.join(' | ')}); drawn as info`); x.type = 'info'; }
      for (const e of ['from', 'to']) if (!actors.has(x[e])) say(`flow ${e} "${x[e]}" is not an actor`);
      if (x.from === x.to) say(`flow ${x.from} → ${x.to} points at itself; skipped`);
    }
    return { actors, flows: [...flows.values()], inherited: idxs.length > 1 };
  }

  function placeCells(ctx, actors) {
    const cells = new Map(), taken = new Set(), list = [...actors.values()];
    const ok = a => Array.isArray(a.at) && a.at.length === 2 && a.at.every(Number.isFinite);
    list.filter(ok).forEach(a => { const c = [Math.round(a.at[0]), Math.round(a.at[1])]; cells.set(a.id, c); taken.add(c.join(',')); });
    const rest = list.filter(a => !ok(a));
    if (rest.length && !cells.size) {   // nobody placed: one calm row (or a few)
      const rows = Math.ceil(rest.length / 4), per = Math.ceil(rest.length / rows);
      rest.forEach((a, k) => cells.set(a.id, [k % per, Math.floor(k / per)]));
    } else {
      for (const a of rest) {
        let spot = null;
        for (let r = 0; r < 3 && !spot; r++) for (let c = 0; c < 4 && !spot; c++) if (!taken.has(c + ',' + r)) spot = [c, r];
        if (!spot) { spot = [taken.size % 4, 3]; ctx.issue('warn', `no free grid cell for actor "${a.id}"`); }
        taken.add(spot.join(',')); cells.set(a.id, spot);
      }
    }
    return cells;
  }

  function membersOf(ctx, a) {
    const cast = ctx.story.cast || [];
    return arr(a.members).map(m => (typeof m === 'string' ? ((cast.find(c => c.id === m) || {}).name || m) : m && (m.name || m.id) ? String(m.name || m.id) : '?'));
  }

  function proofOf(f) {
    if (f.proof && f.proof.status) return f.proof;
    if (typeof f.inferred === 'string' && f.inferred.trim()) return { status: 'inferred', why: f.inferred };   // dev page, no build
    return null;
  }
  const codeRef = c => (typeof c === 'string' ? c : c && c.file ? c.file + (c.start ? `:${c.start}-${c.end}` : '') : '');

  // greedy wrap estimate with the same fonts core uses (layout runs before anything is drawn)
  function est(ctx, str, o, maxW, maxLines) {
    const words = ctx.plain(String(str == null ? '' : str)).split(/\s+/).filter(Boolean);
    if (!words.length) return { w: 0, h: 0, n: 0 };
    const m = x => ctx.measure(x, o), out = [];
    let cur = '';
    for (const wd of words) { const t2 = cur ? cur + ' ' + wd : wd; if (cur && m(t2) > maxW) { out.push(cur); cur = wd; } else cur = t2; }
    out.push(cur);
    const n = Math.min(out.length, maxLines);
    return { w: Math.min(maxW, Math.max(...out.slice(0, n).map(m))), h: n * o.size * o.lh, n };
  }

  function groupGeom(ctx, a, mem, Z, ms = 1) {
    const n = mem.length, slots = Math.min(n, 6), show = n > 6 ? 5 : n;
    const cols = slots <= 3 ? slots : slots === 4 ? 2 : 3, rows = Math.ceil(slots / cols);
    const memS = Z.memS * ms, memF = Z.mem * Math.min(ms, 1.2), cw = Z.cw * ms, chh = memS + memF * 1.1 + 30 * Z.u;
    const tabStr = String((a.label || a.id) + (a.sub ? ' · ' + a.sub : '')).toLocaleUpperCase(ctx.lang);
    const tabW = ctx.measure(tabStr, { font: 'mono', size: Z.tab, weight: 500, ls: 0.12 });
    const top = Z.tab * 0.6 + 34 * Z.u, bottom = 22 * Z.u;
    const bw = Math.max(cols * cw + 52 * Z.u, tabW + 90 * Z.u), bh = rows * chh + top + bottom;
    return { group: true, memS, memF, cols, rows, cw, chh, bw, bh, top, tabStr, tabW, show, more: n - show, fw: bw, fh: bh + Z.tab };
  }

  /* ---------- drawing ---------- */

  function picto(ctx, parent, kind, cx, cy, size) {
    const src = PICTO[kind];
    if (!src) return ctx.icon(parent, kind || 'person', cx, cy, size, { sw: 3 });   // core icon set; warns if unknown
    const g = ctx.el('g', { transform: `translate(${r1(cx - size / 2)} ${r1(cy - size / 2)}) scale(${(size / 48).toFixed(4)})` }, parent);
    g.innerHTML = src.replace(/="K"/g, `="${ctx.t.ink}"`).replace(/="P"/g, `="${ctx.t.paper}"`);
    return ctx.rough(g, 1);
  }

  function drawActor(ctx, g, n, a, Z, FN, halo) {
    const kind = PICTO[a.kind] || CORE_ICONS.has(a.kind) ? a.kind : 'person';
    if (a.kind != null && kind !== a.kind) ctx.issue('warn', `unknown actor kind "${a.kind}"; drawn as person`);
    picto(ctx, g, kind, n.x, n.y, Z.S);
    const name = a.label != null ? a.label : a.id, b = n.lbox, anchor = n.anchor, x = n.lx;
    const nm = halo(ctx.rich(g, name, x, b.y0, Object.assign({}, FN.name, { anchor, maxW: n.maxW, lines: 2, minSize: FN.name.size * 0.8 })), Z.name);
    if (a.sub) halo(ctx.rich(g, a.sub, x, nm.top + nm.h + 4, Object.assign({}, FN.sub, { anchor, maxW: n.maxW, lines: 2, color: 'ink2', minSize: FN.sub.size * 0.8 })), Z.sub);
    return {};
  }

  function drawGroup(ctx, g, n, Z, FN) {
    const t = ctx.t, x0 = n.x - n.bw / 2, y0 = n.y - n.bh / 2;
    const box = ctx.rough(ctx.el('rect', { x: r1(x0), y: r1(y0), width: r1(n.bw), height: r1(n.bh), rx: 24, fill: 'none', stroke: t.ink, 'stroke-width': 2.6 }, g), 1);
    const tab = ctx.el('g', {}, g), tx = x0 + 30, tyy = n.tabBottom ? y0 + n.bh : y0;
    ctx.el('rect', { x: r1(tx - 12), y: r1(tyy - Z.tab * 0.75), width: r1(n.tabW + 24), height: r1(Z.tab * 1.5), fill: t.paper }, tab);
    ctx.text(tab, n.tabStr, tx, tyy, { font: 'mono', size: Z.tab, weight: 500, ls: 0.12, color: 'ink2', valign: 'middle', lines: 1, lh: 1 });
    const members = [];
    const slots = n.show + (n.more ? 1 : 0);
    for (let k = 0; k < slots; k++) {
      const row = Math.floor(k / n.cols), inRow = Math.min(n.cols, slots - row * n.cols), col = k % n.cols;
      const cx = n.x + (col - (inRow - 1) / 2) * n.cw, cy = n.y + (row - (n.rows - 1) / 2) * n.chh - (8 * Z.u + n.memF * 1.1) / 2 + (n.tabBottom ? -1 : 1) * Z.tab * 0.3;
      const mg = ctx.el('g', {}, g);
      if (k < n.show) {
        picto(ctx, mg, 'person', cx, cy, n.memS);
        ctx.text(mg, n.members[k], cx, cy + n.memS / 2 + 8 * Z.u, Object.assign({}, FN.mem, { size: n.memF, anchor: 'middle', maxW: n.cw - 14, lines: 1 }));
      } else {
        ctx.el('circle', { cx: r1(cx), cy: r1(cy), r: n.memS * 0.42, fill: 'none', stroke: t.ink2, 'stroke-width': 2.6 }, mg);
        ctx.text(mg, '+' + n.more, cx, cy, { font: 'mono', size: n.memF, weight: 500, anchor: 'middle', valign: 'middle', color: 'ink2', lh: 1 });
      }
      members.push(mg);
    }
    return { box, tab, members };
  }

  // orthogonal polyline with rounded corners; with `rnd`, each straight run bows a hair (seeded), the
  // hand-drawn line without the wobble filter (which breaks thin and dashed strokes)
  function roundPath(pts, r, rnd) {
    let d = `M${pts[0][0]} ${pts[0][1]}`, cur = pts[0];
    const run = (x, y) => {
      const len = Math.hypot(x - cur[0], y - cur[1]);
      if (rnd && len > 40) {
        const j = (rnd() - 0.5) * 2 * Math.min(2.4, len * 0.008), nx = -(y - cur[1]) / len, ny = (x - cur[0]) / len;
        d += ` Q${r1((cur[0] + x) / 2 + nx * j)} ${r1((cur[1] + y) / 2 + ny * j)} ${r1(x)} ${r1(y)}`;
      } else d += ` L${r1(x)} ${r1(y)}`;
      cur = [x, y];
    };
    for (let i = 1; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const l1 = Math.hypot(x1 - x0, y1 - y0), l2 = Math.hypot(x2 - x1, y2 - y1), rr = Math.min(r, l1 / 2, l2 / 2);
      run(x1 - (x1 - x0) / l1 * rr, y1 - (y1 - y0) / l1 * rr);
      const e = [x1 + (x2 - x1) / l2 * rr, y1 + (y2 - y1) / l2 * rr];
      d += ` Q${x1} ${y1} ${r1(e[0])} ${r1(e[1])}`;
      cur = e;
    }
    const p = pts[pts.length - 1];
    run(p[0], p[1]);
    return d;
  }

  // one typed line: body (masked so it can be drawn on), head, optional tail dot
  function drawLine(ctx, parent, pts, type, color, Z, opt = {}) {
    const st = STYLE[type], k = Z.k, sw = st.w * k, hl = st.hl * k, hw = st.hw * k, t = ctx.t;
    const n = pts.length, tip = pts[n - 1], prev = pts[n - 2];
    const L0 = Math.hypot(tip[0] - prev[0], tip[1] - prev[1]) || 1, dir = [(tip[0] - prev[0]) / L0, (tip[1] - prev[1]) / L0];
    const trim = Math.min(L0 * 0.6, st.head === 'open' ? sw * 0.5 : hl * 0.85);
    const body = pts.map(p => p.slice());
    body[n - 1] = [tip[0] - dir[0] * trim, tip[1] - dir[1] * trim];
    const d = roundPath(body, opt.r != null ? opt.r : Z.r, opt.flat ? null : ctx.rand('flow-' + type + pts.flat().join(',')));
    const g = ctx.el('g', { class: 'flow-line flow-' + type }, parent);
    const lineG = ctx.el('g', {}, g);
    ctx.el('path', { d, fill: 'none', stroke: color, 'stroke-width': r1(sw), 'stroke-linecap': st.dash ? 'round' : 'butt', 'stroke-linejoin': 'round',
      'stroke-dasharray': st.dash ? st.dash.map(v => r1(v * k)).join(' ') : null }, lineG);
    if (st.inner) ctx.el('path', { d, fill: 'none', stroke: t.paper, 'stroke-width': r1(st.inner * k), 'stroke-linejoin': 'round' }, lineG);
    const nx = -dir[1], ny = dir[0], bx = tip[0] - dir[0] * hl, by = tip[1] - dir[1] * hl;
    const P1 = `${r1(bx + nx * hw)} ${r1(by + ny * hw)}`, P2 = `${r1(bx - nx * hw)} ${r1(by - ny * hw)}`, T = `${r1(tip[0])} ${r1(tip[1])}`;
    const head = st.head === 'open'
      ? ctx.el('path', { d: `M${P1}L${T}L${P2}`, fill: 'none', stroke: color, 'stroke-width': r1(Math.max(sw, 2.8 * k)), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g)
      : ctx.el('path', { d: `M${T}L${P1}L${P2}Z`, fill: st.head === 'hollow' ? t.paper : color, stroke: color, 'stroke-width': r1((st.head === 'hollow' ? 3 : 1.4) * k), 'stroke-linejoin': 'round' }, g);
    if (!opt.flat && st.head !== 'open') ctx.rough(head, 1);
    const tail = st.tail ? ctx.el('circle', { cx: pts[0][0], cy: pts[0][1], r: r1(sw * 1.9), fill: color }, g) : null;
    let len = 0;
    for (let i = 1; i < body.length; i++) len += Math.hypot(body[i][0] - body[i - 1][0], body[i][1] - body[i - 1][1]);
    return { g, lineG, head, tail, d, len, body, r: opt.r != null ? opt.r : Z.r };
  }

  function drawLabel(ctx, parent, pl, x, color, accent, Z, FN, R, w, halo, dim) {
    const L = pl.lab, t = ctx.t, g = ctx.el('g', { class: 'flow-label' }, parent);
    const out = { g, text: null, pill: null, mark: null };
    const label = x.label != null && x.label !== '' ? String(x.label) : '', value = x.value != null && x.value !== '' ? String(x.value) : '';
    if (L.text && (label || L.proof)) {
      const b = L.text, tw = b.x1 - b.x0 - L.mw;
      let tx, anchor;
      if (L.horiz) { anchor = 'middle'; tx = b.x0 + tw / 2; }
      else if (L.side) { anchor = 'end'; tx = b.x0 + tw; }
      else { anchor = 'start'; tx = b.x0; }
      const th = L.T.h, top = (b.y0 + b.y1) / 2 - th / 2;
      if (label) out.text = halo(ctx.rich(g, label, tx, top, Object.assign({}, FN.lab, { anchor, maxW: L.maxW, lines: 2, color, emColor: color, minSize: FN.lab.size * 0.8 })), Z.lab);
      if (L.proof) {
        const runs = out.text ? out.text.runs.filter(r => r.line === out.text.lines - 1) : [];
        const last = runs[runs.length - 1];
        const mx = last ? last.x + last.w + 8 + R : (L.pill ? L.pill.x1 + 6 + R : L.P[0] + R + 8);
        const my = last ? last.y - FN.lab.size * 0.34 : L.P[1] - (L.pill ? 0 : R + 6);
        out.mark = proofMark(ctx, g, L.proof, mx, my, R, w, dim);
      }
    } else if (L.proof) out.mark = proofMark(ctx, g, L.proof, L.pill ? L.pill.x1 + 6 + R : L.P[0], L.P[1], R, w, dim);
    if (L.pill && value) {
      const p = L.pill, pg = ctx.el('g', { class: 'flow-pill' }, g);
      ctx.el('rect', { x: r1(p.x0), y: r1(p.y0), width: r1(p.x1 - p.x0), height: r1(p.y1 - p.y0), rx: r1((p.y1 - p.y0) / 2), fill: t.paper, stroke: color, 'stroke-width': accent ? 2.4 : 2 }, pg);
      ctx.text(pg, value, (p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2 + 1, Object.assign({}, FN.pill, { anchor: 'middle', valign: 'middle', color, lines: 1 }));
      out.pill = pg;
    }
    return out;
  }

  // tiny proof mark, chalk-talk 0.2 rules: ✓ ok (verified, cited), ? warn (inferred, unproven), ! error (broken)
  function proofMark(ctx, parent, proof, cx, cy, R, w, dim) {
    const st = proof.status, tone = st === 'verified' || st === 'cited' ? 'ok' : st === 'broken' ? 'error' : 'warn', c = dim(ctx.t[tone]);
    const g = ctx.el('g', { class: 'flow-proof flow-proof-' + st }, parent);
    const where = proof.file ? ` · ${proof.file}${proof.start ? `:${proof.start}-${proof.end}` : ''}${proof.hit ? ` (L${proof.hit})` : ''}` : '';
    ctx.el('title', {}, g).textContent = (w[st] || st) + (proof.why ? ': ' + proof.why : '') + where;
    ctx.el('circle', { cx: r1(cx), cy: r1(cy), r: R, fill: ctx.t.paper, stroke: c, 'stroke-width': 2, opacity: st === 'cited' ? 0.75 : 1 }, g);
    if (tone === 'ok') ctx.el('path', { d: `M${r1(cx - R * 0.42)} ${r1(cy + R * 0.02)}L${r1(cx - R * 0.1)} ${r1(cy + R * 0.36)}L${r1(cx + R * 0.45)} ${r1(cy - R * 0.36)}`, fill: 'none', stroke: c, 'stroke-width': r1(R * 0.22), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    else ctx.text(g, st === 'broken' ? '!' : '?', cx, cy + R * 0.04, { font: 'sans', weight: 700, size: R * 1.35, anchor: 'middle', valign: 'middle', color: c, lh: 1 });
    return g;
  }

  // draw along the route; the value pill rides the line to its spot; head, label and mark land after
  function animateFlow(ctx, defs, e, at, dur) {
    const { ln, lab, pl } = e;
    const id = ctx.id('flow-m');
    const m = ctx.el('mask', { id, maskUnits: 'userSpaceOnUse', x: -3000, y: -3000, width: 9000, height: 9000 }, defs);
    const mp = ctx.el('path', { d: ln.d, fill: 'none', stroke: '#fff', 'stroke-width': Math.max(40, pl.sw * 3), pathLength: 1, 'stroke-dasharray': '1 1.1' }, m);
    // the mask lives only while the line draws (natural state: no mask). A mask that stays on after its
    // animation ends is sometimes not repainted by Chrome when re-rendered (the line vanishes).
    const url = `url(#${id})`;
    ctx.anim(ln.lineG, [{ mask: url }, { mask: url, offset: 0.999 }, { mask: 'none' }], { at: 0, duration: at + dur, easing: 'linear' });
    ctx.anim(mp, [{ strokeDashoffset: '1.05px' }, { strokeDashoffset: '0px' }], { at, duration: dur, easing: EASE_DRAW });
    if (ln.tail) ctx.beat(ln.tail, 'pop', { at, dur: 320 });
    ctx.beat(ln.head, 'fade', { at: at + dur * 0.86, dur: 240, dy: 0 });
    if (!lab) return;
    if (lab.text) ctx.beat(lab.text.el, 'fade', { at: at + dur * 0.5, dur: 460, dy: 6 });
    if (lab.mark) ctx.beat(lab.mark, 'pop', { at: at + dur + 160, dur: 420 });
    if (lab.pill) {
      // keyframes along the drawn path, at offsets = distance / path length (rounded corners counted), so the
      // pill keeps pace with the drawing tip
      const pts = ln.body, L = pl.lab, P = L.P, segs = [];
      for (let i = 1; i < pts.length; i++) segs.push(Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const cut = i => (2 - Math.PI / 2) * Math.min(ln.r, segs[i - 1] / 2, segs[i] / 2);   // a rounded corner is shorter
      const total = mp.getTotalLength() || ln.len;
      let acc = 0;
      const kf = [{ offset: 0, opacity: 0, transform: `translate(${r1(pts[0][0] - P[0])}px,${r1(pts[0][1] - P[1])}px)` }];
      for (let i = 1; i <= L.si; i++) { acc += segs[i - 1] - cut(i); kf.push({ offset: Math.min(1, acc / total), opacity: 1, transform: `translate(${r1(pts[i][0] - P[0])}px,${r1(pts[i][1] - P[1])}px)` }); }
      const rest = Math.min(total, acc + Math.hypot(P[0] - pts[L.si][0], P[1] - pts[L.si][1]));
      kf.push({ offset: rest / total, opacity: 1, transform: 'translate(0px,0px)' }, { offset: 1, opacity: 1, transform: 'translate(0px,0px)' });
      const fadeIn = Math.min(0.06, kf[1].offset / 2);
      if (fadeIn > 0) kf.splice(1, 0, { offset: fadeIn, opacity: 1, transform: lerpT(kf[0], kf[1], fadeIn) });
      ctx.anim(lab.pill, kf, { at, duration: dur, easing: EASE_DRAW });
    }
  }
  function lerpT(k0, k1, off) {
    const p = s => s.transform.match(/-?[\d.]+/g).map(Number), a = p(k0), b = p(k1), u = (off - k0.offset) / (k1.offset - k0.offset);
    return `translate(${r1(a[0] + (b[0] - a[0]) * u)}px,${r1(a[1] + (b[1] - a[1]) * u)}px)`;
  }

  // the key: one short sample line per type on screen, plus "accent = new"
  function legend(ctx, types, hasNew, w, Z, tall, stamp) {
    const g = ctx.el('g', { class: 'flow-legend' }, ctx.stage);
    const items = types.map(ty => ({ ty, label: w[ty] }));
    if (hasNew) items.push({ ty: 'new', label: w.new });
    const M = tall ? 48 : 72, sw = tall ? 64 : 56, gap = tall ? 14 : 12, sp = tall ? 34 : 34, rowH = tall ? 50 : 38;
    const maxX = ctx.W - M - (stamp ? (tall ? 250 : 300) : 0);
    let x = M, y = tall ? 48 : 40, bottom = items.length ? y + rowH / 2 : 0, row = null;
    const f = { font: 'sans', size: Z.leg, weight: 400 }, rows = [];
    for (const it of items) {
      const tw = ctx.measure(it.label, f), need = sw + gap + tw;
      if (x > M && x + need > maxX) { x = M; y += rowH; bottom = y + rowH / 2; row = null; }
      if (!row) rows.push(row = { g: ctx.el('g', {}, g), w: 0 });
      if (it.ty === 'new') ctx.el('path', { d: `M${x} ${y}H${x + sw}`, stroke: ctx.t.accent, 'stroke-width': 4.6 * Z.k, 'stroke-linecap': 'round', fill: 'none' }, row.g);
      else drawLine(ctx, row.g, [[x, y], [x + sw, y]], it.ty, ctx.t.ink, Z, { r: 0, flat: true });   // the key stays crisp
      ctx.text(row.g, it.label, x + sw + gap, y, Object.assign({}, f, { valign: 'middle', color: it.ty === 'new' ? 'accent' : 'ink2', lh: 1, lines: 1 }));
      row.w = x + need - M;
      x += need + sp;
    }
    // after the fit: one quiet strip just above the drawing, flush with its right edge (left with a stamp)
    const place = (d0, d1, top) => {
      const dy = Math.max(0, top - (tall ? 30 : 26) - bottom);
      rows.forEach(r => {
        const x0 = clamp(stamp ? d0 : d1 - r.w, M, ctx.W - M - r.w);
        r.g.setAttribute('transform', `translate(${r1(x0 - M)} ${r1(dy)})`);
      });
    };
    return { g, bottom, place };
  }
})();
