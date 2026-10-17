#!/usr/bin/env node
// Lint a built chalk talk and take a PNG of every step with headless Chrome.
//
//   node check.mjs talk.html [snap-dir]
//
// Prints the engine's layout report (overlaps, arrows through boxes, crowded steps, long text)
// and writes step-1.png ... step-N.png. Problem areas are boxed in red on the PNGs.
// Exit code: 0 = clean or warnings only, 1 = errors to fix, 2 = no Chrome found.
// Set CHROME=/path/to/chrome to pick a browser, CHALK_THEME=dark for dark snapshots,
// CHALK_STYLE=blueprint (or studio, editorial) to check another style than the scene's own.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const isFile = f => { try { return fs.statSync(f).isFile(); } catch { return false; } };

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
export const tempProfile = () => fs.mkdtempSync(path.join(os.tmpdir(), 'chalk-talk-chrome-'));
export const removeProfile = dir => { try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch {} };
export const proofLine = s => `proof: ${s.verified + s.cited}/${s.total} hops traced to code (${s.verified} verified, ${s.cited} cited) · ${s.inferred} inferred` +
  (s.unproven ? ` · ${s.unproven} unproven` : '') + ` · ${s.broken} broken`;

const sleep = ms => new Promise(r => setTimeout(r, ms));

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
  const html = path.resolve(src);
  const snaps = path.resolve(snapArg || html.replace(/\.html$/, '') + '-snaps');
  const chrome = findChrome();
  if (!chrome) { console.error('check: no Chrome/Chromium/Edge/Brave found; set CHROME=/path/to/chrome'); process.exit(2); }

  const url = pathToFileURL(html).href;
  const extra = `theme=${process.env.CHALK_THEME || 'light'}` + (process.env.CHALK_STYLE ? `&style=${encodeURIComponent(process.env.CHALK_STYLE)}` : '');
  const profile = tempProfile();
  const flags = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--virtual-time-budget=8000', `--user-data-dir=${profile}`];
  process.on('exit', () => removeProfile(profile));

  const dom = await runChrome(chrome, [...flags, '--dump-dom', `${url}?snap&${extra}`], out => out.includes('</html>'));
  const m = dom.replace(/\n/g, ' ').match(/id="chalk-report"[^>]*>([^<]*)<\/script>/);
  if (!m) { console.error('check: the page did not produce a report (JS error? open it in a browser and check the console)'); process.exit(1); }
  const r = JSON.parse(m[1]);
  const errs = r.issues.filter(i => i.level === 'error');
  console.log(`steps: ${r.steps}   errors: ${errs.length}   warnings: ${r.issues.length - errs.length}`);
  for (const i of r.issues) console.log((i.level === 'error' ? '  ERROR ' : '  warn  ') + i.where + ': ' + i.msg);
  const proof = [r.proofSummary, r.proof, r.proof && r.proof.summary].find(p => p && typeof p.total === 'number');
  if (proof && proof.unproven < proof.total) console.log(proofLine(proof));   // silent for talks that cite no code

  fs.mkdirSync(snaps, { recursive: true });
  for (let i = 1; i <= (r.steps || 0); i++) {
    const png = path.join(snaps, `step-${i}.png`);
    fs.rmSync(png, { force: true });
    let last = -1;
    await runChrome(chrome, [...flags, '--force-device-scale-factor=1', '--window-size=1600,1060', `--screenshot=${png}`, `${url}?snap&debug&${extra}#${i}`], () => {
      const size = isFile(png) ? fs.statSync(png).size : 0;
      const stable = size > 0 && size === last;
      last = size;
      return stable;
    });
  }
  console.log(`snapshots: ${path.join(snaps, 'step-1.png')} ... step-${r.steps}.png`);
  process.exit(errs.length ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
