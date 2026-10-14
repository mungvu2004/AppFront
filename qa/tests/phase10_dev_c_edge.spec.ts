/**
 * Phase 10 (QA-10 P11) - ShellDemo on the mock dev server (SCR-40e-3): FL-10E-08, FL-10E-09. Anon, no stack.
 * Sources: src/screens/ShellDemo.tsx, src/components/shell/{AppShell,ShortcutHelp,Breadcrumb,StatusBar}.tsx,
 * src/components/overlay/CommandPalette.tsx, src/lib/input/focusOrder.ts.
 * Known flags: N-2 (`?` may open two dialogs, step 10E-A-033 is hard), shell panels animate (polled).
 */
import { devTest as test, expect } from './support/p10/devServer';
import { captureEvidence } from './support/evidence';
import { BTN, LEFT_KEY, RIGHT_KEY, TOOLS, clearShellStorage, openShell, panelWrapper, widthOf } from './support/p10/P11';

test('SCR-40e-3 · FL-10E-08 · anon · ShellDemo: panel, công cụ, landmark', async ({ devPage: page }) => {
  await openShell(page);
  const left = panelWrapper(page, 'Architecture');
  const right = panelWrapper(page, 'Properties');
  const btn = (name: string) => page.getByRole('button', { name, exact: true });
  const shot = (id: string, slug: string) => captureEvidence(page, `E10_${id}_shell_${slug}.png`);
  try {
    await test.step('[10E-B-022] hai panel mở', async () => {
      await expect(btn(BTN.collapseLeft)).toBeVisible();
      await expect.poll(() => widthOf(left)).toBe(280); // AppShell.tsx:202
      await expect.poll(() => widthOf(right)).toBe(344); // AppShell.tsx:243
      await shot('10E-B-022', 'panels_open');
    });
    await test.step('[10E-A-028] thu gọn panel trái', async () => {
      await btn(BTN.collapseLeft).click();
      await expect.soft(btn(BTN.expandLeft)).toBeVisible();
      expect.soft(await page.evaluate((k) => localStorage.getItem(k), LEFT_KEY)).toBe('true');
      await shot('10E-A-028', 'left_collapsed');
    });
    await test.step('[10E-B-023] trái thu gọn aria-hidden', async () => {
      await expect.soft(left).toHaveAttribute('aria-hidden', 'true');
      await shot('10E-B-023', 'left_hidden');
    });
    await test.step('[10E-C-014] reload giữ thu gọn', async () => {
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Canvas Area', exact: true })).toBeVisible();
      await expect.soft(btn(BTN.expandLeft)).toBeVisible();
      await shot('10E-C-014', 'left_after_reload');
    });
    await test.step('[10E-A-029] thu gọn panel phải', async () => {
      await btn(BTN.collapseRight).click();
      await expect.soft(btn(BTN.expandRight)).toBeVisible();
      expect.soft(await page.evaluate((k) => localStorage.getItem(k), RIGHT_KEY)).toBe('true');
      await shot('10E-A-029', 'right_collapsed');
    });
    await test.step('[10E-B-024] phải thu gọn aria-hidden', async () => {
      await expect.soft(right).toHaveAttribute('aria-hidden', 'true');
      await shot('10E-B-024', 'right_hidden');
    });
    await test.step('[10E-A-030] phím [ rồi ]', async () => {
      await page.keyboard.press('['); // useKeyboardMap.ts shell.panel.left
      await expect.soft(btn(BTN.collapseLeft)).toBeVisible();
      await page.keyboard.press(']'); // useKeyboardMap.ts shell.panel.right
      await expect.soft(btn(BTN.collapseRight)).toBeVisible();
      await shot('10E-A-030', 'keys_reopen');
    });
    await test.step('[10E-A-031] bấm từng công cụ', async () => {
      for (const t of TOOLS) {
        await btn(t.name).click();
        await expect.soft(btn(t.name), t.name).toHaveAttribute('aria-pressed', 'true'); // IconButton.tsx:36
      }
      await shot('10E-A-031', 'tools_click');
    });
    await test.step('[10E-E-010] nhãn nút toolbar', async () => {
      const toolbar = page.getByRole('toolbar', { name: 'thanh công cụ' });
      for (const t of TOOLS) await expect.soft(toolbar.getByRole('button', { name: t.name, exact: true })).toBeVisible();
      await expect.soft(toolbar.getByRole('button')).toHaveCount(4);
      await shot('10E-E-010', 'tool_labels');
    });
    await test.step('[10E-A-032] phím V/W/M/D', async () => {
      for (const t of [TOOLS[1], TOOLS[2], TOOLS[3], TOOLS[0]]) {
        await page.keyboard.press(t.key); // canvas scope, useKeyboardMap.ts:50-72
        await expect.soft(btn(t.name), t.name).toHaveAttribute('aria-pressed', 'true');
      }
      await shot('10E-A-032', 'tools_keys');
    });
    await test.step('[10E-E-008] landmark', async () => {
      await expect.soft(page.getByRole('banner', { name: 'thanh trên cùng' })).toBeVisible();
      await expect.soft(page.getByRole('toolbar', { name: 'thanh công cụ' })).toBeVisible();
      await expect.soft(page.getByRole('main', { name: 'vùng bản vẽ' })).toBeVisible();
      await expect.soft(page.getByRole('complementary', { name: 'bảng bên phải' })).toHaveCount(1);
      await expect.soft(page.getByRole('contentinfo', { name: 'thanh trạng thái' })).toHaveCount(1);
      await expect.soft(page.getByRole('status', { name: 'Thanh trạng thái', exact: true })).toBeVisible();
      await shot('10E-E-008', 'landmarks');
    });
  } finally {
    await clearShellStorage(page);
  }
});

test('SCR-40e-3 · FL-10E-09 · anon · ShellDemo: hộp phím tắt, palette, breadcrumb, nội dung', async ({ devPage: page }) => {
  test.setTimeout(120_000);
  await openShell(page);
  const btn = (name: string) => page.getByRole('button', { name, exact: true });
  const shot = (id: string, slug: string) => captureEvidence(page, `E10_${id}_shell_${slug}.png`);
  const help = page.getByRole('dialog', { name: 'Phím tắt' }); // ShortcutHelp.tsx h2 id=titleId
  const palette = page.getByRole('dialog', { name: 'Tìm kiếm lệnh và điều hướng' }); // CommandPalette.tsx:157
  const crumbBtn = page.getByRole('button', { name: 'Chọn nhanh — đang ở Tầng 01', exact: true });
  try {
    await test.step('[10E-A-033] nút Phím tắt (?) và phím ?', async () => {
      await btn(BTN.help).click();
      await expect(page.getByRole('dialog')).toHaveCount(1);
      await page.keyboard.press('?'); // closes (shortcutHelp.toggleClose)
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.keyboard.press('?'); // useKeyboardMap.ts shell.shortcutHelp.open (global)
      await expect(page.getByRole('dialog')).toHaveCount(1); // N-2: GlobalShortcutHelp may add a 2nd
      await page.keyboard.press('?');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await btn(BTN.help).click();
      await expect(help).toBeVisible();
      await shot('10E-A-033', 'help_open');
    });
    await test.step('[10E-A-034] nội dung hộp phím tắt', async () => {
      for (const t of ['Công cụ', 'Chế độ xem', 'Hệ thống']) await expect.soft(help.getByRole('heading', { name: t, exact: true })).toBeVisible();
      for (const d of ['Chọn đối tượng', 'Vẽ tường', 'Thêm kích thước', 'Cửa / lỗ mở', 'Chuyển sang 2D', 'Chuyển sang 3D', 'Thu nhỏ', 'Phóng to',
        'Mở bảng tìm kiếm lệnh', 'Hoàn tác thay đổi', 'Hiện bảng phím tắt này', 'Đóng lớp hiện tại']) {
        await expect.soft(help.getByText(d, { exact: true })).toBeVisible(); // ShortcutHelp.tsx:29-54
      }
      for (const k of ['V', 'W', 'M', 'D', '2', '3', 'K', 'Z', 'Esc']) await expect.soft(help.locator('dd').getByText(k, { exact: true }).first()).toBeVisible();
      await expect.soft(help).toContainText('Nhấn ? hoặc Esc để đóng');
      await shot('10E-A-034', 'help_content');
    });
    await test.step('[10E-E-009] focus bị bẫy, aria-labelledby', async () => {
      await expect.soft(help).toHaveAttribute('aria-labelledby', /\S/);
      for (let i = 0; i < 4; i++) {
        await page.keyboard.press('Tab');
        await expect.poll(() => page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true);
      }
      await shot('10E-E-009', 'help_focus_trap');
    });
    await test.step('[10E-C-015] [ khi hộp mở', async () => {
      await page.keyboard.press('[');
      await expect.soft(btn(BTN.collapseLeft)).toBeVisible();
      await page.keyboard.press(']');
      await expect.soft(btn(BTN.collapseRight)).toBeVisible();
      await shot('10E-C-015', 'help_brackets_ignored');
    });
    await test.step('[10E-A-035] Esc và nút Đóng, focus trả về', async () => {
      await page.keyboard.press('Escape');
      await expect(help).toHaveCount(0);
      await expect.soft(btn(BTN.help)).toBeFocused(); // focusTrap restore
      await btn(BTN.help).click();
      await expect(help).toBeVisible();
      await help.getByRole('button', { name: BTN.closeHelp, exact: true }).click();
      await expect.soft(help).toHaveCount(0);
      await shot('10E-A-035', 'help_closed');
    });
    await test.step('[10E-A-036] Ctrl+K mở palette', async () => {
      await page.keyboard.press('Control+K');
      await expect(palette).toBeVisible();
      await expect.soft(palette.getByPlaceholder('Tìm lệnh, dự án, tầng, lớp...')).toBeVisible();
      const groups: Record<string, string[]> = {
        'Điều hướng': ['Đi đến lớp tường', 'Đi đến lớp kích thước', 'Chuyển sang chế độ 2D', 'Chuyển sang chế độ 3D'],
        'Hành động': ['Hoàn tác', 'Xuất bản bản vẽ', 'Tạo tầng mới'],
        'Hệ thống': ['Xem phím tắt', 'Chuyển giao diện sáng/tối'],
      };
      for (const [g, items] of Object.entries(groups)) {
        const grp = palette.getByRole('group', { name: g, exact: true });
        await expect.soft(grp).toBeVisible();
        for (const it of items) await expect.soft(grp.getByRole('option', { name: it })).toBeVisible();
      }
      await expect.soft(palette.getByRole('option')).toHaveCount(9);
      await shot('10E-A-036', 'palette_open');
    });
    await test.step('[10E-A-037] gõ zzz, Esc', async () => {
      await palette.getByPlaceholder('Tìm lệnh, dự án, tầng, lớp...').fill('zzz');
      await expect.soft(palette.getByText('Không tìm thấy "zzz"')).toBeVisible();
      await shot('10E-A-037', 'palette_empty');
      await page.keyboard.press('Escape');
      await expect.soft(palette).toHaveCount(0);
    });
    await test.step('[10E-A-038] breadcrumb', async () => {
      const nav = page.getByRole('navigation', { name: 'Đường dẫn trang' });
      await expect.soft(nav).toBeVisible();
      await expect.soft(nav.getByText('Dự án mẫu', { exact: true })).toBeVisible();
      await expect.soft(nav.getByText('Lớp tường', { exact: true })).toHaveAttribute('aria-current', 'page');
      await crumbBtn.click();
      const list = page.getByRole('listbox', { name: 'Chọn tầng', exact: true });
      await expect.soft(list).toBeVisible();
      await expect.soft(list.getByRole('option')).toHaveCount(5);
      for (const f of ['Tầng hầm', 'Tầng 01', 'Tầng 02', 'Tầng 03', 'Tầng mái']) await expect.soft(list.getByRole('option', { name: f })).toBeVisible();
      await shot('10E-A-038', 'breadcrumb_open');
    });
    await test.step('[10E-A-039] chọn Tầng 02', async () => {
      const list = page.getByRole('listbox', { name: 'Chọn tầng', exact: true });
      await list.getByRole('option', { name: 'Tầng 02' }).click();
      await expect.soft(list).toHaveCount(0);
      await expect.soft(crumbBtn).toBeVisible(); // onClick is empty (AppShell.tsx:132): crumb unchanged
      await shot('10E-A-039', 'breadcrumb_closed');
    });
    await test.step('[10E-A-040] nội dung panel', async () => {
      for (const t of ['Architecture', 'v2', 'Level 01', 'Level 02', 'Level 03', 'Properties', 'Dimensions', 'Length', '2400 mm', 'Height', '3200 mm']) {
        await expect.soft(page.getByText(t, { exact: true }), t).toBeVisible();
      }
      await expect.soft(page.getByRole('heading', { name: 'Levels', exact: true })).toBeVisible();
      await expect.soft(page.getByRole('heading', { name: 'Layers', exact: true })).toBeVisible();
      for (let i = 1; i <= 20; i++) await expect.soft(page.getByText(`Layer ${i}`, { exact: true }), `Layer ${i}`).toHaveCount(1);
      await shot('10E-A-040', 'panel_content');
    });
    await test.step('[10E-A-041] thanh trạng thái', async () => {
      const bar = page.getByRole('status', { name: 'Thanh trạng thái', exact: true });
      for (const t of ['X: 124,50', 'Y: 89,12', '1:100', '12 mm/px', 'Đã lưu lúc 14:32']) await expect.soft(bar).toContainText(t);
      await shot('10E-A-041', 'status_bar');
    });
    await test.step('[10E-A-042] liên kết bỏ qua', async () => {
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Canvas Area', exact: true })).toBeVisible();
      await page.keyboard.press('Tab');
      const skip = page.getByRole('link', { name: 'bỏ qua tới nội dung chính', exact: true }); // focusOrder.ts:87
      await expect.soft(skip).toBeFocused();
      await expect.soft(skip).toBeVisible();
      await shot('10E-A-042', 'skip_link');
      await page.keyboard.press('Enter');
      await expect.soft(page.getByRole('main', { name: 'vùng bản vẽ' })).toBeFocused();
    });
    await test.step('[10E-B-025] 1024: không nút panel phải, ] mở Drawer Properties', async () => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await expect.soft(page.getByRole('button', { name: /panel phải/ })).toHaveCount(0);
      await expect.soft(btn(BTN.collapseLeft)).toBeVisible();
      await page.keyboard.press(']');
      const drawer = page.getByRole('dialog').filter({ hasText: 'Properties' });
      await expect.soft(drawer).toBeVisible();
      await shot('10E-B-025', 'drawer_right_1024');
      await page.keyboard.press('Escape');
      await expect(drawer).toHaveCount(0);
    });
    await test.step('[10E-B-026] 768: không nút panel trái, [ mở Drawer Architecture', async () => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await expect.soft(page.getByRole('button', { name: /panel trái/ })).toHaveCount(0);
      await expect.soft(btn(BTN.help)).toBeVisible();
      await page.keyboard.press('[');
      const drawer = page.getByRole('dialog').filter({ hasText: 'Architecture' });
      await expect.soft(drawer).toBeVisible();
      await shot('10E-B-026', 'drawer_left_768');
    });
  } finally {
    await clearShellStorage(page);
  }
});
