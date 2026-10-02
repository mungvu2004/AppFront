/**
 * Đăng nhập theo vai (`admin` / `engineer` / `viewer`) qua biểu mẫu thật.
 *
 * **Chỉ gọi khi cần vai `viewer`.** 35 màn mở được bằng `page.goto` thẳng, không
 * cần đăng nhập: `MOCK_FALLBACK_ROLES` (`src/api/__mocks__/client.ts:271`) cấp vai
 * `engineer` cho mọi lượt tải khi chưa ai đăng nhập (`plan.md` mục 1.3). Gọi
 * fixture này cho `engineer` ở màn khác chỉ tốn thêm một vòng biểu mẫu mà không
 * chứng minh thêm gì; nó có mặt cho đủ ba vai và cho bài của chính màn đăng nhập.
 *
 * **Đừng `goto` lần hai sau khi gọi.** Phiên là biến mô-đun của bộ mẫu
 * (`lastSignedInEmail`), nên một lượt tải trang mất nó. Đích đi qua `?next=` và
 * trình duyệt tự sang đó bằng điều hướng trong ứng dụng. Muốn tới màn khác thì
 * truyền `destination`, đừng điều hướng tay.
 *
 * Hạn chờ: {@link SIGN_IN_LANDING_TIMEOUT_MS}, không phải hạn mặc định 5 s của
 * `expect` — `playwright.config.ts` không đặt `expect.timeout`, nên "mặc định"
 * chính là 5 s, đúng hạn mỏng đã lộ ở `viewer3d.spec.ts:203` khi nhiều bài chạy
 * song song.
 *
 * Nguyên liệu chép từ `e2e/viewer3d.spec.ts:163-205`.
 */
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES, loginUrl, pathOf } from './routes';

export type Role = 'admin' | 'engineer' | 'viewer';

/** Bộ mẫu suy vai theo địa chỉ (`roleOfEmail`, `src/api/__mocks__/client.ts`). */
export const EMAIL_BY_ROLE: Readonly<Record<Role, string>> = {
  admin: 'admin@example.com',
  engineer: 'engineer@example.com',
  viewer: 'viewer@example.com',
};

export const SIGN_IN_PASSWORD = 'matkhau-du-dai';

/** Nhãn ba điều khiển của biểu mẫu đăng nhập — cùng chữ `src/i18n/vi.json` giữ. */
export const EMAIL_LABEL = 'Thư điện tử';
export const PASSWORD_LABEL = 'Mật khẩu';
export const SIGN_IN_LABEL = 'Đăng nhập';

/** Điền và gửi biểu mẫu — tách ra để bài của màn đăng nhập dùng lại. */
export async function submitSignInForm(page: Page, email: string): Promise<void> {
  await page.getByLabel(EMAIL_LABEL).fill(email);
  // `exact`: không thì khớp cả nút aria-label="Hiện mật khẩu".
  await page.getByLabel(PASSWORD_LABEL, { exact: true }).fill(SIGN_IN_PASSWORD);
  // Không `getByText`: chữ "Đăng nhập" có ở bốn chỗ (h1, tab, tabpanel, nút gửi).
  await page.getByRole('button', { name: SIGN_IN_LABEL, exact: true }).click();
}

/**
 * Hạn chờ trình duyệt hạ cánh ở đích sau khi gửi biểu mẫu. Chờ một trạng thái
 * dương (đường dẫn = đích), hạn chỉ là trần: lượt đầu của một route bắt Vite dịch
 * nguội, và nhiều worker cùng tải làm việc ấy chậm hơn 5 s. Cùng số với
 * `FIRST_PAINT_TIMEOUT_MS` của `smoke-grid.spec.ts`.
 */
export const SIGN_IN_LANDING_TIMEOUT_MS = 15_000;

/** Đăng nhập với `role` rồi hạ cánh ở `destination` (mặc định: danh sách dự án). */
export async function signInAs(
  page: Page,
  role: Role,
  destination: string = ROUTES.dashboard,
): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(loginUrl(destination));
  await submitSignInForm(page, EMAIL_BY_ROLE[role]);
  await expect
    .poll(() => pathOf(page.url()), { timeout: SIGN_IN_LANDING_TIMEOUT_MS })
    .toBe(destination);
}
