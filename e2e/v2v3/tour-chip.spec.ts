import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';
import { TOUR_CHIP_NAME, TOUR_SKIP_NAME, TOUR_TITLES } from '../fixtures/tour';

/**
 * Chip "xem hướng dẫn" của `EditorTour` — thứ còn lại sau khi người dùng bỏ qua tour —
 * không được che điều khiển nào của màn chủ. Ba màn chủ: duyệt tường
 * (`ROUTES.project.walls`), vỏ 3D (`ROUTES.project.viewer`), xuất (`ROUTES.project.export`,
 * cổng nạp kho B-V12-01). Lỗi B-V2-05 (nhóm V2, `EditorTour`).
 *
 * ## Lỗi đã sửa
 *
 * Chip từng đặt `fixed` ở góc phải trên (16 px) và nằm đè nút "chia sẻ" của màn xuất
 * (1280×720: cú bấm chuột bị chặn "subtree intercepts pointer events"), cạnh hộp
 * "Góc nhìn sẵn" của vỏ 3D. Đo 2026-10-03 cả 6 tổ hợp (3 màn × 2 cỡ) trước khi chọn
 * chỗ mới: góc phải trên đè "chia sẻ" (xuất) và "Góc nhìn sẵn" (3D); góc dưới-phải là chỗ
 * của toast (`NotificationHost`); góc dưới-trái nằm trên cột danh sách đoạn tường của màn
 * tường (hôm nay rỗng vì bộ mẫu không có tường cho màn ấy, có dữ liệu thì hàng cuối bị
 * che). Giữa cạnh dưới trống ở cả sáu.
 *
 * ## Vì sao sinh bài từ bảng
 *
 * Một bảng `HOSTS × VIEWPORTS`: thêm một màn chủ cho tour là thêm một dòng. Mỗi bài đo
 * hộp bao thật của chip và của mọi điều khiển tương tác đang hiển thị, không bám tọa độ
 * cứng — chỗ chip đứng có đổi nữa thì bài vẫn đúng nghĩa.
 *
 * ## KHÔNG kiểm ở đây, và vì sao
 * - Dạng thu gọn (< 1280 px): chip là chip của dạng rộng; dạng thu gọn `EditorTour.test.tsx` phủ.
 * - Điều khiển không phải `button`/`a`/`input`/`select`/`textarea`/`[role=button]`/
 *   `[role=combobox]` (ví dụ vùng vẽ SVG): không có tiêu chí "che" nào đo được chung cho chúng.
 * - Màn tường khi cuộn tài liệu xuống đáy: chip nằm trên chữ của "Thanh trạng thái" — không
 *   phải điều khiển; màn tường cao hơn khung nhìn là chuyện bố cục của màn ấy.
 * - Toast đè chip: toast ở `z-50` trên lớp tour, nằm góc dưới-phải, không đè chỗ chip.
 */

/** Lần tải đầu một route bắt Vite dịch nguội; tiền lệ `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

/** Vỏ 3D phải dựng xong bốn tầng — cùng con số với `viewer-helpers.ts` (`VIEWER_READY_TIMEOUT_MS`). */
const VIEWER_READY_TIMEOUT_MS = 20_000;

/**
 * Hạn của lượt hâm nóng (`beforeAll`), không phải của bài nào: lần tải nguội đầu mỗi
 * worker có thể quá 25 s khi máy đang chạy e2e khác (đo ở `share-dialog.spec.ts`).
 */
const COLD_START_TIMEOUT_MS = 60_000;

/** Tour tự hiện sau khi màn chủ đã vẽ; trần rộng cho máy đang chạy hai lượt e2e — như `editor-tour.spec.ts`. */
const TOUR_SELF_APPEAR_TIMEOUT_MS = 6_000;

/** Hạn cho một cú bấm chuột: nút đã hiện, chỉ còn chờ nó nhận được con trỏ. Lỗi cũ treo 30 s. */
const ACTIONABLE_TIMEOUT_MS = 5_000;

const PROJECT_ID = 'project-1';
const WALLS = ROUTES.project.walls(PROJECT_ID, 'L1');
const VIEWER = ROUTES.project.viewer(PROJECT_ID);
const EXPORT = ROUTES.project.export(PROJECT_ID);

/** Những gì người dùng bấm/gõ được. Chip nằm trên thứ gì trong số này là che. */
const INTERACTIVE = 'button, a[href], input, select, textarea, [role=button], [role=combobox]';

interface Host {
  readonly name: string;
  /** Tiêu đề bước tour tự hiện ở màn này — tên của `region` thẻ. */
  readonly tourTitle: string;
  /** Mở màn và đưa nó tới lúc tour tự hiện. */
  readonly open: (page: Page) => Promise<void>;
}

async function openWalls(page: Page): Promise<void> {
  await page.goto(WALLS);
  await expect(page.getByRole('region', { name: 'Duyệt lớp tường' })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
}

async function openViewer(page: Page): Promise<void> {
  await page.goto(VIEWER);
  await expect(page.getByText('Mô hình 3D đã dựng xong.', { exact: true })).toBeAttached({
    timeout: VIEWER_READY_TIMEOUT_MS,
  });
}

/** goto → cổng nạp kho (B-V12-01) → nút "xuất" (neo của bước tour) có mặt. */
async function openExport(page: Page): Promise<void> {
  await page.goto(EXPORT);
  await expect(page.getByRole('button', { name: 'xuất', exact: true })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
}

const HOSTS: readonly Host[] = [
  { name: 'màn tường', tourTitle: TOUR_TITLES.switchTool, open: openWalls },
  { name: 'vỏ 3D', tourTitle: TOUR_TITLES.view3d, open: openViewer },
  { name: 'màn xuất', tourTitle: TOUR_TITLES.exportResult, open: openExport },
];

/** 1280 là cỡ rộng nhỏ nhất (dưới đó tour thu gọn); 1440×900 là cỡ bàn làm việc thường gặp. */
const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
] as const;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(COLD_START_TIMEOUT_MS * 2);
  const page = await browser.newPage();
  await page.goto(WALLS);
  await expect(page.getByRole('region', { name: 'Duyệt lớp tường' })).toBeVisible({
    timeout: COLD_START_TIMEOUT_MS,
  });
  await page.goto(VIEWER);
  await expect(page.getByText('Mô hình 3D đã dựng xong.', { exact: true })).toBeAttached({
    timeout: COLD_START_TIMEOUT_MS,
  });
  await page.close();
});

/** Chờ thẻ tour tự hiện, bấm "Bỏ qua hướng dẫn", trả về chip "Xem hướng dẫn" đã hiện. */
async function skipTour(page: Page, tourTitle: string): Promise<Locator> {
  const card = page.getByRole('region', { name: tourTitle, exact: true });
  await expect(card).toBeVisible({ timeout: TOUR_SELF_APPEAR_TIMEOUT_MS });
  await card.getByRole('button', { name: TOUR_SKIP_NAME, exact: true }).click();
  await expect(card).toHaveCount(0);
  const chip = page.getByRole('button', { name: TOUR_CHIP_NAME, exact: true });
  await expect(chip).toBeVisible();
  return chip;
}

/** Mọi điều khiển hiển thị có hộp bao giao với hộp bao của chip — mô tả đọc được. */
async function controlsUnderChip(chip: Locator): Promise<string[]> {
  return chip.evaluate((chipEl, selector) => {
    const c = chipEl.getBoundingClientRect();
    const hits: string[] = [];
    for (const el of document.querySelectorAll(selector)) {
      if (el === chipEl || chipEl.contains(el)) continue;
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right <= c.left || r.left >= c.right || r.bottom <= c.top || r.top >= c.bottom) continue;
      const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim();
      hits.push(`${el.tagName.toLowerCase()} "${name}" @${Math.round(r.left)},${Math.round(r.top)}`);
    }
    return hits;
  }, INTERACTIVE);
}

for (const host of HOSTS) {
  for (const viewport of VIEWPORTS) {
    test(`${host.name}, ${viewport.width}×${viewport.height}: sau khi bỏ qua tour, chip "Xem hướng dẫn" không nằm đè điều khiển nào của màn (B-V2-05)`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await host.open(page);
      const chip = await skipTour(page, host.tourTitle);

      expect(await controlsUnderChip(chip)).toEqual([]);
    });
  }
}

test('màn xuất, bỏ qua tour: bấm chuột vào "chia sẻ" mở hộp thoại "chia sẻ bản vẽ" (B-V2-05)', async ({
  page,
}) => {
  // F-06 (E6=B): liên kết chia sẻ là v2 — bản v1 không có nút "chia sẻ". Gỡ khi v2 lật cờ.
  test.skip(true, 'Liên kết chia sẻ là v2 (/share-links, BE-BIND #47–#49; F-06, E6=B, NO-355): bản v1 không có nút "chia sẻ"');
  await page.setViewportSize(VIEWPORTS[0]);
  await openExport(page);
  await skipTour(page, TOUR_TITLES.exportResult);

  await page.getByRole('button', { name: 'chia sẻ', exact: true }).click({ timeout: ACTIONABLE_TIMEOUT_MS });

  await expect(page.getByRole('dialog', { name: 'chia sẻ bản vẽ' })).toBeVisible();
});
