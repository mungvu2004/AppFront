import { expect, test } from '@playwright/test';

import { ROUTES, pathOf } from '../fixtures/routes';
import { signInAs } from '../fixtures/session';

import { FIRST_PAINT_TIMEOUT_MS, PROJECT_ID } from './files';

/**
 * Nhóm V5 — `projectCadConfirm` (`docs/notes/e2e/plan.md` V5 mục 3).
 *
 * Bộ mẫu không có tầng nào mang tệp `.dwg`, nên ở đây mọi tầng là "chỉ có ảnh". Từ
 * đợt làm lại cụm 3 (Z/S-13), tầng chỉ có ảnh KHÔNG tự bật hộp thoại nữa: màn là một
 * trang "Nhập tầng từ tệp CAD" với chip "Chưa có tệp CAD" và hai lối đi tiếp. Ba lối
 * đóng hộp thoại tự mở (Esc · "Huỷ" · "Đóng hộp thoại") chỉ còn dựng được khi tầng CÓ
 * tệp CAD — chúng được giữ ở tầng đơn vị (`CadBranchConfirm.test.tsx`, các ca Escape).
 */

const CAD = ROUTES.project.cadConfirm(PROJECT_ID, 'L1');

test('tầng chỉ có ảnh: không tự mở hộp thoại, không có nút "Dùng đường từ CAD", nói lý do và không ghi gì (G3-30, A12)', async ({
  page,
}) => {
  const writes: string[] = [];
  page.on('request', (request) => {
    if (!['GET', 'HEAD'].includes(request.method())) writes.push(`${request.method()} ${request.url()}`);
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(CAD);

  await expect(page.getByRole('heading', { level: 1, name: 'Nhập tầng từ tệp CAD' })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await expect(page.getByText('Chưa có tệp CAD', { exact: true })).toBeVisible();
  await expect(page.getByText('Tầng này chưa có tệp CAD nên chưa dùng được đường từ CAD.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Phát hiện tệp CAD' })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Dùng đường từ CAD' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tiếp tục duyệt tường' })).toBeVisible();
  expect(pathOf(page.url())).toBe(CAD);
  expect(writes).toEqual([]);
});

test('vai Người xem: màn nói không có quyền, nhánh AI vẫn mở và đưa sang màn xử lý', async ({ page }) => {
  await signInAs(page, 'viewer', CAD);

  await expect(page.getByText('Không có quyền xử lý CAD', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dùng đường từ CAD' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Tiếp tục duyệt tường' }).click();

  await expect.poll(() => pathOf(page.url())).toBe(ROUTES.project.pipeline(PROJECT_ID));
});
