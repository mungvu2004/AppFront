/**
 * Phase 5 — SCR-X5 roles across the two 3D routes (`/3d`, `/3d/measure`); mobile (`/m/du-an/:p`) is out of scope (2026-10-14)
 * (QA-05c S3 pack P5; plan `flows-C5.md` "phase05_roles_edge.spec.ts"). Real stack only, no mock. One test per flow, one
 * `test.step('[<row id>] …')` per catalog row.
 *
 * Source (FE master d50bb248): MV src/screens/system/MobileViewer/ (MVV MobileViewer.tsx state layers, MVB MobileViewerBottomBar.tsx,
 * MVI MobileViewerInfoSheet.tsx:267-281 invite, UMV useMobileViewer.ts:474 forbidden) · PSG src/components/feedback/ProjectSpatialGate.tsx
 * (not found, K08) · PVC src/screens/viewer/PascalViewer/PascalViewer.container.tsx:166 (`readOnly = !can('edit','layer',{roles})`)
 * · vendor/pascal action-menu/index.tsx:38 + control-modes.tsx:117 (the bottom action menu mounts `[data-guide-target="mode-select"]`
 * only for an editor: the C1 23-D read-only cue) · SB SessionBootstrap.tsx:406 (`/login?next=`).
 * BE: project membership carries no role (project_members), so a project "viewer" is a global viewer added as member; non-members get 404 (K08).
 *
 * Users (pool, never deleted here): `p05-roles` viewer + engineer (members), `p05-roles-a2` admin and `p05-roles-e2` engineer (non-members),
 * `p05-roles-demote` engineer (FL-X5-03: lowered to viewer through #41, restored to engineer in `finally`).
 * Canvas / touch taps on the one-wall model (`tapWall`) were not run in S3: UNKNOWN — NEED VERIFICATION of the tap geometry.
 *
 * Budget per run: logins 4 API (admin `signedInApi` per flow) + about 14 browser logins (admin 1, pool users 1 per context; 3 UI form
 * sign-ins in X5-D-006); `POST /api/auth/refresh` about 1 per page load (< 60); `POST /api/projects` 4 (+4 DELETE in `finally`);
 * `POST …/members` 7, `DELETE …/members/:id` 1; `PATCH /api/users/:id/role` 2 (lower, restore); invitations 0, or up to 5 when a pool slot is empty.
 */
import { expect, test, type Page } from '@playwright/test';

import { ROUTES, loginUrl, pathOf } from '../../e2e/fixtures/routes';
import { captureEvidence } from './support/evidence';
import { addProjectMember, deleteSeededProject, poolUser, removeProjectMember, type PoolUser } from './support/phase03Seed';
import { adminApi, closePage, type OpenPage } from './support/p03/P4';
import {
  GATE,
  MV,
  openAs,
  openMeasure,
  openPascal,
  pascalEditCue,
  seedProject,
  seedWallOne,
  setUserRole,
  signInViaForm,
  visibleWithin,
  writesSince,
} from './support/p05/P5';

const notFound = (page: Page) => page.getByText(GATE.notFoundTitle, { exact: true });
const forbidden = (page: Page) => page.getByText(MV.forbidden, { exact: true });

/** Routes of the three screens, in the order the plan walks them. */
const routesOf = (projectId: string) => ({
  pascal: ROUTES.project.viewer(projectId),
  measure: ROUTES.project.measure(projectId),
});

test.describe('SCR-X5 — roles', () => {
  test('SCR-X5 · FL-X5-01 · viewer member walks /3d → /3d/measure', async ({ browser }) => {
    test.setTimeout(480_000);
    const admin = await adminApi();
    const opens: OpenPage[] = [];
    let projectId = '';
    try {
      projectId = await seedWallOne(admin, 'x5-01');
      const viewer = await poolUser(admin, 'viewer', 'p05-roles');
      const engineer = await poolUser(admin, 'engineer', 'p05-roles');
      await addProjectMember(admin, projectId, viewer.email);
      await addProjectMember(admin, projectId, engineer.email);
      const routes = routesOf(projectId);
      // One desktop context per role.
      const viewerDesktop = await openAs(browser, viewer);
      opens.push(viewerDesktop);
      let viewerEditable = true;

      await test.step('[X5-D-001] viewer opens the two routes in one session: no not-found / forbidden state, each shows its model', async () => {
        const { page } = viewerDesktop;
        await openPascal(page, projectId);
        await expect(notFound(page)).toHaveCount(0);
        await expect(forbidden(page)).toHaveCount(0);
        viewerEditable = (await pascalEditCue(page).count()) > 0;
        await page.keyboard.press('Escape');
        await openMeasure(page, projectId);
        await expect(notFound(page)).toHaveCount(0);
        await expect(forbidden(page)).toHaveCount(0);
        await page.keyboard.press('Escape');
        await captureEvidence(page, 'E05_X5-D-001_viewer_two_routes.png');
      });

      await test.step('[X5-D-002] the walk sends no write (0 non-GET/HEAD requests after Esc + idle, minus refresh and telemetry)', async () => {
        // The autosave debounce is 1.8 s (23-A-019), measured from the last Esc; there is no request to wait for.
        await viewerDesktop.page.waitForTimeout(2_000); // fixed-wait-ok: debounce window, nothing observable to await
        expect.soft(writesSince(viewerDesktop.api, 0), 'desktop routes').toEqual([]);
        await captureEvidence(viewerDesktop.page, 'E05_X5-D-002_no_writes.png');
      });

      await test.step('[X5-D-003] engineer, same routes: /3d not read-only; the viewer had /3d read-only', async () => {
        const engineerDesktop = await openAs(browser, engineer);
        opens.push(engineerDesktop);
        await openPascal(engineerDesktop.page, projectId);
        const engineerEditable = await visibleWithin(pascalEditCue(engineerDesktop.page), 15_000); // C1 23-D cue, waited for (the menu mounts after the caption)
        expect.soft(engineerEditable, 'engineer /3d is not read-only').toBe(true);
        expect.soft(viewerEditable, 'viewer /3d is read-only').toBe(false);
        await captureEvidence(engineerDesktop.page, 'E05_X5-D-003_engineer_vs_viewer.png');
      });

      await test.step('[X5-D-007] admin removes the viewer; the viewer reloads each route: "Không tìm thấy dự án này" x2', async () => {
        expect.soft(await removeProjectMember(admin, projectId, viewer.id), 'DELETE member').toBeNull();
        await viewerDesktop.page.goto(routes.pascal);
        await expect.soft(notFound(viewerDesktop.page)).toBeVisible();
        await viewerDesktop.page.goto(routes.measure);
        await expect.soft(notFound(viewerDesktop.page)).toBeVisible();
        await captureEvidence(viewerDesktop.page, 'E05_X5-D-007_removed_member.png');
      });
    } finally {
      for (const open of opens) await closePage(open);
      if (projectId !== '') await deleteSeededProject(admin, projectId);
      await admin.dispose();
    }
  });

  test('SCR-X5 · FL-X5-02 · non-members get one K08 answer', async ({ browser }) => {
    test.setTimeout(180_000);
    const admin = await adminApi();
    const opens: OpenPage[] = [];
    let projectId = '';
    try {
      projectId = await seedProject(admin, 'x5-02');
      const a2 = await poolUser(admin, 'admin', 'p05-roles-a2'); // NOT added to the project
      const e2 = await poolUser(admin, 'engineer', 'p05-roles-e2'); // NOT added to the project
      const routes = routesOf(projectId);
      const asA2 = await openAs(browser, a2);
      opens.push(asA2);
      const asE2 = await openAs(browser, e2);
      opens.push(asE2);

      /** The not-found answer on the three routes: its text, its way out, and the status of `GET /api/projects/:p` each time. */
      const walk = async (who: OpenPage): Promise<{ texts: string[]; backs: number[]; statuses: number[] }> => {
        const out = { texts: [] as string[], backs: [] as number[], statuses: [] as number[] };
        const mark = who.api.length;
        for (const [url, viewport] of [[routes.pascal, { width: 1440, height: 900 }], [routes.measure, { width: 1440, height: 900 }]] as const) {
          await who.page.setViewportSize(viewport);
          await who.page.goto(url);
          const alert = who.page.getByRole('alert').filter({ hasText: GATE.notFoundTitle });
          await expect.soft(alert).toBeVisible();
          out.texts.push(await alert.first().textContent({ timeout: 2_000 }).then((t) => (t ?? '').replace(/\s+/gu, ' ').trim(), () => ''));
          out.backs.push(await alert.getByRole('button', { name: GATE.backToProjects, exact: true }).count());
        }
        out.statuses = who.api.slice(mark).filter((entry) => entry.method === 'GET' && entry.path === `/api/projects/${projectId}`).map((entry) => entry.status);
        return out;
      };

      await test.step('[X5-D-004] non-member admin on /3d and /3d/measure: identical title, description, way out; GET project 404 each time (never 403)', async () => {
        const result = await walk(asA2);
        expect.soft(new Set(result.texts).size, `one text on two routes: ${result.texts.join(' | ')}`).toBe(1);
        expect.soft(result.texts[0] ?? '').toContain(GATE.notFoundDescription);
        expect.soft(result.backs, 'one "Về danh sách dự án" each').toEqual([1, 1]);
        expect.soft(result.statuses.length, 'GET project answered on every route').toBeGreaterThanOrEqual(2);
        expect.soft(result.statuses.filter((status) => status !== 404), 'only 404 (K08), never 403').toEqual([]);
        await captureEvidence(asA2.page, 'E05_X5-D-004_admin_two_routes.png');
      });

      await test.step('[X5-D-005] non-member engineer: the same on the two routes', async () => {
        const result = await walk(asE2);
        expect.soft(new Set(result.texts).size, `one text on two routes: ${result.texts.join(' | ')}`).toBe(1);
        expect.soft(result.backs, 'one "Về danh sách dự án" each').toEqual([1, 1]);
        expect.soft(result.statuses.length).toBeGreaterThanOrEqual(2);
        expect.soft(result.statuses.filter((status) => status !== 404), 'only 404 (K08), never 403').toEqual([]);
        await captureEvidence(asE2.page, 'E05_X5-D-005_engineer_two_routes.png');
      });
    } finally {
      for (const open of opens) await closePage(open);
      if (projectId !== '') await deleteSeededProject(admin, projectId);
      await admin.dispose();
    }
  });

  test('SCR-X5 · FL-X5-03 · anonymous round trip and demotion', async ({ browser }) => {
    test.setTimeout(480_000);
    const admin = await adminApi();
    const opens: OpenPage[] = [];
    let projectId = '';
    let demoted: PoolUser | undefined;
    try {
      projectId = await seedWallOne(admin, 'x5-03');
      const dem = await poolUser(admin, 'engineer', 'p05-roles-demote');
      demoted = dem;
      expect(await setUserRole(admin, dem, 'engineer'), 'setup: pool user starts as engineer (a stuck viewer slot would make #41 a no-op)').toBe(200);
      await addProjectMember(admin, projectId, dem.email);
      const routes = routesOf(projectId);
      const targets = [`/projects/${projectId}/3d?view=exploded`, routes.measure];

      await test.step('[X5-D-006] sign in as the engineer from each next: back on the original path + search every time', async () => {
        let last: Page | undefined;
        for (const target of targets) {
          const anon = await openAs(browser, null, { width: 1440, height: 900 });
          opens.push(anon);
          await anon.page.goto(target);
          await anon.page.waitForURL(/\/login\?next=/u);
          expect.soft(pathOf(anon.page.url()), 'the deep link is kept in ?next=').toBe(loginUrl(target));
          await signInViaForm(anon.page, dem, target); // asserts URL = path + search
          last = anon.page;
        }
        if (last !== undefined) await captureEvidence(last, 'E05_X5-D-006_next_round_trip.png');
      });

      await test.step('[X5-D-008] admin lowers the engineer to viewer (#41); a fresh sign-in: /3d read-only', async () => {
        expect.soft(await setUserRole(admin, dem, 'viewer'), 'PATCH role -> viewer').toBe(200);
        const desktop = await openAs(browser, dem);
        opens.push(desktop);
        await openPascal(desktop.page, projectId);
        await expect.soft(pascalEditCue(desktop.page), '/3d read-only (C1 cue)').toHaveCount(0);
        await captureEvidence(desktop.page, 'E05_X5-D-008_demoted_readonly.png');
      });

      await test.step('[X5-D-009] the demoted user on the two routes: a model on each, no forbidden state', async () => {
        const desktop = opens[opens.length - 1];
        if (desktop === undefined) throw new Error('step X5-D-008 opened no context');
        await openPascal(desktop.page, projectId);
        await expect.soft(forbidden(desktop.page)).toHaveCount(0);
        await openMeasure(desktop.page, projectId);
        await expect.soft(forbidden(desktop.page)).toHaveCount(0);
        await captureEvidence(desktop.page, 'E05_X5-D-009_demoted_two_routes.png');
      });
    } finally {
      if (demoted !== undefined) {
        try {
          expect.soft(await setUserRole(admin, demoted, 'engineer'), 'restore the pool user to engineer').toBe(200);
        } catch (error) {
          console.error(`restore role failed: ${String(error)}`);
        }
      }
      for (const open of opens) await closePage(open);
      if (projectId !== '') await deleteSeededProject(admin, projectId);
      await admin.dispose();
    }
  });
});
