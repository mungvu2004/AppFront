/**
 * Phase 6 — EDGE layer, SCR-31 Spatial JSON Viewer, MOCKED RESPONSES: one flow, QA-06b P5 (`flows-C4.md` FL-31-09). The title
 * carries `[mocked response]` and names its real pairs. The project is real (S-DATA-QC); only the reads of the data route are
 * answered or edited on the way (support/p06/data.ts `mockData`: the REAL N15 body is fetched and edited, so ids and revisions
 * stay real):
 * - N15 `GET /api/projects/:id/spatial` — held (loading), with dangling opening ids (integrity strip), notes only, 500;
 * - #24 `GET /api/projects/:id` — 500.
 * Why a mock: (a) the BE refuses a dangling reference on PUT, so the integrity strip is unreachable on the real stack (31-B-009,
 * 31-A-024); (b) loading is a few ms (31-B-001); (c) 5xx cannot be produced on the shared stack (31-B-014/015, 31-G-006/007); (d) a graph
 * made only of notes cannot be written through #35 (31-C-008).
 * Real pairs: 31-B-007 (valid line) in FL-31-01 · 31-B-002 / 31-B-013 in FL-31-05 · the 404 gate (31-G-005) is the only real gate error.
 * Unpairable: 5xx and the held read.
 *
 * Source: SJ src/screens/export/SpatialJsonViewer/ (SJV view, SJC container, USJ hook, SJM model) · PSG
 * src/components/feedback/ProjectSpatialGate.tsx · UPS src/hooks/useProjectSpatial.ts · integrity src/domain/spatial/integrity.ts.
 *
 * ## Real-backend budget per run
 * - `POST /api/auth/login`: 0 (stored admin session) · `POST /api/auth/refresh`: 2 + 1 per page load ≈ 10.
 * - `POST /api/projects` 1, `PUT …/spatial/layer` 1, `DELETE /api/projects/:id` 1. No upload, no pipeline run, no write by the screen.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { navigateThenWaitForApi, waitForApi } from '../../e2e/fullstack/apiWatch';
import { captureEvidence } from './support/evidence';
import {
  ERROR_PAINT_TIMEOUT_MS,
  SJ,
  mockData,
  openData,
  previewValue,
  projectRe,
  qcProject,
  rowsOf,
  spaNavigate,
  spatialRe,
  tabOf,
  toolbarButton,
  treeOf,
  validityLine,
  withAdmin,
} from './support/p06/data';

const softly = expect.configure({ soft: true });
const ev = (page: Page, id: string, slug: string): Promise<string> => captureEvidence(page, `E06d_${id}_${slug}.png`);

test.describe('E06d SCR-31 Spatial JSON Viewer [mocked response]', () => {
  test('SCR-31 · FL-31-09 · [mocked response] loading, issues, gate errors, notes-only — pairs FL-31-01 / FL-31-05', async ({ browser }) => {
    test.setTimeout(240_000);
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await qcProject(admin, 'data-mock'); // S-DATA-MOCK on top of S-DATA-QC
      const mock = await mockData(page);
      const structure = page.getByRole('region', { name: SJ.structure, exact: true });
      const gateAlert = page.getByRole('alert').filter({ has: page.getByRole('heading') });
      /** The issue strip rows: `<li>` with the entity code and the Vietnamese sentence (SJV:181-190). */
      const issueRows = page.locator('li').filter({ has: page.locator('code') }).filter({ hasText: 'không tồn tại' });

      // [open] data with N15 held: the route is a few ms on the real stack, so the read waits for the test.
      mock.hold();
      await page.goto(ROUTES.project.data(project.id), { waitUntil: 'commit' });
      await expect(page.getByRole('textbox', { name: SJ.search, exact: true })).toBeVisible();

      await test.step('[31-B-001] Loading: N15 held — skeleton in the tree pane, search toolbar visible, no validity line, no issue list', async () => {
        // SJV:174,207-210
        await expect(structure.locator('.animate-pulse').first()).toBeVisible();
        await expect(page.getByRole('textbox', { name: SJ.search, exact: true })).toBeVisible();
        await softly(validityLine(page)).toHaveCount(0);
        await softly(issueRows).toHaveCount(0);
        await softly(treeOf(page)).toHaveCount(0);
        await softly.poll(() => mock.n15Calls(), { message: 'N15 reads held at the route' }).toBeGreaterThanOrEqual(1);
        await ev(page, '31-B-001', 'loading_skeleton');
      });

      // [act] release N15, now carrying two dangling opening ids
      mock.setN15('dangling', 2);
      const released = waitForApi(page, 'GET', spatialRe(project.id), [200]);
      mock.release();
      await released;
      await expect(treeOf(page).getByRole('treeitem').first()).toBeVisible();

      await test.step('[31-B-009] Issues: the strip shows counts and one row per issue (code + Vietnamese sentence)', async () => {
        // SJM:268-270, SJV:181-190, integrity.ts:138
        const line = page.getByText('2 lỗi nghiêm trọng · 0 cảnh báo.', { exact: true });
        await softly(line).toBeVisible();
        await softly(line.locator('xpath=preceding-sibling::span[1]')).toHaveClass(/bg-state-violation/u);
        await softly(issueRows).toHaveCount(2);
        for (const index of [0, 1]) {
          await softly(issueRows.nth(index).locator('code')).toHaveText(/^W-/u);
          await softly(issueRows.nth(index)).toContainText(/Tường W-\S+ liệt kê lỗ mở D-QADANGLING\d+ không tồn tại\./u);
        }
        await ev(page, '31-B-009', 'issue_strip');
      });

      await test.step('[31-A-024] ⚑ A row of the issue strip is clickable and selects the entity node', async () => {
        // F7 onSelectIssue: the row is a button that selects the entity node
        const first = issueRows.first();
        const wallId = (await first.locator('code').innerText()).trim();
        await first.getByRole('button').click(); // F7: the row is a <button> inside the <li>
        const selected = treeOf(page).getByRole('treeitem', { selected: true });
        await softly(selected, 'a tree node is selected by the click').toHaveCount(1);
        await tabOf(page, 'Xem trước').click();
        await softly(previewValue(page, SJ.entityCode), 'the selected node is the wall of the issue').toHaveText(wallId);
        await ev(page, '31-A-024', 'issue_row_click');
      });

      await test.step('[31-C-008] ⚑ A graph whose only content is notes is not the empty state: notes are counted', async () => {
        // SJM:217-235, USJ:149-150 — notes are in neither the counts label nor entityCount today
        mock.setN15('notes');
        await navigateThenWaitForApi(page, () => page.reload({ waitUntil: 'commit' }), 'GET', spatialRe(project.id), [200]);
        await softly(page.getByText(SJ.emptyTitle, { exact: true }).or(treeOf(page))).toBeVisible();
        await softly(page.getByText(SJ.emptyTitle, { exact: true }), 'notes-only graph shown as empty').toHaveCount(0);
        await softly(page.getByText(/ghi chú/u), 'counts label mentions notes').toBeVisible();
        await ev(page, '31-C-008', 'notes_only');
      });

      // [open] data with #24 answering 500
      mock.setN15('pass');
      mock.setProject500(true);
      await navigateThenWaitForApi(page, () => page.reload({ waitUntil: 'commit' }), 'GET', projectRe(project.id), [500]);
      await expect(gateAlert).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });

      await test.step('[31-B-014] Gate error: #24 answers 500 — alert with the report text; "Thử lại" refetches', async () => {
        // PSG:78-91
        await softly(gateAlert.getByRole('heading')).toBeVisible();
        const retry = gateAlert.getByRole('button', { name: SJ.retry });
        await softly(retry).toBeVisible();
        const reads = (): number => api.filter((e) => e.method === 'GET' && projectRe(project.id).test(e.path) && e.status === 500).length;
        const before = reads();
        await retry.click();
        await softly.poll(reads, { message: '#24 is read again after "Thử lại"', timeout: ERROR_PAINT_TIMEOUT_MS }).toBeGreaterThan(before);
        await softly(gateAlert).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
        await ev(page, '31-B-014', 'gate_error_24');
      });

      await test.step('[31-G-006] #24 500 -> blocked gate error: the screen behind it is not painted', async () => {
        // see 31-B-014
        const failed = api.filter((e) => e.method === 'GET' && projectRe(project.id).test(e.path) && e.status === 500);
        softly(failed.length, '#24 500 responses').toBeGreaterThanOrEqual(1);
        await softly(gateAlert).toBeVisible();
        await softly(treeOf(page)).toHaveCount(0);
        await softly(page.getByRole('textbox', { name: SJ.search, exact: true })).toHaveCount(0);
        await ev(page, '31-G-006', 'blocked_24');
      });

      // [open] data, then N15 answers 500 on the refetch of a screen that already holds the graph
      mock.setProject500(false);
      await openData(page, project.id); // a fresh document: waits for the N15 200 and the tree
      mock.setN15('fail500');
      const versionsPath = ROUTES.project.versions(project.id);
      // armed BEFORE leaving: the versions screen shares the N15 query (staleTime 0) and may take the 500 itself
      const failedRefetch = waitForApi(page, 'GET', spatialRe(project.id), [500]);
      await spaNavigate(page, versionsPath);
      await expect.poll(() => new URL(page.url()).pathname).toBe(versionsPath);
      // spaNavigate only changes the URL (lazy route + Suspense): wait until the data screen is really unmounted, else the hop back never remounts the gate and N15 is not read again
      await expect(page.getByRole('textbox', { name: SJ.search, exact: true })).toHaveCount(0);
      await spaNavigate(page, ROUTES.project.data(project.id)); // S5-confirm: remounting the gate refetches N15 (staleTime 0, UPS:98-102)
      await failedRefetch;
      const refreshAlert = page.getByText(SJ.refreshFailed, { exact: true });
      await expect(refreshAlert).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });

      await test.step('[31-B-015] Refresh failed with a graph already shown: the inline alert keeps the tree', async () => {
        // PSG:97-102
        await softly(refreshAlert).toBeVisible();
        await softly(page.getByRole('button', { name: SJ.retry, exact: true })).toBeVisible();
        await softly(treeOf(page)).toBeVisible();
        softly(await rowsOf(page).count(), 'tree rows kept').toBeGreaterThan(0);
        await softly(toolbarButton(page, SJ.expandAll)).toBeVisible();
        await ev(page, '31-B-015', 'refresh_failed_inline');
      });

      await test.step('[31-G-007] N15 500 with no graph yet -> blocked gate error; with a graph -> the refresh alert of 31-B-015', async () => {
        // see 31-B-014 / 31-B-015: a fresh document has no graph, so the same 500 blocks the screen
        await navigateThenWaitForApi(page, () => page.reload({ waitUntil: 'commit' }), 'GET', spatialRe(project.id), [500]);
        await softly(gateAlert).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
        await softly(treeOf(page)).toHaveCount(0);
        await softly(refreshAlert).toHaveCount(0);
        await ev(page, '31-G-007', 'blocked_n15');
      });
    });
  });
});
