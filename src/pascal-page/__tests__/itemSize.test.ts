import { describe, expect, it } from 'vitest';

import { formatMm, isRigidItem, parseMm, resizedScale, sizeMmOf } from '../itemSize';

describe('itemSize', () => {
  it('mm = dimensions × scale × 1000, làm tròn; định dạng nhóm nghìn kiểu Việt', () => {
    expect(sizeMmOf([1.2, 2, 0.6], [1.5, 1, 1])).toEqual([1800, 2000, 600]);
    expect(formatMm(12345)).toBe('12.345');
    expect(formatMm(600)).toBe('600');
  });

  it('đọc số người gõ: dấu chấm nghìn, khoảng trắng, dấu phẩy thập phân', () => {
    expect(parseMm('1.200')).toBe(1200);
    expect(parseMm(' 1 200 ')).toBe(1200);
    expect(parseMm('12,6')).toBe(13);
    expect(parseMm('')).toBeNaN();
    expect(parseMm('abc')).toBeNaN();
  });

  it('giữ tỉ lệ nhân đều ba trục', () => {
    const r = resizedScale([1, 1, 1], [1, 2, 1], 0, 2000, true, true);
    expect(r).toEqual({ ok: true, scale: [2, 4, 2], clamped: false });
  });

  it('không giữ tỉ lệ: đồ cứng kẹp méo mặt bằng ở [0,64; 1,5625], cao và dãy tủ thì không', () => {
    const rigid = resizedScale([1, 1, 1], [1, 1, 1], 0, 2000, false, true);
    expect(rigid.ok && rigid.scale[0]).toBeCloseTo(1.5625);
    expect(rigid.ok && rigid.clamped).toBe(true);
    const shallow = resizedScale([1, 1, 1], [1, 1, 1], 2, 500, false, true);
    expect(shallow.ok && shallow.scale[2]).toBeCloseTo(0.64);
    expect(shallow.ok && shallow.clamped).toBe(true);
    expect(resizedScale([1, 1, 1], [1, 1, 1], 1, 3000, false, true)).toEqual({ ok: true, scale: [1, 3, 1], clamped: false });
    expect(resizedScale([1, 1, 1], [1, 1, 1], 0, 3000, false, false)).toEqual({ ok: true, scale: [3, 1, 1], clamped: false });
    expect(isRigidItem('wardrobe')).toBe(false);
    expect(isRigidItem('bed')).toBe(true);
    expect(isRigidItem(undefined)).toBe(true);
  });

  it('chặn ≤ 0, quá 10.000 mm, NaN, và giữ tỉ lệ đẩy trục khác quá trần', () => {
    for (const mm of [0, -5, 10_001, Number.NaN]) expect(resizedScale([1, 1, 1], [1, 1, 1], 0, mm, true, true).ok).toBe(false);
    expect(resizedScale([1, 3, 1], [1, 1, 1], 0, 4000, true, true).ok).toBe(false);
  });
});
