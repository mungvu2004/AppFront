import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';

/**
 * Nhóm V3 — hộp thoại tạo dự án (`CreateProjectModal`), MỘT bề mặt mở từ HAI
 * màn chủ: bảng điều khiển (nút "Dự án mới") và onboarding (nút "Tạo dự án").
 * Kế hoạch: `docs/notes/e2e/plan.md` mục V3.2 (V3-CP-1…4) và phát hiện F3, F5.
 *
 * Mỗi màn chủ có `Toast.Provider` riêng (F5), nên V3-CP-1 chạy ở cả hai.
 *
 * KHÔNG kiểm, và vì sao:
 * - Dự án mới hiện trong danh sách: danh sách là bộ mẫu viết cứng (mục 0.1).
 * - Kết quả bấm "Hoàn tác" của toast tạo, logic tầng / va chạm cao độ, `loading`,
 *   `collapsed`: tầng đơn vị (`CreateProjectModal.test.tsx`).
 * - `error`: bộ mẫu không đi qua mạng, `page.route` không chặn được (mục 0.3).
 * - Esc với form SẠCH: `smoke-grid.spec.ts` đã có.
 * - Nhánh `forbidden` (người xem): không tới được từ giao diện. Dashboard giấu
 *   nút "Dự án mới" và phím N với người xem; onboarding của người xem không có
 *   thẻ "Tạo dự án" (đo 2026-10-03: chỉ "Duyệt kết quả", "Xem dự án mẫu",
 *   "Xem hướng dẫn 2 phút", "Bỏ qua"). Nhánh ấy chỉ đơn vị chạm được.
 */

/** Lần tải đầu một route bắt Vite dịch nguội; tiền lệ `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

/**
 * Tên truy cập của nút dashboard mang cả phím tắt ("Dự án mới" + "N", F8) nên
 * khớp đầu chuỗi; ở onboarding "Tạo dự án" còn là chữ của một `h2`, nên lọc
 * bằng vai `button` và khớp trọn.
 */
const HOSTS = [
  { host: 'dashboard', path: ROUTES.dashboard, opener: /^Dự án mới/u },
  { host: 'onboarding', path: ROUTES.onboarding, opener: /^Tạo dự án$/u },
] as const;

const DASHBOARD = HOSTS[0];

async function openCreateDialog(page: Page, { path, opener }: (typeof HOSTS)[number]) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(path);
  await page.getByRole('button', { name: opener }).click({ timeout: FIRST_PAINT_TIMEOUT_MS });
  const dialog = page.getByRole('dialog', { name: 'tạo dự án mới' });
  await expect(dialog).toBeVisible();
  return dialog;
}

for (const host of HOSTS) {
  test(`V3-CP-1 (${host.host}): tạo dự án ba bước, hộp thoại đóng, toast có "Hoàn tác", URL giữ nguyên`, async ({
    page,
  }) => {
    const name = `Dự án thử ${host.host}`;
    const dialog = await openCreateDialog(page, host);

    await dialog.getByLabel('tên dự án').fill(name);
    await dialog.getByRole('button', { name: 'tiếp tục' }).click();

    await dialog.getByLabel('chiều cao áp cho mọi tầng').fill('3,2');
    await dialog.getByRole('button', { name: 'áp cho mọi tầng' }).click();
    await dialog.getByRole('button', { name: 'tiếp tục' }).click();

    // A15: cao độ ở bước xem lại dùng dấu phẩy thập phân.
    await expect(dialog.getByText(/^\d,\d m$/u).first()).toBeVisible();
    await expect(dialog.getByText('3,2 m', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'tạo dự án' }).click();

    await expect(dialog).toHaveCount(0);
    const toast = page.getByRole('status').filter({ hasText: `Đã tạo dự án "${name}".` });
    await expect(toast.getByRole('button', { name: 'Hoàn tác' })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(host.path);
  });
}

test('V3-CP-2: form đã gõ — Escape lần 1 hỏi "đóng và bỏ các thay đổi chưa lưu?", lần 2 mới đóng', async ({
  page,
}) => {
  const dialog = await openCreateDialog(page, DASHBOARD);
  await dialog.getByLabel('tên dự án').fill('Dự án gõ dở');

  await page.keyboard.press('Escape');
  await expect(
    dialog.getByText('đóng và bỏ các thay đổi chưa lưu?', { exact: true }),
  ).toBeVisible();
  await expect(dialog).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Dự án của tôi' })).toBeVisible();
});

for (const host of HOSTS) {
  test(`V3-CP-3 (${host.host}): hiện trạng — tiêu điểm đầu ở nút "Đóng hộp thoại", chưa ở ô "tên dự án" (F3)`, async ({
    page,
  }) => {
    const dialog = await openCreateDialog(page, host);
    await expect(dialog.getByRole('button', { name: 'Đóng hộp thoại' })).toBeFocused();
  });
}

test('V3-CP-4: bước 1 khoá "tiếp tục" khi tên trống; bước 2 khoá tới khi mọi tầng có chiều cao', async ({
  page,
}) => {
  const dialog = await openCreateDialog(page, DASHBOARD);
  const next = dialog.getByRole('button', { name: 'tiếp tục' });

  await expect(next).toBeDisabled();
  await dialog.getByLabel('tên dự án').fill('Dự án khoá bước');
  await expect(next).toBeEnabled();
  await next.click();

  // Bước 2 mở với bốn tầng chưa có chiều cao (đo 2026-10-03).
  await expect(dialog.getByRole('status').filter({ hasText: /^bước 2 \/ 3$/u })).toHaveCount(1);
  await expect(next).toBeDisabled();
  await dialog.getByLabel('chiều cao thông thuỷ tầng Tầng trệt').fill('3,2');
  await expect(next).toBeDisabled();

  await dialog.getByLabel('chiều cao áp cho mọi tầng').fill('3,2');
  await dialog.getByRole('button', { name: 'áp cho mọi tầng' }).click();
  await expect(next).toBeEnabled();
});

/*
 * B-V3-02 (đã sửa): hộp thoại từng giữ nguyên trạng thái cũ khi mở lại — cả hai
 * màn chủ giữ `CreateProjectModalContainer` luôn mount (chỉ đổi `isOpen`), nên
 * tạo xong bấm "Dự án mới" lần nữa thì hộp thoại mở thẳng ở "bước 3 / 3" với
 * dự án vừa tạo (một cú "tạo dự án" nữa là tạo trùng), và "đóng, bỏ thay đổi"
 * không bỏ gì. Nay `CreateProjectModal` đổi `key` mỗi lần mở. Ba bài dưới chặn
 * hồi quy — đã kiểm đỏ trên mã chưa sửa.
 */
for (const host of HOSTS) {
  test(
    `(${host.host}) tạo xong rồi mở lại: hộp thoại bắt đầu lại ở bước 1, ô "tên dự án" trống`,
    async ({ page }) => {
      const dialog = await openCreateDialog(page, host);
      await dialog.getByLabel('tên dự án').fill('Dự án tạo trước');
      await dialog.getByRole('button', { name: 'tiếp tục' }).click();
      await dialog.getByLabel('chiều cao áp cho mọi tầng').fill('3,2');
      await dialog.getByRole('button', { name: 'áp cho mọi tầng' }).click();
      await dialog.getByRole('button', { name: 'tiếp tục' }).click();
      await dialog.getByRole('button', { name: 'tạo dự án' }).click();
      await expect(dialog).toHaveCount(0);

      await page.getByRole('button', { name: host.opener }).click();

      await expect(dialog.getByRole('status').filter({ hasText: /^bước 1 \/ 3$/u })).toHaveCount(1);
      await expect(dialog.getByLabel('tên dự án')).toHaveValue('');
    },
  );
}

test(
  'bỏ thay đổi bằng Escape hai lần rồi mở lại: ô "tên dự án" trống, không còn lời hỏi bỏ thay đổi',
  async ({ page }) => {
    const dialog = await openCreateDialog(page, DASHBOARD);
    await dialog.getByLabel('tên dự án').fill('Dự án gõ dở');
    await page.keyboard.press('Escape');
    await expect(
      dialog.getByText('đóng và bỏ các thay đổi chưa lưu?', { exact: true }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    await page.getByRole('button', { name: DASHBOARD.opener }).click();

    await expect(dialog.getByLabel('tên dự án')).toHaveValue('');
    await expect(
      dialog.getByText('đóng và bỏ các thay đổi chưa lưu?', { exact: true }),
    ).toHaveCount(0);
  },
);
