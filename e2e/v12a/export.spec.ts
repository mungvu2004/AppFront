import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES, pathOf } from '../fixtures/routes';
import { seedSpatial } from '../fixtures/seedSpatial';
import { signInAs } from '../fixtures/session';
import { dismissTourIfShown } from '../fixtures/tour';

/**
 * V12a — `projectExport` (`docs/notes/e2e/plan.md` V12 mục 4).
 *
 * Vào thẳng (không bơm) đã có ở `smoke-grid.spec.ts` (dòng `projectExport`, mốc heading
 * "xuất bản vẽ" — cổng nạp kho B-V12-01), không lặp. `ShareDialog` (EX-4) thuộc nhóm
 * V3/W02. Ca cần bộ mẫu A14 BƠM sau khi cổng nạp xong (`seedSpatial({ projectId })`), và
 * tên bài nói ra điều đó; `seedSpatial` bơm cả `floors` — đủ cho màn này.
 *
 * Tour (`EditorTour`) gắn neo vào nút `xuất`, nên nó có thể hiện ngay khi bơm làm nút ấy
 * xuất hiện (W02 đang đổi để tour hiện lúc mở màn). Mọi bài có bơm đi qua {@link seedAndSettle}:
 * chờ nút `xuất`, rồi bỏ qua tour bằng nút của sản phẩm — trước cú bấm đầu tiên.
 */

const PROJECT_ID = 'project-1';
const EXPORT_URL = ROUTES.project.export(PROJECT_ID);

/** Lần tải đầu của một route bắt Vite dịch nguội; cùng hằng `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

/** Dựng `.glb` của bốn tầng chạy trong worker — đo được ~1–2 s; biên cho máy bận. */
const GLB_EXPORT_TIMEOUT_MS = 20_000;

/** Bấm `chia sẻ` khi bị che: đủ để Playwright thử vài lượt rồi đỏ, không ngồi hết 30 s. */
const COVERED_CLICK_TIMEOUT_MS = 3_000;

/** Màn đã có dữ liệu — từ B-V12-01 cổng nạp kho trước khi màn vẽ. */
const SCREEN_HEADING = 'xuất bản vẽ';

/** `goto` → cổng nạp kho xong (heading "xuất bản vẽ") → bơm → nút `xuất` hiện → bỏ qua tour nếu nó đã hiện. */
async function seedAndSettle(page: Page): Promise<void> {
  await page.goto(EXPORT_URL);
  await expect(page.getByRole('heading', { name: SCREEN_HEADING })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await seedSpatial(page, { projectId: PROJECT_ID });
  await expect(page.getByRole('button', { name: 'xuất', exact: true })).toBeVisible();
  await dismissTourIfShown(page);
}

test('vai người xem mở màn xuất thì thấy "không có quyền", không có nút xuất (A11 forbidden)', async ({
  page,
}) => {
  await signInAs(page, 'viewer', EXPORT_URL);

  await expect(page.getByText('không có quyền xuất bản vẽ')).toBeVisible();
  await expect(
    page.getByText(
      'chỉ quản trị viên và kỹ sư của dự án xuất được mô hình; bạn đang xem ở quyền chỉ đọc.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'xuất', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'chia sẻ' })).toHaveCount(0);
});

test('có bơm kho: bấm "xuất" .glb thì tệp tải về máy và hiện một dòng trong "tệp đã xuất" với dung lượng dấu phẩy (A15, B-V12-05)', async ({
  page,
}) => {
  await seedAndSettle(page);

  await expect(page.getByRole('radio', { name: /^\.glb/u })).toHaveAttribute('aria-checked', 'true');

  const download = page.waitForEvent('download', { timeout: GLB_EXPORT_TIMEOUT_MS });
  const exportButton = page.getByRole('button', { name: 'xuất', exact: true });
  await exportButton.focus();
  await page.keyboard.press('Enter');

  expect((await download).suggestedFilename()).toMatch(/\.glb$/u);

  const files = page.getByRole('region', { name: 'tệp đã xuất' });
  await expect(files).toContainText(/\.glb/u);
  await expect(files).toContainText(/\d,\d (KB|MB)/u);
});

test('có bơm kho: link "sửa" của khối kiểm tra trước khi xuất đưa sang màn luật mà KHÔNG tải lại trang, nên kho còn nguyên (B-V12-06)', async ({
  page,
}) => {
  await seedAndSettle(page);

  const preflight = page.getByRole('region', { name: 'kiểm tra trước khi xuất' });
  const fixViolations = preflight
    .getByRole('listitem')
    .filter({ hasText: /vi phạm chưa xử lý/u })
    .getByRole('link', { name: 'sửa' });

  let reloads = 0;
  page.on('load', () => {
    reloads += 1;
  });

  await fixViolations.click();

  await expect.poll(() => pathOf(page.url())).toBe(ROUTES.project.rules(PROJECT_ID));
  // Kho sống sót = màn luật có bảng ngay, không rơi về "chưa có mô hình".
  await expect(page.getByRole('button', { name: 'Chạy kiểm tra lại' })).toBeVisible();
  expect(reloads).toBe(0);
});

test.fixme(
  'có bơm kho: sau khi tour bị bỏ qua, chip "xem hướng dẫn" không che nút "chia sẻ" (B-V12-09)',
  // Lý do: chip `fixed right-[16px] top-[16px]` (`EditorTour.tsx`) đè lên nút `chia sẻ`
  // của đầu màn xuất ở mọi bề rộng ≥ 1280 px. Mở — chuyển W02 (đang sửa `EditorTour`;
  // dời chip là việc của bề mặt dùng chung). Mở lại khi chip không còn đè nút nào.
  async ({ page }) => {
    await seedAndSettle(page);

    // Hôm nay tour chỉ hiện sau `resize` — đẩy nó ra rồi bỏ qua, để chip hiện.
    await dismissTourIfShown(page, { nudge: true });
    await expect(page.getByRole('button', { name: 'xem hướng dẫn' })).toBeVisible();

    const share = page.getByRole('button', { name: 'chia sẻ' });

    // `click()` thường của Playwright từ chối bấm khi một phần tử khác hứng cú bấm.
    await share.click({ timeout: COVERED_CLICK_TIMEOUT_MS });
    await expect(page.getByRole('dialog', { name: 'chia sẻ bản vẽ' })).toBeVisible();
  },
);
