import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { RETRY_SCHEDULE_MS } from '../../src/lib/autosave/retrySchedule';
import { ROUTES } from '../fixtures/routes';
import { seedSpatial } from '../fixtures/seedSpatial';
import { dismissTourIfShown } from '../fixtures/tour';

import { QCB_FLOOR, QCB_PROJECT, seedQcb } from './seedQcb';

/**
 * Nhóm V7 — `projectRooms` "Duyệt tên phòng" (`plan.md` V7 mục 1).
 *
 * Màn đọc đồ thị từ `store.spatial` và không nơi nào nạp nó từ mạng (B-V6-01), nên
 * mọi ca có nội dung đi qua `seedQcb` — tên bài nói ra điều đó. Ca mồi đầu tiên
 * KHÔNG bơm: nó ghim chuỗi người dùng thấy hôm nay, và đỏ đúng ngày sản phẩm có
 * đường nạp thật (`plan.md` 6.1).
 *
 * Bộ mẫu là bộ riêng của màn (14 phòng, 248,60 m²), không phải `createSampleBuilding()`
 * của A14 — mọi con số dưới đây là số của bộ ấy (`roomLabelFixture.ts`).
 *
 * Đơn vị (30 bài) đã phủ: bảy trạng thái, diện tích, chuẩn hoá tên, vé hoàn tác của
 * chuẩn hoá, vai Người xem. Ở đây chỉ đi những gì trình duyệt thật mới chứng minh.
 */

/** Lần tải đầu của một route bắt Vite dịch nguội; tiền lệ `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

/**
 * Câu tự lưu thất bại, đọc từ CHÍNH từ điển (`vi.json` `autosave.failed`) — Node của
 * Playwright không nhập được `.json` khi thiếu `with { type: 'json' }`, nên đọc tệp.
 * Đường tương đối theo gốc repo: Playwright chạy từ đó.
 */
const AUTOSAVE_FAILED = (
  JSON.parse(readFileSync('src/i18n/vi.json', 'utf8')) as { autosave: { failed: string } }
).autosave.failed;

const ROOM_COUNT = 14;
const FIRST_ROOM = { code: '#R-001', name: 'phòng khách chung' } as const;
const NEW_NAME = 'Phòng thử e2e';

function roomList(page: Page) {
  return page.getByRole('listbox', { name: 'Danh sách phòng' });
}

function roomOptions(page: Page) {
  return roomList(page).getByRole('option');
}

function toast(page: Page) {
  return page.getByRole('region', { name: 'Thông báo' });
}

/** `getByLabel('Tên phòng')` khớp 6 phần tử (đo) — bám vai trò. */
function nameField(page: Page) {
  return page.getByRole('textbox', { name: 'Tên phòng' });
}

async function open(page: Page): Promise<void> {
  await page.goto(ROUTES.project.rooms(QCB_PROJECT, QCB_FLOOR.rooms));
  await expect(page.getByRole('heading', { name: 'duyệt tên phòng' })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
}

async function openSeeded(page: Page): Promise<void> {
  await open(page);
  await seedQcb(page, 'rooms');
  await expect(roomOptions(page)).toHaveCount(ROOM_COUNT);
}

/** Chọn phòng đầu, đổi tên, Enter — đường ghi thật của người duyệt. */
async function renameFirstRoom(page: Page): Promise<void> {
  await roomOptions(page).filter({ hasText: FIRST_ROOM.code }).click();
  await nameField(page).fill(NEW_NAME);
  await nameField(page).press('Enter');
  await expect(roomOptions(page).filter({ hasText: FIRST_ROOM.code })).toContainText(NEW_NAME);
}

test('ca mồi, KHÔNG bơm: mở thẳng thì màn nói thật "chưa dò ra phòng nào" — đỏ ngày có đường nạp thật, khi ấy xoá seedQcb (V7-ROOMS-01)', async ({
  page,
}) => {
  await open(page);

  await expect(page.getByRole('heading', { name: 'chưa dò ra phòng nào' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kiểm tra lại vòng hở' })).toBeVisible();
  /* Câu hướng dẫn gọi đúng tên nút người dùng thấy (B-V7-10). */
  await expect(page.getByText('rồi bấm "Kiểm tra lại vòng hở" để dò lại')).toBeVisible();
  await expect(roomList(page)).toHaveCount(0);
});

test('bơm bộ mẫu: 14 phòng, tổng 248,60 m², ba phòng chưa đặt tên, số thập phân dùng dấu phẩy (V7-ROOMS-02, A15)', async ({
  page,
}) => {
  await openSeeded(page);

  await expect(page.getByText('248,60 m²')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chưa đặt tên 3' })).toBeVisible();
  await expect(roomOptions(page).filter({ hasText: '#R-005' })).toHaveAccessibleName(
    '#R-005 · PHÒNG NGỦ 1 · 18,40 m² · AI đề xuất, chưa duyệt',
  );

  /* A15 trên danh sách: không một số thập phân nào dùng dấu chấm. */
  const listText = await roomList(page).innerText();
  expect(listText).toMatch(/\d,\d{2} m²/u);
  expect(listText).not.toMatch(/\d\.\d/u);
});

test('bơm bộ mẫu: đổi tên phòng có toast hoàn tác, bấm hoàn tác thì tên về cũ (V7-ROOMS-03, A8)', async ({
  page,
}) => {
  await openSeeded(page);

  await renameFirstRoom(page);
  await expect(toast(page)).toContainText(`thành "${NEW_NAME}", diện tích 17,00 m².`);

  await toast(page).getByRole('button', { name: 'Hoàn tác' }).click();

  await expect(roomOptions(page).filter({ hasText: FIRST_ROOM.code })).toContainText(FIRST_ROOM.name);
});

/**
 * QA/B-2 — cùng việc đổi tên phòng, cửa thứ hai: bảng "Diện tích phòng" của màn 3D
 * (`RoomAreaPanel`) ghi thật qua tầng lệnh, nên ô A8 của nó cần một khẳng định. Tách
 * thành bài riêng chỉ vì ngân sách 30 s/bài: dựng màn 3D tốn phần lớn ngân sách ấy.
 * Màn 3D đọc kho chung nên bơm bằng bộ mẫu chuẩn A14 (`seedSpatial`), không phải bộ
 * mẫu riêng của màn phòng — "Room 0" là tên dữ liệu của bộ ấy.
 */
const VIEWER_READY_TIMEOUT_MS = 20_000; // cùng ngân sách `viewer3d.spec.ts`: tải route + dựng cảnh

test('bơm bộ mẫu chuẩn: đổi tên phòng từ bảng diện tích của màn 3D cũng có toast hoàn tác (V7-ROOMS-03, QA/B-2, A8)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(ROUTES.project.viewer(QCB_PROJECT));
  await expect(page.getByText('Mô hình 3D đã dựng xong.')).toBeAttached({ timeout: VIEWER_READY_TIMEOUT_MS });
  await seedSpatial(page);
  await dismissTourIfShown(page);

  const toggle = page.getByRole('button', { name: 'Diện tích phòng', exact: true });
  await toggle.click();
  await dismissTourIfShown(page);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');

  const field = page.getByRole('textbox', { name: 'tên phòng Room 0' });
  await field.fill(NEW_NAME);
  await field.press('Enter');

  await toast(page).getByRole('button', { name: 'Hoàn tác' }).click();

  await expect(page.getByRole('textbox', { name: 'tên phòng Room 0' })).toHaveValue('Room 0');
});

test('bơm bộ mẫu: rời ô nhập rồi Ctrl+Z thì tên về cũ (V7-ROOMS-04, A12)', async ({ page }) => {
  await openSeeded(page);

  await renameFirstRoom(page);
  /* Trong ô nhập, Ctrl+Z là hoàn tác chữ của chính ô (đúng quy ước nền tảng) — xem
     B-V7-06. Lối bàn phím của hoàn tác thao tác là sau khi rời ô. */
  await nameField(page).blur();
  await page.keyboard.press('Control+z');

  await expect(roomOptions(page).filter({ hasText: FIRST_ROOM.code })).toContainText(FIRST_ROOM.name);
  await expect(roomOptions(page)).toHaveCount(ROOM_COUNT);
});

test('bơm bộ mẫu: đổi tên xong thì trình đọc màn hình nghe được trạng thái lưu — không câm (A7, B-V7-01)', async ({
  page,
}) => {
  await page.clock.install();
  await openSeeded(page);

  await renameFirstRoom(page);

  /* `persistRoomLabels` chưa có đầu máy chủ: engine thử lại theo lịch 5/15/45 s rồi
     mới báo thất bại. Tua qua hết lịch ấy cộng cửa sổ 800 ms của A7 — đồng hồ giả,
     không chờ thật. */
  const pastEveryRetryMs = RETRY_SCHEDULE_MS.reduce((sum, ms) => sum + ms, 0) + 1_000;
  await page.clock.runFor(pastEveryRetryMs);

  /* Vùng `role="alert"` của bộ đọc dùng chung (`lib/input/announcer.ts`) — ẩn với mắt,
     không ẩn với trình đọc màn hình. */
  await expect(page.getByRole('alert').filter({ hasText: AUTOSAVE_FAILED })).toHaveCount(1);
});

/* -------------------------------------------------------------------------- */
/* A9 — gộp phòng hỏi trước bằng hộp thoại.                                    */
/* -------------------------------------------------------------------------- */

const SECOND_ROOM = { code: '#R-002', name: 'phòng ngủ 3' } as const;

/**
 * `ROOM_LABEL_TEXT.wallsNotReadable` (`roomLabelReviewGateway.ts`) — chép, không nhập:
 * tệp cổng kéo theo kho và `fitText`, không chạy được phía Node của Playwright.
 */
const WALLS_NOT_READABLE =
  'Chưa đọc được đồ thị tường của tầng này. Sang lớp tường kiểm tra các đoạn tường lỗi rồi quay lại.';

function mergeDialog(page: Page) {
  return page.getByRole('dialog', { name: 'Gộp hai phòng' });
}

async function openMergeFor(page: Page, code: string): Promise<void> {
  await roomOptions(page).filter({ hasText: code }).click();
  await page.getByRole('button', { name: 'Gộp phòng' }).click();
  await expect(mergeDialog(page)).toBeVisible();
}

/** Chọn ứng viên trong `Select` tự dựng (`role="combobox"` + `role="listbox"`). */
async function pickCandidate(page: Page, room: { code: string; name: string }): Promise<void> {
  await mergeDialog(page).getByRole('combobox', { name: 'Phòng sẽ gộp vào' }).click();
  await page.getByRole('option', { name: `${room.code} · ${room.name}`, exact: true }).click();
}

test('bơm bộ mẫu: gộp phòng hỏi trước — Huỷ thì không gì đổi, Esc chỉ đóng hộp thoại (V7-ROOMS-05, A9, A12)', async ({
  page,
}) => {
  await openSeeded(page);
  const url = page.url();

  await openMergeFor(page, FIRST_ROOM.code);
  await expect(mergeDialog(page).getByRole('button', { name: 'Gộp hai phòng' })).toBeDisabled();
  await pickCandidate(page, SECOND_ROOM);
  await mergeDialog(page).getByRole('button', { name: 'Huỷ' }).click();

  await expect(mergeDialog(page)).toHaveCount(0);
  await expect(roomOptions(page)).toHaveCount(ROOM_COUNT);
  await expect(toast(page).getByRole('button', { name: 'Hoàn tác' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Gộp phòng' }).click();
  await expect(mergeDialog(page)).toBeVisible();
  await page.keyboard.press('Escape');

  await expect(mergeDialog(page)).toHaveCount(0);
  await expect(roomOptions(page)).toHaveCount(ROOM_COUNT);
  expect(page.url()).toBe(url);
});

/*
 * Gộp THÀNH CÔNG không đi được với bộ mẫu: `roomLabelFixture.ts` chủ ý không kèm tường,
 * và gộp dò lại vùng từ tường. Ca này đi nhánh còn lại — lệnh bị từ chối — và đó chính
 * là chỗ đã vỡ (B-V7-08): trước bản sửa, bấm xác nhận xong không có gì xảy ra, không một
 * chữ nào.
 */
test('bơm bộ mẫu: xác nhận gộp mà lệnh bị từ chối thì toast nói lý do, không phòng nào mất (V7-ROOMS-05, B-V7-08)', async ({
  page,
}) => {
  await openSeeded(page);

  await openMergeFor(page, FIRST_ROOM.code);
  await pickCandidate(page, SECOND_ROOM);
  await mergeDialog(page).getByRole('button', { name: 'Gộp hai phòng' }).click();

  await expect(toast(page)).toContainText(WALLS_NOT_READABLE);
  await expect(roomOptions(page)).toHaveCount(ROOM_COUNT);
  await expect(toast(page).getByRole('button', { name: 'Hoàn tác' })).toHaveCount(0);
});

test('bơm bộ mẫu: mở lại hộp thoại gộp ở phòng khác thì không còn chọn sẵn ứng viên cũ (B-V7-03, A9)', async ({
  page,
}) => {
  await openSeeded(page);

  /* Hỏi ở #R-001, chọn #R-002, Huỷ… */
  await openMergeFor(page, FIRST_ROOM.code);
  await pickCandidate(page, SECOND_ROOM);
  await mergeDialog(page).getByRole('button', { name: 'Huỷ' }).click();

  /* …rồi hỏi ở CHÍNH #R-002: trước bản sửa, ứng viên cũ (là chính nó) vẫn được chọn
     ngầm và nút xác nhận bật. */
  await openMergeFor(page, SECOND_ROOM.code);

  await expect(mergeDialog(page).getByRole('combobox', { name: 'Phòng sẽ gộp vào' })).toHaveText(/Chọn phòng/u);
  await expect(mergeDialog(page).getByRole('button', { name: 'Gộp hai phòng' })).toBeDisabled();
});

/* -------------------------------------------------------------------------- */
/* Lượt nạp không phải một bước hoàn tác.                                      */
/* -------------------------------------------------------------------------- */

test('bơm bộ mẫu: Ctrl+Z ngay sau lượt nạp không trả màn về rỗng (B-V7-04)', async ({ page }) => {
  await openSeeded(page);

  /* Ngoài ô nhập, để phím đi tới `global.undo` của vỏ (`router.tsx`). */
  await page.getByRole('heading', { name: 'duyệt tên phòng' }).click();
  await page.keyboard.press('Control+z');

  await expect(roomOptions(page)).toHaveCount(ROOM_COUNT);
  await expect(page.getByRole('heading', { name: 'chưa dò ra phòng nào' })).toHaveCount(0);
});

/* -------------------------------------------------------------------------- */
/* Nợ đã ghi.                                                                  */
/* -------------------------------------------------------------------------- */

test.fixme(
  'bơm bộ mẫu: toast đổi tên gọi phòng bằng mã hiển thị #R-001, không lộ mã máy R-000001ROOM (B-V7-05, A6)',
  /*
   * Lý do fixme: mô tả lệnh dựng từ `room.id` (`roomFloorCommands.ts:230`) — và cùng khuôn
   * ấy lặp ở ~40 câu của `src/lib/commands/business/*`, cùng họ W-3 của tường (nhóm V6).
   * Một bộ định dạng mã hiển thị dùng chung cho tầng lệnh phải được chốt một lần cho cả
   * hai nhóm, không vá riêng câu đổi tên phòng.
   * Mở lại khi: tầng lệnh có hàm mã hiển thị dùng chung và câu đổi tên phòng dùng nó.
   */
  async ({ page }) => {
    await openSeeded(page);

    await renameFirstRoom(page);

    await expect(toast(page)).toContainText(`Đổi tên phòng ${FIRST_ROOM.code.slice(1)} từ`);
    await expect(toast(page)).not.toContainText('R-000001ROOM');
  },
);

test.fixme(
  'bơm bộ mẫu: hoàn tác đổi tên bằng toast giữ nguyên phòng đang chọn (B-V7-09)',
  /*
   * Lý do fixme: vé hoàn tác trả vùng chọn về `selectionBeforeRef` — vùng chọn TRƯỚC lần
   * chọn phòng gần nhất (`useRoomLabelReview.ts`, `onSelect`), không phải vùng chọn lúc
   * chạy lệnh. Đổi tên #R-001 rồi bấm "Hoàn tác" thì tên về đúng nhưng thanh tra đóng
   * lại vì #R-001 bị bỏ chọn. Cùng khuôn `selectionBefore` có ở các màn QC anh em (tường,
   * độ dày) — sửa một chỗ chung, không vá riêng màn phòng.
   * Mở lại khi: `selectionBefore` của tầng lệnh là vùng chọn lúc lệnh chạy.
   */
  async ({ page }) => {
    await openSeeded(page);

    await renameFirstRoom(page);
    await toast(page).getByRole('button', { name: 'Hoàn tác' }).click();

    await expect(nameField(page)).toHaveValue(FIRST_ROOM.name);
  },
);
