/**
 * Phase 11 (QA-11 P9) — [mocked response] failures of destructive actions. The server really exists; ONLY the responses named
 * below are replaced with `page.route` (mock ratio <= 0.35 of the file's rows): DELETE /api/projects/:id (held / 500 / 403),
 * one DELETE /api/floors/:id (500), DELETE …/members/:userId (500 / 422 MEMBER_LAST_EDITOR), POST …/versions/:v/restore
 * (409 / 500), PUT …/rule-config (500). Own projects only, deleted in `finally`. Evidence `E11_<row id>_<slug>.png`.
 * Non-serial: every test owns its context.
 */
import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { captureEvidence } from './support/evidence';
import { layerPathOf } from './support/layerSeed';
import { addProjectMember, poolUser } from './support/phase03Seed';
import { withAdminProject } from './support/p03/P10';
import { p11Slot } from './support/p11/common';
import {
  DANGER,
  RS,
  VH,
  dialogOf,
  floorApiRe,
  memberApiRe,
  openSettingsTab,
  projectApiRe,
  recordWrites,
  restoreApiRe,
  ruleConfigApiRe,
  withVersionsProject,
} from './support/p11/P9';

const json = (status: number, body: Record<string, unknown>) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

/** Registers `handler` for DELETE requests whose pathname matches `re`; other methods pass through. */
async function routeMethod(page: Page, re: RegExp, method: string, handler: (route: Route) => Promise<void>): Promise<void> {
  await page.route(
    (url) => re.test(url.pathname),
    async (route) => {
      if (route.request().method() !== method) {
        await route.continue();
        return;
      }
      await handler(route);
    },
  );
}

test.describe('P11 project mocked edge', () => {
  test('SCR-08 · FL-11P-13 · admin · [mocked response] lỗi khi phá huỷ ở SCR-08', async ({ browser }) => {
    test.setTimeout(240_000);
    await withAdminProject(browser, 'p11-project-mock', 2, async ({ flow, project, api }) => {
      const { page } = flow;
      const member = await poolUser(api, 'engineer', p11Slot('project-mock'));
      await addProjectMember(api, project.projectId, member.email);
      const writes = recordWrites(page);
      let mode: 'hold' | '500' | '403' = 'hold';
      let memberMode: '500' | '422' = '500';
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await routeMethod(page, projectApiRe(project.projectId), 'DELETE', async (route) => {
        if (mode === 'hold') await gate;
        if (mode === '403') await route.fulfill(json(403, { code: 'FORBIDDEN', message: 'qa mocked 403' }));
        else await route.fulfill(json(500, { detail: 'qa mocked 500' }));
      });
      const projectStillThere = async (): Promise<void> => {
        const res = await api.get(`/api/projects/${project.projectId}`);
        expect(res.status(), 'GET /api/projects/:id after the refused delete').toBe(200);
      };
      const dialog = dialogOf(page, DANGER.projectTitle);
      const confirm = dialog.getByRole('button', { name: DANGER.projectConfirm, exact: true });

      await test.step('[11P-B-001] DELETE dự án đang chạy (giữ phản hồi): nút loading, "Để nguyên" + ô nhập disabled, Esc không đóng', async () => {
        await openSettingsTab(page, project.projectId, DANGER.tab);
        await page.getByRole('button', { name: DANGER.projectConfirm, exact: true }).click();
        await expect(dialog).toBeVisible();
        await dialog.getByLabel(DANGER.input).fill(project.name);
        await expect(confirm).toBeEnabled();
        const sent = page.waitForRequest((r) => r.method() === 'DELETE' && projectApiRe(project.projectId).test(new URL(r.url()).pathname));
        await confirm.click();
        await sent;
        await expect(confirm).toBeDisabled(); // disabled={!canConfirmDanger} while isDangerRunning (PS:183, UPS:1275)
        await expect(dialog.getByRole('button', { name: DANGER.keep, exact: true })).toBeDisabled(); // PS:176
        await expect(dialog.getByLabel(DANGER.input)).toBeDisabled(); // PS:168
        await page.keyboard.press('Escape'); // cancelDanger returns while running (UPS:1206)
        await expect(dialog).toBeVisible();
        await captureEvidence(page, 'E11_11P-B-001_delete_held.png');
        release();
      });

      await test.step('[11P-B-002] DELETE dự án 5xx: InlineAlert trong hộp, hộp mở, dự án còn, nút bật lại', async () => {
        await expect(dialog.getByText(DANGER.unknown500, { exact: true })).toBeVisible(); // UPS:1253 describeError(unknown)
        await expect(dialog).toBeVisible();
        await expect(confirm).toBeEnabled();
        await projectStillThere();
        await captureEvidence(page, 'E11_11P-B-002_delete_5xx.png');
        mode = '500';
      });

      await test.step('[11P-B-003] DELETE dự án 403 FORBIDDEN: câu quyền trong hộp, dự án còn', async () => {
        mode = '403';
        const answered = page.waitForResponse((r) => r.request().method() === 'DELETE' && r.status() === 403);
        await confirm.click();
        await answered;
        await expect(dialog.getByText(DANGER.forbidden403, { exact: true })).toBeVisible(); // UPS:1253
        await projectStillThere();
        await captureEvidence(page, 'E11_11P-B-003_delete_403.png');
        await dialog.getByRole('button', { name: DANGER.keep, exact: true }).click();
        await expect(dialog).toBeHidden();
        expect(writes.all.filter((w) => w.startsWith('DELETE /api/projects/')).length, 'only the mocked project DELETEs were sent').toBe(3);
      });

      await test.step('[11P-B-004] một DELETE tầng hỏng giữa chừng → toast attention; tầng hỏng còn trong danh sách', async () => {
        let served = 0;
        await routeMethod(page, floorApiRe, 'DELETE', async (route) => {
          served += 1;
          if (served === 1) await route.fulfill(json(500, { detail: 'qa mocked floor 500' }));
          else await route.continue();
        });
        await openSettingsTab(page, project.projectId, DANGER.tab);
        await page.getByRole('button', { name: DANGER.floorsConfirm, exact: true }).click();
        const floorsDialog = dialogOf(page, DANGER.floorsTitle);
        await expect(floorsDialog).toBeVisible();
        await floorsDialog.getByRole('button', { name: DANGER.floorsConfirm, exact: true }).click();
        await expect(page.getByRole('status').filter({ hasText: 'Đã xoá 1 tầng; còn 1 tầng chưa xoá được.' })).toBeVisible(); // UPS:1241-1243
        expect(served, 'two floor DELETEs were attempted').toBe(2);
        const floors = await api.get(`/api/projects/${project.projectId}/floors`);
        expect(floors.status()).toBe(200);
        expect(((await floors.json()) as unknown[]).length, 'the failed floor is still listed').toBe(1);
        await captureEvidence(page, 'E11_11P-B-004_floor_partial.png');
      });

      await test.step('[11P-B-006] DELETE member 5xx: role=alert trong hộp, hộp giữ nguyên, thành viên còn', async () => {
        await routeMethod(page, memberApiRe(project.projectId), 'DELETE', async (route) => {
          if (memberMode === '500') await route.fulfill(json(500, { detail: 'qa mocked member 500' }));
          else await route.fulfill(json(422, { code: 'MEMBER_LAST_EDITOR', message: 'qa mocked last editor' }));
        });
        await openSettingsTab(page, project.projectId, DANGER.membersTab);
        const removeButton = page.getByRole('button', { name: `Gỡ ${member.name}`, exact: true }); // UPS:1345
        await removeButton.click();
        const memberDialog = dialogOf(page, `Gỡ ${member.name} khỏi dự án?`); // UPM:267
        await expect(memberDialog).toBeVisible();
        const answered = page.waitForResponse((r) => r.request().method() === 'DELETE' && r.status() === 500 && memberApiRe(project.projectId).test(new URL(r.url()).pathname));
        await memberDialog.getByRole('button', { name: 'Gỡ', exact: true }).click(); // UPM:36
        await answered;
        await expect(memberDialog.getByRole('alert')).toHaveText(DANGER.unknown500); // MRD:122-126
        await expect(memberDialog).toBeVisible();
        await expect(removeButton).toBeAttached();
        await captureEvidence(page, 'E11_11P-B-006_member_5xx.png');
      });

      await test.step('[11P-B-007] gỡ người sửa cuối: câu MEMBER_LAST_EDITOR trong hộp, dữ liệu còn', async () => {
        memberMode = '422';
        const memberDialog = dialogOf(page, `Gỡ ${member.name} khỏi dự án?`);
        const answered = page.waitForResponse((r) => r.request().method() === 'DELETE' && r.status() === 422);
        await memberDialog.getByRole('button', { name: 'Gỡ', exact: true }).click();
        await answered;
        await expect(memberDialog.getByRole('alert')).toHaveText(DANGER.lastEditor); // UPM:35, 111-113
        await expect(page.getByRole('button', { name: `Gỡ ${member.name}`, exact: true })).toBeAttached();
        await captureEvidence(page, 'E11_11P-B-007_member_last_editor.png');
      });
    });
  });

  test('SCR-32/29 · FL-11P-14 · admin · [mocked response] lỗi phục hồi + reset luật', async ({ browser }) => {
    test.setTimeout(420_000);
    await withVersionsProject(browser, 'p11-project-mock-v', async ({ flow, api, projectId, floorId }) => {
      const { page } = flow;
      let status = 409;
      await routeMethod(page, restoreApiRe(projectId), 'POST', async (route) => {
        if (status === 409) await route.fulfill(json(409, { code: 'VERSION_CONFLICT', message: 'qa mocked conflict' })); // VHG:118-131
        else await route.fulfill(json(500, { detail: 'qa mocked restore 500' }));
      });
      const layerBefore = await api.get(layerPathOf(projectId, floorId));
      expect(layerBefore.status(), 'setup: N16 layer readable').toBe(200);
      const layerText = await layerBefore.text();
      const restoreAndConfirm = async (expected: number): Promise<void> => {
        await page.goto(ROUTES.project.versions(projectId));
        const restore = page.getByRole('button', { name: VH.restore, exact: true });
        await expect(restore).toBeEnabled();
        await restore.click();
        const answered = page.waitForResponse((r) => r.request().method() === 'POST' && restoreApiRe(projectId).test(new URL(r.url()).pathname) && r.status() === expected);
        await page.getByRole('dialog').getByRole('button', { name: VH.restoreConfirm, exact: true }).click();
        await answered;
      };

      await test.step('[11P-B-013] 409 conflict → banner nạp lại (reload), lớp tầng không đổi', async () => {
        await restoreAndConfirm(409);
        await expect(page.getByText(VH.conflictTitle, { exact: true })).toBeVisible(); // VHG:86, UVH:429-431
        await expect(page.getByRole('button', { name: VH.conflictDismiss, exact: true })).toBeVisible();
        const after = await api.get(layerPathOf(projectId, floorId));
        expect(await after.text(), 'floor layer unchanged by the refused restore').toBe(layerText);
        await captureEvidence(page, 'E11_11P-B-013_restore_conflict.png');
      });

      await test.step('[11P-B-014] 5xx → banner "Chưa phục hồi được" / "Máy chủ chưa nhận lượt phục hồi…"', async () => {
        status = 500;
        await restoreAndConfirm(500);
        await expect.soft(page.getByText(VH.failTitle, { exact: true })).toBeVisible(); // VHM:406
        await expect.soft(page.getByText(VH.failText, { exact: true })).toBeVisible(); // VHM:412
        await captureEvidence(page, 'E11_11P-B-014_restore_5xx.png');
      });

      await test.step('[11P-B-015] PUT sau reset trả 5xx: tự lưu báo lỗi, UI không giả "đã lưu"', async () => {
        await routeMethod(page, ruleConfigApiRe(projectId), 'PUT', async (route) => {
          await route.fulfill(json(500, { detail: 'qa mocked rule-config 500' }));
        });
        const loaded = page.waitForResponse((r) => r.request().method() === 'GET' && ruleConfigApiRe(projectId).test(new URL(r.url()).pathname) && r.status() === 200);
        await page.goto(ROUTES.project.ruleSettings(projectId));
        await loaded;
        await expect(page.getByRole('heading', { name: RS.heading, level: 2 })).toBeVisible();
        await page.getByRole('switch', { name: 'Bật hoặc tắt cả nhóm: hình học', exact: true }).click(); // RSG:67
        const reset = page.getByRole('button', { name: RS.restoreDefaults, exact: true }); // RS:328
        await expect(reset).toBeVisible();
        const answered = page.waitForResponse((r) => r.request().method() === 'PUT' && ruleConfigApiRe(projectId).test(new URL(r.url()).pathname) && r.status() === 500);
        await reset.click();
        await answered;
        await expect.soft(page.getByText('Chưa lưu được bộ luật của dự án này.')).toBeVisible(); // ruleSettingsGateway.ts:311
        await expect.soft(page.getByText(/^Đã lưu/u)).toHaveCount(0); // never claims "saved" (SaveIndicator.tsx:38)
        await captureEvidence(page, 'E11_11P-B-015_reset_put_5xx.png');
      });
    });
  });
});
