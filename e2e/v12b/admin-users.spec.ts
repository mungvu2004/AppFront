import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';
import { signInAs } from '../fixtures/session';

/**
 * Nhóm V12b — `adminUsers` (`/admin/users`), `plan.md` mục 8 · V12 · 10.
 *
 * Mục đáng đi sâu nhất nhóm: **vai quyết định nội dung**, và đây là nhánh `forbidden`
 * đầy đủ nhất repo. Đơn vị (`UserManagement.test.tsx`) đã phủ ma trận 3 × 7, nút xoá
 * khoá khi thư lệch, ô mời; e2e không lặp những thứ đó.
 *
 * **Cổng phía client, không phải "máy chủ từ chối" (F10).** Hook chặn trước bằng
 * `enabled: canManage` (`useUserManagement.ts`), nên nhánh 403 của bộ mẫu
 * (`src/api/__mocks__/client.ts`) không bao giờ được gọi tới. UM-1 chứng minh vai thấp
 * KHÔNG thấy danh sách người — không chứng minh máy chủ ép quyền.
 *
 * Phiên là biến module của bộ mẫu: vào màn bằng `signInAs(…, ROUTES.adminUsers)`,
 * không `goto` lần hai.
 */

const FORBIDDEN_TEXT =
  'vai của bạn chưa quản lý được người dùng nên danh sách tài khoản không hiện; bảng dưới đây cho biết mỗi vai làm được những việc gì';

/** Một người không phải chính quản trị đang đăng nhập (`Phạm An`). */
const TARGET = { name: 'Nguyễn Bình', email: 'engineer@example.com' } as const;
/** Người không trùng vai đăng nhập nào của bài — địa chỉ của họ chỉ hiện nếu danh sách rò. */
const BYSTANDER_EMAIL = 'le.dung@example.com';

function targetRow(page: Page) {
  return page.getByRole('row').filter({ hasText: TARGET.email });
}

const ROLE_ROWS = [
  { label: 'không đăng nhập (vai mặc định kỹ sư)', role: null, canManage: false },
  { label: 'engineer', role: 'engineer', canManage: false },
  { label: 'viewer', role: 'viewer', canManage: false },
  { label: 'admin', role: 'admin', canManage: true },
] as const;

for (const row of ROLE_ROWS) {
  test(`UM-1 ${row.label}: ${row.canManage ? 'thấy danh sách người dùng' : 'chỉ thấy ma trận quyền, không thấy ai'} (A11 forbidden, cổng phía client)`, async ({
    page,
  }) => {
    if (row.role === null) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(ROUTES.adminUsers);
    } else {
      await signInAs(page, row.role, ROUTES.adminUsers);
    }

    const invite = page.getByRole('button', { name: 'Mời người dùng' });
    if (row.canManage) {
      await expect(invite).toBeVisible();
      await expect(page.getByRole('alert').filter({ hasText: FORBIDDEN_TEXT })).toHaveCount(0);
      await expect(targetRow(page)).toBeVisible();
      await expect(page.getByRole('row').filter({ hasText: 'admin@example.com' })).toContainText(
        'bạn không thể tự đổi vai của mình',
      );
      return;
    }

    await expect(page.getByRole('alert').filter({ hasText: FORBIDDEN_TEXT })).toBeVisible();
    await expect(page.getByText('ma trận quyền theo vai trò')).toBeVisible();
    await expect(page.getByText('quản trị: được phép tải bản vẽ', { exact: true })).toBeAttached();
    await expect(page.getByText('người xem: không được phép tải bản vẽ', { exact: true })).toBeAttached();
    // Không rò người: không hàng, không địa chỉ của ai, không nút ghi.
    await expect(page.getByText(BYSTANDER_EMAIL)).toHaveCount(0);
    await expect(page.getByRole('row')).toHaveCount(0);
    await expect(invite).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'vô hiệu hoá' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'xoá' })).toHaveCount(0);
  });
}

test.describe('admin', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'admin', ROUTES.adminUsers);
    await expect(targetRow(page)).toBeVisible();
  });

  test('UM-2 · B-V12b-06 vô hiệu hoá có toast "Hoàn tác"; bấm nó thì tài khoản hoạt động lại và toast đi mất (A8)', async ({
    page,
  }) => {
    const row = targetRow(page);
    await row.getByRole('button', { name: 'vô hiệu hoá' }).click();

    await expect(row).toContainText('đã vô hiệu hoá');
    await expect(row.getByRole('button', { name: 'bật lại' })).toBeVisible();
    const toast = page.getByRole('status').filter({ hasText: `đã vô hiệu hoá tài khoản — ${TARGET.name}` });
    await expect(toast).toBeVisible();

    await toast.getByRole('button', { name: 'Hoàn tác' }).click();

    await expect(row.getByRole('button', { name: 'vô hiệu hoá' })).toBeVisible();
    await expect(row).toContainText('đang hoạt động');
    // Lời mời hoàn tác đã dùng xong không được còn treo đó hứa thêm một lần nữa.
    await expect(toast).toHaveCount(0);
  });

  test('UM-3 · B-V12b-01 bấm "xoá" trên hàng hỏi trước bằng hộp thoại; Esc đóng nó, người vẫn còn (A9, A12)', async ({
    page,
  }) => {
    const row = targetRow(page);
    const opener = row.getByRole('button', { name: 'xoá' });
    await opener.click();

    const dialog = page.getByRole('dialog', { name: `xoá hẳn ${TARGET.name}?` });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('không hoàn tác được');
    await expect(dialog.getByRole('button', { name: 'xác nhận xoá vĩnh viễn' })).toBeDisabled();
    await expect(dialog.locator(':focus')).toHaveCount(1);

    await page.keyboard.press('Escape');

    await expect(dialog).toBeHidden();
    await expect(row).toBeVisible();
    await expect(opener).toBeFocused();
  });

  test('UM-3b · B-V12b-07 hộp thoại mở trên tấm chi tiết: Esc thứ nhất đóng hộp thoại, Esc thứ hai đóng tấm (A12)', async ({
    page,
  }) => {
    await page.getByRole('button', { name: TARGET.name, exact: true }).click();
    const detail = page.getByRole('complementary', { name: 'chi tiết người dùng' });
    await expect(detail).toBeVisible();

    await targetRow(page).getByRole('button', { name: 'xoá' }).click();
    const dialog = page.getByRole('dialog', { name: `xoá hẳn ${TARGET.name}?` });
    await expect(dialog.locator(':focus')).toHaveCount(1);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(detail).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(detail).toBeHidden();
  });

  test('UM-4 · B-V12b-02 Esc đóng khối mời người dùng (A12)', async ({ page }) => {
    await page.getByRole('button', { name: 'Mời người dùng' }).click();
    const emails = page.getByRole('textbox', { name: /email người được mời/u });
    await expect(emails).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(emails).toBeHidden();
  });
});
