/**
 * Phase 10 — SCR-41 global shortcut help, REAL stack, FL-10K-02 and FL-10K-03 (QA-10 P3; flows-C2.md).
 * One `test()` per flow, one `test.step('[<row id>] …')` per catalog row in the planned order; non-serial.
 * Admin only (`signInAdmin`), the main-chain project is READ ONLY (`requireState`): no data is created or written.
 * Source tags: GSH src/components/shell/GlobalShortcutHelp.tsx, SR src/lib/input/shortcutRegistry.ts,
 * RT src/routes/router.tsx.
 */
import { expect, test, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { signInAdmin } from './support/auth';
import { captureEvidence } from './support/evidence';
import { HELP_TITLE, focusAnchor, helpDialog, nextFrame, recordApi, recordPageErrors, rowCaps, stayedOpen, trackKeys, writesOf } from './support/p10/P3';
import { requireState } from './support/state';

const FLOORS_TITLE = 'Quản lý tầng'; // FloorManager.tsx:70 (h2)
const BREADCRUMB_NAV = 'Đường dẫn trang'; // Breadcrumb.tsx:21
const BREADCRUMB_PROJECTS = 'Dự án'; // FloorManager.tsx:72
const DASHBOARD_TITLE = 'Dự án của tôi'; // ProjectDashboard.tsx:166 (h1)
const SEARCH_LABEL = 'Tìm dự án'; // ProjectDashboard.tsx:138
const CREATE_DIALOG = 'Tạo dự án mới'; // CreateProjectModal.tsx:270
const GLOBAL_GROUP = 'Toàn cục'; // GSH:61

const floorsHeading = (page: Page) => page.getByRole('heading', { level: 2, name: FLOORS_TITLE, exact: true });
const dashboardHeading = (page: Page) => page.getByRole('heading', { level: 1, name: DASHBOARD_TITLE, exact: true });

test('SCR-41 · FL-10K-02 · admin · /projects/<MP>/floors: bảng đầy đủ + phím chỉ-đọc', async ({ page }) => {
  const projectId = requireState((s) => s.project.projectId, 'project.projectId', 'Phase 2');
  const requests = recordApi(page);
  const errors = recordPageErrors(page);

  try {
    await signInAdmin(page, ROUTES.project.floors(projectId));
    await expect(floorsHeading(page)).toBeVisible();
    const keys = await trackKeys(page);
    const dialog = helpDialog(page);

    await test.step('[10K-A-001] ? on /floors opens the help dialog', async () => {
      await focusAnchor(floorsHeading(page));
      await page.keyboard.press('?'); // SR:563 matches event.key
      await expect(dialog).toBeVisible();
      await captureEvidence(page, 'K10_10K-A-001_floors_help_open.png');
    });

    await test.step('[10K-E-001] role=dialog, aria-modal=true, labelled by the h2 "Phím tắt"', async () => {
      await expect.soft(dialog).toHaveAttribute('aria-modal', 'true'); // GSH:152
      const labelledBy = await dialog.evaluate((el) => {
        const target = document.getElementById(el.getAttribute('aria-labelledby') ?? '');

        return { tag: target?.tagName, text: target?.textContent };
      });

      expect.soft(labelledBy, 'aria-labelledby target').toEqual({ tag: 'H2', text: HELP_TITLE }); // GSH:153,176
      await captureEvidence(page, 'K10_10K-E-001_floors_help_aria.png');
    });

    await test.step('[10K-B-003] Hoàn tác thao tác gần nhất = Ctrl + Z', async () => {
      await expect.soft(rowCaps(dialog, 'Hoàn tác thao tác gần nhất')).toHaveText(['Ctrl', 'Z']); // SR:730
      await captureEvidence(page, 'K10_10K-B-003_row_undo.png');
    });

    await test.step('[10K-B-004] Làm lại thao tác vừa hoàn tác = Ctrl + Shift + Z', async () => {
      await expect.soft(rowCaps(dialog, 'Làm lại thao tác vừa hoàn tác')).toHaveText(['Ctrl', 'Shift', 'Z']); // SR:741
      await captureEvidence(page, 'K10_10K-B-004_row_redo.png');
    });

    await test.step('[10K-B-005] Lưu ngay thay vì chờ tự lưu = Ctrl + S', async () => {
      await expect.soft(rowCaps(dialog, 'Lưu ngay thay vì chờ tự lưu')).toHaveText(['Ctrl', 'S']); // SR:750
      await captureEvidence(page, 'K10_10K-B-005_row_save.png');
    });

    await test.step('[10K-B-006] Mở bảng phím tắt = ?', async () => {
      await expect.soft(rowCaps(dialog, 'Mở bảng phím tắt')).toHaveText(['?']); // SR:768
      await captureEvidence(page, 'K10_10K-B-006_row_open.png');
    });

    await test.step('[10K-B-007] Đóng lớp trên cùng = Esc (not ESCAPE)', async () => {
      await expect.soft(rowCaps(dialog, 'Đóng lớp trên cùng')).toHaveText(['Esc']); // SR:778, KEY_CAP_LABELS SR:193-202
      await captureEvidence(page, 'K10_10K-B-007_row_close.png');
    });

    await test.step('[10K-E-006] group "Toàn cục" is a region, rows are dt/dd', async () => {
      const region = dialog.getByRole('region', { name: GLOBAL_GROUP, exact: true }); // GSH:196 section + aria-labelledby

      await expect.soft(region).toHaveCount(1);
      const dts = await region.locator('dl > div > dt').count();
      const dds = await region.locator('dl > div > dd').count();

      expect.soft(dts, 'at least the five project-scope rows').toBeGreaterThanOrEqual(5);
      expect.soft(dds, 'one dd per dt').toBe(dts);
      await captureEvidence(page, 'K10_10K-E-006_group_region.png');
    });

    await test.step('[10K-E-003] Tab x6 and Shift+Tab x3 keep focus inside the dialog', async () => {
      const inside = (): Promise<boolean> => dialog.evaluate((el) => el.contains(document.activeElement)); // createFocusTrap, GSH:116

      for (const press of [...Array<string>(6).fill('Tab'), ...Array<string>(3).fill('Shift+Tab')]) {
        await page.keyboard.press(press);
        await expect.poll(inside, { message: `focus inside after ${press}` }).toBe(true);
      }
      await captureEvidence(page, 'K10_10K-E-003_focus_trap.png');
    });

    await test.step('[10K-C-009] ⚑ route change while the help is open: it must not stay open on the new screen', async () => {
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await page.getByRole('navigation', { name: BREADCRUMB_NAV }).getByRole('button', { name: BREADCRUMB_PROJECTS, exact: true }).click();
      await expect(dashboardHeading(page)).toBeVisible();
      await focusAnchor(dashboardHeading(page));
      await page.keyboard.press('?');
      await expect(dialog).toBeVisible();
      await page.goBack(); // popstate of the SPA, no reload: RT:300 isHelpOpen lives above every route
      await expect(floorsHeading(page)).toBeVisible();
      await expect.soft(dialog, 'help must close when the path changes (RT:300-309)').toHaveCount(0);
      await captureEvidence(page, 'K10_10K-C-009_help_after_back.png');
      await page.keyboard.press('Escape'); // closes it if the bug left it open; a no-layer Esc is harmless
      await expect(dialog).toBeHidden();
      await expect(page).toHaveURL(new RegExp(`${ROUTES.project.floors(projectId)}$`, 'u'));
    });

    const sentBefore = requests.sent.length;
    const errorsBefore = errors.errors.length;
    const noEffect = async (): Promise<void> => {
      await nextFrame(page);
      await expect.soft(floorsHeading(page)).toBeVisible();
      expect.soft(writesOf(requests.sent.slice(sentBefore)), 'no write request').toEqual([]);
      expect.soft(errors.errors.slice(errorsBefore), 'no console/page error').toEqual([]);
    };

    await test.step('[10K-A-009] Ctrl+Z on a screen with no history: no error, no write', async () => {
      await focusAnchor(floorsHeading(page));
      await page.keyboard.press('Control+z'); // RT:222 undo reads the store, empty history
      await noEffect();
      await captureEvidence(page, 'K10_10K-A-009_ctrl_z.png');
    });

    await test.step('[10K-A-010] Ctrl+Shift+Z: no error, no write', async () => {
      await page.keyboard.press('Control+Shift+z'); // SR:736-745, RT:226
      await noEffect();
      await captureEvidence(page, 'K10_10K-A-010_ctrl_shift_z.png');
    });

    await test.step('[10K-A-011] Ctrl+S with no autosave attached: no PUT', async () => {
      await page.keyboard.press('Control+s'); // flushAutosaves() is empty, RT:236
      await noEffect();
      expect.soft(requests.sent.slice(sentBefore).filter((line) => line.startsWith('PUT ')), 'no PUT').toEqual([]);
      await captureEvidence(page, 'K10_10K-A-011_ctrl_s.png');
    });

    await test.step('[10K-C-005] Ctrl+S is preventDefault-ed (no browser save dialog)', async () => {
      expect.soft(await keys.verdict('s'), 'defaultPrevented of the Ctrl+S keydown').toBe(true); // SR:466
      await captureEvidence(page, 'K10_10K-C-005_ctrl_s_prevented.png');
    });

    await test.step('[10K-G-002] steps 11-13 sent no PUT/POST/PATCH/DELETE besides the session refresh', async () => {
      expect.soft(writesOf(requests.sent.slice(sentBefore)), 'writes during Ctrl+Z / Ctrl+Shift+Z / Ctrl+S').toEqual([]);
      await captureEvidence(page, 'K10_10K-G-002_no_writes.png');
    });
  } finally {
    requests.stop();
    errors.stop();
  }
});

test('SCR-41 · FL-10K-03 · admin · dashboard /: phím trong ô nhập, lặp phím, bảng modal', async ({ page }) => {
  const requests = recordApi(page);
  const errors = recordPageErrors(page);

  try {
    await signInAdmin(page);
    await expect(dashboardHeading(page)).toBeVisible();
    const keys = await trackKeys(page);
    const dialog = helpDialog(page);

    await test.step('[10K-C-004] Ctrl+F outside the 3D screen is not taken', async () => {
      await focusAnchor(dashboardHeading(page));
      await page.keyboard.press('Control+f'); // global.search is not registered, RT:279-283
      await nextFrame(page);
      await expect.soft(dialog).toHaveCount(0);
      expect.soft(await keys.verdict('f'), 'defaultPrevented of the Ctrl+F keydown').toBe(false);
      await captureEvidence(page, 'K10_10K-C-004_ctrl_f.png');
    });

    await test.step('[10K-C-003] holding ? (auto-repeat) opens the help once, never toggles it shut', async () => {
      await focusAnchor(dashboardHeading(page));
      await page.keyboard.down('?');
      await page.keyboard.down('?'); // second keydown has repeat=true, SR:563-568
      await page.keyboard.up('?');
      await expect.soft(dialog).toBeVisible();
      expect.soft(await stayedOpen(page), 'help stays open after the repeated keydown').toBe(true);
      await captureEvidence(page, 'K10_10K-C-003_repeat.png');
      await page.keyboard.press('Escape');
      await expect.soft(dialog).toBeHidden();
    });

    await test.step('[10K-C-006] with the help open, n does not open the create-project dialog', async () => {
      await focusAnchor(dashboardHeading(page));
      await page.keyboard.press('?');
      await expect(dialog).toBeVisible(); // landmark before the absence check
      await page.keyboard.press('n'); // 'dialog' layer is modal, SR:596-612; dashboard.createProject is global
      await nextFrame(page);
      await expect.soft(dialog).toBeVisible();
      await expect.soft(page.getByRole('dialog', { name: CREATE_DIALOG, exact: true })).toHaveCount(0);
      await captureEvidence(page, 'K10_10K-C-006_n_swallowed.png');
      await page.keyboard.press('Escape');
      await expect.soft(dialog).toBeHidden();
    });

    await test.step('[10K-C-008] Esc with no layer open: page unchanged, no error', async () => {
      const url = page.url();
      const errorsBefore = errors.errors.length;

      await focusAnchor(dashboardHeading(page));
      await page.keyboard.press('Escape'); // global.closeTopLayer, RT:320
      await nextFrame(page);
      expect.soft(page.url()).toBe(url);
      await expect.soft(dashboardHeading(page)).toBeVisible();
      expect.soft(errors.errors.slice(errorsBefore), 'no console/page error').toEqual([]);
      await captureEvidence(page, 'K10_10K-C-008_esc_no_layer.png');
    });

    await test.step('[10K-C-002] Ctrl+Z inside the search box is not taken from the browser', async () => {
      const search = page.getByRole('searchbox', { name: SEARCH_LABEL, exact: true });
      const sentBefore = requests.sent.length;

      await search.focus();
      await page.keyboard.press('Control+z'); // typing target: registry ignores everything but Escape, SR:532
      await nextFrame(page);
      expect.soft(await keys.verdict('z'), 'defaultPrevented of the Ctrl+Z keydown').toBe(false);
      expect.soft(requests.sent.slice(sentBefore), 'no request').toEqual([]);
      await captureEvidence(page, 'K10_10K-C-002_ctrl_z_in_input.png');
    });
  } finally {
    requests.stop();
    errors.stop();
  }
});
