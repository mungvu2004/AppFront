/** `LIBRARY_MATERIAL_IDS` phải khớp `MATERIAL_CATALOG` của vendor — vendor đổi thì bài này đỏ và in danh sách mới. */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { LIBRARY_MATERIAL_IDS } from '../libraryMaterialIds';

const vendorIds = (): string[] => {
  const source = readFileSync(resolve(process.cwd(), 'vendor/pascal/packages/core/src/material-library.ts'), 'utf8');
  const start = source.indexOf('export const MATERIAL_CATALOG');
  const end = source.indexOf('\n]', start);

  return [...source.slice(start, end).matchAll(/^ {4}id: '([^']+)'/gm)].map((match) => match[1] ?? '');
};

describe('LIBRARY_MATERIAL_IDS', () => {
  it('khớp từng id của MATERIAL_CATALOG trong vendor, đúng thứ tự', () => {
    expect(vendorIds().length).toBeGreaterThan(0);
    expect([...LIBRARY_MATERIAL_IDS]).toEqual(vendorIds());
  });
});
