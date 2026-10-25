import { describe, expect, it } from 'vitest';

import { DAY_THEME_ID } from '../renderLook';
import { insetPoint, paneFromBox, pickWindows, windowIntensity, windowLightsOn, WINDOW_LIGHT_MAX, WINDOW_LIGHT_PER_M2 } from './windowLight';

describe('windowLight', () => {
  it('chỉ bật ở Ban ngày, chủ đề sáng, mức Vừa/Cao', () => {
    expect(windowLightsOn(DAY_THEME_ID, 'light', 'medium')).toBe(true);
    expect(windowLightsOn(DAY_THEME_ID, 'light', 'high')).toBe(true);
    expect(windowLightsOn(DAY_THEME_ID, 'light', 'low')).toBe(false);
    expect(windowLightsOn(DAY_THEME_ID, 'dark', 'high')).toBe(false);
    expect(windowLightsOn('other-theme', 'light', 'high')).toBe(false);
  });

  it('chọn tối đa N cửa gần camera nhất, gần trước', () => {
    const panes = Array.from({ length: 12 }, (_, i) => ({ x: 12 - i, y: 1, z: 0, area: 1, nx: 0, nz: 1 }));
    const picked = pickWindows(panes, { x: 0, y: 1, z: 0 });
    expect(picked).toHaveLength(WINDOW_LIGHT_MAX);
    expect(picked[0]).toBe(11);
    expect(picked).not.toContain(0);
    expect(pickWindows(panes.slice(0, 3), { x: 0, y: 0, z: 0 })).toHaveLength(3);
  });

  it('cường độ theo diện tích ô kính, có trần', () => {
    expect(windowIntensity(1.5)).toBeCloseTo(1.5 * WINDOW_LIGHT_PER_M2);
    expect(windowIntensity(100)).toBe(windowIntensity(6));
    expect(windowIntensity(-1)).toBe(0);
  });

  it('ô cửa từ hộp bao: rộng theo cạnh ngang lớn hơn', () => {
    const p = paneFromBox({ x: 0, y: 1, z: 0 }, { x: 0.1, y: 2.5, z: 1.2 });
    expect(p.area).toBeCloseTo(1.2 * 1.5);
    expect(p.y).toBeCloseTo(1.75);
    expect([p.nx, p.nz]).toEqual([1, 0]);
  });

  it('lùi đèn vào phía trong nhà theo pháp tuyến, giữ độ cao', () => {
    const p = paneFromBox({ x: 9.9, y: 1, z: 2 }, { x: 10, y: 2.5, z: 3.2 }); // tường đông x=10
    const q = insetPoint(p, { x: 5, z: 2 }, 0.7);
    expect(q.x).toBeCloseTo(p.x - 0.7);
    expect(q.z).toBeCloseTo(p.z);
    expect(q.y).toBeCloseTo(p.y);
    const r = insetPoint(paneFromBox({ x: 0, y: 1, z: -0.1 }, { x: 1.2, y: 2, z: 0 }), { x: 0, z: 5 }, 0.7); // tường bắc
    expect(r.z).toBeCloseTo(-0.05 + 0.7);
  });
});
