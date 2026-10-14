// QA-10 P10 — ListReviewDemo (dev route /list-review-demo, SCR-40e-2): FL-10E-06, FL-10E-07. Dev server mock, anon.
import { captureEvidence } from './support/evidence';
import { devTest as test, expect } from './support/p10/devServer';
import { bodyRows, codes, headCheck, region, RING, rowCheck, rowOf } from './support/p10/P10';

const ROUTE = '/list-review-demo';

test('SCR-40e-2 · FL-10E-06 · anon · ListReviewDemo: chọn, duyệt, xoá, hoàn tác', async ({ devPage: page }) => {
  test.setTimeout(120_000);
  const bar = page.getByText(/^Đã chọn \d+ cấu kiện$/u);
  const summary = page.getByText(/tường đã duyệt$/u);
  const undo = page.getByRole('button', { name: 'Hoàn tác' });

  await test.step('[10E-C-011] bàn phím khi chưa có hàng focus', async () => {
    await page.goto(ROUTE);
    // ListReviewDemo.tsx:64 — mốc chắc chắn: nhãn "States:" (H: sập nếu thiếu ToastProvider, ListReviewDemo.tsx:41)
    await expect(page.getByText('States:')).toBeVisible();
    await expect(bodyRows(page)).toHaveCount(48);
    await region(page).focus();
    await page.keyboard.press('ArrowDown'); // useListReview.ts:138 `if (!focusedId) return`
    await page.keyboard.press(' ');
    await expect(bar).toHaveCount(0);
    await expect(summary).toHaveText('0/48 tường đã duyệt');
    await expect(bodyRows(page).filter({ has: page.locator('td') }).locator('xpath=self::tr[contains(concat(" ", normalize-space(@class), " "), " ring-2 ")]')).toHaveCount(0);
    await captureEvidence(page, 'E10_10E-C-011_list_no_focus.png');
  });

  await test.step('[10E-A-013] bấm hàng W-003', async () => {
    await rowOf(page, 'W-003').getByRole('cell', { name: 'W-003' }).click();
    await expect.soft(rowOf(page, 'W-003')).toHaveClass(RING); // Table.tsx focused → ring-2
    await captureEvidence(page, 'E10_10E-A-013_list_row_focus.png');
  });

  await test.step('[10E-C-012] Shift+Space khi chưa chọn trước', async () => {
    await page.keyboard.press('Shift+Space'); // useListReview.ts:150 e.key === ' ' + e.shiftKey
    await expect.soft(page.getByText('Đã chọn 1 cấu kiện')).toBeVisible();
    await captureEvidence(page, 'E10_10E-C-012_list_shift_space_first.png');
  });

  await test.step('[10E-A-014] ArrowDown/ArrowUp và biên', async () => {
    await page.keyboard.press('ArrowDown');
    await expect.soft(rowOf(page, 'W-004')).toHaveClass(RING);
    await expect.soft(rowOf(page, 'W-003')).not.toHaveClass(RING);
    await page.keyboard.press('ArrowUp');
    await expect.soft(rowOf(page, 'W-003')).toHaveClass(RING);
    await rowOf(page, 'W-001').getByRole('cell', { name: 'W-001' }).click();
    await page.keyboard.press('ArrowUp');
    await expect.soft(rowOf(page, 'W-001')).toHaveClass(RING);
    await rowOf(page, 'W-048').getByRole('cell', { name: 'W-048' }).click();
    await page.keyboard.press('ArrowDown');
    await expect.soft(rowOf(page, 'W-048')).toHaveClass(RING);
    await captureEvidence(page, 'E10_10E-A-014_list_arrow_edges.png');
  });

  await test.step('[10E-A-015] Space và Shift+Space dải', async () => {
    await headCheck(page).click(); // chọn hết
    await headCheck(page).click(); // bỏ hết: trạng thái sạch
    await expect(bar).toHaveCount(0);
    await rowOf(page, 'W-002').getByRole('cell', { name: 'W-002' }).click();
    await page.keyboard.press(' ');
    await expect.soft(page.getByText('Đã chọn 1 cấu kiện')).toBeVisible();
    await rowOf(page, 'W-005').getByRole('cell', { name: 'W-005' }).click();
    await page.keyboard.press('Shift+Space');
    await expect.soft(page.getByText('Đã chọn 4 cấu kiện')).toBeVisible(); // W-002..W-005
    await captureEvidence(page, 'E10_10E-A-015_list_space_range.png');
  });

  await test.step('[10E-A-016] tick hộp kiểm một hàng', async () => {
    await headCheck(page).click();
    await headCheck(page).click();
    await expect(bar).toHaveCount(0);
    await rowCheck(page, 'W-010').check();
    await expect.soft(page.getByText('Đã chọn 1 cấu kiện')).toBeVisible();
    await expect.soft(summary).toHaveCount(0);
    await captureEvidence(page, 'E10_10E-A-016_list_tick_row.png');
  });

  await test.step('[10E-A-017] Shift+click hàng 5 sau hàng 2', async () => {
    await rowCheck(page, 'W-010').uncheck();
    await expect(bar).toHaveCount(0);
    await rowCheck(page, 'W-002').check();
    await rowCheck(page, 'W-005').click({ modifiers: ['Shift'] }); // ListReviewDemo.tsx:199 nativeEvent.shiftKey
    await expect.soft(page.getByText('Đã chọn 4 cấu kiện')).toBeVisible();
    await captureEvidence(page, 'E10_10E-A-017_list_shift_click.png');
  });

  await test.step('[10E-A-018] hộp kiểm tiêu đề hai lần', async () => {
    await headCheck(page).click();
    await expect.soft(page.getByText('Đã chọn 48 cấu kiện')).toBeVisible();
    await headCheck(page).click();
    await expect.soft(bar).toHaveCount(0);
    await expect.soft(summary).toHaveText('0/48 tường đã duyệt');
    await captureEvidence(page, 'E10_10E-A-018_list_select_all.png');
  });

  await test.step('[10E-B-020] chọn ≥1 hàng đổi thanh dưới', async () => {
    await rowCheck(page, 'W-001').check();
    await expect.soft(page.getByRole('button', { name: 'Duyệt danh sách' })).toBeVisible();
    await expect.soft(page.getByRole('button', { name: 'Xoá' })).toBeVisible();
    await expect.soft(summary).toHaveCount(0);
    await captureEvidence(page, 'E10_10E-B-020_list_selection_bar.png');
  });

  await test.step('[10E-A-019] chọn 2 hàng, Duyệt danh sách', async () => {
    await rowCheck(page, 'W-002').check();
    await expect(page.getByText('Đã chọn 2 cấu kiện')).toBeVisible();
    await page.getByRole('button', { name: 'Duyệt danh sách' }).click();
    await expect.soft(page.getByText('Đã duyệt', { exact: true })).toHaveCount(2);
    await expect.soft(summary).toHaveText('2/48 tường đã duyệt'); // hiện sau cửa sổ flash
    await captureEvidence(page, 'E10_10E-A-019_list_batch_approve.png');
  });

  await test.step('[10E-C-010] sau cửa sổ flash selection xoá, flash tắt', async () => {
    await expect.soft(bar).toBeHidden({ timeout: 5_000 });
    await expect.soft(bodyRows(page).locator('xpath=self::tr[contains(@class,"bg-bg-flash")]')).toHaveCount(0);
    await expect.soft(page.locator('tbody input[type="checkbox"]:checked')).toHaveCount(0);
    await captureEvidence(page, 'E10_10E-C-010_list_flash_done.png');
  });

  await test.step('[10E-A-020] chọn 3, Xoá', async () => {
    for (const c of ['W-020', 'W-021', 'W-022']) await rowCheck(page, c).check();
    await expect(page.getByText('Đã chọn 3 cấu kiện')).toBeVisible();
    await page.getByRole('button', { name: 'Xoá' }).click();
    await expect.soft(bodyRows(page)).toHaveCount(45);
    await expect.soft(page.getByText('Đã xoá 3 cấu kiện')).toBeVisible();
    await expect.soft(undo).toBeVisible();
    await captureEvidence(page, 'E10_10E-A-020_list_delete.png');
  });

  await test.step('[10E-A-021] Hoàn tác', async () => {
    await undo.click();
    await expect.soft(bodyRows(page)).toHaveCount(48);
    await expect.soft(undo).toBeHidden(); // Toast.tsx:120 rời ngay sau Hoàn tác
    await captureEvidence(page, 'E10_10E-A-021_list_undo.png');
  });

  await test.step('[10E-C-013] xoá, hoàn tác hai lần', async () => {
    await rowCheck(page, 'W-030').check();
    await page.getByRole('button', { name: 'Xoá' }).click();
    await expect(bodyRows(page)).toHaveCount(47);
    // bấm đúp thật: lần 2 rơi vào lúc toast đang exit (nút còn trong DOM); backup null (useListReview.ts:131) → không hồi thêm
    await undo.dblclick();
    await expect.soft(undo).toHaveCount(0);
    await expect.soft(bodyRows(page)).toHaveCount(48);
    await expect.soft(rowOf(page, 'W-030')).toHaveCount(1);
    await captureEvidence(page, 'E10_10E-C-013_list_undo_twice.png');
  });
});

test('SCR-40e-2 · FL-10E-07 · anon · ListReviewDemo: sắp xếp, cây, a11y', async ({ devPage: page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  const head = (name: string) => page.getByRole('columnheader', { name });
  const firstCode = () => bodyRows(page).first().locator('td:nth-child(2)');
  const tierItem = page.getByRole('treeitem').filter({ hasText: 'Tầng 01' });

  await test.step('[10E-A-022] sắp xếp Mã cấu kiện ba lần', async () => {
    await page.goto(ROUTE);
    await expect(page.getByText('States:')).toBeVisible(); // ListReviewDemo.tsx:64
    await expect(bodyRows(page)).toHaveCount(48);
    await head('Mã cấu kiện').click();
    await expect(head('Mã cấu kiện')).toHaveAttribute('aria-sort', 'ascending');
    await expect(firstCode()).toHaveText('W-001');
    await head('Mã cấu kiện').click();
    await expect(head('Mã cấu kiện')).toHaveAttribute('aria-sort', 'descending');
    await expect(firstCode()).toHaveText('W-048');
    await head('Mã cấu kiện').click();
    await expect(head('Mã cấu kiện')).toHaveAttribute('aria-sort', 'none');
    await expect(firstCode()).toHaveText('W-001');
    await captureEvidence(page, 'E10_10E-A-022_sort_code_cycle.png');
  });

  await test.step('[10E-A-023] sắp xếp Độ tin cậy tăng dần', async () => {
    await head('Độ tin cậy').click();
    await expect.soft(head('Độ tin cậy')).toHaveAttribute('aria-sort', 'ascending');
    await expect.soft(firstCode()).toHaveText('W-001');
    for (let i = 0; i < 10; i += 1) {
      await expect.soft(bodyRows(page).nth(i).getByRole('meter')).toHaveAttribute('aria-valuenow', '62');
    }
    await expect.soft(bodyRows(page).nth(10).getByRole('meter')).not.toHaveAttribute('aria-valuenow', '62');
    await captureEvidence(page, 'E10_10E-A-023_sort_confidence_asc.png');
  });

  await test.step('[10E-C-009] sắp xếp Chiều dày (toàn 220)', async () => {
    await head('Chiều dày').click();
    await expect.soft(head('Chiều dày')).toHaveAttribute('aria-sort', 'ascending');
    expect.soft(await codes(page)).toEqual(Array.from({ length: 48 }, (_, i) => `W-${String(i + 1).padStart(3, '0')}`)); // ổn định
    await expect.soft(firstCode()).toHaveText('W-001');
    await captureEvidence(page, 'E10_10E-C-009_sort_thickness_stable.png');
  });

  await test.step('[10E-C-008] meter của W-001', async () => {
    const meter = bodyRows(page).filter({ has: page.getByRole('cell', { name: 'W-001', exact: true }) }).getByRole('meter'); // ConfidenceMeter.tsx:36-40
    await expect.soft(meter).toHaveAttribute('aria-valuenow', '62');
    await expect.soft(meter).toHaveAttribute('aria-label', 'Độ tin cậy AI: 0,62');
    await captureEvidence(page, 'E10_10E-C-008_sort_meter_w001.png');
  });

  await test.step('[10E-A-024] TreeItem Tầng 01 nút mắt', async () => {
    await tierItem.getByRole('button', { name: 'Ẩn layer' }).click(); // TreeItem.tsx:136
    await expect.soft(tierItem.getByRole('button', { name: 'Hiện layer' })).toBeVisible();
    await expect.soft(tierItem.getByRole('button', { name: 'Ẩn layer' })).toHaveCount(0);
    await captureEvidence(page, 'E10_10E-A-024_sort_tree_eye.png');
  });

  await test.step('[10E-E-004] hộp kiểm có tên truy cập', async () => {
    // ⚑ N-5: ListReviewDemo.tsx:136,197 — input trần không aria-label (dự kiến đỏ)
    await expect.soft(headCheck(page)).toHaveAccessibleName(/\S/u);
    await expect.soft(rowCheck(page, 'W-001')).toHaveAccessibleName(/\S/u);
    await captureEvidence(page, 'E10_10E-E-004_sort_checkbox_names.png');
  });

  await test.step('[10E-E-005] aria-sort các cột', async () => {
    // đang sắp theo Chiều dày tăng dần (bước C-009); Table.tsx:172
    await expect.soft(head('Chiều dày')).toHaveAttribute('aria-sort', 'ascending');
    await expect.soft(head('Mã cấu kiện')).toHaveAttribute('aria-sort', 'none');
    await head('Chiều dày').click();
    await expect.soft(head('Chiều dày')).toHaveAttribute('aria-sort', 'descending');
    await captureEvidence(page, 'E10_10E-E-005_sort_aria_sort.png');
  });

  await test.step('[10E-E-006] thứ tự Tab', async () => {
    await page.getByRole('button', { name: 'collapsed', exact: true }).focus(); // nút state cuối, ListReviewDemo.tsx:66
    await page.keyboard.press('Tab');
    await expect.soft(page.getByRole('treeitem').filter({ hasText: 'Kiến trúc' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect.soft(tierItem).toBeFocused();
    await page.keyboard.press('Tab');
    await expect.soft(page.getByRole('treeitem').filter({ hasText: 'Tầng 02' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect.soft(region(page)).toBeFocused(); // ListReviewDemo.tsx:101 tabIndex=0
    await captureEvidence(page, 'E10_10E-E-006_sort_tab_order.png');
  });

  await test.step('[10E-E-007] TreeItem role và aria-expanded', async () => {
    const root = page.getByRole('treeitem').filter({ hasText: 'Kiến trúc' });
    await expect.soft(page.getByRole('treeitem')).toHaveCount(3);
    await expect.soft(root).toHaveAttribute('aria-expanded', 'true'); // TreeItem.tsx:54-66
    await root.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press(' ');
    await expect.soft(root).toHaveAttribute('aria-expanded', 'true'); // không onClick → không đổi
    expect.soft(pageErrors).toEqual([]);
    await captureEvidence(page, 'E10_10E-E-007_sort_treeitem_aria.png');
  });
});
