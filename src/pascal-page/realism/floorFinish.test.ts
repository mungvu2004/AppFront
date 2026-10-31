import { MeshStandardMaterial } from 'three';
import { afterEach, describe, expect, it } from 'vitest';

import { SCENE_STYLES } from '@/lib/pascal/sceneStyles';

import {
  detailFactor,
  FLOOR_FINISHES,
  type FloorFinish,
  floorFinishOf,
  floorFinishPreset,
  groutAt,
  linearMean,
  repeatOf,
  tuneFloorFinish,
} from './floorFinish';
import { DEFAULT_REALISM_FLAGS, useRealism } from './store';

const setMaterials = (materials: boolean) => useRealism.setState({ flags: { ...DEFAULT_REALISM_FLAGS, materials } });
const finishOf = (id: string): FloorFinish => {
  const finish = FLOOR_FINISHES[id];
  if (!finish) throw new Error(`thiếu ${id}`);
  return finish;
};
const MARBLE = 'library:flooring-statuarettowhite';
const preset = { maps: {}, mapProperties: { repeatX: 1, repeatY: 1, normalScaleX: 1, normalScaleY: 1, color: 'x' } };

describe('sàn đúng cỡ thật', () => {
  afterEach(() => setMaterials(DEFAULT_REALISM_FLAGS.materials));

  it('mọi vật liệu sàn của 5 phong cách có trong bảng', () => {
    for (const style of Object.values(SCENE_STYLES)) {
      for (const ref of Object.values(style.floor)) expect(floorFinishOf(ref), ref).not.toBeNull();
    }
    expect(floorFinishOf('scene:mat_style_am_ap_wall')).toBeNull();
    expect(floorFinishOf('library:fabric-linen')).toBeNull();
  });

  it('bảng hợp lệ: cỡ 0,5–4 m, normal ≤ 0,6, contrast 0..1', () => {
    for (const f of Object.values(FLOOR_FINISHES)) {
      expect(f.sizeM).toBeGreaterThanOrEqual(0.5);
      expect(f.sizeM).toBeLessThanOrEqual(4);
      expect(f.normalScale).toBeLessThanOrEqual(0.6);
      expect(f.contrast).toBeGreaterThanOrEqual(0);
      expect(f.contrast).toBeLessThanOrEqual(1);
    }
  });

  it('vân: điểm sáng trung bình → đúng màu đích; contrast 0 → phẳng', () => {
    const f = finishOf('flooring-woodparquet76');
    expect(detailFactor(linearMean(f), f)).toBeCloseTo(1);
    expect(detailFactor(linearMean(f) * 2, f)).toBeCloseTo(1 + f.contrast);
    expect(detailFactor(0, { ...f, contrast: 0 })).toBe(1);
    expect(detailFactor(0, f)).toBeGreaterThanOrEqual(0);
  });

  it('ron 2,5 mm trên lưới 0,8 m', () => {
    expect(groutAt(0.8, 0.4, 0.8)).toBe(1);
    expect(groutAt(0.4, 1.6005, 0.8)).toBe(1);
    expect(groutAt(0.4, 0.4, 0.8)).toBe(0);
    expect(groutAt(0.81, 0.4, 0.8)).toBe(0);
  });

  it('preset: repeat = 1 / cạnh, normal theo bảng, giữ khoá khác; cờ tắt / ngoài bảng → nguyên', () => {
    setMaterials(true);
    const out = floorFinishPreset(MARBLE, preset);
    const f = finishOf('flooring-statuarettowhite');
    expect(out).not.toBe(preset);
    expect(out.mapProperties.repeatX).toBeCloseTo(repeatOf(f));
    expect(out.mapProperties.normalScaleY).toBe(f?.normalScale);
    expect(out.mapProperties.color).toBe('x');
    expect(preset.mapProperties.repeatX).toBe(1);
    expect(floorFinishPreset('library:fabric-linen', preset)).toBe(preset);
    setMaterials(false);
    expect(floorFinishPreset(MARBLE, preset)).toBe(preset);
  });

  it('vật liệu không phải node PBR → giữ nguyên', () => {
    setMaterials(true);
    const mat = new MeshStandardMaterial();
    expect(tuneFloorFinish(MARBLE, mat)).toBe(mat);
    expect(mat.userData).toEqual({});
    expect(tuneFloorFinish(MARBLE, null)).toBeNull();
  });
});
