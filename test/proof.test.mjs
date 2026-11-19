// Proof rules shared by both skills' build.mjs.   node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { proveStory } from '../skills/frames/scripts/build.mjs';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const chalkBuild = path.join(repo, 'skills/chalk-talk/scripts/build.mjs');
const framesBuild = path.join(repo, 'skills/frames/scripts/build.mjs');

const SRC = [
  '// prepare: db.query(sql) happens later',   // 1
  'function split(s) { return s; }',           // 2
  'const rows = split(input);',                // 3
  'const out = db',                            // 4
  '  .query(sql);',                            // 5
  'send(out);',                                // 6
].join('\n');
const LONG = Array.from({ length: 130 }, (_, i) => i === 124 ? 'send(out);' : `const v${i} = ${i};`).join('\n');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chalk-proof-'));
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
fs.writeFileSync(path.join(dir, 'src.js'), SRC);
fs.writeFileSync(path.join(dir, 'long.js'), LONG);

const CASES = [
  // [name, code, calls, status, hit line or text the reason must contain]
  ['skips the comment, finds the call split over two lines', 'src.js:1-6', 'db.query(', 'verified', 4],
  ['a call that is only in a comment proves nothing', 'src.js:1-1', 'db.query(', 'broken', 'comment'],
  ['"t(" is not the tail of "split("', 'src.js:1-6', 't(', 'broken', 'not found'],
  ['"spli" is not the head of "split"', 'src.js:1-6', 'spli', 'broken', 'not found'],
  ['a whole call still matches', 'src.js:1-6', 'split(input)', 'verified', 3],
  ['spaces in the calls string are free around punctuation', 'src.js:1-6', 'send( out )', 'verified', 6],
  ['a range over 120 lines is too wide to prove a hop', 'long.js:1-130', 'send(out)', 'broken', '120'],
  ['a wide range without calls stays cited', 'long.js:1-130', undefined, 'cited', null],
];
const check = (proof, status, want) => {
  assert.equal(proof.status, status, JSON.stringify(proof));
  if (typeof want === 'number') assert.equal(proof.hit, want);
  if (typeof want === 'string') assert.match(proof.why, new RegExp(want));
};

function chalk(edges, ...flags) {
  const scene = { title: 't', nodes: [{ id: 'a', label: 'A', at: [0, 0] }, { id: 'b', label: 'B', at: [1, 0] }],
    edges: edges.map((e, i) => ({ id: 'e' + i, from: 'a', to: 'b', ...e })),
    steps: [{ title: 's', say: 's', flow: edges.map((_, i) => 'e' + i) }] };
  const file = path.join(dir, 'x.scene.json');
  fs.writeFileSync(file, JSON.stringify(scene));
  const r = spawnSync(process.execPath, [chalkBuild, ...flags, file], { cwd: dir, encoding: 'utf8' });
  const html = fs.readFileSync(path.join(dir, 'x.html'), 'utf8');
  const built = JSON.parse(html.match(/<script id="scene"[^>]*>([\s\S]*?)<\/script>/)[1]);
  return { code: r.status, err: r.stderr, proofs: built.edges.map(e => e.proof) };
}

for (const [name, code, calls, status, want] of CASES) {
  test('chalk-talk: ' + name, () => check(chalk([{ code, calls }]).proofs[0], status, want));
  test('frames: ' + name, () => {
    const story = { frames: [{ lens: 'flow', flows: [{ id: 'f', code, calls }] }] };
    proveStory(story, dir, true);
    check(story.frames[0].flows[0].proof, status, want);
  });
}

test('chalk-talk: --strict fails the build on a broken proof, and only then', () => {
  const broken = [{ code: 'src.js:1-6', calls: 'nope(' }], fine = [{ code: 'src.js:1-6', calls: 'send(out)' }];
  assert.equal(chalk(broken).code, 0);
  assert.equal(chalk(broken, '--strict').code, 1);
  assert.equal(chalk(fine, '--strict').code, 0);
});

test('frames: --strict fails the build on a broken proof, and only then', () => {
  // this example cites vite's source, which is not in this repo: every cited flow is broken here
  const story = path.join(repo, 'skills/frames/examples/code-onboarding.story.json'), out = path.join(dir, 'f.html');
  const run = (...flags) => spawnSync(process.execPath, [framesBuild, ...flags, story, out], { cwd: dir, encoding: 'utf8' }).status;
  assert.equal(run(), 0);
  fs.rmSync(out);
  assert.equal(run('--strict'), 1);
  assert.ok(fs.existsSync(out), 'the page is still written');
});
