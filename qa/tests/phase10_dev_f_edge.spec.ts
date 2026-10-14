/** Phase 10 · dev server (mock) — Select/Combobox (FL-10E-04) and ListReviewDemo eight states (FL-10E-05). */
import { captureEvidence } from './support/evidence';
import { devTest as test, expect } from './support/p10/devServer';
import { DATA_ENTRY, LIST_REVIEW, comboSearch, comboTrigger, dataRows, overlay, selectTrigger, stateButton } from './support/p10/P9';

test('SCR-40e-1 · FL-10E-04 · anon · Select và Combobox', async ({ devPage: page }) => {
  test.setTimeout(120_000);
  await page.goto(DATA_ENTRY);
  await expect(page.getByRole('heading', { level: 1, name: 'Data Entry Components' })).toBeVisible();
  const select = selectTrigger(page);
  const combo = comboTrigger(page);
  const listbox = page.getByRole('listbox');

  await test.step('[10E-E-001] Select trigger: role combobox, aria-haspopup listbox, aria-expanded false→true', async () => {
    // Select.tsx:121-125
    await expect(select).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(select).toHaveAttribute('aria-expanded', 'false');
    await select.click();
    await expect(select).toHaveAttribute('aria-expanded', 'true');
    await expect(listbox).toBeVisible();
    await captureEvidence(page, 'E10_10E-E-001_select_aria.png');
  });

  await test.step('[10E-A-005] chọn "Tường gạch 110": trigger đổi, list đóng', async () => {
    await page.getByRole('option', { name: 'Tường gạch 110', exact: true }).click();
    await expect.soft(select).toContainText('Tường gạch 110');
    await expect.soft(select).toHaveAttribute('aria-expanded', 'false');
    await expect.soft(listbox).toBeHidden();
    await captureEvidence(page, 'E10_10E-A-005_select_pick.png');
  });

  await test.step('[10E-A-006] Enter mở, ArrowDown, Enter chọn kế tiếp; Esc chỉ đóng list', async () => {
    // useSelect.ts:44-90 — handleClose refocuses the trigger, so keys go to it.
    await select.focus();
    await page.keyboard.press('Enter');
    await expect.soft(select).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect.soft(select).toContainText('Tường gạch 220');
    await expect.soft(listbox).toBeHidden();
    await page.keyboard.press('Enter');
    await expect.soft(listbox).toBeVisible();
    await page.keyboard.press('Escape');
    await expect.soft(listbox).toBeHidden();
    await expect.soft(select).toContainText('Tường gạch 220');
    await expect.soft(page.getByRole('heading', { level: 1, name: 'Data Entry Components' })).toBeVisible();
    await captureEvidence(page, 'E10_10E-A-006_select_keys.png');
  });

  await test.step('[10E-E-002] mở Combobox: ô tìm role combobox + aria-autocomplete list; listbox; option aria-selected', async () => {
    await combo.click();
    const search = comboSearch(page);
    await expect.soft(search).toBeVisible();
    await expect.soft(search).toHaveAttribute('role', 'combobox');
    await expect.soft(search).toHaveAttribute('aria-autocomplete', 'list');
    await expect.soft(listbox).toBeVisible();
    await expect.soft(page.getByRole('option')).toHaveCount(5);
    await expect.soft(page.getByRole('option', { name: 'Vách thạch cao', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect.soft(page.getByRole('option', { name: 'Tường gạch 110', exact: true })).toHaveAttribute('aria-selected', 'false');
    await captureEvidence(page, 'E10_10E-E-002_combobox_aria.png');
  });

  await test.step('[10E-A-007] gõ "gạch": chỉ còn hai Tường gạch', async () => {
    await comboSearch(page).fill('gạch');
    await expect.soft(page.getByRole('option')).toHaveCount(2);
    await expect.soft(page.getByRole('option', { name: 'Tường gạch 110', exact: true })).toBeVisible();
    await expect.soft(page.getByRole('option', { name: 'Tường gạch 220', exact: true })).toBeVisible();
    await captureEvidence(page, 'E10_10E-A-007_combobox_filter.png');
  });

  await test.step('[10E-C-007] gõ "zzz": Không tìm thấy "zzz"', async () => {
    await comboSearch(page).fill('zzz');
    await expect.soft(page.getByRole('option')).toHaveCount(0);
    await expect.soft(listbox).toContainText('Không tìm thấy "zzz"'); // ComboboxDropdown.tsx:206
    await captureEvidence(page, 'E10_10E-C-007_combobox_empty.png');
  });

  await test.step('[10E-A-008] xoá, chọn bằng Enter một mục KHÁC giá trị đang có: trigger đổi', async () => {
    // Combobox starts at "Vách thạch cao" (DataEntryDemo.tsx:20,69), so pick "Vách kính cường lực" (catalog says thạch cao: deviation, would be a false green).
    // Highlight after a no-match filter is -1 (useCombobox.ts:68); with one hit one ArrowDown lands on index 0 either way.
    await comboSearch(page).fill('');
    await comboSearch(page).fill('kính');
    await expect.soft(page.getByRole('option')).toHaveCount(1);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect.soft(combo).toContainText('Vách kính cường lực');
    await expect.soft(combo).not.toContainText('Vách thạch cao');
    await expect.soft(listbox).toBeHidden();
    await captureEvidence(page, 'E10_10E-A-008_combobox_pick.png');
  });
});

test('SCR-40e-2 · FL-10E-05 · anon · ListReviewDemo: tám trạng thái', async ({ devPage: page }) => {
  test.setTimeout(120_000);
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  const rows = dataRows(page);
  const summary = page.getByText(/tường đã duyệt/u);
  const retry = page.getByRole('button', { name: 'Thử lại', exact: true });

  await test.step('[10E-A-012] tám nút state bar', async () => {
    await page.goto(LIST_REVIEW);
    await expect(page.getByText('States:', { exact: true })).toBeVisible(); // ListReviewDemo.tsx:73
    for (const s of ['default', 'empty', 'loading', 'partial', 'error', 'success', 'permission', 'collapsed']) {
      await expect(stateButton(page, s)).toBeVisible();
    }
    await captureEvidence(page, 'E10_10E-A-012_list_statebar.png');
  });

  await test.step('[10E-B-010] default: 48 hàng, W-001 "220 mm" "0,62" "Tầng 01" "Chưa duyệt"', async () => {
    await expect.soft(rows).toHaveCount(48);
    const w1 = rows.filter({ hasText: 'W-001' });
    await expect.soft(w1).toContainText(/220\s*mm/u);
    await expect.soft(w1).toContainText('0,62');
    await expect.soft(w1).toContainText('Tầng 01');
    await expect.soft(w1).toContainText('Chưa duyệt');
    await captureEvidence(page, 'E10_10E-B-010_list_default.png');
  });

  await test.step('[10E-B-011] hàng attention: đúng 10', async () => {
    await expect.soft(page.locator('tbody tr.bg-state-attention-tint')).toHaveCount(10);
    await captureEvidence(page, 'E10_10E-B-011_list_attention.png');
  });

  await test.step('[10E-B-012] thanh dưới "0/48 tường đã duyệt"', async () => {
    await expect.soft(summary).toHaveText('0/48 tường đã duyệt');
    await captureEvidence(page, 'E10_10E-B-012_list_summary.png');
  });

  await test.step('[10E-B-013] empty: Chưa có dữ liệu / mô tả / Thêm mới', async () => {
    await stateButton(page, 'empty').click();
    await expect.soft(page.getByText('Chưa có dữ liệu', { exact: true })).toBeVisible();
    await expect.soft(page.getByText('Hãy thử thay đổi bộ lọc hoặc thêm dự án mới.')).toBeVisible();
    await expect.soft(page.getByRole('button', { name: 'Thêm mới' })).toBeVisible();
    await captureEvidence(page, 'E10_10E-B-013_list_empty.png');
  });

  await test.step('[10E-B-021] dữ liệu dưới lớp phủ empty: "0/48" không đổi', async () => {
    await expect.soft(summary).toHaveText('0/48 tường đã duyệt');
    await captureEvidence(page, 'E10_10E-B-021_list_empty_summary.png');
  });

  await test.step('[10E-B-014] loading: 8 skeleton, 0 hàng W-xxx', async () => {
    await stateButton(page, 'loading').click();
    await expect.soft(page.locator('tbody tr:has(.animate-pulse)')).toHaveCount(8);
    await expect.soft(rows).toHaveCount(0);
    await captureEvidence(page, 'E10_10E-B-014_list_loading.png');
  });

  await test.step('[10E-B-015] partial: banner lỗi trang 2 + "Thử lại"', async () => {
    await stateButton(page, 'partial').click();
    await expect.soft(page.getByText('Có lỗi khi tải trang 2. Một số dữ liệu có thể bị thiếu.')).toBeVisible();
    await expect.soft(retry).toBeVisible();
    await captureEvidence(page, 'E10_10E-B-015_list_partial.png');
  });

  await test.step('[10E-A-026] "Thử lại" (partial) rồi "Thêm mới" (empty): DOM không đổi, không lỗi console', async () => {
    // Both buttons have no handler (ListReviewDemo.tsx:158, 118).
    const body = page.locator('body');
    const partialBefore = await body.innerText();
    await retry.click();
    await expect.soft(body).toHaveText(partialBefore, { useInnerText: true });
    await stateButton(page, 'empty').click();
    await expect(page.getByRole('button', { name: 'Thêm mới' })).toBeVisible();
    const emptyBefore = await body.innerText();
    await page.getByRole('button', { name: 'Thêm mới' }).click();
    await expect.soft(body).toHaveText(emptyBefore, { useInnerText: true });
    expect.soft(consoleErrors).toEqual([]);
    await captureEvidence(page, 'E10_10E-A-026_list_noop_buttons.png');
  });

  await test.step('[10E-B-016] error: lỗi tải + "Thử lại"', async () => {
    await stateButton(page, 'error').click();
    await expect.soft(page.getByText('Đã có lỗi xảy ra khi tải dữ liệu')).toBeVisible();
    await expect.soft(retry).toBeVisible();
    await captureEvidence(page, 'E10_10E-B-016_list_error.png');
  });

  await test.step('[10E-A-025] "Thử lại" (error): về default, 48 hàng', async () => {
    await retry.click();
    await expect.soft(overlay(page)).toHaveCount(0);
    await expect.soft(rows).toHaveCount(48);
    await captureEvidence(page, 'E10_10E-A-025_list_error_retry.png');
  });

  await test.step('[10E-B-017] success: "Duyệt dữ liệu thành công!"', async () => {
    await stateButton(page, 'success').click();
    await expect.soft(page.getByText('Duyệt dữ liệu thành công!')).toBeVisible();
    await captureEvidence(page, 'E10_10E-B-017_list_success.png');
  });

  await test.step('[10E-B-018] permission: "Bạn không có quyền xem dữ liệu này"', async () => {
    await stateButton(page, 'permission').click();
    await expect.soft(page.getByText('Bạn không có quyền xem dữ liệu này')).toBeVisible();
    await captureEvidence(page, 'E10_10E-B-018_list_permission.png');
  });

  await test.step('[10E-B-019] collapsed: chỉ hộp kiểm + "Mã cấu kiện"', async () => {
    await stateButton(page, 'collapsed').click();
    await expect.soft(page.getByRole('columnheader', { name: 'Mã cấu kiện' })).toBeVisible();
    await expect.soft(page.locator('thead th')).toHaveCount(2);
    await expect.soft(page.getByRole('columnheader', { name: 'Chiều dày' })).toHaveCount(0);
    await expect.soft(page.getByRole('columnheader', { name: 'Độ tin cậy' })).toHaveCount(0);
    await captureEvidence(page, 'E10_10E-B-019_list_collapsed.png');
  });
});
