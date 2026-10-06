import { expect, test } from '@playwright/test';

import { seedSpatial } from '../fixtures/seedSpatial';
import { VIEWER_PROJECT_ID, dismissTourIfPresent, openViewer, selectRoomBySearch } from './viewer';

/**
 * Nhóm V8 — tự lưu của màn `/3d`. Máy khách mock chạy ngay trong trang
 * (`src/api/appClient.ts`), nên `page.route` không thấy lượt PUT nào: bài đọc nhãn tự lưu
 * mà sản phẩm nói ra ở chân panel thuộc tính.
 */

const RENAMED = 'Phòng đổi tên lúc không chọn';

/**
 * Trần của cả bài: đăng nhập vai kỹ sư (~17 s đo 2026-10-04), bơm kho dựng lại cảnh, rồi
 * hai cửa sổ 800 ms của A7 nối nhau (bảng diện tích ghi tên vào kho, màn lưu kho lên máy).
 * Đo một lượt trọn: 40 s — trần mặc định 30 s không đủ.
 */
const SAVE_FLOW_TIMEOUT_MS = 90_000;

/*
 * B-V8-60 — tự lưu từng chỉ gắn với panel thuộc tính, mà panel chỉ dựng khi có vùng chọn:
 * đổi tên phòng ở bảng diện tích lúc không chọn gì rồi rời màn thì không có lượt lưu nào.
 * Nay màn giữ tự lưu suốt lượt ở `/3d`, và chân panel nói nhãn của màn.
 *
 * Bài CANH đường nối nhãn màn → panel, KHÔNG phải bài tái hiện: nó xanh cả trên mã cũ (đo
 * 2026-10-04), vì panel cũ khi gắn thấy lịch sử không rỗng nên tự hẹn lưu. Lỗ thật — rời
 * màn mà không chọn gì — không đo được ở e2e: mock giữ lớp đã ghi trong closure của từng
 * máy khách. Bài đơn vị `useViewer3DSave.test.ts` giữ phần ấy.
 */
test('đổi tên phòng ở bảng diện tích lúc không chọn gì vẫn được tự lưu (B-V8-60)', async ({ page }) => {
  test.setTimeout(SAVE_FLOW_TIMEOUT_MS);
  /* Vai kỹ sư: không đăng nhập thì bảng diện tích không ghi tên vào kho (`canEdit`). */
  await openViewer(page, 'engineer');
  await seedSpatial(page, { projectId: VIEWER_PROJECT_ID });
  await dismissTourIfPresent(page);
  await page.getByRole('button', { name: 'Diện tích phòng', exact: true }).click();
  await dismissTourIfPresent(page);

  const areaPanel = page.getByRole('region', { name: 'Bảng diện tích phòng' });
  await expect(page.getByRole('region', { name: 'Thuộc tính đối tượng', exact: true })).toHaveCount(0);
  await areaPanel.getByRole('textbox', { name: /^Tên phòng / }).first().fill(RENAMED);
  await expect(areaPanel.getByRole('textbox', { name: `tên phòng ${RENAMED}` })).toBeVisible();

  await selectRoomBySearch(page, 'phong doi ten', RENAMED);
  const properties = page.getByRole('region', { name: 'Thuộc tính đối tượng', exact: true });
  await expect(properties.getByText(/Đã lưu lúc \d{2}:\d{2}/u)).toBeVisible();
});
