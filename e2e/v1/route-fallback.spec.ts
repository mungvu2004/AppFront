import { expect, test } from '@playwright/test';

import { fixtureF0 } from '../../src/lib/pascal/__fixtures__';
import { installFakeApi, type WireGraphDocument } from '../fixtures/fakeApi';
import { ROUTES, UNKNOWN_PATH, pathOf } from '../fixtures/routes';

/**
 * Vỏ chờ lúc chunk của màn kế tiếp còn trên đường (B-G-04).
 *
 * Trên mạng chậm người dùng nhìn đúng vỏ này — từng là chữ tiếng Anh `Loading...`
 * ở góc một màn trống (A6, A11). Bài giữ chunk lại bằng một cổng tự mở, không bằng
 * một khoảng chờ: thấy vỏ chờ → mở cổng → thấy màn.
 *
 * Cổng giữ MỌI lượt xin script sau khi màn đầu đã dựng xong, không neo vào đường tệp
 * của chunk: máy chủ dev phục vụ `/src/...`, bản dựng phục vụ `/assets/<băm>`, và
 * lượt chuyển màn này cần cả module của màn lẫn phụ thuộc của nó. Lượt chuyển màn
 * PHẢI xin ít nhất một script — nếu không, bài đỏ ở chỗ chờ vỏ, không xanh giả.
 */

/** Lần tải đầu của một route bắt Vite dịch nguội; cùng hạn `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

const PENDING_LABEL = 'Đang tải màn hình';

test('chuyển sang màn chưa tải: vỏ chờ tiếng Việt, không có "Loading...", rồi màn hiện ra', async ({
  page,
}) => {
  await page.goto(UNKNOWN_PATH);
  const toDashboard = page.getByRole('button', { name: 'Về danh sách dự án', exact: true });
  await expect(toDashboard).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });

  let release: () => void = () => undefined;
  const gate = new Promise<void>((open) => {
    release = open;
  });
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() === 'script') await gate;
    await route.continue();
  });

  await toDashboard.click();

  await expect(page.getByRole('status', { name: PENDING_LABEL, exact: true })).toBeVisible();
  await expect(page.getByText('Loading...', { exact: true })).toHaveCount(0);

  release();

  await expect(page.getByRole('heading', { name: 'Chọn dự án để làm tiếp', exact: true })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await expect(page.getByRole('status', { name: PENDING_LABEL, exact: true })).toHaveCount(0);
  expect(pathOf(page.url())).toBe(ROUTES.dashboard);
});

/*
 * B-V1-43 — dự án không có (hoặc người dùng không phải thành viên) trên route bọc
 * `ProjectSpatialGate`: từng kẹt ở khung "không tìm thấy" không nút, không lối ra.
 * `project-missing` là id mà bộ mẫu API trả 404 `resource: 'project'`.
 *
 * `/3d` không còn bọc cổng này (điều hướng sang editor3d.html từ 29eba219), nên bài
 * cổng dùng màn xuất — cũng bọc `ProjectSpatialGate` — còn `/3d` có bài riêng bên dưới.
 */
test('B-V1-43: mở dự án không có ở màn xuất thì có câu và nút về danh sách dự án', async ({ page }) => {
  await page.goto(ROUTES.project.export('project-missing'));

  await expect(page.getByRole('heading', { name: 'Không tìm thấy dự án này', exact: true })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });

  await page.getByRole('button', { name: 'Về danh sách dự án', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Chọn dự án để làm tiếp', exact: true })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  expect(pathOf(page.url())).toBe(ROUTES.dashboard);
});

/*
 * B-V1-43 ở trang 3D riêng: trang Pascal gọi HTTP thật, nên máy chủ giả `installFakeApi`
 * chỉ biết một dự án khác và trả 404 `resource: 'project'` cho `project-missing`. Trang nói
 * câu `BRIDGE_NOT_FOUND_ERROR` (`src/pascal-page/bridge/index.ts`) kèm lối ra "Về dự án"
 * (`resolveBackHref`: không có `returnTo` hay đường đã ghi thì về Quản lý tầng), và lối ấy
 * đưa người dùng trở lại ứng dụng, không kẹt ở trang 3D.
 *
 * Không đi tiếp tới "Về danh sách dự án": bộ mẫu dev trả tầng mặc định cho mọi mã dự án,
 * nên Quản lý tầng của `project-missing` không rơi vào cổng 404 như máy chủ thật.
 */
test('B-V1-43: mở dự án không có ở /3d thì trang 3D có câu và lối "Về dự án" quay lại ứng dụng', async ({
  page,
}) => {
  await installFakeApi(page, { projectId: 'P-FIXTURE0001', graphDoc: fixtureF0().doc as unknown as WireGraphDocument });
  await page.goto(ROUTES.project.viewer('project-missing'));

  await expect(page.getByText('Không tìm thấy dự án này, hoặc bạn chưa được thêm vào dự án.', { exact: true })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  expect(new URL(page.url()).pathname).toBe('/editor3d.html');

  await page.unrouteAll();
  await page.getByRole('link', { name: 'Về dự án', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Duyệt từng tầng', exact: true })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  expect(pathOf(page.url())).toBe(ROUTES.project.floors('project-missing'));
});
