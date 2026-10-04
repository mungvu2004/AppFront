/**
 * `EditorTour` cho bài e2e: chữ của nó, và MỘT hàm bỏ nó bằng nút của sản phẩm.
 *
 * Vì sao cần bỏ: tour là nền tối `pointer-events-auto`; nếu nó hiện giữa bài thì cú
 * bấm đầu của bài trúng nền và BỎ QUA TOUR thay vì làm việc bài định làm.
 *
 * Chữ gõ tay, không nhập từ `useEditorTour.ts`: bài e2e là người đọc màn, không đọc
 * mã — và nhập tệp ấy kéo React vào tiến trình Playwright.
 *
 * Điều đã đo, và chúng quyết định hình dạng của hàm:
 * 1. `EditorTour` KHÔNG mang `role="dialog"`/`aria-modal` (`EditorTour.tsx:15-17`). Thẻ là
 *    `region` đặt tên theo tiêu đề bước; nút bỏ tour đọc "Bỏ qua hướng dẫn" — KHÔNG phải
 *    "Bỏ qua" trần, chữ ấy là nút của màn tường (`WallLayerInspector`) và của màn chào.
 * 2. Màn tường / xuất: thẻ hiện NGAY lúc mở. `/3d`: tour nạp ĐỘNG nên có thể hiện muộn một
 *    nhịp sau khi cảnh dựng xong — ở đó gọi với `waitMs`. Gọi lại sau mỗi điều hướng.
 * 3. Đóng bằng nút của sản phẩm, KHÔNG đặt trước khoá `appfront:system-editor-tour-seen:*`
 *    bằng `addInitScript` — đó là kiểm một sản phẩm khác.
 * 4. B-V2-41: ba bản chép cũ của hàm này (ở đây, `v8/viewer.ts`, `viewer3d.spec.ts`) tìm
 *    nút theo chữ — khi chữ đổi, hai bản nuốt lỗi chờ và lặng lẽ không bấm gì, bài đi tiếp
 *    dưới nền tối. Nay: nền còn mà không thấy nút thì NÉM, không trả `false`.
 */
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export const TOUR_SKIP_NAME = 'Bỏ qua hướng dẫn';
export const TOUR_NEXT_NAME = 'Tiếp theo';
export const TOUR_FINISH_NAME = 'Bắt đầu làm việc';
/** Chip quay lại tour, hiện sau khi bỏ qua. */
export const TOUR_CHIP_NAME = 'Xem hướng dẫn';

/** Tiêu đề thẻ — cũng là tên `region` của thẻ. */
export const TOUR_TITLES = {
  switchTool: 'Chọn công cụ ở ray bên trái',
  reviewWall: 'Đi dọc từng đoạn tường',
  editThickness: 'Đặt lại độ dày cho đoạn đang chọn',
  undo: 'Lùi lại khi lỡ tay',
  view3d: 'Đổi sang khung nhìn khối',
  exportResult: 'Lấy tệp mang đi',
  summary: 'Bấy nhiêu phím là đủ dùng',
} as const;

/**
 * Trần chờ tour HIỆN RA sau khi neo của nó đã có. Tour hiện theo sự kiện chứ không
 * theo giờ, nên đây là trần của một lượt "có thể có", không phải thời gian mong đợi.
 */
export const TOUR_APPEAR_TIMEOUT_MS = 6_000;

/** Nền tối của tour — không có vai nào để bám (`EditorTour.tsx`, các tấm `backdropPanels`). */
const TOUR_BACKDROP = 'div.pointer-events-auto.fixed.bg-bg-overlay';

/**
 * Bỏ tour nếu nó đang hiện (hoặc hiện ra trong `waitMs`). Trả `true` nếu đã bấm bỏ.
 *
 * - `waitMs` 0 (mặc định): đếm một lần, không chờ — cho màn thẻ hiện ngay lúc mở.
 * - `nudge`: đổi khung nhìn 1 px rồi trả lại để gọi `resize`.
 */
export async function dismissTour(
  page: Page,
  { waitMs = 0, nudge = false }: { readonly waitMs?: number; readonly nudge?: boolean } = {},
): Promise<boolean> {
  if (nudge) {
    const size = page.viewportSize();
    if (size !== null) {
      await page.setViewportSize({ width: size.width + 1, height: size.height });
      await page.setViewportSize(size);
    }
  }

  // Một khung hình để React kịp vẽ lại sau `resize`/điều hướng — không phải chờ thẻ.
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => done())));

  const skip = page.getByRole('button', { name: TOUR_SKIP_NAME, exact: true }).first();
  const backdrop = page.locator(TOUR_BACKDROP);

  if (waitMs > 0) {
    // Vắng tour trong hạn là kết quả hợp lệ ("có thể có"); kiểm nền ngay dưới.
    await skip.waitFor({ state: 'visible', timeout: waitMs }).catch(() => undefined);
  }

  if ((await skip.count()) === 0) {
    if ((await backdrop.count()) > 0) {
      throw new Error(`Nền tour đang phủ nhưng không có nút "${TOUR_SKIP_NAME}" — chữ nút đổi rồi?`);
    }
    return false;
  }

  await skip.click();
  // Bấm tiếp lúc nền còn đang tan là bấm vào nó.
  await expect(backdrop).toHaveCount(0);
  return true;
}
