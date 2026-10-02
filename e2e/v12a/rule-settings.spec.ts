import { expect, test } from '@playwright/test';

import { ROUTES, pathOf } from '../fixtures/routes';
import { seedSpatial } from '../fixtures/seedSpatial';

/**
 * V12a — `projectRuleSettings` (`docs/notes/e2e/plan.md` V12 mục 2).
 *
 * Kho rỗng ở mọi đường sản phẩm (B-V12-01) nên ca có nội dung phải BƠM, và tên bài nói
 * ra điều đó. Ca mồi không bơm khẳng định chữ người dùng thấy hôm nay.
 *
 * Tự lưu chạy bằng đồng hồ THẬT — đơn vị dùng đồng hồ giả nên chỉ tầng này chứng minh
 * được A7. Bài chờ trạng thái dương ("Đã lưu lúc …"), không đo khoảng thời gian.
 */

const RULE_SETTINGS_URL = ROUTES.project.ruleSettings('project-1');

/** Lần tải đầu của một route bắt Vite dịch nguội; cùng hằng `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

/**
 * Tự lưu chờ 800 ms sau thao tác cuối (`useAutosave`) rồi mới ghi; chờ "Đã lưu" cần
 * hơn hạn 5 s mặc định một biên khi máy bận — một hằng có tên, không nâng hạn chung.
 */
const AUTOSAVE_SETTLE_TIMEOUT_MS = 10_000;

const EMPTY_TITLE = 'chưa có mô hình để áp bộ luật';

/** Vỏ màn — có ở mọi trạng thái, nên chờ nó không phụ thuộc chữ của `empty`. */
const SCREEN_HEADING = 'cài đặt bộ luật không gian';
const OPENING_RULE_SWITCH = /^bật hoặc tắt luật: lỗ mở nằm trọn/u;

test('ca mồi, không bơm: màn cài đặt đếm luật đang bật và nói thiếu MÔ HÌNH, không nói thiếu luật (B-V12-03)', async ({
  page,
}) => {
  await page.goto(RULE_SETTINGS_URL);

  await expect(page.getByRole('heading', { name: SCREEN_HEADING })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await expect(page.getByRole('heading', { name: EMPTY_TITLE })).toBeVisible();
  await expect(page.getByText(/^\d+\/\d+ luật đang bật$/u)).toBeVisible();
  await expect(page.getByText(/chưa có (bộ )?luật/iu)).toHaveCount(0);
});

test('có bơm kho: tắt một luật thì dòng đếm giảm một và tự lưu nói ra "đã lưu" mà không cần nút nào (A7)', async ({
  page,
}) => {
  await page.goto(RULE_SETTINGS_URL);
  await expect(page.getByRole('heading', { name: SCREEN_HEADING })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await seedSpatial(page);

  const ruleSwitch = page.getByRole('switch', { name: OPENING_RULE_SWITCH });
  await expect(ruleSwitch).toHaveAttribute('aria-checked', 'true');
  const counter = page.getByText(/^\d+\/\d+ luật đang bật$/u);
  // Số chạy hiệu ứng đếm (`useCountUp`) — đọc khi nó đã đứng ở giá trị cuối.
  await expect(counter).toHaveText(/^23\/25/u);

  await ruleSwitch.click();

  await expect(ruleSwitch).toHaveAttribute('aria-checked', 'false');
  await expect(counter).toHaveText(/^22\/25/u);
  // Hai vùng `status` cùng nói câu này (đầu màn + chân màn) — một là đủ chứng minh.
  await expect(
    page.getByRole('status').filter({ hasText: /^Đã lưu lúc \d{2}:\d{2}$/u }).first(),
  ).toBeVisible({ timeout: AUTOSAVE_SETTLE_TIMEOUT_MS });
});

test('có bơm kho: tắt một luật hiện toast có nút "Hoàn tác", bấm thì luật bật lại (A8, B-V12-04)', async ({
  page,
}) => {
  await page.goto(RULE_SETTINGS_URL);
  await expect(page.getByRole('heading', { name: SCREEN_HEADING })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await seedSpatial(page);

  const ruleSwitch = page.getByRole('switch', { name: OPENING_RULE_SWITCH });
  await ruleSwitch.click();
  await expect(ruleSwitch).toHaveAttribute('aria-checked', 'false');

  // Không `Ctrl+Z`: lượt bơm là một bước `zundo` (seedSpatial.ts). Hoàn tác đi bằng nút.
  await page.getByRole('button', { name: 'Hoàn tác' }).click();

  await expect(ruleSwitch).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText(/^\d+\/\d+ luật đang bật$/u)).toHaveText(/^23\/25/u);
});

test('màn cài đặt bộ luật tới được từ màn kiểm tra luật bằng liên kết, không phải gõ đường dẫn (B-V12-11)', async ({
  page,
}) => {
  await page.goto(ROUTES.project.rules('project-1'));

  await expect(page.getByRole('heading', { name: 'Kiểm tra luật không gian' })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await page.getByRole('link', { name: 'cài đặt bộ luật' }).click();

  await expect.poll(() => pathOf(page.url())).toBe(RULE_SETTINGS_URL);
  await expect(page.getByRole('heading', { name: 'cài đặt bộ luật không gian' })).toBeVisible();
});
