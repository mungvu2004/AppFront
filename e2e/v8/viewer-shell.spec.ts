import { expect, test } from '@playwright/test';

import {
  dismissTourIfPresent,
  openViewer,
  selectRoomBySearch,
  shellInspector,
} from './viewer';

/**
 * Nhóm V8 — vỏ 3D (`ViewerShell`), panel thuộc tính và thứ tự `Escape` giữa các
 * lớp (`plan.md` nhóm V8, mục 0.2, 1, 2, 3). Không lặp `e2e/viewer3d.spec.ts`:
 * mở màn, quay/thu phóng, ViewCube, tìm phòng + Esc bỏ chọn, R1, vai chỉ-xem,
 * bốn lớp mở/Esc đơn lẻ đã ở đó.
 */

test('vỏ 3D nói số bằng dấu phẩy thập phân, và nút tầng hiện tên tầng chứ không hiện mã máy (A15 · B-V8-02)', async ({
  page,
}) => {
  await openViewer(page);

  /* 248,60 là số của bộ mẫu vỏ (`VIEWER_FIXTURE_GRAPH`), KHÔNG phải kết luận A14 —
     xem B-V8-10. Ghim nó vì đây là chỗ rẻ nhất nói được A15 trên màn thật. */
  await expect(page.getByLabel('Thanh trạng thái')).toContainText('4 tầng · 14 phòng · 248,60 m²');

  const storeys = page.getByRole('option', { name: /cao độ/u });
  await expect(storeys).toHaveCount(4);
  /* Chữ NHÌN THẤY — `getByRole` khớp theo `aria-label` nên không bắt được lỗi này:
     trước bản sửa bốn nút hiện `L-01FIXTURE0`…`L-04FIXTURE0`. */
  await expect(storeys).toHaveText(['Trệt', '02', '03', 'Mái']);
  for (const name of await storeys.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('aria-label') ?? ''),
  )) {
    expect(name).toMatch(/, cao độ \d+,\d{2} m$/u);
  }

  /* Dấu ở VỊ TRÍ THẬP PHÂN, không bắt mọi dấu chấm. */
  await expect(page.getByRole('button', { name: /^Mức thu phóng \d+,\d%/u })).toBeVisible();
});

test('phím / mở ô tìm và đưa con trỏ vào ô chữ; Esc đóng ô tìm trước, bảng diện tích sau (A12 · S4)', async ({
  page,
}) => {
  await openViewer(page);
  const roomsToggle = page.getByRole('button', { name: 'Diện tích phòng', exact: true });
  const searchBox = page.getByRole('combobox', { name: 'Tìm phòng theo tên hoặc mã' });

  await roomsToggle.click();
  await dismissTourIfPresent(page);
  await expect(page.getByRole('region', { name: 'Bảng diện tích phòng' })).toBeVisible();

  await page.keyboard.press('/');
  await expect(searchBox).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(searchBox).toHaveCount(0);
  await expect(roomsToggle).toHaveAttribute('aria-expanded', 'true');

  await page.keyboard.press('Escape');
  await expect(roomsToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('main', { name: 'Khung nhìn mô hình' })).toBeVisible();
});

/*
 * Bảng phụ và danh sách "Ai đang xem" cùng phạm vi `sidePanel`: lớp bật SAU đóng
 * TRƯỚC (LIFO, `shortcutRegistry.ts`). Hai thứ tự mở — mỗi thứ tự một bài, để biết
 * chiều nào vỡ (S7/S8 của `plan.md` mục 0.2; Q3 = A).
 */
for (const [first, second] of [
  ['Lịch sử thao tác', 'Ai đang xem'],
  ['Ai đang xem', 'Lịch sử thao tác'],
] as const) {
  test(`mở "${first}" rồi "${second}": Esc đóng "${second}" trước, "${first}" sau (A12 · cùng phạm vi)`, async ({
    page,
  }) => {
    await openViewer(page);
    const firstToggle = page.getByRole('button', { name: first, exact: true });
    const secondToggle = page.getByRole('button', { name: second, exact: true });

    await firstToggle.click();
    await dismissTourIfPresent(page);
    await secondToggle.click();
    await dismissTourIfPresent(page);
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(secondToggle).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');
    await expect(secondToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'false');
  });
}

/*
 * PI-1e — chỉ chứng minh "chọn xong thì vùng thuộc tính có mặt và nói ra một trạng
 * thái", KHÔNG chứng minh panel dùng được: hôm nay nó kẹt "Đang tải thuộc tính…"
 * vì kho rỗng (B-V8-04, bài `test.fixme` ở `viewer-panels.spec.ts`).
 */
test('chọn một phòng thì vùng thuộc tính có mặt và không trắng; Esc bỏ chọn thì nó rời màn (PI · A12)', async ({
  page,
}) => {
  await openViewer(page);
  await selectRoomBySearch(page, 'phong ngu 4', 'Phòng ngủ 4');

  const properties = page.getByRole('region', { name: 'Thuộc tính đối tượng đã chọn' });
  await expect(properties).toBeVisible();
  await expect(properties.getByRole('region', { name: 'Thuộc tính đối tượng' })).not.toBeEmpty();

  await page.keyboard.press('Escape');
  await expect(properties).toHaveCount(0);
  await expect(shellInspector(page)).toContainText('Chưa chọn đối tượng');
});

/*
 * B-V8-06 — panel thuộc tính dựng BÊN TRONG `aside` "Thanh tra đối tượng" của vỏ và
 * từng mang đúng tên ấy: hai mốc trùng tên cho trình đọc màn hình.
 */
test('khi có chọn, chỉ MỘT mốc mang tên "Thanh tra đối tượng" (B-V8-06)', async ({ page }) => {
  await openViewer(page);
  await selectRoomBySearch(page, 'phong ngu 4', 'Phòng ngủ 4');
  await expect(page.getByRole('region', { name: 'Thuộc tính đối tượng', exact: true })).toBeVisible();

  await expect(page.getByRole('complementary', { name: 'Thanh tra đối tượng', exact: true })).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Thanh tra đối tượng', exact: true })).toHaveCount(0);
});
