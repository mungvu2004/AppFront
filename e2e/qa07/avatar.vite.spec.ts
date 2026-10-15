/**
 * QA phase 07 - SCR-33 avatar file input on Vite + mocked API.
 *
 * 33P-E-004 (FL-33P-08): Shift+Tab from "Họ tên" lands on the sr-only "Đổi ảnh" file input and Enter opens ONE
 * single-file chooser. Split from the stack step per qa-phase v4 principle 7 (two rounds, still red): on the stack
 * one of two --repeat copies waited 30 s for "filechooser" while the focus check before it was green
 * (p07-rr after RF, BUG-P07-019); the focus + ring part stays in phase07_avatar_edge.spec.ts.
 * Run: `E2E_PORT=<own port> node scripts/run-playwright.mjs --reporter=line e2e/qa07/avatar.vite.spec.ts`.
 */
import { expect, test } from '@playwright/test';

const ACCOUNT_URL = '/tai-khoan';
const FIRST_PAINT_TIMEOUT_MS = 15_000;
const CHOOSER_TIMEOUT_MS = 5_000;

test('SCR-33 [mocked response] 33P-E-004 Shift+Tab to the file input + Enter opens one single-file chooser', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(ACCOUNT_URL);
  const name = page.getByRole('textbox', { name: 'Họ tên', exact: true });
  await expect(name).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  // Listen BEFORE the focus moves: waitForEvent turns on file-chooser interception asynchronously, and an Enter sent
  // right after it raced that switch (probe 2026-10-15: same keydown/keypress/click on the INPUT, none prevented, yet
  // 1-2 of 6 runs saw no "filechooser" event). The app is correct; the listener order was the race.
  const chooser = page.waitForEvent('filechooser', { timeout: CHOOSER_TIMEOUT_MS });
  await name.focus();
  await page.keyboard.press('Shift+Tab'); // the file input is the focusable just before the first field (ProfileSection)
  await expect(page.getByLabel('Đổi ảnh', { exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  expect((await chooser).isMultiple(), 'a single-file chooser opened').toBe(false);
});
