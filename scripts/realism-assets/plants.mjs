#!/usr/bin/env node
/**
 * Card C1 (editor-realism step 2): indoor plants with real alpha leaves (Poly Haven CC0).
 *
 *   node scripts/realism-assets/plants.mjs <cinemaModels> <homepageModels>
 *     <cinemaModels>/fern_02/fern_02_1k.gltf  (Poly Haven 1k glTF, F:/App-review/homepage-v6/cinema/assets/models)
 *     <homepageModels>/plant.glb               (potted_plant_01 already reduced by homepage scripts/fetch-models.mjs;
 *                                               the 1k glTF is ~160k tris, too dense to simplify cleanly)
 *
 * Writes assets/appfront-items/{plant-ph,planter-ph}/ : Draco model.glb + sibling .webp
 * textures (embedded images would load as blob: URLs, which CSP connect-src forbids)
 * + thumbnail.webp. Leaf materials keep alphaMode MASK (alphaTest), see LICENSES-plants.md.
 */
import { Buffer } from 'node:buffer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import { Format, NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { center, dedup, draco, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

import { OUT_DIR, thumbnailOf } from '../gen-decor-models.mjs';

/** Poly Haven id -> AppFront folder. `ratio` = meshopt target share of indices (<= 3k tris). */
export const PLANTS = {
  potted_plant_01: {
    folder: 'plant-ph',
    label: 'Plant',
    ratio: 0.88,
    file: (_, home) => join(home, 'plant.glb'),
    key: { material: 'potted_plant_01_leaves', dark: 28, green: true },
  },
  potted_plant_04: {
    folder: 'planter-ph',
    label: 'Planter',
    ratio: 0.3,
    file: (cinema) => join(cinema, 'potted_plant_04', 'potted_plant_04_1k.gltf'),
    key: { material: 'potted_plant_04', dark: 48, green: false },
  },
};
const MAX_TRIS = 3000;

/**
 * The local Poly Haven copies ship the leaf diffuse as JPG (no alpha), so a MASK material would
 * render opaque leaf cards. Rebuild the cut-out from the diffuse: leaves sit on near-black
 * padding (and, for potted_plant_01, orange dilation rays -> `green` keeps G-dominant pixels).
 * blur + threshold = morphological opening, drops thin padding streaks.
 * ponytail: colour-key alpha, swap for the real Poly Haven *_alpha map if it is ever downloaded.
 */
const keyAlpha = async (doc, { material, dark, green }) => {
  const mat = doc.getRoot().listMaterials().find((m) => m.getName() === material);
  const tex = mat?.getBaseColorTexture();
  if (!tex) throw new Error(`no base colour texture on ${material}`);
  const { data, info } = await sharp(Buffer.from(tex.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const mask = Buffer.alloc(width * height);
  for (let i = 0; i < mask.length; i++) {
    const [r, g, b] = [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
    const on = Math.max(r, g, b) > dark && (!green || (g >= r * 0.95 && g >= b));
    mask[i] = on ? 255 : 0;
  }
  const raw1 = { raw: { width, height, channels: 1 } };
  const opened = await sharp(mask, raw1).blur(2).threshold(128).blur(0.8).extractChannel(0).raw().toBuffer();
  const png = await sharp(data, { raw: { width, height, channels: 3 } }).joinChannel(opened, raw1).png().toBuffer();
  tex.setImage(new Uint8Array(png)).setMimeType('image/png');
  mat.setAlphaMode('MASK').setAlphaCutoff(0.5).setDoubleSided(true);
};

const trisOf = (doc) =>
  doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives())
    .reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);

/** Same GLB layout as gen-decor-models.mjs glbWithExternalImages (copied: that one is not exported). */
const glbWithExternalImages = async (io, doc, dir) => {
  for (const t of doc.getRoot().listTextures()) t.setURI(`${t.getName()}.webp`);
  const { json, resources } = await io.writeJSON(doc, { format: Format.GLTF, basename: 'model' });
  if (json.buffers?.length !== 1) throw new Error(`expected 1 buffer, got ${json.buffers?.length}`);
  for (const img of json.images ?? []) writeFileSync(join(dir, img.uri), resources[img.uri]);
  const bin = Buffer.from(resources[json.buffers[0].uri]);
  delete json.buffers[0].uri;
  const pad = (b, fill) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4, fill)]);
  const chunk = (data, type) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(data.length, 0);
    h.writeUInt32LE(type, 4);
    return [h, data];
  };
  const jsonChunk = pad(Buffer.from(JSON.stringify(json)), 0x20);
  const binChunk = pad(bin, 0);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);
  return Buffer.concat([head, ...chunk(jsonChunk, 0x4e4f534a), ...chunk(binChunk, 0x004e4942)]);
};

const main = async (cinema, home) => {
  if (!cinema || !home) throw new Error('usage: plants.mjs <cinemaModels> <homepageModels>');
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });
  await MeshoptSimplifier.ready;
  for (const [id, { folder, label, ratio, file, key }] of Object.entries(PLANTS)) {
    const doc = await io.read(file(cinema, home));
    doc.getRoot().getAsset().generator = 'AppFront realism-assets/plants';
    const before = trisOf(doc);
    await keyAlpha(doc, key);
    await doc.transform(
      weld(),
      simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.02 }),
      center({ pivot: 'below' }),
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 80 }),
      dedup(),
      prune(),
    );
    const tris = trisOf(doc);
    if (tris > MAX_TRIS) throw new Error(`${folder}: ${tris} tris > ${MAX_TRIS}, lower ratio`);
    const mats = doc.getRoot().listMaterials();
    if (!mats.some((m) => m.getAlphaMode() === 'MASK')) throw new Error(`${folder}: no MASK leaf material`);
    await doc.transform(draco({ method: 'edgebreaker', quantizePosition: 14 }));
    doc.createExtension(KHRDracoMeshCompression).setRequired(true);
    const dir = join(OUT_DIR, folder);
    mkdirSync(dir, { recursive: true });
    const glb = await glbWithExternalImages(io, doc, dir);
    writeFileSync(join(dir, 'model.glb'), glb);
    writeFileSync(join(dir, 'thumbnail.webp'), await thumbnailOf(label));
    const b = getBounds(doc.getRoot().listScenes()[0]);
    const size = b.max.map((v, i) => Math.round((v - b.min[i]) * 1000) / 1000);
    const matInfo = mats.map((m) => `${m.getName()}:${m.getAlphaMode()}${m.getAlphaMode() === 'MASK' ? m.getAlphaCutoff() : ''}`);
    console.log(`${folder} <- ${id}: ${before} -> ${tris} tris, glb ${glb.byteLength} B, size ${size.join(' x ')} m, ${matInfo.join(' ')}`);
  }
};

await main(process.argv[2], process.argv[3]);
