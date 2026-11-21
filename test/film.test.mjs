// Film choreography, checked in a real page: node --test test/film.test.mjs
// Needs Chrome (the same one check.mjs finds); skipped where there is none.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { findChrome, tempProfile, removeProfile } from '../skills/chalk-talk/scripts/check.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let chrome = null; try { chrome = findChrome(); } catch {}

const scene = {
  title: 'gate', style: 'film',
  nodes: [{ id: 'a', kind: 'bot', label: 'Agent' }, { id: 'g', kind: 'gate', label: 'Guard' }, { id: 'u', kind: 'actor', label: 'You' }],
  edges: [{ id: 'e1', from: 'a', to: 'g', packet: 'call' }, { id: 'e2', from: 'g', to: 'u', packet: 'allow?' }],
  steps: [
    { title: 'one', say: 'The call is stopped.', flow: [{ edge: 'e1', stamp: 'ASK', tone: 'warn' }], bubble: { a: 'Post it to Slack.' } },
    { title: 'two', say: 'You decide.', flow: [{ edge: 'e2', stamp: 'OK', tone: 'ok' }] },
  ],
};

// Sweeps a step with chalk.seek and records what the barrier and the stamp did.
const probe = `<script>chalk.ready.then(() => {
  const sweep = k => {
    const D = chalk.duration(k), arm = [], stamp = [];
    for (let ms = 0; ms <= D; ms += 50) {
      chalk.seek(k, ms);
      const a = document.querySelector('.f-arm'), s = document.querySelector('.pk-stamp');
      arm.push(a ? parseFloat(a.style.transform.replace('rotate(', '')) : null);
      stamp.push(s ? +getComputedStyle(s).opacity : null);
    }
    return { arm, stamp };
  };
  const out = { bubbles: 0, one: null, two: null, issues: JSON.parse(document.getElementById('chalk-report').textContent).issues };
  out.one = sweep(1);
  out.bubbles = [...document.querySelectorAll('.f-bubble')].map(b => b.textContent);
  out.two = sweep(2);
  const p = document.createElement('pre'); p.id = 'film-test'; p.textContent = JSON.stringify(out); document.body.appendChild(p);
});</script>`;

function run(query) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chalk-film-')), src = path.join(dir, 'gate.scene.json'), html = path.join(dir, 'gate.html');
  fs.writeFileSync(src, JSON.stringify(scene));
  const b = spawnSync(process.execPath, [path.join(root, 'skills/chalk-talk/scripts/build.mjs'), src, html], { encoding: 'utf8' });
  assert.equal(b.status, 0, b.stderr);
  fs.appendFileSync(html, probe);
  const prof = tempProfile();
  const r = spawnSync(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${prof}`, '--window-size=1600,900', '--virtual-time-budget=8000', '--dump-dom', pathToFileURL(html).href + query], { encoding: 'utf8', timeout: 60000, maxBuffer: 1 << 26 });
  removeProfile(prof); fs.rmSync(dir, { recursive: true, force: true });
  const m = /<pre id="film-test">([\s\S]*?)<\/pre>/.exec(r.stdout || '');
  assert.ok(m, 'the page never reported back');
  return JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
}

test('film: the barrier comes down on what arrives, the stamp lands, the speaker gets a bubble', { skip: !chrome && 'no Chrome' }, () => {
  const o = run('');
  assert.deepEqual(o.issues.filter(i => i.level === 'error'), []);
  assert.deepEqual(o.bubbles, ['Post it to Slack.']);
  assert.equal(o.one.arm[0], -64, 'the barrier starts up');
  assert.equal(Math.max(...o.one.arm), 0, 'and comes all the way down');
  assert.equal(o.one.stamp[0], 0, 'no stamp before the envelope lands');
  assert.equal(Math.max(...o.one.stamp), 1, 'then the stamp is on it');
  // an "ok" leaving the gate: stamped at the gate first, and the barrier goes back up
  assert.equal(Math.max(...o.two.stamp), 1);
  assert.equal(o.two.arm[0], 0, 'step two finds the barrier where step one left it');
  assert.ok(o.two.stamp[o.two.arm.findIndex(a => a < 0)] === 1, 'the envelope is stamped before the barrier moves');
  assert.equal(o.two.arm.at(-1), -64, 'and the barrier is up once the ok has left');
});

test('film fields are ignored outside film', { skip: !chrome && 'no Chrome' }, () => {
  const o = run('?style=iso');
  assert.deepEqual(o.issues.filter(i => i.level === 'error'), []);
  assert.deepEqual(o.bubbles, []);
  assert.ok(o.one.stamp.every(s => s === null) && o.one.arm.every(a => a === null));
});
