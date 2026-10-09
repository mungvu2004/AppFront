/**
 * Phase 10: System and dev routes (E2E-TEST-PLAN.md v2, §4 Phase 10): SCR-39 → SCR-41 → SCR-40.
 *
 * Track A (SCR-39, SCR-41, SCR-40 prod counterpart): compose build at `E2E_FULLSTACK_BASE_URL`,
 *   admin from CP-1 (`E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`), one shared signed-in page.
 * Track B (SCR-40 dev routes): mock dev server at `MOCK_BASE_URL`, fresh context, no session.
 *   Prerequisite (started by the user, never by this file):
 *     VITE_USE_MOCK_API=true pnpm exec vite --host 127.0.0.1 --port 5173 --strictPort
 *
 * No project state is read or written (runtime-session.json untouched).
 */
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { ROUTES, ROUTE_PATTERNS, pathOf } from '../../e2e/fixtures/routes';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { NAVIGATION_TIMEOUT_MS, readBaseUrl } from '../../e2e/fullstack/env';
import { DEV_PUBLIC_ROUTE_PATTERNS } from '../../src/routes/paths';
import { MOCK_BASE_URL, signInAdmin } from './support/auth';
import { captureEvidence } from './support/evidence';

test.describe.configure({ mode: 'serial' });

const VIEWPORT = { width: 1440, height: 900 } as const;

/** The `*` route the plan names for SCR-39. */
const NOT_FOUND_PATH = '/khong-ton-tai';

/* Copy verified in src/screens/system/NotFound/useNotFound.ts (TITLE_BY_REASON.missing, NOT_FOUND_TEXT)
   and notFoundModel.ts (RECENT_PROJECT_LIMIT = 3). Recent links go to ROUTES.project.floors(id). */
const NOT_FOUND_TITLE = 'Không tìm thấy trang này';
const RECENT_HEADING = 'Dự án gần đây';
const BACK_LABEL = 'Quay lại';
const RECENT_PROJECT_LIMIT = 3;
const FLOORS_HREF = /^\/projects\/[^/]+\/floors$/u;

/** NotFound title is an h2 inside ScreenMain's `<main>` (NotFound.tsx). */
const notFoundHeading = (page: Page) =>
  page.getByRole('heading', { name: NOT_FOUND_TITLE, exact: true, level: 2 });

/* ---- Track A: one signed-in admin page shared by every Track A test (lazy, one login). ---- */

let adminContext: BrowserContext | undefined;
let adminPage: Page | undefined;

async function trackAPage(browser: Browser): Promise<Page> {
  if (adminPage) return adminPage;
  adminContext = await browser.newContext({ baseURL: readBaseUrl(), viewport: VIEWPORT });
  adminPage = await adminContext.newPage();
  await signInAdmin(adminPage);
  return adminPage;
}

test.afterAll(async () => {
  await adminContext?.close();
});

/* -------------------------------------------------------------------------- */
/* SCR-39 Not Found                                                           */
/* -------------------------------------------------------------------------- */

test.describe('SCR-39 Not Found (*)', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await trackAPage(browser);
  });

  test('SCR-39 /khong-ton-tai: title, recent projects (≤3 → /floors), "Quay lại", recent link', async () => {
    const projects = waitForApi(page, 'GET', /^\/api\/projects$/u, [200]);
    await page.goto(NOT_FOUND_PATH);
    const { json } = await projects;
    if (!Array.isArray(json)) throw new Error(`GET /api/projects: expected a JSON array, got ${JSON.stringify(json)}`);

    await expect(notFoundHeading(page)).toBeVisible();
    expect(pathOf(page.url())).toBe(NOT_FOUND_PATH);

    const recentHeading = page.getByRole('heading', { name: RECENT_HEADING, exact: true });
    const recentLinks = page.getByRole('main').getByRole('list').getByRole('link');
    const expectedCount = Math.min(json.length, RECENT_PROJECT_LIMIT);

    if (expectedCount === 0) {
      // `empty` branch (NotFound.tsx: `hasRecentProjects` false): no heading, no list.
      await expect(recentHeading).toHaveCount(0);
      await expect(recentLinks).toHaveCount(0);
    } else {
      await expect(recentHeading).toBeVisible();
      await expect(recentLinks).toHaveCount(expectedCount);
      for (const href of await recentLinks.evaluateAll((links) => links.map((a) => a.getAttribute('href')))) {
        expect(href, 'recent project link').toMatch(FLOORS_HREF);
      }
    }
    await captureEvidence(page, '39_notfound.png');

    // Direct load = first history entry (`location.key === 'default'`), so "Quay lại" replaces to `/`.
    await page.getByRole('button', { name: BACK_LABEL, exact: true }).click();
    await expect.poll(() => pathOf(page.url())).toBe(ROUTES.dashboard);

    if (expectedCount > 0) {
      await page.goto(NOT_FOUND_PATH);
      const first = recentLinks.first();
      await expect(first).toBeVisible();
      const href = await first.getAttribute('href');
      expect(href).toMatch(FLOORS_HREF);
      await first.click();
      await expect.poll(() => pathOf(page.url())).toBe(href);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* SCR-41 Global shortcuts                                                    */
/* -------------------------------------------------------------------------- */

test.describe('SCR-41 Global shortcuts', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await trackAPage(browser);
  });

  test('SCR-41 "?" opens GlobalShortcutHelp (lazy), Esc closes it', async () => {
    // `?` is bound in router.tsx UndoShortcuts ('global.shortcutHelp'); it is inert while a text
    // field has focus, so use the NotFound page (no inputs) as the neutral surface.
    await page.goto(NOT_FOUND_PATH);
    await expect(notFoundHeading(page)).toBeVisible();

    // GlobalShortcutHelp.tsx: role="dialog", aria-labelledby → h2 "Phím tắt". Not mounted before the first `?`.
    const help = page.getByRole('dialog', { name: 'Phím tắt', exact: true });
    await expect(help).toHaveCount(0);

    await page.keyboard.press('?');
    await expect(help).toBeVisible();
    await expect(help.getByRole('button', { name: 'Đóng bảng phím tắt', exact: true })).toBeVisible();
    await captureEvidence(page, '41_shortcut_help.png');

    await page.keyboard.press('Escape');
    await expect(help).toBeHidden();
  });
});

/* -------------------------------------------------------------------------- */
/* SCR-40 Dev routes                                                          */
/* -------------------------------------------------------------------------- */

interface DevRoute {
  readonly path: string;
  readonly slug: string;
  /** A landmark verified in the route's source file. */
  readonly landmark: (page: Page) => Locator;
}

const DEV_ROUTES: readonly DevRoute[] = [
  // src/App.tsx h1
  { path: ROUTE_PATTERNS.demoGallery, slug: 'demo', landmark: (p) => p.getByRole('heading', { name: 'Demo App', exact: true, level: 1 }) },
  // src/screens/DesignSystem.tsx h1
  { path: ROUTE_PATTERNS.designSystem, slug: 'design_system', landmark: (p) => p.getByRole('heading', { name: 'Quiet Blueprint v1.1', exact: true, level: 1 }) },
  // src/screens/system/StateGallery/StateGallery.tsx PAGE_TITLE h1
  { path: ROUTE_PATTERNS.designSystemStates, slug: 'design_system_states', landmark: (p) => p.getByRole('heading', { name: 'Duyệt bảy trạng thái', exact: true, level: 1 }) },
  // src/screens/DataEntryDemo.tsx h1
  { path: ROUTE_PATTERNS.dataEntryDemo, slug: 'data_entry_demo', landmark: (p) => p.getByRole('heading', { name: 'Data Entry Components', exact: true, level: 1 }) },
  // src/screens/ListReviewDemo.tsx has no heading; its state bar label is the landmark.
  { path: ROUTE_PATTERNS.listReviewDemo, slug: 'list_review_demo', landmark: (p) => p.getByText('States:', { exact: true }) },
  // src/screens/ShellDemo.tsx canvas h2
  { path: ROUTE_PATTERNS.shellDemo, slug: 'shell_demo', landmark: (p) => p.getByRole('heading', { name: 'Canvas Area', exact: true, level: 2 }) },
  // src/screens/CanvasOverlaysDemo.tsx h1
  { path: ROUTE_PATTERNS.canvasOverlaysDemo, slug: 'demo_canvas_overlays', landmark: (p) => p.getByRole('heading', { name: 'Canvas Overlays Demo', exact: true, level: 1 }) },
  // src/screens/FeedbackDemo.tsx has no heading; its first trigger button is the landmark.
  { path: ROUTE_PATTERNS.feedbackDemo, slug: 'feedback_demo', landmark: (p) => p.getByRole('button', { name: 'Test Undo Toast', exact: true }) },
];

/* AppShell.tsx top-bar toggle (desktop, ≥1024px); the label flips with `leftCollapsed`. */
const COLLAPSE_LEFT = 'Thu gọn panel trái ([)';
const EXPAND_LEFT = 'Mở panel trái ([)';

test.describe('SCR-40 Dev routes', () => {
  test('SCR-40 route list matches DEV_PUBLIC_ROUTE_PATTERNS (src/routes/paths.ts)', () => {
    expect(new Set(DEV_ROUTES.map((r) => r.path))).toEqual(new Set<string>(DEV_PUBLIC_ROUTE_PATTERNS));
    expect(DEV_ROUTES).toHaveLength(8);
  });

  test.describe('Track B (mock dev server, no session)', () => {
    test.use({ baseURL: MOCK_BASE_URL });

    let context: BrowserContext;
    let page: Page;

    test.beforeAll(async ({ browser }) => {
      context = await browser.newContext({ baseURL: MOCK_BASE_URL, viewport: VIEWPORT });
      page = await context.newPage();
    });

    test.afterAll(async () => {
      await context?.close();
    });

    test('SCR-40 probe: mock dev server is reachable', async () => {
      let status: number;
      try {
        status = (await page.request.get(`${MOCK_BASE_URL}/`, { timeout: 10_000 })).status();
      } catch (error) {
        throw new Error(
          `Mock dev server unreachable at ${MOCK_BASE_URL} (${String(error)}). Start it first: ` +
            'VITE_USE_MOCK_API=true pnpm exec vite --host 127.0.0.1 --port 5173 --strictPort',
        );
      }
      expect(status, `GET ${MOCK_BASE_URL}/`).toBe(200);
    });

    for (const route of DEV_ROUTES) {
      test(`SCR-40 dev route ${route.path} renders without a session`, async () => {
        await page.goto(route.path);
        await expect(route.landmark(page)).toBeVisible({ timeout: NAVIGATION_TIMEOUT_MS });
        expect(pathOf(page.url()), 'no redirect to /login').toBe(route.path);

        if (route.path === ROUTE_PATTERNS.shellDemo) {
          await page.getByRole('button', { name: COLLAPSE_LEFT, exact: true }).click();
          const expand = page.getByRole('button', { name: EXPAND_LEFT, exact: true });
          await expect(expand).toBeVisible();
          await captureEvidence(page, `40_dev_${route.slug}.png`);
          // Restore: collapse state persists to localStorage (useAppShell.ts).
          await expand.click();
          await expect(page.getByRole('button', { name: COLLAPSE_LEFT, exact: true })).toBeVisible();
          return;
        }
        await captureEvidence(page, `40_dev_${route.slug}.png`);
      });
    }
  });

  test.describe('Track A (prod build → NotFound)', () => {
    let page: Page;

    test.beforeAll(async ({ browser }) => {
      page = await trackAPage(browser);
    });

    test('SCR-40 dev URLs fall through to NotFound on the prod build (signed-in admin)', async () => {
      for (const route of DEV_ROUTES) {
        await page.goto(route.path);
        await expect(notFoundHeading(page), route.path).toBeVisible();
        expect(pathOf(page.url()), route.path).toBe(route.path);
        await captureEvidence(page, `40_dev_prod_${route.slug}.png`);
      }
    });
  });
});
