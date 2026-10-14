/**
 * QA-05c phase-05 helpers for the Pascal `/3d` screen (SCR-23, redirects SCR-24 / SCR-26). Owner: pack P1
 * (`phase05_viewer_edge.spec.ts`). Other packs copy what they need into `support/p05/P<n>.ts` with
 * `// dup-of: viewer.ts <name>` above it (merged at S4) — do not import across packs.
 *
 * Source @ d50bb248 (short names as catalog-C1): PV src/screens/viewer/PascalViewer/PascalViewer.tsx · PVC …/PascalViewer.container.tsx
 * · UPV …/usePascalViewer.ts · PVT …/pascalViewerTypes.ts · PSG src/components/feedback/ProjectSpatialGate.tsx · CL
 * src/screens/system/CollaborationLayer/CollaborationLayer.tsx · PM src/components/pascal/pascalMount.tsx · V vendor/pascal/packages
 * (RA editor/src/i18n/regions/roomArea.ts, RAP editor/src/components/ui/panels/room-area-panel.tsx, IR …/ui/sidebar/icon-rail.tsx,
 * FC …/ui/panels/furniture-clash-panel.tsx, MC …/ui/action-menu/measurement-control.tsx, CH editor/src/i18n/regions/contextualHelp.ts).
 *
 * Usage:
 *   const admin = await adminApi();                                   // 1 login, dispose in finally
 *   const [floor] = await createQcProject(layerApi(admin), 'v-01');    // Q1 (layerSeed)
 *   const s = await openSession(browser, 'admin');                   // own context, 1 login, ApiEntry log
 *   const puts = watchLayerPuts(s.page);
 *   await openPascal(s.page, ROUTES.project.viewer(floor.projectId)); // dismissTour + "Đã dựng xong toàn bộ bản vẽ."
 *   await renameRoom(s.page, 'Bếp', 'Bếp chính');                     // DOM edit vehicle (flows-C1 "Edit vehicle")
 *   finally: await closeSession(s); await deleteSeededProject(admin, floor.projectId); await admin.dispose();
 */
import { randomUUID } from 'node:crypto';

import { expect, type APIRequestContext, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import sharp from 'sharp';

import { dismissTour } from '../../../../e2e/fixtures/tour';
import { watchApi, type ApiEntry } from '../../../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../../../e2e/fullstack/env';
import { signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import { writeLayer, type LayerApi } from '../layerSeed';
import { createProject, deleteSeededProject, signInPoolUser, type PoolUser } from '../phase03Seed';

export type Json = Record<string, unknown>;

export const DESKTOP = { width: 1440, height: 900 } as const;

/** Port of `e2e/pascal-viewer.spec.ts:103` (= `e2e/fullstack/env.ts:24`): Pascal ~1,5 MB gzip + KTX2 materials. */
export const PASCAL_RENDER_TIMEOUT_MS = 60_000;
/** UPV:51 `MOUNT_URL`; the glob keeps `?v=` / `&attempt=` (e2e/pascal-viewer.spec.ts:162). */
export const MOUNT_PATH = '/assets/pascal/pascal-mount.js';
export const PASCAL_BUNDLE_GLOB = '**/assets/pascal/pascal-mount.js*';
/** Pascal debounce 1 000 ms (V editor/src/hooks/use-auto-save.ts:7) + floor saver 800 ms (useAutosave.ts:98-100). */
export const SAVE_WINDOW_MS = 1_800;

/* ---------------------------------------------------------------- copy (each cites its source) */

export const PV = {
  title: 'Mô hình 3D', // PVT PASCAL_VIEWER_TITLE
  leave: 'Về màn xem 3D', // PVT PASCAL_LEAVE_LABEL
  reprocess: 'Xử lý lại bản vẽ', // PVT PASCAL_REPROCESS_LABEL
  loading: 'Đang nạp khung dựng hình…', // PVT:118
  emptyCaption: 'Bản vẽ chưa có đối tượng nào để dựng.', // PVT:119
  partial: 'Đã dựng xong, nhưng một số đối tượng chưa chuyển sang được.', // PVT:120
  success: 'Đã dựng xong toàn bộ bản vẽ.', // PVT:121
  collapsedCaption: 'Khung xem đang thu gọn để đỡ tốn máy.', // PVT:124
  emptyTitle: 'Chưa có gì để dựng', // PV:161
  emptyText: 'Bản vẽ này chưa có tường, phòng hay ô mở nào. Dò lại bản vẽ rồi quay lại đây.', // PV:162
  errorTitle: 'Không nạp được khung dựng hình', // PV:205
  retry: 'Thử lại', // PV:212
  noGpuTitle: 'Máy này chưa dựng được mô hình 3D', // PV:189
  collapsedTitle: 'Khung xem đang thu gọn', // PV:222
  collapsedText: 'Mô hình 3D không chạy khi thu gọn, để đỡ tốn máy.', // PV:223
  expand: 'Mở khung xem', // PV:224
  canvasName: 'Khung dựng mô hình 3D', // PV:257
  rail: 'Bảng phụ', // PVT PASCAL_SIDE_PANEL_RAIL_LABEL
  history: 'Lịch sử thao tác', // PVT PASCAL_SIDE_PANEL_LABELS.history
  rooms: 'Diện tích phòng', // PVT PASCAL_SIDE_PANEL_LABELS.rooms (must NOT be in the AppFront rail on /3d)
  furniture: 'Thư viện đồ đạc', // PVT PASCAL_SIDE_PANEL_LABELS.furniture
  panelLoading: 'Đang mở bảng…', // PVC:285
} as const;

export const GATE = {
  notFoundTitle: 'Không tìm thấy dự án này', // PSG:37
  notFoundText: 'Dự án có thể đã bị xoá, đường dẫn chưa đúng, hoặc bạn chưa được thêm vào dự án.', // PSG:38-39
  back: 'Về danh sách dự án', // PSG:40
  loginLead: 'Hãy đăng nhập để tiếp tục.', // SessionBootstrap (catalog 23-A-032)
} as const;

export const SAVE = {
  saved: /^Đã lưu lúc \d{2}:\d{2}$/u, // PVT saveLabelOf / USI
  offline: 'Ngoại tuyến — sẽ lưu khi có mạng', // USI:66-67
  conflict: 'Tầng 1: Tầng này vừa được sửa ở nơi khác. Tải lại để xem bản mới nhất.', // UAS:600-612, SLS:83
  revoked: 'Tầng 1: Bạn không còn quyền sửa tầng này.', // SLS:81
  reload: 'Tải lại', // UAS:470-475 (⚑ 23-B-029)
} as const;

export const TOAST = {
  rejected: 'Không ghi được thay đổi', // PVC PASCAL_REJECTED_TITLE
  undo: 'Đã hoàn tác thay đổi gần nhất', // PVT PASCAL_HISTORY_TOASTS.undo
  redo: 'Đã làm lại thay đổi vừa hoàn tác', // PVT PASCAL_HISTORY_TOASTS.redo
  measurementDeleted: (n: number): string => `Đã xoá phép đo ${String(n)}`, // PVC:186
  undoAction: 'Hoàn tác', // I18N common.undo (undo ticket)
} as const;

export const PASCAL = {
  roomPanel: 'Diện tích phòng', // RA title
  clashPanel: 'Va chạm đồ đạc', // V editor/src/i18n/regions/furnitureClash.ts title
  renameLabel: (name: string): string => `Đổi tên phòng ${name}`, // RA renameLabel
  readOnlyRename: 'Vai chỉ xem không đổi được tên phòng', // RA readOnlyRename
  inspectorReadOnly: 'Bạn đang ở vai người xem — không sửa được thuộc tính.', // controlsAndPanels.ts:238
  delete: 'Xoá', // controlsAndPanels.ts parametricInspector.delete
  saveTemplate: 'Lưu làm khuôn mẫu', // controlsAndPanels.ts:243
  selectItem: /^Chọn «/u, // FC:31 vi.select(name)
  /** MC:75-76 `aria-label="Đo: <kind>"` + `aria-pressed`; only inside the action menu, which read-only hides. */
  measure: /^Đo: /u,
  shortcutsDialog: 'Phím tắt', // primitivesAndSidebar.ts:168
  snapping: (mode: string): string => `Bắt điểm: ${mode}`, // CH snapping
  gridStep: (value: string): string => `Lưới: ${value} m`, // CH gridStep (toFixedVi 2)
  englishChrome: ['Select', 'Zone', 'Delete', 'Orbit Left', 'Orbit Right', 'Top View', 'Site', 'Settings', 'Expand panel', 'Collapse panel'],
  /** panel-wrapper.tsx:369 inspector extension buttons `Open <title>` / `Close <title>`. */
  englishChromePattern: /^(Open|Close) /u,
} as const;

export const PRESENCE = {
  toggle: 'Ai đang xem', // CL:83
  roster: 'Những người đang xem', // CL:84
  alone: 'Chỉ mình bạn đang xem', // CL:89
  readOnly: 'Bạn đang xem, không sửa được', // CL:93
  private: 'Đang làm việc riêng', // CL:100
} as const;

/* ---------------------------------------------------------------- sessions */

export interface Session {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly log: ApiEntry[];
}

/** One real admin API login (`signedInApi`); caller disposes it. Seeds, pool users, role changes, cleanup. */
export function adminApi(): Promise<APIRequestContext> {
  const { email, password } = readAdminCredentials();
  return signedInApi(email, password);
}

/** `LayerApi` over a signed-in API context (the context already carries `Origin` + Bearer). */
export const layerApi = (api: APIRequestContext): LayerApi => ({ request: api, headers: {} });

export interface SessionOptions {
  readonly viewport?: { readonly width: number; readonly height: number };
  readonly reducedMotion?: 'reduce' | 'no-preference';
}

/**
 * Own browser context signed in as the admin or a pool user (one `POST /api/auth/login` through the context's jar,
 * `signInPoolUser` shape), a page and its `/api` log. `'anon'` = no sign-in (+ANON).
 */
export async function openSession(browser: Browser, who: 'admin' | 'anon' | PoolUser, options: SessionOptions = {}): Promise<Session> {
  const context = await browser.newContext({
    baseURL: readBaseUrl(),
    viewport: options.viewport ?? DESKTOP,
    ...(options.reducedMotion === undefined ? {} : { reducedMotion: options.reducedMotion }),
  });
  try {
    if (who === 'admin') {
      const { email, password } = readAdminCredentials();
      const res = await context.request.post('/api/auth/login', {
        data: { email, password, rememberMe: false },
        headers: { Origin: readBaseUrl() },
      });
      expect(res.status(), 'setup: POST /api/auth/login as admin (browser context)').toBe(204);
    } else if (who !== 'anon') {
      await signInPoolUser(context, who);
    }
    const page = await context.newPage();
    return { context, page, log: watchApi(page) };
  } catch (error) {
    await context.close();
    throw error;
  }
}

export async function closeSession(session: Session | undefined): Promise<void> {
  if (session !== undefined) await session.context.close().catch(() => undefined);
}

/** Deletes every listed project (admin API); returns the failures for an annotation, never throws. */
export async function cleanupProjects(admin: APIRequestContext, ids: readonly string[]): Promise<string[]> {
  const out: string[] = [];
  for (const id of ids) {
    const failure = await deleteSeededProject(admin, id);
    if (failure !== null) out.push(failure);
  }
  return out;
}

/** `PATCH /api/users/:id/role` (phase03_quality_edge.spec.ts:1279 shape); returns the status. */
export async function setGlobalRole(admin: APIRequestContext, userId: string, role: 'admin' | 'engineer' | 'viewer'): Promise<number> {
  return (await admin.patch(`/api/users/${userId}/role`, { data: { userId, role } })).status();
}

/* ---------------------------------------------------------------- seeds (QX:furn, QC:clash3) */

/** W4 id `<letter>-<base36 UPPER 10..64>` (layerSeed `sid`, BE packages/core/ids.py:23-31,92-94). */
const sid = (letter: 'W' | 'F'): string => `${letter}-${randomUUID().replace(/-/gu, '').toUpperCase().slice(0, 20)}`;
const ai = { confidence: 0.9, reviewed: false, source: 'ai' } as const;

const table = (levelId: string, cx: number, cy: number): Json => ({
  ...ai,
  boundingBox: { min: { x: cx - 400, y: cy - 300 }, max: { x: cx + 400, y: cy + 300 } },
  centre: { x: cx, y: cy },
  id: sid('F'),
  kind: 'table',
  levelId,
  rotationDeg: 0,
});

/** QX:furn — a level whose only object is one table (empty ⇔ walls = rooms = openings = furniture = 0, UPV:334-339). */
export function furnitureOnlyLayer(levelId: string): Json {
  return { walls: [], openings: [], rooms: [], furniture: [table(levelId, 2000, 1000)] };
}

/**
 * QC:clash3 — 3 walls (open U) + 3 tables whose footprints overlap pairwise (centres 300 mm apart, 800 × 600 mm boxes), so
 * "Va chạm đồ đạc" lists pairs and each table is selectable by DOM (FC:31 "Chọn «…»"). 6 objects: one delete = 1/6 < 0,2
 * (admitted), the next = 1/5 = 0,2 (MASS_DELETE_RATIO, src/lib/pascal/guard.ts:36 → refused).
 */
export function clash3Layer(levelId: string): Json {
  const wall = (x0: number, y0: number, x1: number, y1: number): Json => ({
    ...ai,
    centreline: { start: { x: x0, y: y0 }, end: { x: x1, y: y1 } },
    heightMm: 3_000,
    id: sid('W'),
    kind: 'partition',
    levelId,
    openingIds: [],
    thicknessMm: 200,
  });
  return {
    walls: [wall(0, 0, 6000, 0), wall(0, 0, 0, 4000), wall(6000, 0, 6000, 4000)],
    openings: [],
    rooms: [],
    furniture: [table(levelId, 2000, 2000), table(levelId, 2300, 2000), table(levelId, 2150, 2250)],
  };
}

export interface SeededLayers {
  readonly projectId: string;
  readonly floors: readonly { readonly id: string; readonly name: string }[];
}

/** Own project with `floorNames`; `builders[i]` (when given) is written as floor i's layer through #35. */
export async function createLayeredProject(
  admin: APIRequestContext,
  slug: string,
  floorNames: readonly string[],
  builders: readonly ((levelId: string) => Json)[],
): Promise<SeededLayers> {
  const project = await createProject(admin, slug, floorNames);
  try {
    for (const [index, build] of builders.entries()) {
      const floor = project.floors[index];
      if (floor === undefined) throw new Error(`setup: no floor ${String(index)} for a layer`);
      await writeLayer(layerApi(admin), project.projectId, floor.id, build);
    }
    return { projectId: project.projectId, floors: project.floors };
  } catch (error) {
    await deleteSeededProject(admin, project.projectId);
    throw error;
  }
}

/* ---------------------------------------------------------------- mocks (only for `_mocked_edge` / `_ui` packs) */

/** noGpu: `getContext('webgl'|'webgl2')` → null and no `navigator.gpu`, before any page script (flows-C1 Seeds). */
export async function disableWebGl(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (HTMLCanvasElement.prototype as any).getContext = function patched(this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
      if (kind === 'webgl' || kind === 'webgl2' || kind === 'experimental-webgl') return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (original as any).call(this, kind, ...rest);
    };
    try {
      delete (navigator as unknown as { gpu?: unknown }).gpu;
      Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined, configurable: true });
    } catch {
      /* read-only in some engines: the getContext patch is what Three.js checks */
    }
  });
}

/** Port of `e2e/pascal-viewer.spec.ts:180` holdPascalBundle: hold `pascal-mount.js` until `release()`. */
export async function holdPascalBundle(page: Page): Promise<() => void> {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(PASCAL_BUNDLE_GLOB, async (route) => {
    await gate;
    await route.continue();
  });
  return release;
}

/* ---------------------------------------------------------------- screen locators */

export const frame = (page: Page): Locator => page.locator(`section[aria-label="${PV.title}"]`);
/** The frame caption only — the save line and presence captions are `role=status` too (flows-C1 "Render wait"). */
export const caption = (page: Page): Locator => page.locator(`section[aria-label="${PV.title}"] > p[role=status]`);
export const saveLine = (page: Page): Locator => frame(page).locator('p[aria-live="polite"]');
export const canvasBox = (page: Page): Locator => page.getByTestId('pascal-canvas');
export const pascalRoot = (page: Page): Locator => page.locator('.pascal-root');
export const summaryList = (page: Page): Locator => frame(page).locator('dl');
export const button = (scope: Page | Locator, name: string | RegExp): Locator =>
  scope.getByRole('button', { name, exact: typeof name === 'string' });
export const historyTab = (page: Page): Locator => button(page.getByRole('group', { name: PV.rail, exact: true }), PV.history);

/** `dd` of a summary term (PV:285-304). */
export const summaryValue = (page: Page, term: string): Locator =>
  summaryList(page).locator('div').filter({ has: page.locator('dt', { hasText: new RegExp(`^${term}$`, 'u') }) }).locator('dd');

/** Summary as `{Tầng, Tường, Ô mở, Phòng}` texts. */
export async function summaryOf(page: Page): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const term of ['Tầng', 'Tường', 'Ô mở', 'Phòng']) out[term] = (await summaryValue(page, term).textContent())?.trim() ?? '';
  return out;
}

/* ---------------------------------------------------------------- open / wait */

/**
 * `goto(url)`, `dismissTour` (flows-C1: before every `/3d` open), then — unless `rendered: false` — the frame caption reads
 * "Đã dựng xong toàn bộ bản vẽ." within PASCAL_RENDER_TIMEOUT_MS.
 */
export async function openPascal(page: Page, url: string, { rendered = true }: { readonly rendered?: boolean } = {}): Promise<void> {
  await page.goto(url);
  await dismissTour(page); // /3d mounts no tour (EditorTourContainer only on ExportPanel / WallLayerReview / ViewerShell): count once, no wait
  if (rendered) await expect(caption(page)).toHaveText(PV.success, { timeout: PASCAL_RENDER_TIMEOUT_MS });
}

/** Requests to the mount script since the page opened (`?v=…[&attempt=N]`). */
export function watchMountRequests(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === MOUNT_PATH) urls.push(request.url());
  });
  return urls;
}

export interface LayerPut {
  readonly at: number;
  readonly url: string;
  readonly body: Json;
  status: number | null;
  response: Json | null;
}

/** Every #35 `PUT …/spatial/layer` the page sends, with its send time, body and (later) status + JSON answer. */
export function watchLayerPuts(page: Page): LayerPut[] {
  const puts: LayerPut[] = [];
  const byRequest = new Map<unknown, LayerPut>();
  page.on('request', (request) => {
    if (request.method() !== 'PUT' || !/\/spatial\/layer$/u.test(new URL(request.url()).pathname)) return;
    const entry: LayerPut = { at: Date.now(), url: request.url(), body: (request.postDataJSON() ?? {}) as Json, status: null, response: null };
    byRequest.set(request, entry);
    puts.push(entry);
  });
  page.on('response', async (response) => {
    const entry = byRequest.get(response.request());
    if (entry === undefined) return;
    entry.status = response.status();
    entry.response = ((await response.json().then((json: unknown) => json, () => null)) ?? null) as Json | null;
  });
  return puts;
}

/** Room names a #35 body carries (`body.layer.rooms[].name`). */
export function roomNamesOf(put: LayerPut | undefined): string[] {
  const layer = ((put?.body.body as Json | undefined)?.layer ?? {}) as Json;
  return Array.isArray(layer.rooms) ? layer.rooms.map((room) => String((room as Json).name)) : [];
}

/** `body.layer.furniture.length` of a #35 body. */
export function furnitureCountOf(put: LayerPut | undefined): number {
  const layer = ((put?.body.body as Json | undefined)?.layer ?? {}) as Json;
  return Array.isArray(layer.furniture) ? layer.furniture.length : -1;
}

/** `localStorage['viewer-preferences']` levelMode (V viewer/src/store/use-viewer.ts:555-570, zustand persist). */
export async function levelModeOf(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('viewer-preferences');
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as { state?: { levelMode?: unknown }; levelMode?: unknown };
    const mode = parsed.state?.levelMode ?? parsed.levelMode;
    return typeof mode === 'string' ? mode : null;
  });
}

/* ---------------------------------------------------------------- Pascal DOM edit vehicle */

/**
 * Opens a Pascal sidebar panel by its tooltip label. Rail buttons have no accessible name (23-E-011, IR:58-79), so each
 * rail button inside `.pascal-root` is hovered until the tooltip text shows, then clicked (flows-C1 "Edit vehicle").
 */
export async function openPascalPanel(page: Page, label: string): Promise<void> {
  const rail = pascalRoot(page).locator('button.h-9.w-9');
  const tooltip = page.getByRole('tooltip').filter({ hasText: new RegExp(`^${label}$`, 'u') });
  const count = await rail.count();
  for (let index = 0; index < count; index += 1) {
    await rail.nth(index).hover();
    const shown = await tooltip
      .first()
      .waitFor({ state: 'visible', timeout: 1_500 })
      .then(
        () => true,
        () => false,
      );
    if (shown) {
      await rail.nth(index).click();
      return;
    }
  }
  throw new Error(`Pascal rail: no button shows the tooltip "${label}" (${String(count)} rail buttons)`);
}

/** The room name button in "Diện tích phòng" (RAP:405-415: its `title` is the rename label, or the read-only text). */
export const roomButton = (page: Page, name: string): Locator =>
  pascalRoot(page).locator('button[title]').filter({ hasText: new RegExp(`(^|· )${name}$`, 'u') });

/** Opens "Diện tích phòng" when the room is not listed yet. */
export async function ensureRoomPanel(page: Page, name: string): Promise<void> {
  if ((await roomButton(page, name).count()) === 0) await openPascalPanel(page, PASCAL.roomPanel);
  await expect(roomButton(page, name)).toBeVisible();
}

/** Double-click the room name (RAP:409-413) → rename input `Đổi tên phòng <from>` (RA:56, autoFocus). */
export async function startRename(page: Page, from: string): Promise<Locator> {
  await ensureRoomPanel(page, from);
  await roomButton(page, from).dblclick();
  const input = page.getByLabel(PASCAL.renameLabel(from), { exact: true });
  await expect(input).toBeFocused();
  return input;
}

/** Rename `from` → `to` and press Enter (blur commits, RAP:395); returns the Enter time (ms) for timing rows. */
export async function renameRoom(page: Page, from: string, to: string): Promise<number> {
  const input = await startRename(page, from);
  await input.fill(to);
  await input.press('Enter');
  return Date.now();
}

/** pascalEditOnce: one rename, then the #35 PUT it causes (200). Returns that PUT. */
export async function pascalEditOnce(page: Page, puts: LayerPut[], from: string, to: string): Promise<LayerPut> {
  const before = puts.length;
  await renameRoom(page, from, to);
  await expect.poll(() => puts.length, { timeout: 15_000, message: `one PUT after "${from}" → "${to}"` }).toBeGreaterThan(before);
  const put = puts[before] as LayerPut;
  await expect.poll(() => put.status, { timeout: 15_000 }).not.toBeNull();
  return put;
}

/** Selects a room through its "Diện tích phòng" row (RAP:124-130 setSelection, same state as a canvas pick). */
export async function selectRoom(page: Page, name: string): Promise<void> {
  await ensureRoomPanel(page, name);
  await roomButton(page, name).click();
}

/** Selects the first item listed in "Va chạm đồ đạc" (FC:31-33 sets the selection to `clash.a`). */
export async function selectFirstClashItem(page: Page): Promise<void> {
  const row = pascalRoot(page).getByRole('button', { name: PASCAL.selectItem });
  if ((await row.count()) === 0) await openPascalPanel(page, PASCAL.clashPanel);
  await row.first().click();
}

/** Measurement tool button of the Pascal action menu (MC:74-90). */
export const measureButton = (page: Page): Locator => pascalRoot(page).getByRole('button', { name: PASCAL.measure });

/* ---------------------------------------------------------------- pixels */

/**
 * PNG of the Pascal `<canvas>` alone: every other node inside `.pascal-root` is made `visibility: hidden` for the shot
 * (CSSOM only, removed after), so Pascal's own chrome is not counted as model.
 */
export async function canvasOnlyPng(page: Page): Promise<Buffer> {
  const canvas = canvasBox(page).locator('canvas').first();
  await expect(canvas).toBeVisible();
  const style = await page.addStyleTag({ content: '.pascal-root * { visibility: hidden !important; } .pascal-root canvas { visibility: visible !important; }' });
  try {
    return await canvas.screenshot({ animations: 'disabled' });
  } finally {
    await style.evaluate((node) => (node as Element).remove());
  }
}

/** Share of pixels that differ from the most common colour (4-bit quantised) — "not blank" / "model framed" ratio. */
export async function nonBackgroundRatio(png: Buffer): Promise<number> {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const counts = new Map<number, number>();
  const total = info.width * info.height;
  for (let i = 0; i < data.length; i += 3) {
    const key = ((data[i] ?? 0) >> 4) * 256 + ((data[i + 1] ?? 0) >> 4) * 16 + ((data[i + 2] ?? 0) >> 4);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const mode = Math.max(...counts.values());
  return total === 0 ? 0 : 1 - mode / total;
}

/** Share of pixels whose RGB differ by more than 24 on any channel between two shots of the same size. */
export async function pixelDiffRatio(a: Buffer, b: Buffer): Promise<number> {
  const left = await sharp(a).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const right = await sharp(b).removeAlpha().resize(left.info.width, left.info.height).raw().toBuffer();
  let differ = 0;
  for (let i = 0; i < left.data.length; i += 3) {
    if ([0, 1, 2].some((c) => Math.abs((left.data[i + c] ?? 0) - (right[i + c] ?? 0)) > 24)) differ += 1;
  }
  return differ / (left.info.width * left.info.height);
}

/* ---------------------------------------------------------------- navigation / timing / keyboard */

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** A well-formed `prj_<ULID>` nobody owns (support/p03/P10.ts:128 shape) → gate 404. */
export const unknownProjectId = (): string =>
  `prj_01${Array.from({ length: 24 }, () => CROCKFORD[Math.floor(Math.random() * 32)] ?? '0').join('')}`;

/** Client-side route change (pushState + popstate, what react-router listens to): no document load, bundle stays. */
export async function spaGo(page: Page, path: string): Promise<void> {
  await page.evaluate((target) => {
    window.history.pushState({}, '', target);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, path);
}

/** Moves focus to the page body so window shortcuts are not "typing" (shortcutRegistry.ts:505). */
export async function blurAll(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

/** Presses Tab until `target` holds focus (at most `max` presses); hard-fails otherwise. */
export async function tabTo(page: Page, target: Locator, max = 40): Promise<void> {
  for (let i = 0; i < max; i += 1) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target, `Tab reaches the control within ${String(max)} presses`).toBeFocused();
}

/**
 * Waits until `since + windowMs`: the debounce deadline measured from the user action (flows-C1 "Request facts") — the
 * only settled point after which "no PUT" can be claimed.
 */
export async function settleUntil(page: Page, since: number, windowMs = SAVE_WINDOW_MS + 700): Promise<void> {
  const left = since + windowMs - Date.now();
  if (left > 0) await page.waitForTimeout(left); // fixed-wait-ok: debounce deadline from the action, not a guess at speed
}

/**
 * Records every text the frame caption shows from now on (MutationObserver in the page; reset by a document load).
 * Returns a reader. Used for "passes through Đang nạp…" and "never returns to Đang nạp…".
 */
export async function traceCaption(page: Page): Promise<() => Promise<string[]>> {
  const selector = `section[aria-label="${PV.title}"] > p[role=status]`;
  await page.evaluate((sel) => {
    const w = window as unknown as { __qaCaptions?: string[] };
    const trail: string[] = [];
    w.__qaCaptions = trail;
    const record = (): void => {
      const text = document.querySelector(sel)?.textContent ?? '';
      if (trail[trail.length - 1] !== text) trail.push(text);
    };
    record();
    new MutationObserver(record).observe(document.body, { subtree: true, childList: true, characterData: true });
  }, selector);
  return () => page.evaluate(() => [...((window as unknown as { __qaCaptions?: string[] }).__qaCaptions ?? [])]);
}
