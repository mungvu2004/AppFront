import { expect, test, type Page } from '@playwright/test';

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
// `E2E_VIEWPORT=1280x720` chụp khổ khác (bố cục khung nhúng, F-15 R4).
const [VIEWPORT_W, VIEWPORT_H] = (process.env.E2E_VIEWPORT ?? '1440x900').split('x').map(Number);
const VIEWPORT = { width: VIEWPORT_W ?? 1440, height: VIEWPORT_H ?? 900 } as const;
const SHOT_DIR = 'F:/App/AppBack/backend/dieu-phoi/chay/F-15/' + (process.env.E2E_SHOT_RUN ?? 'M1');
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
  /* Hộp `pascal-canvas` có mặt từ trạng thái `loading`, lúc `<canvas>` còn 300×150
     mặc định. Đo 2026-10-13: Chrome headless có WebGPU, cảnh dựng xong sau ~10 s;
     đọc cỡ canvas ngay khi hộp hiện là đọc trước khi ResizeObserver kịp chạy. */
  await expect(caption(page)).toHaveText(SUCCESS_CAPTION, { timeout: RENDER_TIMEOUT_MS });

  const size = await page
    .getByTestId('pascal-canvas')
    .locator('canvas')
    .first()
    .evaluate((node) => {
      const canvas = node as HTMLCanvasElement;

      return { width: canvas.width, height: canvas.height };
    });

  expect(size.width).toBeGreaterThan(300);
  expect(size.height).toBeGreaterThan(150);
  console.log(`[M1] canvas ${size.width}×${size.height}`);

  await page.screenshot({ path: `${SHOT_DIR}/shot-1-pascal.png`, fullPage: false });

  const visibleText = await page.evaluate(() => document.body.innerText);
  const english = ENGLISH_MARKERS.filter((word) => visibleText.includes(word));
  console.log(`[M1] chữ tiếng Anh còn thấy: ${english.length === 0 ? 'không có' : english.join(', ')}`);

  /* Chọn tường qua cây tầng (không bấm mù lên canvas), rồi mở thẻ inspector —
     thẻ mở ra ở dạng thu gọn (`panel-wrapper.tsx`, `desktopInspectorCollapsed`). */
  const thickness = await openWallThickness(page);
  const before = await thickness.innerText();

  await thickness.locator('.cursor-text').click();
  await thickness.locator('input').fill('0,25');
  await thickness.locator('input').press('Enter');
  await expect(thickness).toContainText('0,250');
  // Inspector đang mở: ảnh để soát nó nằm gọn trong khung nhúng (F-15 R4).
  await page.screenshot({ path: `${SHOT_DIR}/shot-2a-inspector.png`, fullPage: false });
  const after = await thickness.innerText();
  await expect(saveStatus(page)).toHaveText(/^Đã lưu/u, { timeout: RENDER_TIMEOUT_MS });
  console.log(`[M1] độ dày: ${before.replace(/\s+/gu, ' ')} → ${after.replace(/\s+/gu, ' ')}`);

  await page.screenshot({ path: `${SHOT_DIR}/shot-2-saved.png`, fullPage: false });
  const inspectorText = await page.evaluate(() => document.body.innerText);
  const inspectorEnglish = ENGLISH_MARKERS.filter((word) => inspectorText.includes(word));
  console.log(`[M1] chữ tiếng Anh khi mở inspector tường: ${inspectorEnglish.length === 0 ? 'không có' : inspectorEnglish.join(', ')}`);

  await page.reload();
  await expect(caption(page)).toHaveText(SUCCESS_CAPTION, { timeout: RENDER_TIMEOUT_MS });
  /* Bộ mẫu `VITE_USE_MOCK_API` giữ lệnh trong bộ nhớ của trang, nên tải lại thì
     về số gốc; với AppBack thật số này phải là 0,250. Chỉ ghi ra, không khẳng định. */
  const reloaded = await openWallThickness(page);
  console.log(`[M1] độ dày sau tải lại: ${(await reloaded.innerText()).replace(/\s+/gu, ' ')}`);

  await page.screenshot({ path: `${SHOT_DIR}/shot-3-reloaded.png`, fullPage: false });
});

const SUCCESS_CAPTION = 'Đã dựng xong toàn bộ bản vẽ.';
const caption = (page: Page) => page.getByRole('status').first();
/** `Đang lưu` chứ không `Đang`: lớp cộng tác (S5) cũng là một `status`, đọc "Đang làm việc riêng…". */
const saveStatus = (page: Page) =>
  page.getByRole('status').filter({ hasText: /^(Đã lưu|Đang lưu|Chưa|Tạm)/u }).first();

async function openWallThickness(page: Page) {
  await page.getByText(/^Tường bao /u).first().click();
  await page.getByRole('button', { name: /Expand panel|Mở rộng/u }).first().click();
  const row = page
    .locator('div.group')
    .filter({ has: page.locator('span', { hasText: /^(Thickness|Độ dày( tường)?)$/u }) })
    .first();
  await expect(row).toBeVisible();

  return row;
}
