/**
 * Phase 7 (QA-07b, pack P5) - EDGE flows of SCR-33 local preferences on `/tai-khoan`: "Giao diện" (theme, switches,
 * density, motion), the "Thông báo" matrix and "Phím tắt" read for semantics. Plan: QA-07b `flows-C2.md` FL-33R-01..04.
 * Short names (FE master 1e1c16b7, under `src/screens/account/AccountSettings/` unless a path is given):
 * AP AppearanceSection.tsx, UAP useAccountPreferences.ts, UAT useAccountTables.ts, NS NotificationsSection.tsx,
 * SS ShortcutsSection.tsx, UAS useAccountSettings.ts, FR src/components/ui/FieldRow.tsx, TG src/components/ui/Toggle.tsx,
 * SEG src/components/ui/SegmentedControl.tsx, CB src/components/ui/Checkbox.tsx.
 *
 * Real stack, no mock: OS preferences are browser emulation (`emulateMedia`). Every flow opens its own context with a
 * fresh `localStorage`, signs the pool user `p07-prefs-1` in (one login) and never writes to the server.
 *
 * ## Real-backend budget per run (429 limits)
 * - `POST /api/auth/login`: 1 admin API login + 1 user login per flow = 8 (limit LOGIN_IP_LIMIT 120 / 60 s).
 * - `PATCH /api/me`: 0. `PUT /api/me/avatar`: 0. `POST /api/me/password`: 0 (appearance and notifications are local only).
 * - `POST /api/auth/refresh`: 1 per page load + 1 per reload (limit 300 / 60 s).
 * - Pool invitations: only on the first use of the slot (`users_invite` 30 / 3600 s).
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { captureEvidence } from './support/evidence';
import {
  CHANNELS,
  DARK_CLASS,
  DENSITY,
  NOTIFICATION_DEFAULTS,
  REDUCE_MOTION,
  SHORTCUTS,
  SHOW_GRID,
  THEME_LABEL,
  VIEWPORT_DARK,
  block,
  box,
  cellName,
  readStoredTheme,
  themeGroup,
  themeRadio,
  toggle,
} from './support/p07/account';
import {
  activeStop,
  asPrefsUser,
  clickTogether,
  densityRadio,
  evName,
  flashes,
  focusOrder,
  hasRing,
  osScheme,
  prefRow,
  reloadPrefs,
  ringOf,
  settle,
  spaNavigate,
  storageKeys,
  watchFlash,
} from './support/p07/P5';

const html = (page: Page) => page.locator('html');
const REDUCED_ATTR = 'data-reduced-motion'; // UAP:111
const THEME_KEY = 'app-theme-mode';
const ev = (page: Page, id: string, slug: string) => captureEvidence(page, evName(id, slug) + '.png');
const checked = (loc: ReturnType<typeof themeRadio>) => expect.soft(loc).toHaveAttribute('aria-checked', 'true');
const notDark = (page: Page) => expect.soft(html(page)).not.toHaveClass(DARK_CLASS);
const hasClassToken = (token: string) => new RegExp(`(?:^|\\s)${token}(?:\\s|$)`, 'u');

test.describe('E07 SCR-33 preferences edge', () => {
  test('SCR-33 · FL-33R-01 · Chủ đề: sáng, tối, theo hệ thống, bàn phím', async ({ browser }) => {
    await asPrefsUser(browser, async (page, writes) => {
      await page.emulateMedia({ colorScheme: 'light' });

      await test.step('[33R-A-001] Tối', async () => {
        await themeRadio(page, 'dark').click(); // AP:150-174
        await expect(themeRadio(page, 'dark')).toHaveAttribute('aria-checked', 'true');
        await expect(html(page)).toHaveClass(DARK_CLASS); // UAP:479-488 -> useTheme
        await expect.poll(() => readStoredTheme(page)).toBe('dark');
        await ev(page, '33R-A-001', 'theme_dark');
      });

      await test.step('[33R-E-006] focus stays on the clicked radio', async () => {
        expect.soft(await activeStop(page)).toBe('radio:Tối');
        await ev(page, '33R-E-006', 'theme_focus_stays');
      });

      await test.step('[33R-A-002] Sáng', async () => {
        await themeRadio(page, 'light').click();
        await checked(themeRadio(page, 'light'));
        await notDark(page);
        await expect.poll(() => readStoredTheme(page)).toBe('light');
        await ev(page, '33R-A-002', 'theme_light');
      });

      await test.step('[33R-A-003] Theo hệ thống, OS light', async () => {
        await osScheme(page, 'light');
        await themeRadio(page, 'system').click(); // UAP:327-333
        await checked(themeRadio(page, 'system'));
        await notDark(page);
        await expect.poll(() => readStoredTheme(page)).toBe('light'); // resolved, not 'system'
        await ev(page, '33R-A-003', 'theme_system_os_light');
      });

      await test.step('[33R-A-005] OS flips while "Theo hệ thống" is selected', async () => {
        await osScheme(page, 'dark'); // UAP:310-324,361-365
        await expect.soft(html(page)).toHaveClass(DARK_CLASS);
        await expect.poll(() => readStoredTheme(page)).toBe('dark');
        await ev(page, '33R-A-005', 'theme_system_os_flip');
        await osScheme(page, 'light');
        await notDark(page);
        await expect.poll(() => readStoredTheme(page)).toBe('light');
        await checked(themeRadio(page, 'system'));
      });

      await test.step('[33R-C-002] explicit choice ignores an OS flip', async () => {
        await themeRadio(page, 'dark').click();
        await osScheme(page, 'dark');
        await osScheme(page, 'light'); // UAP:361-365,479 only `system` reads the OS
        await expect.soft(html(page)).toHaveClass(DARK_CLASS);
        await expect.poll(() => readStoredTheme(page)).toBe('dark');
        await themeRadio(page, 'light').click();
        await expect.poll(() => readStoredTheme(page)).toBe('light');
        await osScheme(page, 'dark');
        await notDark(page);
        await expect.poll(() => readStoredTheme(page)).toBe('light');
        await ev(page, '33R-C-002', 'theme_explicit_ignores_os');
      });

      await test.step('[33R-A-004] Theo hệ thống, OS dark', async () => {
        await themeRadio(page, 'light').click(); // OS is dark since the previous step
        await themeRadio(page, 'system').click();
        await expect.soft(html(page)).toHaveClass(DARK_CLASS);
        await expect.poll(() => readStoredTheme(page)).toBe('dark');
        await checked(themeRadio(page, 'system'));
        await ev(page, '33R-A-004', 'theme_system_os_dark');
      });

      await test.step('[33R-A-006] arrows move, check and focus; nothing is sent', async () => {
        await settle(page, async () => {
          await themeRadio(page, 'light').click();
          await page.keyboard.press('ArrowRight'); // AP:124-149 move(1)
          await checked(themeRadio(page, 'dark'));
          await expect.soft(themeRadio(page, 'dark')).toBeFocused();
          await expect.soft(html(page)).toHaveClass(DARK_CLASS);
          await expect.poll(() => readStoredTheme(page)).toBe('dark');
          await page.keyboard.press('ArrowLeft');
          await checked(themeRadio(page, 'light'));
          await expect.soft(themeRadio(page, 'light')).toBeFocused();
          await notDark(page);
          await expect.poll(() => readStoredTheme(page)).toBe('light');
        });
        expect.soft(writes.list(), 'theme keys send nothing').toEqual([]);
        await ev(page, '33R-A-006', 'theme_arrows');
      });

      await test.step('[33R-A-007] arrows wrap around', async () => {
        await themeRadio(page, 'system').click();
        await page.keyboard.press('ArrowRight'); // AP:128-130 (at + step + length) % length
        await checked(themeRadio(page, 'light'));
        await expect.soft(themeRadio(page, 'light')).toBeFocused();
        await page.keyboard.press('ArrowLeft');
        await checked(themeRadio(page, 'system'));
        await expect.soft(themeRadio(page, 'system')).toBeFocused();
        await ev(page, '33R-A-007', 'theme_arrows_wrap');
      });
    });
  });

  test('SCR-33 · FL-33R-02 · cold start: defaults, a11y semantics, stored theme', async ({ browser }) => {
    await asPrefsUser(browser, async (page) => {
      const notif = block(page, 'account-notifications');
      const shortcuts = block(page, 'account-shortcuts');
      const descriptions: Array<[string, string]> = [
        [VIEWPORT_DARK, 'Chỉ đổi màu vùng mô hình, giao diện vẫn sáng.'], // AP:215-218
        [REDUCE_MOTION, 'Tắt hoạt cảnh trong ứng dụng, không riêng màn này.'], // AP:224-227
        [SHOW_GRID, 'Lưới nền của khung nhìn, bước 100 mm.'], // AP:233-236
      ];

      await test.step('[33R-B-001] Giao diện defaults', async () => {
        await expect(themeRadio(page, 'light')).toHaveAttribute('aria-checked', 'true'); // UAP:384-388
        await expect(toggle(page, VIEWPORT_DARK)).toHaveAttribute('aria-checked', 'false');
        await expect(toggle(page, REDUCE_MOTION)).toHaveAttribute('aria-checked', 'false');
        await expect(toggle(page, SHOW_GRID)).toHaveAttribute('aria-checked', 'true');
        await expect(densityRadio(page, DENSITY.comfortable)).toHaveAttribute('aria-checked', 'true');
        await expect(html(page)).not.toHaveClass(DARK_CLASS);
        await expect(html(page)).not.toHaveAttribute(REDUCED_ATTR, /.*/u);
        for (const [, text] of descriptions) await expect(page.getByText(text, { exact: true })).toBeVisible();
        await ev(page, '33R-B-001', 'appearance_defaults');
      });

      await test.step('[33R-E-001] theme control semantics', async () => {
        await expect.soft(themeGroup(page).getByRole('radio')).toHaveText([THEME_LABEL.light, THEME_LABEL.dark, THEME_LABEL.system]);
        await expect.soft(themeGroup(page).locator('[role="radio"][aria-checked="true"]')).toHaveCount(1);
        await ev(page, '33R-E-001', 'a11y_theme_group');
      });

      await test.step('[33R-E-002] density control semantics', async () => {
        const group = page.getByRole('radiogroup', { name: DENSITY.group, exact: true });
        await expect.soft(group.getByRole('radio')).toHaveText([DENSITY.comfortable, DENSITY.compact]);
        await expect.soft(group.locator('[role="radio"][aria-checked="true"]')).toHaveCount(1);
        await ev(page, '33R-E-002', 'a11y_density_group');
      });

      await test.step('[33R-E-003] switches named and described', async () => {
        for (const [name, text] of descriptions) {
          const described = await toggle(page, name).evaluate((el) => document.getElementById(el.getAttribute('aria-describedby') ?? '')?.textContent ?? null); // TG:65-66
          expect.soft(described, `${name}: aria-describedby text`).toBe(text);
        }
        await ev(page, '33R-E-003', 'a11y_switches');
      });

      await test.step('[33R-B-002] Thông báo default matrix', async () => {
        await expect.soft(notif.getByRole('checkbox')).toHaveCount(10); // NS:129-169
        for (const row of NOTIFICATION_DEFAULTS) {
          await expect.soft(notif.getByRole('checkbox', { name: cellName(row.label, CHANNELS.inApp), exact: true })).toBeChecked({ checked: row.inApp });
          await expect.soft(notif.getByRole('checkbox', { name: cellName(row.label, CHANNELS.email), exact: true })).toBeChecked({ checked: row.email });
        }
        await ev(page, '33R-B-002', 'matrix_defaults');
      });

      await test.step('[33R-E-007] notification table semantics', async () => {
        await expect.soft(notif.locator('caption')).toHaveText('Hàng là sự việc, cột là kênh nhận thông báo.'); // NS:87
        await expect.soft(notif.locator('thead th[scope="col"]')).toHaveText(['Sự việc', CHANNELS.inApp, CHANNELS.email]);
        await expect.soft(notif.locator('tbody th[scope="row"]')).toHaveText(NOTIFICATION_DEFAULTS.map((r) => r.label));
        await ev(page, '33R-E-007', 'a11y_matrix_table');
      });

      await test.step('[33R-E-008] ten distinct cell names', async () => {
        const names = NOTIFICATION_DEFAULTS.flatMap((r) => [cellName(r.label, CHANNELS.inApp), cellName(r.label, CHANNELS.email)]);
        const got = await notif.getByRole('checkbox').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
        expect.soft(got).toEqual(names); // UAT:352-356
        expect.soft(new Set(got).size).toBe(10);
        await ev(page, '33R-E-008', 'a11y_matrix_names');
      });

      await test.step('[33R-B-003] Phím tắt default', async () => {
        await expect.soft(shortcuts.getByRole('status')).toHaveText('6 phím tắt đang có hiệu lực.'); // SS:126-176, UAT:384
        const rows = shortcuts.locator('tbody tr');
        await expect.soft(rows).toHaveCount(6);
        const got = await rows.evaluateAll((trs) =>
          trs.map((tr) => ({ keys: [...tr.querySelectorAll('kbd')].map((k) => k.textContent ?? ''), text: tr.querySelector('td:last-child')?.textContent?.trim() ?? '' })),
        );
        expect.soft(got).toEqual([
          { keys: ['Ctrl', 'Z'], text: 'Hoàn tác thao tác gần nhất' },
          { keys: ['Ctrl', 'Shift', 'Z'], text: 'Làm lại thao tác vừa hoàn tác' },
          { keys: ['Ctrl', 'S'], text: 'Lưu ngay thay vì chờ tự lưu' },
          { keys: ['Ctrl', 'F'], text: 'Mở tìm kiếm trong dự án' },
          { keys: ['?'], text: 'Mở bảng phím tắt' },
          { keys: ['Esc'], text: 'Đóng lớp trên cùng' },
        ]);
        await expect.soft(shortcuts.getByText(SHORTCUTS.empty, { exact: true })).toHaveCount(0);
        await ev(page, '33R-B-003', 'shortcuts_defaults');
      });

      await test.step('[33R-E-010] search box semantics', async () => {
        const search = shortcuts.getByRole('searchbox', { name: SHORTCUTS.search, exact: true }); // SS:114-122
        await expect.soft(search).toHaveAttribute('placeholder', 'Gõ để lọc ngay');
        await expect.soft(search).toHaveAttribute('type', 'search');
        await ev(page, '33R-E-010', 'a11y_search_box');
      });

      await test.step('[33R-E-012] shortcut table semantics', async () => {
        await expect.soft(shortcuts.locator('caption')).toHaveText('Tổ hợp phím và việc mà nó làm.'); // SS:103
        await expect.soft(shortcuts.locator('thead th[scope="col"]')).toHaveText(['Tổ hợp phím', 'Việc']);
        await ev(page, '33R-E-012', 'a11y_shortcut_table');
      });

      await test.step('[33R-B-004] stored theme dark before load', async () => {
        await page.evaluate((key) => window.localStorage.setItem(key, 'dark'), THEME_KEY); // same as addInitScript: present before the app boots
        await reloadPrefs(page);
        await expect.soft(themeRadio(page, 'dark')).toHaveAttribute('aria-checked', 'true'); // UAP:371-373,481-488
        await expect.soft(html(page)).toHaveClass(DARK_CLASS);
        expect.soft(await page.evaluate((key) => window.localStorage.getItem(key), THEME_KEY)).toBe('dark');
        await ev(page, '33R-B-004', 'theme_stored_dark_at_load');
      });
    });
  });

  test('SCR-33 · FL-33R-03 · switches, density, keyboard, autosave without network', async ({ browser }) => {
    await asPrefsUser(browser, async (page, writes) => {
      const viewportDark = toggle(page, VIEWPORT_DARK);
      const motion = toggle(page, REDUCE_MOTION);
      const grid = toggle(page, SHOW_GRID);
      const cell = block(page, 'account-notifications').getByRole('checkbox', { name: cellName('AI xử lý xong', CHANNELS.email), exact: true });
      const keysBefore = await storageKeys(page);

      await test.step('[33R-A-008] viewport dark switch on, then off', async () => {
        await viewportDark.click(); // AP:207-218
        await expect(viewportDark).toHaveAttribute('aria-checked', 'true');
        await expect(html(page)).not.toHaveClass(DARK_CLASS);
        await ev(page, '33R-A-008', 'switch_viewport_dark');
        await viewportDark.click();
        await expect(viewportDark).toHaveAttribute('aria-checked', 'false');
        await expect(html(page)).not.toHaveClass(DARK_CLASS);
      });

      await test.step('[33R-C-010] theme and viewport-dark are independent', async () => {
        await themeRadio(page, 'dark').click(); // UAP:384-385
        await expect.soft(viewportDark).toHaveAttribute('aria-checked', 'false');
        await viewportDark.click();
        await expect.soft(viewportDark).toHaveAttribute('aria-checked', 'true');
        await checked(themeRadio(page, 'dark'));
        await expect.soft(html(page)).toHaveClass(DARK_CLASS);
        await ev(page, '33R-C-010', 'theme_vs_viewport_dark');
        await viewportDark.click(); // back to the defaults for the next steps
        await themeRadio(page, 'light').click();
        await expect(html(page)).not.toHaveClass(DARK_CLASS);
      });

      await test.step('[33R-A-009] reduce motion on, then off', async () => {
        await motion.click(); // AP:220-227, UAP:492-502
        await expect.soft(motion).toHaveAttribute('aria-checked', 'true');
        await expect.soft(html(page)).toHaveAttribute(REDUCED_ATTR, 'true');
        await ev(page, '33R-A-009', 'switch_reduced_motion');
        await motion.click();
        await expect.soft(motion).toHaveAttribute('aria-checked', 'false');
        await expect.soft(html(page)).not.toHaveAttribute(REDUCED_ATTR, /.*/u);
      });

      await test.step('[33R-A-010] grid switch off, then on', async () => {
        await expect.soft(grid).toHaveAttribute('aria-checked', 'true'); // UAP:387
        await grid.click();
        await expect.soft(grid).toHaveAttribute('aria-checked', 'false');
        await ev(page, '33R-A-010', 'switch_grid');
        await grid.click();
        await expect.soft(grid).toHaveAttribute('aria-checked', 'true');
      });

      await test.step('[33R-A-011] density row heights', async () => {
        const rows = [themeGroup(page), viewportDark, motion, grid, densityRadio(page, DENSITY.compact), box(page, 'Chức danh')].map(prefRow);
        await densityRadio(page, DENSITY.compact).click(); // UAP:133-148
        await checked(densityRadio(page, DENSITY.compact));
        for (const row of rows) await expect.soft(row).toHaveCSS('min-height', '36px');
        await ev(page, '33R-A-011', 'density_rows');
        await densityRadio(page, DENSITY.comfortable).click();
        for (const row of rows) await expect.soft(row).toHaveCSS('min-height', '40px');
      });

      await test.step('[33R-A-012] density arrows', async () => {
        await densityRadio(page, DENSITY.comfortable).focus();
        await page.keyboard.press('ArrowRight');
        await checked(densityRadio(page, DENSITY.compact));
        await expect.soft(densityRadio(page, DENSITY.compact)).toBeFocused();
        await page.keyboard.press('ArrowRight');
        await checked(densityRadio(page, DENSITY.comfortable));
        await expect.soft(densityRadio(page, DENSITY.comfortable)).toBeFocused();
        await page.keyboard.press('ArrowLeft');
        await checked(densityRadio(page, DENSITY.compact));
        await expect.soft(densityRadio(page, DENSITY.compact)).toBeFocused();
        await ev(page, '33R-A-012', 'density_arrows');
        await densityRadio(page, DENSITY.comfortable).click();
      });

      await test.step('[33R-A-013] Space and Enter flip a switch', async () => {
        await grid.focus(); // TG:86-95 native button
        await page.keyboard.press('Space');
        await expect.soft(grid).toHaveAttribute('aria-checked', 'false');
        await page.keyboard.press('Enter');
        await expect.soft(grid).toHaveAttribute('aria-checked', 'true');
        await ev(page, '33R-A-013', 'switch_space_enter');
      });

      await test.step('[33R-E-004] Tab order in Giao diện', async () => {
        await themeRadio(page, 'light').focus();
        const order = [await activeStop(page), ...(await focusOrder(page, 7))];
        expect.soft(order).toEqual([
          'radio:Sáng',
          'radio:Tối',
          'radio:Theo hệ thống',
          `switch:${VIEWPORT_DARK}`,
          `switch:${REDUCE_MOTION}`,
          `switch:${SHOW_GRID}`,
          'radio:Thoải mái',
          'radio:Gọn',
        ]);
        await ev(page, '33R-E-004', 'tab_order_appearance');
      });

      await test.step('[33R-E-005] visible focus ring', async () => {
        await themeRadio(page, 'light').focus();
        await page.keyboard.press('Tab'); // keyboard focus -> :focus-visible
        await expect.soft(themeRadio(page, 'dark')).toBeFocused();
        expect.soft(hasRing(await ringOf(themeRadio(page, 'dark'), 'radio')), 'radio ring').toBe(true);
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await expect.soft(viewportDark).toBeFocused();
        expect.soft(hasRing(await ringOf(viewportDark, 'switch')), 'switch ring').toBe(true);
        await cell.focus();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        await expect.soft(cell).toBeFocused();
        expect.soft(hasRing(await ringOf(cell, 'checkbox')), 'checkbox ring').toBe(true);
        await ev(page, '33R-E-005', 'focus_rings');
      });

      await test.step('[33R-C-009] four changes in one debounce window', async () => {
        await settle(page, () =>
          clickTogether(page, [themeRadio(page, 'dark'), grid, densityRadio(page, DENSITY.compact), cell]),
        );
        await checked(themeRadio(page, 'dark'));
        await expect.soft(grid).toHaveAttribute('aria-checked', 'false');
        await checked(densityRadio(page, DENSITY.compact));
        await expect.soft(cell).toBeChecked({ checked: true }); // default false (email column)
        await ev(page, '33R-C-009', 'one_window_four_changes');
      });

      await test.step('[33R-C-008] values survive their own autosave', async () => {
        await checked(themeRadio(page, 'dark')); // UAT:320-323, UAP:402-409: the chip settled in the previous step
        await expect.soft(grid).toHaveAttribute('aria-checked', 'false');
        await checked(densityRadio(page, DENSITY.compact));
        await expect.soft(cell).toBeChecked({ checked: true });
        await ev(page, '33R-C-008', 'values_after_autosave');
      });

      await test.step('[33R-G-001] appearance-only autosave sends nothing', async () => {
        expect.soft(writes.list(), 'non-GET /api/ requests since step 1').toEqual([]); // ASG:158-161
        await ev(page, '33R-G-001', 'no_request_appearance');
      });

      await test.step('[33R-G-005] storage footprint', async () => {
        const added = (await storageKeys(page)).filter((k) => !keysBefore.includes(k));
        expect.soft(added.filter((k) => k !== THEME_KEY), 'keys added besides the theme').toEqual([]); // UAP:32-35
        expect.soft(await page.evaluate((key) => window.localStorage.getItem(key), THEME_KEY)).toBe('dark');
        await ev(page, '33R-G-005', 'storage_keys');
      });
    });
  });

  test('SCR-33 · FL-33R-04 · reduced motion and row flash', async ({ browser }) => {
    await asPrefsUser(browser, async (page) => {
      const motion = toggle(page, REDUCE_MOTION);
      const grid = toggle(page, SHOW_GRID);
      const groups = () => [themeGroup(page), page.getByRole('radiogroup', { name: DENSITY.group, exact: true })];

      await test.step('[33R-B-005] OS reduced motion, switch untouched', async () => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await reloadPrefs(page);
        await expect(html(page)).toHaveAttribute(REDUCED_ATTR, 'true'); // UAP:492-502 motionOff = switch OR OS
        await expect(motion).toHaveAttribute('aria-checked', 'false');
        await ev(page, '33R-B-005', 'os_reduced_motion');
      });

      await test.step('[33R-B-006] thumb and row duration, OS reduce vs normal', async () => {
        for (const group of groups()) {
          await expect.soft(group.locator('[data-segment-thumb]')).toHaveCount(0); // SEG:80-82
          await expect.soft(group.locator('[role="radio"][aria-checked="true"]')).toHaveClass(hasClassToken('bg-bg-surface')); // AP:165-167
        }
        await expect.soft(prefRow(themeGroup(page))).toHaveClass(hasClassToken('duration-0'));
        await expect.soft(prefRow(grid)).toHaveClass(hasClassToken('duration-0'));
        await ev(page, '33R-B-006', 'motion_thumb_duration');
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await reloadPrefs(page);
        for (const group of groups()) await expect.soft(group.locator('[data-segment-thumb]')).toHaveCount(1);
        await expect.soft(prefRow(themeGroup(page))).toHaveClass(hasClassToken('duration-260'));
        await expect.soft(prefRow(grid)).toHaveClass(hasClassToken('duration-260'));
      });

      await test.step('[33R-B-007] row flash after a commit', async () => {
        await watchFlash(page);
        await grid.click(); // AP:193-197, UAP:448-470
        await expect.poll(async () => (await flashes(page)).gained).toEqual([SHOW_GRID]);
        await expect.poll(async () => (await flashes(page)).lost, { message: 'flash must end (~340 ms)' }).toEqual([SHOW_GRID]);
        await ev(page, '33R-B-007', 'row_flash');
      });

      await test.step('[33R-B-008] flash is off when motion is off', async () => {
        await settle(page, () => motion.click());
        await expect.soft(motion).toHaveAttribute('aria-checked', 'true');
        await watchFlash(page);
        await settle(page, () => grid.click()); // the chip rests only after the 340 ms flash window
        expect.soft((await flashes(page)).gained, 'rows that flashed with motion off').toEqual([]); // AP:193 !motionOff
        await ev(page, '33R-B-008', 'row_flash_off_when_reduced');
      });

      await test.step('[33R-B-012] attribute survives leaving the screen', async () => {
        await spaNavigate(page, '/');
        await expect(page.getByRole('heading', { level: 1, name: 'Cài đặt tài khoản', exact: true })).toHaveCount(0);
        await expect.soft(html(page)).toHaveAttribute(REDUCED_ATTR, 'true'); // UAP:105-111
        await ev(page, '33R-B-012', 'reduced_motion_survives_unmount');
      });
    });
  });
});
