/**
 * Bỏ qua `EditorTour` bằng nút "bỏ qua" của sản phẩm.
 *
 * Vì sao cần: tour là nền tối `pointer-events-auto`; nếu nó hiện giữa bài thì cú
 * bấm đầu của bài trúng nền và BỎ QUA TOUR thay vì làm việc bài định làm.
 *
 * Ba điều đã đo, và chúng quyết định hình dạng của hàm này:
 * 1. `EditorTour` KHÔNG mang `role="dialog"`/`aria-modal` (`EditorTour.tsx:15-17`).
 *    Đừng bám `getByRole('dialog')`. Thẻ là `region` đặt tên theo tiêu đề bước, nên
 *    mốc neo ở đây là nút `bỏ qua` TRONG `region` của thẻ. Màn chào cũng có nút "Bỏ qua"
 *    (viết hoa chữ đầu theo A6) nhưng không nằm trong `region` nào, nên không khớp.
 * 2. Từ bản sửa W02 thẻ hiện NGAY lúc mở màn tường / xuất; ở `/3d` nó nạp động nên có thể
 *    hiện muộn một nhịp — ở đó dùng `dismissTourIfPresent` (`e2e/v8/viewer.ts`), hàm CHỜ.
 *    Hàm này KHÔNG chờ: đếm một lần, cho màn không chắc có tour.
 *    Nó chỉ đếm MỘT lần; có thì bấm. Gọi lại sau mỗi `setViewportSize`/điều hướng.
 * 3. Đóng bằng nút của sản phẩm, KHÔNG đặt trước khoá `appfront:system-editor-tour-seen:*`
 *    bằng `addInitScript` — đó là kiểm một sản phẩm khác.
 *
 * `nudge`: đổi khung nhìn 1 px rồi trả lại để gọi `resize` — cách duy nhất đã đo để
 * tour hiện trên màn chủ.
 */
import type { Page } from '@playwright/test';

/** Trả về `true` nếu có một thẻ tour và nó đã bị bỏ qua. */
export async function dismissTourIfShown(
  page: Page,
  { nudge = false }: { nudge?: boolean } = {},
): Promise<boolean> {
  if (nudge) {
    const size = page.viewportSize();
    if (size !== null) {
      await page.setViewportSize({ width: size.width + 1, height: size.height });
      await page.setViewportSize(size);
    }
  }

  // Chờ đúng một khung hình để React kịp vẽ lại sau `resize` — không phải chờ thẻ.
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => done())));

  const skip = page.getByRole('region').getByRole('button', { name: /bỏ qua/ });
  if ((await skip.count()) === 0) return false;

  await skip.first().click();
  return true;
}
