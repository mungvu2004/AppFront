import { expect, test } from '@playwright/test';

import { ROUTE_PATTERNS } from '../fixtures/routes';

import { FIRST_PAINT_TIMEOUT_MS, PROJECT_ID, openWithFixture } from './v9';

test.skip(true, 'Viewer3D cũ không còn route từ 29eba219: /3d chuyển cả trang sang editor3d.html — tách tầng trên trang Pascal (nút Cách xếp tầng) kiểm ở pascal-tools.spec.ts.');

/**
 * Tách tầng (`plan.md` V9 mục 1) — nay là chế độ của Pascal: `/3d?view=exploded`
 * (F-15 W2-C2). Màn `ExplodedView` cũ đã xoá, nên bài chỉ kiểm khung Pascal có mặt
 * và đường dẫn giữ `view=exploded`. Các điều kiện chi tiết nằm ở test đơn vị.
 */

const EXPLODED_VIEW_PATH = `${ROUTE_PATTERNS.projectViewer.replace(':projectId', PROJECT_ID)}?view=exploded`;

test('tách tầng: /3d?view=exploded dựng khung Pascal và giữ tham số view', async ({ page }) => {
  await openWithFixture(page, EXPLODED_VIEW_PATH);

  await expect(page.locator('[data-testid="pascal-canvas"]')).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  await expect(page).toHaveURL(/[?&]view=exploded(&|$)/u);
});
