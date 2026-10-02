import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { ROUTES, pathOf } from '../fixtures/routes';
import { signInAs } from '../fixtures/session';

import { FIRST_PAINT_TIMEOUT_MS, PROJECT_ID } from './files';

/**
 * Nhóm V5 — `projectScale` (`docs/notes/e2e/plan.md` V5 mục 2).
 *
 * Chỉ thứ trình duyệt thật chứng minh: con trỏ thật trên khung vẽ (một `<div
 * role="group">`, không phải `<canvas>`), chuỗi thập phân thật (A15), `Escape` qua
 * `shortcutRegistry` thật (A12), và vai theo phiên. Phép tính, cảnh báo, nhích bằng
 * phím: 31 bài đơn vị.
 *
 * Tầng: `L2` cho luồng chính. `L1` ra `error` THEO THIẾT KẾ của bộ mẫu — khung
 * bản vẽ của nó "không tìm thấy" (`FRAME_NOT_FOUND`, `src/api/__mocks__/client.ts`),
 * nên màn nói ảnh có thể méo. `ZZZ` không có trong dự án ⇒ lượt đọc hỏng.
 *
 * Khung cố định 1440 × 900: số pixel của đoạn kéo phụ thuộc hình học khung, nên
 * khẳng định số dùng regex, không dùng một con số đúng.
 */

const scaleOf = (floorId: string): string => ROUTES.project.scale(PROJECT_ID, floorId);
const HANDLE_START = 'Đầu đoạn tham chiếu, dùng phím mũi tên để nhích';

async function openScale(page: Page, floorId: string): Promise<Locator> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(scaleOf(floorId));
  const canvas = page.getByRole('group', { name: 'Bản vẽ đã nắn, kéo để vẽ đường tham chiếu' });
  await expect(canvas).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  return canvas;
}

/** Kéo ngang từ 20 % tới 50 % bề rộng khung; `release: false` để giữ chuột. */
async function drag(page: Page, canvas: Locator, release = true): Promise<void> {
  const box = await canvas.boundingBox();

  if (box === null) {
    throw new Error('khung vẽ không có hình hộp');
  }

  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5, { steps: 8 });

  if (release) {
    await page.mouse.up();
  }
}

test('kéo một đoạn, nhập chiều dài thật, tỷ lệ hiện bằng dấu phẩy thập phân (A15)', async ({ page }) => {
  const canvas = await openScale(page, 'L2');

  await drag(page, canvas);
  await expect(page.getByRole('button', { name: HANDLE_START })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chưa đủ dữ liệu để chốt tỷ lệ' })).toBeVisible();

  await page.getByLabel('Chiều dài thật').fill('4800');

  const computation = page.getByLabel('Phép tính ra tỷ lệ');
  // Ba vế nằm ở ba phần tử liền nhau, không khoảng trắng giữa chúng trong `textContent`.
  await expect(computation).toHaveText(/÷\s*\d+,\d+ px\s*=\s*\d+,\d+ mm\/px/);
  // Dấu chấm chỉ được phép là dấu phân nhóm nghìn (`4.800 mm`), không bao giờ là
  // dấu thập phân của tỷ lệ.
  await expect(computation).not.toHaveText(/\d\.\d+ mm\/px/);
});

test('Esc huỷ đoạn đang kéo, ở lại màn, và lượt kéo sau vẫn vẽ được (A12)', async ({ page }) => {
  const canvas = await openScale(page, 'L2');

  await drag(page, canvas, false);
  await page.keyboard.press('Escape');
  await page.mouse.up();

  await expect(page.getByRole('button', { name: HANDLE_START })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Chưa có chuỗi kích thước nào để đối chiếu' })).toBeVisible();
  expect(pathOf(page.url())).toBe(scaleOf('L2'));

  await drag(page, canvas);

  await expect(page.getByRole('button', { name: HANDLE_START })).toBeVisible();
});

test('L1: bộ mẫu không tìm thấy khung bản vẽ ⇒ màn nói ảnh có thể méo và mở lối về tiền xử lý', async ({
  page,
}) => {
  await page.goto(scaleOf('L1'));

  await expect(
    page.getByRole('heading', { name: 'Nắn ảnh thất bại nên bản vẽ có thể méo' }),
  ).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  await expect(page.getByRole('button', { name: 'Quay lại bước tiền xử lý' })).toBeVisible();
});

test('B-V5-04: tầng không có trong dự án là lỗi đọc, không bị gọi là "nắn ảnh thất bại"', async ({
  page,
}) => {
  await page.goto(scaleOf('ZZZ'));

  await expect(page.getByRole('button', { name: 'Tải lại ảnh' })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await expect(page.getByText(/Nắn ảnh thất bại/)).toHaveCount(0);
});

test('vai Người xem theo phiên thật thấy bản vẽ nhưng không áp được tỷ lệ', async ({ page }) => {
  await signInAs(page, 'viewer', scaleOf('L2'));

  await expect(page.getByRole('heading', { name: 'Bạn không có quyền hiệu chỉnh tỷ lệ' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Bản vẽ đã nắn của Tầng 2' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Áp dụng tỷ lệ' })).toHaveCount(0);
});

test('B-V5-01: kho chưa có tầng thì "Áp dụng tỷ lệ" nói lý do tại chỗ, không im lặng (A11)', async ({
  page,
}) => {
  const canvas = await openScale(page, 'L2');
  await drag(page, canvas);
  await page.getByLabel('Chiều dài thật').fill('4800');

  await page.getByRole('button', { name: 'Áp dụng tỷ lệ' }).click();

  await expect(page.getByRole('alert').filter({ hasText: 'Chưa nạp dữ liệu không gian của tầng này' })).toBeVisible();
});

test.fixme(
  'B-V5-01: áp tỷ lệ xong thì màn nói "Đã áp tỷ lệ cho bản vẽ"',
  // Lý do: route chưa nạp đồ thị không gian của tầng, và `:floorId` của route
  // (`L2`, mã tầng API) không phải mã `Level` của đồ thị — nên `onApply`
  // (`useScaleCalibration.ts`) không có gì để vá. Đường nạp là
  // `apiClient.spatial.readLayer` (N16, nhận mã tầng API, trả kèm mã Level) mà W04
  // đang thêm.
  // Mở lại khi: đã gộp `readLayer` của W04 (B-V6-01) và màn tỷ lệ nạp tầng qua nó.
  async ({ page }) => {
    const canvas = await openScale(page, 'L2');
    await drag(page, canvas);
    await page.getByLabel('Chiều dài thật').fill('4800');

    await page.getByRole('button', { name: 'Áp dụng tỷ lệ' }).click();

    await expect(page.getByRole('heading', { name: 'Đã áp tỷ lệ cho bản vẽ' })).toBeVisible();
  },
);
