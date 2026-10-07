/**
 * NO-208 — chip "xem hướng dẫn" ở lại suốt phiên sau "bỏ qua", nên nó không được
 * đè điều khiển nào của màn chủ. Mỗi màn: bỏ qua tour, rồi điều khiển
 * quan trọng phải là thứ nhận chuột tại tâm của nó.
 *
 * Chưa có bài cho nút "xuất" của ExportPanel: dữ liệu mock hiện chỉ dựng trạng thái
 * "chưa có gì được duyệt để xuất", nên không có nút ấy để bấm. ExportPanel dùng góc
 * mặc định (trên phải); nút nằm ở chân panel nên không giao nhau.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function openAndSkipTour(
  page: Page,
  path: string,
  height = 900,
  width = 1440,
): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto(path);
  await page.getByRole('button', { name: 'Bỏ qua hướng dẫn', exact: true }).first().click({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Xem hướng dẫn' })).toBeVisible();
}

/** Tâm của phần tử có thật là thứ nhận chuột — không lớp nào đè lên. */
async function expectReachable(page: Page, selector: string): Promise<void> {
  const box = await page.locator(selector).first().boundingBox();
  expect(box).not.toBeNull();

  const ok = await page.evaluate(
    ([sel, x, y]) => {
      const hit = document.elementFromPoint(Number(x), Number(y));
      return hit !== null && document.querySelector(String(sel))?.contains(hit) === true;
    },
    [selector, box!.x + box!.width / 2, box!.y + box!.height / 2],
  );

  expect(ok).toBe(true);
}

test('viewer: sau khi bỏ qua tour, "Góc nhìn sẵn" vẫn bấm được', async ({ page }) => {
  await openAndSkipTour(page, '/projects/P-01/3d');
  await expectReachable(page, '[aria-label="Góc nhìn sẵn"]');
});

test('duyệt lớp tường: sau khi bỏ qua tour, thanh trạng thái không bị đè', async ({ page }) => {
  await openAndSkipTour(page, '/projects/P-01/floors/F-01/layers/walls', 1200);
  await expectReachable(page, '[aria-label="Thanh trạng thái"] [aria-live="polite"]');
});

/** Các tấm mà màn 3D mở ra từ thanh nút; mỗi tấm là một lớp nội dung có điều khiển riêng. */
const VIEWER_PANELS = ['Diện tích phòng', 'Thư viện đồ đạc', 'Lịch sử thao tác'];

for (const panel of VIEWER_PANELS) {
  test(`viewer 375px, tấm "${panel}" đang mở: chip không đè điều khiển nào`, async ({ page }) => {
    await openAndSkipTour(page, '/projects/P-01/3d', 800, 375);
    await page.getByRole('button', { name: panel }).click();

    const chip = await page.getByRole('button', { name: 'Xem hướng dẫn' }).boundingBox();
    expect(chip).not.toBeNull();

    /* Mọi điều khiển nhìn thấy được (trừ chính chip) không giao với hộp của chip. */
    const covered = await page.evaluate((c) => {
      return [...document.querySelectorAll('button, a, input, [role="combobox"], [role="radio"]')]
        .filter((e) => !e.textContent?.includes('Xem hướng dẫn'))
        .filter((e) => {
          const r = e.getBoundingClientRect();
          const style = getComputedStyle(e);

          return (
            r.width > 0 &&
            style.visibility !== 'hidden' &&
            r.right > c!.x &&
            r.left < c!.x + c!.width &&
            r.bottom > c!.y &&
            r.top < c!.y + c!.height
          );
        })
        .map((e) => (e.getAttribute('aria-label') ?? e.textContent ?? '').trim().slice(0, 40));
    }, chip);

    expect(covered).toEqual([]);
  });
}
