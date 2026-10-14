/**
 * QA-10 P7 — SCR-40 /design-system/states (dev server mock): search + three switches (FL-10D-07),
 * quick check, Esc, collapse (FL-10D-08). Source: src/screens/system/StateGallery/*.
 */
import { captureEvidence } from './support/evidence';
import { devTest as test, expect } from './support/p10/devServer';
import {
  SELECTED_LABEL,
  checkPanelHeading,
  emptyTitle,
  openStates,
  pickScreen,
  activeName,
  preview,
  resultTable,
  runButton,
  searchBox,
  toggle,
  tree,
} from './support/p10/P7';

const SHOT = (id: string, slug: string) => `D10_${id}_${slug}.png`;

test('SCR-40 · FL-10D-07 · anon · states: tìm màn và ba công tắc', async ({ devPage: page }) => {
  await openStates(page);
  const rowCount = await tree(page).getByRole('button').count();
  const groupHeads = tree(page).getByRole('heading', { level: 3 });

  await test.step('[10D-C-301] tìm "tài khoản": chỉ màn khớp, nhóm rỗng ẩn', async () => {
    await searchBox(page).fill('tài khoản'); // useStateGallery.ts:317-330
    await expect(tree(page).getByRole('button', { name: /^Cài đặt tài khoản/ })).toBeVisible();
    await expect.poll(() => tree(page).getByRole('button').count()).toBeLessThan(rowCount);
    await expect.soft(groupHeads).not.toHaveCount(8);
    await captureEvidence(page, SHOT('10D-C-301', 'search_account'));
  });

  await test.step('[10D-C-302] tìm "admin" (area): ra màn nhóm B', async () => {
    await searchBox(page).fill('admin');
    await expect.soft(tree(page).getByRole('button', { name: /^Thư viện model/ })).toBeVisible();
    await expect.soft(groupHeads.filter({ hasText: 'nhóm B' })).toBeVisible();
    await expect.soft(tree(page).getByRole('button', { name: /^Cài đặt tài khoản/ })).toHaveCount(0);
    await captureEvidence(page, SHOT('10D-C-302', 'search_area_admin'));
  });

  await test.step('[10D-C-303] tìm "zzzz": báo không có màn khớp', async () => {
    await searchBox(page).fill('zzzz');
    await expect.soft(page.getByText('Không có màn nào khớp với từ đang tìm', { exact: true })).toBeVisible();
    await expect.soft(tree(page).getByRole('list')).toHaveCount(0);
    await captureEvidence(page, SHOT('10D-C-303', 'search_none'));
  });

  await test.step('[10D-C-304] toàn dấu cách: đủ cây', async () => {
    await searchBox(page).fill('   ');
    await expect.soft(tree(page).getByRole('button')).toHaveCount(rowCount);
    await expect.soft(groupHeads).toHaveCount(8);
    await captureEvidence(page, SHOT('10D-C-304', 'search_spaces'));
  });

  await test.step('[10D-C-305] màn đang chọn bị lọc mất → Chưa chọn màn nào', async () => {
    await searchBox(page).fill('');
    await pickScreen(page, SELECTED_LABEL);
    await searchBox(page).fill('admin');
    await expect.soft(emptyTitle(page)).toBeVisible(); // `screens.find(selectedScreenId)` → null (StateGallery.tsx:~190)
    await expect.soft(page.getByRole('heading', { name: SELECTED_LABEL, level: 2 })).toHaveCount(0);
    await captureEvidence(page, SHOT('10D-C-305', 'search_filters_selection'));
    await searchBox(page).fill('');
    await expect(page.getByRole('heading', { name: SELECTED_LABEL, level: 2 })).toBeVisible();
  });

  const html = page.locator('html');

  await test.step('[10D-C-306] Chủ đề tối bật/tắt', async () => {
    await toggle(page, 'Chủ đề tối').click(); // hooks/useTheme.ts:22-30
    await expect.soft(html).toHaveClass(/(^|\s)dark(\s|$)/);
    await captureEvidence(page, SHOT('10D-C-306', 'dark_on'));
    await toggle(page, 'Chủ đề tối').click();
    await expect.soft(html).not.toHaveClass(/(^|\s)dark(\s|$)/);
  });

  await test.step('[10D-C-307] Giảm chuyển động bật/tắt', async () => {
    await toggle(page, 'Giảm chuyển động').click(); // useStateGallery.ts:269-285
    await expect.soft(html).toHaveAttribute('data-reduced-motion', 'true');
    await captureEvidence(page, SHOT('10D-C-307', 'reduced_motion_on'));
    await toggle(page, 'Giảm chuyển động').click();
    await expect.soft(html).not.toHaveAttribute('data-reduced-motion', 'true');
  });

  await test.step('[10D-C-308] Lưới đo khoảng cách bật/tắt', async () => {
    const gridNote = preview(page).getByText('Lưới đo khoảng cách', { exact: true }); // StateGalleryFrames.tsx:SPACING_GRID_LABEL
    const gridLayers = preview(page).locator('div[aria-hidden="true"].absolute.inset-0');
    await toggle(page, 'Lưới đo khoảng cách').click();
    await expect.soft(gridNote).toBeVisible();
    await expect.soft(gridLayers).toHaveCount(7);
    await captureEvidence(page, SHOT('10D-C-308', 'spacing_grid_on'));
    await toggle(page, 'Lưới đo khoảng cách').click();
    await expect.soft(gridNote).toHaveCount(0);
    await expect.soft(gridLayers).toHaveCount(0);
  });

  await test.step('[10D-E-304] công tắc role=switch: tên, mô tả, Space bật/tắt', async () => {
    const hints: Record<string, string> = {
      'Chủ đề tối': 'Đổi giữa chủ đề sáng và chủ đề tối cho cả ứng dụng.', // StateGalleryToolbar.tsx:TOGGLE_*_HINT
      'Giảm chuyển động': 'Tắt hoạt ảnh khi duyệt khung xem trước.',
      'Lưới đo khoảng cách': 'Phủ lưới lên khung xem trước để đo khoảng cách.',
    };
    for (const [name, hint] of Object.entries(hints)) {
      await expect.soft(toggle(page, name)).toHaveAccessibleDescription(hint);
    }
    const sw = toggle(page, 'Giảm chuyển động');
    await sw.focus();
    await page.keyboard.press('Space'); // components/ui/Toggle.tsx:86-90 (native button)
    await expect.soft(sw).toHaveAttribute('aria-checked', 'true');
    await captureEvidence(page, SHOT('10D-E-304', 'switch_space'));
    await page.keyboard.press('Space');
    await expect.soft(sw).toHaveAttribute('aria-checked', 'false');
  });
});

test('SCR-40 · FL-10D-08 · anon · states: kiểm nhanh, Esc, thu gọn', async ({ devPage: page }) => {
  // MOTION_DURATIONS_MS.standard timer (useStateGallery.ts:390) held by a fake clock so the loading frame is observable.
  await page.clock.install();
  await openStates(page);
  await page.clock.pauseAt(Date.now() + 60_000);
  const rowCount = await tree(page).getByRole('button').count();
  const finishCheck = () => page.clock.runFor(1_000);
  const run = runButton(page);
  const softPoll = expect.configure({ soft: true });

  await test.step('[10D-C-311] chạy kiểm khi chưa chọn màn: mọi hàng chờ chạy', async () => {
    await run.click();
    await finishCheck();
    await expect(resultTable(page)).toBeVisible();
    const pending = Array(rowCount).fill(/chờ chạy/);
    await expect.soft(resultTable(page).locator('tbody tr td:nth-child(4)')).toHaveText(pending); // PREVIEW_NOT_SELECTED_DETAIL
    await expect.soft(resultTable(page).locator('tbody tr td:nth-child(5)')).toHaveText(pending);
    await captureEvidence(page, SHOT('10D-C-311', 'check_no_selection'));
  });

  await test.step('[10D-B-303] Chạy kiểm nhanh đang chạy: status "Đang tải bảng trạng thái", nút loading', async () => {
    await pickScreen(page, SELECTED_LABEL);
    await run.click();
    await expect(page.getByRole('status', { name: 'Đang tải bảng trạng thái' })).toBeVisible(); // StateGallery.tsx:99
    await expect(run).toBeDisabled(); // Button loading -> disabled (Button.tsx:41)
    await captureEvidence(page, SHOT('10D-B-303', 'check_loading'));
  });

  await test.step('[10D-C-309] kết quả kiểm: caption, bốn cột, Đạt/chờ chạy', async () => {
    await finishCheck();
    const table = resultTable(page);
    await expect(table).toBeVisible();
    await expect.soft(table.getByRole('columnheader', { name: 'Bảy trạng thái' })).toBeVisible();
    await expect.soft(table.getByRole('columnheader', { name: 'Mã màu thô' })).toBeVisible();
    await expect.soft(table.getByRole('columnheader', { name: 'Chuỗi tiếng Việt' })).toBeVisible();
    await expect.soft(table.getByRole('columnheader', { name: 'Khả năng tiếp cận' })).toBeVisible();
    await expect.soft(table.locator('tbody tr')).toHaveCount(rowCount);
    await expect.soft(table.locator('tbody tr td:nth-child(2)').first()).toContainText('Đạt');
    await expect.soft(table.locator('tbody tr td:nth-child(3)').first()).toContainText('chờ chạy');
    await expect.soft(table.locator('tbody tr td:nth-child(3)').first()).toContainText('node:fs');
    await captureEvidence(page, SHOT('10D-C-309', 'check_result_table'));
  });

  await test.step('[10D-C-310] ⚑ màn đang chọn có kết quả thật (Đạt/hỏng, không chờ chạy)', async () => {
    const row = resultTable(page).getByRole('row', { name: new RegExp(SELECTED_LABEL) });
    // Correct behaviour; bug while `isCheckRunning` is still true when querySelector runs (useStateGallery.ts:391-398).
    await expect.soft(row.getByRole('cell').nth(3)).toContainText(/Đạt|hỏng/);
    await expect.soft(row.getByRole('cell').nth(4)).toContainText(/Đạt|hỏng/);
    await captureEvidence(page, SHOT('10D-C-310', 'check_selected_real'));
  });

  await test.step('[10D-C-312] đang chạy: nút disabled; chạy lại mở bảng', async () => {
    await page.getByRole('button', { name: 'Đóng bảng kết quả' }).click();
    await expect.soft(checkPanelHeading(page)).toBeHidden();
    await run.click();
    await expect.soft(run).toBeDisabled(); // guard isCheckRunning (useStateGallery.ts:382-384)
    await expect.soft(checkPanelHeading(page)).toBeVisible(); // setIsPanelDismissed(false)
    await finishCheck();
    await expect(resultTable(page)).toBeVisible();
    await expect.soft(resultTable(page).getByRole('row')).toHaveCount(rowCount + 1);
    await captureEvidence(page, SHOT('10D-C-312', 'check_rerun'));
  });

  await test.step('[10D-E-301] Esc đóng bảng; Đóng bảng kết quả cũng đóng', async () => {
    await expect(checkPanelHeading(page)).toBeVisible();
    await page.keyboard.press('Escape'); // StateGalleryToolbar.tsx:159 useShortcut Escape scope sidePanel
    await expect.soft(checkPanelHeading(page)).toBeHidden();
    await captureEvidence(page, SHOT('10D-E-301', 'esc_closes_panel'));
    await run.click();
    await finishCheck();
    await expect(checkPanelHeading(page)).toBeVisible();
    await page.getByRole('button', { name: 'Đóng bảng kết quả' }).click();
    await expect.soft(checkPanelHeading(page)).toBeHidden();
  });

  await test.step('[10D-E-302] Esc khi bảng đóng không bắt phím', async () => {
    await page.keyboard.press('Escape');
    await expect.soft(checkPanelHeading(page)).toBeHidden();
    await expect.soft(page.getByRole('heading', { name: SELECTED_LABEL, level: 2 })).toBeVisible();
    await expect.soft(page).toHaveURL(/\/design-system\/states$/);
    await captureEvidence(page, SHOT('10D-E-302', 'esc_when_closed'));
  });

  await test.step('[10D-B-304] Thu gọn cây màn: nút Mở rộng, sr-only, khung vẫn hiện', async () => {
    await page.getByRole('button', { name: 'Thu gọn cây màn' }).click();
    await expect.soft(page.getByRole('button', { name: 'Mở rộng cây màn' })).toHaveCount(2); // header + CollapsedRail
    await expect.soft(page.getByText('Cây màn đang thu gọn', { exact: true })).toBeAttached();
    await expect.soft(preview(page)).toBeVisible();
    await expect.soft(tree(page)).toHaveCount(0);
    await captureEvidence(page, SHOT('10D-B-304', 'tree_collapsed'));
  });

  await test.step('[10D-E-305] ⚑ focus sau thu gọn/mở rộng ở nút cùng tên', async () => {
    // Header button keeps focus after collapse; the rail button unmounts on expand (StateGallery.tsx:83 vs :204).
    await softPoll.poll(() => activeName(page)).toBe('Mở rộng cây màn');
    await page.getByRole('button', { name: 'Mở rộng cây màn' }).last().click();
    await expect(tree(page)).toBeVisible();
    await softPoll.poll(() => activeName(page)).toBe('Thu gọn cây màn');
    await captureEvidence(page, SHOT('10D-E-305', 'focus_after_expand'));
  });

  await test.step('[10D-B-305] thu gọn khi chưa chọn màn: vẫn Chưa chọn màn nào', async () => {
    await openStates(page); // reload: selection is local state
    await expect(emptyTitle(page)).toBeVisible();
    await page.getByRole('button', { name: 'Thu gọn cây màn' }).click();
    await expect.soft(emptyTitle(page)).toBeVisible(); // empty precedes collapsed (useStateGallery.ts:338-341)
    await expect.soft(page.getByRole('button', { name: 'Mở rộng cây màn' })).toHaveCount(2);
    await captureEvidence(page, SHOT('10D-B-305', 'collapsed_empty'));
    await page.getByRole('button', { name: 'Mở rộng cây màn' }).first().click();
    await expect(tree(page)).toBeVisible();
  });

  await test.step('[10D-E-303] Tab từ ô Tìm màn tới nút màn; Enter chọn', async () => {
    await searchBox(page).focus();
    await page.keyboard.press('Tab');
    const first = tree(page).getByRole('button').first();
    await expect.soft(first).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.soft(first).toHaveAttribute('aria-current', 'true');
    await expect.soft(preview(page)).toBeVisible();
    await captureEvidence(page, SHOT('10D-E-303', 'tab_to_tree_enter'));
  });
});
