import { expect, test } from '@playwright/test';

import { ROUTES, pathOf } from '../fixtures/routes';
import { seedSpatial } from '../fixtures/seedSpatial';
import { signInAs } from '../fixtures/session';

/**
 * V12a — `projectRuleSettings` (`docs/notes/e2e/plan.md` V12 mục 2).
 *
 * Route nạp kho qua cổng `ProjectSpatialGate` (B-V12-01, đã sửa) — ca đầu KHÔNG bơm.
 * Ca sửa luật vẫn BƠM bộ mẫu A14 sau khi cổng nạp xong (`seedSpatial({ projectId })`),
 * và tên bài nói ra điều đó.
 *
 * Tự lưu chạy bằng đồng hồ THẬT — đơn vị dùng đồng hồ giả nên chỉ tầng này chứng minh
 * được A7. Bài chờ trạng thái dương ("Đã lưu lúc …"), không đo khoảng thời gian.
 */

const PROJECT_ID = 'project-1';
const RULE_SETTINGS_URL = ROUTES.project.ruleSettings(PROJECT_ID);

/** Lần tải đầu của một route bắt Vite dịch nguội; cùng hằng `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

/**
 * Tự lưu chờ 800 ms sau thao tác cuối (`useAutosave`) rồi mới ghi; chờ "Đã lưu" cần
 * hơn hạn 5 s mặc định một biên khi máy bận — một hằng có tên, không nâng hạn chung.
 */
const AUTOSAVE_SETTLE_TIMEOUT_MS = 10_000;

const EMPTY_TITLE = 'Chưa có mô hình để áp bộ luật';

/** Vỏ màn — có ở mọi trạng thái, nên chờ nó không phụ thuộc chữ của `empty`. */
const SCREEN_HEADING = 'Cài đặt bộ luật không gian';
const OPENING_RULE_SWITCH = /^Bật hoặc tắt luật: lỗ mở nằm trọn/u;

test('B-V12-01: vào màn cài đặt luật bằng đường sản phẩm (không bơm) thì cổng nạp kho và màn đếm luật đang bật, không nói thiếu mô hình', async ({
  page,
}) => {
  await page.goto(RULE_SETTINGS_URL);

  await expect(page.getByRole('heading', { name: SCREEN_HEADING })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  // Số chạy hiệu ứng đếm (`useCountUp`) — đọc khi nó đã đứng ở giá trị cuối.
  await expect(page.getByText(/^\d+\/\d+ luật đang bật$/u)).toHaveText(/^23\/25/u);
  await expect(page.getByRole('heading', { name: EMPTY_TITLE })).toHaveCount(0);
  await expect(page.getByText(/chưa có (bộ )?luật/iu)).toHaveCount(0);
});

test('có bơm kho: tắt một luật thì dòng đếm giảm một và tự lưu nói ra "đã lưu" mà không cần nút nào (A7)', async ({
  page,
}) => {
  // F-10: N22 `ruleset.edit` chỉ quản trị viên (HOP-DONG-MOI §6); vai mặc định của bộ
  // mẫu là `engineer`, nay chỉ đọc — nên bài sửa luật đăng nhập vai `admin`.
  await signInAs(page, 'admin', RULE_SETTINGS_URL);
  await expect(page.getByRole('heading', { name: SCREEN_HEADING })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await seedSpatial(page, { projectId: PROJECT_ID });

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
  // F-10: N22 `ruleset.edit` chỉ quản trị viên (HOP-DONG-MOI §6); vai mặc định của bộ
  // mẫu là `engineer`, nay chỉ đọc — nên bài sửa luật đăng nhập vai `admin`.
  await signInAs(page, 'admin', RULE_SETTINGS_URL);
  await expect(page.getByRole('heading', { name: SCREEN_HEADING })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await seedSpatial(page, { projectId: PROJECT_ID });

  const ruleSwitch = page.getByRole('switch', { name: OPENING_RULE_SWITCH });
  await ruleSwitch.click();
  await expect(ruleSwitch).toHaveAttribute('aria-checked', 'false');

  // Không `Ctrl+Z`: lượt bơm là một bước `zundo` (seedSpatial.ts). Hoàn tác đi bằng nút.
  await page.getByRole('button', { name: 'Hoàn tác' }).click();

  await expect(ruleSwitch).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText(/^\d+\/\d+ luật đang bật$/u)).toHaveText(/^23\/25/u);
});

test('F-10: vai kỹ sư (mặc định của bộ mẫu) xem được bộ luật ở chế độ chỉ đọc, kèm câu nói ai đổi được', async ({
  page,
}) => {
  await page.goto(RULE_SETTINGS_URL);
  await expect(page.getByRole('heading', { name: SCREEN_HEADING })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });

  await expect(page.getByText('Chỉ quản trị viên đổi được bộ luật; bạn đang xem ở quyền chỉ đọc.')).toBeVisible();
  await expect(page.getByRole('switch', { name: OPENING_RULE_SWITCH })).toBeDisabled();
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
  await expect(page.getByRole('heading', { name: 'Cài đặt bộ luật không gian' })).toBeVisible();
});
