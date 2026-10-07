import { describe, expect, it } from 'vitest';

import viMessages from './vi.json';

/** Đơn vị đo là ký hiệu, không phải câu — A6 không viết hoa chữ đầu của nó (NO-397). */
const CAPITALISED_UNIT = /^(?:Mm|Cm|M|Km|Kg|Px|Ml|Mm²|Cm²|M²|M³)$/u;

function collectStrings(node: unknown, path: string, out: [string, string][]): [string, string][] {
  if (typeof node === 'string') {
    out.push([path, node]);
  } else if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      collectStrings(value, path === '' ? key : `${path}.${key}`, out);
    }
  }
  return out;
}

describe('vi.json — đơn vị đo', () => {
  it('không khoá nào chỉ chứa một đơn vị viết hoa chữ đầu', () => {
    const offenders = collectStrings(viMessages, '', [])
      .filter(([, value]) => CAPITALISED_UNIT.test(value))
      .map(([path, value]) => `${path}=${value}`);

    expect(offenders).toEqual([]);
  });
});
