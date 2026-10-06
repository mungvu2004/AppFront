import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';

/**
 * NotificationCenter — route `/thong-bao` (`ROUTES.notifications`), bản toàn màn
 * `NotificationCenterRoute` của tấm trượt thông báo.
 * Kế hoạch: `docs/notes/e2e/plan.md` V2 MỤC 3, trường 2, 6, 8, 10; phát hiện V2
 * số 3, 4, 6, 7; lỗi B-G-02.
 *
 * ## Đường tới: `goto`, và chuông ở danh sách dự án
 *
 * Bài ở đây mở thẳng `/thong-bao`. Ca "đến từ màn khác" của kế hoạch (trường 2) —
 * chuông "Thông báo" ở danh sách dự án → "Xem tất cả" → `/thong-bao` → Esc quay về —
 * nằm ở `dashboard.spec.ts` (B-V3-08), vì trước bản sửa ấy chuông là nút chết và
 * không có đường nội bộ nào tới route này.
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

test('điện thoại: ba nút chọn chiều cao tấm trượt nằm trong cây truy cập, có tên và trạng thái (B-V1-46)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDirect(page);

  const levels = panel(page).getByRole('group', { name: 'Chiều cao tấm trượt', exact: true });
  await expect(levels.getByRole('button')).toHaveCount(3);
  await expect(levels.getByRole('button', { name: 'Mức 3', pressed: true })).toBeVisible();

  await levels.getByRole('button', { name: 'Mức 2' }).click();

  await expect(levels.getByRole('button', { name: 'Mức 2', pressed: true })).toBeVisible();
});

test('"Đánh dấu tất cả đã đọc" xoá số chưa đọc, khoá nút, và trạng thái nói "Không còn thông báo chưa đọc" khi danh sách vẫn còn (B-V2-02)', async ({
  page,
}) => {
  await openDirect(page);

  const drawer = panel(page);
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText(String(UNREAD_COUNT), { exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'thông báo chưa đọc' })).toHaveText(
    `Có ${UNREAD_COUNT} thông báo chưa đọc`,
  );

  const markAll = drawer.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' });
  await markAll.click();

  await expect(markAll).toBeDisabled();
  await expect(drawer.getByText(String(UNREAD_COUNT), { exact: true })).toHaveCount(0);
  // Danh sách KHÔNG rỗng — nên câu "không có thông báo nào" sẽ là nói dối.
  await expect(drawer.getByRole('listitem')).toHaveCount(ITEM_COUNT);
  await expect(page.getByRole('status').filter({ hasText: 'thông báo' })).toHaveText(
    'Không còn thông báo chưa đọc',
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
 * B-V2-06 (đã sửa): "Đánh dấu tất cả đã đọc" từng ghi ngay, không toast, không đường
 * quay lại — máy chủ không có lệnh "đánh dấu lại chưa đọc". Nay lệnh được giữ 8 giây
 * sau toast "Hoàn tác" (A8). Bước bấm lại phủ phần sửa kênh chung: toast đã hoàn tác
 * không được nuốt lượt kế tiếp trong cửa sổ gộp 5 giây. Đã kiểm đỏ trước sửa.
 */
test('"Đánh dấu tất cả đã đọc" hiện toast kèm nút "Hoàn tác", và Hoàn tác trả lại số chưa đọc (B-V2-06)', async ({
  page,
}) => {
  await openDirect(page);

  const drawer = panel(page);
  const markAll = drawer.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' });
  const undo = page.getByRole('button', { name: 'Hoàn tác' });
  const unreadStatus = page.getByRole('status').filter({ hasText: 'thông báo chưa đọc' });

  await expect(unreadStatus).toHaveText(`Có ${UNREAD_COUNT} thông báo chưa đọc`);

  await markAll.click();
  await expect(unreadStatus).toHaveText('Không còn thông báo chưa đọc');
  await undo.click();

  await expect(unreadStatus).toHaveText(`Có ${UNREAD_COUNT} thông báo chưa đọc`);
  await expect(undo).toHaveCount(0);

  // Bấm lại ngay, trong cửa sổ gộp 5 giây của kênh chung: toast mới phải hiện thật.
  await markAll.click();
  await expect(undo).toBeVisible();
});
