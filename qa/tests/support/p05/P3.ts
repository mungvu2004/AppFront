/**
 * QA-05c P3 — helpers for `phase05_panels_a_{edge,mocked_edge,ui}.spec.ts` only: the two Pascal side panels AppFront mounts on
 * `/projects/:p/3d` — "Diện tích phòng" and "Thư viện đồ đạc" (vendor copies, `vendor/pascal/packages/editor/src/components/ui/
 * panels/appfront-panels.tsx:24-49`, wired by `src/components/pascal/PascalFrame.tsx` → Pascal's icon rail). Plan: QA-05c
 * `flows-C2.md` ("Helper / seed mới"), copy: `catalog-C2.md`. Short names below (vendor root `vendor/pascal/packages/editor/src/`):
 *   APN components/ui/panels/appfront-panels.tsx   IR components/ui/sidebar/icon-rail.tsx   RAP …/panels/room-area-panel.tsx
 *   RAF …/panels/room-area-full-page.tsx           RAV i18n/regions/roomArea.ts            FLP …/panels/furniture-library-panel.tsx
 *   DFS …/panels/detected-furniture-strip.tsx     FLV i18n/regions/furnitureLibrary.ts    IC components/ui/item-catalog/item-catalog.tsx
 *   PV  src/screens/viewer/PascalViewer/PascalViewer.tsx   PVC …/PascalViewer.container.tsx   SLS src/lib/autosave/spatialLayerSave.ts
 *
 * Seeds (real API, `../layerSeed.ts` khuôn; every body goes through `FloorLayerWriteSchema.parse` inside `writeLayer`):
 *   Q1  createQcProject — 1 floor, "Bếp" + "PHONG NGU 2" (16 m² each), door + window next to Bếp, 1 table.
 *   FX  Q1 + 3 chairs (`kind:'chair'`) in Bếp → strip "bàn (1)", "ghế (3)".
 *   RA1 two floors, 8 rooms (catalog §Seeds), no wall, no furniture.   RA2 "Tầng 2"/"Tầng 10"/"Mái" (one degenerate room).
 *   RA3 closed 8×6 m wall frame on "Tầng 1", the same frame open at the top on "Tầng 2", no room.
 * Sessions: the admin works in its own context from the stored admin state (`ensureAdminSession`, phase05 edge `openAdmin`);
 * fixture calls carry the context's own Bearer (`layerApiOf`, 1 refresh, no login). Members (+V / +E) are pool users
 * (`../phase03Seed.ts`, slots `p05-panels-a*` only) signed in through their own context (1 login each).
 */
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';

import { expect, request, test } from '@playwright/test';
import type { APIRequestContext, Browser, BrowserContext, Locator, Page, Request, Response } from '@playwright/test';

import { ROUTES } from '../../../../e2e/fixtures/routes';
import { dismissTour } from '../../../../e2e/fixtures/tour';
import { AUTOSAVE_TIMEOUT_MS, PASCAL_RENDER_TIMEOUT_MS, readBaseUrl } from '../../../../e2e/fullstack/env';
import { signedInApi } from '../api';
import { ensureAdminSession, readAdminCredentials } from '../auth';
import { deleteSeededProject } from '../drawingSeed';
import { createQcProject, deleteProject, layerApiOf, layerPathOf, qcLayer, writeLayer, type LayerApi, type SeededFloor } from '../layerSeed';
import { addProjectMember, poolUser, signInPoolUser, type PoolRole, type PoolUser } from '../phase03Seed';
import { ADMIN_STORAGE_STATE_FILE } from '../state';

type Json = Record<string, unknown>;
type Pt = readonly [number, number];

/* ---- copy (each string read in the source named) ---------------------------------------------------------------- */

/** RAV:6-65 — room-area panel. */
export const RA = {
  title: 'Diện tích phòng',
  total: 'Tổng diện tích',
  subtotal: 'Tổng phụ',
  noOccupancy: 'Chưa đặt công năng',
  groupBy: 'Nhóm theo',
  groupByLevel: 'Tầng',
  groupByOccupancy: 'Công năng',
  sortBy: 'Sắp xếp',
  sortAreaDesc: 'Diện tích giảm dần',
  sortAreaAsc: 'Diện tích tăng dần',
  sortName: 'Tên phòng',
  levelFilter: 'Lọc tầng',
  allLevels: 'Mọi tầng',
  collapsed: 'Thu gọn',
  collapsedHint: '5 phòng lớn nhất',
  fullTable: 'Bảng toàn trang',
  openFullPage: 'Mở toàn trang',
  closeFullTable: 'Đóng bảng toàn trang',
  copyTable: 'Sao chép bảng',
  copied: 'Đã sao chép bảng',
  statusLegend: 'Chú giải',
  statusTrusted: 'Máy đọc, chưa soát',
  statusSuspect: 'Máy đọc, cần soát',
  statusReviewed: 'Người duyệt đã xác minh',
  areaFormula: 'Diện tích tính theo đường bao trong của tường (công thức dây giày)',
  emptyTitle: 'Chưa có phòng nào đo được',
  emptyBody: 'Phòng chỉ hiện ở đây khi đường bao tường đã kín.',
  detectSpaces: 'Kiểm tra khe hở tường',
  gapsClosed: (rooms: number): string => `Tìm thấy ${String(rooms)} vòng tường kín — vẽ vùng ở mục Vùng để có hàng diện tích`,
  gapsOpen: 'Chưa có vùng nào kín — còn khe hở giữa các tường',
  renameLabel: (name: string): string => `Đổi tên phòng ${name}`,
  renamed: (name: string): string => `Đã đổi tên thành "${name}"`,
  undoRename: 'Hoàn tác',
  readOnlyRename: 'Vai chỉ xem không đổi được tên phòng',
  errorTitle: 'Không đo được phòng nào',
  partialTitle: 'Có phòng chưa đo được',
  unmeasurable: (name: string): string => `Không đo được "${name}" — đường bao chưa kín`,
  forbiddenNotice: 'Bạn đang ở vai người xem — xem được bảng nhưng không đổi được tên phòng.',
  column: { number: 'Số phòng', name: 'Tên phòng', occupancy: 'Công năng', area: 'Diện tích' },
} as const;

/** FLV:232-264 — furniture library panel. */
export const FL = {
  title: 'Thư viện đồ đạc',
  searchLabel: 'Tìm đồ đạc',
  searchPlaceholder: 'Tên hoặc nhóm, không cần dấu',
  groupLabel: 'Nhóm nội thất',
  readOnlyNotice: 'Vai chỉ xem: không thêm được đồ đạc',
  monochromeNotice: 'Thẻ đơn sắc để màu nhấn chỉ dành cho thứ bấm được',
  emptyTitle: 'Không có đồ đạc nào khớp',
  emptyBody: 'Bỏ dấu, bớt chữ, hoặc chọn nhóm khác.',
  count: (shown: number): string => `${String(shown)} mẫu`,
  detectedTitle: 'Đã phát hiện',
  detectedHint: 'Chọn một mẫu bên dưới rồi bấm "Thay thế tất cả", hoặc kéo thẻ mẫu thả vào nhóm.',
  replaceAll: 'Thay thế tất cả',
  replaceAllNeedsItem: 'Chọn một mẫu trong thư viện trước',
  previewTitle: (name: string, count: number): string => `Thay thế tất cả ${String(count)} ${name}?`,
  previewBody: 'Xem lại danh sách trước khi áp. Chưa có thay đổi nào được thực hiện. Cả lô hoàn tác bằng một lần Ctrl+Z.',
  previewList: 'Danh sách đồ đạc sẽ được thay thế',
  previewRow: (from: string, index: number, to: string): string => `${from} ${String(index)} → ${to}`,
  cancel: 'Huỷ',
  /** FLV:253-264 in FURNITURE_GROUP_IDS order (catalog-filter.ts:20-31). */
  chips: ['Tất cả', 'Bàn', 'Ghế', 'Giường', 'Ghế sofa', 'Tủ kệ', 'Thiết bị vệ sinh', 'Bếp', 'Thiết bị kỹ thuật', 'Của tôi'],
} as const;

/** PV:50 frame region; PV:61 caption `role=status`; PV:279-282 save line `role=status aria-live=polite`; PVT:194 rail group. */
export const PV = {
  frame: 'Mô hình 3D',
  sideRail: 'Bảng phụ',
  history: 'Lịch sử thao tác',
  /** PVC:82 toast title of a failed save. */
  saveFailed: 'Chưa lưu được thay đổi',
  /** Toast.tsx:203,211 toast region. */
  toasts: 'Thông báo',
} as const;

/** SLS:80-83 save-block copy. */
export const SAVE = {
  forbidden: 'Bạn không còn quyền sửa tầng này.',
  reload: 'Tầng này vừa được sửa ở nơi khác. Tải lại để xem bản mới nhất.',
} as const;

/**
 * Save-line text of a blocked floor: the SLS message, prefixed with the floor name ("Tầng 1: …", run-051b E1-T15).
 */
export const blockedLine = (message: string): RegExp => new RegExp(`(^|: )${escapeRegExp(message)}$`, 'u');
/** useSaveIndicator "Đã lưu lúc HH:MM" (phase03_settings_edge SAVED_AT, phase04_qc_layers.spec.ts:1004). */
export const SAVED_AT = /^Đã lưu lúc \d{1,2}:\d{2}$/u;
/** pascalViewerTypes.ts caption once Pascal has built the scene (phase05_3d_viewer.spec.ts:76-77). */
export const PASCAL_RENDERED_PATTERN =
  /^(Đã dựng xong toàn bộ bản vẽ\.|Đã dựng xong, nhưng một số đối tượng chưa chuyển sang được\.)$/u;
/** IR:30-34 — the only rail button with a name of its own (`img alt`). */
const SITE_LABEL = 'Site';

export const DESKTOP = { width: 1440, height: 900 } as const;
export const softly = expect.configure({ soft: true });
export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
/** Whole-token class check: `bg-accent` must not match `hover:bg-accent` or `bg-accent/60`. */
export const classToken = (token: string): RegExp => new RegExp(`(^|\\s)${escapeRegExp(token)}(\\s|$)`, 'u');

/* ---- request log -------------------------------------------------------------------------------------------------- */

export interface LoggedRequest {
  readonly method: string;
  readonly url: string;
  readonly path: string;
  readonly at: number;
  readonly body: string | null;
  /** HTTP status once answered; 0 = failed / aborted; null = no answer yet. */
  status: number | null;
}

/** Records every request of `page` from now on (method, url, time, body, status) — the "0 không-GET" / "đúng 1 PUT" checks. */
export function requestLog(page: Page): LoggedRequest[] {
  const log: LoggedRequest[] = [];
  const byRequest = new Map<Request, LoggedRequest>();
  page.on('request', (req) => {
    let path = '';
    try {
      path = new URL(req.url()).pathname;
    } catch {
      path = '';
    }
    const entry: LoggedRequest = { method: req.method(), url: req.url(), path, at: Date.now(), body: req.postData(), status: null };
    log.push(entry);
    byRequest.set(req, entry);
  });
  page.on('response', (res) => {
    const entry = byRequest.get(res.request());
    if (entry !== undefined) entry.status = res.status();
  });
  page.on('requestfailed', (req) => {
    const entry = byRequest.get(req);
    if (entry !== undefined) entry.status = 0;
  });
  return log;
}

/** Writes the panels must never send while only browsing: any non-GET under `/api/projects/`. */
export const nonGetUnderProjects = (log: readonly LoggedRequest[]): string[] =>
  log.filter((e) => e.method !== 'GET' && e.method !== 'HEAD' && e.path.startsWith('/api/projects/')).map((e) => `${e.method} ${e.path}`);

/** http(s) requests to another origin than the app's. */
export const externalRequests = (log: readonly LoggedRequest[]): string[] => {
  const own = new URL(readBaseUrl()).origin;
  return log.filter((e) => /^https?:/u.test(e.url) && new URL(e.url).origin !== own).map((e) => e.url);
};

const isLayerPath = (path: string, floorId?: string): boolean =>
  path.endsWith('/spatial/layer') && (floorId === undefined || path.includes(`/floors/${floorId}/`));

/** `PUT …/floors/:f/spatial/layer` entries (#35), optionally of one floor. */
export const layerPuts = (log: readonly LoggedRequest[], floorId?: string): LoggedRequest[] =>
  log.filter((e) => e.method === 'PUT' && isLayerPath(e.path, floorId));

/** Room names carried by a logged #35 body (`{ baseVersion, body: { layer: { rooms } } }`, SPS). */
export function putRoomNames(entry: LoggedRequest | undefined): string[] {
  if (entry?.body == null) return [];
  const doc = JSON.parse(entry.body) as { body?: { layer?: { rooms?: { name?: unknown }[] } } };
  return (doc.body?.layer?.rooms ?? []).map((room) => String(room.name));
}

/** Promise of the next #35 answer (set up BEFORE the action that causes it). */
export const nextLayerPut = (page: Page, floorId?: string, timeout = AUTOSAVE_TIMEOUT_MS): Promise<Response> =>
  page.waitForResponse((res) => res.request().method() === 'PUT' && isLayerPath(new URL(res.url()).pathname, floorId), { timeout });

/** Promise of the next #35 answer whose request body contains `fragment` (e.g. `"name":"Kho"`). */
export const layerPutWith = (page: Page, fragment: string, timeout = AUTOSAVE_TIMEOUT_MS): Promise<Response> =>
  page.waitForResponse(
    (res) => res.request().method() === 'PUT' && isLayerPath(new URL(res.url()).pathname) && (res.request().postData() ?? '').includes(fragment),
    { timeout },
  );

/** No #35 PUT of `log` still waiting for its answer (the saver is idle before a step that counts the next PUT). */
export async function layerIdle(log: readonly LoggedRequest[]): Promise<void> {
  await expect.poll(() => layerPuts(log).filter((e) => e.status === null).length, { timeout: AUTOSAVE_TIMEOUT_MS }).toBe(0);
}

/* ---- sessions ------------------------------------------------------------------------------------------------------ */

export interface Session {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly log: LoggedRequest[];
}

export interface AdminSession extends Session {
  /** Fixture calls with the context's own Bearer. */
  readonly api: LayerApi;
  /** The same Bearer as a stand-alone request context (pool / members / #41 helpers take one). */
  readonly admin: APIRequestContext;
  readonly projects: string[];
}

export interface MemberSession extends Session {
  readonly user: PoolUser;
}

interface SessionOptions {
  readonly clipboard?: boolean;
  /** #41 back to the slot's role BEFORE the login (a run that died mid-demotion left it changed). */
  readonly resetRole?: boolean;
  readonly viewport?: { readonly width: number; readonly height: number };
}

const contextOptions = ({ clipboard = false, viewport = DESKTOP }: SessionOptions): Parameters<Browser['newContext']>[0] => ({
  baseURL: readBaseUrl(),
  viewport,
  ...(clipboard ? { permissions: ['clipboard-read', 'clipboard-write'] } : {}),
});

/** Own admin context from the stored state (1 refresh check, + 1 for the fixture Bearer); request log from the first load. */
export async function openAdminSession(browser: Browser, options: SessionOptions = {}): Promise<AdminSession> {
  const context = await browser.newContext({
    ...contextOptions(options),
    ...(existsSync(ADMIN_STORAGE_STATE_FILE) ? { storageState: ADMIN_STORAGE_STATE_FILE } : {}),
  });
  try {
    await ensureAdminSession(context, ADMIN_STORAGE_STATE_FILE);
    const api = await layerApiOf(context);
    const admin = await request.newContext({ baseURL: readBaseUrl(), extraHTTPHeaders: api.headers });
    const page = await context.newPage();
    return { context, page, log: requestLog(page), api, admin, projects: [] };
  } catch (error) {
    await context.close();
    throw error;
  }
}

/** Deletes the session's projects (200/404 fine, problems become annotations), writes the rotated cookie back, closes. */
export async function closeAdminSession(session: AdminSession | undefined): Promise<void> {
  if (session === undefined) return;
  for (const id of session.projects) {
    let problem = await deleteProject(session.api, id);
    // run-051b E1-M1: the fixture Bearer can be dead by the end of a flow (401) — fall back to a fresh admin API login.
    if (problem !== null) problem = await deleteWithAdminLogin(id);
    if (problem !== null) test.info().annotations.push({ type: 'cleanup', description: problem });
  }
  await session.admin.dispose().catch(() => undefined);
  await session.context.storageState({ path: ADMIN_STORAGE_STATE_FILE }).catch(() => undefined);
  await session.context.close().catch(() => undefined);
}

/** One admin API login (support/api.ts) + `deleteSeededProject`; returns the problem or null, never throws. */
async function deleteWithAdminLogin(projectId: string): Promise<string | null> {
  try {
    const { email, password } = readAdminCredentials();
    const admin = await signedInApi(email, password);
    try {
      return await deleteSeededProject(admin, projectId);
    } finally {
      await admin.dispose();
    }
  } catch (error) {
    return `cleanup ${projectId}: ${String(error)}`;
  }
}

/** Pool user of `role`/`slot` + N3 member of `projectId` + one browser login in a fresh context (no mocked session). */
export async function openMemberSession(
  browser: Browser,
  owner: AdminSession,
  projectId: string,
  role: Exclude<PoolRole, 'admin'>,
  slot: string,
  options: SessionOptions = {},
): Promise<MemberSession> {
  const user = await poolUser(owner.admin, role, slot);
  await addProjectMember(owner.admin, projectId, user.email);
  if (options.resetRole === true) expect(await setRole(owner.admin, user, role), `setup: #41 ${role}`).toBe(200);
  const context = await browser.newContext(contextOptions(options));
  try {
    await signInPoolUser(context, user);
    const page = await context.newPage();
    return { context, page, log: requestLog(page), user };
  } catch (error) {
    await context.close();
    throw error;
  }
}

/** #41 `PATCH /api/users/:id/role` (admin only; P7.roles.ts setRole on qa/phase04-flows); returns the status. */
export async function setRole(admin: APIRequestContext, user: PoolUser, role: PoolRole): Promise<number> {
  const res = await admin.patch(`/api/users/${user.id}/role`, { data: { role, userId: user.id } });
  return res.status();
}

/* ---- layer builders (wire shape: src/api/schemas/spatial.ts) -------------------------------------------------------- */

/** W4 id `<letter>-<base36 UPPER>` (BE packages/core/ids.py), own copy — layerSeed does not export its `sid`. */
const sid = (letter: 'W' | 'R' | 'F'): string => `${letter}-${randomUUID().replace(/-/gu, '').toUpperCase().slice(0, 20)}`;
/** A5: machine output is never reviewed. RV:50 SUSPECT_CONFIDENCE 0.6 splits "cần soát" from "chưa soát". */
export const ai = (confidence = 0.9): Json => ({ confidence, reviewed: false, source: 'ai' });
const human = (): Json => ({ confidence: 1, reviewed: true, source: 'human' });

const rect = (x0: number, y0: number, w: number, h: number): Pt[] => [
  [x0, y0],
  [x0 + w, y0],
  [x0 + w, y0 + h],
  [x0, y0 + h],
];
const shoelaceM2 = (outline: readonly Pt[]): number =>
  Math.abs(outline.reduce((sum, [x, y], i) => {
    const [nx, ny] = outline[(i + 1) % outline.length] ?? [0, 0];
    return sum + x * ny - nx * y;
  }, 0)) / 2 / 1e6;

const roomOf = (levelId: string, name: string, usage: string, outline: readonly Pt[], review: Json = ai()): Json => ({
  ...review,
  areaM2: shoelaceM2(outline),
  id: sid('R'),
  levelId,
  name,
  outline: outline.map(([x, y]) => ({ x, y })),
  usage,
  wallIds: [],
});
const layerOf = (rest: Json): Json => ({ walls: [], openings: [], rooms: [], furniture: [], ...rest });

/** RA1 "Tầng 1": Phòng khách 24, Bếp 12,5, Ăn 6,25 (0,65), WC 3 (0,5), Kho 1 (human-reviewed) — no wall, no furniture. */
export const roomAreaFloor1 = (levelId: string): Json =>
  layerOf({
    rooms: [
      roomOf(levelId, 'Phòng khách', 'livingRoom', rect(0, 0, 6000, 4000)),
      roomOf(levelId, 'Bếp', 'kitchen', rect(6000, 0, 2500, 5000)),
      roomOf(levelId, 'Ăn', 'other', rect(8500, 0, 2500, 2500), ai(0.65)),
      roomOf(levelId, 'WC', 'bathroom', rect(11000, 0, 1500, 2000), ai(0.5)),
      roomOf(levelId, 'Kho', 'utility', rect(12500, 0, 1000, 1000), human()),
    ],
  });

/** RA1 "Tầng 2": Phòng ngủ 1 18, Phòng chữ L 12 (6 points, perimeter 16 m), Ban công 3,333. */
export const roomAreaFloor2 = (levelId: string): Json =>
  layerOf({
    rooms: [
      roomOf(levelId, 'Phòng ngủ 1', 'bedroom', rect(0, 0, 4000, 4500)),
      roomOf(levelId, 'Phòng chữ L', 'bedroom', [
        [4000, 0],
        [8000, 0],
        [8000, 2000],
        [6000, 2000],
        [6000, 4000],
        [4000, 4000],
      ]),
      roomOf(levelId, 'Ban công', 'other', rect(8000, 0, 3333, 1000)),
    ],
  });

/** One rectangular room, nothing else (RA2). */
export const singleRoom =
  (name: string, widthMm: number, depthMm: number) =>
  (levelId: string): Json =>
    layerOf({ rooms: [roomOf(levelId, name, 'utility', rect(0, 0, widthMm, depthMm))] });

/** One collinear (0 m²) room the BE accepts (`min_length=3`, no area rule — catalog §Seeds RA2). */
export const degenerateRoom =
  (name: string) =>
  (levelId: string): Json =>
    layerOf({ rooms: [roomOf(levelId, name, 'utility', [[0, 0], [1000, 0], [2000, 0]])] });

/** RA3: an 8 × 6 m frame of four 220 mm walls; `open` drops the top side (a gap, no closed loop). */
export const wallsOnly =
  (kind: 'closed' | 'open') =>
  (levelId: string): Json => {
    const sides: readonly (readonly [Pt, Pt])[] = [
      [[0, 0], [8000, 0]],
      [[8000, 0], [8000, 6000]],
      [[0, 0], [0, 6000]],
      ...(kind === 'closed' ? [[[0, 6000], [8000, 6000]] as const] : []),
    ];
    return layerOf({
      walls: sides.map(([from, to]) => ({
        ...ai(),
        centreline: { start: { x: from[0], y: from[1] }, end: { x: to[0], y: to[1] } },
        heightMm: 3_000,
        id: sid('W'),
        kind: 'loadBearing',
        levelId,
        openingIds: [],
        thicknessMm: 220,
      })),
    });
  };

/** FX: `qcLayer` + 3 chairs (`kind:'chair'`) in the kitchen — first-seen order table, chair (batch-replace.ts:151-159). */
export function detectedFurnitureLayer(levelId: string): Json {
  const layer = qcLayer(levelId);
  const rooms = layer.rooms as Json[];
  const kitchen = rooms.find((room) => room.name === 'Bếp')?.id;
  if (typeof kitchen !== 'string') throw new Error('qcLayer has no "Bếp" room');
  const chairs = [3500, 4500, 5500].map((x) => ({
    ...ai(),
    boundingBox: { min: { x: x - 250, y: 750 }, max: { x: x + 250, y: 1250 } },
    centre: { x, y: 1000 },
    id: sid('F'),
    kind: 'chair',
    levelId,
    roomId: kitchen,
    rotationDeg: 0,
  }));
  return { ...layer, furniture: [...(layer.furniture as Json[]), ...chairs] };
}

/* ---- seeds (each registers its project in the session before any further write) ---------------------------------- */

export interface Seeded {
  readonly projectId: string;
  readonly floors: readonly SeededFloor[];
}

async function seed(
  session: AdminSession,
  slug: string,
  names: readonly string[],
  builders: readonly ((levelId: string) => Json)[],
): Promise<Seeded> {
  const floors = await createQcProject(session.api, slug, names, 1);
  const first = floors[0];
  if (first === undefined) throw new Error('seed: no floor');
  session.projects.push(first.projectId);
  for (const [index, build] of builders.entries()) {
    const floor = floors[index];
    if (floor === undefined) throw new Error(`seed: no floor #${String(index)}`);
    await writeLayer(session.api, floor.projectId, floor.floorId, build);
  }
  return { projectId: first.projectId, floors };
}

export const seedQ1 = (s: AdminSession, slug: string): Promise<Seeded> => seed(s, slug, ['Tầng 1'], []);
export const seedFX = (s: AdminSession, slug: string): Promise<Seeded> => seed(s, slug, ['Tầng 1'], [detectedFurnitureLayer]);
export const seedRA1 = (s: AdminSession, slug: string): Promise<Seeded> =>
  seed(s, slug, ['Tầng 1', 'Tầng 2'], [roomAreaFloor1, roomAreaFloor2]);
export const seedRA2 = (s: AdminSession, slug: string): Promise<Seeded> =>
  seed(s, slug, ['Tầng 2', 'Tầng 10', 'Mái'], [singleRoom('Sảnh', 5000, 4000), singleRoom('Phòng máy', 2000, 2000), degenerateRoom('Hộp kỹ thuật')]);
export const seedRA3 = (s: AdminSession, slug: string): Promise<Seeded> =>
  seed(s, slug, ['Tầng 1', 'Tầng 2'], [wallsOnly('closed'), wallsOnly('open')]);

export function floorOf(seeded: Seeded, name: string): SeededFloor {
  const floor = seeded.floors.find((f) => f.floorName === name);
  if (floor === undefined) throw new Error(`seed: no floor "${name}"`);
  return floor;
}

/**
 * +W2: one #35 PUT from the API on the floor's current layer with ONE real change (the last room's name + " W2"). An unchanged
 * layer is not a write for the BE (`spatial_write/writer.py:340` `_unchanged`, no new revision — run-051b E1-T14).
 */
export async function touchLayer(api: LayerApi, projectId: string, floorId: string): Promise<void> {
  const read = await api.request.get(layerPathOf(projectId, floorId), { headers: api.headers });
  expect(read.status(), 'W2: GET N16').toBe(200);
  const layer = ((await read.json()) as Json).layer as Json;
  const rooms = (layer.rooms as Json[] | undefined) ?? [];
  const last = rooms.at(-1);
  if (last === undefined) throw new Error('W2: the floor has no room to change');
  const changed = { ...layer, rooms: [...rooms.slice(0, -1), { ...last, name: `${String(last.name)} W2` }] };
  await writeLayer(api, projectId, floorId, () => changed);
}

/* ---- screen ------------------------------------------------------------------------------------------------------- */

// dup-of: viewer.ts openPascal
/**
 * `/projects/:p/3d` → Pascal caption "Đã dựng…" (PV:61). `/3d` mounts no editor tour (EditorTourContainer only on export,
 * wall review and `/3d/measure` — review-mau-P123): one look, no wait (`waitMs` 0, as P2.ts:204).
 */
export async function openPascal(page: Page, projectId: string): Promise<void> {
  await page.goto(ROUTES.project.viewer(projectId));
  await expect(page.getByRole('region', { name: PV.frame, exact: true }).locator(':scope > p[role="status"]')).toHaveText(
    PASCAL_RENDERED_PATTERN,
    { timeout: PASCAL_RENDER_TIMEOUT_MS },
  );
  await dismissTour(page);
}

export const pascalRoot = (page: Page): Locator => page.locator('.pascal-root');
export const siteButton = (page: Page): Locator => pascalRoot(page).getByRole('button', { name: SITE_LABEL, exact: true });
export const tooltip = (page: Page): Locator => page.getByRole('tooltip');

/** APN:24-49 order of AppFront's panels in the rail, right after "Site" (IR:97-125). */
const RAIL_ORDER: readonly string[] = ['Diện tích phòng', 'Thư viện đồ đạc'];

/**
 * The icon-rail button whose tooltip reads `label`: by its accessible name (FA round 2: `aria-label` = panel label, IR:61),
 * falling back to its fixed position after "Site" (APN:24-49) where the name is missing (⚑ 23R-E-001). Hovered once; its
 * tooltip (Radix, delay 0 — tooltip.tsx:10) must read the label.
 */
export async function railButton(page: Page, label: string): Promise<Locator> {
  const index = RAIL_ORDER.indexOf(label);
  if (index < 0) throw new Error(`Pascal icon rail: "${label}" is not an AppFront panel`);
  const named = pascalRoot(page).getByRole('button', { name: label, exact: true });
  const button = (await named.count()) === 1 ? named : siteButton(page).locator('xpath=following-sibling::button').nth(index);
  await button.hover();
  await expect(tooltip(page).filter({ hasText: label }).first(), `rail button #${String(index + 1)} after "Site" is "${label}"`).toBeAttached({
    timeout: 5_000,
  });
  return button;
}

/** The panel whose h2 is `label` (RAP:201-203, FLP:41-43: root div > header > h2). */
export const panelOf = (page: Page, label: string): Locator =>
  pascalRoot(page).getByRole('heading', { level: 2, name: label, exact: true }).locator('xpath=../..');

/** Opens a rail panel and returns it once its h2 shows. */
export async function openRailPanel(page: Page, label: typeof RA.title | typeof FL.title): Promise<Locator> {
  await (await railButton(page, label)).click();
  const panel = panelOf(page, label);
  await expect(panel).toBeVisible();
  return panel;
}

export const sideRail = (page: Page): Locator => page.getByRole('group', { name: PV.sideRail, exact: true });
export const historyRegion = (page: Page): Locator => page.getByRole('region', { name: PV.history, exact: true });
/** PV:279-282 — the save line (the frame caption has no `aria-live`). */
export const saveLine = (page: Page): Locator =>
  page.getByRole('region', { name: PV.frame, exact: true }).locator('p[role="status"][aria-live="polite"]');
/** NotificationHost joins "title — description" into one string (NotificationHost.tsx toToastMessage; run-051b E1-T9). */
export const toast = (page: Page, title: string): Locator =>
  page.getByRole('region', { name: PV.toasts, exact: true }).getByText(new RegExp(`^${escapeRegExp(title)}( — |$)`, 'u'));

/** Clipboard text (context created with `clipboard: true`). */
export const readClipboard = (page: Page): Promise<string> => page.evaluate(() => navigator.clipboard.readText());

// dup-of: measure.ts canvasOnlyShot
/** PNG of Pascal's one `<canvas>` (e2e/pascal-viewer.spec.ts:732). */
export const canvasShot = (page: Page): Promise<Buffer> => page.getByTestId('pascal-canvas').locator('canvas').first().screenshot();

/** Ctrl+Z with no text field focused — Pascal listens on window and skips inputs (use-keyboard.ts:300-306, 493-496). */
export async function undoOnCanvas(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Control+z');
}

/* ---- room-area panel ---------------------------------------------------------------------------------------------- */

export const combo = (scope: Locator, label: string): Locator => scope.getByRole('combobox', { name: label });
export const roomButton = (panel: Locator, name: string): Locator =>
  panel.locator('section li').getByRole('button', { name, exact: true });
/** RAP:368-376 — the row box that carries `bg-accent` / `bg-accent/60`. */
export const roomRow = (panel: Locator, name: string): Locator =>
  panel.locator('section li > div').filter({ has: panel.page().getByRole('button', { name, exact: true }) });
export const roomSubline = (panel: Locator, name: string): Locator => roomRow(panel, name).locator('div.text-xs');
export const roomArea = (panel: Locator, name: string): Locator => roomRow(panel, name).locator(':scope > span.tabular-nums');
/** RAP:64-71 status dot (`aria-label` on a role-less span). */
export const roomDot = (panel: Locator, name: string): Locator => roomRow(panel, name).locator('span[aria-label]');
export const roomNames = (panel: Locator): Promise<string[]> => panel.locator('section li button').allTextContents();
export const groupLabels = (panel: Locator): Promise<string[]> => panel.locator('section h3').allTextContents();
const groupSection = (panel: Locator, label: string): Locator =>
  panel.locator('section').filter({ has: panel.page().locator('h3').filter({ hasText: new RegExp(`^${escapeRegExp(label)}$`, 'u') }) });
export const groupRows = (panel: Locator, label: string): Promise<string[]> => groupSection(panel, label).locator('li button').allTextContents();
export const groupSubtotal = (panel: Locator, label: string): Locator => groupSection(panel, label).locator('h3 + span');
export const panelTotal = (panel: Locator): Locator => panel.getByText(RA.total, { exact: true }).locator('xpath=following-sibling::div[1]');
export const renameInput = (panel: Locator): Locator => panel.locator('section li input');
export const renameBand = (panel: Locator): Locator => panel.getByText(/^Đã đổi tên thành /u); // no lone `"` in a text regex: it breaks the `>>` selector chain (run-051 T4)
export const undoButton = (panel: Locator): Locator => panel.getByRole('button', { name: RA.undoRename, exact: true });
export const expandToggle = (panel: Locator): Locator => panel.getByRole('button', { name: RA.fullTable, exact: true });

/** Expands the collapsed panel in place (RAP:224-232), so the small rooms (WC, Kho, Ban công) are rows too. */
export async function expand(panel: Locator): Promise<void> {
  await expandToggle(panel).click();
  await expect(panel.getByRole('button', { name: RA.collapsed, exact: true })).toBeVisible();
}

/** Double-click → type → Enter (RAP:381-402); returns once the input is gone. */
export async function renameRoom(panel: Locator, from: string, to: string): Promise<void> {
  await roomButton(panel, from).dblclick();
  const input = renameInput(panel);
  await expect(input).toBeFocused();
  await input.fill(to);
  await input.press('Enter');
  await expect(input).toHaveCount(0);
}

/** RAF:53-58 — the full-page table, portalled to `document.body`. */
export const fullPage = (page: Page): Locator => page.getByRole('dialog', { name: RA.title, exact: true });
/** Rows of the full-page table that are rooms (4 cells; subtotal rows have 2). */
export const fullRoomRows = (dialog: Locator): Locator => dialog.locator('tbody tr:has(td:nth-child(4))');

/* ---- furniture panel ---------------------------------------------------------------------------------------------- */

export const itemCount = (panel: Locator): Locator => panel.locator('header span');
export const chipGroup = (panel: Locator): Locator => panel.getByRole('group', { name: FL.groupLabel, exact: true });
export const chip = (panel: Locator, label: string): Locator => chipGroup(panel).getByRole('button', { name: label, exact: true });
export const searchBox = (panel: Locator): Locator => panel.getByRole('searchbox', { name: FL.searchLabel });
/** IC:57-107 — tile buttons of the grid. */
export const tiles = (panel: Locator): Locator => panel.locator('div.grid > button');
/** Tile by its catalog name (case-sensitive: "Dining table" ≠ "Dining Table"). */
export const tile = (panel: Locator, name: string): Locator => tiles(panel).filter({ has: panel.page().locator(`img[alt="${name}"]`) });
export const tileNames = (panel: Locator): Promise<string[]> => tiles(panel).locator('span').allTextContents();
export const detectedStrip = (panel: Locator): Locator => panel.getByRole('region', { name: FL.detectedTitle, exact: true });
export const detectedRow = (panel: Locator, text: string): Locator =>
  detectedStrip(panel).locator('li').filter({ has: panel.page().locator('span').filter({ hasText: new RegExp(`^${escapeRegExp(text)}$`, 'u') }) });
export const replaceButton = (row: Locator): Locator => row.getByRole('button', { name: FL.replaceAll, exact: true });
export const previewDialog = (page: Page): Locator => page.getByRole('dialog', { name: /^Thay thế tất cả \d+ /u });
/** Tiles that look selected (IC:69 `ring-2`). */
export const selectedTileCount = (panel: Locator): Promise<number> =>
  tiles(panel).evaluateAll((els) => els.filter((el) => el.classList.contains('ring-2')).length);

/* ---- layout probes (ui) ------------------------------------------------------------------------------------------- */

/**
 * `name: <box>` problems of `targets` against the Pascal canvas box (the container the panels live in, PV:255-260) and the
 * viewport: a target must be shown and lie inside both horizontally (±1 px) — x only: panels scroll vertically
 * inside the box, so a row below the fold is not a defect. `against: 'viewport'` (dialogs fixed to the viewport) checks the
 * viewport only. Empty = all inside.
 */
export async function outsideFrame(
  page: Page,
  targets: Readonly<Record<string, Locator>>,
  against: 'canvas' | 'viewport' = 'canvas',
): Promise<string[]> {
  const vw = page.viewportSize()?.width ?? 0;
  const frame = against === 'canvas' ? await page.getByTestId('pascal-canvas').boundingBox() : { x: 0, y: 0, width: vw, height: 0 };
  const problems: string[] = [];
  if (frame === null) return ['pascal-canvas: no box'];
  for (const [name, locator] of Object.entries(targets)) {
    const box = await locator.first().boundingBox();
    if (box === null) {
      problems.push(`${name}: not shown`);
      continue;
    }
    const right = box.x + box.width;
    if (box.x < frame.x - 1 || right > frame.x + frame.width + 1 || box.x < -1 || right > vw + 1) {
      problems.push(`${name}: x ${Math.round(box.x)}–${Math.round(right)} outside frame ${Math.round(frame.x)}–${Math.round(frame.x + frame.width)} / viewport ${String(vw)}`);
    }
  }
  return problems;
}
