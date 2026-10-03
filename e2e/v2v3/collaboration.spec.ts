import { expect, test } from '@playwright/test';


import { openViewer } from './viewer-helpers';

/**
 * CollaborationLayer — lớp phủ "Ai đang xem" trên vỏ 3D (`/projects/project-1/3d`).
 * Kế hoạch: `docs/notes/e2e/plan.md` MỤC 1 (V2), trường 6 (b) và (c).
 *
 * ## Chỉ phần còn thiếu
 *
 * `e2e/viewer3d.spec.ts` đã có: nút "Ai đang xem" mở được bằng chuột, `Escape`
 * đóng đúng nó, URL không đổi (A12, ca 6a + 6d), và ViewCube bấm được bằng chuột.
 * Bài ở đây KHÔNG lặp những thứ đó. Nó thêm hai điều tệp kia không nói:
 * - (b) hit-test ở tâm nút: một lớp khác đè lên nút (lỗi từng có ở
 *   `Viewer3DOverlays.tsx`, khung 280 px nuốt ô ViewCube) thì `click()` của
 *   Playwright vẫn có thể đỏ vì lý do khác; `elementFromPoint` nói thẳng ai
 *   nhận cú bấm.
 * - (c) nội dung danh sách: người dùng thử là chính mình ("(bạn)"), và dòng
 *   trạng thái nói "chỉ mình bạn đang xem".
 *
 * ## KHÔNG kiểm
 *
 * Con trỏ người khác, ghim bình luận, khoá, panel xung đột: bốn năng lực cộng tác
 * đều tắt (`collaborationGateway.ts`), không có đường mở trên màn — tầng đơn vị
 * (`CollaborationLayer.test.tsx`) phủ. Vai `viewer` (`forbidden`): chưa đo.
 *
 * ## Lớp hướng dẫn
 *
 * Vỏ 3D cũng là host của `EditorTour`, và nền tối của tour phủ cả nút này: đo
 * `elementFromPoint` ở tâm nút khi tour đang hiện trúng tấm `bg-bg-overlay`. Tour
 * tự hiện ngay khi mô hình dựng xong (B-V2-01), nên bài CHỜ thẻ của nó rồi bỏ nó
 * bằng nút "bỏ qua" của sản phẩm TRƯỚC khi đo. Hit-test ở đây là của lớp cộng tác,
 * không phải của tour.
 */

const ROSTER_TOGGLE = 'Ai đang xem';

test('nút "Ai đang xem" nhận cú bấm ở tâm của nó, và danh sách nói chỉ mình bạn đang xem', async ({
  page,
}) => {
  await openViewer(page);

  await page
    .getByRole('region', { name: 'đổi sang khung nhìn khối', exact: true })
    .getByRole('button', { name: /bỏ qua/u })
    .click();

  const toggle = page.getByRole('button', { name: ROSTER_TOGGLE, exact: true });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  /* (b) Ai nhận cú bấm ở tâm nút — chính nút hoặc con của nó. `poll`: nền tối
     của tour vừa bỏ qua rời DOM ở lượt vẽ kế tiếp, không phải ngay trong cú bấm. */
  await expect
    .poll(() =>
      toggle.evaluate((button) => {
        const box = button.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return hit !== null && button.contains(hit);
      }),
    )
    .toBe(true);

  /* (c) Mở danh sách bằng cú bấm thật — `click()` thường, không `force`. */
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');

  const roster = page.getByLabel('Những người đang xem');
  await expect(roster).toBeVisible();
  await expect(roster).toContainText('(bạn)');

  /* Nhiều `role=status` cùng sống trên vỏ 3D — lọc theo chữ, không lấy trần. */
  await expect(
    page.getByRole('status').filter({ hasText: 'chỉ mình bạn đang xem' }),
  ).toBeVisible();
});
