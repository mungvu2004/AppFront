/**
 * Phase 09 · QC screens SCR-16..21 role matrix, part B: engineer writes on an own project (FL-9Q-07), anonymous redirect
 * (FL-9Q-08), admin positive control (FL-9Q-09). Real stack, pool users; engineer writes ONLY on an own project
 * (createQcProject), deleted in `finally`.
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { captureEvidence } from './support/evidence';
import {
  codeOfOption,
  dropProject,
  openLayerScreen,
  openSelect,
  pressSpaceOn,
  seedQc,
  statusBarUndo,
  waitLayerPut,
} from './support/p09/P6';
import { adminApi, apiAs, asMember, DESKTOP, recordWrites, roleUser, signInRole } from './support/p09/roles';

const ev = (id: string, slug: string): string => `E09_${id}_${slug}.png`;
const VIEWER_WALL = 'Bạn đang xem với vai người xem, nên không duyệt hay sửa được đoạn tường nào.';
const WALL_LIST = 'Danh sách đoạn tường';
const OBJECT_LIST = 'Danh sách đối tượng';
const ROOM_LIST = 'Danh sách phòng';
const DIM_LIST = 'Danh sách kích thước đọc được';

test.use({ viewport: DESKTOP });

test('SCR-16..21 · FL-9Q-07 · engineer · sửa được trên dự án riêng', async ({ browser }) => {
  test.setTimeout(840_000);
  const admin = await adminApi();
  const engineer = await roleUser(admin, 'engineer', 'qc-b');
  const qe = await seedQc(admin, 'p09-qe');
  const qn = await seedQc(admin, 'p09-qn');
  const undoMember = await asMember(admin, qe.projectId, engineer);
  const context = await browser.newContext({ viewport: DESKTOP });
  try {
    await signInRole(context, engineer);
    const page = await context.newPage();
    const rec = recordWrites(page);
    const wallRows = page.getByRole('listbox', { name: WALL_LIST, exact: true }).getByRole('option');
    const objectRows = page.getByRole('group', { name: OBJECT_LIST, exact: true }).getByRole('option');
    const roomRows = page.getByRole('listbox', { name: ROOM_LIST, exact: true }).getByRole('option');
    const dimRows = page.getByRole('group', { name: DIM_LIST, exact: true }).getByRole('option');
    let wallCode = '';

    await test.step('[9Q-A-008] engineer thấy đủ điều khiển và duyệt một đoạn thành công', async () => {
      await openLayerScreen(page, ROUTES.project.walls(qe.projectId, qe.floorId), qe, 'Duyệt lớp tường');
      const unapproved = wallRows.filter({ hasNot: page.getByText('Đã duyệt') }).first();
      await expect(wallRows.first()).toBeVisible();
      await unapproved.click();
      wallCode = await codeOfOption(page.getByRole('option', { selected: true }).first());
      const approve = page.getByRole('button', { name: 'Duyệt đoạn này', exact: true });
      await expect(approve).toBeEnabled();
      await expect(page.getByRole('radiogroup', { name: 'Độ dày tường', exact: true })).toBeVisible();
      await expect(
        page.getByRole('toolbar', { name: 'Công cụ lớp tường', exact: true }).getByRole('button', { name: /^Nối đoạn/u }),
      ).toBeVisible();
      await expect(page.getByText(VIEWER_WALL)).toHaveCount(0);
      const put = waitLayerPut(page, qe);
      await approve.click();
      expect((await put).status(), 'PUT layer').toBe(200);
      await expect(page.getByRole('option', { name: `${wallCode} — Đã duyệt`, exact: true })).toBeVisible();
      await captureEvidence(page, ev('9Q-A-008', 'engineer_walls_approve'));
    });

    await test.step('[9Q-A-009] engineer Hoàn tác (Mod+Z) trả đoạn về chưa duyệt', async () => {
      // useWallLayerReview.ts:993-1007; canvas-scope Mod+Z is inert inside inputs: focus the row first.
      await page.getByRole('option', { name: `${wallCode} — Đã duyệt`, exact: true }).focus();
      const put = waitLayerPut(page, qe);
      await page.keyboard.press('Control+z');
      await page.keyboard.press('Control+s');
      expect((await put).status(), 'PUT layer after undo').toBe(200);
      await expect(page.getByRole('option', { name: `${wallCode} — Đã duyệt`, exact: true })).toHaveCount(0);
      await captureEvidence(page, ev('9Q-A-009', 'engineer_walls_undo'));
    });

    await test.step('[9Q-A-012] tài khoản không phải thành viên dự án mở lớp tường', async () => {
      const own = await apiAs(engineer);
      const res = await own.get(`/api/projects/${qn.projectId}/floors/${qn.floorId}/spatial/layer`);
      expect.soft(res.status(), 'K08: 404 wins over 403').toBe(404);
      await own.dispose();
      const page2 = await context.newPage();
      const [read] = await Promise.all([
        page2.waitForResponse(
          (r) => r.request().method() === 'GET' && r.url().includes(`/floors/${qn.floorId}/spatial/layer`),
        ),
        page2.goto(ROUTES.project.walls(qn.projectId, qn.floorId), { waitUntil: 'commit' }),
      ]);
      expect.soft(read.status()).toBe(404);
      // UNKNOWN — NEED VERIFICATION: exact error/NotFound copy (C1); anchor = network idle after the 404, then no wall data.
      await page2.waitForLoadState('networkidle');
      await expect.soft(page2.getByRole('listbox', { name: WALL_LIST, exact: true })).toHaveCount(0);
      await expect.soft(page2.getByRole('button', { name: 'Duyệt đoạn này', exact: true })).toHaveCount(0);
      await captureEvidence(page2, ev('9Q-A-012', 'nonmember_walls_404'));
      await page2.close();
    });

    await test.step('[9Q-B-007] engineer thêm/duyệt một đối tượng thành công', async () => {
      await openLayerScreen(page, ROUTES.project.objects(qe.projectId, qe.floorId), qe, 'Lớp đối tượng');
      await expect.soft(page.getByRole('button', { name: /^Chọn nhóm .+ \(phím .+\)$/u }).first()).toBeVisible();
      await expect(objectRows.first()).toBeVisible();
      await objectRows.first().click();
      const approve = page
        .getByRole('heading', { name: 'Đối tượng', exact: true, level: 3 })
        .locator('xpath=../..')
        .getByRole('button', { name: 'Duyệt đối tượng này', exact: true });
      await expect(approve).toBeEnabled();
      const put = waitLayerPut(page, qe);
      await approve.click();
      expect((await put).status(), 'PUT layer').toBe(200);
      await captureEvidence(page, ev('9Q-B-007', 'engineer_objects_approve'));
    });

    await test.step('[9Q-B-008] engineer xoá một đối tượng rồi Hoàn tác', async () => {
      const total = await objectRows.count();
      const code = await codeOfOption(objectRows.first());
      // ObjectLayerCanvas.tsx:124 onContextMenu; the menu is the only delete path for objects.
      await page.locator(`g[aria-label="${code}"]`).click({ button: 'right', timeout: 5_000 });
      const del = waitLayerPut(page, qe);
      await page.getByRole('menuitem', { name: 'Xoá', exact: true }).click();
      await page.keyboard.press('Control+s');
      expect((await del).status(), 'PUT after delete').toBe(200);
      await expect(objectRows).toHaveCount(total - 1);
      const undo = waitLayerPut(page, qe);
      await statusBarUndo(page).click();
      await page.keyboard.press('Control+s');
      expect((await undo).status(), 'PUT after undo').toBe(200);
      await expect(objectRows).toHaveCount(total);
      await captureEvidence(page, ev('9Q-B-008', 'engineer_objects_delete_undo'));
    });

    await test.step('[9Q-C-006] engineer sửa giá trị một kích thước và duyệt', async () => {
      // UNKNOWN — NEED VERIFICATION / DỞ: qcLayer seeds no dimension strings (OCR-only) and flows say "PUT 200" while
      // dimensionOcrText.ts:110 (BUG-577, F-08) says edits are local. Soft red until a dimension seed exists.
      await page.goto(ROUTES.project.dimensions(qe.projectId, qe.floorId));
      await expect(page.getByText('Chưa đọc được chuỗi kích thước nào', { exact: true }).or(dimRows.first()).first()).toBeVisible({ timeout: 15_000 });
      test.info().annotations.push({ type: 'DỞ', description: '9Q-C-006: no dimension seed' });
      expect.soft(await dimRows.count(), '9Q-C-006: dimension rows seeded').toBeGreaterThan(0);
      await captureEvidence(page, ev('9Q-C-006', 'engineer_dims_edit'));
    });

    await test.step('[9Q-C-007] engineer duyệt bàn phím: R bật, Enter duyệt, Esc thoát', async () => {
      // UNKNOWN — NEED VERIFICATION / DỞ: shortcut semantics unverified and no dimension seed; not reported as pass.
      test.info().annotations.push({ type: 'DỞ', description: '9Q-C-007: no dimension seed' });
      expect.soft(await dimRows.count(), '9Q-C-007: dimension rows seeded').toBeGreaterThan(0);
      await captureEvidence(page, ev('9Q-C-007', 'engineer_dims_keys'));
    });

    await test.step('[9Q-D-006] engineer thêm một trục: chỉ trong phiên, không PUT', async () => {
      await page.goto(ROUTES.project.grids(qe.projectId, qe.floorId));
      const add = page.getByRole('button', { name: 'Thêm trục ngang', exact: true });
      await expect(add).toBeVisible({ timeout: 15_000 });
      const axes = page.getByRole('option', { name: /^Trục (.+?), cách trục kế là /u });
      const before = await axes.count();
      const mark = rec.writes.length;
      await add.click();
      await expect(axes).toHaveCount(before + 1);
      await expect(
        page.getByText('Trục chỉ giữ trong phiên này — tải lại trang sẽ mất các thay đổi.', { exact: true }),
      ).toBeVisible(); // useAxisGridManager.ts:176; BUG-578
      await page.waitForLoadState('networkidle');
      expect(rec.writes.slice(mark)).toEqual([]);
      await captureEvidence(page, ev('9Q-D-006', 'engineer_grids_session_only'));
    });

    await test.step('[9Q-E-006] engineer đổi tên phòng + duyệt thành công', async () => {
      await openLayerScreen(page, ROUTES.project.rooms(qe.projectId, qe.floorId), qe, 'Duyệt tên phòng');
      await roomRows.first().click();
      const name = page.getByRole('textbox', { name: 'Tên phòng' });
      const renamed = waitLayerPut(page, qe);
      await name.fill('qa phòng p09');
      await name.press('Enter');
      expect((await renamed).status(), 'PUT rename').toBe(200);
      const approve = page.getByRole('button', { name: 'Duyệt phòng này', exact: true });
      await expect(approve).toBeEnabled();
      const put = waitLayerPut(page, qe);
      await approve.click();
      expect((await put).status(), 'PUT approve').toBe(200);
      await captureEvidence(page, ev('9Q-E-006', 'engineer_rooms_rename'));
    });

    await test.step('[9Q-E-007] engineer gộp rồi Hoàn tác', async () => {
      const total = await roomRows.count();
      await roomRows.first().click();
      await page.getByRole('button', { name: 'Gộp phòng', exact: true }).click(); // useRoomLabelReview.ts:683 canEdit
      const dialog = page.getByRole('dialog', { name: 'Gộp hai phòng', exact: true });
      const listbox = await openSelect(page, dialog.getByRole('combobox', { name: 'Phòng sẽ gộp vào', exact: true }));
      await listbox.getByRole('option').first().click();
      const merged = waitLayerPut(page, qe);
      await dialog.getByRole('button', { name: 'Gộp hai phòng', exact: true }).click();
      expect((await merged).status(), 'PUT merge').toBe(200);
      await expect(roomRows).toHaveCount(total - 1);
      const undo = waitLayerPut(page, qe);
      await statusBarUndo(page).click();
      await page.keyboard.press('Control+s');
      expect((await undo).status(), 'PUT undo').toBe(200);
      await expect(roomRows).toHaveCount(total);
      await captureEvidence(page, ev('9Q-E-007', 'engineer_rooms_merge_undo'));
    });

    await test.step('[9Q-F-005] engineer áp chuẩn hoá một nhóm thành công', async () => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openLayerScreen(page, ROUTES.project.thickness(qe.projectId, qe.floorId), qe, null);
      await expect(page.getByRole('heading', { name: 'Chuẩn hoá độ dày tường' })).toBeVisible();
      const accept = page.getByRole('checkbox', { name: /^Đồng ý chuẩn hoá \d+ tường /u }).first();
      await expect(accept).toBeVisible(); // qcLayer seeds two 200 mm partitions
      await pressSpaceOn(accept);
      await expect(accept).toBeChecked();
      await page.getByRole('button', { name: 'Xem trước', exact: true }).click();
      const put = waitLayerPut(page, qe);
      await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
      expect((await put).status(), 'PUT apply').toBe(200);
      await captureEvidence(page, ev('9Q-F-005', 'engineer_thickness_apply'));
    });

    await test.step('[9Q-F-006] engineer Hoàn tác lượt chuẩn hoá', async () => {
      const undo = waitLayerPut(page, qe);
      await page
        .getByRole('region', { name: 'Thông báo', exact: true })
        .getByRole('button', { name: 'Hoàn tác', exact: true })
        .first()
        .click();
      expect((await undo).status(), 'PUT undo').toBe(200);
      await captureEvidence(page, ev('9Q-F-006', 'engineer_thickness_undo'));
    });
  } finally {
    await context.close();
    await undoMember().catch(() => undefined);
    await dropProject(admin, qe.projectId);
    await dropProject(admin, qn.projectId);
    await admin.dispose();
  }
});

test('SCR-16..21 · FL-9Q-08 · ẩn danh · chuyển /login', async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ viewport: DESKTOP });
  try {
    const page = await context.newPage();
    let layerCalls = 0;
    page.on('request', (req) => {
      if (req.url().includes('/spatial/layer')) layerCalls += 1;
    });
    const redirected = async (id: string, slug: string, path: string): Promise<void> => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login\?next=/u, { timeout: 15_000 });
      expect(decodeURIComponent(new URL(page.url()).searchParams.get('next') ?? '')).toContain(path);
      expect(layerCalls, 'no layer API call for anonymous').toBe(0);
      await captureEvidence(page, ev(id, `anon_${slug}`));
    };
    const [p, f] = [randomUUID(), randomUUID()];

    await test.step('[9Q-A-011] ẩn danh vào lớp tường -> /login?next=', () => redirected('9Q-A-011', 'walls', ROUTES.project.walls(p, f)));
    await test.step('[9Q-B-010] ẩn danh vào lớp đối tượng -> /login?next=', () => redirected('9Q-B-010', 'objects', ROUTES.project.objects(p, f)));
    await test.step('[9Q-C-009] ẩn danh vào kích thước -> /login?next=', () => redirected('9Q-C-009', 'dimensions', ROUTES.project.dimensions(p, f)));
    await test.step('[9Q-D-008] ẩn danh vào lưới trục -> /login?next=', () => redirected('9Q-D-008', 'grids', ROUTES.project.grids(p, f)));
    await test.step('[9Q-E-009] ẩn danh vào nhãn phòng -> /login?next=', () => redirected('9Q-E-009', 'rooms', ROUTES.project.rooms(p, f)));
    await test.step('[9Q-F-008] ẩn danh vào độ dày -> /login?next=', () => redirected('9Q-F-008', 'thickness', ROUTES.project.thickness(p, f)));
  } finally {
    await context.close();
  }
});

test('SCR-16..21 · FL-9Q-09 · admin · đối chứng dương', async ({ browser }) => {
  test.setTimeout(300_000);
  const admin = await adminApi();
  const user = await roleUser(admin, 'admin', 'qc-b');
  const qa = await seedQc(admin, 'p09-qa');
  const undoMember = await asMember(admin, qa.projectId, user);
  const context = await browser.newContext({ viewport: DESKTOP });
  try {
    await signInRole(context, user);
    const page: Page = await context.newPage();
    await test.step('[9Q-A-010] admin đối chứng: cùng điều khiển như engineer', async () => {
      await openLayerScreen(page, ROUTES.project.walls(qa.projectId, qa.floorId), qa, 'Duyệt lớp tường');
      await page.getByRole('listbox', { name: WALL_LIST, exact: true }).getByRole('option').first().click();
      await expect(page.getByRole('button', { name: 'Duyệt đoạn này', exact: true })).toBeVisible();
      await expect(page.getByText(VIEWER_WALL)).toHaveCount(0);
      await captureEvidence(page, ev('9Q-A-010', 'admin_walls'));
    });
    await test.step('[9Q-B-009] admin đối chứng', async () => {
      await openLayerScreen(page, ROUTES.project.objects(qa.projectId, qa.floorId), qa, 'Lớp đối tượng');
      await expect(page.getByRole('button', { name: /^Chọn nhóm .+ \(phím .+\)$/u }).first()).toBeVisible();
      await expect.soft(page.getByText('Bạn đang xem — không sửa được lớp này.', { exact: true })).toHaveCount(0); // objectLayerReviewGateway.ts:1262
      await captureEvidence(page, ev('9Q-B-009', 'admin_objects'));
    });
    await test.step('[9Q-C-008] admin đối chứng', async () => {
      await page.goto(ROUTES.project.dimensions(qa.projectId, qa.floorId));
      await expect(
        page.getByText('Chưa đọc được chuỗi kích thước nào', { exact: true }).or(page.getByRole('group', { name: DIM_LIST, exact: true })).first(),
      ).toBeVisible({ timeout: 15_000 });
      await expect.soft(page.getByText('Không có quyền duyệt kích thước')).toHaveCount(0); // dimensionOcrText.ts:217
      await captureEvidence(page, ev('9Q-C-008', 'admin_dims'));
    });
    await test.step('[9Q-D-007] admin đối chứng', async () => {
      await page.goto(ROUTES.project.grids(qa.projectId, qa.floorId));
      await expect(page.getByRole('button', { name: 'Thêm trục ngang', exact: true })).toBeVisible({ timeout: 15_000 });
      await expect.soft(page.getByText('Không có quyền sửa trục')).toHaveCount(0);
      await captureEvidence(page, ev('9Q-D-007', 'admin_grids'));
    });
    await test.step('[9Q-E-008] admin đối chứng', async () => {
      await openLayerScreen(page, ROUTES.project.rooms(qa.projectId, qa.floorId), qa, 'Duyệt tên phòng');
      await page.getByRole('listbox', { name: ROOM_LIST, exact: true }).getByRole('option').first().click();
      await expect(page.getByText('Chỉ xem', { exact: true })).toHaveCount(0);
      await captureEvidence(page, ev('9Q-E-008', 'admin_rooms'));
    });
    await test.step('[9Q-F-007] admin đối chứng', async () => {
      await openLayerScreen(page, ROUTES.project.thickness(qa.projectId, qa.floorId), qa, null);
      await expect(page.getByRole('heading', { name: 'Chuẩn hoá độ dày tường' })).toBeVisible();
      // ThicknessStandardization.tsx:375 apply bar (rendered for edit roles)
      await expect(page.getByRole('button', { name: 'Xem trước', exact: true })).toBeVisible();
      await captureEvidence(page, ev('9Q-F-007', 'admin_thickness'));
    });
  } finally {
    await context.close();
    await undoMember().catch(() => undefined);
    await dropProject(admin, qa.projectId);
    await admin.dispose();
  }
});
