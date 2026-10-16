/**
 * Phase 09 / pack P10: admin screens SCR-34..37 x roles (viewer, engineer, anonymous, admin). Real stack, no mock.
 * Flows FL-9A-01..04 (QA-09/flows-C5.md). FL-9A-04 only asserts the self-guard copy; no write is sent to the shared admin.
 */
import { expect, test, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { permissionMatrix } from '../../src/lib/auth/permissions';
import { PERMISSION_MATRIX_ROWS } from '../../src/screens/admin/UserManagement/userManagementGateway';
import { captureEvidence } from './support/evidence';
import { recordRequests, settle, since } from './support/p09/P10';
import { attachAdminSnap } from './support/p09/adminSnap';
import { adminApi, apiAs, DESKTOP, gotoAs, roleUser, signInRole } from './support/p09/roles';

test.use({ viewport: DESKTOP });

const FORBIDDEN_TITLE = 'Không có quyền truy cập';
const LIBRARY_BANNER =
  'Vai trò của bạn chỉ xem được thư viện, nên mọi hành động sửa danh mục không hiện'; // useModelLibrary.ts:102
const TRAINING_BODY = 'Chỉ quản trị viên hệ thống xem được trang huấn luyện.'; // TrainingJobs.tsx:38
const REGISTRY_BODY = 'Chỉ quản trị viên hệ thống xem được model AI.'; // ModelRegistry.tsx:38
const USERS_ALERT =
  'Vai của bạn chưa quản lý được người dùng nên danh sách tài khoản không hiện; bảng dưới đây cho biết mỗi vai làm được những việc gì'; // useUserManagement.ts:141
const SELF_ROLE = 'Bạn không thể tự đổi vai của mình'; // useUserManagement.ts:137
const SELF_DISABLE = 'Bạn không thể tự vô hiệu hoá tài khoản của mình'; // useUserManagement.ts:138
const CREATE_JOB = 'Tạo lượt huấn luyện';
const ACTIVATE = 'Kích hoạt';
const INVITE = 'Mời người dùng';
const SEARCH_USERS = 'Tìm người dùng';
const SEARCH_MODEL = 'Tìm model'; // ModelLibraryToolbar.tsx:15
const ML_API = /^\/api\/admin\/ml\//u;
const USERS_API = /^\/api\/users$/u;
const WRITE_BUTTON = /tải lên|sửa|chỉnh|xoá|xóa/iu;
const LOG_PATTERN = /^\/api\/(admin\/ml\/|users$|library)/u;

// UserManagementTable.tsx:59 `Vai của <name>` (Select.Label sr-only)
const roleSelect = (page: Page, name?: string) =>
  page.getByRole('button', {
    name: new RegExp(name === undefined ? '^Vai của ' : `^Vai của ${name}`, 'u'),
  });

// UserManagementPermissionMatrix.tsx: one <li> per permission row, 3 sr-only labels (one per role), allowed cells draw a check mark
// The screen shows 7 rows by design (types.ts:96 'Bảy dòng'; userManagementGateway.ts:171 PERMISSION_MATRIX_ROWS), not all 10 permissionMatrix keys.
const MATRIX_ROWS = PERMISSION_MATRIX_ROWS.length;
const MATRIX_ALLOWED = PERMISSION_MATRIX_ROWS.reduce(
  (n, row) => n + Object.values(permissionMatrix[row.key]).filter(Boolean).length,
  0,
);
const matrixRows = (page: Page) => page.locator('li').filter({ has: page.locator('.sr-only') });
const focusInsideAlert = (page: Page) =>
  page.evaluate(() => document.activeElement?.closest('[role="alert"]') != null);

test('SCR-34/35/36/37 · FL-9A-01 · viewer · four admin screens read-only/forbidden', async ({
  page,
  context,
}) => {
  test.setTimeout(150_000);
  const admin = await adminApi();
  const viewer = await roleUser(admin, 'viewer', 'admin');
  await signInRole(context, viewer);
  const log = recordRequests(page, LOG_PATTERN);
  const libraryRes = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/library');
  const banner = page.getByRole('alert').filter({ hasText: LIBRARY_BANNER });
  const forbiddenHeading = page.getByRole('heading', { name: FORBIDDEN_TITLE, exact: true });
  const items = page.getByRole('table').getByRole('button');

  await test.step('[9A-D-001] viewer sees the read-only library banner', async () => {
    await page.goto(ROUTES.adminModels);
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await captureEvidence(page, '9A-D-001_viewer-library.png');
  });
  await test.step('[9A-B-001] deep link settles: no forbidden state', async () => {
    await settle(page);
    await expect.soft(forbiddenHeading).toHaveCount(0);
    await expect.soft(page.getByRole('textbox', { name: SEARCH_MODEL })).toBeVisible();
    await captureEvidence(page, '9A-B-001_viewer-library-settled.png');
  });
  await test.step('[9A-D-002] search box and at least one item', async () => {
    await expect.soft(page.getByRole('textbox', { name: SEARCH_MODEL })).toBeVisible();
    await expect.soft(items.first()).toBeVisible();
    await captureEvidence(page, '9A-D-002_viewer-library-items.png');
  });
  await test.step('[9A-D-003] no write control in the toolbar', async () => {
    await expect.soft(page.getByRole('button', { name: WRITE_BUTTON })).toHaveCount(0);
    await captureEvidence(page, '9A-D-003_viewer-library-toolbar.png');
  });
  await test.step('[9A-G-001] GET /api/library is 200', async () => {
    expect.soft(log.urls()).toContain('GET /api/library');
    expect.soft((await libraryRes).status()).toBe(200);
    await captureEvidence(page, '9A-G-001_viewer-library-200.png');
  });
  await test.step('[9A-E-001] banner is role=alert, focus stays outside it', async () => {
    await expect.soft(banner).toBeVisible();
    expect.soft(await focusInsideAlert(page)).toBe(false);
    await captureEvidence(page, '9A-E-001_viewer-library-alert.png');
  });
  await test.step('[9A-D-004] Enter on the first item opens detail without write actions', async () => {
    await items.first().focus();
    await page.keyboard.press('Enter');
    const detail = page.getByLabel('Chi tiết model', { exact: true }); // ModelLibraryDetail.tsx:293
    await expect.soft(detail).toBeVisible();
    await expect.soft(detail.getByRole('button', { name: WRITE_BUTTON })).toHaveCount(0);
    await captureEvidence(page, '9A-D-004_viewer-library-detail.png');
  });

  const jobsMark = log.urls().length;
  await test.step('[9A-D-010] training jobs: forbidden heading', async () => {
    await page.goto(ROUTES.adminTrainingJobs);
    await expect(forbiddenHeading).toBeVisible({ timeout: 15_000 });
    await captureEvidence(page, '9A-D-010_viewer-jobs-forbidden.png');
  });
  await test.step('[9A-D-011] training jobs: body copy', async () => {
    await expect.soft(page.getByText(TRAINING_BODY, { exact: true })).toBeVisible();
    await captureEvidence(page, '9A-D-011_viewer-jobs-body.png');
  });
  await test.step('[9A-D-012] training jobs: no create button, tabs or filters', async () => {
    await expect.soft(page.getByRole('button', { name: CREATE_JOB })).toHaveCount(0);
    await expect.soft(page.getByRole('tablist')).toHaveCount(0);
    await expect.soft(page.getByRole('combobox')).toHaveCount(0);
    await captureEvidence(page, '9A-D-012_viewer-jobs-no-actions.png');
  });
  await test.step('[9A-E-002] forbidden empty state: one heading, nothing focusable inside', async () => {
    await expect.soft(forbiddenHeading).toHaveCount(1);
    const box = page.getByRole('main').locator('div', { has: forbiddenHeading }).last();
    await expect.soft(box.getByRole('button')).toHaveCount(0);
    await expect.soft(box.getByRole('link')).toHaveCount(0);
    await captureEvidence(page, '9A-E-002_viewer-jobs-empty-state.png');
  });
  await test.step('[9A-G-002] no /api/admin/ml/* request on training jobs', async () => {
    await settle(page);
    expect.soft(since(log.urls(), jobsMark, ML_API)).toEqual([]);
    await captureEvidence(page, '9A-G-002_viewer-jobs-no-ml.png');
  });

  const regMark = log.urls().length;
  await test.step('[9A-D-018] model registry: forbidden heading and body', async () => {
    await page.goto(ROUTES.adminTrainingModels);
    await expect(forbiddenHeading).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(REGISTRY_BODY, { exact: true })).toBeVisible();
    await captureEvidence(page, '9A-D-018_viewer-registry-forbidden.png');
  });
  await test.step('[9A-D-019] model registry: no activate button or family select', async () => {
    await expect.soft(page.getByRole('button', { name: ACTIVATE })).toHaveCount(0);
    await expect.soft(page.getByRole('combobox')).toHaveCount(0);
    await captureEvidence(page, '9A-D-019_viewer-registry-no-actions.png');
  });
  await test.step('[9A-G-004] no /api/admin/ml/* request on model registry', async () => {
    await settle(page);
    expect.soft(since(log.urls(), regMark, ML_API)).toEqual([]);
    await captureEvidence(page, '9A-G-004_viewer-registry-no-ml.png');
  });

  const usersMark = log.urls().length;
  await test.step('[9A-D-025] users: forbidden alert', async () => {
    await page.goto(ROUTES.adminUsers);
    await expect(page.getByRole('alert').filter({ hasText: USERS_ALERT })).toBeVisible({
      timeout: 15_000,
    });
    await captureEvidence(page, '9A-D-025_viewer-users-forbidden.png');
  });
  await test.step('[9A-E-003] users alert: role=alert, focus outside', async () => {
    await expect.soft(page.getByRole('alert').filter({ hasText: USERS_ALERT })).toBeVisible();
    expect.soft(await focusInsideAlert(page)).toBe(false);
    await captureEvidence(page, '9A-E-003_viewer-users-alert.png');
  });
  await test.step('[9A-D-026] users: permission matrix, 7 rows x 3 role columns', async () => {
    expect.soft(MATRIX_ROWS).toBe(7);
    await expect.soft(matrixRows(page)).toHaveCount(MATRIX_ROWS);
    await expect.soft(matrixRows(page).first().locator('.sr-only')).toHaveCount(3);
    await expect
      .soft(page.locator('li span[aria-hidden="true"]', { hasText: '✓' }))
      .toHaveCount(MATRIX_ALLOWED);
    await captureEvidence(page, '9A-D-026_viewer-users-matrix.png');
  });
  await test.step('[9A-D-027] users: no role select and no other pool user email', async () => {
    await expect.soft(roleSelect(page)).toHaveCount(0);
    await expect.soft(page.getByText('@example.test')).toHaveCount(0);
    await captureEvidence(page, '9A-D-027_viewer-users-no-list.png');
  });
  await test.step('[9A-D-028] users: no invite button or search', async () => {
    await expect.soft(page.getByRole('button', { name: INVITE })).toHaveCount(0);
    await expect.soft(page.getByRole('textbox', { name: SEARCH_USERS })).toHaveCount(0);
    await captureEvidence(page, '9A-D-028_viewer-users-no-toolbar.png');
  });
  await test.step('[9A-G-006] no GET /api/users request', async () => {
    await settle(page);
    expect.soft(since(log.urls(), usersMark, USERS_API)).toEqual([]);
    await captureEvidence(page, '9A-G-006_viewer-users-no-get.png');
  });
});

test('SCR-34/35/36/37 · FL-9A-02 · engineer · four admin screens', async ({ page, context }) => {
  test.setTimeout(150_000);
  const admin = await adminApi();
  const engineer = await roleUser(admin, 'engineer', 'admin');
  await signInRole(context, engineer);
  const log = recordRequests(page, LOG_PATTERN);
  const libraryRes = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/library');
  const forbiddenHeading = page.getByRole('heading', { name: FORBIDDEN_TITLE, exact: true });

  await test.step('[9A-D-005] library: read-only banner', async () => {
    await page.goto(ROUTES.adminModels);
    await expect(page.getByRole('alert').filter({ hasText: LIBRARY_BANNER })).toBeVisible({
      timeout: 15_000,
    });
    await captureEvidence(page, '9A-D-005_engineer-library.png');
  });
  await test.step('[9A-D-006] library: search and a sample item visible', async () => {
    await expect.soft(page.getByRole('textbox', { name: SEARCH_MODEL })).toBeVisible();
    await expect.soft(page.getByRole('table').getByRole('button').first()).toBeVisible();
    await captureEvidence(page, '9A-D-006_engineer-library-items.png');
  });
  await test.step('[9A-G-011] GET /api/library is 200', async () => {
    expect.soft((await libraryRes).status()).toBe(200);
    await captureEvidence(page, '9A-G-011_engineer-library-200.png');
  });

  const jobsMark = log.urls().length;
  await test.step('[9A-D-013] training jobs: forbidden heading and body', async () => {
    await page.goto(ROUTES.adminTrainingJobs);
    await expect(forbiddenHeading).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(TRAINING_BODY, { exact: true })).toBeVisible();
    await captureEvidence(page, '9A-D-013_engineer-jobs-forbidden.png');
  });
  await test.step('[9A-D-014] training jobs: no create button or tabs', async () => {
    await expect.soft(page.getByRole('button', { name: CREATE_JOB })).toHaveCount(0);
    await expect.soft(page.getByRole('tablist')).toHaveCount(0);
    await captureEvidence(page, '9A-D-014_engineer-jobs-no-actions.png');
  });
  await test.step('[9A-G-003] no /api/admin/ml/* request on training jobs', async () => {
    await settle(page);
    expect.soft(since(log.urls(), jobsMark, ML_API)).toEqual([]);
    await captureEvidence(page, '9A-G-003_engineer-jobs-no-ml.png');
  });

  const regMark = log.urls().length;
  await test.step('[9A-D-020] model registry: forbidden heading and body', async () => {
    await page.goto(ROUTES.adminTrainingModels);
    await expect(forbiddenHeading).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(REGISTRY_BODY, { exact: true })).toBeVisible();
    await captureEvidence(page, '9A-D-020_engineer-registry-forbidden.png');
  });
  await test.step('[9A-D-021] model registry: no activate button or family select', async () => {
    await expect.soft(page.getByRole('button', { name: ACTIVATE })).toHaveCount(0);
    await expect.soft(page.getByRole('combobox')).toHaveCount(0);
    await captureEvidence(page, '9A-D-021_engineer-registry-no-actions.png');
  });
  await test.step('[9A-G-005] no /api/admin/ml/* request on model registry', async () => {
    await settle(page);
    expect.soft(since(log.urls(), regMark, ML_API)).toEqual([]);
    await captureEvidence(page, '9A-G-005_engineer-registry-no-ml.png');
  });

  const usersMark = log.urls().length;
  await test.step('[9A-D-029] users: forbidden alert', async () => {
    await page.goto(ROUTES.adminUsers);
    await expect(page.getByRole('alert').filter({ hasText: USERS_ALERT })).toBeVisible({
      timeout: 15_000,
    });
    await captureEvidence(page, '9A-D-029_engineer-users-forbidden.png');
  });
  await test.step('[9A-D-030] users: permission matrix visible', async () => {
    await expect.soft(matrixRows(page)).toHaveCount(MATRIX_ROWS);
    await captureEvidence(page, '9A-D-030_engineer-users-matrix.png');
  });
  await test.step('[9A-D-031] users: no list rows and no invite button', async () => {
    await expect.soft(roleSelect(page)).toHaveCount(0);
    await expect.soft(page.getByRole('row')).toHaveCount(0);
    await expect.soft(page.getByRole('button', { name: INVITE })).toHaveCount(0);
    await captureEvidence(page, '9A-D-031_engineer-users-no-list.png');
  });
  await test.step('[9A-G-007] no GET /api/users request', async () => {
    await settle(page);
    expect.soft(since(log.urls(), usersMark, USERS_API)).toEqual([]);
    await captureEvidence(page, '9A-G-007_engineer-users-no-get.png');
  });
});

test('SCR-34/35/36/37 · FL-9A-03 · anonymous · four routes redirect to login', async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();
  try {
    const gotoLogin = async (id: string, path: string, encoded: string): Promise<void> => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encoded}$`, 'u'));
      await captureEvidence(page, `${id}_anon-login.png`);
    };
    await test.step('[9A-D-008] anonymous /admin/models redirects to login', async () => {
      await gotoLogin('9A-D-008', '/admin/models', '%2Fadmin%2Fmodels');
    });
    await test.step('[9A-D-016] anonymous /admin/training/jobs redirects to login', async () => {
      await gotoLogin('9A-D-016', '/admin/training/jobs', '%2Fadmin%2Ftraining%2Fjobs');
    });
    await test.step('[9A-D-023] anonymous /admin/training/models redirects to login', async () => {
      await gotoLogin('9A-D-023', '/admin/training/models', '%2Fadmin%2Ftraining%2Fmodels');
    });
    await test.step('[9A-D-035] anonymous /admin/users redirects to login', async () => {
      await gotoLogin('9A-D-035', '/admin/users', '%2Fadmin%2Fusers');
    });
  } finally {
    await context.close();
  }
});

test('SCR-34/35/36/37 · FL-9A-04 · admin · positive reference + self guards', async ({
  page,
  context,
}) => {
  test.setTimeout(150_000);
  const admin = await adminApi();
  const me = await roleUser(admin, 'admin', 'admin');
  const other = await roleUser(admin, 'viewer', 'admin');
  await signInRole(context, me);
  const forbiddenHeading = page.getByRole('heading', { name: FORBIDDEN_TITLE, exact: true });
  const ownRow = page.getByRole('row').filter({ hasText: me.email });
  const mlLog = recordRequests(page, /^\/api\/admin\/ml\//u);

  await test.step('[9A-D-007] library: no read-only banner, list visible', async () => {
    await page.goto(ROUTES.adminModels);
    await expect(page.getByRole('textbox', { name: SEARCH_MODEL })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(LIBRARY_BANNER)).toHaveCount(0);
    await captureEvidence(page, '9A-D-007_admin-library.png');
  });
  await test.step('[9A-D-015] training jobs: create button and tabs', async () => {
    await page.goto(ROUTES.adminTrainingJobs);
    await expect
      .soft(page.getByRole('button', { name: CREATE_JOB }))
      .toBeVisible({ timeout: 15_000 });
    await expect
      .soft(page.getByRole('tablist', { name: 'Phần của trang huấn luyện' }))
      .toBeVisible();
    await expect.soft(forbiddenHeading).toHaveCount(0);
    await captureEvidence(page, '9A-D-015_admin-jobs.png');
  });
  await test.step('[9A-D-024] model registry: family select visible', async () => {
    await page.goto(ROUTES.adminTrainingModels);
    // ModelRegistry.tsx:188 SegmentedControl aria-label TEXT.familyPicker 'Họ model' (role=radiogroup)
    await expect
      .soft(page.getByRole('radiogroup', { name: 'Họ model' }))
      .toBeVisible({ timeout: 15_000 });
    await expect.soft(forbiddenHeading).toHaveCount(0);
    await captureEvidence(page, '9A-D-024_admin-registry.png');
  });
  await test.step('[9A-D-022] version table: activate button present (not clicked)', async () => {
    await settle(page);
    await attachAdminSnap(page, 'E09_9A-D-022_registry.json', mlLog.urls());
    await expect.soft(page.getByRole('button', { name: ACTIVATE }).first()).toBeVisible();
    await captureEvidence(page, '9A-D-022_admin-registry-activate.png');
  });
  await test.step('[9A-D-032] users: own row shows role reason, no role select', async () => {
    await page.goto(ROUTES.adminUsers);
    await expect(ownRow).toBeVisible({ timeout: 15_000 });
    await expect(ownRow.getByText(SELF_ROLE)).toBeVisible();
    await expect(roleSelect(page, me.name)).toHaveCount(0);
    await captureEvidence(page, '9A-D-032_admin-self-role.png');
  });
  await test.step('[9A-D-033] users: own row shows disable reason', async () => {
    await expect.soft(ownRow.getByText(SELF_DISABLE)).toBeVisible();
    await captureEvidence(page, '9A-D-033_admin-self-disable.png');
  });
  await test.step('[9A-E-004] self-guard reasons are visible text, not only disabled controls', async () => {
    await expect.soft(ownRow.getByText(SELF_ROLE)).toBeVisible();
    await expect.soft(ownRow.getByText(SELF_DISABLE)).toBeVisible();
    await captureEvidence(page, '9A-E-004_admin-self-text.png');
  });
  await test.step('[9A-D-034] other user row has an enabled role select (not changed)', async () => {
    await expect.soft(page.getByRole('row').filter({ hasText: other.email })).toBeVisible();
    await expect.soft(roleSelect(page, other.name)).toBeEnabled();
    await captureEvidence(page, '9A-D-034_admin-other-role.png');
  });
  // own pool admin: if the BE guard breaks, only this user is demoted/disabled, never the shared admin
  const selfUser = await roleUser(admin, 'admin', 'admin-self');
  const meApi = await apiAs(selfUser);
  try {
    await test.step('[9A-G-008] PATCH own role is rejected 422 USER_SELF_MODIFICATION', async () => {
      const res = await meApi.patch(`/api/users/${selfUser.id}/role`, {
        data: { role: 'engineer', userId: selfUser.id },
      });
      expect.soft(res.status()).toBe(422);
      expect.soft(((await res.json()) as { code?: string }).code).toBe('USER_SELF_MODIFICATION');
      // GET /api/me has no role (me/schemas.py:21); the role is read from #38 (users/schemas.py:20-39)
      const list = (await (await admin.get('/api/users')).json()) as { users: { id: string; role: string }[] };
      expect.soft(list.users.find((u) => u.id === selfUser.id)?.role).toBe('admin');
      await captureEvidence(page, '9A-G-008_admin-self-role-422.png');
    });
    await test.step('[9A-G-009] POST disable on self is rejected 422 USER_SELF_MODIFICATION', async () => {
      const res = await meApi.post(`/api/users/${selfUser.id}/disable`, { data: {} });
      expect.soft(res.status()).toBe(422);
      expect.soft(((await res.json()) as { code?: string }).code).toBe('USER_SELF_MODIFICATION');
      expect.soft((await meApi.get('/api/me')).status()).toBe(200);
      await captureEvidence(page, '9A-G-009_admin-self-disable-422.png');
    });
  } finally {
    // restore if a request slipped through (BE router: users/router.py PATCH role, POST enable)
    const roleBack = await admin.patch(`/api/users/${selfUser.id}/role`, {
      data: { role: 'admin', userId: selfUser.id },
    });
    expect(roleBack.status()).toBe(200);
    const enableBack = await admin.post(`/api/users/${selfUser.id}/enable`, { data: {} });
    expect(enableBack.status()).toBe(200);
    await meApi.dispose();
    await admin.dispose();
  }
});
