/**
 * QA-04c P2 helpers (SCR-17 object layer review): `phase04_objects_edge.spec.ts`, `phase04_objects_mocked_edge.spec.ts`,
 * `phase04_objects_ui.spec.ts`. Owned by P2 only; shared seeds (`layerSeed.ts`, `phase03Seed.ts`, `drawingSeed.ts`) are
 * re-used, never edited.
 *
 * - {@link openSession}: one browser context signed in as the file's POOL ADMIN (`poolUser(admin, 'admin', SLOT)`, one
 *   `POST /api/auth/login`), its page, the response log (`watchApi`), the request log, every `PUT …/spatial/layer` body
 *   ({@link PutRecord}) and a fixture API (`layerApiOf`: the context's own token, one `POST /api/auth/refresh`).
 * - Seed builders (all through the real #35 route, W4 ids, no critical integrity issue): {@link createObjectsProject}
 *   with a layer per floor, and the named plan seeds {@link objectsMenu}, {@link objectsLowConf},
 *   {@link objectsEmptyProject}, {@link objectsUiProject}, {@link lowWallLayer}.
 * - Locators of the screen (`ObjectLayerReview/*`), kept here so the three spec files read the same names.
 *
 * Ids are deterministic per call (`<letter>-QA<nn><tag>`): the screen numbers codes by SORTED id inside one kind
 * (domain/spatial/ids.ts displayCodesOf), so `nn` decides which object is "#D-001", "#D-002"... and a spec can name rows.
 */
import { randomUUID } from 'node:crypto';

import { expect, type APIRequestContext, type Browser, type BrowserContext, type Locator, type Page, type Route } from '@playwright/test';

import { displayCodesOf } from '../../../../src/domain/spatial/ids';
import { ROUTES } from '../../../../e2e/fixtures/routes';
import { navigateThenWaitForApi, type ApiEntry } from '../../../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../../../e2e/fullstack/env';
import { escapeRegExp, openFlow, type Flow } from '../p03/P5';
import { adminApi, poolApi } from '../p03/P11';
import { captureEvidence } from '../evidence';
import { createQcProject, deleteProject, layerApiOf, layerPathOf, qcLayer as qcLayerOf, writeLayer, type LayerApi, type SeededFloor } from '../layerSeed';
import { poolUser, type PoolUser } from '../phase03Seed';
import { ASK_CARD } from './P1';

export { escapeRegExp };
export type Json = Record<string, unknown>;
export type { LayerApi, SeededFloor, PoolUser };

export const SLOT = 'p04-p2';
export const DESKTOP = { width: 1440, height: 900 } as const;
export const PROJECTS_API = '/api/projects';

export const asRecord = (value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what}: not a JSON object`);
  return value as Json;
};
export const arrayOf = (value: unknown, what: string): Json[] => {
  if (!Array.isArray(value)) throw new Error(`${what}: not an array`);
  return value.map((item, index) => asRecord(item, `${what}[${String(index)}]`));
};
export const pathOf = (page: Page): string => new URL(page.url()).pathname;
/** `list[index]`, or a thrown error naming what is missing (the fixtures are trusted to have it). */
export function at<T>(list: readonly T[], index: number, what = 'item'): T {
  const item = list[index];
  if (item === undefined) throw new Error(`setup: no ${what} at ${String(index)}`);
  return item;
}

/* ---------------------------------------------------------------- copy (each cites its source) */

export const OBJ = {
  screen: 'Lớp đối tượng', // OV:65
  canvas: 'Mặt bằng lớp đối tượng', // OCV (OBJECT_CANVAS_TEXT.canvasLabel)
  list: 'Danh sách đối tượng', // OL:47
  tree: 'Cây lớp', // OLP
  filters: 'Lọc theo loại', // OLP
  legend: 'Chú giải màu lớp', // OCV
  rail: 'Công cụ lớp đối tượng', // OT
  status: 'Thanh trạng thái', // OS
  toasts: 'Thông báo', // Toast.tsx
  doors: 'Cửa đi',
  windows: 'Cửa sổ',
  furniture: 'Nội thất',
  approve: /^Duyệt #/u, // OI: "Duyệt #D-002" (Z/S-16)
  inspectorEmpty: 'Chọn một mục để xem chi tiết.', // OI — L23: chưa chọn gì thì thẻ hỏi không hiện, câu này không còn trên màn
  type: 'Loại đối tượng', // OI
  position: 'Vị trí trên tường', // OI
  undo: 'Hoàn tác', // OS / Toast
  collapse: 'Thu gọn hai panel',
  expand: 'Mở lại hai panel',
  emptyTitle: 'Chưa nhận ra đối tượng nào', // OV:67
  emptyExplanation:
    'Nhận diện nội thất phụ thuộc kiểu vẽ của bản gốc, nên bản vẽ ít ký hiệu quy ước có thể không ra kết quả nào.', // OG:1251
  emptyNoWall:
    'Tầng này chưa có đoạn tường nào, nên chưa có chỗ đặt cửa hay cửa sổ. Duyệt lớp tường trước rồi quay lại đây.', // OG:1262
  addManually: 'Thêm thủ công',
  openWalls: 'Sang duyệt tường',
  lowOnly: 'Chỉ hiện mục dưới ngưỡng', // OV:60
  nothingToDraw: 'Chưa có đối tượng nào để vẽ trên mặt bằng.', // OCV
  emptyGroup: 'Chưa có đối tượng nào trong nhóm này', // OL
  addRefused: 'Không thêm được đối tượng vào tường.', // OG:1264
  furnitureFree: 'Không gắn tường',
  forbidden: 'Bạn đang xem — không sửa được lớp này.', // OG:1266 (BUG-601)
} as const;

export const SAVE = {
  conflict: 'Tầng này vừa được sửa ở nơi khác. Tải lại để xem bản mới nhất.', // SLS:83
  reload: 'Tải lại', // FSB
  confirmTitle: 'Bỏ thay đổi chưa lưu của tầng này?', // FSC
  confirmReload: 'Tải lại và bỏ thay đổi', // FSC
  cancel: 'Huỷ', // FSC
  unknown: 'Không lưu được thay đổi của tầng này.', // SLS
  reloadFailed: 'Không tải lại được tầng này. Thử lại sau.', // UAS:275
} as const;

/* ---------------------------------------------------------------- locators */

export const screen = (page: Page): Locator => page.getByRole('region', { name: OBJ.screen, exact: true });
export const listGroup = (page: Page): Locator => page.getByRole('group', { name: OBJ.list, exact: true });
export const groupBox = (page: Page, label: string): Locator => page.getByRole('listbox', { name: label, exact: true });
/* Z/S-16: danh sách là hàng đợi hai nhóm ("Cần duyệt" / "Đã duyệt"), không còn một nhóm cho mỗi loại.
   Dòng của một loại = option có mã #D- / #S- / #F-. */
const LAYER_CODE_PREFIX: Readonly<Record<string, string>> = { 'Cửa đi': 'D', 'Cửa sổ': 'S', 'Nội thất': 'F' };
export const layerOptions = (page: Page, layerLabel: string): Locator =>
  listGroup(page).getByRole('option', { name: new RegExp(`^#${LAYER_CODE_PREFIX[layerLabel] ?? '?'}-`, 'u') });
export const QUEUE = { pending: 'Cần duyệt', reviewed: 'Đã duyệt' } as const;
/** Mở menu "Loại con" (details) để thấy tám chip loại con — gọi lại nhiều lần vẫn an toàn. */
export const openSubtypeMenu = async (page: Page): Promise<void> => {
  const summary = page.locator('summary').filter({ hasText: 'Loại con' });
  const isOpen = await summary.evaluate((node) => (node.parentElement as HTMLDetailsElement | null)?.open === true);
  if (!isOpen) await summary.click();
};
export const allOptions = (page: Page): Locator => listGroup(page).getByRole('option');
export const optionOf = (page: Page, code: string): Locator =>
  listGroup(page).getByRole('option', { name: new RegExp(`^${escapeRegExp(code)} — `, 'u') });
/** L23: chi tiết đối tượng đang chọn nằm trong thẻ hỏi neo trên bản vẽ (QcAskCard); chưa chọn gì thì không có thẻ. */
export const inspector = (page: Page): Locator => page.getByRole('region', { name: ASK_CARD, exact: true });
export const approveButton = (page: Page): Locator => inspector(page).getByRole('button', { name: OBJ.approve, exact: true });
export const statusBar = (page: Page): Locator => page.getByRole('status', { name: OBJ.status, exact: true });
export const symbolOf = (page: Page, code: string): Locator => page.locator(`g[aria-label="${code}"]`);
export const toastRegion = (page: Page): Locator => page.getByRole('region', { name: OBJ.toasts, exact: true });
/* Z/S-16: tám chip loại con nằm trong menu "Loại con" (details) — bước dùng chip phải mở "Loại con" trước. */
export const chip = (page: Page, label: string): Locator =>
  page.getByRole('group', { name: 'Lọc theo loại con', exact: true }).getByRole('button', { name: label, exact: true });
/* Nút lọc theo loại ở cột việc: "Chỉ hiện cửa đi" (aria-pressed = đang lọc). Nút "Ẩn/Hiện lớp …" đã bỏ ở bố cục L23. */
export const treeItem = (page: Page, label: string): Locator =>
  page.getByRole('group', { name: OBJ.filters, exact: true }).getByRole('button', { name: `Chỉ hiện ${label.toLowerCase()}`, exact: true });
/** L23: công tắc lớp là checkbox "Cửa đi"/"Cửa sổ"/"Nội thất" trong popover "Hiển thị" (mở popover trước khi đọc). */
export const eyeButton = (page: Page, layerLabel: string): Locator => page.getByRole('checkbox', { name: new RegExp(`^${escapeRegExp(layerLabel)}$`, 'iu') });
/** Mở popover "Hiển thị" nếu đang đóng. */
export async function openDisplay(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: 'Hiển thị', exact: true });
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
}
/** Bật/tắt một lớp qua popover "Hiển thị" (thay nút mắt "Ẩn lớp …" cũ). */
export async function toggleLayer(page: Page, layerLabel: string): Promise<void> {
  await openDisplay(page);
  await pressSpaceOn(eyeButton(page, layerLabel));
}
export const legend = (page: Page): Locator => page.getByLabel(OBJ.legend, { exact: true });
export const typeBox = (page: Page): Locator => inspector(page).getByRole('combobox', { name: OBJ.type, exact: true });
export const swingRadio = (page: Page, label: string): Locator => inspector(page).getByRole('radio', { name: label, exact: true });
export const positionSlider = (page: Page): Locator => inspector(page).getByRole('slider', { name: OBJ.position, exact: true });
/** The slider's own track (Slider.tsx `flex-1` box around the knob): a pointer x maps to `(x - left) / width`. */
export const sliderTrack = (page: Page): Locator => positionSlider(page).locator('xpath=ancestor::div[contains(@class,"flex-1")][1]');
export const menuItem = (page: Page, name: string): Locator => page.getByRole('menu', { name: 'Tuỳ chọn', exact: true }).getByRole('menuitem', { name, exact: true });
export const railButton = (page: Page, name: string): Locator => page.getByRole('toolbar', { name: OBJ.rail, exact: true }).getByRole('button', { name, exact: true });

/** Custom `Select`: the open listbox is the trigger's `aria-controls` (main spec `openSelect`). */
export async function openSelect(page: Page, trigger: Locator): Promise<Locator> {
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const id = await trigger.getAttribute('aria-controls');
  if (id === null || id === '') throw new Error('select trigger has no aria-controls once open');
  return page.locator(`[id="${id}"]`);
}

/** Checkbox / Radio.Item: focus + Space (sr-only input under a drawn box). */
export async function pressSpaceOn(control: Locator): Promise<void> {
  await control.focus();
  await control.page().keyboard.press('Space');
}

/** Current text of the screen's counter line ("N/M đối tượng đã duyệt"), read from the status bar. */
export const counterText = async (page: Page): Promise<string> => (await statusBar(page).locator('span[aria-live="polite"]').innerText()).trim();

/** `n` option labels (aria-label, "<code> — <status>") of every list row in the DOM order. */
export const optionLabels = async (page: Page): Promise<string[]> =>
  allOptions(page).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label') ?? ''));

/** The code ("#D-001") of a list option from its aria-label. */
export const codeOfLabel = (label: string): string => label.split(' — ')[0] ?? label;

/* ---------------------------------------------------------------- evidence */

/** `E04_<row id>_<slug>.png` (edge) — every step captures one (flow-plan "How to read this plan"). */
export const ev = (page: Page, rowId: string, slug: string, prefix: 'E04' | 'U04' = 'E04', caption?: string | readonly string[]): Promise<string> =>
  captureEvidence(page, `${prefix}_${rowId}_${slug}.png`, caption === undefined ? {} : { caption });

/** Runs `fn`; a thrown error (locator timeout on a missing control...) becomes ONE soft failure and the walk goes on. */
export async function attempt(what: string, fn: () => Promise<void>): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch (error) {
    const first = (error instanceof Error ? error.message : String(error)).replace(/\u001b\[[0-9;]*m/gu, '').split('\n')[0] ?? '';
    expect.soft(first, `${what}: the action could not be done`).toBe('ok');
    return false;
  }
}

/** "Nothing was sent" window: autosave debounce 800 ms (createAutosave.ts DEFAULT_DEBOUNCE_MS) plus a round trip. */
export const QUIET_MS = 1_800;
/** Negative claims ("no PUT follows") have no event to wait for. */
export async function quiet(page: Page, ms: number = QUIET_MS): Promise<void> {
  await page.waitForTimeout(ms); // fixed-wait-ok: a "nothing was sent" claim has no event to wait for (debounce 800 ms + round trip)
}

/** Quick action timeout for controls that may be missing (a bug must not cost the 30 s default per click). */
export const QUICK = 5_000;

/* ---------------------------------------------------------------- session */

export interface PutRecord {
  readonly path: string;
  readonly body: Json;
  readonly at: number;
}

export interface Session {
  readonly flow: Flow;
  readonly context: BrowserContext;
  readonly page: Page;
  readonly log: ApiEntry[];
  readonly api: LayerApi;
  /** Every `PUT …/spatial/layer` the page sent, in order (body parsed). */
  readonly puts: PutRecord[];
  /** Project ids this session owns; deleted by {@link closeSession}. */
  readonly cleanup: string[];
  readonly owner: PoolUser;
}

/** Pool admin of this file (made on first use: 1 invitation), the viewer of this file, both through the main admin. */
export async function poolUsers(): Promise<{ readonly owner: PoolUser; readonly viewer: PoolUser }> {
  const admin = await adminApi();
  try {
    return { owner: await poolUser(admin, 'admin', SLOT), viewer: await poolUser(admin, 'viewer', SLOT) };
  } finally {
    await admin.dispose();
  }
}

const LAYER_PUT_RE = /^\/api\/projects\/[^/]+\/floors\/[^/]+\/spatial\/layer$/u;

export async function openSession(browser: Browser, owner: PoolUser, options: { readonly viewport?: { width: number; height: number }; readonly reducedMotion?: boolean } = {}): Promise<Session> {
  const flow = await openFlow(browser, owner, options);
  try {
    const api = await layerApiOf(flow.context);
    // `openFlow` only RECORDS dialogs (`flow.dialogs`); with a listener attached Playwright no longer answers them, and a
    // beforeunload prompt (unsent change, UAS:428-431) would hold the next `goto` for its whole timeout: leave the page.
    flow.page.on('dialog', (dialog) => {
      void dialog.accept().catch(() => undefined);
    });
    const puts: PutRecord[] = [];
    flow.page.on('request', (request) => {
      const pathname = new URL(request.url()).pathname;
      if (request.method() !== 'PUT' || !LAYER_PUT_RE.test(pathname)) return;
      let body: Json = {};
      try {
        body = asRecord(request.postDataJSON(), 'PUT body');
      } catch {
        /* keep {} */
      }
      puts.push({ path: pathname, body, at: Date.now() });
    });
    return { flow, context: flow.context, page: flow.page, log: flow.log, api, puts, cleanup: [], owner };
  } catch (error) {
    await flow.context.close().catch(() => undefined);
    throw error;
  }
}

/** Deletes the session's projects (admin owner), then closes the context. Never throws. */
export async function closeSession(session: Session | undefined): Promise<void> {
  if (session === undefined) return;
  for (const id of session.cleanup) {
    const problem = await deleteProject(session.api, id);
    if (problem !== null) console.warn(`P2 cleanup: ${problem}`);
  }
  await session.context.close().catch(() => undefined);
}

/** A second browser context (viewer / other user): one login through its own jar. */
export async function openUserContext(browser: Browser, user: PoolUser, viewport: { width: number; height: number } = DESKTOP): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport });
  try {
    const res = await context.request.post('/api/auth/login', {
      data: { email: user.email, password: user.password, rememberMe: false },
      headers: { Origin: readBaseUrl() },
    });
    expect(res.status(), `setup: POST /api/auth/login as pool ${user.role}`).toBe(204);
    return { context, page: await context.newPage() };
  } catch (error) {
    await context.close();
    throw error;
  }
}

/** N3 `POST /api/projects/:id/members {email}` by the owner (own token). */
export async function addMember(session: Session, projectId: string, email: string): Promise<void> {
  const res = await session.api.request.post(`${PROJECTS_API}/${projectId}/members`, { headers: session.api.headers, data: { email } });
  expect(res.status(), `setup: POST ${PROJECTS_API}/${projectId}/members: ${(await res.text()).slice(0, 200)}`).toBe(201);
}

/* ---------------------------------------------------------------- layer builders */

type Pt = readonly [number, number];

export interface WallSpec {
  readonly id: string;
  readonly from: Pt;
  readonly to: Pt;
  readonly heightMm?: number;
  readonly kind?: 'loadBearing' | 'partition';
  readonly reviewed?: boolean;
}

export interface OpeningSpec {
  readonly id: string;
  readonly wall: string;
  readonly kind: 'door' | 'window';
  readonly offsetMm: number;
  readonly widthMm?: number;
  readonly heightMm?: number;
  readonly sillMm?: number;
  readonly swing?: 'left' | 'right' | 'double' | 'sliding' | 'fixed';
  readonly confidence?: number;
  readonly reviewed?: boolean;
}

export interface FurnitureSpec {
  readonly id: string;
  readonly at: Pt;
  readonly kind?: 'table' | 'bed' | 'chair' | 'other';
  readonly confidence?: number;
  readonly reviewed?: boolean;
}

export interface LayerSpec {
  readonly walls?: readonly WallSpec[];
  readonly openings?: readonly OpeningSpec[];
  readonly furniture?: readonly FurnitureSpec[];
}

/** A5: AI output is never `reviewed`; a reviewed item is human (schemas/spatial.ts humanOnlyReview). */
const review = (confidence: number | undefined, reviewed: boolean | undefined): Json =>
  reviewed === true ? { confidence: 1, reviewed: true, source: 'human' } : { confidence: confidence ?? 0.9, reviewed: false, source: 'ai' };

/** Wire layer of `spec` for `levelId`; wall `openingIds` are derived from the openings. */
export function wireLayer(levelId: string, spec: LayerSpec): Json {
  const walls = spec.walls ?? [];
  const openings = spec.openings ?? [];
  return {
    walls: walls.map((wall) => ({
      ...review(0.9, wall.reviewed),
      centreline: { start: { x: wall.from[0], y: wall.from[1] }, end: { x: wall.to[0], y: wall.to[1] } },
      heightMm: wall.heightMm ?? 3_000,
      id: wall.id,
      kind: wall.kind ?? 'loadBearing',
      levelId,
      openingIds: openings.filter((opening) => opening.wall === wall.id).map((opening) => opening.id),
      thicknessMm: 220,
    })),
    openings: openings.map((opening) => ({
      ...review(opening.confidence, opening.reviewed),
      heightMm: opening.heightMm ?? (opening.kind === 'door' ? 2_100 : 1_200),
      id: opening.id,
      kind: opening.kind,
      offsetMm: opening.offsetMm,
      sillHeightMm: opening.sillMm ?? (opening.kind === 'door' ? 0 : 900),
      swing: opening.swing ?? (opening.kind === 'door' ? 'left' : 'fixed'),
      wallId: opening.wall,
      widthMm: opening.widthMm ?? (opening.kind === 'door' ? 900 : 1_200),
    })),
    rooms: [],
    furniture: (spec.furniture ?? []).map((item) => ({
      ...review(item.confidence, item.reviewed),
      boundingBox: { min: { x: item.at[0] - 400, y: item.at[1] - 300 }, max: { x: item.at[0] + 400, y: item.at[1] + 300 } },
      centre: { x: item.at[0], y: item.at[1] },
      id: item.id,
      kind: item.kind ?? 'table',
      levelId,
      rotationDeg: 0,
    })),
  };
}

const tagOf = (): string => randomUUID().replace(/-/gu, '').toUpperCase().slice(0, 8);

/** Ids that sort by `n` inside one kind: `<letter>-QA<nn><tag>` (see the file comment). */
export function ids(tag: string = tagOf()): { w: (n: number) => string; d: (n: number) => string; f: (n: number) => string } {
  const make = (letter: 'W' | 'D' | 'F') => (n: number): string => `${letter}-QA${String(n).padStart(2, '0')}${tag}`;
  return { w: make('W'), d: make('D'), f: make('F') };
}

/** A floor with no object and no wall: the empty layer. */
export const emptyLayer = (levelId: string): Json => wireLayer(levelId, {});

/** One 6 m wall, no object ("Thêm thủ công" target). */
export function oneWallLayer(levelId: string): Json {
  const id = ids();
  return wireLayer(levelId, { walls: [{ id: id.w(1), from: [0, 0], to: [6_000, 0] }] });
}

/** One 600 mm wall: the manual door template (900 mm wide) does not fit (17-C-033). */
export function shortWallLayer(levelId: string): Json {
  const id = ids();
  return wireLayer(levelId, { walls: [{ id: id.w(1), from: [0, 0], to: [600, 0] }] });
}

/**
 * `qcLayer` + one extra wall of `heightMm` 2000 carrying a 1 800 mm door (#D-002; the Q1 door sorts first, hex ids < "QA"):
 * as a window (sill 900) its head would stand at 2 700 mm, above the wall → M-08 `aboveWallTop` (critical) refuses the kind
 * change (17-C-021, OG:948-958).
 */
export function lowWallLayer(levelId: string): Json {
  const base = asRecord(qcLayerOf(levelId), 'qcLayer');
  const id = ids();
  const extra = wireLayer(levelId, {
    walls: [{ id: id.w(99), from: [9_500, 0], to: [9_500, 3_000], heightMm: 2_000 }],
    openings: [{ id: id.d(99), wall: id.w(99), kind: 'door', offsetMm: 1_000, heightMm: 1_800, swing: 'left' }],
  });
  return {
    ...base,
    walls: [...arrayOf(base.walls, 'walls'), ...arrayOf(extra.walls, 'walls')],
    openings: [...arrayOf(base.openings, 'openings'), ...arrayOf(extra.openings, 'openings')],
  };
}

/** Floor "with 2 doors, one reviewed": #D-001 unreviewed, #D-002 reviewed (human), one 8 m wall. */
export function twoDoorsLayer(levelId: string): Json {
  const id = ids();
  return wireLayer(levelId, {
    walls: [{ id: id.w(1), from: [0, 0], to: [8_000, 0] }],
    openings: [
      { id: id.d(1), wall: id.w(1), kind: 'door', offsetMm: 1_000 },
      { id: id.d(2), wall: id.w(1), kind: 'door', offsetMm: 4_000, reviewed: true },
    ],
  });
}

/**
 * Low-confidence floor (8 m wall): door #D-001 0,95 · door #D-002 0,80 · window #S-001 0,60 · door #D-003 approved
 * (human) · table #F-001 0,90. Only the 0,60 window is under the fixed 0,75 cut; with the project threshold at 0,9 both
 * #D-002 and the window would be "low" (17-C-009).
 */
export function lowConfLayer(levelId: string): Json {
  const id = ids();
  return wireLayer(levelId, {
    walls: [{ id: id.w(1), from: [0, 0], to: [8_000, 0] }],
    openings: [
      { id: id.d(1), wall: id.w(1), kind: 'door', offsetMm: 500, confidence: 0.95 },
      { id: id.d(2), wall: id.w(1), kind: 'door', offsetMm: 2_000, confidence: 0.8 },
      { id: id.d(3), wall: id.w(1), kind: 'door', offsetMm: 3_500, reviewed: true },
      { id: id.d(4), wall: id.w(1), kind: 'window', offsetMm: 5_000, confidence: 0.6 },
    ],
    furniture: [{ id: id.f(1), at: [3_000, 1_500] }],
  });
}

/** One door on one wall (the "success" floor: approve it and every object is reviewed). */
export function oneDoorLayer(levelId: string): Json {
  const id = ids();
  return wireLayer(levelId, {
    walls: [{ id: id.w(1), from: [0, 0], to: [6_000, 0] }],
    openings: [{ id: id.d(1), wall: id.w(1), kind: 'door', offsetMm: 1_000 }],
  });
}

/* ---------------------------------------------------------------- project seeds */

export interface FloorSeed {
  readonly name: string;
  /** Layer written over the default `qcLayer` of the first floor / onto the others; absent = keep (first) or empty (others). */
  readonly build?: (levelId: string) => Json;
}

export interface ObjectsProject {
  readonly projectId: string;
  readonly floors: readonly SeededFloor[];
}

/**
 * Own project `qa-<runId>-<slug>-<uniq>` (registered for deletion) whose floors carry `seeds[i].build` (the first floor
 * keeps `qcLayer` when it has none). Reuses `createQcProject` (one `qcLayer` PUT on the first floor) and overwrites through #35.
 */
export async function createObjectsProject(session: Session, slug: string, seeds: readonly FloorSeed[]): Promise<ObjectsProject> {
  const floors = await createQcProject(session.api, slug, seeds.map((seed) => seed.name), 1);
  const projectId = floors[0]?.projectId;
  if (projectId === undefined) throw new Error('setup: no floors created');
  session.cleanup.push(projectId);
  for (const [index, seed] of seeds.entries()) {
    const floor = floors[index];
    if (floor === undefined || seed.build === undefined) continue;
    await writeLayer(session.api, projectId, floor.floorId, seed.build);
  }
  return { projectId, floors };
}

/** Q1 as the plan names it: one floor with `qcLayer`. */
export const objectsQ1 = (session: Session, slug: string): Promise<ObjectsProject> => createObjectsProject(session, slug, [{ name: 'Tầng 1' }]);

/** Q1 + a second floor with `lowWallLayer`-style data is built by FL-17-02 itself; this is Q1 whose layer is {@link lowWallLayer}. */
export const objectsQ1LowWall = (session: Session, slug: string): Promise<ObjectsProject> =>
  createObjectsProject(session, slug, [{ name: 'Tầng 1', build: lowWallLayer }]);

/** QX:objects-menu — Q1 floor + floor with 2 doors, one reviewed. */
export const objectsMenu = (session: Session, slug: string): Promise<ObjectsProject> =>
  createObjectsProject(session, slug, [{ name: 'Tầng 1' }, { name: 'Tầng 2', build: twoDoorsLayer }]);

/** QX:objects-lowconf — low-confidence floor + a floor with 1 door; project "Ngưỡng tin cậy" 0,9 (PUT settings). */
export async function objectsLowConf(session: Session, slug: string): Promise<ObjectsProject> {
  const project = await createObjectsProject(session, slug, [
    { name: 'Tầng 1', build: lowConfLayer },
    { name: 'Tầng 2', build: oneDoorLayer },
  ]);
  await setConfidenceThreshold(session.api, project.projectId, 0.9);
  return project;
}

/** QX:objects-empty — empty floor, 1-wall floor, 600 mm wall floor, 2nd seeded floor (Q1 layer). */
export const objectsEmptyProject = (session: Session, slug: string): Promise<ObjectsProject> =>
  createObjectsProject(session, slug, [
    { name: 'Tầng trống', build: emptyLayer },
    { name: 'Tầng một tường', build: oneWallLayer },
    { name: 'Tầng tường ngắn', build: shortWallLayer },
    { name: 'Tầng có đối tượng', build: qcLayerOf },
  ]);

/** QX:objects-ui — Q1 floor + empty floor + 1-wall floor + low-conf floor (the bogus floor id is built by the flow). */
export const objectsUiProject = (session: Session, slug: string): Promise<ObjectsProject> =>
  createObjectsProject(session, slug, [
    { name: 'Tầng 1' },
    { name: 'Tầng trống', build: emptyLayer },
    { name: 'Tầng một tường', build: oneWallLayer },
    { name: 'Tầng độ tin cậy thấp', build: lowConfLayer },
  ]);

/** Writes `qcLayer` (Q1) onto another floor of the session's project through #35. */
export const writeQ1 = (session: Session, projectId: string, floorId: string): Promise<Json> => writeLayer(session.api, projectId, floorId, qcLayerOf);

/** N6 read + full-body write: project "Ngưỡng tin cậy" (BE project_settings; phase03_settings_edge putSettingsElsewhere). */
export async function setConfidenceThreshold(api: LayerApi, projectId: string, threshold: number): Promise<void> {
  const path = `${PROJECTS_API}/${projectId}/settings`;
  const read = await api.request.get(path, { headers: api.headers });
  expect(read.status(), `setup: GET ${path}`).toBe(200);
  const current = asRecord(await read.json(), 'GET settings');
  const written = await api.request.put(path, {
    headers: api.headers,
    data: {
      baseVersion: current.revision,
      body: {
        buildingType: current.buildingType,
        lengthUnit: current.lengthUnit,
        snapToleranceMm: current.snapToleranceMm,
        confidenceThreshold: threshold,
        defaultScaleMmPerPx: current.defaultScaleMmPerPx,
        ...(typeof current.notes === 'string' && current.notes !== '' ? { notes: current.notes } : {}),
      },
    },
  });
  expect(written.status(), `setup: PUT ${path}: ${(await written.text()).slice(0, 200)}`).toBe(200);
}

/** N16 body of a floor (`revision`, `level`, `layer`, ...). */
export async function readLayer(api: LayerApi, projectId: string, floorId: string): Promise<Json> {
  const res = await api.request.get(layerPathOf(projectId, floorId), { headers: api.headers });
  expect(res.status(), `GET ${layerPathOf(projectId, floorId)} (N16)`).toBe(200);
  return asRecord(await res.json(), 'N16');
}

/** A second writer: #35 with the floor's current revision and its own layer unchanged except `mutate` (409 for the page). */
export async function writeElsewhere(api: LayerApi, projectId: string, floorId: string): Promise<void> {
  const doc = await readLayer(api, projectId, floorId);
  const layer = asRecord(doc.layer, 'N16.layer');
  const openings = arrayOf(layer.openings, 'openings');
  const first = openings[0];
  if (first === undefined) throw new Error('writeElsewhere: no opening to touch');
  const changed = openings.map((opening, index) => (index === 0 ? { ...opening, widthMm: Number(opening.widthMm) + 10 } : opening));
  const put = await api.request.put(layerPathOf(projectId, floorId), {
    headers: api.headers,
    data: { baseVersion: doc.revision, body: { layer: { ...layer, openings: changed } } },
  });
  expect(put.status(), `setup: PUT (second writer): ${(await put.text()).slice(0, 200)}`).toBe(200);
}

/** Id of the first opening of `kind` in the floor's N16 layer. */
export async function openingIdOf(api: LayerApi, projectId: string, floorId: string, kind: 'door' | 'window'): Promise<string> {
  const layer = asRecord((await readLayer(api, projectId, floorId)).layer, 'N16.layer');
  const found = arrayOf(layer.openings, 'openings').find((opening) => opening.kind === kind);
  if (found === undefined) throw new Error(`setup: the floor has no ${kind}`);
  return String(found.id);
}

/** The display code ("#W-003") of the wall hosting the first opening of `kind`, as the screen numbers walls. */
export async function hostWallCode(api: LayerApi, projectId: string, floorId: string, kind: 'door' | 'window'): Promise<string> {
  const layer = asRecord((await readLayer(api, projectId, floorId)).layer, 'N16.layer');
  const wallIds = arrayOf(layer.walls, 'walls').map((wall) => String(wall.id));
  const host = arrayOf(layer.openings, 'openings').find((opening) => opening.kind === kind)?.wallId;
  const code = displayCodesOf(wallIds).get(String(host));
  if (code === undefined) throw new Error(`no host wall code for the ${kind}`);
  return `#${code}`;
}

/* ---------------------------------------------------------------- opening the screen */

export const layerRe = (projectId: string, floorId: string): RegExp =>
  new RegExp(`^/api/projects/${escapeRegExp(projectId)}/floors/${escapeRegExp(floorId)}/spatial/layer$`, 'u');
export const backgroundRe = (projectId: string, floorId: string): RegExp =>
  new RegExp(`^/api/projects/${escapeRegExp(projectId)}/floors/${escapeRegExp(floorId)}/spatial$`, 'u');

/** Fresh document load of the objects route; waits for the N16 read (200) and the screen region. */
export async function openObjects(page: Page, projectId: string, floorId: string): Promise<void> {
  await navigateThenWaitForApi(page, () => page.goto(ROUTES.project.objects(projectId, floorId), { waitUntil: 'commit' }), 'GET', layerRe(projectId, floorId), [200]);
  await expect(screen(page)).toBeVisible();
  // Rows are drawn once the store holds the graph (isLoading false): wait for the counter, never for time.
  await expect(statusBar(page)).toContainText('đối tượng đã duyệt');
}

/** PUT …/spatial/layer calls (any status) in `log` since `mark`. */
export const putCount = (log: readonly ApiEntry[], mark: number): number => log.slice(mark).filter((entry) => entry.method === 'PUT' && LAYER_PUT_RE.test(entry.path)).length;
/** GET …/spatial (background) and GET …/spatial/layer (N16) counts since `mark`. */
export const getCount = (log: readonly ApiEntry[], mark: number, re: RegExp): number => log.slice(mark).filter((entry) => entry.method === 'GET' && re.test(entry.path)).length;
/** Non-GET requests (minus session / telemetry chatter) in `log` since `mark`. */
export const writesSince = (log: readonly ApiEntry[], mark: number): string[] =>
  log
    .slice(mark)
    .filter((entry) => entry.method !== 'GET' && entry.path !== '/api/auth/refresh' && !entry.path.startsWith('/api/telemetry'))
    .map((entry) => `${entry.method} ${entry.path} ${String(entry.status)}`);

/** `body.layer` of a recorded PUT (`{ baseVersion, body: { layer } }`). */
export const putLayerOf = (record: PutRecord): Json => asRecord(asRecord(record.body.body, 'PUT.body').layer, 'PUT.body.layer');
/** `body.layer.<key>` of a recorded PUT as records. */
export const putList = (record: PutRecord, key: 'walls' | 'openings' | 'furniture' | 'rooms'): Json[] => arrayOf(putLayerOf(record)[key], key);

/** Next PUT record after `mark` (index into `session.puts`) whose layer passes `pred`. Polls the request log, no timers of its own. */
export async function nextPut(session: Session, mark: number, pred: (record: PutRecord) => boolean = () => true, timeout = 15_000): Promise<PutRecord> {
  let found: PutRecord | undefined;
  await expect
    .poll(
      () => {
        found = session.puts.slice(mark).find((record) => {
          try {
            return pred(record);
          } catch {
            return false;
          }
        });
        return found !== undefined;
      },
      { message: 'a PUT …/spatial/layer matching the step', timeout },
    )
    .toBe(true);
  return found as PutRecord;
}

/* ---------------------------------------------------------------- mock helpers (mocked flows only) */

export interface Deferred {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
}

export function deferred(): Deferred {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** Wire error envelope the FE reads with `readWireError` (BE `{ code, message, requestId }`), with optional extra fields. */
export const wireErrorBody = (code: string, extra: Json = {}): Json => ({ code, message: `qa mocked ${code}`, requestId: `qa-${code.toLowerCase()}`, ...extra });

export const fulfillJson = (route: Route, status: number, body: unknown): Promise<void> =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** What a mocked route answers: pass through, abort the connection, a JSON error, or hold until `hold` is released. */
export type Answer = 'pass' | 'abort' | { readonly status: number; readonly body: unknown } | { readonly hold: Deferred };

export interface RouteMock {
  /** Next answers apply from now on (the route stays installed). */
  set(answer: Answer): void;
  /** Requests of `method` the route has seen. */
  hits(): number;
}

/**
 * `page.route` over every `method` request of `re` (matched on the pathname), answered by the CURRENT {@link Answer}:
 * `hold` resolves its promise from the test (never a timer), then lets the request through.
 */
export async function mockRoute(page: Page, re: RegExp, method: string): Promise<RouteMock> {
  let answer: Answer = 'pass';
  let hits = 0;
  await page.route(
    (url) => re.test(url.pathname),
    async (route) => {
      if (route.request().method() !== method) {
        await route.fallback();
        return;
      }
      hits += 1;
      const current = answer;
      if (current === 'pass') await route.fallback();
      else if (current === 'abort') await route.abort('failed');
      else if ('hold' in current) {
        await current.hold.promise;
        await route.fallback();
      } else await fulfillJson(route, current.status, current.body);
    },
  );
  return {
    set: (next) => {
      answer = next;
    },
    hits: () => hits,
  };
}

/** `APIRequestContext` of a context (token-less): only for calls that carry their own headers. */
export const requestOf = (session: Session): APIRequestContext => session.api.request;

/** `spaGo`-style client-side route change is `support/p03/P11.spaGo`; re-exported for the specs. */
export { spaGo, markShell, shellKept } from '../p03/P11';
export { adminApi, poolApi };
