/**
 * Mẫu trang trí AppFront (FE3D-FIX-004 D): mọi thư mục có GLB + ảnh nhỏ, hộp bao GLB khớp dòng
 * APPFRONT_MODELS (đáy y = 0, tâm x/z), khe vật liệu đúng tên, và bộ sinh thủ tục cho ra đúng byte cũ.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { describe, expect, it } from 'vitest';

import { APPFRONT_MODELS } from '../../src/lib/pascal/furnitureCatalog';
import { OUT_DIR, POLYHAVEN, PROCEDURAL } from '../gen-decor-models.mjs';

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });

const SLOTS = {
  curtain: ['slot_fabric', 'slot_metal'],
  pillow: ['slot_fabric'],
  'throw-blanket': ['slot_fabric'],
  'wall-sconce': ['slot_metal', 'slot_shade'],
};

describe('gen-decor-models', () => {
  const folders = [...Object.keys(PROCEDURAL), ...Object.values(POLYHAVEN).map((p) => p.folder)];

  it('mỗi mẫu sinh ra / chuyển đổi đều có dòng catalog AppFront và ngược lại', () => {
    expect(folders.sort()).toEqual(Object.keys(APPFRONT_MODELS).sort());
  });

  it.each(folders)('%s: hộp bao GLB = dimensions của catalog (±5 mm), đáy y = 0, tâm x/z', async (folder) => {
    const doc = await io.read(join(OUT_DIR, folder, 'model.glb'));
    const { min, max } = getBounds(doc.getRoot().listScenes()[0]);
    const size = max.map((v, i) => v - min[i]);
    const dims = APPFRONT_MODELS[folder].dimensions;
    size.forEach((v, i) => expect(Math.abs(v - dims[i]), `${folder} trục ${i}`).toBeLessThan(0.005));
    expect(Math.abs(min[1])).toBeLessThan(0.002);
    expect(Math.abs(min[0] + max[0])).toBeLessThan(0.004);
    expect(Math.abs(min[2] + max[2])).toBeLessThan(0.004);
    const thumb = readFileSync(join(OUT_DIR, folder, 'thumbnail.webp'));
    expect(thumb.subarray(8, 12).toString()).toBe('WEBP');
    if (SLOTS[folder]) expect(doc.getRoot().listMaterials().map((m) => m.getName()).sort()).toEqual(SLOTS[folder]);
  });
});
