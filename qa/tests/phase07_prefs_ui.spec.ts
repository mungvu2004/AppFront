/**
 * Phase 07 — SCR-33 Account Settings (`/tai-khoan`), local preferences UI-verify flows (QA-07b pack P4; flows-C2
 * `phase07_prefs_ui.spec.ts`): FL-33R-09 (Giao diện) and FL-33R-10 (Thông báo + Phím tắt). Every state goes through `verifyUi`
 * at 1920 / 1440 / 1024 / 768 (never 375 / 2560); `open` performs the state because nothing survives `goto('about:blank')`,
 * and records the row's own measurements, asserted after the shots. No faked response anywhere.
 *
 * Request budget per run: FL-33R-09 = 1 pool login (p07-prefs-4) + the admin storage state (1 refresh check, only rotated
 * COOKIES written back, not its localStorage); FL-33R-10 = 1 pool login. Nothing here sends a write: Giao diện / Thông báo /
 * Phím tắt live in page memory (UAP localOnly), so each case also asserts "no non-GET /api/ call but the session refresh".
 * Source: AP AppearanceSection.tsx, NS NotificationsSection.tsx, SS ShortcutsSection.tsx, UAP useAccountPreferences.ts,
 * UAT useAccountTables.ts, FieldRow.tsx (+ fix/qa07-a `isStacked`), SegmentedControl.tsx, Kbd.tsx.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  CHANNELS,
  DARK_CLASS,
  DENSITY,
  NOTIFICATION_DEFAULTS,
  REDUCE_MOTION,
  SHORTCUTS,
  SHOW_GRID,
  THEME_STORAGE_KEY,
  VIEWPORT_DARK,
  block,
  cellName,
  checkedTheme,
  openAccount,
  recordWrites,
  themeGroup,
  themeRadio,
  toggle,
} from './support/p07/account';
import {
  type Box,
  FOUR,
  U,
  adminApi,
  intersects,
  openAdminSession,
  openUserSession,
  rect,
  saveAdminCookies,
  viewportOf,
  within,
} from './support/p07/P4';
import { poolUser } from './support/phase03Seed';
import { verifyUi } from './support/ui-verify';

const appearance = (page: Page): Locator => block(page, 'account-appearance');
const notifications = (page: Page): Locator => block(page, 'account-notifications');
const shortcuts = (page: Page): Locator => block(page, 'account-shortcuts');
const densityGroup = (page: Page): Locator => page.getByRole('radiogroup', { name: DENSITY.group, exact: true });
const labelOf = (page: Page, text: string): Locator => appearance(page).getByText(text, { exact: true }).first();

/** Label and control of one Giao diện row, as boxes. */
async function rowBoxes(page: Page, label: string, control: Locator): Promise<{ readonly label: Box; readonly control: Box }> {
  return { label: await rect(labelOf(page, label)), control: await rect(control) };
}

/* ================================================================= FL-33R-09 */

test('SCR-33 · FL-33R-09 · UI Giao diện (4 khổ)', async ({ browser }) => {
  test.setTimeout(Math.max(120_000, 2 * 270_000));
  const admin = await adminApi();
  const user = await poolUser(admin, 'engineer', 'p07-prefs-4'); // P4: local changes only
  await admin.dispose();

  await test.step('[33R-D-003] admin opens the screen (no change): Giao diện / Thông báo / Phím tắt with default state, 0 write requests', async () => {
    const session = await openAdminSession(browser);
    const writes = recordWrites(session.page);
    const seen: Array<{ vw: number; blocks: boolean[]; viewportDark: string | null; grid: string | null; compact: string | null; comfortable: string | null }> = [];
    try {
      const metrics = await verifyUi(session.page, U('33R-D-003', 'admin_prefs_visit'), async (p) => {
        await openAccount(p);
        const blocks = await Promise.all([appearance(p), notifications(p), shortcuts(p)].map((b) => b.isVisible()));
        seen.push({
          vw: (await viewportOf(p)).w,
          blocks,
          viewportDark: await toggle(p, VIEWPORT_DARK).getAttribute('aria-checked'),
          grid: await toggle(p, SHOW_GRID).getAttribute('aria-checked'),
          compact: await densityGroup(p).getByRole('radio', { name: DENSITY.compact, exact: true }).getAttribute('aria-checked'),
          comfortable: await densityGroup(p).getByRole('radio', { name: DENSITY.comfortable, exact: true }).getAttribute('aria-checked'),
        });
      }, FOUR);
      expect(metrics.filter((m) => m.openError !== undefined), 'the admin screen opened at every width').toEqual([]);
      expect(seen, 'every width was measured').toHaveLength(FOUR.length);
      for (const m of seen) {
        expect(m.blocks, `${String(m.vw)}: the three blocks render`).toEqual([true, true, true]);
        // UAP:385-388 defaults of a fresh page: viewportDark off, grid on, density comfortable (the theme itself may come from the stored state).
        expect([m.viewportDark, m.grid, m.compact, m.comfortable], `${String(m.vw)}: default state`).toEqual(['false', 'true', 'false', 'true']);
      }
      expect(writes.list(), 'a read-only visit sends no write').toEqual([]);
    } finally {
      writes.stop();
      await saveAdminCookies(session.context);
      await session.context.close();
    }
  });

  const { context, page } = await openUserSession(browser, user);
  const writes = recordWrites(page);
  try {
    await test.step('[33R-F-001] Giao diện default: no overflow; side by side >= 1024, stacked and full width at 768', async () => {
      const seen: Array<{ vw: number; card: Box; theme: { label: Box; control: Box }; column: Box }> = [];
      await verifyUi(page, U('33R-F-001', 'appearance_default'), async (p) => {
        await openAccount(p);
        await expect(themeGroup(p)).toBeVisible();
        seen.push({
          vw: (await viewportOf(p)).w,
          card: await rect(appearance(p)),
          theme: await rowBoxes(p, 'Chủ đề', themeGroup(p)),
          column: await rect(themeGroup(p).locator('xpath=..')), // the value column of the FieldRow
        });
      }, FOUR);
      for (const m of seen) {
        if (m.vw >= 1024) {
          expect.soft(m.theme.label.right, `${String(m.vw)}: label left of the control`).toBeLessThanOrEqual(m.theme.control.left + 1);
        } else {
          // BUG-497 / BUG-502 (fix/qa07-a, ACCOUNT_STACKED_QUERY width < 1024): label above, value column the full card width (padding 20 + 20).
          expect.soft(m.theme.label.bottom, `${String(m.vw)}: label above the control`).toBeLessThanOrEqual(m.theme.control.top + 1);
          expect.soft(m.column.width, `${String(m.vw)}: control column spans the card`).toBeGreaterThanOrEqual(m.card.width - 42);
        }
      }
    });

    await test.step('[33R-F-004] switch rows (BUG-499): label and switch on one line at >= 1024, label above at 768', async () => {
      const switches = [VIEWPORT_DARK, REDUCE_MOTION, SHOW_GRID];
      const seen: Array<{ vw: number; rows: Array<{ name: string; label: Box; control: Box }> }> = [];
      await verifyUi(page, U('33R-F-004', 'appearance_switch_alignment'), async (p) => {
        await openAccount(p);
        const rows: Array<{ name: string; label: Box; control: Box }> = [];
        for (const name of switches) {
          await expect(toggle(p, name)).toBeVisible();
          rows.push({ name, ...(await rowBoxes(p, name, toggle(p, name))) });
        }
        seen.push({ vw: (await viewportOf(p)).w, rows });
      }, FOUR);
      for (const m of seen) {
        for (const r of m.rows) {
          if (m.vw >= 1024) {
            const dy = Math.abs((r.label.top + r.label.bottom) / 2 - (r.control.top + r.control.bottom) / 2);
            expect.soft(dy, `${String(m.vw)}: "${r.name}" label vs switch centre`).toBeLessThanOrEqual(4);
          } else {
            expect.soft(r.label.bottom, `${String(m.vw)}: "${r.name}" label above the switch`).toBeLessThanOrEqual(r.control.top + 1);
          }
        }
      }
    });

    await test.step('[33R-F-002] "Tối" + "Gọn" + grid off + 3D dark on: same metrics, labels not clipped, no overlap', async () => {
      const seen: Array<{ vw: number; dark: boolean; clipped: string[]; overlapping: boolean }> = [];
      await verifyUi(page, U('33R-F-002', 'appearance_dark_compact'), async (p) => {
        await openAccount(p);
        await themeRadio(p, 'dark').click();
        await expect(themeRadio(p, 'dark')).toHaveAttribute('aria-checked', 'true');
        await densityGroup(p).getByRole('radio', { name: DENSITY.compact, exact: true }).click();
        await toggle(p, SHOW_GRID).click();
        await toggle(p, VIEWPORT_DARK).click();
        await expect(toggle(p, SHOW_GRID)).toHaveAttribute('aria-checked', 'false');
        await expect(toggle(p, VIEWPORT_DARK)).toHaveAttribute('aria-checked', 'true');
        await expect(p.locator('html')).toHaveClass(DARK_CLASS);
        const clipped = await appearance(p).evaluate((root) =>
          [...root.querySelectorAll('span, button')]
            .filter((el) => el instanceof HTMLElement && el.scrollWidth > el.clientWidth + 1)
            .map((el) => (el.textContent ?? '').trim().slice(0, 40)),
        );
        const controls = [themeGroup(p), densityGroup(p), toggle(p, SHOW_GRID), toggle(p, VIEWPORT_DARK), toggle(p, REDUCE_MOTION)];
        const boxes = await Promise.all(controls.map((c) => rect(c)));
        const overlapping = boxes.some((a, i) => boxes.some((b, j) => j > i && intersects(a, b)));
        seen.push({ vw: (await viewportOf(p)).w, dark: true, clipped, overlapping });
      }, FOUR);
      // The theme is the one value that survives in localStorage: put it back so the next states start from the stored default.
      await page.evaluate((key) => window.localStorage.removeItem(key), THEME_STORAGE_KEY);
      for (const m of seen) {
        expect.soft(m.clipped, `${String(m.vw)}: no clipped label`).toEqual([]);
        expect.soft(m.overlapping, `${String(m.vw)}: controls do not overlap`).toBe(false);
      }
    });

    await test.step('[33R-F-003] "Giảm chuyển động" on: the checked option has the static fill, no [data-segment-thumb]', async () => {
      const seen: Array<{ vw: number; thumbs: number; checkedClass: string }> = [];
      await verifyUi(page, U('33R-F-003', 'appearance_reduced_motion'), async (p) => {
        await openAccount(p);
        await toggle(p, REDUCE_MOTION).click();
        await expect(toggle(p, REDUCE_MOTION)).toHaveAttribute('aria-checked', 'true');
        const checked = themeGroup(p).locator('[role="radio"][aria-checked="true"]');
        await expect(checked).toHaveCount(1);
        seen.push({
          vw: (await viewportOf(p)).w,
          thumbs: await themeGroup(p).locator('[data-segment-thumb]').count(),
          checkedClass: (await checked.getAttribute('class')) ?? '',
        });
      }, FOUR);
      for (const m of seen) {
        expect.soft(m.thumbs, `${String(m.vw)}: no sliding thumb`).toBe(0);
        expect.soft(m.checkedClass, `${String(m.vw)}: static fill on the checked option`).toMatch(/\bbg-bg-surface\b/u); // AP:179 motionOff && isActive
      }
      expect.soft(await checkedTheme(page), 'a theme option is checked').toMatch(/^(?:light|dark|system)$/u);
    });
    expect(writes.list(), 'the Giao diện cases send no write').toEqual([]);
  } finally {
    writes.stop();
    await context.close();
  }
});

/* ================================================================= FL-33R-10 */

/** Flips one notification cell from the keyboard (native checkbox, NS:158-163) and drops the focus ring. */
async function flip(page: Page, event: string, channel: string): Promise<void> {
  const cell = page.getByRole('checkbox', { name: cellName(event, channel), exact: true });
  await cell.focus();
  await page.keyboard.press('Space');
  await cell.evaluate((el) => (el as HTMLElement).blur());
}

test('SCR-33 · FL-33R-10 · UI Thông báo y Phím tắt (4 khổ)', async ({ browser }) => {
  test.setTimeout(Math.max(120_000, 2 * 150_000));
  const admin = await adminApi();
  const user = await poolUser(admin, 'engineer', 'p07-prefs-4');
  await admin.dispose();
  const { context, page } = await openUserSession(browser, user);
  const writes = recordWrites(page);
  const rows = (p: Page): Locator => shortcuts(p).locator('tbody tr');
  const search = (p: Page): Locator => shortcuts(p).getByRole('searchbox', { name: SHORTCUTS.search, exact: true });
  try {
    await test.step('[33R-F-005] matrix default: no overflow, 3 columns, 5 body rows, channel columns 136 px, every cell inside the card', async () => {
      const seen: Array<{ vw: number; columns: number; bodyRows: number; channelWidths: number[]; cardOk: boolean }> = [];
      const metrics = await verifyUi(page, U('33R-F-005', 'matrix_default'), async (p) => {
        await openAccount(p);
        const section = notifications(p);
        await expect(section.getByRole('table')).toBeVisible();
        const card = await rect(section);
        const cells = await section.locator('td').all();
        const cellBoxes = await Promise.all(cells.map((c) => rect(c)));
        const heads = await section.locator('thead th').all();
        const headBoxes = await Promise.all(heads.slice(1).map((h) => rect(h)));
        seen.push({
          vw: (await viewportOf(p)).w,
          columns: heads.length,
          bodyRows: await section.locator('tbody tr').count(),
          channelWidths: headBoxes.map((b) => Math.round(b.width)),
          cardOk: cellBoxes.length > 0 && cellBoxes.every((b) => within(b, card)),
        });
      }, FOUR);
      expect(metrics.filter((m) => m.openError !== undefined), 'the matrix opened at every width').toEqual([]);
      for (const m of seen) {
        expect(m.columns, `${String(m.vw)}: 3 columns`).toBe(3);
        expect(m.bodyRows, `${String(m.vw)}: 5 body rows`).toBe(NOTIFICATION_DEFAULTS.length);
        expect(m.channelWidths, `${String(m.vw)}: both channel columns 136 px`).toEqual([136, 136]); // NS:135-145 w-[136px]
        expect(m.cardOk, `${String(m.vw)}: every cell inside the card`).toBe(true);
      }
    });

    await test.step('[33R-F-006] matrix with four cells flipped: each flipped cell renders differently from its default', async () => {
      const flips: ReadonlyArray<readonly [string, string]> = [
        [NOTIFICATION_DEFAULTS[0]?.label ?? '', CHANNELS.inApp],
        [NOTIFICATION_DEFAULTS[0]?.label ?? '', CHANNELS.email],
        [NOTIFICATION_DEFAULTS[1]?.label ?? '', CHANNELS.inApp],
        [NOTIFICATION_DEFAULTS[4]?.label ?? '', CHANNELS.inApp],
      ];
      const seen: Array<{ vw: number; changed: boolean[]; overflow: boolean }> = [];
      await verifyUi(page, U('33R-F-006', 'matrix_changed'), async (p) => {
        await openAccount(p);
        const cellOf = (event: string, channel: string): Locator =>
          notifications(p).locator('tbody tr').filter({ has: p.getByRole('checkbox', { name: cellName(event, channel), exact: true }) }).locator('td').nth(channel === CHANNELS.inApp ? 0 : 1);
        const before: Buffer[] = [];
        for (const [event, channel] of flips) before.push(await cellOf(event, channel).screenshot({ animations: 'disabled' }));
        for (const [event, channel] of flips) await flip(p, event, channel);
        const changed: boolean[] = [];
        for (const [i, [event, channel]] of flips.entries()) {
          const after = await cellOf(event, channel).screenshot({ animations: 'disabled' });
          changed.push(!after.equals(before[i] ?? Buffer.alloc(0)));
        }
        const card = await rect(notifications(p));
        const cells = await Promise.all((await notifications(p).locator('td').all()).map((c) => rect(c)));
        seen.push({ vw: (await viewportOf(p)).w, changed, overflow: !cells.every((b) => within(b, card)) });
      }, FOUR);
      for (const m of seen) {
        expect.soft(m.changed, `${String(m.vw)}: all four flipped cells changed pixels`).toEqual([true, true, true, true]);
        expect.soft(m.overflow, `${String(m.vw)}: every cell inside the card`).toBe(false);
      }
    });

    await test.step('[33R-F-007] Phím tắt default: 6 rows, "6 phím tắt đang có hiệu lực.", key caps on one line in the 168 px column', async () => {
      const seen: Array<{ vw: number; rows: number; count: string; heights: number[]; wrapped: string[]; column: number }> = [];
      await verifyUi(page, U('33R-F-007', 'shortcuts_default'), async (p) => {
        await openAccount(p);
        await expect(rows(p)).toHaveCount(6);
        await expect(shortcuts(p).getByRole('status')).toHaveText('6 phím tắt đang có hiệu lực.');
        const perRow = await rows(p).evaluateAll((trs) =>
          trs.map((tr) => {
            const caps = [...tr.querySelectorAll('kbd')].map((k) => k.getBoundingClientRect());
            const td = tr.querySelector('td')?.getBoundingClientRect();
            return {
              heights: caps.map((c) => Math.round(c.height)),
              oneLine: caps.every((c) => Math.abs(c.top - (caps[0]?.top ?? 0)) < 1),
              inside: td === undefined || caps.every((c) => c.right <= td.right + 1),
            };
          }),
        );
        const head = await rect(shortcuts(p).locator('thead th').first());
        seen.push({
          vw: (await viewportOf(p)).w,
          rows: perRow.length,
          count: (await shortcuts(p).getByRole('status').innerText()).trim(),
          heights: [...new Set(perRow.flatMap((r) => r.heights))],
          wrapped: perRow.flatMap((r, i) => (r.oneLine && r.inside ? [] : [`row ${String(i + 1)}`])),
          column: Math.round(head.width),
        });
      }, FOUR);
      for (const m of seen) {
        expect.soft(m.count, `${String(m.vw)}: count sentence`).toMatch(SHORTCUTS.all);
        expect.soft(m.heights, `${String(m.vw)}: all key caps one height`).toHaveLength(1);
        expect.soft(m.wrapped, `${String(m.vw)}: key caps stay on one line inside the column`).toEqual([]);
        expect.soft(m.column, `${String(m.vw)}: key column 168 px`).toBe(168); // SS:134-138 w-[168px]
      }
    });

    await test.step('[33R-F-008] filter "Ctrl": 4 rows and "Đang hiện 4 trong 6 phím tắt."', async () => {
      const seen: Array<{ vw: number; rows: number; count: string }> = [];
      await verifyUi(page, U('33R-F-008', 'shortcuts_filtered'), async (p) => {
        await openAccount(p);
        await search(p).fill('Ctrl');
        await expect(shortcuts(p).getByRole('status')).toHaveText(SHORTCUTS.filtered(4, 6));
        await expect(rows(p)).toHaveCount(4);
        seen.push({ vw: (await viewportOf(p)).w, rows: await rows(p).count(), count: (await shortcuts(p).getByRole('status').innerText()).trim() });
      }, FOUR);
      for (const m of seen) {
        expect.soft(m.rows, `${String(m.vw)}: 4 rows`).toBe(4);
        expect.soft(m.count, `${String(m.vw)}: filtered count`).toBe(SHORTCUTS.filtered(4, 6));
      }
    });

    await test.step('[33R-F-009] filter "qa-e07-zzz": one empty-sentence row spanning both columns', async () => {
      const seen: Array<{ vw: number; rows: number; cell: Box; table: Box }> = [];
      await verifyUi(page, U('33R-F-009', 'shortcuts_no_match'), async (p) => {
        await openAccount(p);
        await search(p).fill('qa-e07-zzz');
        const empty = shortcuts(p).getByText(SHORTCUTS.empty, { exact: true });
        await expect(empty).toBeVisible();
        await expect(rows(p)).toHaveCount(1);
        seen.push({ vw: (await viewportOf(p)).w, rows: await rows(p).count(), cell: await rect(empty), table: await rect(shortcuts(p).getByRole('table')) });
      }, FOUR);
      for (const m of seen) {
        expect.soft(m.rows, `${String(m.vw)}: a single row`).toBe(1);
        expect.soft(m.cell.width, `${String(m.vw)}: the sentence cell spans both columns (colSpan 2)`).toBeGreaterThanOrEqual(m.table.width - 2);
      }
    });
    expect(writes.list(), 'the Thông báo / Phím tắt cases send no write').toEqual([]);
  } finally {
    writes.stop();
    await context.close();
  }
});
