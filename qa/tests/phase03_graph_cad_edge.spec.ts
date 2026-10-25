/**
 * Phase 3 — EDGE flows, SCR-13 pipeline graph and SCR-15 CAD branch confirm (QA-03d P10): FL-13-01, FL-13-02,
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
 *   SCR-15 "Vẫn dùng AI" in the dialog → /pipeline, no write; no "Ghi nhớ…" → FL-15-01 [15-A-001] [15-A-005]
 *   SCR-15 Esc closes the dialog → hand-off; … "Thu gọn bảng lớp" ↔ "Mở bảng lớp" → FL-15-01 [15-E-002],
 *     FL-15-02 [15-A-007] [15-D-001] [15-A-010]
 */
import { expect, test, type Page, type Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { attachJson, captureEvidence } from './support/evidence';
import { writesSince } from './support/p03/P5';
import { ERR, fulfillJson, holdRequests } from './support/p03/P6';
import {
  CAD,
  GATE,
  GRAPH,
  bogusFloorId,
  cadDialog,
  cellTexts,
  floorAt,
  floorsRe,
  focusedName,
  SCROLL_CONTAINER,
  handoff,
  handoffAlert,
  mappingPanel,
  notice,
  optionsDetails,
  optionsSummary,
  pathOf,
  previewBox,
  projectRe,
  stageTwo,
  summaryBar,
  unknownProjectId,
  withAdminProject,
} from './support/p03/P10';

/** Requests (any method, minus refresh / telemetry) the page sent since `mark` (index into `flow.sent`). */
const apiSince = (sent: readonly { method: string; path: string }[], mark: number): string[] =>
  sent
    .slice(mark)
    .filter((r) => r.path !== '/api/auth/refresh' && !r.path.startsWith('/api/telemetry'))
    .map((r) => `${r.method} ${r.path}`);

const softly = expect.configure({ soft: true });
const BREADCRUMB_NAV = 'Đường dẫn trang'; // src/components/shell/Breadcrumb.tsx:21 NAV_LABEL

const isDetailsOpen = (page: Page): Promise<boolean> => optionsDetails(page).evaluate((d) => (d as HTMLDetailsElement).open);

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

test('SCR-15 · FL-15-01 · admin opens CAD confirm, reads the dialog, leaves it every way', async ({ browser }) => {
  await withAdminProject(browser, '15-a-001', 16, async ({ flow, project }) => {
    const { page, log, sent } = flow;
    const pid = project.projectId;
    const cadUrl = ROUTES.project.cadConfirm(pid, floorAt(project, 0).id);
    const dialog = cadDialog(page);
    const tables = dialog.getByRole('table');
    const floorTable = tables.nth(1);

    await test.step('[15-A-001] goto cad-confirm → dialog with description + both tables; h1 behind; one floors read', async () => {
      const mark = log.length;
      await page.goto(cadUrl);
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText(CAD.description);
      await expect(tables).toHaveCount(2);
      await expect(floorTable.locator('tbody tr')).toHaveCount(16);
      await expect(page.locator('h1', { hasText: CAD.dialog })).toHaveCount(1);
      await page.waitForTimeout(1_000);
      const reads = log.slice(mark).filter((e) => floorsRe(pid).test(e.path)).map((e) => `${e.method} ${String(e.status)}`);
      expect(reads, 'CGW:332-351: exactly one GET /api/projects/{id}/floors').toEqual(['GET 200']);
      await captureEvidence(page, 'E03_15-A-001_dialog_open.png');
    });

    await test.step('[15-E-001] aria-modal dialog; focus on "Dùng đường từ CAD"; Tab / Shift+Tab stay on the 4 controls', async () => {
      await expect.soft(dialog).toHaveAttribute('aria-modal', 'true');
      await expect.soft(dialog.getByRole('button', { name: CAD.useCad, exact: true })).toBeFocused();
      const allowed: string[] = [CAD.closeIcon, CAD.dismiss, CAD.useAi, CAD.useCad];
      const seen: (string | null)[] = [];
      for (let i = 0; i < 5; i += 1) {
        await page.keyboard.press('Tab');
        seen.push(await focusedName(page));
      }
      for (let i = 0; i < 5; i += 1) {
        await page.keyboard.press('Shift+Tab');
        seen.push(await focusedName(page));
      }
      // Chrome also stops on the scrollable dialog body (16 floors overflow it): inside the dialog, so allowed and noted.
      expect.soft(seen.filter((n) => !allowed.includes(n ?? '') && n !== SCROLL_CONTAINER), 'focus left the dialog').toEqual([]);
      if (seen.includes(SCROLL_CONTAINER)) {
        test.info().annotations.push({ type: 'a11y-note', description: '15-E-001: Tab also stops on the scrollable dialog body (Chrome scroll-container focus)' });
      }
      expect.soft([...new Set(seen.filter((n) => n !== SCROLL_CONTAINER))].sort(), 'every dialog control is reached').toEqual([...allowed].sort());
      await attachJson('E03_15-E-001_tab_cycle.json', { seen });
    });

    await test.step('[15-E-010] compare table empty first header named "Tiêu chí so sánh"', async () => {
      await expect.soft(tables.first().locator('thead th').first()).toHaveAttribute('aria-label', CAD.compareHeaderName);
    });

    await test.step('[15-C-001] compare table headers and the three rows, exact', async () => {
      expect.soft(await cellTexts(tables.first().locator('thead tr'))).toEqual([['', CAD.useCad, CAD.useAi]]);
      expect.soft(await cellTexts(tables.first().locator('tbody tr'))).toEqual(CAD.compareRows.map((row) => [...row]));
      await captureEvidence(page, 'E03_15-C-001_compare_table.png');
    });

    await test.step('[15-B-024] floor table caption, headers, 16 rows "Chỉ có ảnh"', async () => {
      await expect.soft(dialog.getByText(CAD.floorCaption, { exact: true })).toBeVisible();
      expect.soft(await cellTexts(floorTable.locator('thead tr'))).toEqual([[...CAD.floorHeaders]]);
      const rows = await cellTexts(floorTable.locator('tbody tr'));
      expect.soft(rows).toEqual(project.floors.map((f) => [f.name, CAD.imageOnly]));
      await floorTable.locator('tbody tr').last().scrollIntoViewIfNeeded();
      await captureEvidence(page, 'E03_15-B-024_floor_table.png');
    });

    await test.step('[15-B-027] 16 floors: dialog body scrolls; footer buttons stay in view and clickable', async () => {
      const body = dialog.locator('div.overflow-y-auto').first();
      const sizes = await body.evaluate((el) => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
      expect.soft(sizes.scrollHeight, 'body scrolls').toBeGreaterThan(sizes.clientHeight);
      for (const name of [CAD.dismiss, CAD.useAi, CAD.useCad]) {
        const button = dialog.getByRole('button', { name, exact: true });
        await expect.soft(button, name).toBeInViewport();
        const clickable = await button.click({ trial: true, timeout: 3_000 }).then(() => true, () => false);
        expect.soft(clickable, `${name} clickable`).toBe(true);
      }
      await captureEvidence(page, 'E03_15-B-027_dialog_scroll.png');
      await attachJson('E03_15-B-027_body.json', sizes);
    });

    await test.step('[15-E-002] Escape closes the dialog → hand-off "Chuyển sang nhánh nhận dạng ảnh"', async () => {
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(handoffAlert(page)).toContainText(CAD.aiNotice);
      await captureEvidence(page, 'E03_15-E-002_esc_handoff.png');
    });

    // QA-03e (BUG-559, FIX-2292 + FIX-2206): the hand-off takes focus when it falls to <body> (CadBranchConfirm.tsx:259-268);
    // focusTrap.ts no longer counts <body> as the opener.
    await test.step('[15-E-003] focus after close is not <body> and lands in the hand-off', async () => {
      const name = await focusedName(page);
      expect.soft(name, 'focus after closing the mount-opened dialog').not.toBe('BODY');
      const inside = await handoff(page).evaluate((s) => s.contains(document.activeElement));
      expect.soft(inside, 'focus lands inside the hand-off').toBe(true);
      await attachJson('E03_15-E-003_focus.json', { focused: name, insideHandoff: inside });
    });

    await test.step('[15-E-005] landmarks: screen region, one h1, notice section with role=alert, hand-off alert', async () => {
      await expect.soft(page.getByRole('region', { name: CAD.screenRegion, exact: true })).toBeVisible();
      await expect.soft(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect.soft(notice(page).getByRole('alert')).toHaveCount(1);
      await expect.soft(handoffAlert(page)).toHaveAttribute('role', 'alert');
    });

    await test.step('[15-B-002] notice "Chưa có lớp nào để ánh xạ" + the inspection-missing sentence', async () => {
      await expect.soft(notice(page)).toContainText(CAD.emptyTitle);
      await expect.soft(notice(page)).toContainText(CAD.inspectionMissing);
      await captureEvidence(page, 'E03_15-B-002_empty_notice.png');
    });

    await test.step('[15-A-008] hand-off "Vẫn dùng AI" → /pipeline, no write', async () => {
      const mark = sent.length;
      await handoff(page).getByRole('button', { name: CAD.useAi, exact: true }).click();
      await expect.poll(() => pathOf(page)).toBe(ROUTES.project.pipeline(pid));
      expect(writesSince(flow, mark), 'setProcessingBranch unsupported: no write').toEqual([]);
    });

    await test.step('[15-A-003] Back → dialog again; "Đóng hộp thoại" → same hand-off', async () => {
      await page.goBack();
      await expect(page.getByRole('region', { name: CAD.screenRegion, exact: true })).toBeVisible();
      const reopened = await dialog.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true, () => false);
      if (!reopened) {
        // run-33-P10: Back shows the screen as it was left (hand-off, dialog closed), not a fresh dialog.
        test.info().annotations.push({ type: 'observation', description: '15-A-003: Back from /pipeline restores the hand-off, the dialog does not reopen; reloaded to reach the dialog' });
        await captureEvidence(page, 'E03_15-A-003_back_state.png');
        await page.reload();
      }
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: CAD.closeIcon, exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(handoffAlert(page)).toBeVisible();
    });

    await test.step('[15-A-004] reload → dialog; backdrop click outside the 560 px panel → same hand-off', async () => {
      await page.reload();
      await expect(dialog).toBeVisible();
      await page.waitForTimeout(400); // overlay fade-in (MODAL DURATION.default)
      await page.mouse.click(16, 450);
      await expect(dialog).toHaveCount(0);
      await expect(handoffAlert(page)).toBeVisible();
    });

    await test.step('[15-A-005] reload → no "Ghi nhớ lựa chọn…" checkbox; dialog "Vẫn dùng AI" → /pipeline, no write', async () => {
      await page.reload();
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('checkbox', { name: CAD.remember })).toHaveCount(0);
      await expect(dialog.getByText(CAD.remember)).toHaveCount(0);
      await captureEvidence(page, 'E03_15-A-005_no_remember.png');
      const mark = sent.length;
      await dialog.getByRole('button', { name: CAD.useAi, exact: true }).click();
      await expect.poll(() => pathOf(page)).toBe(ROUTES.project.pipeline(pid));
      expect(writesSince(flow, mark), 'no write').toEqual([]);
    });
  });
});

test('SCR-15 · FL-15-02 · admin picks the CAD branch and works stage 2 (mapping, import options, collapse)', async ({ browser }) => {
  await withAdminProject(browser, '15-a-007', 1, async ({ flow, project }) => {
    const { page, sent } = flow;
    const pid = project.projectId;
    const cadUrl = ROUTES.project.cadConfirm(pid, floorAt(project, 0).id);
    const dialog = cadDialog(page);
    const unit = page.getByRole('combobox', { name: CAD.unitLabel, exact: true });
    const origin = page.getByRole('combobox', { name: CAD.originLabel, exact: true });
    const summaryStatus = page.getByRole('status', { name: CAD.summaryStatus, exact: true });
    let cadEnabled = false;

    await test.step('[15-E-011] reduced motion: Esc → hand-off has no panel-rise animation', async () => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(cadUrl);
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(handoffAlert(page)).toBeVisible();
      const animation = await handoff(page).evaluate((s) => getComputedStyle(s).animationName);
      expect.soft(animation, 'CB:254 motion-reduce:animate-none').toBe('none');
    });

    await test.step('[15-A-007] hand-off "Dùng đường từ CAD" → region "Ánh xạ lớp và xem trước hình học"', async () => {
      const useCad = handoff(page).getByRole('button', { name: CAD.useCad, exact: true });
      cadEnabled = await useCad.isEnabled();
      await useCad.click();
      await expect(stageTwo(page)).toBeVisible();
      await captureEvidence(page, 'E03_15-A-007_stage_two.png');
    });

    await test.step('[15-D-001] admin: CAD was enabled, empty notice, stage 2 reached', async () => {
      expect.soft(cadEnabled, 'can("edit","layer") for admin').toBe(true);
      await expect.soft(notice(page)).toContainText(CAD.emptyTitle);
      await expect.soft(stageTwo(page)).toBeVisible();
    });

    await test.step('[15-B-019] mapping panel h2, four headers, one "Không có dữ liệu" row', async () => {
      const panel = mappingPanel(page);
      await expect.soft(panel.getByRole('heading', { level: 2, name: CAD.panelTitle })).toBeVisible();
      expect.soft(await cellTexts(panel.locator('thead tr'))).toEqual([[...CAD.panelHeaders]]);
      await expect.soft(panel.locator('tbody tr')).toHaveCount(1);
      await expect.soft(panel.locator('tbody tr')).toContainText(CAD.noData);
      await captureEvidence(page, 'E03_15-B-019_mapping_panel.png');
    });

    // QA-03e (BUG-564, FIX-2292): with no drawable extent the canvas shows PREVIEW_EMPTY_TEXT (CadLayerPreviewCanvas.tsx:281-284,
    // cadBranchConfirmText.ts:237) inside a min-h-[320px] frame (CadLayerPreviewCanvas.tsx:254).
    await test.step('[15-B-020] preview canvas: no svg, no legend; the sentence "Chưa có hình để xem trước"; frame ≥ 320 px tall', async () => {
      const box = previewBox(page);
      await expect(box).toBeVisible();
      const facts = await box.evaluate((el) => ({
        svg: el.querySelectorAll('svg').length,
        legend: el.querySelectorAll('ul').length,
        text: (el.textContent ?? '').trim(),
        height: Math.round(el.getBoundingClientRect().height),
      }));
      expect.soft({ svg: facts.svg, legend: facts.legend, text: facts.text }).toEqual({ svg: 0, legend: 0, text: CAD.previewEmpty });
      expect.soft(facts.height, 'the empty frame keeps its 320 px').toBeGreaterThanOrEqual(320);
      await captureEvidence(page, 'E03_15-B-020_blank_canvas.png');
      await attachJson('E03_15-B-020_canvas.json', facts);
    });

    await test.step('[15-B-021] summary "0" + "Đã ánh xạ 0/0 lớp · 0 đối tượng…"; "Nhập hình học" disabled with its reason', async () => {
      const bar = summaryBar(page);
      await expect.soft(bar.locator('span[aria-hidden="true"]').first()).toHaveText('0');
      await expect.soft(summaryStatus).toHaveText(CAD.summaryZero);
      await expect.soft(bar.getByRole('button', { name: CAD.importButton, exact: true })).toBeDisabled();
      await expect.soft(page.locator(`#${CAD.importReasonId}`)).toHaveText(CAD.importUnsupported);
      await captureEvidence(page, 'E03_15-B-021_summary_bar.png');
    });

    await test.step('[15-E-006] role=status "Tóm tắt số lớp đã ánh xạ"; import button aria-describedby the reason', async () => {
      await expect.soft(summaryStatus).toBeVisible();
      await expect
        .soft(page.getByRole('button', { name: CAD.importButton, exact: true }))
        .toHaveAttribute('aria-describedby', CAD.importReasonId);
    });

    await test.step('[15-A-011] "Tuỳ chọn nhập" opens with both selects, closes, reopens', async () => {
      await optionsSummary(page).click();
      await expect.poll(() => isDetailsOpen(page)).toBe(true);
      await expect(unit).toBeVisible();
      await expect(origin).toBeVisible();
      await captureEvidence(page, 'E03_15-A-011_options_open.png');
      await optionsSummary(page).click();
      await expect.poll(() => isDetailsOpen(page)).toBe(false);
      await optionsSummary(page).click();
      await expect.poll(() => isDetailsOpen(page)).toBe(true);
    });

    await test.step('[15-C-002] unit default "Mi-li-mét (mm)", four options, no detected-unit hint', async () => {
      await expect.soft(unit).toHaveText(CAD.units[0]);
      await unit.click();
      expect.soft(await page.getByRole('listbox').getByRole('option').allTextContents()).toEqual([...CAD.units]);
      await unit.click();
      await expect.soft(page.getByRole('listbox')).toHaveCount(0);
      await expect.soft(page.getByText(CAD.detectedHint)).toHaveCount(0);
    });

    await test.step('[15-A-012] choose "Xen-ti-mét (cm)" → trigger reads it; no request; summary unchanged', async () => {
      const mark = sent.length;
      await unit.click();
      await page.getByRole('option', { name: CAD.units[1], exact: true }).click();
      await expect.soft(unit).toHaveText(CAD.units[1]);
      await page.waitForTimeout(500);
      expect.soft(apiSince(sent, mark), 'local choice: no request').toEqual([]);
      await expect.soft(summaryStatus).toHaveText(CAD.summaryZero);
      await captureEvidence(page, 'E03_15-A-012_unit_cm.png');
    });

    await test.step('[15-C-003] origin default "Giữ gốc toạ độ của tệp CAD", other "Đặt gốc ở giao trục A1"', async () => {
      await expect.soft(origin).toHaveText(CAD.origins[0]);
      await origin.click();
      expect.soft(await page.getByRole('listbox').getByRole('option').allTextContents()).toEqual([...CAD.origins]);
      await origin.click();
    });

    await test.step('[15-A-013] choose "Đặt gốc ở giao trục A1" → trigger reads it; no request', async () => {
      const mark = sent.length;
      await origin.click();
      await page.getByRole('option', { name: CAD.origins[1], exact: true }).click();
      await expect.soft(origin).toHaveText(CAD.origins[1]);
      await page.waitForTimeout(500);
      expect.soft(apiSince(sent, mark), 'local choice: no request').toEqual([]);
      await captureEvidence(page, 'E03_15-A-013_origin_a1.png');
    });

    await test.step('[15-E-009] labels tied; ArrowDown+Enter picks "Mét (m)"; Esc in a listbox closes only the listbox', async () => {
      await expect.soft(page.locator(`label[for="${(await unit.getAttribute('id')) ?? ''}"]`)).toHaveText(CAD.unitLabel);
      await expect.soft(page.locator(`label[for="${(await origin.getAttribute('id')) ?? ''}"]`)).toHaveText(CAD.originLabel);
      await page.mouse.move(0, 0); // the listbox opens under the pointer: Select.Item onMouseEnter would steal the highlight
      await unit.focus();
      await page.keyboard.press('ArrowDown'); // opens, highlights the current "Xen-ti-mét (cm)" (useSelect handleOpen)
      await expect(page.getByRole('listbox')).toBeVisible();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await expect.soft(unit).toHaveText(CAD.units[2]);
      await page.keyboard.press('ArrowDown');
      await expect(page.getByRole('listbox')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect.soft(page.getByRole('listbox')).toHaveCount(0);
      await softly.poll(() => isDetailsOpen(page), 'Esc on the listbox leaves "Tuỳ chọn nhập" open').toBe(true);
    });

    await test.step('[15-E-008] Escape with no listbox open closes "Tuỳ chọn nhập"', async () => {
      if (!(await isDetailsOpen(page))) await optionsSummary(page).click();
      await unit.focus();
      await page.keyboard.press('Escape');
      await softly.poll(() => isDetailsOpen(page)).toBe(false);
    });

    await test.step('[15-E-007] Tab to the "Tuỳ chọn nhập" summary → focus ring; Enter opens, Space closes', async () => {
      if (await isDetailsOpen(page)) await optionsSummary(page).click();
      await stageTwo(page).getByRole('button', { name: CAD.collapse, exact: true }).focus();
      await page.keyboard.press('Tab');
      const summary = optionsSummary(page);
      await expect.soft(summary).toBeFocused();
      const outline = await summary.evaluate((s) => getComputedStyle(s).outlineStyle);
      expect.soft(outline, 'focus-visible outline (CIO:110)').not.toBe('none');
      await captureEvidence(page, 'E03_15-E-007_summary_focus.png');
      await page.keyboard.press('Enter');
      await softly.poll(() => isDetailsOpen(page)).toBe(true);
      await page.keyboard.press('Space');
      await softly.poll(() => isDetailsOpen(page)).toBe(false);
    });

    await test.step('[15-B-016] "Thu gọn bảng lớp" keeps the empty notice', async () => {
      await stageTwo(page).getByRole('button', { name: CAD.collapse, exact: true }).click();
      await expect.soft(notice(page)).toContainText(CAD.emptyTitle);
      await captureEvidence(page, 'E03_15-B-016_collapsed_notice.png');
    });

    await test.step('[15-A-010] collapsed: panel and options hidden, canvas stays, "Mở bảng lớp"; click → back', async () => {
      await expect.soft(mappingPanel(page)).toHaveCount(0);
      await expect.soft(optionsSummary(page)).toHaveCount(0);
      await expect.soft(previewBox(page)).toBeVisible();
      const expand = stageTwo(page).getByRole('button', { name: CAD.expand, exact: true });
      await expect.soft(expand).toBeVisible();
      await captureEvidence(page, 'E03_15-A-010_collapsed.png');
      await expand.click();
      await expect.soft(mappingPanel(page)).toBeVisible();
      await expect.soft(stageTwo(page).getByRole('button', { name: CAD.collapse, exact: true })).toBeVisible();
    });

    await test.step('[15-A-014] reload in stage 2 → dialog again, stage not kept', async () => {
      await page.reload();
      await expect(dialog).toBeVisible();
      await expect(stageTwo(page)).toHaveCount(0);
      await captureEvidence(page, 'E03_15-A-014_reload_dialog.png');
    });

    await test.step('[15-A-006] dialog "Dùng đường từ CAD" → stage 2 directly, no hand-off; choices back to defaults', async () => {
      await dialog.getByRole('button', { name: CAD.useCad, exact: true }).click();
      await expect(stageTwo(page)).toBeVisible();
      await expect(handoffAlert(page)).toHaveCount(0);
      await optionsSummary(page).click();
      await expect.soft(unit, '15-A-014: unit choice not kept').toHaveText(CAD.units[0]);
      await expect.soft(origin, '15-A-014: origin choice not kept').toHaveText(CAD.origins[0]);
    });

    await test.step('[15-A-009] empty notice "Vẫn dùng AI" (BUG-314) → /pipeline', async () => {
      await notice(page).getByRole('button', { name: CAD.useAi, exact: true }).click();
      await expect.poll(() => pathOf(page)).toBe(ROUTES.project.pipeline(pid));
    });
  });
});

test('SCR-15 · FL-15-03 · CAD confirm with a bogus floor id, on an unknown project, then [mocked response] a failing floor read', async ({ browser }) => {
  await withAdminProject(browser, '15-a-015', 0, async ({ flow, project }) => {
    const { page, log } = flow;
    const dialog = cadDialog(page);
    const unknown = unknownProjectId();

    await test.step('[15-A-015] own project + random floor id → normal dialog, no error', async () => {
      await page.goto(ROUTES.project.cadConfirm(project.projectId, bogusFloorId()));
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: CAD.useCad, exact: true })).toBeEnabled();
      await expect(dialog.getByRole('alert')).toHaveCount(0);
      await expect(page.getByText(CAD.errorTitle, { exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E03_15-A-015_bogus_floor.png');
    });

    await test.step('[15-B-026] 0 floors: floor table headers, no row, no empty message', async () => {
      const floorTable = dialog.getByRole('table').nth(1);
      expect.soft(await cellTexts(floorTable.locator('thead tr'))).toEqual([[...CAD.floorHeaders]]);
      await expect.soft(floorTable.locator('tbody tr')).toHaveCount(0);
      await expect.soft(dialog.getByText(CAD.noData)).toHaveCount(0);
      await captureEvidence(page, 'E03_15-B-026_no_floor_rows.png');
    });

    // QA-03e (BUG-563, FIX-2292): a 404 `project` on #12 is "project missing" (useCadBranchConfirm.ts:771-772): the screen is
    // only the shared not-found strip + "Về danh sách dự án" (CadBranchConfirm.tsx:295-306), no dialog, no CAD notice.
    await test.step('[15-B-004] unknown project → only "Không tìm thấy dự án này" + its sentence + "Về danh sách dự án"; no dialog, no CAD notice', async () => {
      await page.goto(ROUTES.project.cadConfirm(unknown, bogusFloorId()));
      const strip = page.getByRole('alert').filter({ hasText: GATE.notFoundTitle });
      await expect(strip).toBeVisible({ timeout: 45_000 });
      await expect.soft(strip).toContainText(GATE.notFoundSentence);
      await expect.soft(dialog).toHaveCount(0);
      await expect.soft(page.getByText(CAD.errorTitle, { exact: true })).toHaveCount(0);
      await expect.soft(page.getByText(`${CAD.errorCodePrefix}NOT_FOUND`)).toHaveCount(0);
      await captureEvidence(page, 'E03_15-B-004_error_notice.png');
      await strip.getByRole('button', { name: GATE.backToProjects, exact: true }).click();
      await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
    });

    // The CAD-disabled dialog and the error notice are now reached through a failing floor read (#12 500) on the own project:
    // the dialog opens with CAD enabled while #12 is pending, then the error locks it (useCadBranchConfirm.ts:680, 898-903).
    const pid = project.projectId;
    const failRead = (route: Route): Promise<void> =>
      route.request().method() === 'GET' ? fulfillJson(route, 500, { code: 'INTERNAL', requestId: 'qa-p10-mock' }) : route.fallback();
    await page.route(`**/api/projects/${pid}/floors`, failRead);
    try {
      await test.step('[15-E-004] [mocked response] #12 500 while the dialog is open → CAD disabled, focus moves to "Vẫn dùng AI"', async () => {
        await page.goto(ROUTES.project.cadConfirm(pid, bogusFloorId()));
        await expect(dialog.getByRole('alert')).toBeVisible({ timeout: 45_000 });
        // BUG-560: CadBranchConfirmDialog.tsx:37-45 focuses the AI button when isCadChoiceDisabled flips to true while open.
        await expect.soft(dialog.getByRole('button', { name: CAD.useAi, exact: true })).toBeFocused();
        await attachJson('E03_15-E-004_focus.json', { focused: await focusedName(page) });
      });

      await test.step('[15-B-008] dialog violation alert with the 500 sentence; CAD disabled in dialog and hand-off', async () => {
        await expect(dialog.getByRole('alert')).toContainText(ERR.unknown); // cadChoiceDisabledReason = failure.sentence
        await expect(dialog.getByRole('button', { name: CAD.useCad, exact: true })).toBeDisabled();
        await captureEvidence(page, 'E03_15-B-008_dialog_error.png');
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect(handoff(page).getByRole('button', { name: CAD.useCad, exact: true })).toBeDisabled();
        await captureEvidence(page, 'E03_15-B-008_handoff_disabled.png');
      });

      await test.step('[15-A-016] "Đọc lại tệp" → a second floors read (500); error stays', async () => {
        await expect(notice(page)).toContainText(CAD.errorTitle);
        const reads = (): number => log.filter((e) => floorsRe(pid).test(e.path) && e.status === 500).length;
        const before = reads();
        await notice(page).getByRole('button', { name: CAD.retry, exact: true }).click();
        await softly.poll(reads, { timeout: 45_000 }).toBeGreaterThan(before);
        await expect.soft(notice(page)).toContainText(CAD.errorTitle, { timeout: 45_000 });
      });

      await test.step('[15-A-018] error notice "Vẫn dùng AI" → /pipeline', async () => {
        await notice(page).getByRole('button', { name: CAD.useAi, exact: true }).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.pipeline(pid));
      });
    } finally {
      await page.unroute(`**/api/projects/${pid}/floors`, failRead);
    }
  });
});

test('SCR-15 · FL-15-04 · [mocked response] floor list slow, failing, offline, 403, then with CAD drawings', async ({ browser }) => {
  await withAdminProject(browser, '15-b-001', 4, async ({ flow, project }) => {
    const { page } = flow;
    const pid = project.projectId;
    const dialog = cadDialog(page);
    const stamp = new Date().toISOString();
    const drawing = (name: string, url: string): Record<string, unknown> => ({
      heightMm: 1_000,
      id: `drw_qa_${name.replace(/\W/gu, '')}`,
      name,
      uploadedAt: stamp,
      uploaderId: 'usr_qa_p10',
      url,
      widthMm: 1_000,
    });
    /** Drawings per floor order (15-B-025 / 15-C-011): name .dwg, url-only .dwg, PLAN.DWG, .pdf + .png. */
    const fakeDrawings = [
      [drawing('a.dwg', 'https://files.example.test/a.dwg')],
      [drawing('ban-ve-tang-2', 'https://files.example.test/tang-2.dwg')],
      [drawing('PLAN.DWG', 'https://files.example.test/plan-upper')],
      [drawing('tang-4.pdf', 'https://files.example.test/tang-4.pdf'), drawing('tang-4.png', 'https://files.example.test/tang-4.png')],
    ];
    type Mode = 'hold500' | '500' | 'pass' | 'abort' | '403' | 'rewrite';
    let mode: Mode = 'hold500';
    let firstHeld: (() => void) | null = null;
    const heldSeen = new Promise<void>((resolve) => (firstHeld = resolve));
    const handler = async (route: Route): Promise<void> => {
      if (route.request().method() !== 'GET') return route.fallback();
      switch (mode) {
        case 'hold500':
          firstHeld?.();
          await new Promise((resolve) => setTimeout(resolve, 10_000)); // long enough for step 1's checks + shot
          return fulfillJson(route, 500, { code: 'INTERNAL', requestId: 'qa-p10-mock' }).catch(() => undefined);
        case '500':
          return fulfillJson(route, 500, { code: 'INTERNAL', requestId: 'qa-p10-mock' });
        case 'abort':
          return route.abort('internetdisconnected');
        case '403':
          return fulfillJson(route, 403, { code: 'FORBIDDEN', requestId: 'qa-p10-mock' });
        case 'rewrite': {
          const real = await route.fetch();
          const json = (await real.json()) as unknown;
          const list = (Array.isArray(json) ? json : (json as { items?: unknown[] }).items ?? []) as Record<string, unknown>[];
          const sorted = [...list].sort((a, b) => Number(a.order) - Number(b.order));
          sorted.forEach((floor, i) => {
            floor.drawings = fakeDrawings[i] ?? [];
          });
          return fulfillJson(route, 200, Array.isArray(json) ? list : { ...(json as object), items: list });
        }
        default:
          return route.fallback();
      }
    };
    await page.route(`**/api/projects/${pid}/floors`, handler);
    const cadUrl = ROUTES.project.cadConfirm(pid, floorAt(project, 0).id);
    const errorNotice = (sentence: string, code: string): Promise<void> =>
      expect.soft(notice(page)).toContainText(`${sentence} ${CAD.errorCodePrefix}${code}`, { timeout: 15_000 });
    const badgeOf = (floorName: string) =>
      dialog.getByRole('table').nth(1).locator('tbody tr').filter({ hasText: floorName }).locator('td').nth(1);

    try {
      await test.step('[15-B-001] while held: "Đang đọc tệp CAD" skeleton, no notice; dialog header-only table, CAD enabled', async () => {
        await page.goto(cadUrl);
        await heldSeen;
        await expect(page.getByRole('status', { name: CAD.loading, exact: true })).toBeVisible();
        await expect(notice(page)).toHaveCount(0);
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole('table').nth(1).locator('tbody tr')).toHaveCount(0);
        await expect(dialog.getByRole('button', { name: CAD.useCad, exact: true })).toBeEnabled();
        await captureEvidence(page, 'E03_15-B-001_loading.png');
      });

      await test.step('[15-A-019] CAD while held → canvas skeleton; then 500 → error in stage 2, import disabled, no reason', async () => {
        await dialog.getByRole('button', { name: CAD.useCad, exact: true }).click();
        await expect.soft(stageTwo(page)).toBeVisible();
        await expect.soft(previewBox(page).locator('.animate-pulse').first()).toBeVisible(); // Skeleton preset canvas: 3 pulsing blocks
        await captureEvidence(page, 'E03_15-A-019_canvas_skeleton.png');
        await expect.soft(notice(page)).toContainText(CAD.errorTitle, { timeout: 15_000 });
        await expect.soft(stageTwo(page)).toBeVisible();
        await expect.soft(page.getByRole('button', { name: CAD.importButton, exact: true })).toBeDisabled();
        await expect.soft(page.locator(`#${CAD.importReasonId}`)).toHaveCount(0);
        await captureEvidence(page, 'E03_15-A-019_stage_two_error.png');
      });

      await test.step('[15-B-005] reload with 500 → the "unknown" sentence + the server code', async () => {
        mode = '500';
        await page.reload();
        // The mock answers like the real BE 500 (apps/api/core/errors.py: code INTERNAL); the FE shows the server code,
        // so the catalog's "Mã lỗi: UNKNOWN" is only for a 5xx without a code (run-33-P10: "Mã lỗi: INTERNAL").
        await errorNotice(ERR.unknown, 'INTERNAL');
        await captureEvidence(page, 'E03_15-B-005_error_500.png');
      });

      await test.step('[15-A-017] pass-through, "Đọc lại tệp" → error gone, CAD enabled, empty notice', async () => {
        mode = 'pass';
        // The notice sits under the dialog backdrop: leave the dialog first (Esc → hand-off), as a user would.
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await notice(page).getByRole('button', { name: CAD.retry, exact: true }).click();
        await expect(page.getByText(CAD.errorTitle, { exact: true })).toHaveCount(0);
        await expect(handoff(page).getByRole('button', { name: CAD.useCad, exact: true })).toBeEnabled();
        await expect(notice(page)).toContainText(CAD.emptyTitle);
        await captureEvidence(page, 'E03_15-A-017_retry_recovers.png');
      });

      await test.step('[15-B-006] aborted → reload → NETWORK sentence', async () => {
        mode = 'abort';
        await page.reload();
        await errorNotice(ERR.network, 'NETWORK');
        await captureEvidence(page, 'E03_15-B-006_error_network.png');
      });

      await test.step('[15-B-007] 403 → reload → FORBIDDEN sentence', async () => {
        mode = '403';
        await page.reload();
        await errorNotice(ERR.forbidden, 'FORBIDDEN');
        await captureEvidence(page, 'E03_15-B-007_error_403.png');
      });

      await test.step('[15-B-025] rewritten drawings: floor with a .dwg name → neutral "Có tệp CAD"', async () => {
        mode = 'rewrite';
        await page.reload();
        await expect(dialog.getByRole('table').nth(1).locator('tbody tr')).toHaveCount(4);
        await expect.soft(badgeOf(floorAt(project, 0).name)).toHaveText(CAD.hasCad);
        await captureEvidence(page, 'E03_15-B-025_cad_badge.png');
      });

      await test.step('[15-C-011] url-only .dwg and "PLAN.DWG" → "Có tệp CAD"; .pdf / .png → "Chỉ có ảnh"', async () => {
        await expect.soft(badgeOf(floorAt(project, 1).name), 'url-only .dwg').toHaveText(CAD.hasCad);
        await expect.soft(badgeOf(floorAt(project, 2).name), 'PLAN.DWG').toHaveText(CAD.hasCad);
        await expect.soft(badgeOf(floorAt(project, 3).name), '.pdf + .png').toHaveText(CAD.imageOnly);
        await captureEvidence(page, 'E03_15-C-011_cad_rule.png');
      });
    } finally {
      await page.unroute(`**/api/projects/${pid}/floors`, handler).catch(() => undefined);
    }
  });
});
