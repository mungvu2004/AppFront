#!/usr/bin/env node
/**
 * Card P1 (editor-realism): indoor plants with REAL alpha leaves (Poly Haven CC0, 1k glTF + *_alpha_1k.png).
 *
 *   node scripts/realism-assets/plants.mjs <dlDir>
 *     <dlDir>/<asset>/<asset>_1k.gltf + textures/  (https://polyhaven.com/a/<asset>, gltf 1k download)
 *
 * Writes assets/appfront-items/{plant-ph,planter-ph}/ : Draco model.glb + sibling .webp textures
 * (embedded images load as blob: URLs, which CSP connect-src forbids) + thumbnail.webp.
 * Leaves: diffuse + the real alpha map -> RGBA webp, MASK 0.5, double sided.
 * Triangle budget: leaves are separate cards, so after a mild meshopt pass whole leaf islands are
 * dropped at random (seeded) until the leaf budget fits; trunk/pot is simplified normally.
 */
import { Buffer } from 'node:buffer';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { Format, NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import {
  center,
  compactPrimitive,
  dedup,
  draco,
  mergeDocuments,
  prune,
  textureCompress,
  unpartition,
  weld,
} from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

import { OUT_DIR, thumbnailOf } from '../gen-decor-models.mjs';

/** Poly Haven id -> AppFront folder; budgets in triangles (leaves + rest <= card limit). */
export const PLANTS = {
  // The pachira file holds 4 pot-less trees side by side: keep the tallest (`_d`), scale it and
  // plant it in the pot + soil of potted_plant_02 (same CC0 set).
  pachira_aquatica_01: {
    folder: 'plant-ph',
    label: 'Plant',
    leaves: 6000,
    rest: 1800,
    leafRatio: 0.3,
    keep: /_d$/,
    scale: 0.8,
    pot: { id: 'potted_plant_02', nodes: /_(pot|dirt)$/, soilY: 0.3 },
  },
  potted_plant_02: {
    folder: 'planter-ph',
    label: 'Planter',
    leaves: 3200,
    rest: 1600,
    leafRatio: 0.6,
  },
};

const SOIL_TRIS = 400;
export const isLeaf = (mat) => /leaves$/.test(mat?.getName() ?? '');
export const triCount = (p) => p.getIndices().getCount() / 3;
const trisOf = (doc) =>
  doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives())
    .reduce((n, p) => n + triCount(p), 0);

/** mulberry32: deterministic leaf selection. */
const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const simplifyPrim = (p, ratio, error) => {
  const idx = Uint32Array.from(p.getIndices().getArray());
  const pos = Float32Array.from(p.getAttribute('POSITION').getArray());
  const target = Math.max(3, Math.floor((idx.length * ratio) / 3) * 3);
  const [out] = MeshoptSimplifier.simplify(idx, pos, 3, target, error, []);
  p.getIndices().setArray(new Uint32Array(out));
};

/** Islands of a triangle list (union-find on shared vertices) -> per-triangle island id. */
const islandsOf = (idx, n) => {
  const par = Int32Array.from({ length: n }, (_, i) => i);
  const find = (x) => {
    while (par[x] !== x) x = par[x] = par[par[x]];
    return x;
  };
  for (let t = 0; t < idx.length; t += 3)
    for (const k of [1, 2]) par[find(idx[t + k])] = find(idx[t]);
  return Array.from({ length: idx.length / 3 }, (_, t) => find(idx[t * 3]));
};

export const dropLeaves = (prims, budget, seed) => {
  // Shuffle every leaf island (seeded), keep them in that order until the budget is spent:
  // a uniform random subset over the whole crown, never a partial leaf.
  const rand = rng(seed);
  const all = prims.map((p) =>
    islandsOf(p.getIndices().getArray(), p.getAttribute('POSITION').getCount()),
  );
  const sizes = new Map();
  all.forEach((isl, pi) =>
    isl.forEach((id) => sizes.set(`${pi}:${id}`, (sizes.get(`${pi}:${id}`) ?? 0) + 1)),
  );
  const order = [...sizes.keys()];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const kept = new Set();
  let used = 0;
  for (const k of order) if (used + sizes.get(k) <= budget) kept.add(k), (used += sizes.get(k));
  prims.forEach((p, pi) => {
    const idx = p.getIndices().getArray();
    const out = [];
    all[pi].forEach(
      (id, t) => kept.has(`${pi}:${id}`) && out.push(idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]),
    );
    p.getIndices().setArray(new Uint32Array(out));
  });
  return `${kept.size}/${order.length} islands`;
};

/** Leaf diffuse + real alpha map -> RGBA PNG (webp-compressed later). */
export const withAlpha = async (doc, dir, id) => {
  const mat = doc.getRoot().listMaterials().find(isLeaf);
  const alphaFile = join(dir, 'textures', `${id}_leaves_alpha_1k.png`);
  const tex = mat.getBaseColorTexture();
  const { data, info } = await sharp(Buffer.from(tex.getImage()))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const a = await sharp(readFileSync(alphaFile))
    .resize(info.width, info.height)
    .extractChannel(0)
    .raw()
    .toBuffer();
  const raw1 = { raw: { width: info.width, height: info.height, channels: 1 } };
  const png = await sharp(data, { raw: { ...info, channels: 3 } })
    .joinChannel(a, raw1)
    .png()
    .toBuffer();
  tex.setImage(new Uint8Array(png)).setMimeType('image/png');
  mat.setAlphaMode('MASK').setAlphaCutoff(0.5).setDoubleSided(true);
};

/** Same GLB layout as gen-decor-models.mjs glbWithExternalImages (not exported there). */
export const glbWithExternalImages = async (io, doc, dir) => {
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

export const dropNodes = (doc, keep) => {
  for (const n of doc.getRoot().listNodes())
    if (n.getMesh() && !keep.test(n.getName())) n.dispose();
};

/** Keep one tree, move its trunk base to the origin at soil height, merge the pot document in. */
const pot = async (io, doc, dl, { keep, scale, pot: p }) => {
  dropNodes(doc, keep);
  const trunk = doc
    .getRoot()
    .listNodes()
    .filter((n) => n.getMesh() && !isLeaf(n.getMesh().listPrimitives()[0].getMaterial()));
  const base = [0, 0, 0];
  let count = 0;
  for (const n of trunk)
    for (const prim of n.getMesh().listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const t = n.getTranslation();
      for (let i = 0; i < pos.getCount(); i++) {
        const v = pos.getElement(i, []);
        if (v[1] + t[1] < 0.05) (base[0] += v[0] + t[0]), (base[2] += v[2] + t[2]), count++;
      }
    }
  const [bx, bz] = [base[0] / count, base[2] / count];
  for (const n of doc.getRoot().listNodes()) {
    if (!n.getMesh()) continue;
    const t = n.getTranslation();
    n.setTranslation([(t[0] - bx) * scale, t[1] * scale + p.soilY, (t[2] - bz) * scale]);
    n.setScale(n.getScale().map((v) => v * scale));
  }
  const potDoc = await io.read(join(dl, p.id, `${p.id}_1k.gltf`));
  dropNodes(potDoc, p.nodes);
  await potDoc.transform(prune());
  for (const t of potDoc.getRoot().listTextures())
    t.setName(
      t
        .getURI()
        .replace(/^.*\//, '')
        .replace(/_1k\.\w+$/, ''),
    );
  const scene = doc.getRoot().listScenes()[0];
  const map = mergeDocuments(doc, potDoc);
  for (const s2 of potDoc.getRoot().listScenes())
    for (const n of map.get(s2).listChildren()) scene.addChild(n);
  for (const s2 of doc.getRoot().listScenes()) if (s2 !== scene) s2.dispose();
  await doc.transform(prune(), unpartition());
};

const main = async (dl) => {
  if (!dl) throw new Error('usage: plants.mjs <dlDir>');
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });
  await MeshoptSimplifier.ready;
  for (const [id, cfg] of Object.entries(PLANTS)) {
    const { folder, label, leaves, rest, leafRatio } = cfg;
    const src = join(dl, id);
    const doc = await io.read(join(src, `${id}_1k.gltf`));
    doc.getRoot().getAsset().generator = 'AppFront realism-assets/plants';
    for (const t of doc.getRoot().listTextures())
      t.setName(
        t
          .getURI()
          .replace(/^.*\//, '')
          .replace(/_1k\.\w+$/, ''),
      );
    const before = trisOf(doc);
    if (cfg.pot) await pot(io, doc, dl, cfg);
    await withAlpha(doc, src, id);
    await doc.transform(weld());
    const prims = doc
      .getRoot()
      .listMeshes()
      .flatMap((m) => m.listPrimitives());
    const leafPrims = prims.filter((p) => isLeaf(p.getMaterial()));
    const solid = prims.filter((p) => !isLeaf(p.getMaterial()));
    for (const p of leafPrims) simplifyPrim(p, leafRatio, 0.01);
    console.log(folder, 'leaves kept', dropLeaves(leafPrims, leaves, 1));
    // Soil pebbles (~54k tris of tiny stones) get a fixed small share; trunk + pot split the rest.
    const nodeOf = new Map(
      doc
        .getRoot()
        .listNodes()
        .flatMap((n) => (n.getMesh()?.listPrimitives() ?? []).map((p) => [p, n.getName()])),
    );
    const isSoil = (p) => /_dirt$/.test(nodeOf.get(p) ?? '');
    const solidTris = solid.reduce((n, p) => n + triCount(p), 0);
    const otherTris = solid.filter((p) => !isSoil(p)).reduce((n, p) => n + triCount(p), 0);
    const soilBudget = solidTris === otherTris ? 0 : SOIL_TRIS;
    for (const p of solid)
      simplifyPrim(
        p,
        isSoil(p) ? SOIL_TRIS / triCount(p) : Math.min(1, (rest - soilBudget) / otherTris),
        0.2,
      );
    console.log(
      folder,
      'solid',
      solidTris,
      '->',
      solid.reduce((n, p) => n + triCount(p), 0),
    );
    for (const p of prims) compactPrimitive(p);
    await doc.transform(
      center({ pivot: 'below' }),
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 80 }),
      dedup(),
      prune(),
    );
    const tris = trisOf(doc);
    if (tris > leaves + rest + 200) throw new Error(`${folder}: ${tris} tris over budget`);
    await doc.transform(draco({ method: 'edgebreaker', quantizePosition: 14 }));
    doc.createExtension(KHRDracoMeshCompression).setRequired(true);
    const dir = join(OUT_DIR, folder);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const glb = await glbWithExternalImages(io, doc, dir);
    writeFileSync(join(dir, 'model.glb'), glb);
    writeFileSync(join(dir, 'thumbnail.webp'), await thumbnailOf(label));
    // Re-read the written file: MASK must survive Draco + the GLB repack, leaf webp must keep alpha.
    const back = await io.read(join(dir, 'model.glb'));
    const mats = back.getRoot().listMaterials();
    const leaf = mats.find(isLeaf);
    if (leaf?.getAlphaMode() !== 'MASK' || leaf.getAlphaCutoff() !== 0.5)
      throw new Error(`${folder}: leaf not MASK 0.5`);
    const meta = await sharp(Buffer.from(leaf.getBaseColorTexture().getImage())).metadata();
    if (!meta.hasAlpha) throw new Error(`${folder}: leaf texture lost alpha`);
    const b = getBounds(back.getRoot().listScenes()[0]);
    const size = b.max.map((v, i) => Math.round((v - b.min[i]) * 1000) / 1000);
    console.log(
      `${folder} <- ${id}: ${before} -> ${trisOf(back)} tris (leaves ${leafPrims.reduce((n, p) => n + triCount(p), 0)}), glb ${glb.byteLength} B, size ${size.join(' x ')} m, ${mats.map((m) => `${m.getName()}:${m.getAlphaMode()}`).join(' ')}, leaf webp ${meta.width}x${meta.height} alpha`,
    );
  }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main(process.argv[2]);
