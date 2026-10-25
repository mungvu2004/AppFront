/**
 * Phase 9 QC viewer read-only screens SCR-16..21 (flows-C3 FL-9Q-01..06). Real stack, pool viewer `p09-qc-viewer`,
 * own QC project per flow (admin-seeded, viewer added as member, deleted in finally). SCR-18 reads the main chain floor
 * (OCR dimensions need the pipeline) with the viewer added and removed via asMember. Desktop 1440 only.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { captureEvidence } from './support/evidence';
import { createQcProject, deleteProject, layerPathOf, type SeededFloor } from './support/layerSeed';
import { layerApiFrom, openScreen, pressAll, seedQcForViewer, settle } from './support/p09/P5';
import { adminApi, apiAs, asMember, DESKTOP, gotoAs, mainProject, recordWrites, roleUser, signInRole } from './support/p09/roles';

test.use({ viewport: DESKTOP });

const SLOT = 'qc';
const shot = async (page: Page, id: string, slug: string): Promise<void> => {
  await captureEvidence(page, `E09_${id}_${slug}.png`);
};
const WRITE_KEYS = ['Enter', 'Delete', 'Backspace', 'm', 'r', 'ArrowRight', 'Control+z'] as const;

// SCR-16 copy: WallLayerInspector.tsx / useWallLayerReview.ts
const WALLS_REGION = 'Duyệt lớp tường';
const WALL_LIST = 'Danh sách đoạn tường';
const WALL_VIEW_ONLY = 'Bạn đang xem với vai người xem, nên không duyệt hay sửa được đoạn tường nào. Nhờ người có quyền sửa dự án duyệt giúp.';
// SCR-17
const OBJECTS_REGION = 'Lớp đối tượng';
const OBJECTS_RAIL = 'Công cụ lớp đối tượng';
const OBJECT_VIEW_ONLY = 'Bạn đang xem — không sửa được lớp này.'; // objectLayerReviewGateway.ts:1262
// SCR-18
const DIMS_REGION = 'Đọc kích thước OCR';
const DIM_LIST = 'Danh sách kích thước đọc được';
const DIM_VIEW_ONLY = 'Vai trò hiện tại chỉ được xem, không được chỉnh sửa lớp kích thước OCR. Liên hệ quản trị dự án nếu cần.';
// SCR-19
const GRIDS_REGION = 'Quản lý trục và gốc toạ độ';
const GRID_TITLE = 'Không có quyền sửa trục';
const GRID_VIEW_ONLY = 'Vai trò hiện tại chỉ được xem, không được chỉnh sửa các trục. Liên hệ quản trị dự án nếu cần.';
const GRID_ALIGN_REASON = 'Vai người xem không căn chỉnh được các tầng.';
const GRID_UNSAVED = 'Trục chỉ giữ trong phiên này — tải lại trang sẽ mất các thay đổi.';
// SCR-20
const ROOMS_TITLE = 'Không có quyền sửa lớp phòng';
const ROOM_VIEW_ONLY =
  'Bạn đang xem với vai người xem: đổi tên, đổi công năng, gộp, tách và duyệt đều tắt. Nhờ người quản trị dự án đổi vai nếu bạn cần sửa lớp phòng.';
const ROOM_CANVAS_DESC = 'Bản vẽ vẫn xem được, nhưng không chọn được phòng nào ở đây. Nhờ người có quyền sửa dự án duyệt giúp.';
// SCR-21
const THICKNESS_TITLE = 'Không có quyền sửa độ dày tường';
const THICKNESS_VIEW_ONLY =
  'Bạn đang xem với vai người xem: áp chuẩn hoá, gán nhóm và sửa dung sai đều tắt. Nhờ người quản trị dự án đổi vai nếu bạn cần sửa độ dày tường.';

test.describe('SCR-16..21 viewer read-only QC screens', () => {
  test('SCR-16 · FL-9Q-01 · viewer · lớp tường chỉ-xem', async ({ context, page }) => {
    test.setTimeout(240_000);
    const admin = await adminApi();
    const viewer = await roleUser(admin, 'viewer', SLOT);
    const fx = await seedQcForViewer(admin, viewer, 'p09-walls');
    try {
      await signInRole(context, viewer);
      const rec = recordWrites(page);
      const options = page.getByRole('listbox', { name: WALL_LIST, exact: true }).getByRole('option');
      await test.step('[9Q-A-001] viewer mở lớp tường, chọn đoạn thấy câu chỉ-xem', async () => {
        await openScreen(page, ROUTES.project.walls(fx.floor.projectId, fx.floor.floorId), page.getByRole('region', { name: WALLS_REGION, exact: true }));
        await expect(options.first()).toBeVisible();
        await options.first().click();
        await expect(page.getByText(WALL_VIEW_ONLY, { exact: true })).toBeVisible(); // WallLayerInspector.tsx:213-215
        await shot(page, '9Q-A-001', 'walls_view_only');
      });
      await test.step('[9Q-A-002] không nút duyệt/bỏ qua, độ dày chỉ đọc', async () => {
        await expect.soft(page.getByRole('button', { name: 'Duyệt đoạn này' })).toHaveCount(0);
        await expect.soft(page.getByRole('button', { name: 'Để sau', exact: true })).toHaveCount(0);
        await expect.soft(page.getByRole('radiogroup', { name: 'Độ dày tường' })).toHaveCount(0); // WallLayerInspector.tsx:130-132
        await shot(page, '9Q-A-002', 'no_review_buttons');
      });
      await test.step('[9Q-A-003] thanh công cụ chỉ đọc, không nút Nối đoạn', async () => {
        await expect.soft(page.getByRole('button', { name: 'Nối đoạn' })).toHaveCount(0); // WallLayerToolRail.tsx:100-131
        await shot(page, '9Q-A-003', 'no_merge_tool');
      });
      await test.step('[9Q-A-004] canvas không tương tác: chuột phải không mở menu', async () => {
        await options.first().click({ button: 'right' });
        await expect.soft(page.getByRole('menu')).toHaveCount(0); // useWallLayerReview.ts:926-936
        // canvas drag: UNKNOWN — NEED VERIFICATION (isInteractive=false is not observable from a role locator)
        await shot(page, '9Q-A-004', 'no_context_menu');
      });
      await test.step('[9Q-A-005] phím tắt ghi bị tắt', async () => {
        await options.first().click();
        await pressAll(page, WRITE_KEYS);
        await settle(page);
        expect.soft(rec.writes).toEqual([]); // useWallLayerReview.ts:1340-1468
        await shot(page, '9Q-A-005', 'write_shortcuts_off');
      });
      await test.step('[9Q-A-006] mở, chọn, rê, đợi autosave: không request ghi', async () => {
        await options.nth(1).click();
        await options.nth(1).hover();
        await settle(page);
        expect(rec.writes).toEqual([]);
        await shot(page, '9Q-A-006', 'no_autosave_write');
      });
      await test.step('[9Q-A-007] gọi tay PUT spatial/layer: BE 403 FORBIDDEN', async () => {
        const v = await apiAs(viewer);
        const path = layerPathOf(fx.floor.projectId, fx.floor.floorId);
        const read = await v.get(path);
        expect(read.status()).toBe(200);
        const doc = (await read.json()) as { revision: number; layer: unknown };
        // valid body (stored layer at its revision) so 403 is permission, not 422
        const res = await v.put(path, { data: { baseVersion: doc.revision, body: { layer: doc.layer } } });
        expect.soft(res.status()).toBe(403);
        expect.soft(((await res.json()) as { code?: string }).code).toBe('FORBIDDEN');
        const after = (await (await v.get(path)).json()) as { revision: number };
        expect.soft(after.revision).toBe(doc.revision);
        await v.dispose();
        expect.soft(rec.writes).toEqual([]);
        await shot(page, '9Q-A-007', 'be_403');
      });
      await test.step('[9Q-A-014] tiêu điểm không rơi vào nút ghi; câu chỉ-xem đọc được', async () => {
        await options.first().click();
        for (let i = 0; i < 6; i++) {
          await page.keyboard.press('Tab');
          const name = await page.evaluate(() => (document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent ?? '').trim());
          expect.soft(name).not.toMatch(/^(Duyệt đoạn này|Bỏ qua|Nối đoạn)$/u);
        }
        await expect.soft(page.getByText(WALL_VIEW_ONLY, { exact: true })).toBeVisible();
        await shot(page, '9Q-A-014', 'focus_order');
      });
    } finally {
      await fx.cleanup();
    }
  });

  test('SCR-17 · FL-9Q-02 · viewer · lớp đối tượng chỉ-xem', async ({ context, page }) => {
    test.setTimeout(240_000);
    const admin = await adminApi();
    const viewer = await roleUser(admin, 'viewer', SLOT);
    const fx = await seedQcForViewer(admin, viewer, 'p09-objects');
    // QV2: second floor of its own project has no layer (empty state)
    const api = layerApiFrom(admin);
    let emptyFloor: SeededFloor | undefined;
    let undo: (() => Promise<void>) | null = null;
    try {
      [, emptyFloor] = await createQcProject(api, 'p09-objects-empty', ['Tầng 1', 'Tầng trống']);
      const empty = emptyFloor;
      if (empty === undefined) throw new Error('setup: no empty floor');
      undo = await asMember(admin, empty.projectId, viewer);
      await signInRole(context, viewer);
      const rec = recordWrites(page);
      const region = page.getByRole('region', { name: OBJECTS_REGION, exact: true });
      const rail = page.getByRole('toolbar', { name: OBJECTS_RAIL });
      const options = page.getByRole('group', { name: 'Danh sách đối tượng', exact: true }).getByRole('option');
      await test.step('[9Q-B-001] vùng và thanh trạng thái hiện, thanh công cụ rỗng', async () => {
        await openScreen(page, ROUTES.project.objects(fx.floor.projectId, fx.floor.floorId), region);
        await expect(page.getByRole('status', { name: 'Thanh trạng thái' }).getByText(/^\d+\/[1-9]\d* đối tượng đã duyệt$/u)).toBeVisible();
        await expect(rail).toHaveCount(1);
        await expect(rail.getByRole('button')).toHaveCount(0); // ObjectLayerToolRail.tsx:120
        await shot(page, '9Q-B-001', 'empty_rail');
      });
      await test.step('[9Q-B-002] câu chỉ-xem của lớp đối tượng', async () => {
        await options.first().click();
        // viewerRoleNotice = OBJECT_LAYER_TEXT.forbidden (useObjectLayerReview.ts:1515)
        await expect.soft(page.getByText(OBJECT_VIEW_ONLY, { exact: true }).first()).toBeVisible();
        await shot(page, '9Q-B-002', 'view_only_sentence');
      });
      await test.step('[9Q-B-003] canvas bỏ callback sửa: chuột phải không mở menu', async () => {
        await options.first().click({ button: 'right' });
        await expect.soft(page.getByRole('menu')).toHaveCount(0); // ObjectLayerReview.tsx:189-191
        await shot(page, '9Q-B-003', 'no_context_menu');
      });
      await test.step('[9Q-B-004] inspector chỉ đọc', async () => {
        await options.first().click();
        await expect.soft(page.getByRole('button', { name: /, xoá/u })).toHaveCount(0); // ObjectLayerInspector: "Không phải cửa, xoá" (Z/S-16)
        await expect.soft(page.getByRole('button', { name: 'Gắn vào tường gần nhất' })).toHaveCount(0); // :391
        await expect.soft(page.getByRole('radiogroup', { name: 'Hướng mở' })).toHaveCount(0); // div chỉ đọc, :337
        await shot(page, '9Q-B-004', 'inspector_read_only');
      });
      await test.step('[9Q-B-005] trạng thái rỗng không có Thêm thủ công', async () => {
        await page.goto(ROUTES.project.objects(empty.projectId, empty.floorId));
        await expect(region).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText('Chưa nhận ra đối tượng nào', { exact: true })).toBeVisible();
        await expect.soft(page.getByRole('button', { name: 'Thêm thủ công' })).toHaveCount(0); // ObjectLayerReview.tsx:98-108
        await shot(page, '9Q-B-005', 'empty_no_manual_add');
      });
      await test.step('[9Q-B-006] phím tắt ghi tắt, không PUT', async () => {
        await page.goto(ROUTES.project.objects(fx.floor.projectId, fx.floor.floorId));
        await expect(options.first()).toBeVisible({ timeout: 15_000 });
        await options.first().click();
        await pressAll(page, WRITE_KEYS);
        await settle(page);
        expect(rec.writes).toEqual([]);
        await shot(page, '9Q-B-006', 'no_write_keys');
      });
    } finally {
      await undo?.();
      if (emptyFloor !== undefined) await deleteProject(api, emptyFloor.projectId);
      await fx.cleanup();
    }
  });

  test('SCR-18 · FL-9Q-03 · viewer · kích thước OCR chỉ-xem', async ({ context, page }) => {
    test.setTimeout(240_000);
    const admin = await adminApi();
    const viewer = await roleUser(admin, 'viewer', SLOT);
    const { projectId, workFloorId } = mainProject();
    const undo = await asMember(admin, projectId, viewer);
    try {
      await signInRole(context, viewer);
      const rec = recordWrites(page);
      const list = page.getByRole('group', { name: DIM_LIST, exact: true });
      const options = list.getByRole('option');
      await test.step('[9Q-C-001] câu chỉ-xem dưới danh sách', async () => {
        await openScreen(page, ROUTES.project.dimensions(projectId, workFloorId), page.getByRole('region', { name: DIMS_REGION, exact: true }));
        await expect(options.first()).toBeVisible();
        await expect(page.getByText(DIM_VIEW_ONLY, { exact: true }).and(page.locator(':not(.sr-only)'))).toBeVisible(); // dimensionOcrText.ts:217-219; sr-only twin = canvas aria-describedby
        await shot(page, '9Q-C-001', 'view_only_sentence');
      });
      await test.step('[9Q-C-002] không lối vào duyệt bàn phím, không nút duyệt hàng', async () => {
        await expect.soft(page.getByRole('button', { name: 'Bật chế độ duyệt bàn phím' })).toHaveCount(0);
        await expect.soft(options.first().getByRole('button')).toHaveCount(0); // DimensionOcrRow.tsx:360
        await shot(page, '9Q-C-002', 'no_review_entry');
      });
      await test.step('[9Q-C-003] ô giá trị bị khoá', async () => {
        await expect.soft(list.getByRole('textbox').first()).toBeDisabled(); // DimensionOcrRow.tsx:259 NumericField disabled
        await shot(page, '9Q-C-003', 'value_locked');
      });
      await test.step('[9Q-C-004] canvas không tương tác, mô tả ẩn đọc được', async () => {
        // UNKNOWN — NEED VERIFICATION: sr-only <p> id wired by aria-describedby (DimensionOcrCanvas.tsx:191,236-238)
        await expect.soft(page.locator('p.sr-only', { hasText: /chỉ được xem|không sửa/u }).first()).toBeAttached();
        await shot(page, '9Q-C-004', 'canvas_inert');
      });
      await test.step('[9Q-C-005] phím R / Enter / Mod+Z không làm gì, không PUT', async () => {
        await options.first().click();
        await pressAll(page, ['r', 'Enter', 'Control+z']);
        await settle(page);
        expect(rec.writes).toEqual([]);
        await shot(page, '9Q-C-005', 'no_write_keys');
      });
    } finally {
      await undo();
    }
  });

  test('SCR-19 · FL-9Q-04 · viewer · lưới trục chỉ-xem', async ({ context, page }) => {
    test.setTimeout(240_000);
    const admin = await adminApi();
    const viewer = await roleUser(admin, 'viewer', SLOT);
    const fx = await seedQcForViewer(admin, viewer, 'p09-grids');
    try {
      await signInRole(context, viewer);
      const rec = recordWrites(page);
      const rows = page.getByRole('option', { name: /^Trục (.+?), cách trục kế là /u });
      await test.step('[9Q-D-001] tiêu đề + câu chỉ-xem', async () => {
        await openScreen(page, ROUTES.project.grids(fx.floor.projectId, fx.floor.floorId), page.getByRole('region', { name: GRIDS_REGION, exact: true }));
        await expect(page.getByRole('heading', { name: GRID_TITLE, exact: true })).toBeVisible(); // AxisGridManager.tsx:113,186
        await expect(page.getByText(GRID_VIEW_ONLY, { exact: true }).and(page.locator(':not(.sr-only)'))).toBeVisible(); // sr-only twin = canvas aria-describedby
        await expect(rows.first()).toBeVisible();
        await shot(page, '9Q-D-001', 'view_only_alert');
      });
      await test.step('[9Q-D-002] vắng nút thêm trục và xoá trục', async () => {
        await expect.soft(page.getByRole('button', { name: /^Thêm trục/u })).toHaveCount(0); // AxisGridLeftPanel.tsx:126
        await expect.soft(page.getByRole('button', { name: /^Xoá trục/u })).toHaveCount(0); // :170
        await shot(page, '9Q-D-002', 'no_add_delete');
      });
      await test.step('[9Q-D-003] Căn chỉnh tự động khoá kèm lý do', async () => {
        await expect.soft(page.getByRole('button', { name: /Căn tự động/u })).toBeDisabled();
        await expect.soft(page.getByText(GRID_ALIGN_REASON).first()).toBeAttached(); // useAxisGridManager.ts:178,1197
        await shot(page, '9Q-D-003', 'align_locked');
      });
      await test.step('[9Q-D-004] không có câu Trục chỉ giữ trong phiên này', async () => {
        await expect.soft(page.getByText(GRID_UNSAVED)).toHaveCount(0); // useAxisGridManager.ts:1290
        await shot(page, '9Q-D-004', 'no_unsaved_notice');
      });
      await test.step('[9Q-D-005] canvas không kéo/thêm; phím tắt tắt', async () => {
        await rows.first().click();
        await pressAll(page, WRITE_KEYS);
        await settle(page);
        expect.soft(rec.writes).toEqual([]);
        await expect.soft(page.getByText(GRID_UNSAVED)).toHaveCount(0);
        await shot(page, '9Q-D-005', 'no_write_keys');
      });
    } finally {
      await fx.cleanup();
    }
  });

  test('SCR-20 · FL-9Q-05 · viewer · nhãn phòng chỉ-xem', async ({ context, page }) => {
    test.setTimeout(240_000);
    const admin = await adminApi();
    const viewer = await roleUser(admin, 'viewer', SLOT);
    const fx = await seedQcForViewer(admin, viewer, 'p09-rooms');
    try {
      await signInRole(context, viewer);
      const rec = recordWrites(page);
      const rooms = page.getByRole('listbox', { name: 'Danh sách phòng', exact: true }).getByRole('option');
      await test.step('[9Q-E-001] tiêu đề + câu chỉ-xem cột trái', async () => {
        await gotoAs(page, ROUTES.project.rooms(fx.floor.projectId, fx.floor.floorId), ROOMS_TITLE); // RoomLabelReview.tsx:93,182
        await expect(page.getByText(ROOM_VIEW_ONLY, { exact: true })).toBeVisible(); // useRoomLabelReview.ts:161-162
        await expect(rooms.first()).toBeVisible();
        await shot(page, '9Q-E-001', 'view_only_alert');
      });
      await test.step('[9Q-E-002] inspector chỉ có nhãn Chỉ xem, trường chỉ đọc', async () => {
        await rooms.first().click();
        await expect.soft(page.getByText('Chỉ xem', { exact: true }).first()).toBeVisible(); // RoomLabelInspector.tsx:100,158-163
        await expect.soft(page.getByRole('button', { name: /^Duyệt #R-/u })).toHaveCount(0);
        await expect.soft(page.getByRole('button', { name: /^Gộp/u })).toHaveCount(0);
        await expect.soft(page.getByRole('button', { name: /^Tách/u })).toHaveCount(0);
        await shot(page, '9Q-E-002', 'inspector_read_only');
      });
      await test.step('[9Q-E-003] cột trái không nút hành động hàng loạt', async () => {
        await expect.soft(page.getByRole('button', { name: 'Chuẩn hoá tên…' })).toHaveCount(0); // RoomLabelLeftPanel
        await expect.soft(page.getByRole('button', { name: 'Gộp phòng' })).toHaveCount(0);
        await shot(page, '9Q-E-003', 'no_bulk_actions');
      });
      await test.step('[9Q-E-004] canvas có mô tả ẩn, không chọn phòng', async () => {
        await expect.soft(page.getByText(ROOM_CANVAS_DESC, { exact: true }).first()).toBeAttached(); // RoomLabelCanvas.tsx:277
        await shot(page, '9Q-E-004', 'canvas_description');
      });
      await test.step('[9Q-E-005] không PUT sau thao tác/phím', async () => {
        await pressAll(page, WRITE_KEYS);
        await settle(page);
        expect(rec.writes).toEqual([]); // useRoomLabelReview.ts:880
        await shot(page, '9Q-E-005', 'no_write_keys');
      });
    } finally {
      await fx.cleanup();
    }
  });

  test('SCR-21 · FL-9Q-06 · viewer · độ dày chỉ-xem', async ({ context, page }) => {
    test.setTimeout(240_000);
    const admin = await adminApi();
    const viewer = await roleUser(admin, 'viewer', SLOT);
    const fx = await seedQcForViewer(admin, viewer, 'p09-thickness');
    try {
      await signInRole(context, viewer);
      const rec = recordWrites(page);
      const layerRes = page.waitForResponse((r) => r.request().method() === 'GET' && r.url().includes('/spatial/layer'));
      await test.step('[9Q-F-001] tiêu đề + câu viewerRoleNotice', async () => {
        await gotoAs(page, ROUTES.project.thickness(fx.floor.projectId, fx.floor.floorId), THICKNESS_TITLE); // ThicknessStandardization.tsx:115,347
        await expect(page.getByText(THICKNESS_VIEW_ONLY, { exact: true })).toBeVisible(); // useThicknessStandardization.ts:134-135
        await shot(page, '9Q-F-001', 'view_only_alert');
      });
      await test.step('[9Q-F-002] thanh áp dụng không được dựng', async () => {
        await expect.soft(page.getByRole('button', { name: 'Áp dụng', exact: true })).toHaveCount(0); // ThicknessStandardization.tsx:375
        await expect.soft(page.getByRole('button', { name: 'Xem trước', exact: true })).toHaveCount(0);
        await shot(page, '9Q-F-002', 'no_apply_bar');
      });
      await test.step('[9Q-F-003] bảng nhóm không cột chấp nhận, bảng đoạn không ô chọn', async () => {
        expect((await layerRes).status()).toBe(200); // data loaded before asserting absence
        await settle(page);
        await expect.soft(page.getByRole('checkbox', { name: /^Đồng ý chuẩn hoá \d+ tường /u })).toHaveCount(0); // ThicknessGroupTable.tsx:60,79
        await expect.soft(page.getByRole('checkbox')).toHaveCount(0); // ThicknessSegmentTable.tsx:192
        await shot(page, '9Q-F-003', 'no_accept_selects');
      });
      await test.step('[9Q-F-004] phím tắt tắt, không PUT', async () => {
        await page.getByRole('row').nth(1).click();
        await pressAll(page, WRITE_KEYS);
        await settle(page);
        expect(rec.writes).toEqual([]); // useThicknessStandardization.ts:887
        await shot(page, '9Q-F-004', 'no_write_keys');
      });
    } finally {
      await fx.cleanup();
    }
  });
});
