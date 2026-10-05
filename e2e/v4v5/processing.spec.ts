import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES, pathOf } from '../fixtures/routes';

import { FIRST_PAINT_TIMEOUT_MS, PROJECT_ID, pngFile } from './files';

/**
 * Nhóm V4 — `ProcessingScreen` (`projectPipeline`) và `PipelineFailure`
 * (`docs/notes/e2e/plan.md` V4 mục 3–4).
 *
 * Danh sách màn theo dõi đến từ N7 (`client.drawings.latestUploads`, lượt tải mới
 * nhất của từng tầng). Bộ mẫu có đúng một lượt: bản vẽ sẵn của Tầng 1, đã xử lý
 * xong. Mọi thứ có thời gian (SSE, tiến độ, chạy nền) đã phủ ở 30 bài đơn vị với
 * đồng hồ giả — ở đây chỉ chứng minh màn CÓ dữ liệu, từ mọi lối vào.
 *
 * `PipelineFailure` không có bài: bộ mẫu không có lượt nào hỏng, nên màn chủ không
 * bao giờ gắn nó (`useProcessingScreen` chỉ gắn khi một bước `failed`). 55 bài đơn
 * vị giữ nó. Mở lại khi bộ mẫu có một lượt `status: 'failed'`.
 */

const PIPELINE = ROUTES.project.pipeline(PROJECT_ID);

async function expectSeededRun(page: Page): Promise<void> {
  await expect(page.getByRole('navigation', { name: 'Xử lý' })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await expect(page.getByText('Đã xong 1/1 tầng')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chưa có bước nào để theo dõi' })).toHaveCount(0);
}

test('B-V4-01: mở thẳng /pipeline thì màn theo dõi lượt tải sẵn có của dự án, không rơi vào "chưa có bước nào"', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(PIPELINE);

  await expectSeededRun(page);
  await expect(page.getByRole('progressbar', { name: 'Tiền xử lý' })).toHaveAttribute(
    'aria-valuenow',
    '100',
  );
});

test('B-V4-01: tới từ "Vẫn dùng AI" của hộp thoại CAD cũng thấy cùng danh sách', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(ROUTES.project.cadConfirm(PROJECT_ID, 'L1'));

  await page
    .getByRole('dialog', { name: 'Phát hiện tệp CAD' })
    .getByRole('button', { name: 'Vẫn dùng AI' })
    .click({ timeout: FIRST_PAINT_TIMEOUT_MS });

  await expect.poll(() => pathOf(page.url())).toBe(PIPELINE);
  await expectSeededRun(page);
});

test.fixme(
  'B-V4-08: ba bản vẽ vừa tải lên hiện ở màn xử lý ngay sau "Bắt đầu xử lý"',
  // Lý do: mỗi màn tự dựng một bộ mẫu riêng (`createAppApiClient` gọi
  // `createMockApiClient()` mỗi lần, `src/api/appClient.ts`), nên lượt tải của màn
  // tải lên không tồn tại trong bộ mẫu của màn xử lý — chỉ Tầng 1 sẵn có hiện ra.
  // Chỉ là bộ mẫu dev (ngoài FE); máy chủ thật trả N7 từ cùng một kho.
  // Mở lại khi: bộ mẫu dev dùng chung một bản giữa các màn trong một lượt tải trang.
  async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(ROUTES.project.upload(PROJECT_ID));
    await page
      .getByTestId('floor-upload-file-input')
      .setInputFiles([pngFile('tang-ham.png'), pngFile('tang-2.png'), pngFile('tang-3.png')]);
    await expect(page.getByRole('status').filter({ hasText: 'tầng đã có bản vẽ' })).toHaveText(
      /4 \/ 4/,
    );
    await page.getByRole('button', { name: 'Bắt đầu xử lý' }).click();

    await expect.poll(() => pathOf(page.url())).toBe(PIPELINE);
    await expect(page.getByText(/\/4 tầng$/)).toBeVisible();
  },
);
