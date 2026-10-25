/**
 * QA-06b P6 helpers (SCR-32 Version History, real stack): seeds, copy constants, locators. Used by
 * `phase06_versions_edge.spec.ts` only.
 *
 * Seeds (flows-C5 "Seeds"):
 * - `seedVersionLadder(api, projectId, floorId, total)`: restores through N19 until N17 lists `total` versions and asserts the BE
 *   keeps the content of the 50 newest only (BE apps/api/versions/snapshots.py:53 `versions_keep_snapshots` = 50).
 * - `restoreVia(api, projectId, floorId, versionId)`: one N19 call at the floor's current revision (N16).
 * - `createLongNameProject(api, slug)`: 80-character project name + one floor with a 65-character name (BE #25).
 *
 * Source short names: VH VersionHistory.tsx · VL VersionList.tsx · VC VersionCompare.tsx · VD VersionLabelDialog.tsx · UVH useVersionHistory.ts
 * · VHM versionHistoryModel.ts · VHG versionHistoryGateway.ts (all under `src/screens/export/VersionHistory/`).
 */
import { expect, type APIRequestContext, type Browser, type BrowserContext, type Locator, type Page, type Request } from '@playwright/test';

import { navigateThenWaitForApi, watchApi, type ApiEntry } from '../../../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../../../e2e/fullstack/env';
import { ROUTES } from '../../../../e2e/fixtures/routes';
import { signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import { TEST_DATA_PREFIX } from '../evidence';
import { deleteSeededProject } from '../drawingSeed';
import { signInPoolUser, type PoolUser } from '../phase03Seed';

export type Json = Record<string, unknown>;

export const DESKTOP = { width: 1440, height: 900 } as const;
export const NARROW = { width: 768, height: 1024 } as const;
const PROJECTS = '/api/projects';

/* ---------------------------------------------------------------- copy (each cites its source) */

export const VH = {
  h1: /^So sánh và phục hồi phiên bản/u, // VH: "So sánh và phục hồi phiên bản của <Tầng>"
  list: 'Danh sách phiên bản', // VL:364
  checkbox: (label: string): string => `Chọn phiên bản ${label} để so sánh`, // VL:307
  current: 'Hiện tại', // VL:94
  floorSelect: 'Tầng', // UVH:604
  narrowSelect: 'Phiên bản', // VH:119
  leftSelect: 'Phiên bản gốc', // VC:184
  rightSelect: 'Phiên bản đối chiếu', // VC:192
  emptyTitle: (floor: string): string => `${floor} chưa có phiên bản nào`, // UVH:611
  emptyDescription: 'Phiên bản được lưu khi AI ghi kết quả và khi phục hồi một bản cũ.', // VH:72
  noFloorTitle: 'Dự án chưa có tầng', // VHC:216-222
  noFloorMessage: 'Lịch sử phiên bản đi theo từng tầng. Thêm tầng và xử lý bản vẽ của nó, rồi quay lại đây.',
  restore: 'Phục hồi phiên bản này', // VH:186
  tag: /^Gắn nhãn v[0-9]+$/u, // VH: "Gắn nhãn vN"
  loadMore: 'Xem thêm phiên bản', // VH:134-138
  pickOne: 'Chọn một phiên bản để phục hồi.', // VH:152-154
  restoreCaption:
    'Phục hồi không xoá phiên bản nào: trạng thái hiện tại được giữ lại thành một phiên bản riêng, và bản phục hồi được thêm lên đầu danh sách', // VHM:502-503
  undoCleared: 'Riêng lịch sử hoàn tác (Ctrl+Z) của mọi tầng sẽ được xoá.', // VHM:509
  restoreTitle: (label: string, floor: string): string => `Phục hồi phiên bản ${label} của ${floor}?`, // VHM:539
  restoreConfirm: 'Phục hồi',
  restoreCancel: 'Để nguyên',
  restoredToast: (label: string, floor: string): string => `Đã phục hồi phiên bản ${label} của ${floor}; hoàn tác được trong 8 giây`, // UVH:443
  undoneToast: 'Đã hoàn tác lượt phục hồi', // UVH:390
  unchangedToast: 'Phiên bản này trùng với hiện trạng', // UVH:373
  noPair: 'Chưa chọn đủ hai phiên bản để so sánh', // VHP:44
  viewerReason: 'Vai trò của bạn trên dự án này chỉ đọc được lịch sử, nên nút phục hồi không hiện', // VHM:493
  conflictTitle: 'Tầng vừa đổi ở nơi khác', // VHG:86
  conflictDismiss: 'Tải lại', // VHG:94
  restoreErrorTitle: 'Chưa phục hồi được', // VHM:404
  labelErrorTitle: 'Chưa gắn được nhãn',
  labelDialog: (label: string): string => `Gắn nhãn phiên bản ${label}`, // VD:37
  labelField: 'Nhãn', // VD:41
  labelHint: 'Để trống rồi bấm Gắn nhãn là gỡ nhãn.', // VD:42
  labelMax: 60, // VD:14
  labelCancel: 'Huỷ', // VD:49
  labeledToast: 'Đã gắn nhãn', // UVH:470
  unlabeledToast: 'Đã gỡ nhãn', // UVH:470
  retention:
    'Chỉ 50 phiên bản gần nhất còn giữ đủ nội dung; bản này chỉ còn siêu dữ liệu nên không so sánh và không phục hồi được', // VHM:218-219
  noDiffTitle: 'Không có khác biệt', // VG:29
  noDiffBody: 'Hai phiên bản đang chọn giống nhau ở mọi đối tượng.',
  noJsonTitle: 'Không có dòng nào khác nhau', // VJ:26
  noJsonBody: 'Bản ghi của hai phiên bản đang chọn trùng nhau từng dòng.',
  noChangeStatus: 'Không có thay đổi nào', // VHM:EMPTY_DIFF_COUNTS
  snapshotStatus: 'Trạng thái nạp nội dung phiên bản', // VL:255
} as const;

export const DIFF_TABS = {
  list: 'Cách xem khác biệt', // VC:52
  changes: 'Thay đổi',
  json: 'JSON',
  visual: 'Trực quan',
} as const;

export const NOT_FOUND = { title: 'Không tìm thấy dự án này', back: 'Về danh sách dự án' } as const; // ProjectSpatialGate.tsx:37,57

/* ---------------------------------------------------------------- small helpers */

export const asRecord = (value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what}: not a JSON object`);
  return value as Json;
};

export function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`setup: ${what} missing`);
  return value;
}

export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

const idBase = (projectId: string): string => `^/api/projects/${escapeRegExp(projectId)}`;
export const versionsRe = (projectId: string): RegExp => new RegExp(`${idBase(projectId)}/versions$`, 'u');
export const restoreRe = (projectId: string): RegExp => new RegExp(`${idBase(projectId)}/versions/[^/]+/restore$`, 'u');
export const labelRe = (projectId: string): RegExp => new RegExp(`${idBase(projectId)}/versions/[^/]+/label$`, 'u');
export const layerRe = (projectId: string, floorId: string): RegExp =>
  new RegExp(`${idBase(projectId)}/floors/${escapeRegExp(floorId)}/spatial/layer$`, 'u');

/** `prj_` + a valid ULID that no project owns (BE answers 404 resource project). */
export function unknownProjectId(): string {
  const crockford = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  return `prj_${Array.from({ length: 26 }, () => crockford[Math.floor(Math.random() * crockford.length)] ?? '0').join('')}`;
}

/** Writes the page sent since `mark`, minus session / telemetry chatter. */
export const writesSince = (log: readonly ApiEntry[], mark: number): string[] =>
  log
    .slice(mark)
    .filter((entry) => entry.method !== 'GET' && entry.path !== '/api/auth/refresh' && !entry.path.startsWith('/api/telemetry'))
    .map((entry) => `${entry.method} ${entry.path} ${String(entry.status)}`);

/** Entries of the page's API log that are N17 reads of `projectId`. */
export const versionReads = (log: readonly ApiEntry[], projectId: string, from = 0): ApiEntry[] =>
  log.slice(from).filter((entry) => entry.method === 'GET' && versionsRe(projectId).test(entry.path));

/** The toast (role=status, Toast.tsx:142) carrying `message`. */
export const toast = (page: Page, message: string | RegExp): Locator => page.getByRole('status').filter({ hasText: message });

/** Checkbox.tsx: the input is sr-only under a drawn box inside its `<label>`; a person clicks the label. */
export async function setBox(box: Locator, checked: boolean): Promise<void> {
  if ((await box.isChecked()) !== checked) await box.locator('xpath=ancestor::label[1]').click();
  await expect(box).toBeChecked({ checked });
}

/** Opens a ui/Select (role combobox named `name`) and picks the option. */
export async function pickOption(page: Page, name: string, option: string | RegExp): Promise<void> {
  await page.getByRole('combobox', { name, exact: true }).click();
  await page.getByRole('option', { name: option }).click();
}

/* ---------------------------------------------------------------- locators */

export const versionList = (page: Page): Locator => page.getByRole('navigation', { name: VH.list, exact: true });
export const versionRow = (page: Page, label: string): Locator =>
  versionList(page).getByRole('listitem').filter({ has: page.getByRole('checkbox', { name: VH.checkbox(label), exact: true }) });
export const rowBox = (page: Page, label: string): Locator => page.getByRole('checkbox', { name: VH.checkbox(label), exact: true });
export const diffTab = (page: Page, label: string): Locator =>
  page.getByRole('tablist', { name: DIFF_TABS.list, exact: true }).getByRole('tab', { name: new RegExp(`^${label}`, 'u') }); // tab Thay đổi có thêm số đếm
/** CSS, not getByRole: the inactive panels carry `hidden` (VC:226-241), which getByRole skips. */
export const tabPanel = (page: Page, label: string): Locator => page.locator(`[role="tabpanel"][aria-label="${label}"]`);
export const diffTabHeights = (page: Page): Promise<number[]> =>
  page
    .getByRole('tablist', { name: DIFF_TABS.list, exact: true })
    .getByRole('tab')
    .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)));
export const button = (page: Page, name: string | RegExp): Locator => page.getByRole('button', { name, exact: true });

/** `/versions` with a fresh document; waits for the N17 200 of `floorId` (VHC:206). */
export async function openVersions(page: Page, projectId: string, floorId: string, query = ''): Promise<void> {
  const { response } = await navigateThenWaitForApi(page, () => page.goto(`${ROUTES.project.versions(projectId)}${query}`), 'GET', versionsRe(projectId), [200]);
  expect(new URL(response.url()).searchParams.get('floorId'), 'N17 asks for the expected floor').toBe(floorId);
}

/** Peak / total of N18 snapshot reads the page sends (VC / UVH:82-84: at most 2 in flight, 10 newest + the ticked pair). */
export function trackSnapshots(page: Page): { inFlight: number; peak: number; urls: string[] } {
  const state = { inFlight: 0, peak: 0, urls: [] as string[] };
  const isSnapshot = (request: Request): boolean => request.method() === 'GET' && /\/versions\/[^/]+\/snapshot$/u.test(new URL(request.url()).pathname);
  page.on('request', (request) => {
    if (!isSnapshot(request)) return;
    state.inFlight += 1;
    state.peak = Math.max(state.peak, state.inFlight);
    state.urls.push(new URL(request.url()).pathname);
  });
  const done = (request: Request): void => {
    if (isSnapshot(request)) state.inFlight -= 1;
  };
  page.on('requestfinished', done);
  page.on('requestfailed', done);
  return state;
}

/* ---------------------------------------------------------------- browser sessions */

export interface OpenPage {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly api: ApiEntry[];
}

/** dup-of: support/p03/P4.ts adminApi — one real admin API login; the caller disposes it. */
export function adminApi(): Promise<APIRequestContext> {
  const { email, password } = readAdminCredentials();
  return signedInApi(email, password);
}

/** dup-of: support/p03/P4.ts openAdminPage — own browser context with its own admin login. */
export async function openAdminPage(browser: Browser, viewport: { width: number; height: number } = DESKTOP): Promise<OpenPage> {
  const { email, password } = readAdminCredentials();
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport });
  try {
    const res = await context.request.post('/api/auth/login', { data: { email, password, rememberMe: false }, headers: { Origin: readBaseUrl() } });
    expect(res.status(), 'setup: POST /api/auth/login as admin').toBe(204);
    const page = await context.newPage();
    return { context, page, api: watchApi(page) };
  } catch (error) {
    await context.close();
    throw error;
  }
}

/** dup-of: support/p03/P4.ts openPoolPage — own browser context signed in as a pool user. */
export async function openPoolPage(browser: Browser, user: PoolUser, viewport: { width: number; height: number } = DESKTOP): Promise<OpenPage> {
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

/** Closes sessions (undefined ones are skipped); never throws. */
export async function closePages(...opens: (OpenPage | undefined)[]): Promise<void> {
  for (const open of opens) await open?.context.close().catch(() => undefined);
}

/** Deletes the fixture projects; failures become annotations, never throw. */
export async function deleteProjects(api: APIRequestContext, ids: readonly string[], annotate: (text: string) => void): Promise<void> {
  for (const id of ids) {
    const failed = await deleteSeededProject(api, id);
    if (failed !== null) annotate(failed);
  }
}

/* ---------------------------------------------------------------- API seeds */

export interface VersionItem {
  readonly id: string;
  readonly sequence: number;
  readonly floorRevision: number;
  readonly createdAt: string;
  readonly hasSnapshot: boolean;
  readonly label?: string;
  readonly note?: string;
}

/** Every N17 item of a floor, newest first (follows `nextCursor`; the route ceiling is limit 200, BE versions/router.py:42). */
export async function listVersionsAll(api: APIRequestContext, projectId: string, floorId: string): Promise<VersionItem[]> {
  const items: VersionItem[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const query = `floorId=${encodeURIComponent(floorId)}&limit=200${cursor === undefined ? '' : `&cursor=${encodeURIComponent(cursor)}`}`;
    const res = await api.get(`${PROJECTS}/${projectId}/versions?${query}`);
    expect(res.status(), 'setup: GET versions (N17)').toBe(200);
    const body = asRecord(await res.json(), 'N17');
    for (const raw of Array.isArray(body.items) ? body.items : []) {
      const item = asRecord(raw, 'N17 item');
      items.push({
        id: String(item.id),
        sequence: Number(item.sequence),
        floorRevision: Number(item.floorRevision),
        createdAt: String(item.createdAt),
        hasSnapshot: item.hasSnapshot === true,
        ...(typeof item.label === 'string' ? { label: item.label } : {}),
        ...(typeof item.note === 'string' ? { note: item.note } : {}),
      });
    }
    cursor = typeof body.nextCursor === 'string' ? body.nextCursor : undefined;
    if (cursor === undefined) break;
  }
  return items.sort((a, b) => b.sequence - a.sequence);
}

/** N16 revision of a floor's layer. */
export async function layerRevision(api: APIRequestContext, projectId: string, floorId: string): Promise<number> {
  const res = await api.get(`${PROJECTS}/${projectId}/floors/${floorId}/spatial/layer`);
  expect(res.status(), 'setup: GET …/spatial/layer (N16)').toBe(200);
  return Number(asRecord(await res.json(), 'N16').revision);
}

/** N19 at the floor's current revision (body `{baseVersion, body: {floorId}}`, FE src/api/client.ts:1466-1469); returns the "after" summary. */
export async function restoreVia(
  api: APIRequestContext,
  projectId: string,
  floorId: string,
  versionId: string,
  knownBase?: number,
): Promise<{ id: string; sequence: number; floorRevision: number }> {
  const baseVersion = knownBase ?? (await layerRevision(api, projectId, floorId));
  const res = await api.post(`${PROJECTS}/${projectId}/versions/${versionId}/restore`, { data: { baseVersion, body: { floorId } } });
  expect(res.status(), `setup: POST restore ${versionId} (200 would be a replay): ${(await res.text()).slice(0, 200)}`).toBe(201);
  const summary = asRecord(await res.json(), 'N19');
  return { id: String(summary.id), sequence: Number(summary.sequence), floorRevision: Number(summary.floorRevision) };
}

/**
 * Grows a pipeline floor (v1 "before" empty, v2 "after" AI) to `total` versions with alternating restores: every target is the
 * "after" version made two restores earlier (v1 / v2 at first), so it is always among the newest and its content differs from the
 * current one. The 1st restore adds a "before" + an "after"; from the 2nd on only an "after" (BE snapshots.py:243-244), so ~56 restores. Asserts the BE keeps the content of the 50 newest only
 * (snapshots.py:53). Returns every version, newest first (loops on the real `sequence`).
 */
export async function seedVersionLadder(api: APIRequestContext, projectId: string, floorId: string, total = 58): Promise<VersionItem[]> {
  const start = await listVersionsAll(api, projectId, floorId);
  const afters = [...start].sort((a, b) => a.sequence - b.sequence).slice(0, 2).map((item) => item.id);
  expect(afters.length, 'setup: the pipeline wrote v1 and v2').toBe(2);
  let sequence = Math.max(...start.map((item) => item.sequence));
  for (let guard = 0; sequence < total && guard < total; guard += 1) {
    const target = must(afters[afters.length - 2], 'ladder target');
    const after = await restoreVia(api, projectId, floorId, target);
    afters.push(after.id);
    sequence = after.sequence;
  }
  const all = await listVersionsAll(api, projectId, floorId);
  expect(all.length, 'setup: ladder reached the wanted number of versions').toBeGreaterThanOrEqual(total);
  expect(
    all.slice(0, 50).every((item) => item.hasSnapshot),
    'setup: the 50 newest versions keep their content',
  ).toBe(true);
  expect(
    all.slice(50).every((item) => !item.hasSnapshot),
    'setup: versions older than the 50 newest are metadata only',
  ).toBe(true);
  return all;
}

/** 80-character project name (NAME_MAX) + one empty floor named with 65 characters (BE #25; as the old `U06 no-layer project` block). */
export async function createLongNameProject(
  api: APIRequestContext,
  slug: string,
): Promise<{ projectId: string; floorId: string; floorName: string; name: string }> {
  const name = `${TEST_DATA_PREFIX}${slug}-`.padEnd(80, 'N');
  const floorName = `Tầng-${slug}-`.padEnd(65, 'T');
  const res = await api.post(PROJECTS, { data: { name, floors: [{ name: floorName, order: 0, elevationMm: 0, heightMm: 3_000 }] } });
  expect(res.status(), `setup: POST ${PROJECTS}: ${(await res.text()).slice(0, 200)}`).toBe(201);
  const projectId = String(asRecord(await res.json(), `POST ${PROJECTS}`).id);
  const read = await api.get(`${PROJECTS}/${projectId}`);
  expect(read.status(), 'setup: GET project').toBe(200);
  const floors = asRecord(await read.json(), 'GET project').floors;
  const floor = (Array.isArray(floors) ? floors : []).map((row) => asRecord(row, 'floor')).find((row) => row.name === floorName);
  if (floor === undefined) {
    await deleteSeededProject(api, projectId);
    throw new Error('setup: the 65-character floor was not created');
  }
  return { projectId, floorId: String(floor.id), floorName, name };
}
