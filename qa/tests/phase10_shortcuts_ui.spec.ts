/**
 * Phase 10 — SCR-41 global shortcut help, UI verification (skill qa-verify-ui), REAL stack, FL-10K-U1 … U3
 * (QA-10 P3; flows-C2.md). Four desktop widths (`DESKTOP_VIEWPORTS`), admin only, project read-only.
 */
import { expect, test, type Page } from '@playwright/test';

import { ROUTES, UNKNOWN_PATH } from '../../e2e/fixtures/routes';
import { TOUR_APPEAR_TIMEOUT_MS, dismissTour } from '../../e2e/fixtures/tour';
import { signInAdmin } from './support/auth';
import { captureEvidence } from './support/evidence';
import { HELP_CLOSE_LABEL, focusAnchor, helpDialog } from './support/p10/P3';
import { DESKTOP_VIEWPORTS } from './support/p10/viewports';
import { requireState } from './support/state';
import { verifyUi } from './support/ui-verify';

const FLOORS_TITLE = 'Quản lý tầng'; // FloorManager.tsx:70 (h2)
const NOT_FOUND_TITLE = 'Không tìm thấy trang này'; // useNotFound.ts:98 (h2)
const VIEWPORT_NAME = 'Khung nhìn mô hình'; // phase05_3d_viewer.spec.ts:45
const SCENE_TIMEOUT_MS = 60_000;

const floorsHeading = (page: Page) => page.getByRole('heading', { level: 2, name: FLOORS_TITLE, exact: true });
const notFoundHeading = (page: Page) => page.getByRole('heading', { level: 2, name: NOT_FOUND_TITLE, exact: true });

async function expectHelpFits(page: Page): Promise<void> {
  await expect(helpDialog(page)).toBeVisible();
  await expect(helpDialog(page).getByRole('button', { name: HELP_CLOSE_LABEL, exact: true })).toBeInViewport(); // sticky header, GSH:184
}

test('SCR-41 · FL-10K-U1 · admin · help trên /floors 4 khổ', async ({ page }) => {
  const projectId = requireState((s) => s.project.projectId, 'project.projectId', 'Phase 2');

  await signInAdmin(page);
  await test.step('[10K-F-001] help on /floors at 1920/1440/1024/768: dialog in screen, no horizontal scroll', async () => {
    await verifyUi(
      page,
      'K10U_10K-F-001_help_floors',
      async (p) => {
        await p.goto(ROUTES.project.floors(projectId));
        await expect(floorsHeading(p)).toBeVisible();
        await focusAnchor(floorsHeading(p));
        await p.keyboard.press('?');
        await expectHelpFits(p);
      },
      DESKTOP_VIEWPORTS,
      { fullPage: false },
    );
  });
});

test('SCR-41 · FL-10K-U2 · admin · help trên NotFound + giảm chuyển động', async ({ page }) => {
  const openOnNotFound = async (p: Page): Promise<void> => {
    await p.goto(UNKNOWN_PATH);
    await expect(notFoundHeading(p)).toBeVisible();
    await focusAnchor(notFoundHeading(p));
    await p.keyboard.press('?');
  };

  await signInAdmin(page);
  await test.step('[10K-F-002] help on NotFound at 1920/1440/1024/768: centred, in screen', async () => {
    await verifyUi(
      page,
      'K10U_10K-F-002_help_notfound',
      async (p) => {
        await openOnNotFound(p);
        await expectHelpFits(p);
      },
      DESKTOP_VIEWPORTS,
      { fullPage: false },
    );
  });

  await test.step('[10K-E-007] prefers-reduced-motion: help still opens and closes', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openOnNotFound(page); // fresh load: GSH:140 reads the media query at mount
    await expect.soft(helpDialog(page)).toBeVisible();
    await captureEvidence(page, 'K10U_10K-E-007_help_reduced_motion.png');
    await page.keyboard.press('Escape');
    await expect.soft(helpDialog(page)).toBeHidden();
  });
});

test('SCR-41 · FL-10K-U3 · admin · help trên /3d dài 1024/768', async ({ page }) => {
  test.setTimeout(300_000);
  const projectId = requireState((s) => s.project.projectId, 'project.projectId', 'Phase 2');

  await signInAdmin(page);
  await test.step('[10K-F-003] long help (canvas group) on /3d: scrolls inside the box, close button stays in view', async () => {
    await verifyUi(
      page,
      'K10U_10K-F-003_help_3d',
      async (p) => {
        await p.goto(ROUTES.project.viewer(projectId));
        await dismissTour(p, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
        await expect(p.getByRole('main', { name: VIEWPORT_NAME })).toHaveAttribute('aria-busy', 'false', { timeout: SCENE_TIMEOUT_MS });
        await p.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        await p.keyboard.press('?');
        await expectHelpFits(p);
      },
      DESKTOP_VIEWPORTS,
      { fullPage: false },
    );
  });
});
