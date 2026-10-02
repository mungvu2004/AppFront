import { expect, test } from '@playwright/test';
import type { Locator, Page, Route } from '@playwright/test';

import { ROUTES, pathOf } from '../fixtures/routes';
import { seedSpatial } from '../fixtures/seedSpatial';

/**
 * Hộp thoại "chia sẻ bản vẽ" (`ShareDialog`, không có route) — mở từ nút "chia sẻ"
 * của `ExportPanel` (`ROUTES.project.export`). Nhóm V3, kế hoạch mục 4
 * (`docs/notes/e2e/plan.md`, ca V3-SHARE-1) + phát hiện F2.
 *
 * ## Vì sao có bơm kho
 *
 * Trên bộ mẫu `ExportPanel` luôn rỗng nên nút "chia sẻ" không có. Q1 = A′: bài được
 * bơm `store.spatial` + `floors` bằng `seedSpatial` SAU `goto`, tên bài nói ra điều đó,
 * và có một ca mồi KHÔNG bơm để biết ngày cái nạng này hết cần.
 *
 * ## Vì sao có `page.route` trên `/share-links`
 *
 * Cổng liên kết đi bằng `createAppHttpClient` — `fetch` thật kể cả khi bật bộ mẫu
 * (`shareDialogGateway.ts:71`), nên phía sau là Vite và mọi lượt gọi nhận 404.
 * `page.route` đứng thay máy chủ cho ba bài cần dữ liệu (B-V3-04, F2, B-V3-07).
 *
 * ## KHÔNG kiểm ở đây, và vì sao
 * - Bảy trạng thái, A8 đổi quyền, mã nhúng: `ShareDialog.test.tsx` đã phủ.
 * - Vai viewer: chưa đo đường nạp + đăng nhập viewer cùng lúc; đơn vị có `forbidden`.
 * - Sao chép ra clipboard thật: cần quyền `clipboard-read`.
 * - Tour: từ bản sửa `f35ce7a` (B-V2-01), sau khi bơm và nút "xuất" có mặt thì `EditorTour`
 *   TỰ HIỆN thẻ "lấy tệp mang đi" — bài CHỜ thẻ ấy rồi bấm "bỏ qua" trước cú bấm "chia sẻ"
 *   (không dùng `dismissTourIfShown`: hàm ấy đếm một lần, không chờ, nên chập chờn ở đây).
 *   Không bơm thì không có tour (ca mồi).
 */

/** Lần tải đầu một route bắt Vite dịch nguội; tiền lệ `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

/**
 * Hạn của lượt hâm nóng (`beforeAll` bên dưới), không phải của bài nào.
 *
 * Đo 2026-10-03: Vite mới dựng tải lại trang một lần giữa lượt tải đầu (tối ưu phụ thuộc),
 * mốc hiện sau ~11 s lúc máy rảnh; lúc máy đang chạy e2e của worktree khác, hai bài ĐẦU
 * của lượt (mỗi worker một bài, cùng dịch nguội) hai lần quá cả 25 s. Hâm nóng một lần
 * mỗi worker trả cái giá ấy ngoài hạn 30 s của bài.
 */
const COLD_START_TIMEOUT_MS = 60_000;

const PROJECT_ID = 'project-1';
const EXPORT = ROUTES.project.export(PROJECT_ID);

test.beforeAll(async ({ browser }) => {
  test.setTimeout(COLD_START_TIMEOUT_MS);
  const page = await browser.newPage();
  await page.goto(EXPORT);
  await expect(page.getByText('chưa có gì được duyệt để xuất')).toBeVisible({ timeout: COLD_START_TIMEOUT_MS });
  await page.close();
});

const SHARE_LINKS = new RegExp(`/api/projects/${PROJECT_ID}/share-links`);

/** Hạn cho một cú bấm chuột: nút đã hiện, chỉ còn chờ nó nhận được con trỏ. */
const ACTIONABLE_TIMEOUT_MS = 5_000;

/** Số lần Tab của kế hoạch (V3-SHARE-1) — đủ để đi hết các điểm dừng của hộp thoại rồi vòng lại. */
const TAB_PRESSES = 30;

/** Một liên kết đúng `ShareLinkWireSchema` (`lib/export/shareLink.ts:167`). */
const ACTIVE_LINK = {
  id: 'link-1',
  url: 'https://example.com/s/abc',
  permission: 'view',
  status: 'active',
  createdAt: '2026-10-01T00:00:00.000Z',
  expiresAt: '2026-10-30T00:00:00.000Z',
  revokedAt: null,
  passwordProtected: false,
  viewpointCode: null,
  label: null,
} as const;

async function openExport(page: Page): Promise<void> {
  await page.goto(EXPORT);
  await expect(page.getByText('chưa có gì được duyệt để xuất')).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
}

function shareButton(page: Page): Locator {
  return page.getByRole('button', { name: 'chia sẻ', exact: true });
}

/** goto → bơm kho → bỏ thẻ tour tự hiện; nút "chia sẻ" đã có. */
async function seedAndSkipTour(page: Page): Promise<void> {
  await openExport(page);
  await seedSpatial(page);
  await expect(shareButton(page)).toBeVisible();
  // `EditorTour` không mang `role="dialog"`; thẻ là `region` đặt tên theo tiêu đề bước.
  const tourCard = page.getByRole('region', { name: 'lấy tệp mang đi', exact: true });
  await expect(tourCard).toBeVisible();
  await tourCard.getByRole('button', { name: /bỏ qua/u }).click();
  await expect(tourCard).toHaveCount(0);
}

/** {@link seedAndSkipTour} rồi mở "chia sẻ"; trả về hộp thoại đã mở. */
async function openShareDialogWithSeed(page: Page): Promise<Locator> {
  await seedAndSkipTour(page);
  // Chuột thường: chip "xem hướng dẫn" từng đè nút này (B-V2-05, đã sửa) —
  // bài riêng ở `tour-chip.spec.ts`.
  await shareButton(page).click({ timeout: ACTIONABLE_TIMEOUT_MS });
  const dialog = page.getByRole('dialog', { name: 'chia sẻ bản vẽ' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('không bơm kho: /export báo "chưa có gì được duyệt để xuất" và không có nút "chia sẻ" — ngày bài này đỏ là ngày sản phẩm có đường nạp thật, hãy gỡ bơm khỏi các bài bên cạnh', async ({
  page,
}) => {
  await openExport(page);
  await expect(shareButton(page)).toHaveCount(0);
});

test('bơm kho: nút "chia sẻ" mở hộp thoại với tiêu điểm đầu ở "Đóng hộp thoại", Escape đóng đúng nó và vẫn ở /export cạnh nút "chia sẻ" (V3-SHARE-1)', async ({
  page,
}) => {
  const dialog = await openShareDialogWithSeed(page);
  await expect(dialog.getByRole('button', { name: 'Đóng hộp thoại' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(pathOf(page.url())).toBe(EXPORT);
  await expect(shareButton(page)).toBeVisible();
});

/*
 * Một bài riêng chứ không "Escape rồi mở lại": đo 2026-10-03 (trước `f35ce7a`), đóng hộp
 * thoại xong thì `EditorTour` hiện lên và nền tối của nó chặn cú bấm mở lại. Tách bài thì
 * không bài nào phải bấm qua thời điểm ấy, dù tour hiện ở bước nào.
 */
test('bơm kho: trong hộp thoại "chia sẻ bản vẽ", 30 lần Tab không đưa tiêu điểm ra ngoài (V3-SHARE-1)', async ({
  page,
}) => {
  const dialog = await openShareDialogWithSeed(page);
  for (let i = 0; i < TAB_PRESSES; i += 1) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((node) => node.contains(document.activeElement)), `Tab lần ${i + 1}`).toBe(
      true,
    );
  }
});

/*
 * (đã sửa, B-V3-04) Hộp thoại từng mở ra đã ở `error` "thao tác chia sẻ đã bị huỷ" dù máy
 * chủ trả lời bình thường: lượt đọc danh sách lúc tải `/export` đi nhờ một lượt GET đang
 * bay và ăn theo cú huỷ của người khởi xướng (`src/lib/http/client.ts`, single-flight).
 * Đã kiểm đỏ trên mã chưa sửa.
 */
test('bơm kho + máy chủ giả trả danh sách rỗng: mở hộp thoại chia sẻ thì không hiện lỗi "thao tác chia sẻ đã bị huỷ"', async ({
  page,
}) => {
  await page.route(SHARE_LINKS, (route) => route.fulfill({ json: [] }));
  const dialog = await openShareDialogWithSeed(page);
  await expect(dialog.getByRole('region', { name: 'liên kết chia sẻ' })).toBeVisible();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
});

/*
 * (đã sửa, B-V3-06 — F2, A9) "thu hồi" từng gửi DELETE ngay, không hỏi trước, mà thu hồi
 * là việc A8 không hoàn tác được. Nay nó mở hộp thoại "thu hồi liên kết này?" — ANH EM
 * của hộp thoại chia sẻ, nên lúc mở có 2 dialog. Đã kiểm đỏ trên mã chưa sửa.
 */
test('bơm kho + máy chủ giả có một liên kết: "thu hồi" hỏi xác nhận trước; "để nguyên" và Escape không gửi gì, xác nhận "thu hồi" gửi đúng một lệnh (F2, A9)', async ({
  page,
}) => {
  const deletes: string[] = [];
  await page.route(SHARE_LINKS, async (route: Route) => {
    const method = route.request().method();
    if (method === 'GET') return route.fulfill({ json: [ACTIVE_LINK] });
    if (method === 'POST') return route.fulfill({ status: 201, json: ACTIVE_LINK });
    deletes.push(route.request().url());
    return route.fulfill({ json: { ...ACTIVE_LINK, status: 'revoked', revokedAt: '2026-10-02T00:00:00.000Z' } });
  });
  const dialog = await openShareDialogWithSeed(page);
  const revoke = dialog.getByRole('button', { name: 'thu hồi' });
  const confirm = page.getByRole('dialog', { name: 'thu hồi liên kết này?' });

  // "để nguyên": chỉ hộp xác nhận đóng, hộp thoại chia sẻ còn, không DELETE nào.
  await revoke.click();
  await expect(confirm).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(2);
  await confirm.getByRole('button', { name: 'để nguyên' }).click();
  await expect(confirm).toHaveCount(0);
  await expect(dialog).toBeVisible();
  expect(deletes).toEqual([]);

  // Escape trong hộp xác nhận: chỉ nó đóng.
  await revoke.click();
  await expect(confirm).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(confirm).toHaveCount(0);
  await expect(dialog).toBeVisible();
  expect(deletes).toEqual([]);

  // Xác nhận "thu hồi": đúng một DELETE.
  await revoke.click();
  await confirm.getByRole('button', { name: 'thu hồi' }).click();
  await expect.poll(() => deletes.length).toBe(1);
  await expect(confirm).toHaveCount(0);
});

/*
 * (đã sửa, B-V3-07) `ExportPanelRoute` từng không có `Toast.Provider` và không truyền
 * `onToast` cho hộp thoại chia sẻ, nên mọi toast của hộp thoại câm. Đã kiểm đỏ trên mã
 * chưa sửa.
 */
test('bơm kho + máy chủ giả: "tạo liên kết" trong hộp thoại chia sẻ hiện toast "đã tạo liên kết chia sẻ"', async ({
  page,
}) => {
  await page.route(SHARE_LINKS, (route: Route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 201, json: ACTIVE_LINK })
      : route.fulfill({ json: [] }),
  );
  const dialog = await openShareDialogWithSeed(page);

  await dialog.getByRole('button', { name: 'tạo liên kết' }).click();

  await expect(
    page.getByRole('region', { name: 'Thông báo' }).filter({ hasText: 'đã tạo liên kết chia sẻ' }),
  ).toBeVisible();
});
