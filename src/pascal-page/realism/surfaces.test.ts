import { MeshStandardMaterial } from 'three';
import { afterEach, describe, expect, it } from 'vitest';

import { DAY_THEME_ID, NIGHT_THEME_ID } from '../renderLook';
import { haloLevel } from './halo';
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
});
