/**
 * Phase 11 · P6 — project destructive edges (QA-11, flows-C2 FL-11P-01 / 02 / 06). Real stack, own projects only.
 * Each flow = one test on its own `withAdminProject` (fresh admin session, project deleted in `finally`).
 * Source: DZ DangerZoneTab.tsx, PS ProjectSettings.tsx, UPS useProjectSettings.ts, PD ProjectDashboard.tsx,
 * UPD useProjectDashboard.ts, undoTicket.ts (all under src/screens/... or src/lib/mutations/).
 */
import { expect, test } from '@playwright/test';
import type { Locator, Response } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { captureEvidence } from './support/evidence';
import { deleteSeededProject } from './support/drawingSeed';
import { withAdminProject } from './support/p03/P10';
import { createProject } from './support/phase03Seed';
import {
  DANGER,
  DASH,
  UNDO_WINDOW_MS,
  createViaWizard,
  dangerTab,
  dashProjectCard,
  deletesOf,
  isDeleteProject,
  openCardDelete,
  recordWrites,
  settle,
  swapCase,
} from './support/p11/P6';
import { TEST_DATA_PREFIX } from './support/evidence';

const pathOf = (response: Response): string => new URL(response.url()).pathname;
const E = (id: string, slug: string): string => `E11_${id}_${slug}.png`;

test.describe('Phase 11 P6 project edge', () => {
  test('SCR-08 · FL-11P-01 · admin · Vùng nguy hiểm: xoá mọi tầng', async ({ browser }) => {
    test.setTimeout(120_000);
    await withAdminProject(browser, 'p11-project-floors', 2, async ({ flow, project, api }) => {
      const { page } = flow;
      const writes = recordWrites(page);
      const deleted: { id: string; status: number }[] = [];
      page.on('response', (response) => {
        const match = /^\/api\/floors\/([^/]+)$/u.exec(pathOf(response));
        if (response.request().method() === 'DELETE' && match?.[1] !== undefined) deleted.push({ id: match[1], status: response.status() });
      });
      await page.goto(ROUTES.project.settings(project.projectId));
      await dangerTab(page).click();
      const openButton = page.getByRole('button', { name: DANGER.allFloors, exact: true });
      const dialog = page.getByRole('dialog', { name: DANGER.allFloorsDialog, exact: true });

      await test.step('[11P-E-001] hộp "Xoá mọi tầng của dự án?": focus-trap, Esc, focus về nút', async () => {
        await openButton.click(); // DZ:61-70
        await expect(dialog).toBeVisible();
        const inside = (): Promise<boolean> =>
          page.evaluate(() => {
            const box = document.querySelector('[role="dialog"]');
            return box !== null && box.contains(document.activeElement);
          });
        await expect.poll(inside).toBe(true);
        for (let i = 0; i < 4; i += 1) {
          await page.keyboard.press('Tab');
          expect(await inside(), `Tab #${String(i + 1)} stays in the dialog`).toBe(true);
        }
        await captureEvidence(page, E('11P-E-001', 'all_floors_dialog'));
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        await expect(openButton).toBeFocused();
        expect(deletesOf(writes, /^\/api\//u)).toHaveLength(0);
      });

      await test.step('[11P-G-002] mỗi tầng DELETE /api/floors/:id 2xx; tầng đã xoá → GET 404', async () => {
        await openButton.click();
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', { name: DANGER.allFloors, exact: true }).click();
        await expect.poll(() => deleted.length).toBe(project.floors.length);
        await expect(dialog).toBeHidden();
        for (const floor of project.floors) {
          const entry = deleted.find((d) => d.id === floor.id);
          expect.soft(entry?.status ?? 0, `DELETE /api/floors/${floor.id}`).toBe(200); // oracle: apps/api/floors/router.py:38, projects/router.py:80 (200 + body)
          // UNKNOWN (settled): project-scoped GET path /api/projects/:id/floors/:fid
          const gone = await api.get(`/api/projects/${project.projectId}/floors/${floor.id}`);
          expect.soft(gone.status(), `GET floor ${floor.id} after delete`).toBe(404);
        }
        await captureEvidence(page, E('11P-G-002', 'floors_deleted'));
      });

      await test.step('[11P-A-005] sau xoá: floors = [], EmptyState, thẻ biến mất, dự án còn', async () => {
        const list = await api.get(`/api/projects/${project.projectId}/floors`);
        expect.soft(list.status()).toBe(200);
        expect.soft(await list.json()).toEqual([]);
        await expect.soft(page.getByText(DANGER.emptyTitle, { exact: true })).toBeVisible();
        await expect.soft(page.getByText(DANGER.emptyText, { exact: true })).toBeVisible();
        await expect.soft(page.getByRole('button', { name: DANGER.allFloors, exact: true })).toHaveCount(0);
        expect.soft((await api.get(`/api/projects/${project.projectId}`)).status()).toBe(200);
        await captureEvidence(page, E('11P-A-005', 'empty_state'));
      });

      await test.step('[11P-C-006] "Xoá mọi tầng" không xoá dự án: GET 200, tên còn', async () => {
        const res = await api.get(`/api/projects/${project.projectId}`);
        expect.soft(res.status()).toBe(200);
        expect.soft(((await res.json()) as { name?: string }).name).toBe(project.name);
        expect.soft(deletesOf(writes, /^\/api\/projects\/[^/]+$/u)).toHaveLength(0);
        await captureEvidence(page, E('11P-C-006', 'project_kept'));
      });
    });
  });

  test('SCR-08 · FL-11P-02 · admin · xoá dự án gõ tên + hậu quả', async ({ browser }) => {
    test.setTimeout(120_000);
    await withAdminProject(browser, 'p11-project-del', 2, async ({ flow, project, api }) => {
      const { page } = flow;
      const id = project.projectId;
      const keep = await createProject(api, 'p11-project-keep', 1);
      try {
        const writes = recordWrites(page);
        await page.goto(ROUTES.project.settings(id));
        await dangerTab(page).click();
        const dialog = page.getByRole('dialog', { name: DANGER.projectDialog, exact: true });
        const typed = dialog.getByLabel(DANGER.typedLabel);
        const confirm = dialog.getByRole('button', { name: DANGER.project, exact: true });
        const open = async (): Promise<void> => {
          await page.getByRole('button', { name: DANGER.project, exact: true }).click(); // DZ:99-108
          await expect(dialog).toBeVisible();
        };

        await test.step('[11P-A-007] Esc / "Để nguyên" khi tên đã gõ đúng: 0 DELETE, mở lại ô rỗng', async () => {
          await open();
          await typed.fill(project.name);
          await page.keyboard.press('Escape');
          await expect(dialog).toBeHidden();
          await open();
          await expect(typed).toHaveValue(''); // UPS:1198-1203
          await typed.fill(project.name);
          await dialog.getByRole('button', { name: DANGER.keep, exact: true }).click();
          await expect(dialog).toBeHidden();
          expect(deletesOf(writes, /^\/api\/projects/u)).toHaveLength(0);
          expect((await api.get(`/api/projects/${id}`)).status()).toBe(200);
          await open();
          await expect(typed).toHaveValue('');
          await captureEvidence(page, E('11P-A-007', 'cancel_reopen_empty'));
        });

        await test.step('[11P-C-001] khoảng trắng đầu-cuối vẫn mở khoá', async () => {
          await typed.fill(`  ${project.name}  `);
          await expect.soft(confirm).toBeEnabled(); // UPS:1274 trim both sides
          await captureEvidence(page, E('11P-C-001', 'trim_enabled'));
        });

        await test.step('[11P-C-002] khác hoa/thường → vẫn khoá', async () => {
          const swapped = swapCase(project.name);
          expect(swapped).not.toBe(project.name);
          await typed.fill(swapped);
          await expect.soft(confirm).toBeDisabled();
          await captureEvidence(page, E('11P-C-002', 'case_locked'));
        });

        await test.step('[11P-C-003] Enter khi nút khoá: 0 DELETE, hộp còn mở', async () => {
          await typed.press('Enter');
          await settle(page); // no request to wait for: two frames after the key is the settle point
          await expect.soft(dialog).toBeVisible();
          expect.soft(deletesOf(writes, /^\/api\//u)).toHaveLength(0);
          await captureEvidence(page, E('11P-C-003', 'enter_locked'));
        });

        await test.step('[11P-E-004] nút khoá: Tab bỏ qua, Enter/Space không gửi', async () => {
          await expect.soft(confirm).toBeDisabled(); // PS:182
          await typed.focus();
          await page.keyboard.press('Tab');
          await expect.soft(confirm).not.toBeFocused();
          await page.keyboard.press('Enter');
          await page.keyboard.press('Space');
          await settle(page);
          expect.soft(deletesOf(writes, /^\/api\//u)).toHaveLength(0);
          await captureEvidence(page, E('11P-E-004', 'locked_keys'));
        });

        let deleteStatus = 0;
        await test.step('[11P-C-004] bấm đúp "Xoá dự án" → đúng 1 DELETE', async () => {
          await typed.fill(project.name);
          await expect(confirm).toBeEnabled();
          const removed = page.waitForResponse((r) => isDeleteProject(id)(r));
          await confirm.dblclick();
          deleteStatus = (await removed).status();
          await expect(dialog).toBeHidden();
          expect.soft(deletesOf(writes, /^\/api\/projects\/[^/]+$/u)).toHaveLength(1);
          await captureEvidence(page, E('11P-C-004', 'double_click_one_delete'));
        });

        await test.step('[11P-C-005] DELETE đúng method/path, không body, 2xx, không DELETE tầng lẻ', async () => {
          const projectDeletes = deletesOf(writes, /^\/api\/projects\/[^/]+$/u);
          expect.soft(projectDeletes.map((e) => e.path)).toEqual([`/api/projects/${id}`]);
          expect.soft(projectDeletes[0]?.body ?? null).toBeNull();
          expect.soft(deleteStatus).toBe(200); // oracle: apps/api/floors/router.py:38, projects/router.py:80 (200 + body)
          expect.soft(deletesOf(writes, /^\/api\/floors\//u)).toHaveLength(0);
          await captureEvidence(page, E('11P-C-005', 'delete_request'));
        });

        await test.step('[11P-A-009] sau xoá: GET 404 NOT_FOUND, "/" không còn thẻ, danh sách không chứa id', async () => {
          const gone = await api.get(`/api/projects/${id}`);
          expect.soft(gone.status()).toBe(404);
          expect.soft(((await gone.json()) as { code?: string }).code).toBe('NOT_FOUND');
          await page.goto(ROUTES.dashboard);
          await expect(page.getByRole('heading', { name: DASH.heading, level: 1 })).toBeVisible();
          await expect(dashProjectCard(page, keep.name)).toBeVisible();
          await expect.soft(page.getByText(project.name, { exact: true })).toHaveCount(0);
          const list = await api.get('/api/projects');
          expect.soft(JSON.stringify(await list.json())).not.toContain(id);
          await captureEvidence(page, E('11P-A-009', 'dashboard_after_delete'));
        });

        await test.step('[11P-G-001] DELETE admin 2xx; xoá lần 2 → 404', async () => {
          expect.soft(deleteStatus).toBe(200); // oracle: apps/api/floors/router.py:38, projects/router.py:80 (200 + body)
          const again = await api.delete(`/api/projects/${id}`);
          expect.soft(again.status()).toBe(404);
          expect.soft(((await again.json()) as { code?: string }).code).toBe('NOT_FOUND');
        });

        await test.step('[11P-G-003] sau xoá: GET floors và floors/:fid → 404', async () => {
          const list = await api.get(`/api/projects/${id}/floors`);
          expect.soft(list.status()).toBe(404);
          for (const floor of project.floors) {
            const one = await api.get(`/api/projects/${id}/floors/${floor.id}`);
            expect.soft(one.status(), `GET floor ${floor.id}`).toBe(404);
          }
        });
      } finally {
        expect(await deleteSeededProject(api, keep.projectId), 'cleanup keep').toBeNull();
      }
    });
  });

  test('SCR-05 · FL-11P-06 · admin · xoá từ thẻ dashboard + hoàn tác tạo', async ({ browser }) => {
    test.setTimeout(180_000);
    await withAdminProject(browser, 'p11-project-dash', 1, async ({ flow, project, api }) => {
      const { page } = flow;
      const second = await createProject(api, 'p11-project-dash2', 1);
      const extra: string[] = [];
      try {
        const writes = recordWrites(page);
        await page.goto(ROUTES.dashboard);
        await expect(dashProjectCard(page, project.name)).toBeVisible();
        const confirmButton = (dialog: Locator) => dialog.getByRole('button', { name: DASH.confirm, exact: true });

        await test.step('[11P-C-010] DELETE /api/projects/:id đúng 1 request cho 1 xác nhận (Idempotency-Key)', async () => {
          const dialog = await openCardDelete(page, project.name);
          const removed = page.waitForResponse((r) => isDeleteProject(project.projectId)(r));
          await confirmButton(dialog).click(); // PD:311
          const response = await removed;
          expect.soft(response.status()).toBe(200); // oracle: apps/api/floors/router.py:38, projects/router.py:80 (200 + body)
          await expect(dialog).toBeHidden();
          await expect(dashProjectCard(page, project.name)).toHaveCount(0);
          const sent = deletesOf(writes, /^\/api\/projects\/[^/]+$/u);
          expect.soft(sent).toHaveLength(1);
          expect.soft(sent[0]?.key ?? '', 'Idempotency-Key header').not.toBe('');
          test.info().annotations.push({ type: 'idempotency-key', description: sent[0]?.key ?? '' });
          await captureEvidence(page, E('11P-C-010', 'card_deleted'));
        });

        await test.step('[11P-B-012] DELETE 404 (đã bị xoá nơi khác): thẻ rời, hộp đóng', async () => {
          await expect(dashProjectCard(page, second.name)).toBeVisible();
          const dialog = await openCardDelete(page, second.name);
          const elsewhere = await api.delete(`/api/projects/${second.projectId}`);
          expect(elsewhere.status()).toBe(200); // oracle: apps/api/floors/router.py:38, projects/router.py:80 (200 + body)
          const removed = page.waitForResponse((r) => isDeleteProject(second.projectId)(r));
          await confirmButton(dialog).click();
          expect.soft((await removed).status()).toBe(404);
          await expect.soft(dialog).toBeHidden(); // UPD:490
          await expect.soft(dashProjectCard(page, second.name)).toHaveCount(0);
          await captureEvidence(page, E('11P-B-012', 'deleted_elsewhere'));
        });

        await test.step('[11P-A-018] tải lại "/": thẻ không còn; GET project → 404', async () => {
          await page.reload();
          await expect(page.getByRole('heading', { name: DASH.heading, level: 1 })).toBeVisible();
          await expect.soft(dashProjectCard(page, project.name)).toHaveCount(0);
          expect.soft((await api.get(`/api/projects/${project.projectId}`)).status()).toBe(404);
          await captureEvidence(page, E('11P-A-018', 'reload_gone'));
        });

        await test.step('[11P-A-019] toast tạo có "Hoàn tác": bấm → DELETE dự án mới, thẻ biến mất', async () => {
          const name = `${TEST_DATA_PREFIX}p11-project-undo-${Date.now().toString(36)}`;
          const id = await createViaWizard(page, name);
          extra.push(id);
          await expect(dashProjectCard(page, name)).toBeVisible();
          const toast = page.getByRole('status').filter({ hasText: `Đã tạo dự án "${name}".` });
          await expect(toast).toBeVisible(); // UCPM:669
          await captureEvidence(page, E('11P-A-019', 'created_toast'));
          const removed = page.waitForResponse((r) => isDeleteProject(id)(r));
          await toast.getByRole('button', { name: DASH.undo, exact: true }).click(); // PDC:25
          expect.soft((await removed).status()).toBe(200); // oracle: apps/api/floors/router.py:38, projects/router.py:80 (200 + body)
          await page.mouse.move(0, 0);
          await expect.soft(dashProjectCard(page, name)).toHaveCount(0);
          expect.soft(deletesOf(writes, /^\/api\/projects\/[^/]+$/u).filter((e) => e.path === `/api/projects/${id}`)).toHaveLength(1);
          await captureEvidence(page, E('11P-A-019', 'undone'));
        });

        await test.step('[11P-A-020] "Hoàn tác" hết hạn sau 8 s: không còn nút, không DELETE', async () => {
          await page.clock.install(); // install BEFORE the reload (new page load);: undoTicket.ts:132-138 runs on a JS setTimeout
          await page.reload();
          await expect(page.getByRole('heading', { name: DASH.heading, level: 1 })).toBeVisible();
          const name = `${TEST_DATA_PREFIX}p11-project-late-${Date.now().toString(36)}`;
          const id = await createViaWizard(page, name);
          extra.push(id);
          const toast = page.getByRole('status').filter({ hasText: `Đã tạo dự án "${name}".` });
          await expect(toast.getByRole('button', { name: DASH.undo, exact: true })).toBeVisible();
          await captureEvidence(page, E('11P-A-020', 'before_expiry'));
          await page.mouse.move(0, 0); // a hovered toast stops its clock
          await page.clock.runFor(UNDO_WINDOW_MS + 1_000); // undoTicket.ts:18
          await expect.soft(page.getByRole('button', { name: DASH.undo, exact: true })).toHaveCount(0);
          await expect.soft(dashProjectCard(page, name)).toBeVisible();
          expect.soft(writes.filter((e) => e.method === 'DELETE' && e.path === `/api/projects/${id}`)).toHaveLength(0);
          await captureEvidence(page, E('11P-A-020', 'after_expiry'));
        });
      } finally {
        expect(await deleteSeededProject(api, second.projectId), 'cleanup dash2').toBeNull();
        for (const id of extra) expect(await deleteSeededProject(api, id), 'cleanup created').toBeNull();
      }
    });
  });
});
