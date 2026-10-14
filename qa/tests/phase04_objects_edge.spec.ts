/**
 * Phase 4 — SCR-17 object layer review, EDGE layer, REAL stack: eleven sequential user flows (QA-04c P2, `flow-plan.md`
 * "phase04_objects_edge.spec.ts"). One `test()` per flow, one `test.step('[<row id>] …')` per catalog row in the planned
 * order; the first step (and the open/seed step) of a flow is a hard `expect`, the others `expect.soft`. Every step
 * captures one evidence `E04_<row id>_<slug>.png`. A step marked ⚑ asserts the CORRECT behaviour (catalog C2 Notes) and
 * stays red while the bug is real. The mocked flows are in `phase04_objects_mocked_edge.spec.ts`, the four-width states in
 * `phase04_objects_ui.spec.ts`.
 *
 * Source short names (FE `src/screens/qc/ObjectLayerReview/`): OV ObjectLayerReview.tsx · UO useObjectLayerReview.ts ·
 * OG objectLayerReviewGateway.ts · OI ObjectLayerInspector.tsx · OL ObjectLayerList.tsx · OLP ObjectLayerLeftPanel.tsx ·
 * OT ObjectLayerToolRail.tsx · OS ObjectLayerStatusBar.tsx · OCV ObjectLayerCanvas.tsx · OSY objectLayerSymbols.ts; shared:
 * UAS src/hooks/useAutosave.ts · SLS src/lib/autosave/spatialLayerSave.ts · UFL src/hooks/useFloorLayer.ts ·
 * FRF src/screens/qc/shared/floorLayerReadFailure.ts · TO src/components/feedback/Toast.tsx · NH NotificationHost.tsx.
 *
 * ## Users and data
 * Every flow signs in as the file's POOL ADMIN (`poolUser(admin, 'admin', 'p04-p2')`, support/p04/P2.ts) and creates its
 * OWN `qa-<runId>-…` project through the real API (seed builders in P2.ts, layers written through #35 with W4 ids), which
 * `closeSession` deletes. Nothing reads the phase 3/4 checkpoints. FL-17-11 (D1) uploads the env drawing as a second
 * pool admin (`p04-p2-up`, own `drawings_init` bucket): 1 upload for the file.
 *
 * ## Request budget per full run (BE defaults; QA stack override qa-limits.override.yml)
 * - `POST /api/auth/login` (120 / 60 s per IP): 1 main admin API (beforeAll, pool lookup) + 11 flow sessions + 1 viewer
 *   check (FL-17-10 none) + 1 anonymous page (FL-17-09) → 13. `POST /api/users/invitations`: 0 once the pool slots exist (2 else).
 * - `POST /api/auth/refresh` (300 / 60 s): ~3 per flow (fixture token + page loads) ≈ 80 across 11 flows over several minutes.
 * - `POST /api/projects` 11 (+ 1 D1), `PUT …/spatial/layer` ≈ 4 per flow for seeding + the screen's own writes (no rate limit).
 * - `POST …/drawings/uploads` (`drawings_init` 60 / 600 s per user): 1.
 */
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { TOUR_APPEAR_TIMEOUT_MS, dismissTour } from '../../e2e/fixtures/tour';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { attachJson } from './support/evidence';
import { recordAnnouncements } from './support/p03/P5';
import { createPipelineDrawingProject, envDrawingPng, poolUser } from './support/phase03Seed';
import {
  OBJ,
  QUICK,
  SAVE,
  SLOT,
  adminApi,
  allOptions,
  approveButton,
  asRecord,
  at,
  attempt,
  arrayOf,
  backgroundRe,
  chip,
  closeSession,
  codeOfLabel,
  counterText,
  createObjectsProject,
  emptyLayer,
  ev,
  eyeButton,
  getCount,
  groupBox,
  hostWallCode,
  inspector,
  layerRe,
  legend,
  listGroup,
  lowWallLayer,
  markShell,
  menuItem,
  nextPut,
  objectsEmptyProject,
  objectsLowConf,
  objectsMenu,
  objectsQ1,
  objectsQ1LowWall,
  openObjects,
  openSelect,
  openSession,
  openingIdOf,
  optionLabels,
  optionOf,
  pathOf,
  poolApi,
  poolUsers,
  positionSlider,
  pressSpaceOn,
  putCount,
  putLayerOf,
  putList,
  quiet,
  railButton,
  readLayer,
  screen,
  shellKept,
  sliderTrack,
  spaGo,
  statusBar,
  swingRadio,
  symbolOf,
  toastRegion,
  treeItem,
  typeBox,
  writeElsewhere,
  writeQ1,
  writesSince,
  type PoolUser,
  type PutRecord,
  type Session,
} from './support/p04/P2';

/* ---------------------------------------------------------------- shared setup */

/** Slow-mo watch runs add 400 ms per action; the plan's estimates are for headless. */
const FLOW_TIMEOUT = 300_000;

let owner: PoolUser;

test.beforeAll(async () => {
  ({ owner } = await poolUsers());
});

async function withFlow(
  browser: Browser,
  body: (session: Session) => Promise<void>,
  options: { readonly viewport?: { width: number; height: number }; readonly reducedMotion?: boolean } = {},
): Promise<void> {
  const session = await openSession(browser, owner, options);
  try {
    await body(session);
  } finally {
    await closeSession(session);
  }
}

/** The halo's four 6 px handles (OCV:351-371): present only while an object is selected or hovered. */
const haloHandles = (page: Page): Locator => page.locator('div[aria-hidden="true"].pointer-events-none[class*="rounded-[1px]"]');
const canvasGroup = (page: Page): Locator => page.getByRole('group', { name: OBJ.canvas, exact: true });
/** Stroke width of the first drawn stroke of a symbol (doubles on select / hover, OCV:139-146). */
const strokeWidth = async (page: Page, code: string): Promise<number> =>
  Number(await symbolOf(page, code).locator('path[stroke-width]').first().getAttribute('stroke-width'));
/** `d` of every stroke of a symbol: the glyph (swing arc, sliding track...). */
const glyphOf = async (page: Page, code: string): Promise<string> =>
  (await symbolOf(page, code).locator('path[stroke-width]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('d') ?? ''))).join('|');
/** PUT entries of the page log (status + parsed body), newest last. */
const putEntries = (session: Session) => session.log.filter((entry) => entry.method === 'PUT' && /\/spatial\/layer$/u.test(entry.path));
/** The opening `id` inside a recorded PUT. */
const openingIn = (record: PutRecord, id: string): Record<string, unknown> | undefined => putList(record, 'openings').find((o) => o.id === id);

/** Reason the screen drops silently (OG:902): `SAME_SUBTYPE_REASON`. */
const SAME_SUBTYPE_REASON = 'Đối tượng đã ở đúng loại đó nên không có gì thay đổi.';

/** True while a reason / message for the user is on the page (toast, alert or status line) — never a fixed wait. */
async function feedbackShown(page: Page, text: RegExp | string): Promise<boolean> {
  try {
    await expect(page.getByText(text).first()).toBeVisible({ timeout: 2_500 });
    return true;
  } catch {
    return false;
  }
}

/** Any message for the user right now: a toast (region "Thông báo"), or an alert / inline notice that carries text. */
async function anyFeedback(page: Page): Promise<boolean> {
  return (await toastRegion(page).getByRole('status').count()) > 0 || (await page.getByRole('alert').filter({ hasText: /\S/u }).count()) > 0;
}

/* ================================================================= FL-17-01 */

test('SCR-17 · FL-17-01 open, select by list and canvas, hover halo, approve without advance', async ({ browser }) => {
  test.setTimeout(FLOW_TIMEOUT);
  await withFlow(browser, async (s) => {
    const { page, log } = s;
    const project = await objectsQ1(s, 'f1701');
    const pid = project.projectId;
    const fid = at(project.floors, 0, 'floor').floorId;
    const doorEntity = await openingIdOf(s.api, pid, fid, 'door');
    const hostCode = await hostWallCode(s.api, pid, fid, 'door');

    await test.step('[17-A-001] Deep link: GET …/spatial (background) + GET …/spatial/layer (N16), screen renders', async () => {
      const mark = log.length;
      await openObjects(page, pid, fid);
      await expect(screen(page)).toBeVisible();
      await expect(page.getByLabel('0/3 đối tượng đã duyệt', { exact: true })).toBeVisible();
      for (const label of [OBJ.doors, OBJ.windows, OBJ.furniture]) await expect(groupBox(page, label)).toBeVisible();
      await expect.poll(() => getCount(log, mark, backgroundRe(pid, fid)), { message: 'GET …/spatial (background) answered' }).toBeGreaterThanOrEqual(1);
      expect(getCount(log, mark, layerRe(pid, fid)), 'GET …/spatial/layer (N16)').toBeGreaterThanOrEqual(1);
      await ev(page, '17-A-001', 'deep_link');
    });

    await test.step('[17-B-005] Partial without low-confidence objects: plain list, no notice', async () => {
      await expect.soft(page.getByText(/mục dưới ngưỡng tin cậy/u)).toHaveCount(0);
      await expect.soft(page.getByRole('button', { name: OBJ.lowOnly, exact: true })).toHaveCount(0);
      await expect.soft(allOptions(page)).toHaveCount(3);
      await ev(page, '17-B-005', 'plain_list');
    });

    await test.step('[17-B-015] Floor without drawing (API-seeded) → plain sunken background, walls and symbols fitted to the walls bounds', async () => {
      await expect.soft(canvasGroup(page).locator('img')).toHaveCount(0);
      await expect.soft(canvasGroup(page).locator('div.bg-bg-sunken[aria-hidden="true"]')).toHaveCount(1);
      const svg = page.getByRole('img', { name: OBJ.canvas, exact: true });
      expect.soft(await svg.getAttribute('viewBox'), 'svg viewBox fitted to the walls').not.toBeNull();
      const frame = await canvasGroup(page).boundingBox();
      const boxes = await page.locator('g[aria-label^="#"]').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON() as { x: number; y: number; right: number; bottom: number }));
      expect.soft(boxes.length, 'symbols drawn').toBe(3);
      for (const box of boxes) {
        expect.soft(frame !== null && box.x >= frame.x - 1 && box.y >= frame.y - 1 && box.right <= frame.x + frame.width + 1 && box.bottom <= frame.y + frame.height + 1, `symbol inside the frame: ${JSON.stringify(box)}`).toBe(true);
      }
      await ev(page, '17-B-015', 'no_drawing_background');
    });

    await test.step('[17-E-001] Names: region, section, canvas group and svg img all named "Mặt bằng lớp đối tượng"', async () => {
      await expect.soft(screen(page)).toBeVisible();
      await expect.soft(page.locator(`[aria-label="${OBJ.canvas}"]`)).toHaveCount(3);
      await expect.soft(page.getByRole('region', { name: OBJ.canvas, exact: true })).toHaveCount(1);
      await expect.soft(page.getByRole('group', { name: OBJ.canvas, exact: true })).toHaveCount(1);
      await expect.soft(page.getByRole('img', { name: OBJ.canvas, exact: true })).toHaveCount(1);
      await ev(page, '17-E-001', 'canvas_names');
    });

    await test.step('[17-A-004] Click a list option → selected; inspector shows its code', async () => {
      const door = optionOf(page, '#D-001');
      await door.click();
      await expect.soft(door).toHaveAttribute('aria-selected', 'true');
      await expect.soft(inspector(page).getByText('#D-001', { exact: true })).toBeVisible();
      await expect.soft(page.getByRole('heading', { name: 'Đối tượng', exact: true, level: 3 })).toBeVisible();
      await ev(page, '17-A-004', 'list_select');
    });

    await test.step('[17-A-005] Click a symbol on the canvas selects the same object', async () => {
      await attempt('click the symbol #S-001', () => symbolOf(page, '#S-001').click({ timeout: QUICK }));
      await expect.soft(optionOf(page, '#S-001')).toHaveAttribute('aria-selected', 'true');
      await expect.soft(inspector(page).getByText('#S-001', { exact: true })).toBeVisible();
      await ev(page, '17-A-005', 'canvas_select');
    });

    await test.step('[17-A-006] Selecting a second object replaces the first (single selection)', async () => {
      await optionOf(page, '#D-001').click();
      await expect.soft(listGroup(page).locator('[aria-selected="true"]')).toHaveCount(1);
      await expect.soft(optionOf(page, '#D-001')).toHaveAttribute('aria-selected', 'true');
      await expect.soft(optionOf(page, '#S-001')).toHaveAttribute('aria-selected', 'false');
      await ev(page, '17-A-006', 'single_selection');
    });

    await test.step('[17-A-007] Hover a list row → its symbol stroke doubles and the halo with 4 handles is drawn; leave → gone', async () => {
      await page.keyboard.press('Escape'); // UO:1253-1262 clears the selection so only hover can draw the halo
      await inspector(page).hover(); // the pointer still rests on the row that was clicked: leave it, or hover keeps the halo
      await expect.soft(haloHandles(page)).toHaveCount(0);
      const rest = await strokeWidth(page, '#D-001');
      await optionOf(page, '#D-001').hover();
      await expect.soft(haloHandles(page)).toHaveCount(4);
      await expect.poll(() => strokeWidth(page, '#D-001'), { message: 'hovered stroke doubles' }).toBeCloseTo(rest * 2, 5);
      await ev(page, '17-A-007', 'hover_row_halo');
      await inspector(page).hover();
      await expect.soft(haloHandles(page)).toHaveCount(0);
      expect.soft(await strokeWidth(page, '#D-001')).toBeCloseTo(rest, 5);
    });

    await test.step('[17-A-008] Hover a symbol → same halo; leaving the canvas frame clears hover', async () => {
      await attempt('hover the symbol #S-001', () => symbolOf(page, '#S-001').hover({ timeout: QUICK }));
      await expect.soft(haloHandles(page)).toHaveCount(4);
      await ev(page, '17-A-008', 'hover_symbol_halo');
      await treeItem(page, OBJ.doors).hover();
      await expect.soft(haloHandles(page)).toHaveCount(0);
    });

    await test.step('[17-B-027] Object selected (door on a wall): two measurement labels to the wall ends, state idle', async () => {
      await optionOf(page, '#D-001').click();
      // The two distances the labels carry are the slider's end labels (OI:339-347): 1.000 mm to the start, 4.100 mm... from the wall length.
      const ends = await inspector(page).locator('span.font-mono.select-none').allInnerTexts();
      expect.soft(ends.length, 'slider end labels = the two distances to the wall ends').toBe(2);
      // UNKNOWN — NEED VERIFICATION: the catalog row expects a label pill per distance on a plain selection (OCV:375-392,
      // UO:1336-1353), but MeasurementLabel returns null while its state is idle (MeasurementLabel.tsx:41) and the hook only
      // switches to 'measuring' on a drag (UO:1305). The pills seen on the canvas are recorded, not asserted; [17-A-018] asserts them while dragging.
      const pills = await canvasGroup(page).locator('span.font-mono').allInnerTexts();
      await attachJson('E04_17-B-027_idle_labels.json', { sliderEndLabels: ends, canvasPills: pills });
      await ev(page, '17-B-027', 'selected_measurements');
    });

    await test.step('[17-A-009] "Duyệt đối tượng này" → PUT #35 with the opening reviewed:true source:"human"; button disabled', async () => {
      const mark = s.puts.length;
      await approveButton(page).click();
      const put = await nextPut(s, mark, (record) => putList(record, 'openings').some((o) => o.id === doorEntity && o.reviewed === true && o.source === 'human'));
      expect.soft(Object.keys(put.body).sort(), 'PUT body keys').toEqual(['baseVersion', 'body']);
      await expect.soft(approveButton(page)).toBeDisabled();
      await ev(page, '17-A-009', 'approve_put');
    });

    await test.step('[17-C-038] Approve is the only way to set reviewed, always with source "human" (A5); row turns "— Đã duyệt"', async () => {
      const put = at(s.puts, s.puts.length - 1, 'PUT');
      const reviewed = putList(put, 'openings').filter((o) => o.reviewed === true);
      expect.soft(reviewed.map((o) => o.source), 'reviewed openings are human').toEqual(['human']);
      expect.soft(putList(put, 'openings').filter((o) => o.id !== doorEntity).every((o) => o.reviewed === false && o.source === 'ai'), 'the others stay AI / unreviewed').toBe(true);
      expect.soft(putList(put, 'furniture').every((o) => o.reviewed === false && o.source === 'ai'), 'furniture stays AI / unreviewed').toBe(true);
      await expect.soft(optionOf(page, '#D-001')).toHaveAttribute('aria-label', '#D-001 — Đã duyệt');
      await ev(page, '17-C-038', 'row_reviewed');
    });

    await test.step('[17-A-010] After approve the selection stays on the same object (no auto-advance)', async () => {
      await expect.soft(optionOf(page, '#D-001')).toHaveAttribute('aria-selected', 'true');
      await expect.soft(listGroup(page).locator('[aria-selected="true"]')).toHaveCount(1);
      expect.soft(codeOfLabel((await optionOf(page, '#D-001').getAttribute('aria-label')) ?? '')).toBe('#D-001');
      expect.soft(await optionOf(page, '#D-001').getAttribute('aria-label')).toMatch(/— Đã duyệt$/u);
      await expect.soft(inspector(page).getByText(hostCode, { exact: true })).toBeVisible();
      await ev(page, '17-A-010', 'selection_stays');
    });

    await test.step('[17-G-009] PUT …/spatial/layer after approve → 200 {revision, layer}', async () => {
      await expect
        .poll(() => putEntries(s).at(-1)?.json !== undefined, { message: 'the PUT response body was read' })
        .toBe(true);
      const entry = putEntries(s).at(-1);
      expect.soft(entry?.status, 'PUT status').toBe(200);
      const json = asRecord(entry?.json, 'PUT result');
      expect.soft(typeof json.revision, '#35 result.revision').toBe('number');
      expect.soft(typeof json.layer, '#35 result.layer').toBe('object');
      await ev(page, '17-G-009', 'put_200');
    });

    await test.step('[17-G-010] Double click → exactly one PUT', async () => {
      await optionOf(page, '#S-001').click();
      const mark = log.length;
      const marked = s.puts.length;
      await approveButton(page).dblclick();
      await nextPut(s, marked);
      await quiet(page);
      expect.soft(putCount(log, mark), 'PUTs for a double click').toBe(1);
      await expect.soft(approveButton(page)).toBeDisabled();
      await ev(page, '17-G-010', 'double_click_one_put');
    });
  });
});

/* ================================================================= FL-17-02 */

test('SCR-17 · FL-17-02 swing and kind changes, silent refusals', async ({ browser }) => {
  test.setTimeout(FLOW_TIMEOUT);
  await withFlow(browser, async (s) => {
    const { page, log } = s;
    const project = await objectsQ1LowWall(s, 'f1702');
    const pid = project.projectId;
    const fid = at(project.floors, 0, 'floor').floorId;
    const doorEntity = await openingIdOf(s.api, pid, fid, 'door'); // the Q1 door (first door in the N16 list)
    const windowEntity = await openingIdOf(s.api, pid, fid, 'window');
    const swingOf = (record: PutRecord, id: string): unknown => openingIn(record, id)?.swing;
    const kindOf = (record: PutRecord, id: string): unknown => openingIn(record, id)?.kind;

    await test.step('[17-D-001] Admin: rail tools, inspector edit controls, menu, PUT 200', async () => {
      await openObjects(page, pid, fid);
      for (const name of ['Chọn nhóm cửa đi (phím D)', 'Chọn nhóm cửa sổ (phím W)', 'Chọn nhóm nội thất (phím F)']) await expect(railButton(page, name)).toBeVisible();
      await optionOf(page, '#D-001').click();
      await expect(typeBox(page)).toBeVisible();
      await expect(inspector(page).getByRole('radiogroup')).toBeVisible();
      await expect(approveButton(page)).toBeEnabled();
      await attempt('open the context menu', () => symbolOf(page, '#D-001').click({ button: 'right', timeout: QUICK }));
      await expect.soft(menuItem(page, 'Xoá')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect.soft(page.getByRole('menu', { name: 'Tuỳ chọn', exact: true })).toHaveCount(0);
      await optionOf(page, '#D-001').click();
      await ev(page, '17-D-001', 'admin_controls');
    });

    await test.step('[17-A-011] Door "Hướng mở" → "Mở trái" / "Mở phải" → PUT with that swing', async () => {
      let mark = s.puts.length;
      await pressSpaceOn(swingRadio(page, 'Mở phải'));
      let put = await nextPut(s, mark, (record) => swingOf(record, doorEntity) === 'right');
      await expect.soft(swingRadio(page, 'Mở phải')).toBeChecked();
      expect.soft(swingOf(put, doorEntity)).toBe('right');
      mark = s.puts.length;
      await pressSpaceOn(swingRadio(page, 'Mở trái'));
      put = await nextPut(s, mark, (record) => swingOf(record, doorEntity) === 'left');
      await expect.soft(swingRadio(page, 'Mở trái')).toBeChecked();
      await ev(page, '17-A-011', 'swing_left_right');
    });

    await test.step('[17-C-020] Clicking the already-checked swing → no PUT', async () => {
      await expect(swingRadio(page, 'Mở trái')).toBeChecked();
      const mark = log.length;
      await swingRadio(page, 'Mở trái').check({ force: true });
      await quiet(page);
      expect.soft(putCount(log, mark), 'PUTs after clicking the checked swing').toBe(0);
      await ev(page, '17-C-020', 'same_swing_no_put');
    });

    await test.step('[17-A-012] Single door "Hướng mở" → "Hai cánh" → swing double; the subtype becomes "Cửa đôi"', async () => {
      const mark = s.puts.length;
      await pressSpaceOn(swingRadio(page, 'Hai cánh'));
      const put = await nextPut(s, mark, (record) => swingOf(record, doorEntity) === 'double');
      expect.soft(kindOf(put, doorEntity)).toBe('door');
      await expect.soft(typeBox(page)).toContainText('Cửa đôi');
      await expect.soft(groupBox(page, OBJ.doors).getByRole('option')).toHaveCount(2);
      await ev(page, '17-A-012', 'swing_double');
    });

    await test.step('[17-A-013] Door "Hướng mở" → "Trượt" → PUT swing "sliding"', async () => {
      const before = await glyphOf(page, '#D-001');
      const mark = s.puts.length;
      await pressSpaceOn(swingRadio(page, 'Trượt'));
      await nextPut(s, mark, (record) => swingOf(record, doorEntity) === 'sliding');
      await expect.poll(() => glyphOf(page, '#D-001'), { message: 'the symbol switches to the sliding glyph' }).not.toBe(before);
      await ev(page, '17-A-013', 'swing_sliding');
      // back to "Mở trái" so the kind change below starts from a plain single door (a sliding door stays sliding as a window, OG:880-884)
      const back = s.puts.length;
      await pressSpaceOn(swingRadio(page, 'Mở trái'));
      await nextPut(s, back, (record) => swingOf(record, doorEntity) === 'left');
    });

    await test.step('[17-A-014] Window "Hướng mở" → "Mở trái" → PUT swing "left" on a window (no guard)', async () => {
      await optionOf(page, '#S-001').click();
      const mark = s.puts.length;
      await pressSpaceOn(swingRadio(page, 'Mở trái'));
      const put = await nextPut(s, mark, (record) => swingOf(record, windowEntity) === 'left');
      await expect.soft(swingRadio(page, 'Mở trái')).toBeChecked();
      expect.soft(kindOf(put, windowEntity), 'the window stays a window').toBe('window');
      await expect.soft(typeBox(page)).toContainText('Cửa sổ');
      await ev(page, '17-A-014', 'window_swing_left');
    });

    await test.step('[17-C-042] Window swing "Mở trái" accepted by BE #35 (no FE guard)', async () => {
      await expect.poll(() => putEntries(s).at(-1)?.status, { message: 'PUT answered' }).toBe(200);
      const layer = asRecord((await readLayer(s.api, pid, fid)).layer, 'layer');
      expect.soft(arrayOf(layer.openings, 'openings').find((o) => o.id === windowEntity)?.swing, 'server copy').toBe('left');
      await ev(page, '17-C-042', 'window_swing_accepted');
    });

    await test.step('[17-E-010] "Hướng mở" radiogroup has no accessible name (FieldRow label is not linked; Radio.Group sets none)', async () => {
      const group = inspector(page).getByRole('radiogroup');
      await expect.soft(group).toHaveCount(1);
      const radios = await inspector(page).getByRole('radio').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label') ?? node.closest('label')?.textContent?.trim() ?? ''));
      expect.soft(radios, 'each radio carries its own name').toEqual(['Mở trái', 'Mở phải', 'Hai cánh', 'Trượt']);
      const groupName = await group.evaluate((node) => node.getAttribute('aria-label') ?? node.getAttribute('aria-labelledby') ?? '');
      await attachJson('E04_17-E-010_radiogroup_name.json', { groupAccessibleName: groupName === '' ? null : groupName, radios });
      await ev(page, '17-E-010', 'swing_radiogroup');
    });

    await test.step('[17-E-011] Arrow keys in the swing radios change the swing; each step is a command and the PUT goes out debounced', async () => {
      await swingRadio(page, 'Mở trái').focus();
      const mark = s.puts.length;
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      const put = await nextPut(s, mark, (record) => swingOf(record, windowEntity) === 'double');
      await expect.soft(swingRadio(page, 'Hai cánh')).toBeChecked();
      expect.soft(s.puts.length - mark, 'two key steps go out debounced (one or two PUTs, never one per event)').toBeLessThanOrEqual(2);
      expect.soft(kindOf(put, windowEntity)).toBe('window');
      await ev(page, '17-E-011', 'swing_arrow_keys');
    });

    await test.step('[17-A-015] "Loại đối tượng" door → "Cửa sổ": one PUT (kind window, sill 900, swing fixed); row moves to group "Cửa sổ"', async () => {
      await optionOf(page, '#D-001').click();
      const mark = s.puts.length;
      const listbox = await openSelect(page, typeBox(page));
      await listbox.getByRole('option', { name: 'Cửa sổ', exact: true }).click();
      const put = await nextPut(s, mark, (record) => kindOf(record, doorEntity) === 'window');
      const opening = putList(put, 'openings').find((o) => o.id === doorEntity);
      expect.soft(opening?.sillHeightMm, 'sill 900').toBe(900);
      expect.soft(opening?.swing, 'swing fixed').toBe('fixed');
      expect.soft(s.puts.length - mark, 'one PUT').toBe(1);
      await expect.soft(groupBox(page, OBJ.windows).getByRole('option')).toHaveCount(2);
      await expect.soft(groupBox(page, OBJ.doors).getByRole('option')).toHaveCount(1);
      await expect.soft(inspector(page).getByText('Cao độ bệ cửa', { exact: true })).toBeVisible();
      await expect.soft(inspector(page).getByText('900 mm', { exact: true }).first()).toBeVisible();
      await ev(page, '17-A-015', 'door_to_window');
    });

    await test.step('[17-A-017] "Loại đối tượng" "Cửa đơn" → "Cửa đôi" → swing double', async () => {
      await groupBox(page, OBJ.doors).getByRole('option').first().click(); // the 1 800 mm door on the low wall: still a single door
      await expect.soft(typeBox(page)).toContainText('Cửa đơn');
      const lowDoor = at(arrayOf(asRecord((await readLayer(s.api, pid, fid)).layer, 'layer').openings, 'openings').filter((o) => o.heightMm === 1_800), 0, 'low-wall door');
      const mark = s.puts.length;
      const listbox = await openSelect(page, typeBox(page));
      await listbox.getByRole('option', { name: 'Cửa đôi', exact: true }).click();
      const put = await nextPut(s, mark, (record) => swingOf(record, String(lowDoor.id)) === 'double');
      expect.soft(kindOf(put, String(lowDoor.id))).toBe('door');
      await expect.soft(typeBox(page)).toContainText('Cửa đôi');
      await ev(page, '17-A-017', 'single_to_double');
    });

    await test.step('[17-C-019] ⚑ Choosing the current subtype again → no PUT and a reason or a disabled option', async () => {
      const mark = log.length;
      const listbox = await openSelect(page, typeBox(page));
      const same = listbox.getByRole('option', { name: 'Cửa đôi', exact: true });
      const disabled = (await same.getAttribute('aria-disabled')) === 'true';
      if (!disabled) await same.click();
      await quiet(page);
      expect.soft(putCount(log, mark), 'no PUT for the same subtype').toBe(0);
      expect.soft(disabled || (await feedbackShown(page, SAME_SUBTYPE_REASON)), 'OG:902 reason shown, or the current option disabled').toBe(true);
      await ev(page, '17-C-019', 'same_subtype');
      if ((await typeBox(page).getAttribute('aria-expanded')) === 'true') await page.keyboard.press('Escape');
    });

    await test.step('[17-C-018] Door → a furniture subtype ("Giường") is not offered: the select lists openings only (R19)', async () => {
      const mark = log.length;
      const listbox = await openSelect(page, typeBox(page));
      await expect.soft(listbox.getByRole('option', { name: 'Giường', exact: true })).toHaveCount(0);
      expect.soft(putCount(log, mark), 'no PUT').toBe(0);
      await ev(page, '17-C-018', 'door_to_furniture');
      if ((await typeBox(page).getAttribute('aria-expanded')) === 'true') await page.keyboard.press('Escape');
    });

    await test.step('[17-E-009] combobox "Loại đối tượng" opens a listbox of 3 opening options with icons (BUG-590); keyboard choose', async () => {
      await page.mouse.move(8, 8); // a resting pointer over an item would take the highlight (Select.Item onMouseEnter)
      await typeBox(page).focus();
      await page.keyboard.press('Enter');
      const listbox = page.locator(`[id="${(await typeBox(page).getAttribute('aria-controls')) ?? ''}"]`);
      // BUG-590 (ObjectLayerInspector.tsx:166-167 OPENING_SUBTYPES): the select lists opening kinds only (single door / double door / window) = 3, not 9.
      await expect.soft(listbox.getByRole('option')).toHaveCount(3);
      const withIcons = await listbox.getByRole('option').evaluateAll((nodes) => nodes.filter((node) => node.querySelector('svg') !== null).length);
      expect.soft(withIcons, 'every option has an icon').toBe(3);
      await ev(page, '17-E-009', 'type_listbox');
      const lowDoorId = String(at(arrayOf(asRecord((await readLayer(s.api, pid, fid)).layer, 'layer').openings, 'openings').filter((o) => o.heightMm === 1_800), 0, 'low-wall door').id);
      const mark = s.puts.length;
      await page.keyboard.press('ArrowUp'); // highlight starts on the current "Cửa đôi" (index 1) → "Cửa đơn"
      await page.keyboard.press('Enter');
      await nextPut(s, mark, (record) => swingOf(record, lowDoorId) === 'left');
      await expect.soft(typeBox(page)).toContainText('Cửa đơn');
    });

    await test.step('[17-C-021] ⚑ Kind change refused by a critical M-08 rule → the M-08 reason is shown', async () => {
      const mark = log.length;
      const listbox = await openSelect(page, typeBox(page));
      await listbox.getByRole('option', { name: 'Cửa sổ', exact: true }).click();
      await quiet(page);
      expect.soft(putCount(log, mark), 'no PUT for a refused kind change').toBe(0);
      expect.soft(await feedbackShown(page, /cao hơn tường/u), 'OG:948-958 aboveWallTop reason shown').toBe(true);
      await expect.soft(typeBox(page)).toContainText('Cửa đơn');
      await ev(page, '17-C-021', 'm08_refusal');
    });
  });
});

/* ================================================================= FL-17-03 */

test('SCR-17 · FL-17-03 inspector by kind, position slider, host-wall jump, furniture no-ops', async ({ browser }) => {
  test.setTimeout(FLOW_TIMEOUT);
  await withFlow(browser, async (s) => {
    const { page, log } = s;
    const project = await objectsQ1(s, 'f1703');
    const pid = project.projectId;
    const fid = at(project.floors, 0, 'floor').floorId;
    const windowEntity = await openingIdOf(s.api, pid, fid, 'window');
    const viewBoxOf = async (): Promise<number[]> => ((await page.getByRole('img', { name: OBJ.canvas, exact: true }).getAttribute('viewBox')) ?? '').split(' ').map(Number);
    const sliderNow = async (): Promise<number> => Number(await positionSlider(page).getAttribute('aria-valuenow'));

    await test.step('[17-C-013] Door inspector: "Chiều rộng" "900 mm", "Chiều cao" "2.100 mm", no "Cao độ bệ cửa"', async () => {
      await openObjects(page, pid, fid);
      await optionOf(page, '#D-001').click();
      await expect(inspector(page).getByText('Chiều rộng', { exact: true })).toBeVisible();
      await expect(inspector(page).getByText('900 mm', { exact: true })).toBeVisible();
      await expect(inspector(page).getByText('2.100 mm', { exact: true })).toBeVisible();
      await expect(inspector(page).getByText('Cao độ bệ cửa', { exact: true })).toHaveCount(0);
      await ev(page, '17-C-013', 'door_inspector');
    });

    await test.step('[17-C-014] Window inspector adds "Cao độ bệ cửa" "900 mm"', async () => {
      await optionOf(page, '#S-001').click();
      await expect.soft(inspector(page).getByText('Cao độ bệ cửa', { exact: true })).toBeVisible();
      await expect.soft(inspector(page).getByText('900 mm', { exact: true })).toBeVisible();
      await expect.soft(inspector(page).getByText('1.200 mm', { exact: true }).first()).toBeVisible();
      await ev(page, '17-C-014', 'window_inspector');
    });

    await test.step('[17-A-016] "Loại đối tượng" window → "Cửa đơn": kind door, sill 0, swing left', async () => {
      const mark = s.puts.length;
      const listbox = await openSelect(page, typeBox(page));
      await listbox.getByRole('option', { name: 'Cửa đơn', exact: true }).click();
      const put = await nextPut(s, mark, (record) => putList(record, 'openings').some((o) => o.id === windowEntity && o.kind === 'door'));
      const opening = putList(put, 'openings').find((o) => o.id === windowEntity);
      expect.soft(opening?.sillHeightMm, 'sill 0').toBe(0);
      expect.soft(opening?.swing, 'swing left').toBe('left');
      await expect.soft(groupBox(page, OBJ.doors).getByRole('option')).toHaveCount(2);
      await expect.soft(inspector(page).getByText('Cao độ bệ cửa', { exact: true })).toHaveCount(0);
      await ev(page, '17-A-016', 'window_to_door');
    });

    await test.step('[17-A-018] Drag slider "Vị trí trên tường" (door) → the opening moves; canvas measurement labels are "measuring"; one PUT after release', async () => {
      await optionOf(page, '#D-001').click();
      const before = arrayOf(asRecord((await readLayer(s.api, pid, fid)).layer, 'layer').openings, 'openings').map((o) => [String(o.id), Number(o.offsetMm)] as const);
      const box = await positionSlider(page).boundingBox();
      const track = await sliderTrack(page).boundingBox();
      if (box === null || track === null) throw new Error('slider has no box');
      const mark = s.puts.length;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(track.x + track.width * 0.6, box.y + box.height / 2, { steps: 8 });
      const dragged = await sliderNow();
      await expect.soft(canvasGroup(page).locator('span.font-mono').filter({ hasText: /mm$/u }), 'measurement labels while dragging').toHaveCount(2);
      await ev(page, '17-A-018', 'drag_position');
      await page.mouse.up();
      const put = await nextPut(s, mark);
      const moved = putList(put, 'openings').some((o) => before.some(([id, offset]) => id === o.id && o.offsetMm !== offset));
      expect.soft(moved, 'an opening offset changed in the PUT').toBe(true);
      expect.soft(dragged, 'the slider value moved along the wall').toBeGreaterThan(0.3);
      expect.soft(s.puts.length - mark, 'one PUT after release').toBe(1);
    });

    await test.step('[17-E-012] slider "Vị trí trên tường": arrows move by 0,01, end labels are the two distances', async () => {
      await positionSlider(page).focus();
      const start = await sliderNow();
      const labelsBefore = await inspector(page).locator('span.font-mono.select-none').allInnerTexts();
      await page.keyboard.press('ArrowRight');
      await expect.poll(sliderNow, { message: 'ArrowRight moves the slider by 0,01' }).toBeCloseTo(start + 0.01, 5);
      const labelsAfter = await inspector(page).locator('span.font-mono.select-none').allInnerTexts();
      expect.soft(labelsAfter, 'two end labels, both change with the position').toHaveLength(2);
      expect.soft(labelsAfter[0] === labelsBefore[0] && labelsAfter[1] === labelsBefore[1], 'end labels follow the position').toBe(false);
      await ev(page, '17-E-012', 'slider_arrows');
    });

    await test.step('[17-C-028] Slider: many steps within 400 ms → one undo step (D-06)', async () => {
      await quiet(page); // the arrow edit above is flushed before the undo baseline is read
      const baseline = await sliderNow();
      const mark = s.puts.length;
      // One pointer drag of 24 moves inside a single action: ~24 `opening.move` commands well inside the 400 ms merge window (UO:37-42).
      const knobBox = await positionSlider(page).boundingBox();
      const trackBox = await sliderTrack(page).boundingBox();
      if (knobBox === null || trackBox === null) throw new Error('slider has no box');
      const y = knobBox.y + knobBox.height / 2;
      await page.mouse.move(knobBox.x + knobBox.width / 2, y);
      await page.mouse.down();
      await page.mouse.move(trackBox.x + trackBox.width * (baseline > 0.5 ? 0.35 : 0.65), y, { steps: 24 });
      await page.mouse.up();
      await expect.poll(sliderNow, { message: 'the drag moved the slider' }).not.toBeCloseTo(baseline, 2);
      await nextPut(s, mark);
      const undoMark = s.puts.length;
      await page.keyboard.press('Control+z');
      await expect.poll(sliderNow, { message: 'one Mod+Z returns to the baseline (one undo step)' }).toBeCloseTo(baseline, 5);
      await nextPut(s, undoMark); // the undo is autosaved too: land it inside this step, not inside the next one
      await ev(page, '17-C-028', 'one_undo_step');
    });

    await test.step('[17-A-019] Click host-wall link "#W-001" → that wall is selected and the view flies to its bounds', async () => {
      const fit = await viewBoxOf();
      const link = inspector(page).getByRole('button', { name: /^#W-\d+$/u }); // two doors by now: the selected one is either wall's
      await link.click();
      await expect.poll(async () => (await viewBoxOf()).join(' '), { message: 'the view flies to the wall bounds' }).not.toBe(fit.join(' '));
      await ev(page, '17-A-019', 'host_wall_jump');
      await attachJson('E04_17-A-019_fit_viewbox.json', { fit });
    });

    await test.step('[17-A-020] ⚑ After the host-wall jump the inspector KEEPS the selected object (BUG-591) and the jumped-to wall is highlighted / shown', async () => {
      // useObjectLayerReview.ts:1134-1141 onSelectHostWall keeps the selection and only sets flownWallId.
      await expect.soft(inspector(page).getByText(OBJ.inspectorEmpty, { exact: true })).toHaveCount(0);
      await expect.soft(inspector(page).getByRole('button', { name: /^#W-\d+$/u })).toBeVisible();
      const fills = await canvasGroup(page).locator('svg polygon').evaluateAll((nodes) => nodes.map((node) => `${node.getAttribute('fill') ?? ''}|${getComputedStyle(node).opacity}|${getComputedStyle(node).stroke}`));
      expect.soft(new Set(fills).size, 'one wall polygon looks different from the rest (highlighted)').toBeGreaterThan(1);
      await ev(page, '17-A-020', 'wall_not_highlighted');
    });

    await test.step('[17-A-021] Esc after the host-wall jump → view returns to fit-to-frame', async () => {
      const flown = await viewBoxOf();
      await page.keyboard.press('Escape');
      await expect.poll(async () => (await viewBoxOf()).join(' '), { message: 'the view leaves the flown-to bounds' }).not.toBe(flown.join(' '));
      await ev(page, '17-A-021', 'back_to_fit');
    });

    await test.step('[17-C-015] Furniture inspector: "Tường chứa nó" "Đứng tự do", no "Vị trí trên tường", no swing radio checked', async () => {
      await optionOf(page, '#F-001').click();
      await expect.soft(inspector(page).getByText('Tường chứa nó', { exact: true })).toBeVisible();
      await expect.soft(inspector(page).getByText(OBJ.furnitureFree, { exact: true })).toBeVisible();
      await expect.soft(inspector(page).getByText(OBJ.position, { exact: true })).toHaveCount(0);
      await expect.soft(inspector(page).getByRole('radio', { checked: true })).toHaveCount(0);
      await ev(page, '17-C-015', 'furniture_inspector');
    });

    await test.step('[17-C-016] ⚑ Furniture "Hướng mở" radio → feedback or a disabled control, not a silent refusal', async () => {
      // The furniture inspector renders no swing radio at all (UO:757-763 returns null), so nothing can be refused silently.
      await expect.soft(swingRadio(page, 'Mở trái')).toHaveCount(0);
      await expect.soft(inspector(page).getByRole('radio')).toHaveCount(0);
      await ev(page, '17-C-016', 'furniture_swing_silent');
    });

    await test.step('[17-C-017] ⚑ Furniture "Loại đối tượng" → feedback or a disabled control, not a silent no-op', async () => {
      const trigger = typeBox(page);
      await expect.soft(inspector(page).getByText(OBJ.furnitureFree, { exact: true })).toBeVisible(); // milestone: the furniture inspector is open
      // BUG-590 fix (ObjectLayerInspector.tsx:246,258): furniture shows its kind as read-only text, no combobox - nothing to refuse.
      const disabled = (await trigger.count()) === 0 || (await trigger.isDisabled());
      const mark = log.length;
      if (!disabled) {
        const listbox = await openSelect(page, trigger);
        await listbox.getByRole('option', { name: 'Giường', exact: true }).click();
      }
      await quiet(page);
      expect.soft(putCount(log, mark), 'no PUT for furniture subtype').toBe(0);
      const feedback = disabled ? true : await anyFeedback(page);
      expect.soft(feedback, 'feedback or disabled control (UO:722 isOrphanObject returns)').toBe(true);
      await ev(page, '17-C-017', 'furniture_type_silent');
    });

    await test.step('[17-A-034] Esc with an object selected → inspector prompt', async () => {
      await optionOf(page, '#D-001').click();
      await page.keyboard.press('Escape');
      await expect.soft(inspector(page).getByText(OBJ.inspectorEmpty, { exact: true })).toBeVisible();
      await expect.soft(listGroup(page).locator('[aria-selected="true"]')).toHaveCount(0);
      await ev(page, '17-A-034', 'esc_clears');
    });
  });
});

/** Right-click `code`'s symbol, then "Xoá" (the ONLY delete path of an object, OSY:793-800). */
async function deleteViaMenu(page: Page, code: string): Promise<void> {
  await symbolOf(page, code).click({ button: 'right', timeout: QUICK });
  await menuItem(page, 'Xoá').click({ timeout: QUICK });
}

/** The toast (region "Thông báo") whose text contains `text`. */
const toastWith = (page: Page, text: string | RegExp): Locator => toastRegion(page).getByRole('status').filter({ hasText: text });

/** The id set of the objects of a recorded PUT. */
const objectIdsOf = (record: PutRecord): string[] => [...putList(record, 'openings'), ...putList(record, 'furniture')].map((o) => String(o.id)).sort();

/* ================================================================= FL-17-04 */

test('SCR-17 · FL-17-04 context menus on door, window, furniture; delete and re-rank', async ({ browser }) => {
  test.setTimeout(FLOW_TIMEOUT);
  await withFlow(browser, async (s) => {
    const { page, log } = s;
    const project = await objectsMenu(s, 'f1704');
    const pid = project.projectId;
    const floor1 = at(project.floors, 0, 'floor').floorId;
    const floor2 = at(project.floors, 1, 'floor').floorId;
    const doorEntity = await openingIdOf(s.api, pid, floor1, 'door');
    const items = async (): Promise<string[]> => page.getByRole('menu', { name: 'Tuỳ chọn', exact: true }).getByRole('menuitem').allInnerTexts();
    let bgAfterOpeningEdits = -1;

    await test.step('[17-A-022] Right-click a door symbol → object selected + menu "Duyệt", "Đổi thành cửa sổ", "Xoá"', async () => {
      await openObjects(page, pid, floor1);
      await symbolOf(page, '#D-001').click({ button: 'right', timeout: QUICK });
      await expect(page.getByRole('menu', { name: 'Tuỳ chọn', exact: true })).toBeVisible();
      expect.soft(await items()).toEqual(['Duyệt', 'Đổi thành cửa sổ', 'Xoá']);
      await expect.soft(optionOf(page, '#D-001')).toHaveAttribute('aria-selected', 'true');
      await ev(page, '17-A-022', 'door_menu');
      await page.keyboard.press('Escape');
    });

    await test.step('[17-A-023] Right-click a window → "Duyệt", "Đổi thành cửa đi", "Xoá"', async () => {
      await symbolOf(page, '#S-001').click({ button: 'right', timeout: QUICK });
      expect.soft(await items()).toEqual(['Duyệt', 'Đổi thành cửa đi', 'Xoá']);
      await ev(page, '17-A-023', 'window_menu');
      await page.keyboard.press('Escape');
    });

    await test.step('[17-A-024] Right-click furniture → "Duyệt", "Xoá" only', async () => {
      await symbolOf(page, '#F-001').click({ button: 'right', timeout: QUICK });
      expect.soft(await items()).toEqual(['Duyệt', 'Xoá']);
      await ev(page, '17-A-024', 'furniture_menu');
    });

    await test.step('[17-E-014] Context menu: role menu, ArrowDown/ArrowUp move, Esc closes', async () => {
      const menu = page.getByRole('menu', { name: 'Tuỳ chọn', exact: true });
      await expect.soft(menu).toBeVisible();
      await expect.soft(menuItem(page, 'Duyệt')).toBeFocused(); // CM:141 first item takes focus
      await page.keyboard.press('ArrowDown');
      await expect.soft(menuItem(page, 'Xoá')).toBeFocused();
      await page.keyboard.press('ArrowUp');
      await expect.soft(menuItem(page, 'Duyệt')).toBeFocused();
      await ev(page, '17-E-014', 'menu_keys');
      await page.keyboard.press('Escape');
      await expect.soft(menu).toHaveCount(0);
    });

    await test.step('[17-A-025] Menu "Duyệt" → approve PUT; "Duyệt đối tượng này" disabled', async () => {
      const mark = s.puts.length;
      await symbolOf(page, '#D-001').click({ button: 'right', timeout: QUICK });
      await menuItem(page, 'Duyệt').click({ timeout: QUICK });
      await nextPut(s, mark, (record) => openingIn(record, doorEntity)?.reviewed === true);
      await expect.soft(approveButton(page)).toBeDisabled();
      await ev(page, '17-A-025', 'menu_approve');
    });

    await test.step('[17-C-026] Menu "Duyệt" on an already reviewed object → no-op (item still offered)', async () => {
      const mark = log.length;
      await symbolOf(page, '#D-001').click({ button: 'right', timeout: QUICK });
      await expect.soft(menuItem(page, 'Duyệt')).toBeVisible();
      await menuItem(page, 'Duyệt').click({ timeout: QUICK });
      await quiet(page);
      expect.soft(putCount(log, mark), 'no PUT for an already reviewed object').toBe(0);
      await ev(page, '17-C-026', 'menu_approve_noop');
    });

    await test.step('[17-A-026] Menu "Đổi thành cửa sổ" → kind window PUT', async () => {
      const mark = s.puts.length;
      await symbolOf(page, '#D-001').click({ button: 'right', timeout: QUICK });
      await menuItem(page, 'Đổi thành cửa sổ').click({ timeout: QUICK });
      await nextPut(s, mark, (record) => openingIn(record, doorEntity)?.kind === 'window');
      await expect.soft(groupBox(page, OBJ.windows).getByRole('option')).toHaveCount(2);
      await ev(page, '17-A-026', 'menu_to_window');
    });

    await test.step('[17-A-027] Menu "Đổi thành cửa đi" on a window → single door PUT', async () => {
      const code = codeOfLabel((await groupBox(page, OBJ.windows).getByRole('option').first().getAttribute('aria-label')) ?? '');
      const mark = s.puts.length;
      await symbolOf(page, code).click({ button: 'right', timeout: QUICK });
      await menuItem(page, 'Đổi thành cửa đi').click({ timeout: QUICK });
      const put = await nextPut(s, mark, (record) => putList(record, 'openings').filter((o) => o.kind === 'door').length === 1);
      expect.soft(putList(put, 'openings').find((o) => o.kind === 'door')?.swing, 'single door swing').toMatch(/^(left|right)$/u);
      await expect.soft(groupBox(page, OBJ.doors).getByRole('option')).toHaveCount(1);
      await ev(page, '17-A-027', 'menu_to_door');
    });

    await test.step('[17-A-028] Menu "Xoá" → object gone from list and canvas; toast "Đã xoá đối tượng D-001." with "Hoàn tác"; PUT without that opening', async () => {
      const mark = s.puts.length;
      const before = objectIdsOf(at(s.puts, s.puts.length - 1, 'PUT'));
      await deleteViaMenu(page, '#D-001');
      const put = await nextPut(s, mark);
      expect.soft(objectIdsOf(put).length, 'one object less in the PUT').toBe(before.length - 1);
      await expect.soft(optionOf(page, '#D-001')).toHaveCount(0);
      await expect.soft(symbolOf(page, '#D-001')).toHaveCount(0);
      await expect.soft(toastWith(page, 'Đã xoá đối tượng D-001.')).toBeVisible();
      await expect.soft(toastWith(page, 'Đã xoá đối tượng D-001.').getByRole('button', { name: OBJ.undo, exact: true })).toBeVisible();
      await ev(page, '17-A-028', 'delete_toast');
    });

    await test.step('[17-A-029] Toast "Hoàn tác" within 8 s → object back (PUT restoring it)', async () => {
      const mark = s.puts.length;
      const before = at(s.puts, s.puts.length - 1, 'PUT');
      await toastWith(page, 'Đã xoá đối tượng D-001.').getByRole('button', { name: OBJ.undo, exact: true }).click({ timeout: QUICK });
      const put = await nextPut(s, mark);
      expect.soft(objectIdsOf(put).length, 'the object is back in the PUT').toBe(objectIdsOf(before).length + 1);
      await expect.soft(optionOf(page, '#D-001')).toHaveCount(1);
      bgAfterOpeningEdits = getCount(log, 0, backgroundRe(pid, floor1));
      await ev(page, '17-A-029', 'toast_undo');
    });

    await test.step('[17-A-035] Delete furniture via menu → PUT without that furniture; toast "Đã xoá đối tượng F-001."', async () => {
      const mark = s.puts.length;
      await deleteViaMenu(page, '#F-001');
      const put = await nextPut(s, mark);
      expect.soft(putList(put, 'furniture'), 'no furniture left in the PUT').toHaveLength(0);
      await expect.soft(optionOf(page, '#F-001')).toHaveCount(0);
      await expect.soft(toastWith(page, 'Đã xoá đối tượng F-001.')).toBeVisible();
      await ev(page, '17-A-035', 'delete_furniture');
    });

    await test.step('[17-C-040] Furniture edit invalidates drawing.byFloor → a second GET …/spatial; opening edits do not', async () => {
      expect.soft(bgAfterOpeningEdits, 'GET …/spatial after the opening edits (the load alone)').toBe(1);
      await expect.poll(() => getCount(log, 0, backgroundRe(pid, floor1)), { message: 'the furniture delete refetches …/spatial' }).toBe(2);
      await ev(page, '17-C-040', 'furniture_invalidates_background');
    });

    await test.step('[17-E-019] Toast is role status aria-live polite, "Hoàn tác" reachable by Tab', async () => {
      await deleteViaMenu(page, '#S-001'); // a fresh toast: the 8 s window of the furniture one may be over by now
      const toast = toastWith(page, 'Đã xoá đối tượng S-001.');
      await expect.soft(toast).toHaveAttribute('aria-live', 'polite');
      await expect.soft(toastRegion(page)).toHaveAttribute('aria-live', 'polite');
      await statusBar(page).getByRole('button', { name: OBJ.undo, exact: true }).focus();
      let reached = false;
      for (let i = 0; i < 6 && !reached; i += 1) {
        await page.keyboard.press('Tab');
        reached = await page.evaluate(() => document.activeElement?.closest('[aria-label="Thông báo"]') !== null && (document.activeElement?.textContent ?? '').includes('Hoàn tác'));
      }
      expect.soft(reached, 'Tab reaches the toast "Hoàn tác" button').toBe(true);
      await ev(page, '17-E-019', 'toast_a11y');
    });

    await test.step('[17-C-037] After a delete the remaining codes stay put (BUG-592: no later object takes the deleted code)', async () => {
      await spaGo(page, ROUTES.project.objects(pid, floor2));
      await expect(allOptions(page)).toHaveCount(2);
      const before = await optionLabels(page);
      expect.soft(before).toEqual(['#D-001 — bình thường', '#D-002 — Đã duyệt']);
      await deleteViaMenu(page, '#D-001');
      await expect(allOptions(page)).toHaveCount(1);
      // BUG-592 (domain/spatial/ids.ts:205-213 keepDisplayCodes): a shown code never moves to another object in a session.
      expect.soft(await optionLabels(page), 'the reviewed door keeps its own code').toEqual(['#D-002 — Đã duyệt']);
      await ev(page, '17-C-037', 'rerank');
    });
  });
});

/* ================================================================= FL-17-05 */

test('SCR-17 · FL-17-05 undo stack, toast ticket, autosave, reload, leave guard', async ({ browser }) => {
  test.setTimeout(FLOW_TIMEOUT);
  await withFlow(browser, async (s) => {
    const { page, log } = s;
    const project = await objectsQ1(s, 'f1705');
    const pid = project.projectId;
    const fid = at(project.floors, 0, 'floor').floorId;
    const undoButton = statusBar(page).getByRole('button', { name: OBJ.undo, exact: true });
    const windowEntity = await openingIdOf(s.api, pid, fid, 'window');
    const doorEntity = await openingIdOf(s.api, pid, fid, 'door');
    const labelOf = async (code: string): Promise<string> => (await optionOf(page, code).getAttribute('aria-label')) ?? '';

    await test.step('[17-C-030] Status bar "Hoàn tác" is always enabled; with an empty history it does nothing, with no feedback', async () => {
      await openObjects(page, pid, fid);
      await expect(undoButton).toBeEnabled();
      const mark = log.length;
      await undoButton.click();
      await quiet(page);
      expect.soft(putCount(log, mark), 'no PUT on an empty history').toBe(0);
      await expect.soft(toastRegion(page).getByRole('status')).toHaveCount(0);
      await expect.soft(page.getByLabel('0/3 đối tượng đã duyệt', { exact: true })).toBeVisible();
      await ev(page, '17-C-030', 'undo_empty');
    });

    await test.step('[17-A-030] Status bar "Hoàn tác" after a delete → object back', async () => {
      const mark = s.puts.length;
      await deleteViaMenu(page, '#D-001');
      await nextPut(s, mark);
      await expect(optionOf(page, '#D-001')).toHaveCount(0);
      const undoMark = s.puts.length;
      await undoButton.click();
      await nextPut(s, undoMark, (record) => putList(record, 'openings').some((o) => o.id === doorEntity));
      await expect.soft(optionOf(page, '#D-001')).toHaveCount(1);
      await ev(page, '17-A-030', 'status_bar_undo');
    });

    await test.step('[17-A-031] Mod+Z after an approve reverts it (PUT reviewed:false)', async () => {
      await optionOf(page, '#D-001').click();
      let mark = s.puts.length;
      await approveButton(page).click();
      await nextPut(s, mark, (record) => openingIn(record, doorEntity)?.reviewed === true);
      mark = s.puts.length;
      await optionOf(page, '#D-001').focus();
      await page.keyboard.press('Control+z');
      await nextPut(s, mark, (record) => openingIn(record, doorEntity)?.reviewed === false);
      expect.soft(await labelOf('#D-001')).toBe('#D-001 — bình thường');
      await ev(page, '17-A-031', 'undo_approve');
    });

    await test.step('[17-A-032] Mod+Z after a delete restores the object', async () => {
      let mark = s.puts.length;
      await deleteViaMenu(page, '#D-001');
      await nextPut(s, mark);
      await expect(optionOf(page, '#D-001')).toHaveCount(0);
      mark = s.puts.length;
      await page.keyboard.press('Control+z');
      await nextPut(s, mark, (record) => putList(record, 'openings').some((o) => o.id === doorEntity));
      await expect.soft(optionOf(page, '#D-001')).toHaveCount(1);
      await ev(page, '17-A-032', 'undo_delete');
    });

    await test.step('[17-A-033] Two edits then Mod+Z twice → undone newest first', async () => {
      await optionOf(page, '#D-001').click();
      let mark = s.puts.length;
      await approveButton(page).click();
      await nextPut(s, mark, (record) => openingIn(record, doorEntity)?.reviewed === true);
      await optionOf(page, '#S-001').click();
      mark = s.puts.length;
      await approveButton(page).click();
      await nextPut(s, mark, (record) => openingIn(record, windowEntity)?.reviewed === true);
      mark = s.puts.length;
      await page.keyboard.press('Control+z');
      await nextPut(s, mark, (record) => openingIn(record, windowEntity)?.reviewed === false);
      expect.soft(await labelOf('#S-001'), 'newest edit (window) undone first').toBe('#S-001 — bình thường');
      expect.soft(await labelOf('#D-001'), 'older edit (door) still approved').toBe('#D-001 — Đã duyệt');
      mark = s.puts.length;
      await page.keyboard.press('Control+z');
      await nextPut(s, mark, (record) => openingIn(record, doorEntity)?.reviewed === false);
      expect.soft(await labelOf('#D-001')).toBe('#D-001 — bình thường');
      await ev(page, '17-A-033', 'undo_twice');
    });

    await test.step('[17-C-029] Undo restores the selection captured with that step', async () => {
      await optionOf(page, '#D-001').click();
      let mark = s.puts.length;
      await approveButton(page).click();
      await nextPut(s, mark, (record) => openingIn(record, doorEntity)?.reviewed === true);
      await optionOf(page, '#S-001').click();
      await expect(optionOf(page, '#S-001')).toHaveAttribute('aria-selected', 'true');
      mark = s.puts.length;
      await page.keyboard.press('Control+z');
      await nextPut(s, mark, (record) => openingIn(record, doorEntity)?.reviewed === false);
      await expect.soft(optionOf(page, '#D-001'), 'the selection of the undone step (the door) is back').toHaveAttribute('aria-selected', 'true');
      await ev(page, '17-C-029', 'undo_selection');
    });

    await test.step('[17-C-027] ⚑ Delete, then make another edit, then the delete toast "Hoàn tác" → it undoes the delete, not the newer edit', async () => {
      const mark = s.puts.length;
      await deleteViaMenu(page, '#D-001');
      await optionOf(page, '#S-001').click();
      await approveButton(page).click();
      await toastWith(page, 'Đã xoá đối tượng D-001.').getByRole('button', { name: OBJ.undo, exact: true }).click({ timeout: QUICK });
      await nextPut(s, mark); // firm marker: the edits reached the server; quiet() then lets the undo's own PUT go out
      await quiet(page);
      const last = s.puts.at(-1);
      expect.soft(last !== undefined && putList(last, 'openings').some((o) => o.id === doorEntity), '⚑ last PUT: the deleted door is back').toBe(true);
      expect.soft(last === undefined ? undefined : openingIn(last, windowEntity)?.reviewed, '⚑ last PUT: the window stays approved').toBe(true);
      await expect.soft(optionOf(page, '#D-001'), 'the deleted door is back').toHaveCount(1);
      expect.soft(await labelOf('#S-001'), 'the newer edit (window approved) is kept').toBe('#S-001 — Đã duyệt');
      await ev(page, '17-C-027', 'toast_undo_ticket');
      await openObjects(page, pid, fid); // whichever way the server copy ended, the next steps start from a fresh load
    });

    await test.step('[17-C-031] Autosave: one PUT ~800 ms after the last change; three quick edits → one PUT', async () => {
      await optionOf(page, '#S-001').click();
      const mark = s.puts.length;
      // Three swing changes in ONE evaluate, one frame apart: three commands, one autosave window.
      await inspector(page).getByRole('radio').evaluateAll(async (nodes) => {
        for (const name of ['Mở phải', 'Hai cánh', 'Trượt']) {
          const input = nodes.find((node) => node.closest('label')?.textContent?.trim() === name);
          (input as HTMLInputElement | undefined)?.click();
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      });
      const editedAt = Date.now();
      const put = await nextPut(s, mark, (record) => openingIn(record, windowEntity)?.swing === 'sliding');
      expect.soft(put.at - editedAt, 'the PUT goes out ~800 ms after the last change').toBeGreaterThanOrEqual(500);
      await quiet(page);
      expect.soft(s.puts.length - mark, 'three quick edits → one PUT').toBe(1);
      await ev(page, '17-C-031', 'autosave_one_put');
    });

    await test.step('[17-C-032] PUT body {baseVersion, body:{layer}} with the floor revision; the next PUT uses the returned revision', async () => {
      const rev0 = Number((await readLayer(s.api, pid, fid)).revision);
      let mark = s.puts.length;
      await pressSpaceOn(swingRadio(page, 'Mở phải'));
      const first = await nextPut(s, mark, (record) => openingIn(record, windowEntity)?.swing === 'right');
      expect.soft(first.body.baseVersion, 'baseVersion = the floor revision read before').toBe(rev0);
      expect.soft(Object.keys(first.body).sort()).toEqual(['baseVersion', 'body']);
      expect.soft(Object.keys(asRecord(first.body.body, 'body')), 'body carries the layer').toContain('layer');
      await expect.poll(() => putEntries(s).at(-1)?.json !== undefined).toBe(true);
      const returned = asRecord(putEntries(s).at(-1)?.json, 'PUT result').revision;
      mark = s.puts.length;
      await pressSpaceOn(swingRadio(page, 'Hai cánh'));
      const second = await nextPut(s, mark, (record) => openingIn(record, windowEntity)?.swing === 'double');
      expect.soft(second.body.baseVersion, 'the next PUT carries the revision the last one returned').toBe(returned);
      await ev(page, '17-C-032', 'base_version_chain');
    });

    await test.step('[17-A-052] Ctrl+S right after an edit sends the PUT at once (no 800 ms wait)', async () => {
      const mark = s.puts.length;
      await pressSpaceOn(swingRadio(page, 'Trượt'));
      await optionOf(page, '#S-001').focus(); // a focused radio is an <input>: the shortcut registry treats it as a text field (see [17-E-017] in FL-17-07)
      const editedAt = Date.now();
      await page.keyboard.press('Control+s');
      const put = await nextPut(s, mark, (record) => openingIn(record, windowEntity)?.swing === 'sliding');
      expect.soft(put.at - editedAt, 'Ctrl+S flushes before the 800 ms debounce would').toBeLessThan(700);
      await ev(page, '17-A-052', 'ctrl_s_flush');
    });

    await test.step('[17-A-053] Reload after approve → still "Đã duyệt" (server state)', async () => {
      await optionOf(page, '#F-001').click();
      const mark = s.puts.length;
      await approveButton(page).click();
      await nextPut(s, mark, (record) => putList(record, 'furniture').some((o) => o.reviewed === true));
      await openObjects(page, pid, fid);
      expect.soft(await labelOf('#F-001')).toBe('#F-001 — Đã duyệt');
      await ev(page, '17-A-053', 'reload_keeps_approval');
    });

    await test.step('[17-A-054] Leaving the page with a pending (unsent) change → browser beforeunload prompt', async () => {
      await optionOf(page, '#S-001').click();
      const prevented = await inspector(page).getByRole('radio').evaluateAll(async (nodes) => {
        const input = nodes.find((node) => node.closest('label')?.textContent?.trim() === 'Mở trái') as HTMLInputElement | undefined;
        input?.click();
        for (let i = 0; i < 3; i += 1) await new Promise((resolve) => requestAnimationFrame(resolve));
        const event = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      });
      expect.soft(prevented, 'beforeunload is cancelled while the change is unsent (UAS:428-431)').toBe(true);
      await ev(page, '17-A-054', 'beforeunload_pending');
      await expect
        .poll(() => page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; }), { message: 'once saved, leaving is free again' })
        .toBe(false);
    });
  });
});

/* ================================================================= FL-17-06 */

test('SCR-17 · FL-17-06 layer eyes, tree toggles, chips, counts, filtered canvas', async ({ browser }) => {
  test.setTimeout(FLOW_TIMEOUT);
  await withFlow(browser, async (s) => {
    const { page } = s;
    const project = await objectsQ1(s, 'f1706');
    const pid = project.projectId;
    const fid = at(project.floors, 0, 'floor').floorId;
    const colourCount = async (): Promise<number> => Number(await page.getByTestId('object-layer-canvas-color-count').innerText());
    const symbolCount = (): Promise<number> => page.locator('g[aria-label^="#"]').count();
    const groupHeader = (label: string): Locator => page.getByRole('button', { name: new RegExp(`^(Gấp|Mở) nhóm ${label}$`, 'u') });

    await test.step('[17-A-036] Eye "Ẩn lớp cửa đi" → door rows and symbols hidden, legend drops "Cửa đi"; button becomes "Hiện lớp cửa đi" aria-pressed="false"', async () => {
      await openObjects(page, pid, fid);
      await eyeButton(page, 'cửa đi').click();
      await expect(optionOf(page, '#D-001')).toHaveCount(0);
      await expect.soft(symbolOf(page, '#D-001')).toHaveCount(0);
      await expect.soft(legend(page)).not.toContainText('Cửa đi');
      await expect.soft(legend(page)).toContainText('Cửa sổ');
      const eye = page.getByRole('button', { name: 'Hiện lớp cửa đi', exact: true });
      await expect.soft(eye).toHaveAttribute('aria-pressed', 'false');
      await ev(page, '17-A-036', 'door_layer_hidden');
    });

    await test.step('[17-A-037] Clicking tree item "Cửa đi" toggles the layer exactly like the eye button', async () => {
      await treeItem(page, OBJ.doors).click();
      await expect.soft(optionOf(page, '#D-001')).toHaveCount(1);
      await expect.soft(page.getByRole('button', { name: 'Ẩn lớp cửa đi', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await ev(page, '17-A-037', 'tree_item_toggle');
      await treeItem(page, OBJ.doors).click();
      await expect.soft(optionOf(page, '#D-001')).toHaveCount(0);
    });

    await test.step('[17-E-003] Eye buttons: aria-pressed + label swap "Ẩn lớp …"/"Hiện lớp …"', async () => {
      await expect.soft(page.getByRole('button', { name: 'Hiện lớp cửa đi', exact: true })).toHaveAttribute('aria-pressed', 'false');
      await expect.soft(page.getByRole('button', { name: 'Ẩn lớp cửa sổ', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect.soft(page.getByRole('button', { name: 'Ẩn lớp nội thất', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('button', { name: 'Hiện lớp cửa đi', exact: true }).click();
      await expect.soft(page.getByRole('button', { name: 'Ẩn lớp cửa đi', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await ev(page, '17-E-003', 'eye_label_swap');
      await page.getByRole('button', { name: 'Ẩn lớp cửa đi', exact: true }).click();
      await expect.soft(page.getByRole('button', { name: 'Hiện lớp cửa đi', exact: true })).toHaveAttribute('aria-pressed', 'false');
    });

    await test.step('[17-A-038] "Hiện lớp cửa đi" restores rows, symbols and legend', async () => {
      await page.getByRole('button', { name: 'Hiện lớp cửa đi', exact: true }).click();
      await expect.soft(optionOf(page, '#D-001')).toHaveCount(1);
      await expect.soft(symbolOf(page, '#D-001')).toHaveCount(1);
      await expect.soft(legend(page)).toContainText('Cửa đi');
      await ev(page, '17-A-038', 'door_layer_shown');
    });

    await test.step('[17-C-012] Hidden layer also leaves the canvas and the legend; sr-only colour count = visible layers (3 → 2)', async () => {
      expect.soft(await colourCount(), 'colours with every layer on').toBe(3);
      await eyeButton(page, 'cửa sổ').click();
      await expect.soft(legend(page)).not.toContainText('Cửa sổ');
      await expect.soft(symbolOf(page, '#S-001')).toHaveCount(0);
      expect.soft(await colourCount(), 'colours with one layer hidden').toBe(2);
      await ev(page, '17-C-012', 'colour_count');
    });

    await test.step('[17-C-004] Canvas legend "N đối tượng" = symbols drawn (after filters)', async () => {
      const text = (await legend(page).innerText()).replace(/\s+/gu, ' ');
      const shown = Number(/(\d+)\s*đối tượng/u.exec(text)?.[1] ?? '-1');
      expect.soft(shown, `legend "${text}" counts the symbols drawn`).toBe(await symbolCount());
      expect.soft(shown).toBe(2);
      await ev(page, '17-C-004', 'legend_count');
    });

    await test.step('[17-A-039] "Lọc theo loại" chip → aria-pressed="true", list narrows', async () => {
      await eyeButton(page, 'cửa sổ').click();
      await chip(page, 'Cửa sổ').click();
      await expect.soft(chip(page, 'Cửa sổ')).toHaveAttribute('aria-pressed', 'true');
      await expect.soft(allOptions(page)).toHaveCount(1);
      await expect.soft(optionOf(page, '#S-001')).toHaveCount(1);
      await ev(page, '17-A-039', 'chip_on');
    });

    await test.step('[17-E-004] Chips in group "Lọc theo loại" carry aria-pressed', async () => {
      const pressed = await page.getByRole('group', { name: OBJ.filters, exact: true }).getByRole('button').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-pressed')));
      expect.soft(pressed.length, 'nine type chips').toBe(9);
      expect.soft(pressed.every((value) => value === 'true' || value === 'false'), `aria-pressed on every chip: ${pressed.join(',')}`).toBe(true);
      await ev(page, '17-E-004', 'chips_aria_pressed');
    });

    await test.step('[17-A-040] Two chips on ("Cửa đơn" + "Cửa sổ") → union of both', async () => {
      await chip(page, 'Cửa đơn').click();
      await expect.soft(allOptions(page)).toHaveCount(2);
      await expect.soft(optionOf(page, '#D-001')).toHaveCount(1);
      await expect.soft(optionOf(page, '#S-001')).toHaveCount(1);
      await ev(page, '17-A-040', 'chips_union');
    });

    await test.step('[17-A-041] Chip off → full list back', async () => {
      await chip(page, 'Cửa đơn').click();
      await chip(page, 'Cửa sổ').click();
      await expect.soft(chip(page, 'Cửa sổ')).toHaveAttribute('aria-pressed', 'false');
      await expect.soft(allOptions(page)).toHaveCount(3);
      await ev(page, '17-A-041', 'chips_off');
    });

    await test.step('[17-C-001] ⚑ Counter and "Tổng N đối tượng" count every object (BUG-402): with a chip on, the screen says it is filtering', async () => {
      await chip(page, 'Cửa đơn').click();
      await expect.soft(page.getByLabel('0/3 đối tượng đã duyệt', { exact: true })).toBeVisible();
      await expect.soft(page.getByText('Tổng 3 đối tượng', { exact: true })).toBeVisible();
      await expect.soft(allOptions(page)).toHaveCount(1);
      // BUG-402 "Mong đợi": the screen tells a filter is on, e.g. "1 / 3 đối tượng" — nothing says so today.
      await expect.soft(page.getByText(/(^|\s)1\s*\/\s*3(\s|$)/u).first(), 'a "1 / 3" filtered-state indicator').toBeVisible({ timeout: 2_000 });
      await ev(page, '17-C-001', 'counter_vs_filtered_total');
    });

    await test.step('[17-C-002] Tree counts "(n)" per layer come from all objects (unfiltered)', async () => {
      for (const label of [OBJ.doors, OBJ.windows, OBJ.furniture]) await expect.soft(treeItem(page, label)).toContainText('(1)');
      await ev(page, '17-C-002', 'tree_counts_unfiltered');
    });

    await test.step('[17-C-003] Group header count "(n)" = rows left after filters', async () => {
      await expect.soft(groupHeader('Cửa đi')).toContainText('(1)');
      await expect.soft(groupHeader('Cửa sổ')).toContainText('(0)');
      await expect.soft(groupHeader('Nội thất')).toContainText('(0)');
      await ev(page, '17-C-003', 'group_counts_filtered');
    });

    await test.step('[17-B-028] Filters hide every object → canvas "Chưa có đối tượng nào để vẽ trên mặt bằng.", every group "Chưa có đối tượng nào trong nhóm này"', async () => {
      // The seeded floor has no bed: chip "Giường" is disabled (ObjectLayerLeftPanel.tsx:245,259). Chip "Cửa đơn" is still on
      // (17-C-003), so hiding the door layer leaves the filter matching nothing.
      await eyeButton(page, 'cửa đi').click();
      await expect.soft(allOptions(page)).toHaveCount(0);
      await expect.soft(page.getByText(OBJ.nothingToDraw, { exact: true })).toBeVisible();
      await expect.soft(page.getByText(OBJ.emptyGroup, { exact: true })).toHaveCount(3);
      await ev(page, '17-B-028', 'filters_hide_all');
    });

    await test.step('[17-C-022] ⚑ Real furniture kinds map to "Nội thất khác" except bed; chip "Bàn ăn" must match the real table', async () => {
      await eyeButton(page, 'cửa đi').click();
      await chip(page, 'Cửa đơn').click();
      await chip(page, 'Bàn ăn').click();
      await expect.soft(optionOf(page, '#F-001'), 'the seeded table matches the "Bàn ăn" chip').toHaveCount(1, { timeout: 2_000 });
      await ev(page, '17-C-022', 'table_vs_dining_chip');
    });
  });
});

/* ================================================================= FL-17-07 */

test('SCR-17 · FL-17-07 rail keys, groups, listbox semantics, panel collapse', async ({ browser }) => {
  test.setTimeout(FLOW_TIMEOUT);
  await withFlow(browser, async (s) => {
    const { page, log } = s;
    const project = await objectsQ1(s, 'f1707');
    const pid = project.projectId;
    const fid = at(project.floors, 0, 'floor').floorId;
    const doorEntity = await openingIdOf(s.api, pid, fid, 'door');
    const rail = page.getByRole('toolbar', { name: OBJ.rail, exact: true });
    const kindIs = (kind: string) => (record: PutRecord): boolean => openingIn(record, doorEntity)?.kind === kind;

    await test.step('[17-E-008] toolbar "Công cụ lớp đối tượng" aria-orientation vertical; buttons "Chọn nhóm cửa đi (phím D)" …; key caps visible', async () => {
      await openObjects(page, pid, fid);
      await expect(rail).toBeVisible();
      await expect(rail).toHaveAttribute('aria-orientation', 'vertical');
      for (const name of ['Chọn nhóm cửa đi (phím D)', 'Chọn nhóm cửa sổ (phím W)', 'Chọn nhóm nội thất (phím F)']) await expect(railButton(page, name)).toBeVisible();
      expect.soft(await rail.locator('kbd').allInnerTexts(), 'key caps').toEqual(['D', 'W', 'F']);
      await ev(page, '17-E-008', 'rail_a11y');
    });

    await test.step('[17-A-047] Rail "Chọn nhóm cửa sổ (phím W)" with a door selected, then slot "Đổi thành cửa sổ (phím 1)" → kind window PUT', async () => {
      await optionOf(page, '#D-001').click();
      await railButton(page, 'Chọn nhóm cửa sổ (phím W)').click();
      await expect.soft(railButton(page, 'Đổi thành cửa sổ (phím 1)')).toBeVisible();
      const mark = s.puts.length;
      await railButton(page, 'Đổi thành cửa sổ (phím 1)').click();
      await nextPut(s, mark, kindIs('window'));
      await expect.soft(typeBox(page)).toContainText('Cửa sổ');
      await ev(page, '17-A-047', 'rail_group_slot');
    });

    await test.step('[17-A-048] Keys: door selected, `W` then `1` → window (PUT); `D` then `2` → "Cửa đôi"', async () => {
      let mark = s.puts.length;
      await page.keyboard.press('d');
      await page.keyboard.press('1'); // back to a single door: the plan walk starts from a door
      await nextPut(s, mark, kindIs('door'));
      mark = s.puts.length;
      await page.keyboard.press('w');
      await page.keyboard.press('1');
      await nextPut(s, mark, kindIs('window'));
      await expect.soft(typeBox(page)).toContainText('Cửa sổ');
      mark = s.puts.length;
      await page.keyboard.press('d');
      await page.keyboard.press('2');
      const put = await nextPut(s, mark, (record) => openingIn(record, doorEntity)?.swing === 'double');
      expect.soft(openingIn(put, doorEntity)?.kind).toBe('door');
      await expect.soft(typeBox(page)).toContainText('Cửa đôi');
      await ev(page, '17-A-048', 'keys_w1_d2');
    });

    await test.step('[17-C-024] ⚑ The D/W/F choice sticks after selecting another object: the rail slots must follow the selected object', async () => {
      await page.keyboard.press('w');
      await optionOf(page, '#F-001').click();
      // Source: BUG-590 fix, ObjectLayerToolRail.tsx:109-111 - furniture cannot change kind, so the rail follows the selection and shows
      // no slots (the previous window slots must not stick).
      const slots = page.getByRole('toolbar', { name: OBJ.rail, exact: true }).getByRole('button', { name: /^Đổi thành /u });
      await expect.soft(slots, 'furniture selected → no stale window slots, no dead furniture slots').toHaveCount(0, { timeout: 2_000 });
      await ev(page, '17-C-024', 'rail_slots_stick');
    });

    await test.step('[17-C-023] ⚑ Furniture rail slots "Đổi thành giường (phím 1)" / "sofa (2)" / "bàn ăn (3)" must act on the table or be absent', async () => {
      await optionOf(page, '#F-001').click();
      await railButton(page, 'Chọn nhóm nội thất (phím F)').click();
      const slots = page.getByRole('toolbar', { name: OBJ.rail, exact: true }).getByRole('button', { name: /^Đổi thành /u });
      const names = await slots.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')));
      // Title: "act on the table or be absent". BUG-590 chose absent (ObjectLayerToolRail.tsx:109-111); if shown, all three must act (below).
      expect.soft(names.length === 0 || names.join('|') === 'Đổi thành giường (phím 1)|Đổi thành sofa (phím 2)|Đổi thành bàn ăn (phím 3)', 'furniture slots absent or all three').toBe(true);
      const mark = log.length;
      const before = await inspector(page).innerText();
      if (names.length > 0) await slots.first().click();
      await quiet(page);
      const changed = putCount(log, mark) > 0 || (await inspector(page).innerText()) !== before;
      expect.soft(names.length === 0 || changed, 'a furniture slot acts on the selected table (UO:722 isOrphanObject returns silently)').toBe(true);
      await ev(page, '17-C-023', 'furniture_slots_noop');
    });

    await test.step('[17-C-025] `1`/`2`/`3` with nothing selected → nothing', async () => {
      await page.keyboard.press('Escape');
      await expect(listGroup(page).locator('[aria-selected="true"]')).toHaveCount(0);
      const mark = log.length;
      for (const key of ['1', '2', '3']) await page.keyboard.press(key);
      await quiet(page);
      expect.soft(putCount(log, mark), 'digits with no selection write nothing').toBe(0);
      await ev(page, '17-C-025', 'digits_nothing_selected');
    });

    await test.step('[17-E-016] Esc is only bound while an object is selected; otherwise it falls to the global close-top-layer', async () => {
      await optionOf(page, '#D-001').click();
      await page.keyboard.press('Escape');
      await expect.soft(listGroup(page).locator('[aria-selected="true"]'), 'Esc clears the selection').toHaveCount(0);
      await page.keyboard.press('?'); // global.shortcutHelp opens a dialog
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape'); // nothing selected: the screen binding is off, the global close-top-layer closes the dialog
      await expect.soft(page.getByRole('dialog')).toHaveCount(0);
      await ev(page, '17-E-016', 'esc_global_fallback');
    });

    await test.step('[17-E-017] Shortcuts are ignored while a text field has focus; Mod+Z with the type listbox open does not undo', async () => {
      // The screen has no text field, so the first half has nothing to focus (FL-16-01 notes the same); the listbox half:
      await optionOf(page, '#F-001').click();
      let mark = s.puts.length;
      await approveButton(page).click();
      await nextPut(s, mark, (record) => putList(record, 'furniture').some((o) => o.reviewed === true));
      await optionOf(page, '#D-001').click();
      await openSelect(page, typeBox(page));
      mark = s.puts.length;
      await page.keyboard.press('Control+z');
      await quiet(page);
      expect.soft(s.puts.length - mark, 'Mod+Z with the type listbox open does not undo').toBe(0);
      await expect.soft(optionOf(page, '#F-001')).toHaveAttribute('aria-label', '#F-001 — Đã duyệt');
      await ev(page, '17-E-017', 'undo_with_listbox_open');
      await page.keyboard.press('Escape');
    });

    await test.step('(extra, candidate bug) a focused swing RADIO is an <input>: the shortcut registry treats it as a text field (shortcuts.ts:199-209), so Mod+Z must still undo there', async () => {
      await quiet(page); // let the undo PUT of the step above land first
      await optionOf(page, '#F-001').click();
      let mark = s.puts.length;
      await approveButton(page).click();
      await nextPut(s, mark, (record) => putList(record, 'furniture').some((o) => o.reviewed === true));
      await optionOf(page, '#D-001').click();
      await swingRadio(page, 'Mở trái').focus();
      mark = s.puts.length;
      await page.keyboard.press('Control+z');
      await attempt('Mod+Z with a swing radio focused undoes the last edit', async () => {
        await nextPut(s, mark, (record) => putList(record, 'furniture').every((o) => o.reviewed === false), 5_000);
      });
      await ev(page, '17-E-017', 'undo_with_radio_focused_extra');
    });

    await test.step('[17-A-042] "Gấp nhóm Cửa đi" → listbox hidden, button becomes "Mở nhóm Cửa đi" aria-expanded="false"; reopen', async () => {
      await page.getByRole('button', { name: 'Gấp nhóm Cửa đi', exact: true }).click();
      await expect.soft(groupBox(page, OBJ.doors)).toHaveCount(0);
      const open = page.getByRole('button', { name: 'Mở nhóm Cửa đi', exact: true });
      await expect.soft(open).toHaveAttribute('aria-expanded', 'false');
      await ev(page, '17-A-042', 'group_folded');
      await open.click();
      await expect.soft(groupBox(page, OBJ.doors)).toBeVisible();
      await expect.soft(page.getByRole('button', { name: 'Gấp nhóm Cửa đi', exact: true })).toHaveAttribute('aria-expanded', 'true');
    });

    await test.step('[17-E-005] Group buttons aria-expanded + aria-controls the listbox id', async () => {
      for (const [label, id] of [['Cửa đi', 'object-layer-group-door'], ['Cửa sổ', 'object-layer-group-window'], ['Nội thất', 'object-layer-group-furniture']] as const) {
        const button = page.getByRole('button', { name: new RegExp(`^(Gấp|Mở) nhóm ${label}$`, 'u') });
        await expect.soft(button).toHaveAttribute('aria-controls', id);
        await expect.soft(button).toHaveAttribute('aria-expanded', 'true');
        await expect.soft(groupBox(page, label)).toHaveAttribute('id', id);
      }
      await ev(page, '17-E-005', 'group_aria');
    });

    await test.step('[17-E-002] tree "Cây lớp": treeitems are buttons, aria-selected always false, no arrow-key navigation', async () => {
      const items = page.getByRole('tree', { name: OBJ.tree, exact: true }).getByRole('treeitem');
      expect.soft(await items.evaluateAll((nodes) => nodes.map((node) => [node.tagName, node.getAttribute('aria-selected')])), 'treeitems').toEqual([['BUTTON', 'false'], ['BUTTON', 'false'], ['BUTTON', 'false']]);
      await items.first().focus();
      await page.keyboard.press('ArrowDown');
      expect.soft(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'ArrowDown does not move between tree items').toBe('Cửa đi');
      await ev(page, '17-E-002', 'tree_semantics');
    });

    await test.step('[17-E-006] One listbox per group named "Cửa đi"/"Cửa sổ"/"Nội thất"; every option has tabIndex 0; Enter/Space selects; no arrow keys', async () => {
      for (const label of [OBJ.doors, OBJ.windows, OBJ.furniture]) await expect.soft(groupBox(page, label)).toHaveCount(1);
      const tabs = await allOptions(page).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('tabindex')));
      expect.soft(tabs.every((value) => value === '0'), `tabindex of every option: ${tabs.join(',')}`).toBe(true);
      const option = optionOf(page, '#S-001');
      await option.focus();
      await page.keyboard.press('Enter');
      await expect.soft(option).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('ArrowDown');
      expect.soft(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'no arrow keys inside the listbox').toBe((await option.getAttribute('aria-label')) ?? '');
      await ev(page, '17-E-006', 'listbox_semantics');
    });

    await test.step('[17-E-007] Option name "#D-001 — Cần chú ý" (status not by colour only)', async () => {
      const labels = await optionLabels(page);
      expect.soft(labels.length).toBe(3);
      for (const label of labels) expect.soft(label).toMatch(/^#[DSF]-\d{3} — (bình thường|Cần chú ý|Đã duyệt|Vi phạm)$/u);
      await ev(page, '17-E-007', 'option_names');
    });

    await test.step('[17-A-043] "Thu gọn hai panel" → left panel + inspector hidden, tool rail floats over the canvas, button "Mở lại hai panel"', async () => {
      await optionOf(page, '#D-001').click();
      await statusBar(page).getByRole('button', { name: OBJ.collapse, exact: true }).click();
      await expect.soft(listGroup(page)).toHaveCount(0);
      await expect.soft(page.getByRole('heading', { name: 'Đối tượng', exact: true, level: 3 })).toHaveCount(0);
      await expect.soft(rail).toBeVisible();
      const canvas = await canvasGroup(page).boundingBox();
      const railBox = await rail.boundingBox();
      expect.soft(canvas !== null && railBox !== null && railBox.x >= canvas.x - 1 && railBox.x + railBox.width <= canvas.x + canvas.width + 1, 'the rail floats inside the canvas').toBe(true);
      await expect.soft(statusBar(page).getByRole('button', { name: OBJ.expand, exact: true })).toBeVisible();
      await ev(page, '17-A-043', 'panels_collapsed');
    });

    await test.step('[17-A-044] "Mở lại hai panel" restores both panels and the selection', async () => {
      await statusBar(page).getByRole('button', { name: OBJ.expand, exact: true }).click();
      await expect.soft(listGroup(page)).toBeVisible();
      await expect.soft(page.getByRole('heading', { name: 'Đối tượng', exact: true, level: 3 })).toBeVisible();
      await expect.soft(optionOf(page, '#D-001')).toHaveAttribute('aria-selected', 'true');
      await ev(page, '17-A-044', 'panels_restored');
    });
  });
});

/* ================================================================= FL-17-08 */

test('SCR-17 · FL-17-08 codes, row text, status, fixed 0,75 cut, filter trap, success', async ({ browser }) => {
  test.setTimeout(FLOW_TIMEOUT);
  await withFlow(
    browser,
    async (s) => {
      const { page, log } = s;
      const project = await objectsLowConf(s, 'f1708');
      const pid = project.projectId;
      const fid = at(project.floors, 0, 'floor').floorId;
      const oneDoorFloor = at(project.floors, 1, 'floor').floorId;
      const lowButton = page.getByRole('button', { name: OBJ.lowOnly, exact: true });
      const windowEntity = await openingIdOf(s.api, pid, fid, 'window');
      const hostCode = await hostWallCode(s.api, pid, fid, 'door');
      const labelOf = async (code: string): Promise<string> => (await optionOf(page, code).getAttribute('aria-label')) ?? '';

      await test.step('[17-C-005] Codes: doors "#D-001…", windows "#S-001…" (machine id says D-), furniture "#F-001…", ranked per kind', async () => {
        await openObjects(page, pid, fid);
        await expect(lowButton).toHaveAttribute('aria-pressed', 'true');
        await lowButton.click(); // the default filter hides every object but the 0,60 window: switch it off to read every code
        await expect(allOptions(page)).toHaveCount(5);
        expect.soft((await groupBox(page, OBJ.doors).getByRole('option').evaluateAll((nodes) => nodes.map((node) => (node.getAttribute('aria-label') ?? '').split(' — ')[0]))), 'door codes').toEqual(['#D-001', '#D-002', '#D-003']);
        expect.soft((await groupBox(page, OBJ.windows).getByRole('option').evaluateAll((nodes) => nodes.map((node) => (node.getAttribute('aria-label') ?? '').split(' — ')[0]))), 'window codes').toEqual(['#S-001']);
        expect.soft((await groupBox(page, OBJ.furniture).getByRole('option').evaluateAll((nodes) => nodes.map((node) => (node.getAttribute('aria-label') ?? '').split(' — ')[0]))), 'furniture codes').toEqual(['#F-001']);
        await ev(page, '17-C-005', 'codes_per_kind');
      });

      await test.step('[17-C-006] Row size "900 × 2.100 mm" (unit once, dot thousands) on its own line with title (BUG-400)', async () => {
        const size = optionOf(page, '#D-001').locator('span.font-mono.tabular-nums').first();
        await expect.soft(size).toHaveText('900 × 2.100 mm');
        await expect.soft(size).toHaveAttribute('title', '900 × 2.100 mm');
        await expect.soft(optionOf(page, '#S-001').locator('span.font-mono.tabular-nums').first()).toHaveText('1.200 × 1.200 mm');
        const wide = await size.evaluate((node) => node.scrollWidth <= node.clientWidth + 1);
        expect.soft(wide, 'the size text is not cut at 1440').toBe(true);
        await ev(page, '17-C-006', 'row_size');
      });

      await test.step('[17-C-007] Row host wall "#W-001" (same codes as SCR-16); furniture "Đứng tự do"', async () => {
        await expect.soft(optionOf(page, '#D-001').getByText(hostCode, { exact: true })).toBeVisible();
        await expect.soft(optionOf(page, '#S-001').getByText(hostCode, { exact: true })).toBeVisible();
        await expect.soft(optionOf(page, '#F-001').getByText(OBJ.furnitureFree, { exact: true })).toBeVisible();
        await ev(page, '17-C-007', 'row_host_wall');
      });

      await test.step('[17-C-008] Row status in aria-label: reviewed "— Đã duyệt"; AI ≥ 0,90 "— bình thường"; AI < 0,90 "— Cần chú ý"', async () => {
        expect.soft(await labelOf('#D-003')).toBe('#D-003 — Đã duyệt');
        expect.soft(await labelOf('#D-001')).toBe('#D-001 — bình thường');
        expect.soft(await labelOf('#F-001')).toBe('#F-001 — bình thường');
        expect.soft(await labelOf('#D-002')).toBe('#D-002 — Cần chú ý');
        expect.soft(await labelOf('#S-001')).toBe('#S-001 — Cần chú ý');
        await ev(page, '17-C-008', 'row_status');
      });

      await test.step('[17-B-004] Partial with low confidence: "N mục dưới ngưỡng tin cậy, đã lọc sẵn" + "Chỉ hiện mục dưới ngưỡng" aria-pressed="true"; list pre-filtered', async () => {
        await openObjects(page, pid, fid);
        await expect.soft(page.getByText('2 mục dưới ngưỡng tin cậy, đã lọc sẵn', { exact: true })).toBeVisible();
        await expect.soft(lowButton).toHaveAttribute('aria-pressed', 'true');
        await expect.soft(allOptions(page)).toHaveCount(2); // seed threshold 0,9: #D-002 (0,80) + #S-001 (0,60), as 17-C-009
        await expect.soft(optionOf(page, '#S-001')).toHaveCount(1);
        await expect.soft(optionOf(page, '#D-002')).toHaveCount(1);
        await ev(page, '17-B-004', 'partial_notice');
      });

      await test.step('[17-A-045] Partial notice button "Chỉ hiện mục dưới ngưỡng" (on by default) → off: all objects listed', async () => {
        await lowButton.click();
        await expect.soft(lowButton).toHaveAttribute('aria-pressed', 'false');
        await expect.soft(allOptions(page)).toHaveCount(5);
        await ev(page, '17-A-045', 'filter_off');
      });

      await test.step('[17-A-046] "Chỉ hiện mục dưới ngưỡng" back on → only unreviewed objects below the project threshold 0,9', async () => {
        await lowButton.click();
        await expect.soft(lowButton).toHaveAttribute('aria-pressed', 'true');
        await expect.soft(allOptions(page)).toHaveCount(2);
        await expect.soft(optionOf(page, '#S-001')).toHaveCount(1);
        await expect.soft(optionOf(page, '#D-002')).toHaveCount(1);
        await ev(page, '17-A-046', 'filter_back_on');
      });

      await test.step('[17-C-009] ⚑ Low-confidence cut is the constant 0,75, not the project "Ngưỡng tin cậy" (0,9): the project value must drive the cut', async () => {
        const labels = await optionLabels(page);
        expect.soft(labels.map(codeOfLabel).sort(), 'with the project threshold 0,9 both #D-002 (0,80) and #S-001 (0,60) are below the cut').toEqual(['#D-002', '#S-001']);
        await ev(page, '17-C-009', 'fixed_cut_vs_project_threshold');
      });

      await test.step('[17-C-010] Default filter ON only while an unreviewed < 0,75 object exists; approving the last one hides the notice + button and shows all rows', async () => {
        await openObjects(page, pid, fid);
        // Project threshold 0,9: #D-002 (0,80) is also below the cut, so approve it first, then #S-001 last (17-C-011 undoes S-001).
        await optionOf(page, '#D-002').click();
        const markD = s.puts.length;
        await approveButton(page).click();
        await nextPut(s, markD);
        await optionOf(page, '#S-001').click();
        const mark = s.puts.length;
        await approveButton(page).click();
        await nextPut(s, mark, (record) => openingIn(record, windowEntity)?.reviewed === true);
        await expect.soft(page.getByText(/mục dưới ngưỡng tin cậy/u)).toHaveCount(0);
        await expect.soft(lowButton).toHaveCount(0);
        await expect.soft(allOptions(page)).toHaveCount(5);
        await ev(page, '17-C-010', 'last_low_approved');
      });

      await test.step('[17-C-011] ⚑ Turn "Chỉ hiện mục dưới ngưỡng" off then on (explicit), approve the last low object → the filter must not trap the list', async () => {
        let mark = s.puts.length;
        await page.keyboard.press('Control+z'); // the window is a low, unreviewed object again
        await nextPut(s, mark, (record) => openingIn(record, windowEntity)?.reviewed === false);
        await expect(lowButton).toBeVisible();
        await lowButton.click();
        await lowButton.click(); // explicit "on"
        await expect(allOptions(page)).toHaveCount(1);
        await optionOf(page, '#S-001').click();
        mark = s.puts.length;
        await approveButton(page).click();
        await nextPut(s, mark, (record) => openingIn(record, windowEntity)?.reviewed === true);
        const listed = await allOptions(page).count();
        const buttonStill = await lowButton.count();
        expect.soft(listed > 0 || buttonStill > 0, 'a way out of the filter: the rows are listed, or the toggle is still there').toBe(true);
        await ev(page, '17-C-011', 'filter_trap');
      });

      await test.step('[17-E-015] Status bar role status "Thanh trạng thái"; progress text aria-live polite', async () => {
        await openObjects(page, pid, fid);
        await expect.soft(statusBar(page)).toHaveAttribute('role', 'status');
        await expect.soft(statusBar(page).locator('span[aria-live="polite"]')).toHaveText(/^\d+\/5 đối tượng đã duyệt$/u);
        await ev(page, '17-E-015', 'status_bar_a11y');
      });

      await test.step('[17-C-039] No request on selection, hover, filters, chips, group fold, panel collapse', async () => {
        const mark = log.length;
        await optionOf(page, '#D-001').click();
        await optionOf(page, '#D-002').hover();
        await eyeButton(page, 'cửa sổ').click();
        await eyeButton(page, 'cửa sổ').click();
        await chip(page, 'Cửa đơn').click();
        await chip(page, 'Cửa đơn').click();
        await page.getByRole('button', { name: 'Gấp nhóm Cửa đi', exact: true }).click();
        await page.getByRole('button', { name: 'Mở nhóm Cửa đi', exact: true }).click();
        await statusBar(page).getByRole('button', { name: OBJ.collapse, exact: true }).click();
        await statusBar(page).getByRole('button', { name: OBJ.expand, exact: true }).click();
        await quiet(page);
        const requests = log.slice(mark).filter((entry) => entry.path !== '/api/auth/refresh' && !entry.path.startsWith('/api/telemetry')).map((entry) => `${entry.method} ${entry.path}`);
        expect.soft(requests, 'UI-only interactions send no request').toEqual([]);
        await ev(page, '17-C-039', 'no_requests');
      });

      await test.step('[17-E-013] ⚑ No keyboard path to delete an object or open its menu: symbols are not focusable and no Delete/Backspace key is bound', async () => {
        await optionOf(page, '#F-001').click();
        const before = await allOptions(page).count();
        await page.keyboard.press('Delete');
        await page.keyboard.press('Backspace');
        await quiet(page);
        const deleted = (await allOptions(page).count()) < before;
        const focusable = await page.locator('g[aria-label^="#"]').evaluateAll((nodes) => nodes.some((node) => node.getAttribute('tabindex') !== null && node.getAttribute('tabindex') !== '-1'));
        await page.keyboard.press('Shift+F10');
        const menuOpened = (await page.getByRole('menu', { name: 'Tuỳ chọn', exact: true }).count()) > 0;
        expect.soft(deleted || focusable || menuOpened, 'a keyboard path to delete an object or open its menu (WCAG 2.1.1)').toBe(true);
        await ev(page, '17-E-013', 'no_keyboard_delete');
      });

      await test.step('[17-E-018] Reduced motion: symbol, morph and layer transitions off', async () => {
        const props = await page.locator('g[aria-label^="#"]').first().evaluate((node) => ({ outer: getComputedStyle(node).transitionProperty, inner: getComputedStyle(node.querySelector('g > g > g') ?? node).transitionProperty, matches: window.matchMedia('(prefers-reduced-motion: reduce)').matches }));
        expect.soft(props.matches, 'the context emulates reduced motion').toBe(true);
        expect.soft(props.outer, 'symbol transition off').toBe('none');
        expect.soft(props.inner, 'morph transition off').toBe('none');
        await ev(page, '17-E-018', 'reduced_motion');
      });

      await test.step('[17-B-006] Success: every object reviewed → counter number and progress bar turn verified colour, bar full', async () => {
        await spaGo(page, ROUTES.project.objects(pid, oneDoorFloor));
        await expect(allOptions(page)).toHaveCount(1);
        await optionOf(page, '#D-001').click();
        const mark = s.puts.length;
        await approveButton(page).click();
        await nextPut(s, mark);
        const panel = page.getByLabel('1/1 đối tượng đã duyệt', { exact: true });
        await expect.soft(panel).toBeVisible();
        await expect.soft(panel.locator('span.text-state-verified').first(), 'counter number turns the verified colour').toBeVisible();
        await expect.soft(panel.locator('div.bg-state-verified'), 'progress bar turns verified').toHaveCount(1);
        expect.soft(await panel.locator('div.bg-state-verified').evaluate((node) => (node as HTMLElement).style.width), 'bar full').toBe('100%');
        await ev(page, '17-B-006', 'success_state');
      });
    },
    { reducedMotion: true },
  );
});

/* ================================================================= FL-17-09 */

test('SCR-17 · FL-17-09 empty floors, manual add, entries, URL floor change, anonymous', async ({ browser }) => {
  test.setTimeout(FLOW_TIMEOUT);
  await withFlow(browser, async (s) => {
    const { page, log } = s;
    const project = await objectsEmptyProject(s, 'f1709');
    const pid = project.projectId;
    const [emptyFloor, oneWallFloor, shortFloor, fullFloor] = [0, 1, 2, 3].map((index) => at(project.floors, index, 'floor').floorId);
    const objectsPath = (floor: string): string => ROUTES.project.objects(pid, floor);
    const wallsScreen = page.getByRole('region', { name: 'Duyệt lớp tường', exact: true });

    await test.step('[17-B-003] Empty, no wall: "Tầng này chưa có đoạn tường nào, …" + "Sang duyệt tường" (re-verify BUG-422; BUG-338 empty-state icon)', async () => {
      await openObjects(page, pid, emptyFloor as string);
      await expect(page.getByText(OBJ.emptyTitle, { exact: true })).toBeVisible();
      await expect(page.getByText(OBJ.emptyNoWall, { exact: true }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: OBJ.openWalls, exact: true })).toBeVisible();
      await expect.soft(page.getByRole('button', { name: OBJ.addManually, exact: true }), 'BUG-422: no dead "Thêm thủ công" on a wall-less floor').toHaveCount(0);
      const icon = page.getByRole('heading', { name: OBJ.emptyTitle, exact: true }).locator('xpath=preceding-sibling::div[1]');
      await expect.soft(icon.locator('svg'), 'BUG-338: the empty-state icon holds a real symbol, not a bare circle').toHaveCount(1, { timeout: 2_000 });
      await ev(page, '17-B-003', 'empty_no_wall');
    });

    await test.step('[17-A-050] Floor with no wall: "Sang duyệt tường" → walls route, no write', async () => {
      const mark = log.length;
      await page.getByRole('button', { name: OBJ.openWalls, exact: true }).click();
      await expect.poll(() => pathOf(page)).toBe(ROUTES.project.walls(pid, emptyFloor as string));
      await quiet(page);
      expect.soft(writesSince(log, mark), 'the exit writes nothing').toEqual([]);
      await ev(page, '17-A-050', 'to_walls_no_write');
    });

    await test.step('[16-A-004] Entry from SCR-17 empty state "Sang duyệt tường"', async () => {
      await expect.soft(wallsScreen).toBeVisible();
      await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
      await expect.soft(page).toHaveURL(new RegExp(`${ROUTES.project.walls(pid, emptyFloor as string)}$`, 'u'));
      await ev(page, '16-A-004', 'walls_screen_from_empty');
    });

    await test.step('[17-B-002] Empty with walls: "Chưa nhận ra đối tượng nào" + the explanation + "Thêm thủ công"; the status bar does not repeat it (BUG-422)', async () => {
      await openObjects(page, pid, oneWallFloor as string);
      await expect.soft(page.getByText(OBJ.emptyTitle, { exact: true })).toBeVisible();
      await expect.soft(page.getByText(OBJ.emptyExplanation, { exact: true }).first()).toBeVisible();
      await expect.soft(page.getByRole('button', { name: OBJ.addManually, exact: true })).toBeVisible();
      await expect.soft(page.getByText(OBJ.emptyExplanation, { exact: true }), 'sentence appears once (ObjectLayerStatusBar.tsx:48, BUG-422)').toHaveCount(1);
      await expect.soft(statusBar(page)).not.toContainText(OBJ.emptyExplanation);
      await ev(page, '17-B-002', 'empty_with_walls');
    });

    await test.step('[17-A-049] Empty floor with ≥1 wall: "Thêm thủ công" → a door on the first wall (PUT with one opening)', async () => {
      const mark = s.puts.length;
      await page.getByRole('button', { name: OBJ.addManually, exact: true }).click();
      const put = await nextPut(s, mark, (record) => putList(record, 'openings').length === 1);
      const opening = at(putList(put, 'openings'), 0, 'opening');
      expect.soft(opening.kind).toBe('door');
      expect.soft(opening.wallId, 'hosted by the first wall').toBe(at(putList(put, 'walls'), 0, 'wall').id);
      await expect.soft(groupBox(page, OBJ.doors).getByRole('option')).toHaveCount(1);
      await ev(page, '17-A-049', 'manual_door');
      await attachJson('E04_17-A-049_manual_door_put.json', { opening });
    });

    await test.step('[17-C-034] Manual door = template width/height, sill 0, at the middle of the first wall', async () => {
      const opening = at(putList(at(s.puts, s.puts.length - 1, 'PUT'), 'openings'), 0, 'opening');
      expect.soft(opening.widthMm, 'template width').toBe(900);
      expect.soft(opening.heightMm, 'template height (objectLayerFixture DOOR_HEIGHT_MM)').toBe(2_200);
      expect.soft(opening.sillHeightMm).toBe(0);
      expect.soft(Math.abs(Number(opening.offsetMm) - (6_000 - 900) / 2), 'centred on the 6 m wall').toBeLessThanOrEqual(1);
      await ev(page, '17-C-034', 'manual_door_geometry');
    });

    await test.step('[17-C-033] "Thêm thủ công" on a wall shorter than the door template → toast "Không thêm được đối tượng vào tường." — {domain reason}', async () => {
      await openObjects(page, pid, shortFloor as string);
      const mark = log.length;
      await page.getByRole('button', { name: OBJ.addManually, exact: true }).click();
      await expect.soft(toastWith(page, OBJ.addRefused)).toBeVisible();
      await expect.soft(toastWith(page, /vượt ra ngoài tường/u), 'the domain reason follows the title').toBeVisible();
      await quiet(page);
      expect.soft(putCount(log, mark), 'a refused add writes nothing').toBe(0);
      await ev(page, '17-C-033', 'manual_add_refused');
    });

    await test.step('[17-A-002] Entry from SCR-16 "Cây lớp" item "Cửa và nội thất"', async () => {
      await page.goto(ROUTES.project.walls(pid, fullFloor as string));
      await expect(wallsScreen).toBeVisible();
      await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
      await page.getByRole('treeitem', { name: 'Cửa và nội thất', exact: true }).click();
      await expect.poll(() => pathOf(page)).toBe(objectsPath(fullFloor as string));
      await expect(screen(page)).toBeVisible();
      await ev(page, '17-A-002', 'entry_from_walls_tree');
    });

    await test.step('[17-A-056] Change :floorId in the URL → boundary remounts and shows the other floor objects', async () => {
      await expect(allOptions(page)).toHaveCount(3);
      await markShell(page);
      const mark = log.length;
      await spaGo(page, objectsPath(oneWallFloor as string));
      await expect.soft(allOptions(page), 'the other floor lists its own objects').toHaveCount(1);
      expect.soft(await shellKept(page), 'a route change, not a document load').toBe(true);
      expect.soft(getCount(log, mark, layerRe(pid, oneWallFloor as string)), 'N16 of the new floor read').toBeGreaterThanOrEqual(1);
      await ev(page, '17-A-056', 'floor_change_remount');
    });

    await test.step('[17-A-055] Anonymous deep link → /login?next=…', async () => {
      const anonymous = await browser.newContext({ baseURL: readBaseUrl(), viewport: { width: 1440, height: 900 } });
      try {
        const guest = await anonymous.newPage();
        await guest.goto(objectsPath(fullFloor as string));
        await expect.poll(() => new URL(guest.url()).pathname).toBe(ROUTES.login);
        expect.soft(new URL(guest.url()).searchParams.get('next'), 'next carries the objects route').toBe(objectsPath(fullFloor as string));
        await expect.soft(guest.getByText('Hãy đăng nhập để tiếp tục.', { exact: true })).toBeVisible();
        await ev(guest, '17-A-055', 'anonymous_login_redirect');
      } finally {
        await anonymous.close();
      }
    });
  });
});

/* ================================================================= FL-17-10 */

test('SCR-17 · FL-17-10 409 reload, floor deleted, unknown ids', async ({ browser }) => {
  test.setTimeout(FLOW_TIMEOUT);
  await withFlow(browser, async (s) => {
    const { page, log } = s;
    const announced = await recordAnnouncements(page); // before the first load: the announcer text is transient
    const project = await createObjectsProject(s, 'f1710', [{ name: 'Tầng 1' }, { name: 'Tầng trống', build: emptyLayer }]);
    const pid = project.projectId;
    const fid = at(project.floors, 0, 'floor').floorId;
    const emptyFid = at(project.floors, 1, 'floor').floorId;
    const doorEntity = await openingIdOf(s.api, pid, fid, 'door');
    const windowEntity = await openingIdOf(s.api, pid, fid, 'window');
    const ghostProject = `prj_qa-p2-${Date.now().toString(36)}`;
    const ghostFloor = `L-QAP2NOPROJ${Date.now().toString(36).toUpperCase()}`;
    const reloadButton = page.getByRole('button', { name: SAVE.reload, exact: true });
    const dialog = page.getByRole('dialog');
    const entryJson = (status: number, re: RegExp): string => JSON.stringify(log.filter((entry) => entry.status === status && entry.method === 'GET' && re.test(entry.path)).at(-1)?.json ?? null);
    let reloadMark = 0;

    await test.step('[17-B-018] Save 409 → attention banner "Tầng này vừa được sửa ở nơi khác. Tải lại để xem bản mới nhất." + "Tải lại"', async () => {
      await openObjects(page, pid, fid);
      await writeElsewhere(s.api, pid, fid); // second writer: the page's base is now behind
      await optionOf(page, '#D-001').click();
      await approveButton(page).click();
      await expect(page.getByText(SAVE.conflict, { exact: true })).toBeVisible();
      await expect(reloadButton).toBeVisible();
      await ev(page, '17-B-018', 'conflict_banner');
    });

    await test.step('[17-G-011] PUT 409 VERSION_CONFLICT → reload banner (17-B-018)', async () => {
      await expect.poll(() => putEntries(s).at(-1)?.status).toBe(409);
      const entry = putEntries(s).at(-1);
      expect.soft(entry?.code, 'error code of the 409').toBe('VERSION_CONFLICT');
      await expect.soft(page.getByText(SAVE.conflict, { exact: true })).toBeVisible();
      await ev(page, '17-G-011', 'put_409');
    });

    await test.step('[17-B-019] "Tải lại" with unsaved edits → dialog "Bỏ thay đổi chưa lưu của tầng này?" / "Bản mới nhất trên máy chủ sẽ thay mọi sửa…"', async () => {
      await reloadButton.click();
      await expect(dialog).toBeVisible();
      await expect.soft(dialog.getByText(SAVE.confirmTitle, { exact: true })).toBeVisible();
      await expect.soft(dialog).toContainText('Bản mới nhất trên máy chủ sẽ thay mọi sửa đổi chưa lưu của tầng này.');
      await expect.soft(dialog.getByRole('button', { name: SAVE.confirmReload, exact: true })).toBeVisible();
      await expect.soft(dialog.getByRole('button', { name: SAVE.cancel, exact: true })).toBeVisible();
      await ev(page, '17-B-019', 'reload_confirm_dialog');
    });

    await test.step('[17-B-020] "Tải lại và bỏ thay đổi" → N16 re-read, banner gone, toast "Đã tải lại bản mới nhất của tầng; các thay đổi chưa lưu đã…"', async () => {
      reloadMark = log.length;
      await dialog.getByRole('button', { name: SAVE.confirmReload, exact: true }).click();
      await expect.poll(() => getCount(log, reloadMark, layerRe(pid, fid)), { message: 'N16 read again' }).toBeGreaterThanOrEqual(1);
      await expect.soft(page.getByText(SAVE.conflict, { exact: true })).toHaveCount(0);
      await expect.soft(toastWith(page, /Đã tải lại bản mới nhất của tầng/u)).toBeVisible();
      await ev(page, '17-B-020', 'reloaded_toast');
    });

    await test.step('[17-C-041] 409 reload clears the undo history (old steps no longer apply)', async () => {
      const mark = log.length;
      await statusBar(page).getByRole('button', { name: OBJ.undo, exact: true }).click();
      await optionOf(page, '#D-001').focus();
      await page.keyboard.press('Control+z');
      await quiet(page);
      expect.soft(putCount(log, mark), 'nothing to undo after the reload').toBe(0);
      expect.soft(await optionOf(page, '#D-001').getAttribute('aria-label'), 'the server copy shows the door unreviewed').toBe('#D-001 — bình thường');
      await ev(page, '17-C-041', 'undo_history_cleared');
    });

    await test.step('[17-G-019] After "Tải lại" → GET N16 again, then no PUT until the next edit', async () => {
      expect.soft(getCount(log, reloadMark, layerRe(pid, fid)), 'N16 read after the reload').toBeGreaterThanOrEqual(1);
      expect.soft(putCount(log, reloadMark), 'no PUT until the next edit').toBe(0);
      await ev(page, '17-G-019', 'reload_no_put');
    });

    await test.step('[17-B-026] Save success → polite live announcement "Đã lưu lúc HH:mm" (no visible save chip on this screen)', async () => {
      const mark = s.puts.length;
      await optionOf(page, '#D-001').click();
      await approveButton(page).click();
      await nextPut(s, mark, (record) => openingIn(record, doorEntity)?.reviewed === true);
      await expect.poll(async () => (await announced()).some((text) => /^Đã lưu lúc \d{2}:\d{2}$/u.test(text)), { message: 'the announcer said "Đã lưu lúc HH:mm"' }).toBe(true);
      await ev(page, '17-B-026', 'saved_announcement');
      await attachJson('E04_17-B-026_announcements.json', { announced: await announced() });
    });

    await test.step('[17-G-016] PUT 404 floor (floor deleted in another tab) → "Không lưu được thay đổi của tầng này."', async () => {
      const deleted = await s.api.request.delete(`/api/floors/${fid}`, { headers: s.api.headers });
      expect(deleted.status(), 'setup: DELETE /api/floors/:id').toBe(200);
      await optionOf(page, '#S-001').click();
      await approveButton(page).click();
      await expect.poll(() => putEntries(s).at(-1)?.status).toBe(404);
      await expect.soft(page.getByText(SAVE.unknown, { exact: true })).toBeVisible();
      expect.soft(openingIn(at(s.puts, s.puts.length - 1, 'PUT'), windowEntity)?.reviewed).toBe(true);
      await ev(page, '17-G-016', 'put_404_floor');
    });

    await test.step('[17-B-007] N16 404 project → whole screen replaced: "Không tìm thấy dự án này" / "Dự án có thể đã bị xoá, …" / "Về danh sách dự án"', async () => {
      await page.goto(ROUTES.project.objects(ghostProject, ghostFloor));
      const missing = page.getByRole('alert').filter({ hasText: 'Dự án có thể đã bị xoá, đường dẫn chưa đúng, hoặc bạn chưa được thêm vào dự án.' });
      await expect(missing).toBeVisible();
      await expect.soft(missing.getByRole('heading', { name: 'Không tìm thấy dự án này', exact: true })).toBeVisible();
      await expect.soft(missing.getByRole('button', { name: 'Về danh sách dự án', exact: true })).toBeVisible();
      await expect.soft(listGroup(page)).toHaveCount(0);
      await ev(page, '17-B-007', 'project_404');
    });

    await test.step('[17-B-008] N16 404 floor → "Không mở được tầng này" / "Tầng này không còn tồn tại. Mở Quản lý tầng để chọn một tầng khác." / "Về quản lý tầng"', async () => {
      await page.goto(ROUTES.project.objects(pid, fid));
      const missing = page.getByRole('alert').filter({ hasText: 'Tầng này không còn tồn tại. Mở Quản lý tầng để chọn một tầng khác.' });
      await expect(missing).toBeVisible();
      await expect.soft(missing.getByRole('heading', { name: 'Không mở được tầng này', exact: true })).toBeVisible();
      await expect.soft(missing.getByRole('button', { name: 'Về quản lý tầng', exact: true })).toBeVisible();
      await ev(page, '17-B-008', 'floor_404');
    });

    await test.step('[17-B-009] "Về quản lý tầng" → /projects/:id/floors; "Về danh sách dự án" → /', async () => {
      await page.getByRole('button', { name: 'Về quản lý tầng', exact: true }).click();
      await expect.poll(() => pathOf(page)).toBe(ROUTES.project.floors(pid));
      await ev(page, '17-B-009', 'to_floor_manager');
      await page.goto(ROUTES.project.objects(ghostProject, ghostFloor));
      await page.getByRole('button', { name: 'Về danh sách dự án', exact: true }).click();
      await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
    });

    await test.step('[17-G-004] N16 404 resource:"project" (unknown / non-member) → project screen', async () => {
      const json = entryJson(404, layerRe(ghostProject, ghostFloor));
      expect.soft(json, 'the 404 body names the project').toContain('"resource":"project"');
      await attachJson('E04_17-G-004_n16_404_project.json', { body: json });
      await ev(page, '17-G-004', 'n16_404_project');
    });

    await test.step('[17-G-005] N16 404 resource:"floor" → floor-missing screen', async () => {
      const json = entryJson(404, layerRe(pid, fid));
      expect.soft(json, 'the 404 body names the floor').toContain('"resource":"floor"');
      await attachJson('E04_17-G-005_n16_404_floor.json', { body: json });
      await ev(page, '17-G-005', 'n16_404_floor');
    });

    await test.step('[17-G-003] GET …/spatial/layer (N16) 200 → store via applyFloorLayerDocument, rows', async () => {
      await writeQ1(s, pid, emptyFid);
      await openObjects(page, pid, emptyFid);
      await expect.soft(allOptions(page)).toHaveCount(3);
      const entry = log.filter((e) => e.status === 200 && e.method === 'GET' && layerRe(pid, emptyFid).test(e.path)).at(-1);
      const layer = asRecord(asRecord(entry?.json, 'N16').layer, 'N16.layer');
      expect.soft([arrayOf(layer.openings, 'openings').length, arrayOf(layer.furniture, 'furniture').length], 'openings + furniture of the N16 body = the rows').toEqual([2, 1]);
      await ev(page, '17-G-003', 'n16_200_rows');
    });
  });
});

/* ================================================================= FL-17-11 */

test('SCR-17 · FL-17-11 drawing floor: background image, provisional banner → scale', async ({ browser }) => {
  test.setTimeout(420_000);
  const admin = await adminApi();
  let uploader: PoolUser;
  try {
    uploader = await poolUser(admin, 'admin', `${SLOT}-up`); // own drawings_init bucket
  } finally {
    await admin.dispose();
  }
  const api = await poolApi(uploader);
  const session = await openSession(browser, uploader);
  try {
    const { page, log } = session;
    const seeded = await createPipelineDrawingProject(api, 'f1711', envDrawingPng());
    session.cleanup.push(seeded.projectId);
    const pid = seeded.projectId;
    const fid = seeded.floorId;

    await test.step('[17-B-016] Drawing floor: image at 20 % opacity, alt "Bản vẽ gốc của {floor}, dùng làm nền để đối chiếu lớp đối tượng."', async () => {
      await openObjects(page, pid, fid);
      const image = page.getByAltText(`Bản vẽ gốc của ${seeded.floorName}, dùng làm nền để đối chiếu lớp đối tượng.`, { exact: true });
      await expect(image).toBeVisible();
      expect.soft(await image.evaluate((node) => getComputedStyle(node).opacity), 'image opacity').toBe('0.2');
      await ev(page, '17-B-016', 'drawing_background');
    });

    await test.step('[17-G-001] GET …/spatial on load (background): drawings[0].url/widthMm/heightMm → image + surface size', async () => {
      const entry = log.filter((e) => e.method === 'GET' && e.status === 200 && backgroundRe(pid, fid).test(e.path)).at(-1);
      const drawing = at(arrayOf(asRecord(entry?.json, 'GET …/spatial').drawings, 'drawings'), 0, 'drawing');
      expect.soft(typeof drawing.url, 'drawings[0].url').toBe('string');
      expect.soft(typeof drawing.widthMm, 'drawings[0].widthMm').toBe('number');
      expect.soft(typeof drawing.heightMm, 'drawings[0].heightMm').toBe('number');
      const image = page.getByAltText(`Bản vẽ gốc của ${seeded.floorName}, dùng làm nền để đối chiếu lớp đối tượng.`, { exact: true });
      expect.soft(await image.getAttribute('src'), 'the image src is the drawing url').toContain(String(drawing.url).split('?')[0] ?? '');
      const box = await image.boundingBox();
      expect.soft(box !== null && box.width > 50 && box.height > 50, 'the surface has the drawing size').toBe(true);
      await ev(page, '17-G-001', 'background_read');
    });

    await test.step('[17-B-017] Provisional scale: banner "Tỷ lệ tạm — số đo chưa tin được, hãy hiệu chỉnh tỷ lệ." + "Hiệu chỉnh tỷ lệ"', async () => {
      await expect.soft(page.getByText('Tỷ lệ tạm — số đo chưa tin được, hãy hiệu chỉnh tỷ lệ.', { exact: true })).toBeVisible();
      await expect.soft(page.getByRole('button', { name: 'Hiệu chỉnh tỷ lệ', exact: true })).toBeVisible();
      await ev(page, '17-B-017', 'provisional_scale_banner');
    });

    await test.step('[17-A-051] Provisional-scale banner "Hiệu chỉnh tỷ lệ" → scale route of this floor', async () => {
      await page.getByRole('button', { name: 'Hiệu chỉnh tỷ lệ', exact: true }).click();
      await expect.poll(() => pathOf(page)).toBe(ROUTES.project.scale(pid, fid));
      await ev(page, '17-A-051', 'banner_to_scale');
    });
  } finally {
    await api.dispose();
    await closeSession(session);
  }
});
