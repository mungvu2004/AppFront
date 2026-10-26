/**
 * Phase 3 — UI verify, SCR-13 pipeline graph (QA-03d P10): FL-U13-01, FL-U13-02,
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
import { expect, test, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { attachJson } from './support/evidence';
import {
  GATE,
  GRAPH,
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

/* ================================================================= SCR-13 / SCR-15 admin */

test('SCR-13/15 · FL-U13-01 · admin: graph compact list, then dead links on the graph', async ({ browser }) => {
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
            list: await p.locator(`ol[aria-label="${GRAPH.crumb}"] > li`).count(),
            group: await p.getByRole('group', { name: GRAPH.crumb, exact: true }).count(),
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

/* ================================================================= SCR-15 viewer */

/* ================================================================= SCR-15 loading (mocked) */
