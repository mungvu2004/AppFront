import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES, pathOf } from '../fixtures/routes';
import { signInAs } from '../fixtures/session';

import { FIRST_PAINT_TIMEOUT_MS, PROJECT_ID } from './files';

/**
 * Nhóm V4 — `projectQuality` (`docs/notes/e2e/plan.md` V4 mục 2).
 *
 * Màn mỏng nhất nhóm (19 bài đơn vị, không bài nào cho riêng hook), nên ở đây đi
 * sâu hơn: Esc thật trong chế độ bốn góc, hộp thoại hỏi trước "Tự động nắn" trong cây thật,
 * nút "Xử lý dù ảnh mờ" (không còn ô xác nhận), điều hướng router thật.
 *
 * Bộ mẫu: tầng mồi là Tầng hầm (chưa đo) ⇒ mặc định `partial`. Tầng 1 đo xong ở
 * mức Kém với ba phát hiện (độ phân giải thấp · nghiêng · không thấy khung).
 *
 * Ca `error` không dựng được bằng `page.route`: bộ mẫu chạy TRONG trình duyệt
 * (`createAppApiClient` → `createMockApiClient`, `src/api/appClient.ts`), không
 * qua mạng. Tầng đơn vị giữ nó.
 */

const QUALITY = ROUTES.project.quality(PROJECT_ID);

async function openFloorOne(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(QUALITY);
  await page
    .getByRole('row', { name: /Tầng 1/ })
    .click({ timeout: FIRST_PAINT_TIMEOUT_MS });
  await expect(
    page.getByRole('img', { name: 'Bản vẽ tầng Tầng 1, đang xem để kiểm tra chất lượng đầu vào' }),
  ).toBeVisible();
}

/**
 * Bộ đếm có hai bản: số CHẠY (`aria-hidden`) và vùng `role="status"` mang con số
 * thật (`InputQualityGateReportPanel.tsx`). Bám vùng status — không đợi số chạy.
 */
function remaining(page: Page, count: number) {
  return page.getByRole('status').filter({ hasText: new RegExp(`^${String(count)} phát hiện còn lại$`, 'u') });
}

test('B-V4-05: "Tự động nắn" hỏi trước (A9), Esc không gửi; xác nhận nắn xong không có toast hoàn tác (F-05a, #32)', async ({
  page,
}) => {
  await openFloorOne(page);
  await expect(remaining(page, 3)).toBeVisible();

  const dialog = page.getByRole('dialog', { name: 'Nắn thẳng bản vẽ tầng Tầng 1?', exact: true });

  await page.getByRole('button', { name: 'Tự động nắn' }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(remaining(page, 3)).toBeVisible();

  await page.getByRole('button', { name: 'Tự động nắn' }).click();
  await dialog.getByRole('button', { name: 'Nắn thẳng' }).click();

  await expect(dialog).toHaveCount(0);
  await expect(remaining(page, 2)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vùng ảnh có vấn đề: ảnh bị nghiêng' })).toHaveCount(0);
  // Máy chủ không đảo được #32 ⇒ không vé, không toast "Hoàn tác" (F-05a khối [9]).
  await expect(page.getByRole('button', { name: 'Hoàn tác' })).toHaveCount(0);
});

test('Esc thoát chế độ chọn bốn góc, ở lại đúng tầng và đúng màn; Esc thứ hai không làm gì (A12)', async ({
  page,
}) => {
  await openFloorOne(page);

  await page.getByRole('button', { name: 'Chọn góc thủ công' }).click();
  const corners = page.getByRole('group', { name: 'Bốn góc bản vẽ, kéo để chỉnh khung' });
  await expect(corners.getByRole('button')).toHaveCount(4);

  await page.keyboard.press('Escape');

  await expect(corners).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Chọn góc thủ công' })).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Bản vẽ tầng Tầng 1, đang xem để kiểm tra chất lượng đầu vào' }),
  ).toBeVisible();

  await page.keyboard.press('Escape');

  expect(pathOf(page.url())).toBe(QUALITY);
  await expect(page.getByRole('button', { name: 'Chọn góc thủ công' })).toBeVisible();
});

test('B-V4-02: ảnh kém không còn ô xác nhận; "Xử lý dù ảnh mờ" là một lần bấm đồng ý và sang màn xử lý', async ({
  page,
}) => {
  await openFloorOne(page);

  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByText('Bấm là chấp nhận: có thể phải vẽ tay tường bị sót.')).toBeVisible();

  await page.getByRole('button', { name: 'Xử lý dù ảnh mờ' }).click();

  await expect.poll(() => pathOf(page.url())).toBe(ROUTES.project.pipeline(PROJECT_ID));
  await expect(page.getByRole('navigation', { name: 'Xử lý' })).toBeVisible();
});

test('"Tải ảnh nét hơn" quay về màn tải lên của cùng dự án', async ({ page }) => {
  await page.goto(QUALITY);

  await page
    .getByRole('button', { name: 'Tải ảnh nét hơn' })
    .click({ timeout: FIRST_PAINT_TIMEOUT_MS });

  await expect.poll(() => pathOf(page.url())).toBe(ROUTES.project.upload(PROJECT_ID));
  // Breadcrumb dùng chung (BUG-079): `nav` tên "Đường dẫn trang", cấp cuối là tên màn.
  await expect(page.getByRole('navigation', { name: 'Đường dẫn trang' })).toContainText('Tải lên bản vẽ');
});

test('vai Người xem đọc được báo cáo nhưng hai nút hành động biến khỏi màn; cụm thu phóng nói tiếng Việt (B-V1-48)', async ({
  page,
}) => {
  await signInAs(page, 'viewer', QUALITY);

  await expect(page.getByRole('region', { name: 'Báo cáo chất lượng' })).toBeVisible();
  const zoom = page.getByRole('group', { name: 'Cụm thu phóng', exact: true });
  await expect(zoom).toBeVisible();
  await expect(zoom.getByRole('button', { name: /^Mức thu phóng \d+%, bấm để về 100%$/u })).toBeVisible();
  await expect(page.getByRole('button', { name: /^(?:Xử lý dù ảnh mờ|Bắt đầu xử lý)$/u })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^(?:Tải ảnh nét hơn|Tải ảnh khác)$/u })).toHaveCount(0);
});
