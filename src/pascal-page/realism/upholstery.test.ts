import { describe, expect, it } from 'vitest';
import { Color, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, PlaneGeometry } from 'three';
import { UPHOLSTERY_PALETTE } from '@/lib/pascal/scenePalette';
import { clearItemMaterialCache, tuneItemMaterial } from './itemMaterials';
import { useRealism } from './store';
import {
  applyUpholstery,
  compensate,
  geometryArea,
  MAX_GAIN,
  meanLinear,
  pickUpholstery,
  styleOfFabricRef,
  tagUpholstery,
} from './upholstery';

const enableMaterials = () => useRealism.setState({ flags: { ...useRealism.getState().flags, materials: true } });

describe('upholstery thuần', () => {
  it('chọn vải lớn nhất được nhuộm, bỏ khung/chân và vải người chọn', () => {
    const areas = new Map([
      ['frame', { area: 9, tag: null }],
      ['seat', { area: 4, tag: { kind: 'fabric' as const, recolour: true } }],
      ['cushion', { area: 2, tag: { kind: 'fabric' as const, recolour: true } }],
      ['userPick', { area: 7, tag: { kind: 'fabric' as const, recolour: false } }],
      ['legs', { area: 5, tag: { kind: 'metal' as const, recolour: true } }],
    ]);
    expect(pickUpholstery(areas)).toBe('seat');
    expect(pickUpholstery(new Map([['frame', { area: 1, tag: null }]]))).toBeNull();
  });
  it('ref vải của phong cách → phong cách', () => {
    expect(styleOfFabricRef('library:fabric-linen')).toBe('am-ap');
    expect(styleOfFabricRef('library:leather-calf')).toBe('go-am');
    expect(styleOfFabricRef('library:fabric-silk')).toBeNull();
    expect(styleOfFabricRef(undefined)).toBeNull();
  });
  it('bù trung bình ảnh: màu × trung bình = đích, kẹp hệ số', () => {
    const k = compensate([0.4, 0.2, 0.1], [0.5, 0.5, 0.5]);
    expect(k[0] * 0.5).toBeCloseTo(0.4);
    expect(k[2] * 0.5).toBeCloseTo(0.1);
    expect(compensate([1, 1, 1], [0, 0.01, 1])[0]).toBe(MAX_GAIN);
  });
  it('trung bình tuyến tính của byte sRGB', () => {
    expect(meanLinear([255, 255, 255, 255, 0, 0, 0, 255])).toEqual([0.5, 0.5, 0.5]);
  });
  it('diện tích tam giác', () => {
    expect(geometryArea(new PlaneGeometry(2, 3))).toBeCloseTo(6);
  });
});

describe('applyUpholstery', () => {
  it('nhuộm vải lớn nhất theo phong cách, giữ khung', () => {
    enableMaterials();
    const seat = new MeshStandardMaterial({ color: 0x884422 });
    const frame = new MeshStandardMaterial({ color: 0x332211 });
    tagUpholstery(seat, 'fabric', 'library:fabric-cotton', 'sofa');
    const meshes = [new Mesh(new PlaneGeometry(2, 1), seat), new Mesh(new PlaneGeometry(3, 3), frame)];
    applyUpholstery(meshes, true);
    expect(seat.color.getHexString()).toBe(new Color(UPHOLSTERY_PALETTE.hienDai).getHexString());
    expect(frame.color.getHexString()).toBe('332211');
  });
  it('thảm không nhuộm; textures=false bỏ qua', () => {
    enableMaterials();
    const rug = new MeshStandardMaterial({ color: 0x884422 });
    tagUpholstery(rug, 'fabric', undefined, 'rectangular-carpet');
    applyUpholstery([new Mesh(new PlaneGeometry(2, 2), rug)], true);
    expect(rug.color.getHexString()).toBe('884422');
    const bed = new MeshStandardMaterial({ color: 0x884422 });
    tagUpholstery(bed, 'bedding', undefined, 'double-bed');
    applyUpholstery([new Mesh(new PlaneGeometry(2, 2), bed)], false);
    expect(bed.color.getHexString()).toBe('884422');
  });
});

describe('sheen vải', () => {
  it('vải → physical có sheen, giữ màu; gỗ giữ standard', () => {
    clearItemMaterialCache();
    enableMaterials();
    const ctx = { src: '/items/sofa/model.glb', slotId: 's', ref: 'library:preset-taupe', textures: true };
    const fabric = tuneItemMaterial(new MeshStandardMaterial({ color: 0x8f7a64, roughness: 0.9 }), ctx);
    expect(fabric).toBeInstanceOf(MeshPhysicalMaterial);
    expect((fabric as MeshPhysicalMaterial).sheen).toBe(0.5);
    expect((fabric as MeshPhysicalMaterial).color.getHexString()).toBe('8f7a64');
    expect(fabric.userData.upholstery).toEqual({ kind: 'fabric', recolour: true });
    const wood = tuneItemMaterial(new MeshStandardMaterial({ roughness: 0.5 }), { ...ctx, src: '/items/dining-table/model.glb', ref: 'library:wood-oak' });
    expect(wood).not.toBeInstanceOf(MeshPhysicalMaterial);
  });
});
