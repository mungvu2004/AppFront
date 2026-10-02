import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { seedSpatial } from '../fixtures/seedSpatial';
import {
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

test('bảng diện tích mở ra có vùng tên rõ và nói ra trạng thái của nó, không trắng (chưa bơm kho)', async ({
  page,
}) => {
  await openViewer(page);
  await openPanel(page, 'Diện tích phòng');

  const panel = page.getByRole('region', { name: 'Bảng diện tích phòng' });
  await expect(panel).toBeVisible();
  /* Hoặc đang tính (hôm nay), hoặc đã có tổng (khi B-V8-04 được chữa): cả hai đều
     là một trạng thái nói ra được, không phải một khung rỗng. */
  await expect(
    panel.getByLabel('Đang tính diện tích…').or(panel.getByText('Tổng diện tích sàn toàn nhà', { exact: false })),
  ).toHaveCount(1);
});

/*
 * B-V8-04 — panel đọc `store.spatial`, mà màn 3D chỉ tiêm bộ mẫu vào vỏ + cảnh,
 * không vào kho: bảng kẹt "Đang tính diện tích…" mãi.
 * Mở lại khi: `projectViewer` có đường nạp kho thật (Q1 của `questions.md`) — lúc ấy
 * đổi `test.fixme` thành `test`.
 */
test.fixme('chưa bơm kho: bảng diện tích vẫn ra tổng diện tích sàn (B-V8-04)', async ({ page }) => {
  await openViewer(page);
  await openPanel(page, 'Diện tích phòng');

  const panel = page.getByRole('region', { name: 'Bảng diện tích phòng' });
  await expect(panel.getByText(/Tổng diện tích sàn toàn nhà — \d+ phòng/u)).toBeVisible({
    timeout: PANEL_SETTLE_TIMEOUT_MS,
  });
});

/* B-V8-04, nửa panel thuộc tính — cùng gốc, cùng điều kiện mở lại. */
test.fixme('chưa bơm kho: chọn một phòng thì panel thuộc tính ra thuộc tính, không kẹt "Đang tải" (B-V8-04)', async ({
  page,
}) => {
  await openViewer(page);
  await selectRoomBySearch(page, 'phong ngu 4', 'Phòng ngủ 4');

  const properties = page.getByRole('region', { name: 'Thuộc tính đối tượng', exact: true });
  await expect(properties).toBeVisible();
  await expect(properties.getByText('Đang tải thuộc tính…')).toHaveCount(0, {
    timeout: PANEL_SETTLE_TIMEOUT_MS,
  });
});

/*
 * BƠM KHO (Q1 = A′) — bài tích hợp bằng `seedSpatial`, chạm nội bộ dev: nó KHÔNG
 * chứng minh dữ liệu tải từ máy chủ, chỉ chứng minh panel tính và in đúng khi kho có
 * đồ thị. Ca mồi không bơm là hai bài ngay trên.
 *
 * Bơm thì cả màn đổi sang `createSampleBuilding()` (tên tầng `Level N`), và tổng là
 * số đo HÌNH HỌC 238,00 chứ không phải 248,60 khai tay — đúng chỗ lệch A14 của
 * `CLAUDE.md`. Bài không ghim con số ấy (chưa chốt, B-V8-10); nó ghim hình dạng.
 */
test('BƠM KHO: bảng diện tích ra tổng, đủ 14 phòng, bốn tầng, số có dấu phẩy thập phân (A15)', async ({
  page,
}) => {
  await openViewer(page);
  await seedSpatial(page);
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
  await seedSpatial(page);

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

  const chips = history.getByRole('group', { name: 'Lọc theo loại việc' }).getByRole('button');
  await expect(chips).toHaveText(['tất cả', 'chỉnh sửa', 'duyệt', 'AI']);
  await expect(chips.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(history.getByRole('combobox')).toContainText('mọi người');
});

/*
 * B-V8-07 — chip "AI" viết hoa; A6 chỉ miễn mã trục, mã lỗi, tên phím. Người duyệt
 * có thể coi "AI" là viết tắt được miễn (thêm vào CLAUDE.md) thay vì sửa chữ.
 * Mở lại khi: người duyệt chọn "viết thường" — đổi `test.fixme` thành `test`.
 */
test.fixme('chip lọc lịch sử viết thường kiểu câu, kể cả chip "ai" (A6 · B-V8-07)', async ({ page }) => {
  await openViewer(page);
  await openPanel(page, 'Lịch sử thao tác');

  const chips = page
    .getByRole('group', { name: 'Lọc theo loại việc' })
    .getByRole('button');
  /* Chờ đủ bốn chip trước: `allInnerTexts` không chờ, và bảng nạp lười. */
  await expect(chips).toHaveCount(4);
  for (const text of await chips.allInnerTexts()) {
    expect(text).toBe(text.toLocaleLowerCase('vi'));
  }
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
 * B-V8-03 — kéo-thả bị khoá với MỌI vai, kể cả admin, và câu khoá nói sai lý do
 * ("vai chỉ xem"): `canDrag = canUploadModel` (`useFurnitureLibraryPanel.ts:302`) mà
 * `Viewer3DPanels.tsx` không truyền `onUploadModel`.
 * Mở lại khi: người duyệt chốt quyền "đặt mô hình" tách khỏi quyền "tải lên" và màn
 * 3D nối đường thả — đổi `test.fixme` thành `test`.
 */
test.fixme('admin mở thư viện đồ đạc thì không bị báo "vai chỉ xem", thẻ kéo được (B-V8-03)', async ({
  page,
}) => {
  await openViewer(page, 'admin');
  await openPanel(page, 'Thư viện đồ đạc');

  const library = page.getByRole('region', { name: 'Thư viện nội thất' });
  await expect(library.getByRole('list', { name: 'Lưới mô hình nội thất' })).toBeVisible();
  await expect(library.getByText(/vai chỉ xem/u)).toHaveCount(0);
  await expect(library.getByText('Chỉ xem được, không kéo vào bản vẽ.')).toHaveCount(0);
});
