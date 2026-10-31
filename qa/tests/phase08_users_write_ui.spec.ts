/**
 * Phase 08 SCR-37 User Management - write-screen UI flows FL-37W-U1..U3 (flows-C5). `verifyUi` at 1920/1440/1024/768.
 * Budget: 1 admin seed API login (pool), pool admin `p08-37W-adm` (Decision S2 #2): 1 API login + 3 UI sessions (1 per test),
 * 1 invitation sent through the UI in FL-37W-U2 (<= 12 per run), nothing sent in U1 (panel only filled).
 * State changes: PU1 = `p08-37W-u1` (engineer -> viewer -> engineer, restored in `finally` via PATCH). Cleanup: DELETE the invitee.
 * FL-37W-U3 pairs with the real FL-37W-04/06 (step 1 real, step 2 [mocked response] list of one admin).
 */
import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

import { adminApi } from './support/p08/admin';
import { asPoolUser, longEmail, openUsersList, pickOption, poolAdminApi, removeUser, userRow, verifyDesktop } from './support/p08/P4';
import { testEmail } from './support/evidence';
import { deleteMails, waitForMail } from './support/mailpit';
import { poolUser, type PoolUser } from './support/p08/pool';

const U = {
  invite: 'Mời người dùng', // UMT:31
  inviteEmails: 'Email người được mời', // UMT:33
  inviteRole: 'Vai cho lời mời', // UMT:32
  submit: 'Gửi lời mời', // UMT:35
  needsEmail: 'Nhập ít nhất một địa chỉ thư để gửi lời mời', // UUM:147
  fixInvalid: 'Sửa địa chỉ chưa đúng dạng rồi mới gửi được', // UUM:148
  invalidLine: (bad: string): string => `Chưa đúng dạng địa chỉ thư: ${bad}. Viết theo dạng ten@congty.vn`, // UUM:145-146
  search: 'Tìm người dùng',
  pending: 'Chờ chấp nhận',
  remove: 'Xoá',
  roleChanged: 'Đã đổi vai', // UUM:153
  lastAdmin: 'Đây là quản trị cuối cùng, hệ thống cần ít nhất một người giữ vai này', // UUM:139
  selfRole: 'Bạn không thể tự đổi vai của mình',
  selfDisable: 'Bạn không thể tự vô hiệu hoá tài khoản của mình',
} as const;
const USERS_RE = /^\/api\/users$/u;

test.describe('SCR-37 users write UI', () => {
  let adminPool: PoolUser;
  let adminPoolApi: APIRequestContext;
  let pu1: PoolUser;

  test.beforeAll(async () => {
    const seed = await adminApi();
    try {
      const made = await poolAdminApi(seed, 'p08-37W-adm');
      adminPool = made.user;
      adminPoolApi = made.api;
      pu1 = await poolUser(seed, 'engineer', `p08-37W-u1${test.info().retry ? `-r${test.info().retry}` : ''}`);
    } finally {
      await seed.dispose();
    }
  });

  test.afterAll(async () => {
    await adminPoolApi.dispose();
  });

  const setRole = async (role: 'engineer' | 'viewer'): Promise<void> => {
    const res = await adminPoolApi.patch(`/api/users/${pu1.id}/role`, { data: { role, userId: pu1.id } });
    expect(res.status(), `PATCH role ${role}`).toBe(200);
  };

  test('SCR-37 · FL-37W-U1 · Khối mời: rỗng, địa chỉ sai, 3 hợp lệ', async ({ browser }) => {
    test.setTimeout(150_000);
    await asPoolUser(browser, adminPool, async (page) => {
      const posts: string[] = [];
      page.on('request', (r) => {
        if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/users/invitations') posts.push(r.url());
      });
      const openPanel = async (p: Page): Promise<void> => {
        await openUsersList(p);
        await p.getByRole('button', { name: U.invite, exact: true }).click();
        await expect(p.getByLabel(U.inviteEmails, { exact: true })).toBeVisible();
      };

      await test.step('[37W-F-001] khối mời rỗng: lý do khoá hiện', async () => {
        await verifyDesktop(page, 'U08_37W-F-001_users_write', async (p) => {
          await openPanel(p);
          await expect.soft(p.getByRole('button', { name: U.submit, exact: true })).toBeDisabled();
          await expect.soft(p.getByText(U.needsEmail, { exact: true })).toBeVisible();
        });
      });

      await test.step('[37W-F-002] địa chỉ sai dài + lỗi', async () => {
        const bad = `${'x'.repeat(120)}-khong-hop-le`;
        await verifyDesktop(page, 'U08_37W-F-002_users_write', async (p) => {
          await openPanel(p);
          await p.getByLabel(U.inviteEmails, { exact: true }).fill(bad);
          await expect(p.getByText(U.invalidLine(bad), { exact: true })).toBeVisible();
          await expect.soft(p.getByText(U.fixInvalid, { exact: true })).toBeVisible();
          await expect.soft(p.getByRole('button', { name: U.submit, exact: true })).toBeDisabled();
        });
      });

      await test.step('[37W-F-003] 3 địa chỉ hợp lệ + vai Kỹ sư + chip', async () => {
        const list = [testEmail('p08-37w-ui-a'), testEmail('p08-37w-ui-b'), testEmail('p08-37w-ui-c')].join(',\n');
        await verifyDesktop(page, 'U08_37W-F-003_users_write', async (p) => {
          await openPanel(p);
          await p.getByLabel(U.inviteEmails, { exact: true }).fill(list);
          await pickOption(p, p.getByRole('combobox', { name: U.inviteRole, exact: true }), 'Kỹ sư (được sửa dự án)');
          await expect(p.getByText('3 địa chỉ hợp lệ', { exact: true })).toBeVisible();
          await expect.soft(p.getByRole('button', { name: U.submit, exact: true })).toBeEnabled(); // never clicked
        });
      });

      // Certain mark after the last state: a fresh read; nothing was ever posted.
      await openUsersList(page);
      expect(posts, 'no POST /api/users/invitations in FL-37W-U1').toEqual([]);
    });
  });

  test('SCR-37 · FL-37W-U2 · Hàng mời, hộp xoá, toast đổi vai', async ({ browser }) => {
    test.setTimeout(240_000);
    const email = longEmail('p08-37w-ui-inv');
    let invited: { id: string; email: string } | undefined;
    const since = new Date(Date.now() - 5_000);
    try {
      await asPoolUser(browser, adminPool, async (page) => {
        await test.step('[37W-F-004] hàng "Chờ chấp nhận" sau mời', async () => {
          await openUsersList(page);
          await page.getByRole('button', { name: U.invite, exact: true }).click();
          await page.getByLabel(U.inviteEmails, { exact: true }).fill(email);
          const sent = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/users/invitations');
          await page.getByRole('button', { name: U.submit, exact: true }).click();
          const res = await sent;
          expect(res.status(), 'POST /api/users/invitations').toBe(201);
          const row = ((await res.json()) as { id: string; email: string }[]).find((u) => u.email === email);
          if (row !== undefined) invited = { id: String(row.id), email };
          expect(row, 'invited user in the answer').toBeDefined();
          await verifyDesktop(page, 'U08_37W-F-004_users_write', async (p) => {
            await openUsersList(p);
            await p.getByLabel(U.search, { exact: true }).fill(email);
            const r = userRow(p, email);
            await expect(r).toBeVisible();
            await expect.soft(r.getByText(U.pending, { exact: true })).toBeVisible();
          });
        });

        await test.step('[37W-F-006] hộp "Xoá hẳn {tên}?" không xác nhận', async () => {
          await verifyDesktop(
            page,
            'U08_37W-F-006_users_write',
            async (p) => {
              await openUsersList(p);
              await p.getByLabel(U.search, { exact: true }).fill(email);
              await userRow(p, email).getByRole('button', { name: U.remove, exact: true }).click();
              const dialog = p.getByRole('dialog', { name: /^Xoá hẳn /u });
              await expect(dialog).toBeVisible();
              await expect.soft(dialog.getByRole('button', { name: 'Xác nhận xoá vĩnh viễn', exact: true })).toBeDisabled();
              expect.soft(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), 'dialog does not overflow horizontally').toBe(true);
            },
            false,
          );
        });

        await test.step('[37W-F-008] toast "Đã đổi vai" với "Vai mới không còn: …"', async () => {
          try {
            await setRole('engineer');
            let changed = false; // one real PATCH only: the first viewport changes the role, the others re-open the saved state
            await verifyDesktop(
              page,
              'U08_37W-F-008_users_write',
              async (p) => {
                await openUsersList(p);
                await p.getByLabel(U.search, { exact: true }).fill(pu1.email);
                const select = userRow(p, pu1.email).getByRole('combobox', { name: `Vai của ${pu1.name}`, exact: true });
                if (changed) {
                  await expect(select).toContainText('Người xem');
                  return;
                }
                await expect(select).toContainText('Kỹ sư');
                const patched = p.waitForResponse((r) => r.request().method() === 'PATCH' && new URL(r.url()).pathname === `/api/users/${pu1.id}/role`);
                await pickOption(p, select, 'Người xem');
                expect.soft((await patched).status()).toBe(200);
                changed = true;
                const toast = p.getByRole('status').filter({ hasText: U.roleChanged });
                await expect(toast).toBeVisible();
                await expect.soft(toast).toContainText('Vai mới không còn:');
              },
              false,
            );
          } finally {
            await setRole('engineer');
          }
        });
      });
    } finally {
      if (invited !== undefined) await removeUser(adminPoolApi, invited);
      try {
        await deleteMails([(await waitForMail(email, since, 10_000)).id]);
      } catch (error) {
        test.info().annotations.push({ type: 'cleanup', description: `mailpit: ${String(error)}` });
      }
    }
  });

  test('SCR-37 · FL-37W-U3 · [mocked response] Hàng của mình và quản trị cuối', async ({ browser }) => {
    test.setTimeout(120_000);
    // Real pair: step 1 uses the real list (FL-37W-04/06). Step 2 mocks GET /api/users down to the signed-in admin only.
    await asPoolUser(browser, adminPool, async (page) => {
      await test.step('[37W-F-005] hàng của mình: chữ chặn thay điều khiển (thật)', async () => {
        await verifyDesktop(page, 'U08_37W-F-005_users_write', async (p) => {
          await openUsersList(p);
          await p.getByLabel(U.search, { exact: true }).fill(adminPool.email);
          const row = userRow(p, adminPool.email);
          await expect(row).toBeVisible();
          await expect.soft(row.getByText(U.selfRole, { exact: true })).toBeVisible();
          await expect.soft(row.getByText(U.selfDisable, { exact: true })).toBeVisible();
        });
      });

      await test.step('[37W-F-007] [mocked response] hàng chữ "Đây là quản trị cuối cùng…"', async () => {
        await page.route('**/api/users*', async (route) => {
          if (route.request().method() !== 'GET' || !USERS_RE.test(new URL(route.request().url()).pathname)) return route.fallback();
          const real = await route.fetch();
          const body = (await real.json()) as { users: Record<string, unknown>[] };
          // Another active admin (copy of the signed-in row with its own id/email/name) and NOT the own row: isSelf would win over lastAdmin.
          // A viewer beside it: a list of ONE user is the "only you" empty state (useUserManagement.ts state ladder `users.length <= 1`,
          // RR evidence U08_37W-F-007 1440: "Chưa có người dùng nào khác", no row), so the last admin needs a second user to be drawn.
          const mine = body.users.find((u) => u.email === adminPool.email);
          const other = { ...mine, id: 'mock-last-admin-0000', email: testEmail('p08-37w-lastadm'), name: 'Quản trị cuối (mock)' };
          const peer = { ...mine, id: 'mock-viewer-0000', email: testEmail('p08-37w-viewer'), name: 'Người xem (mock)', role: 'viewer' };
          return route.fulfill({ response: real, json: { ...body, users: [other, peer] } });
        });
        try {
          await verifyDesktop(page, 'U08_37W-F-007_users_write', async (p) => {
            await openUsersList(p);
            const row = p.locator('tbody tr, main li').filter({ hasText: 'Quản trị cuối (mock)' }).first();
            await expect(row).toBeVisible();
            // The reason shows 3x in the row (role cell dd + disable slot + remove slot, BUG-P08-022); F-007 = the action column, remove slot is the last.
            await expect.soft(row.getByText(U.lastAdmin, { exact: true })).toHaveCount(3);
            await expect.soft(row.getByText(U.lastAdmin, { exact: true }).last()).toBeVisible();
          });
        } finally {
          await page.unroute('**/api/users*');
        }
      });
    });
  });
});
