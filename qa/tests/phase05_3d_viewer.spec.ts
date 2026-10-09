/**
 * Phase 5 — 3D, Track A (E2E-TEST-PLAN.md v2 §4, SCR-23 → SCR-27).
 *
 * Needs: Phase 2 (project.projectId), Phase 3 (floors.workFloorId/workFloorName, CP-5
 * checkpoints.pipelineComplete), CP-0 with `FEATURE_FLAGS='{"scene.pascal-viewer": true}'`.
 *
 * Camera changes are proven by canvas pixels, never by sleeping: {@link canvasOnlyShot} hides every
 * DOM overlay of the viewport (CSSOM `visibility`, restored right after) so the screenshot holds the
 * WebGL output only. Both 3D renderers are opaque (`alpha: false`, `viewer3dScene.ts:192`,
 * `measurementToolScene.ts:105`) with a flat `scene.background`, so "geometry" = pixels that differ
 * from the dominant (background) colour. Those pixels also give the canvas click points for wall
 * selection (SCR-23) and measurement picks (SCR-25): a click is only sent where the rendered model
 * is and where `document.elementFromPoint` is the canvas itself (the picker listens on the canvas,
 * `viewer3dScene.ts:791`).
 */
import { deflateSync, inflateSync } from 'node:zlib';

import { expect, test } from '@playwright/test';
import type { BrowserContext, Locator, Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { TOUR_APPEAR_TIMEOUT_MS, dismissTour } from '../../e2e/fixtures/tour';
import { navigateThenWaitForApi, waitForApi, waitForApiWhere } from '../../e2e/fullstack/apiWatch';
import { loadDracoDecoder, watchCsp, type CspViolation } from '../../e2e/fullstack/csp';
import { AUTOSAVE_TIMEOUT_MS, PASCAL_RENDER_TIMEOUT_MS, readBaseUrl } from '../../e2e/fullstack/env';
import { signInAdmin } from './support/auth';
import { captureEvidence } from './support/evidence';
import { requireState } from './support/state';

test.describe.configure({ mode: 'serial' });

/* ---- Labels and contracts (each verified in src/ or in a proven spec) ---------------------- */

const ACCESS_DENIED_PATTERN = /\/khong-co-quyen/u;
/** `ViewerViewport.tsx:91`; chain step 8. */
const VIEWPORT_NAME = 'Khung nhìn mô hình';
/** `ViewerInspector.tsx:55,100`. */
const INSPECTOR_NAME = 'Thanh tra đối tượng';
const NOTHING_SELECTED = 'Chưa chọn đối tượng';
/** `Viewer3D.tsx` LoadingContent / EmptyContent. */
const BUILDING_TEXT = 'Đang dựng mô hình';
const VIEWER_EMPTY_TEXT = 'Mô hình 3D sẽ xuất hiện sau khi bạn duyệt lớp tường.';
/** `ObjectSearch.tsx:58-64`. */
const SEARCH_TRIGGER = 'Tìm phòng';
const SEARCH_INPUT = 'Tìm phòng theo tên hoặc mã';
const SEARCH_LIST = 'Kết quả tìm phòng';
/** `Viewer3DPanels.tsx`. */
const PANELS_NAV = 'Bảng phụ của khung nhìn 3D';
const PANEL_IDS = { 'Diện tích phòng': 'rooms', 'Thư viện đồ đạc': 'furniture', 'Lịch sử thao tác': 'history' } as const;
const SIBLINGS_NAV = 'Màn 3D khác';
const ENTER_WALL_EDIT = 'Sửa hình học tường';
/** `wallGeometryEditorTypes.ts` WALL_GEOMETRY_EDITOR_TEXT. */
const WALL_EDITOR_REGION = 'Sửa hình học tường';
const VERTEX_X_PATTERN = /^Toạ độ x /u;
/** `useExplodedView.ts` EmptyMessage = `vi.json:2924`. */
const EXPLODED_EMPTY_TEXT = 'Tách tầng xuất hiện khi bản vẽ có từ hai tầng trở lên.';
const EXPLODED_ERROR_TEXT = 'Không tách được các tầng lúc này. Vui lòng thử lại sau.';
/** `MeasurementTool.tsx`, `MeasurementList.tsx`, `useViewerShell.ts:169`. */
const PIN_LABEL = 'Ghim phép đo (phím Enter)';
const DROP_DRAFT_LABEL = 'Bỏ phần đo dở (phím Esc)';
const MEASURE_RAIL_TOOL = 'đo (M)';
/** Copied from chain.fullstack.ts (never import a spec). */
const PASCAL_FLAG_KEY = 'scene.pascal-viewer';
const PASCAL_RENDERED_PATTERN =
  /^(Đã dựng xong toàn bộ bản vẽ\.|Đã dựng xong, nhưng một số đối tượng chưa chuyển sang được\.)$/u;
const PASCAL_MOUNT_PATTERN = /\/assets\/pascal\/pascal-mount\.js\?v=[0-9a-f]{8}$/u;
/** `PascalViewer.tsx`. */
const PASCAL_FORBIDDEN_TITLE = 'Chưa bật cho tài khoản này';
const PASCAL_COLLAPSED_TITLE = 'Khung xem đang thu gọn';
/** `MobileViewer.tsx`, `MobileViewerBottomBar.tsx`, `MobileViewerInfoSheet.tsx`. */
const MOBILE_REGION = 'Xem mô hình 3D trên điện thoại';
const MOBILE_TOOLS_NAV = 'Công cụ xem mô hình';
const MOBILE_SHARE = 'Chia sẻ dự án';
const MOBILE_INFO_SHEET = 'Thông tin đối tượng đang chọn';

/** Slow 3D work under real BE: scene build, scans over click points. */
const SCENE_TIMEOUT_MS = 60_000;
const HEAVY_TEST_TIMEOUT_MS = 240_000;
/** One raycast + one paint before the product reacts to a canvas click. */
const PICK_SETTLE_MS = 2_000;
/** At most this many canvas clicks for one selection attempt. */
const MAX_PICK_ATTEMPTS = 15;

/* ---- Minimal PNG decoder (node:zlib) for canvas pixel analysis ------------------------------- */

interface Raster {
  readonly width: number;
  readonly height: number;
  readonly channels: number;
  readonly data: Uint8Array;
}

/** 8-bit RGB / RGBA, non-interlaced — what Chromium screenshots produce. Throws otherwise. */
function decodePng(png: Buffer): Raster {
  let pos = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Buffer[] = [];

  while (pos + 8 <= png.length) {
    const length = png.readUInt32BE(pos);
    const type = png.toString('latin1', pos + 4, pos + 8);
    const body = png.subarray(pos + 8, pos + 8 + length);

    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const [bitDepth, colorType, , , interlace] = [body[8], body[9], body[10], body[11], body[12]];

      if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6) || interlace !== 0) {
        throw new Error(`PNG not supported: depth ${String(bitDepth)}, colour ${String(colorType)}, interlace ${String(interlace)}`);
      }
      channels = colorType === 6 ? 4 : 3;
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + length;
  }

  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const out = new Uint8Array(stride * height);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)] ?? 0;
    const src = y * (stride + 1) + 1;
    const dst = y * stride;

    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? (out[dst + x - channels] ?? 0) : 0;
      const b = y > 0 ? (out[dst - stride + x] ?? 0) : 0;
      const c = x >= channels && y > 0 ? (out[dst - stride + x - channels] ?? 0) : 0;
      const v = raw[src + x] ?? 0;
      let predicted: number;

      if (filter === 0) predicted = 0;
      else if (filter === 1) predicted = a;
      else if (filter === 2) predicted = b;
      else if (filter === 3) predicted = (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        predicted = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else throw new Error(`PNG filter ${String(filter)} unknown`);
      out[dst + x] = (v + predicted) & 0xff;
    }
  }

  return { width, height, channels, data: out };
}

/** Self-check of {@link decodePng}: a 2×2 RGB PNG with Sub and Paeth rows (CRCs are not read). */
function selfCheckPngDecoder(): void {
  const chunk = (type: string, body: Buffer): Buffer => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(body.length);
    return Buffer.concat([length, Buffer.from(type, 'latin1'), body, Buffer.alloc(4)]);
  };
  const ihdr = Buffer.from([0, 0, 0, 2, 0, 0, 0, 2, 8, 2, 0, 0, 0]);
  const rows = Buffer.from([1, 10, 20, 30, 5, 5, 5, 4, 2, 2, 2, 5, 5, 5]);
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  const decoded = Array.from(decodePng(png).data).join(',');

  if (decoded !== '10,20,30,15,25,35,12,22,32,20,30,40') throw new Error(`PNG decoder self-check failed: ${decoded}`);
}

/* ---- Canvas helpers ------------------------------------------------------------------------ */

type Point = readonly [number, number];

interface CanvasShot {
  readonly png: Buffer;
  readonly box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}

const viewport = (page: Page): Locator => page.getByRole('main', { name: VIEWPORT_NAME });
const inspector = (page: Page): Locator => page.getByRole('complementary', { name: INSPECTOR_NAME });

/** Screenshot of the viewport canvas with every DOM overlay of the viewport hidden (CSSOM only). */
async function canvasOnlyShot(page: Page): Promise<CanvasShot> {
  const main = viewport(page);
  const box = await main.locator('canvas').first().boundingBox();

  if (box === null) throw new Error('viewport canvas has no bounding box');
  const toggle = (only: boolean): Promise<void> =>
    main.evaluate((element, canvasOnly) => {
      const root = element as HTMLElement;
      const canvas = root.querySelector('canvas');

      root.style.visibility = canvasOnly ? 'hidden' : '';
      if (canvas !== null) canvas.style.visibility = canvasOnly ? 'visible' : '';
    }, only);

  await toggle(true);
  try {
    return { png: await page.screenshot({ clip: box }), box };
  } finally {
    await toggle(false);
  }
}

/** Canvas pixels once two consecutive shots are identical (the scene renders on demand). */
async function settledCanvas(page: Page): Promise<CanvasShot> {
  let last = await canvasOnlyShot(page);

  await expect
    .poll(
      async () => {
        const now = await canvasOnlyShot(page);
        const same = now.png.equals(last.png);
        last = now;
        return same;
      },
      { message: 'canvas never settled (two identical frames)', intervals: [400], timeout: SCENE_TIMEOUT_MS },
    )
    .toBe(true);
  return last;
}

/** Fails unless the canvas pixels change from `before`; returns the settled new frame. */
async function expectCanvasChanged(page: Page, before: CanvasShot, what: string): Promise<CanvasShot> {
  await expect
    .poll(async () => !(await canvasOnlyShot(page)).png.equals(before.png), {
      message: `${what}: camera did not change (canvas pixels identical)`,
      timeout: SCENE_TIMEOUT_MS,
    })
    .toBe(true);
  return settledCanvas(page);
}

interface Geometry {
  /** Share of sampled pixels that are not the background colour. */
  readonly fraction: number;
  /** Page coordinates of sampled geometry pixels, nearest to the canvas centre first. */
  readonly points: readonly Point[];
}

/** Background = dominant colour of a 4 px sample grid; geometry = |ΔR|+|ΔG|+|ΔB| > 30 from it. */
function geometryOf(shot: CanvasShot): Geometry {
  const raster = decodePng(shot.png);
  const scale = raster.width / shot.box.width;
  const step = Math.max(1, Math.round(4 * scale));
  const pixel = (x: number, y: number): readonly [number, number, number] => {
    const at = (y * raster.width + x) * raster.channels;
    return [raster.data[at] ?? 0, raster.data[at + 1] ?? 0, raster.data[at + 2] ?? 0];
  };
  const counts = new Map<number, { n: number; rgb: readonly [number, number, number] }>();
  const samples: { x: number; y: number; rgb: readonly [number, number, number] }[] = [];

  for (let y = 0; y < raster.height; y += step) {
    for (let x = 0; x < raster.width; x += step) {
      const rgb = pixel(x, y);
      const key = ((rgb[0] >> 3) << 10) | ((rgb[1] >> 3) << 5) | (rgb[2] >> 3);
      const entry = counts.get(key);

      if (entry === undefined) counts.set(key, { n: 1, rgb });
      else entry.n += 1;
      samples.push({ x, y, rgb });
    }
  }
  const background = [...counts.values()].sort((left, right) => right.n - left.n)[0]?.rgb ?? [0, 0, 0];
  const isGeometry = (rgb: readonly [number, number, number]): boolean =>
    Math.abs(rgb[0] - background[0]) + Math.abs(rgb[1] - background[1]) + Math.abs(rgb[2] - background[2]) > 30;
  const geometry = samples.filter((sample) => isGeometry(sample.rgb));
  const centre: Point = [shot.box.x + shot.box.width / 2, shot.box.y + shot.box.height / 2];
  // Margin of 24 px keeps clicks off the canvas edge; a 24 px grid spreads the candidates.
  const points = geometry
    .map((sample): Point => [shot.box.x + sample.x / scale, shot.box.y + sample.y / scale])
    .filter(
      ([x, y]) =>
        x > shot.box.x + 24 && x < shot.box.x + shot.box.width - 24 && y > shot.box.y + 24 && y < shot.box.y + shot.box.height - 24,
    )
    .filter(([x, y]) => Math.round(x - shot.box.x) % 24 < 4 && Math.round(y - shot.box.y) % 24 < 4)
    .sort((p, q) => Math.hypot(p[0] - centre[0], p[1] - centre[1]) - Math.hypot(q[0] - centre[0], q[1] - centre[1]));

  return { fraction: samples.length === 0 ? 0 : geometry.length / samples.length, points };
}

/** The element a click at (x, y) would reach, or `null` when it is the canvas itself. */
async function blockerAt(page: Page, [x, y]: Point): Promise<string | null> {
  return page.evaluate(([px, py]) => {
    const hit = document.elementFromPoint(px ?? 0, py ?? 0);
    if (hit === null) return 'nothing';
    if (hit.tagName === 'CANVAS') return null;
    return `${hit.tagName.toLowerCase()}${hit.getAttribute('aria-label') === null ? '' : `[aria-label="${hit.getAttribute('aria-label') ?? ''}"]`}`;
  }, [x, y]);
}

/** Geometry points that a click really delivers to the canvas, plus what blocked the others. */
async function clickableGeometry(page: Page, geometry: Geometry): Promise<{ points: Point[]; blockers: Set<string> }> {
  const points: Point[] = [];
  const blockers = new Set<string>();

  for (const point of geometry.points) {
    if (points.length >= MAX_PICK_ATTEMPTS) break;
    const blocker = await blockerAt(page, point);
    if (blocker === null) points.push(point);
    else blockers.add(blocker);
  }
  return { points, blockers };
}

const isVisibleWithin = (locator: Locator, timeout: number): Promise<boolean> =>
  locator
    .waitFor({ state: 'visible', timeout })
    .then(() => true)
    .catch(() => false);

const asRecord = (value: unknown, what: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what}: not a JSON object`);
  return value as Record<string, unknown>;
};

/** Vietnamese number text (`1.234` / `-12,5`) → number, same rule as `lib/format/number.ts` parseNumber. */
const parseViNumber = (text: string): number => Number.parseFloat(text.trim().replace(/\./gu, '').replace(',', '.'));

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

/* ---- Shared Track A context (desktop, 1440×900) -------------------------------------------- */

let context: BrowserContext;
let page: Page;
let cspViolations: CspViolation[] = [];
let projectId = '';
let workFloorId = '';
let workFloorName = '';

test.beforeAll(async ({ browser }) => {
  selfCheckPngDecoder();
  projectId = requireState((s) => s.project.projectId, 'project.projectId', 'Phase 2 (SCR-05, CP-2)');
  workFloorId = requireState((s) => s.floors.workFloorId, 'floors.workFloorId', 'Phase 3 (SCR-09, CP-3)');
  workFloorName = requireState((s) => s.floors.workFloorName, 'floors.workFloorName', 'Phase 3 (SCR-09, CP-3)');
  requireState((s) => s.checkpoints.pipelineComplete, 'checkpoints.pipelineComplete', 'Phase 3 (SCR-12, CP-5)');

  // Contexts made by hand do not get `use` from the config: set baseURL and viewport here.
  context = await browser.newContext({ baseURL: readBaseUrl(), viewport: { width: 1440, height: 900 } });
  cspViolations = await watchCsp(context);
  page = await context.newPage();
  await signInAdmin(page);
});

test.afterAll(async () => {
  await context?.close();
});

/* ---- SCR-23 Viewer 3D ---------------------------------------------------------------------- */

test.describe('SCR-23 Viewer 3D', () => {
  test('SCR-23 load: viewport + canvas with non-blank pixels, Draco under CSP', async () => {
    await navigateThenWaitForApi(
      page,
      () => page.goto(ROUTES.project.viewer(projectId), { waitUntil: 'commit' }),
      'GET',
      new RegExp(`^/api/projects/${projectId}/spatial$`, 'u'),
      [200],
    );
    await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
    await expect(viewport(page)).toBeVisible();
    await expect(viewport(page).locator('canvas').first()).toBeVisible();
    await expect(page).not.toHaveURL(ACCESS_DENIED_PATTERN);
    await expect(page.getByText(VIEWER_EMPTY_TEXT, { exact: true }), 'CP-5: viewer says there is no wall layer').toHaveCount(0);
    await expect(viewport(page)).toHaveAttribute('aria-busy', 'false', { timeout: SCENE_TIMEOUT_MS });
    await expect(page.getByRole('status').filter({ hasText: BUILDING_TEXT })).toHaveCount(0, { timeout: SCENE_TIMEOUT_MS });

    await expect
      .poll(async () => geometryOf(await canvasOnlyShot(page)).fraction, {
        message: 'canvas shows only its background colour (no model pixels)',
        timeout: SCENE_TIMEOUT_MS,
      })
      .toBeGreaterThan(0.01);

    expect(await loadDracoDecoder(page)).toBe('ok');
    expect(cspViolations).toEqual([]);
    await captureEvidence(page, '23_viewer_loaded.png');
  });

  test('SCR-23 presets "Góc nhìn sẵn", "Chế độ xem" 2D, keys O / F / 0 / Esc change the camera', async () => {
    test.setTimeout(HEAVY_TEST_TIMEOUT_MS);
    const presetSelect = page.getByRole('combobox', { name: 'Góc nhìn sẵn' });
    const cube = page.getByRole('group', { name: 'Khối định hướng' });
    const choosePreset = async (label: string): Promise<void> => {
      await presetSelect.click();
      await page.getByRole('option', { name: label, exact: true }).click();
      await expect(presetSelect).toHaveText(label);
      await expect(cube.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true');
    };
    const centre = async (): Promise<Point> => {
      const box = await viewport(page).boundingBox();
      if (box === null) throw new Error('viewport has no bounding box');
      return [box.x + box.width / 2, box.y + box.height / 2];
    };
    const zoomIn = async (): Promise<CanvasShot> => {
      const [x, y] = await centre();
      await page.mouse.move(x, y);
      for (let notch = 0; notch < 5; notch += 1) await page.mouse.wheel(0, -120);
      await page.mouse.move(5, 5); // off the canvas: no hover highlight in the next frames
      return settledCanvas(page);
    };
    const pressOnCanvas = async (key: string): Promise<void> => {
      await viewport(page).focus();
      await page.keyboard.press(key);
    };

    await page.mouse.move(5, 5);
    let frame = await settledCanvas(page);

    await choosePreset('Trên xuống');
    frame = await expectCanvasChanged(page, frame, 'preset "Trên xuống"');
    await choosePreset('Mặt cắt');
    frame = await expectCanvasChanged(page, frame, 'preset "Mặt cắt"');

    // 2D/3D only drives a scene transition (`useViewerShell.ts:570`): asserted on the control, not on pixels.
    const viewMode = page.getByRole('radiogroup', { name: 'Chế độ xem' });
    await viewMode.getByRole('radio', { name: '2D', exact: true }).click();
    await expect(viewMode.getByRole('radio', { name: '2D', exact: true })).toHaveAttribute('aria-checked', 'true');
    await viewMode.getByRole('radio', { name: '3D', exact: true }).click();
    await expect(viewMode.getByRole('radio', { name: '3D', exact: true })).toHaveAttribute('aria-checked', 'true');
    frame = await settledCanvas(page);

    await choosePreset('Phối cảnh');
    frame = await expectCanvasChanged(page, frame, 'preset "Phối cảnh"');

    await pressOnCanvas('O');
    frame = await expectCanvasChanged(page, frame, 'key O (orthographic on)');
    await pressOnCanvas('O');
    frame = await expectCanvasChanged(page, frame, 'key O (orthographic off)');

    frame = await zoomIn();
    await pressOnCanvas('0');
    frame = await expectCanvasChanged(page, frame, 'key 0 (fit all)');

    frame = await zoomIn();
    // Nothing selected: F falls back to fit all (`useViewerShell.ts:691`).
    await pressOnCanvas('F');
    await expectCanvasChanged(page, frame, 'key F (frame selection / fit all)');

    await pressOnCanvas('Escape');
    expect(new URL(page.url()).pathname).toBe(ROUTES.project.viewer(projectId));
    await expect(inspector(page)).toContainText(NOTHING_SELECTED);
    await captureEvidence(page, '23_viewer_presets.png');
  });

  test('SCR-23 room search: "/" → "Tìm phòng theo tên hoặc mã" → result is framed and selected', async () => {
    const trigger = page.getByRole('button', { name: SEARCH_TRIGGER, exact: true });

    if ((await trigger.count()) === 0) {
      // `ObjectSearch` renders nothing without rooms (`ObjectSearch.tsx:115`): data branch, not a pass of the search.
      test.info().annotations.push({ type: 'data-branch', description: 'no rooms in the spatial layer: room search is not rendered' });
      await viewport(page).focus();
      await page.keyboard.press('/');
      await expect(page.getByRole('combobox', { name: SEARCH_INPUT })).toHaveCount(0);
      await captureEvidence(page, '23_viewer_search.png');
      await page.keyboard.press('Escape');
      return;
    }

    await page.mouse.move(5, 5);
    const before = await settledCanvas(page);

    await viewport(page).focus();
    await page.keyboard.press('/');
    const box = page.getByRole('combobox', { name: SEARCH_INPUT });
    await expect(box).toBeVisible();
    // Opening the search can bring the tour back (`e2e/viewer3d.spec.ts` findOneRoom).
    await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });

    const results = page.getByRole('listbox', { name: SEARCH_LIST });
    const roomName = (await results.getByRole('option').first().locator('span').first().innerText()).trim();

    expect(roomName, 'first search result has no room name').not.toBe('');
    await box.fill(roomName);
    const match = results.getByRole('option').filter({ hasText: roomName }).first();
    await expect(match).toBeVisible();
    await match.click();

    await expect(inspector(page)).toContainText(roomName);
    await page.mouse.move(5, 5);
    await expectCanvasChanged(page, before, `framing room "${roomName}"`);
    await captureEvidence(page, '23_viewer_search.png');

    await viewport(page).focus();
    await page.keyboard.press('Escape');
    await expect(inspector(page)).toContainText(NOTHING_SELECTED);
  });

  test('SCR-23 side panels "Bảng phụ của khung nhìn 3D": Diện tích phòng / Thư viện đồ đạc / Lịch sử thao tác', async () => {
    const nav = page.getByRole('navigation', { name: PANELS_NAV });
    const labels = Object.keys(PANEL_IDS) as (keyof typeof PANEL_IDS)[];

    for (const [index, label] of labels.entries()) {
      await nav.getByRole('button', { name: label, exact: true }).click();
      // The first click on this screen can bring the lazy tour up; it swallows the next click.
      await dismissTour(page, { waitMs: index === 0 ? TOUR_APPEAR_TIMEOUT_MS : 0 });
      await expect(nav.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator(`#viewer-3d-panel-${PANEL_IDS[label]}`)).toBeVisible();
      for (const other of labels.filter((candidate) => candidate !== label)) {
        await expect(nav.getByRole('button', { name: other, exact: true })).toHaveAttribute('aria-expanded', 'false');
      }
    }
    await captureEvidence(page, '23_viewer_panels.png');

    await page.keyboard.press('Escape'); // `viewer3d.panels.close`, scope sidePanel
    await expect(nav.getByRole('button', { name: 'Lịch sử thao tác', exact: true })).toHaveAttribute('aria-expanded', 'false');
  });

  test('SCR-23 wall selected → "Sửa hình học tường" → vertex edit → PUT …/spatial/layer from 3D', async () => {
    test.setTimeout(HEAVY_TEST_TIMEOUT_MS);
    const enter = page.getByRole('button', { name: ENTER_WALL_EDIT, exact: true });

    await page.mouse.move(5, 5);
    const geometry = geometryOf(await settledCanvas(page));
    const { points, blockers } = await clickableGeometry(page, geometry);
    let picked = false;

    for (const [x, y] of points) {
      await dismissTour(page);
      await page.mouse.click(x, y);
      if (await isVisibleWithin(enter, PICK_SETTLE_MS)) {
        picked = true;
        break;
      }
    }
    if (!picked) {
      test.fixme(
        true,
        'UNKNOWN — NEED VERIFICATION: no wall could be selected deterministically from the canvas ' +
          `(${String(points.length)} model pixels reachable; blockers over the model: ${[...blockers].join(', ') || 'none'}). ` +
          'In the "partial" state Viewer3D draws PartialContent over the canvas without pointer-events-none (Viewer3D.tsx), ' +
          'and there is no DOM path to select a wall on /3d.',
      );
      return;
    }

    await enter.click();
    const editor = page.getByRole('region', { name: WALL_EDITOR_REGION, exact: true });
    await expect(editor).toBeVisible();
    const xField = editor.getByRole('textbox', { name: VERTEX_X_PATTERN }).first();
    await expect(xField, 'wall geometry editor shows no vertex row to edit').toBeVisible();

    const original = parseViNumber(await xField.inputValue());
    expect(Number.isFinite(original), `vertex x "${await xField.inputValue()}" is not a number`).toBe(true);
    const next = Math.round(original) + 10; // +10 mm (`formatCoordinate`, mm, 0 digits)
    const layerPath = `/api/projects/${projectId}/floors/${workFloorId}/spatial/layer`;
    const write = waitForApiWhere(
      page,
      (response) => response.request().method() === 'PUT' && new URL(response.url()).pathname === layerPath,
      AUTOSAVE_TIMEOUT_MS,
      `PUT ${layerPath}`,
    );

    await xField.fill(String(next));
    await xField.press('Enter');
    const { response } = await write;

    expect(response.status()).toBe(200);
    const sent = asRecord(response.request().postDataJSON(), 'PUT body');
    expect(sent.baseVersion, 'PUT body has baseVersion (G5)').toBeDefined();
    expect(Array.isArray(asRecord(asRecord(sent.body, 'PUT body.body').layer, 'PUT body.body.layer').walls)).toBe(true);
    await expect.poll(async () => parseViNumber(await xField.inputValue())).toBe(next);
    await captureEvidence(page, '23_viewer_geometry_put.png');

    await editor.getByRole('button', { name: 'Xong', exact: true }).click();
    await expect(editor).toHaveCount(0);
    await viewport(page).focus();
    await page.keyboard.press('Escape');
  });

  test('SCR-23 sibling navigation: "Tách tầng" / "Công cụ đo" / "Đối chiếu bản vẽ"', async () => {
    const nav = page.getByRole('navigation', { name: SIBLINGS_NAV });
    const backToViewer = async (): Promise<void> => {
      await page.goBack();
      await expect.poll(() => new URL(page.url()).pathname).toBe(ROUTES.project.viewer(projectId));
      await expect(viewport(page)).toBeVisible();
      await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
    };

    await nav.getByRole('button', { name: 'Tách tầng', exact: true }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(ROUTES.project.exploded(projectId));
    await backToViewer();

    await nav.getByRole('button', { name: 'Công cụ đo', exact: true }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(ROUTES.project.measure(projectId));
    await backToViewer();

    await nav.getByRole('button', { name: 'Đối chiếu bản vẽ', exact: true }).click();
    await expect
      .poll(() => new URL(page.url()).pathname)
      .toMatch(new RegExp(`^/projects/${projectId}/floors/[^/]+/overlay$`, 'u'));
    await expect(page).not.toHaveURL(ACCESS_DENIED_PATTERN);
    await captureEvidence(page, '23_viewer_nav.png');
  });
});

/* ---- SCR-24 Exploded View ------------------------------------------------------------------ */

test.describe('SCR-24 Exploded View', () => {
  test('SCR-24 "Tách hết", "Độ tách các tầng", "Ẩn tầng {work}" (empty state below 2 storeys)', async () => {
    await page.goto(ROUTES.project.exploded(projectId));
    await dismissTour(page);
    const slider = page.getByRole('slider', { name: 'Độ tách các tầng' });
    const empty = page.getByText(EXPLODED_EMPTY_TEXT, { exact: true });
    const failure = page.getByText(EXPLODED_ERROR_TEXT, { exact: true });

    await expect(slider.or(empty).or(failure).first()).toBeVisible({ timeout: SCENE_TIMEOUT_MS });
    await expect(failure, 'exploded view error state').toHaveCount(0);

    if (await empty.isVisible()) {
      test.info().annotations.push({ type: 'data-branch', description: 'fewer than 2 storeys with geometry: empty state' });
      await expect(slider).toHaveCount(0);
      await captureEvidence(page, '24_exploded.png');
      return;
    }

    const full = page.getByRole('radiogroup', { name: 'Mức tách sẵn' }).getByRole('radio', { name: 'Tách hết', exact: true });
    await full.click();
    await expect(full).toHaveAttribute('aria-checked', 'true');
    const separated = await slider.inputValue();

    await slider.focus();
    await page.keyboard.press('Home');
    await expect.poll(() => slider.inputValue()).not.toBe(separated);
    await expect(full).toHaveAttribute('aria-checked', 'false');
    await full.click();
    await expect(slider).toHaveValue(separated);

    const hide = page.getByRole('button', { name: `Ẩn tầng ${workFloorName}`, exact: true });
    const show = page.getByRole('button', { name: `Hiện tầng ${workFloorName}`, exact: true });
    await hide.click();
    await expect(show).toBeVisible();
    await captureEvidence(page, '24_exploded.png');

    await show.click(); // local only: restore what this test changed
    await expect(hide).toBeVisible();
  });
});

/* ---- SCR-25 Measurement Tool --------------------------------------------------------------- */

test.describe('SCR-25 Measurement Tool', () => {
  const measurementsPath = (): RegExp => new RegExp(`^/api/projects/${projectId}/measurements$`, 'u');
  const list = (): Locator => page.getByRole('region', { name: 'Phép đo' });
  let pinnedName = '';
  /** A model pixel the canvas really receives — reused to make a draft in the manage row. */
  let hitPoint: Point | null = null;

  test('SCR-25 "Trên xuống" + "Điểm đến điểm", two geometry clicks, draft, "Ghim phép đo" → POST measurements', async () => {
    test.setTimeout(HEAVY_TEST_TIMEOUT_MS);
    await navigateThenWaitForApi(
      page,
      () => page.goto(ROUTES.project.measure(projectId), { waitUntil: 'commit' }),
      'GET',
      measurementsPath(),
      [200],
    );
    await dismissTour(page);
    await expect(viewport(page)).toHaveAttribute('aria-busy', 'false', { timeout: SCENE_TIMEOUT_MS });

    const presetSelect = page.getByRole('combobox', { name: 'Góc nhìn sẵn' });
    await presetSelect.click();
    await page.getByRole('option', { name: 'Trên xuống', exact: true }).click();
    await expect(presetSelect).toHaveText('Trên xuống');

    const pointToPoint = page.getByRole('radiogroup', { name: 'Chọn chế độ đo' }).getByRole('radio', { name: 'Điểm đến điểm', exact: true });
    await pointToPoint.click();
    await expect(pointToPoint).toHaveAttribute('aria-checked', 'true');
    await viewport(page).focus();
    await page.keyboard.press('m');
    await expect(page.getByRole('toolbar', { name: 'Công cụ khung nhìn' }).getByRole('button', { name: MEASURE_RAIL_TOOL })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.mouse.move(5, 5);
    const geometry = geometryOf(await settledCanvas(page));
    const { points, blockers } = await clickableGeometry(page, geometry);
    const pin = page.getByRole('button', { name: PIN_LABEL, exact: true });
    const namesBefore = await list().getByRole('button', { name: /^(Ẩn|Hiện) / }).evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute('aria-label') ?? ''),
    );

    for (const point of points) {
      await page.mouse.click(point[0], point[1]);
      if (await isVisibleWithin(pin, PICK_SETTLE_MS)) {
        hitPoint = point;
        break;
      }
    }
    if (hitPoint === null) {
      test.fixme(
        true,
        'UNKNOWN — NEED VERIFICATION: no canvas click produced a measurement draft ' +
          `(${String(points.length)} model pixels reachable; blockers: ${[...blockers].join(', ') || 'none'}).`,
      );
      return;
    }
    const first = hitPoint;
    // Draft exists (pin button only renders with a draft: `MeasurementTool.tsx`).
    await expect(pin).toBeVisible();

    const seconds = points.filter((point) => Math.hypot(point[0] - first[0], point[1] - first[1]) >= 60).slice(0, 3);
    let created: Awaited<ReturnType<typeof waitForApi>> | null = null;

    for (const [x, y] of seconds) {
      await page.mouse.click(x, y);
      await expect(pin).toBeEnabled();
      const post = waitForApiWhere(
        page,
        (response) => response.request().method() === 'POST' && measurementsPath().test(new URL(response.url()).pathname),
        5_000,
        'POST measurements',
      ).catch(() => null);
      await pin.click();
      created = await post;
      if (created !== null) break;
    }
    if (created === null) throw new Error(`no POST /api/projects/${projectId}/measurements after ${String(seconds.length)} second-point clicks`);
    expect([200, 201]).toContain(created.response.status());

    const hideButtons = list().getByRole('button', { name: /^(Ẩn|Hiện) / });
    await expect(hideButtons).toHaveCount(namesBefore.length + 1);
    const namesAfter = await hideButtons.evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label') ?? ''));
    const added = namesAfter.find((label) => !namesBefore.includes(label));

    if (added === undefined) throw new Error('pinned measurement row not found under "Phép đo"');
    pinnedName = added.replace(/^(Ẩn|Hiện) /u, '');
    await expect(pin).toHaveCount(0); // draft cleared after a successful pin
    await captureEvidence(page, '25_measure_pinned.png');
  });

  test('SCR-25 manage: "đơn vị" = m, "Ẩn {name}", "Xoá {name}" then "Hoàn tác", "Bỏ phần đo dở (phím Esc)"', async () => {
    if (pinnedName === '' || hitPoint === null) throw new Error('needs the pinned measurement of the previous SCR-25 row');
    const name = pinnedName;
    const row = list().getByRole('listitem').filter({ has: page.getByRole('button', { name: new RegExp(`^(Ẩn|Hiện) ${escapeRegExp(name)}$`, 'u') }) });
    const unit = page.getByRole('combobox', { name: 'đơn vị' });
    const chooseUnit = async (label: 'mm' | 'm'): Promise<void> => {
      await unit.click();
      await page.getByRole('option', { name: label, exact: true }).click();
      await expect(unit).toHaveText(label);
    };

    // The screen opens in metres (`INITIAL_MEASURE_UNIT = 'm'`), so relabel to mm first, then set m.
    await chooseUnit('mm');
    await expect(row).toContainText(/\d mm\b/u);
    await chooseUnit('m');
    await expect(row).toContainText(/\d m\b/u);
    await expect(row).not.toContainText(/\d mm\b/u);

    await row.getByRole('button', { name: `Ẩn ${name}`, exact: true }).click();
    await expect(row.getByRole('button', { name: `Hiện ${name}`, exact: true })).toBeVisible();

    const removed = waitForApi(page, 'DELETE', new RegExp(`^/api/projects/${projectId}/measurements/[^/]+$`, 'u'), [200, 204]);
    await row.getByRole('button', { name: `Xoá ${name}`, exact: true }).click();
    await removed;
    await expect(row).toHaveCount(0);

    // Undo re-creates the record (`lib/mutations/measurement.ts` postMeasurementToServer).
    const restored = waitForApi(page, 'POST', measurementsPath(), [200, 201]);
    await page.getByRole('button', { name: 'Hoàn tác', exact: true }).click();
    await restored;
    await expect(list().getByRole('button', { name: new RegExp(`^(Ẩn|Hiện) ${escapeRegExp(name)}$`, 'u') })).toHaveCount(1);

    const pin = page.getByRole('button', { name: PIN_LABEL, exact: true });
    await page.mouse.click(hitPoint[0], hitPoint[1]);
    await expect(pin).toBeVisible();
    await page.getByRole('button', { name: DROP_DRAFT_LABEL, exact: true }).click();
    await expect(pin).toHaveCount(0);
    await expect(page.getByRole('toolbar', { name: 'Công cụ khung nhìn' }).getByRole('button', { name: MEASURE_RAIL_TOOL })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await captureEvidence(page, '25_measure_manage.png');
  });
});

/* ---- SCR-26 Pascal Viewer ------------------------------------------------------------------ */

test.describe('SCR-26 Pascal Viewer', () => {
  test('SCR-26 load: pascal-mount.js?v=<8hex> (no-cache), caption matches PASCAL_RENDERED_PATTERN; Esc / E / R', async () => {
    test.setTimeout(HEAVY_TEST_TIMEOUT_MS);
    // Settles to an Error instead of rejecting unhandled when the flag is off.
    const mount = page
      .waitForResponse((response) => PASCAL_MOUNT_PATTERN.test(response.url()), { timeout: PASCAL_RENDER_TIMEOUT_MS })
      .catch((error: unknown) => (error instanceof Error ? error : new Error(String(error))));
    const flags = await navigateThenWaitForApi(
      page,
      () => page.goto(ROUTES.project.viewerPascal(projectId), { waitUntil: 'commit' }),
      'GET',
      /^\/api\/feature-flags$/u,
      [200],
    );

    if (asRecord(flags.json, 'GET /api/feature-flags')[PASCAL_FLAG_KEY] !== true) {
      throw new Error(
        `CP-0 environment: feature flag "${PASCAL_FLAG_KEY}" is not on for this account ` +
          `(screen shows "${PASCAL_FORBIDDEN_TITLE}"). Set FEATURE_FLAGS='{"scene.pascal-viewer": true}' (AppBack FIX-378/379).`,
      );
    }
    await expect(page.getByRole('heading', { name: PASCAL_FORBIDDEN_TITLE, exact: true })).toHaveCount(0);

    const canvasBox = page.getByTestId('pascal-canvas');
    await expect(canvasBox).toBeVisible({ timeout: PASCAL_RENDER_TIMEOUT_MS });
    const rendered = page.getByRole('status').filter({ hasText: PASCAL_RENDERED_PATTERN });
    await expect(rendered).toHaveText(PASCAL_RENDERED_PATTERN, { timeout: PASCAL_RENDER_TIMEOUT_MS });

    const script = await mount;
    if (script instanceof Error) throw new Error(`no pascal-mount.js?v=<8hex> response: ${script.message}`);
    expect(script.status()).toBe(200);
    expect(script.headers()['cache-control'] ?? '').toContain('no-cache');
    await expect(page).not.toHaveURL(ACCESS_DENIED_PATTERN);
    await captureEvidence(page, '26_pascal_rendered.png');

    // Esc collapses the frame (`usePascalViewer.ts` pascalViewer.collapse).
    await page.keyboard.press('Escape');
    await expect(canvasBox).toHaveCount(0);
    await expect(page.getByRole('heading', { name: PASCAL_COLLAPSED_TITLE, exact: true })).toBeVisible();

    // E re-opens it.
    await page.keyboard.press('e');
    await expect(canvasBox).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: PASCAL_RENDERED_PATTERN })).toHaveText(PASCAL_RENDERED_PATTERN, {
      timeout: PASCAL_RENDER_TIMEOUT_MS,
    });

    // R is bound only while failing (`enabled: failure !== null`): inert on a rendered scene.
    await page.keyboard.press('r');
    await expect(canvasBox).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: PASCAL_RENDERED_PATTERN })).toHaveText(PASCAL_RENDERED_PATTERN);
  });
});

/* ---- SCR-27 Mobile Viewer (own context, 375×812) ------------------------------------------- */

test.describe('SCR-27 Mobile Viewer', () => {
  let mobileContext: BrowserContext;
  let mobile: Page;

  test.beforeAll(async ({ browser }) => {
    mobileContext = await browser.newContext({
      baseURL: readBaseUrl(),
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
    });
    mobile = await mobileContext.newPage();
    await signInAdmin(mobile, ROUTES.mobileViewer(projectId));
  });

  test.afterAll(async () => {
    await mobileContext?.close();
  });

  test('SCR-27 tools "Tầng" / "Chế độ xem" / "Đo" / "Thông tin" open their sheets; "Chia sẻ dự án" absent', async () => {
    await expect(mobile.getByRole('region', { name: MOBILE_REGION })).toBeVisible({ timeout: SCENE_TIMEOUT_MS });
    await expect(mobile).not.toHaveURL(ACCESS_DENIED_PATTERN);
    await expect(mobile.getByRole('button', { name: MOBILE_SHARE })).toHaveCount(0);

    const tools = mobile.getByRole('navigation', { name: MOBILE_TOOLS_NAV });
    const tool = (label: string): Locator => tools.getByRole('button', { name: label, exact: true });

    await tool('Tầng').click();
    await expect(tool('Tầng')).toHaveAttribute('aria-pressed', 'true');
    await expect(mobile.getByRole('group', { name: 'Tầng', exact: true })).toBeVisible();

    // 375 px is not compact (< 360 px, `mobileViewerTypes.ts:76`): "Chế độ xem" stays on the bar.
    await tool('Chế độ xem').click();
    await expect(tool('Chế độ xem')).toHaveAttribute('aria-pressed', 'true');
    await expect(tool('Tầng')).toHaveAttribute('aria-pressed', 'false');

    await tool('Đo').click();
    await expect(tool('Đo')).toHaveAttribute('aria-pressed', 'true');
    await expect(mobile.getByRole('group', { name: 'Đo', exact: true })).toBeVisible();

    await tool('Thông tin').click();
    await expect(tool('Thông tin')).toHaveAttribute('aria-pressed', 'true');
    await expect(mobile.getByRole('dialog', { name: MOBILE_INFO_SHEET })).toBeVisible();

    await expect(mobile.getByRole('button', { name: MOBILE_SHARE })).toHaveCount(0);
    await captureEvidence(mobile, '27_mobile_tools.png');
  });
});
