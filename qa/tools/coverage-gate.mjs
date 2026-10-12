// Catalog coverage gate: every row id in the ids file must appear as "[<id>]" in a qa/tests/phaseNN_*.spec.ts
// or in an AppBack test (layer `be`: id in a pytest docstring). Prints the missing ids grouped by screen; exit 1 if any.
// Usage (from qa/): node tools/coverage-gate.mjs --phase 04 --ids <coverage-ids.txt> [--appback F:/App/AppBack]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const opt = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const NN = String(opt('phase', '')).padStart(2, '0');
const idsFile = opt('ids', '');
if (!idsFile || NN === '00') { console.error('usage: node tools/coverage-gate.mjs --phase NN --ids <file> [--appback dir]'); process.exit(2); }

const ids = readFileSync(idsFile, 'utf8').split(/\r?\n/u).map((s) => s.trim()).filter(Boolean);
const testsDir = join(import.meta.dirname, '..', 'tests');
let text = readdirSync(testsDir).filter((f) => f.startsWith(`phase${NN}_`) && f.endsWith('.spec.ts'))
  .map((f) => readFileSync(join(testsDir, f), 'utf8')).join('\n');

const walk = (dir, out) => {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/^test_.*\.py$/u.test(name)) out.push(readFileSync(p, 'utf8'));
  }
  return out;
};
const appback = opt('appback', '');
if (appback) text += walk(appback, []).join('\n');

const missing = ids.filter((id) => !text.includes(`[${id}]`) && !(appback && new RegExp(`\\b${id}\\b`, 'u').test(text)));
const byScreen = new Map();
for (const id of missing) { const k = id.split('-')[0]; byScreen.set(k, [...(byScreen.get(k) ?? []), id]); }
console.log(`[coverage-gate] phase ${NN}: ${ids.length - missing.length}/${ids.length} ids covered, ${missing.length} missing`);
for (const [k, list] of byScreen) console.log(`  ${k} (${list.length}): ${list.join(' ')}`);
process.exit(missing.length ? 1 : 0);
