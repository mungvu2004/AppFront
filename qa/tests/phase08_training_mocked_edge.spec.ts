/**
 * Phase 8 - SCR-35 Training Jobs, EDGE layer, MOCKED RESPONSES: FL-35T-05..08 (QA-08 P5; flows-C2.md, catalog-C2.md).
 * Every title carries `[mocked response]`; real pair of each: FL-35T-01 (list/detail, read for real) and FL-35T-02 (datasets tab + form).
 * Why mocked: the stack cannot seed jobs (no queued/running without a worker), 5xx/403/offline cannot be produced for real.
 * What is real: the admin session (1 login per flow), the SPA and its HTTP client. Mock: `page.route` on `/api/admin/ml/**` (support/p08/P5.ts);
 * writes and unknown paths are aborted and asserted absent (`mock.stray`) at the end of each flow: no real POST exists anywhere.
 * Polls (15 s list, 5 s job) use `page.clock`; held responses use promises; GET 5xx/429 carry `Retry-After: 0` (HTTP client retries immediately).
 *
 * Request budget per full run: `POST /api/auth/login` 4 (one per flow, limit 120 / 60 s per IP); `POST /api/users/invitations` 0;
 * `POST /api/auth/refresh` ~1 per page load (~45 loads). No data is created.
 * Source (FE): TJ TrainingJobs/TrainingJobs.tsx, TJT TrainingJobsTable.tsx, TJD TrainingJobDetail.tsx, TDT TrainingDatasetsTab.tsx,
 * TJF TrainingJobForm.tsx, UTJ useTrainingJobs.ts, TJG trainingJobsGateway.ts, TFT trainingFailureText.ts.
 */
import { expect, test, type Page } from '@playwright/test';

import { captureEvidence } from './support/evidence';
import { DETAIL, ROUTES, heading, panel } from './support/p08/admin';
import { attachState } from './support/p08/P4';
import {
  aborted,
  adminSession,
  datasetFixture,
  deferred,
  fakeId,
  jobFixture,
  jobsPage,
  mockTrainingApi,
  ok,
  versionFixture,
  wireError,
  type Answer,
  type JobOpts,
  type TrainingMock,
} from './support/p08/P5';

const JOBS = /^training-jobs$/u;
const JOB_ONE = /^training-jobs\/[^/]+$/u;
const BUSY = 'Máy chủ đang bận. Thử lại sau ít phút.'; // TJG:158-164 (TRAINING_ERROR_TEXT.busy)
const READ_FALLBACK = 'Không đọc được dữ liệu huấn luyện.'; // TJG:158
const ERROR_TITLE = 'Không đọc được dữ liệu huấn luyện'; // TJT:19
const RETRY = 'Thử lại'; // TJT:18
const MORE = 'Xem thêm'; // TJT:22
const EMPTY_JOBS_TITLE = 'Chưa có lượt huấn luyện'; // TJT:20
const EMPTY_JOBS_BODY = 'Chưa có lượt huấn luyện nào. Tạo lượt đầu tiên từ bộ dữ liệu sẵn sàng.'; // UTJ:146
const TAB_DATASETS = 'Bộ dữ liệu'; // TJ:35
const CREATE = 'Tạo lượt huấn luyện'; // TJ:38
const ev = (page: Page, id: string, slug: string): Promise<string> => captureEvidence(page, `E08_${id}_${slug}.png`);
const softPoll = <T>(fn: () => T | Promise<T>) => expect.configure({ soft: true }).poll(fn);

const gotoJobs = async (page: Page): Promise<void> => {
  await page.goto(ROUTES.jobs);
  await expect(heading(page, 'jobs')).toBeVisible();
};
const reloadJobs = async (page: Page): Promise<void> => {
  await page.reload();
  await expect(heading(page, 'jobs')).toBeVisible();
};
const busyRegion = (page: Page) => page.locator('[aria-busy="true"]');
const jobsTable = (page: Page) => page.getByRole('table');
/** Row of the job whose dataset-version tail is `tail` (rendered as "…<last 6>", UTJ shortCode). */
const rowOf = (page: Page, tail: string) => page.getByRole('row').filter({ hasText: `…${tail.slice(-6)}` });
const tabDatasets = (page: Page) => page.getByRole('tab', { name: TAB_DATASETS, exact: true });
const openDatasetsTab = async (page: Page): Promise<void> => {
  await tabDatasets(page).click();
};
const expectNoWrites = (mock: TrainingMock): void => {
  expect(mock.stray.map((c) => `${c.method} ${c.path}`), 'no write / unknown path left the page').toEqual([]);
};
/** Distinct dataset-version tails make rows findable: 6-char tail D0000n. */
const job = (n: number, o: JobOpts = {}): Record<string, unknown> =>
  jobFixture({ datasetVersionId: fakeId('dsv', `D0000${n}`), tail: `A${n}`, ...o });

test.describe('E08 SCR-35 training jobs - mocked-response flows (QA-08 P5)', () => {
  test('SCR-35 · FL-35T-05 · [mocked response] Danh sách: tải, lỗi, rỗng, hàng, một phần', async ({ browser }) => {
    test.setTimeout(150_000);
    const { context, page } = await adminSession(browser);
    try {
      const gate = deferred<Answer>();
      const mock = await mockTrainingApi(page, { list: () => gate.promise });

      await test.step('[35T-B-001] list GET held -> aria-busy skeleton, toolbar and tabs stay', async () => {
        await page.goto(ROUTES.jobs, { waitUntil: 'commit' });
        await expect(busyRegion(page).first()).toBeVisible(); // TJ:96-103
        await expect(page.getByRole('tab', { name: 'Lượt huấn luyện', exact: true })).toBeVisible();
        await expect(tabDatasets(page)).toBeVisible();
        await expect(page.getByLabel('Lọc theo họ')).toBeVisible();
        await expect(page.getByRole('button', { name: CREATE, exact: true })).toBeVisible();
        await ev(page, '35T-B-001', 'loading-skeleton');
      });

      await test.step('[35T-E-013] same state: the loading region carries aria-busy=true', async () => {
        await expect.soft(busyRegion(page).first()).toHaveAttribute('aria-busy', 'true'); // TJ:98
        expect.soft(await busyRegion(page).count(), 'a busy region exists while the GET is held').toBeGreaterThan(0);
        await ev(page, '35T-E-013', 'aria-busy');
      });

      let before = 0;
      await test.step('[35T-B-003] GET 500 -> title, message, "Thử lại"; toolbar stays', async () => {
        mock.on.list = () => wireError(500, 'INTERNAL');
        gate.resolve(wireError(500, 'INTERNAL'));
        await expect.soft(page.getByText(ERROR_TITLE, { exact: true })).toBeVisible({ timeout: 20_000 }); // TJT:105-117
        await expect.soft(page.getByText(READ_FALLBACK, { exact: true })).toBeVisible();
        await expect.soft(page.getByRole('button', { name: RETRY, exact: true })).toBeVisible();
        await expect.soft(page.getByRole('button', { name: CREATE, exact: true })).toBeVisible();
        before = mock.count('GET', JOBS);
        await ev(page, '35T-B-003', 'error-500');
      });

      await test.step('[35T-B-004] "Thử lại" -> exactly 1 more GET, then the table/empty state', async () => {
        mock.on.list = () => ok(jobsPage([]));
        await page.getByRole('button', { name: RETRY, exact: true }).click(); // UTJ:728-731
        await softPoll(() => mock.count('GET', JOBS)).toBe(before + 1);
        await expect.soft(page.getByText(EMPTY_JOBS_TITLE, { exact: true })).toBeVisible();
        await ev(page, '35T-B-004', 'retry-ok');
      });

      await test.step('[35T-B-005] GET 429 -> busy message', async () => {
        mock.on.list = () => wireError(429, 'RATE_LIMITED');
        await reloadJobs(page);
        await expect.soft(page.getByText(BUSY, { exact: true })).toBeVisible({ timeout: 20_000 });
        await ev(page, '35T-B-005', 'error-429');
      });

      await test.step('[35T-B-006] route.abort -> busy message', async () => {
        mock.on.list = () => aborted;
        await reloadJobs(page);
        await expect.soft(page.getByText(BUSY, { exact: true })).toBeVisible({ timeout: 20_000 }); // network ladder ~4 s
        await ev(page, '35T-B-006', 'error-network');
      });

      await test.step('[35T-B-007] items:[] -> empty state title + description', async () => {
        mock.on.list = () => ok(jobsPage([]));
        await reloadJobs(page);
        await expect.soft(page.getByText(EMPTY_JOBS_TITLE, { exact: true })).toBeVisible();
        await expect.soft(page.getByText(EMPTY_JOBS_BODY, { exact: true })).toBeVisible();
        await ev(page, '35T-B-007', 'empty');
      });

      await test.step('[35T-B-010] one full job -> headers, "…123456", "3/50"', async () => {
        mock.on.list = () => ok(jobsPage([jobFixture({ currentEpoch: 3, datasetVersionId: fakeId('dsv', 'ABCDEF123456'), epochs: 50, status: 'running' })]));
        await reloadJobs(page);
        const table = jobsTable(page);
        for (const h of ['Họ', 'Model nền', 'Phiên bản bộ dữ liệu', 'Vòng', 'Trạng thái', 'Bắt đầu', 'Kết thúc']) {
          await expect.soft(table.getByRole('columnheader', { name: h, exact: true })).toBeVisible(); // TJT:23
        }
        await expect.soft(table.getByText('…123456', { exact: true })).toBeVisible();
        await expect.soft(table.getByText('3/50', { exact: true })).toBeVisible();
        await ev(page, '35T-B-010', 'columns-cells');
      });

      await test.step('[35T-B-011] six jobs, six status labels', async () => {
        const statuses = ['queued', 'running', 'failed', 'cancelling', 'cancelled', 'succeeded'] as const;
        mock.on.list = () => ok(jobsPage(statuses.map((status, i) => job(i + 1, { status }))));
        await reloadJobs(page);
        // UTJ:120-127; succeeded is rendered "Xong" in source (the catalog row only says "nhãn succeeded")
        for (const label of ['Chờ chạy', 'Đang chạy', 'Hỏng', 'Đang huỷ', 'Đã huỷ', 'Xong']) {
          await expect.soft(jobsTable(page).getByText(label, { exact: true })).toBeVisible();
        }
        await ev(page, '35T-B-011', 'status-badges');
      });

      await test.step('[35T-B-009] two active jobs -> "2 lượt đang chờ hoặc chạy; số liệu tự cập nhật."', async () => {
        mock.on.list = () => ok(jobsPage([job(1, { status: 'queued' }), job(2, { currentEpoch: 1, status: 'running' })]));
        await reloadJobs(page);
        await expect.soft(page.getByText('2 lượt đang chờ hoặc chạy; số liệu tự cập nhật.', { exact: true })).toBeVisible(); // UTJ:197-199
        await ev(page, '35T-B-009', 'partial-notice');
      });

      expectNoWrites(mock);
    } finally {
      await context.close();
    }
  });

  test('SCR-35 · FL-35T-06 · [mocked response] Phân trang, polling, 403, ngoại tuyến', async ({ browser }) => {
    test.setTimeout(150_000);
    const { context, page } = await adminSession(browser);
    try {
      await page.clock.install();
      const cursorOf = (url: URL): string | null => url.searchParams.get('cursor');
      const done = (n: number) => job(n, { status: 'cancelled' });
      const twoPages = (cursor: string | null): Answer => (cursor === null ? ok(jobsPage([done(1), done(2)], 'c1')) : ok(jobsPage([done(3)])));
      const mock = await mockTrainingApi(page, { list: (c) => twoPages(cursorOf(c.url)) });

      await test.step('[35T-A-017] two pages: "Xem thêm" appends rows (request cursor=c1)', async () => {
        await gotoJobs(page);
        await expect(jobsTable(page).getByRole('row')).toHaveCount(3); // header + 2
        await page.getByRole('button', { name: MORE, exact: true }).click(); // TJT:129-133
        await softPoll(() => mock.count('GET', JOBS, (q) => q.get('cursor') === 'c1')).toBe(1);
        await expect.soft(jobsTable(page).getByRole('row')).toHaveCount(4);
        await expect.soft(page.getByRole('button', { name: MORE, exact: true })).toHaveCount(0);
        await ev(page, '35T-A-017', 'load-more');
      });

      await test.step('[35T-B-013] page 2 held -> "Xem thêm" is loading (disabled)', async () => {
        const gate = deferred<Answer>();
        mock.on.list = (c) => (cursorOf(c.url) === null ? ok(jobsPage([done(1), done(2)], 'c1')) : gate.promise);
        await reloadJobs(page);
        const more = page.getByRole('button', { name: MORE, exact: true });
        await more.click();
        await expect.soft(more).toBeDisabled(); // Button loading => disabled (ui/Button.tsx:41)
        await ev(page, '35T-B-013', 'load-more-loading');
        gate.resolve(ok(jobsPage([done(3)])));
        await expect(jobsTable(page).getByRole('row')).toHaveCount(4);
      });

      await test.step('[35T-B-012] page 2 = 500 -> alert; CURSOR_INVALID -> silent retry, no alert', async () => {
        mock.on.list = (c) => (cursorOf(c.url) === null ? ok(jobsPage([done(1), done(2)], 'c1')) : wireError(500, 'INTERNAL'));
        await reloadJobs(page);
        await page.getByRole('button', { name: MORE, exact: true }).click();
        await expect.soft(page.getByRole('alert').filter({ hasText: READ_FALLBACK })).toBeVisible({ timeout: 20_000 }); // UTJ:300-320
        await ev(page, '35T-B-012', 'load-more-500');

        mock.on.list = (c) => (cursorOf(c.url) === null ? ok(jobsPage([done(1), done(2)], 'c1')) : wireError(400, 'CURSOR_INVALID'));
        await reloadJobs(page);
        const firstPage = (): number => mock.count('GET', JOBS, (q) => q.get('cursor') === null);
        const before = firstPage();
        await page.getByRole('button', { name: MORE, exact: true }).click();
        await softPoll(firstPage).toBe(before + 1); // resetQueries re-reads page 1 (UTJ onLoadMore)
        await expect.soft(page.getByRole('alert').filter({ hasText: READ_FALLBACK })).toHaveCount(0);
      });

      await test.step('[35T-A-022] active job: fastForward(15000) -> exactly 1 list GET; no poll beyond 3 pages', async () => {
        const run = job(1, { currentEpoch: 2, status: 'running' });
        mock.on.list = () => ok(jobsPage([run]));
        await reloadJobs(page);
        await expect(jobsTable(page).getByRole('row')).toHaveCount(2);
        const n0 = mock.count('GET', JOBS);
        await page.clock.fastForward(15_000); // UTJ JOB_LIST_POLL_MS
        await softPoll(() => mock.count('GET', JOBS)).toBe(n0 + 1);

        // 4 pages loaded (1 + 3 "Xem thêm"): pages.length > 3 stops the poll.
        const chain: Record<string, Answer> = { c1: ok(jobsPage([done(2)], 'c2')), c2: ok(jobsPage([done(3)], 'c3')), c3: ok(jobsPage([done(4)])) };
        mock.on.list = (c) => chain[cursorOf(c.url) ?? ''] ?? ok(jobsPage([run], 'c1'));
        await reloadJobs(page);
        for (let i = 0; i < 3; i += 1) {
          await page.getByRole('button', { name: MORE, exact: true }).click();
          await expect(jobsTable(page).getByRole('row')).toHaveCount(3 + i);
        }
        const n1 = mock.count('GET', JOBS);
        await page.clock.fastForward(15_000);
        await page.clock.fastForward(1_000); // past the 15 s tick, so a poll timer due now has fired before the mark
        // mark: the datasets-tab GET is answered after any list GET the fast-forward could have fired
        await openDatasetsTab(page);
        await expect.poll(() => mock.count('GET', /^datasets$/u)).toBeGreaterThan(0);
        expect.soft(mock.count('GET', JOBS), 'no list poll with more than 3 pages').toBe(n1);
        await ev(page, '35T-A-022', 'poll-15s');
      });

      await test.step('[35T-B-040] GET 403 -> "Không có quyền truy cập", no tabs', async () => {
        mock.on.list = () => wireError(403, 'FORBIDDEN');
        await reloadJobs(page);
        await expect.soft(page.getByText('Không có quyền truy cập', { exact: true })).toBeVisible(); // TJ:34-37
        await expect.soft(page.getByText('Chỉ quản trị viên hệ thống xem được trang huấn luyện.', { exact: true })).toBeVisible();
        await expect.soft(page.getByRole('tab')).toHaveCount(0);
        await ev(page, '35T-B-040', 'forbidden');
      });

      await test.step('[35T-B-041] offline then online: busy message, "Thử lại" reads again', async () => {
        mock.on.list = () => ok(jobsPage([]));
        await reloadJobs(page);
        // offline = browser offline AND the mock aborts (a routed request may bypass the offline emulation)
        mock.on.datasets = () => aborted;
        await context.setOffline(true);
        // E evidence: datasets GETs seen before the click (> 0 = answered at page load, cache may hide the offline error)
        const datasetsGets = (): number => mock.count('GET', /^datasets$/u);
        const getsBefore = datasetsGets();
        await attachState(page, 'E08_35T-B-041_before.json', { datasetsGets: getsBefore, strayPaths: mock.stray.map((c) => c.path) });
        await openDatasetsTab(page);
        await expect.soft(page.getByText(BUSY, { exact: true })).toBeVisible({ timeout: 20_000 }); // TJG:160-164
        await attachState(page, 'E08_35T-B-041_after.json', { datasetsGetsAfter: datasetsGets(), datasetsGetsBefore: getsBefore });
        await ev(page, '35T-B-041', 'offline');
        mock.on.datasets = () => ok({ items: [] });
        await context.setOffline(false);
        // back online TanStack resumes the paused read itself (vitest [35T-B-041]), so "Thử lại" may already be gone
        await expect.soft(page.getByText('Chưa có bộ dữ liệu', { exact: true })).toBeVisible();
      });

      expectNoWrites(mock);
    } finally {
      await context.close();
    }
  });

  test('SCR-35 · FL-35T-07 · [mocked response] Tab "Bộ dữ liệu" và lỗi dữ liệu form', async ({ browser }) => {
    test.setTimeout(150_000);
    const { context, page } = await adminSession(browser);
    try {
      const gate = deferred<Answer>();
      const ds = datasetFixture();
      const versionsPanel = page.getByRole('region', { name: 'Phiên bản', exact: true }); // TDT versions section
      const mock = await mockTrainingApi(page, { datasets: () => gate.promise, list: () => ok(jobsPage([])) });
      const reopen = async (): Promise<void> => {
        await reloadJobs(page);
        await openDatasetsTab(page);
      };

      await test.step('[35T-B-002] datasets held -> skeleton rows in the panel', async () => {
        await gotoJobs(page);
        await openDatasetsTab(page);
        await expect(busyRegion(page).first()).toBeVisible(); // TJ:153-157 LoadingArea
        await expect.soft(busyRegion(page).first().locator('.animate-pulse').first()).toBeVisible();
        await ev(page, '35T-B-002', 'datasets-loading');
      });

      await test.step('[35T-B-034] datasets [] -> "Chưa có bộ dữ liệu" + description', async () => {
        gate.resolve(ok({ items: [] }));
        await expect.soft(page.getByText('Chưa có bộ dữ liệu', { exact: true })).toBeVisible(); // TDT:27,75-78
        await expect.soft(page.getByText('Chưa có bộ dữ liệu nào. Dựng bằng công cụ dòng lệnh.', { exact: true })).toBeVisible();
        await ev(page, '35T-B-034', 'datasets-empty');
      });

      await test.step('[35T-B-035] 3 versions (ready/building/failed): headers, split, sources, statuses', async () => {
        mock.on.datasets = () => ok({ items: [ds] });
        mock.on.versions = () =>
          ok({
            items: [
              versionFixture({ sequence: 3, source: 'approvedFloors', status: 'ready' }),
              versionFixture({ sequence: 2, source: 'cubicasa5k', status: 'building' }),
              versionFixture({ failureCode: 'DATASET_EMPTY', sequence: 1, status: 'failed' }),
            ],
          });
        await reopen();
        const table = versionsPanel.getByRole('table');
        for (const h of ['Số thứ tự', 'Trạng thái', 'Nguồn', 'Huấn luyện / kiểm định / kiểm tra', 'Ngày tạo', 'Ghi chú']) {
          await expect.soft(table.getByRole('columnheader', { name: h, exact: true })).toBeVisible(); // TDT:30
        }
        await expect.soft(table.getByText('800 / 100 / 100', { exact: true })).toBeVisible();
        await expect.soft(table.getByText('Tầng đã duyệt', { exact: true })).toHaveCount(2); // seq 3 (approvedFloors) + failed seq 1 (versionFixture default source)
        await expect.soft(table.getByText('Bộ dữ liệu công khai', { exact: true })).toBeVisible();
        for (const s of ['Sẵn sàng', 'Đang dựng', 'Hỏng']) await expect.soft(table.getByText(s, { exact: true })).toBeVisible();
        await ev(page, '35T-B-035', 'versions-table');
      });

      await test.step('[35T-B-036] versions [] -> "Bộ dữ liệu này chưa có phiên bản nào."', async () => {
        mock.on.versions = () => ok({ items: [] });
        await reopen();
        await expect.soft(page.getByText('Bộ dữ liệu này chưa có phiên bản nào.', { exact: true })).toBeVisible(); // TDT:26,39
        await ev(page, '35T-B-036', 'versions-empty');
      });

      await test.step('[35T-B-037] versions 500 -> read-error alert; held -> table-row skeleton', async () => {
        mock.on.versions = () => wireError(500, 'INTERNAL');
        await reopen();
        await expect.soft(versionsPanel.getByRole('alert').filter({ hasText: READ_FALLBACK })).toBeVisible({ timeout: 20_000 }); // TDT:37-38
        await ev(page, '35T-B-037', 'versions-error');
        const hold = deferred<Answer>();
        mock.on.versions = () => hold.promise;
        await reopen();
        await expect.soft(versionsPanel.locator('.animate-pulse').first()).toBeVisible();
        hold.resolve(ok({ items: [] }));
      });

      await test.step('[35T-B-038] failure codes -> sentences (unknown code falls back, code not printed)', async () => {
        const codes: Array<[string, string]> = [
          ['DATASET_EMPTY', 'Không có mẫu nào đạt.'],
          ['DATASET_TOO_LARGE', 'Vượt giới hạn số mẫu hoặc dung lượng.'],
          ['DATASET_FAMILY_UNSUPPORTED', 'Họ này chưa dựng được bộ dữ liệu.'],
          ['WORKER_LOST', 'Dựng bị gián đoạn. Dựng lại bằng công cụ dòng lệnh.'],
          ['QA_ODD_CODE', 'Dựng không thành công vì một lỗi chưa có mô tả.'], // unknown -> TFT DATASET_TEXT.unknown
        ];
        mock.on.versions = () =>
          ok({ items: codes.map(([failureCode], i) => versionFixture({ failureCode, sequence: i + 1, status: 'failed' })) });
        await reopen();
        for (const [, text] of codes) await expect.soft(versionsPanel.getByText(text, { exact: true })).toBeVisible(); // TFT:18-24,57-70
        await expect.soft(versionsPanel.getByText('QA_ODD_CODE')).toHaveCount(0);
        await ev(page, '35T-B-038', 'failure-notes');
      });

      await test.step('[35T-B-039] versions 404 resource=dataset -> "Không tìm thấy bộ dữ liệu này."', async () => {
        mock.on.versions = () => wireError(404, 'NOT_FOUND', { resource: 'dataset' });
        await reopen();
        await expect.soft(page.getByText('Không tìm thấy bộ dữ liệu này.', { exact: true })).toBeVisible(); // TJG:127-135
        await ev(page, '35T-B-039', 'dataset-404');
      });

      await test.step('[35T-B-032] form, family without datasets -> "Bộ dữ liệu" disabled, "Chọn…"', async () => {
        mock.on.datasets = () => ok({ items: [] });
        await reloadJobs(page);
        await page.getByRole('button', { name: CREATE, exact: true }).click();
        const form = page.getByRole('dialog');
        await expect.soft(form.getByRole('combobox', { name: 'Bộ dữ liệu', exact: true })).toBeDisabled(); // TJF:41,92
        await expect.soft(form.getByText('Chọn…').first()).toBeVisible();
        await ev(page, '35T-B-032', 'form-no-datasets');
      });

      await test.step('[35T-B-033] form, dataset with only a building version -> alert on "Phiên bản"', async () => {
        mock.on.datasets = () => ok({ items: [ds] });
        mock.on.versions = () => ok({ items: [versionFixture({ sequence: 1, status: 'building' })] });
        await reloadJobs(page);
        await page.getByRole('button', { name: CREATE, exact: true }).click();
        await expect.soft(page.getByRole('dialog').getByRole('alert').filter({ hasText: 'Bộ dữ liệu này chưa có phiên bản sẵn sàng.' })).toBeVisible(); // UTJ:775
        await ev(page, '35T-B-033', 'form-no-ready-version');
      });

      expectNoWrites(mock);
    } finally {
      await context.close();
    }
  });

  test('SCR-35 · FL-35T-08 · [mocked response] Chi tiết lượt', async ({ browser }) => {
    test.setTimeout(180_000);
    const { context, page } = await adminSession(browser);
    try {
      await page.clock.install();
      const statuses = ['running', 'failed', 'queued', 'succeeded', 'cancelling', 'cancelled'] as const;
      const jobs = statuses.map((status, i) =>
        job(i + 1, { ...(status === 'running' ? { currentEpoch: 3 } : {}), family: i === 1 ? 'openingAndFurnitureDetection' : 'wallSegmentation', status }),
      );
      const byPath = (path: string): Record<string, unknown> | undefined => jobs.find((j) => path.endsWith(String(j.id)));
      const mock = await mockTrainingApi(page, {
        job: (c) => {
          const found = byPath(c.path);
          return found === undefined ? wireError(404, 'NOT_FOUND', { resource: 'trainingJob' }) : ok(found);
        },
        list: () => ok(jobsPage(jobs)),
      });
      const tail = (n: number): string => `D0000${n}`;
      const aside = panel(page, DETAIL.jobs);
      const pick = (n: number) => rowOf(page, tail(n)).getByRole('button');
      const jobGets = (): number => mock.count('GET', JOB_ONE);

      await test.step('[35T-A-013] click row -> aside, title "Tách lớp tường · mitB0", GET training-jobs/:id', async () => {
        await gotoJobs(page);
        const seen = page.waitForRequest((r) => new URL(r.url()).pathname === `/api/admin/ml/training-jobs/${String(jobs[0]?.id)}`);
        await pick(1).click();
        await seen;
        await expect(aside).toBeVisible(); // TJ:107-125
        await expect.soft(aside.getByRole('heading', { level: 2, name: 'Tách lớp tường · mitB0', exact: true })).toBeVisible();
        await ev(page, '35T-A-013', 'detail-open');
      });

      await test.step('[35T-E-007] row is a toggle button: aria-pressed changes; Enter/Space open detail', async () => {
        await expect.soft(pick(1)).toHaveAttribute('aria-pressed', 'true'); // TJT:29-38
        await expect.soft(pick(2)).toHaveAttribute('aria-pressed', 'false');
        await pick(2).focus();
        await page.keyboard.press('Enter');
        await expect.soft(aside.getByRole('heading', { level: 2 })).toHaveText('Nhận diện cửa và đồ đạc · yolov8n');
        await pick(3).focus();
        await page.keyboard.press('Space');
        await expect.soft(pick(3)).toHaveAttribute('aria-pressed', 'true');
        await ev(page, '35T-E-007', 'row-keyboard');
      });

      await test.step('[35T-B-019] detail fields and status badge', async () => {
        await pick(1).click();
        for (const label of ['Họ', 'Model nền', 'Phiên bản bộ dữ liệu', 'Vòng', 'Tạo lúc', 'Bắt đầu', 'Kết thúc']) {
          await expect.soft(aside.locator('dt', { hasText: new RegExp(`^${label}$`, 'u') })).toBeVisible(); // TJD:158-166
        }
        await expect.soft(aside.getByText('Đang chạy', { exact: true })).toBeVisible();
        await ev(page, '35T-B-019', 'detail-fields');
      });

      await test.step('[35T-A-014] another job: pressed moves, detail changes, metrics/logs reset', async () => {
        await pick(2).click();
        await expect.soft(pick(2)).toHaveAttribute('aria-pressed', 'true'); // UTJ:437-512
        await expect.soft(pick(1)).toHaveAttribute('aria-pressed', 'false');
        await expect.soft(aside.getByRole('heading', { level: 2 })).toHaveText('Nhận diện cửa và đồ đạc · yolov8n');
        await expect.soft(aside.getByText('Chưa có số đo.', { exact: true })).toBeVisible();
        await expect.soft(aside.getByText('Chưa có dòng nhật ký.', { exact: true })).toBeVisible();
        await ev(page, '35T-A-014', 'detail-switch');
      });

      await test.step('[35T-B-015] GET :id held while the job left the list -> property-panel skeleton', async () => {
        // The skeleton only shows while neither N34 nor the list knows the job (TJD:147-149): select it, hold N34, then a 15 s poll drops it from the list.
        const hold = deferred<Answer>();
        const solo = job(9, { currentEpoch: 1, status: 'running' });
        const other = job(8, { currentEpoch: 1, status: 'running' });
        mock.on.list = () => ok(jobsPage([solo, other]));
        mock.on.job = () => hold.promise;
        await reloadJobs(page);
        await rowOf(page, tail(9)).getByRole('button').click();
        mock.on.list = () => ok(jobsPage([other]));
        await page.clock.fastForward(15_000);
        await expect.soft(aside.locator('.animate-pulse').first()).toBeVisible();
        await expect.soft(aside.getByRole('heading', { level: 2 })).toHaveCount(0);
        await ev(page, '35T-B-015', 'detail-skeleton');
        hold.resolve(ok(solo));
      });

      await test.step('[35T-B-016] GET :id 404 resource=trainingJob -> "Không tìm thấy lượt huấn luyện này."', async () => {
        mock.on.list = () => ok(jobsPage(jobs));
        mock.on.job = () => wireError(404, 'NOT_FOUND', { resource: 'trainingJob' });
        await reloadJobs(page);
        await pick(3).click();
        await expect.soft(aside.getByText('Không tìm thấy lượt huấn luyện này.', { exact: true })).toBeVisible(); // TJG:127-135
        await ev(page, '35T-B-016', 'detail-404');
      });

      await test.step('[35T-B-017] failed TRAINING_TIMEOUT -> "Chạy quá thời gian cho phép. Thử ít vòng hơn."', async () => {
        mock.on.job = (c) => {
          const found = byPath(c.path);
          return found === undefined ? wireError(404, 'NOT_FOUND') : ok(found);
        };
        await reloadJobs(page);
        await pick(2).click();
        await expect.soft(aside.getByText('Chạy quá thời gian cho phép. Thử ít vòng hơn.', { exact: true })).toBeVisible(); // TFT:13,45
        await ev(page, '35T-B-017', 'failure-timeout');
      });

      await test.step('[35T-B-018] seven failure codes -> sentences, code never printed', async () => {
        const table: Array<[string, string]> = [
          ['TRAINING_GPU_BUSY', 'Máy huấn luyện bận hoặc mất liên lạc. Tạo lại lượt sau.'],
          ['TRAINING_LOSS_NOT_FINITE', 'Mất mát không hội tụ. Thử model nền khác hoặc ít vòng hơn.'],
          ['DATASET_SPLIT_EMPTY', 'Bộ dữ liệu thiếu mẫu hoặc có mẫu hỏng. Chọn phiên bản khác.'],
          ['TRAINING_TRAINER_MISSING', 'Máy huấn luyện chưa cài bộ huấn luyện.'],
          ['TRAINING_DISK_FULL', 'Máy huấn luyện hết dung lượng đĩa.'],
          ['MODEL_CHECKSUM_MISMATCH', 'Máy huấn luyện lỗi cấu hình hoặc dữ liệu không khớp.'],
          ['QA_ODD_CODE', 'Lượt không thành công vì một lỗi chưa có mô tả.'],
        ];
        const failed = table.map(([failureCode], i) => job(i + 1, { failureCode, status: 'failed' }));
        mock.on.list = () => ok(jobsPage(failed));
        mock.on.job = (c) => ok(failed.find((j) => c.path.endsWith(String(j.id))));
        await reloadJobs(page);
        for (const [i, [code, text]] of table.entries()) {
          await pick(i + 1).click();
          await expect.soft(aside.getByText(text, { exact: true })).toBeVisible(); // TFT:7-15,40-55
          await expect.soft(aside.getByText(code)).toHaveCount(0);
        }
        await ev(page, '35T-B-018', 'failure-codes');
      });

      await test.step('[35T-B-026] "Huỷ lượt" only for queued/running', async () => {
        mock.on.list = () => ok(jobsPage(jobs));
        mock.on.job = (c) => ok(byPath(c.path));
        await reloadJobs(page);
        const cancel = aside.getByRole('button', { name: 'Huỷ lượt', exact: true });
        const shown: Record<string, boolean> = { cancelled: false, cancelling: false, failed: false, queued: true, running: true, succeeded: false };
        for (const [i, status] of statuses.entries()) {
          await pick(i + 1).click();
          await expect(aside.getByRole('heading', { level: 2 })).toBeVisible();
          await expect.soft(cancel, `cancel button for ${status}`).toHaveCount(shown[status] === true ? 1 : 0); // UTJ:252
        }
        await ev(page, '35T-B-026', 'cancel-visibility');
      });

      await test.step('[35T-A-018] succeeded job -> link "Xem model AI đã tạo" -> /admin/training/models', async () => {
        await pick(4).click();
        const link = aside.getByRole('link', { name: 'Xem model AI đã tạo', exact: true });
        await expect.soft(link).toBeVisible();
        await expect.soft(link).toHaveAttribute('href', ROUTES.registry); // TJD:166-170
        await ev(page, '35T-A-018', 'result-link');
      });

      await test.step('[35T-B-027] running -> succeeded: GET :id every 5 s, then the list refreshes', async () => {
        const run = job(7, { currentEpoch: 10, status: 'running' });
        const finished = job(7, { status: 'succeeded' });
        let answered = 0;
        mock.on.list = () => ok(jobsPage([run]));
        mock.on.job = () => ok(answered++ === 0 ? run : finished);
        await reloadJobs(page);
        await rowOf(page, tail(7)).getByRole('button').click();
        await expect.poll(jobGets).toBeGreaterThan(0);
        const n0 = jobGets();
        const lists = mock.count('GET', JOBS);
        mock.on.list = () => ok(jobsPage([finished]));
        await page.clock.fastForward(5_000); // UTJ JOB_STATUS_POLL_MS
        await softPoll(jobGets).toBe(n0 + 1);
        await expect.soft(aside.getByText('Xong', { exact: true })).toBeVisible();
        await softPoll(() => mock.count('GET', JOBS)).toBeGreaterThan(lists); // list refreshed once the job ended (UTJ previousStatusRef)
        await ev(page, '35T-B-027', 'poll-5s-finished');
      });

      expectNoWrites(mock);
    } finally {
      await context.close();
    }
  });
});
