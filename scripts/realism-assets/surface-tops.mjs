#!/usr/bin/env node
/**
 * Đo mặt đặt đồ của MỌI mẫu đồ đạc từ hình học GLB (thay `topY` nhập tay / tỉ lệ đoán chung).
 *
 *   node scripts/realism-assets/surface-tops.mjs            → src/lib/pascal/surfaceTops.json
 *   node scripts/realism-assets/surface-tops.mjs --verbose  → in thêm các mặt ứng viên của từng mẫu
 *
 * Chạy lại mỗi khi thêm / thay `model.glb` trong vendor/pascal/assets/items hoặc assets/appfront-items
 * rồi commit file JSON (luật bày đồ `hostTopMm` đọc nó; `topY` tay trong furnitureCatalog vẫn thắng).
 *
 * Thuật toán: tam giác có pháp tuyến hướng lên (n.y ≥ 0,9, hướng theo NORMAL của đỉnh nếu có) cộng diện tích
 * chiếu vào histogram độ cao theo 1 % chiều cao hộp bao. Gộp cửa sổ 3 ô (mặt nệm / đệm hơi cong); lấy
 * cửa sổ CAO NHẤT có diện tích ≥ nửa cửa sổ rộng nhất của chính mẫu (và ≥ 10 % mặt bằng rộng × sâu hộp bao).
 * Tựa lưng, đầu giường, vòi, tấm ốp sau, viền bàn đều hẹp nên rơi dưới ngưỡng. Kết quả = độ cao trung bình theo diện tích của cửa sổ,
 * tính theo tỉ lệ chiều cao hộp bao (0 = đáy, 1 = đỉnh). Mẫu không có mặt nào đủ rộng thì bỏ (dùng tỉ lệ mặc định).
 */
import { readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { ioOf } from '../gen-decor-models.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DIRS = ['vendor/pascal/assets/items', 'assets/appfront-items'];
const OUT = join(ROOT, 'src/lib/pascal/surfaceTops.json');
/** Ngưỡng mặt đặt đồ: ≥ REL_SHARE × cửa sổ rộng nhất của mẫu và ≥ MIN_SHARE mặt bằng. Dưới đây là tay vịn / tựa lưng / đầu giường. */
const REL_SHARE = 0.5;
const MIN_SHARE = 0.1;
const MIN_NY = 0.9;
const BINS = 100;
const WINDOW = 3;

const mul = (m, [x, y, z]) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Mọi tam giác của cảnh (toạ độ thế giới): [[a, b, c, hướng NORMAL hoặc null], ...]. */
const trianglesOf = (doc) => {
  const tris = [];
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  scene?.traverse((node) => {
    const mesh = node.getMesh();
    if (!mesh) return;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== 4) continue;
      const pos = prim.getAttribute('POSITION');
      const nor = prim.getAttribute('NORMAL');
      const idx = prim.getIndices();
      const count = idx ? idx.getCount() : pos.getCount();
      const at = (i) => (idx ? idx.getScalar(i) : i);
      const p = [];
      const n = [];
      for (let i = 0; i < count; i += 3) {
        const v = [at(i), at(i + 1), at(i + 2)].map((k) => mul(m, pos.getElement(k, p)));
        let dir = null;
        if (nor) {
          // Hướng NORMAL đỉnh (đổi sang thế giới bằng phần quay của ma trận, đủ cho hướng ±).
          const s = [0, 0, 0];
          for (const k of [at(i), at(i + 1), at(i + 2)]) {
            const [x, y, z] = nor.getElement(k, n);
            s[0] += m[0] * x + m[4] * y + m[8] * z;
            s[1] += m[1] * x + m[5] * y + m[9] * z;
            s[2] += m[2] * x + m[6] * y + m[10] * z;
          }
          dir = s;
        }
        tris.push([...v, dir]);
      }
    }
  });
  return tris;
};

/** { fraction, share, candidates } của một mẫu; fraction undefined = không có mặt đủ rộng. */
export const surfaceTopOf = (tris) => {
  let [minY, maxY, minX, maxX, minZ, maxZ] = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity];
  for (const t of tris)
    for (const [x, y, z] of t.slice(0, 3)) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
  const h = maxY - minY;
  const footprint = (maxX - minX) * (maxZ - minZ);
  const area = new Array(BINS + 1).fill(0);
  const moment = new Array(BINS + 1).fill(0);
  for (const [a, b, c, dir] of tris) {
    let nrm = cross(sub(b, a), sub(c, a));
    const len = Math.hypot(...nrm);
    if (len === 0) continue;
    if (dir && nrm[0] * dir[0] + nrm[1] * dir[1] + nrm[2] * dir[2] < 0) nrm = nrm.map((x) => -x);
    if (nrm[1] / len < MIN_NY) continue;
    const y = (a[1] + b[1] + c[1]) / 3;
    const bin = Math.round(((y - minY) / h) * BINS);
    // Diện tích chiếu xuống mặt bằng = |n.y| / 2.
    area[bin] += nrm[1] / 2;
    moment[bin] += (nrm[1] / 2) * (y - minY);
  }
  const windows = [];
  for (let top = BINS; top >= 0; top--) {
    if (area[top] === 0) continue;
    let [s, mo] = [0, 0];
    for (let k = Math.max(0, top - WINDOW + 1); k <= top; k++) [s, mo] = [s + area[k], mo + moment[k]];
    windows.push({ fraction: mo / s / h, share: s / footprint });
  }
  const need = Math.max(MIN_SHARE, REL_SHARE * Math.max(0, ...windows.map((w) => w.share)));
  const candidates = windows.filter((w) => w.share >= 0.05);
  const pick = windows.find((w) => w.share >= need);
  if (pick) return { ...pick, h, candidates };
  return { fraction: undefined, h, candidates };
};

const main = async () => {
  const io = await ioOf();
  const verbose = process.argv.includes('--verbose');
  const out = {};
  for (const dir of DIRS)
    for (const folder of readdirSync(join(ROOT, dir)).sort()) {
      const file = join(ROOT, dir, folder, 'model.glb');
      if (!existsSync(file)) continue;
      const r = surfaceTopOf(trianglesOf(await io.read(file)));
      if (verbose)
        console.log(
          folder.padEnd(24),
          r.fraction === undefined ? '  -  ' : r.fraction.toFixed(3),
          `h=${r.h.toFixed(3)}`,
          r.candidates.slice(0, 4).map((c) => `${c.fraction.toFixed(2)}@${(c.share * 100).toFixed(0)}%`).join(' '),
        );
      if (r.fraction !== undefined) out[folder] = Math.round(r.fraction * 1000) / 1000;
    }
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`${Object.keys(out).length} mẫu → ${OUT}`);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
