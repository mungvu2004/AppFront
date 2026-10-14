/**
 * Phase 5 — SCR-25 Measurement tool, dedicated UI-verification flows (skill `qa-verify-ui`; QA-05c S3 pack P5, plan
 * `flows-C4.md` "phase05_measure_ui.spec.ts"). One test per flow, one `test.step('[<row id>] …')` per catalog row; each state is
 * shot at 1440 / 1024 / 768 / 375 by `verifyUi` (`U05m_<row id>_<slug>_<width>.png` + `.json`), extra measurements as soft expects.
 *
 * Source (FE master d50bb248): MTV src/screens/viewer/MeasurementTool/MeasurementTool.tsx (mode bar, invitation, pills, chip) ·
 * MTL …/MeasurementList.tsx · UMT …/useMeasurementTool.ts · VCH/VOV/VSR src/screens/viewer/ViewerShell/ (zoom cluster, ViewCube,
 * storey rail) · VIN ViewerInspector.tsx · PSG ProjectSpatialGate.tsx · NH NotificationHost (toast) · MiniMap src/components/canvas/MiniMap.tsx.
 *
 * Data: own projects through the real API (`layerSeed.ts`, `phase03Seed.ts`), deleted in `finally`. FL-25-U1 seeds R3 by API before
 * its third step. FL-25-U3 is "[mocked response]" (#16 500, N15 held / 500, POST 500) and pairs FL-25-U1 / FL-25-01; a held N15 is the
 * real request delayed by a promise. A viewer member (`p05-roles` pool slot, never changed) opens FL-25-U2's first step.
 *
 * Canvas picks (FL-25-U1 [25-F-004], FL-25-U2 [25-F-007], FL-25-U3 [25-F-014]) were not run in S3 (no stack): `makeDraft` throws
 * "UNKNOWN — NEED VERIFICATION" when no click lands.
 *
 * Budget per run: logins 3 API (admin `signedInApi` per flow) + 3 admin browser logins + 1 viewer browser login;
 * `POST /api/auth/refresh` about 1 per page load (about 90: 4 widths per state); `POST /api/projects` 6 (+6 DELETE); `POST measurements` 3 (R3)
 * + 1 R1 + 4 (25-F-005 reseeds a row per width); `DELETE measurements` 4; `POST members` 1; invitations 0, or 1 when the pool slot is empty.
 */
import { expect, test, type Locator, type Page, type Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { captureEvidence } from './support/evidence';
import { addProjectMember, createProject, deleteSeededProject, poolUser } from './support/phase03Seed';
import { adminApi, closePage, openAdminPage, openPoolPage, unknownProjectId, type OpenPage } from './support/p03/P4';
import {
  ERROR_PAINT_TIMEOUT_MS,
  GATE,
  MT,
  armMeasure,
  failWith,
  insideViewport,
  intersects,
  interceptApi,
  makeDraft,
  measureList,
  measurementsRe,
  openMeasure,
  pinButton,
  seedMeasurements,
  seedProject,
  seedR1,
  seedR3,
  spatialRe,
  toastWith,
  topView,
  trialClickBlocker,
  viewportOf,
  type Box,
  type MeasurementSeed,
} from './support/p05/P5';
import { TEST_DATA_PREFIX } from './support/evidence';
import { verifyUi } from './support/ui-verify';

const boxOf = (target: Locator): Promise<Box | null> => target.first().boundingBox();
const widthOf = (page: Page): number => page.viewportSize()?.width ?? 0;
/** Box lies inside the page width (a stacked layout may run below the fold, never beyond the sides). */
const withinWidth = (page: Page, box: Box | null): boolean => box !== null && box.x >= -1 && box.x + box.width <= widthOf(page) + 1;
const modeBar = (page: Page): Locator => page.getByRole('radiogroup', { name: MT.modes });
const cube = (page: Page): Locator => page.getByRole('group', { name: 'Khối định hướng', exact: true });
const minimap = (page: Page): Locator => page.getByRole('region', { name: 'Bản đồ thu nhỏ', exact: true });
const zoomButtons = (page: Page): Locator => page.getByRole('group', { name: 'Cụm thu phóng', exact: true }).getByRole('button');
const toolRail = (page: Page): Locator => page.getByRole('toolbar', { name: 'Công cụ khung nhìn', exact: true });
const elevationScale = (page: Page): Locator => page.getByRole('list', { name: 'Cao độ tầng', exact: true });
const legend = (page: Page): Locator => page.getByRole('group', { name: 'Chú giải', exact: true });
const invitation = (page: Page): Locator => viewportOf(page).getByText(MT.emptyHint, { exact: true });

test.describe('SCR-25 measure — UI verify', () => {
  test('SCR-25 · FL-25-U1 · admin states on one project', async ({ browser }) => {
    test.setTimeout(480_000);
    const admin = await adminApi();
    let open: OpenPage | undefined;
    let projectId = '';
    try {
      projectId = await seedProject(admin, 'u25-1');
      open = await openAdminPage(browser);
      const { page } = open;

      await test.step('[25-F-001] model loaded, no record: mode bar clear of ViewCube + minimap, invitation on a surface, zoom targets >= 24 px (>= 44 at 375)', async () => {
        const rows: { width: number; bar: Box | null; cube: Box | null; map: Box | null; surface: string; zoom: number[] }[] = [];
        await verifyUi(page, 'U05m_25-F-001_model_loaded', async (p) => {
          await openMeasure(p, projectId);
          await expect(invitation(p)).toBeVisible();
          const sizes = await zoomButtons(p).evaluateAll((buttons) => buttons.map((button) => Math.min(button.getBoundingClientRect().width, button.getBoundingClientRect().height)));
          rows.push({
            width: widthOf(p),
            bar: await boxOf(modeBar(p)),
            cube: await boxOf(cube(p)),
            map: await boxOf(minimap(p)),
            surface: await invitation(p).evaluate((el) => getComputedStyle(el).backgroundColor),
            zoom: sizes,
          });
        });
        for (const row of rows) {
          expect.soft(intersects(row.bar, row.cube), `${row.width}: mode bar clears the ViewCube (BUG-375)`).toBe(false);
          expect.soft(intersects(row.bar, row.map), `${row.width}: mode bar clears the minimap (BUG-375)`).toBe(false);
          expect.soft(row.surface, `${row.width}: the invitation sits on a surface (BUG-483)`).not.toMatch(/^(rgba\(0, 0, 0, 0\)|transparent)$/u);
          const floor = row.width < 640 ? 44 : 24; // VCH:115,151
          expect.soft(row.zoom.filter((size) => size < floor), `${row.width}: zoom targets under ${floor} px (BUG-374)`).toEqual([]);
        }
      });

      await test.step('[25-F-002] "Đơn vị" open: the menu stays inside the viewport (flips up, BUG-484)', async () => {
        const menus: { width: number; box: Box | null; inside: boolean }[] = [];
        await verifyUi(page, 'U05m_25-F-002_unit_menu', async (p) => {
          await openMeasure(p, projectId);
          await p.getByRole('combobox', { name: MT.unit, exact: true }).click();
          const options = p.getByRole('option').filter({ hasText: /^(mm|cm|m)$/u });
          await expect(options.first()).toBeVisible();
          const first = await boxOf(options.first());
          const last = await boxOf(options.last());
          const box = first !== null && last !== null ? { x: Math.min(first.x, last.x), y: Math.min(first.y, last.y), width: Math.max(first.width, last.width), height: Math.max(first.y + first.height, last.y + last.height) - Math.min(first.y, last.y) } : null;
          menus.push({ width: widthOf(p), box, inside: insideViewport(p, box) });
        });
        for (const menu of menus) expect.soft(menu.inside, `${menu.width}: unit options inside the viewport`).toBe(true); // Select.tsx:186-197
      });

      await seedMeasurements(admin, projectId, seedR3());
      const r3 = seedR3();

      await test.step('[25-F-003] reload with R3: rows + pills; "Phép đo" aligned with "Thuộc tính" (BUG-377)', async () => {
        const rows: { width: number; rows: number; pills: number; headingX: number; sectionX: number }[] = [];
        await verifyUi(page, 'U05m_25-F-003_three_records', async (p) => {
          await openMeasure(p, projectId);
          await expect(measureList(p).getByRole('listitem')).toHaveCount(r3.length);
          const heading = await boxOf(p.getByRole('heading', { name: 'Thuộc tính', exact: true }));
          const section = await boxOf(p.getByRole('heading', { name: MT.list, exact: true }));
          rows.push({
            width: widthOf(p),
            rows: await measureList(p).getByRole('listitem').count(),
            pills: await viewportOf(p).locator('div.font-mono').count(),
            headingX: heading?.x ?? Number.NaN,
            sectionX: section?.x ?? Number.NaN,
          });
        });
        for (const row of rows) {
          expect.soft(row.rows, `${row.width}: one row per record`).toBe(r3.length);
          expect.soft(row.pills, `${row.width}: at least one value pill on the canvas`).toBeGreaterThan(0);
          // BUG-377 still applies at d50bb248 (VIN:65,119: the section is drawn outside the px-5 block): written as the CORRECT alignment.
          expect.soft(Math.abs(row.sectionX - row.headingX), `${row.width}: "Phép đo" left edge vs "Thuộc tính"`).toBeLessThanOrEqual(2);
        }
      });

      await test.step('[25-F-004] complete draft: value pill, pin / Esc / M pill and the hint stay inside the viewport', async () => {
        const rows: { width: number; pin: boolean; esc: boolean; toggle: boolean; hint: boolean | null; pill: number }[] = [];
        await verifyUi(
          page,
          'U05m_25-F-004_complete_draft',
          async (p) => {
            await openMeasure(p, projectId);
            await topView(p);
            await armMeasure(p);
            await makeDraft(p, { complete: true }); // UNKNOWN — NEED VERIFICATION
            rows.push({
              width: widthOf(p),
              pin: insideViewport(p, await boxOf(pinButton(p))),
              esc: insideViewport(p, await boxOf(p.getByRole('button', { name: MT.drop, exact: true }))),
              toggle: insideViewport(p, await boxOf(p.getByRole('button', { name: MT.toggle, exact: true }))),
              hint: (await p.getByText(MT.partialHint, { exact: true }).count()) === 0 ? null : insideViewport(p, await boxOf(p.getByText(MT.partialHint, { exact: true }))),
              pill: await viewportOf(p).locator('div.font-mono').count(),
            });
          },
          undefined,
          { fullPage: false },
        );
        for (const row of rows) {
          expect.soft(row.pin, `${row.width}: pin pill inside the viewport`).toBe(true);
          expect.soft(row.esc && row.toggle, `${row.width}: Esc and M pills inside the viewport`).toBe(true);
          expect.soft(row.pill, `${row.width}: the draft value pill`).toBeGreaterThan(0);
          if (row.hint !== null) expect.soft(row.hint, `${row.width}: partial hint inside the viewport`).toBe(true);
        }
      });

      await test.step('[25-F-005] delete a row: the undo toast is fully visible', async () => {
        const toasts: { width: number; inside: boolean }[] = [];
        let n = 0;
        await verifyUi(
          page,
          'U05m_25-F-005_undo_toast',
          async (p) => {
            n += 1;
            const extra: MeasurementSeed = { id: `MS-${String(5000 + n)}`, name: `${TEST_DATA_PREFIX}do-del-${String(n)}`, mode: 'pointToPoint', points: [{ x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }], rawValueMm: 1000 };
            await seedMeasurements(admin, projectId, [extra]); // a fresh row per width: each pass deletes one
            await openMeasure(p, projectId);
            await p.getByRole('button', { name: `Xoá ${extra.name}`, exact: true }).click();
            const toast = toastWith(p, 'Hoàn tác xoá').first();
            await expect(toast).toBeVisible();
            toasts.push({ width: widthOf(p), inside: insideViewport(p, await boxOf(toast)) });
          },
          undefined,
          { fullPage: false },
        );
        for (const toast of toasts) expect.soft(toast.inside, `${toast.width}: undo toast inside the viewport`).toBe(true); // NH:59-73
      });

      await test.step('[25-F-006] collapsed: the floating tool rail clears the elevation scale; the chip is visible', async () => {
        const rows: { width: number; rail: Box | null; scale: Box | null; chipInside: boolean }[] = [];
        await verifyUi(page, 'U05m_25-F-006_collapsed', async (p) => {
          await openMeasure(p, projectId);
          await p.getByRole('button', { name: MT.collapse, exact: true }).click();
          const chip = p.getByRole('button', { name: /phép đo — mở lại danh sách phép đo$/u });
          await expect(chip).toBeVisible();
          rows.push({ width: widthOf(p), rail: await boxOf(toolRail(p)), scale: await boxOf(elevationScale(p)), chipInside: withinWidth(p, await boxOf(chip)) });
        });
        for (const row of rows) {
          expect.soft(intersects(row.rail, row.scale), `${row.width}: tool rail vs elevation scale`).toBe(false); // VS:171-188, MTV:238-252
          expect.soft(row.chipInside, `${row.width}: chip inside the width`).toBe(true);
        }
      });
    } finally {
      await closePage(open);
      if (projectId !== '') await deleteSeededProject(admin, projectId);
      await admin.dispose();
    }
  });

  test('SCR-25 · FL-25-U2 · read-only and gate states', async ({ browser }) => {
    test.setTimeout(480_000);
    const admin = await adminApi();
    let viewerOpen: OpenPage | undefined;
    let adminOpen: OpenPage | undefined;
    const cleanup: string[] = [];
    try {
      const viewerProject = await seedProject(admin, 'u25-2v');
      cleanup.push(viewerProject);
      const r1 = seedR1();
      await seedMeasurements(admin, viewerProject, r1);
      const empty = await createProject(admin, 'u25-2z', 0); // M0
      cleanup.push(empty.projectId);
      const partial = await seedProject(admin, 'u25-2p', ['Tầng 1', 'Tầng trống'], 1); // MF
      cleanup.push(partial);
      const viewer = await poolUser(admin, 'viewer', 'p05-roles');
      await addProjectMember(admin, viewerProject, viewer.email);
      viewerOpen = await openPoolPage(browser, viewer);
      adminOpen = await openAdminPage(browser);
      const vp = viewerOpen.page;
      const ap = adminOpen.page;

      await test.step('[25-F-007] viewer: the three notices fit, the pin is disabled', async () => {
        const rows: { width: number; notices: number; inside: boolean; pin: boolean }[] = [];
        await verifyUi(
          vp,
          'U05m_25-F-007_viewer',
          async (p) => {
            await openMeasure(p, viewerProject);
            await expect(p.getByText(MT.pinBlocked, { exact: true })).toHaveCount(2); // overlay (MTV) + list (MTL:226-228)
            await topView(p);
            await armMeasure(p);
            await makeDraft(p, { complete: false }); // UNKNOWN — NEED VERIFICATION
            const boxes: (Box | null)[] = [
              ...(await p.getByText(MT.pinBlocked, { exact: true }).evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as Box))),
              await boxOf(p.getByText(MT.viewOnlyTitle, { exact: true })),
            ];
            rows.push({ width: widthOf(p), notices: boxes.filter((box) => box !== null).length, inside: boxes.every((box) => withinWidth(p, box)), pin: await pinButton(p).isDisabled() });
          },
          undefined,
          { fullPage: false },
        );
        for (const row of rows) {
          expect.soft(row.notices, `${row.width}: three notices`).toBe(3); // VIN:82-89, MTV:265-269, MTL:226-228
          expect.soft(row.inside, `${row.width}: notices inside the width`).toBe(true);
          expect.soft(row.pin, `${row.width}: pin disabled for a viewer`).toBe(true);
        }
      });

      await test.step('[25-F-008] zero-floor project: no overflow, no corner controls', async () => {
        const rows: { width: number; corner: number }[] = [];
        await verifyUi(ap, 'U05m_25-F-008_zero_floors', async (p) => {
          await openMeasure(p, empty.projectId);
          rows.push({ width: widthOf(p), corner: (await cube(p).count()) + (await zoomButtons(p).count()) + (await legend(p).count()) + (await elevationScale(p).count()) });
        });
        for (const row of rows) expect.soft(row.corner, `${row.width}: no ViewCube / zoom / legend / elevation scale (BUG-486)`).toBe(0); // VS:183-215
      });

      await test.step('[25-F-009] unknown id: the not-found state is centred', async () => {
        const rows: { width: number; offset: number }[] = [];
        await verifyUi(ap, 'U05m_25-F-009_not_found', async (p) => {
          await p.goto(ROUTES.project.measure(unknownProjectId()));
          const title = p.getByText(GATE.notFoundTitle, { exact: true });
          await expect(title).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
          const box = await boxOf(title);
          rows.push({ width: widthOf(p), offset: box === null ? Number.NaN : Math.abs(box.x + box.width / 2 - widthOf(p) / 2) });
        });
        for (const row of rows) expect.soft(row.offset, `${row.width}: title centred (px off the page middle)`).toBeLessThanOrEqual(40); // PSG:48-61
      });

      await test.step('[25-F-010] partial project: the second storey chip is dimmed, the rails fit', async () => {
        const rows: { width: number; opacity: string; railInside: boolean }[] = [];
        await verifyUi(ap, 'U05m_25-F-010_partial', async (p) => {
          await openMeasure(p, partial);
          const chip = p.getByRole('option', { name: /^Tầng trống, cao độ / });
          await expect(chip).toBeVisible();
          rows.push({ width: widthOf(p), opacity: await chip.evaluate((el) => getComputedStyle(el).opacity), railInside: withinWidth(p, await boxOf(p.getByLabel('Tầng', { exact: true }))) });
        });
        for (const row of rows) {
          expect.soft(Number(row.opacity), `${row.width}: chip of the floor without rooms is dimmed`).toBeLessThan(1); // VSR:80
          expect.soft(row.railInside, `${row.width}: storey rail inside the width`).toBe(true);
        }
      });
    } finally {
      await closePage(viewerOpen);
      await closePage(adminOpen);
      for (const id of cleanup) await deleteSeededProject(admin, id);
      await admin.dispose();
    }
  });

  test('SCR-25 · FL-25-U3 · [mocked response] error and loading states — pairs FL-25-U1 / FL-25-01', async ({ browser }) => {
    test.setTimeout(480_000);
    const admin = await adminApi();
    let open: OpenPage | undefined;
    let projectId = '';
    try {
      projectId = await seedProject(admin, 'u25-3');
      await seedMeasurements(admin, projectId, seedR1());
      open = await openAdminPage(browser);
      const { page } = open;

      await test.step('[25-F-011] #16 -> 500: the alert and "Thử lại" are not under the minimap (BUG-474)', async () => {
        const mock = await interceptApi(page, measurementsRe(projectId), 'GET', failWith(500, 'INTERNAL_ERROR'));
        const rows: { width: number; retry: Box | null; map: Box | null; blocker: string | null }[] = [];
        try {
          await verifyUi(page, 'U05m_25-F-011_list_error', async (p) => {
            await p.goto(ROUTES.project.measure(projectId));
            const alert = p.getByRole('alert').filter({ hasText: MT.loadError });
            await expect(alert).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
            const retry = alert.getByRole('button', { name: MT.retry, exact: true });
            rows.push({ width: widthOf(p), retry: await boxOf(retry), map: await boxOf(minimap(p)), blocker: await trialClickBlocker(retry) });
          });
        } finally {
          await mock.off();
        }
        for (const row of rows) {
          expect.soft(intersects(row.retry, row.map), `${row.width}: "Thử lại" vs minimap`).toBe(false);
          expect.soft(row.blocker, `${row.width}: "Thử lại" receives the click`).toBeNull();
        }
      });

      await test.step('[25-F-012] N15 held: the skeleton fills the viewport', async () => {
        let release: () => void = () => undefined;
        const gate = new Promise<void>((resolve) => (release = resolve));
        const match = (url: URL): boolean => spatialRe(projectId).test(url.pathname);
        const handler = async (route: Route): Promise<void> => {
          if (route.request().method() !== 'GET') {
            await route.fallback();
            return;
          }
          await gate; // the real request, delayed until every width was shot
          await route.continue().catch(() => undefined);
        };
        await page.route(match, handler);
        const rows: { width: number; skeleton: Box | null; main: Box | null }[] = [];
        try {
          await verifyUi(page, 'U05m_25-F-012_loading', async (p) => {
            await p.goto(ROUTES.project.measure(projectId));
            const skeleton = viewportOf(p).locator('.animate-pulse').first();
            await expect(skeleton).toBeVisible();
            await expect(viewportOf(p)).toHaveAttribute('aria-busy', 'true');
            rows.push({ width: widthOf(p), skeleton: await boxOf(viewportOf(p).locator('div.min-h-\\[400px\\]')), main: await boxOf(viewportOf(p)) });
          });
        } finally {
          release();
          await page.unroute(match, handler);
        }
        for (const row of rows) {
          // VVP:153-157 the canvas skeleton is `h-full w-full` of a padded (p-12) box: at least 60 % of the viewport width.
          expect.soft((row.skeleton?.width ?? 0) / (row.main?.width ?? 1), `${row.width}: skeleton share of the viewport width`).toBeGreaterThan(0.6);
        }
      });

      await test.step('[25-F-013] N15 -> 500: the error EmptyState is centred', async () => {
        const mock = await interceptApi(page, spatialRe(projectId), 'GET', failWith(500, 'INTERNAL_ERROR'));
        const rows: { width: number; offset: number }[] = [];
        try {
          await verifyUi(page, 'U05m_25-F-013_gate_error', async (p) => {
            await p.goto(ROUTES.project.measure(projectId));
            const title = p.getByText(GATE.unknownTitle, { exact: true });
            await expect(title).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
            const box = await boxOf(title);
            rows.push({ width: widthOf(p), offset: box === null ? Number.NaN : Math.abs(box.x + box.width / 2 - widthOf(p) / 2) });
          });
        } finally {
          await mock.off();
        }
        for (const row of rows) expect.soft(row.offset, `${row.width}: title centred (px off the page middle)`).toBeLessThanOrEqual(40); // PSG:78-91
      });

      await test.step('[25-F-014] POST #17 -> 500: the failed-pin toast is visible', async () => {
        const mock = await interceptApi(page, measurementsRe(projectId), 'POST', failWith(500, 'INTERNAL_ERROR'));
        const rows: { width: number; inside: boolean }[] = [];
        try {
          await verifyUi(
            page,
            'U05m_25-F-014_pin_failed',
            async (p) => {
              await openMeasure(p, projectId);
              await topView(p);
              await armMeasure(p);
              await makeDraft(p, { complete: true }); // UNKNOWN — NEED VERIFICATION
              await pinButton(p).click();
              const toast = toastWith(p, MT.pinFailed).first();
              await expect(toast).toBeVisible({ timeout: 15_000 });
              rows.push({ width: widthOf(p), inside: insideViewport(p, await boxOf(toast)) });
            },
            undefined,
            { fullPage: false },
          );
        } finally {
          await mock.off();
        }
        for (const row of rows) expect.soft(row.inside, `${row.width}: toast inside the viewport`).toBe(true); // NH:59-73
      });
    } finally {
      await closePage(open);
      if (projectId !== '') await deleteSeededProject(admin, projectId);
      await admin.dispose();
    }
  });
});
