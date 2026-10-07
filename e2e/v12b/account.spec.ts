import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';

import { FIRST_PAINT_TIMEOUT_MS } from './firstPaint';

/**
 * Nhóm V12b — `account` (`/tai-khoan`), `plan.md` mục 8 · V12 · 7.
 *
 * Màn có 151 bài đơn vị; e2e chỉ giữ thứ jsdom không chứng minh được:
 *
 * - AC-1: tự lưu bằng **đồng hồ thật** (đơn vị `AccountSettings.test.tsx:194` dùng
 *   đồng hồ giả).
 * - AC-2: phiên đăng nhập và xoá tài khoản là v2 — F-09b [4.4] tắt chúng bằng cờ năng lực,
 *   và khối [9] buộc hai khối **rời DOM** (không `disabled`, không `forbidden`).
 * - F3: sửa hồ sơ có toast hoàn tác đưa giá trị cũ trở lại (A8, B-V12b-03).
 *
 * Dữ liệu là bộ nhớ của module (`accountSettingsGateway.ts`), không có endpoint để
 * `page.route` — nên các trạng thái A11 khác `success` thuộc tầng đơn vị.
 */

const NAME = 'Nguyễn Văn Thử';

/** `createAutosave` mặc định 800 ms sau thao tác cuối (A7, `useAccountSettings.ts`). */
const AUTOSAVE_DELAY_MS = 800;
/**
 * Hai mốc được ghi ở hai lượt vẽ khác nhau của React, mỗi mốc trễ sau đồng hồ
 * hẹn giờ một chút — trừ một khung để phép so không đỏ vì làm tròn khung hình.
 */
const FRAME_SLACK_MS = 50;

/**
 * Chỉ báo lưu (`SaveIndicator`). Trang còn hai vùng `status` khác: `… phím tắt đang có
 * hiệu lực.` (lọc bằng chữ) và bộ thông báo sr-only (`lib/input/announcer.ts`) đọc lại
 * đúng câu "Đã lưu lúc …" — nó được gắn vào cuối `body` sau lượt lưu đầu, nên chỉ báo
 * thấy được là phần tử ĐẦU theo thứ tự tài liệu.
 */
function saveIndicator(page: Page) {
  return page
    .getByRole('status')
    .filter({ hasText: /^(Chưa có thay đổi|Có thay đổi chờ đồng bộ|Đang lưu(…|\.\.\.)|Đã lưu lúc.*|Lưu thất bại.*)$/u })
    .first();
}

test.beforeEach(async ({ page }) => {
  await page.goto(ROUTES.account);
  await expect(page.getByRole('heading', { level: 1, name: 'Cài đặt tài khoản' })).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
});

test('AC-1 sửa họ tên: báo "chờ đồng bộ" ngay, tự lưu sau ≥ 800 ms đồng hồ thật (A7)', async ({ page }) => {
  const indicator = saveIndicator(page);
  await expect(indicator).toHaveText('Chưa có thay đổi');

  // Ghi mọi lần chữ đổi TRƯỚC khi gõ: "chờ đồng bộ" chỉ sống 800 ms, một `expect`
  // bắt đầu muộn có thể lỡ nó — nhật ký thì không.
  await indicator.evaluate((node) => {
    const log: Array<[number, string]> = [];
    (window as unknown as { __saveLog: typeof log }).__saveLog = log;
    new MutationObserver(() => log.push([performance.now(), node.textContent ?? ''])).observe(node, {
      subtree: true,
      characterData: true,
      childList: true,
    });
  });

  await page.getByLabel('Họ tên').fill(NAME);
  await expect(indicator).toHaveText(/^Đã lưu lúc \d{2}:\d{2}$/u);

  const log = await page.evaluate(() => (window as unknown as { __saveLog: Array<[number, string]> }).__saveLog);
  const pending = log.find(([, text]) => text === 'Có thay đổi chờ đồng bộ');
  const saved = log.find(([, text]) => text.startsWith('Đã lưu lúc'));
  expect(pending, `nhật ký chỉ báo: ${JSON.stringify(log)}`).toBeDefined();
  expect(saved![0] - pending![0]).toBeGreaterThanOrEqual(AUTOSAVE_DELAY_MS - FRAME_SLACK_MS);
  await expect(page.getByLabel('Họ tên')).toHaveValue(NAME);
});

test('AC-2 phiên đăng nhập và vùng nguy hiểm vắng khỏi DOM khi năng lực tắt (F-09b [4.4], [9])', async ({ page }) => {
  // Mốc: khối mật khẩu (N13, có dây ở v1) đã vẽ thì cả trang đã qua lượt tải.
  await expect(page.getByRole('region', { name: 'mật khẩu' })).toBeVisible();

  await expect(page.getByRole('region', { name: 'phiên đăng nhập' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Vùng nguy hiểm' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Xoá tài khoản', exact: true })).toHaveCount(0);
});

/*
 * B-V12b-03 (đã sửa): lượt tự lưu từng không phát vé hoàn tác. Nay mỗi lượt lưu kèm
 * toast "Hoàn tác" trên kênh chung; hoàn tác ghi lại giá trị cũ qua chính đường tự
 * lưu. Đã kiểm đỏ trước sửa.
 */
test('F3 sửa họ tên có toast "Hoàn tác" đưa họ tên cũ trở lại (A8)', async ({ page }) => {
  const nameField = page.getByLabel('Họ tên');
  const before = await nameField.inputValue();
  await nameField.fill(NAME);
  await expect(saveIndicator(page)).toHaveText(/^Đã lưu lúc/u);

  const undo = page.getByRole('button', { name: 'Hoàn tác' });
  await expect(undo).toBeVisible();
  await undo.click();

  await expect(nameField).toHaveValue(before);
});
