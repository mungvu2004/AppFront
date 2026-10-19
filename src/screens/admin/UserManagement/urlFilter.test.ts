/** RV5#19: bộ lọc trên URL chỉ nhận khoá riêng của bảng nhãn, không nhận khoá kế thừa từ prototype. */

import { describe, expect, it } from 'vitest';

import { FILTER_ALL } from './types';
import { urlFilterOf } from './useUserManagement';

const LABELS = { admin: 'Quản trị', viewer: 'Người xem' } as const;

describe('urlFilterOf', () => {
  it('nhận vai có thật', () => {
    expect(urlFilterOf('viewer', LABELS)).toBe('viewer');
  });

  it('?role=toString hay __proto__ rơi về "tất cả"', () => {
    expect(urlFilterOf('toString', LABELS)).toBe(FILTER_ALL);
    expect(urlFilterOf('__proto__', LABELS)).toBe(FILTER_ALL);
    expect(urlFilterOf(null, LABELS)).toBe(FILTER_ALL);
  });
});
