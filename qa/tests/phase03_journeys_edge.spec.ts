/**
 * Phase 3 — X cross-screen journeys (QA-03d P11, flow-plan.md "phase03_journeys_edge.spec.ts"). Real stack only, no mock.
 * One test per flow, one `test.step('[<row id>] …')` per catalog row, in the user's order. `expect.soft` for copy / layout,
 * hard `expect` where later steps would be meaningless.
 *
 * Source (FE @ c16f2428): FM/FTR/UFM src/screens/qc/FloorManager (metres hard-coded: useFloorManager.ts metreText `unit: 'm'`)
 * · PS/UT/DZ src/screens/project/ProjectSettings · FU/FUC/FUT/UFU src/screens/upload/FloorUploadScreen · IQ/IQR
 * src/screens/upload/InputQualityGate · PR/PFC/PSU/UPR src/screens/pipeline/ProcessingScreen (one EventSource per screen,
 * #8 polls for the other floors) · pipelineErrorText.ts / PipelineFailure · PG/PGT PipelineGraph · CB/CBT/UCB CadBranchConfirm
 * · PSGATE ProjectSpatialGate ("Không tìm thấy dự án này").
 *
 * Users: every project is owned by ONE pool admin of this file (`poolUser(admin, 'admin', 'p11')`, own drawings_init
 * bucket: the env admin is already at 57/60 per 600 s in a full run). Engineer / viewer members use the shared pool slots
 * (they are only added to this file's own projects; no role / account change).
 *
 * Deviations from flow-plan.md (source-forced):
 * - X-A-009: one EventSource per screen (UPR:54) and the fake ML ends ~0.5 s after #7, so "SSE frames for both upload
 *   ids" is checked as "progress of both upload ids read, through SSE or #8" (channel counts in the evidence JSON).
 * - X-A-005/008/006: no in-app link reaches SCR-11, and SCR-09 rows with a drawing have no "Tải lên"; the route changes
 *   are client-side (`spaGo`: pushState + popstate) and a window tag proves no document reload.
 * - X-B-002: the access token is memory-only and keeps an API call working until it expires (phase01_auth.spec.ts
 *   note), so the "next action" after clearing the refresh cookie is the reload of /upload.
 * - X-A-014: catalog accepts the gate title OR the screen's not-found copy; SCR-10 answers the 404 init on the card.
 *
 * Budget per full run of the 6 flows (first run of the pool slot adds 1 invitation + 1 accept):
 * - `POST /api/auth/login`: API 2 per flow (env admin for the pool, pool admin as owner) − shared beforeAll for FL-X-04..06
 *   (2) + browser 1 per flow (6) + 1 UI sign-in (FL-X-02, X-B-002). ≈ 15.
 * - `GET /api/users/:id/memberships` (pool check): 1 per `poolUser` call ≈ 8. Invitations: 0 (1 when the p11 slot is empty).
 * - `POST /api/projects` 4 (+ DELETE in `finally`/`afterAll`); `POST …/members` 3.
 * - `drawings_init`: pool admin 2 (FL-X-01) + 1 (FL-X-01 X-A-014, answered 404) + 3 (FL-X-03) + 1 (S3 seed) = 7;
 *   shared engineer 1 (FL-X-02). Fake-ML runs: 2 + 3 + 1 + 1.
 * - Settings PUT 1, floor POST 4, PATCH rename 1, PATCH reorder 1, DELETE floor 2, scale PUT 1, project DELETE 1 (UI).
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { ROUTES, loginUrl } from '../../e2e/fixtures/routes';
import { EMAIL_LABEL, PASSWORD_LABEL, SIGN_IN_LABEL } from '../../e2e/fixtures/session';
import { TOUR_APPEAR_TIMEOUT_MS, dismissTour } from '../../e2e/fixtures/tour';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { PIPELINE_TIMEOUT_MS } from '../../e2e/fullstack/env';
import { attachJson, captureEvidence } from './support/evidence';
import {
  addProjectMember,
  corruptPng,
  createPipelineDrawingProject,
  createProject,
  deleteSeededProject,
  envDrawingPng,
  poolUser,
  type PoolUser,
} from './support/phase03Seed';
import {
  adminApi,
  card,
  cardOrder,
  chipTexts,
  closePage,
  COUNTER,
  escapeRegExp,
  floorRow,
  floorRowLabels,
  floorRowNames,
  floorRows,
  markShell,
  openPoolPage,
  pathOf,
  poolApi,
  progressSeen,
  screenState,
  shellKept,
  spaGo,
  uploadViaTray,
  writesSince,
  type OpenPage,
  type ScreenKind,
} from './support/p03/P11';

/* ---------------------------------------------------------------- copy (each cites its source) */

const SETTINGS_TABS = 'Nhóm cài đặt'; // PS:52
const UNITS_TAB = 'Đơn vị đo'; // UPS:532
const DANGER_TAB = 'Vùng nguy hiểm'; // UPS:534
const LENGTH_UNIT = 'Đơn vị chiều dài'; // UT:46
const UNIT_MM = 'Milimét (mm)'; // UPS:526
const UNIT_M = 'Mét (m)'; // UPS:527
const ADD_FLOOR = 'Thêm tầng'; // FM toolbar, FT empty state
const FLOORS_EMPTY = 'Chưa có tầng nào'; // FT:75, DZ:74
const SUBMIT = 'Bắt đầu xử lý'; // UFU:112
const NO_FLOORS_TITLE = 'Dự án chưa có tầng nào'; // FU:76
const NO_FLOORS_REASON = 'Dự án chưa có tầng nào. Thêm tầng ở màn Quản lý tầng trước khi xử lý.'; // UFU:117
const BLOCK_NOTICE = 'floor-upload-block-notice'; // FUF:22
const NOT_FOUND_TITLE = 'Không tìm thấy dự án này'; // PSGATE:37
const GENERIC_NOT_FOUND = 'Nội dung này có thể đã bị xoá, hoặc đường dẫn chưa đúng.'; // I18N errors.notFound.description
const DONE_RE = (n: number): RegExp => new RegExp(`^Đã xong ${String(n)}/${String(n)} tầng`, 'u'); // UPR:172-178
const COPY_CODE = 'Sao chép mã lỗi'; // pipelineFailureText.ts copyCodeAriaLabel
const FILE_CORRUPT_SENTENCE = 'Tệp bản vẽ bị hỏng nên không mở được.'; // pipelineErrorText.ts:62
const UPLOAD_CLEARER = 'Tải lên bản vẽ rõ hơn'; // pipelineFailureText.ts uploadClearerLabel
const PROCESSING = {
  tabs: 'Xem trước hoặc nhật ký', // PR:74
  copyLog: 'Sao chép nhật ký', // PLP:29
  logCopied: 'Đã chép nhật ký', // UPR:153
  summary: 'Báo cáo tổng kết', // PSU:18
  calibrate: 'Hiệu chỉnh tỷ lệ', // PSU:20
  reviewWalls: 'Duyệt lớp tường', // PSU:19
  cancel: 'Huỷ xử lý', // PR:65
  background: 'Để chạy nền và thông báo cho tôi', // PR:64
} as const;
const SCALE = {
  canvas: 'Bản vẽ đã nắn, kéo để vẽ đường tham chiếu',
  method: 'Chọn cách xác định tỷ lệ',
  refline: 'Vẽ đường tham chiếu',
  realLength: 'Chiều dài thật',
  scope: 'Phạm vi áp tỷ lệ',
  thisFloor: 'Chỉ áp cho tầng này',
  apply: 'Áp dụng tỷ lệ',
  applied: 'Đã áp tỷ lệ cho bản vẽ',
} as const; // phase04_qc_layers.spec.ts SCR-14 (ScaleCalibration SP:61)
const QUALITY_CONTINUE = 'Tiếp tục xử lý'; // UIQ:145
const QUALITY_ACK = 'Tôi đã đọc cảnh báo và vẫn muốn xử lý bản vẽ này'; // phase03_pipeline.spec.ts QUALITY_ACK_LABEL
const GRAPH = {
  emptyTitle: 'Chưa có lượt xử lý nào để kể lại', // PGT:208
  forbiddenLine: 'Chế độ chi tiết kỹ thuật chỉ mở cho vai quản trị, nên phần đó và nút đổi nhánh không hiện ở đây.', // PGT:211-212
  detail: 'Chi tiết kỹ thuật', // PGT:181
} as const;
const CAD = {
  dialog: 'Phát hiện tệp CAD', // CBT:30
  useCad: 'Dùng đường từ CAD', // CBT:84
  useAi: 'Vẫn dùng AI', // CBT:87
  cancel: 'Huỷ',
  handoffTitle: 'Chuyển sang nhánh nhận dạng ảnh', // CB:92
  noLayers: 'Chưa có lớp nào để ánh xạ',
  stageTwo: 'Ánh xạ lớp và xem trước hình học', // CB:82
  forbiddenTitle: 'Không có quyền xử lý CAD', // CB:90
  /** UCB:119 — lowercase "liên hệ" after a full stop is the source copy (flow-plan s1315x note); asserted as is. */
  forbiddenSentence:
    'Bạn không có quyền chỉnh sửa lớp của dự án này, nên không chốt được nhánh xử lý. liên hệ quản trị viên để được cấp quyền.',
  errorTitle: 'Không thể đọc tệp CAD', // CB:88
} as const;
const READ_ONLY = {
  settings: 'Vai hiện tại chỉ xem được cài đặt, không sửa và không xoá.', // PS:84
  floors: 'Không có quyền sửa tầng', // FM:76
  upload: 'Vai hiện tại chỉ được xem danh sách tệp, không tải lên và không sửa.', // UFU:110
} as const;

/** Soft `expect.poll`: a screen that never settles on the claim records a soft failure and the flow goes on. */
const softly = expect.configure({ soft: true });

const settingsTab = (page: Page, label: string) =>
  page.getByRole('tablist', { name: SETTINGS_TABS, exact: true }).getByRole('tab', { name: label, exact: true });
const projectWriteRe = (id: string, tail: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(id)}${tail}$`, 'u');

/** A pipeline outcome on /pipeline: the done line, or the PipelineFailure copy-code button. */
async function waitDone(page: Page, floors: number): Promise<void> {
  const done = page.getByText(DONE_RE(floors));
  const failure = page.getByRole('button', { name: COPY_CODE });
  // Right after a navigation the screen can still show the previous (failed) run for a moment: a failure only counts
  // once it has stayed on screen for three polls in a row (~6 s).
  let failedPolls = 0;
  await expect
    .poll(
      async () => {
        if (await done.first().isVisible()) return 'done';
        failedPolls = (await failure.first().isVisible()) ? failedPolls + 1 : 0;
        return failedPolls >= 3 ? 'failed' : 'waiting';
      },
      { message: `"Đã xong ${String(floors)}/${String(floors)} tầng" on /pipeline`, timeout: PIPELINE_TIMEOUT_MS, intervals: [2_000] },
    )
    .not.toBe('waiting');
  if (!(await done.first().isVisible())) throw new Error('the pipeline run failed (see the screenshot)');
}

const cleanupAll = async (api: APIRequestContext | undefined, ids: readonly string[]): Promise<void> => {
  if (api === undefined) return;
  for (const id of ids) await deleteSeededProject(api, id);
};

/* ================================================================= owner / engineer journeys */

test.describe('X cross-screen journeys', () => {
  test('X · FL-X-01 · owner builds a project end to end (settings → floors → upload 2 → processing → scale), edits floors after, then tears it down', async ({ browser }) => {
    test.setTimeout(Math.max(120_000, 2 * 180_000));
    const admin = await adminApi();
    let owner: APIRequestContext | undefined;
    let open: OpenPage | undefined;
    const cleanup: string[] = [];
    try {
      const ownerUser = await poolUser(admin, 'admin', 'p11');
      owner = await poolApi(ownerUser);
      const project = await createProject(owner, 'x-a-013', 0);
      cleanup.push(project.projectId);
      const pid = project.projectId;
      open = await openPoolPage(browser, ownerUser, { clipboard: true });
      const { page, api } = open;
      const floors: { id: string; name: string }[] = [];
      const uploads: string[] = [];

      await test.step('[X-A-013] SCR-09 "Thêm tầng" ×2 shows heights in "m" under "Milimét (mm)"; "Mét (m)" saved → SCR-09 unchanged', async () => {
        await page.goto(ROUTES.project.floors(pid));
        await expect(page.getByText(FLOORS_EMPTY, { exact: true })).toBeVisible();
        for (let i = 0; i < 2; i += 1) {
          const post = waitForApi(page, 'POST', projectWriteRe(pid, '/floors'), [200, 201]);
          await page.getByRole('button', { name: ADD_FLOOR, exact: true }).click();
          const { json } = await post;
          const row = json as Record<string, unknown>;
          floors.push({ id: String(row.id), name: String(row.name) });
          await expect(floorRows(page)).toHaveCount(i + 1);
        }
        const before = await floorRowLabels(page);
        for (const label of before) expect.soft(label, 'FloorTableRow writes metres').toMatch(/, cao độ -?[\d.]+,\d m, cao [\d.]+,\d m,/u);

        await page.goto(ROUTES.project.settings(pid));
        await settingsTab(page, UNITS_TAB).click();
        const unit = page.getByRole('combobox', { name: LENGTH_UNIT, exact: true });
        await expect.soft(unit).toContainText(UNIT_MM);
        const put = waitForApi(page, 'PUT', projectWriteRe(pid, '/settings'), [200]);
        await unit.click();
        await page.getByRole('option', { name: UNIT_M, exact: true }).click();
        const { response } = await put;
        const sent = (response.request().postDataJSON() as { body?: Record<string, unknown> } | null)?.body;
        expect.soft(sent?.lengthUnit, 'PUT settings body.lengthUnit').toBe('m');

        await page.goto(ROUTES.project.floors(pid));
        await expect(floorRows(page)).toHaveCount(2);
        const after = await floorRowLabels(page);
        await captureEvidence(page, 'E03_X-A-013_floors_metres_after_unit.png', {
          caption: [`settings "${LENGTH_UNIT}" ${UNIT_MM} → ${UNIT_M}; SCR-09 rows (FloorManager hard-codes m):`, ...after],
        });
        expect.soft(after, 'SCR-09 reads no project unit: same labels before and after').toEqual(before);
      });

      await test.step('[X-A-002] two PNGs uploaded in one SCR-10 session; "Bắt đầu xử lý" sends nothing → /pipeline shows the started run; log copy', async () => {
        await page.goto(ROUTES.project.upload(pid));
        for (const floor of floors) await expect(card(page, floor.id)).toBeVisible();
        const png = envDrawingPng();
        const [first, second] = floors;
        if (first === undefined || second === undefined) throw new Error('two floors expected');
        uploads.push(await uploadViaTray(page, pid, first, { name: 'alpha.png', mimeType: 'image/png', buffer: png }));
        uploads.push(await uploadViaTray(page, pid, second, { name: 'beta.png', mimeType: 'image/png', buffer: png }));
        await expect(page.getByTestId(COUNTER)).toHaveText('2 / 2 tầng đã có bản vẽ');

        const mark = api.length;
        await page.getByRole('button', { name: SUBMIT, exact: true }).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.pipeline(pid)); // UFU:1042 navigate only
        await expect(page.getByRole('list', { name: 'Tiến độ theo tầng', exact: true }).or(page.getByText(DONE_RE(2))).first()).toBeVisible({ timeout: PIPELINE_TIMEOUT_MS });
        const submitWrites = writesSince(api, mark);
        expect(submitWrites, '"Bắt đầu xử lý" itself sends no request').toEqual([]);

        // fold: SCR-12 log copy (E03 · SCR-10 every floor attached …).
        await page.getByRole('tablist', { name: PROCESSING.tabs }).getByRole('tab', { name: 'Nhật ký', exact: true }).click();
        await page.getByRole('button', { name: PROCESSING.copyLog, exact: true }).click();
        const copied = await page.evaluate(() => navigator.clipboard.readText());
        await expect.soft(page.getByText(PROCESSING.logCopied, { exact: true })).toBeVisible();
        await captureEvidence(page, 'E03_X-A-002_pipeline_after_submit.png', {
          caption: [`"${SUBMIT}" writes: ${JSON.stringify(submitWrites)}`, `log copied: ${String(copied === '' ? 0 : copied.split('\n').length)} line(s)`],
        });
        await attachJson('E03_X-A-002_submit.json', { submitWrites, uploads, copiedLines: copied === '' ? 0 : copied.split('\n').length });
      });

      await test.step('[X-A-009] both floors processed: "Đã xong 2/2 tầng", both chips "đã xong", progress read for both upload ids', async () => {
        await page.getByRole('tablist', { name: PROCESSING.tabs }).getByRole('tab', { name: 'Xem trước', exact: true }).click();
        await waitDone(page, 2);
        const texts = await chipTexts(page);
        expect(texts, 'one chip per floor').toHaveLength(2);
        for (const floor of floors) expect.soft(texts.find((t) => t.includes(floor.name)) ?? '', `chip of ${floor.name}`).toContain('đã xong');
        const seen = uploads.map((id) => ({ id, ...progressSeen(open as OpenPage, id) }));
        await captureEvidence(page, 'E03_X-A-009_two_floors_done.png', {
          caption: [`chips: ${texts.join(' | ')}`, ...seen.map((s) => `upload ${s.id}: SSE frames ${String(s.sse)}, #8 reads ${String(s.read)}`)],
        });
        await attachJson('E03_X-A-009_progress_channels.json', { chips: texts, seen });
        // One EventSource per screen (UPR:54) and the fake ML ends ~0.5 s after #7, so a final run is read through #8,
        // not SSE: the claim is "the screen tracked both upload ids", by either channel.
        for (const s of seen) expect.soft(s.sse + s.read, `progress of upload ${s.id} read (SSE or #8)`).toBeGreaterThan(0);
      });

      await test.step('[X-A-004] summary "Hiệu chỉnh tỷ lệ" → that floor\'s scale → "Áp dụng tỷ lệ" → Back → summary still finished, no new upload/run', async () => {
        const summary = page.getByRole('region', { name: PROCESSING.summary, exact: true });
        await expect(summary).toBeVisible();
        await expect.soft(summary.getByRole('button', { name: PROCESSING.reviewWalls, exact: true })).toBeVisible(); // fold BUG-285
        const mark = api.length;
        await summary.getByRole('button', { name: PROCESSING.calibrate, exact: true }).click();
        await expect.poll(() => pathOf(page)).toMatch(new RegExp(`^/projects/${escapeRegExp(pid)}/floors/[^/]+/scale$`, 'u'));
        const scaleFloor = pathOf(page).split('/')[4] ?? '';
        expect(floors.map((f) => f.id), 'scale route is one of the processed floors').toContain(scaleFloor);

        await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
        const canvas = page.getByRole('group', { name: SCALE.canvas, exact: true });
        await expect(canvas).toBeVisible();
        await page.getByRole('radiogroup', { name: SCALE.method, exact: true }).getByRole('radio', { name: SCALE.refline, exact: true }).click();
        const box = await canvas.boundingBox();
        if (box === null) throw new Error('scale canvas has no bounding box');
        await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5, { steps: 8 });
        await page.mouse.up();
        const realLength = page.getByLabel(SCALE.realLength, { exact: true });
        await realLength.fill('5000');
        await realLength.press('Enter');
        await page.getByRole('radiogroup', { name: SCALE.scope, exact: true }).getByRole('radio', { name: SCALE.thisFloor, exact: true }).click();
        const put = waitForApi(page, 'PUT', projectWriteRe(pid, `/floors/${escapeRegExp(scaleFloor)}/spatial/layer`), [200]);
        await page.getByRole('button', { name: SCALE.apply, exact: true }).click();
        await put;
        const notice = page.getByRole('region', { name: 'Trạng thái của màn hiệu chỉnh tỷ lệ' }); // SC:68
        await page.waitForTimeout(1_000);
        const noticeText = (await notice.allInnerTexts()).join(' / ').replace(/\s+/gu, ' ');
        await captureEvidence(page, 'E03_X-A-004_scale_applied.png', { caption: `PUT …/spatial/layer 200; notice: ${noticeText || '(none)'}` });
        await expect.soft(page.getByText(SCALE.applied, { exact: true }).first(), 'success notice after "Áp dụng tỷ lệ"').toBeVisible();

        await page.evaluate(() => window.history.back());
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.pipeline(pid));
        await expect(page.getByText(DONE_RE(2))).toBeVisible();
        await expect(page.getByRole('region', { name: PROCESSING.summary, exact: true })).toBeVisible();
        const writes = writesSince(api, mark);
        await captureEvidence(page, 'E03_X-A-004_scale_back_summary.png', { caption: [`writes since "${PROCESSING.calibrate}": ${JSON.stringify(writes)}`] });
        expect(writes.filter((w) => /\/drawings\/uploads/u.test(w)), 'no new upload / run after scale + Back').toEqual([]);
      });

      const [floorA, floorB] = floors;
      if (floorA === undefined || floorB === undefined) throw new Error('two floors expected');
      const renamed = `Tầng đổi tên ${String(Date.now()).slice(-5)}`;

      await test.step('[X-A-005] rename floor 1 on SCR-09 → same name on the SCR-10 card, SCR-11 floor list, SCR-12 chip (route change only)', async () => {
        await page.goto(ROUTES.project.floors(pid));
        await expect(floorRows(page)).toHaveCount(2);
        await markShell(page);
        const input = page.getByRole('textbox', { name: `Tên tầng ${floorA.name}`, exact: true }); // FTR:253
        const patch = waitForApi(page, 'PATCH', projectWriteRe(pid, `/floors/${escapeRegExp(floorA.id)}/spatial`), [200]);
        await input.fill(renamed);
        await input.press('Enter');
        await patch;
        await expect(floorRow(page, renamed)).toBeVisible();

        await spaGo(page, ROUTES.project.upload(pid));
        await expect.soft(card(page, floorA.id).getByRole('heading', { level: 3 })).toHaveText(renamed); // FUC:221
        await spaGo(page, ROUTES.project.quality(pid));
        const report = page.getByRole('region', { name: 'Báo cáo chất lượng', exact: true });
        await expect(report.getByRole('row').nth(1)).toBeVisible();
        await expect.soft(report.getByRole('row').filter({ hasText: renamed })).toHaveCount(1);
        await spaGo(page, ROUTES.project.pipeline(pid));
        await expect(page.getByText(DONE_RE(2))).toBeVisible();
        await softly.poll(async () => (await chipTexts(page)).some((t) => t.includes(renamed)), { message: 'SCR-12 chip carries the new name', timeout: 10_000 }).toBe(true);
        const texts = await chipTexts(page);
        await captureEvidence(page, 'E03_X-A-005_rename_everywhere.png', { caption: [`renamed "${floorA.name}" → "${renamed}"`, `SCR-12 chips: ${texts.join(' | ')}`] });
        expect.soft(await shellKept(page), 'no document reload between the screens').toBe(true);
      });

      await test.step('[X-A-008] SCR-09 Alt+ArrowUp on row 2 → SCR-10 cards and SCR-12 chips follow the new order', async () => {
        await spaGo(page, ROUTES.project.floors(pid));
        await expect(floorRows(page)).toHaveCount(2);
        const reorder = waitForApi(page, 'PATCH', /^\/api\/floors\/reorder$/u, [200]);
        await floorRow(page, floorB.name).focus();
        await page.keyboard.press('Alt+ArrowUp'); // FTR:80-85
        await reorder;
        await expect.poll(() => floorRowNames(page)).toEqual([floorB.name, renamed]);

        await spaGo(page, ROUTES.project.upload(pid));
        await expect(card(page, floorB.id)).toBeVisible();
        await softly.poll(() => cardOrder(page), { message: 'SCR-10 cards in the SCR-09 order', timeout: 10_000 }).toEqual([floorB.id, floorA.id]);
        await captureEvidence(page, 'E03_X-A-008_upload_order.png');
        await spaGo(page, ROUTES.project.pipeline(pid));
        await expect(page.getByText(DONE_RE(2))).toBeVisible();
        const order = async (): Promise<string[]> => (await chipTexts(page)).map((t) => (t.includes(renamed) ? renamed : t.includes(floorB.name) ? floorB.name : t));
        await softly.poll(order, { message: 'SCR-12 chips in the SCR-09 order', timeout: 10_000 }).toEqual([floorB.name, renamed]);
        const texts = await chipTexts(page);
        await captureEvidence(page, 'E03_X-A-008_pipeline_order.png', { caption: [`SCR-09 order: ${floorB.name} | ${renamed}`, `SCR-12 chips: ${texts.join(' | ')}`] });
      });

      await test.step('[X-A-006] SCR-09 delete the floor with a drawing → absent on SCR-10, SCR-12 chips and SCR-11 list', async () => {
        await spaGo(page, ROUTES.project.floors(pid));
        await expect(floorRows(page)).toHaveCount(2);
        const del = waitForApi(page, 'DELETE', new RegExp(`^/api/floors/${escapeRegExp(floorA.id)}$`, 'u'), [200, 204]);
        await page.getByRole('button', { name: `Thao tác khác cho tầng ${renamed}`, exact: true }).click(); // FTR:385-394
        await page.getByRole('menuitem', { name: 'Xoá tầng', exact: true }).click(); // FT:175-180, no dialog
        await del;
        await expect(floorRow(page, renamed)).toHaveCount(0);

        await spaGo(page, ROUTES.project.upload(pid));
        await expect(card(page, floorB.id)).toBeVisible();
        await expect(card(page, floorA.id)).toHaveCount(0);
        await spaGo(page, ROUTES.project.pipeline(pid));
        await expect(page.getByText(/^Đã xong \d+\/\d+ tầng/u).first()).toBeVisible();
        await softly.poll(async () => (await chipTexts(page)).some((t) => t.includes(renamed)), { message: 'SCR-12 chip of the deleted floor is gone', timeout: 10_000 }).toBe(false);
        const texts = await chipTexts(page);
        await captureEvidence(page, 'E03_X-A-006_pipeline_after_delete.png', { caption: [`deleted "${renamed}"; SCR-12 chips: ${texts.join(' | ')}`] });
        await spaGo(page, ROUTES.project.quality(pid));
        const report = page.getByRole('region', { name: 'Báo cáo chất lượng', exact: true });
        await expect(report.getByRole('row').nth(1)).toBeVisible();
        await captureEvidence(page, 'E03_X-A-006_quality_after_delete.png');
        await expect.soft(report.getByRole('row').filter({ hasText: renamed }), 'SCR-11 list drops the deleted floor').toHaveCount(0);
      });

      await test.step('[X-A-007] SCR-08 "Xoá mọi tầng" → SCR-09 "Chưa có tầng nào" → SCR-10 project notice + "Thêm tầng" → /floors', async () => {
        await page.goto(ROUTES.project.settings(pid));
        await settingsTab(page, DANGER_TAB).click();
        const panel = page.getByRole('tabpanel', { name: DANGER_TAB });
        await panel.getByRole('button', { name: 'Xoá mọi tầng', exact: true }).click(); // DZ:68
        const dialog = page.getByRole('dialog', { name: 'Xoá mọi tầng của dự án?', exact: true }); // UPS:521
        const del = waitForApi(page, 'DELETE', /^\/api\/floors\/[^/]+$/u, [200, 204]);
        await dialog.getByRole('button', { name: 'Xoá mọi tầng', exact: true }).click();
        await del;
        await expect(panel.getByText(FLOORS_EMPTY, { exact: true })).toBeVisible();

        await page.goto(ROUTES.project.floors(pid));
        await expect(page.getByText(FLOORS_EMPTY, { exact: true })).toBeVisible();
        await captureEvidence(page, 'E03_X-A-007_floors_empty.png');

        await page.goto(ROUTES.project.upload(pid));
        await expect(page.getByText(NO_FLOORS_TITLE, { exact: true })).toBeVisible(); // FU:76
        await page.getByRole('button', { name: SUBMIT, exact: true }).click();
        await expect(page.getByTestId(BLOCK_NOTICE)).toContainText(NO_FLOORS_REASON);
        await captureEvidence(page, 'E03_X-A-007_upload_no_floors.png');
        await page.getByRole('button', { name: ADD_FLOOR, exact: true }).click(); // FU:80 → UFU:1310
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.floors(pid));
      });

      await test.step('[X-A-014] tab 2 on /upload; tab 1 SCR-08 "Xoá dự án" with the exact name → tab 2\'s next action shows "Không tìm thấy dự án này"', async () => {
        const post = waitForApi(page, 'POST', projectWriteRe(pid, '/floors'), [200, 201]);
        await page.getByRole('button', { name: ADD_FLOOR, exact: true }).click();
        const row = (await post).json as Record<string, unknown>;
        const floor = { id: String(row.id), name: String(row.name) };

        const tab2 = await (open as OpenPage).context.newPage();
        try {
          await tab2.goto(ROUTES.project.upload(pid));
          await expect(card(tab2, floor.id)).toBeVisible();

          await page.goto(ROUTES.project.settings(pid));
          await settingsTab(page, DANGER_TAB).click();
          await page.getByRole('tabpanel', { name: DANGER_TAB }).getByRole('button', { name: 'Xoá dự án', exact: true }).click();
          const dialog = page.getByRole('dialog', { name: 'Xoá dự án này?', exact: true }); // UPS:522
          await dialog.getByRole('textbox', { name: 'Gõ lại tên dự án để xác nhận', exact: true }).fill(project.name); // PS:163
          const del = waitForApi(page, 'DELETE', projectWriteRe(pid, ''), [200, 204]);
          await dialog.getByRole('button', { name: 'Xoá dự án', exact: true }).click();
          await del;
          await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);

          // Tab 2's next action: a file assigned to its floor (the screen still shows the deleted project).
          await tab2.bringToFront();
          await tab2.getByTestId('floor-upload-file-input').setInputFiles({ name: 'gamma.png', mimeType: 'image/png', buffer: envDrawingPng() });
          await tab2.getByRole('region', { name: 'Tệp chưa gán tầng', exact: true }).getByRole('combobox', { name: 'Gán cho tầng khác' }).click();
          await tab2.getByRole('option', { name: floor.name, exact: true }).click();
          await tab2.waitForTimeout(2_500);
          const notFound = tab2.getByText(NOT_FOUND_TITLE, { exact: true }).or(tab2.getByText(GENERIC_NOT_FOUND)).first();
          await captureEvidence(tab2, 'E03_X-A-014_second_tab_after_delete.png', {
            caption: `tab 2 after the project was deleted in tab 1; not-found copy visible: ${String(await notFound.isVisible())}`,
          });
          await expect(notFound, 'tab 2 learns the project is gone on its next action (gate title or the screen not-found copy)').toBeVisible();
        } finally {
          await tab2.close().catch(() => undefined);
        }
      });
    } finally {
      await closePage(open);
      await cleanupAll(owner, cleanup);
      await owner?.dispose();
      await admin.dispose();
    }
  });

  test('X · FL-X-02 · engineer member walks the chain (session expires on upload), then history, graph and CAD', async ({ browser }) => {
    test.setTimeout(Math.max(120_000, 2 * 112_000));
    const admin = await adminApi();
    let owner: APIRequestContext | undefined;
    let open: OpenPage | undefined;
    const cleanup: string[] = [];
    try {
      const ownerUser = await poolUser(admin, 'admin', 'p11');
      const engineer = await poolUser(admin, 'engineer');
      owner = await poolApi(ownerUser);
      const project = await createProject(owner, 'x-d-001', 0);
      cleanup.push(project.projectId);
      const pid = project.projectId;
      await addProjectMember(owner, pid, engineer.email);
      open = await openPoolPage(browser, engineer, { clipboard: true });
      const { page, api, context } = open;
      const walkMark = api.length;
      let dangerTabs = -1;
      let floor = { id: '', name: '' };

      await test.step('[X-B-002] settings → floors "Thêm tầng" → /upload; refresh cookie cleared → /login?next=<upload>; sign in → back on /upload', async () => {
        await page.goto(ROUTES.project.settings(pid));
        await expect(page.getByRole('textbox', { name: 'Tên dự án', exact: true })).toHaveValue(project.name);
        dangerTabs = await settingsTab(page, DANGER_TAB).count();
        await page.goto(ROUTES.project.floors(pid));
        const post = waitForApi(page, 'POST', projectWriteRe(pid, '/floors'), [200, 201]);
        await page.getByRole('button', { name: ADD_FLOOR, exact: true }).click();
        const row = (await post).json as Record<string, unknown>;
        floor = { id: String(row.id), name: String(row.name) };
        await floorRow(page, floor.name).getByRole('button', { name: 'Tải lên', exact: true }).click(); // FTR:318-327
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.upload(pid));
        await expect(card(page, floor.id)).toBeVisible();

        // The access token lives in memory only (src/lib/auth/state.ts) and an API call keeps working until it expires;
        // the session is dead once the refresh cookie is gone, and the next load of /upload proves it.
        await context.clearCookies({ name: 'appback_refresh' });
        const refused = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/auth/refresh' && r.status() === 401);
        await page.reload({ waitUntil: 'commit' });
        await refused;
        await expect.poll(() => new URL(page.url()).pathname + new URL(page.url()).search).toBe(loginUrl(ROUTES.project.upload(pid)));
        await captureEvidence(page, 'E03_X-B-002_login_next.png');

        await page.getByLabel(EMAIL_LABEL, { exact: true }).fill(engineer.email);
        await page.getByLabel(PASSWORD_LABEL, { exact: true }).fill(engineer.password);
        const login = waitForApi(page, 'POST', /^\/api\/auth\/login$/u, [204]);
        await page.getByRole('button', { name: SIGN_IN_LABEL, exact: true }).click();
        await login;
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.upload(pid));
        await expect(card(page, floor.id)).toBeVisible();
      });

      await test.step('[X-D-001] engineer uploads → SCR-11 "Tiếp tục xử lý" → "Đã xong 1/1 tầng"; every write 2xx; no "Vùng nguy hiểm" on SCR-08', async () => {
        await uploadViaTray(page, pid, floor, { name: 'drawing.png', mimeType: 'image/png', buffer: envDrawingPng() });
        await page.goto(ROUTES.project.quality(pid));
        const proceed = page.getByRole('button', { name: QUALITY_CONTINUE, exact: true });
        await expect(proceed).toBeVisible({ timeout: PIPELINE_TIMEOUT_MS });
        const ack = page.getByRole('checkbox', { name: QUALITY_ACK, exact: true });
        if ((await ack.count()) > 0) await ack.check();
        await proceed.click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.pipeline(pid));
        await waitDone(page, 1);
        const writes = api.slice(walkMark).filter((e) => e.method !== 'GET' && !e.path.startsWith('/api/telemetry'));
        const failed = writes.filter((e) => e.status >= 300 && !(e.path === '/api/auth/refresh' && e.status === 401));
        await captureEvidence(page, 'E03_X-D-001_engineer_done.png', { caption: [`writes: ${String(writes.length)}, non-2xx (minus the expected refresh 401): ${String(failed.length)}`, `"${DANGER_TAB}" tabs on SCR-08: ${String(dangerTabs)}`] });
        await attachJson('E03_X-D-001_engineer_writes.json', { writes: writes.map((e) => `${e.method} ${e.path} ${String(e.status)}`) });
        expect.soft(failed.map((e) => `${e.method} ${e.path} ${String(e.status)}`), 'every engineer write answered 2xx').toEqual([]);
        expect.soft(dangerTabs, 'SCR-08 shows no "Vùng nguy hiểm" to an engineer').toBe(0);
      });

      await test.step('[X-A-012] Back ×4 / Forward ×4 across settings → floors → upload → quality → pipeline: server state each time, zero writes', async () => {
        const route: [ScreenKind, string][] = [
          ['settings', ROUTES.project.settings(pid)],
          ['floors', ROUTES.project.floors(pid)],
          ['upload', ROUTES.project.upload(pid)],
          ['quality', ROUTES.project.quality(pid)],
          ['pipeline', ROUTES.project.pipeline(pid)],
        ];
        const first: string[] = [];
        for (const [kind, path] of route) {
          await page.goto(path);
          first.push(await screenState(page, kind));
        }
        const mark = api.length;
        const seen: string[] = [];
        for (let i = route.length - 2; i >= 0; i -= 1) {
          await page.goBack();
          const [kind, path] = route[i] ?? ['settings', ''];
          await expect.poll(() => pathOf(page)).toBe(path);
          const state = await screenState(page, kind);
          seen.push(state);
          expect.soft(state, `Back to ${kind}`).toBe(first[i]);
        }
        for (let i = 1; i < route.length; i += 1) {
          await page.goForward();
          const [kind, path] = route[i] ?? ['settings', ''];
          await expect.poll(() => pathOf(page)).toBe(path);
          const state = await screenState(page, kind);
          seen.push(state);
          expect.soft(state, `Forward to ${kind}`).toBe(first[i]);
        }
        const writes = writesSince(api, mark);
        await captureEvidence(page, 'E03_X-A-012_history_forward_end.png', { caption: [`writes during Back/Forward: ${JSON.stringify(writes)}`] });
        await attachJson('E03_X-A-012_history.json', { first, seen, writes });
        expect.soft(writes, 'history navigation sends no write').toEqual([]);
      });

      await test.step('[13-D-002] engineer graph: forbidden line, overview at full opacity, no empty story, no "Chi tiết kỹ thuật"', async () => {
        await page.goto(ROUTES.project.pipelineGraph(pid));
        await expect(page.getByRole('heading', { level: 1, name: 'Sơ đồ xử lý', exact: true })).toBeVisible();
        await expect.soft(page.getByText(GRAPH.forbiddenLine, { exact: true })).toBeVisible();
        await expect.soft(page.getByText(GRAPH.emptyTitle, { exact: true })).toHaveCount(0);
        await expect.soft(page.getByRole('button', { name: GRAPH.detail })).toHaveCount(0);
        const diagram = page.getByRole('group', { name: 'Sơ đồ xử lý', exact: true });
        const opacity = await diagram.evaluate((el) => getComputedStyle(el).opacity).catch(() => 'no group');
        await captureEvidence(page, 'E03_13-D-002_engineer_graph.png', { caption: `overview opacity: ${opacity}` });
        expect.soft(opacity, 'overview drawn at full opacity').toBe('1');
      });

      await test.step('[15-D-002] engineer CAD: "Dùng đường từ CAD" enabled, "Chưa có lớp nào để ánh xạ", stage 2 reachable', async () => {
        await page.goto(ROUTES.project.cadConfirm(pid, floor.id));
        const dialog = page.getByRole('dialog', { name: CAD.dialog, exact: true });
        await expect(dialog).toBeVisible();
        await expect.soft(dialog.getByRole('button', { name: CAD.useCad, exact: true })).toBeEnabled();
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect.soft(page.getByText(CAD.handoffTitle, { exact: true })).toBeVisible();
        await expect.soft(page.getByText(CAD.noLayers, { exact: true }).first()).toBeVisible();
        await page.getByRole('button', { name: CAD.useCad, exact: true }).click();
        await expect(page.getByRole('region', { name: CAD.stageTwo, exact: true })).toBeVisible();
        await captureEvidence(page, 'E03_15-D-002_engineer_cad_stage2.png');
      });
    } finally {
      await closePage(open);
      await cleanupAll(owner, cleanup);
      await owner?.dispose();
      await admin.dispose();
    }
  });

  test('X · FL-X-03 · owner recovers from a failed run, then replaces the finished drawing', async ({ browser }) => {
    test.setTimeout(Math.max(120_000, 2 * 130_000));
    const admin = await adminApi();
    let owner: APIRequestContext | undefined;
    let open: OpenPage | undefined;
    const cleanup: string[] = [];
    try {
      const ownerUser = await poolUser(admin, 'admin', 'p11');
      owner = await poolApi(ownerUser);
      const project = await createProject(owner, 'x-a-011', 1);
      cleanup.push(project.projectId);
      const pid = project.projectId;
      const floor = project.floors[0];
      if (floor === undefined) throw new Error('one floor expected');
      open = await openPoolPage(browser, ownerUser, { clipboard: true });
      const { page, api } = open;
      let goodUpload = '';

      await test.step('[X-A-011] crafted PNG → /pipeline FILE_CORRUPT failure; "Sao chép mã lỗi" → clipboard; back to SCR-10, good PNG → "Đã xong 1/1 tầng"', async () => {
        await page.goto(ROUTES.project.upload(pid));
        await expect(card(page, floor.id)).toBeVisible();
        await uploadViaTray(page, pid, floor, { name: 'hong.png', mimeType: 'image/png', buffer: corruptPng() });
        await page.getByRole('button', { name: SUBMIT, exact: true }).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.pipeline(pid));
        const copy = page.getByRole('button', { name: COPY_CODE });
        await expect(copy.or(page.getByText(DONE_RE(1))).first()).toBeVisible({ timeout: PIPELINE_TIMEOUT_MS });
        await expect(copy, 'the crafted PNG fails the run').toBeVisible();
        await expect.soft(page.getByText(FILE_CORRUPT_SENTENCE, { exact: true }).first()).toBeVisible();
        await expect.soft(page.getByText('FILE_CORRUPT', { exact: true }).first()).toBeVisible();
        await copy.click();
        const copied = await page.evaluate(() => navigator.clipboard.readText());
        await captureEvidence(page, 'E03_X-A-011_failure_band.png', { caption: `"${COPY_CODE}" → clipboard "${copied}"` });
        expect.soft(copied.trim(), 'clipboard holds the error code').toBe('FILE_CORRUPT');

        await page.getByRole('button', { name: UPLOAD_CLEARER, exact: true }).first().click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.upload(pid));
        goodUpload = await uploadViaTray(page, pid, floor, { name: 'drawing.png', mimeType: 'image/png', buffer: envDrawingPng() });
        await page.getByRole('button', { name: SUBMIT, exact: true }).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.pipeline(pid));
        await waitDone(page, 1);
        await captureEvidence(page, 'E03_X-A-011_recovered_done.png');
      });

      await test.step('[X-A-010] replace the finished drawing → new upload id, /pipeline shows the new run; graph still "Chưa có lượt xử lý nào để kể lại"', async () => {
        await page.goto(ROUTES.project.upload(pid));
        await expect(card(page, floor.id)).toBeVisible();
        const replaced = await uploadViaTray(page, pid, floor, { name: 'beta.png', mimeType: 'image/png', buffer: envDrawingPng() });
        expect(replaced, 'the replacement is a new upload').not.toBe(goodUpload);
        const mark = api.length;
        await page.getByRole('button', { name: SUBMIT, exact: true }).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.pipeline(pid));
        await waitDone(page, 1);
        const newSeen = progressSeen(open as OpenPage, replaced);
        const oldReadsAfter = api.slice(mark).filter((e) => e.method === 'GET' && e.path.endsWith(`/drawings/uploads/${goodUpload}/progress`)).length;
        await captureEvidence(page, 'E03_X-A-010_new_run.png', {
          caption: [`new upload ${replaced}: SSE ${String(newSeen.sse)}, #8 ${String(newSeen.read)}`, `old upload ${goodUpload}: #8 reads after submit ${String(oldReadsAfter)}`],
        });
        expect.soft(newSeen.sse + newSeen.read, '/pipeline tracks the new upload').toBeGreaterThan(0);
        expect.soft(oldReadsAfter, '/pipeline no longer reads the replaced upload').toBe(0);

        await page.goto(ROUTES.project.pipelineGraph(pid));
        await expect.soft(page.getByText(GRAPH.emptyTitle, { exact: true })).toBeVisible(); // graph reads #24 only
        await captureEvidence(page, 'E03_X-A-010_graph_after_replace.png');
      });
    } finally {
      await closePage(open);
      await cleanupAll(owner, cleanup);
      await owner?.dispose();
      await admin.dispose();
    }
  });

  /* ---------------------------------------------------------------- one processed project, three readers */

  test.describe('processed project (S3, shared)', () => {
    let admin: APIRequestContext | undefined;
    let owner: APIRequestContext | undefined;
    let ownerUser: PoolUser | undefined;
    let s3 = { projectId: '', floorId: '', name: '' };

    test.beforeAll(async () => {
      test.setTimeout(PIPELINE_TIMEOUT_MS + 60_000);
      admin = await adminApi();
      ownerUser = await poolUser(admin, 'admin', 'p11');
      owner = await poolApi(ownerUser);
      const seeded = await createPipelineDrawingProject(owner, 'x-s3', envDrawingPng());
      const read = await owner.get(`/api/projects/${seeded.projectId}`);
      s3 = { projectId: seeded.projectId, floorId: seeded.floorId, name: String(((await read.json()) as Record<string, unknown>).name) };
    });

    test.afterAll(async () => {
      if (s3.projectId !== '') await deleteSeededProject(owner as APIRequestContext, s3.projectId);
      await owner?.dispose();
      await admin?.dispose();
    });

    test('X · FL-X-04 · viewer member reads the whole processed project, graph and CAD (read only)', async ({ browser }) => {
      test.setTimeout(Math.max(120_000, 2 * 70_000));
      const viewer = await poolUser(admin as APIRequestContext, 'viewer');
      await addProjectMember(owner as APIRequestContext, s3.projectId, viewer.email);
      let open: OpenPage | undefined;
      try {
        open = await openPoolPage(browser, viewer);
        const { page, api } = open;
        const pid = s3.projectId;
        const mark = api.length;

        await test.step('[X-D-002] every screen read-only with its own banner; SCR-11/12 offer no action; zero writes', async () => {
          await page.goto(ROUTES.project.settings(pid));
          await expect(page.getByText(READ_ONLY.settings, { exact: true })).toBeVisible();
          await captureEvidence(page, 'E03_X-D-002_viewer_settings.png');
          await page.goto(ROUTES.project.floors(pid));
          await expect.soft(page.getByText(READ_ONLY.floors, { exact: true })).toBeVisible();
          await page.goto(ROUTES.project.upload(pid));
          await expect.soft(page.getByText(READ_ONLY.upload, { exact: true })).toBeVisible();
          await captureEvidence(page, 'E03_X-D-002_viewer_upload.png');
          await page.goto(ROUTES.project.quality(pid));
          await expect(page.getByRole('region', { name: 'Báo cáo chất lượng', exact: true })).toBeVisible();
          await expect.soft(page.getByRole('button', { name: QUALITY_CONTINUE, exact: true })).toHaveCount(0);
          await expect.soft(page.getByRole('button', { name: 'Tải bản vẽ khác', exact: true })).toHaveCount(0);
          await page.goto(ROUTES.project.pipeline(pid));
          await expect(page.getByRole('navigation', { name: 'Xử lý' })).toBeVisible();
          await page.waitForTimeout(1_500);
          await expect.soft(page.getByRole('button', { name: PROCESSING.cancel, exact: true })).toHaveCount(0);
          await expect.soft(page.getByRole('button', { name: PROCESSING.background, exact: true })).toHaveCount(0);
          const writes = writesSince(api, mark);
          await captureEvidence(page, 'E03_X-D-002_viewer_pipeline.png', { caption: `writes while reading 5 screens: ${JSON.stringify(writes)}` });
          expect(writes, 'a viewer sends no write').toEqual([]);
        });

        await test.step('[13-D-003] viewer graph: forbidden line, no empty story', async () => {
          await page.goto(ROUTES.project.pipelineGraph(pid));
          await expect(page.getByRole('heading', { level: 1, name: 'Sơ đồ xử lý', exact: true })).toBeVisible();
          await expect.soft(page.getByText(GRAPH.forbiddenLine, { exact: true })).toBeVisible();
          await expect.soft(page.getByText(GRAPH.emptyTitle, { exact: true })).toHaveCount(0);
          await captureEvidence(page, 'E03_13-D-003_viewer_graph.png');
        });

        await test.step('[15-D-003] viewer CAD: notice "Không có quyền xử lý CAD" + sentence; same alert in the dialog; CAD disabled', async () => {
          await page.goto(ROUTES.project.cadConfirm(pid, s3.floorId));
          const dialog = page.getByRole('dialog', { name: CAD.dialog, exact: true });
          await expect(dialog).toBeVisible();
          await expect.soft(dialog.getByText(CAD.forbiddenSentence, { exact: true })).toBeVisible();
          await expect.soft(dialog.getByRole('button', { name: CAD.useCad, exact: true })).toBeDisabled();
          await expect.soft(page.getByText(CAD.forbiddenTitle, { exact: true })).toHaveCount(1);
          expect.soft(await page.getByText(CAD.forbiddenSentence, { exact: true }).count(), 'sentence in the notice and in the dialog').toBeGreaterThanOrEqual(2);
          await captureEvidence(page, 'E03_15-D-003_viewer_cad_dialog.png');
        });

        await test.step('[15-D-004] "Huỷ" → hand-off "Dùng đường từ CAD" disabled, "Vẫn dùng AI" enabled → /pipeline', async () => {
          const dialog = page.getByRole('dialog', { name: CAD.dialog, exact: true });
          await dialog.getByRole('button', { name: CAD.cancel, exact: true }).click();
          await expect(dialog).toHaveCount(0);
          await expect(page.getByText(CAD.handoffTitle, { exact: true })).toBeVisible();
          await expect(page.getByRole('button', { name: CAD.useCad, exact: true })).toBeDisabled();
          const ai = page.getByRole('button', { name: CAD.useAi, exact: true });
          await expect(ai).toBeEnabled();
          await captureEvidence(page, 'E03_15-D-004_viewer_handoff.png');
          await ai.click();
          await expect.poll(() => pathOf(page)).toBe(ROUTES.project.pipeline(pid));
        });
      } finally {
        await closePage(open);
      }
    });

    test('X · FL-X-05 · owner reloads every phase-3 route of a processed project', async ({ browser }) => {
      test.setTimeout(Math.max(120_000, 2 * 46_000));
      let open: OpenPage | undefined;
      try {
        open = await openPoolPage(browser, ownerUser as PoolUser);
        const { page } = open;
        const pid = s3.projectId;

        await test.step('[X-B-003] /settings, /floors, /upload, /quality, /pipeline, /pipeline/graph, cad-confirm: same state before and after reload', async () => {
          const routes: [ScreenKind, string][] = [
            ['settings', ROUTES.project.settings(pid)],
            ['floors', ROUTES.project.floors(pid)],
            ['upload', ROUTES.project.upload(pid)],
            ['quality', ROUTES.project.quality(pid)],
            ['pipeline', ROUTES.project.pipeline(pid)],
            ['graph', ROUTES.project.pipelineGraph(pid)],
            ['cad', ROUTES.project.cadConfirm(pid, s3.floorId)],
          ];
          const rows: { route: string; before: string; after: string }[] = [];
          for (const [kind, path] of routes) {
            await page.goto(path);
            const before = await screenState(page, kind);
            await page.reload();
            const after = await screenState(page, kind);
            rows.push({ route: path, before, after });
            expect.soft(after, `${kind}: state after reload`).toBe(before);
          }
          await expect.soft(page.getByRole('dialog', { name: CAD.dialog, exact: true })).toBeVisible();
          await captureEvidence(page, 'E03_X-B-003_reload_last_route.png', { caption: rows.map((r) => `${r.after === r.before ? 'same' : 'DIFF'} ${r.after}`) });
          await attachJson('E03_X-B-003_reload_states.json', { rows });
          expect.soft(rows.find((r) => r.route === ROUTES.project.pipeline(pid))?.after ?? '', 'pipeline after reload').toMatch(/Đã xong 1\/1 tầng/u);
        });
      } finally {
        await closePage(open);
      }
    });

    test('X · FL-X-06 · non-member deep-links all 7 phase-3 routes of an existing project', async ({ browser }) => {
      test.setTimeout(Math.max(120_000, 2 * 28_000));
      const outsider = await poolUser(admin as APIRequestContext, 'engineer');
      let open: OpenPage | undefined;
      try {
        open = await openPoolPage(browser, outsider);
        const { page, api } = open;
        const pid = s3.projectId;
        const mark = api.length;

        await test.step('[X-B-001] /settings, /floors, /upload, /quality, /pipeline: not-found state, no project data, no write', async () => {
          const seen: { route: string; notFound: boolean; leaksName: boolean }[] = [];
          const routes = [
            ROUTES.project.settings(pid),
            ROUTES.project.floors(pid),
            ROUTES.project.upload(pid),
            ROUTES.project.quality(pid),
            ROUTES.project.pipeline(pid),
          ];
          for (const path of routes) {
            await page.goto(path);
            const notFound = page.getByText(NOT_FOUND_TITLE, { exact: true }).or(page.getByText(GENERIC_NOT_FOUND)).first();
            await expect.soft(notFound, `${path}: not-found state`).toBeVisible();
            const body = await page.locator('body').innerText();
            seen.push({ route: path, notFound: await notFound.isVisible(), leaksName: body.includes(s3.name) });
            expect.soft(body.includes(s3.name), `${path}: project name not shown`).toBe(false);
          }
          const writes = writesSince(api, mark);
          await captureEvidence(page, 'E03_X-B-001_non_member_pipeline.png', { caption: seen.map((s) => `${s.route}: notFound ${String(s.notFound)}, name leaked ${String(s.leaksName)}`) });
          await attachJson('E03_X-B-001_non_member_routes.json', { seen, writes });
          expect.soft(writes, 'a non-member sends no write').toEqual([]);
        });

        await test.step('[13-D-004] /pipeline/graph: #24 → 404, not-found strip, no graph', async () => {
          const read = waitForApi(page, 'GET', projectWriteRe(pid, ''), [404]);
          await page.goto(ROUTES.project.pipelineGraph(pid));
          await read;
          await expect.soft(page.getByRole('alert').filter({ hasText: NOT_FOUND_TITLE })).toBeVisible();
          await expect.soft(page.getByRole('group', { name: 'Sơ đồ xử lý', exact: true })).toHaveCount(0);
          await captureEvidence(page, 'E03_13-D-004_non_member_graph.png');
        });

        await test.step('[15-D-005] cad-confirm: floor list 404 → "Không thể đọc tệp CAD" … "Mã lỗi: NOT_FOUND" (not forbidden, not the shared strip)', async () => {
          const read = waitForApi(page, 'GET', projectWriteRe(pid, '/floors'), [404]);
          await page.goto(ROUTES.project.cadConfirm(pid, s3.floorId));
          await read;
          await expect.soft(page.getByText(CAD.errorTitle, { exact: true }).first()).toBeVisible();
          await expect.soft(page.getByText(/Mã lỗi: NOT_FOUND/u).first()).toBeVisible();
          await expect.soft(page.getByText(CAD.forbiddenTitle, { exact: true })).toHaveCount(0);
          await expect.soft(page.getByText(NOT_FOUND_TITLE, { exact: true })).toHaveCount(0);
          await captureEvidence(page, 'E03_15-D-005_non_member_cad.png');
        });
      } finally {
        await closePage(open);
      }
    });
  });
});
