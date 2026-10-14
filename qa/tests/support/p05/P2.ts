/**
 * QA-05c pack P2 helpers — Pascal `/projects/:p/3d` (SCR-23, SCR-24 redirect) and its "Lịch sử thao tác" side panel (SCR-23H),
 * for `phase05_viewer_{mocked_edge,ui}`, `phase05_pipeline` and `phase05_panels-b_{edge,mocked_edge,ui}` (plans: QA-05c
 * `flows-C1.md`, `flows-C3.md`). Real API only for seeds (`support/layerSeed.ts`, `support/phase03Seed.ts`); the mocks here
 * are route helpers the `_mocked_edge` / `_ui` flows call by name.
 *
 * Functions P1 owns in `support/p05/viewer.ts` are written again here, each under a `// dup-of:` line (the coordinator merges
 * them at S4). Edit vehicle: a room rename in Pascal's own "Diện tích phòng" panel (DOM only, no canvas click) — the
 * `pascalEditOnce` here is that rename, not the wall-thickness spinbutton of `e2e/pascal-viewer.spec.ts:484-513` (needs a
 * canvas pick to select a wall).
 *
 * FE sources (master d50bb248): PV src/screens/viewer/PascalViewer/PascalViewer.tsx · PVC …/PascalViewer.container.tsx ·
 * PVT …/pascalViewerTypes.ts · UPV …/usePascalViewer.ts · PSG src/components/feedback/ProjectSpatialGate.tsx ·
 * HPCH src/screens/viewer/HistoryPanel/HistoryPanel.chrome.tsx · HPTY …/historyPanelTypes.ts · IR vendor/pascal/packages/editor/
 * src/components/ui/sidebar/icon-rail.tsx · RAP …/editor/src/components/ui/panels/room-area-panel.tsx · RA …/i18n/regions/roomArea.ts.
 */
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  type Request,
  type Response,
  type Route,
} from '@playwright/test';
import sharp from 'sharp';

import { ROUTES } from '../../../../e2e/fixtures/routes';
import { dismissTour } from '../../../../e2e/fixtures/tour';
import { PASCAL_RENDER_TIMEOUT_MS, readBaseUrl } from '../../../../e2e/fullstack/env';
import { readAdminCredentials } from '../auth';
import { deleteProject, type LayerApi } from '../layerSeed';

export { PASCAL_RENDER_TIMEOUT_MS };

type Json = Record<string, unknown>;

/* ---------------------------------------------------------------- copy (each cites its source) */

export const T = {
  screen: 'Mô hình 3D', // PVT:150 (section aria-label, PV:50)
  rendered: 'Đã dựng xong toàn bộ bản vẽ.', // PVT:121
  partial: 'Đã dựng xong, nhưng một số đối tượng chưa chuyển sang được.', // PVT:120
  loading: 'Đang nạp khung dựng hình…', // PVT:118
  errorCaption: 'Không nạp được khung dựng hình.', // PVT:122
  errorTitle: 'Không nạp được khung dựng hình', // PV:207
  errorText: (code: string): string => `Thử lại một lần; nếu vẫn vậy thì báo người trực kèm mã ${code}.`, // PV:211
  retry: 'Thử lại', // PV:213, PSG:86, PSG:100
  noGpuTitle: 'Máy này chưa dựng được mô hình 3D', // PV:191
  noGpuCode: 'Mã PASCAL-03.', // PV:195
  emptyTitle: 'Chưa có gì để dựng', // PV:164
  collapsedTitle: 'Khung xem đang thu gọn', // PV:224
  expand: 'Mở khung xem', // PV:226
  forbiddenTitle: 'Chưa bật cho tài khoản này', // PV:152
  skippedTitle: 'Chưa chuyển sang được', // PV:308
  dimensionReason: 'Kích thước của bản vẽ chưa được chuyển sang Pascal ở bản đầu.', // src/lib/pascal/toPascal.ts:657
  noteReason: 'Ghi chú gắn với đối tượng chưa được chuyển sang Pascal ở bản đầu.', // toPascal.ts:661
  rail: 'Bảng phụ', // PVT:194
  historyTab: 'Lịch sử thao tác', // PVT:186
  panelFallback: 'Đang mở bảng…', // PVC:287
  notFoundTitle: 'Không tìm thấy dự án này', // PSG:37
  refreshFailed: 'Không tải lại được mô hình.', // PSG:99
  unknownTitle: 'Có trục trặc', // src/i18n/vi.json:62 errors.unknown
  unknownText: 'Hệ thống đã ghi nhận và sẽ kiểm tra. Hãy thử lại sau ít phút.', // vi.json:63
  networkTitle: 'Mất kết nối', // vi.json:14 errors.network
  networkText: 'Không liên lạc được với máy chủ. Kiểm tra mạng rồi thử lại.', // vi.json:15
  dirty: 'Có thay đổi chờ đồng bộ', // vi.json:68
  saving: 'Đang lưu…', // vi.json:69
  saveFailed: 'Lưu thất bại. Hệ thống sẽ thử lưu lại ở lần chỉnh sửa tới.', // vi.json:70
  saveFailedToast: 'Chưa lưu được thay đổi', // PVC:82
  roomPanel: 'Diện tích phòng', // RA:7
  renameLabel: (name: string): string => `Đổi tên phòng ${name}`, // RA:56
  saveAsTemplate: 'Lưu làm khuôn mẫu', // editor/src/i18n/regions/controlsAndPanels.ts:243
  viewerInspectorNotice: 'Bạn đang ở vai người xem — không sửa được thuộc tính.', // controlsAndPanels.ts:238
  rosterToggle: 'Ai đang xem', // src/screens/system/CollaborationLayer/CollaborationLayer.tsx:83
  rosterList: 'Những người đang xem', // CollaborationLayer.tsx:84
} as const;

/** "Đã lưu lúc HH:MM" (vi.json:4 common.saved_at). */
export const SAVED_AT = /^Đã lưu lúc \d{1,2}:\d{2}$/u;
/** success or partial — the two captions with a rendered frame (PVT:120-121). */
export const RENDERED = /^(Đã dựng xong toàn bộ bản vẽ\.|Đã dựng xong, nhưng một số đối tượng chưa chuyển sang được\.)$/u;

export const H = {
  section: 'Lịch sử chỉnh sửa', // HPCH:49
  timeline: 'Dòng thời gian các bước đã làm', // HPCH:51
  chipsGroup: 'Lọc theo loại việc', // HPCH:52
  actorSelect: 'Lọc theo người thực hiện', // HPCH:53
  actorAll: 'Mọi người', // HPCH:54
  emptyTitle: 'Chưa có bước nào', // HPCH:56
  emptyText: 'Mọi thay đổi bạn làm trên mô hình sẽ hiện ở đây theo thứ tự thời gian, và bước nào cũng quay lại được.', // HPCH:57-58
  forbiddenTitle: 'Chỉ xem được lịch sử', // HPCH:63
  forbiddenText:
    'Vai của bạn trong dự án này xem được các bước đã làm, nhưng chưa quay ngược mô hình về một bước cũ được. Tên người thực hiện cũng được ẩn đi.', // HPCH:64-65
  stepLimit: 'Lịch sử sắp đầy', // HPCH:66
  loadMore: 'Tải thêm', // HPCH:69
  chips: ['Tất cả', 'Chỉnh sửa', 'Duyệt', 'AI'] as const, // HPTY:88-101
  testId: 'history-panel', // HPTY:353
  itemTestId: 'history-panel-item', // HPTY:359
} as const;

/** Bundle URL glob, `*` for `?v=` / `&attempt=` (UPV:51-73; same glob as e2e/pascal-viewer.spec.ts:188). */
export const PASCAL_BUNDLE_GLOB = '**/assets/pascal/pascal-mount.js*';
export const PASCAL_BUNDLE_PATH = '/assets/pascal/pascal-mount.js';
/** Production chunk of the lazy converter (`import('@/lib/pascal/toPascal')`, UPV:376): `/assets/toPascal-<hash>.js`. */
export const TO_PASCAL_GLOB = '**/assets/toPascal-*.js';
export const DESKTOP = { width: 1440, height: 900 } as const;
/** 23-A-019 debounce window (800 ms autosave + slack) — "no second PUT" is asserted after this deadline from the action. */
export const DEBOUNCE_WINDOW_MS = 1_800;
/** react-query + HTTP ladder before a gate error paints (old edge `ERROR_PAINT_TIMEOUT_MS`). */
export const ERROR_PAINT_TIMEOUT_MS = 30_000;
/** Autosave PUT round trip (e2e/fullstack/env.ts AUTOSAVE_TIMEOUT_MS) plus the 503 ladder 300 + 900 + 2 700 ms. */
export const SAVE_TIMEOUT_MS = 30_000;

/* ---------------------------------------------------------------- locators */

const SCREEN = 'section[aria-label="Mô hình 3D"]';
export const screen = (page: Page): Locator => page.locator(SCREEN);
/** Caption = the Frame's own `p[role=status]`, a direct child (PV:61); the save line and presence captions are status too. */
export const caption = (page: Page): Locator => page.locator(`${SCREEN} > p[role="status"]`);
/** Save line `p[role=status][aria-live=polite]` under the body column (PV:279-283). */
export const saveLine = (page: Page): Locator => page.locator(`${SCREEN} > div > div > p[role="status"][aria-live="polite"]`);
export const summary = (page: Page): Locator => page.locator(`${SCREEN} > div > div > dl`);
export const skippedBox = (page: Page): Locator =>
  page.locator(`${SCREEN} > div > div > div`).filter({ has: page.getByText(T.skippedTitle, { exact: true }) });
export const canvasBox = (page: Page): Locator => page.getByTestId('pascal-canvas');
/** Loading skeleton (PV:70-77), only in `loading`. */
export const skeleton = (page: Page): Locator => page.locator(`${SCREEN} [aria-hidden="true"].animate-pulse`);
export const rail = (page: Page): Locator => page.getByRole('group', { name: T.rail, exact: true });
export const historyTab = (page: Page): Locator => rail(page).getByRole('button', { name: T.historyTab, exact: true });
export const historyRegion = (page: Page): Locator => page.getByRole('region', { name: T.historyTab, exact: true });
export const historyPanel = (page: Page): Locator => page.getByTestId(H.testId);
export const chip = (page: Page, label: string): Locator =>
  page.getByRole('group', { name: H.chipsGroup, exact: true }).getByRole('button', { name: label, exact: true });
export const actorCombo = (page: Page): Locator => page.getByRole('combobox', { name: H.actorSelect, exact: true });
export const pascalRoot = (page: Page): Locator => page.locator('.pascal-root');

/* ---------------------------------------------------------------- sessions and seeds */

export interface Who {
  readonly email: string;
  readonly password: string;
}

export interface Session {
  readonly context: BrowserContext;
  readonly page: Page;
}

export const adminWho = (): Who => readAdminCredentials();

/** A fresh context signed in as `who` (one `POST /api/auth/login` through the context's jar) and its first page. */
export async function openSession(
  browser: Browser,
  who: Who,
  options: {
    readonly viewport?: { readonly width: number; readonly height: number };
    readonly onContext?: (context: BrowserContext) => Promise<unknown>;
  } = {},
): Promise<Session> {
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport: options.viewport ?? DESKTOP });
  try {
    await options.onContext?.(context);
    const res = await context.request.post('/api/auth/login', {
      data: { email: who.email, password: who.password, rememberMe: false },
      headers: { Origin: readBaseUrl() },
    });
    expect(res.status(), 'setup: POST /api/auth/login (flow session)').toBe(204);
    return { context, page: await context.newPage() };
  } catch (error) {
    await context.close();
    throw error;
  }
}

export async function closeSession(s: Session | undefined): Promise<void> {
  await s?.context.close().catch(() => undefined);
}

/** Deletes fixture projects (admin API), reporting a failure as an annotation, never throwing. */
export async function cleanupProjects(api: LayerApi, ids: readonly string[]): Promise<void> {
  for (const id of ids) {
    const failed = await deleteProject(api, id);
    if (failed !== null) test.info().annotations.push({ type: 'cleanup', description: failed });
  }
}

/* ---------------------------------------------------------------- opening the screen */

// dup-of: viewer.ts openPascal
/**
 * `goto` the Pascal screen of `projectId` (or `path`), clear a tour if one shows (none mounts on `/3d`: the tour host is
 * `ViewerShell.container.tsx:162`, i.e. `/3d/measure` — flows-C3 header; checked once, no wait) and, unless `wait` is
 * false, wait for the rendered caption (`text`, default success or partial).
 */
export async function openPascal(
  page: Page,
  projectId: string,
  options: { readonly path?: string; readonly wait?: boolean; readonly text?: string | RegExp } = {},
): Promise<void> {
  await page.goto(options.path ?? ROUTES.project.viewer(projectId));
  await dismissTour(page);
  if (options.wait !== false) await waitRendered(page, options.text);
}

export async function waitRendered(page: Page, text: string | RegExp = RENDERED): Promise<void> {
  await expect(caption(page), 'Pascal screen rendered (caption)').toHaveText(text, { timeout: PASCAL_RENDER_TIMEOUT_MS });
}

/** Caption once it has left `loading` (any settled state). */
export async function settledCaption(page: Page, { soft = false }: { readonly soft?: boolean } = {}): Promise<string> {
  await (soft ? expect.configure({ soft: true }) : expect)
    .poll(async () => ((await caption(page).count()) > 0 ? await caption(page).innerText() : ''), {
      message: 'Pascal screen left "Đang nạp khung dựng hình…"',
      timeout: PASCAL_RENDER_TIMEOUT_MS,
    })
    .not.toMatch(/^(|Đang nạp khung dựng hình…)$/u);
  return caption(page).innerText();
}

/* ---------------------------------------------------------------- route helpers (mocks) */

export interface Hold {
  /** URLs that reached the hold. */
  readonly hits: string[];
  release(): void;
  /** Releases and unroutes. */
  dispose(): Promise<void>;
}

/**
 * Holds every request matching `url` (and `filter`) until `release()` — the loading states cannot be held still on the
 * real stack otherwise (e2e/pascal-viewer.spec.ts:180-195). The request then goes on to the next handler / network.
 */
export async function holdRoute(page: Page, url: string | RegExp, filter: (request: Request) => boolean = () => true): Promise<Hold> {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const hits: string[] = [];
  const handler = async (route: Route): Promise<void> => {
    if (!filter(route.request())) {
      await route.fallback();
      return;
    }
    hits.push(route.request().url());
    await gate;
    // The page may have navigated away while the request was held.
    await route.fallback().catch(() => undefined);
  };
  await page.route(url, handler);
  return {
    hits,
    release: () => release(),
    dispose: async () => {
      release();
      await page.unroute(url, handler);
    },
  };
}

// dup-of: viewer.ts holdPascalBundle
export const holdPascalBundle = (page: Page): Promise<Hold> => holdRoute(page, PASCAL_BUNDLE_GLOB);

export interface Abort {
  readonly hits: string[];
  dispose(): Promise<void>;
}

/** Aborts (network loss) every request matching `url` and `filter`; `times` caps how many (then they pass). */
export async function abortRoute(
  page: Page,
  url: string | RegExp,
  { filter = () => true, times = Number.POSITIVE_INFINITY }: { readonly filter?: (request: Request) => boolean; readonly times?: number } = {},
): Promise<Abort> {
  const hits: string[] = [];
  const handler = async (route: Route): Promise<void> => {
    if (!filter(route.request()) || hits.length >= times) {
      await route.fallback();
      return;
    }
    hits.push(route.request().url());
    await route.abort('internetdisconnected');
  };
  await page.route(url, handler);
  return { hits, dispose: () => page.unroute(url, handler) };
}

/** Same shape as the BE error envelope the client reads (`code`, `message`, `requestId`; src/lib/http/client.ts:156-162). */
export const wireError = (code: string, extra: Json = {}): Json => ({ code, message: `qa-05c mocked ${code}`, requestId: 'qa-05c-mock', ...extra });

const pathIs = (request: Request, path: string): boolean => new URL(request.url()).pathname === path;
export const projectPath = (projectId: string): string => `/api/projects/${projectId}`;
export const spatialPath = (projectId: string): string => `/api/projects/${projectId}/spatial`;
export const LAYER_PUT_PATH = /^\/api\/projects\/[^/]+\/floors\/[^/]+\/spatial\/layer$/u;
export const isLayerPut = (request: Request): boolean => request.method() === 'PUT' && LAYER_PUT_PATH.test(new URL(request.url()).pathname);

export interface Mock {
  readonly hits: number;
  dispose(): Promise<void>;
}

/** Answers GET `path` with `status` + `body` (counting hits) until disposed. */
export async function fulfillGet(page: Page, path: string, status: number, body: Json = wireError('INTERNAL')): Promise<Mock> {
  let hits = 0;
  const glob = `**${path}`;
  const handler = async (route: Route): Promise<void> => {
    if (route.request().method() !== 'GET' || !pathIs(route.request(), path)) {
      await route.fallback();
      return;
    }
    hits += 1;
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  };
  await page.route(glob, handler);
  return {
    get hits() {
      return hits;
    },
    dispose: () => page.unroute(glob, handler),
  };
}

/** Real N15 answer with `mutate` applied to its `graph` (SpatialGraphDocumentSchema, src/api/schemas/spatialGraph.ts:122-128). */
export async function mutateN15(page: Page, projectId: string, mutate: (graph: Json) => void): Promise<Mock> {
  let hits = 0;
  const path = spatialPath(projectId);
  const glob = `**${path}`;
  const handler = async (route: Route): Promise<void> => {
    if (route.request().method() !== 'GET' || !pathIs(route.request(), path)) {
      await route.fallback();
      return;
    }
    hits += 1;
    const response = await route.fetch();
    const json = (await response.json()) as Json;
    mutate(json.graph as Json);
    await route.fulfill({ response, json });
  };
  await page.route(glob, handler);
  return {
    get hits() {
      return hits;
    },
    dispose: () => page.unroute(glob, handler),
  };
}

let mockSeq = 0;
const mockId = (prefix: string): string => `${prefix}QA05C${Date.now().toString(36).toUpperCase()}${String((mockSeq += 1))}`;

/** `n` dimensions (DimensionSchema, src/api/schemas/spatial.ts:446-475; id prefix `M-`) on the first level of `graph`. */
export function addDimensions(graph: Json, n: number): void {
  const levels = graph.levels as Json[];
  const levelId = String(levels[0]?.id);
  const list = graph.dimensions as Json[];
  for (let i = 0; i < n; i += 1) {
    list.push({
      confidence: 0.9,
      reviewed: false,
      source: 'ai',
      id: mockId('M-'),
      kind: 'linear',
      levelId,
      line: { start: { x: 0, y: 1000 * i }, end: { x: 1000, y: 1000 * i } },
      referenceIds: [],
      valueMm: 1000,
    });
  }
}

/** `n` notes (NoteSchema, spatial.ts:487-497) attached to the first wall of `graph`. */
export function addNotes(graph: Json, n: number): void {
  const walls = graph.walls as Json[];
  const list = graph.notes as Json[];
  for (let i = 0; i < n; i += 1) {
    list.push({
      confidence: 0.9,
      reviewed: false,
      source: 'ai',
      authorId: 'qa-05c',
      body: 'Ghi chú QA-05c',
      createdAt: new Date().toISOString(),
      entityId: String(walls[0]?.id),
      id: mockId('note-'),
    });
  }
}

// dup-of: viewer.ts disableWebGl
/** No-GPU machine: `getContext('webgl'|'webgl2')` → null and no `navigator.gpu`, from the first script of every load. */
export async function disableWebGl(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    const patched = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]): unknown {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return (original as unknown as (...args: unknown[]) => unknown).call(this, type, ...rest);
    };
    HTMLCanvasElement.prototype.getContext = patched as unknown as typeof original;
    Object.defineProperty(Navigator.prototype, 'gpu', { configurable: true, get: () => undefined });
  });
}

/* ---------------------------------------------------------------- Pascal panels and the edit vehicle */

/**
 * Opens a Pascal sidebar panel by its tooltip: the rail buttons have no accessible name (23-E-011; IR:58-79 icon-only
 * `<button>` in a Radix tooltip trigger, content portalled into `.pascal-root`, delay 0 — tooltip.tsx:9-20). Hovers each
 * trigger until the tooltip reads `label`, then clicks it. No-op when the panel is already open (`isOpen`).
 */
export async function openPascalPanel(page: Page, label: string, isOpen: Locator): Promise<void> {
  if (await isOpen.isVisible()) return;
  const triggers = pascalRoot(page).locator('[data-slot="tooltip-trigger"]');
  const tip = pascalRoot(page).locator('[data-slot="tooltip-content"]').filter({ hasText: label });
  const count = Math.min(await triggers.count(), 40);
  for (let i = 0; i < count; i += 1) {
    const trigger = triggers.nth(i);
    if (!(await trigger.isVisible())) continue;
    await trigger.hover();
    const found = await tip
      .first()
      .waitFor({ state: 'visible', timeout: 1_500 })
      .then(() => true, () => false);
    if (found) {
      await trigger.click();
      await expect(isOpen, `Pascal panel "${label}" opened`).toBeVisible();
      return;
    }
  }
  throw new Error(`no Pascal rail button shows the tooltip "${label}" (${String(count)} triggers hovered)`);
}

/** Row name button of a room in "Diện tích phòng" — its `title` is "Đổi tên phòng <name>" (RAP:415). */
export const roomRow = (page: Page, name: string): Locator => pascalRoot(page).getByTitle(T.renameLabel(name), { exact: true }).first();

export async function openRoomPanel(page: Page, name = 'Bếp'): Promise<void> {
  await openPascalPanel(page, T.roomPanel, roomRow(page, name));
}

/** Rename a room in Pascal (double-click the name → input "Đổi tên phòng <from>", fill, Enter = blur commits; RAP:382-415). */
export async function renameRoom(page: Page, from: string, to: string): Promise<void> {
  await openRoomPanel(page, from);
  await roomRow(page, from).dblclick();
  const input = page.getByLabel(T.renameLabel(from), { exact: true });
  await input.fill(to);
  await input.press('Enter');
  await expect(roomRow(page, to), `room "${from}" renamed to "${to}" in Pascal`).toBeVisible();
}

// dup-of: viewer.ts pascalEditOnce
/** One real Pascal edit that reaches the server: rename `from` → `to`, wait for PUT …/spatial/layer 200 and "Đã lưu lúc HH:MM". */
export async function pascalEditOnce(page: Page, from: string, to: string): Promise<Response> {
  const put = page.waitForResponse((r) => isLayerPut(r.request()), { timeout: SAVE_TIMEOUT_MS });
  await renameRoom(page, from, to);
  const response = await put;
  expect(response.status(), 'PUT …/spatial/layer after the Pascal edit').toBe(200);
  await expect(saveLine(page)).toHaveText(SAVED_AT, { timeout: SAVE_TIMEOUT_MS });
  return response;
}

/* ---------------------------------------------------------------- network log, deadlines, keyboard */

export interface NetEntry {
  readonly url: string;
  readonly method: string;
  readonly type: string;
}

export interface NetLog {
  readonly entries: NetEntry[];
  mark(): number;
  since(mark: number): NetEntry[];
}

/** Every request of `page` from now on (url, method, resourceType); `mark()` = index for `since()`. */
export function netlog(page: Page): NetLog {
  const entries: NetEntry[] = [];
  page.on('request', (request) => entries.push({ url: request.url(), method: request.method(), type: request.resourceType() }));
  return { entries, mark: () => entries.length, since: (mark) => entries.slice(mark) };
}

/** `/api/` requests, minus session and telemetry chatter (not caused by the screen under test). */
export const apiCalls = (list: readonly NetEntry[]): string[] =>
  list
    .map((e) => new URL(e.url))
    .filter((u) => u.pathname.startsWith('/api/') && u.pathname !== '/api/auth/refresh' && !u.pathname.startsWith('/api/telemetry'))
    .map((u) => u.pathname);
export const jsCalls = (list: readonly NetEntry[]): string[] =>
  list.filter((e) => e.type === 'script' || new URL(e.url).pathname.endsWith('.js')).map((e) => new URL(e.url).pathname);

/** Waits until `ms` have passed since `since` (a deadline measured from an action, not a fixed sleep). */
export async function pastDeadline(since: number, ms: number, what: string): Promise<void> {
  await expect
    .poll(() => Date.now() - since, { message: `deadline ${String(ms)} ms after ${what}`, intervals: [100], timeout: ms + 10_000 })
    .toBeGreaterThan(ms);
}

/** Focus nobody (keys reach the shortcut registry with no text field focused). */
export async function blurAll(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

/** Presses Tab until `target` has focus (at most `max` presses); `true` when it did. */
export async function tabTo(page: Page, target: Locator, max = 40): Promise<boolean> {
  for (let i = 0; i < max; i += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement)) return true;
  }
  return false;
}

/** Short label of the focused element: `combobox`, its aria-label, or its own text. */
export const activeLabel = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (el === null) return '';
    if (el.getAttribute('role') === 'combobox') return 'combobox';
    return el.getAttribute('aria-label') ?? (el.textContent ?? '').trim();
  });

/* ---------------------------------------------------------------- pixels, boxes, contrast */

// dup-of: viewer.ts canvasOnlyShot
/**
 * Screenshot of the Pascal canvas only: the box (Pascal chrome) and its overlay siblings hidden via CSSOM, canvases visible.
 * Shot with `page.screenshot({ clip })` of the canvas box measured BEFORE hiding — a `locator.screenshot` of the hidden box
 * waits for "element is visible" until timeout (run-051 T1: 23-B-033, 24-F-001).
 */
export async function canvasOnlyShot(page: Page): Promise<Buffer> {
  const canvas = canvasBox(page).locator('canvas').first();
  await expect(canvas, 'Pascal <canvas> present').toBeVisible();
  const clip = await canvas.boundingBox();
  if (clip === null || clip.width < 1 || clip.height < 1) throw new Error('Pascal <canvas> has no box');
  const handle = await canvasBox(page).elementHandle();
  if (handle === null) throw new Error('pascal-canvas box not found');
  const toggle = (on: boolean): Promise<void> =>
    handle.evaluate((el, hide) => {
      const box = el as HTMLElement;
      const siblings = [...(box.parentElement?.children ?? [])].filter((c) => c !== box) as HTMLElement[];
      for (const s of siblings) s.style.visibility = hide ? 'hidden' : '';
      box.style.visibility = hide ? 'hidden' : '';
      for (const c of box.querySelectorAll('canvas')) c.style.visibility = hide ? 'visible' : '';
    }, on);
  await toggle(true);
  try {
    return await page.screenshot({ clip, animations: 'disabled' });
  } finally {
    await toggle(false);
    await handle.dispose();
  }
}

/** Share of 4-px grid samples whose |ΔR|+|ΔG|+|ΔB| from the dominant (background) colour is > 30. */
export async function nonBlankRatio(png: Buffer): Promise<number> {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const counts = new Map<number, number>();
  const samples: number[] = [];
  for (let y = 0; y < info.height; y += 4) {
    for (let x = 0; x < info.width; x += 4) {
      const at = (y * info.width + x) * info.channels;
      const rgb = ((data[at] ?? 0) << 16) | ((data[at + 1] ?? 0) << 8) | (data[at + 2] ?? 0);
      samples.push(rgb);
      const key = rgb & 0xf8f8f8;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const bg = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  const diff = (c: number): number =>
    Math.abs(((c >> 16) & 0xff) - ((bg >> 16) & 0xff)) + Math.abs(((c >> 8) & 0xff) - ((bg >> 8) & 0xff)) + Math.abs((c & 0xff) - (bg & 0xff));
  return samples.length === 0 ? 0 : samples.filter((c) => diff(c) > 30).length / samples.length;
}

/** Polls until the canvas-only shot is non-blank (> `min`); returns the last ratio. */
export async function expectCanvasNotBlank(page: Page, min = 0.01, soft = false): Promise<number> {
  let ratio = 0;
  const poll = soft ? expect.configure({ soft: true }).poll : expect.poll;
  await poll(
    async () => {
      ratio = await nonBlankRatio(await canvasOnlyShot(page));
      return ratio;
    },
    { message: `Pascal canvas has > ${String(min * 100)} % non-background pixels`, timeout: PASCAL_RENDER_TIMEOUT_MS },
  ).toBeGreaterThan(min);
  return ratio;
}

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const inViewport = (box: Box | null, vw: number, vh: number): boolean =>
  box !== null && box.x >= -1 && box.y >= -1 && box.x + box.width <= vw + 1 && box.y + box.height <= vh + 1;
export const intersects = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * WCAG contrast of each matched element's text against its first opaque ancestor background (min over elements;
 * throws when nothing matches, so an empty locator can never pass). Colours are read as `rgb()`/`rgba()` from computed style.
 */
export async function minContrast(target: Locator): Promise<number> {
  const ratios = await target.evaluateAll((els) => {
    const parse = (c: string): [number, number, number, number] => {
      const m = /rgba?\(([^)]+)\)/u.exec(c);
      const p = (m?.[1] ?? '0,0,0,0').split(/[,\s/]+/u).filter(Boolean).map(Number);
      return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] ?? 1];
    };
    const lum = ([r, g, b]: [number, number, number, number]): number => {
      const ch = (v: number): number => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
    };
    return els.map((el) => {
      const fg = parse(getComputedStyle(el).color);
      let node: Element | null = el;
      let bg: [number, number, number, number] = [255, 255, 255, 1];
      while (node !== null) {
        const c = parse(getComputedStyle(node).backgroundColor);
        if (c[3] > 0.5) {
          bg = c;
          break;
        }
        node = node.parentElement;
      }
      const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x) as [number, number];
      return (a + 0.05) / (b + 0.05);
    });
  });
  if (ratios.length === 0) throw new Error('minContrast: no element matched (nothing to measure)');
  return Math.min(...ratios);
}
