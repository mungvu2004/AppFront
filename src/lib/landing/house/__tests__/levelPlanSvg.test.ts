import { describe, expect, it } from 'vitest';

import { LANDING_HOUSE, levelPlanSvg } from '..';

const { plan } = LANDING_HOUSE;
const roomIds = (svg: string): string[] => [...svg.matchAll(/data-room="([^"]+)"/g)].map((m) => m[1] ?? '');

describe('levelPlanSvg', () => {
  it('vẽ mỗi tầng khác nhau, chỉ từ phòng có trong dữ liệu của tầng đó', () => {
    const svgs = plan.levels.map((l) => levelPlanSvg(LANDING_HOUSE, l.id));
    expect(plan.levels.length).toBe(3);
    expect(new Set(svgs).size).toBe(3);
    plan.levels.forEach((l, i) => {
      const ids = roomIds(svgs[i] ?? '');
      expect(ids.length).toBeGreaterThan(0);
      expect(ids.sort()).toEqual(plan.rooms.filter((r) => r.levelId === l.id).map((r) => r.id).sort());
    });
  });

  it('ba tầng cùng một khung để các hình thẳng hàng', () => {
    const box = (svg: string) => /viewBox="([^"]+)"/.exec(svg)?.[1];
    const boxes = plan.levels.map((l) => box(levelPlanSvg(LANDING_HOUSE, l.id)));
    expect(new Set(boxes).size).toBe(1);
  });
});
