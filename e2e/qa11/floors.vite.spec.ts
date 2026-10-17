/**
 * QA phase 11 S round 3 - FL-11F-04 (SCR-21 thickness) on Vite + mocked API.
 * Why here: the stack case ticks the sr-only "Dong y" box with focus + Space and it ended unchecked in R1, RR1 and RR2
 * (error `toBeChecked` Received unchecked, element still carrying the `checked` attribute). jsdom (user-event) ticks it once,
 * so only a real Chromium can show whether Checkbox.tsx handleKeyDown (onChange on keydown) plus the native keyup click toggles twice.
 * Run: VITE_USE_MOCK_API=true pnpm exec vite --host 127.0.0.1 --port $E2E_PORT, then
 *   E2E_PORT=<port> pnpm exec playwright test e2e/qa11/floors.vite.spec.ts
 */
import { expect, test } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';
import { QCB_FLOOR, QCB_PROJECT, seedQcb } from '../v7/seedQcb';

const SCREEN = 'Chuẩn hoá độ dày tường'; // vi.json (TV:105)
const ACCEPT = /^Đồng ý chuẩn hoá \d+ tường /u; // vi.json:2210 acceptCheckbox

test('SCR-21 · FL-11F-04 · [mocked response] focus + Space ticks the "Đồng ý" box once', async ({ page }) => {
  await page.goto(ROUTES.project.thickness(QCB_PROJECT, QCB_FLOOR.thickness));
  await expect(page.getByRole('heading', { name: SCREEN })).toBeVisible({ timeout: 15_000 });
  await seedQcb(page, 'thickness');
  const box = page.getByRole('region', { name: SCREEN, exact: true }).getByRole('checkbox', { name: ACCEPT }).first();
  await expect(box).not.toBeChecked();
  await box.focus();
  await page.keyboard.press('Space');
  await expect(box).toBeChecked();
});
