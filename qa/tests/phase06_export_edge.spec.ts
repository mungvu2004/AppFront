/**
 * Phase 6 — SCR-30 Bảng xuất (ExportPanel), EDGE layer, real stack: eleven user flows (QA-06b P4, `flows-C3.md`
 * "phase06_export_edge.spec.ts"). One `test()` per flow (title `SCR-30 · FL-30-NN · …`), one `test.step('[<row id>] …')` per
 * catalog row in the planned order. `H` rows use a hard `expect`, `S` rows `expect.soft`; every step captures one evidence
 * `E06_<row id>_<slug>.png`. Not serial (BUG-471): each flow opens its own context, seeds its own `qa-<runId>-…` project and
 * deletes it in `finally`. Mocked rows live in `phase06_export_mocked_edge.spec.ts`, the 4-viewport rows in `_ui`, the main
 * chain flow FL-M-30-01 in `phase06_pipeline.spec.ts` (P2).
 *
 * Source (FE @ d50bb248): EPV src/screens/export/ExportPanel/ExportPanel.tsx · EPF …Formats · EPO …Options · EPP …Preflight ·
 * EPT …Footer · UEP useExportPanel.ts · EPG exportPanelGateway.ts · GLB src/lib/export/exportGlb.ts · GWK glb.worker.ts ·
 * PSG src/components/feedback/ProjectSpatialGate.tsx. Every export is built in the browser: the screen sends no request of
 * its own (reads #24, N15, N21 through the gate).
 *
 * Steps marked ⚑ assert the CORRECT behaviour and stay red while the suspected bug is there (30-C-015, 30-C-026, 30-C-029,
 * 30-E-003, 30-E-012, 30-E-014, 30-G-008, 30-B-006). `// S5-confirm:` marks a seed or value assumed from source.
 *
 * ## Seeds (support/p06/export.ts)
 * X2 = `createQcProject(…, ['Tầng 1','Tầng 2'], 2)` (also XF: `qcLayer` carries one table per layered floor) · X4 = X2 + "Tầng 2"
 * approved + one 40 mm wall on "Tầng 1" · XN = X1 renamed "Đường Nguyễn Huệ" then "---" · P1 = one floor (65 chars), no layer ·
 * M0 = zero floors · +V/+E/+E2/+DEM = pool users `p06-export-v/-e/-n/-demote`.
 *
 * ## Real-backend budget per full run
 * - `POST /api/auth/login` (120 / 60 s per IP): 1 per flow session (11) + 1 per pool session (4) + 1 admin API (`signedInApi`) in
 *   FL-30-09 / FL-30-10 = ≈ 17. `POST /api/auth/refresh` (300 / 60 s): 1 fixture token per flow + ~1 per page load (≈ 130).
 * - `POST /api/projects` 11 (+ `DELETE` 11); `PUT …/spatial/layer` 2 per layered floor + 2 (X4); `PATCH /api/projects/:id` 3;
 *   `POST …/floors` 1; `POST …/members` 3; `PATCH /api/users/:id/role` 2 (demote + restore); `POST /api/users/invitations` 0
 *   when the four `p06-export-*` slots exist, else ≤ 4 (users_invite 30 / 3600 s). No upload (drawings_init 0).
 * - Exports are browser downloads saved under the test output dir; the app sends nothing for them (30-G-004, 30-G-005).
 */
import { statSync } from 'node:fs';

import { expect, test, type Browser, type Page } from '@playwright/test';

import { ROUTES, loginUrl } from '../../e2e/fixtures/routes';
import { TOUR_APPEAR_TIMEOUT_MS, TOUR_SKIP_NAME, dismissTour } from '../../e2e/fixtures/tour';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { attachJson } from './support/evidence';
import { addProjectMember, poolUser } from './support/phase03Seed';
import {
  EP,
  addFloor,
  adminApi,
  asRecord,
  closeExportFlow,
  collectTelemetry,
  downloadVia,
  exportButton,
  exportNameRe,
  expandOptions,
  fileSlug,
  findingsTotal,
  floorOf,
  formatFileSize,
  formatGroup,
  formatRadio,
  glbNodes,
  historyRegion,
  historyRows,
  nextFrames,
  normSpace,
  openExport,
  openExportFlow,
  openPoolFlow,
  optionsToggle,
  pathOf,
  preflightRegion,
  preflightRow,
  projectRe,
  readGlb,
  readJsonFile,
  region,
  renameProject,
  requestsSince,
  ruleConfigRe,
  saveDownload,
  scopeBox,
  scopeRegion,
  scopeRow,
  seedEmptyProject,
  seedExportProject,
  seedNamed,
  seedNoLayer,
  seedQc,
  seedTwoFloors,
  selectFormat,
  setBox,
  shot,
  uniq,
  unreviewedCount,
  type ExportFlow,
  type PoolFlow,
} from './support/p06/export';

/** Runs `body` in a fresh admin flow session; the projects it seeded are deleted and the context closed in `finally`. */
async function inFlow(browser: Browser, body: (flow: ExportFlow) => Promise<void>): Promise<void> {
  let flow: ExportFlow | undefined;
  try {
    flow = await openExportFlow(browser);
    await body(flow);
  } finally {
    await closeExportFlow(flow);
  }
}

/** The `<p>` of an ".png" option line ("Góc nhìn hiện tại:" / "Chiều rộng xuất:") and its mono value (EPO:178-183). */
const imageValue = (page: Page, label: string) => page.locator('p', { hasText: label }).locator('span.font-mono');
/** Cell `index` of the first (newest) history row: 0 file, 1 moment, 2 size, 3 "Tải lại". */
const historyCell = (page: Page, row: number, index: number) => historyRows(page).nth(row).locator('td').nth(index);
const arrayOf = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.map((item) => asRecord(item, 'item')) : []);

test.describe('SCR-30 Bảng xuất — edge (real stack)', () => {
  test('SCR-30 · FL-30-01 · first look: cards, defaults, options disclosure, tour anchor, no Chia sẻ', async ({ browser }) => {
    test.setTimeout(120_000);
    await inFlow(browser, async (flow) => {
      const { page } = flow;
      const project = await seedTwoFloors(flow, 'export-fl01');

      await test.step('[30-G-002] deep link; N15 read', async () => {
        const read = await openExport(page, project.id);
        expect(read.response.status()).toBe(200); // GET /api/projects/:id/spatial
        await expect(formatGroup(page)).toBeVisible();
        await shot(page, '30-G-002', 'first_open');
      });

      await test.step('[30-G-003] rule-config read at most once', async () => {
        // UPS hydrateRuleConfigOnce runs once after the graph is applied (useProjectSpatial.ts:71-78,174).
        await expect.poll(() => flow.api.filter((e) => e.method === 'GET' && ruleConfigRe(project.id).test(e.path)).length, { message: 'the N21 read arrived' }).toBeGreaterThanOrEqual(1);
        await nextFrames(page);
        const reads = flow.api.filter((e) => e.method === 'GET' && ruleConfigRe(project.id).test(e.path));
        expect.soft(reads.length, 'GET …/rule-config per load').toBeLessThanOrEqual(1);
        await shot(page, '30-G-003', 'rule_config_once');
      });

      await test.step('[30-B-010] four cards with extension + audience sentence, no size line, no history', async () => {
        for (const [ext, sentence] of [['.glb', EP.audience.glb], ['.pdf', EP.audience.pdf], ['.png', EP.audience.png], ['.json', EP.audience.json]] as const) {
          await expect.soft(formatRadio(page, ext)).toContainText(sentence);
          await expect.soft(formatRadio(page, ext), `${ext} card has no size line`).not.toContainText(/\d\s?(KB|MB|B)\b/u);
        }
        await expect.soft(historyRegion(page)).toHaveCount(0);
        await shot(page, '30-B-010', 'four_cards');
      });

      await test.step('[30-B-011] ".pdf" card page count', async () => {
        // UEP:515 / EPG:489-500: 1 cover + floor plans + room table + violations (render 3D adds 0: no image).
        await expect.soft(formatRadio(page, '.pdf')).toContainText('4 trang');
        await shot(page, '30-B-011', 'pdf_page_count');
      });

      await test.step('[30-B-012] footer caption', async () => {
        await expect.soft(page.getByText(EP.destination, { exact: true })).toBeVisible(); // UEP:172, EPT:63 (BUG-446)
        await shot(page, '30-B-012', 'footer_caption');
      });

      await test.step('[30-C-001] defaults', async () => {
        await expect.soft(formatRadio(page, '.glb')).toHaveAttribute('aria-checked', 'true');
        await expect.soft(optionsToggle(page)).toHaveAttribute('aria-expanded', 'false');
        for (const floor of project.floors) await expect.soft(scopeBox(page, floor.name), `${floor.name} checked`).toBeChecked();
        await expandOptions(page);
        await expect.soft(page.getByRole('radiogroup', { name: EP.detailGroup, exact: true }).getByRole('radio', { name: EP.detail.high, exact: true })).toHaveAttribute('aria-checked', 'true');
        await expect.soft(page.getByRole('checkbox', { name: EP.furniture, exact: true })).toBeChecked();
        await shot(page, '30-C-001', 'defaults_options_open');
        await optionsToggle(page).click(); // back to the collapsed start for 30-A-003
        await expect(optionsToggle(page)).toHaveAttribute('aria-expanded', 'false');
      });

      await test.step('[30-A-002] click each card in turn', async () => {
        const all = ['.glb', '.pdf', '.png', '.json'];
        for (const ext of ['.pdf', '.png', '.json', '.glb']) {
          await formatRadio(page, ext).click();
          for (const other of all) await expect.soft(formatRadio(page, other), `${other} after clicking ${ext}`).toHaveAttribute('aria-checked', other === ext ? 'true' : 'false');
        }
        await shot(page, '30-A-002', 'cards_in_turn');
      });

      await test.step('[30-A-003] "Tuỳ chọn" click → click', async () => {
        const detail = page.getByRole('radiogroup', { name: EP.detailGroup, exact: true });
        await optionsToggle(page).click();
        await expect.soft(optionsToggle(page)).toHaveAttribute('aria-expanded', 'true');
        await expect.soft(detail).toBeVisible();
        await optionsToggle(page).click();
        await expect.soft(optionsToggle(page)).toHaveAttribute('aria-expanded', 'false');
        await expect.soft(detail).toHaveCount(0);
        await shot(page, '30-A-003', 'options_toggle');
      });

      await test.step('[30-C-002] detail control labels', async () => {
        await expandOptions(page);
        const radios = page.getByRole('radiogroup', { name: EP.detailGroup, exact: true }).getByRole('radio');
        await expect.soft(radios).toHaveCount(3);
        for (const label of [EP.detail.high, EP.detail.medium, EP.detail.low]) await expect.soft(radios.filter({ hasText: new RegExp(`^${label}$`, 'u') })).toHaveCount(1);
        await shot(page, '30-C-002', 'detail_labels');
      });

      await test.step('[30-A-016] share is absent', async () => {
        await expect.soft(page.getByRole('button', { name: EP.share, exact: true })).toHaveCount(0); // EPV:249, UEP:719, SLK:354
        await expect.soft(page.getByRole('dialog')).toHaveCount(0);
        await shot(page, '30-A-016', 'no_share');
      });

      await test.step('[30-A-021] tour anchor', async () => {
        // The tour is "seen" once skipped (useEditorTour.ts:307-364): forget that flag, then open the route with a new document.
        await page.evaluate(() => {
          for (const key of Object.keys(localStorage)) if (key.startsWith('appfront:system-editor-tour-seen:')) localStorage.removeItem(key);
        });
        const before = flow.downloads.length;
        await openExport(page, project.id, { dismiss: false });
        await expect.soft(exportButton(page)).toHaveAttribute('data-tour-anchor', 'exportResult'); // EPT:68
        await expect.soft(page.getByRole('button', { name: TOUR_SKIP_NAME, exact: true }).first(), 'EditorTour mounted on this route').toBeVisible({ timeout: TOUR_APPEAR_TIMEOUT_MS });
        // EditorTour.tsx:10-14,95-117: the backdrop is four panels around a real hole, and on /export the only live step is
        // `exportResult`, so the hole IS the "Xuất" button: the point at its centre belongs to the button.
        const hit = await exportButton(page).evaluate((el) => {
          const r = el.getBoundingClientRect();
          const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return top !== null && el.contains(top);
        });
        expect.soft(hit, 'the centre of "Xuất" is inside the tour hole (reachable)').toBe(true);
        // A click on the dark panel over a format card skips the tour (EditorTour.tsx:10-14) and does not reach the card.
        await formatRadio(page, '.png').click({ force: true });
        await dismissTour(page);
        expect.soft(flow.downloads.length, 'skipping the tour exports nothing').toBe(before);
        await shot(page, '30-A-021', 'tour_anchor');
        const file = await downloadVia(page, () => exportButton(page).click());
        expect.soft(file.suggestedFilename()).toMatch(exportNameRe(fileSlug(project.name), 'glb', 'T0-T1'));
      });
    });
  });

  test('SCR-30 · FL-30-02 · .pdf and .png blocked, their options, nothing sent, selections survive a format switch', async ({ browser }) => {
    test.setTimeout(120_000);
    await inFlow(browser, async (flow) => {
      const { page } = flow;
      const project = await seedTwoFloors(flow, 'export-fl02');
      const pdfCard = formatRadio(page, '.pdf');

      await test.step('[30-G-005] .pdf / .png send nothing', async () => {
        await openExport(page, project.id);
        const mark = flow.sent.length;
        await formatRadio(page, '.pdf').click();
        await selectFormat(page, '.png');
        await nextFrames(page);
        expect(requestsSince(flow.sent, mark), 'requests after selecting .pdf then .png').toEqual([]);
        await shot(page, '30-G-005', 'no_request');
      });

      await test.step('[30-B-013] .pdf selected: notice + card caption, no "Xuất"', async () => {
        await selectFormat(page, '.pdf');
        await expect.soft(page.getByText(EP.pdfNotice, { exact: true })).toBeVisible(); // UEP:175-176,583-586
        await expect.soft(pdfCard).toContainText(EP.pdfBlocked); // EPF:34-35
        await expect.soft(exportButton(page)).toHaveCount(0); // EPT:64
        await shot(page, '30-B-013', 'pdf_blocked');
      });

      await test.step('[30-C-025] PDF boxes', async () => {
        await expandOptions(page);
        for (const label of EP.pdfOptions.slice(0, 3)) await expect.soft(page.getByRole('checkbox', { name: label, exact: true }), label).toBeChecked();
        await expect.soft(page.getByRole('checkbox', { name: EP.pdfOptions[3], exact: true })).not.toBeChecked();
        await shot(page, '30-C-025', 'pdf_boxes');
      });

      await test.step('[30-C-024] page count follows the boxes', async () => {
        const counts = ['3 trang', '2 trang', '1 trang'];
        for (const [index, label] of EP.pdfOptions.slice(0, 3).entries()) {
          await setBox(page.getByRole('checkbox', { name: label, exact: true }), false);
          await expect.soft(pdfCard, `after unchecking "${label}"`).toContainText(counts[index] ?? '');
        }
        const render3d = page.getByRole('checkbox', { name: EP.pdfOptions[3], exact: true });
        await setBox(render3d, true);
        await expect.soft(pdfCard, '"Gồm ảnh dựng 3D" on changes nothing').toContainText('1 trang');
        await setBox(render3d, false);
        await expect.soft(pdfCard).toContainText('1 trang');
        await shot(page, '30-C-024', 'pdf_page_count');
      });

      await test.step('[30-C-031] no option enables "Xuất"', async () => {
        for (const label of EP.pdfOptions) {
          const box = page.getByRole('checkbox', { name: label, exact: true });
          await setBox(box, !(await box.isChecked()));
          await expect.soft(exportButton(page), `after toggling "${label}"`).toHaveCount(0);
        }
        await shot(page, '30-C-031', 'no_export_button');
      });

      await test.step('[30-B-014] .png selected: notice + card caption, no "Xuất"', async () => {
        const pngCard = await selectFormat(page, '.png');
        await expect.soft(page.getByText(EP.imageNotice, { exact: true })).toBeVisible(); // UEP:179-180,588-590
        await expect.soft(pngCard).toContainText(EP.imageBlocked); // EPF:38-39
        await expect.soft(exportButton(page)).toHaveCount(0);
        await shot(page, '30-B-014', 'png_blocked');
      });

      await test.step('[30-C-026] ⚑ "Góc nhìn hiện tại:" shows a human view name', async () => {
        const value = (await imageValue(page, EP.imageView).innerText()).trim();
        // UEP:291-294 stores `activeFloorId ?? '—'` once: a raw floor id or the dash, never a view name.
        expect.soft(value, 'not the missing-value dash').not.toBe('—');
        expect.soft(value, 'not a raw id').not.toMatch(/^[A-Za-z]{1,4}[-_][0-9A-Za-z]{8,}$/u);
        await shot(page, '30-C-026', 'png_view', `Góc nhìn hiện tại: ${value}`);
      });

      await test.step('[30-C-027] "Chiều rộng xuất:" value', async () => {
        await expect.soft(imageValue(page, EP.imageWidth)).toHaveText('1.440 px'); // UEP:213-217 formatNumber(1440) + " px"
        await shot(page, '30-C-027', 'png_width');
      });

      await test.step('[30-B-015] Space on ".json" brings "Xuất" back', async () => {
        const json = formatRadio(page, '.json');
        await json.focus();
        await page.keyboard.press('Space'); // EPF:87-93 a <button role=radio>
        await expect.soft(json).toHaveAttribute('aria-checked', 'true');
        await expect.soft(page.getByText(EP.imageNotice, { exact: true })).toHaveCount(0);
        await expect.soft(exportButton(page)).toBeVisible();
        await shot(page, '30-B-015', 'json_space');
      });

      await test.step('[30-A-011] selections survive a format switch', async () => {
        await selectFormat(page, '.glb');
        await expandOptions(page);
        await page.getByRole('radiogroup', { name: EP.detailGroup, exact: true }).getByRole('radio', { name: EP.detail.low, exact: true }).click();
        await setBox(scopeBox(page, 'Tầng 2'), false);
        await selectFormat(page, '.json');
        await setBox(page.getByRole('checkbox', { name: EP.confidence, exact: true }), false);
        await selectFormat(page, '.pdf');
        await selectFormat(page, '.glb');
        await expect.soft(page.getByRole('radiogroup', { name: EP.detailGroup, exact: true }).getByRole('radio', { name: EP.detail.low, exact: true })).toHaveAttribute('aria-checked', 'true');
        await expect.soft(scopeBox(page, 'Tầng 2')).not.toBeChecked();
        await selectFormat(page, '.json');
        await expect.soft(page.getByRole('checkbox', { name: EP.confidence, exact: true })).not.toBeChecked();
        await shot(page, '30-A-011', 'survive_switch');
      });
    });
  });

  test('SCR-30 · FL-30-03 · .json export: content, history, sizes, Tải lại, reload', async ({ browser }, testInfo) => {
    test.setTimeout(180_000);
    await inFlow(browser, async (flow) => {
      const { page } = flow;
      const project = await seedTwoFloors(flow, 'export-fl03');
      const confidence = page.getByRole('checkbox', { name: EP.confidence, exact: true });
      let first = { name: '', path: '' };
      let second = { name: '', path: '' };
      let n15Walls = 0;

      await test.step('[30-C-030] .json "Xuất": download name = history name', async () => {
        const read = await openExport(page, project.id);
        n15Walls = arrayOf(asRecord(asRecord(read.json, 'N15').graph, 'N15.graph').walls).length;
        await selectFormat(page, '.json');
        const download = await downloadVia(page, () => exportButton(page).click());
        first = { name: download.suggestedFilename(), path: await saveDownload(download, (n) => testInfo.outputPath(n), 'first-') };
        await expect(historyCell(page, 0, 0)).toHaveText(first.name);
        expect(first.name).toMatch(exportNameRe(fileSlug(project.name), 'json'));
        await shot(page, '30-C-030', 'json_export');
      });

      await test.step('[30-C-012] saved file: keys, wall count, indentation', async () => {
        const { text, data } = readJsonFile(first.path);
        expect.soft(Object.keys(data).sort()).toEqual(['axes', 'building', 'dimensions', 'furniture', 'levels', 'notes', 'openings', 'rooms', 'walls']);
        expect.soft(arrayOf(data.walls).length, 'walls = N15 walls').toBe(n15Walls);
        expect.soft(n15Walls, 'the seed has walls').toBeGreaterThan(0);
        expect.soft(text.startsWith('{\n  "'), '2-space indent (EPG:404-415)').toBe(true);
        await shot(page, '30-C-012', 'json_content', `walls: ${String(n15Walls)}`);
      });

      await test.step('[30-C-013] confidence on keeps `confidence` on every wall', async () => {
        const walls = arrayOf(readJsonFile(first.path).data.walls);
        expect.soft(walls.every((wall) => typeof wall.confidence === 'number'), 'every wall has a numeric confidence').toBe(true);
        await shot(page, '30-C-013', 'json_confidence');
      });

      await test.step('[30-B-016] history section', async () => {
        await expect.soft(historyRegion(page)).toBeVisible();
        await expect.soft(historyRegion(page).getByText(EP.historyCaption, { exact: true })).toBeVisible();
        for (const head of EP.historyHeads) await expect.soft(historyRegion(page).getByRole('columnheader', { name: head, exact: true }), head).toBeVisible();
        await shot(page, '30-B-016', 'history_section');
      });

      await test.step('[30-B-017] time label', async () => {
        await expect.soft(historyCell(page, 0, 1)).toHaveText('vừa xong'); // datetime.ts:34,196
        await shot(page, '30-B-017', 'history_time');
      });

      await test.step('[30-B-018] size label', async () => {
        const expected = formatFileSize(statSync(first.path).size);
        expect.soft(normSpace(await historyCell(page, 0, 2).innerText())).toBe(expected);
        await shot(page, '30-B-018', 'history_size', `expected ${expected}`);
      });

      await test.step('[30-B-019] card sizes', async () => {
        const label = formatFileSize(statSync(first.path).size);
        expect.soft(normSpace(await formatRadio(page, '.json').innerText())).toContain(label);
        for (const ext of ['.glb', '.pdf', '.png']) await expect.soft(formatRadio(page, ext), `${ext} card has no size`).not.toContainText(/\d\s?(KB|MB|B)\b/u);
        await shot(page, '30-B-019', 'card_sizes');
      });

      await test.step('[30-E-001] heading and regions', async () => {
        await expect.soft(page.getByRole('heading', { name: EP.title, level: 2 })).toBeVisible();
        for (const name of [EP.preflight, EP.history]) await expect.soft(region(page, name), name).toBeVisible();
        await expect.soft(region(page, EP.scope), 'no scope block for .json (ExportPanelOptions.tsx:221)').toHaveCount(0);
        await shot(page, '30-E-001', 'regions');
      });

      await test.step('[30-A-007] "Tải lại" re-delivers the file', async () => {
        const again = await downloadVia(page, () => historyRegion(page).getByRole('button', { name: `${EP.redownload} ${first.name}`, exact: true }).click()); // F3 (E-014): aria-label "Tải lại <tên>"
        expect.soft(again.suggestedFilename()).toBe(first.name);
        await expect.soft(historyRows(page)).toHaveCount(1);
        await shot(page, '30-A-007', 'redownload');
      });

      await test.step('[30-C-014] confidence off: no `confidence` in the file', async () => {
        await expandOptions(page);
        await setBox(confidence, false);
        const download = await downloadVia(page, () => exportButton(page).click());
        second = { name: download.suggestedFilename(), path: await saveDownload(download, (n) => testInfo.outputPath(n), 'second-') };
        expect.soft(readJsonFile(second.path).text.includes('"confidence"'), 'no confidence key (EPG:417-437)').toBe(false);
        await shot(page, '30-C-014', 'json_no_confidence');
      });

      await test.step('[30-A-009] a second export adds a row above the first', async () => {
        await expect.soft(historyRows(page)).toHaveCount(2);
        await expect.soft(historyCell(page, 0, 0)).toHaveText(second.name);
        await expect.soft(historyCell(page, 1, 0)).toHaveText(first.name);
        await shot(page, '30-A-009', 'two_rows');
      });

      await test.step('[30-A-008] "Tải lại" on the older row delivers THAT file', async () => {
        const again = await downloadVia(page, () => historyRows(page).nth(1).getByRole('button', { name: `${EP.redownload} ${first.name}`, exact: true }).click());
        expect.soft(again.suggestedFilename()).toBe(first.name);
        const saved = await saveDownload(again, (n) => testInfo.outputPath(n), 'again-');
        expect.soft(readJsonFile(saved).text.includes('"confidence"'), 'the older file still carries confidence').toBe(true);
        await shot(page, '30-A-008', 'redownload_older');
      });

      await test.step('[30-E-014] ⚑ each "Tải lại" button names its file', async () => {
        for (const [row, name] of [[0, second.name], [1, first.name]] as const) {
          await expect.soft(historyRows(page).nth(row).getByRole('button', { name: `${EP.redownload} ${name}`, exact: true }), `row ${String(row + 1)} button name`).toHaveCount(1);
        }
        await shot(page, '30-E-014', 'redownload_names');
      });

      await test.step('[30-A-010] reload empties the history', async () => {
        await openExport(page, project.id);
        await expect.soft(historyRegion(page)).toHaveCount(0); // EPV:117-119, EPG:651
        await shot(page, '30-A-010', 'history_after_reload');
      });
    });
  });

  test('SCR-30 · FL-30-04 · .glb export: names, scope, metadata, detail, furniture, no floor', async ({ browser }, testInfo) => {
    test.setTimeout(240_000);
    await inFlow(browser, async (flow) => {
      const { page } = flow;
      const project = await seedTwoFloors(flow, 'export-fl04'); // XF: both floors carry the QC table
      const slug = fileSlug(project.name);
      const beacons = collectTelemetry(page);
      const glbPath = async (action: () => Promise<unknown>, prefix: string): Promise<{ name: string; path: string }> => {
        const download = await downloadVia(page, action);
        return { name: download.suggestedFilename(), path: await saveDownload(download, (n) => testInfo.outputPath(n), prefix) };
      };
      let both = { name: '', path: '' };
      let only2Path = '';

      await test.step('[30-C-006] both floors: <slug>_T0-T1_<stamp>.glb', async () => {
        await openExport(page, project.id);
        await expect(formatRadio(page, '.glb')).toHaveAttribute('aria-checked', 'true');
        both = await glbPath(() => exportButton(page).click(), 'both-');
        expect(both.name).toMatch(exportNameRe(slug, 'glb', 'T0-T1'));
        await shot(page, '30-C-006', 'glb_two_floors');
      });

      await test.step('[30-C-008] saved file: binary glTF with project metadata', async () => {
        const glb = readGlb(both.path);
        expect.soft(glb.magic).toBe('glTF');
        const extras = asRecord(asRecord(glb.json.asset, 'asset').extras, 'asset.extras'); // GWK:106-112
        expect.soft(extras.projectName).toBe(project.name);
        expect.soft(extras.unit).toBe('metre');
        // S5-confirm: projectVersion is the store's graph version (versionIdFor(floorMeta)), non-empty for a layered project.
        expect.soft(typeof extras.projectVersion === 'string' && extras.projectVersion !== '', 'projectVersion is the current version id').toBe(true);
        await shot(page, '30-C-008', 'glb_metadata', `projectVersion: ${String(extras.projectVersion)}`);
      });

      await test.step('[30-G-008] ⚑ telemetry beacon of the .glb export', async () => {
        // UEP:254 (F3): the gateway now has createTelemetrySender, which stays off unless the web image is built with VITE_TELEMETRY_ENABLED (lib/telemetry/sender.ts:82).
        await expect.configure({ soft: true }).poll(() => beacons().filter((e) => e.name === 'export.file').length, { message: 'an export.file event reaches /api/telemetry', timeout: 15_000 }).toBeGreaterThanOrEqual(1);
        const events = beacons().filter((e) => e.name === 'export.file');
        expect.soft(events.length, 'one beacon for the .glb export').toBe(1);
        const event = events[0] ?? {};
        expect.soft(event).toMatchObject({ format: 'glb', outcome: 'success', pageCount: 0 });
        expect.soft(Math.abs(Number(event.sizeKb) - statSync(both.path).size / 1024), 'sizeKb = bytes / 1024').toBeLessThanOrEqual(1);
        await shot(page, '30-G-008', 'telemetry', `export.file events: ${String(events.length)}`);
      });

      await test.step('[30-C-007] only "Tầng 2": <slug>_T1_<stamp>.glb', async () => {
        await setBox(scopeBox(page, 'Tầng 1'), false);
        const only2 = await glbPath(() => exportButton(page).click(), 'only2-');
        expect.soft(only2.name).toMatch(exportNameRe(slug, 'glb', 'T1'));
        only2Path = only2.path;
        await shot(page, '30-C-007', 'glb_second_floor');
      });

      await test.step('[30-C-009] scene tree has the selected floor only', async () => {
        const names = glbNodes(readGlb(only2Path)).map((node) => node.name);
        expect.soft(names, 'a node for "Tầng 2"').toContain('Tầng 2');
        expect.soft(names, 'no node for "Tầng 1"').not.toContain('Tầng 1');
        await shot(page, '30-C-009', 'glb_scene_tree');
      });

      await test.step('[30-C-005] only "Tầng 1": <slug>_T0_<stamp>.glb', async () => {
        await setBox(scopeBox(page, 'Tầng 1'), true);
        await setBox(scopeBox(page, 'Tầng 2'), false);
        const only1 = await glbPath(() => exportButton(page).click(), 'only1-');
        expect.soft(only1.name).toMatch(exportNameRe(slug, 'glb', 'T0'));
        await shot(page, '30-C-005', 'glb_first_floor');
      });

      let highSize = 0;
      let highPath = '';
      await test.step('[30-C-003] detail "Gọn" vs "Cao": size follows detail', async () => {
        await setBox(scopeBox(page, 'Tầng 2'), true);
        await expandOptions(page);
        const detail = page.getByRole('radiogroup', { name: EP.detailGroup, exact: true });
        await detail.getByRole('radio', { name: EP.detail.low, exact: true }).click();
        const low = await glbPath(() => exportButton(page).click(), 'low-');
        await detail.getByRole('radio', { name: EP.detail.high, exact: true }).click();
        const high = await glbPath(() => exportButton(page).click(), 'high-');
        highSize = statSync(high.path).size;
        highPath = high.path;
        expect.soft(statSync(low.path).size, 'size("Gọn") ≤ size("Cao") (GWK:395-397,655-656)').toBeLessThanOrEqual(highSize);
        await shot(page, '30-C-003', 'glb_detail', `Gọn ${String(statSync(low.path).size)} B ≤ Cao ${String(highSize)} B`);
      });

      await test.step('[30-C-004] furniture off: not larger, no furniture nodes', async () => {
        await setBox(page.getByRole('checkbox', { name: EP.furniture, exact: true }), false);
        const off = await glbPath(() => exportButton(page).click(), 'nofurniture-');
        const furnitureNodes = (path: string): number => glbNodes(readGlb(path)).filter((node) => asRecord(node.extras ?? {}, 'extras').kind === 'furniture').length;
        expect.soft(statSync(off.path).size, 'size(off) ≤ size(on)').toBeLessThanOrEqual(highSize);
        expect.soft(furnitureNodes(highPath), 'the file with furniture has furniture nodes').toBeGreaterThan(0);
        expect.soft(furnitureNodes(off.path), 'no furniture node when off').toBe(0);
        await shot(page, '30-C-004', 'glb_no_furniture');
      });

      await test.step('[30-C-017] no floor: no "Xuất", two preflight rows, nothing sent', async () => {
        await setBox(scopeBox(page, 'Tầng 1'), false);
        await setBox(scopeBox(page, 'Tầng 2'), false);
        const downloads = flow.downloads.length;
        const mark = flow.sent.length;
        await nextFrames(page);
        await expect.soft(exportButton(page)).toHaveCount(0); // EPV:323-325 canDeliverFormat, BUG-466
        await expect.soft(preflightRegion(page).getByRole('listitem')).toHaveCount(2); // approval + violations only
        await expect.soft(preflightRegion(page)).toContainText(EP.noFloor);
        expect.soft(flow.downloads.length, 'no new download').toBe(downloads);
        expect.soft(requestsSince(flow.sent, mark), 'nothing sent').toEqual([]);
        await shot(page, '30-C-017', 'glb_no_floor');
      });
    });
  });

  test('SCR-30 · FL-30-05 · file naming, double click, completion announcement', async ({ browser }) => {
    test.setTimeout(120_000);
    await inFlow(browser, async (flow) => {
      const { page } = flow;
      const project = await seedNamed(flow, 'Đường Nguyễn Huệ');

      await test.step('[30-C-010] .json name uses the ASCII slug', async () => {
        await openExport(page, project.id);
        await selectFormat(page, '.json');
        const download = await downloadVia(page, () => exportButton(page).click());
        expect(download.suggestedFilename()).toMatch(/^duong-nguyen-hue_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/u); // GLB:112-130
        await shot(page, '30-C-010', 'json_name_slug');
      });

      await test.step('[30-C-029] ⚑ double click yields one file', async () => {
        const rowsBefore = await historyRows(page).count();
        const mark = flow.downloads.length;
        await exportButton(page).dblclick();
        await expect.configure({ soft: true }).poll(() => historyRows(page).count(), { message: 'a new history row (or the second click hit Huỷ)' }).toBeGreaterThan(rowsBefore);
        await nextFrames(page);
        expect.soft(flow.downloads.length - mark, 'downloads from one double click').toBe(1);
        await expect.soft(historyRows(page)).toHaveCount(rowsBefore + 1);
        await shot(page, '30-C-029', 'double_click');
      });

      await test.step('[30-E-012] ⚑ completion is announced', async () => {
        // UEP:439-450 / EPC:32-42: the announcer / toast were removed — only a silent table row and the browser download UI.
        const lastName = flow.downloads[flow.downloads.length - 1] ?? '';
        const live = page.locator('[aria-live="polite"], [role="status"], [data-announcer]').filter({ hasText: lastName });
        await expect.soft(live, 'a polite live region names the file just exported').not.toHaveCount(0);
        await shot(page, '30-E-012', 'announcement');
      });

      await test.step('[30-C-011] a name with no ASCII letters falls back to "untitled"', async () => {
        let name = '---';
        let status = await renameProject(flow.fx, project.id, name);
        if (status !== 200) {
          name = '!!'; // fallback named by the plan when the server refuses "---"
          status = await renameProject(flow.fx, project.id, name);
        }
        expect(status, `PATCH project name "${name}"`).toBe(200);
        await openExport(page, project.id);
        await selectFormat(page, '.json');
        const download = await downloadVia(page, () => exportButton(page).click());
        expect.soft(download.suggestedFilename()).toMatch(exportNameRe('untitled', 'json'));
        await shot(page, '30-C-011', 'untitled_name', `project name: ${name}`);
      });
    });
  });

  test('SCR-30 · FL-30-06 · scope and preflight on an approved + unapproved pair', async ({ browser }, testInfo) => {
    test.setTimeout(240_000);
    await inFlow(browser, async (flow) => {
      const { page, context } = flow;
      const project = await seedExportProject(flow);
      const [floor1, floor2] = [floorOf(project, 0), floorOf(project, 1)];
      const approvalText = EP.unapproved('Tầng 1');
      const marker = async (): Promise<unknown> => page.evaluate(() => (window as unknown as { __qaDocument?: number }).__qaDocument);

      await test.step('[30-B-029] scope rows: badge and caption per floor', async () => {
        await openExport(page, project.id);
        await expect(scopeRow(page, 'Tầng 2').getByText(EP.approvedBadge, { exact: true })).toBeVisible();
        await expect(scopeRow(page, 'Tầng 2').getByText(EP.notApprovedCaption, { exact: true })).toHaveCount(0);
        await expect(scopeRow(page, 'Tầng 1').getByText(EP.notApprovedBadge, { exact: true })).toBeVisible();
        await expect(scopeRow(page, 'Tầng 1').getByText(EP.notApprovedCaption, { exact: true })).toBeVisible();
        await shot(page, '30-B-029', 'scope_rows');
      });

      await test.step('[30-B-030] tone dots', async () => {
        await expect.soft(preflightRow(page, approvalText).locator('span.bg-state-attention')).toHaveCount(1); // EPP:34-40
        await expect.soft(preflightRow(page, EP.violations).locator('span.bg-state-attention')).toHaveCount(1);
        await expect.soft(preflightRegion(page).locator('span.bg-state-verified'), 'no green dot').toHaveCount(0);
        await shot(page, '30-B-030', 'tone_dots');
      });

      await test.step('[30-C-018] approval row wording', async () => {
        await expect.soft(preflightRow(page, approvalText)).toBeVisible();
        await setBox(scopeBox(page, 'Tầng 1'), false);
        await setBox(scopeBox(page, 'Tầng 2'), false);
        await expect.soft(preflightRow(page, EP.noFloor)).toBeVisible();
        await setBox(scopeBox(page, 'Tầng 2'), true);
        await expect.soft(preflightRow(page, EP.allApproved(1))).toBeVisible();
        await shot(page, '30-C-018', 'approval_wording');
      });

      await test.step('[30-C-019] approved-only scope: no "Sửa", green dot', async () => {
        const row = preflightRow(page, EP.allApproved(1));
        await expect.soft(row.getByRole('link')).toHaveCount(0); // EPG:319 fixHref null
        await expect.soft(row.locator('span.bg-state-verified')).toHaveCount(1);
        await shot(page, '30-C-019', 'approved_only');
      });

      await test.step('[30-C-021] unreviewed objects row', async () => {
        await setBox(scopeBox(page, 'Tầng 1'), true);
        const expected = await unreviewedCount(flow.fx, project.id, [floor1.id, floor2.id]);
        const row = preflightRow(page, EP.unreviewed);
        await expect.soft(row).toBeVisible();
        const match = EP.unreviewed.exec(await row.innerText());
        expect.soft(Number(match?.[1]?.replace(/\./gu, '')), 'N = items with reviewed:false on the selected floors (N16)').toBe(expected);
        await expect.soft(row.getByRole('link', { name: EP.fix })).toHaveCount(1);
        await shot(page, '30-C-021', 'unreviewed_row', `N16 unreviewed: ${String(expected)}`);
      });

      await test.step('[30-C-022] preflight recomputes when the scope changes', async () => {
        await setBox(scopeBox(page, 'Tầng 1'), false);
        await expect.soft(preflightRow(page, EP.allReviewed)).toBeVisible();
        await expect.soft(preflightRow(page, EP.unreviewed)).toHaveCount(0);
        await shot(page, '30-C-022', 'scope_recompute');
        await setBox(scopeBox(page, 'Tầng 1'), true);
      });

      await test.step('[30-C-023] preflight never blocks "Xuất"', async () => {
        await expect.soft(preflightRegion(page).locator('span.bg-state-attention')).toHaveCount(3);
        await expect.soft(exportButton(page)).toBeEnabled();
        const download = await downloadVia(page, () => exportButton(page).click());
        expect.soft(download.suggestedFilename()).toMatch(exportNameRe(fileSlug(project.name), 'glb', 'T0-T1'));
        await shot(page, '30-C-023', 'export_with_attention');
      });

      await test.step('[30-A-004] uncheck / check "Tầng 1"', async () => {
        await setBox(scopeBox(page, 'Tầng 1'), false);
        await expect.soft(scopeBox(page, 'Tầng 2')).toBeChecked();
        await setBox(scopeBox(page, 'Tầng 1'), true);
        await expect.soft(scopeBox(page, 'Tầng 1')).toBeChecked();
        await expect.soft(scopeBox(page, 'Tầng 2')).toBeChecked();
        await shot(page, '30-A-004', 'toggle_floor');
      });

      await test.step('[30-C-020] violations row count', async () => {
        const row = preflightRow(page, EP.violations);
        await expect.soft(row).toBeVisible();
        const match = EP.violations.exec(await row.innerText());
        const shown = Number(match?.[1]?.replace(/\./gu, ''));
        const total = await findingsTotal(flow, project.id);
        expect.soft(shown, 'N = findings total of the rules report').toBe(total);
        expect.soft(shown, 'the seeded 40 mm wall is a finding').toBeGreaterThanOrEqual(1);
        await expect.soft(row.getByRole('link', { name: EP.fix })).toHaveCount(1);
        await shot(page, '30-C-020', 'violations_row', `report findings: ${String(total)}`);
      });

      await test.step('[30-A-012] "Sửa" on the approval row → floors, no document reload', async () => {
        await page.evaluate(() => {
          (window as unknown as { __qaDocument?: number }).__qaDocument = 1;
        });
        await preflightRow(page, approvalText).getByRole('link', { name: EP.fix }).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.floors(project.id)); // EPG:319, UEP:702-711
        expect.soft(await marker(), 'same document (store kept)').toBe(1);
        await shot(page, '30-A-012', 'fix_floors');
      });

      await test.step('[30-A-013] "Sửa" on the unreviewed row → that floor\'s objects layer', async () => {
        await page.goBack();
        await expect(formatGroup(page)).toBeVisible();
        await preflightRow(page, EP.unreviewed).getByRole('link', { name: EP.fix }).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.objects(project.id, floor1.id)); // EPG:336-342
        await shot(page, '30-A-013', 'fix_objects');
      });

      await test.step('[30-A-014] "Sửa" on the violations row → rules report', async () => {
        await page.goBack();
        await expect(formatGroup(page)).toBeVisible();
        await preflightRow(page, EP.violations).getByRole('link', { name: EP.fix }).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.rules(project.id)); // EPG:328-331
        await shot(page, '30-A-014', 'fix_rules');
      });

      await test.step('[30-A-015] Ctrl+click on "Sửa" is left to the browser', async () => {
        await page.goBack();
        await expect(formatGroup(page)).toBeVisible();
        const link = preflightRow(page, approvalText).getByRole('link', { name: EP.fix });
        const href = await link.getAttribute('href');
        const opened = context.waitForEvent('page');
        await link.click({ modifiers: ['ControlOrMeta'] }); // EPP:46-55 returns early on a modifier key
        const tab = await opened;
        await tab.waitForLoadState('domcontentloaded');
        expect.soft(href, 'the row href').toBe(ROUTES.project.floors(project.id));
        expect.soft(pathOf(tab), 'the new page opens at the href').toBe(href);
        expect.soft(pathOf(page), 'the current page stays on /export').toBe(ROUTES.project.export(project.id));
        await tab.close();
        await shot(page, '30-A-015', 'ctrl_click');
      });

      await test.step('[30-C-015] ⚑ .json honours "Phạm vi"', async () => {
        await selectFormat(page, '.json');
        // A valid fix may also hide the scope block for .json (catalog C3:107): then there is nothing to uncheck.
        const scopeShown = (await scopeBox(page, 'Tầng 2').count()) > 0;
        // Both branches are correct; the annotation says which one ran (F3 hides the block for .json: ExportPanelOptions).
        test.info().annotations.push({ type: '30-C-015', description: scopeShown ? 'branch: scope block shown, only the ticked floor exported' : 'branch: scope block hidden for .json' });
        if (scopeShown) {
          await setBox(scopeBox(page, 'Tầng 2'), false);
          const download = await downloadVia(page, () => exportButton(page).click());
          const saved = await saveDownload(download, (n) => testInfo.outputPath(n), 'scope-');
          const levels = arrayOf(readJsonFile(saved).data.levels).map((level) => level.name);
          // UEP:663-665 / EPG:874-889 export the WHOLE graph while the scope card still shows for .json.
          expect.soft(levels, 'levels listed in the file').toEqual(['Tầng 1']);
        }
        await shot(page, '30-C-015', 'json_scope');
      });

      await test.step('[30-C-016] .json with no floor is still deliverable', async () => {
        // Hidden-scope branch (see 30-C-015): there is no floor to untick, the whole graph is exported and the button stays enabled.
        if ((await scopeBox(page, 'Tầng 1').count()) > 0) {
          await setBox(scopeBox(page, 'Tầng 1'), false);
          await expect.soft(preflightRow(page, EP.noFloor)).toBeVisible();
        }
        await expect.soft(exportButton(page)).toBeVisible(); // EPV:86-106 canDeliverFormat: JSON needs no floor
        await shot(page, '30-C-016', 'json_no_floor');
      });
    });
  });

  test('SCR-30 · FL-30-07 · project without a layer', async ({ browser }, testInfo) => {
    test.setTimeout(120_000);
    await inFlow(browser, async (flow) => {
      const { page } = flow;
      const project = await seedNoLayer(flow);
      const floorName = floorOf(project, 0).name;

      await test.step('[30-B-031] the panel renders with the long floor name', async () => {
        await openExport(page, project.id);
        await expect(formatGroup(page)).toBeVisible();
        await expect(page.getByRole('heading', { name: EP.emptyTitle })).toHaveCount(0);
        await expect(scopeBox(page, floorName)).toBeVisible();
        await shot(page, '30-B-031', 'no_layer_open');
      });

      await test.step('[30-B-034] clean rule run', async () => {
        const row = preflightRow(page, EP.noViolations);
        await expect.soft(row).toBeVisible();
        await expect.soft(row.getByRole('link')).toHaveCount(0);
        await shot(page, '30-B-034', 'no_violations');
      });

      await test.step('[30-B-032] .json export is valid and empty-ish', async () => {
        await selectFormat(page, '.json');
        const download = await downloadVia(page, () => exportButton(page).click());
        const { data } = readJsonFile(await saveDownload(download, (n) => testInfo.outputPath(n), 'nolayer-'));
        for (const key of ['walls', 'rooms', 'openings']) expect.soft(data[key], key).toEqual([]); // EPG:404-412
        await shot(page, '30-B-032', 'no_layer_json');
      });

      await test.step('[30-B-033] .glb on an empty floor ends, never a stuck progress footer', async () => {
        await selectFormat(page, '.glb');
        const mark = flow.files.length;
        await exportButton(page).click();
        // glb.worker.ts:352-420: an empty floor builds 0 parts and still encodes, so the outcome must be one valid file.
        await expect.configure({ soft: true }).poll(() => flow.files.length, { message: '.glb on an empty floor ends in a download', timeout: 30_000 }).toBeGreaterThan(mark);
        await expect.soft(page.getByRole('progressbar')).toHaveCount(0);
        await expect.soft(page.getByRole('button', { name: EP.errorRetry, exact: true }), 'no error banner').toHaveCount(0);
        const file = flow.files[flow.files.length - 1];
        if (flow.files.length > mark && file !== undefined) {
          expect.soft(readGlb(await saveDownload(file, (n) => testInfo.outputPath(n), 'empty-')).magic, 'a valid glTF').toBe('glTF');
        }
        await shot(page, '30-B-033', 'no_layer_glb');
      });
    });
  });

  test('SCR-30 · FL-30-08 · zero floors, then one floor', async ({ browser }) => {
    test.setTimeout(120_000);
    await inFlow(browser, async (flow) => {
      const { page } = flow;
      const project = await seedEmptyProject(flow);
      const emptyHeading = page.getByRole('heading', { name: EP.emptyTitle, level: 2 });

      await test.step('[30-B-005] empty state', async () => {
        await openExport(page, project.id, { ready: () => emptyHeading });
        await expect(emptyHeading).toBeVisible();
        await expect(page.getByText(EP.emptyCaption, { exact: true })).toBeVisible();
        await shot(page, '30-B-005', 'zero_floors');
      });

      await test.step('[30-B-006] ⚑ nothing else, coherent copy', async () => {
        await expect.soft(formatGroup(page)).toHaveCount(0);
        await expect.soft(exportButton(page)).toHaveCount(0);
        await expect.soft(page.getByRole('link', { name: 'Đi duyệt tầng', exact: true })).toHaveCount(0); // F3: the dead link is gone
        // EP:233-241: title "Chưa có gì để xuất" + "Dự án chưa có tầng nào. Tải bản vẽ lên hoặc thêm một tầng…" — says what to do next.
        const text = await emptyHeading.locator('xpath=..').innerText();
        expect.soft(text, 'the text tells what to do next').toMatch(/\b(thêm|tải lên|tạo)\b/iu);
        await shot(page, '30-B-006', 'empty_copy');
      });

      await test.step('[30-A-023] add a floor, reload → the panel replaces the empty state', async () => {
        await addFloor(flow.fx, project.id, 'Tầng 1');
        await openExport(page, project.id);
        await expect.soft(formatGroup(page)).toBeVisible();
        await expect.soft(scopeRegion(page).getByRole('checkbox', { name: 'Tầng 1', exact: true })).toBeVisible();
        await shot(page, '30-A-023', 'first_floor');
      });

      await test.step('[30-C-032] a floor added after mount is selected by default', async () => {
        await expect.soft(scopeBox(page, 'Tầng 1')).toBeChecked(); // UEP:319-325 state is the deselected list
        await shot(page, '30-C-032', 'new_floor_checked');
      });
    });
  });

  test('SCR-30 · FL-30-09 · viewer member is read-only', async ({ browser }) => {
    test.setTimeout(120_000);
    await inFlow(browser, async (flow) => {
      const project = await seedQc(flow, 'export-fl09');
      const admin = await adminApi();
      let viewerFlow: PoolFlow | undefined;
      try {
        const viewer = await poolUser(admin, 'viewer', 'p06-export-v');
        await addProjectMember(admin, project.id, viewer.email);
        viewerFlow = await openPoolFlow(browser, viewer);
        const page = viewerFlow.page;
        const forbidden = page.getByRole('heading', { name: EP.forbiddenTitle, level: 2 });

        await test.step('[30-B-002] forbidden heading', async () => {
          await openExport(page, project.id, { ready: () => forbidden });
          await expect(forbidden).toBeVisible();
          await shot(page, '30-B-002', 'viewer_forbidden');
        });

        await test.step('[30-B-003] caption names who may export', async () => {
          await expect.soft(page.getByText(EP.forbiddenCaption, { exact: true })).toBeVisible();
          await shot(page, '30-B-003', 'viewer_caption');
        });

        await test.step('[30-B-004] forbidden shows nothing else', async () => {
          await expect.soft(formatGroup(page)).toHaveCount(0);
          await expect.soft(exportButton(page)).toHaveCount(0);
          await expect.soft(region(page, EP.preflight)).toHaveCount(0);
          await expect.soft(region(page, EP.history)).toHaveCount(0);
          await shot(page, '30-B-004', 'viewer_nothing_else');
        });

        await test.step('[30-D-003] no file can be obtained', async () => {
          await page.keyboard.press('Enter');
          await page.keyboard.press('Space');
          await nextFrames(page);
          expect.soft(viewerFlow?.downloads.length, 'download events').toBe(0);
          await expect.soft(region(page, EP.history)).toHaveCount(0);
          await shot(page, '30-D-003', 'viewer_no_download');
        });

        await test.step('[30-G-006] role comes from #24 membership', async () => {
          const read = viewerFlow?.api.find((e) => e.method === 'GET' && projectRe(project.id).test(e.path));
          expect.soft(read?.status, 'GET /api/projects/:id for this member').toBe(200);
          await expect.soft(forbidden).toBeVisible();
          await shot(page, '30-G-006', 'viewer_role_source');
        });
      } finally {
        await viewerFlow?.context.close().catch(() => undefined);
        await admin.dispose();
      }
    });
  });

  test('SCR-30 · FL-30-10 · engineer, non-member, demoted, unknown project, anonymous', async ({ browser }) => {
    test.setTimeout(180_000);
    await inFlow(browser, async (flow) => {
      const project = await seedQc(flow, 'export-fl10');
      const admin = await adminApi();
      const opened: { close: () => Promise<void> }[] = [];
      let demotedId: string | null = null;
      try {
        const engineer = await poolUser(admin, 'engineer', 'p06-export-e');
        const outsider = await poolUser(admin, 'engineer', 'p06-export-n');
        const demotable = await poolUser(admin, 'engineer', 'p06-export-demote');
        // A previous run may have left the slot demoted: start from engineer.
        expect((await admin.patch(`/api/users/${demotable.id}/role`, { data: { userId: demotable.id, role: 'engineer' } })).status(), 'setup: PATCH role to engineer').toBe(200);
        await addProjectMember(admin, project.id, engineer.email);
        await addProjectMember(admin, project.id, demotable.email);

        await test.step('[30-D-002] engineer member can export', async () => {
          const member = await openPoolFlow(browser, engineer);
          opened.push(member.context);
          await openExport(member.page, project.id);
          await expect(exportButton(member.page)).toBeVisible();
          await expect(exportButton(member.page)).toBeEnabled();
          const download = await downloadVia(member.page, () => exportButton(member.page).click());
          expect(download.suggestedFilename()).toMatch(exportNameRe(fileSlug(project.name), 'glb', 'T0'));
          await shot(member.page, '30-D-002', 'engineer_export');
        });

        await test.step('[30-D-004] engineer who is not a member', async () => {
          const outside = await openPoolFlow(browser, outsider);
          opened.push(outside.context);
          await outside.page.goto(ROUTES.project.export(project.id));
          await expect.soft(outside.page.getByRole('alert').filter({ hasText: EP.notFoundTitle })).toBeVisible(); // PSG:34-60, K08
          await expect.soft(formatGroup(outside.page)).toHaveCount(0);
          await shot(outside.page, '30-D-004', 'non_member');
        });

        await test.step('[30-D-005] role lost while the screen is open', async () => {
          const member = await openPoolFlow(browser, demotable);
          opened.push(member.context);
          await openExport(member.page, project.id);
          await expect(exportButton(member.page)).toBeVisible();
          const changed = await admin.patch(`/api/users/${demotable.id}/role`, { data: { userId: demotable.id, role: 'viewer' } });
          demotedId = demotable.id;
          expect(changed.status(), 'setup: PATCH /api/users/:id/role → viewer').toBe(200);
          await expect.soft(exportButton(member.page), 'stale roles before the reload').toBeVisible();
          await member.page.reload();
          await expect.soft(member.page.getByRole('heading', { name: EP.forbiddenTitle, level: 2 })).toBeVisible(); // UEP:280-283
          await shot(member.page, '30-D-005', 'demoted_reload');
        });

        await test.step('[30-B-007] unknown project id', async () => {
          const missing = `prj_qa-p06-${uniq()}`;
          await flow.page.goto(ROUTES.project.export(missing));
          const alert = flow.page.getByRole('alert').filter({ hasText: EP.notFoundTitle });
          await expect.soft(alert).toBeVisible();
          await expect.soft(alert.getByRole('button', { name: EP.backToProjects, exact: true })).toBeVisible();
          await expect.soft(formatGroup(flow.page)).toHaveCount(0);
          await shot(flow.page, '30-B-007', 'unknown_project');
        });

        await test.step('[30-D-006] anonymous deep link', async () => {
          const anonymous = await browser.newContext({ baseURL: readBaseUrl() });
          opened.push(anonymous);
          const page = await anonymous.newPage();
          await page.goto(ROUTES.project.export(project.id));
          await expect.poll(() => pathOf(page)).toBe('/login');
          expect.soft(new URL(page.url()).searchParams.get('next')).toBe(ROUTES.project.export(project.id));
          expect.soft(loginUrl(ROUTES.project.export(project.id))).toBe(`/login?next=${encodeURIComponent(ROUTES.project.export(project.id))}`);
          await expect.soft(page.getByText(EP.loginHint, { exact: true })).toBeVisible();
          await shot(page, '30-D-006', 'anonymous');
        });
      } finally {
        if (demotedId !== null) {
          const restored = await admin.patch(`/api/users/${demotedId}/role`, { data: { userId: demotedId, role: 'engineer' } }); // restore the pool slot
          expect.soft(restored.status(), 'restore: PATCH role to engineer').toBe(200);
          if (restored.status() !== 200) test.info().annotations.push({ type: 'cleanup', description: `pool user ${demotedId} left as viewer` });
        }
        for (const item of opened) await item.close().catch(() => undefined);
        await admin.dispose();
      }
    });
  });

  test('SCR-30 · FL-30-11 · keyboard and semantics', async ({ browser }) => {
    test.setTimeout(180_000);
    await inFlow(browser, async (flow) => {
      const { page } = flow;
      const project = await seedTwoFloors(flow, 'export-fl11');
      const detail = page.getByRole('radiogroup', { name: EP.detailGroup, exact: true });
      const radios = ['.glb', '.pdf', '.png', '.json'];

      await test.step('[30-E-002] format group semantics', async () => {
        await openExport(page, project.id);
        // One prior .json export, for the history row ("Tải lại") of the Tab-order step.
        await selectFormat(page, '.json');
        await downloadVia(page, () => exportButton(page).click());
        await expect(historyRows(page)).toHaveCount(1);
        await expect(formatGroup(page).getByRole('radio')).toHaveCount(4);
        await expect(formatGroup(page).locator('[role="radio"][aria-checked="true"]')).toHaveCount(1);
        await shot(page, '30-E-002', 'format_group');
      });

      await test.step('[30-E-003] ⚑ arrow keys move between the format radios', async () => {
        await selectFormat(page, '.glb');
        await formatRadio(page, '.glb').focus();
        await page.keyboard.press('ArrowDown'); // EPF:87-101 are plain buttons: arrows do nothing today
        await expect.soft(formatRadio(page, '.pdf'), '.pdf selected').toHaveAttribute('aria-checked', 'true');
        await expect.soft(formatRadio(page, '.pdf'), '.pdf focused').toBeFocused();
        for (const ext of radios) await expect.soft(formatRadio(page, ext), `${ext} tabindex (roving)`).toHaveAttribute('tabindex', ext === '.pdf' ? '0' : '-1');
        await shot(page, '30-E-003', 'arrow_keys');
      });

      await test.step('[30-E-004] Space and Enter select the focused card', async () => {
        await formatRadio(page, '.png').focus();
        await page.keyboard.press('Space');
        await expect.soft(formatRadio(page, '.png')).toHaveAttribute('aria-checked', 'true');
        await formatRadio(page, '.glb').focus();
        await page.keyboard.press('Enter');
        await expect.soft(formatRadio(page, '.glb')).toHaveAttribute('aria-checked', 'true');
        await shot(page, '30-E-004', 'space_enter');
      });

      await test.step('[30-E-005] Tab order follows the visual order', async () => {
        await expandOptions(page);
        await formatRadio(page, '.glb').focus();
        // Rank of the focused element: 1 formats · 2 scope · 3 options toggle · 4 option controls · 5 "Sửa" · 6 history · 7 footer.
        const rank = (): Promise<number> =>
          page.evaluate(() => {
            const el = document.activeElement;
            if (el === null) return 0;
            if (el.closest('[role="radiogroup"][aria-label="Định dạng xuất"]') !== null) return 1;
            if (el.closest('section[aria-label="Phạm vi"]') !== null) return 2;
            if (el.hasAttribute('aria-expanded')) return 3;
            if (el.closest('.animate-dropdown-open') !== null) return 4;
            if (el.closest('section[aria-label="Kiểm tra trước khi xuất"]') !== null) return 5;
            if (el.closest('section[aria-label="Tệp đã xuất"]') !== null) return 6;
            if (el.closest('footer') !== null) return 7;
            return 0;
          });
        const seen: number[] = [await rank()];
        for (let i = 0; i < 60 && seen[seen.length - 1] !== 7; i += 1) {
          await page.keyboard.press('Tab');
          seen.push(await rank());
        }
        expect.soft(seen[seen.length - 1], 'Tab reaches "Xuất" last').toBe(7);
        expect.soft(seen, 'visual order, never back').toEqual([...seen].sort((a, b) => a - b));
        expect.soft(new Set(seen), 'every region is a tab stop').toEqual(new Set([1, 2, 3, 4, 5, 6, 7]));
        await shot(page, '30-E-005', 'tab_order', `ranks: ${seen.join(',')}`);
      });

      await test.step('[30-E-006] "Tuỳ chọn" by Enter and Space', async () => {
        const before = await optionsToggle(page).getAttribute('aria-expanded');
        const flipped = before === 'true' ? 'false' : 'true';
        await optionsToggle(page).focus();
        await page.keyboard.press('Enter');
        await expect.soft(optionsToggle(page)).toHaveAttribute('aria-expanded', flipped);
        await page.keyboard.press('Space');
        await expect.soft(optionsToggle(page)).toHaveAttribute('aria-expanded', before ?? 'false');
        await shot(page, '30-E-006', 'options_keyboard');
      });

      await test.step('[30-E-007] scope checkboxes toggle with Space', async () => {
        const box = scopeBox(page, 'Tầng 1');
        await box.focus();
        await page.keyboard.press('Space');
        await expect.soft(box).not.toBeChecked();
        await page.keyboard.press('Space');
        await expect.soft(box).toBeChecked();
        await shot(page, '30-E-007', 'scope_space');
      });

      await test.step('[30-E-008] detail control: ArrowRight wraps', async () => {
        await expandOptions(page);
        await detail.getByRole('radio', { name: EP.detail.high, exact: true }).focus();
        for (const next of [EP.detail.medium, EP.detail.low, EP.detail.high]) {
          await page.keyboard.press('ArrowRight'); // SegmentedControl.tsx:128-153
          await expect.soft(detail.getByRole('radio', { name: next, exact: true }), `ArrowRight → ${next}`).toHaveAttribute('aria-checked', 'true');
        }
        await shot(page, '30-E-008', 'detail_arrows');
      });

      await test.step('[30-E-009] option checkboxes by Space', async () => {
        const furniture = page.getByRole('checkbox', { name: EP.furniture, exact: true });
        await furniture.focus();
        await page.keyboard.press('Space');
        await expect.soft(furniture).not.toBeChecked();
        await selectFormat(page, '.json');
        const confidence = page.getByRole('checkbox', { name: EP.confidence, exact: true });
        await confidence.focus();
        await page.keyboard.press('Space');
        await expect.soft(confidence).not.toBeChecked();
        await shot(page, '30-E-009', 'option_space');
      });

      await test.step('[30-E-010] preflight link accessible name', async () => {
        const links = preflightRegion(page).getByRole('link');
        const total = await links.count();
        expect.soft(total, 'the unapproved seed offers "Sửa" links').toBeGreaterThan(0);
        await expect.soft(preflightRegion(page).getByRole('link', { name: /^Sửa\s*:\s*Còn/u })).toHaveCount(total);
        await shot(page, '30-E-010', 'fix_link_names');
        await attachJson('E06_30-E-010_fix_links.json', { links: total });
      });
    });
  });
});
