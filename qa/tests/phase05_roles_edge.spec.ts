/**
 * Phase 5 — SCR-27 mobile viewer by role + SCR-X5 roles across the three 3D routes (`/3d`, `/3d/measure`, `/m/du-an/:p`)
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
  PHONE,
  inviteText,
  mobileRegion,
  openAs,
  openMeasure,
  openMobile,
  openPascal,
  pascalEditCue,
  seedProject,
  seedWallOne,
  sendLinkButton,
  setUserRole,
  sheetRow,
  signInViaForm,
  tapWall,
  visibleWithin,
  writesSince,
} from './support/p05/P5';

const notFound = (page: Page) => page.getByText(GATE.notFoundTitle, { exact: true });
const forbidden = (page: Page) => page.getByText(MV.forbidden, { exact: true });
const toolButton = (page: Page, name: string) => page.getByRole('navigation', { name: MV.tools, exact: true }).getByRole('button', { name, exact: true });

/** Routes of the three screens, in the order the plan walks them. */
const routesOf = (projectId: string) => ({
  pascal: ROUTES.project.viewer(projectId),
  measure: ROUTES.project.measure(projectId),
  mobile: ROUTES.mobileViewer(projectId),
});

test.describe('SCR-27 / SCR-X5 — roles', () => {
  test('SCR-27 · FL-27-11 · desktop invite by role', async ({ browser }) => {
    test.setTimeout(240_000);
    const admin = await adminApi();
    const opens: OpenPage[] = [];
    let projectId = '';
    try {
      projectId = await seedWallOne(admin, 'x5-27-11');
      const engineer = await poolUser(admin, 'engineer', 'p05-roles');
      const viewer = await poolUser(admin, 'viewer', 'p05-roles');
      await addProjectMember(admin, projectId, engineer.email);
      await addProjectMember(admin, projectId, viewer.email);
      const asAdmin = await openAs(browser, 'admin', PHONE, true);
      opens.push(asAdmin);
      const asEngineer = await openAs(browser, engineer, PHONE, true);
      opens.push(asEngineer);
      const asViewer = await openAs(browser, viewer, PHONE, true);
      opens.push(asViewer);

      await test.step('[27-D-001] admin taps the wall: "Sửa trên máy tính để chính xác hơn", no "Gửi liên kết sang máy tính"', async () => {
        await openMobile(asAdmin.page, projectId);
        await tapWall(asAdmin.page);
        await expect(inviteText(asAdmin.page)).toBeVisible(); // MVI:267-281, UMV:293-296
        await expect(sendLinkButton(asAdmin.page)).toHaveCount(0); // share is off (MVG:294)
        await captureEvidence(asAdmin.page, 'E05_27-D-001_admin_invite.png');
      });

      await test.step('[27-D-002] engineer member taps the wall: the same invite', async () => {
        await openMobile(asEngineer.page, projectId);
        await tapWall(asEngineer.page);
        await expect.soft(inviteText(asEngineer.page)).toBeVisible(); // permissions.ts:64-66 engineer layer.edit
        await captureEvidence(asEngineer.page, 'E05_27-D-002_engineer_invite.png');
      });

      await test.step('[27-D-003] viewer member taps the wall: rows "Bề dày" / "Chiều dài", no invite', async () => {
        await openMobile(asViewer.page, projectId);
        await tapWall(asViewer.page);
        await expect.soft(sheetRow(asViewer.page, 'Bề dày')).toBeVisible();
        await expect.soft(sheetRow(asViewer.page, 'Chiều dài')).toBeVisible();
        await expect.soft(inviteText(asViewer.page)).toHaveCount(0); // MVG:291-294
        await captureEvidence(asViewer.page, 'E05_27-D-003_viewer_rows.png');
      });

      await test.step('[27-D-004] viewer: the model opens (no forbidden) and "Tầng" / "Đo" / "Thông tin" open their panels', async () => {
        const { page } = asViewer;
        await openMobile(page, projectId);
        await expect.soft(forbidden(page)).toHaveCount(0); // roles ['viewer'] is non-empty (UMV:287-291)
        await toolButton(page, 'Tầng').click();
        await expect.soft(page.getByRole('group', { name: 'Tầng', exact: true })).toBeVisible();
        await toolButton(page, 'Đo').click();
        await expect.soft(page.getByRole('group', { name: 'Đo', exact: true })).toBeVisible();
        await toolButton(page, 'Thông tin').click();
        await expect.soft(page.getByRole('dialog', { name: MV.sheet, exact: true })).toBeVisible();
        await captureEvidence(page, 'E05_27-D-004_viewer_tools.png');
      });
    } finally {
      for (const open of opens) await closePage(open);
      if (projectId !== '') await deleteSeededProject(admin, projectId);
      await admin.dispose();
    }
  });

  test('SCR-X5 · FL-X5-01 · viewer member walks /3d → /3d/measure → mobile', async ({ browser }) => {
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
      // One desktop and one touch context per role: the phone route needs `hasTouch` for its taps, the desktop routes do not want `isMobile`.
      const viewerDesktop = await openAs(browser, viewer);
      opens.push(viewerDesktop);
      const viewerPhone = await openAs(browser, viewer, PHONE, true);
      opens.push(viewerPhone);
      let viewerEditable = true;
      let viewerInvite = true;

      await test.step('[X5-D-001] viewer opens the three routes in one session: no not-found / forbidden state, each shows its model', async () => {
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
        await openMobile(viewerPhone.page, projectId);
        await expect(notFound(viewerPhone.page)).toHaveCount(0);
        await expect(forbidden(viewerPhone.page)).toHaveCount(0);
        await viewerPhone.page.keyboard.press('Escape');
        await captureEvidence(viewerPhone.page, 'E05_X5-D-001_viewer_three_routes.png');
      });

      await test.step('[X5-D-002] the walk sends no write (0 non-GET/HEAD requests after Esc + idle, minus refresh and telemetry)', async () => {
        // The autosave debounce is 1.8 s (23-A-019), measured from the last Esc; there is no request to wait for.
        await viewerPhone.page.waitForTimeout(2_000); // fixed-wait-ok: debounce window, nothing observable to await
        expect.soft(writesSince(viewerDesktop.api, 0), 'desktop routes').toEqual([]);
        expect.soft(writesSince(viewerPhone.api, 0), 'phone route').toEqual([]);
        await captureEvidence(viewerPhone.page, 'E05_X5-D-002_no_writes.png');
      });

      await test.step('[X5-D-003] engineer, same routes: /3d not read-only and the mobile invite; the viewer had /3d read-only and no invite', async () => {
        await tapWall(viewerPhone.page); // UNKNOWN — NEED VERIFICATION (tap geometry); a read, no write
        viewerInvite = (await inviteText(viewerPhone.page).count()) > 0;
        const engineerDesktop = await openAs(browser, engineer);
        opens.push(engineerDesktop);
        const engineerPhone = await openAs(browser, engineer, PHONE, true);
        opens.push(engineerPhone);
        await openPascal(engineerDesktop.page, projectId);
        const engineerEditable = await visibleWithin(pascalEditCue(engineerDesktop.page), 15_000); // C1 23-D cue, waited for (the menu mounts after the caption)
        await openMobile(engineerPhone.page, projectId);
        await tapWall(engineerPhone.page);
        expect.soft(engineerEditable, 'engineer /3d is not read-only').toBe(true);
        await expect.soft(inviteText(engineerPhone.page), 'engineer mobile invite').toBeVisible();
        expect.soft(viewerEditable, 'viewer /3d is read-only').toBe(false);
        expect.soft(viewerInvite, 'viewer mobile has no invite').toBe(false);
        await captureEvidence(engineerPhone.page, 'E05_X5-D-003_engineer_vs_viewer.png');
      });

      await test.step('[X5-D-007] admin removes the viewer; the viewer reloads each route: "Không tìm thấy dự án này" x3', async () => {
        expect.soft(await removeProjectMember(admin, projectId, viewer.id), 'DELETE member').toBeNull();
        await viewerDesktop.page.goto(routes.pascal);
        await expect.soft(notFound(viewerDesktop.page)).toBeVisible();
        await viewerDesktop.page.goto(routes.measure);
        await expect.soft(notFound(viewerDesktop.page)).toBeVisible();
        await viewerPhone.page.goto(routes.mobile);
        await expect.soft(notFound(viewerPhone.page)).toBeVisible();
        await captureEvidence(viewerPhone.page, 'E05_X5-D-007_removed_member.png');
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
        for (const [url, viewport] of [[routes.pascal, { width: 1440, height: 900 }], [routes.measure, { width: 1440, height: 900 }], [routes.mobile, PHONE]] as const) {
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

      await test.step('[27-D-006] non-member admin on mobile: "Không tìm thấy dự án này"', async () => {
        await asA2.page.setViewportSize(PHONE);
        await asA2.page.goto(routes.mobile);
        await expect(notFound(asA2.page)).toBeVisible(); // PSG:74-76
        await captureEvidence(asA2.page, 'E05_27-D-006_admin_non_member.png');
      });

      await test.step('[27-D-005] non-member engineer on mobile: "Không tìm thấy dự án này"', async () => {
        await asE2.page.setViewportSize(PHONE);
        await asE2.page.goto(routes.mobile);
        await expect.soft(notFound(asE2.page)).toBeVisible();
        await captureEvidence(asE2.page, 'E05_27-D-005_engineer_non_member.png');
      });

      await test.step('[X5-D-004] non-member admin on /3d, /3d/measure and mobile: identical title, description, way out; GET project 404 each time (never 403)', async () => {
        const result = await walk(asA2);
        expect.soft(new Set(result.texts).size, `one text on three routes: ${result.texts.join(' | ')}`).toBe(1);
        expect.soft(result.texts[0] ?? '').toContain(GATE.notFoundDescription);
        expect.soft(result.backs, 'one "Về danh sách dự án" each').toEqual([1, 1, 1]);
        expect.soft(result.statuses.length, 'GET project answered on every route').toBeGreaterThanOrEqual(3);
        expect.soft(result.statuses.filter((status) => status !== 404), 'only 404 (K08), never 403').toEqual([]);
        await captureEvidence(asA2.page, 'E05_X5-D-004_admin_three_routes.png');
      });

      await test.step('[X5-D-005] non-member engineer: the same on the three routes', async () => {
        const result = await walk(asE2);
        expect.soft(new Set(result.texts).size, `one text on three routes: ${result.texts.join(' | ')}`).toBe(1);
        expect.soft(result.backs, 'one "Về danh sách dự án" each').toEqual([1, 1, 1]);
        expect.soft(result.statuses.length).toBeGreaterThanOrEqual(3);
        expect.soft(result.statuses.filter((status) => status !== 404), 'only 404 (K08), never 403').toEqual([]);
        await captureEvidence(asE2.page, 'E05_X5-D-005_engineer_three_routes.png');
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
      const targets = [`/projects/${projectId}/3d?view=exploded`, routes.measure, routes.mobile];

      await test.step('[27-D-007] anonymous /m/du-an/:p: URL /login?next=%2Fm%2Fdu-an%2F<p> and "Hãy đăng nhập để tiếp tục."', async () => {
        const anon = await openAs(browser, null, PHONE);
        opens.push(anon);
        await anon.page.goto(routes.mobile);
        await expect(anon.page).toHaveURL(new RegExp(`/login\\?next=%2Fm%2Fdu-an%2F${projectId}$`, 'u')); // SessionBootstrap.tsx:406
        await expect(anon.page.getByText(MV.loginPrompt, { exact: true })).toBeVisible(); // vi.json:201
        await captureEvidence(anon.page, 'E05_27-D-007_anonymous_deep_link.png');
      });

      await test.step('[X5-D-006] sign in as the engineer from each next: back on the original path + search every time', async () => {
        let last: Page | undefined;
        for (const [index, target] of targets.entries()) {
          const anon = await openAs(browser, null, index === 2 ? PHONE : { width: 1440, height: 900 });
          opens.push(anon);
          await anon.page.goto(target);
          await anon.page.waitForURL(/\/login\?next=/u);
          expect.soft(pathOf(anon.page.url()), 'the deep link is kept in ?next=').toBe(loginUrl(target));
          await signInViaForm(anon.page, dem, target); // asserts URL = path + search
          last = anon.page;
        }
        if (last !== undefined) await captureEvidence(last, 'E05_X5-D-006_next_round_trip.png');
      });

      await test.step('[X5-D-008] admin lowers the engineer to viewer (#41); a fresh sign-in: /3d read-only and the mobile wall sheet without the invite', async () => {
        expect.soft(await setUserRole(admin, dem, 'viewer'), 'PATCH role -> viewer').toBe(200);
        const desktop = await openAs(browser, dem);
        opens.push(desktop);
        const phone = await openAs(browser, dem, PHONE, true);
        opens.push(phone);
        await openPascal(desktop.page, projectId);
        await expect.soft(pascalEditCue(desktop.page), '/3d read-only (C1 cue)').toHaveCount(0);
        await openMobile(phone.page, projectId);
        await tapWall(phone.page);
        await expect.soft(sheetRow(phone.page, 'Bề dày')).toBeVisible();
        await expect.soft(inviteText(phone.page)).toHaveCount(0);
        await captureEvidence(phone.page, 'E05_X5-D-008_demoted_sheet.png');
      });

      await test.step('[X5-D-009] the demoted user on the three routes: a model on each, no forbidden state', async () => {
        const desktop = opens[opens.length - 2];
        const phone = opens[opens.length - 1];
        if (desktop === undefined || phone === undefined) throw new Error('step X5-D-008 opened no contexts');
        await openPascal(desktop.page, projectId);
        await expect.soft(forbidden(desktop.page)).toHaveCount(0);
        await openMeasure(desktop.page, projectId);
        await expect.soft(forbidden(desktop.page)).toHaveCount(0);
        await openMobile(phone.page, projectId);
        await expect.soft(forbidden(phone.page)).toHaveCount(0);
        await expect.soft(mobileRegion(phone.page)).toBeVisible();
        await captureEvidence(phone.page, 'E05_X5-D-009_demoted_three_routes.png');
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
