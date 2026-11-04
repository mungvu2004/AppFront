import { describe, expect, it } from 'vitest';

import { SCENE_PALETTE } from '@/lib/pascal/scenePalette';

import { lowestLevelSlabs, MITER_LIMIT, outsetRing, STUDIO_PALETTE, studioGroundColor } from './studio';

const square: [number, number][] = [
  [0, 0],
  [4, 0],
  [4, 4],
  [0, 4],
];

const round = (ring: [number, number][]) => ring.map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]);

describe('outsetRing', () => {
  it('nới hình vuông ra đều mọi phía, chiều vòng nào cũng vậy', () => {
    const grown = [
      [-1, -1],
      [5, -1],
      [5, 5],
      [-1, 5],
    ];
    expect(round(outsetRing(square, 1))).toEqual(grown);
    expect(round(outsetRing([...square].reverse(), 1))).toEqual([...grown].reverse());
  });

  it('bỏ điểm trùng và giới hạn đỉnh nhọn', () => {
    const spike: [number, number][] = [
      [0, 0],
      [0, 0],
      [10, 0],
      [0, 0.5],
    ];
    const out = outsetRing(spike, 0.1);
    expect(out).toHaveLength(3);
    const [x, y] = out[1]!;
    expect(Math.hypot(x - 10, y)).toBeLessThanOrEqual(0.1 * MITER_LIMIT + 1e-9);
  });
});

describe('lowestLevelSlabs', () => {
  it('chỉ lấy sàn hiện của tầng thấp nhất', () => {
    const nodes = {
      l0: { type: 'level', level: 0 },
      l1: { type: 'level', level: 1 },
      a: { type: 'slab', parentId: 'l0', polygon: square },
      b: { type: 'slab', parentId: 'l1', polygon: square },
      c: { type: 'slab', parentId: 'l0', polygon: square, visible: false },
      d: { type: 'wall', parentId: 'l0' },
    };
    expect(lowestLevelSlabs(nodes)).toEqual([square]);
  });
});

describe('studioGroundColor', () => {
  it('Nắng chiều màu ấm, chủ đề khác giữ xám', () => {
    expect(studioGroundColor('sunset')).toBe(SCENE_PALETTE.studioGroundSunset);
    expect(studioGroundColor('studio')).toBe(STUDIO_PALETTE.ground);
    expect(studioGroundColor('night')).toBe(STUDIO_PALETTE.ground);
  });
});

describe('STUDIO_PALETTE', () => {
  it('đất là xám trung tính sáng (không ngả ấm)', () => {
    const hex = STUDIO_PALETTE.ground.slice(1);
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    expect(Math.max(r!, g!, b!) - Math.min(r!, g!, b!)).toBeLessThanOrEqual(4);
    expect(r!).toBeGreaterThan(190);
  });
});
