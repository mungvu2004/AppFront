/**
 * F-14 — một chuỗi FE + BE thật trên compose của AppBack: đăng nhập → CSP/Draco → dự án →
 * tầng → bản vẽ → pipeline (SSE) → sửa tường tự lưu → 3D → Pascal → phục hồi → registry.
 *
 * Không `page.route`, không mock: mỗi bước khẳng định ít nhất một response `/api/` thật.
 * Điều kiện trước và cách chạy: `e2e/fullstack/README.md`.
 */
import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';

import {
  ModelFamilyPageSchema,
  ModelVersionPageSchema,
  ModelVersionSchema,
} from '@/api/schemas/adminMl';
import { ProgressSchema } from '@/api/schemas/index';
import { FloorLayerWriteResultSchema } from '@/api/schemas/spatialLayer';
import { ROUTES } from '@/routes/paths';

import { EMAIL_LABEL, PASSWORD_LABEL, SIGN_IN_LABEL } from '../fixtures/session';
import { TOUR_APPEAR_TIMEOUT_MS, dismissTour } from '../fixtures/tour';
import { describeEntry, expectNoApiErrors, waitForApi, watchApi, watchSse } from './apiWatch';
import type { ApiEntry } from './apiWatch';
import { loadDracoDecoder, watchCsp } from './csp';
import {
  AUTOSAVE_TIMEOUT_MS,
  CHAIN_TIMEOUT_MS,
  PASCAL_RENDER_TIMEOUT_MS,
  PIPELINE_TIMEOUT_MS,
  readFullstackEnv,
} from './env';

const ACCESS_DENIED_PATTERN = /\/khong-co-quyen/u;
const REFRESH_COOKIE = 'appback_refresh';
const FLOOR_HEIGHT_M = '3';
const PASCAL_FLAG_KEY = 'scene.pascal-viewer';
/** Chữ `status` lúc cảnh Pascal dựng xong — như `e2e/pascal-viewer.spec.ts`. */
const PASCAL_SUCCESS_CAPTION = 'Đã dựng xong toàn bộ bản vẽ.';
const PASCAL_MOUNT_PATTERN = /\/assets\/pascal\/pascal-mount\.js\?v=[0-9a-f]{8}$/u;
const OPENING_FAMILY = 'openingAndFurnitureDetection';
const OPENING_FAMILY_LABEL = /nhận diện cửa và đồ đạc/iu;
const ERROR_CODE_PATTERN = /\b[A-Z][A-Z0-9_]{2,}\b/u;

type Json = Record<string, unknown>;

const asRecord = (value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${what}: thân không phải đối tượng JSON`);
  }
  return value as Json;
};

const idOf = (body: unknown, what: string): string => {
  const id = asRecord(body, what).id;

  if (typeof id !== 'string' || id === '') throw new Error(`${what}: thân không có "id"`);
  return id;
};

const pathOf = (page: Page): string => new URL(page.url()).pathname;

/** A11 — giữa chuỗi không màn trắng, không `forbidden`. */
async function expectScreenAlive(page: Page): Promise<void> {
  await expect(page).not.toHaveURL(ACCESS_DENIED_PATTERN);
  await expect(page.getByRole('main').first()).toBeVisible();
}

/** Khoá ổn định của một giá trị JSON, không phụ thuộc thứ tự khoá. */
const stable = (value: unknown): string =>
  JSON.stringify(value, (_key, inner: unknown) =>
    typeof inner === 'object' && inner !== null && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner as Json).sort(([a], [b]) => a.localeCompare(b)))
      : inner,
  );

const wallsOf = (body: unknown, what: string): Json[] => {
  const layer = asRecord(asRecord(body, what).layer, `${what}.layer`);
  const walls = layer.walls;

  if (!Array.isArray(walls)) throw new Error(`${what}: không có layer.walls`);
  return walls.map((wall, index) => asRecord(wall, `${what}.layer.walls[${String(index)}]`));
};

const wallById = (walls: readonly Json[], id: string, what: string): Json => {
  const wall = walls.find((candidate) => candidate.id === id);

  if (wall === undefined) throw new Error(`${what}: không thấy tường ${id}`);
  return wall;
};

/** Khoá của tường đổi giữa hai bản. */
const changedKeys = (before: Json, after: Json): string[] =>
  [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (key) => stable(before[key]) !== stable(after[key]),
  );

const pick = (wall: Json, keys: readonly string[]): string =>
  stable(Object.fromEntries(keys.map((key) => [key, wall[key]])));

const countEntries = (log: readonly ApiEntry[], method: string, pattern: RegExp, from = 0): number =>
  log.slice(from).filter((entry) => entry.method === method && pattern.test(entry.path)).length;

async function expectApiSince(log: readonly ApiEntry[], mark: number, what: string): Promise<void> {
  await expect
    .poll(() => log.slice(mark).filter((entry) => entry.status < 400).length, {
      message: `${what}: không có response /api/ thật nào`,
    })
    .toBeGreaterThan(0);
}

async function saveTraceOnFailure(page: Page, testInfo: TestInfo): Promise<void> {
  const path = testInfo.outputPath('trace.zip');

  await page.context().tracing.stop({ path });
  await testInfo.attach('trace', { path, contentType: 'application/zip' });
}

test('chuỗi FE + BE trên compose: từ đăng nhập tới registry', async ({ page, context }, testInfo) => {
  test.setTimeout(CHAIN_TIMEOUT_MS);
  const env = readFullstackEnv();

  /* 0 — nghe trước lượt goto đầu. */
  const cspViolations = await watchCsp(context);
  const sse = await watchSse(page);
  const api = watchApi(page);

  /* 1 — đăng nhập bằng biểu mẫu thật. */
  let loginIndex = -1;

  await test.step('1. đăng nhập', async () => {
    const login = waitForApi(page, 'POST', /^\/api\/auth\/login$/u, [204]);
    const refresh = waitForApi(page, 'POST', /^\/api\/auth\/refresh$/u, [200]);

    await page.goto(ROUTES.login);
    await page.getByLabel(EMAIL_LABEL, { exact: true }).fill(env.adminEmail);
    await page.getByLabel(PASSWORD_LABEL, { exact: true }).fill(env.adminPassword);
    await page.getByRole('button', { name: SIGN_IN_LABEL, exact: true }).click();
    await login;
    loginIndex = api.findIndex((entry) => entry.method === 'POST' && entry.path === '/api/auth/login');
    await refresh;
    await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);

    const cookie = (await context.cookies()).find((candidate) => candidate.name === REFRESH_COOKIE);

    expect(
      cookie === undefined
        ? null
        : { name: cookie.name, httpOnly: cookie.httpOnly, secure: cookie.secure, sameSite: cookie.sameSite },
    ).toEqual({ name: REFRESH_COOKIE, httpOnly: true, secure: true, sameSite: 'Strict' });
  });

  // Sau đăng nhập mới bật trace: ảnh DOM ghi `value` của mọi ô, kể cả ô mật khẩu.
  await context.tracing.start({ screenshots: true, snapshots: true });

  try {
    await runChain(page, env.drawingPng, api, sse, loginIndex, cspViolations);
  } catch (error) {
    await saveTraceOnFailure(page, testInfo);
    throw error;
  }
  await context.tracing.stop();
});

async function runChain(
  page: Page,
  drawingPng: string,
  api: ApiEntry[],
  sse: Awaited<ReturnType<typeof watchSse>>,
  loginIndex: number,
  cspViolations: Awaited<ReturnType<typeof watchCsp>>,
): Promise<void> {
  let projectId = '';
  let floorId = '';
  let floorName = '';
  let changedWallId = '';
  let changedWallKeys: string[] = [];
  let wallBefore: Json = {};
  let wallAfter: Json = {};
  let autosaveCount = 0;
  let restoreIndex = -1;
  const layerPath = (): RegExp =>
    new RegExp(`^/api/projects/${projectId}/floors/${floorId}/spatial/layer$`, 'u');

  await test.step('2. CSP và Draco (phiên phục hồi sau tải lại)', async () => {
    const mark = api.length;
    const refresh = waitForApi(page, 'POST', /^\/api\/auth\/refresh$/u, [200]);

    await page.reload();
    await refresh;
    await expectScreenAlive(page);
    expect(await loadDracoDecoder(page)).toBe('ok');
    await expectApiSince(api, mark, 'bước 2');
  });

  await test.step('3. tạo dự án', async () => {
    await page.getByRole('button', { name: /^Dự án mới/u }).click();
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel('Tên dự án').fill(`e2e-${String(Date.now())}`);
    await dialog.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
    // Bốn tầng mặc định chưa có chiều cao: "Tiếp tục" khoá tới khi áp một chiều cao chung.
    await dialog.getByLabel('Chiều cao áp cho mọi tầng').fill(FLOOR_HEIGHT_M);
    await dialog.getByRole('button', { name: 'Áp cho mọi tầng', exact: true }).click();
    await dialog.getByRole('button', { name: 'Tiếp tục', exact: true }).click();

    const created = waitForApi(page, 'POST', /^\/api\/projects$/u, [200, 201]);

    await dialog.getByRole('button', { name: 'Tạo dự án', exact: true }).click();
    projectId = idOf(await (await created).json(), '#25');
  });

  await test.step('4. thêm tầng', async () => {
    await page.goto(ROUTES.project.floors(projectId));
    await expectScreenAlive(page);
    const created = waitForApi(page, 'POST', new RegExp(`^/api/projects/${projectId}/floors$`, 'u'), [200, 201]);

    await page.getByRole('button', { name: 'Thêm tầng', exact: true }).click();
    const body = asRecord(await (await created).json(), '#10');

    floorId = idOf(body, '#10');
    if (typeof body.name !== 'string') throw new Error('#10: thân không có "name"');
    floorName = body.name;
  });

  await test.step('5. tải bản vẽ', async () => {
    await page.goto(ROUTES.project.upload(projectId));
    await expectScreenAlive(page);
    const init = waitForApi(
      page,
      'POST',
      new RegExp(`^/api/projects/${projectId}/floors/${floorId}/drawings/uploads$`, 'u'),
      [200, 201],
    );
    const chunk = page.waitForResponse(
      (response) => /\/drawings\/uploads\/[^/]+\/chunks$/u.test(new URL(response.url()).pathname) && response.ok(),
    );
    const complete = waitForApi(page, 'POST', /\/drawings\/uploads\/[^/]+\/complete$/u, [200]);

    await page.getByTestId('floor-upload-file-input').setInputFiles(drawingPng);
    // Tên tệp không đoán được tầng → khay "Tệp chưa gán tầng"; gán cho tầng của bước 4.
    await page.getByRole('combobox', { name: 'Gán cho tầng khác' }).click();
    await page.getByRole('option', { name: floorName, exact: true }).click();
    await init;
    await chunk;
    await complete;
  });

  await test.step('6. pipeline qua SSE', async () => {
    const mark = api.length;

    await page.goto(ROUTES.project.pipeline(projectId));
    await expectScreenAlive(page);
    const done = page.getByText(/^Đã xong (\d+)\/\1 tầng/u);
    const failure = page.getByRole('button', { name: 'Sao chép mã lỗi' });

    await expect(done.or(failure).first()).toBeVisible({ timeout: PIPELINE_TIMEOUT_MS });
    if (await failure.isVisible()) {
      const text = (await page.getByRole('main').first().innerText()).match(ERROR_CODE_PATTERN);

      throw new Error(`màn lỗi pipeline hiện ra: ${text?.[0] ?? '(không đọc được mã)'}`);
    }

    const stream = `/api/streams/projects/${projectId}/uploads/`;

    expect(sse.requestUrls.some((url) => url.includes(stream)), `không có request tới ${stream}`).toBe(true);
    // BE luôn gửi snapshot khi nối luồng, nên cả lượt "xong trước khi mở luồng" cũng có sự kiện.
    await expect
      .poll(
        () =>
          sse.messages.filter((message) => {
            if (!message.url.includes(stream)) return false;
            let data: unknown = null;

            try {
              data = JSON.parse(message.data);
            } catch {
              return false; // nhịp giữ kết nối hay dòng không phải JSON: không phải bằng chứng
            }
            const parsed = ProgressSchema.safeParse(data);

            return parsed.success && parsed.data.status === 'completed';
          }).length,
        { message: `không có sự kiện SSE "completed" giải được bằng ProgressSchema ở ${stream}` },
      )
      .toBeGreaterThan(0);
    await expectApiSince(api, mark, 'bước 6');
  });

  await test.step('7. sửa tường, tự lưu', async () => {
    const read = waitForApi(page, 'GET', layerPath(), [200]);

    await page.goto(ROUTES.project.walls(projectId, floorId));
    const walls = wallsOf(await (await read).json(), 'N16');

    expect(walls.length).toBeGreaterThan(0);
    await dismissTour(page);
    await expectScreenAlive(page);

    const list = page.getByRole('listbox', { name: 'Danh sách đoạn tường' });

    await list.getByRole('option').first().click();
    const write = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' && layerPath().test(new URL(response.url()).pathname),
      { timeout: AUTOSAVE_TIMEOUT_MS },
    );
    const thickness = page.getByRole('radiogroup', { name: 'Độ dày tường' });

    if ((await thickness.count()) > 0) {
      await thickness.getByRole('radio', { checked: false }).first().click();
    } else {
      await page.getByRole('button', { name: 'Duyệt đoạn này' }).first().click();
    }
    // A7 — không có nút lưu.
    await expect(page.getByRole('button', { name: 'Lưu', exact: true })).toHaveCount(0);

    const response = await write;

    expect(response.status()).toBe(200);
    FloorLayerWriteResultSchema.parse(await response.json());

    const sent: unknown = response.request().postDataJSON();
    // Thân #35 là `{ baseVersion, body: { layer } }` (`VersionedWriteSchema`).
    const sentWalls = wallsOf(asRecord(sent, '#35').body, '#35');
    const changed = sentWalls.find((wall) => {
      const id = wall.id;

      return typeof id === 'string' && changedKeys(wallById(walls, id, 'N16'), wall).length > 0;
    });

    if (changed === undefined || typeof changed.id !== 'string') throw new Error('#35 không đổi tường nào');
    changedWallId = changed.id;
    wallBefore = wallById(walls, changedWallId, 'N16');
    wallAfter = changed;
    changedWallKeys = changedKeys(wallBefore, wallAfter);

    const reread = waitForApi(page, 'GET', layerPath(), [200]);

    await page.reload();
    const reloaded = wallById(wallsOf(await (await reread).json(), 'N16 sau tải lại'), changedWallId, 'N16');

    expect(pick(reloaded, changedWallKeys)).toBe(pick(wallAfter, changedWallKeys));
    autosaveCount = countEntries(api, 'PUT', layerPath());
  });

  await test.step('8. 3D', async () => {
    const scene = waitForApi(page, 'GET', new RegExp(`^/api/projects/${projectId}/spatial$`, 'u'), [200]);

    await page.goto(ROUTES.project.viewer(projectId));
    await scene;
    await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
    const viewport = page.getByRole('main', { name: 'Khung nhìn mô hình' });

    await expect(viewport).toBeVisible();
    await expect(viewport.locator('canvas').first()).toBeVisible();
    await expect(page).not.toHaveURL(ACCESS_DENIED_PATTERN);
  });

  await test.step('8b. Pascal', async () => {
    const flags = waitForApi(page, 'GET', /^\/api\/feature-flags$/u, [200]);
    const mount = page.waitForResponse((response) => PASCAL_MOUNT_PATTERN.test(response.url()), {
      timeout: PASCAL_RENDER_TIMEOUT_MS,
    });

    await page.goto(ROUTES.project.viewerPascal(projectId));
    expect(asRecord(await (await flags).json(), 'GET /api/feature-flags')[PASCAL_FLAG_KEY]).toBe(true);
    await expect(page.getByTestId('pascal-canvas')).toBeVisible({ timeout: PASCAL_RENDER_TIMEOUT_MS });
    await expect(page.getByRole('status').filter({ hasText: PASCAL_SUCCESS_CAPTION })).toHaveText(
      PASCAL_SUCCESS_CAPTION,
      { timeout: PASCAL_RENDER_TIMEOUT_MS },
    );

    const script = await mount;

    expect(script.status()).toBe(200);
    // B-V10-41 phía BE: tên tệp cố định thì không được `immutable`.
    expect(script.headers()['cache-control'] ?? '').toContain('no-cache');
    await expect(page).not.toHaveURL(ACCESS_DENIED_PATTERN);
  });

  await test.step('9. phục hồi phiên bản', async () => {
    const versionsPath = new RegExp(`^/api/projects/${projectId}/versions$`, 'u');
    const ofFloor = (entry: ApiEntry): boolean =>
      entry.method === 'GET' &&
      versionsPath.test(entry.path) &&
      entry.status === 200 &&
      new URLSearchParams(entry.search).get('floorId') === floorId;
    const mark = api.length;

    await page.goto(ROUTES.project.versions(projectId));
    await expectScreenAlive(page);
    const floorSelect = page.getByRole('combobox', { name: 'Tầng' });

    await floorSelect.click();
    await page.getByRole('option', { name: floorName, exact: true }).click();
    await expect
      .poll(() => api.slice(mark).some(ofFloor), { message: `không có N17 200 cho tầng ${floorId}` })
      .toBe(true);

    const list = page.getByRole('navigation', { name: 'Danh sách phiên bản' });
    const target = list.getByRole('listitem').filter({ hasNotText: 'Hiện tại' }).first();

    await target.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Phục hồi phiên bản này' }).click();
    const restore = waitForApi(page, 'POST', /\/api\/projects\/[^/]+\/versions\/[^/]+\/restore$/u, [200, 201]);

    await page.getByRole('dialog').getByRole('button', { name: 'Phục hồi', exact: true }).click();
    await restore;
    restoreIndex = api.map((entry) => entry.method === 'POST' && entry.path.endsWith('/restore')).lastIndexOf(true);

    const reread = waitForApi(page, 'GET', layerPath(), [200]);

    await page.goto(ROUTES.project.walls(projectId, floorId));
    const restored = wallById(wallsOf(await (await reread).json(), 'N16 sau phục hồi'), changedWallId, 'N16');

    expect(pick(restored, changedWallKeys)).toBe(pick(wallBefore, changedWallKeys));
    await dismissTour(page);
  });

  await test.step('10. registry', async () => {
    const familiesRead = waitForApi(page, 'GET', /^\/api\/admin\/ml\/model-families$/u, [200]);

    await page.goto(ROUTES.adminTrainingModels);
    const families = ModelFamilyPageSchema.parse(await (await familiesRead).json());
    const family = families.items.find((item) => item.family === OPENING_FAMILY);

    if (family === undefined) throw new Error(`N23 không có họ ${OPENING_FAMILY}`);
    await expectScreenAlive(page);

    const versionsRead = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname === '/api/admin/ml/model-versions' &&
        response.url().includes(OPENING_FAMILY) &&
        response.status() === 200,
    );

    await page.getByRole('radio', { name: OPENING_FAMILY_LABEL }).click();
    const versions = ModelVersionPageSchema.parse(await (await versionsRead).json());

    expect(versions.items.length).toBeGreaterThan(0);

    const detailPath = /^\/api\/admin\/ml\/model-versions\/[^/]+$/u;
    const detailSeen = (): ApiEntry | undefined =>
      api.find((entry) => entry.method === 'GET' && detailPath.test(entry.path) && entry.status === 200);

    if (detailSeen() === undefined) {
      const first = versions.items[0];

      if (first === undefined) throw new Error('N25 rỗng');
      const detail = waitForApi(page, 'GET', detailPath, [200]);

      await page.getByRole('button', { name: first.label, exact: true }).click();
      ModelVersionSchema.parse(await (await detail).json());
    } else {
      await expect.poll(() => detailSeen() !== undefined).toBe(true);
    }

    /* 10b — N24 bằng nút trên màn: kích hoạt bản thứ hai, rồi kích hoạt lại bản cũ. */
    const original = versions.items.find((item) => item.id === family.activeVersionId);
    const candidate = versions.items.find(
      (item) =>
        item.id !== family.activeVersionId && item.evaluationStatus === 'completed' && item.weightsFormat === 'onnx',
    );

    if (original === undefined || candidate === undefined) {
      throw new Error(
        `họ ${OPENING_FAMILY} cần một bản đang dùng và một bản thứ hai onnx đã đánh giá: ` +
          'xem điều kiện 7 của e2e/fullstack/README.md',
      );
    }

    for (const version of [candidate, original]) {
      const activate = waitForApi(page, 'PUT', new RegExp(`^/api/admin/ml/model-families/${OPENING_FAMILY}/active$`, 'u'), [200]);
      const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: version.label, exact: true }) });

      await row.getByRole('button', { name: 'Kích hoạt', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Kích hoạt', exact: true }).click();
      await activate;
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
  });

  await test.step('11. kết', () => {
    if (cspViolations.length > 0) {
      console.error(`[fullstack] vi phạm CSP: ${JSON.stringify(cspViolations)}`);
    }
    expect(cspViolations).toEqual([]);

    expect(countEntries(api, 'PUT', layerPath())).toBe(autosaveCount);
    const lateWrites = api.slice(restoreIndex + 1).filter((entry) => entry.method === 'PUT' && layerPath().test(entry.path));

    expect(lateWrites.map(describeEntry)).toEqual([]);

    expectNoApiErrors(
      api,
      (entry, index) =>
        entry.method === 'POST' && entry.path === '/api/auth/refresh' && entry.status === 401 && index < loginIndex,
    );
    return Promise.resolve();
  });
}
