import { expect, test } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';
import { dismissTourIfPresent } from '../v8/viewer';

/**
 * B-V6-08 (`questions.md` "Việc sản phẩm" #4, Q10e = A) — mọi phím mà ray công cụ
 * của vỏ 3D quảng cáo trong nhãn phải tồn tại lúc chạy.
 *
 * Đo 2026-10-03 trước bản sửa: nhãn "quay quanh mô hình (R)", "kéo màn (H)",
 * "mặt cắt (C)", "chọn (V)" — bấm R/H/C/V không đổi nút nào; chỉ "đo (M)" chạy.
 *
 * Bài **tự tổng quát hoá**: không chép danh sách phím, mà đọc chính nhãn trên màn
 * (`… (X)`), nên một công cụ thêm sau với một phím quảng cáo mà không đăng ký sẽ
 * làm bài đỏ. Tổ hợp (`Alt+H`) bỏ qua: nó là hành động trên đối tượng đang chọn,
 * không phải phím chọn công cụ.
 */

const PROJECT_ID = 'project-1';

/** Lần tải đầu bắt Vite dịch nguội cả vỏ 3D; tiền lệ `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

const SINGLE_KEY_LABEL = /\(([A-Z0-9])\)$/u;

test('mỗi phím đơn mà ray công cụ 3D ghi trong nhãn đều chọn đúng công cụ ấy', async ({ page }) => {
  await page.goto(ROUTES.project.viewer(PROJECT_ID));

  const rail = page.getByRole('toolbar', { name: 'Công cụ khung nhìn' });
  await expect(rail.getByRole('button').first()).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  /* Tour hướng dẫn phủ `/3d` (W02) và nạp động nên có thể hiện muộn: CHỜ nó rồi bỏ qua —
     một phím bấm vào thẻ tour không tới sổ phím. */
  await dismissTourIfPresent(page);

  const labels = await rail.getByRole('button').evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute('aria-label') ?? ''),
  );
  const advertised = labels.flatMap((label) => {
    const key = SINGLE_KEY_LABEL.exec(label)?.[1];

    return key === undefined ? [] : [{ key, label }];
  });

  /* Chốt chống "xanh rỗng": nếu nhãn đổi khuôn mà regex không bắt được gì, bài phải đỏ. */
  expect(advertised.map(({ key }) => key)).toEqual(expect.arrayContaining(['R', 'H', 'C', 'V', 'M']));

  /* Ngược thứ tự ray: công cụ đầu ("quay quanh", R) đang bật sẵn, nên nó phải được bấm SAU cùng mới chứng minh được gì. */
  for (const { key, label } of [...advertised].reverse()) {
    await page.keyboard.press(key.toLowerCase());
    await expect(rail.getByRole('button', { name: label, exact: true }), `phím ${key}`).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  }
});
