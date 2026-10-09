// Every executed test case must carry at least one evidence artifact.
// Usage (from qa/): node tools/check-evidence.mjs logs/run-01/phase01.json [more.json...]
// Reads Playwright JSON reports. A passed test needs an evidence image attached by captureEvidence
// (name `<id>_<slug>.png`) or, for API cases, a request/response JSON attached by captureExchange
// (`<id>_<slug>.json`, tests/support/api.ts); a failed test may count Playwright's failure screenshot. Skipped/fixme
// tests are listed but not required (they did not execute). Exit 1 when any executed case has none.
import { readFileSync } from 'node:fs';

const EVIDENCE_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*\.(png|json)$/u;
const EVIDENCE_TYPES = new Set(['image/png', 'application/json']);
const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: node tools/check-evidence.mjs <report.json> [...]');
  process.exit(2);
}

const rows = [];
const walk = (suite, titles) => {
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) {
      const result = t.results?.at(-1);
      const images = (result?.attachments ?? []).filter((a) => EVIDENCE_TYPES.has(a.contentType));
      rows.push({
        file: spec.file,
        title: [...titles, spec.title].join(' › '),
        status: result?.status ?? t.status ?? 'unknown',
        evidence: images.filter((a) => EVIDENCE_NAME.test(a.name)).map((a) => a.name),
        failureShots: images.filter((a) => !EVIDENCE_NAME.test(a.name)).length,
      });
    }
  }
  for (const child of suite.suites ?? []) walk(child, child.title ? [...titles, child.title] : titles);
};
for (const f of files) for (const s of JSON.parse(readFileSync(f, 'utf8')).suites ?? []) walk(s, []);

let missing = 0;
for (const r of rows) {
  const executed = r.status === 'passed' || r.status === 'failed' || r.status === 'timedOut';
  const ok = !executed || r.evidence.length > 0 || (r.status !== 'passed' && r.failureShots > 0);
  if (executed && !ok) missing += 1;
  const mark = !executed ? 'SKIP' : ok ? 'OK  ' : 'MISS';
  console.log(`${mark} [${r.status}] ${r.title} :: ${r.evidence.join(', ') || (r.failureShots ? 'failure screenshot' : '-')}`);
}
console.log(`\n${rows.length} cases, ${missing} executed case(s) without a screenshot or API exchange`);
process.exit(missing > 0 ? 1 : 0);
