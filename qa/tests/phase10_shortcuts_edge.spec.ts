/**
 * Phase 10 · SCR-41 global shortcut help (GlobalShortcutHelp), real stack.
 * FL-10K-01 (NotFound: every way to open/close) and FL-10K-04 (/3d: canvas group). `?` is bound on `window`
 * by the shell (src/routes/router.tsx:319 `global.shortcutHelp`, registry listener src/lib/input/shortcutRegistry.ts:611).
 */
import { expect, test, type Page, type Response } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { TOUR_APPEAR_TIMEOUT_MS, dismissTour } from '../../e2e/fixtures/tour';
import { signInAdmin } from './support/auth';
import { captureEvidence } from './support/evidence';
import { NF_DASHBOARD, NF_TITLE, nextFrame, openNotFound, recordApiRequests } from './support/p10/P2';
import { DESKTOP } from './support/p10/viewports';
import { requireState } from './support/state';

test.use({ viewport: { width: DESKTOP.width, height: DESKTOP.height } });

// GlobalShortcutHelp.tsx:151-167 (role=dialog, h2 'Phím tắt'), :163 close button, :176 group h3, :215 footer
const HELP = 'Phím tắt';
const CLOSE_HELP = 'Đóng bảng phím tắt';
const GLOBAL_ROWS = ['Mở bảng phím tắt', 'Đóng lớp trên cùng'];
const PROJECT_ONLY_ROWS = ['Hoàn tác thao tác gần nhất', 'Làm lại thao tác vừa hoàn tác', 'Lưu ngay thay vì chờ tự lưu'];

const help = (page: Page) => page.getByRole('dialog', { name: HELP, exact: true });
// <section aria-labelledby=h3> → region named by the group heading.
const group = (page: Page, name: string) => help(page).getByRole('region', { name, exact: true });

test('SCR-41 · FL-10K-01 · admin · NotFound: mở/đóng bằng mọi đường, nội dung rút gọn', async ({ page }) => {
  test.setTimeout(120_000);
  await signInAdmin(page);

  const requests = recordApiRequests(page);
  const helpChunks: string[] = [];
  const helpStatuses: number[] = [];
  page.on('request', (request) => {
    if (request.url().includes('GlobalShortcutHelp')) helpChunks.push(request.url());
  });
  page.on('response', (response: Response) => {
    if (response.url().includes('GlobalShortcutHelp')) helpStatuses.push(response.status());
  });

  // The heading is not focusable; the "Về danh sách dự án" button is the focus anchor (flows say h1: NotFound has none).
  const anchor = page.getByRole('button', { name: NF_DASHBOARD, exact: true });
  const openWithKey = async (): Promise<void> => {
    await anchor.focus();
    await page.keyboard.press('?');
    await expect(help(page)).toBeVisible();
  };

  try {
    await test.step('[10K-B-001] NotFound hiện, chưa có hộp thoại Phím tắt', async () => {
      await openNotFound(page);
      await expect(help(page)).toHaveCount(0);
      await captureEvidence(page, 'K10_10K-B-001_notfound_closed.png');
    });

    await test.step('[10K-B-002] chunk GlobalShortcutHelp chỉ tải sau `?` đầu tiên', async () => {
      expect.soft(helpChunks, 'chunk requested before the first ?').toEqual([]);
      await anchor.focus();
      await page.keyboard.press('?');
      await expect.poll(() => helpChunks.length, { message: 'chunk requested after ?' }).toBeGreaterThan(0);
      await expect.poll(() => helpStatuses.includes(200), { message: 'chunk status 200' }).toBe(true);
    });

    await test.step('[10K-A-002] `?` mở hộp thoại có nút đóng', async () => {
      await expect.soft(help(page)).toBeVisible();
      await expect.soft(help(page).getByRole('button', { name: CLOSE_HELP, exact: true })).toBeVisible();
      await captureEvidence(page, 'K10_10K-A-002_notfound_help.png');
    });

    await test.step('[10K-E-002] focus nằm trong hộp thoại', async () => {
      await expect
        .poll(() => help(page).evaluate((el) => el.contains(document.activeElement)), { message: 'focus inside dialog' })
        .toBe(true);
      await captureEvidence(page, 'K10_10K-E-002_focus_in_dialog.png');
    });

    await test.step('[10K-B-008] nhóm Toàn cục: đúng 2 hàng, không phím dành riêng cho dự án', async () => {
      const rows = group(page, 'Toàn cục').locator('dt');
      await expect.soft(rows).toHaveCount(GLOBAL_ROWS.length);
      expect.soft([...(await rows.allTextContents())].sort()).toEqual([...GLOBAL_ROWS].sort());
      for (const name of PROJECT_ONLY_ROWS) {
        await expect.soft(help(page).getByText(name, { exact: true }), name).toHaveCount(0);
      }
      await captureEvidence(page, 'K10_10K-B-008_global_rows.png');
    });

    await test.step('[10K-B-010] chân bảng "Nhấn ? hoặc Esc để đóng"', async () => {
      const footer = help(page).locator('p').filter({ hasText: 'để đóng' });
      await expect.soft(footer).toHaveText('Nhấn ? hoặc Esc để đóng');
      await expect.soft(footer.locator('kbd')).toHaveText(['?', 'Esc']);
      await captureEvidence(page, 'K10_10K-B-010_footer.png');
    });

    await test.step('[10K-A-003] Esc đóng, NotFound còn', async () => {
      await page.keyboard.press('Escape');
      await expect.soft(help(page)).toBeHidden();
      await expect.soft(page.getByRole('heading', { name: NF_TITLE, exact: true, level: 2 })).toBeVisible();
      await captureEvidence(page, 'K10_10K-A-003_closed_by_esc.png');
    });

    await test.step('[10K-E-004] focus về phần tử đã focus trước `?`', async () => {
      await expect.soft(anchor).toBeFocused();
      await captureEvidence(page, 'K10_10K-E-004_focus_restored.png');
    });

    const chunksAfterFirstOpen = helpChunks.length;

    await test.step('[10K-A-007] `?` lần hai mở lại, không tải thêm chunk', async () => {
      await page.keyboard.press('?');
      await expect.soft(help(page)).toBeVisible();
      await expect.soft(group(page, 'Toàn cục').locator('dt')).toHaveCount(GLOBAL_ROWS.length);
      expect.soft(helpChunks.length, 'no new chunk request').toBe(chunksAfterFirstOpen);
      await captureEvidence(page, 'K10_10K-A-007_reopened.png');
    });

    await test.step('[10K-A-004] `?` khi bảng đang mở → đóng', async () => {
      await page.keyboard.press('?');
      await expect.soft(help(page)).toBeHidden();
      await captureEvidence(page, 'K10_10K-A-004_closed_by_question.png');
    });

    await test.step('[10K-A-005] nút "Đóng bảng phím tắt" đóng', async () => {
      await openWithKey();
      await help(page).getByRole('button', { name: CLOSE_HELP, exact: true }).click();
      await expect.soft(help(page)).toBeHidden();
      await captureEvidence(page, 'K10_10K-A-005_closed_by_button.png');
    });

    await test.step('[10K-A-006] bấm ngoài hộp (góc trên-trái) đóng', async () => {
      await openWithKey();
      await page.mouse.click(5, 5); // overlay covers the viewport, the box is max 480 px wide (GlobalShortcutHelp.tsx:185)
      await expect.soft(help(page)).toBeHidden();
      await captureEvidence(page, 'K10_10K-A-006_closed_by_backdrop.png');
    });

    await test.step('[10K-G-001] không request /api nào do bảng gây ra', async () => {
      await nextFrame(page);
      // NotFound's own recent-projects read (GET /api/projects) is the page's, not the help's: allowed.
      const allowed = new Set(['POST /api/auth/refresh', 'GET /api/me', 'GET /api/projects']);
      expect.soft(requests.sent.filter((line) => !allowed.has(line)), 'unexpected /api requests').toEqual([]);
      await captureEvidence(page, 'K10_10K-G-001_no_api.png');
    });
  } finally {
    requests.stop();
  }
});

test('SCR-41 · FL-10K-04 · admin · /projects/<MP>/3d: nhóm canvas động', async ({ page }) => {
  test.setTimeout(180_000);
  const projectId = requireState((s) => s.project.projectId, 'project.projectId', 'Phase 2 (SCR-05 create)');
  await signInAdmin(page);

  await test.step('[10K-B-009] trên /3d bảng có nhóm "Khung nhìn 3D" với Ctrl + F', async () => {
    await page.goto(ROUTES.project.viewer(projectId));
    // phase05 helpers: viewport main named 'Khung nhìn mô hình', busy flag clears when the scene is drawn.
    const viewport = page.getByRole('main', { name: 'Khung nhìn mô hình', exact: true });
    await expect(viewport).toBeVisible();
    await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
    await expect(viewport).toHaveAttribute('aria-busy', 'false', { timeout: 60_000 });

    await page.getByRole('toolbar', { name: 'Công cụ khung nhìn', exact: true }).getByRole('button').first().focus();
    await page.keyboard.press('?');
    await expect(help(page)).toBeVisible();

    const canvas = group(page, 'Khung nhìn 3D');
    const searchRow = canvas.locator('div').filter({ has: page.locator('dt', { hasText: 'Mở ô tìm đối tượng' }) }).last();
    await expect(canvas.locator('dt', { hasText: 'Mở ô tìm đối tượng' })).toHaveCount(1);
    await expect(searchRow.locator('kbd')).toHaveText(['Ctrl', 'F']);
    await expect(group(page, 'Toàn cục').getByText('Mở ô tìm đối tượng', { exact: true })).toHaveCount(0);
    await captureEvidence(page, 'K10_10K-B-009_canvas_group.png');

    await page.keyboard.press('Escape');
    await expect(help(page)).toBeHidden();
  });
});
