/**
 * Phase 08 UI verify of SCR-34 Model Library (skill `qa-verify-ui`): FL-34L-U1 (real) and FL-34L-U2 ([mocked response]).
 * Viewports: DESKTOP_VIEWPORTS (1920/1440/1024/768, no 375). Source: src/screens/admin/ModelLibrary/*.
 *
 * Request budget: U1 = 1 admin login + 1 engineer login (shared slot p08-eng, 0 new invitations once seeded);
 * U2 = 1 admin login. verifyUi re-opens the screen once per viewport (GET /api/library only, no writes).
 */
import { expect, test, type Page, type Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { signInAdmin } from './support/auth';
import { captureEvidence } from './support/evidence';
import { adminApi, DESKTOP_VIEWPORTS } from './support/p08/admin';
import { poolUser, signInPoolUser } from './support/p08/pool';
import { verifyUi } from './support/ui-verify';

const LIBRARY_PATH = '**/api/library';
const SEARCH = /^tìm model$/iu; // ModelLibraryToolbar.tsx:17
const CATEGORY = 'Danh mục'; // ModelLibraryToolbar.tsx:19
const NO_MATCH = 'Không tìm thấy model phù hợp.'; // ModelLibraryTable.tsx:31
const DETAIL = 'Chi tiết model'; // ModelLibraryDetail.tsx:293
const EMPTY_TITLE = 'Chưa có model nào'; // ModelLibrary.tsx:39
const ERROR_TITLE = 'Không tải được thư viện model'; // ModelLibrary.tsx:41
const HEAVY_TRIANGLES = 900_001; // > 900000 budget (flows MK)
const LONG_NAME = 'Mô hình rất dài '.repeat(8).slice(0, 120).trim().padEnd(120, 'x');

interface LibraryItem {
  readonly id: string;
  readonly name: string;
  readonly triangleCount: number;
  readonly previewUrl?: string;
  readonly [key: string]: unknown;
}

// Name buttons: table cell (>= 1024) or stacked card (< 1024, ModelLibraryTable.tsx:103-116, no <tbody> there). RR: 768 showed cards only.
const rowNames = (page: Page) => page.locator('tbody td:nth-child(2) button, ul > li button').filter({ hasText: /\S/u });

/** goto /admin/models and wait for the first GET /api/library (real or mocked answer). */
async function openLibrary(page: Page): Promise<void> {
  const read = page.waitForResponse((r) => r.request().method() === 'GET' && new URL(r.url()).pathname === '/api/library');
  await page.goto(ROUTES.adminModels, { waitUntil: 'commit' });
  await read;
}

async function openReady(page: Page): Promise<void> {
  await openLibrary(page);
  await expect(page.getByLabel(SEARCH)).toBeVisible();
  await expect(rowNames(page).first().or(page.getByRole('list', { name: 'lưới model' }))).toBeVisible();
}

test('SCR-34 · FL-34L-U1 · UI verify real states (default, no match, category open, grid, detail, copy case, then engineer alert)', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const context = await browser.newContext({ baseURL: readBaseUrl() });
  const page = await context.newPage();
  await signInAdmin(page, ROUTES.adminModels);

  await test.step('[34L-C-017] ⚑ labels in sentence case (BUG-595)', async () => {
    await openReady(page);
    // ModelLibraryToolbar.tsx:17,19; ModelLibrarySummary.tsx:14; useModelLibrary.ts:107-108. Correct = first letter capital (rule A6).
    await expect.soft(page.getByLabel('Tìm model', { exact: true }), 'search label capital').toBeVisible();
    await expect.soft(page.getByRole('combobox', { name: 'Danh mục', exact: true }), 'category label capital').toBeVisible();
    await expect.soft(page.getByText('Model nặng', { exact: true }), 'heavy count label capital').toBeVisible();
    // Labels of the detail panel (useModelLibrary.ts:108-109 fieldFileSize / fieldGroup), not the table headers.
    await rowNames(page).first().click();
    const aside = page.locator(`aside[aria-label="${DETAIL}"]`);
    await expect(aside).toBeVisible();
    await expect.soft(aside.getByText('Dung lượng', { exact: true }), '"dung lượng" capital').toBeVisible();
    await expect.soft(aside.getByText('Nhóm', { exact: true }), '"nhóm" capital').toBeVisible();
    await captureEvidence(page, 'U08_34L-C-017_copy_case.png');
  });

  await test.step('[34L-F-001] default list at 4 viewports', async () => {
    const metrics = await verifyUi(page, 'U08_34L-F-001_default', openReady, DESKTOP_VIEWPORTS);
    expect.soft(metrics.map((m) => m.horizontalOverflowPx), 'no horizontal scroll').toEqual([0, 0, 0, 0]);
  });

  await test.step('[34L-F-002] no match at 4 viewports', async () => {
    const metrics = await verifyUi(
      page,
      'U08_34L-F-002_no_match',
      async (p) => {
        await openReady(p);
        await p.getByLabel(SEARCH).fill('zzz-khong-co-model');
        await expect(p.getByText(NO_MATCH, { exact: true })).toBeVisible();
      },
      DESKTOP_VIEWPORTS,
    );
    expect.soft(metrics.every((m) => m.openError === undefined), 'state opened at every width').toBe(true);
  });

  await test.step('[34L-F-003] category list open at 4 viewports', async () => {
    const metrics = await verifyUi(
      page,
      'U08_34L-F-003_category_open',
      async (p) => {
        await openReady(p);
        await p.getByRole('combobox', { name: CATEGORY, exact: true }).click();
        await expect(p.getByRole('option').first()).toBeVisible();
      },
      DESKTOP_VIEWPORTS,
    );
    expect.soft(metrics.every((m) => m.openError === undefined), 'state opened at every width').toBe(true);
  });

  await test.step('[34L-F-004] grid view at 4 viewports', async () => {
    const metrics = await verifyUi(
      page,
      'U08_34L-F-004_grid',
      async (p) => {
        await openReady(p);
        await p.getByRole('radiogroup', { name: 'Chế độ xem' }).getByRole('radio', { name: 'Lưới', exact: true }).click();
        // ModelLibraryTable.tsx: below 1024 (isNarrow) cards replace the grid, so only the radio state is stable there.
        await expect(p.getByRole('radio', { name: 'Lưới', exact: true })).toBeChecked();
      },
      DESKTOP_VIEWPORTS,
    );
    expect.soft(metrics.every((m) => m.openError === undefined), 'state opened at every width').toBe(true);
  });

  await test.step('[34L-F-005] detail panel open at 4 viewports', async () => {
    const metrics = await verifyUi(
      page,
      'U08_34L-F-005_detail',
      async (p) => {
        await openReady(p);
        await rowNames(p).first().click();
        await expect(p.locator(`aside[aria-label="${DETAIL}"]`).or(p.getByRole('dialog', { name: DETAIL, exact: true }))).toBeVisible();
      },
      DESKTOP_VIEWPORTS,
    );
    expect.soft(metrics.every((m) => m.openError === undefined), 'state opened at every width').toBe(true);
  });

  await test.step('[34L-F-006] engineer read-only alert above the toolbar', async () => {
    const admin = await adminApi();
    const engineerContext = await browser.newContext({ baseURL: readBaseUrl() });
    try {
      const engineer = await poolUser(admin, 'engineer', 'p08-eng');
      await signInPoolUser(engineerContext, engineer);
      const ePage = await engineerContext.newPage();
      const metrics = await verifyUi(
        ePage,
        'U08_34L-F-006_engineer_alert',
        async (p) => {
          await openReady(p);
          await expect(p.getByText('Vai trò của bạn chỉ xem được thư viện', { exact: false })).toBeVisible(); // useModelLibrary.ts:103
        },
        DESKTOP_VIEWPORTS,
      );
      expect(metrics.every((m) => m.openError === undefined), 'engineer alert shown at every width').toBe(true);
      expect(metrics.flatMap((m) => m.overlaps), 'alert overlaps nothing').toEqual([]);
    } finally {
      await engineerContext.close();
      await admin.dispose();
    }
  });
  await context.close();
});

test('SCR-34 · FL-34L-U2 · [mocked response] UI verify loading, empty, error, heavy/preview-less, heavy detail, failed preview, long name', async ({
  browser,
}) => {
  // Paired real flow: FL-34L-U1.
  test.setTimeout(300_000);
  const context = await browser.newContext({ baseURL: readBaseUrl() });
  const page = await context.newPage();
  await signInAdmin(page, ROUTES.adminModels);

  // Real list read once (derives the crafted bodies); GET /api/library is a bare array (flows G-001).
  const admin = await adminApi();
  let real: LibraryItem[];
  try {
    real = (await (await admin.get('/api/library')).json()) as LibraryItem[];
  } finally {
    await admin.dispose();
  }
  expect(real.length, 'environment: real library has at least one model to copy').toBeGreaterThan(0);
  const first = real[0] as LibraryItem;
  const { previewUrl, ...base } = first;
  const crafted: LibraryItem[] = [
    { ...base, id: 'mk-heavy', name: 'Heavy 900001', triangleCount: HEAVY_TRIANGLES, ...(previewUrl === undefined ? {} : { previewUrl }) },
    { ...base, id: 'mk-nopreview', name: 'No preview', triangleCount: 1000 },
    { ...base, id: 'mk-long', name: LONG_NAME, triangleCount: 1000, ...(previewUrl === undefined ? {} : { previewUrl }) },
  ];

  const answer = (status: number, body: unknown) => async (route: Route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  };
  /** Runs one verifyUi with `/api/library` mocked by `handler`; the route is removed afterwards. */
  async function mocked(name: string, handler: (route: Route) => Promise<void>, open: (p: Page) => Promise<void>): Promise<void> {
    await page.route(LIBRARY_PATH, handler);
    try {
      const metrics = await verifyUi(page, name, open, DESKTOP_VIEWPORTS);
      expect.soft(metrics.every((m) => m.openError === undefined), `${name}: state opened at every width`).toBe(true);
      expect.soft(metrics.map((m) => m.horizontalOverflowPx), `${name}: no horizontal scroll`).toEqual([0, 0, 0, 0]);
    } finally {
      await page.unroute(LIBRARY_PATH, handler);
    }
  }
  const openCrafted = async (p: Page): Promise<void> => {
    await openLibrary(p);
    await expect(p.getByText(LONG_NAME, { exact: true }).first()).toBeVisible();
  };

  await test.step('[34L-B-034] very long name does not push the layout', async () => {
    await mocked('U08_34L-B-034_long_name', answer(200, crafted), async (p) => {
      await openCrafted(p);
      await p.getByText(LONG_NAME, { exact: true }).first().click();
      const detail = p.locator(`aside[aria-label="${DETAIL}"]`).or(p.getByRole('dialog', { name: DETAIL, exact: true }));
      await expect(detail.getByRole('heading', { level: 2, name: LONG_NAME, exact: true })).toBeVisible();
    });
  });

  await test.step('[34L-F-007] loading skeleton (held GET)', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const hold = async (route: Route): Promise<void> => {
      await gate;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(crafted) });
    };
    await page.route(LIBRARY_PATH, hold);
    try {
      const metrics = await verifyUi(
        page,
        'U08_34L-F-007_loading',
        async (p) => {
          await p.goto(ROUTES.adminModels, { waitUntil: 'commit' });
          await expect(p.locator('[aria-busy="true"]').first()).toBeVisible();
        },
        DESKTOP_VIEWPORTS,
      );
      expect.soft(metrics.every((m) => m.openError === undefined), 'skeleton visible at every width').toBe(true);
    } finally {
      release();
      await page.unroute(LIBRARY_PATH, hold);
    }
  });

  await test.step('[34L-F-008] empty library', async () => {
    await mocked('U08_34L-F-008_empty', answer(200, []), async (p) => {
      await openLibrary(p);
      await expect(p.getByText(EMPTY_TITLE, { exact: true })).toBeVisible();
    });
  });

  await test.step('[34L-F-009] list error alert', async () => {
    await mocked('U08_34L-F-009_error', answer(500, { detail: 'boom' }), async (p) => {
      await p.goto(ROUTES.adminModels, { waitUntil: 'commit' });
      await expect(p.getByText(ERROR_TITLE, { exact: true })).toBeVisible({ timeout: 30_000 });
    });
  });

  await test.step('[34L-F-010] heavy badge and missing preview', async () => {
    await mocked('U08_34L-F-010_heavy_nopreview', answer(200, crafted), async (p) => {
      await openCrafted(p);
      await expect(p.getByText('Nặng', { exact: true }).first()).toBeVisible();
    });
  });

  await test.step('[34L-F-011] detail of a heavy model', async () => {
    await mocked('U08_34L-F-011_heavy_detail', answer(200, crafted), async (p) => {
      await openCrafted(p);
      await p.getByText('Heavy 900001', { exact: true }).first().click();
      await expect(p.getByLabel('Cảnh báo model nặng', { exact: true })).toBeVisible(); // ModelLibraryDetail.tsx:257
    });
  });

  await test.step('[34L-F-012] detail with a failed preview', async () => {
    // The detail 3D frame fails on `modelUrl` (useModelLibrary.ts:413-425), not on `previewUrl` (row thumbnail only). RR screenshot: frame loaded fine.
    const broken = crafted.map((c) => ({ ...c, modelUrl: 'http://127.0.0.1:1/model-missing.glb' }));
    await mocked('U08_34L-F-012_failed_preview', answer(200, broken), async (p) => {
      await openCrafted(p);
      await p.getByText('Heavy 900001', { exact: true }).first().click();
      await expect(p.getByRole('button', { name: 'Thử lại', exact: true })).toBeVisible({ timeout: 30_000 }); // ModelLibraryDetail.tsx:139
    });
  });
  await context.close();
});
