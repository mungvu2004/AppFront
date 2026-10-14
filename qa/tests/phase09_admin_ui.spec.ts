/** Phase 09 admin UI (P11): FL-9A-U1..U4 admin screens read-only / forbidden at four widths (no project membership). */
import { test } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { openAt, uiState, withRoleUi } from './support/p09/P11';

test('SCR-34 · FL-9A-U1 · viewer · read-only layout', async ({ browser }) => {
  test.setTimeout(120_000);
  await withRoleUi(browser, 'viewer', 'admin', false, async ({ page }) => {
    await test.step('[9A-F-001] banner chỉ-xem 4 khổ', async () => {
      await uiState(page, '9A-F-001', 'library_readonly', openAt(ROUTES.adminModels, (p) => p.getByText(/Vai trò của bạn chỉ xem được thư viện/u)));
    });
  });
});

test('SCR-35 · FL-9A-U2 · viewer · forbidden layout', async ({ browser }) => {
  test.setTimeout(120_000);
  await withRoleUi(browser, 'viewer', 'admin', false, async ({ page }) => {
    await test.step('[9A-F-002] Không có quyền truy cập 4 khổ', async () => {
      await uiState(
        page,
        '9A-F-002',
        'jobs_forbidden_viewer',
        openAt(ROUTES.adminTrainingJobs, (p) => p.getByRole('heading', { name: 'Không có quyền truy cập' })),
      );
    });
  });
});

test('SCR-36 · FL-9A-U3 · engineer · forbidden layout', async ({ browser }) => {
  test.setTimeout(120_000);
  await withRoleUi(browser, 'engineer', 'admin', false, async ({ page }) => {
    await test.step('[9A-F-003] Không có quyền truy cập (kỹ sư) 4 khổ', async () => {
      await uiState(
        page,
        '9A-F-003',
        'jobs_forbidden_engineer',
        openAt(ROUTES.adminTrainingJobs, (p) => p.getByRole('heading', { name: 'Không có quyền truy cập' })),
      );
    });
  });
});

test('SCR-37 · FL-9A-U4 · viewer · forbidden alert + matrix layout', async ({ browser }) => {
  test.setTimeout(120_000);
  await withRoleUi(browser, 'viewer', 'admin', false, async ({ page }) => {
    await test.step('[9A-F-004] cảnh báo + ma trận 4 khổ', async () => {
      // SCR-37 = ROUTES.adminUsers (router.tsx:392); alert text from useUserManagement.ts:141 (catalog 9A-D-025).
      await uiState(page, '9A-F-004', 'users_forbidden_matrix', openAt(ROUTES.adminUsers, (p) => p.getByText(/Vai của bạn chưa quản lý được người dùng/u)));
    });
  });
});
