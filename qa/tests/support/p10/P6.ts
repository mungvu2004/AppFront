/**
 * P6 helpers — /design-system/states (SCR-40, S-47 State Gallery). Text copied from
 * src/screens/system/StateGallery/{StateGallery,StateGalleryToolbar,StateGalleryTree,StateGalleryFrames}.tsx.
 * Dev-server pages only (`devPage` from `./devServer`).
 */
import { expect, type Locator, type Page } from '@playwright/test';

export const STATES_PATH = '/design-system/states';
export const ACCOUNT_SCREEN = 'Cài đặt tài khoản'; // stateGalleryManifest.ts:73
export const OTHER_SCREEN = 'Thư viện model'; // stateGalleryManifest.ts:~88
/** `SEVEN_STATE_LABELS` (src/lib/testing/sevenStateScenarios.ts:40) → story export names of the manifest entry. */
export const SEVEN_FRAMES = [
  ['rỗng', 'Empty'],
  ['đang tải', 'Loading'],
  ['một phần', 'Partial'],
  ['lỗi', 'ErrorState'],
  ['thành công', 'Success'],
  ['không có quyền', 'Forbidden'],
  ['thu gọn', 'Collapsed'],
] as const;
export const GROUP_HEADINGS = [
  'nhóm A · Xác thực và tài khoản', // stateGalleryManifest.ts:28-35
  'nhóm B · Quản trị và thanh toán',
  'nhóm C · Bảng điều khiển và dự án',
  'nhóm D · Tải lên và giới thiệu',
  'nhóm E · Xử lý bản vẽ CAD',
  'nhóm F · Soát chất lượng',
  'nhóm G · Quy tắc và xuất',
  'nhóm H · Xem mô hình và hệ thống',
] as const;

export const tree = (page: Page): Locator => page.getByRole('navigation', { name: 'Cây màn theo nhóm' });
export const frames = (page: Page): Locator => page.getByRole('region', { name: 'Khung xem trước bảy trạng thái' });
export const toolbar = (page: Page): Locator => page.getByRole('region', { name: 'Công cụ duyệt' });
export const screenButton = (page: Page, label: string): Locator =>
  tree(page).getByRole('button', { name: new RegExp(`^${label}`, 'u') });
export const toggle = (page: Page, label: string): Locator => page.getByRole('switch', { name: new RegExp(`^${label}`, 'u') });
export const runCheck = (page: Page): Locator => page.getByRole('button', { name: 'Chạy kiểm nhanh' });

/** Open the page and wait for the named heading AND the first tree row (absence asserts only after these). */
export async function openStates(page: Page): Promise<void> {
  await page.goto(STATES_PATH);
  await expect(page.getByRole('heading', { level: 1, name: 'Duyệt bảy trạng thái' })).toBeVisible();
  await expect(tree(page).getByRole('button').first()).toBeVisible();
}

export async function selectScreen(page: Page, label: string): Promise<void> {
  await screenButton(page, label).click();
  await expect(screenButton(page, label)).toHaveAttribute('aria-current', 'true');
  await expect(frames(page).getByRole('heading', { level: 2, name: label })).toBeVisible();
}

/** Run the quick check and wait until the result table is shown and the button is idle again. */
export async function runQuickCheckAndWait(page: Page): Promise<void> {
  await runCheck(page).click();
  await expect(page.getByRole('table', { name: 'Kết quả bốn phép kiểm theo từng màn' })).toBeVisible();
  await expect(runCheck(page)).toBeEnabled({ timeout: 10_000 });
}

/**
 * Freeze the quick-check timer (useStateGallery.ts:390, `MOTION_DURATIONS_MS.standard` = 260 ms, tokens.ts:65) so the
 * `loading` state stays on screen: setTimeout calls with exactly that delay are swallowed. Used instead of
 * `page.clock` because the clock would also have to be paused across `verifyUi`'s repeated reloads.
 */
export async function freezeQuickCheckTimer(page: Page): Promise<void> {
  await page.evaluate(() => {
    const original = window.setTimeout.bind(window);
    window.setTimeout = ((fn: TimerHandler, ms?: number, ...args: unknown[]) =>
      ms === 260 ? 0 : original(fn, ms, ...args)) as typeof window.setTimeout;
  });
}
