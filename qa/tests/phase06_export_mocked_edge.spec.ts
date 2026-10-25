/**
 * Phase 6 — SCR-30 Bảng xuất, MOCKED RESPONSES: three flows (QA-06b P4, `flows-C3.md` "phase06_export_mocked_edge.spec.ts").
 * One `test()` per flow, one `test.step('[<row id>] …')` per catalog row in the planned order; every title carries
 * `[mocked response]` and each flow names its real pairing. `H` rows use a hard `expect`, `S` rows `expect.soft`; every step
 * captures one evidence `E06_<row id>_<slug>.png`.
 *
 * Why mocked: a real `.glb` export finishes in milliseconds (the progress footer, "Huỷ" and the worker error path cannot be
 * hit), and a 5xx read cannot be produced on the shared stack. What is real: the project, its floors and layers, #24, N15, auth,
 * and every file that is downloaded. Mocks (support/p06/export.ts):
 *   - `stubGlbWorker`: wraps `window.Worker` for a URL containing `glb.worker` only (`exportGlb.ts:169-171`); modes `silent`
 *     (accepts `start`, posts nothing), `fail` (posts `{kind:'error', message:'Worker crashed'}`), `fail-then-real`, `real`;
 *     a `cancel` message makes the stub answer `cancelled`; progress is pushed by the test with `emitFromWorker`.
 *   - `holdRoute`: `page.route` that keeps one GET until released (`hold`) or answers it with a JSON 500 until released (`fail`);
 *     other methods pass.
 *
 * Real pairing (the same screen with the real stack): FL-30-M1 ↔ FL-30-04 (real .glb export) · FL-30-M2 ↔ FL-30-04 ·
 * FL-30-M3 ↔ FL-30-01 (real open, N15 / #24 / N21 reads).
 *
 * ⚑ steps assert the CORRECT behaviour and stay red while the bug is there (30-E-013, 30-B-026, 30-C-028).
 *
 * ## Real-backend budget per full run
 * - `POST /api/auth/login` 3 (one session per flow); `POST /api/auth/refresh` ≈ 1 per page load (≈ 25) + 3 fixture tokens;
 *   `POST /api/projects` 3 (+ `DELETE` 3); `PUT …/spatial/layer` 5 (1 + 2 + 2). No upload, no member, no role change.
 */
import { expect, test, type Browser } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import {
  EP,
  ERROR_PAINT_TIMEOUT_MS,
  closeExportFlow,
  downloadVia,
  emitFromWorker,
  exportButton,
  exportNameRe,
  fileSlug,
  focusInfo,
  formatGroup,
  blockedFormat,
  formatRadio,
  historyRows,
  holdRoute,
  nextFrames,
  openExport,
  openExportFlow,
  optionsToggle,
  pathOf,
  preflightRow,
  projectRe,
  region,
  relockPause,
  ruleConfigRe,
  scopeBox,
  seedQc,
  seedTwoFloors,
  selectFormat,
  setBox,
  setGlbWorkerMode,
  expandOptions,
  shot,
  spatialRe,
  stubGlbWorker,
  workerStarts,
  type ExportFlow,
  type RouteHold,
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

const skeleton = (page: ExportFlow['page']) => page.locator('span[aria-hidden="true"].animate-pulse'); // EPF:145 SkeletonText
const footer = (page: ExportFlow['page']) => page.locator('footer'); // EPT:34,61

test.describe('SCR-30 Bảng xuất — mocked responses', () => {
  // Real pairing: FL-30-04 (real .glb export).
  test('SCR-30 · FL-30-M1 · [mocked response] Worker stub: progress, cancel, restart, leave and return', async ({ browser }) => {
    test.setTimeout(180_000);
    await inFlow(browser, async (flow) => {
      const { page } = flow;
      const project = await seedQc(flow, 'export-m1');
      let focusAfterExport = { tag: 'unset', inside: false };
      await stubGlbWorker(page, 'silent');

      await test.step('[30-B-022] .glb "Xuất" with a silent worker', async () => {
        await openExport(page, project.id);
        await exportButton(page).click();
        await expect(footer(page).getByText(EP.progress.build, { exact: true })).toBeVisible();
        await expect(footer(page).getByText('0/0 đối tượng', { exact: true })).toBeVisible(); // UEP:562-573
        focusAfterExport = await focusInfo(page); // the "Xuất" button unmounted with the footer swap (EPT:31 vs 61)
        await shot(page, '30-B-022', 'silent_worker');
      });

      await test.step('[30-B-020] worker posts build 12/40', async () => {
        await emitFromWorker(page, { kind: 'progress', phase: 'build', completed: 12, total: 40 });
        await expect.soft(footer(page).getByText('12/40 đối tượng', { exact: true })).toBeVisible();
        await expect.soft(footer(page).getByText(EP.progress.build, { exact: true })).toBeVisible();
        await expect.soft(footer(page).getByRole('button', { name: EP.cancel, exact: true })).toBeVisible();
        await expect.soft(page.getByText(EP.destination, { exact: true }), 'caption replaced').toHaveCount(0);
        await expect.soft(exportButton(page), '"Xuất" replaced').toHaveCount(0);
        await shot(page, '30-B-020', 'build_progress');
      });

      await test.step('[30-B-021] worker posts encode 3/10', async () => {
        await emitFromWorker(page, { kind: 'progress', phase: 'encode', completed: 3, total: 10 });
        await expect.soft(footer(page).getByText(EP.progress.encode, { exact: true })).toBeVisible();
        await expect.soft(footer(page).getByText('3/10 phần', { exact: true })).toBeVisible();
        await shot(page, '30-B-021', 'encode_progress');
      });

      await test.step('[30-B-023] the panel stays live while the footer shows progress', async () => {
        await expect.soft(page.locator('[aria-modal="true"]')).toHaveCount(0); // EPT:5-8 no modal overlay
        await selectFormat(page, '.json');
        const toggled = await optionsToggle(page).getAttribute('aria-expanded');
        await optionsToggle(page).click();
        await expect.soft(optionsToggle(page)).toHaveAttribute('aria-expanded', toggled === 'true' ? 'false' : 'true');
        await selectFormat(page, '.glb');
        await expect.soft(footer(page).getByRole('progressbar')).toBeVisible();
        await shot(page, '30-B-023', 'panel_live');
      });

      await test.step('[30-E-011] progress bar semantics', async () => {
        const bar = footer(page).getByRole('progressbar');
        await expect.soft(bar).toHaveAttribute('aria-valuemin', '0'); // EPT:44-51
        await expect.soft(bar).toHaveAttribute('aria-valuemax', '1');
        await expect.soft(bar).toHaveAttribute('aria-valuenow', '0.3'); // 3/10 (UEP:572)
        await expect.soft(bar).toHaveAttribute('aria-label', EP.progress.encode);
        await shot(page, '30-E-011', 'bar_semantics');
      });

      await test.step('[30-E-013] ⚑ focus is not lost when the footer swaps', async () => {
        expect.soft(focusAfterExport.inside, `focus after "Xuất" is inside the panel (was <${focusAfterExport.tag}>)`).toBe(true);
        await footer(page).getByRole('button', { name: EP.cancel, exact: true }).click();
        await expect(page.getByText(EP.destination, { exact: true })).toBeVisible();
        const afterCancel = await focusInfo(page);
        expect.soft(afterCancel.inside, `focus after "Huỷ" is inside the panel (was <${afterCancel.tag}>)`).toBe(true);
        await shot(page, '30-E-013', 'focus_after_swap', `after Xuất: <${focusAfterExport.tag}> · after Huỷ: <${afterCancel.tag}>`);
        await relockPause(page); // the run just ended: "Xuất" is guarded for 250 ms
        await exportButton(page).click(); // a new stalled run for the next steps
        await expect(footer(page).getByRole('progressbar')).toBeVisible();
      });

      await test.step('[30-A-017] "Huỷ" stops the run at once', async () => {
        const downloads = flow.downloads.length;
        await footer(page).getByRole('button', { name: EP.cancel, exact: true }).click(); // EPT:39-41, UEP:679-681
        await expect.soft(page.getByText(EP.destination, { exact: true })).toBeVisible();
        await expect.soft(exportButton(page)).toBeVisible();
        await expect.soft(footer(page).getByRole('progressbar')).toHaveCount(0);
        await nextFrames(page);
        expect.soft(flow.downloads.length, 'no download').toBe(downloads);
        await expect.soft(historyRows(page), 'no new row').toHaveCount(0);
        await expect.soft(page.getByRole('alert'), 'no error banner').toHaveCount(0);
        await shot(page, '30-A-017', 'cancelled');
      });

      await test.step('[30-A-018] after "Huỷ", "Xuất" runs a fresh export to the end', async () => {
        await relockPause(page); // "Huỷ" just ended the run
        await setGlbWorkerMode(page, 'real'); // the next Worker is the real one
        const download = await downloadVia(page, () => exportButton(page).click());
        expect.soft(download.suggestedFilename()).toMatch(exportNameRe(fileSlug(project.name), 'glb', 'T0'));
        await expect.soft(historyRows(page)).toHaveCount(1);
        await expect.soft(page.getByRole('progressbar')).toHaveCount(0);
        const starts = await workerStarts(page);
        expect.soft(starts.filter((s) => s.kind === 'start').pop()?.real, 'the last worker was the real one').toBe(true);
        await shot(page, '30-A-018', 'fresh_export');
      });

      await test.step('[30-A-020] leave the screen mid-export and come back', async () => {
        await setGlbWorkerMode(page, 'silent');
        await exportButton(page).click();
        await expect(footer(page).getByRole('progressbar')).toBeVisible();
        await preflightRow(page, /Còn 1 tầng chưa duyệt/u).getByRole('link', { name: EP.fix }).click(); // SPA navigation, same document
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.floors(project.id));
        await page.goBack();
        await expect(formatGroup(page)).toBeVisible();
        // UEP:21-33, EPG:651: the run ledger outlives the mount — progress, or the finished row once the worker is done.
        await expect
          .poll(async () => (await footer(page).getByRole('progressbar').count()) > 0 || (await historyRows(page).count()) === 2, { message: 'the run is still shown' })
          .toBe(true);
        await shot(page, '30-A-020', 'leave_and_return');
      });
    });
  });

  // Real pairing: FL-30-04.
  test('SCR-30 · FL-30-M2 · [mocked response] Worker fails: banner, copy, retry keeps settings', async ({ browser }) => {
    test.setTimeout(180_000);
    await inFlow(browser, async (flow) => {
      const { page } = flow;
      const project = await seedTwoFloors(flow, 'export-m2');
      const banner = page.getByRole('alert').filter({ has: page.getByRole('button', { name: EP.errorRetry, exact: true }) });
      let sentence = '';
      await stubGlbWorker(page, 'fail-then-real');

      await test.step('[30-B-024] a failed run shows the banner with "thử lại"; settings stay', async () => {
        await openExport(page, project.id);
        await expandOptions(page);
        await page.getByRole('radiogroup', { name: EP.detailGroup, exact: true }).getByRole('radio', { name: EP.detail.low, exact: true }).click();
        await setBox(scopeBox(page, 'Tầng 2'), false);
        await exportButton(page).click();
        await expect(banner).toBeVisible();
        await expect(banner.getByRole('button', { name: EP.errorRetry, exact: true })).toBeVisible(); // EPV:258-265
        sentence = (await banner.innerText()).replace(EP.errorRetry, '').trim();
        await expect(formatGroup(page)).toBeVisible();
        await expect(region(page, EP.scope)).toBeVisible();
        await expect(optionsToggle(page)).toBeVisible();
        await shot(page, '30-B-024', 'failure_banner');
      });

      await test.step('[30-E-016] the banner is announced', async () => {
        await expect.soft(page.getByRole('button', { name: EP.errorRetry, exact: true }).locator('xpath=ancestor::*[@role][1]')).toHaveAttribute('role', 'alert'); // InlineAlert.tsx:25
        await shot(page, '30-E-016', 'banner_role');
      });

      await test.step('[30-B-025] hint and code line', async () => {
        await expect.soft(page.getByText(EP.errorHint, { exact: false })).toBeVisible(); // UEP:183
        await expect.soft(page.getByText('(processing)', { exact: true })).toBeVisible(); // toAppError(worker text).kind = processing (toAppError.ts:150-159,229)
        await shot(page, '30-B-025', 'hint_and_code');
      });

      await test.step('[30-B-026] ⚑ the sentence names the export failure, not AI processing', async () => {
        // vi.json errors.processing.description = "Xử lý AI thất bại ở bước {{step}}…" with {{step}} swallowed → "…ở bước ."
        expect.soft(sentence, 'not the AI-pipeline sentence').not.toContain(EP.aiSentenceStart);
        expect.soft(sentence, 'it is about the export').toMatch(/xuất/iu);
        await shot(page, '30-B-026', 'failure_sentence', sentence);
      });

      await test.step('[30-A-019] "thử lại" re-runs with every setting unchanged', async () => {
        const download = await downloadVia(page, () => banner.getByRole('button', { name: EP.errorRetry, exact: true }).click());
        expect.soft(download.suggestedFilename(), 'one floor: T0').toMatch(exportNameRe(fileSlug(project.name), 'glb', 'T0'));
        await expect.soft(historyRows(page)).toHaveCount(1);
        const starts = (await workerStarts(page)).filter((s) => s.kind === 'start');
        const last = starts[starts.length - 1];
        expect.soft(starts.length, 'two runs: the failed one and the retry').toBe(2);
        expect.soft(last).toMatchObject({ real: true, detail: 'low', levels: ['Tầng 1'] });
        await expect.soft(formatRadio(page, '.glb')).toHaveAttribute('aria-checked', 'true');
        await shot(page, '30-A-019', 'retry_same_settings');
      });

      await test.step('[30-B-027] the banner clears after the success', async () => {
        await expect.soft(banner).toHaveCount(0);
        await shot(page, '30-B-027', 'banner_cleared');
      });
    });
  });

  // Real pairing: FL-30-01 (real open, same reads).
  test('SCR-30 · FL-30-M3 · [mocked response] gate failures and loading', async ({ browser }) => {
    test.setTimeout(240_000);
    await inFlow(browser, async (flow) => {
      const { page } = flow;
      const project = await seedTwoFloors(flow, 'export-m3');
      const exportUrl = ROUTES.project.export(project.id);
      let loading: RouteHold | undefined;

      await test.step('[30-B-001] loading: skeleton blocks in place of the numbers', async () => {
        loading = await holdRoute(page, spatialRe(project.id), 'hold');
        await page.goto(exportUrl, { waitUntil: 'commit' });
        await expect(skeleton(page).first()).toBeVisible(); // EPF:182-186, UEP:611
        await expect(blockedFormat(page, '.pdf')).not.toContainText(/\d[\d.]* trang/u);
        await shot(page, '30-B-001', 'loading_skeleton');
      });

      await test.step('[30-E-015] reduced motion: the skeleton does not pulse', async () => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await nextFrames(page);
        const animation = await skeleton(page).first().evaluate((el) => getComputedStyle(el).animationName);
        expect.soft(animation, 'animation-name under prefers-reduced-motion (motion-reduce:animate-none)').toBe('none'); // EPF:145
        await shot(page, '30-E-015', 'reduced_motion');
        await page.emulateMedia({ reducedMotion: null });
      });

      await test.step('[30-C-028] ⚑ "Xuất" while the model is loading must not run', async () => {
        // UEP:397-400,611,668-677: with floors known from elsewhere the button is there and throws "Chưa có mô hình để xuất."
        if ((await exportButton(page).count()) > 0 && (await exportButton(page).isEnabled())) await exportButton(page).click();
        await nextFrames(page);
        await expect.soft(page.getByText('Chưa có mô hình để xuất.', { exact: false }), 'no failure banner from a click during loading').toHaveCount(0);
        await shot(page, '30-C-028', 'export_while_loading');
        loading?.release();
        await expect(blockedFormat(page, '.pdf')).toContainText(/\d[\d.]* trang/u); // the numbers replace the skeleton
        await loading?.stop();
      });

      await test.step('[30-B-008] #24 answers 500: gate alert with retry, then the panel', async () => {
        const hold = await holdRoute(page, projectRe(project.id), 'fail');
        await page.goto(exportUrl, { waitUntil: 'commit' });
        const alert = page.getByRole('alert');
        await expect.soft(alert).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS }); // PSG:77-92
        await expect.soft(formatGroup(page)).toHaveCount(0);
        await shot(page, '30-B-008', 'gate_error_project');
        hold.release();
        await alert.getByRole('button').first().click(); // retry refetches #24 once
        await expect.soft(formatGroup(page)).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
        await hold.stop();
      });

      await test.step('[30-B-009] N15 answers 500 with an empty store: gate alert, no half panel', async () => {
        const hold = await holdRoute(page, spatialRe(project.id), 'fail');
        await page.goto(exportUrl, { waitUntil: 'commit' }); // a new document: the store is empty
        await expect.soft(page.getByRole('alert')).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS }); // PSG:19-23,77-92
        await expect.soft(formatGroup(page)).toHaveCount(0);
        await shot(page, '30-B-009', 'gate_error_spatial');
        hold.release();
        await hold.stop();
      });

      await test.step('[30-G-007] rule-config answers 500: the panel still renders and exports', async () => {
        const hold = await holdRoute(page, ruleConfigRe(project.id), 'fail');
        await openExport(page, project.id);
        await expect.poll(() => hold.served(), { message: 'the N21 read hit the 500' }).toBeGreaterThanOrEqual(1);
        await expect.soft(formatGroup(page)).toBeVisible(); // useProjectSpatial.ts:71-78 falls back to the default rule config
        await selectFormat(page, '.json');
        const download = await downloadVia(page, () => exportButton(page).click());
        expect.soft(download.suggestedFilename()).toMatch(exportNameRe(fileSlug(project.name), 'json'));
        await expect.soft(page.getByRole('alert'), 'no crash screen').toHaveCount(0);
        await shot(page, '30-G-007', 'rule_config_500');
        hold.release();
        await hold.stop();
      });
    });
  });
});
