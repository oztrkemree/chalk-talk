#!/usr/bin/env node
// Lint a built chalk-talk frames story and take a PNG of every frame, wide and tall, with headless Chrome.
//
//   node check.mjs talk.html [snap-dir]
//
// Prints the engine's layout report (window.chalk.report) and writes frame-01-wide.png,
// frame-01-tall.png, ... (each frame at its end state, ?snap). Wide is a 1600×900 viewport; tall is a
// 540×960 phone at 2x (1080×1920). One headless Chrome at below-normal priority does every shot
// (Node >= 22: DevTools protocol; older Node falls back to one short Chrome run per shot).
// Frames with "compare": true also get frame-NN-wide-before.png (the toggle's "before" state).
// Exit code: 0 = clean or warnings only, 1 = errors to fix, 2 = no Chrome found.
// CHROME=/path/to/chrome picks a browser, CHALK_THEME=night (or paper) overrides the story's theme.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const isFile = f => { try { return fs.statSync(f).isFile(); } catch { return false; } };

export const ASPECTS = {
  wide: { w: 1600, h: 900, dpr: 1 },
  tall: { w: 540, h: 960, dpr: 2 },
};

export function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const env = process.env, cands = [];
  if (process.platform === 'win32') {
    const bases = [env.LOCALAPPDATA, env.PROGRAMFILES || 'C:/Program Files', env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)'].filter(Boolean);
    for (const app of ['Google/Chrome/Application/chrome.exe', 'Chromium/Application/chrome.exe',
      'Microsoft/Edge/Application/msedge.exe', 'BraveSoftware/Brave-Browser/Application/brave.exe'])
      for (const b of bases) cands.push(path.join(b, app));
  } else if (process.platform === 'darwin') {
    cands.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser');
  }
  const found = cands.find(isFile);
  if (found) return found;
  const exts = process.platform === 'win32' ? ['.exe', ''] : [''];
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'brave-browser', 'chrome', 'msedge'])
    for (const dir of (env.PATH || '').split(path.delimiter)) for (const x of exts) if (dir && isFile(path.join(dir, name + x))) return path.join(dir, name + x);
  return null;
}

// Chrome on Windows leaves helper processes behind unless the whole tree goes
export function killTree(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill('SIGKILL');
}
export const tempProfile = () => fs.mkdtempSync(path.join(os.tmpdir(), 'chalk-frames-chrome-'));
export const removeProfile = dir => { try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch {} };
export const proofLine = s => `proof: ${s.verified + s.cited}/${s.total} hops traced to code (${s.verified} verified, ${s.cited} cited) · ${s.inferred} inferred` +
  (s.unproven ? ` · ${s.unproven} unproven` : '') + ` · ${s.broken} broken`;
export const themeParam = t => {
  if (!t) return null;
  const v = { dark: 'night', light: 'paper' }[t] || t;
  if (!/^(paper|night)$/.test(v)) throw new Error(`theme must be paper or night, got "${t}"`);
  return v;
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Below-normal priority, so a check or a recording never fights a game or an editor for the CPU.
// Chrome's renderers start after this and inherit it on Windows; on Unix it's a nice level.
function lowPriority(pid) {
  try { os.setPriority(pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch {}
}

// One headless Chrome driven over the DevTools protocol (Node >= 22, global WebSocket).
// Returns { page(method, params), once(event), eval(expr), close() }; the temp profile goes with it.
export async function openBrowser(fail = m => { console.error(m); process.exit(2); }) {
  const chrome = findChrome();
  if (!chrome) fail('no Chrome/Chromium/Edge/Brave found; set CHROME=/path/to/chrome');
  const profile = tempProfile();
  const child = spawn(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--mute-audio', '--disable-extensions', '--disable-background-networking', '--renderer-process-limit=2',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  lowPriority(child.pid);
  let closed = false;
  const cleanup = () => { if (closed) return; closed = true; killTree(child); removeProfile(profile); };
  process.on('exit', cleanup);
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { cleanup(); process.exit(130); });
  const wsUrl = await new Promise((resolve, reject) => {
    let err = '';
    const t = setTimeout(() => reject(new Error('Chrome did not open its DevTools port within 20 s')), 20000);
    child.on('error', e => reject(new Error(`could not start ${chrome}: ${e.message}`)));
    child.stderr.on('data', d => {
      err += d;
      const m = err.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(t); resolve(m[1]); }
    });
    child.on('exit', code => reject(new Error(`Chrome exited (${code}) before opening its DevTools port\n${err.trim()}`)));
  }).catch(e => { cleanup(); fail(e.message); });

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('could not connect to Chrome')); }).catch(e => { cleanup(); fail(e.message); });
  let id = 0;
  const pending = new Map(), waiters = [];
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? p.reject(new Error(`${p.method}: ${msg.error.message}`)) : p.resolve(msg.result);
    } else if (msg.method) for (const w of [...waiters]) if (w.method === msg.method) { waiters.splice(waiters.indexOf(w), 1); w.resolve(msg.params); }
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject, method });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const page = (method, params) => send(method, params, sessionId);
  const once = method => new Promise(resolve => waiters.push({ method, resolve }));
  const evaluate = async expr => {
    const r = await page('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  // wait for Chrome to really exit before deleting its profile; Windows keeps the files locked until then
  const exited = new Promise(r => child.once('exit', r));
  const close = async () => {
    try { await Promise.race([send('Browser.close'), sleep(2000)]); } catch {}
    await Promise.race([exited, sleep(3000)]);
    cleanup();
  };
  return { page, once, eval: evaluate, close };
}

// Every shot from one browser and one tab: load the page once per aspect, then step with chalk.go(k).
async function checkOverCDP({ url, snaps, theme, story }) {
  const b = await openBrowser();
  const q = aspect => `?snap&debug&aspect=${aspect}` + (theme ? `&theme=${theme}` : '');
  const load = async (aspect, a) => {
    await b.page('Emulation.setDeviceMetricsOverride', { width: a.w, height: a.h, deviceScaleFactor: a.dpr, mobile: false });
    await b.page('Page.enable');
    const loaded = b.once('Page.loadEventFired');
    await b.page('Page.navigate', { url: `${url}${q(aspect)}#1` });
    await Promise.race([loaded, sleep(15000)]);
    await b.eval(`Promise.race([Promise.all([window.chalk ? chalk.ready : Promise.reject(new Error('no window.chalk')), document.fonts.ready]), new Promise(r => setTimeout(r, 8000))]).then(() => true)`);
  };
  const settle = () => b.eval('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 30))))');
  const shoot = async png => {
    const { data } = await b.page('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(png, Buffer.from(data, 'base64'));
  };
  let errs = [];
  try {
    await load('wide', ASPECTS.wide);
    const r = await b.eval('JSON.parse(JSON.stringify(chalk.report))');
    const all = r.issues || [];
    errs = all.filter(i => i.level === 'error');
    const frames = +(r.steps ?? r.frames) || +(await b.eval('chalk.steps()')) || 0;
    console.log(`frames: ${frames}   errors: ${errs.length}   warnings: ${all.length - errs.length}`);
    for (const i of all) console.log((i.level === 'error' ? '  ERROR ' : '  warn  ') + i.where + ': ' + i.msg);
    const proof = r.proofSummary || (story && story.proofSummary);
    if (proof && proof.unproven < proof.total) console.log(proofLine(proof));

    fs.mkdirSync(snaps, { recursive: true });
    const nn = k => String(k).padStart(2, '0');
    const cmp = new Set((story && Array.isArray(story.frames) ? story.frames : []).map((f, i) => f && f.compare ? i + 1 : 0).filter(Boolean));
    for (const [name, a] of Object.entries(ASPECTS)) {
      if (name !== 'wide') await load(name, a);
      for (let k = 1; k <= frames; k++) {
        await b.eval(`chalk.go(${k})`); await settle();
        await shoot(path.join(snaps, `frame-${nn(k)}-${name}.png`));
        if (name === 'wide' && cmp.has(k)) {   // the compare toggle's "before" state, same click a viewer makes
          const ok = await b.eval(`(() => { const x = document.querySelector('.ct-chip [data-state="before"]'); if (!x) return false; x.click(); return true; })()`);
          if (ok) {
            await settle(); await shoot(path.join(snaps, `frame-${nn(k)}-wide-before.png`));
            await b.eval(`(() => { const x = document.querySelector('.ct-chip [data-state="after"]'); if (x) x.click(); })()`);
          }
        }
      }
    }
    console.log(`snapshots: ${snaps}${path.sep}frame-01-wide.png ... frame-${nn(frames)}-tall.png`);
  } catch (e) {
    console.error('check: ' + e.message + ' (open the page in a browser and check the console)');
    errs = [e];
  } finally {
    await b.close();
  }
  process.exit(errs.length ? 1 : 0);
}

// Some Chrome builds finish their work but never exit in headless mode, so each run gets a
// watchdog: stop as soon as `done()` says the output is complete (max ~30 s).
async function runChrome(chrome, args, done) {
  const child = spawn(chrome, args, { stdio: ['ignore', 'pipe', 'ignore'] });
  let out = '';
  child.stdout.on('data', d => { out += d; });
  const exited = new Promise(r => child.on('close', r));
  child.on('error', e => { console.error(`check: could not start ${chrome}: ${e.message}; set CHROME=/path/to/chrome`); process.exit(2); });
  for (let i = 0; i < 150 && child.exitCode === null; i++) {
    if (done(out)) break;
    await Promise.race([sleep(200), exited]);
  }
  killTree(child);
  await Promise.race([exited, sleep(2000)]);
  return out;
}

async function main() {
  const [src, snapArg] = process.argv.slice(2);
  if (!src) { console.error('usage: node check.mjs talk.html [snap-dir]'); process.exit(1); }
  if (!isFile(src)) { console.error('check: no such file: ' + src); process.exit(1); }
  let theme;
  try { theme = themeParam(process.env.CHALK_THEME); } catch (e) { console.error('check: CHALK_THEME ' + e.message); process.exit(1); }
  const html = path.resolve(src);
  const snaps = path.resolve(snapArg || html.replace(/\.html$/, '') + '-snaps');
  const chrome = findChrome();
  if (!chrome) { console.error('check: no Chrome/Chromium/Edge/Brave found; set CHROME=/path/to/chrome'); process.exit(2); }

  const url = pathToFileURL(html).href;
  let story = null;
  try { story = JSON.parse(fs.readFileSync(html, 'utf8').match(/id="story">([\s\S]*?)<\/script>/)[1]); } catch {}
  if (typeof WebSocket !== 'undefined') return checkOverCDP({ url, snaps, theme, story });

  const profile = tempProfile();
  const flags = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--virtual-time-budget=8000', `--user-data-dir=${profile}`];
  process.on('exit', () => removeProfile(profile));
  const q = aspect => `?snap&debug&aspect=${aspect}` + (theme ? `&theme=${theme}` : '');
  const win = a => [`--window-size=${a.w},${a.h}`, `--force-device-scale-factor=${a.dpr}`];

  // 1. the report (in ?snap the engine lays out every frame in both aspects and both compare states)
  const dom = await runChrome(chrome, [...flags, ...win(ASPECTS.wide), '--dump-dom', url + q('wide')], out => out.includes('</html>'));
  const m = dom.replace(/\n/g, ' ').match(/id="chalk-report"[^>]*>([^<]*)<\/script>/);
  if (!m) { console.error('check: the page did not publish a report (JS error? open it in a browser and check the console)'); process.exit(1); }
  const r = JSON.parse(m[1]), all = r.issues || [], errs = all.filter(i => i.level === 'error');
  const frames = +(r.steps ?? r.frames) || 0;
  console.log(`frames: ${frames}   errors: ${errs.length}   warnings: ${all.length - errs.length}`);
  for (const i of all) console.log((i.level === 'error' ? '  ERROR ' : '  warn  ') + i.where + ': ' + i.msg);
  const proof = r.proofSummary || (story && story.proofSummary);
  if (proof && proof.unproven < proof.total) console.log(proofLine(proof));   // silent for stories that cite no code

  // 2. a still of every frame's end state, in both aspects
  fs.mkdirSync(snaps, { recursive: true });
  const shot = async (png, page, a, what) => {
    fs.rmSync(png, { force: true });
    let last = -1;
    await runChrome(chrome, [...flags, ...win(a), `--screenshot=${png}`, page], () => {
      const size = isFile(png) ? fs.statSync(png).size : 0;
      const stable = size > 0 && size === last;
      last = size;
      return stable;
    });
    if (!isFile(png)) console.error(`check: no screenshot for ${what}`);
  };
  for (let k = 1; k <= frames; k++) for (const [name, a] of Object.entries(ASPECTS))
    await shot(path.join(snaps, `frame-${String(k).padStart(2, '0')}-${name}.png`), `${url}${q(name)}#${k}`, a, `frame ${k} (${name})`);

  // 3. compare frames in their "before" state. core.js has no URL switch for it, so a temp copy of the page
  // presses the toggle's "before" button once the engine is ready (same click a viewer makes; no motion in ?snap).
  const cmp = (story && Array.isArray(story.frames) ? story.frames : []).map((f, i) => f && f.compare ? i + 1 : 0).filter(Boolean);
  if (cmp.length) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chalk-frames-before-'));
    process.on('exit', () => removeProfile(tmp));
    const press = `<script>chalk.ready.then(()=>{const b=document.querySelector('.ct-chip [data-state="before"]');if(b)b.click();});</script>`;
    const page = fs.readFileSync(html, 'utf8');
    const at = page.lastIndexOf('</body>');
    const copy = path.join(tmp, path.basename(html));
    fs.writeFileSync(copy, at < 0 ? page + press : page.slice(0, at) + press + page.slice(at));
    for (const k of cmp)
      await shot(path.join(snaps, `frame-${String(k).padStart(2, '0')}-wide-before.png`), `${pathToFileURL(copy).href}${q('wide')}#${k}`, ASPECTS.wide, `frame ${k} (wide, before)`);
  }
  console.log(`snapshots: ${snaps}${path.sep}frame-01-wide.png ... frame-${String(frames).padStart(2, '0')}-tall.png`);
  process.exit(errs.length ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
