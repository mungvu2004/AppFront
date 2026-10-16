/**
 * Phase 08 SCR-37 User Management - read UI flows FL-37U-U1..U2 (flows-C4). `verifyUi` at 1920/1440/1024/768.
 * Budget: 1 admin seed API login (pool), 1 pool-admin login (`p08-37U-adm`: API for the long invitation + UI sessions),
 * 1 invitation (30/h per admin, Decision S2 #2), read-only shared `p08-eng` (PE and PN, 1 UI login). Cleanup: DELETE the invitee.
 * 37U-E-010: no axe library is installed in this repo -> UNKNOWN - NEED VERIFICATION, proxied by accessible-name checks.
 */
import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

import { attachJson, captureEvidence } from './support/evidence';
import { adminApi } from './support/p08/admin';
import { asPoolUser, inviteUser, isWide, longEmail, openUsersList, pickOption, poolAdminApi, removeUser, userRow, verifyDesktop } from './support/p08/P4';
import { poolUser, type PoolUser } from './support/phase03Seed';

const SEARCH = 'Tìm người dùng';
const MATRIX_BUTTON = 'Xem ma trận quyền';
const FORBIDDEN = 'Vai của bạn chưa quản lý được người dùng nên danh sách tài khoản không hiện'; // UUM:140-141 (prefix)
const CLOSE_DETAIL = 'Đóng chi tiết người dùng';
const NO_MATCH = 'Không tìm thấy người dùng';
const CLEAR = 'Xoá tìm kiếm và bộ lọc';

test.describe('SCR-37 users UI', () => {
  let adminPool: PoolUser;
  let adminPoolApi: APIRequestContext;
  let engineer: PoolUser;
  let lng: { id: string; email: string; name: string };
  const detailOf = (page: Page) => page.locator('aside[aria-label="Chi tiết người dùng"]').or(page.getByRole('dialog', { name: 'Chi tiết người dùng', exact: true }));

  test.beforeAll(async () => {
    const seed = await adminApi();
    try {
      const made = await poolAdminApi(seed, 'p08-37U-adm');
      adminPool = made.user;
      adminPoolApi = made.api;
      engineer = await poolUser(seed, 'engineer', 'p08-eng');
    } finally {
      await seed.dispose();
    }
    lng = await inviteUser(adminPoolApi, longEmail('p08-37u-lng'));
  });

  test.afterAll(async () => {
    try {
      await removeUser(adminPoolApi, lng);
    } finally {
      await adminPoolApi.dispose();
    }
  });

  test('SCR-37 · FL-37U-U1 · Danh sách, lọc, không tìm thấy, hàng dài', async ({ browser }) => {
    test.setTimeout(240_000);
    await asPoolUser(browser, adminPool, async (page) => {
      await test.step('[37U-F-001] danh sách >=2 người, bảng/thẻ vừa khung', async () => {
        await verifyDesktop(page, 'U08_37U-F-001_users', async (p) => {
          await openUsersList(p);
          expect.soft(await p.locator('tbody tr, main li').count(), '>=2 users').toBeGreaterThanOrEqual(2);
          if (isWide(p)) {
            await expect.soft(p.getByRole('columnheader')).toHaveCount(6);
            const box = await p.locator('table').first().boundingBox();
            expect.soft((box?.x ?? 0) + (box?.width ?? 0), 'table inside viewport').toBeLessThanOrEqual(p.viewportSize()?.width ?? 0);
          } else {
            await expect.soft(p.locator('table')).toHaveCount(0); // 768: card list
          }
        });
      });

      await test.step('[37U-F-003] lọc Vai=Quản trị + Trạng thái=Đang hoạt động', async () => {
        await verifyDesktop(page, 'U08_37U-F-003_users', async (p) => {
          await openUsersList(p);
          await pickOption(p, p.getByRole('combobox', { name: 'Vai', exact: true }), 'Quản trị');
          await pickOption(p, p.getByRole('combobox', { name: 'Trạng thái', exact: true }), 'Đang hoạt động');
          await expect(userRow(p, adminPool.email)).toBeVisible();
          await expect(userRow(p, lng.email)).toHaveCount(0);
        });
      });

      await test.step('[37U-F-005] hàng LNG 254 ký tự không tràn', async () => {
        await verifyDesktop(page, 'U08_37U-F-005_users', async (p) => {
          await openUsersList(p);
          await p.getByLabel(SEARCH, { exact: true }).fill(lng.email);
          const row = userRow(p, lng.email);
          await expect(row).toBeVisible();
          const box = await row.boundingBox();
          expect.soft((box?.x ?? 0) + (box?.width ?? 0), 'row inside viewport').toBeLessThanOrEqual((p.viewportSize()?.width ?? 0) + 1);
        });
      });

      await test.step('[37U-C-005] tên/email dài bọc dòng, scrollWidth<=clientWidth', async () => {
        await verifyDesktop(page, 'U08_37U-C-005_users', async (p) => {
          await openUsersList(p);
          await p.getByLabel(SEARCH, { exact: true }).fill(lng.email);
          const row = userRow(p, lng.email);
          await expect(row).toBeVisible();
          const fits = await p.evaluate(() => {
            const t = document.querySelector('table')?.parentElement ?? document.querySelector('main');
            return t ? t.scrollWidth <= t.clientWidth : true;
          });
          expect.soft(fits, 'list container scrollWidth <= clientWidth').toBe(true);
          await row.getByRole('button').first().click();
          const detail = detailOf(p).first();
          await expect(detail).toBeVisible();
          expect.soft(await detail.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), 'detail scrollWidth <= clientWidth').toBe(true);
        });
      });

      await test.step('[37U-F-006] chi tiết LNG (panel >=1024, Drawer 768)', async () => {
        await verifyDesktop(
          page,
          'U08_37U-F-006_users',
          async (p) => {
            await openUsersList(p);
            await p.getByLabel(SEARCH, { exact: true }).fill(lng.email);
            await userRow(p, lng.email).getByRole('button').first().click();
            await expect(p.getByRole('button', { name: CLOSE_DETAIL, exact: true })).toBeVisible();
            if (isWide(p)) await expect.soft(p.locator('aside[aria-label="Chi tiết người dùng"]')).toBeVisible();
            else await expect.soft(p.getByRole('dialog', { name: 'Chi tiết người dùng', exact: true })).toBeVisible();
          },
          false,
        );
      });

      await test.step('[37U-F-007] ⚑ nút "Xoá" cùng y giữa các hàng (1440/1024)', async () => {
        await verifyDesktop(page, 'U08_37U-F-007_users', async (p) => {
          await openUsersList(p);
          const w = p.viewportSize()?.width ?? 0;
          if (w !== 1440 && w !== 1024) return;
          // evidence (E step): what the rows hold at the moment of measuring; decides race (rows=0) vs blocked-reason text vs label mismatch
          await attachJson(`U08_37U-F-007_users_rows_${w}.json`, {
            rows: await p.locator('tbody tr').count(),
            skeleton: await p.locator('[aria-busy="true"]').count(),
            firstActionCells: await p.locator('tbody tr').evaluateAll((rs) => rs.slice(0, 6).map((r) => ({ buttons: [...r.querySelectorAll('button')].map((b) => (b.textContent ?? '').trim()), lastCell: (r.lastElementChild?.textContent ?? '').trim().slice(0, 80) }))),
          });
          const offsets = await p.locator('tbody tr').filter({ hasNotText: lng.email }).evaluateAll((rows) => // long row excluded: it is taller
            rows
              .map((r) => {
                const b = [...r.querySelectorAll('button')].find((x) => x.textContent?.trim().startsWith('Xoá')); // D evidence rows_<w>.json: button text is doubled ('XoáXoá'), so === never matched (rows=0)
                return b ? Math.round(b.getBoundingClientRect().top - r.getBoundingClientRect().top) : null;
              })
              .filter((v): v is number => v !== null),
          );
          expect.soft(offsets.length, 'rows with a "Xoá" button').toBeGreaterThanOrEqual(2);
          expect.soft(new Set(offsets).size, `"Xoá" offset within row equal across rows: ${offsets.join(',')}`).toBe(1);
        });
      });

      await test.step('[37U-F-013] vùng chạm >= 24 px', async () => {
        await verifyDesktop(
          page,
          'U08_37U-F-013_users',
          async (p) => {
            await openUsersList(p);
            await p.getByLabel(SEARCH, { exact: true }).fill(lng.email);
            const row = userRow(p, lng.email);
            await expect(row).toBeVisible();
            const nameBtn = row.getByRole('button').first();
            expect.soft((await nameBtn.boundingBox())?.height ?? 0, 'name button height').toBeGreaterThanOrEqual(24);
            await nameBtn.click();
            const close = p.getByRole('button', { name: CLOSE_DETAIL, exact: true });
            await expect(close).toBeVisible();
            const c = await close.boundingBox();
            expect.soft(Math.min(c?.height ?? 0, c?.width ?? 0), 'panel close target').toBeGreaterThanOrEqual(24);
          },
          false,
        );
      });

      await test.step('[37U-E-010] UNKNOWN - NEED VERIFICATION: không có axe trong repo; thay bằng kiểm tên truy cập', async () => {
        await verifyDesktop(page, 'U08_37U-E-010_users', async (p) => {
          await openUsersList(p);
          const unnamed = await p.evaluate(() =>
            [...document.querySelectorAll('button, input, select, [role=combobox], a[href]')]
              .filter((el) => {
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
              })
              .filter((el) => !(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.textContent?.trim() || (el as HTMLInputElement).labels?.length || el.getAttribute('title')))
              .map((el) => el.outerHTML.slice(0, 80)),
          );
          expect.soft(unnamed, 'interactive controls without an accessible name').toEqual([]);
        });
      });

      await test.step('[37U-E-011] Tab vào tên/nút: vòng focus nhìn thấy', async () => {
        await openUsersList(page);
        await page.getByLabel(SEARCH, { exact: true }).fill(lng.email);
        const btn = userRow(page, lng.email).getByRole('button').first();
        await expect(btn).toBeVisible();
        await page.getByLabel(SEARCH, { exact: true }).focus();
        for (let i = 0; i < 40 && !(await btn.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
        await expect(btn).toBeFocused();
        const ring = await btn.evaluate((el) => {
          const s = getComputedStyle(el);
          return { outline: s.outlineStyle, width: parseFloat(s.outlineWidth), shadow: s.boxShadow };
        });
        expect.soft((ring.outline !== 'none' && ring.width > 0) || ring.shadow !== 'none', `focus ring ${JSON.stringify(ring)}`).toBe(true);
        await captureEvidence(page, 'U08_37U-E-011_users_focus.png', { caption: 'focus ring on the row name button' });
      });
    });
  });

  test('SCR-37 · FL-37U-U2 · Chi tiết, ma trận, không tìm thấy, từ chối', async ({ browser }) => {
    test.setTimeout(180_000);
    await asPoolUser(browser, adminPool, async (page) => {
      await test.step('[37U-F-002] chi tiết PE: >=1024 bảng 3 cột + aside; 768 thẻ + Drawer', async () => {
        await verifyDesktop(
          page,
          'U08_37U-F-002_users',
          async (p) => {
            await openUsersList(p);
            await p.getByLabel(SEARCH, { exact: true }).fill(engineer.email);
            await userRow(p, engineer.email).getByRole('button', { name: engineer.name }).first().click(); // 768 card name = name + email (Table.tsx:203): non-exact
            const vw = p.viewportSize()?.width ?? 0;
            if (isWide(p)) {
              const aside = p.locator('aside[aria-label="Chi tiết người dùng"]');
              await expect(aside).toBeVisible();
              await expect.soft(p.getByRole('columnheader')).toHaveCount(3);
              const b = await aside.boundingBox();
              expect.soft((b?.x ?? 0) + (b?.width ?? 0), 'aside inside viewport').toBeLessThanOrEqual(vw + 1);
            } else {
              await expect(p.getByRole('dialog', { name: 'Chi tiết người dùng', exact: true })).toBeVisible();
              await expect.soft(p.locator('table')).toHaveCount(0);
            }
          },
          false,
        );
      });

      await test.step('[37U-F-004] không tìm thấy: tiêu đề + icon + nút', async () => {
        await verifyDesktop(page, 'U08_37U-F-004_users', async (p) => {
          await openUsersList(p);
          await p.getByLabel(SEARCH, { exact: true }).fill('zzz-khong-co-nguoi-nay');
          const title = p.getByText(NO_MATCH, { exact: true });
          await expect(title).toBeVisible();
          await expect.soft(p.getByRole('button', { name: CLEAR, exact: true })).toBeVisible();
          expect.soft(await title.locator('xpath=../..').locator('svg').count(), 'empty-state icon').toBeGreaterThan(0);
        });
      });

      await test.step('[37U-F-008] hộp ma trận: rộng <= viewport - lề, hàng cuối có đệm', async () => {
        await verifyDesktop(
          page,
          'U08_37U-F-008_users',
          async (p) => {
            await openUsersList(p);
            await p.getByRole('button', { name: MATRIX_BUTTON, exact: true }).click();
            const dialog = p.getByRole('dialog', { name: 'Ma trận quyền theo vai trò', exact: true });
            await expect(dialog).toBeVisible();
            const b = await dialog.boundingBox();
            expect.soft(b?.width ?? 0, 'matrix dialog width <= viewport - margins').toBeLessThanOrEqual((p.viewportSize()?.width ?? 0) - 16);
            const gap = await dialog.evaluate((el) => {
              const last = [...el.querySelectorAll('tr, li')].pop();
              return last ? el.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom : -1;
            });
            expect.soft(gap, 'bottom padding under the last row').toBeGreaterThan(0);
          },
          false,
        );
      });

      await test.step('[37U-F-009] PN: màn từ chối', async () => {
        await asPoolUser(browser, engineer, async (pn) => {
          await verifyDesktop(pn, 'U08_37U-F-009_users', async (p) => {
            await p.goto('/admin/users');
            await expect(p.getByText(FORBIDDEN, { exact: false })).toBeVisible();
            await expect.soft(p.getByRole('alert')).toBeVisible();
            // catalog-C4:145 "alert + ma trận + liên kết": the matrix is inline (UserManagement.tsx:186), no button.
            await expect.soft(p.getByText('Ma trận quyền theo vai trò', { exact: true })).toBeVisible(); // UserManagement.tsx:52
            await expect.soft(p.getByRole('list').getByRole('listitem').first()).toBeVisible();
            await expect.soft(p.getByRole('link', { name: 'Về bảng điều khiển', exact: true }).or(p.getByRole('button', { name: 'Về bảng điều khiển', exact: true }))).toBeVisible();
          });
        });
      });
    });
  });
});
