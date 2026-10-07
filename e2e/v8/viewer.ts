/**
 * Đường tới màn 3D cho các bài nhóm V8.
 *
 * Chép gọn từ `e2e/viewer3d.spec.ts` (`waitForViewerReady`, `dismissTourIfPresent`)
 * chứ không nhập: nhập một tệp `.spec.ts` thì Playwright đăng ký lại cả bảy bài
 * của nó. Cơ chế và lý do của từng lượt chờ nằm ở docblock bên đó.
 */
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTE_PATTERNS } from '../fixtures/routes';
import { signInAs, type Role } from '../fixtures/session';
import { TOUR_APPEAR_TIMEOUT_MS, dismissTour } from '../fixtures/tour';

/** Dự án nào cũng được: vỏ đọc bộ mẫu, không đọc mã dự án. */
export const VIEWER_PROJECT_ID = 'P-01';
export const VIEWER_PATH = ROUTE_PATTERNS.projectViewer.replace(':projectId', VIEWER_PROJECT_ID);

/** Tải route + dựng mô hình bộ mẫu tốn bao lâu là cùng (đo ở `viewer3d.spec.ts`). */
const VIEWER_READY_TIMEOUT_MS = 20_000;

/** Câu `sr-only` của `Viewer3D.tsx` khi cảnh đã dựng xong (hoặc câu của vai Người xem). */
export async function waitForViewerReady(page: Page): Promise<void> {
  const built = page.getByText('Mô hình 3D đã dựng xong.', { exact: true });
  const viewerRole = page.getByText(
    'Bạn đang xem ở vai người xem nên không sửa được hình học trên mô hình 3D.',
    { exact: true },
  );
  /* Nhánh "không có WebGL" là trạng thái cuối khác: chờ cả nó để bài đỏ NGAY với
     một câu nói được lý do, không hết hạn 20 s im lặng. */
  const noWebgl = page.getByText('Trình duyệt này chưa xem được mô hình 3D', { exact: true });
  await expect(built.or(viewerRole).or(noWebgl)).toBeAttached({ timeout: VIEWER_READY_TIMEOUT_MS });
  await expect(noWebgl, 'cảnh 3D báo không có WebGL').toHaveCount(0);
  await expect(page.getByRole('main', { name: 'Khung nhìn mô hình' })).toBeVisible();
}

/**
 * Mở màn 3D. `role` cho thì đi qua biểu mẫu đăng nhập thật (vai phải chảy tới
 * `canEdit` thì bấm chuột mới chọn được — bài R1 của `viewer3d.spec.ts`).
 */
export async function openViewer(page: Page, role?: Role): Promise<void> {
  /* Ảnh xem trước của thư viện đồ đạc ở bộ mẫu trỏ ra `example.com`: đừng để bài
     phụ thuộc mạng ngoài. */
  await page.route('https://example.com/**', (route) =>
    route.fulfill({ status: 204, body: '' }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  if (role === undefined) {
    await page.goto(VIEWER_PATH);
  } else {
    await signInAs(page, role, VIEWER_PATH);
  }
  await waitForViewerReady(page);
  /* /3d: lớp hướng dẫn nạp ĐỘNG (`ViewerShell.container.tsx`, lazy) nên có thể hiện SAU khi
     cảnh dựng xong — đếm một lần không chờ là bấm trúng nền tối của nó. Chờ nút bỏ tour. */
  await dismissTourIfPresent(page);
}

/** Bỏ tour ở `/3d`: nó nạp động nên CHỜ nó trong ngân sách — xem `fixtures/tour.ts`. */
export async function dismissTourIfPresent(page: Page): Promise<void> {
  await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
}

/** Panel thanh tra của VỎ (`ViewerInspector.tsx`). */
export function shellInspector(page: Page) {
  return page.getByRole('complementary', { name: 'Thanh tra đối tượng' });
}

/** Chọn một phòng qua ô tìm — đường không dính canvas (`viewer3d.spec.ts`, `findOneRoom`). */
export async function selectRoomBySearch(page: Page, query: string, name: string): Promise<void> {
  await page.getByRole('button', { name: 'tìm phòng' }).click();
  const box = page.getByRole('combobox', { name: 'Tìm phòng theo tên hoặc mã' });
  await expect(box).toBeVisible();
  await dismissTourIfPresent(page);
  await box.fill(query);
  await page.getByRole('option', { name: new RegExp(name, 'u') }).click();
  await expect(shellInspector(page)).toContainText(name);
}
