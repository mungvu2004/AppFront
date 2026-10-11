/**
 * Phase 6 — dedicated UI-verification cases (skill `qa-verify-ui`): one test per visible state of SCR-28 (rule report),
 * SCR-29 (rule settings), SCR-30 (export panel), SCR-31 (Spatial JSON viewer) and SCR-32 (version history), each at
 * 1440 / 1024 / 768 / 375 (`support/ui-verify.ts`), evidence `U06_<state>_<width>.png` + `U06_<state>.json`. Reviewed by
 * the "verify ui" step with the qa-review-ui checklist. Models: `phase01_auth_ui.spec.ts`, `phase05_3d_viewer_ui.spec.ts`
 * (helper `verifyAsAdmin` copied from there).
 *
 * Data:
 *   - Data states read the CP-2 project (`project.projectId`, Phase 2) after CP-5 (`checkpoints.pipelineComplete`);
 *     SCR-32 also needs CP-6 (`checkpoints.restorableVersion`) and the work floor (`floors.workFloorName`). Without them
 *     the test SKIPS before loading anything. A state the project's data cannot show (rule run `done` → no filter bar,
 *     no rows; no row with a floor → no ViolationDetail; no non-current version → no restore button) SKIPS with a
 *     `data:` reason.
 *   - One run-unique project with an 80-character name and ONE floor with a 65-character name (`qa-<runId>-u06-…`),
 *     created through the API before its group and deleted after it. Its floor has no layer and no version. The store
 *     still hydrates a graph for it (one level, `store/projectHydration.ts`), so rules / settings / export / data may
 *     show their result layout rather than an "empty" copy: those cases wait for ANY settled state of the screen and
 *     record which one in a `state` annotation (no guessed copy). SCR-32 shows "<floor> chưa có phiên bản nào"
 *     (`useVersionHistory.ts:603`) with the long floor name.
 *
 * Budget — logins: 1 real admin API login (`signedInApi`, no-layer group); a browser login only to replace a dead stored
 * session (`ensureAdminSession`). Writes: 1 `POST /api/projects` (1 floor, BE #25 `floors`) + 1 `DELETE /api/projects/:id`
 * (API), nothing else — every test asserts the browser sent NO non-GET request under `/api/projects/` (`verifyAsAdmin`
 * guard). No rule switch / severity / preset is changed (autosave would PUT rule-config); the severity menu is only
 * opened. The label and restore dialogs are only opened, never submitted ("Gắn nhãn" / "Phục hồi" never clicked; R3:
 * the only restore of Phase 6 stays the main layer's last test). The `.json` export is a local blob download
 * (`exportPanelGateway.ts` startSpatialJsonExport + deliverViaAnchor, no request); it is the plan's download opt-in, same
 * as the main layer's `30_export_json_done`.
 * Sessions: every test opens its OWN context from Phase 1's admin storage state and writes the rotated refresh cookie back
 * in `finally`: 28 tests × (4 loads + 1 session check) = 140 `POST /api/auth/refresh` (`auth_refresh_total` 300 / 60 s
 * per sid; spread over the run).
 * No faked response: every state is the real stack. Non-serial: each test uses its own context and page.
 * G6: the editor tour mounts on `/export` only (`ExportPanel.container.tsx` `hostId="export-panel"`); it is dismissed
 * with the product's own "Bỏ qua hướng dẫn" (`e2e/fixtures/tour.ts`).
 */
import { expect, test, type APIRequestContext, type Browser, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { TOUR_APPEAR_TIMEOUT_MS, dismissTour } from '../../e2e/fixtures/tour';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { signedInApi } from './support/api';
import { ensureAdminSession, readAdminCredentials } from './support/auth';
import { TEST_DATA_PREFIX } from './support/evidence';
import { ADMIN_STORAGE_STATE_FILE, readState, requireState } from './support/state';
import { UI_VIEWPORTS, verifyUi } from './support/ui-verify';

/* Copy — every string checked in src/ (file noted). */
/* SCR-28: RuleReport.tsx, RuleReportSummary.tsx:156, RuleReportLabels.tsx:96-99, RuleReport.container.tsx. */
const RULES_TITLE = 'Kiểm tra luật không gian';
const RERUN = 'Chạy kiểm tra lại';
const LEVEL_FILTER = 'Lọc theo mức độ';
const RULES_DONE_TEXT = 'Không phát hiện vi phạm nào.'; // RuleReport.tsx DonePanel
const RULES_EMPTY_TITLE = 'Chưa có mô hình để kiểm tra luật';
const RULES_ERROR_TITLE = 'Không chạy được lượt kiểm tra';
const LEVEL_VIOLATION = 'Vi phạm';
const LEVEL_PASSED = 'Đạt';
const PASSED_EMPTY_TEXT = 'Chưa có luật nào chạy xong mà không ra lỗi.';
const FILTER_NO_MATCH = 'Không có mục nào khớp bộ lọc đang đặt. Nới bộ lọc để xem thêm.';
/** RuleReportLabels.tsx:75-79 GROUP_LABELS: the passed list shows one per row (RuleReportGroups.tsx RuleReportPassedList). */
const RULE_GROUP_LABEL = /^(Hình học|Lưu thông|Diện tích|Ghi chú|Cao độ tầng)$/u;
const VIOLATION_DETAIL = 'Chi tiết vi phạm'; // ViolationDetail aside (phase06 main SCR-28)
const VIEW_ROW = 'Xem';
/* SCR-29: RuleSettings.tsx, RuleSettingsRow.tsx:62,70. */
const SETTINGS_TITLE = 'Cài đặt bộ luật không gian';
const SETTINGS_EMPTY_TITLE = 'Chưa có mô hình để áp bộ luật';
const SETTINGS_ERROR_TITLE = 'Không tải được cài đặt bộ luật';
const RULE_SWITCH = /^Bật hoặc tắt luật: /u;
const SEVERITY_SELECT = /^Mức độ của luật: /u;
/* SCR-30: ExportPanel.tsx, ExportPanelFormats.tsx:34-39,144, ExportPanelOptions.tsx, ExportPanelPreflight.tsx:26. */
const FORMATS = 'Định dạng xuất';
const EXPORT_EMPTY_TITLE = 'Chưa có gì được duyệt để xuất';
const PREFLIGHT = 'Kiểm tra trước khi xuất';
const OPTIONS_TOGGLE = 'Tuỳ chọn';
const GLB_DETAIL = 'Mức độ chi tiết mô hình';
const JSON_CONFIDENCE = 'Gồm độ tin cậy từng đối tượng';
const PDF_BLOCKED_CAPTION = 'Chưa tải về được: dự án chưa có bộ dựng tệp PDF, mới đếm được số trang.';
const IMAGE_BLOCKED_CAPTION =
  'Chưa tải về được: ảnh cần một khung nhìn ba chiều đang mở, màn này chưa gắn với khung nhìn nào.';
const EXPORT_BUTTON = 'Xuất';
const EXPORT_HISTORY = 'Tệp đã xuất';
/* SCR-31: SpatialJsonViewer.tsx, SpatialJsonTree.tsx:60, SpatialJsonDetail.tsx:40-42,136. */
const JSON_TREE = 'Cấu trúc dữ liệu không gian';
const JSON_SEARCH = 'Tìm theo khoá hoặc giá trị';
const JSON_EMPTY_TITLE = 'Chưa có dữ liệu không gian';
const JSON_ERROR_TITLE = 'Không đọc được dữ liệu không gian';
const EXPAND_ALL = 'Mở rộng tất cả';
const COLLAPSE_ALL = 'Thu gọn tất cả';
const VIEW_MODE = 'Cách hiện cấu trúc';
const DETAIL_TABS = 'Cách xem nội dung';
/** `useSpatialJsonViewer.ts` matchLabel (`formatNumber`, vi grouping "."). */
const POSITIVE_MATCH_PATTERN = /^[1-9][\d.]* \/ [1-9][\d.]*$/u;
const NO_MATCH_LABEL = '0 / 0';
const NO_MATCH_TERM = `${TEST_DATA_PREFIX}khong-khop-khoa-nao`;
/** `SpatialJsonViewer.container.tsx:62` NARROW_QUERY `(width < 1024px)`: the detail half is not rendered below it. */
const DETAIL_MIN_WIDTH = 1024;
/* SCR-32: VersionHistory.tsx, VersionCompare.tsx:49-53, VersionLabelDialog.tsx, versionHistoryModel.ts:506-510. */
const FLOOR_SELECT = 'Tầng';
const DIFF_TABS = 'Cách xem khác biệt';
const RIGHT_VERSION_SELECT = 'Phiên bản đối chiếu';
const LABEL_BUTTON = 'Gắn nhãn phiên bản này';
const LABEL_FIELD = 'Nhãn';
const RESTORE_BUTTON = 'Phục hồi phiên bản này';
const RESTORE_CONFIRM_TITLE = /Phục hồi phiên bản .+ của .+\?/u;
const KEEP_AS_IS = 'Để nguyên';
const VERSIONS_EMPTY_SUFFIX = ' chưa có phiên bản nào'; // useVersionHistory.ts:603

const PROJECTS_PATH = '/api/projects';
/** 4 widths × (load + store hydration + rule run / diff). */
const TEST_TIMEOUT_MS = 240_000;
const SETTLE_TIMEOUT_MS = 30_000;
const NAME_MAX_LENGTH = 80;
/** Exactly 80 chars, run-unique: `qa-<runId>-u06-<base36 time> ` + Vietnamese filler, ending in a letter. */
const LONG_NAME = `${`${TEST_DATA_PREFIX}u06-${Date.now().toString(36)} ${'Khu phức hợp văn phòng Bình Minh '.repeat(4)}`.slice(0, NAME_MAX_LENGTH - 1)}A`;
if (LONG_NAME.length !== NAME_MAX_LENGTH) throw new Error(`LONG_NAME is ${LONG_NAME.length} chars`);
/** 65 chars (as phase05 UI); the FE sets no floor-name cap, the BE draft name only `min_length=1` (projects/schemas.py). */
const LONG_FLOOR_NAME = 'Tầng kỹ thuật mái và phòng máy bơm nước sinh hoạt khu B phía Đông';

/* ---- helpers ---- */

function requireCp5(): void {
  test.skip(!readState().checkpoints.pipelineComplete, 'data: CP-5 not reached (checkpoints.pipelineComplete false)');
}

function requireCp6(): void {
  test.skip(!readState().checkpoints.restorableVersion, 'data: CP-6 not reached (checkpoints.restorableVersion false)');
}

const cp2 = (): string => requireState((s) => s.project.projectId, 'project.projectId', 'Phase 2');
const workFloorName = (): string => requireState((s) => s.floors.workFloorName, 'floors.workFloorName', 'Phase 3');

/** Own context from the admin storage state, rotated refresh cookie written back; records non-GET under /api/projects/. */
async function verifyAsAdmin(browser: Browser, name: string, open: (page: Page) => Promise<void>): Promise<void> {
  const context = await browser.newContext({ baseURL: readBaseUrl(), storageState: ADMIN_STORAGE_STATE_FILE });
  const writes: string[] = [];
  try {
    await ensureAdminSession(context, ADMIN_STORAGE_STATE_FILE);
    const page = await context.newPage();
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (request.method() !== 'GET' && path.startsWith(`${PROJECTS_PATH}/`)) writes.push(`${request.method()} ${path}`);
    });
    await verifyUi(page, name, open, UI_VIEWPORTS);
  } finally {
    await context.storageState({ path: ADMIN_STORAGE_STATE_FILE });
    await context.close();
  }
  expect.soft(writes, 'a UI case sends no write under /api/projects/').toEqual([]);
}

/** Records the settled state once per test (the four widths must agree; a different one is noted too). */
function noteState(state: string): void {
  const annotations = test.info().annotations;
  if (!annotations.some((a) => a.type === 'state' && a.description === state)) annotations.push({ type: 'state', description: state });
}

/** First of `candidates` that is visible, after waiting until one is. */
async function settled(candidates: Readonly<Record<string, Locator>>): Promise<string> {
  const all = Object.values(candidates);
  const any = all.slice(1).reduce((acc, next) => acc.or(next), all[0] as Locator);
  await expect(any.first()).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });
  for (const [state, locator] of Object.entries(candidates)) {
    if (await locator.first().isVisible()) return state;
  }
  return 'unknown';
}

/* ---- SCR-28 ---- */

const levelFilter = (page: Page): Locator => page.getByRole('radiogroup', { name: LEVEL_FILTER, exact: true });
/** Group expanders: `RuleReportSection` puts the toggle button inside an `<h3>` (phase06 main). */
const groupExpanders = (page: Page): Locator => page.getByRole('heading', { level: 3 }).getByRole('button');

/** `/rules` with a run result (`ready`/`partial` filter bar, `done`, or the empty / error copy). Returns the state. */
async function openRules(page: Page, projectId: string): Promise<string> {
  await page.goto(ROUTES.project.rules(projectId));
  await expect(page.getByRole('heading', { name: RULES_TITLE, level: 2 })).toBeVisible({ timeout: 15_000 });
  const state = await settled({
    filters: levelFilter(page),
    done: page.getByText(RULES_DONE_TEXT, { exact: true }),
    empty: page.getByText(RULES_EMPTY_TITLE, { exact: true }),
    error: page.getByText(RULES_ERROR_TITLE, { exact: true }),
  });
  if (state !== 'empty' && state !== 'error') await expect(page.getByRole('button', { name: RERUN, exact: true })).toBeEnabled();
  noteState(state);
  return state;
}

/** CP-2 `/rules` with the filter bar (`ready`/`partial`); SKIPS on `done` (RuleReport.tsx canFilter). */
async function openRulesFiltered(page: Page): Promise<void> {
  const state = await openRules(page, cp2());
  test.skip(state !== 'filters', `data: CP-2 rule run is "${state}", no filter bar; that state is U06_rules_report`);
}

async function pickLevel(page: Page, label: string): Promise<void> {
  const radio = levelFilter(page).getByRole('radio', { name: label, exact: true });
  await radio.click();
  await expect(radio).toHaveAttribute('aria-checked', 'true');
}

/** Expands the first collapsed rule group; SKIPS when there is none. Returns its `<section>`. */
async function expandFirstGroup(page: Page): Promise<Locator> {
  await openRulesFiltered(page);
  const states = await groupExpanders(page).evaluateAll((els) => els.map((el) => el.getAttribute('aria-expanded')));
  const index = states.indexOf('false');
  test.skip(index === -1, 'data: no collapsed rule group in the CP-2 report');
  const expander = groupExpanders(page).nth(index);
  await expander.click();
  await expect(expander).toHaveAttribute('aria-expanded', 'true');
  return page.locator('section').filter({ has: expander });
}

/* ---- SCR-29 ---- */

async function openRuleSettings(page: Page, projectId: string): Promise<string> {
  await page.goto(ROUTES.project.ruleSettings(projectId));
  await expect(page.getByRole('heading', { name: SETTINGS_TITLE, level: 2 })).toBeVisible({ timeout: 15_000 });
  const state = await settled({
    rules: page.getByRole('switch', { name: RULE_SWITCH }),
    empty: page.getByText(SETTINGS_EMPTY_TITLE, { exact: true }),
    error: page.getByText(SETTINGS_ERROR_TITLE, { exact: true }),
  });
  noteState(state);
  return state;
}

/* ---- SCR-30 ---- */

/** `/export` settled; the tour (G6) is dismissed. The first call of a test may wait for the lazy tour. */
function exportOpener(): (page: Page, projectId: string) => Promise<string> {
  let tourPending = true;
  return async (page, projectId) => {
    await page.goto(ROUTES.project.export(projectId));
    const state = await settled({
      panel: page.getByRole('radiogroup', { name: FORMATS, exact: true }),
      empty: page.getByRole('heading', { name: EXPORT_EMPTY_TITLE, level: 2 }),
    });
    await dismissTour(page, { waitMs: tourPending ? TOUR_APPEAR_TIMEOUT_MS : 0 });
    tourPending = false;
    if (state === 'panel') await expect(page.getByRole('region', { name: PREFLIGHT, exact: true })).toBeVisible();
    noteState(state);
    return state;
  };
}

async function openExportPanel(page: Page, openExport: ReturnType<typeof exportOpener>): Promise<void> {
  const state = await openExport(page, cp2());
  test.skip(state !== 'panel', `data: CP-2 export panel is "${state}"`);
}

async function selectFormat(page: Page, extension: string): Promise<Locator> {
  const radio = page
    .getByRole('radiogroup', { name: FORMATS, exact: true })
    .getByRole('radio', { name: new RegExp(`^${extension.replace('.', '\\.')}`, 'u') });
  await radio.click();
  await expect(radio).toHaveAttribute('aria-checked', 'true');
  return radio;
}

/* ---- SCR-31 ---- */

const jsonTree = (page: Page): Locator => page.getByRole('tree', { name: JSON_TREE, exact: true });

async function openData(page: Page, projectId: string): Promise<string> {
  await page.goto(ROUTES.project.data(projectId));
  await expect(page.getByRole('textbox', { name: JSON_SEARCH, exact: true })).toBeVisible({ timeout: 15_000 });
  const state = await settled({
    tree: jsonTree(page).getByRole('treeitem'),
    empty: page.getByText(JSON_EMPTY_TITLE, { exact: true }),
    error: page.getByText(JSON_ERROR_TITLE, { exact: true }),
  });
  noteState(state);
  return state;
}

async function openDataTree(page: Page): Promise<void> {
  const state = await openData(page, cp2());
  test.skip(state !== 'tree', `data: CP-2 Spatial JSON viewer is "${state}"`);
}

/* ---- SCR-32 ---- */

const diffTabs = (page: Page): Locator => page.getByRole('tablist', { name: DIFF_TABS, exact: true });

/** `/versions` with `floorName` picked in "Tầng"; waits for the diff tabs (≥2 versions) or the empty copy. */
async function openVersions(page: Page, projectId: string, floorName: string): Promise<string> {
  await page.goto(ROUTES.project.versions(projectId));
  const floorSelect = page.getByRole('combobox', { name: FLOOR_SELECT, exact: true });
  await expect(floorSelect).toBeVisible({ timeout: 15_000 });
  await floorSelect.click();
  await page.getByRole('option', { name: floorName, exact: true }).click();
  await expect(floorSelect).toContainText(floorName);
  const state = await settled({
    diff: diffTabs(page),
    empty: page.getByText(`${floorName}${VERSIONS_EMPTY_SUFFIX}`, { exact: true }),
  });
  noteState(state);
  return state;
}

async function openVersionsDiff(page: Page): Promise<void> {
  const state = await openVersions(page, cp2(), workFloorName());
  test.skip(state !== 'diff', `data: the work floor shows "${state}", no version pair`);
}

/* ========================================================================== */
/* Data states on the CP-2 project                                            */
/* ========================================================================== */

test.describe('U06 UI verify — SCR-28 rule report (CP-2, needs CP-5)', () => {
  test.beforeEach(requireCp5);
  test.beforeEach(() => test.setTimeout(TEST_TIMEOUT_MS));

  test('U06 · SCR-28 rules, run result (summary + list or done panel)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U06_rules_report', async (p) => {
      const state = await openRules(p, cp2());
      expect(state, 'CP-2 rule report state').not.toMatch(/^(empty|error)$/u);
    });
  });

  test('U06 · SCR-28 rules, level filter "Vi phạm"', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U06_rules_filter_violation', async (p) => {
      await openRulesFiltered(p);
      await pickLevel(p, LEVEL_VIOLATION);
      await expect(groupExpanders(p).first().or(p.getByText(FILTER_NO_MATCH, { exact: true })).first()).toBeVisible();
    });
  });

  test('U06 · SCR-28 rules, level filter "Đạt" → passed rules', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U06_rules_filter_passed', async (p) => {
      await openRulesFiltered(p);
      await pickLevel(p, LEVEL_PASSED);
      // RuleReportPassedList, or its one-line empty copy (RuleReport.tsx RuleReportBody).
      await expect(groupExpanders(p)).toHaveCount(0);
      const passedRow = p.getByRole('listitem').filter({ has: p.getByText(RULE_GROUP_LABEL, { exact: true }) });
      await expect(p.getByText(PASSED_EMPTY_TEXT, { exact: true }).or(passedRow).first()).toBeVisible();
    });
  });

  test('U06 · SCR-28 rules, rule group expanded (rows with "Xem")', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U06_rules_group_expanded', async (p) => {
      const section = await expandFirstGroup(p);
      await expect(section.getByRole('row').first()).toBeVisible();
    });
  });

  test('U06 · SCR-28 rules, row → ViolationDetail sheet open', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U06_rules_violation_detail', async (p) => {
      const section = await expandFirstGroup(p);
      // ViolationDetail needs a floor (RuleReport.container.tsx: activeFloorId ?? row.levelId), as phase06 main.
      const rows = section
        .getByRole('row')
        .filter({ has: p.getByRole('button', { name: VIEW_ROW, exact: true }) })
        .filter({ hasNot: p.getByText('—', { exact: true }) });
      test.skip((await rows.count()) === 0, 'data: the expanded group has no row with a floor');
      await rows.first().getByRole('button').first().click();
      await expect(p.getByRole('complementary', { name: VIOLATION_DETAIL })).toBeVisible();
    });
  });
});

test.describe('U06 UI verify — SCR-29 rule settings (CP-2, needs CP-5)', () => {
  test.beforeEach(requireCp5);
  test.beforeEach(() => test.setTimeout(TEST_TIMEOUT_MS));

  test('U06 · SCR-29 rule settings, all groups', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U06_rulesettings_default', async (p) => {
      expect(await openRuleSettings(p, cp2()), 'CP-2 rule settings state').toBe('rules');
    });
  });

  test('U06 · SCR-29 rule settings, severity menu open (nothing chosen)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U06_rulesettings_severity_menu', async (p) => {
      expect(await openRuleSettings(p, cp2()), 'CP-2 rule settings state').toBe('rules');
      // Opening the menu is view state; choosing would autosave a PUT (useRuleSettings.ts), so nothing is chosen.
      await p.getByRole('combobox', { name: SEVERITY_SELECT }).first().click();
      await expect(p.getByRole('option').first()).toBeVisible();
    });
  });
});

test.describe('U06 UI verify — SCR-30 export panel (CP-2, needs CP-5)', () => {
  test.beforeEach(requireCp5);
  test.beforeEach(() => test.setTimeout(TEST_TIMEOUT_MS));

  test('U06 · SCR-30 export, .glb with "Tuỳ chọn" open', async ({ browser }) => {
    const openExport = exportOpener();
    await verifyAsAdmin(browser, 'U06_export_glb_options', async (p) => {
      await openExportPanel(p, openExport);
      await selectFormat(p, '.glb');
      const toggle = p.getByRole('button', { name: OPTIONS_TOGGLE, exact: true });
      if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(p.getByRole('radiogroup', { name: GLB_DETAIL, exact: true })).toBeVisible();
    });
  });

  test('U06 · SCR-30 export, .json selected', async ({ browser }) => {
    const openExport = exportOpener();
    await verifyAsAdmin(browser, 'U06_export_json', async (p) => {
      await openExportPanel(p, openExport);
      await selectFormat(p, '.json');
      const toggle = p.getByRole('button', { name: OPTIONS_TOGGLE, exact: true });
      if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
      await expect(p.getByRole('checkbox', { name: JSON_CONFIDENCE, exact: true })).toBeVisible();
      await expect(p.getByRole('button', { name: EXPORT_BUTTON, exact: true })).toBeVisible();
    });
  });

  test('U06 · SCR-30 export, .pdf blocked (no "Xuất")', async ({ browser }) => {
    const openExport = exportOpener();
    await verifyAsAdmin(browser, 'U06_export_pdf_blocked', async (p) => {
      await openExportPanel(p, openExport);
      await expect(await selectFormat(p, '.pdf')).toContainText(PDF_BLOCKED_CAPTION);
      await expect(p.getByRole('button', { name: EXPORT_BUTTON, exact: true })).toHaveCount(0);
    });
  });

  test('U06 · SCR-30 export, .png blocked (no 3D viewport)', async ({ browser }) => {
    const openExport = exportOpener();
    await verifyAsAdmin(browser, 'U06_export_png_blocked', async (p) => {
      await openExportPanel(p, openExport);
      // canCaptureImage is false without a viewport (exportPanelGateway.ts:239).
      await expect(await selectFormat(p, '.png')).toContainText(IMAGE_BLOCKED_CAPTION);
      await expect(p.getByRole('button', { name: EXPORT_BUTTON, exact: true })).toHaveCount(0);
    });
  });

  test('U06 · SCR-30 export, .json exported → "Tệp đã xuất" row', async ({ browser }) => {
    const openExport = exportOpener();
    await verifyAsAdmin(browser, 'U06_export_json_done', async (p) => {
      await openExportPanel(p, openExport);
      await selectFormat(p, '.json');
      const download = p.waitForEvent('download');
      await p.getByRole('button', { name: EXPORT_BUTTON, exact: true }).click();
      expect((await download).suggestedFilename(), 'suggested file name').toMatch(/\.json$/u);
      await expect(p.getByRole('region', { name: EXPORT_HISTORY, exact: true })).toBeVisible();
    });
  });
});

test.describe('U06 UI verify — SCR-31 Spatial JSON viewer (CP-2, needs CP-5)', () => {
  test.beforeEach(requireCp5);
  test.beforeEach(() => test.setTimeout(TEST_TIMEOUT_MS));

  test('U06 · SCR-31 data, tree loaded', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U06_data_tree', openDataTree);
  });

  test('U06 · SCR-31 data, search with matches', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U06_data_search_match', async (p) => {
      await openDataTree(p);
      // A top-level key read from the tree itself: guaranteed ≥1 match (phase06 main).
      const term = (await jsonTree(p).getByRole('treeitem').first().locator('code').first().innerText()).trim();
      await p.getByRole('textbox', { name: JSON_SEARCH, exact: true }).fill(term);
      await expect(p.getByText(POSITIVE_MATCH_PATTERN)).toBeVisible();
    });
  });

  test('U06 · SCR-31 data, search with no match ("0 / 0")', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U06_data_search_no_match', async (p) => {
      await openDataTree(p);
      await p.getByRole('textbox', { name: JSON_SEARCH, exact: true }).fill(NO_MATCH_TERM);
      await expect(p.getByText(NO_MATCH_LABEL, { exact: true })).toBeVisible();
    });
  });

  test('U06 · SCR-31 data, "Mở rộng tất cả"', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U06_data_expanded', async (p) => {
      await openDataTree(p);
      const items = jsonTree(p).getByRole('treeitem');
      await p.getByRole('button', { name: COLLAPSE_ALL, exact: true }).click();
      const collapsed = await items.count();
      await p.getByRole('button', { name: EXPAND_ALL, exact: true }).click();
      await expect.poll(() => items.count()).toBeGreaterThan(collapsed);
    });
  });

  test('U06 · SCR-31 data, item selected + "Xem trước" tab (detail ≥1024)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U06_data_preview', async (p) => {
      await openDataTree(p);
      const item = jsonTree(p).getByRole('treeitem').first();
      await item.click();
      await expect(item).toHaveAttribute('aria-selected', 'true');
      if ((p.viewportSize()?.width ?? 0) < DETAIL_MIN_WIDTH) return; // detail half not rendered (NARROW_QUERY)
      const preview = p.getByRole('tablist', { name: DETAIL_TABS, exact: true }).getByRole('tab', { name: 'Xem trước', exact: true });
      await preview.click();
      await expect(preview).toHaveAttribute('aria-selected', 'true');
    });
  });

  test('U06 · SCR-31 data, "Thô" view mode', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U06_data_raw', async (p) => {
      await openDataTree(p);
      const raw = p.getByRole('radiogroup', { name: VIEW_MODE, exact: true }).getByRole('radio', { name: 'Thô', exact: true });
      await raw.click();
      await expect(raw).toHaveAttribute('aria-checked', 'true');
    });
  });
});

test.describe('U06 UI verify — SCR-32 version history (CP-2, needs CP-6)', () => {
  test.beforeEach(requireCp5);
  test.beforeEach(requireCp6);
  test.beforeEach(() => test.setTimeout(TEST_TIMEOUT_MS));

  test('U06 · SCR-32 versions, work floor, default pair, "Thay đổi"', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U06_versions_changes', async (p) => {
      await openVersionsDiff(p);
      await expect(diffTabs(p).getByRole('tab', { name: 'Thay đổi', exact: true })).toHaveAttribute('aria-selected', 'true');
    });
  });

  for (const [label, slug] of [
    ['JSON', 'json'],
    ['Trực quan', 'visual'],
  ] as const) {
    test(`U06 · SCR-32 versions, "${label}" tab`, async ({ browser }) => {
      await verifyAsAdmin(browser, `U06_versions_${slug}`, async (p) => {
        await openVersionsDiff(p);
        const tab = diffTabs(p).getByRole('tab', { name: label, exact: true });
        await tab.click();
        await expect(tab).toHaveAttribute('aria-selected', 'true');
        await expect(p.getByRole('tabpanel', { name: label, exact: true })).toBeVisible();
      });
    });
  }

  test('U06 · SCR-32 versions, label dialog open (not submitted)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U06_versions_label_dialog', async (p) => {
      await openVersionsDiff(p);
      await p.getByRole('button', { name: LABEL_BUTTON, exact: true }).click();
      const dialog = p.getByRole('dialog');
      await expect(dialog).toContainText('Gắn nhãn phiên bản');
      await expect(dialog.getByRole('textbox', { name: LABEL_FIELD, exact: true })).toBeVisible();
    });
  });

  test('U06 · SCR-32 versions, restore confirm open (not confirmed)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U06_versions_restore_confirm', async (p) => {
      await openVersionsDiff(p);
      // "Phục hồi phiên bản này" shows only when the pair's right version is not "Hiện tại" (VersionHistory.tsx).
      // Walk the "Phiên bản đối chiếu" options (local pick; only GET snapshot reads) until it shows.
      const restore = p.getByRole('button', { name: RESTORE_BUTTON, exact: true });
      const right = p.getByRole('combobox', { name: RIGHT_VERSION_SELECT, exact: true });
      let count = 1;
      for (let index = 0; index < count && !(await restore.isVisible()); index += 1) {
        await right.click();
        const options = p.getByRole('option');
        await expect(options.first()).toBeVisible();
        count = await options.count();
        await options.nth(index).click();
        await restore.waitFor({ state: 'visible', timeout: 3_000 }).catch(() => undefined);
      }
      test.skip(!(await restore.isVisible()), 'data: no non-current version can be the reviewed one');
      await restore.click();
      const dialog = p.getByRole('dialog');
      await expect(dialog).toContainText(RESTORE_CONFIRM_TITLE);
      // R3: never "Phục hồi"; the context closes with the dialog open.
      await expect(dialog.getByRole('button', { name: KEEP_AS_IS, exact: true })).toBeVisible();
    });
  });
});

/* ========================================================================== */
/* No-layer project + long names (this file creates it)                       */
/* ========================================================================== */

test.describe('U06 UI verify — no-layer project, 80-char name + 65-char floor name (this file creates it)', () => {
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
    if (projectId === '') throw new Error('setup: the no-layer project was not created');
    return projectId;
  };

  test('U06 · SCR-28 rules, no-layer project', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U06_rules_no_layer', async (p) => {
      expect(await openRules(p, own()), 'no-layer rule report must not be the error state').not.toBe('error');
    });
  });

  test('U06 · SCR-29 rule settings, no-layer project', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U06_rulesettings_no_layer', async (p) => {
      expect(await openRuleSettings(p, own()), 'no-layer rule settings must not be the error state').not.toBe('error');
    });
  });

  test('U06 · SCR-30 export, no-layer project (65-char floor in "Phạm vi" or empty copy)', async ({ browser }) => {
    const openExport = exportOpener();
    await verifyAsAdmin(browser, 'U06_export_no_layer', async (p) => {
      await openExport(p, own());
    });
  });

  test('U06 · SCR-31 data, no-layer project', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U06_data_no_layer', async (p) => {
      expect(await openData(p, own()), 'no-layer data viewer must not be the error state').not.toBe('error');
    });
  });

  test('U06 · SCR-32 versions, floor without versions → empty copy with the 65-char name', async ({ browser }) => {
    // run-01-author: below 1024 this fails — `useVersionHistory.ts:488-489` returns 'collapsed' before 'empty', so a
    // floor with 0 versions shows "Mới có một phiên bản nên chưa có gì để so sánh…" (versionHistoryCompare.ts:34)
    // and a disabled "Phục hồi phiên bản này". App behaviour, not asserted away.
    await verifyAsAdmin(browser, 'U06_versions_empty', async (p) => {
      expect(await openVersions(p, own(), LONG_FLOOR_NAME)).toBe('empty');
    });
  });
});
