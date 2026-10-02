import { expect, test, type Page } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';

import { QC_FLOOR, QC_PROJECT, seedQc } from './seedQc';

/**
 * `projectGrids` — Quản lý trục và gốc toạ độ (`plan.md` V6 mục 4).
 *
 * Mục kế hoạch tự nói nó mỏng: logic chặn 100 mm, độ lệch gốc, căn tự động đã có 27 bài
 * đơn vị. Ở đây chỉ còn thứ trình duyệt thật chứng minh: màn nạp được dữ liệu (đường thật
 * và đường bơm) và đúng mã tầng.
 *
 * Bẫy tầng: màn lọc trục theo `:floorId` của URL, nên URL phải mang mã `Level` của đồ thị.
 */

/** Lần tải đầu một route bắt Vite dịch nguội; tiền lệ `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

/** Tầng 2 của bộ mẫu A14: bốn trục chia đều bốn tầng ⇒ một trục, "A". */
const A14_FLOOR = 'L-LEVEL000001';

const axisOptions = (page: Page) => page.getByRole('option', { name: /^Trục / });

test.describe('đường nạp thật (không bơm)', () => {
  test('mở thẳng màn ở một tầng có lớp thì trục của tầng ấy hiện ra từ máy chủ, không treo skeleton', async ({
    page,
  }) => {
    await page.goto(ROUTES.project.grids(QC_PROJECT, A14_FLOOR));

    await expect(axisOptions(page)).toHaveCount(1, { timeout: FIRST_PAINT_TIMEOUT_MS });
    await expect(page.getByRole('option', { name: /^Trục A,/u })).toBeVisible();
  });

  test('tầng chưa có lớp thì màn nói thật "chưa có trục nào"', async ({ page }) => {
    await page.goto(ROUTES.project.grids(QC_PROJECT, 'L1'));

    await expect(page.getByText('chưa có trục nào', { exact: true })).toBeVisible({
      timeout: FIRST_PAINT_TIMEOUT_MS,
    });
  });
});

test('[bơm] bộ mẫu trục ở đúng mã tầng hiện tám trục A–D, 1–4 với khoảng cách viết đơn vị (G-1)', async ({
  page,
}) => {
  await page.goto(ROUTES.project.grids(QC_PROJECT, QC_FLOOR.grids));
  await expect(page.getByRole('heading', { name: 'quản lý trục và gốc toạ độ' })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await seedQc(page, 'grids');

  await expect(axisOptions(page)).toHaveCount(8);
  await expect(page.getByRole('option', { name: 'Trục A, cách trục kế là 4.000 mm' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Trục 1, cách trục kế là 5.000 mm' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'gốc toạ độ 0,0' })).toBeVisible();
});
