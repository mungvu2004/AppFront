/**
 * QA-06b P4 helpers for `phase06_export_{edge,mocked_edge,ui}.spec.ts` (SCR-30 Bảng xuất). Owned by P4 only; the shared
 * seeds (`layerSeed.ts`, `phase03Seed.ts`) are re-used, never edited.
 *
 * - {@link openExportFlow}: one browser context signed in as the admin (one `POST /api/auth/login`, own cookie jar), its
 *   page, a response log (`watchApi`), a request log ({@link requestsSince}), a download log, plus the fixture token
 *   (`layerApiOf`) every seed below uses. {@link openPoolFlow}: the same for a pool user (viewer / engineer).
 * - Seeds (all run-unique `qa-<runId>-…` projects through the real API, deleted by {@link closeExportFlow}):
 *   {@link seedQc} (X1 / X2 / XF), {@link seedExportProject} (X4), {@link seedNamed} (XN), {@link seedLongName} (X2L),
 *   {@link seedNoLayer} (P1), {@link seedEmptyProject} + {@link addFloor} (M0).
 * - Screen helpers shared by the three files: {@link EP} copy, {@link openExport}, {@link selectFormat}, {@link expandOptions},
 *   {@link setBox}, {@link downloadVia}, {@link readGlb}, {@link findingsTotal}.
 * - Browser-boundary stubs, only for `_mocked_edge` / the mocked ui flow: {@link stubGlbWorker} (+ {@link setGlbWorkerMode},
 *   {@link emitFromWorker}, {@link workerStarts}) and {@link holdRoute} (a held / failing GET).
 */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Download, type Locator, type Page, type Route } from '@playwright/test';

import { ROUTES } from '../../../../e2e/fixtures/routes';
import { TOUR_APPEAR_TIMEOUT_MS, dismissTour } from '../../../../e2e/fixtures/tour';
import { navigateThenWaitForApi, watchApi, type ApiEntry, type ApiResult } from '../../../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../../../e2e/fullstack/env';
import { signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import { TEST_DATA_PREFIX, captureEvidence } from '../evidence';
import { createQcProject, deleteProject, layerApiOf, layerPathOf, qcLayer, writeLayer, type LayerApi } from '../layerSeed';
import { signInPoolUser, type PoolUser } from '../phase03Seed';

type Json = Record<string, unknown>;

export const DESKTOP = { width: 1440, height: 900 } as const;
const PROJECTS = '/api/projects';
const FLOOR_HEIGHT_MM = 3_000;
/** react-query retries a failed read once and the HTTP ladder retries 5xx (cachePolicy.ts:79-82): the error state paints late. */
export const ERROR_PAINT_TIMEOUT_MS = 45_000;

export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
export const uniq = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const pathOf = (page: Page): string => new URL(page.url()).pathname;

export const asRecord = (value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what}: not a JSON object`);
  return value as Json;
};

/* ---------------------------------------------------------------- copy (each cites its source) */

/** `src/screens/export/ExportPanel/` — EPV ExportPanel.tsx, EPF …Formats, EPO …Options, EPP …Preflight, EPT …Footer, UEP useExportPanel.ts, EPG …Gateway. */
export const EP = {
  title: 'Xuất mô hình', // EPV:248
  formats: 'Định dạng xuất', // EPF:144
  /** ExportPanelFormats: PDF và ảnh chưa xuất được là dòng chữ trong danh sách này, không phải thẻ chọn. */
  blockedList: 'Định dạng chưa xuất được',
  options: 'Tuỳ chọn', // EPO:232
  scope: 'Phạm vi', // EPO:69
  preflight: 'Kiểm tra trước khi xuất', // EPP:26
  history: 'Tệp đã xuất', // EPV:123
  historyCaption: 'Chỉ trong phiên này, mất khi làm mới trang.', // ExportPanel.tsx (đầu khung Tệp đã xuất)
  historyHeads: ['Tệp', 'Thời điểm', 'Dung lượng'], // EPV:140-146
  redownload: 'Tải lại', // EPV:163
  exportButton: /^Xuất (\.glb|\.json|PDF|ảnh)$/u, // ExportPanelFooter: "Xuất <định dạng>"
  cancel: 'Huỷ', // EPT:39-41
  share: 'Chia sẻ', // EPV:251
  confidence: 'Gồm độ tin cậy từng đối tượng', // EPO:190
  furniture: 'Gồm đồ nội thất', // EPO:79
  detailGroup: 'Mức độ chi tiết mô hình', // EPO:111
  detail: { high: 'Cao', medium: 'Vừa', low: 'Gọn' }, // EPO:42-46
  destination: 'Tệp tải về thư mục tải xuống của trình duyệt.', // UEP:172
  noFloor: 'Chưa chọn tầng nào để xuất.', // EPG:312
  allReviewed: 'Mọi đối tượng trên các tầng đã chọn đều đã duyệt.', // EPG:336
  noViolations: 'Không còn vi phạm nào.', // EPG:325
  unapproved: (names: string, count = 1): string => `Còn ${String(count)} tầng chưa duyệt: ${names}.`, // EPG:315-317
  allApproved: (count: number): string => `Cả ${String(count)} tầng đã chọn đều đã duyệt.`, // EPG:314
  unreviewed: /Còn (\d[\d.]*) đối tượng chưa duyệt\./u, // EPG:337
  violations: /Còn (\d[\d.]*) phát hiện từ kiểm tra luật chưa xử lý\./u, // EPG:325-327
  approvedBadge: 'Đã duyệt', // EPO:83
  notApprovedBadge: 'Chưa duyệt', // EPO:83
  notApprovedCaption: 'Tầng chưa duyệt vẫn xuất được, nhưng cần chú ý trước khi gửi đi.', // EPO:88
  /** EPP:62 visible "Sửa" + sr-only ": <row label>" (BUG-442): the accessible name is "Sửa: Còn …". */
  fix: /^Sửa/u,
  pdfBlocked: 'Chưa tải về được: dự án chưa có bộ dựng tệp PDF, mới đếm được số trang.', // EPF:34-35
  imageBlocked: 'Chưa tải về được: ảnh cần một khung nhìn ba chiều đang mở, màn này chưa gắn với khung nhìn nào.', // EPF:38-39
  pdfNotice: 'Hồ sơ PDF mới đếm được số trang: dự án chưa có bộ dựng tệp PDF nên chưa tải về được.', // UEP:175-176
  imageNotice: 'Ảnh cần một khung nhìn 3D đang mở; màn này chưa được gắn với khung nhìn nào nên chưa chụp được.', // UEP:179-180
  pdfOptions: ['Gồm mặt bằng các tầng', 'Gồm bảng danh sách phòng', 'Gồm danh sách vi phạm', 'Gồm ảnh dựng 3D'], // EPO:144-165
  imageView: 'Góc nhìn hiện tại:', // EPO:179
  imageWidth: 'Chiều rộng xuất:', // EPO:182
  audience: {
    glb: 'Mô hình ba chiều cho người dựng hình và người xem bằng phần mềm 3D.', // UEP:134
    pdf: 'Hồ sơ in cho người duyệt hồ sơ và người mang bản vẽ ra công trường.', // UEP:135
    png: 'Ảnh mặt bằng cho người làm bản trình bày và người gửi kèm thư.', // UEP:136
    json: 'Dữ liệu thô cho người viết công cụ và người nối sang hệ khác.', // UEP:137
  },
  forbiddenTitle: 'Không có quyền xuất bản vẽ', // EPV:211
  forbiddenCaption: 'Chỉ quản trị viên và kỹ sư của dự án xuất được mô hình; bạn đang xem ở quyền chỉ đọc.', // EPG:260-261
  emptyTitle: 'Chưa có gì để xuất', // EP:235
  emptyCaption: 'Dự án chưa có tầng nào. Tải bản vẽ lên hoặc thêm một tầng rồi quay lại đây để xuất.', // EP:236-238
  notFoundTitle: 'Không tìm thấy dự án này', // PSG:34
  backToProjects: 'Về danh sách dự án', // PSG:40
  loginHint: 'Hãy đăng nhập để tiếp tục.', // phase01 login redirect copy (catalog 30-D-006)
  progress: { build: 'Đang dựng hình', encode: 'Đang mã hoá' }, // UEP:143-146
  errorHint: 'Thử hạ mức chi tiết xuống mức gọn hơn rồi xuất lại.', // UEP:183
  errorRetry: 'Thử lại', // ExportPanel.tsx (A6: viết hoa chữ đầu)
  aiSentenceStart: 'Xử lý AI thất bại', // vi.json errors.processing.description (30-B-026)
  gateRetry: 'Thử lại', // PSG:84
  /** GLB:133-138 `YYYY-MM-DD_HH-mm-ss`. */
  stamp: '\\d{4}-\\d{2}-\\d{2}_\\d{2}-\\d{2}-\\d{2}',
} as const;

/* ---------------------------------------------------------------- file-name and size mirrors of the app */

/** GLB:112-130 `toFileSlug`: diacritics stripped (đ by hand), ASCII, lower case, hyphens; `untitled` when nothing is left. */
export function fileSlug(text: string): string {
  const slug = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .replace(/đ/gu, 'd')
    .replace(/Đ/gu, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  return slug === '' ? 'untitled' : slug;
}

/** Regex of an export name `<slug>[_T<a>[-T<b>]]_<stamp>.<ext>` (GLB:140-161, EPG:883-885). */
export const exportNameRe = (slug: string, ext: 'glb' | 'json', floors = ''): RegExp =>
  new RegExp(`^${escapeRegExp(slug)}_${floors === '' ? '' : `${escapeRegExp(floors)}_`}${EP.stamp}\\.${ext}$`, 'u');

/** `lib/format/bytes.ts:83-98` `formatFileSize`: whole bytes under 1 KB, else one vi decimal ("1,5 KB"); spaces normalised for the compare. */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let step = 0;
  while (bytes >= 1024 ** (step + 1) && step + 1 < units.length) step += 1;
  const scaled = bytes / 1024 ** step;
  const digits = step === 0 ? 0 : 1;
  const text = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(scaled);
  return `${text} ${units[step]}`.replace(/\s/gu, ' ');
}
export const normSpace = (text: string): string => text.replace(/\s/gu, ' ').trim();

/* ---------------------------------------------------------------- flows (browser sessions) */

export interface SentRequest {
  readonly method: string;
  readonly path: string;
}

export interface ExportFlow {
  readonly context: BrowserContext;
  readonly page: Page;
  /** Every `/api/` response of the page, in order. */
  readonly api: ApiEntry[];
  /** Every `/api/` request of the page, in order. */
  readonly sent: SentRequest[];
  /** File names of the downloads the page started, in order. */
  readonly downloads: string[];
  /** The same downloads as objects (`saveAs`), in order. */
  readonly files: Download[];
  /** Fixture calls with this context's own access token (never logged). */
  readonly fx: LayerApi;
  /** Project ids this flow owns; deleted by {@link closeExportFlow}. */
  readonly cleanup: string[];
}

function attachLogs(page: Page): { sent: SentRequest[]; downloads: string[]; files: Download[] } {
  const sent: SentRequest[] = [];
  const downloads: string[] = [];
  const files: Download[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) sent.push({ method: request.method(), path: url.pathname });
  });
  page.on('download', (download) => {
    downloads.push(download.suggestedFilename());
    files.push(download);
  });
  return { sent, downloads, files };
}

/**
 * Admin browser session in a fresh context (1 `POST /api/auth/login`, not the stored session: files run in parallel and
 * every refresh of one shared cookie rotates it under the others), then one `POST /api/auth/refresh` for the fixture token
 * (`layerApiOf`, called before the first page loads).
 */
export async function openExportFlow(
  browser: Browser,
  options: { readonly viewport?: { width: number; height: number }; readonly reducedMotion?: boolean } = {},
): Promise<ExportFlow> {
  const { email, password } = readAdminCredentials();
  const context = await browser.newContext({
    baseURL: readBaseUrl(),
    viewport: options.viewport ?? DESKTOP,
    ...(options.reducedMotion === true ? { reducedMotion: 'reduce' as const } : {}),
  });
  try {
    const res = await context.request.post('/api/auth/login', {
      data: { email, password, rememberMe: false },
      headers: { Origin: readBaseUrl() },
    });
    expect(res.status(), 'setup: POST /api/auth/login as admin').toBe(204);
    const fx = await layerApiOf(context);
    const page = await context.newPage();
    const logs = attachLogs(page);
    return { context, page, api: watchApi(page), sent: logs.sent, downloads: logs.downloads, files: logs.files, fx, cleanup: [] };
  } catch (error) {
    await context.close();
    throw error;
  }
}

/** Deletes the flow's projects (failures become an annotation, never a throw), then closes the context. */
export async function closeExportFlow(flow: ExportFlow | undefined): Promise<void> {
  if (flow === undefined) return;
  const failures: string[] = [];
  for (const id of flow.cleanup) {
    const failed = await deleteProject(flow.fx, id);
    if (failed !== null) failures.push(failed);
  }
  if (failures.length > 0) test.info().annotations.push({ type: 'cleanup', description: failures.join('; ') });
  await flow.context.close().catch(() => undefined);
}

export interface PoolFlow {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly api: ApiEntry[];
  readonly sent: SentRequest[];
  readonly downloads: string[];
  readonly files: Download[];
}

/** Browser session of a pool user (viewer / engineer): one `POST /api/auth/login` through the context's own cookie jar. */
export async function openPoolFlow(browser: Browser, user: PoolUser, viewport: { width: number; height: number } = DESKTOP): Promise<PoolFlow> {
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport });
  try {
    await signInPoolUser(context, user);
    const page = await context.newPage();
    const logs = attachLogs(page);
    return { context, page, api: watchApi(page), sent: logs.sent, downloads: logs.downloads, files: logs.files };
  } catch (error) {
    await context.close();
    throw error;
  }
}

/** One real admin API login for `poolUser` / `addProjectMember` / role changes (they take an `APIRequestContext`); caller disposes. */
export function adminApi(): Promise<APIRequestContext> {
  const { email, password } = readAdminCredentials();
  return signedInApi(email, password);
}

/** Requests (any method, minus session refresh and telemetry chatter) the page sent since `mark` (an index into `sent`). */
export const requestsSince = (sent: readonly SentRequest[], mark: number): string[] =>
  sent
    .slice(mark)
    .filter((r) => r.path !== '/api/auth/refresh' && !r.path.startsWith('/api/telemetry'))
    .map((r) => `${r.method} ${r.path}`);

/* ---------------------------------------------------------------- seeds */

export interface FloorRef {
  readonly id: string;
  readonly name: string;
}

export interface ExportProject {
  readonly id: string;
  readonly name: string;
  readonly floors: readonly FloorRef[];
}

export const floorOf = (project: ExportProject, index: number): FloorRef => {
  const floor = project.floors[index];
  if (floor === undefined) throw new Error(`fixture project has no floor #${String(index)}`);
  return floor;
};

/** Name and floors of a project as `GET /api/projects/:id` returns them (floors sorted by `order`). */
export async function readProject(fx: LayerApi, id: string): Promise<ExportProject> {
  const read = await fx.request.get(`${PROJECTS}/${id}`, { headers: fx.headers });
  expect(read.status(), `setup: GET ${PROJECTS}/${id}`).toBe(200);
  const body = asRecord(await read.json(), 'GET /api/projects/:id');
  const rows = Array.isArray(body.floors) ? body.floors.map((row) => asRecord(row, 'floor')) : [];
  if (typeof body.name !== 'string') throw new Error('setup: project without a name');
  return {
    id,
    name: body.name,
    floors: rows
      .sort((a, b) => Number(a.order) - Number(b.order))
      .map((row) => ({ id: String(row.id), name: String(row.name) })),
  };
}

/** X1 / X2 / XF: `createQcProject` (floors with the QC layer: walls, a door, a window, rooms, one table per layered floor). */
export async function seedQc(flow: ExportFlow, slug: string, floorNames: readonly string[] = ['Tầng 1'], layered = 1): Promise<ExportProject> {
  const floors = await createQcProject(flow.fx, slug, floorNames, layered);
  const first = floors[0];
  if (first === undefined) throw new Error('setup: createQcProject returned no floor');
  flow.cleanup.push(first.projectId);
  return readProject(flow.fx, first.projectId);
}

/** Two layered floors "Tầng 1" and "Tầng 2" (X2; also XF: `qcLayer` already carries one table per layered floor). */
export const seedTwoFloors = (flow: ExportFlow, slug: string): Promise<ExportProject> => seedQc(flow, slug, ['Tầng 1', 'Tầng 2'], 2);

const sid = (letter: 'W' | 'F'): string => `${letter}-${randomUUID().replace(/-/gu, '').toUpperCase().slice(0, 20)}`;

/** Marks every item of `layer` as a human-reviewed one (A5 allows human + reviewed; no scale → the level turns "reviewed"). */
function reviewedLayer(levelId: string): Json {
  const layer = qcLayer(levelId);
  const human = (item: unknown): unknown => ({ ...asRecord(item, 'layer item'), source: 'human', reviewed: true });
  return Object.fromEntries(Object.entries(layer).map(([key, items]) => [key, Array.isArray(items) ? items.map(human) : items]));
}

/** "Approves" a floor the way phase 04's A04 write_approve_all_200 does: rewrite its layer with only human + reviewed items. */
export async function approveFloor(fx: LayerApi, projectId: string, floorId: string): Promise<void> {
  // S5-confirm: an all-human-reviewed layer makes N15 `levels[].reviewed` true (phase04_qc_layers_api A04 write_approve_all_200).
  await writeLayer(fx, projectId, floorId, reviewedLayer);
}

/** One wall 40 mm thick (< the 60 mm default of "Bề dày tường tối thiểu", rules/registry.ts WALL-THICKNESS) on top of the QC layer. */
export async function addViolation(fx: LayerApi, projectId: string, floorId: string): Promise<void> {
  await writeLayer(fx, projectId, floorId, (levelId) => {
    const layer = qcLayer(levelId);
    const walls = Array.isArray(layer.walls) ? layer.walls : [];
    const thin: Json = {
      confidence: 0.9,
      reviewed: false,
      source: 'ai',
      centreline: { start: { x: 1000, y: 1000 }, end: { x: 3000, y: 1000 } },
      heightMm: FLOOR_HEIGHT_MM,
      id: sid('W'),
      kind: 'partition',
      levelId,
      openingIds: [],
      thicknessMm: 40,
    };
    return { ...layer, walls: [...walls, thin] };
  });
}

/** X4: X2 + "Tầng 2" approved, "Tầng 1" not + one rule finding (the thin wall) on "Tầng 1". */
export async function seedExportProject(flow: ExportFlow, slug = 'export-x4'): Promise<ExportProject> {
  const project = await seedTwoFloors(flow, slug);
  await approveFloor(flow.fx, project.id, floorOf(project, 1).id);
  await addViolation(flow.fx, project.id, floorOf(project, 0).id);
  return project;
}

/** `PATCH /api/projects/:id {name}` (#26); returns the status so the caller can fall back. */
export async function renameProject(fx: LayerApi, projectId: string, name: string): Promise<number> {
  const res = await fx.request.patch(`${PROJECTS}/${projectId}`, { headers: fx.headers, data: { name } });
  return res.status();
}

/** XN: X1 renamed to `name` (an ASCII-unfriendly name; `createQcProject` itself always prefixes its own). */
export async function seedNamed(flow: ExportFlow, name: string): Promise<ExportProject> {
  const base = await seedQc(flow, 'export-name');
  expect(await renameProject(flow.fx, base.id, name), `setup: PATCH ${PROJECTS}/:id name "${name}"`).toBe(200);
  return readProject(flow.fx, base.id);
}

/** X2L: X2 renamed to an 80-char name (NAME_MAX): its file names are ~100 characters. */
export async function seedLongName(flow: ExportFlow): Promise<ExportProject> {
  const base = await seedTwoFloors(flow, 'export-long');
  const name = `${TEST_DATA_PREFIX}export-long-name-for-the-file-name-check-`.padEnd(80, 'abcdefghij').slice(0, 80);
  expect(await renameProject(flow.fx, base.id, name), 'setup: PATCH project (80-char name)').toBe(200);
  return readProject(flow.fx, base.id);
}

/** P1: one floor with a 65-char name, no layer, an 80-char project name (BUG-458 residual). */
export async function seedNoLayer(flow: ExportFlow): Promise<ExportProject> {
  const name = `${TEST_DATA_PREFIX}export-nolayer-with-a-very-long-project-name-`.padEnd(80, 'abcdefghij').slice(0, 80);
  const floorName = 'Tầng kỹ thuật phía sau khu nhà ở cho thuê dài hạn của chủ đầu tư'.slice(0, 65);
  const created = await flow.fx.request.post(PROJECTS, {
    headers: flow.fx.headers,
    data: { name, floors: [{ name: floorName, order: 0, elevationMm: 0, heightMm: FLOOR_HEIGHT_MM }] },
  });
  expect(created.status(), `setup: POST ${PROJECTS} "${name}": ${(await created.text()).slice(0, 200)}`).toBe(201);
  const id = String(asRecord(await created.json(), 'POST /api/projects').id);
  flow.cleanup.push(id);
  return readProject(flow.fx, id);
}

/** M0: a project with zero floors. */
export async function seedEmptyProject(flow: ExportFlow, slug = 'export-m0'): Promise<ExportProject> {
  const name = `${TEST_DATA_PREFIX}${slug}-${uniq()}`;
  const created = await flow.fx.request.post(PROJECTS, { headers: flow.fx.headers, data: { name } });
  expect(created.status(), `setup: POST ${PROJECTS} "${name}"`).toBe(201);
  const id = String(asRecord(await created.json(), 'POST /api/projects').id);
  flow.cleanup.push(id);
  return readProject(flow.fx, id);
}

/** `POST /api/projects/:id/floors` (phase03_projects_api: client-made level id `L-<24 UPPER>`). */
export async function addFloor(fx: LayerApi, projectId: string, name: string, order = 0): Promise<string> {
  const id = `L-${randomUUID().replace(/-/gu, '').toUpperCase().slice(0, 24)}`;
  const res = await fx.request.post(`${PROJECTS}/${projectId}/floors`, {
    headers: fx.headers,
    data: { id, name, order, elevationMm: order * FLOOR_HEIGHT_MM, heightMm: FLOOR_HEIGHT_MM },
  });
  expect(res.status(), `setup: POST ${PROJECTS}/${projectId}/floors: ${(await res.text()).slice(0, 200)}`).toBe(201);
  return id;
}

/* ---------------------------------------------------------------- screen helpers */

export const spatialRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(projectId)}/spatial$`, 'u');
export const ruleConfigRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(projectId)}/rule-config$`, 'u');
export const projectRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(projectId)}$`, 'u');

export const formatGroup = (page: Page): Locator => page.getByRole('radiogroup', { name: EP.formats, exact: true });
export const formatRadio = (page: Page, extension: string): Locator =>
  formatGroup(page).getByRole('radio', { name: new RegExp(escapeRegExp(extension), 'u') }); // nhãn thẻ "Mô hình 3D (.glb)" chứa phần mở rộng
/** Một định dạng chưa xuất được (PDF, ảnh): dòng chữ dưới danh sách thẻ, không bấm được. */
export const blockedFormat = (page: Page, extension: string): Locator =>
  page.getByRole('list', { name: EP.blockedList, exact: true }).getByRole('listitem').filter({ hasText: extension });
export const exportButton = (page: Page): Locator => page.getByRole('button', { name: EP.exportButton });
export const region = (page: Page, name: string): Locator => page.getByRole('region', { name, exact: true });
export const historyRegion = (page: Page): Locator => region(page, EP.history);
export const scopeRegion = (page: Page): Locator => region(page, EP.scope);
export const preflightRegion = (page: Page): Locator => region(page, EP.preflight);
export const scopeBox = (page: Page, floor: string): Locator => scopeRegion(page).getByRole('checkbox', { name: floor, exact: true });
/** One floor of "Phạm vi": the bordered row holding its checkbox, its Badge and (unapproved) its caption (EPO:73-92). */
// `has` is matched INSIDE each row, so it must not repeat the region prefix that `scopeBox` carries.
export const scopeRow = (page: Page, floor: string): Locator =>
  scopeRegion(page).locator('div.rounded.border').filter({ has: page.getByRole('checkbox', { name: floor, exact: true }) });
export const preflightRow = (page: Page, text: string | RegExp): Locator => preflightRegion(page).getByRole('listitem').filter({ hasText: text });
export const optionsToggle = (page: Page): Locator => page.getByRole('button', { name: EP.options, exact: true });
/** History body rows (the header row holds `columnheader`s). */
export const historyRows = (page: Page): Locator => historyRegion(page).locator('tbody tr');

/**
 * Opens `/projects/:id/export` with a fresh document and waits for its N15 read (200) — `ProjectSpatialGate` via
 * `useProjectSpatial` — and for `ready` (default: the format radiogroup; the forbidden / empty states pass their heading).
 * `dismiss` false keeps the EditorTour (mounted lazily on this route) on screen. A project the user cannot read answers
 * N15 404: those tests call `page.goto` themselves.
 */
export async function openExport(
  page: Page,
  projectId: string,
  options: { readonly dismiss?: boolean; readonly ready?: (page: Page) => Locator } = {},
): Promise<ApiResult> {
  const read = await navigateThenWaitForApi(page, () => page.goto(ROUTES.project.export(projectId), { waitUntil: 'commit' }), 'GET', spatialRe(projectId), [200]);
  await expect((options.ready ?? formatGroup)(page)).toBeVisible();
  // G6: the tour backdrop swallows the first click; the states without the panel have no anchor to wait for.
  if (options.dismiss !== false) await dismissTour(page, { waitMs: options.ready === undefined ? TOUR_APPEAR_TIMEOUT_MS : 0 });
  return read;
}

export async function selectFormat(page: Page, extension: string): Promise<Locator> {
  const radio = formatRadio(page, extension);
  await radio.click();
  await expect(radio).toHaveAttribute('aria-checked', 'true');
  return radio;
}

export async function expandOptions(page: Page): Promise<void> {
  const toggle = optionsToggle(page);
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true'); // EPO:225
}

/**
 * `components/ui/Checkbox.tsx:40-75`: the `<input>` is `sr-only` under a drawn box inside its `<label>`, so the box
 * intercepts a click on the input; a person clicks the label — so does this.
 */
export async function setBox(box: Locator, checked: boolean): Promise<void> {
  if ((await box.isChecked()) !== checked) await box.locator('xpath=ancestor::label[1]').click();
  await expect(box).toBeChecked({ checked });
}

/** `waitForEvent('download')` is registered BEFORE the action runs (a download that starts first is never lost). */
export async function downloadVia(page: Page, action: () => Promise<unknown>): Promise<Download> {
  const waiting = page.waitForEvent('download');
  await action();
  const download = await waiting;
  await relockPause(page);
  return download;
}

/**
 * useExportPanel.ts `EXPORT_RELOCK_MS` (250 ms, 30-C-029): after a run ends (done / cancelled / failed) a click on "Xuất" is
 * ignored for a short guard window. The DOM shows no sign of it, so a test that clicks "Xuất" right after a run ended
 * waits it out first (BUG-716 round: 4 reds, all this cause).
 */
export async function relockPause(page: Page): Promise<void> {
  await page.waitForTimeout(350); // fixed-wait-ok: no DOM signal for the 250 ms re-export guard (EXPORT_RELOCK_MS)
}

/** Saves a download under `dir/name` and returns the path. */
export async function saveDownload(download: Download, outputPath: (name: string) => string, prefix = ''): Promise<string> {
  const path = outputPath(`${prefix}${download.suggestedFilename()}`);
  await download.saveAs(path);
  return path;
}

export interface GlbFile {
  readonly magic: string;
  readonly json: Json;
  readonly bytes: number;
}

/** Binary glTF 2.0: 12-byte header ("glTF", version, length) then the JSON chunk (length, "JSON", data). */
export function readGlb(path: string): GlbFile {
  const buffer = readFileSync(path);
  const chunkLength = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.subarray(20, 20 + chunkLength).toString('utf8')) as unknown;
  return { magic: buffer.subarray(0, 4).toString('latin1'), json: asRecord(json, 'glb JSON chunk'), bytes: buffer.length };
}

/** Nodes of a glb JSON chunk (`nodes[]`, GWK:548). */
export const glbNodes = (glb: GlbFile): Json[] => (Array.isArray(glb.json.nodes) ? glb.json.nodes.map((n) => asRecord(n, 'glb node')) : []);

/** Reads a downloaded `.json` export. */
export const readJsonFile = (path: string): { text: string; data: Json } => {
  const text = readFileSync(path, 'utf8');
  return { text, data: asRecord(JSON.parse(text), 'exported json') };
};

/** Items with `reviewed === false` in the N16 layers of `floorIds` (walls, openings, rooms, furniture, axes, dimensions, notes). */
export async function unreviewedCount(fx: LayerApi, projectId: string, floorIds: readonly string[]): Promise<number> {
  let total = 0;
  for (const floorId of floorIds) {
    const res = await fx.request.get(layerPathOf(projectId, floorId), { headers: fx.headers });
    expect(res.status(), `setup: GET N16 of ${floorId}`).toBe(200);
    const layer = asRecord(asRecord(await res.json(), 'N16').layer, 'N16.layer');
    for (const items of Object.values(layer)) {
      if (Array.isArray(items)) total += items.filter((item) => asRecord(item, 'layer item').reviewed === false).length;
    }
  }
  return total;
}

/**
 * Telemetry batches the page posts (`POST /api/telemetry…`, `sendBeacon` or fetch): returns a reader of every event object
 * (deep search for `{name}`) seen so far. Call BEFORE the action; the sender flushes every 10 s or 20 events (sender.ts:105-108).
 */
export function collectTelemetry(page: Page): () => Json[] {
  const events: Json[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (typeof value === 'object' && value !== null) {
      const record = value as Json;
      if (typeof record.name === 'string' && record.name.includes('.')) events.push(record);
      Object.values(record).forEach(walk);
    }
  };
  page.on('request', (request) => {
    if (request.method() !== 'POST' || !new URL(request.url()).pathname.startsWith('/api/telemetry')) return;
    try {
      walk(JSON.parse(request.postData() ?? 'null'));
    } catch {
      /* not JSON: nothing to read */
    }
  });
  return () => events;
}

/** Evidence name `E06_<row id>_<slug>.png` (once per run). */
export const shot = (page: Page, id: string, slug: string, caption?: string | readonly string[]): Promise<string> =>
  captureEvidence(page, `E06_${id}_${slug}.png`, caption === undefined ? {} : { caption });

/** Where the focus is: its tag, and whether it sits inside the page's `<main>` / footer (never `<body>`). */
export async function focusInfo(page: Page): Promise<{ tag: string; inside: boolean }> {
  return page.evaluate(() => {
    const el = document.activeElement;
    return { tag: el === null ? 'null' : el.tagName.toLowerCase(), inside: el !== null && el !== document.body && el.closest('main, footer') !== null };
  });
}

/** One frame or two for React to commit what a click started (a render barrier, not a wait for time). */
export const nextFrames = (page: Page): Promise<void> =>
  page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));

/**
 * N = findings total of the project's rule report (30-C-020): the rows of every expanded group table of
 * `/projects/:id/rules`, read in a second page of the same context (the SPA store of the export page stays untouched).
 */
export async function findingsTotal(flow: ExportFlow, projectId: string): Promise<number> {
  const page = await flow.context.newPage();
  try {
    await page.goto(ROUTES.project.rules(projectId));
    await expect(page.getByRole('heading', { name: 'Kiểm tra quy chuẩn', level: 1 })).toBeVisible(); // RRV:287
    await expect(page.getByRole('button', { name: 'Chạy kiểm tra lại', exact: true })).toBeEnabled(); // RRV:305
    const toggles = page.getByRole('heading', { level: 3 }).getByRole('button'); // RRG:90-108
    const count = await toggles.count();
    for (let i = 0; i < count; i += 1) {
      const toggle = toggles.nth(i);
      if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
    }
    return await page.locator('tbody tr').count();
  } finally {
    await page.close();
  }
}

/* ---------------------------------------------------------------- stubs (mocked edge / mocked ui only) */

export type GlbWorkerMode = 'silent' | 'fail' | 'fail-then-real' | 'real';

interface GlbControl {
  mode: GlbWorkerMode;
  starts: { instance: number; real: boolean; kind: string; detail: unknown; levels: unknown }[];
  emit: (message: Json) => void;
}

/**
 * The browser boundary of `.glb`: `exportGlb.ts:169-171` `new Worker(new URL('./glb.worker.ts', …), { type: 'module' })`.
 * Wraps `window.Worker` (every document of the page, `addInitScript`); only a URL containing `glb.worker` is touched:
 * - `silent`: a stub that accepts `start` and posts nothing (a real model finishes in milliseconds, "Huỷ" cannot be hit);
 * - `fail`: a stub that answers `start` with `{kind:'error', ticket:1, message:'Worker crashed'}`;
 * - `fail-then-real`: the first instance fails, every later one is the real worker; `real`: always the real worker.
 * A `cancel` message makes a stub answer `{kind:'cancelled', ticket:1}`. {@link emitFromWorker} pushes any worker message
 * (progress…) into the newest stub; {@link workerStarts} reads what every instance (stub or real) was asked to build.
 * S5-confirm: the built worker URL contains `glb.worker` (Vite names worker chunks `assets/glb.worker-<hash>.js`).
 */
export async function stubGlbWorker(page: Page, mode: GlbWorkerMode): Promise<void> {
  await page.addInitScript((initial: GlbWorkerMode) => {
    type Msg = Record<string, unknown>;
    const win = window as unknown as { __qaGlb?: GlbControl; Worker: typeof Worker };
    const RealWorker = win.Worker;
    const control: GlbControl = { mode: initial, starts: [], emit: () => undefined };
    win.__qaGlb = control;
    let created = 0;
    const summary = (instance: number, real: boolean, message: Msg): GlbControl['starts'][number] => {
      const request = (message.request ?? {}) as { options?: { detail?: unknown }; floors?: { level?: { name?: unknown } }[] };
      return {
        instance,
        real,
        kind: String(message.kind),
        detail: request.options?.detail ?? null,
        levels: (request.floors ?? []).map((floor) => floor.level?.name ?? null),
      };
    };
    const makeStub = (index: number, fails: boolean): unknown => {
      const stub = {
        onmessage: null as ((event: { data: Msg }) => void) | null,
        onerror: null as unknown,
        onmessageerror: null as unknown,
        dead: false,
        emit(message: Msg): void {
          if (!stub.dead) stub.onmessage?.({ data: { ticket: 1, ...message } });
        },
        postMessage(message: Msg): void {
          control.starts.push(summary(index, false, message));
          if (message.kind === 'start' && fails) setTimeout(() => stub.emit({ kind: 'error', message: 'Worker crashed' }), 0);
          if (message.kind === 'cancel') stub.emit({ kind: 'cancelled' });
        },
        terminate(): void {
          stub.dead = true;
        },
        addEventListener(): void {},
        removeEventListener(): void {},
        dispatchEvent(): boolean {
          return false;
        },
      };
      control.emit = (message) => stub.emit(message);
      return stub;
    };
    win.Worker = function PatchedWorker(url: string | URL, options?: WorkerOptions): Worker {
      if (!String(url).includes('glb.worker')) return new RealWorker(url, options);
      created += 1;
      const failing = control.mode === 'fail' || control.mode === 'fail-then-real';
      if (control.mode === 'fail-then-real') control.mode = 'real';
      if (control.mode === 'real' && !failing) {
        const real = new RealWorker(url, options);
        const post = real.postMessage.bind(real) as (message: Msg, ...rest: unknown[]) => void;
        const index = created;
        (real as unknown as { postMessage: (message: Msg, ...rest: unknown[]) => void }).postMessage = (message, ...rest) => {
          control.starts.push(summary(index, true, message));
          post(message, ...rest);
        };
        return real;
      }
      return makeStub(created, failing) as Worker;
    } as unknown as typeof Worker;
  }, mode);
}

/** Changes what the NEXT `new Worker(glb.worker…)` of the current document is (the stub keeps one control per document). */
export async function setGlbWorkerMode(page: Page, mode: GlbWorkerMode): Promise<void> {
  await page.evaluate((next) => {
    (window as unknown as { __qaGlb: GlbControl }).__qaGlb.mode = next;
  }, mode);
}

/** Posts a worker message (`{kind:'progress', phase, completed, total}`…) from the newest stub instance, ticket 1. */
export async function emitFromWorker(page: Page, message: Json): Promise<void> {
  await page.evaluate((payload) => {
    (window as unknown as { __qaGlb: GlbControl }).__qaGlb.emit(payload);
  }, message);
}

/** What each worker instance was asked to do: `start`/`cancel` kind, detail and floor names of the request. */
export async function workerStarts(page: Page): Promise<GlbControl['starts']> {
  return page.evaluate(() => (window as unknown as { __qaGlb: GlbControl }).__qaGlb.starts);
}

export interface RouteHold {
  /** Requests answered by the hold so far. */
  readonly served: () => number;
  /** Lets the held requests go on (the real server answers); a `fail` hold stops failing. */
  readonly release: () => void;
  /** Removes the route. */
  readonly stop: () => Promise<void>;
}

/**
 * A GET the test controls (`page.route`, not a mock of the server): `hold` keeps the request until {@link RouteHold.release}
 * and then lets the real server answer; `fail` answers every GET with a JSON 500 until released. Other methods pass.
 */
export async function holdRoute(page: Page, matcher: RegExp, mode: 'hold' | 'fail'): Promise<RouteHold> {
  let open: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  let released = false;
  let served = 0;
  const handler = async (route: Route): Promise<void> => {
    if (route.request().method() !== 'GET' || !matcher.test(new URL(route.request().url()).pathname) || released) {
      await route.fallback();
      return;
    }
    served += 1;
    if (mode === 'fail') {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL', requestId: 'qa-mock' }) });
      return;
    }
    await gate;
    await route.fallback().catch(() => undefined); // the document may be gone (verifyUi opens about:blank between widths)
  };
  await page.route('**/api/**', handler);
  return {
    served: () => served,
    release: () => {
      released = true;
      open();
    },
    stop: () => page.unroute('**/api/**', handler),
  };
}
