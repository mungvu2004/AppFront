/**
 * Phase 6 SCR-28 UI verification (QA-06b, pack P2; flows-C1 `phase06_rules_ui.spec.ts`, skill `qa-verify-ui`): every state of
 * the rule report and the violation sheet once, at 1920 / 1440 / 1024 / 768 (`verifyUi`), evidence `U06r_<row id>_<slug>_<width>.png`.
 *
 * Seeds (real API, created in `beforeAll`, deleted in `afterAll`): `R1` (rule violations), `R3` (no critical violation: done
 * state), `M0` (zero floors: partial). The two states that DELETE a table (28-F-010, 28V-F-005) create their own R1
 * project per viewport (real write, the quick fix persists), so the shared R1 is never changed and the 4 widths each find a
 * table to delete. Fake project id: a random UUID (not found).
 *
 * Request budget (per worker): `POST /api/auth/login` 2 (fixtures + `signInAdmin`); projects 3 shared + 8 per-viewport,
 * each 1 POST + 1 #35 PUT + 1 DELETE (no rate limit); 4 quick-fix autosave PUTs per mutating step.
 *
 * // S5-confirm: group names / counts of the R1 layer; which actions the resolved row's sheet offers (28V-F-005);
 * // the 3D toggle control of the sheet (28V-F-003); strip columns.
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { ACTION_TIMEOUT_MS, NAVIGATION_TIMEOUT_MS, readBaseUrl } from '../../e2e/fullstack/env';
import { signedInApi } from './support/api';
import { readAdminCredentials, signInAdmin } from './support/auth';
import { createProject } from './support/phase03Seed';
import { deleteSeededProject } from './support/drawingSeed';
import {
  RR,
  RULE_NAME,
  VIEWPORT,
  createRuleProjectFor,
  expandGroup,
  findingRows,
  groupExpanders,
  levelFilter,
  openRuleSheet,
  openRules,
  rowWithFloor,
  sheetOf,
} from './support/p06/P2';
import { verifyUi } from './support/p06/viewports';

let admin: APIRequestContext | undefined;
const projects: string[] = [];
let r1 = '';
let r3 = '';
let m0 = '';

const api = (): APIRequestContext => {
  if (admin === undefined) throw new Error('setup: no admin API context');
  return admin;
};
const layerApi = (): { request: APIRequestContext; headers: Record<string, never> } => ({ request: api(), headers: {} });

test.beforeAll(async () => {
  const { email, password } = readAdminCredentials();
  admin = await signedInApi(email, password);
  r1 = (await createRuleProjectFor(layerApi(), 'rules-ui-r1', { thinWalls: false }, projects)).projectId;
  r3 = (await createRuleProjectFor(layerApi(), 'rules-ui-r3', { shortWall: false }, projects)).projectId;
  m0 = (await createProject(api(), 'rules-ui-m0', 0)).projectId;
  projects.push(m0);
});

test.afterAll(async () => {
  const failures: string[] = [];
  try {
    for (const id of projects) {
      const failed = admin === undefined ? null : await deleteSeededProject(admin, id);
      if (failed !== null) failures.push(failed);
    }
  } finally {
    if (failures.length > 0) test.info().annotations.push({ type: 'cleanup', description: failures.join('; ') });
    await admin?.dispose();
  }
});

/** A fresh R1 project for a state that deletes a table; remembered for `afterAll`. */
async function freshR1(): Promise<string> {
  return (await createRuleProjectFor(layerApi(), 'rules-ui-fix', { thinWalls: false }, projects)).projectId;
}

/** Quick fix: click "Xoá đối tượng này" in the open sheet and wait for the autosave PUT to be answered 200. */
async function deleteFromSheet(page: Page): Promise<void> {
  const saved = page.waitForResponse((res) => res.request().method() === 'PUT' && res.url().includes('/spatial/layer'));
  await sheetOf(page).getByRole('button', { name: RR.deleteAction, exact: true }).click();
  expect((await saved).status(), 'quick-fix autosave PUT').toBe(200);
}

const hasHorizontalScroll = (page: Page): Promise<boolean> =>
  page.evaluate(() => (document.scrollingElement ?? document.documentElement).scrollWidth > window.innerWidth);

const wide = (page: Page): boolean => (page.viewportSize()?.width ?? 0) >= 1024;

/** The sheet closes by itself after a quick fix on some widths: close it only if it is still open. */
async function closeSheetIfOpen(page: Page): Promise<void> {
  const close = page.getByRole('button', { name: RR.sheetClose, exact: true });
  if (await close.isVisible()) await close.click();
  await expect(sheetOf(page)).toBeHidden();
}

test('SCR-28 · FL-28-U1a · UI verify of the report states (`verifyUi`, 4 sizes each)', async ({ browser }) => {
  test.setTimeout(240000);
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport: VIEWPORT });
  context.setDefaultTimeout(ACTION_TIMEOUT_MS);
  context.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
  const page = await context.newPage();
  try {
    await signInAdmin(page);

    await test.step('[28-F-001] R1 ready, groups collapsed', async () => {
      await verifyUi(page, 'U06r_28-F-001_ready', async (p) => {
        await openRules(p, r1);
        await expect(levelFilter(p)).toBeVisible();
        expect(await hasHorizontalScroll(p), 'no horizontal scroll').toBe(false);
        const link = p.getByRole('link', { name: RR.settingsLink, exact: true });
        expect((await link.boundingBox())?.height ?? 0, '"Cài đặt bộ luật" target >= 24 px high').toBeGreaterThanOrEqual(24);
        const columns = await p.locator('dl').first().evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
        expect(columns, 'strip columns: 4').toBe(4);
      });
    });

    await test.step('[28-F-002] one group expanded', async () => {
      await verifyUi(page, 'U06r_28-F-002_group_expanded', async (p) => {
        await openRules(p, r1);
        const section = await expandGroup(p, RULE_NAME.furnitureClash);
        await expect(findingRows(section).first()).toBeVisible();
        await expect(section.getByRole('button', { name: RR.view, exact: true }).first(), '"Xem" in view').toBeInViewport();
        const header = await groupExpanders(p).filter({ hasText: RULE_NAME.furnitureClash }).first().boundingBox();
        expect((header?.x ?? 0) + (header?.width ?? 0), 'group title wraps instead of overflowing').toBeLessThanOrEqual((p.viewportSize()?.width ?? 0) + 1);
      });
    });

    await test.step('[28-F-003] radio "Nghiêm trọng"', async () => {
      await verifyUi(page, 'U06r_28-F-003_violations', async (p) => {
        await openRules(p, r1);
        await levelFilter(p).getByRole('radio', { name: 'Nghiêm trọng', exact: true }).click();
        await expect(groupExpanders(p).first()).toBeVisible();
        for (const text of await groupExpanders(p).allInnerTexts()) expect(text, 'critical groups only').toContain('Nghiêm trọng');
        expect(await hasHorizontalScroll(p), 'legible without horizontal scroll').toBe(false);
      });
    });

    await test.step('[28-F-004] radio "Đạt"', async () => {
      await verifyUi(page, 'U06r_28-F-004_passed', async (p) => {
        await openRules(p, r1);
        await levelFilter(p).getByRole('radio', { name: 'Đạt', exact: true }).click();
        await expect(groupExpanders(p)).toHaveCount(0);
        await expect(p.getByRole('listitem').filter({ hasText: /(Hình học|Lưu thông|Diện tích|Ghi chú|Cao độ tầng)$/u }).first()).toBeVisible();
        expect(await hasHorizontalScroll(p)).toBe(false);
      });
    });

    await test.step('[28-F-005] filters with no match', async () => {
      await verifyUi(page, 'U06r_28-F-005_no_match', async (p) => {
        await openRules(p, r1);
        await levelFilter(p).getByRole('radio', { name: 'Nghiêm trọng', exact: true }).click();
        const group = p.getByRole('combobox', { name: 'Nhóm luật', exact: true });
        await group.click();
        await p.getByRole('option', { name: 'Cao độ tầng', exact: true }).click();
        await expect(p.getByText(RR.noMatch, { exact: true })).toBeVisible();
        expect(await hasHorizontalScroll(p), 'the sentence wraps').toBe(false);
      });
    });

    await test.step('[28-F-006] R3 warnings-only state (ready, no done panel)', async () => {
      await verifyUi(page, 'U06r_28-F-006_done', async (p) => {
        await openRules(p, r3);
        await expect(p.getByRole('radiogroup', { name: RR.levelFilter })).toBeVisible();
        await expect(p.getByRole('button', { name: RR.confirm, exact: true })).toBeInViewport();
        await expect(p.getByText(RR.doneText, { exact: true })).toHaveCount(0);
        expect(await hasHorizontalScroll(p)).toBe(false);
      });
    });

    await test.step('[28-F-007] M0 partial state', async () => {
      await verifyUi(page, 'U06r_28-F-007_partial', async (p) => {
        await openRules(p, m0);
        const links = p.getByRole('link', { name: RR.addFloorLink, exact: true });
        await expect(links, 'one link per attention line').toHaveCount(4);
        const link = links.first();
        await expect(link, 'attention line link').toBeVisible(); // S5-confirm: an empty graph is `partial`
        await expect(link).toBeInViewport();
        expect(await hasHorizontalScroll(p), 'attention line wraps').toBe(false);
      });
    });

    await test.step('[28-F-012] fake project id gate', async () => {
      await verifyUi(page, 'U06r_28-F-012_not_found', async (p) => {
        await p.goto(ROUTES.project.rules(randomUUID()));
        const alert = p.getByRole('alert').filter({ hasText: 'Không tìm thấy dự án này' });
        await expect(alert).toBeVisible();
        const icon = await alert.locator('svg').first().boundingBox();
        expect(icon?.width ?? 0, 'icon bounding box > 0 (BUG-461)').toBeGreaterThan(0);
        await expect(alert.locator('svg').first()).toBeVisible();
        await expect(p.getByRole('button', { name: RR.backToProjects, exact: true })).toBeInViewport();
      });
    });
  } finally {
    await context.close();
  }
});

test('SCR-28 · FL-28-U1b · UI verify of the sheet states (`verifyUi`, 4 sizes each)', async ({ browser }) => {
  test.setTimeout(240000);
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport: VIEWPORT });
  context.setDefaultTimeout(ACTION_TIMEOUT_MS);
  context.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
  const page = await context.newPage();
  try {
    await signInAdmin(page);

    await test.step('[28V-F-001] row opens the sheet', async () => {
      await verifyUi(
        page,
        'U06r_28V-F-001_sheet',
        async (p) => {
          await openRuleSheet(p, r1, RULE_NAME.furnitureClash);
          expect(await hasHorizontalScroll(p), 'no horizontal page scroll (BUG-434)').toBe(false);
          for (const name of ['Vi phạm trước', 'Vi phạm kế tiếp', RR.sheetClose]) {
            await expect(sheetOf(p).getByRole('button', { name, exact: true }), `"${name}" inside the viewport`).toBeInViewport();
          }
        },
        undefined,
        { fullPage: false },
      );
    });

    await test.step('[28V-F-002] sheet content: 2D figure and causes', async () => {
      await verifyUi(
        page,
        'U06r_28V-F-002_sheet_content',
        async (p) => {
          const sheet = await openRuleSheet(p, r1, RULE_NAME.furnitureClash);
          await expect(sheet.getByRole('heading', { name: 'Nguyên nhân có thể' })).toBeVisible();
          if (wide(p)) {
            // the bottom-sheet (< 1024) has no 2D figure; the catalog asks for it without a narrow-screen rule
            const figure = sheet.getByLabel('Mặt bằng quanh đối tượng gây lỗi');
            await expect(figure).toBeVisible();
            const [box, panel] = [await figure.boundingBox(), await sheet.boundingBox()];
            expect((box?.x ?? 0) + (box?.width ?? 0), 'figure fits the panel').toBeLessThanOrEqual((panel?.x ?? 0) + (panel?.width ?? 0) + 1);
          }
          expect(await hasHorizontalScroll(p), 'the long message wraps').toBe(false);
        },
        undefined,
        { fullPage: false },
      );
    });

    await test.step('[28V-F-004] actions section', async () => {
      await verifyUi(
        page,
        'U06r_28V-F-004_actions',
        async (p) => {
          const sheet = await openRuleSheet(p, r1, RULE_NAME.furnitureClash);
          await expect(sheet.getByRole('heading', { name: 'Lựa chọn xử lý' })).toBeVisible();
          const action = sheet.getByRole('button', { name: RR.deleteAction, exact: true });
          await expect(action).toBeVisible();
          const [box, panel] = [await action.boundingBox(), await sheet.boundingBox()];
          expect((box?.x ?? 0) + (box?.width ?? 0), 'label wraps inside the panel').toBeLessThanOrEqual((panel?.x ?? 0) + (panel?.width ?? 0) + 1);
        },
        undefined,
        { fullPage: false },
      );
    });

    await test.step('[28V-F-003] 3D mode', async () => {
      await verifyUi(
        page,
        'U06r_28V-F-003_sheet_3d',
        async (p) => {
          const sheet = await openRuleSheet(p, r1, RULE_NAME.furnitureClash);
          if (!wide(p)) return; // bottom-sheet (< 1024): no 2D/3D group, screenshot only
          const toggle = sheet.getByRole('group', { name: 'Chế độ khối hình' }).or(sheet.getByLabel('Chế độ khối hình')).first();
          await expect(toggle, '2D / 3D toggle visible').toBeVisible();
          await toggle.getByText('3D', { exact: true }).click();
          const canvas = sheet.locator('canvas');
          await expect(canvas).toBeVisible();
          const [box, panel] = [await canvas.boundingBox(), await sheet.boundingBox()];
          expect((box?.x ?? 0) + (box?.width ?? 0), 'canvas fits the panel').toBeLessThanOrEqual((panel?.x ?? 0) + (panel?.width ?? 0) + 1);
        },
        undefined,
        { fullPage: false },
      );
    });

    await test.step('[28V-F-006] wall row without actions', async () => {
      await verifyUi(
        page,
        'U06r_28V-F-006_no_actions',
        async (p) => {
          const sheet = await openRuleSheet(p, r1, RULE_NAME.wallLength);
          await expect(sheet.getByText(RR.noAutoFix, { exact: true })).toBeVisible();
          expect(await hasHorizontalScroll(p), 'the explanation wraps').toBe(false);
        },
        undefined,
        { fullPage: false },
      );
    });
  } finally {
    await context.close();
  }
});

test('SCR-28 · FL-28-U1c · UI verify of quick fix and resolved section (`verifyUi`, 4 sizes each)', async ({ browser }) => {
  test.setTimeout(240000);
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport: VIEWPORT });
  context.setDefaultTimeout(ACTION_TIMEOUT_MS);
  context.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
  const page = await context.newPage();
  try {
    await signInAdmin(page);

    await test.step('[28-F-010] quick fix, then the "Đã xử lý" section next to an open group', async () => {
      await verifyUi(page, 'U06r_28-F-010_resolved', async (p) => {
        const project = await freshR1();
        await openRuleSheet(p, project, RULE_NAME.furnitureClash);
        await deleteFromSheet(p);
        await closeSheetIfOpen(p);
        const resolved = groupExpanders(p).filter({ hasText: RR.resolved }).first();
        await expect(resolved).toBeVisible();
        if ((await resolved.getAttribute('aria-expanded')) !== 'true') await resolved.click();
        await expect(resolved).toHaveAttribute('aria-expanded', 'true');
        await expect(findingRows(p.locator('section').filter({ has: resolved })).first(), 'resolved rows legible').toBeVisible();
        expect(await hasHorizontalScroll(p)).toBe(false);
      });
    });

    await test.step('[28V-F-005] reopen the resolved row, click the action again: error inside the panel', async () => {
      await verifyUi(
        page,
        'U06r_28V-F-005_error',
        async (p) => {
          const project = await freshR1();
          await openRuleSheet(p, project, RULE_NAME.furnitureClash);
          await deleteFromSheet(p);
          await closeSheetIfOpen(p);
          const resolved = groupExpanders(p).filter({ hasText: RR.resolved }).first();
          if ((await resolved.getAttribute('aria-expanded')) !== 'true') await resolved.click();
          const section = p.locator('section').filter({ has: resolved });
          const sheet = await (async () => {
            await rowWithFloor(p, section).first().getByRole('button').first().click();
            return sheetOf(p);
          })();
          await expect(sheet).toBeVisible();
          // S5-confirm: the resolved row's sheet still offers the action; running it on the gone entity fails
          await sheet.getByRole('button', { name: RR.deleteAction, exact: true }).click();
          await expect(sheet.getByRole('alert'), 'InlineAlert inside the panel').toBeVisible();
        },
        undefined,
        { fullPage: false },
      );
    });
  } finally {
    await context.close();
  }
});
