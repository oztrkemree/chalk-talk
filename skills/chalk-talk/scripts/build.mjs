#!/usr/bin/env node
// Build a chalk talk: put a scene JSON into the template and write one self-contained HTML file.
//
//   node build.mjs path/to/name.scene.json [out.html]
//
// Default output: the scene path with ".scene.json" (or ".json") replaced by ".html".
//
// A node or edge can point at the real code; the snippet gets embedded so clicking it shows the code:
//   "code": "src/auth/login.ts:12-40"      lines 12..40
//   "code": "src/auth/login.ts:18"         from line 18, that line marked
//   "code": "src/auth/login.ts"            the top of the file
//   "code": { "file": "...", "lines": [12, 40], "mark": [18, 22] }
// Paths resolve against the scene's "root" (relative to the scene file), else the current
// directory, else the scene's directory. Inside a GitHub checkout a permalink is added.
// CHALK_SHARE=1 leaves local absolute paths out (for pages sent to other people).
//
// Proof: every edge gets proof.status verified | cited | inferred | unproven | broken
// (edge "calls" strings must appear in the cited lines; "inferred" is an honest guess).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MAX_LINES = 120, TOP_LINES = 40, AFTER_ONE = 24;
const here = path.dirname(fileURLToPath(import.meta.url));
const die = msg => { console.error('build: ' + msg); process.exit(1); };

const [scenePath, outArg] = process.argv.slice(2);
if (!scenePath) die('usage: node build.mjs scene.json [out.html]');
if (!fs.existsSync(scenePath) || !fs.statSync(scenePath).isFile()) die('no such scene file: ' + scenePath);
const out = outArg || (scenePath.endsWith('.scene.json') ? scenePath.slice(0, -11) + '.html'
  : scenePath.endsWith('.json') ? scenePath.slice(0, -5) + '.html' : scenePath + '.html');

const raw = fs.readFileSync(scenePath, 'utf8');
let scene;
try { scene = JSON.parse(raw); } catch (err) { die(`${scenePath} is not valid JSON: ${err.message}`); }

const sceneDir = path.dirname(path.resolve(scenePath));
const share = process.env.CHALK_SHARE === '1';
const warnings = [];
const arr = v => v == null ? [] : Array.isArray(v) ? v : [v];
const items = kind => arr(scene[kind]).filter(x => x && typeof x === 'object');

function parse(spec) {
  if (typeof spec === 'string') {
    const [, file, a, b] = spec.trim().match(/^(.*?)(?::(\d+)(?:-(\d+))?)?$/);
    if (a && !b) return { file, a: +a, b: +a + AFTER_ONE, mark: [+a, +a] };
    return { file, a: a ? +a : null, b: b ? +b : null, mark: null };
  }
  if (spec && typeof spec === 'object' && typeof spec.file === 'string') {
    const lines = arr(spec.lines);
    const mark = typeof spec.mark === 'number' ? [spec.mark, spec.mark] : spec.mark;
    const a = lines.length > 0 ? lines[0] : null;
    const b = lines.length > 1 ? lines[1] : (a ? a + AFTER_ONE : null);
    return { file: spec.file, a, b, mark: Array.isArray(mark) && mark.length === 2 ? mark : null };
  }
  return null;
}

const gitCache = new Map();
function gitInfo(dir) {    // { top, repo, sha } when dir sits in a GitHub checkout
  if (gitCache.has(dir)) return gitCache.get(dir);
  const run = (...a) => { try { return execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
  const top = run('rev-parse', '--show-toplevel'), url = run('remote', 'get-url', 'origin'), sha = run('rev-parse', 'HEAD');
  const m = url.match(/^(?:git@github\.com:|https:\/\/github\.com\/|ssh:\/\/git@github\.com\/)([^/]+\/[^/]+?)(?:\.git)?\/?$/);
  const info = top && sha && m ? { top, repo: m[1], sha, run } : null;
  gitCache.set(dir, info);
  return info;
}
function permalink(abs) {
  const g = gitInfo(path.dirname(abs));
  if (!g || g.run('ls-files', '--error-unmatch', abs) === '') return null;
  return `https://github.com/${g.repo}/blob/${g.sha}/${path.relative(g.top, abs).split(path.sep).join('/')}`;
}

const roots = [...(typeof scene.root === 'string' ? [path.resolve(sceneDir, scene.root)] : []), process.cwd(), sceneDir];
const fileLines = abs => {    // same split as Python's str.splitlines()
  const ls = fs.readFileSync(abs, 'utf8').split(/\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/);
  if (ls.length && ls[ls.length - 1] === '') ls.pop();
  return ls;
};

// returns { code, src } : code = what gets embedded, src = the cited range for proof checks
function resolve(where, spec) {
  const p = parse(spec);
  if (!p) { warnings.push(`${where}: "code" should be "path:start-end" or {"file", "lines"}`); return { code: null, src: { bad: true } }; }
  const abs = roots.map(r => path.resolve(r, p.file)).find(f => { try { return fs.statSync(f).isFile(); } catch { return false; } });
  if (!abs) { warnings.push(`${where}: code file not found: ${p.file}`); return { code: { file: p.file, missing: true }, src: { file: p.file, missing: true } }; }
  const lines = fileLines(abs);
  let start = Math.max(1, p.a || 1);
  let end = Math.min(lines.length, p.b || (start + TOP_LINES - 1));
  const src = { file: p.file, start, end, lines, outOfRange: end < start, asked: p.b };
  if (end < start) {
    warnings.push(`${where}: ${p.file} has ${lines.length} lines, asked for ${start}-${p.b}`);
    start = 1; end = Math.min(lines.length, TOP_LINES);
  }
  if (end - start + 1 > MAX_LINES) {
    warnings.push(`${where}: ${p.file}:${start}-${end} is long; showing the first ${MAX_LINES} lines`);
    end = start + MAX_LINES - 1;
  }
  const code = { file: p.file, start, end, text: lines.slice(start - 1, end).join('\n') };
  if (p.mark) code.mark = p.mark;
  if (!share) code.abs = abs;
  const link = permalink(abs);
  if (link) code.url = `${link}#L${start}-L${end}`;
  return { code, src };
}

// Where does `needle` occur in lines[start-1..end-1], ignoring all whitespace? -> 1-based line or 0.
function findCall(src, needle) {
  const want = String(needle).replace(/\s+/g, '');
  if (!want) return 0;
  let flat = '';
  const lineOf = [];
  for (let ln = src.start; ln <= src.end; ln++) {
    const s = src.lines[ln - 1].replace(/\s+/g, '');
    flat += s;
    for (let i = 0; i < s.length; i++) lineOf.push(ln);
  }
  const at = flat.indexOf(want);
  return at < 0 ? 0 : lineOf[at];
}

function proofOf(edge, src) {
  if (src) {
    const range = src.start ? `${src.file}:${src.start}-${src.end}` : src.file;
    if (src.bad) return { status: 'broken', why: 'code is not "path:start-end" or {"file", "lines"}' };
    if (src.missing) return { status: 'broken', file: src.file, why: `file ${src.file} not found` };
    if (src.outOfRange) return { status: 'broken', file: src.file, why: `lines ${src.start}-${src.asked} not in ${src.file} (${src.lines.length} lines)` };
    const at = { file: src.file, start: src.start, end: src.end };
    const calls = arr(edge.calls);
    if (!calls.length) return { status: 'cited', ...at };
    let hit = 0;
    for (const c of calls) {
      const ln = findCall(src, c);
      if (!ln) return { status: 'broken', ...at, why: `calls ${JSON.stringify(String(c))} not found in ${range}` };
      hit = hit || ln;      // the line of the first calls string
    }
    return { status: 'verified', ...at, hit };
  }
  if (typeof edge.inferred === 'string' && edge.inferred.trim()) return { status: 'inferred', why: edge.inferred };
  return { status: 'unproven' };
}

// Old build.sh only rewrote the scene when it mentioned "code"; untouched scenes stay byte-identical.
const nodes = items('nodes'), edges = items('edges');
const proofOn = scene.proof !== false && (scene.proof === true ||
  [...nodes, ...edges].some(x => 'code' in x) || edges.some(e => e.inferred != null));
let text = raw.replace(/\r?\n$/, '');
if (raw.includes('"code"') || proofOn) {
  const sources = new Map();
  nodes.forEach((n, i) => { if ('code' in n) n.code = resolve(n.id || `nodes[${i}]`, n.code).code; });
  edges.forEach((e, i) => {
    if ('code' in e) { const r = resolve(e.id || `edges[${i}]`, e.code); e.code = r.code; sources.set(e, r.src); }
    else if (e.calls != null && proofOn) warnings.push(`${e.id || `edges[${i}]`}: "calls" needs a "code" range to check against; ignored`);
  });
  for (const w of warnings) console.error('build: warn ' + w);

  if (proofOn) {
    const ids = new Map(edges.map((e, i) => [String(e.id || `e${i + 1}`), e]));
    edges.forEach(e => { e.proof = proofOf(e, sources.get(e)); });
    for (const [id, e] of ids) if (e.proof.status === 'broken') console.error(`WARNING proof: edge ${id} -> ${e.proof.why}`);
    const flowed = new Set(items('steps').flatMap(st => arr(st.flow).map(f => String(typeof f === 'string' ? f : f && f.edge))));
    const counted = [...ids].filter(([id]) => flowed.has(id)).map(([, e]) => e);
    const pool = counted.length ? counted : edges;
    const sum = { total: pool.length, verified: 0, cited: 0, inferred: 0, unproven: 0, broken: 0 };
    pool.forEach(e => sum[e.proof.status]++);
    scene.proofSummary = sum;
    const traced = sum.verified + sum.cited;
    console.error(`proof: ${traced}/${sum.total} hops traced to code (${sum.verified} verified, ${sum.cited} cited) · ${sum.inferred} inferred` +
      (sum.unproven ? ` · ${sum.unproven} unproven` : '') + ` · ${sum.broken} broken`);
  }
  text = JSON.stringify(scene, null, 1);
}
// a literal "</script" (common in HTML snippets) would close the page's script tag; "<\/" is the same JSON
text = text.replace(/<\//g, '<\\/');

// LF out, like the old awk build, whatever line endings the checkout gave the template
const tpl = fs.readFileSync(path.join(here, '..', 'assets', 'template.html'), 'utf8').replace(/\r\n/g, '\n');
const at = tpl.search(/^__SCENE__$/m);
if (at < 0) die('template has no __SCENE__ line');
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, tpl.slice(0, at) + text.replace(/\r\n?/g, '\n') + tpl.slice(at + '__SCENE__'.length));
console.log(out);
