import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { signInAs } from '../fixtures/session';

import { FIRST_PAINT_TIMEOUT_MS, FIXTURE_STATUS, MEASURE_PATH, expectSceneDrawn, openWithFixture } from './v9';

/**
 * Màn đo (`MeasurementTool`) — `plan.md` V9 mục 2.
 *
 * Bốn phím ở phạm vi `canvas`, gỡ khi unmount, Esc không nuốt Esc của lớp trên,
 * ghim/xoá hỏng: tầng đơn vị (56 bài). Ở đây là thứ đơn vị không thấy: danh sách
 * phép đo tải thật qua bộ mẫu dev, ray công cụ của vỏ, bản nháp trên canvas thật,
 * và bảng phím tắt toàn cục chồng lên chế độ đo.
 */

const MEASURE_TOOL = 'đo (M)';
const ORBIT_TOOL = 'quay quanh mô hình (R)';
const TOGGLE_TOOL = 'Bật tắt công cụ đo (phím M)';
const DROP_DRAFT = 'Bỏ phần đo dở (phím Esc)';
const PIN = 'Ghim phép đo (phím Enter)';
const LOAD_ERROR = 'Chưa tải được danh sách phép đo của dự án. Kiểm tra kết nối rồi thử lại.';
const EMPTY_LIST = 'Chưa có phép đo nào. Nhấn M rồi chọn hai điểm trên mô hình.';
const PIN_BLOCKED = 'Bạn chỉ có quyền xem dự án này, nên chưa ghim được phép đo. vẫn đo và đọc số bình thường.';

const rail = (page: Page) => page.getByRole('toolbar', { name: 'Công cụ khung nhìn' });

async function expectActiveTool(page: Page, name: string): Promise<void> {
  await expect(rail(page).getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true');
}

/** Bấm giữa canvas — nhà mẫu nằm giữa khung nhìn ở góc phối cảnh mặc định. */
async function clickSceneCentre(page: Page, dx = 0): Promise<void> {
  const box = await page.locator('canvas').first().boundingBox();
  if (box === null) throw new Error('canvas không có hộp bao — cảnh chưa gắn');
  await page.mouse.click(box.x + box.width / 2 + dx, box.y + box.height / 2);
}

test('danh sách phép đo tải được ở dev: rỗng, không câu lỗi, không lượt 404 (B-G-05)', async ({ page }) => {
  const failed: string[] = [];
  page.on('response', (response) => {
    if (response.status() >= 400 && response.url().includes('/measurements')) failed.push(response.url());
  });

  await openWithFixture(page, MEASURE_PATH);

  const list = page.getByRole('region', { name: 'Phép đo' });
  await expect(list.getByText('0 phép đo', { exact: true })).toBeVisible();
  await expect(list.getByText(EMPTY_LIST, { exact: true })).toBeVisible();
  await expect(page.getByText(LOAD_ERROR, { exact: true })).toHaveCount(0);
  expect(failed).toEqual([]);
});

test('phím M và nút "bật tắt công cụ đo" đổi ray công cụ của vỏ', async ({ page }) => {
  await openWithFixture(page, MEASURE_PATH);
  await expectActiveTool(page, ORBIT_TOOL);

  await page.keyboard.press('m');
  await expectActiveTool(page, MEASURE_TOOL);
  await expect(rail(page).getByRole('button', { name: ORBIT_TOOL })).toHaveAttribute('aria-pressed', 'false');

  await page.getByRole('button', { name: TOGGLE_TOOL }).click();
  await expectActiveTool(page, ORBIT_TOOL);
});

test('bản nháp: bấm canvas thì có nút ghim; Esc bỏ nháp mà vẫn ở chế độ đo — và nút Esc nói đúng thế (B-V9-03)', async ({
  page,
}) => {
  await openWithFixture(page, MEASURE_PATH);
  await expectSceneDrawn(page);
  await page.keyboard.press('m');
  await expectActiveTool(page, MEASURE_TOOL);

  await clickSceneCentre(page);
  await expect(page.getByRole('button', { name: PIN })).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.getByRole('button', { name: PIN })).toHaveCount(0);
  await expectActiveTool(page, MEASURE_TOOL);
  // Nhãn từng hứa "thoát chế độ đo" trong khi Esc chỉ bỏ nháp (P4).
  await expect(page.getByRole('button', { name: DROP_DRAFT })).toBeVisible();
});

test('ghim một phép đo, xoá nó, rồi "Hoàn tác" trả lại — qua bộ mẫu dev (A8)', async ({ page }) => {
  await openWithFixture(page, MEASURE_PATH);
  await expectSceneDrawn(page);
  const list = page.getByRole('region', { name: 'Phép đo' });

  await page.keyboard.press('m');
  await clickSceneCentre(page, -60);
  await clickSceneCentre(page, 60);
  await page.getByRole('button', { name: PIN }).click();
  await expect(list.getByText('1 phép đo', { exact: true })).toBeVisible();

  await list.getByRole('button', { name: /^Xoá / }).click();
  await expect(list.getByText('0 phép đo', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Hoàn tác' }).click();
  await expect(list.getByText('1 phép đo', { exact: true })).toBeVisible();
});

test('"?" mở bảng phím tắt trên chế độ đo; Esc đóng bảng trước, chế độ đo còn nguyên (A12)', async ({ page }) => {
  await openWithFixture(page, MEASURE_PATH);
  await page.keyboard.press('m');
  await expectActiveTool(page, MEASURE_TOOL);

  await page.keyboard.press('?');
  await expect(page.getByRole('dialog')).toHaveCount(1);

  await page.keyboard.press('Escape');

  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expectActiveTool(page, MEASURE_TOOL);
});

test('vai Người xem: vẫn vào được chế độ đo, và màn nói vì sao không ghim được', async ({ page }) => {
  await signInAs(page, 'viewer', MEASURE_PATH);
  await expect(page.getByText(FIXTURE_STATUS, { exact: true })).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  await expectSceneDrawn(page);

  await expect(page.getByRole('alert').filter({ hasText: PIN_BLOCKED })).toHaveCount(1);
  await page.keyboard.press('m');
  await expectActiveTool(page, MEASURE_TOOL);

  // Đang đo thật: bấm canvas ra bản nháp, nút ghim hiện nhưng khoá — chỉ ghim bị chặn.
  await clickSceneCentre(page);
  await expect(page.getByRole('button', { name: PIN })).toBeDisabled();
});

test('vai Người xem: ray công cụ cho thấy đang đo, qua phím M lẫn qua nút bật tắt (A12 · B-V9-04)', async ({
  page,
}) => {
  await signInAs(page, 'viewer', MEASURE_PATH);
  await expect(page.getByText(FIXTURE_STATUS, { exact: true })).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });

  await page.keyboard.press('m');
  await expectActiveTool(page, MEASURE_TOOL);

  await page.getByRole('button', { name: TOGGLE_TOOL }).click();
  await expectActiveTool(page, ORBIT_TOOL);

  await page.getByRole('button', { name: TOGGLE_TOOL }).click();
  await expectActiveTool(page, MEASURE_TOOL);
});

test(
  'phím R/H/C/V trên nhãn ray đổi được công cụ trên màn đo (B-V9-07)',
  // Vỏ 3D dùng chung với `/3d`: `TOOL_COMBOS` (`viewerShellShortcuts.ts`) là nguồn
  // của cả nhãn lẫn binding — bản sửa B-V6-08 của W04.
  async ({ page }) => {
    await openWithFixture(page, MEASURE_PATH);
    for (const [key, name] of [
      ['c', 'mặt cắt (C)'],
      ['v', 'chọn (V)'],
      ['h', 'kéo màn (H)'],
      ['r', ORBIT_TOOL],
    ] as const) {
      await page.keyboard.press(key);
      await expectActiveTool(page, name);
    }
  },
);
