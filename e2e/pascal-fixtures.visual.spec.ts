/**
 * Bằng chứng nhìn + hình học cho trang 3D riêng (C9–C11). Cách mở trang chép từ
 * `pascal-fixtures.spec.ts` (T18): máy chủ giả `installFakeApi` + đầu dò `?probe=1`.
 *
 * C9 so hình học tường trong store Pascal với `toPascalScene` (không dùng điểm ảnh).
 * C10 chụp từ trên xuống bằng máy quay phối cảnh nhìn thẳng (biết fov + độ cao thì quy
 * được toạ độ m → điểm ảnh; `top-ortho` không cho biết mức thu phóng), đo Lab trung vị mỗi phòng.
 * C11 lưu ảnh cạnh nhau với trang đăng nhập — không chặn, để người dùng duyệt.
 */
import fs from 'node:fs';

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { SpatialGraphDocumentSchema } from '../src/api/schemas/spatialGraph';
import { fixtureF1, fixtureF2, fixtureF4, type Fixture } from '../src/lib/pascal/__fixtures__';
import { toPascalId } from '../src/lib/pascal/ids';
import { floorMaterialOf } from '../src/lib/pascal/sceneDressing';
import { weldWallEnds } from '../src/lib/pascal/structureFixes';
import { toPascalScene, waitCameraStill } from './fixtures/pascalPageScene';
import type { PascalProbe } from '../src/pascal-page/createProbe';

import { installFakeApi, type WireGraphDocument } from './fixtures/fakeApi';
import { deltaAB, medianLabIn, sideBySide } from './fixtures/sbs';

type Pt = readonly [number, number];
type Vec3 = [number, number, number];

const PROJECT_ID = 'P-FIXTURE0001';
const VIEWPORT = { width: 1440, height: 900 };
const READY_TIMEOUT_MS = 60_000;
const EVIDENCE = 'F:/App/qa-results/fe3d-fix/evidence';
const TOP_FOV = 30;
const COUNTED_TYPES = ['wall', 'door', 'window', 'slab', 'zone', 'item', 'ceiling'] as const;

const graphOf = (fixture: Fixture) => SpatialGraphDocumentSchema.parse(fixture.doc).graph;

const expectedCounts = (fixture: Fixture) => {
  const { scene } = toPascalScene(graphOf(fixture));
  const counts: Record<string, number> = {};
  for (const node of Object.values(scene.nodes)) counts[node.type] = (counts[node.type] ?? 0) + 1;
  return Object.fromEntries(COUNTED_TYPES.map((t) => [t, counts[t] ?? 0]));
};

const openFixture = async (page: Page, fixture: Fixture) => {
  await page.setViewportSize(VIEWPORT);
  await installFakeApi(page, { projectId: PROJECT_ID, graphDoc: fixture.doc as unknown as WireGraphDocument });
  await page.goto(`/editor3d.html?project=${PROJECT_ID}&probe=1`);
  const counts = expectedCounts(fixture);
  await expect
    .poll(
      () =>
        page.evaluate((types) => {
          const p = (window as unknown as { __pascalProbe?: PascalProbe }).__pascalProbe;
          if (!p?.ready()) return null;
          const all = p.counts();
          return Object.fromEntries(types.map((t) => [t, all[t] ?? 0]));
        }, COUNTED_TYPES),
      { timeout: READY_TIMEOUT_MS },
    )
    .toEqual(counts);
};

/** Ô canvas lớn nhất (khung nhìn 3D) trên trang. */
const canvasBox = (page: Page) =>
  page.evaluate(() => {
    const boxes = [...document.querySelectorAll('canvas')].map((c) => c.getBoundingClientRect());
    const b = boxes.sort((p, q) => q.width * q.height - p.width * p.height)[0]!;
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  });

const setCamera = async (page: Page, pos: Vec3, target: Vec3, fov: number | 'top-ortho') => {
  await page.evaluate(
    ([p, t, f]) => (window as unknown as { __pascalProbe: PascalProbe }).__pascalProbe.setCamera(p, t, f),
    [pos, target, fov] as const,
  );
  await page.waitForTimeout(2500); // máy quay trượt dần tới tư thế mới
  await waitCameraStill(page, await canvasBox(page));
};

const extentOf = (fixture: Fixture) => {
  const pts = graphOf(fixture).walls.flatMap((w) => [w.centreline.start, w.centreline.end]);
  const xs = pts.map((p) => p.x / 1000);
  const zs = pts.map((p) => p.y / 1000);
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 };
};

for (const [name, make] of [
  ['F1-ext', () => fixtureF1({ ext: true })],
  ['F2', fixtureF2],
  ['F4', fixtureF4],
] as const) {
  test(`C9 ${name}: tường trong store Pascal khớp toPascalScene ≤ 1 mm`, async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = make();
    await openFixture(page, fixture);
    const walls = await page.evaluate(() => (window as unknown as { __pascalProbe: PascalProbe }).__pascalProbe.walls());
    const byId = new Map(walls.map((w) => [w.id, w]));
    const rows: string[] = [];
    let worst = 0;
    /* V6 (78d2483a): toPascalScene dồn đầu tường gần nhau (<= min(50 mm, nửa dày)); mong đợi = tường đã dồn. */
    const graphWalls = graphOf(fixture).walls;
    const welded = weldWallEnds(graphWalls);
    for (const raw of graphWalls) {
      const wall = welded.get(raw.id) ?? raw;
      const got = byId.get(toPascalId('wall', wall.id));
      expect.soft(got, `C9 ${wall.id} có trong store`).toBeDefined();
      if (!got) continue;
      const mm = (m: number | undefined) => (m ?? Number.NaN) * 1000;
      const d = Math.max(
        Math.abs(mm(got.start[0]) - wall.centreline.start.x),
        Math.abs(mm(got.start[1]) - wall.centreline.start.y),
        Math.abs(mm(got.end[0]) - wall.centreline.end.x),
        Math.abs(mm(got.end[1]) - wall.centreline.end.y),
      );
      const dt = Math.abs(mm(got.thickness) - wall.thicknessMm);
      const dh = Math.abs(mm(got.height) - wall.heightMm);
      worst = Math.max(worst, d, dt, dh);
      rows.push(`${wall.id}\tend ${d.toFixed(3)}\tthick ${dt.toFixed(3)}\theight ${dh.toFixed(3)}`);
    }
    fs.mkdirSync(EVIDENCE, { recursive: true });
    fs.writeFileSync(`${EVIDENCE}/C9-${name}.tsv`, `${rows.join('\n')}\nworst_mm\t${worst}\n`);
    console.log(`C9 ${name}: ${rows.length} tường, lệch lớn nhất ${worst.toFixed(3)} mm`);
    expect(worst, 'C9 lệch lớn nhất (mm)').toBeLessThanOrEqual(1);
  });
}

test('C10 + C11 F1-ext: màu sàn theo lớp hoàn thiện + ảnh cạnh nhau với trang đăng nhập', async ({ page }) => {
  test.setTimeout(180_000);
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const fixture = fixtureF1({ ext: true });
  const graph = graphOf(fixture);
  await openFixture(page, fixture);
  const ext = extentOf(fixture);
  const box = await canvasBox(page);

  // C10 — nhìn thẳng xuống (lệch rất nhỏ theo +z để trục màn hình: phải = +x, xuống = +z).
  const half = Math.tan((TOP_FOV * Math.PI) / 360);
  const height = (Math.max(ext.d, (ext.w * box.height) / box.width) * 0.6) / half;
  // Lượt chạy đầu chụp ra nền xám trống: ngay sau `ready()` trang còn đang hiện dần và tự
  // canh máy quay lần đầu, đè lên tư thế vừa đặt. Chờ thêm rồi đặt lại lần hai.
  await page.waitForTimeout(5000);
  // Đèn ấm làm phòng nhỏ sáng hơn phòng lớn cùng lớp hoàn thiện; C10 đo vật liệu nên tắt đèn.
  await page.evaluate(() => (window as unknown as { __pascalProbe: PascalProbe }).__pascalProbe.setLights(false));
  await page.waitForTimeout(1000);
  for (let i = 0; i < 2; i++) await setCamera(page, [ext.cx, height, ext.cz + height * 1e-3], [ext.cx, 0, ext.cz], TOP_FOV);
  const top = await page.screenshot({ clip: box });
  fs.writeFileSync(`${EVIDENCE}/C10-top-F1-ext.png`, top);
  const s = box.height / 2 / (height * half); // điểm ảnh / m tại mặt sàn
  const px = (xMm: number, yMm: number): Pt => [box.width / 2 + (xMm / 1000 - ext.cx) * s, box.height / 2 + (yMm / 1000 - ext.cz) * s];

  /* Che mọi item của cảnh trang dựng (đồ của bản vẽ + đồ bày tự sinh `DRESS-*` như thảm, chăn; cỡ
     theo mẫu realism) chứ không chỉ `graph.furniture`: thảm/đồ bày nằm đè sàn làm lệch màu trung vị. */
  const items = Object.values(toPascalScene(graph).scene.nodes).flatMap((n) =>
    n.type === 'item' && n.asset?.dimensions ? [{ pos: n.position, yaw: n.rotation?.[1] ?? 0, dims: n.asset.dimensions }] : [],
  );
  const masks = items.map(({ pos, yaw, dims }) => {
    // Hộp bao trục của khung đồ đã xoay (K1) + 100 mm bóng/viền. Dùng hình tròn ngoại tiếp
    // thì che kín phòng nhỏ (phòng làm việc F1-ext ra 0 điểm ảnh).
    const [hw, hd] = [(dims[0] * 1000) / 2, (dims[2] * 1000) / 2];
    const rx = Math.abs(hw * Math.cos(yaw)) + Math.abs(hd * Math.sin(yaw)) + 100;
    const ry = Math.abs(hw * Math.sin(yaw)) + Math.abs(hd * Math.cos(yaw)) + 100;
    const [x, y] = [pos[0] * 1000, pos[2] * 1000];
    return [px(x - rx, y - ry), px(x + rx, y - ry), px(x + rx, y + ry), px(x - rx, y + ry)] as const;
  });
  const rooms = await Promise.all(
    graph.rooms.map(async (room) => {
      const poly = room.outline.map((p) => px(p.x, p.y));
      const { lab, pixels } = await medianLabIn(top, poly, masks);
      return { id: room.id, usage: room.usage, finish: floorMaterialOf(room), poly, lab, pixels };
    }),
  );
  // Ảnh phủ đường bao phòng để kiểm phép quy toạ độ bằng mắt.
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${box.width}" height="${box.height}">${rooms
    .map((r) => `<polygon points="${r.poly.map((p) => p.join(',')).join(' ')}" fill="none" stroke="magenta" stroke-width="2"/>`)
    .join('')}</svg>`;
  const sharp = (await import('sharp')).default;
  await sharp(top)
    .composite([{ input: Buffer.from(overlay), left: 0, top: 0 }])
    .toFile(`${EVIDENCE}/C10-top-F1-ext-overlay.png`);

  const lines = rooms.map(
    (r) => `${r.id}\t${r.usage}\t${r.finish}\tL ${r.lab[0].toFixed(1)}\ta ${r.lab[1].toFixed(1)}\tb ${r.lab[2].toFixed(1)}\tpx ${r.pixels}`,
  );
  const pairs: string[] = [];
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const [p, q] = [rooms[i]!, rooms[j]!];
      const same = p.finish === q.finish;
      // Khác lớp hoàn thiện: ΔE76 đủ cả L (gạch và mosaic khác độ sáng có chủ ý); cùng lớp: chỉ a*b*.
      const de = same ? deltaAB(p.lab, q.lab) : Math.hypot(p.lab[0] - q.lab[0], p.lab[1] - q.lab[1], p.lab[2] - q.lab[2]);
      pairs.push(`${p.id}~${q.id}\t${same ? 'same' : 'diff'}\t${de.toFixed(2)}`);
      if (same) expect.soft(de, `C10 ΔEab ${p.id}~${q.id} (cùng ${p.finish})`).toBeLessThan(6);
      else expect.soft(de, `C10 ΔEab ${p.id}~${q.id} (${p.finish}/${q.finish})`).toBeGreaterThanOrEqual(10);
    }
  }
  fs.writeFileSync(`${EVIDENCE}/C10-F1-ext.tsv`, `${lines.join('\n')}\n\n${pairs.join('\n')}\n`);
  console.log(`C10\n${lines.join('\n')}\n${pairs.join('\n')}`);

  // Ảnh cạnh nhau là dáng người dùng thấy: bật đèn lại.
  await page.evaluate(() => (window as unknown as { __pascalProbe: PascalProbe }).__pascalProbe.setLights(true));
  // C11 (a) — phối cảnh gần góc trang đăng nhập: cao 50°, xoay 0,05 vòng (director.ts DEFAULT_CAMERA_RIG).
  const el = (50 * Math.PI) / 180;
  const az = 0.05 * 2 * Math.PI;
  const dist = (Math.hypot(ext.w, ext.d) * 0.55 * 1.03) / Math.sin((35 * Math.PI) / 360);
  await setCamera(
    page,
    [ext.cx + dist * Math.cos(el) * Math.sin(az), dist * Math.sin(el), ext.cz + dist * Math.cos(el) * Math.cos(az)],
    [ext.cx, 0, ext.cz],
    35,
  );
  const persp = await page.screenshot({ clip: box });
  fs.writeFileSync(`${EVIDENCE}/C11-pascal-overview.png`, persp);

  // (b) — trang đăng nhập: từ 2354b28e là mặt bằng SVG (không còn canvas three.js), chụp khung hình đó.
  await page.goto('/login');
  const plan = page.locator('.auth-plan-art');
  await plan.waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(5000);
  const login = await plan.screenshot();
  fs.writeFileSync(`${EVIDENCE}/C11-login-house.png`, login);

  await sideBySide(
    [
      { png: persp, label: 'Pascal (sau sửa)' },
      { png: login, label: 'Trang đăng nhập' },
    ],
    `${EVIDENCE}/SBS-overview.png`,
  );
  await sideBySide(
    [
      { png: top, label: 'Pascal (sau sửa) — nhìn từ trên' },
      { png: login, label: 'Trang đăng nhập (mặt bằng SVG)' },
    ],
    `${EVIDENCE}/SBS-top.png`,
  );
});
