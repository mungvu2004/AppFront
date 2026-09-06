/**
 * `createPreviewLayer` — lớp vẽ đè của một cử chỉ đang diễn ra.
 *
 * Bốn lời hứa của module được kiểm bằng số, không bằng lời:
 *
 * 1. Vật liệu là vật liệu MƯỢN — lớp này không tạo màu nào, và không giải phóng
 *    cái nó mượn.
 * 2. Không mesh nào của lớp đổ bóng hay nhận bóng: đó là thứ giữ cho bản đồ
 *    bóng khỏi phải vẽ lại mỗi bước kéo.
 * 3. `clear()` trả hình học của chính nó, và chỉ của chính nó.
 * 4. `show()` lần sau thay lần trước — kéo ba mươi bước để lại một nhóm, không
 *    phải ba mươi.
 */

import { BufferGeometry, Group, Mesh, MeshBasicMaterial, type Material } from 'three';
import { describe, expect, it, vi } from 'vitest';

import { normalizeSpatial } from '@/domain/spatial/normalize';
import { toBuildFloorInput } from '@/domain/spatial/toBuildFloorInput';
import type { LevelId } from '@/domain/spatial/types';
import { millimetres } from '@/domain/units/types';
import { createCleanBuildingScenario } from '@/lib/testing/fixtures';
import type { BuildFloorInput } from '@/lib/three/build/floor';
import { tagPart, type BuildPartKind } from '@/lib/three/build/scene';

import { createPreviewLayer } from '../previewLayer';
import { narrowFloorInput } from '../previewModel';

/** Một bức tường thật của bộ mẫu chuẩn, cắt sẵn xuống đúng một bức. */
function oneWall(thicknessMm = 220): BuildFloorInput {
  const spatial = normalizeSpatial(createCleanBuildingScenario().graph);

  for (const id of spatial.byKind.level) {
    const level = toBuildFloorInput(spatial, id as LevelId);
    const wall = level?.walls[0];

    if (level !== null && wall !== undefined) {
      return narrowFloorInput(
        { ...level, walls: [{ ...wall, thicknessMm: millimetres(thicknessMm) }] },
        [wall.id],
      );
    }
  }

  throw new Error('bộ mẫu chuẩn phải có ít nhất một tường');
}

/** Mọi mesh trong một cây. */
function meshesIn(root: Group): readonly Mesh[] {
  const found: Mesh[] = [];

  root.traverse((object) => {
    if (object instanceof Mesh) {
      found.push(object);
    }
  });

  return found;
}

describe('createPreviewLayer', () => {
  it('dựng hình thật và mượn đúng vật liệu người gọi đưa', () => {
    const borrowed = new MeshBasicMaterial();
    const layer = createPreviewLayer({ materialOf: () => borrowed });

    const count = layer.show(oneWall());

    expect(count).toBeGreaterThan(0);
    expect(layer.meshCount()).toBe(count);
    expect(meshesIn(layer.root)).toHaveLength(count);
    expect(meshesIn(layer.root).every((mesh) => mesh.material === borrowed)).toBe(true);

    layer.dispose();

    // Vật liệu mượn KHÔNG bị trả tay: mô hình thật vẫn đang vẽ bằng nó.
    expect(borrowed.userData).toBeDefined();
    borrowed.dispose();
  });

  it('không mesh nào đổ bóng hay nhận bóng — đó là khoản giữ bản đồ bóng đứng yên', () => {
    const layer = createPreviewLayer({ materialOf: () => undefined });

    layer.show(oneWall());

    const meshes = meshesIn(layer.root);

    expect(meshes.length).toBeGreaterThan(0);
    expect(meshes.every((mesh) => !mesh.castShadow)).toBe(true);
    expect(meshes.every((mesh) => !mesh.receiveShadow)).toBe(true);

    layer.dispose();
  });

  it('show() lần sau thay lần trước: ba mươi bước kéo để lại MỘT nhóm', () => {
    const layer = createPreviewLayer({ materialOf: () => undefined });
    const steps = 30;

    for (let step = 0; step < steps; step += 1) {
      layer.show(oneWall(220 + step * 10));
    }

    expect(layer.buildCount()).toBe(steps);
    expect(layer.root.children).toHaveLength(1);

    layer.dispose();

    expect(layer.root.children).toHaveLength(0);
    expect(layer.meshCount()).toBe(0);
  });

  it('clear() trả hình học của chính nó, và không đụng vật liệu mượn', () => {
    const borrowed = new MeshBasicMaterial();
    const disposeSpy = vi.spyOn(borrowed, 'dispose');
    const geometry = new BufferGeometry();
    const geometrySpy = vi.spyOn(geometry, 'dispose');

    const layer = createPreviewLayer({
      materialOf: () => borrowed,
      build: () => {
        const group = new Group();
        const mesh = tagPart(new Mesh(geometry), {
          kind: 'wall' as BuildPartKind,
          entityId: 'W-000000001',
          levelId: 'L-000000001',
        });

        group.add(mesh);

        return group;
      },
    });

    expect(layer.show(oneWall())).toBe(1);
    expect(layer.clear()).toBe(true);

    expect(geometrySpy).toHaveBeenCalledTimes(1);
    expect(disposeSpy).not.toHaveBeenCalled();

    // Không có gì để bỏ thì `clear()` nói thẳng là không có.
    expect(layer.clear()).toBe(false);

    layer.dispose();
    borrowed.dispose();
  });

  it('vật liệu là undefined thì mesh giữ nguyên vật liệu bộ dựng đã đặt', () => {
    const layer = createPreviewLayer({ materialOf: () => undefined });

    layer.show(oneWall());

    const material: Material | Material[] | undefined = meshesIn(layer.root)[0]?.material;

    expect(material).toBeDefined();

    layer.dispose();
  });
});
