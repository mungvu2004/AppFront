/**
 * Phase 5 — SCR-25 Công cụ đo (`/projects/:id/3d/measure`), real stack, 18 flows / 152 steps (QA-05c P4;
 * flows-C4.md "phase05_measure_edge.spec.ts", catalog-C4.md). One test = one flow = one journey on one seeded project;
 * every catalog row is one `test.step('[<row id>] …')` in plan order, one evidence `E05m_<row id>_<slug>.png` each.
 *
 * Source (FE @ master d50bb248): MTV MeasurementTool.tsx · MTL MeasurementList.tsx · MTO MeasurementOverlay.tsx ·
 * MSC MeasurementSnapChip.tsx · UMT useMeasurementTool.ts · MTG measurementToolGateway.ts · VS/VVP/VTB/VTR/VSR/VCH/VOV/VIN/VSB
 * ViewerShell/* · UVS useViewerShell.ts · PSG ProjectSpatialGate.tsx · MUT lib/mutations/measurement.ts · SNAP domain/units/snap.ts.
 * BE: apps/api/measurements/{router,service,schemas,settings}.py (#16 list, #17 create, #18 delete).
 *
 * Rules kept here: `expect.soft` for observations, hard `expect` only on the open / seed step (H); a step marked ⚑ asserts
 * the CORRECT behaviour and is red while the bug is there (25-A-003, A-019, A-051, B-017, C-022, C-023, C-047..C-050, D-005,
 * E-011, E-015). No fixed waits: canvas changes are pixels, a hover is the snap chip, a pick is the next rendered frame;
 * "nothing was sent" is asserted after the response of a later real action (marks are kept across steps).
 * Picks use the top view (orthographic, straight down): `support/p05/measure.ts` derives every pixel from the model's
 * pixel bounds and confirms it by the snap chip ("Đỉnh" / "Trung điểm"); the bodies of #17 are the oracle of the points.
 *
 * Data: each flow creates its own `qa-<runId>-m25-NN-…` project through the real API (qcLayer, `support/layerSeed.ts`),
 * seeds its measurements through #17, and deletes the project in `finally` (`withMeasureProject`). Pool users use the
 * slots `p05-measure` (viewer, non-member engineer) and `p05-measure-dem` (engineer that is demoted and restored).
 *
 * Request budget per flow (no rate limit on projects / layers / measurements): `POST /api/auth/login` 2 (admin API +
 * browser; 3 for FL-25-15 / 16 / 17 with a pool user), `POST /api/projects` 1 (3 in FL-25-18), `PUT …/spatial/layer` 1 (2 in
 * FL-25-01 / 02), `POST …/measurements` 1–4 seeds + the pins the flow makes (FL-25-13: 100 seeds + 3), `DELETE /api/projects` 1.
 * Run with `--workers 2` (RAM): every flow is independent.
 */
import { expect, test, type APIRequestContext, type Browser, type Locator, type Page } from '@playwright/test';

import { ROUTES, loginUrl, pathOf } from '../../e2e/fixtures/routes';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { deleteSeededProject } from './support/drawingSeed';
import { captureEvidence } from './support/evidence';
import { createQcProject } from './support/layerSeed';
import { addProjectMember, createProject, poolUser, type PoolUser } from './support/phase03Seed';
import {
  DESKTOP,
  MODE,
  MT,
  R1,
  R2,
  R3,
  RF,
  SEED_MIDPOINTS,
  SEED_VERTICES,
  UNDO_WINDOW_MS,
  adminApi,
  asRecord,
  calls,
  canvasChanged,
  chipText,
  choosePreset,
  chooseUnit,
  clickAt,
  clickMany,
  closePage,
  cornerPixels,
  discCount,
  distanceOf,
  expectPicks,
  dialogs,
  dropButton,
  expectCanvasChanged,
  eye,
  formatArea,
  formatLength,
  geometryOf,
  hasFocusRing,
  holdFirst,
  hoverNear,
  hoverOffModel,
  hoverUntilSnap,
  layerOf,
  list,
  makeDraft,
  measureName,
  measurementRe,
  measurementsRe,
  modeRadio,
  modelBounds,
  nextFrames,
  nextSent,
  offTargetPixel,
  openAdminPage,
  openMeasure,
  openPoolPage,
  overlay,
  pickSnap,
  pillTexts,
  pillWith,
  pills,
  pinButton,
  pointerAway,
  postMeasurement,
  pressOnCanvas,
  projectRe,
  railTool,
  round6,
  rowOf,
  rowTexts,
  ruleConfigRe,
  seedName,
  sentPoints,
  settledCanvas,
  shellLog,
  snapChip,
  softly,
  spatialRe,
  startMeasuring,
  storeyChip,
  tabTo,
  toastWith,
  toggleButton,
  toolRail,
  topView,
  unitSelect,
  unknownProjectId,
  viewport,
  withMeasureProject,
  writesSince,
  zoomPercent,
  type MeasureRecord,
  type OpenPage,
  type Point,
  type Sent,
} from './support/p05/measure';

/* ---------------------------------------------------------------- shared bits of this file */

/** Evidence `E05m_<row id>_<slug>.png` — one per step (skill qa-evidence). */
const shot = (page: Page, id: string, slug: string, caption?: string): Promise<string> =>
  captureEvidence(page, `E05m_${id}_${slug}.png`, caption === undefined ? {} : { caption });

const footerOf = (page: Page): Locator => page.locator('footer[aria-label="Thanh trạng thái"]');
const crumbOf = (page: Page): Locator => page.getByRole('navigation', { name: 'Đường dẫn màn hình', exact: true });
const zoomGroup = (page: Page): Locator => page.getByRole('group', { name: MT.zoomGroup, exact: true });
const cubeFace = (page: Page, label: string): Locator => page.getByRole('group', { name: MT.cube, exact: true }).getByRole('button', { name: label, exact: true });
const sliderOf = (page: Page): Locator => page.getByRole('slider', { name: 'Độ tách', exact: true });
const RAIL_LABELS = ['Quay quanh mô hình (R)', 'Kéo màn (H)', 'Đo (M)', 'Mặt cắt (C)', 'Chọn (V)', 'Cô lập (Alt+H)'] as const;
const NOT_FOUND_TITLE = 'Không tìm thấy dự án này'; // PSG:37
const NOT_FOUND_TEXT = 'Dự án có thể đã bị xoá, đường dẫn chưa đúng, hoặc bạn chưa được thêm vào dự án.'; // PSG:38-39
const BACK_TO_PROJECTS = 'Về danh sách dự án'; // PSG:40

/** Drag from the viewport centre by (dx, dy) with the left button. */
async function dragViewport(page: Page, dx: number, dy: number): Promise<void> {
  const box = await viewport(page).boundingBox();
  if (box === null) throw new Error('viewport has no bounding box');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx, cy + dy, { steps: 8 });
  await page.mouse.up();
  await pointerAway(page);
}

/** Pins the draft (button), waits for the answer and returns what was sent. */
async function pinNow(page: Page, projectId: string, statuses: readonly number[] = [201]): Promise<Sent> {
  const sent = nextSent(page, 'POST', measurementsRe(projectId), statuses);
  await pinButton(page).click();
  return sent;
}

test.describe('SCR-25 Công cụ đo — real stack', () => {
  /* ============================================================================================ FL-25-01 */
  test('SCR-25 · FL-25-01 · open on two storeys: landmarks, top bar, status, corner controls, empty list', async ({ browser }) => {
    test.setTimeout(120_000);
    await withMeasureProject(browser, { slug: 'm25-01', floors: ['Tầng 1', 'Tầng 2'], layered: 2, record: true }, async ({ page, api, projectId, projectName }) => {
      await test.step('[25-A-001] deep link opens: gate + #16 read, viewport ready', async () => {
        await openMeasure(page, projectId);
        await expect(page.getByRole('region', { name: MT.shell, exact: true })).toBeVisible(); // VS:65
        await expect(viewport(page)).toHaveAttribute('aria-busy', 'false');
        await shot(page, '25-A-001', 'deeplink');
      });

      await test.step('[25-G-001] gate reads #24 GET /api/projects/:id -> 200', async () => {
        const reads = calls(api, 'GET', projectRe(projectId));
        expect.soft(reads.length, 'GET #24 seen').toBeGreaterThan(0);
        expect.soft(reads.map((entry) => entry.status)).toEqual(reads.map(() => 200));
        await shot(page, '25-G-001', 'gate_project');
      });

      await test.step('[25-G-004] N15 GET /api/projects/:id/spatial -> 200', async () => {
        const reads = calls(api, 'GET', spatialRe(projectId));
        expect.soft(reads.length, 'GET N15 seen').toBeGreaterThan(0);
        expect.soft(reads.map((entry) => entry.status)).toEqual(reads.map(() => 200));
        await shot(page, '25-G-004', 'spatial');
      });

      await test.step('[25-G-005] N21 rule config read at most once per open', async () => {
        expect.soft(calls(api, 'GET', ruleConfigRe(projectId)).length).toBeLessThanOrEqual(1); // UPS:68-83
        await shot(page, '25-G-005', 'rule_config');
      });

      await test.step('[25-G-006] #16 -> 200 [] decoded (no error alert)', async () => {
        const reads = calls(api, 'GET', measurementsRe(projectId));
        expect.soft(reads.length).toBeGreaterThan(0);
        expect.soft(reads.map((entry) => entry.status)).toEqual(reads.map(() => 200));
        expect.soft(reads[0]?.json).toEqual([]);
        await expect.soft(page.getByRole('alert')).toHaveCount(0);
        await shot(page, '25-G-006', 'list_read');
      });

      await test.step('[25-B-002] scene build: aria-busy true -> false, live "Mô hình đã dựng xong."', async () => {
        const log = await shellLog(page);
        expect.soft(log.busy[0], 'first aria-busy value of the viewport').toBe('true');
        expect.soft(log.busy[log.busy.length - 1], 'last aria-busy value').toBe('false');
        expect.soft(log.live).toContain('Mô hình đã dựng xong.'); // UVS:211
        await shot(page, '25-B-002', 'scene_built');
      });

      await test.step('[25-E-001] landmarks', async () => {
        await expect.soft(page.getByRole('main')).toHaveCount(1);
        await expect.soft(page.getByRole('main', { name: MT.viewport, exact: true })).toBeVisible();
        await expect.soft(page.locator('header[aria-label="Thanh trên khung nhìn"]')).toBeVisible(); // VTB:48-49
        await expect.soft(crumbOf(page)).toBeVisible();
        await expect.soft(page.getByRole('complementary', { name: MT.inspector, exact: true })).toBeVisible();
        await expect.soft(footerOf(page)).toBeVisible(); // VSB:26
        await shot(page, '25-E-001', 'landmarks');
      });

      await test.step('[25-A-002] breadcrumb: <project name> › "Mô hình 3D" › "Công cụ đo" (aria-current="page")', async () => {
        await expect.soft(crumbOf(page).getByText(projectName, { exact: true })).toBeVisible();
        await expect.soft(crumbOf(page).getByText('Mô hình 3D', { exact: true })).toBeVisible(); // FD: links to /projects/:id/3d
        await expect.soft(crumbOf(page).locator('[aria-current="page"]')).toHaveText('Công cụ đo');
        await shot(page, '25-A-002', 'breadcrumb');
      });

      await test.step('[25-G-002] crumb name from the second GET #24', async () => {
        const reads = calls(api, 'GET', projectRe(projectId));
        expect.soft(reads.length, 'two reads of #24 per open (gate + crumb)').toBe(2);
        const last = reads[reads.length - 1]?.json;
        expect.soft(typeof last === 'object' && last !== null ? (last as { name?: unknown }).name : undefined).toBe(projectName);
        await shot(page, '25-G-002', 'crumb_name');
      });

      await test.step('[25-A-003] ⚑ the project crumb leads back (the route has no AppShell)', async () => {
        // VCH:57-66 / UVS:1070-1076: crumbs carry no onClick -> a plain <span>: red while the bug is there.
        const back = crumbOf(page).getByRole('button', { name: projectName, exact: true }).or(crumbOf(page).getByRole('link', { name: projectName, exact: true }));
        await expect.soft(back, 'project crumb is a button / link').toHaveCount(1);
        if ((await back.count()) === 1) {
          await back.click();
          await expect.soft(page, 'clicking the crumb leaves the measure route').not.toHaveURL(/\/3d\/measure/u);
          await openMeasure(page, projectId); // back on the screen for the next steps
        }
        await shot(page, '25-A-003', 'crumb_leads_back');
      });

      await test.step('[25-C-038] status summary "2 tầng · 4 phòng · 64,00 m²"', async () => {
        await expect.soft(footerOf(page)).toContainText('2 tầng · 4 phòng · 64,00 m²'); // 4 rooms x 16 m2
        await shot(page, '25-C-038', 'status_summary');
      });

      await test.step('[25-C-039] elevation scale "0,00 m", "3,00 m"', async () => {
        const scale = page.locator('ol[aria-label="Cao độ tầng"]');
        await expect.soft(scale).toContainText('0,00 m');
        await expect.soft(scale).toContainText('3,00 m');
        await shot(page, '25-C-039', 'elevation_scale');
      });

      await test.step('[25-E-006] legend and elevation list', async () => {
        const legend = page.locator('dl[aria-label="Chú giải"]');
        for (const label of ['Tường 110', 'Tường 220', 'Tường 330', 'Ô mở']) await expect.soft(legend).toContainText(label);
        await expect.soft(page.locator('ol[aria-label="Cao độ tầng"]')).toBeVisible();
        await shot(page, '25-E-006', 'legend');
      });

      await test.step('[25-E-005] zoom group labels', async () => {
        for (const name of ['Thu nhỏ', 'Mức thu phóng 100%, bấm để về mức chuẩn', 'Phóng to', 'Vừa khung hình']) {
          await expect.soft(zoomGroup(page).getByRole('button', { name, exact: true }), name).toBeVisible();
        }
        await shot(page, '25-E-005', 'zoom_group');
      });

      await test.step('[25-B-003] ready model without record: invitation on the canvas and in the list', async () => {
        await expect.soft(page.getByText(MT.emptyHint, { exact: true })).toHaveCount(2); // MTV:83 + MTL:61
        await expect.soft(list(page).getByRole('listitem')).toHaveCount(0);
        await shot(page, '25-B-003', 'empty_invitation');
      });
    });
  });

  /* ============================================================================================ FL-25-02 */
  test('SCR-25 · FL-25-02 · storeys, separation, tool rail, shortcut sheet', async ({ browser }) => {
    test.setTimeout(180_000);
    await withMeasureProject(browser, { slug: 'm25-02', floors: ['Tầng 1', 'Tầng 2'], layered: 2 }, async ({ page, projectId }) => {
      const chip1 = storeyChip(page, 'Tầng 1');
      const chip2 = storeyChip(page, 'Tầng 2');
      const slider = sliderOf(page);

      await test.step('[25-C-040] storey labels: chips "1" "2", option "Tầng 1, cao độ 0,00 m", eye "Ẩn tầng 1"', async () => {
        await openMeasure(page, projectId);
        await expect(chip1).toHaveText('1');
        await expect(chip2).toHaveText('2');
        await expect(page.getByRole('option', { name: 'Tầng 1, cao độ 0,00 m', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Ẩn tầng 1', exact: true })).toBeVisible();
        await shot(page, '25-C-040', 'storey_labels');
      });

      await test.step('[25-E-003] roles: listbox "Tầng" multiselectable, options aria-selected, eyes aria-pressed', async () => {
        const box = page.getByRole('listbox');
        await expect.soft(box).toHaveAttribute('aria-multiselectable', 'true');
        // VSR:53-58 names the wrapper <div>, not the listbox: red = accessible-name finding.
        await expect.soft(page.getByRole('listbox', { name: 'Tầng', exact: true })).toHaveCount(1);
        for (const chip of [chip1, chip2]) await expect.soft(chip).toHaveAttribute('aria-selected', /^(true|false)$/u);
        for (const name of ['Ẩn tầng 1', 'Ẩn tầng 2']) await expect.soft(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
        await shot(page, '25-E-003', 'storey_roles');
      });

      await test.step('[25-A-016] click chip 2 selects it alone', async () => {
        await chip2.click();
        await expect.soft(chip2).toHaveAttribute('aria-selected', 'true');
        await expect.soft(chip1).toHaveAttribute('aria-selected', 'false');
        await shot(page, '25-A-016', 'chip_alone');
      });

      await test.step('[25-A-017] Shift+click chip 1 adds it, again removes it', async () => {
        await chip1.click({ modifiers: ['Shift'] });
        await expect.soft(chip1).toHaveAttribute('aria-selected', 'true');
        await expect.soft(chip2).toHaveAttribute('aria-selected', 'true');
        await chip1.click({ modifiers: ['Shift'] });
        await expect.soft(chip1).toHaveAttribute('aria-selected', 'false');
        await expect.soft(chip2).toHaveAttribute('aria-selected', 'true');
        await shot(page, '25-A-017', 'shift_click');
      });

      await test.step('[25-C-041] keys 1 / 2 select by order, 3 changes nothing', async () => {
        await pressOnCanvas(page, '1');
        await expect.soft(chip1).toHaveAttribute('aria-selected', 'true');
        await expect.soft(chip2).toHaveAttribute('aria-selected', 'false');
        await pressOnCanvas(page, '2');
        await expect.soft(chip2).toHaveAttribute('aria-selected', 'true');
        await expect.soft(chip1).toHaveAttribute('aria-selected', 'false');
        await pressOnCanvas(page, '3');
        await nextFrames(page);
        await expect.soft(chip2, 'key 3: nothing changes').toHaveAttribute('aria-selected', 'true');
        await expect.soft(chip1).toHaveAttribute('aria-selected', 'false');
        await shot(page, '25-C-041', 'number_keys');
      });

      await test.step('[25-A-018] eye "Ẩn tầng 2" hides that storey: "Hiện tầng 2", canvas changed', async () => {
        const before = await settledCanvas(page);
        await page.getByRole('button', { name: 'Ẩn tầng 2', exact: true }).click();
        await expect.soft(page.getByRole('button', { name: 'Hiện tầng 2', exact: true })).toHaveAttribute('aria-pressed', 'false');
        await canvasChanged(page, before, 'hide storey 2');
        await shot(page, '25-A-018', 'storey_hidden');
        await eye(page, 'tầng 2').click(); // local only: put it back (whatever the label is now)
      });

      // BUG-656: the measure scene keeps storeys at true elevation (points snap to real geometry), so the
      // shell locks "Độ tách" and key E here instead of moving a slider that changes nothing.
      await test.step('[25-A-019] slider "Độ tách" is locked on the measure screen (value 0)', async () => {
        await expect.soft(slider).toBeDisabled();
        await expect.soft(slider).toHaveValue('0');
        await shot(page, '25-A-019', 'separation');
      });

      await test.step('[25-C-042] key E changes nothing on the measure screen', async () => {
        await pressOnCanvas(page, 'e');
        await expect.soft(slider).toHaveValue('0');
        await shot(page, '25-C-042', 'key_e');
      });

      await test.step('[25-C-043] slider bounds min 0, max 1, step 0.01', async () => {
        await expect.soft(slider).toHaveAttribute('min', '0');
        await expect.soft(slider).toHaveAttribute('max', '1');
        await expect.soft(slider).toHaveAttribute('step', '0.01');
        await shot(page, '25-C-043', 'slider_bounds');
      });

      // BUG-655: "Cô lập" is a toggle on the scene (like Alt+H), not a sixth mode; with nothing selected it has
      // nothing to keep, so it stays off (unit: ViewerShell.test.tsx [25-C-047 · BUG-655]).
      await test.step('[25-A-020] each of the five mode tools: exactly one pressed; "Cô lập" with no selection stays off', async () => {
        for (const label of RAIL_LABELS.slice(0, 5)) {
          await railTool(page, label).click();
          await expect.soft(railTool(page, label), label).toHaveAttribute('aria-pressed', 'true');
          await expect.soft(toolRail(page).locator('button[aria-pressed="true"]'), `only ${label}`).toHaveCount(1);
        }
        await railTool(page, 'Cô lập (Alt+H)').click();
        await expect.soft(railTool(page, 'Cô lập (Alt+H)')).toHaveAttribute('aria-pressed', 'false');
        await expect.soft(railTool(page, 'Chọn (V)'), 'mode tool kept').toHaveAttribute('aria-pressed', 'true');
        await shot(page, '25-A-020', 'rail_tools');
      });

      await test.step('[25-E-002] toolbar "Công cụ khung nhìn" aria-orientation="vertical" at 1440', async () => {
        await expect.soft(toolRail(page)).toHaveAttribute('aria-orientation', 'vertical');
        for (const label of RAIL_LABELS) await expect.soft(railTool(page, label)).toHaveAttribute('aria-pressed', /^(true|false)$/u);
        await shot(page, '25-E-002', 'toolbar');
      });

      await test.step('[25-C-047] keys R / H / M / C / V press their tool; Alt+H with no selection leaves the tool as is', async () => {
        const keyed: readonly (readonly [string, string])[] = [
          ['r', 'Quay quanh mô hình (R)'],
          ['h', 'Kéo màn (H)'],
          ['m', 'Đo (M)'],
          ['c', 'Mặt cắt (C)'],
          ['v', 'Chọn (V)'],
        ];
        for (const [key, label] of keyed) {
          await pressOnCanvas(page, key);
          await expect.soft(railTool(page, label), `key ${key}`).toHaveAttribute('aria-pressed', 'true');
        }
        await pressOnCanvas(page, 'Alt+h');
        // Pressed state follows the scene (BUG-655); pressed=true after a selection is covered in vitest.
        await expect.soft(railTool(page, 'Cô lập (Alt+H)'), 'Alt+H').toHaveAttribute('aria-pressed', 'false');
        await expect.soft(railTool(page, 'Chọn (V)'), 'Alt+H keeps the tool').toHaveAttribute('aria-pressed', 'true');
        await shot(page, '25-C-047', 'tool_keys');
      });

      await test.step('[25-E-019] key "/" opens nothing on this screen', async () => {
        await pressOnCanvas(page, '/');
        await nextFrames(page);
        await expect.soft(dialogs(page)).toHaveCount(0);
        await shot(page, '25-E-019', 'slash_nothing');
      });

      await test.step('[25-E-014] key "?" opens the sheet with this screen\'s bindings', async () => {
        await startMeasuring(page);
        await page.keyboard.press('?');
        const sheet = page.getByRole('dialog', { name: 'Phím tắt', exact: true });
        await expect.soft(sheet).toBeVisible();
        for (const text of ['Ghim phép đo đang đọc', 'Xoá phép đo đang chọn', 'Bỏ phần đường đo dở dang, vẫn ở chế độ đo', 'Bật công cụ đo']) {
          await expect.soft(sheet, text).toContainText(text);
        }
        await shot(page, '25-E-014', 'shortcut_sheet');
      });

      await test.step('[25-E-013] Esc closes the sheet first; "Đo (M)" stays pressed', async () => {
        await page.keyboard.press('Escape');
        await expect.soft(dialogs(page)).toHaveCount(0);
        await expect.soft(railTool(page, MT.railMeasure)).toHaveAttribute('aria-pressed', 'true');
        await shot(page, '25-E-013', 'esc_sheet');
      });
    });
  });

  /* ============================================================================================ FL-25-03 */
  test('SCR-25 · FL-25-03 · camera: presets, ViewCube, 2D, zoom, wheel, double-click, keys', async ({ browser }) => {
    test.setTimeout(240_000);
    await withMeasureProject(browser, { slug: 'm25-03', record: true }, async ({ page, projectId }) => {
      const preset = page.getByRole('combobox', { name: MT.preset, exact: true });
      const zoomButton = (name: string): Locator => zoomGroup(page).getByRole('button', { name, exact: true });
      const zoomReset = (): Locator => zoomGroup(page).getByRole('button', { name: MT.zoomLabel });

      await test.step('[25-C-044] initial zoom label "100%"', async () => {
        await openMeasure(page, projectId);
        await expect.soft(zoomReset()).toHaveAttribute('aria-label', 'Mức thu phóng 100%, bấm để về mức chuẩn');
        await shot(page, '25-C-044', 'zoom_initial');
      });

      await test.step('[25-A-004] "Góc nhìn sẵn" -> "Trên xuống": trigger, ViewCube face, canvas', async () => {
        await pointerAway(page);
        const before = await settledCanvas(page);
        await choosePreset(page, 'Trên xuống');
        await expect.soft(preset).toHaveText('Trên xuống');
        await expect.soft(cubeFace(page, 'Trên xuống')).toHaveAttribute('aria-pressed', 'true');
        await canvasChanged(page, before, 'preset Trên xuống');
        await shot(page, '25-A-004', 'preset_top');
      });

      await test.step('[25-E-004] ViewCube semantics: group "Khối định hướng", four buttons with aria-pressed', async () => {
        const cube = page.getByRole('group', { name: MT.cube, exact: true });
        await expect.soft(cube.getByRole('button')).toHaveCount(4);
        for (const face of ['Phối cảnh', 'Trên xuống', 'Mặt cắt']) await expect.soft(cubeFace(page, face)).toHaveAttribute('aria-pressed', /^(true|false)$/u);
        await expect.soft(cube.locator('button[aria-pressed="true"]')).toHaveCount(1);
        await shot(page, '25-E-004', 'cube_semantics');
      });

      await test.step('[25-A-005] cube "Mặt cắt": Select "Mặt cắt", canvas changed', async () => {
        const before = await settledCanvas(page);
        await cubeFace(page, 'Mặt cắt').click();
        await pointerAway(page);
        await expect.soft(preset).toHaveText('Mặt cắt');
        await canvasChanged(page, before, 'cube Mặt cắt');
        await shot(page, '25-A-005', 'cube_section');
      });

      await test.step('[25-A-006] cube "Phối cảnh": pressed, Select "Phối cảnh"', async () => {
        await cubeFace(page, 'Phối cảnh').click();
        await expect.soft(cubeFace(page, 'Phối cảnh')).toHaveAttribute('aria-pressed', 'true');
        await expect.soft(preset).toHaveText('Phối cảnh');
        await shot(page, '25-A-006', 'cube_perspective');
      });

      await test.step('[25-A-007] "Chế độ xem" 2D: checked; live "Đang dựng mô hình…" then "Mô hình đã dựng xong."', async () => {
        const seen = (await shellLog(page)).live.length;
        const mode = page.getByRole('radiogroup', { name: 'Chế độ xem', exact: true });
        await mode.getByRole('radio', { name: '2D', exact: true }).click();
        await expect.soft(mode.getByRole('radio', { name: '2D', exact: true })).toHaveAttribute('aria-checked', 'true');
        await expect.soft(footerOf(page).locator('[aria-live="polite"]')).toHaveText('Mô hình đã dựng xong.');
        const live = (await shellLog(page)).live.slice(seen);
        expect.soft(live, 'live region after the switch').toEqual(['Đang dựng mô hình…', 'Mô hình đã dựng xong.']);
        await shot(page, '25-A-007', 'mode_2d');
      });

      await test.step('[25-A-008] "Phóng to": label X > 100', async () => {
        await zoomButton('Phóng to').click();
        await softly.poll(() => zoomPercent(page)).toBeGreaterThan(100);
        await shot(page, '25-A-008', 'zoom_in');
      });

      await test.step('[25-A-010] click the label: "100%"', async () => {
        await zoomReset().click();
        await softly.poll(() => zoomPercent(page)).toBe(100);
        await shot(page, '25-A-010', 'zoom_label_reset');
      });

      await test.step('[25-A-009] "Thu nhỏ": X < 100', async () => {
        await zoomButton('Thu nhỏ').click();
        await softly.poll(() => zoomPercent(page)).toBeLessThan(100);
        await shot(page, '25-A-009', 'zoom_out');
      });

      await test.step('[25-A-011] "Vừa khung hình": "100%"', async () => {
        await zoomButton('Vừa khung hình').click();
        await softly.poll(() => zoomPercent(page)).toBe(100);
        await shot(page, '25-A-011', 'fit_all');
      });

      await test.step('[25-A-012] 768x1024: wheel down zooms out and the page does not scroll (BUG-385)', async () => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await settledCanvas(page);
        const scroll = (): Promise<number[]> =>
          page.evaluate(() => [window.scrollY, document.querySelector('section[aria-label="Vỏ khung nhìn 3D"]')?.scrollTop ?? 0]);
        const before = await scroll();
        const box = await viewport(page).boundingBox();
        if (box === null) throw new Error('viewport has no bounding box');
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.wheel(0, 120);
        await softly.poll(() => zoomPercent(page)).toBeLessThan(100);
        expect.soft(await scroll(), 'window.scrollY and shell scrollTop unchanged').toEqual(before);
        await shot(page, '25-A-012', 'wheel_768');
        await page.setViewportSize(DESKTOP);
        await settledCanvas(page);
      });

      await test.step('[25-A-013] double-click the viewport (nothing selected) = fit all: "100%"', async () => {
        const box = await viewport(page).boundingBox();
        if (box === null) throw new Error('viewport has no bounding box');
        await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
        await softly.poll(() => zoomPercent(page)).toBe(100);
        await shot(page, '25-A-013', 'dblclick_fit');
      });

      await test.step('[25-C-045] keys 0 and F refit after a zoom-in: "100%"', async () => {
        await zoomButton('Phóng to').click();
        await softly.poll(() => zoomPercent(page)).toBeGreaterThan(100);
        await pressOnCanvas(page, '0');
        await softly.poll(() => zoomPercent(page), { message: 'key 0' }).toBe(100);
        await zoomButton('Phóng to').click();
        await softly.poll(() => zoomPercent(page)).toBeGreaterThan(100);
        await pressOnCanvas(page, 'f');
        await softly.poll(() => zoomPercent(page), { message: 'key F' }).toBe(100);
        await shot(page, '25-C-045', 'keys_0_f');
      });

      await test.step('[25-C-046] key O toggles orthographic: canvas changed, Select unchanged', async () => {
        await pointerAway(page);
        const before = await settledCanvas(page);
        const label = await preset.textContent();
        await pressOnCanvas(page, 'o');
        await canvasChanged(page, before, 'key O');
        await expect.soft(preset).toHaveText(label ?? '');
        await shot(page, '25-C-046', 'key_o');
      });

      await test.step('[25-A-014] drag with the orbit tool rotates and lands no point', async () => {
        await railTool(page, MT.railOrbit).click();
        await expect.soft(railTool(page, MT.railOrbit)).toHaveAttribute('aria-pressed', 'true');
        await pointerAway(page);
        const before = await settledCanvas(page);
        await dragViewport(page, 150, 40);
        await canvasChanged(page, before, 'orbit drag');
        await expect.soft(pinButton(page)).toHaveCount(0);
        await shot(page, '25-A-014', 'orbit_drag');
      });
    });
  });

  /* ============================================================================================ FL-25-04 */
  test('SCR-25 · FL-25-04 · pan, minimap, focus rings, reduced motion', async ({ browser }) => {
    test.setTimeout(120_000);
    await withMeasureProject(browser, { slug: 'm25-04' }, async ({ page, projectId }) => {
      await test.step('[25-A-015] "Kéo màn (H)" + drag pans the camera', async () => {
        await openMeasure(page, projectId);
        await railTool(page, 'Kéo màn (H)').click();
        await expect.soft(railTool(page, 'Kéo màn (H)')).toHaveAttribute('aria-pressed', 'true');
        await pointerAway(page);
        const before = await settledCanvas(page);
        await dragViewport(page, 120, 60);
        await expectCanvasChanged(page, before, 'pan drag');
        await shot(page, '25-A-015', 'pan');
      });

      await test.step('[25-A-051] ⚑ a click on the minimap "Bấm để di chuyển vùng nhìn" moves the view', async () => {
        await pointerAway(page);
        const before = await settledCanvas(page);
        // MM:85-93 + VOV:223: the shell mounts MiniMap without onViewportChange -> only its own rectangle moves (red).
        await page.getByRole('button', { name: 'Bấm để di chuyển vùng nhìn', exact: true }).click({ position: { x: 20, y: 20 } });
        await pointerAway(page);
        await canvasChanged(page, before, 'minimap click');
        await shot(page, '25-A-051', 'minimap');
      });

      await test.step('[25-E-021] Tab to a storey chip, a cube face and "Phóng to": a focus ring on each', async () => {
        const targets: readonly (readonly [string, Locator])[] = [
          ['storey chip', storeyChip(page, 'Tầng 1')],
          ['cube face', cubeFace(page, 'Trên xuống')],
          ['zoom in', zoomGroup(page).getByRole('button', { name: 'Phóng to', exact: true })],
        ];
        for (const [what, target] of targets) {
          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
          await tabTo(page, target);
          expect.soft(await hasFocusRing(target), `focus ring on ${what}`).toBe(true);
        }
        await shot(page, '25-E-021', 'focus_rings');
      });

      await test.step('[25-E-020] reduced motion: the inspector panel has no transition', async () => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const panel = page.getByRole('complementary', { name: MT.inspector, exact: true }).locator('xpath=ancestor::div[@aria-hidden][1]');
        await expect.soft(panel).toHaveClass(/transition-none/u);
        await shot(page, '25-E-020', 'reduced_motion');
      });
    });
  });

  /* ============================================================================================ FL-25-05 */
  test('SCR-25 · FL-25-05 · point-to-point: snap chip, draft, pin, id and value oracle', async ({ browser }) => {
    test.setTimeout(150_000);
    await withMeasureProject(browser, { slug: 'm25-05', records: R1 }, async ({ page, api, projectId }) => {
      let first: Point = [0, 0];
      let second: Point = [0, 0];
      let sent: Sent | undefined;
      let mark = 0;
      const posts = (from: number): number => calls(api, 'POST', measurementsRe(projectId), from).length;
      let basePills = 0; // pinned pills on screen before any draft: the draft pill is the next one (MTO:421-430)
      const draftPill = (): Locator => pills(page).nth(basePills);

      await test.step('[25-A-021] key M turns the measure tool on (top view)', async () => {
        await openMeasure(page, projectId);
        await topView(page);
        await startMeasuring(page);
        await expect.soft(railTool(page, MT.railMeasure)).toHaveAttribute('aria-pressed', 'true');
        await shot(page, '25-A-021', 'key_m');
      });

      await test.step('[25-A-025] hover off-model: "Chưa bắt vào đâu"; hover a wall end: "Đỉnh"', async () => {
        await page.getByRole('group', { name: MT.zoomGroup, exact: true }).getByRole('button', { name: 'Thu nhỏ', exact: true }).click(); // the model fills the frame: leave room for far pixels (25-A-027)
        await settledCanvas(page);
        basePills = await pills(page).count();
        await hoverOffModel(page);
        await softly.poll(() => chipText(page)).toBe(MT.chipSnapNone);
        first = await hoverUntilSnap(page, MT.vertex);
        await expect.soft(snapChip(page)).toHaveText(MT.vertex);
        await shot(page, '25-A-025', 'snap_vertex');
      });

      await test.step('[25-E-008] the chip is a status that holds the label', async () => {
        await hoverNear(page, MT.vertex, first); // the chip is re-read on a fresh hover: the screenshot of 25-A-025 moved the pointer
        await expect.soft(snapChip(page)).toHaveCount(1);
        await expect.soft(snapChip(page)).toHaveText('Đỉnh'); // MSC:56 role="status"
        await shot(page, '25-E-008', 'chip_status');
      });

      await test.step('[25-A-026] click the vertex: one point is drawn and the pin button stays hidden (BUG-651)', async () => {
        await clickAt(page, first);
        await expect.soft(pinButton(page), 'no pin with one point').toHaveCount(0);
        await expect.soft(dropButton(page)).toBeVisible();
        await shot(page, '25-A-026', 'first_point');
      });

      await test.step('[25-B-005] one point: no "Chuỗi đo chưa đóng…", viewport not busy, buttons reachable', async () => {
        await expect.soft(page.getByText(MT.partialHint, { exact: true })).toHaveCount(0);
        await expect.soft(viewport(page)).toHaveAttribute('aria-busy', 'false');
        for (const button of [dropButton(page), toggleButton(page)]) await expect.soft(button).toBeVisible();
        await shot(page, '25-B-005', 'measuring_state');
      });

      await test.step('[25-C-050] ⚑ pin only appears when there is something to pin: hidden / disabled after one point, no POST', async () => {
        mark = api.length;
        const pin = pinButton(page);
        const usable = (await pin.count()) > 0 && (await pin.isEnabled());
        expect.soft(usable, 'pin hidden or disabled with a single point').toBe(false); // MTV:195-203 + UMT:796 (red)
        if (usable) {
          await pin.click();
          await nextFrames(page);
        }
        expect.soft(posts(mark), 'POST so far (re-checked after the next real response in 25-A-029)').toBe(0);
        await shot(page, '25-C-050', 'pin_one_point');
      });

      await test.step('[25-A-027] after the first point the value pill follows the cursor', async () => {
        const geometry = geometryOf(await settledCanvas(page));
        const dist = (p: Point): number => Math.hypot(p[0] - first[0], p[1] - first[1]);
        const near = geometry.points.find((p) => dist(p) > 40);
        const far = [...geometry.points].reverse().find((p) => near !== undefined && Math.abs(dist(p) - dist(near)) > 40);
        if (near === undefined || far === undefined) throw new Error('no two model pixels at different distances from the first point');
        await page.mouse.move(near[0], near[1]);
        await expect.soft(draftPill()).toHaveText(/^[\d.]+,\d{2} m$/u);
        const text = (await draftPill().innerText()).trim();
        await page.mouse.move(far[0], far[1]);
        await expect.soft(draftPill()).not.toHaveText(text);
        await shot(page, '25-A-027', 'pill_follows');
      });

      await test.step('[25-A-028] second click on a vertex fixes the measurement: the pill stops changing', async () => {
        second = await hoverUntilSnap(page, MT.vertex, { avoid: [first] });
        await clickAt(page, second);
        const fixed = (await draftPill().innerText()).trim();
        const geometry = geometryOf(await settledCanvas(page));
        const elsewhere = geometry.points.find((p) => Math.hypot(p[0] - second[0], p[1] - second[1]) > 60);
        if (elsewhere === undefined) throw new Error('no model pixel away from the second point');
        await page.mouse.move(elsewhere[0], elsewhere[1]);
        await nextFrames(page);
        await expect.soft(draftPill()).toHaveText(fixed);
        await shot(page, '25-A-028', 'pill_fixed');
      });

      await test.step('[25-C-023] ⚑ in a two-point mode the hint says pin / Esc, not "Chọn thêm điểm"', async () => {
        // MTV:86 + UMT:945-947: every mode shows the same chain hint (red while the bug is there).
        await expect.soft(page.getByText(/Chọn thêm điểm/u)).toHaveCount(0);
        await expect.soft(overlay(page).locator('p').filter({ hasText: /ghim|Enter|Esc/u }), 'the hint tells to pin / Esc').not.toHaveCount(0);
        await shot(page, '25-C-023', 'hint_two_points');
      });

      await test.step('[25-A-029] "Ghim phép đo (phím Enter)": POST #17 201 -> GET #16; row "Phép đo 4"; pin gone', async () => {
        const refetch = waitForApi(page, 'GET', measurementsRe(projectId), [200]);
        sent = await pinNow(page, projectId);
        await refetch;
        expect.soft(sent.status).toBe(201);
        await expect.soft(list(page).getByText('Phép đo 4', { exact: true })).toBeVisible();
        await expect.soft(pinButton(page)).toHaveCount(0);
        expect.soft(posts(mark), 'exactly one POST since the one-point pin attempt (25-C-050)').toBe(1);
        await shot(page, '25-A-029', 'pinned');
      });

      await test.step('[25-C-008] new record id / name: one after the highest ("MS-0004", "Phép đo 4")', async () => {
        expect.soft(sent?.sent.id).toBe('MS-0004');
        expect.soft(sent?.sent.name).toBe('Phép đo 4');
        await shot(page, '25-C-008', 'identity');
      });

      await test.step('[25-C-011] POST body is the bare record: id, name, mode, points, rawValueMm', async () => {
        expect.soft(Object.keys(sent?.sent ?? {}).sort()).toEqual(['id', 'mode', 'name', 'points', 'rawValueMm']);
        await shot(page, '25-C-011', 'body_shape');
      });

      await test.step('[25-C-012] snapped points equal seed wall ends', async () => {
        const points = sentPoints(sent?.sent ?? {});
        expect.soft(points).toHaveLength(2);
        for (const point of points) {
          expect.soft(SEED_VERTICES.some(([x, y]) => Math.hypot(point.x - x, point.y - y) < 0.5), `(${String(point.x)}, ${String(point.y)}) is a seed wall end`).toBe(true);
        }
        await shot(page, '25-C-012', 'snapped_points');
      });

      await test.step('[25-C-013] value oracle: raw = round6(sqrt(dx^2+dy^2+dz^2)); row = vi(raw/1000, 2) m', async () => {
        const raw = Number(sent?.sent.rawValueMm);
        expect.soft(raw).toBeCloseTo(distanceOf(sentPoints(sent?.sent ?? {})), 5);
        await expect.soft(rowOf(page, 'Phép đo 4')).toContainText(formatLength(raw, 'm'));
        await shot(page, '25-C-013', 'value_oracle');
      });
    });
  });

  /* ============================================================================================ FL-25-06 */
  test('SCR-25 · FL-25-06 · keyboard pin, one send, every way a draft is dropped', async ({ browser }) => {
    test.setTimeout(180_000);
    await withMeasureProject(browser, { slug: 'm25-06' }, async ({ page, api, projectId }) => {
      let mid: Point = [0, 0];
      let vertex: Point = [0, 0];
      let sent: Sent | undefined;
      let mark = 0;
      let markEnter = 0;
      let markDouble = 0;
      const posts = (from: number): number => calls(api, 'POST', measurementsRe(projectId), from).length;
      const draft = (): Promise<void> => makeDraft(page, [mid, vertex]);
      const measureOn = (): Promise<void> => expect(railTool(page, MT.railMeasure)).toHaveAttribute('aria-pressed', 'true');

      await test.step('[25-C-014] hover a wall midpoint: chip "Trung điểm"; click it, then a vertex', async () => {
        await openMeasure(page, projectId);
        await topView(page);
        await startMeasuring(page);
        const discBase = await discCount(page);
        mid = await hoverUntilSnap(page, MT.midpoint);
        await expect.soft(snapChip(page)).toHaveText(MT.midpoint);
        await clickAt(page, mid);
        vertex = await hoverUntilSnap(page, MT.vertex, { avoid: [mid] });
        await clickAt(page, vertex);
        await expectPicks(page, discBase, 2); // the pin button shows after one point (E2-B3): count the drawn picks instead
        await shot(page, '25-C-014', 'midpoint_pick');
      });

      await test.step('[25-A-030] key Enter pins: one POST #17 201 (first point = a wall midpoint)', async () => {
        mark = api.length;
        markEnter = mark;
        const refetch = waitForApi(page, 'GET', measurementsRe(projectId), [200]);
        const posted = nextSent(page, 'POST', measurementsRe(projectId), [201]);
        await pressOnCanvas(page, 'Enter');
        sent = await posted;
        await refetch;
        expect.soft(sent.status).toBe(201);
        expect.soft(posts(mark)).toBe(1);
        const first = sentPoints(sent.sent)[0];
        expect.soft(first !== undefined && SEED_MIDPOINTS.some(([x, y]) => Math.hypot(first.x - x, first.y - y) < 0.5), '25-C-014 oracle: first point is a wall midpoint').toBe(true);
        await shot(page, '25-A-030', 'enter_pin');
      });

      await test.step('[25-G-008] after the 201 exactly one GET #16', async () => {
        expect.soft(calls(api, 'GET', measurementsRe(projectId), mark)).toHaveLength(1);
        await shot(page, '25-G-008', 'one_refetch');
      });

      await test.step('[25-G-009] the POST carries no Idempotency-Key', async () => {
        const headers = await sent?.request.allHeaders();
        expect.soft(headers?.['idempotency-key']).toBeUndefined();
        await shot(page, '25-G-009', 'no_idempotency');
      });

      await test.step('[25-A-031] double-click on the pin button sends exactly one POST (NO-384)', async () => {
        await draft();
        mark = api.length;
        markDouble = mark;
        const posted = nextSent(page, 'POST', measurementsRe(projectId), [201]);
        const refetch = waitForApi(page, 'GET', measurementsRe(projectId), [200]);
        await pinButton(page).dblclick();
        await posted;
        await refetch;
        expect.soft(posts(mark)).toBe(1);
        await shot(page, '25-A-031', 'double_click_pin');
      });

      await test.step('[25-C-024] the draft stays until the POST resolves (held, then released)', async () => {
        await draft();
        const hold = await holdFirst(page, (url, method) => method === 'POST' && measurementsRe(projectId).test(url.pathname));
        try {
          const posted = nextSent(page, 'POST', measurementsRe(projectId), [201]);
          await pinButton(page).click();
          await hold.seen;
          await expect.soft(pinButton(page), 'pin still shown while the POST is pending').toBeVisible();
          await shot(page, '25-C-024', 'pending_pin');
          await hold.release();
          await posted;
          await expect.soft(pinButton(page)).toHaveCount(0);
          // Late "exactly one" checks of 25-A-030 / 25-G-008 / 25-A-031: a later real response (this POST) is now in the log.
          expect.soft(posts(markEnter), 'POSTs since the Enter pin: Enter, double-click, held').toBe(3);
          expect.soft(posts(markDouble), 'POSTs since the double-click: double-click, held').toBe(2);
        } finally {
          await hold.release();
        }
      });

      await test.step('[25-A-032] "Bỏ phần đo dở (phím Esc)" drops the draft, the tool stays on', async () => {
        await draft();
        await dropButton(page).click();
        await expect.soft(pinButton(page)).toHaveCount(0);
        await expect.soft(railTool(page, MT.railMeasure)).toHaveAttribute('aria-pressed', 'true');
        await shot(page, '25-A-032', 'drop_button');
      });

      await test.step('[25-A-033] key Esc drops the draft the same way', async () => {
        await draft();
        await pressOnCanvas(page, 'Escape');
        await expect.soft(pinButton(page)).toHaveCount(0);
        await expect.soft(railTool(page, MT.railMeasure)).toHaveAttribute('aria-pressed', 'true');
        await shot(page, '25-A-033', 'esc_drops');
      });

      await test.step('[25-A-023] changing the mode (radio "Chiều cao") drops the draft', async () => {
        await draft();
        await modeRadio(page, MODE.height).click();
        await expect.soft(pinButton(page)).toHaveCount(0);
        await shot(page, '25-A-023', 'mode_drops');
        await modeRadio(page, MODE.p2p).click();
      });

      await test.step('[25-A-024] "Bật tắt công cụ đo (phím M)" twice: orbit + draft gone, then measure again', async () => {
        await draft();
        await toggleButton(page).click();
        await expect.soft(railTool(page, MT.railOrbit)).toHaveAttribute('aria-pressed', 'true');
        await expect.soft(pinButton(page)).toHaveCount(0);
        await toggleButton(page).click();
        await expect.soft(railTool(page, MT.railMeasure)).toHaveAttribute('aria-pressed', 'true');
        await shot(page, '25-A-024', 'toggle_twice');
      });

      await test.step('[25-C-048] ⚑ key M while measuring turns the tool off ("Quay quanh mô hình (R)")', async () => {
        await measureOn();
        await pressOnCanvas(page, 'm');
        // VSS:143-153: M always activates 'measure'; only the button toggles (red while the bug is there).
        await expect.soft(railTool(page, MT.railOrbit)).toHaveAttribute('aria-pressed', 'true');
        await shot(page, '25-C-048', 'key_m_toggle');
        await startMeasuring(page);
      });

      await test.step('[25-C-049] ⚑ switching tool (key R) drops the draft like Esc', async () => {
        await draft();
        await pressOnCanvas(page, 'r');
        // UMT:530-537,776-784: only Esc / mode / the toggle button clear the picks (red while the bug is there).
        await expect.soft(pinButton(page)).toHaveCount(0);
        await shot(page, '25-C-049', 'tool_switch_drops');
      });
    });
  });

  /* ============================================================================================ FL-25-07 */
  test('SCR-25 · FL-25-07 · height, perpendicular, floor area, third click', async ({ browser }) => {
    test.setTimeout(240_000);
    await withMeasureProject(browser, { slug: 'm25-07' }, async ({ page, projectId }) => {
      let corners: Point[] = [];
      const pickTwo = async (): Promise<void> => {
        const base = await discCount(page);
        const a = await pickSnap(page, MT.vertex);
        await pickSnap(page, MT.vertex, { avoid: [a] });
        await expectPicks(page, base, 2);
      };
      const pickCorner = async (index: number): Promise<Point> => {
        const corner = corners[index];
        if (corner === undefined) throw new Error('corner pixels not computed');
        const at = await hoverNear(page, MT.vertex, corner);
        await clickAt(page, at);
        return at;
      };

      await test.step('[25-A-022] modes: four radios, "Điểm đến điểm" checked', async () => {
        await openMeasure(page, projectId);
        await topView(page);
        await startMeasuring(page);
        const group = page.getByRole('radiogroup', { name: MT.modes, exact: true });
        await expect.soft(group.getByRole('radio')).toHaveCount(4);
        await expect.soft(modeRadio(page, MODE.p2p)).toHaveAttribute('aria-checked', 'true');
        await shot(page, '25-A-022', 'modes');
      });

      await test.step('[25-E-016] ArrowRight in the radiogroup: "Vuông góc với bề mặt" checked', async () => {
        await modeRadio(page, MODE.p2p).focus();
        await page.keyboard.press('ArrowRight');
        await expect.soft(modeRadio(page, MODE.perpendicular)).toHaveAttribute('aria-checked', 'true');
        await shot(page, '25-E-016', 'arrow_keys');
      });

      await test.step('[25-C-017] "Chiều cao": two vertex picks, pin -> mode "height", raw = round6(|z2 - z1|)', async () => {
        await modeRadio(page, MODE.height).click();
        await pickTwo();
        const sent = await pinNow(page, projectId);
        const [a, b] = sentPoints(sent.sent);
        expect.soft(sent.sent.mode).toBe('height');
        expect.soft(Number(sent.sent.rawValueMm)).toBeCloseTo(round6(Math.abs((b?.z ?? 0) - (a?.z ?? 0))), 5);
        await shot(page, '25-C-017', 'height');
      });

      await test.step('[25-C-018] "Vuông góc với bề mặt": pin -> mode "perpendicular", points [p1, foot]', async () => {
        await modeRadio(page, MODE.perpendicular).click();
        await pickTwo();
        const sent = await pinNow(page, projectId);
        const [p1, foot] = sentPoints(sent.sent);
        expect.soft(sent.sent.mode).toBe('perpendicular');
        expect.soft(sentPoints(sent.sent)).toHaveLength(2);
        if (p1 !== undefined && foot !== undefined) {
          // Top view: the surface normal is up, so the foot stands straight below / above p1 and raw = |p1 - foot| = |z1 - z2| (DM:384-413).
          expect.soft(Math.hypot(foot.x - p1.x, foot.y - p1.y), 'foot is plumb under p1').toBeLessThan(0.01);
          expect.soft(Number(sent.sent.rawValueMm)).toBeCloseTo(Math.abs((p1.z ?? 0) - (foot.z ?? 0)), 2);
        }
        await shot(page, '25-C-018', 'perpendicular');
      });

      await test.step('[25-C-019] "Diện tích mặt sàn", two picks: no value pill, no partial hint', async () => {
        corners = await cornerPixels(page);
        await modeRadio(page, MODE.floorArea).click();
        await pickCorner(0);
        await pickCorner(1);
        await hoverOffModel(page);
        await softly.poll(() => chipText(page)).toBe(MT.chipSnapNone);
        expect.soft((await pillTexts(page)).filter((text) => text.includes('²')), 'no area pill yet (needs 3 points)').toEqual([]);
        await expect.soft(page.getByText(MT.partialHint, { exact: true })).toHaveCount(0);
        await shot(page, '25-C-019', 'area_two_points');
      });

      await test.step('[25-C-020] third pick (8000,0),(8000,6000) after (0,0): "24,00 m²"', async () => {
        await pickCorner(2);
        await expect.soft(pillWith(page, '24,00 m²')).toBeVisible();
        await shot(page, '25-C-020', 'area_24');
      });

      await test.step('[25-B-006] complete draft (area mode, 3 picks): "Chuỗi đo chưa đóng. …" hint', async () => {
        // Moved here from FL-25-05: in a two-point mode that sentence is what 25-C-023 calls the bug (MTV:86, UMT:945-947).
        await expect.soft(page.getByText(MT.partialHint, { exact: true })).toBeVisible();
        await shot(page, '25-B-006', 'partial_hint');
      });

      await test.step('[25-C-021] fourth pick (0,6000): "48,00 m²"; pin -> body with 4 points', async () => {
        await pickCorner(3);
        await expect.soft(pillWith(page, '48,00 m²')).toBeVisible();
        const sent = await pinNow(page, projectId);
        expect.soft(sent.sent.mode).toBe('floorArea');
        expect.soft(sentPoints(sent.sent)).toHaveLength(4);
        expect.soft(Math.abs(Number(sent.sent.rawValueMm) - 48_000_000)).toBeLessThan(1);
        await expect.soft(rowOf(page, String(sent.sent.name))).toContainText(formatArea(48_000_000));
        await shot(page, '25-C-021', 'area_48');
      });

      await test.step('[25-C-022] ⚑ point-to-point: the third click is not drawn into a two-point measurement', async () => {
        await modeRadio(page, MODE.p2p).click();
        const a = await pickSnap(page, MT.vertex);
        const b = await pickSnap(page, MT.vertex, { avoid: [a] });
        const two = await discCount(page);
        await pickSnap(page, MT.vertex, { avoid: [a, b] });
        // UMT:641,720: the pick is appended and drawn although value / pin use the first two (red while the bug is there).
        expect.soft(await discCount(page), 'endpoint discs after the third click').toBeLessThanOrEqual(two);
        const sent = await pinNow(page, projectId);
        expect.soft(sentPoints(sent.sent), 'pinned record has 2 points').toHaveLength(2);
        await shot(page, '25-C-022', 'third_click');
      });
    });
  });

  /* ============================================================================================ FL-25-08 */
  test('SCR-25 · FL-25-08 · unsnapped picks and projection edges', async ({ browser }) => {
    test.setTimeout(150_000);
    await withMeasureProject(browser, { slug: 'm25-08', records: RF }, async ({ page, projectId }) => {
      let off: Point = [0, 0];
      let pinned: Sent | undefined;

      await test.step('[25-C-051] a click on a wall face away from every target keeps the raycast coordinates', async () => {
        await openMeasure(page, projectId);
        await topView(page);
        await startMeasuring(page);
        off = await offTargetPixel(page);
        const discBase = await discCount(page);
        await clickAt(page, off);
        await pickSnap(page, MT.vertex, { avoid: [off] });
        await expectPicks(page, discBase, 2);
        pinned = await pinNow(page, projectId);
        const p0 = sentPoints(pinned.sent)[0];
        if (p0 === undefined) throw new Error('POST has no first point');
        expect(SEED_VERTICES.concat(SEED_MIDPOINTS).some(([x, y]) => Math.hypot(p0.x - x, p0.y - y) < 0.5), 'first point is not a target').toBe(false);
        const grid = (v: number): boolean => Math.abs(v / 50 - Math.round(v / 50)) < 1e-6;
        expect(grid(p0.x) && grid(p0.y), 'first point is not forced to the 50 mm grid').toBe(false);
        await shot(page, '25-C-051', 'unsnapped_pick');
      });

      await test.step('[25-C-015] hover > 120 mm from every target: chip "Chưa bắt vào đâu"', async () => {
        await page.mouse.move(off[0], off[1]);
        await softly.poll(() => chipText(page)).toBe(MT.chipSnapNone);
        await shot(page, '25-C-015', 'no_snap');
      });

      await test.step('[25-B-024] record without z still projects (elevation 0): its pill is shown', async () => {
        await expect.soft(pillWith(page, formatLength(2000, 'm'))).toHaveCount(1); // MS-0001 (1000,1000)-(3000,1000)
        await expect.soft(overlay(page)).toBeVisible();
        await shot(page, '25-B-024', 'record_without_z');
      });

      await test.step('[25-B-025] record far outside the model: row listed, no pill', async () => {
        await expect.soft(rowOf(page, seedName('MS-0002'))).toBeVisible();
        const own = String(pinned?.sent.rawValueMm);
        const expected = [formatLength(2000, 'm'), formatLength(Number(own), 'm')].sort();
        await softly.poll(async () => (await pillTexts(page)).sort(), { message: 'pills: the z-less record and the new one only' }).toEqual(expected);
        await shot(page, '25-B-025', 'record_far');
      });
    });
  });

  /* ============================================================================================ FL-25-09 */
  test('SCR-25 · FL-25-09 · seeded list: units, area, count, hover, hide, reload', async ({ browser }) => {
    test.setTimeout(180_000);
    await withMeasureProject(browser, { slug: 'm25-09', records: R3 }, async ({ page, api, projectId }) => {
      const names = [seedName('MS-0002'), seedName('MS-9999'), seedName('MS-10000')] as const;
      const valueOf = (name: string): Locator => rowOf(page, name).locator('span.font-mono');
      let mark = 0;

      await test.step('[25-B-004] ready with records: 3 rows and one pill per row, carrying the row labels', async () => {
        await openMeasure(page, projectId);
        await expect(list(page).getByRole('listitem')).toHaveCount(3);
        const rows = await rowTexts(page);
        await softly.poll(async () => (await pillTexts(page)).sort(), { message: 'pills = row labels' }).toEqual(rows.map((row) => row.value).sort());
        await shot(page, '25-B-004', 'rows_and_pills');
      });

      await test.step('[25-G-007] #16 numeric id order is the list order', async () => {
        expect.soft((await rowTexts(page)).map((row) => row.name)).toEqual([...names]);
        const reads = calls(api, 'GET', measurementsRe(projectId));
        const body = reads[0]?.json;
        expect.soft(Array.isArray(body) ? body.map((record) => asRecord(record, 'record').id) : []).toEqual(['MS-0002', 'MS-9999', 'MS-10000']);
        await shot(page, '25-G-007', 'order');
      });

      await test.step('[25-C-001] opening unit m: 4 000 mm reads "4,00 m"', async () => {
        await expect.soft(unitSelect(page)).toHaveText('m');
        await expect.soft(valueOf(names[0])).toHaveText('4,00 m');
        await shot(page, '25-C-001', 'unit_m');
      });

      await test.step('[25-C-002] "Đơn vị" -> cm: "400,0 cm"', async () => {
        await chooseUnit(page, 'cm');
        await expect.soft(valueOf(names[0])).toHaveText('400,0 cm');
        await shot(page, '25-C-002', 'unit_cm');
      });

      await test.step('[25-C-003] mm: "4.000 mm"', async () => {
        await chooseUnit(page, 'mm');
        await expect.soft(valueOf(names[0])).toHaveText('4.000 mm');
        await shot(page, '25-C-003', 'unit_mm');
      });

      await test.step('[25-C-004] 12 345,6 mm in m / cm / mm', async () => {
        for (const [unit, text] of [['m', '12,35 m'], ['cm', '1.234,6 cm'], ['mm', '12.346 mm']] as const) {
          await chooseUnit(page, unit);
          await expect.soft(valueOf(names[2]), unit).toHaveText(text);
          expect.soft(formatLength(12345.6, unit)).toBe(text);
        }
        await shot(page, '25-C-004', 'long_record');
      });

      await test.step('[25-C-005] the area row ignores the unit and is recomputed from the points: "6,00 m²"', async () => {
        for (const unit of ['mm', 'cm', 'm'] as const) {
          await chooseUnit(page, unit);
          await expect.soft(valueOf(names[1]), unit).toHaveText('6,00 m²');
        }
        await shot(page, '25-C-005', 'area_row');
      });

      await test.step('[25-C-006] after a unit change each pill settles exactly on its new row label', async () => {
        await chooseUnit(page, 'cm');
        const rows = await rowTexts(page);
        await softly.poll(async () => (await pillTexts(page)).sort()).toEqual(rows.map((row) => row.value).sort());
        await shot(page, '25-C-006', 'pill_settles');
      });

      await test.step('[25-A-034] the unit relabels every length row; no "mm" is left after -> m', async () => {
        await chooseUnit(page, 'mm');
        const lengths = (await rowTexts(page)).filter((row) => !row.value.includes('²'));
        expect.soft(lengths.every((row) => row.value.endsWith(' mm'))).toBe(true);
        await chooseUnit(page, 'm');
        const after = await rowTexts(page);
        expect.soft(after.filter((row) => / mm$/u.test(row.value))).toEqual([]);
        await shot(page, '25-A-034', 'unit_relabels');
      });

      await test.step('[25-C-007] count label "3 phép đo"', async () => {
        await expect.soft(list(page).getByText('3 phép đo', { exact: true })).toBeVisible();
        await shot(page, '25-C-007', 'count');
      });

      await test.step('[25-A-035] hover row 1: row tinted, the other pills at opacity 0.3', async () => {
        await rowOf(page, names[0]).hover();
        await expect.soft(rowOf(page, names[0])).toHaveClass(/bg-bg-hover/u);
        const own = (await valueOf(names[0]).innerText()).trim();
        const others = pills(page).filter({ hasNotText: own });
        expect.soft(await others.count(), 'other pills').toBeGreaterThan(0);
        for (const pill of await others.all()) await expect.soft(pill).toHaveCSS('opacity', '0.3');
        await shot(page, '25-A-035', 'hover_row');
      });

      await test.step('[25-A-036] the mouse leaves the row: every pill at opacity 1', async () => {
        await pointerAway(page);
        await softly.poll(async () => (await pills(page).evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity))).every((opacity) => opacity === '1'))
          .toBe(true);
        await shot(page, '25-A-036', 'hover_leave');
      });

      await test.step('[25-A-037] "Ẩn {name}" hides it locally: "Hiện {name}", its pill gone, no write', async () => {
        mark = api.length;
        await eye(page, names[0]).click();
        await expect.soft(page.getByRole('button', { name: `Hiện ${names[0]}`, exact: true })).toBeVisible();
        await expect.soft(pillWith(page, '4,00 m')).toHaveCount(0);
        await nextFrames(page);
        expect.soft(writesSince(api, mark), 'hiding writes nothing').toEqual([]);
        await shot(page, '25-A-037', 'hidden');
      });

      await test.step('[25-A-038] "Hiện {name}" brings the pill back', async () => {
        await eye(page, names[0]).click();
        await expect.soft(page.getByRole('button', { name: `Ẩn ${names[0]}`, exact: true })).toBeVisible();
        await expect.soft(pillWith(page, '4,00 m')).toHaveCount(1);
        await shot(page, '25-A-038', 'shown_again');
      });

      await test.step('[25-A-047] reload keeps the server rows and resets unit, hidden set and mode', async () => {
        await eye(page, names[1]).click();
        await chooseUnit(page, 'cm');
        await modeRadio(page, MODE.height).click();
        await openMeasure(page, projectId);
        await expect.soft(list(page).getByRole('listitem')).toHaveCount(3);
        await expect.soft(unitSelect(page)).toHaveText('m');
        await expect.soft(list(page).getByRole('button', { name: /^Hiện /u })).toHaveCount(0);
        await expect.soft(modeRadio(page, MODE.p2p)).toHaveAttribute('aria-checked', 'true');
        expect.soft(writesSince(api, mark), 'no write while hiding / switching').toEqual([]);
        await shot(page, '25-A-047', 'reload_resets');
      });
    });
  });

  /* ============================================================================================ FL-25-10 */
  test('SCR-25 · FL-25-10 · collapse and re-open', async ({ browser }) => {
    test.setTimeout(120_000);
    await withMeasureProject(browser, { slug: 'm25-10', records: R1 }, async ({ page, projectId }) => {
      const chip = (): Locator => page.getByRole('button', { name: /^1 phép đo — mở lại danh sách phép đo$/u });
      const panel = (): Locator => page.getByRole('complementary', { name: MT.inspector, exact: true }).locator('xpath=ancestor-or-self::*[@aria-hidden][1]');

      await test.step('[25-A-044] "Thu gọn mục Phép đo": rails gone, panel aria-hidden width 0, chip "1 phép đo — mở lại…"', async () => {
        await openMeasure(page, projectId);
        await page.getByRole('button', { name: MT.collapse, exact: true }).click();
        await expect.soft(page.locator('div[aria-label="Tầng"]')).toHaveCount(0); // VSR:50-54 storey rail
        await expect.soft(page.locator('xpath=//div[@aria-hidden="true"][.//aside[@aria-label="Thanh tra đối tượng"]]')).toHaveCount(1);
        await softly.poll(() => page.locator('xpath=//div[@aria-hidden="true"][.//aside[@aria-label="Thanh tra đối tượng"]]').evaluate((el) => el.getBoundingClientRect().width))
          .toBe(0);
        await expect.soft(chip()).toBeVisible();
        await shot(page, '25-A-044', 'collapsed');
      });

      await test.step('[25-E-017] Tab reaches the chip; the hidden panel offers no "Mở mục Phép đo, …"', async () => {
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        await tabTo(page, chip());
        await expect.soft(chip()).toBeFocused();
        await expect.soft(page.getByRole('button', { name: /^Mở mục Phép đo/u })).toHaveCount(0);
        await shot(page, '25-E-017', 'chip_tab');
      });

      await test.step('[25-E-018] the focused chip shows a focus ring', async () => {
        expect.soft(await hasFocusRing(chip()), 'focus ring on the chip').toBe(true);
        await shot(page, '25-E-018', 'chip_ring');
      });

      await test.step('[25-A-046] while collapsed the floating rail "Đo (M)" still works', async () => {
        await expect.soft(viewport(page).getByRole('toolbar', { name: MT.tools, exact: true })).toBeVisible();
        await railTool(page, MT.railMeasure).click();
        await expect.soft(railTool(page, MT.railMeasure)).toHaveAttribute('aria-pressed', 'true');
        await shot(page, '25-A-046', 'floating_rail');
      });

      await test.step('[25-A-045] the chip re-opens the list: region "Phép đo" and the rails are back', async () => {
        await chip().click();
        await expect.soft(list(page)).toBeVisible();
        await expect.soft(storeyChip(page, 'Tầng 1')).toBeVisible();
        await expect.soft(page.getByRole('complementary', { name: MT.inspector, exact: true })).toBeVisible();
        await shot(page, '25-A-045', 'reopened');
      });
    });
  });

  /* ============================================================================================ FL-25-11 */
  test('SCR-25 · FL-25-11 · delete, undo, Delete key, ids across deletes', async ({ browser }) => {
    test.setTimeout(240_000);
    await withMeasureProject(browser, { slug: 'm25-11', records: R2 }, async ({ page, api, admin, projectId }) => {
      let pixels: Point[] = [];
      const removed = seedName('MS-0003');
      let undone: Sent | undefined;
      let mark = 0;
      const newPin = async (): Promise<Sent> => {
        await makeDraft(page, pixels);
        return pinNow(page, projectId);
      };

      await test.step('[25-C-009] two picks + pin after MS-1234: POST "MS-1235", row "Phép đo 1.235"', async () => {
        await openMeasure(page, projectId);
        await topView(page);
        await startMeasuring(page);
        const discBase = await discCount(page);
        const a = await hoverUntilSnap(page, MT.vertex);
        await clickAt(page, a);
        const b = await hoverUntilSnap(page, MT.vertex, { avoid: [a] });
        await clickAt(page, b);
        await expectPicks(page, discBase, 2);
        await expectPicks(page, discBase, 2);
        const sent = await pinNow(page, projectId);
        expect(sent.sent.id).toBe('MS-1235');
        await expect.soft(list(page).getByText(measureName(1235), { exact: true })).toBeVisible();
        await shot(page, '25-C-009', 'thousands_name');
      });

      await test.step('[25-A-042] hover "Phép đo 1.235" + key Delete: DELETE #18 204', async () => {
        await rowOf(page, measureName(1235)).hover();
        const deleted = nextSent(page, 'DELETE', measurementRe(projectId), [204]);
        await page.keyboard.press('Delete');
        expect.soft((await deleted).status).toBe(204);
        await expect.soft(rowOf(page, measureName(1235))).toHaveCount(0);
        await expect.soft(page.getByRole('button', { name: MT.undo, exact: true })).toBeVisible();
        await shot(page, '25-A-042', 'delete_key');
      });

      await test.step('[25-A-041] after the 8 s window the toast is gone and #16 lacks the id', async () => {
        await pointerAway(page); // hovering the toast pauses its timer
        await expect.soft(page.getByRole('button', { name: MT.undo, exact: true })).toHaveCount(0, { timeout: UNDO_WINDOW_MS + 7_000 });
        const read = await admin.get(`/api/projects/${projectId}/measurements`);
        const ids = ((await read.json()) as { id: string }[]).map((record) => record.id);
        expect.soft(ids).not.toContain('MS-1235');
        await shot(page, '25-A-041', 'undo_window_over');
      });

      await test.step('[25-C-010] an id deleted in this session is not reused: POST "MS-1236", row "Phép đo 1.236"', async () => {
        const sent = await newPin();
        expect.soft(sent.sent.id).toBe('MS-1236');
        await expect.soft(list(page).getByText(measureName(1236), { exact: true })).toBeVisible();
        await shot(page, '25-C-010', 'id_not_reused');
      });

      await test.step('[25-A-039] "Xoá {name}": DELETE 204, row gone, toast with "Hoàn tác"', async () => {
        mark = api.length;
        const refetch = waitForApi(page, 'GET', measurementsRe(projectId), [200]);
        const deleted = nextSent(page, 'DELETE', measurementRe(projectId), [204]);
        await page.getByRole('button', { name: `Xoá ${removed}`, exact: true }).click();
        expect.soft((await deleted).status).toBe(204);
        await refetch;
        await expect.soft(rowOf(page, removed)).toHaveCount(0);
        await expect.soft(toastWith(page, `Hoàn tác xoá "${removed}"`)).toBeVisible();
        await shot(page, '25-A-039', 'delete_toast');
      });

      await test.step('[25-G-010] after the 204 exactly one GET #16', async () => {
        expect.soft(calls(api, 'GET', measurementsRe(projectId), mark)).toHaveLength(1);
        await shot(page, '25-G-010', 'one_refetch');
      });

      await test.step('[25-A-040] "Hoàn tác" re-creates the record with the same id and name', async () => {
        const posted = nextSent(page, 'POST', measurementsRe(projectId), [201]);
        await page.getByRole('button', { name: MT.undo, exact: true }).click();
        undone = await posted;
        expect.soft(undone.sent.id).toBe('MS-0003');
        expect.soft(undone.sent.name).toBe(removed);
        await expect.soft(rowOf(page, removed)).toBeVisible();
        await shot(page, '25-A-040', 'undo');
      });

      await test.step('[25-G-011] the undo POST sends the deleted record unchanged -> 201', async () => {
        expect.soft(undone?.status).toBe(201);
        expect.soft(undone?.sent).toEqual(JSON.parse(JSON.stringify(R2[0])));
        await shot(page, '25-G-011', 'undo_body');
      });

      await test.step('[25-A-043] key Delete with no hovered row sends nothing', async () => {
        await pointerAway(page);
        mark = api.length;
        await pressOnCanvas(page, 'Delete');
        await nextFrames(page);
        expect.soft(calls(api, 'DELETE', measurementRe(projectId), mark)).toHaveLength(0);
        await shot(page, '25-A-043', 'delete_no_hover');
      });
    });
  });

  /* ============================================================================================ FL-25-12 */
  test('SCR-25 · FL-25-12 · another session: id taken, undo conflict, deleted elsewhere', async ({ browser }) => {
    test.setTimeout(240_000);
    await withMeasureProject(browser, { slug: 'm25-12', records: R1 }, async ({ page, api, admin, projectId }) => {
      let pixels: Point[] = [];
      const other = (id: string, name: string): MeasureRecord => ({
        id,
        name,
        mode: 'pointToPoint',
        points: [{ x: 0, y: 3000, z: 0 }, { x: 8000, y: 3000, z: 0 }],
        rawValueMm: 8000,
      });
      const measurementWrites = (from: number): string[] =>
        api
          .slice(from)
          .filter((entry) => measurementsRe(projectId).test(entry.path) || measurementRe(projectId).test(entry.path))
          .map((entry) => `${entry.method} ${entry.status}`);

      await test.step('[25-D-001] admin chrome: no "Chỉ xem"; "Xoá {name}" present', async () => {
        await openMeasure(page, projectId);
        await expect(page.getByText('Chỉ xem', { exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: `Xoá ${seedName('MS-0003')}`, exact: true })).toBeVisible();
        await shot(page, '25-D-001', 'admin_chrome');
      });

      await test.step('[25-C-029] id taken by another session: POST 409 -> GET #16 -> POST "MS-0005" 201, no toast', async () => {
        await topView(page);
        const discBase = await discCount(page);
        await startMeasuring(page);
        const a = await hoverUntilSnap(page, MT.vertex);
        await clickAt(page, a);
        const b = await hoverUntilSnap(page, MT.vertex, { avoid: [a] });
        await clickAt(page, b);
        pixels = [a, b];
        await expectPicks(page, discBase, 2);
        expect(await postMeasurement(admin, projectId, other('MS-0004', `${seedName('MS-0004')}-x`)), '+X POST MS-0004').toBe(201);
        const mark = api.length;
        const created = nextSent(page, 'POST', measurementsRe(projectId), [201]);
        await pinButton(page).click();
        const sent = await created;
        expect.soft(sent.sent.id).toBe('MS-0005');
        expect.soft(measurementWrites(mark).slice(0, 3)).toEqual(['POST 409', 'GET 200', 'POST 201']);
        await expect.soft(list(page).getByText(measureName(5), { exact: true })).toBeVisible();
        await expect.soft(toastWith(page, /Mã phép đo vừa bị một phiên khác dùng/u)).toHaveCount(0);
        await shot(page, '25-C-029', 'id_taken_retry');
      });

      await test.step('[25-C-036] undo meets a re-taken id: POST 409 -> GET -> POST "MS-0006" 201, row "Phép đo 6"', async () => {
        const name = seedName('MS-0003');
        const deleted = nextSent(page, 'DELETE', measurementRe(projectId), [204]);
        const afterDelete = waitForApi(page, 'GET', measurementsRe(projectId), [200]);
        await page.getByRole('button', { name: `Xoá ${name}`, exact: true }).click();
        await deleted;
        await afterDelete; // the invalidation GET #16 of the delete is in the log before the mark
        expect(await postMeasurement(admin, projectId, other('MS-0003', `${seedName('MS-0003')}-x`)), '+X POST MS-0003').toBe(201);
        const mark = api.length;
        const restored = nextSent(page, 'POST', measurementsRe(projectId), [201]);
        await page.getByRole('button', { name: MT.undo, exact: true }).click();
        const sent = await restored;
        expect.soft(sent.sent.id).toBe('MS-0006');
        expect.soft(measurementWrites(mark).slice(0, 3)).toEqual(['POST 409', 'GET 200', 'POST 201']);
        await expect.soft(list(page).getByText(measureName(6), { exact: true })).toBeVisible();
        await shot(page, '25-C-036', 'undo_conflict');
      });

      await test.step('[25-C-034] deleted elsewhere: DELETE 404, toast "Phép đo này đã bị xoá ở nơi khác", row gone', async () => {
        const gone = await admin.delete(`/api/projects/${projectId}/measurements/MS-0005`);
        expect(gone.status(), '+X DELETE MS-0005').toBe(204);
        const deleted = nextSent(page, 'DELETE', measurementRe(projectId), [404]);
        await page.getByRole('button', { name: `Xoá ${measureName(5)}`, exact: true }).click();
        expect.soft((await deleted).status).toBe(404);
        await expect.soft(toastWith(page, 'Phép đo này đã bị xoá ở nơi khác')).toBeVisible();
        await expect.soft(rowOf(page, measureName(5))).toHaveCount(0);
        await shot(page, '25-C-034', 'deleted_elsewhere');
      });
    });
  });

  /* ============================================================================================ FL-25-13 */
  test('SCR-25 · FL-25-13 · point budget: limit, no retry, 201-point draft, room freed', async ({ browser }) => {
    test.setTimeout(240_000);
    await withMeasureProject(browser, { slug: 'm25-13', fill: true }, async ({ page, api, projectId }) => {
      let corners: Point[] = [];
      let attemptMark = 0;
      const pickCorners = async (count: number): Promise<void> => {
        for (const corner of corners.slice(0, count)) {
          const at = await hoverNear(page, MT.vertex, corner);
          await clickAt(page, at);
        }
      };

      await test.step('[25-B-023] 100 records: "100 phép đo", the list scrolls inside the inspector', async () => {
        await openMeasure(page, projectId);
        await expect.soft(list(page).getByText('100 phép đo', { exact: true })).toBeVisible();
        const scrolls = await list(page).evaluate((el) => {
          let node: HTMLElement | null = el.parentElement;
          while (node !== null && getComputedStyle(node).overflowY !== 'auto') node = node.parentElement;
          return node !== null && node.scrollHeight > node.clientHeight;
        });
        expect(scrolls, 'an overflow-y:auto ancestor of the list is taller than its box').toBe(true);
        await shot(page, '25-B-023', 'hundred_rows');
      });

      await test.step('[25-C-025] area draft of 3 points at the 20 000-point cap: 422, toast, optimistic row gone, pin still shown', async () => {
        await topView(page);
        await startMeasuring(page);
        corners = await cornerPixels(page);
        await modeRadio(page, MODE.floorArea).click();
        await pickCorners(3);
        attemptMark = api.length;
        const sent = await pinNow(page, projectId, [422]);
        expect.soft(sent.status).toBe(422);
        await expect.soft(toastWith(page, 'Dự án đã chạm giới hạn số phép đo; hãy xoá bớt phép đo cũ rồi ghim lại')).toBeVisible();
        await expect.soft(list(page).getByText(measureName(101), { exact: true })).toHaveCount(0);
        await expect.soft(list(page).getByText('100 phép đo', { exact: true })).toBeVisible();
        await expect.soft(pinButton(page), 'draft kept').toBeVisible();
        await shot(page, '25-C-025', 'limit_reached');
      });

      await test.step('[25-C-026] on that 422 the gateway neither retries nor re-reads', async () => {
        expect.soft(calls(api, 'POST', measurementsRe(projectId), attemptMark)).toHaveLength(1);
        expect.soft(calls(api, 'GET', measurementsRe(projectId), attemptMark), 'GET #16 between the POST and the toast').toHaveLength(0);
        await shot(page, '25-C-026', 'no_retry');
      });

      await test.step('[25-C-028] Esc, then 201 picks + pin: 422 VALIDATION, toast "Chưa ghim được phép đo, hãy thử lại"', async () => {
        await pressOnCanvas(page, 'Escape');
        await expect.soft(pinButton(page)).toHaveCount(0);
        const corner = corners[0];
        if (corner === undefined) throw new Error('corner pixels not computed');
        const at = await hoverNear(page, MT.vertex, corner);
        await clickMany(page, at, 201);
        await nextFrames(page);
        const sent = await pinNow(page, projectId, [422]);
        expect.soft(sent.status).toBe(422);
        expect.soft(asRecord(sent.answer, '422 body').code).toBe('VALIDATION');
        await expect.soft(toastWith(page, 'Chưa ghim được phép đo, hãy thử lại')).toBeVisible();
        await shot(page, '25-C-028', 'points_over_200');
      });

      await test.step('[25-C-027] Esc, delete one 200-point row: room freed, the next 3-point pin -> 201', async () => {
        await pressOnCanvas(page, 'Escape');
        const deleted = nextSent(page, 'DELETE', measurementRe(projectId), [204]);
        await page.getByRole('button', { name: `Xoá ${seedName('MS-0001')}`, exact: true }).click();
        await deleted;
        await pickCorners(3);
        const sent = await pinNow(page, projectId);
        expect.soft(sent.status).toBe(201);
        await shot(page, '25-C-027', 'room_freed');
      });
    });
  });

  /* ============================================================================================ FL-25-14 */
  test('SCR-25 · FL-25-14 · keyboard and AT semantics', async ({ browser }) => {
    test.setTimeout(150_000);
    await withMeasureProject(browser, { slug: 'm25-14', records: R2 }, async ({ page, api, projectId }) => {
      const name = seedName('MS-0003');
      const kbdOf = (button: Locator): Locator => button.locator('xpath=ancestor::span[contains(@class,"items-center")][1]').locator('span[aria-hidden="true"]').first();

      await test.step('[25-E-009] key buttons name their key; the Kbd wrapper is aria-hidden', async () => {
        await openMeasure(page, projectId);
        await topView(page);
        await startMeasuring(page);
        const discBase = await discCount(page);
        const a = await pickSnap(page, MT.vertex);
        await pickSnap(page, MT.vertex, { avoid: [a] });
        await expectPicks(page, discBase, 2); // the pin shows only with 2 points (BUG-651)
        await expect.soft(pinButton(page)).toBeVisible();
        for (const [button, key] of [[pinButton(page), 'Enter'], [dropButton(page), 'Esc'], [toggleButton(page), 'M']] as const) {
          await expect.soft(kbdOf(button)).toHaveText(key);
        }
        await expect.soft(page.getByRole('button', { name: 'Ghim phép đo (phím Enter)', exact: true })).toBeVisible();
        await shot(page, '25-E-009', 'key_buttons');
        await pressOnCanvas(page, 'Escape'); // drop the draft: the next steps press Enter on buttons
      });

      await test.step('[25-E-007] overlay: region "Lớp phủ công cụ đo"; svg and canvas aria-hidden', async () => {
        await expect.soft(overlay(page)).toBeVisible();
        await expect.soft(overlay(page).locator('svg').first()).toHaveAttribute('aria-hidden', 'true');
        await expect.soft(viewport(page).locator('canvas').first()).toHaveAttribute('aria-hidden', 'true');
        await shot(page, '25-E-007', 'overlay_semantics');
      });

      await test.step('[25-E-010] live region: the status bar holds aria-live="polite" text', async () => {
        const live = page.locator('footer[aria-label="Thanh trạng thái"] [aria-live="polite"]');
        await expect.soft(live).toHaveCount(1);
        await expect.soft(live).toHaveText(/\S/u);
        await shot(page, '25-E-010', 'live_region');
      });

      await test.step('[25-E-011] ⚑ Enter on a focused "Ẩn {name}" activates it ("Hiện {name}")', async () => {
        await eye(page, name).focus();
        await page.keyboard.press('Enter');
        // UMT:910-913 + SR:500-534: the canvas-scope Enter binding swallows Enter whenever the user can pin (red).
        await expect.soft(page.getByRole('button', { name: `Hiện ${name}`, exact: true })).toBeVisible();
        await shot(page, '25-E-011', 'enter_on_button');
      });

      await test.step('[25-E-012] Space on a focused "Hiện {name}" activates it ("Ẩn {name}")', async () => {
        if ((await page.getByRole('button', { name: `Hiện ${name}`, exact: true }).count()) === 0) await eye(page, name).click(); // put it in the hidden state first
        await page.getByRole('button', { name: `Hiện ${name}`, exact: true }).focus();
        await page.keyboard.press('Space');
        await expect.soft(page.getByRole('button', { name: `Ẩn ${name}`, exact: true })).toBeVisible();
        await shot(page, '25-E-012', 'space_on_button');
      });

      await test.step('[25-E-015] ⚑ a keyboard user can highlight a row and press Delete', async () => {
        await pointerAway(page); // E-012 clicked the eye: the mouse left on the row would keep the row highlighted
        const mark = api.length;
        await eye(page, name).focus();
        await page.keyboard.press('Delete');
        // MTL:104-116: the highlight is set on mouseenter only -> no DELETE from the keyboard (red).
        await softly.poll(() => calls(api, 'DELETE', measurementRe(projectId), mark).length, { timeout: 5_000 }).toBe(1);
        await shot(page, '25-E-015', 'keyboard_delete');
      });
    });
  });

  /* ============================================================================================ FL-25-15 */
  test('SCR-25 · FL-25-15 · viewer member: read-only but can measure', async ({ browser }) => {
    test.setTimeout(180_000);
    const open = async (b: Browser, admin: APIRequestContext, projectId: string): Promise<OpenPage> => {
      const viewer = await poolUser(admin, 'viewer', 'p05-measure');
      await addProjectMember(admin, projectId, viewer.email);
      return openPoolPage(b, viewer);
    };
    await withMeasureProject(browser, { slug: 'm25-15', records: R1, open }, async ({ page, api, projectId }) => {
      const caption = 'Bạn chỉ có quyền xem dự án này, nên chưa ghim được phép đo. Vẫn đo và đọc số bình thường.'; // UMT:201-202 (FD d1a2908d: capital V)
      const name = seedName('MS-0003');
      let mark = 0;

      await test.step('[25-D-003] viewer member: inspector says "Chỉ xem" / "Bạn đang xem ở vai người xem nên không sửa được mô hình."', async () => {
        await openMeasure(page, projectId);
        const aside = page.getByRole('complementary', { name: MT.inspector, exact: true });
        await expect(aside.getByText('Chỉ xem', { exact: true })).toBeVisible();
        await expect(aside.getByText('Bạn đang xem ở vai người xem nên không sửa được mô hình.', { exact: true })).toBeVisible();
        await shot(page, '25-D-003', 'viewer_inspector');
      });

      await test.step('[25-D-004] pin-blocked caption in the overlay alert and in the list', async () => {
        await expect.soft(overlay(page).getByRole('alert').getByText(caption, { exact: true })).toBeVisible();
        await expect.soft(list(page).getByText(caption, { exact: true })).toBeVisible();
        await shot(page, '25-D-004', 'viewer_caption');
      });

      await test.step('[25-D-005] ⚑ the second sentence starts with a capital ("Vẫn đo") and the notice is said once', async () => {
        // Capital fixed by FD d1a2908d; the same idea is still said in several places (overlay, list, inspector): red while it is.
        await expect.soft(page.getByText(/nên chưa ghim được phép đo\. Vẫn đo/u)).not.toHaveCount(0);
        await expect.soft(page.getByText(/Bạn chỉ có quyền xem dự án này/u), 'said once').toHaveCount(1);
        await shot(page, '25-D-005', 'viewer_copy');
      });

      await test.step('[25-D-006] rows: no "Xoá {name}"; "Ẩn {name}" -> "Hiện {name}" still works', async () => {
        await expect.soft(page.getByRole('button', { name: `Xoá ${name}`, exact: true })).toHaveCount(0);
        await eye(page, name).click();
        await expect.soft(page.getByRole('button', { name: `Hiện ${name}`, exact: true })).toBeVisible();
        await eye(page, name).click();
        await expect.soft(page.getByRole('button', { name: `Ẩn ${name}`, exact: true })).toBeVisible();
        await shot(page, '25-D-006', 'viewer_rows');
      });

      await test.step('[25-D-009] #16 answered 200 with MS-0003', async () => {
        const read = calls(api, 'GET', measurementsRe(projectId))[0];
        expect.soft(read?.status).toBe(200);
        expect.soft(Array.isArray(read?.json) ? (read?.json as { id: string }[]).map((record) => record.id) : []).toContain('MS-0003');
        await shot(page, '25-D-009', 'viewer_read');
      });

      await test.step('[25-D-007] viewer can still measure: key M, two picks -> value pill; pin disabled', async () => {
        await topView(page);
        await startMeasuring(page);
        const base = await pills(page).count();
        const discBase = await discCount(page);
        const a = await pickSnap(page, MT.vertex);
        await pickSnap(page, MT.vertex, { avoid: [a] });
        await expectPicks(page, discBase, 2);
        await expect.soft(pills(page).nth(base)).toHaveText(/^[\d.]+,\d{2} m$/u);
        await expect.soft(pinButton(page)).toBeDisabled();
        await shot(page, '25-D-007', 'viewer_measures');
      });

      await test.step('[25-D-010] a complete draft shows no "Chuỗi đo chưa đóng…" (state stays forbidden)', async () => {
        await expect.soft(page.getByText(MT.partialHint, { exact: true })).toHaveCount(0);
        await shot(page, '25-D-010', 'viewer_no_partial');
      });

      await test.step('[25-D-008] Enter and Delete on a hovered row send nothing', async () => {
        mark = api.length;
        await pressOnCanvas(page, 'Enter');
        await rowOf(page, name).hover();
        await page.keyboard.press('Delete');
        await nextFrames(page);
        await openMeasure(page, projectId); // a real response (GET #16 200) after the attempts
        expect.soft(writesSince(api, mark), 'no POST / DELETE').toEqual([]);
        await shot(page, '25-D-008', 'viewer_no_writes');
      });
    });
  });

  /* ============================================================================================ FL-25-16 */
  test('SCR-25 · FL-25-16 · engineer member, then role lost while open', async ({ browser }) => {
    test.setTimeout(240_000);
    let engineer: PoolUser | undefined;
    const open = async (b: Browser, admin: APIRequestContext, projectId: string): Promise<OpenPage> => {
      engineer = await poolUser(admin, 'engineer', 'p05-measure-dem');
      await addProjectMember(admin, projectId, engineer.email);
      return openPoolPage(b, engineer);
    };
    const setRole = async (admin: APIRequestContext, user: PoolUser, role: 'viewer' | 'engineer'): Promise<number> =>
      (await admin.patch(`/api/users/${user.id}/role`, { data: { role, userId: user.id } })).status();
    try {
      await withMeasureProject(browser, { slug: 'm25-16', records: R1, open }, async ({ page, admin, projectId }) => {
        let pixels: Point[] = [];
        const name = seedName('MS-0003');

        await test.step('[25-D-002] engineer member: pin -> POST 201, then "Xoá" the new row -> DELETE 204', async () => {
          await openMeasure(page, projectId);
          await topView(page);
          await startMeasuring(page);
          const discBase = await discCount(page);
          const a = await pickSnap(page, MT.vertex);
          const b = await pickSnap(page, MT.vertex, { avoid: [a] });
          pixels = [a, b];
          await expectPicks(page, discBase, 2);
          const sent = await pinNow(page, projectId);
          expect(sent.status).toBe(201);
          const deleted = nextSent(page, 'DELETE', measurementRe(projectId), [204]);
          await page.getByRole('button', { name: `Xoá ${String(sent.sent.name)}`, exact: true }).click();
          expect((await deleted).status).toBe(204);
          await shot(page, '25-D-002', 'engineer_writes');
        });

        await test.step('[25-C-032] role lost while open (changed at the first token refresh): pin -> POST 403, toast "Bạn không có quyền ghim phép đo trong dự án này"', async () => {
          if (engineer === undefined) throw new Error('engineer not prepared');
          expect(await setRole(admin, engineer, 'viewer'), '#41 demote').toBe(200);
          await makeDraft(page, pixels);
          const sent = await pinNow(page, projectId, [403]);
          expect.soft(sent.status).toBe(403);
          await expect.soft(toastWith(page, 'Bạn không có quyền ghim phép đo trong dự án này')).toBeVisible();
          await shot(page, '25-C-032', 'pin_forbidden');
        });

        await test.step('[25-C-033] "Xoá {name}" after the demotion: DELETE 403, toast "Bạn không có quyền xoá phép đo trong dự án này"', async () => {
          // The role changes at the FIRST token refresh (401 SESSION_REVOKED -> refresh -> roles ['viewer'], refresh.ts:493), so after
          // C-032 the shell is already read-only and "Xoá" is gone. Restore the role, reload, demote again, then delete.
          if (engineer === undefined) throw new Error('engineer not prepared');
          expect(await setRole(admin, engineer, 'engineer'), '#41 restore').toBe(200);
          await openMeasure(page, projectId);
          await expect(page.getByRole('button', { name: `Xoá ${name}`, exact: true })).toBeVisible();
          expect(await setRole(admin, engineer, 'viewer'), '#41 demote again').toBe(200);
          const deleted = nextSent(page, 'DELETE', measurementRe(projectId), [403]);
          await page.getByRole('button', { name: `Xoá ${name}`, exact: true }).click();
          expect.soft((await deleted).status).toBe(403);
          await expect.soft(toastWith(page, 'Bạn không có quyền xoá phép đo trong dự án này')).toBeVisible();
          await shot(page, '25-C-033', 'delete_forbidden');
        });

        await test.step('[25-D-011] after a reload the screen is read-only ("Chỉ xem")', async () => {
          await openMeasure(page, projectId);
          await expect.soft(page.getByRole('complementary', { name: MT.inspector, exact: true }).getByText('Chỉ xem', { exact: true })).toBeVisible();
          await shot(page, '25-D-011', 'after_demotion');
        });
      });
    } finally {
      if (engineer !== undefined) {
        // withMeasureProject has disposed its admin context: restore the pool engineer with a fresh admin session.
        const fresh = await adminApi();
        try {
          expect(await setRole(fresh, engineer, 'engineer'), 'restore the pool engineer').toBe(200);
        } finally {
          await fresh.dispose();
        }
      }
    }
  });

  /* ============================================================================================ FL-25-17 */
  test('SCR-25 · FL-25-17 · gate and auth', async ({ browser }) => {
    test.setTimeout(150_000);
    await withMeasureProject(browser, { slug: 'm25-17' }, async ({ page, admin, projectId }) => {
      const notFound = (target: Page): Locator => target.getByRole('alert').filter({ hasText: NOT_FOUND_TITLE });

      await test.step('[25-A-049] unknown project id: not-found copy; "Về danh sách dự án" -> /', async () => {
        await page.goto(ROUTES.project.measure(unknownProjectId()));
        await expect(page.getByText(NOT_FOUND_TITLE, { exact: true })).toBeVisible();
        await expect(page.getByText(NOT_FOUND_TEXT, { exact: true })).toBeVisible();
        await shot(page, '25-A-049', 'unknown_project');
        await page.getByRole('button', { name: BACK_TO_PROJECTS, exact: true }).or(page.getByRole('link', { name: BACK_TO_PROJECTS, exact: true })).click();
        await expect.poll(() => new URL(page.url()).pathname).toBe(ROUTES.dashboard);
      });

      await test.step('[25-E-022] the fallback sits inside <main> and is an alert', async () => {
        await page.goto(ROUTES.project.measure(unknownProjectId()));
        await expect.soft(page.getByRole('main').getByRole('alert').filter({ hasText: NOT_FOUND_TITLE })).toHaveCount(1);
        await expect.soft(notFound(page)).toBeVisible();
        await shot(page, '25-E-022', 'fallback_semantics');
      });

      await test.step('[25-A-050] a non-member (engineer) opening the project gets the same not-found copy', async () => {
        const stranger = await poolUser(admin, 'engineer', 'p05-measure');
        const other = await openPoolPage(browser, stranger);
        try {
          await other.page.goto(ROUTES.project.measure(projectId));
          await expect.soft(other.page.getByText(NOT_FOUND_TITLE, { exact: true })).toBeVisible();
          await expect.soft(other.page.getByText(NOT_FOUND_TEXT, { exact: true })).toBeVisible();
          await shot(other.page, '25-A-050', 'non_member');
        } finally {
          await closePage(other);
        }
      });

      await test.step('[25-A-048] anonymous deep link -> /login?next=… with "Hãy đăng nhập để tiếp tục."', async () => {
        const anonymous = await browser.newContext({ baseURL: readBaseUrl(), viewport: DESKTOP });
        try {
          const anon = await anonymous.newPage();
          await anon.goto(ROUTES.project.measure(projectId));
          await softly.poll(() => pathOf(anon.url())).toBe(loginUrl(ROUTES.project.measure(projectId)));
          await expect.soft(anon.getByText('Hãy đăng nhập để tiếp tục.', { exact: true })).toBeVisible();
          await shot(anon, '25-A-048', 'anonymous');
        } finally {
          await anonymous.close();
        }
      });
    });
  });

  /* ============================================================================================ FL-25-18 */
  test('SCR-25 · FL-25-18 · empty and partial projects', async ({ browser }) => {
    test.setTimeout(180_000);
    const admin = await adminApi();
    const created: string[] = [];
    let opened: OpenPage | undefined;
    try {
      const empty = await createProject(admin, 'm25-18a', 0);
      created.push(empty.projectId);
      const bare = await createProject(admin, 'm25-18b', 1);
      created.push(bare.projectId);
      const partial = await createQcProject(layerOf(admin), 'm25-18c', ['Tầng 1', 'Tầng trống'], 1);
      const partialId = partial[0]?.projectId;
      if (partialId === undefined) throw new Error('setup: no partial project');
      created.push(partialId);
      opened = await openAdminPage(browser);
      const { page } = opened;
      const cornerControls = (): Locator[] => [
        page.getByRole('group', { name: MT.cube, exact: true }),
        page.getByRole('group', { name: MT.zoomGroup, exact: true }),
        page.locator('dl[aria-label="Chú giải"]'),
        page.locator('ol[aria-label="Cao độ tầng"]'),
      ];

      await test.step('[25-B-016] zero floors: no corner controls (BUG-486), status "0 tầng · 0 phòng · 0,00 m²"', async () => {
        await openMeasure(page, empty.projectId);
        for (const control of cornerControls()) await expect(control).toHaveCount(0);
        await expect(footerOf(page)).toContainText('0 tầng · 0 phòng · 0,00 m²');
        await shot(page, '25-B-016', 'zero_floors');
      });

      await test.step('[25-B-017] ⚑ a zero-floor project says there is no model to measure', async () => {
        // VVP:141-177 paints nothing in state `empty` and MTV:226-236 still invites "Nhấn M rồi chọn hai điểm trên mô hình." (red).
        await expect.soft(page.getByText(MT.emptyHint, { exact: true }), 'the measuring invitation is not offered without a model').toHaveCount(0);
        await expect.soft(page.getByText(/chưa có (mô hình|tầng)|không có mô hình/iu)).not.toHaveCount(0);
        await shot(page, '25-B-017', 'zero_floors_message');
      });

      await test.step('[25-B-019] one floor without a layer: corner controls hidden, status "1 tầng · 0 phòng · 0,00 m²"', async () => {
        await openMeasure(page, bare.projectId);
        for (const control of cornerControls()) await expect.soft(control).toHaveCount(0);
        await expect.soft(footerOf(page)).toContainText('1 tầng · 0 phòng · 0,00 m²');
        await shot(page, '25-B-019', 'no_layer');
      });

      await test.step('[25-B-018] partial project: the chip of the floor without rooms is dimmed (opacity-50)', async () => {
        await openMeasure(page, partialId);
        await expect.soft(storeyChip(page, 'Tầng trống')).toHaveClass(/opacity-50/u);
        await expect.soft(storeyChip(page, 'Tầng 1')).not.toHaveClass(/opacity-50/u);
        await shot(page, '25-B-018', 'partial_chip');
      });
    } finally {
      for (const id of created) await deleteSeededProject(admin, id).catch(() => undefined);
      await closePage(opened);
      await admin.dispose();
    }
  });
});
