/**
 * Phase 6 main chain (QA-06b, pack P2): the FL-M-* flows of SCR-28 .. SCR-32 on ONE shared pipeline project
 * (flows-C1..C5 `phase06_pipeline.spec.ts` sections; seed `MP` of flows-C5). Admin, 1440x900.
 *
 * NOT serial (BUG-471): `beforeAll` seeds the project, every test opens its own route and reads no state a former test left,
 * except what the file order guarantees: one worker runs the file in order and FL-M-32-04 (restore, rewrites the floor's
 * layer) is the LAST test. FL-M-29-01 restores the default rule config at its end.
 *
 * Request budget (per worker; every failing test (e.g. flag 32-B-019 while its bug stands) restarts the worker and `beforeAll`
 * runs again): `POST /api/auth/login` 2 (`signedInApi` for fixtures + `signInAdmin`), `drawings_init` 1 (60 / 600 s per user),
 * one pipeline run (~70 s), 1 project, 1 #35 PUT, 1 DELETE, ALL repeated (1 + number of failing tests before the last one);
 * the tests themselves send PUT rule-config x3 (FL-M-29), PATCH label x2 and POST restore x1 (FL-M-32). No pool user.
 * Without `E2E_DRAWING_PNG` the whole file SKIPS with an "Environment:" reason.
 *
 * // S5-confirm: qcLayer yields >= 1 critical rule group with a row that has a floor (FL-M-28-01 needs it); the
 * // pipeline "before" version has an empty layer (FL-M-32-02 visual-tab copy).
 */
import { readFileSync } from 'node:fs';

import { expect, test, type APIRequestContext, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { TOUR_APPEAR_TIMEOUT_MS, dismissTour } from '../../e2e/fixtures/tour';
import { navigateThenWaitForApi, waitForApi, watchApi, type ApiEntry } from '../../e2e/fullstack/apiWatch';
import { ACTION_TIMEOUT_MS, AUTOSAVE_TIMEOUT_MS, NAVIGATION_TIMEOUT_MS, PIPELINE_TIMEOUT_MS, readBaseUrl } from '../../e2e/fullstack/env';
import { signedInApi } from './support/api';
import { readAdminCredentials, signInAdmin } from './support/auth';
import { deleteSeededProject } from './support/drawingSeed';
import { captureEvidence } from './support/evidence';
import { layerPathOf } from './support/layerSeed';
import {
  RR,
  VIEWPORT,
  asRecord,
  expandGroup,
  groupExpanders,
  layerRe,
  levelFilter,
  openRules,
  pathOf,
  requestsSince,
  ruleConfigRe,
  rowWithFloor,
  seedMainPipeline,
  settledInt,
  sheetOf,
  spatialRe,
  summaryValue,
  type Json,
} from './support/p06/P2';

test.describe.configure({ mode: 'default' });

const softly = expect.configure({ soft: true });

let context: BrowserContext;
let page: Page;
let api: ApiEntry[];
let fixtureApi: APIRequestContext | undefined;
let projectId = '';
let floorId = '';
let floorName = '';

test.beforeAll(async ({ browser }, testInfo) => {
  const drawing = process.env.E2E_DRAWING_PNG?.trim() ?? '';
  test.skip(drawing === '', 'Environment: E2E_DRAWING_PNG is not set (qa.config.json env.vars); versions only come from the pipeline');
  testInfo.setTimeout(PIPELINE_TIMEOUT_MS + 120_000);
  const { email, password } = readAdminCredentials();
  fixtureApi = await signedInApi(email, password);
  const seeded = await seedMainPipeline(fixtureApi, readFileSync(drawing));
  projectId = seeded.projectId;
  floorId = seeded.floorId;
  floorName = seeded.floorName;

  context = await browser.newContext({ baseURL: readBaseUrl(), viewport: VIEWPORT });
  context.setDefaultTimeout(ACTION_TIMEOUT_MS);
  context.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
  page = await context.newPage();
  api = watchApi(page);
  await signInAdmin(page, ROUTES.project.rules(projectId));
});

test.afterAll(async () => {
  try {
    if (fixtureApi !== undefined && projectId !== '') {
      const failed = await deleteSeededProject(fixtureApi, projectId);
      if (failed !== null) test.info().annotations.push({ type: 'cleanup', description: failed });
    }
  } finally {
    await fixtureApi?.dispose();
    await context?.close();
  }
});

/** Evidence `<prefix>_<row id>_<slug>.png`; one per step, names are unique per run. */
const shot = (prefix: string, id: string, slug: string): Promise<string> => captureEvidence(page, `${prefix}_${id}_${slug}.png`);

/* ======================================================================= SCR-28 */

test('SCR-28 · FL-M-28-01 · Report and sheet on the pipeline project (read-only)', async () => {
  let opened: Locator | undefined;

  await test.step('[28-A-001] open /rules: heading and trail', async () => {
    await openRules(page, projectId);
    await expect(page.getByRole('heading', { name: RR.heading, level: 2 })).toBeVisible();
    const trail = page.getByRole('navigation', { name: RR.trail, exact: true });
    await expect(trail.getByText('Dự án', { exact: true })).toBeVisible();
    await expect(trail.locator('[aria-current="page"]')).toHaveText(RR.heading);
    await shot('E06r', '28-A-001', 'deep_link');
  });

  await test.step('[28-A-003] four figures settle', async () => {
    for (const label of ['Tổng số kiểm tra', 'Đạt', 'Cảnh báo', 'Nghiêm trọng']) {
      await expect.soft(page.locator('dl dt').filter({ hasText: new RegExp(`^${label}$`, 'u') })).toBeVisible();
    }
    const [total, passed, warnings, violations] = [
      await settledInt(summaryValue(page, 'Tổng số kiểm tra')),
      await settledInt(summaryValue(page, 'Đạt')),
      await settledInt(summaryValue(page, 'Cảnh báo')),
      await settledInt(summaryValue(page, 'Nghiêm trọng')),
    ];
    // RuleReportSummary: all four count RULES, total = passed + warnings + violations (BUG-460).
    expect.soft(total, 'Tổng = Đạt + Cảnh báo + Nghiêm trọng').toBe(passed + warnings + violations);
    expect.soft(total, 'at least one rule ran').toBeGreaterThan(0);
    await shot('E06r', '28-A-003', 'figures');
  });

  await test.step('[28-A-007] first group header opens its table', async () => {
    const section = await expandGroup(page);
    opened = section;
    await expect.soft(section.getByRole('heading', { level: 3 }).getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    for (const name of RR.columns) await expect.soft(section.getByRole('columnheader', { name, exact: true })).toBeVisible();
    await expect.soft(section.getByRole('button', { name: RR.view, exact: true }).first()).toBeVisible();
    await shot('E06r', '28-A-007', 'group_open');
  });

  await test.step('[28V-A-001] row message opens the sheet', async () => {
    const section = opened;
    expect(section, 'the group opened in [28-A-007]').toBeDefined();
    if (section === undefined) return;
    const rows = rowWithFloor(page, section);
    await expect(rows.first()).toBeVisible(); // S5-confirm: the first group has a row with a floor
    await rows.first().getByRole('button').first().click();
    await expect.soft(sheetOf(page)).toBeVisible();
    await expect.soft(rows.first()).toHaveAttribute('aria-selected', 'true');
    await shot('E06r', '28V-A-001', 'sheet_open');
  });

  await test.step('[28V-A-022] close button hides the sheet, report stays', async () => {
    await page.getByRole('button', { name: RR.sheetClose, exact: true }).click();
    await expect.soft(sheetOf(page)).toHaveCount(0);
    await expect.soft(page.getByRole('heading', { name: RR.heading, level: 2 })).toBeVisible();
    await shot('E06r', '28V-A-022', 'sheet_closed');
  });

  await test.step('[28-A-020] "Cài đặt bộ luật" goes through the router (no reload)', async () => {
    await page.evaluate(() => {
      (window as unknown as { __p06Marker?: number }).__p06Marker = 1;
    });
    await page.getByRole('link', { name: RR.settingsLink, exact: true }).click();
    await softly.poll(() => pathOf(page)).toBe(ROUTES.project.ruleSettings(projectId));
    expect.soft(await page.evaluate(() => (window as unknown as { __p06Marker?: number }).__p06Marker), 'no document reload').toBe(1);
    await shot('E06r', '28-A-020', 'settings_link');
  });

  await test.step('[28-A-019] Back returns to the report', async () => {
    await page.goBack();
    await softly.poll(() => pathOf(page)).toBe(ROUTES.project.rules(projectId));
    await expect.soft(page.getByRole('heading', { name: RR.heading, level: 2 })).toBeVisible();
    await shot('E06r', '28-A-019', 'back_to_report');
  });

  await test.step('[28-A-017] "Xem" opens the 3D screen', async () => {
    const section = await expandGroup(page);
    await section.getByRole('button', { name: RR.view, exact: true }).first().click();
    await softly.poll(() => pathOf(page)).toBe(ROUTES.project.viewer(projectId));
    await shot('E06r', '28-A-017', 'view_3d');
  });
});

/* ======================================================================= SCR-29 */

const toastRegion = (): Locator => page.getByRole('region', { name: 'Thông báo', exact: true });
const lowerFirst = (text: string): string => text.charAt(0).toLocaleLowerCase('vi') + text.slice(1);
const WALL_THICKNESS_NAME = 'Bề dày tường nằm trong khoảng dựng được';

test('SCR-29 · FL-M-29-01 · admin mở cài đặt trên dự án pipeline, tắt một luật, áp Văn phòng, khôi phục mặc định', async () => {
  const putBody = (entry: { response: { request: () => { postDataJSON: () => unknown } } }, what: string): Json => {
    const sent = asRecord(entry.response.request().postDataJSON(), what);
    expect(typeof sent.baseVersion, `${what}.baseVersion`).toBe('number');
    return asRecord(sent.body, `${what}.body`);
  };

  await test.step('[29-A-001] open /rules/settings: heading and enabled count', async () => {
    await navigateThenWaitForApi(page, () => page.goto(ROUTES.project.ruleSettings(projectId), { waitUntil: 'commit' }), 'GET', ruleConfigRe(projectId), [200]);
    await expect(page.getByRole('heading', { name: 'Cài đặt bộ luật không gian', level: 2 })).toBeVisible();
    // 25 rules in the registry, 2 stood down by the function group -> 23 on (domain/rules/defaults.ts)
    await expect.soft(page.getByText('23/25 luật đang bật', { exact: true })).toBeVisible();
    await shot('E06s', '29-A-001', 'settings_open');
  });

  await test.step('[29-B-004] impact per rule equals the report item count', async () => {
    await expect(page.getByText(/^Đang ảnh hưởng [\d.]+ đối tượng$/u)).toHaveCount(25); // N15 applied: every row has its count
    const impacts = await page.evaluate(() =>
      [...document.querySelectorAll('p')]
        .map((p) => ({ match: /^Đang ảnh hưởng ([\d.]+) đối tượng$/u.exec(p.textContent?.trim() ?? ''), p }))
        .filter((item) => item.match !== null)
        .map((item) => ({
          count: Number((item.match as RegExpExecArray)[1]!.replace(/\./gu, '')),
          name: item.p.parentElement?.firstElementChild?.textContent?.trim() ?? '',
        })),
    );
    expect.soft(impacts.length, 'one impact line per rule row').toBe(25);
    const report = await context.newPage();
    try {
      await report.goto(ROUTES.project.rules(projectId));
      await expect(report.getByRole('heading', { name: RR.heading, level: 2 })).toBeVisible();
      await expect(levelFilter(report)).toBeVisible();
      const headers = await groupExpanders(report).allInnerTexts();
      for (const impact of impacts.filter((item) => item.count > 0)) {
        const header = headers.find((text) => text.includes(impact.name));
        expect.soft(header, `report group for "${impact.name}"`).toBeDefined();
        expect.soft(header ?? '', `"${impact.name}" counts ${String(impact.count)}`).toMatch(new RegExp(`(^|· )${String(impact.count)} mục`, 'u'));
      }
      // S5-confirm: a group header shows "<n> mục chưa xử lý" and nothing is resolved yet on this project
    } finally {
      await report.close();
    }
    await shot('E06s', '29-B-004', 'impact_counts');
  });

  await test.step('[29-A-003] switch the wall-thickness rule off: autosave PUT', async () => {
    const toggle = page.getByRole('switch', { name: `Bật hoặc tắt luật: ${lowerFirst(WALL_THICKNESS_NAME)}`, exact: true });
    await expect(toggle).toBeEnabled();
    const put = waitForApi(page, 'PUT', ruleConfigRe(projectId), [200], AUTOSAVE_TIMEOUT_MS);
    await toggle.click();
    await expect.soft(toggle).toHaveAttribute('aria-checked', 'false');
    const body = putBody(await put, 'PUT rule-config (switch)');
    expect.soft(asRecord(asRecord(body.overrides, 'overrides')['WALL-THICKNESS'], 'WALL-THICKNESS').enabled).toBe(false);
    await shot('E06s', '29-A-003', 'switch_off');
  });

  await test.step('[29-A-004] toast with undo', async () => {
    await expect.soft(toastRegion()).toContainText(`Tắt luật ${WALL_THICKNESS_NAME}.`);
    await expect.soft(toastRegion().getByRole('button', { name: 'Hoàn tác', exact: true }).first()).toBeVisible();
    await shot('E06s', '29-A-004', 'toast');
  });

  await test.step('[29-A-018] preset "Văn phòng"', async () => {
    const preset = page.getByRole('region', { name: 'Bộ luật sẵn', exact: true }).getByRole('button', { name: /^Văn phòng/u });
    const put = waitForApi(page, 'PUT', ruleConfigRe(projectId), [200], AUTOSAVE_TIMEOUT_MS);
    await preset.click(); // 29-A-003 switched WALL-THICKNESS off, so the preset flips it back too: diffPreset counts 4 (presets.ts:90-107, useRuleSettings.ts:1066)
    putBody(await put, 'PUT rule-config (preset)');
    await expect.soft(toastRegion()).toContainText('Áp bộ luật văn phòng: 4 luật đã đổi.');
    await shot('E06s', '29-A-018', 'preset_office');
  });

  await test.step('[29-A-022] "Khôi phục mặc định"', async () => {
    const restore = page.getByRole('button', { name: 'Khôi phục mặc định', exact: true });
    await expect(restore).toBeVisible();
    const put = waitForApi(page, 'PUT', ruleConfigRe(projectId), [200], AUTOSAVE_TIMEOUT_MS);
    await restore.click();
    const body = putBody(await put, 'PUT rule-config (reset)');
    expect.soft(body.overrides, 'overrides back to {}').toEqual({});
    await expect.soft(toastRegion()).toContainText('Đã trả bộ luật về mặc định.');
    await expect.soft(restore).toHaveCount(0);
    await shot('E06s', '29-A-022', 'reset_default');
  });
});

/* ======================================================================= SCR-30 */

const exportButton = (): Locator => page.getByRole('button', { name: 'Xuất', exact: true });
const formatRadio = (extension: string): Locator =>
  page
    .getByRole('radiogroup', { name: 'Định dạng xuất', exact: true })
    .getByRole('radio', { name: new RegExp(`^${extension.replace('.', '\\.')}`, 'u') });

test('SCR-30 · FL-M-30-01 · export the pipeline project: open, read, .json and .glb downloads', async ({}, testInfo) => {
  test.setTimeout(PIPELINE_TIMEOUT_MS + 120_000); // the .glb download may wait up to PIPELINE_TIMEOUT_MS
  let openMark = 0;
  let jsonMark = 0;

  await test.step('[30-A-001] deep link opens the panel', async () => {
    openMark = api.length;
    await page.goto(ROUTES.project.export(projectId));
    await expect(page.getByRole('radiogroup', { name: 'Định dạng xuất', exact: true })).toBeVisible();
    await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
    await expect(page.getByRole('heading', { name: 'Xuất bản vẽ' }).first()).toBeVisible();
    await expect(formatRadio('.glb')).toHaveAttribute('aria-checked', 'true');
    await shot('E06x', '30-A-001', 'panel_open');
  });

  await test.step('[30-G-001] gate read #24', async () => {
    await expect
      .poll(() => api.slice(openMark).some((entry) => entry.method === 'GET' && entry.path === `/api/projects/${projectId}` && entry.status === 200))
      .toBe(true);
    await expect.soft(page.getByRole('radiogroup', { name: 'Định dạng xuất', exact: true })).toBeVisible();
    await shot('E06x', '30-G-001', 'gate_read');
  });

  await test.step('[30-D-001] admin member can export', async () => {
    await expect.soft(exportButton()).toBeVisible();
    await expect.soft(exportButton()).toBeEnabled();
    await shot('E06x', '30-D-001', 'admin_export_button');
  });

  await test.step('[30-A-005] .json export downloads and lists the file', async () => {
    await formatRadio('.json').click();
    await expect(formatRadio('.json')).toHaveAttribute('aria-checked', 'true');
    jsonMark = api.length;
    const downloadEvent = page.waitForEvent('download');
    await exportButton().click();
    const download = await downloadEvent;
    const fileName = download.suggestedFilename();
    expect.soft(fileName, 'suggested file name').toMatch(/\.json$/u);
    await download.saveAs(testInfo.outputPath(fileName));
    const history = page.getByRole('region', { name: 'Tệp đã xuất', exact: true });
    await expect.soft(history).toContainText(fileName);
    await shot('E06x', '30-A-005', 'json_downloaded');
  });

  await test.step('[30-G-004] no request during the .json export', async () => {
    const sent = requestsSince(api, jsonMark).map((entry) => `${entry.method} ${entry.path}`);
    expect.soft(sent, 'a blob export sends nothing').toEqual([]);
    await shot('E06x', '30-G-004', 'no_request');
  });

  await test.step('[30-A-006] .glb export downloads and lists the file', async () => {
    await formatRadio('.glb').click();
    await expect(formatRadio('.glb')).toHaveAttribute('aria-checked', 'true');
    const glbMark = api.length;
    const downloadEvent = page.waitForEvent('download', { timeout: PIPELINE_TIMEOUT_MS });
    await exportButton().click();
    const download = await downloadEvent;
    const fileName = download.suggestedFilename();
    expect.soft(fileName, 'suggested file name').toMatch(/\.glb$/u);
    await download.saveAs(testInfo.outputPath(fileName));
    await expect.soft(page.getByRole('region', { name: 'Tệp đã xuất', exact: true })).toContainText(fileName);
    await expect.soft(page.getByRole('progressbar')).toHaveCount(0);
    expect.soft(requestsSince(api, glbMark).map((entry) => `${entry.method} ${entry.path}`), 'a .glb export sends nothing').toEqual([]);
    await shot('E06x', '30-A-006', 'glb_downloaded');
  });
});

/* ======================================================================= SCR-31 */

test('SCR-31 · FL-M-31-01 · data viewer on the shared pipeline project', async () => {
  const tree = (): Locator => page.getByRole('tree', { name: 'Cấu trúc dữ liệu không gian', exact: true });
  const items = (): Locator => tree().getByRole('treeitem');
  const search = (): Locator => page.getByRole('textbox', { name: 'Tìm theo khoá hoặc giá trị', exact: true });
  const matchLabel = (): Locator => page.getByText(/^\d[\d.]* \/ [\d.]+$/u);
  const tabs = (): Locator => page.getByRole('tablist', { name: 'Cách xem nội dung', exact: true });

  await test.step('[31-A-001] open /data: heading and tree', async () => {
    await page.goto(ROUTES.project.data(projectId));
    await expect(page.getByRole('heading', { name: 'Dữ liệu không gian', level: 1 })).toBeVisible();
    await expect(tree()).toBeVisible();
    await expect(items().first()).toBeVisible();
    await shot('E06d', '31-A-001', 'data_open');
  });

  await test.step('[31-A-004] click a row selects it and expands its ancestors', async () => {
    const root = items().first();
    await root.focus();
    await page.keyboard.press('ArrowRight');
    await expect(root).toHaveAttribute('aria-expanded', 'true');
    const child = tree().locator('[role="treeitem"][aria-level="2"]').first();
    await expect(child).toBeVisible();
    await child.click();
    await expect.soft(child).toHaveAttribute('aria-selected', 'true');
    await expect.soft(root).toHaveAttribute('aria-expanded', 'true');
    await shot('E06d', '31-A-004', 'row_selected');
  });

  await test.step('[31-A-009] search shows "i / n" and flashes the matching rows', async () => {
    // A repeated key (wall thicknessMm, ~10 rows): the first hit is auto-selected (bg-bg-selected), hits 2..n carry bg-bg-flash.
    await search().fill('thicknessMm');
    await expect.soft(matchLabel()).toHaveText(/^1 \/ (?:[2-9]|[1-9][\d.]+)$/u);
    await expect.soft(tree().locator('[role="treeitem"][class*="bg-bg-flash"]').first()).toBeVisible();
    await shot('E06d', '31-A-009', 'search_flash');
  });

  await test.step('[31-A-013] clearing the search removes the counter and the flash', async () => {
    await search().fill('');
    await expect.soft(matchLabel()).toHaveCount(0);
    await expect.soft(tree().locator('[role="treeitem"][class*="bg-bg-flash"]')).toHaveCount(0);
    await shot('E06d', '31-A-013', 'search_cleared');
  });

  await test.step('[31-A-015] "Thô" keeps the tree and pins the JSON tab', async () => {
    const raw = page.getByRole('radiogroup', { name: 'Cách hiện cấu trúc', exact: true }).getByRole('radio', { name: 'Thô', exact: true });
    await raw.click();
    await expect.soft(raw).toHaveAttribute('aria-checked', 'true');
    await expect.soft(tabs().getByRole('tab', { name: 'JSON', exact: true })).toHaveAttribute('aria-selected', 'true');
    await tabs().getByRole('tab', { name: 'Xem trước', exact: true }).click();
    await expect.soft(tabs().getByRole('tab', { name: 'JSON', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect.soft(tree()).toBeVisible();
    await shot('E06d', '31-A-015', 'raw_mode');
  });

  await test.step('[31-A-008] "Thu gọn tất cả" leaves the 9 root rows', async () => {
    await page.getByRole('button', { name: 'Thu gọn tất cả', exact: true }).click();
    await expect.soft(items()).toHaveCount(9);
    await expect.soft(tree().locator('[role="treeitem"][aria-level="1"]')).toHaveCount(9);
    await expect.soft(tree().locator('[role="treeitem"][aria-expanded="true"]')).toHaveCount(0);
    await shot('E06d', '31-A-008', 'collapsed_all');
  });
});

/* ======================================================================= SCR-32 */

const VH = {
  list: 'Danh sách phiên bản',
  checkbox: (label: string): string => `Chọn phiên bản ${label} để so sánh`,
  restoreCaption:
    'Phục hồi không xoá phiên bản nào: trạng thái hiện tại được giữ lại thành một phiên bản riêng, và bản phục hồi được thêm lên đầu danh sách',
  undoCleared: 'Riêng lịch sử hoàn tác (Ctrl+Z) của mọi tầng sẽ được xoá.',
  noPair: 'Chưa chọn đủ hai phiên bản để so sánh',
} as const;
const versionList = (): Locator => page.getByRole('navigation', { name: VH.list, exact: true });
const versionRow = (label: string): Locator => versionList().getByRole('listitem').filter({ has: page.getByRole('checkbox', { name: VH.checkbox(label), exact: true }) });
const versionsRe = (): RegExp => new RegExp(`^/api/projects/${projectId}/versions$`, 'u');
const diffTabs = (): Locator => page.getByRole('tablist', { name: 'Cách xem khác biệt', exact: true });
const isFloorList = (entry: ApiEntry): boolean =>
  entry.method === 'GET' &&
  versionsRe().test(entry.path) &&
  entry.status === 200 &&
  new URLSearchParams(entry.search).get('floorId') === floorId &&
  new URLSearchParams(entry.search).get('limit') === '50';

/** Opens `/versions` as a fresh document and waits until N17 of the work floor answered and the list paints. */
async function openVersions(): Promise<number> {
  const mark = api.length;
  await page.goto(ROUTES.project.versions(projectId));
  await expect(page.getByRole('heading', { name: 'Lịch sử phiên bản', level: 1 })).toBeVisible();
  await expect.poll(() => api.slice(mark).some(isFloorList), { message: `no N17 200 for floor ${floorId}` }).toBe(true);
  await expect(versionList().getByRole('listitem').first()).toBeVisible();
  return mark;
}

/** Opens a `Select` and returns ITS listbox (`aria-controls`). */
async function openSelect(combobox: Locator): Promise<Locator> {
  await combobox.click();
  await expect(combobox).toHaveAttribute('aria-expanded', 'true');
  const listbox = page.locator(`[id="${(await combobox.getAttribute('aria-controls')) ?? ''}"]`);
  await expect(listbox).toBeVisible();
  return listbox;
}

/** `{ id, sequence }` of the work-floor versions in the N17 bodies seen so far, newest first. */
function knownVersions(): { id: string; sequence: number }[] {
  const seen = new Map<string, number>();
  for (const entry of api.filter(isFloorList)) {
    const items = entry.json === undefined ? [] : asRecord(entry.json, 'N17').items;
    if (Array.isArray(items)) for (const item of items) seen.set(String(asRecord(item, 'N17 item').id), Number(asRecord(item, 'N17 item').sequence));
  }
  return [...seen].map(([id, sequence]) => ({ id, sequence })).sort((a, b) => b.sequence - a.sequence);
}
const snapshotEntries = (): ApiEntry[] =>
  api.filter((entry) => entry.method === 'GET' && new RegExp(`^/api/projects/${projectId}/versions/[^/]+/snapshot$`, 'u').test(entry.path) && entry.status === 200 && entry.json !== undefined);

test('SCR-32 · FL-M-32-01 · open the AI floor: requests, rows, default pair, counts, "Thay đổi"', async () => {
  let mark = 0;

  await test.step('[32-A-001] deep link /versions: N17 for the resolved floor, heading painted', async () => {
    mark = await openVersions();
    const list = api.slice(mark).find(isFloorList);
    expect.soft(list, 'GET versions?floorId=<floor>&limit=50 -> 200').toBeDefined();
    await shot('E06v', '32-A-001', 'deep_link');
  });

  await test.step('[32-G-001] gate read #24 before the list', async () => {
    const gate = api.slice(mark).findIndex((entry) => entry.method === 'GET' && entry.path === `/api/projects/${projectId}` && entry.status === 200);
    const list = api.slice(mark).findIndex(isFloorList);
    expect.soft(gate, 'GET /api/projects/:id answered 200').toBeGreaterThanOrEqual(0);
    expect.soft(gate, 'gate before the version list').toBeLessThan(list);
    await shot('E06v', '32-G-001', 'gate_project');
  });

  await test.step('[32-G-002] gate read N15 feeds the store', async () => {
    const spatial = api.slice(mark).find((entry) => entry.method === 'GET' && spatialRe(projectId).test(entry.path));
    expect.soft(spatial?.status, 'GET /spatial 200').toBe(200);
    await expect.soft(versionList().getByRole('listitem').first()).toBeVisible();
    await shot('E06v', '32-G-002', 'gate_spatial');
  });

  await test.step('[32-G-003] N17 shape: descending, item keys', async () => {
    await expect.poll(() => api.slice(mark).find(isFloorList)?.json !== undefined, { message: 'N17 body read' }).toBe(true);
    const body = asRecord(api.slice(mark).find(isFloorList)?.json, 'N17');
    const items = (Array.isArray(body.items) ? body.items : []).map((item) => asRecord(item, 'N17 item'));
    expect.soft(items.length, 'at least the pipeline before + after').toBeGreaterThanOrEqual(2);
    expect.soft(items.map((item) => Number(item.sequence))).toEqual([...items.map((item) => Number(item.sequence))].sort((a, b) => b - a));
    for (const key of ['id', 'sequence', 'floorRevision', 'createdAt', 'creatorId', 'creatorName', 'hasSnapshot']) {
      for (const item of items) expect.soft(item, `item has ${key}`).toHaveProperty(key);
    }
    await shot('E06v', '32-G-003', 'n17_shape');
  });

  await test.step('[32-G-005] N18 snapshots of the picked pair', async () => {
    await expect.poll(() => snapshotEntries().length).toBeGreaterThanOrEqual(2);
    for (const entry of snapshotEntries().slice(-10)) {
      const snapshot = asRecord(entry.json, 'N18');
      for (const key of ['dimensions', 'layer', 'versionId']) expect.soft(snapshot, `N18 has ${key}`).toHaveProperty(key);
    }
    await shot('E06v', '32-G-005', 'n18_shape');
  });

  await test.step('[32-A-007] default pair = the two newest versions with content', async () => {
    await expect.soft(page.getByRole('checkbox', { name: VH.checkbox('v1'), exact: true })).toBeChecked();
    await expect.soft(page.getByRole('checkbox', { name: VH.checkbox('v2'), exact: true })).toBeChecked();
    await expect.soft(page.getByRole('combobox', { name: 'Phiên bản gốc', exact: true })).toContainText(/^v1 ·/u);
    await expect.soft(page.getByRole('combobox', { name: 'Phiên bản đối chiếu', exact: true })).toContainText(/^v2 ·/u);
    await shot('E06v', '32-A-007', 'default_pair');
  });

  await test.step('[32-C-014] diff sentences are plain Vietnamese', async () => {
    const panel = page.getByRole('tabpanel', { name: 'Thay đổi', exact: true });
    await expect(panel.locator('li').first()).toBeVisible();
    const sentences = await panel.locator('li').allInnerTexts();
    expect.soft(sentences.length, 'diff rows').toBeGreaterThan(0);
    // semantic.ts formatChange: "Thêm <nhãn> <mã>", "Xoá <nhãn> <mã>", "<Nhãn> <mã> <phrase> a → b", "<Nhãn> <mã> đổi <trường> từ a sang b"
    for (const sentence of sentences) expect.soft(sentence.trim(), 'a plain sentence').toMatch(/^(Thêm |Xoá )|→| đổi .+ từ .+ sang /u);
    await shot('E06v', '32-C-014', 'diff_sentences');
  });

  await test.step('[32-C-016] groups by kind with a heading and a count', async () => {
    const panel = page.getByRole('tabpanel', { name: 'Thay đổi', exact: true });
    const groups = panel.locator('section[aria-label$="thay đổi"]');
    await expect(groups.first()).toBeVisible();
    expect.soft(await groups.count(), 'at least one group').toBeGreaterThan(0);
    for (const group of await groups.all()) {
      const label = (await group.getAttribute('aria-label')) ?? '';
      expect.soft(label).toMatch(/^(Kích thước|Cửa đi|Nội thất|Phòng|Điểm|Tường|Cửa sổ) — [\d.]+ thay đổi$/u);
      const count = Number(/— ([\d.]+) thay đổi$/u.exec(label)?.[1]?.replace(/\./gu, '') ?? NaN);
      await expect.soft(group.locator('li')).toHaveCount(count);
      await expect.soft(group.locator('h4')).toContainText('thay đổi');
    }
    await shot('E06v', '32-C-016', 'groups');
  });

  await test.step('[32-C-017] totals chips and the status sentence', async () => {
    // the row dots of the version list print the same labels: scope everything to the compare region (COMPARE_LABEL)
    const compare = page.getByRole('region', { name: 'Vùng so sánh hai phiên bản', exact: true });
    const status = compare.getByRole('status').filter({ hasText: /^Thêm [\d.]+, xoá [\d.]+, thay đổi [\d.]+$/u });
    await expect(status).toHaveCount(1);
    const [, added, removed, changed] = /^Thêm ([\d.]+), xoá ([\d.]+), thay đổi ([\d.]+)$/u.exec((await status.innerText()).trim()) ?? [];
    expect.soft(added, 'status sentence parsed').toBeDefined();
    await expect.soft(compare.getByText(`+${String(added)}`, { exact: true })).toBeVisible(); // after the count-up
    await expect.soft(compare.getByText(`−${String(removed)}`, { exact: true })).toBeVisible(); // U+2212
    await expect.soft(compare.getByText(`~${String(changed)}`, { exact: true })).toBeVisible();
    const total = [added, removed, changed].reduce((sum, value) => sum + Number(String(value).replace(/\./gu, '')), 0);
    await expect.soft(compare.getByRole('tabpanel', { name: 'Thay đổi', exact: true }).locator('li')).toHaveCount(total);
    await shot('E06v', '32-C-017', 'totals');
  });
});

test('SCR-32 · FL-M-32-02 · tabs JSON / Trực quan, visual unavailable copy, unticking and Selects', async () => {
  await test.step('[32-A-014] tabs select and show their panel', async () => {
    await openVersions();
    for (const label of ['JSON', 'Trực quan', 'Thay đổi']) {
      const tab = diffTabs().getByRole('tab', { name: label, exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('tabpanel', { name: label, exact: true })).toBeVisible();
      for (const other of ['JSON', 'Trực quan', 'Thay đổi'].filter((name) => name !== label)) {
        await expect.soft(page.getByRole('tabpanel', { name: other, exact: true })).toBeHidden();
      }
    }
    await shot('E06v', '32-A-014', 'tabs');
  });

  await test.step('[32-C-018] JSON tab: heading line per tone, one JSON line per entry', async () => {
    await diffTabs().getByRole('tab', { name: 'JSON', exact: true }).click();
    const panel = page.getByRole('tabpanel', { name: 'JSON', exact: true });
    await expect(panel.locator('li').first()).toBeVisible();
    const lines = (await panel.locator('li').allInnerTexts()).map((text) => text.trim());
    expect.soft(lines.length).toBeGreaterThan(0);
    const headings = lines.filter((line) => line.startsWith('— '));
    expect.soft(headings.length, 'at least one tone heading').toBeGreaterThan(0);
    for (const heading of headings) expect.soft(['— Đã thêm', '— Đã xoá', '— Đã thay đổi']).toContain(heading);
    for (const line of lines.filter((entry) => !entry.startsWith('— '))) expect.soft(() => JSON.parse(line) as unknown, 'one JSON entry per line').not.toThrow();
    await shot('E06v', '32-C-018', 'json_lines');
  });

  await test.step('[32-A-008] unticking one version drops to the "no pair" sentence', async () => {
    await diffTabs().getByRole('tab', { name: 'Thay đổi', exact: true }).click();
    // The input is sr-only under the drawn box; click its label like a user would (Checkbox.tsx wraps it in <label for>).
    const v1Box = page.getByRole('checkbox', { name: VH.checkbox('v1'), exact: true });
    await versionList().locator('label').filter({ has: v1Box }).click();
    await expect.soft(v1Box).not.toBeChecked();
    await expect.soft(page.getByText(VH.noPair, { exact: true })).toBeVisible();
    await expect.soft(versionList().getByRole('checkbox', { checked: true })).toHaveCount(1);
    await expect.soft(page.getByRole('combobox', { name: 'Phiên bản gốc', exact: true })).toHaveCount(0);
    await expect.soft(diffTabs()).toHaveCount(0);
    await shot('E06v', '32-A-008', 'untick_one');
  });

});

test('SCR-32 · FL-M-32-03 · label the newest version, toast, undo', async () => {
  const labelPatch = (): Promise<{ response: { request: () => { postDataJSON: () => unknown }; status: () => number }; json: unknown }> =>
    waitForApi(page, 'PATCH', new RegExp(`^/api/projects/${projectId}/versions/[^/]+/label$`, 'u'), [200]);
  const labelToast = (): Locator => page.getByRole('status').filter({ hasText: 'Đã gắn nhãn' });
  let lastPatch: Awaited<ReturnType<typeof labelPatch>> | undefined;

  await test.step('[32-A-019] "Gắn nhãn phiên bản này" opens the label dialog', async () => {
    await openVersions();
    await page.getByRole('button', { name: 'Gắn nhãn phiên bản này', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Gắn nhãn phiên bản v2');
    await expect.soft(dialog.getByRole('textbox', { name: 'Nhãn', exact: true })).toBeVisible();
    await expect.soft(dialog).toContainText('Để trống rồi bấm Gắn nhãn là gỡ nhãn.');
    await expect.soft(dialog.getByRole('button', { name: 'Huỷ', exact: true })).toBeVisible();
    await expect.soft(dialog.getByRole('button', { name: 'Gắn nhãn', exact: true })).toBeVisible();
    await shot('E06v', '32-A-019', 'label_dialog');
  });

  await test.step('[32-A-020] submit a label: PATCH, badge, toast', async () => {
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'Nhãn', exact: true }).fill('e2e');
    const patch = labelPatch();
    await dialog.getByRole('button', { name: 'Gắn nhãn', exact: true }).click();
    const done = await patch;
    expect.soft(asRecord(done.response.request().postDataJSON(), 'PATCH label')).toEqual({ label: 'e2e' });
    await expect.soft(versionRow('v2')).toContainText('e2e');
    await expect.soft(labelToast()).toBeVisible();
    await shot('E06v', '32-A-020', 'label_saved');
  });

  await test.step('[32-A-021] toast "Hoàn tác" sends the previous (empty) label', async () => {
    const patch = labelPatch();
    await labelToast().getByRole('button', { name: 'Hoàn tác', exact: true }).click();
    const done = await patch;
    expect.soft(asRecord(done.response.request().postDataJSON(), 'PATCH label (undo)')).toEqual({ label: '' });
    await expect.soft(versionRow('v2')).not.toContainText('e2e');
    await expect.soft(labelToast(), 'no second toast after the undo').toHaveCount(0);
    await shot('E06v', '32-A-021', 'label_undone');
  });

  await test.step('[32-C-010] a label shows as a neutral badge', async () => {
    await page.getByRole('button', { name: 'Gắn nhãn phiên bản này', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'Nhãn', exact: true }).fill('e2e');
    const patch = labelPatch();
    await dialog.getByRole('button', { name: 'Gắn nhãn', exact: true }).click();
    lastPatch = await patch;
    const badge = versionRow('v2').getByText('e2e', { exact: true });
    await expect.soft(badge).toBeVisible();
    expect.soft((await badge.innerText()).length, 'label <= 60 chars').toBeLessThanOrEqual(60);
    await shot('E06v', '32-C-010', 'label_badge');
  });

  await test.step('[32-D-001] admin sees the label and restore actions', async () => {
    await expect.soft(page.getByRole('button', { name: 'Gắn nhãn phiên bản này', exact: true })).toBeVisible();
    await expect.soft(page.getByRole('button', { name: 'Phục hồi phiên bản này', exact: true })).toBeVisible();
    await shot('E06v', '32-D-001', 'admin_actions');
  });

  await test.step('[32-G-011] N20 PATCH label: body only {label}, 200 summary with label', async () => {
    expect(lastPatch, 'the PATCH of step [32-C-010]').toBeDefined();
    expect.soft(Object.keys(asRecord(lastPatch?.response.request().postDataJSON(), 'PATCH label'))).toEqual(['label']);
    expect.soft(lastPatch?.response.status()).toBe(200);
    expect.soft(asRecord(lastPatch?.json, 'N20 summary').label).toBe('e2e');
    await shot('E06v', '32-G-011', 'n20_shape');
  });
});

// LAST test of the file: the restore rewrites the floor layer every earlier test (and C1..C4 screens) read.
test('SCR-32 · FL-M-32-04 · restore the AI version (LAST test of the file)', async () => {
  const restoreRe = new RegExp(`^/api/projects/${projectId}/versions/[^/]+/restore$`, 'u');
  const restoreButton = (): Locator => page.getByRole('button', { name: 'Phục hồi phiên bản này', exact: true });
  const dialog = (): Locator => page.getByRole('dialog');
  const postsSince = (mark: number): ApiEntry[] => api.slice(mark).filter((entry) => entry.method === 'POST' && restoreRe.test(entry.path));
  let mark = 0;
  let restoreEntryIndex = -1;
  let focusAfter = '';
  let targetId = '';
  let snapshotWalls: Json[] = [];

  await test.step('[32-A-028] "Phục hồi phiên bản này" opens the confirm dialog', async () => {
    mark = await openVersions();
    targetId = knownVersions().find((version) => version.sequence === 2)?.id ?? '';
    expect(targetId, 'N17 item v2').not.toBe('');
    await expect.poll(() => snapshotEntries().some((entry) => entry.path.includes(targetId))).toBe(true);
    const snapshot = snapshotEntries().filter((entry) => entry.path.includes(targetId)).pop();
    const walls = asRecord(asRecord(snapshot?.json, 'N18 v2').layer, 'N18 v2.layer').walls;
    snapshotWalls = (Array.isArray(walls) ? walls : []).map((wall) => asRecord(wall, 'wall'));
    await restoreButton().click();
    await expect(dialog()).toContainText(`Phục hồi phiên bản v2 của ${floorName}?`);
    await expect.soft(dialog()).toContainText(`${VH.restoreCaption}. ${VH.undoCleared}`);
    await expect.soft(dialog().getByRole('button', { name: 'Để nguyên', exact: true })).toBeVisible();
    await expect.soft(dialog().getByRole('button', { name: 'Phục hồi', exact: true })).toBeVisible();
    await shot('E06v', '32-A-028', 'confirm_dialog');
  });

  await test.step('[32-A-029] "Để nguyên" closes the dialog, nothing sent', async () => {
    await dialog().getByRole('button', { name: 'Để nguyên', exact: true }).click();
    await expect.soft(dialog()).toHaveCount(0);
    expect.soft(postsSince(mark).length, 'no POST restore').toBe(0);
    await shot('E06v', '32-A-029', 'keep_as_is');
  });

  await test.step('[32-A-030] Esc and "Đóng hộp thoại" close it, nothing sent', async () => {
    await restoreButton().click();
    await expect(dialog()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect.soft(dialog()).toHaveCount(0);
    await restoreButton().click();
    await dialog().getByRole('button', { name: 'Đóng hộp thoại', exact: true }).click();
    await expect.soft(dialog()).toHaveCount(0);
    expect.soft(postsSince(mark).length, 'still no POST restore').toBe(0);
    await shot('E06v', '32-A-030', 'esc_and_close');
  });

  await test.step('[32-A-031] "Phục hồi" posts the restore with the floor revision', async () => {
    const layerRead = await fixtureApi!.get(layerPathOf(projectId, floorId));
    const revision = Number(asRecord(await layerRead.json(), 'N16').revision);
    await restoreButton().click();
    await expect(dialog()).toBeVisible();
    const restore = waitForApi(page, 'POST', restoreRe, [201]);
    await dialog().getByRole('button', { name: 'Phục hồi', exact: true }).click();
    const { response } = await restore;
    expect(new URL(response.url()).pathname).toBe(`/api/projects/${projectId}/versions/${targetId}/restore`);
    restoreEntryIndex = api.map((entry) => entry.method === 'POST' && restoreRe.test(entry.path)).lastIndexOf(true);
    const sent = asRecord(response.request().postDataJSON(), 'POST restore');
    // client.ts:1469 always sends { baseVersion, body: { floorId } }; BE VersionRestoreIn requires base_version
    expect.soft(sent, 'restore wire body').toEqual({ baseVersion: revision, body: { floorId } });
    await expect.soft(dialog(), 'dialog closes at once').toHaveCount(0);
    expect.soft(postsSince(mark).length, 'exactly one restore POST in the test').toBe(1);
    await shot('E06v', '32-A-031', 'restore_posted');
  });

  await test.step('[32-G-008] N19 summary of the "after" version', async () => {
    await expect.poll(() => api[restoreEntryIndex]?.json !== undefined, { message: 'N19 body read' }).toBe(true);
    const entry = api[restoreEntryIndex];
    expect.soft(entry?.status).toBe(201);
    const summary = asRecord(entry?.json, 'N19 summary');
    for (const key of ['id', 'sequence', 'floorRevision', 'hasSnapshot']) expect.soft(summary, `N19 summary has ${key}`).toHaveProperty(key);
    await shot('E06v', '32-G-008', 'n19_shape');
  });

  await test.step('[32-A-033] the list refetches: v3 (before) and v4 (after, "Hiện tại")', async () => {
    await expect(versionRow('v4')).toBeVisible();
    await expect.soft(versionRow('v3')).toContainText('trạng thái trước khi phục hồi phiên bản v2');
    await expect.soft(versionRow('v4')).toContainText('phục hồi nội dung của phiên bản v2');
    await expect.soft(versionRow('v4')).toContainText('Hiện tại');
    focusAfter = await page.evaluate(() => {
      const active = document.activeElement;
      return active === null || active === document.body ? 'body' : `${active.tagName.toLowerCase()}:${active.getAttribute('aria-label') ?? active.textContent?.trim().slice(0, 40) ?? ''}`;
    });
    await shot('E06v', '32-A-033', 'new_rows');
  });

  // Moved from FL-M-32-02 (S4 review): with only v1 + v2 holding content the pair {v2, v2} never swaps (orderPair keeps equal
  // pairs). After the restore v3 / v4 exist, so a newer-left pick is a real swap. Plan order deviates on purpose.
  await test.step('[32-A-011] "Phiên bản gốc" Select: a newer left version swaps so the older stays left', async () => {
    const left = page.getByRole('combobox', { name: 'Phiên bản gốc', exact: true });
    const right = page.getByRole('combobox', { name: 'Phiên bản đối chiếu', exact: true });
    const compare = page.getByRole('region', { name: 'Vùng so sánh hai phiên bản', exact: true });
    await expect(left).toBeVisible();
    const rightList = await openSelect(right);
    await rightList.getByRole('option', { name: /^v2 ·/u }).click();
    await expect(rightList).toHaveCount(0);
    const leftList = await openSelect(left);
    await leftList.getByRole('option', { name: /^v3 ·/u }).click();
    await expect(leftList).toHaveCount(0);
    // S5-confirm: the displayed pair is ordered (orderPair) once left (v3) is newer than right (v2). v4 == v2 after the restore
    // (empty diff), so v3 is the newer version that still differs from v2.
    await expect.soft(left).toContainText(/^v2 ·/u);
    await expect.soft(right).toContainText(/^v3 ·/u);
    await expect.soft(versionList().getByRole('checkbox', { checked: true })).toHaveCount(2);
    await expect.soft(compare.getByRole('status').filter({ hasText: /^Thêm [\d.]+, xoá [\d.]+, thay đổi [\d.]+$/u })).toHaveCount(1);
    await shot('E06v', '32-A-011', 'left_select');
  });

  await test.step('[32-A-034] walls equal the restored snapshot, no layer PUT follows', async () => {
    const reread = await navigateThenWaitForApi(page, () => page.goto(ROUTES.project.walls(projectId, floorId), { waitUntil: 'commit' }), 'GET', layerRe(projectId), [200]);
    const restored = new Map(
      (Array.isArray(asRecord(asRecord(reread.json, 'N16').layer ?? reread.json, 'N16 layer').walls) ? (asRecord(asRecord(reread.json, 'N16').layer ?? reread.json, 'N16 layer').walls as unknown[]) : []).map((wall) => [String(asRecord(wall, 'wall').id), asRecord(wall, 'wall')]),
    );
    expect.soft([...restored.keys()].sort(), 'wall ids after restore').toEqual(snapshotWalls.map((wall) => String(wall.id)).sort());
    const mismatches = snapshotWalls.flatMap((wall) => {
      const now = restored.get(String(wall.id));
      return now !== undefined && Object.keys(wall).every((key) => JSON.stringify(now[key]) === JSON.stringify(wall[key])) ? [] : [String(wall.id)];
    });
    expect.soft(mismatches, 'walls differing from the restored snapshot').toEqual([]);
    await dismissTour(page);
    await expect(page.getByRole('listbox', { name: 'Danh sách đoạn tường', exact: true })).toBeVisible();
    const lateWrites = api.slice(restoreEntryIndex + 1).filter((entry) => entry.method === 'PUT' && layerRe(projectId).test(entry.path));
    expect.soft(lateWrites.map((entry) => `${entry.method} ${entry.path}`), 'no layer PUT after the restore').toEqual([]);
    await shot('E06v', '32-A-034', 'walls_restored');
  });

  await test.step('[32-E-014] ⚑ focus is not lost to the page body after the restore', async () => {
    expect.soft(focusAfter, 'focus after the confirmed restore (measured once the list refetched)').not.toBe('body');
    await shot('E06v', '32-E-014', 'focus_after_restore');
  });
});
