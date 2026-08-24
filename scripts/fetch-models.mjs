/**
 * Tải và xử lý mô hình `.glb` CC0 cho các món nội thất trên màn đăng nhập.
 *
 * Nguồn duy nhất hiện tại là Poly Haven — mọi asset ở đó phát hành CC0 1.0
 * (https://polyhaven.com/license), không cần ghi công. MANIFEST bên dưới là hồ
 * sơ đầy đủ: file đích, asset gốc, giấy phép, và ngân sách xử lý của từng món.
 *
 * Mỗi mô hình đi qua cùng một dây chuyền gltf-transform:
 *
 *   dedup → flatten → weld → simplify (meshoptimizer, tới ≤ maxTris)
 *         → xoay quanh trục y nếu hướng gốc lệch quy ước glTF (+z là mặt trước)
 *         → texture ≤ 512 px, nén webp (sharp) → prune → nén Draco
 *
 * Đích `public/models/` đã gitignore — repo không chứa binary. Thiếu file thì
 * món thủ tục tự thay (thiết kế của `placement.ts`), nên script này là bước
 * dựng môi trường tuỳ chọn, như `pnpm draco`. Bộ giải mã Draco phải có sẵn
 * (`pnpm draco`) thì trình duyệt mới mở được kết quả.
 *
 * Chạy: `node scripts/fetch-models.mjs [tên...]` — không tham số là làm tất cả.
 * File tải về được đệm ở thư mục tạm của máy nên chạy lại không tốn mạng.
 */
import { mkdirSync, existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { compactPrimitive, dedup, draco, flatten, prune, textureCompress, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

/* -------------------------------------------------------------------------- */
/* Hồ sơ mô hình.                                                              */
/* -------------------------------------------------------------------------- */

const LICENSE = 'CC0 1.0 — https://polyhaven.com/license';

/**
 * `name` thành `public/models/<name>.glb`; `asset` là slug trên Poly Haven;
 * `maxTris` là trần tam giác sau rút gọn; `error` là dung sai hình học cho
 * meshoptimizer (tương đối, theo đường chéo hộp bao — cắt càng sâu cần dung
 * sai càng rộng); `rotateYDeg` bù mô hình có mặt trước không nhìn về +z.
 */
const MANIFEST = [
  { name: 'sofa', asset: 'Sofa_01', maxTris: 2400, error: 0.04, rotateYDeg: 0, license: LICENSE },
  { name: 'armchair', asset: 'ArmChair_01', maxTris: 2400, error: 0.05, rotateYDeg: 0, license: LICENSE },
  { name: 'dining-chair', asset: 'dining_chair_02', maxTris: 1400, error: 0.08, rotateYDeg: 0, license: LICENSE },
  { name: 'coffee-table', asset: 'coffee_table_round_01', maxTris: 1600, error: 0.04, rotateYDeg: 0, license: LICENSE },
  { name: 'side-table', asset: 'side_table_01', maxTris: 1200, error: 0.04, rotateYDeg: 0, license: LICENSE },
  { name: 'plant', asset: 'potted_plant_01', maxTris: 3500, error: 0.3, pruneIslands: true, rotateYDeg: 0, license: LICENSE },
  { name: 'vase', asset: 'ceramic_vase_01', maxTris: 900, error: 0.04, rotateYDeg: 0, license: LICENSE },
  { name: 'shelf', asset: 'Shelf_01', maxTris: 1000, error: 0.02, rotateYDeg: 0, license: LICENSE },
];
// Đã thử và loại: `bar_chair_round_01` (đôn bếp) — mô hình photogrammetry, đỉnh
// tách theo hàng nghìn mảnh atlas nên meshopt không rút dưới 14k tam giác mà
// không phá texture; hai chiếc đôn giữ khối thủ tục.

const RESOLUTION = '1k';
const TEXTURE_SIZE = 512;
const TARGET = join('public', 'models');
const CACHE = join(tmpdir(), 'appfront-fetch-models');

/* -------------------------------------------------------------------------- */
/* Tải về.                                                                     */
/* -------------------------------------------------------------------------- */

/** Tải một file về đệm, bỏ qua nếu đã có đúng kích thước. */
async function download(url, path, size) {
  if (existsSync(path) && size !== undefined && (await readFile(path)).length === size) {
    return;
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Tải ${url} thất bại: HTTP ${response.status}`);
  }
  mkdirSync(dirname(path), { recursive: true });
  await writeFile(path, Buffer.from(await response.arrayBuffer()));
}

/** Kéo bộ gltf + bin + texture của một asset về đệm, trả đường dẫn file .gltf. */
async function fetchAsset(asset) {
  const listing = await fetch(`https://api.polyhaven.com/files/${asset}`);
  if (!listing.ok) {
    throw new Error(`Poly Haven không trả hồ sơ cho ${asset}: HTTP ${listing.status}`);
  }
  const entry = (await listing.json()).gltf?.[RESOLUTION]?.gltf;
  if (entry === undefined) {
    throw new Error(`${asset} không có bản gltf ${RESOLUTION}.`);
  }

  const root = join(CACHE, asset);
  const gltfPath = join(root, `${asset}.gltf`);
  await download(entry.url, gltfPath, entry.size);
  for (const [relative, file] of Object.entries(entry.include ?? {})) {
    await download(file.url, join(root, relative), file.size);
  }
  return gltfPath;
}

/* -------------------------------------------------------------------------- */
/* Xử lý.                                                                      */
/* -------------------------------------------------------------------------- */

function countTriangles(document) {
  let triangles = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const index = primitive.getIndices();
      const count = index === null ? (primitive.getAttribute('POSITION')?.getCount() ?? 0) : index.getCount();
      triangles += count / 3;
    }
  }
  return Math.round(triangles);
}

/**
 * Rút gọn từng primitive bằng meshoptimizer, thay cho `simplify()` dựng sẵn:
 * cờ `Prune` (bỏ đảo hình rời quá nhỏ — tán lá là hàng nghìn đảo như thế) chưa
 * được gltf-transform expose, mà thiếu nó thì lá cây không rút được. Tỉ lệ áp
 * theo tổng tam giác của cả tài liệu, như simplify() vẫn làm.
 */
function simplifyDocument(document, entry, before) {
  const ratio = Math.min(1, entry.maxTris / before);
  if (ratio >= 1) {
    return;
  }
  const flags = entry.pruneIslands === true ? ['Prune'] : [];
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const source = primitive.getIndices();
      const position = primitive.getAttribute('POSITION');
      if (source === null || position === null || !(position.getArray() instanceof Float32Array)) {
        continue;
      }
      const indices = source.getArray() instanceof Uint32Array ? source.getArray() : new Uint32Array(source.getArray());
      const target = Math.floor((ratio * indices.length) / 3) * 3;
      const [kept] = MeshoptSimplifier.simplify(indices, new Float32Array(position.getArray()), 3, target, entry.error, flags);
      source.setArray(kept);
      compactPrimitive(primitive);
    }
  }
}

/** Quay mọi nút gốc của cảnh quanh trục y — cho mô hình không nhìn về +z. */
function rotateSceneY(document, degrees) {
  if (degrees === 0) {
    return;
  }
  const radians = (degrees * Math.PI) / 180;
  const sin = Math.sin(radians / 2);
  const cos = Math.cos(radians / 2);
  for (const scene of document.getRoot().listScenes()) {
    for (const node of scene.listChildren()) {
      const [x, y, z, w] = node.getRotation();
      // (0, sin, 0, cos) nhân trái vào quaternion hiện có.
      node.setRotation([
        cos * x + sin * z,
        cos * y + sin * w,
        cos * z - sin * x,
        cos * w - sin * y,
      ]);
      const [tx, ty, tz] = node.getTranslation();
      const c = Math.cos(radians);
      const s = Math.sin(radians);
      node.setTranslation([c * tx + s * tz, ty, -s * tx + c * tz]);
    }
  }
}

async function processEntry(entry, io) {
  const gltfPath = await fetchAsset(entry.asset);
  const document = await io.read(gltfPath);
  const before = countTriangles(document);

  await MeshoptSimplifier.ready;
  await document.transform(dedup(), flatten(), weld());
  simplifyDocument(document, entry, before);
  await document.transform(
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEXTURE_SIZE, TEXTURE_SIZE] }),
    prune(),
    draco(),
  );
  rotateSceneY(document, entry.rotateYDeg);

  const after = countTriangles(document);
  const bytes = await io.writeBinary(document);
  const target = join(TARGET, `${entry.name}.glb`);
  await writeFile(target, bytes);
  console.log(
    `${entry.name}.glb ← ${entry.asset} (${entry.license}): ${before} → ${after} tam giác, ${(bytes.length / 1024).toFixed(1)} KiB`,
  );
  return { name: entry.name, asset: entry.asset, triangles: after, bytes: bytes.length };
}

/* -------------------------------------------------------------------------- */
/* Chạy.                                                                       */
/* -------------------------------------------------------------------------- */

const wanted = new Set(process.argv.slice(2));
const entries = wanted.size === 0 ? MANIFEST : MANIFEST.filter((entry) => wanted.has(entry.name));
if (entries.length === 0) {
  console.error(`Không có mục nào tên ${[...wanted].join(', ')}. Các tên: ${MANIFEST.map((entry) => entry.name).join(', ')}.`);
  process.exit(1);
}

mkdirSync(TARGET, { recursive: true });
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });

let total = 0;
for (const entry of entries) {
  const result = await processEntry(entry, io);
  total += result.triangles;
}
console.log(`Tổng ${entries.length} mô hình, ${total} tam giác (mỗi bản sao trong cảnh tính thêm một lần).`);
