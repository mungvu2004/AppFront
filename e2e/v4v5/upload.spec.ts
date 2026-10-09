import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES, pathOf } from '../fixtures/routes';
import { signInAs } from '../fixtures/session';

import { FIRST_PAINT_TIMEOUT_MS, PROJECT_ID, pdfFile, pngFile, type SampleFile } from './files';

/**
 * Nhóm V4 — `projectUpload` (`docs/notes/e2e/plan.md` V4 mục 1).
 *
 * Chỉ thứ trình duyệt thật chứng minh mà 42 bài đơn vị không: `File` thật đi qua
 * `validateUploadFile`, bộ đếm/cổng của nút chính trên dữ liệu bộ mẫu, router thật,
 * vé hoàn tác trong cây thật. Ghép theo tên tệp, kéo-thả, tiến trình phần trăm:
 * tầng đơn vị.
 *
 * Bộ mẫu: Tầng 1 đã có bản vẽ trên máy chủ, nên "đủ 4 tầng" = ba tệp
 * `tang-ham` · `tang-2` · `tang-3`.
 *
 * Ô chọn tệp neo bằng `data-testid`: input là `sr-only` nên không có role, và
 * nhãn "Chọn tệp" trùng với nút mở hộp chọn tệp của hệ điều hành.
 */

const UPLOAD = ROUTES.project.upload(PROJECT_ID);
const PIPELINE = ROUTES.project.pipeline(PROJECT_ID);
const THREE_FLOORS = [pngFile('tang-ham.png'), pngFile('tang-2.png'), pngFile('tang-3.png')];

async function openUpload(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(UPLOAD);
  await expect(page.getByRole('navigation', { name: 'Tải lên bản vẽ' })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
}

function counter(page: Page) {
  return page.getByRole('status').filter({ hasText: 'tầng đã có bản vẽ' });
}

async function attach(page: Page, files: readonly SampleFile[]): Promise<void> {
  await page.getByTestId('floor-upload-file-input').setInputFiles([...files]);
}

test('ba tệp ghép đúng tầng theo tên, bộ đếm lên 4 / 4 và "Bắt đầu xử lý" sang màn xử lý', async ({
  page,
}) => {
  await openUpload(page);
  await expect(counter(page)).toHaveText(/1 \/ 4 tầng đã có bản vẽ/);

  await attach(page, THREE_FLOORS);

  await expect(counter(page)).toHaveText(/4 \/ 4 tầng đã có bản vẽ/);
  await expect(page.getByText('Ghép tự động từ tên tệp — kiểm tra lại')).toHaveCount(3);

  await page.getByRole('button', { name: 'Bắt đầu xử lý' }).click();

  await expect.poll(() => pathOf(page.url())).toBe(PIPELINE);
  await expect(page.getByRole('navigation', { name: 'Xử lý' })).toBeVisible();
});

test('chưa đủ bản vẽ thì nút chính nêu đúng ba tầng thiếu và không rời màn', async ({ page }) => {
  await openUpload(page);

  await page.getByRole('button', { name: 'Bắt đầu xử lý' }).click();

  const alert = page.getByRole('alert').filter({ hasText: 'Không thể bắt đầu xử lý' });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('Tầng hầm chưa có bản vẽ.');
  await expect(alert).toContainText('Tầng 2 chưa có bản vẽ.');
  await expect(alert).toContainText('Tầng 3 chưa có bản vẽ.');
  await expect(alert).not.toContainText('Tầng 1 chưa có bản vẽ.');
  expect(pathOf(page.url())).toBe(UPLOAD);
});

test('B-V4-04: PDF chưa chọn trang chưa phải bản vẽ — nút chính chặn, không sang màn xử lý', async ({
  page,
}) => {
  await openUpload(page);

  await attach(page, [pdfFile('tang-2.pdf', 3), pngFile('tang-ham.png'), pngFile('tang-3.png')]);

  await expect(page.getByRole('combobox', { name: 'Chọn trang' })).toBeVisible();
  await expect(counter(page)).toHaveText(/3 \/ 4 tầng đã có bản vẽ/);

  await page.getByRole('button', { name: 'Bắt đầu xử lý' }).click();

  await expect(page.getByRole('alert').filter({ hasText: 'Không thể bắt đầu xử lý' })).toContainText(
    'Tầng 2 chưa tải xong bản vẽ.',
  );
  expect(pathOf(page.url())).toBe(UPLOAD);
});

test('B-V4-03: xoá một bản vẽ đã gắn rồi bấm "Hoàn tác" trả nó về đúng chỗ, bộ đếm về 4 / 4 (A8)', async ({
  page,
}) => {
  await openUpload(page);
  await attach(page, THREE_FLOORS);
  await expect(counter(page)).toHaveText(/4 \/ 4 tầng đã có bản vẽ/);

  await page.getByRole('button', { name: 'Tuỳ chọn của tầng Tầng 2' }).click();
  await page.getByRole('button', { name: 'Xoá bản vẽ tang-2.png' }).click();

  // Không hộp thoại — xoá ngay, đường về là toast (A8).
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(counter(page)).toHaveText(/3 \/ 4 tầng đã có bản vẽ/);
  // Lọc theo nút: bộ thông báo (`data-announcer`) cũng có thể là `role="status"` cùng chữ.
  const toast = page
    .getByRole('status')
    .filter({ hasText: 'Đã xoá bản vẽ tang-2.png' })
    .filter({ has: page.getByRole('button', { name: 'Hoàn tác' }) });
  await expect(toast).toBeVisible();

  await toast.getByRole('button', { name: 'Hoàn tác' }).click();

  await expect(counter(page)).toHaveText(/4 \/ 4 tầng đã có bản vẽ/);
  // B-V4-11: toast đã hết việc thì rời đi — trước đây nó ở lại dưới con trỏ và che
  // nút chính.
  await expect(toast).toHaveCount(0);
  await page.getByRole('button', { name: 'Bắt đầu xử lý' }).click();
  await expect.poll(() => pathOf(page.url())).toBe(PIPELINE);
});

test('B-V4-07: nút tuỳ chọn của thẻ nói nó mở hay đóng, Esc đóng nó, và tầng không có gì để chọn thì không có nút', async ({
  page,
}) => {
  await openUpload(page);
  await attach(page, [pngFile('tang-2.png')]);

  // Tầng 1 chỉ có bản vẽ sẵn trên máy chủ: không huỷ, không thử lại, không xoá.
  await expect(page.getByRole('button', { name: 'Tuỳ chọn của tầng Tầng 1' })).toHaveCount(0);

  const options = page.getByRole('button', { name: 'Tuỳ chọn của tầng Tầng 2' });
  await expect(options).toHaveAttribute('aria-expanded', 'false');

  await options.click();
  await expect(options).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: 'Xoá bản vẽ tang-2.png' })).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(options).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('button', { name: 'Xoá bản vẽ tang-2.png' })).toHaveCount(0);
  expect(pathOf(page.url())).toBe(UPLOAD);
});

test('vai Người xem đọc được danh sách tầng nhưng không có chỗ nào để tải lên', async ({ page }) => {
  await signInAs(page, 'viewer', UPLOAD);

  await expect(
    page.getByText('Vai hiện tại chỉ được xem danh sách tệp, không tải lên và không sửa.'),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tầng 1' })).toBeVisible();
  await expect(page.getByTestId('floor-upload-file-input')).toHaveCount(0);
  await expect(page.getByTestId('floor-upload-dropzone')).toHaveCount(0);
});
