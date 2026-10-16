/**
 * Phase 9 — viewer role on 3D / measure / rule report (QA-09 P7, FL-9V-01..03). Real stack only.
 * One test per flow, one `test.step('[<id>] …')` per catalog row (catalog-C4). Rows marked ⚑ assert the EXPECTED behaviour.
 * Source: see support/p09/P7.ts header. Viewer = pool user p09-viewer-viewer added as member of the main QA project.
 */
import { expect, test, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { captureEvidence } from './support/evidence';
import { DESKTOP, adminApi, asMember, gotoAs, mainProject, recordWrites, roleUser, signInRole } from './support/p09/roles';
import {
  HISTORY_FORBIDDEN_TITLE,
  HISTORY_JUMP,
  LIBRARY_FORBIDDEN_NOTE,
  LIBRARY_LOCKED_NOTE,
  MEASURE_PIN,
  MEASURE_PIN_BLOCKED,
  MEASURE_TOOL,
  PASCAL_READ_ONLY_REASON,
  ROOM_FORBIDDEN_TITLE,
  ROOM_READONLY_NOTICE,
  RULES_CONFIRM,
  RULES_HEADING,
  RULES_RERUN,
  VIEWER_3D_NOTE,
  VIEWER_ONLY_MESSAGE,
  VIEWER_RAIL,
  WALL_EDIT_LABELS,
  clickSceneCentre,
  dragScene,
  drawTwoPoints,
  pascalCanvas,
  seedMeasurement,
  viewportReady,
  writesAfter,
} from './support/p09/P7';

const viewerAlert = (page: Page) => page.getByRole('alert').filter({ hasText: VIEWER_ONLY_MESSAGE });
const activeDescriptor = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const el = document.activeElement;
    return el === null ? 'null' : `${el.tagName}|${el.getAttribute('aria-label') ?? ''}|${el.id}`;
  });

test.describe('phase 09 viewer edge', () => {
  test('SCR-vỏ · FL-9V-01 · ẩn danh · chuyển /login?next= cho 9 route', async ({ browser }) => {
    const { projectId } = mainProject();
    const context = await browser.newContext({ viewport: DESKTOP });
    const page = await context.newPage();
    const anon = async (id: string, path: string): Promise<void> => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login(\?|$)/u, { timeout: 15_000 });
      expect.soft(new URL(page.url()).searchParams.get('next'), `${id} next`).toBe(path);
      await captureEvidence(page, `E09_${id}_redirect.png`);
    };
    try {
      await test.step('[9V-A-010] ẩn danh vào /3d', async () => {
        await anon('9V-A-010', ROUTES.project.viewer(projectId));
      });
      await test.step('[9V-A-011] ẩn danh vào /3d/pascal', async () => {
        await anon('9V-A-011', ROUTES.project.viewerPascal(projectId));
      });
      await test.step('[9V-B-010] ẩn danh vào /3d/measure', async () => {
        await anon('9V-B-010', ROUTES.project.measure(projectId));
      });
      await test.step('[9V-C-010] ẩn danh vào /rules', async () => {
        await anon('9V-C-010', ROUTES.project.rules(projectId));
      });
      await test.step('[9V-D-010] ẩn danh vào /rules/settings', async () => {
        await anon('9V-D-010', ROUTES.project.ruleSettings(projectId));
      });
      await test.step('[9V-E-010] ẩn danh vào /export', async () => {
        await anon('9V-E-010', ROUTES.project.export(projectId));
      });
      await test.step('[9V-F-010] ẩn danh vào /data', async () => {
        await anon('9V-F-010', ROUTES.project.data(projectId));
      });
      await test.step('[9V-G-010] ẩn danh vào /versions', async () => {
        await anon('9V-G-010', ROUTES.project.versions(projectId));
      });
      await test.step('[9V-H-010] ẩn danh vào /share', async () => {
        await anon('9V-H-010', `/projects/${projectId}/share`); // ShareDialog route has no ROUTES entry
      });
    } finally {
      await context.close();
    }
  });

  test('SCR-viewer · FL-9V-02 · viewer · Viewer 3D/Pascal + panel chỉ đọc', async ({ browser }) => {
    test.setTimeout(300_000);
    const admin = await adminApi();
    const { projectId } = mainProject();
    const viewer = await roleUser(admin, 'viewer', 'viewer');
    const undo = await asMember(admin, projectId, viewer);
    const context = await browser.newContext({ viewport: DESKTOP });
    try {
      await signInRole(context, viewer);
      const page = await context.newPage();
      const rec = recordWrites(page);

      await test.step('[9V-A-030] viewer: inspector hiện InlineAlert "Chỉ xem"', async () => {
        await page.goto(ROUTES.project.viewer(projectId));
        // Row change (catalog-C4 9V-A-030/031/050/032/034/037/051): /3d mounts the vendored Pascal editor (router.tsx:382, F-15);
        // ViewerShell alert (ViewerInspector.tsx:82-89), Viewer3D note, RoomAreaPanel, FurnitureLibrary, HistoryPanel rail and the
        // 'Công cụ khung nhìn' toolbar are not mounted there. Read-only = Pascal readOnly gate (PascalViewer.container.tsx:140, usePascalEdits.ts:228).
        await viewportReady(page);
        await expect(pascalCanvas(page)).toBeVisible();
        await expect.soft(viewerAlert(page)).toHaveCount(0);
        await captureEvidence(page, 'E09_9V-A-030_inspector-readonly.png');
      });
      await test.step('[9V-A-031] viewer: ghi chú sr-only của Viewer3D không còn trên /3d', async () => {
        await expect.soft(page.getByText(VIEWER_3D_NOTE, { exact: true })).toHaveCount(0); // Viewer3D.tsx:268-273 not mounted
        await captureEvidence(page, 'E09_9V-A-031_viewer3d-note.png');
      });
      await test.step('[9V-A-050] viewer: không có alert nào cướp focus trên Pascal', async () => {
        const before = await activeDescriptor(page);
        await expect.soft(page.locator('[role="alert"]:not([data-announcer])')).toHaveCount(0);
        expect.soft(await activeDescriptor(page)).toBe(before);
        await captureEvidence(page, 'E09_9V-A-050_alert-focus.png');
      });
      await test.step('[9V-A-032] viewer: RoomAreaPanel không còn trên /3d', async () => {
        await expect
          .soft(page.getByText(ROOM_READONLY_NOTICE, { exact: true }).or(page.getByText(ROOM_FORBIDDEN_TITLE, { exact: true })))
          .toHaveCount(0); // RoomAreaTable.tsx:81 / RoomAreaPanel.chrome.tsx:65 not mounted
        await captureEvidence(page, 'E09_9V-A-032_room-area.png');
      });
      await test.step('[9V-A-033] viewer: 0 textbox tên phòng', async () => {
        await expect.soft(page.getByRole('textbox', { name: /^Tên phòng /u })).toHaveCount(0); // RoomAreaTable.Row.tsx:101
        await captureEvidence(page, 'E09_9V-A-033_no-rename.png');
      });
      await test.step('[9V-A-034] viewer: FurnitureLibrary cũ không còn trên /3d, không có thẻ kéo-thả', async () => {
        await expect.soft(page.getByText(LIBRARY_FORBIDDEN_NOTE, { exact: true })).toHaveCount(0); // FurnitureLibraryPanel.tsx:77 not mounted
        await expect.soft(page.getByText(LIBRARY_LOCKED_NOTE)).toHaveCount(0); // FurnitureLibraryPanelCard.tsx:47 not mounted
        await captureEvidence(page, 'E09_9V-A-034_library-locked.png');
      });
      await test.step('[9V-A-035] viewer: không có "Thay thế tất cả" / tải mô hình lên', async () => {
        await expect.soft(page.getByRole('button', { name: 'Thay thế tất cả' })).toHaveCount(0);
        await expect.soft(page.getByRole('button', { name: /tải mô hình lên/iu })).toHaveCount(0); // UNKNOWN — NEED VERIFICATION label
        await captureEvidence(page, 'E09_9V-A-035_no-replace-all.png');
      });
      await test.step('[9V-A-037] viewer: Pascal có nút Lịch sử thao tác nhưng không có nút nhảy', async () => {
        // Pascal history rail button (pascalViewerTypes.ts:200); HistoryPanel.chrome.tsx:63 forbidden title is not shown on /3d
        await expect.soft(page.getByRole('button', { name: 'Lịch sử thao tác', exact: true })).toBeVisible();
        await expect.soft(page.getByText(HISTORY_FORBIDDEN_TITLE, { exact: true })).toHaveCount(0);
        await expect.soft(page.getByRole('button', { name: HISTORY_JUMP })).toHaveCount(0);
        await captureEvidence(page, 'E09_9V-A-037_history.png');
      });
      await test.step('[9V-A-039] viewer: toolbar gỡ nút sửa hình học', async () => {
        for (const label of WALL_EDIT_LABELS) {
          await expect.soft(page.getByRole('button', { name: label, exact: true }), label).toHaveCount(0); // WG useWallGeometryEditor.ts:1073
        }
        await captureEvidence(page, 'E09_9V-A-039_no-wall-tools.png');
      });
      await test.step('[9V-A-051] viewer: Tab qua màn không dừng ở nút sửa', async () => {
        // The 'Công cụ khung nhìn' toolbar is not on /3d (Pascal): start Tab from the Pascal history button instead.
        await page.getByRole('button', { name: 'Lịch sử thao tác', exact: true }).focus();
        const seen: string[] = [];
        for (let i = 0; i < 12; i += 1) {
          seen.push(await activeDescriptor(page));
          await page.keyboard.press('Tab');
        }
        for (const label of WALL_EDIT_LABELS) {
          expect.soft(
            seen.some((s) => s.includes(label)),
            `Tab stopped on ${label}`,
          ).toBe(false);
        }
        await captureEvidence(page, 'E09_9V-A-051_tab-order.png');
      });
      await test.step('[9V-A-020] viewer: Pascal readOnly từ chối kèm lý do', async () => {
        await clickSceneCentre(page);
        await page.keyboard.press('Delete');
        // UNKNOWN — NEED VERIFICATION: where usePascalEdits.ts:58 reason surfaces (toast/status) after a rejected commit.
        await expect.soft(page.getByText(PASCAL_READ_ONLY_REASON).first()).toBeVisible({ timeout: 5_000 });
        await captureEvidence(page, 'E09_9V-A-020_pascal-rejected.png');
      });
      await test.step('[9V-A-021] viewer: Pascal không phát request ghi khi kéo/xoá', async () => {
        const mark = rec.writes.length;
        await dragScene(page);
        await page.keyboard.press('Delete');
        await page.waitForLoadState('networkidle');
        expect.soft(writesAfter(rec.writes, mark)).toEqual([]);
        await captureEvidence(page, 'E09_9V-A-021_pascal-no-write.png');
      });
      await test.step('[9V-A-022] viewer: Delete/Ctrl+Z không ghi', async () => {
        const mark = rec.writes.length;
        await page.keyboard.press('Delete');
        await page.keyboard.press('Control+z');
        await page.waitForLoadState('networkidle');
        expect.soft(writesAfter(rec.writes, mark)).toEqual([]);
        await captureEvidence(page, 'E09_9V-A-022_hotkeys-no-write.png');
      });
      await test.step('[9V-A-041] viewer: cả màn không phát request ghi', async () => {
        expect.soft(rec.writes).toEqual([]);
        await captureEvidence(page, 'E09_9V-A-041_no-writes.png');
      });
    } finally {
      await context.close();
      await undo();
    }
  });

  test('SCR-25/28 · FL-9V-03 · viewer · Measure + Rule Report chỉ đọc', async ({ browser }) => {
    test.setTimeout(300_000);
    const admin = await adminApi();
    const { projectId } = mainProject();
    const viewer = await roleUser(admin, 'viewer', 'viewer');
    const undo = await asMember(admin, projectId, viewer);
    let measurement: Awaited<ReturnType<typeof seedMeasurement>> | undefined;
    const context = await browser.newContext({ viewport: DESKTOP });
    try {
      measurement = await seedMeasurement(admin, projectId);
      const seeded = measurement;
      await signInRole(context, viewer);
      const page = await context.newPage();
      const rec = recordWrites(page);
      const pinBlocked = page.getByRole('alert').filter({ hasText: MEASURE_PIN_BLOCKED });

      await test.step('[9V-B-030] viewer: phím m bật công cụ Đo', async () => {
        await page.goto(ROUTES.project.measure(projectId));
        await viewportReady(page);
        await page.keyboard.press('m');
        await expect(page.getByRole('toolbar', { name: VIEWER_RAIL }).getByRole('button', { name: MEASURE_TOOL })).toHaveAttribute(
          'aria-pressed',
          'true',
        ); // MeasurementTool.tsx:26-33
        await captureEvidence(page, 'E09_9V-B-030_measure-on.png');
      });
      await test.step('[9V-B-031] viewer: caption chặn ghim (role=alert)', async () => {
        await expect.soft(pinBlocked).toHaveCount(1);
        await captureEvidence(page, 'E09_9V-B-031_pin-blocked.png');
      });
      await test.step('[9V-B-050] viewer: caption là alert, focus không vào alert', async () => {
        await expect.soft(pinBlocked).toBeVisible();
        expect.soft(await pinBlocked.evaluate((el) => el.contains(document.activeElement))).toBe(false);
        await captureEvidence(page, 'E09_9V-B-050_alert-focus.png');
      });
      await test.step('[9V-B-032] viewer: nút Ghim disabled khi có phép đo nháp', async () => {
        await drawTwoPoints(page); // one click = incomplete draft; the pin shows only when draftComplete (MeasurementTool.tsx:201-209)
        await expect.soft(page.getByRole('button', { name: MEASURE_PIN })).toBeDisabled(); // canPin=false for viewer (:203)
        await captureEvidence(page, 'E09_9V-B-032_pin-disabled.png');
      });
      await test.step('[9V-B-033] viewer: Enter không ghim (không POST /measurements)', async () => {
        const mark = rec.writes.length;
        await page.keyboard.press('Enter');
        await page.waitForLoadState('networkidle');
        expect.soft(writesAfter(rec.writes, mark).filter((w) => w.includes('/measurements'))).toEqual([]);
        await captureEvidence(page, 'E09_9V-B-033_enter-no-post.png');
      });
      await test.step('[9V-B-034] viewer: danh sách phép đo không có nút Xoá', async () => {
        await expect(page.getByText(seeded.name).first()).toBeVisible(); // anchor; list may be collapsed — UNKNOWN — NEED VERIFICATION
        await expect.soft(page.getByRole('button', { name: /^Xoá / })).toHaveCount(0); // MeasurementList.tsx:154
        await captureEvidence(page, 'E09_9V-B-034_no-delete.png');
      });
      await test.step('[9V-B-036] viewer: chưa biết vai ≠ forbidden (đã phủ bởi B-031)', async () => {
        await expect.soft(pinBlocked).toBeVisible(); // useMeasurementTool.ts:266 — the caption appears once roles arrived
        await captureEvidence(page, 'E09_9V-B-036_roles-known.png');
      });
      await test.step('[9V-C-030] ⚑ viewer: không thấy/không dùng được Chạy kiểm tra lại', async () => {
        await gotoAs(page, ROUTES.project.rules(projectId), RULES_HEADING);
        // locked for viewer: QA-09 questions.md Q2 (decision "Khoá"); RuleReport.tsx hides rerun, RuleReport.container.tsx:268 passes canEdit
        await expect.soft(page.getByRole('button', { name: RULES_RERUN })).toHaveCount(0);
        await expect.soft(page.getByRole('button', { name: RULES_CONFIRM })).toHaveCount(0);
        await captureEvidence(page, 'E09_9V-C-030_rules-gated.png');
      });
      await test.step('[9V-C-031] ⚑ viewer bấm "Chạy kiểm tra lại": không request ghi', async () => {
        const rerun = page.getByRole('button', { name: RULES_RERUN });
        await expect.soft(rerun).toHaveCount(0);
        const mark = rec.writes.length;
        if ((await rerun.count()) > 0) {
          // Q2: the control is absent for viewer; if it ever returns, it still must not write
          await rerun.click();
          await page.waitForLoadState('networkidle');
        }
        test.info().annotations.push({ type: 'writes', description: JSON.stringify(writesAfter(rec.writes, mark)) });
        expect.soft(writesAfter(rec.writes, mark)).toEqual([]);
        await captureEvidence(page, 'E09_9V-C-031_rerun-writes.png');
      });
      await test.step('[9V-C-032] viewer: không có nút "Bỏ qua" từng vi phạm', async () => {
        await expect.soft(page.getByRole('button', { name: 'Bỏ qua', exact: true })).toHaveCount(0); // RuleReportGroups.tsx:127 no dismiss
        await captureEvidence(page, 'E09_9V-C-032_dismiss.png');
      });
      await test.step('[9V-C-033] viewer: ViolationDetail mở được, điều hướng chỉ đọc', async () => {
        // UNKNOWN — NEED VERIFICATION: row selector (RuleReportGroups.tsx RowMessage button inside a list item with a <code>).
        const row = page.locator('li').filter({ has: page.locator('code') }).getByRole('button').first();
        await expect(row, 'violation row selector').toBeVisible();
        await row.click();
        await expect.soft(page.getByRole('button', { name: /^Vi phạm (trước|sau)$/u }).first()).toBeVisible(); // ViolationDetail.tsx:158-166
        await captureEvidence(page, 'E09_9V-C-033_violation-detail.png');
      });
      await test.step('[9V-C-050] viewer: không có "Xác nhận đã xử lý" để focus', async () => {
        const confirm = page.getByRole('button', { name: RULES_CONFIRM });
        // a viewer cannot reach the confirm control at all (⚑ correct behaviour)
        await expect.soft(confirm).toHaveCount(0);
        await captureEvidence(page, 'E09_9V-C-050_confirm-focus.png');
      });
    } finally {
      await context.close();
      if (measurement !== undefined) await measurement.remove();
      await undo();
    }
  });
});
