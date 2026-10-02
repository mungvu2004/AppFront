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
 * - AC-2: `Esc` qua sổ phím thật đóng hộp thoại xoá tài khoản và **trả focus** về nút gọi.
 * - F3 (`test.fixme`): sửa hồ sơ không có toast hoàn tác (A8).
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
    .filter({ hasText: /^(Chưa có thay đổi|Có thay đổi chờ đồng bộ|Đang lưu\.\.\.|Đã lưu.*|Lưu thất bại)$/u })
    .first();
}

test.beforeEach(async ({ page }) => {
  await page.goto(ROUTES.account);
  await expect(page.getByRole('heading', { level: 1, name: 'cài đặt tài khoản' })).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
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

  await page.getByLabel('họ tên').fill(NAME);
  await expect(indicator).toHaveText(/^Đã lưu lúc \d{2}:\d{2}$/u);

  const log = await page.evaluate(() => (window as unknown as { __saveLog: Array<[number, string]> }).__saveLog);
  const pending = log.find(([, text]) => text === 'Có thay đổi chờ đồng bộ');
  const saved = log.find(([, text]) => text.startsWith('Đã lưu lúc'));
  expect(pending, `nhật ký chỉ báo: ${JSON.stringify(log)}`).toBeDefined();
  expect(saved![0] - pending![0]).toBeGreaterThanOrEqual(AUTOSAVE_DELAY_MS - FRAME_SLACK_MS);
  await expect(page.getByLabel('họ tên')).toHaveValue(NAME);
});

test('AC-2 hộp thoại xoá tài khoản: Esc đóng đúng nó, URL giữ, focus về nút gọi (A9, A12)', async ({ page }) => {
  const opener = page.getByRole('button', { name: 'Xoá tài khoản', exact: true });
  await opener.click();

  const dialog = page.getByRole('dialog', { name: 'Xoá tài khoản này?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Xoá vĩnh viễn' })).toBeDisabled();
  // Bẫy focus bật ở khung hình kế tiếp; Esc gửi trước đó thì không có gì để trả về.
  await expect(dialog.locator(':focus')).toHaveCount(1);

  await page.keyboard.press('Escape');

  await expect(dialog).toBeHidden();
  expect(new URL(page.url()).pathname).toBe(ROUTES.account);
  await expect(opener).toBeFocused();
});

test.fixme(
  'F3 sửa họ tên có toast "Hoàn tác" đưa họ tên cũ trở lại (A8)',
  // Lý do: `useAccountSettings.ts` (`save`) không phát toast; chỉ đăng xuất phiên có vé
  // hoàn tác (`useAccountAuth.ts`). Lỗi B-V12b-03 — chờ quyết: mỗi lượt tự lưu một toast
  // là đổi hành vi (A7 × A8). Mở lại khi người duyệt chọn cách nối toast cho hồ sơ.
  async ({ page }) => {
    const nameField = page.getByLabel('họ tên');
    const before = await nameField.inputValue();
    await nameField.fill(NAME);
    await expect(saveIndicator(page)).toHaveText(/^Đã lưu lúc/u);

    await page.getByRole('button', { name: 'Hoàn tác' }).click();

    await expect(nameField).toHaveValue(before);
  },
);
