/**
 * Ghim giờ và chuyển động để cùng một đầu vào cho ra cùng điểm ảnh.
 *
 * Ba thứ, mỗi thứ chặn một nguồn trôi (chép từ `e2e/app.visual.spec.ts`):
 * - `clock.setFixedTime`: `Date.now()` đứng yên, nên cột "cập nhật" không trôi theo giờ máy.
 * - `reducedMotion: 'reduce'`: bỏ phần dịch chuyển lúc vào. KHÔNG bỏ phần mờ dần
 *   (framer-motion chỉ chuyển sang crossfade), nên ảnh chuẩn vẫn phải chờ hết
 *   quãng chuyển động đã biết (tối đa 340 ms) bằng khẳng định hoặc một lần chờ có ghi chú.
 * - khung nhìn cố định 1440 x 900.
 *
 * Gọi TRƯỚC `page.goto`.
 */
import type { Page } from '@playwright/test';

export const FIXED_TIME = new Date('2026-06-15T12:00:00.000Z');
export const VIEWPORT = { width: 1440, height: 900 } as const;

export async function pinClock(page: Page): Promise<void> {
  await page.clock.setFixedTime(FIXED_TIME);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize(VIEWPORT);
}
