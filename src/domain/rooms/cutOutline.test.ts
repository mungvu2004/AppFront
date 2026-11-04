import { describe, expect, it } from 'vitest';

import type { Point } from '@/domain/spatial/types';

import { computeArea } from './area';
import { cutOutlineByStroke } from './cutOutline';

const at = (x: number, y: number) => ({ x, y }) as Point;
const area = (ring: readonly Point[]) => computeArea(ring as never);
const room = [at(100, 100), at(3900, 100), at(3900, 5900), at(100, 5900)];
/* Chữ L: phòng khách 4×4 m cộng ban công 2×1,5 m bên phải. */
const ell = [at(0, 0), at(4000, 0), at(4000, 2500), at(6000, 2500), at(6000, 4000), at(0, 4000)];

describe('cutOutlineByStroke', () => {
  it('nét từ tường sang tường: hai phần, tổng diện tích giữ nguyên, đầu nét trên tim tường vẫn nhận', () => {
    const parts = cutOutlineByStroke(room, at(0, 3000), at(4000, 3000));

    expect(parts).not.toBeNull();
    expect(area(parts?.[0] ?? []) + area(parts?.[1] ?? [])).toBeCloseTo(area(room), 2);
  });

  it('ngăn ban công khỏi phòng chữ L, nét đi đúng qua một đỉnh', () => {
    const parts = cutOutlineByStroke(ell, at(4000, 2500), at(4000, 4000));

    expect(parts?.map((part) => area(part)).sort((a, b) => a - b)).toEqual([3, 16]);
  });

  it('nét cụt, nét đi lố, nét ngoài phòng, phần cắt quá nhỏ: không cắt', () => {
    expect(cutOutlineByStroke(room, at(0, 3000), at(2000, 3000))).toBeNull();
    expect(cutOutlineByStroke(room, at(-3000, 3000), at(4000, 3000))).toBeNull();
    expect(cutOutlineByStroke(room, at(5000, 0), at(5000, 6000))).toBeNull();
    expect(cutOutlineByStroke(room, at(150, 0), at(150, 6000))).toBeNull();
  });
});
