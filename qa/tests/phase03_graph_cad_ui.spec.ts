/**
 * Phase 3 — UI verify, SCR-13 pipeline graph and SCR-15 CAD branch confirm (QA-03d P10): FL-U13-01, FL-U13-02,
 * FL-U15-01 … FL-U15-03 of `flow-plan.md`. One `test()` per flow; each catalog row is a `test.step` capturing one
 * state at 1440 / 1024 / 768 / 375 through `verifyUi` (skill `qa-verify-ui`: shot + layout metrics per width,
 * `<name>.json` beside the shots). `verifyUi` re-opens the state per width, so each `open` rebuilds it from page load;
 * row-specific measures are soft checks inside `open`. Copy and selectors: `support/p03/P10.ts`.
 *
 * Users: the phase admin (API + browser login per flow, no stored session file) owns every project; pool
 * `engineer:shared` (FL-U13-02) and `viewer:shared` (FL-U15-02) are added to one own project each. Safe under
 * `--workers 4`: no shared project, no user state change.
 * Mocks: FL-U15-03 ("[mocked response]": `GET …/floors` held through the four captures, then let through).
 * and FL-U13-01 [15-F-006]/[15-F-007] ("[mocked response]": `GET …/floors` answered 404 without `resource`).
 *
 * Real-backend budget per run: logins 2 per flow = 10; `POST /api/projects` 5 (deleted); members add 2; no upload.
 */
import { expect, test, type Page, type Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { attachJson } from './support/evidence';
import { fulfillJson, holdRequests } from './support/p03/P6';
import {
  CAD,
  GATE,
  GRAPH,
  NOT_FOUND_SENTENCE,
  bogusFloorId,
  cadDialog,
  floorAt,
  floorsRe,
  handoff,
  handoffAlert,
  mappingPanel,
  notice,
  optionsDetails,
  optionsSummary,
  previewBox,
  stageTwo,
  unknownProjectId,
  withAdminProject,
  withMemberProject,
} from './support/p03/P10';
import { verifyUi, type UiMetrics } from './support/ui-verify';

const width = (page: Page): number => page.viewportSize()?.width ?? 0;
/** The state must have opened at every width (verifyUi itself only fails softly). */
const opened = (all: readonly UiMetrics[]): void => {
  expect.soft(all.filter((m) => m.openError !== undefined).map((m) => `${m.viewport}: ${m.openError ?? ''}`)).toEqual([]);
};

/** Stage 2 of SCR-15 from a fresh load: dialog → Esc → hand-off "Dùng đường từ CAD". */
async function openStageTwo(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect(cadDialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(cadDialog(page)).toHaveCount(0);
  await handoff(page).getByRole('button', { name: CAD.useCad, exact: true }).click();
  await expect(stageTwo(page)).toBeVisible();
}

/* ================================================================= SCR-13 / SCR-15 admin */

test('SCR-13/15 · FL-U13-01 · admin: graph compact list, then dead links on graph and CAD confirm', async ({ browser }) => {
  test.setTimeout(240_000);
  await withAdminProject(browser, '13-f-004', 1, async ({ flow, project }) => {
    const { page } = flow;
    const unknown = unknownProjectId();

    await test.step('[13-F-004] own project empty story ×4; < 1024 the overview is an <ol> of 5 blocks, no edge svg', async () => {
      const layout: Record<number, { list: number; group: number; svg: number; empty: boolean }> = {};
      opened(
        await verifyUi(page, 'U03_13-F-004_graph_empty', async (p) => {
          await p.goto(ROUTES.project.pipelineGraph(project.projectId));
          await expect(p.getByText(GRAPH.emptyTitle, { exact: true })).toBeVisible();
          layout[width(p)] = {
            list: await p.locator(`ol[aria-label="${GRAPH.title}"] > li`).count(),
            group: await p.getByRole('group', { name: GRAPH.title, exact: true }).count(),
            svg: await p.locator('svg polyline').count(),
            empty: await p.getByText(GRAPH.emptyTitle, { exact: true }).isVisible(),
          };
        }),
      );
      for (const [w, got] of Object.entries(layout)) {
        const compact = Number(w) < 1024;
        expect.soft(got, `${w}px`).toEqual({ list: compact ? 5 : 0, group: compact ? 0 : 1, svg: compact ? 0 : 5, empty: true });
      }
      await attachJson('U03_13-F-004_layout.json', layout);
    });

    await test.step('[13-F-002] unknown project graph: not-found strip in the 1080 column, way out reachable ×4', async () => {
      const facts: Record<number, { inColumn: boolean; buttonInView: boolean }> = {};
      opened(
        await verifyUi(page, 'U03_13-F-002_graph_not_found', async (p) => {
          await p.goto(ROUTES.project.pipelineGraph(unknown));
          const strip = p.getByRole('alert').filter({ hasText: GATE.notFoundTitle });
          await expect(strip).toContainText(GATE.notFoundSentence);
          const button = strip.getByRole('button', { name: GATE.backToProjects, exact: true });
          facts[width(p)] = {
            inColumn: (await strip.locator('xpath=ancestor::div[contains(@class,"max-w-[1080px]")]').count()) > 0,
            buttonInView: await button.evaluate((b) => {
              const r = b.getBoundingClientRect();
              return r.left >= 0 && r.right <= window.innerWidth && r.width > 0;
            }),
          };
        }),
      );
      for (const [w, got] of Object.entries(facts)) expect.soft(got, `${w}px`).toEqual({ inColumn: true, buttonInView: true });
    });

    // QA-03f (T1): an unknown project no longer opens the dialog — a 404 `project` on #12 is "project missing", only the shared
    // not-found strip (useCadBranchConfirm.ts:771-772, CadBranchConfirm.tsx:296-307; edge [15-B-004]). The error dialog is
    // reached on the own project through a failing #12, as edge [15-E-004] does (phase03_graph_cad_edge.spec.ts:655-664).
    // The mock is a 404 WITHOUT `resource: 'project'`: not project-missing (useProjectSpatial.ts:31-35), state 'error'
    // (useCadBranchConfirm.ts:601-602), and not retried — 404 is not transient (retry.ts:3, 30-31) and the notFound kind is
    // `retryable: false` (kinds.ts:90-99), so the shots do not wait out the 5xx retries of BUG-570 (queryClient.ts:13-14).
    const pid = project.projectId;
    const cadUrl = ROUTES.project.cadConfirm(pid, bogusFloorId());
    const failRead = (route: Route): Promise<void> =>
      route.request().method() === 'GET' ? fulfillJson(route, 404, { code: 'NOT_FOUND', requestId: 'qa-p10-mock' }) : route.fallback();
    await page.route(`**/api/projects/${pid}/floors`, failRead);
    try {
      await test.step('[15-F-006] [mocked response] #12 404 (not the project): error dialog with the NOT_FOUND alert ×4', async () => {
        opened(
          await verifyUi(
            page,
            'U03_15-F-006_cad_error_dialog',
            async (p) => {
              await p.goto(cadUrl);
              // cadChoiceDisabledReason = failure.sentence (useCadBranchConfirm.ts:680, 898-903): the notFound description.
              await expect(cadDialog(p).getByRole('alert')).toContainText(NOT_FOUND_SENTENCE);
              await expect.soft(cadDialog(p).getByRole('button', { name: CAD.useCad, exact: true })).toBeDisabled();
            },
            undefined,
            { fullPage: false },
          ),
        );
      });

      await test.step('[15-F-007] Esc → "Không thể đọc tệp CAD" notice + hand-off ×4', async () => {
        opened(
          await verifyUi(page, 'U03_15-F-007_cad_error_handoff', async (p) => {
            await p.goto(cadUrl);
            await expect(cadDialog(p).getByRole('alert')).toBeVisible();
            await p.keyboard.press('Escape');
            await expect(cadDialog(p)).toHaveCount(0);
            await expect(notice(p)).toContainText(CAD.errorTitle); // CadBranchConfirm.tsx:95, 145, 335-345
            await expect(handoffAlert(p)).toBeVisible(); // CadBranchConfirm.tsx:273
          }),
        );
      });
    } finally {
      await page.unroute(`**/api/projects/${pid}/floors`, failRead);
    }
  });
});

/* ================================================================= SCR-13 engineer */

test('SCR-13 · FL-U13-02 · engineer member sees the forbidden graph', async ({ browser }) => {
  test.setTimeout(150_000);
  await withMemberProject(browser, 'engineer', '13-f-003', 1, async ({ session, project }) => {
    await test.step('[13-F-003] overview + forbidden line, no empty story ×4', async () => {
      opened(
        await verifyUi(session.page, 'U03_13-F-003_graph_forbidden', async (p) => {
          await p.goto(ROUTES.project.pipelineGraph(project.projectId));
          await expect(p.getByText(GRAPH.forbiddenLine, { exact: true })).toBeVisible();
          await expect.soft(p.getByText(GRAPH.blocks[0][0], { exact: true })).toBeVisible();
          await expect.soft(p.getByText(GRAPH.emptyTitle, { exact: true })).toHaveCount(0);
        }),
      );
    });
  });
});

/* ================================================================= SCR-15 admin, many floors */

test('SCR-15 · FL-U15-01 · admin: dialog with many floors, then stage 2 open / options / collapsed', async ({ browser }) => {
  test.setTimeout(300_000);
  await withAdminProject(browser, '15-f-010', 16, async ({ flow, project }) => {
    const { page } = flow;
    const url = ROUTES.project.cadConfirm(project.projectId, floorAt(project, 0).id);

    await test.step('[15-F-010] dialog with 16 floors ×4: body scrolls, footer buttons visible', async () => {
      const facts: Record<number, { scrolls: boolean; footerInView: boolean[] }> = {};
      opened(
        await verifyUi(
          page,
          'U03_15-F-010_dialog_many_floors',
          async (p) => {
            await p.goto(url);
            const dialog = cadDialog(p);
            await expect(dialog.getByRole('table').nth(1).locator('tbody tr')).toHaveCount(16);
            const body = dialog.locator('div.overflow-y-auto').first();
            const footerInView: boolean[] = [];
            for (const name of [CAD.dismiss, CAD.useAi, CAD.useCad]) {
              footerInView.push(
                await dialog.getByRole('button', { name, exact: true }).evaluate((b) => {
                  const r = b.getBoundingClientRect();
                  return r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth;
                }),
              );
            }
            facts[width(p)] = { scrolls: await body.evaluate((el) => el.scrollHeight > el.clientHeight), footerInView };
          },
          undefined,
          { fullPage: false },
        ),
      );
      for (const [w, got] of Object.entries(facts)) expect.soft(got, `${w}px`).toEqual({ scrolls: true, footerInView: [true, true, true] });
    });

    const boxes: Record<number, { panel: { x: number; y: number; w: number; h: number } | null; canvas: { x: number; y: number; w: number; h: number } | null }> = {};

    // QA-03e (BUG-561, FIX-2292): the mapping panel is `w-[420px] max-w-full shrink-0` (CadLayerMappingPanel.tsx:187), so it
    // never runs past the viewport — no horizontal scroll at 375.
    await test.step('[15-F-003] Esc → hand-off "Dùng đường từ CAD" → stage 2 ×4; the mapping panel fits every width', async () => {
      opened(
        await verifyUi(page, 'U03_15-F-003_stage_two', async (p) => {
          await openStageTwo(p, url);
          await expect(mappingPanel(p)).toBeVisible();
          const box = async (sel: ReturnType<typeof previewBox>) => {
            const b = await sel.boundingBox();
            return b === null ? null : { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
          };
          boxes[width(p)] = { panel: await box(mappingPanel(p)), canvas: await box(previewBox(p)) };
        }),
      );
      await attachJson('U03_15-F-003_boxes.json', boxes);
      for (const [w, got] of Object.entries(boxes)) {
        if (got.panel !== null) expect.soft(got.panel.x + got.panel.w, `${w}px: mapping panel right edge inside the viewport`).toBeLessThanOrEqual(Number(w));
      }
    });

    await test.step('[15-F-011] from the same captures: < 1024 mapping stacks above the canvas; side by side from 1024', async () => {
      for (const [w, got] of Object.entries(boxes)) {
        if (got.panel === null || got.canvas === null) {
          expect.soft(got, `${w}px: both boxes measured`).toEqual('measured');
          continue;
        }
        const stacked = got.canvas.y >= got.panel.y + got.panel.h - 1;
        const sideBySide = got.canvas.x >= got.panel.x + got.panel.w - 1 && Math.abs(got.canvas.y - got.panel.y) < 40;
        expect.soft({ stacked, sideBySide }, `${w}px (lg:flex-row, CB:374)`).toEqual(
          Number(w) < 1024 ? { stacked: true, sideBySide: false } : { stacked: false, sideBySide: true },
        );
      }
    });

    await test.step('[15-F-004] "Tuỳ chọn nhập" open ×4', async () => {
      opened(
        await verifyUi(page, 'U03_15-F-004_options_open', async (p) => {
          await openStageTwo(p, url);
          await optionsSummary(p).click();
          await expect.poll(() => optionsDetails(p).evaluate((d) => (d as HTMLDetailsElement).open)).toBe(true);
          await expect(p.getByRole('combobox', { name: CAD.originLabel, exact: true })).toBeVisible();
        }),
      );
    });

    await test.step('[15-F-005] "Thu gọn bảng lớp" → canvas takes the row ×4', async () => {
      const facts: Record<number, { canvasWidth: number; regionWidth: number }> = {};
      opened(
        await verifyUi(page, 'U03_15-F-005_panel_collapsed', async (p) => {
          await openStageTwo(p, url);
          await stageTwo(p).getByRole('button', { name: CAD.collapse, exact: true }).click();
          await expect(stageTwo(p).getByRole('button', { name: CAD.expand, exact: true })).toBeVisible();
          await expect(mappingPanel(p)).toHaveCount(0);
          facts[width(p)] = {
            canvasWidth: Math.round((await previewBox(p).boundingBox())?.width ?? 0),
            regionWidth: Math.round((await stageTwo(p).boundingBox())?.width ?? 0),
          };
        }),
      );
      // The region has px-4 (2 × 16 px) around the row.
      for (const [w, got] of Object.entries(facts)) {
        expect.soft(got.canvasWidth, `${w}px: canvas fills the row`).toBeGreaterThanOrEqual(got.regionWidth - 34);
      }
      await attachJson('U03_15-F-005_widths.json', facts);
    });
  });
});

/* ================================================================= SCR-15 viewer */

test('SCR-15 · FL-U15-02 · viewer member sees the forbidden dialog', async ({ browser }) => {
  test.setTimeout(150_000);
  await withMemberProject(browser, 'viewer', '15-f-008', 1, async ({ session, project }) => {
    await test.step('[15-F-008] dialog with the forbidden alert, "Dùng đường từ CAD" disabled ×4', async () => {
      opened(
        await verifyUi(
          session.page,
          'U03_15-F-008_cad_forbidden',
          async (p) => {
            await p.goto(ROUTES.project.cadConfirm(project.projectId, floorAt(project, 0).id));
            const dialog = cadDialog(p);
            await expect(dialog.getByRole('alert')).toContainText(CAD.forbiddenNotice);
            await expect.soft(dialog.getByRole('button', { name: CAD.useCad, exact: true })).toBeDisabled();
          },
          undefined,
          { fullPage: false },
        ),
      );
    });
  });
});

/* ================================================================= SCR-15 loading (mocked) */

test('SCR-15 · FL-U15-03 · [mocked response] floor list held: loading state', async ({ browser }) => {
  test.setTimeout(150_000);
  await withAdminProject(browser, '15-f-009', 1, async ({ flow, project }) => {
    const { page } = flow;
    await test.step('[15-F-009] "Đang đọc tệp CAD" skeleton + dialog with a header-only floor table ×4', async () => {
      const pid = project.projectId;
      const hold = await holdRequests(page, (r) => r.method() === 'GET' && floorsRe(pid).test(new URL(r.url()).pathname));
      try {
        opened(
          await verifyUi(
            page,
            'U03_15-F-009_cad_loading',
            async (p) => {
              await p.goto(ROUTES.project.cadConfirm(pid, floorAt(project, 0).id));
              await expect(p.getByRole('status', { name: CAD.loading, exact: true })).toBeVisible();
              const dialog = cadDialog(p);
              await expect(dialog).toBeVisible();
              await expect.soft(dialog.getByRole('table').nth(1).locator('tbody tr')).toHaveCount(0);
            },
            undefined,
            { fullPage: false },
          ),
        );
      } finally {
        await hold.release('continue');
      }
    });
  });
});
