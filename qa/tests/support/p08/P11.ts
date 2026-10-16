/**
 * P11 helpers for phase08_users_write_edge.spec.ts (SCR-37 write). Sources: UM UserManagement.tsx, UMT ...Toolbar.tsx,
 * UMB ...Table.tsx, UMD ...Detail.tsx, UUM useUserManagement.ts (all under src/screens/admin/UserManagement/),
 * errors from src/i18n/vi.json (errors.notFound / errors.validation) via src/lib/errors/describeError.ts.
 */
import { expect } from '@playwright/test';
import type { APIRequestContext, Browser, BrowserContext, Locator, Page, Request } from '@playwright/test';

import { waitForApiWhere } from '../../../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../../../e2e/fullstack/env';
import { attachJson } from '../evidence';
import { signInPoolUser, type PoolUser } from './pool';
import { DESKTOP, ROUTES } from './admin';
import { pickOption, type Json } from './users';

/**
 * E-step evidence (shared by users_write edge + mocked_edge): what the screen exposes right now, attached as JSON BEFORE the
 * expect so it survives a failure. `id` e.g. `E08_37W-E-006-after`; `extra` = request log / values the caller holds.
 */
export async function snap(page: Page, id: string, extra: Record<string, unknown> = {}): Promise<void> {
  const state = await page.evaluate(() => {
    const text = (e: Element): string => (e.textContent ?? '').trim().slice(0, 160);
    const a = document.activeElement;
    return {
      activeElement: a ? `${a.tagName.toLowerCase()} role=${a.getAttribute('role') ?? ''} label=${a.getAttribute('aria-label') ?? ''} text=${text(a).slice(0, 40)}` : null,
      expanded: [...document.querySelectorAll('[aria-expanded="true"]')].map((e) => e.getAttribute('aria-label') ?? text(e).slice(0, 40)),
      options: [...document.querySelectorAll('[role="option"]')].map(text),
      toasts: [...document.querySelectorAll('[role="status"]')].map(text),
      dialogs: document.querySelectorAll('[role="dialog"]').length,
      firstRows: [...document.querySelectorAll('tbody tr')].slice(0, 6).map((r) => text(r).slice(0, 80)),
    };
  });
  await attachJson(`${id}_users_write.json`, { url: page.url(), ...state, ...extra });
}

export const USERS = '/api/users';
export const INVITATIONS = '/api/users/invitations';
export const re = (path: string): RegExp => new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}$`, 'u');

export const T = {
  search: 'Tìm người dùng', // UMT:26
  invite: 'Mời người dùng', // UMT:31
  inviteRole: 'Vai cho lời mời', // UMT:32
  inviteEmails: 'Email người được mời', // UMT:33
  inviteSubmit: 'Gửi lời mời', // UMT:35
  inviteCancel: 'Huỷ', // UMT:36
  summaryPending: 'Lời mời đang chờ', // UMT:41
  needsEmail: 'Nhập ít nhất một địa chỉ thư để gửi lời mời', // UUM:147
  fixInvalid: 'Sửa địa chỉ chưa đúng dạng rồi mới gửi được', // UUM:148
  invalidLine: (bad: string): string => `Chưa đúng dạng địa chỉ thư: ${bad}. Viết theo dạng ten@congty.vn`, // UUM:145-146
  blockedReasonId: 'user-invite-submit-blocked-reason', // UMT:140
  validChip: (n: number): string => `${String(n)} địa chỉ hợp lệ`, // UMT:124-128
  disable: 'Vô hiệu hoá',
  enable: 'Bật lại',
  remove: 'Xoá',
  resend: 'Gửi lại', // UMB RESEND_INVITE_LABEL
  expired: 'Lời mời đã hết hạn', // UMB INVITE_EXPIRED_LABEL
  undo: 'Hoàn tác',
  removeWarning: 'Xoá hẳn gỡ luôn phần ghi công của người này trong lịch sử và không hoàn tác được; gõ đúng địa chỉ thư của họ để xác nhận', // UUM:150
  removeEmailLabel: 'Địa chỉ thư', // UMD:264
  removeLater: 'Để sau',
  removeConfirm: 'Xác nhận xoá vĩnh viễn',
  removeSection: 'Xoá người dùng', // UMD:231
  detail: 'Chi tiết người dùng', // UMD:370
  forbidden: 'Vai của bạn chưa quản lý được người dùng nên danh sách tài khoản không hiện; bảng dưới đây cho biết mỗi vai làm được những việc gì', // UUM:140
  membershipBlocked: 'Vai trong từng dự án theo vai của hệ thống; hệ thống chưa có đường đổi riêng cho một dự án', // UMG:350
  invitedTitle: 'Đã gửi lời mời',
  inviteFailedTitle: 'Không gửi được lời mời',
  resentTitle: 'Đã gửi lại lời mời',
  resendFailedTitle: 'Không gửi lại được lời mời',
  roleChanged: 'Đã đổi vai',
  roleFailed: 'Không đổi được vai',
  disabledTitle: 'Đã vô hiệu hoá tài khoản',
  enabledTitle: 'Đã bật lại tài khoản',
  removedTitle: 'Đã xoá tài khoản',
  notFoundDesc: 'Nội dung này có thể đã bị xoá, hoặc đường dẫn chưa đúng.', // vi.json errors.notFound.description
  toViewerLost: 'Người xem — Vai mới không còn: Tải bản vẽ, Sửa hình học, Duyệt QC, Xuất, Chia sẻ', // UMG:226 on permissions.ts:64-88
  toAdmin: 'Quản trị — Vai mới giữ nguyên mọi việc họ đang làm được', // UUM:154,812
} as const;
export const ROLE = { admin: 'Quản trị', engineer: 'Kỹ sư', viewer: 'Người xem' } as const;
export const STATUS = { active: 'Đang hoạt động', pending: 'Chờ chấp nhận', disabled: 'Đã vô hiệu hoá' } as const;

export { type Json };
export const asList = (v: unknown): Json[] => (Array.isArray(v) ? (v as Json[]) : []);
export const str = (r: Json | undefined, k: string): string => (typeof r?.[k] === 'string' ? (r[k] as string) : '');

export const toast = (page: Page, text: string): Locator => page.getByRole('status').filter({ hasText: text });
export const userRow = (page: Page, email: string): Locator => page.getByRole('row').filter({ hasText: email });
export const inviteBox = (page: Page): Locator => page.getByRole('textbox', { name: T.inviteEmails });
export const inviteSubmit = (page: Page): Locator => page.getByRole('button', { name: T.inviteSubmit, exact: true });
export const openInviteButton = (page: Page): Locator => page.getByRole('button', { name: T.invite, exact: true });
export const detailAside = (page: Page): Locator => page.locator(`aside[aria-label="${T.detail}"]`);

export { pickOption };

/** Own slot, fixed; a suffix only on retry (brief policy). */
export const slot = (base: string, retry: number): string => `${base}${retry ? `-r${String(retry)}` : ''}`;

/** Browser session of `user` (1 login). Caller closes the context. */
export async function sessionOf(browser: Browser, user: PoolUser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport: DESKTOP });
  const page = await context.newPage();
  await signInPoolUser(context, user);
  return { context, page };
}

/** goto /admin/users and wait for the real GET /api/users (200); returns its users. */
export async function openUsers(page: Page): Promise<Json[]> {
  const list = waitForApiWhere(page, (r) => r.request().method() === 'GET' && new URL(r.url()).pathname === USERS && r.status() === 200, undefined, 'GET /api/users');
  await page.goto(ROUTES.users);
  const body = (await list).json as { users?: unknown };
  await expect(page.getByLabel(T.search, { exact: true })).toBeVisible();
  return asList(body.users);
}

/** recordWrites: every non-GET /api/users* request with its body (listener only, no mock) + count of GET /api/users list reads. */
export function recordWrites(page: Page): { writes: () => string[]; bodies: () => unknown[]; listReads: () => number; stop: () => void } {
  const w: string[] = [];
  const b: unknown[] = [];
  let reads = 0;
  const on = (req: Request): void => {
    const p = new URL(req.url()).pathname;
    if (!p.startsWith(USERS)) return;
    if (req.method() === 'GET') {
      if (p === USERS) reads += 1;
      return;
    }
    w.push(`${req.method()} ${p}`);
    b.push(req.postDataJSON() as unknown);
  };
  page.on('request', on);
  return { writes: () => [...w], bodies: () => [...b], listReads: () => reads, stop: () => page.off('request', on) };
}

/** Next response of `method` on exactly `path`, any of `statuses`. Register BEFORE the action. */
export const nextResponse = (page: Page, method: string, path: RegExp, statuses: readonly number[]): ReturnType<typeof waitForApiWhere> =>
  waitForApiWhere(page, (r) => r.request().method() === method && path.test(new URL(r.url()).pathname) && statuses.includes(r.status()), undefined, `${method} ${path.source}`);

export const nextListRead = (page: Page): ReturnType<typeof waitForApiWhere> => nextResponse(page, 'GET', re(USERS), [200]);

/** Admin API calls for setup / cleanup only. 404 on delete = already gone. */
export async function deleteUser(api: APIRequestContext, id: string, email: string): Promise<void> {
  const res = await api.delete(`${USERS}/${id}`, { data: { userId: id, confirmEmail: email } });
  expect([200, 404], `cleanup DELETE ${USERS}/${id}`).toContain(res.status());
}
export async function findUserId(api: APIRequestContext, email: string): Promise<string | undefined> {
  const res = await api.get(USERS);
  expect(res.status(), 'GET /api/users (cleanup lookup)').toBe(200);
  return str(asList(((await res.json()) as { users?: unknown }).users).find((u) => u.email === email), 'id') || undefined;
}
export async function inviteApi(api: APIRequestContext, email: string, role: 'engineer' | 'viewer'): Promise<Json> {
  const res = await api.post(INVITATIONS, { data: { emails: [email], role } });
  expect(res.status(), `setup: POST ${INVITATIONS}`).toBe(201);
  const row = asList(await res.json()).find((u) => u.email === email);
  if (row === undefined) throw new Error('setup: invitation answer has no row for the address');
  return row;
}
export async function patchRole(api: APIRequestContext, id: string, role: string): Promise<void> {
  const res = await api.patch(`${USERS}/${id}/role`, { data: { role, userId: id } });
  expect(res.status(), `restore PATCH role ${role}`).toBe(200);
}
export async function enableApi(api: APIRequestContext, id: string): Promise<void> {
  const res = await api.post(`${USERS}/${id}/enable`, { data: {} }); // EmptyBody required (users/router.py:104)
  expect(res.status(), 'restore POST enable').toBe(200);
}
