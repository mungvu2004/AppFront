/**
 * Phase 5 — SCR-27 mobile viewer, dedicated UI-verification cases (skill `qa-verify-ui`; QA-05c P6, flows-C5
 * "phase05_mobile_ui.spec.ts"): three flows, 16 steps. Each step is one screen state run through `verifyUi` at
 * 1440 / 1024 / 768 / 375 (evidence `U05_<row id>_<slug>_<width>.png` + `.json`, the layout metrics the review reads);
 * the steps that carry an extra claim measure it right after `verifyUi`, while the page is still at 375.
 * The context is a touch desktop context (no `isMobile`) so the wide widths render as wide widths.
 *
 * Seeds (through the real API, deleted in `finally`): Q2 (two layered floors), E0L (80-char name, no layer),
 * QC:wall-one, Q1. FL-27-17 is `[mocked response]` (weak device, no role, held N15, #24 500), each step on a page of its own.
 * Real twins: FL-27-16 (the real states), FL-27-13 / FL-27-14 in `phase05_mobile_mocked_edge.spec.ts` (the same mocks).
 * `⚑` = suspected bug written as the correct behaviour: 27-F-006.
 *
 * ## Request budget
 * - Logins 3, fixture refresh tokens 3, ~1 refresh per page load (≈ 100 loads: 4 widths × 24 states).
 * - Projects: FL-27-15 1 (Q2, 2 layers), FL-27-16 3 (E0L, wall-one, Q1), FL-27-17 1 (Q1); `DELETE` the same; no rate limit.
 * - The screen writes nothing; the taps in 27-F-004 / 27-F-007 are read-only picks and measures.
 */
import { expect, test, type Page } from '@playwright/test';

import { UI_VIEWPORTS, verifyUi } from './support/ui-verify';
import {
  MV,
  SCENE_TIMEOUT_MS,
  closeMobileFlow,
  createLongNameProject,
  failRoute,
  floorRows,
  group,
  holdRoute,
  measureRows,
  mobileUrl,
  nav,
  note,
  openMobile,
  openMobileFlow,
  projectRe,
  refreshWithRoles,
  region,
  regionStats,
  seedLayer,
  seedQc,
  sheet,
  spatialRe,
  tapCanvas,
  toggleMeasure,
  tool,
  uniq,
  wallOne,
  webglOff,
  type MobileFlow,
} from './support/p05/P6';

const DESKTOP = { width: 1440, height: 900 } as const;
const closeAll = async (flow: MobileFlow | undefined): Promise<void> => {
  expect.soft(await closeMobileFlow(flow), 'fixture cleanup').toEqual([]);
};
const uiFlow = (browser: Parameters<typeof openMobileFlow>[0]): Promise<MobileFlow> => openMobileFlow(browser, { viewport: DESKTOP, mobile: false });

/** The tool bar sits on the bottom edge of the viewport (MVV:207-260 column layout). */
async function expectNavAtBottom(page: Page): Promise<void> {
  const box = await nav(page).boundingBox();
  const height = page.viewportSize()?.height ?? 0;
  expect.soft((box?.y ?? 0) + (box?.height ?? 0), `bottom of the tool bar at ${String(height)} px high`).toBeGreaterThanOrEqual(height - 1);
}

test.describe('U05 SCR-27 mobile viewer — UI verification (QA-05c P6)', () => {
  test('SCR-27 · FL-27-15 · model states', async ({ browser }) => {
    test.setTimeout(240_000); // 7 states × 4 widths × (load + Pascal build)
    let flow: MobileFlow | undefined;
    try {
      flow = await uiFlow(browser);
      const { page } = flow;
      const q2 = await seedQc(flow, 'm27-ui', ['Tầng 1', 'Tầng 2'], 2); // Q2
      const open = async (p: Page): Promise<void> => {
        await openMobile(p, q2.id);
        await expectNavAtBottom(p);
      };

      await test.step('[27-F-001] H: model loaded, no layout errors, nav at the bottom edge', async () => {
        const metrics = await verifyUi(page, 'U05_27-F-001_model_loaded', open);
        expect(metrics.map((m) => m.openError)).toEqual(UI_VIEWPORTS.map(() => undefined));
      });

      await test.step('[27-F-002] BUG-485/482: model framed inside the canvas at 375', async () => {
        await verifyUi(page, 'U05_27-F-002_framing', open);
        // The page is at 375×812 now. The canvas fills the region; header (48) and bar (56) are over it, so read the middle band.
        const size = page.viewportSize() ?? { width: 375, height: 812 };
        const band = { top: Math.round(size.height * 0.2), height: Math.round(size.height * 0.45) };
        const png = await page.screenshot({ clip: { x: 0, y: band.top, width: size.width, height: band.height }, animations: 'disabled' });
        const left = await regionStats(png, { left: 0, top: 0, width: 8, height: band.height });
        const right = await regionStats(png, { left: size.width - 8, top: 0, width: 8, height: band.height });
        const centre = await regionStats(png, { left: Math.round(size.width * 0.3), top: Math.round(band.height * 0.25), width: Math.round(size.width * 0.4), height: Math.round(band.height * 0.5) });
        expect.soft(left.sd, 'left 8 px strip std-dev (luminance)').toBeLessThan(4);
        expect.soft(right.sd, 'right 8 px strip std-dev (luminance)').toBeLessThan(4);
        const away = Math.hypot(...centre.mean.map((value, index) => value - (left.mean[index] ?? 0)));
        expect.soft(Math.max(away, centre.sd), 'the centre differs from the background (colour distance / std-dev)').toBeGreaterThan(8);
      });

      await test.step('[27-F-003] "Tầng" sheet with two floors', async () => {
        await verifyUi(page, 'U05_27-F-003_floors_sheet', async (p) => {
          await open(p);
          await tool(p, MV.floors).click();
          await expect(group(p, MV.floors)).toBeVisible();
          await expect(floorRows(p)).toHaveCount(2);
        });
      });

      await test.step('[27-F-005] "Đo" empty copy wraps without a lone last word', async () => {
        await verifyUi(page, 'U05_27-F-005_measure_empty', async (p) => {
          await open(p);
          await toggleMeasure(p, true);
          await expect(group(p, MV.measure).getByText(MV.measureEmpty, { exact: true })).toBeVisible();
        });
        // MVB:175 `text-pretty`: count the words on the copy's last rendered line at 375.
        const lastLineWords = await group(page, MV.measure)
          .getByText(MV.measureEmpty, { exact: true })
          .evaluate((el) => {
            const text = el.firstChild;
            if (text === null) return 0;
            const lines = new Map<number, number>();
            const content = text.textContent ?? '';
            const wordPattern = /\S+/gu;
            for (let match = wordPattern.exec(content); match !== null; match = wordPattern.exec(content)) {
              const range = document.createRange();
              range.setStart(text, match.index);
              range.setEnd(text, match.index + match[0].length);
              const top = Math.round(range.getClientRects()[0]?.top ?? 0);
              lines.set(top, (lines.get(top) ?? 0) + 1);
            }
            const tops = [...lines.keys()].sort((a, b) => a - b);
            return lines.get(tops[tops.length - 1] ?? 0) ?? 0;
          });
        expect.soft(lastLineWords, 'words on the last line of the empty copy').toBeGreaterThanOrEqual(2);
      });

      await test.step('[27-F-004] "Đo" with two measurement rows (four taps)', async () => {
        await verifyUi(page, 'U05_27-F-004_measure_rows', async (p) => {
          await open(p);
          await toggleMeasure(p, true);
          await tapCanvas(p, 0.35, 0.5);
          await tapCanvas(p, 0.65, 0.5);
          await tapCanvas(p, 0.4, 0.6);
          await tapCanvas(p, 0.6, 0.4);
          await expect(measureRows(p)).toHaveCount(2);
        });
      });

      await test.step('[27-F-006] ⚑ BUG-488: the empty "Thông tin" sheet is sized to its content and the bar stays visible', async () => {
        await verifyUi(
          page,
          'U05_27-F-006_info_empty',
          async (p) => {
            await open(p);
            await tool(p, MV.info).click();
            await expect(sheet(p)).toBeVisible();
          },
          UI_VIEWPORTS,
          { fullPage: false },
        );
        // MVI:130, 204: the sheet opens at 45 % and sits `absolute bottom-0 z-20` over the bar.
        const box = await sheet(page).boundingBox();
        const handle = await sheet(page).locator('div.touch-none').boundingBox();
        const copy = await sheet(page).getByText(MV.infoEmpty, { exact: true }).boundingBox();
        const bar = await nav(page).boundingBox();
        const content = (handle?.height ?? 0) + (copy?.height ?? 0) + 24; // + the `pb-6` of the body (MVI:245)
        expect.soft(box?.height ?? Infinity, `sheet height (px) vs header + content ${String(Math.round(content))}`).toBeLessThanOrEqual(content + 8);
        expect.soft((bar?.y ?? 0) + (bar?.height ?? 0), 'tool bar bottom (px) above the sheet top').toBeLessThanOrEqual((box?.y ?? 0) + 1);
      });

      await test.step('[27-F-008] Sheet expanded (90 %)', async () => {
        await verifyUi(
          page,
          'U05_27-F-008_sheet_expanded',
          async (p) => {
            await open(p);
            await tool(p, MV.info).click();
            await sheet(p).getByRole('button', { name: MV.expandSheet, exact: true }).click(); // MVI:227-235
            await expect(sheet(p).getByRole('button', { name: MV.shrinkSheet, exact: true })).toBeVisible();
          },
          UI_VIEWPORTS,
          { fullPage: false },
        );
      });
    } finally {
      await closeAll(flow);
    }
  });

  test('SCR-27 · FL-27-16 · data states', async ({ browser }) => {
    test.setTimeout(200_000); // 5 states × 4 widths
    let flow: MobileFlow | undefined;
    try {
      flow = await uiFlow(browser);
      const { page, context } = flow;
      const empty = await createLongNameProject(flow, `-${uniq().slice(0, 4)}`); // E0L (the tag keeps the name unique, 80 chars)
      const wall = await seedLayer(flow, 'm27-ui-wall', wallOne); // QC:wall-one
      const q1 = await seedQc(flow, 'm27-ui-q1'); // Q1
      const unknown = `prj_qa-u05-${uniq()}`; // random id

      await test.step('[27-F-009] H: empty state + 80-char name', async () => {
        const metrics = await verifyUi(page, 'U05_27-F-009_empty_long_name', async (p) => {
          await p.goto(mobileUrl(empty.id));
          await expect(p.getByRole('heading', { name: MV.emptyTitle, exact: true })).toBeVisible({ timeout: SCENE_TIMEOUT_MS }); // MVV:105-114
          await expect(p.getByRole('heading', { level: 1, name: empty.name, exact: true })).toBeVisible(); // MVV:221
        });
        expect(metrics.map((m) => m.openError)).toEqual(UI_VIEWPORTS.map(() => undefined));
      });

      await test.step('[27-F-010] Partial note (walls only)', async () => {
        await verifyUi(page, 'U05_27-F-010_partial_note', async (p) => {
          await openMobile(p, wall.id, false);
          await expect(note(p, MV.partialRooms)).toBeVisible({ timeout: SCENE_TIMEOUT_MS }); // MVV:138-146
        });
      });

      await test.step('[27-F-007] Wall sheet with the desktop invite', async () => {
        await verifyUi(
          page,
          'U05_27-F-007_wall_sheet_invite',
          async (p) => {
            await openMobile(p, wall.id, false);
            await tapCanvas(p, 0.5, 0.5);
            await expect(sheet(p).getByRole('heading', { name: /^Tường W-/u })).toBeVisible();
            await expect(sheet(p).getByText('Sửa trên máy tính để chính xác hơn', { exact: true })).toBeVisible(); // MVI:253-282
          },
          UI_VIEWPORTS,
          { fullPage: false },
        );
      });

      await test.step('[27-F-011] Not-found gate', async () => {
        await verifyUi(page, 'U05_27-F-011_not_found', async (p) => {
          await p.goto(mobileUrl(unknown));
          await expect(p.getByRole('alert').filter({ hasText: MV.notFoundTitle })).toBeVisible(); // PSG:48-61
          await expect(region(p)).toHaveCount(0);
        });
      });

      await test.step('[27-F-014] Weak-network note (offline per width)', async () => {
        try {
          await verifyUi(page, 'U05_27-F-014_weak_network', async (p) => {
            await context.setOffline(false);
            await openMobile(p, q1.id);
            await context.setOffline(true);
            await expect(note(p, MV.weakNetwork)).toBeVisible(); // MVV:141-142
          });
        } finally {
          await context.setOffline(false);
        }
      });
    } finally {
      await closeAll(flow);
    }
  });

  // Pairs: FL-27-16 (the real states), FL-27-13 / FL-27-14 in phase05_mobile_mocked_edge (the same mocks, behaviour asserted there).
  test('SCR-27 · FL-27-17 · [mocked response] error, forbidden, loading, gate error', async ({ browser }) => {
    test.setTimeout(200_000);
    let flow: MobileFlow | undefined;
    try {
      flow = await uiFlow(browser);
      const { context } = flow;
      const q1 = await seedQc(flow, 'm27-ui-mock'); // Q1
      /** Each mocked state gets a page of its own: an init script or a route cannot be taken back. */
      const onFreshPage = async (prepare: (p: Page) => Promise<void>, run: (p: Page) => Promise<void>): Promise<void> => {
        const p = await context.newPage();
        try {
          await prepare(p);
          await run(p);
        } finally {
          await p.close();
        }
      };

      await test.step('[27-F-012] H: weak-device error (M:webgl-off)', async () => {
        await onFreshPage(
          (p) => p.addInitScript(webglOff),
          async (p) => {
            const metrics = await verifyUi(p, 'U05_27-F-012_weak_device', async (q) => {
              await q.goto(mobileUrl(q1.id));
              await expect(q.getByRole('heading', { name: MV.weakTitle, exact: true })).toBeVisible({ timeout: SCENE_TIMEOUT_MS }); // MVV:70-90
            });
            expect(metrics.map((m) => m.openError)).toEqual(UI_VIEWPORTS.map(() => undefined));
          },
        );
      });

      await test.step('[27-F-013] Forbidden (M:refresh-roles-empty)', async () => {
        await onFreshPage(
          (p) => refreshWithRoles(p, []),
          async (p) => {
            await verifyUi(p, 'U05_27-F-013_forbidden', async (q) => {
              await q.goto(mobileUrl(q1.id));
              await expect(q.getByRole('heading', { name: MV.forbiddenTitle, exact: true })).toBeVisible({ timeout: SCENE_TIMEOUT_MS }); // MVV:117-126
            });
          },
        );
      });

      await test.step('[27-F-015] Loading note (M:N15-delay)', async () => {
        await onFreshPage(
          async () => undefined,
          async (p) => {
            const held = await holdRoute(p, 'GET', (path) => spatialRe(q1.id).test(path));
            try {
              await verifyUi(p, 'U05_27-F-015_loading_note', async (q) => {
                await q.goto(mobileUrl(q1.id));
                await expect(note(q, MV.loading)).toBeVisible({ timeout: SCENE_TIMEOUT_MS }); // MVV:129-134
              });
            } finally {
              held.release();
            }
          },
        );
      });

      await test.step('[27-F-016] Gate read error (M:#24-500)', async () => {
        await onFreshPage(
          async (p) => {
            await failRoute(p, 'GET', (path) => projectRe(q1.id).test(path), 500);
          },
          async (p) => {
            await verifyUi(p, 'U05_27-F-016_gate_error', async (q) => {
              await q.goto(mobileUrl(q1.id));
              await expect(q.getByRole('alert').filter({ has: q.getByRole('button', { name: MV.retry, exact: true }) })).toBeVisible(); // PSG:78-91
            });
          },
        );
      });
    } finally {
      await closeAll(flow);
    }
  });
});
