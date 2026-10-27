/**
 * Phase 4 — SCR-14 scale calibration, EDGE layer, real stack: nine sequential user flows (QA-04c P6, `flow-plan.md`
 * "phase04_scale_edge.spec.ts"). One `test()` per flow, one `test.step('[<row id>] …')` per catalog row in the planned order;
 * `H` rows (first step, open / seed) use a hard `expect`, the rest `expect.soft`. Every step captures `E04_<row id>_<slug>.png`.
 * The mocked-response flow lives in `phase04_scale_mocked_edge.spec.ts`, the four-width states in `phase04_scale_ui.spec.ts`.
 *
 * Sources (FE `F:/App/AppFront/src`, this branch): SC src/screens/pipeline/ScaleCalibration/ScaleCalibration.tsx ·
 * SCV …Canvas.tsx · SCP …Panel.tsx · SMR …MethodReference.tsx · SMD …MethodDimension.tsx · USC useScaleCalibration.ts ·
 * SCG scaleCalibrationGateway.ts · SB src/components/shell/StatusBar.tsx · SLS src/lib/autosave/spatialLayerSave.ts ·
 * UAS src/hooks/useAutosave.ts · shortcutRegistry src/lib/input/shortcutRegistry.ts · parse src/domain/units/parse.ts.
 * Gestures: the reference line is drawn with real mouse drags on the canvas frame; r (mm/px) is read back from the
 * "Phép tính ra tỷ lệ" panel, never recomputed from a mouse position the browser rounded.
 *
 * ## Seeds and users
 * Every drawing project is owned by the file's pool admin (`poolUser(admin, 'admin', 'p04-scale')`, own `drawings_init`
 * bucket) and signed in once per flow in its own browser context. D1 (env drawing after a finished fake-ML run: warped,
 * provisional scale 10,035 mm/px) is built ONCE per file worker in `beforeAll` for the read-only flows FL-14-01..04;
 * the flows that write the scale (05, 06, 08) and the multi-floor flows (07, 09) build their own seeds and delete them
 * in `finally`. W2 = one #35 PUT from the API after the screen loaded (`staleWrite`).
 *
 * ## Request budget per file run
 * - `POST /api/auth/login`: 2 (beforeAll owner) + 1 per flow session (9) + 1 per extra owner/session ≈ 14 (limit 120 / 60 s).
 * - Upload init (`drawings_init`, pool admin bucket): D1 shared 1, FL-14-05 1, FL-14-06 1, FL-14-07 5, FL-14-08 1, FL-14-09 1 = 10.
 * - `POST /api/projects` ≈ 11 (each deleted in `finally`); #35 PUTs = the applies the flows make (≈ 30); no mail, no account change.
 * - Pipeline runs: 10 (each ≈ 1 s on the fake ML; the seed waits for #8 `completed`).
 *
 * Pairing: BE tests for the scale write live in `phase04_qc_layers_api.spec.ts` "A04 · scale: …" (FL-A4-07).
 */
import { expect, test, type Locator, type Page, type Request, type Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { attachJson, captureEvidence } from './support/evidence';
import { closeSession, openSession, type Session } from './support/p03/P2';
import { spaNavigate } from './support/p03/P9';
import { createQcProject } from './support/layerSeed';
import {
  ERR,
  SCALE,
  btn,
  canvasOf,
  clearLine,
  computation,
  corruptPng,
  deleteSeededProject,
  dragLine,
  drawStandard,
  envDrawingPng,
  flush,
  frameBox,
  handleAt,
  handleEnd,
  handleStart,
  layerApi,
  lengthField,
  methodRadio,
  noticeOf,
  numberOf,
  openScale,
  panelOf,
  pathOf,
  pixelsOf,
  putRatio,
  putsSince,
  ratioLabel,
  readImageSize,
  readLevel,
  scopeRadio,
  seedDF,
  seedD1,
  seedFloors,
  sharedDrawingFloor,
  staleWrite,
  trackRequests,
  viewOf,
  writesSince,
  layerRe,
  type Sent,
} from './support/p04/P6';

/* ---------------------------------------------------------------- small helpers */

const shared = sharedDrawingFloor('14-shared');
const softExpect = expect.configure({ soft: true });

test.beforeAll(async () => {
  test.setTimeout(300_000);
  await shared.setup();
});

test.afterAll(async () => {
  await shared.teardown();
});

/** `test.step('[<row id>] <title>')`. */
const step = (id: string, title: string, body: () => Promise<void>): Promise<void> => test.step(`[${id}] ${title}`, body);

const evidence = (page: Page, id: string, slug: string, caption?: string): Promise<string> =>
  captureEvidence(page, `E04_${id}_${slug}.png`, caption === undefined ? {} : { caption });

const note = (description: string): void => {
  test.info().annotations.push({ type: 'note', description });
};

interface Flow {
  readonly s: Session;
  readonly page: Page;
  readonly sent: Sent[];
}

/** Signed-in browser context of the file's pool admin, request tracker attached before any `goto`. */
async function openFlow(browser: Parameters<typeof openSession>[0]): Promise<Flow> {
  const s = await openSession(browser, shared.owner().user);
  return { s, page: s.page, sent: trackRequests(s.page) };
}

/** Ratio r = `length` mm over the displayed denominator, as the screen computes it (±0,2 % of display rounding). */
const expectedRatio = (length: number, den: number): number => length / den;

const approx = (actual: number, expected: number, relative = 0.01): boolean => Math.abs(actual - expected) <= Math.abs(expected) * relative;

const shortcutItems = (page: Page): Locator => page.getByRole('list', { name: SCALE.shortcuts, exact: true }).getByRole('listitem');
const statusBar = (page: Page): Locator => page.getByRole('status', { name: SCALE.statusBar, exact: true });
const errorText = (page: Page): Locator => page.getByText(SCALE.realInvalid, { exact: true });
const incomplete = (page: Page): Locator => page.getByText(SCALE.incomplete, { exact: true });
const applyDisabled = (page: Page): Locator => btn(page, SCALE.apply);

/** Types `text` into "Chiều dài thật" and returns the three computation labels. */
async function typeLength(page: Page, text: string): Promise<{ numerator: string; denominator: string; result: string }> {
  await lengthField(page).fill(text);
  await flush(page);
  return computation(page);
}

/* ================================================================= flows on the shared D1 (read-only) */

test.describe('E04 SCR-14 scale calibration — real stack (QA-04c P6)', () => {
  test('SCR-14 · FL-14-01 · real default and reference-line gestures', async ({ browser }) => {
    test.setTimeout(240_000);
    const { s, page } = await openFlow(browser);
    const floor = shared.floor();
    const { w } = shared.size();
    try {
      await step('14-E-001', 'names: screen, canvas frame, panel, notice and the canvas group are named regions', async () => {
        await openScale(page, floor.projectId, floor.floorId);
        // SC:66-68, SCP:41-42, SCV:69; the warped notice region exists on the real default (no OCR, warped).
        await expect(page.getByRole('region', { name: SCALE.screen, exact: true })).toBeVisible();
        await expect(page.getByRole('region', { name: SCALE.canvasRegion, exact: true })).toBeVisible();
        await expect(panelOf(page)).toBeVisible();
        await expect(canvasOf(page)).toBeVisible();
        await expect.soft(noticeOf(page), 'warped notice region on the real default').toBeVisible();
        await expect.soft(page.getByRole('group', { name: SCALE.canvas, exact: true })).toHaveCount(1);
        await evidence(page, '14-E-001', 'names');
      });

      await step('14-B-025', 'real default: only the warped notice; no provisional banner on the scale screen itself (G4b-11)', async () => {
        await expect.soft(page.getByText(SCALE.provisional, { exact: true })).toHaveCount(0);
        await expect.soft(page.getByText(SCALE.warpedTitle, { exact: true })).toBeVisible();
        await evidence(page, '14-B-025', 'warped-only');
      });

      await step('14-B-026', 'status bar defaults: "X: 0,00", "Y: 0,00", ratio "—" · "—", save text from useAutosave', async () => {
        const bar = statusBar(page);
        await expect.soft(bar).toBeVisible();
        await expect.soft(bar).toContainText('X: 0,00');
        await expect.soft(bar).toContainText('Y: 0,00');
        await expect.soft(bar).toContainText(/—\s*·\s*—/u);
        await evidence(page, '14-B-026', 'status-defaults');
      });

      await step('14-A-005', '"Vẽ đường tham chiếu" is already selected (no OCR rows); clicking it is a no-op', async () => {
        await expect.soft(methodRadio(page, SCALE.reference)).toBeChecked();
        await expect.soft(methodRadio(page, SCALE.methodDimension)).toBeDisabled();
        await methodRadio(page, SCALE.reference).click();
        await expect.soft(methodRadio(page, SCALE.reference)).toBeChecked();
        await evidence(page, '14-A-005', 'reference-selected');
      });

      await step('14-B-013', 'method notice and the disabled dimension radio (no OCR source)', async () => {
        await expect.soft(page.getByText(SCALE.methodDisabledNotice, { exact: true })).toBeVisible();
        await expect.soft(methodRadio(page, SCALE.methodDimension)).toBeDisabled();
        await evidence(page, '14-B-013', 'method-notice');
      });

      await step('14-B-014', '"Chiều dài thật" hint when no OCR string is near the segment', async () => {
        await expect.soft(page.getByText(SCALE.realHint, { exact: true })).toBeVisible();
        await evidence(page, '14-B-014', 'real-length-hint');
      });

      await step('14-B-015', 'cross-checks: all three values missing -> one "not enough data" sentence instead of 3 rows (BUG-631)', async () => {
        const rows = page.getByRole('region', { name: SCALE.crossChecks, exact: true });
        // ScaleCalibrationPanel.tsx:227-229 swaps the three FieldRows for CROSS_CHECKS_UNAVAILABLE when every value is "—".
        await expect.soft(rows.getByText(/^Chưa đủ dữ liệu để kiểm chứng tỷ lệ/u)).toBeVisible();
        await expect.soft(rows.getByText('Độ dày tường điển hình', { exact: true })).toHaveCount(0);
        await evidence(page, '14-B-015', 'cross-checks');
      });

      await step('14-A-007', 'while dragging the live label follows the pointer; on release the canvas label goes, the panel keeps the length', async () => {
        const labels = page.getByText(/^[\d.,]+ px$/u); // the canvas label and the panel's step-1 length
        const box = await frameBox(page);
        await dragLine(page, [0.2, 0.5], [0.6, 0.5], { release: false });
        await expect.soft(labels, 'canvas label + panel step-1 length + computation denominator while dragging').toHaveCount(3); // SCV:314,416-424
        const before = await pixelsOf(page);
        await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5, { steps: 4 });
        await expect.poll(() => pixelsOf(page)).toBeGreaterThan(before);
        await evidence(page, '14-A-007', 'live-label');
        await page.mouse.up();
        await expect.soft(labels, 'canvas label gone after release, the panel keeps the length (step 1 + computation)').toHaveCount(2);
        await expect.soft(handleStart(page)).toBeVisible();
      });

      await step('14-A-009', 'a second drag replaces the first line (one line at a time)', async () => {
        const first = await handleAt(handleEnd(page));
        await dragLine(page, [0.3, 0.3], [0.6, 0.6]);
        await expect.soft(handleStart(page)).toHaveCount(1);
        await expect.soft(handleEnd(page)).toHaveCount(1);
        const second = await handleAt(handleEnd(page));
        expect.soft(Math.abs(second.y - first.y), 'the end handle moved to the new line').toBeGreaterThan(0.05);
        await evidence(page, '14-A-009', 'second-line');
      });

      // BUG-587 (BUG-LOG-P04.md:757, fixed in ScaleCalibrationCanvasControls.tsx ReferenceHandle / useScaleCalibration.ts:989):
      // pointer-down on a handle drags THAT end, the other end stays, the line is not restarted (SCV:71-74, 107-119).
      await step('14-A-010', 'pointer-down on an existing handle drags that end; the other end stays and the line is not restarted (BUG-587)', async () => {
        await lengthField(page).fill('5000');
        await expect.soft(applyDisabled(page)).toBeEnabled();
        const s0 = await handleAt(handleStart(page));
        const e0 = await handleAt(handleEnd(page));
        const before = await pixelsOf(page);
        const box = await handleStart(page).boundingBox();
        if (box === null) throw new Error('start handle has no box');
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 4 });
        await page.mouse.up();
        await flush(page);
        const s1 = await handleAt(handleStart(page));
        const e1 = await handleAt(handleEnd(page));
        expect.soft(s1.x, 'the grabbed start end followed the pointer').toBeGreaterThan(s0.x);
        expect.soft(e1.x, 'the other end did not move').toBeCloseTo(e0.x, 5);
        expect.soft(e1.y, 'the other end did not move').toBeCloseTo(e0.y, 5);
        expect.soft(await pixelsOf(page), 'the line was edited, not restarted at zero length').toBeGreaterThan(3);
        expect.soft(await pixelsOf(page), 'the line changed length').not.toBeCloseTo(before, 0);
        await expect.soft(applyDisabled(page)).toBeEnabled();
        await evidence(page, '14-A-010', 'handle-drags-end');
      });

      await step('14-A-013', 'Esc during a pointer drag cancels the line; Esc after release does nothing', async () => {
        await clearLine(page);
        await dragLine(page, [0.2, 0.4], [0.7, 0.4], { release: false });
        await expect(handleEnd(page)).toBeVisible();
        await page.keyboard.press('Escape');
        await expect.soft(handleEnd(page), 'line gone after Esc during the drag').toHaveCount(0);
        await page.mouse.up();
        await dragLine(page, [0.2, 0.4], [0.7, 0.4]);
        await page.keyboard.press('Escape');
        await expect.soft(handleEnd(page), 'line kept after Esc post-release').toBeVisible();
        await evidence(page, '14-A-013', 'escape');
      });

      await step('14-A-014', 'the pointer leaving the canvas mid-drag cancels the line', async () => {
        await clearLine(page);
        const box = await frameBox(page);
        await dragLine(page, [0.2, 0.4], [0.5, 0.4], { release: false });
        await page.mouse.move(box.x + box.width + 60, box.y + box.height * 0.4, { steps: 6 });
        await expect.soft(handleEnd(page), 'line gone once the pointer left the frame').toHaveCount(0);
        await evidence(page, '14-A-014', 'pointer-leaves');
        await page.mouse.up();
      });

      await step('14-A-017', 'holding Shift while dragging locks the line to 0/90/180/270°', async () => {
        await clearLine(page);
        await dragLine(page, [0.2, 0.3], [0.7, 0.36], { shift: true });
        const [a, b] = [await handleAt(handleStart(page)), await handleAt(handleEnd(page))];
        // Axis lock first, then the 50 mm grid: the end may sit up to half a grid step (25 mm / r px) off the start's row.
        const tolerance = (25 / (await readLevel(shared.owner().api, floor.projectId, floor.floorId)).scale! + 1) / shared.size().h;
        expect.soft(Math.abs(b.y - a.y), 'end on the start row (±grid)').toBeLessThanOrEqual(tolerance);
        await evidence(page, '14-A-017', 'shift-lock');
      });

      await step('14-C-024', 'Shift axis lock keeps the dragged length, snaps the angle', async () => {
        await clearLine(page);
        await dragLine(page, [0.2, 0.3], [0.7, 0.36]);
        const free = await pixelsOf(page);
        await clearLine(page);
        await dragLine(page, [0.2, 0.3], [0.7, 0.36], { shift: true });
        const locked = await pixelsOf(page);
        expect.soft(Math.abs(locked - free), `locked ${String(locked)} px vs free ${String(free)} px`).toBeLessThanOrEqual(8);
        await evidence(page, '14-C-024', 'axis-lock-length');
      });

      await step('14-A-020', 'status bar shows the pointer position in image px and keeps the last one after the pointer leaves', async () => {
        const box = await frameBox(page);
        await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5, { steps: 3 });
        await flush(page);
        const bar = statusBar(page);
        await expect.poll(async () => numberOf((await bar.innerText()).split('Y:')[0] ?? '')).toBeGreaterThan(w * 0.45);
        await page.mouse.move(box.x + box.width + 80, box.y + box.height * 0.5, { steps: 3 });
        await flush(page);
        const left = await bar.innerText(); // the last in-frame move happened at the frame edge
        await page.mouse.move(box.x + box.width + 160, box.y + box.height * 0.5, { steps: 3 });
        await flush(page);
        expect.soft(await bar.innerText(), 'last position kept after the pointer left').toBe(left);
        expect.soft(numberOf(left.split('Y:')[0] ?? ''), 'the kept position is not reset to 0').toBeGreaterThan(w * 0.45);
        await evidence(page, '14-A-020', 'pointer-position');
      });
      note(`D1 size ${String(shared.size().w)}x${String(shared.size().h)}; ${String(s.log.length)} responses logged`);
    } finally {
      await closeSession(s);
    }
  });

  test('SCR-14 · FL-14-02 · "Chiều dài thật" parsing and the computation', async ({ browser }) => {
    test.setTimeout(240_000);
    const { s, page } = await openFlow(browser);
    const floor = shared.floor();
    try {
      await openScale(page, floor.projectId, floor.floorId);
      const { w, h } = shared.size();
      const edge = Math.max(w, h); // image drawn object-contain in a square frame: both axes scale by the long side (useScaleCalibration.ts imageFrameOf:349)

      await step('14-C-001', 'horizontal 20 %→80 % at 50 %: px = 0,6·edge; "5000" → r = 5000/px; computation "5.000 mm ÷ px = r mm/px"', async () => {
        await dragLine(page, [0.2, 0.5], [0.8, 0.5]);
        const c = await typeLength(page, '5000');
        expect(c.numerator).toBe('5.000 mm'); // USC:349-367,681-704,1590-1598
        const px = numberOf(c.denominator);
        expect.soft(approx(px, 0.6 * edge), `${c.denominator} ≈ 0,6·${String(edge)}`).toBe(true);
        expect.soft(approx(numberOf(c.result), expectedRatio(5000, px), 0.002), `${c.result} ≈ 5000 / ${String(px)}`).toBe(true);
        await evidence(page, '14-C-001', 'horizontal-5000');
      });

      await step('14-C-003', 'vertical line (x 50 %, y 20 %→80 %) uses the long side: px = 0,6·edge', async () => {
        await clearLine(page);
        await dragLine(page, [0.5, 0.2], [0.5, 0.8]);
        const c = await typeLength(page, '5000');
        expect.soft(approx(numberOf(c.denominator), 0.6 * edge), `${c.denominator} ≈ 0,6·${String(edge)}`).toBe(true); // USC:349-354
        await evidence(page, '14-C-003', 'vertical');
      });

      await step('14-C-004', 'diagonal: px = hypot(Δx·edge, Δy·edge)', async () => {
        await clearLine(page);
        await dragLine(page, [0.2, 0.2], [0.8, 0.8]);
        const c = await typeLength(page, '5000');
        expect.soft(approx(numberOf(c.denominator), Math.hypot(0.6 * edge, 0.6 * edge)), `${c.denominator} ≈ hypot`).toBe(true); // USC:365-367
        await evidence(page, '14-C-004', 'diagonal');
      });

      let reference = '';
      await step('14-C-005', 'units "5 m", "500 cm", "50 dm", "5000 mm", "5000" give the same r', async () => {
        await clearLine(page);
        await drawStandard(page, '5000');
        reference = (await computation(page)).result;
        for (const text of ['5 m', '500 cm', '50 dm', '5000 mm']) {
          const c = await typeLength(page, text);
          expect.soft(c.result, `"${text}" → same r as "5000"`).toBe(reference); // parse.ts:50-55,226-236
          expect.soft(c.numerator, `"${text}" numerator`).toBe('5.000 mm');
        }
        await evidence(page, '14-C-005', 'units');
      });

      await step('14-C-006', 'vi-VN comma: "4,8 m" = 4800 mm; "4800,5" = 4800,5 mm', async () => {
        const m = await typeLength(page, '4,8 m');
        expect.soft(m.numerator).toBe('4.800 mm');
        const px = await pixelsOf(page);
        const c = await typeLength(page, '4800,5');
        expect.soft(approx(numberOf(c.result), expectedRatio(4800.5, px), 0.002), `${c.result} ≈ 4800,5 / px`).toBe(true);
        await evidence(page, '14-C-006', 'comma');
      });

      await step('14-C-007', '"4.800" = 4800 mm but "4.8" = 4,8 mm (r 1000× smaller)', async () => {
        const dotted = await typeLength(page, '4.800');
        expect.soft(dotted.numerator).toBe('4.800 mm');
        const px = await pixelsOf(page);
        const small = await typeLength(page, '4.8');
        expect.soft(approx(numberOf(small.result), expectedRatio(4.8, px), 0.15), `${small.result} ≈ 4,8 / px`).toBe(true);
        expect.soft(numberOf(small.result) * 500, 'about 1000× smaller than "4.800"').toBeLessThan(numberOf(dotted.result));
        await evidence(page, '14-C-007', 'dot-grouping');
      });

      await step('14-C-008', 'spaces inside the number "4 800" = 4800; leading "+" accepted', async () => {
        expect.soft((await typeLength(page, '4 800')).numerator).toBe('4.800 mm');
        expect.soft((await typeLength(page, '+5000')).numerator).toBe('5.000 mm');
        await expect.soft(errorText(page)).toHaveCount(0);
        await evidence(page, '14-C-008', 'spaces-plus');
      });

      await step('14-C-009', '"0" → inline error, apply disabled, computation "0 mm ÷ … = —"', async () => {
        const c = await typeLength(page, '0');
        await expect.soft(errorText(page)).toBeVisible();
        await expect.soft(applyDisabled(page)).toBeDisabled();
        expect.soft(c.numerator).toBe('0 mm');
        expect.soft(c.result).toBe('—');
        await evidence(page, '14-C-009', 'zero');
      });

      await step('14-C-010', '"-5000" (and "−5000") → the same error', async () => {
        for (const text of ['-5000', '−5000']) {
          await typeLength(page, text);
          await expect.soft(errorText(page), `"${text}"`).toBeVisible(); // USC:1723-1726
          await expect.soft(applyDisabled(page)).toBeDisabled();
        }
        await evidence(page, '14-C-010', 'negative');
      });

      await step('14-C-011', '"abc" → error + "Còn thiếu một vế…", apply disabled', async () => {
        await typeLength(page, 'abc');
        await expect.soft(errorText(page)).toBeVisible();
        await expect.soft(incomplete(page)).toBeVisible(); // SCP:55,187-189
        await expect.soft(applyDisabled(page)).toBeDisabled();
        await evidence(page, '14-C-011', 'letters');
      });

      await step('14-C-012', 'unknown unit "5 km" / "5ft" → error', async () => {
        for (const text of ['5 km', '5ft']) {
          await typeLength(page, text);
          await expect.soft(errorText(page), `"${text}"`).toBeVisible();
        }
        await evidence(page, '14-C-012', 'unknown-unit');
      });

      await step('14-C-013', 'exponent "1e3" → error (no parseFloat)', async () => {
        await typeLength(page, '1e3');
        await expect.soft(errorText(page)).toBeVisible();
        await evidence(page, '14-C-013', 'exponent');
      });

      await step('14-C-014', '> 15 significant digits → error; exactly 15 accepted', async () => {
        await typeLength(page, '1234567890123456');
        await expect.soft(errorText(page), '16 digits').toBeVisible();
        await typeLength(page, '123456789012345');
        await expect.soft(errorText(page), '15 digits').toHaveCount(0);
        await evidence(page, '14-C-014', 'fifteen-digits');
      });

      await step('14-C-015', 'blank / spaces → no error, "Còn thiếu một vế…", apply disabled', async () => {
        for (const text of ['', '   ']) {
          await typeLength(page, text);
          await expect.soft(errorText(page), `"${text}"`).toHaveCount(0);
          await expect.soft(incomplete(page)).toBeVisible(); // USC:1724
          await expect.soft(applyDisabled(page)).toBeDisabled();
        }
        await evidence(page, '14-C-015', 'blank');
      });

      await step('14-C-020', 'numerator label rounds to whole mm while r uses the exact value ("4800,5" shows "4.801 mm")', async () => {
        const c = await typeLength(page, '4800,5');
        expect.soft(c.numerator).toBe('4.801 mm'); // USC:379-381,1592
        expect.soft(approx(numberOf(c.result), expectedRatio(4800.5, await pixelsOf(page)), 0.002)).toBe(true);
        await evidence(page, '14-C-020', 'numerator-rounding');
      });
      note(`reference r for 5000 mm: ${reference}`);
    } finally {
      await closeSession(s);
    }
  });

  test('SCR-14 · FL-14-03 · edge computations, nudges, grid snap, zoom and pan', async ({ browser }) => {
    test.setTimeout(240_000);
    const { s, page } = await openFlow(browser);
    const floor = shared.floor();
    const { w, h } = shared.size();
    try {
      await openScale(page, floor.projectId, floor.floorId);
      const r0 = (await readLevel(shared.owner().api, floor.projectId, floor.floorId)).scale ?? 1;

      await step('14-C-016', 'length typed before any line: numerator shown, denominator "—", step 1 active, apply disabled', async () => {
        const c = await typeLength(page, '5000');
        expect.soft(c.numerator, 'typed length shown as numerator before any line').toBe('5.000 mm'); // USC:1590-1598,1654-1655
        expect.soft(c.denominator).toBe('—');
        await expect.soft(applyDisabled(page)).toBeDisabled();
        await expect.soft(panelOf(page).locator('span', { hasText: /^1$/u }).first()).toHaveClass(/bg-accent/u);
        await evidence(page, '14-C-016', 'length-before-line');
      });

      await step('14-C-017', 'click without movement = 0 px line: "{L} ÷ 0 px = —", step 3 active, apply disabled WITH an explanation ⚑', async () => {
        const box = await frameBox(page);
        await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
        await flush(page);
        const c = await computation(page);
        expect.soft(c.denominator).toBe('0 px');
        expect.soft(c.result).toBe('—');
        await expect.soft(incomplete(page), 'not the "missing side" sentence: both sides exist').toHaveCount(0);
        await expect.soft(panelOf(page).locator('span', { hasText: /^3$/u }).first()).toHaveClass(/bg-accent/u);
        await expect.soft(applyDisabled(page)).toBeDisabled();
        // ⚑ expected: the screen says why apply is off for a 0 px line (open since QA-03d).
        await expect.soft(panelOf(page).getByRole('alert').or(panelOf(page).getByText(/đoạn.*(ngắn|dài hơn 0)|0 px|chưa kéo/iu).filter({ hasNotText: /^0 px$/u })).first(), 'an explanation for the 0 px line (alert + text both render: .first() avoids strict mode)').toBeVisible();
        await evidence(page, '14-C-017', 'zero-pixel-line');
      });

      await step('14-C-019', 'tiny ratio ("0,1" over 0,6·W ≈ 0,0001 mm/px) shows a readable value, not "0 mm/px" / "1:0" ⚑', async () => {
        await clearLine(page);
        await dragLine(page, [0.2, 0.5], [0.8, 0.5]);
        const c = await typeLength(page, '0,1');
        expect.soft(c.result, 'result label is not rounded to zero').not.toMatch(/^0 mm\/px$/u);
        await expect.soft(statusBar(page), 'ratio is not 1:0').not.toContainText('1:0');
        await evidence(page, '14-C-019', 'tiny-ratio');
      });

      await step('14-C-026', 'non-square drawing: the same drawn length gives the same mm along the long and the short side ⚑', async () => {
        await clearLine(page);
        await dragLine(page, [0.2, 0.5], [0.8, 0.5]);
        const horizontal = await pixelsOf(page);
        await clearLine(page);
        await dragLine(page, [0.5, 0.2], [0.5, 0.8]);
        const vertical = await pixelsOf(page);
        await attachJson('E04_14-C-026_non-square.json', { w, h, horizontalPx: horizontal, verticalPx: vertical });
        // Both lines cover 60 % of the frame on screen, i.e. the same drawn length; the image is w×h under object-contain.
        expect.soft(approx(vertical, horizontal, 0.03), `vertical ${String(vertical)} px vs horizontal ${String(horizontal)} px`).toBe(true);
        await evidence(page, '14-C-026', 'non-square');
      });

      await step('14-A-016', 'arrows nudge the line END 1 image px; Shift+arrow 10 px; the ratio recomputes', async () => {
        await clearLine(page);
        await drawStandard(page);
        await lengthField(page).blur(); // arrows are ignored while a text field has focus (shortcutRegistry.ts:504-508)
        const base = await pixelsOf(page);
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => pixelsOf(page)).toBeCloseTo(base + 1, 1);
        await page.keyboard.press('ArrowLeft');
        await expect.poll(() => pixelsOf(page)).toBeCloseTo(base, 1);
        await page.keyboard.press('Shift+ArrowRight');
        await expect.poll(() => pixelsOf(page)).toBeCloseTo(base + 10, 1);
        await page.keyboard.press('Shift+ArrowLeft');
        await expect.poll(() => pixelsOf(page)).toBeCloseTo(base, 1);
        const y0 = (await handleAt(handleEnd(page))).y;
        await page.keyboard.press('ArrowDown');
        await expect.poll(async () => (await handleAt(handleEnd(page))).y).toBeCloseTo(y0 + 1 / Math.max(w, h), 4); // handle ratio is of the square frame: 1 image px = 1/long side (same as line 311)
        await page.keyboard.press('ArrowUp');
        await evidence(page, '14-A-016', 'nudge');
      });

      await step('14-C-022', 'ArrowRight ×3 then Shift+ArrowRight → end +13 image px; r recomputed', async () => {
        await clearLine(page);
        await drawStandard(page);
        await lengthField(page).blur(); // arrows are ignored while a text field has focus (shortcutRegistry.ts:504-508)
        const base = await pixelsOf(page);
        const r1 = numberOf((await computation(page)).result);
        for (let i = 0; i < 3; i += 1) await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Shift+ArrowRight');
        await expect.poll(() => pixelsOf(page)).toBeCloseTo(base + 13, 1); // USC:288,957-978
        expect.soft(numberOf((await computation(page)).result), 'r recomputed').toBeLessThan(r1);
        await evidence(page, '14-C-022', 'nudge-13');
      });

      await step('14-C-023', 'nudging past the image edge is clamped (end stays inside 0..W px) ⚑', async () => {
        await clearLine(page);
        await dragLine(page, [0.5, 0.5], [1, 0.5]);
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        await flush(page);
        const end = await handleAt(handleEnd(page));
        expect.soft(end.x, 'end x is not beyond the image edge').toBeLessThanOrEqual(1);
        await evidence(page, '14-C-023', 'nudge-past-edge');
      });

      await step('14-C-025', 'with a working ratio (provisional on the real default) the end snaps to the 50 mm grid → px = a multiple of 50/r', async () => {
        await clearLine(page);
        // A typed length makes the line's own proposed ratio the working ratio (USC:815), so the grid would be in that ratio's mm: empty the field so the working ratio is the provisional one (r0).
        await lengthField(page).fill('');
        await dragLine(page, [0.2, 0.5], [0.7213, 0.4347]);
        const end = await handleAt(handleEnd(page));
        // Handle ratios are of the square frame (long side, image centred: USC imageFrameOf/toPixelPoint), not of w and h (BUG-723).
        const edge = Math.max(w, h);
        const mm = [(end.x * edge - (edge - w) / 2) * r0, (end.y * edge - (edge - h) / 2) * r0];
        for (const value of mm) {
          const off = Math.abs(value / 50 - Math.round(value / 50));
          expect.soft(off, `end ${value.toFixed(2)} mm on the 50 mm grid`).toBeLessThan(0.02); // USC:707,751-815
        }
        await evidence(page, '14-C-025', 'grid-snap');
      });

      await step('14-A-012', '`R` (focus off the text field) = "Đo lại": line and "Chiều dài thật" cleared', async () => {
        await clearLine(page);
        await drawStandard(page);
        await page.getByRole('heading', { name: 'Tỷ lệ bản vẽ', exact: true }).click(); // focus leaves the text field
        await page.keyboard.press('r');
        await expect.soft(handleEnd(page)).toHaveCount(0);
        await expect.soft(lengthField(page)).toHaveValue('');
        await evidence(page, '14-A-012', 'r-key');
      });

      await step('14-A-011', '"Đo lại" is disabled before a line; clears the line and the length', async () => {
        await expect.soft(btn(page, SCALE.remeasure)).toBeDisabled();
        await drawStandard(page);
        await expect.soft(btn(page, SCALE.remeasure)).toBeEnabled();
        await btn(page, SCALE.remeasure).click();
        await expect.soft(handleEnd(page)).toHaveCount(0);
        await expect.soft(lengthField(page)).toHaveValue('');
        await evidence(page, '14-A-011', 'remeasure');
      });

      await step('14-A-018', 'wheel zooms around the pointer; middle-button drag pans; neither draws', async () => {
        const box = await frameBox(page);
        const px = box.x + box.width * 0.7;
        const py = box.y + box.height * 0.3;
        const point = async (): Promise<{ x: number; y: number }> => {
          const v = await viewOf(page);
          return { x: (px - box.x - v.x) / (v.zoom * box.width), y: (py - box.y - v.y) / (v.zoom * box.height) };
        };
        const before = await point();
        await page.mouse.move(px, py);
        await page.mouse.wheel(0, -300);
        await expect.poll(async () => (await viewOf(page)).zoom).toBeGreaterThan(1);
        const after = await point();
        expect.soft(Math.abs(after.x - before.x) + Math.abs(after.y - before.y), 'the image point under the pointer stays put').toBeLessThan(0.03);
        // One wheel tick (x1.1) leaves only ~10 % of pan room and the pan is clamped to it: zoom in further so a 60 x 40 px drag has room.
        for (let i = 0; i < 6; i += 1) await page.mouse.wheel(0, -300);
        await expect.poll(async () => (await viewOf(page)).zoom).toBeGreaterThan(1.6);
        const v0 = await viewOf(page);
        await page.mouse.down({ button: 'middle' });
        await page.mouse.move(px + 60, py + 40, { steps: 5 });
        await page.mouse.up({ button: 'middle' });
        const v1 = await viewOf(page);
        expect.soft(Math.abs(v1.x - v0.x) + Math.abs(v1.y - v0.y), 'middle-button drag pans').toBeGreaterThan(10);
        await expect.soft(handleStart(page), 'neither draws a line').toHaveCount(0);
        await evidence(page, '14-A-018', 'wheel-zoom-pan');
      });

      await step('14-A-019', 'ZoomCluster ("Phóng to", "Thu nhỏ", "Vừa khung nhìn") and MiniMap are wired to this canvas; pressing them draws nothing ⚑', async () => {
        const z0 = (await viewOf(page)).zoom;
        await btn(page, 'Phóng to').click();
        await flush(page);
        expect.soft((await viewOf(page)).zoom, '"Phóng to" zooms the canvas').toBeGreaterThan(z0);
        await expect.soft(handleStart(page), 'pressing the zoom control draws no line').toHaveCount(0);
        await evidence(page, '14-A-019', 'zoom-cluster');
      });

      await step('14-E-013', 'wheel over the canvas zooms without scrolling the page (the wheel event is cancelled)', async () => {
        await page.evaluate(() => {
          (window as unknown as { __wheelPrevented: boolean[] }).__wheelPrevented = [];
          window.addEventListener('wheel', (e) => (window as unknown as { __wheelPrevented: boolean[] }).__wheelPrevented.push(e.defaultPrevented), { passive: true });
        });
        const box = await frameBox(page);
        await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
        await page.mouse.wheel(0, 120);
        await flush(page);
        const prevented = await page.evaluate(() => (window as unknown as { __wheelPrevented: boolean[] }).__wheelPrevented);
        expect.soft(prevented.at(-1), 'preventDefault took effect on the wheel event (SCV:270-277)').toBe(true);
        await evidence(page, '14-E-013', 'wheel-prevented');
      });

      await step('14-E-002', 'a keyboard-only user can create a reference line (WCAG 2.5.7) ⚑', async () => {
        await page.reload();
        await expect(canvasOf(page)).toBeVisible();
        await expect(btn(page, SCALE.remeasure)).toBeVisible();
        await canvasOf(page).focus().catch(() => undefined);
        for (const key of ['Enter', 'ArrowRight', 'ArrowDown']) await page.keyboard.press(key);
        await flush(page);
        await expect.soft(handleEnd(page), 'a line exists after keyboard input only').toHaveCount(1);
        await evidence(page, '14-E-002', 'keyboard-create');
      });

      await step('14-E-003', 'focusing the start handle and pressing arrows moves the START (the label promises it) ⚑', async () => {
        await dragLine(page, [0.3, 0.5], [0.7, 0.5]);
        const s0 = await handleAt(handleStart(page));
        const e0 = await handleAt(handleEnd(page));
        await handleStart(page).focus();
        await page.keyboard.press('ArrowRight');
        await flush(page);
        const s1 = await handleAt(handleStart(page));
        const e1 = await handleAt(handleEnd(page));
        await attachJson('E04_14-E-003_start-handle.json', { s0, s1, e0, e1 });
        expect.soft(s1.x, 'the start handle moved right').toBeGreaterThan(s0.x);
        expect.soft(e1.x, 'the end handle did not move').toBeCloseTo(e0.x, 5);
        await evidence(page, '14-E-003', 'start-handle-arrows');
      });
    } finally {
      await closeSession(s);
    }
  });

  test('SCR-14 · FL-14-04 · keyboard and a11y of the panel', async ({ browser }) => {
    test.setTimeout(240_000);
    const { s, page, sent } = await openFlow(browser);
    const floor = shared.floor();
    try {
      await openScale(page, floor.projectId, floor.floorId);

      await step('14-E-004', 'in "Chiều dài thật" R / arrows / Enter do not reach the canvas bindings; Esc still does', async () => {
        await drawStandard(page);
        const base = await pixelsOf(page);
        await lengthField(page).focus();
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Shift+ArrowRight');
        await page.keyboard.press('r');
        expect(await pixelsOf(page), 'arrows in the field do not nudge').toBeCloseTo(base, 1);
        await expect.soft(handleEnd(page), '"r" typed in the field does not remeasure').toBeVisible();
        await expect.soft(lengthField(page)).toHaveValue('5000r');
        await lengthField(page).fill('5000');
        await page.keyboard.press('Enter');
        await expect.soft(handleEnd(page), 'Enter only confirms').toBeVisible();
        // Esc still reaches the global binding: cancel a drag that is in progress while the field has focus (shortcutRegistry.ts:506).
        await clearLine(page);
        await dragLine(page, [0.2, 0.4], [0.6, 0.4], { release: false });
        await lengthField(page).focus();
        await page.keyboard.press('Escape');
        await expect.soft(handleEnd(page), 'Esc cancelled the drag from inside the field').toHaveCount(0);
        await page.mouse.up();
        await evidence(page, '14-E-004', 'field-keys');
      });

      await step('14-E-005', '"Phím tắt" list: key caps and descriptions', async () => {
        const items = shortcutItems(page);
        await expect.soft(items).toHaveCount(6);
        const texts = (await items.allInnerTexts()).map((t) => t.replace(/\s+/gu, ' ').trim());
        for (const expected of [
          'Esc Huỷ đoạn đang kéo',
          'R Đo lại',
          'Enter Xác nhận',
          '← Nhích đầu đoạn một pixel',
          'Shift + ← Nhích đầu đoạn mười pixel',
          'Shift Khoá đoạn theo trục',
        ]) {
          expect.soft(texts, expected).toContain(expected);
        }
        await evidence(page, '14-E-005', 'shortcut-list');
      });

      await step('14-E-006', 'method radiogroup: arrow onto the disabled "Từ chuỗi kích thước" changes nothing', async () => {
        await clearLine(page);
        await methodRadio(page, SCALE.reference).focus();
        await page.keyboard.press('ArrowLeft');
        await expect.soft(methodRadio(page, SCALE.reference)).toBeChecked();
        await expect.soft(methodRadio(page, SCALE.methodDimension)).not.toBeChecked();
        await evidence(page, '14-E-006', 'method-arrows');
      });

      await step('14-E-007', 'scope radiogroup "Phạm vi áp tỷ lệ" by arrows; aria-checked follows', async () => {
        await scopeRadio(page, SCALE.thisFloor).focus();
        await page.keyboard.press('ArrowLeft');
        await expect.soft(scopeRadio(page, SCALE.allFloors)).toBeChecked(); // SCP:61,227-232
        await expect.soft(scopeRadio(page, SCALE.thisFloor)).not.toBeChecked();
        await page.keyboard.press('ArrowRight');
        await expect.soft(scopeRadio(page, SCALE.thisFloor)).toBeChecked();
        await evidence(page, '14-E-007', 'scope-arrows');
      });

      await step('14-E-009', '"Chiều dài thật": label, suffix "mm", placeholder "4800", inputMode decimal, error tied to the input', async () => {
        const field = lengthField(page);
        await expect.soft(field).toHaveAttribute('placeholder', '4800'); // USC realLengthPlaceholder
        await expect.soft(field).toHaveAttribute('inputmode', 'decimal'); // SMR:117
        await expect.soft(panelOf(page).getByText('mm', { exact: true })).toBeVisible(); // SMR:130 suffix
        await field.fill('abc');
        await expect.soft(errorText(page)).toBeVisible();
        const described = await field.evaluate((el) => {
          const ids = (el.getAttribute('aria-describedby') ?? '').split(/\s+/u).filter(Boolean);
          return { invalid: el.getAttribute('aria-invalid'), text: ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' ') };
        });
        expect.soft(described.invalid, 'aria-invalid').toBe('true');
        expect.soft(described.text, 'the error is the input description').toContain(SCALE.realInvalid);
        await field.fill('');
        await evidence(page, '14-E-009', 'field-a11y');
      });

      await step('14-E-015', 'Enter on a focused button activates it ("Đo lại", "Thu gọn bảng", "Tải lại ảnh", "Quay lại bước tiền xử lý") ⚑', async () => {
        await drawStandard(page);
        await btn(page, SCALE.remeasure).focus();
        await page.keyboard.press('Enter');
        await expect.soft(handleEnd(page), '"Đo lại" activated by Enter').toHaveCount(0);

        await btn(page, SCALE.collapse).focus();
        await page.keyboard.press('Enter');
        await expect.soft(btn(page, SCALE.expand), '"Thu gọn bảng" activated by Enter').toBeVisible();
        if (await btn(page, SCALE.expand).isVisible()) await btn(page, SCALE.expand).click();

        const reads = (): number => sent.filter((r) => r.method === 'GET' && /\/quality$/u.test(r.path)).length;
        const before = reads();
        await btn(page, SCALE.retry).focus();
        await page.keyboard.press('Enter');
        await flush(page);
        expect.soft(reads(), '"Tải lại ảnh" activated by Enter (a new #30 read)').toBeGreaterThan(before);

        await btn(page, SCALE.backToPreprocessing).focus();
        await page.keyboard.press('Enter');
        await softExpect.poll(() => pathOf(page), '"Quay lại bước tiền xử lý" activated by Enter').toBe(ROUTES.project.quality(floor.projectId));
        await evidence(page, '14-E-015', 'enter-on-buttons');
        await openScale(page, floor.projectId, floor.floorId);
      });

      await step('14-E-016', 'ArrowLeft/Right on the scope / method radios move only the radio, not the reference-line end ⚑', async () => {
        await drawStandard(page);
        const base = await pixelsOf(page);
        await scopeRadio(page, SCALE.thisFloor).focus();
        await page.keyboard.press('ArrowLeft');
        await flush(page);
        expect.soft(await pixelsOf(page), 'the line end did not move with the radio arrow').toBeCloseTo(base, 1);
        await scopeRadio(page, SCALE.thisFloor).click();
        await methodRadio(page, SCALE.reference).focus();
        await page.keyboard.press('ArrowRight');
        await flush(page);
        expect.soft(await pixelsOf(page), 'nor with the method radio arrow').toBeCloseTo(base, 1);
        await evidence(page, '14-E-016', 'radio-arrows-nudge');
      });

      await step('14-E-017', 'status bar: role status "Thanh trạng thái", save text aria-live polite, coordinates "Toạ độ X: …" / "Toạ độ Y: …"', async () => {
        const bar = statusBar(page);
        await expect.soft(bar).toBeVisible(); // SB:32-56
        await expect.soft(bar.locator('[aria-live="polite"]')).toHaveCount(1);
        await expect.soft(bar.locator('[aria-label^="Toạ độ X: "]')).toHaveCount(1);
        await expect.soft(bar.locator('[aria-label^="Toạ độ Y: "]')).toHaveCount(1);
        await evidence(page, '14-E-017', 'status-bar-a11y');
      });

      await step('14-E-011', 'reduced motion: "Tỷ lệ hiện tại" jumps to the value, viewport moves are instant', async () => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.reload();
        await expect(canvasOf(page)).toBeVisible();
        await expect(btn(page, SCALE.remeasure)).toBeVisible();
        await dragLine(page, [0.2, 0.5], [0.8, 0.5]);
        await lengthField(page).fill('5000');
        const result = (await computation(page)).result;
        const current = panelOf(page).getByRole('region', { name: SCALE.current, exact: true }).locator('p').first();
        await expect.soft(current, 'the current scale equals the result at once').toHaveText(result, { timeout: 500 }); // USC:1552-1557
        const transition = await canvasOf(page).locator(':scope > div.origin-top-left').evaluate((el) => getComputedStyle(el).transitionDuration);
        expect.soft(transition, 'viewport transition is instant under reduced motion (SCV:279)').toMatch(/^0(\.0+)?m?s(, 0(\.0+)?m?s)*$/u);
        await evidence(page, '14-E-011', 'reduced-motion');
      });

      await step('14-A-015', 'Enter in "Chiều dài thật" only confirms the line (no PUT, no apply)', async () => {
        const mark = sent.length;
        await lengthField(page).focus();
        await page.keyboard.press('Enter');
        await flush(page);
        expect.soft(putsSince(sent, mark, floor.projectId, floor.floorId), 'no PUT').toHaveLength(0);
        expect.soft(writesSince(sent, mark), 'no write at all').toEqual([]);
        await evidence(page, '14-A-015', 'enter-confirms');
      });
    } finally {
      await closeSession(s);
    }
  });

  /* ============================================================= flows that write the scale (own seeds) */

  test('SCR-14 · FL-14-05 · apply to this floor, undo, Ctrl+Z, reload, same ratio again', async ({ browser }) => {
    test.setTimeout(300_000);
    const owner = shared.owner();
    const d1 = await seedD1(owner.api, '14-05');
    const { s, page, sent } = await openFlow(browser);
    const putOf = (): Sent[] => putsSince(sent, 0, d1.projectId, d1.floorId);
    const undoKey = process.platform === 'darwin' ? 'Meta+z' : 'Control+z';
    try {
      const before = await readLevel(owner.api, d1.projectId, d1.floorId);
      const r0 = before.scale ?? Number.NaN;
      const size = await readImageSize(owner.api, d1.projectId, d1.floorId);
      let r1 = Number.NaN;

      await step('14-C-036', 'scope default "Chỉ áp cho tầng này" is checked on load and after reload (UI state only)', async () => {
        await openScale(page, d1.projectId, d1.floorId);
        await expect(scopeRadio(page, SCALE.thisFloor)).toBeChecked(); // aria-checked
        await scopeRadio(page, SCALE.allFloors).click();
        await expect.soft(scopeRadio(page, SCALE.allFloors)).toBeChecked();
        await page.reload();
        await expect(canvasOf(page)).toBeVisible();
        await expect(btn(page, SCALE.remeasure)).toBeVisible();
        await expect.soft(scopeRadio(page, SCALE.thisFloor)).toBeChecked();
        await evidence(page, '14-C-036', 'scope-default');
      });

      // The PUT is held (the real request is continued once released) so the "applying" state can be shown and the
      // double click counted at the wire.
      let release = (): void => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let seen = 0;
      await page.route(`**/api/projects/${d1.projectId}/floors/${d1.floorId}/spatial/layer`, async (route: Route) => {
        if (route.request().method() !== 'PUT') return route.fallback();
        seen += 1;
        await gate;
        return route.continue();
      });

      await step('14-B-016', 'applying: the button reads "Đang lưu tỷ lệ…" with a spinner (a double click sent while it is held)', async () => {
        await drawStandard(page);
        await applyDisabled(page).dblclick();
        await expect.poll(() => seen).toBeGreaterThanOrEqual(1);
        await expect.soft(btn(page, SCALE.applying)).toBeVisible(); // SCP:60,233-241
        await expect.soft(btn(page, SCALE.applying)).toBeDisabled();
        await evidence(page, '14-B-016', 'applying');
      });

      await step('14-A-025', 'a double click on "Xác nhận tỷ lệ" sends one PUT', async () => {
        release();
        await expect(page.getByText(SCALE.successTitle, { exact: true })).toBeVisible();
        await btn(page, SCALE.undo).hover(); // a hovered toast is held: the undo steps below still have their button
        expect.soft(seen, 'PUTs that reached the network').toBe(1);
        expect.soft(putOf(), 'PUTs the page sent').toHaveLength(1);
        await evidence(page, '14-A-025', 'one-put');
      });

      await step('14-C-002', 'the PUT body carries r unrounded; the BE stores HALF_UP 6 places; the read-back matches', async () => {
        r1 = putRatio(putOf()[0]);
        const px = (await pixelsOf(page)) || 1;
        expect.soft(approx(r1, expectedRatio(5000, px), 0.002), `r ${String(r1)} ≈ 5000 / ${String(px)}`).toBe(true);
        expect.soft(Number(r1.toFixed(6)) !== r1, 'the body number is not already rounded to 6 places').toBe(true);
        const stored = await readLevel(owner.api, d1.projectId, d1.floorId);
        expect.soft(stored.scale, 'stored scale = r rounded HALF_UP to 6 places').toBeCloseTo(r1, 6);
        await attachJson('E04_14-C-002_put-body.json', { sent: r1, stored: stored.scale, revisionBefore: before.revision, revisionAfter: stored.revision });
        await evidence(page, '14-C-002', 'put-ratio');
      });

      await step('14-G-008', 'GET …/spatial/layer (N16) 200 → levelId + scaleStatus into the store; the PUT uses that level', async () => {
        const reads = s.log.filter((e) => e.method === 'GET' && layerRe(d1.projectId, d1.floorId).test(e.path));
        expect.soft(reads.map((e) => e.status)).toContain(200); // UFL:120-149, USC:591-596
        expect.soft(s.log.filter((e) => e.method === 'PUT' && layerRe(d1.projectId, d1.floorId).test(e.path)).map((e) => e.status)).toEqual([200]);
        await evidence(page, '14-G-008', 'n16-read');
      });

      await step('14-B-012', 'after apply on a provisional floor the "Tỷ lệ tạm" banner goes', async () => {
        await expect.soft(page.getByText(SCALE.provisional, { exact: true })).toHaveCount(0);
        await evidence(page, '14-B-012', 'banner-gone');
      });

      await step('14-B-004', 'success: verified notice + badge "đã duyệt" in the panel header', async () => {
        await expect.soft(noticeOf(page).getByText(SCALE.successTitle, { exact: true })).toBeVisible();
        await expect.soft(noticeOf(page).getByText(SCALE.successBody, { exact: true })).toBeVisible();
        await expect.soft(panelOf(page).getByText(SCALE.badge, { exact: true })).toBeVisible();
        await evidence(page, '14-B-004', 'success');
      });

      await step('14-B-027', 'status bar after apply: "1:N · {r} mm/px", and the save text changes from idle', async () => {
        const bar = statusBar(page);
        await expect.soft(bar).toContainText(ratioLabel(r1)); // USC:1566-1572,1758
        await expect.soft(bar).toContainText(/1:\d+/u);
        await expect.soft(bar).toContainText(/Đã lưu/u);
        await evidence(page, '14-B-027', 'status-after-apply');
      });

      await step('14-C-021', 'derived line + status bar: "1 pixel = {r} mm · bản vẽ ở tỷ lệ khoảng 1:{round(r·min(W,H)/297)}"', async () => {
        const text = await panelOf(page).getByText(/^1 pixel = /u).innerText();
        const n = Number(/1:(\d+)$/u.exec(text)?.[1] ?? Number.NaN);
        expect.soft(text).toMatch(/^1 pixel = [\d.,]+ mm · bản vẽ ở tỷ lệ khoảng 1:\d+$/u); // USC:252-254,1563-1572
        expect.soft(Math.abs(n - Math.round((r1 * Math.min(size.w, size.h)) / 297)), `1:${String(n)}`).toBeLessThanOrEqual(1);
        await evidence(page, '14-C-021', 'derived-line');
      });

      await step('14-E-010', 'the notice is an alert inside region "Trạng thái của màn hiệu chỉnh tỷ lệ", announced on apply', async () => {
        await expect.soft(noticeOf(page).getByRole('alert')).toBeVisible(); // SC:68,193-221
        await evidence(page, '14-E-010', 'notice-alert');
      });

      await step('14-A-026', 'the undo toast ("Xác nhận tỷ lệ" + "Hoàn tác") reverts the Level and PUTs the previous ratio', async () => {
        await btn(page, SCALE.undo).click();
        await expect.poll(() => putOf().length).toBe(2);
        expect.soft(putRatio(putOf()[1]), 'second PUT carries the old ratio').toBeCloseTo(r0, 5);
        await evidence(page, '14-A-026', 'undo-toast');
      });

      await step('14-A-027', 'undo back to the pipeline\'s provisional ratio says so', async () => {
        await expect.soft(panelOf(page).getByText(SCALE.undoProvisional, { exact: true })).toBeVisible();
        await evidence(page, '14-A-027', 'undo-provisional');
      });

      await step('14-A-028', 'Ctrl+Z after apply = the toast undo; after leaving and returning to the screen it still sends the PUT', async () => {
        // BUG-724 evidence: every API request with its time, from the re-apply to 3 s after Ctrl+Z (N15 refetch race?).
        const t0 = Date.now();
        const traffic: string[] = [];
        const logRequest = (request: Request): void => {
          const path = new URL(request.url()).pathname;
          if (path.startsWith('/api/')) traffic.push(`${String(Date.now() - t0)}ms ${request.method()} ${path}`);
        };
        page.on('request', logRequest);
        // The apply commits to the store only once the server accepted it (A5, useScaleCalibration onApply): wait for the
        // PUT's answer and the new ratio on screen. BUG-724 diagnostic: Ctrl+Z went out 18 ms after the PUT was SENT, before
        // its answer, so it undid an older step and nothing was sent (vitest, which awaits the answer, was always green).
        const reapplied = page.waitForResponse(
          (r) => r.request().method() === 'PUT' && /\/spatial\/layer$/u.test(new URL(r.url()).pathname),
          { timeout: 15_000 },
        );
        await applyDisabled(page).click();
        expect((await reapplied).status(), 're-apply accepted').toBe(200);
        await expect.poll(() => putOf().length).toBe(3);
        await expect(statusBar(page)).toContainText(ratioLabel(r1));
        await page.mouse.move(2, 2); // off the toast
        // The shortcut registry ignores Mod+Z while a text field has focus (shortcutRegistry.ts isTyping); the real-length input kept focus from the earlier steps. A user clicks away first: leave the field, then press.
        const focusedBefore = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          const tag = el === null ? 'none' : `${el.tagName}${el.getAttribute('type') === null ? '' : `[${el.getAttribute('type') ?? ''}]`}`;
          el?.blur();
          return tag;
        });
        // BUG-724 evidence: did Ctrl+Z revert the ratio on screen (save path) or not at all (key/history path)?
        const barBefore = await statusBar(page).innerText();
        const pressedAt = Date.now() - t0;
        await page.keyboard.press(undoKey);
        const bars: string[] = [];
        for (const wait of [500, 1_000, 1_500]) {
          await page.waitForTimeout(wait); // fixed-wait-ok: evidence samples at 0.5 / 1.5 / 3 s after Ctrl+Z
          bars.push(`${String(Date.now() - t0)}ms ${(await statusBar(page).innerText()).replace(/\s+/gu, ' ')}`);
        }
        page.off('request', logRequest);
        await attachJson('E04_14-A-028_ctrl-z.json', { focusedBefore, barBefore, pressedAt, bars, traffic, puts: putOf().length });
        await expect.poll(() => putOf().length, `Ctrl+Z PUT (focus was ${focusedBefore})`).toBe(4);
        expect.soft(putRatio(putOf()[3])).toBeCloseTo(r0, 5);
        // Same A5 race before leaving: the apply must be committed (server answered) before the hop and the Ctrl+Z after it.
        const appliedAgain = page.waitForResponse(
          (r) => r.request().method() === 'PUT' && /\/spatial\/layer$/u.test(new URL(r.url()).pathname),
          { timeout: 15_000 },
        );
        await applyDisabled(page).click();
        expect((await appliedAgain).status(), 'apply before leaving accepted').toBe(200);
        await expect.poll(() => putOf().length).toBe(5);
        await expect(statusBar(page)).toContainText(ratioLabel(r1));
        const scalePath = new URL(page.url()).pathname;
        await spaNavigate(page, ROUTES.project.quality(d1.projectId));
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.quality(d1.projectId));
        await spaNavigate(page, scalePath);
        await expect(canvasOf(page)).toBeVisible();
        await page.keyboard.press(undoKey);
        await expect.poll(() => putOf().length, 'Ctrl+Z after returning').toBe(6);
        expect.soft(putRatio(putOf()[5])).toBeCloseTo(r0, 5);
        await evidence(page, '14-A-028', 'ctrl-z');
      });

      await step('14-A-029', 'reload after apply: "Tỷ lệ hiện tại" shows the stored ratio, the line is gone (UI state only)', async () => {
        const stored = (await readLevel(owner.api, d1.projectId, d1.floorId)).scale ?? Number.NaN;
        await page.reload();
        await expect(canvasOf(page)).toBeVisible();
        await expect(btn(page, SCALE.remeasure)).toBeVisible();
        const current = panelOf(page).getByRole('region', { name: SCALE.current, exact: true }).locator('p').first();
        await expect.soft(current).toHaveText(ratioLabel(stored));
        await expect.soft(handleStart(page)).toHaveCount(0);
        await evidence(page, '14-A-029', 'reload-stored');
      });

      await step('14-C-030', 're-applying the same ratio: the BE does not bump the revision, the UI still says success', async () => {
        await drawStandard(page);
        await applyDisabled(page).click();
        await expect(page.getByText(SCALE.successTitle, { exact: true })).toBeVisible();
        const first = await readLevel(owner.api, d1.projectId, d1.floorId);
        const putsBefore = putOf().length;
        await applyDisabled(page).click();
        await expect.poll(() => putOf().length).toBe(putsBefore + 1);
        await expect.soft(page.getByText(SCALE.successTitle, { exact: true })).toBeVisible();
        const second = await readLevel(owner.api, d1.projectId, d1.floorId);
        expect.soft(second.revision, 'revision after the identical second apply').toBe(first.revision);
        await evidence(page, '14-C-030', 'same-ratio');
      });
    } finally {
      await closeSession(s);
      await deleteSeededProject(owner.api, d1.projectId);
    }
  });

  test('SCR-14 · FL-14-06 · warped notice, panel collapse, back from quality, warped then applied', async ({ browser }) => {
    test.setTimeout(300_000);
    const owner = shared.owner();
    const d1 = await seedD1(owner.api, '14-06');
    const { s, page, sent } = await openFlow(browser);
    try {
      await step('14-B-007', 'error: warped drawing (frame not found): title, warping copy, no "Mã lỗi", back + retry; the canvas stays usable', async () => {
        await openScale(page, d1.projectId, d1.floorId);
        const notice = noticeOf(page);
        await expect(notice.getByText(SCALE.warpedTitle, { exact: true })).toBeVisible();
        await expect.soft(notice.getByText(SCALE.warpedBody, { exact: true })).toBeVisible();
        await expect.soft(notice).not.toContainText('Mã lỗi');
        await expect.soft(btn(notice, SCALE.backToPreprocessing)).toBeVisible();
        // G3-31: reloading cannot make the frame appear, so the warped notice has no retry button.
        await expect.soft(btn(notice, SCALE.retry)).toHaveCount(0);
        await drawStandard(page);
        await expect.soft(handleEnd(page), 'a line can still be drawn on a warped drawing').toBeVisible();
        await evidence(page, '14-B-007', 'warped-error');
      });

      await step('14-B-011', 'provisional scale (pipeline `unresolved`): no banner (G4b-11); "Tỷ lệ hiện tại" still "Chưa có" with the unknown derived line', async () => {
        await clearLine(page);
        // G4b-11: the "Tỷ lệ tạm" banner is gone from the scale screen (same as 14-B-025).
        await expect.soft(page.getByText(SCALE.provisional, { exact: true })).toHaveCount(0);
        await expect.soft(panelOf(page).getByText('Chưa có', { exact: true })).toBeVisible();
        // G3-31: the derived line names the provisional ratio the wall screen already uses.
        await expect.soft(panelOf(page).getByText(/^đang dùng tạm .+ mm\/px do máy ước, chưa được duyệt$/u)).toBeVisible();
        await evidence(page, '14-B-011', 'provisional');
      });

      await step('14-A-031', 'warped notice "Quay lại bước tiền xử lý" → the quality route', async () => {
        await drawStandard(page);
        await btn(noticeOf(page), SCALE.backToPreprocessing).click();
        await softExpect.poll(() => pathOf(page)).toBe(ROUTES.project.quality(d1.projectId));
        // BUG-343: the URL changes before the gate is drawn; shoot only once its breadcrumb is on screen.
        await expect(page.getByText('Kiểm tra chất lượng đầu vào', { exact: true }).first()).toBeVisible({ timeout: 45_000 }); // vi.json:717
        await evidence(page, '14-A-031', 'back-to-quality');
      });

      await step('14-A-034', 'Back after "Quay lại bước tiền xử lý" remounts the scale screen: line and length gone, no request but the reads', async () => {
        const mark = sent.length;
        await page.goBack();
        await expect(canvasOf(page)).toBeVisible();
        await expect(btn(page, SCALE.remeasure)).toBeVisible();
        await expect.soft(handleStart(page)).toHaveCount(0); // USC:611-613 (UI state only)
        await expect.soft(lengthField(page)).toHaveValue('');
        expect.soft(writesSince(sent, mark), 'only reads after Back').toEqual([]);
        await evidence(page, '14-A-034', 'back-remount');
      });

      await step('14-A-033', 'warped notice "Tải lại ảnh" re-reads the drawing; the notice stays', async () => {
        const reads = (): number => sent.filter((r) => r.method === 'GET' && /\/quality$/u.test(r.path)).length;
        const before = reads();
        await btn(noticeOf(page), SCALE.retry).click();
        await expect.poll(reads).toBeGreaterThan(before);
        await expect.soft(page.getByText(SCALE.warpedTitle, { exact: true })).toBeVisible();
        await evidence(page, '14-A-033', 'reload-image');
      });

      await step('14-A-032', '"Thu gọn bảng" / "Bung bảng" toggles the panel body, also in the error state (BUG-322)', async () => {
        await btn(page, SCALE.collapse).click();
        await expect.soft(btn(page, SCALE.expand)).toBeVisible(); // SCP:93-95, USC:1033-1035,1763
        await expect.soft(btn(page, SCALE.remeasure)).toHaveCount(0);
        if (await btn(page, SCALE.expand).isVisible()) await btn(page, SCALE.expand).click();
        await expect.soft(btn(page, SCALE.collapse)).toBeVisible();
        await expect.soft(btn(page, SCALE.remeasure)).toBeVisible();
        await evidence(page, '14-A-032', 'toggle-panel');
      });

      await step('14-B-010', 'collapsed: panel body hidden, the canvas gets wider, works in `error` too (BUG-322)', async () => {
        const wide = (await frameBox(page)).width;
        await btn(page, SCALE.collapse).click();
        await expect.soft(btn(page, SCALE.expand)).toBeVisible();
        await expect.soft(page.getByText(SCALE.warpedTitle, { exact: true }), 'the error notice stays').toBeVisible();
        const narrow = await expect.poll(async () => (await frameBox(page)).width).toBeGreaterThan(wide).then(() => 'wider', () => 'not wider');
        expect.soft(narrow, `canvas ${String(wide)} px before, ${String((await frameBox(page)).width)} px collapsed`).toBe('wider');
        await evidence(page, '14-B-010', 'collapsed');
      });

      await step('14-B-024', 'the collapsed panel also hides the scope and "Xác nhận tỷ lệ" (everything below the header)', async () => {
        await expect.soft(scopeRadio(page, SCALE.thisFloor)).toHaveCount(0); // SCP:98-249
        await expect.soft(applyDisabled(page)).toHaveCount(0);
        if (await btn(page, SCALE.expand).isVisible()) await btn(page, SCALE.expand).click();
        await evidence(page, '14-B-024', 'collapsed-footer');
      });

      await step('14-A-035', 'reload with a drawn line and a typed length: both gone, nothing written', async () => {
        await drawStandard(page);
        const mark = sent.length;
        await page.reload();
        await expect(canvasOf(page)).toBeVisible();
        await expect(btn(page, SCALE.remeasure)).toBeVisible();
        await expect.soft(handleStart(page)).toHaveCount(0);
        await expect.soft(lengthField(page)).toHaveValue('');
        expect.soft(writesSince(sent, mark), '0 PUT').toEqual([]);
        await evidence(page, '14-A-035', 'reload-clears');
      });

      await step('14-A-036', 'apply on the warped (frame-not-found) floor: the warped notice gives way to the success notice (BUG-567)', async () => {
        await drawStandard(page);
        await applyDisabled(page).click();
        await expect.soft(page.getByText(SCALE.successTitle, { exact: true })).toBeVisible();
        await expect.soft(page.getByText(SCALE.successBody, { exact: true })).toBeVisible();
        await expect.soft(page.getByText(SCALE.warpedTitle, { exact: true })).toHaveCount(0);
        await evidence(page, '14-A-036', 'warped-then-applied');
      });

      await step('14-A-037', 'after a successful apply the toggle shows `collapsed` and back; a failed later apply brings the failure back', async () => {
        await btn(page, SCALE.collapse).click();
        await expect.soft(btn(page, SCALE.expand)).toBeVisible();
        await expect.soft(page.getByText(SCALE.successTitle, { exact: true })).toHaveCount(0);
        if (await btn(page, SCALE.expand).isVisible()) await btn(page, SCALE.expand).click();
        await expect.soft(page.getByText(SCALE.successTitle, { exact: true }), 'success again after expanding').toBeVisible();
        await staleWrite(owner.api, d1);
        await lengthField(page).fill('4800');
        await applyDisabled(page).click();
        await expect.soft(panelOf(page).getByText(new RegExp(`^${SCALE.failed}`, 'u'))).toBeVisible();
        await expect.soft(page.getByText(SCALE.successTitle, { exact: true }), 'state follows applyOutcome: no success any more').toHaveCount(0);
        await evidence(page, '14-A-037', 'applied-then-failed');
      });
    } finally {
      await closeSession(s);
      await deleteSeededProject(owner.api, d1.projectId);
    }
  });

  test('SCR-14 · FL-14-08 · conflicts and BE refusals on apply', async ({ browser }) => {
    test.setTimeout(300_000);
    const owner = shared.owner();
    const d1 = await seedD1(owner.api, '14-08');
    const { s, page, sent } = await openFlow(browser);
    const failure = (tail: string): RegExp => new RegExp(`^${SCALE.failed} ${tail}`, 'u');
    const lastPut = (): { status: number; code?: string; json?: unknown } | undefined =>
      s.log.filter((e) => e.method === 'PUT' && layerRe(d1.projectId, d1.floorId).test(e.path)).at(-1);
    try {
      await step('14-B-017', 'apply refused by a stale revision (layer written elsewhere after load) → 409 "Chưa lưu được tỷ lệ… Tải lại để xem phiên bản mới nhất."', async () => {
        await openScale(page, d1.projectId, d1.floorId);
        await staleWrite(owner.api, d1);
        await drawStandard(page);
        await applyDisabled(page).click();
        await expect(panelOf(page).getByText(failure(ERR.conflict.replace(/\./gu, '\\.')))).toBeVisible();
        await evidence(page, '14-B-017', 'stale-409');
      });

      await step('14-G-014', 'PUT 409 VERSION_CONFLICT → failure notice (14-B-017), the next apply is sent again (14-B-023)', async () => {
        await expect.poll(() => lastPut()?.status).toBe(409);
        expect.soft(lastPut()?.code).toBe('VERSION_CONFLICT'); // USC:1140-1144
        await evidence(page, '14-G-014', 'version-conflict');
      });

      await step('14-B-023', 'after one scale-only 409 the floor is not blocked: the next "Xác nhận tỷ lệ" sends 1 PUT; a "Tải lại" way out exists ⚑', async () => {
        const mark = sent.length;
        await applyDisabled(page).click();
        await flush(page);
        expect.soft(putsSince(sent, mark, d1.projectId, d1.floorId), '1 PUT on retry: a scale-only 409 does not block the floor (spatialLayerSave.ts:250-255)').toHaveLength(1);
        await expect.soft(panelOf(page).getByText(failure('')), 'the failure is repeated').toBeVisible();
        await expect.soft(page.getByRole('button', { name: /^Tải lại( trang| tầng| phiên bản)?$/u }), 'a way out of the blocked floor').toBeVisible();
        await evidence(page, '14-B-023', 'blocked-floor');
      });

      await step('14-C-018', 'ratio over the BE bound (> 999999 mm/px) → PUT 422 → "Chưa lưu được tỷ lệ… Kiểm tra lại các trường được đánh dấu rồi thử lại."', async () => {
        await page.reload(); // reload clears the blocked floor and takes the new revision
        await expect(canvasOf(page)).toBeVisible();
        await expect(btn(page, SCALE.remeasure)).toBeVisible();
        await drawStandard(page, '999999999999');
        await applyDisabled(page).click();
        await expect(panelOf(page).getByText(failure(ERR.validation.replace(/\./gu, '\\.')))).toBeVisible(); // USC:1140-1144; A4 range (0, 999999]
        await evidence(page, '14-C-018', 'ratio-over-bound');
      });

      await step('14-G-015', 'PUT 422 on field body.scaleMillimetresPerPixel → failure notice (14-C-018) mapped to errors.validation', async () => {
        const last = lastPut();
        expect.soft(last?.status).toBe(422);
        expect.soft(JSON.stringify(last?.json ?? ''), 'the refused field').toContain('scaleMillimetresPerPixel');
        await evidence(page, '14-G-015', 'validation-field');
      });

      await step('14-G-017', 'PUT 404 (floor deleted elsewhere after load) → failure + errors.notFound', async () => {
        await page.reload();
        await expect(canvasOf(page)).toBeVisible();
        await expect(btn(page, SCALE.remeasure)).toBeVisible();
        await drawStandard(page);
        const del = await owner.api.delete(`/api/floors/${d1.floorId}`);
        if (del.status() !== 200) {
          note(`DELETE /api/floors/:id answered ${String(del.status())} (the only floor): the project is deleted instead`);
          await deleteSeededProject(owner.api, d1.projectId);
        }
        await applyDisabled(page).click();
        await expect(panelOf(page).getByText(failure(ERR.notFound.replace(/\./gu, '\\.')))).toBeVisible(); // USC:1140-1144
        expect.soft(lastPut()?.status).toBe(404);
        await evidence(page, '14-G-017', 'not-found');
      });
    } finally {
      await closeSession(s);
      await deleteSeededProject(owner.api, d1.projectId);
    }
  });

  /* ============================================================= multi-floor flows */

  test('SCR-14 · FL-14-07 · apply to every floor: dialog, serial PUTs, report, skipped and blocked floors', async ({ browser }) => {
    test.setTimeout(480_000);
    const owner = shared.owner();
    const png = envDrawingPng();
    const names = ['Tầng 1', 'Tầng 2', 'Tầng 3', 'Tầng 4'];
    const created: string[] = [];
    const { s, page, sent } = await openFlow(browser);
    try {
      const a = await seedFloors(owner.api, '14-07a', names, [{ index: 0, png }, { index: 1, png }]); // DM: 4 floors, 2 drawings
      created.push(a.projectId);
      const b = await seedFloors(owner.api, '14-07b', names, [{ index: 0, png }]); // DM': 1 drawing of 4
      created.push(b.projectId);
      const c = await seedFloors(owner.api, '14-07c', ['Tầng 1', 'Tầng 2'], [{ index: 0, png }, { index: 1, png: corruptPng() }]); // failed-run floor
      created.push(c.projectId);
      expect(c.runs[1]?.outcome, 'setup: the crafted upload failed its run').toBe('failed');
      const [a0, a1] = [a.floors[0]!, a.floors[1]!];
      const putsA = (from: number): Sent[] => sent.slice(from).filter((r) => r.method === 'PUT' && /\/spatial\/layer$/u.test(r.path));
      const dialogFor = (n: number): Locator => page.getByRole('dialog', { name: `Áp tỷ lệ này cho ${String(n)} tầng có bản vẽ?`, exact: true });
      const confirmAll = (): Locator => btn(page.getByRole('dialog'), SCALE.allFloors);
      const openAll = async (projectId: string, floorId: string, length = '5000'): Promise<void> => {
        await openScale(page, projectId, floorId);
        await scopeRadio(page, SCALE.allFloors).click();
        await drawStandard(page, length);
        await applyDisabled(page).click();
      };
      const revisionsOf = async (projectId: string): Promise<Map<string, number>> => {
        const res = await owner.api.get(`/api/projects/${projectId}/spatial`);
        expect(res.status(), 'read-back: GET …/spatial (N15)').toBe(200);
        const rows = ((await res.json()) as { floorRevisions?: { floorId: string; revision: number }[] }).floorRevisions ?? [];
        return new Map(rows.map((row) => [row.floorId, row.revision]));
      };
      const revisionsA = await revisionsOf(a.projectId);

      await step('14-A-023', 'Esc / "Đóng hộp thoại" on the A9 dialog = "Huỷ" (no PUT)', async () => {
        const mark = sent.length;
        await openAll(a.projectId, a0.id);
        await expect(dialogFor(2)).toBeVisible();
        await page.keyboard.press('Escape');
        await expect.soft(page.getByRole('dialog')).toHaveCount(0);
        await applyDisabled(page).click();
        await expect(dialogFor(2)).toBeVisible();
        await btn(page.getByRole('dialog'), 'Đóng hộp thoại').click();
        await expect.soft(page.getByRole('dialog')).toHaveCount(0);
        expect.soft(putsA(mark), '0 PUT after Esc and after the close button').toHaveLength(0);
        await evidence(page, '14-A-023', 'dialog-cancel');
      });

      await step('14-E-008', 'A9 dialog: named by its title, focus inside, Tab trapped, focus back to "Xác nhận tỷ lệ"', async () => {
        await applyDisabled(page).click();
        const dialog = dialogFor(2);
        await expect(dialog).toBeVisible(); // SC:247-256
        const inside = (): Promise<boolean> => page.evaluate(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement) ?? false);
        expect.soft(await inside(), 'focus starts inside the dialog').toBe(true);
        for (let i = 0; i < 5; i += 1) {
          await page.keyboard.press('Tab');
          expect.soft(await inside(), `Tab #${String(i + 1)} stays inside`).toBe(true);
        }
        await evidence(page, '14-E-008', 'dialog-focus');
        await page.keyboard.press('Escape');
        await expect.soft(applyDisabled(page)).toBeFocused();
      });

      await step('14-A-024', '"Áp cho mọi tầng" confirms: a serial PUT per floor with a drawing, then the report', async () => {
        const mark = sent.length;
        await applyDisabled(page).click();
        await confirmAll().click();
        await expect(panelOf(page).getByText('Đã áp tỷ lệ cho 2 tầng. Bỏ qua vì chưa có bản vẽ: Tầng 3, Tầng 4.', { exact: true })).toBeVisible();
        expect.soft(putsA(mark)).toHaveLength(2);
        await evidence(page, '14-A-024', 'all-floors-report');
      });

      await step('14-C-028', 'N = drawing floors only; one PUT per drawing floor, serial, each with its own baseVersion', async () => {
        const puts = putsA(0).filter((r) => r.path.includes(a0.id) || r.path.includes(a1.id));
        expect.soft(puts.map((r) => r.path.split('/')[5]).sort()).toEqual([a0.id, a1.id].sort());
        const [first, second] = puts;
        expect.soft((second?.startedAt ?? 0) >= (first?.finishedAt ?? Number.POSITIVE_INFINITY), 'the second PUT starts after the first finished').toBe(true);
        await evidence(page, '14-C-028', 'serial-puts');
      });

      await step('14-C-038', 'apply-all baseVersion = max(local revision, N15 revision) per floor', async () => {
        for (const floor of [a0, a1]) {
          const put = putsA(0).find((r) => r.path.includes(floor.id));
          const base = (put?.body as { baseVersion?: number } | null)?.baseVersion;
          expect.soft(base, `baseVersion of ${floor.name}`).toBe(revisionsA.get(floor.id));
        }
        await evidence(page, '14-C-038', 'base-versions');
      });

      await step('14-C-029', 'all floors with only the current floor drawn: N = 1, "Đã áp tỷ lệ cho 1 tầng." + the skipped list, state success', async () => {
        await openAll(b.projectId, b.floors[0]!.id);
        await expect(dialogFor(1)).toBeVisible();
        await confirmAll().click();
        await expect(panelOf(page).getByText('Đã áp tỷ lệ cho 1 tầng. Bỏ qua vì chưa có bản vẽ: Tầng 2, Tầng 3, Tầng 4.', { exact: true })).toBeVisible(); // USC:226,1188
        await expect.soft(page.getByText(SCALE.successTitle, { exact: true })).toBeVisible();
        await evidence(page, '14-C-029', 'only-current-drawn');
      });

      await step('14-C-037', '"có bản vẽ" counts only floors with a completed drawing: a floor whose only upload failed is not counted ⚑', async () => {
        await openAll(c.projectId, c.floors[0]!.id);
        await expect.soft(dialogFor(1), 'title counts 1 drawing floor, not the failed-upload floor').toBeVisible();
        await evidence(page, '14-C-037', 'failed-upload-floor');
        await page.keyboard.press('Escape');
      });

      await step('14-C-027', '"Chỉ áp cho tầng này": only this floor\'s layer is PUT; the other floors are unchanged', async () => {
        await openScale(page, a.projectId, a0.id);
        const other = await readLevel(owner.api, a.projectId, a1.id);
        const mark = sent.length;
        await drawStandard(page, '4800');
        await applyDisabled(page).click();
        await expect(page.getByText(SCALE.successTitle, { exact: true })).toBeVisible();
        const puts = putsA(mark);
        expect.soft(puts).toHaveLength(1);
        expect.soft(puts[0]?.path).toContain(a0.id);
        expect.soft(await readLevel(owner.api, a.projectId, a1.id), 'the other floor is untouched').toEqual(other);
        await evidence(page, '14-C-027', 'this-floor-only');
      });

      await step('14-B-020', 'all floors: one floor\'s PUT fails → partial report (the saved floor, the failed one, the skipped ones)', async () => {
        await openScale(page, a.projectId, a0.id);
        await scopeRadio(page, SCALE.allFloors).click();
        await drawStandard(page, '4700');
        await applyDisabled(page).click();
        await expect(dialogFor(2)).toBeVisible(); // N15 revisions are read when the dialog opens …
        await staleWrite(owner.api, { projectId: a.projectId, floorId: a1.id }); // … so this write makes floor 2 stale
        await confirmAll().click();
        await expect(panelOf(page).getByText('Đã áp tỷ lệ cho 1 tầng. Không lưu được tỷ lệ cho: Tầng 2. Bỏ qua vì chưa có bản vẽ: Tầng 3, Tầng 4.', { exact: true })).toBeVisible();
        // The source gives these warped floors state `error`, not `partial` (USC state order: warped && no success → error): its title shows.
        await expect.soft(page.getByText(SCALE.warpedTitle, { exact: true }).first(), 'state error: the warped-drawing title (SC:72)').toBeVisible();
        note('state `partial` is outranked by `error` on these warped floors (USC state order: warped && no success → error); the report text is what is asserted');
        await evidence(page, '14-B-020', 'partial-report');
      });

      await step('14-B-021', 'all floors: after a scale-only 409 the floor is re-read and saved again (not blocked)', async () => {
        const mark = sent.length;
        await lengthField(page).fill('4600');
        await applyDisabled(page).click();
        await expect(dialogFor(2)).toBeVisible();
        await confirmAll().click();
        // The whole report (USC:221-233): floor 2 is re-read at the dialog and saved (a scale-only 409 never blocks), 3 / 4 skipped.
        await expect
          .soft(panelOf(page).getByText('Đã áp tỷ lệ cho 2 tầng. Bỏ qua vì chưa có bản vẽ: Tầng 3, Tầng 4.', { exact: true }))
          .toBeVisible();
        expect.soft(putsA(mark), '2 PUTs: both drawn floors are sent').toHaveLength(2);
        await evidence(page, '14-B-021', 'blocked-floor-report');
      });
    } finally {
      await closeSession(s);
      for (const id of created) await deleteSeededProject(owner.api, id);
    }
  });

  test('SCR-14 · FL-14-09 · framed floor empty → partial → success; no drawing; unknown ids; SCR-12 entry', async ({ browser }) => {
    test.setTimeout(300_000);
    const owner = shared.owner();
    const df = await seedDF(owner.api, '14-09');
    const q2 = await createQcProject(layerApi(owner.api), '14-09-q2', ['Tầng 1', 'Tầng trống'], 1);
    const empty = q2[1]!;
    const { s, page } = await openFlow(browser);
    try {
      await step('14-B-002', 'empty (framed drawing, no OCR rows, no line): "Chưa có chuỗi kích thước nào để đối chiếu" + the "draw a line" hint', async () => {
        await openScale(page, df.projectId, df.floorId);
        await expect(noticeOf(page).getByText(SCALE.emptyTitle, { exact: true })).toBeVisible();
        await expect.soft(noticeOf(page).getByText(SCALE.emptyBody, { exact: true })).toBeVisible();
        await expect.soft(page.getByText(SCALE.warpedTitle, { exact: true }), 'a framed drawing is not warped').toHaveCount(0);
        await evidence(page, '14-B-002', 'empty');
      });

      await step('14-B-003', 'partial once a line is drawn (or after a failed apply)', async () => {
        await dragLine(page, [0.2, 0.5], [0.8, 0.5]);
        await expect.soft(noticeOf(page).getByText(SCALE.partialTitle, { exact: true })).toBeVisible();
        await expect.soft(noticeOf(page).getByText(SCALE.partialBody, { exact: true })).toBeVisible();
        await evidence(page, '14-B-003', 'partial');
      });

      await step('14-B-005', 'success resets to partial after a new line is drawn post-apply (applyOutcome follows the editing) ⚑', async () => {
        await lengthField(page).fill('5000');
        await applyDisabled(page).click();
        await expect(noticeOf(page).getByText(SCALE.successTitle, { exact: true })).toBeVisible();
        await dragLine(page, [0.3, 0.3], [0.6, 0.3]);
        await expect.soft(noticeOf(page).getByText(SCALE.partialTitle, { exact: true }), 'partial again after a new line').toBeVisible();
        await expect.soft(noticeOf(page).getByText(SCALE.successTitle, { exact: true })).toHaveCount(0);
        await evidence(page, '14-B-005', 'success-then-new-line');
      });

      await step('14-G-020', 'the drawing image (sourceUrl) loads with 200', async () => {
        const img = canvasOf(page).locator('img');
        const src = (await img.getAttribute('src')) ?? '';
        expect.soft(src, 'sourceUrl is set').not.toBe('');
        expect.soft(await img.evaluate((el) => (el as HTMLImageElement).naturalWidth), 'decoded').toBeGreaterThan(0); // SCV:340-347
        const status = await page.evaluate(async (url) => (await fetch(url)).status, src);
        expect.soft(status, 'GET sourceUrl').toBe(200);
        await evidence(page, '14-G-020', 'image-200');
      });

      await step('14-A-002', 'entry from the SCR-12 summary "Đặt tỷ lệ" lands on this floor\'s scale route', async () => {
        await page.goto(ROUTES.project.pipeline(df.projectId));
        const calibrate = btn(page, 'Đặt tỷ lệ');
        await expect(calibrate).toBeVisible({ timeout: 45_000 });
        await calibrate.click();
        await softExpect.poll(() => pathOf(page)).toBe(ROUTES.project.scale(df.projectId, df.floorId));
        await evidence(page, '14-A-002', 'from-summary');
      });

      await step('14-A-030', '"Tải bản vẽ lên" on a floor without a drawing → the upload screen', async () => {
        await openNoDrawing(page, q2[0]!.projectId, empty.floorId);
        await btn(noticeOf(page), SCALE.goToUpload).click();
        await softExpect.poll(() => pathOf(page)).toBe(ROUTES.project.upload(q2[0]!.projectId));
        await evidence(page, '14-A-030', 'to-upload');
      });

      await step('14-B-006', 'error: floor without a drawing (404 `upload`): own title, no code, only "Tải bản vẽ lên"; method block dimmed, shortcuts hidden', async () => {
        await openNoDrawing(page, q2[0]!.projectId, empty.floorId);
        const notice = noticeOf(page);
        await expect.soft(notice.getByText(SCALE.noDrawingTitle, { exact: true })).toBeVisible();
        await expect.soft(notice.getByText(SCALE.noDrawingBody, { exact: true })).toBeVisible();
        await expect.soft(notice).not.toContainText('Mã lỗi');
        await expect.soft(btn(notice, SCALE.goToUpload)).toBeVisible();
        await expect.soft(btn(notice, SCALE.retry)).toHaveCount(0);
        await expect.soft(btn(notice, SCALE.backToPreprocessing)).toHaveCount(0);
        await expect.soft(panelOf(page).locator('section[aria-disabled="true"]')).toHaveCount(1);
        await expect.soft(page.getByRole('list', { name: SCALE.shortcuts, exact: true })).toHaveCount(0);
        await evidence(page, '14-B-006', 'no-drawing');
      });

      await step('14-G-002', 'GET …/quality 404 `upload` → the no-drawing branch', async () => {
        const reads = s.log.filter((e) => e.method === 'GET' && e.path.endsWith(`/floors/${empty.floorId}/quality`));
        expect.soft(reads.map((e) => e.status)).toContain(404); // USC:1532-1534
        await evidence(page, '14-G-002', 'quality-404');
      });

      await step('14-B-009', 'error: the floorId in the URL is not a floor of this project → "…đường dẫn chưa đúng. Mã lỗi: NOT_FOUND"', async () => {
        await page.goto(ROUTES.project.scale(df.projectId, q2[0]!.floorId));
        // BUG-326 (BUG-LOG-P04.md:199, fixed): a 404 floor swaps the whole screen for the shared one-exit screen
        // (floorLayerReadFailure.ts:21-25, ScaleCalibration.tsx:188-191; same as phase04_objects_edge.spec.ts 17-B-008) - no machine code by design.
        await expect(page.getByText('Không mở được tầng này', { exact: true })).toBeVisible({ timeout: 45_000 }); // floorLayerReadFailure.ts:21
        await expect.soft(page.getByText('Tầng này không còn tồn tại. Mở Quản lý tầng để chọn một tầng khác.', { exact: true })).toBeVisible(); // :23
        await expect.soft(btn(page, 'Về quản lý tầng')).toBeVisible(); // :24
        await expect.soft(page.getByText(/Mã lỗi: NOT_FOUND/u)).toHaveCount(0);
        await evidence(page, '14-B-009', 'foreign-floor');
      });

      await step('14-G-003', 'GET …/quality 404 `project` (unknown / non-member) → notFound + "Mã lỗi: NOT_FOUND"', async () => {
        const unknownProject = `${df.projectId.slice(0, -1)}${df.projectId.endsWith('0') ? '1' : '0'}`;
        await page.goto(ROUTES.project.scale(unknownProject, df.floorId));
        // useScaleCalibration.ts:1703-1705 -> floorLayerReadFailure.ts:50-57 swaps the whole screen (copy: ProjectSpatialGate.tsx:37-40); no machine code by design (G45/BUG-337).
        await expect.soft(page.getByText('Không tìm thấy dự án này', { exact: true })).toBeVisible({ timeout: 45_000 });
        await expect.soft(page.getByRole('button', { name: 'Về danh sách dự án', exact: true })).toBeVisible();
        await expect.soft(page.getByText(/Mã lỗi: NOT_FOUND/u)).toHaveCount(0);
        await evidence(page, '14-G-003', 'unknown-project');
      });
    } finally {
      await closeSession(s);
      await deleteSeededProject(owner.api, df.projectId);
      if (q2[0] !== undefined) await deleteSeededProject(owner.api, q2[0].projectId);
    }
  });
});

/** Scale screen of a floor with no drawing: the notice region with its alert is up. */
async function openNoDrawing(page: Page, projectId: string, floorId: string): Promise<void> {
  await page.goto(ROUTES.project.scale(projectId, floorId));
  await expect(noticeOf(page).getByRole('alert')).toBeVisible({ timeout: 45_000 });
}
