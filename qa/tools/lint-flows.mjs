// Static lint for flow specs: the test defects the QA-04c sample review found (~35 in 15 flows) that a green run never shows.
// Usage (from qa/): node tools/lint-flows.mjs --phase 04 | node tools/lint-flows.mjs tests/phase04_x_edge.spec.ts ...
// Exit 1 on any finding. A line that must stay as is carries `// lint-ok: <reason>` (or `fixed-wait-ok` for waits).
//   no-assert       test.step body with no expect / expect.soft / expect.poll / assert*() / verifyUi() call
//   swallowed       .catch(...) or an empty catch on an expect / poll: the check can never fail
//   always-true     expect(true…), toBeGreaterThanOrEqual(0), toBeTruthy()/toBeDefined() on a locator or a promise
//   fixed-wait      waitForTimeout(…) or setTimeout(resolve, n) without fixed-wait-ok (flake source: FL-11-09, CP-5)
// ponytail: line/brace scanner, not an AST — strings containing braces can shift a step body; move to ts-morph if it misfires.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Suite = the qa/ dir it is run from (works in worktrees), else the one next to this script.
const SUITE = existsSync(join(process.cwd(), 'tests')) ? process.cwd() : resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const phase = argv.includes('--phase') ? String(argv[argv.indexOf('--phase') + 1]).padStart(2, '0') : null;
const files = phase
  ? readdirSync(join(SUITE, 'tests')).filter((f) => f.startsWith(`phase${phase}_`) && f.endsWith('.spec.ts')).map((f) => join(SUITE, 'tests', f))
  : argv.filter((a) => a.endsWith('.ts')).map((a) => resolve(a));
if (files.length === 0) {
  console.error('usage: node tools/lint-flows.mjs --phase NN | <spec files>');
  process.exit(2);
}

// expect, expect.soft/.poll, expect.configure aliases (`softly`), assert*/expect* helpers, verifyUi.
const ASSERT = /\b(?:expect\w*|softly|soft)\s*(?:\.\s*(?:soft|poll))?\s*\(|\bassert[A-Z]\w*\s*\(|\bverifyUi\s*\(|\.toPass\s*\(/u;
const CHECK = /\bexpect(?:\.soft|\.poll)?\s*\(|\.toPass\s*\(/u;
const RULES = [
  ['swallowed', (l) => CHECK.test(l) && /\.catch\s*\(/u.test(l)],
  ['always-true', (l) => /\bexpect(?:\.soft)?\s*\(\s*(?:true|!0|1)\s*[,)]/u.test(l) || (/toBeGreaterThanOrEqual\(\s*0\s*\)/u.test(l) && /\.length\b|count\s*\(|Count\b/u.test(l))],
  ['always-true', (l) => /expect(?:\.soft)?\s*\(\s*(?:page\.|[\w.]*getBy\w+\(|[\w.]*locator\()[^;]*\)\s*\.(?:toBeTruthy|toBeDefined|not\.toBeNull)\s*\(/u.test(l)],
  ['fixed-wait', (l) => /waitForTimeout\s*\(|setTimeout\s*\(\s*\w+\s*,\s*\d/u.test(l) && !/fixed-wait-ok/u.test(l)],
];

/** Same length as `src`, with string/template/comment contents replaced by spaces (newlines kept). */
function blank(src) {
  let out = '';
  for (let i = 0; i < src.length; ) {
    const c = src[i];
    const two = src.slice(i, i + 2);
    const close = two === '//' ? '\n' : two === '/*' ? '*/' : c === "'" || c === '"' || c === '`' ? c : null;
    if (close === null) {
      out += c;
      i += 1;
      continue;
    }
    let j = i + (close.length === 2 || close === '\n' ? 2 : 1);
    while (j < src.length && src.slice(j, j + close.length) !== close) j += src[j] === '\\' && close !== '\n' ? 2 : 1;
    j = Math.min(src.length, j + (close === '\n' ? 0 : close.length));
    out += src.slice(i, j).replace(/[^\n]/gu, ' ');
    i = j;
  }
  return out;
}

/** Brace-matched body starting at the first `{` at/after `from` in blanked code (end index exclusive). */
function bodyEnd(code, open) {
  let depth = 0;
  for (let end = open; end < code.length; end += 1) {
    if (code[end] === '{') depth += 1;
    else if (code[end] === '}' && --depth === 0) return end;
  }
  return code.length;
}

// Helpers that assert (their body calls expect…): a step calling one is not "no-assert". Fixed point, so a helper calling an
// asserting helper counts too. Scans the spec files and tests/support/**.
const helperSrc = [...files];
const walkTs = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walkTs(join(dir, e.name));
    else if (e.name.endsWith('.ts')) helperSrc.push(join(dir, e.name));
  }
};
if (existsSync(join(SUITE, 'tests', 'support'))) walkTs(join(SUITE, 'tests', 'support'));
const defs = [];
for (const f of helperSrc) {
  const text = readFileSync(f, 'utf8');
  const code = blank(text);
  for (const m of code.matchAll(/(?:function\s+(\w+)\s*(?:<[^>]*>)?\s*\(|(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?(?:<[^>]*>)?\([^)]*\)[^=;{]*=>\s*)/gu)) {
    const after = m.index + m[0].length;
    // Expression-bodied arrow (`=> expect(…)…`): the body runs to the end of the statement.
    if (m[2] !== undefined && code[after] !== '{') {
      defs.push([m[2], text.slice(after, code.indexOf(';', after) >>> 0)]);
      continue;
    }
    // Arrow: the body opens right after `=>` (a `{` in the parameter types must not be taken for it).
    const open = m[2] !== undefined ? after : code.indexOf('{', m.index);
    if (open < 0) continue;
    defs.push([m[1] ?? m[2], text.slice(open, bodyEnd(code, open))]);
  }
}
const asserting = new Set();
const callsAsserting = (body) => [...body.matchAll(/\b(\w+)\s*\(/gu)].some((m) => asserting.has(m[1]));
for (let grew = true; grew; ) {
  grew = false;
  for (const [name, body] of defs) {
    if (asserting.has(name)) continue;
    if (ASSERT.test(body) || callsAsserting(body)) {
      asserting.add(name);
      grew = true;
    }
  }
}

let total = 0;
let steps = 0;
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const out = [];
  lines.forEach((l, i) => {
    if (/lint-ok:/u.test(l)) return;
    for (const [rule, hit] of RULES) if (hit(l)) out.push([i + 1, rule, l.trim()]);
  });
  // Empty catch right after a try that checks something: `} catch {}` / `catch (e) { }`.
  for (const m of text.matchAll(/try\s*\{([\s\S]{0,600}?)\}\s*catch\s*(?:\([^)]*\))?\s*\{\s*\}/gu)) {
    if (CHECK.test(m[1])) out.push([text.slice(0, m.index).split('\n').length, 'swallowed', 'empty catch around a check']);
  }
  // test.step bodies: brace-match on the code with strings and comments blanked (titles like '…/spatial {name}').
  const code = blank(text);
  for (const m of code.matchAll(/test\.step\s*\(/gu)) {
    steps += 1;
    const open = code.indexOf('{', m.index);
    // `test.step(title, body)` passing a function value (a step wrapper): no `{` inside the call's own parentheses.
    let close = m.index + m[0].length;
    for (let depth = 1; close < code.length && depth > 0; close += 1) depth += code[close] === '(' ? 1 : code[close] === ')' ? -1 : 0;
    if (open < 0 || open > close) continue;
    const end = bodyEnd(code, open);
    const body = text.slice(open, end);
    const line = text.slice(0, m.index).split('\n').length;
    if (!ASSERT.test(body) && !callsAsserting(body) && !/lint-ok:/u.test(lines[line - 1])) out.push([line, 'no-assert', lines[line - 1].trim()]);
  }
  out.sort((a, b) => a[0] - b[0]);
  for (const [line, rule, src] of out) console.log(`${basename(file)}:${line}  ${rule.padEnd(11)} ${src.slice(0, 140)}`);
  total += out.length;
}
console.log(`lint-flows: ${files.length} file(s), ${steps} step(s), ${total} finding(s)`);
process.exit(total ? 1 : 0);
