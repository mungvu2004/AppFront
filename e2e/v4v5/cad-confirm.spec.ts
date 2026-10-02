import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES, pathOf } from '../fixtures/routes';
import { signInAs } from '../fixtures/session';

import { FIRST_PAINT_TIMEOUT_MS, PROJECT_ID } from './files';

/**
 * Nhóm V5 — `projectCadConfirm` (`docs/notes/e2e/plan.md` V5 mục 3).
 *
 * Hộp thoại TỰ MỞ khi vào màn. Bốn ca `[NGHIEM-5]` của tầng đơn vị chạy trên
 * jsdom; ở đây xác nhận bằng trình duyệt thật: ba lối đóng (Esc · "Huỷ" ·
 * "Đóng hộp thoại") cùng đóng mà KHÔNG chốt nhánh — URL không đổi, 0 yêu cầu ghi,
 * hai nút chọn nhánh vẫn còn trên màn nền.
 *
 * "Phát hiện tệp CAD" là chữ của cả h1 màn nền lẫn h2 hộp thoại ⇒ bám hộp thoại
 * bằng `role="dialog"` chứ không bằng heading.
 */

const CAD = ROUTES.project.cadConfirm(PROJECT_ID, 'L1');

function dialog(page: Page) {
  return page.getByRole('dialog', { name: 'Phát hiện tệp CAD' });
}

const CLOSERS: ReadonlyArray<{ readonly how: string; readonly close: (page: Page) => Promise<void> }> = [
  { how: 'Esc', close: (page) => page.keyboard.press('Escape') },
  {
    how: '"Huỷ"',
    close: (page) => dialog(page).getByRole('button', { name: 'Huỷ', exact: true }).click(),
  },
  {
    how: '"Đóng hộp thoại"',
    close: (page) => dialog(page).getByRole('button', { name: 'Đóng hộp thoại' }).click(),
  },
];

for (const { how, close } of CLOSERS) {
  test(`${how} đóng hộp thoại tự mở mà không chốt nhánh nào, màn nền còn dùng được (A12)`, async ({
    page,
  }) => {
    const writes: string[] = [];
    page.on('request', (request) => {
      if (!['GET', 'HEAD'].includes(request.method())) writes.push(`${request.method()} ${request.url()}`);
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(CAD);
    await expect(dialog(page)).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
    await expect(dialog(page).getByRole('button', { name: 'Đóng hộp thoại' })).toBeFocused();

    await close(page);

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Dùng đường từ CAD' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Vẫn dùng AI' })).toBeVisible();
    expect(pathOf(page.url())).toBe(CAD);
    expect(writes).toEqual([]);
  });
}

test('chọn "Dùng đường từ CAD" mở bước ánh xạ lớp; bộ mẫu không có lớp nào nên "Nhập hình học" khoá', async ({
  page,
}) => {
  await page.goto(CAD);

  await dialog(page)
    .getByRole('button', { name: 'Dùng đường từ CAD' })
    .click({ timeout: FIRST_PAINT_TIMEOUT_MS });

  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Ánh xạ lớp từ tệp CAD' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nhập hình học' })).toBeDisabled();
  expect(pathOf(page.url())).toBe(CAD);
});

test('vai Người xem: nhánh CAD khoá, nhánh AI vẫn mở và đưa sang màn xử lý', async ({ page }) => {
  await signInAs(page, 'viewer', CAD);

  await expect(page.getByRole('heading', { name: 'Không có quyền xử lý CAD' })).toBeVisible();
  await expect(dialog(page).getByRole('button', { name: 'Dùng đường từ CAD' })).toBeDisabled();

  await dialog(page).getByRole('button', { name: 'Vẫn dùng AI' }).click();

  await expect.poll(() => pathOf(page.url())).toBe(ROUTES.project.pipeline(PROJECT_ID));
});
