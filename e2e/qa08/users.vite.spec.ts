import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';
import { signInAs } from '../fixtures/session';
import { FIRST_PAINT_TIMEOUT_MS } from '../v12b/firstPaint';

/**
 * Phase 08 · SCR-37 (users, read side) · Playwright on Vite, mocked API.
 * Own port: E2E_PORT=5182. Real-browser proofs that vitest (jsdom) cannot give:
 *  - BUG-P08-019 (37U-E-006): closing the detail returns focus to the opener (UserManagement.tsx:140-146).
 *  - BUG-P08-017 (37U-E-009): the "last active" span is reachable by Tab and shows its tooltip
 *    (UserManagementTable.tsx:329-331).
 */

const TARGET = { name: 'Nguyễn Bình', email: 'engineer@example.com' } as const;
const WIDTH = 1440;
const HEIGHT = 900;
const MAX_TABS = 30;

async function openUsers(page: Page) {
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  await signInAs(page, 'admin', ROUTES.adminUsers);
  await expect(page.getByRole('row').filter({ hasText: TARGET.email })).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
}

test.describe('SCR-37 users read [mocked response]', () => {
  test('SCR-37 · BUG-P08-019 · closing the detail returns focus to the name button [mocked response]', async ({ page }) => {
    await openUsers(page);
    const row = page.getByRole('row').filter({ hasText: TARGET.email });
    const opener = row.getByRole('button', { name: TARGET.name, exact: true });
    await opener.click();
    const aside = page.locator('aside[aria-label="Chi tiết người dùng"]');
    await expect(aside).toBeVisible();

    await page.getByRole('button', { name: 'Đóng chi tiết người dùng' }).focus();
    await page.keyboard.press('Escape');
    await expect(aside).toHaveCount(0);

    await expect(opener).toBeFocused();
  });

  test('SCR-37 · BUG-P08-017 · last-active span is reachable by Tab and shows its tooltip [mocked response]', async ({ page }) => {
    await openUsers(page);
    const row = page.getByRole('row').filter({ hasText: TARGET.email });
    const span = row.getByRole('cell').nth(3).locator('span[tabindex="0"]');
    await expect(span).toHaveCount(1);

    await row.getByRole('button', { name: TARGET.name, exact: true }).focus();
    for (let i = 0; i < MAX_TABS && !(await span.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');

    await expect(span).toBeFocused();
    await expect(page.getByRole('tooltip')).toContainText(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/u);
  });

  test('SCR-37 · FL-37U-06 (37U-G-007) · offline click on another person: the panel shows role=alert [mocked response]', async ({ page, context }) => {
    await openUsers(page);
    const aside = page.locator('aside[aria-label="Chi tiết người dùng"]');
    const rows = page.locator('tbody tr');
    await rows.filter({ hasText: TARGET.email }).getByRole('button', { name: TARGET.name, exact: true }).click();
    await expect(aside).toBeVisible();

    const other = rows.filter({ hasNotText: TARGET.email }).first();
    await context.setOffline(true);
    try {
      await other.locator('button').first().click();
      await expect(aside.getByRole('alert').first()).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.setOffline(false);
    }
  });

  test('SCR-37 · FL-37U-U1 (37U-F-007) · "Xoá" stays centred in rows of different height [mocked response]', async ({ page }) => {
    await openUsers(page);
    const m = await page.locator('tbody tr').evaluateAll((rows) =>
      rows.flatMap((r) => {
        const b = [...r.querySelectorAll('button')].find((x) => x.textContent?.trim().startsWith('Xoá'));
        if (!b) return [];
        const br = b.getBoundingClientRect();
        const rr = r.getBoundingClientRect();
        return [{ h: Math.round(rr.height), top: Math.round(br.top - rr.top), centre: Math.round(br.top + br.height / 2 - (rr.top + rr.height / 2)) }];
      }),
    );
    expect(m.length).toBeGreaterThanOrEqual(2);
    const centres = m.map((x) => x.centre);
    expect(Math.max(...centres) - Math.min(...centres), JSON.stringify(m)).toBeLessThanOrEqual(1);
    // proof the rows differ in height (so top-offset equality is NOT a valid invariant): printed on failure/in the log
    console.log('F007 rows', JSON.stringify(m));
  });
});
