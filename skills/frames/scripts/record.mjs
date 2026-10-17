#!/usr/bin/env node
// Record a built chalk-talk frames story as an animated GIF (README, PR comment, chat, social video).
//
//   node record.mjs talk.html [--out talk.gif] [--aspect wide|tall] [--width 1200] [--fps 12]
//                             [--theme paper|night] [--steps 1-4] [--hold 1500]
//
// Drives system Chrome/Edge/Brave headless over the DevTools protocol (needs Node >= 22 for the
// global WebSocket), freezes every frame with window.chalk.seek(frame, ms) and writes a looping GIF
// with one shared 255-color palette. --steps picks frames (1-based); --hold is how long (ms) the end
// of every frame stays on screen. --aspect tall records the phone layout (540x960 viewport, a 9:16
// vertical GIF; default width 540). Wide uses a 1600x900 viewport (default width 1200).
// CHROME=/path/to/chrome picks the browser.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { openBrowser, ASPECTS, themeParam } from './check.mjs';

const die = msg => { console.error('record: ' + msg); process.exit(1); };

/* ---------- options ---------- */
const USAGE = 'usage: node record.mjs talk.html [--out talk.gif] [--aspect wide|tall] [--width 1200] [--fps 12] [--theme paper|night] [--steps 1-4] [--hold 1500]';
const args = process.argv.slice(2);
const opt = { aspect: 'wide', width: null, fps: 12, hold: 1500, theme: null, steps: null, out: null };
let src = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  const m = a.match(/^--(out|aspect|width|fps|theme|steps|hold)(?:=(.*))?$/);
  if (m) { opt[m[1]] = m[2] ?? args[++i]; continue; }
  if (a === '-h' || a === '--help' || a.startsWith('-')) die(USAGE);
  src = a;
}
if (!src) die(USAGE);
if (!fs.existsSync(src)) die('no such file: ' + src);
if (typeof WebSocket === 'undefined') die(`needs Node.js >= 22 (for its built-in WebSocket); this is ${process.version}. build and check work on Node 18+.`);
if (!ASPECTS[opt.aspect]) die('--aspect must be wide or tall');
const { w: BOARD_W, h: BOARD_H } = ASPECTS[opt.aspect];     // the viewports check.mjs snapshots use
const width = Math.round(+(opt.width ?? (opt.aspect === 'tall' ? 540 : 1200))), fps = Math.min(50, +opt.fps), hold = Math.max(0, +opt.hold);
if (!(width >= 200 && width <= 3200)) die('--width must be 200..3200');
if (!(fps > 0)) die('--fps must be a positive number');
let theme;
try { theme = themeParam(opt.theme); } catch (e) { die('--' + e.message); }
const out = path.resolve(opt.out || src.replace(/\.html?$/i, '') + (opt.aspect === 'tall' ? '-tall' : '') + '.gif');

/* ---------- Chrome over CDP ---------- */

const launch = () => openBrowser(m => die(m));

/* ---------- PNG decode (Chrome screenshots: 8-bit RGB/RGBA, not interlaced) ---------- */
function decodePNG(buf) {
  let pos = 8, w = 0, h = 0, ct = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('latin1', pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9];
      if (data[8] !== 8 || (ct !== 2 && ct !== 6) || data[12]) throw new Error('unexpected PNG format from Chrome');
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3, stride = w * bpp, raw = zlib.inflateSync(Buffer.concat(idat));
  const px = new Uint8Array(w * h * 3);   // RGB out
  let prev = new Uint8Array(stride), line = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = row[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[x] = v;
    }
    for (let x = 0, o = y * w * 3; x < w; x++, o += 3) { px[o] = line[x * bpp]; px[o + 1] = line[x * bpp + 1]; px[o + 2] = line[x * bpp + 2]; }
    [prev, line] = [line, prev];
  }
  return { w, h, px };
}

/* ---------- palette: median cut over a 6-bit-per-channel histogram ---------- */
const BITS = 6, SH = 8 - BITS, SIDE = 1 << BITS;
const hist = { n: new Float64Array(SIDE ** 3), r: new Float64Array(SIDE ** 3), g: new Float64Array(SIDE ** 3), b: new Float64Array(SIDE ** 3) };
const binOf = (r, g, b) => ((r >> SH) << (2 * BITS)) | ((g >> SH) << BITS) | (b >> SH);
// first frame counts in full, later frames only where they changed, so moving packets and
// highlights get palette room next to the big flat background
function addToHistogram(px, prevPx) {
  for (let i = 0; i < px.length; i += 3) {
    if (prevPx && px[i] === prevPx[i] && px[i + 1] === prevPx[i + 1] && px[i + 2] === prevPx[i + 2]) continue;
    const k = binOf(px[i], px[i + 1], px[i + 2]);
    hist.n[k]++; hist.r[k] += px[i]; hist.g[k] += px[i + 1]; hist.b[k] += px[i + 2];
  }
}
function buildPalette(size) {
  const stats = bx => {   // shrink the box to its used bins, count pixels
    let n = 0, lo = [SIDE, SIDE, SIDE], hi = [-1, -1, -1];
    for (let r = bx.lo[0]; r <= bx.hi[0]; r++) for (let g = bx.lo[1]; g <= bx.hi[1]; g++) for (let b = bx.lo[2]; b <= bx.hi[2]; b++) {
      const c = hist.n[(r << (2 * BITS)) | (g << BITS) | b];
      if (!c) continue;
      n += c;
      if (r < lo[0]) lo[0] = r; if (r > hi[0]) hi[0] = r; if (g < lo[1]) lo[1] = g; if (g > hi[1]) hi[1] = g; if (b < lo[2]) lo[2] = b; if (b > hi[2]) hi[2] = b;
    }
    bx.n = n; if (n) { bx.lo = lo; bx.hi = hi; }
    bx.vol = (bx.hi[0] - bx.lo[0] + 1) * (bx.hi[1] - bx.lo[1] + 1) * (bx.hi[2] - bx.lo[2] + 1);
    return bx;
  };
  const boxes = [stats({ lo: [0, 0, 0], hi: [SIDE - 1, SIDE - 1, SIDE - 1] })];
  while (boxes.length < size) {
    // first by population, then by population x volume (keeps rare but distinct colors)
    const byVol = boxes.length >= size * 0.6;
    let best = null;
    for (const bx of boxes) if (bx.vol > 1 && (!best || (byVol ? bx.n * bx.vol : bx.n) > (byVol ? best.n * best.vol : best.n))) best = bx;
    if (!best) break;
    const span = [0, 1, 2].map(d => (best.hi[d] - best.lo[d]) * [1.0, 1.2, 0.8][d]);
    const d = span.indexOf(Math.max(...span));
    // split at the population median along d
    const counts = new Float64Array(SIDE);
    for (let r = best.lo[0]; r <= best.hi[0]; r++) for (let g = best.lo[1]; g <= best.hi[1]; g++) for (let b = best.lo[2]; b <= best.hi[2]; b++)
      counts[[r, g, b][d]] += hist.n[(r << (2 * BITS)) | (g << BITS) | b];
    let acc = 0, cut = best.lo[d];
    for (let v = best.lo[d]; v < best.hi[d]; v++) { acc += counts[v]; cut = v; if (acc >= best.n / 2) break; }
    const a = { lo: [...best.lo], hi: [...best.hi] }, b = { lo: [...best.lo], hi: [...best.hi] };
    a.hi[d] = cut; b.lo[d] = cut + 1;
    boxes.splice(boxes.indexOf(best), 1, stats(a), stats(b));
  }
  return boxes.filter(bx => bx.n).map(bx => {
    let n = 0, r = 0, g = 0, b = 0;
    for (let x = bx.lo[0]; x <= bx.hi[0]; x++) for (let y = bx.lo[1]; y <= bx.hi[1]; y++) for (let z = bx.lo[2]; z <= bx.hi[2]; z++) {
      const k = (x << (2 * BITS)) | (y << BITS) | z; n += hist.n[k]; r += hist.r[k]; g += hist.g[k]; b += hist.b[k];
    }
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  });
}
function mapper(palette) {
  const cache = new Int16Array(1 << 24).fill(-1);
  return px => {
    const idx = new Uint8Array(px.length / 3);
    for (let i = 0, j = 0; j < idx.length; i += 3, j++) {
      const key = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
      let c = cache[key];
      if (c < 0) {
        let bestD = Infinity;
        for (let p = 0; p < palette.length; p++) {
          const dr = px[i] - palette[p][0], dg = px[i + 1] - palette[p][1], db = px[i + 2] - palette[p][2];
          const dd = 3 * dr * dr + 4 * dg * dg + 2 * db * db;
          if (dd < bestD) { bestD = dd; c = p; }
        }
        cache[key] = c;
      }
      idx[j] = c;
    }
    return idx;
  };
}

/* ---------- GIF writer (GIF89a, LZW, looping) ---------- */
function lzw(pixels) {
  const out = [], CLEAR = 256, EOI = 257;
  let size = 9, next = 258, acc = 0, nbits = 0;
  const dict = new Map();
  const emit = code => { acc |= code << nbits; nbits += size; while (nbits >= 8) { out.push(acc & 255); acc >>>= 8; nbits -= 8; } };
  emit(CLEAR);
  let cur = pixels[0];
  for (let i = 1; i < pixels.length; i++) {
    const k = pixels[i], key = (cur << 8) | k, hit = dict.get(key);
    if (hit !== undefined) { cur = hit; continue; }
    emit(cur);
    if (next === 4096) { emit(CLEAR); dict.clear(); next = 258; size = 9; }
    else { if (next >= 1 << size) size++; dict.set(key, next++); }
    cur = k;
  }
  emit(cur); emit(EOI);
  if (nbits > 0) out.push(acc & 255);
  const blocks = [8];                      // min code size, then <=255-byte sub-blocks
  for (let i = 0; i < out.length; i += 255) { const part = out.slice(i, i + 255); blocks.push(part.length, ...part); }
  blocks.push(0);
  return Buffer.from(blocks);
}
const TRANSPARENT = 255;
function gifFrame({ x, y, w, h, data, delay, transparent }) {
  const gce = Buffer.from([0x21, 0xf9, 4, (1 << 2) | (transparent ? 1 : 0), delay & 255, delay >> 8, TRANSPARENT, 0]);
  const desc = Buffer.alloc(10);
  desc[0] = 0x2c; desc.writeUInt16LE(x, 1); desc.writeUInt16LE(y, 3); desc.writeUInt16LE(w, 5); desc.writeUInt16LE(h, 7);
  return Buffer.concat([gce, desc, lzw(data)]);
}

/* ---------- capture ---------- */
const frames = [];          // { png, ms }, identical neighbours merged
function addFrame(png, ms, exact = false) {    // exact: the still end of a step, drawn without lossy shortcuts
  const last = frames[frames.length - 1];
  if (last && last.png.equals(png)) { last.ms += ms; last.exact ||= exact; } else frames.push({ png, ms, exact });
}

const { page, once, close } = await launch();
try {
  await page('Page.enable');
  await page('Emulation.setDeviceMetricsOverride', { width: BOARD_W, height: BOARD_H, deviceScaleFactor: width / BOARD_W, mobile: false });
  // same picture on every machine: the story's own theme unless asked, motion on
  await page('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme === 'night' ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });
  const q = new URLSearchParams({ aspect: opt.aspect });
  if (theme) q.set('theme', theme);
  const url = pathToFileURL(path.resolve(src)).href + '?' + q;
  const loaded = once('Page.loadEventFired');
  await page('Page.navigate', { url });
  await loaded;
  const ev = async expression => {
    const r = await page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
    return r.result.value;
  };
  const info = await ev(`(async () => {
    // chalk.ready, or the data-chalk="ready" flag that every engine version sets (max 30 s)
    let ready = false;
    for (let i = 0; i < 600 && !ready; i++) {
      if (window.chalk && window.chalk.ready && !window.chalk.ready.hooked) { window.chalk.ready.hooked = true; window.chalk.ready.then(() => { ready = true; }); }
      if (document.documentElement.dataset.chalk === 'ready') ready = true;
      else await new Promise(r => setTimeout(r, 50));
    }
    if (!window.chalk) throw new Error('no window.chalk on this page (not a chalk-talk frames page, or a JS error)');
    if (!ready) throw new Error('the story did not get ready within 30 s');
    const c = window.chalk;
    return { steps: typeof c.steps === 'function' ? c.steps() : c.steps, seek: typeof c.seek === 'function' && typeof c.duration === 'function' };
  })()`);
  const total = info.steps;
  if (!total) die('the story has no frames');
  const sm = String(opt.steps || `1-${total}`).match(/^(\d+)(?:-(\d+))?$/);
  if (!sm) die('--steps must look like 3 or 1-4');
  const first = Math.max(1, +sm[1]), last = Math.min(total, sm[2] ? +sm[2] : +sm[1]);
  if (first > last) die(`--steps out of range (the story has ${total} frames)`);
  const shot = async () => Buffer.from((await page('Page.captureScreenshot', { format: 'png' })).data, 'base64');
  const frameMs = 1000 / fps;

  if (info.seek) {
    for (let k = first; k <= last; k++) {
      const dur = Math.max(0, +(await ev(`window.chalk.duration(${k})`)) || 0);
      const n = Math.max(1, Math.round(dur / frameMs)), step = dur / n;   // even spacing, no sliver frame at the end
      for (let i = 0; i <= n; i++) {
        const t = i * step, tNext = (i + 1) * step;
        await ev(`(async () => { await window.chalk.seek(${k}, ${t}); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); })()`);
        addFrame(await shot(), i === n ? hold : tNext - t, i === n);
      }
      process.stderr.write(`\rrecord: frame ${k}/${last}, ${frames.length} gif frames`);
    }
  } else {
    // ponytail: real-time fallback for engines without chalk.seek; frame timing follows the screenshot speed
    console.error('record: this page has no chalk.seek; recording in real time (rebuild with the current engine for exact frames)');
    for (let k = first; k <= last; k++) {
      if (k > 1) {
        await ev(`window.chalk.go(${k - 1})`);
        for (const type of ['keyDown', 'keyUp']) await page('Input.dispatchKeyEvent', { type, key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
      } else await ev('window.chalk.go(1)');
      const t0 = Date.now();
      let prev = null, same = 0, tPrev = t0;
      while (Date.now() - t0 < 4000 && same < 4) {
        const png = await shot(), now = Date.now();
        if (prev) addFrame(prev, now - tPrev);
        same = prev && prev.equals(png) ? same + 1 : 0;
        prev = png; tPrev = now;
      }
      addFrame(prev, hold, true);
      process.stderr.write(`\rrecord: frame ${k}/${last}, ${frames.length} gif frames`);
    }
  }
  process.stderr.write('\n');
} catch (e) {
  await close();
  die(e.message);
} finally {
  await close();
}

/* ---------- encode ---------- */
let prevPx = null, w = 0, h = 0;
for (const f of frames) { const d = decodePNG(f.png); w = d.w; h = d.h; addToHistogram(d.px, prevPx); prevPx = d.px; }
const palette = buildPalette(255);
const toIdx = mapper(palette);
const gct = Buffer.alloc(256 * 3);
palette.forEach((c, i) => gct.set(c, i * 3));
const parts = [Buffer.from('GIF89a', 'latin1')];
const lsd = Buffer.alloc(7);
lsd.writeUInt16LE(w, 0); lsd.writeUInt16LE(h, 2); lsd[4] = 0xf7;     // global table, 8-bit, 256 entries
parts.push(lsd, gct, Buffer.from([0x21, 0xff, 11, ...Buffer.from('NETSCAPE2.0', 'latin1'), 3, 1, 0, 0, 0]));   // loop forever

// palette pairs too close to see a difference between frames (weighted squared RGB distance)
const LOSSY = 300, near = new Uint8Array(256 * 256);
palette.forEach((a, i) => palette.forEach((b, j) => {
  near[i * 256 + j] = 3 * (a[0] - b[0]) ** 2 + 4 * (a[1] - b[1]) ** 2 + 2 * (a[2] - b[2]) ** 2 <= LOSSY ? 1 : 0;
}));
let canvas = null, pending = null, clock = 0, totalMs = 0, count = 0;
const flush = () => {
  if (!pending) return;
  // centiseconds on a running clock so rounding never drifts; browsers treat < 2 cs as 10 cs
  const delay = Math.max(2, Math.round((clock + pending.ms) / 10) - Math.round(clock / 10));
  clock += pending.ms;
  parts.push(gifFrame({ ...pending, delay }));
  count++; pending = null;
};
for (const [n, f] of frames.entries()) {
  const lossy = !f.exact && n % 6 !== 0;    // every 6th frame and every step end are exact, so skipped drift never lingers
  const idx = toIdx(decodePNG(f.png).px);
  totalMs += f.ms;
  if (!canvas) { pending = { x: 0, y: 0, w, h, data: idx, ms: f.ms, transparent: false }; canvas = idx; continue; }
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) if (idx[i] !== canvas[i]) {
    if (lossy && near[idx[i] * 256 + canvas[i]]) { idx[i] = canvas[i]; continue; }    // anti-aliasing shimmer: keep the old pixel
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) { pending.ms += f.ms; continue; }       // same after quantizing
  flush();
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, data = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    const i = (y0 + y) * w + x0 + x;
    data[y * bw + x] = idx[i] === canvas[i] ? TRANSPARENT : idx[i];
  }
  pending = { x: x0, y: y0, w: bw, h: bh, data, ms: f.ms, transparent: true };
  canvas = idx;
}
flush();
parts.push(Buffer.from([0x3b]));
const gif = Buffer.concat(parts);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, gif);
const mb = gif.length / 1048576;
console.log(`${out}  ${w}x${h}, ${count} frames, ${(totalMs / 1000).toFixed(1)} s, ${mb.toFixed(1)} MB`);
if (mb > 8) console.error('record: over 8 MB; try a smaller --width, --fps 10 or --steps to keep it README-friendly');
