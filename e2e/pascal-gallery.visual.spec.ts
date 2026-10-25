/**
 * Bộ ảnh duyệt bằng mắt: mỗi bản vẽ CubiCasa đã chuyển (gallery `manifest.json`, J1) mở
 * trên trang 3D riêng qua máy chủ giả, chụp phối cảnh + từ trên + cạnh bản vẽ gốc.
 *
 * Biến môi trường: `PASCAL_GALLERY_DIR` (thư mục gallery), `PASCAL_STYLE` (id phong cách,
 * ghi vào localStorage trước khi trang chạy), `PASCAL_GALLERY_ONLY=key,key` (lọc).
 * Chạy tuần tự (một chỗ e2e). Lỗi console chỉ soft-assert để ảnh vẫn được ghi đủ.
 */
import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { SpatialGraphDocumentSchema } from '../src/api/schemas/spatialGraph';
import { sceneStyleOf } from '../src/lib/pascal/sceneStyles';
import { toPascalScene, waitCameraStill } from './fixtures/pascalPageScene';
import type { PascalProbe } from '../src/pascal-page/createProbe';

import { installFakeApi, type WireGraphDocument } from './fixtures/fakeApi';
import { findOffMachineRequests, trackRequestUrls } from './fixtures/pascalGuards';
import { sideBySide } from './fixtures/sbs';

type Vec3 = [number, number, number];
interface Entry {
  key: string;
  doc: string;
  png: string;
}

const DIR = process.env.PASCAL_GALLERY_DIR ?? 'F:/App/qa-results/fe3d-fix/gallery';
const MANIFEST = path.join(DIR, 'manifest.json');
const STYLE = process.env.PASCAL_STYLE;
const ONLY = process.env.PASCAL_GALLERY_ONLY?.split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const OUT = path.join(DIR, 'shots', STYLE ?? 'default');
const SCENE_STYLE_STORAGE_KEY = 'appfront.pascal.sceneStyle.v1'; // J9, chép cứng
const PROJECT_ID = 'P-FIXTURE0001';
const VIEWPORT = { width: 1440, height: 900 };
const READY_TIMEOUT_MS = 60_000;
const TOP_FOV = 30;
const ISO_FOV = 35;
const COUNTED_TYPES = ['wall', 'door', 'window', 'slab', 'zone', 'item', 'ceiling'] as const;

const entries: Entry[] = fs.existsSync(MANIFEST)
  ? (JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as { entries: Entry[] }).entries.filter(
      (e) => !ONLY || ONLY.includes(e.key),
    )
  : [];

test.skip(!fs.existsSync(MANIFEST), `Không có ${MANIFEST}`);

// Một chỗ e2e: mọi ca trong tệp chạy tuần tự trên cùng một worker (config bật fullyParallel).
test.describe.configure({ mode: 'default' });

for (const entry of entries) {
  test(`gallery ${entry.key}`, async ({ page }) => {
    test.setTimeout(120_000);
    const raw: unknown = JSON.parse(fs.readFileSync(path.join(DIR, entry.doc), 'utf8'));
    const { graph } = SpatialGraphDocumentSchema.parse(raw);
    // Cùng phong cách trang đọc từ khoá J9 bên dưới (id lạ/thiếu → mặc định, như `readSceneStyle`).
    const { scene, skipped } = toPascalScene(graph, { style: sceneStyleOf(STYLE) });
    const tally: Record<string, number> = {};
    for (const node of Object.values(scene.nodes)) tally[node.type] = (tally[node.type] ?? 0) + 1;
    const counts = Object.fromEntries(COUNTED_TYPES.map((t) => [t, tally[t] ?? 0]));

    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    const urls = trackRequestUrls(page);
    if (STYLE) {
      await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [
        SCENE_STYLE_STORAGE_KEY,
        STYLE,
      ] as const);
    }
    await page.setViewportSize(VIEWPORT);
    await installFakeApi(page, { projectId: PROJECT_ID, graphDoc: raw as WireGraphDocument });

    const t0 = Date.now();
    await page.goto(`/editor3d.html?project=${PROJECT_ID}&probe=1`);
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
    const readyMs = Date.now() - t0;
    // Sau `ready()` trang còn tự canh máy quay lần đầu, đè lên tư thế đặt sớm (xem C10).
    await page.waitForTimeout(5000);

    const box = await page.evaluate(() => {
      const b = [...document.querySelectorAll('canvas')]
        .map((c) => c.getBoundingClientRect())
        .sort((p, q) => q.width * q.height - p.width * p.height)[0]!;
      return { x: b.x, y: b.y, width: b.width, height: b.height };
    });
    const pts = graph.walls.flatMap((w) => [w.centreline.start, w.centreline.end]);
    const xs = pts.map((p) => p.x / 1000);
    const zs = pts.map((p) => p.y / 1000);
    const [cx, cz] = [
      (Math.min(...xs) + Math.max(...xs)) / 2,
      (Math.min(...zs) + Math.max(...zs)) / 2,
    ];
    const [w, d] = [Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)];
    const shoot = async (pos: Vec3, fov: number) => {
      await page.evaluate(
        ([p, t, f]) =>
          (window as unknown as { __pascalProbe: PascalProbe }).__pascalProbe.setCamera(p, t, f),
        [pos, [cx, 0, cz] as Vec3, fov] as const,
      );
      await page.waitForTimeout(2500); // máy quay trượt dần tới tư thế mới
      await waitCameraStill(page, box);
      return page.screenshot({ clip: box });
    };

    // Phối cảnh: cao 50°, xoay 0,05 vòng như C11.
    const el = (50 * Math.PI) / 180;
    const az = 0.05 * 2 * Math.PI;
    const dist = (Math.hypot(w, d) * 0.55 * 1.03) / Math.sin((ISO_FOV * Math.PI) / 360);
    const iso = await shoot(
      [
        cx + dist * Math.cos(el) * Math.sin(az),
        dist * Math.sin(el),
        cz + dist * Math.cos(el) * Math.cos(az),
      ],
      ISO_FOV,
    );
    const half = Math.tan((TOP_FOV * Math.PI) / 360);
    const h = (Math.max(d, (w * box.height) / box.width) * 0.6) / half;
    const top = await shoot([cx, h, cz + h * 1e-3], TOP_FOV);

    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, `${entry.key}-iso.png`), iso);
    fs.writeFileSync(path.join(OUT, `${entry.key}-top.png`), top);
    await sideBySide(
      [
        { png: top, label: 'Pascal' },
        { png: fs.readFileSync(entry.png), label: 'Bản vẽ gốc' },
      ],
      path.join(OUT, `${entry.key}-sbs.png`),
    );

    const external = findOffMachineRequests(urls);
    const row = [
      entry.key,
      readyMs,
      graph.walls.length,
      graph.openings.length,
      graph.rooms.length,
      graph.furniture.length,
      skipped.length,
      pageErrors.length,
      consoleErrors.length,
      external.length,
    ];
    fs.appendFileSync(path.join(OUT, 'summary.tsv'), `${row.join('\t')}\n`);

    expect.soft(consoleErrors, 'lỗi console').toEqual([]);
    expect(pageErrors, 'pageerror').toEqual([]);
    expect(external, 'request rời máy').toEqual([]);
  });
}
