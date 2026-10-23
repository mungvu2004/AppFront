#!/usr/bin/env node
/**
 * Gói 1 (review2): thảm chữ nhật Pascal bỏ tua. Tua là các miếng phẳng to bằng bàn tay ở hai đầu
 * (khe `slot_b`, gốc ở |x| = 1,20 m, mút ở 1,36–1,39 m) → trông như bìa nâu. Giữ nguyên khe slot_a/slot_b để phong cách tô màu.
 *
 *   node scripts/realism-assets/carpet.mjs
 *
 * Đọc vendor/pascal/assets/items/rectangular-carpet/model.glb → assets/appfront-items/rug-nf/.
 */
import { join } from 'node:path';

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { center, compactPrimitive, draco, prune } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { mkdirSync, writeFileSync } from 'node:fs';

import { OUT_DIR, thumbnailOf } from '../gen-decor-models.mjs';

const SRC = 'vendor/pascal/assets/items/rectangular-carpet/model.glb';
/** Thân thảm rộng ±1,25 m; tam giác có đỉnh ngoài mức này = tua. */
const BODY_HALF_X = 1.3;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});
const doc = await io.read(SRC);
let dropped = 0;
for (const prim of doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())) {
  const pos = prim.getAttribute('POSITION').getArray();
  const idx = prim.getIndices();
  const keep = [];
  const a = idx.getArray();
  for (let t = 0; t < a.length; t += 3) {
    const tri = [a[t], a[t + 1], a[t + 2]];
    if (tri.some((i) => Math.abs(pos[i * 3]) > BODY_HALF_X)) dropped++;
    else keep.push(...tri);
  }
  idx.setArray(new Uint32Array(keep));
  compactPrimitive(prim);
}
doc.getRoot().getAsset().generator = 'AppFront realism-assets/carpet';
await doc.transform(prune(), center({ pivot: 'below' }), draco({ method: 'edgebreaker', quantizePosition: 14 }));
doc.createExtension(KHRDracoMeshCompression).setRequired(true);
const dir = join(OUT_DIR, 'rug-nf');
mkdirSync(dir, { recursive: true });
const glb = await io.writeBinary(doc);
writeFileSync(join(dir, 'model.glb'), glb);
writeFileSync(join(dir, 'thumbnail.webp'), await thumbnailOf('Rug'));
console.log(`rug-nf: ${glb.byteLength} B, dropped ${dropped} fringe tris`);
