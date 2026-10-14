/**
 * P7 helpers for SCR-36 Model AI registry (real, read-only + open/cancel dialogs). Sources under `src/screens/admin/ModelRegistry/`:
 * MR ModelRegistry.tsx, MRA ModelRegistryActivateDialog.tsx, MRV ModelRegistryVersionTable.tsx, MRD ModelRegistryDetail.tsx,
 * UMR useModelRegistry.ts, SEG src/components/ui/SegmentedControl.tsx.
 */
import { expect, type APIRequestContext, type Browser, type BrowserContext, type Locator, type Page, type Route } from '@playwright/test';

import { ROUTES as APP_ROUTES, pathOf } from '../../../../e2e/fixtures/routes';
import { waitForApiWhere, type ApiResult } from '../../../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../../../e2e/fullstack/env';
import { signInAdmin } from '../auth';
import { FAMILY_LABEL, type FamilyId } from './registry';

export const REGISTRY_PATH = APP_ROUTES.adminTrainingModels;
export const FAMILIES = '/api/admin/ml/model-families';
export const VERSIONS = '/api/admin/ml/model-versions';
export const ACTIVE_PUT = /^\/api\/admin\/ml\/model-families\/[^/]+\/active$/u;

export type Json = Record<string, unknown>;
export const FAMILY_ORDER = ['wallSegmentation', 'openingAndFurnitureDetection', 'dimensionReading'] as const;
export type Family = FamilyId;
export { FAMILY_LABEL };
export const FAMILY_NAME: Readonly<Record<Family, string>> = {
  wallSegmentation: 'tách lớp tường',
  openingAndFurnitureDetection: 'nhận diện cửa và đồ đạc',
  dimensionReading: 'đọc kích thước',
}; // UMR:78-82

export const REG = {
  title: 'Model AI của chuỗi xử lý', // MR:29
  crumbHere: 'Model AI', // MR:28
  crumbParent: 'Quản trị',
  picker: 'Họ model', // MR:30
  active: 'Đang dùng', // MR:31
  revert: 'Quay về đường cổ điển', // MR:32
  noActive: 'Chưa kích hoạt bản nào', // UMR:101
  related: 'Lượt huấn luyện', // UMR:94
  activate: 'Kích hoạt', // MRV:17
  cancel: 'Huỷ', // MRA:14
  placeholder: 'Chọn một phiên bản để xem chi tiết.', // MRD:13
  detailPanel: 'Chi tiết phiên bản', // MR:40
  blockedNotEvaluated: 'Chỉ kích hoạt được bản đã đánh giá.', // UMR:111
  partialTail: 'phiên bản đang chờ hoặc đang đánh giá; chỉ kích hoạt được bản đã đánh giá.', // UMR:178-180
  dialogBody: 'Lượt xử lý mới dùng bản này ngay; lượt đang chạy giữ model đã ghim.', // UMR:127
  revertBody: 'Chuỗi xử lý sẽ tách tường bằng thuật toán cổ điển, không dùng model nào.', // UMR:164-166
  forbiddenTitle: 'Không có quyền truy cập', // MR:38
  forbiddenBody: 'Chỉ quản trị viên hệ thống xem được model AI.', // MR:39
  headers: ['Nhãn', 'Định dạng', 'Đánh giá', 'Số đo', 'Nguồn', 'Ngày tạo'], // MRV:118-119,215-220
  fields: ['Mã', 'Mã băm', 'Định dạng', 'Số đo', 'Người tạo', 'Ngày tạo'], // UMR:276-292
  seedNote: 'Số đo trên tập kiểm tổng hợp cố định, không so thẳng với bản huấn luyện.', // UMR:124
} as const;
export const EVALUATION_LABEL: Readonly<Record<string, string>> = {
  pending: 'Chờ đánh giá',
  running: 'Đang đánh giá',
  completed: 'Đã đánh giá',
  failed: 'Đánh giá không thành công',
}; // UMR:102-107
export const activateTitle = (label: string, family: Family): string =>
  `Kích hoạt ${label === 'Gốc' ? 'gốc' : label} cho ${FAMILY_NAME[family]}?`; // UMR:160-162
export const revertTitle = (family: Family): string => `Quay về đường cổ điển cho ${FAMILY_NAME[family]}?`; // UMR:164-166

const asRecord = (v: unknown, what: string): Json => {
  expect(typeof v === 'object' && v !== null && !Array.isArray(v), `${what}: object`).toBe(true);
  return v as Json;
};
export const itemsOf = (body: unknown, what: string): Json[] => {
  const items = asRecord(body, what).items;
  expect(Array.isArray(items), `${what}.items`).toBe(true);
  return (items as unknown[]).map((i) => asRecord(i, what));
};
export const str = (r: Json, key: string): string => (typeof r[key] === 'string' ? (r[key] as string) : '');

/** Next GET of `path` answered 200 whose query passes `where`. Register BEFORE the action. */
export function readOf(page: Page, path: string, where: (url: URL) => boolean = () => true): Promise<ApiResult> {
  return waitForApiWhere(
    page,
    (res) => {
      const url = new URL(res.url());
      return res.request().method() === 'GET' && url.pathname === path && res.status() === 200 && where(url);
    },
    undefined,
    `GET ${path}`,
  );
}
export const byFamily =
  (family: Family) =>
  (url: URL): boolean =>
    url.searchParams.get('family') === family;

export const picker = (page: Page): Locator => page.getByRole('radiogroup', { name: REG.picker, exact: true });
export const radio = (page: Page, family: Family): Locator => picker(page).getByRole('radio', { name: FAMILY_LABEL[family], exact: true });
export const activeCard = (page: Page): Locator => page.getByRole('region', { name: REG.active, exact: true }); // MR:90-95
export const versionRow = (page: Page, label: string): Locator =>
  page.getByRole('row').filter({ has: page.getByRole('button', { name: label, exact: true }) }).first(); // MRV:29-40
export const detailAside = (page: Page): Locator => page.getByRole('complementary', { name: REG.detailPanel, exact: true });

/** Click `family` on the picker and return its first versions page. */
export async function selectFamily(page: Page, family: Family): Promise<Json[]> {
  const read = readOf(page, VERSIONS, byFamily(family));
  await radio(page, family).click();
  return itemsOf((await read).json, `GET model-versions (${family})`);
}

export interface RegistryOpen {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly families: Json[];
  readonly walls: Json[];
  readonly reads: { readonly families: ApiResult; readonly versions: ApiResult };
}

/** Fresh context, admin UI sign-in (1 login) landing on the registry; arrival reads captured. Caller closes `context`. */
export async function openRegistry(browser: Browser): Promise<RegistryOpen> {
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const families = readOf(page, FAMILIES);
  const walls = readOf(page, VERSIONS, byFamily('wallSegmentation'));
  await signInAdmin(page, REGISTRY_PATH);
  const [f, v] = [await families, await walls];
  return { context, page, families: itemsOf(f.json, 'GET model-families'), walls: itemsOf(v.json, 'GET model-versions'), reads: { families: f, versions: v } };
}

/** CP-8 candidate: first completed onnx version of the opening family that is not active. `null` when missing. */
export async function pickCandidate(api: APIRequestContext): Promise<{ id: string; label: string; activeVersionId: string | null; revision: number } | null> {
  const fam = await api.get(FAMILIES);
  expect(fam.status(), 'GET model-families').toBe(200);
  const record = itemsOf(await fam.json(), 'families').find((f) => f.family === 'openingAndFurnitureDetection');
  const ver = await api.get(VERSIONS, { params: { family: 'openingAndFurnitureDetection' } });
  expect(ver.status(), 'GET model-versions').toBe(200);
  const activeVersionId = typeof record?.activeVersionId === 'string' ? record.activeVersionId : null;
  const hit = itemsOf(await ver.json(), 'versions').find((v) => v.evaluationStatus === 'completed' && v.weightsFormat === 'onnx' && v.id !== activeVersionId);
  return hit === undefined ? null : { id: str(hit, 'id'), label: str(hit, 'label'), activeVersionId, revision: Number(record?.revision ?? 0) };
}

/** Aborts and counts every `method` request whose path matches `path` (expected count 0; a guard, not a mock). */
export async function guardWrites(page: Page, method: string, path: RegExp): Promise<{ readonly count: () => number; readonly release: () => Promise<void> }> {
  let count = 0;
  const matcher = (url: URL): boolean => path.test(url.pathname);
  const handler = async (route: Route): Promise<void> => {
    if (route.request().method() !== method) return route.fallback();
    count += 1;
    return route.abort();
  };
  await page.route(matcher, handler);
  return { count: () => count, release: () => page.unroute(matcher, handler) };
}

export function recordRequests(page: Page, match: (url: URL) => boolean): { readonly list: () => string[]; readonly stop: () => void } {
  const seen: string[] = [];
  const on = (req: { url(): string; method(): string }): void => {
    if (match(new URL(req.url()))) seen.push(`${req.method()} ${pathOf(req.url())}`);
  };
  page.on('request', on);
  return { list: () => [...seen], stop: () => page.off('request', on) };
}
