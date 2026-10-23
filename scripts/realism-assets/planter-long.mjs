#!/usr/bin/env node
/**
 * Gói 2A (editor-realism): balcony bed for the Pascal `bush` folder (variants planter/shrub = long beds
 * along the railing, stretched along x). A long Poly Haven planter box + a row of real alpha-leaf
 * plants (foliage of potted_plant_02, pot/soil dropped), so the w:h:d ratio is close to the vendor
 * bush box (3 : 1.04 : 1.01) and the stretch distorts little.
 *
 *   node scripts/realism-assets/planter-long.mjs <dlDir>
 *     <dlDir>/planter_box_02/planter_box_02_1k.gltf, <dlDir>/potted_plant_02/potted_plant_02_1k.gltf (+ textures/)
 *
 * The plant mesh is instanced (several nodes share one mesh): file stays small, rendered tris =
 * box + instances x plant <= 12k.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { center, dedup, draco, flatten, join as joinPrims, mergeDocuments, prune, textureCompress, unpartition, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

import { OUT_DIR, thumbnailOf } from '../gen-decor-models.mjs';
import { dropLeaves, glbWithExternalImages, isLeaf, simplifyPrim, triCount, withAlpha } from './plants.mjs';

export const FOLDER = 'planter-long';
const BOX = { id: 'planter_box_02', scale: [1.9, 0.9, 1.4], tris: 1500 };
const PLANT = { id: 'potted_plant_02', leaves: 1400, rest: 150, leafRatio: 0.25, height: 0.47 };
/**
 * x along the box, z, yaw (rad), scale factor: irregular so the copies don't read as clones.
 * review2 perf: 5 plants x ~6 bồn ở F1 làm khung dGPU 7 → 14–21 ms (lá alpha MASK, hai mặt, cả lượt bóng)
 * → 3 cây, lá ít hơn, và gộp mọi cây thành một lưới mỗi vật liệu (flatten + join) để bớt lệnh vẽ.
 */
const SPOTS = [
  [-0.72, 0.03, 0.3, 1.1],
  [0.02, -0.04, 2.6, 1.0],
  [0.74, 0.04, 4.9, 1.08],
];
const BUDGET = 12000;

const nameTextures = (doc) => {
  for (const t of doc.getRoot().listTextures())
    t.setName(t.getURI().replace(/^.*\//, '').replace(/_1k\.\w+$/, ''));
};

const main = async (dl) => {
  if (!dl) throw new Error('usage: planter-long.mjs <dlDir>');
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });
  await MeshoptSimplifier.ready;

  // --- plant: foliage + stems of potted_plant_02 (pot + dirt dropped), leaves with real alpha ---
  const doc = await io.read(join(dl, PLANT.id, `${PLANT.id}_1k.gltf`));
  doc.getRoot().getAsset().generator = 'AppFront realism-assets/planter-long';
  nameTextures(doc);
  for (const n of doc.getRoot().listNodes()) if (n.getMesh() && /_(pot|dirt)$/.test(n.getName())) n.dispose();
  await doc.transform(prune());
  await withAlpha(doc, join(dl, PLANT.id), PLANT.id);
  await doc.transform(weld());
  const prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
  const leaf = prims.filter((p) => isLeaf(p.getMaterial()));
  const rest = prims.filter((p) => !isLeaf(p.getMaterial()));
  for (const p of leaf) simplifyPrim(p, PLANT.leafRatio, 0.01);
  console.log('leaves kept', dropLeaves(leaf, PLANT.leaves, 7));
  const restTris = rest.reduce((n, p) => n + triCount(p), 0);
  for (const p of rest) simplifyPrim(p, Math.min(1, PLANT.rest / restTris), 0.2);

  const scene = doc.getRoot().listScenes()[0];
  const plantNodes = scene.listChildren();
  const pb = getBounds(scene);
  const plantH = pb.max[1] - pb.min[1];
  const plantTris = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).reduce((n, p) => n + triCount(p), 0);

  // --- box: planter_box_02 stretched to a long, deeper bed ---
  const boxDoc = await io.read(join(dl, BOX.id, `${BOX.id}_1k.gltf`));
  nameTextures(boxDoc);
  await boxDoc.transform(weld());
  for (const m of boxDoc.getRoot().listMeshes())
    for (const p of m.listPrimitives()) simplifyPrim(p, BOX.tris / triCount(p), 0.01);
  const boxTris = boxDoc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).reduce((n, p) => n + triCount(p), 0);
  const map = mergeDocuments(doc, boxDoc);
  const boxRoot = doc.createNode('box').setScale(BOX.scale);
  for (const s2 of boxDoc.getRoot().listScenes()) for (const n of map.get(s2).listChildren()) boxRoot.addChild(n);
  for (const s2 of doc.getRoot().listScenes()) if (s2 !== scene) s2.dispose();
  scene.addChild(boxRoot);
  const bb = getBounds(boxRoot);
  const soilY = bb.max[1] - 0.03;

  // --- soil: one flat quad just under the rim ---
  const [x0, x1, z0, z1] = [bb.min[0] + 0.06, bb.max[0] - 0.06, bb.min[2] + 0.06, bb.max[2] - 0.06];
  const buffer = doc.getRoot().listBuffers()[0];
  const soil = doc
    .createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setBuffer(buffer)
      .setArray(new Float32Array([x0, soilY, z0, x1, soilY, z0, x1, soilY, z1, x0, soilY, z1])))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setBuffer(buffer)
      .setArray(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0])))
    .setIndices(doc.createAccessor().setType('SCALAR').setBuffer(buffer).setArray(new Uint32Array([0, 2, 1, 0, 3, 2])))
    .setMaterial(doc.createMaterial('soil').setBaseColorFactor([0.09, 0.065, 0.045, 1]).setRoughnessFactor(1).setMetallicFactor(0));
  scene.addChild(doc.createNode('soil').setMesh(doc.createMesh('soil').addPrimitive(soil)));

  // --- plant instances: spot (T, yaw, S) -> offset (plant base centre to origin) -> shared meshes ---
  const cx = (pb.min[0] + pb.max[0]) / 2;
  const cz = (pb.min[2] + pb.max[2]) / 2;
  for (const [i, [x, z, yaw, k]] of SPOTS.entries()) {
    const s = (PLANT.height / plantH) * k;
    const spot = doc
      .createNode(`plant_${i}`)
      .setTranslation([x, soilY - 0.02, z])
      .setRotation([0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)])
      .setScale([s, s, s]);
    const off = doc.createNode(`plant_${i}_base`).setTranslation([-cx, -pb.min[1], -cz]);
    spot.addChild(off);
    for (const n of plantNodes)
      off.addChild(
        doc.createNode(n.getName()).setMesh(n.getMesh()).setTranslation(n.getTranslation())
          .setRotation(n.getRotation()).setScale(n.getScale()),
      );
    scene.addChild(spot);
  }
  for (const n of plantNodes) n.dispose();

  const tris = boxTris + 2 + SPOTS.length * plantTris;
  if (tris > BUDGET) throw new Error(`${FOLDER}: ${tris} tris over budget ${BUDGET}`);
  await doc.transform(
    unpartition(),
    flatten(),
    joinPrims({ keepNamed: false }),
    center({ pivot: 'below' }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 80 }),
    dedup(),
    prune(),
    draco({ method: 'edgebreaker', quantizePosition: 14 }),
  );
  doc.createExtension(KHRDracoMeshCompression).setRequired(true);
  const dir = join(OUT_DIR, FOLDER);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const glb = await glbWithExternalImages(io, doc, dir);
  writeFileSync(join(dir, 'model.glb'), glb);
  writeFileSync(join(dir, 'thumbnail.webp'), await thumbnailOf('Planter'));
  const back = await io.read(join(dir, 'model.glb'));
  const b = getBounds(back.getRoot().listScenes()[0]);
  const size = b.max.map((v, i) => Math.round((v - b.min[i]) * 1000) / 1000);
  const lf = back.getRoot().listMaterials().find(isLeaf);
  if (lf?.getAlphaMode() !== 'MASK') throw new Error(`${FOLDER}: leaf not MASK`);
  console.log(
    `${FOLDER}: box ${boxTris} + ${SPOTS.length} x plant ${plantTris} = ${tris} rendered tris, glb ${glb.byteLength} B, size ${size.join(' x ')} m`,
  );
};

await main(process.argv[2]);
