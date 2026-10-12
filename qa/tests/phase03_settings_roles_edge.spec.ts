/**
 * Phase 3 — SCR-08 project settings by ROLE (QA-03d flow plan, agent P2): FL-08-10 … FL-08-12. Real stack only, no mock.
 * One `test()` per flow, one `test.step('[<row id>] …')` per catalog row. Copy and sessions: `support/p03/P2.ts`.
 *
 * ## No project role on the BE (catalog rows 08-D-010, 08-D-011)
 * A project membership has NO role: N3 takes only `{email}` and every member acts with their SYSTEM role
 * (AppBack apps/api/project_members/schemas.py AddMemberBody; projects/access.py `can(principal.role, …)`; projects/wire.py
 * UserOut "vai hệ thống"). "Re-add as project viewer / engineer" therefore cannot be set up: a re-add answers 200 (already a
 * member) and nothing changes. Those two steps assert that precondition and what the screen then really does, and carry a
 * `catalog-mismatch` annotation; the FE/BE role-source mismatch the rows describe is unreachable on this stack.
 *
 * ## Real-backend budget per run
 * - `POST /api/auth/login`: 6 (admin ×3, own login per flow, no shared session file; pool engineer ×2, pool viewer ×1).
 * - `POST /api/users/invitations`: 0, or 1 per pool slot filled for the first time (`engineer:shared`, `viewer:shared`).
 * - `POST /api/projects`: 3 (2 by the admin, 1 by the pool engineer), each deleted in `finally`.
 * - `POST /api/projects/:id/members` (`members_add` 60 / 3600 s per actor): admin 4 (add + re-add ×2), engineer 1.
 * - `PUT …/settings` 3, `PATCH /api/projects/:id` 1. Notifications: 2 projectInvite (engineer), 1 (viewer), 1 (admin).
 */
import { expect, test, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { dashboardLoaded, readAdminCredentials } from './support/auth';
import { captureEvidence } from './support/evidence';
import { addProjectMember, createProject, deleteSeededProject, poolUser } from './support/phase03Seed';
import {
  COMPACT,
  COPY,
  DESKTOP,
  LABEL,
  MEMBER,
  TAB,
  TABS_LABEL,
  alertWith,
  asRecord,
  chooseTab,
  closeSession,
  membersPath,
  openSession,
  openSettings,
  pathOf,
  projectRe,
  settingsRe,
  textbox,
  uniq,
} from './support/p03/P2';

const GENERAL_LABELS = [LABEL.name, LABEL.code, LABEL.address, LABEL.buildingType, LABEL.notes] as const;
const UNITS_LABELS = [LABEL.lengthUnit, LABEL.snap, LABEL.confidence, LABEL.scale] as const;

const tablist = (page: Page) => page.getByRole('tablist', { name: TABS_LABEL, exact: true });
const tabNames = (page: Page): Promise<string[]> => tablist(page).getByRole('tab').allTextContents();

/** Editable controls (textbox / combobox) named by any of `labels`. */
async function editableCount(page: Page, labels: readonly string[]): Promise<number> {
  let total = 0;
  for (const label of labels) {
    total += await page.getByRole('textbox', { name: label, exact: true }).count();
    total += await page.getByRole('combobox', { name: label, exact: true }).count();
  }
  return total;
}

/* ================================================================= FL-08-10 */

test('FL-08-10 · SCR-08 · engineer: non-member 404, invited via notification, edits, then re-added (no project role)', async ({ browser }) => {
  test.setTimeout(150_000);
  const admin = await openSession(browser, 'admin');
  const engineer = await poolUser(admin.api, 'engineer');
  const project = await createProject(admin.api, '08-d-009');
  const e = await openSession(browser, engineer);
  try {
    const { page } = e;
    const id = project.projectId;

    await test.step('[08-D-009] non-member opens /settings → load 404 alert + "Về danh sách dự án"', async () => {
      await page.goto(ROUTES.project.settings(id));
      const alert = alertWith(page, COPY.loadError);
      await expect(alert).toBeVisible({ timeout: 20_000 }); // PS:61-66 isProjectMissing
      await expect(alert.getByRole('button', { name: COPY.backToProjects, exact: true })).toBeVisible();
      await expect.soft(alert.getByRole('button', { name: COPY.retry, exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E03_08-D-009_non-member-404.png');
    });

    await test.step('[08-A-004] owner adds the engineer → Notification Center projectInvite lands on /settings', async () => {
      await addProjectMember(admin.api, id, engineer.email);
      await page.goto(ROUTES.dashboard);
      await dashboardLoaded(page);
      await page.getByRole('button', { name: 'Thông báo', exact: true }).click(); // NotificationCenter.tsx bell
      const drawer = page.getByRole('dialog', { name: 'Thông báo', exact: true });
      const row = drawer.getByRole('listitem').filter({ hasText: project.name });
      await expect(row).toBeVisible({ timeout: 15_000 });
      await captureEvidence(page, 'E03_08-A-004_invite-notification.png');
      await row.getByRole('button').first().click(); // sentence → place projectSettings (notificationCenterGateway.ts:135-136)
      await expect.poll(() => pathOf(page)).toBe(ROUTES.project.settings(id));
      await expect(textbox(page, LABEL.name)).toHaveValue(project.name);
    });

    await test.step('[08-D-002] tabs "Chung" / "Đơn vị đo" / "Thành viên" only; 375 px select has no "Vùng nguy hiểm"', async () => {
      expect.soft(await tabNames(page)).toEqual([TAB.general, TAB.units, TAB.members]); // UPS:755 canDelete
      await captureEvidence(page, 'E03_08-D-002_engineer-tabs.png');
      await page.setViewportSize(COMPACT);
      const select = page.getByRole('combobox', { name: TABS_LABEL, exact: true });
      await select.click();
      const options = await page.getByRole('option').allTextContents();
      expect.soft(options.map((o) => o.trim())).toEqual([TAB.general, TAB.units, TAB.members]);
      await captureEvidence(page, 'E03_08-D-002_engineer-select-375.png');
      await page.keyboard.press('Escape');
      await page.setViewportSize(DESKTOP);
      await expect(tablist(page)).toBeVisible();
    });

    await test.step('[08-D-003] engineer edits "Ghi chú" and "Tên dự án" → PUT 200 + PATCH 200; no read-only banner', async () => {
      await expect.soft(page.getByText(COPY.readOnly, { exact: true })).toHaveCount(0);
      const put = waitForApi(page, 'PUT', settingsRe(id), [200]);
      await textbox(page, LABEL.notes).fill(`qa engineer ${uniq()}`);
      await put;
      const patch = waitForApi(page, 'PATCH', projectRe(id), [200]);
      await textbox(page, LABEL.name).fill(`${project.name}-e`);
      await patch;
    });

    await test.step('[08-D-004] "Thành viên": add form and "Gỡ {name}" for each member', async () => {
      await chooseTab(page, TAB.members);
      await expect.soft(textbox(page, MEMBER.email)).toBeVisible();
      await expect.soft(page.getByRole('button', { name: MEMBER.add, exact: true })).toBeVisible();
      await expect.soft(page.getByRole('button', { name: `${MEMBER.remove} ${engineer.name}`, exact: true })).toBeVisible();
      await expect.soft(page.getByRole('button', { name: /^Gỡ / })).toHaveCount(2);
      await captureEvidence(page, 'E03_08-D-004_engineer-members.png');
    });

    await test.step('[08-D-010] owner "re-adds as viewer" → 200 already a member (no project role); fields stay editable, notes PUT 200', async () => {
      test.info().annotations.push({
        type: 'catalog-mismatch',
        description: '08-D-010: BE N3 has no role (AddMemberBody {email}); a member always acts with the system role, so a global engineer cannot be a project viewer and the 403 path is unreachable.',
      });
      const again = await admin.api.post(membersPath(id), { data: { email: engineer.email } });
      expect(again.status(), 'N3 re-add answers 200 (already a member)').toBe(200);
      expect(asRecord(await again.json(), 'N3').role, 'the role in the answer is the system role').toBe('engineer');
      await page.reload();
      await expect(textbox(page, LABEL.notes)).toBeEditable();
      const put = page.waitForResponse((r) => r.request().method() === 'PUT' && settingsRe(id).test(new URL(r.url()).pathname));
      await textbox(page, LABEL.notes).fill(`qa engineer again ${uniq()}`);
      expect.soft((await put).status(), 'engineer member saves (FE and BE read the same system role)').toBe(200);
      await expect.soft(alertWith(page, COPY.saveFailure)).toHaveCount(0);
      await captureEvidence(page, 'E03_08-D-010_engineer-readded.png');
    });
  } finally {
    await deleteSeededProject(admin.api, project.projectId);
    await closeSession(e);
    await closeSession(admin);
  }
});

/* ================================================================= FL-08-11 */

test('FL-08-11 · SCR-08 · viewer member: read-only settings, then re-added (no project role)', async ({ browser }) => {
  test.setTimeout(120_000);
  const admin = await openSession(browser, 'admin');
  const viewer = await poolUser(admin.api, 'viewer');
  const project = await createProject(admin.api, '08-d-005');
  await addProjectMember(admin.api, project.projectId, viewer.email);
  const v = await openSession(browser, viewer);
  try {
    const { page } = v;
    const id = project.projectId;
    await openSettings(page, id, project.name);

    await test.step('[08-D-005] banner "Vai hiện tại chỉ xem được cài đặt, không sửa và không xoá."', async () => {
      await expect(page.getByText(COPY.readOnly, { exact: true })).toBeVisible(); // PS:82-86
      await captureEvidence(page, 'E03_08-D-005_viewer-banner.png');
    });

    await test.step('[08-D-006] no textbox / combobox for the general and units fields; values as text; "Ghi chú" "—"', async () => {
      expect.soft(await editableCount(page, GENERAL_LABELS), 'general fields rendered as text').toBe(0);
      await expect.soft(page.getByText(project.name, { exact: true })).toBeVisible();
      const notes = page.getByText(LABEL.notes, { exact: true }).locator('xpath=..');
      await expect.soft(notes.locator('p')).toHaveText('—'); // GT:71-79
      await expect.soft(page.getByText('Mã ngắn để tra cứu nhanh', { exact: true })).toHaveCount(0); // Input.tsx: no hint read-only
      await expect.soft(page.getByRole('alert')).toHaveCount(0);
      await captureEvidence(page, 'E03_08-D-006_viewer-general.png');
      await chooseTab(page, TAB.units);
      expect.soft(await editableCount(page, UNITS_LABELS), 'units fields rendered as text').toBe(0);
      await captureEvidence(page, 'E03_08-D-006_viewer-units.png');
      await chooseTab(page, TAB.general);
    });

    await test.step('[08-E-015] Tab walk meets no read-only input; each value keeps its visible label', async () => {
      await page.locator('body').click({ position: { x: 1, y: 1 } });
      const focused: string[] = [];
      for (let i = 0; i < 30; i += 1) {
        await page.keyboard.press('Tab');
        focused.push(
          await page.evaluate(() => {
            const el = document.activeElement;
            if (el === null) return '';
            return `${el.tagName.toLowerCase()}|${el.getAttribute('role') ?? ''}|${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)}`;
          }),
        );
      }
      const dead = focused.filter((f) => /^(input|textarea|select)\||\|combobox\|/u.test(f));
      expect.soft(dead, `focus stops: ${focused.join(' / ')}`).toEqual([]);
      for (const label of GENERAL_LABELS) await expect.soft(page.getByText(label, { exact: true })).toBeVisible();
    });

    await test.step('[08-D-007] "Thành viên": list shown; no email box, no "Thêm thành viên", no "Gỡ"', async () => {
      await chooseTab(page, TAB.members);
      await expect(page.getByText('2 thành viên', { exact: true })).toBeVisible();
      await expect.soft(textbox(page, MEMBER.email)).toHaveCount(0); // MT:48
      await expect.soft(page.getByRole('button', { name: MEMBER.add, exact: true })).toHaveCount(0);
      await expect.soft(page.getByRole('button', { name: /^Gỡ/ })).toHaveCount(0); // MT:65
      await captureEvidence(page, 'E03_08-D-007_viewer-members.png');
    });

    await test.step('[08-D-008] no "Vùng nguy hiểm" tab', async () => {
      expect.soft(await tabNames(page)).toEqual([TAB.general, TAB.units, TAB.members]); // UPS:1358-1360
    });

    await test.step('[08-D-011] owner "re-adds as engineer" → 200 already a member (no project role); banner stays after reload', async () => {
      test.info().annotations.push({
        type: 'catalog-mismatch',
        description: '08-D-011: BE N3 has no role; a global viewer stays a viewer in every project, so "project engineer" cannot be set up.',
      });
      const again = await admin.api.post(membersPath(id), { data: { email: viewer.email } });
      expect(again.status(), 'N3 re-add answers 200 (already a member)').toBe(200);
      expect(asRecord(await again.json(), 'N3').role).toBe('viewer');
      await page.reload();
      await expect.soft(page.getByText(COPY.readOnly, { exact: true })).toBeVisible();
      await captureEvidence(page, 'E03_08-D-011_viewer-readded.png');
    });
  } finally {
    await deleteSeededProject(admin.api, project.projectId);
    await closeSession(v);
    await closeSession(admin);
  }
});

/* ================================================================= FL-08-12 */

test('FL-08-12 · SCR-08 · danger tab follows the global admin flag, not project ownership', async ({ browser }) => {
  test.setTimeout(90_000);
  const admin = await openSession(browser, 'admin');
  const engineer = await poolUser(admin.api, 'engineer');
  const e = await openSession(browser, engineer);
  const project = await createProject(e.api, '08-d-012'); // the engineer creates and owns it
  try {
    await addProjectMember(e.api, project.projectId, readAdminCredentials().email);

    await test.step('[08-D-012] admin member sees "Vùng nguy hiểm"; the engineer owner (2nd context) does not', async () => {
      await openSettings(admin.page, project.projectId, project.name);
      expect.soft(await tabNames(admin.page)).toContain(TAB.danger); // UPS:755 canEdit && roles.includes('admin')
      await captureEvidence(admin.page, 'E03_08-D-012_admin-member-danger.png');
      await openSettings(e.page, project.projectId, project.name);
      expect.soft(await tabNames(e.page)).not.toContain(TAB.danger);
      await captureEvidence(e.page, 'E03_08-D-012_engineer-owner-no-danger.png');
    });
  } finally {
    await deleteSeededProject(e.api, project.projectId);
    await closeSession(e);
    await closeSession(admin);
  }
});
