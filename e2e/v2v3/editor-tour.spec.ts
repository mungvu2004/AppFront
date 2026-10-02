import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';
import { seedSpatial } from '../fixtures/seedSpatial';

import { DESKTOP_VIEWPORT, VIEWER_PROJECT_ID, openViewer } from './viewer-helpers';

/**
 * EditorTour — lớp hướng dẫn phủ trên ba màn chủ: duyệt tường
 * (`/projects/project-1/floors/L1/layers/walls`), vỏ 3D (`/projects/project-1/3d`),
 * xuất (`/projects/project-1/export`). Kế hoạch: `docs/notes/e2e/plan.md` V2 MỤC 2,
 * trường 6 (a)–(e), 8, 10; phát hiện V2 số 1, 5, 10.
 *
 * ## Tour hiện lúc nào — đã đo, và nó khác nhau theo host
 *
 * - **Màn tường: tự hiện lúc tải** (sau bản sửa B-V2-01 — hook nghe sổ phím, nên
 *   lượt màn chủ đăng ký phím trong effect làm bốn bước sống lại). Bài đầu tiên
 *   khẳng định điều đó và KHÔNG có sự kiện cửa sổ nào.
 * - **Vỏ 3D và màn xuất (có bơm): cũng tự hiện**, ngay khi neo của bước xuất
 *   hiện trong trang. Bước duy nhất của mỗi host (`view3d`, `exportResult`) không
 *   có phím, chỉ có neo DOM; bản sửa đầu của B-V2-01 chỉ nghe sổ phím nên hai host
 *   này từng phải chờ một `resize` (đo: mô hình dựng xong + 8 s vẫn 0 thẻ, rồi thẻ
 *   bật lên ở cú bấm đầu tiên). Nay hook nghe cả neo vào/rời DOM.
 * - **Màn xuất không bơm: không có tour nào** kể cả sau khi đổi khung nhìn — neo
 *   `data-tour-anchor="exportResult"` chỉ có khi có thứ để xuất, nên 0 bước sống,
 *   trạng thái `empty`. Đó là luật sống sót của hook (bước không phím không neo
 *   biến mất lặng lẽ), không phải lỗi; không viết bài cho sự vắng mặt ấy.
 *
 * ## Bấm nền tối = bỏ qua tour (đo, không có bài riêng)
 *
 * Bấm thật bằng chuột vào (5, 450) khi thẻ bước 1 đang hiện ở màn tường:
 * `elementFromPoint` trúng tấm nền `bg-bg-overlay`, thẻ biến mất, chip
 * "xem hướng dẫn" hiện, khoá thành `'true'`. Đó là thiết kế (`handleSkip`,
 * `useEditorTour.ts`: "Esc và bấm ra nền đều BỎ QUA, không hỏi lại"), đơn vị đã
 * phủ ("bỏ qua: Esc + bấm nền + chip quay lại"). Hệ quả cho nhóm khác: cú bấm đầu
 * tiên trên màn chủ khi tour đang hiện KHÔNG tới đích.
 *
 * ## KHÔNG kiểm
 *
 * Nội dung bảy trạng thái, tách khoá theo host, không-`dialog`, vai `viewer`, dạng
 * thu gọn (< 1280 px): `EditorTour.test.tsx` (16 bài) phủ. Bước 5–6 trên màn tường:
 * neo ở màn khác, luật sống sót bỏ chúng (đếm là "trên 4"). KHÔNG đặt khoá
 * `appfront:system-editor-tour-seen:*` bằng `addInitScript` — đó là kiểm một sản
 * phẩm khác; mỗi bài chạy trong ngữ cảnh mới nên localStorage trống.
 */

const PROJECT_ID = VIEWER_PROJECT_ID;
const WALLS_PATH = ROUTES.project.walls(PROJECT_ID, 'L1');
const EXPORT_PATH = ROUTES.project.export(PROJECT_ID);

/** Lần tải đầu một route bắt Vite dịch nguội — tiền lệ `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

/**
 * Tour được bao lâu để tự hiện SAU KHI màn chủ đã vẽ. Màn tường đăng ký phím ngay
 * trong effect đầu, nên thẻ hiện trong cùng nhịp tải; 6 s là trần rộng cho một
 * máy đang chạy hai lượt e2e, không phải thời gian chờ mong đợi.
 */
const TOUR_SELF_APPEAR_TIMEOUT_MS = 6_000;

/** Khoá "đã xem" của một host — `useEditorTour.ts` (`userId` của bộ mẫu là `user-mock`). */
function seenKey(hostId: string): string {
  return `appfront:system-editor-tour-seen:user-mock:${hostId}`;
}

const WALL_STEPS = [
  'chọn công cụ ở ray bên trái',
  'đi dọc từng đoạn tường',
  'đặt lại độ dày cho đoạn đang chọn',
  'lùi lại khi lỡ tay',
] as const;

/** Thẻ của một bước: `<section aria-labelledby>` — vai `region`, KHÔNG phải `dialog`. */
function tourCard(page: Page, title: string) {
  return page.getByRole('region', { name: title, exact: true });
}

/** Câu `aria-live` của tour — `bước N trên M: <tiêu đề>`. */
function tourAnnouncement(page: Page, text: string) {
  return page.getByText(text, { exact: true });
}

/** Mọi thẻ tour đang hiện, nhận ra qua nút "bỏ qua" chỉ thẻ bước mới có. */
function anyTourSkip(page: Page) {
  return page.getByRole('region').getByRole('button', { name: /bỏ qua/ });
}

/**
 * Nới khung nhìn thêm 1 px và ĐỂ NGUYÊN — gọi một `resize`.
 *
 * Khác khuôn `nudge` của `e2e/fixtures/tour.ts` (nới rồi trả lại) có chủ ý: hook
 * nghe `resize` qua `useSyncExternalStore` với ảnh chụp `innerWidth:innerHeight…`.
 * Chromium gộp hai lượt đổi cỡ liền nhau vào một sự kiện, và nếu lúc ấy cỡ đã về
 * như cũ thì ảnh chụp không đổi, hook không vẽ lại, tour không hiện — đo được:
 * bài màn xuất đỏ 1/2 lượt với khuôn nới-rồi-trả.
 */
async function nudgeViewport(page: Page): Promise<void> {
  const size = page.viewportSize();
  if (size === null) throw new Error('khung nhìn chưa đặt cỡ');
  await page.setViewportSize({ width: size.width + 1, height: size.height });
}

async function readKey(page: Page, hostId: string): Promise<string | null> {
  return page.evaluate((key) => localStorage.getItem(key), seenKey(hostId));
}

/** Mở màn tường và chờ chính màn (không phải tour) đã vẽ. */
async function openWalls(page: Page): Promise<void> {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await page.goto(WALLS_PATH);
  await expect(page.getByRole('region', { name: 'Duyệt lớp tường' })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
}

/**
 * Sau tải lại, khẳng định tour KHÔNG hiện. Một khẳng định vắng mặt ngay sau tải
 * thì rỗng nghĩa, nên kích đủ mọi đường hook có thể render lại: màn chủ đã vẽ
 * (sổ phím đã đầy) VÀ một `resize`, rồi đợi một khung hình.
 */
async function expectNoTourAfterReload(page: Page): Promise<void> {
  await page.reload();
  await expect(page.getByRole('region', { name: 'Duyệt lớp tường' })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await nudgeViewport(page);
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => done())));
  await expect(anyTourSkip(page)).toHaveCount(0);
  await expect(tourCard(page, WALL_STEPS[0])).toHaveCount(0);
}

test('tour tự hiện khi người dùng lần đầu mở màn tường, không cần sự kiện cửa sổ nào (B-V2-01)', async ({
  page,
}) => {
  await openWalls(page);

  await expect(tourCard(page, WALL_STEPS[0])).toBeVisible({ timeout: TOUR_SELF_APPEAR_TIMEOUT_MS });
  await expect(tourAnnouncement(page, `bước 1 trên 4: ${WALL_STEPS[0]}`)).toBeAttached();
});

test('màn tường: đi hết bốn bước bằng "tiếp theo", thẻ tổng kết, "bắt đầu làm việc" ghi khoá đã xem và tải lại không hiện lại', async ({
  page,
}) => {
  await openWalls(page);

  for (const [index, title] of WALL_STEPS.entries()) {
    const card = tourCard(page, title);
    await expect(card).toBeVisible({ timeout: TOUR_SELF_APPEAR_TIMEOUT_MS });
    await expect(tourAnnouncement(page, `bước ${index + 1} trên 4: ${title}`)).toBeAttached();
    // Regex: chữ của nút lặp đôi trong `textContent` ("tiếp theotiếp theo").
    await card.getByRole('button', { name: /tiếp theo/ }).click();
  }

  const summary = tourCard(page, 'bấy nhiêu phím là đủ dùng');
  await expect(summary).toBeVisible();
  await summary.getByRole('button', { name: 'bắt đầu làm việc' }).click();

  await expect(summary).toHaveCount(0);
  expect(await readKey(page, 'wall-layer-review')).toBe('true');

  await expectNoTourAfterReload(page);
});

test('màn tường: Escape bỏ tour, chip "xem hướng dẫn" hiện, khoá ghi đã xem và tải lại không hiện lại (A12)', async ({
  page,
}) => {
  await openWalls(page);
  await expect(tourCard(page, WALL_STEPS[0])).toBeVisible({ timeout: TOUR_SELF_APPEAR_TIMEOUT_MS });

  await page.keyboard.press('Escape');

  await expect(tourCard(page, WALL_STEPS[0])).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'xem hướng dẫn' })).toBeVisible();
  expect(await readKey(page, 'wall-layer-review')).toBe('true');
  // Escape chỉ đóng tour: màn chủ vẫn còn, URL không đổi.
  await expect(page.getByRole('region', { name: 'Duyệt lớp tường' })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(WALLS_PATH);

  await expectNoTourAfterReload(page);
});

test('màn tường: bấm chip "xem hướng dẫn" sau khi bỏ qua mở lại tour từ bước đầu', async ({
  page,
}) => {
  await openWalls(page);
  const first = tourCard(page, WALL_STEPS[0]);
  await expect(first).toBeVisible({ timeout: TOUR_SELF_APPEAR_TIMEOUT_MS });

  // Sang bước 2 trước, để "từ bước đầu" là một khẳng định chứ không phải trùng hợp.
  await first.getByRole('button', { name: /tiếp theo/ }).click();
  await expect(tourCard(page, WALL_STEPS[1])).toBeVisible();

  await page.keyboard.press('Escape');
  const chip = page.getByRole('button', { name: 'xem hướng dẫn' });
  await expect(chip).toBeVisible();

  await chip.click();

  await expect(first).toBeVisible();
  await expect(tourAnnouncement(page, `bước 1 trên 4: ${WALL_STEPS[0]}`)).toBeAttached();
  await expect(chip).toHaveCount(0);
});

test('màn xuất có bơm bộ mẫu: nút xuất vừa có là tour tự hiện đúng một bước "lấy tệp mang đi", không cần sự kiện cửa sổ', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await page.goto(EXPORT_PATH);
  // Kho rỗng: màn nói "chưa có gì được duyệt để xuất" (mốc của `smoke-grid`).
  await expect(page.getByRole('heading', { name: 'chưa có gì được duyệt để xuất' })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });

  await seedSpatial(page);
  // Nút "xuất" mang neo `data-tour-anchor="exportResult"` và chỉ có khi có thứ để
  // xuất — neo vào trang là đủ để bước sống lại (B-V2-01).
  await expect(page.getByRole('button', { name: 'xuất', exact: true })).toBeVisible();

  await expect(tourCard(page, 'lấy tệp mang đi')).toBeVisible({
    timeout: TOUR_SELF_APPEAR_TIMEOUT_MS,
  });
  await expect(tourAnnouncement(page, 'bước 1 trên 1: lấy tệp mang đi')).toBeAttached();
});

/*
 * B-V2-01, phần của vỏ 3D (đã sửa): bước `view3d` chỉ có neo DOM, và trước bản sửa
 * thẻ không hiện cho tới một `resize` hoặc cú bấm đầu tiên — tức bật lên GIỮA lúc
 * người dùng đang làm việc khác. Đã kiểm đỏ trên mã chưa nghe DOM.
 */
test('vỏ 3D: tour tự hiện đúng một bước "đổi sang khung nhìn khối" khi người dùng lần đầu mở, không cần sự kiện cửa sổ nào', async ({
  page,
}) => {
  await openViewer(page);

  await expect(tourCard(page, 'đổi sang khung nhìn khối')).toBeVisible({
    timeout: TOUR_SELF_APPEAR_TIMEOUT_MS,
  });
  await expect(tourAnnouncement(page, 'bước 1 trên 1: đổi sang khung nhìn khối')).toBeAttached();
});
