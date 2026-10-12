/**
 * Phase 5 — dedicated UI-verification cases (skill `qa-verify-ui`): one test per visible state of SCR-23 (viewer 3D),
 * SCR-24 (exploded view), SCR-25 (measurement tool), SCR-26 (Pascal viewer) and SCR-27 (mobile viewer), each at
 * 1440 / 1024 / 768 / 375 (`support/ui-verify.ts`), evidence `U05_<state>_<width>.png` + `U05_<state>.json`. Reviewed by
 * the "verify ui" step with the qa-review-ui checklist. Models: `phase01_auth_ui.spec.ts`, `phase04_qc_layers_ui.spec.ts`
 * (helpers `inAdminContext` / `verifyIn` / `verifySeeded` copied from there).
 *
 * Data:
 *   - BUG-346 / BUG-392: every data state runs on the test's OWN project (`qa-<runId>-u05-…`, two floors), created through
 *     the API with both layers written through #35 (`support/layerSeed.ts` qcLayer: walls, a door and a window, rooms
 *     "Bếp" / "PHONG NGU 2", a table) before the page opens and deleted in `finally` (`verifySeeded`). It never reads
 *     Phase 2/3 (CP-2…CP-5), so the model, the room search, the two-storey exploded view, the Pascal graph and the mobile
 *     model are always there: no `data:` skip is left. No state here needs the pipeline output itself (drawing, OCR,
 *     scale), so none reads CP-5. The only skip is `Environment:` — feature flag "scene.pascal-viewer" off (CP-0).
 *   - One run-unique project with an 80-character name and ONE floor with a 65-character name (`qa-<runId>-u05-…`),
 *     created through the API before its group and deleted after it. Its floor has no layer, so every screen shows its
 *     empty state there (Viewer3D `useViewer3D.ts:682` no buildable part, ExplodedView `useExplodedView.ts:846` < 2
 *     storeys, MeasurementTool `useMeasurementTool.ts:950` no row, PascalViewer `usePascalViewer.ts:245` empty graph,
 *     MobileViewer `useMobileViewer.ts:698` no geometry) — with the long project name in the mobile header.
 *   - Not covered here (need a canvas pick that only the pixel scan of `phase05_3d_viewer.spec.ts` gives): wall selected
 *     + "Sửa hình học tường" editor, measurement draft / "Ghim phép đo". Their screens are `23_viewer_geometry_put.png`,
 *     `25_measure_pinned.png` from the main layer.
 *
 * Budget — logins: 1 real admin API login (`signedInApi`, empty-project group); a browser login only to replace a dead
 * stored session (`ensureAdminSession`); the seeded states take their fixture token from their own context (`layerApiOf`,
 * 1 refresh, no login). Writes through the API only: the empty project (1 `POST /api/projects` with 1 floor, BE #25
 * `floors`, + 1 DELETE) and 17 seeded projects (each 1 POST + 2 #35 PUT + 1 DELETE, no rate limit) — every test also
 * asserts that the browser sent NO non-GET request under `/api/projects/` (`verifyIn` guard): panels, room search,
 * preset / unit menus, "Tách vừa" / "Tách hết" + "Ẩn tầng …" (exploded, local only), Pascal Esc (collapse) and the mobile
 * tool sheets are view state.
 * Sessions: every test opens its OWN context from Phase 1's admin storage state and writes the rotated refresh cookie back
 * in `finally`: 22 tests × (4 loads + 1 session check) + 17 fixture tokens = 127 `POST /api/auth/refresh`
 * (`auth_refresh_total` 300 / 60 s per sid).
 * No faked response: every state is the real stack. Non-serial: each test uses its own context and page.
 * G6: the editor tour mounts on `/3d` only (`ViewerShell.container.tsx` `hostId="viewer-shell"`), lazily; it is dismissed
 * with the product's own "Bỏ qua hướng dẫn" (`e2e/fixtures/tour.ts`).
 */
import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { TOUR_APPEAR_TIMEOUT_MS, dismissTour } from '../../e2e/fixtures/tour';
import { PASCAL_RENDER_TIMEOUT_MS, readBaseUrl } from '../../e2e/fullstack/env';
import { signedInApi } from './support/api';
import { ensureAdminSession, readAdminCredentials } from './support/auth';
import { TEST_DATA_PREFIX } from './support/evidence';
import { createQcProject, deleteProject, layerApiOf } from './support/layerSeed';
import { ADMIN_STORAGE_STATE_FILE } from './support/state';
import { UI_VIEWPORTS, verifyUi } from './support/ui-verify';

/* Copy — every string checked in src/ (file noted). */
/* SCR-23: ViewerViewport.tsx:91, Viewer3D.tsx, Viewer3DPanels.tsx, ObjectSearch.tsx:58-64, ViewerTopBar.tsx:72. */
const VIEWPORT_NAME = 'Khung nhìn mô hình';
const BUILDING_TEXT = 'Đang dựng mô hình'; // Viewer3D.tsx LoadingContent
const VIEWER_EMPTY_TEXT = 'Mô hình 3D sẽ xuất hiện sau khi bạn duyệt lớp tường.'; // Viewer3D.tsx EmptyContent
const PANELS_NAV = 'Bảng phụ của khung nhìn 3D';
const PANEL_IDS = { 'Diện tích phòng': 'rooms', 'Thư viện đồ đạc': 'furniture', 'Lịch sử thao tác': 'history' } as const;
/** Viewer3DPanels.tsx:79-91,111-114 lazy-chunk fallback, `role="status"` (BUG-379): gone once the panel itself renders. */
const PANEL_LOADING = /^Đang tải (bảng diện tích phòng|thư viện đồ đạc|lịch sử thao tác)…$/u;
const SEARCH_TRIGGER = 'Tìm phòng';
const SEARCH_INPUT = 'Tìm phòng theo tên hoặc mã';
const SEARCH_LIST = 'Kết quả tìm phòng';
const PRESET_SELECT = 'Góc nhìn sẵn';
const PRESET_TOP = 'Trên xuống'; // phase05_3d_viewer.spec.ts presets case
/* SCR-24: ExplodedView.tsx, ExplodedViewRail.tsx, ExplodedViewFloorCards.tsx:173. The normal layout has no slider of its
   own (FIX-1724; the shell rail's "Độ tách" is there in every state), so the presets row is the screen's ready signal. */
const EXPLODED_LOADING_TEXT = 'Đang tách các tầng...'; // ExplodedView.tsx:54
const EXPLODED_EMPTY_TEXT = 'Tách tầng xuất hiện khi bản vẽ có từ hai tầng trở lên.'; // useExplodedView.ts:143
/** ≥ 2 storeys but no buildable part (useExplodedView.ts:146,859-860, BUG-382). */
const EXPLODED_NO_MODEL_TEXT = VIEWER_EMPTY_TEXT;
const EXPLODED_ERROR_TEXT = 'Không tách được các tầng lúc này. Vui lòng thử lại sau.';
const HIDE_FLOOR = /^Ẩn tầng /u; // ExplodedViewFloorCards.tsx:173 — the shell rail eye reads the same (FIX-1706): scope to EXPLODED_REGION
const EXPLODED_REGION = 'Nội dung tách tầng'; // ExplodedView.tsx:78
const EXPLODE_PRESETS = 'Mức tách sẵn'; // ExplodedViewRail.tsx:90
const EXPLODE_MEDIUM = 'Tách vừa'; // explodedViewTypes.ts:136, separation 0,5 > LABEL_REVEAL_SEPARATION 0,2
const EXPLODE_FULL = 'Tách hết';
/** Floor cards show only past LABEL_REVEAL_SEPARATION (useExplodedView.ts:399 areLabelsVisible); default "Gộp" hides them. */
const FLOOR_CARD = /^Chọn tầng .+, cao độ /u; // ExplodedViewFloorCards.tsx:132-135
/* SCR-25: MeasurementTool.tsx, MeasurementList.tsx:60-62. */
const MEASURE_OVERLAY = 'Lớp phủ công cụ đo';
const MEASURE_LIST = 'Phép đo';
const MEASURE_MODES = 'Chọn chế độ đo';
const MEASURE_EMPTY_TEXT = 'Chưa có phép đo nào. Nhấn M rồi chọn hai điểm trên mô hình.';
const UNIT_SELECT = 'Đơn vị';
/* SCR-26: PascalViewer.tsx, pascalViewerTypes.ts:90-101. */
const PASCAL_RENDERED_PATTERN =
  /^(Đã dựng xong toàn bộ bản vẽ\.|Đã dựng xong, nhưng một số đối tượng chưa chuyển sang được\.)$/u;
const PASCAL_FORBIDDEN_TITLE = 'Chưa bật cho tài khoản này';
const PASCAL_COLLAPSED_TITLE = 'Khung xem đang thu gọn';
const PASCAL_EXPAND = 'Mở khung xem';
const PASCAL_EMPTY_TITLE = 'Chưa có gì để dựng';
const PASCAL_CANVAS_TESTID = 'pascal-canvas';
/* SCR-27: MobileViewer.tsx, MobileViewerBottomBar.tsx:44-47,195, MobileViewerInfoSheet.tsx:202, useMobileViewer.ts:125-127. */
const MOBILE_REGION = 'Xem mô hình 3D trên điện thoại';
const MOBILE_TOOLS_NAV = 'Công cụ xem mô hình';
const MOBILE_INFO_SHEET = 'Thông tin đối tượng đang chọn';
const MOBILE_LOADING = /^Đang tải (mô hình|mức gọn|mức vừa)$/u;
const MOBILE_EMPTY_TITLE = 'Chưa có mô hình để xem';

const PROJECTS_PATH = '/api/projects';
/** Scene build under the real BE (phase05_3d_viewer.spec.ts SCENE_TIMEOUT_MS). */
const SCENE_TIMEOUT_MS = 60_000;
/** 4 widths × (load + 3D build up to 60 s). */
const TEST_TIMEOUT_MS = 360_000;
const NAME_MAX_LENGTH = 80;
/** Exactly 80 chars, run-unique: `qa-<runId>-u05-<base36 time> ` + Vietnamese filler, ending in a letter. */
const LONG_NAME = `${`${TEST_DATA_PREFIX}u05-${Date.now().toString(36)} ${'Khu phức hợp văn phòng Bình Minh '.repeat(4)}`.slice(0, NAME_MAX_LENGTH - 1)}A`;
if (LONG_NAME.length !== NAME_MAX_LENGTH) throw new Error(`LONG_NAME is ${LONG_NAME.length} chars`);
/** 65 chars; the FE sets no floor-name cap, the BE draft name only `min_length=1` (projects/schemas.py:54). */
const LONG_FLOOR_NAME = 'Tầng kỹ thuật mái và phòng máy bơm nước sinh hoạt khu B phía Đông';

/** Two storeys, both layered (`support/layerSeed.ts` qcLayer): the exploded view needs ≥ 2 storeys with geometry. */
const SEEDED_FLOORS = ['Tầng 1', 'Tầng 2'] as const;

/* ---- helpers ---- */

type Shot = { readonly fullPage?: boolean };

/** Own context from the admin storage state; the rotated refresh cookie goes back to the file (phase04 `inAdminContext`). */
async function inAdminContext(browser: Browser, body: (context: BrowserContext) => Promise<void>): Promise<void> {
  const context = await browser.newContext({ baseURL: readBaseUrl(), storageState: ADMIN_STORAGE_STATE_FILE });
  try {
    await ensureAdminSession(context, ADMIN_STORAGE_STATE_FILE);
    await body(context);
  } finally {
    await context.storageState({ path: ADMIN_STORAGE_STATE_FILE });
    await context.close();
  }
}

/** `verifyUi` on a new page of `context`, recording every non-GET request under `/api/projects/`: a UI case never writes. */
async function verifyIn(context: BrowserContext, name: string, open: (page: Page) => Promise<void>, shot: Shot): Promise<void> {
  const page = await context.newPage();
  const writes: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET' && path.startsWith(`${PROJECTS_PATH}/`)) writes.push(`${request.method()} ${path}`);
  });
  await verifyUi(page, name, open, UI_VIEWPORTS, shot);
  expect.soft(writes, 'a UI case sends no write under /api/projects/').toEqual([]);
}

async function verifyAsAdmin(browser: Browser, name: string, open: (page: Page) => Promise<void>, shot: Shot = {}): Promise<void> {
  await inAdminContext(browser, (context) => verifyIn(context, name, open, shot));
}

/** BUG-346 / BUG-392: a data state on this test's OWN seeded project (two layered floors), deleted in `finally`. */
async function verifySeeded(
  browser: Browser,
  name: string,
  open: (page: Page, projectId: string) => Promise<void>,
  shot: Shot = {},
): Promise<void> {
  await inAdminContext(browser, async (context) => {
    // Before the first page: the fixture token's refresh rotates the context's cookie (`layerApiOf`).
    const api = await layerApiOf(context);
    const [floor] = await createQcProject(api, name.toLowerCase().replace(/_/gu, '-'), SEEDED_FLOORS, SEEDED_FLOORS.length);
    if (floor === undefined) throw new Error('setup: the seeded project has no floor');
    try {
      await verifyIn(context, name, (page) => open(page, floor.projectId), shot);
    } finally {
      const failed = await deleteProject(api, floor.projectId);
      if (failed !== null) test.info().annotations.push({ type: 'cleanup', description: failed });
    }
  });
}

const viewport = (page: Page): Locator => page.getByRole('main', { name: VIEWPORT_NAME });

/**
 * `/3d` loaded and its scene built; the tour (G6) is dismissed. The first call of a test may wait for the lazy tour
 * (`TOUR_APPEAR_TIMEOUT_MS`); skipping it stores "seen" in the context, so the later widths only re-check.
 */
function viewerOpener(): (page: Page, projectId: string) => Promise<void> {
  let tourPending = true;
  return async (page, projectId) => {
    await page.goto(ROUTES.project.viewer(projectId));
    await expect(viewport(page)).toBeVisible({ timeout: 15_000 });
    await expect(viewport(page)).toHaveAttribute('aria-busy', 'false', { timeout: SCENE_TIMEOUT_MS });
    await expect(page.getByRole('status').filter({ hasText: BUILDING_TEXT })).toHaveCount(0, { timeout: SCENE_TIMEOUT_MS });
    await dismissTour(page, { waitMs: tourPending ? TOUR_APPEAR_TIMEOUT_MS : 0 });
    tourPending = false;
  };
}

/** `/3d` of the seeded project: a model, never the "no wall layer" empty state (that one is U05_viewer_empty). */
async function openViewerData(page: Page, openViewer: ReturnType<typeof viewerOpener>, projectId: string): Promise<void> {
  await openViewer(page, projectId);
  await expect(page.getByText(VIEWER_EMPTY_TEXT, { exact: true }), 'seeded layer: viewer empty state').toHaveCount(0);
}

/** Exploded view of `projectId`: waits for the presets, either empty copy or the error copy, then for the build to end. */
async function openExploded(page: Page, projectId: string): Promise<void> {
  await page.goto(ROUTES.project.exploded(projectId));
  await expect(viewport(page)).toBeVisible({ timeout: 15_000 });
  await dismissTour(page);
  await expect(
    page
      .getByRole('radiogroup', { name: EXPLODE_PRESETS })
      .or(page.getByText(EXPLODED_EMPTY_TEXT, { exact: true }))
      .or(page.getByText(EXPLODED_NO_MODEL_TEXT, { exact: true }))
      .or(page.getByText(EXPLODED_ERROR_TEXT, { exact: true }))
      .first(),
  ).toBeVisible({ timeout: SCENE_TIMEOUT_MS });
  // The presets also show while 'loading' (ExplodedView.tsx:75,86); the state settles once the loading copy is gone.
  await expect(page.getByText(EXPLODED_LOADING_TEXT, { exact: true })).toHaveCount(0, { timeout: SCENE_TIMEOUT_MS });
  await expect(page.getByText(EXPLODED_ERROR_TEXT, { exact: true }), 'exploded view error state').toHaveCount(0);
}

/** Exploded view of the seeded project: two storeys with geometry, never either empty state (U05_exploded_empty). */
async function openExplodedData(page: Page, projectId: string): Promise<void> {
  await openExploded(page, projectId);
  await expect(page.getByText(EXPLODED_EMPTY_TEXT, { exact: true }), 'two seeded storeys: exploded empty state').toHaveCount(0);
  await expect(page.getByText(EXPLODED_NO_MODEL_TEXT, { exact: true }), 'seeded layers: exploded "no model" state').toHaveCount(0);
}

/** A preset (local view state) past the label threshold → the floor cards with their "Ẩn tầng …" buttons appear. */
async function openExplodedAt(page: Page, projectId: string, preset: typeof EXPLODE_MEDIUM | typeof EXPLODE_FULL): Promise<void> {
  await openExplodedData(page, projectId);
  const radio = page.getByRole('radiogroup', { name: EXPLODE_PRESETS }).getByRole('radio', { name: preset, exact: true });
  await radio.click();
  await expect(radio).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: FLOOR_CARD }).first()).toBeVisible();
}

/** BUG-390: the default preset is "Gộp" (separation 0, no card); "floors separated" means "Tách vừa" chosen first. */
const openExplodedMedium = (page: Page, projectId: string): Promise<void> => openExplodedAt(page, projectId, EXPLODE_MEDIUM);
const openExplodedFull = (page: Page, projectId: string): Promise<void> => openExplodedAt(page, projectId, EXPLODE_FULL);

/** Measurement screen of `projectId`: overlay + "Phép đo" list, scene built. */
async function openMeasure(page: Page, projectId: string): Promise<void> {
  await page.goto(ROUTES.project.measure(projectId));
  await expect(viewport(page)).toBeVisible({ timeout: 15_000 });
  await dismissTour(page);
  await expect(viewport(page)).toHaveAttribute('aria-busy', 'false', { timeout: SCENE_TIMEOUT_MS });
  await expect(page.getByRole('region', { name: MEASURE_OVERLAY, exact: true })).toBeAttached();
  await expect(page.getByRole('radiogroup', { name: MEASURE_MODES })).toBeVisible();
  await expect(page.getByRole('region', { name: MEASURE_LIST, exact: true })).toBeVisible({ timeout: SCENE_TIMEOUT_MS });
}

/** Pascal viewer of the seeded project rendered; SKIPS only when the flag is off for the account (CP-0). */
async function openPascalData(page: Page, projectId: string): Promise<void> {
  await page.goto(ROUTES.project.viewerPascal(projectId));
  const rendered = page.getByRole('status').filter({ hasText: PASCAL_RENDERED_PATTERN });
  const forbidden = page.getByRole('heading', { name: PASCAL_FORBIDDEN_TITLE, exact: true });
  const empty = page.getByRole('heading', { name: PASCAL_EMPTY_TITLE, exact: true });
  await expect(rendered.or(forbidden).or(empty).first()).toBeVisible({ timeout: PASCAL_RENDER_TIMEOUT_MS });
  test.skip(await forbidden.isVisible(), 'Environment: feature flag "scene.pascal-viewer" is off for this account (CP-0)');
  await expect(empty, 'seeded graph: Pascal "nothing to build" state (that one is U05_pascal_empty)').toHaveCount(0);
  await expect(page.getByTestId(PASCAL_CANVAS_TESTID)).toBeVisible();
}

/** Mobile viewer of `projectId`: region up and no loading note left. */
async function openMobile(page: Page, projectId: string): Promise<void> {
  await page.goto(ROUTES.mobileViewer(projectId));
  await expect(page.getByRole('region', { name: MOBILE_REGION, exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(MOBILE_LOADING)).toHaveCount(0, { timeout: SCENE_TIMEOUT_MS });
}

const mobileTool = (page: Page, label: string): Locator =>
  page.getByRole('navigation', { name: MOBILE_TOOLS_NAV, exact: true }).getByRole('button', { name: label, exact: true });

async function openMobileData(page: Page, projectId: string): Promise<void> {
  await openMobile(page, projectId);
  await expect(page.getByRole('heading', { name: MOBILE_EMPTY_TITLE }), 'seeded geometry: mobile empty state (U05_mobile_empty)').toHaveCount(0);
}

/* ========================================================================== */
/* Data states on this test's own seeded project (BUG-346 / BUG-392)          */
/* ========================================================================== */

test.describe('U05 UI verify — SCR-23 viewer 3D (own seeded project)', () => {
  test.beforeEach(() => test.setTimeout(TEST_TIMEOUT_MS));

  test('U05 · SCR-23 viewer, model loaded', async ({ browser }) => {
    const openViewer = viewerOpener();
    await verifySeeded(browser, 'U05_viewer_loaded', async (p, projectId) => {
      await openViewerData(p, openViewer, projectId);
    });
  });

  for (const [label, id] of Object.entries(PANEL_IDS)) {
    test(`U05 · SCR-23 viewer, side panel "${label}" open`, async ({ browser }) => {
      const openViewer = viewerOpener();
      await verifySeeded(browser, `U05_viewer_panel_${id}`, async (p, projectId) => {
        await openViewerData(p, openViewer, projectId);
        const toggle = p.getByRole('navigation', { name: PANELS_NAV }).getByRole('button', { name: label, exact: true });
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        const panel = p.locator(`#viewer-3d-panel-${id}`);
        await expect(panel).toBeVisible();
        // The id wraps the Suspense fallback too: shoot the panel, not its "Đang tải …" placeholder.
        await expect(panel.getByRole('status').filter({ hasText: PANEL_LOADING })).toHaveCount(0, { timeout: SCENE_TIMEOUT_MS });
      });
    });
  }

  test('U05 · SCR-23 viewer, room search open', async ({ browser }) => {
    const openViewer = viewerOpener();
    await verifySeeded(browser, 'U05_viewer_search', async (p, projectId) => {
      await openViewerData(p, openViewer, projectId);
      // `ObjectSearch` renders nothing without rooms (ObjectSearch.tsx:115); the seeded layer has two per floor.
      await p.getByRole('button', { name: SEARCH_TRIGGER, exact: true }).click();
      await dismissTour(p); // opening the search can bring the tour back (phase05 main search case)
      await expect(p.getByRole('combobox', { name: SEARCH_INPUT })).toBeVisible();
      await expect(p.getByRole('listbox', { name: SEARCH_LIST })).toBeVisible();
    });
  });

  test('U05 · SCR-23 viewer, "Góc nhìn sẵn" menu open', async ({ browser }) => {
    const openViewer = viewerOpener();
    await verifySeeded(browser, 'U05_viewer_preset_menu', async (p, projectId) => {
      await openViewerData(p, openViewer, projectId);
      await p.getByRole('combobox', { name: PRESET_SELECT }).click();
      await expect(p.getByRole('option', { name: PRESET_TOP, exact: true })).toBeVisible();
    });
  });
});

test.describe('U05 UI verify — SCR-24 exploded view (own seeded project)', () => {
  test.beforeEach(() => test.setTimeout(TEST_TIMEOUT_MS));

  test('U05 · SCR-24 exploded, "Tách vừa" → floors separated', async ({ browser }) => {
    await verifySeeded(browser, 'U05_exploded_medium', openExplodedMedium);
  });

  test('U05 · SCR-24 exploded, "Tách hết" → floor cards', async ({ browser }) => {
    await verifySeeded(browser, 'U05_exploded_full', openExplodedFull);
  });

  test('U05 · SCR-24 exploded, one floor hidden (local)', async ({ browser }) => {
    await verifySeeded(browser, 'U05_exploded_floor_hidden', async (p, projectId) => {
      await openExplodedFull(p, projectId);
      const cards = p.getByRole('region', { name: EXPLODED_REGION, exact: true });
      const hide = cards.getByRole('button', { name: HIDE_FLOOR }).first();
      const label = (await hide.getAttribute('aria-label')) ?? '';
      await hide.click();
      await expect(cards.getByRole('button', { name: label.replace(/^Ẩn/u, 'Hiện'), exact: true })).toBeVisible();
    });
  });
});

test.describe('U05 UI verify — SCR-25 measurement tool (own seeded project)', () => {
  test.beforeEach(() => test.setTimeout(TEST_TIMEOUT_MS));

  test('U05 · SCR-25 measure, model loaded, no measurement yet', async ({ browser }) => {
    await verifySeeded(browser, 'U05_measure_default', openMeasure);
  });

  test('U05 · SCR-25 measure, "đơn vị" menu open', async ({ browser }) => {
    await verifySeeded(browser, 'U05_measure_unit_menu', async (p, projectId) => {
      await openMeasure(p, projectId);
      await p.getByRole('combobox', { name: UNIT_SELECT }).click();
      await expect(p.getByRole('option', { name: 'mm', exact: true })).toBeVisible();
    });
  });
});

test.describe('U05 UI verify — SCR-26 Pascal viewer (own seeded project, needs the flag)', () => {
  test.beforeEach(() => test.setTimeout(TEST_TIMEOUT_MS));

  test('U05 · SCR-26 Pascal, rendered', async ({ browser }) => {
    await verifySeeded(browser, 'U05_pascal_rendered', openPascalData);
  });

  test('U05 · SCR-26 Pascal, Esc → frame collapsed', async ({ browser }) => {
    await verifySeeded(browser, 'U05_pascal_collapsed', async (p, projectId) => {
      await openPascalData(p, projectId);
      await p.keyboard.press('Escape'); // usePascalViewer.ts pascalViewer.collapse
      await expect(p.getByRole('heading', { name: PASCAL_COLLAPSED_TITLE, exact: true })).toBeVisible();
      await expect(p.getByRole('button', { name: PASCAL_EXPAND, exact: true })).toBeVisible();
    });
  });
});

test.describe('U05 UI verify — SCR-27 mobile viewer (own seeded project)', () => {
  test.beforeEach(() => test.setTimeout(TEST_TIMEOUT_MS));

  test('U05 · SCR-27 mobile, model loaded', async ({ browser }) => {
    await verifySeeded(browser, 'U05_mobile_default', async (p, projectId) => {
      await openMobileData(p, projectId);
      await expect(p.getByRole('navigation', { name: MOBILE_TOOLS_NAV, exact: true })).toBeVisible();
    });
  });

  for (const [label, slug] of [
    ['Tầng', 'floors'],
    ['Đo', 'measure'],
  ] as const) {
    test(`U05 · SCR-27 mobile, "${label}" sheet open`, async ({ browser }) => {
      await verifySeeded(browser, `U05_mobile_${slug}`, async (p, projectId) => {
        await openMobileData(p, projectId);
        await mobileTool(p, label).click();
        await expect(mobileTool(p, label)).toHaveAttribute('aria-pressed', 'true');
        await expect(p.getByRole('group', { name: label, exact: true })).toBeVisible();
      });
    });
  }

  test('U05 · SCR-27 mobile, "Thông tin" sheet open', async ({ browser }) => {
    await verifySeeded(browser, 'U05_mobile_info', async (p, projectId) => {
      await openMobileData(p, projectId);
      await mobileTool(p, 'Thông tin').click();
      await expect(p.getByRole('dialog', { name: MOBILE_INFO_SHEET })).toBeVisible();
    });
  });
});

/* ========================================================================== */
/* Empty states + long names on a project this file creates (1 empty floor)   */
/* ========================================================================== */

test.describe('U05 UI verify — empty project, 80-char name + 65-char floor name (this file creates it)', () => {
  let admin: APIRequestContext | undefined;
  let projectId = '';

  test.beforeEach(() => test.setTimeout(TEST_TIMEOUT_MS));

  test.beforeAll(async () => {
    const { email, password } = readAdminCredentials();
    admin = await signedInApi(email, password);
    // BE #25 (apps/api/projects/schemas.py ProjectCreateIn/FloorDraftIn): one floor, no drawing, no layer.
    const res = await admin.post(PROJECTS_PATH, {
      data: { name: LONG_NAME, floors: [{ name: LONG_FLOOR_NAME, order: 0, elevationMm: 0, heightMm: 3000 }] },
    });
    expect(res.status(), 'setup: POST /api/projects').toBe(201);
    const body = (await res.json()) as { id?: unknown; name?: unknown };
    // Recorded BEFORE the check below, so `afterAll` deletes it even if it fails.
    if (typeof body.id === 'string') projectId = body.id;
    expect(body.name, 'setup: the server kept the 80-char name').toBe(LONG_NAME);
  });

  test.afterAll(async () => {
    try {
      if (admin && projectId !== '') {
        const res = await admin.delete(`${PROJECTS_PATH}/${projectId}`);
        if (res.status() !== 200) test.info().annotations.push({ type: 'cleanup', description: `DELETE project → ${res.status()}` });
      }
    } catch (error) {
      test.info().annotations.push({ type: 'cleanup', description: String(error) });
    } finally {
      await admin?.dispose();
    }
  });

  const own = (): string => {
    if (projectId === '') throw new Error('setup: the empty project was not created');
    return projectId;
  };

  test('U05 · SCR-23 viewer, no wall layer → empty state', async ({ browser }) => {
    const openViewer = viewerOpener();
    await verifyAsAdmin(browser, 'U05_viewer_empty', async (p) => {
      await openViewer(p, own());
      await expect(p.getByText(VIEWER_EMPTY_TEXT, { exact: true })).toBeVisible();
    });
  });

  test('U05 · SCR-24 exploded, one storey → empty state', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U05_exploded_empty', async (p) => {
      await openExploded(p, own());
      await expect(p.getByText(EXPLODED_EMPTY_TEXT, { exact: true })).toBeVisible();
    });
  });

  test('U05 · SCR-25 measure, no measurement → invitation', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U05_measure_empty', async (p) => {
      await openMeasure(p, own());
      // Same copy in the overlay (MeasurementTool.tsx EMPTY_INVITATION) and the list (MeasurementList.tsx EMPTY_HINT).
      await expect(p.getByText(MEASURE_EMPTY_TEXT, { exact: true }).first()).toBeVisible();
    });
  });

  test('U05 · SCR-26 Pascal, nothing to build → empty state', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U05_pascal_empty', async (p) => {
      await p.goto(ROUTES.project.viewerPascal(own()));
      const empty = p.getByRole('heading', { name: PASCAL_EMPTY_TITLE, exact: true });
      const forbidden = p.getByRole('heading', { name: PASCAL_FORBIDDEN_TITLE, exact: true });
      await expect(empty.or(forbidden).first()).toBeVisible({ timeout: PASCAL_RENDER_TIMEOUT_MS });
      test.skip(await forbidden.isVisible(), 'Environment: feature flag "scene.pascal-viewer" is off for this account (CP-0)');
    });
  });

  test('U05 · SCR-27 mobile, no geometry → empty state + 80-char name in header', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U05_mobile_empty', async (p) => {
      await openMobile(p, own());
      await expect(p.getByRole('heading', { name: MOBILE_EMPTY_TITLE })).toBeVisible();
      await expect(p.getByRole('heading', { name: LONG_NAME, level: 1 })).toBeVisible();
    });
  });
});
