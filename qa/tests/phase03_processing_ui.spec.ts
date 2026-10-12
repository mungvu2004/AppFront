/**
 * Phase 3 — SCR-12 processing (+ PipelineFailure), dedicated UI-verification flows (skill `qa-verify-ui`, QA-03d P9,
 * `flow-plan.md` "phase03_processing_ui.spec.ts"). One `test()` per flow, one `test.step('[<row id>] …')` per catalog row;
 * each state is captured at 1440 / 1024 / 768 / 375 by `verifyUi` (support/ui-verify.ts): `U03_<row id>_<state>_<width>.png`
 * + `U03_<row id>_<state>.json` (layout metrics for the review).
 *
 * Data:
 *   - FL-U12-01 `[mocked response]`: own 2-floor project; N7 / #8 mocked and the SSE stream held by a local server
 *     (support/p03/P9.ts) — loading, running/partial, failed-floor notice and read error cannot be held still on the real
 *     fake-ML stack.
 *   - FL-U12-02: own 1-floor project with no upload (real); the shared pool viewer as a member.
 *   - FL-U12-03: S4 — own 1-floor project of the pool engineer `engineer:p9-processing` whose crafted PNG run FAILED with
 *     FILE_CORRUPT (phase03Seed `createFailedRunProject`, real fake-ML run); the shared pool viewer as a member.
 *   - FL-U12-04: S2-multi — own 6-floor project of the same pool engineer, env drawing.png uploaded on every floor through
 *     the API, every run left to finish (real).
 * Source: PR src/screens/pipeline/ProcessingScreen/ProcessingScreen.tsx · PFC …/ProcessingFloorChips.tsx ·
 * PSB …/ProcessingStepBar.tsx · PF src/screens/pipeline/PipelineFailure/PipelineFailure.tsx · PFA …/PipelineFailureAlert.tsx ·
 * PFD …/PipelineFailureDetails.tsx · UPF …/usePipelineFailure.ts.
 *
 * ## Request budget per full run
 * - `POST /api/auth/login`: 1 admin API + 1 engineer API (beforeAll) + 7 browser sessions = 9.
 * - `POST /api/users/invitations`: 0 once the slot `engineer:p9-processing` exists, else 1 (+ 1 accept).
 * - Upload inits (drawings_init, engineer's own bucket): FL-U12-03 1 + FL-U12-04 6 = 7, each starting one fake-ML run.
 * - `POST /api/projects` 4, `DELETE /api/projects/:id` 4, `POST …/members` 2.
 * - `POST /api/auth/refresh`: ~1 per page load (4 widths × 13 states + a few) ≈ 60.
 */
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { PIPELINE_TIMEOUT_MS, readBaseUrl } from '../../e2e/fullstack/env';
import { signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { attachJson, captureEvidence } from './support/evidence';
import {
  addProjectMember,
  createFailedRunProject,
  createProject,
  deleteSeededProject,
  envDrawingPng,
  poolUser,
  uploadDrawing,
  waitForRunOutcome,
  type PoolUser,
  type SeededProject,
} from './support/phase03Seed';
import { COMPACT, closeFlow, openFlow, type Flow } from './support/p03/P5';
import { SseServer, fakeUploadId, mockRuns, progress, wireError, type UploadItem } from './support/p03/P9';
import { verifyUi } from './support/ui-verify';

/* ---------------------------------------------------------------- copy (each cites its source) */

const CHIPS = 'Tiến độ theo tầng'; // PFC:20
const STEPS = 'Các bước xử lý'; // ProcessingStepList.tsx:39
const STEP_BAR = 'Bước đang xử lý'; // PSB:41
const ALL_STEPS = 'Xem tất cả các bước'; // PR:89
const TABS = 'Xem trước hoặc nhật ký'; // PR:74
const RETRY = 'Thử lại'; // PR:72
const SUPPORT = 'Liên hệ hỗ trợ'; // PR:71
const SUMMARY = 'Báo cáo tổng kết'; // ProcessingSummary.tsx:18
const NO_RUN = 'Chưa có lượt xử lý nào đang chạy.'; // useProcessingScreen.ts NO_RUN_SENTENCE
const NOT_FOUND_TITLE = 'Không tìm thấy dự án này'; // ProjectSpatialGate.tsx:36
const NEXT_STEPS = 'Hướng đi tiếp'; // PFA:63
const TECHNICAL = 'Chi tiết kỹ thuật'; // pipelineFailureText.ts technicalToggleLabel
const COLLAPSE = 'Thu gọn'; // pipelineFailureText.ts collapseLabel
const EXPAND = 'Mở lại'; // pipelineFailureText.ts expandLabel
const partialNotice = (names: string): string => `${names} gặp lỗi. Các tầng còn lại vẫn đang được xử lý.`;

/* ---------------------------------------------------------------- helpers */

const chips = (page: Page): Locator => page.getByRole('list', { name: CHIPS, exact: true }).getByRole('listitem');
const readAlert = (page: Page): Locator => page.getByRole('alert').filter({ has: page.getByRole('button', { name: RETRY, exact: true }) });
const doneAll = (page: Page, n: number): Locator => page.getByText(new RegExp(`^Đã xong ${String(n)}/${String(n)} tầng`, 'u'));
const width = (page: Page): number => page.viewportSize()?.width ?? 0;

const uploadOf = (project: SeededProject, index: number, uploadId: string): UploadItem => {
  const floor = project.floors[index];
  if (floor === undefined) throw new Error(`fixture floor #${String(index)} missing`);
  return { floorId: floor.id, floorName: floor.name, uploadId, sourceImageUrl: `${readBaseUrl()}/qa-preview/${uploadId}.png` };
};

let adminApi: APIRequestContext;
let engineer: PoolUser;
let engineerApi: APIRequestContext;

test.beforeAll(async () => {
  const admin = readAdminCredentials();
  adminApi = await signedInApi(admin.email, admin.password);
  engineer = await poolUser(adminApi, 'engineer', 'p9-processing');
  engineerApi = await signedInApi(engineer.email, engineer.password);
});

test.afterAll(async () => {
  await engineerApi?.dispose();
  await adminApi?.dispose();
});

/* ================================================================= flows */

test.describe('U03 UI verify — SCR-12 processing flows (QA-03d P9)', () => {
  test('FL-U12-01 · [mocked response] SCR-12 processing loading, running/partial, failed-floor notice and read error at four widths', async ({ browser }) => {
    test.setTimeout(300_000);
    const project = await createProject(adminApi, 'u12-01', 2);
    const [f1] = project.floors;
    if (f1 === undefined) throw new Error('fixture floors missing');
    const flow = await openFlow(browser, readAdminCredentials());
    const sse = await SseServer.start();
    try {
      const { page } = flow;
      await sse.attach(page);
      const runs = await mockRuns(page, project.projectId, envDrawingPng());
      const pipeline = ROUTES.project.pipeline(project.projectId);

      await test.step('[12-F-005] verifyUi loading skeleton (N7 held) at 1440/1024/768/375', async () => {
        runs.n7Answer = { body: { items: [] }, hold: new Promise<void>(() => undefined) }; // never answered
        await verifyUi(page, 'U03_12-F-005_loading', async (p) => {
          await p.goto(pipeline);
          await expect(p.locator('div.flex.items-center.gap-4.p-3:has(> .animate-pulse)')).toHaveCount(4); // PR:186-192
        });
      });

      await test.step('[12-F-006] verifyUi running/partial (one floor done, one running) at four widths', async () => {
        const [u1, u2] = [fakeUploadId(), fakeUploadId()];
        runs.n7Answer = null;
        runs.uploads = [uploadOf(project, 0, u1), uploadOf(project, 1, u2)];
        runs.progressOf.set(u1, { body: progress(u1, 'completed', 'qualityCheck', 100) });
        runs.progressOf.set(u2, { body: progress(u2, 'running', 'wallSegmentation', 20) });
        await verifyUi(page, 'U03_12-F-006_running-partial', async (p) => {
          await p.goto(pipeline);
          await expect(chips(p)).toHaveCount(2);
          await expect(p.getByRole('region', { name: SUMMARY, exact: true })).toBeVisible(); // PR:198-225
          await expect(p.getByText(/^Đã xong 1\/2 tầng/u)).toBeVisible();
        });
      });

      await test.step('[12-F-007] verifyUi partial with "{floor} gặp lỗi. Các tầng còn lại vẫn đang được xử lý." at four widths', async () => {
        const [u1, u2] = [fakeUploadId(), fakeUploadId()];
        runs.uploads = [uploadOf(project, 0, u1), uploadOf(project, 1, u2)];
        runs.progressOf.set(u1, { body: progress(u1, 'failed', 'dimensionReading', 60, { error: 'FILE_CORRUPT' }) });
        runs.progressOf.set(u2, { body: progress(u2, 'running', 'wallSegmentation', 20) });
        await verifyUi(page, 'U03_12-F-007_failed-floor-notice', async (p) => {
          await p.goto(pipeline);
          await expect(p.getByText(partialNotice(f1.name), { exact: true })).toBeVisible(); // PR:284-289
        });
      });

      await test.step('[12-F-008] verifyUi read-error alert with code + "Liên hệ hỗ trợ" at four widths', async () => {
        runs.n7Answer = wireError(500, 'INTERNAL');
        await verifyUi(page, 'U03_12-F-008_read-error', async (p) => {
          await p.goto(pipeline);
          await expect(readAlert(p)).toBeVisible({ timeout: 45_000 }); // PR:259-273
          await expect(p.getByRole('button', { name: SUPPORT, exact: true })).toBeVisible();
          await expect(p.locator('span.font-mono').first()).toHaveText(/\S/u);
        });
      });
    } finally {
      await closeFlow(flow);
      await sse.close();
      await deleteSeededProject(adminApi, project.projectId);
    }
  });

  test('FL-U12-02 · SCR-12 not-found strip and viewer no-run columns at four widths', async ({ browser }) => {
    test.setTimeout(180_000);
    const project = await createProject(adminApi, 'u12-02', 1);
    const flows: Flow[] = [];
    try {
      await test.step('[12-F-009] verifyUi /projects/<random>/pipeline "Không tìm thấy dự án này" strip at four widths', async () => {
        const flow = await openFlow(browser, readAdminCredentials());
        flows.push(flow);
        const unknown = `prj_qa-u03-${Date.now().toString(36)}`; // not a prj_<ULID>: BE 404 before any read
        await verifyUi(flow.page, 'U03_12-F-009_not-found', async (p) => {
          await p.goto(ROUTES.project.pipeline(unknown));
          await expect(p.getByRole('alert').filter({ hasText: NOT_FOUND_TITLE })).toBeVisible({ timeout: 30_000 }); // PR:251-258
        });
      });

      await test.step('[12-F-010] verifyUi viewer member, no run: two empty columns at four widths', async () => {
        const viewer = await poolUser(adminApi, 'viewer');
        await addProjectMember(adminApi, project.projectId, viewer.email);
        const flow = await openFlow(browser, viewer);
        flows.push(flow);
        await verifyUi(flow.page, 'U03_12-F-010_viewer-no-run', async (p) => {
          await p.goto(ROUTES.project.pipeline(project.projectId));
          await expect(p.getByText(NO_RUN, { exact: true })).toBeVisible(); // state forbidden wins over empty
          await expect(p.getByRole('tablist', { name: TABS, exact: true })).toBeVisible();
        });
      });
    } finally {
      for (const flow of flows) await closeFlow(flow);
      await deleteSeededProject(adminApi, project.projectId);
    }
  });

  test('FL-U12-03 · SCR-12 PipelineFailure partial, details open, collapsed and viewer forbidden at four widths', async ({ browser }) => {
    test.setTimeout(PIPELINE_TIMEOUT_MS + 240_000);
    const failed = await createFailedRunProject(engineerApi, 'u12-03', 'FILE_CORRUPT');
    const flows: Flow[] = [];
    try {
      const owner = await openFlow(browser, engineer);
      flows.push(owner);
      const pipeline = ROUTES.project.pipeline(failed.projectId);
      const openFailure = async (p: Page): Promise<void> => {
        await p.goto(pipeline);
        await expect(p.getByRole('alert').filter({ hasText: failed.floorName })).toBeVisible({ timeout: 30_000 });
      };

      await test.step('[12-F-011] verifyUi PipelineFailure alert (partial) at four widths', async () => {
        await verifyUi(owner.page, 'U03_12-F-011_failure-alert', async (p) => {
          await openFailure(p);
          await expect(p.getByRole('group', { name: NEXT_STEPS, exact: true })).toBeVisible(); // PF:63-110
        });
      });

      await test.step('[12-F-012] "Chi tiết kỹ thuật" open → verifyUi at four widths', async () => {
        await verifyUi(owner.page, 'U03_12-F-012_failure-details', async (p) => {
          await openFailure(p);
          const toggle = p.getByRole('button', { name: TECHNICAL, exact: true });
          await toggle.click(); // PFD:88-100
          await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        });
      });

      await test.step('[12-F-013] "Thu gọn" → collapsed with "Mở lại" → verifyUi at four widths', async () => {
        await verifyUi(owner.page, 'U03_12-F-013_failure-collapsed', async (p) => {
          await openFailure(p);
          await p.getByRole('button', { name: COLLAPSE, exact: true }).click(); // PF:84-86
          await expect(p.getByRole('button', { name: EXPAND, exact: true })).toBeVisible();
        });
      });

      await test.step('[12-F-014] viewer member → PipelineFailure forbidden → verifyUi at four widths', async () => {
        const viewer = await poolUser(adminApi, 'viewer');
        await addProjectMember(adminApi, failed.projectId, viewer.email);
        const flow = await openFlow(browser, viewer);
        flows.push(flow);
        await verifyUi(flow.page, 'U03_12-F-014_failure-forbidden', async (p) => {
          await openFailure(p);
          await expect(p.getByRole('group', { name: NEXT_STEPS, exact: true })).toHaveCount(0); // PFA:144-146 nextSteps null
        });
      });
    } finally {
      for (const flow of flows) await closeFlow(flow);
      await deleteSeededProject(engineerApi, failed.projectId);
    }
  });

  test('FL-U12-04 · SCR-12 finished six-floor run: chips wrap, compact step bar, target sizes', async ({ browser }) => {
    test.setTimeout(PIPELINE_TIMEOUT_MS + 300_000);
    const project = await createProject(engineerApi, 'u12-04', 6);
    let flow: Flow | undefined;
    try {
      const png = envDrawingPng();
      const uploads: string[] = [];
      for (const [i, floor] of project.floors.entries()) {
        uploads.push(await uploadDrawing(engineerApi, project.projectId, floor.id, png, `qa-u12-04-tang-${String(i + 1)}.png`));
      }
      for (const uploadId of uploads) {
        const outcome = await waitForRunOutcome(engineerApi, project.projectId, uploadId);
        expect(outcome.status, `setup: run ${uploadId} finished`).toBe('completed');
      }
      flow = await openFlow(browser, engineer);
      const pipeline = ROUTES.project.pipeline(project.projectId);
      const openDone = async (p: Page): Promise<void> => {
        await p.goto(pipeline);
        await expect(doneAll(p, 6)).toBeVisible({ timeout: 30_000 });
        await expect(chips(p)).toHaveCount(6);
      };

      await test.step('[12-F-017] verifyUi six chips wrap at 375 / 768 with no horizontal scroll (four widths)', async () => {
        const rows: Record<string, number> = {};
        await verifyUi(flow!.page, 'U03_12-F-017_six-chips', async (p) => {
          await openDone(p);
          const tops = await chips(p).evaluateAll((els) => [...new Set(els.map((el) => Math.round(el.getBoundingClientRect().top)))]);
          rows[String(width(p))] = tops.length;
        });
        await attachJson('U03_12-F-017_chip-rows.json', rows);
        expect.soft(rows['375'] ?? 0, 'chips wrap onto several rows at 375 px').toBeGreaterThan(1); // PFC:28 flex-wrap
      });

      await test.step('[12-F-015] verifyUi < 1024: single step bar "Bước đang xử lý" + CLOSED "Xem tất cả các bước", tabs under the steps (BUG-294/285)', async () => {
        const layout: Record<string, unknown> = {};
        await verifyUi(flow!.page, 'U03_12-F-015_compact-step-bar', async (p) => {
          await openDone(p);
          const w = width(p);
          if (w < 1024) {
            const bar = p.getByRole('group', { name: STEP_BAR, exact: true }); // PR:203-225 isSheet
            await expect.soft(bar).toBeVisible();
            const details = p.locator('details').filter({ has: p.getByText(ALL_STEPS, { exact: true }) });
            await expect.soft(details).not.toHaveAttribute('open', '');
            const barBox = await bar.boundingBox();
            const tabsBox = await p.getByRole('tablist', { name: TABS, exact: true }).boundingBox();
            layout[String(w)] = { barBox, tabsBox };
            expect.soft(barBox !== null && tabsBox !== null && tabsBox.y >= barBox.y + barBox.height, `${String(w)}: tabs under the steps`).toBe(true);
          } else {
            await expect.soft(p.locator(`ol[aria-label="${STEPS}"]`).first()).toBeVisible();
            layout[String(w)] = 'full step list';
          }
        });
        await attachJson('U03_12-F-015_layout.json', layout);
      });

      await test.step('[12-E-013] at 375 every tab and button box is ≥ 44 px high', async () => {
        const page = flow!.page;
        await page.setViewportSize(COMPACT);
        await openDone(page);
        const small = await page.evaluate(() =>
          [...document.querySelectorAll('button, [role="tab"], summary')]
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return r.width > 2 && r.height > 2;
            })
            .map((el) => ({ name: ((el as HTMLElement).innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 40), h: Math.round(el.getBoundingClientRect().height) }))
            .filter((t) => t.h < 44),
        );
        await attachJson('U03_12-E-013_targets.json', { small });
        expect.soft(small, 'controls under 44 px at 375 (PR:134 tabs, PR:208 summary min-h-11)').toEqual([]);
        await captureEvidence(page, 'U03_12-E-013_targets-375.png', { fullPage: true });
      });
    } finally {
      if (flow !== undefined) await closeFlow(flow);
      await deleteSeededProject(engineerApi, project.projectId);
    }
  });
});
