/**
 * Phase 3 — EDGE flows, SCR-13 pipeline graph (QA-03d P10): FL-13-01, FL-13-02,
 * FL-15-01 … FL-15-04 of `flow-plan.md`. One `test()` per flow in user order; each catalog row is a
 * `test.step('[<row id>] …')`. Copy and selectors: `support/p03/P10.ts` (FE source cited there, c16f2428).
 *
 * Sessions: the phase admin signs in per flow (API + browser context, no stored session file), owns a fresh project
 * (`qa-<runId>-<slug>-…`) deleted in `finally`. No upload, no pool user, no shared state: safe under `--workers 4`.
 * Mocks: only the flows titled "[mocked response]" (FL-13-02 #24 held / 500 / aborted; FL-15-04 #floors held, 500,
 * aborted, 403, rewritten drawings[]).
 *
 * Real-backend budget per run: `POST /api/auth/login` 2 per flow = 12; `POST /api/projects` 6 (+ deletes);
 * `GET /api/projects/:id` and `…/floors` reads only. No write by the screens (asserted), no mail, no upload init.
 *
 * Folds (old isolated tests of `phase03_pipeline_edge.spec.ts`, deleted by the integrator):
 *   SCR-13 own project … only the #24 project read → FL-13-01 [13-A-001] [13-D-001] [13-B-002] [13-B-005]
 *   SCR-13 unknown project → its own not-found state and way out → FL-13-01 [13-B-006] [13-A-003]
 *   SCR-15 "Tiếp tục duyệt tường" in the dialog → /pipeline, no write; no "Ghi nhớ…" → FL-15-01 [15-A-001] [15-A-005]
 *   SCR-15 Esc closes the dialog → hand-off; … "Thu gọn bảng lớp" ↔ "Mở bảng lớp" → FL-15-01 [15-E-002],
 *     FL-15-02 [15-A-007] [15-D-001] [15-A-010]
 */
import { expect, test, type Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { attachJson, captureEvidence } from './support/evidence';
import { fulfillJson, holdRequests } from './support/p03/P6';
import {
  GATE,
  GRAPH,
  pathOf,
  projectRe,
  unknownProjectId,
  withAdminProject,
} from './support/p03/P10';

const softly = expect.configure({ soft: true });
const BREADCRUMB_NAV = 'Đường dẫn trang'; // src/components/shell/Breadcrumb.tsx:21 NAV_LABEL


/* ================================================================= SCR-13 */

test('SCR-13 · FL-13-01 · admin opens the graph of an own project by URL, reads it, then follows a dead link out', async ({ browser }) => {
  await withAdminProject(browser, '13-a-001', 1, async ({ flow, project }) => {
    const { page, log } = flow;
    const pid = project.projectId;
    const h1 = page.getByRole('heading', { level: 1, name: GRAPH.title, exact: true });
    const group = page.getByRole('group', { name: GRAPH.crumb, exact: true }); // S-12: GRAPH.title is now the h1 only
    const content = h1.locator('xpath=ancestor::div[contains(@class,"max-w-[1080px]")][1]');

    await test.step('[13-A-001] goto /pipeline/graph → h1 + lead; only request naming the project is #24', async () => {
      const mark = log.length;
      await page.goto(ROUTES.project.pipelineGraph(pid));
      await expect(h1).toBeVisible();
      await expect(page.getByText(GRAPH.lead, { exact: true })).toBeVisible();
      await expect(page.getByText(GRAPH.emptyTitle, { exact: true })).toBeVisible();
      await expect.poll(() => log.slice(mark).filter((e) => e.path.includes(pid)).length).toBeGreaterThan(0);
      await page.waitForTimeout(1_000);
      const reads = log.slice(mark).filter((e) => e.path.includes(pid)).map((e) => `${e.method} ${e.path}`);
      expect(reads, 'PGG:304-312: the graph reads only #24 for this project').toEqual([`GET /api/projects/${pid}`]);
      await captureEvidence(page, 'E03_13-A-001_graph_own.png');
      await attachJson('E03_13-A-001_graph_reads.json', { reads });
    });

    await test.step('[13-D-001] admin: empty story, no forbidden line', async () => {
      await expect.soft(page.getByText(GRAPH.emptyTitle, { exact: true })).toBeVisible();
      await expect.soft(page.getByText(GRAPH.forbiddenLine, { exact: true })).toHaveCount(0);
    });

    await test.step('[13-B-002] reason line without a branch report', async () => {
      await expect.soft(page.getByText(GRAPH.reasonNoReport, { exact: true })).toBeVisible();
    });

    await test.step('[13-B-005] no branch switch, no "Chi tiết kỹ thuật"', async () => {
      await expect.soft(page.getByRole('button', { name: GRAPH.switch })).toHaveCount(0);
      await expect.soft(page.getByRole('button', { name: GRAPH.detail })).toHaveCount(0);
    });

    await test.step('[13-B-003] overview: 5 blocks + captions, 5 edges, no active badge, no dimmed branch', async () => {
      for (const [label, caption] of GRAPH.blocks) {
        await expect.soft(group.getByText(label, { exact: true }), label).toBeVisible();
        await expect.soft(group.getByText(caption, { exact: true }), caption).toBeVisible();
      }
      await expect.soft(group.locator('svg polyline')).toHaveCount(5);
      await expect.soft(page.getByText(GRAPH.activeBadge, { exact: true })).toHaveCount(0);
      const dimmed = await group.locator(':scope > div').evaluateAll((divs) => divs.filter((d) => (d as HTMLElement).style.opacity !== '').length);
      expect.soft(dimmed, 'PGO:296 no block carries the inactive-branch opacity').toBe(0);
      await captureEvidence(page, 'E03_13-B-003_overview_blocks.png');
    });

    await test.step('[13-B-004] no comparison caption, no evidence heading', async () => {
      await expect.soft(page.getByText(GRAPH.comparisonCaption, { exact: true })).toHaveCount(0);
      await expect.soft(page.getByRole('heading', { name: GRAPH.evidenceCaption })).toHaveCount(0);
    });

    await test.step('[13-C-001] overview names no technical library', async () => {
      const text = await page.locator('body').innerText();
      expect.soft(GRAPH.technical.filter((term) => text.includes(term)), 'PGT:9-14').toEqual([]);
    });

    // QA-03e (BUG-558, FIX-2291): the header uses the shared Breadcrumb (PipelineGraph.tsx:67-74), whose nav is named
    // "Đường dẫn trang" (src/components/shell/Breadcrumb.tsx:21, 25-29), no longer the diagram group's name.
    await test.step('[13-E-001] one h1; breadcrumb nav "Đường dẫn trang", only the diagram group is named "Sơ đồ xử lý"', async () => {
      await expect.soft(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect.soft(page.getByRole('navigation', { name: BREADCRUMB_NAV, exact: true })).toHaveCount(1);
      await expect.soft(page.locator(`nav[aria-label="${GRAPH.crumb}"]`)).toHaveCount(0);
      await expect.soft(group).toHaveCount(1);
    });

    await test.step('[13-E-002] group semantics; edge svg aria-hidden; nothing focusable in the content', async () => {
      await expect.soft(group).toHaveAttribute('role', 'group');
      await expect.soft(group.locator('svg')).toHaveAttribute('aria-hidden', 'true');
      await expect.soft(group).toContainText(GRAPH.blocks[0][0]);
      // QA-03e (BUG-546): the breadcrumb's "Dự án" button sits above the h1 in the same container; the content below has none.
      const focusable = await content.evaluate(
        (root) => [...root.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex="-1"])')].filter((el) => el.closest('nav') === null).length,
      );
      expect.soft(focusable, 'Tab from the h1 reaches nothing inside the content').toBe(0);
    });

    // QA-03e (BUG-546, FIX-2291): "Dự án" is a button → onBackToProjects (PipelineGraph.tsx:72,
    // PipelineGraph.container.tsx:137-138 ROUTES.dashboard); the last crumb is aria-current="page" (Breadcrumb.tsx:50-56).
    await test.step('[13-A-002] breadcrumb "Dự án › Sơ đồ xử lý": "Dự án" is a button back to "/", the last crumb is the current page', async () => {
      const nav = page.getByRole('navigation', { name: BREADCRUMB_NAV, exact: true });
      await expect.soft(nav).toHaveText(new RegExp(`^${GRAPH.breadcrumbProjects}\\s*›\\s*${GRAPH.crumb}$`, 'u'));
      await expect.soft(nav.locator('[aria-current="page"]')).toHaveText(GRAPH.crumb);
      await expect.soft(content.locator('a, [role="link"]')).toHaveCount(0);
      await captureEvidence(page, 'E03_13-A-002_breadcrumb_no_link.png');
      await nav.getByRole('button', { name: GRAPH.breadcrumbProjects, exact: true }).click();
      await softly.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
    });

    const unknown = unknownProjectId();
    const strip = page.getByRole('alert').filter({ hasText: GATE.notFoundTitle });

    await test.step('[13-B-006] unknown prj_ ULID → not-found strip, no empty story, #24 answered 404', async () => {
      await page.goto(ROUTES.project.pipelineGraph(unknown));
      await expect(strip).toContainText(GATE.notFoundSentence);
      await expect(page.getByText(GRAPH.emptyTitle, { exact: true })).toHaveCount(0);
      await expect
        .poll(() => log.filter((e) => projectRe(unknown).test(e.path)).map((e) => `${e.method} ${String(e.status)}`))
        .toContain('GET 404');
      await captureEvidence(page, 'E03_13-B-006_graph_unknown.png');
    });

    await test.step('[13-E-003] strip role=alert; Tab reaches "Về danh sách dự án"; Enter → "/"', async () => {
      await expect.soft(strip).toHaveAttribute('role', 'alert');
      const button = strip.getByRole('button', { name: GATE.backToProjects, exact: true });
      await page.locator('body').focus();
      let reached = false;
      for (let i = 0; i < 25 && !reached; i += 1) {
        await page.keyboard.press('Tab');
        reached = await button.evaluate((b) => b === document.activeElement);
      }
      expect.soft(reached, 'Tab reaches the way out').toBe(true);
      await captureEvidence(page, 'E03_13-E-003_strip_focus.png');
      if (!reached) await button.focus();
      await page.keyboard.press('Enter');
      await softly.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
    });

    await test.step('[13-A-003] Back to the dead graph link, click "Về danh sách dự án" → "/"', async () => {
      await page.goBack();
      await expect(strip).toBeVisible();
      await strip.getByRole('button', { name: GATE.backToProjects, exact: true }).click();
      await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
    });
  });
});

test('SCR-13 · FL-13-02 · [mocked response] slow or failing project read (#24) on the graph', async ({ browser }) => {
  await withAdminProject(browser, '13-b-007', 1, async ({ flow, project }) => {
    const { page } = flow;
    const pid = project.projectId;

    // QA-03e (BUG-556, FIX-2291): isPending includes the #24 query (usePipelineGraph.ts:528), so the screen stays a skeleton
    // (PipelineGraph.tsx:160-163) until #24 answers — no empty story flashes before the not-found strip.
    await test.step('[13-B-007] unknown id, #24 held 2 s: skeleton while pending (no empty story), then the not-found strip', async () => {
      const unknown = unknownProjectId();
      const hold = await holdRequests(page, (r) => r.method() === 'GET' && projectRe(unknown).test(new URL(r.url()).pathname));
      try {
        await page.goto(ROUTES.project.pipelineGraph(unknown));
        await hold.seen();
        const flashed = await page
          .getByText(GRAPH.emptyTitle, { exact: true })
          .waitFor({ state: 'visible', timeout: 1_500 })
          .then(() => true, () => false);
        expect.soft(flashed, 'no empty story while #24 is pending').toBe(false);
        await expect.soft(page.locator('.animate-pulse').first(), 'skeleton while #24 is pending').toBeVisible();
        await captureEvidence(page, 'E03_13-B-007_pending_flash.png', { caption: `empty story seen while pending: ${String(flashed)}` });
        await page.waitForTimeout(500);
      } finally {
        await hold.release('continue');
      }
      await expect.soft(page.getByRole('alert').filter({ hasText: GATE.notFoundTitle })).toBeVisible();
      await expect.soft(page.getByText(GRAPH.emptyTitle, { exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E03_13-B-007_then_not_found.png');
    });

    // QA-03e (BUG-557, FIX-2291): readProjectExists throws anything but 200 / 404 `project` (pipelineGraphGateway.ts:308-320);
    // the hook makes it the read failure (usePipelineGraph.ts:525-527, 709-716) → InlineAlert + "Thử lại" + <code> technicalCode
    // (PipelineGraph.tsx:198-206); "Thử lại" bumps retryToken and reads #24 again (usePipelineGraph.ts:237, 266).
    await test.step('[13-B-008] own project, #24 → 500, then aborted: alert + "Thử lại" + code, no empty story; "Thử lại" re-reads #24', async () => {
      const alert = page.getByRole('alert');
      const read = (route: Route): Promise<void> =>
        route.request().method() === 'GET' ? fulfillJson(route, 500, { code: 'INTERNAL', requestId: 'qa-p10-mock' }) : route.fallback();
      await page.route(`**/api/projects/${pid}`, read);
      await page.goto(ROUTES.project.pipelineGraph(pid));
      await expect.soft(alert.getByRole('button', { name: GRAPH.retry, exact: true })).toBeVisible({ timeout: 45_000 });
      await expect.soft(page.locator('code').filter({ hasText: 'INTERNAL' })).toBeVisible();
      await expect.soft(page.getByText(GRAPH.emptyTitle, { exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E03_13-B-008_read_500.png');
      await page.unroute(`**/api/projects/${pid}`, read);

      const abort = (route: Route): Promise<void> => (route.request().method() === 'GET' ? route.abort('failed') : route.fallback());
      await page.route(`**/api/projects/${pid}`, abort);
      await page.reload();
      await expect.soft(alert.getByRole('button', { name: GRAPH.retry, exact: true })).toBeVisible({ timeout: 45_000 });
      await expect.soft(page.locator('code').filter({ hasText: 'NETWORK' })).toBeVisible();
      await expect.soft(page.getByText(GRAPH.emptyTitle, { exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E03_13-B-008_read_aborted.png');
      await page.unroute(`**/api/projects/${pid}`, abort);

      await alert.getByRole('button', { name: GRAPH.retry, exact: true }).click();
      await expect.soft(page.getByText(GRAPH.emptyTitle, { exact: true })).toBeVisible({ timeout: 45_000 });
      await expect.soft(alert).toHaveCount(0);
    });
  });
});

/* ================================================================= SCR-15 */
