/**
 * Phase 10 · SCR-39 NotFound with a mocked `GET /api/projects` (the real admin always has >= 3 projects).
 * FL-10N-04 (list states) and FL-10N-06 (empty + offline layout, 4 widths). Real stack, one `page.route` line only.
 */
import { expect, test, type Page } from '@playwright/test';

import { signInAdmin } from './support/auth';
import { captureEvidence } from './support/evidence';
import {
  NF_BACK,
  NF_DASHBOARD,
  NF_OFFLINE_TEXT,
  NF_OFFLINE_TITLE,
  NF_RECENT,
  NF_TITLE,
  NOT_FOUND_PATH,
  nextFrame,
  openNotFound,
  routeProjects,
  wireProject,
} from './support/p10/P2';
import { DESKTOP, DESKTOP_VIEWPORTS } from './support/p10/viewports';
import { verifyUi } from './support/ui-verify';

test.use({ viewport: { width: DESKTOP.width, height: DESKTOP.height } });

const h2 = (page: Page, name: string) => page.getByRole('heading', { name, exact: true, level: 1 });
const recentHeading = (page: Page) => page.getByRole('heading', { name: NF_RECENT, exact: true, level: 2 });
// Recent list links: NotFound.tsx renders them in a list inside <main>.
const recentLinks = (page: Page) => page.getByRole('main').getByRole('list').getByRole('link');
/** Registered BEFORE the goto: resolves once the app has received the mocked list response. */
const projectsResponse = (page: Page, status: number) =>
  page.waitForResponse((r) => /\/api\/projects$/u.test(new URL(r.url()).pathname) && r.status() === status);
const FLOORS_HREF = /^\/projects\/[^/]+\/floors$/u;
const TWO_PROJECTS = [
  wireProject('p10-mock-1', 'P10 mock một', '2026-05-02T10:00:00.000Z'),
  wireProject('p10-mock-2', 'P10 mock hai', '2026-05-01T10:00:00.000Z'),
];

test('SCR-39 · FL-10N-04 · admin · trạng thái danh sách [mocked response]', async ({ page }) => {
  test.setTimeout(120_000);
  await signInAdmin(page);

  await test.step('[10N-B-002] mock 2 dự án → danh sách ngắn', async () => {
    const mock = await routeProjects(page, (route) => route.fulfill({ status: 200, json: TWO_PROJECTS }));
    await openNotFound(page);
    await expect(recentHeading(page)).toBeVisible();
    await expect(recentLinks(page)).toHaveCount(2);
    for (const link of await recentLinks(page).all()) await expect(link).toHaveAttribute('href', FLOORS_HREF);
    expect(mock.served(), 'mocked GET served').toBeGreaterThan(0);
    await captureEvidence(page, 'N10_10N-B-002_partial.png');
    await mock.stop();
  });

  await test.step('[10N-B-003] mock [] → không danh sách, vẫn 2 nút', async () => {
    const mock = await routeProjects(page, (route) => route.fulfill({ status: 200, json: [] }));
    const answered = projectsResponse(page, 200);
    await openNotFound(page);
    await answered;
    await nextFrame(page);
    await nextFrame(page);
    await expect.soft(recentHeading(page)).toHaveCount(0);
    await expect.soft(page.getByRole('main').getByRole('list')).toHaveCount(0);
    await expect.soft(page.getByRole('button', { name: NF_DASHBOARD, exact: true })).toBeVisible();
    await expect.soft(page.getByRole('button', { name: NF_BACK, exact: true })).toBeVisible();
    await captureEvidence(page, 'N10_10N-B-003_empty.png');
    await mock.stop();
  });

  await test.step('[10N-B-004] mock trì hoãn → nội dung chính trước, danh sách sau', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const mock = await routeProjects(page, async (route) => {
      await gate;
      await route.fulfill({ status: 200, json: TWO_PROJECTS });
    });
    try {
      await openNotFound(page);
      await expect.poll(mock.served, { message: 'request held at the route' }).toBeGreaterThan(0);
      await expect.soft(h2(page, NF_TITLE)).toBeVisible();
      await expect.soft(page.getByRole('button', { name: NF_DASHBOARD, exact: true })).toBeVisible();
      await expect.soft(page.getByRole('button', { name: NF_BACK, exact: true })).toBeVisible();
      await expect.soft(recentHeading(page)).toHaveCount(0);
      await captureEvidence(page, 'N10_10N-B-004_loading.png');
    } finally {
      release();
    }
    await expect.soft(recentHeading(page)).toBeVisible();
    await mock.stop();
  });

  await test.step('[10N-B-005] abort → "Chưa kết nối được máy chủ"', async () => {
    const mock = await routeProjects(page, (route) => route.abort('failed'));
    await page.goto(NOT_FOUND_PATH);
    // react-query retries the aborted read before the error state shows.
    await expect.soft(h2(page, NF_OFFLINE_TITLE)).toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByText(NF_OFFLINE_TEXT, { exact: true })).toBeVisible();
    await captureEvidence(page, 'N10_10N-B-005_offline.png');
    await mock.stop();
  });

  await test.step('[10N-B-006] 500 → vẫn "Không tìm thấy trang này", không danh sách', async () => {
    const mock = await routeProjects(page, (route) => route.fulfill({ status: 500, json: {} }));
    const answered = projectsResponse(page, 500);
    await openNotFound(page);
    await answered;
    await nextFrame(page);
    await nextFrame(page);
    await expect.soft(h2(page, NF_OFFLINE_TITLE)).toHaveCount(0);
    await expect.soft(h2(page, NF_TITLE)).toBeVisible();
    await expect.soft(recentHeading(page)).toHaveCount(0);
    await captureEvidence(page, 'N10_10N-B-006_error500.png');
    await mock.stop();
  });
});

test('SCR-39 · FL-10N-06 · admin · bố cục empty + offline 4 khổ [mocked response]', async ({ page }) => {
  test.setTimeout(240_000);
  await signInAdmin(page);

  await test.step('[10N-F-002] empty 4 khổ không tràn ngang', async () => {
    const mock = await routeProjects(page, (route) => route.fulfill({ status: 200, json: [] }));
    const metrics = await verifyUi(
      page,
      'N10_10N-F-002_empty',
      async (p) => {
        const n0 = mock.served();
        await openNotFound(p);
        await expect.poll(mock.served, { message: 'mocked GET served' }).toBeGreaterThan(n0);
      },
      DESKTOP_VIEWPORTS,
    );
    await mock.stop();
    expect(metrics).toHaveLength(DESKTOP_VIEWPORTS.length);
    for (const m of metrics) {
      expect(m.openError, `open @${m.viewport}`).toBeUndefined();
      expect(m.horizontalOverflowPx, `overflow @${m.viewport}`).toBe(0);
    }
  });

  await test.step('[10N-F-003] offline 4 khổ, tiêu đề không tràn/cắt', async () => {
    const mock = await routeProjects(page, (route) => route.abort('failed'));
    const metrics = await verifyUi(
      page,
      'N10_10N-F-003_offline',
      (p) => openNotFound(p, NF_OFFLINE_TITLE),
      DESKTOP_VIEWPORTS,
    );
    await mock.stop();
    expect(metrics).toHaveLength(DESKTOP_VIEWPORTS.length);
    for (const m of metrics) {
      expect.soft(m.openError, `open @${m.viewport}`).toBeUndefined();
      expect.soft(m.horizontalOverflowPx, `overflow @${m.viewport}`).toBe(0);
      expect.soft(m.clipped.filter((c) => c.includes(NF_OFFLINE_TITLE)), `title clipped @${m.viewport}`).toEqual([]);
    }
  });
});
