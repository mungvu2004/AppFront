/**
 * F-14 — một chuỗi FE + BE thật trên compose của AppBack: đăng nhập → CSP/Draco → dự án →
 * tầng → bản vẽ → pipeline (SSE) → sửa tường tự lưu → 3D → Pascal → phục hồi → registry.
 *
 * Không `page.route`, không mock: mỗi bước khẳng định ít nhất một response `/api/` thật.
 * Điều kiện trước và cách chạy: `e2e/fullstack/README.md`.
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page, TestInfo } from '@playwright/test';

import {
  ModelFamilyPageSchema,
  ModelVersionPageSchema,
  ModelVersionSchema,
} from '@/api/schemas/adminMl';
import { ProgressSchema } from '@/api/schemas/index';
import { FloorLayerWriteResultSchema } from '@/api/schemas/spatialLayer';
import { ROUTES, editor3dHref } from '@/routes/paths';

import { EMAIL_LABEL, PASSWORD_LABEL, SIGN_IN_LABEL } from '../fixtures/session';
import { dismissTour } from '../fixtures/tour';
import {
  describeEntry,
  expectNoApiErrors,
  navigateThenWaitForApi,
  waitForApi,
  waitForApiWhere,
  watchApi,
  watchSse,
  withTimeout,
} from './apiWatch';
import type { ApiEntry } from './apiWatch';
import { loadDracoDecoder, watchCsp } from './csp';
import {
  AUTOSAVE_TIMEOUT_MS,
  CHAIN_TIMEOUT_MS,
  PASCAL_RENDER_TIMEOUT_MS,
  PIPELINE_TIMEOUT_MS,
  TRACE_SAVE_TIMEOUT_MS,
  readFullstackEnv,
} from './env';

const ACCESS_DENIED_PATTERN = /\/khong-co-quyen/u;
const REFRESH_COOKIE = 'appback_refresh';
const FLOOR_HEIGHT_M = '3';
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
/** Bó và bảng kiểu của trang 3D riêng (`public/editor3d.html`), có hoặc không có `?v=`. */
const PASCAL_PAGE_SCRIPT = /\/assets\/pascal\/pascal-page\.js(\?[^/]*)?$/u;
const PASCAL_PAGE_STYLE = /\/assets\/pascal\/style\.css(\?[^/]*)?$/u;
/** B-V10-41: tên cố định + `immutable` một năm thì URL phải mang `?v=` theo nội dung. */
const CONTENT_VERSION = /\?v=[0-9a-f]{8}$/u;
/** Chip lưu của trang 3D (`SaveStatusCard`): "Đã lưu lúc HH:mm". */
const PASCAL_SAVED_PATTERN = /^Đã lưu/u;
const THICKNESS_M = 0.25;
const THICKNESS_ALT_M = 0.3;
const OPENING_FAMILY = 'openingAndFurnitureDetection';
const OPENING_FAMILY_LABEL = /nhận diện cửa và đồ đạc/iu;
/** Nút phục hồi của màn phiên bản (`VersionHistory.tsx`): "Phục hồi về <nhãn>". */
const RESTORE_BUTTON_PATTERN = /^Phục hồi về (.+)$/u;
const ERROR_CODE_PATTERN = /\b[A-Z][A-Z0-9_]{2,}\b/u;

/** Một tường của đầu dò `?probe=1` (`src/pascal-page/createProbe.ts`, mét như kho Pascal). */
type ProbeWall = ReturnType<NonNullable<Window['__pascalProbe']>['walls']>[number];

/** Chờ đầu dò `?probe=1` báo cảnh sẵn sàng và có tường, rồi trả danh sách tường. */
async function probeWalls(page: Page): Promise<ProbeWall[]> {
  const read = (): Promise<ProbeWall[]> =>
    page.evaluate(() => (window.__pascalProbe?.ready() === true ? window.__pascalProbe.walls() : []));

  await expect
    .poll(async () => (await read()).length, {
      timeout: PASCAL_RENDER_TIMEOUT_MS,
      message: 'đầu dò Pascal chưa báo cảnh có tường',
    })
    .toBeGreaterThan(0);
  return read();
}

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

/**
 * A11 — giữa chuỗi không màn trắng, không `forbidden`. `region` là vùng chính RIÊNG của từng
 * màn, đọc từ view thật: không phải màn nào cũng dựng trong `AppShell` nên không có `<main>`
 * chung (FloorManager chẳng hạn).
 */
async function expectScreenAlive(page: Page, region: Locator): Promise<void> {
  await expect(page).not.toHaveURL(ACCESS_DENIED_PATTERN);
  await expect(region.first()).toBeVisible();
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

/** Lưu trace khi hỏng. Context đã đóng (hết trần test) thì bỏ qua: không che lỗi gốc. */
async function saveTraceOnFailure(page: Page, testInfo: TestInfo): Promise<void> {
  const path = testInfo.outputPath('trace.zip');

  // Có trần: `tracing.stop` từng treo tới hết trần test khi trang dở điều hướng (chuỗi thật lượt 9).
  const saved = withTimeout(
    page
      .context()
      .tracing.stop({ path })
      .then(async () => {
        await testInfo.attach('trace', { path, contentType: 'application/zip' });
        return 'ok';
      })
      .catch((traceError: unknown) => String(traceError)),
    TRACE_SAVE_TIMEOUT_MS,
    `quá ${String(TRACE_SAVE_TIMEOUT_MS)} ms`,
  );
  const outcome = await saved;

  if (outcome !== 'ok') console.error(`[fullstack] không lưu được trace: ${outcome}`);
}

test('chuỗi FE + BE trên compose: từ đăng nhập tới registry', async ({ page, context }, testInfo) => {
  test.setTimeout(CHAIN_TIMEOUT_MS);
  const env = readFullstackEnv();

  /* 0 — nghe trước lượt goto đầu. */
  const cspViolations = await watchCsp(context);
  const sse = await watchSse(page);
  const api = watchApi(page);
  // Lỗi JS của trang. Vi phạm CSP trong worker (vd `unsafe-eval` của bộ giải KTX2) không bắn
  // `securitypolicyviolation` lên document, nên `watchCsp` không thấy; `pageerror` thì thấy.
  const pageErrors: string[] = [];

  page.on('pageerror', (error) => {
    pageErrors.push(`${error.name}: ${error.message}`);
  });

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
    await runChain(page, env.drawingPng, api, sse, loginIndex, cspViolations, pageErrors);
  } catch (error) {
    // Hỏng sớm thì bước 11 không chạy: in lỗi trang ngay, vì nó có thể chính là nguyên nhân.
    for (const pageError of pageErrors) console.error(`[fullstack] lỗi trang: ${pageError}`);
    await saveTraceOnFailure(page, testInfo);
    throw error;
  }
  await withTimeout(context.tracing.stop(), TRACE_SAVE_TIMEOUT_MS, undefined);
});

async function runChain(
  page: Page,
  drawingPng: string,
  api: ApiEntry[],
  sse: Awaited<ReturnType<typeof watchSse>>,
  loginIndex: number,
  cspViolations: Awaited<ReturnType<typeof watchCsp>>,
  pageErrors: readonly string[],
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
    await navigateThenWaitForApi(
      page,
      () => page.reload({ waitUntil: 'commit' }),
      'POST',
      /^\/api\/auth\/refresh$/u,
      [200],
    );
    await expectScreenAlive(page, page.getByRole('main'));
    expect(await loadDracoDecoder(page)).toBe('ok');
    await expectApiSince(api, mark, 'bước 2');
  });

  await test.step('3. tạo dự án', async () => {
    await page.getByRole('button', { name: /^Tạo dự án$/u }).click();
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel('Tên dự án').fill(`e2e-${String(Date.now())}`);
    await dialog.getByRole('button', { name: /^Tiếp: /u }).click();
    // Bốn tầng mặc định chưa có chiều cao: "Tiếp tục" khoá tới khi áp một chiều cao chung.
    await dialog.getByLabel('Chiều cao áp cho mọi tầng').fill(FLOOR_HEIGHT_M);
    await dialog.getByRole('button', { name: 'Áp cho mọi tầng', exact: true }).click();
    await dialog.getByRole('button', { name: /^Tiếp: /u }).click();

    const created = waitForApi(page, 'POST', /^\/api\/projects$/u, [200, 201]);

    await dialog.getByRole('button', { name: 'Tạo dự án', exact: true }).click();
    projectId = idOf((await created).json, '#25');
  });

  await test.step('4. thêm tầng', async () => {
    await page.goto(ROUTES.project.floors(projectId));
    await expectScreenAlive(page, page.getByRole('button', { name: 'Thêm tầng', exact: true }));
    const created = waitForApi(page, 'POST', new RegExp(`^/api/projects/${projectId}/floors$`, 'u'), [200, 201]);

    await page.getByRole('button', { name: 'Thêm tầng', exact: true }).click();
    const body = asRecord((await created).json, '#10');

    floorId = idOf(body, '#10');
    if (typeof body.name !== 'string') throw new Error('#10: thân không có "name"');
    floorName = body.name;
  });

  await test.step('5. tải bản vẽ', async () => {
    await page.goto(ROUTES.project.upload(projectId));
    await expectScreenAlive(page, page.getByTestId('floor-upload-dropzone'));
    const init = waitForApi(
      page,
      'POST',
      new RegExp(`^/api/projects/${projectId}/floors/${floorId}/drawings/uploads$`, 'u'),
      [200, 201],
    );
    const chunk = waitForApi(page, null, /\/drawings\/uploads\/[^/]+\/chunks$/u, [200, 201, 204]);
    const complete = waitForApi(page, 'POST', /\/drawings\/uploads\/[^/]+\/complete$/u, [200]);

    await page.getByTestId('floor-upload-file-input').setInputFiles(drawingPng);
    // Tên tệp không đoán được tầng → khay "Tệp chưa gán tầng"; gán cho tầng của bước 4.
    // Ô chọn của khay tên "Gán cho tầng" từ 3c310f99; "Gán cho tầng khác" là ô trên thẻ một tầng.
    await page.getByRole('combobox', { name: 'Gán cho tầng', exact: true }).click();
    await page.getByRole('option', { name: floorName, exact: true }).click();
    await init;
    await chunk;
    await complete;
  });

  await test.step('6. pipeline qua SSE', async () => {
    const mark = api.length;
    // Lượt mồi #8 của màn: trạng thái cuối thì màn KHÔNG mở S1 (`useProcessingScreen.ts:933`).
    await page.goto(ROUTES.project.pipeline(projectId), { waitUntil: 'commit' });
    const priming = waitForApi(page, 'GET', /\/drawings\/uploads\/[^/]+\/progress$/u, [200]).catch(() => null);

    await expectScreenAlive(page, page.getByRole('navigation', { name: 'Xử lý' }));
    // useProcessingScreen.ts:186 renders "Đã xử lý xong N/N tầng" (older builds: "Đã xong …"); accept both.
    const done = page.getByText(/^Đã (?:xử lý )?xong ([1-9]\d*)\/\1 tầng/u);
    const failure = page.getByRole('button', { name: 'Sao chép mã lỗi' });

    await expect(done.or(failure).first()).toBeVisible({ timeout: PIPELINE_TIMEOUT_MS });
    if (await failure.isVisible()) {
      const text = (await page.locator('body').innerText()).match(ERROR_CODE_PATTERN);

      throw new Error(`màn lỗi pipeline hiện ra: ${text?.[0] ?? '(không đọc được mã)'}`);
    }

    const stream = `/api/streams/projects/${projectId}/uploads/`;

    if (!sse.requestUrls.some((url) => url.includes(stream))) {
      const primed = await priming;
      const primedStatus = primed === null ? null : asRecord(primed.json, '#8').status;

      throw new Error(
        primedStatus === 'completed'
          ? 'pipeline xong trước khi màn mở luồng; FE không mở S1 (useProcessingScreen.ts:933)'
          : `không có request tới ${stream} (#8 mồi: ${String(primedStatus)})`,
      );
    }
    // Luồng đã mở: BE gửi snapshot khi nối (`apps/api/streams/registry.py:84-96`), nên phải có sự kiện.
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
    const read = await navigateThenWaitForApi(
      page,
      () => page.goto(ROUTES.project.walls(projectId, floorId), { waitUntil: 'commit' }),
      'GET',
      layerPath(),
      [200],
    );
    const walls = wallsOf(read.json, 'N16');

    expect(walls.length).toBeGreaterThan(0);
    await dismissTour(page);
    const list = page.getByRole('listbox', { name: 'Danh sách đoạn tường' });

    await expectScreenAlive(page, list);

    await list.getByRole('option').first().click();
    const write = waitForApiWhere(
      page,
      (response) =>
        response.request().method() === 'PUT' && layerPath().test(new URL(response.url()).pathname),
      AUTOSAVE_TIMEOUT_MS,
    );
    const thickness = page.getByRole('radiogroup', { name: 'Độ dày tường' });

    if ((await thickness.count()) > 0) {
      await thickness.getByRole('radio', { checked: false }).first().click();
    } else {
      await page.getByRole('button', { name: 'Duyệt đoạn này' }).first().click();
    }
    // A7 — không có nút lưu.
    await expect(page.getByRole('button', { name: 'Lưu', exact: true })).toHaveCount(0);

    const { response, json: written } = await write;

    expect(response.status()).toBe(200);
    FloorLayerWriteResultSchema.parse(written);

    const sent: unknown = response.request().postDataJSON();
    // Thân #35 là `{ baseVersion, body: { layer } }` (`VersionedWriteSchema`).
    const sentWalls = wallsOf(asRecord(sent, '#35').body, '#35');
    // Một thay đổi thấy được → đúng MỘT tường khác N16. Hơn một nghĩa là FE gửi lại biểu diễn
    // khác N16, và khi đó không biết tường nào là tường đã sửa: hỏng rõ thay vì đoán.
    const changedWalls = sentWalls.filter((wall) => {
      const id = wall.id;

      return typeof id === 'string' && changedKeys(wallById(walls, id, 'N16'), wall).length > 0;
    });

    expect(changedWalls.map((wall) => wall.id), '#35 phải đổi đúng một tường so với N16').toHaveLength(1);
    const changed = changedWalls[0];

    if (changed === undefined || typeof changed.id !== 'string') throw new Error('#35 không đổi tường nào');
    changedWallId = changed.id;
    wallBefore = wallById(walls, changedWallId, 'N16');
    wallAfter = changed;
    changedWallKeys = changedKeys(wallBefore, wallAfter);

    const reread = await navigateThenWaitForApi(
      page,
      () => page.reload({ waitUntil: 'commit' }),
      'GET',
      layerPath(),
      [200],
    );
    const reloaded = wallById(wallsOf(reread.json, 'N16 sau tải lại'), changedWallId, 'N16');

    expect(pick(reloaded, changedWallKeys)).toBe(pick(wallAfter, changedWallKeys));
    autosaveCount = countEntries(api, 'PUT', layerPath());
    // Bước 7 chỉ làm một thay đổi → đúng một lượt tự lưu.
    expect(autosaveCount).toBe(1);
  });

  await test.step('8. 3D', async () => {
    // `/3d` điều hướng cả trang sang trang Pascal riêng `/editor3d.html?project=…` (29eba219).
    const script = page.waitForResponse((response) => PASCAL_PAGE_SCRIPT.test(response.url()), {
      timeout: PASCAL_RENDER_TIMEOUT_MS,
    });
    const style = page.waitForResponse((response) => PASCAL_PAGE_STYLE.test(response.url()), {
      timeout: PASCAL_RENDER_TIMEOUT_MS,
    });

    await navigateThenWaitForApi(
      page,
      () => page.goto(ROUTES.project.viewer(projectId), { waitUntil: 'commit' }),
      'GET',
      new RegExp(`^/api/projects/${projectId}/spatial$`, 'u'),
      [200],
    );
    await expect(page).toHaveURL(new RegExp(`/editor3d\\.html\\?(.*&)?project=${projectId}(&|$)`, 'u'));
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: PASCAL_RENDER_TIMEOUT_MS });
    await expect(page).not.toHaveURL(ACCESS_DENIED_PATTERN);
    for (const response of [await script, await style]) {
      expect(response.status()).toBe(200);
      // `?v=` gắn lúc build (`versionPascalPage`, `apply: 'build'`): Vite dev không có.
      if (process.env.E2E_DEV_SERVER !== '1') {
        expect(response.url(), 'tài sản tên cố định phải mang ?v= theo nội dung').toMatch(CONTENT_VERSION);
      }
    }
  });

  await test.step('8b. Pascal: cảnh dựng từ dữ liệu thật', async () => {
    await page.goto(editor3dHref(projectId, 'probe=1'), { waitUntil: 'commit' });
    const walls = await probeWalls(page);

    expect(walls.length).toBeGreaterThan(0);
    await expect(page).not.toHaveURL(ACCESS_DENIED_PATTERN);
  });

  await test.step('8c. Pascal: sửa độ dày tường, tải lại vẫn còn (F-15)', async () => {
    const wall = (await probeWalls(page)).find((candidate) => typeof candidate.thickness === 'number');

    if (wall?.thickness === undefined) throw new Error('đầu dò không thấy tường nào có độ dày');
    const target = Math.abs(wall.thickness - THICKNESS_M) < 1e-6 ? THICKNESS_ALT_M : THICKNESS_M;
    const saved = waitForApi(page, 'PUT', layerPath(), [200]);

    // Sửa qua kho cảnh Pascal như bảng thuộc tính làm: cầu nối đổi thành lệnh rồi tự lưu (PUT N16).
    await page.evaluate(([id, thickness]) => window.__pascalProbe?.editNode(id, { thickness }), [wall.id, target] as const);
    const written = FloorLayerWriteResultSchema.parse((await saved).json);

    expect(written.layer.walls.map((candidate) => candidate.thicknessMm)).toContain(Math.round(target * 1000));
    await expect(page.getByRole('status').filter({ hasText: PASCAL_SAVED_PATTERN }).first()).toBeVisible({
      timeout: PASCAL_RENDER_TIMEOUT_MS,
    });
    await page.reload({ waitUntil: 'commit' });
    const reloaded = (await probeWalls(page)).find((candidate) => candidate.id === wall.id);

    expect(reloaded?.thickness).toBeCloseTo(target, 3);
    // Bước 11 đối chiếu số PUT cuối chuỗi: tính cả lượt lưu của Pascal (một ở bước 7, ít nhất một ở đây).
    autosaveCount = countEntries(api, 'PUT', layerPath());
    expect(autosaveCount).toBeGreaterThanOrEqual(2);
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
    const floorSelect = page.getByRole('combobox', { name: 'Tầng' });

    await expectScreenAlive(page, floorSelect);
    await floorSelect.click();
    await page.getByRole('option', { name: floorName, exact: true }).click();
    await expect
      .poll(() => api.slice(mark).some(ofFloor), { message: `không có N17 200 cho tầng ${floorId}` })
      .toBe(true);

    // Sửa tay (bước 7, 8c) không sinh phiên bản, nên revision của tầng vượt mọi bản: không hàng nào
    // "Hiện tại" (`versionHistoryModel.ts`), và cặp mặc định đặt bản mới nhất (sau AI) bên phải — nút
    // phục hồi nhắm đúng bản ấy và ghi thẳng nhãn của nó.
    const restoreButton = page.getByRole('button', { name: RESTORE_BUTTON_PATTERN });

    await expect(restoreButton).toBeVisible();
    const targetLabel = RESTORE_BUTTON_PATTERN.exec(await restoreButton.innerText())?.[1];

    if (targetLabel === undefined) throw new Error('không đọc được nhãn phiên bản đích trên nút phục hồi');
    // Hàng đầu danh sách là bản mới nhất: bản đích phải là nó, không phải ảnh chụp trước lượt AI.
    await expect(
      page
        .getByRole('navigation', { name: 'Danh sách phiên bản' })
        .getByRole('listitem')
        .first()
        .getByText(targetLabel, { exact: true }),
      'nút phục hồi phải nhắm bản mới nhất',
    ).toBeVisible();
    await restoreButton.click();
    const restore = waitForApi(page, 'POST', /\/api\/projects\/[^/]+\/versions\/[^/]+\/restore$/u, [200, 201]);
    const confirm = page.getByRole('dialog');

    // Bản sắp phục hồi đúng là bản trên nút: so trên tiêu đề có biên, "v1" không khớp "v12".
    await expect(confirm).toContainText(
      new RegExp(`Phục hồi phiên bản ${escapeRegExp(targetLabel)} của ${escapeRegExp(floorName)}\\?`, 'u'),
    );
    await confirm.getByRole('button', { name: 'Phục hồi', exact: true }).click();
    await restore;
    restoreIndex = api.map((entry) => entry.method === 'POST' && entry.path.endsWith('/restore')).lastIndexOf(true);

    // Đăng ký SAU khi trang mới commit: N16 của trang cũ, bị huỷ giữa lượt điều hướng, không khớp.
    const reread = await navigateThenWaitForApi(
      page,
      () => page.goto(ROUTES.project.walls(projectId, floorId), { waitUntil: 'commit' }),
      'GET',
      layerPath(),
      [200],
    );
    // Phục hồi bản mới nhất bỏ phần sửa tay: tường của bước 7 về lại trạng thái AI (`wallBefore`).
    const restored = wallById(wallsOf(reread.json, 'N16 sau phục hồi'), changedWallId, 'N16 sau phục hồi');

    expect(pick(restored, changedWallKeys)).toBe(pick(wallBefore, changedWallKeys));
    await dismissTour(page);
  });

  await test.step('10. registry', async () => {
    // Stack đang chạy model đã huấn luyện: bước này kích hoạt lại "Bản gốc" và đè mất lựa chọn ấy.
    if (process.env.E2E_SKIP_REGISTRY === '1') return;
    const familiesRead = await navigateThenWaitForApi(
      page,
      () => page.goto(ROUTES.adminTrainingModels, { waitUntil: 'commit' }),
      'GET',
      /^\/api\/admin\/ml\/model-families$/u,
      [200],
    );
    const families = ModelFamilyPageSchema.parse(familiesRead.json);
    const family = families.items.find((item) => item.family === OPENING_FAMILY);

    if (family === undefined) throw new Error(`N23 không có họ ${OPENING_FAMILY}`);
    const familyPicker = page.getByRole('radiogroup', { name: 'Loại mô hình' });

    await expectScreenAlive(page, familyPicker);

    // Đăng ký TRƯỚC cú bấm: N25 của họ, và N27 của bản đang dùng mà màn tự đọc khi đổi họ.
    const versionsRead = waitForApiWhere(
      page,
      (response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname === '/api/admin/ml/model-versions' &&
        response.url().includes(OPENING_FAMILY) &&
        response.status() === 200,
    );
    const detailRead = waitForApi(page, 'GET', /^\/api\/admin\/ml\/model-versions\/[^/]+$/u, [200]);

    await familyPicker.getByRole('radio', { name: OPENING_FAMILY_LABEL }).click();
    const versions = ModelVersionPageSchema.parse((await versionsRead).json);

    expect(versions.items.length).toBeGreaterThan(0);
    expect(versions.items.every((item) => item.family === OPENING_FAMILY)).toBe(true);
    ModelVersionSchema.parse((await detailRead).json);

    /* 10b — N24 bằng nút trên màn: kích hoạt bản thứ hai, rồi kích hoạt lại bản cũ. */
    const original = versions.items.find((item) => item.id === family.activeVersionId);
    const candidate = versions.items.find(
      (item) =>
        item.id !== family.activeVersionId && item.evaluationStatus === 'completed' && item.weightsFormat === 'onnx',
    );

    // Soát TRƯỚC khi đổi gì: bản cũ phải kích hoạt lại được, không thì môi trường bị bỏ lại ở bản mới.
    if (original === undefined || original.evaluationStatus !== 'completed' || original.weightsFormat !== 'onnx') {
      throw new Error(
        `bản đang dùng của họ ${OPENING_FAMILY} chưa onnx + completed nên không kích hoạt lại được: ` +
          'xem điều kiện 6 của e2e/fullstack/README.md',
      );
    }
    if (candidate === undefined) {
      throw new Error(
        `họ ${OPENING_FAMILY} cần một bản thứ hai onnx đã đánh giá: xem điều kiện 7 của e2e/fullstack/README.md`,
      );
    }

    let switched = false;
    const activateVia = async (label: string, onActivated: () => void): Promise<void> => {
      const activate = waitForApi(
        page,
        'PUT',
        new RegExp(`^/api/admin/ml/model-families/${OPENING_FAMILY}/active$`, 'u'),
        [200],
      );
      const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: label, exact: true }) });

      await row.getByRole('button', { name: 'Kích hoạt', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Kích hoạt', exact: true }).click();
      await activate;
      onActivated();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    };

    let firstError: unknown = null;

    try {
      await activateVia(candidate.label, () => {
        switched = true;
      });
    } catch (error) {
      firstError = error;
    }
    // Khôi phục môi trường qua đúng nút trên màn, kể cả khi lượt trên hỏng sau N24.
    // N24 chưa đi thì bản cũ vẫn đang dùng: không có nút "Kích hoạt" nào để bấm.
    if (switched) {
      try {
        // Hộp thoại còn mở thì nền của nó chặn cú bấm: Esc đóng lớp trên cùng (A12).
        if ((await page.getByRole('dialog').count()) > 0) await page.keyboard.press('Escape');
        await activateVia(original.label, () => undefined);
      } catch (restoreError) {
        if (firstError !== null) console.error(`[fullstack] lỗi gốc của 10b: ${String(firstError)}`);
        throw new Error(
          `khôi phục bản cũ của ${OPENING_FAMILY} hỏng, môi trường còn ở bản mới: ${String(restoreError)}` +
            (firstError === null ? '' : ` — lỗi gốc: ${String(firstError)}`),
        );
      }
    }
    if (firstError !== null) throw firstError;
  });

  await test.step('11. kết', () => {
    // In ĐỦ cả hai danh sách rồi mới khẳng định.
    for (const violation of cspViolations) {
      console.error(`[fullstack] vi phạm CSP: ${violation.violatedDirective} ${violation.blockedURI}`);
    }
    for (const pageError of pageErrors) console.error(`[fullstack] lỗi trang: ${pageError}`);
    expect(cspViolations).toEqual([]);
    expect(pageErrors).toEqual([]);

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
