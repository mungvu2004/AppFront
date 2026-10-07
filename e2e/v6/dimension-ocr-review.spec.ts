import { expect, test, type Page } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';

import { QC_FLOOR, QC_PROJECT, seedQc } from './seedQc';

/**
 * `projectDimensions` — Đọc kích thước OCR (`plan.md` V6 mục 3).
 *
 * Đường nạp thật dùng tầng `L-LEVEL000001` của bộ mẫu A14 — id dạng `M-DIMN0000010`, KHÔNG
 * theo khuôn "số đếm trước" của `createId`. Đó đúng là hình dạng làm vỡ màn trước B-V6-09
 * (mọi dòng thành `#M-DIMN00`, trùng khoá React, nút duyệt trỏ nhầm) — và id ULID của BE
 * cũng vỡ y hệt. Không kiểm lại luồng gõ số (35 bài đơn vị phủ).
 */

/** Lần tải đầu một route bắt Vite dịch nguội; tiền lệ `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

/** Tầng 2 của bộ mẫu A14: 34 kích thước chia bốn tầng theo chỉ số ⇒ 9 ở tầng này. */
const A14_FLOOR = 'L-LEVEL000001';
const A14_DIMENSIONS_ON_FLOOR = 9;

const rows = (page: Page) =>
  page.getByRole('group', { name: 'Danh sách kích thước đọc được' }).getByRole('option');

test.describe('đường nạp thật (không bơm)', () => {
  test('id không theo khuôn số đếm vẫn cho mỗi dòng một nhãn riêng, không trùng khoá React (B-V6-09)', async ({
    page,
  }) => {
    const duplicateKeys: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && message.text().includes('two children with the same key')) {
        duplicateKeys.push(message.text());
      }
    });

    await page.goto(ROUTES.project.dimensions(QC_PROJECT, A14_FLOOR));
    await page.getByRole('radio', { name: 'tất cả' }).click({ timeout: FIRST_PAINT_TIMEOUT_MS });

    await expect(rows(page)).toHaveCount(A14_DIMENSIONS_ON_FLOOR);
    const labels = await rows(page).evaluateAll((options) =>
      options.map((option) => option.getAttribute('aria-label') ?? ''),
    );
    expect(new Set(labels).size).toBe(A14_DIMENSIONS_ON_FLOOR);
    expect(duplicateKeys).toEqual([]);
  });

  test('nút duyệt của một dòng duyệt đúng dòng ấy, chữ trên nút nằm trong tên truy cập, và Ctrl+Z trả lại bộ đếm (B-V6-09, B-V6-46, P7)', async ({ page }) => {
    await page.goto(ROUTES.project.dimensions(QC_PROJECT, A14_FLOOR));
    const counter = page.getByText(`0/${String(A14_DIMENSIONS_ON_FLOOR)} kích thước đã duyệt`).first();
    await expect(counter).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });

    const approve = page.getByRole('button', { name: 'Duyệt kích thước #M-002' });
    /* B-V6-46 (WCAG 2.5.3): chữ nhìn thấy trên nút nằm trong tên truy cập của nó. */
    const visible = (await approve.innerText()).trim();
    expect(visible.length).toBeGreaterThan(0);
    expect(await approve.getAttribute('aria-label')).toContain(visible);
    await approve.click();

    await expect(page.getByText(`1/${String(A14_DIMENSIONS_ON_FLOOR)} kích thước đã duyệt`).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Duyệt kích thước #M-002' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Duyệt kích thước #M-003' })).toBeVisible();

    /* Không bơm ⇒ không có lượt bơm nào để Ctrl+Z hoàn tác nhầm (ràng buộc 6.1 chỉ áp cho ca bơm). */
    await page.keyboard.press('Control+z');
    await expect(counter).toBeVisible();
  });

  test('tầng chưa có lớp thì màn nói thật "Chưa đọc được chuỗi kích thước nào"', async ({ page }) => {
    await page.goto(ROUTES.project.dimensions(QC_PROJECT, 'L1'));

    await expect(page.getByText('Chưa đọc được chuỗi kích thước nào', { exact: true })).toBeVisible({
      timeout: FIRST_PAINT_TIMEOUT_MS,
    });
  });
});

test('[bơm] phím R bật chế độ duyệt bàn phím qua sổ phím thật (D-1)', async ({ page }) => {
  await page.goto(ROUTES.project.dimensions(QC_PROJECT, QC_FLOOR.dimensions));
  await expect(page.getByRole('region', { name: 'Đọc kích thước OCR' })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await seedQc(page, 'dimensions');
  await expect(page.getByRole('button', { name: 'Duyệt kích thước #M-002' })).toBeVisible();

  await page.keyboard.press('r');

  await expect(page.getByRole('button', { name: 'Tắt chế độ duyệt bàn phím' })).toBeVisible();
});
