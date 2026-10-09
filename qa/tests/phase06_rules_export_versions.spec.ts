/**
 * Phase 6: Rules, export, data, versions (E2E-TEST-PLAN.md v2, §4 Phase 6), Track A, admin.
 * SCR-28 → SCR-32, matrix row order. The SCR-32 restore is the LAST test of the file (rule R3).
 *
 * Needs (runtime-session.json): project.projectId, floors.workFloorId / workFloorName,
 * checkpoints.pipelineComplete (CP-5), checkpoints.restorableVersion (CP-6, Phase 4).
 *
 * Contracts verified in source (c4978eb4):
 * - RuleReport: rules run client-side (`useRuleReport.ts` `runRules`); "Chạy kiểm tra lại" is a
 *   `refetch`, no request. Filter bar only renders in `ready`/`partial` (`RuleReport.tsx` canFilter).
 *   Row message button opens `ViolationDetailContainer` (`aside "Chi tiết vi phạm"`) only when the
 *   row has a floor; "Xem" navigates to `/3d`; "Xác nhận đã xử lý" is `disabled={violations > 0}`.
 * - RuleSettings: autosave 800 ms → `PUT /api/projects/:id/rule-config {baseVersion, body}`
 *   (`api/client.ts` ruleConfig.replace); toast via `appNotificationBus` (region "Thông báo",
 *   button "Hoàn tác"); footer "Khôi phục mặc định" only when `!isDefault`.
 * - Export: format cards are `role=radio` in radiogroup "Định dạng xuất" (name starts with the
 *   extension label `.glb`/`.json`/`.pdf`). JSON export is a blob `<a download>` click
 *   (`exportPanelGateway.ts` deliverViaAnchor). PDF: `canRenderPdfBytes` is false, so the footer
 *   does NOT render "Xuất" at all and the card carries PDF_BLOCKED_CAPTION.
 * - Versions: label = `PATCH /api/projects/:id/versions/:v/label {label}`; restore =
 *   `POST /api/projects/:id/versions/:v/restore`; snapshot = `GET …/versions/:v/snapshot?floorId=`
 *   → `{dimensions, layer, versionId}` (`schemas/versions.ts`). Restore/label act on the pair's
 *   RIGHT (newer) version (`VersionHistory.tsx` reviewedVersionId = compare.rightVersionId).
 */
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { TOUR_APPEAR_TIMEOUT_MS, dismissTour } from '../../e2e/fixtures/tour';
import {
  describeEntry,
  navigateThenWaitForApi,
  waitForApi,
  watchApi,
  type ApiEntry,
} from '../../e2e/fullstack/apiWatch';
import { ACTION_TIMEOUT_MS, AUTOSAVE_TIMEOUT_MS, NAVIGATION_TIMEOUT_MS, readBaseUrl } from '../../e2e/fullstack/env';
import { signInAdmin } from './support/auth';
import { captureEvidence } from './support/evidence';
import { requireState } from './support/state';

test.describe.configure({ mode: 'serial' });

const VIEWPORT = { width: 1440, height: 900 } as const;

/** `ExportPanelFormats.tsx` PDF_BLOCKED_CAPTION. */
const PDF_BLOCKED_CAPTION = 'Chưa tải về được: dự án chưa có bộ dựng tệp PDF, mới đếm được số trang.';
/** `VersionList.tsx` checkbox name. Same pattern as chain.fullstack.ts. */
const VERSION_CHECKBOX_PATTERN = /^Chọn phiên bản (.+) để so sánh$/u;
/** `useSpatialJsonViewer.ts` matchLabel: `${index + 1} / ${count}` (formatNumber, vi grouping "."). */
const MATCH_LABEL_PATTERN = /^\d[\d.]* \/ [\d.]+$/u;
const POSITIVE_MATCH_PATTERN = /^[1-9][\d.]* \/ [1-9][\d.]*$/u;

/* ---- phase-local helpers (minimal copies of chain.fullstack.ts) ---- */

type Json = Record<string, unknown>;

const asRecord = (value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${what}: body is not a JSON object`);
  }
  return value as Json;
};

/** Order-independent key of a JSON value. */
const stable = (value: unknown): string =>
  JSON.stringify(value, (_key, inner: unknown) =>
    typeof inner === 'object' && inner !== null && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner as Json).sort(([a], [b]) => a.localeCompare(b)))
      : inner,
  );

const wallsOf = (body: unknown, what: string): Json[] => {
  const walls = asRecord(asRecord(body, what).layer, `${what}.layer`).walls;

  if (!Array.isArray(walls)) throw new Error(`${what}: no layer.walls`);
  return walls.map((wall, index) => asRecord(wall, `${what}.layer.walls[${String(index)}]`));
};

const pick = (wall: Json, keys: readonly string[]): string =>
  stable(Object.fromEntries(keys.map((key) => [key, wall[key]])));

const pathnameOf = (page: Page): string => new URL(page.url()).pathname;

/** Index of the first element in `locator` whose `attr` equals `value`, or -1. */
async function firstIndexWhere(locator: Locator, attr: string, value: string): Promise<number> {
  const values = await locator.evaluateAll(
    (elements, name) => elements.map((element) => element.getAttribute(name)),
    attr,
  );
  return values.indexOf(value);
}

/* ---- shared session ---- */

let context: BrowserContext;
let page: Page;
let api: ApiEntry[];
let projectId: string;
let workFloorId: string;
let workFloorName: string;

test.beforeAll(async ({ browser }) => {
  projectId = requireState((s) => s.project.projectId, 'project.projectId', 'Phase 2 (SCR-05)');
  workFloorId = requireState((s) => s.floors.workFloorId, 'floors.workFloorId', 'Phase 3 (SCR-09)');
  workFloorName = requireState((s) => s.floors.workFloorName, 'floors.workFloorName', 'Phase 3 (SCR-09)');
  requireState((s) => s.checkpoints.pipelineComplete, 'checkpoints.pipelineComplete (CP-5)', 'Phase 3 (SCR-12)');
  requireState((s) => s.checkpoints.restorableVersion, 'checkpoints.restorableVersion (CP-6)', 'Phase 4 (SCR-16)');

  context = await browser.newContext({ baseURL: readBaseUrl(), viewport: VIEWPORT });
  context.setDefaultTimeout(ACTION_TIMEOUT_MS);
  context.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
  page = await context.newPage();
  // Before the first goto: every /api/ response of the phase, body read on arrival.
  api = watchApi(page);
  await signInAdmin(page, ROUTES.project.rules(projectId));
});

test.afterAll(async () => {
  await context?.close();
});

/* ---- SCR-28 helpers ---- */

const rerunButton = (): Locator => page.getByRole('button', { name: 'Chạy kiểm tra lại', exact: true });
const levelFilter = (): Locator => page.getByRole('radiogroup', { name: 'Lọc theo mức độ', exact: true });
const donePanel = (): Locator => page.getByText('Không phát hiện vi phạm nào.', { exact: true });
/** Group expanders: `RuleReportSection` puts the toggle button inside an `<h3>`. */
const groupExpanders = (): Locator => page.getByRole('heading', { level: 3 }).getByRole('button');

/** Opens `/rules` and waits until the run has a result (`ready`/`partial` filter bar, or `done`). */
async function openRulesReport(): Promise<void> {
  if (pathnameOf(page) !== ROUTES.project.rules(projectId)) await page.goto(ROUTES.project.rules(projectId));
  await expect(page.getByRole('heading', { name: 'Kiểm tra luật không gian', level: 2 })).toBeVisible();
  await expect(rerunButton()).toBeEnabled();
  await expect(levelFilter().or(donePanel()).first()).toBeVisible();
}

/** Expands the first collapsed rule group; returns its `<section>`, or null when there is none. */
async function expandFirstRuleGroup(): Promise<Locator | null> {
  const index = await firstIndexWhere(groupExpanders(), 'aria-expanded', 'false');

  if (index === -1) return null;
  const expander = groupExpanders().nth(index);

  await expander.click();
  await expect(expander).toHaveAttribute('aria-expanded', 'true');
  return page.locator('section').filter({ has: expander });
}

async function pickSelectOption(combobox: Locator, option: string): Promise<void> {
  await combobox.click();
  await page.getByRole('option', { name: option, exact: true }).click();
  await expect(combobox).toContainText(option);
}

test.describe('SCR-28 Rule Report', () => {
  test('SCR-28 Rule Report — "Chạy kiểm tra lại" shows the four summary figures', async () => {
    await openRulesReport();
    await rerunButton().click();
    // The run is synchronous (`runRules`), so the spinner may not be observable; the result is.
    await expect(rerunButton()).toBeEnabled();
    for (const label of ['Tổng số kiểm tra', 'Đạt', 'Cảnh báo', 'Vi phạm']) {
      await expect(page.locator('dl dt').filter({ hasText: new RegExp(`^${label}$`, 'u') })).toBeVisible();
    }
    await captureEvidence(page, '28_rules_run.png');
  });

  test('SCR-28 Rule Report — filters, group expander, row opens ViolationDetail', async () => {
    await openRulesReport();

    if ((await levelFilter().count()) === 0) {
      // `done`: no violations, so `canFilter` is false and there are no rows (RuleReport.tsx).
      await expect(donePanel()).toBeVisible();
      test.info().annotations.push({ type: 'branch', description: 'done state: no filter bar, no rows to open' });
      await captureEvidence(page, '28_rules_filter.png');
      return;
    }

    const violation = levelFilter().getByRole('radio', { name: 'Vi phạm', exact: true });
    await violation.click();
    await expect(violation).toHaveAttribute('aria-checked', 'true');
    await expect(
      groupExpanders().first().or(page.getByText('Không có mục nào khớp bộ lọc đang đặt. Nới bộ lọc để xem thêm.')).first(),
    ).toBeVisible();

    const groupSelect = page.getByRole('combobox', { name: 'Nhóm luật', exact: true });
    await pickSelectOption(groupSelect, 'Hình học');

    const floorSelect = page.getByRole('combobox', { name: 'Tầng', exact: true });
    await floorSelect.click();
    const floorOptions = (await page.getByRole('option').allInnerTexts()).map((text) => text.trim());
    const floorChoice = floorOptions.find((text) => text !== 'Tất cả các tầng') ?? 'Tất cả các tầng';
    await page.getByRole('option', { name: floorChoice, exact: true }).click();
    await expect(floorSelect).toContainText(floorChoice);

    // Back to the unfiltered list so a group with rows exists.
    await pickSelectOption(floorSelect, 'Tất cả các tầng');
    await pickSelectOption(groupSelect, 'Tất cả nhóm luật');
    const all = levelFilter().getByRole('radio', { name: 'Tất cả', exact: true });
    await all.click();
    await expect(all).toHaveAttribute('aria-checked', 'true');

    const section = await expandFirstRuleGroup();
    if (section === null) {
      test.info().annotations.push({ type: 'branch', description: 'no collapsed rule group (no open rows)' });
      await captureEvidence(page, '28_rules_filter.png');
      return;
    }

    // ViolationDetail needs a floor (`RuleReport.container.tsx`: activeFloorId ?? row.levelId).
    const rows = section
      .getByRole('row')
      .filter({ has: page.getByRole('button', { name: 'Xem', exact: true }) })
      .filter({ hasNot: page.getByText('—', { exact: true }) });
    if ((await rows.count()) === 0) {
      test.info().annotations.push({ type: 'branch', description: 'expanded group has no row with a floor' });
      await captureEvidence(page, '28_rules_filter.png');
      return;
    }

    await rows.first().getByRole('button').first().click();
    const detail = page.getByRole('complementary', { name: 'Chi tiết vi phạm' });
    await expect(detail).toBeVisible();
    await captureEvidence(page, '28_rules_filter.png');
    await page.getByRole('button', { name: 'Đóng tấm trượt chi tiết vi phạm', exact: true }).click();
    await expect(detail).toHaveCount(0);
  });

  test('SCR-28 Rule Report — "Cài đặt bộ luật", "Xem", "Xác nhận đã xử lý" disabled state', async () => {
    await openRulesReport();

    const confirm = page.getByRole('button', { name: 'Xác nhận đã xử lý', exact: true });
    const violations = page
      .locator('dl > div')
      .filter({ has: page.locator('dt').filter({ hasText: /^Vi phạm$/u }) })
      .locator('dd');
    await expect(confirm).toBeVisible();
    if (await confirm.isDisabled()) {
      // Count-up animates from 0 to the real value (`useCountUp`).
      await expect(violations).not.toHaveText('0');
    } else {
      await expect(violations).toHaveText('0');
    }

    await page.getByRole('link', { name: 'Cài đặt bộ luật', exact: true }).click();
    await expect.poll(() => pathnameOf(page)).toBe(ROUTES.project.ruleSettings(projectId));

    await openRulesReport();
    const section = await expandFirstRuleGroup();
    if (section === null) {
      test.info().annotations.push({ type: 'branch', description: 'no rule rows: "Xem" not rendered' });
      await captureEvidence(page, '28_rules_nav.png');
      return;
    }
    await section.getByRole('button', { name: 'Xem', exact: true }).first().click();
    await expect.poll(() => pathnameOf(page)).toBe(ROUTES.project.viewer(projectId));
    await captureEvidence(page, '28_rules_nav.png');
  });
});

/* ---- SCR-29 ---- */

const ruleConfigPath = (): RegExp => new RegExp(`^/api/projects/${projectId}/rule-config$`, 'u');
const toastRegion = (): Locator => page.getByRole('region', { name: 'Thông báo', exact: true });
const restoreDefaults = (): Locator => page.getByRole('button', { name: 'Khôi phục mặc định', exact: true });

function expectVersionedBody(sent: unknown, what: string): void {
  const body = asRecord(sent, what);

  expect(typeof body.baseVersion, `${what}.baseVersion`).toBe('number');
  asRecord(body.body, `${what}.body`);
}

test.describe('SCR-29 Rule Settings', () => {
  test('SCR-29 Rule Settings — toggle a rule autosaves PUT rule-config with undo toast', async () => {
    await page.goto(ROUTES.project.ruleSettings(projectId));
    await expect(page.getByRole('heading', { name: 'Cài đặt bộ luật không gian', level: 2 })).toBeVisible();
    const toggle = page.getByRole('switch', { name: /^Bật hoặc tắt luật: /u }).first();
    await expect(toggle).toBeEnabled();
    const before = await toggle.getAttribute('aria-checked');

    const put = waitForApi(page, 'PUT', ruleConfigPath(), [200], AUTOSAVE_TIMEOUT_MS);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true');
    const { response } = await put;
    expectVersionedBody(response.request().postDataJSON(), 'PUT rule-config');

    await expect(toastRegion().getByRole('button', { name: 'Hoàn tác', exact: true }).first()).toBeVisible();
    await captureEvidence(page, '29_rulesettings_toggle.png');
  });

  test('SCR-29 Rule Settings — preset "văn phòng", then "Khôi phục mặc định"', async () => {
    const preset = page.getByRole('region', { name: 'Bộ luật sẵn', exact: true }).getByRole('button', { name: /^văn phòng/u });

    const presetPut = waitForApi(page, 'PUT', ruleConfigPath(), [200], AUTOSAVE_TIMEOUT_MS);
    await preset.click();
    expectVersionedBody((await presetPut).response.request().postDataJSON(), 'PUT rule-config (preset)');

    // Only renders when the config is not the default (RuleSettings.tsx showRestoreDefaults).
    await expect(restoreDefaults()).toBeVisible();
    const resetPut = waitForApi(page, 'PUT', ruleConfigPath(), [200], AUTOSAVE_TIMEOUT_MS);
    await restoreDefaults().click();
    expectVersionedBody((await resetPut).response.request().postDataJSON(), 'PUT rule-config (reset)');

    await expect(toastRegion()).toContainText('Đã trả bộ luật về mặc định.');
    await expect(restoreDefaults()).toHaveCount(0);
    await captureEvidence(page, '29_rulesettings_reset.png');
  });
});

/* ---- SCR-30 ---- */

const formatRadio = (extension: string): Locator =>
  page
    .getByRole('radiogroup', { name: 'Định dạng xuất', exact: true })
    .getByRole('radio', { name: new RegExp(`^${extension.replace('.', '\\.')}`, 'u') });
const exportButton = (): Locator => page.getByRole('button', { name: 'Xuất', exact: true });

async function selectFormat(extension: string): Promise<Locator> {
  const radio = formatRadio(extension);

  await radio.click();
  await expect(radio).toHaveAttribute('aria-checked', 'true');
  return radio;
}

test.describe('SCR-30 Export Panel', () => {
  test('SCR-30 Export Panel — .glb options, scope checkboxes, preflight', async () => {
    await page.goto(ROUTES.project.export(projectId));
    await expect(page.getByRole('radiogroup', { name: 'Định dạng xuất', exact: true })).toBeVisible();
    await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });

    await selectFormat('.glb');
    const optionsToggle = page.getByRole('button', { name: 'Tuỳ chọn', exact: true });
    if ((await optionsToggle.getAttribute('aria-expanded')) !== 'true') await optionsToggle.click();
    await expect(optionsToggle).toHaveAttribute('aria-expanded', 'true');
    // .glb body (ExportPanelOptions.tsx FormatOptionsBody).
    await expect(page.getByRole('radiogroup', { name: 'Mức độ chi tiết mô hình', exact: true })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Gồm đồ nội thất', exact: true })).toBeVisible();

    // Scope: toggle the work floor off and back on (local only).
    const scopeBox = page
      .getByRole('region', { name: 'Phạm vi', exact: true })
      .getByRole('checkbox', { name: workFloorName, exact: true });
    const wasChecked = await scopeBox.isChecked();
    await scopeBox.setChecked(!wasChecked);
    await expect(scopeBox).toBeChecked({ checked: !wasChecked });
    await scopeBox.setChecked(wasChecked);
    await expect(scopeBox).toBeChecked({ checked: wasChecked });

    await expect(page.getByRole('region', { name: 'Kiểm tra trước khi xuất', exact: true })).toBeVisible();
    await captureEvidence(page, '30_export_options.png');
  });

  test('SCR-30 Export Panel — .json "Xuất" downloads and lists "Tệp đã xuất"', async ({}, testInfo) => {
    await selectFormat('.json');
    await expect(page.getByRole('checkbox', { name: 'Gồm độ tin cậy từng đối tượng', exact: true })).toBeVisible();

    const downloadEvent = page.waitForEvent('download');
    await exportButton().click();
    const download = await downloadEvent;
    const fileName = download.suggestedFilename();
    expect(fileName, 'suggested file name').toMatch(/\.json$/u);
    // Saved under the test output dir, never into the repo.
    await download.saveAs(testInfo.outputPath(fileName));

    const history = page.getByRole('region', { name: 'Tệp đã xuất', exact: true });
    await expect(history).toBeVisible();
    await expect(history).toContainText(fileName);
    await captureEvidence(page, '30_export_json_done.png');
  });

  test('SCR-30 Export Panel — .pdf is not downloadable ("Chưa tải về được…")', async () => {
    const pdf = await selectFormat('.pdf');
    await expect(pdf).toContainText(PDF_BLOCKED_CAPTION);
    // `ExportPanelFooter`: canExportSelected=false removes "Xuất" from the DOM.
    await expect(exportButton()).toHaveCount(0);
    await captureEvidence(page, '30_export_pdf_unsupported.png');
  });
});

/* ---- SCR-31 ---- */

test.describe('SCR-31 Spatial JSON Viewer', () => {
  test('SCR-31 Spatial JSON Viewer — search, next match, expand, ArrowRight, preview, raw', async () => {
    await page.goto(ROUTES.project.data(projectId));
    const tree = page.getByRole('tree', { name: 'Cấu trúc dữ liệu không gian', exact: true });
    const items = tree.getByRole('treeitem');
    await expect(items.first()).toBeVisible();

    // A top-level key read from the tree itself: guaranteed ≥1 match.
    const term = (await items.first().locator('code').first().innerText()).trim();
    expect(term.length, 'first tree key').toBeGreaterThan(0);
    const search = page.getByRole('textbox', { name: 'Tìm theo khoá hoặc giá trị', exact: true });
    await search.fill(term);
    const matchLabel = page.getByText(MATCH_LABEL_PATTERN);
    await expect(matchLabel).toHaveText(POSITIVE_MATCH_PATTERN);
    await page.getByRole('button', { name: 'Kết quả sau', exact: true }).click();
    await expect(matchLabel).toHaveText(POSITIVE_MATCH_PATTERN);
    await search.fill('');
    await expect(matchLabel).toHaveCount(0);

    await page.getByRole('button', { name: 'Thu gọn tất cả', exact: true }).click();
    const collapsedCount = await items.count();
    await page.getByRole('button', { name: 'Mở rộng tất cả', exact: true }).click();
    await expect.poll(() => items.count()).toBeGreaterThan(collapsedCount);

    await page.getByRole('button', { name: 'Thu gọn tất cả', exact: true }).click();
    await expect.poll(() => items.count()).toBe(collapsedCount);
    const index = await firstIndexWhere(items, 'aria-expanded', 'false');
    expect(index, 'an expandable tree item').toBeGreaterThanOrEqual(0);
    const item = items.nth(index);
    await item.focus();
    await page.keyboard.press('ArrowRight');
    await expect(item).toHaveAttribute('aria-expanded', 'true');
    await item.click();
    await expect(item).toHaveAttribute('aria-selected', 'true');

    const tabs = page.getByRole('tablist', { name: 'Cách xem nội dung', exact: true });
    const previewTab = tabs.getByRole('tab', { name: 'Xem trước', exact: true });
    await previewTab.click();
    await expect(previewTab).toHaveAttribute('aria-selected', 'true');

    const raw = page.getByRole('radiogroup', { name: 'Cách hiện cấu trúc', exact: true }).getByRole('radio', { name: 'Thô', exact: true });
    await raw.click();
    await expect(raw).toHaveAttribute('aria-checked', 'true');
    // Raw mode forces the JSON tab (SpatialJsonViewer.tsx activeTabId).
    await expect(tabs.getByRole('tab', { name: 'JSON', exact: true })).toHaveAttribute('aria-selected', 'true');
    await captureEvidence(page, '31_json_tree.png');
  });
});

/* ---- SCR-32 ---- */

const versionsPath = (): RegExp => new RegExp(`^/api/projects/${projectId}/versions$`, 'u');
const versionList = (): Locator => page.getByRole('navigation', { name: 'Danh sách phiên bản', exact: true });
const layerPath = (): RegExp => new RegExp(`^/api/projects/${projectId}/floors/${workFloorId}/spatial/layer$`, 'u');

const isWorkFloorList = (entry: ApiEntry): boolean =>
  entry.method === 'GET' &&
  versionsPath().test(entry.path) &&
  entry.status === 200 &&
  new URLSearchParams(entry.search).get('floorId') === workFloorId;

/** Opens `/versions` (fresh: the default pair is restored) and selects `{work}`; waits for N17 200. */
async function openVersionsForWorkFloor(): Promise<void> {
  const mark = api.length;

  await page.goto(ROUTES.project.versions(projectId));
  const floorSelect = page.getByRole('combobox', { name: 'Tầng', exact: true });
  await expect(floorSelect).toBeVisible();
  await floorSelect.click();
  await page.getByRole('option', { name: workFloorName, exact: true }).click();
  await expect
    .poll(() => api.slice(mark).some(isWorkFloorList), { message: `no N17 200 for floor ${workFloorId}` })
    .toBe(true);
  await expect(versionList().getByRole('listitem').first()).toBeVisible();
}

async function uncheckAllVersions(): Promise<void> {
  const checked = versionList().getByRole('checkbox', { checked: true });

  // A pair holds at most two (versionHistoryCompare.ts togglePick).
  for (let round = 0; round < 2 && (await checked.count()) > 0; round += 1) {
    await checked.first().uncheck();
  }
  await expect(checked).toHaveCount(0);
}

/** `{ id, sequence }` of every work-floor version seen in N17 bodies so far. */
function knownVersions(): { id: string; sequence: number }[] {
  return api.filter(isWorkFloorList).flatMap((entry) => {
    const items = entry.json === undefined ? [] : asRecord(entry.json, 'N17').items;

    return Array.isArray(items)
      ? items.flatMap((item) => {
          const record = asRecord(item, 'N17 item');
          return typeof record.id === 'string' && typeof record.sequence === 'number'
            ? [{ id: record.id, sequence: record.sequence }]
            : [];
        })
      : [];
  });
}

test.describe('SCR-32 Version History', () => {
  test('SCR-32 Version History — floor, uncheck default pair, check two, tabs, "Xem thêm phiên bản"', async () => {
    await openVersionsForWorkFloor();

    await uncheckAllVersions();
    const free = versionList().getByRole('checkbox', { checked: false, disabled: false });
    await free.first().check();
    await free.first().check();
    await expect(versionList().getByRole('checkbox', { checked: true })).toHaveCount(2);

    const tabs = page.getByRole('tablist', { name: 'Cách xem khác biệt', exact: true });
    for (const label of ['Thay đổi', 'JSON', 'Trực quan']) {
      const tab = tabs.getByRole('tab', { name: label, exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('tabpanel', { name: label, exact: true })).toBeVisible();
    }
    await tabs.getByRole('tab', { name: 'Thay đổi', exact: true }).click();

    const more = page.getByRole('button', { name: 'Xem thêm phiên bản', exact: true });
    if ((await more.count()) > 0) {
      const nextPage = waitForApi(page, 'GET', versionsPath(), [200]);
      await more.click();
      const { response } = await nextPage;
      expect(new URL(response.url()).searchParams.get('cursor'), 'next page cursor').not.toBeNull();
    } else {
      test.info().annotations.push({ type: 'branch', description: '"Xem thêm phiên bản" not rendered (single page)' });
    }
    await captureEvidence(page, '32_versions_diff.png');
  });

  test('SCR-32 Version History — "Gắn nhãn phiên bản này" sends PATCH label', async () => {
    await page.getByRole('button', { name: 'Gắn nhãn phiên bản này', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const versionLabel = /Gắn nhãn phiên bản (v\d+)/u.exec(await dialog.innerText())?.[1];
    if (versionLabel === undefined) throw new Error('label dialog: cannot read the version label from its title');

    await dialog.getByRole('textbox', { name: 'Nhãn', exact: true }).fill('e2e');
    const patch = waitForApi(page, 'PATCH', new RegExp(`^/api/projects/${projectId}/versions/[^/]+/label$`, 'u'), [200]);
    await dialog.getByRole('button', { name: 'Gắn nhãn', exact: true }).click();
    const { response } = await patch;
    expect(asRecord(response.request().postDataJSON(), 'PATCH label').label).toBe('e2e');

    const row = versionList()
      .getByRole('listitem')
      .filter({ has: page.getByRole('checkbox', { name: `Chọn phiên bản ${versionLabel} để so sánh`, exact: true }) });
    await expect(row).toContainText('e2e');
    // F-09: no onToast on the route, so no "Đã gắn nhãn" toast.
    await expect(page.getByText('Đã gắn nhãn', { exact: true })).toHaveCount(0);
    await captureEvidence(page, '32_versions_label.png');
  });

  // R3: LAST test of the file — wipes every layer edit made after the chosen version.
  test('SCR-32 Version History — restore the AI version (first row without "Hiện tại")', async () => {
    await openVersionsForWorkFloor();

    /* Identify the row exactly as chain.fullstack.ts step 9 does. */
    const rows = versionList().getByRole('listitem');
    const target = rows.filter({ hasNotText: 'Hiện tại' }).first();
    const targetLabel = VERSION_CHECKBOX_PATTERN.exec((await target.getByRole('checkbox').getAttribute('aria-label')) ?? '')?.[1];
    if (targetLabel === undefined) throw new Error('cannot read the target version row label');

    const labels = (
      await rows.getByRole('checkbox').evaluateAll((boxes) => boxes.map((box) => box.getAttribute('aria-label') ?? ''))
    ).map((name) => VERSION_CHECKBOX_PATTERN.exec(name)?.[1] ?? '');
    const targetIndex = labels.indexOf(targetLabel);
    // Guard: never the oldest (pre-pipeline, possibly empty) row.
    if (targetIndex === -1 || targetIndex >= labels.length - 1) {
      throw new Error(
        `restore candidate ${targetLabel} is the last/oldest row (${String(targetIndex + 1)}/${String(labels.length)}): refusing to restore`,
      );
    }

    /* Make the target the pair's RIGHT (reviewed) version: target + an older full row. */
    await uncheckAllVersions();
    await target.getByRole('checkbox').check();
    const olderBoxes = rows.getByRole('checkbox');
    let olderIndex = -1;
    for (let index = labels.length - 1; index > targetIndex; index -= 1) {
      if (await olderBoxes.nth(index).isEnabled()) {
        olderIndex = index;
        break;
      }
    }
    if (olderIndex === -1) throw new Error(`no pickable version older than ${targetLabel} to pair with`);
    await olderBoxes.nth(olderIndex).check();

    /* The chosen version's content: its N18 snapshot, as the page fetched it. */
    const sequence = Number(targetLabel.slice(1));
    const targetId = knownVersions().find((version) => version.sequence === sequence)?.id;
    if (targetId === undefined) throw new Error(`no N17 item with sequence ${String(sequence)} (${targetLabel})`);
    const snapshotPath = `/api/projects/${projectId}/versions/${targetId}/snapshot`;
    await expect
      .poll(
        () => api.some((entry) => entry.method === 'GET' && entry.path === snapshotPath && entry.status === 200 && entry.json !== undefined),
        { message: `no N18 snapshot 200 for ${targetLabel} (${targetId})` },
      )
      .toBe(true);
    const snapshots = api.filter((entry) => entry.method === 'GET' && entry.path === snapshotPath && entry.status === 200);
    const snapshotWalls = wallsOf(snapshots[snapshots.length - 1]?.json, `N18 ${targetLabel}`);

    /* Restore, confirmed on the dialog title (chain step 9). */
    await page.getByRole('button', { name: 'Phục hồi phiên bản này', exact: true }).click();
    const restore = waitForApi(page, 'POST', /\/api\/projects\/[^/]+\/versions\/[^/]+\/restore$/u, [200]);
    const confirm = page.getByRole('dialog');
    const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    await expect(confirm).toContainText(
      new RegExp(`Phục hồi phiên bản ${escape(targetLabel)} của ${escape(workFloorName)}\\?`, 'u'),
    );
    await confirm.getByRole('button', { name: 'Phục hồi', exact: true }).click();
    const { response } = await restore;
    expect(new URL(response.url()).pathname).toBe(`/api/projects/${projectId}/versions/${targetId}/restore`);
    const restoreIndex = api.map((entry) => entry.method === 'POST' && entry.path.endsWith('/restore')).lastIndexOf(true);

    /* Walls now equal the chosen version's snapshot (registered after the new page commits). */
    const reread = await navigateThenWaitForApi(
      page,
      () => page.goto(ROUTES.project.walls(projectId, workFloorId), { waitUntil: 'commit' }),
      'GET',
      layerPath(),
      [200],
    );
    const restoredById = new Map(wallsOf(reread.json, 'N16 after restore').map((wall) => [String(wall.id), wall]));
    expect([...restoredById.keys()].sort(), 'wall ids after restore').toEqual(
      snapshotWalls.map((wall) => String(wall.id)).sort(),
    );
    const mismatches = snapshotWalls.flatMap((wall) => {
      const restored = restoredById.get(String(wall.id));
      const keys = Object.keys(wall);
      return restored !== undefined && pick(restored, keys) === pick(wall, keys) ? [] : [String(wall.id)];
    });
    expect(mismatches, 'walls differing from the restored snapshot').toEqual([]);

    await dismissTour(page);
    await expect(page.getByRole('listbox', { name: 'Danh sách đoạn tường', exact: true })).toBeVisible();
    await captureEvidence(page, '32_versions_restored.png');

    // No layer PUT after the restore (it would overwrite the restored content).
    const lateWrites = api.slice(restoreIndex + 1).filter((entry) => entry.method === 'PUT' && layerPath().test(entry.path));
    expect(lateWrites.map(describeEntry)).toEqual([]);
  });
});
