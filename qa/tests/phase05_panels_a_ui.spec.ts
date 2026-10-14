/**
 * Phase 5 — SCR-23 side panels "Diện tích phòng" + "Thư viện đồ đạc", dedicated UI verification (skill `qa-verify-ui`; QA-05c P3,
 * plan `flows-C2.md` "phase05_panels_a_ui.spec.ts": 5 flows, 13 steps). Each step is one visible state, re-opened and shot at
 * 1920 / 1440 / 1024 / 768 by `verifyUi` (`U05_<row id>_<slug>_<width>.png` + `.json` metrics: horizontal scroll, off-screen
 * controls, broken images, clipped text, overlaps, small targets). On top of that each step measures its own subject against
 * its container — the Pascal canvas box the vendor sidebar lives in (PV:255-260) — because the sidebar is a fixed 432 px slot
 * (AS:48-54) clipped by that box's `overflow-hidden` at narrow widths (⚑ 23R-F-001 / 23F-F-001, "768/375").
 *
 * Data: each flow seeds its own run-unique project (`support/p05/P3.ts` RA1 / RA2 / RA3 / FX) and deletes it in `finally`.
 * No "0 non-GET" guard in this file: FL-23R-U1 renames a room for real (the rename strip is the state under test), once per width.
 * No faked response. Non-serial.
 *
 * ## Request budget per full run
 * - `POST /api/auth/login`: 0 admin (stored session) + 1 viewer (FL-23RF-U1).
 * - `POST /api/auth/refresh`: 2 per flow + 1 per load (13 states × 4 widths = 52 loads) ≈ 62.
 * - `POST /api/projects` 5 + `DELETE` 5; seed #35 PUTs ≈ 12; `POST …/members` 1; screen PUTs 4 (FL-23R-U1 step 3).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import type { UiMetrics } from './support/ui-verify';
import { verifyUi } from './support/ui-verify';
import {
  FL,
  RA,
  chip,
  chipGroup,
  closeAdminSession,
  combo,
  detectedRow,
  detectedStrip,
  expand,
  fullPage,
  itemCount,
  openAdminSession,
  openMemberSession,
  openPascal,
  openRailPanel,
  outsideFrame,
  panelTotal,
  renameBand,
  renameInput,
  replaceButton,
  searchBox,
  seedFX,
  seedRA1,
  seedRA2,
  seedRA3,
  tile,
  tiles,
  undoButton,
  type AdminSession,
  type MemberSession,
} from './support/p05/P3';

const VIEWER_SLOT = 'p05-panels-a';
/** Per load: Pascal build (≤ 60 s, typically 5–15 s); `/3d` has no tour to wait for. */
const LOAD_ESTIMATE_MS = 15_000;
const timeoutFor = (loads: number): number => Math.max(120_000, 2 * loads * LOAD_ESTIMATE_MS);

type Targets = Readonly<Record<string, Locator>>;
interface StateCheck {
  readonly metrics: UiMetrics[];
  /** `<width>: <problem>` for every subject outside its container. */
  readonly outside: string[];
}

/**
 * `verifyUi` on one state; `open` brings the page there and returns the subjects to measure (`against` canvas box or viewport),
 * plus optional extra problems of its own (pushed to `extra`).
 */
async function verifyState(
  page: Page,
  name: string,
  open: (p: Page, extra: string[]) => Promise<Targets>,
  against: 'canvas' | 'viewport' = 'canvas',
): Promise<StateCheck> {
  const outside: string[] = [];
  const metrics = await verifyUi(page, name, async (p) => {
    const extra: string[] = [];
    const targets = await open(p, extra);
    const width = String(p.viewportSize()?.width ?? 0);
    outside.push(...[...(await outsideFrame(p, targets, against)), ...extra].map((problem) => `${width}: ${problem}`));
  });
  return { metrics, outside };
}

/** H steps: the state must at least open at the first width (1920) (the rest is soft inside `verifyUi`). */
const opensAt1440 = (check: StateCheck): void => {
  expect(check.metrics[0]?.openError, 'the state opens at 1920').toBeUndefined();
};

test.describe('U05 SCR-23 side panels A — UI verify (QA-05c P3)', () => {
  /* ======================================================================== FL-23R-U1 */
  test('SCR-23 · FL-23R-U1 · RA1: bảng thu gọn → mở rộng → đổi tên → toàn trang', async ({ browser }) => {
    test.setTimeout(timeoutFor(16));
    let s: AdminSession | undefined;
    try {
      s = await openAdminSession(browser);
      const { page } = s;
      const seeded = await seedRA1(s, 'p3-ru1');
      const openPanel = async (p: Page): Promise<Locator> => {
        await openPascal(p, seeded.projectId);
        return openRailPanel(p, RA.title);
      };
      let renames = 0;

      await test.step('[23R-F-001] panel open, collapsed: no horizontal scroll, h2 + total inside the frame (⚑ 768)', async () => {
        const check = await verifyState(page, 'U05_23R-F-001_collapsed', async (p) => {
          const panel = await openPanel(p);
          await expect(panel.getByText(RA.collapsedHint, { exact: true })).toBeVisible();
          return { h2: panel.locator('h2'), total: panelTotal(panel) };
        });
        opensAt1440(check);
        expect.soft(check.outside).toEqual([]);
      });

      await test.step('[23R-F-002] expanded: same checks', async () => {
        const check = await verifyState(page, 'U05_23R-F-002_expanded', async (p) => {
          const panel = await openPanel(p);
          await expand(panel);
          return { h2: panel.locator('h2'), total: panelTotal(panel), lastRow: panel.locator('section li').last() };
        });
        expect.soft(check.outside).toEqual([]);
      });

      await test.step('[23R-F-006] rename textbox + "Hoàn tác" strip: same checks', async () => {
        const check = await verifyState(page, 'U05_23R-F-006_rename', async (p) => {
          const panel = await openPanel(p);
          await panel.locator('section li button').first().dblclick();
          renames += 1;
          // A new name per width: the same name again would be a no-op (RAP:135) and show no strip.
          await renameInput(panel).fill(`Phòng khách ${String(renames)}`);
          await expect(renameBand(panel)).toBeVisible();
          await expect(renameInput(panel)).toBeVisible();
          return { input: renameInput(panel), strip: renameBand(panel), undo: undoButton(panel) };
        });
        expect.soft(check.outside).toEqual([]);
      });

      await test.step('[23R-F-007] full page: the dialog covers the frame, the table does not overflow (⚑ 23R-B-016)', async () => {
        const check = await verifyState(
          page,
          'U05_23R-F-007_full-page',
          async (p, extra) => {
            const panel = await openPanel(p);
            await panel.getByRole('button', { name: RA.openFullPage, exact: true }).click();
            const dialog = fullPage(p);
            await expect(dialog).toBeVisible();
            const [box, frame, table] = [await dialog.boundingBox(), await p.getByTestId('pascal-canvas').boundingBox(), await dialog.locator('table').boundingBox()];
            if (box === null || frame === null) {
              extra.push('dialog / canvas has no box');
            } else {
              const cover =
                (Math.max(0, Math.min(box.x + box.width, frame.x + frame.width) - Math.max(box.x, frame.x)) *
                  Math.max(0, Math.min(box.y + box.height, frame.y + frame.height) - Math.max(box.y, frame.y))) /
                (frame.width * frame.height);
              if (cover < 0.9) extra.push(`dialog covers ${cover.toFixed(2)} of the canvas box (< 0.9)`);
              if (table !== null && table.x + table.width > box.x + box.width + 1) extra.push('table wider than the dialog');
            }
            return { close: dialog.getByRole('button', { name: RA.closeFullTable, exact: true }), table: dialog.locator('table') };
          },
          'viewport',
        );
        expect.soft(check.outside).toEqual([]);
      });
    } finally {
      await closeAdminSession(s);
    }
  });

  /* ======================================================================== FL-23R-U2 */
  test('SCR-23 · FL-23R-U2 · RA2: một phần → lỗi', async ({ browser }) => {
    test.setTimeout(timeoutFor(8));
    let s: AdminSession | undefined;
    try {
      s = await openAdminSession(browser);
      const { page } = s;
      const seeded = await seedRA2(s, 'p3-ru2');
      const openPanel = async (p: Page): Promise<Locator> => {
        await openPascal(p, seeded.projectId);
        return openRailPanel(p, RA.title);
      };

      await test.step('[23R-F-004] partial: the footer notice is inside the frame', async () => {
        const check = await verifyState(page, 'U05_23R-F-004_partial', async (p) => {
          const panel = await openPanel(p);
          const notice = panel.locator('footer').getByRole('status');
          await expect(notice).toContainText(RA.partialTitle);
          return { notice };
        });
        opensAt1440(check);
        expect.soft(check.outside).toEqual([]);
      });

      await test.step('[23R-F-005] filter "Mái" (error): the `role=alert` block is inside the frame', async () => {
        const check = await verifyState(page, 'U05_23R-F-005_error', async (p) => {
          const panel = await openPanel(p);
          await combo(panel, RA.levelFilter).selectOption({ label: 'Mái' });
          const alert = panel.getByRole('alert');
          await expect(alert).toContainText(RA.errorTitle);
          return { alert };
        });
        expect.soft(check.outside).toEqual([]);
      });
    } finally {
      await closeAdminSession(s);
    }
  });

  /* ======================================================================== FL-23R-U3 */
  test('SCR-23 · FL-23R-U3 · RA3: rỗng + kiểm khe hở', async ({ browser }) => {
    test.setTimeout(timeoutFor(4));
    let s: AdminSession | undefined;
    try {
      s = await openAdminSession(browser);
      const { page } = s;
      const seeded = await seedRA3(s, 'p3-ru3');

      await test.step('[23R-F-003] empty, "Kiểm tra khe hở tường" clicked: the empty card and the result line are inside the frame', async () => {
        const check = await verifyState(page, 'U05_23R-F-003_empty-gaps', async (p) => {
          await openPascal(p, seeded.projectId);
          const panel = await openRailPanel(p, RA.title);
          await panel.getByRole('button', { name: RA.detectSpaces, exact: true }).click();
          const result = panel.getByText(RA.gapsClosed(1), { exact: true });
          await expect(result).toBeVisible();
          return { emptyTitle: panel.getByText(RA.emptyTitle, { exact: true }), result };
        });
        opensAt1440(check);
        expect.soft(check.outside).toEqual([]);
      });
    } finally {
      await closeAdminSession(s);
    }
  });

  /* ======================================================================== FL-23RF-U1 */
  test('SCR-23 · FL-23RF-U1 · vai xem', async ({ browser }) => {
    test.setTimeout(timeoutFor(8));
    let s: AdminSession | undefined;
    let v: MemberSession | undefined;
    try {
      s = await openAdminSession(browser);
      const seeded = await seedFX(s, 'p3-rfu1');
      v = await openMemberSession(browser, s, seeded.projectId, 'viewer', VIEWER_SLOT);
      const { page } = v;

      await test.step('[23R-F-008] "Diện tích phòng" as a viewer: the role notice is inside the frame', async () => {
        const check = await verifyState(page, 'U05_23R-F-008_viewer-rooms', async (p) => {
          await openPascal(p, seeded.projectId);
          const panel = await openRailPanel(p, RA.title);
          const notice = panel.getByRole('status').filter({ hasText: RA.forbiddenNotice });
          await expect(notice).toBeVisible();
          return { notice };
        });
        opensAt1440(check);
        expect.soft(check.outside).toEqual([]);
      });

      await test.step('[23F-F-005] "Thư viện đồ đạc" as a viewer: notice + dimmed tiles inside the frame', async () => {
        const check = await verifyState(page, 'U05_23F-F-005_viewer-library', async (p) => {
          await openPascal(p, seeded.projectId);
          const panel = await openRailPanel(p, FL.title);
          const notice = panel.getByText(FL.readOnlyNotice, { exact: true });
          await expect(notice).toBeVisible();
          await expect(tiles(panel).first()).toBeDisabled();
          return { notice, firstTile: tiles(panel).first() };
        });
        expect.soft(check.outside).toEqual([]);
      });
    } finally {
      await v?.context.close().catch(() => undefined);
      await closeAdminSession(s);
    }
  });

  /* ======================================================================== FL-23F-U1 */
  test('SCR-23 · FL-23F-U1 · FX: lưới → chọn thẻ → xem trước → tìm rỗng', async ({ browser }) => {
    test.setTimeout(timeoutFor(16));
    let s: AdminSession | undefined;
    try {
      s = await openAdminSession(browser);
      const { page } = s;
      const seeded = await seedFX(s, 'p3-fu1');
      const openLibrary = async (p: Page): Promise<Locator> => {
        await openPascal(p, seeded.projectId);
        const panel = await openRailPanel(p, FL.title);
        await expect(itemCount(panel)).toHaveText(FL.count(111));
        return panel;
      };
      const pickChair = async (panel: Locator): Promise<void> => {
        await tile(panel, 'Dining Chair').click();
        await expect(replaceButton(detectedRow(panel, 'ghế (3)'))).toBeEnabled();
      };

      await test.step('[23F-F-001] grid "Tất cả": chips wrap, no horizontal scroll (⚑ 768)', async () => {
        const check = await verifyState(page, 'U05_23F-F-001_grid', async (p) => {
          const panel = await openLibrary(p);
          return { chips: chipGroup(panel), lastChip: chip(panel, 'Của tôi'), count: itemCount(panel) };
        });
        opensAt1440(check);
        expect.soft(check.outside).toEqual([]);
      });

      await test.step('[23F-F-002] detected strip + a picked tile: same checks', async () => {
        const check = await verifyState(page, 'U05_23F-F-002_strip-picked', async (p) => {
          const panel = await openLibrary(p);
          await pickChair(panel);
          return { strip: detectedStrip(panel), picked: tile(panel, 'Dining Chair') };
        });
        expect.soft(check.outside).toEqual([]);
      });

      await test.step('[23F-F-003] preview dialog: inside the viewport, its list scrolls (`max-h-60`, DFS:189, 196)', async () => {
        const check = await verifyState(
          page,
          'U05_23F-F-003_preview',
          async (p, extra) => {
            const panel = await openLibrary(p);
            await pickChair(panel);
            await replaceButton(detectedRow(panel, 'ghế (3)')).click();
            const dialog = p.getByRole('dialog', { name: FL.previewTitle('ghế', 3), exact: true });
            await expect(dialog).toBeVisible();
            const list = dialog.getByRole('list', { name: FL.previewList });
            const overflowY = await list.evaluate((el) => getComputedStyle(el).overflowY);
            if (overflowY !== 'auto' && overflowY !== 'scroll') extra.push(`preview list overflow-y "${overflowY}" (not scrollable)`);
            return { dialog, list, cancel: dialog.getByRole('button', { name: FL.cancel, exact: true }) };
          },
          'viewport',
        );
        expect.soft(check.outside).toEqual([]);
      });

      await test.step('[23F-F-004] search "zzz" (no match): the empty card is inside the frame', async () => {
        const check = await verifyState(page, 'U05_23F-F-004_search-empty', async (p) => {
          const panel = await openLibrary(p);
          await searchBox(panel).fill('zzz');
          const empty = panel.getByText(FL.emptyTitle, { exact: true });
          await expect(empty).toBeVisible();
          return { empty, search: searchBox(panel) };
        });
        expect.soft(check.outside).toEqual([]);
      });
    } finally {
      await closeAdminSession(s);
    }
  });
});
