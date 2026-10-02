import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES, loginUrl, pathOf } from '../fixtures/routes';
import {
  EMAIL_BY_ROLE,
  EMAIL_LABEL,
  PASSWORD_LABEL,
  SIGN_IN_PASSWORD,
  submitSignInForm,
} from '../fixtures/session';

/**
 * Màn đăng nhập (V1-LOGIN) — cổng vào duy nhất của sản phẩm. Đỏ ở đây thì không ai
 * vào được, và nếu `?next=` sai thì người dùng bị chuyển tới trang do kẻ khác chọn.
 *
 * Mọi bài đăng nhập đúng MỘT lần rồi để trình duyệt tự đi tiếp: phiên là biến
 * mô-đun của bộ mẫu nên một `goto` thứ hai làm mất nó.
 */

const authState = (page: Page) => page.locator('main[data-auth-state]');

/** Hai đích hợp lệ: một đường có tham số, một đường mang cả query lẫn hash. */
const VALID_DESTINATIONS = [
  ROUTES.mobileViewer('project-1'),
  `${ROUTES.account}?x=1#h`,
] as const;

for (const destination of VALID_DESTINATIONS) {
  test(`kỹ sư đăng nhập xong được đưa tới đích ${destination} nguyên vẹn`, async ({ page }) => {
    await page.goto(loginUrl(destination));
    await submitSignInForm(page, EMAIL_BY_ROLE.engineer);

    await expect.poll(() => pathOf(page.url())).toBe(destination);
  });
}

/**
 * `safeDestination` (`AuthScreen.container.tsx:105-111`) không có bài đơn vị nào:
 * các ca này là bằng chứng duy nhất rằng chuyển hướng mở bị chặn.
 */
const UNSAFE_DESTINATIONS = [
  ['đường bắt đầu bằng hai gạch chéo', '//evil.example'],
  ['địa chỉ tuyệt đối', 'https://evil.example'],
  ['đường không bắt đầu bằng gạch chéo', 'khong-bat-dau-bang-gach-cheo'],
  ['đích rỗng', ''],
  // B-V1-02: đích là chính màn đăng nhập thì người vừa đăng nhập bị bỏ lại trước biểu mẫu trống.
  ['chính màn đăng nhập', ROUTES.login],
] as const;

for (const [label, next] of UNSAFE_DESTINATIONS) {
  test(`đăng nhập với đích không an toàn (${label}) rơi về danh sách dự án, không rời khỏi trang`, async ({ page }) => {
    await page.goto(loginUrl(next));
    const startOrigin = new URL(page.url()).origin;
    await submitSignInForm(page, EMAIL_BY_ROLE.engineer);

    await expect.poll(() => pathOf(page.url())).toBe(ROUTES.dashboard);
    expect(new URL(page.url()).origin).toBe(startOrigin);
  });
}

/**
 * Trình duyệt đọc `\` như `/`, nên `/\evil.example/tai-khoan` là một địa chỉ của
 * host khác. Trước B-V1-02 nó lọt `safeDestination` và người dùng hạ cánh
 * `/tai-khoan` chỉ vì react-router tình cờ vứt host đi (`encodeLocation`). Nay nó bị
 * từ chối ngay ở bộ lọc, nên đích là danh sách dự án.
 */
test('đích có dấu gạch ngược sau gạch chéo bị từ chối: về danh sách dự án, cùng origin', async ({ page }) => {
  const backslash = String.fromCharCode(92);
  await page.goto(loginUrl(`/${backslash}evil.example${ROUTES.account}`));
  const startOrigin = new URL(page.url()).origin;

  await submitSignInForm(page, EMAIL_BY_ROLE.engineer);

  await expect.poll(() => pathOf(page.url())).toBe(ROUTES.dashboard);
  expect(new URL(page.url()).origin).toBe(startOrigin);
});

test('đích do màn trước đặt trong state.from thắng đích trong ?next=', async ({ page }) => {
  const fromState = ROUTES.account;
  const fromQuery = ROUTES.mobileViewer('project-1');

  await page.goto(loginUrl(fromQuery));

  /* Mock luôn cấp phiên nên không màn nào đá được tới /login kèm state.from; bài này dựng
     đúng thứ màn ấy sẽ để lại: một mục lịch sử mà react-router đọc state từ `usr`.

     GIÁ PHẢI TRẢ, nói ra để người sau không mất thời gian đoán: hình dạng `{ usr, key, idx }`
     là NỘI BỘ của react-router, không phải hợp đồng công khai. Nâng phiên bản react-router
     có thể làm bài này đỏ mà sản phẩm không sai gì. Gặp nó đỏ sau một lượt nâng gói thì
     kiểm hình dạng `history.state` trước khi đi tìm lỗi ở `AuthScreen.container.tsx`.

     Vẫn đáng giữ: `safeDestination` và thứ tự ưu tiên ở `AuthScreen.container.tsx:238-248`
     không có bài đơn vị nào, nên đây là bằng chứng duy nhất rằng `state.from` thắng `?next=`. */
  await page.evaluate((from) => {
    const current = window.history.state as { idx?: number } | null;
    window.history.pushState(
      { usr: { from }, key: 'e2e-state-from', idx: (current?.idx ?? 0) + 1 },
      '',
      window.location.href,
    );
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  }, fromState);

  await submitSignInForm(page, EMAIL_BY_ROLE.engineer);

  await expect.poll(() => pathOf(page.url())).toBe(fromState);
});

test('mở màn: ô đầu có tiêu điểm, trạng thái rỗng; gõ email mà chưa có mật khẩu thì là một phần', async ({ page }) => {
  await page.goto(ROUTES.login);

  await expect(authState(page)).toHaveAttribute('data-auth-state', 'empty');
  await expect(page.getByLabel(EMAIL_LABEL)).toBeFocused();

  await page.getByLabel(EMAIL_LABEL).fill(EMAIL_BY_ROLE.engineer);
  await expect(authState(page)).toHaveAttribute('data-auth-state', 'partial');
});

test('đăng nhập chỉ bằng bàn phím: gõ, Tab sang mật khẩu, Enter gửi', async ({ page }) => {
  await page.goto(loginUrl(ROUTES.account));
  await expect(page.getByLabel(EMAIL_LABEL)).toBeFocused();

  await page.keyboard.type(EMAIL_BY_ROLE.engineer);
  await page.keyboard.press('Tab');
  await expect(page.getByLabel(PASSWORD_LABEL, { exact: true })).toBeFocused();
  await page.keyboard.type(SIGN_IN_PASSWORD);
  await page.keyboard.press('Enter');

  await expect.poll(() => pathOf(page.url())).toBe(ROUTES.account);
});

test('Escape trên màn đăng nhập vô hại: không đổi đường dẫn, không đổi trạng thái', async ({ page }) => {
  await page.goto(ROUTES.login);
  await page.keyboard.press('Escape');

  await expect(page).toHaveURL(new RegExp(`${ROUTES.login}$`));
  await expect(authState(page)).toHaveAttribute('data-auth-state', 'empty');
});
