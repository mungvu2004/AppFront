/**
 * Mở vỏ 3D (`/projects/project-1/3d`) và chờ nó dựng xong — dùng chung cho
 * `collaboration.spec.ts` và `editor-tour.spec.ts`.
 *
 * Chép khuôn `waitForViewerReady` của `e2e/viewer3d.spec.ts` (không nhập từ tệp
 * ấy: một tệp spec không phải thư viện, và nó thuộc worker khác). KHÔNG chép
 * `settleViewer`/`dismissTourIfPresent` ở đây: hai bài của nhóm này cần thấy lớp
 * hướng dẫn chứ không né nó — mỗi tệp tự quyết làm gì với tour.
 */
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';

/** Dự án nào cũng được: vỏ đọc bộ mẫu, không đọc mã dự án. */
export const VIEWER_PROJECT_ID = 'project-1';

/**
 * Tải route + dựng mô hình bộ mẫu tốn bao lâu là cùng — cùng con số và cùng lý
 * do với `viewer3d.spec.ts` (`VIEWER_READY_TIMEOUT_MS`): lần tải đầu bắt Vite
 * dịch nguội, rồi bốn tầng phải dựng xong.
 */
export const VIEWER_READY_TIMEOUT_MS = 20_000;

/** Khung nhìn rộng: dưới 1280 px lớp hướng dẫn đổi sang dạng thu gọn. */
export const DESKTOP_VIEWPORT = { width: 1440, height: 900 } as const;

/**
 * Mở vỏ 3D và chờ màn TỰ NÓI rằng cảnh đã dựng xong — câu `sr-only` của
 * `Viewer3D.tsx`, chỉ có ở `success`/`collapsed`. Vai mặc định của bộ mẫu là
 * `engineer`, nên không cần nhánh câu của vai Người xem như `viewer3d.spec.ts`.
 */
export async function openViewer(page: Page): Promise<void> {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await page.goto(ROUTES.project.viewer(VIEWER_PROJECT_ID));
  await expect(page.getByText('Mô hình 3D đã dựng xong.', { exact: true })).toBeAttached({
    timeout: VIEWER_READY_TIMEOUT_MS,
  });
  await expect(page.getByRole('main', { name: 'Khung nhìn mô hình' })).toBeVisible();
}
