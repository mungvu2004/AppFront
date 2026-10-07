import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';

/**
 * Hộp thoại "Chia sẻ bản vẽ" (`ShareDialog`, không có route) — mở từ nút "chia sẻ"
 * của `ExportPanel` (`ROUTES.project.export`). Nhóm V3, kế hoạch mục 4
 * (`docs/notes/e2e/plan.md`, ca V3-SHARE-1) + phát hiện F2.
 *
 * ## Vì sao KHÔNG còn bơm kho
 *
 * Từ B-V12-01 route `/export` nạp kho qua cổng `ProjectSpatialGate`, nên nút "chia sẻ"
 * có mặt bằng đường sản phẩm; ca đầu khẳng định điều đó. Trước đó các bài phải bơm.
 *
 * ## KHÔNG kiểm ở đây, và vì sao
 * - Bảy trạng thái, A8 đổi quyền, mã nhúng: `ShareDialog.test.tsx` đã phủ.
 * - Vai viewer: chưa đo đường nạp + đăng nhập viewer cùng lúc; đơn vị có `forbidden`.
 * - Sao chép ra clipboard thật: cần quyền `clipboard-read`.
 * - Tour: từ bản sửa `f35ce7a` (B-V2-01), khi nút "xuất" có mặt (cổng nạp kho xong) thì `EditorTour`
 *   TỰ HIỆN thẻ "Lấy tệp mang đi" — bài CHỜ thẻ ấy rồi bấm "bỏ qua" trước cú bấm "chia sẻ"
 *   (không dùng `dismissTour` mặc định: nó đếm một lần, không chờ, nên chập chờn ở đây).
 */

/**
 * F-06 (E6=B): liên kết chia sẻ là v2 — máy chủ v1 không mount BE-BIND #47–#49
 * (`/share-links`), nên `SHARE_LINKS_SUPPORTED` (`src/lib/export/shareLink.ts`) tắt và màn
 * xuất không còn nút "chia sẻ" lẫn hộp thoại. Bài đầu khẳng định đúng trạng thái tắt; các
 * các bài mở hộp thoại đã gỡ (NO-355) — v2 lật cờ thì viết lại từ `ShareDialog.test.tsx`.
 */

/** Lần tải đầu một route bắt Vite dịch nguội; tiền lệ `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

/**
 * Hạn của lượt hâm nóng (`beforeAll` bên dưới), không phải của bài nào.
 *
 * Đo 2026-10-03: Vite mới dựng tải lại trang một lần giữa lượt tải đầu (tối ưu phụ thuộc),
 * mốc hiện sau ~11 s lúc máy rảnh; lúc máy đang chạy e2e của worktree khác, hai bài ĐẦU
 * của lượt (mỗi worker một bài, cùng dịch nguội) hai lần quá cả 25 s. Hâm nóng một lần
 * mỗi worker trả cái giá ấy ngoài hạn 30 s của bài.
 */
const COLD_START_TIMEOUT_MS = 60_000;

const PROJECT_ID = 'project-1';
const EXPORT = ROUTES.project.export(PROJECT_ID);
const SCREEN_HEADING = 'Xuất bản vẽ';

test.beforeAll(async ({ browser }) => {
  test.setTimeout(COLD_START_TIMEOUT_MS);
  const page = await browser.newPage();
  await page.goto(EXPORT);
  await expect(page.getByRole('heading', { name: SCREEN_HEADING })).toBeVisible({ timeout: COLD_START_TIMEOUT_MS });
  await page.close();
});

const SHARE_LINKS = new RegExp(`/api/projects/${PROJECT_ID}/share-links`);

/** goto → cổng nạp kho dự án xong (B-V12-01): màn ở trạng thái có dữ liệu. */
async function openExport(page: Page): Promise<void> {
  await page.goto(EXPORT);
  await expect(page.getByRole('heading', { name: SCREEN_HEADING })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
}

function shareButton(page: Page): Locator {
  return page.getByRole('button', { name: 'chia sẻ', exact: true });
}

test('không bơm kho: /export đi bằng đường sản phẩm thì cổng nạp kho xong, nút "chia sẻ" vắng và không request nào tới /share-links (B-V12-01, F-06)', async ({
  page,
}) => {
  const shareLinkRequests: string[] = [];
  page.on('request', (request) => {
    if (SHARE_LINKS.test(request.url())) shareLinkRequests.push(request.url());
  });

  await openExport(page);
  await expect(page.getByRole('button', { name: 'Xuất', exact: true })).toBeVisible();
  await expect(shareButton(page)).toHaveCount(0);
  expect(shareLinkRequests).toEqual([]);
});
