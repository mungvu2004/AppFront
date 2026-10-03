import { expect, test } from '@playwright/test';

import { ROUTES, pathOf } from '../fixtures/routes';
import { seedSpatial } from '../fixtures/seedSpatial';

/**
 * V12a — `projectRules` và tấm trượt `ViolationDetail` (`docs/notes/e2e/plan.md` V12 mục 1, 3).
 *
 * Kho `spatial` không route nào nạp (B-V12-01), nên ca có nội dung phải BƠM — và tên
 * bài nói ra điều đó (plan.md 6.1). Ca mồi không bơm khẳng định đúng chữ người dùng
 * thấy hôm nay; ngày sản phẩm có đường nạp thật nó đỏ, và khi ấy hãy gỡ `seedSpatial`.
 *
 * Không hard-code số vi phạm: chúng đến từ `createSampleBuilding()` và đổi theo bộ mẫu.
 */

const PROJECT_ID = 'project-1';
const RULES_URL = ROUTES.project.rules(PROJECT_ID);

/** Lần tải đầu của một route bắt Vite dịch nguội; cùng hằng `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

const EMPTY_TITLE = 'Chưa có mô hình để kiểm tra luật';

/** Vỏ màn — có ở mọi trạng thái, nên chờ nó không phụ thuộc chữ của `empty`. */
const SCREEN_HEADING = 'Kiểm tra luật không gian';

test('ca mồi, không bơm: màn luật nói thẳng là chưa có mô hình và không mời bấm một lượt chạy chắc chắn hỏng (B-V12-02)', async ({
  page,
}) => {
  await page.goto(RULES_URL);

  await expect(page.getByRole('heading', { name: SCREEN_HEADING })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await expect(page.getByRole('heading', { name: EMPTY_TITLE })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chạy kiểm tra', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Không chạy được lượt kiểm tra' })).toHaveCount(0);
});

test.fixme(
  'B-V12-01: vào màn luật bằng đường sản phẩm (không bơm) thì có kết quả kiểm tra của mô hình thật',
  // Lý do: không route nào nạp `store.spatial` (`setSpatial`/`setFloors` chỉ có ở kho và
  // test), nên màn luôn `empty`. Chờ quyết (questions.md Q1 — đường nạp thật là tính năng
  // mới). Mở lại khi có bộ nạp kho theo dự án; khi ấy gỡ `seedSpatial` khỏi tệp này.
  async ({ page }) => {
    await page.goto(RULES_URL);
    await expect(page.getByRole('button', { name: 'Chạy kiểm tra lại' })).toBeVisible({
      timeout: FIRST_PAINT_TIMEOUT_MS,
    });
  },
);

test('có bơm kho: bảng luật hiện bốn con số nguyên, chạy lại không rơi về rỗng, và "Xác nhận đã xử lý" khoá khi còn vi phạm', async ({
  page,
}) => {
  await page.goto(RULES_URL);
  await expect(page.getByRole('heading', { name: SCREEN_HEADING })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await seedSpatial(page);

  const rerun = page.getByRole('button', { name: 'Chạy kiểm tra lại' });
  await expect(rerun).toBeVisible();

  // Bốn ô `<dt>/<dd>` (`RuleReportSummary.tsx`): nhãn đúng thứ tự, số là số nguyên trần.
  await expect(page.getByRole('term')).toHaveText(['tổng số kiểm tra', 'đạt', 'cảnh báo', 'vi phạm']);
  await expect(page.getByRole('definition')).toHaveText([/^\d+$/u, /^\d+$/u, /^\d+$/u, /^\d+$/u]);

  const confirm = page.getByRole('button', { name: 'Xác nhận đã xử lý' });
  await expect(confirm).toBeDisabled();

  await rerun.click();
  await expect(page.getByRole('heading', { name: EMPTY_TITLE })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^lỗ mở nằm trọn/u })).toBeVisible();
});

test('có bơm kho: tấm chi tiết vi phạm mở từ một dòng, J sang vi phạm kế mà không đóng, Esc đóng đúng tấm và ở lại màn (A12, A15)', async ({
  page,
}) => {
  await page.goto(RULES_URL);
  await expect(page.getByRole('heading', { name: SCREEN_HEADING })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await seedSpatial(page);

  await page.getByRole('button', { name: /^lỗ mở nằm trọn/u }).click();
  const rows = page.getByRole('button', { name: /^Lỗ mở #D-\d{3}/u });
  const firstMessage = (await rows.first().innerText()).trim();
  await rows.first().click();

  const panel = page.getByRole('complementary', { name: 'chi tiết vi phạm' });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(firstMessage);

  // VD-3: nơi gọi thật không có hành động sửa nào (`ruleReportGateway.ts`, B-V12-F4 — không
  // phải lỗi), nên tấm ở `partial`: phần căn cứ hiện đủ, không phần "Lựa chọn xử lý".
  await expect(panel.getByText('Nguyên nhân có thể')).toBeVisible();
  await expect(
    panel.getByText(
      'Chưa có cách sửa tự động nào cho vi phạm này. Phần căn cứ ở trên đủ để sửa tay trên bản vẽ.',
    ),
  ).toBeVisible();
  await expect(panel.getByText('Lựa chọn xử lý')).toHaveCount(0);

  // A15: số có phần lẻ dùng dấu phẩy. `1.200 mm` là dấu nghìn, nên chỉ bắt dấu chấm
  // đứng trước ĐÚNG hai chữ số cuối một số.
  await expect(panel).toContainText(/độ tin cậy \d,\d{2}/u);
  await expect(panel).not.toContainText(/\d\.\d{2}(?!\d)/u);

  await page.keyboard.press('j');
  await expect(panel).toBeVisible();
  await expect(panel).not.toContainText(firstMessage);

  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  expect(pathOf(page.url())).toBe(RULES_URL);
  await expect(page.getByRole('button', { name: 'Chạy kiểm tra lại' })).toBeVisible();
});

test('có bơm kho: chip của hàng và tấm chi tiết gọi lỗ mở bằng mã người đọc như câu luật, không bằng mã máy (B-V7-31)', async ({
  page,
}) => {
  await page.goto(RULES_URL);
  await expect(page.getByRole('heading', { name: SCREEN_HEADING })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await seedSpatial(page);

  await page.getByRole('button', { name: /^lỗ mở nằm trọn/u }).click();
  // Neo vào MỘT hàng rồi đọc chip của chính nó — mã `#D-001` lặp lại ở mỗi tầng (strict mode).
  const row = page
    .getByRole('row')
    .filter({ has: page.getByRole('button', { name: /^Lỗ mở #D-\d{3}/u }) })
    .first();
  const message = row.getByRole('button', { name: /^Lỗ mở #D-\d{3}/u });
  await expect(row.locator('code')).toHaveText(/^#D-\d{3}$/u);

  await message.click();
  const panel = page.getByRole('complementary', { name: 'chi tiết vi phạm' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText(/^#D-\d{3}$/u).first()).toBeVisible();
  await expect(panel.getByText(/^D-DOOR/u)).toHaveCount(0);
});
