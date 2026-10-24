/**
 * Phase 10 · SCR-40 dev URLs on the PROD build (real stack, admin signed in, read-only).
 * FL-10E-19. Env: stack thật (plain `test`), not the dev server.
 */
import { expect, test, type Page } from '@playwright/test';

import { ROUTE_PATTERNS, pathOf } from '../../e2e/fixtures/routes';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { NAVIGATION_TIMEOUT_MS, readBaseUrl } from '../../e2e/fullstack/env';
import { DEV_PUBLIC_ROUTE_PATTERNS } from '../../src/routes/paths';
import { signInAdmin } from './support/auth';
import { captureEvidence } from './support/evidence';
import { DESKTOP_VIEWPORTS } from './support/p10/viewports';
import { verifyUi } from './support/ui-verify';

const NOT_FOUND_TITLE = 'Không tìm thấy trang này'; // src/screens/system/NotFound/useNotFound.ts
const notFoundHeading = (page: Page) => page.getByRole('heading', { name: NOT_FOUND_TITLE, exact: true, level: 1 });
const DEV_CHUNK = /DataEntryDemo|ListReviewDemo|ShellDemo|CanvasOverlaysDemo|FeedbackDemo|StateGallery|DesignSystem/u;

test('SCR-40e-6 · FL-10E-19 · admin · Dev URL trên bản prod → NotFound', async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const jsRequests: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'script') jsRequests.push(request.url());
  });
  try {
    await test.step('[10E-C-024] DEV_PUBLIC_ROUTE_PATTERNS is the 8 declared paths', async () => {
      expect([...DEV_PUBLIC_ROUTE_PATTERNS].sort()).toEqual(
        ['/demo', '/design-system', '/data-entry-demo', '/list-review-demo', '/shell-demo', '/demo/canvas-overlays', '/feedback-demo', '/design-system/states'].sort(),
      );
    });

    await signInAdmin(page);
    jsRequests.length = 0; // count only the 8 dev-URL visits for step 10E-A-074

    const visit = async (path: string, slug: string, id: string): Promise<void> => {
      await page.goto(path);
      await expect(notFoundHeading(page), path).toBeVisible({ timeout: NAVIGATION_TIMEOUT_MS });
      expect.soft(pathOf(page.url()), `${path}: URL kept`).toBe(path);
      await captureEvidence(page, `E10_${id}_prod_${slug}.png`);
    };

    await test.step('[10E-A-066] /demo → NotFound', async () => visit(ROUTE_PATTERNS.demoGallery, 'demo', '10E-A-066'));
    await test.step('[10E-A-067] /design-system → NotFound', async () => visit(ROUTE_PATTERNS.designSystem, 'design_system', '10E-A-067'));
    await test.step('[10E-A-068] /design-system/states → NotFound', async () => visit(ROUTE_PATTERNS.designSystemStates, 'design_system_states', '10E-A-068'));
    await test.step('[10E-A-069] /data-entry-demo → NotFound', async () => visit(ROUTE_PATTERNS.dataEntryDemo, 'data_entry_demo', '10E-A-069'));
    await test.step('[10E-A-070] /list-review-demo → NotFound', async () => visit(ROUTE_PATTERNS.listReviewDemo, 'list_review_demo', '10E-A-070'));
    await test.step('[10E-A-071] /shell-demo → NotFound', async () => visit(ROUTE_PATTERNS.shellDemo, 'shell_demo', '10E-A-071'));
    await test.step('[10E-A-072] /demo/canvas-overlays → NotFound', async () => visit(ROUTE_PATTERNS.canvasOverlaysDemo, 'demo_canvas_overlays', '10E-A-072'));
    await test.step('[10E-A-073] /feedback-demo → NotFound', async () => visit(ROUTE_PATTERNS.feedbackDemo, 'feedback_demo', '10E-A-073'));

    await test.step('[10E-A-074] no dev chunk requested during the 8 visits', async () => {
      expect.soft(jsRequests.filter((url) => DEV_CHUNK.test(url)), 'dev chunks requested on prod').toEqual([]);
    });

    await test.step('[10E-B-042] NotFound title is an h2', async () => {
      await expect(notFoundHeading(page)).toBeVisible();
      await captureEvidence(page, 'E10_10E-B-042_prod_notfound_title.png');
    });

    await test.step('[10E-D-006] prod needs a session: signed-in admin sees NotFound on a dev URL', async () => {
      // The anonymous dev counterpart (demo screen without a session) is covered by the dev-server specs.
      await page.goto(ROUTE_PATTERNS.demoGallery);
      await expect(notFoundHeading(page)).toBeVisible({ timeout: NAVIGATION_TIMEOUT_MS });
      await expect.soft(page).toHaveURL(/\/demo$/u);
      await captureEvidence(page, 'E10_10E-D-006_prod_session_gate.png');
    });

    await test.step('[10E-G-006] GET /api/projects on a dev URL answers 200 with an array', async () => {
      const projects = waitForApi(page, 'GET', /^\/api\/projects$/u, [200]); // registered BEFORE goto
      await page.goto(ROUTE_PATTERNS.shellDemo);
      await expect(notFoundHeading(page)).toBeVisible({ timeout: NAVIGATION_TIMEOUT_MS });
      const { json } = await projects;
      expect.soft(Array.isArray(json), 'GET /api/projects body is an array').toBe(true);
      await captureEvidence(page, 'E10_10E-G-006_prod_projects_api.png');
    });

    await test.step('[10E-F-024] NotFound on one dev route at 4 widths', async () => {
      await verifyUi(
        page,
        'E10_10E-F-024_prod_notfound',
        async (p) => {
          await p.goto(ROUTE_PATTERNS.demoGallery);
          await expect(notFoundHeading(p)).toBeVisible({ timeout: NAVIGATION_TIMEOUT_MS });
        },
        DESKTOP_VIEWPORTS,
      );
    });
  } finally {
    await context.close();
  }
});
