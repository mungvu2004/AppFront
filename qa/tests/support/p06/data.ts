/**
 * QA-06b P5 helpers for `phase06_data_{edge,mocked_edge,ui}.spec.ts` and `phase06_share_edge.spec.ts` (SCR-31 Spatial JSON
 * Viewer, ShareDialog absence). Owned by P5 only; the shared seeds stay in `../layerSeed.ts`, `../phase03Seed.ts` (re-used,
 * not edited).
 *
 * - Copy + selectors of SCR-31 ({@link SJ}, {@link GATE}) and of the screens it is compared with.
 * - {@link openAdmin} / {@link closeAdmin} / {@link withAdmin}, {@link openPoolFlow}: one browser context per flow.
 * - Projects: {@link bareProject} (no layer), {@link qcProject} (`createQcProject`), {@link createBigLayerProject}
 *   (160 walls: > 1 000 tree nodes and > 600 raw lines, a 70-character room name).
 * - The oracle {@link flattenOracle} re-implements `flattenJson` / `findMatches` / `describeCounts` (SJM:97-250) on the N15
 *   body the page read, so a test never trusts the screen's own model for what it checks.
 * - {@link mockData}: the `[mocked response]` seams of `phase06_data_mocked_edge` / `phase06_data_ui` (N15 held, a dangling
 *   opening id, a notes-only graph, N15 / #24 answering 500).
 */
// dup-of: (old) phase06_rules_export_versions_edge.spec.ts openAdmin/closeAdmin/withAdmin/bareProject/qcProject/readProject
import { existsSync } from 'node:fs';

import { expect, request, test } from '@playwright/test';
import type { APIRequestContext, Browser, BrowserContext, Locator, Page } from '@playwright/test';

import { ROUTES } from '../../../../e2e/fixtures/routes';
import { navigateThenWaitForApi, watchApi } from '../../../../e2e/fullstack/apiWatch';
import type { ApiEntry } from '../../../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../../../e2e/fullstack/env';
import { formatNumber } from '../../../../src/lib/format/number';
import { ensureAdminSession } from '../auth';
import { TEST_DATA_PREFIX } from '../evidence';
import { createQcProject, deleteProject, layerApiOf, writeLayer } from '../layerSeed';
import type { LayerApi } from '../layerSeed';
import { signInPoolUser } from '../phase03Seed';
import type { PoolUser } from '../phase03Seed';
import { ADMIN_STATE_FILE as ADMIN_STORAGE_STATE_FILE } from './adminState';
import type { UiMetrics } from '../ui-verify';

export type Json = Record<string, unknown>;

export const DESKTOP = { width: 1440, height: 900 } as const;
/** SJC:62 `NARROW_QUERY = '(width < 1024px)'`. */
export const NARROW = { width: 768, height: 1024 } as const;
export type Viewport = { readonly width: number; readonly height: number };

/** react-query retries a failed read once and the HTTP ladder waits 300 + 900 + 2 700 ms before the error paints (lib/http/retry.ts:5). */
export const ERROR_PAINT_TIMEOUT_MS = 30_000;
export const REFRESH_API = '/api/auth/refresh';
const PROJECTS_API = '/api/projects';
const FLOOR_HEIGHT_MM = 3_000;

/* ---------------------------------------------------------------- copy (each cites its source) */

/** SJ = src/screens/export/SpatialJsonViewer/ (SJV view, SJT tree, SJD detail, USJ hook, SJM model, SJC container). */
export const SJ = {
  title: 'Xem dữ liệu không gian', // SJV PageHead h1 (S-36 v6)
  tree: 'Cấu trúc dữ liệu không gian', // SJT:60
  search: 'Tìm theo khoá hoặc giá trị', // SJV:104
  previous: 'Kết quả trước', // SJV:122
  next: 'Kết quả sau', // SJV:128
  expandAll: 'Mở rộng tất cả', // SJV:138
  collapseAll: 'Thu gọn tất cả', // SJV:144
  noMatch: 'Không tìm thấy kết quả', // USJ:88 NO_MATCH_LABEL
  viewMode: 'Cách hiện cấu trúc', // SJV:149
  copy: 'Sao chép nhánh đang chọn', // SJV:157
  download: 'Tải xuống .json', // SJV:241 (F5: shown whenever the graph is loaded)
  tabs: 'Cách xem nội dung', // SJD:136
  structure: 'Cấu trúc dự án', // SJV:202
  content: 'Nội dung dữ liệu không gian', // SJD:135
  emptyTitle: 'Chưa có dữ liệu không gian', // SJV:48
  emptyDescription:
    'Bản vẽ này chưa được xử lý xong, nên chưa có tường, phòng hay đối tượng nào để xem. Xử lý bản vẽ của tầng rồi quay lại đây.', // SJV:49-50
  valid: 'Hợp lệ — 0 lỗi.', // SJM:286
  validity: /^(Hợp lệ — 0 lỗi\.|\d[\d.]* lỗi nghiêm trọng · \d[\d.]* cảnh báo\.)$/u, // SJM:268-270
  noSelection: 'Chọn một nút ở cây bên trái để xem chi tiết của nó.', // SJD:80
  entityCode: 'Mã đối tượng', // SJD:110
  elementCount: 'Số phần tử', // SJD:102
  value: 'Giá trị', // SJD:93
  entityNote:
    'Việc tô sáng đối tượng này trong mô hình ba chiều nằm ở trình xem 3D. Màn dữ liệu chỉ đọc, nên nó không dựng thêm một cảnh ba chiều nữa.', // SJD:118-123
  cut: (hidden: number): string =>
    `Còn ${formatNumber(hidden)} dòng nữa. Bấm Tải xuống .json để lấy toàn bộ.`, // SpatialJsonDetail.tsx RawJson + vi.json spatialJsonViewer.rawTruncated
  emptyCounts: '1 tầng · 0 tường · 0 ô mở · 0 phòng · 0 đồ đạc · 0 trục · 0 kích thước · 0 ghi chú', // SJM:238-250 for a floor without a layer
  room: 'PHONG NGU 2', // layerSeed.qcLayer room name
  refreshFailed: 'Không tải lại được mô hình.', // PSG:99
  retry: 'Thử lại', // PSG:100
} as const;

/** PSG = src/components/feedback/ProjectSpatialGate.tsx. */
export const GATE = {
  notFoundTitle: 'Không tìm thấy dự án này', // PSG:37
  notFoundDescription: 'Dự án có thể đã bị xoá, đường dẫn chưa đúng, hoặc bạn chưa được thêm vào dự án.', // PSG:38-39
  backToProjects: 'Về danh sách dự án', // PSG:40
} as const;

/** The 9 root keys of the graph, in the order `denormalizeSpatial` builds them (domain/spatial/normalize.ts:217-227). */
export const ROOT_KEYS = ['building', 'levels', 'walls', 'openings', 'furniture', 'rooms', 'axes', 'dimensions', 'notes'] as const;

/* ---------------------------------------------------------------- small helpers */

export const asRecord = (value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what}: not a JSON object`);
  return value as Json;
};

export const uniq = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

export const spatialRe = (projectId?: string): RegExp =>
  new RegExp(`^/api/projects/${projectId === undefined ? '[^/]+' : escapeRegExp(projectId)}/spatial$`, 'u');
export const projectRe = (projectId?: string): RegExp =>
  new RegExp(`^/api/projects/${projectId === undefined ? '[^/]+' : escapeRegExp(projectId)}$`, 'u');
export const ruleConfigRe = /^\/api\/projects\/[^/]+\/rule-config$/u;

/** Calls the page made since `mark` that are not session or telemetry chatter. */
export const callsSince = (log: readonly ApiEntry[], mark: number): ApiEntry[] =>
  log.slice(mark).filter((entry) => entry.path !== REFRESH_API && !entry.path.startsWith('/api/telemetry'));

/** Writes (non-GET) the page sent since `mark`, as `METHOD path status`. */
export const writesSince = (log: readonly ApiEntry[], mark: number): string[] =>
  callsSince(log, mark)
    .filter((entry) => entry.method !== 'GET')
    .map((entry) => `${entry.method} ${entry.path} ${String(entry.status)}`);

/** In-app navigation without a reload: history entry + popstate, which the router listens to (support/p03/P9.ts spaNavigate). */
export async function spaNavigate(page: Page, path: string): Promise<void> {
  await page.evaluate((to) => {
    window.history.pushState(null, '', to);
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
  }, path);
}

/* ---------------------------------------------------------------- admin / pool contexts + fixtures */

export interface FloorRef {
  readonly id: string;
  readonly name: string;
}

export interface ProjectRef {
  readonly id: string;
  readonly name: string;
  readonly floors: readonly FloorRef[];
}

export interface Admin {
  readonly context: BrowserContext;
  readonly page: Page;
  /** Every `/api/` response of the page, in order (bodies read as they arrive). */
  readonly api: ApiEntry[];
  /** Fixture calls with this context's own access token (never logged). */
  readonly fx: LayerApi;
  /** Project ids this test owns; deleted when the context closes. */
  readonly cleanup: string[];
}

/** One context from the stored admin session + a fixture token (2 refresh calls); sequential — the refresh cookie rotates. */
export async function openAdmin(browser: Browser, viewport: Viewport = DESKTOP): Promise<Admin> {
  const context = await browser.newContext({
    baseURL: readBaseUrl(),
    viewport,
    ...(existsSync(ADMIN_STORAGE_STATE_FILE) ? { storageState: ADMIN_STORAGE_STATE_FILE } : {}),
  });
  try {
    await ensureAdminSession(context, ADMIN_STORAGE_STATE_FILE);
    const fx = await layerApiOf(context);
    const page = await context.newPage();
    return { context, page, api: watchApi(page), fx, cleanup: [] };
  } catch (error) {
    await context.close();
    throw error;
  }
}

export async function closeAdmin(admin: Admin): Promise<void> {
  const failures: string[] = [];
  for (const id of admin.cleanup) {
    const failed = await deleteProject(admin.fx, id);
    if (failed !== null) failures.push(failed);
  }
  if (failures.length > 0) test.info().annotations.push({ type: 'cleanup', description: failures.join('; ') });
  await admin.context.storageState({ path: ADMIN_STORAGE_STATE_FILE }).catch(() => undefined);
  await admin.context.close().catch(() => undefined);
}

export async function withAdmin(browser: Browser, body: (admin: Admin) => Promise<void>, viewport: Viewport = DESKTOP): Promise<void> {
  const admin = await openAdmin(browser, viewport);
  try {
    await body(admin);
  } finally {
    await closeAdmin(admin);
  }
}

/** An authenticated `APIRequestContext` (Bearer of the admin's fixture token) for `poolUser` / `addProjectMember`. Dispose it. */
export function adminRequest(admin: Admin): Promise<APIRequestContext> {
  return request.newContext({ baseURL: readBaseUrl(), extraHTTPHeaders: admin.fx.headers });
}

export interface PoolFlow {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly api: ApiEntry[];
}

/** A fresh context signed in as a pool user (one `POST /api/auth/login`), its page and response log. Close `context`. */
export async function openPoolFlow(browser: Browser, user: PoolUser, viewport: Viewport = DESKTOP): Promise<PoolFlow> {
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport });
  try {
    await signInPoolUser(context, user);
    const page = await context.newPage();
    return { context, page, api: watchApi(page) };
  } catch (error) {
    await context.close();
    throw error;
  }
}

/** Name and floors of a project as `GET /api/projects/:id` returns them. */
async function readProject(admin: Admin, id: string, names: readonly string[]): Promise<ProjectRef> {
  const read = await admin.fx.request.get(`${PROJECTS_API}/${id}`, { headers: admin.fx.headers });
  expect(read.status(), `setup: GET ${PROJECTS_API}/${id}`).toBe(200);
  const body = asRecord(await read.json(), 'GET /api/projects/:id');
  const rows = Array.isArray(body.floors) ? body.floors.map((row) => asRecord(row, 'floor')) : [];
  const floors = names.map((name) => {
    const row = rows.find((item) => item.name === name);
    if (row === undefined || typeof row.id !== 'string') throw new Error(`setup: floor "${name}" not found`);
    return { id: row.id, name };
  });
  if (typeof body.name !== 'string') throw new Error('setup: project without a name');
  return { id, name: body.name, floors };
}

/** S-DATA-BARE: a project with empty floors (no layer) through the real API (BE:apps/api/projects/router.py:54-63). */
export async function bareProject(admin: Admin, slug: string, floorNames: readonly string[] = ['Tầng 1']): Promise<ProjectRef> {
  const name = `${TEST_DATA_PREFIX}${slug}-${uniq()}`;
  expect(name.length, `fixture name "${name}" fits NAME_MAX 80`).toBeLessThanOrEqual(80);
  const created = await admin.fx.request.post(PROJECTS_API, {
    headers: admin.fx.headers,
    data: {
      name,
      floors: floorNames.map((floor, order) => ({ name: floor, order, elevationMm: order * FLOOR_HEIGHT_MM, heightMm: FLOOR_HEIGHT_MM })),
    },
  });
  expect(created.status(), `setup: POST ${PROJECTS_API} "${name}"`).toBe(201);
  const id = asRecord(await created.json(), 'POST /api/projects').id;
  if (typeof id !== 'string') throw new Error('setup: POST /api/projects without id');
  admin.cleanup.push(id);
  return readProject(admin, id, floorNames);
}

/** S-DATA-QC / S-SHARE: `createQcProject` — one floor "Tầng 1" with the QC layer (8 walls, 2 partitions, rooms "Bếp" + "PHONG NGU 2"). */
export async function qcProject(admin: Admin, slug: string): Promise<ProjectRef> {
  const [floor] = await createQcProject(admin.fx, slug);
  if (floor === undefined) throw new Error('setup: createQcProject returned no floor');
  admin.cleanup.push(floor.projectId);
  return readProject(admin, floor.projectId, [floor.floorName]);
}

/* ---------------------------------------------------------------- S-DATA-BIG */

/** Walls in the big layer: ~20 tree nodes each, so far more than 1 000 nodes and 600 raw lines. */
export const BIG_WALLS = 160;
/** 70 characters, so the tree cuts it at 64 and appends "…" (SJM:35,57-61). */
export const LONG_ROOM_NAME = Array.from({ length: 70 }, (_, i) => String.fromCharCode(65 + (i % 26))).join('');

const sid = (letter: 'W' | 'R'): string => `${letter}-${Math.random().toString(36).slice(2).toUpperCase().padEnd(10, 'X')}${Date.now().toString(36).toUpperCase()}`;
const ai = (confidence = 0.9): Json => ({ confidence, reviewed: false, source: 'ai' });

/** The big layer (wire shape src/api/schemas/spatial.ts; same field set as `layerSeed.qcLayer`). */
export function bigLayer(levelId: string): Json {
  const walls: Json[] = Array.from({ length: BIG_WALLS }, (_, i) => ({
    ...ai(),
    centreline: { start: { x: 0, y: i * 300 }, end: { x: 4000 + i * 10, y: i * 300 } },
    heightMm: FLOOR_HEIGHT_MM,
    id: sid('W'),
    kind: i % 5 === 0 ? 'partition' : 'loadBearing',
    levelId,
    openingIds: [],
    thicknessMm: 220, // mm are integers on the wire (FE spatial.ts:131 .int(), BE Mm = SafeInt)
  }));
  const room = (name: string, y0: number, y1: number): Json => ({
    ...ai(),
    areaM2: 16,
    id: sid('R'),
    levelId,
    name,
    outline: [
      { x: 0, y: y0 },
      { x: 8000, y: y0 },
      { x: 8000, y: y1 },
      { x: 0, y: y1 },
    ],
    usage: 'bedroom',
    wallIds: [],
  });
  // S5-confirm: the BE accepts a 70-character room name (no max length found in spatial_write/).
  return { walls, openings: [], rooms: [room(LONG_ROOM_NAME, 0, 2000), room('Bếp', 2000, 4000)], furniture: [] };
}

/** S-DATA-BIG: a bare project, then #35 writes {@link bigLayer} on its only floor. */
export async function createBigLayerProject(admin: Admin, slug: string): Promise<ProjectRef> {
  const project = await bareProject(admin, slug);
  const floor = project.floors[0];
  if (floor === undefined) throw new Error('setup: the big project has no floor');
  await writeLayer(admin.fx, project.id, floor.id, bigLayer);
  return project;
}

/* ---------------------------------------------------------------- opening the screen */

/** What `openData` waits for after N15 answered 200. */
export type DataReady = 'tree' | 'empty';

/** `/projects/:id/data` with a fresh document: waits for N15 200, the search box, then the tree (or the empty copy). */
export async function openData(page: Page, projectId: string, ready: DataReady = 'tree'): Promise<void> {
  await navigateThenWaitForApi(page, () => page.goto(ROUTES.project.data(projectId), { waitUntil: 'commit' }), 'GET', spatialRe(projectId), [200]);
  await expect(page.getByRole('textbox', { name: SJ.search, exact: true })).toBeVisible();
  if (ready === 'tree') await expect(treeOf(page).getByRole('treeitem').first()).toBeVisible();
  else await expect(page.getByText(SJ.emptyTitle, { exact: true })).toBeVisible();
}

/* ---------------------------------------------------------------- locators of SCR-31 */

export const treeOf = (page: Page): Locator => page.getByRole('tree', { name: SJ.tree, exact: true });
export const rowsOf = (page: Page): Locator => treeOf(page).getByRole('treeitem');
/** A root row (aria-level 1) by its key (SJM:149-158; SJT:68). */
export const rootRow = (page: Page, key: string): Locator =>
  treeOf(page)
    .locator('[role="treeitem"][aria-level="1"]')
    .filter({ has: page.locator('code', { hasText: new RegExp(`^${escapeRegExp(key)}$`, 'u') }) });
/** The row right after `row` in the flat list (a node's first child once it is open). */
export const nextRow = (row: Locator): Locator => row.locator('xpath=following-sibling::*[@role="treeitem"][1]');
export const searchBox = (page: Page): Locator => page.getByRole('textbox', { name: SJ.search, exact: true });
/** The "<i> / <n>" counter, or the no-match sentence (SJV:124-128, USJ:182-186). */
export const matchLabel = (page: Page): Locator => page.getByText(/^\d[\d.]* \/ [\d.]+$/u).or(page.getByText(SJ.noMatch, { exact: true }));
export const detailOf = (page: Page): Locator => page.getByRole('region', { name: SJ.content, exact: true });
export const tabsOf = (page: Page): Locator => page.getByRole('tablist', { name: SJ.tabs, exact: true });
export const tabOf = (page: Page, name: 'JSON' | 'Xem trước'): Locator => tabsOf(page).getByRole('tab', { name, exact: true });
export const modeOf = (page: Page, name: 'Cây' | 'Thô'): Locator =>
  page.getByRole('radiogroup', { name: SJ.viewMode, exact: true }).getByRole('radio', { name, exact: true });
export const toolbarButton = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });
/** The `<dd>` next to the `<dt>` `term` of the preview (SJD:91-115). */
export const previewValue = (page: Page, term: string): Locator =>
  detailOf(page).locator('dt', { hasText: new RegExp(`^${escapeRegExp(term)}$`, 'u') }).locator('xpath=following-sibling::dd');
export const previewTerm = (page: Page, term: string): Locator => detailOf(page).locator('dt', { hasText: new RegExp(`^${escapeRegExp(term)}$`, 'u') });
/** The validity sentence under the toolbar (SJV:175-179). */
export const validityLine = (page: Page): Locator => page.getByText(/^(Hợp lệ|\d[\d.]* lỗi nghiêm trọng)/u);
/** The cut-off advice under a long raw JSON (SJD:66-70). */
export const cutMessage = (page: Page): Locator => page.getByText(/^Còn [\d.]+ dòng nữa\./u);

/** Opens `key` (ArrowRight on its row) and returns the row of its first child. */
export async function openFirstChild(page: Page, key: string): Promise<Locator> {
  const row = rootRow(page, key);
  if ((await row.getAttribute('aria-expanded')) !== 'true') {
    await row.focus();
    await page.keyboard.press('ArrowRight'); // SJT:91-95
  }
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  const child = nextRow(row);
  await expect(child).toHaveAttribute('aria-level', '2');
  return child;
}

/* ---------------------------------------------------------------- oracle (SJM) on the N15 body */

/** One tree row as `walk` (SJM:84-142) would build it, before folding. */
export interface OracleNode {
  readonly id: string;
  readonly label: string;
  readonly depth: number;
  readonly valueText: string | null;
  readonly childCount: number | null;
  readonly entityId: string | null;
  readonly expandable: boolean;
}

/** SJM:48-73 `describeScalar`: a string is quoted and cut at 64 characters + "…"; integers print whole, others with 2 decimals (vi). */
export function scalarText(value: unknown): string {
  if (typeof value === 'string') return `"${value.length > 64 ? `${value.slice(0, 64)}…` : value}"`;
  if (typeof value === 'number') return formatNumber(value, { fractionDigits: Number.isInteger(value) ? 0 : 2 });
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return 'null';
}

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The rows of `flattenJson(graph)` (SJM:129-142): one per node, containers first, children in key / index order. */
export function flattenOracle(graph: Json): OracleNode[] {
  const out: OracleNode[] = [];
  const walk = (value: unknown, path: string, label: string, depth: number): void => {
    if (Array.isArray(value)) {
      out.push({ id: path, label, depth, valueText: null, childCount: value.length, entityId: null, expandable: value.length > 0 });
      value.forEach((item, index) => {
        walk(item, `${path}[${String(index)}]`, String(index), depth + 1);
      });
    } else if (isObject(value)) {
      const keys = Object.keys(value);
      out.push({
        id: path,
        label,
        depth,
        valueText: null,
        childCount: keys.length,
        entityId: typeof value.id === 'string' ? value.id : null,
        expandable: keys.length > 0,
      });
      for (const key of keys) walk(value[key], path.length === 0 ? key : `${path}.${key}`, key, depth + 1);
    } else {
      out.push({ id: path, label, depth, valueText: scalarText(value), childCount: null, entityId: null, expandable: false });
    }
  };
  for (const key of Object.keys(graph)) walk(graph[key], key, key, 0);
  return out;
}

/** SJM:182-194 `findMatches`: rows whose label or value text, lower-cased, contains the lower-cased trimmed term. */
export function matchesOf(nodes: readonly OracleNode[], term: string): OracleNode[] {
  const needle = term.trim().toLowerCase();
  if (needle === '') return [];
  return nodes.filter((node) => node.label.toLowerCase().includes(needle) || (node.valueText ?? '').toLowerCase().includes(needle));
}

/** SJM:238-250 `describeCounts` over the array lengths of the N15 graph. */
export function countsLabelOf(graph: Json): string {
  const length = (key: string): number => {
    const value = graph[key];
    return Array.isArray(value) ? value.length : 0;
  };
  return [
    `${formatNumber(length('levels'))} tầng`,
    `${formatNumber(length('walls'))} tường`,
    `${formatNumber(length('openings'))} ô mở`,
    `${formatNumber(length('rooms'))} phòng`,
    `${formatNumber(length('furniture'))} đồ đạc`,
    `${formatNumber(length('axes'))} trục`,
    `${formatNumber(length('dimensions'))} kích thước`,
    `${formatNumber(length('notes'))} ghi chú`,
  ].join(' · ');
}

/** SJM:253-255 `toRawText`: the pretty text the JSON tab and the footer size are built from. */
export const rawTextOf = (graph: Json): string => JSON.stringify(graph, null, 2);

const findN15 = (api: readonly ApiEntry[], mark: number): ApiEntry | undefined =>
  api.slice(mark).find((entry) => entry.method === 'GET' && spatialRe().test(entry.path) && entry.status === 200 && entry.json !== undefined);

/**
 * `graph` of the first N15 200 the page received since `mark` (`{ floorRevisions, graph }`, api/schemas/spatialGraph.ts:122-130).
 * S5-confirm: the decoded graph the screen shows has the same fields as the wire graph (sizes / line counts / matches below follow it).
 */
export async function n15Graph(api: readonly ApiEntry[], mark = 0): Promise<Json> {
  await expect.poll(() => findN15(api, mark)?.json !== undefined, { message: 'N15 200 body was read' }).toBe(true);
  return asRecord(asRecord(findN15(api, mark)?.json, 'N15').graph, 'N15.graph');
}

/** The first `GET /api/projects/:id` (#24) 200 body the page received. */
export async function projectBody(api: readonly ApiEntry[], projectId: string): Promise<Json> {
  const find = (): ApiEntry | undefined =>
    api.find((entry) => entry.method === 'GET' && projectRe(projectId).test(entry.path) && entry.status === 200 && entry.json !== undefined);
  await expect.poll(() => find() !== undefined, { message: '#24 200 body was read' }).toBe(true);
  return asRecord(find()?.json, '#24');
}

/* ---------------------------------------------------------------- [mocked response] seams */

export type N15Mode = 'pass' | 'dangling' | 'notes' | 'fail500';

export interface DataMock {
  /** Answers every later N15 read in this `mode` (a held read takes the mode current when it is released). */
  setN15(mode: N15Mode, danglingCount?: number): void;
  /** Makes `GET /api/projects/:id` (#24) answer 500 (`true`) or pass through (`false`). */
  setProject500(on: boolean): void;
  /** The next N15 reads wait until {@link DataMock.release}. */
  hold(): void;
  release(): void;
  /** N15 reads that reached the route. */
  n15Calls(): number;
}

const ERROR_BODY = (requestId: string): string => JSON.stringify({ code: 'INTERNAL', requestId });

/** `graph` with `count` walls each listing an opening id that does not exist (SJM:268-270 integrity strip; integrity.ts:138). */
export function withDanglingOpenings(body: Json, count: number): Json {
  const graph = asRecord(body.graph, 'N15.graph');
  const walls = Array.isArray(graph.walls) ? graph.walls.map((wall) => asRecord(wall, 'wall')) : [];
  if (walls.length < count) throw new Error(`mock: ${String(count)} walls needed, ${String(walls.length)} found`);
  const edited = walls.map((wall, index) =>
    index < count ? { ...wall, openingIds: [...(Array.isArray(wall.openingIds) ? wall.openingIds : []), `D-QADANGLING${String(index).padStart(8, '0')}`] } : wall,
  );
  return { ...body, graph: { ...graph, walls: edited } };
}

/** A graph whose only content is one note (levels stay: `floorRevisions` must match them one-to-one). */
export function notesOnly(body: Json): Json {
  const graph = asRecord(body.graph, 'N15.graph');
  const level = Array.isArray(graph.levels) ? asRecord(graph.levels[0], 'level') : undefined;
  if (level === undefined || typeof level.id !== 'string') throw new Error('mock: the graph has no level');
  // S5-confirm: this note passes NoteSchema (api/schemas/spatial.ts:487-497) — human source, reviewed, ISO instant, any entity id.
  const note = {
    authorId: 'U-QAMOCKNOTE',
    body: 'qa note',
    confidence: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    entityId: level.id,
    id: 'N-QAMOCKNOTE0000',
    reviewed: true,
    source: 'human',
  };
  return { ...body, graph: { ...graph, walls: [], openings: [], rooms: [], furniture: [], axes: [], dimensions: [], notes: [note] } };
}

/** Installs the N15 / #24 route mocks on `page` (real responses are fetched and edited, so ids and revisions stay real). */
export async function mockData(page: Page): Promise<DataMock> {
  let mode: N15Mode = 'pass';
  let dangling = 1;
  let project500 = false;
  let gate: Promise<void> | null = null;
  /** Every gate not yet released (a held read per viewport in the 4-width cases). */
  const releases: Array<() => void> = [];
  let calls = 0;

  await page.route(
    (url) => spatialRe().test(url.pathname),
    async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      calls += 1;
      const wait = gate;
      if (wait !== null) await wait;
      try {
        if (mode === 'pass') {
          await route.fallback();
        } else if (mode === 'fail500') {
          await route.fulfill({ status: 500, contentType: 'application/json', body: ERROR_BODY('qa-n15') });
        } else {
          const real = await route.fetch();
          const body = asRecord(await real.json(), 'N15');
          await route.fulfill({ response: real, json: mode === 'dangling' ? withDanglingOpenings(body, dangling) : notesOnly(body) });
        }
      } catch (error) {
        // The page navigated away while the read was held: nobody is left to answer.
        if (!page.isClosed() && !/has been closed|disposed|aborted|already handled|navigat|interrupted|ERR_FAILED/iu.test(String(error))) throw error;
      }
    },
  );
  await page.route(
    (url) => projectRe().test(url.pathname),
    async (route) => {
      if (route.request().method() === 'GET' && project500) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: ERROR_BODY('qa-24') });
      } else {
        await route.fallback();
      }
    },
  );

  return {
    setN15(next, count = 1) {
      mode = next;
      dangling = count;
    },
    setProject500(on) {
      project500 = on;
    },
    hold() {
      gate = new Promise<void>((resolve) => {
        releases.push(resolve);
      });
    },
    release() {
      for (const open of releases.splice(0)) open();
      gate = null;
    },
    n15Calls: () => calls,
  };
}

/* ---------------------------------------------------------------- layout metrics (verifyUi data) */

/** The heuristics `verifyUi` only records: clipped text, overlapping and small controls are findings for the 4 widths. */
export function expectLayoutClean(all: readonly UiMetrics[]): void {
  for (const m of all) {
    expect.soft(m.clipped, `${m.viewport}: clipped text`).toEqual([]);
    expect.soft(m.overlaps, `${m.viewport}: overlapping controls`).toEqual([]);
    expect.soft(m.smallTargets, `${m.viewport}: targets below the minimum`).toEqual([]);
  }
}
