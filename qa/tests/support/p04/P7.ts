/**
 * QA-04c P7 helpers (SCR-22 overlay flows: `phase04_overlay_edge`, `_mocked_edge`, `_ui`). The roles flows
 * (`phase04_roles_edge`) keep their own helper `P7.roles.ts`. Nothing here edits a shared support file.
 *
 * - {@link ownerApi}: the pool admin of slot `p04-overlay` (own `drawings_init` bucket: the main admin already spends ~57
 *   of 60 upload inits in phase 03 main). Owns every overlay project that holds a drawing.
 * - Seeds: {@link seedD1} (env drawing, run finished: real default = frame missing), {@link seedDF} (framed drawing:
 *   `frame.isFound`, state partial / collapsed), {@link seedDM} (2 floors, 65-char names, one drawn),
 *   {@link seedOverlayScales} (QX:overlay-scales), {@link seedNoDrawing} (Q2).
 * - {@link OV}: the SCR-22 copy, each string cited to the FE source (OC OverlayComparison.tsx, OCT …Toolbar.tsx,
 *   OCP …Panel.tsx, OCV …Canvas.tsx, OCD …CanvasDivider.tsx, OCL …CanvasLayers.tsx, UOC useOverlayComparison.ts).
 * - Page helpers: {@link openOverlay}, {@link overlayLayers}, {@link quiet} (the only fixed wait, for "nothing was sent").
 */
import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../../../e2e/fixtures/routes';
import { TOUR_APPEAR_TIMEOUT_MS, dismissTour } from '../../../../e2e/fixtures/tour';
import { signedInApi } from '../api';
import { TEST_DATA_PREFIX } from '../evidence';
import { poolUser, createProject, createPipelineDrawingProject, envDrawingPng, type PoolUser, type SeededProject } from '../phase03Seed';
import { writeLayer, qcLayer, type LayerApi } from '../layerSeed';
import { mainAdminApi, seedQualityProject, type QualityProject } from '../p03/P7';
import { craftPng, framedPng } from '../p03/P12';

export const OVERLAY_SLOT = 'p04-overlay';

/** Pool admin of {@link OVERLAY_SLOT}: API client (1 login) + the user for browser sign-ins; `dispose` closes both clients. */
export interface Owner {
  readonly api: APIRequestContext;
  readonly user: PoolUser;
  readonly main: APIRequestContext;
  dispose: () => Promise<void>;
}

export async function ownerApi(): Promise<Owner> {
  const main = await mainAdminApi();
  try {
    const user = await poolUser(main, 'admin', OVERLAY_SLOT);
    const api = await signedInApi(user.email, user.password);
    return {
      api,
      user,
      main,
      dispose: async () => {
        await api.dispose();
        await main.dispose();
      },
    };
  } catch (error) {
    await main.dispose();
    throw error;
  }
}

export const layerApi = (api: APIRequestContext): LayerApi => ({ request: api, headers: {} });

/* ---- copy ------------------------------------------------------------------------------------- */

export const OV = {
  screen: 'So với bản vẽ', // OC:74
  canvasSection: 'Khung đối chiếu bản vẽ gốc và mô hình', // OC:75
  canvasGroup: 'Khung đối chiếu bản vẽ và mô hình', // OCV:83
  sourceFrame: 'Khung bản vẽ nguồn', // OCV:84
  resultFrame: 'Khung mô hình sinh ra', // OCV:85
  notice: 'Trạng thái của màn đối chiếu bản vẽ', // OC:76
  toolbar: 'Thanh công cụ đối chiếu bản vẽ', // OCT:56
  panel: 'Kết quả đối chiếu bản vẽ và mô hình', // OCP:49
  floorSelect: 'Chọn tầng', // OCT:57
  noScanSuffix: 'Không có ảnh bản vẽ gốc', // OCT:58
  modes: 'Kiểu đối chiếu', // OCT:59
  overlay: 'So với bản vẽ', // types.ts COMPARE_MODE_LABELS
  swipe: 'Trượt',
  sideBySide: 'Cạnh nhau',
  sideBySideDisabled: 'Khung quá hẹp để đặt hai khung nhìn cạnh nhau; hãy dùng trượt.', // UOC:122
  opacity: 'Độ đậm lớp mô hình', // OCT:60
  lock: 'Khoá căn', // OCT:61
  readOnly: 'Bạn không có quyền sửa, các điều khiển đang tắt.', // OCT:62
  divider: 'Đường chia đôi, dùng phím mũi tên trái và phải để dịch', // OCD:25
  tolerance: 'Dung sai', // UOC:122
  deviationList: 'Danh sách vùng lệch', // OCP:51
  confirm: 'Khớp rồi, xác nhận', // UX-R2 K19: removed from the screen; specs assert it is absent
  toScale: 'Sang màn hiệu chỉnh tỷ lệ', // OC:78
  toUpload: 'Tải bản vẽ lên', // OC:80
  layerScan: 'Ảnh quét gốc', // UOC:115
  layerGeometry: 'Hình học sinh ra',
  layerDeviation: 'vùng lệch',
  loading: 'Đang tải ảnh bản vẽ gốc.', // UOC:118
  frameMissing: 'Không tìm được khung bản vẽ nên chưa căn được ảnh quét vào mô hình.', // UOC:111
  readFailed: 'Không đọc được ảnh bản vẽ gốc của tầng này.', // UOC:112
  /** Removed in UX-R1 K11 (another floor's scale no longer blocks this screen): specs expect count 0. */
  scaleConflict: 'Không căn được vì hai tầng đang dùng tỷ lệ khác nhau.',
  forbidden: 'Bạn chỉ được xem; việc đổi căn chỉnh dành cho người có quyền sửa.', // UOC:114
  noDrawing: 'Tầng này chưa có bản vẽ nào nên chưa có gì để đối chiếu. Tải bản vẽ lên rồi quay lại đây.', // UOC:119
  cadOnly: 'Tầng này nhập từ CAD nên không có ảnh bản vẽ gốc để đối chiếu.', // UOC:110
  noFloor: 'Dự án này chưa có tầng nào để đối chiếu.', // UOC:123
  measuring: 'Chưa đo được vùng lệch nào.', // OCP:54
  overToleranceLabel: 'số vùng vượt ngưỡng', // UOC:116
} as const;

/* ---- page helpers ----------------------------------------------------------------------------- */

export const screenRegion = (page: Page): Locator => page.getByRole('region', { name: OV.screen, exact: true });
export const toolbar = (page: Page): Locator => page.getByRole('toolbar', { name: OV.toolbar, exact: true });
export const panel = (page: Page): Locator => page.getByRole('region', { name: OV.panel, exact: true });
export const modeGroup = (page: Page): Locator => page.getByRole('radiogroup', { name: OV.modes, exact: true });
export const modeRadio = (page: Page, label: string): Locator => modeGroup(page).getByRole('radio', { name: label, exact: true });
export const divider = (page: Page): Locator => page.getByRole('slider', { name: OV.divider, exact: true });
export const opacitySlider = (page: Page): Locator => page.getByRole('slider', { name: OV.opacity, exact: true });
export const lockSwitch = (page: Page): Locator => page.getByRole('switch', { name: OV.lock, exact: true });
export const toleranceField = (page: Page): Locator => page.getByRole('textbox', { name: OV.tolerance, exact: true });
export const floorSelect = (page: Page): Locator => page.getByRole('combobox', { name: OV.floorSelect });
/** Every `[data-overlay-layer]` on the canvas (scan, geometry, deviation). */
export const overlayLayers = (page: Page): Locator => page.locator('[data-overlay-layer]');
export const geometryPaths = (page: Page): Locator => page.locator('[data-geometry-polyline]');
export const noticeRegion = (page: Page): Locator => page.locator(`[aria-label="${OV.notice}"]`);
/** The two read-only / state alerts the screen prints (role alert). */
export const alertWith = (page: Page, text: string): Locator => page.getByRole('alert').filter({ hasText: text });

/** Opens the overlay of a floor by URL and waits until the screen and its toolbar are painted. */
export async function openOverlay(page: Page, projectId: string, floorId: string): Promise<void> {
  await page.goto(ROUTES.project.overlay(projectId, floorId));
  await expect(screenRegion(page)).toBeVisible();
  await expect(toolbar(page)).toBeVisible();
}

/** The shown notice text (alert or the plain loading paragraph) once the screen has left loading, or `null` when none. */
export async function noticeText(page: Page): Promise<string | null> {
  const region = noticeRegion(page);
  return (await region.count()) === 0 ? null : ((await region.innerText()).replace(/\s+/gu, ' ').trim());
}

/**
 * `// fixed-wait-ok: "nothing was sent" is a claim about the absence of a request; autosave would fire 800 ms after the last
 * change (A7), so the page is given 1.5 s plus a round trip to prove it stayed quiet.
 */
export async function quiet(page: Page): Promise<void> {
  await page.waitForTimeout(1_500); // fixed-wait-ok: absence of a write, see the comment above
}

/* ---- seeds ------------------------------------------------------------------------------------ */

/** D1: env drawing, finished run. #30 lists FRAME_NOT_FOUND, so the real default is the frame-missing error. */
export const seedD1 = (api: APIRequestContext, slug = '22-d1'): Promise<{ projectId: string; floorId: string; floorName: string }> =>
  createPipelineDrawingProject(api, slug, envDrawingPng());

/** DF: a framed drawing (closed rectangular border), finished run + the QC layer (geometry): `frame.isFound`, so partial (≥ 1280) or collapsed (< 1280). */
export async function seedDF(api: APIRequestContext, slug = '22-df'): Promise<{ projectId: string; floorId: string; floorName: string }> {
  const floor = await createPipelineDrawingProject(api, slug, framedPng());
  try {
    // The fake ML finds no walls in the crafted page, so the AI layer is empty ("Còn 1 tầng chưa dựng hình học"): give the floor geometry.
    await writeLayer(layerApi(api), floor.projectId, floor.floorId, qcLayer);
    return floor;
  } catch (error) {
    await api.delete(`/api/projects/${floor.projectId}`).catch(() => undefined);
    throw error;
  }
}

/** DM: two floors with 65-char names (FL-22-U2): the first holds a framed drawing, the second none (so its option reads "— Không có ảnh bản vẽ gốc"). */
export const LONG_FLOOR_A = `Tầng một ${'A'.repeat(56)}`; // 65 chars
export const LONG_FLOOR_B = `Tầng hai ${'B'.repeat(56)}`; // 65 chars
export function seedDM(api: APIRequestContext, slug = '22-dm'): Promise<QualityProject> {
  return seedQualityProject(api, slug, [
    { name: LONG_FLOOR_A, png: framedPng() },
    { name: LONG_FLOOR_B, png: null },
  ]);
}

/** Q2: own project with two empty floors, no drawing. */
export const seedNoDrawing = (api: APIRequestContext, slug = '22-q2', floors = 2): Promise<SeededProject> => createProject(api, slug, floors);

/* W4 ids and a one-wall layer (same shapes as `layerSeed.qcLayer`, which keeps its builders private). */
const sid = (letter: 'W' | 'D' | 'R' | 'F'): string => `${letter}-${Array.from({ length: 20 }, () => Math.floor(Math.random() * 36).toString(36)).join('').toUpperCase()}`;

/** `objects1Wall`-style layer: exactly one wall, so the model frame is degenerate (every point collinear). */
export function oneWallLayer(levelId: string): Record<string, unknown> {
  return {
    walls: [
      {
        centreline: { start: { x: 0, y: 0 }, end: { x: 4000, y: 0 } },
        confidence: 0.9,
        heightMm: 3000,
        id: sid('W'),
        kind: 'loadBearing',
        levelId,
        openingIds: [],
        reviewed: false,
        source: 'ai',
        thicknessMm: 220,
      },
    ],
    openings: [],
    rooms: [],
    furniture: [],
  };
}

/** #35 scale-only write (`{ baseVersion, body: { scaleMillimetresPerPixel } }`) at the floor's current revision. */
export async function putScale(api: APIRequestContext, projectId: string, floorId: string, mmPerPx: number): Promise<void> {
  const path = `/api/projects/${projectId}/floors/${floorId}/spatial/layer`;
  const read = await api.get(path);
  expect(read.status(), `setup: GET ${path}`).toBe(200);
  const revision = ((await read.json()) as { revision: number }).revision;
  const put = await api.put(path, { data: { baseVersion: revision, body: { scaleMillimetresPerPixel: mmPerPx } } });
  expect(put.status(), `setup: PUT ${path} scale ${String(mmPerPx)}: ${(await put.text()).slice(0, 300)}`).toBe(200);
}

export interface OverlayScales {
  readonly projectId: string;
  readonly name: string;
  /** Floor with the `qcLayer` (12 geometry entities) and 5 mm/px. */
  readonly layered: { readonly id: string; readonly name: string };
  /** Floor with exactly one wall and 8 mm/px. */
  readonly oneWall: { readonly id: string; readonly name: string };
}

/**
 * QX:overlay-scales — project with two floors, no drawing: "Tầng 1" holds the QC layer (10 walls + 2 rooms) at 5 mm/px,
 * "Tầng 2" holds one wall at 8 mm/px. Two different ratios in one project = the scale conflict (UOC:556-566).
 */
export async function seedOverlayScales(api: APIRequestContext, slug = '22-scales'): Promise<OverlayScales> {
  const project = await createProject(api, slug, 2);
  try {
    const [a, b] = project.floors;
    if (a === undefined || b === undefined) throw new Error('setup: fewer than 2 floors');
    await writeLayer(layerApi(api), project.projectId, a.id, qcLayer);
    await writeLayer(layerApi(api), project.projectId, b.id, oneWallLayer);
    await putScale(api, project.projectId, a.id, 5);
    await putScale(api, project.projectId, b.id, 8);
    return { projectId: project.projectId, name: project.name, layered: { id: a.id, name: a.name }, oneWall: { id: b.id, name: b.name } };
  } catch (error) {
    await api.delete(`/api/projects/${project.projectId}`).catch(() => undefined);
    throw error;
  }
}

/**
 * Scale conflict that survives R27 (useOverlayComparison.ts:621-631: only floors WITH a scan count): two floors, each with a
 * framed drawing, one at 5 and one at 8 mm/px. `seedOverlayScales` has no drawings, so it no longer conflicts (edge 22-B-006).
 */
export async function seedScaleConflict(api: APIRequestContext, slug = '22-conflict'): Promise<QualityProject> {
  const project = await seedQualityProject(api, slug, [
    { name: 'Tầng 1', png: framedPng() },
    { name: 'Tầng 2', png: framedPng() },
  ]);
  try {
    const [a, b] = project.floors;
    if (a === undefined || b === undefined) throw new Error('setup: fewer than 2 floors');
    await putScale(api, project.projectId, a.id, 5);
    await putScale(api, project.projectId, b.id, 8);
    return project;
  } catch (error) {
    await api.delete(`/api/projects/${project.projectId}`).catch(() => undefined);
    throw error;
  }
}

export { TEST_DATA_PREFIX };

/** 6000 × 4500 white gray PNG (27 MP < the 40 MP pipeline cap, a few dozen KB): a run that stays busy for seconds (22-B-008). */
export const bigWhitePng = (): Buffer => craftPng(6_000, 4_500, 0, () => Buffer.alloc(6_000, 255));

/**
 * Holds EVERY request whose path matches `re` (GET only) until `release()`, then continues it unchanged. `verifyUi` re-opens
 * a state once per width, so a one-shot hold would only cover the first.
 */
export async function holdAll(page: Page, re: RegExp): Promise<{ readonly release: () => Promise<void> }> {
  let open: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => (open = resolve));
  const matcher = (url: URL): boolean => re.test(url.pathname);
  const handler = async (route: import('@playwright/test').Route): Promise<void> => {
    if (route.request().method() !== 'GET') return route.fallback();
    await gate;
    await route.continue().catch(() => undefined);
  };
  await page.route(matcher, handler);
  return {
    release: async () => {
      open();
      await page.unroute(matcher, handler).catch(() => undefined);
    },
  };
}
