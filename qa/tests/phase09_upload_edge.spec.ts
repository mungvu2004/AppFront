/**
 * Phase 9 — role matrix, viewer on SCR-09 floors, SCR-10/11 upload + quality, SCR-12/13 progress + graph + failure,
 * SCR-14/15/16 scale + overlay + CAD (FL-9U-01..04 of QA-09 flows-C2). Real stack, pool viewer `p09-up-viewer`.
 * Seeds are admin-owned own projects (the viewer is added to them; deleting the project drops the membership) so the main
 * chain project is never touched. The BE has no per-project role: the viewer is a viewer by account role.
 */
import { expect, test, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { captureEvidence } from './support/evidence';
import { createPipelineDrawingProject, deleteSeededProject } from './support/drawingSeed';
import { floorRows } from './support/p03/P4';
import { card, fireDrag, pngFile, tray, UP } from './support/p03/P6';
import { CAD, GRAPH } from './support/p03/P10';
import { PF, PR } from './support/p03/P8';
import { closeViewer, createCadProject, openViewer, type ViewerSession } from './support/p09/P3';
import { adminApi, gotoAs, recordWrites } from './support/p09/roles';
import { createDrawingProject, createFailedRunProject, createProject, envDrawingPng } from './support/phase03Seed';

const FORBIDDEN_TITLE = 'Không có quyền sửa tầng'; // FM:76
const FORBIDDEN_SENTENCE = 'Vai của bạn chỉ xem được ngăn xếp tầng; mọi thao tác sửa đã được ẩn.'; // UFM:183
const VIEWER_EMPTY = 'Khi người có quyền sửa thêm tầng, ngăn xếp tầng sẽ hiện ở đây.'; // UFM:1755
const SCALE_TITLE = 'Bạn không có quyền hiệu chỉnh tỷ lệ'; // SC:77
const SCALE_SENTENCE =
  'Bản vẽ vẫn xem và phóng to được, nhưng không kéo được đường tham chiếu. Nhờ người có quyền sửa dự án đặt tỷ lệ giúp.'; // USC:210
const OVERLAY_NOTICE = 'Bạn chỉ được xem; việc đổi căn chỉnh dành cho người có quyền sửa.'; // UOC:128
const OVERLAY_REASON = 'Chỉ người có quyền sửa mới xác nhận được.'; // UOC:122
const CONFIRM = 'Khớp rồi, xác nhận';
const QUALITY_ACK = 'Tôi đã đọc cảnh báo và vẫn muốn xử lý bản vẽ này'; // checkbox removed in S-09 (the count-0 assertion below stays true)

/** Waits a bounded window for any non-GET /api request, then asserts no recorded write (matching `only`) exists. */
async function noWrites(page: Page, rec: { writes: string[] }, only?: string): Promise<void> {
  // fixed-wait-ok: absence of a request can only be shown by waiting a bounded window
  await expect(
    page.waitForRequest((r) => r.method() !== 'GET' && r.url().includes('/api/'), { timeout: 2_000 }),
  ).rejects.toThrow();
  const re = only === undefined ? /./u : new RegExp(only, 'u');
  expect.soft(rec.writes.filter((w) => re.test(w))).toEqual([]);
}

test('SCR-09 · FL-9U-01 · viewer · viewer doc: SCR-09 tang chi-doc', async ({ browser }) => {
  test.setTimeout(120_000);
  const admin = await adminApi();
  const owned: string[] = [];
  let s: ViewerSession | undefined;
  try {
    // Floor 1 holds a drawing (the overlay button needs row.hasDrawing, FloorTableRow.tsx:405); floor 2 stays "Chưa có bản vẽ".
    const project = await createDrawingProject(admin, '9u-01', envDrawingPng(), ['Tầng 1', 'Tầng 2']);
    const empty = await createProject(admin, '9u-01e', 0);
    owned.push(project.projectId, empty.projectId);
    s = await openViewer(browser, admin, owned);
    const { page } = s;
    const rec = recordWrites(page);

    await test.step('[9U-D-001] viewer: banner replaces the edit controls', async () => {
      await page.goto(ROUTES.project.floors(project.projectId));
      await expect(floorRows(page)).toHaveCount(2); // anchor: floors read answered
      const banner = page.getByRole('status').filter({ hasText: FORBIDDEN_TITLE }); // FM:76
      await expect(banner.getByRole('heading', { name: FORBIDDEN_TITLE })).toBeVisible();
      await expect(banner).toContainText(FORBIDDEN_SENTENCE);
      await captureEvidence(page, 'E09_9U-D-001_viewer_banner.png');
    });

    await test.step('[9U-D-002] viewer: no "Thêm tầng" / "Nhân bản tầng"', async () => {
      await floorRows(page).first().click();
      await expect.soft(page.getByRole('button', { name: 'Thêm tầng', exact: true })).toHaveCount(0); // FT:80-81,196,231
      await expect.soft(page.getByRole('button', { name: 'Nhân bản tầng', exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E09_9U-D-002_no_add_duplicate.png');
    });

    await test.step('[9U-D-003] viewer: no row menu, no textbox, no copy-furniture button', async () => {
      await expect.soft(page.getByRole('button', { name: /^Thao tác khác cho tầng /u })).toHaveCount(0); // FT:164-182
      for (const item of ['Đổi tên', 'Nhân bản', 'Xoá tầng']) await expect.soft(page.getByRole('menuitem', { name: item })).toHaveCount(0);
      await expect.soft(page.getByRole('textbox')).toHaveCount(0); // FTR:246-418
      await expect.soft(page.getByRole('button', { name: /Sao chép nội thất sang tầng mới/u })).toHaveCount(0);
      await captureEvidence(page, 'E09_9U-D-003_no_row_edit.png');
    });

    await test.step('[9U-D-004] viewer: "Chưa có bản vẽ" stays, no "Tải lên" link', async () => {
      await expect.soft(floorRows(page).filter({ hasText: 'Chưa có bản vẽ' }).first().getByText('Chưa có bản vẽ', { exact: true })).toBeVisible(); // FTR:54,57
      await expect.soft(page.getByRole('link', { name: 'Tải lên', exact: true })).toHaveCount(0); // FTR:334
      await expect.soft(page.getByRole('button', { name: 'Tải lên', exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E09_9U-D-004_no_upload_link.png');
    });

    await test.step('[9U-D-005] viewer: "Đối chiếu lớp phủ" stays available (read-only)', async () => {
      // FTR:403 `(canEdit || onOpenOverlay !== undefined)`. UNKNOWN — NEED VERIFICATION: whether a row without drawing shows it.
      await expect.soft(page.getByRole('button', { name: /Đối chiếu lớp phủ/u }).first()).toBeVisible();
      await captureEvidence(page, 'E09_9U-D-005_overlay_button.png');
    });

    await test.step('[9U-D-006] viewer: Ctrl+Z / Alt+click change nothing and send nothing', async () => {
      const labels = () => floorRows(page).evaluateAll((rows) => rows.map((r) => r.getAttribute('aria-label') ?? ''));
      const before = await labels();
      await floorRows(page).first().click({ modifiers: ['Alt'] }); // FTR:192
      await page.keyboard.press('Control+z'); // UFM:1530 enabled:canEdit
      await expect.soft(floorRows(page)).toHaveCount(2);
      expect.soft(await labels()).toEqual(before);
      await noWrites(page, rec);
      await captureEvidence(page, 'E09_9U-D-006_shortcuts_noop.png');
    });

    await test.step('[9U-D-007] viewer: no write request after the table is shown', async () => {
      await expect(floorRows(page)).toHaveCount(2); // anchor: floors GET answered
      expect.soft(rec.writes).toEqual([]);
      await captureEvidence(page, 'E09_9U-D-007_no_writes.png');
    });

    await test.step('[9U-D-008] viewer, 0-floor project: viewer-only empty sentence, no "Thêm tầng"', async () => {
      await page.goto(ROUTES.project.floors(empty.projectId));
      await expect(page.getByText(VIEWER_EMPTY, { exact: true })).toBeVisible(); // UFM:1755
      await expect.soft(page.getByRole('button', { name: 'Thêm tầng', exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E09_9U-D-008_viewer_empty.png');
    });

    await test.step('[9U-E-001] viewer: banner is role=status; Tab never lands on a missing "Thêm tầng"', async () => {
      await page.goto(ROUTES.project.floors(project.projectId));
      await expect(floorRows(page)).toHaveCount(2);
      await expect.soft(page.getByRole('status').filter({ has: page.getByRole('heading', { name: FORBIDDEN_TITLE }) })).toHaveCount(1);
      for (let i = 0; i < 6; i += 1) {
        await page.keyboard.press('Tab');
        const name = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent ?? '');
        expect.soft(name).not.toContain('Thêm tầng');
      }
      await captureEvidence(page, 'E09_9U-E-001_status_tab.png');
    });
  } finally {
    await closeViewer(s);
    for (const id of owned) await deleteSeededProject(admin, id);
    await admin.dispose();
  }
});

test('SCR-10 · SCR-11 · FL-9U-02 · viewer · viewer doc: tai len + kiem tra chat luong', async ({ browser }) => {
  test.setTimeout(240_000);
  const admin = await adminApi();
  let projectId: string | undefined;
  let s: ViewerSession | undefined;
  try {
    const seeded = await createPipelineDrawingProject(admin, '9u-02', envDrawingPng());
    projectId = seeded.projectId;
    s = await openViewer(browser, admin, [projectId]);
    const { page } = s;
    const rec = recordWrites(page);
    const floorCard = card(page, seeded.floorId);

    await test.step('[9U-D-019] viewer: read-only sentence', async () => {
      await page.goto(ROUTES.project.upload(projectId!));
      await expect(page.getByText(UP.readOnly, { exact: true })).toBeVisible(); // UFU:112
      await captureEvidence(page, 'E09_9U-D-019_read_only.png');
    });

    await test.step('[9U-D-020] viewer: no drop zone / file input / "Chọn tệp"', async () => {
      await expect.soft(page.getByTestId(UP.dropzone)).toHaveCount(0); // UFU:103,454 canDrop
      await expect.soft(page.getByTestId(UP.fileInput)).toHaveCount(0);
      await expect.soft(page.getByRole('button', { name: 'Chọn tệp', exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E09_9U-D-020_no_dropzone.png');
    });

    await test.step('[9U-D-021] viewer: floor list readable, no page picker or delete', async () => {
      await expect.soft(page.getByRole('heading', { name: seeded.floorName })).toBeVisible(); // FU:210
      await expect.soft(floorCard.getByRole('combobox', { name: UP.pickPage })).toHaveCount(0); // UFU:1206-1208
      await expect.soft(floorCard.getByRole('button', { name: /^Xoá bản vẽ /u })).toHaveCount(0); // UFU:1232
      await captureEvidence(page, 'E09_9U-D-021_list_readable.png');
    });

    await test.step('[9U-D-022] viewer: "Bắt đầu xử lý" is hidden (BUG-536)', async () => {
      await expect.soft(page.getByRole('button', { name: UP.submit, exact: true })).toHaveCount(0); // UFU:115,1261
      await captureEvidence(page, 'E09_9U-D-022_no_submit.png');
    });

    await test.step('[9U-D-023] viewer: drop event adds nothing, no upload POST', async () => {
      const file = pngFile('mat-bang.png', Buffer.from('qa'));
      await fireDrag(floorCard, 'dragenter', [file]);
      await fireDrag(floorCard, 'drop', [file]);
      await expect.soft(tray(page)).toHaveCount(0);
      await noWrites(page, rec, "/drawings/uploads");
      await captureEvidence(page, 'E09_9U-D-023_drop_ignored.png');
    });

    await test.step('[9U-E-002] viewer: read-only line is plain text (no role=status), no interactive dropzone', async () => {
      // FU:257-258 is a <p>; the actual role is recorded, not guessed.
      await expect.soft(page.getByRole('status').filter({ hasText: UP.readOnly })).toHaveCount(0);
      await expect.soft(page.getByTestId(UP.dropzone)).toHaveCount(0);
      await captureEvidence(page, 'E09_9U-E-002_readonly_text.png');
    });

    await test.step('[9U-D-030] viewer: quality page has no action footer', async () => {
      const qualityRead = page.waitForResponse((r) => r.request().method() === 'GET' && /\/quality$/u.test(new URL(r.url()).pathname));
      await page.goto(ROUTES.project.quality(projectId!));
      expect((await qualityRead).status()).toBe(200);
      await expect.soft(page.getByRole('button', { name: /^(?:Xử lý dù ảnh mờ|Bắt đầu xử lý)$/u })).toHaveCount(0); // UIQ:145-147
      await expect.soft(page.getByRole('button', { name: /^(?:Tải ảnh nét hơn|Tải ảnh khác)$/u })).toHaveCount(0);
      await expect.soft(page.getByRole('checkbox', { name: QUALITY_ACK })).toHaveCount(0);
      await captureEvidence(page, 'E09_9U-D-030_quality_no_actions.png');
    });

    await test.step('[9U-D-031] viewer: no corner pick, no "Làm thẳng", no corners/straighten POST', async () => {
      // UNKNOWN — NEED VERIFICATION: the fake-ML drawing is straight, so the straighten/corners controls may be absent for every role.
      await expect.soft(page.getByRole('button', { name: /Làm thẳng|Chọn góc thủ công|Gửi bốn góc/u })).toHaveCount(0); // UIQ:1146,1159,1192
      await noWrites(page, rec, "corners|straighten");
      await captureEvidence(page, 'E09_9U-D-031_no_corners.png');
    });
  } finally {
    await closeViewer(s);
    if (projectId !== undefined) await deleteSeededProject(admin, projectId);
    await admin.dispose();
  }
});

test('SCR-12 · SCR-13 · FL-9U-03 · viewer · viewer doc: tien trinh + do thi + loi', async ({ browser }) => {
  test.setTimeout(240_000);
  const admin = await adminApi();
  let projectId: string | undefined;
  let failedId: string | undefined;
  let s: ViewerSession | undefined;
  try {
    // A failed run renders PipelineFailure, not ProcessingScreen (ProcessingScreen.container.tsx:27-36): tabs/steps/graph need a done run.
    const seeded = await createPipelineDrawingProject(admin, '9u-03', envDrawingPng());
    projectId = seeded.projectId;
    const failed = await createFailedRunProject(admin, '9u-03f', 'FILE_CORRUPT');
    failedId = failed.projectId;
    s = await openViewer(browser, admin, [projectId, failedId]);
    const { page } = s;
    const rec = recordWrites(page);
    const button = (name: string) => page.getByRole('button', { name, exact: true });

    await test.step('[9U-D-039] viewer: both columns, steps list and log reachable', async () => {
      await page.goto(ROUTES.project.pipeline(projectId!));
      await expect(page.getByRole('tablist', { name: PR.tabs, exact: true })).toBeVisible(); // PS:27
      await expect.soft(page.getByRole('list', { name: PR.steps, exact: true })).toBeVisible();
      await expect.soft(button(PR.cancel)).toHaveCount(0);
      await captureEvidence(page, 'E09_9U-D-039_forbidden_two_columns.png');
    });

    await test.step('[9U-D-040] viewer: no "Huỷ xử lý" / "Xác nhận huỷ"', async () => {
      await expect.soft(button(PR.cancel)).toHaveCount(0); // PS:64-67; PG:826 cancelProcessing:false (also absent for engineer)
      await expect.soft(button('Xác nhận huỷ')).toHaveCount(0);
      await captureEvidence(page, 'E09_9U-D-040_no_cancel.png');
    });

    await test.step('[9U-D-041] viewer: only GET progress, no write', async () => {
      const progress = page.waitForResponse((r) => r.request().method() === 'GET' && /\/progress$/u.test(new URL(r.url()).pathname));
      await page.reload();
      expect.soft((await progress).status()).toBe(200); // drawings/router.py:102 member gate
      await expect(page.getByRole('tablist', { name: PR.tabs, exact: true })).toBeVisible();
      expect.soft(rec.writes).toEqual([]);
      await captureEvidence(page, 'E09_9U-D-041_progress_get_only.png');
    });

    await test.step('[9U-D-045] viewer, graph: overview only, empty state wins over the forbidden line', async () => {
      // The real route passes no `run` and the gateway answers branchReport unsupported (pipelineGraphGateway.ts:364), so the
      // graph is empty for every role; questions.md Q4 (usePipelineGraph.ts:545-547): empty before forbidden. Same deciding
      // value as FL-9U-U1 in p09-rr (title "Chưa có lượt xử lý nào để kể lại", no forbidden line). Forbidden copy: vitest PipelineGraph.test.tsx.
      await page.goto(ROUTES.project.pipelineGraph(projectId!));
      await expect(page.getByText(GRAPH.emptyTitle, { exact: true })).toBeVisible();
      await expect.soft(page.getByText(GRAPH.forbiddenLine, { exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E09_9U-D-045_overview_only.png');
    });

    await test.step('[9U-D-046] viewer, graph: no switch button, no technical detail block', async () => {
      await expect.soft(button(GRAPH.switch)).toHaveCount(0);
      await expect.soft(page.getByText(GRAPH.detail, { exact: true })).toHaveCount(0);
      expect.soft(rec.writes).toEqual([]);
      await captureEvidence(page, 'E09_9U-D-046_no_switch_no_detail.png');
    });

    await test.step('[9U-D-051] viewer, failed run: no three next-step directions', async () => {
      await page.goto(ROUTES.project.pipeline(failedId!));
      await expect(page.getByRole('alert').filter({ hasText: /không hoàn tất được/u })).toBeVisible({ timeout: 45_000 });
      for (const name of [PF.lower, PF.upload, PF.skip]) await expect.soft(button(name)).toHaveCount(0); // PFT:58-60
      await expect.soft(page.getByRole('group', { name: PF.nextSteps, exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E09_9U-D-051_no_next_steps.png');
    });

    await test.step('[9U-D-052] viewer, failed run: "Chi tiết kỹ thuật" toggle and "Sao chép" are gone', async () => {
      await expect.soft(button(PF.technical)).toHaveCount(0); // PFT:50
      await expect.soft(button(PF.copy)).toHaveCount(0);
      await captureEvidence(page, 'E09_9U-D-052_no_technical.png');
    });

    await test.step('[9U-D-053] viewer, failed run: Vietnamese warning with error code still readable', async () => {
      const alert = page.getByRole('alert').filter({ hasText: /không hoàn tất được/u });
      await expect.soft(alert).toContainText(PF.fileCorrupt);
      // RR2 deciding value (E09_9U-D-053 shot): PipelineFailure prints the bare code "FILE_CORRUPT" (small mono, right-aligned), no "Mã lỗi: " prefix:
      // PipelineFailureAlert.tsx:157 {reason.codeLabel}, pipelineFailureText.ts:200-201 codeLabel = code (+ " · yêu cầu <id>"), doc PipelineFailureAlert.tsx:33-37.
      // The prefix "Mã lỗi: " (vi.json:1426) belongs to CAD/Scale screens. Catalog 9U-D-053 wording is loose; the code stays readable for the viewer.
      await expect.soft(page.getByText('FILE_CORRUPT', { exact: true }).first()).toBeVisible();
      await captureEvidence(page, 'E09_9U-D-053_error_with_code.png');
    });
  } finally {
    await closeViewer(s);
    for (const id of [projectId, failedId]) if (id !== undefined) await deleteSeededProject(admin, id);
    await admin.dispose();
  }
});

test('SCR-14 · SCR-15 · SCR-16 · FL-9U-04 · viewer · viewer doc: ti le + doi chieu + CAD', async ({ browser }) => {
  test.setTimeout(300_000);
  const admin = await adminApi();
  const owned: string[] = [];
  let s: ViewerSession | undefined;
  try {
    const seeded = await createPipelineDrawingProject(admin, '9u-04', envDrawingPng());
    owned.push(seeded.projectId);
    // UNKNOWN — NEED VERIFICATION: no real .dxf seed exists; the CAD project is a plain project with floors.
    const cad = await createCadProject(admin, '9u-04c', 2);
    owned.push(cad.projectId);
    s = await openViewer(browser, admin, owned);
    const { page } = s;
    const rec = recordWrites(page);
    const button = (name: string) => page.getByRole('button', { name, exact: true });

    await test.step('[9U-D-056] viewer, SCR-14: forbidden title + sentence', async () => {
      await gotoAs(page, ROUTES.project.scale(seeded.projectId, seeded.floorId), SCALE_TITLE);
      // The sentence is drawn twice: visible in the status panel (USC:210) and sr-only on the canvas (ScaleCalibrationCanvas.tsx:63,432).
      await expect(page.getByText(SCALE_SENTENCE, { exact: true }).and(page.locator(':not(.sr-only)'))).toBeVisible();
      await expect.soft(page.locator('.sr-only').getByText(SCALE_SENTENCE, { exact: true })).toHaveCount(1);
      await captureEvidence(page, 'E09_9U-D-056_scale_forbidden.png');
    });

    await test.step('[9U-D-057] viewer, SCR-14: drawing visible, canvas not draggable, no request', async () => {
      await expect.soft(page.getByRole('img', { name: `Bản vẽ đã nắn của ${seeded.floorName}` })).toBeVisible();
      // The canvas frame is role="group" with this aria-label in every mode (ScaleCalibrationCanvas.tsx:336-346); only the inner <img alt> is an img.
      const canvas = page.getByRole('group', { name: 'Bản vẽ đã nắn, kéo để vẽ đường tham chiếu' });
      await expect(canvas).toBeVisible();
      const box = (await canvas.boundingBox())!;
      await page.mouse.move(box.x + 40, box.y + 40);
      await page.mouse.down();
      await page.mouse.move(box.x + 140, box.y + 90);
      await page.mouse.up();
      await expect.soft(page.getByRole('slider', { name: /Đầu đoạn tham chiếu/u })).toHaveCount(0); // USC:1858 isInteractive=false
      await noWrites(page, rec);
      await captureEvidence(page, 'E09_9U-D-057_canvas_readonly.png');
    });

    await test.step('[9U-D-058] viewer, SCR-14: no "Áp dụng tỷ lệ", method block not clickable', async () => {
      await expect.soft(button('Áp dụng tỷ lệ')).toHaveCount(0); // USC:212,1919
      // ScaleCalibrationPanel.tsx:147 radiogroup; SCP:165-168 section[aria-disabled] carries pointer-events-none (BUG-601)
      const radios = page.getByRole('radiogroup', { name: 'Chọn cách xác định tỷ lệ' }).getByRole('radio');
      await expect(radios.first()).toBeVisible();
      for (const radio of await radios.all()) await expect.soft(radio).toBeDisabled();
      await expect.soft(page.locator('section[aria-disabled="true"]').first()).toHaveClass(/pointer-events-none/u);
      await captureEvidence(page, 'E09_9U-D-058_no_apply.png');
    });

    await test.step('[9U-D-063] viewer, SCR-15: read-only warning band', async () => {
      await page.goto(ROUTES.project.overlay(seeded.projectId, seeded.floorId));
      await expect(page.getByRole('region', { name: 'So với bản vẽ', exact: true })).toBeVisible(); // VV:74
      await expect(page.getByText(OVERLAY_NOTICE, { exact: true })).toBeVisible(); // UOC:128,878
      await captureEvidence(page, 'E09_9U-D-063_overlay_notice.png');
    });

    await test.step('[9U-D-064] viewer, SCR-15: confirm button disabled with reason', async () => {
      await expect.soft(button(CONFIRM)).toBeDisabled(); // UOC:112,122,1008
      await expect.soft(page.getByText(OVERLAY_REASON, { exact: true })).toBeVisible();
      await captureEvidence(page, 'E09_9U-D-064_confirm_disabled.png');
    });

    await test.step('[9U-D-065] viewer, SCR-15: "Dung sai" field disabled', async () => {
      await expect.soft(page.getByLabel('Dung sai').first()).toBeDisabled(); // OCP:135
      await captureEvidence(page, 'E09_9U-D-065_tolerance_disabled.png');
    });

    await test.step('[9U-D-066] viewer, SCR-15: alignment locked, nudge sends no write', async () => {
      // RF deciding value: no "Khoá căn" control at all for the viewer (shot E09_9U-D-066: toolbar = floor/mode/opacity only).
      // Not a b8287e23 regression: the real gateway has supports.imageToModelTransform=false (overlayComparisonGateway.ts:339), so
      // canLockAlignment=false and the toolbar hides the switch for EVERY role (OverlayComparisonToolbar.tsx:218, types.ts:457, BUG-599).
      // With the capability on it is a role="switch" (Toggle.tsx:86) disabled for !canEdit: OverlayComparisonToolbar.test.tsx:148.
      // isAlignmentLocked=true for the viewer (UOC:1265): useOverlayComparison.test.ts:495.
      await expect.soft(page.getByRole('switch', { name: /Khoá căn/u })).toHaveCount(0);
      await expect.soft(page.getByRole('button', { name: /Khoá căn/u })).toHaveCount(0);
      await page.keyboard.press('ArrowRight');
      await noWrites(page, rec);
      await captureEvidence(page, 'E09_9U-D-066_alignment_locked.png');
    });

    await test.step('[9U-D-067] viewer, SCR-15: the toolbar does not repeat the sentence (BUG-636)', async () => {
      await expect.soft(page.getByText(OVERLAY_NOTICE, { exact: true })).toHaveCount(1); // OCT:232
      await captureEvidence(page, 'E09_9U-D-067_single_sentence.png');
    });

    await test.step('[9U-D-072] viewer, SCR-16: forbidden title + sentence', async () => {
      await page.goto(ROUTES.project.cadConfirm(cad.projectId, cad.floors[0]!.id));
      await expect(page.getByRole('heading', { name: CAD.forbiddenTitle })).toBeVisible(); // CB:97
      // BUG-P09-014: exactly ONE visible copy (the sr-only twin is not counted)
      const visibleNotice = page.getByText(CAD.forbiddenNotice, { exact: true }).and(page.locator(':not(.sr-only)'));
      await expect(visibleNotice).toHaveCount(1); // UCB:119
      await expect(visibleNotice).toBeVisible();
      await captureEvidence(page, 'E09_9U-D-072_cad_forbidden.png');
    });

    await test.step('[9U-D-073] viewer, SCR-16: CAD choice disabled, AI fallback stays open', async () => {
      await expect.soft(button(CAD.useCad)).toBeDisabled(); // UCB:680 isCadChoiceDisabled = error || forbidden
      // By design the AI branch is never blocked (useCadBranchConfirm.ts:699-700, "người dùng luôn phải quay về nhánh AI được")
      // and it writes nothing (setProcessingBranch has no endpoint, :717-720) - p09-rr showed it enabled for the viewer.
      await expect.soft(button(CAD.useAi)).toBeEnabled();
      await captureEvidence(page, 'E09_9U-D-073_choices_disabled.png');
    });

    await test.step('[9U-D-074] viewer, SCR-16: step two stays closed', async () => {
      await expect.soft(button(CAD.importButton)).toHaveCount(0); // CBT:156, UCB:932
      await expect.soft(page.getByRole('region', { name: CAD.stageTwo, exact: true })).toHaveCount(0); // CB:425
      await captureEvidence(page, 'E09_9U-D-074_no_stage_two.png');
    });

    await test.step('[9U-D-075] viewer, SCR-16: neither choice sends a write', async () => {
      await button(CAD.useCad).click({ force: true });
      await expect.soft(button(CAD.useCad)).toBeDisabled();
      await noWrites(page, rec);
      // AI last: it navigates to the pipeline (UCB:721) and has no endpoint to write to (UCB:717-720).
      await button(CAD.useAi).click();
      await noWrites(page, rec);
      await captureEvidence(page, 'E09_9U-D-075_no_writes_on_click.png');
    });
  } finally {
    await closeViewer(s);
    for (const id of owned) await deleteSeededProject(admin, id);
    await admin.dispose();
  }
});
