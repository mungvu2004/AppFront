import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { dismissTourIfPresent, openViewer, selectRoomBySearch, shellInspector } from './viewer';

/**
 * Nhóm V8 — chế độ sửa hình học tường (`WallGeometryEditor`) và thứ tự `Escape`
 * của nó với bảng phụ và vùng chọn (`plan.md` nhóm V8, mục 0.2 hàng S1, mục 7).
 *
 * Bộ mẫu vỏ không có đỉnh nào trong KHO (B-V8-04), nên chế độ chỉ mở được ca "chưa
 * có đỉnh": bài giữ hợp đồng vào/ra và `Escape`, không giữ việc kéo đỉnh (tầng đơn
 * vị N1–N6 giữ việc ấy).
 */

const ENTER_LABEL = 'Sửa hình học tường';
const EXIT_LABEL = 'Thoát chế độ sửa hình học';

/**
 * Điểm bấm trúng TƯỜNG, theo tỉ lệ khung nhìn 960×382 ở cửa sổ 1440×900 — đo
 * 2026-10-03 bằng lưới 0,04 trên 15×15 điểm (x 0,20–0,80; y 0,30–0,86): vùng
 * x 0,40–0,60 · y 0,30–0,58 gần như toàn tường tầng 2–4, một ô giữa là phòng
 * R-010. Nhiều điểm để một lượt dựng hơi lệch không làm đỏ bài; dừng ở điểm đầu
 * tiên mà sản phẩm tự nói "đây là tường" — nút vào chế độ chỉ dựng khi chọn tường.
 */
const WALL_POINTS: readonly (readonly [number, number])[] = [
  [0.44, 0.38],
  [0.52, 0.42],
  [0.56, 0.46],
  [0.4, 0.3],
  [0.48, 0.5],
];

/** Trần chờ cho một cú bấm thành vùng chọn — một lượt bắn tia + một lượt vẽ. */
const PICK_SETTLE_MS = 2_000;

/** `additive`: giữ Shift — thêm tường vào vùng chọn đang có thay vì thay nó. */
async function selectAWall(page: Page, additive = false): Promise<void> {
  const box = await page.getByRole('main', { name: 'Khung nhìn mô hình' }).boundingBox();
  expect(box).not.toBeNull();
  const enter = page.getByRole('button', { name: ENTER_LABEL, exact: true });

  for (const [fx, fy] of WALL_POINTS) {
    if (additive) await page.keyboard.down('Shift');
    await page.mouse.click(box!.x + box!.width * fx, box!.y + box!.height * fy);
    if (additive) await page.keyboard.up('Shift');
    const picked = await enter
      .waitFor({ state: 'visible', timeout: PICK_SETTLE_MS })
      .then(() => true)
      .catch(() => false);
    if (picked) {
      if (!additive) await expect(shellInspector(page)).toContainText(/tường W-/u);
      return;
    }
  }
  throw new Error(`không điểm nào trong ${WALL_POINTS.length} điểm đo chọn được tường`);
}

/**
 * Cú bấm đầu lên canvas gọi lớp hướng dẫn lên và nó nuốt cú bấm sau. Mở Lịch sử
 * trước — neo của tour xuất hiện, tour hiện, đóng nó — thì mọi cú bấm canvas sau
 * đó đi thẳng (đo: sau một lần "bỏ qua", tour không hiện lại trong cùng trang).
 */
async function openHistoryAndSettleTour(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Lịch sử thao tác', exact: true }).click();
  await dismissTourIfPresent(page);
}

const editorRegion = (page: Page) => page.getByRole('region', { name: ENTER_LABEL, exact: true });

test('Esc khi bảng phụ, chế độ sửa hình học và vùng chọn cùng mở: đóng bảng phụ, rồi thoát chế độ, rồi bỏ chọn (A12 · S1 · Q3 = A)', async ({
  page,
}) => {
  await openViewer(page);
  await openHistoryAndSettleTour(page);
  const historyToggle = page.getByRole('button', { name: 'Lịch sử thao tác', exact: true });
  await selectAWall(page);

  await page.getByRole('button', { name: ENTER_LABEL, exact: true }).click();
  const editor = editorRegion(page);
  await expect(editor).toBeVisible();
  await expect(editor.getByText(/^Đang sửa: W-/u)).toBeVisible();
  /* Tường của nhà mẫu không có trong kho: nói đúng điều đó, không nói "chưa có đỉnh"
     trên một bức tường đang nhìn thấy (B-V8-63 b). */
  await expect(
    editor.getByText('Bức tường đang chọn không có trong dữ liệu của dự án này nên chưa sửa được hình học.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(editor.getByText('Chưa có đỉnh nào để sửa.')).toHaveCount(0);
  await expect(editor.getByRole('toolbar').getByRole('button')).toHaveCount(6);
  await expect(page.getByRole('button', { name: EXIT_LABEL })).toHaveAttribute('aria-pressed', 'true');
  await expect(historyToggle).toHaveAttribute('aria-expanded', 'true');

  /* Lớp phủ NHÌN THẤY nằm trên cùng, nhưng phạm vi `sidePanel` thắng `canvas`. */
  await page.keyboard.press('Escape');
  await expect(historyToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(editor).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(editor).toHaveCount(0);
  await expect(page.getByRole('button', { name: ENTER_LABEL, exact: true })).toBeVisible();
  await expect(shellInspector(page)).toContainText(/tường W-/u);

  await page.keyboard.press('Escape');
  await expect(shellInspector(page)).toContainText('Chưa chọn đối tượng');
});

test('chế độ sửa hình học thoát được bằng nút "Xong" của chính nó (B-V8-11)', async ({ page }) => {
  await openViewer(page);
  await openHistoryAndSettleTour(page);
  await page.keyboard.press('Escape');
  await selectAWall(page);

  await page.getByRole('button', { name: ENTER_LABEL, exact: true }).click();
  const editor = editorRegion(page);
  await expect(editor).toBeVisible();

  /* `click()` thường, cấm `force`: lỗi chính là một lớp khác đè lên nút. */
  await editor.getByRole('button', { name: 'Xong', exact: true }).click();

  await expect(editor).toHaveCount(0);
  await expect(page.getByRole('button', { name: ENTER_LABEL, exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

/*
 * B-V8-05 — cùng một bức tường từng mang hai mã: dải chế độ sửa nói `W-403FI` (nhãn
 * người đọc), thanh tra của vỏ nói mã máy `W-0403FIXTURE0`. Nay cả hai — và đầu panel
 * thuộc tính — đọc `displayLabelIn` (`domain/spatial/normalize.ts`).
 * Đầu panel thuộc tính không khẳng định ở đây: trên `/3d` panel ấy kẹt "đang tải" vì
 * không route nào nạp kho `spatial` (B-V8-04); bài đơn vị `PropertyInspector.test.tsx`
 * [N10] giữ phần đó. Mở thêm khẳng định ấy khi B-V8-04 được sửa.
 */
test('cùng một bức tường mang cùng một mã ở thanh tra và ở dải chế độ sửa (B-V8-05)', async ({
  page,
}) => {
  await openViewer(page);
  await openHistoryAndSettleTour(page);
  await selectAWall(page);
  const inspectorCode = (await shellInspector(page).innerText()).match(/tường (W-[A-Z0-9]+)/u)?.[1];
  expect(inspectorCode).toBeDefined();
  // Không đòi `W-0403FIXTURE0` biến khỏi thanh tra: hàng "mã đối tượng" giữ mã máy, có chủ đích.
  expect(inspectorCode).not.toContain('FIXTURE');

  await page.getByRole('button', { name: ENTER_LABEL, exact: true }).click();
  await expect(editorRegion(page)).toContainText(`Đang sửa: ${inspectorCode ?? '?'}`);
});

/*
 * B-V8-63 (a) — chế độ sửa từng lấy phần tử ĐẦU của vùng chọn làm tường; chọn phòng trước
 * rồi Shift-bấm tường thì dải nói "Đang sửa: R-…". Nay lấy tường đầu tiên trong vùng chọn,
 * cùng tiêu chí với nút vào chế độ (`Viewer3D.container.tsx`, `canEditWallGeometry`).
 */
test('chọn phòng rồi thêm một bức tường: chế độ sửa hình học sửa bức tường, không sửa phòng (B-V8-63)', async ({
  page,
}) => {
  await openViewer(page);
  await openHistoryAndSettleTour(page);
  await page.keyboard.press('Escape');
  await selectRoomBySearch(page, 'phong ngu 4', 'Phòng ngủ 4');
  await selectAWall(page, true);

  await page.getByRole('button', { name: ENTER_LABEL, exact: true }).click();
  await expect(editorRegion(page)).toContainText(/Đang sửa: W-/u);
});
