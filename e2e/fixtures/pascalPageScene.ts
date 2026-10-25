/**
 * `toPascalScene` dựng như trang 3D dựng.
 *
 * `src/pascal-page/main.tsx` đọc cờ `viewer.realism-*` một lần lúc mở trang rồi bật mẫu
 * realism (`setRealismModels`, vd giường `bed-sf` có sẵn chăn → bỏ chăn `DRESS-throw-*`) và
 * chi tiết hình khối (`setDetailsEnabled`, phào chân ngoài) TRƯỚC mọi `toPascalScene`. Spec
 * tính cảnh mong đợi trong Node phải bật y như thế, không thì đếm theo cảnh mặc định (cờ tắt)
 * và lệch trang. Trang thử không đặt cờ nào → cả hai bên ra mặc định của bảng cờ.
 */
import type { Page } from '@playwright/test';

import { setRealismModels } from '../../src/lib/pascal/furnitureCatalog';
import { getFeatureFlagsSnapshot } from '../../src/lib/telemetry/flags';
import { setDetailsEnabled } from '../../src/pascal-page/realism/details';
import { realismFlagsFrom } from '../../src/pascal-page/realism/store';

const flags = realismFlagsFrom(getFeatureFlagsSnapshot().values);
setRealismModels(flags.materials);
setDetailsEnabled(flags.details);

export { toPascalScene } from '../../src/lib/pascal/toPascal';

/**
 * Chờ máy quay trượt xong sau `probe.setCamera`: cảnh realism nặng (nhất là khi vài worker cùng
 * dùng GPU) → ít khung/giây, chờ cứng 2,5 s có khi chụp giữa đường (C10 đa giác phòng lệch ảnh).
 * Trang bật idle (`realism/idle.ts`) ngừng vẽ khi máy quay đứng yên, nên "đứng yên" = hai ảnh
 * chụp cách nhau 1 s giống hệt. Hết 45 s vẫn đổi thì thôi chờ (bên gọi tự kiểm kết quả).
 */
export const waitCameraStill = async (page: Page, clip?: { x: number; y: number; width: number; height: number }): Promise<void> => {
  const deadline = Date.now() + 45_000;
  let prev = await page.screenshot(clip ? { clip } : {});
  while (Date.now() < deadline) {
    await page.waitForTimeout(1000);
    const next = await page.screenshot(clip ? { clip } : {});
    if (next.equals(prev)) return;
    prev = next;
  }
};
