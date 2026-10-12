/**
 * Phase 3 — SCR-12 processing (+ PipelineFailure), EDGE layer, MOCKED RESPONSES: six sequential user flows (QA-03d P9,
 * `flow-plan.md` "phase03_processing_mocked_edge.spec.ts"). One `test()` per flow, one `test.step('[<row id>] …')` per
 * catalog row, in the planned order (two moves, both named in the step titles: [12-C-004] runs after [12-B-034] in
 * FL-12-12, because "Còn khoảng …" only exists once three stages have a measured duration — `estimateRemainingSeconds`
 * needs 3 timed done stages, src/lib/realtime/pipeline.ts). `H` rows use a hard `expect`, `S` rows `expect.soft`;
 * `ev` rows capture `E03_<row id>_<slug>.png`.
 *
 * Every flow name carries `[mocked response]`: the run states (N7, #8, the SSE stream) cannot be held still on the real
 * fake-ML stack (a run ends ~0.5 s after #7). What is real: the project, its floors, #24, settings, N16 and auth.
 * Mocks (support/p03/P9.ts):
 *   - N7 `GET /api/projects/:id/drawings/uploads/latest` and #8 `GET …/drawings/uploads/:uid/progress` answered from
 *     test state with fake upload ids (`upl_` + 26 Crockford chars, the N7 schema);
 *   - the SSE stream `GET /api/streams/projects/:id/uploads/:uid/progress` is `route.continue`d to a local streaming
 *     server, so the app's real EventSource holds a live stream and frames arrive one by one;
 *   - `page.clock` (installed, time flowing) only to fast-forward the 5 s / 30 s polls, the 60 s SSE retry and the 120 s
 *     silence probe.
 * Source (FE, this branch): UPR src/screens/pipeline/ProcessingScreen/useProcessingScreen.ts · PR …/ProcessingScreen.tsx ·
 * PG …/processingGateway.ts · PSL …/ProcessingStepList.tsx · PLP …/ProcessingLogPanel.tsx · PPP …/ProcessingPreviewPanel.tsx ·
 * PET src/screens/pipeline/pipelineErrorText.ts · UPF src/screens/pipeline/PipelineFailure/usePipelineFailure.ts ·
 * PFA …/PipelineFailureAlert.tsx · PFT …/pipelineFailureText.ts · PS src/lib/realtime/progressStream.ts · EC …/eventChannel.ts.
 * Line numbers follow fix/qa03e-int with the QA-03e SCR-12 fixes (C4a FIX-2270..2282, R-src b4a590c0 FIX-2342): the steps
 * that used to record suspected bugs (12-C-005, 12-B-073/074, 12-B-011, 12-B-015, 12-B-041, 12-C-023, 12-E-010) now
 * assert the fixed behaviour.
 *
 * ## Users
 * The shared admin for every flow (no upload init anywhere: runs are mocked); FL-12-13 last step: the shared pool viewer
 * (`poolUser(admin, 'viewer')`), made a member of the flow's own project (membership goes with the project).
 *
 * ## Request budget per full run
 * - `POST /api/auth/login` (120 / 60 s per IP): 1 admin API (beforeAll) + 6 flow sessions + 1 viewer session (FL-12-13)
 *   + 1 fresh session (FL-12-16 #24) = 9.
 * - `POST /api/users/invitations`: 0 (shared viewer slot exists; else 1).
 * - `POST /api/projects` 6, `DELETE /api/projects/:id` 6, `POST …/members` 1. No upload init.
 * - `POST /api/auth/refresh`: ~1 per page load (≈ 60 loads; FL-12-15 reloads 29 times) + 1 in FL-12-17 (SSE lost).
 */
import { expect, test, type APIRequestContext, type Locator, type Page, type Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { signedInApi } from './support/api';
import { dashboardLoaded, readAdminCredentials } from './support/auth';
import { attachJson, captureEvidence } from './support/evidence';
import { addProjectMember, createProject, deleteSeededProject, envDrawingPng, poolUser, type SeededProject } from './support/phase03Seed';
import { closeFlow, openFlow, writesSince, type Credentials, type Flow } from './support/p03/P5';
import {
  STAGES,
  SseServer,
  durationSeconds,
  fakeUploadId,
  mockRuns,
  progress,
  runningAt,
  spaNavigate,
  stageLabel,
  stepLine,
  wireError,
  type Answer,
  type RunsMock,
  type UploadItem,
} from './support/p03/P9';

/* ---------------------------------------------------------------- copy (each cites its source) */

const CHIPS = 'Tiến độ theo tầng'; // ProcessingFloorChips.tsx:20
const STEPS = 'Các bước xử lý'; // PSL:39
const BACKGROUND = 'Để chạy nền và thông báo cho tôi'; // PR:63
const CANCEL = 'Huỷ xử lý'; // PR:64
const RETRY = 'Thử lại'; // PR:72
const SUPPORT = 'Liên hệ hỗ trợ'; // PR:71
const TABS = 'Xem trước hoặc nhật ký'; // PR:74
const TAB_PREVIEW = 'Xem trước'; // PR:75
const TAB_LOG = 'Nhật ký'; // PR:76
const LOCK_SCROLL = 'Khoá cuộn tự động'; // PLP:28
const COPY_LOG = 'Sao chép nhật ký'; // PLP:29
const PREVIEW = 'Xem trước bản vẽ đang xử lý'; // PPP:47
const WAITING_IMAGE = 'Đang chờ ảnh xem trước…'; // PPP:50
const EMPTY_TITLE = 'Chưa có bước nào để theo dõi'; // PR:80
const SUMMARY = 'Báo cáo tổng kết'; // ProcessingSummary.tsx:18
const REVIEW_WALLS = 'Duyệt lớp tường'; // ProcessingSummary.tsx:19
const CALIBRATE = 'Hiệu chỉnh tỷ lệ'; // ProcessingSummary.tsx:20
const BG_STARTED = 'Sẽ báo cho bạn khi xử lý xong'; // UPR:152
const BG_STARTED_DESC = 'Xử lý vẫn chạy khi bạn rời màn này. Đóng thẻ trình duyệt thì không báo được nữa.'; // UPR:156-157
const BG_DONE_DESC = 'Mở lại màn xử lý để xem kết quả.'; // UPR:158
const BG_FAILED_DESC = 'Mở lại màn xử lý để xem chi tiết lỗi.'; // UPR:159
const LOG_COPY_FAILED = 'Không chép được nhật ký'; // UPR:154
const LOG_COPY_FAILED_DESC = 'Trình duyệt chặn khay nhớ tạm. Chọn các dòng trong nhật ký rồi chép bằng tay.'; // UPR:155
const NO_LOW_CONFIDENCE = /độ tin cậy dưới/u; // UPR lowConfidenceSentence / noLowConfidenceSentence
/** Only while another floor is still non-final; with none left it is just "{floor} gặp lỗi." (BUG-553, UPR:197-199). */
const partialNotice = (names: string): string => `${names} gặp lỗi. Các tầng còn lại vẫn đang được xử lý.`; // UPR:197-199
/* PipelineFailure (S-11). */
const NEXT_STEPS = 'Hướng đi tiếp'; // PFA:63
const RERUN_BY_UPLOAD = 'Tải lại bản vẽ để chạy lượt mới'; // UPF:226
const UPLOAD_CLEARER = 'Tải lên bản vẽ rõ hơn'; // PFT uploadClearerLabel
const RETRY_LOWER = 'Thử lại với ngưỡng thấp hơn'; // PFT retryLowerThresholdLabel
const SKIP_FLOOR = 'Bỏ qua tầng đó'; // PFT skipFloorLabel
const RETRY_STEP = /^Thử lại bước này/u; // PFA:93 aria-label "Thử lại bước này — Thử lại bước …"
const COPY_CODE = 'Sao chép mã lỗi'; // PFT copyCodeAriaLabel
const FALLBACK_SENTENCE = 'Bước xử lý gặp lỗi mà hệ thống chưa phân loại được.'; // PET:84
/** A failed run without a code (`error` absent or "") reaches S-11 as `PROCESSING` (BUG-549: src/api/schemas/index.ts:185 drops "", UPR:1406-1408, PET:96-100). */
const NO_CODE = 'PROCESSING'; // src/lib/errors/kinds.ts:142
const summarySentence = (step: string, floor: string): string => `Bước ${step} ở ${floor} không hoàn tất được.`; // PFT summarySentence
const detailUnsupportedSummary = (floor: string): string => `Chưa đọc được chi tiết bước hỏng ở ${floor}.`; // PFT (no longer reached from #8)
const FILE_CORRUPT_SENTENCE = 'Tệp bản vẽ bị hỏng nên không mở được.'; // PET:62

const STEP_SETTLE_MS = 1_500;
const ALL_QUEUED = STAGES.map(() => 'queued').join(',');

/* ---------------------------------------------------------------- locators and small actions */

const pathOf = (page: Page): string => new URL(page.url()).pathname;
const chips = (page: Page): Locator => page.getByRole('list', { name: CHIPS, exact: true }).getByRole('listitem');
const chip = (page: Page, floor: string): Locator => chips(page).filter({ hasText: floor });
const chipDot = (page: Page, floor: string): Locator => chip(page, floor).locator('span[aria-hidden="true"]').first();
const stepRows = (page: Page): Locator => page.locator(`ol[aria-label="${STEPS}"] > li`);
const stepRow = (page: Page, label: string): Locator => stepRows(page).filter({ hasText: label });
/** The live part only: `<span role="status">Đã xong x/y tầng</span>` (PR:289, BUG-554). */
const overall = (page: Page): Locator => page.getByText(/^Đã xong \d+\/\d+ tầng/u);
/** The whole line: the status span plus " · Còn lại khoảng …", which stays OUTSIDE the live region (PR:288-291, R1-03). */
const overallLine = (page: Page): Locator => page.locator('p:has(> span[role="status"])').filter({ hasText: /^Đã xong \d+\/\d+ tầng/u });
/** The always-present live region of the partial notice, right after the overall line (PR:292-296). */
const partialRegion = (page: Page): Locator => page.locator('p:has(> span[role="status"]) + div[role="status"]');
const skeletonRows = (page: Page): Locator => page.locator('div.flex.items-center.gap-4.p-3:has(> .animate-pulse)');
const toastWith = (page: Page, text: string): Locator => page.getByRole('status').filter({ hasText: text });
const tab = (page: Page, name: string): Locator =>
  page.getByRole('tablist', { name: TABS, exact: true }).getByRole('tab', { name, exact: true });
const logBox = (page: Page): Locator => page.getByRole('log');
const readAlert = (page: Page): Locator => page.getByRole('alert').filter({ has: page.getByRole('button', { name: RETRY, exact: true }) });
const nextSteps = (page: Page): Locator => page.getByRole('group', { name: NEXT_STEPS, exact: true });
const previewUrl = (uploadId: string): string => `${readBaseUrl()}/qa-preview/${uploadId}.png`;
const settle = (page: Page, ms = STEP_SETTLE_MS): Promise<void> => page.waitForTimeout(ms);

const note = (description: string): void => {
  test.info().annotations.push({ type: 'note', description });
};

/** `expect.poll` that records a soft failure (with the last value) instead of ending the step. */
async function softPoll(read: () => number, expected: number, message: string, timeout: number): Promise<void> {
  await expect.poll(read, { timeout }).toBe(expected).catch(() => undefined);
  expect.soft(read(), message).toBe(expected);
}

const uploadOf = (project: SeededProject, index: number, uploadId: string, withPreview = true): UploadItem => {
  const floor = project.floors[index];
  if (floor === undefined) throw new Error(`fixture floor #${String(index)} missing`);
  return { floorId: floor.id, floorName: floor.name, uploadId, ...(withPreview ? { sourceImageUrl: previewUrl(uploadId) } : {}) };
};
const ok = (body: Record<string, unknown>): Answer => ({ body });

/* ---------------------------------------------------------------- users and flow sessions */

let adminApi: APIRequestContext;

test.beforeAll(async () => {
  const admin = readAdminCredentials();
  adminApi = await signedInApi(admin.email, admin.password);
});

test.afterAll(async () => {
  await adminApi?.dispose();
});

interface Mocked {
  readonly flow: Flow;
  readonly page: Page;
  readonly sse: SseServer;
  readonly runs: RunsMock;
}

/** One signed-in context with the SSE server and the N7/#8 mocks of `projectId` attached (before any `goto`). */
async function openMocked(
  browser: Parameters<typeof openFlow>[0],
  projectId: string,
  who: Credentials = readAdminCredentials(),
  options: { readonly clock?: boolean } = {},
): Promise<Mocked> {
  const flow = await openFlow(browser, who);
  const sse = await SseServer.start();
  try {
    await sse.attach(flow.page);
    const runs = await mockRuns(flow.page, projectId, envDrawingPng());
    if (options.clock === true) await flow.page.clock.install();
    return { flow, page: flow.page, sse, runs };
  } catch (error) {
    await sse.close();
    await closeFlow(flow);
    throw error;
  }
}

async function closeMocked(mocked: Mocked | undefined): Promise<void> {
  if (mocked === undefined) return;
  await closeFlow(mocked.flow);
  await mocked.sse.close();
}

/* ================================================================= flows */

test.describe('E03 SCR-12 processing — mocked-response flows (QA-03d P9)', () => {
  test('FL-12-12 · [mocked response] SCR-12 one floor\'s live run walks the six stages with a streaming log, then fails under reduced motion', async ({ browser }) => {
    test.setTimeout(300_000);
    const project = await createProject(adminApi, '12-12', 1);
    const floor = project.floors[0];
    if (floor === undefined) throw new Error('fixture floor missing');
    let m: Mocked | undefined;
    try {
      m = await openMocked(browser, project.projectId, readAdminCredentials(), { clock: true });
      const { page, sse, runs } = m;
      const uid = fakeUploadId();
      const item = uploadOf(project, 0, uid);
      let releaseN7 = (): void => undefined;
      runs.uploads = [item];
      runs.n7Once.push({ body: { items: [item] }, hold: new Promise<void>((resolve) => { releaseN7 = resolve; }) });
      runs.progressOf.set(uid, ok(progress(uid, 'pending', 'preprocess', 0)));
      /** Sends one frame and keeps #8 in step with it (a silence probe then reads the same stage). */
      const push = async (status: 'running' | 'failed' | 'pending', step: string, pct: number, error?: string): Promise<void> => {
        const body = progress(uid, status, step, pct, error === undefined ? {} : { error });
        runs.progressOf.set(uid, ok(body));
        await sse.send(uid, [body]);
      };

      await test.step('[12-B-001] four skeleton rows while N7 is held; gone once N7 and #8 answer', async () => {
        await page.goto(ROUTES.project.pipeline(project.projectId));
        await expect.soft(skeletonRows(page)).toHaveCount(4); // PR:84-85,186-192 SKELETON_ROW_COUNT
        await captureEvidence(page, 'E03_12-B-001_loading-skeleton.png');
        releaseN7();
        await expect(chips(page)).toHaveCount(1);
        await expect.soft(skeletonRows(page)).toHaveCount(0);
      });

      await test.step('[12-B-027] #8 pending → chip "đang chờ" with the muted dot', async () => {
        await expect.soft(chip(page, floor.name)).toContainText('đang chờ'); // UPR:145
        await expect.soft(chipDot(page, floor.name)).toHaveClass(/bg-text-muted/u); // STAGE_DOT_CLASS.queued
        await captureEvidence(page, 'E03_12-B-027_chip-queued.png');
      });

      await test.step('[12-B-031] frame step=preprocess → "Tiền xử lý" running, no stage done, five queued', async () => {
        await sse.waitForConnections(uid);
        await push('running', 'preprocess', 5);
        await expect.poll(() => stepLine(page)).toBe(runningAt(0)); // PG toStageBreakdown
        await captureEvidence(page, 'E03_12-B-031_stage-preprocess.png');
      });

      await test.step('[12-B-004] chip "Đang xử lý" aria-current, running step sweep, "Đã xong 0/1 tầng", "Để chạy nền…" (remaining → [12-C-004])', async () => {
        await expect.soft(chip(page, floor.name)).toContainText('Đang xử lý'); // UPR:146
        await expect.soft(chip(page, floor.name)).toHaveAttribute('aria-current', 'true');
        await expect.soft(stepRow(page, stageLabel('preprocess')).locator('.animate-pipeline-sweep')).toHaveCount(1); // PSL:147
        await expect.soft(overallLine(page)).toHaveText('Đã xong 0/1 tầng'); // no estimate before 3 timed stages (UPR:1342-1349)
        await expect.soft(page.getByRole('button', { name: BACKGROUND, exact: true })).toBeVisible(); // UPR:844
        note('[12-B-004] "Còn khoảng …" is checked in [12-C-004] after [12-B-034]: estimateRemainingSeconds needs 3 done stages with a measured duration (pipeline.ts)');
        await captureEvidence(page, 'E03_12-B-004_running-focus.png');
      });

      await test.step('[12-B-028] running chip has the attention dot', async () => {
        await expect.soft(chipDot(page, floor.name)).toHaveClass(/bg-state-attention/u); // STAGE_DOT_CLASS.running
      });

      await test.step('[12-E-006] list "Tiến độ theo tầng": running chip aria-current="true", status also in its text', async () => {
        await expect.soft(page.getByRole('list', { name: CHIPS, exact: true })).toBeVisible(); // ProcessingFloorChips.tsx:28-41
        await expect.soft(chips(page).first()).toHaveAttribute('aria-current', 'true');
        await expect.soft(chips(page).first()).toHaveText(new RegExp(`${floor.name}\\s*Đang xử lý`, 'u'));
      });

      await test.step('[12-E-010] "Đã xong x/y tầng" is announced from its own role=status outside the tabs; steps and chips stay out of live regions; the panel is a named region', async () => {
        // BUG-554 (FIX-2276) + R1-03 (FIX-2342): PR:285-296 — span[role=status] for the done clause, an always-present
        // div[role=status] for the partial notice, both outside the tabpanels; BUG-547 (FIX-2275): PPP:76,90 role=region.
        const live = await page.evaluate(() => {
          const near = (el: Element | null): string | null =>
            el?.closest('[aria-live], [role="status"], [role="alert"], [role="log"]')?.outerHTML.slice(0, 80) ?? null;
          const overallStatus = [...document.querySelectorAll('[role="status"]')].find((el) =>
            /^Đã xong \d+\/\d+ tầng$/u.test(el.textContent?.trim() ?? ''),
          );
          return {
            overallStatus: overallStatus?.outerHTML.slice(0, 80) ?? null,
            overallInTabpanel: overallStatus?.closest('[role="tabpanel"]') != null,
            partialRegion: overallStatus?.parentElement?.nextElementSibling?.getAttribute('role') ?? null,
            steps: near(document.querySelector('ol[aria-label="Các bước xử lý"]')),
            chips: near(document.querySelector('ul[aria-label="Tiến độ theo tầng"]')),
            logMounted: document.querySelector('[role="log"]') !== null,
          };
        });
        await attachJson('E03_12-E-010_live-regions.json', live);
        expect.soft(live.overallStatus, 'overall line inside role=status').not.toBeNull();
        expect.soft(live.overallInTabpanel, 'overall status outside the tabs').toBe(false);
        expect.soft(live.partialRegion, 'partial-notice live region present before any failure').toBe('status');
        expect.soft(live.steps, 'step list outside any live region').toBeNull();
        expect.soft(live.chips, 'floor chips outside any live region').toBeNull();
        expect.soft(live.logMounted, 'role=log only mounts with the "Nhật ký" tab').toBe(false);
        await expect.soft(overall(page)).toHaveRole('status');
        await expect.soft(page.getByRole('region', { name: PREVIEW, exact: true })).toBeVisible();
      });

      await test.step('[12-B-032] frame step=wallSegmentation → "Tách lớp tường" running, "Tiền xử lý" done (C3)', async () => {
        await settle(page, 400);
        await push('running', 'wallSegmentation', 20);
        await expect.poll(() => stepLine(page)).toBe(runningAt(1));
        await captureEvidence(page, 'E03_12-B-032_stage-walls.png');
      });

      await test.step('[12-B-033] frame step=openingAndFurnitureDetection → running, two earlier done', async () => {
        await settle(page, 400);
        await push('running', 'openingAndFurnitureDetection', 40);
        await expect.poll(() => stepLine(page)).toBe(runningAt(2));
      });

      await test.step('[12-C-005] then a #8 read answers step=preprocess → steps keep stage 3', async () => {
        // The focus floor listens on SSE; its only #8 read while running is the 120 s silence probe (PG:880-898).
        runs.progressOf.set(uid, ok(progress(uid, 'running', 'preprocess', 5)));
        const mark = runs.count(uid);
        await page.clock.fastForward(120_000);
        await expect.poll(() => runs.count(uid), { message: 'silence probe #8 read' }).toBeGreaterThan(mark);
        await settle(page);
        const line = await stepLine(page);
        await attachJson('E03_12-C-005_lower-read.json', { after: line, expected: runningAt(2) });
        // BUG-548 (FIX-2271): keepObservedDone keeps a stage seen `running` as well as `done` (PG:500-525,622,630).
        expect.soft(line, 'steps keep stage 3 after a lower read').toBe(runningAt(2));
        runs.progressOf.set(uid, ok(progress(uid, 'running', 'openingAndFurnitureDetection', 40)));
      });

      await test.step('[12-C-010] a slow #8 `pending` answer issued before a newer frame is ignored, bar not reset (P3-8)', async () => {
        let release = (): void => undefined;
        runs.progressOnce.set(uid, [{ body: progress(uid, 'pending', 'preprocess', 0), hold: new Promise<void>((resolve) => { release = resolve; }) }]);
        const mark = runs.count(uid);
        await page.clock.fastForward(120_000);
        await expect.poll(() => runs.count(uid), { message: 'held silence probe issued' }).toBeGreaterThan(mark);
        await push('running', 'openingAndFurnitureDetection', 45); // newer frame while the read is in flight
        await expect.poll(() => stepLine(page)).toBe(runningAt(2));
        release();
        await settle(page);
        expect.soft(await stepLine(page), 'late pending ignored').toBe(runningAt(2)); // PG:746-755 isLatePending
      });

      await test.step('[12-C-007] frame step="foo" → stages unchanged, percent held', async () => {
        await push('running', 'foo', 50);
        await settle(page);
        expect.soft(await stepLine(page)).toBe(runningAt(2)); // PG toStageBreakdown → unsupported, UPR:409-410
        runs.progressOf.set(uid, ok(progress(uid, 'running', 'openingAndFurnitureDetection', 50)));
      });

      await test.step('[12-B-034] frame step=dimensionReading → "Đọc kích thước" running, three earlier done', async () => {
        await settle(page, 400);
        await push('running', 'dimensionReading', 60);
        await expect.poll(() => stepLine(page)).toBe(runningAt(3));
      });

      await test.step('[12-C-004] (moved after [12-B-034]) "Còn khoảng {duration}" only on the running step row; overall "· Còn lại khoảng"', async () => {
        await expect.soft(stepRows(page).filter({ hasText: /Còn khoảng / })).toHaveCount(1); // UPR:177,1188-1190
        await expect.soft(stepRow(page, stageLabel('dimensionReading'))).toContainText(/Còn khoảng \S/u);
        await expect.soft(overallLine(page)).toHaveText(/^Đã xong 0\/1 tầng · Còn lại khoảng \S/u); // UPR:185,1342-1349; PR:288-291
        await expect.soft(overall(page), '"Còn lại khoảng …" outside the live region (R1-03)').toHaveText('Đã xong 0/1 tầng');
        await captureEvidence(page, 'E03_12-C-004_remaining-on-running-row.png');
      });

      const logFrames = (from: number, count: number): Record<string, unknown>[] =>
        Array.from({ length: count }, (_, i) => progress(uid, 'running', 'dimensionReading', 10 + ((from + i) % 80)));

      await test.step('[12-A-009] open "Nhật ký"; 30 frames arrive → the role=log box stays scrolled to the bottom', async () => {
        await tab(page, TAB_LOG).click();
        await expect(logBox(page)).toBeVisible();
        await sse.send(uid, logFrames(0, 30));
        await expect.poll(() => logBox(page).locator('li').count()).toBeGreaterThanOrEqual(30);
        await settle(page, 500);
        const at = await logBox(page).evaluate((el) => ({ top: el.scrollTop, height: el.scrollHeight, client: el.clientHeight }));
        await attachJson('E03_12-A-009_log-scroll.json', at);
        expect.soft(at.height > at.client, 'log overflows its 420 px box').toBe(true);
        expect.soft(at.top + at.client, 'scrolled to the bottom').toBeGreaterThanOrEqual(at.height - 2); // PLP:54-66
        await captureEvidence(page, 'E03_12-A-009_log-autoscroll.png');
      });

      await test.step('[12-A-010] press "Khoá cuộn tự động"; 10 more frames → scrollTop unchanged', async () => {
        const lock = page.getByRole('button', { name: LOCK_SCROLL, exact: true });
        await lock.click();
        await expect.soft(lock).toHaveAttribute('aria-pressed', 'true');
        const before = await logBox(page).evaluate((el) => el.scrollTop);
        const lines = await logBox(page).locator('li').count();
        await sse.send(uid, logFrames(30, 10));
        await expect.poll(() => logBox(page).locator('li').count()).toBeGreaterThan(lines);
        await settle(page, 500);
        expect.soft(await logBox(page).evaluate((el) => el.scrollTop), 'scrollTop unchanged while locked').toBe(before); // PLP:55-57
      });

      await test.step('[12-C-013] after 210 more distinct frames the log renders exactly the last 200 lines', async () => {
        const frames = logFrames(40, 210);
        await sse.send(uid, frames);
        const last = frames.at(-1)?.progressPercent;
        await expect(logBox(page).locator('li').last()).toContainText(new RegExp(`^.*Đọc kích thước — ${String(last)}\\s?%`, 'u'));
        await expect.soft(logBox(page).locator('li')).toHaveCount(200); // PLP:38,52 MAX_VISIBLE_LOG_LINES
        await expect.soft(logBox(page).getByText(/^Tiền xử lý — /u)).toHaveCount(0); // the oldest lines are gone
        await captureEvidence(page, 'E03_12-C-013_log-200-lines.png');
      });

      await test.step('[12-B-035] frame step=spatialDataBuild → "Dựng dữ liệu không gian" running, four earlier done', async () => {
        await push('running', 'spatialDataBuild', 80);
        await expect.poll(() => stepLine(page)).toBe(runningAt(4));
      });

      await test.step('[12-B-036] frame step=qualityCheck → "Kiểm tra chất lượng" running, five earlier done', async () => {
        await settle(page, 400);
        await push('running', 'qualityCheck', 92);
        await expect.poll(() => stepLine(page)).toBe(runningAt(5));
        await captureEvidence(page, 'E03_12-B-036_stage-quality.png');
      });

      await test.step('[12-C-003] remaining never reads "Còn lại khoảng 0 giây" (BUG-352)', async () => {
        const text = (await overallLine(page).textContent()) ?? '';
        await attachJson('E03_12-C-003_overall.json', { overall: text });
        expect.soft(text).not.toMatch(/Còn lại khoảng 0 giây/u); // UPR:424-432
        note('[12-C-003] 0 s only happens once every stage is done (completed); that line is checked in FL-12-13 [12-A-026]');
      });

      await test.step('[12-B-023] tab "Xem trước": sweep over the preview while running; reduced motion → static 1 px line', async () => {
        await tab(page, TAB_PREVIEW).click();
        const frame = page.locator(`[aria-label="${PREVIEW}"]`);
        await expect(frame).toBeVisible();
        await expect.soft(frame.locator('.animate-pipeline-sweep')).toHaveCount(1); // PPP:133-136
        await captureEvidence(page, 'E03_12-B-023_preview-sweep.png');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await expect.soft(frame.locator('.animate-pipeline-sweep')).toHaveCount(0);
        await expect.soft(frame.locator('div.left-1\\/2.w-px')).toHaveCount(1); // PPP:137-140 static line
        await captureEvidence(page, 'E03_12-B-023_preview-static-line.png');
      });

      await test.step('[12-E-012] reduced motion: no sweep, no done flash; final failed frame → PipelineFailure at once (no reveal)', async () => {
        await expect.soft(page.locator(`ol[aria-label="${STEPS}"] .animate-pipeline-sweep`)).toHaveCount(0); // PSL:147
        await page.evaluate(() => {
          const seen: string[] = [];
          (window as unknown as { __qaFlash: string[] }).__qaFlash = seen;
          new MutationObserver(() => {
            if (document.querySelector('.bg-bg-flash') !== null) seen.push('flash');
          }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
        });
        // A new run on the same upload (pending), then a frame at the last stage: five stages turn done at once.
        await push('pending', 'preprocess', 0);
        await expect.poll(() => stepLine(page)).toBe(ALL_QUEUED);
        await push('running', 'qualityCheck', 93);
        await expect.poll(() => stepLine(page)).toBe(runningAt(5));
        await settle(page, 1_200);
        const flashes = await page.evaluate(() => (window as unknown as { __qaFlash?: string[] }).__qaFlash ?? []);
        expect.soft(flashes, 'no done flash under reduced motion (PSL useDoneFlash)').toEqual([]);
        await push('failed', 'qualityCheck', 93, 'INTERNAL');
        const alert = page.getByRole('alert').filter({ hasText: summarySentence(stageLabel('qualityCheck'), floor.name) });
        await expect(alert).toBeVisible({ timeout: 5_000 });
        const reveal = await page.locator('div.grid.ease-enter').first().evaluate((el) => getComputedStyle(el).transitionDuration);
        await attachJson('E03_12-E-012_reveal.json', { transitionDuration: reveal, flashes });
        expect.soft(reveal, 'PipelineFailureReveal duration under reduced motion').toBe('0s'); // cssDurationMs → 0ms
        await captureEvidence(page, 'E03_12-E-012_failure-no-reveal.png');
      });
    } finally {
      await closeMocked(m);
      await deleteSeededProject(adminApi, project.projectId);
    }
  });

  test('FL-12-13 · [mocked response] SCR-12 background notify: run in background, leave, come back, completion and failure toasts', async ({ browser }) => {
    test.setTimeout(240_000);
    const project = await createProject(adminApi, '12-13', 1);
    const floor = project.floors[0];
    if (floor === undefined) throw new Error('fixture floor missing');
    let m: Mocked | undefined;
    let viewerSide: Mocked | undefined;
    try {
      m = await openMocked(browser, project.projectId);
      const { page, sse, runs, flow } = m;
      const [u1, u2, u3] = [fakeUploadId(), fakeUploadId(), fakeUploadId()];
      runs.uploads = [uploadOf(project, 0, u1)];
      runs.progressOf.set(u1, ok(progress(u1, 'running', 'wallSegmentation', 20)));
      await page.goto(ROUTES.project.pipeline(project.projectId));
      await sse.waitForConnections(u1);
      await sse.send(u1, [progress(u1, 'running', 'preprocess', 5)]);
      await page.waitForTimeout(400);
      await sse.send(u1, [progress(u1, 'running', 'wallSegmentation', 20)]);
      await expect.poll(() => stepLine(page)).toBe(runningAt(1));

      await test.step('[12-A-016] "Để chạy nền và thông báo cho tôi" → toast "Sẽ báo cho bạn khi xử lý xong" + its sentence; no /api write', async () => {
        const button = page.getByRole('button', { name: BACKGROUND, exact: true });
        await expect(button).toBeVisible(); // UPR:844 canRunInBackground (fold: E03 · SCR-12 [P8])
        await expect(page.getByRole('button', { name: CANCEL, exact: true })).toHaveCount(0); // PG supports.cancelProcessing false
        const mark = flow.sent.length;
        await button.click(); // UPR:878-927 runInBackground → notice
        await expect(toastWith(page, BG_STARTED)).toContainText(BG_STARTED_DESC);
        await settle(page);
        expect(writesSince(flow, mark), 'running in background writes nothing').toEqual([]);
        await captureEvidence(page, 'E03_12-A-016_background-started.png');
      });

      await test.step('[12-A-019] click it again → still one "Sẽ báo cho bạn khi xử lý xong" toast', async () => {
        await page.getByRole('button', { name: BACKGROUND, exact: true }).click(); // UPR:885-914: already in the registry
        await settle(page, 800);
        await expect.soft(toastWith(page, BG_STARTED)).toHaveCount(1);
      });

      await test.step('[12-A-027] in-app navigate away and back (same tab) → steps/percent not reset, log kept', async () => {
        await tab(page, TAB_LOG).click();
        const before = await logBox(page).locator('li').allTextContents();
        await spaNavigate(page, ROUTES.dashboard);
        await dashboardLoaded(page);
        await page.goBack();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.pipeline(project.projectId));
        await expect(chips(page)).toHaveCount(1);
        await settle(page);
        expect.soft(await stepLine(page), 'steps kept from the cache').toBe(runningAt(1)); // UPR:40-48,661-668
        await tab(page, TAB_LOG).click();
        const after = await logBox(page).locator('li').allTextContents();
        await attachJson('E03_12-A-027_log-kept.json', { before, after });
        expect.soft(after.some((line) => line.includes('Tiền xử lý')), 'pre-leave SSE lines still in the log (cache, not a fresh read)').toBe(true);
        await captureEvidence(page, 'E03_12-A-027_back-not-reset.png');
      });

      await test.step('[12-A-017] leave the screen; completed frame for u1 → toast "{floor} đã xử lý xong" / "Mở lại màn xử lý để xem kết quả."', async () => {
        await spaNavigate(page, ROUTES.dashboard);
        await dashboardLoaded(page);
        runs.progressOf.set(u1, ok(progress(u1, 'completed', 'qualityCheck', 100)));
        await sse.send(u1, [progress(u1, 'completed', 'qualityCheck', 100)]); // the background registry still holds this stream
        await expect.soft(toastWith(page, `${floor.name} đã xử lý xong`)).toContainText(BG_DONE_DESC); // UPR:158,163,267-274
        await captureEvidence(page, 'E03_12-A-017_background-done-toast.png');
      });

      await test.step('[12-A-026] N7 → u2 running; reload mid-run → re-seeded from #8, a new SSE request opens, completed frame → done', async () => {
        runs.uploads = [uploadOf(project, 0, u2)];
        runs.progressOf.set(u2, ok(progress(u2, 'running', 'spatialDataBuild', 80)));
        await page.goto(ROUTES.project.pipeline(project.projectId));
        await sse.waitForConnections(u2, 1);
        await expect.poll(() => stepLine(page)).toBe(runningAt(4));
        await page.reload();
        await sse.waitForConnections(u2, 2);
        await expect.poll(() => stepLine(page)).toBe(runningAt(4)); // UPR:642-686 seed from #8
        runs.progressOf.set(u2, ok(progress(u2, 'completed', 'qualityCheck', 100)));
        await sse.send(u2, [progress(u2, 'completed', 'qualityCheck', 100)]);
        await expect(overallLine(page)).toHaveText('Đã xong 1/1 tầng'); // no "Còn lại khoảng 0 giây" (BUG-352)
        await expect.soft(page.getByRole('region', { name: SUMMARY, exact: true })).toBeVisible();
        await attachJson('E03_12-A-026_sse-connections.json', { u2: sse.of(u2).map((c) => c.url) });
        await captureEvidence(page, 'E03_12-A-026_reload-then-done.png');
      });

      await test.step('[12-A-019] on a `pending` floor (upload still receiving) → the toast too; a second click adds none', async () => {
        // BUG-542 (FIX-2277): a `pending` floor is handed to the background registry like a running one (UPR:913-921).
        const u5 = fakeUploadId();
        runs.uploads = [uploadOf(project, 0, u5)];
        runs.progressOf.set(u5, ok(progress(u5, 'pending', 'preprocess', 0)));
        await page.goto(ROUTES.project.pipeline(project.projectId)); // full load: an empty background registry
        await expect(chip(page, floor.name)).toContainText('đang chờ');
        const button = page.getByRole('button', { name: BACKGROUND, exact: true });
        await button.click();
        await expect.soft(toastWith(page, BG_STARTED)).toContainText(BG_STARTED_DESC);
        await button.click(); // already in the registry → nothing new (UPR:919-921)
        await settle(page, 800);
        await expect.soft(toastWith(page, BG_STARTED)).toHaveCount(1);
        await captureEvidence(page, 'E03_12-A-019_pending-floor-toast.png');
      });

      await test.step('[12-A-018] N7 → u3 running; background, leave; failed frame → toast "{floor} gặp lỗi khi xử lý" / "Mở lại màn xử lý để xem chi tiết lỗi."', async () => {
        runs.uploads = [uploadOf(project, 0, u3)];
        runs.progressOf.set(u3, ok(progress(u3, 'running', 'dimensionReading', 60)));
        await page.goto(ROUTES.project.pipeline(project.projectId));
        await sse.waitForConnections(u3);
        await page.getByRole('button', { name: BACKGROUND, exact: true }).click();
        await expect(toastWith(page, BG_STARTED)).toBeVisible();
        await spaNavigate(page, ROUTES.dashboard);
        await dashboardLoaded(page);
        runs.progressOf.set(u3, ok(progress(u3, 'failed', 'dimensionReading', 60, { error: 'FILE_CORRUPT' })));
        await sse.send(u3, [progress(u3, 'failed', 'dimensionReading', 60, { error: 'FILE_CORRUPT' })]);
        await expect.soft(toastWith(page, `${floor.name} gặp lỗi khi xử lý`)).toContainText(BG_FAILED_DESC); // UPR:159,166
        await captureEvidence(page, 'E03_12-A-018_background-failed-toast.png');
      });

      await test.step('[12-D-008] viewer member, same live-run mocks → "Để chạy nền và thông báo cho tôi" offered (no role gate)', async () => {
        const viewer = await poolUser(adminApi, 'viewer');
        await addProjectMember(adminApi, project.projectId, viewer.email);
        viewerSide = await openMocked(browser, project.projectId, viewer);
        const u4 = fakeUploadId();
        viewerSide.runs.uploads = [uploadOf(project, 0, u4)];
        viewerSide.runs.progressOf.set(u4, ok(progress(u4, 'running', 'wallSegmentation', 20)));
        await viewerSide.page.goto(ROUTES.project.pipeline(project.projectId));
        await expect(chips(viewerSide.page)).toHaveCount(1);
        await expect.soft(viewerSide.page.getByRole('button', { name: BACKGROUND, exact: true })).toBeVisible(); // PR:93-97, UPR:844
        await captureEvidence(viewerSide.page, 'E03_12-D-008_viewer-background.png');
      });
    } finally {
      await closeMocked(viewerSide);
      await closeMocked(m);
      await deleteSeededProject(adminApi, project.projectId);
    }
  });

  test('FL-12-14 · [mocked response] SCR-12 multi-floor live runs: polling, partial results, failed-floor notice, superseded and deleted floors', async ({ browser }) => {
    test.setTimeout(360_000);
    const project = await createProject(adminApi, '12-14', 3);
    const [f1, f2, f3] = project.floors;
    if (f1 === undefined || f2 === undefined || f3 === undefined) throw new Error('fixture floors missing');
    let m: Mocked | undefined;
    try {
      m = await openMocked(browser, project.projectId, readAdminCredentials(), { clock: true });
      const { page, sse, runs } = m;
      const [u1, u2, u3] = [fakeUploadId(), fakeUploadId(), fakeUploadId()];
      runs.uploads = [uploadOf(project, 0, u1), uploadOf(project, 1, u2), uploadOf(project, 2, u3)];
      for (const uid of [u1, u2, u3]) runs.progressOf.set(uid, ok(progress(uid, 'pending', 'preprocess', 0)));
      const set = (uid: string, body: Record<string, unknown>): void => {
        runs.progressOf.set(uid, ok(body));
      };
      /** Floor 1 (the SSE focus): one frame, #8 kept in step for the silence probe. */
      const pushU1 = async (body: Record<string, unknown>): Promise<void> => {
        set(u1, body);
        await sse.send(u1, [body]);
      };
      const reloadWith = async (uploads: UploadItem[]): Promise<number> => {
        runs.uploads = uploads;
        const mark = runs.count('n7');
        await page.reload();
        await expect(chips(page)).toHaveCount(uploads.length);
        return mark;
      };

      await test.step('[12-B-005] all floors #8 pending → six steps queued, chips "đang chờ"; clock +30 s → one more #8 read for floor 3', async () => {
        await page.goto(ROUTES.project.pipeline(project.projectId));
        await expect(chips(page)).toHaveCount(3);
        for (const f of [f1, f2, f3]) await expect.soft(chip(page, f.name)).toContainText('đang chờ');
        expect.soft(await stepLine(page)).toBe(ALL_QUEUED); // PG pending → six queued
        await settle(page);
        const mark = runs.count(u3);
        await page.clock.fastForward(30_000); // PG:104 PENDING_POLL_INTERVAL_MS
        await expect.poll(() => runs.count(u3)).toBe(mark + 1);
        await captureEvidence(page, 'E03_12-B-005_pending-floors.png');
      });

      await test.step('[12-B-037] floors 1-2 running: only floor 1 opens an EventSource; clock +5 s → floor 2 #8 polled', async () => {
        await sse.waitForConnections(u1);
        await pushU1(progress(u1, 'running', 'preprocess', 5));
        set(u2, progress(u2, 'running', 'preprocess', 5));
        await page.clock.fastForward(30_000); // floor 2 leaves `pending`: its channel reopens at 5 s (PG:937-999)
        await expect.soft(chip(page, f2.name)).toContainText('Đang xử lý');
        await settle(page, 500);
        const mark = runs.count(u2);
        await page.clock.fastForward(5_000); // PG:102 OTHER_FLOOR_POLL_INTERVAL_MS
        await expect.poll(() => runs.count(u2)).toBeGreaterThan(mark);
        expect.soft({ u1: sse.of(u1).length > 0, u2: sse.of(u2).length, u3: sse.of(u3).length }, 'one EventSource, for the focus floor').toEqual({ u1: true, u2: 0, u3: 0 });
      });

      await test.step('[12-C-002] overall "· Còn lại khoảng {duration}" = the slowest floor\'s estimate', async () => {
        for (const step of ['wallSegmentation', 'openingAndFurnitureDetection', 'dimensionReading'] as const) {
          await settle(page, 400);
          await pushU1(progress(u1, 'running', step, 30));
        }
        await expect.poll(() => stepLine(page)).toBe(runningAt(3));
        for (const step of ['wallSegmentation', 'openingAndFurnitureDetection', 'dimensionReading'] as const) {
          set(u2, progress(u2, 'running', step, 30));
          const mark = runs.count(u2);
          await page.clock.fastForward(60_000); // floor 2's stages last a minute each: the slow floor
          await expect.poll(() => runs.count(u2)).toBeGreaterThan(mark);
          await settle(page, 300);
        }
        const focus = (await stepRow(page, stageLabel('dimensionReading')).textContent()) ?? '';
        const line = (await overallLine(page).textContent()) ?? '';
        const focusS = durationSeconds(/Còn khoảng (.+)$/u.exec(focus)?.[1] ?? '');
        const overallS = durationSeconds(/Còn lại khoảng (.+)$/u.exec(line)?.[1] ?? '');
        await attachJson('E03_12-C-002_remaining.json', { focusRow: focus, overall: line, focusS, overallS });
        expect.soft(overallS, 'overall uses the slowest floor (floor 2)').toBeGreaterThan(focusS); // UPR:1342-1349
        expect.soft(overallS).toBeGreaterThanOrEqual(60);
        await captureEvidence(page, 'E03_12-C-002_slowest-floor-remaining.png');
      });

      await test.step('[12-B-009] floor 1 (focus) failed frame FILE_CORRUPT → its step row shows the sentence + "FILE_CORRUPT"', async () => {
        // Only the focus floor's steps are drawn (UPR steps = focusRecord; focus = first running floor, else floor 1):
        // floor 2 finishes first so floor 1 stays the focus once it fails.
        set(u2, progress(u2, 'completed', 'qualityCheck', 100));
        await page.clock.fastForward(5_000);
        await expect(chip(page, f2.name)).toContainText('đã xong');
        await pushU1(progress(u1, 'failed', 'dimensionReading', 60, { error: 'FILE_CORRUPT' }));
        const row = stepRow(page, stageLabel('dimensionReading'));
        await expect.soft(row).toContainText(FILE_CORRUPT_SENTENCE); // PSL:223-230
        await expect.soft(row).toContainText('FILE_CORRUPT');
        await expect.soft(nextSteps(page)).toHaveCount(0); // floor 3 still pending: no PipelineFailure
        await captureEvidence(page, 'E03_12-B-009_failed-step-row.png');
      });

      await test.step('[12-B-030] chip "lỗi" with the violation dot; cross icon on the failed step', async () => {
        await expect.soft(chip(page, f1.name)).toContainText('lỗi');
        await expect.soft(chipDot(page, f1.name)).toHaveClass(/bg-state-violation/u);
        await expect.soft(stepRow(page, stageLabel('dimensionReading')).locator('svg circle')).toHaveCount(1); // PSL:103-115
      });

      await test.step('[12-B-008] chip "lỗi" + "{floor 1} gặp lỗi. Các tầng còn lại vẫn đang được xử lý."; no PipelineFailure yet', async () => {
        set(u3, progress(u3, 'running', 'preprocess', 5));
        await page.clock.fastForward(30_000);
        await expect.soft(chip(page, f3.name)).toContainText('Đang xử lý');
        await expect.soft(page.getByText(partialNotice(f1.name), { exact: true })).toBeVisible(); // UPR:1352-1361
        await expect.soft(nextSteps(page)).toHaveCount(0);
        await captureEvidence(page, 'E03_12-B-008_partial-failed-notice.png');
      });

      const u1b = fakeUploadId();
      const u2b = fakeUploadId();
      await test.step('[12-C-006] a failed read at dimensionReading on a fresh record → earlier stages not promoted to done (C1) [shown on floor 1]', async () => {
        // Floor 2's rows are never drawn while floor 1 is listed (focus = first running floor, else floor 1), so the
        // same fresh-record failure is put on BOTH floors after a reload and read on floor 1.
        set(u1b, progress(u1b, 'failed', 'dimensionReading', 60, { error: 'FILE_CORRUPT' }));
        set(u2b, progress(u2b, 'failed', 'dimensionReading', 60, { error: 'FILE_CORRUPT' }));
        set(u3, progress(u3, 'pending', 'preprocess', 0));
        await reloadWith([uploadOf(project, 0, u1b), uploadOf(project, 1, u2b), uploadOf(project, 2, u3)]);
        await expect.poll(() => stepLine(page)).toBe('queued,queued,queued,failed,queued,queued'); // PG:599-611
        await captureEvidence(page, 'E03_12-C-006_fresh-failed-no-promotion.png');
      });

      await test.step('[12-C-022] the notice joins both failed floor names with ", " while floor 3 runs', async () => {
        set(u3, progress(u3, 'running', 'preprocess', 5));
        await page.clock.fastForward(30_000);
        await expect.soft(chip(page, f3.name)).toContainText('Đang xử lý');
        await expect.soft(page.getByText(partialNotice(`${f1.name}, ${f2.name}`), { exact: true })).toBeVisible();
        await captureEvidence(page, 'E03_12-C-022_two-failed-names.png');
      });

      const u1c = fakeUploadId();
      const u2c = fakeUploadId();
      await test.step('[12-B-007] reload, N7 2 floors: floor 1 completed, floor 2 running → "Báo cáo tổng kết" for floor 1 and "Đã xong 1/2 tầng"', async () => {
        set(u1c, progress(u1c, 'completed', 'qualityCheck', 100));
        set(u2c, progress(u2c, 'running', 'wallSegmentation', 20));
        await reloadWith([uploadOf(project, 0, u1c), uploadOf(project, 1, u2c)]);
        await expect.soft(page.getByRole('region', { name: SUMMARY, exact: true })).toBeVisible(); // UPR:1223-1251
        await expect.soft(overall(page)).toHaveText(/^Đã xong 1\/2 tầng/u);
        await captureEvidence(page, 'E03_12-B-007_partial-summary.png');
      });

      /** One #8 READ failing with 503: the GET is retried 3 times (src/lib/http/retry.ts RETRY_DELAYS_MS), so 4 answers. */
      const fail503Once = (uid: string): void => {
        runs.progressOnce.set(uid, Array.from({ length: 4 }, () => wireError(503, 'SERVICE_UNAVAILABLE')));
      };

      await test.step('[12-B-012] floor 2 #8 503 (one read) → only its chip "lỗi"; floor 2 reads #8 again; the next good read clears it', async () => {
        await sse.waitForConnections(u2c); // floor 2 is the focus (running): SSE, read by the 120 s silence probe
        fail503Once(u2c);
        await page.clock.fastForward(120_000);
        await expect.soft(chip(page, f2.name)).toContainText('lỗi'); // UPR:422-430,989
        await expect.soft(chip(page, f1.name)).toContainText('đã xong');
        await captureEvidence(page, 'E03_12-B-012_one-read-failed.png');
        const mark = runs.count(u2c);
        await page.clock.fastForward(120_000); // re-armed probe → good read
        await expect.poll(() => runs.count(u2c)).toBeGreaterThan(mark);
        await expect.soft(chip(page, f2.name)).toContainText('Đang xử lý');
      });

      await test.step('[12-C-023] floor 2 only fails a READ (503) while floor 1 is done → chip "lỗi" but no "{tầng} gặp lỗi…" notice', async () => {
        // BUG-553 (FIX-2282): the notice names only floors the SERVER reports failed (UPR:766-770), and its clause
        // "Các tầng còn lại vẫn đang được xử lý." only while another floor is non-final (UPR:197-199,1352-1361). The short
        // variant "{tầng} gặp lỗi." (no floor left running) never renders: every floor is then final and S-11 replaces
        // the screen (UPR:1400-1410, container) — it is pinned by vitest useProcessingScreen.test.ts "BUG-553 …".
        fail503Once(u2c);
        await page.clock.fastForward(120_000);
        await expect.soft(chip(page, f2.name)).toContainText('lỗi'); // read error: chip only (UPR:461-464)
        await expect.soft(chip(page, f1.name)).toContainText('đã xong');
        await expect.soft(partialRegion(page)).toHaveText('');
        await expect.soft(page.getByText(/gặp lỗi\./u)).toHaveCount(0);
        await captureEvidence(page, 'E03_12-C-023_read-error-no-notice.png');
      });

      await test.step('[12-B-013] floor 2 #8 404 → polling stops, N7 re-read once, floor 2 drops out of the chips', async () => {
        runs.progressOnce.delete(u2c);
        runs.progressOf.set(u2c, wireError(404, 'NOT_FOUND'));
        runs.uploads = [uploadOf(project, 0, u1c)];
        const n7 = runs.count('n7');
        await page.clock.fastForward(120_000);
        await expect(chips(page)).toHaveCount(1); // PG:663-667 isTerminal → UPR:1136-1140 N7 re-read
        expect.soft(runs.count('n7') - n7, 'N7 re-read once').toBe(1);
        const mark = runs.count(u2c);
        await page.clock.fastForward(120_000);
        await settle(page);
        expect.soft(runs.count(u2c), 'no #8 read after the 404').toBe(mark);
        await captureEvidence(page, 'E03_12-B-013_floor-gone.png');
      });

      for (const [row, code, sentence] of [
        ['12-B-044', 'PIPELINE_SUPERSEDED', 'Lượt xử lý này đã được thay bằng một lượt mới hơn.'],
        ['12-B-045', 'FLOOR_DELETED', 'Tầng của lượt xử lý này đã bị xoá.'],
      ] as const) {
        await test.step(`[${row}] #8 failed ${code} → chip "đang chờ", no PipelineFailure, N7 re-read once; "${sentence}" never shown`, async () => {
          const uid = fakeUploadId();
          set(uid, progress(uid, 'failed', 'wallSegmentation', 20, { error: code }));
          const n7 = await reloadWith([uploadOf(project, 0, u1c), uploadOf(project, 1, uid)]);
          await expect.soft(chip(page, f2.name)).toContainText('đang chờ'); // UPR runStatusOf reload → queued
          await expect.poll(() => runs.count('n7') - n7, { message: 'N7: page load + one re-read' }).toBe(2);
          await settle(page);
          expect.soft(runs.count('n7') - n7, 'no second re-read').toBe(2);
          await expect.soft(nextSteps(page)).toHaveCount(0);
          await expect.soft(page.getByText(sentence)).toHaveCount(0); // PET:51-52 action "reload"
          if (row === '12-B-044') await captureEvidence(page, 'E03_12-B-044_superseded-reload.png');
        });
      }
    } finally {
      await closeMocked(m);
      await deleteSeededProject(adminApi, project.projectId);
    }
  });

  test('FL-12-15 · [mocked response] SCR-12 PipelineFailure copy and action group for every server error code', async ({ browser }) => {
    test.setTimeout(360_000);
    const project = await createProject(adminApi, '12-15', 1);
    const floor = project.floors[0];
    if (floor === undefined) throw new Error('fixture floor missing');
    let m: Mocked | undefined;
    try {
      m = await openMocked(browser, project.projectId);
      const { page, runs } = m;
      const uid = fakeUploadId();
      runs.uploads = [uploadOf(project, 0, uid)];
      let loaded = false;
      /** #8 answers `failed` with `error`/`step` (final run, no SSE); the page (re)loads and S-11 replaces the screen. */
      const openFailure = async (body: Record<string, unknown>): Promise<void> => {
        runs.progressOf.set(uid, ok(body));
        if (loaded) await page.reload();
        else await page.goto(ROUTES.project.pipeline(project.projectId));
        loaded = true;
      };
      type Group = 'retry' | 'reupload' | 'contactAdmin';
      /** The S-11 alert for `code` at `step`, its sentence and the action group (UPF:785-806, PFA:125-145). */
      const checkCode = async (code: string, step: string, sentence: string, group: Group): Promise<Locator> => {
        await openFailure(progress(uid, 'failed', step, 40, { error: code }));
        const alert = page.getByRole('alert').filter({ hasText: summarySentence(stageLabel(step), floor.name) });
        await expect(alert).toBeVisible();
        await expect.soft(alert).toContainText(sentence);
        const row = nextSteps(page);
        if (group === 'retry') {
          await expect.soft(alert.getByRole('button', { name: RERUN_BY_UPLOAD, exact: true })).toBeVisible();
          await expect.soft(row.getByRole('button', { name: RETRY_LOWER, exact: true })).toBeVisible();
        } else if (group === 'reupload') {
          await expect.soft(alert.getByRole('button', { name: UPLOAD_CLEARER, exact: true })).toBeVisible();
          await expect.soft(row.getByRole('button', { name: RETRY_LOWER, exact: true })).toBeVisible();
        } else {
          await expect.soft(alert.getByRole('button')).toHaveCount(0);
          for (const name of [RETRY_LOWER, UPLOAD_CLEARER]) await expect.soft(row.getByRole('button', { name, exact: true })).toBeVisible();
        }
        await expect.soft(row.getByRole('button', { name: SKIP_FLOOR, exact: true })).toBeVisible();
        await expect.soft(row.getByRole('button', { name: RETRY_STEP })).toBeVisible();
        await expect.soft(page.getByText(code, { exact: true }).first()).toBeVisible(); // PFA code label (server code, no request id)
        return alert;
      };

      const cases: readonly (readonly [string, string, string, string, Group, boolean])[] = [
        ['12-B-046', 'PIPELINE_STALLED', 'wallSegmentation', 'Bước xử lý dừng lại quá lâu mà không tiến thêm.', 'retry', true],
        ['12-B-047', 'PIPELINE_STEP_TIMEOUT', 'wallSegmentation', 'Bước xử lý chạy quá thời gian cho phép.', 'retry', false],
        ['12-B-048', 'PIPELINE_ARTIFACT_MISSING', 'spatialDataBuild', 'Hệ thống không tìm thấy kết quả trung gian của bước trước.', 'retry', false],
        ['12-B-049', 'GPU_LOCK_LOST', 'wallSegmentation', 'Hệ thống mất quyền dùng bộ xử lý đồ hoạ giữa chừng.', 'retry', false],
        ['12-B-050', 'RETRY_EXHAUSTED', 'dimensionReading', 'Bước xử lý đã thử lại hết số lần cho phép.', 'retry', false],
        ['12-B-051', 'TASK_TIMEOUT', 'dimensionReading', 'Tác vụ xử lý chạy quá thời gian cho phép.', 'retry', false],
        ['12-B-052', 'WORKER_LOST', 'openingAndFurnitureDetection', 'Máy xử lý ngừng phản hồi giữa chừng.', 'retry', true],
      ];
      for (const [row, code, step, sentence, group, ev] of cases) {
        await test.step(`[${row}] ${code} → "${sentence}" (${group} group)`, async () => {
          await checkCode(code, step, sentence, group);
          if (ev) await captureEvidence(page, `E03_${row}_${code.toLowerCase().replace(/_/gu, '-')}.png`);
        });
      }

      await test.step('[12-C-026] WORKER_LOST: InlineAlert action "Tải lại bản vẽ để chạy lượt mới" → /projects/:id/upload; go back', async () => {
        const alert = page.getByRole('alert').filter({ hasText: 'Máy xử lý ngừng phản hồi giữa chừng.' });
        await alert.getByRole('button', { name: RERUN_BY_UPLOAD, exact: true }).click(); // UPF:758-760
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.upload(project.projectId));
        await captureEvidence(page, 'E03_12-C-026_rerun-to-upload.png');
        await page.goBack();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.pipeline(project.projectId));
        await expect.soft(alert).toBeVisible();
      });

      const more: readonly (readonly [string, string, string, string, Group, boolean])[] = [
        ['12-B-055', 'PDF_UNREADABLE', 'preprocess', 'Tệp PDF không đọc được.', 'reupload', false],
        ['12-B-056', 'FILE_TYPE_MISMATCH', 'preprocess', 'Nội dung tệp không khớp với loại tệp đã khai.', 'reupload', false],
        ['12-B-057', 'VALIDATION', 'preprocess', 'Bản vẽ có trang sai hoặc nhiều hơn 20 trang.', 'reupload', false],
        ['12-B-058', 'CAD_NOT_SUPPORTED', 'preprocess', 'Hệ thống chưa nhận tệp CAD ở bước này.', 'reupload', false],
        ['12-B-059', 'PIPELINE_ARTIFACT_INVALID', 'spatialDataBuild', 'Kết quả trung gian dựng từ bản vẽ không hợp lệ.', 'reupload', false],
        ['12-B-060', 'PIPELINE_BUILD_INVALID', 'spatialDataBuild', 'Mô hình dựng từ bản vẽ không hợp lệ.', 'reupload', false],
        ['12-B-061', 'MODEL_PIN_MISMATCH', 'wallSegmentation', 'Phiên bản mô hình đang chạy không khớp với phiên bản đã ghim.', 'contactAdmin', true],
        ['12-B-062', 'PIPELINE_RESULT_INVALID', 'spatialDataBuild', 'Kết quả xử lý không qua được bước kiểm tra của hệ thống.', 'contactAdmin', false],
        ['12-B-063', 'LAYER_INTEGRITY_BROKEN', 'spatialDataBuild', 'Dữ liệu lớp của tầng không còn toàn vẹn.', 'contactAdmin', false],
        ['12-B-064', 'LAYER_LEVEL_MISMATCH', 'spatialDataBuild', 'Dữ liệu lớp không khớp với tầng đang xử lý.', 'contactAdmin', false],
        ['12-B-065', 'REVIEW_BY_AI_FORBIDDEN', 'spatialDataBuild', 'Hệ thống không cho mô hình ghi vào phần đã duyệt.', 'contactAdmin', false],
        ['12-B-066', 'MODEL_CHECKSUM_MISMATCH', 'wallSegmentation', 'Tệp mô hình không khớp mã kiểm tra.', 'contactAdmin', false],
        ['12-B-067', 'MODEL_FORMAT_UNSUPPORTED', 'wallSegmentation', 'Định dạng tệp mô hình chưa được hỗ trợ.', 'contactAdmin', false],
        ['12-B-068', 'MODEL_NOT_FOUND', 'wallSegmentation', 'Hệ thống không tìm thấy mô hình cần dùng.', 'contactAdmin', false],
        ['12-B-069', 'MODEL_VERSION_FAMILY_MISMATCH', 'wallSegmentation', 'Phiên bản mô hình không thuộc đúng dòng mô hình.', 'contactAdmin', false],
        ['12-B-070', 'ML_DEVICE_UNAVAILABLE', 'wallSegmentation', 'Hệ thống không có thiết bị xử lý mô hình sẵn sàng.', 'contactAdmin', false],
        ['12-B-071', 'INTERNAL', 'qualityCheck', 'Hệ thống gặp lỗi nội bộ khi xử lý.', 'contactAdmin', true],
      ];
      for (const [row, code, step, sentence, group, ev] of more) {
        await test.step(`[${row}] ${code} → "${sentence}" (${group})`, async () => {
          await checkCode(code, step, sentence, group);
          if (ev) await captureEvidence(page, `E03_${row}_${code.toLowerCase().replace(/_/gu, '-')}.png`);
        });
      }

      await test.step('[12-C-027] INTERNAL: no primary, InlineAlert without action, all three directions in the row', async () => {
        const alert = page.getByRole('alert').filter({ hasText: 'Hệ thống gặp lỗi nội bộ khi xử lý.' });
        await expect.soft(alert.getByRole('button')).toHaveCount(0); // UPF:785,795 action contactAdmin
        for (const name of [RETRY_LOWER, UPLOAD_CLEARER, SKIP_FLOOR]) {
          await expect.soft(nextSteps(page).getByRole('button', { name, exact: true })).toBeVisible();
        }
      });

      await test.step('[12-B-072] SEG-2041 → the unclassified sentence, code printed "SEG-2041", no primary action', async () => {
        await openFailure(progress(uid, 'failed', 'wallSegmentation', 20, { error: 'SEG-2041' }));
        const alert = page.getByRole('alert').filter({ hasText: summarySentence(stageLabel('wallSegmentation'), floor.name) });
        await expect(alert).toContainText(FALLBACK_SENTENCE); // PET:84,96-105
        await expect.soft(page.getByText('SEG-2041', { exact: true }).first()).toBeVisible();
        await expect.soft(alert.getByRole('button')).toHaveCount(0);
        await captureEvidence(page, 'E03_12-B-072_unknown-code.png');
      });

      /** BUG-549 (FIX-2279): a failed run without a code reaches S-11 as PROCESSING with the unclassified sentence. */
      const checkNoCode = async (body: Record<string, unknown>): Promise<void> => {
        await openFailure(body);
        const alert = page.getByRole('alert').filter({ hasText: summarySentence(stageLabel('wallSegmentation'), floor.name) });
        await expect(alert).toContainText(FALLBACK_SENTENCE); // UPF:890-896 serverError branch, PET:96-100
        await expect.soft(page.getByText(NO_CODE, { exact: true }).first()).toBeVisible(); // UPF:575-577 server code
        await expect.soft(page.getByRole('button', { name: COPY_CODE })).toBeVisible();
        await expect.soft(alert.getByRole('button')).toHaveCount(0); // unknown code → action contactAdmin
        await expect.soft(page.getByText(detailUnsupportedSummary(floor.name))).toHaveCount(0);
      };

      await test.step('[12-B-073] error "" → S-11 with code PROCESSING and "Bước xử lý gặp lỗi mà hệ thống chưa phân loại được."', async () => {
        // BE writes `error_code or ""` (apps/api/drawings/progress.py:66-67); ProgressSchema now reads "" as "no code"
        // (src/api/schemas/index.ts:173-185) instead of rejecting the whole read.
        await checkNoCode(progress(uid, 'failed', 'wallSegmentation', 20, { error: '' }));
        await expect.soft(readAlert(page)).toHaveCount(0);
        await captureEvidence(page, 'E03_12-B-073_empty-error-processing.png');
      });

      await test.step('[12-B-074] failed without `error` → the same PROCESSING failure (no "Chưa đọc được chi tiết …")', async () => {
        await checkNoCode(progress(uid, 'failed', 'wallSegmentation', 20));
        await captureEvidence(page, 'E03_12-B-074_no-error-field.png');
      });
    } finally {
      await closeMocked(m);
      await deleteSeededProject(adminApi, project.projectId);
    }
  });

  test('FL-12-16 · [mocked response] SCR-12 read errors and recovery: N7 500/422, #8 503, #24 500, offline, settings/N16 500, clipboard refused', async ({ browser }) => {
    test.setTimeout(300_000);
    const project = await createProject(adminApi, '12-16', 1);
    const floor = project.floors[0];
    if (floor === undefined) throw new Error('fixture floor missing');
    let m: Mocked | undefined;
    let fresh: Flow | undefined;
    try {
      m = await openMocked(browser, project.projectId);
      const { page, runs, flow } = m;
      const pipeline = ROUTES.project.pipeline(project.projectId);
      const n7Reads = (status: number): number =>
        flow.log.filter((e) => e.method === 'GET' && e.path === `/api/projects/${project.projectId}/drawings/uploads/latest` && e.status === status).length;

      await test.step('[12-B-010] N7 500 → InlineAlert + "Thử lại" + technical code + "Liên hệ hỗ trợ"; columns still drawn', async () => {
        runs.n7Answer = wireError(500, 'INTERNAL');
        await page.goto(pipeline);
        // PR:259-273 (fold: E03 · SCR-12 [P13] N7 read 500 → alert "Thử lại" + technical code + "Liên hệ hỗ trợ")
        const alert = readAlert(page);
        await expect(alert).toBeVisible({ timeout: 45_000 });
        await expect(alert.locator('h4')).toHaveText(/\S/u);
        await expect(page.getByRole('button', { name: SUPPORT, exact: true })).toBeVisible();
        const code = page.locator('span.font-mono').first();
        await expect(code).toHaveText(/\S+/u);
        await expect(page.locator(`ol[aria-label="${STEPS}"]`)).toHaveCount(1); // state error → the two columns
        await expect(page.getByRole('tablist', { name: TABS, exact: true })).toBeVisible();
        await attachJson('E03_12-B-010_read-500.json', { title: await alert.locator('h4').innerText(), code: await code.innerText() });
        await captureEvidence(page, 'E03_12-B-010_read-error-alert.png');
      });

      await test.step('[12-E-009] the alert has role=alert; Tab reaches "Thử lại" then "Liên hệ hỗ trợ"', async () => {
        const retry = readAlert(page).getByRole('button', { name: RETRY, exact: true });
        await retry.focus();
        await expect.soft(retry).toBeFocused();
        await page.keyboard.press('Tab');
        await expect.soft(page.getByRole('button', { name: SUPPORT, exact: true })).toBeFocused(); // PR:261-271 DOM order
      });

      await test.step('[12-A-022] unroute; "Thử lại" → N7 re-read, real empty state "Chưa có bước nào để theo dõi"', async () => {
        runs.n7Answer = 'real';
        const mark = n7Reads(200);
        await readAlert(page).getByRole('button', { name: RETRY, exact: true }).click(); // UPR:826-829 invalidate N7 + #8
        await expect(page.getByText(EMPTY_TITLE, { exact: true })).toBeVisible();
        expect(n7Reads(200), 'real N7 read after "Thử lại"').toBeGreaterThan(mark);
        note('[12-A-022] no upload on the real project, so no #8 to re-read');
        await captureEvidence(page, 'E03_12-A-022_retry-recovers.png');
      });

      await test.step('[12-A-023] N7 500 again, reload, "Liên hệ hỗ trợ" → /tai-khoan; go back', async () => {
        runs.n7Answer = wireError(500, 'INTERNAL');
        await page.reload();
        await expect(page.getByRole('button', { name: SUPPORT, exact: true })).toBeVisible({ timeout: 45_000 });
        await page.getByRole('button', { name: SUPPORT, exact: true }).click(); // UPR:831-840
        await expect.poll(() => pathOf(page)).toBe(ROUTES.account);
        await captureEvidence(page, 'E03_12-A-023_support-account.png');
        await page.goBack();
        await expect.poll(() => pathOf(page)).toBe(pipeline);
      });

      await test.step('[12-B-016] N7 422 CURSOR_INVALID once → exactly one re-read from page one, the screen renders (no alert)', async () => {
        runs.n7Answer = 'real';
        runs.n7Once.push(wireError(422, 'CURSOR_INVALID'));
        const mark = runs.count('n7');
        await page.reload();
        await expect(page.getByText(EMPTY_TITLE, { exact: true })).toBeVisible();
        await settle(page);
        expect.soft(runs.count('n7') - mark, '422 + one re-read').toBe(2); // PG:827-833
        await expect.soft(readAlert(page)).toHaveCount(0);
      });

      await test.step('[12-B-015] offline, in-app navigate to /pipeline → NETWORK read-error alert with "Thử lại" + "Liên hệ hỗ trợ"; online → recovers', async () => {
        // BUG-551 (FIX-2281): a read paused by TanStack (fetchStatus "paused") is a NETWORK read error (UPR:746-761,797);
        // back online the paused reads resume by themselves.
        // The lazy route chunk must be in the page first: an unknown project's pipeline loads it (404, no N7 cache).
        await page.goto(ROUTES.project.pipeline(`prj_qa-e03-${Date.now().toString(36)}`));
        await expect(page.getByText('Không tìm thấy dự án này', { exact: true })).toBeVisible({ timeout: 30_000 });
        await flow.context.setOffline(true);
        await spaNavigate(page, pipeline);
        const alert = readAlert(page);
        await expect(alert).toBeVisible({ timeout: 15_000 });
        await expect.soft(page.getByRole('button', { name: SUPPORT, exact: true })).toBeVisible();
        await expect.soft(page.locator('span.font-mono').first()).toContainText('NETWORK'); // src/lib/errors/kinds.ts:50-51
        await expect.soft(skeletonRows(page)).toHaveCount(0);
        await attachJson('E03_12-B-015_offline.json', { code: await page.locator('span.font-mono').first().innerText() });
        await captureEvidence(page, 'E03_12-B-015_offline-network-alert.png');
        await flow.context.setOffline(false);
        await expect(page.getByText(EMPTY_TITLE, { exact: true })).toBeVisible({ timeout: 30_000 });
        await expect.soft(alert).toHaveCount(0);
      });

      await test.step('[12-B-017] fresh context, #24 500 → breadcrumb without the project name, screen otherwise normal', async () => {
        fresh = await openFlow(browser, readAdminCredentials());
        await fresh.page.route(
          (url) => url.pathname === `/api/projects/${project.projectId}`,
          (route) => (route.request().method() === 'GET' ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL', message: 'qa', requestId: 'qa-24' }) }) : route.fallback()),
        );
        await fresh.page.goto(pipeline);
        await expect(fresh.page.getByText(EMPTY_TITLE, { exact: true })).toBeVisible();
        await settle(fresh.page, 2_500); // #24 retried once (queryClient retry 1)
        const crumb = fresh.page.getByRole('navigation', { name: 'Xử lý', exact: true });
        // BUG-546 (FIX-2274): shared Breadcrumb, "›" is aria-hidden with no spaces in the DOM (Breadcrumb.tsx:38-46).
        await expect.soft(crumb).toHaveText(/^Dự án\s*›\s*Xử lý$/u);
        await expect.soft(crumb).not.toContainText(project.name);
        await captureEvidence(fresh.page, 'E03_12-B-017_breadcrumb-no-name.png');
        await closeFlow(fresh);
        fresh = undefined;
      });

      const u1 = fakeUploadId();
      await test.step('[12-B-011] N7 fake upload + every #8 503 → the read-error alert stays until a read succeeds', async () => {
        // BUG-550 (FIX-2280): a pending read failure on every floor keeps state "error" (UPR:752-758,799).
        runs.n7Answer = null;
        runs.uploads = [uploadOf(project, 0, u1)];
        runs.progressOf.set(u1, wireError(503, 'SERVICE_UNAVAILABLE'));
        await page.goto(pipeline);
        await expect(readAlert(page)).toBeVisible({ timeout: 25_000 });
        // FIX-2433: a floor whose record has no progress yet stays on poll (it no longer goes SSE after a failed #8 read) and
        // re-reads #8 every 5 s, each try spending ~4 s on 503 retries — so the #8 read count keeps growing while the alert
        // stays up. Hold 10 s, then the alert must still be there.
        await settle(page, 10_000);
        await expect.soft(readAlert(page)).toBeVisible();
        await expect.soft(page.getByRole('button', { name: SUPPORT, exact: true })).toBeVisible();
        await attachJson('E03_12-B-011_reads.json', { progressReads: runs.count(u1) });
        await captureEvidence(page, 'E03_12-B-011_every-progress-503.png');
        runs.progressOf.set(u1, ok(progress(u1, 'running', 'wallSegmentation', 20)));
        await readAlert(page).getByRole('button', { name: RETRY, exact: true }).click(); // UPR:826-829
        await expect(readAlert(page)).toHaveCount(0, { timeout: 30_000 });
        await expect.soft(chip(page, floor.name)).toContainText('Đang xử lý');
      });

      await test.step('[12-B-021] N7 item without sourceImageUrl, #8 running → "Đang chờ ảnh xem trước…" in the 4:3 frame', async () => {
        const u2 = fakeUploadId();
        runs.uploads = [uploadOf(project, 0, u2, false)];
        runs.progressOf.set(u2, ok(progress(u2, 'running', 'wallSegmentation', 20)));
        await page.reload();
        const frame = page.locator(`[aria-label="${PREVIEW}"]`);
        await expect(frame.getByText(WAITING_IMAGE, { exact: true })).toBeVisible(); // PPP:50,91-93
        const box = await frame.boundingBox();
        const ratio = box === null ? 0 : box.width / box.height;
        await attachJson('E03_12-B-021_frame.json', { box, ratio });
        expect.soft(Math.abs(ratio - 4 / 3), 'aspect 4:3').toBeLessThan(0.02);
        await captureEvidence(page, 'E03_12-B-021_waiting-preview.png');
      });

      await test.step('[12-A-008] clipboard refuses; "Nhật ký" → "Sao chép nhật ký" → toast "Không chép được nhật ký" + its sentence', async () => {
        await page.addInitScript(() => {
          Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: () => Promise.reject(new DOMException('blocked by QA', 'NotAllowedError')) },
          });
        });
        await page.reload();
        await expect(chips(page)).toHaveCount(1);
        await tab(page, TAB_LOG).click();
        await expect(logBox(page)).toBeVisible();
        await page.getByRole('button', { name: COPY_LOG, exact: true }).click(); // UPR:817-823, PG:1041-1056
        await expect.soft(toastWith(page, LOG_COPY_FAILED)).toContainText(LOG_COPY_FAILED_DESC);
        await captureEvidence(page, 'E03_12-A-008_clipboard-refused.png');
      });

      const layerPath = `/api/projects/${project.projectId}/floors/${floor.id}/spatial/layer`;
      const settingsPath = `/api/projects/${project.projectId}/settings`;
      const fail500 = (path: string) => async (route: Route): Promise<void> => {
        if (route.request().method() !== 'GET' || new URL(route.request().url()).pathname !== path) return route.fallback();
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL', message: 'qa', requestId: 'qa-500' }) });
      };
      const layer500 = fail500(layerPath);
      const isLayer = (url: URL): boolean => url.pathname === layerPath;
      const settings500 = fail500(settingsPath);

      await test.step('[12-C-021] #8 completed + N16 500 → summary with "Duyệt lớp tường" and "Hiệu chỉnh tỷ lệ", no metrics (BUG-285)', async () => {
        const u3 = fakeUploadId();
        runs.uploads = [uploadOf(project, 0, u3)];
        runs.progressOf.set(u3, ok(progress(u3, 'completed', 'qualityCheck', 100)));
        await page.route(isLayer, layer500);
        await page.reload();
        const summary = page.getByRole('region', { name: SUMMARY, exact: true });
        await expect(summary).toBeVisible();
        await settle(page, 3_000); // N16 read retried once
        await expect.soft(summary.getByRole('button', { name: REVIEW_WALLS, exact: true })).toBeVisible();
        await expect.soft(summary.getByRole('button', { name: CALIBRATE, exact: true })).toBeVisible();
        await expect.soft(summary.locator('li')).toHaveCount(0); // PG:1023-1025, UPR:1249-1251
        await captureEvidence(page, 'E03_12-C-021_summary-without-metrics.png');
        await page.unroute(isLayer, layer500);
      });

      await test.step('[12-C-020] #8 completed + N16 (real, empty floor document) + settings 500 → metrics shown, no confidence sentence', async () => {
        const u4 = fakeUploadId();
        runs.uploads = [uploadOf(project, 0, u4)];
        runs.progressOf.set(u4, ok(progress(u4, 'completed', 'qualityCheck', 100)));
        await page.route((url) => url.pathname === settingsPath, settings500);
        await page.reload();
        const summary = page.getByRole('region', { name: SUMMARY, exact: true });
        await expect(summary.locator('li')).toHaveCount(5); // tường, đối tượng, chuỗi kích thước, phòng, diện tích
        await settle(page);
        await expect.soft(summary.getByText(NO_LOW_CONFIDENCE)).toHaveCount(0); // PG:1027-1028, UPR:1260-1262
        note('[12-C-020] the real N16 of a floor without a run (an empty floor document, spatial_read/router.py:71-87) stands in for the planned N16 fixture');
        await captureEvidence(page, 'E03_12-C-020_metrics-no-confidence.png');
      });
    } finally {
      if (fresh !== undefined) await closeFlow(fresh);
      await closeMocked(m);
      await deleteSeededProject(adminApi, project.projectId);
    }
  });

  test('FL-12-17 · [mocked response] SCR-12 SSE drop, reconnect, polling fallback, silence probe and hidden tab during a live run', async ({ browser }) => {
    test.setTimeout(240_000);
    const project = await createProject(adminApi, '12-17', 1);
    let m: Mocked | undefined;
    try {
      m = await openMocked(browser, project.projectId, readAdminCredentials(), { clock: true });
      const { page, sse, runs, flow } = m;
      const uid = fakeUploadId();
      runs.uploads = [uploadOf(project, 0, uid)];
      runs.progressOf.set(uid, ok(progress(uid, 'running', 'wallSegmentation', 20)));
      await page.goto(ROUTES.project.pipeline(project.projectId));
      await sse.waitForConnections(uid);
      await expect.poll(() => stepLine(page)).toBe(runningAt(1));
      const refreshes = (from: number): number => flow.sent.slice(from).filter((r) => r.method === 'POST' && r.path === '/api/auth/refresh').length;

      await test.step('[12-B-038] first stream dropped after frame id N → EventSource reopens with ?lastEventId=N; the next frame advances', async () => {
        await sse.send(uid, [progress(uid, 'running', 'wallSegmentation', 25), progress(uid, 'running', 'wallSegmentation', 30)], 6); // ids 6, 7
        await settle(page, 300);
        sse.drop(uid);
        const again = await sse.waitForConnections(uid, 2);
        expect.soft(again.url, 'reopened with the last event id').toContain('lastEventId=7'); // EC:70-80,184,203-204
        runs.progressOf.set(uid, ok(progress(uid, 'running', 'openingAndFurnitureDetection', 40)));
        await sse.send(uid, [progress(uid, 'running', 'openingAndFurnitureDetection', 40)], 8);
        await expect.poll(() => stepLine(page)).toBe(runningAt(2));
        await attachJson('E03_12-B-038_reconnect.json', { urls: sse.of(uid).map((c) => c.url) });
      });

      await test.step('[12-B-043] after a drop no connection indicator is rendered; the last progress stays (records the gap)', async () => {
        sse.abortNext(1); // keep the outage up for one back-off round
        sse.drop(uid);
        await settle(page, 700);
        await expect.soft(page.getByText(/kết nối|ngoại tuyến|mất mạng/iu)).toHaveCount(0); // UPR:344,1040-1042 stored, never rendered
        expect.soft(await stepLine(page), 'last progress stays').toBe(runningAt(2));
        await captureEvidence(page, 'E03_12-B-043_no-connection-indicator.png');
        note('[12-B-043] gap recorded: connectionStatus is stored per floor but no view renders it');
        await sse.waitForConnections(uid, 3, 15_000);
      });

      await test.step('[12-B-039] stream lost 3 times → #8 polling, one auth refresh; clock +60 s → SSE retried', async () => {
        const conns = sse.of(uid).length;
        const reads = runs.count(uid);
        const sentMark = flow.sent.length;
        const abortMark = sse.aborted.length;
        // drop + 2 aborts → 3 failures without an open → polling + one refresh (PS:241-244); a good refresh retries SSE at
        // once → 3 more aborts → polling again, no second refresh (refreshedSinceOpen), SSE retry in 60 s (PS:193-201).
        sse.abortNext(5);
        sse.drop(uid);
        await expect.poll(() => sse.aborted.length - abortMark, { message: '3 stream requests refused', timeout: 60_000 }).toBeGreaterThanOrEqual(2);
        await expect.poll(() => runs.count(uid), { message: '#8 polling while the stream is down', timeout: 20_000 }).toBeGreaterThan(reads);
        await expect.poll(() => refreshes(sentMark), { message: 'auth refresh after the third loss', timeout: 20_000 }).toBeGreaterThanOrEqual(1);
        await softPoll(() => sse.aborted.length - abortMark, 5, 'SSE retried after the refresh, refused 3 more times', 20_000);
        expect.soft(refreshes(sentMark), 'one auth refresh').toBe(1);
        expect.soft(sse.of(uid).length, 'no stream reached the server yet').toBe(conns);
        await page.clock.fastForward(60_000); // SSE_RETRY_INTERVAL_MS
        await sse.waitForConnections(uid, conns + 1, 15_000);
        await attachJson('E03_12-B-039_fallback.json', { aborted: sse.aborted.slice(abortMark), refreshes: refreshes(sentMark), reads: runs.count(uid) - reads });
      });

      await test.step('[12-B-040] stream held silent, clock +120 s while running → exactly one #8 probe', async () => {
        await settle(page, 1_000);
        const mark = runs.count(uid);
        await page.clock.fastForward(120_000); // PG:100 SSE_SILENCE_PROBE_MS
        await expect.poll(() => runs.count(uid)).toBe(mark + 1);
        await settle(page);
        expect.soft(runs.count(uid), 'exactly one probe').toBe(mark + 1);
      });

      await test.step('[12-B-041] visibilitychange hidden → stream closed / polling stops; visible → listening resumes', async () => {
        const setHidden = (hidden: boolean): Promise<void> =>
          page.evaluate((h) => {
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
            Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
            document.dispatchEvent(new Event('visibilitychange'));
          }, hidden);
        const reads = runs.count(uid);
        await setHidden(true);
        await settle(page, 2_000);
        const openWhileHidden = sse.open(uid).length;
        await page.clock.fastForward(5_000);
        await settle(page, 500);
        const readsWhileHidden = runs.count(uid) - reads;
        await attachJson('E03_12-B-041_hidden.json', { openWhileHidden, readsWhileHidden });
        // BUG-552 (FIX-2270): hidden → the stream closes and parks, visible → it reopens (PS:101-104,267-285; PG:895).
        expect.soft(openWhileHidden, 'SSE closed while hidden').toBe(0);
        expect.soft(readsWhileHidden, 'no #8 read while hidden').toBe(0);
        await setHidden(false);
        await expect.poll(() => sse.open(uid).length, { message: 'listening again', timeout: 15_000 }).toBeGreaterThan(0);
        await captureEvidence(page, 'E03_12-B-041_visible-again.png');
      });
    } finally {
      await closeMocked(m);
      await deleteSeededProject(adminApi, project.projectId);
    }
  });
});

/* Every stage id once, so a rename in pipeline.ts breaks the table here, not silently in a flow. */
if (STAGES.length !== 6) throw new Error('six pipeline stages expected');
