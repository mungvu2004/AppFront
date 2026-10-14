/**
 * Phase 11 · session-b edge (pack P11): FL-11U-04 (hard delete + consequences), FL-11U-05 (self protection + password
 * change revokes other sessions), FL-11U-06 / FL-11U-07 (non-admin roles cannot manage users).
 * Every destructive step targets a user invited by the flow itself (never the shared admin / pool users); each flow runs in
 * NEW browser sessions and disposes its throw-away users in `finally`. Source refs: UMH = useUserManagement.ts,
 * UMD = UserManagementDetail.tsx, UMT = UserManagementTable.tsx, UM = UserManagement.tsx (src/screens/admin/UserManagement).
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { signedInApi } from './support/api';
import { captureEvidence } from './support/evidence';
import { DESKTOP, p11Slot } from './support/p11/common';
import { adminApi, disposeFreshUser, inviteFreshUser, recordWrites, refreshWithCookieOf, runCleanups, signInAdminFresh, signInFresh } from './support/p11/P11';
import { poolUser, signInPoolUser, type PoolUser } from './support/phase03Seed';

test.use({ viewport: DESKTOP });

const FORBIDDEN =
  'Vai của bạn chưa quản lý được người dùng nên danh sách tài khoản không hiện; bảng dưới đây cho biết mỗi vai làm được những việc gì'; // UMH:140-141
const SELF_BLOCKED = 'Bạn không thể tự vô hiệu hoá tài khoản của mình'; // UMH:138
const SESSION_ENDED = 'Phiên đăng nhập đã kết thúc. Hãy đăng nhập lại.'; // vi.json auth.notices.sessionEnded:200
const PW_CHANGED = 'Đã đổi mật khẩu. Các phiên đăng nhập khác đã bị đăng xuất.'; // UAA:86

/** Opens `/admin/users`, filters by `email` ("Tìm người dùng", toolbar) and returns the row of that user. */
async function userRow(page: Page, email: string) {
  await page.goto('/admin/users');
  await page.getByLabel('Tìm người dùng', { exact: true }).fill(email);
  const row = page.getByRole('row').filter({ hasText: email });
  await expect(row).toHaveCount(1);
  return row;
}

const shot = (page: Page, id: string, slug: string) => captureEvidence(page, `E11_${id}_${slug}.png`);

async function closeAll(contexts: BrowserContext[]): Promise<void> {
  for (const context of contexts) await context.close();
}

test.describe('phase 11 · session-b edge', () => {
  test('SCR-37 · FL-11U-04 · admin · xoá hẳn thật + hậu quả', async ({ browser }) => {
    test.setTimeout(300_000);
    const admin = await adminApi();
    const contexts: BrowserContext[] = [];
    const fu4 = await inviteFreshUser(admin, 'engineer', 'del');
    try {
      const ctx4 = await signInFresh(browser, fu4);
      contexts.push(ctx4);
      const page4 = await ctx4.newPage();
      await page4.goto('/');
      const adminCtx = await signInAdminFresh(browser);
      contexts.push(adminCtx);
      const page = await adminCtx.newPage();
      const writes = recordWrites(page);
      const row = await userRow(page, fu4.email);
      await row.getByRole('button', { name: fu4.name, exact: true }).click(); // UMT select -> detail panel
      const removeSection = page.getByRole('region', { name: 'Xoá người dùng' }); // UMD:223 section aria-label
      const dialog = page.getByRole('dialog', { name: `Xoá hẳn ${fu4.name}?` });
      const deletePath = `/api/users/${fu4.id}`;

      await test.step('[11U-A-110] mở hộp xoá từ panel chi tiết', async () => {
        await removeSection.getByRole('button', { name: 'Xoá', exact: true }).click(); // UMD:225-239
        await expect(dialog).toBeVisible();
        await shot(page, '11U-A-110', 'remove_dialog');
      });

      await test.step('[11U-C-137] bấm đúp xác nhận chỉ gửi MỘT DELETE', async () => {
        await dialog.getByLabel('Địa chỉ thư', { exact: true }).fill(fu4.email);
        const confirm = dialog.getByRole('button', { name: 'Xác nhận xoá vĩnh viễn', exact: true });
        await expect(confirm).toBeEnabled();
        const deleted = page.waitForResponse((r) => r.request().method() === 'DELETE' && new URL(r.url()).pathname === deletePath);
        await confirm.dblclick(); // UMH:951-953 canConfirm has !isPending
        expect((await deleted).status()).toBe(200);
        await expect(dialog).toBeHidden(); // sure marker before reading the log
        expect.soft(writes.list().filter((w) => w === `DELETE ${deletePath}`)).toHaveLength(1);
        await shot(page, '11U-C-137', 'double_click_one_delete');
      });

      await test.step('[11U-A-111] hộp đóng, hàng biến', async () => {
        await expect(dialog).toBeHidden();
        await expect.soft(page.getByRole('row').filter({ hasText: fu4.email })).toHaveCount(0);
        await shot(page, '11U-A-111', 'row_gone');
      });

      await test.step('[11U-A-112] toast xoá, không có Hoàn tác', async () => {
        await expect.soft(page.getByText('Đã xoá tài khoản', { exact: true })).toBeVisible(); // UMH:162,1167
        await expect.soft(page.getByText(fu4.email, { exact: true })).toBeVisible(); // description = email
        await expect.soft(page.getByRole('button', { name: /Hoàn tác/u })).toHaveCount(0);
        await shot(page, '11U-A-112', 'toast_no_undo');
      });

      await test.step('[11U-B-123] panel chi tiết đóng', async () => {
        await expect.soft(removeSection).toHaveCount(0); // UMH:1165 setSelectedUserId(null)
        await shot(page, '11U-B-123', 'detail_closed');
      });

      await test.step('[11U-A-115] memberships 404, danh sách không còn email', async () => {
        const memberships = await admin.get(`/api/users/${fu4.id}/memberships`);
        expect.soft(memberships.status()).toBe(404);
        expect.soft(await memberships.text()).toContain('NOT_FOUND'); // US:92-95
        const list = (await (await admin.get('/api/users')).json()) as { users: { email: string }[] };
        expect.soft(list.users.map((u) => u.email)).not.toContain(fu4.email);
        await shot(page, '11U-A-115', 'gone_in_api');
      });

      await test.step('[11U-A-114] phiên đang mở của người đã xoá chết', async () => {
        // oracle: sessions.py:449-453 (/api/me without Bearer is always 401, routing.py:130-133: not evidence)
        expect.soft(await refreshWithCookieOf(ctx4)).toEqual({ status: 401, code: 'SESSION_REVOKED' });
        await page4.goto('/');
        await expect.soft(page4).toHaveURL(/\/login/u);
        await shot(page4, '11U-A-114', 'deleted_session_login');
      });

      await test.step('[11U-A-113] đăng nhập lại bị từ chối như sai thông tin', async () => {
        const anon = await browser.newContext({ viewport: DESKTOP });
        contexts.push(anon);
        const login = await anon.newPage();
        await login.goto('/login');
        await login.getByLabel('Thư điện tử', { exact: true }).fill(fu4.email);
        await login.getByLabel('Mật khẩu', { exact: true }).fill(fu4.password);
        const attempt = login.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/auth/login');
        await login.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
        expect.soft((await attempt).status()).toBe(401);
        await expect.soft(login.getByText('Sai thư điện tử hoặc mật khẩu')).toBeVisible(); // vi.json:148
        await shot(login, '11U-A-113', 'login_rejected');
      });
      writes.stop();
    } finally {
      await runCleanups([() => closeAll(contexts), () => disposeFreshUser(admin, fu4, true), () => admin.dispose()]);
    }
  });

  test('SCR-37/SCR-33 · FL-11U-05 · admin tươi · tự xoá bị từ chối, tài khoản', async ({ browser }) => {
    test.setTimeout(300_000);
    const admin = await adminApi();
    const contexts: BrowserContext[] = [];
    const fa: PoolUser = await inviteFreshUser(admin, 'admin', 'self');
    try {
      const ctx5 = await signInFresh(browser, fa);
      const ctx5b = await signInFresh(browser, fa);
      contexts.push(ctx5, ctx5b);
      const page5b = await ctx5b.newPage();
      await page5b.goto('/');
      const page = await ctx5.newPage();
      let currentPassword = fa.password;

      await test.step('[11U-C-138] hàng của mình: câu chặn, không nút Vô hiệu hoá', async () => {
        const row = await userRow(page, fa.email);
        await expect(row.getByText(SELF_BLOCKED, { exact: true })).toBeVisible(); // UMH:138,307
        await expect(row.getByRole('button', { name: 'Vô hiệu hoá', exact: true })).toHaveCount(0);
        await shot(page, '11U-C-138', 'self_disable_blocked');
      });

      await test.step('[11U-A-201] /tai-khoan không có khối Phiên đăng nhập', async () => {
        await page.goto('/tai-khoan');
        await expect(page.getByRole('heading', { level: 1, name: 'Cài đặt tài khoản', exact: true })).toBeVisible(); // AS:104
        await expect.soft(page.getByText('Phiên đăng nhập', { exact: true })).toHaveCount(0); // AS:161-165
        await shot(page, '11U-A-201', 'no_sessions_block');
      });

      await test.step('[11U-A-202] không có Vùng nguy hiểm / Xoá tài khoản', async () => {
        await expect(page.getByRole('heading', { level: 1, name: 'Cài đặt tài khoản', exact: true })).toBeVisible();
        await expect.soft(page.getByText('Vùng nguy hiểm', { exact: true })).toHaveCount(0); // AS:172-176
        await expect.soft(page.getByText('Xoá tài khoản', { exact: true })).toHaveCount(0);
        await shot(page, '11U-A-202', 'no_danger_zone');
      });

      await test.step('[11U-A-207] đổi mật khẩu thu hồi phiên khác', async () => {
        const next = `Qa-${randomUUID()}`;
        await page.getByLabel('Mật khẩu hiện tại', { exact: true }).fill(currentPassword);
        await page.getByLabel('Mật khẩu mới', { exact: true }).fill(next);
        await page.getByLabel('Nhắc lại mật khẩu mới', { exact: true }).fill(next);
        const changed = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/me/password');
        await page.getByRole('button', { name: 'Đổi mật khẩu', exact: true }).click();
        expect((await changed).status()).toBe(204);
        currentPassword = next;
        await expect.soft(page.getByText(PW_CHANGED, { exact: true })).toBeVisible(); // UAA:86
        // oracle: sessions.py:449-453, users/service.py:211-217 (revoke_sessions except current)
        expect.soft(await refreshWithCookieOf(ctx5b)).toEqual({ status: 401, code: 'SESSION_REVOKED' });
        await shot(page, '11U-A-207', 'password_changed');
      });

      await test.step('[11U-A-208] ngữ cảnh thứ hai về /login, ngữ cảnh đổi còn phiên', async () => {
        await page5b.goto('/'); // same oracle as P10 (phase11_session_edge)
        await expect.soft(page5b).toHaveURL(/\/login/u);
        await expect.soft(page5b.getByText(SESSION_ENDED, { exact: true })).toBeVisible();
        expect.soft((await refreshWithCookieOf(ctx5)).status).toBe(200); // live control session
        await shot(page5b, '11U-A-208', 'revoked_session_login');
      });

      await test.step('[11U-C-139] ⚑ tự xoá: FE nên chặn, BE từ chối, tài khoản còn', async () => {
        const row = await userRow(page, fa.email);
        // Correct behaviour (red while UMH:337 only blocks lastAdmin): no 'Xoá' button on one's own row.
        // UNKNOWN — NEED VERIFICATION: exact wording of the self-delete reason; only the missing button is asserted.
        await expect.soft(row.getByRole('button', { name: 'Xoá', exact: true })).toHaveCount(0);
        await shot(page, '11U-C-139', 'self_delete_row');
        const own = await signedInApi(fa.email, currentPassword);
        try {
          const res = await own.delete(`/api/users/${fa.id}`, { data: { userId: fa.id, confirmEmail: fa.email } });
          expect(res.status()).toBe(422); // US:148-156 forbid_self (>= 2 admins)
          // oracle: users/errors.py:5; 422 needs >= 2 active admins (shared phase admin + fa)
          expect(((await res.json()) as { code?: unknown }).code).toBe('USER_SELF_MODIFICATION');
        } finally {
          await own.dispose();
        }
        expect((await admin.get(`/api/users/${fa.id}/memberships`)).status()).toBe(200);
      });
    } finally {
      await runCleanups([() => closeAll(contexts), () => disposeFreshUser(admin, fa), () => admin.dispose()]);
    }
  });

  test('SCR-37/SCR-38 · FL-11U-06 · engineer · không quản trị được người dùng', async ({ browser }) => {
    const admin = await adminApi();
    const context = await browser.newContext({ viewport: DESKTOP });
    try {
      const pu = await poolUser(admin, 'engineer', p11Slot('session-b'));
      await signInPoolUser(context, pu);
      const page = await context.newPage();

      await test.step('[11U-D-151] /admin/users: trạng thái forbidden', async () => {
        await page.goto('/admin/users');
        await expect(page.getByText(FORBIDDEN, { exact: true })).toBeVisible(); // UMH:140
        await expect(page.getByRole('button', { name: 'Vô hiệu hoá', exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Xoá', exact: true })).toHaveCount(0);
        await shot(page, '11U-D-151', 'engineer_forbidden');
      });

      await test.step('[11U-D-312] /khong-co-quyen: hai nút hiện và bật', async () => {
        await page.goto('/khong-co-quyen');
        await expect.soft(page.getByRole('button', { name: 'Về danh sách dự án', exact: true })).toBeEnabled(); // AD:108-109
        await expect.soft(page.getByRole('button', { name: 'Đăng nhập bằng tài khoản khác', exact: true })).toBeEnabled();
        await shot(page, '11U-D-312', 'engineer_access_denied');
      });
    } finally {
      await runCleanups([() => context.close(), () => admin.dispose()]);
    }
  });

  test('SCR-37 · FL-11U-07 · viewer · không quản trị được người dùng', async ({ browser }) => {
    const admin = await adminApi();
    const context = await browser.newContext({ viewport: DESKTOP });
    try {
      const pu = await poolUser(admin, 'viewer', p11Slot('session-b'));
      await signInPoolUser(context, pu);
      const page = await context.newPage();

      await test.step('[11U-D-152] /admin/users: cùng trạng thái forbidden', async () => {
        await page.goto('/admin/users');
        await expect(page.getByText(FORBIDDEN, { exact: true })).toBeVisible(); // UMH:140
        await expect(page.getByRole('button', { name: 'Vô hiệu hoá', exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Xoá', exact: true })).toHaveCount(0);
        await shot(page, '11U-D-152', 'viewer_forbidden');
      });
    } finally {
      await runCleanups([() => context.close(), () => admin.dispose()]);
    }
  });
});
