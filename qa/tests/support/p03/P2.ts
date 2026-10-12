/**
 * QA-03d agent P2 — helpers shared by the three SCR-08 branch files only (settings mocked / roles / UI verify).
 * Seeds come from `../phase03Seed.ts`; this file only adds the browser sessions, the SCR-08 copy and the route tools.
 *
 * Source abbreviations (FE `src/screens/project/ProjectSettings/`): PS ProjectSettings.tsx · UPS useProjectSettings.ts ·
 * UPM useProjectMembers.ts · SE settingsErrors.ts · PSG projectSettingsGateway.ts · AMF AddMemberForm.tsx ·
 * MT MembersTab.tsx · MRD MemberRemoveDialog.tsx · DZ DangerZoneTab.tsx · RD ProjectSettingsReloadDialog.tsx ·
 * I18N src/i18n/vi.json · HTTP src/lib/http/{client,retry}.ts.
 */
import { existsSync } from 'node:fs';

import { expect, type APIRequestContext, type Browser, type BrowserContext, type Locator, type Page, type Request, type Route } from '@playwright/test';

import { ROUTES } from '../../../../e2e/fixtures/routes';
import { watchApi, type ApiEntry } from '../../../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../../../e2e/fullstack/env';
import { newApiContext } from '../api';
import { ensureAdminSession } from '../auth';
import { signInPoolUser, type PoolUser } from '../phase03Seed';
import { ADMIN_STORAGE_STATE_FILE } from '../state';

/* ---- copy (each string read in src/) ---------------------------------------------------------- */

export const DESKTOP = { width: 1440, height: 900 } as const;
export const COMPACT = { width: 375, height: 812 } as const;

export const TABS_LABEL = 'Nhóm cài đặt'; // PS:51
export const TAB = { general: 'Chung', units: 'Đơn vị đo', members: 'Thành viên', danger: 'Vùng nguy hiểm' } as const; // UPS:531-534
export const LABEL = {
  name: 'Tên dự án', // GT:40
  code: 'Mã dự án',
  address: 'Địa chỉ',
  buildingType: 'Loại công trình',
  notes: 'Ghi chú',
  lengthUnit: 'Đơn vị chiều dài', // UT:46
  snap: 'Dung sai bắt điểm',
  confidence: 'Ngưỡng tin cậy',
  scale: 'Tỉ lệ bản vẽ',
} as const;
export const COPY = {
  readOnly: 'Vai hiện tại chỉ xem được cài đặt, không sửa và không xoá.', // PS:84
  loadError: 'Không tải được cài đặt dự án', // PS:104
  retry: 'Thử lại', // PS:64
  backToProjects: 'Về danh sách dự án', // ProjectSpatialGate BACK_TO_PROJECTS_LABEL
  saveFailure: 'Chưa lưu hết', // PS:98
  conflictTitle: 'Cài đặt đã đổi ở nơi khác', // PS:91
  reload: 'Tải lại', // PS:93
  reloadDialog: 'Tải lại sẽ bỏ thay đổi chưa lưu', // RD:20
  savedToast: 'Đã lưu cài đặt dự án.', // UPS:606
  undo: 'Hoàn tác', // Toast.tsx:149
  idle: 'Chưa có thay đổi', // I18N autosave.idle
  savedAt: /^Đã lưu lúc \d{1,2}:\d{2}$/u, // useSaveIndicator common.saved_at
  failedChip: 'Lưu thất bại. Hệ thống sẽ thử lưu lại ở lần chỉnh sửa tới.', // I18N autosave.failed
  offlineChip: 'Ngoại tuyến — sẽ lưu khi có mạng', // I18N autosave.offline
  reloadChip: 'Chưa lưu: cần tải lại bản mới nhất', // SE chipReload
  unknownError: 'Hệ thống đã ghi nhận và sẽ kiểm tra. Hãy thử lại sau ít phút.', // I18N errors.unknown.description
  networkError: 'Không liên lạc được với máy chủ. Kiểm tra mạng rồi thử lại.', // I18N errors.network.description
} as const;
export const MEMBER = {
  email: 'Email người cần thêm', // AMF:29
  add: 'Thêm thành viên', // AMF:45
  required: 'Chưa nhập địa chỉ email.', // UPM:30
  rateLimited: 'Bạn đã thêm nhiều thành viên trong giờ này; hãy thử lại sau.', // UPM:34
  lastEditor: 'Không gỡ được: dự án cần ít nhất một người sửa được cài đặt.', // UPM:35
  undoFailed: 'Không gỡ lại được người vừa thêm.', // UPM:37
  keep: 'Để nguyên', // UPM:38
  remove: 'Gỡ', // UPM:39
} as const;
export const DANGER = {
  deleteProject: 'Xoá dự án', // DZ:90
  deleteProjectTitle: 'Xoá dự án này?', // UPS:522
  deleteFloors: 'Xoá mọi tầng', // DZ:68
  deleteFloorsTitle: 'Xoá mọi tầng của dự án?', // UPS:521
  typeName: 'Gõ lại tên dự án để xác nhận', // PS:163
  keep: 'Để nguyên', // PS:174
} as const;

/* ---- small helpers ---------------------------------------------------------------------------- */

export type Json = Record<string, unknown>;

export const asRecord = (value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what}: not a JSON object`);
  return value as Json;
};

export const uniq = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
export const pathOf = (page: Page): string => new URL(page.url()).pathname;

export const projectPath = (id: string): string => `/api/projects/${id}`;
export const settingsPath = (id: string): string => `/api/projects/${id}/settings`;
export const membersPath = (id: string): string => `/api/projects/${id}/members`;
export const projectRe = (id: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(id)}$`, 'u');
export const settingsRe = (id: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(id)}/settings$`, 'u');
export const membersRe = (id: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(id)}/members$`, 'u');
export const memberRe = (id: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(id)}/members/[^/]+$`, 'u');

/** Toast / notice by its text (Toast.tsx `role="status"`). */
export const toastWith = (page: Page, text: string): Locator => page.getByRole('status').filter({ hasText: text });
/** Header save indicator (PS:79 `SaveIndicator`, role="status"). */
export const saveIndicator = (page: Page): Locator => page.locator('header').getByRole('status');
export const alertWith = (page: Page, text: string): Locator => page.getByRole('alert').filter({ hasText: text });
export const textbox = (page: Page, label: string): Locator => page.getByRole('textbox', { name: label, exact: true });

/** W7 error body as the BE sends it (AppBack apps/api/core/errors.py:82-99 `{code, requestId, …params}`). */
export function fulfillError(route: Route, status: number, code: string, extra: Json = {}, headers: Record<string, string> = {}): Promise<void> {
  return route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify({ code, requestId: 'qa-p2-mock', ...extra }) });
}

/** Every request (method + path regex) the page sends from now on, with its headers and JSON body. */
export function recordRequests(page: Page, method: string, path: RegExp): Request[] {
  const seen: Request[] = [];
  page.on('request', (request) => {
    if (request.method() === method && path.test(new URL(request.url()).pathname)) seen.push(request);
  });
  return seen;
}

/** JSON body of a recorded request. */
export const bodyOf = (request: Request): Json => asRecord(request.postDataJSON() as unknown, `${request.method()} body`);

/**
 * Holds every request matching `match` until `release()`, then lets it through to the real backend (a delay, not a
 * mocked response). `seen` resolves on the first held request.
 */
export async function hold(page: Page, match: (url: URL, method: string) => boolean): Promise<{ readonly seen: Promise<void>; release: () => Promise<void> }> {
  let open: () => void = () => undefined;
  let seenResolve: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => (open = resolve));
  const seen = new Promise<void>((resolve) => (seenResolve = resolve));
  const handler = async (route: Route): Promise<void> => {
    const request = route.request();
    if (!match(new URL(request.url()), request.method())) {
      await route.fallback();
      return;
    }
    seenResolve();
    await gate;
    await route.continue().catch(() => undefined);
  };
  await page.route('**/api/**', handler);
  return {
    seen,
    release: async () => {
      open();
      await page.unroute('**/api/**', handler);
    },
  };
}

/* ---- sessions --------------------------------------------------------------------------------- */

export interface Session {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly log: ApiEntry[];
  /** Bearer API of this session's user (for phase03Seed helpers); disposed by `closeSession`. */
  readonly api: APIRequestContext;
  readonly isAdmin: boolean;
}

/** Refresh body: `accessToken`/`access_token`, optional `data` wrapper (src/lib/auth/refresh.ts:85-100). */
function readAccessToken(json: unknown): string {
  const body = asRecord(json, 'POST /api/auth/refresh');
  const root = typeof body.data === 'object' && body.data !== null ? asRecord(body.data, 'refresh.data') : body;
  const token = typeof root.accessToken === 'string' ? root.accessToken : typeof root.access_token === 'string' ? root.access_token : '';
  if (token === '') throw new Error('POST /api/auth/refresh: no access token in the body');
  return token;
}

/**
 * Browser context of the stored admin (`ADMIN_STORAGE_STATE_FILE`; 0 logins while alive) or of a pool user (1 login),
 * plus a Bearer API context of the same user taken from one refresh in the context's own jar.
 */
export async function openSession(browser: Browser, user: PoolUser | 'admin', viewport: { width: number; height: number } = DESKTOP): Promise<Session> {
  const isAdmin = user === 'admin';
  const context = await browser.newContext({
    baseURL: readBaseUrl(),
    viewport,
    ...(isAdmin && existsSync(ADMIN_STORAGE_STATE_FILE) ? { storageState: ADMIN_STORAGE_STATE_FILE } : {}),
  });
  try {
    if (isAdmin) await ensureAdminSession(context, ADMIN_STORAGE_STATE_FILE);
    else await signInPoolUser(context, user);
    const refreshed = await context.request.post('/api/auth/refresh', { headers: { Origin: readBaseUrl() } });
    expect(refreshed.status(), 'POST /api/auth/refresh (session token)').toBe(200);
    const api = await newApiContext({ Authorization: `Bearer ${readAccessToken(await refreshed.json())}` });
    const page = await context.newPage();
    return { context, page, log: watchApi(page), api, isAdmin };
  } catch (error) {
    await context.close();
    throw error;
  }
}

export async function closeSession(session: Session): Promise<void> {
  if (session.isAdmin) await session.context.storageState({ path: ADMIN_STORAGE_STATE_FILE }).catch(() => undefined);
  await session.api.dispose().catch(() => undefined);
  await session.context.close().catch(() => undefined);
}

/* ---- screen ----------------------------------------------------------------------------------- */

/** Settings loaded: the general tab shows the project name (editable or read-only text). */
export async function openSettings(page: Page, projectId: string, projectName: string): Promise<void> {
  await page.goto(ROUTES.project.settings(projectId));
  await expect(textbox(page, LABEL.name).or(page.getByText(projectName, { exact: true })).first()).toBeVisible({ timeout: 20_000 });
}

/** Picks `tab`: the tablist ≥ 1024 px, the "Nhóm cài đặt" Select below (PS:112-128). */
export async function chooseTab(page: Page, tab: string): Promise<void> {
  const tablist = page.getByRole('tablist', { name: TABS_LABEL, exact: true });
  const select = page.getByRole('combobox', { name: TABS_LABEL, exact: true });
  await expect(tablist.or(select)).toBeVisible();
  if (await tablist.isVisible()) {
    await tablist.getByRole('tab', { name: tab, exact: true }).click();
  } else {
    await select.click();
    await page.getByRole('option', { name: tab, exact: true }).click();
  }
}

/** The other writer: a real N6 PUT on the current revision (BE project_settings/router.py), so the screen's next PUT meets 409. */
export async function writeSettingsElsewhere(api: APIRequestContext, projectId: string, notes: string): Promise<void> {
  const read = await api.get(settingsPath(projectId));
  expect(read.status(), 'the other writer: GET settings').toBe(200);
  const current = asRecord(await read.json(), 'GET settings');
  const written = await api.put(settingsPath(projectId), {
    data: {
      baseVersion: current.revision,
      body: {
        buildingType: current.buildingType,
        lengthUnit: current.lengthUnit,
        snapToleranceMm: current.snapToleranceMm,
        confidenceThreshold: current.confidenceThreshold,
        defaultScaleMmPerPx: current.defaultScaleMmPerPx,
        notes,
      },
    },
  });
  expect(written.status(), 'the other writer: PUT settings').toBe(200);
}

/** Box of `locator` (throws when not laid out). */
export async function boxOf(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error(`no box for ${String(locator)}`);
  return box;
}

/** Border box of an `Input`/`Select` field: the element that carries the 46 / 38 px height (Input.tsx:64-74). */
export const fieldFrame = (control: Locator): Locator => control.locator('xpath=ancestor-or-self::*[contains(@class,"h-[46px]")][1]');
