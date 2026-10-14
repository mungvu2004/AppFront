/**
 * Phase 7 — QA-07b pack P6: SCR-33 `/tai-khoan` local preferences, second half (flows-C2.md FL-33R-05 .. FL-33R-08).
 * One `test()` per user flow; one `test.step('[<catalog row>] …')` per catalog row, in the planned order. `expect.soft`
 * for observations, hard `expect` for the H steps. Steps marked ⚑ are written as the CORRECT behaviour and stay red until
 * the app bug is fixed (33R-A-024 theme not applied on the dashboard, 33R-A-017 undo of the first theme change,
 * 33R-C-005 "mod" matches a hidden key name). Nothing is mocked: the real stack answers every request.
 *
 * Source short names (FE @ master 1e1c16b7, under `src/screens/account/AccountSettings/` unless a path is given):
 *   UAS useAccountSettings.ts  UAP useAccountPreferences.ts  UAT useAccountTables.ts  ASG accountSettingsGateway.ts
 *   NS NotificationsSection.tsx  SS ShortcutsSection.tsx  AP AppearanceSection.tsx
 *
 * Seeds: P1 = pool engineer `p07-prefs-1` (FL-05, FL-08; never writes to the server), P2 = pool viewer `p07-prefs-2`
 * (FL-07), P3 = pool engineer `p07-prefs-3` (FL-06; `jobTitle` edited once, restored in `finally`).
 *
 * Request budget per run (BE limits): `POST /api/auth/login` 2 per flow (admin API + the context) = 8 (limit 120 / 60 s);
 * `PATCH /api/me` 1 (FL-06 step 33R-G-003) + 1 reset; `PUT /api/me/avatar` 0; `POST /api/me/password` 0;
 * `POST /api/auth/refresh` 1 per page load (+ 2 for the FL-06 snapshot/reset). Pool slots are reused, no new invitation
 * unless a slot is empty.
 */
import { expect, test } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { dashboardLoaded } from './support/auth';
import { captureEvidence } from './support/evidence';
import {
  CLOSE_TOP_LAYER,
  DARK_CLASS,
  DENSITY,
  IND,
  ME_RE,
  NOTIFICATION_DEFAULTS,
  REDUCE_MOTION,
  SHORTCUTS,
  SHOW_GRID,
  UNDO,
  UNDO_DESCRIPTIONS,
  VIEWPORT_DARK,
  asRecord,
  box,
  heading,
  openAccount,
  readStoredTheme,
  recordWrites,
  resetProfile,
  saveIndicator,
  snapshotProfile,
  themeRadio,
  toggle,
  undoToast,
} from './support/p07/account';
import {
  MATRIX_CELL_NAMES,
  activeLabel,
  asPrefsUser,
  cell,
  clickCell,
  densityRadio,
  expectAllShortcuts,
  expectFiltered,
  expectMatrix,
  notificationsBlock,
  recordAll,
  settle,
  shortcuts,
  spaNavigate,
} from './support/p07/P6';

const MAIL_EVENT = 'Tổng hợp mỗi sáng';
const INVITE_EVENT = 'Được mời vào dự án';
const MENTION_EVENT = 'Bình luận nhắc đến tôi';
/** UAT:364-385: the registry lists 6 shortcuts (catalog 33R-B-003). */
const TOTAL = 6;
/** The four rows whose key caps contain "Ctrl" (UAT:371-376). */
const CTRL_ROWS = [...UNDO_DESCRIPTIONS, 'Lưu ngay thay vì chờ tự lưu', 'Mở tìm kiếm trong dự án'] as const;
const SELECT_ALL = process.platform === 'darwin' ? 'Meta+a' : 'Control+a';

const html = (page: import('@playwright/test').Page): import('@playwright/test').Locator => page.locator('html');

/** The newest (first, full-size) undo toast's "Hoàn tác" button; older ones are folded into 4 px strips (Toast.tsx). */
const undoButton = (page: import('@playwright/test').Page): import('@playwright/test').Locator =>
  undoToast(page).first().getByRole('button', { name: UNDO, exact: true });

test.describe('E07 SCR-33 preferences B', () => {
  test('SCR-33 · FL-33R-05 · persistence: session memory, reload, app-wide scope', async ({ browser }) => {
    await asPrefsUser(browser, 'p07-prefs-1', 'engineer', async ({ page }) => {
      await openAccount(page);

      await test.step('[33R-A-023] four values set, leave by SPA navigation and come back: all kept', async () => {
        await themeRadio(page, 'dark').click();
        await toggle(page, SHOW_GRID).click();
        await densityRadio(page, 'compact').click();
        await clickCell(page, MAIL_EVENT, 'inApp');
        await settle(page);

        await spaNavigate(page, ROUTES.dashboard);
        await dashboardLoaded(page);
        await spaNavigate(page, ROUTES.account);
        await expect(heading(page)).toBeVisible();
        await expect(box(page, 'Chức danh')).toBeVisible();

        // ASG:98,152-156 module memory + UAS:324-330 query cache
        await expect(themeRadio(page, 'dark')).toHaveAttribute('aria-checked', 'true');
        await expect(toggle(page, SHOW_GRID)).toHaveAttribute('aria-checked', 'false');
        await expect(densityRadio(page, 'compact')).toHaveAttribute('aria-checked', 'true');
        await expect(cell(page, MAIL_EVENT, 'inApp')).toBeChecked();
        await captureEvidence(page, 'E07_33R-A-023_spa_leave_return_kept.png');
      });

      await test.step('[33R-A-024] ⚑ a full load of the dashboard is dark after choosing "Tối"', async () => {
        expect.soft(await readStoredTheme(page), 'stored theme before leaving').toBe('dark');
        await page.goto(ROUTES.dashboard);
        await dashboardLoaded(page);
        // today red: nothing mounts useTheme() outside /tai-khoan, so the dashboard paints light
        await expect.soft(html(page)).toHaveClass(DARK_CLASS);
        await captureEvidence(page, 'E07_33R-A-024_theme_applies_on_dashboard.png');
      });

      await test.step('[33R-A-022] back on /tai-khoan with a full load: local-only values are defaults, the theme survives', async () => {
        await openAccount(page);
        await expect.soft(toggle(page, SHOW_GRID)).toHaveAttribute('aria-checked', 'true');
        await expect.soft(densityRadio(page, 'comfortable')).toHaveAttribute('aria-checked', 'true');
        await expect.soft(toggle(page, VIEWPORT_DARK)).toHaveAttribute('aria-checked', 'false');
        await expect.soft(toggle(page, REDUCE_MOTION)).toHaveAttribute('aria-checked', 'false');
        await expect.soft(cell(page, MAIL_EVENT, 'inApp')).not.toBeChecked();
        await expectMatrix(page);
        await expect.soft(themeRadio(page, 'dark')).toHaveAttribute('aria-checked', 'true');
        expect.soft(await readStoredTheme(page)).toBe('dark');
        await captureEvidence(page, 'E07_33R-A-022_reload_defaults.png');
      });

      await test.step('[33R-C-001] "Theo hệ thống" under an OS dark scheme is not remembered: the reload shows "Tối"', async () => {
        await page.emulateMedia({ colorScheme: 'dark' });
        await themeRadio(page, 'system').click();
        await page.reload();
        await expect(box(page, 'Chức danh')).toBeVisible();
        // UAP:37-45,384: the store only keeps the resolved light/dark value
        await expect.soft(themeRadio(page, 'dark')).toHaveAttribute('aria-checked', 'true');
        await expect.soft(html(page)).toHaveClass(DARK_CLASS);
        await expect.soft(themeRadio(page, 'system')).toHaveAttribute('aria-checked', 'false');
        await captureEvidence(page, 'E07_33R-C-001_system_not_remembered.png');
      });
    });
  });

  test('SCR-33 · FL-33R-06 · notification matrix and mixed save', async ({ browser }) => {
    await asPrefsUser(browser, 'p07-prefs-3', 'engineer', async ({ context, page }) => {
      const snapshot = await snapshotProfile(context);
      const writes = recordWrites(page);
      try {
        await openAccount(page);
        const section = notificationsBlock(page);

        await test.step('[33R-D-002] engineer uses the matrix and the search box, nothing is sent', async () => {
          const checkboxes = section.getByRole('checkbox');
          await expect(checkboxes).toHaveCount(NOTIFICATION_DEFAULTS.length * 2);
          for (const checkbox of await checkboxes.all()) await expect(checkbox).toBeEnabled();

          await clickCell(page, MAIL_EVENT, 'email'); // flipped and put back, so step 2 starts from the defaults
          await expect(cell(page, MAIL_EVENT, 'email')).not.toBeChecked();
          await clickCell(page, MAIL_EVENT, 'email');
          await expect(cell(page, MAIL_EVENT, 'email')).toBeChecked();

          const s = shortcuts(page);
          await s.search.fill('ctrl');
          await expect(s.rows).toHaveCount(CTRL_ROWS.length);
          await captureEvidence(page, 'E07_33R-D-002_engineer_uses_prefs.png');
          await s.search.fill('');
          await expect(s.rows).toHaveCount(TOTAL);
          await settle(page);
          expect(writes.list(), 'matrix + search send nothing').toEqual([]);
        });

        await test.step('[33R-A-014] a mouse click on the visible box flips exactly that cell', async () => {
          await clickCell(page, INVITE_EVENT, 'email'); // NS:156-165, UAT:325-343
          await expect.soft(cell(page, INVITE_EVENT, 'email')).not.toBeChecked();
          await expectMatrix(page, { [`${INVITE_EVENT}|email`]: false });
          await captureEvidence(page, 'E07_33R-A-014_cell_click_isolated.png');
        });

        await test.step('[33R-A-015] Space on a focused cell toggles it', async () => {
          const mention = cell(page, MENTION_EVENT, 'email');
          await expect.soft(mention).not.toBeChecked();
          await mention.focus();
          await page.keyboard.press('Space'); // Checkbox.tsx handleKeyDown
          await expect.soft(mention).toBeChecked();
          await captureEvidence(page, 'E07_33R-A-015_cell_space.png');
        });

        await test.step('[33R-E-009] Tab visits the ten cells row by row and nothing else in between', async () => {
          await cell(page, NOTIFICATION_DEFAULTS[0]!.label, 'inApp').focus();
          const order: Array<string | null> = [await activeLabel(page)];
          for (let i = 1; i < MATRIX_CELL_NAMES.length; i += 1) {
            await page.keyboard.press('Tab');
            order.push(await activeLabel(page));
          }
          expect.soft(order).toEqual([...MATRIX_CELL_NAMES]);
          await captureEvidence(page, 'E07_33R-E-009_tab_order_matrix.png');
        });

        await test.step('[33R-G-002] after the chip settled, no write request since the first cell change', async () => {
          await settle(page);
          expect.soft(writes.list()).toEqual([]);
          await captureEvidence(page, 'E07_33R-G-002_no_request_notifications.png');
        });

        await test.step('[33R-G-003] mixed save: one PATCH /api/me whose body only has jobTitle', async () => {
          // Profile edit LAST: whatever the pace of the earlier actions, the debounce that fires carries all three changes.
          await clickCell(page, INVITE_EVENT, 'inApp');
          await themeRadio(page, 'dark').click();
          const patched = waitForApi(page, 'PATCH', ME_RE, [200]);
          await box(page, 'Chức danh').fill(`${snapshot.jobTitle}-e2e`);
          await patched;
          await expect.soft(saveIndicator(page)).toHaveText(IND.saved); // deadline marker: the save finished
          expect.soft(writes.list()).toEqual(['PATCH /api/me']);
          const bodies = writes.bodies('/api/me');
          expect.soft(bodies).toHaveLength(1);
          expect.soft(Object.keys(asRecord(bodies[0], 'PATCH /api/me body')).sort()).toEqual(['jobTitle']);
          await captureEvidence(page, 'E07_33R-G-003_mixed_patch_body.png');
        });
      } finally {
        writes.stop();
        await resetProfile(context, snapshot);
      }
    });
  });

  test('SCR-33 · FL-33R-07 · undo on the preferences (viewer)', async ({ browser }) => {
    await asPrefsUser(browser, 'p07-prefs-2', 'viewer', async ({ page }) => {
      await openAccount(page);
      const writes = recordWrites(page);
      try {
        await test.step('[33R-D-001] viewer: every preference control is enabled, a click works and sends nothing', async () => {
          for (const choice of ['light', 'dark', 'system'] as const) await expect(themeRadio(page, choice)).toBeEnabled();
          for (const name of [VIEWPORT_DARK, REDUCE_MOTION, SHOW_GRID]) await expect(toggle(page, name)).toBeEnabled();
          await expect(densityRadio(page, 'comfortable')).toBeEnabled();
          await expect(densityRadio(page, 'compact')).toBeEnabled();
          const checkboxes = notificationsBlock(page).getByRole('checkbox');
          await expect(checkboxes).toHaveCount(NOTIFICATION_DEFAULTS.length * 2);
          for (const checkbox of await checkboxes.all()) await expect(checkbox).toBeEnabled();
          await expect(shortcuts(page).search).toBeEnabled();

          // A neutral switch (not the theme: step 2 needs the FIRST theme change) — undone at once so the toast group is closed.
          await toggle(page, VIEWPORT_DARK).click();
          await expect(toggle(page, VIEWPORT_DARK)).toHaveAttribute('aria-checked', 'true');
          await settle(page);
          expect(writes.list(), 'a viewer click sends nothing').toEqual([]);
          await captureEvidence(page, 'E07_33R-D-001_viewer_prefs_enabled.png');
          await undoButton(page).click();
          await expect(toggle(page, VIEWPORT_DARK)).toHaveAttribute('aria-checked', 'false');
          await expect(undoToast(page)).toHaveCount(0);
        });

        const appearance = page.locator('section[aria-labelledby="account-appearance"]');
        const backgroundOf = (target: import('@playwright/test').Locator): Promise<string> =>
          target.evaluate((el) => getComputedStyle(el).backgroundColor);

        await test.step('[33R-B-011] "Tối" is a token set, not a filter', async () => {
          const lightBody = await backgroundOf(page.locator('body'));
          const lightSurface = await backgroundOf(appearance);
          await themeRadio(page, 'dark').click();
          await expect.soft(html(page)).toHaveClass(DARK_CLASS);
          await expect.soft(page.locator('body')).not.toHaveCSS('background-color', lightBody);
          await expect.soft(appearance).not.toHaveCSS('background-color', lightSurface);
          for (const target of [html(page), page.locator('body'), page.getByRole('main'), appearance]) {
            await expect.soft(target).toHaveCSS('filter', 'none');
          }
          await captureEvidence(page, 'E07_33R-B-011_dark_tokens_no_filter.png');
        });

        await test.step('[33R-A-017] ⚑ "Hoàn tác" after the first theme change brings "Sáng" back', async () => {
          await expect(undoToast(page).first()).toBeVisible();
          await undoButton(page).click();
          // today red: base.theme falls back to the live store theme (UAP:384), so radio and class stay "Tối"
          await expect.soft(themeRadio(page, 'light')).toHaveAttribute('aria-checked', 'true');
          await expect.soft(html(page)).not.toHaveClass(DARK_CLASS);
          await captureEvidence(page, 'E07_33R-A-017_undo_first_theme.png');
        });

        await test.step('[33R-A-016] "Hoàn tác" after "Hiện lưới 100 mm" off puts the switch back, no write', async () => {
          await expect(undoToast(page)).toHaveCount(0); // the toast of the previous step is gone, its group closed
          await toggle(page, SHOW_GRID).click();
          await expect(toggle(page, SHOW_GRID)).toHaveAttribute('aria-checked', 'false');
          await expect(undoToast(page).first()).toBeVisible();
          await undoButton(page).click(); // UAS:336-347
          await expect.soft(toggle(page, SHOW_GRID)).toHaveAttribute('aria-checked', 'true');
          await settle(page);
          expect.soft(writes.list(), 'no write request during the whole flow').toEqual([]);
          await captureEvidence(page, 'E07_33R-A-016_undo_switch.png');
        });
      } finally {
        writes.stop();
      }
    });
  });

  test('SCR-33 · FL-33R-08 · Tìm phím tắt', async ({ browser }) => {
    test.setTimeout(180_000); // ~100 slowMo-paced operations; the plan estimate is 50 s
    await asPrefsUser(browser, 'p07-prefs-1', 'engineer', async ({ page }) => {
      await openAccount(page);
      await page.waitForLoadState('networkidle'); // the page settled: only then does "no request" start counting
      const all = recordAll(page);
      const s = shortcuts(page);
      try {
        await test.step('[33R-A-018] "Ctrl" lists the four rows holding a Ctrl key', async () => {
          await expect(s.status).toHaveText(`${String(TOTAL)} phím tắt đang có hiệu lực.`);
          await s.search.fill('Ctrl');
          await expect(s.status).toHaveText(SHORTCUTS.filtered(4, TOTAL)); // UAT:364-385
          await expect(s.rows).toHaveCount(CTRL_ROWS.length);
          for (const text of CTRL_ROWS) await expect(s.descriptionCell(text)).toBeVisible();
          await captureEvidence(page, 'E07_33R-A-018_search_ctrl.png');
        });

        await test.step('[33R-B-010] the filtered sentence matches "Đang hiện N trong 6 phím tắt." with N = visible rows', async () => {
          const text = (await s.status.textContent()) ?? '';
          const shown = Number(/^Đang hiện (\d+) trong 6 phím tắt\.$/u.exec(text)?.[1]);
          expect.soft(text).toMatch(/^Đang hiện \d+ trong 6 phím tắt\.$/u);
          expect.soft(shown).toBe(await s.rows.count());
          await captureEvidence(page, 'E07_33R-B-010_search_filtered_label.png');
        });

        await test.step('[33R-E-011] the count is a live region: it changes while typing and focus stays in the box', async () => {
          await s.search.fill('Ctrl');
          await s.search.pressSequentially('+');
          await expect.soft(s.status).toHaveText(SHORTCUTS.filtered(4, TOTAL));
          await expect.soft(s.search).toBeFocused();
          await s.search.pressSequentially('S');
          await expect.soft(s.search).toHaveValue('Ctrl+S');
          await expect.soft(s.status).toHaveText(SHORTCUTS.filtered(1, TOTAL));
          await expect.soft(s.search).toBeFocused();
          await captureEvidence(page, 'E07_33R-E-011_status_live.png');
        });

        await test.step('[33R-C-003] the query is trimmed and folded: "  ctrl  ", "ĐÓNG LỚP", "luu ngay"', async () => {
          await s.search.fill('  ctrl  ');
          await expectFiltered(page, CTRL_ROWS, TOTAL);
          await s.search.fill('ĐÓNG LỚP');
          await expectFiltered(page, [CLOSE_TOP_LAYER], TOTAL);
          await s.search.fill('luu ngay');
          await expectFiltered(page, ['Lưu ngay thay vì chờ tự lưu'], TOTAL);
          await captureEvidence(page, 'E07_33R-C-003_search_trim_fold.png');
        });

        await test.step('[33R-A-019] case and diacritics are ignored: "HOAN TAC" and "dong lop"', async () => {
          await s.search.fill('HOAN TAC');
          await expectFiltered(page, UNDO_DESCRIPTIONS, TOTAL);
          await s.search.fill('dong lop');
          await expectFiltered(page, [CLOSE_TOP_LAYER], TOTAL);
          await captureEvidence(page, 'E07_33R-A-019_search_fold.png');
        });

        await test.step('[33R-C-004] the printed key caps match: "ctrl+shift", "esc", "?"', async () => {
          await s.search.fill('ctrl+shift');
          await expectFiltered(page, [UNDO_DESCRIPTIONS[1]], TOTAL);
          await s.search.fill('esc');
          await expectFiltered(page, [CLOSE_TOP_LAYER], TOTAL);
          await s.search.fill('?');
          await expectFiltered(page, ['Mở bảng phím tắt'], TOTAL);
          await captureEvidence(page, 'E07_33R-C-004_search_key_caps.png');
        });

        await test.step('[33R-C-005] ⚑ "mod" matches nothing: no cell shows the internal "Mod" spelling', async () => {
          await s.search.fill('mod');
          // today red: UAT:374 also searches `row.combo` ("Mod+Z"…) so 4 rows stay
          await expectFiltered(page, [], TOTAL);
          await captureEvidence(page, 'E07_33R-C-005_search_hidden_mod.png');
        });

        await test.step('[33R-B-009] no match: "Đang hiện 0 trong 6 phím tắt." and the empty sentence', async () => {
          await s.search.fill('qa-e07-zzz');
          await expectFiltered(page, [], TOTAL);
          await expect.soft(s.region.getByText(SHORTCUTS.empty, { exact: true })).toBeVisible(); // SS:170-176
          await captureEvidence(page, 'E07_33R-B-009_search_no_match.png');
        });

        await test.step('[33R-C-006] a query matching every row ("t") reads "6 phím tắt đang có hiệu lực."', async () => {
          await s.search.fill('t');
          await expectAllShortcuts(page, TOTAL);
          await captureEvidence(page, 'E07_33R-C-006_search_matches_all.png');
        });

        await test.step('[33R-C-007] three spaces are a blank query: all rows', async () => {
          await s.search.fill('   ');
          await expectAllShortcuts(page, TOTAL);
          await captureEvidence(page, 'E07_33R-C-007_search_blank.png');
        });

        await test.step('[33R-A-021] Escape in the box empties it, focus stays, the URL does not change', async () => {
          const url = page.url();
          await s.search.fill('ctrl');
          await expect.soft(s.rows).toHaveCount(CTRL_ROWS.length);
          await s.search.press('Escape'); // native type=search clear, SS:114-121
          await expect.soft(s.search).toHaveValue('');
          await expectAllShortcuts(page, TOTAL);
          await expect.soft(s.search).toBeFocused();
          expect.soft(page.url()).toBe(url);
          await captureEvidence(page, 'E07_33R-A-021_search_escape_clears.png');
        });

        await test.step('[33R-A-020] select-all + Delete clears the search: all rows', async () => {
          await s.search.fill('ctrl');
          await expect.soft(s.rows).toHaveCount(CTRL_ROWS.length);
          await s.search.press(SELECT_ALL);
          await s.search.press('Delete');
          await expect.soft(s.search).toHaveValue('');
          await expectAllShortcuts(page, TOTAL);
          await captureEvidence(page, 'E07_33R-A-020_search_clear.png');
        });

        await test.step('[33R-G-004] the search is client-side: no request of any method while typing', async () => {
          // deadline: the flow above typed 12 queries; the last one has been rendered
          await expect.soft(s.status).toHaveText(`${String(TOTAL)} phím tắt đang có hiệu lực.`);
          expect.soft(all.list(), 'requests recorded since the page settled').toEqual([]);
          await captureEvidence(page, 'E07_33R-G-004_search_no_request.png');
        });
      } finally {
        all.stop();
      }
    });
  });
});
