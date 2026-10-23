import { describe, expect, it, vi } from 'vitest';
import { MeshStandardMaterial, Texture } from 'three';
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
    expect(itemKindOf('double-bed', null, undefined)).toBe('bedding');
    expect(itemKindOf('fridge', null, undefined)).toBe('steel');
    expect(itemKindOf('closet', 'slot_body', 'library:wood-finewood27')).toBe('wood');
    expect(itemKindOf('kitchen-cabinet', 'slot_h', 'library:metal-brass')).toBe('metal');
    expect(itemKindOf('kitchen-cabinet', 'slot_c', 'scene:am_ap_cabinet')).toBeNull();
    expect(itemKindOf('table-lamp', null, undefined)).toBeNull();
  });
  it('gói 4A: gương, màn hình, sứ, kim loại nhỏ', () => {
    expect(itemKindOf('round-mirror', 'glass', undefined)).toBe('mirror');
    expect(itemKindOf('round-mirror', 'frame', undefined)).toBeNull();
    expect(itemKindOf('television', 'screen', undefined)).toBe('screen');
    expect(itemKindOf('television', 'frame', undefined)).toBe('matte');
    expect(itemKindOf('computer', 'screen', undefined)).toBe('screen');
    expect(itemKindOf('toilet', 'toilet', undefined)).toBe('porcelain');
    expect(itemKindOf('toilet', 'buttons', undefined)).toBe('porcelain');
    expect(itemKindOf('bathroom-sink', null, undefined)).toBe('porcelain');
    expect(itemKindOf('bathtub', 'tub', undefined)).toBe('porcelain');
    expect(itemKindOf('bathtub', 'fixtures', undefined)).toBe('metal');
    expect(itemKindOf('shower-square', 'fixtures', undefined)).toBe('metal');
    expect(itemKindOf('shower-square', 'glass', undefined)).toBeNull();
    expect(itemKindOf('toilet-paper', 'holder', undefined)).toBe('metal');
    for (const f of ['kitchen-cabinet', 'kitchen-shelf', 'dresser', 'office-table', 'microwave', 'bedside-table'])
      expect(itemKindOf(f, 'handle', undefined)).toBe('metal');
    for (const f of ['dining-chair', 'dining-table', 'coffee-table', 'lounge-chair', 'floor-lamp', 'bedside-table', 'stove', 'ironing-board'])
      expect(itemKindOf(f, 'legs', undefined)).toBe('metal');
    // Chân gán ref gỗ → gỗ, không ép kim loại.
    expect(itemKindOf('dining-table', 'legs', 'library:wood-oak')).toBe('wood');
    expect(itemKindOf('frying-pan', 'handle', undefined)).toBeNull();
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
  it('gốc nạp ảnh sau khi clone → clone theo kịp (đồ gỗ không ra trắng)', () => {
    vi.useFakeTimers();
    clearItemMaterialCache();
    const base = new MeshStandardMaterial({ roughness: 0.5 });
    const a = tuneItemMaterial(base, { ...ctx, src: '/items/dining-table/model.glb', ref: 'library:wood-finewood27' }) as MeshStandardMaterial;
    expect(a).not.toBe(base);
    expect(a.map).toBeNull();
    const tex = new Texture();
    base.map = tex;
    base.normalMap = tex;
    vi.advanceTimersByTime(300);
    expect(a.map).toBe(tex);
    expect(a.normalMap).toBe(tex);
    vi.useRealTimers();
  });
  it('gỗ nhân tint, gốc giữ màu', () => {
    clearItemMaterialCache();
    const base = new MeshStandardMaterial({ roughness: 0.5 });
    const a = tuneItemMaterial(base, { ...ctx, src: '/items/dining-table/model.glb', ref: 'library:wood-oak' }) as MeshStandardMaterial;
    expect(a.color.r).toBeCloseTo(0.8);
    expect(a.color.b).toBeCloseTo(0.95);
    expect(base.color.r).toBe(1);
  });
  it('gương: kim loại bóng, đè màu trắng; khe có ref giữ màu', () => {
    clearItemMaterialCache();
    const base = new MeshStandardMaterial({ color: '#e3e3e3', roughness: 0.5 });
    const a = tuneItemMaterial(base, { src: '/items/round-mirror/model.glb', slotId: 'glass', textures: true }) as MeshStandardMaterial;
    expect(a.metalness).toBe(0.5);
    expect(a.roughness).toBeLessThan(0.1);
    expect(a.color.getHexString()).toBe('dfe4e6');
    expect(base.metalness).toBe(0);
    const tv = tuneItemMaterial(base, { src: '/items/television/model.glb', slotId: 'screen', textures: true }) as MeshStandardMaterial;
    expect(tv.color.getHexString()).toBe('0b0c0e');
    const picked = tuneItemMaterial(base, { src: '/items/toilet/model.glb', slotId: 'toilet', ref: 'library:preset-white', textures: true }) as MeshStandardMaterial;
    expect(picked.roughness).toBe(0.12);
    expect(picked.color.getHexString()).toBe('e3e3e3');
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
  it('gói 4B: tay nắm của mẫu tủ sinh bằng code là kim loại', () => {
    for (const f of ['closet-gen', 'kitchen-counter-gen', 'kitchen-cabinet-gen', 'kitchen-shelf-gen', 'tv-stand-gen'])
      expect(itemKindOf(f, 'handle', undefined), f).toBe('metal');
  });
  it('gương: kính thư viện trong suốt vẫn thành mặt gương đục (không nhìn xuyên ra đáy đen)', () => {
    clearItemMaterialCache();
    const glass = new MeshStandardMaterial({ transparent: true, opacity: 0.15, roughness: 0.05 });
    const a = tuneItemMaterial(glass, { ...ctx, src: '/items/round-mirror/model.glb', slotId: 'glass', ref: 'library:preset-glass' }) as MeshStandardMaterial;
    expect(a).not.toBe(glass);
    expect(a.transparent).toBe(false);
    expect(a.opacity).toBe(1);
    const shower = new MeshStandardMaterial({ transparent: true, opacity: 0.15, roughness: 0.05 });
    expect(tuneItemMaterial(shower, { ...ctx, src: '/items/shower-square/model.glb', slotId: 'glass', ref: 'library:preset-glass' })).toBe(shower);
  });
  it('gương: ref kim loại của phong cách không đè loại gương', () => {
    expect(itemKindOf('round-mirror', 'glass', 'library:metal-brushed')).toBe('mirror');
    expect(itemKindOf('dining-table', 'legs', 'library:wood-finewood27')).toBe('wood');
  });
});
