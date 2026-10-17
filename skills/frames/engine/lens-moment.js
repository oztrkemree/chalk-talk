/* chalk-talk frames · lens: moment  (storyboard shots with a recurring cast)
 *
 * Fields: set: table | office | street | home | store | classroom | meeting | blank
 *         shot: wide | close | insert | split   (default: split if `split`, insert if only `insert`, else wide)
 *         people: [{ who (cast id), pose: stand | sit | phone | point | cheer | think | walk | shrug | type,
 *                    mood: happy | neutral | sad | annoyed | surprised | tired,
 *                    at: left | center-left | center | center-right | right, say, think }]
 *         props:  [{ kind: phone | laptop | receipt | money | bag | food | coffee | box | chart | clock | calendar |
 *                    letter | store | car | plant | whiteboard | cake | chat, at, label, screen (phone/laptop ui list) }]
 *         insert: the object that fills an insert shot (or sits beside the face in a close shot):
 *                 { kind: "phone", screen: [ui...] } · { kind: "chat", title?, messages: [{ from, text, time, seen }] }
 *                 · { kind: "receipt", title?, label?, items: ["Pizza · 420 ₺" | { label, value, accent }], total? }
 *                 · any prop kind { kind, label } (its key detail carries the accent unless accent: false)
 *                 Extras: who (whose hand holds the phone; default highlight, then hero, then top sender).
 *                 Chat: owner's messages on the right; time "Pzt" = day divider, "18:40" = clock; seen → accent.
 *                 People with say/think in an insert shot talk from off-screen (their head peeks in at the edge).
 *         split:  2–4 panels, each a mini moment { people, props, label, set?, highlight? } (medium shots)
 *         highlight: cast id (that person wears the accent instead of the hero) or props index
 *
 * The kit, all drawn from data (an agent never draws):
 *   person()  one consistent character per cast member, built from cast.look
 *             (hair: short | bob | long | curly | bun | beanie | cap | bald | hijab;
 *              top: sweater | shirt | hoodie | jacket | dress | suit; glasses), any pose × any mood.
 *             The hero wears the accent; everyone else gets a stable ink/paper fill (tint, hatch, white, dark).
 *   sets      light line drawings behind the cast; a table/desk surface seats people behind it.
 *   props     18 hand-drawn objects; phone/laptop screens render a small ui list.
 *   bubbles   speech + thought bubbles in the hand font, placed so they never cover a face.
 *   inserts   phone with a ui screen, chat thread (seen/time), receipt, any prop big.
 * Wide and tall compose differently: tall re-spreads the cast, crops closer, stacks a two-shot,
 * deepens the table, staggers standing groups into two depth rows, and turns a crowded table into an
 * over-the-shoulder shot (whoever speaks or matters keeps a face; up to two quiet sitters show their backs).
 * Layout rules: a seated pose sits behind the set's table (or on a sofa/bench/stool), stand/walk stand in
 * front; props find a free spot (wall, table top, floor, a side table); set decor steps aside or is left
 * out; reaching arms stay inside the frame; nothing is drawn outside the stage.
 * Motion: set settles, people pop in one by one, bubbles pop and type, chat messages arrive in
 * order, the accent element comes last.
 */
(function () {
  'use strict';

  const WORDS = {
    tr: { shot: { wide: 'genel plan', close: 'yakın plan', insert: 'detay plan', split: 'bölünmüş ekran' }, seen: 'görüldü', receipt: 'adisyon', total: 'toplam' },
    en: { shot: { wide: 'wide shot', close: 'close-up', insert: 'insert', split: 'split screen' }, seen: 'seen', receipt: 'receipt', total: 'total' },
  };
  const SPOT = { left: 0.15, 'center-left': 0.32, center: 0.5, 'center-right': 0.68, right: 0.85 };
  const HAIRS = ['short', 'bob', 'long', 'curly', 'bun', 'beanie', 'cap', 'bald', 'hijab'];
  const TOPS = ['sweater', 'shirt', 'hoodie', 'jacket', 'dress', 'suit'];
  const POSES = ['stand', 'sit', 'phone', 'point', 'cheer', 'think', 'walk', 'shrug', 'type'];
  const MOODS = ['happy', 'neutral', 'sad', 'annoyed', 'surprised', 'tired'];
  const SHOTS = ['wide', 'close', 'insert', 'split'];
  const SETS = {
    table: { surface: 'table', chair: 'table' }, office: { surface: 'desk', chair: 'office' },
    meeting: { surface: 'long', chair: 'office' }, classroom: { surface: 'desks', chair: 'table' },
    home: { seat: 'sofa' }, street: { seat: 'bench' }, store: { seat: 'stool' }, blank: { seat: 'stool' },
  };
  const PROPS = ['phone', 'laptop', 'receipt', 'money', 'bag', 'food', 'coffee', 'box', 'chart', 'clock', 'calendar', 'letter', 'store', 'car', 'plant', 'whiteboard', 'cake', 'chat'];
  const WALL = new Set(['clock', 'calendar', 'chart']);
  const TABLETOP = new Set(['phone', 'chat', 'laptop', 'receipt', 'money', 'food', 'coffee', 'cake', 'letter', 'box', 'bag']);
  const FLOORS = new Set(['plant', 'store', 'car', 'whiteboard', 'box', 'bag']);
  const FEET = 300, FEET_SEAT = 266, FIG_H = 366;   // shoe soles standing / seated, full standing height (local units)
  const FACE = 'M0 -50C28 -50 48 -29 48 1C48 30 28 50 0 50C-28 50 -48 30 -48 1C-48 -29 -28 -50 0 -50Z';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r1 = v => Math.round(v * 10) / 10;
  const r2 = v => Math.round(v * 1000) / 1000;
  const str = v => (v == null || v === '' ? '' : String(v));
  function lum(h) { const v = [1, 3, 5].map(i => parseInt(String(h).slice(i, i + 2), 16) / 255); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; }
  function mixHex(a, b, k) {
    const p = h => [1, 3, 5].map(i => parseInt(String(h).slice(i, i + 2), 16));
    const A = p(a), B = p(b);
    if (A.some(isNaN) || B.some(isNaN)) return a;
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('');
  }
  function hashStr(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  // mirror the x of every "x y" pair in a path (paths written for the right side, m = 1)
  // the look is paper + ink + one accent: color emoji in bubbles and chats are dropped (with a warning)
  const EMO_T = /\p{Extended_Pictographic}/u, EMO = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*\uFE0F?/gu;
  function clean(ctx, v) {
    const s0 = str(v);
    if (!EMO_T.test(s0)) return s0;
    ctx.issue('warn', `emoji left out of "${s0.slice(0, 32)}" (frames are paper, ink and one accent)`);
    return s0.replace(EMO, '').replace(/\s{2,}/g, ' ').trim() || '+1';
  }
  // run a layout attempt without reporting its issues; returns the issues so the kept attempt can report them
  function quietly(ctx, fn) {
    const iss = ctx.issue, got = [];
    ctx.issue = (l, m) => { got.push([l, m]); };
    try { return [fn(), got]; } finally { ctx.issue = iss; }
  }
  const mir = (m, d) => (m === 1 ? d : d.replace(/(-?\d*\.?\d+) (-?\d*\.?\d+)/g, (_, x, y) => `${r1(-x)} ${y}`));

  chalk.lens('moment', {
    render(frame, ctx) {
      const K = makeKit(ctx);
      const people = Array.isArray(frame.people) ? frame.people : [];
      let shot = frame.shot;
      if (shot && !SHOTS.includes(shot)) { ctx.issue('warn', `unknown shot "${shot}" (wide | close | insert | split); drawn wide`); shot = null; }
      if (!shot) shot = Array.isArray(frame.split) && frame.split.length ? 'split' : frame.insert && !people.length ? 'insert' : 'wide';
      if (shot === 'insert' && !frame.insert) { ctx.issue('warn', 'shot "insert" without an "insert" object; drawn wide'); shot = 'wide'; }
      if (shot === 'split' && !(Array.isArray(frame.split) && frame.split.length)) { ctx.issue('warn', 'shot "split" without "split" panels; drawn wide'); shot = 'wide'; }
      if (shot === 'split') return shotSplit(K, frame);
      const P = panel(K, shot);
      if (shot === 'insert') shotInsert(K, P, frame);
      else if (shot === 'close') shotClose(K, P, frame);
      else shotWide(K, P, frame);
    },
  });

  /* =================================================================== kit */

  function makeKit(ctx) {
    const t = ctx.t, tall = ctx.aspect === 'tall';
    const K = {
      ctx, t, tall, el: ctx.el, min: tall ? 26 : 17,
      tint: mixHex(t.paper2, t.ink, 0.11),
      // dark masses (hair, phones, shoes) stay dark on night paper instead of turning cream
      night: lum(t.paper) < 0.4,
      w: WORDS[String(ctx.lang || 'en').slice(0, 2).toLowerCase()] || WORDS.en,
      defs: ctx.el('defs', {}, ctx.stage),
    };
    K.solid = K.night ? t.paper : t.ink;
    K.pants = K.night ? mixHex(t.paper2, t.ink, 0.3) : t.ink2;
    K.skin = K.night ? mixHex(t.paper2, t.ink, 0.15) : t.paper2;
    const pats = new Map();
    // hatch fills keep the same on-screen pitch whatever the figure's scale
    K.pat = (kind, s = 1) => {
      const key = kind + '|' + r1(s * 10);
      if (pats.has(key)) return pats.get(key);
      const id = ctx.id('mo-' + kind), sp = kind === 'hatch' ? 9 : 13;
      const p = ctx.el('pattern', { id, width: sp, height: sp, patternUnits: 'userSpaceOnUse', patternTransform: `scale(${r2(1 / s)}) rotate(${kind === 'hatch' ? 45 : -32})` }, K.defs);
      ctx.el('rect', { width: sp, height: sp, fill: t.paper2 }, p);
      ctx.el('line', { x1: sp / 2, y1: -1, x2: sp / 2, y2: sp + 1, stroke: t.ink, 'stroke-width': kind === 'hatch' ? 2.7 : 2.5 }, p);
      const url = `url(#${id})`;
      pats.set(key, url);
      return url;
    };
    K.fill = (tone, s) => {
      switch (tone) {
        case 'accent': return t.accent;
        case 'paper': return t.paper2;
        case 'hatch': case 'hatchL': return K.pat(tone, s);
        case 'ink': return K.solid;
        case 'dark': return K.night ? mixHex(t.paper2, t.ink, 0.42) : t.ink2;
        default: return K.tint;
      }
    };
    K.cast = castInfo(ctx);
    K.who = id => K.cast.get(id) || fallbackInfo(ctx, id);
    K.hero = [...K.cast.values()].find(c => c.hero) || null;
    return K;
  }

  // one stable look per cast member, so the same person reads the same in every frame
  function castInfo(ctx) {
    const list = Array.isArray(ctx.story.cast) ? ctx.story.cast : [];
    const firstMoment = ctx.story.frames.findIndex(f => f && f.lens === 'moment');
    const warn = ctx.index === firstMoment;
    const out = new Map(), tones = new Set(), hairs = new Set();
    list.forEach((c, i) => {
      if (!c || c.id == null) return;
      const look = c.look && typeof c.look === 'object' ? c.look : {};
      let hair = look.hair, top = look.top;
      if (hair != null && !HAIRS.includes(hair)) { if (warn) ctx.issue('warn', `cast "${c.id}": unknown hair "${hair}" (${HAIRS.join(' | ')})`); hair = null; }
      if (top != null && !TOPS.includes(top)) { if (warn) ctx.issue('warn', `cast "${c.id}": unknown top "${top}" (${TOPS.join(' | ')})`); top = null; }
      const h = hashStr(c.id);
      hair = hair || ['short', 'bob', 'curly', 'long', 'bun', 'beanie'][h % 6];
      top = top || ['sweater', 'shirt', 'hoodie', 'jacket'][(h >>> 3) % 4];
      const pref = { sweater: 'tint', shirt: 'paper', hoodie: 'hatchL', jacket: 'hatch', dress: 'hatchL', suit: 'dark' }[top];
      let tone = pref;
      if (!c.hero) {
        if (tones.has(tone)) tone = ['tint', 'hatch', 'paper', 'hatchL', 'dark'].find(x => !tones.has(x)) || pref;
        tones.add(tone);
      }
      let hairTone = hair === 'long' ? 'hatchL' : hair === 'hijab' ? 'tint' : 'ink';
      if (hairs.has(hair)) hairTone = hair === 'hijab' ? 'hatchL' : hairTone === 'ink' ? 'hatchL' : 'ink';
      hairs.add(hair);
      out.set(c.id, { id: c.id, name: str(c.name) || String(c.id), hero: !!c.hero, hair, top, glasses: !!look.glasses, tone, hairTone });
    });
    return out;
  }
  function fallbackInfo(ctx, id) {
    const c = ctx.cast(id);   // warns about the unknown id
    const h = hashStr(id || '?');
    return { id, name: c.name, hero: false, hair: ['short', 'curly', 'bob', 'bun', 'long'][h % 5], top: ['sweater', 'shirt', 'hoodie', 'jacket'][(h >>> 4) % 4], glasses: (h >>> 8) % 3 === 0, tone: ['tint', 'paper', 'hatch', 'hatchL'][(h >>> 6) % 4], hairTone: (h >>> 10) % 4 ? 'ink' : 'hatchL' };
  }

  /* ---------------------------------------------------------- the person */

  // local units: head centre at (0,0), face radius ~49, shoulders y≈62, hips 200, shoes ~336 (seated: 300)
  function person(K, info, o) {
    const { t } = K;
    const s = o.s, f = o.facing < 0 ? -1 : 1, mode = o.mode || 'stand', pose = o.pose || 'stand', mood = o.mood || 'neutral';
    const sw = r1((3 + 1.25 * s) / s);
    const ink = t.ink, skin = K.skin;
    const topFill = o.accent ? t.accent : K.fill(info.tone, s);
    const hairFill = K.fill(info.hairTone, s);
    const tube = (d, fill, w = 22) => `<path d="${d}" stroke="${ink}" stroke-width="${r1(w + 2 * sw)}"/>` +
      (/^url/.test(fill) ? `<path d="${d}" stroke="${skin}" stroke-width="${w}"/>` : '') + `<path d="${d}" stroke="${fill}" stroke-width="${w}"/>`;
    const hand = (x, y, r = 13) => `<circle cx="${r1(x)}" cy="${y}" r="${r}" fill="${skin}"/>`;
    const shoe = (x, y, d) => `<path d="M${x - 13 * d} ${y - 5}C${x - 16 * d} ${y + 12} ${x + 26 * d} ${y + 15} ${x + 29 * d} ${y + 5}C${x + 31 * d} ${y - 4} ${x + 12 * d} ${y - 11} ${x - 13 * d} ${y - 5}Z" fill="${K.solid}"/>`;
    const L = mode === 'table' ? 140 : 200, dress = info.top === 'dress';
    let body = '', front = '';

    // furniture that belongs to this one person
    if (o.chair === 'table') body += `<path d="M-86 ${L}V22C-86 8 -74 0 -58 0H58C74 0 86 8 86 22V${L}" fill="${K.tint}"/>`;
    else if (o.chair === 'office') body += `<path d="M-72 ${L}V-8C-72 -28 -58 -38 -38 -38H38C58 -38 72 -28 72 -8V${L}" fill="${K.tint}"/>`;
    else if (o.chair === 'seat') {
      body += `<path d="M-74 196V30C-74 16 -64 8 -50 8H50C64 8 74 16 74 30V196" fill="${K.tint}"/>`;
      const ly = r1(Math.min(FEET_SEAT, (o.cut == null ? 1e9 : o.cut)));
      front += `<path d="M-92 186H92V214H-92Z" fill="${K.tint}"/><path d="M-80 214L-84 ${ly}M80 214L84 ${ly}" stroke-width="${r1(sw * 1.5)}"/>`;
    }
    // legs (cut at the stage edge: a cropped figure never draws outside the stage)
    const cut = o.cut == null ? 1e9 : o.cut;
    const leg = (x0, y0, x1, y1, d, lf, lw, into) => {
      if (y0 >= cut) return '';
      const k = Math.min(1, (cut - y0) / (y1 - y0)), xe = r1(x0 + (x1 - x0) * k), ye = r1(y0 + (y1 - y0) * k);
      return tube(`M${x0} ${y0}L${xe} ${ye}`, lf, lw) + (k === 1 && y1 + 16 < cut ? shoe(x1, y1 + 4, d) : '');
    };
    if (mode === 'stand') {
      const lw = dress ? 15 : 30, lf = dress ? skin : K.pants;
      const legs = pose === 'walk' ? [[30 * f, 58 * f, 278, f], [-28 * f, -46 * f, 268, -f]] : [[30, 33, 282, 1], [-30, -33, 282, -1]];
      for (const [x0, x1, y1, d] of legs) body += leg(x0, 186, x1, y1, d, lf, lw);
      const lx = o.x - 160 * s * f;
      if (pose === 'walk' && (!o.box || (lx > o.box.x + 6 && lx < o.box.x + o.box.w - 6))) body += `<path d="M${-104 * f} 118h${-36 * f}M${-112 * f} 150h${-44 * f}M${-100 * f} 182h${-30 * f}" stroke-width="${r1(sw * 0.75)}"/>`;
    } else if (mode === 'seat') {
      for (const m of [1, -1]) front += leg(32 * m, 212, 34 * m, 248, m, dress ? skin : K.pants, dress ? 15 : 30);
      if (cut > 240) front += dress ? `<path d="M-68 184Q0 194 68 184L72 226Q0 238 -72 226Z" fill="${topFill}"/>`
        : `<circle cx="32" cy="212" r="18" fill="${K.pants}"/><circle cx="-32" cy="212" r="18" fill="${K.pants}"/>`;
    }
    // head tilt and gaze
    const tilt = pose === 'think' ? 6 * f : pose === 'shrug' ? -7 * f : mood === 'sad' ? -3 * f : 0;
    const rot = tilt ? ` transform="rotate(${tilt} 0 46)"` : '';
    const gx = pose === 'phone' || pose === 'type' ? 0 : 3 * f, gy = pose === 'phone' || pose === 'type' ? 4 : pose === 'think' ? -3 : 0;
    const hb = hairBack(info, hairFill, false);
    if (hb) body += `<g${rot}>${hb}</g>`;
    if (info.top === 'hoodie') body += `<path d="M-58 76C-64 44 -42 28 0 28C42 28 64 44 58 76Z" fill="${topFill}"/>`;
    const torso = mode === 'table'
      ? `M-75 ${L}V104C-77 78 -55 63 -20 61H20C55 63 77 78 75 104V${L}Z`
      : `M-70 200L-75 104C-77 78 -55 63 -20 61H20C55 63 77 78 75 104L70 200Z`;
    body += `<path d="${torso}" fill="${topFill}"/>`;
    if (dress && mode === 'stand') body += `<path d="M-60 150L-86 250Q0 264 86 250L60 150Z" fill="${topFill}"/><path d="M-60 150Q0 160 60 150"/>`;
    body += `<path d="M-14 36V66H14V36" fill="${skin}"/>`;
    body += topDetails(info.top, L, mode, ink, skin, K.solid);
    body += `<g${rot}>${headFront(K, info, mood, gx, gy, hairFill, f, false, sw)}</g>`;
    const arms = armsSVG(pose, mode, f, tube, hand, topFill, K, o.pt);
    if (mode === 'table') front = arms + front; else if (mode === 'seat') front += arms; else body += arms;
    if (pose === 'walk' && mode === 'stand') body = `<g transform="rotate(${3 * f} 0 320)">${body}</g>`;

    const mk = (svg, cls) => {
      if (!svg) return null;
      const g = K.el('g', { transform: `translate(${r1(o.x)} ${r1(o.y)}) scale(${r2(s)})`, fill: 'none', stroke: ink, 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: cls });
      g.innerHTML = svg;
      K.ctx.rough(g, 1);
      return g;
    };
    const top = pose === 'cheer' ? o.y - 110 * s : o.y - 70 * s;
    return { body: mk(body, 'mo-person'), front: mk(front, 'mo-person-front'), x: o.x, y: o.y, s, r: 58 * s, top, f };
  }

  // the same person seen from behind (front row of a tall table shot): back of the head, shoulders,
  // upper arms and the chair back; recognisable by hair and top (the hero keeps the accent)
  function personBack(K, info, o) {
    const { t } = K;
    const s = o.s, sw = r1((3 + 1.25 * s) / s), ink = t.ink, skin = K.skin;
    const topFill = o.accent ? t.accent : K.fill(info.tone, s), hairFill = K.fill(info.hairTone, s);
    const cut = Math.min(260, o.cut == null ? 260 : o.cut);
    const tube = (d, fill, w = 22) => `<path d="${d}" stroke="${ink}" stroke-width="${r1(w + 2 * sw)}"/>` +
      (/^url/.test(fill) ? `<path d="${d}" stroke="${skin}" stroke-width="${w}"/>` : '') + `<path d="${d}" stroke="${fill}" stroke-width="${w}"/>`;
    let b = '';
    const ae = r1(Math.min(200, cut - 12)), a1 = r1(92 + (ae - 92) * 0.3), a2 = r1(92 + (ae - 92) * 0.65);
    b += tube(`M62 92C76 ${a1} 80 ${a2} 74 ${ae}`, topFill) + tube(`M-62 92C-76 ${a1} -80 ${a2} -74 ${ae}`, topFill);
    b += `<path d="M-72 ${cut}L-75 104C-77 78 -55 63 -20 61H20C55 63 77 78 75 104L72 ${cut}Z" fill="${topFill}"/>`;
    if (info.top === 'hoodie') b += `<path d="M-40 66C-46 104 -22 128 0 128C22 128 46 104 40 66Z" fill="${topFill}"/>`;
    else if (info.top === 'shirt') b += `<path d="M-22 62Q0 74 22 62"/><path d="M-26 64L-22 74H22L26 64"/>`;
    else if (info.top === 'jacket' || info.top === 'suit') b += `<path d="M0 74V${cut}"/><path d="M-24 62Q0 72 24 62"/>`;
    else if (info.top === 'dress') b += `<path d="M0 66V150" stroke-dasharray="${r1(6 / s)} ${r1(7 / s)}"/>`;
    b += `<path d="M-14 36V66H14V36" fill="${skin}"/>`;
    const H = info.hair;
    if (['short', 'bald', 'cap', 'bun', 'beanie'].includes(H)) b += `<circle cx="-48" cy="6" r="10" fill="${skin}"/><circle cx="48" cy="6" r="10" fill="${skin}"/>`;
    b += `<path d="${FACE}" fill="${skin}"/>`;
    switch (H) {
      case 'short': b += `<path d="M-50 18C-54 -50 -26 -62 0 -62C26 -62 54 -50 50 18C38 34 -38 34 -50 18Z" fill="${hairFill}"/>`; break;
      case 'bob': b += `<path d="M-58 32C-64 -34 -34 -66 0 -66C34 -66 64 -34 58 32C40 44 -40 44 -58 32Z" fill="${hairFill}"/>`; break;
      case 'long': b += `<path d="M-55 -6C-59 -50 -28 -67 0 -67C28 -67 59 -50 55 -6C53 40 62 92 52 124H-52C-62 92 -53 40 -55 -6Z" fill="${hairFill}"/>`; break;
      case 'curly': b += `<path d="${scallop(0, -4, 58, 56, 0, Math.PI * 2, 13, 20)}Z" fill="${hairFill}"/>`; break;
      case 'bun': b += `<circle cx="0" cy="-60" r="21" fill="${hairFill}"/><path d="M-50 10C-54 -50 -26 -62 0 -62C26 -62 54 -50 50 10C38 22 -38 22 -50 10Z" fill="${hairFill}"/>`; break;
      case 'beanie': b += `<path d="M-50 -14C-52 -57 -26 -76 0 -76C28 -76 52 -57 50 -14Z" fill="${skin}"/><path d="M-55 -27H55V-8H-55Z" fill="${skin}"/><circle cx="0" cy="-84" r="11" fill="${skin}"/><path d="M-48 -8C-50 14 -40 28 0 30C40 28 50 14 48 -8Z" fill="${K.solid}"/>`; break;
      case 'cap': b += `<path d="M-50 -8C-52 -54 -26 -68 0 -68C26 -68 52 -54 50 -8Z" fill="${hairFill}"/><path d="M-16 -8Q0 -20 16 -8" fill="${skin}"/><path d="M-48 -6C-50 14 -40 28 0 30C40 28 50 14 48 -6Z" fill="${K.solid}"/>`; break;
      case 'bald': b += `<path d="M-49 -6C-50 16 -36 30 0 32C36 30 50 16 49 -6C40 10 -40 10 -49 -6Z" fill="${K.solid}"/><path d="M-18 -34Q-8 -40 4 -40" stroke-width="${r1(sw * 0.8)}"/>`; break;
      case 'hijab': b += `<path d="M-60 0C-66 -62 66 -62 60 0C60 40 76 76 68 ${cut}H-68C-76 76 -60 40 -60 0Z" fill="${hairFill}"/>`; break;
      default: break;
    }
    const g = K.el('g', { transform: `translate(${r1(o.x)} ${r1(o.y)}) scale(${r2(s)})`, fill: 'none', stroke: ink, 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'mo-person mo-back' });
    g.innerHTML = b;
    K.ctx.rough(g, 1);
    return { body: g, front: null, x: o.x, y: o.y, s, r: 58 * s, top: o.y - 72 * s, f: 1 };
  }

  function topDetails(top, L, mode, ink, skin, solid = ink) {
    const stand = mode !== 'table';
    const dot = (x, y) => `<circle cx="${x}" cy="${y}" r="3.4" fill="${ink}" stroke="none"/>`;
    switch (top) {
      case 'shirt': return `<path d="M0 78V${L - 4}"/>` + [100, 126, 152, 178].filter(y => y < L - 8).map(y => dot(0, y)).join('') +
        `<path d="M-17 59L-2 80L-26 76Z" fill="${skin}"/><path d="M17 59L2 80L26 76Z" fill="${skin}"/><path d="M28 104H50V126H28Z"/>`;
      case 'hoodie': return `<path d="M-13 70L-16 112M13 70L16 112"/>` + dot(-16, 116) + dot(16, 116) + (stand ? '<path d="M-44 198L-36 150H36L44 198"/>' : '');
      case 'jacket': return `<path d="M-22 61L0 128L22 61Z" fill="${skin}"/><path d="M-24 62L-6 132V${L}M24 62L6 132V${L}"/>` + (stand ? '<path d="M-58 166H-32M32 166H58"/>' : '');
      case 'suit': return `<path d="M-21 61L0 118L21 61Z" fill="${skin}"/><path d="M-6 67H6L9 77L4 82L10 128L0 140L-10 128L-4 82L-9 77Z" fill="${solid}"/>` +
        '<path d="M-23 62L-12 98L-22 104L-2 146M23 62L12 98L22 104L2 146"/>' + (stand ? dot(-12, 166) : '');
      case 'dress': return `<path d="M-22 61Q0 96 22 61Z" fill="${skin}"/>`;
      default: return '<path d="M-24 62Q0 84 24 62"/>' + (stand ? '<path d="M-68 186H68"/>' : '');
    }
  }

  function scallop(cx, cy, rx, ry, a0, a1, n, bump) {
    let d = '';
    for (let k = 0; k <= n; k++) {
      const a = a0 + (a1 - a0) * k / n, x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a);
      if (!k) { d += `M${r1(x)} ${r1(y)}`; continue; }
      const am = a - (a1 - a0) / n / 2;
      d += `Q${r1(cx + (rx + bump) * Math.cos(am))} ${r1(cy + (ry + bump) * Math.sin(am))} ${r1(x)} ${r1(y)}`;
    }
    return d;
  }
  const DEG = Math.PI / 180;

  function hairBack(info, fill, headOnly) {
    switch (info.hair) {
      case 'long': return headOnly
        ? `<path d="M-51 -6C-57 -48 -28 -65 2 -65C35 -65 59 -46 53 -6C52 24 56 46 48 64H-48C-56 46 -50 24 -51 -6Z" fill="${fill}"/>`
        : `<path d="M-51 -6C-57 -48 -28 -65 2 -65C35 -65 59 -46 53 -6C51 30 60 78 46 112H-46C-62 78 -49 30 -51 -6Z" fill="${fill}"/>`;
      case 'curly': return `<path d="${scallop(0, -6, 60, 56, 150 * DEG, 390 * DEG, 12, 22)}Z" fill="${fill}"/>`;
      case 'bun': return `<circle cx="0" cy="-64" r="21" fill="${fill}"/>`;
      default: return '';
    }
  }

  function headFront(K, info, mood, gx, gy, hairFill, f, headOnly, sw) {
    const ink = K.t.ink, skin = K.skin, H = info.hair;
    let s = '';
    if (H === 'hijab') s += headOnly
      ? `<path d="M-58 2C-64 -62 64 -62 58 2C58 34 66 56 62 70H-62C-66 56 -58 34 -58 2Z" fill="${hairFill}"/>`
      : `<path d="M-60 0C-66 -62 66 -62 60 0C60 40 76 76 68 104H-68C-76 76 -60 40 -60 0Z" fill="${hairFill}"/><path d="M-36 74Q0 92 36 74"/>`;
    if (['short', 'bald', 'cap', 'bun'].includes(H)) s += `<circle cx="-48" cy="8" r="10" fill="${skin}"/><circle cx="48" cy="8" r="10" fill="${skin}"/>`;
    s += H === 'hijab' ? `<ellipse cx="0" cy="7" rx="38" ry="43" fill="${skin}"/><path d="M-43 6C-43 -46 43 -46 43 6C43 34 25 55 0 56C-25 55 -43 34 -43 6Z"/>` : `<path d="${FACE}" fill="${skin}"/>`;
    s += hairFront(info, hairFill, f, ink, skin, sw);
    s += features(mood, gx, gy, ink, skin, f, sw, H);
    if (info.glasses) s += '<circle cx="-18" cy="5" r="14.5"/><circle cx="18" cy="5" r="14.5"/><path d="M-3.5 3Q0 0 3.5 3M-32 2L-46 -2M32 2L46 -2"/>';
    return s;
  }

  function hairFront(info, fill, f, ink, skin, sw) {
    switch (info.hair) {
      case 'short': return `<path d="M-49 -8C-51 -49 -24 -60 0 -60C28 -60 51 -47 49 -8C41 -28 20 -36 -4 -34C-24 -33 -41 -23 -49 -8Z" fill="${fill}"/>`;
      case 'bob': return `<path d="M-57 24C-63 -34 -34 -64 2 -64C41 -64 63 -33 57 24C56 35 46 37 44 27C44 5 38 -13 26 -23C8 -11 -20 -11 -40 -19C-45 -1 -45 15 -44 29C-47 37 -56 35 -57 24Z" fill="${fill}"/>`;
      case 'long': return `<path d="M-48 -2C-47 -41 -14 -59 22 -52C43 -47 52 -28 50 -6C37 -27 16 -34 -2 -30C-22 -26 -39 -14 -48 -2Z" fill="${fill}"/>` +
        `<path d="M-47 0C-58 34 -60 74 -52 104C-46 110 -36 106 -33 96C-38 64 -40 34 -38 8Z" fill="${fill}"/><path d="M47 -4C58 34 60 74 52 104C46 110 36 106 33 96C38 64 40 34 38 8Z" fill="${fill}"/>`;
      case 'curly': {
        let d = scallop(0, -8, 52, 48, 186 * DEG, 354 * DEG, 8, 17);
        d += 'L50 -14';
        for (let k = 0; k < 5; k++) { const x0 = 50 - k * 20, x1 = x0 - 20; d += `Q${x0 - 10} ${k % 2 ? -2 : -6} ${x1} -14`; }
        return `<path d="${d}Z" fill="${fill}"/>`;
      }
      case 'bun': return `<path d="M-49 -2C-52 -48 -26 -60 0 -60C26 -60 52 -48 49 -2C44 -20 30 -34 0 -37C-30 -34 -44 -20 -49 -2Z" fill="${fill}"/><path d="M-12 -46Q0 -42 12 -46"/>`;
      case 'beanie': return `<path d="M-50 -18C-52 -57 -26 -76 0 -76C28 -76 52 -57 50 -18Z" fill="${skin}"/><path d="M-55 -31H55V-12H-55Z" fill="${skin}"/>` +
        '<path d="M-41 -28V-15M-27 -28V-15M-13 -28V-15M1 -28V-15M15 -28V-15M29 -28V-15M43 -28V-15" stroke-width="' + r1(sw * 0.7) + '"/>' +
        `<circle cx="0" cy="-84" r="11" fill="${skin}"/>`;
      case 'cap': {
        const c = fill;
        return `<path d="M-50 -12C-52 -54 -26 -68 0 -68C26 -68 52 -54 50 -12Z" fill="${c}"/>` +
          `<path d="M${-40 * f} -14C${-6 * f} -22 ${52 * f} -26 ${92 * f} -14C${78 * f} -2 ${24 * f} -2 ${-40 * f} -6Z" fill="${c}"/><circle cx="0" cy="-68" r="5" fill="${skin}"/>`;
      }
      case 'bald': return `<path d="M-50 -4Q-52 -18 -45 -24M50 -4Q52 -18 45 -24" stroke-width="${r1(sw * 1.9)}"/><path d="M-24 -36Q-16 -43 -6 -45" stroke-width="${r1(sw * 0.8)}"/>`;
      default: return '';
    }
  }

  function features(mood, gx, gy, ink, skin, f, sw, hair) {
    const thin = r1(sw * 0.66);
    const dot = (x, y, r = 4.8) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r}" fill="${ink}" stroke="none"/>`;
    const eyes = (y = 6, r = 4.8) => dot(-16 + gx, y + gy, r) + dot(16 + gx, y + gy, r);
    const halo = d => `<path d="${d}" stroke="${skin}" stroke-width="${r1(sw * 2.6)}"/><path d="${d}"/>`;
    switch (mood) {
      case 'happy':
        return '<path d="M-24 8Q-17 0 -10 8M10 8Q17 0 24 8"/>' + `<path d="M-15 23Q0 44 15 23Z" fill="${ink}"/>` +
          `<path d="M-38 22l7 -5M-32 26l7 -5M38 22l-7 -5M32 26l-7 -5" stroke-width="${thin}"/>`;
      case 'sad':
        return eyes(8) + '<path d="M-27 -1L-9 -8M27 -1L9 -8"/><path d="M-11 36Q0 28 11 36"/>' +
          `<path d="M${-27 + gx} 17q5 8 0 13q-5 -5 0 -13Z" fill="${skin}" stroke-width="${thin}"/>`;
      case 'annoyed': {
        const mx = -38 * f, my = -38, mark = `M${mx - 9} ${my - 3}q6 0 6 -6M${mx + 3} ${my - 9}q0 6 6 6M${mx + 9} ${my + 3}q-6 0 -6 6M${mx - 3} ${my + 9}q0 -6 -6 -6`;
        return '<path d="M-25 2H-7M7 2H25"/>' + eyes(8, 4.3) + '<path d="M-27 -10L-8 -3M27 -10L8 -3"/><path d="M-10 33L10 29"/>' + halo(mark);
      }
      case 'surprised':
        return `<circle cx="-16" cy="5" r="8.5" fill="${skin}"/><circle cx="16" cy="5" r="8.5" fill="${skin}"/>` + dot(-16 + gx * 0.6, 5 + gy * 0.6, 3.6) + dot(16 + gx * 0.6, 5 + gy * 0.6, 3.6) +
          `<path d="M-26 -11Q-17 -19 -8 -12M8 -12Q17 -19 26 -11"/><ellipse cx="0" cy="31" rx="6.5" ry="8.5" fill="${ink}"/>` +
          `<path d="M-62 -52l-12 -8M-50 -70l-7 -12M62 -52l12 -8M50 -70l7 -12" stroke-width="${thin}"/>`;
      case 'tired':
        return '<path d="M-26 5L-9 0M26 5L9 0"/>' + dot(-16 + gx, 11, 4) + dot(16 + gx, 11, 4) +
          `<path d="M-24 18Q-17 22 -10 18M10 18Q17 22 24 18" stroke-width="${thin}"/><path d="M-9 32H9"/>` +
          `<path d="M${64 * f} -34q9 13 0 20q-9 -7 0 -20Z" fill="${skin}" stroke-width="${thin}"/>`;
      default:
        return eyes() + '<path d="M-11 28Q0 35 11 28"/>';
    }
  }

  function armsSVG(pose, mode, f, tube, hand, fill, K, pt) {
    const ink = K.t.ink, skin = K.skin;
    const rest = mode === 'table' ? ['M62 90C86 122 94 166 72 180C62 186 50 186 38 184', 34, 184]
      : mode === 'seat' ? ['M62 92C84 124 86 170 52 194', 48, 196]
        : ['M62 92C80 124 86 160 82 194', 82, 200];
    const arm = (m, [d, hx, hy]) => tube(mir(m, d), fill) + (hx == null ? '' : hand(hx * m, hy));
    switch (pose) {
      case 'phone':
        return tube('M62 90C92 132 80 172 38 160', fill) + tube(mir(-1, 'M62 90C92 132 80 172 38 160'), fill) +
          `<rect x="-34" y="104" width="68" height="102" rx="12" fill="${K.solid}"/><circle cx="-19" cy="119" r="4.5" fill="${skin}" stroke="none"/>` + hand(-34, 160) + hand(34, 160);
      case 'point': {
        // pt.k shortens the reach (x measured from the shoulder), pt.low points at chest height (clear of faces)
        const k = pt ? pt.k : 1, X = x => r1(62 + (x - 62) * k);
        const P = pt && pt.low ? [92, 100, 104, 136, 110, 166, 108, 178, 106, 200, 104, 170, 108] : [88, 104, 90, 140, 74, 172, 58, 184, 52, 206, 42, 176, 56];
        return arm(-f, rest) + tube(mir(f, `M62 ${P[0]}C${X(P[1])} ${P[2]} ${X(P[3])} ${P[4]} ${X(P[5])} ${P[6]}`), fill) +
          tube(mir(f, `M${X(P[7])} ${P[8]}L${X(P[9])} ${P[10]}`), skin, 9) + hand(X(P[11]) * f, P[12]);
      }
      case 'cheer':
        return arm(1, ['M62 90C88 62 98 10 94 -50', 94, -58]) + arm(-1, ['M62 90C88 62 98 10 94 -50', 94, -58]);
      case 'think':
        return arm(-f, ['M62 92C80 130 72 172 36 176C6 178 -26 178 -52 176', -54, 176]) + arm(f, ['M62 92C90 140 84 180 56 178C34 176 24 120 22 66', 20, 58]);
      case 'shrug':
        return arm(1, ['M62 92C90 136 104 168 116 156C126 146 132 126 130 112', 130, 104]) + arm(-1, ['M62 92C90 136 104 168 116 156C126 146 132 126 130 112', 130, 104]);
      case 'walk':
        return mode === 'stand' ? arm(f, ['M62 92C80 124 96 156 104 182', 106, 188]) + arm(-f, ['M62 92C72 126 70 160 60 190', 58, 196]) : arm(1, rest) + arm(-1, rest);
      case 'type':
        return arm(1, ['M62 90C90 128 88 170 60 188']) + arm(-1, ['M62 90C90 128 88 170 60 188']) +
          `<rect x="-84" y="96" width="168" height="96" rx="9" fill="${K.tint}"/><circle cx="0" cy="142" r="8"/>`;
      default:
        return arm(1, rest) + arm(-1, rest);
    }
  }

  // a head on its own: avatars, chat senders, off-screen voices
  function head(K, parent, info, cx, cy, s, mood = 'neutral', f = 1) {
    const sw = r1((3 + 1.25 * s) / s), hairFill = K.fill(info.hairTone, s);
    const g = K.el('g', { transform: `translate(${r1(cx)} ${r1(cy)}) scale(${r2(s)})`, fill: 'none', stroke: K.t.ink, 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'mo-head' }, parent);
    g.innerHTML = hairBack(info, hairFill, true) + headFront(K, info, mood, 0, 0, hairFill, f, true, sw);
    K.ctx.rough(g, 1);
    return g;
  }

  // pop a person (body + arms in front of the table) from one shared origin, so the parts stay glued
  function popAt(K, els, ox, oy, at, dur = 560) {
    for (const e of els) {
      if (!e) continue;
      const a = K.ctx.anim(e, [{ opacity: 0, transform: 'scale(.62)' }, { opacity: 1, transform: 'scale(1.04)', offset: 0.62 }, { opacity: 1, transform: 'scale(1)' }],
        { at, duration: dur, easing: 'cubic-bezier(.3,.7,.4,1)' });
      const tg = a && a.effect && a.effect.target;
      if (tg && tg.style) { tg.style.transformBox = 'view-box'; tg.style.transformOrigin = `${r1(ox)}px ${r1(oy)}px`; }
    }
  }

  /* --------------------------------------------------------------- panel */

  function panel(K, shot) {
    const { ctx, t, tall } = K, W = ctx.W, H = ctx.H;
    const P = tall ? { x: 26, y: 62, w: W - 52, h: H - 62 - 26 } : { x: 34, y: 50, w: W - 68, h: H - 50 - 30 };
    ctx.rough(ctx.el('rect', { x: P.x, y: P.y, width: P.w, height: P.h, rx: 3, fill: t.paper2, stroke: t.ink, 'stroke-width': 3 }, ctx.stage), 1);
    ctx.text(ctx.stage, K.w.shot[shot] || shot, P.x + P.w, P.y - (tall ? 16 : 13), { font: 'mono', size: tall ? 26 : 17, ls: 0.16, upper: true, color: 'muted', anchor: 'end', valign: 'bottom', lines: 1 });
    ctx.stampAt = { x: P.x + P.w - (tall ? 150 : 170), y: P.y + (tall ? 70 : 62), rotate: -5 };
    const id = ctx.id('mo-clip');
    const cp = ctx.el('clipPath', { id }, K.defs);
    ctx.el('rect', { x: P.x + 2, y: P.y + 2, width: P.w - 4, height: P.h - 4 }, cp);
    P.g = ctx.el('g', { 'clip-path': `url(#${id})` }, ctx.stage);
    P.top = ctx.el('g', { class: 'mo-bubbles' }, ctx.stage);
    return P;
  }
  function subClip(K, box, parent) {
    const id = K.ctx.id('mo-clip');
    const cp = K.ctx.el('clipPath', { id }, K.defs);
    K.ctx.el('rect', { x: box.x + 2, y: box.y + 2, width: box.w - 4, height: box.h - 4 }, cp);
    return K.ctx.el('g', { 'clip-path': `url(#${id})` }, parent);
  }

  /* --------------------------------------------------------------- scene */

  function normPeople(K, list, SET) {
    const { ctx } = K;
    return (Array.isArray(list) ? list : []).filter(p => p && typeof p === 'object').map((p, i) => {
      let pose = p.pose, mood = p.mood;
      if (pose != null && !POSES.includes(pose)) { ctx.issue('warn', `unknown pose "${pose}" (${POSES.join(' | ')})`); pose = null; }
      if (mood != null && !MOODS.includes(mood)) { ctx.issue('warn', `unknown mood "${mood}" (${MOODS.join(' | ')})`); mood = null; }
      if (p.at != null && SPOT[p.at] == null) ctx.issue('warn', `unknown spot "${p.at}" (${Object.keys(SPOT).join(' | ')})`);
      return { i, info: K.who(p.who), pose: pose || (SET.surface ? 'sit' : 'stand'), mood: mood || 'neutral', at: SPOT[p.at] != null ? p.at : null, say: clean(ctx, p.say), think: clean(ctx, p.think) };
    });
  }

  // draws one moment (people, props, set) into `box`; returns what bubbles need and the motion end
  function scene(K, root, box, spec, opt) {
    const { ctx } = K;
    const mode = opt.mode || 'wide', close = mode === 'close', mini = mode === 'mini';
    const portrait = box.h > box.w * 1.08;
    const stageH = ctx.H - 3;
    let setName = spec.set || 'blank';
    if (!SETS[setName]) { ctx.issue('warn', `unknown set "${setName}" (${Object.keys(SETS).join(' | ')}); drawn blank`); setName = 'blank'; }
    const SET = SETS[setName];
    const hl = spec.highlight;
    let ppl = normPeople(K, spec.people, SET);
    if (close && ppl.length > 2) {
      ctx.issue('warn', `close shot shows at most 2 people (got ${ppl.length}); the rest are left out`);
      const keep = ppl.filter(p => p.info.id === hl).concat(ppl.filter(p => p.info.id !== hl)).slice(0, 2);
      ppl = ppl.filter(p => keep.includes(p));
    }
    // horizontal placement
    let n = ppl.length;
    const free = Object.values(SPOT).filter(v => !ppl.some(p => p.at && SPOT[p.at] === v));
    let fk = 0;
    const anyAt = ppl.some(p => p.at);
    ppl.forEach((p, k) => { p.fx = p.at ? SPOT[p.at] : anyAt ? (free[fk++ % Math.max(1, free.length)] ?? 0.5) : 0.08 + 0.84 * (k + 0.5) / n; });
    ppl.sort((a, b) => a.fx - b.fx || a.i - b.i);
    if (n > 1) {
      let minGap = 1;
      for (let k = 1; k < n; k++) minGap = Math.min(minGap, ppl[k].fx - ppl[k - 1].fx);
      if (portrait || mini || minGap < 0.12) { const m = portrait ? 0.05 : 0.08; ppl.forEach((p, k) => { p.fx = m + (1 - 2 * m) * (k + 0.5) / n; }); }
    } else if (n === 1 && mini) ppl[0].fx = ppl[0].at ? clamp(ppl[0].fx, 0.3, 0.7) : (spec.props || []).some(pr => pr && !WALL.has(pr.kind)) ? 0.36 : 0.5;
    if (close) {
      if (n === 1) ppl[0].fx = ppl[0].at ? clamp(ppl[0].fx, 0.3, 0.7) : (ppl[0].say || ppl[0].think ? 0.36 : 0.5);
      if (n === 2) { ppl[0].fx = portrait ? 0.34 : 0.27; ppl[1].fx = portrait ? 0.66 : 0.73; }
      if (opt.side) ppl.forEach(p => { p.fx = opt.side; });
    }
    // behind the table, on a seat, or standing
    ppl.forEach(p => {
      p.mode = SET.surface ? (p.pose === 'stand' || p.pose === 'walk' ? 'stand' : 'table') : (p.pose === 'sit' || p.pose === 'type' ? 'seat' : 'stand');
    });
    // tall table shot with a crowd: whoever speaks or matters keeps a face on the far side of the table;
    // up to two others sit on the near side with their backs to us (an over-the-shoulder shot)
    let rearP = [];
    if (!close && !mini && portrait && SET.surface && ppl.filter(p => p.mode === 'table').length >= 4) {
      const quiet = ppl.filter(p => p.mode === 'table' && ['sit', 'phone', 'type'].includes(p.pose) && !p.say && !p.think && p.info.id !== hl && !(K.hero && p.info.id === K.hero.id));
      rearP = quiet.length > 2 ? [quiet[0], quiet[quiet.length - 1]] : quiet.slice(0, 2);
      if (ppl.length - rearP.length < 2) rearP = rearP.slice(0, Math.max(0, ppl.length - 2));
      ppl = ppl.filter(p => !rearP.includes(p));
      n = ppl.length;
      ppl.forEach((p, k) => { p.fx = 0.06 + 0.88 * (k + 0.5) / n; });
    }
    if (close) ppl.forEach(p => { if (p.mode === 'seat') p.mode = 'stand'; });   // a close-up shows the upper body only
    const stack = close && portrait && n === 2;
    if (stack) ppl.forEach(p => { p.mode = 'stand'; });
    const stagger = !close && !mini && portrait && n >= 3 && ppl.every(p => p.mode === 'stand');
    const xs = ppl.map(p => box.x + box.w * p.fx);
    let gap = Infinity;
    for (let k = 1; k < n; k++) gap = Math.min(gap, xs[k] - xs[k - 1]);

    // scale + the horizontal lines everything stands on
    let s, FY = null, TB = null;
    if (close) {
      s = opt.side ? Math.min(box.h / 330, box.w * 0.72 / 200)
        : stack ? Math.min(box.w * 0.5 / 200, box.h / 640) : portrait ? Math.min(box.w * 0.6 / 200, box.h / 470) : (n === 2 ? box.h / 380 : box.h / 330);
    } else if (mini) {
      // a medium shot: closer than a wide, knees out of frame
      s = Math.min(box.h * (portrait ? 0.84 : 1.0) / FIG_H, gap / 150, box.w * (n <= 1 ? 0.8 : 0.94 / n) / 200, 1.7);
      FY = box.y + box.h * 0.3 + FIG_H * s;
      if (SET.surface) TB = Math.min(FY - 128 * s, box.y + box.h * 0.8);
    } else {
      const per = stagger ? 118 : SET.surface ? (portrait ? 156 : 196) : 176;
      const vert = box.h * (portrait ? (n <= 2 ? 0.56 : 0.46) : 0.5) / FIG_H;
      s = Math.min(vert, gap / per, portrait ? 1.7 : 1.3);
      FY = box.y + box.h * (portrait ? 0.94 : 0.9);
      if (SET.surface) TB = portrait ? box.y + box.h * 0.64 : FY - 128 * s;
    }
    // tall wide shot: the table is a shallow line drawing (top, front band, legs), not a slab
    const deep = portrait && !close && !mini;
    const DD = deep && TB != null ? Math.min(box.h * 0.1, 150) : 0;
    s = Math.max(0.2, s);
    ppl.forEach((p, k) => {
      p.s = s; p.x = xs[k];
      if (close) {
        if (stack) { p.y = box.y + box.h * (k ? 0.63 : 0.29); if (k) p.s = s * 1.08; }
        else p.y = box.y + box.h * (portrait && !opt.side ? 0.42 : n === 2 ? 0.44 : 0.38);
        if (p.mode === 'table') TB = p.y + 140 * p.s;
      } else if (p.mode === 'table') p.y = TB - 140 * s;
      else if (p.mode === 'seat') p.y = FY - FEET_SEAT * s;
      else if (stagger && k % 2) { p.back = true; p.s = s * 0.84; p.y = FY - box.h * 0.13 - FEET * p.s; }
      else p.y = FY - FEET * s;
      p.cut = (stageH - p.y) / p.s;   // nothing of this person is drawn below the stage edge
    });
    if (close && FY == null) FY = box.y + box.h * 3;
    // facing: everyone turns a little toward the group (a lone figure toward the frame centre)
    const cx0 = n > 1 ? xs.reduce((a, b) => a + b, 0) / n : box.x + box.w / 2;
    ppl.forEach((p, k) => { const d = cx0 - p.x; p.f = Math.abs(d) < 8 ? (n > 1 && k >= n / 2 ? -1 : 1) : Math.sign(d); });
    if (stack) { ppl[0].f = 1; ppl[1].f = -1; }
    // keep reaching arms inside the frame (a shrug or a point at the edge would leave the stage)
    const keepIn = p => {
      const reach = { shrug: [146, 146], cheer: [112, 112], point: [96, 62 + 152 * (p.pt ? p.pt.k : 1)], think: [96, 96], walk: [160, 112] }[p.pose] || [96, 96];
      const [l, r] = p.f > 0 ? reach : [reach[1], reach[0]];
      const lo = box.x + l * p.s + 6, hi = box.x + box.w - r * p.s - 6;
      if (lo < hi) p.x = clamp(p.x, lo, hi);
    };
    ppl.forEach(keepIn);
    const headTop = n ? Math.min(...ppl.map(p => p.y - (p.pose === 'cheer' ? 110 : 72) * p.s)) : box.y + box.h * 0.55;

    // who wears the accent: the highlighted person, else the hero
    const hlPerson = typeof hl === 'string' ? hl : null;
    const accentId = hlPerson || (K.hero ? K.hero.id : null);

    // props, pass 1: zone + x (wall things get their final place now, so the set can step aside)
    const props = [];
    (Array.isArray(spec.props) ? spec.props : []).forEach((pr, i) => {
      if (!pr || typeof pr !== 'object') return;
      if (!PROPS.includes(pr.kind)) { ctx.issue('warn', `unknown prop "${pr.kind}" (${PROPS.join(' | ')})`); return; }
      if (pr.at != null && SPOT[pr.at] == null) ctx.issue('warn', `unknown prop spot "${pr.at}"`);
      // a whiteboard hangs on the wall when people sit at a table or when a tall frame has no floor to spare
      const zone = WALL.has(pr.kind) || (pr.kind === 'whiteboard' && (SET.surface || (portrait && !mini))) ? 'wall' : TABLETOP.has(pr.kind) && TB != null ? 'table' : FLOORS.has(pr.kind) ? 'floor' : 'side';
      props.push({ pr, i, zone, acc: typeof hl === 'number' && hl === i });
    });
    const taken = xs.slice();
    const placedWall = [];
    const wallRect = (o, x) => {
      const w = Math.max((PROP_W[o.pr.kind] || 120) * o.ps, o.pr.label && o.pr.kind !== 'whiteboard' ? Math.max(160, 220 * o.ps) : 0);
      const ph = o.pr.kind === 'whiteboard' ? 200 : PROP_H[o.pr.kind];
      return { x0: x - w / 2, x1: x + w / 2, y0: o.y - ph * o.ps - 10, y1: o.y + (o.pr.label && o.pr.kind !== 'whiteboard' ? K.min * 2.6 + 12 : 0) };
    };
    const hits = (a, b) => a.x0 < b.x1 + 18 && b.x0 < a.x1 + 18 && a.y0 < b.y1 + 12 && b.y0 < a.y1 + 12;
    props.forEach(o => {
      const half = (PROP_W[o.pr.kind] || 120) * s * 0.5 + 12;
      const x = SPOT[o.pr.at] != null ? box.x + box.w * SPOT[o.pr.at]
        : freeSpot(box, taken, o.zone === 'table' ? [0.5, 0.4, 0.6, 0.25, 0.75] : [0.88, 0.12, 0.7, 0.3, 0.5]);
      o.x = clamp(x, box.x + half, box.x + box.w - half);
      taken.push(o.x);
      if (o.zone === 'wall') {
        o.ps = clamp(s, 0.55, 1.3) * (close ? 1.2 : 1);
        const fitY = () => {
          const near = ppl.filter(p => Math.abs(p.x - o.x) < 150 * p.s + (PROP_W[o.pr.kind] || 120) * o.ps / 2).map(p => p.y - (p.pose === 'cheer' ? 110 : 72) * p.s);
          const lab = o.pr.label ? K.min * 2.6 + 12 : 0;
          const ceil = near.length ? Math.min(...near) : box.y + box.h * 0.55;
          const y = Math.min(ceil - 26 - lab, box.y + box.h * (portrait ? 0.32 : 0.42));
          const ph = o.pr.kind === 'whiteboard' ? 200 : PROP_H[o.pr.kind], lab2 = o.pr.kind === 'whiteboard' ? 0 : lab;
          const y2 = y + lab - lab2, need = ph * o.ps + 18;
          if (y2 - need < box.y) o.ps *= Math.max(0.45, (y2 - box.y - 18) / (ph * o.ps));
          o.y = Math.max(y2, box.y + ph * o.ps + 14);
        };
        fitY();
        // two wall things never overlap: slide to the nearest free stretch of wall, else shrink and try again
        for (let k = 0; k < 5 && placedWall.some(r => hits(r, wallRect(o, o.x))); k++) {
          const half = wallRect(o, 0).x1;
          let best = null;
          for (let xx = box.x + half + 8; xx <= box.x + box.w - half - 8; xx += 8) {
            if (!placedWall.some(r => hits(r, wallRect(o, xx))) && (best == null || Math.abs(xx - o.x) < Math.abs(best - o.x))) best = xx;
          }
          if (best != null) o.x = best; else o.ps *= 0.8;
          fitY();
        }
        placedWall.push(wallRect(o, o.x));
        taken[taken.length - 1] = o.x;
      }
    });
    // pointing: away from the neighbours (toward the referenced prop, else the emptier side), and the arm
    // stops short of any face it would reach (shortened, then lowered to chest height)
    ppl.forEach(p => {
      if (p.pose !== 'point') return;
      const tgt = props.find(o => o.acc) || props.find(o => o.zone === 'wall' || ['whiteboard', 'chart', 'store', 'car'].includes(o.pr.kind));
      // free arm length (local units) toward dir for an arm held between local heights y0..y1
      const roomTo = (dir, y0, y1) => {
        let room = (dir > 0 ? box.x + box.w - p.x : p.x - box.x) - 8;
        for (const q of ppl) {
          if (q === p || Math.sign(q.x - p.x) !== dir) continue;
          const f0 = q.y - 76 * q.s, f1 = q.y + 58 * q.s;
          if (p.y + y1 * p.s > f0 && p.y + y0 * p.s < f1) room = Math.min(room, Math.abs(q.x - p.x) - 58 * q.s);
        }
        return room / p.s;
      };
      const hi = d => roomTo(d, 34, 94), rr = hi(1), rl = hi(-1);
      if (tgt && Math.abs(tgt.x - p.x) > 40) p.f = Math.sign(tgt.x - p.x);
      else if (Math.abs(rr - rl) > 20) p.f = rr > rl ? 1 : -1;
      const kHi = ((p.f > 0 ? rr : rl) - 22 - 62) / 144, kLo = (roomTo(p.f, 94, 120) - 16 - 62) / 140;
      p.pt = kHi >= 0.62 || kHi >= kLo ? { k: clamp(kHi, 0.3, 1), low: false } : { k: clamp(kLo, 0.3, 1), low: true };
      keepIn(p);
    });
    xs.forEach((_, k) => { xs[k] = ppl[k].x; });

    const layer = name => ctx.el('g', { class: 'mo-' + name }, root);
    const gSet = layer('set'), gWall = layer('wall'), gFloor = layer('floor'), gBack = layer('back'), gFurnB = layer('furn-b');
    const gBodies = layer('bodies'), gFurnF = layer('furn-f'), gFronts = layer('fronts'), gTop = layer('tabletop'), gStand = layer('stand');
    const wallBoxes = props.filter(o => o.zone === 'wall').map(o => ({ x: o.x, w: Math.max((PROP_W[o.pr.kind] || 120) * o.ps, o.pr.label && o.pr.kind !== 'whiteboard' ? Math.max(160, 220 * o.ps) : 0), kind: o.pr.kind }));
    const L = { box, FY, TB, s, portrait, close, mini, xs, wall: wallBoxes, headTop, setName };
    setBack(K, gSet, setName, L);

    // furniture
    const tableP = ppl.filter(p => p.mode === 'table');
    const segs = [];
    // tall: no empty desk behind a standing cast (only when someone sits or something lies on it)
    if (TB != null && (tableP.length || (!close && (props.some(o => o.zone === 'table') || (SET.surface && !deep))))) {
      if (close) segs.push([box.x - 20, box.x + box.w + 20]);
      else if (deep) {
        if (SET.surface === 'desks' && tableP.length > 1) {
          tableP.forEach(p => {
            const a = Math.max(box.x + 14, p.x - 130 * s), b = Math.min(box.x + box.w - 14, p.x + 130 * s), q = segs[segs.length - 1];
            if (q && a < q[1] + 24) q[1] = b; else segs.push([a, b]);
          });
        } else {
          const pxs = tableP.map(p => p.x);
          let x0 = pxs.length ? Math.min(...pxs) - 150 * s : box.x + box.w * 0.2, x1 = pxs.length ? Math.max(...pxs) + 150 * s : box.x + box.w * 0.8;
          if (x1 - x0 < box.w * 0.6) { const c = (x0 + x1) / 2; x0 = c - box.w * 0.3; x1 = c + box.w * 0.3; }
          segs.push([Math.max(x0, box.x + 14), Math.min(x1, box.x + box.w - 14)]);
        }
      }
      else if (SET.surface === 'desks' && tableP.length) tableP.forEach(p => segs.push([p.x - 118 * s, p.x + 118 * s]));
      else {
        const pxs = tableP.map(p => p.x);
        let x0 = pxs.length ? Math.min(...pxs) - 130 * s : box.x + box.w * 0.32, x1 = pxs.length ? Math.max(...pxs) + 130 * s : box.x + box.w * 0.68;
        const minW = box.w * (mini ? 0.7 : 0.4);
        if (x1 - x0 < minW) { const c = (x0 + x1) / 2; x0 = c - minW / 2; x1 = c + minW / 2; }
        segs.push([Math.max(x0, box.x - 20), Math.min(x1, box.x + box.w + 20)]);
      }
      segs.forEach(([x0, x1]) => drawTable(K, gFurnF, x0, x1, TB, s, FY, deep ? DD : 0, box));
      // under a tall table you see the sitters' legs and shoes
      if (deep) tableP.forEach(p => { p.legs = seatedLegs(K, gBodies, p, TB + DD, FY); });
    }
    const seatP = ppl.filter(p => p.mode === 'seat');
    if (seatP.length && (SET.seat === 'sofa' || SET.seat === 'bench')) {
      const groups = [];
      seatP.forEach(p => { const g = groups[groups.length - 1]; if (g && p.x - g[g.length - 1].x < 260 * s) g.push(p); else groups.push([p]); });
      groups.forEach(g => drawSeat(K, gFurnB, gFurnF, SET.seat, g[0].x - 108 * s, g[g.length - 1].x + 108 * s, g[0].y + 186 * s, Math.min(g[0].y + FEET_SEAT * s, stageH), s));
    }

    // people
    const heads = [];
    const drawn = ppl.map(p => {
      const chair = p.mode === 'table' ? SET.chair : p.mode === 'seat' && SET.seat === 'stool' ? 'seat' : null;
      const P = person(K, p.info, { x: p.x, y: p.y, s: p.s, mode: p.mode, pose: p.pose, mood: p.mood, facing: p.f, accent: accentId && p.info.id === accentId, chair, cut: p.cut, box, pt: p.pt });
      const lay = p.mode === 'stand' ? (p.back ? gBack : gStand) : gBodies;
      let shadow = null;
      if (p.mode === 'stand' && p.y + (FEET + 2) * p.s < box.y + box.h) shadow = ctx.el('ellipse', { cx: r1(p.x), cy: r1(p.y + (FEET + 2) * p.s), rx: r1(78 * p.s), ry: r1(11 * p.s), fill: K.tint }, lay);
      lay.appendChild(P.body);
      if (P.front) gFronts.appendChild(P.front);
      heads.push({ x: p.x, y: p.y, r: 60 * p.s, top: P.top });
      return { p, P, shadow };
    });
    if (stack) gStand.appendChild(drawn[1].P.body);
    rearP.forEach((p, k) => {
      p.s = Math.min(s * 1.35, 2.1);
      p.x = box.x + box.w * (rearP.length === 1 ? 0.5 : k ? 0.82 : 0.18);
      p.y = TB + DD * 0.8;
      p.f = 1;
      const P = personBack(K, p.info, { x: p.x, y: p.y, s: p.s, accent: accentId && p.info.id === accentId, chair: true, cut: (stageH - p.y) / p.s });
      gStand.appendChild(P.body);
      heads.push({ x: p.x, y: p.y, r: 60 * p.s, top: P.top });
      drawn.push({ p, P, shadow: null });
    });

    // props, pass 2
    const propEls = [], soft = [], onTable = [], corners = [];
    const span = segs.length ? [Math.min(...segs.map(q => q[0])), Math.max(...segs.map(q => q[1]))] : null;
    props.forEach(o => {
      const { pr, acc } = o;
      let { x } = o, ps = s, y, lay;
      const zone = o.zone;
      if (zone === 'table' && deep) {
        // on the tall table's top, as large as fits under the sitters' chins, clear of the other things on it
        y = TB + DD * 0.62;
        const chin = tableP.length ? Math.min(...tableP.map(p => p.y + 64 * p.s)) : box.y;
        ps = clamp((y - chin - 8) / (PROP_H[pr.kind] || 100), s * 0.6, s * 1.1);
        const half = (PROP_W[pr.kind] || 120) * ps * 0.5;
        const busy = xx => onTable.some(q => Math.abs(q.x - xx) < q.half + half + 14) || rearP.some(p => Math.abs(p.x - xx) < 64 * p.s + half);
        x = clamp(x, box.x + half + 8, box.x + box.w - half - 8);
        if (busy(x)) for (let d = 12; d < box.w; d += 12) {
          if (x + d < box.x + box.w - half - 8 && !busy(x + d)) { x += d; break; }
          if (x - d > box.x + half + 8 && !busy(x - d)) { x -= d; break; }
        }
        onTable.push({ x, half });
        lay = gTop;
      } else if (zone === 'table') {
        ps = s;
        const half = (PROP_W[pr.kind] || 120) * ps * 0.5;
        const clash = xx => tableP.some(p => Math.abs(p.x - xx) < 70 * s + half);
        if (clash(x)) {
          for (let d = 40 * s; d < box.w; d += 30 * s) {
            const a = x + d, b = x - d;
            if (a < box.x + box.w - half && !clash(a)) { x = a; break; }
            if (b > box.x + half && !clash(b)) { x = b; break; }
          }
        }
        x = clamp(x, box.x + half + 8, box.x + box.w - half - 8);
        y = TB + (clash(x) ? 78 : 60) * s;
        lay = gTop;
      } else if (zone === 'wall') { y = o.y; ps = o.ps; lay = gWall; }
      else {
        if (close && FY > box.y + box.h) return;
        const big = pr.kind === 'car' || pr.kind === 'store';
        ps = big ? s * 0.92 : s;
        const half = (PROP_W[pr.kind] || 120) * ps * 0.5 + 10;
        lay = gFloor;
        if (deep && span && !big && x > span[0] - half && x < span[1] + half) {
          // tall: the table fills the width, so the thing stands in a front corner, in front of everyone
          ps = s * 0.8;
          const h2 = (PROP_W[pr.kind] || 120) * ps * 0.5 + 8, xl = box.x + h2, xr = box.x + box.w - h2;
          const used = xx => corners.some(c => Math.abs(c - xx) < 40);
          const pref = x - box.x < box.w / 2 ? [xl, xr] : [xr, xl];
          x = pref.find(c => !used(c)) ?? pref[0];
          corners.push(x);
          lay = gStand;
        }
        else if (span && !big && x > span[0] - half && x < span[1] + half) {
          // step outside the table if there is room, else stand behind it in the widest gap between people
          const l = span[0] - half, r = span[1] + half;
          if (l > box.x + half && (x - l < r - x || r > box.x + box.w - half)) x = l;
          else if (r < box.x + box.w - half) x = r;
          else {
            const pts = [span[0], ...xs, span[1]].sort((a, b) => a - b);
            let bi = 0;
            for (let k = 1; k < pts.length; k++) if (pts[k] - pts[k - 1] > pts[bi + 1] - pts[bi]) bi = k - 1;
            x = (pts[bi] + pts[bi + 1]) / 2;
          }
        }
        else if (!big && pr.kind !== 'plant') {
          const room = xx => Math.min(Infinity, ...ppl.filter(p => p.mode !== 'table').map(p => Math.abs(p.x - xx) - 92 * p.s - half));
          if (room(x) < 0) {
            let best = x, bv = room(x);
            for (let xx = box.x + half; xx <= box.x + box.w - half; xx += 12) { const v = room(xx); if (v > bv + 1) { bv = v; best = xx; } }
            x = best;
            if (bv < 0) lay = gStand;   // no free floor: in front of the legs, never behind a face
          }
        }
        y = big ? FY - 40 * s : FY;
        if (zone === 'side') { y = FY - 132 * s; sideTable(K, lay, x, FY, s); }
      }
      const e = prop(K, lay, pr, x, y, ps, acc, zone === 'wall' && pr.kind === 'whiteboard', box);
      if (e) {
        propEls.push({ e, acc, zone });
        const pw = (PROP_W[pr.kind] || 120) * ps, ph = (PROP_H[pr.kind] || 100) * ps;
        soft.push({ x0: x - pw / 2, x1: x + pw / 2, y0: y - ph, y1: y + (pr.label ? K.min * 2.8 + 14 : 0) });
      }
    });

    // bubbles are placed later (they need every face on the stage)
    const speakers = drawn.filter(d => d.p.say || d.p.think).map(d => ({ x: d.p.x, y: d.p.y, r: 60 * d.p.s, f: d.p.f, say: d.p.say, think: d.p.think, box }));

    // motion: the set settles, then people pop in left to right (the highlighted one last)
    const t0 = opt.t0 || 0, pace = opt.pace || 1;
    ctx.beat(gSet, 'fade', { at: t0, dur: 520, dy: 0 });
    [gWall, gFloor, gFurnB, gFurnF].forEach(g => { if (g.childNodes.length) ctx.beat(g, 'fade', { at: t0 + 120, dur: 520, dy: 0 }); });
    const order = drawn.slice().sort((a, b) => (a.p.info.id === hlPerson) - (b.p.info.id === hlPerson) || (a.p.back ? 0 : 1) - (b.p.back ? 0 : 1) || a.p.x - b.p.x);
    let at = t0 + 300 * pace;
    order.forEach(d => {
      const p = d.p;
      const oy = p.mode === 'table' ? TB : Math.min(p.y + FEET * p.s, box.y + box.h);
      popAt(K, [d.P.body, d.P.front, d.shadow, p.legs], p.x, oy, at, 560);
      at += (hlPerson && p.info.id === hlPerson ? 330 : 240) * pace;
    });
    propEls.filter(x => !x.acc).forEach((x, k) => ctx.beat(x.e, 'fade', { at: x.zone === 'table' ? at - 100 * pace + k * 110 : t0 + 200 + k * 90, dur: 480, dy: x.zone === 'table' ? 10 : 0 }));
    return { heads, speakers, soft, end: at + 200 * pace, accentProps: propEls.filter(x => x.acc), s, box };
  }

  function freeSpot(box, taken, cands) {
    let best = cands[0], bd = -1;
    for (const c of cands) {
      const x = box.x + box.w * c, d = taken.length ? Math.min(...taken.map(v => Math.abs(v - x))) : 1e9;
      if (d > bd + 30) { bd = d; best = c; }
    }
    return box.x + box.w * best;
  }

  /* ---------------------------------------------------------------- sets */

  // the set: a few light lines behind the cast (softer ink, thinner pen), placed in the gaps between people
  function setBack(K, g, name, L) {
    const { ctx, t } = K, { box, FY, s, close, portrait } = L;
    const ks = close ? clamp(s * 0.6, 1, 1.8) : clamp(s, 0.6, 1.5);
    const sk = mixHex(t.ink2, t.paper2, 0.18);
    const path = (d, o = {}) => ctx.el('path', Object.assign({ d, fill: 'none', stroke: sk, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, o), g);
    const bottom = box.y + box.h;
    const floorY = close || FY == null || FY > bottom - 8 ? null : FY;
    // close shots let the decor bleed off the top edge (still inside the stage)
    const topY = close ? box.y - Math.min(40, box.y - 4) : box.y + box.h * (portrait ? 0.05 : 0.07);
    const room = Math.max(110, (L.headTop - 24) - topY);
    // decor goes where people are not, and never behind a wall prop (it is skipped when there is no room)
    const taken = L.xs.slice(), hard = (L.wall || []).slice();
    const fx = (cands, w = 0) => {
      const ok = cands.map(c => clamp(box.x + box.w * c, box.x + w / 2 + 10, box.x + box.w - w / 2 - 10)).filter(x => hard.every(h => Math.abs(h.x - x) > (h.w + w) / 2 + 24));
      if (!ok.length) return null;
      let best = ok[0], bd = -1;
      for (const x of ok) { const d = taken.length ? Math.min(...taken.map(v => Math.abs(v - x))) : 1e9; if (d > bd + 30) { bd = d; best = x; } }
      hard.push({ x: best, w }); taken.push(best);
      return best;
    };
    const floor = () => { if (floorY != null) path(`M${box.x} ${r1(floorY)}H${box.x + box.w}`); };
    ctx.rough(g, 1);
    const win = (x, y, w, h, blinds) => {
      path(`M${r1(x)} ${r1(y)}h${r1(w)}v${r1(h)}h${r1(-w)}Z`, { fill: t.paper2 });
      if (blinds) {
        for (let yy = y + 20 * ks; yy < y + h - 8; yy += 22 * ks) path(`M${r1(x + 8)} ${r1(yy)}H${r1(x + w - 8)}`, { 'stroke-width': 2.6 });
        path(`M${r1(x + w * 0.72)} ${r1(y)}V${r1(y + h * 0.8)}`, { 'stroke-width': 2.6 });
      } else {
        path(`M${r1(x + w / 2)} ${r1(y)}V${r1(y + h)}M${r1(x)} ${r1(y + h / 2)}H${r1(x + w)}`);
        path(`M${r1(x + 6)} ${r1(y + h * 0.88)}C${r1(x + w * 0.2)} ${r1(y + h * 0.78)} ${r1(x + w * 0.32)} ${r1(y + h * 0.74)} ${r1(x + w * 0.46)} ${r1(y + h * 0.8)}`, { 'stroke-width': 2.6 });
        path(`M${r1(x + w * 0.62)} ${r1(y + h * 0.22)}q${r1(8 * ks)} ${r1(-10 * ks)} ${r1(18 * ks)} ${r1(-2 * ks)}q${r1(10 * ks)} ${r1(-6 * ks)} ${r1(14 * ks)} ${r1(4 * ks)}`, { 'stroke-width': 2.6 });
      }
      path(`M${r1(x - 12)} ${r1(y + h + 4)}H${r1(x + w + 12)}`, { 'stroke-width': 4 });
    };
    const lamp = (x, yb) => { path(`M${r1(x)} ${box.y}V${r1(yb - 52 * ks)}`); path(`M${r1(x - 52 * ks)} ${r1(yb)}L${r1(x - 32 * ks)} ${r1(yb - 54 * ks)}H${r1(x + 32 * ks)}L${r1(x + 52 * ks)} ${r1(yb)}Z`, { fill: t.paper2 }); };
    const frameArt = (x, y, w, h) => {
      path(`M${r1(x)} ${r1(y)}h${r1(w)}v${r1(h)}h${r1(-w)}Z`, { fill: t.paper2, 'stroke-width': 4 });
      path(`M${r1(x + 12)} ${r1(y + 12)}h${r1(w - 24)}v${r1(h - 24)}h${r1(24 - w)}Z`, { 'stroke-width': 2.6 });
      path(`M${r1(x + 16)} ${r1(y + h - 18)}L${r1(x + w * 0.38)} ${r1(y + h * 0.42)}L${r1(x + w * 0.56)} ${r1(y + h * 0.66)}L${r1(x + w * 0.7)} ${r1(y + h * 0.52)}L${r1(x + w - 16)} ${r1(y + h - 18)}`);
      ctx.el('circle', { cx: r1(x + w * 0.74), cy: r1(y + h * 0.3), r: r1(h * 0.09), fill: 'none', stroke: sk, 'stroke-width': 2.6 }, g);
    };
    const shelf = (x, y, w) => {
      path(`M${r1(x)} ${r1(y)}H${r1(x + w)}`, { 'stroke-width': 4 });
      let xx = x + 14;
      const hs = [62, 48, 56, 70, 44, 58];
      for (let k = 0; xx < x + w * 0.6; k++) { const bw = (k % 3 ? 16 : 22) * ks, bh = hs[k % hs.length] * ks; path(`M${r1(xx)} ${r1(y)}v${r1(-bh)}h${r1(bw)}v${r1(bh)}`, { fill: k % 4 === 1 ? K.tint : t.paper2, 'stroke-width': 2.6 }); xx += bw + 3; }
      path(`M${r1(xx + 8)} ${r1(y)}l${r1(26 * ks)} ${r1(-54 * ks)}l${r1(14 * ks)} ${r1(6 * ks)}l${r1(-24 * ks)} ${r1(48 * ks)}`, { fill: t.paper2, 'stroke-width': 2.6 });
      const px = x + w - 40 * ks;
      path(`M${r1(px - 16 * ks)} ${r1(y)}l${r1(4 * ks)} ${r1(-30 * ks)}h${r1(24 * ks)}l${r1(4 * ks)} ${r1(30 * ks)}`, { fill: K.tint, 'stroke-width': 2.6 });
      path(`M${r1(px)} ${r1(y - 30 * ks)}c${r1(-4 * ks)} ${r1(-20 * ks)} ${r1(-18 * ks)} ${r1(-26 * ks)} ${r1(-26 * ks)} ${r1(-28 * ks)}M${r1(px)} ${r1(y - 30 * ks)}c${r1(4 * ks)} ${r1(-22 * ks)} ${r1(16 * ks)} ${r1(-30 * ks)} ${r1(24 * ks)} ${r1(-34 * ks)}`, { 'stroke-width': 2.6 });
    };
    const ww = Math.min(230 * ks, box.w * 0.42), wh = close ? 250 * ks : Math.min(230 * ks, room);
    switch (name) {
      case 'table': {
        const x = fx(portrait ? [0.26, 0.74, 0.5] : [0.3, 0.7, 0.15, 0.85], ww);
        if (x != null) win(x - ww / 2, topY, ww, wh);
        const lx = !close && L.headTop - topY > 170 * ks && !L.mini ? fx([0.5, 0.62, 0.38, 0.8], 110 * ks) : null;
        if (lx != null) lamp(lx, Math.min(L.headTop - 50, topY + room * 0.55));
        floor(); break;
      }
      case 'office': {
        const x = fx([0.22, 0.78, 0.5, 0.1, 0.9], ww);
        if (x != null) win(x - ww / 2, topY, ww, wh, true);
        if (!L.mini || box.w > 600) { const sw = 260 * ks, x2 = fx([0.78, 0.22, 0.6, 0.4], sw); if (x2 != null) shelf(x2 - sw / 2, topY + Math.min(130 * ks, room * 0.7), sw); }
        floor(); break;
      }
      case 'meeting': {
        if (L.wall && L.wall.length) { floor(); break; }   // a wall prop (whiteboard, chart, clock...) replaces the set's own wall chart
        const w = Math.min(box.w * (portrait ? 0.72 : 0.36), 440 * ks), h = Math.min(w * 0.56, close ? w * 0.56 : room), x = box.x + box.w / 2 - w / 2;
        path(`M${r1(x)} ${r1(topY)}h${r1(w)}v${r1(h)}h${r1(-w)}Z`, { fill: t.paper2, 'stroke-width': 4 });
        path(`M${r1(x - 10)} ${r1(topY)}H${r1(x + w + 10)}`, { 'stroke-width': 6 });
        const bx = x + w * 0.16, by = topY + h * 0.84, bw = w * 0.11;
        [0.35, 0.55, 0.45, 0.78].forEach((v, k) => path(`M${r1(bx + k * bw * 1.7)} ${r1(by)}v${r1(-h * 0.62 * v)}h${r1(bw)}v${r1(h * 0.62 * v)}`, { fill: k === 3 ? K.tint : t.paper2, 'stroke-width': 2.6 }));
        path(`M${r1(bx - 8)} ${r1(by)}H${r1(x + w * 0.86)}`, { 'stroke-width': 2.6 });
        floor(); break;
      }
      case 'classroom': {
        // the board takes the widest stretch of wall left free by wall props (a whiteboard prop *is* the board)
        if ((L.wall || []).some(h => h.kind === 'whiteboard')) { floor(); break; }
        let w = Math.min(box.w * (portrait ? 0.84 : 0.52), 780 * ks), x = box.x + box.w / 2 - w / 2;
        const h = Math.min(250 * ks, close ? 300 : room);
        if ((L.wall || []).length) {
          const cuts = L.wall.map(q => [q.x - q.w / 2 - 28, q.x + q.w / 2 + 28]).sort((a, b) => a[0] - b[0]);
          let best = null, a = box.x + 16;
          for (const [c0, c1] of cuts.concat([[box.x + box.w - 16, Infinity]])) { if (c0 - a > (best ? best[1] - best[0] : 0)) best = [a, c0]; a = Math.max(a, c1); }
          if (!best || best[1] - best[0] < 180 * ks) { floor(); break; }
          w = Math.min(w, best[1] - best[0]);
          x = clamp(box.x + box.w / 2 - w / 2, best[0], best[1] - w);
        }
        path(`M${r1(x)} ${r1(topY)}h${r1(w)}v${r1(h)}h${r1(-w)}Z`, { fill: K.tint, 'stroke-width': 5 });
        path(`M${r1(x - 6)} ${r1(topY + h + 8)}H${r1(x + w + 6)}`, { 'stroke-width': 5 });
        for (let k = 0; k < 3; k++) if ((50 + k * 46) * ks < h - 20) path(scribble(x + 40 * ks, topY + (50 + k * 46) * ks, w * (k === 1 ? 0.4 : 0.55), 4), { 'stroke-width': 3 });
        floor(); break;
      }
      case 'home': {
        const fw = Math.min(240 * ks, box.w * 0.46), x = fx([0.5, 0.3, 0.7, 0.15, 0.85], fw);
        if (x != null) frameArt(x - fw / 2, topY + (close ? 0 : 10), fw, close ? 170 * ks : Math.min(160 * ks, room));
        const lx = !close && floorY != null && !L.mini ? fx([0.93, 0.07], 90 * s) : null;
        if (lx != null) {
          path(`M${r1(lx)} ${r1(FY)}V${r1(FY - 330 * s)}`, { 'stroke-width': 4 });
          path(`M${r1(lx - 34 * s)} ${r1(FY)}h${r1(68 * s)}`, { 'stroke-width': 4 });
          path(`M${r1(lx - 44 * s)} ${r1(FY - 330 * s)}L${r1(lx - 28 * s)} ${r1(FY - 400 * s)}H${r1(lx + 28 * s)}L${r1(lx + 44 * s)} ${r1(FY - 330 * s)}Z`, { fill: t.paper2 });
        }
        if (floorY != null) ctx.el('ellipse', { cx: r1(box.x + box.w / 2), cy: r1(FY + 6 * s), rx: r1(box.w * 0.36), ry: r1(Math.min(24 * s, bottom - FY - 2)), fill: K.tint, stroke: 'none' }, g);
        floor(); break;
      }
      case 'store': {
        const y0 = topY + 10, y1 = floorY != null ? Math.min(floorY - 40, L.headTop + room) : box.y + box.h * 0.6;
        const rows = Math.max(1, Math.min(3, Math.floor((y1 - y0) / (130 * ks))));
        for (let r = 1; r <= rows; r++) {
          const y = y0 + (y1 - y0) * r / (rows + 0.3);
          path(`M${box.x + 20} ${r1(y)}H${box.x + box.w - 20}`, { 'stroke-width': 4 });
          let x = box.x + 44 + (r % 2) * 40 * ks;
          for (let k = 0; x < box.x + box.w - 90; k++) {
            const kind = (k + r) % 5;
            if (kind === 0) path(`M${r1(x)} ${r1(y)}v${r1(-50 * ks)}h${r1(40 * ks)}v${r1(50 * ks)}`, { fill: t.paper2, 'stroke-width': 2.6 });
            else if (kind === 1) path(`M${r1(x)} ${r1(y)}v${r1(-34 * ks)}q0 ${r1(-10 * ks)} ${r1(10 * ks)} ${r1(-10 * ks)}v${r1(-14 * ks)}h${r1(8 * ks)}v${r1(14 * ks)}q${r1(10 * ks)} 0 ${r1(10 * ks)} ${r1(10 * ks)}v${r1(34 * ks)}`, { fill: K.tint, 'stroke-width': 2.6 });
            else if (kind === 2) path(`M${r1(x)} ${r1(y)}v${r1(-30 * ks)}h${r1(56 * ks)}v${r1(30 * ks)}`, { fill: t.paper2, 'stroke-width': 2.6 });
            x += (kind > 2 ? 96 : 72) * ks;
          }
        }
        floor(); break;
      }
      case 'street': {
        const base = floorY != null ? floorY - 40 * s : bottom;
        const hs = [0.62, 0.4, 0.74, 0.5, 0.68, 0.36, 0.58];
        let x = box.x - 20, k = 0;
        while (x < box.x + box.w + 10) {
          const w = Math.min((k % 2 ? 180 : 240) * ks, box.x + box.w + 20 - x), h = Math.min((base - topY) * hs[k % hs.length] + 40, base - box.y - 10);
          if (w < 40) break;
          path(`M${r1(x)} ${r1(base)}V${r1(base - h)}H${r1(x + w)}V${r1(base)}`, { fill: t.paper2 });
          // a few windows near the top of each building, not a grid
          const cols = Math.max(1, Math.floor((w - 40 * ks) / (60 * ks)));
          for (let rr = 0; rr < 2; rr++) for (let c = 0; c < cols; c++) {
            if ((c + rr + k) % 3 === 2) continue;
            const xx = x + 30 * ks + c * 60 * ks, yy = base - h + 30 * ks + rr * 64 * ks;
            if (yy + 30 * ks < base - 30) path(`M${r1(xx)} ${r1(yy)}h${r1(24 * ks)}v${r1(32 * ks)}h${r1(-24 * ks)}Z`, { 'stroke-width': 2.6 });
          }
          x += w + 22 * ks; k++;
        }
        if (floorY != null) {
          path(`M${box.x} ${r1(base)}H${box.x + box.w}`, { 'stroke-width': 4 });
          const lx = L.mini ? null : fx([0.93, 0.07, 0.5], 80 * s);
          if (lx != null) {
            path(`M${r1(lx)} ${r1(FY)}V${r1(FY - 470 * s)}q0 ${r1(-22 * s)} ${r1(26 * s)} ${r1(-22 * s)}h${r1(30 * s)}`, { 'stroke-width': 5 });
            path(`M${r1(lx + 44 * s)} ${r1(FY - 492 * s)}l${r1(18 * s)} ${r1(26 * s)}h${r1(-46 * s)}z`, { fill: t.paper2 });
          }
        }
        break;
      }
      default: break;   // blank: the cast stands on its own shadows
    }
  }

  function scribble(x, y, w, amp = 4) {
    const n = Math.max(2, Math.round(w / 16)), st = w / n;
    let d = `M${r1(x)} ${r1(y)}`;
    for (let k = 0; k < n; k++) d += ` q${r1(st / 2)} ${k % 2 ? amp : -amp} ${r1(st)} 0`;
    return d;
  }

  function drawTable(K, g, x0, x1, TB, s, FY, deep, box) {
    const { ctx, t } = K;
    const tg = ctx.el('g', { fill: 'none', stroke: t.ink, 'stroke-width': r1(clamp(3.2 * s, 3, 5)), 'stroke-linejoin': 'round', 'stroke-linecap': 'round', class: 'mo-table' }, g);
    const bottom = box.y + box.h;
    if (deep) {
      // deep = depth of the top: a light drawn table (paper top, thin front band, two legs) that frames the sitters
      const inset = Math.min(44, (x1 - x0) * 0.07), band = clamp(20 * s, 16, 30), fy = Math.min(FY, bottom - 4);
      ctx.el('path', { d: `M${r1(x0 + inset)} ${r1(TB)}H${r1(x1 - inset)}L${r1(x1)} ${r1(TB + deep)}H${r1(x0)}Z`, fill: t.paper2 }, tg);
      ctx.el('path', { d: `M${r1(x0)} ${r1(TB + deep)}H${r1(x1)}V${r1(TB + deep + band)}H${r1(x0)}Z`, fill: K.tint }, tg);
      ctx.el('path', { d: `M${r1(x0 + 18)} ${r1(TB + deep + band)}L${r1(x0 + 24)} ${r1(fy)}M${r1(x1 - 18)} ${r1(TB + deep + band)}L${r1(x1 - 24)} ${r1(fy)}`, 'stroke-width': r1(clamp(6 * s, 5, 9)) }, tg);
    } else {
      const d = Math.min(82 * s, bottom + 2 - TB), band = 26 * s, inset = 34 * s;
      ctx.el('path', { d: `M${r1(x0 + inset)} ${r1(TB)}H${r1(x1 - inset)}L${r1(x1)} ${r1(TB + d)}H${r1(x0)}Z`, fill: K.tint }, tg);
      if (TB + d < bottom) ctx.el('path', { d: `M${r1(x0)} ${r1(TB + d)}H${r1(x1)}V${r1(TB + d + band)}H${r1(x0)}Z`, fill: t.paper2 }, tg);
      const ly = Math.min(FY, bottom + 10);
      if (TB + d + band < bottom) ctx.el('path', { d: `M${r1(x0 + 22 * s)} ${r1(TB + d + band)}L${r1(x0 + 28 * s)} ${r1(ly)}M${r1(x1 - 22 * s)} ${r1(TB + d + band)}L${r1(x1 - 28 * s)} ${r1(ly)}`, 'stroke-width': r1(7 * s) }, tg);
    }
    ctx.rough(tg, 1);
  }

  // a sitter's shins and shoes under a tall table (the knees hide under the table's front band)
  function seatedLegs(K, g, p, top, FY) {
    const { t } = K, s = p.s, sw = r1(3 + 1.25 * s), dress = p.info.top === 'dress';
    const lw = (dress ? 15 : 30) * s, fill = dress ? K.skin : K.pants, y1 = Math.min(FY - 10 * s, K.ctx.H - 6);
    if (y1 <= top + 10) return null;
    const lg = K.el('g', { fill: 'none', stroke: t.ink, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'mo-legs' }, g);
    for (const m of [-1, 1]) {
      const x = p.x + 30 * s * m, d = `M${r1(x)} ${r1(top)}L${r1(x + 4 * s * m)} ${r1(y1)}`;
      K.el('path', { d, 'stroke-width': r1(lw + 2 * sw) }, lg);
      K.el('path', { d, stroke: fill, 'stroke-width': r1(lw) }, lg);
      const sx = x + 4 * s * m, sy = y1 + 4 * s;
      K.el('path', { d: `M${r1(sx - 13 * s * m)} ${r1(sy - 5 * s)}C${r1(sx - 16 * s * m)} ${r1(sy + 12 * s)} ${r1(sx + 26 * s * m)} ${r1(sy + 15 * s)} ${r1(sx + 29 * s * m)} ${r1(sy + 5 * s)}C${r1(sx + 31 * s * m)} ${r1(sy - 4 * s)} ${r1(sx + 12 * s * m)} ${r1(sy - 11 * s)} ${r1(sx - 13 * s * m)} ${r1(sy - 5 * s)}Z`, fill: K.solid, 'stroke-width': sw }, lg);
    }
    K.ctx.rough(lg, 1);
    return lg;
  }

  function drawSeat(K, gB, gF, kind, x0, x1, seatY, FY, s) {
    const { ctx, t } = K;
    const st = { fill: 'none', stroke: t.ink, 'stroke-width': r1(clamp(3.2 * s, 3, 5)), 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
    const b = ctx.el('g', st, gB), f = ctx.el('g', st, gF);
    if (kind === 'sofa') {
      ctx.el('path', { d: `M${r1(x0)} ${r1(seatY + 10 * s)}V${r1(seatY - 128 * s)}Q${r1(x0)} ${r1(seatY - 150 * s)} ${r1(x0 + 22 * s)} ${r1(seatY - 150 * s)}H${r1(x1 - 22 * s)}Q${r1(x1)} ${r1(seatY - 150 * s)} ${r1(x1)} ${r1(seatY - 128 * s)}V${r1(seatY + 10 * s)}`, fill: K.tint }, b);
      ctx.el('path', { d: `M${r1(x0 + 6 * s)} ${r1(seatY)}H${r1(x1 - 6 * s)}V${r1(seatY + 34 * s)}H${r1(x0 + 6 * s)}Z`, fill: K.tint }, f);
      ctx.el('path', { d: `M${r1(x0 + 6 * s)} ${r1(seatY + 34 * s)}H${r1(x1 - 6 * s)}V${r1(FY - 24 * s)}H${r1(x0 + 6 * s)}Z`, fill: t.paper2 }, f);
      for (const [xa, dir] of [[x0, 1], [x1, -1]]) ctx.el('path', { d: `M${r1(xa - 26 * s * dir)} ${r1(FY - 24 * s)}V${r1(seatY - 54 * s)}Q${r1(xa - 26 * s * dir)} ${r1(seatY - 74 * s)} ${r1(xa)} ${r1(seatY - 74 * s)}Q${r1(xa + 26 * s * dir)} ${r1(seatY - 74 * s)} ${r1(xa + 26 * s * dir)} ${r1(seatY - 54 * s)}V${r1(FY - 24 * s)}Z`, fill: K.tint }, f);
      ctx.el('path', { d: `M${r1(x0 - 14 * s)} ${r1(FY - 24 * s)}v${r1(18 * s)}M${r1(x1 + 14 * s)} ${r1(FY - 24 * s)}v${r1(18 * s)}` }, f);
    } else {
      ctx.el('path', { d: `M${r1(x0)} ${r1(seatY - 116 * s)}H${r1(x1)}V${r1(seatY - 96 * s)}H${r1(x0)}ZM${r1(x0)} ${r1(seatY - 70 * s)}H${r1(x1)}V${r1(seatY - 50 * s)}H${r1(x0)}Z`, fill: K.tint }, b);
      ctx.el('path', { d: `M${r1(x0 + 30 * s)} ${r1(seatY - 116 * s)}V${r1(seatY)}M${r1(x1 - 30 * s)} ${r1(seatY - 116 * s)}V${r1(seatY)}` }, b);
      ctx.el('path', { d: `M${r1(x0 - 8 * s)} ${r1(seatY)}H${r1(x1 + 8 * s)}V${r1(seatY + 20 * s)}H${r1(x0 - 8 * s)}Z`, fill: K.tint }, f);
      ctx.el('path', { d: `M${r1(x0 + 24 * s)} ${r1(seatY + 20 * s)}L${r1(x0 + 20 * s)} ${r1(FY)}M${r1(x1 - 24 * s)} ${r1(seatY + 20 * s)}L${r1(x1 - 20 * s)} ${r1(FY)}`, 'stroke-width': r1(6 * s) }, f);
    }
    ctx.rough(b, 1); ctx.rough(f, 1);
  }

  function sideTable(K, g, x, FY, s) {
    const { ctx, t } = K;
    const tg = ctx.el('g', { fill: 'none', stroke: t.ink, 'stroke-width': r1(clamp(3.2 * s, 3, 5)), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    ctx.el('ellipse', { cx: r1(x), cy: r1(FY - 132 * s), rx: r1(70 * s), ry: r1(14 * s), fill: K.tint }, tg);
    const lim = K.ctx.H - 6;
    ctx.el('path', { d: `M${r1(x)} ${r1(FY - 118 * s)}V${r1(Math.min(lim, FY - 4 * s))}` + (FY < lim ? `M${r1(x - 34 * s)} ${r1(FY - 2 * s)}H${r1(x + 34 * s)}` : ''), 'stroke-width': r1(6 * s) }, tg);
    ctx.rough(tg, 1);
  }

  /* --------------------------------------------------------------- props */

  // local units, origin = bottom centre, sized next to a scale-1 person (head ≈ 100)
  function propSVG(kind, c, o) {
    const A = o.acc;
    switch (kind) {
      case 'phone': return `<rect x="-26" y="-92" width="52" height="92" rx="10" fill="${A ? c.acc : c.solid}"/><rect x="-20" y="-84" width="40" height="72" rx="4" fill="${c.paper}"/><circle cx="0" cy="-6" r="2.5" fill="${c.paper}" stroke="none"/>`;
      case 'laptop': return `<path d="M-68 -12V-106Q-68 -112 -62 -112H62Q68 -112 68 -106V-12Z" fill="${A ? c.acc : c.paper}"/><rect x="-58" y="-102" width="116" height="80" rx="3" fill="${c.paper}"/><path d="M-88 0H88L74 -12H-74Z" fill="${c.paper}"/>`;
      case 'receipt': {
        let z = 'M-36 -116H36V-6';
        for (let k = 0; k < 6; k++) z += `L${r1(36 - 12 * k - 6)} 2L${r1(36 - 12 * (k + 1))} -6`;
        return `<g transform="rotate(-5)"><path d="${z}Z" fill="${A ? c.accSoft : c.paper}"/>${[-96, -80, -64].map(y => `<path d="${scribble(-24, y, 30, 2.5)}M18 ${y}h8" stroke-width="2.6"/>`).join('')}<path d="M-26 -46H26" stroke-width="2.6" stroke-dasharray="5 6"/><path d="M-24 -28H-4M8 -28H26" stroke-width="4.5"/></g>`;
      }
      case 'money': return `<rect x="-58" y="-46" width="106" height="46" rx="5" fill="${c.tint}"/><rect x="-48" y="-60" width="106" height="46" rx="5" fill="${A ? c.acc : c.paper}"/><circle cx="5" cy="-37" r="11"/><path d="M-36 -37h.01M46 -37h.01" stroke-width="6"/><ellipse cx="78" cy="-9" rx="18" ry="8" fill="${c.paper}"/><path d="M60 -9v-8M96 -9v-8" /><ellipse cx="78" cy="-17" rx="18" ry="8" fill="${c.paper}"/>`;
      case 'bag': return `<path d="M-34 0L-29 -86H29L34 0Z" fill="${A ? c.acc : c.paper}"/><path d="M-15 -86C-15 -112 15 -112 15 -86"/>`;
      case 'food': return `<path d="M-90 -40H90L108 0H-108Z" fill="${c.paper}"/><ellipse cx="0" cy="-21" rx="76" ry="13" fill="${A ? c.accSoft : c.tint}"/><path d="M0 -34V-8M-62 -27L62 -15M62 -27L-62 -15" stroke-width="2.6"/><circle cx="-30" cy="-23" r="3.5" fill="${c.ink}" stroke="none"/><circle cx="28" cy="-17" r="3.5" fill="${c.ink}" stroke="none"/><circle cx="8" cy="-27" r="3" fill="${c.ink}" stroke="none"/>`;
      case 'coffee': return `<path d="M-21 -48H21V-11Q21 0 10 0H-10Q-21 0 -21 -11Z" fill="${A ? c.acc : c.paper}"/><path d="M21 -40Q36 -40 36 -27Q36 -14 21 -14"/><path d="M-8 -58q-6 -8 0 -14q6 -6 0 -14M8 -58q-6 -8 0 -14q6 -6 0 -14" stroke-width="2.6"/>`;
      case 'box': return `<path d="M-56 -80H56V0H-56Z" fill="${A ? c.acc : c.tint}"/><path d="M-56 -80L-42 -100H42L56 -80Z" fill="${c.paper}"/><path d="M-12 -80V-44H12V-80" fill="${c.paper}"/>`;
      case 'chart': return `<rect x="-104" y="-156" width="208" height="156" rx="4" fill="${c.paper}"/><path d="M-82 -26H84M-82 -26V-134"/><path d="M-70 -44L-30 -64L10 -56L48 -98L74 -120" stroke="${A ? c.acc : c.ink}" stroke-width="6"/><path d="M56 -122L76 -122L74 -102" stroke="${A ? c.acc : c.ink}" stroke-width="6"/>`;
      case 'clock': {
        const [hh, mm] = o.time || [9, 0], ha = ((hh % 12) + mm / 60) * 30 * DEG, ma = mm * 6 * DEG;
        const hand = (a, l) => `M0 -50L${r1(Math.sin(a) * l)} ${r1(-50 - Math.cos(a) * l)}`;
        return `<circle cx="0" cy="-50" r="48" fill="${A ? c.accSoft : c.paper}"/><path d="${hand(ma, 34)}${hand(ha, 23)}" stroke-width="5.5"/><path d="M0 -94v6M0 -12v-6M-44 -50h6M44 -50h-6" stroke-width="3"/>`;
      }
      case 'calendar': return `<rect x="-58" y="-126" width="116" height="126" rx="6" fill="${c.paper}"/><path d="M-58 -98V-120Q-58 -126 -52 -126H52Q58 -126 58 -120V-98Z" fill="${c.tint}"/><path d="M-30 -136V-114M30 -136V-114" stroke-width="5"/>` +
        [0, 1, 2].map(r => [0, 1, 2, 3].map(q => `<path d="M${-36 + q * 24} ${-76 + r * 26}h.01" stroke-width="6"/>`).join('')).join('') +
        `<circle cx="12" cy="-24" r="14" stroke="${A ? c.acc : c.ink}" stroke-width="4.5"/>`;
      case 'letter': return `<rect x="-64" y="-82" width="128" height="82" rx="5" fill="${A ? c.accSoft : c.paper}"/><path d="M-62 -78L0 -34L62 -78"/>`;
      case 'store': {
        let aw = '';
        for (let k = 0; k < 6; k++) aw += `<path d="M${-120 + k * 40} -176h40v26q-20 16 -40 0z" fill="${k % 2 ? c.paper : A ? c.acc : c.tint}"/>`;
        return `<path d="M-112 0V-150H112V0Z" fill="${c.paper}"/>${aw}<path d="M-26 0V-98H26V0"/><path d="M48 -116H96V-52H48Z"/><path d="M-96 -116H-48V-52H-96Z"/><path d="M-80 -218H80V-180H-80Z" fill="${c.paper}"/><path d="${scribble(-58, -199, 116, 3)}" stroke-width="3"/>`;
      }
      case 'car': return `<path d="M-132 -30V-60L-106 -68L-76 -106H44L84 -68L126 -60V-30Z" fill="${A ? c.acc : c.paper}"/><path d="M-66 -70L-48 -96H-6V-70ZM6 -70V-96H38L62 -70Z" fill="${c.tint}"/><circle cx="-80" cy="-28" r="24" fill="${c.ink2}"/><circle cx="80" cy="-28" r="24" fill="${c.ink2}"/><circle cx="-80" cy="-28" r="8" fill="${c.paper}"/><circle cx="80" cy="-28" r="8" fill="${c.paper}"/><path d="M112 -52h10"/>`;
      case 'plant': return `<path d="M-50 -106H50L38 0H-38Z" fill="${A ? c.acc : c.tint}"/><path d="M0 -86C-10 -166 -60 -206 -90 -236C-50 -186 -30 -146 -6 -86" fill="${c.paper}"/><path d="M4 -86C10 -186 50 -246 86 -266C50 -206 34 -146 14 -86" fill="${c.paper}"/><path d="M0 -86C-4 -176 4 -246 10 -306C24 -226 18 -146 8 -86" fill="${c.paper}"/>`;
      case 'whiteboard': return (o.onWall ? '' : '<path d="M-112 -86L-132 0M112 -86L132 0" stroke-width="6"/>') + `<rect x="-146" y="-282" width="292" height="196" rx="5" fill="${c.paper}"/><path d="M-150 -86H150" stroke-width="5"/>`;
      case 'cake': return `<path d="M-62 -62H62V0H-62Z" fill="${c.paper}"/><path d="M-62 -50q10 12 21 0q10 12 21 0q10 12 21 0q10 12 21 0q10 12 21 0q10 12 20 0"/><path d="M-40 -98H40V-62H-40Z" fill="${c.tint}"/><rect x="-4" y="-126" width="8" height="28" fill="${c.paper}"/><path d="M0 -148q9 11 0 17q-9 -6 0 -17Z" fill="${A ? c.acc : c.paper}"/>`;
      case 'chat': return `<rect x="-40" y="-130" width="80" height="130" rx="13" fill="${c.solid}"/><rect x="-33" y="-118" width="66" height="104" rx="5" fill="${c.paper}"/>` +
        `<rect x="-26" y="-108" width="38" height="16" rx="8" fill="${c.tint}" stroke-width="2.6"/><rect x="-12" y="-84" width="38" height="16" rx="8" fill="${A ? c.acc : c.tint}" stroke-width="2.6"/>` +
        `<rect x="-26" y="-60" width="28" height="16" rx="8" fill="${c.tint}" stroke-width="2.6"/><path d="M-6 -32h.01M4 -32h.01M14 -32h.01" stroke-width="5"/>`;
      default: return '<circle cx="0" cy="-40" r="36"/>';
    }
  }
  const PROP_W = { phone: 52, laptop: 176, receipt: 80, money: 190, bag: 70, food: 216, coffee: 72, box: 112, chart: 208, clock: 98, calendar: 116, letter: 128, store: 240, car: 260, plant: 180, whiteboard: 300, cake: 124, chat: 80 };
  const PROP_H = { phone: 92, laptop: 112, receipt: 118, money: 60, bag: 110, food: 40, coffee: 86, box: 100, chart: 156, clock: 98, calendar: 136, letter: 82, store: 218, car: 106, plant: 306, whiteboard: 282, cake: 148, chat: 130 };

  // "21:04", "9:30", "18.40", "8:15 pm" → [h, m] (null when the label holds no time)
  function clockTime(v) {
    const m = str(v).match(/(\d{1,2})\s*[:.]\s*(\d{2})(?:\s*([ap])\.?\s*m\b)?/i);
    if (!m || +m[1] > 24 || +m[2] > 59) return null;
    let h = +m[1];
    if (m[3]) h = (h % 12) + (/p/i.test(m[3]) ? 12 : 0);
    return [h, +m[2]];
  }

  function prop(K, parent, pr, x, y, s, acc, onWall, bounds) {
    const { ctx, t } = K;
    const c = { ink: t.ink, solid: K.solid, ink2: K.pants, paper: t.paper2, tint: K.tint, acc: t.accent, accSoft: t.accentSoft };
    const g = ctx.el('g', { class: 'mo-prop mo-prop-' + pr.kind }, parent);
    const sw = r1(clamp(3.4 / s, 2.6, 7));
    if (onWall && pr.kind === 'whiteboard') y += 86 * s;   // no legs: the board itself hangs at y
    const body = ctx.el('g', { transform: `translate(${r1(x)} ${r1(y)}) scale(${r2(s)})`, fill: 'none', stroke: t.ink, 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    body.innerHTML = propSVG(pr.kind, c, { acc, onWall, time: pr.kind === 'clock' ? clockTime(pr.time) || clockTime(pr.label) : null });
    ctx.rough(body, 1);
    const label = clean(ctx, pr.label);
    // things that carry text inside
    if (pr.kind === 'whiteboard' && label) {
      ctx.text(g, label, x, y - 184 * s, { font: 'hand', size: Math.max(K.min + 2, 30 * s), weight: 600, anchor: 'middle', valign: 'middle', maxW: 250 * s, lines: 3, lh: 1.1, color: acc ? 'accent' : 'ink', minSize: K.min });
    } else if (pr.kind === 'whiteboard') {
      ctx.el('path', { d: scribble(x - 110 * s, y - 230 * s, 200 * s, 4) + scribble(x - 110 * s, y - 190 * s, 150 * s, 4), stroke: t.ink2, 'stroke-width': 3, fill: 'none' }, g);
    } else if ((pr.kind === 'phone' || pr.kind === 'laptop') && Array.isArray(pr.screen) && pr.screen.length) {
      const sc = pr.kind === 'phone' ? { x: -20, y: -84, w: 40, h: 72 } : { x: -58, y: -102, w: 116, h: 80 };
      tinyScreen(K, g, pr.screen, { x: x + sc.x * s, y: y + sc.y * s, w: sc.w * s, h: sc.h * s });
    }
    if (label && pr.kind !== 'whiteboard') {
      const T = ctx.text(g, label, x, y + (pr.kind === 'clock' || pr.kind === 'calendar' || pr.kind === 'chart' ? 16 : 14) * Math.max(1, s * 0.8), {
        font: 'mono', size: K.min + (K.tall ? 0 : 1), color: acc ? 'accent' : 'ink2', anchor: 'middle', ls: 0.06, maxW: Math.max(160, 220 * s), lines: 2, lh: 1.2,
      });
      // the label stays inside the panel (it slides in from the edge instead of being cut)
      if (bounds && T.el) {
        const dx = clamp(x, bounds.x + T.w / 2 + 10, bounds.x + bounds.w - T.w / 2 - 10) - x;
        if (Math.abs(dx) > 0.5) T.el.setAttribute('transform', `translate(${r1(dx)} 0)`);
      }
    }
    return g;
  }

  // a phone/laptop screen at prop size: the header and the one key element (accent item, else button,
  // amount, check...). Text where it is legible; otherwise every line is a scribble, consistently.
  function tinyScreen(K, parent, items, box) {
    const { ctx, t } = K;
    const list = items.filter(it => it && typeof it === 'object');
    const head = list.find(it => it.type === 'header') || list.find(it => it.type === 'text');
    const key = list.find(it => it !== head && it.accent) || list.find(it => it !== head && ['button', 'amount', 'check', 'toast', 'progress'].includes(it.type)) || list.find(it => it !== head);
    const g = ctx.el('g', { class: 'mo-ui mo-ui-tiny' }, parent);
    const pad = Math.max(4, box.w * 0.1), x = box.x + pad, w = box.w - 2 * pad;
    const fs = Math.min(box.h * 0.26, K.min * 1.25), legible = fs >= K.min * 0.8 && w >= fs * 3;
    const lw = Math.max(2.2, box.h * 0.035);
    const scrib = (x0, yy, ww, col) => ctx.el('path', { d: scribble(x0, yy, ww, Math.max(1.2, box.h * 0.03)), stroke: col, 'stroke-width': lw, fill: 'none', 'stroke-linecap': 'round' }, g);
    // text only when it fits on one line at a legible size (else the caller draws a scribble)
    const fits = (txt, size, opt) => {
      if (!legible || !txt) return false;
      const [T, got] = quietly(ctx, () => ctx.text(g, txt, opt.x ?? x, opt.y, Object.assign({ font: 'hand', size, maxW: w, lines: 1, color: 'ink', minSize: Math.max(K.min * 0.8, size * 0.7) }, opt)));
      if (got.length) { T.el.remove(); return false; }
      return true;
    };
    const fs0 = fs;
    const hy = box.y + box.h * 0.1;
    if (head && !fits(str(head.text), fs0, { y: hy, weight: 600 })) scrib(x, hy + fs0 * 0.5, w * 0.62, t.ink);
    if (!key) { scrib(x, box.y + box.h * 0.55, w * 0.8, t.muted); scrib(x, box.y + box.h * 0.72, w * 0.5, t.muted); return g; }
    const txt = str(key.text), ky = box.y + box.h * 0.5, kh = box.h * 0.3, fill = key.accent ? t.accent : t.ink;
    if (key.type === 'button' || key.type === 'toast') {
      const solid = key.type === 'toast' || key.accent;
      const r = ctx.el('rect', { x, y: ky, width: w, height: kh, rx: key.type === 'button' ? kh / 2 : kh * 0.25, fill: solid ? fill : t.paper2, stroke: t.ink, 'stroke-width': lw }, g);
      ctx.rough(r, 1);
      const col = solid ? t.paper2 : t.ink;
      if (!fits(txt, Math.min(fs0, kh * 0.62), { x: x + w / 2, y: ky + kh / 2, anchor: 'middle', valign: 'middle', weight: 700, color: col, maxW: w - kh * 0.5 }))
        ctx.el('path', { d: `M${r1(x + w * 0.3)} ${r1(ky + kh / 2)}h${r1(w * 0.4)}`, stroke: col, 'stroke-width': lw * 1.4, 'stroke-linecap': 'round' }, g);
    } else if (key.type === 'amount') {
      if (!fits(txt, Math.min(fs0 * 1.35, box.h * 0.34), { y: ky, weight: 700, color: key.accent ? 'accent' : 'ink' }))
        ctx.el('path', { d: `M${r1(x)} ${r1(ky + kh / 2)}h${r1(w * 0.55)}`, stroke: fill, 'stroke-width': Math.max(4, kh * 0.4), 'stroke-linecap': 'round' }, g);
    } else {
      const cr = Math.min(kh * 0.45, w * 0.14), cy = ky + kh / 2, isCheck = key.type === 'check';
      if (isCheck) {
        ctx.el('circle', { cx: x + cr, cy, r: cr, fill: key.accent ? t.accent : t.paper2, stroke: t.ink, 'stroke-width': lw }, g);
        ctx.el('path', { d: `M${r1(x + cr * 0.5)} ${r1(cy)}l${r1(cr * 0.35)} ${r1(cr * 0.38)}l${r1(cr * 0.7)} ${r1(-cr * 0.8)}`, stroke: key.accent ? t.paper2 : t.ink, 'stroke-width': lw, fill: 'none', 'stroke-linecap': 'round' }, g);
      }
      const tx = isCheck ? x + cr * 2.4 : x, col = key.accent && !isCheck ? 'accent' : 'ink';
      if (!fits(txt, fs0 * 0.85, { x: tx, y: cy, valign: 'middle', maxW: x + w - tx, color: col }))
        scrib(tx, cy, (x + w - tx) * 0.8, key.accent && !isCheck ? t.accent : t.muted);
    }
    return g;
  }

  /* -------------------------------------------------------------- bubbles */

  // rounded box with a tail notched into one edge: one clean outline, filled and stroked once
  function bubblePath(x, y, w, h, r, tail) {
    const T = tail || {};
    const q = (a, b) => {   // tail from base a to tip to base b
      const tp = T.tip;
      return `L${r1(a.x)} ${r1(a.y)}Q${r1(a.x + (tp.x - a.x) * 0.25)} ${r1(a.y + (tp.y - a.y) * 0.6)} ${r1(tp.x)} ${r1(tp.y)}Q${r1(b.x + (tp.x - b.x) * 0.55)} ${r1(b.y + (tp.y - b.y) * 0.4)} ${r1(b.x)} ${r1(b.y)}`;
    };
    let d = `M${r1(x + r)} ${r1(y)}`;
    if (T.side === 'top') d += q({ x: Math.min(T.a, T.b), y }, { x: Math.max(T.a, T.b), y });
    d += `L${r1(x + w - r)} ${r1(y)}Q${r1(x + w)} ${r1(y)} ${r1(x + w)} ${r1(y + r)}`;
    if (T.side === 'right') d += q({ x: x + w, y: Math.min(T.a, T.b) }, { x: x + w, y: Math.max(T.a, T.b) });
    d += `L${r1(x + w)} ${r1(y + h - r)}Q${r1(x + w)} ${r1(y + h)} ${r1(x + w - r)} ${r1(y + h)}`;
    if (T.side === 'bottom') d += q({ x: Math.max(T.a, T.b), y: y + h }, { x: Math.min(T.a, T.b), y: y + h });
    d += `L${r1(x + r)} ${r1(y + h)}Q${r1(x)} ${r1(y + h)} ${r1(x)} ${r1(y + h - r)}`;
    if (T.side === 'left') d += q({ x, y: Math.max(T.a, T.b) }, { x, y: Math.min(T.a, T.b) });
    d += `L${r1(x)} ${r1(y + r)}Q${r1(x)} ${r1(y)} ${r1(x + r)} ${r1(y)}Z`;
    return d;
  }

  function measureBubble(K, parent, text, fs, maxW) {
    const g = K.ctx.el('g', { class: 'mo-btext' }, parent);
    const T = K.ctx.text(g, text, 0, 0, { font: 'hand', size: fs, weight: 500, anchor: 'middle', valign: 'middle', maxW, lines: 4, lh: 1.16, color: 'ink' });
    return { g, T, w: Math.max(T.w + fs * 1.5, T.h + fs * 1.6, fs * 3), h: T.h + fs * 0.95 };
  }

  // place every bubble so it covers no face (heads are hard obstacles), stays in its box, sits near its speaker
  function placeBubbles(K, layer, speakers, heads, opts = {}) {
    const { ctx, t } = K, placed = [], out = [];
    const ov = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
    const hboxes = heads.map(h => ({ x0: h.x - h.r * 0.95, x1: h.x + h.r * 0.95, y0: Math.min(h.top, h.y - h.r * 1.1), y1: h.y + h.r * 0.9 }));
    const soft = opts.soft || [];
    const list = [];
    speakers.forEach(sp => { if (sp.say) list.push({ sp, kind: 'say', text: sp.say }); if (sp.think) list.push({ sp, kind: 'think', text: sp.think }); });
    for (const it of list) {
      const { sp } = it, box = sp.box, m = 16;
      const fs = opts.fs || (K.tall ? 34 : 30);
      const maxW = Math.min(box.w * (box.h > box.w ? 0.7 : 0.4), fs * 13);
      const M = measureBubble(K, layer, it.text, fs, maxW);
      const bw = it.kind === 'think' ? M.w * 1.12 + 16 : M.w, bh = it.kind === 'think' ? M.h * 1.3 + 14 : M.h;
      const gapY = it.kind === 'think' ? 54 : 34;
      const cands = [];
      const offs = [0, 0.3, 0.55, 0.85, 1.1];
      for (let lvl = 0; lvl < 6; lvl++) {
        const cy = sp.y - sp.r - gapY - bh / 2 - lvl * (bh * 0.55 + 18);
        for (const k of offs) for (const sg of k ? [sp.f, -sp.f] : [1]) cands.push({ cx: sp.x + k * bw * 0.5 * sg * 1.0 + (k ? sg * sp.r * 0.4 : 0), cy, pen: lvl * 1.2 + k * 0.6 + (sg === -sp.f ? 0.5 : 0) });
      }
      for (const sg of [sp.f, -sp.f]) for (const dy of [-0.9, -0.3, 0.3]) cands.push({ cx: sp.x + sg * (sp.r + 30 + bw / 2), cy: sp.y + dy * sp.r, pen: 1.4 + (sg === -sp.f ? 0.6 : 0) + Math.abs(dy) });
      let best = null;
      for (const c of cands) {
        const cx = clamp(c.cx, box.x + m + bw / 2, box.x + box.w - m - bw / 2), cy = clamp(c.cy, box.y + m + bh / 2, box.y + box.h - m - bh / 2);
        const r = { x0: cx - bw / 2, x1: cx + bw / 2, y0: cy - bh / 2, y1: cy + bh / 2 };
        const area = bw * bh;
        let sc = c.pen;
        // faces and other bubbles are (almost) hard obstacles; props and labels are soft
        for (const hb of hboxes) { const o = ov(r, hb); if (o > 0) sc += 60 + 900 * o / area; }
        for (const p of placed) { const o = ov({ x0: r.x0 - 14, x1: r.x1 + 14, y0: r.y0 - 14, y1: r.y1 + 14 }, p); if (o > 0) sc += 40 + 600 * o / area; }
        for (const so of soft) sc += 24 * ov(r, so) / area;
        const dist = Math.hypot(cx - sp.x, cy - sp.y) - sp.r;
        sc += Math.max(0, dist - 120) / 90;
        if (!best || sc < best.sc) best = { sc, cx, cy, r };
      }
      placed.push(best.r);
      const x = best.cx - bw / 2, y = best.cy - bh / 2;
      // tail tip: on a ring around the head, toward the bubble
      const ang = Math.atan2(best.cy - sp.y, best.cx - sp.x);
      const tip = sp.off ? { x: sp.x, y: sp.y } : { x: sp.x + Math.cos(ang) * (sp.r + 6), y: sp.y + Math.sin(ang) * (sp.r + 6) };
      const g = ctx.el('g', { class: 'mo-bubble' }, layer);
      const shape = ctx.el('g', {}, g);
      if (it.kind === 'say') {
        const r = Math.min(bh / 2, 30);
        let side;
        if (tip.y > y + bh) side = 'bottom'; else if (tip.y < y) side = 'top'; else side = tip.x < x ? 'left' : 'right';
        let tail;
        if (side === 'bottom' || side === 'top') {
          const c0 = clamp(tip.x + (best.cx - tip.x) * 0.35, x + r + 16, x + bw - r - 16);
          tail = { side, a: c0 - 15, b: c0 + 15, tip };
        } else {
          const c0 = clamp(tip.y + (best.cy - tip.y) * 0.35, y + r * 0.6 + 12, y + bh - r * 0.6 - 12);
          tail = { side, a: c0 - 13, b: c0 + 13, tip };
        }
        ctx.el('path', { d: bubblePath(x, y, bw, bh, r, tail), fill: t.paper2, stroke: t.ink, 'stroke-width': 3.4, 'stroke-linejoin': 'round' }, shape);
      } else {
        const cx = best.cx, cy = best.cy, rx = bw / 2, ry = bh / 2;
        const per = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
        const nb = Math.max(8, Math.round(per / 58));
        ctx.el('path', { d: scallop(cx, cy, rx - 10, ry - 10, 0, Math.PI * 2, nb, 26) + 'Z', fill: t.paper2, stroke: t.ink, 'stroke-width': 3.4, 'stroke-linejoin': 'round' }, shape);
        // trailing dots toward the thinker
        const ex = cx + Math.cos(ang + Math.PI) * rx * 0.92, ey = cy + Math.sin(ang + Math.PI) * ry * 0.92;
        [[0.3, 12], [0.6, 8.5], [0.86, 5.5]].forEach(([k, rr]) => ctx.el('circle', { cx: r1(ex + (tip.x - ex) * k), cy: r1(ey + (tip.y - ey) * k), r: rr, fill: t.paper2, stroke: t.ink, 'stroke-width': 3 }, shape));
      }
      ctx.rough(shape, 1);
      g.appendChild(M.g);
      M.g.setAttribute('transform', `translate(${r1(best.cx)} ${r1(best.cy)})`);
      out.push({ g, shape, text: M.T.el, kind: it.kind });
    }
    return out;
  }

  function bubbleBeats(K, list, at) {
    list.forEach((b, k) => {
      const t0 = at + k * 760;
      K.ctx.beat(b.shape, 'pop', { at: t0, dur: 420 });
      K.ctx.beat(b.text, 'type', { at: t0 + 220 });
    });
    return at + list.length * 760;
  }

  /* --------------------------------------------------------- screen ui */

  // a tasteful small app screen from a `screen` ui list: header | text | amount | button | list | avatars |
  // toast | input | progress | check | image | divider. k = scale against a 340-wide phone screen.
  function screenUI(K, parent, items, box, k, o = {}) {
    const { ctx, t } = K;
    const g = ctx.el('g', { class: 'mo-ui' }, parent);
    const els = [];
    const pad = 22 * k, x = box.x + pad, w = box.w - pad * 2;
    let y = box.y + (o.tiny ? 10 : 18) * k;
    const can = fs => fs >= K.min;
    const scrib = (yy, ww, col = t.muted) => ctx.el('path', { d: scribble(x, yy, ww, Math.max(1.5, 3 * k)), stroke: col, 'stroke-width': Math.max(2.6, 3.6 * k), fill: 'none', 'stroke-linecap': 'round' }, g);
    const line = (d, o2 = {}) => ctx.el('path', Object.assign({ d, fill: 'none', stroke: t.ink, 'stroke-width': Math.max(2.6, 3.2 * k), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, o2), g);
    let cut = false;
    for (const it of items) {
      if (!it || typeof it !== 'object') continue;
      if (y > box.y + box.h - 30 * k) { cut = true; break; }
      const ig = ctx.el('g', {}, g), txt = str(it.text);
      const T = (s0, fs, opt = {}) => ctx.text(ig, s0, opt.x ?? x, y, Object.assign({ font: 'hand', size: fs, maxW: w, lines: 2, lh: 1.12, color: 'ink' }, opt));
      switch (it.type) {
        case 'header': {
          const fs = 40 * k;
          if (can(fs)) y += T(txt, fs, { weight: 600, lines: 2 }).h + 14 * k; else { scrib(y + 14 * k, w * 0.6, t.ink); y += 34 * k; }
          break;
        }
        case 'text': {
          const fs = 23 * k;
          if (can(fs)) y += T(txt, fs, { color: 'ink2', lines: 3, lh: 1.25 }).h + 14 * k; else { scrib(y + 8 * k, w * 0.9); scrib(y + 26 * k, w * 0.6); y += 44 * k; }
          break;
        }
        case 'amount': {
          const fs = 66 * k;
          if (can(fs)) y += T(txt, fs, { weight: 700, lines: 1, minSize: 40 * k, color: it.accent ? 'accent' : 'ink' }).h + 14 * k;
          else { line(`M${x} ${y + 20 * k}h${w * 0.5}`, { 'stroke-width': Math.max(4, 12 * k), stroke: it.accent ? t.accent : t.ink }); y += 46 * k; }
          break;
        }
        case 'button': {
          const bh = 66 * k, fs = 28 * k;
          const r = ctx.el('rect', { x, y, width: w, height: bh, rx: bh / 2, fill: it.accent ? t.accent : t.paper2, stroke: t.ink, 'stroke-width': Math.max(2.6, 3.6 * k) }, ig);
          ctx.rough(r, 1);
          if (can(fs)) T(txt, fs, { x: x + w / 2, anchor: 'middle', weight: 700, lines: 1, minSize: K.min, color: it.accent ? t.paper2 : 'ink' }).el.setAttribute('transform', `translate(0 ${r1(bh / 2 - fs * 0.6)})`);
          else ctx.el('path', { d: `M${x + w * 0.3} ${y + bh / 2}h${w * 0.4}`, stroke: it.accent ? t.paper2 : t.ink, 'stroke-width': Math.max(2.6, 5 * k), 'stroke-linecap': 'round' }, ig);
          y += bh + 16 * k;
          break;
        }
        case 'list': {
          const rows = Array.isArray(it.items) && it.items.length ? it.items : [null, null, null];
          for (const row of rows) {
            if (y > box.y + box.h - 30 * k) { cut = true; break; }
            const fs = 24 * k;
            ctx.el('circle', { cx: x + 12 * k, cy: y + 16 * k, r: 12 * k, fill: K.tint, stroke: t.ink, 'stroke-width': Math.max(2.6, 3 * k) }, ig);
            if (row != null && can(fs)) ctx.text(ig, str(typeof row === 'object' ? row.text || row.label : row), x + 36 * k, y + 2 * k, { font: 'hand', size: fs, maxW: w - 36 * k, lines: 1, color: 'ink' });
            else ctx.el('path', { d: scribble(x + 36 * k, y + 16 * k, w * 0.55, Math.max(1.5, 3 * k)) + `M${x + w - 40 * k} ${y + 16 * k}h${30 * k}`, stroke: t.muted, 'stroke-width': Math.max(2.6, 3.4 * k), fill: 'none', 'stroke-linecap': 'round' }, ig);
            y += 46 * k;
          }
          y += 8 * k;
          break;
        }
        case 'avatars': {
          const names = Array.isArray(it.items) ? it.items : [];
          const hs = 0.46 * k, step = 70 * k;
          names.slice(0, 6).forEach((nm, j) => {
            const info = [...K.cast.values()].find(c => c.name === nm || c.id === nm);
            const cx = x + 30 * k + j * step, cy = y + 34 * k;
            if (info) head(K, ig, info, cx, cy, hs, 'happy', 1);
            else { ctx.el('circle', { cx, cy, r: 26 * k, fill: K.tint, stroke: t.ink, 'stroke-width': 3 }, ig); if (can(22 * k)) ctx.text(ig, String(nm).slice(0, 1), cx, cy, { font: 'hand', size: 24 * k, anchor: 'middle', valign: 'middle', weight: 600 }); }
          });
          y += 78 * k;
          break;
        }
        case 'toast': {
          // accent: true → accent fill; the text keeps its side padding and wraps to a second line before it is cut
          const fs = 22 * k, padX = 18 * k;
          let bh = 54 * k;
          const r = ctx.el('rect', { x, y, width: w, height: bh, rx: 14 * k, fill: it.accent ? t.accent : t.ink }, ig);
          if (can(fs)) {
            const tt = T(txt, fs, { x: x + padX, maxW: w - 2 * padX, color: t.paper2, lines: 2, lh: 1.15, minSize: K.min });
            bh = Math.max(bh, tt.h + 22 * k);
            r.setAttribute('height', r1(bh));
            tt.el.setAttribute('transform', `translate(0 ${r1((bh - tt.h) / 2)})`);
          }
          y += bh + 14 * k;
          break;
        }
        case 'input': {
          const bh = 56 * k, fs = 22 * k;
          const r = ctx.el('rect', { x, y, width: w, height: bh, rx: 12 * k, fill: t.paper2, stroke: t.ink, 'stroke-width': Math.max(2.6, 3 * k) }, ig);
          ctx.rough(r, 1);
          if (can(fs)) T(txt || '…', fs, { x: x + 16 * k, color: 'muted', lines: 1 }).el.setAttribute('transform', `translate(0 ${r1(bh / 2 - fs * 0.62)})`);
          y += bh + 14 * k;
          break;
        }
        case 'progress': {
          let v = +it.value;
          if (!isFinite(v)) { const mm = txt.match(/(\d+(?:[.,]\d+)?)/); v = mm ? parseFloat(mm[1].replace(',', '.')) : 60; }
          if (v > 1) v /= 100;
          v = clamp(v, 0, 1);
          const fs = 20 * k;
          if (txt && can(fs)) { y += T(txt, fs, { font: 'mono', color: 'ink2', lines: 1 }).h + 6 * k; }
          ctx.el('rect', { x, y, width: w, height: 18 * k, rx: 9 * k, fill: t.paper2, stroke: t.ink, 'stroke-width': Math.max(2.6, 3 * k) }, ig);
          ctx.el('rect', { x, y, width: Math.max(18 * k, w * v), height: 18 * k, rx: 9 * k, fill: it.accent ? t.accent : t.ink, stroke: t.ink, 'stroke-width': Math.max(2.6, 3 * k) }, ig);
          y += 34 * k;
          break;
        }
        case 'check': {
          const fs = 24 * k;
          ctx.el('circle', { cx: x + 16 * k, cy: y + 16 * k, r: 16 * k, fill: it.accent ? t.accent : t.paper2, stroke: t.ink, 'stroke-width': Math.max(2.6, 3 * k) }, ig);
          line(`M${x + 8 * k} ${y + 17 * k}l${6 * k} ${6 * k}l${11 * k} ${-13 * k}`, { stroke: it.accent ? t.paper2 : t.ink });
          if (can(fs)) ctx.text(ig, txt, x + 44 * k, y + 2 * k, { font: 'hand', size: fs, maxW: w - 44 * k, lines: 1 });
          else scrib(y + 16 * k, w * 0.5);
          y += 48 * k;
          break;
        }
        case 'image': {
          const ih = 130 * k;
          ctx.el('rect', { x, y, width: w, height: ih, rx: 10 * k, fill: K.tint, stroke: t.ink, 'stroke-width': Math.max(2.6, 3 * k) }, ig);
          line(`M${x + 12 * k} ${y + ih - 14 * k}L${x + w * 0.36} ${y + ih * 0.42}L${x + w * 0.56} ${y + ih * 0.68}L${x + w * 0.72} ${y + ih * 0.5}L${x + w - 12 * k} ${y + ih - 14 * k}`);
          ctx.el('circle', { cx: x + w * 0.78, cy: y + ih * 0.28, r: 12 * k, fill: 'none', stroke: t.ink, 'stroke-width': Math.max(2.6, 3 * k) }, ig);
          y += ih + 14 * k;
          break;
        }
        case 'divider':
          line(`M${x} ${y + 10 * k}H${x + w}`, { stroke: t.muted, 'stroke-dasharray': `${7 * k} ${9 * k}` });
          y += 26 * k;
          break;
        default:
          ctx.issue('warn', `unknown screen ui type "${it.type}"`);
      }
      els.push(ig);
    }
    if (cut && !o.tiny) ctx.issue('warn', 'screen ui list is longer than the screen; the rest is cut');
    return { g, els, bottom: y, cut };
  }

  /* ---------------------------------------------------------- phone etc. */

  // a phone seen from the front; when it runs past `limit` it is cut straight there (the panel crops it)
  function phoneBody(K, g, cx, top, w, h, acc, limit) {
    const { ctx, t } = K;
    const x = cx - w / 2, r = w * 0.15, cutB = limit != null && top + h > limit, yb = cutB ? limit : top + h;
    const b = ctx.el('g', { fill: 'none', stroke: t.ink, 'stroke-width': 5, 'stroke-linejoin': 'round' }, g);
    const outline = (x0, y0, x1, y1, rr) => cutB
      ? `M${r1(x0)} ${r1(y1)}V${r1(y0 + rr)}Q${r1(x0)} ${r1(y0)} ${r1(x0 + rr)} ${r1(y0)}H${r1(x1 - rr)}Q${r1(x1)} ${r1(y0)} ${r1(x1)} ${r1(y0 + rr)}V${r1(y1)}`
      : `M${r1(x0 + rr)} ${r1(y0)}H${r1(x1 - rr)}Q${r1(x1)} ${r1(y0)} ${r1(x1)} ${r1(y0 + rr)}V${r1(y1 - rr)}Q${r1(x1)} ${r1(y1)} ${r1(x1 - rr)} ${r1(y1)}H${r1(x0 + rr)}Q${r1(x0)} ${r1(y1)} ${r1(x0)} ${r1(y1 - rr)}V${r1(y0 + rr)}Q${r1(x0)} ${r1(y0)} ${r1(x0 + rr)} ${r1(y0)}Z`;
    ctx.el('path', { d: outline(x, top, x + w, yb, r), fill: t.paper2 }, b);
    if (acc) ctx.el('path', { d: outline(x - 8, top - 8, x + w + 8, yb, r + 8), stroke: t.accent, 'stroke-width': 4 }, b);
    ctx.el('rect', { x: r1(cx - w * 0.1), y: r1(top + w * 0.06), width: r1(w * 0.2), height: r1(Math.max(9, w * 0.045)), rx: r1(w * 0.025), fill: t.ink, stroke: 'none' }, b);
    ctx.rough(b, 1);
    return { x: x + w * 0.05, y: top + w * 0.16, w: w * 0.9, h: Math.min(h - w * 0.2, yb - top - w * 0.16), body: b };
  }

  // the owner's hand: fingertips curl round the right edge, the palm and a short thumb hold the left,
  // the sleeve (the owner's top: the hero's accent) comes up from below the frame
  function holdingHand(K, g, ph, sleeve, bottom) {
    const { ctx, t } = K;
    const sc = ph.w / 400, x0 = ph.x, x1 = ph.x + ph.w;
    const fy = Math.min(bottom - 250 * sc, ph.y + ph.h * 0.5);
    const hg = ctx.el('g', { fill: 'none', stroke: t.ink, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    for (let k = 0; k < 3; k++) ctx.el('ellipse', { cx: r1(x1 + 6 * sc), cy: r1(fy + k * 62 * sc), rx: r1(22 * sc), ry: r1(29 * sc), fill: t.paper2 }, hg);
    g.insertBefore(hg, g.firstChild);
    const fg = ctx.el('g', { fill: 'none', stroke: t.ink, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    const by = bottom + 16;
    const arm = `M${r1(x0 - 40 * sc)} ${r1(by)}C${r1(x0 - 30 * sc)} ${r1(Math.min(by, fy + 330 * sc))} ${r1(x0 - 20 * sc)} ${r1(Math.min(by, fy + 270 * sc))} ${r1(x0 + 8 * sc)} ${r1(fy + 222 * sc)}`;
    ctx.el('path', { d: arm, stroke: t.ink, 'stroke-width': r1(112 * sc + 9) }, fg);
    ctx.el('path', { d: arm, stroke: sleeve, 'stroke-width': r1(112 * sc) }, fg);
    // palm on the left edge + thumb resting on the screen edge
    ctx.el('path', { d: `M${r1(x0 - 34 * sc)} ${r1(fy + 216 * sc)}C${r1(x0 - 44 * sc)} ${r1(fy + 150 * sc)} ${r1(x0 - 12 * sc)} ${r1(fy + 112 * sc)} ${r1(x0 + 22 * sc)} ${r1(fy + 118 * sc)}C${r1(x0 + 50 * sc)} ${r1(fy + 124 * sc)} ${r1(x0 + 56 * sc)} ${r1(fy + 196 * sc)} ${r1(x0 + 34 * sc)} ${r1(fy + 236 * sc)}Z`, fill: t.paper2, 'stroke-width': 4 }, fg);
    const thumb = `M${r1(x0 + 14 * sc)} ${r1(fy + 140 * sc)}C${r1(x0 + 30 * sc)} ${r1(fy + 112 * sc)} ${r1(x0 + 46 * sc)} ${r1(fy + 96 * sc)} ${r1(x0 + 62 * sc)} ${r1(fy + 84 * sc)}`;
    ctx.el('path', { d: thumb, stroke: t.ink, 'stroke-width': r1(40 * sc + 8) }, fg);
    ctx.el('path', { d: thumb, stroke: t.paper2, 'stroke-width': r1(40 * sc) }, fg);
    ctx.el('path', { d: `M${r1(x0 + 50 * sc)} ${r1(fy + 88 * sc)}q${r1(6 * sc)} ${r1(-6 * sc)} ${r1(14 * sc)} ${r1(-4 * sc)}`, stroke: t.ink, 'stroke-width': 3 }, fg);
    ctx.rough(hg, 1); ctx.rough(fg, 1);
    return fg;
  }

  function ownerOf(K, frame, msgs) {
    const ins = frame.insert || {};
    if (ins.who && K.cast.has(ins.who)) return K.cast.get(ins.who);
    if (typeof frame.highlight === 'string' && K.cast.has(frame.highlight)) return K.cast.get(frame.highlight);
    if (K.hero && (!msgs || !msgs.length || msgs.some(m => m && m.from === K.hero.id))) return K.hero;
    if (msgs && msgs.length) {
      const cnt = {};
      msgs.forEach(m => { if (m && m.from) cnt[m.from] = (cnt[m.from] || 0) + 1; });
      const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
      if (top) return K.who(top);
    }
    return K.hero;
  }
  const sleeveOf = (K, info, frame) => {
    if (!info) return K.tint;
    const acc = (typeof frame.highlight === 'string' ? frame.highlight === info.id : info.hero);
    return acc ? K.t.accent : K.fill(info.tone, 1);
  };

  // a chat thread: owner's messages on the right, others on the left with their face; a day label when
  // `time` is a day ("Pzt"), a small clock when it is "18:40", "seen" in the accent. Laid out for real
  // (measured), shrunk to fit, oldest messages dropped last.
  function chatUI(K, parent, msgs, box, owner, k0) {
    const { ctx, t } = K;
    const isClock = s0 => /^\s*\d{1,2}[:.]\d{2}\s*$/.test(s0);
    let list = msgs.filter(m => m && typeof m === 'object');
    let fs = Math.max(K.min, 28 * k0), dropped = 0, res = null, got = [];
    const floorFs = Math.max(K.min + (K.tall ? 2 : 5), 28 * k0 * 0.55);
    for (let attempt = 0; attempt < 40; attempt++) {
      const g = ctx.el('g', { class: 'mo-chat' }, parent);
      [res, got] = quietly(ctx, () => thread(g, list, fs));
      if (res.h <= box.h || list.length <= 1) break;
      g.remove();
      if (fs * 0.93 >= floorFs) fs *= 0.93;
      else { list = list.slice(1); dropped++; }
    }
    got.forEach(([l, m]) => ctx.issue(l, m));
    if (dropped) ctx.issue('warn', `chat thread is taller than the screen; the ${dropped} oldest message(s) are left out`);
    return res.els;

    function thread(root, items, fs) {
      const els = [];
      let y = box.y, lastDay = null;
      const av = fs * 2, maxW = box.w * 0.76;
      for (const m of items) {
        const time = str(m.time);
        if (time && !isClock(time) && time !== lastDay) {
          const g = ctx.el('g', { class: 'mo-day' }, root);
          const lab = ctx.text(g, time, box.x + box.w / 2, y + fs * 0.2, { font: 'mono', size: Math.max(K.min, fs * 0.62), color: 'muted', anchor: 'middle', ls: 0.16, upper: true, lines: 1 });
          const cy = lab.top + lab.h / 2, hw = lab.w / 2 + 14;
          ctx.el('path', { d: `M${r1(box.x + box.w / 2 - hw - 44)} ${r1(cy)}h36M${r1(box.x + box.w / 2 + hw + 8)} ${r1(cy)}h36`, stroke: t.line, 'stroke-width': 2.4, fill: 'none' }, g);
          els.push({ g, type: 'day' });
          y = lab.top + lab.h + fs * 0.55;
          lastDay = time;
        }
        const own = !!owner && m.from === owner.id;
        const g = ctx.el('g', { class: 'mo-msg' }, root);
        const tg = ctx.el('g', {}, g);
        const T = ctx.text(tg, clean(ctx, m.text), 0, 0, { font: 'hand', size: fs, weight: 500, maxW: maxW - (own ? 0 : av) - fs * 1.3, lines: 6, lh: 1.16, color: 'ink' });
        const bw = T.w + fs * 1.3, bh = T.h + fs * 0.86;
        const bx = own ? box.x + box.w - bw : box.x + av;
        const sh = ctx.el('path', { d: bubblePath(bx, y, bw, bh, Math.min(bh / 2, fs * 0.8), null), fill: own ? K.tint : t.paper2, stroke: t.ink, 'stroke-width': 3.2 }, g);
        ctx.rough(sh, 1);
        g.appendChild(tg);
        tg.setAttribute('transform', `translate(${r1(bx + fs * 0.65)} ${r1(y + fs * 0.43)})`);
        if (!own) head(K, g, K.who(m.from), box.x + av * 0.42, y + bh - fs * 0.7, 0.3 * fs / 28, 'neutral', 1);
        y += bh;
        let meta = null;
        const metaTxt = [isClock(time) ? time : '', m.seen ? K.w.seen : ''].filter(Boolean).join(' · ');
        if (metaTxt) {
          meta = ctx.el('g', {}, g);
          const msz = Math.max(K.min, fs * 0.6), tick = m.seen && own ? fs * 1.15 : 0;
          const mt = ctx.text(meta, metaTxt, own ? box.x + box.w - tick : bx + 6, y + fs * 0.22, { font: 'mono', size: msz, color: m.seen ? 'accent' : 'muted', anchor: own ? 'end' : 'start', lines: 1, ls: 0.04 });
          if (tick) {
            const cx = box.x + box.w - fs * 0.45, cy = mt.top + mt.h / 2;
            ctx.el('path', { d: `M${r1(cx - 15)} ${r1(cy)}l5 6l10 -12M${r1(cx - 5)} ${r1(cy)}l5 6l10 -12`, stroke: t.accent, 'stroke-width': 2.8, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, meta);
          }
          y = mt.top + mt.h;
        }
        els.push({ g, meta, type: 'msg' });
        y += fs * 0.5;
      }
      return { els, h: y - box.y };
    }
  }

  function receiptBig(K, g, cx, top, w, ins, acc) {
    const { ctx, t } = K;
    const items = (Array.isArray(ins.items) ? ins.items : []).map(it => {
      if (it && typeof it === 'object') return { label: str(it.label || it.text), value: str(it.value), accent: !!it.accent };
      const s0 = str(it), m = s0.split(/\s+[·|–-]\s+|\t/);
      return { label: m[0], value: m.length > 1 ? m[m.length - 1] : '', accent: false };
    });
    const fs = Math.max(K.min + 4, w * 0.072), lh = fs * 1.75;
    const rowsN = items.length || 5;
    const h = fs * 4.2 + rowsN * lh + (ins.total ? fs * 3 : fs * 1.2);
    const x = cx - w / 2;
    const rg = ctx.el('g', { class: 'mo-receipt' }, g);
    let z = `M${r1(x)} ${r1(top)}H${r1(x + w)}V${r1(top + h)}`;
    const nz = Math.round(w / 26), st = w / nz;
    for (let k = 0; k < nz; k++) z += `L${r1(x + w - st * (k + 0.5))} ${r1(top + h + 14)}L${r1(x + w - st * (k + 1))} ${r1(top + h)}`;
    ctx.rough(ctx.el('path', { d: z + 'Z', fill: t.paper2, stroke: t.ink, 'stroke-width': 4, 'stroke-linejoin': 'round' }, rg), 1);
    ctx.text(rg, str(ins.title) || K.w.receipt, cx, top + fs * 0.9, { font: 'mono', size: fs * 1.05, weight: 500, anchor: 'middle', upper: true, ls: 0.14, lines: 1, maxW: w - fs * 2 });
    if (ins.label) ctx.text(rg, str(ins.label), cx, top + fs * 2.2, { font: 'mono', size: Math.max(K.min, fs * 0.66), color: 'muted', anchor: 'middle', lines: 1, maxW: w - fs * 2 });
    let y = top + fs * 3.6;
    ctx.el('path', { d: `M${r1(x + fs)} ${r1(y)}H${r1(x + w - fs)}`, stroke: t.muted, 'stroke-width': 2.6, 'stroke-dasharray': '7 9', fill: 'none' }, rg);
    const rows = [];
    y += fs * 0.8;
    if (items.length) items.forEach(it => {
      const rgp = ctx.el('g', {}, rg);
      const col = it.accent ? 'accent' : 'ink';
      ctx.text(rgp, it.label, x + fs, y, { font: 'mono', size: fs, color: col, lines: 1, maxW: w * 0.6 });
      if (it.value) ctx.text(rgp, it.value, x + w - fs, y, { font: 'mono', size: fs, color: col, anchor: 'end', lines: 1, maxW: w * 0.36 });
      rows.push(rgp); y += lh;
    });
    else for (let k = 0; k < 5; k++) { const p = ctx.el('path', { d: scribble(x + fs, y + fs * 0.5, w * 0.46, 3.5) + `M${r1(x + w - fs - w * 0.16)} ${r1(y + fs * 0.5)}h${r1(w * 0.16)}`, stroke: t.muted, 'stroke-width': 3.5, fill: 'none', 'stroke-linecap': 'round' }, rg); rows.push(p); y += lh; }
    let total = null;
    if (ins.total) {
      ctx.el('path', { d: `M${r1(x + fs)} ${r1(y + fs * 0.2)}H${r1(x + w - fs)}`, stroke: t.muted, 'stroke-width': 2.6, 'stroke-dasharray': '7 9', fill: 'none' }, rg);
      total = ctx.el('g', {}, rg);
      ctx.text(total, K.w.total, x + fs, y + fs * 1.1, { font: 'mono', size: fs, weight: 500, upper: true, ls: 0.1, lines: 1 });
      ctx.text(total, str(ins.total), x + w - fs, y + fs * 0.85, { font: 'hand', size: fs * 1.5, weight: 700, anchor: 'end', lines: 1, color: acc ? 'accent' : 'ink', maxW: w * 0.55 });
    }
    return { g: rg, rows, total, h: h + 14 };
  }

  /* --------------------------------------------------------------- shots */

  function shotWide(K, P, frame) {
    const inner = { x: P.x, y: P.y, w: P.w, h: P.h };
    const sc = scene(K, P.g, inner, { set: frame.set, people: frame.people, props: frame.props, highlight: frame.highlight }, { mode: 'wide' });
    if (!(Array.isArray(frame.people) && frame.people.length) && !(Array.isArray(frame.props) && frame.props.length)) K.ctx.issue('warn', 'wide shot with no people and no props');
    const bubbles = placeBubbles(K, P.top, sc.speakers, sc.heads, { soft: sc.soft });
    let at = bubbleBeats(K, bubbles, sc.end);
    sc.accentProps.forEach((x, k) => K.ctx.beat(x.e, 'pop', { at: at + 100 + k * 200 }));
  }

  function shotClose(K, P, frame) {
    const { ctx } = K;
    const ins = frame.insert && typeof frame.insert === 'object' ? frame.insert : null;
    const box = { x: P.x, y: P.y, w: P.w, h: P.h };
    let sc, end;
    if (ins) {
      // the face beside the thing it is looking at
      const tall = K.tall;
      // wide: face on the left, the thing on the right. tall: face above, the phone held low in front of the chest
      const pBox = tall ? { x: box.x, y: box.y, w: box.w, h: box.h * 0.5 } : { x: box.x, y: box.y, w: box.w * 0.46, h: box.h };
      const oBox = tall ? { x: box.x + box.w * 0.06, y: box.y + box.h * 0.4, w: box.w * 0.88, h: box.h * 0.6 } : { x: box.x + box.w * 0.46, y: box.y + 30, w: box.w * 0.5, h: box.h - 30 };
      let ppl = (Array.isArray(frame.people) ? frame.people : []).slice(0, 1);
      // tall: the big phone below *is* the one in their hands, so the hands drop out of shot
      if (tall && (ins.kind === 'phone' || ins.kind === 'chat' || !ins.kind)) ppl = ppl.map(p => (p && p.pose === 'phone' ? Object.assign({}, p, { pose: 'stand' }) : p));
      if ((frame.people || []).length > 1) ctx.issue('warn', 'close shot with an insert shows only the first person');
      sc = scene(K, P.g, pBox, { set: frame.set, people: ppl, props: [], highlight: frame.highlight }, { mode: 'close', side: tall ? 0.5 : 0.5 });
      const r = insertObject(K, P.g, oBox, frame, ins, { inClose: true, at: sc.end });
      end = r.end;
      const bubbles = placeBubbles(K, P.top, sc.speakers, sc.heads, { soft: [r.rect] });
      bubbleBeats(K, bubbles, end + 200);
      return;
    }
    if (!(Array.isArray(frame.people) && frame.people.length)) ctx.issue('warn', 'close shot without people');
    sc = scene(K, P.g, box, { set: frame.set, people: frame.people, props: frame.props, highlight: frame.highlight }, { mode: 'close' });
    const bubbles = placeBubbles(K, P.top, sc.speakers, sc.heads, { soft: sc.soft });
    const at = bubbleBeats(K, bubbles, sc.end);
    sc.accentProps.forEach((x, k) => ctx.beat(x.e, 'pop', { at: at + 100 + k * 200 }));
  }

  function shotInsert(K, P, frame) {
    const { ctx } = K;
    const ins = frame.insert && typeof frame.insert === 'object' ? frame.insert : {};
    const box = { x: P.x, y: P.y, w: P.w, h: P.h };
    // off-screen voices: people listed with "say" talk from outside the frame
    const voices = (Array.isArray(frame.people) ? frame.people : []).filter(p => p && (p.say || p.think));
    const tall = K.tall;
    let oBox;
    if (tall) oBox = voices.length ? { x: box.x + 40, y: box.y + box.h * 0.26, w: box.w - 80, h: box.h * 0.74 } : { x: box.x + 40, y: box.y + 40, w: box.w - 80, h: box.h - 40 };
    else oBox = { x: box.x + box.w * 0.3, y: box.y + 34, w: box.w * 0.4, h: box.h - 34 };
    const r = insertObject(K, P.g, oBox, frame, ins, { at: 120 });
    if (voices.length) {
      const sp = [], heads = [];
      voices.forEach((v, k) => {
        const info = K.who(v.who);
        const left = tall ? k % 2 === 0 : k % 2 === 0;
        const hs = tall ? 1.05 : 0.95;
        const hx = left ? box.x + 30 * hs : box.x + box.w - 30 * hs;
        const hy = tall ? box.y + 130 + k * 0 : box.y + box.h * (0.3 + 0.22 * Math.floor(k / 2));
        const hg = head(K, P.g, info, hx, tall ? hy + (k % 2) * 40 : hy, hs, MOODS.includes(v.mood) ? v.mood : 'neutral', left ? 1 : -1);
        ctx.beat(hg, 'fade', { at: r.end + k * 300, dx: left ? -20 : 20, dy: 0 });
        const vb = tall ? { x: box.x + 90, y: box.y + 10, w: box.w - 180, h: box.h * 0.27 } : left ? { x: box.x + 70, y: box.y + 20, w: oBox.x - box.x - 80, h: box.h - 40 } : { x: oBox.x + oBox.w + 10, y: box.y + 20, w: box.x + box.w - oBox.x - oBox.w - 80, h: box.h - 40 };
        sp.push({ x: hx, y: tall ? hy + (k % 2) * 40 : hy, r: 56 * hs, f: left ? 1 : -1, say: str(v.say), think: str(v.think), box: vb });
        heads.push({ x: hx, y: hy, r: 60 * hs, top: hy - 70 * hs });
      });
      const bubbles = placeBubbles(K, P.top, sp, heads, { soft: [r.rect] });
      bubbleBeats(K, bubbles, r.end + 300);
    }
  }

  // phone (ui) | chat | receipt | any prop, filling `oBox`
  function insertObject(K, parent, oBox, frame, ins, o) {
    const { ctx, t } = K;
    const kind = ins.kind || 'phone';
    const at0 = o.at || 0;
    const g = ctx.el('g', { class: 'mo-insert' }, parent);
    const cx = oBox.x + oBox.w / 2;
    const bottom = oBox.y + oBox.h;
    const acc = ins.accent === true;
    if (kind === 'phone' || kind === 'chat') {
      const msgs = Array.isArray(ins.messages) ? ins.messages : [];
      const owner = ownerOf(K, frame, kind === 'chat' ? msgs : null);
      const pw = Math.min(oBox.w * (K.tall ? 0.86 : 1), kind === 'chat' ? (K.tall ? 660 : 560) : (K.tall ? 600 : 470));
      const ph = pw * 2.05;
      const scr = phoneBody(K, g, cx, oBox.y, pw, ph, acc, bottom + (o.inClose ? 18 : K.tall ? 12 : 16));
      const visH = Math.min(scr.h, bottom - scr.y - 20);
      const k = pw / 380;
      let els = [];
      if (kind === 'chat') {
        // header: who this thread is with
        const others = [...new Set(msgs.map(m => m && m.from).filter(f => f && (!owner || f !== owner.id)))];
        const castOthers = others.length ? others : [...K.cast.keys()].filter(id => !owner || id !== owner.id).slice(0, 3);
        const hdr = ctx.el('g', {}, g);
        const hy = scr.y + 34 * k;
        castOthers.slice(0, 4).forEach((id, j) => head(K, hdr, K.who(id), scr.x + 40 * k + j * 40 * k, hy, 0.34 * k, 'neutral', 1));
        const title = str(ins.title) || castOthers.map(id => K.who(id).name).join(', ');
        const tx0 = scr.x + 40 * k + Math.min(4, castOthers.length) * 40 * k + 10 * k;
        ctx.text(hdr, title, tx0, hy, { font: 'hand', size: Math.max(K.min, 28 * k), weight: 600, valign: 'middle', lines: 1, maxW: scr.x + scr.w - tx0 - 16 * k, minSize: K.min });
        ctx.el('path', { d: `M${r1(scr.x)} ${r1(hy + 40 * k)}H${r1(scr.x + scr.w)}`, stroke: t.line, 'stroke-width': 2.4, fill: 'none' }, hdr);
        ctx.beat(hdr, 'fade', { at: at0 + 100, dy: 0 });
        els = chatUI(K, g, msgs, { x: scr.x + 22 * k, y: hy + 64 * k, w: scr.w - 44 * k, h: visH - (hy + 64 * k - scr.y) - 10 }, owner, k);
        let at = at0 + 500;
        els.forEach(e => {
          if (e.type === 'day') { ctx.beat(e.g, 'fade', { at, dy: 0, dur: 400 }); at += 260; return; }
          ctx.beat(e.g, 'fade', { at, dy: 22, dur: 480 });
          if (e.meta) ctx.beat(e.meta, 'fade', { at: at + 600, dy: 0, dur: 420 });
          at += e.meta ? 1000 : 680;
        });
        o.end = at;
      } else {
        const ui = Array.isArray(ins.screen) ? ins.screen : [];
        if (!ui.length) ctx.issue('warn', 'phone insert without a "screen" ui list; the screen is blank');
        // shrink the whole screen until every item fits (down to legibility), then report what was cut
        let r, got, kk = k;
        for (let a = 0; a < 8; a++) {
          [r, got] = quietly(ctx, () => screenUI(K, g, ui, { x: scr.x, y: scr.y, w: scr.w, h: visH }, kk));
          if (!r.cut || kk * 0.9 * 22 < K.min) break;
          r.g.remove(); kk *= 0.9;
        }
        got.forEach(([l, m]) => ctx.issue(l, m));
        r.els.forEach((e, j) => ctx.beat(e, 'fade', { at: at0 + 300 + j * 170, dy: 10 }));
        o.end = at0 + 300 + r.els.length * 170 + 300;
      }
      if (!o.inClose) holdingHand(K, g, { x: cx - pw / 2, y: oBox.y, w: pw, h: ph }, sleeveOf(K, owner, frame), bottom);
      ctx.beat(scr.body, 'fade', { at: at0, dy: 30, dur: 600 });
      if (!o.inClose) g.setAttribute('transform', `rotate(${K.tall ? -2 : -2.5} ${r1(cx)} ${r1(bottom)})`);   // held in a hand, not pasted flat
      return { end: o.end, rect: { x0: cx - pw / 2, x1: cx + pw / 2, y0: oBox.y, y1: bottom } };
    }
    if (kind === 'receipt') {
      // size the paper so it fills the frame height (fs = 7.2% of the width drives every row)
      const nRows = Array.isArray(ins.items) && ins.items.length ? ins.items.length : 5;
      const perW = 0.072 * (4.2 + nRows * 1.75 + (ins.total ? 3 : 1.2));
      const w = Math.min(oBox.w * 0.9, (oBox.h * 0.9 - 40) / perW, K.tall ? 720 : 640);
      const estH = w * perW + 14, top = oBox.y + Math.max(20, (oBox.h - estH) / 2 - 10);
      const rr = receiptBig(K, g, cx, top, w, ins, acc || frame.highlight != null);
      const fit = Math.min(1, (oBox.y + oBox.h - top - 10) / rr.h);
      if (fit < 1) { rr.g.setAttribute('transform', `translate(${r1(cx)} ${r1(top)}) scale(${r2(fit)}) translate(${r1(-cx)} ${r1(-top)})`); if (fit < 0.75) ctx.issue('warn', 'receipt has too many items; it is drawn small'); }
      else rr.g.setAttribute('transform', `rotate(-2 ${r1(cx)} ${r1(top + rr.h / 2)})`);
      ctx.beat(rr.g, 'fade', { at: at0, dy: 30, dur: 600 });
      rr.rows.forEach((e, j) => ctx.beat(e, 'fade', { at: at0 + 400 + j * 140, dy: 0, dur: 360 }));
      let end = at0 + 400 + rr.rows.length * 140;
      if (rr.total) { ctx.beat(rr.total, 'pop', { at: end + 200 }); end += 700; }
      return { end, rect: { x0: cx - w / 2, x1: cx + w / 2, y0: top, y1: top + rr.h * fit } };
    }
    if (!PROPS.includes(kind)) ctx.issue('warn', `unknown insert kind "${kind}" (phone | chat | receipt | a prop kind)`);
    const pk = PROPS.includes(kind) ? kind : 'box';
    const ph0 = PROP_H[pk] || 120, pw0 = { food: 216, car: 270, store: 240, whiteboard: 300, chart: 210, money: 190, laptop: 176, letter: 130 }[pk] || 140;
    const s = Math.min((oBox.h * 0.72) / ph0, (oBox.w * 0.8) / pw0, 4.2);
    const y = oBox.y + oBox.h * 0.5 + ph0 * s * 0.5;
    const e = prop(K, g, Object.assign({}, ins, { kind: pk, label: pk === 'whiteboard' ? ins.label : null, time: ins.time || ins.label }), cx, y, s, ins.accent !== false);
    ctx.beat(e, 'pop', { at: at0 + 100, dur: 600 });
    if (ins.label && pk !== 'whiteboard') {
      const lab = ctx.text(g, str(ins.label), cx, y + 26, { font: 'hand', size: K.tall ? 40 : 34, weight: 600, anchor: 'middle', maxW: oBox.w, lines: 2 });
      ctx.beat(lab.el, 'fade', { at: at0 + 600, dy: 8 });
    }
    return { end: at0 + 900, rect: { x0: cx - pw0 * s / 2, x1: cx + pw0 * s / 2, y0: y - ph0 * s, y1: y } };
  }

  function shotSplit(K, frame) {
    const { ctx, t, tall } = K, W = ctx.W, H = ctx.H;
    let panels = frame.split.filter(p => p && typeof p === 'object');
    if (panels.length > 4) { ctx.issue('warn', `split shows at most 4 panels (got ${panels.length})`); panels = panels.slice(0, 4); }
    if (panels.length < 2) ctx.issue('warn', 'split reads best with 2–4 panels');
    const n = panels.length;
    const area = tall ? { x: 26, y: 62, w: W - 52, h: H - 62 - 26 } : { x: 34, y: 50, w: W - 68, h: H - 50 - 30 };
    ctx.text(ctx.stage, K.w.shot.split, area.x + area.w, area.y - (tall ? 16 : 13), { font: 'mono', size: tall ? 26 : 17, ls: 0.16, upper: true, color: 'muted', anchor: 'end', valign: 'bottom', lines: 1 });
    const gap = tall ? 22 : 24;
    let cols, rows;
    if (tall) { cols = n === 4 ? 2 : 1; rows = n === 4 ? 2 : n; } else { cols = n; rows = 1; }
    const bw = (area.w - gap * (cols - 1)) / cols, bh = (area.h - gap * (rows - 1)) / rows;
    ctx.stampAt = { x: area.x + area.w - (tall ? 150 : 170), y: area.y + (tall ? 70 : 62), rotate: -5 };
    const fs = tall ? 28 : 24;
    const top = ctx.el('g', { class: 'mo-bubbles' }, ctx.stage);
    panels.forEach((pn, k) => {
      const c = k % cols, r = Math.floor(k / cols);
      const box = { x: area.x + c * (bw + gap), y: area.y + r * (bh + gap), w: bw, h: bh };
      const frameEl = ctx.rough(ctx.el('rect', { x: box.x, y: box.y, width: box.w, height: box.h, rx: 3, fill: t.paper2, stroke: t.ink, 'stroke-width': 3 }, ctx.stage), 1);
      const clip = subClip(K, box, ctx.stage);
      const base = 200 + k * 950;
      ctx.beat(frameEl, 'fade', { at: base - 150, dy: 0, dur: 420 });
      const hl = pn.highlight != null ? pn.highlight : frame.highlight;
      const labelH = pn.label ? (tall ? 64 : 52) : 0;
      const inner = { x: box.x, y: box.y + labelH * 0.6, w: box.w, h: box.h - labelH * 0.6 };
      const sc = scene(K, clip, inner, { set: pn.set || frame.set || 'blank', people: pn.people, props: pn.props, highlight: typeof hl === 'string' || typeof hl === 'number' ? hl : null }, { mode: 'mini', t0: base, pace: 0.7 });
      if (pn.label) {
        const lg = ctx.el('g', { class: 'mo-split-label' }, ctx.stage);
        const lab = ctx.text(lg, str(pn.label), box.x + 22, box.y + 18, { font: 'mono', size: tall ? 26 : 19, weight: 500, upper: true, ls: 0.14, lines: 1, maxW: box.w - 44, color: 'ink' });
        ctx.el('path', { d: `M${r1(box.x + 22)} ${r1(lab.top + lab.h + 8)}h${r1(Math.min(lab.w, 60))}`, stroke: t.accent, 'stroke-width': 3, 'stroke-linecap': 'round', fill: 'none' }, lg);
        ctx.beat(lg, 'fade', { at: base, dy: 6, dur: 420 });
      }
      const bubbles = placeBubbles(K, top, sc.speakers.map(s0 => Object.assign(s0, { box })), sc.heads, { fs, soft: sc.soft });
      const at = bubbleBeats(K, bubbles, sc.end);
      sc.accentProps.forEach((x, j) => ctx.beat(x.e, 'pop', { at: at + 100 + j * 200 }));
    });
    ctx.stage.appendChild(top);   // bubbles above every panel
  }
})();
