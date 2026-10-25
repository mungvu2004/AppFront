/**
 * Phase 3 — SCR-12 processing by role, real sequential flows (QA-03d P8; plan `flow-plan.md`
 * "phase03_processing_roles_edge.spec.ts"). One `test()` per flow, one `test.step('[<row id>] …')` per catalog row.
 * `H` rows hard `expect`, `S` rows `expect.soft`; `ev` rows capture `E03_<row id>_<slug>.png`.
 *
 * Source @ c16f2428: UPR src/screens/pipeline/ProcessingScreen/useProcessingScreen.ts (state(): `!canEdit` → 'forbidden'
 * before 'empty') · PRC …/ProcessingScreen.container.tsx (roles = global session roles, useSession) · UPF
 * src/screens/pipeline/PipelineFailure/usePipelineFailure.ts (`forbidden` → no next steps, no technical details;
 * `forbidden` is decided before `collapsed`) · PFA …/PipelineFailureAlert.tsx · PLP / PPP log / preview panels.
 *
 * Roles: owner = pool engineer `p8-processing`; members = the shared pool viewer / engineer (added to OWN projects
 * only, by the owner); non-member = pool engineer `p06` (never added). Projects deleted in `finally` (drops the
 * memberships). No pool user changes state. Mocks: none.
 * BE has no per-project role (N3 `POST /api/projects/:id/members {email}` only, AppBack
 * apps/api/project_members/schemas.py): a member's role on SCR-12 is always the global one.
 *
 * Request budget per full file run (QA stack limits):
 * - `POST /api/auth/login`: FL-12-10 3 + 1 (viewer); FL-12-11 3 + 3 (engineer member, viewer member, non-member) = 10.
 * - `POST /api/users/invitations`: 0 when the pool file holds the four slots, else ≤ 4.
 * - `POST …/drawings/uploads` (owner): FL-12-10 2, FL-12-11 2 = 4. `POST …/members`: 3. `POST /api/projects`: 2, deleted.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { PIPELINE_TIMEOUT_MS } from '../../e2e/fullstack/env';
import { captureEvidence } from './support/evidence';
import { addProjectMember, corruptPng, envDrawingPng, poolUser } from './support/phase03Seed';
import {
  BACK_TO_PROJECTS,
  doneLine,
  failureTitle,
  flow,
  NOT_FOUND_SENTENCE,
  NOT_FOUND_TITLE,
  ownProject,
  P8_OUTSIDER_SLOT,
  PF,
  PR,
  session,
  uploadAndSettle,
} from './support/p03/P8';

const SETUP_TIMEOUT_MS = PIPELINE_TIMEOUT_MS + 180_000;
const PREPROCESS = 'Tiền xử lý'; // vi.json pipeline.preprocess

const button = (scope: Page | Locator, name: string): Locator => scope.getByRole('button', { name, exact: true });
const nextSteps = (page: Page): Locator => page.getByRole('group', { name: PF.nextSteps, exact: true });

test.describe('SCR-12 processing — roles', () => {
  test('SCR-12 · FL-12-10 · viewer member follows one project from no run, to a failed run, to a fixed finished run', async ({ browser }) => {
    test.setTimeout(SETUP_TIMEOUT_MS + 120_000);
    await flow(async (f) => {
      const project = await ownProject(f, '12-10', 1);
      const floor = project.floors[0]!;
      const viewer = await poolUser(f.admin, 'viewer');
      await addProjectMember(f.ownerApi, project.projectId, viewer.email);
      const s = await session(f, browser, viewer);
      const { page } = s;
      const title = failureTitle(PREPROCESS, floor.name);

      await test.step('[12-D-001] no run: no empty state / "Tải bản vẽ"; two columns, empty step list, "Chưa có lượt xử lý nào đang chạy." (forbidden wins)', async () => {
        await page.goto(ROUTES.project.pipeline(project.projectId));
        await expect(page.getByText(PR.noRun, { exact: true })).toBeVisible({ timeout: 45_000 });
        await expect(page.getByText(PR.emptyTitle, { exact: true })).toHaveCount(0);
        await expect(button(page, PR.emptyAction)).toHaveCount(0);
        await expect(page.getByRole('tablist', { name: PR.tabs, exact: true })).toBeVisible();
        await expect(page.getByRole('list', { name: PR.steps, exact: true }).getByRole('listitem')).toHaveCount(0);
        await captureEvidence(page, 'E03_12-D-001_viewer-no-run.png');
      });

      await test.step('[12-B-022] preview "Chưa có tầng nào để xem trước" / "Panel sẽ hiện bản vẽ ngay khi có tầng bắt đầu xử lý."', async () => {
        await expect.soft(page.getByText(PR.previewEmpty, { exact: true })).toBeVisible();
        await expect.soft(page.getByText(PR.previewEmptyDescription, { exact: true })).toBeVisible();
        await captureEvidence(page, 'E03_12-B-022_preview-empty.png');
      });

      await test.step('[12-B-024] tab "Nhật ký" → "Chưa có dòng nhật ký nào" / "Nhật ký xử lý sẽ xuất hiện tại đây khi hệ thống bắt đầu ghi lại."', async () => {
        await page.getByRole('tablist', { name: PR.tabs, exact: true }).getByRole('tab', { name: PR.tabLog, exact: true }).click();
        await expect.soft(page.getByText(PR.logEmpty, { exact: true })).toBeVisible();
        await expect.soft(page.getByText(PR.logEmptyDescription, { exact: true })).toBeVisible();
        await captureEvidence(page, 'E03_12-B-024_log-empty.png');
      });

      await test.step('[12-D-003] owner uploads the corrupt PNG; viewer reloads → PipelineFailure without directions, retry, details, alert action; support + "Sao chép mã lỗi" shown', async () => {
        const { outcomes } = await uploadAndSettle(f.ownerApi, project.projectId, [[floor, corruptPng()]]);
        expect(outcomes[0], 'setup: crafted PNG run failed FILE_CORRUPT').toMatchObject({ status: 'failed', error: 'FILE_CORRUPT' });
        await page.reload();
        const alert = page.getByRole('alert').filter({ hasText: title });
        await expect(alert).toBeVisible({ timeout: 45_000 });
        await expect(nextSteps(page)).toHaveCount(0);
        await expect(page.getByRole('button', { name: new RegExp(`^${PF.retry}`, 'u') })).toHaveCount(0);
        await expect(button(page, PF.technical)).toHaveCount(0);
        await expect(button(alert, PF.upload)).toHaveCount(0);
        await expect(button(page, PF.supportLink)).toBeVisible();
        await expect(button(page, PF.copyCode)).toBeVisible();
        await captureEvidence(page, 'E03_12-D-003_viewer-failure.png');
      });

      // QA-03e (BUG-544, FIX-2272): `collapsed` is checked before error/forbidden (usePipelineFailure.ts:622-628), so the viewer's
      // "Thu gọn" collapses the body to the summary line (PipelineFailure.tsx:61, 82, 91-93); aria-expanded follows.
      await test.step('[12-D-004] viewer clicks "Thu gọn" → label "Mở lại", aria-expanded false, the body collapses to the summary line', async () => {
        await button(page, PF.collapse).click();
        const toggle = button(page, PF.expand);
        await expect.soft(toggle).toBeVisible();
        await expect.soft(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect.soft(page.getByRole('alert').filter({ hasText: title }), 'the failure band is folded away').toHaveCount(0);
        await expect.soft(page.getByRole('list', { name: PR.chips, exact: true }), 'the floor strip is folded away').toHaveCount(0);
        await captureEvidence(page, 'E03_12-D-004_viewer-collapse.png', { caption: 'viewer pressed "Thu gọn": collapsed summary only' });
      });

      await test.step('[12-D-002] owner uploads drawing.png on the floor; viewer reloads → done screen with the gate primary button ("Sang Duyệt tầng" or "Đặt tỷ lệ"), no read-only banner', async () => {
        const { outcomes } = await uploadAndSettle(f.ownerApi, project.projectId, [[floor, envDrawingPng()]]);
        expect(outcomes[0]?.status, 'setup: drawing.png run completed').toBe('completed');
        await page.reload();
        await expect(page.getByText(doneLine(1, 1))).toBeVisible({ timeout: 45_000 });
        const summary = page.getByRole('region', { name: PR.summary, exact: true });
        await expect(button(summary, PR.reviewWalls).or(button(summary, PR.calibrate))).toHaveCount(1); // S-10: one primary, depends on scale
        await expect(page.getByText(/chỉ được xem/u)).toHaveCount(0); // no read-only notice on SCR-12 (PR has none)
        await captureEvidence(page, 'E03_12-D-002_viewer-done.png');
      });
    });
  });

  test('SCR-12 · FL-12-11 · engineer roles on a failed run: member, global-role mismatch (G3), non-member', async ({ browser }) => {
    test.setTimeout(SETUP_TIMEOUT_MS + 120_000);
    await flow(async (f) => {
      const project = await ownProject(f, '12-11', 1);
      const floor = project.floors[0]!;
      const engineer = await poolUser(f.admin, 'engineer');
      const viewer = await poolUser(f.admin, 'viewer');
      const outsider = await poolUser(f.admin, 'engineer', P8_OUTSIDER_SLOT);
      await addProjectMember(f.ownerApi, project.projectId, engineer.email);
      await addProjectMember(f.ownerApi, project.projectId, viewer.email);
      const { outcomes } = await uploadAndSettle(f.ownerApi, project.projectId, [[floor, corruptPng()]]);
      expect(outcomes[0], 'setup: crafted PNG run failed FILE_CORRUPT').toMatchObject({ status: 'failed', error: 'FILE_CORRUPT' });
      const title = failureTitle(PREPROCESS, floor.name);
      const eng = await session(f, browser, engineer);

      await test.step('[12-D-007] G3: the screen follows the GLOBAL role — global engineer member sees directions + details; global viewer member gets forbidden', async () => {
        // UNKNOWN — NEED VERIFICATION: the plan's "viewer membership" / "editor membership" cannot be set up — BE N3 takes
        // only {email} and stores no project role (AppBack apps/api/project_members/schemas.py), so the per-project half of
        // G3 is not reachable on the real stack. What stays checkable: roles come from the global session (PRC useSession).
        test.info().annotations.push({ type: 'unknown', description: '12-D-007: no per-project role exists on the BE; only the global-role half is asserted' });
        test.info().annotations.push({
          type: 'BUG-513',
          description: '12-D-007 current behaviour (QA-03e, decision pending): SCR-12 failure actions follow the session (global) role (ProcessingScreen.container.tsx:182,196); a global engineer member gets directions + details, a global viewer member gets none.',
        });
        await eng.page.goto(ROUTES.project.pipeline(project.projectId));
        await expect.soft(eng.page.getByRole('alert').filter({ hasText: title })).toBeVisible({ timeout: 45_000 });
        await expect.soft(nextSteps(eng.page)).toBeVisible();
        await expect.soft(button(eng.page, PF.technical)).toBeVisible();
        const v = await session(f, browser, viewer);
        await v.page.goto(ROUTES.project.pipeline(project.projectId));
        await expect.soft(v.page.getByRole('alert').filter({ hasText: title })).toBeVisible({ timeout: 45_000 });
        await expect.soft(nextSteps(v.page)).toHaveCount(0);
        await captureEvidence(v.page, 'E03_12-D-007_global-viewer-member.png');
        await captureEvidence(eng.page, 'E03_12-D-007_global-engineer-member.png');
      });

      await test.step('[12-D-005] engineer member: directions, "Thử lại bước này", "Chi tiết kỹ thuật" enabled; after the owner\'s fix run the summary actions are there', async () => {
        const { page } = eng;
        const group = nextSteps(page);
        await expect(group.getByRole('button')).toHaveCount(2); // S-14: no "Bỏ qua tầng đó" while skipFloor is unsupported
        for (const name of [PF.lower, `${PF.retry} — Thử lại bước ${PREPROCESS}`]) await expect(button(group, name)).toBeEnabled();
        await expect(button(page, PF.technical)).toBeEnabled();
        await captureEvidence(page, 'E03_12-D-005_engineer-member-failure.png');
        const { outcomes: fixed } = await uploadAndSettle(f.ownerApi, project.projectId, [[floor, envDrawingPng()]]);
        expect(fixed[0]?.status, 'setup: owner fix run completed').toBe('completed');
        await page.reload();
        await expect(page.getByText(doneLine(1, 1))).toBeVisible({ timeout: 45_000 });
        const summary = page.getByRole('region', { name: PR.summary, exact: true });
        await expect(button(summary, PR.reviewWalls)).toBeVisible();
        await expect(button(summary, PR.calibrate)).toBeVisible();
        await captureEvidence(page, 'E03_12-D-005_engineer-member-done.png');
      });

      await test.step('[12-D-006] non-member engineer → "Không tìm thấy dự án này" + "Về danh sách dự án" (N7 404 project)', async () => {
        const out = await session(f, browser, outsider);
        await out.page.goto(ROUTES.project.pipeline(project.projectId));
        const alert = out.page.getByRole('alert').filter({ hasText: NOT_FOUND_TITLE });
        await expect(alert).toBeVisible({ timeout: 45_000 });
        await expect(alert).toContainText(NOT_FOUND_SENTENCE);
        await expect(button(alert, BACK_TO_PROJECTS)).toBeVisible();
        await captureEvidence(out.page, 'E03_12-D-006_non-member.png');
      });
    });
  });
});
