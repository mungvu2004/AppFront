import { expect, test } from '@playwright/test';

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
 * Màn của nhóm V12b (`billing`, `adminUsers`, `adminModels`) KHÔNG ở đây: chúng có
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
  {
    screen: 'projectExploded',
    path: ROUTES.project.exploded(PROJECT_ID),
    expected: 'Bạn đang xem ở vai người xem nên không sửa được vị trí tầng.',
  },
] as const;

for (const row of ROWS) {
  test(`vai viewer ở ${row.screen}: màn nói rõ vì sao chỉ được xem (A11 forbidden)`, async ({ page }) => {
    await signInAs(page, 'viewer', row.path);
    await expect(page.getByText(row.expected, { exact: true })).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  });
}
