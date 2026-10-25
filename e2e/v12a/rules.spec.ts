import { expect, test } from '@playwright/test';

import { ROUTES, pathOf } from '../fixtures/routes';
import { seedSpatial } from '../fixtures/seedSpatial';

/**
 * V12a — `projectRules` và tấm trượt `ViolationDetail` (`docs/notes/e2e/plan.md` V12 mục 1, 3).
 *
 * Route nạp kho qua cổng `ProjectSpatialGate` (B-V12-01, đã sửa) — ca đầu chứng minh
 * điều đó KHÔNG bơm. Mock trả bốn tầng chưa có hình cho `project-1`, nên các ca cần vi
 * phạm thật vẫn BƠM bộ mẫu A14 (tên bài nói ra), và bơm SAU khi cổng đã nạp xong
 * (`seedSpatial({ projectId })`).
 *
 * Không hard-code số vi phạm: chúng đến từ `createSampleBuilding()` và đổi theo bộ mẫu.
 */

const PROJECT_ID = 'project-1';
const RULES_URL = ROUTES.project.rules(PROJECT_ID);

/** Lần tải đầu của một route bắt Vite dịch nguội; cùng hằng `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

const EMPTY_TITLE = 'Chưa có mô hình để kiểm tra luật';

/** Vỏ màn — có ở mọi trạng thái, nên chờ nó không phụ thuộc chữ của `empty`. */
const SCREEN_HEADING = 'Kiểm tra quy chuẩn';

/*
 * Mock trả bốn tầng chưa có hình cho `project-1`, nên câu ĐÚNG của màn khi không bơm là "chưa có
 * mô hình" (cùng chuyện `data.spec.ts` B-V12-07) — bài cũ đòi "Kiểm tra lại" là đòi màn tự khen.
 * Bằng chứng cổng đã nạp kho là bốn tầng của dự án nằm trong kho, đọc thẳng như `seedSpatial`.
 */
test('B-V12-01: vào màn luật bằng đường sản phẩm (không bơm) thì cổng nạp kho dự án; tầng chưa có hình nên màn nói thật "chưa có mô hình" và cổng dẫn về bước Xử lý', async ({
  page,
}) => {
  await page.goto(RULES_URL);
  await expect(page.getByRole('heading', { name: EMPTY_TITLE })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });

  const storeFloors = await page.evaluate(async (projectId) => {
    const load = (path: string): Promise<unknown> => import(/* @vite-ignore */ path);
    const store = (await load('/src/store/index.ts')) as {
      useStore: { getState: () => { project: { id: string } | null; floors: readonly unknown[] } };
    };
    const state = store.useStore.getState();
    return state.project?.id === projectId ? state.floors.length : -1;
  }, PROJECT_ID);
  expect(storeFloors, 'cổng đã nạp bốn tầng của dự án vào kho').toBe(4);

  await expect(page.getByTestId('flow-gate').getByRole('link', { name: 'Mở bước Xử lý' })).toHaveAttribute(
    'href',
    ROUTES.project.pipeline(PROJECT_ID),
  );
  await expect(page.getByRole('button', { name: 'Kiểm tra lại' })).toHaveCount(0);
});

test('có bơm kho: bảng luật hiện bốn con số nguyên, chạy lại không rơi về rỗng, và cổng mời "Xem vi phạm kế" (không "Sang Xuất") khi còn vi phạm', async ({
  page,
}) => {
  await page.goto(RULES_URL);
  await expect(page.getByRole('heading', { name: SCREEN_HEADING })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await seedSpatial(page, { projectId: PROJECT_ID });

  const rerun = page.getByRole('button', { name: 'Kiểm tra lại' });
  await expect(rerun).toBeVisible();

  // Năm ô `<dt>/<dd>` (`RuleReportSummary.tsx`): nhãn đúng thứ tự (tổng trước, rồi từ nhẹ tới nặng), số là số nguyên trần.
  await expect(page.getByRole('term')).toHaveText(['Tổng số kiểm tra', 'Đạt', 'Gợi ý', 'Cảnh báo', 'Nghiêm trọng']);
  await expect(page.getByRole('definition')).toHaveText([/^\d+$/u, /^\d+$/u, /^\d+$/u, /^\d+$/u, /^\d+$/u]);

  const gate = page.getByTestId('flow-gate');
  // UX 26/10: "Xem vi phạm kế" nằm trong thân màn; cổng luôn có "Sang Xuất".
  await expect(page.getByRole('button', { name: 'Xem vi phạm kế' })).toBeVisible();
  await expect(gate.getByRole('button', { name: 'Sang Xuất' })).toBeVisible();

  await rerun.click();
  await expect(page.getByRole('heading', { name: EMPTY_TITLE })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Lỗ mở nằm trọn/u })).toBeVisible();
});

test('có bơm kho: tấm chi tiết vi phạm mở từ một dòng, J sang vi phạm kế mà không đóng, Esc đóng đúng tấm và ở lại màn (A12, A15)', async ({
  page,
}) => {
  await page.goto(RULES_URL);
  await expect(page.getByRole('heading', { name: SCREEN_HEADING })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await seedSpatial(page, { projectId: PROJECT_ID });

  await page.getByRole('button', { name: /^Lỗ mở nằm trọn/u }).click();
  const rows = page.getByRole('button', { name: /^Lỗ mở #D-\d{3}/u });
  const firstMessage = (await rows.first().innerText()).trim();
  await rows.first().click();

  const panel = page.getByRole('complementary', { name: 'Chi tiết vi phạm' });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(firstMessage);

  // VD-3: nơi gọi thật không có hành động sửa nào (`ruleReportGateway.ts`, B-V12-F4 — không
  // phải lỗi), nên tấm ở `partial`: phần căn cứ hiện đủ, không phần "Lựa chọn xử lý".
  await expect(panel.getByText('Nguyên nhân có thể')).toBeVisible();
  await expect(
    panel.getByText(
      'Chưa có cách sửa tự động nào cho vi phạm này. Phần căn cứ ở trên đủ để sửa tay trên bản vẽ.',
    ),
  ).toBeVisible();
  await expect(panel.getByText('Lựa chọn xử lý')).toHaveCount(0);

  // A15: số có phần lẻ dùng dấu phẩy. `1.200 mm` là dấu nghìn, nên chỉ bắt dấu chấm
  // đứng trước ĐÚNG hai chữ số cuối một số.
  await expect(panel).toContainText(/độ tin cậy \d,\d{2}/u);
  await expect(panel).not.toContainText(/\d\.\d{2}(?!\d)/u);

  await page.keyboard.press('j');
  await expect(panel).toBeVisible();
  await expect(panel).not.toContainText(firstMessage);

  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  expect(pathOf(page.url())).toBe(RULES_URL);
  await expect(page.getByRole('button', { name: 'Kiểm tra lại' })).toBeVisible();
});

test('có bơm kho: chip của hàng và tấm chi tiết gọi lỗ mở bằng mã người đọc như câu luật, không bằng mã máy (B-V7-31)', async ({
  page,
}) => {
  await page.goto(RULES_URL);
  await expect(page.getByRole('heading', { name: SCREEN_HEADING })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await seedSpatial(page, { projectId: PROJECT_ID });

  await page.getByRole('button', { name: /^Lỗ mở nằm trọn/u }).click();
  // Neo vào MỘT hàng rồi đọc chip của chính nó — mã `#D-001` lặp lại ở mỗi tầng (strict mode).
  const row = page
    .getByRole('row')
    .filter({ has: page.getByRole('button', { name: /^Lỗ mở #D-\d{3}/u }) })
    .first();
  const message = row.getByRole('button', { name: /^Lỗ mở #D-\d{3}/u });
  await expect(row.locator('code')).toHaveText(/^#D-\d{3}$/u);

  await message.click();
  const panel = page.getByRole('complementary', { name: 'Chi tiết vi phạm' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText(/^#D-\d{3}$/u).first()).toBeVisible();
  await expect(panel.getByText(/^D-DOOR/u)).toHaveCount(0);
});
