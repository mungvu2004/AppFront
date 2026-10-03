/**
 * Dùng chung cho ba màn 3D của nhóm V9: tách tầng, đo, đối chiếu bản vẽ.
 *
 * Không có bơm kho ở đây. Sau B-V9-02, ở chế độ mock (máy chủ e2e luôn bật
 * `VITE_USE_MOCK_API`, `scripts/run-playwright.mjs`) hai màn có canvas dựng
 * đúng nhà mẫu của `/3d` khi kho rỗng — nên `seedSpatial` thừa với nhóm này.
 */
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';
import { dismissTourIfPresent } from '../v8/viewer';

export const PROJECT_ID = 'project-1';

export const EXPLODED_PATH = ROUTES.project.exploded(PROJECT_ID);
export const MEASURE_PATH = ROUTES.project.measure(PROJECT_ID);
/**
 * `L1` là mã tầng API của bộ mẫu; màn đọc nó qua N16 (B-V9-06). Bộ mẫu không tìm
 * thấy khung bản vẽ của `L1` (`FRAME_NOT_FOUND`), nên màn ở `error` theo thiết kế.
 */
export const OVERLAY_PATH = ROUTES.project.overlay(PROJECT_ID, 'L1');

/** Lần tải đầu của một route bắt Vite dịch nguội; tiền lệ `smoke-grid.spec.ts`. */
export const FIRST_PAINT_TIMEOUT_MS = 15_000;

/**
 * Tải `/3d` + dựng cảnh của nó tốn bao lâu là cùng — cùng ngân sách
 * `VIEWER_READY_TIMEOUT_MS` của `viewer3d.spec.ts`.
 */
export const VIEWER_READY_TIMEOUT_MS = 20_000;

/**
 * Hạn của một ca dựng HAI cảnh 3D (`/3d` rồi màn đích). Hạn mặc định 30 s đỏ
 * khi máy chủ còn nguội và nhiều worktree cùng giành CPU (đo 2026-10-03: hai ca
 * đầu lượt quá hạn ở cú bấm, ca thứ ba cùng tệp xanh).
 */
export const TWO_SCENES_TEST_TIMEOUT_MS = 60_000;

/**
 * Mở `/3d` và chờ cảnh của nó dựng xong, rồi bỏ tour nếu đang hiện.
 *
 * Bấm lúc cảnh còn đang dựng là bấm vào một luồng chính đang bận. "Mô hình 3D đã
 * dựng xong." là câu `sr-only` của `Viewer3D.tsx`, chỉ có khi mọi tầng đã dựng.
 */
export async function openViewerSettled(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(ROUTES.project.viewer(PROJECT_ID));
  await expect(page.getByText('Mô hình 3D đã dựng xong.', { exact: true })).toBeAttached({
    timeout: VIEWER_READY_TIMEOUT_MS,
  });
  /* /3d: lớp hướng dẫn nạp ĐỘNG (`ViewerShell.container.tsx`, lazy) nên có thể hiện SAU khi
     cảnh dựng xong — đếm một lần không chờ là bấm trúng nền tối của nó. Chờ nút bỏ qua. */
  await dismissTourIfPresent(page);
}

/** Thanh trạng thái của nhà mẫu vỏ (`VIEWER_FIXTURE_SPATIAL`) — cùng bộ `/3d` hiện. */
export const FIXTURE_STATUS = '4 tầng · 14 phòng · 248,60 m²';

/** Bộ đệm mặc định của một `<canvas>` chưa ai vẽ vào. */
const UNDRAWN_BUFFER = '300x150';

/**
 * Chờ tới khi canvas của khung nhìn đã được cảnh 3D vẽ vào.
 *
 * Đọc thuộc tính `width/height` (bộ đệm), không `boundingBox`: CSS kéo canvas
 * ra cỡ khung ngay cả khi chưa ai vẽ (`plan.md` V9 0.4). "Mô hình đã dựng xong."
 * không đủ — câu ấy hiện cả khi kho rỗng.
 */
export async function expectSceneDrawn(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const canvas = document.querySelector('canvas');
          return canvas === null ? 'none' : `${canvas.width}x${canvas.height}`;
        }),
      { message: 'canvas vẫn là bộ đệm 300×150 — cảnh 3D chưa dựng', timeout: FIRST_PAINT_TIMEOUT_MS },
    )
    .not.toMatch(new RegExp(`^(none|${UNDRAWN_BUFFER})$`, 'u'));
}

/** Mở một màn ở 1440×900 rồi chờ thanh trạng thái của nhà mẫu. */
export async function openWithFixture(page: Page, path: string): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(path);
  await expect(page.getByText(FIXTURE_STATUS, { exact: true })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
}
