import { expect, test } from '@playwright/test';

/**
 * `/` used to render the nine-screen demo picker (`src/App.tsx`); it now mounts
 * `ProjectDashboardRoute`, the real product shell (`src/routes/router.tsx`).
 * This test protects the same thing it always did — the entry screen renders
 * correctly at desktop width — just on the screen that is actually there
 * today, so the baseline is `dashboard-1440.png`, not the old `app-shell-1440.png`
 * (deleted along with its `win32` snapshot; that content no longer exists).
 *
 * Two things are pinned so the same input always produces the same pixels:
 *
 * - `page.clock.setFixedTime` freezes `Date.now()` so the "cập nhật" column
 *   (`formatTimestamp`, `src/lib/format/datetime.ts`, fed by
 *   `useProjectDashboard.ts`'s `const now = Date.now()`) reads a stable
 *   relative time instead of drifting with the wall clock on every run.
 * - `emulateMedia({ reducedMotion: 'reduce' })` strips the entrance
 *   transform (`ProjectCardTile.tsx`'s `initial={{ opacity: 0, y: 8 }}`) so
 *   the cards don't drift vertically mid-shot. It does NOT zero the opacity
 *   fade or its stagger delay — framer-motion's `reducedMotion="user"` only
 *   crossfades opacity instead of skipping it (`components/motion/index.ts`) —
 *   so the explicit wait below still covers that.
 */
test('captures the app shell at desktop width', async ({ page }) => {
  // The dashboard does more work than the demo picker it replaced (react-query,
  // more DOM per card), so under the parallel local run's CPU contention from
  // other browser workers it can miss the default 5s assertion timeout below
  // even though it does load. `test.slow()` triples the overall test timeout
  // (CI already runs this suite with `workers: 1`, so this is a local-only
  // safety margin, not a fix for a real hang).
  test.slow();

  await page.clock.setFixedTime(new Date('2026-06-15T12:00:00.000Z'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Dự án của tôi' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('list', { name: 'Danh sách dự án' })).toBeVisible({ timeout: 15_000 });

  // Worst-case card entrance: 168ms stagger cap (MAX_STAGGERED_ITEMS - 1) × 24ms
  // (`src/lib/motion/stagger.ts`) + 180ms 'fast' opacity fade
  // (`src/lib/motion/tokens.ts`) — rounded up with margin so the shot is never
  // mid-fade.
  await page.waitForTimeout(500);

  await expect(page).toHaveScreenshot('dashboard-1440.png', { fullPage: true });
});
