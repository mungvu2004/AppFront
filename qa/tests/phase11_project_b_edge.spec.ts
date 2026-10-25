/**
 * Phase 11 (QA-11 P7) — project edge, non-admin roles + deleted-entity URLs.
 * Flows FL-11P-04 (engineer), FL-11P-05 (viewer), FL-11P-09 (admin, deleted URLs) of `flows-C2.md`.
 * Real stack. Own projects only; the engineer / viewer are pool slot `p11-project-b` (one spec file, one slot).
 * Destructive calls (remove member, delete project/floor) hit only the project this flow created.
 */
import { expect, test, type Page } from '@playwright/test';

import { ROUTES, UNKNOWN_PATH } from '../../e2e/fixtures/routes';
import { signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { attachJson, captureEvidence } from './support/evidence';
import { createPipelineProject } from './support/drawingSeed';
import { createProject, deleteSeededProject, envDrawingPng, removeProjectMember } from './support/phase03Seed';
import { p11Slot } from './support/p11/common';
import { unknownProjectId, withAdminProject } from './support/p03/P10';
import { P7_TEXT, deleteAs, expectMissingState, getStatus, projectPath, projectRe, withPoolMember } from './support/p11/P7';

const SLOT = p11Slot('project-b');
const ev = (id: string, slug: string): string => `E11_${id}_${slug}.png`;

const waitGet = (page: Page, id: string) =>
  page.waitForResponse((r) => r.request().method() === 'GET' && projectRe(id).test(new URL(r.url()).pathname));

test.describe('phase 11 · project edge B', () => {
  test('SCR-08/05 · FL-11P-04 · engineer · vai engineer: Gỡ, không Vùng nguy hiểm, bị gỡ', async ({ browser }) => {
    test.setTimeout(150_000);
    await withPoolMember(browser, 'engineer', SLOT, 'p11-project-eng', 1, async ({ api, user, project, page }) => {
      const id = project.projectId;

      await test.step('[11P-D-002] engineer: no "Vùng nguy hiểm" tab, has "Gỡ {name}"', async () => {
        await page.goto(ROUTES.project.settings(id)); // UPS:1360 tabs
        await expect(page.getByRole('heading', { name: P7_TEXT.settingsTitle, exact: true })).toBeVisible();
        await expect(page.getByRole('navigation', { name: 'Mục trong trang' }).getByRole('link', { name: P7_TEXT.dangerTab })).toHaveCount(0);
        await page.getByRole('navigation', { name: 'Mục trong trang' }).getByRole('link', { name: P7_TEXT.membersTab }).click(); // "Gỡ" lives in the members tab (MembersTab.tsx:69)
        await expect(page.getByRole('button', { name: /^Gỡ / }).first()).toBeVisible(); // MT:68-74 props.canEdit
        await captureEvidence(page, ev('11P-D-002', 'eng_nodanger'));
      });

      await test.step('[11P-D-003] engineer DELETE project directly -> 403, project intact', async () => {
        const res = await deleteAs(user, projectPath(id)); // BE PR:80 require_project("admin")
        expect.soft(res.status).toBe(403);
        expect.soft(res.code).toBe('FORBIDDEN');
        const after = await getStatus(api, projectPath(id));
        expect.soft(after.status).toBe(200);
      });

      await test.step('[11P-B-011] engineer: "Xoá" is locked in the card menu, so no confirm dialog and no DELETE is sent', async () => {
        // Expectation changed: BUG-P09-001 (BUG-LOG-P09.md:8, fix b044f882) locks "Xoá" for non-admin (projectMenuGroups.ts:25
        // `isDisabled: !canDeleteProject`), so the confirm -> 403 -> sentence path (UPD:234) is no longer reachable by an engineer.
        // The direct 403 stays proven by [11P-D-003].
        await page.goto(ROUTES.dashboard);
        const deletes: string[] = [];
        page.on('request', (r) => {
          if (r.method() === 'DELETE' && projectRe(id).test(new URL(r.url()).pathname)) deletes.push(r.url());
        });
        await page.getByRole('button', { name: `Tuỳ chọn cho ${project.name}`, exact: true }).click(); // ProjectCard:108
        const item = page.getByRole('menu', { name: P7_TEXT.cardMenu, exact: true }).getByRole('menuitem', { name: 'Xoá', exact: true });
        await expect(item).toBeDisabled();
        await item.click({ force: true }); // a locked item must not open the dialog
        await expect.soft(page.getByRole('dialog', { name: P7_TEXT.deleteTitle, exact: true })).toHaveCount(0);
        expect.soft(deletes).toEqual([]);
        await captureEvidence(page, ev('11P-B-011', 'd_locked'));
        await page.keyboard.press('Escape');
        await expect.soft(page.getByRole('button', { name: `Tuỳ chọn cho ${project.name}`, exact: true })).toBeVisible();
      });

      await test.step('[11P-C-009] ⚑ engineer: "Xoá" menu item must be locked (BE admin-only)', async () => {
        await page.getByRole('button', { name: `Tuỳ chọn cho ${project.name}`, exact: true }).click();
        const item = page.getByRole('menu', { name: P7_TEXT.cardMenu, exact: true }).getByRole('menuitem', { name: 'Xoá', exact: true });
        await expect(item).toBeVisible();
        // PMG:25 `isDisabled: !canEdit` leaves it enabled for an engineer; correct = locked/hidden like canDelete (UPS:757)
        await expect.soft(item, 'Xoá should be disabled for a non-admin').toBeDisabled();
        await captureEvidence(page, ev('11P-C-009', 'd_gate'));
        await page.keyboard.press('Escape');
      });

      await test.step('[11P-A-013] removed member: card gone at "/", project URL -> not found (404, no 403)', async () => {
        expect(await removeProjectMember(api, id, user.id)).toBeNull(); // destructive, own project
        await page.goto(ROUTES.dashboard);
        await expect(page.getByRole('heading', { name: 'Chọn dự án để làm tiếp', exact: true })).toBeVisible(); // DASHBOARD_TITLE
        await expect.soft(page.getByRole('button', { name: `Tuỳ chọn cho ${project.name}`, exact: true })).toHaveCount(0);
        const got = waitGet(page, id);
        await page.goto(ROUTES.project.settings(id));
        const res = await got;
        expect.soft(res.status()).toBe(404); // K08, ACC:53-62
        await expect.soft(page.getByRole('button', { name: P7_TEXT.backToProjects, exact: true })).toBeVisible();
        await expect.soft(page.getByText(project.name, { exact: true })).toHaveCount(0);
        await captureEvidence(page, ev('11P-A-013', 'mem_after'));
      });
    });
  });

  test('SCR-08/32/29 · FL-11P-05 · viewer · vai viewer chỉ đọc', async ({ browser }) => {
    test.setTimeout(120_000);
    await withPoolMember(browser, 'viewer', SLOT, 'p11-project-viewer', 'pipeline', async ({ api, user, project, floorId, page, writes }) => {
      const id = project.projectId;

      await test.step('[11P-B-009] viewer: read-only settings, no danger tab, no "Gỡ"', async () => {
        await page.goto(ROUTES.project.settings(id));
        await expect(page.getByRole('heading', { name: P7_TEXT.settingsTitle, exact: true })).toBeVisible();
        await expect(page.getByText(P7_TEXT.readOnlyLine, { exact: true })).toBeVisible(); // PS:84 (!canEdit)
        await expect(page.getByRole('navigation', { name: 'Mục trong trang' }).getByRole('link', { name: P7_TEXT.dangerTab })).toHaveCount(0);
        await page.getByRole('navigation', { name: 'Mục trong trang' }).getByRole('link', { name: P7_TEXT.membersTab }).click(); // members listed here, so "no Gỡ" is meaningful
        await expect(page.getByRole('button', { name: /^Gỡ / })).toHaveCount(0); // MT:68
        await captureEvidence(page, ev('11P-B-009', 'viewer_forb'));
      });

      await test.step('[11P-D-008] viewer history: no restore/label buttons, reason sentence', async () => {
        // seed: pipeline run completed = 2 versions (BE pipeline_persist/service.py:184,193) + CP-6 layer write (withPoolMember 'pipeline')
        await page.goto(`${ROUTES.project.versions(id)}?floorId=${floorId}`);
        await expect(page.getByRole('checkbox', { name: /^Chọn phiên bản .* để so sánh$/u }).first()).toBeVisible(); // VersionList.tsx:84 (Checkbox)
        await expect(page.getByText(P7_TEXT.viewerHistoryReason, { exact: true })).toBeVisible(); // VHM:493-494
        await expect.soft(page.getByRole('button', { name: 'Phục hồi phiên bản này', exact: true })).toHaveCount(0); // VersionHistory.tsx:189
        await expect.soft(page.getByRole('button', { name: /Gắn nhãn/u })).toHaveCount(0);
        await captureEvidence(page, ev('11P-D-008', 'v_viewer'));
      });

      await test.step('[11P-D-004] viewer DELETE member directly -> 403, member remains', async () => {
        const res = await deleteAs(user, `${projectPath(id)}/members/${user.id}`); // BE MR:36 project.settings.edit
        expect.soft(res.status).toBe(403);
        expect.soft(res.code).toBe('FORBIDDEN');
        const got = await api.get(projectPath(id));
        const body = (await got.json()) as { members?: { id?: string }[] };
        expect.soft(body.members?.some((m) => m.id === user.id)).toBe(true);
      });

      await test.step('[11P-D-005] viewer DELETE project directly -> 403, project intact', async () => {
        const res = await deleteAs(user, projectPath(id)); // PR:80
        expect.soft(res.status).toBe(403);
        expect.soft(res.code).toBe('FORBIDDEN');
        expect.soft((await getStatus(api, projectPath(id))).status).toBe(200);
      });

      await test.step('[11P-D-009] viewer: no "Khôi phục mặc định", 0 PUT', async () => {
        const mark = writes.length;
        await page.goto(ROUTES.project.ruleSettings(id));
        // GET rule-config is open to every member (BE rules/router.py:3,23), so the viewer sees the screen, not the denied alert
        await expect(page.getByText('Chọn luật áp dụng', { exact: true })).toBeVisible(); // RuleSettings.tsx:267
        await expect.soft(page.getByRole('button', { name: P7_TEXT.restoreDefaults, exact: true })).toHaveCount(0); // RS:257 canEditRules
        expect.soft(writes.slice(mark).filter((w) => w.method === 'PUT')).toEqual([]);
        await captureEvidence(page, ev('11P-D-009', 'r_roles'));
      });
    });
  });

  test('SCR-39/38 · FL-11P-09 · admin · URL thực thể đã xoá', async ({ browser }) => {
    test.setTimeout(150_000);
    await withAdminProject(browser, 'p11-project-gone', 2, async ({ flow, project, api }) => {
      const page = flow.page;
      const id = project.projectId;
      const floorId = project.floors[1]?.id ?? '';
      expect(floorId, 'setup: second floor').not.toBe('');
      const keepAdmin = readAdminCredentials();
      const keepApi = await signedInApi(keepAdmin.email, keepAdmin.password);
      const keep = await createProject(keepApi, 'p11-project-gone-keep', 1);
      try {
        const floorGone = await api.delete(`/api/floors/${floorId}`); // BE floors/router.py:38
        expect(floorGone.status(), 'setup: DELETE floor').toBe(200); // oracle: floors/router.py:38 returns FloorOut
        const projGone = await api.delete(projectPath(id)); // PR:80, own project
        expect(projGone.status(), 'setup: DELETE project').toBe(200); // oracle: projects/router.py:79 returns ProjectOut

        await test.step('[11P-B-008] deleted project settings: error state, "Về danh sách dự án" (no "Thử lại"), goes to "/"', async () => {
          await page.goto(ROUTES.project.settings(id));
          const back = page.getByRole('button', { name: P7_TEXT.backToProjects, exact: true }); // PS:61-64
          await expect(back).toBeVisible();
          await expect(page.getByRole('button', { name: P7_TEXT.retry, exact: true })).toHaveCount(0);
          await captureEvidence(page, ev('11P-B-008', 'missing_proj'));
          await back.click();
          await expect(page).toHaveURL(/\/$/u);
        });

        await test.step('[11P-A-037] deleted project /3d: not found + exit, no project name', async () => {
          await page.goto(ROUTES.project.viewer(id)); // NF:98/103
          await expectMissingState(page, '3d', 'gate');
          await expect.soft(page.getByText(project.name)).toHaveCount(0);
          await captureEvidence(page, ev('11P-A-037', 'n_3d'));
        });

        await test.step('[11P-A-038] deleted floor URL: not found, no crash', async () => {
          await page.goto(ROUTES.project.scale(id, floorId));
          await expectMissingState(page, 'floor', 'gate');
          await captureEvidence(page, ev('11P-A-038', 'n_floor'));
        });

        await test.step('[11P-A-039] deleted project /versions and /rules/settings: not found, no empty form', async () => {
          await page.goto(ROUTES.project.versions(id));
          await expectMissingState(page, 'versions', 'gate');
          await captureEvidence(page, ev('11P-A-039', 'n_versions'));
          await page.goto(ROUTES.project.ruleSettings(id));
          await expectMissingState(page, 'rules/settings', 'gate');
          await expect.soft(page.getByRole('button', { name: P7_TEXT.restoreDefaults, exact: true })).toHaveCount(0);
        });

        await test.step('[11P-A-040] NotFound "Có thể bạn đang tìm": deleted project absent', async () => {
          await page.goto(UNKNOWN_PATH); // NotFound page proper (NF:88)
          await expect(page.getByRole('heading', { name: P7_TEXT.recentHeading, exact: true })).toBeVisible();
          await expect.soft(page.getByText(project.name)).toHaveCount(0);
          await captureEvidence(page, ev('11P-A-040', 'n_recent'));
        });

        await test.step('[11P-A-041] NotFound "Về danh sách dự án" -> "/", deleted card gone', async () => {
          await page.getByRole('button', { name: P7_TEXT.backToProjects, exact: true }).click(); // NF:89,91
          await expect(page).toHaveURL(/\/$/u);
          await expect(page.getByRole('button', { name: `Tuỳ chọn cho ${keep.name}`, exact: true })).toBeVisible();
          await expect.soft(page.getByRole('button', { name: `Tuỳ chọn cho ${project.name}`, exact: true })).toHaveCount(0);
          await captureEvidence(page, ev('11P-A-041', 'n_back'));
        });

        await test.step('[11P-A-042] stale notification target (deleted project): not found, no crash', async () => {
          // notification = a completed pipeline run (ai_completed, BE pipeline_persist/service.py:169-173) of a project that is then deleted
          const notif = await createPipelineProject(keepApi, 'p11-project-gone-notif', envDrawingPng());
          try {
            // RR evidence: after DELETE the API list no longer has the row (setup error "still has a notification row", 2 of 2 copies).
            // Oracle: soft delete hides the project's notifications at #19 (packages/db/models/notifications.py:4; service.py:56-58
            // joins Project), so a stale row exists only in a list loaded BEFORE the delete. Load the list, delete, then click.
            const listInbox = async (): Promise<{ projectId?: string; message?: string }[]> => {
              const inboxJson = (await (await keepApi.get('/api/notifications')).json()) as unknown;
              const items = (Array.isArray(inboxJson) ? inboxJson : ((inboxJson as { items?: unknown[] }).items ?? [])) as {
                projectId?: string;
                message?: string;
              }[];
              return items.filter((n) => (n.message ?? '').includes('Hệ thống AI đã xử lý xong bản vẽ'));
            };
            await expect
              .poll(async () => (await listInbox()).some((n) => n.projectId === notif.projectId), {
                message: 'setup: the pipeline run notified the project owner before the delete',
                timeout: 30_000,
              })
              .toBe(true);
            const sameKind = await listInbox(); // newest first, notifications/router.py:25-29
            const mine = sameKind.findIndex((n) => n.projectId === notif.projectId);
            await page.goto(ROUTES.notifications);
            await expect(page).toHaveURL(/\/thong-bao$/u);
            const rows = page.getByRole('button').filter({ hasText: 'Hệ thống AI đã xử lý xong bản vẽ' });
            await expect(rows).toHaveCount(sameKind.length); // the page holds the list that still has the row
            const gone = await keepApi.delete(projectPath(notif.projectId));
            expect(gone.status(), 'setup: DELETE notification project').toBe(200);
            await attachJson('E11_11P-A-042_notif_before.json', {
              deletedProjectId: notif.projectId,
              url: page.url(),
              rowCount: await rows.count(),
              apiRowCount: sameKind.length,
              rowIndexOfDeletedProject: mine, // -1 = the deleted project has no row at all
              rowTexts: (await rows.allInnerTexts()).slice(0, 10),
            });
            expect(mine, 'setup: the deleted project still has a notification row').toBeGreaterThanOrEqual(0);
            await rows.nth(mine).click(); // NotificationRow.tsx:109
            await expect.soft(page).not.toHaveURL(/\/thong-bao$/u); // the click navigated somewhere
            await attachJson('E11_11P-A-042_notif_after.json', {
              deletedProjectId: notif.projectId,
              url: page.url(), // decides: deleted project id in the path, or another (surviving) project
              pathHasDeletedId: page.url().includes(notif.projectId),
              gateTitleCount: await page.getByText(P7_TEXT.gateTitle, { exact: true }).count(),
            });
            await expectMissingState(page, 'notification target', 'gate');
          } finally {
            const notifCleanup = await deleteSeededProject(keepApi, notif.projectId);
            expect(notifCleanup, 'cleanup: notification project').toBeNull();
          }
          await captureEvidence(page, ev('11P-A-042', 'n_notif'));
        });

        await test.step('[11P-B-016] deleted project URL never goes to /khong-co-quyen', async () => {
          const got = waitGet(page, id);
          await page.goto(ROUTES.project.settings(id));
          expect.soft((await got).status()).toBe(404); // ACC:53-62
          await expect(page.getByRole('button', { name: P7_TEXT.backToProjects, exact: true })).toBeVisible();
          expect.soft(new URL(page.url()).pathname).not.toBe(P7_TEXT.forbiddenPath);
          await captureEvidence(page, ev('11P-B-016', 'n_denied'));
        });

        await test.step('[11P-G-006] GET deleted project 404 NOT_FOUND, same code as an unknown id', async () => {
          const gone = await getStatus(api, projectPath(id));
          const unknown = await getStatus(api, projectPath(unknownProjectId()));
          expect.soft(gone.status).toBe(404);
          expect.soft(gone.code).toBe('NOT_FOUND');
          expect.soft(unknown.status).toBe(404);
          expect.soft(unknown.code).toBe(gone.code);
        });
      } finally {
        const keepCleanup = await deleteSeededProject(keepApi, keep.projectId);
        await keepApi.dispose();
        expect(keepCleanup, 'cleanup: keep project').toBeNull();
      }
    });
  });
});
