/**
 * Phase 6 — EDGE layer, SCR-31 Spatial JSON Viewer (`/projects/:projectId/data`, slug `data`): seven user flows, QA-06b P5
 * (`flows-C4.md` "phase06_data_edge.spec.ts", `catalog-C4.md`). One `test()` per flow, one `test.step('[<row id>] …')` per catalog
 * row in the planned order; `[open]` / `[act]` lines of the plan are plain code between steps. `H` rows use a hard `expect`, `S`
 * rows `expect.soft`; each step captures one evidence `E06d_<row id>_<slug>.png`.
 * ⚑ steps (31-A-022, 31-A-023, 31-B-017, 31-B-019, 31-C-006, 31-E-002, 31-E-003, 31-E-007, 31-B-018) are written as the CORRECT
 * behaviour and stay red while the bug stands (catalog-C4 "Suspected bugs"); none is loosened to go green.
 *
 * Short names (FE root = this worktree, master d50bb248): SJ src/screens/export/SpatialJsonViewer/ (SJV SpatialJsonViewer.tsx,
 * SJT SpatialJsonTree.tsx, SJD SpatialJsonDetail.tsx, SJC …container.tsx, USJ useSpatialJsonViewer.ts, SJM spatialJsonModel.ts) ·
 * PSG src/components/feedback/ProjectSpatialGate.tsx · UPS src/hooks/useProjectSpatial.ts.
 * Mocked rows (31-B-001/009/014/015, 31-A-024, 31-C-008, 31-G-006/007) live in `phase06_data_mocked_edge.spec.ts`; UI rows
 * (31-F-*, 31-E-009) in `phase06_data_ui.spec.ts`; FL-M-31-01 in `phase06_pipeline.spec.ts`.
 *
 * ## Data (own `qa-<runId>-data-…` projects, deleted in `finally`; run-unique, safe with --workers 4)
 * - S-DATA-QC `createQcProject`: 8 walls + 2 partitions, rooms "Bếp" / "PHONG NGU 2", valid graph;
 * - S-DATA-BARE: a floor without a layer; S-DATA-BIG `createBigLayerProject` (support/p06/data.ts): 160 walls, a 70-char room;
 * - pool users `p06-share-eng`, `p06-share-view`, `p06-share-out` (FL-31-07 only; members removed in `finally`).
 * What the screen shows is compared with the N15 body the page itself read (`n15Graph`) through the oracle in support/p06/data.ts.
 *
 * ## Real-backend budget per run (BE defaults; QA stack override `qa-limits.override.yml`)
 * - `POST /api/auth/login` (120 / 60 s per IP): 3 pool sessions in FL-31-07; the admin flows reuse the stored session (0, 1 UI sign-in if it is dead).
 * - `POST /api/auth/refresh` (300 / 60 s): 2 per flow (session check + fixture token) + 1 per page load ≈ 40 for the file.
 * - `POST /api/projects` 7 (+0), `PUT …/spatial/layer` 5 (qc ×4 + big ×1), `DELETE /api/projects/:id` 7 — no rate limit on any of them.
 * - `POST /api/users/invitations` 0..3 (pool slots exist after the first run), `POST …/members` 2, `DELETE …/members/:id` 2.
 * - `drawings_init` (60 / 600 s per user), pipeline runs: 0 (no drawing is uploaded).
 * - The screen itself sends only GETs: #24 `GET /api/projects/:id`, N15 `GET …/spatial`, N21 `GET …/rule-config` once.
 */
import { readFileSync, statSync } from 'node:fs';

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { navigateThenWaitForApi } from '../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { formatFileSize } from '../../src/lib/format/bytes';
import { formatNumber } from '../../src/lib/format/number';
import { captureEvidence } from './support/evidence';
import { addProjectMember, poolUser, removeProjectMember } from './support/phase03Seed';
import type { PoolUser } from './support/phase03Seed';
import {
  ERROR_PAINT_TIMEOUT_MS,
  GATE,
  NARROW,
  ROOT_KEYS,
  SJ,
  adminRequest,
  bareProject,
  callsSince,
  countsLabelOf,
  createBigLayerProject,
  cutMessage,
  detailOf,
  flattenOracle,
  LONG_ROOM_NAME,
  matchLabel,
  matchesOf,
  modeOf,
  n15Graph,
  nextRow,
  openData,
  openFirstChild,
  openPoolFlow,
  projectBody,
  projectRe,
  previewTerm,
  previewValue,
  qcProject,
  rawTextOf,
  rootRow,
  rowsOf,
  ruleConfigRe,
  scalarText,
  searchBox,
  spatialRe,
  tabOf,
  tabsOf,
  toolbarButton,
  treeOf,
  uniq,
  validityLine,
  withAdmin,
  writesSince,
} from './support/p06/data';
import type { Json } from './support/p06/data';

const softly = expect.configure({ soft: true });
const ev = (page: Page, id: string, slug: string): Promise<string> => captureEvidence(page, `E06d_${id}_${slug}.png`);
const list = (value: unknown): Json[] => (Array.isArray(value) ? value.map((item) => item as Json) : []);
const roleOfFocus = (page: Page): Promise<string | null> => page.evaluate(() => document.activeElement?.getAttribute('role') ?? null);

test.describe('E06d SCR-31 Spatial JSON Viewer', () => {
  test('SCR-31 · FL-31-01 · open: reads, first paint, counts, validity, size, structure', async ({ browser }) => {
    test.setTimeout(120_000);
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await qcProject(admin, 'data-open'); // S-DATA-QC
      await openData(page, project.id);
      const graph = await n15Graph(api);

      await test.step('[31-G-001] Open: GET /api/projects/:id (#24) answers 200 and its body (members) is decoded', async () => {
        // UPS:109, floorLayerGraph.ts:188-199
        const entry = api.find((e) => e.method === 'GET' && projectRe(project.id).test(e.path));
        expect(entry?.status, '#24 status').toBe(200);
        const body = await projectBody(api, project.id);
        expect(Array.isArray(body.members), '#24 members list').toBe(true);
        await ev(page, '31-G-001', 'project_read');
      });

      await test.step('[31-G-002] Open: GET …/spatial (N15) answers 200; the root rows are the response keys', async () => {
        // endpoints.ts:255, floorLayerGraph.ts:202-211
        const entry = api.find((e) => e.method === 'GET' && spatialRe(project.id).test(e.path));
        softly(entry?.status, 'N15 status').toBe(200);
        const labels = await treeOf(page)
          .locator('[role="treeitem"][aria-level="1"]')
          .evaluateAll((els) => els.map((el) => el.querySelector('code')?.textContent ?? ''));
        softly([...labels].sort(), 'root rows = N15 graph keys').toEqual(Object.keys(graph).sort());
        softly([...labels].sort(), 'root rows = the nine contract keys').toEqual([...ROOT_KEYS].sort());
        await ev(page, '31-G-002', 'spatial_read');
      });

      await test.step('[31-G-003] Open: rule-config (N21) is read at most once as a side effect', async () => {
        // UPS:71-84 (hydrateRuleConfigOnce)
        const reads = api.filter((e) => e.method === 'GET' && ruleConfigRe.test(e.path));
        softly(reads.length, 'N21 reads').toBeLessThanOrEqual(1);
        softly(reads.filter((e) => e.status !== 200), 'N21 non-200').toEqual([]);
        await ev(page, '31-G-003', 'rule_config_once');
      });

      await test.step('[31-A-002] First paint: only "building" is open; the other eight root keys are collapsed', async () => {
        // USJ:66,106, SJM:149-158
        const building = rootRow(page, 'building');
        await softly(building).toHaveAttribute('aria-expanded', 'true');
        await softly(treeOf(page).locator('[role="treeitem"][aria-level="2"]').first()).toBeVisible();
        for (const key of ROOT_KEYS.filter((k) => k !== 'building')) {
          if (!Array.isArray(graph[key]) || list(graph[key]).length > 0) {
            await softly(rootRow(page, key), `${key} collapsed`).toHaveAttribute('aria-expanded', 'false');
          }
        }
        await ev(page, '31-A-002', 'first_paint');
      });

      await test.step('[31-B-007] Success: validity line for a valid graph, green dot, no issue list', async () => {
        // SJM:268-269, SJV:175-179
        const line = page.getByText(SJ.valid, { exact: true });
        await softly(line).toBeVisible();
        await softly(line.locator('xpath=preceding-sibling::span[1]')).toHaveClass(/bg-state-verified/u);
        await softly(page.getByText(/lỗi nghiêm trọng/u)).toHaveCount(0);
        await ev(page, '31-B-007', 'validity_valid');
      });

      await test.step('[31-B-008] Success: footer size = formatFileSize(bytes of the pretty JSON)', async () => {
        // USJ:280; S5-confirm: the decoded graph prints as many bytes as the wire graph
        const expected = formatFileSize(new TextEncoder().encode(rawTextOf(graph)).length);
        await softly(page.getByText(expected, { exact: true })).toBeVisible();
        await ev(page, '31-B-008', 'footer_size');
      });

      await test.step('[31-C-007] Counts label follows the graph', async () => {
        // SJM:238-250
        await softly(page.getByText(countsLabelOf(graph), { exact: true })).toBeVisible();
        await ev(page, '31-C-007', 'counts_label');
      });

      await test.step('[31-C-012] A collapsed expandable node shows its child count; an open one hides it', async () => {
        // SJT:134-138
        const walls = rootRow(page, 'walls');
        const count = list(graph.walls).length;
        await softly(walls).toHaveAttribute('aria-expanded', 'false');
        await softly(walls).toContainText(`[${String(count)}]`);
        await walls.focus();
        await page.keyboard.press('ArrowRight');
        await softly(walls).toHaveAttribute('aria-expanded', 'true');
        await softly(walls).not.toContainText('[');
        await ev(page, '31-C-012', 'child_count_badge');
      });

      await test.step('[31-C-013] An empty array is not expandable; ArrowRight is a no-op', async () => {
        // SJM:100,121
        const notes = rootRow(page, 'notes');
        await softly(notes).not.toHaveAttribute('aria-expanded', /.*/u);
        const before = await rowsOf(page).count();
        await notes.focus();
        await page.keyboard.press('ArrowRight');
        await softly(notes).toBeFocused();
        await softly(rowsOf(page)).toHaveCount(before);
        await ev(page, '31-C-013', 'empty_not_expandable');
      });

      await test.step('[31-E-001] Tree semantics: role=tree, treeitem rows with aria-level / aria-selected, aria-expanded only on containers', async () => {
        // SJT:60-70
        await softly(treeOf(page)).toBeVisible();
        const rows = await rowsOf(page).evaluateAll((els) =>
          els.map((el) => ({
            expanded: el.getAttribute('aria-expanded'),
            level: Number(el.getAttribute('aria-level')),
            scalar: [...el.querySelectorAll('span')].some((s) => s.textContent === ':'),
            selected: el.getAttribute('aria-selected'),
          })),
        );
        softly(rows.length, 'rows').toBeGreaterThan(ROOT_KEYS.length);
        softly(rows.filter((r) => !(r.level >= 1)), 'rows without aria-level').toEqual([]);
        softly(rows.filter((r) => r.selected !== 'true' && r.selected !== 'false'), 'rows without aria-selected').toEqual([]);
        softly(rows.filter((r) => r.scalar && r.expanded !== null), 'scalar rows with aria-expanded').toEqual([]);
        softly(rows.some((r) => r.expanded === 'true') && rows.some((r) => r.expanded === 'false'), 'containers carry aria-expanded').toBe(true);
        await ev(page, '31-E-001', 'tree_semantics');
      });

      await test.step('[31-E-010] Landmarks: sections "Cấu trúc dự án" and "Nội dung dữ liệu không gian"', async () => {
        // SJV:202, SJD:135
        await softly(page.getByRole('region', { name: SJ.structure, exact: true })).toBeVisible();
        await softly(page.getByRole('region', { name: SJ.content, exact: true })).toBeVisible();
        await ev(page, '31-E-010', 'landmarks');
      });

      await test.step('[31-D-001] admin member sees the data: state success (tree + detail)', async () => {
        await softly(treeOf(page)).toBeVisible();
        await softly(tabsOf(page)).toBeVisible();
        await softly(detailOf(page)).toBeVisible();
        await ev(page, '31-D-001', 'admin_success');
      });
    });
  });

  test('SCR-31 · FL-31-02 · tree: mouse and keyboard, then a narrow window', async ({ browser }) => {
    test.setTimeout(120_000);
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await qcProject(admin, 'data-keys'); // S-DATA-QC
      await openData(page, project.id);
      const graph = await n15Graph(api);
      const nodes = flattenOracle(graph);
      const walls = rootRow(page, 'walls');

      await test.step('[31-A-003] Click a row\'s chevron: toggles that node only (no selection)', async () => {
        // SJT:104-113 (chevron stopPropagation)
        const chevron = walls.locator('span[aria-hidden="true"]').first();
        await expect(walls).toHaveAttribute('aria-expanded', 'false');
        await chevron.click();
        await expect(walls).toHaveAttribute('aria-expanded', 'true');
        await softly(walls).toHaveAttribute('aria-selected', 'false');
        await chevron.click();
        await expect(walls).toHaveAttribute('aria-expanded', 'false');
        await softly(walls).toHaveAttribute('aria-selected', 'false');
        await ev(page, '31-A-003', 'chevron_toggle');
      });

      await test.step('[31-A-005] ArrowRight on a collapsed node opens it; ArrowLeft on an open node closes it', async () => {
        // SJT:91-100
        await walls.focus();
        await page.keyboard.press('ArrowRight');
        await softly(walls).toHaveAttribute('aria-expanded', 'true');
        await page.keyboard.press('ArrowLeft');
        await softly(walls).toHaveAttribute('aria-expanded', 'false');
        await ev(page, '31-A-005', 'arrow_open_close');
      });

      await test.step('[31-A-006] Enter on a focused row selects it', async () => {
        // SJT:81-85
        await walls.focus();
        await page.keyboard.press('Enter');
        await softly(walls).toHaveAttribute('aria-selected', 'true');
        await ev(page, '31-A-006', 'enter_selects');
      });

      const openings = rootRow(page, 'openings');
      await test.step('[31-A-025] Space on a focused row selects it; the page does not scroll', async () => {
        // SJT:81-85
        await openings.focus();
        const before = await page.evaluate(() => window.scrollY);
        await page.keyboard.press('Space');
        await softly(openings).toHaveAttribute('aria-selected', 'true');
        softly(await page.evaluate(() => window.scrollY), 'scrollY after Space').toBe(before);
        await ev(page, '31-A-025', 'space_selects');
      });

      await test.step('[31-E-004] A focused row has a visible focus indicator', async () => {
        // SJT:71-75 (no explicit focus class)
        const style = await openings.evaluate((el) => {
          const css = getComputedStyle(el);
          return { focusVisible: el.matches(':focus-visible'), outlineStyle: css.outlineStyle, outlineWidth: parseFloat(css.outlineWidth), shadow: css.boxShadow };
        });
        softly(style.focusVisible, 'row matches :focus-visible').toBe(true);
        softly((style.outlineStyle !== 'none' && style.outlineWidth > 0) || style.shadow !== 'none', `focus ring ${JSON.stringify(style)}`).toBe(true);
        await ev(page, '31-E-004', 'focus_indicator');
      });

      await test.step('[31-E-002] ⚑ The tree is ONE tab stop (roving tabindex)', async () => {
        // SJT:102 — every row has tabIndex=0 today, so Tab walks all rows
        const stops = await rowsOf(page).evaluateAll((els) => els.filter((el) => (el as HTMLElement).tabIndex === 0).length);
        softly(stops, 'rows in the tab order').toBe(1);
        await toolbarButton(page, SJ.copy).focus();
        await page.keyboard.press('Tab');
        softly(await roleOfFocus(page), 'first Tab after the toolbar lands on a row').toBe('treeitem');
        await page.keyboard.press('Tab');
        softly(await roleOfFocus(page), 'second Tab leaves the tree').not.toBe('treeitem');
        await ev(page, '31-E-002', 'one_tab_stop');
      });

      await test.step('[31-E-003] ⚑ ArrowDown / ArrowUp move focus between rows; Home / End jump', async () => {
        // SJT:80-101 — only ArrowLeft/Right/Enter/Space are handled today
        const first = rowsOf(page).first();
        const second = rowsOf(page).nth(1);
        const last = rowsOf(page).last();
        await first.focus();
        await page.keyboard.press('ArrowDown');
        await softly(second, 'ArrowDown').toBeFocused();
        await page.keyboard.press('ArrowUp');
        await softly(first, 'ArrowUp').toBeFocused();
        await page.keyboard.press('End');
        await softly(last, 'End').toBeFocused();
        await page.keyboard.press('Home');
        await softly(first, 'Home').toBeFocused();
        await ev(page, '31-E-003', 'arrow_navigation');
      });

      await test.step('[31-A-007] "Mở rộng tất cả" expands every expandable node', async () => {
        // USJ:204-206; rows = every node of flattenJson(graph)
        await toolbarButton(page, SJ.expandAll).click();
        await softly(rowsOf(page)).toHaveCount(nodes.length);
        const states = await rowsOf(page).evaluateAll((els) => els.map((el) => el.getAttribute('aria-expanded')));
        softly(states.filter((s) => s !== null && s !== 'true'), 'containers not expanded').toEqual([]);
        await ev(page, '31-A-007', 'expand_all');
      });

      await page.setViewportSize(NARROW);
      await test.step('[31-B-020] Success on a mobile-width window is state "collapsed": no detail pane, the tree fills the width', async () => {
        // USJ:173, SJV:230
        await softly(treeOf(page)).toBeVisible();
        await softly(tabsOf(page)).toHaveCount(0);
        await ev(page, '31-B-020', 'narrow_768');
        await softly(searchBox(page)).toBeInViewport();
      });
    });
  });

  test('SCR-31 · FL-31-03 · search: counter, stepping, wrap, case, whitespace', async ({ browser }) => {
    test.setTimeout(120_000);
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await qcProject(admin, 'data-search'); // S-DATA-QC
      await openData(page, project.id);
      const graph = await n15Graph(api);
      const nodes = flattenOracle(graph);
      const label = matchLabel(page);
      const search = searchBox(page);
      /** Eight wall rows carry `"loadBearing"`: enough matches to step and wrap. */
      const STEP = 'loadbearing';
      const stepTotal = formatNumber(matchesOf(nodes, STEP).length);
      const hits = rowsOf(page).filter({ hasText: /loadbearing/iu });

      await test.step('[31-C-001] Search is case-insensitive: the lower-case room name finds "PHONG NGU 2"', async () => {
        // SJM:182-194
        await search.fill(SJ.room.toLowerCase());
        await expect(label).toHaveText(/^1 \/ [1-9][\d.]*$/u);
        await ev(page, '31-C-001', 'case_insensitive');
      });

      await test.step('[31-C-003] The match count equals the nodes whose key or value contains the term', async () => {
        const expected = formatNumber(matchesOf(nodes, SJ.room.toLowerCase()).length);
        await softly(label).toHaveText(`1 / ${expected}`);
        await ev(page, '31-C-003', 'match_count');
      });

      await test.step('[31-A-010] "Kết quả sau" selects the next match and the label advances', async () => {
        // USJ:217-238
        await search.fill(STEP);
        await softly(label).toHaveText(`1 / ${stepTotal}`);
        await toolbarButton(page, SJ.next).click();
        await softly(label).toHaveText(`2 / ${stepTotal}`);
        const selected = treeOf(page).getByRole('treeitem', { selected: true });
        await softly(selected).toHaveCount(1);
        await softly(selected).toContainText(/loadbearing/iu);
        await ev(page, '31-A-010', 'next_match');
      });

      await test.step('[31-A-011] "Kết quả trước" from the first match wraps to the last', async () => {
        // USJ:224
        await search.fill('');
        await search.fill(STEP);
        await softly(label).toHaveText(`1 / ${stepTotal}`);
        await toolbarButton(page, SJ.previous).click();
        await softly(label).toHaveText(`${stepTotal} / ${stepTotal}`);
        await softly(hits.last()).toHaveAttribute('aria-selected', 'true');
        await ev(page, '31-A-011', 'previous_wraps');
      });

      await test.step('[31-A-012] "Kết quả sau" from the last match wraps to the first', async () => {
        // USJ:224
        await toolbarButton(page, SJ.next).click();
        await softly(label).toHaveText(`1 / ${stepTotal}`);
        await ev(page, '31-A-012', 'next_wraps');
      });

      await test.step('[31-C-006] ⚑ Typing a term selects the first match (counter 1 / N); the first "Kết quả sau" goes to 2 / N', async () => {
        // USJ:212-215,217-234 — selection changes only in stepMatch today, so nothing is selected after typing
        // 31-A-012 left match #1 selected: select a row that is no match first, so only typing can select
        await search.fill('');
        const outside = rootRow(page, 'building');
        await outside.click();
        await expect(outside).toHaveAttribute('aria-selected', 'true');
        await search.fill(STEP);
        await softly(label).toHaveText(`1 / ${stepTotal}`);
        await softly(hits.first(), 'the row counted as 1 / N is selected').toHaveAttribute('aria-selected', 'true');
        await toolbarButton(page, SJ.next).click();
        await softly(label).toHaveText(`2 / ${stepTotal}`);
        await softly(hits.nth(1), 'match 2 is selected').toHaveAttribute('aria-selected', 'true');
        await ev(page, '31-C-006', 'first_match_selected');
      });

      await test.step('[31-C-005] A new query resets to the first match', async () => {
        // USJ:212-215
        await toolbarButton(page, SJ.next).click();
        await softly(label).toHaveText(`3 / ${stepTotal}`);
        await search.fill('partition');
        await softly(label).toHaveText(`1 / ${formatNumber(matchesOf(nodes, 'partition').length)}`);
        await ev(page, '31-C-005', 'query_resets');
      });

      await test.step('[31-C-002] A whitespace-only search is no search: no counter, no flash, tree unchanged', async () => {
        // USJ:176-179, SJM:187-190
        await search.fill('');
        await expect(label).toHaveCount(0);
        const before = await rowsOf(page).allInnerTexts();
        await search.fill('   ');
        await expect(search).toHaveValue('   ');
        await softly(label).toHaveCount(0);
        await softly(treeOf(page).locator('[role="treeitem"].bg-bg-flash')).toHaveCount(0);
        softly(await rowsOf(page).allInnerTexts(), 'tree rows').toEqual(before);
        await ev(page, '31-C-002', 'whitespace_search');
      });

      await test.step('[31-A-014] A term that matches nothing: "Không tìm thấy kết quả"; Kết quả trước / sau do nothing', async () => {
        // USJ:88,182-184
        await search.fill('qa-khong-co-khoa-nay');
        await softly(label).toHaveText(SJ.noMatch);
        const selectedBefore = await treeOf(page).getByRole('treeitem', { selected: true }).count();
        await toolbarButton(page, SJ.previous).click();
        await toolbarButton(page, SJ.next).click();
        await softly(label).toHaveText(SJ.noMatch);
        await softly(treeOf(page).getByRole('treeitem', { selected: true })).toHaveCount(selectedBefore);
        await ev(page, '31-A-014', 'no_match');
      });

      await test.step('[31-E-006] The match counter is a polite live region', async () => {
        // SJV:125
        await search.fill(STEP);
        await softly(label).toHaveText(`1 / ${stepTotal}`);
        await softly(label).toHaveAttribute('aria-live', 'polite');
        await ev(page, '31-E-006', 'live_region');
      });

      await test.step('[31-C-004] A match opens all its ancestors even when the tree was collapsed', async () => {
        // USJ:128-142
        await search.fill('');
        await toolbarButton(page, SJ.collapseAll).click();
        await expect(rowsOf(page)).toHaveCount(ROOT_KEYS.length);
        await search.fill(SJ.room);
        await softly(rowsOf(page).filter({ hasText: SJ.room }).first()).toBeVisible();
        await ev(page, '31-C-004', 'match_opens_ancestors');
      });

      await test.step('[31-G-004] No further request while searching / expanding / switching mode and tab', async () => {
        // pure client; the mark is taken after the tree painted, the claim after the last interaction showed its result
        const mark = api.length;
        await search.fill(STEP);
        await toolbarButton(page, SJ.expandAll).click();
        await modeOf(page, 'Thô').click();
        await tabOf(page, 'Xem trước').click();
        await modeOf(page, 'Cây').click();
        await tabOf(page, 'JSON').click();
        await expect(modeOf(page, 'Cây')).toHaveAttribute('aria-checked', 'true');
        await expect(tabOf(page, 'JSON')).toHaveAttribute('aria-selected', 'true');
        softly(callsSince(api, mark).map((e) => `${e.method} ${e.path}`), 'API calls made by client-only interactions').toEqual([]);
        await ev(page, '31-G-004', 'no_requests');
      });
    });
  });

  test('SCR-31 · FL-31-04 · detail pane: JSON, preview, raw mode, copy / download', async ({ browser }) => {
    test.setTimeout(150_000);
    await withAdmin(browser, async (admin) => {
      const { page, api, context } = admin;
      await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: readBaseUrl() });
      const project = await qcProject(admin, 'data-detail'); // S-DATA-QC
      await openData(page, project.id);
      const graph = await n15Graph(api);
      const walls = list(graph.walls);
      const wall0 = walls[0] ?? {};
      const codes = detailOf(page).locator('code');

      await test.step('[31-A-017] Tab "Xem trước" with nothing selected', async () => {
        // SJD:77-82
        await tabOf(page, 'Xem trước').click();
        await expect(page.getByText(SJ.noSelection, { exact: true })).toBeVisible();
        await ev(page, '31-A-017', 'preview_none');
      });

      await test.step('[31-A-018] Tab "Xem trước" for an entity node (walls[0])', async () => {
        // SJD:86-123
        const first = await openFirstChild(page, 'walls');
        await first.click();
        await softly(first).toHaveAttribute('aria-selected', 'true');
        await softly(codes.nth(0)).toHaveText('0');
        await softly(codes.nth(1)).toHaveText('walls[0]');
        await softly(previewTerm(page, SJ.value)).toBeVisible();
        await softly(previewTerm(page, SJ.elementCount)).toBeVisible();
        await softly(previewValue(page, SJ.entityCode)).toHaveText(String(wall0.id));
        await softly(page.getByText(SJ.entityNote, { exact: true })).toBeVisible();
        await ev(page, '31-A-018', 'preview_entity');
      });

      await test.step('[31-A-019] Preview of a scalar node (a wall\'s thickness): key, path, formatted value, no count, no entity code', async () => {
        // SJD:91-115; valueText = describeScalar (SJM:56-72)
        const key = Object.keys(wall0).find((k) => /thickness/iu.test(k)) ?? 'thicknessMm';
        const first = nextRow(rootRow(page, 'walls'));
        await first.focus();
        await page.keyboard.press('ArrowRight');
        const row = treeOf(page)
          .locator('[role="treeitem"][aria-level="3"]')
          .filter({ has: page.locator('code', { hasText: new RegExp(`^${key}$`, 'u') }) })
          .first();
        await row.click();
        await softly(codes.nth(0)).toHaveText(key);
        await softly(codes.nth(1)).toHaveText(`walls[0].${key}`);
        await softly(previewValue(page, SJ.value)).toHaveText(scalarText(wall0[key]));
        await softly(previewTerm(page, SJ.elementCount)).toHaveCount(0);
        await softly(previewTerm(page, SJ.entityCode)).toHaveCount(0);
        await ev(page, '31-A-019', 'preview_scalar');
      });

      await test.step('[31-A-020] Preview of a container without an id (walls): element count, no entity code, no 3D note', async () => {
        // SJD:99-106,118
        await rootRow(page, 'walls').click();
        await softly(previewValue(page, SJ.elementCount)).toHaveText(String(walls.length));
        await softly(previewTerm(page, SJ.entityCode)).toHaveCount(0);
        await softly(page.getByText(SJ.entityNote, { exact: true })).toHaveCount(0);
        await ev(page, '31-A-020', 'preview_container');
      });

      await test.step('[31-B-018] ⚑ Preview of a container (BUG-452): label and path are not the same word twice, "Giá trị" is not a dash', async () => {
        // SJD:88-96 — walls selected: label "walls" and path "walls", "Giá trị" "—"
        const label = await codes.nth(0).innerText();
        const path = await codes.nth(1).innerText();
        softly(label === path, `label "${label}" repeats the path "${path}"`).toBe(false);
        const valueRows = await previewTerm(page, SJ.value).count();
        const dash = valueRows > 0 && (await previewValue(page, SJ.value).innerText()).trim() === '—';
        softly(dash, '"Giá trị" shows a dash for a container').toBe(false);
        await ev(page, '31-B-018', 'preview_container_dash');
      });

      await test.step('[31-A-021] Tab "JSON" shows the pretty-printed graph (2-space indent), tokens coloured', async () => {
        // SJD:45-64, SJM:253-255
        await tabOf(page, 'JSON').click();
        const pre = detailOf(page).locator('pre');
        await softly(pre.locator('div').first()).toHaveText('{');
        await softly(pre).toContainText('"building": {');
        await softly(pre.locator('span.text-accent-active').first(), 'string tokens are coloured').toBeVisible();
        await ev(page, '31-A-021', 'json_tab');
      });

      await modeOf(page, 'Thô').click();
      await tabOf(page, 'Xem trước').click();
      await modeOf(page, 'Cây').click();
      await test.step('[31-A-016] View mode "Cây" returns; the earlier "Xem trước" choice is kept', async () => {
        // SJV:232
        await softly(modeOf(page, 'Cây')).toHaveAttribute('aria-checked', 'true');
        await softly(tabOf(page, 'Xem trước')).toHaveAttribute('aria-selected', 'true');
        await ev(page, '31-A-016', 'mode_tree_back');
      });

      await test.step('[31-E-007] ⚑ Detail tabs are real tabs: tabpanel association and arrow keys', async () => {
        // SJD:136-158 — plain buttons, no tabpanel, no arrow handling today
        const json = tabOf(page, 'JSON');
        const preview = tabOf(page, 'Xem trước');
        await softly(json).toHaveAttribute('aria-controls', /.+/u);
        await softly(page.getByRole('tabpanel')).toHaveCount(1);
        await json.focus();
        await page.keyboard.press('ArrowRight');
        await softly(preview, 'ArrowRight moves to "Xem trước"').toBeFocused();
        await softly(preview).toHaveAttribute('aria-selected', 'true');
        await page.keyboard.press('ArrowLeft');
        await softly(json, 'ArrowLeft moves back to "JSON"').toBeFocused();
        await ev(page, '31-E-007', 'tabs_keyboard');
      });

      await test.step('[31-E-008] Radio group "Cách hiện cấu trúc" works with arrow keys', async () => {
        // SegmentedControl.tsx handleKeyDown
        await modeOf(page, 'Cây').focus();
        await page.keyboard.press('ArrowRight');
        await softly(modeOf(page, 'Thô')).toHaveAttribute('aria-checked', 'true');
        await page.keyboard.press('ArrowLeft');
        await softly(modeOf(page, 'Cây')).toHaveAttribute('aria-checked', 'true');
        await ev(page, '31-E-008', 'mode_arrow_keys');
      });

      await test.step('[31-E-005] Toolbar names', async () => {
        // SJV:113-170
        for (const name of [SJ.previous, SJ.next, SJ.expandAll, SJ.collapseAll, SJ.copy]) {
          await softly(toolbarButton(page, name), name).toBeVisible();
        }
        await softly(searchBox(page)).toBeVisible();
        const group = page.getByRole('radiogroup', { name: SJ.viewMode, exact: true });
        await softly(group).toBeVisible();
        await softly(group.getByRole('radio')).toHaveText(['Cây', 'Thô']);
        await ev(page, '31-E-005', 'toolbar_names');
      });

      await test.step('[31-A-022] ⚑ "Sao chép nhánh đang chọn" copies the SELECTED branch and gives feedback', async () => {
        // USJ:258-264, SJC:229-236 — the route passes no onCopy, and onCopyBranch would copy the whole rawText
        await nextRow(rootRow(page, 'walls')).click();
        await page.evaluate(() => navigator.clipboard.writeText(''));
        await toolbarButton(page, SJ.copy).click();
        const read = (): Promise<unknown> =>
          page.evaluate(async () => {
            const text = await navigator.clipboard.readText();
            try {
              return JSON.parse(text) as unknown;
            } catch {
              return text;
            }
          });
        await softly.poll(read, { message: 'clipboard = selected branch', timeout: 5_000 }).toEqual(wall0);
        await softly(page.getByRole('status').filter({ hasText: /chép/iu }).first(), 'feedback toast').toBeVisible({ timeout: 3_000 });
        await ev(page, '31-A-022', 'copy_branch');
      });

      await test.step('[31-A-023] ⚑ A "Tải xuống .json" action exists in the footer and downloads the graph', async () => {
        // SJV:244-253, USJ:268 — canDownload is false today (SJC:229 passes no onDownload)
        const button = page.getByRole('button', { name: SJ.download, exact: true });
        await softly(button).toBeVisible();
        if ((await button.count()) > 0) {
          const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
          softly(download.suggestedFilename()).toMatch(/\.json$/u);
          const path = await download.path();
          softly(formatFileSize(statSync(path).size), 'size = footer label').toBe(formatFileSize(new TextEncoder().encode(rawTextOf(graph)).length));
          softly(JSON.parse(readFileSync(path, 'utf8')) as unknown, 'content = the N15 graph').toEqual(graph);
        }
        await ev(page, '31-A-023', 'download');
      });

      await test.step('[31-B-019] ⚑ Copy has no Spatial-JSON jargon (BUG-453): the validity line reads without internal terms', async () => {
        // SJM:269 — "Hợp lệ theo hợp đồng Spatial JSON — 0 lỗi."
        const text = (await validityLine(page).innerText()).trim();
        softly(text, 'validity line').not.toMatch(/Spatial JSON|hợp đồng/u);
        await ev(page, '31-B-019', 'validity_wording');
      });
    });
  });

  test('SCR-31 · FL-31-05 · project without a layer, then an unknown project', async ({ browser }) => {
    test.setTimeout(120_000);
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await bareProject(admin, 'data-empty'); // S-DATA-BARE
      await openData(page, project.id, 'empty');

      await test.step('[31-B-002] Empty: a project without a layer shows the empty copy', async () => {
        // SJV:48-50,211-218
        await expect(page.getByText(SJ.emptyTitle, { exact: true })).toBeVisible();
        await expect(page.getByText(SJ.emptyDescription, { exact: true })).toBeVisible();
        await ev(page, '31-B-002', 'empty_copy');
      });

      await test.step('[31-B-003] Empty: NO validity line is shown', async () => {
        // SJV:174
        await softly(validityLine(page)).toHaveCount(0);
        await softly(page.getByText(SJ.validity)).toHaveCount(0);
        await ev(page, '31-B-003', 'empty_no_validity');
      });

      await test.step('[31-B-004] Empty: footer counts label', async () => {
        // SJM:238-250 (levels = the bare floor)
        await softly(page.getByText(SJ.emptyCounts, { exact: true })).toBeVisible();
        await ev(page, '31-B-004', 'empty_counts');
      });

      await test.step('[31-B-005] Empty: only one pane (the tree section), no tablist', async () => {
        // SJV:204,230
        await softly(tabsOf(page)).toHaveCount(0);
        const section = page.getByRole('region', { name: SJ.structure, exact: true });
        await softly(section).toBeVisible();
        const width = (await section.boundingBox())?.width ?? 0;
        softly(width, 'section width fills the page (viewport 1440 - 2 x 20 padding)').toBeGreaterThan(1440 - 80);
        await ev(page, '31-B-005', 'empty_single_pane');
      });

      const mark = api.length;
      await test.step('[31-B-006] Empty: the copy button is inert — no write request, no download button', async () => {
        // USJ:259-261
        await toolbarButton(page, SJ.copy).click();
        await softly(page.getByText(SJ.emptyTitle, { exact: true })).toBeVisible();
        await softly(page.getByRole('button', { name: SJ.download, exact: true })).toHaveCount(0);
        softly(writesSince(api, mark), 'writes after the click').toEqual([]);
        await ev(page, '31-B-006', 'empty_copy_inert');
      });

      await test.step('[31-C-014] A project with levels but no entity is "empty", not "success"', async () => {
        // USJ:165-167
        await softly(page.getByText(SJ.emptyTitle, { exact: true })).toBeVisible();
        await softly(page.getByText(/^1 tầng · /u)).toBeVisible();
        await softly(treeOf(page)).toHaveCount(0);
        await ev(page, '31-C-014', 'levels_without_entities');
      });

      await test.step('[31-C-015] The data screen is read-only: no non-GET request across search / expand / mode / copy', async () => {
        await searchBox(page).fill('tuong');
        await toolbarButton(page, SJ.expandAll).click();
        await toolbarButton(page, SJ.collapseAll).click();
        await modeOf(page, 'Thô').click();
        await modeOf(page, 'Cây').click();
        await toolbarButton(page, SJ.copy).click();
        await expect(modeOf(page, 'Cây')).toHaveAttribute('aria-checked', 'true');
        softly(writesSince(api, 0), 'writes since the page opened').toEqual([]);
        await ev(page, '31-C-015', 'read_only');
      });

      // [open] an unknown project id (not a `prj_<ULID>`: the BE answers 404 `project`, BE:apps/api/projects/access.py:28-33)
      const unknownId = `prj_qa-e06d-${uniq()}`;
      await navigateThenWaitForApi(page, () => page.goto(ROUTES.project.data(unknownId), { waitUntil: 'commit' }), 'GET', projectRe(unknownId), [404]);
      const gate = page.getByRole('alert').filter({ hasText: GATE.notFoundTitle });
      await expect(gate).toBeVisible();

      await test.step('[31-B-013] Unknown project id: the not-found gate with the way back', async () => {
        // PSG:37-60
        await softly(gate.getByRole('heading', { name: GATE.notFoundTitle, exact: true })).toBeVisible();
        await softly(gate.getByText(GATE.notFoundDescription, { exact: true })).toBeVisible();
        await softly(gate.getByRole('button', { name: GATE.backToProjects, exact: true })).toBeVisible();
        await softly(gate.locator('svg').first(), 'FolderX icon (BUG-461)').toBeVisible();
        await ev(page, '31-B-013', 'not_found_gate');
      });

      await test.step('[31-G-005] GET /api/projects/:unknown answers 404; the gate of 31-B-013 is shown; "Về danh sách dự án" goes to the dashboard', async () => {
        const entry = api.find((e) => e.method === 'GET' && projectRe(unknownId).test(e.path));
        softly(entry?.status, '#24 status').toBe(404);
        await softly(gate).toBeVisible();
        await ev(page, '31-G-005', 'not_found_404');
        await gate.getByRole('button', { name: GATE.backToProjects, exact: true }).click();
        await softly.poll(() => new URL(page.url()).pathname, { message: 'dashboard route' }).toBe(ROUTES.dashboard);
      });
    });
  });

  test('SCR-31 · FL-31-06 · big graph: 600-line cut, number formats, long strings', async ({ browser }) => {
    test.setTimeout(150_000);
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createBigLayerProject(admin, 'data-big'); // S-DATA-BIG
      await openData(page, project.id);
      const graph = await n15Graph(api);
      const nodes = flattenOracle(graph);
      const totalLines = rawTextOf(graph).split('\n').length;
      const search = searchBox(page);
      const label = matchLabel(page);

      await test.step('[31-B-016] Raw JSON longer than 600 lines is cut with the "Còn N dòng nữa" advice', async () => {
        // SJD:31,66-70; N = totalLines - 600 (S5-confirm: decoded graph prints as many lines as the wire graph)
        expect(totalLines, 'the big seed prints more than 600 lines').toBeGreaterThan(600);
        await expect(page.getByText(SJ.cut(totalLines - 600), { exact: true })).toBeVisible();
        await ev(page, '31-B-016', 'raw_cut');
      });

      await test.step('[31-B-017] ⚑ The advice "Thu gọn bớt nhánh ở cây bên trái" is true: collapsing branches shortens the raw text (or the advice is dropped)', async () => {
        // SJD:68, USJ:116 — rawText is the whole graph, so collapsing changes nothing
        const before = await cutMessage(page).innerText();
        await toolbarButton(page, SJ.collapseAll).click();
        await expect(rowsOf(page)).toHaveCount(ROOT_KEYS.length);
        // no message left (advice dropped, or the raw view follows the tree) is the correct outcome too
        const after = (await cutMessage(page).count()) === 0 ? '' : await cutMessage(page).innerText();
        softly(/Thu gọn bớt nhánh/u.test(after) && after === before, 'advice to collapse while collapsing changes nothing').toBe(false);
        await ev(page, '31-B-017', 'cut_advice');
      });

      await test.step('[31-C-009] Numbers use vi grouping in the counter and the counts', async () => {
        // formatNumber (SJM:64, USJ:186)
        const term = ['e', 'a', 'i', 'o'].find((t) => matchesOf(nodes, t).length >= 1000);
        expect(term, 'a one-letter term with >= 1 000 matches in the big graph').toBeDefined();
        const total = formatNumber(matchesOf(nodes, term ?? 'e').length);
        await search.fill(term ?? 'e');
        await softly(label).toHaveText(`1 / ${total}`);
        softly(total, 'vi grouping separator').toContain('.');
        await softly(page.getByText(countsLabelOf(graph), { exact: true })).toBeVisible();
        await ev(page, '31-C-009', 'vi_grouping');
      });

      await test.step('[31-C-010] Scalar numbers: integers without decimals, others with 2 decimals (vi comma)', async () => {
        // SJM:63-65 — mm are integers (FE .int(), BE SafeInt), so the decimal scalar is the confidence: 0.9 shows 0,90; 220 shows 220
        await search.fill('0,90');
        await softly(rowsOf(page).filter({ hasText: /confidence\s*:\s*0,90/u }).first()).toBeVisible();
        await ev(page, '31-C-010', 'decimals_0_90');
        await search.fill('220');
        await softly(rowsOf(page).filter({ hasText: /thickness\w*\s*:\s*220(?!\d)/u }).first()).toBeVisible();
      });

      await test.step('[31-C-011] A string longer than 64 characters is cut with an ellipsis', async () => {
        // SJM:35,57-61
        await search.fill(LONG_ROOM_NAME.slice(0, 12));
        const row = rowsOf(page).filter({ hasText: LONG_ROOM_NAME.slice(0, 20) });
        await softly(row.locator('code').nth(1)).toHaveText(`"${LONG_ROOM_NAME.slice(0, 64)}…"`);
        await ev(page, '31-C-011', 'long_string_cut');
      });
    });
  });

  test('SCR-31 · FL-31-07 · roles: engineer member, viewer member, non-member', async ({ browser }) => {
    test.setTimeout(180_000);
    await withAdmin(browser, async (admin) => {
      const project = await qcProject(admin, 'data-roles'); // S-DATA-QC
      const adminApi = await adminRequest(admin);
      const engineer = await poolUser(adminApi, 'engineer', 'p06-share-eng');
      const viewer = await poolUser(adminApi, 'viewer', 'p06-share-view');
      const outsider = await poolUser(adminApi, 'engineer', 'p06-share-out'); // never added to the project
      const members: PoolUser[] = [engineer, viewer];
      for (const user of members) await addProjectMember(adminApi, project.id, user.email);
      try {
        const eng = await openPoolFlow(browser, engineer);
        try {
          await openData(eng.page, project.id);
          await test.step('[31-D-002] engineer member sees the data: tree visible, same copy', async () => {
            await expect(eng.page.getByRole('heading', { level: 1, name: SJ.title, exact: true })).toBeVisible();
            await expect(treeOf(eng.page)).toBeVisible();
            await softly(eng.page.getByText(SJ.valid, { exact: true })).toBeVisible();
            await softly(tabsOf(eng.page)).toBeVisible();
            await ev(eng.page, '31-D-002', 'engineer_member');
          });
        } finally {
          await eng.context.close();
        }

        const view = await openPoolFlow(browser, viewer);
        try {
          await openData(view.page, project.id);
          await test.step('[31-D-003] viewer member sees the data, nothing editable: only the search input is an input', async () => {
            // SJV:14-17; S5-confirm: the screen sits inside <main> and the shell adds no input of its own
            await softly(treeOf(view.page)).toBeVisible();
            await softly(view.page.locator('main').locator('input:visible, textarea:visible, select:visible')).toHaveCount(1);
            await softly(searchBox(view.page)).toBeVisible();
            await ev(view.page, '31-D-003', 'viewer_member');
          });
        } finally {
          await view.context.close();
        }

        const out = await openPoolFlow(browser, outsider);
        try {
          await navigateThenWaitForApi(out.page, () => out.page.goto(ROUTES.project.data(project.id), { waitUntil: 'commit' }), 'GET', projectRe(project.id), [404]);
          await test.step('[31-D-004] non-member (pool engineer not added) is refused with the not-found gate', async () => {
            // PSG:37-60; the BE answers 404 on a project the caller is not in (K08: one sentence for 404 / 403)
            const gate = out.page.getByRole('alert').filter({ hasText: GATE.notFoundTitle });
            await softly(gate, 'not-found gate').toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
            await softly(treeOf(out.page)).toHaveCount(0);
            await ev(out.page, '31-D-004', 'non_member');
          });
        } finally {
          await out.context.close();
        }
      } finally {
        for (const user of members) {
          const failed = await removeProjectMember(adminApi, project.id, user.id);
          if (failed !== null) test.info().annotations.push({ type: 'cleanup', description: failed });
        }
        await adminApi.dispose();
      }
    });
  });
});
