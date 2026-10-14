/**
 * Phase 8 main chain (serial, one shared signed-in admin page): FL-M-34L-01, FL-M-35T-01, FL-M-36R-01, FL-M-37U-01, FL-M-37W-01.
 * Admin from CP-1 (`E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`); runtime-session.json (`.state`) keeps the R2 record so a
 * crashed run restores the opening family on the next run, as `e2e/fullstack/chain.fullstack.ts` step 10 does.
 *
 * Global state: only FL-M-36R-01 activates a version (family openingAndFurnitureDetection); it records BEFORE and restores in `finally`.
 * Never clicked: "Bắt đầu huấn luyện", "Quay về đường cổ điển", "Gửi lời mời".
 *
 * Request budget: 1 admin login (beforeAll) + 2 adminApi logins (36R, 37U) + 0-1 invitation from the admin seed the first time
 * the shared engineer p08-eng is seeded (none afterwards).
 */
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { navigateThenWaitForApi, waitForApi, waitForApiWhere } from '../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { readAdminCredentials, signInAdmin } from './support/auth';
import { captureEvidence } from './support/evidence';
import { adminApi, recordActiveVersions, restoreActiveVersions } from './support/p08/admin';
import { poolUser } from './support/phase03Seed';
import { readState, updateState } from './support/state';

test.describe.configure({ mode: 'serial' });

const VIEWPORT = { width: 1440, height: 900 } as const;
const LIBRARY_LIST_PATH = /^\/api\/library$/u;
const TRAINING_JOBS_PATH = '/api/admin/ml/training-jobs';
const FAMILIES_PATH = /^\/api\/admin\/ml\/model-families$/u;
const OPENING_FAMILY = 'openingAndFurnitureDetection';
const OPENING_FAMILY_LABEL = 'Nhận diện cửa và đồ đạc';
const OPENING_ACTIVE_PATH = new RegExp(`^/api/admin/ml/model-families/${OPENING_FAMILY}/active$`, 'u');
const ACTIVATE_LABEL = 'Kích hoạt';
const ACTIVE_BADGE = 'Đang dùng';
const USERS_LIST_PATH = /^\/api\/users$/u;
const SELF_ROLE_BLOCKED = 'Bạn không thể tự đổi vai của mình';
const SELF_DISABLE_BLOCKED = 'Bạn không thể tự vô hiệu hoá tài khoản của mình';

interface FamilyWire {
  readonly family: string;
  readonly activeVersionId?: string;
  readonly revision: number;
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
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

let context: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({ baseURL: readBaseUrl(), viewport: VIEWPORT });
  page = await context.newPage();
  await signInAdmin(page);
  // Trace starts AFTER sign-in: a trace records `fill` values (admin password), same rule as chain.fullstack.ts.
  await context.tracing.start({ screenshots: true, snapshots: true });
});

test.afterAll(async ({}, testInfo) => {
  await context.tracing.stop({ path: testInfo.outputPath('phase08-trace.zip') });
  await context.close();
});

/** Opens a custom `Select` (button role=combobox, portaled listbox) and picks one option. */
async function pickOption(combobox: Locator, option: string | RegExp): Promise<void> {
  await combobox.click();
  await page.getByRole('option', typeof option === 'string' ? { name: option, exact: true } : { name: option }).click();
}

/* -------------------------------------------------------------------------- */
/* SCR-34                                                                     */
/* -------------------------------------------------------------------------- */

test('SCR-34 · FL-M-34L-01 · open, search, category, sort, grid, detail + Esc', async () => {
  test.setTimeout(120_000);
  const rows = page.locator('tbody tr');
  const search = page.getByLabel('tìm model', { exact: true });
  let name = '';
  let group = '';

  await test.step('[34L-A-001] open /admin/models: breadcrumb, toolbar, table', async () => {
    await navigateThenWaitForApi(page, () => page.goto(ROUTES.adminModels, { waitUntil: 'commit' }), 'GET', LIBRARY_LIST_PATH, [200]);
    await expect(page.getByRole('navigation', { name: 'Đường dẫn trang' }).getByText('Thư viện model', { exact: true })).toBeVisible();
    await expect(search).toBeVisible();
    await expect(rows.first(), 'environment: library has at least one model').toBeVisible();
    name = (await rows.first().locator('td').nth(1).innerText()).trim();
    group = (await rows.first().locator('td').nth(2).innerText()).trim();
    await captureEvidence(page, 'E08_34L-A-001_main');
  });

  await test.step('[34L-A-002] search narrows the rows', async () => {
    await search.fill(name);
    await expect.soft(rows.locator('td:nth-child(2)').getByRole('button', { name, exact: true })).toBeVisible();
    await expect.soft(search).toHaveAttribute('placeholder', 'Tìm theo tên model...');
    await captureEvidence(page, 'E08_34L-A-002_main');
    await search.fill('');
  });

  await test.step('[34L-A-003] category narrows the rows, options read "<label> (<count>)"', async () => {
    const category = page.getByRole('combobox', { name: 'danh mục', exact: true });
    await pickOption(category, new RegExp(`^${escapeRegExp(group)} \\(\\d+\\)$`, 'u'));
    await expect
      .poll(async () => (await rows.locator('td:nth-child(3)').allInnerTexts()).every((t) => t.trim() === group), { message: `every row is in "${group}"` })
      .toBe(true);
    await captureEvidence(page, 'E08_34L-A-003_main');
    await pickOption(category, /^Tất cả \(\d+\)$/u);
  });

  await test.step('[34L-A-005] "Số tam giác": ascending, then descending', async () => {
    const triangles = page.getByRole('columnheader', { name: 'Số tam giác', exact: true });
    await triangles.click();
    await expect.soft(triangles).toHaveAttribute('aria-sort', 'ascending');
    await triangles.click();
    await expect.soft(triangles).toHaveAttribute('aria-sort', 'descending');
    await captureEvidence(page, 'E08_34L-A-005_main');
  });

  await test.step('[34L-A-006] "Lưới" replaces the table with the card grid', async () => {
    await page.getByRole('radiogroup', { name: 'Chế độ xem' }).getByRole('radio', { name: 'Lưới', exact: true }).click();
    await expect.soft(page.getByRole('list', { name: 'lưới model' })).toBeVisible();
    await captureEvidence(page, 'E08_34L-A-006_main');
  });

  const detail = page.locator('aside[aria-label="Chi tiết model"]');
  await test.step('[34L-A-009] click a grid card: detail panel opens', async () => {
    await page.getByRole('list', { name: 'lưới model' }).getByRole('listitem').first().click();
    await expect.soft(detail).toBeVisible();
    await expect.soft(detail.getByRole('heading', { level: 2 })).toBeVisible();
    await captureEvidence(page, 'E08_34L-A-009_main');
  });

  await test.step('[34L-A-010] Esc closes the detail panel', async () => {
    await page.keyboard.press('Escape');
    await expect.soft(detail).toHaveCount(0);
    await captureEvidence(page, 'E08_34L-A-010_main');
  });
});

/* -------------------------------------------------------------------------- */
/* SCR-35                                                                     */
/* -------------------------------------------------------------------------- */

test('SCR-35 · FL-M-35T-01 · navigate, tabs, filters, open/close the form', async () => {
  test.setTimeout(120_000);
  const jobsTab = page.getByRole('tab', { name: 'Lượt huấn luyện', exact: true });
  const datasetsTab = page.getByRole('tab', { name: 'Bộ dữ liệu', exact: true });
  const emptyFiltered = page.getByText('Không có lượt nào khớp bộ lọc.', { exact: true });

  await test.step('[35T-A-001] open /admin/training/jobs: h1 and breadcrumb', async () => {
    await navigateThenWaitForApi(
      page,
      () => page.goto(ROUTES.adminTrainingJobs, { waitUntil: 'commit' }),
      'GET',
      new RegExp(`^${TRAINING_JOBS_PATH}$`, 'u'),
      [200],
    );
    await expect(page.getByRole('heading', { level: 1, name: 'Huấn luyện model AI', exact: true })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Đường dẫn trang' });
    await expect(nav.getByText('Quản trị', { exact: true })).toBeVisible();
    await expect(nav.getByText('Huấn luyện model', { exact: true })).toHaveAttribute('aria-current', 'page');
    await captureEvidence(page, 'E08_35T-A-001_main');
  });

  await test.step('[35T-D-001] admin sees tabs, filters and the create button', async () => {
    await expect.soft(jobsTab).toBeVisible();
    await expect.soft(datasetsTab).toBeVisible();
    await expect.soft(page.getByRole('button', { name: 'Tạo lượt huấn luyện', exact: true })).toBeVisible();
    await captureEvidence(page, 'E08_35T-D-001_main');
  });

  await test.step('[35T-A-003] tab "Bộ dữ liệu" then "Lượt huấn luyện"', async () => {
    await expect.soft(page.getByRole('tablist', { name: 'Phần của trang huấn luyện' })).toBeVisible();
    await datasetsTab.click();
    await expect.soft(datasetsTab).toHaveAttribute('aria-selected', 'true');
    await jobsTab.click();
    await expect.soft(jobsTab).toHaveAttribute('aria-selected', 'true');
    await captureEvidence(page, 'E08_35T-A-003_main');
  });

  await test.step('[35T-A-004] family filter "Tách lớp tường" sends ?family=wallSegmentation', async () => {
    const read = waitForApiWhere(
      page,
      (r) => r.request().method() === 'GET' && new URL(r.url()).pathname === TRAINING_JOBS_PATH && new URL(r.url()).searchParams.get('family') === 'wallSegmentation',
    );
    await page.getByRole('radiogroup', { name: 'Lọc theo họ' }).getByRole('radio', { name: 'Tách lớp tường', exact: true }).click();
    expect.soft((await read).response.status(), 'GET training-jobs?family=wallSegmentation').toBe(200);
    await expect.soft(emptyFiltered.or(page.locator('tbody tr').first())).toBeVisible();
    await captureEvidence(page, 'E08_35T-A-004_main');
  });

  await test.step('[35T-A-006] status filter "Đang huỷ" sends ?status=cancelling', async () => {
    const read = waitForApiWhere(
      page,
      (r) => r.request().method() === 'GET' && new URL(r.url()).pathname === TRAINING_JOBS_PATH && new URL(r.url()).searchParams.get('status') === 'cancelling',
    );
    await pickOption(page.getByRole('combobox', { name: 'Lọc theo trạng thái', exact: true }), 'Đang huỷ');
    expect.soft((await read).response.status(), 'GET training-jobs?status=cancelling').toBe(200);
    await expect.soft(emptyFiltered.or(page.locator('tbody tr').first())).toBeVisible();
    await captureEvidence(page, 'E08_35T-A-006_main');
  });

  await test.step('[35T-A-009] "Tạo lượt huấn luyện" -> "Đóng": opens, closes, no POST', async () => {
    const posts: string[] = [];
    const onRequest = (r: { method(): string; url(): string }): void => {
      if (r.method() === 'POST' && new URL(r.url()).pathname.startsWith('/api/')) posts.push(r.url());
    };
    page.on('request', onRequest);
    try {
      await page.getByRole('button', { name: 'Tạo lượt huấn luyện', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Tạo lượt huấn luyện' });
      await expect.soft(dialog).toBeVisible();
      await captureEvidence(page, 'E08_35T-A-009_main');
      // "Đóng" exact: the header X is "Đóng hộp thoại". Never "Bắt đầu huấn luyện".
      await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
      await expect.soft(page.getByRole('dialog')).toHaveCount(0); // settled point before asserting "no POST"
    } finally {
      page.off('request', onRequest);
    }
    expect.soft(posts, 'no POST while opening/closing the form').toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* SCR-36                                                                     */
/* -------------------------------------------------------------------------- */

const versionRow = (label: string): Locator => page.getByRole('row').filter({ has: page.getByRole('button', { name: label, exact: true }) });
const activeCard = (): Locator => page.getByRole('region', { name: ACTIVE_BADGE, exact: true });

async function openOpeningFamily(): Promise<{ readonly family: FamilyWire; readonly versions: VersionWire[] }> {
  const read = await navigateThenWaitForApi(page, () => page.goto(ROUTES.adminTrainingModels, { waitUntil: 'commit' }), 'GET', FAMILIES_PATH, [200]);
  const family = (itemsOf(read.json, 'GET model-families') as FamilyWire[]).find((f) => f.family === OPENING_FAMILY);
  if (family === undefined) throw new Error(`GET model-families: no family ${OPENING_FAMILY}`);
  const picker = page.getByRole('radiogroup', { name: 'Họ model' });
  await expect(picker).toBeVisible();
  const versionsRead = waitForApiWhere(
    page,
    (r) =>
      r.request().method() === 'GET' &&
      new URL(r.url()).pathname === '/api/admin/ml/model-versions' &&
      r.url().includes(OPENING_FAMILY) &&
      r.status() === 200,
  );
  await picker.getByRole('radio', { name: OPENING_FAMILY_LABEL, exact: true }).click();
  const versions = itemsOf((await versionsRead).json, 'GET model-versions') as VersionWire[];
  await expect(picker.getByRole('radio', { name: OPENING_FAMILY_LABEL, exact: true })).toHaveAttribute('aria-checked', 'true');
  return { family, versions };
}

test('SCR-36 · FL-M-36R-01 · Record, activate candidate, undo, mandatory restore', async () => {
  test.setTimeout(240_000);
  const api = await adminApi();
  const snapshot = await recordActiveVersions(api); // BEFORE anything else (R2)
  let switched = false;
  try {
    // R2 resume of a crashed run: restore the recorded version first.
    const previous = readState().registry;
    if (previous.pendingRestore && previous.family === OPENING_FAMILY && previous.originalActiveVersionId !== null) {
      await restoreActiveVersions(api, { ...snapshot, [OPENING_FAMILY]: previous.originalActiveVersionId });
    }
    const { family, versions } = await openOpeningFamily();
    const recordedId = family.activeVersionId ?? null;
    updateState((d) => {
      d.registry.family = OPENING_FAMILY;
      d.registry.originalActiveVersionId = recordedId;
      d.registry.pendingRestore = false;
    });
    const original = versions.find((v) => v.id === recordedId);
    const candidate = versions.find((v) => v.id !== recordedId && v.evaluationStatus === 'completed' && v.weightsFormat === 'onnx');
    expect(candidate, `environment: CP-8 candidate (second evaluated onnx version) exists in ${OPENING_FAMILY}`).toBeDefined();
    expect(original, `environment: active version ${String(recordedId)} is on the first page`).toBeDefined();
    if (candidate === undefined || original === undefined) return;
    updateState((d) => {
      d.registry.pendingRestore = true;
    });

    let putBody: FamilyWire = family;
    // Registered BEFORE the click: the invalidation re-read follows the PUT at once.
    const refetch = waitForApiWhere(page, (r) => r.request().method() === 'GET' && FAMILIES_PATH.test(new URL(r.url()).pathname) && r.status() === 200);
    await test.step('[36R-C-001] pick candidate, open dialog, confirm: PUT body {baseVersion, versionId}', async () => {
      const put = waitForApi(page, 'PUT', OPENING_ACTIVE_PATH, [200]);
      const sent = page.waitForRequest((r) => r.method() === 'PUT' && OPENING_ACTIVE_PATH.test(new URL(r.url()).pathname));
      await versionRow(candidate.label).getByRole('button', { name: ACTIVATE_LABEL, exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: ACTIVATE_LABEL, exact: true }).click();
      switched = true;
      const body = (await sent).postDataJSON() as { baseVersion: number; body: { versionId: string } };
      expect(body).toEqual({ baseVersion: family.revision, body: { versionId: candidate.id } });
      putBody = (await put).json as FamilyWire;
      await captureEvidence(page, 'E08_36R-C-001_main');
    });

    await test.step('[36R-A-011] PUT 200: candidate badge, no "Kích hoạt", card label = candidate', async () => {
      await expect.soft(versionRow(candidate.label)).toContainText(ACTIVE_BADGE);
      await expect.soft(versionRow(candidate.label).getByRole('button', { name: ACTIVATE_LABEL, exact: true })).toHaveCount(0);
      await expect.soft(activeCard()).toContainText(candidate.label);
      await captureEvidence(page, 'E08_36R-A-011_main');
    });

    await test.step('[36R-G-006] response: ModelFamily with activeVersionId = candidate, revision advanced', async () => {
      expect.soft(putBody.activeVersionId).toBe(candidate.id);
      expect.soft(putBody.revision).toBeGreaterThan(family.revision);
      await captureEvidence(page, 'E08_36R-G-006_main');
    });

    await test.step('[36R-A-012] dialog gone, focus on region "Đang dùng"', async () => {
      await expect.soft(page.getByRole('dialog')).toHaveCount(0);
      await expect.soft(activeCard()).toBeFocused();
      await captureEvidence(page, 'E08_36R-A-012_main');
    });

    await test.step('[36R-G-007] invalidation re-reads model-families and model-versions without reload', async () => {
      expect.soft((await refetch).response.status(), 'GET model-families re-read').toBe(200);
      await expect.soft(versionRow(candidate.label)).toContainText(ACTIVE_BADGE);
      await captureEvidence(page, 'E08_36R-G-007_main');
    });

    const toast = page.getByRole('status').filter({ hasText: 'Đã kích hoạt' });
    await test.step('[36R-A-013] toast "Đã kích hoạt {label} cho nhận diện cửa và đồ đạc" + undo action', async () => {
      await expect.soft(toast).toContainText('cho nhận diện cửa và đồ đạc');
      await expect.soft(toast).toContainText('Lượt xử lý mới dùng bản này ngay.');
      await expect.soft(toast.getByRole('button', { name: 'Hoàn tác' })).toBeVisible();
      await captureEvidence(page, 'E08_36R-A-013_main');
    });

    await test.step('[36R-E-011] toast sits inside role=status', async () => {
      await expect.soft(page.locator('[role="status"]', { hasText: 'Đã kích hoạt' })).toHaveCount(1);
      await captureEvidence(page, 'E08_36R-E-011_main');
    });

    await test.step('[36R-A-014] toast undo: PUT with the recorded id, "Đã hoàn tác lượt đổi model"', async () => {
      const put = waitForApi(page, 'PUT', OPENING_ACTIVE_PATH, [200]);
      await toast.getByRole('button', { name: 'Hoàn tác' }).click();
      const body = (await put).json as FamilyWire;
      expect.soft(body.activeVersionId ?? null).toBe(recordedId);
      await expect.soft(page.getByText('Đã hoàn tác lượt đổi model', { exact: true })).toBeVisible();
      await expect.soft(activeCard()).toContainText(original.label);
      await captureEvidence(page, 'E08_36R-A-014_main');
    });
  } finally {
    // Mandatory restore, even when a step failed after the PUT. Esc closes a dialog that would block the page (A12).
    try {
      if (switched && (await page.getByRole('dialog').count()) > 0) await page.keyboard.press('Escape');
      await restoreActiveVersions(api, snapshot);
      updateState((d) => {
        d.registry.pendingRestore = false;
      });
    } finally {
      await api.dispose();
    }
  }

  await test.step('[36R-A-015] restore verified: GET model-families activeVersionId equals the recorded id', async () => {
    const check = await adminApi();
    try {
      const after = await recordActiveVersions(check);
      expect(after[OPENING_FAMILY], 'active version after restore').toBe(snapshot[OPENING_FAMILY]);
    } finally {
      await check.dispose();
    }
    await captureEvidence(page, 'E08_36R-A-015_main');
  });
});

/* -------------------------------------------------------------------------- */
/* SCR-37                                                                     */
/* -------------------------------------------------------------------------- */

test('SCR-37 · FL-M-37U-01 · Read list + detail + matrix (admin chain)', async () => {
  test.setTimeout(120_000);
  const admin = await adminApi();
  let pe: Awaited<ReturnType<typeof poolUser>>;
  try {
    pe = await poolUser(admin, 'engineer', 'p08-eng'); // shared read-only engineer (S2 decision 1)
  } finally {
    await admin.dispose();
  }
  const search = page.getByLabel('Tìm người dùng', { exact: true });
  const peRow = page.locator('tbody tr').filter({ hasText: pe.email });
  const detail = page.locator('aside[aria-label="Chi tiết người dùng"]');

  await test.step('[37U-A-001] open /admin/users: table, breadcrumb, "Xem ma trận quyền"', async () => {
    await navigateThenWaitForApi(page, () => page.goto(ROUTES.adminUsers, { waitUntil: 'commit' }), 'GET', USERS_LIST_PATH, [200]);
    await expect(page.getByRole('navigation', { name: 'Đường dẫn trang' }).getByText('Người dùng', { exact: true })).toBeVisible();
    await expect(page.locator('tbody tr').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Xem ma trận quyền', exact: true })).toBeVisible();
    await captureEvidence(page, 'E08_37U-A-001_main');
  });

  await test.step('[37U-D-001] admin sees "Mời người dùng" and "Xem ma trận quyền"', async () => {
    await expect.soft(page.getByRole('button', { name: 'Mời người dùng', exact: true })).toBeVisible();
    await expect.soft(page.getByRole('button', { name: 'Xem ma trận quyền', exact: true })).toBeVisible();
    await captureEvidence(page, 'E08_37U-D-001_main');
  });

  await test.step('[37U-A-008] search the engineer by name: only its row', async () => {
    await search.fill(pe.name);
    await expect.soft(peRow).toHaveCount(1);
    await expect.soft(page.locator('tbody tr')).toHaveCount(1);
    await captureEvidence(page, 'E08_37U-A-008_main');
  });

  const role = page.getByRole('combobox', { name: 'Vai', exact: true });
  const status = page.getByRole('combobox', { name: 'Trạng thái', exact: true });
  await test.step('[37U-A-011] "Vai" = "Kỹ sư": only engineer rows', async () => {
    await search.fill('');
    await pickOption(role, 'Kỹ sư');
    await expect.soft(peRow).toHaveCount(1);
    await expect.soft(page.locator('tbody tr').filter({ hasText: readAdminCredentials().email })).toHaveCount(0);
    await captureEvidence(page, 'E08_37U-A-011_main');
  });

  await test.step('[37U-A-012] "Trạng thái" = "Đang hoạt động": only active rows', async () => {
    await pickOption(status, 'Đang hoạt động');
    await expect.soft(peRow).toHaveCount(1);
    await expect.soft(page.locator('tbody tr').filter({ hasNotText: 'Đang hoạt động' })).toHaveCount(0);
    await captureEvidence(page, 'E08_37U-A-012_main');
  });

  await test.step('[37U-A-015] click the engineer name: "Chi tiết người dùng" panel', async () => {
    await peRow.locator('td').first().getByRole('button').click();
    await expect.soft(detail).toBeVisible();
    await captureEvidence(page, 'E08_37U-A-015_main');
  });

  await test.step('[37U-A-018] Esc closes the panel', async () => {
    await page.keyboard.press('Escape');
    await expect.soft(detail).toHaveCount(0);
    await captureEvidence(page, 'E08_37U-A-018_main');
  });

  await test.step('[37U-A-030] "Xem ma trận quyền" opens "Ma trận quyền theo vai trò"', async () => {
    await pickOption(role, 'Tất cả');
    await pickOption(status, 'Tất cả');
    await page.getByRole('button', { name: 'Xem ma trận quyền', exact: true }).click();
    const matrix = page.getByRole('dialog', { name: 'Ma trận quyền theo vai trò' });
    await expect.soft(matrix).toBeVisible();
    await captureEvidence(page, 'E08_37U-A-030_main');
    await matrix.getByRole('button', { name: 'Đóng hộp thoại', exact: true }).click();
    await expect.soft(page.getByRole('dialog')).toHaveCount(0);
  });
});

test('SCR-37 · FL-M-37W-01 · Self-edit guard (main chain, read only)', async () => {
  test.setTimeout(60_000);
  const { email } = readAdminCredentials();
  const row = page.locator('tbody tr').filter({ hasText: email });
  await page.getByLabel('Tìm người dùng', { exact: true }).fill(email);
  await expect(row, 'own admin row').toHaveCount(1);

  await test.step('[37W-C-010] own row: no role select, blocked text', async () => {
    await expect(row).toContainText(SELF_ROLE_BLOCKED);
    await expect(row.getByRole('combobox')).toHaveCount(0);
    await captureEvidence(page, 'E08_37W-C-010_main');
  });

  await test.step('[37W-C-011] same row: no "Vô hiệu hoá", blocked text', async () => {
    await expect.soft(row).toContainText(SELF_DISABLE_BLOCKED);
    await expect.soft(row.getByRole('button', { name: 'Vô hiệu hoá', exact: true })).toHaveCount(0);
    await captureEvidence(page, 'E08_37W-C-011_main');
  });
});
