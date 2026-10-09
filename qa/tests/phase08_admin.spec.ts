/**
 * Phase 8: Admin, Track A (E2E-TEST-PLAN.md v2, §4 Phase 8): SCR-34 → SCR-35 → SCR-36 → SCR-37.
 *
 * Compose build at `E2E_FULLSTACK_BASE_URL`, admin from CP-1 (`E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`),
 * one shared signed-in page. No project state is needed.
 *
 * SCR-36 changes GLOBAL state (rule R2): it records `openingAndFurnitureDetection.activeVersionId`
 * in `runtime-session.json` BEFORE activating, and restores it in a `finally` of the same test,
 * the same way `e2e/fullstack/chain.fullstack.ts` step 10 does. A run that crashed with
 * `registry.pendingRestore = true` restores the recorded version first on the next run.
 *
 * Never clicked here: "Bắt đầu huấn luyện" (opt-in), "Quay về đường cổ điển" (sends versionId:null),
 * "Gửi lời mời" (sends real email), any toast "Hoàn tác".
 */
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { navigateThenWaitForApi, waitForApi, waitForApiWhere } from '../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { readAdminCredentials, signInAdmin } from './support/auth';
import { captureEvidence } from './support/evidence';
import { readState, requireState, updateState } from './support/state';

test.describe.configure({ mode: 'serial' });

const VIEWPORT = { width: 1440, height: 900 } as const;

/* ---- SCR-34 copy: ModelLibraryToolbar.tsx, ModelLibraryTable.tsx, ModelLibrary.tsx, ModelLibraryDetail.tsx ---- */
const LIBRARY_LIST_PATH = /^\/api\/library$/u;
const LIBRARY_EMPTY_TITLE = 'Chưa có model nào';
const LIBRARY_ALL_OPTION = /^Tất cả \(\d+\)$/u;

/* ---- SCR-35 copy: TrainingJobs.tsx, TrainingJobForm.tsx, TrainingJobDetail.tsx, useTrainingJobs.ts ---- */
const TRAINING_JOBS_PATH = '/api/admin/ml/training-jobs';
const TRAINING_EMPTY_TITLE = 'Chưa có lượt huấn luyện';
const TRAINING_FORM_TITLE = 'Tạo lượt huấn luyện';

/* ---- SCR-36: endpoints.ts adminMl, schemas/adminMl.ts, useModelRegistry.ts, ModelRegistry*.tsx ---- */
const FAMILIES_PATH = /^\/api\/admin\/ml\/model-families$/u;
const OPENING_FAMILY = 'openingAndFurnitureDetection';
const WALL_FAMILY = 'wallSegmentation';
const OPENING_FAMILY_LABEL = 'Nhận diện cửa và đồ đạc';
const WALL_FAMILY_LABEL = 'Tách lớp tường';
const OPENING_ACTIVE_PATH = new RegExp(`^/api/admin/ml/model-families/${OPENING_FAMILY}/active$`, 'u');
const ACTIVATE_LABEL = 'Kích hoạt';
const ACTIVE_BADGE = 'Đang dùng';
const REVERT_LABEL = 'Quay về đường cổ điển';
const BLOCKED_NOT_EVALUATED = 'Chỉ kích hoạt được bản đã đánh giá.';
const BLOCKED_FORMAT = 'Chỉ kích hoạt được bản định dạng onnx.';

/* ---- SCR-37 copy: UserManagement*.tsx, useUserManagement.ts, userManagementGateway.ts ---- */
const USERS_LIST_PATH = /^\/api\/users$/u;
const USERS_EMPTY_TITLE = 'Chưa có người dùng nào khác';
const SELF_ROLE_BLOCKED = 'Bạn không thể tự đổi vai của mình';
const SELF_DISABLE_BLOCKED = 'Bạn không thể tự vô hiệu hoá tài khoản của mình';

/* ---- Wire shapes (schemas/adminMl.ts: ModelFamilySchema, ModelVersionSchema), read minimally ---- */
interface FamilyWire {
  readonly family: string;
  readonly activeVersionId?: string;
}
interface VersionWire {
  readonly id: string;
  readonly label: string;
  readonly evaluationStatus: string;
  readonly weightsFormat: string;
}

const itemsOf = (json: unknown, what: string): unknown[] => {
  const items = (json as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) throw new Error(`${what}: body has no "items" array`);
  return items;
};

const familyRecord = (json: unknown, family: string): FamilyWire => {
  const record = (itemsOf(json, 'GET model-families') as FamilyWire[]).find((item) => item.family === family);
  if (record === undefined) throw new Error(`GET model-families: no family ${family}`);
  return record;
};

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

/* ---- Shared signed-in page (one login for the whole phase) ---- */

let context: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({ baseURL: readBaseUrl(), viewport: VIEWPORT });
  page = await context.newPage();
  await signInAdmin(page);
  // Trace starts AFTER sign-in: a trace records `fill` values, so starting earlier writes the admin
  // password into the zip in clear text (same rule as chain.fullstack.ts).
  await context.tracing.start({ screenshots: true, snapshots: true });
});

test.afterAll(async ({}, testInfo) => {
  await context.tracing.stop({ path: testInfo.outputPath('phase08-trace.zip') }).catch(() => undefined);
  await context.close();
});

/** Opens a custom `Select` (button role=combobox, portaled listbox) and picks one option. */
async function pickOption(combobox: Locator, option: string | RegExp): Promise<void> {
  await combobox.click();
  await page
    .getByRole('option', typeof option === 'string' ? { name: option, exact: true } : { name: option })
    .click();
}

/* -------------------------------------------------------------------------- */
/* SCR-34 Model Library                                                       */
/* -------------------------------------------------------------------------- */

test.describe('SCR-34 Model Library (/admin/models)', () => {
  test('SCR-34 search, category, sort "Số tam giác" (before Lưới), grid, detail + Esc, no write controls', async () => {
    await navigateThenWaitForApi(
      page,
      () => page.goto(ROUTES.adminModels, { waitUntil: 'commit' }),
      'GET',
      LIBRARY_LIST_PATH,
      [200],
    );
    const search = page.getByLabel('tìm model', { exact: true });
    const empty = page.getByText(LIBRARY_EMPTY_TITLE, { exact: true });

    await expect(search.or(empty)).toBeVisible();
    test.skip(await empty.isVisible(), 'environment: library is empty ("Chưa có model nào"), nothing to browse');

    // Admin: `canManage` → no read-only alert; `canUploadModel` is false → no upload control (G7).
    await expect(page.getByText('Vai trò của bạn chỉ xem được thư viện', { exact: false })).toHaveCount(0);

    const rows = page.locator('tbody tr');
    const firstRow = rows.first();
    const name = (await firstRow.locator('td').nth(1).innerText()).trim();
    const group = (await firstRow.locator('td').nth(2).innerText()).trim();

    // "tìm model"
    await search.fill(name);
    await expect(rows.locator('td:nth-child(2)').getByRole('button', { name, exact: true })).toBeVisible();
    await search.fill('');

    // "danh mục"
    const category = page.getByRole('combobox', { name: 'danh mục', exact: true });
    await pickOption(category, new RegExp(`^${escapeRegExp(group)} \\(\\d+\\)$`, 'u'));
    await expect
      .poll(
        async () => (await rows.locator('td:nth-child(3)').allInnerTexts()).every((text) => text.trim() === group),
        { message: `every row is in "${group}"` },
      )
      .toBe(true);
    await pickOption(category, LIBRARY_ALL_OPTION);

    // Sort BEFORE switching to Lưới (the grid has no headers).
    const triangles = page.getByRole('columnheader', { name: 'Số tam giác', exact: true });
    await expect(triangles).toHaveAttribute('aria-sort', 'none');
    await triangles.click();
    await expect(triangles).toHaveAttribute('aria-sort', 'ascending');

    // "Lưới"
    await page.getByRole('radiogroup', { name: 'Chế độ xem' }).getByRole('radio', { name: 'Lưới', exact: true }).click();
    const grid = page.getByRole('list', { name: 'lưới model' });
    await expect(grid).toBeVisible();

    // name → "Chi tiết model"
    await grid.getByRole('listitem', { name, exact: true }).click();
    const detail = page.locator('aside[aria-label="Chi tiết model"]');
    await expect(detail).toBeVisible();
    await expect(detail.getByRole('heading', { name, exact: true })).toBeVisible();

    // No write controls anywhere on the screen (G7: every ModelLibrary write is off).
    await expect(page.getByRole('button', { name: /tải lên|xoá|sửa|lưu/iu })).toHaveCount(0);
    await captureEvidence(page, '34_library_browse.png');

    await page.keyboard.press('Escape');
    await expect(detail).toHaveCount(0);
  });
});

/* -------------------------------------------------------------------------- */
/* SCR-35 Training Jobs                                                       */
/* -------------------------------------------------------------------------- */

test.describe('SCR-35 Training Jobs (/admin/training/jobs)', () => {
  test('SCR-35 tabs, status filter, row → "Chi tiết lượt huấn luyện" with "Số đo" and "Nhật ký"', async () => {
    await navigateThenWaitForApi(
      page,
      () => page.goto(ROUTES.adminTrainingJobs, { waitUntil: 'commit' }),
      'GET',
      new RegExp(`^${TRAINING_JOBS_PATH}$`, 'u'),
      [200],
    );

    const jobsTab = page.getByRole('tab', { name: 'Lượt huấn luyện', exact: true });
    const datasetsTab = page.getByRole('tab', { name: 'Bộ dữ liệu', exact: true });
    await expect(jobsTab).toHaveAttribute('aria-selected', 'true');
    await datasetsTab.click();
    await expect(datasetsTab).toHaveAttribute('aria-selected', 'true');
    await jobsTab.click();
    await expect(jobsTab).toHaveAttribute('aria-selected', 'true');

    // Status filter: refetches N32 with `status` (useTrainingJobs.ts jobFilter, adminMlJobsClient.listPage).
    const statusFilter = page.getByRole('combobox', { name: 'Lọc theo trạng thái', exact: true });
    const filtered = waitForApiWhere(page, (response) => {
      const url = new URL(response.url());
      return (
        response.request().method() === 'GET' &&
        url.pathname === TRAINING_JOBS_PATH &&
        url.searchParams.get('status') === 'succeeded' &&
        response.status() === 200
      );
    });
    await pickOption(statusFilter, 'Xong');
    await filtered;
    await expect(statusFilter).toContainText('Xong');
    await pickOption(statusFilter, 'Tất cả');
    await expect(statusFilter).toContainText('Tất cả');

    const empty = page.getByText(TRAINING_EMPTY_TITLE, { exact: true });
    const openButtons = page.locator('tbody tr button[aria-pressed]');
    await expect(empty.or(openButtons.first())).toBeVisible();

    if (await empty.isVisible()) {
      await captureEvidence(page, '35_training_browse.png');
      test.skip(true, 'environment: no training jobs, so the detail panel cannot be opened (tabs + filter passed)');
      return;
    }

    await openButtons.first().click();
    const detail = page.locator('aside[aria-label="Chi tiết lượt huấn luyện"]');
    await expect(detail).toBeVisible();
    await expect(detail.getByRole('region', { name: 'Số đo', exact: true })).toBeVisible();
    await expect(detail.getByRole('region', { name: 'Nhật ký', exact: true })).toBeVisible();
    await captureEvidence(page, '35_training_browse.png');
  });

  test('SCR-35 "Tạo lượt huấn luyện" → "Đóng": dialog opens and closes, no POST', async () => {
    const posts: string[] = [];
    const onRequest = (request: { method(): string; url(): string }): void => {
      if (request.method() === 'POST' && new URL(request.url()).pathname.startsWith('/api/')) posts.push(request.url());
    };
    page.on('request', onRequest);

    try {
      await page.getByRole('button', { name: TRAINING_FORM_TITLE, exact: true }).click();
      const dialog = page.getByRole('dialog', { name: TRAINING_FORM_TITLE });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Bắt đầu huấn luyện', exact: true })).toBeVisible();

      // "Đóng" exact: the header X is "Đóng hộp thoại" (Modal.tsx). Never "Bắt đầu huấn luyện".
      await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await captureEvidence(page, '35_training_dialog_cancel.png');
    } finally {
      page.off('request', onRequest);
    }
    expect(posts, 'no POST while opening/closing the form').toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* SCR-36 Model Registry                                                      */
/* -------------------------------------------------------------------------- */

/** The version row (chain step 10): a table row holding the label button. */
const versionRow = (label: string): Locator =>
  page.getByRole('row').filter({ has: page.getByRole('button', { name: label, exact: true }) });

/** `ActiveCard` (ModelRegistry.tsx): `<section aria-label="Đang dùng">`. */
const activeCard = (): Locator => page.getByRole('region', { name: ACTIVE_BADGE, exact: true });

/** Opens the registry and selects the opening family; returns its N23 record and N25 page. */
async function openOpeningFamily(): Promise<{ readonly family: FamilyWire; readonly versions: VersionWire[] }> {
  const familiesRead = await navigateThenWaitForApi(
    page,
    () => page.goto(ROUTES.adminTrainingModels, { waitUntil: 'commit' }),
    'GET',
    FAMILIES_PATH,
    [200],
  );
  const family = familyRecord(familiesRead.json, OPENING_FAMILY);
  const picker = page.getByRole('radiogroup', { name: 'Họ model' });
  await expect(picker).toBeVisible();

  // Registered BEFORE the click (chain step 10). The screen opens on walls, so this is a fresh read.
  const versionsRead = waitForApiWhere(
    page,
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname === '/api/admin/ml/model-versions' &&
      response.url().includes(OPENING_FAMILY) &&
      response.status() === 200,
  );
  await picker.getByRole('radio', { name: OPENING_FAMILY_LABEL, exact: true }).click();
  const versions = itemsOf((await versionsRead).json, 'GET model-versions') as VersionWire[];
  await expect(picker.getByRole('radio', { name: OPENING_FAMILY_LABEL, exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  return { family, versions };
}

/** Row "Kích hoạt" → dialog "Kích hoạt" → N24 200. Returns the PUT body (ModelFamily). */
async function activateViaUi(label: string): Promise<FamilyWire> {
  const put = waitForApi(page, 'PUT', OPENING_ACTIVE_PATH, [200]);
  await versionRow(label).getByRole('button', { name: ACTIVATE_LABEL, exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: ACTIVATE_LABEL, exact: true }).click();
  return (await put).json as FamilyWire;
}

test.describe('SCR-36 Model Registry (/admin/training/models)', () => {
  test('SCR-36 record active version, activate a candidate in "Nhận diện cửa và đồ đạc", restore in finally', async () => {
    const { family, versions } = await openOpeningFamily();
    let activeId: string | null = family.activeVersionId ?? null;

    // R2 resume: a crashed run left the opening family switched. Restore the recorded version first.
    const previous = readState().registry;
    if (previous.pendingRestore && previous.family === OPENING_FAMILY) {
      const recorded = previous.originalActiveVersionId;
      if (recorded === null) {
        throw new Error(
          'runtime-session.json: registry.pendingRestore=true with no recorded original version; ' +
            `restore ${OPENING_FAMILY} by hand, then set pendingRestore=false`,
        );
      }
      if (activeId !== recorded) {
        const recordedRow = versions.find((version) => version.id === recorded);
        if (recordedRow === undefined) throw new Error(`resume: recorded version ${recorded} is not on the first page`);
        const body = await activateViaUi(recordedRow.label);
        expect(body.activeVersionId, 'resume restore of the recorded version').toBe(recorded);
        await expect(page.getByRole('dialog')).toHaveCount(0);
        activeId = recorded;
      }
      updateState((draft) => {
        draft.registry.pendingRestore = false;
      });
    }

    // Record BEFORE any change (R2).
    updateState((draft) => {
      draft.registry.family = OPENING_FAMILY;
      draft.registry.originalActiveVersionId = activeId;
      draft.registry.pendingRestore = false;
    });

    const candidate = versions.find(
      (version) =>
        version.id !== activeId && version.evaluationStatus === 'completed' && version.weightsFormat === 'onnx',
    );

    if (candidate === undefined) {
      // CP-8 missing: assert the disabled-reason copy on every blocked row, then skip the activation.
      const blocked = versions.filter((version) => version.id !== activeId);
      for (const version of blocked) {
        const row = versionRow(version.label);
        await expect(row.getByRole('button', { name: ACTIVATE_LABEL, exact: true })).toBeDisabled();
        await expect(row).toContainText(
          version.evaluationStatus !== 'completed' ? BLOCKED_NOT_EVALUATED : BLOCKED_FORMAT,
        );
      }
      test.skip(
        true,
        `environment: CP-8 missing, ${OPENING_FAMILY} has no second evaluated onnx version ` +
          `(${String(blocked.length)} blocked row(s) checked); see e2e/fullstack/README.md precondition 7`,
      );
      return;
    }

    // Check BEFORE changing anything (chain step 10): the original must be re-activatable via the UI.
    const original = versions.find((version) => version.id === activeId);
    if (original === undefined || original.evaluationStatus !== 'completed' || original.weightsFormat !== 'onnx') {
      throw new Error(
        `${OPENING_FAMILY}: the active version (${String(activeId)}) is missing or not onnx + completed, so it ` +
          'cannot be re-activated from the UI; refusing to switch (see e2e/fullstack/README.md precondition 6)',
      );
    }

    updateState((draft) => {
      draft.registry.pendingRestore = true;
    });

    let switched = false;
    let firstError: unknown = null;

    try {
      const body = await activateViaUi(candidate.label);
      switched = true;
      expect(body.activeVersionId).toBe(candidate.id);
      await expect(page.getByRole('dialog')).toHaveCount(0);

      // "Đang dùng" moved: badge on the candidate row, the old row gets its "Kích hoạt" back, card shows the label.
      await expect(versionRow(candidate.label)).toContainText(ACTIVE_BADGE);
      await expect(versionRow(candidate.label).getByRole('button', { name: ACTIVATE_LABEL, exact: true })).toHaveCount(0);
      await expect(versionRow(original.label).getByRole('button', { name: ACTIVATE_LABEL, exact: true })).toBeEnabled();
      await expect(activeCard()).toContainText(candidate.label);
      await captureEvidence(page, '36_registry_activated.png');
    } catch (error) {
      firstError = error;
      throw error;
    } finally {
      // Mandatory restore through the same UI button, even when the steps above failed after N24.
      if (switched) {
        try {
          // A dialog still open blocks the click; Esc closes the top layer (A12), as the chain does.
          if ((await page.getByRole('dialog').count()) > 0) await page.keyboard.press('Escape');
          const restored = await activateViaUi(original.label);
          expect(restored.activeVersionId, 'restore PUT body').toBe(original.id);
          await expect(page.getByRole('dialog')).toHaveCount(0);
          updateState((draft) => {
            draft.registry.pendingRestore = false;
          });
        } catch (restoreError) {
          // Leave pendingRestore=true so the next run restores first.
          // eslint-disable-next-line no-unsafe-finally
          throw new Error(
            `RESTORE FAILED: ${OPENING_FAMILY} is still on ${candidate.id}, original ${original.id}; ` +
              `registry.pendingRestore stays true. ${String(restoreError)}` +
              (firstError === null ? '' : ` | original error: ${String(firstError)}`),
          );
        }
      }
    }
  });

  test('SCR-36 restored: active version equals the recorded id (mandatory restore)', async () => {
    const family = requireState((state) => state.registry.family, 'registry.family', 'Phase 8 SCR-36 activation row');
    expect(family).toBe(OPENING_FAMILY);
    const recorded = readState().registry.originalActiveVersionId;

    const { family: record, versions } = await openOpeningFamily();
    expect(record.activeVersionId ?? null, 'GET model-families after restore').toBe(recorded);

    if (recorded !== null) {
      const original = versions.find((version) => version.id === recorded);
      if (original === undefined) throw new Error(`recorded version ${recorded} is not on the first page`);
      await expect(versionRow(original.label)).toContainText(ACTIVE_BADGE);
      await expect(activeCard()).toContainText(original.label);
    }

    updateState((draft) => {
      draft.registry.pendingRestore = false;
    });
    await captureEvidence(page, '36_registry_restored.png');
  });

  test('SCR-36 "Quay về đường cổ điển" visible only for walls (assert only, never clicked)', async () => {
    const familiesRead = await navigateThenWaitForApi(
      page,
      () => page.goto(ROUTES.adminTrainingModels, { waitUntil: 'commit' }),
      'GET',
      FAMILIES_PATH,
      [200],
    );
    const walls = familyRecord(familiesRead.json, WALL_FAMILY);
    const picker = page.getByRole('radiogroup', { name: 'Họ model' });
    const revert = page.getByRole('button', { name: REVERT_LABEL, exact: true });

    await picker.getByRole('radio', { name: OPENING_FAMILY_LABEL, exact: true }).click();
    await expect(activeCard()).toBeVisible();
    await expect(revert).toHaveCount(0);

    await picker.getByRole('radio', { name: WALL_FAMILY_LABEL, exact: true }).click();
    await expect(picker.getByRole('radio', { name: WALL_FAMILY_LABEL, exact: true })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(activeCard()).toBeVisible();

    // `buildActiveCard`: canRevert = walls AND an active version exists.
    test.skip(
      walls.activeVersionId === undefined,
      'environment: walls family already on the classic path (no active version), so the revert button is hidden',
    );
    await expect(activeCard().getByRole('button', { name: REVERT_LABEL, exact: true })).toBeVisible();
    await captureEvidence(page, '36_registry_classic_visible.png');
  });
});

/* -------------------------------------------------------------------------- */
/* SCR-37 User Management                                                     */
/* -------------------------------------------------------------------------- */

test.describe('SCR-37 User Management (/admin/users)', () => {
  const ownRow = (): Locator => page.locator('tbody tr').filter({ hasText: readAdminCredentials().email });
  const usersEmpty = (): Locator => page.getByText(USERS_EMPTY_TITLE, { exact: true });

  test('SCR-37 search, "Vai" / "Trạng thái", permission matrix, row → "Chi tiết người dùng" + Esc', async () => {
    const { email } = readAdminCredentials();
    await navigateThenWaitForApi(
      page,
      () => page.goto(ROUTES.adminUsers, { waitUntil: 'commit' }),
      'GET',
      USERS_LIST_PATH,
      [200],
    );
    const search = page.getByLabel('Tìm người dùng', { exact: true });
    await expect(search).toBeVisible();

    // "Xem ma trận quyền", then close.
    await page.getByRole('button', { name: 'Xem ma trận quyền', exact: true }).click();
    const matrix = page.getByRole('dialog', { name: 'Ma trận quyền theo vai trò' });
    await expect(matrix).toBeVisible();
    await matrix.getByRole('button', { name: 'Đóng hộp thoại', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // `state === 'empty'` when the list holds only the signed-in admin: no table, no rows.
    test.skip(
      await usersEmpty().isVisible(),
      'environment: only the signed-in admin exists ("Chưa có người dùng nào khác"), no rows to browse',
    );

    // Filters (client-side, endpoints.ts users docblock). The admin's own row survives both.
    await search.fill(email);
    await expect(ownRow()).toHaveCount(1);
    await search.fill('');

    const role = page.getByRole('combobox', { name: 'Vai', exact: true });
    const status = page.getByRole('combobox', { name: 'Trạng thái', exact: true });
    await pickOption(role, 'quản trị');
    await pickOption(status, 'Đang hoạt động');
    await expect(ownRow()).toHaveCount(1);
    await expect(page.locator('tbody tr').filter({ hasNotText: 'Đang hoạt động' })).toHaveCount(0);

    // row name → "Chi tiết người dùng"
    await ownRow().locator('td').first().getByRole('button').click();
    const detail = page.locator('aside[aria-label="Chi tiết người dùng"]');
    await expect(detail).toBeVisible();
    await captureEvidence(page, '37_users_browse.png');

    await page.keyboard.press('Escape');
    await expect(detail).toHaveCount(0);

    await pickOption(role, 'Tất cả');
    await pickOption(status, 'Tất cả');
  });

  test('SCR-37 own row: inline self-guard text replaces role select and "Vô hiệu hoá"', async () => {
    const { email } = readAdminCredentials();
    await expect(page.getByLabel('Tìm người dùng', { exact: true })).toBeVisible();
    test.skip(await usersEmpty().isVisible(), 'environment: only the signed-in admin exists, its row is not rendered');

    await page.getByLabel('Tìm người dùng', { exact: true }).fill(email);
    const row = ownRow();
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(SELF_ROLE_BLOCKED);
    await expect(row).toContainText(SELF_DISABLE_BLOCKED);
    await expect(row.getByRole('combobox')).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'Vô hiệu hoá', exact: true })).toHaveCount(0);
    await captureEvidence(page, '37_users_self_guard.png');
    await page.getByLabel('Tìm người dùng', { exact: true }).fill('');
  });

  test('SCR-37 "Mời người dùng" → "Gửi lời mời" (opt-in)', () => {
    test.skip(true, 'opt-in: sends real email (POST /users/invitations); needs a mail sink and explicit approval');
  });
});
