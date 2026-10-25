/**
 * Phase 3 — SCR-09 Floor Manager by role (QA-03d P4, flow-plan.md "phase03_floors_roles_edge.spec.ts"). Real stack only.
 * One test per flow, one `test.step('[<row id>] …')` per catalog row.
 *
 * Source (FE @ c16f2428): FM src/screens/qc/FloorManager/FloorManager.tsx · FT …/FloorTable.tsx · FTR …/FloorTableRow.tsx
 * · FSC …/FloorSectionCut.tsx · UFM …/useFloorManager.ts (`canEdit = can('edit','layer',{roles})` with the GLOBAL roles of
 * the session; `deriveFloorManagerScreenState`: `forbidden` wins over error / empty) · PSGATE ProjectSpatialGate.tsx copy.
 * BE: project membership carries no role (project_members), so a project "viewer" is a global viewer added as member.
 *
 * Rows marked "suspected" assert the EXPECTED behaviour with `expect.soft`; a red step there is an app-bug candidate.
 *
 * Budget per run: logins 2 API (admin `signedInApi`, once per flow) + 2 browser (`signInPoolUser`, viewer / engineer);
 * `GET /api/users` 1 per `poolUser` (an invitation only when the pool slot is empty: shared viewer / shared engineer);
 * `POST /api/projects` 4 (+4 DELETE in `finally`); `POST /api/projects/:id/members` 3; real floor writes: 1 POST floors
 * by the engineer. No upload.
 */
import { expect, test, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { captureEvidence } from './support/evidence';
import { addProjectMember, createProject, deleteSeededProject, poolUser } from './support/phase03Seed';
import {
  adminApi,
  closePage,
  floorRowNames,
  floorRows,
  openPoolPage,
  unknownProjectId,
  writesSince,
  type OpenPage,
} from './support/p03/P4';

const SECTION_REGION = 'Lát cắt các tầng theo đúng tỷ lệ chiều cao'; // FSC
const FORBIDDEN_TITLE = 'Không có quyền sửa tầng'; // FM:76
const FORBIDDEN_SENTENCE = 'Vai của bạn chỉ xem được ngăn xếp tầng; mọi thao tác sửa đã được ẩn.'; // UFM:179
const SESSION_STRIP = 'Một số thay đổi chưa được lưu'; // FM:77
const CAPTION_MANUAL = 'Cao độ đang nhập tay; ô ghi "Ghi đè" khác cao độ tính từ các tầng dưới.'; // FT:83
const EMPTY_TITLE = 'Chưa có tầng nào'; // FT:75
const VIEWER_EMPTY_NOTICE = 'Khi người có quyền sửa thêm tầng, ngăn xếp tầng sẽ hiện ở đây.'; // useFloorManager.ts:182 (QA-03e BUG-522)
const NOT_FOUND_TITLE = 'Không tìm thấy dự án này'; // PSGATE:37
const BACK_TO_PROJECTS = 'Về danh sách dự án'; // PSGATE:40
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

const statusWithTitle = (page: Page, title: string) =>
  page.getByRole('status').filter({ has: page.getByRole('heading', { name: title, exact: true }) });

test.describe('SCR-09 floors — roles', () => {
  test('SCR-09 · FL-09-13 · Viewer member tries every floor action, then a 0-floor and an unknown project', async ({ browser }) => {
    test.setTimeout(120_000);
    const admin = await adminApi();
    let open: OpenPage | undefined;
    const cleanup: string[] = [];
    try {
      const project = await createProject(admin, '09-d-003', 2);
      cleanup.push(project.projectId);
      const empty = await createProject(admin, '09-d-012', 0);
      cleanup.push(empty.projectId);
      const viewer = await poolUser(admin, 'viewer');
      await addProjectMember(admin, project.projectId, viewer.email);
      await addProjectMember(admin, empty.projectId, viewer.email);
      open = await openPoolPage(browser, viewer);
      const { page, api } = open;
      const names = project.floors.map((floor) => floor.name);
      const [first, second] = names;
      if (first === undefined || second === undefined) throw new Error('seed: fewer than 2 floors');

      await page.goto(ROUTES.project.floors(project.projectId));
      await expect(floorRows(page)).toHaveCount(2);

      await test.step('[09-D-003] role=status "Không có quyền sửa tầng" with its sentence', async () => {
        const banner = statusWithTitle(page, FORBIDDEN_TITLE);
        await expect(banner).toBeVisible();
        await expect(banner).toContainText(FORBIDDEN_SENTENCE);
        await captureEvidence(page, 'E03_09-D-003_viewer_banner.png');
      });

      // QA-03e (BUG-521, FIX-2225): unsupportedNotices drops the persistFloorContents sentence without canEdit (useFloorManager.ts:1722).
      await test.step('[09-D-011] the contents strip "Một số thay đổi chưa được lưu" is not shown to a reader', async () => {
        const strip = statusWithTitle(page, SESSION_STRIP);
        await captureEvidence(page, 'E03_09-D-011_viewer_session_strip.png', {
          caption: `role=status "${SESSION_STRIP}" count: ${String(await strip.count())} (expected 0 for a viewer)`,
        });
        await expect.soft(strip, 'a viewer cannot duplicate or delete, so the contents warning does not apply').toHaveCount(0);
      });

      const mark = api.length;

      await test.step('[09-D-004] no "Thêm tầng"; a selected row still offers no "Nhân bản tầng"', async () => {
        await expect.soft(page.getByRole('button', { name: 'Thêm tầng', exact: true })).toHaveCount(0);
        await floorRows(page).first().click();
        await expect(floorRows(page).first()).toHaveAttribute('aria-selected', 'true');
        await expect.soft(page.getByRole('button', { name: 'Nhân bản tầng', exact: true })).toHaveCount(0);
      });

      await test.step('[09-D-005] name, elevation, height are plain text (no textbox)', async () => {
        await expect.soft(page.getByRole('textbox', { name: /^(Tên tầng|Cao độ tầng|Chiều cao tầng) /u })).toHaveCount(0);
        await expect.soft(page.getByRole('textbox')).toHaveCount(0);
        await expect.soft(floorRows(page).first()).toContainText(first);
      });

      await test.step('[09-D-006] no "Đổi thứ tự" / "Hành động" column, no grip, no row menu', async () => {
        await expect.soft(page.locator('thead th').filter({ hasText: /^(Đổi thứ tự|Hành động)$/u })).toHaveCount(0);
        await expect.soft(page.getByRole('button', { name: /^Đổi thứ tự tầng /u })).toHaveCount(0);
        await expect.soft(page.getByRole('button', { name: /^Thao tác khác cho tầng /u })).toHaveCount(0);
      });

      await test.step('[09-D-007] no "Tự động tính cao độ" switch; the manual caption is still shown', async () => {
        await expect.soft(page.getByRole('switch', { name: 'Tự tính cao độ', exact: true })).toHaveCount(0);
        await expect.soft(page.getByText(CAPTION_MANUAL, { exact: true })).toBeVisible();
      });

      await test.step('[09-D-008] a row without drawing reads "Chưa có bản vẽ", no "Tải lên" button', async () => {
        const row = floorRows(page).first();
        await expect.soft(row.getByText('Chưa có bản vẽ', { exact: true })).toBeVisible();
        await expect.soft(page.getByRole('button', { name: 'Tải bản vẽ', exact: true })).toHaveCount(0);
        await captureEvidence(page, 'E03_09-D-008_viewer_readonly_rows.png');
      });

      await test.step('[09-D-010] selection, band selection, hover and "Thu gọn lát cắt" / "Hiện lát cắt" still work', async () => {
        const section = page.getByRole('region', { name: SECTION_REGION, exact: true });
        await section.getByRole('button', { name: new RegExp(`^${second} · `, 'u') }).click();
        await expect.soft(page.getByRole('row', { name: new RegExp(`^${second}, cao độ `, 'u') })).toHaveAttribute('aria-selected', 'true');
        const firstRow = page.getByRole('row', { name: new RegExp(`^${first}, cao độ `, 'u') });
        await firstRow.hover();
        await expect.soft(firstRow).toHaveClass(/bg-bg-hover/u); // FTR row.isHovered
        await captureEvidence(page, 'E03_09-D-010_viewer_select_hover.png');
        await page.getByRole('button', { name: 'Thu gọn lát cắt', exact: true }).click();
        await expect.soft(section).toHaveCount(0);
        await page.getByRole('button', { name: 'Hiện lát cắt', exact: true }).click();
        await expect.soft(section).toBeVisible();
      });

      await test.step('[09-D-009] Alt+ArrowUp, synthetic dragover/drop and Mod+Z on a focused row send nothing; order unchanged', async () => {
        const secondRow = page.getByRole('row', { name: new RegExp(`^${second}, cao độ `, 'u') });
        await secondRow.focus();
        await page.keyboard.press('Alt+ArrowUp');
        await floorRows(page).first().dispatchEvent('dragover');
        await floorRows(page).first().dispatchEvent('drop');
        await secondRow.focus();
        await page.keyboard.press(`${MOD}+z`);
        await page.waitForTimeout(1_500);
        expect.soft(writesSince(api, mark), 'a viewer sends no write').toEqual([]);
        expect.soft(await floorRowNames(page)).toEqual(names);
      });

      // QA-03e (BUG-522, FIX-2226): state order error → loading → empty → forbidden (the role is only the read-only strip,
      // useFloorManager.ts:1752); a viewer's empty state reads viewerEmptyNotice (useFloorManager.ts:182) with no "Thêm tầng"
      // (FloorTable.tsx:191-199 action only when canEdit).
      await test.step('[09-D-012] viewer opens the 0-floor project → "Chưa có tầng nào" + the viewer sentence, no "Thêm tầng"', async () => {
        await page.goto(ROUTES.project.floors(empty.projectId));
        await expect(statusWithTitle(page, FORBIDDEN_TITLE)).toBeVisible();
        await captureEvidence(page, 'E03_09-D-012_viewer_empty_project.png');
        await expect.soft(page.getByText(EMPTY_TITLE, { exact: true }), 'empty state for a viewer').toBeVisible();
        await expect.soft(page.getByText(VIEWER_EMPTY_NOTICE, { exact: true })).toBeVisible();
        await expect.soft(page.getByRole('button', { name: 'Thêm tầng', exact: true })).toHaveCount(0);
      });

      // QA-03e (BUG-522): error is checked first, so a viewer gets the not-found alert + "Về danh sách dự án" (FloorTable.tsx:202-213).
      await test.step('[09-D-013] viewer opens an unknown project → "Không tìm thấy dự án này" + "Về danh sách dự án"', async () => {
        await page.goto(ROUTES.project.floors(unknownProjectId()));
        await expect(page.getByRole('heading', { name: 'Duyệt từng tầng', exact: true })).toBeVisible();
        await page.waitForTimeout(1_500); // the 404 read settles
        await captureEvidence(page, 'E03_09-D-013_viewer_unknown_project.png');
        await expect.soft(page.getByText(NOT_FOUND_TITLE, { exact: true }), 'not-found for a viewer').toBeVisible();
        await expect.soft(page.getByRole('button', { name: 'Về danh sách dự án', exact: true })).toBeVisible();
      });
    } finally {
      await closePage(open);
      for (const id of cleanup) await deleteSeededProject(admin, id);
      await admin.dispose();
    }
  });

  test('SCR-09 · FL-09-14 · Engineer: member edits, non-member gets not-found', async ({ browser }) => {
    test.setTimeout(90_000);
    const admin = await adminApi();
    let open: OpenPage | undefined;
    const cleanup: string[] = [];
    try {
      const member = await createProject(admin, '09-d-002', 2);
      cleanup.push(member.projectId);
      const other = await createProject(admin, '09-d-014', 1);
      cleanup.push(other.projectId);
      const engineer = await poolUser(admin, 'engineer');
      await addProjectMember(admin, member.projectId, engineer.email);
      open = await openPoolPage(browser, engineer);
      const { page } = open;

      await test.step('[09-D-002] member project: toolbar, inputs, grip, kebab, switch, "Tải lên" enabled; "Thêm tầng" → POST 201', async () => {
        await page.goto(ROUTES.project.floors(member.projectId));
        await expect(floorRows(page)).toHaveCount(2);
        const add = page.getByRole('button', { name: 'Thêm tầng', exact: true });
        await expect(add).toBeEnabled();
        const first = member.floors[0]?.name ?? '';
        await expect.soft(page.getByRole('textbox', { name: `Tên tầng ${first}`, exact: true })).toBeEditable();
        await expect.soft(page.getByRole('textbox', { name: `Cao độ tầng ${first}`, exact: true })).toBeEditable();
        await expect.soft(page.getByRole('textbox', { name: `Chiều cao tầng ${first}`, exact: true })).toBeEditable();
        await expect.soft(page.getByRole('button', { name: `Đổi thứ tự tầng ${first}`, exact: true })).toBeEnabled();
        await expect.soft(page.getByRole('button', { name: `Thao tác khác cho tầng ${first}`, exact: true })).toBeEnabled();
        await expect.soft(page.getByRole('switch', { name: 'Tự tính cao độ', exact: true })).toBeEnabled();
        await expect.soft(page.getByRole('button', { name: 'Tải bản vẽ', exact: true }).first()).toBeEnabled();
        await expect.soft(page.getByRole('heading', { name: FORBIDDEN_TITLE, exact: true })).toHaveCount(0);
        const post = waitForApi(page, 'POST', new RegExp(`^/api/projects/${member.projectId}/floors$`, 'u'), [201]);
        await add.click();
        await post;
        await expect(floorRows(page)).toHaveCount(3);
        await captureEvidence(page, 'E03_09-D-002_engineer_member_add.png');
      });

      await test.step('[09-D-014] non-member project → 404 → "Không tìm thấy dự án này" + "Về danh sách dự án"', async () => {
        await page.goto(ROUTES.project.floors(other.projectId));
        const alert = page.getByRole('alert').filter({ hasText: NOT_FOUND_TITLE });
        await expect.soft(alert).toBeVisible();
        await expect.soft(alert.getByRole('button', { name: BACK_TO_PROJECTS, exact: true })).toBeVisible();
        await captureEvidence(page, 'E03_09-D-014_engineer_non_member.png');
      });
    } finally {
      await closePage(open);
      for (const id of cleanup) await deleteSeededProject(admin, id);
      await admin.dispose();
    }
  });
});
