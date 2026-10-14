/**
 * P9 helpers (phase08_users_edge.spec.ts, SCR-37 read side). Sources: src/screens/admin/UserManagement/* (UM UserManagement.tsx,
 * UMB/UMT UserManagementTable.tsx / UserManagementToolbar.tsx, UMD UserManagementDetail.tsx, UUM useUserManagement.ts,
 * UMG userManagementGateway.ts).
 * // dup-of: users.ts inviteUser / removeUser / recordGets / usersList / foldForSearch (flows-C4 helper list)
 */
import { expect } from '@playwright/test';
import type { APIRequestContext, Locator, Page, Request } from '@playwright/test';

import { signedInApi } from '../api';
import { poolUser, type PoolUser } from '../phase03Seed';
import { adminApi } from './admin';

export type Json = Record<string, unknown>;
export const asRecord = (value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what}: not a JSON object`);
  return value as Json;
};
export const asList = (value: unknown, what: string): Json[] => {
  if (!Array.isArray(value)) throw new Error(`${what}: not a JSON array`);
  return value.map((item, i) => asRecord(item, `${what}[${String(i)}]`));
};
export const str = (record: Json, key: string): string => (typeof record[key] === 'string' ? (record[key] as string) : '');

/** UMG:129-138. */
export const ROLE_LABEL = { admin: 'Quản trị', engineer: 'Kỹ sư', viewer: 'Người xem' } as const;
export const STATUS_LABEL = { active: 'Đang hoạt động', pending: 'Chờ chấp nhận', disabled: 'Đã vô hiệu hoá' } as const;
/** UMG:171-179 × PERM:49-86. */
export const MATRIX: ReadonlyArray<{ readonly label: string; readonly admin: boolean; readonly engineer: boolean; readonly viewer: boolean }> = [
  { label: 'Tải bản vẽ', admin: true, engineer: true, viewer: false },
  { label: 'Sửa hình học', admin: true, engineer: true, viewer: false },
  { label: 'Duyệt QC', admin: true, engineer: true, viewer: false },
  { label: 'Đổi bộ luật', admin: true, engineer: false, viewer: false },
  { label: 'Xuất', admin: true, engineer: true, viewer: false },
  { label: 'Chia sẻ', admin: true, engineer: true, viewer: false },
  { label: 'Quản lý người dùng', admin: true, engineer: false, viewer: false },
];
const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);
/** UMG:192-194 permissionCellSrLabel. */
export const cellSr = (role: keyof typeof ROLE_LABEL, row: string, allowed: boolean): string =>
  `${lowerFirst(ROLE_LABEL[role])}: ${allowed ? 'được phép' : 'không được phép'} ${lowerFirst(row)}`;
export const ALL_CELLS: readonly string[] = MATRIX.flatMap((row) => (['admin', 'engineer', 'viewer'] as const).map((role) => cellSr(role, row.label, row[role])));

export const USR = {
  search: 'Tìm người dùng', // UMT:26
  role: 'Vai', // UMT:28
  status: 'Trạng thái', // UMT:29
  invite: 'Mời người dùng', // UMT:31
  summaryUsers: 'Người dùng', // UMT:39
  summaryAdmins: 'Quản trị', // UMT:40
  summaryPending: 'Lời mời đang chờ', // UMT:41
  matrixButton: 'Xem ma trận quyền', // UM:50
  matrixTitle: 'Ma trận quyền theo vai trò', // UM:51
  matrixClose: 'Đóng hộp thoại', // components/overlay/Modal.tsx:187
  errorTitle: 'Không tải được danh sách người dùng', // UM:55
  retry: 'Thử lại', // UM:57
  noMatchTitle: 'Không tìm thấy người dùng', // UMB:39
  noMatchBody: 'Không ai khớp với từ khoá hoặc bộ lọc đang chọn.', // UMB:40
  clearSearch: 'Xoá tìm kiếm và bộ lọc', // UMB:42
  disable: 'Vô hiệu hoá', // UMB:45
  remove: 'Xoá', // UMB:47
  resend: 'Gửi lại', // UMT:44 (UserManagementTable.tsx:44)
  expired: 'Lời mời đã hết hạn', // UMB:114-132 (UserManagementTable.tsx:114)
  never: 'Chưa hoạt động lần nào', // UUM:322-329
  detail: 'Chi tiết người dùng', // UMD:370
  closeDetail: 'Đóng chi tiết người dùng', // UMD:106
  memberships: 'Dự án tham gia', // UMD:135
  noMemberships: 'Người này chưa tham gia dự án nào', // UMD:139
  membershipBlocked: 'Vai trong từng dự án theo vai của hệ thống; hệ thống chưa có đường đổi riêng cho một dự án', // UMG:350-351
  activity: 'Hoạt động gần đây', // UMD:198
  noActivity: 'Chưa có hoạt động nào', // UMD:202
  removeSection: 'Xoá người dùng', // UMD:231
  removeSectionText: 'Xoá hẳn người dùng này khỏi hệ thống.', // UMD:234
  backLabel: 'Về bảng điều khiển', // UUM:135
  forbidden: 'Vai của bạn chưa quản lý được người dùng nên danh sách tài khoản không hiện; bảng dưới đây cho biết mỗi vai làm được những việc gì', // UUM:140-141
  lastAdmin: 'Đây là quản trị cuối cùng, hệ thống cần ít nhất một người giữ vai này', // UUM:139
  invitedKind: 'Mời người dùng', // ACTIVITY_KIND_LABELS 'user.invite' (UUM:~200)
} as const;

export const TIMESTAMP_RE = /\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/u;

/** UUM:351-358 foldForSearch: strip diacritics, đ → d, lower-case. */
export const foldForSearch = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/đ/gu, 'd')
    .replace(/Đ/gu, 'D')
    .toLowerCase();

export interface Seed37U {
  readonly seed: APIRequestContext;
  readonly pe: PoolUser; // p08-eng, read only
  readonly pv: PoolUser; // p08-view, read only
  readonly adm: PoolUser; // p08-37U-adm: sends every invitation of this file
  readonly admApi: APIRequestContext;
  readonly dispose: () => Promise<void>;
}

/** Shared read-only engineer/viewer (S2 decision 1) + the file's own inviting admin (S2 decision 2). */
export async function seed37U(): Promise<Seed37U> {
  const seed = await adminApi();
  try {
    const pe = await poolUser(seed, 'engineer', 'p08-eng');
    const pv = await poolUser(seed, 'viewer', 'p08-view');
    const adm = await poolUser(seed, 'admin', 'p08-37U-adm');
    const admApi = await signedInApi(adm.email, adm.password);
    return {
      seed,
      pe,
      pv,
      adm,
      admApi,
      dispose: async () => {
        await admApi.dispose();
        await seed.dispose();
      },
    };
  } catch (error) {
    await seed.dispose();
    throw error;
  }
}

/** `POST /api/users/invitations` (UMG; BE users/router.py:55) → the pending record of `email`. */
export async function inviteUser(api: APIRequestContext, email: string, role: 'viewer' | 'engineer' = 'viewer'): Promise<Json> {
  const sent = await api.post('/api/users/invitations', { data: { emails: [email], role } });
  expect(sent.status(), `setup: POST /api/users/invitations: ${(await sent.text()).slice(0, 200)}`).toBe(201);
  const user = asList(await sent.json(), 'invitations').find((u) => u.email === email);
  if (user === undefined) throw new Error('setup: the invitation response has no row for the invited address');
  return user;
}

/** `DELETE /api/users/:id {userId, confirmEmail}`; 200 / 404 fine, anything else returned (never thrown) for the `finally`. */
export async function removeUser(api: APIRequestContext, id: string, email: string): Promise<string | null> {
  const res = await api.delete(`/api/users/${id}`, { data: { userId: id, confirmEmail: email } });
  return res.status() === 200 || res.status() === 404 ? null : `DELETE /api/users/${id} → ${String(res.status())}`;
}

/** Drops every Mailpit mail sent to `address` (the invitation). */
export async function sweepMails(address: string): Promise<void> {
  const base = (process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025').replace(/\/+$/u, '');
  const found = (await (await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}&limit=100`)).json()) as { messages?: Array<{ ID: string }> };
  const ids = (found.messages ?? []).map((m) => m.ID);
  if (ids.length === 0) return;
  await fetch(`${base}/api/v1/messages`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ IDs: ids }) });
}

/** `GET /api/users` as `api` → `users`. */
export async function listUsersApi(api: APIRequestContext): Promise<Json[]> {
  const res = await api.get('/api/users');
  expect(res.status(), 'setup: GET /api/users').toBe(200);
  return asList(asRecord(await res.json(), 'GET /api/users').users, 'users');
}

/** Records every `GET /api/users*` request (path only) from now on. Register BEFORE goto. */
export function recordGets(page: Page): { readonly list: () => string[]; readonly stop: () => void } {
  const seen: string[] = [];
  const onRequest = (req: Request): void => {
    const path = new URL(req.url()).pathname;
    if (req.method() === 'GET' && (path === '/api/users' || path.startsWith('/api/users/'))) seen.push(path);
  };
  page.on('request', onRequest);
  return { list: () => [...seen], stop: () => page.off('request', onRequest) };
}

/** Next 200 GET of exact `path`. Register BEFORE the action. */
export const waitGet = (page: Page, path: string): Promise<unknown> =>
  page
    .waitForResponse((r) => r.request().method() === 'GET' && new URL(r.url()).pathname === path && r.status() === 200)
    .then((r) => r.json() as Promise<unknown>);

export const userRow = (page: Page, email: string): Locator => page.locator('tbody tr').filter({ hasText: email });
export const nameButton = (row: Locator): Locator => row.getByRole('button').first(); // UMB:305-311
export const summary = (page: Page): Locator => page.locator('dl').filter({ hasText: USR.summaryPending }); // UMT:97-110
export const figure = (scope: Locator, caption: string): Locator =>
  scope.locator('div').filter({ has: scope.page().locator('dt', { hasText: new RegExp(`^\\s*${caption}\\s*$`, 'u') }) }).locator('dd');

export async function pickOption(page: Page, combobox: Locator, option: string): Promise<void> {
  await combobox.click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
