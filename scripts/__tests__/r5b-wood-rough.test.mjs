const { it: test } = globalThis.describe ? globalThis : await import('node:test');
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { LIBRARY_FILE } from '../pascal-material-webp.mjs';
import { transformRealism } from '../pascal-realism.mjs';
import { MATERIALS_UI_VI } from '../pascal-vi/materials-ui.mjs';
import { RULES as R5 } from '../realism/r5-materials.mjs';
import { RULES, WOOD_ROUGHNESS, woodRules } from '../realism/r5b-wood-rough.mjs';

const FILE = 'core/src/material-library.ts';
const library = readFileSync(LIBRARY_FILE, 'utf8');
const roughnessOf = (code, id) => {
  const s = code.replaceAll('\r\n', '\n');
  const block = s.slice(s.indexOf(`id: '${id}',`));
  return Number(block.match(/\n {8}roughness: ([\d.]+),/)[1]);
};
const apply = (rules) => transformRealism(library, `/x/packages/${FILE}`, rules.map((pairs, i) => ({ source: `t${i}`, file: FILE, pairs })));

test('đổi đúng roughness các id gỗ, id khác giữ nguyên', () => {
  const out = apply([RULES[FILE]]);
  for (const [id, from, to] of WOOD_ROUGHNESS) {
    assert.equal(roughnessOf(library, id), from, id);
    assert.equal(roughnessOf(out, id), to, id);
  }
  const other = ['flooring-woodenceramic2', 'flooring-woodenceramic3', 'flooring-tile85a'];
  for (const id of other) assert.equal(roughnessOf(out, id), roughnessOf(library, id), id);
  assert.equal(out.length - library.length, WOOD_ROUGHNESS.reduce((n, [, f, t]) => n + String(t).length - String(f).length, 0));
});

test('giá trị mới trong [0,1] (schema Pascal) và áp chung với r5 không xung đột', () => {
  for (const [, , to] of WOOD_ROUGHNESS) assert.ok(to >= 0 && to <= 1);
  const out = apply([R5[FILE], RULES[FILE]]);
  assert.equal(roughnessOf(out, 'flooring-woodparquet76'), 1);
  assert.ok(out.includes("id: 'plaster-white',"));
});

test('roughness gốc đổi → ném lỗi', () => {
  assert.throws(() => woodRules(library.replace(/(id: 'wood-finewood27',[\s\S]*?roughness: )0\.5,/, '$10.4,')), /wood-finewood27/);
});

test('vẫn khớp sau khi pascal-vi dịch label (pascal-vi chạy trước pascal-realism)', () => {
  const vi = MATERIALS_UI_VI[FILE].reduce((s, [a, b]) => s.split(a).join(b), library);
  assert.notEqual(vi, library);
  const out = transformRealism(vi, `/x/packages/${FILE}`, [{ source: 'r5b', file: FILE, pairs: RULES[FILE] }]);
  for (const [id, , to] of WOOD_ROUGHNESS) assert.equal(roughnessOf(out, id), to, id);
});
