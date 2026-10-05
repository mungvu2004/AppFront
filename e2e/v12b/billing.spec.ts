import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { signInAs } from '../fixtures/session';

import { FIRST_PAINT_TIMEOUT_MS } from './firstPaint';

/**
 * Nhóm V12b — `billing` (`/billing`), `plan.md` mục 8 · V12 · 8.
 *
 * Đơn vị (`BillingScreen.test.tsx`, 22 bài) đã in nguyên văn năm chuỗi số và đã kiểm
 * "nâng gói hỏi trước". e2e thêm đúng ba thứ cần trình duyệt thật: vai lấy từ phiên
 * đăng nhập thật (BI-1), `Esc` thật trên hộp thoại tiền + trạng thái sống sót sau
 * đóng (BI-2), và dấu thập phân trên mọi hàng hoá đơn đã vẽ (BI-3).
 *
 * Dữ liệu là bộ nhớ module (`billingGateway.ts`) và phiên là biến module của bộ mẫu:
 * mọi bài vào màn bằng `signInAs(…, BILLING_PATH)`, không `goto` lần hai.
 */

/**
 * Route `/billing` đã gỡ ở F-09a: BE chưa có thanh toán ở v1 (kế hoạch §10) và không mục
 * điều hướng nào trỏ tới. Mã màn giữ nguyên; bộ này chạy lại khi route trở lại.
 */
const BILLING_PATH = '/billing';

test.skip(true, 'Route /billing đã gỡ ở v1 (F-09a)');

const READ_ONLY_NOTICE = 'Chỉ quản trị viên có thể thay đổi gói.';

/** Tên gói hiện tại — thẻ `h2` của khối hạn mức (`QuotaCard.tsx`). */
function currentPlan(page: Page) {
  return page.getByRole('heading', { level: 2, name: /^(Cơ bản|Chuyên nghiệp|Doanh nghiệp)$/u });
}

const ROLE_ROWS = [
  { role: 'engineer', canChange: false },
  { role: 'admin', canChange: true },
] as const;

for (const row of ROLE_ROWS) {
  test(`BI-1 vai ${row.role} ${row.canChange ? 'đổi được' : 'chỉ đọc'} gói — vai lấy từ phiên thật (A11 forbidden)`, async ({
    page,
  }) => {
    await signInAs(page, row.role, BILLING_PATH);
    await expect(page.getByRole('heading', { level: 1, name: 'Thanh toán' })).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });

    const upgrade = page.getByRole('button', { name: 'Nâng gói', exact: true });
    await expect(upgrade).toHaveCount(2);
    if (row.canChange) {
      await expect(page.getByText(READ_ONLY_NOTICE)).toHaveCount(0);
      for (const button of await upgrade.all()) await expect(button).toBeEnabled();
      await expect(page.getByRole('button', { name: 'Đổi gói' })).toBeEnabled();
    } else {
      await expect(page.getByText(READ_ONLY_NOTICE)).toBeVisible();
      for (const button of await upgrade.all()) await expect(button).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Đổi gói' })).toBeDisabled();
      // Chế độ đọc, không phải màn chặn: dữ liệu vẫn hiện.
      await expect(currentPlan(page)).toHaveText('Cơ bản');
    }
  });
}

test('BI-2 nâng gói hỏi trước bằng hộp thoại có số tiền; Esc huỷ không đổi gì, xác nhận mới đổi (A9, A12)', async ({
  page,
}) => {
  await signInAs(page, 'admin', BILLING_PATH);
  await expect(currentPlan(page)).toHaveText('Cơ bản', { timeout: FIRST_PAINT_TIMEOUT_MS });

  const dialog = page.getByRole('dialog', { name: 'Xác nhận nâng gói' });
  // Hai nút cùng tên "Nâng gói" (hai gói cao hơn); nút đầu là gói kế tiếp.
  const firstUpgrade = page.getByRole('button', { name: 'Nâng gói', exact: true }).first();

  await firstUpgrade.click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Gói mới');
  await expect(dialog).toContainText('Chuyên nghiệp');
  await expect(dialog).toContainText(/Thanh toán ngay\s*[\d.]+ ₫/u);
  await expect(dialog.locator(':focus')).toHaveCount(1);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(currentPlan(page)).toHaveText('Cơ bản');

  await firstUpgrade.click();
  await dialog.getByRole('button', { name: 'Nâng gói' }).click();
  await expect(dialog).toBeHidden();
  await expect(currentPlan(page)).toHaveText('Chuyên nghiệp');
});

test('BI-3 diện tích hoá đơn dùng dấu phẩy thập phân trên mọi hàng (A15)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BILLING_PATH);

  const table = page.getByRole('table');
  // Hàng dữ liệu mang mã hoá đơn `HD-…`; hàng tiêu đề (`th`) cũng lộ ra như `cell` nên không lọc theo role được.
  const dataRows = table.getByRole('row').filter({ hasText: 'HD-' });
  await expect(dataRows.first()).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });

  // Cột thứ ba (`Diện tích`, `InvoiceTable.tsx`). `2.016,00 m²`: chấm nhóm nghìn, phẩy thập phân.
  const count = await dataRows.count();
  for (let index = 0; index < count; index += 1) {
    await expect(dataRows.nth(index).getByRole('cell').nth(2)).toHaveText(/^\d{1,3}(\.\d{3})*,\d{2} m²$/u);
  }

  // Không số nào trên màn viết thập phân kiểu Anh (`2016.00`). `5.000 m²` là nhóm
  // nghìn nên mẫu đòi đúng 1–2 chữ số sau dấu chấm rồi hết số.
  // Màn không có landmark `main` (đo 2026-10-03) — quét cả thân trang.
  await expect(page.locator('body')).not.toContainText(/\d\.\d{1,2}(?!\d)/u);
});
