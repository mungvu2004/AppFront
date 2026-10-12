/**
 * Phase 3 — SCR-11 input quality gate, UI-verification flows (QA-03d P7; skill `qa-verify-ui`). One `test()` per flow,
 * one `test.step('[11-F-…]')` per state; each state at 1440 / 1024 / 768 / 375 (`support/ui-verify.ts` `verifyUi`,
 * evidence `U03_<row id>_<slug>_<width>.png` + `.json`). A state that exists only once after a real write (the
 * comparison field) is shot by resizing the same page (`support/p03/P7.ts` `shootWidthsInPlace`), never by repeating it.
 *
 * Data: own run-unique projects of the pool admin `p7-quality` (own `drawings_init` bucket), deleted in `finally`; the
 * shared pool viewer only as a member of an own project. No shared file written; safe under `--workers 4`.
 * Mocks only in FL-U11-04 `[mocked response]`.
 *
 * Request budget per file run: `POST /api/auth/login` 3 per flow + 1 viewer ≈ 13; invitations 0 once the pool holds
 * `admin:p7-quality` / `viewer:shared`; `drawings_init` 15 (FL-U11-01 1, 02 12, 03 1, 04 1) → 15 fake-ML runs; one real
 * corners write (FL-U11-01). `POST /api/auth/refresh`: 1 per page load ≈ 60 over the file.
 */
import { expect, test, type APIRequestContext, type Browser, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { signedInApi } from './support/api';
import { captureEvidence } from './support/evidence';
import { addProjectMember, deleteSeededProject, framelessPng, poolUser, type PoolUser } from './support/phase03Seed';
import {
  CLEAN,
  floorOf,
  mainAdminApi,
  openSession,
  P7_SLOT,
  planPng,
  readQuality,
  seedQualityProject,
  shootWidthsInPlace,
  skewedEnvPng,
  type QualityProject,
  type Session,
} from './support/p03/P7';
import { verifyUi } from './support/ui-verify';

const REPORT = 'Báo cáo chất lượng'; // InputQualityGateReportPanel.tsx:281
const SEND = 'Gửi bốn góc đã chọn';
const CORNER_GROUP = 'Bốn góc bản vẽ, kéo để chỉnh khung'; // InputQualityGateImageOverlays.tsx:33
const CORNERS_DIALOG = /^Cắt và nắn bản vẽ tầng .+ theo bốn góc\?$/u;
const CONFIRM_CORNERS = 'Cắt và nắn';
const STRAIGHTEN = 'Tự động nắn';
const CONFIRM_STRAIGHTEN = 'Nắn thẳng';
const ZOOMED_FRAME = 'Bản vẽ đang phóng, cuộn để xem phần còn lại'; // InputQualityGateImagePanel.tsx:71
const COMPARISON = 'Tỉ lệ lộ ảnh sau khi nắn';
const PASS = 'Bản vẽ đạt yêu cầu.';
const CONTINUE = 'Tiếp tục xử lý';
const SECONDARY = 'Tải bản vẽ khác';
const LOAD_ERROR = 'Không đọc được kết quả kiểm tra chất lượng'; // InputQualityGate.tsx:58
const WRITE_ERROR = 'Chưa xử lý được bản vẽ'; // InputQualityGate.tsx:64
const SKEW = 8;

/* ---- harness (as the edge file: own projects, pool sessions, cleanup) ---- */

interface Flow {
  readonly admin: APIRequestContext;
  readonly owner: PoolUser;
  readonly ownerApi: APIRequestContext;
  readonly projects: string[];
  readonly sessions: Session[];
}

async function flow(body: (f: Flow) => Promise<void>): Promise<void> {
  const admin = await mainAdminApi();
  const projects: string[] = [];
  const sessions: Session[] = [];
  let ownerApi: APIRequestContext | undefined;
  try {
    const owner = await poolUser(admin, 'admin', P7_SLOT);
    ownerApi = await signedInApi(owner.email, owner.password);
    await body({ admin, owner, ownerApi, projects, sessions });
  } finally {
    for (const s of sessions) await s.context.close().catch(() => undefined);
    for (const id of projects) if (ownerApi !== undefined) await deleteSeededProject(ownerApi, id);
    await ownerApi?.dispose();
    await admin.dispose();
  }
}

async function seed(f: Flow, slug: string, floors: Parameters<typeof seedQualityProject>[2]): Promise<QualityProject> {
  const project = await seedQualityProject(f.ownerApi, slug, floors);
  f.projects.push(project.projectId);
  return project;
}

async function session(f: Flow, browser: Browser, user: PoolUser = f.owner): Promise<Session> {
  const s = await openSession(browser, user);
  f.sessions.push(s);
  return s;
}

const report = (page: Page): Locator => page.getByRole('region', { name: REPORT, exact: true });
const button = (scope: Page | Locator, name: string): Locator => scope.getByRole('button', { name, exact: true });
const pickBtn = (page: Page): Locator => page.locator('[data-quality-action="corners"]');

async function openQuality(page: Page, projectId: string): Promise<void> {
  await page.goto(ROUTES.project.quality(projectId));
  await expect(report(page)).toBeVisible({ timeout: 45_000 });
}

const wide = (page: Page): boolean => (page.viewportSize()?.width ?? 1440) >= 1024;

/* ================================================================= flows */

test.describe('U03 SCR-11 input quality gate — UI flows (QA-03d P7)', () => {
  test('SCR-11 · FL-U11-01 · frameless drawing: zoom, corner mode, corners dialog, comparison field', async ({ browser }) => {
    test.setTimeout(420_000);
    await flow(async (f) => {
      const project = await seed(f, '11-u01', [{ name: 'Tầng 1', png: await framelessPng(browser) }]);
      const { page } = await session(f, browser);

      await test.step('[11-F-015] zoomed 200 % scroll frame', async () => {
        // In place: `verifyUi` counts the regions scrolled away inside the zoomed frame as controls off the page.
        await openQuality(page, project.projectId);
        for (let i = 0; i < 10; i += 1) await button(page, 'Phóng to').click();
        await shootWidthsInPlace(page, 'U03_11-F-015_zoom_200', async () => {
          await expect.soft(page.getByRole('group', { name: ZOOMED_FRAME, exact: true })).toBeVisible();
        });
      });

      await test.step('[11-F-002] corner mode: handles, hint, zoom cluster hidden', async () => {
        await verifyUi(page, 'U03_11-F-002_corner_mode', async (p) => {
          await openQuality(p, project.projectId);
          await pickBtn(p).click();
          await expect(p.getByRole('group', { name: CORNER_GROUP, exact: true })).toBeVisible();
          await expect(p.getByRole('group', { name: 'Cụm thu phóng', exact: true })).toHaveCount(0);
        });
      });

      await test.step('[11-F-011] corners confirm dialog open', async () => {
        await verifyUi(
          page,
          'U03_11-F-011_corners_dialog',
          async (p) => {
            await openQuality(p, project.projectId);
            await pickBtn(p).click();
            await expect(pickBtn(p)).toHaveAccessibleName(SEND);
            await pickBtn(p).click();
            await expect(p.getByRole('dialog', { name: CORNERS_DIALOG })).toBeVisible();
          },
          undefined,
          { fullPage: false },
        );
      });

      await test.step('[11-F-013] "Cắt và nắn" (real 200) → comparison field', async () => {
        await openQuality(page, project.projectId);
        await pickBtn(page).click();
        await pickBtn(page).click();
        const answered = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/quality/corners'), { timeout: 120_000 });
        await button(page.getByRole('dialog', { name: CORNERS_DIALOG }), CONFIRM_CORNERS).click();
        expect((await answered).status(), 'corners answer').toBe(200);
        const field = page.getByRole('textbox', { name: COMPARISON });
        await shootWidthsInPlace(page, 'U03_11-F-013_comparison_field', async () => {
          await expect.soft(field).toBeVisible();
        });
      });
    });
  });

  test('SCR-11 · FL-U11-02 · 12 clean floors: pass notice, compact footer, many-floor table', async ({ browser }) => {
    test.setTimeout(480_000);
    await flow(async (f) => {
      const clean = await planPng(browser, CLEAN);
      const project = await seed(f, '11-u02', Array.from({ length: 12 }, (_, i) => ({ name: `Tầng ${String(i + 1)}`, png: clean })));
      const { page } = await session(f, browser);
      const tableReady = async (p: Page): Promise<void> => {
        await openQuality(p, project.projectId);
        await expect(report(p).getByRole('row')).toHaveCount(13);
      };

      await test.step('[11-F-009] pass notice at four widths', async () => {
        await verifyUi(page, 'U03_11-F-009_pass_notice', async (p) => {
          await tableReady(p);
          if (wide(p)) await expect(report(p)).toContainText(PASS);
        });
      });

      await test.step('[11-F-018] below 1024 px the pass notice stays (suspected: empty "Phát hiện" instead)', async () => {
        for (const vp of [{ width: 768, height: 1024 }, { width: 375, height: 812 }]) {
          await page.setViewportSize(vp);
          await tableReady(page);
          await captureEvidence(page, `U03_11-F-018_pass_compact_${String(vp.width)}.png`, { fullPage: true });
          await expect.soft(report(page), `${String(vp.width)} px: pass notice ("collapsed" status wins over pass)`).toContainText(PASS);
        }
      });

      await test.step('[11-F-017] < 640 px: footer stacks full width, "Tiếp tục xử lý" on top; report under the drawing; no h-scroll (fold Q20)', async () => {
        await page.setViewportSize({ width: 375, height: 812 });
        await tableReady(page);
        const primary = await button(page, CONTINUE).boundingBox();
        const secondary = await button(page, SECONDARY).boundingBox();
        const footer = await page.locator('footer[aria-label="Hành động tiếp theo"]').boundingBox();
        const drawing = await page.getByRole('region', { name: 'Khung xem bản vẽ', exact: true }).boundingBox();
        const rep = await report(page).boundingBox();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        await captureEvidence(page, 'U03_11-F-017_compact_footer_375.png', { fullPage: true, caption: `continue ${JSON.stringify(primary)} · secondary ${JSON.stringify(secondary)}` });
        expect.soft(primary !== null && secondary !== null && primary.y < secondary.y, '"Tiếp tục xử lý" above "Tải bản vẽ khác"').toBe(true);
        expect.soft(Math.round(primary?.width ?? 0), 'continue full width').toBe(Math.round(footer?.width ?? -1));
        expect.soft(Math.round(secondary?.width ?? 0), 'secondary full width').toBe(Math.round(footer?.width ?? -1));
        expect.soft(rep !== null && drawing !== null && rep.y >= drawing.y + drawing.height - 1, 'report under the drawing').toBe(true);
        expect.soft(overflow).toBeLessThanOrEqual(0);
        await page.setViewportSize({ width: 1440, height: 900 });
      });

      await test.step('[11-F-016] "Các tầng đã đo" with 12 rows at four widths', async () => {
        await verifyUi(page, 'U03_11-F-016_twelve_floors', tableReady);
      });
    });
  });

  test('SCR-11 · FL-U11-03 · viewer layout without footer buttons', async ({ browser }) => {
    test.setTimeout(420_000);
    await flow(async (f) => {
      const viewer = await poolUser(f.admin, 'viewer');
      const project = await seed(f, '11-u03', [{ name: 'Tầng 1', png: await skewedEnvPng(browser, SKEW) }]);
      await addProjectMember(f.ownerApi, project.projectId, viewer.email);
      const { page } = await session(f, browser, viewer);

      await test.step('[11-F-014] viewer (forbidden) layout: no footer buttons', async () => {
        await verifyUi(page, 'U03_11-F-014_viewer_layout', async (p) => {
          await openQuality(p, project.projectId);
          await expect(button(p, CONTINUE)).toHaveCount(0);
          await expect(button(p, SECONDARY)).toHaveCount(0);
        });
      });
    });
  });

  test('SCR-11 · FL-U11-04 · [mocked response] loading, read error, partial notice, write error band', async ({ browser }) => {
    test.setTimeout(420_000);
    await flow(async (f) => {
      const project = await seed(f, '11-u04', [{ name: 'Tầng 1', png: await skewedEnvPng(browser, SKEW) }]);
      const fid = project.floors[0]!.id;
      const real = await readQuality(f.ownerApi, project.projectId, fid);
      const { page } = await session(f, browser);
      const isQuality = (url: URL): boolean => url.pathname.startsWith(`/api/projects/${project.projectId}/floors/`) && url.pathname.endsWith('/quality');
      const errorJson = (status: number, code: string) => ({ status, contentType: 'application/json', body: JSON.stringify({ code, requestId: 'qa-p7-mock' }) });

      await test.step('[11-F-007] held #30 → loading skeleton', async () => {
        await page.route(isQuality, () => new Promise<void>(() => undefined)); // never answered while captured
        await verifyUi(page, 'U03_11-F-007_loading', async (p) => {
          await p.goto(ROUTES.project.quality(project.projectId));
          await expect(p.locator('[role="presentation"] .animate-pulse')).toBeVisible();
        });
        await page.unrouteAll({ behavior: 'ignoreErrors' });
      });

      await test.step('[11-F-008] #30 500 → read error alert with "Thử lại"', async () => {
        await page.route(isQuality, (route) => route.fulfill(errorJson(500, 'INTERNAL')));
        await verifyUi(page, 'U03_11-F-008_read_error', async (p) => {
          await p.goto(ROUTES.project.quality(project.projectId));
          await expect(p.getByRole('alert').filter({ hasText: LOAD_ERROR })).toBeVisible({ timeout: 45_000 });
        });
        await page.unrouteAll({ behavior: 'ignoreErrors' });
      });

      await test.step('[11-F-010] unmeasured floor body → partial notice', async () => {
        const { measurement: _m, ...rest } = floorOf(real, fid);
        await page.route(isQuality, (route) => route.fulfill({ json: { ...real, floors: [{ ...rest, isMeasured: false, findings: [] }] } }));
        await verifyUi(page, 'U03_11-F-010_partial_notice', async (p) => {
          await openQuality(p, project.projectId);
          // < 1024 px the status is "collapsed", which carries no partial notice (useInputQualityGate.ts status ladder).
          if (wide(p)) await expect(report(p)).toContainText('Mới có 0/1 tầng đo xong.');
        });
        await page.unrouteAll({ behavior: 'ignoreErrors' });
      });

      await test.step('[11-F-012] "Nắn thẳng" → 422 → write error band above the columns', async () => {
        await page.route((url) => url.pathname.endsWith('/quality/straighten'), (route) => route.fulfill(errorJson(422, 'IMAGE_TOO_LARGE')));
        await verifyUi(page, 'U03_11-F-012_write_error_band', async (p) => {
          await openQuality(p, project.projectId);
          await button(p, STRAIGHTEN).click();
          await button(p.getByRole('dialog', { name: /^Nắn thẳng bản vẽ tầng /u }), CONFIRM_STRAIGHTEN).click();
          await expect(p.getByRole('alert').filter({ hasText: WRITE_ERROR })).toBeVisible();
        });
        await page.unrouteAll({ behavior: 'ignoreErrors' });
      });
    });
  });
});

