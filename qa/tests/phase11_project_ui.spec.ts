/**
 * Phase 11 (QA-11 P9) — UI verification of the destructive dialogs at 1920/1440/1024/768 (`DESKTOP_VIEWPORTS`).
 * FL-11P-10 SCR-08 dialogs + tab; FL-11P-11 SCR-32 restore dialogs; FL-11P-12 SCR-05 delete card, SCR-29 reset footer,
 * SCR-39 NotFound. Real stack, own projects only (deleted in `finally`). Non-serial: one context per test.
 * Evidence `U11_<row id>_<slug>_<width>.png` (support/ui-verify.ts appends the width).
 */
import { expect, test } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { captureEvidence } from './support/evidence';
import { addProjectMember, poolUser } from './support/phase03Seed';
import { deleteSeededProject } from './support/drawingSeed';
import { withAdminProject } from './support/p03/P10';
import { DESKTOP_VIEWPORTS, p11Slot } from './support/p11/common';
import {
  DANGER,
  NOT_FOUND_PATH,
  NOT_FOUND_TITLE,
  RS,
  dialogOf,
  longSlug,
  openSettingsTab,
  ruleConfigApiRe,
} from './support/p11/P9';
import { verifyUi } from './support/ui-verify';

test.describe('P11 project UI', () => {
  test('SCR-08 · FL-11P-10 · admin · 4 khổ hộp thoại phá huỷ + tab', async ({ browser }) => {
    test.setTimeout(240_000);
    await withAdminProject(browser, longSlug(), 2, async ({ flow, project, api }) => {
      const { page } = flow;
      await test.step('[11P-F-001] hộp "Xoá mọi tầng của dự án?" 4 khổ', async () => {
        const rows = await verifyUi(
          page,
          'U11_11P-F-001_delete_floors_dialog',
          async (p) => {
            await openSettingsTab(p, project.projectId, DANGER.tab);
            await p.getByRole('button', { name: DANGER.floorsConfirm, exact: true }).click(); // DZ:63
            await expect(dialogOf(p, DANGER.floorsTitle)).toBeVisible(); // PS:156
          },
          DESKTOP_VIEWPORTS,
          { fullPage: false },
        );
        expect(rows).toHaveLength(DESKTOP_VIEWPORTS.length);
        // width 480 (PS:156): the dialog box fits the narrowest viewport (768) with both buttons inside.
        const box = await dialogOf(page, DANGER.floorsTitle).boundingBox();
        expect(box, 'dialog box measured at the last width').not.toBeNull();
        expect(box?.width ?? 0).toBeLessThanOrEqual(480 + 1);
        for (const name of [DANGER.keep, DANGER.floorsConfirm]) {
          const button = await dialogOf(page, DANGER.floorsTitle).getByRole('button', { name, exact: true }).boundingBox();
          expect(button, `button "${name}" measured`).not.toBeNull();
          expect((button?.x ?? 0) + (button?.width ?? 0)).toBeLessThanOrEqual((box?.x ?? 0) + (box?.width ?? 0) + 1);
        }
      });

      await test.step('[11P-F-002] hộp "Xoá dự án này?" 4 khổ, tên dài trong hint', async () => {
        await verifyUi(
          page,
          'U11_11P-F-002_delete_project_dialog',
          async (p) => {
            await openSettingsTab(p, project.projectId, DANGER.tab);
            await p.getByRole('button', { name: DANGER.projectConfirm, exact: true }).click(); // DZ:92
            const dialog = dialogOf(p, DANGER.projectTitle); // PS:169
            await expect(dialog).toBeVisible();
            await expect(dialog.getByText(project.name, { exact: true })).toBeVisible(); // hint = tên (PS:169)
          },
          DESKTOP_VIEWPORTS,
          { fullPage: false },
        );
        expect(project.name.length, 'fixture name is long').toBeGreaterThanOrEqual(60);
        const overflow = await dialogOf(page, DANGER.projectTitle).evaluate((el) => el.scrollWidth - el.clientWidth);
        expect.soft(overflow, 'hint does not overflow the dialog horizontally').toBeLessThanOrEqual(0);
      });

      await test.step('[11P-F-003] hộp "Gỡ {name} khỏi dự án?" 4 khổ', async () => {
        const member = await poolUser(api, 'engineer', p11Slot('ui-project'));
        await addProjectMember(api, project.projectId, member.email);
        await verifyUi(
          page,
          'U11_11P-F-003_remove_member_dialog',
          async (p) => {
            await openSettingsTab(p, project.projectId, DANGER.membersTab);
            await p.getByRole('button', { name: `Gỡ ${member.name}`, exact: true }).click(); // UPS:1345 removeLabel
            await expect(dialogOf(p, `Gỡ ${member.name} khỏi dự án?`)).toBeVisible(); // UPM:267
          },
          DESKTOP_VIEWPORTS,
          { fullPage: false },
        );
        await expect(dialogOf(page, `Gỡ ${member.name} khỏi dự án?`)).toBeVisible();
      });

      await test.step('[11P-F-004] tab "Vùng nguy hiểm" 4 khổ (2 thẻ) và EmptyState "Chưa có tầng nào"', async () => {
        await verifyUi(page, 'U11_11P-F-004_danger_tab', async (p) => {
          await openSettingsTab(p, project.projectId, DANGER.tab);
          await expect(p.getByRole('button', { name: DANGER.floorsConfirm, exact: true })).toBeVisible(); // DZ:57 thẻ 1
          await expect(p.getByRole('button', { name: DANGER.projectConfirm, exact: true })).toBeVisible(); // thẻ 2
        }, DESKTOP_VIEWPORTS);
        for (const floor of project.floors) {
          const res = await api.delete(`/api/floors/${floor.id}`);
          expect(res.status(), `setup: DELETE /api/floors/${floor.id}`).toBe(200); // BE floors/router.py:38 FloorOut
        }
        await verifyUi(page, 'U11_11P-F-004_danger_tab_empty', async (p) => {
          await openSettingsTab(p, project.projectId, DANGER.tab);
          await expect(p.getByText(DANGER.emptyTitle, { exact: true })).toBeVisible(); // DZ:72
          await expect(p.getByText(DANGER.emptyText, { exact: true })).toBeVisible(); // DZ:73
        }, DESKTOP_VIEWPORTS);
      });
    });
  });

  test('SCR-05/29/39 · FL-11P-12 · admin · 4 khổ hộp xoá thẻ, footer reset, NotFound', async ({ browser }) => {
    test.setTimeout(240_000);
    await withAdminProject(browser, longSlug(), 1, async ({ flow, project, api }) => {
      const { page } = flow;

      await test.step('[11P-F-005] hộp "Xoá dự án?" 4 khổ (tên dài trong câu hậu quả)', async () => {
        await verifyUi(
          page,
          'U11_11P-F-005_dashboard_delete_dialog',
          async (p) => {
            await p.goto(ROUTES.dashboard);
            await p.getByRole('button', { name: `Tuỳ chọn cho ${project.name}`, exact: true }).click(); // PCT:97-107
            await p.getByRole('menuitem', { name: 'Xoá', exact: true }).click(); // projectMenuGroups.ts:25
            const dialog = dialogOf(p, 'Xoá dự án?'); // PD:287
            await expect(dialog).toBeVisible();
            await expect(dialog.getByText(`"${project.name}" và toàn bộ bản vẽ, mô hình liên quan sẽ bị xoá vĩnh viễn.`, { exact: true })).toBeVisible();
          },
          DESKTOP_VIEWPORTS,
          { fullPage: false },
        );
      });

      await test.step('[11P-F-007] footer sticky "Khôi phục mặc định" + toast 4 khổ', async () => {
        await verifyUi(
          page,
          'U11_11P-F-007_reset_footer',
          async (p) => {
            const loaded = p.waitForResponse((r) => r.request().method() === 'GET' && ruleConfigApiRe(project.projectId).test(new URL(r.url()).pathname) && r.status() === 200);
            await p.goto(ROUTES.project.ruleSettings(project.projectId));
            await loaded;
            await expect(p.getByRole('heading', { name: RS.heading, level: 2 })).toBeVisible();
            await p.getByRole('switch', { name: 'Bật hoặc tắt cả nhóm: hình học', exact: true }).click(); // RSG:67
            const footerButton = p.getByRole('button', { name: RS.restoreDefaults, exact: true }); // RS:328
            await expect(footerButton).toBeVisible();
            await expect(footerButton.locator('xpath=ancestor::footer[1]')).toHaveClass(/sticky/u); // RS:324 sticky bottom-0
            await footerButton.click();
            await expect(p.getByRole('status').filter({ hasText: /\S/u }).first()).toBeVisible();
          },
          DESKTOP_VIEWPORTS,
          { fullPage: false },
        );
      });

      await test.step('[11P-F-008] NotFound "Không tìm thấy trang này" 4 khổ sau khi xoá', async () => {
        const failed = await deleteSeededProject(api, project.projectId);
        expect(failed, 'project deleted before NotFound').toBeNull();
        await verifyUi(page, 'U11_11P-F-008_not_found', async (p) => {
          await p.goto(NOT_FOUND_PATH);
          await expect(p.getByRole('heading', { name: NOT_FOUND_TITLE, exact: true, level: 1 })).toBeVisible(); // NF:98
        }, DESKTOP_VIEWPORTS);
      });
    });
  });
});

