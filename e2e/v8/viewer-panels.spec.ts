import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { seedSpatial } from '../fixtures/seedSpatial';
import {
  VIEWER_PROJECT_ID,
  dismissTourIfPresent,
  openViewer,
  selectRoomBySearch,
  waitForViewerReady,
} from './viewer';

/**
 * Nhóm V8 — ba bảng phụ của màn 3D: Diện tích phòng, Lịch sử thao tác, Thư viện đồ
 * đạc (`plan.md` nhóm V8, mục 4–6). Mở/Esc đơn lẻ đã ở `e2e/viewer3d.spec.ts`.
 */

/** Bấm nút bật một bảng phụ; tour hiện trên cái vừa mở nên đóng nó SAU cú bấm. */
async function openPanel(page: Page, label: string): Promise<void> {
  await page.getByRole('button', { name: label, exact: true }).click();
  await dismissTourIfPresent(page);
}

/** Trần chờ một bảng đọc kho ra kết quả, khi kho có dữ liệu thì nó tính ngay. */
const PANEL_SETTLE_TIMEOUT_MS = 8_000;

/* -------------------------------------------------------------------------- */
/* Diện tích phòng.                                                            */
/* -------------------------------------------------------------------------- */

/*
 * B-V8-04 (đã sửa) — ca mồi Q1 của /3d: KHÔNG bơm. Trước bản sửa, panel đọc một kho
 * không ai nạp và kẹt "Đang tính diện tích…" (`aria-busy`) mãi. Nay cổng nạp kho của
 * route nạp dự án; mock trả bốn tầng chưa có phòng nên bảng nói ra trạng thái của nó
 * (heading) thay vì đang tải mãi.
 */
test('chưa bơm kho: bảng diện tích không kẹt "đang tính" — cổng nạp kho xong thì bảng nói ra trạng thái của nó (B-V8-04)', async ({
  page,
}) => {
  await openViewer(page);
  await openPanel(page, 'Diện tích phòng');

  const panel = page.getByRole('region', { name: 'Bảng diện tích phòng' });
  await expect(panel).toBeVisible();
  await expect(panel.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: PANEL_SETTLE_TIMEOUT_MS });
  await expect(
    panel.getByRole('heading').or(panel.getByText('Tổng diện tích sàn toàn nhà', { exact: false })).first(),
  ).toBeVisible();
});

/*
 * Hai bài dưới cần một PHÒNG trong kho nạp thật: mock nạp bốn tầng chưa có hình, và nhà
 * mẫu chỉ vào vỏ + cảnh, không vào kho (`shouldUseViewerFixture`, B-V8-10).
 * Mở lại khi: kho được nạp (không bơm) có ít nhất một phòng — mock N16 trả hình cho dự án.
 */
test.fixme('chưa bơm kho: bảng diện tích vẫn ra tổng diện tích sàn (B-V8-04 · chờ kho nạp có phòng)', async ({ page }) => {
  await openViewer(page);
  await openPanel(page, 'Diện tích phòng');

  const panel = page.getByRole('region', { name: 'Bảng diện tích phòng' });
  await expect(panel.getByText(/Tổng diện tích sàn toàn nhà — \d+ phòng/u)).toBeVisible({
    timeout: PANEL_SETTLE_TIMEOUT_MS,
  });
});

/* Nửa panel thuộc tính — cùng điều kiện mở lại. */
test.fixme('chưa bơm kho: chọn một phòng thì panel thuộc tính ra thuộc tính, không kẹt "Đang tải" (B-V8-04 · chờ kho nạp có phòng)', async ({
  page,
}) => {
  await openViewer(page);
  await selectRoomBySearch(page, 'phong ngu 4', 'Phòng ngủ 4');

  const properties = page.getByRole('region', { name: 'Thuộc tính đối tượng', exact: true });
  await expect(properties).toBeVisible();
  /* Đòi heading "Phòng" (B-V8-10): từ B-V8-42 panel nói "không có trong dữ liệu của dự
     án" khi phòng chưa vào kho — bài ngay dưới giữ ca ấy và loại trừ bài này; mở bài
     này thì xoá bài dưới. */
  await expect(properties.getByRole('heading', { name: 'Phòng', exact: true })).toBeVisible({
    timeout: PANEL_SETTLE_TIMEOUT_MS,
  });
  await expect(properties.getByText('Đang tải thuộc tính…')).toHaveCount(0);
  await expect(properties.getByText(/^Chưa chọn đối tượng nào/u)).toHaveCount(0);
});

/*
 * B-V8-42 — phòng của nhà mẫu không có trong kho, và panel từng nói "Chưa chọn đối tượng
 * nào" dù vừa chọn nó. Loại trừ bài fixme ngay trên (`viewerShellGateway.ts`): mock N16
 * trả hình thật thì bài này đỏ — xoá nó và mở bài trên.
 */
test('chưa bơm kho: chọn phòng của nhà mẫu thì panel nói nó không có trong dữ liệu dự án, không nói "chưa chọn" (B-V8-42)', async ({
  page,
}) => {
  await openViewer(page);
  await selectRoomBySearch(page, 'phong ngu 4', 'Phòng ngủ 4');

  const properties = page.getByRole('region', { name: 'Thuộc tính đối tượng', exact: true });
  await expect(
    properties.getByText(
      'Đối tượng đang chọn không có trong dữ liệu của dự án này nên chưa xem được thuộc tính.',
      { exact: true },
    ),
  ).toBeVisible({ timeout: PANEL_SETTLE_TIMEOUT_MS });
  await expect(properties.getByText(/^Chưa chọn đối tượng nào/u)).toHaveCount(0);
  await expect(properties.getByText('Đang tải thuộc tính…')).toHaveCount(0);
  await expect(properties.getByRole('heading', { name: 'Phòng', exact: true })).toHaveCount(0);
});

/*
 * BƠM KHO (Q1 = A′) — bài tích hợp bằng `seedSpatial`, chạm nội bộ dev: nó KHÔNG
 * chứng minh dữ liệu tải từ máy chủ, chỉ chứng minh panel tính và in đúng khi kho có
 * đồ thị. Ca mồi không bơm ở đầu tệp (B-V8-04).
 *
 * Bơm thì cả màn đổi sang `createSampleBuilding()` (tên tầng `Level N`). Từ B-V8-10
 * đường bao của bộ mẫu đo đúng số nó khai, nên tổng hình học là 248,60 (trước đó 238,00);
 * bài ghim hình dạng số, không ghim con số ấy.
 */
test('BƠM KHO: bảng diện tích ra tổng, đủ 14 phòng, bốn tầng, số có dấu phẩy thập phân (A15)', async ({
  page,
}) => {
  await openViewer(page);
  await seedSpatial(page, { projectId: VIEWER_PROJECT_ID });
  /* Kho đổi thì màn dựng lại, và lớp hướng dẫn có thể hiện ngay sau đó. */
  await dismissTourIfPresent(page);
  await openPanel(page, 'Diện tích phòng');

  const panel = page.getByRole('region', { name: 'Bảng diện tích phòng' });
  await expect(panel.getByText('Tổng diện tích sàn toàn nhà — 14 phòng', { exact: true })).toBeVisible();
  await expect(panel.getByLabel('Đang tính diện tích…')).toHaveCount(0);
  await expect(panel.getByText(/^\d+ phòng · \d+,\d{2} m²$/u)).toHaveCount(4);
});

/*
 * B-V8-12 — kho đổi thì `useViewer3D` dựng lại cảnh trên CÙNG canvas; lượt dọn cũ
 * đã ép mất ngữ cảnh WebGL của canvas ấy, nên lượt dựng mới báo "Trình duyệt này
 * chưa xem được mô hình 3D". Bơm kho là cách rẻ nhất làm kho đổi từ giao diện dev;
 * cùng đường ấy chạy khi sửa hình học ghi vào kho, hay bấm "Thử lại".
 */
test('BƠM KHO: kho đổi thì cảnh 3D dựng lại được trên cùng khung nhìn (B-V8-12)', async ({ page }) => {
  await openViewer(page);
  await seedSpatial(page, { projectId: VIEWER_PROJECT_ID });

  /* Vỏ thôi dùng bộ mẫu của nó (tên "Tầng trệt") khi kho có đồ thị — mốc dương cho
     "lượt dựng lại đã bắt đầu", không ghim con số nào của bộ mẫu chuẩn. */
  await expect(page.getByRole('option', { name: /^Tầng trệt, cao độ/u })).toHaveCount(0);
  await waitForViewerReady(page);
});

/* -------------------------------------------------------------------------- */
/* Lịch sử thao tác.                                                           */
/* -------------------------------------------------------------------------- */

test('lịch sử mở ra ca rỗng thật: lời giải thích, bốn chip loại việc, lọc người thực hiện', async ({
  page,
}) => {
  await openViewer(page);
  await openPanel(page, 'Lịch sử thao tác');

  const history = page.getByRole('region', { name: 'Lịch sử chỉnh sửa' });
  await expect(history.getByText('Chưa có bước nào', { exact: true })).toBeVisible();
  await expect(
    history.getByText(
      'Mọi thay đổi bạn làm trên mô hình sẽ hiện ở đây theo thứ tự thời gian, và bước nào cũng quay lại được.',
    ),
  ).toBeVisible();

  /* A6 · B-V8-07: "AI" là viết tắt, giữ hoa */
  const chips = history.getByRole('group', { name: 'Lọc theo loại việc' }).getByRole('button');
  await expect(chips).toHaveText(['Tất cả', 'Chỉnh sửa', 'Duyệt', 'AI']);
  await expect(chips.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(history.getByRole('combobox')).toContainText('Mọi người');
});

/* -------------------------------------------------------------------------- */
/* Thư viện đồ đạc.                                                            */
/* -------------------------------------------------------------------------- */

const FURNITURE_GROUPS = [
  'Tất cả',
  'Bàn',
  'Ghế',
  'Giường',
  'Sofa',
  'Tủ kệ',
  'Thiết bị vệ sinh',
  'Bếp',
  'Thiết bị kỹ thuật',
  'Của tôi',
];

test('thư viện đồ đạc: đủ mười nhóm, ô tìm thu hẹp lưới, lọc nhóm Sofa, dung lượng có dấu phẩy thập phân (A15)', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openViewer(page);
  await openPanel(page, 'Thư viện đồ đạc');

  const library = page.getByRole('region', { name: 'Thư viện nội thất' });
  const groups = library.getByRole('group', { name: 'Nhóm nội thất' }).getByRole('button');
  const cards = library.getByRole('list', { name: 'Lưới mô hình nội thất' }).getByRole('listitem');

  await expect(groups).toHaveText(FURNITURE_GROUPS);
  const total = await cards.count();
  expect(total).toBeGreaterThan(2);
  /* "402,3 KB": phẩy ở vị trí thập phân; "1.800 × 900" dùng chấm nghìn, không bắt. */
  await expect(cards.first()).toContainText(/\d,\d KB/u);

  await library.getByLabel('Tìm mô hình nội thất').fill('bàn ăn');
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText('bàn ăn sáu chỗ');

  await library.getByLabel('Tìm mô hình nội thất').fill('');
  await expect(cards).toHaveCount(total);

  await groups.filter({ hasText: /^Sofa$/u }).click();
  await expect(groups.filter({ hasText: /^Sofa$/u })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => cards.count()).toBeLessThan(total);
  for (const text of await cards.allInnerTexts()) {
    expect(text).toMatch(/^sô pha/u);
  }
});

/*
 * B-V8-03 — đã sửa nửa câu chữ: "vai chỉ xem" nay đi theo `can('edit', 'layer')`,
 * không theo quyền tải lên. Thẻ VẪN khoá với mọi vai (câu "Chỉ xem được, không kéo
 * vào bản vẽ." vẫn hiện) vì màn 3D chưa có đích thả — nửa đó là B-V8-04, bài fixme
 * cuối nhóm này.
 */
test('admin mở thư viện đồ đạc thì không bị báo "vai chỉ xem" (B-V8-03)', async ({ page }) => {
  await openViewer(page, 'admin');
  await openPanel(page, 'Thư viện đồ đạc');

  const library = page.getByRole('region', { name: 'Thư viện nội thất' });
  await expect(library.getByRole('list', { name: 'Lưới mô hình nội thất' })).toBeVisible();
  await expect(library.getByText(/vai chỉ xem/u)).toHaveCount(0);
});

test('người xem mở thư viện đồ đạc thì được báo "vai chỉ xem" (B-V8-03)', async ({ page }) => {
  await openViewer(page, 'viewer');
  await openPanel(page, 'Thư viện đồ đạc');

  const library = page.getByRole('region', { name: 'Thư viện nội thất' });
  await expect(library.getByRole('list', { name: 'Lưới mô hình nội thất' })).toBeVisible();
  await expect(library.getByText(/vai chỉ xem/u)).toBeVisible();
});

/*
 * B-V8-46 (đã sửa) — dưới 1024 px thư viện thành tấm trượt đáy (`collapsed`), và nhánh
 * ấy từng đi trước nhánh quyền nên câu "vai chỉ xem" biến mất. Bề rộng chọn hình dạng,
 * quyền vẫn mang câu nói.
 */
test('người xem ở khung nhìn hẹp (< 1024 px) vẫn được báo "vai chỉ xem" (B-V8-46)', async ({ page }) => {
  await openViewer(page, 'viewer');
  await page.setViewportSize({ width: 900, height: 900 });
  await dismissTourIfPresent(page);
  await openPanel(page, 'Thư viện đồ đạc');

  const library = page.getByRole('region', { name: 'Thư viện nội thất' });
  await expect(library).toHaveCSS('position', 'fixed');
  await expect(library.getByRole('list', { name: 'Lưới mô hình nội thất' })).toBeVisible();
  await expect(library.getByText(/vai chỉ xem/u)).toBeVisible();
});

/*
 * B-V8-03 (nửa kéo-thả) chờ B-V8-04 — `Viewer3DPanels` chưa có đích thả nên
 * `canDrag` khoá cứng `false` (`useFurnitureLibraryPanel.ts`, chú thích `ponytail:`).
 * Mở lại khi: màn 3D nối đường thả và `canDrag = options.canPlaceModel` — đổi
 * `test.fixme` thành `test`.
 */
test.fixme('kỹ sư kéo được thẻ đồ đạc vào khung nhìn (B-V8-03 · chờ B-V8-04)', async ({ page }) => {
  await openViewer(page, 'engineer');
  await openPanel(page, 'Thư viện đồ đạc');

  const library = page.getByRole('region', { name: 'Thư viện nội thất' });
  const card = library.getByRole('list', { name: 'Lưới mô hình nội thất' }).getByRole('button').first();
  await expect(card).toHaveAttribute('draggable', 'true');
  await expect(library.getByText('Chỉ xem được, không kéo vào bản vẽ.')).toHaveCount(0);
});
