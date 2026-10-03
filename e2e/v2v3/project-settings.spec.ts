import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { ROUTES, pathOf } from '../fixtures/routes';
import { signInAs } from '../fixtures/session';

/**
 * Màn cài đặt dự án (`ROUTE_PATTERNS.projectSettings`) — nhóm V3, kế hoạch mục 3
 * (`docs/notes/e2e/plan.md`, ca V3-SET-1 … V3-SET-5).
 *
 * Đây là chỗ duy nhất của nhóm mà A7 (tự lưu), A8 (hoàn tác) và A9 (hỏi trước việc
 * không hoàn tác được) đều chạy trên đồng hồ thật + trình duyệt thật. Bài khẳng định
 * THỨ TỰ trạng thái, không khẳng định con số 800 ms (hằng của `useAutosave`, đã có
 * bài đơn vị với đồng hồ giả).
 *
 * ## KHÔNG kiểm ở đây, và vì sao
 * - 409, thử lại theo lịch, logic khoá nút xoá: `ProjectSettings.test.tsx` đã phủ.
 * - Trạng thái `error` (lỗi đọc) và `collapsed` (< 1024 px): chưa có cách dựng `error`
 *   trên bộ mẫu; `collapsed` có bài đơn vị.
 * - KẾT QUẢ của "Xoá mọi tầng": cần dữ liệu tầng; chỉ kiểm hộp thoại + Escape.
 * - `Ctrl+Z` toàn cục: đo 2026-10-03, tiêu điểm ở `body` sau một lượt lưu, `Ctrl+Z` KHÔNG
 *   trả ô "địa chỉ" về — phím ấy hoàn tác kho `zundo` (`router.tsx:189`), còn cài đặt dự án
 *   đi bằng vé hoàn tác của cổng riêng. Đường hoàn tác ở màn này là nút trên toast (V3-SET-2).
 *
 * ## Mốc neo
 * - Vùng `role="status"` của `SaveIndicator` vẽ HAI lần (header + footer) và mỗi toast
 *   cũng là `role="status"` — nên đọc qua {@link saveStatus}: lọc theo chữ, lấy bản đầu.
 */

/** Lần tải đầu một route bắt Vite dịch nguội; tiền lệ `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

/**
 * Hạn của lượt hâm nóng (`beforeAll` bên dưới), không phải của bài nào.
 *
 * Đo 2026-10-03: Vite mới dựng tải lại trang một lần giữa lượt tải đầu (tối ưu phụ thuộc),
 * mốc hiện sau ~11 s lúc máy rảnh; lúc máy đang chạy e2e của worktree khác, hai bài ĐẦU
 * của lượt (mỗi worker một bài, cùng dịch nguội) hai lần quá cả 25 s. Hâm nóng một lần
 * mỗi worker trả cái giá ấy ngoài hạn 30 s của bài.
 */
const COLD_START_TIMEOUT_MS = 60_000;

const PROJECT_ID = 'project-1';
const SETTINGS = ROUTES.project.settings(PROJECT_ID);

test.beforeAll(async ({ browser }) => {
  test.setTimeout(COLD_START_TIMEOUT_MS);
  const page = await browser.newPage();
  await page.goto(SETTINGS);
  await expect(page.getByRole('heading', { level: 1, name: 'cài đặt dự án' })).toBeVisible({ timeout: COLD_START_TIMEOUT_MS });
  await page.close();
});

const PENDING = 'Có thay đổi chờ đồng bộ';
const SAVED = /Đã lưu lúc \d{2}:\d{2}/;
const SAVED_TOAST = 'Đã lưu cài đặt dự án.';

/** Địa chỉ của dự án mẫu (`domain/spatial/__fixtures__/sampleBuilding.ts:226`), đo trên trình duyệt. */
const KNOWN_ADDRESS = '12 Nguyễn Huệ, Quận 1';

async function openSettings(page: Page): Promise<void> {
  await page.goto(SETTINGS);
  await expect(page.getByRole('heading', { level: 1, name: 'cài đặt dự án' })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
}

/** Một trong hai bản `SaveIndicator` đang đọc chữ `text`. */
function saveStatus(page: Page, text: string | RegExp): Locator {
  return page.getByRole('status').filter({ hasText: text }).first();
}

function toasts(page: Page): Locator {
  return page.getByRole('region', { name: 'Thông báo' });
}

const CONFIRM_NAME_LABEL = 'gõ lại tên dự án để xác nhận';

/** Đăng nhập quản trị viên, mở thẻ "vùng nguy hiểm"; trả tên dự án đã lưu (đo, không chép). */
async function openDangerZoneAsAdmin(page: Page): Promise<string> {
  await signInAs(page, 'admin', SETTINGS);
  // `exact`: nhãn ô xác nhận trong hộp thoại cũng chứa chữ "tên dự án".
  const projectName = await page.getByLabel('tên dự án', { exact: true }).inputValue();
  expect(projectName.length).toBeGreaterThan(0);
  await page.getByRole('tab', { name: 'vùng nguy hiểm' }).click();
  return projectName;
}

async function openDeleteProjectDialog(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Xoá dự án', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Xoá dự án này?' });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Gõ thêm vào cuối ô "địa chỉ"; trả giá trị TRƯỚC khi gõ. */
async function appendToAddress(page: Page, suffix: string): Promise<string> {
  const address = page.getByLabel('địa chỉ');
  const before = await address.inputValue();
  await address.click();
  await address.press('End');
  await address.pressSequentially(suffix);
  return before;
}

test.describe('cài đặt dự án — tự lưu và hoàn tác (A7, A8)', () => {
  test('gõ vào "địa chỉ" thì trạng thái đi chờ đồng bộ → đã lưu lúc HH:MM, kèm toast có Hoàn tác, và màn không có nút lưu nào (V3-SET-1)', async ({
    page,
  }) => {
    await openSettings(page);
    await expect(page.getByRole('button', { name: /lưu/i })).toHaveCount(0);

    await appendToAddress(page, ' tầng 3');

    await expect(saveStatus(page, PENDING)).toBeVisible();
    await expect(saveStatus(page, SAVED)).toBeVisible();
    const toast = toasts(page).getByRole('status').filter({ hasText: SAVED_TOAST });
    await expect(toast).toBeVisible();
    await expect(toast.getByRole('button', { name: 'Hoàn tác' })).toBeVisible();
  });

  test('bấm "Hoàn tác" trên toast đã lưu thì ô "địa chỉ" trở về giá trị trước khi gõ (V3-SET-2)', async ({
    page,
  }) => {
    await openSettings(page);
    const before = await appendToAddress(page, ' tầng 3');
    const address = page.getByLabel('địa chỉ');
    await expect(address).toHaveValue(`${before} tầng 3`);

    const toast = toasts(page).getByRole('status').filter({ hasText: SAVED_TOAST });
    await toast.getByRole('button', { name: 'Hoàn tác' }).click();

    await expect(address).toHaveValue(before);
  });
});

test.describe('cài đặt dự án — bàn phím (A12)', () => {
  test('mũi tên phải/trái và Home/End đổi nhóm cài đặt trên dải thẻ (V3-SET-3)', async ({ page }) => {
    await openSettings(page);
    const tab = (name: string): Locator => page.getByRole('tab', { name, exact: true });

    await tab('chung').focus();
    const steps: ReadonlyArray<readonly [string, string]> = [
      ['ArrowRight', 'đơn vị đo'],
      ['ArrowLeft', 'chung'],
      ['End', 'thành viên'],
      ['Home', 'chung'],
    ];
    for (const [key, expected] of steps) {
      await page.keyboard.press(key);
      await expect(tab(expected)).toHaveAttribute('aria-selected', 'true');
      await expect(tab(expected)).toBeFocused();
    }
  });
});

test.describe('cài đặt dự án — vai (V3-SET-4)', () => {
  test('kỹ sư (vai mặc định của bộ mẫu) thấy đúng ba thẻ, không có "vùng nguy hiểm"', async ({ page }) => {
    await openSettings(page);
    await expect(page.getByRole('tab')).toHaveText(['chung', 'đơn vị đo', 'thành viên']);
  });

  test('quản trị viên đăng nhập thấy thêm thẻ thứ tư "vùng nguy hiểm"', async ({ page }) => {
    await signInAs(page, 'admin', SETTINGS);
    await expect(page.getByRole('tab')).toHaveText(['chung', 'đơn vị đo', 'thành viên', 'vùng nguy hiểm'], {
      timeout: FIRST_PAINT_TIMEOUT_MS,
    });
  });

  test('người xem đăng nhập thì mọi ô nhập đều không sửa được và màn nói ra vì sao', async ({ page }) => {
    await signInAs(page, 'viewer', SETTINGS);
    await expect(
      page.getByText('Vai hiện tại chỉ xem được cài đặt, không sửa và không xoá.', { exact: true }),
    ).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
    await expect(page.getByRole('tab')).toHaveCount(3);

    // Ở vai chỉ đọc, `Input` vẽ giá trị thành chữ thay vì ô nhập (`Input.tsx:54`), nên
    // "0 ô nhập bật" đo được là "0 ô nhập" — kèm mốc dương: giá trị vẫn hiện ra.
    const general = page.getByRole('tabpanel', { name: 'chung' });
    await expect(general.getByText(KNOWN_ADDRESS, { exact: true })).toBeVisible();
    await expect(page.getByRole('textbox')).toHaveCount(0);
  });
});

test.describe('cài đặt dự án — việc nguy hiểm (A9, A12)', () => {
  const DANGERS = [
    { trigger: 'Xoá mọi tầng', title: 'Xoá mọi tầng của dự án?' },
    { trigger: 'Xoá dự án', title: 'Xoá dự án này?' },
  ] as const;

  for (const { trigger, title } of DANGERS) {
    test(`"${trigger}" mở hộp thoại "${title}", Escape đóng đúng nó và URL giữ nguyên (V3-SET-5)`, async ({
      page,
    }) => {
      await signInAs(page, 'admin', SETTINGS);
      await page.getByRole('tab', { name: 'vùng nguy hiểm' }).click();
      await page.getByRole('button', { name: trigger, exact: true }).click();

      const dialog = page.getByRole('dialog', { name: title });
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape');

      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(pathOf(page.url())).toBe(SETTINGS);
      await expect(page.getByRole('tab', { name: 'vùng nguy hiểm' })).toHaveAttribute('aria-selected', 'true');
    });
  }

  test('xoá dự án: nút xác nhận khoá tới khi gõ đúng tên, "Để nguyên" không đổi gì, gõ đúng rồi xác nhận thì về danh sách dự án (V3-SET-5)', async ({
    page,
  }) => {
    const projectName = await openDangerZoneAsAdmin(page);

    let dialog = await openDeleteProjectDialog(page);
    await dialog.getByRole('button', { name: 'Để nguyên' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(pathOf(page.url())).toBe(SETTINGS);

    dialog = await openDeleteProjectDialog(page);
    const confirm = dialog.getByRole('button', { name: 'Xoá dự án', exact: true });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(CONFIRM_NAME_LABEL).fill(`${projectName}x`);
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(CONFIRM_NAME_LABEL).fill(projectName);
    await expect(confirm).toBeEnabled();

    await confirm.click();
    await expect.poll(() => pathOf(page.url())).toBe(ROUTES.dashboard);
  });

  /*
   * B-V3-05 (F4, đã sửa): toast "Đã xoá dự án." từng đi vào `Toast.Provider` RIÊNG của
   * route cài đặt, và `navigate('/')` gỡ chính provider ấy — người dùng về `/` mà không
   * được báo gì (đo: 0 chỗ có chữ suốt 1,75 s). Nay câu báo lên `appNotificationBus`,
   * `NotificationHost` cạnh `RouterProvider` vẽ nó. Đã kiểm đỏ trên mã chưa sửa.
   */
  test('xoá dự án xong thì ở danh sách dự án có toast "Đã xoá dự án." (B-V3-05)', async ({ page }) => {
    const projectName = await openDangerZoneAsAdmin(page);
    const dialog = await openDeleteProjectDialog(page);
    await dialog.getByLabel(CONFIRM_NAME_LABEL).fill(projectName);
    await dialog.getByRole('button', { name: 'Xoá dự án', exact: true }).click();
    await expect.poll(() => pathOf(page.url())).toBe(ROUTES.dashboard);

    await expect(toasts(page).getByText('Đã xoá dự án.', { exact: true })).toBeVisible();
  });
});

test.describe('cài đặt dự án — định dạng số (A15)', () => {
  test('thẻ "đơn vị đo" viết số thập phân bằng dấu phẩy, và nhận "1,25" gõ bằng dấu phẩy', async ({ page }) => {
    await openSettings(page);
    await page.getByRole('tab', { name: 'đơn vị đo', exact: true }).click();
    const units = page.getByRole('tabpanel', { name: 'đơn vị đo' });

    await expect(units.getByLabel('ngưỡng tin cậy')).toHaveValue('0,75');
    await expect(units.getByText('75%', { exact: true })).toBeVisible();

    const scale = units.getByLabel('tỉ lệ bản vẽ');
    await scale.fill('1,25');
    await scale.press('Tab');
    // Ô số chạy số đếm lên tới giá trị mới (`useNumericField` → `useCountUp`), nên chờ đích.
    await expect(scale).toHaveValue('1,25');
    await expect(units.getByText('1,25 milimét trên mỗi điểm ảnh', { exact: true })).toBeVisible();
    await expect(units.getByText('100 điểm ảnh ứng với 125 mm ngoài thực tế.', { exact: true })).toBeVisible();
  });
});
