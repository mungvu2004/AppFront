import { describe, expect, it } from 'vitest';

import { SCENE_PALETTE, STUDIO_GROUND_SUNSET_LINEAR } from '@/lib/pascal/scenePalette';

import { applyStudioGround, lowestLevelSlabs, MITER_LIMIT, outsetRing, STUDIO_PALETTE } from './studio';

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

describe('applyStudioGround', () => {
  const written = (themeId: string) => {
    const calls: unknown[] = [];
    applyStudioGround({ set: (hex) => calls.push(hex), setRGB: (...rgb) => calls.push(rgb) }, themeId);
    return calls[0];
  };
  it('Nắng chiều ghi màu HDR ấm, chủ đề khác giữ xám', () => {
    expect(written('sunset')).toEqual([...STUDIO_GROUND_SUNSET_LINEAR]);
    expect(written('studio')).toBe(STUDIO_PALETTE.ground);
    expect(written('night')).toBe(STUDIO_PALETTE.ground);
  });
  it('qua chỉnh màu + ACES (phơi sáng 1) ra gần đích trên ảnh, lệch ≤ 4/255', () => {
    // Cùng công thức `gradeRgb` của vendor post-processing và ACESFilmic của three.
    const encode = (c: number) => Math.round((c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) * 255);
    const mul = (m: number[][], v: number[]) => m.map((r) => r[0]! * v[0]! + r[1]! * v[1]! + r[2]! * v[2]!);
    const contrast = STUDIO_GROUND_SUNSET_LINEAR.map((v) => (v / 0.18) ** 1.05 * 0.18);
    const luma = 0.2126 * contrast[0]! + 0.7152 * contrast[1]! + 0.0722 * contrast[2]!;
    const graded = contrast.map((v) => luma + (v - luma) * 1.1);
    const rrt = (c: number) => (c * (c + 0.0245786) - 0.000090537) / (c * (0.983729 * c + 0.432951) + 0.238081);
    const input = mul([[0.59719, 0.35458, 0.04823], [0.076, 0.90834, 0.01566], [0.0284, 0.13383, 0.83777]], graded.map((v) => v / 0.6));
    const output = mul([[1.60475, -0.53108, -0.07367], [-0.10208, 1.10813, -0.00605], [-0.00327, -0.07276, 1.07602]], input.map(rrt));
    const target = [1, 3, 5].map((i) => parseInt(SCENE_PALETTE.studioGroundSunset.slice(i, i + 2), 16));
    output.forEach((v, i) => expect(Math.abs(encode(v) - target[i]!)).toBeLessThanOrEqual(4));
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
