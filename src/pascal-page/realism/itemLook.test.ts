import { describe, expect, it } from 'vitest';
import { MeshStandardMaterial } from 'three';
import { folderOf, itemKindOf, tunedRoughness } from './itemLook';
import { clearItemMaterialCache, tuneItemMaterial } from './itemMaterials';
import { useRealism } from './store';

describe('itemLook', () => {
  it('đọc thư mục mẫu', () => {
    expect(folderOf('/items/sofa/model.glb')).toBe('sofa');
    expect(folderOf('https://x/pascal/appfront-items/ottoman/model.glb')).toBe('ottoman');
    expect(folderOf(undefined)).toBeNull();
  });
  it('phân loại theo thư mục/khe/ref', () => {
    expect(itemKindOf('sofa', 'slot_body', 'library:preset-taupe')).toBe('fabric');
    expect(itemKindOf('double-bed', null, undefined)).toBe('fabric');
    expect(itemKindOf('fridge', null, undefined)).toBe('matte');
    expect(itemKindOf('closet', 'slot_body', 'library:wood-finewood27')).toBe('wood');
    expect(itemKindOf('kitchen-cabinet', 'slot_h', 'library:metal-brass')).toBe('metal');
    expect(itemKindOf('kitchen-cabinet', 'slot_c', 'scene:am_ap_cabinet')).toBeNull();
    expect(itemKindOf('table-lamp', null, undefined)).toBeNull();
  });
  it('roughness gỗ ×1.6 kẹp ≥ 0.45', () => {
    expect(tunedRoughness('wood', 0.2)).toBe(0.45);
    expect(tunedRoughness('wood', 0.5)).toBeCloseTo(0.8);
    expect(tunedRoughness('fabric', 0.9)).toBe(0.95);
  });
});

describe('tuneItemMaterial', () => {
  const ctx = { src: '/items/sofa/model.glb', slotId: 's', ref: 'library:preset-taupe', textures: true };
  it('clone có cache, giữ màu, không sửa bản gốc', () => {
    clearItemMaterialCache();
    useRealism.setState({ flags: { ...useRealism.getState().flags, materials: true } });
    const base = new MeshStandardMaterial({ color: '#8f7a64', roughness: 0.9 });
    const a = tuneItemMaterial(base, ctx) as MeshStandardMaterial;
    expect(a).not.toBe(base);
    expect(a.roughness).toBe(0.95);
    expect(a.color.getHexString()).toBe('8f7a64');
    expect(base.roughness).toBe(0.9);
    expect(tuneItemMaterial(base, ctx)).toBe(a);
  });
  it('cờ tắt / textures=false / kính → y cũ', () => {
    const base = new MeshStandardMaterial({ roughness: 0.9 });
    expect(tuneItemMaterial(base, { ...ctx, textures: false })).toBe(base);
    const glass = new MeshStandardMaterial({ transparent: true, opacity: 0.25 });
    expect(tuneItemMaterial(glass, ctx)).toBe(glass);
    useRealism.setState({ flags: { ...useRealism.getState().flags, materials: false } });
    expect(tuneItemMaterial(base, ctx)).toBe(base);
    useRealism.setState({ flags: { ...useRealism.getState().flags, materials: true } });
  });
});
