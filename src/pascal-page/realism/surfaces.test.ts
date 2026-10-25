import { MeshStandardMaterial } from 'three';
import { afterEach, describe, expect, it } from 'vitest';

import { DAY_THEME_ID, NIGHT_THEME_ID } from '../renderLook';
import { HALO_RADIUS, haloFalloff, haloLevel, haloRadius } from './halo';
import { DEFAULT_REALISM_FLAGS, useRealism } from './store';
import { tuneWallPaint, WALL_NORMAL_SCALE } from './wallFinish';

const setMaterials = (materials: boolean) => useRealism.setState({ flags: { ...DEFAULT_REALISM_FLAGS, materials } });

describe('bề mặt dùng chung', () => {
  afterEach(() => setMaterials(DEFAULT_REALISM_FLAGS.materials));

  it('sơn trơn → clone có normal rất nhẹ, cache; kim loại/cờ tắt giữ nguyên', () => {
    setMaterials(true);
    const paint = new MeshStandardMaterial({ roughness: 0.9 });
    const tuned = tuneWallPaint(paint) as MeshStandardMaterial;
    expect(tuned).not.toBe(paint);
    expect(tuned.normalScale.x).toBe(WALL_NORMAL_SCALE);
    expect(tuneWallPaint(paint)).toBe(tuned);
    const metal = new MeshStandardMaterial({ roughness: 0.9, metalness: 1 });
    expect(tuneWallPaint(metal)).toBe(metal);
    expect(tuneWallPaint(null)).toBeNull();
    setMaterials(false);
    const other = new MeshStandardMaterial({ roughness: 0.9 });
    expect(tuneWallPaint(other)).toBe(other);
  });

  it('quầng: đêm theo đèn, Ban ngày tắt', () => {
    setMaterials(true);
    expect(haloLevel(2, NIGHT_THEME_ID)).toBeCloseTo(1);
    expect(haloLevel(1, NIGHT_THEME_ID)).toBeCloseTo(0.5);
    expect(haloLevel(2, DAY_THEME_ID)).toBe(0);
  });

  it('quầng: lõi nhỏ đậm, đuôi ~1/d², về 0 ở mép; bán kính co theo √mức', () => {
    expect(haloFalloff(0)).toBe(1);
    expect(haloFalloff(0.25)).toBeLessThan(0.25); // ra khỏi lõi đã tắt nhanh
    expect(haloFalloff(0.5) / haloFalloff(0.25)).toBeLessThan(0.3); // gấp đôi khoảng cách ≈ 1/4 trở xuống
    expect(haloFalloff(1)).toBe(0);
    expect(haloRadius(1)).toBeCloseTo(HALO_RADIUS);
    expect(haloRadius(0.25)).toBeCloseTo(HALO_RADIUS / 2);
    expect(haloRadius(0)).toBe(0);
  });
});
