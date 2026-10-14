/**
 * QA-05c P6 helpers — SCR-27 mobile viewer (`phase05_mobile_{edge,mocked_edge,ui}.spec.ts`). flows-C5 calls this file
 * `mobile.ts`; the pack names it `P6.ts`. Real stack; the mocks live in the mocked spec, only their plumbing is here.
 * Copy and selectors are read from the FE source at d50bb248 (src/screens/system/MobileViewer/):
 *   MVV MobileViewer.tsx · MVB MobileViewerBottomBar.tsx · MVI MobileViewerInfoSheet.tsx · MVR MobileViewer.container.tsx
 *   UMV useMobileViewer.ts · MVG mobileViewerGateway.ts · MVP mobileViewerPascal.ts · MVT mobileViewerTypes.ts
 *   PSG src/components/feedback/ProjectSpatialGate.tsx · PP src/components/pascal/pascalPick.ts · NM src/lib/offline/networkMonitor.ts
 *
 * Sessions: one `POST /api/auth/login` per flow (context cookie jar), one `POST /api/auth/refresh` for the fixture token
 * (`layerApiOf`) before the first page opens. Seeds are created through the real API (`POST /api/projects`, N16 GET +
 * #35 PUT per layered floor) and deleted in `closeMobileFlow`; no rate limit on any of them.
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type Browser, type BrowserContext, type Locator, type Page, type Request, type Route } from '@playwright/test';
import sharp from 'sharp';

import { ROUTES } from '../../../../e2e/fixtures/routes';
import { PASCAL_RENDER_TIMEOUT_MS, readBaseUrl } from '../../../../e2e/fullstack/env';
import { readAdminCredentials } from '../auth';
import { TEST_DATA_PREFIX } from '../evidence';
import { createQcProject, deleteProject, layerApiOf, writeLayer, type LayerApi } from '../layerSeed';

type Json = Record<string, unknown>;

export const PHONE = { width: 375, height: 812 } as const;
export const COMPACT_PHONE = { width: 320, height: 640 } as const;
export const SCENE_TIMEOUT_MS = PASCAL_RENDER_TIMEOUT_MS;

/* ---- copy (each cites its source) ---- */
export const MV = {
  region: 'Xem mô hình 3D trên điện thoại', // MVV:208
  tools: 'Công cụ xem mô hình', // MVB:195
  floors: 'Tầng', // MVB:44
  view: 'Chế độ xem', // MVB:45
  measure: 'Đo', // MVB:46
  info: 'Thông tin', // MVB:47
  loading: 'Đang tải mô hình', // MVV:129-134
  success: 'Mô hình đã dựng xong.', // MVV:152
  emptyTitle: 'Chưa có mô hình để xem', // MVV:111
  emptyDesc: 'Dự án này chưa có bản dựng 3D nào để mở trên điện thoại.', // MVV:109
  partialRooms: 'Mô hình mới có một phần: một số tầng chưa có phòng nào được dựng từ bản vẽ.', // MVV:143
  weakNetwork: 'Mạng đang yếu. Mô hình đã tải xong vẫn xem được.', // MVV:142
  noRoomsBadge: 'Chưa có phòng', // MVB:150
  measureEmpty: 'Chưa có phép đo nào. Chạm hai điểm trên mô hình để đo.', // MVB:176
  measureKind: 'Khoảng cách hai điểm', // UMV measurementOfDistance (catalog 27-A-015)
  infoSheet: 'Thông tin đối tượng đang chọn', // MVI:202
  infoEmpty: 'Chưa chọn đối tượng nào. Chạm vào mô hình để xem thông tin của nó.', // MVI:250
  expandSheet: 'Mở rộng tấm thông tin', // MVI:228
  shrinkSheet: 'Thu gọn tấm thông tin', // MVI:228
  closeSheet: 'Đóng tấm thông tin', // MVI:238
  share: 'Chia sẻ dự án', // MVV:226
  unnamed: 'Dự án chưa có tên', // UMV:97
  weakTitle: 'Máy này chưa dựng nổi mô hình 3D', // MVV:75
  weakDesc: 'Bản 2D nhẹ hơn nhiều và vẫn có đủ kích thước bạn cần khi đứng ở công trường.', // MVV:78
  weakLink: 'Xem bản 2D', // MVV:86
  forbiddenTitle: 'Bạn chưa có quyền xem mô hình này', // MVV:123
  forbiddenDesc: 'Hỏi chủ dự án để được cấp quyền xem mô hình.', // MVV:121
  retry: 'Thử lại', // PSG:100, describeError primary label
  refreshBand: 'Không tải lại được mô hình.', // PSG:99
  notFoundTitle: 'Không tìm thấy dự án này', // PSG:20
  notFoundDesc: 'Dự án có thể đã bị xoá, đường dẫn chưa đúng, hoặc bạn chưa được thêm vào dự án.', // PSG:21
  backToProjects: 'Về danh sách dự án', // PSG:23
  pageNotFound: 'Không tìm thấy trang này', // vi.json notFound.title (trailing "." tolerated by the regex users)
  networkDesc: 'Không liên lạc được với máy chủ. Kiểm tra mạng rồi thử lại.', // vi.json errors.network
  unknownTitle: 'Có trục trặc', // vi.json errors.unknown
  unknownDesc: 'Hệ thống đã ghi nhận và sẽ kiểm tra. Hãy thử lại sau ít phút.', // vi.json errors.unknown
  dashboardTitle: 'Dự án của tôi', // ProjectDashboard h1
} as const;
/** The loading note in all its shapes (MVV:133 detailLabel variants, MVR:104 chunk fallback). */
export const LOADING_RE = /^Đang tải (mô hình|mức gọn|mức vừa)$/u;
/** `MOBILE_VIEWER_SHEET_*` at 812 px (MVT:90-96): peek 88, middle round(812·0.45), full round(812·0.9). */
export const SHEET_PX = { peek: 88, mid: 365, full: 731 } as const;
export const ID_RE = '[^/]+';

/* ---- paths ---- */
const esc = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
export const projectRe = (id: string): RegExp => new RegExp(`^/api/projects/${esc(id)}$`, 'u');
export const spatialRe = (id: string): RegExp => new RegExp(`^/api/projects/${esc(id)}/spatial$`, 'u');
export const ruleConfigRe = (id: string): RegExp => new RegExp(`^/api/projects/${esc(id)}/rule-config$`, 'u');
export const anyProjectRe = /^\/api\/projects\/[^/]+$/u;
export const anySpatialRe = /^\/api\/projects\/[^/]+\/spatial$/u;
export const mountRe = /^\/assets\/pascal\/pascal-mount\.js$/u;
export const mobileUrl = (id: string): string => ROUTES.mobileViewer(id);

/* ---- network tracker ---- */
export interface NetRow {
  readonly method: string;
  readonly path: string;
  status: number | null;
}
export interface Net {
  readonly rows: NetRow[];
  /** Requests (any state) of `method` (null = any) whose pathname matches `re`; `status` narrows to answered ones. */
  count(method: string | null, re: RegExp, status?: number): number;
  /** Everything but GET/HEAD/OPTIONS, minus the session refresh and telemetry (flows-C5 "read-only wire"). */
  writes(): string[];
}

/** Records every request of `page` with its answer; attach BEFORE the first `goto`. */
export function trackNet(page: Page): Net {
  const rows: NetRow[] = [];
  const byRequest = new Map<Request, NetRow>();
  page.on('request', (request) => {
    const row: NetRow = { method: request.method(), path: new URL(request.url()).pathname, status: null };
    rows.push(row);
    byRequest.set(request, row);
  });
  page.on('response', (response) => {
    const row = byRequest.get(response.request());
    if (row !== undefined) row.status = response.status();
  });
  return {
    rows,
    count: (method, re, status) =>
      rows.filter((row) => (method === null || row.method === method) && re.test(row.path) && (status === undefined || row.status === status)).length,
    writes: () =>
      rows
        .filter((row) => !['GET', 'HEAD', 'OPTIONS'].includes(row.method) && row.path !== '/api/auth/refresh' && !row.path.startsWith('/api/telemetry'))
        .map((row) => `${row.method} ${row.path}`),
  };
}

/* ---- flow session ---- */
export interface MobileFlow {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly net: Net;
  readonly api: LayerApi;
  /** Uncaught page errors (E-007). */
  readonly pageErrors: string[];
  /** Project ids this flow created; deleted by {@link closeMobileFlow}. */
  readonly cleanup: string[];
}

export interface OpenOptions {
  readonly viewport?: { readonly width: number; readonly height: number };
  /** `isMobile` emulation (meta viewport, touch); UI flows leave it off so 1440 / 1024 render as desktop widths. */
  readonly mobile?: boolean;
}

/** Admin session in a fresh context + a blank page with the network tracker; seed BEFORE the first `goto`. */
export async function openMobileFlow(browser: Browser, options: OpenOptions = {}): Promise<MobileFlow> {
  const who = readAdminCredentials();
  const context = await browser.newContext({
    baseURL: readBaseUrl(),
    viewport: options.viewport ?? PHONE,
    isMobile: options.mobile ?? true,
    hasTouch: true,
  });
  try {
    const login = await context.request.post('/api/auth/login', {
      data: { email: who.email, password: who.password, rememberMe: false },
      headers: { Origin: readBaseUrl() },
    });
    expect(login.status(), 'setup: POST /api/auth/login (flow session)').toBe(204);
    const api = await layerApiOf(context);
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });
    return { context, page, net: trackNet(page), api, pageErrors, cleanup: [] };
  } catch (error) {
    await context.close();
    throw error;
  }
}

/** Deletes the flow's projects and closes the context; returns the delete problems (never throws). */
export async function closeMobileFlow(flow: MobileFlow | undefined): Promise<string[]> {
  if (flow === undefined) return [];
  const problems: string[] = [];
  for (const id of flow.cleanup) {
    const problem = await deleteProject(flow.api, id);
    if (problem !== null) problems.push(problem);
  }
  await flow.context.close();
  return problems;
}

/* ---- seeds ---- */
export interface Seed {
  readonly id: string;
  readonly name: string;
  readonly floorIds: readonly string[];
}

/** `GET /api/projects/:id` name, for the `h1` assertions. */
async function readName(api: LayerApi, id: string): Promise<string> {
  const read = await api.request.get(`/api/projects/${id}`, { headers: api.headers });
  expect(read.status(), `setup: GET /api/projects/${id}`).toBe(200);
  const body = (await read.json()) as Json;
  if (typeof body.name !== 'string') throw new Error('setup: project has no name');
  return body.name;
}

/** Q1 / Q2 / Q3e: `createQcProject` (qcLayer on the first `layered` floors). */
export async function seedQc(flow: MobileFlow, slug: string, floorNames: readonly string[] = ['Tầng 1'], layered = 1): Promise<Seed> {
  const floors = await createQcProject(flow.api, slug, floorNames, layered);
  const first = floors[0];
  if (first === undefined) throw new Error('setup: no floor created');
  flow.cleanup.push(first.projectId);
  return { id: first.projectId, name: await readName(flow.api, first.projectId), floorIds: floors.map((floor) => floor.floorId) };
}

/** Own project with `floorNames` (BE #25 drafts, 3 m each), optionally `build` as the first floor's whole layer. */
export async function seedLayer(
  flow: MobileFlow,
  slug: string,
  build: ((levelId: string) => Json) | null,
  options: { readonly name?: string; readonly floorNames?: readonly string[] } = {},
): Promise<Seed> {
  const { api } = flow;
  const floorNames = options.floorNames ?? ['Tầng 1'];
  const name = options.name ?? `${TEST_DATA_PREFIX}${slug}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  expect(name.length, `fixture name "${name}" fits NAME_MAX 80`).toBeLessThanOrEqual(80);
  const created = await api.request.post('/api/projects', {
    headers: api.headers,
    data: { name, floors: floorNames.map((floor, order) => ({ name: floor, order, elevationMm: order * 3_000, heightMm: 3_000 })) },
  });
  expect(created.status(), `setup: POST /api/projects "${name}": ${(await created.text()).slice(0, 200)}`).toBe(201);
  const id = ((await created.json()) as Json).id;
  if (typeof id !== 'string' || id === '') throw new Error('setup: POST /api/projects gave no id');
  flow.cleanup.push(id);
  const read = await api.request.get(`/api/projects/${id}`, { headers: api.headers });
  expect(read.status(), `setup: GET /api/projects/${id}`).toBe(200);
  const rows = ((await read.json()) as Json).floors;
  const floorIds = (Array.isArray(rows) ? (rows as Json[]) : [])
    .sort((a, b) => Number(a.order) - Number(b.order))
    .map((row) => String(row.id));
  const firstFloor = floorIds[0];
  if (build !== null && firstFloor !== undefined) await writeLayer(api, id, firstFloor, build);
  return { id, name, floorIds };
}

/** E0: one floor, no layer → `empty`. */
export const seedEmpty = (flow: MobileFlow, slug: string): Promise<Seed> => seedLayer(flow, slug, null);

/** The 80-character project name (U5 `LONG_NAME` moved here): run-unique prefix + Vietnamese filler, ends in a letter. */
export const LONG_NAME = ((): string => {
  const name = `${`${TEST_DATA_PREFIX}m27-${Date.now().toString(36)} ${'Khu phức hợp văn phòng Bình Minh '.repeat(4)}`.slice(0, 79)}A`;
  if (name.length !== 80) throw new Error(`LONG_NAME is ${String(name.length)} chars`);
  return name;
})();

/** E0L: 80-char name, one floor without a layer (`empty` + long `h1`). */
export const createLongNameProject = (flow: MobileFlow, tag = ''): Promise<Seed> =>
  seedLayer(flow, 'm27-long', null, { name: tag === '' ? LONG_NAME : `${LONG_NAME.slice(0, 80 - tag.length)}${tag}` });

/* ---- layer builders (wire shape: src/api/schemas/spatial.ts, same as layerSeed.qcLayer) ---- */
/** W4 id `<letter>-<base36 UPPER 10..64>` (BE packages/core/ids.py:23-31). */
const sid = (letter: 'W' | 'D' | 'R' | 'F'): string => `${letter}-${randomUUID().replace(/-/gu, '').toUpperCase().slice(0, 20)}`;
/** A5: AI output is never `reviewed`. */
const ai = (): Json => ({ confidence: 0.9, reviewed: false, source: 'ai' });

/** QC:wall-one — one 220 mm load-bearing wall (0,0)→(6000,0), h 3000, no rooms (partial). */
export function wallOne(levelId: string): Json {
  return {
    walls: [
      {
        ...ai(),
        centreline: { start: { x: 0, y: 0 }, end: { x: 6000, y: 0 } },
        heightMm: 3000,
        id: sid('W'),
        kind: 'loadBearing',
        levelId,
        openingIds: [],
        thicknessMm: 220,
      },
    ],
    openings: [],
    rooms: [],
    furniture: [],
  };
}

/** QC:room-one — one room "Phòng QA", outline 20×20 m (areaM2 400), no walls. */
export function roomOne(levelId: string): Json {
  return {
    walls: [],
    openings: [],
    rooms: [
      {
        ...ai(),
        areaM2: 400,
        id: sid('R'),
        levelId,
        name: 'Phòng QA',
        outline: [
          { x: 0, y: 0 },
          { x: 20000, y: 0 },
          { x: 20000, y: 20000 },
          { x: 0, y: 20000 },
        ],
        usage: 'other',
        wallIds: [],
      },
    ],
    furniture: [],
  };
}

/** QC:table-one — one table, bbox (0,0)-(800,600), no walls and no rooms (furniture-only model). */
export function tableOne(levelId: string): Json {
  return {
    walls: [],
    openings: [],
    rooms: [],
    furniture: [
      {
        ...ai(),
        boundingBox: { min: { x: 0, y: 0 }, max: { x: 800, y: 600 } },
        centre: { x: 400, y: 300 },
        id: sid('F'),
        kind: 'table',
        levelId,
        rotationDeg: 0,
      },
    ],
  };
}

/* ---- locators ---- */
export const region = (page: Page): Locator => page.getByRole('region', { name: MV.region, exact: true });
export const nav = (page: Page): Locator => page.getByRole('navigation', { name: MV.tools, exact: true });
export const tool = (page: Page, label: string): Locator => nav(page).getByRole('button', { name: label, exact: true });
export const group = (page: Page, label: string): Locator => page.getByRole('group', { name: label, exact: true });
export const sheet = (page: Page): Locator => page.getByRole('dialog', { name: MV.infoSheet, exact: true });
/** The canvas host `div[aria-hidden]` that Pascal mounts into (MVV:213). */
export const host = (page: Page): Locator => region(page).locator(':scope > div[aria-hidden="true"]');
/** The floating `<p>` note over the model (MVV:59-67), not the chunk fallback `<span role="status">`. */
export const note = (page: Page, text: string | RegExp): Locator => region(page).locator('main p').filter({ hasText: text });
export const successText = (page: Page): Locator => page.getByText(MV.success, { exact: true });
export const measureRows = (page: Page): Locator => group(page, MV.measure).getByRole('listitem');
export const floorRows = (page: Page): Locator => group(page, MV.floors).getByRole('button');

/** Two animation frames: React has committed what the last event set (a mark, not a wait on time). */
export const afterFrames = (page: Page): Promise<void> =>
  page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

/** Region up and no loading note left. `success` also waits for the sr-only "Mô hình đã dựng xong." (non-partial models). */
export async function openMobile(page: Page, projectId: string, expectSuccess = true): Promise<void> {
  await page.goto(mobileUrl(projectId));
  await expect(region(page)).toBeVisible();
  await waitBuilt(page, expectSuccess);
}

/** The model is built: no "Đang tải …" left anywhere and (when `expectSuccess`) the sr-only success sentence is there. */
export async function waitBuilt(page: Page, expectSuccess = true): Promise<void> {
  await expect(page.getByText(LOADING_RE)).toHaveCount(0, { timeout: SCENE_TIMEOUT_MS });
  if (expectSuccess) await expect(successText(page)).toBeAttached({ timeout: SCENE_TIMEOUT_MS });
}

/** Clicks "Đo" and returns once the scene has been rebuilt (UMV:337-364 remounts Pascal on every toggle). */
export async function toggleMeasure(page: Page, on: boolean): Promise<void> {
  await tool(page, MV.measure).click();
  await expect(tool(page, MV.measure)).toHaveAttribute('aria-pressed', on ? 'true' : 'false');
  await afterFrames(page);
  await waitBuilt(page);
}

/* ---- loading-note watch (did "Đang tải mô hình" show at all between two marks) ---- */
export async function watchLoading(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __qaLoadingSeen?: number };
    w.__qaLoadingSeen = 0;
    new MutationObserver(() => {
      if (/Đang tải (mô hình|mức gọn|mức vừa)/u.test(document.body.textContent ?? '')) w.__qaLoadingSeen = (w.__qaLoadingSeen ?? 0) + 1;
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
}
export const loadingSeen = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __qaLoadingSeen?: number }).__qaLoadingSeen ?? 0);

/* ---- canvas: taps, drags, pixels ---- */
export async function hostBox(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await host(page).boundingBox();
  if (box === null) throw new Error('canvas host has no box');
  return box;
}

/** One touch tap at a fraction of the canvas host box; returns after the frames that commit its effect. */
export async function tapCanvas(page: Page, fx: number, fy: number): Promise<void> {
  const box = await hostBox(page);
  await page.touchscreen.tap(box.x + box.width * fx, box.y + box.height * fy);
  await afterFrames(page);
}

/** One-finger touch drag by CDP (implicit pointer capture, like a real finger); `holdMs` keeps the finger down before it lifts. */
export async function dragTouch(page: Page, from: { x: number; y: number }, dx: number, dy: number, holdMs = 0): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
    for (let step = 1; step <= 6; step += 1) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: from.x + (dx * step) / 6, y: from.y + (dy * step) / 6 }],
      });
    }
    // fixed-wait-ok: the finger's dwell time IS the input (MVI:154-157 reads velocity = Δy / elapsed against 600 px/s)
    if (holdMs > 0) await page.waitForTimeout(holdMs);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach();
  }
  await afterFrames(page);
}

/** Drag on the canvas centre by (dx, dy) px: orbits the camera (MVP:42 `cameraControls: true`). */
export async function dragCanvas(page: Page, dx: number, dy: number): Promise<void> {
  const box = await hostBox(page);
  await dragTouch(page, { x: box.x + box.width / 2, y: box.y + box.height * 0.45 }, dx, dy);
}

/** Height in px of the info sheet. */
export async function sheetHeight(page: Page): Promise<number> {
  const box = await sheet(page).boundingBox();
  if (box === null) throw new Error('info sheet has no box');
  return Math.round(box.height);
}

/** Touch drag on the sheet's handle (the `touch-none` strip, MVI:174-178) by `dyPx` px (negative = up). */
export async function dragHandle(page: Page, dyPx: number, holdMs = 0): Promise<void> {
  const box = await sheet(page).locator('div.touch-none').boundingBox();
  if (box === null) throw new Error('sheet handle has no box');
  await dragTouch(page, { x: box.x + box.width / 2, y: box.y + 14 }, 0, dyPx, holdMs);
}

/** Middle band of the viewport (no header, bar or sheet over it with a tool panel closed or a single row open). */
async function bandShot(page: Page): Promise<Buffer> {
  const size = page.viewportSize();
  if (size === null) throw new Error('no viewport');
  return page.screenshot({
    clip: { x: 0, y: Math.round(size.height * 0.2), width: size.width, height: Math.round(size.height * 0.45) },
    animations: 'disabled',
  });
}

/** Percent of pixels whose colour differs by more than 16/255 in any channel (same size shots). */
export async function canvasDiff(a: Buffer, b: Buffer): Promise<number> {
  const [ra, rb] = await Promise.all([a, b].map((png) => sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
  if (ra === undefined || rb === undefined || ra.info.width !== rb.info.width || ra.info.height !== rb.info.height) throw new Error('canvasDiff: shots differ in size');
  let changed = 0;
  const pixels = ra.info.width * ra.info.height;
  for (let i = 0; i < pixels; i += 1) {
    const o = i * 4;
    const delta = Math.max(
      Math.abs((ra.data[o] ?? 0) - (rb.data[o] ?? 0)),
      Math.abs((ra.data[o + 1] ?? 0) - (rb.data[o + 1] ?? 0)),
      Math.abs((ra.data[o + 2] ?? 0) - (rb.data[o + 2] ?? 0)),
    );
    if (delta > 16) changed += 1;
  }
  return (changed * 100) / pixels;
}

/** A band shot once two consecutive shots agree (< 0.05 % apart): the frame has stopped moving. */
export async function settledShot(page: Page): Promise<Buffer> {
  let previous = await bandShot(page);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await afterFrames(page);
    const next = await bandShot(page);
    if ((await canvasDiff(previous, next)) < 0.05) return next;
    previous = next;
  }
  throw new Error('settledShot: the canvas did not stop changing within 12 frames');
}

/** Mean RGB and standard deviation (of luminance) of a rectangle of a PNG. */
export async function regionStats(png: Buffer, rect: { left: number; top: number; width: number; height: number }): Promise<{ mean: [number, number, number]; sd: number }> {
  const { data, info } = await sharp(png).extract(rect).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  const sum = [0, 0, 0];
  const lum: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const r = data[i * 4] ?? 0;
    const g = data[i * 4 + 1] ?? 0;
    const b = data[i * 4 + 2] ?? 0;
    sum[0] = (sum[0] ?? 0) + r;
    sum[1] = (sum[1] ?? 0) + g;
    sum[2] = (sum[2] ?? 0) + b;
    lum.push(0.2126 * r + 0.7152 * g + 0.0722 * b);
  }
  const mean = lum.reduce((acc, v) => acc + v, 0) / n;
  const sd = Math.sqrt(lum.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n);
  return { mean: [(sum[0] ?? 0) / n, (sum[1] ?? 0) / n, (sum[2] ?? 0) / n], sd };
}

/* ---- mocks (plumbing only; the mocked spec names each state) ---- */
// dup-of: viewer.ts disableWebGl
/** Init script: `getContext('webgl' | 'webgl2' | 'experimental-webgl')` answers null (a weak device, MVP:57-61). */
export const webglOff = `(() => {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
    return original.call(this, type, ...rest);
  };
  // Pascal tries WebGPU first (renderer-capability.ts:96-101): a weak device has no navigator.gpu either.
  Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined, configurable: true });
})();`;

export interface Hold {
  /** Resolves when the first matching request arrived. */
  readonly arrived: Promise<void>;
  readonly release: () => void;
}

// dup-of: viewer.ts holdPascalBundle (generalised to any route; the bundle hold is `holdRoute(page, 'GET', mountRe.test)`)
/** Holds every matching request (method + pathname test) until `release()`; later matches pass straight through. */
export async function holdRoute(page: Page, method: string, pathTest: (path: string) => boolean): Promise<Hold> {
  let release: () => void = () => undefined;
  let arrive: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const arrived = new Promise<void>((resolve) => {
    arrive = resolve;
  });
  await page.route(
    (url) => pathTest(url.pathname),
    async (route: Route) => {
      if (route.request().method() !== method) {
        await route.fallback();
        return;
      }
      arrive();
      await gate;
      await route.continue().catch(() => undefined);
    },
  );
  return { arrived, release };
}

/** Answers matching requests with the REAL response whose JSON body went through `patch`. */
export async function patchJson(page: Page, method: string, pathTest: (path: string) => boolean, patch: (body: any) => unknown): Promise<void> {
  await page.route(
    (url) => pathTest(url.pathname),
    async (route: Route) => {
      if (route.request().method() !== method) {
        await route.fallback();
        return;
      }
      const real = await route.fetch();
      const headers = { ...real.headers() };
      delete headers['content-length'];
      delete headers['content-encoding'];
      await route.fulfill({ status: real.status(), headers, contentType: 'application/json', body: JSON.stringify(patch(await real.json())) });
    },
  );
}

/** Answers matching requests with a fixed status (first `times` matches only when given, then the real server). */
export async function failRoute(page: Page, method: string, pathTest: (path: string) => boolean, status: number, times = Infinity): Promise<{ readonly hits: () => number }> {
  let hits = 0;
  await page.route(
    (url) => pathTest(url.pathname),
    async (route: Route) => {
      if (route.request().method() !== method || hits >= times) {
        await route.fallback();
        return;
      }
      hits += 1;
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL', requestId: 'qa-mock' }) });
    },
  );
  return { hits: () => hits };
}

/** M:refresh-roles-empty — the session refresh keeps everything but its roles (top-level and `user.roles`, with or without the `data` wrapper). */
export async function refreshWithRoles(page: Page, roles: readonly string[]): Promise<void> {
  await page.route(
    (url) => url.pathname === '/api/auth/refresh',
    async (route: Route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      const real = await route.fetch();
      const headers = { ...real.headers() };
      delete headers['content-length'];
      delete headers['content-encoding'];
      if (real.status() !== 200) {
        await route.fulfill({ response: real });
        return;
      }
      const body = (await real.json()) as Json;
      const root = typeof body.data === 'object' && body.data !== null ? (body.data as Json) : body;
      root.roles = [...roles];
      if (typeof root.user === 'object' && root.user !== null) (root.user as Json).roles = [...roles];
      await route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(body) });
    },
  );
}

/** SPA move without a document load: `history.pushState` + `popstate` (react-router's BrowserRouter listens for it). */
export async function spaNavigate(page: Page, path: string): Promise<void> {
  await page.evaluate((to) => {
    window.history.pushState(null, '', to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

/** First value of key `name` anywhere in a JSON value (error bodies nest `resource` differently). */
export function findKey(value: unknown, name: string): unknown {
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as Json;
  if (name in record) return record[name];
  for (const child of Object.values(record)) {
    const found = findKey(child, name);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** Evidence note on the test (a recorded observation, not an assertion). */
export const annotate = (description: string): void => {
  test.info().annotations.push({ type: 'note', description });
};

export const uniq = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Soft check (+ note) that the point at fraction (fx, fy) of the canvas host hits the host or one of its children, not an overlay. */
export async function hitsCanvas(page: Page, fx: number, fy: number): Promise<boolean> {
  const box = await hostBox(page);
  return host(page).evaluate(
    (el, point) => {
      const hit = document.elementFromPoint(point.x, point.y);
      return hit !== null && el.contains(hit);
    },
    { x: box.x + box.width * fx, y: box.y + box.height * fy },
  );
}

/**
 * Bounding box (viewport px) of the model's own pixels in the middle band: everything that differs from the background
 * sampled at the band's four corners. Waits for a settled frame first, so a camera still flying is not measured.
 */
export async function modelBox(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const png = await settledShot(page);
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const at = (x: number, y: number): number[] => [data[(y * info.width + x) * 4] ?? 0, data[(y * info.width + x) * 4 + 1] ?? 0, data[(y * info.width + x) * 4 + 2] ?? 0];
  const corners = [at(2, 2), at(info.width - 3, 2), at(2, info.height - 3), at(info.width - 3, info.height - 3)];
  const bg = [0, 1, 2].map((c) => corners.reduce((sum, p) => sum + (p[c] ?? 0), 0) / corners.length);
  let [minX, minY, maxX, maxY, hits] = [info.width, info.height, -1, -1, 0];
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const p = at(x, y);
      if (Math.max(...[0, 1, 2].map((c) => Math.abs((p[c] ?? 0) - (bg[c] ?? 0)))) > 24) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        hits += 1;
      }
    }
  }
  if (hits < 30) throw new Error('modelBox: no model pixels found in the middle band');
  const size = page.viewportSize();
  const top = Math.round((size?.height ?? 0) * 0.2);
  return { x: minX, y: top + minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Tap at a fraction of the model's pixel box (not of the canvas), so the tap lands on the model at any width. */
export async function tapModel(page: Page, fx: number, fy: number): Promise<void> {
  const box = await modelBox(page);
  await page.touchscreen.tap(box.x + box.width * fx, box.y + box.height * fy);
  await afterFrames(page);
}
