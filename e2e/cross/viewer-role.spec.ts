import { expect, test } from '@playwright/test';

import { fixtureF1 } from '../../src/lib/pascal/__fixtures__';
import { installFakeApi, type WireGraphDocument } from '../fixtures/fakeApi';
import { ROUTES } from '../fixtures/routes';
import { signInAs } from '../fixtures/session';
import { FIRST_PAINT_TIMEOUT_MS } from '../v12b/firstPaint';

/**
 * Lưới vai `viewer` — QA/B-3 (`questions.md`, "Bảng chốt nhanh"): một bảng
 * `[màn, chuỗi mong đợi]`, bảy lời gọi `test()`. Một đơn vị bảo trì, bảy kết quả độc
 * lập — màn nào nói sai câu giải thích vai thì đúng bài của màn ấy đỏ.
 *
 * Mỗi dòng là một màn mà vai chỉ-xem đổi hẳn nội dung, và câu giải thích mỗi màn tự
 * khai **khác nhau** — lý do bảy dòng không gộp thành một khẳng định chung.
 *
 * Câu mong đợi chép nguyên văn từ trình duyệt thật (bài đo tạm của W10, 2026-10-03),
 * không từ kế hoạch. Không bấm gì: bài chỉ đọc, nên tour hướng dẫn (nếu hiện) không
 * chắn được nó.
 *
 * Màn của nhóm V12b (`adminUsers`, `adminModels`) KHÔNG ở đây: chúng có
 * bài vai riêng sâu hơn trong `e2e/v12b/`. `projectScale` cũng không: ở tầng `L1` vai
 * viewer thấy trạng thái lỗi "Nắn ảnh thất bại…" (lỗi đứng trước `forbidden`), nên câu
 * vai không hiện — đo 2026-10-03.
 */

const PROJECT_ID = 'project-1';
const FLOOR_ID = 'L1';

const ROWS = [
  { screen: 'dashboard', path: ROUTES.dashboard, expected: 'Vai người xem: chỉ có thể mở dự án, không tạo hoặc xoá được.' },
  {
    screen: 'projectSettings',
    path: ROUTES.project.settings(PROJECT_ID),
    expected: 'Vai hiện tại chỉ xem được cài đặt, không sửa và không xoá.',
  },
  {
    screen: 'projectUpload',
    path: ROUTES.project.upload(PROJECT_ID),
    expected: 'Vai hiện tại chỉ được xem danh sách tệp, không tải lên và không sửa.',
  },
  { screen: 'projectCadConfirm', path: ROUTES.project.cadConfirm(PROJECT_ID, FLOOR_ID), expected: 'Không có quyền xử lý CAD' },
  { screen: 'projectRooms', path: ROUTES.project.rooms(PROJECT_ID, FLOOR_ID), expected: 'Không có quyền sửa lớp phòng' },
  { screen: 'projectExport', path: ROUTES.project.export(PROJECT_ID), expected: 'Không có quyền xuất bản vẽ' },
] as const;

for (const row of ROWS) {
  test(`vai viewer ở ${row.screen}: màn nói rõ vì sao chỉ được xem (A11 forbidden)`, async ({ page }) => {
    await signInAs(page, 'viewer', row.path);
    await expect(page.getByText(row.expected, { exact: true })).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  });
}

/*
 * Màn 3D (cả `/3d/exploded`) nay là trang Pascal riêng `editor3d.html` (29eba219): trang ấy
 * không đi qua bộ giả lập của app nên dùng máy chủ giả `installFakeApi` với vai `viewer`.
 * Cầu không trả `save` khi chỉ đọc, và thanh trên nói vì sao (`BackToProjectCard` › `ReadOnlyChip`).
 */
test('vai viewer ở trang 3D (Pascal): màn nói rõ vì sao chỉ được xem, không có chip lưu (A11 forbidden)', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await installFakeApi(page, {
    projectId: 'P-FIXTURE0001',
    graphDoc: fixtureF1({ ext: false }).doc as unknown as WireGraphDocument,
    role: 'viewer',
  });
  await page.goto('/editor3d.html?project=P-FIXTURE0001');

  const note = page.getByRole('note').filter({ hasText: 'Bạn đang xem ở vai người xem nên không sửa được mô hình 3D.' });
  await expect(note).toBeVisible({ timeout: 90_000 });
  await expect(note).toContainText('Chỉ xem');
  await expect(page.getByRole('status').filter({ hasText: /^(Đã lưu|Đang lưu|Chưa lưu)/u })).toHaveCount(0);
});
