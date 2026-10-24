import { Color, FrontSide, MeshLambertMaterial, MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';

import { GLASS_ROUGHNESS, glassTwinParams, isGlossy, isLambertGlass } from '../reflectRules';

describe('kính Lambert nhận phản chiếu', () => {
  it('nhận diện kính Lambert, bỏ Lambert đục và Standard', () => {
    expect(isLambertGlass(new MeshLambertMaterial({ transparent: true, opacity: 0.35 }))).toBe(true); // vendor glassMaterial
    expect(isLambertGlass({ isMeshLambertNodeMaterial: true, transparent: true, opacity: 0.25, name: '' })).toBe(true); // glazing
    expect(isLambertGlass(Object.assign(new MeshLambertMaterial(), { name: 'm_glass_door' }))).toBe(true);
    expect(isLambertGlass(new MeshLambertMaterial({ transparent: true, opacity: 0.9 }))).toBe(false);
    expect(isLambertGlass(new MeshLambertMaterial())).toBe(false);
    expect(isLambertGlass(new MeshStandardMaterial({ transparent: true, opacity: 0.3 }))).toBe(false);
    expect(isLambertGlass(null)).toBe(false);
  });

  it('bản thay giữ màu/opacity/mặt và đủ bóng để gắn probe', () => {
    const src = new MeshLambertMaterial({ color: '#e0f2fe', transparent: true, opacity: 0.35, side: FrontSide, depthWrite: false });
    const twin = new MeshStandardMaterial(glassTwinParams(src));
    expect(twin.color.equals(new Color('#e0f2fe'))).toBe(true);
    expect([twin.opacity, twin.transparent, twin.side, twin.depthWrite]).toEqual([0.35, true, FrontSide, false]);
    expect([twin.roughness, twin.metalness]).toEqual([GLASS_ROUGHNESS, 0]);
    expect(isGlossy(twin)).toBe(true);
  });
});
