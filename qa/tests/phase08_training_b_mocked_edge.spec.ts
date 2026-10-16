/**
 * Phase 8 · SCR-35 Training Jobs (`/admin/training/jobs`), EDGE layer, MOCKED RESPONSES, second half (QA-08 P6):
 * FL-35T-09 stream of metrics/logs, FL-35T-10 cancel, FL-35T-11 create (success/idempotency/general errors),
 * FL-35T-12 create (per-field errors). FL-35T-05..08 live in `phase08_training_mocked_edge.spec.ts` (P5).
 *
 * Why mocked: a running/queued job that survives a test cannot be seeded on the real stack, and a real POST to training-jobs
 * would queue GPU work (unsafe). Pairs (real, same screen): FL-35T-09 none (needs a running job), FL-35T-10 none,
 * FL-35T-11 and FL-35T-12 pair FL-35T-03 (form, real). What is real: the admin session and the app. Mocked: `**\/api/admin/ml/**`
 * (support/p08/P6.ts); a POST without a responder is aborted and recorded (`mock.unexpected`, asserted empty).
 * Polls (list 15 s, job 5 s, metrics/logs 5 s: useTrainingJobs.ts:89-93) run on `page.clock` (installed, then `runFor`).
 *
 * Source (FE): TJ src/screens/admin/TrainingJobs/TrainingJobs.tsx, TJD TrainingJobDetail.tsx, TJF TrainingJobForm.tsx,
 * UTJ useTrainingJobs.ts, TG trainingJobsGateway.ts (texts :123-135), TM trainingMetricsModel.ts.
 *
 * ## Users / request budget per full run
 * Admin seed (read only, one UI login per flow = 4 `POST /api/auth/login`). No invitation, no real write, no pool user.
 * `POST /api/auth/refresh` about one per page load (about 6).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { signInAdmin } from './support/auth';
import { captureEvidence } from './support/evidence';
import { attachState } from './support/p08/P4';
import {
  cursorFeed,
  datasetFixture,
  held,
  jobFixture,
  logLines,
  metricPoints,
  mockTrainingApi,
  ok,
  versionFixture,
  wireError,
  type Line,
  type Point,
  type TrainingMock,
  type WireJob,
} from './support/p08/P6';

/* ---------------------------------------------------------------- copy (each cites its source) */

const TITLE = 'Huấn luyện model AI'; // TJ:30
const DETAIL = 'Chi tiết lượt huấn luyện'; // TJ:39
const TAB_JOBS = 'Lượt huấn luyện'; // TJ:32
const CREATE = 'Tạo lượt huấn luyện'; // TJ:36
const SUBMIT = 'Bắt đầu huấn luyện'; // TJF:25
const CANCEL = 'Huỷ lượt'; // TJD:20
const KEEP = 'Giữ lại'; // TJD:21
const CANCEL_TITLE = 'Huỷ lượt huấn luyện này?'; // TJD:22
const CANCEL_BODY = 'Lượt dừng ở vòng hiện tại, không chạy tiếp được.'; // TJD:23
const WALL = 'Tách lớp tường'; // UTJ:114 FAMILY_LABELS
const OPENING = 'Nhận diện cửa và đồ đạc'; // UTJ:115
const FORBIDDEN = 'Không có quyền truy cập'; // TJ:37
const T = {
  busy: 'Máy chủ đang bận. Thử lại sau ít phút.',
  write: 'Chưa gửi được yêu cầu. Thử lại sau.',
  notCancellable: 'Lượt này vừa kết thúc nên không huỷ được nữa.',
  jobNotFound: 'Không tìm thấy lượt huấn luyện này.',
  readFallback: 'Không đọc được dữ liệu huấn luyện.',
  versionNotReady: 'Phiên bản này chưa sẵn sàng.',
  versionFamily: 'Phiên bản này không cùng họ model.',
  versionNotFound: 'Không tìm thấy phiên bản này.',
  baseMismatch: 'Model nền không thuộc họ đã chọn.',
  epochs: 'Số vòng phải từ 1 đến 300.',
  formInvalid: 'Biểu mẫu chưa hợp lệ.',
} as const; // TG:123-135

/* ---------------------------------------------------------------- locators and small actions */

const heading1 = (page: Page): Locator => page.getByRole('heading', { level: 1, name: TITLE });
const aside = (page: Page): Locator => page.locator(`aside[aria-label="${DETAIL}"]`);
const section = (page: Page, name: 'Số đo' | 'Nhật ký'): Locator => page.getByRole('region', { name, exact: true }); // TJD:51 <section aria-label>
const scroller = (page: Page, name: 'Số đo' | 'Nhật ký'): Locator => section(page, name).locator('div.overflow-auto').first(); // TJD:79/103
/** The open button of a job row: family label + the unique `cur/epochs` cell (TJT OpenButton; epochs are unique per job in a flow). */
const rowBtn = (page: Page, family: string, cur: number, epochs: number): Locator =>
  page
    .locator('tr, li')
    .filter({ has: page.getByRole('button', { name: family, exact: true }), hasText: new RegExp(`\\b${cur}/${epochs}\\b`, 'u') })
    .getByRole('button', { name: family, exact: true });
const softly = expect.configure({ soft: true });
const tick = (page: Page, ms: number): Promise<void> => page.clock.runFor(ms);
const toast = (page: Page, text: string): Locator => page.getByRole('status').filter({ hasText: text });
const createDialog = (page: Page): Locator => page.getByRole('dialog', { name: CREATE });
const cancelDialog = (page: Page): Locator => page.getByRole('dialog', { name: CANCEL_TITLE });
const cancelledCopy = (job: WireJob): WireJob => ({ ...job, endedAt: '2026-02-01T00:00:00.000Z', status: 'cancelled' });

async function openScreen(page: Page, init: Parameters<typeof mockTrainingApi>[1]): Promise<TrainingMock> {
  await signInAdmin(page);
  const mock = await mockTrainingApi(page, init);
  await page.clock.install();
  await page.goto(ROUTES.adminTrainingJobs);
  await expect(heading1(page)).toBeVisible();
  return mock;
}

/** Cancel responder: 200 with the job `cancelled`, and the list now shows it cancelled. */
const cancelOk = (mock: TrainingMock) => (call: { path: string }) => {
  const id = /training-jobs\/([^/]+)\/cancel$/u.exec(call.path)?.[1];
  const job = mock.jobs.find((j) => j.id === id);
  if (job === undefined) return wireError(404, 'NOT_FOUND', { resource: 'trainingJob' });
  const done = cancelledCopy(job);
  mock.jobs = mock.jobs.map((j) => (j.id === id ? done : j));
  return ok(done);
};

const lastKey = (mock: TrainingMock, kind: 'create' | 'cancel'): string | undefined => mock.posts(kind).at(-1)?.headers['idempotency-key'];

/* ---------------------------------------------------------------- FL-35T-09 */

test.describe('SCR-35 Training Jobs · mocked edge (second half)', () => {
  test('SCR-35 · FL-35T-09 · [mocked response] Số đo và nhật ký (luồng cursor) · pair: không (cần job running)', async ({ page }) => {
    test.setTimeout(300_000);
    const wall = jobFixture({ currentEpoch: 3, epochs: 11, n: 1, status: 'running' });
    const opening = jobFixture({ currentEpoch: 2, epochs: 12, family: 'openingAndFurnitureDetection', n: 2, status: 'running' });
    const bad = jobFixture({ currentEpoch: 5, epochs: 13, n: 3, status: 'failed' });
    const mock = await openScreen(page, { jobs: [wall, opening, bad] });
    const metrics = cursorFeed<Point>((p) => p.step);
    const logs = cursorFeed<Line>((l) => l.seq);
    mock.metrics = metrics.responder;
    mock.logs = logs.responder;
    const pick = async (job: WireJob, family: string, cur: number): Promise<void> => {
      await rowBtn(page, family, cur, job.epochs).click();
      await expect(aside(page).getByRole('heading', { level: 2 })).toBeVisible();
    };
    const metricsOf = (job: WireJob) => mock.gets('metrics', job.id);
    const logsOf = (job: WireJob) => mock.gets('logs', job.id);

    await test.step('[35T-B-020] metrics [] -> "Chưa có số đo." + column headers', async () => {
      const metricsBefore = metricsOf(wall).length;
      await pick(wall, WALL, 3);
      await expect.poll(() => metricsOf(wall).length).toBeGreaterThan(metricsBefore);
      await expect(section(page, 'Số đo').getByText('Chưa có số đo.')).toBeVisible();
      for (const name of ['Bước', 'Vòng', 'Tập', 'Loss', 'IoU', 'Lúc']) await expect(section(page, 'Số đo').getByRole('columnheader', { name, exact: true })).toBeVisible();
      await captureEvidence(page, '35T-B-020_metrics_empty.png');
      await pick(opening, OPENING, 2);
      await expect(section(page, 'Số đo').getByRole('columnheader', { name: 'mAP50', exact: true })).toBeVisible();
      await pick(wall, WALL, 3);
    });

    await test.step('[35T-B-021] 3 points -> "Mới nhất: vòng 3, …"; Loss 4 decimals, score 3', async () => {
      metrics.items.push(
        { epoch: 1, loss: 0.5, recordedAt: '2026-01-01T00:00:01.000Z', split: 'train', step: 1 },
        { epoch: 2, iou: 0.4, loss: 0.25, recordedAt: '2026-01-01T00:00:02.000Z', split: 'validation', step: 2 },
        { epoch: 3, iou: 0.7312, loss: 0.1234, recordedAt: '2026-01-01T00:00:03.000Z', split: 'validation', step: 3 },
      );
      await tick(page, 5_000);
      const detail = aside(page);
      await expect.soft(detail.getByText(/Mới nhất: vòng 3, loss 0[.,]1234, IoU 0[.,]731/u)).toBeVisible();
      await expect.soft(section(page, 'Số đo').getByRole('cell', { name: /^0[.,]1234$/u })).toBeVisible();
      await expect.soft(section(page, 'Số đo').getByRole('cell', { name: 'Huấn luyện', exact: true }).first()).toBeVisible();
      await expect.soft(section(page, 'Số đo').getByRole('cell', { name: 'Kiểm định', exact: true }).first()).toBeVisible();
    });

    await test.step('[35T-B-022] logs empty, then 3 levels', async () => {
      await expect.soft(section(page, 'Nhật ký').getByText('Chưa có dòng nhật ký.')).toBeVisible();
      for (const name of ['Lúc', 'Mức', 'Nội dung']) await expect.soft(section(page, 'Nhật ký').getByRole('columnheader', { name, exact: true })).toBeVisible();
      logs.items.push(...logLines(3));
      await tick(page, 5_000);
      for (const name of ['Thông tin', 'Cảnh báo', 'Lỗi']) await expect.soft(section(page, 'Nhật ký').getByText(name, { exact: true })).toBeVisible();
      await expect.soft(section(page, 'Nhật ký').getByText('Chưa có dòng nhật ký.')).toHaveCount(0);
    });

    await test.step('[35T-G-005] wire: limit=200, since = previous nextCursor', async () => {
      await tick(page, 5_000);
      await expect.poll(() => metricsOf(wall).at(-1)?.query.get('since')).toBe('3');
      await expect.poll(() => logsOf(wall).at(-1)?.query.get('since')).toBe('3');
      expect.soft(metricsOf(wall).at(-1)?.query.get('limit')).toBe('200');
      expect.soft(logsOf(wall).at(-1)?.query.get('limit')).toBe('200');
      expect.soft(metricsOf(wall)[0]?.query.has('since')).toBe(false);
    });

    await test.step('[35T-B-023] new lines: at bottom follows, scrolled up stays', async () => {
      const box = scroller(page, 'Nhật ký');
      const height = (): Promise<number> => box.evaluate((el) => el.scrollHeight);
      const top = (): Promise<number> => box.evaluate((el) => el.scrollTop);
      logs.items.push(...logLines(40, 4));
      await tick(page, 5_000);
      await expect.poll(height).toBeGreaterThan(400);
      await softly.poll(() => box.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight), { message: 'at the bottom: scrollTop follows' }).toBeLessThanOrEqual(8); // BOTTOM_SLACK_PX TJD:41
      await box.evaluate((el) => {
        el.scrollTop = 0;
      });
      await expect.poll(top).toBe(0);
      const before = await height();
      logs.items.push(...logLines(5, 44));
      await tick(page, 5_000);
      await expect.poll(height).toBeGreaterThan(before);
      expect.soft(await top(), 'scrolled up: scrollTop unchanged').toBe(0);
    });

    await test.step('[35T-B-024] 2 200 more lines/points: only the last 2 000 are kept', async () => {
      logs.items.push(...logLines(2_200, 49));
      metrics.items.push(...metricPoints(2_200, 10));
      for (let i = 0; i < 12; i += 1) await tick(page, 5_000);
      await expect.poll(() => logsOf(wall).at(-1)?.query.get('since'), { timeout: 60_000 }).toBe('2248');
      for (const name of ['Nhật ký', 'Số đo'] as const) {
        const box = scroller(page, name);
        await softly.poll(() => box.evaluate((el) => el.scrollHeight), { message: `${name}: 2 000 rows x 40 px` }).toBeGreaterThanOrEqual(2_000 * 40);
        await softly.poll(() => box.evaluate((el) => el.scrollHeight)).toBeLessThan(2_000 * 40 + 400);
      }
      await scroller(page, 'Nhật ký').evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await expect.soft(section(page, 'Nhật ký').getByText('qa log line 2248', { exact: true })).toBeVisible();
    });

    await test.step('[35T-B-025] stream 404 stops asking; 500 retries next beat', async () => {
      const count = (job: WireJob, kind: 'metrics' | 'logs') => mock.gets(kind, job.id).length;
      mock.metrics = () => wireError(404, 'NOT_FOUND', { resource: 'trainingJob' });
      const before404 = count(wall, 'metrics');
      await pick(opening, OPENING, 2);
      await pick(wall, WALL, 3);
      await expect.poll(() => count(wall, 'metrics')).toBeGreaterThan(before404); // the 404 request itself has arrived
      const stopped = count(wall, 'metrics');
      const logsBefore = count(wall, 'logs');
      await tick(page, 10_000);
      await tick(page, 10_000);
      await expect.poll(() => count(wall, 'logs')).toBeGreaterThan(logsBefore + 1); // logs still beat: the mark that time passed
      expect.soft(count(wall, 'metrics'), '404: no request after the stop').toBe(stopped);
      mock.metrics = () => wireError(500, 'INTERNAL');
      await pick(opening, OPENING, 2);
      await pick(wall, WALL, 3);
      await expect.poll(() => count(wall, 'metrics')).toBeGreaterThan(stopped);
      const first500 = count(wall, 'metrics');
      await tick(page, 5_000);
      await softly.poll(() => count(wall, 'metrics'), { message: '500: asks again next beat' }).toBeGreaterThan(first500);
    });

    await test.step('[35T-E-014] a11y: regions "Số đo"/"Nhật ký", 320 px scroll areas (no tabIndex: click then PageDown)', async () => {
      mock.metrics = metrics.responder;
      await expect(section(page, 'Số đo')).toBeVisible();
      await expect(section(page, 'Nhật ký')).toBeVisible();
      for (const name of ['Số đo', 'Nhật ký'] as const) {
        const box = await scroller(page, name).boundingBox();
        expect.soft(Math.round(box?.height ?? 0), `${name} scroll area height`).toBe(320);
      }
      const logsBox = scroller(page, 'Nhật ký');
      await expect.poll(() => logsBox.evaluate((el) => el.scrollHeight)).toBeGreaterThan(400);
      await logsBox.evaluate((el) => {
        el.scrollTop = 0;
      });
      await logsBox.click({ position: { x: 20, y: 60 } });
      await page.keyboard.press('PageDown');
      await softly.poll(() => logsBox.evaluate((el) => el.scrollTop), { message: 'PageDown scrolls the log area' }).toBeGreaterThan(0);
    });

    await test.step('[35T-G-007] job with a baseModel outside its family -> "Không đọc được dữ liệu huấn luyện."', async () => {
      mock.jobBody[bad.id] = { ...bad, baseModel: 'yolov8n' }; // TrainingJobSchema refine baseModelMatchesFamily
      await pick(bad, WALL, 5);
      await expect(page.getByText(T.readFallback).first()).toBeVisible();
      await captureEvidence(page, '35T-G-007_bad_job_body.png');
      expect(mock.unexpected, 'no POST and no unknown route').toEqual([]);
    });
  });

  /* -------------------------------------------------------------- FL-35T-10 */

  test('SCR-35 · FL-35T-10 · [mocked response] Huỷ lượt · pair: không', async ({ page }) => {
    test.setTimeout(300_000);
    const a = jobFixture({ currentEpoch: 2, epochs: 21, n: 1, status: 'running' });
    const b = jobFixture({ epochs: 22, family: 'openingAndFurnitureDetection', n: 2, status: 'queued' });
    const c = jobFixture({ epochs: 23, n: 3, status: 'queued' });
    const d = jobFixture({ epochs: 24, family: 'openingAndFurnitureDetection', n: 4, status: 'queued' });
    const e = jobFixture({ currentEpoch: 1, epochs: 25, n: 5, status: 'running' });
    const mock = await openScreen(page, { jobs: [a, b, c, d, e] });
    mock.cancel = cancelOk(mock);
    const open = async (job: WireJob, family: string, cur: number): Promise<void> => {
      await rowBtn(page, family, cur, job.epochs).click();
      await expect(aside(page).getByRole('button', { name: CANCEL, exact: true })).toBeVisible();
    };
    const requestCancel = async (): Promise<Locator> => {
      await aside(page).getByRole('button', { name: CANCEL, exact: true }).click();
      await expect(cancelDialog(page)).toBeVisible();
      return cancelDialog(page).getByRole('button', { name: CANCEL, exact: true });
    };
    const heading2 = aside(page).getByRole('heading', { level: 2 });

    await test.step('[35T-A-015] "Huỷ lượt" -> dialog -> confirm (200 cancelled)', async () => {
      await open(a, WALL, 2);
      const confirm = await requestCancel();
      await expect(cancelDialog(page).getByText(CANCEL_BODY)).toBeVisible();
      await captureEvidence(page, '35T-A-015_cancel_dialog.png');
      await confirm.click();
      await expect(cancelDialog(page)).toBeHidden();
      expect(mock.posts('cancel')).toHaveLength(1);
      expect(mock.posts('cancel')[0]?.path).toMatch(new RegExp(`/training-jobs/${a.id}/cancel$`, 'u'));
      await expect(heading2).toBeFocused();
    });

    await test.step('[35T-G-004] wire: body {} and a different Idempotency-Key per press', async () => {
      const first = lastKey(mock, 'cancel');
      await open(b, OPENING, 0);
      await (await requestCancel()).click();
      await expect(cancelDialog(page)).toBeHidden();
      expect.soft(mock.posts('cancel')[0]?.body).toEqual({});
      expect.soft(mock.posts('cancel')).toHaveLength(2);
      expect.soft(first, 'first key present').toBeTruthy();
      expect.soft(lastKey(mock, 'cancel')).not.toBe(first);
    });

    await test.step('[35T-E-008] Esc closes the dialog (focus on "Huỷ lượt"); after a cancel the h2 takes focus', async () => {
      await open(c, WALL, 0);
      await (await requestCancel()).waitFor();
      await page.keyboard.press('Escape');
      await expect(cancelDialog(page)).toBeHidden();
      await expect.soft(aside(page).getByRole('button', { name: CANCEL, exact: true })).toBeFocused();
      await (await requestCancel()).click();
      await expect(cancelDialog(page)).toBeHidden();
      await expect.soft(heading2).toBeFocused();
    });

    await test.step('[35T-A-016] "Giữ lại" closes the dialog without a cancel request', async () => {
      await open(d, OPENING, 0);
      await requestCancel();
      const before = mock.posts('cancel').length;
      await cancelDialog(page).getByRole('button', { name: KEEP, exact: true }).click();
      await expect(cancelDialog(page)).toBeHidden();
      expect.soft(mock.posts('cancel')).toHaveLength(before);
    });

    await test.step('[35T-B-031] slow cancel + double click: disabled/loading, exactly 1 POST', async () => {
      const slow = held(ok(cancelledCopy(d)));
      mock.cancel = slow.responder;
      const before = mock.posts('cancel').length;
      const confirm = await requestCancel();
      await confirm.dblclick();
      await slow.seen;
      await expect.soft(confirm).toBeDisabled();
      slow.release();
      mock.jobs = mock.jobs.map((j) => (j.id === d.id ? cancelledCopy(d) : j));
      await expect(cancelDialog(page)).toBeHidden();
      expect.soft(mock.posts('cancel')).toHaveLength(before + 1);
      mock.cancel = cancelOk(mock);
    });

    await test.step('[35T-B-028] 409 TRAINING_JOB_NOT_CANCELLABLE -> notice, dialog closed, focus on the title', async () => {
      await open(e, WALL, 1);
      mock.cancel = () => wireError(409, 'TRAINING_JOB_NOT_CANCELLABLE');
      await (await requestCancel()).click();
      await expect(cancelDialog(page)).toBeHidden();
      await expect.soft(aside(page).getByText(T.notCancellable)).toBeVisible();
      await expect.soft(heading2).toBeFocused();
    });

    await test.step('[35T-B-029] 500 then 503: texts inside the dialog, dialog stays open', async () => {
      await open(e, WALL, 1);
      mock.cancel = () => wireError(500, 'INTERNAL');
      const confirm = await requestCancel();
      await confirm.click();
      await expect.soft(cancelDialog(page).getByText(T.write)).toBeVisible();
      await expect(cancelDialog(page)).toBeVisible();
      mock.cancel = () => wireError(503, 'DEPENDENCY_UNAVAILABLE'); // 503 is retried by the http client (about 4-5 s): POST count is not asserted
      await confirm.click();
      await expect(confirm).toBeEnabled({ timeout: 20_000 });
      await expect.soft(cancelDialog(page).getByText(T.busy)).toBeVisible();
      await expect(cancelDialog(page)).toBeVisible();
    });

    await test.step('[35T-B-030] 404 trainingJob -> "Không tìm thấy lượt huấn luyện này."', async () => {
      mock.cancel = () => wireError(404, 'NOT_FOUND', { resource: 'trainingJob' });
      await cancelDialog(page).getByRole('button', { name: CANCEL, exact: true }).click();
      await expect.soft(cancelDialog(page).getByText(T.jobNotFound)).toBeVisible();
      await cancelDialog(page).getByRole('button', { name: KEEP, exact: true }).click();
      await expect(cancelDialog(page)).toBeHidden();
    });

    await test.step('[35T-E-009] 768 wide: Drawer "Chi tiết lượt huấn luyện"; Esc closes, focus back on the row button', async () => {
      await page.setViewportSize({ height: 1024, width: 768 });
      const drawer = page.getByRole('dialog', { name: DETAIL });
      await expect(drawer).toBeVisible(); // the selected job opens in the Drawer once the layout collapses
      await page.keyboard.press('Escape');
      await expect(drawer).toBeHidden();
      const row = rowBtn(page, WALL, 1, e.epochs);
      await row.click();
      await expect(drawer).toBeVisible();
      await captureEvidence(page, '35T-E-009_drawer_768.png');
      await page.keyboard.press('Escape');
      await expect(drawer).toBeHidden();
      await expect.soft(row).toBeFocused();
      expect(mock.unexpected, 'no unknown route / POST').toEqual([]);
    });
  });

  /* -------------------------------------------------------------- FL-35T-11 */

  test('SCR-35 · FL-35T-11 · [mocked response] Tạo lượt: thành công, idempotency, lỗi chung · pair: FL-35T-03', async ({ page }) => {
    test.setTimeout(300_000);
    const existing = jobFixture({ currentEpoch: 1, epochs: 31, n: 1, status: 'running' });
    const fresh = jobFixture({ epochs: 50, n: 9, status: 'queued' });
    const mock = await openScreen(page, { datasets: [datasetFixture(1)], jobs: [existing], versions: [versionFixture(1, 1)] });
    const accept = (call: { body: unknown }) => {
      mock.jobs = [fresh, ...mock.jobs.filter((j) => j.id !== fresh.id)];
      void call;
      return ok(fresh, 202);
    };
    const openForm = async (): Promise<{ submit: Locator; epochs: Locator }> => {
      await page.getByRole('button', { name: CREATE, exact: true }).click();
      const dialog = createDialog(page);
      await expect(dialog).toBeVisible();
      const submit = dialog.getByRole('button', { name: SUBMIT, exact: true });
      await expect(submit).toBeEnabled();
      return { epochs: dialog.getByLabel('Số vòng', { exact: true }), submit };
    };

    await test.step('[35T-A-019] valid form -> 202: 1 POST, dialog closed, job selected, toast', async () => {
      mock.create = accept;
      const { submit } = await openForm();
      await submit.click();
      await expect(createDialog(page)).toBeHidden();
      expect(mock.posts('create')).toHaveLength(1);
      await expect(page.getByRole('tab', { name: TAB_JOBS })).toHaveAttribute('aria-selected', 'true');
      await expect(rowBtn(page, WALL, 0, 50)).toHaveAttribute('aria-pressed', 'true');
      await expect(toast(page, 'Đã xếp hàng lượt huấn luyện')).toBeVisible();
      await expect(toast(page, 'Lượt mới chạy khi máy huấn luyện rảnh.')).toBeVisible();
      await captureEvidence(page, '35T-A-019_created.png');
    });

    await test.step('[35T-G-003] wire: body {family,datasetVersionId,baseModel,epochs:50}, Idempotency-Key', async () => {
      const call = mock.posts('create')[0];
      expect.soft(call?.body).toEqual({ baseModel: 'mitB0', datasetVersionId: versionFixture(1, 1).id, epochs: 50, family: 'wallSegmentation' });
      expect.soft(call?.headers['idempotency-key'], 'Idempotency-Key header').toBeTruthy();
      expect.soft(call?.headers['content-type']).toContain('application/json');
    });

    await test.step('[35T-C-015] body has exactly 4 keys, no creator_id', async () => {
      const body = mock.posts('create')[0]?.body as Record<string, unknown>;
      expect.soft(Object.keys(body).sort()).toEqual(['baseModel', 'datasetVersionId', 'epochs', 'family']);
      expect.soft(JSON.stringify(body)).not.toMatch(/creator/iu);
    });

    await test.step('[35T-A-020] Enter submits when valid (1 POST); epochs=0 + Enter sends nothing', async () => {
      const before = mock.posts('create').length;
      const first = await openForm();
      await first.epochs.press('Enter');
      await expect(createDialog(page)).toBeHidden();
      expect.soft(mock.posts('create')).toHaveLength(before + 1);
      const second = await openForm();
      await second.epochs.fill('0');
      await second.epochs.press('Enter');
      await expect(createDialog(page).getByRole('button', { name: SUBMIT, exact: true })).toBeDisabled(); // the mark: invalid state
      await expect.soft(createDialog(page).getByText(T.epochs).first()).toBeVisible();
      await expect(createDialog(page)).toBeVisible();
      expect.soft(mock.posts('create')).toHaveLength(before + 1);
      await second.epochs.fill('50');
    });

    await test.step('[35T-A-021] double click with a slow POST: exactly 1 POST', async () => {
      const slow = held(ok(fresh, 202));
      mock.create = slow.responder;
      const before = mock.posts('create').length;
      await createDialog(page).getByRole('button', { name: SUBMIT, exact: true }).dblclick();
      await slow.seen;
      slow.release();
      await expect(createDialog(page)).toBeHidden();
      expect.soft(mock.posts('create')).toHaveLength(before + 1);
    });

    await test.step('[35T-C-011] POST 500 / abort -> general errors, list re-read', async () => {
      const { submit } = await openForm();
      mock.create = () => wireError(500, 'INTERNAL');
      const listBefore = mock.gets('jobs').length;
      await submit.click();
      await expect.soft(createDialog(page).getByText(T.write)).toBeVisible();
      await softly.poll(() => mock.gets('jobs').length, { message: 'list re-read after a lost response' }).toBeGreaterThan(listBefore);
      mock.create = () => 'abort';
      await submit.click();
      await expect(submit).toBeEnabled({ timeout: 20_000 }); // abort is retried 3x by the http client (same key): wait for the end
      await expect.soft(createDialog(page).getByText(T.busy)).toBeVisible();
      await captureEvidence(page, '35T-C-011_create_errors.png');
    });

    await test.step('[35T-C-012] same body after abort -> same key; changed epochs -> another key', async () => {
      const submit = createDialog(page).getByRole('button', { name: SUBMIT, exact: true });
      mock.create = () => 'abort'; // the http client retries an aborted POST (same key) up to 3 times: compare keys, never counts
      const keysSince = (n: number): (string | undefined)[] => mock.posts('create').slice(n).map((c) => c.headers['idempotency-key']);
      const n0 = mock.posts('create').length;
      await submit.click();
      await expect(submit).toBeEnabled({ timeout: 20_000 });
      const first = keysSince(n0);
      expect(first.length).toBeGreaterThan(0);
      const n1 = mock.posts('create').length;
      await submit.click();
      await expect(submit).toBeEnabled({ timeout: 20_000 });
      const second = keysSince(n1);
      expect.soft(second.length).toBeGreaterThan(0);
      expect.soft(new Set([...first, ...second]).size, 'resend of the same body keeps one key').toBe(1);
      await createDialog(page).getByLabel('Số vòng', { exact: true }).fill('51');
      const n2 = mock.posts('create').length;
      await submit.click();
      await expect(submit).toBeEnabled({ timeout: 20_000 });
      const third = keysSince(n2);
      expect.soft(third.length).toBeGreaterThan(0);
      expect.soft(third.every((k) => k !== undefined && k !== first[0]), 'another body gets another key').toBe(true);
      expect.soft((mock.posts('create').at(-1)?.body as { epochs: number }).epochs).toBe(51);
    });

    await test.step('[35T-C-013] POST 403 -> dialog closes, "Không có quyền truy cập" page', async () => {
      mock.create = () => wireError(403, 'FORBIDDEN');
      await createDialog(page).getByRole('button', { name: SUBMIT, exact: true }).click();
      await expect(createDialog(page)).toBeHidden();
      await expect(page.getByText(FORBIDDEN, { exact: true })).toBeVisible();
      await captureEvidence(page, '35T-C-013_forbidden.png');
      expect(mock.unexpected, 'no unknown route / undeclared POST').toEqual([]);
    });
  });

  /* -------------------------------------------------------------- FL-35T-12 */

  test('SCR-35 · FL-35T-12 · [mocked response] Tạo lượt: lỗi theo ô (422/404) · pair: FL-35T-03', async ({ page }) => {
    test.setTimeout(240_000);
    const existing = jobFixture({ currentEpoch: 1, epochs: 31, n: 1, status: 'running' });
    const mock = await openScreen(page, { datasets: [datasetFixture(1)], jobs: [existing], versions: [versionFixture(1, 1)] });
    await page.getByRole('button', { name: CREATE, exact: true }).click();
    const dialog = createDialog(page);
    const submit = dialog.getByRole('button', { name: SUBMIT, exact: true });
    await expect(submit).toBeEnabled();
    const fail = async (answer: ReturnType<typeof wireError>): Promise<void> => {
      mock.create = () => answer;
      const before = mock.posts('create').length;
      await submit.click();
      await expect.poll(() => mock.posts('create').length).toBeGreaterThan(before);
    };

    await test.step('[35T-C-005] 422 DATASET_VERSION_NOT_READY -> version field error, versions re-read', async () => {
      const before = mock.gets('versions').length;
      await fail(wireError(422, 'DATASET_VERSION_NOT_READY'));
      await expect(dialog.getByText(T.versionNotReady)).toBeVisible();
      await expect.poll(() => mock.gets('versions').length, { message: 'versions re-read' }).toBeGreaterThan(before);
      await captureEvidence(page, '35T-C-005_version_not_ready.png');
    });

    await test.step('[35T-C-006] 422 DATASET_FAMILY_MISMATCH', async () => {
      await fail(wireError(422, 'DATASET_FAMILY_MISMATCH'));
      await expect.soft(dialog.getByText(T.versionFamily)).toBeVisible();
    });

    await test.step('[35T-C-007] 404 datasetVersion', async () => {
      await fail(wireError(404, 'NOT_FOUND', { resource: 'datasetVersion' }));
      await expect.soft(dialog.getByText(T.versionNotFound)).toBeVisible();
    });

    await test.step('[35T-C-008] 422 TRAINING_BASE_MODEL_MISMATCH -> base model field error', async () => {
      await fail(wireError(422, 'TRAINING_BASE_MODEL_MISMATCH'));
      await expect.soft(dialog.getByText(T.baseMismatch)).toBeVisible();
    });

    await test.step('[35T-C-009] 422 VALIDATION field=epochs -> epochs field error', async () => {
      await fail(wireError(422, 'VALIDATION', { field: 'epochs' }));
      await expect.soft(dialog.getByText(T.epochs).first()).toBeVisible();
    });

    await test.step('[35T-C-010] 422 VALIDATION field=family -> InlineAlert "Biểu mẫu chưa hợp lệ."', async () => {
      await fail(wireError(422, 'VALIDATION', { field: 'family' }));
      await expect.soft(dialog.getByText(T.formInvalid)).toBeVisible();
    });

    await test.step('[35T-C-014] editing a field after the error clears it', async () => {
      await fail(wireError(422, 'TRAINING_BASE_MODEL_MISMATCH'));
      await expect(dialog.getByText(T.baseMismatch)).toBeVisible();
      // E evidence: radios (which base model is checked) and POST count before/after the edit; a late response re-sets the error
      await attachState(page, 'E08_35T-C-014_before.json', { creates: mock.posts('create').length });
      await dialog.getByText('mitB1', { exact: true }).click();
      await expect.soft(dialog.getByText(T.baseMismatch)).toBeHidden();
      await attachState(page, 'E08_35T-C-014_after.json', { creates: mock.posts('create').length });
    });

    await test.step('[35T-E-010] field errors are announced with role="alert"', async () => {
      await fail(wireError(422, 'TRAINING_BASE_MODEL_MISMATCH'));
      await expect.soft(dialog.getByRole('alert').filter({ hasText: T.baseMismatch })).toBeVisible();
      await captureEvidence(page, '35T-E-010_alert_roles.png');
      expect(mock.unexpected, 'no unknown route / undeclared POST').toEqual([]);
    });
  });
});
