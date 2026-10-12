/**
 * Phase 3 — EDGE, SCR-10 floor upload by role (QA-03d P6): FL-10-11 … FL-10-15 of `flow-plan.md`. Real stack, no mocks.
 *
 * Roles: the BE has NO project role — a membership is `(project, user)` only (AppBack project_members/schemas.py) and
 * every project gate checks the account's global role (`require_project("floor.upload")`, projects/access.py; matrix
 * `floor.upload`: admin/engineer yes, viewer no). The FE reads the same account role (FloorUploadScreen.container.tsx
 * `session.roles`). So the catalog's "engineer account, viewer member" (10-D-011) and "viewer account, engineer member"
 * (10-D-012) cannot be seeded as written: FL-10-14 / FL-10-15 run with a plain membership and say so in the step.
 *
 * Users: P6 pool admin `admin:p06` owns every project; pool `viewer:shared` and `engineer:p06` are added as members of
 * those own projects only (parallel-safe: no shared project, no role change, no stored admin session).
 *
 * Real-backend budget per run: `POST /api/auth/login` 3 per flow + 1 (FL-10-15 viewer API) = 16; invitations 0 (or 1 per
 * pool slot on first fill); `POST /api/projects` 6, deleted in `finally`; `POST …/members` 5; upload init #5: admin:p06 1
 * (FL-10-11 S2 seed), engineer:p06 1 (FL-10-12), viewer 1 refused with 403 before the rate limit (router.py gate order).
 */
import { expect, test, type Browser } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { signedInApi } from './support/api';
import { attachJson, captureEvidence } from './support/evidence';
import {
  P6_SLOT,
  UP,
  assignFromTray,
  badge,
  card,
  closeSession,
  fireDrag,
  floorAt,
  floorIds,
  initRe,
  openPool,
  openUpload,
  pathname,
  pickFiles,
  pngFile,
  tray,
  withPoolOwner,
  type OwnerRun,
  type Session,
} from './support/p03/P6';
import {
  addProjectMember,
  createDrawingProject,
  deleteSeededProject,
  envDrawingPng,
  poolUser,
  type PoolRole,
  type PoolUser,
} from './support/phase03Seed';

const png = (name: string) => pngFile(name, envDrawingPng());
const suspected = (row: string, what: string): void => {
  test.info().annotations.push({ type: 'suspected-bug', description: `${row}: ${what}` });
};

/** A pool owner's 1-floor project, `role` user added (or not) as a member, and that user's browser session. */
async function asMember(
  browser: Browser,
  slug: string,
  role: Exclude<PoolRole, 'admin'>,
  member: boolean,
  body: (run: OwnerRun, user: PoolUser, session: Session) => Promise<void>,
): Promise<void> {
  await withPoolOwner(browser, slug, 1, async (run) => {
    const user = await poolUser(run.admin, role, role === 'viewer' ? 'shared' : P6_SLOT);
    if (member) await addProjectMember(run.ownerApi, run.project.projectId, user.email);
    const session = await openPool(browser, user);
    try {
      await body(run, user, session);
    } finally {
      await closeSession(session);
    }
  });
}

test('SCR-10 · FL-10-11 · viewer member tries every upload action', async ({ browser }) => {
  test.setTimeout(180_000);
  await withPoolOwner(browser, '10-d-006', 0, async ({ admin, ownerApi, project: empty }) => {
    const viewer = await poolUser(admin, 'viewer');
    const drawn = await createDrawingProject(ownerApi, '10-d-004', envDrawingPng(), ['Tầng 1']);
    let session: Session | undefined;
    try {
      await addProjectMember(ownerApi, drawn.projectId, viewer.email);
      await addProjectMember(ownerApi, empty.projectId, viewer.email);
      session = await openPool(browser, viewer);
      const { page } = session;
      const floorCard = card(page, drawn.floorId);

      await test.step('[10-D-004] S2: Tầng 1 card has no "Gán cho tầng khác", "Chọn trang" or "Tuỳ chọn của tầng Tầng 1"', async () => {
        await openUpload(page, drawn.projectId, [drawn.floorId]);
        await expect(badge(floorCard, UP.attached)).toBeVisible(); // server drawing (UFU rows: floor.drawings[0])
        await expect(page.getByText(UP.readOnly, { exact: true })).toBeVisible();
        await expect(floorCard.getByRole('combobox', { name: UP.assign })).toHaveCount(0);
        await expect(floorCard.getByRole('combobox', { name: UP.pickPage })).toHaveCount(0);
        await expect(floorCard.getByRole('button', { name: `Tuỳ chọn của tầng ${drawn.floorName}`, exact: true })).toHaveCount(0);
        await captureEvidence(page, 'E03_10-D-004_viewer_card.png');
      });

      await test.step('[10-D-003] dragenter + drop mat-bang.png → no drag highlight, no tray item', async () => {
        const file = pngFile('mat-bang.png', Buffer.from('qa'));
        await fireDrag(floorCard, 'dragenter', [file]);
        await expect.soft(page.locator('[data-drag-active="true"]')).toHaveCount(0);
        await expect.soft(page.getByTestId(UP.dropzone)).toHaveCount(0); // UFU canDrop = canEdit && …
        await fireDrag(floorCard, 'drop', [file]);
        await expect.soft(tray(page)).toHaveCount(0);
        await captureEvidence(page, 'E03_10-D-003_viewer_drop.png');
      });

      await test.step('[10-D-005] "Bắt đầu xử lý" is clickable but does nothing: no notice, no navigation', async () => {
        const submit = page.getByRole('button', { name: UP.submit, exact: true });
        await expect.soft(submit).toBeEnabled();
        const before = new URL(page.url()).pathname;
        await submit.click();
        await page.waitForTimeout(1_500);
        suspected('10-D-005', 'viewer submit is a silent no-op (UFU submit: !canEdit → return)');
        await expect.soft(page.getByTestId(UP.blockNotice)).toHaveCount(0);
        expect.soft(new URL(page.url()).pathname).toBe(before);
        await captureEvidence(page, 'E03_10-D-005_viewer_submit_noop.png');
      });

      await test.step('[10-D-006] 0-floor project → EmptyState without "Thêm tầng"', async () => {
        await page.goto(ROUTES.project.upload(empty.projectId));
        await expect(page.getByText(UP.noFloorsTitle, { exact: true })).toBeVisible();
        await expect.soft(page.getByRole('button', { name: UP.addFloors, exact: true })).toHaveCount(0); // UFU onAddFloors needs canEdit
        await captureEvidence(page, 'E03_10-D-006_viewer_no_floors.png');
      });
    } finally {
      await closeSession(session);
      await deleteSeededProject(ownerApi, drawn.projectId);
    }
  });
});

test('SCR-10 · FL-10-12 · engineer member uploads a drawing', async ({ browser }) => {
  test.setTimeout(150_000);
  await asMember(browser, '10-d-008', 'engineer', true, async ({ project }, _user, { page }) => {
    const floor = floorAt(project, 0);
    await test.step('[10-D-008] ban-ve.png → Tầng 1: init → chunks → complete → "Đã gắn kèm"', async () => {
      await openUpload(page, project.projectId, floorIds(project));
      const init = page.waitForResponse((r) => r.request().method() === 'POST' && initRe(project.projectId).test(pathname(r.request())));
      const complete = page.waitForResponse((r) => r.request().method() === 'POST' && /\/drawings\/uploads\/[^/]+\/complete$/u.test(pathname(r.request())), { timeout: 60_000 });
      await pickFiles(page, [png('ban-ve.png')]);
      await assignFromTray(page, 'ban-ve.png', floor.name);
      expect((await init).status(), 'init #5 (BE answers 200; the catalog says 201)').toBe(200);
      expect((await complete).status()).toBe(200);
      await expect(badge(card(page, floor.id), UP.attached)).toBeVisible();
      await captureEvidence(page, 'E03_10-D-008_engineer_uploaded.png');
    });
  });
});

test('SCR-10 · FL-10-13 · engineer who is not a member opens the upload link', async ({ browser }) => {
  await asMember(browser, '10-d-010', 'engineer', false, async ({ project }, _user, { page }) => {
    await test.step('[10-D-010] /projects/:id/upload → "Không tìm thấy dự án này" + sentence + "Về danh sách dự án"', async () => {
      await page.goto(ROUTES.project.upload(project.projectId));
      await expect(page.getByText(UP.notFoundTitle, { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(UP.notFoundSentence, { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: UP.backToProjects, exact: true })).toBeVisible();
      await expect(page.getByTestId(UP.dropzone)).toHaveCount(0);
      await captureEvidence(page, 'E03_10-D-010_engineer_not_member.png');
    });
  });
});

test('SCR-10 · FL-10-14 · engineer account that is only a viewer member uploads', async ({ browser }) => {
  await asMember(browser, '10-d-011', 'engineer', true, async ({ project }, _user, { page }) => {
    await test.step('[10-D-011] engineer account, member: upload controls shown (account role)', async () => {
      await openUpload(page, project.projectId, floorIds(project));
      await expect(page.getByTestId(UP.dropzone)).toBeVisible();
      await expect(page.getByText(UP.readOnly, { exact: true })).toHaveCount(0);
      // UNKNOWN — NEED VERIFICATION: the "viewer member" half cannot be seeded — the BE membership has no role
      // (project_members/schemas.py) and the init gate reads the global role, so this engineer's init would be 200
      // (FL-10-12), not the catalog's 403. No upload is spent here.
      test.info().annotations.push({
        type: 'unknown',
        description: '10-D-011: no project role exists in the BE; "viewer member" of an engineer account is not producible',
      });
      await captureEvidence(page, 'E03_10-D-011_engineer_member_controls.png');
    });
  });
});

test('SCR-10 · FL-10-15 · viewer account that is an engineer member opens upload', async ({ browser }) => {
  await asMember(browser, '10-d-012', 'viewer', true, async ({ project }, user, { page }) => {
    await test.step('[10-D-012] read-only line, no drop zone (the BE refuses a viewer account too)', async () => {
      await openUpload(page, project.projectId, floorIds(project));
      await expect(page.getByText(UP.readOnly, { exact: true })).toBeVisible();
      await expect(page.getByTestId(UP.dropzone)).toHaveCount(0);
      await captureEvidence(page, 'E03_10-D-012_viewer_member_read_only.png');
      // The catalog suspects the BE "would accept"; it cannot (no project role, `floor.upload` viewer → 403). Checked.
      const api = await signedInApi(user.email, user.password);
      try {
        const floor = floorAt(project, 0);
        const res = await api.post(`/api/projects/${project.projectId}/floors/${floor.id}/drawings/uploads`, {
          data: { fileName: 'ban-ve.png', floorId: floor.id, mimeType: 'image/png', projectId: project.projectId, sizeBytes: 16 },
        });
        const body = (await res.json().catch(() => ({}))) as { code?: unknown };
        await attachJson('E03_10-D-012_viewer_init.json', { status: res.status(), code: body.code ?? null });
        expect.soft(res.status(), 'viewer account init is refused by the BE (FE read-only is consistent)').toBe(403);
      } finally {
        await api.dispose();
      }
    });
  });
});
