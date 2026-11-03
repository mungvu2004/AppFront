import { BackSide, DoubleSide, Group, MeshStandardMaterial, type Plane } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { describe, expect, it } from 'vitest';

import { cutPlaneY } from './cut';
import { capCutMaterial, cutOn, NO_CUT_CONSTANT, syncLowCut } from './cutSync';

type ClipLevel = Group & { isClippingGroup?: boolean; enabled?: boolean; clippingPlanes?: Plane[]; clipIntersection?: boolean; clipShadows?: boolean };

describe('cutSync: đổi chế độ không đổi khoá dựng của three', () => {
  it('nhóm tầng luôn bật, một mặt phẳng; Cắt ↔ Đầy đủ chỉ dời hằng số', () => {
    const level = new Group() as ClipLevel;
    level.position.y = 3;
    level.updateMatrixWorld();
    const registry = { nodes: { get: (id: string) => (id === 'L1' ? level : undefined) }, byType: { level: new Set(['L1']) } };

    syncLowCut(registry, 'up');
    expect(level.enabled).toBe(true);
    const plane = level.clippingPlanes?.[0];
    expect(plane?.constant).toBe(NO_CUT_CONSTANT);

    syncLowCut(registry, 'cutaway');
    syncLowCut(registry, 'up');
    syncLowCut(registry, 'cutaway');
    const fields = () => [level.isClippingGroup, level.enabled, level.clippingPlanes?.length, level.clipIntersection, level.clipShadows];
    const before = fields();
    expect(level.clippingPlanes?.[0]).toBe(plane);
    expect(plane?.constant).toBe(cutPlaneY(3));
    expect(cutOn.value).toBe(1);

    syncLowCut(registry, 'up');
    expect(fields()).toEqual(before);
    expect(before).toEqual([true, true, 1, false, true]);
    expect(level.clippingPlanes?.[0]).toBe(plane);
    expect(plane?.constant).toBe(NO_CUT_CONSTANT);
    expect(cutOn.value).toBe(0);
  });

  it('vá nắp một lần lúc tạo: hai mặt cố định, bóng giữ phía cũ; đổi chế độ không needsUpdate', () => {
    const material = new MeshStandardNodeMaterial();
    expect(capCutMaterial(material)).toBe(material);
    expect(material.side).toBe(DoubleSide);
    expect(material.shadowSide).toBe(BackSide);
    const colorNode = material.colorNode;
    expect(colorNode).not.toBeNull();
    const version = material.version;

    syncLowCut({ nodes: { get: () => undefined }, byType: {} }, 'cutaway');
    syncLowCut({ nodes: { get: () => undefined }, byType: {} }, 'up');
    capCutMaterial(material);
    expect(material.version).toBe(version);
    expect(material.colorNode).toBe(colorNode);

    const glass = new MeshStandardNodeMaterial({ transparent: true });
    capCutMaterial(glass);
    expect(glass.side).not.toBe(DoubleSide);
    const plain = new MeshStandardMaterial();
    capCutMaterial(plain);
    expect(plain.side).not.toBe(DoubleSide);
  });
});
