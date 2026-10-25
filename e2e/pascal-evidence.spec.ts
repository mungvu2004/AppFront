import { expect, test, type Page } from '@playwright/test';

import { fixtureF1 } from '../src/lib/pascal/__fixtures__';

import { installFakeApi, type WireGraphDocument } from './fixtures/fakeApi';

/**
 * Bằng chứng trình duyệt thật của đường lưu trên trang 3D: trang Pascal riêng
 * `editor3d.html` (từ 29eba219 `/projects/:id/3d` chuyển cả trang sang đây) dựng ra cảnh
 * → sửa độ dày một bức tường qua thanh tra → chip lưu nói "Đã lưu" → máy chủ giả nhận
 * PUT → tải lại thì giá trị mới còn đó.
 *
 * Tệp này CHỤP ẢNH (thư mục kết quả của bài) và liệt kê chữ tiếng Anh còn thấy trên màn,
 * để người duyệt đọc được số đo thay vì tin lời.
 */

const PROJECT_ID = 'P-FIXTURE0001';
// `E2E_VIEWPORT=1280x720` chụp khổ khác.
const [VIEWPORT_W, VIEWPORT_H] = (process.env.E2E_VIEWPORT ?? '1440x900').split('x').map(Number);
const VIEWPORT = { width: VIEWPORT_W ?? 1440, height: VIEWPORT_H ?? 900 } as const;
const RENDER_TIMEOUT_MS = 90_000;
const WALL_NAME = 'Tường chịu lực 1';

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

const waitForScene = (page: Page) =>
  page.waitForFunction(
    () => {
      const probe = (window as unknown as { __pascalProbe?: { ready(): boolean; counts(): Record<string, number> } }).__pascalProbe;
      return probe?.ready() === true && (probe.counts()['wall'] ?? 0) > 0;
    },
    null,
    { timeout: RENDER_TIMEOUT_MS },
  );

const saveStatus = (page: Page) => page.getByRole('status').filter({ hasText: /^(Đã lưu|Đang lưu|Chưa lưu)/u }).first();

/** Chọn tường qua cây của thẻ "Cảnh" (không bấm mù lên canvas), trả về hàng độ dày của thanh tra. */
async function openWallThickness(page: Page) {
  await page.getByRole('button', { name: 'Cảnh', exact: true }).click();
  await page.getByText(WALL_NAME, { exact: true }).first().click();
  const row = page
    .locator('div.group')
    .filter({ has: page.locator('span', { hasText: /^(Thickness|Độ dày( tường)?)$/u }) })
    .first();
  await expect(row).toBeVisible();
  return row;
}

const englishOnScreen = async (page: Page) => {
  const text = await page.evaluate(() => document.body.innerText);
  return ENGLISH_MARKERS.filter((word) => text.includes(word));
};

test('trang 3D dựng Pascal → sửa tường → "Đã lưu" → tải lại vẫn giữ', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.setViewportSize(VIEWPORT);
  const api = await installFakeApi(page, {
    projectId: PROJECT_ID,
    graphDoc: fixtureF1({ ext: false }).doc as unknown as WireGraphDocument,
  });
  await page.goto(`/editor3d.html?project=${PROJECT_ID}&probe=1`);
  await waitForScene(page);

  const size = await page.locator('canvas').first().evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    return { width: canvas.width, height: canvas.height };
  });
  expect(size.width).toBeGreaterThan(300);
  expect(size.height).toBeGreaterThan(150);
  console.log(`[bằng chứng] canvas ${size.width}×${size.height}`);
  await page.screenshot({ path: testInfo.outputPath('shot-1-pascal.png') });
  console.log(`[bằng chứng] chữ tiếng Anh còn thấy: ${(await englishOnScreen(page)).join(', ') || 'không có'}`);

  const thickness = await openWallThickness(page);
  const before = await thickness.innerText();
  await thickness.locator('.cursor-text').click();
  await thickness.locator('input').fill('0,25');
  await thickness.locator('input').press('Enter');
  await expect(thickness).toContainText('0,250');
  await page.screenshot({ path: testInfo.outputPath('shot-2a-inspector.png') });
  await expect(saveStatus(page)).toHaveText(/^Đã lưu/u, { timeout: RENDER_TIMEOUT_MS });
  console.log(`[bằng chứng] độ dày: ${before.replace(/\s+/gu, ' ')} → ${(await thickness.innerText()).replace(/\s+/gu, ' ')}`);
  console.log(`[bằng chứng] chữ tiếng Anh khi mở thanh tra tường: ${(await englishOnScreen(page)).join(', ') || 'không có'}`);
  // Thanh tra tường đã dịch hết (scripts/pascal-vi/editor-extra4.mjs › nodes/src/wall/panel.tsx).
  expect(await englishOnScreen(page)).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('shot-2-saved.png') });
  expect(api.puts.length).toBeGreaterThan(0);

  await page.reload();
  await waitForScene(page);
  await expect(await openWallThickness(page)).toContainText('0,250');
  await page.screenshot({ path: testInfo.outputPath('shot-3-reloaded.png') });
  expect(api.unexpected).toEqual([]);
});
