/**
 * Bài đối chiếu trang 3D riêng (`/editor3d.html`) với các bộ dữ liệu giả F0–F5
 * (WP7d: C1–C8, C13–C15). Máy chủ giả `installFakeApi` trả đúng các lượt gọi của cầu
 * `bridge/index.ts`; đầu dò `?probe=1` (`createProbe.ts`) đọc store Pascal.
 *
 * Số mong đợi tính trong Node bằng chính `toPascalScene` + `floorMaterialOf`, nên khi
 * T16 thêm trần/đèn thì bài tự đếm theo, không phải sửa hằng số.
 */
import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { SpatialGraphDocumentSchema } from '../src/api/schemas/spatialGraph';
import { FloorLayerWriteSchema } from '../src/api/schemas/spatialLayer';
import {
  fixtureF0,
  fixtureF1,
  fixtureF2,
  fixtureF3,
  fixtureF4,
  fixtureF5,
  type Fixture,
} from '../src/lib/pascal/__fixtures__';
import { toPascalId } from '../src/lib/pascal/ids';
import { floorMaterialOf, isGeneratedLightId, isGeneratedNodeId } from '../src/lib/pascal/sceneDressing';
import { toPascalScene } from './fixtures/pascalPageScene';

import { installFakeApi, type WireGraphDocument } from './fixtures/fakeApi';
import {
  findOffMachineRequests,
  serveDocumentsWithCsp,
  trackBadAssetResponses,
  trackRequestUrls,
} from './fixtures/pascalGuards';

const PROJECT_ID = 'P-FIXTURE0001';
const VIEWPORT = { width: 1440, height: 900 };
const READY_TIMEOUT_MS = 60_000;
/** Trùng `BRIDGE_EMPTY_ERROR` (`src/pascal-page/bridge/index.ts`) — không nhập mô-đun React vào Node. */
const EMPTY_TEXT = 'Dự án chưa có mô hình để mở trong 3D.';
/** Câu của T17 (`scaleBanner.tsx`). */
const SCALE_BANNER_TEXT = 'tầng chưa hiệu chỉnh tỷ lệ';
/** console.error được phép (C1). Thêm từng dòng kèm lý do. */
const CONSOLE_ERROR_ALLOW: readonly RegExp[] = [];
/** Loại node mà bài so số với `toPascalScene` (bỏ site/building/level của editor). */
const COUNTED_TYPES = ['wall', 'door', 'window', 'slab', 'zone', 'item', 'ceiling'] as const;
/** Cảnh báo vendor `viewer/src/lib/asset-url.ts` khi gặp `asset://` (chỉ thang còn dùng). */
const STAIR_ASSET_WARN = /^Use resolveAssetUrl\(\) for asset:\/\/ URLs, not resolveCdnUrl\(\)$/u;
/** Sai số góc quay của C8. */
const YAW_TOLERANCE_DEG = 0.5;

declare global {
  interface Window {
    __pascalProbe?: {
      ready(): boolean;
      counts(): Record<string, number>;
      itemLoadFailures(): Record<string, unknown>;
      materials(): { slabs: Record<string, string | undefined>; walls: Record<string, unknown> };
      shading(): string | undefined;
      items(): { id: string; position?: number[]; rotation?: number[]; src?: string }[];
      walls(): { id: string; thickness?: number }[];
      editNode(id: string, patch: object): void;
    };
  }
}

/** Số node theo loại + vật liệu sàn mong đợi, tính trong Node. */
const expectedOf = (fixture: Fixture) => {
  const graph = SpatialGraphDocumentSchema.parse(fixture.doc).graph;
  const { scene } = toPascalScene(graph);
  const counts: Record<string, number> = {};
  for (const node of Object.values(scene.nodes)) counts[node.type] = (counts[node.type] ?? 0) + 1;
  const pick = Object.fromEntries(COUNTED_TYPES.map((t) => [t, counts[t] ?? 0]));
  const slabs = Object.fromEntries(graph.rooms.map((room) => [toPascalId('slab', room.id), floorMaterialOf(room)]));
  const stairs = new Set(graph.furniture.filter((f) => f.kind === 'stair').map((f) => toPascalId('item', f.id)));
  const rotationDeg = Object.fromEntries(graph.furniture.map((f) => [toPascalId('item', f.id), f.rotationDeg]));
  // Trần/đèn không còn bằng số phòng (phòng ngoài trời không có): đếm thẳng từ toPascalScene.
  const lights = Object.values(scene.nodes).filter((n) => n.type === 'item' && isGeneratedLightId(n.id)).length;
  return { counts: pick, slabs, stairs, rotationDeg, lights };
};

/** Gom tín hiệu C1/C2/C3 từ trước lượt goto đầu tiên. */
const watch = (page: Page) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const assetLogs: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => {
    const text = m.text();
    if (/asset:\/\/|Asset not found/u.test(text)) assetLogs.push(text);
    if (m.type() === 'error' && !CONSOLE_ERROR_ALLOW.some((re) => re.test(text))) consoleErrors.push(text);
  });
  return { pageErrors, consoleErrors, assetLogs, urls: trackRequestUrls(page), badAssets: trackBadAssetResponses(page) };
};

const open = async (page: Page, fixture: Fixture, layers?: Record<string, Record<string, unknown>>) => {
  await page.setViewportSize(VIEWPORT);
  const api = await installFakeApi(page, {
    projectId: PROJECT_ID,
    graphDoc: fixture.doc as unknown as WireGraphDocument,
    ...(layers ? { layers } : {}),
  });
  await page.goto(`/editor3d.html?project=${PROJECT_ID}&probe=1`);
  return api;
};

/** Chờ đầu dò sẵn sàng VÀ số node khớp — cảnh mặc định của editor cũng "ready". */
const waitForScene = async (page: Page, counts: Record<string, number>) => {
  await expect
    .poll(
      () =>
        page.evaluate(
          ([types]) => {
            const probe = window.__pascalProbe;
            if (!probe?.ready()) return null;
            const all = probe.counts();
            return Object.fromEntries(types.map((t) => [t, all[t] ?? 0]));
          },
          [COUNTED_TYPES] as const,
        ),
      { timeout: READY_TIMEOUT_MS, message: 'probe.ready() + counts() khớp toPascalScene' },
    )
    .toEqual(counts);
};

const CASES: readonly (readonly [string, () => Fixture])[] = [
  ['F1-ext', () => fixtureF1({ ext: true })],
  ['F1', () => fixtureF1({ ext: false })],
  ['F2', fixtureF2],
  ['F4', fixtureF4],
  ['F5', fixtureF5],
];

for (const [name, make] of CASES) {
  test(`${name}: dựng đủ cảnh, console sạch, không rời máy, vật liệu sàn đúng (C1-C3, C5-C7)`, async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = make();
    const expected = expectedOf(fixture);
    const seen = watch(page);
    const api = await open(page, fixture);

    await waitForScene(page, expected.counts); // C5 (khớp toPascalScene)

    // C5 — đối chiếu toPascalScene với số thực thể của bộ dữ liệu.
    const c = expected.counts;
    expect.soft(c.wall, 'C5 wall = walls').toBe(fixture.expected.walls);
    expect.soft(c.slab, 'C5 slab = rooms').toBe(fixture.expected.rooms);
    expect.soft((c.door ?? 0) + (c.window ?? 0), 'C5 door+window = openings').toBe(fixture.expected.openings);

    const state = await page.evaluate(() => {
      const probe = window.__pascalProbe!;
      return {
        failures: probe.itemLoadFailures(),
        materials: probe.materials(),
        shading: probe.shading(),
        ceilings: probe.counts()['ceiling'] ?? 0,
        lightIds: probe.items().map((item) => item.id),
      };
    });

    // C1
    expect.soft(seen.pageErrors, 'C1 pageerror').toEqual([]);
    // Khoảng hở đã biết (T14): chưa có mô hình thang, item thang giữ `asset://appfront/stair`, nên
    // Pascal cảnh báo `resolveCdnUrl` (câu không kèm id) và ghi hỏng tải cho đúng các id thang.
    // Item khác dùng `asset://` thì C8 bắt (src phải là `/items/...`).
    const assetLogs = seen.assetLogs.filter((t) => !(expected.stairs.size > 0 && STAIR_ASSET_WARN.test(t)));
    expect.soft(assetLogs, 'C1 asset:// / Asset not found (trừ cảnh báo của thang)').toEqual([]);
    expect.soft(seen.consoleErrors, 'C1 console.error ngoài allow-list').toEqual([]);
    // C2 — loại các id item thang (khoảng hở trên).
    const failures = Object.keys(state.failures).filter((id) => !expected.stairs.has(id));
    expect.soft(failures, 'C2 itemLoadFailures').toEqual([]);
    expect.soft([...seen.badAssets], 'C2 .glb/.ktx2/.webp trả text/html').toEqual([]);
    // C3
    expect.soft(findOffMachineRequests(seen.urls), 'C3 request rời máy').toEqual([]);
    // C6 — số trần và đèn tự sinh trong store khớp toPascalScene (phòng ngoài trời không có).
    expect.soft(state.ceilings, 'C6 số trần = toPascalScene').toBe(c.ceiling);
    expect.soft(state.lightIds.filter(isGeneratedLightId).length, 'C6 số đèn tự sinh = toPascalScene').toBe(expected.lights);
    // C7
    expect.soft(state.materials.slabs, 'C7 vật liệu sàn theo floorMaterialOf').toEqual(expected.slabs);
    // Lần mở đầu: shading 'rendered' (T12).
    expect.soft(state.shading, "shading() === 'rendered' lần mở đầu").toBe('rendered');

    expect(api.unexpected, 'máy chủ giả không nhận lượt gọi lạ').toEqual([]);
  });
}

test('C4: F1-ext dưới CSP của nginx — 0 vi phạm, dựng xong', async ({ page }) => {
  test.setTimeout(120_000);
  const fixture = fixtureF1({ ext: true });
  const expected = expectedOf(fixture);
  await serveDocumentsWithCsp(page);
  const violations: string[] = [];
  page.on('console', (m) => {
    if (m.text().includes('Refused to')) violations.push(m.text());
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      // Nguồn + dòng + mẫu để lần ra mã gây vi phạm (T22).
      console.error(
        `Refused to (securitypolicyviolation) ${e.violatedDirective} ${e.blockedURI} @ ${e.sourceFile}:${e.lineNumber}:${e.columnNumber} ${e.sample}`,
      );
    });
  });
  const api = await open(page, fixture);
  await waitForScene(page, expected.counts);
  expect.soft(violations, 'C4 vi phạm CSP').toEqual([]);
  expect(api.unexpected).toEqual([]);
});

test('C8: F2 góc quay item khớp −rotationDeg, mô hình từ /items/', async ({ page }) => {
  test.setTimeout(120_000);
  const fixture = fixtureF2();
  const expected = expectedOf(fixture);
  await open(page, fixture);
  await waitForScene(page, expected.counts);

  const all = await page.evaluate(() => window.__pascalProbe!.items());
  // Đèn trần tự sinh (`item_LIGHT-<phòng>`) không phải đồ đạc của F2: đếm riêng theo toPascalScene.
  const lights = all.filter((item) => isGeneratedLightId(item.id));
  expect.soft(lights.length, 'C8 số đèn trần = toPascalScene').toBe(expected.lights);
  // Đồ bày biện sinh ra (`item_DRESS-…`, J10) không có trong bản vẽ: chỉ soát đồ thật.
  const items = all.filter((item) => !isGeneratedNodeId(item.id));
  expect(items.length, 'C8 có item').toBeGreaterThan(0);
  const offYaw: string[] = [];
  const offSrc: string[] = [];
  for (const item of items) {
    const yawDeg = ((item.rotation?.[1] ?? Number.NaN) * 180) / Math.PI;
    // Lệch góc quy về (−180°, 180°]: yaw + rotationDeg phải ≈ 0.
    const diff = ((((yawDeg + (expected.rotationDeg[item.id] ?? Number.NaN)) % 360) + 540) % 360) - 180;
    if (!(Math.abs(diff) <= YAW_TOLERANCE_DEG)) offYaw.push(`${item.id}: yaw ${yawDeg.toFixed(1)}°`);
    // Thang: khoảng hở đã biết (xem C1/C2).
    if (!expected.stairs.has(item.id) && !item.src?.startsWith('/items/')) offSrc.push(`${item.id}: ${item.src}`);
  }
  expect.soft(offYaw, `C8 yaw == −rotationDeg ±${YAW_TOLERANCE_DEG}°`).toEqual([]);
  expect.soft(offSrc, 'C8 asset.src là /items/... (trừ thang)').toEqual([]);
});

test('C13: F1 sửa độ dày tường → PUT hợp lệ → tải lại vẫn giữ', async ({ page }) => {
  test.setTimeout(180_000);
  const fixture = fixtureF1({ ext: false });
  const expected = expectedOf(fixture);
  const api = await open(page, fixture);
  await waitForScene(page, expected.counts);

  const wall = fixture.doc.graph.walls[0]!;
  const wallId = String(wall['id']);
  const pascalWallId = toPascalId('wall', wallId);
  const thicknessMm = Number(wall['thicknessMm']) + 50;
  /* Trang 3D riêng không hiện trạng thái lưu (editor không nối `onSaveStatusChange`), nên
     "đã lưu" = máy chủ giả trả 200 cho PUT N16 mang độ dày mới — nó chỉ trả 200 khi thân
     qua `FloorLayerWriteSchema` (strict) và `baseVersion` đúng. Sửa qua móc `editNode`
     (`useScene.updateNode`, như inspector) để chạy đúng đường thật: onSave → kho → tự lưu. */
  const putHasEdit = (raw: string | null): boolean => {
    const walls = (JSON.parse(raw ?? '{}') as { body?: { layer?: { walls?: Record<string, unknown>[] } } }).body?.layer?.walls;
    return walls?.some((w) => w['id'] === wallId && w['thicknessMm'] === thicknessMm) ?? false;
  };
  const saved = page.waitForResponse(
    (r) => r.request().method() === 'PUT' && r.url().endsWith('/spatial/layer') && putHasEdit(r.request().postData()),
    { timeout: READY_TIMEOUT_MS },
  );
  await page.evaluate(([id, t]) => window.__pascalProbe!.editNode(id, { thickness: t }), [pascalWallId, thicknessMm / 1000] as const);
  expect((await saved).status(), 'C13 PUT có độ dày mới được máy chủ giả nhận (200)').toBe(200);
  const put = api.puts.find((body) => putHasEdit(JSON.stringify(body)));
  expect(FloorLayerWriteSchema.safeParse(put).success, 'C13 thân PUT qua FloorLayerWriteSchema').toBe(true);

  // `page.route` và trạng thái máy chủ giả sống qua `reload`: N15 trả lớp vừa lưu.
  await page.reload();
  await waitForScene(page, expected.counts);
  const reloaded = await page.evaluate((id) => window.__pascalProbe!.walls().find((w) => w.id === id), pascalWallId);
  expect(reloaded?.thickness, 'C13 tải lại vẫn giữ độ dày mới (m)').toBeCloseTo(thicknessMm / 1000, 6);
  expect(api.unexpected).toEqual([]);
});

test('C14: F3 tỉ lệ chưa giải → hiện băng cảnh báo trong 10 s', async ({ page }) => {
  test.fixme(
    !fs.existsSync(path.join(process.cwd(), 'src', 'pascal-page', 'scaleBanner.tsx')),
    'T17 (băng cảnh báo tỉ lệ) chưa vào',
  );
  test.setTimeout(120_000);
  const fixture = fixtureF3();
  const levelId = String(fixture.doc.graph.levels[0]?.['id']);
  const api = await open(page, fixture, { [levelId]: { scaleStatus: 'unresolved' } });
  await expect(page.getByText(SCALE_BANNER_TEXT)).toBeVisible({ timeout: 10_000 });
  expect(api.unexpected).toEqual([]);
});

test('C15: F0 một tầng chưa có tường → vẫn mở editor để vẽ, 0 pageerror', async ({ page }) => {
  test.setTimeout(90_000);
  const seen = watch(page);
  const fixture = fixtureF0();
  const api = await open(page, fixture);
  // Thẻ về dự án chỉ có khi cầu đã `ready` — tức không rơi vào thông báo rỗng/lỗi.
  await expect(page.getByText('Dự án thử 3D')).toBeVisible({ timeout: READY_TIMEOUT_MS });
  await waitForScene(page, expectedOf(fixture).counts);
  expect(await page.evaluate(() => window.__pascalProbe!.counts()['level'] ?? 0)).toBeGreaterThan(0);
  await expect(page.getByText(EMPTY_TEXT)).toHaveCount(0);
  expect.soft(seen.pageErrors, 'C15 pageerror').toEqual([]);
  expect(api.unexpected).toEqual([]);
});
