/** Phase 09 shell UI (P11): FL-9P-U1 viewer + FL-9P-U2 non-member viewer, four widths via verifyUi. */
import { expect, test, type Page } from '@playwright/test';

import { ROUTES, UNKNOWN_PATH } from '../../e2e/fixtures/routes';
import { apiAs } from './support/p09/roles';
import { openAt, uiState, withRoleUi } from './support/p09/P11';

test('SCR-05 · FL-9P-U1 · viewer · bốn khổ', async ({ browser }) => {
  test.setTimeout(240_000);
  await withRoleUi(browser, 'viewer', 'ui-shell', true, async ({ page, projectId }) => {
    await test.step('[9P-F-001] dashboard forbidden: dòng vai + danh sách', async () => {
      await uiState(page, '9P-F-001', 'dashboard_viewer', openAt(ROUTES.dashboard, (p) => p.getByText(/Vai người xem/u)), true);
    });
    await test.step('[9P-F-101] /onboarding một thẻ', async () => {
      await uiState(page, '9P-F-101', 'onboarding_viewer', openAt(ROUTES.onboarding, (p) => p.getByText('Vai người xem chỉ duyệt được kết quả, không tạo dự án và không tải bản vẽ.')));
    });
    await test.step('[9P-F-201] settings chỉ-đọc: Chung và Thành viên', async () => {
      const tab =
        (name: string) =>
        async (p: Page): Promise<void> => {
          await openAt(ROUTES.project.settings(projectId), (p) => p.getByText(/Vai hiện tại chỉ xem được cài đặt/u))(p);
          // Narrow widths (768) collapse the tab list into the 'Nhóm cài đặt' combobox (ProjectSettings.tsx:114, test :479); vi.json:304.
          const tabBtn = p.getByRole('tab', { name });
          const group = p.getByRole('combobox', { name: 'Nhóm cài đặt' });
          // The read-only line renders before the tab list: wait for whichever control exists, then branch (never count() on a first paint).
          await expect(tabBtn.or(group).first()).toBeVisible();
          if (await tabBtn.count()) {
            await tabBtn.click();
          } else {
            await group.click();
            await p.getByRole('option', { name }).click();
          }
          await expect(p.getByText(/Vai hiện tại chỉ xem được cài đặt/u).first()).toBeVisible();
        };
      await uiState(page, '9P-F-201', 'settings_general', tab('Chung'));
      await uiState(page, '9P-F-201', 'settings_members', tab('Thành viên'));
    });
    await test.step('[9P-F-301] AccessDenied (viewer) + NotFound (chưa đăng nhập)', async () => {
      await uiState(page, '9P-F-301', 'access_denied', openAt(ROUTES.accessDenied, (p) => p.getByText(/Bạn chưa có quyền truy cập/u)));
      const anon = await browser.newContext();
      try {
        await uiState(await anon.newPage(), '9P-F-301', 'not_found_anon', openAt(UNKNOWN_PATH, (p) => p.getByText(/Nội dung này có thể đã bị xoá, hoặc đường dẫn chưa đúng/u)));
      } finally {
        await anon.close();
      }
    });
  });
});

test('SCR-05 · FL-9P-U2 · viewer chưa thành viên · bốn khổ', async ({ browser }) => {
  test.setTimeout(120_000);
  await withRoleUi(browser, 'viewer', 'ui-shell-nm', false, async ({ page, user }) => {
    await test.step('[9P-F-002] / empty không nút tạo', async () => {
      // precondition: no leftover membership from a crashed run
      const summaries = await (await apiAs(user)).get('/api/project-summaries');
      expect(summaries.status()).toBe(200);
      const body = (await summaries.json()) as unknown;
      const rows = Array.isArray(body) ? body : ((body as { items?: unknown[] }).items ?? []);
      expect(rows, 'slot ui-shell-nm must belong to no project').toEqual([]);
      await uiState(page, '9P-F-002', 'dashboard_empty_viewer', openAt(ROUTES.dashboard, (p) => p.getByText('Chưa có dự án nào'), ['Dự án mới']), true);
    });
  });
});
