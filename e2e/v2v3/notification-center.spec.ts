import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';

/**
 * NotificationCenter — route `/thong-bao` (`ROUTES.notifications`), bản toàn màn
 * `NotificationCenterRoute` của tấm trượt thông báo.
 * Kế hoạch: `docs/notes/e2e/plan.md` V2 MỤC 3, trường 2, 6, 8, 10; phát hiện V2
 * số 3, 4, 6, 7; lỗi B-G-02.
 *
 * ## Đường tới: chỉ có `goto`
 *
 * Đo 2026-10-03: không có liên kết nào trong sản phẩm dẫn tới `/thong-bao`
 * (`a[href*="thong"]` trên bảng điều khiển: 0), và nút "Thông báo" ở đầu bảng điều
 * khiển (`ProjectDashboard.tsx`, cạnh ô tìm dự án) KHÔNG có `onClick` — bấm nó thì
 * URL không đổi, 0 `dialog` mở. Nên ca "đến từ màn khác" của kế hoạch (trường 2)
 * KHÔNG có bài: giả lập bằng `history.pushState` không phải luồng người dùng.
 *
 * ## Console
 *
 * Bài không thu `console.error`: luồng SSE `/api/streams/notifications` trả 404
 * trên bộ mẫu dev (đã biết, ngoài FE; `smoke-grid.spec.ts` giữ dòng `expectedConsole`
 * của màn này). Cũng vì luồng ấy hỏng mà màn ở trạng thái `partial` ("Có thể chưa
 * cập nhật").
 *
 * ## KHÔNG kiểm
 *
 * Bảy trạng thái, cuộn khi tin đến, nút `chấp nhận` của lời mời, chấm chưa đọc,
 * không âm thanh: `NotificationCenter.test.tsx` phủ. Nhận tin thời gian thực: luồng
 * SSE 404 ở bộ mẫu. A6 của nhãn hoa đầu câu ("Đánh dấu tất cả đã đọc"): chưa đối
 * chiếu `LUAT_MAN_HINH.md`, kế hoạch để ngỏ.
 */

/** Lần tải đầu một route bắt Vite dịch nguội — tiền lệ `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

/** Bộ mẫu (`src/api/__mocks__/client.ts`): 5 thông báo, 3 chưa đọc. */
const ITEM_COUNT = 5;
const UNREAD_COUNT = 3;

function panel(page: Page) {
  return page.getByRole('dialog', { name: 'Thông báo' });
}

/** Mở THẲNG `/thong-bao` — một lượt tải trang, không có mục lịch sử nào trong ứng dụng. */
async function openDirect(page: Page): Promise<void> {
  await page.goto(ROUTES.notifications);
  await expect(page.getByRole('heading', { name: 'Thông báo' })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
}

test('mở trực tiếp /thong-bao rồi Escape về danh sách dự án trong ứng dụng, không ra about:blank (B-G-02)', async ({
  page,
}) => {
  await openDirect(page);

  await page.keyboard.press('Escape');

  await expect.poll(() => new URL(page.url()).pathname).toBe(ROUTES.dashboard);
  await expect(page.getByRole('heading', { name: 'Dự án của tôi' })).toBeVisible();
  await expect(panel(page)).toHaveCount(0);
});

test('"Đánh dấu tất cả đã đọc" xoá số chưa đọc, khoá nút, và trạng thái nói "không còn thông báo chưa đọc" khi danh sách vẫn còn (B-V2-02)', async ({
  page,
}) => {
  await openDirect(page);

  const drawer = panel(page);
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText(String(UNREAD_COUNT), { exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'thông báo chưa đọc' })).toHaveText(
    `có ${UNREAD_COUNT} thông báo chưa đọc`,
  );

  const markAll = drawer.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' });
  await markAll.click();

  await expect(markAll).toBeDisabled();
  await expect(drawer.getByText(String(UNREAD_COUNT), { exact: true })).toHaveCount(0);
  // Danh sách KHÔNG rỗng — nên câu "không có thông báo nào" sẽ là nói dối.
  await expect(drawer.getByRole('listitem')).toHaveCount(ITEM_COUNT);
  await expect(page.getByRole('status').filter({ hasText: 'thông báo' })).toHaveText(
    'không còn thông báo chưa đọc',
  );
});

test('bộ lọc "Chưa đọc" (nút chọn trong nhóm "Lọc thông báo") chỉ để lại các thông báo chưa đọc', async ({
  page,
}) => {
  await openDirect(page);

  const drawer = panel(page);
  const filters = drawer.getByRole('radiogroup', { name: 'Lọc thông báo' });
  const unread = filters.getByRole('radio', { name: 'Chưa đọc' });

  await expect(filters.getByRole('radio', { name: 'Tất cả' })).toHaveAttribute('aria-checked', 'true');
  await expect(drawer.getByRole('listitem')).toHaveCount(ITEM_COUNT);

  await unread.click();

  await expect(unread).toHaveAttribute('aria-checked', 'true');
  await expect(drawer.getByRole('listitem')).toHaveCount(UNREAD_COUNT);
});

/*
 * B-V2-04 (đã sửa): bấm một thông báo ở `/thong-bao` từng đưa người dùng về `/` —
 * hook gọi `onNavigate(đích)` rồi `onClose()`, và ở route "đóng" là "rời route" nên
 * lượt đóng (`replace /`, hai lần: lần sau từ quãng mờ 180 ms) đè lên lượt điều
 * hướng. Nay `NotificationCenterRoute` đã điều hướng đi thì không đóng nữa. Đã kiểm
 * đỏ trên mã chưa sửa.
 */
test('bấm một thông báo ở /thong-bao mở thẳng đưa người dùng tới đúng màn của thông báo ấy', async ({
  page,
}) => {
  await openDirect(page);

  await panel(page)
    .getByRole('button', { name: /hệ thống AI đã xử lý xong bản vẽ tầng trệt/ })
    .click();

  const target = ROUTES.project.walls('project-1', 'L1');
  await expect.poll(() => new URL(page.url()).pathname).toBe(target);
  await expect(page.getByRole('region', { name: 'Duyệt lớp tường' })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
});

/*
 * FIXME (QV2-3, chờ quyết) — A8 cho "Đánh dấu tất cả đã đọc".
 * Đo: bấm nút ⇒ 0 `role="alert"`, 0 nút "Hoàn tác", 0 toast; hook dùng
 * `useMutation` không kèm toast/undo. Chưa chốt A8 có áp cho đánh dấu đã đọc không.
 * Mở lại khi: QV2-3 chốt "có" và sản phẩm thêm toast hoàn tác; nếu chốt "không"
 * thì xoá bài này và ghi lý do vào kế hoạch.
 */
test.fixme('"Đánh dấu tất cả đã đọc" hiện toast kèm nút "Hoàn tác" (A8 — chờ quyết QV2-3)', async ({
  page,
}) => {
  await openDirect(page);

  await panel(page).getByRole('button', { name: 'Đánh dấu tất cả đã đọc' }).click();

  await expect(page.getByRole('button', { name: 'Hoàn tác' })).toBeVisible();
});
