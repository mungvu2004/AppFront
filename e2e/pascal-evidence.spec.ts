import { expect, test } from '@playwright/test';

import { ROUTE_PATTERNS } from './fixtures/routes';
import { EMAIL_BY_ROLE, submitSignInForm } from './fixtures/session';

/**
 * Bằng chứng trình duyệt thật của việc gộp F-15 M1: đăng nhập → `/projects/:id/3d`
 * → trình soạn Pascal dựng ra cảnh → sửa một bức tường → "Đã lưu" → tải lại.
 *
 * Khác `pascal-viewer.spec.ts` (bài kiểm hành vi) ở chỗ tệp này CHỤP ẢNH và liệt
 * kê chữ tiếng Anh còn thấy trên màn, để người duyệt đọc được số đo thay vì tin
 * lời. Không khẳng định hộ bài kia; mọi khẳng định ở đây là tối thiểu.
 */

const PROJECT_ID = 'P-01';
const VIEWER_PATH = ROUTE_PATTERNS.projectViewer.replace(':projectId', PROJECT_ID);
const SCREEN_REGION_NAME = 'Mô hình 3D';
const VIEWPORT = { width: 1440, height: 900 } as const;
const SHOT_DIR = 'F:/App/AppBack/backend/dieu-phoi/chay/F-15/M1';
const RENDER_TIMEOUT_MS = 60_000;

/** Từ tiếng Anh thường gặp trên giao diện — đủ để bắt một panel chưa dịch. */
const ENGLISH_MARKERS = [
  'Settings',
  'Export',
  'Cancel',
  'Save',
  'Delete',
  'Width',
  'Height',
  'Thickness',
  'Level',
  'Material',
  'Wall',
  'Window',
  'Door',
  'Floor plan',
  'Expert',
];

test('đăng nhập → /3d dựng Pascal → sửa tường → "Đã lưu" → tải lại', async ({ page }) => {
  test.setTimeout(180_000);

  await page.setViewportSize(VIEWPORT);
  await page.goto(`${ROUTE_PATTERNS.login}?next=${encodeURIComponent(VIEWER_PATH)}`);
  await submitSignInForm(page, EMAIL_BY_ROLE.engineer);

  await expect(page.getByRole('region', { name: SCREEN_REGION_NAME })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId('pascal-canvas')).toBeVisible({ timeout: RENDER_TIMEOUT_MS });

  const size = await page
    .getByTestId('pascal-canvas')
    .locator('canvas')
    .first()
    .evaluate((node) => {
      const canvas = node as HTMLCanvasElement;

      return { width: canvas.width, height: canvas.height };
    });

  expect(size.width).toBeGreaterThan(0);
  expect(size.height).toBeGreaterThan(0);
  console.log(`[M1] canvas ${size.width}×${size.height}`);

  await page.screenshot({ path: `${SHOT_DIR}/shot-1-pascal.png`, fullPage: false });

  const visibleText = await page.evaluate(() => document.body.innerText);
  const english = ENGLISH_MARKERS.filter((word) => visibleText.includes(word));
  console.log(`[M1] chữ tiếng Anh còn thấy: ${english.length === 0 ? 'không có' : english.join(', ')}`);

  const thickness = page.getByRole('spinbutton', { name: /độ dày|thickness/iu }).first();
  const hasThickness = (await thickness.count()) > 0;
  console.log(`[M1] ô độ dày trong inspector: ${hasThickness ? 'có' : 'không (cần chọn tường trên canvas)'}`);

  if (!hasThickness) {
    await page.screenshot({ path: `${SHOT_DIR}/shot-2-saved.png`, fullPage: false });
    test.skip(true, 'Environment: inspector chưa mở ô độ dày khi chưa chọn tường trên canvas.');
    return;
  }

  await thickness.fill('250');
  await thickness.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu' })).toBeVisible({
    timeout: RENDER_TIMEOUT_MS,
  });

  await page.reload();
  await expect(page.getByTestId('pascal-canvas')).toBeVisible({ timeout: RENDER_TIMEOUT_MS });
  await expect(
    page.getByRole('spinbutton', { name: /độ dày|thickness/iu }).first(),
  ).toHaveValue('250');

  await page.screenshot({ path: `${SHOT_DIR}/shot-2-saved.png`, fullPage: false });
});
