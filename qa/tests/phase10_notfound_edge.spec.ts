/**
 * QA-10 P1 — SCR-39 NotFound on the real stack (admin + anonymous). Flows FL-10N-01..03 (flows-C1.md).
 * Seed DP3 = three own projects (support/p10/P1.ts), read-only for every flow; removed in afterAll.
 * Sources: src/screens/system/NotFound/{NotFound.tsx,PlanFragment.tsx,useNotFound.ts,notFoundGateway.ts}.
 */
import { expect, test, type Request } from '@playwright/test';

import { pathOf } from '../../e2e/fixtures/routes';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { captureEvidence } from './support/evidence';
import {
  FLOORS_HREF,
  NOT_FOUND_PATH,
  NOT_FOUND_TITLE,
  VIEWPORT_1920,
  notFoundHeading,
  openAdminPage,
  recentHeading,
  recentLinks,
  seedDp3,
  type Dp3,
} from './support/p10/P1';

const MISSING_PROJECT = '00000000-0000-4000-8000-000000000000';
const DESCRIPTION = 'Trang bạn tìm đã bị xoá hoặc đã chuyển đi nơi khác.'; // useNotFound.ts NOT_FOUND_TEXT.description
const PROJECT_MISSING_TITLE = 'Không tìm thấy dự án này'; // ProjectSpatialGate.tsx:37
const TELEMETRY_CODE = /system\.not-found/u; // notFoundModel.ts:150 NOT_FOUND_SCREEN_CODE
const CAPTION = 'Mã lỗi: 404 · /khong-ton-tai'; // useNotFound.ts:354

const softly = expect.configure({ soft: true });
let dp3: Dp3;

test.beforeAll(async () => {
  dp3 = await seedDp3('edge');
});

test.afterAll(async () => {
  await dp3.cleanup();
});

test('SCR-39 · FL-10N-01 · admin · nội dung, thứ tự, chữ, telemetry (DP3)', async ({ browser }) => {
  test.setTimeout(120_000); // telemetry batch flushes after up to 10 s (sender.ts)
  const { context, page } = await openAdminPage(browser, VIEWPORT_1920);
  try {
    // Registered BEFORE goto: list response, and every telemetry POST (beacon or keepalive fetch).
    const projectsApi = waitForApi(page, 'GET', /^\/api\/projects$/u, [200]);
    const telemetry: Request[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/telemetry') telemetry.push(request);
    });
    const notFoundBeacons = (): Request[] => telemetry.filter((r) => TELEMETRY_CODE.test(r.postData() ?? ''));
    const links = recentLinks(page);
    let json: unknown;

    await test.step('[10N-A-001] h2 hiện', async () => {
      await page.goto(NOT_FOUND_PATH);
      await expect(notFoundHeading(page)).toBeVisible();
    });

    await test.step('[10N-A-002] URL giữ nguyên', async () => {
      expect.soft(new URL(page.url()).pathname).toBe(NOT_FOUND_PATH);
    });

    await test.step('[10N-G-001] GET /api/projects → 200 + mảng JSON', async () => {
      json = (await projectsApi).json;
      expect.soft(Array.isArray(json), 'body is a JSON array').toBe(true);
    });

    await test.step('[10N-B-001] chrome đủ ở 1920', async () => {
      await expect(recentHeading(page)).toBeVisible();
      await expect.soft(page.getByText(DESCRIPTION, { exact: true })).toBeVisible();
      await expect.soft(page.getByRole('button', { name: 'Về danh sách dự án', exact: true })).toBeVisible();
      await expect.soft(page.getByRole('button', { name: 'Quay lại', exact: true })).toBeVisible();
      await expect.soft(page.getByRole('main').locator('svg[aria-hidden="true"]').first()).toBeVisible(); // PlanFragment.tsx:75
      await captureEvidence(page, 'N10_10N-B-001_success.png');
    });

    await test.step('[10N-A-003] danh sách: h3 + đúng 3 link /floors', async () => {
      await expect.soft(recentHeading(page)).toBeVisible();
      await expect.soft(links).toHaveCount(3);
      for (const href of await links.evaluateAll((as) => as.map((a) => a.getAttribute('href')))) {
        expect.soft(href, 'recent link href').toMatch(FLOORS_HREF);
      }
    });

    await test.step('[10N-A-008] thứ tự mới→cũ theo updatedAt (tối đa 3)', async () => {
      // Oracle = the list JSON captured at open (notFoundGateway.ts sorts by updatedAt desc, then slices 3).
      const expected = (json as { name: string; updatedAt: string }[])
        .slice()
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
        .slice(0, 3)
        .map((p) => p.name);
      await expect.soft(links.locator('span.truncate')).toHaveText(expected); // NotFound.tsx:133
    });

    await test.step('[10N-A-009] hover hàng 1: nhãn Cập nhật opacity 0 → 1', async () => {
      const label = links.first().getByText(/^Cập nhật /u); // NotFound.tsx:134 opacity-0 group-hover:opacity-100
      const opacity = (): Promise<string> => label.evaluate((el) => getComputedStyle(el).opacity);
      await softly.poll(opacity).toBe('0');
      await links.first().hover();
      await softly.poll(opacity).toBe('1');
      await captureEvidence(page, 'N10_10N-A-009_recency.png');
    });

    await test.step('[10N-C-001] chú thích mã lỗi', async () => {
      await expect.soft(page.getByText(CAPTION, { exact: true })).toBeVisible();
    });

    await test.step('[10N-G-002] 0 POST telemetry (cờ tắt trong build stack)', async () => {
      // oracle: telemetry off in stack build (sender.ts:82, VITE_TELEMETRY_ENABLED unset) => no POST /api/telemetry.
      // Landmark: NotFound + recent list on screen and GET /api/projects returned (steps 1-5); recorder starts now.
      const before = telemetry.length;
      await page.goto('about:blank'); // pagehide flushes any queued beacon
      expect.soft(telemetry.slice(before), 'POST /api/telemetry after pagehide').toHaveLength(0);
      expect.soft(notFoundBeacons(), 'system.not-found beacons').toHaveLength(0);
    });

    await test.step('[10N-C-002] chuỗi truy vấn/hash không vào chú thích', async () => {
      await page.goto(`${NOT_FOUND_PATH}?x=1#h`);
      await expect(notFoundHeading(page)).toBeVisible();
      await expect.soft(page.getByText(CAPTION, { exact: true })).toBeVisible();
      await expect.soft(page.getByText('x=1')).toHaveCount(0);
    });

    await test.step('[10N-B-008] reduced-motion: class fade', async () => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(NOT_FOUND_PATH);
      await expect(notFoundHeading(page)).toBeVisible();
      await expect.soft(page.getByRole('main').locator('svg[aria-hidden="true"].nf-plan-fragment-fade')).toHaveCount(1); // PlanFragment.tsx:40
      await expect.soft(page.getByRole('main').locator('div.nf-notfound-fade')).toHaveCount(1); // NotFound.tsx:48
      await page.emulateMedia({ reducedMotion: 'no-preference' });
    });

    await test.step('[10N-B-007] 768: không minh hoạ, vẫn 3 link', async () => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();
      await expect(recentHeading(page)).toBeVisible();
      await expect.soft(page.getByRole('main').locator('svg[aria-hidden="true"]')).toHaveCount(0);
      await expect.soft(links).toHaveCount(3);
      await captureEvidence(page, 'N10_10N-B-007_collapsed.png');
    });
  } finally {
    await context.close();
  }
});

test('SCR-39 · FL-10N-02 · admin · điều hướng + bàn phím (DP3)', async ({ browser }) => {
  const { context, page } = await openAdminPage(browser, VIEWPORT_1920);
  const dashboardButton = page.getByRole('button', { name: 'Về danh sách dự án', exact: true });
  const backButton = page.getByRole('button', { name: 'Quay lại', exact: true });
  const links = recentLinks(page);
  const open = async (): Promise<void> => {
    await page.goto(NOT_FOUND_PATH);
    await expect(notFoundHeading(page)).toBeVisible();
    await expect(recentHeading(page)).toBeVisible();
  };
  try {
    await test.step('[10N-E-003] landmarks: main có h2 + h3, svg aria-hidden', async () => {
      await open();
      const main = page.getByRole('main');
      await expect(main.getByRole('heading', { name: NOT_FOUND_TITLE, level: 2 })).toBeVisible();
      await expect(main.getByRole('heading', { name: 'Dự án gần đây', level: 3 })).toBeVisible();
      await expect.soft(main.locator('svg[aria-hidden="true"]').first()).toBeVisible();
    });

    await test.step('[10N-E-001] Tab: Về danh sách → Quay lại → link 1', async () => {
      // Clicking the (non-focusable) h2 sets the sequential-focus start point right before the buttons.
      await notFoundHeading(page).click();
      await page.keyboard.press('Tab');
      await expect.soft(dashboardButton).toBeFocused();
      await page.keyboard.press('Tab');
      await expect.soft(backButton).toBeFocused();
      await page.keyboard.press('Tab');
      await expect.soft(links.first()).toBeFocused();
    });

    await test.step('[10N-E-002] link 1: vòng focus + nhãn Cập nhật hiện', async () => {
      await expect(links.first()).toBeFocused();
      await softly.poll(() => links.first().evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none'); // ring-2, NotFound.tsx:74
      await softly.poll(() => links.first().getByText(/^Cập nhật /u).evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
      await captureEvidence(page, 'N10_10N-E-002_focusring.png');
    });

    await test.step('[10N-A-006] có lịch sử: Quay lại = navigate(-1), không về / bằng replace', async () => {
      await page.goto('/');
      await expect(page).toHaveURL(/\/$/u);
      // synthetic in-app history: a full goto always gives key 'default'
      await page.evaluate((path) => {
        // useNotFound.ts:296 `location.key !== 'default'` => navigate(-1)
        window.history.pushState({ usr: null, key: 'p10n', idx: 1 }, '', path);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, NOT_FOUND_PATH);
      await expect(notFoundHeading(page)).toBeVisible();
      await backButton.click();
      await softly.poll(() => pathOf(page.url())).toBe('/');
      // navigate(-1) leaves the NotFound entry ahead in history; a replace would have dropped it.
      await page.goForward();
      await softly.poll(() => pathOf(page.url())).toBe(NOT_FOUND_PATH);
    });

    await test.step('[10N-A-005] tải thẳng: Quay lại → / (replace)', async () => {
      await open();
      await backButton.click();
      await softly.poll(() => pathOf(page.url())).toBe('/');
    });

    await test.step('[10N-A-007] Enter trên Về danh sách dự án → /', async () => {
      await open();
      await dashboardButton.focus();
      await page.keyboard.press('Enter');
      await softly.poll(() => pathOf(page.url())).toBe('/');
    });

    await test.step('[10N-A-004] bấm link dự án 1 → /projects/<id>/floors', async () => {
      await open();
      const href = await links.first().getAttribute('href');
      expect.soft(href).toMatch(FLOORS_HREF);
      await links.first().click();
      await softly.poll(() => pathOf(page.url())).toBe(href);
    });
  } finally {
    await context.close();
  }
});

test('SCR-39 · FL-10N-03 · admin + anon · đường sâu và ẩn danh', async ({ browser }) => {
  const { context, page } = await openAdminPage(browser, VIEWPORT_1920);
  const anon = await browser.newContext({ baseURL: readBaseUrl(), viewport: VIEWPORT_1920 });
  try {
    await test.step('[10N-C-003] /projects/<uuid>/khong-co → NotFound, URL giữ nguyên', async () => {
      const deepPath = `/projects/${MISSING_PROJECT}/khong-co`;
      await page.goto(deepPath);
      await expect(notFoundHeading(page)).toBeVisible();
      expect(new URL(page.url()).pathname).toBe(deepPath);
    });

    await test.step('[10N-C-004] route có thật, dự án không có → không phải NotFound', async () => {
      const floorsPath = `/projects/${MISSING_PROJECT}/floors`;
      const floorsRead = waitForApi(page, 'GET', new RegExp(`^/api/projects/${MISSING_PROJECT}/floors$`, 'u'), [404]);
      await page.goto(floorsPath);
      await floorsRead;
      // FloorTable.tsx:213 reuses PROJECT_NOT_FOUND_TITLE (/floors is not wrapped by ProjectSpatialGate).
      await expect(page.getByText(PROJECT_MISSING_TITLE, { exact: true })).toBeVisible();
      await expect.soft(notFoundHeading(page)).toHaveCount(0);
    });

    await test.step('[10N-D-001] ẩn danh → /login, không thấy NotFound', async () => {
      const anonPage = await anon.newPage();
      await anonPage.goto(NOT_FOUND_PATH);
      await expect.poll(() => new URL(anonPage.url()).pathname).toBe('/login');
      await expect(anonPage.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeVisible(); // e2e/fixtures/session.ts SIGN_IN_LABEL
      await expect.soft(anonPage.getByText(NOT_FOUND_TITLE, { exact: true })).toHaveCount(0);
      await expect.soft(anonPage.getByText('Cần đăng nhập để xem trang này', { exact: true })).toHaveCount(0); // useNotFound.ts:99
    });
  } finally {
    await anon.close();
    await context.close();
  }
});
