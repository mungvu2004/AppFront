/**
 * Phase 3 — SCR-12 processing, real sequential flows (QA-03d P8; plan `flow-plan.md` "phase03_processing_edge.spec.ts").
 * One `test()` per flow, one `test.step('[<row id>] …')` per catalog row in the user's order. `H` rows hard `expect`,
 * `S` rows `expect.soft`; `ev` rows capture `E03_<row id>_<slug>.png`. Copy and helpers: `support/p03/P8.ts`.
 *
 * Source @ c16f2428 (src/screens/pipeline/): PR ProcessingScreen/ProcessingScreen.tsx · UPR …/useProcessingScreen.ts ·
 * PRG …/processingGateway.ts · PSL …/ProcessingStepList.tsx · PSB …/ProcessingStepBar.tsx · PLP …/ProcessingLogPanel.tsx ·
 * PFC …/ProcessingFloorChips.tsx · PSU …/ProcessingSummary.tsx · TABS src/components/ui/Tabs.tsx.
 *
 * Data: every project is own and run-unique (`qa-<runId>-12-…`), owned by the pool engineer of slot `p8-processing`
 * (own `drawings_init` bucket) and deleted in `finally`; FL-12-01 uses the main admin (no upload). FL-12-03 and
 * FL-12-04 share one finished run (S3) made in `beforeAll` of their describe. No pool user changes state, no shared
 * file is written: safe beside other spec files under `--workers 4`.
 *
 * Mocks: none. "Running" moments (FL-12-07 re-run reset) are a HELD real request (`holdFirst`: delay, then continue),
 * because a fake-ML run ends ~0.5 s after #7.
 *
 * Request budget per full file run (QA stack limits, `qa-limits.override.yml`):
 * - `POST /api/auth/login` (120 / 60 s per IP): 3 per flow (main admin, owner API, browser) + 2 in the S3 beforeAll ≈ 23.
 * - `POST /api/users/invitations` (30 / 3600 s per admin): 0 when the pool file holds `engineer:p8-processing`, else 1.
 * - `POST …/drawings/uploads` (drawings_init 300 / 600 s per user): 1 (FL-12-02) + 1 (S3) + 1 (FL-12-05) + 6 (FL-12-06)
 *   + 2 (FL-12-07) = 11 for `engineer:p8-processing` → 11 fake-ML runs; 1 straighten (#32) re-run.
 * - `POST /api/projects`: 7, each deleted. `PUT …/settings`: 2 (FL-12-05). `PUT …/spatial/layer`: ≤ 1 (FL-12-05).
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { dismissTour, TOUR_APPEAR_TIMEOUT_MS } from '../../e2e/fixtures/tour';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { PIPELINE_TIMEOUT_MS } from '../../e2e/fullstack/env';
import { displayCodesOf } from '../../src/domain/spatial/ids';
import { formatNumber } from '../../src/lib/format/number';
import { signedInApi } from './support/api';
import { attachJson, captureEvidence } from './support/evidence';
import {
  createDrawingProject,
  createPipelineDrawingProject,
  createProject,
  deleteSeededProject,
  envDrawingPng,
  poolUser,
  rotatedPng,
  SKEW_DEG,
  uploadDrawing,
  waitForQualityFindings,
  waitForRunOutcome,
  type PoolUser,
} from './support/phase03Seed';
import {
  BACK_TO_PROJECTS,
  COMPACT,
  doneLine,
  flow,
  focusRingShown,
  holdFirst,
  horizontalOverflow,
  mainAdminApi,
  metricLabelsOf,
  NOT_FOUND_SENTENCE,
  NOT_FOUND_TITLE,
  openAdminSession,
  ownProject,
  P8_SLOT,
  PR,
  readLayerCounts,
  session,
  STAGES,
  tabTo,
  uploadAndSettle,
  type LayerCounts,
  type Session,
} from './support/p03/P8';

const QUIET_MS = 2_000;
const SETUP_TIMEOUT_MS = PIPELINE_TIMEOUT_MS + 120_000;

/* SCR-10 bits used to start a run from the upload screen (src/screens/upload/FloorUploadScreen/). */
const FILE_INPUT = 'floor-upload-file-input'; // FloorUploadDropZone.tsx:33
const DROPZONE = 'floor-upload-dropzone'; // FloorUploadDropZone.tsx:30
const TRAY = 'Tệp chưa gán tầng'; // useFloorUploadScreen.ts COPY.trayTitle
const ASSIGN = 'Gán cho tầng khác'; // FloorUploadTray.tsx:20
const SUBMIT = 'Bắt đầu xử lý'; // useFloorUploadScreen.ts COPY.submit
const ATTACHED = 'Đã gắn kèm'; // useFloorUploadScreen.ts STATUS attached

/* SCR-08 / SCR-16 bits (FL-12-05). */
const SETTINGS_TABS = 'Nhóm cài đặt'; // ProjectSettings.tsx tablist
const UNITS_TAB = 'Đơn vị đo'; // useProjectSettings.ts TAB_LABELS
const CONFIDENCE = 'Ngưỡng tin cậy'; // UnitsTab.tsx:71
const WALL_LIST = 'Danh sách đoạn tường'; // WallList.tsx:58
const WALL_APPROVE = 'Duyệt đoạn này'; // WallInspector.tsx:49

/* ---------------------------------------------------------------- small helpers */

const pathOf = (page: Page): string => new URL(page.url()).pathname;
const quiet = (page: Page): Promise<void> => page.waitForTimeout(QUIET_MS);
const button = (scope: Page | Locator, name: string): Locator => scope.getByRole('button', { name, exact: true });
const list = (page: Page, name: string): Locator => page.getByRole('list', { name, exact: true });
const summary = (page: Page): Locator => page.getByRole('region', { name: PR.summary, exact: true });
const tab = (page: Page, name: string): Locator =>
  page.getByRole('tablist', { name: PR.tabs, exact: true }).getByRole('tab', { name, exact: true });
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

/** Writes since `mark`, minus session / telemetry chatter. */
const writesSince = (s: Session, mark: number): string[] =>
  s.log
    .slice(mark)
    .filter((e) => e.method !== 'GET' && e.path !== '/api/auth/refresh' && !e.path.startsWith('/api/telemetry'))
    .map((e) => `${e.method} ${e.path} ${String(e.status)}`);

/** Opens /pipeline and waits for "Đã xong {n}/{n} tầng" (fails fast with the failure screen's copy button). */
async function openDone(page: Page, projectId: string, floors = 1, url = ROUTES.project.pipeline(projectId)): Promise<void> {
  await page.goto(url);
  await expect(page.getByText(doneLine(floors, floors))).toBeVisible({ timeout: 45_000 });
}

/** Log lines as the panel shows them: [time, text] per `<li>` (PLP:94-99). */
const logLines = (page: Page): Promise<{ time: string; text: string }[]> =>
  page
    .getByRole('log')
    .locator('li')
    .evaluateAll((rows) =>
      rows.map((row) => {
        const spans = row.querySelectorAll('span');
        return { time: spans[0]?.textContent ?? '', text: spans[1]?.textContent ?? '' };
      }),
    );

/** Real upload through the SCR-10 tray: file → "Gán cho tầng khác" = floor → #5-#7 (main spec SCR-10 path). */
async function uploadThroughTray(page: Page, projectId: string, floor: { readonly id: string; readonly name: string }): Promise<void> {
  const complete = waitForApi(page, 'POST', new RegExp(`^/api/projects/${escapeRegExp(projectId)}/drawings/uploads/[^/]+/complete$`, 'u'), [200]);
  const path = process.env.E2E_DRAWING_PNG;
  if (path === undefined) throw new Error('E2E_DRAWING_PNG is not set');
  await page.getByTestId(FILE_INPUT).setInputFiles(path);
  await page.getByRole('region', { name: TRAY, exact: true }).getByRole('combobox', { name: ASSIGN }).click();
  await page.getByRole('option', { name: floor.name, exact: true }).click();
  await complete;
  await expect(page.locator(`[data-floor-id="${floor.id}"]`).getByText(ATTACHED, { exact: true })).toBeVisible();
}

/** NumericField entry (P1 settings pattern): select all, insert, Tab commits. */
async function typeNumber(box: Locator, text: string): Promise<void> {
  const page = box.page();
  await box.focus();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await box.press('Control+A');
  await page.keyboard.insertText(text);
  await expect(box).toHaveValue(text);
  await box.press('Tab');
}

/** SCR-08 "Đơn vị đo" → "Ngưỡng tin cậy" = `text`, waits for the autosave PUT (200). */
async function setThreshold(page: Page, projectId: string, text: string): Promise<void> {
  await page.goto(ROUTES.project.settings(projectId));
  await page.getByRole('tablist', { name: SETTINGS_TABS, exact: true }).getByRole('tab', { name: new RegExp(`^${UNITS_TAB}`, 'u') }).click();
  const put = waitForApi(page, 'PUT', new RegExp(`^/api/projects/${escapeRegExp(projectId)}/settings$`, 'u'), [200]);
  await typeNumber(page.getByRole('textbox', { name: CONFIDENCE, exact: true }), text);
  await put;
}

const lowSentence = (count: number, threshold: string): string =>
  count === 0
    ? `Không có đối tượng nào có độ tin cậy dưới ${threshold}.` // UPR noLowConfidenceSentence
    : `Có ${formatNumber(count, { fractionDigits: 0 })} đối tượng có độ tin cậy dưới ${threshold} cần bạn xem lại.`; // UPR lowConfidenceSentence

/** Metric labels shown in the summary (PSU:28-37). */
const shownMetrics = (page: Page): Promise<string[]> => summary(page).locator('ul > li').allInnerTexts();

/* ================================================================= flows without a shared run */

test.describe('SCR-12 processing — real flows', () => {
  test('SCR-12 · FL-12-01 · owner opens /pipeline of a project with no drawing, goes to upload; then an unknown project id', async ({ browser }) => {
    const admin = await mainAdminApi();
    let s: Session | undefined;
    let projectId = '';
    try {
      const project = await createProject(admin, '12-01', 1);
      projectId = project.projectId;
      s = await openAdminSession(browser);
      const { page } = s;
      await page.goto(ROUTES.project.pipeline(projectId));

      await test.step('[12-B-002] no run → "Chưa có bước nào để theo dõi" + its sentence + "Chưa có lượt xử lý nào đang chạy."; no background / cancel', async () => {
        // UPR state(): records.length === 0 → 'empty' (PR EmptyState); canRunInBackground false (no run); cancel unsupported.
        await expect(page.getByText(PR.emptyTitle, { exact: true })).toBeVisible({ timeout: 45_000 });
        await expect(page.getByText(PR.emptyDescription, { exact: true })).toBeVisible();
        await expect(page.getByText(PR.noRun, { exact: true })).toBeVisible();
        await expect(button(page, PR.background)).toHaveCount(0);
        await expect(button(page, PR.cancel)).toHaveCount(0);
        await captureEvidence(page, 'E03_12-B-002_no-run-empty.png');
      });

      // QA-03e (BUG-546, FIX-2274): the shared Breadcrumb (ProcessingScreen.tsx:232-243): "Dự án" is a <button> → onBackToProjects
      // (useProcessingScreen.ts:880, ROUTES.dashboard); the project name a plain span (Breadcrumb.tsx:126-133); nav name stays "Xử lý".
      await test.step('[12-A-032] breadcrumb "Dự án" is a button back to the project list; the project name stays plain text', async () => {
        const crumbs = page.getByRole('navigation', { name: PR.nav, exact: true });
        await expect.soft(crumbs).toContainText(project.name);
        await expect.soft(crumbs.getByRole('link')).toHaveCount(0);
        await expect.soft(crumbs.getByRole('button')).toHaveCount(1);
        await expect.soft(crumbs.getByRole('button', { name: 'Dự án', exact: true })).toBeVisible();
        await captureEvidence(page, 'E03_12-A-032_breadcrumb-plain.png', { caption: 'breadcrumb: "Dự án" is a button, the project name plain text' });
        await crumbs.getByRole('button', { name: 'Dự án', exact: true }).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
        await page.goto(ROUTES.project.pipeline(projectId));
        await expect(page.getByText(PR.emptyTitle, { exact: true })).toBeVisible({ timeout: 45_000 });
      });

      await test.step('[12-A-004] "Tải bản vẽ" → /projects/:id/upload', async () => {
        await button(page, PR.emptyAction).click(); // UPR onUploadDrawings
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.upload(projectId));
        await captureEvidence(page, 'E03_12-A-004_to-upload.png');
      });

      await test.step('[12-B-014] unknown project → only "Không tìm thấy dự án này" + "Về danh sách dự án"; no chips, body, "Thử lại", code', async () => {
        await page.goto(ROUTES.project.pipeline(randomUUID())); // not prj_<ULID> → BE 404 `project` (access.py:28-33)
        const alert = page.getByRole('alert').filter({ hasText: NOT_FOUND_TITLE });
        await expect(alert).toBeVisible({ timeout: 45_000 });
        await expect(alert).toContainText(NOT_FOUND_SENTENCE);
        await expect(button(alert, BACK_TO_PROJECTS)).toBeVisible();
        // PR:275 isProjectMissing drops chips / body / summary line; PR:250-257 one alert, no retry, no code, no support.
        await expect(list(page, PR.chips)).toHaveCount(0);
        await expect(page.getByRole('tablist', { name: PR.tabs })).toHaveCount(0);
        await expect(page.getByText(PR.emptyTitle, { exact: true })).toHaveCount(0);
        await expect(button(page, PR.retry)).toHaveCount(0);
        await expect(button(page, PR.support)).toHaveCount(0);
        await expect(page.getByText('NOT_FOUND', { exact: false })).toHaveCount(0);
        await captureEvidence(page, 'E03_12-B-014_unknown-project.png');
      });

      await test.step('[12-A-024] "Về danh sách dự án" → "/"', async () => {
        await button(page.getByRole('alert').filter({ hasText: NOT_FOUND_TITLE }), BACK_TO_PROJECTS).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
      });
    } finally {
      await s?.context.close().catch(() => undefined);
      if (projectId !== '') await deleteSeededProject(admin, projectId);
      await admin.dispose();
    }
  });

  test('SCR-12 · FL-12-02 · user starts processing from SCR-10, watches the run finish, copies the log, goes to scale from the summary', async ({ browser }) => {
    test.setTimeout(SETUP_TIMEOUT_MS);
    await flow(async (f) => {
      const project = await ownProject(f, '12-02', 1);
      const floor = project.floors[0]!;
      const s = await session(f, browser, f.owner, { clipboard: true });
      const { page } = s;
      await page.goto(ROUTES.project.upload(project.projectId));
      await expect(page.getByTestId(DROPZONE)).toBeVisible({ timeout: 45_000 });
      await uploadThroughTray(page, project.projectId, floor);

      await test.step('[12-A-002] "Bắt đầu xử lý" → /pipeline with no request; list from N7; run reaches "Đã xong 1/1 tầng"', async () => {
        const mark = s.log.length;
        await button(page, SUBMIT).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.pipeline(project.projectId)); // UFU navigate only
        expect(writesSince(s, mark), '"Bắt đầu xử lý" sends no write').toEqual([]);
        await expect(page.getByText(doneLine(1, 1))).toBeVisible({ timeout: PIPELINE_TIMEOUT_MS });
        const n7 = `/api/projects/${project.projectId}/drawings/uploads/latest`;
        expect(s.log.slice(mark).some((e) => e.method === 'GET' && e.path === n7 && e.status === 200), 'list read from N7').toBe(true);
        await captureEvidence(page, 'E03_12-A-002_submit-to-done.png');
      });

      await test.step('[12-B-029] chip "đã xong" with the verified dot; every step row carries the check icon', async () => {
        const chip = list(page, PR.chips).getByRole('listitem');
        await expect.soft(chip).toHaveCount(1);
        await expect.soft(chip).toContainText('đã xong'); // UPR COPY.statusDone
        await expect.soft(chip.locator('span.bg-state-verified')).toHaveCount(1); // processingStatusTokens STAGE_DOT_CLASS.done
        // PSL StepIcon done = polyline "20 6 9 17 4 12".
        await expect.soft(list(page, PR.steps).locator('polyline[points="20 6 9 17 4 12"]')).toHaveCount(6);
        await captureEvidence(page, 'E03_12-B-029_done-tokens.png');
      });

      let lines: { time: string; text: string }[] = [];
      await test.step('[12-C-011] tab "Nhật ký": every log line = time + "{stage label} — {n}%"', async () => {
        await tab(page, PR.tabLog).click();
        await expect(page.getByRole('log')).toBeVisible();
        lines = await logLines(page);
        expect.soft(lines.length, 'log has lines').toBeGreaterThan(0);
        const stage = new RegExp(`^(${STAGES.map(escapeRegExp).join('|')}) — \\d+\\s?%$`, 'u');
        for (const line of lines) {
          // Catalog says "{HH:mm:ss}"; formatClockTime (lib/format/datetime.ts clockFormatter) is hour + minute only.
          expect.soft(line.time, `time of "${line.text}"`).toMatch(/^\d{2}:\d{2}$/u);
          expect.soft(line.text, 'log text = stage label — percent').toMatch(stage);
        }
        await attachJson('E03_12-C-011_log-lines.json', { lines });
        await captureEvidence(page, 'E03_12-C-011_log-lines.png');
      });

      await test.step('[12-C-012] no two adjacent log lines share the same text (BUG-360)', async () => {
        const repeats = lines.filter((line, i) => i > 0 && lines[i - 1]?.text === line.text).map((line) => line.text);
        expect.soft(repeats, 'adjacent duplicate log texts').toEqual([]);
      });

      await test.step('[12-A-007] "Sao chép nhật ký" → clipboard = one "<time> <text>" per log line; toast "Đã chép nhật ký"', async () => {
        await button(page, PR.copyLog).click(); // PLP IconButton → UPR onCopyLog
        await expect.soft(page.getByText(PR.logCopied, { exact: true })).toBeVisible();
        // The Windows clipboard stores CRLF line ends: normalised to LF before comparing.
        const copied = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/gu, '\n');
        expect.soft(copied).toBe(lines.map((line) => `${line.time} ${line.text}`).join('\n'));
        await captureEvidence(page, 'E03_12-A-007_log-copied.png', { caption: ['clipboard:', ...copied.split('\n').slice(0, 4)] });
      });

      await test.step('[12-E-007] "Báo cáo tổng kết": Tab reaches "Duyệt lớp tường" then "Hiệu chỉnh tỷ lệ" with visible focus', async () => {
        await expect(summary(page)).toBeVisible();
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        expect.soft(await tabTo(page, PR.reviewWalls), 'Tab reaches "Duyệt lớp tường"').toBeGreaterThan(0);
        expect.soft(await focusRingShown(page), 'focus ring on "Duyệt lớp tường"').toBe(true);
        await page.keyboard.press('Tab');
        await expect.soft(button(summary(page), PR.calibrate)).toBeFocused();
        expect.soft(await focusRingShown(page), 'focus ring on "Hiệu chỉnh tỷ lệ"').toBe(true);
        await captureEvidence(page, 'E03_12-E-007_summary-focus.png');
      });

      await test.step('[12-A-014] Enter on "Hiệu chỉnh tỷ lệ" → /projects/:id/floors/:fid/scale', async () => {
        await button(summary(page), PR.calibrate).focus();
        await page.keyboard.press('Enter');
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.scale(project.projectId, floor.id));
        await captureEvidence(page, 'E03_12-A-014_to-scale.png');
      });
    });
  });

  test('SCR-12 · FL-12-05 · owner tunes the confidence threshold on SCR-08 and approves a wall on SCR-16, re-reading the summary', async ({ browser }) => {
    test.setTimeout(SETUP_TIMEOUT_MS);
    await flow(async (f) => {
      const seeded = await createPipelineDrawingProject(f.ownerApi, '12-05', envDrawingPng());
      f.projects.push(seeded.projectId);
      const { projectId, floorId } = seeded;
      const s = await session(f, browser);
      const { page } = s;
      let counts: LayerCounts = await readLayerCounts(f.ownerApi, projectId, floorId);

      await test.step('[12-C-017] SCR-08 threshold 0,80 saved; /pipeline → "Có {n} đối tượng có độ tin cậy dưới 0,80 cần bạn xem lại." (BUG-354)', async () => {
        await setThreshold(page, projectId, '0,80');
        await openDone(page, projectId);
        const n = counts.lowBelow(0.8);
        if (n === 0) test.info().annotations.push({ type: 'data', description: 'N16 has no item below 0,80: the "Không có…" sentence is expected instead' });
        await expect(summary(page)).toContainText(lowSentence(n, '0,80'));
        await captureEvidence(page, 'E03_12-C-017_threshold-080.png', { caption: `N16: ${String(n)} item(s) below 0,80` });
      });

      await test.step('[12-C-019] "Duyệt lớp tường" → SCR-16 approve one low-confidence wall → back: count is n-1', async () => {
        const target = counts.walls.find((w) => !w.reviewed && w.confidence < 0.8);
        expect.soft(target, 'precondition: N16 has an unreviewed wall below 0,80').toBeDefined();
        if (target === undefined) return;
        const before = counts.lowBelow(0.8);
        await button(summary(page), PR.reviewWalls).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.walls(projectId, floorId));
        await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
        const code = `#${displayCodesOf(counts.walls.map((w) => w.id)).get(target.id) ?? target.id}`; // WallGeometry wallLabelOf
        await page
          .getByRole('listbox', { name: WALL_LIST, exact: true })
          .getByRole('option', { name: new RegExp(`^${escapeRegExp(code)} — `, 'u') })
          .click();
        const put = waitForApi(page, 'PUT', new RegExp(`^/api/projects/${escapeRegExp(projectId)}/floors/${escapeRegExp(floorId)}/spatial/layer$`, 'u'), [200]);
        await button(page, WALL_APPROVE).click();
        await put;
        await page.goBack();
        await expect(page.getByText(doneLine(1, 1))).toBeVisible({ timeout: 45_000 });
        counts = await readLayerCounts(f.ownerApi, projectId, floorId);
        expect.soft(counts.lowBelow(0.8), 'N16 count after the approval').toBe(before - 1);
        await expect.soft(summary(page)).toContainText(lowSentence(before - 1, '0,80'));
        await captureEvidence(page, 'E03_12-C-019_reviewed-excluded.png', { caption: `approved ${code}: ${String(before)} → ${String(before - 1)}` });
      });

      await test.step('[12-C-018] threshold at its lowest allowed value t → "Không có đối tượng nào có độ tin cậy dưới {t}."', async () => {
        await setThreshold(page, projectId, '0'); // PROJECT_SETTINGS_LIMITS.confidenceMin = 0 (projectSettingsGateway.ts:194)
        await openDone(page, projectId);
        await expect.soft(summary(page)).toContainText(lowSentence(0, formatNumber(0, { fractionDigits: 2 })));
        await captureEvidence(page, 'E03_12-C-018_threshold-lowest.png');
      });
    });
  });

  test('SCR-12 · FL-12-06 · owner of a six-floor project reads the finished runs: counts, sums, chips, first-floor targets', async ({ browser }) => {
    test.setTimeout(SETUP_TIMEOUT_MS + 120_000);
    await flow(async (f) => {
      const project = await ownProject(f, '12-06', 6);
      const png = envDrawingPng();
      const { outcomes } = await uploadAndSettle(f.ownerApi, project.projectId, project.floors.map((fl) => [fl, png] as const));
      expect(outcomes.map((o) => o.status), 'setup: six runs completed').toEqual(Array(6).fill('completed'));
      const counts = await Promise.all(project.floors.map((fl) => readLayerCounts(f.ownerApi, project.projectId, fl.id)));
      const s = await session(f, browser);
      const { page } = s;

      await test.step('[12-C-001] "Đã xong 6/6 tầng": done counts only done floors, total = N7 floors with an upload', async () => {
        await openDone(page, project.projectId, 6);
        await captureEvidence(page, 'E03_12-C-001_six-done.png');
      });

      await test.step('[12-B-018] six chips without horizontal scroll; "Số đối tượng đã nhận theo tầng" lists all six floors', async () => {
        await expect.soft(list(page, PR.chips).getByRole('listitem')).toHaveCount(6);
        expect.soft(await horizontalOverflow(page), 'no horizontal scroll').toBeLessThanOrEqual(0);
        const rows = list(page, PR.objects).getByRole('listitem');
        await expect.soft(rows).toHaveCount(6);
        for (const fl of project.floors) await expect.soft(rows.filter({ hasText: fl.name })).toHaveCount(1);
        await captureEvidence(page, 'E03_12-B-018_six-chips.png', { fullPage: true });
      });

      await test.step('[12-C-016] summary metric labels equal the sums of the six floors\' N16 counts', async () => {
        expect.soft(await shownMetrics(page)).toEqual(metricLabelsOf(counts));
      });

      await test.step('[12-A-015] "Duyệt lớp tường" → first floor (Floor.order) …/layers/walls; back; "Hiệu chỉnh tỷ lệ" → same floor /scale', async () => {
        const first = project.floors[0]!; // createProject sorts by `order`
        await button(summary(page), PR.reviewWalls).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.walls(project.projectId, first.id));
        await captureEvidence(page, 'E03_12-A-015_walls-first-floor.png');
        await page.goBack();
        await expect(page.getByText(doneLine(6, 6))).toBeVisible({ timeout: 45_000 });
        await button(summary(page), PR.calibrate).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.scale(project.projectId, first.id));
      });
    });
  });

  test('SCR-12 · FL-12-07 · owner straightens the drawing (re-run on the same upload), then uploads a newer drawing on the same floor', async ({ browser }) => {
    test.setTimeout(SETUP_TIMEOUT_MS + 180_000);
    await flow(async (f) => {
      const drawing = process.env.E2E_DRAWING_PNG;
      if (drawing === undefined) throw new Error('E2E_DRAWING_PNG is not set');
      const seeded = await createDrawingProject(f.ownerApi, '12-07', await rotatedPng(browser, drawing, SKEW_DEG), ['Tầng 1']);
      f.projects.push(seeded.projectId);
      const { projectId, floorId, uploadId } = seeded;
      expect((await waitForRunOutcome(f.ownerApi, projectId, uploadId)).status, 'setup: first run completed').toBe('completed');
      expect(await waitForQualityFindings(f.ownerApi, projectId, floorId), 'setup: skew measured').toContain('SKEW_DETECTED');
      const s = await session(f, browser);
      const { page } = s;
      await openDone(page, projectId);
      const sse = /^\/api\/streams\/projects\/[^/]+\/uploads\/[^/]+\/progress$/u;
      let sseHold: Awaited<ReturnType<typeof holdFirst>> | undefined;

      await test.step('[12-C-009] after "Đã xong 1/1 tầng", POST …/quality/straighten (#32) → six steps back to queued/0, old done record replaced', async () => {
        // run-33-P8: an SPA "back" to /pipeline sent no #8 read for a final run within 10 min (the done copy stays), so the
        // screen is opened fresh: hold its first #8 read and the SSE, straighten, then let the #8 read through — it
        // answers the NEW run's first state (UPR floorQueries → applySnapshot; PRG toStageBreakdown pending → queued).
        const progressHold = await holdFirst(page, new RegExp(`/drawings/uploads/${escapeRegExp(uploadId)}/progress$`, 'u'));
        sseHold = await holdFirst(page, sse);
        await page.goto(ROUTES.project.pipeline(projectId));
        await Promise.race([
          progressHold.seen,
          new Promise((_resolve, reject) => setTimeout(() => reject(new Error('no #8 read within 30 s')), 30_000)),
        ]);
        const straighten = await f.ownerApi.post(`/api/projects/${projectId}/floors/${floorId}/quality/straighten`, { data: {} });
        expect(straighten.status(), 'POST #32 straighten').toBe(200);
        await progressHold.release();
        await expect(page.getByText(doneLine(0, 1))).toBeVisible({ timeout: 15_000 });
        const bars = list(page, PR.steps).getByRole('progressbar');
        await expect.soft(bars).toHaveCount(6);
        for (const stage of STAGES) await expect.soft(list(page, PR.steps).getByRole('progressbar', { name: stage, exact: true })).toHaveAttribute('aria-valuenow', '0');
        await captureEvidence(page, 'E03_12-C-009_rerun-reset.png');
      });

      await test.step('[12-A-030] the straightened re-run ends "Đã xong 1/1 tầng" again', async () => {
        await sseHold?.release();
        await expect(page.getByText(doneLine(1, 1))).toBeVisible({ timeout: PIPELINE_TIMEOUT_MS });
        await captureEvidence(page, 'E03_12-A-030_rerun-done.png');
      });

      await test.step('[12-A-031] API upload of drawing.png on the same floor; /pipeline follows the newer upload id from N7 and ends done', async () => {
        const newer = await uploadDrawing(f.ownerApi, projectId, floorId, envDrawingPng(), 'p8-newer.png');
        const mark = s.sent.length;
        await openDone(page, projectId);
        const progressPaths = s.sent.slice(mark).filter((p) => p.endsWith('/progress'));
        expect(progressPaths.some((p) => p.includes(newer)), `progress read of the newer upload ${newer}`).toBe(true);
        expect(progressPaths.some((p) => p.includes(`/${uploadId}/`)), 'no progress read of the older upload').toBe(false);
        await captureEvidence(page, 'E03_12-A-031_newer-upload.png', { caption: `followed upload ${newer}` });
      });
    });
  });
});

/* ================================================================= flows on one shared finished run (S3) */

test.describe('SCR-12 processing — shared finished run', () => {
  let ownerUser: PoolUser;
  let ownerApi: Awaited<ReturnType<typeof signedInApi>>;
  let s3: { readonly projectId: string; readonly floorId: string; readonly floorName: string };
  let s3Counts: LayerCounts;

  test.beforeAll(async () => {
    test.setTimeout(SETUP_TIMEOUT_MS);
    const admin = await mainAdminApi();
    try {
      ownerUser = await poolUser(admin, 'engineer', P8_SLOT);
    } finally {
      await admin.dispose();
    }
    ownerApi = await signedInApi(ownerUser.email, ownerUser.password);
    s3 = await createPipelineDrawingProject(ownerApi, '12-s3', envDrawingPng());
    s3Counts = await readLayerCounts(ownerApi, s3.projectId, s3.floorId);
  });

  test.afterAll(async () => {
    if (s3 !== undefined) await deleteSeededProject(ownerApi, s3.projectId);
    await ownerApi?.dispose();
  });

  test('SCR-12 · FL-12-03 · owner re-opens a finished run: reload, deep link, chips, metrics, keyboard and a11y', async ({ browser }) => {
    await flow(async (f) => {
      const s = await session(f, browser, ownerUser);
      const { page } = s;
      const streams = (from: number): string[] => s.sent.slice(from).filter((p) => p.startsWith('/api/streams/'));

      await test.step('[12-A-025] /pipeline → "Đã xong 1/1 tầng"; reload → same done state from #8 and NO /api/streams/…/progress request', async () => {
        await openDone(page, s3.projectId);
        const mark = s.sent.length;
        await page.reload();
        await expect(page.getByText(doneLine(1, 1))).toBeVisible({ timeout: 45_000 });
        await quiet(page);
        expect(streams(mark), 'no SSE for a final run').toEqual([]);
        expect(s.sent.slice(mark).some((p) => p.endsWith('/progress') && p.includes('/drawings/uploads/')), '#8 read on reload').toBe(true);
        await captureEvidence(page, 'E03_12-A-025_reload-done.png');
      });

      await test.step('[12-B-026] "Số đối tượng đã nhận theo tầng": "{floor}" + "{n} đối tượng"; chip aria-current + "đã xong"', async () => {
        const row = list(page, PR.objects).getByRole('listitem');
        await expect.soft(row).toHaveCount(1);
        await expect.soft(row).toContainText(s3.floorName);
        await expect.soft(row).toContainText(/\d+ đối tượng/u);
        const chip = list(page, PR.chips).getByRole('listitem');
        await expect.soft(chip).toHaveAttribute('aria-current', 'true');
        await expect.soft(chip).toContainText('đã xong');
        await captureEvidence(page, 'E03_12-B-026_floor-objects.png');
      });

      const metrics = metricLabelsOf([s3Counts]);
      await test.step('[12-C-014] summary "{n} tường", "{n} đối tượng" (walls+openings+rooms), "{n} chuỗi kích thước", "{n} phòng", "{x,xx} m²" = N16', async () => {
        expect.soft(await shownMetrics(page)).toEqual(metrics);
        await captureEvidence(page, 'E03_12-C-014_summary-metrics.png', { caption: `N16: ${metrics.join(' · ')}` });
      });

      await test.step('[12-C-015] chip "· {n} đối tượng" equals the summary "{n} đối tượng" (BUG-353)', async () => {
        const chipCount = (await list(page, PR.chips).getByRole('listitem').locator('span').allInnerTexts()).at(-1);
        expect.soft(chipCount).toBe(metrics[1]);
      });

      await test.step('[12-E-005] ol "Các bước xử lý": six progressbars named by stage, aria-valuemin 0 / max 100 / now 100', async () => {
        const bars = list(page, PR.steps).getByRole('progressbar');
        await expect.soft(bars).toHaveCount(6);
        for (const stage of STAGES) {
          const bar = list(page, PR.steps).getByRole('progressbar', { name: stage, exact: true });
          await expect.soft(bar).toHaveAttribute('aria-valuemin', '0');
          await expect.soft(bar).toHaveAttribute('aria-valuemax', '100');
          await expect.soft(bar).toHaveAttribute('aria-valuenow', '100');
        }
      });

      await test.step('[12-E-002] tabs: ArrowRight / ArrowLeft / End / Home move selection; only the selected tab has tabIndex 0', async () => {
        const preview = tab(page, PR.tabPreview);
        const log = tab(page, PR.tabLog);
        await preview.focus();
        await page.keyboard.press('ArrowRight');
        await expect.soft(log).toHaveAttribute('aria-selected', 'true');
        await expect.soft(log).toBeFocused();
        await expect.soft(log).toHaveAttribute('tabindex', '0');
        await expect.soft(preview).toHaveAttribute('tabindex', '-1');
        await captureEvidence(page, 'E03_12-E-002_tabs-keyboard.png');
        await page.keyboard.press('ArrowLeft');
        await expect.soft(preview).toHaveAttribute('aria-selected', 'true');
        await page.keyboard.press('End');
        await expect.soft(log).toHaveAttribute('aria-selected', 'true');
        await page.keyboard.press('Home');
        await expect.soft(preview).toHaveAttribute('aria-selected', 'true');
        await expect.soft(preview).toHaveAttribute('tabindex', '0');
        await expect.soft(log).toHaveAttribute('tabindex', '-1');
      });

      // QA-03e (BUG-547, FIX-2275): both panels carry role="region" with their aria-label (ProcessingLogPanel.tsx:69,
      // ProcessingPreviewPanel.tsx:76,90), so the names reach the accessibility tree.
      await test.step('[12-E-011] panels "Nhật ký xử lý" / "Xem trước bản vẽ đang xử lý" are named regions in the accessibility tree', async () => {
        await expect.soft(page.getByRole('region', { name: PR.previewPanel, exact: true })).toHaveCount(1);
        await tab(page, PR.tabLog).click();
        await expect.soft(page.getByRole('region', { name: PR.logPanel, exact: true })).toHaveCount(1);
        await captureEvidence(page, 'E03_12-E-011_named-regions.png');
        await tab(page, PR.tabPreview).click();
      });

      await test.step('[12-A-028] /pipeline?uploadId=<random uuid>#x → ignored; same N7 list and "Đã xong 1/1 tầng"', async () => {
        const stray = randomUUID();
        const mark = s.sent.length;
        await openDone(page, s3.projectId, 1, `${ROUTES.project.pipeline(s3.projectId)}?uploadId=${stray}#x`);
        expect.soft(s.sent.slice(mark).some((p) => p.includes(stray)), 'no request names the stray uploadId').toBe(false);
        expect.soft(s.sent.slice(mark)).toContain(`/api/projects/${s3.projectId}/drawings/uploads/latest`);
        await captureEvidence(page, 'E03_12-A-028_deep-link-ignored.png');
      });
    });
  });

  test('SCR-12 · FL-12-04 · compact viewport: no-run empty state at 375, step bar, live resize across 1024', async ({ browser }) => {
    await flow(async (f) => {
      const empty = await ownProject(f, '12-04', 1);
      const s = await session(f, browser, ownerUser, { viewport: COMPACT });
      const { page } = s;
      const details = page.locator('details').filter({ has: page.getByText(PR.allSteps, { exact: true }) });

      await test.step('[12-F-016] S1(1) /pipeline at 375 → still "Chưa có bước nào để theo dõi" + "Tải bản vẽ"; no horizontal scroll', async () => {
        await page.goto(ROUTES.project.pipeline(empty.projectId));
        // UPR state(): 'empty' is decided before `collapsed` (BUG-111 on this screen).
        await expect(page.getByText(PR.emptyTitle, { exact: true })).toBeVisible({ timeout: 45_000 });
        await expect(button(page, PR.emptyAction)).toBeVisible();
        await expect(page.getByRole('tablist', { name: PR.tabs })).toHaveCount(0);
        expect(await horizontalOverflow(page), 'no horizontal scroll at 375 px').toBeLessThanOrEqual(0);
        await captureEvidence(page, 'E03_12-F-016_compact-empty.png');
      });

      await test.step('[12-A-012] S3 /pipeline at 375: "Xem tất cả các bước" closed; click → the six-step list under the step bar', async () => {
        await openDone(page, s3.projectId);
        await expect(page.getByRole('group', { name: PR.stepBar, exact: true })).toBeVisible();
        await expect(details).not.toHaveAttribute('open', '');
        await page.getByText(PR.allSteps, { exact: true }).click();
        await expect(details).toHaveAttribute('open', '');
        await expect(details.getByRole('list', { name: PR.steps, exact: true }).getByRole('listitem')).toHaveCount(6);
        expect.soft(await horizontalOverflow(page), 'no horizontal scroll at 375 px').toBeLessThanOrEqual(0);
        await captureEvidence(page, 'E03_12-A-012_compact-all-steps.png', { fullPage: true });
      });

      await test.step('[12-E-008] group "Bước đang xử lý" holds a progressbar; focus "Xem tất cả các bước", Enter closes, Space opens', async () => {
        await expect.soft(page.getByRole('group', { name: PR.stepBar, exact: true }).getByRole('progressbar')).toHaveCount(1);
        await details.locator('summary').focus();
        await page.keyboard.press('Enter');
        await expect.soft(details).not.toHaveAttribute('open', '');
        await page.keyboard.press('Space');
        await expect.soft(details).toHaveAttribute('open', '');
      });

      await test.step('[12-A-033] resize to 1440 → step list "Các bước xử lý", no step bar; 800 → "Bước đang xử lý" + "Xem tất cả các bước" again', async () => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await expect.soft(page.getByRole('group', { name: PR.stepBar, exact: true })).toHaveCount(0);
        await expect.soft(details).toHaveCount(0);
        await expect.soft(list(page, PR.steps)).toBeVisible();
        await captureEvidence(page, 'E03_12-A-033_resize-1440.png');
        await page.setViewportSize({ width: 800, height: 900 });
        await expect.soft(page.getByRole('group', { name: PR.stepBar, exact: true })).toBeVisible();
        await expect.soft(page.getByText(PR.allSteps, { exact: true })).toBeVisible();
        await captureEvidence(page, 'E03_12-A-033_resize-800.png');
      });
    });
  });
});
