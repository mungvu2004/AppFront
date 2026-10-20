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
import { floorMaterialOf } from '../src/lib/pascal/sceneDressing';
import { toPascalScene } from '../src/lib/pascal/toPascal';

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
const SCALE_BANNER_TEXT = 'Bản vẽ chưa hiệu chỉnh tỷ lệ';
/** console.error được phép (C1). Thêm từng dòng kèm lý do. */
const CONSOLE_ERROR_ALLOW: readonly RegExp[] = [];
/** Loại node mà bài so số với `toPascalScene` (bỏ site/building/level của editor). */
const COUNTED_TYPES = ['wall', 'door', 'window', 'slab', 'zone', 'item', 'ceiling'] as const;

declare global {
  interface Window {
    __pascalProbe?: {
      ready(): boolean;
      counts(): Record<string, number>;
      itemLoadFailures(): Record<string, unknown>;
      materials(): { slabs: Record<string, string | undefined>; walls: Record<string, unknown> };
      shading(): string | undefined;
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
  return { counts: pick, slabs, hasStair: graph.furniture.some((f) => f.kind === 'stair') };
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
      return { failures: probe.itemLoadFailures(), materials: probe.materials(), shading: probe.shading() };
    });

    // C1
    expect.soft(seen.pageErrors, 'C1 pageerror').toEqual([]);
    expect.soft(seen.assetLogs, 'C1 asset:// / Asset not found').toEqual([]);
    expect.soft(seen.consoleErrors, 'C1 console.error ngoài allow-list').toEqual([]);
    // C2 — cầu thang dùng `asset://appfront/stair` (khoảng hở đã biết, T14) nên loại khỏi C2.
    const failures = Object.keys(state.failures).filter((k) => !(expected.hasStair && /stair/iu.test(k)));
    expect.soft(failures, 'C2 itemLoadFailures').toEqual([]);
    expect.soft([...seen.badAssets], 'C2 .glb/.ktx2/.webp trả text/html').toEqual([]);
    // C3
    expect.soft(findOffMachineRequests(seen.urls), 'C3 request rời máy').toEqual([]);
    // C6 — trần = phòng, chỉ khi T16 đã có trong toPascalScene.
    const ceilings = c.ceiling ?? 0;
    if (ceilings > 0) expect.soft(ceilings, 'C6 ceiling = rooms').toBe(fixture.expected.rooms);
    else test.info().annotations.push({ type: 'fixme', description: 'C6: toPascalScene chưa sinh trần/đèn (T16 chưa vào)' });
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
      console.error(`Refused to (securitypolicyviolation) ${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  const api = await open(page, fixture);
  await waitForScene(page, expected.counts);
  expect.soft(violations, 'C4 vi phạm CSP').toEqual([]);
  expect(api.unexpected).toEqual([]);
});

test.fixme('C8: F2 góc quay item khớp −rotationDeg', async () => {
  // Đầu dò chưa có `nodes(type)` trả {id, position, rotation}; createProbe.ts không thuộc T18.
});

test.fixme('C13: F1 sửa độ dày tường → PUT hợp lệ → tải lại vẫn giữ', async () => {
  // Cần luồng chọn tường trên canvas Pascal + inspector; chưa dựng kịp trong hạn T18.
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

test('C15: F0 rỗng → hiện trạng thái rỗng, 0 pageerror', async ({ page }) => {
  test.setTimeout(90_000);
  const seen = watch(page);
  const api = await open(page, fixtureF0());
  await expect(page.getByText(EMPTY_TEXT)).toBeVisible({ timeout: READY_TIMEOUT_MS });
  expect.soft(seen.pageErrors, 'C15 pageerror').toEqual([]);
  expect(api.unexpected).toEqual([]);
});
