/**
 * Phase 3 — SCR-12 processing, FAILED runs (PipelineFailure), real sequential flows (QA-03d P8; plan `flow-plan.md`
 * "phase03_processing_failure_edge.spec.ts"). One `test()` per flow, one `test.step('[<row id>] …')` per catalog row.
 * `H` rows hard `expect`, `S` rows `expect.soft`; `ev` rows capture `E03_<row id>_<slug>.png`.
 *
 * Source @ c16f2428 (src/screens/pipeline/): PRC ProcessingScreen/ProcessingScreen.container.tsx (swap to
 * PipelineFailure once every floor is final and one failed) · UPR …/useProcessingScreen.ts failedPipelineStep ·
 * PF PipelineFailure/PipelineFailure.tsx · PFA …/PipelineFailureAlert.tsx · PFD …/PipelineFailureDetails.tsx ·
 * PFP …/PipelineFailureProgress.tsx · UPF …/usePipelineFailure.ts · PFT …/pipelineFailureText.ts · PET pipelineErrorText.ts.
 *
 * Failed runs are real: crafted PNGs uploaded through the API fail in the worker's preprocess step (phase03Seed
 * `corruptPng` → FILE_CORRUPT, `oversizePng` → IMAGE_TOO_LARGE; BE packages/vision/preprocess/raster.py).
 * Owner: pool engineer `p8-processing`; projects deleted in `finally`. No pool user changes state. Mocks: none.
 *
 * Request budget per full file run (QA stack limits):
 * - `POST /api/auth/login`: 3 per flow (main admin, owner API, browser) = 6.
 * - `POST …/drawings/uploads` (drawings_init 300 / 600 s per user): FL-12-08 2 (corrupt + UI fix), FL-12-09 3 = 5.
 * - `POST /api/projects`: 2, each deleted. `PATCH …/floors/:fid/spatial`: 1 (rename). Telemetry beacons: a few.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { PIPELINE_TIMEOUT_MS } from '../../e2e/fullstack/env';
import { captureEvidence } from './support/evidence';
import { corruptPng, envDrawingPng, oversizePng } from './support/phase03Seed';
import { doneLine, failureTitle, flow, ownProject, PF, PR, renameFloor, session, uploadAndSettle, type Session } from './support/p03/P8';

const QUIET_MS = 1_500;
const SETUP_TIMEOUT_MS = PIPELINE_TIMEOUT_MS + 180_000;
const PREPROCESS = 'Tiền xử lý'; // vi.json pipeline.preprocess
const RENAMED = 'Tầng lửng P8'; // FL-12-08 floor renamed before the upload

/* SCR-10 bits (src/screens/upload/FloorUploadScreen/). */
const FILE_INPUT = 'floor-upload-file-input'; // FloorUploadDropZone.tsx:33
const DROPZONE = 'floor-upload-dropzone'; // FloorUploadDropZone.tsx:30
const TRAY = 'Tệp chưa gán tầng'; // useFloorUploadScreen.ts COPY.trayTitle
const ASSIGN = 'Gán cho tầng khác'; // FloorUploadTray.tsx:20
const SUBMIT = 'Bắt đầu xử lý'; // useFloorUploadScreen.ts COPY.submit

const pathOf = (page: Page): string => new URL(page.url()).pathname;
const quiet = (page: Page): Promise<void> => page.waitForTimeout(QUIET_MS);
const button = (scope: Page | Locator, name: string): Locator => scope.getByRole('button', { name, exact: true });
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
/** Clipboard text; the Windows clipboard stores CRLF line ends, so they are normalised to LF. */
const clipboard = async (page: Page): Promise<string> =>
  (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/gu, '\n');
/** Visible label of a `Button` (components/ui/Button.tsx draws the label twice: an invisible width copy + the visible one). */
const shown = (b: Locator): Locator => b.locator('span.absolute');
/** The InlineAlert of PipelineFailure (role=alert) by its title. */
const alertOf = (page: Page, title: string): Locator => page.getByRole('alert').filter({ hasText: title });

const writesSince = (s: Session, mark: number): string[] =>
  s.log
    .slice(mark)
    .filter((e) => e.method !== 'GET' && e.path !== '/api/auth/refresh' && !e.path.startsWith('/api/telemetry'))
    .map((e) => `${e.method} ${e.path} ${String(e.status)}`);

test.describe('SCR-12 processing — failed runs', () => {
  test('SCR-12 · FL-12-08 · owner meets a FILE_CORRUPT failure, explores every PipelineFailure control, then fixes it with a new upload', async ({ browser }) => {
    test.setTimeout(SETUP_TIMEOUT_MS + 120_000);
    await flow(async (f) => {
      const project = await ownProject(f, '12-08', 1);
      const floor = project.floors[0]!;
      await renameFloor(f.ownerApi, project.projectId, floor.id, RENAMED);
      const { outcomes } = await uploadAndSettle(f.ownerApi, project.projectId, [[floor, corruptPng()]]);
      expect(outcomes[0], 'setup: crafted PNG run failed FILE_CORRUPT').toMatchObject({ status: 'failed', error: 'FILE_CORRUPT' });
      const s = await session(f, browser, f.owner, { clipboard: true });
      const { page } = s;
      const title = failureTitle(PREPROCESS, RENAMED);
      const alert = alertOf(page, title);
      const group = page.getByRole('group', { name: PF.nextSteps, exact: true });
      await page.goto(ROUTES.project.pipeline(project.projectId));

      await test.step('[12-A-034] /pipeline → PipelineFailure replaces the screen (no tabs, chips, "Đã xong" line); title "Bước Tiền xử lý ở {floor} không hoàn tất được."', async () => {
        await expect(alert).toBeVisible({ timeout: 45_000 });
        await expect(page.getByRole('tablist', { name: PR.tabs })).toHaveCount(0);
        // QA-03e (BUG-545): S-11 draws its own "Tiến độ theo tầng" strip (PipelineFailureProgress.tsx:51) from the floors the
        // processing screen read; the processing chips are gone, so exactly one list of that name remains.
        await expect(page.getByRole('list', { name: PR.chips, exact: true })).toHaveCount(1);
        await expect(page.getByText(/^Đã xong \d+\/\d+ tầng/u)).toHaveCount(0);
        await captureEvidence(page, 'E03_12-A-034_failure-replaces.png');
      });

      await test.step('[12-C-030] {floor} in the title = the renamed N7 floor name; stage = vi.json "Tiền xử lý"', async () => {
        await expect.soft(alert.getByText(title, { exact: true })).toBeVisible();
        await expect.soft(page.getByText(failureTitle(PREPROCESS, 'Tầng 1'), { exact: true })).toHaveCount(0);
      });

      await test.step('[12-E-019] after the swap document.activeElement is body (focus not moved)', async () => {
        expect.soft(await page.evaluate(() => document.activeElement === document.body), 'focus on body').toBe(true);
      });

      await test.step('[12-B-075] breadcrumb "Dự án › Xử lý" (no name), "Thu gọn", alert, "Hướng đi tiếp", "Lần thử 1", code + "Sao chép", kept line, "Chi tiết kỹ thuật"', async () => {
        const crumbs = page.getByRole('navigation', { name: PR.nav, exact: true });
        expect.soft((await crumbs.innerText()).replace(/\s+/gu, ' ').trim()).toBe('Dự án › Xử lý');
        await expect.soft(button(page, PF.collapse)).toBeVisible();
        await expect.soft(group).toBeVisible();
        await expect.soft(page.getByText('Lần thử 1', { exact: true })).toBeVisible();
        await expect.soft(page.getByText('FILE_CORRUPT', { exact: true }).first()).toBeVisible();
        await expect.soft(shown(button(page, PF.copyCode))).toHaveText(PF.copy);
        await expect.soft(page.getByRole('heading', { name: PF.keptTitle, exact: true })).toBeVisible();
        await expect.soft(page.getByText(PF.kept, { exact: true })).toBeVisible();
        await expect.soft(button(page, PF.technical)).toBeVisible();
        await captureEvidence(page, 'E03_12-B-075_failure-anatomy.png', { fullPage: true });
      });

      // QA-03e (BUG-545, FIX-2273): without a detail read the strip uses the processing screen's floors
      // (useProcessingScreen.ts:1417-1421 failureFloors → usePipelineFailure.ts:588-593); the failed floor is aria-current, "hỏng".
      await test.step('[12-B-076] "Tiến độ theo tầng" on PipelineFailure lists the floor: "{floor} hỏng", aria-current', async () => {
        const strip = page.getByRole('list', { name: PR.chips, exact: true });
        await expect.soft(strip).toHaveCount(1);
        const item = strip.getByRole('listitem');
        await expect.soft(item).toHaveCount(1);
        await expect.soft(item).toContainText(RENAMED);
        await expect.soft(item).toContainText('hỏng'); // pipelineFailureText.ts:119
        await expect.soft(item).toHaveAttribute('aria-current', 'true'); // PipelineFailureProgress.tsx:55
        await captureEvidence(page, 'E03_12-B-076_failure-floor-strip.png');
      });

      await test.step('[12-B-053] "Tệp bản vẽ bị hỏng nên không mở được." + code "FILE_CORRUPT"; primary "Tải lên bản vẽ rõ hơn"', async () => {
        await expect(alert).toContainText(PF.fileCorrupt); // PET FILE_CORRUPT reupload
        await expect(page.getByText('FILE_CORRUPT', { exact: true }).first()).toBeVisible();
        await expect(button(alert, PF.upload)).toBeVisible();
        await captureEvidence(page, 'E03_12-B-053_file-corrupt.png');
      });

      await test.step('[12-C-029] code label is exactly the server code, no " · yêu cầu …" part', async () => {
        await expect.soft(page.getByText(/· yêu cầu/u)).toHaveCount(0);
        const codeSpans = await page.locator('span.font-mono').allInnerTexts(); // PFA reason.codeLabel + support summary
        expect.soft(codeSpans.length, 'code labels shown').toBeGreaterThan(0);
        for (const text of codeSpans) expect.soft(text).toBe('FILE_CORRUPT');
      });

      await test.step('[12-C-025] alert action "Tải lên bản vẽ rõ hơn"; row "Thử lại với ngưỡng thấp hơn", "Bỏ qua tầng đó", "Thử lại bước này"', async () => {
        await expect.soft(button(alert, PF.upload)).toBeVisible();
        expect.soft(await group.getByRole('button').allInnerTexts()).toEqual([PF.lower, PF.skip, PF.retry]);
      });

      await test.step('[12-C-028] warnings under the row: lower threshold / skip floor sentences', async () => {
        await expect.soft(page.getByText(PF.lowerWarning, { exact: true })).toBeVisible();
        await expect.soft(page.getByText(PF.skipWarning, { exact: true })).toBeVisible();
        await captureEvidence(page, 'E03_12-C-028_warnings.png');
      });

      await test.step('[12-E-016] "Thử lại với ngưỡng thấp hơn" / "Bỏ qua tầng đó" are described by their warning sentences', async () => {
        await expect.soft(button(group, PF.lower)).toHaveAccessibleDescription(PF.lowerWarning);
        await expect.soft(button(group, PF.skip)).toHaveAccessibleDescription(PF.skipWarning);
      });

      await test.step('[12-E-017] retry button accessible name "Thử lại bước này — Thử lại bước Tiền xử lý"', async () => {
        await expect.soft(button(group, `${PF.retry} — Thử lại bước ${PREPROCESS}`)).toBeVisible();
      });

      await test.step('[12-C-024] "Lần thử 1" + "Hệ thống chưa chạy lại được riêng một bước. …"', async () => {
        await expect.soft(page.getByText('Lần thử 1', { exact: true })).toBeVisible();
        await expect.soft(page.getByText(PF.supportUnsupported, { exact: true })).toBeVisible();
      });

      await test.step('[12-A-035] "Sao chép mã lỗi" → clipboard "FILE_CORRUPT"; "Đã sao chép" then back to "Sao chép" after ~700 ms', async () => {
        const copy = button(page, PF.copyCode);
        await copy.click();
        await expect.soft(shown(copy)).toHaveText(PF.copied);
        expect.soft(await clipboard(page)).toBe('FILE_CORRUPT');
        await captureEvidence(page, 'E03_12-A-035_copy-code.png', { caption: `clipboard: ${await clipboard(page)}` });
        await expect.soft(shown(copy)).toHaveText(PF.copy, { timeout: 3_000 }); // UPF COPIED_LABEL_HOLD_MS 700
      });

      for (const [row, name] of [
        ['12-A-037', `${PF.retry} — Thử lại bước ${PREPROCESS}`],
        ['12-A-038', PF.lower],
        ['12-A-039', PF.skip],
      ] as const) {
        await test.step(`[${row}] "${name}" → no /api write except /api/telemetry; alert stays`, async () => {
          const mark = s.log.length;
          await button(group, name).click(); // retryStep / skipFloor unsupported → reportStepFailure (telemetry beacon)
          await quiet(page);
          expect.soft(writesSince(s, mark), `writes after "${name}"`).toEqual([]);
          await expect.soft(alert).toBeVisible();
        });
      }

      await test.step('[12-E-014] "Thu gọn" has aria-controls="pipeline-failure-body" and aria-expanded="true"', async () => {
        await expect.soft(button(page, PF.collapse)).toHaveAttribute('aria-controls', PF.bodyId);
        await expect.soft(button(page, PF.collapse)).toHaveAttribute('aria-expanded', 'true');
      });

      await test.step('[12-A-040] "Thu gọn" → body only "{floor} hỏng ở bước Tiền xử lý · FILE_CORRUPT", "Mở lại" (aria-expanded false); "Mở lại" restores', async () => {
        await button(page, PF.collapse).click();
        const body = page.locator(`#${PF.bodyId}`);
        await expect.soft(body).toHaveText(`${RENAMED} hỏng ở bước ${PREPROCESS} · FILE_CORRUPT`); // PFT collapsedSummaryLine
        await expect.soft(button(page, PF.expand)).toHaveAttribute('aria-expanded', 'false');
        await expect.soft(alert).toHaveCount(0);
        await captureEvidence(page, 'E03_12-A-040_collapsed.png');
        await button(page, PF.expand).click();
        await expect.soft(alert).toBeVisible();
      });

      await test.step('[12-E-015] "Chi tiết kỹ thuật" aria-expanded + aria-controls; opened ul "Nhật ký kỹ thuật" has tabIndex 0', async () => {
        const toggle = button(page, PF.technical);
        await expect.soft(toggle).toHaveAttribute('aria-controls', PF.detailsId);
        await expect.soft(toggle).toHaveAttribute('aria-expanded', 'false');
        await toggle.click();
        await expect.soft(toggle).toHaveAttribute('aria-expanded', 'true');
        await expect.soft(page.getByRole('list', { name: PF.logList, exact: true })).toHaveAttribute('tabindex', '0');
      });

      let logTime = '';
      await test.step('[12-A-041] log shows one line "Máy chủ chưa có phần trả nhật ký kỹ thuật của một bước."; "Sao chép nhật ký kỹ thuật" copies it', async () => {
        const rows = page.getByRole('list', { name: PF.logList, exact: true }).getByRole('listitem');
        await expect.soft(rows).toHaveCount(1);
        await expect.soft(rows.first()).toContainText(PF.logLine);
        logTime = (await rows.first().locator('span').first().innerText().catch(() => '')).trim();
        await button(page, PF.copyLog).click();
        expect.soft(await clipboard(page)).toBe(`${logTime} ${PF.logLine}`); // UPF logText "<time> <text>"
        await captureEvidence(page, 'E03_12-A-041_technical-log.png', { caption: `clipboard: ${await clipboard(page)}` });
      });

      await test.step('[12-A-042] "Sao chép toàn bộ nhật ký" → clipboard = code line first, then the log line', async () => {
        await button(page, PF.copyAll).click();
        expect.soft(await clipboard(page)).toBe(`FILE_CORRUPT\n${logTime} ${PF.logLine}`); // UPF allLogsText
      });

      await test.step('[12-E-018] buttons named "Sao chép mã lỗi" / "Sao chép toàn bộ nhật ký" / "Sao chép nhật ký kỹ thuật"; "Đã sao chép" not in a live region', async () => {
        for (const name of [PF.copyCode, PF.copyAll, PF.copyLog]) await expect.soft(button(page, name)).toHaveCount(1);
        await button(page, PF.copyCode).click();
        await expect.soft(shown(button(page, PF.copyCode))).toHaveText(PF.copied);
        const live = await button(page, PF.copyCode).evaluate((el) => el.closest('[aria-live], [role="status"], [role="alert"], [role="log"]') !== null);
        expect.soft(live, '"Đã sao chép" inside a live region').toBe(false);
      });

      await test.step('[12-A-044] reload → PipelineFailure again (stable across reloads)', async () => {
        await page.reload();
        await expect(alert).toBeVisible({ timeout: 45_000 });
        await captureEvidence(page, 'E03_12-A-044_reload-failure.png');
      });

      await test.step('[12-A-043] "Báo lỗi cho hỗ trợ" (code printed beside it) → /tai-khoan; go back', async () => {
        const link = button(page, PF.supportLink);
        await expect(link.locator('xpath=..').getByText('FILE_CORRUPT', { exact: true })).toBeVisible(); // PFA support row
        await link.click(); // UPF onOpenSupport → ROUTES.account
        await expect.poll(() => pathOf(page)).toBe(ROUTES.account);
        await page.goBack();
        await expect(alert).toBeVisible({ timeout: 45_000 });
      });

      await test.step('[12-A-036] primary "Tải lên bản vẽ rõ hơn" → /projects/:id/upload', async () => {
        await button(alert, PF.upload).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.upload(project.projectId));
      });

      await test.step('[12-A-045] upload drawing.png on the failed floor, "Bắt đầu xử lý" → /pipeline: new run, PipelineFailure gone, "Đã xong 1/1 tầng"', async () => {
        await expect(page.getByTestId(DROPZONE)).toBeVisible({ timeout: 45_000 });
        const complete = waitForApi(page, 'POST', new RegExp(`^/api/projects/${escapeRegExp(project.projectId)}/drawings/uploads/[^/]+/complete$`, 'u'), [200]);
        await page.getByTestId(FILE_INPUT).setInputFiles(process.env.E2E_DRAWING_PNG ?? '');
        await page.getByRole('region', { name: TRAY, exact: true }).getByRole('combobox', { name: ASSIGN }).click();
        await page.getByRole('option', { name: RENAMED, exact: true }).click();
        await complete;
        // Submit only once the card says "Đã gắn kèm": while it is still "Đang tải lên" the submit is refused (UFU blocked).
        await expect(page.locator(`[data-floor-id="${floor.id}"]`).getByText('Đã gắn kèm', { exact: true })).toBeVisible();
        await button(page, SUBMIT).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.pipeline(project.projectId));
        await expect(page.getByText(doneLine(1, 1))).toBeVisible({ timeout: PIPELINE_TIMEOUT_MS });
        await expect(page.getByText(title, { exact: true })).toHaveCount(0);
        await captureEvidence(page, 'E03_12-A-045_fixed-run-done.png');
      });
    });
  });

  test('SCR-12 · FL-12-09 · three-floor project with two failed floors and one done floor', async ({ browser }) => {
    test.setTimeout(SETUP_TIMEOUT_MS);
    await flow(async (f) => {
      const project = await ownProject(f, '12-09', 3);
      const [f1, f2, f3] = project.floors as [(typeof project.floors)[number], (typeof project.floors)[number], (typeof project.floors)[number]];
      const { outcomes } = await uploadAndSettle(f.ownerApi, project.projectId, [
        [f1, oversizePng()],
        [f2, corruptPng()],
        [f3, envDrawingPng()],
      ]);
      expect(outcomes.map((o) => `${o.status} ${o.error ?? ''}`.trim()), 'setup: run outcomes').toEqual([
        'failed IMAGE_TOO_LARGE',
        'failed FILE_CORRUPT',
        'completed',
      ]);
      const s = await session(f, browser);
      const { page } = s;
      await page.goto(ROUTES.project.pipeline(project.projectId));

      await test.step('[12-B-077] once all three floors are final PipelineFailure replaces the screen; floor 3\'s summary and its two actions are gone', async () => {
        await expect(page.getByRole('alert').filter({ hasText: /^Bước .+ không hoàn tất được\./u })).toBeVisible({ timeout: 45_000 });
        await expect(page.getByRole('region', { name: PR.summary, exact: true })).toHaveCount(0);
        await expect(button(page, PR.reviewWalls)).toHaveCount(0);
        await expect(button(page, PR.calibrate)).toHaveCount(0);
        await captureEvidence(page, 'E03_12-B-077_mixed-failure.png');
      });

      await test.step('[12-B-078] only floor 1 (first failed in N7 order) is described; floor 2\'s name and FILE_CORRUPT are absent', async () => {
        await expect.soft(page.getByText(failureTitle(PREPROCESS, f1.name), { exact: true })).toBeVisible();
        // QA-03f (T4): the BUG-545 "Tiến độ theo tầng" strip lists every floor, "Tầng 2 hỏng" included (usePipelineFailure.ts:586-595,
        // PipelineFailure.tsx:96, outside the band) — only the failure alert must not name floor 2.
        await expect.soft(page.getByRole('alert').filter({ hasText: /không hoàn tất được\./u }).getByText(f2.name)).toHaveCount(0);
        await expect.soft(page.getByText('FILE_CORRUPT', { exact: false })).toHaveCount(0);
      });

      await test.step('[12-B-054] "Ảnh bản vẽ lớn hơn kích thước hệ thống nhận." + code "IMAGE_TOO_LARGE"; primary "Tải lên bản vẽ rõ hơn"', async () => {
        const alert = page.getByRole('alert').filter({ hasText: /không hoàn tất được\./u });
        await expect.soft(alert).toContainText(PF.imageTooLarge);
        await expect.soft(page.getByText('IMAGE_TOO_LARGE', { exact: true }).first()).toBeVisible();
        await expect.soft(button(alert, PF.upload)).toBeVisible();
        await captureEvidence(page, 'E03_12-B-054_image-too-large.png');
      });
    });
  });
});
