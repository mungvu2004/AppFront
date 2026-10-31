import { describe, expect, it } from 'vitest';

import { NIGHT_THEME_ID } from '../renderLook';
import {
  KEY_SHADOW_RADIUS_MAX,
  KEY_SHADOW_RADIUS_MIN,
  keyShadowRadius,
  planRoomLights,
  polygonArea,
  polygonCentroid,
  ROOM_LIGHT_HEIGHT_M,
  ROOM_LIGHT_MAX,
  ROOM_LIGHT_MAX_CD,
  ROOM_LIGHT_MIN_CD,
  ROOM_LIGHT_RANGE_MAX_M,
  roomLightIntensity,
  roomLightRange,
  roomLightsOn,
} from './roomLights';

const rect = (x: number, z: number, w: number, d: number): [number, number][] => [
  [x, z],
  [x + w, z],
  [x + w, z + d],
  [x, z + d],
];

describe('roomLights', () => {
  it('bán kính PCF theo khung bóng, kẹp [min, max]', () => {
    // khung 24 m / 2048 px ≈ 1,2 cm/texel → 0,1 m ≈ 8,5 texel → kẹp max
    expect(keyShadowRadius(12, 2048)).toBe(KEY_SHADOW_RADIUS_MAX);
    // khung 100 m / 1024 px ≈ 10 cm/texel → 1 texel → kẹp min
    expect(keyShadowRadius(50, 1024)).toBe(KEY_SHADOW_RADIUS_MIN);
    expect(keyShadowRadius(30, 2048)).toBeCloseTo(0.1 / (60 / 2048));
    expect(keyShadowRadius(0, 2048)).toBe(KEY_SHADOW_RADIUS_MIN);
  });

  it('chỉ bật ở Buổi tối, Rendered, mức Vừa/Cao', () => {
    expect(roomLightsOn(NIGHT_THEME_ID, 'rendered', 'medium')).toBe(true);
    expect(roomLightsOn(NIGHT_THEME_ID, 'rendered', 'high')).toBe(true);
    expect(roomLightsOn(NIGHT_THEME_ID, 'rendered', 'low')).toBe(false);
    expect(roomLightsOn(NIGHT_THEME_ID, 'solid', 'high')).toBe(false);
    expect(roomLightsOn('studio', 'rendered', 'high')).toBe(false);
  });

  it('diện tích và trọng tâm đa giác', () => {
    expect(polygonArea(rect(1, 2, 4, 3))).toBeCloseTo(12);
    const c = polygonCentroid(rect(1, 2, 4, 3));
    expect(c.x).toBeCloseTo(3);
    expect(c.z).toBeCloseTo(3.5);
    expect(polygonCentroid([[0, 0], [2, 0], [4, 0]]).x).toBeCloseTo(2);
  });

  it('cường độ theo diện tích, kẹp', () => {
    expect(roomLightIntensity(1)).toBe(ROOM_LIGHT_MIN_CD);
    expect(roomLightIntensity(500)).toBe(ROOM_LIGHT_MAX_CD);
    expect(roomLightIntensity(16)).toBeGreaterThan(ROOM_LIGHT_MIN_CD);
  });

  it('tầm tới góc xa nhất, kẹp theo phòng', () => {
    const poly = rect(0, 0, 4, 3);
    const r = roomLightRange(poly, { x: 2, z: 1.5 });
    expect(r).toBeGreaterThan(Math.hypot(2.5, ROOM_LIGHT_HEIGHT_M));
    expect(r).toBeLessThan(Math.hypot(2.5, ROOM_LIGHT_HEIGHT_M) * 1.3);
    expect(roomLightRange(rect(0, 0, 40, 40), { x: 20, z: 20 })).toBe(ROOM_LIGHT_RANGE_MAX_M);
  });

  it('chọn phòng lớn trước, bỏ ban công và đa giác suy biến, tối đa N', () => {
    const rooms = Array.from({ length: 15 }, (_, i) => ({ polygon: rect(i * 10, 0, 2 + i, 3) }));
    const plan = planRoomLights(rooms);
    expect(plan).toHaveLength(ROOM_LIGHT_MAX);
    expect(plan[0]!.index).toBe(14);
    expect(plan.map((p) => p.index)).not.toContain(0);
    const few = planRoomLights([
      { polygon: rect(0, 0, 3, 3), name: 'Ban công' },
      { polygon: [[0, 0], [1, 1]] },
      { polygon: rect(0, 0, 3, 4), name: 'Phòng ngủ' },
    ]);
    expect(few.map((p) => p.index)).toEqual([2]);
    expect(few[0]!.x).toBeCloseTo(1.5);
  });
});
