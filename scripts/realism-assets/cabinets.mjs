#!/usr/bin/env node
/**
 * Gói 4B (editor-realism): tủ khối hộp của Pascal → tủ sinh bằng code có chi tiết thật
 * (chân đế lùi, cánh/ngăn kéo tách khe 3 mm, mép vát, tay nắm thanh kim loại, mặt đá nhô ra trước).
 *
 *   node scripts/realism-assets/cabinets.mjs            → assets/appfront-items/<folder>-gen/
 *
 * Tên khe vật liệu giữ đúng như mẫu Pascal (swap giữ `node.slots` của thư mục cũ → phong cách tô như cũ).
 * Khe mới `slot_handle` (closet, kitchen-counter, tv-stand) không có trong SLOT_FAMILY → màu gốc kim loại tối.
 * UV hộp theo mét (1 đơn vị UV = 1 m) để vân gỗ / đá của thư viện hiện đúng tỉ lệ.
 * Kích thước hộp bao = hộp Pascal (CATALOG_MODELS[folder].dimensions) để kéo giãn không méo.
 */
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { Document } from '@gltf-transform/core';

import { box, ioOf, merge, normalsOf, writeModel } from '../gen-decor-models.mjs';

/** Khe giữa các cánh, độ dày cánh, mép vát cánh. */
const G = 0.003;
const T = 0.019;
const C = 0.002;
/** Tay nắm thanh: chân đỡ dài S, thanh dày 2R → nhô ra trước HP. */
const R = 0.006;
const S = 0.022;
const HP = S + 2 * R;

/**
 * Hộp vát mép c (45°): 6 mặt chính + 12 dải vát + 8 tam giác góc, mỗi mặt đỉnh riêng (pháp tuyến cứng).
 * Mặt theo hướng d ∈ {-1,0,1}³: gồm đỉnh V_a của góc s khi s khớp d ở mọi trục khác 0 và a là trục khác 0 của d.
 */
export const bevelBox = (x0, x1, y0, y1, z0, z1, c = 0) => {
  if (c <= 0) return box(x0, x1, y0, y1, z0, z1);
  const lo = [x0, y0, z0];
  const hi = [x1, y1, z1];
  const vert = (s, a) => s.map((sk, k) => (sk > 0 ? hi[k] : lo[k]) - sk * (k === a ? 0 : c));
  const signs = [-1, 1];
  const corners = signs.flatMap((sx) => signs.flatMap((sy) => signs.map((sz) => [sx, sy, sz])));
  const parts = [];
  for (const dx of [-1, 0, 1])
    for (const dy of [-1, 0, 1])
      for (const dz of [-1, 0, 1]) {
        const d = [dx, dy, dz];
        if (!dx && !dy && !dz) continue;
        const axes = [0, 1, 2].filter((k) => d[k]);
        const pts = corners
          .filter((s) => axes.every((k) => s[k] === d[k]))
          .flatMap((s) => axes.map((a) => vert(s, a)));
        // Sắp theo góc quanh tâm mặt trong mặt phẳng ⊥ d, rồi quạt; lật nếu quay ngược d.
        const ctr = [0, 1, 2].map((k) => pts.reduce((n, p) => n + p[k], 0) / pts.length);
        const u = Math.abs(d[0]) < 0.5 ? [0, d[2], -d[1]] : [-d[1], d[0], 0];
        const w = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
        const ang = (p) => {
          const q = p.map((v, k) => v - ctr[k]);
          return Math.atan2(q[0] * w[0] + q[1] * w[1] + q[2] * w[2], q[0] * u[0] + q[1] * u[1] + q[2] * u[2]);
        };
        pts.sort((a, b) => ang(a) - ang(b));
        const idx = [];
        for (let i = 1; i < pts.length - 1; i++) idx.push(0, i, i + 1);
        const [a, b, e] = [pts[0], pts[1], pts[2]];
        const n = [
          (b[1] - a[1]) * (e[2] - a[2]) - (b[2] - a[2]) * (e[1] - a[1]),
          (b[2] - a[2]) * (e[0] - a[0]) - (b[0] - a[0]) * (e[2] - a[2]),
          (b[0] - a[0]) * (e[1] - a[1]) - (b[1] - a[1]) * (e[0] - a[0]),
        ];
        if (n[0] * d[0] + n[1] * d[1] + n[2] * d[2] < 0) for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
        parts.push({ pos: pts.flat(), idx });
      }
  return merge(...parts);
};

/** Mặt cánh/ngăn kéo trong ô [x0,x1]×[y0,y1], mặt sau ở z0 (khe G/2 mỗi bên). */
const front = (x0, x1, y0, y1, z0) => bevelBox(x0 + G / 2, x1 - G / 2, y0 + G / 2, y1 - G / 2, z0, z0 + T, C);

/** Tay nắm thanh dọc ('y') hoặc ngang ('x') dài L, tâm (cx, cy), gắn vào mặt z0; hai chân đỡ vuông 8 mm. */
const bar = (axis, cx, cy, L, z0) => {
  const along = (t) => (axis === 'x' ? [cx + t, cy] : [cx, cy + t]);
  const [hx, hy] = axis === 'x' ? [L / 2, R] : [R, L / 2];
  const post = (t) => {
    const [px, py] = along(t);
    return box(px - 0.004, px + 0.004, py - 0.004, py + 0.004, z0, z0 + S);
  };
  return merge(bevelBox(cx - hx, cx + hx, cy - hy, cy + hy, z0 + S, z0 + HP, R * 0.6), post(-L / 2 + 0.02), post(L / 2 - 0.02));
};

// ---------- mẫu ----------

/** Tủ áo 3 cánh: chân đế lùi, nóc nhô 5 mm, tay nắm dọc ở hai mép cặp cánh. */
const closetParts = ({ W, H, D }) => {
  const zb = -D / 2;
  const zd = D / 2 - HP - T;
  const plinth = 0.08;
  const cap = 0.03;
  const xs = [-W / 2 + 0.005, W / 2 - 0.005];
  const dw = (xs[1] - xs[0]) / 3;
  const doors = [];
  const handles = [];
  for (let i = 0; i < 3; i++) {
    const x0 = xs[0] + i * dw;
    doors.push(front(x0, x0 + dw, plinth, H - cap, zd));
    handles.push(bar('y', i < 2 ? x0 + dw - 0.05 : x0 + 0.05, 1.15, 0.36, zd + T));
  }
  return {
    body: merge(
      box(-W / 2 + 0.04, W / 2 - 0.04, 0, plinth, zb + 0.02, zd - 0.05),
      bevelBox(xs[0], xs[1], plinth, H - cap, zb, zd, 0.002),
      bevelBox(-W / 2, W / 2, H - cap, H, zb, zd + T + 0.006, 0.004),
      ...doors,
    ),
    handle: merge(...handles),
  };
};

/**
 * Tủ bếp dưới: chân đế lùi 10 cm, ô 1 = 3 ngăn kéo, các ô khác = ngăn kéo trên + cánh, mặt đá dày top
 * nhô 20 mm trước cánh; `top` = cao mặt đá (thấp hơn H thì phần còn lại là tấm ốp tường đá sau lưng).
 */
const baseParts = ({ W, H, D }, top = H, topT = 0.04) => {
  const zb = -D / 2;
  const zf = D / 2 - HP;
  const zd = zf - T;
  const plinth = 0.1;
  const y1 = top - topT - 0.002;
  const xs = [-W / 2 + 0.003, W / 2 - 0.003];
  const n = Math.max(1, Math.round(W / 0.6));
  const mw = (xs[1] - xs[0]) / n;
  const fh = y1 - plinth;
  const fronts = [];
  const handles = [];
  const drawer = (x0, ya, yb) => {
    fronts.push(front(x0, x0 + mw, ya, yb, zd));
    handles.push(bar('x', x0 + mw / 2, yb - Math.min(0.05, (yb - ya) / 2), Math.min(0.6 * mw, 0.32), zf));
  };
  for (let i = 0; i < n; i++) {
    const x0 = xs[0] + i * mw;
    if (i === 0) {
      const ya = plinth + fh * 0.4;
      const yb = ya + fh * 0.33;
      drawer(x0, plinth, ya);
      drawer(x0, ya, yb);
      drawer(x0, yb, y1);
    } else {
      const yd = y1 - Math.min(0.16, fh * 0.27);
      drawer(x0, yd, y1);
      drawer(x0, plinth, yd);
    }
  }
  return {
    cabinet: merge(
      box(xs[0], xs[1], 0, plinth, zb + 0.02, zd - 0.06),
      bevelBox(xs[0], xs[1], plinth, top - topT, zb, zd, 0.002),
      ...fronts,
    ),
    countertop: merge(
      bevelBox(-W / 2, W / 2, top - topT, top, zb, zf + 0.02, 0.003),
      ...(top < H - 0.01 ? [bevelBox(-W / 2, W / 2, top, H, zb, zb + 0.015, 0.002)] : []),
    ),
    handle: merge(...handles),
  };
};

/** Tủ bếp trên treo tường: cánh đôi full cao, tay nắm dọc ngắn ở mép dưới, hai cánh mỗi cặp quay vào nhau. */
const wallParts = ({ W, H, D }) => {
  const zb = -D / 2;
  const zd = D / 2 - HP - T;
  const n = Math.max(1, Math.round(W / 0.55));
  const dw = W / n;
  const doors = [];
  const handles = [];
  for (let i = 0; i < n; i++) {
    const x0 = -W / 2 + i * dw;
    doors.push(front(x0, x0 + dw, 0, H, zd));
    handles.push(bar('y', i % 2 === 0 ? x0 + dw - 0.04 : x0 + 0.04, 0.13, 0.16, zd + T));
  }
  return { cabinet: merge(bevelBox(-W / 2, W / 2, 0, H, zb, zd, 0.002), ...doors), handle: merge(...handles) };
};

/** Kệ TV thấp: 4 chân kim loại, mặt nóc nhô, cánh lật trái/phải + 2 ngăn kéo giữa. */
const tvParts = ({ W, H, D }) => {
  const zb = -D / 2;
  const zf = D / 2 - HP;
  const zd = zf - T;
  const leg = 0.05;
  const lid = 0.022;
  const xs = [-W / 2 + 0.01, W / 2 - 0.01];
  const mw = (xs[1] - xs[0]) / 3;
  const ym = (leg + H - lid) / 2;
  const fronts = [];
  const handles = [];
  const cell = (x0, ya, yb) => {
    fronts.push(front(x0, x0 + mw, ya, yb, zd));
    handles.push(bar('x', x0 + mw / 2, yb - Math.min(0.045, (yb - ya) / 2), 0.2, zf));
  };
  cell(xs[0], leg, H - lid);
  cell(xs[0] + mw, ym, H - lid);
  cell(xs[0] + mw, leg, ym);
  cell(xs[0] + 2 * mw, leg, H - lid);
  const legs = [];
  for (const x of [xs[0] + 0.06, xs[1] - 0.06]) for (const z of [zb + 0.04, zd - 0.04]) legs.push(box(x - 0.015, x + 0.015, 0, leg, z - 0.015, z + 0.015));
  return {
    body: merge(
      bevelBox(xs[0], xs[1], leg, H - lid, zb, zd, 0.002),
      bevelBox(-W / 2, W / 2, H - lid, H, zb, zd + T + 0.005, 0.004),
      ...fronts,
    ),
    handle: merge(...handles, ...legs),
  };
};

/** Pascal folder → mẫu mới; `size` = dimensions của dòng VENDOR_MODELS (hộp Pascal). */
export const CABINETS = {
  'closet-gen': { pascal: 'closet', label: 'Wardrobe', size: { W: 1.95, H: 2.26, D: 0.6 }, parts: closetParts },
  'kitchen-counter-gen': { pascal: 'kitchen-counter', label: 'Counter', size: { W: 1.96, H: 0.73, D: 0.63 }, parts: (s) => baseParts(s) },
  'kitchen-cabinet-gen': { pascal: 'kitchen-cabinet', label: 'Kitchen', size: { W: 1.65, H: 1.09, D: 0.77 }, parts: (s) => baseParts(s, 0.9) },
  'kitchen-shelf-gen': { pascal: 'kitchen-shelf', label: 'Wall unit', size: { W: 2.21, H: 0.89, D: 0.52 }, parts: wallParts },
  'tv-stand-gen': { pascal: 'tv-stand', label: 'TV stand', size: { W: 1.86, H: 0.35, D: 0.32 }, parts: tvParts },
};

/** Màu gốc khi phong cách không đè khe (khe mới `handle` luôn dùng màu này). */
const LOOK = {
  body: { colour: [0.55, 0.42, 0.3, 1], rough: 0.7, metal: 0 },
  cabinet: { colour: [0.86, 0.85, 0.82, 1], rough: 0.6, metal: 0 },
  countertop: { colour: [0.62, 0.62, 0.6, 1], rough: 0.4, metal: 0 },
  handle: { colour: [0.12, 0.12, 0.12, 1], rough: 0.35, metal: 0.8 },
};

/** Như docOf của gen-decor-models nhưng có TEXCOORD_0: chiếu hộp theo trục trội của pháp tuyến, đơn vị mét. */
const cabinetDocOf = (parts) => {
  const doc = new Document();
  doc.getRoot().getAsset().generator = 'AppFront realism-assets/cabinets';
  const buffer = doc.createBuffer();
  const mesh = doc.createMesh('cabinet');
  const round = (a) => Float32Array.from(a, (x) => Math.round(x * 1e5) / 1e5);
  for (const [slot, part] of Object.entries(parts)) {
    const look = LOOK[slot];
    const material = doc
      .createMaterial(`slot_${slot}`)
      .setBaseColorFactor(look.colour)
      .setRoughnessFactor(look.rough)
      .setMetallicFactor(look.metal);
    const normal = normalsOf(part);
    const uv = new Float32Array((part.pos.length / 3) * 2);
    for (let v = 0; v < part.pos.length / 3; v++) {
      const [x, y, z] = part.pos.slice(v * 3, v * 3 + 3);
      const [ax, ay, az] = [0, 1, 2].map((k) => Math.abs(normal[v * 3 + k]));
      const [s, t] = ay >= ax && ay >= az ? [x, z] : ax >= az ? [z, y] : [x, y];
      uv[v * 2] = s;
      uv[v * 2 + 1] = t;
    }
    const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
    mesh.addPrimitive(
      doc
        .createPrimitive()
        .setAttribute('POSITION', acc('VEC3', round(part.pos)))
        .setAttribute('NORMAL', acc('VEC3', normal))
        .setAttribute('TEXCOORD_0', acc('VEC2', round(uv)))
        .setIndices(acc('SCALAR', Uint32Array.from(part.idx)))
        .setMaterial(material),
    );
  }
  doc.createScene('Scene').addChild(doc.createNode('cabinet').setMesh(mesh));
  doc.getRoot().setDefaultScene(doc.getRoot().listScenes()[0]);
  return doc;
};

const main = async () => {
  const io = await ioOf();
  for (const [folder, { label, size, parts }] of Object.entries(CABINETS)) await writeModel(io, folder, cabinetDocOf(parts(size)), label, { keepAttributes: true });
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
