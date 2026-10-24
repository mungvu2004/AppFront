#!/usr/bin/env node
/**
 * Mẫu Sketchfab CC BY 4.0 (người dùng tải bằng tài khoản của họ, glTF) → assets/appfront-items/<folder>/.
 *
 *   node scripts/realism-assets/sketchfab.mjs <dlDir> [--only folder,folder]
 *     <dlDir>/<dir>/scene.gltf (+ scene.bin, textures/, license.txt) — tên <dir> = tên zip Sketchfab
 *
 * Mỗi mẫu: giữ/bỏ nút theo tên, lọc tam giác (bàn ăn liền ghế), xoay mặt trước về +z, đổi đơn vị về mét
 * (theo một kích thước thật), giảm lưới, ảnh webp để ngoài GLB (CSP chặn blob:), Draco, đáy y = 0.
 * Ghi nguồn: assets/appfront-items/LICENSES.md (CC BY bắt buộc ghi tên mẫu, tác giả, link).
 */
import { join } from 'node:path';
import process from 'node:process';

import { getBounds } from '@gltf-transform/core';
import {
  clearNodeTransform,
  compactPrimitive,
  flatten,
  join as joinPrims,
  metalRough,
  simplify,
  textureCompress,
  transformMesh,
  weld,
} from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

import { ioOf, writeModel } from '../gen-decor-models.mjs';

/**
 * dir → folder AppFront. `yaw` (độ) quay quanh y để mặt trước nhìn +z. `fit` = [trục sau xoay, mét]
 * (giữ tỉ lệ) hoặc `size` = [x, y, z] mét (co giãn từng trục cho vừa ô vuông/ô bàn trà của editor).
 * `keep`/`drop` = regex tên nút; `clipX` = bỏ tam giác có tâm |x| > giá trị (đơn vị gốc, trước xoay).
 */
export const SKETCHFAB = {
  modern_wardrobe_ikea_style_white_colors: {
    folder: 'wardrobe-sf', label: 'Wardrobe', yaw: -90, fit: ['y', 2.2],
    credit: ['Modern Wardrobe IKEA Style (White colors)', 'Igor Piotrowiak (@Relowsky)', 'b1c75cea276f4239b65d08d34c5eabe5'],
  },
  'refrigerator_-_grey_polished_metal': {
    folder: 'fridge-sf', label: 'Fridge', yaw: 0, fit: ['y', 1.85], tris: 4000,
    credit: ['Refrigerator - Grey Polished Metal', 'Glowbox 3D (@glowbox3d)', '2071bda681b642218b6829b82e4fd93b'],
  },
  toilet: {
    folder: 'toilet-sf', label: 'Toilet', yaw: 0, fit: ['y', 0.74], tris: 5000,
    credit: ['Toilet', 'HippoStance (@hippostance)', '132a8ee2af3a40d39d270fbed3d3666c'],
  },
  designer_vessel_on_wooden_vanity_unit: {
    folder: 'vanity-sf', label: 'Vanity', yaw: 90, fit: ['y', 1.13], drop: /^Backwall/, tris: 6000,
    credit: ['Designer vessel on wooden vanity unit', 'attilakozma (@attilakozma)', 'b0b478131827419c8965132a19eb8993'],
  },
  // 'game_ready_-_double_bed' (eeafb245…) bỏ: là cả mảng tường đầu giường 3,27 × 2,95, ép vào ô giường thì giường co còn ~0,9 m.
  dining_table_glass: {
    folder: 'dining-table-sf', label: 'Table', yaw: 90, fit: ['y', 0.76], clipX: 16.2, tris: 5000,
    credit: ['Dining Table Glass', 'Francesco Coldesina (@topfrank2013)', 'c41a27d7a1b24dc484bc603e1bc2d0ef'],
  },
  cabinets_and_shelf_ikea_style: {
    folder: 'dresser-sf', label: 'Dresser', yaw: 0, fit: ['y', 0.96], keep: /^CabinetA_Frame/,
    credit: ['Cabinets and shelf IKEA style', 'janexx (@janexx)', 'a1a84be7512f4389af7fd7bbd7060c2f'],
  },
  flat_screen_television: {
    folder: 'tv-sf', label: 'TV', yaw: -90, fit: ['x', 1.16],
    credit: ['Flat Screen Television', 'HippoStance (@hippostance)', 'f90d4fb91dd34b6791e8d66d00f96591'],
  },
  // Gói 6.
  'soho_bed_-_3d_model': {
    folder: 'bed-sf', label: 'Bed', yaw: 0, fit: ['x', 1.8], tris: 12000, texture: 1024,
    credit: ['Soho bed - 3D Model', 'BertO (@bertosalotti)', '97e361e8beda4112ac5b1b5bcd388cdf'],
  },
  // Cabin 1,3 × 1,05 m, ô tắm của editor gần vuông (~0,9 m) → ép vuông, không thì co đều chỉ còn cao 1,5 m.
  shower_cabin: {
    folder: 'shower-sf', label: 'Shower', yaw: 0, size: [0.95, 2.0, 0.95], tris: 8000,
    credit: ['Shower Cabin', 'Heliona (@Heliona)', 'e2c6a8dd490e4e4398378e1f6c9121a8'],
  },
  range_hood_kitchen_hood: {
    folder: 'hood-sf', label: 'Hood', yaw: 0, fit: ['x', 0.76],
    credit: ['Range Hood (Kitchen Hood)', 'govindu94 (@govindu94)', 'e846cb48e88446808af55976ff76b1da'],
  },
  ikea_range_with_gas_cooktop: {
    folder: 'stove-sf', label: 'Stove', yaw: 0, fit: ['x', 0.76], tris: 12000,
    credit: ['IKEA Range with Gas Cooktop', 'MUSHROOM_BUILDS (@MUSHROOM_BUILDS)', '0568b8cf6a8444099c55eab7ca1a7de0'],
  },
  simple_wooden_coffee_table__game_asset: {
    folder: 'coffee-table-sf', label: 'Coffee table', yaw: 0, size: [1.2, 0.42, 0.65],
    credit: ['Simple Wooden Coffee Table – Game Asset', 'AspectStudios (@AspectStudio)', 'e80cccd7091049d2becc13384e218bc5'],
  },
};

const AXIS = { x: 0, y: 1, z: 2 };

/** Ma trận cột (glTF) quay quanh y góc `deg` rồi nhân từng trục [sx, sy, sz]. */
const yawScale = (deg, [sx, sy, sz]) => {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const n = Math.sin(r);
  return [sx * c, 0, -sz * n, 0, 0, sy, 0, 0, sx * n, 0, sz * c, 0, 0, 0, 0, 1];
};

const underMatch = (node, re) => {
  for (let n = node; n; n = n.getParentNode()) if (re.test(n.getName())) return true;
  return false;
};

const convert = async (io, dl, dir, cfg) => {
  await MeshoptSimplifier.ready;
  const doc = await io.read(join(dl, dir, 'scene.gltf'));
  // Mẫu cũ dùng KHR_materials_pbrSpecularGlossiness (giường Soho) → three đọc thành kim loại trắng.
  await doc.transform(metalRough());
  const root = doc.getRoot();
  for (const node of root.listNodes()) {
    if (!node.getMesh()) continue;
    if ((cfg.keep && !underMatch(node, cfg.keep)) || (cfg.drop && underMatch(node, cfg.drop))) node.setMesh(null);
  }
  await doc.transform(flatten());
  // Nướng biến đổi của từng nút vào đỉnh (lưới dùng chung → tách bản riêng trước).
  const seen = new Set();
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    if (seen.has(mesh)) node.setMesh(mesh.clone());
    seen.add(node.getMesh());
    clearNodeTransform(node);
  }
  if (cfg.clipX) {
    for (const prim of root.listMeshes().flatMap((m) => m.listPrimitives())) {
      const pos = prim.getAttribute('POSITION').getArray();
      const idx = prim.getIndices();
      const a = idx.getArray();
      const keep = [];
      for (let t = 0; t < a.length; t += 3) {
        const cx = (pos[a[t] * 3] + pos[a[t + 1] * 3] + pos[a[t + 2] * 3]) / 3;
        if (Math.abs(cx) <= cfg.clipX) keep.push(a[t], a[t + 1], a[t + 2]);
      }
      idx.setArray(new Uint32Array(keep));
      compactPrimitive(prim);
    }
  }
  const scene = root.listScenes()[0];
  const b0 = getBounds(scene);
  // Kích thước dùng để quy về mét đo SAU khi xoay (x ↔ z khi yaw ±90).
  const swap = Math.abs(cfg.yaw) === 90;
  const extent = (ax) => {
    const src = swap && ax !== 1 ? 2 - ax : ax;
    return b0.max[src] - b0.min[src];
  };
  const fitS = cfg.fit && cfg.fit[1] / extent(AXIS[cfg.fit[0]]);
  const m = yawScale(cfg.yaw, cfg.size ? cfg.size.map((v, ax) => v / extent(ax)) : [fitS, fitS, fitS]);
  for (const mesh of root.listMeshes()) transformMesh(mesh, m);
  const before = root.listMeshes().reduce((n, me) => n + me.listPrimitives().reduce((k, p) => k + p.getIndices().getCount() / 3, 0), 0);
  const ratio = cfg.tris && before > cfg.tris ? cfg.tris / before : 0;
  doc.getRoot().getAsset().generator = 'AppFront realism-assets/sketchfab';
  await doc.transform(
    weld(),
    ...(ratio ? [simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.004 })] : []),
    joinPrims({ keepNamed: false }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [cfg.texture ?? 512, cfg.texture ?? 512], quality: 80 }),
  );
  // Ảnh Sketchfab không tên → mọi tệp thành ".webp" và đè nhau: đặt tên theo thư mục + thứ tự.
  root.listTextures().forEach((t, i) => t.setName(`${cfg.folder}-${i}`));
  await writeModel(io, cfg.folder, doc, cfg.label, { keepAttributes: true });
};

const main = async () => {
  const dl = process.argv[2];
  const at = process.argv.indexOf('--only');
  const only = at > -1 ? process.argv[at + 1].split(',') : null;
  const io = await ioOf();
  for (const [dir, cfg] of Object.entries(SKETCHFAB)) {
    if (only && !only.includes(cfg.folder)) continue;
    await convert(io, dl, dir, cfg);
  }
};

if (process.argv[1]?.endsWith('sketchfab.mjs')) await main();
