// QA-10 P13 — FeedbackDemo (dev route /feedback-demo, mock dev server). Source: src/screens/FeedbackDemo.tsx (FD),
// src/components/feedback/{Toast,ProgressOverlay,PipelineStepper,InlineAlert}.tsx. Flows: flows-C4.md FL-10E-12, FL-10E-13.
import { devTest as test, expect } from './support/p10/devServer';
import { captureEvidence } from './support/evidence';
import { STATES, STEP_NAMES, barWidth, frames, openFeedback, stateButton, toastRegion, toasts } from './support/p10/P13';

test('SCR-40e-5 · FL-10E-12 · anon · FeedbackDemo: toast', async ({ devPage: page }) => {
  test.setTimeout(120_000);
  await openFeedback(page);

  await test.step('[10E-A-055] 7 state buttons', async () => { // FD:43-55
    for (const s of STATES) await expect.soft(stateButton(page, s)).toBeVisible();
    await expect.soft(page.getByRole('button', { name: /^(Empty|Loading|Partial|Error|Success|Unprivileged|Collapsed)$/u })).toHaveCount(7);
    await captureEvidence(page, 'E10_10E-A-055_feedback_buttons.png');
  });

  await test.step('[10E-A-056] Test Undo Toast shows text and Hoàn tác', async () => { // FD:59
    await page.getByRole('button', { name: 'Test Undo Toast', exact: true }).click();
    const toast = toasts(page, 'Đã xoá 1 đối tượng.');
    await expect.soft(toast).toBeVisible();
    await expect.soft(toast.getByRole('button', { name: 'Hoàn tác' })).toBeVisible();
    await captureEvidence(page, 'E10_10E-A-056_feedback_undo_toast.png');
  });

  await test.step('[10E-A-057] Hoàn tác leaves and a confirmation toast appears', async () => { // FD:20, Toast.tsx:122
    await toasts(page, 'Đã xoá 1 đối tượng.').getByRole('button', { name: 'Hoàn tác' }).click();
    await expect.soft(toasts(page, 'Đã xoá 1 đối tượng.')).toHaveCount(0);
    await expect.soft(toasts(page, 'Đã hoàn tác thao tác.')).toBeVisible();
    await captureEvidence(page, 'E10_10E-A-057_feedback_undone.png');
  });

  await test.step('[10E-C-023] two undos in a row: one confirmation per toast, no doubling', async () => { // Toast.tsx:122-128
    await openFeedback(page); // fresh provider: no leftover toast folds into the "peek" stack
    const trigger = page.getByRole('button', { name: 'Test Undo Toast', exact: true });
    await trigger.click();
    await trigger.click();
    await expect(toasts(page, 'Đã xoá 1 đối tượng.')).toHaveCount(2);
    await toasts(page).first().getByRole('button', { name: 'Hoàn tác' }).click(); // newest = DOM-first, full height
    await expect(toasts(page, 'Đã xoá 1 đối tượng.')).toHaveCount(1);
    await toasts(page, 'Đã xoá 1 đối tượng.').getByRole('button', { name: 'Hoàn tác' }).press('Enter'); // peek slot (4 px, mouse cannot reach): keyboard is the real path
    await expect.soft(toasts(page, 'Đã xoá 1 đối tượng.')).toHaveCount(0);
    await expect.soft(toasts(page, 'Đã hoàn tác thao tác.')).toHaveCount(2);
    await expect.soft(toastRegion(page).getByRole('button', { name: 'Hoàn tác' })).toHaveCount(0);
    await captureEvidence(page, 'E10_10E-C-023_feedback_double_undo.png');
  });

  await test.step('[10E-C-025] ⚑ double-click Hoàn tác undoes only once', async () => { // Toast.tsx onUndoClick does not guard isExiting
    await openFeedback(page);
    await page.getByRole('button', { name: 'Test Undo Toast', exact: true }).click();
    const toast = toasts(page, 'Đã xoá 1 đối tượng.');
    await expect(toast).toBeVisible();
    await toast.getByRole('button', { name: 'Hoàn tác' }).dblclick();
    await expect.soft(toasts(page, 'Đã hoàn tác thao tác.')).toHaveCount(1);
    await captureEvidence(page, 'E10_10E-C-025_feedback_double_click_undo.png');
  });

  await test.step('[10E-A-058] Test Warning Toast', async () => { // FD:60
    await openFeedback(page);
    await page.getByRole('button', { name: 'Test Warning Toast', exact: true }).click();
    await expect.soft(toasts(page, 'Mạng chập chờn, đang thử lại.')).toBeVisible();
    await captureEvidence(page, 'E10_10E-A-058_feedback_warning.png');
  });

  await test.step('[10E-A-059] Test Error Toast', async () => { // FD:61
    await page.getByRole('button', { name: 'Test Error Toast', exact: true }).click();
    await expect.soft(toasts(page, 'Không thể kết nối đến máy chủ AI.')).toBeVisible();
    await captureEvidence(page, 'E10_10E-A-059_feedback_error.png');
  });

  await test.step('[10E-A-061] hover holds the countdown bar', async () => { // Toast.tsx isHeld; bar = div[aria-hidden] > div
    await openFeedback(page);
    await page.getByRole('button', { name: 'Test Undo Toast', exact: true }).click();
    const toast = toasts(page).first();
    await expect(toast).toBeVisible();
    await expect.poll(() => barWidth(toast)).toBeLessThan(100); // running first
    await toast.hover();
    await frames(page, 3);
    const held = await barWidth(toast);
    await frames(page, 30); // ~0.5 s of frames while hovered
    expect.soft(await barWidth(toast)).toBe(held);
    await captureEvidence(page, 'E10_10E-A-061_feedback_hover_hold.png');
    await page.mouse.move(0, 0);
    await expect.poll(() => barWidth(toast)).toBeLessThan(held);
  });

  await test.step('[10E-A-062] four toasts: two slots + summary', async () => { // Toast.tsx queue>3 branch
    await openFeedback(page);
    const warn = page.getByRole('button', { name: 'Test Warning Toast', exact: true });
    for (let i = 0; i < 4; i++) await warn.click();
    await expect.soft(toasts(page, 'Đã thực hiện 2 thay đổi')).toBeVisible();
    await expect.soft(toasts(page)).toHaveCount(3);
    await captureEvidence(page, 'E10_10E-A-062_feedback_summary.png');
  });

  await test.step('[10E-A-063] Hoàn tác on the summary shrinks the group by one', async () => { // Toast.tsx handleSummaryUndo
    await page.getByRole('button', { name: 'Test Warning Toast', exact: true }).click();
    const summary = toasts(page, 'Đã thực hiện 3 thay đổi');
    await expect(summary).toBeVisible();
    await summary.getByRole('button', { name: 'Hoàn tác' }).press('Enter'); // peek slot (4 px, mouse cannot reach): keyboard is the real path
    await expect.soft(toasts(page, 'Đã thực hiện 2 thay đổi')).toBeVisible();
    await expect.soft(toasts(page, 'Đã thực hiện 3 thay đổi')).toHaveCount(0);
    await captureEvidence(page, 'E10_10E-A-063_feedback_summary_undo.png');
  });

  await test.step('[10E-A-060] toast closes by itself after about 8000 ms', async () => { // undoTicket.ts:18 UNDO_WINDOW_MS
    await openFeedback(page);
    await page.getByRole('button', { name: 'Test Warning Toast', exact: true }).click();
    const toast = toasts(page, 'Mạng chập chờn, đang thử lại.');
    await expect(toast).toBeVisible();
    const t0 = Date.now();
    await expect(toast).toHaveCount(0, { timeout: 12_000 });
    const elapsed = Date.now() - t0;
    expect.soft(elapsed).toBeGreaterThan(6_000);
    expect.soft(elapsed).toBeLessThan(11_000);
    await captureEvidence(page, 'E10_10E-A-060_feedback_autoclose.png');
  });

  await test.step('[10E-E-014] toast region a11y', async () => { // Toast.tsx:144,215,223
    await page.getByRole('button', { name: 'Test Warning Toast', exact: true }).click();
    const region = toastRegion(page);
    await expect.soft(region).toHaveAttribute('aria-live', 'polite');
    const toast = region.locator(':scope > div').filter({ hasText: 'Mạng chập chờn, đang thử lại.' });
    await expect.soft(toast).toBeVisible();
    await expect.soft(toast).toHaveAttribute('role', 'status');
    await expect.soft(toast).toHaveAttribute('aria-atomic', 'true');
    await captureEvidence(page, 'E10_10E-E-014_feedback_region_a11y.png');
  });
});

test('SCR-40e-5 · FL-10E-13 · anon · FeedbackDemo: bảy trạng thái', async ({ devPage: page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await openFeedback(page);
  const dialog = page.getByRole('dialog', { name: 'Đang xử lý...' });
  const alert = page.getByRole('alert');
  const body = page.locator('body');

  await test.step('[10E-B-034] Empty state', async () => { // FD:68-70 (default state)
    await expect.soft(page.getByText('Chưa có tầng nào')).toBeVisible();
    await expect.soft(page.getByText('Tải lên một bản vẽ mặt bằng (.png, .jpg, .pdf, .dwg) để bắt đầu.')).toBeVisible();
    await expect.soft(page.getByRole('button', { name: 'Tải lên bản vẽ' })).toBeVisible();
    await captureEvidence(page, 'E10_10E-B-034_feedback_empty.png');
  });

  await test.step('[10E-B-035] Loading state', async () => { // FD:23-30,75-86, PipelineStepper:63-67
    await stateButton(page, 'Loading').click();
    await expect.soft(dialog).toBeVisible();
    await expect.soft(dialog).toContainText('45%');
    await expect.soft(page.getByRole('listitem')).toHaveCount(6);
    await expect.soft(page.getByText('Còn khoảng 2 phút')).toBeVisible();
    await expect.soft(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '65');
    await captureEvidence(page, 'E10_10E-B-035_feedback_loading.png');
  });

  await test.step('[10E-B-036] stepper names and aria-labels', async () => { // PipelineStepper:81
    const status = ['done', 'done', 'running', 'queued', 'queued', 'queued'];
    for (const [i, name] of STEP_NAMES.entries()) {
      await expect.soft(page.getByRole('listitem').nth(i)).toHaveAttribute('aria-label', `${name} — ${status[i]}`);
      await expect.soft(page.getByText(name, { exact: true })).toBeVisible();
    }
    await captureEvidence(page, 'E10_10E-B-036_feedback_steps.png');
  });

  await test.step('[10E-E-017] ProgressOverlay is a modal dialog that leaves the state buttons uncovered', async () => { // ProgressOverlay:25-27
    await expect.soft(dialog).toHaveAttribute('aria-modal', 'true');
    const overlap = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]')!.getBoundingClientRect();
      return Array.from(document.querySelectorAll('button')).filter((b) => {
        const r = b.getBoundingClientRect();
        return r.left < d.right && r.right > d.left && r.top < d.bottom && r.bottom > d.top;
      }).length;
    });
    expect.soft(overlap).toBe(0);
    await captureEvidence(page, 'E10_10E-E-017_feedback_overlay_a11y.png');
  });

  await test.step('[10E-B-037] Partial state', async () => { // FD:93-96
    await stateButton(page, 'Partial').click();
    await expect.soft(page.getByText('Thiếu kích thước tổng')).toBeVisible();
    await expect.soft(page.getByText('Hệ thống chỉ nhận được một phần kích thước. Bạn nên dùng thước để xác nhận chiều dài tường.')).toBeVisible();
    await expect.soft(page.getByRole('button', { name: 'Thêm thước đo' })).toBeVisible();
    await expect.soft(page.getByText('Content', { exact: true })).toBeVisible();
    await captureEvidence(page, 'E10_10E-B-037_feedback_partial.png');
  });

  await test.step('[10E-E-015] InlineAlert role=alert', async () => { // InlineAlert:44
    await expect.soft(alert).toHaveCount(1);
    await expect.soft(alert).toContainText('Thiếu kích thước tổng');
    await captureEvidence(page, 'E10_10E-E-015_feedback_alert_role.png');
  });

  await test.step('[10E-B-038] Error state', async () => { // FD:105-109,34-38
    await stateButton(page, 'Error').click();
    await expect.soft(page.getByText('Lỗi phân tích bản vẽ')).toBeVisible();
    await expect.soft(page.getByText('Chất lượng ảnh quá thấp hoặc độ phân giải không đủ để nhận diện tường. Vui lòng tải lên ảnh sắc nét hơn.')).toBeVisible();
    await expect.soft(page.getByRole('button', { name: 'Tải ảnh khác' })).toBeVisible();
    await expect.soft(page.getByText('SEG-2041')).toBeVisible();
    await expect.soft(page.getByText('Lỗi OOM')).toBeVisible();
    await expect.soft(page.getByRole('listitem').nth(1)).toHaveAttribute('aria-label', 'Nhận diện tường (SegFormer) — failed');
    await expect.soft(page.getByRole('button', { name: 'Thử lại' })).toHaveCount(0);
    await captureEvidence(page, 'E10_10E-B-038_feedback_error.png');
  });

  await test.step('[10E-B-039] Success state', async () => { // FD:117-119
    await stateButton(page, 'Success').click();
    await expect.soft(page.getByText('Đã xử lý xong')).toBeVisible();
    await expect.soft(page.getByText('Mô hình 3D đã sẵn sàng.')).toBeVisible();
    await expect.soft(page.getByText('Content', { exact: true })).toBeVisible();
    await captureEvidence(page, 'E10_10E-B-039_feedback_success.png');
  });

  await test.step('[10E-B-040] Unprivileged state', async () => { // FD:128-131
    await stateButton(page, 'Unprivileged').click();
    await expect.soft(page.getByText('Quyền truy cập hạn chế')).toBeVisible();
    await expect.soft(page.getByText('Bạn chỉ có quyền xem dự án này. Các thay đổi sẽ không được lưu.')).toBeVisible();
    await expect.soft(page.getByRole('button', { name: 'Yêu cầu quyền sửa' })).toBeVisible();
    await captureEvidence(page, 'E10_10E-B-040_feedback_unprivileged.png');
  });

  await test.step('[10E-B-041] Collapsed state', async () => { // FD:136
    await stateButton(page, 'Collapsed').click();
    await expect.soft(page.getByText('Bảng điều khiển', { exact: true })).toBeVisible();
    await captureEvidence(page, 'E10_10E-B-041_feedback_collapsed.png');
  });

  await test.step('[10E-A-064] the four action buttons do nothing', async () => { // FD:70,95,107,130 (onClick empty)
    const cases = [['Empty', 'Tải lên bản vẽ'], ['Partial', 'Thêm thước đo'], ['Error', 'Tải ảnh khác'], ['Unprivileged', 'Yêu cầu quyền sửa']] as const;
    for (const [state, action] of cases) {
      await stateButton(page, state).click();
      const button = page.getByRole('button', { name: action });
      await expect(button).toBeVisible();
      const before = await body.innerHTML();
      await button.click();
      expect.soft(await body.innerHTML(), `${action} changed the DOM`).toBe(before);
    }
    expect.soft(errors, 'console errors').toEqual([]);
    await captureEvidence(page, 'E10_10E-A-064_feedback_actions_noop.png');
  });

  await test.step('[10E-A-065] collapsed card click does nothing', async () => { // FD:136
    await stateButton(page, 'Collapsed').click();
    const card = page.getByText('Bảng điều khiển', { exact: true });
    await expect(card).toBeVisible();
    const before = await body.innerHTML();
    await card.click();
    expect.soft(await body.innerHTML()).toBe(before);
    await captureEvidence(page, 'E10_10E-A-065_feedback_collapsed_click.png');
  });

  await test.step('[10E-C-021] cycling the seven buttons shows one block each time', async () => {
    const marker = {
      Empty: page.getByText('Chưa có tầng nào'), Loading: dialog, Partial: page.getByText('Thiếu kích thước tổng'),
      Error: page.getByText('Lỗi phân tích bản vẽ'), Success: page.getByText('Đã xử lý xong'),
      Unprivileged: page.getByText('Quyền truy cập hạn chế'), Collapsed: page.getByText('Bảng điều khiển', { exact: true }),
    };
    for (const s of [...STATES, ...STATES]) {
      await stateButton(page, s).click();
      await expect.soft(marker[s]).toHaveCount(1);
      for (const other of STATES) if (other !== s) await expect.soft(marker[other]).toHaveCount(0);
    }
    await captureEvidence(page, 'E10_10E-C-021_feedback_cycle.png');
  });

  await test.step('[10E-C-022] a toast survives a state change', async () => { // ToastProvider wraps DemoContent (FD:146-151)
    await page.getByRole('button', { name: 'Test Warning Toast', exact: true }).click();
    const toast = toasts(page, 'Mạng chập chờn, đang thử lại.');
    await expect(toast).toBeVisible();
    await stateButton(page, 'Success').click();
    await expect.soft(page.getByText('Đã xử lý xong')).toBeVisible();
    await expect.soft(toast).toBeVisible();
    await captureEvidence(page, 'E10_10E-C-022_feedback_toast_kept.png');
  });

  await test.step('[10E-E-016] keyboard reaches 7 state + 3 toast buttons with a focus ring', async () => { // FD:46 (focus:ring-2)
    await openFeedback(page);
    await stateButton(page, 'Empty').focus();
    const order = [...STATES.slice(1), 'Test Undo Toast', 'Test Warning Toast', 'Test Error Toast'];
    await expect.soft(stateButton(page, 'Empty')).toBeFocused();
    for (const name of order) {
      await page.keyboard.press('Tab');
      const b = page.getByRole('button', { name, exact: true });
      await expect.soft(b).toBeFocused();
      if ((STATES as readonly string[]).includes(name)) {
        await expect.soft(b).not.toHaveCSS('box-shadow', 'none');
        await page.keyboard.press('Enter');
      }
    }
    await page.keyboard.press('Enter'); // focus is on "Test Error Toast"
    await expect.soft(toasts(page, 'Không thể kết nối đến máy chủ AI.')).toBeVisible();
    await expect.soft(page.getByText('Bảng điều khiển', { exact: true })).toBeVisible(); // Enter on "Collapsed" switched state
    await captureEvidence(page, 'E10_10E-E-016_feedback_keyboard.png');
  });
});
