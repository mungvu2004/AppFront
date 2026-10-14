/**
 * Phase 5 — SCR-25 Measurement tool, branches the shared stack cannot produce (QA-05c S3, pack P5; plan
 * `flows-C4.md` "phase05_measure_mocked_edge.spec.ts"). One test per flow, one `test.step('[<row id>] …')` per catalog row.
 *
 * Source (FE master d50bb248): MTV src/screens/viewer/MeasurementTool/MeasurementTool.tsx · UMT …/useMeasurementTool.ts (copy,
 * toasts) · MTL …/MeasurementList.tsx · MUT src/lib/mutations/measurement.ts · PSG src/components/feedback/ProjectSpatialGate.tsx
 * · UPS src/hooks/useProjectSpatial.ts · UVS src/screens/viewer/ViewerShell/useViewerShell.ts · I18N src/i18n/vi.json `errors.*`.
 *
 * Mocks (every flow is "[mocked response]"; 5xx / network loss / a record the strict schema refuses cannot be made on the shared stack):
 *   FL-25-M1 GET /api/projects/:p/measurements -> 500, abort, record id "M-1"      pairs FL-25-01 [25-G-006] (real 200)
 *   FL-25-M2 POST measurements -> 500 then abort, 409 x2, 409 after a real delete; DELETE measurement -> 500
 *                                                                              pairs FL-25-05 [25-A-029], FL-25-12 [25-C-029] [25-C-036], FL-25-11 [25-A-039]
 *   FL-25-M3 GET /api/projects/:p/spatial held / 500 / abort / 500 on a refetch; GET /api/projects/:p 500 on the name read;
 *            N15 answer with two axes added (BE v1 sends axes: [])             pairs FL-25-01 [25-G-001] [25-G-004] [25-B-002]
 * A held request is the real one, delayed by a promise; a "no mock" call of `interceptApi` falls through.
 *
 * Budget per run: logins 3 (admin API `signedInApi` + admin browser login per flow, no shared session file); `POST /api/auth/refresh`
 * about 1 per page load (< 25); `POST /api/projects` 3 (+3 DELETE in `finally`); `PUT …/spatial/layer` 3; `POST measurements` 1 per seed
 * plus the real pin of 25-C-016; `DELETE measurements` 1 (25-C-037). No upload, no invitation, no mail.
 */
import { expect, test } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { captureEvidence } from './support/evidence';
import { deleteSeededProject } from './support/phase03Seed';
import { adminApi, closePage, holdFirst, openAdminPage, type OpenPage } from './support/p03/P4';
import {
  ERROR_PAINT_TIMEOUT_MS,
  GATE,
  MT,
  SCENE_TIMEOUT_MS,
  abortRoute,
  armMeasure,
  failWith,
  fulfillPatched,
  geometryPoints,
  hoverUntilSnap,
  interceptApi,
  makeDraft,
  measurementRe,
  measurementsRe,
  openMeasure,
  pinButton,
  projectRe,
  rowLabel,
  modelMapper,
  discCount,
  seedMeasurements,
  seedProject,
  seedR1,
  settledCanvas,
  spaGo,
  spatialRe,
  toastWith,
  topView,
  trialClickBlocker,
  viewportOf,
  withAxes,
  withBadRecordId,
  type Intercept,
} from './support/p05/P5';

test.describe('SCR-25 measure — mocked responses', () => {
  test('SCR-25 · FL-25-M1 · [mocked response] #16 read failures — pairs FL-25-01 [25-G-006] (real 200)', async ({ browser }) => {
    test.setTimeout(180_000);
    const admin = await adminApi();
    let open: OpenPage | undefined;
    let projectId = '';
    const mocks: Intercept[] = [];
    try {
      projectId = await seedProject(admin, 'm25-m1');
      const record = seedR1()[0];
      if (record === undefined) throw new Error('seed: R1 empty');
      await seedMeasurements(admin, projectId, [record]);
      open = await openAdminPage(browser);
      const { page } = open;
      const alert = page.getByRole('alert').filter({ hasText: MT.loadError });
      const dropMocks = async (): Promise<void> => {
        for (const mock of mocks.splice(0)) await mock.off();
      };

      await test.step('[25-B-007] GET #16 -> 500: alert "Chưa tải được danh sách phép đo…" + "Thử lại"; the viewport stays', async () => {
        mocks.push(await interceptApi(page, measurementsRe(projectId), 'GET', failWith(500, 'INTERNAL_ERROR')));
        await page.goto(ROUTES.project.measure(projectId));
        await expect(alert).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS }); // UMT:936-937 rowsQuery.isError -> 'error'; MTV:271-279
        await expect(alert.getByRole('button', { name: MT.retry, exact: true })).toBeVisible();
        await expect(viewportOf(page)).toBeVisible(); // never blank (A11)
        await captureEvidence(page, 'E05m_25-B-007_list_500.png');
      });

      await test.step('[25-B-008] unroute: "Thử lại" receives the click (BUG-474), GET #16 200, alert gone, row back', async () => {
        await dropMocks();
        const retry = alert.getByRole('button', { name: MT.retry, exact: true });
        // BUG-474 / BUG-495: a covered button is an app bug (minimap over the alert), not a missing refetch.
        const blocker = await trialClickBlocker(retry);
        expect.soft(blocker, '"Thử lại" in the load-error alert receives the click').toBeNull();
        const refetch = waitForApi(page, 'GET', measurementsRe(projectId), [200]);
        if (blocker === null) await retry.click(); // UMT:886-890 refetch
        else await retry.dispatchEvent('click'); // covered: the bug is reported above, the flow goes on
        await refetch;
        await expect.soft(alert).toHaveCount(0);
        await expect.soft(page.getByRole('button', { name: rowLabel(record.name) })).toHaveCount(1);
        await captureEvidence(page, 'E05m_25-B-008_retry_recovers.png');
      });

      await test.step('[25-B-009] reload with the GET #16 aborted: the same alert text', async () => {
        mocks.push(await interceptApi(page, measurementsRe(projectId), 'GET', abortRoute));
        await page.reload();
        await expect.soft(alert).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS }); // UMT:194-195 one copy for every failure
        await captureEvidence(page, 'E05m_25-B-009_list_abort.png');
      });

      await test.step('[25-B-010] reload with a record id "M-1": the same alert, no raw code', async () => {
        await dropMocks();
        mocks.push(await interceptApi(page, measurementsRe(projectId), 'GET', (route) => fulfillPatched(route, withBadRecordId)));
        await page.reload();
        await expect.soft(alert).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS }); // MTG:617-621, SCH:26-45 strict schema
        await expect.soft(page.getByText('M-1', { exact: false })).toHaveCount(0);
        await expect.soft(page.getByText(/ZodError|invalid_string|Invalid/u)).toHaveCount(0);
        await captureEvidence(page, 'E05m_25-B-010_list_bad_id.png');
      });
    } finally {
      for (const mock of mocks) await mock.off().catch(() => undefined);
      await closePage(open);
      if (projectId !== '') await deleteSeededProject(admin, projectId);
      await admin.dispose();
    }
  });

  test('SCR-25 · FL-25-M2 · [mocked response] write failures — pairs FL-25-05 [25-A-029], FL-25-12 [25-C-029] / [25-C-036], FL-25-11 [25-A-039]', async ({ browser }) => {
    test.setTimeout(240_000);
    const admin = await adminApi();
    let open: OpenPage | undefined;
    let projectId = '';
    const mocks: Intercept[] = [];
    try {
      projectId = await seedProject(admin, 'm25-m2');
      const record = seedR1()[0];
      if (record === undefined) throw new Error('seed: R1 empty');
      await seedMeasurements(admin, projectId, [record]);
      open = await openAdminPage(browser);
      const { page } = open;
      const dropMocks = async (): Promise<void> => {
        for (const mock of mocks.splice(0)) await mock.off();
      };
      const pin = pinButton(page);

      await test.step('[25-C-031] POST #17 -> 500, then aborted: toast "Chưa ghim được phép đo, hãy thử lại" both times; the pin button stays (draft kept)', async () => {
        await openMeasure(page, projectId);
        await topView(page);
        await armMeasure(page);
        await makeDraft(page, { complete: true }); // UNKNOWN — NEED VERIFICATION: canvas picks were not run in S3
        const post = await interceptApi(page, measurementsRe(projectId), 'POST', (route, n) => (n === 1 ? failWith(500, 'INTERNAL_ERROR')(route) : abortRoute(route)));
        mocks.push(post);
        await pin.click();
        await expect(toastWith(page, MT.pinFailed).first()).toBeVisible({ timeout: 15_000 }); // UMT:214,808-812
        await expect(pin).toBeVisible(); // draft points are dropped only after saveMeasurement succeeds (UMT:786-788)
        await expect(pin).toBeEnabled(); // the in-flight latch reopened
        await captureEvidence(page, 'E05m_25-C-031_pin_500.png');
        // The first toast lives 8 s and the bus merges same-type toasts: wait it out, so the second one is a new toast.
        await expect(toastWith(page, MT.pinFailed)).toHaveCount(0, { timeout: 15_000 });
        await pin.click();
        await expect.poll(() => post.calls(), { message: 'the second pin reached the network (aborted)' }).toBeGreaterThanOrEqual(2);
        await expect.soft(toastWith(page, MT.pinFailed).first()).toBeVisible({ timeout: 15_000 });
        await expect.soft(pin).toBeVisible();
      });

      await test.step('[25-C-030] POST -> 409 MEASUREMENT_ID_TAKEN twice with a GET between: toast "Mã phép đo vừa bị một phiên khác dùng; hãy ghim lại"', async () => {
        await dropMocks();
        const order: string[] = [];
        mocks.push(
          await interceptApi(page, measurementsRe(projectId), 'POST', (route) => {
            order.push('POST');
            return failWith(409, 'MEASUREMENT_ID_TAKEN')(route);
          }),
          await interceptApi(page, measurementsRe(projectId), 'GET', (route) => {
            order.push('GET');
            return route.fallback();
          }),
        );
        await expect(pin).toBeEnabled();
        await pin.click();
        await expect.soft(toastWith(page, MT.idTaken).first()).toBeVisible({ timeout: 15_000 }); // UMT:211, MTG:662-667 original error shown
        expect.soft(order.join(' '), 'POST -> re-read -> second POST, both refused').toMatch(/POST.*GET.*POST/u);
        await captureEvidence(page, 'E05m_25-C-030_id_taken_twice.png');
      });

      await test.step('[25-C-035] DELETE -> 500: toast "Chưa xoá được phép đo, hãy thử lại", the row is restored', async () => {
        await dropMocks();
        await page.getByRole('button', { name: MT.drop, exact: true }).click(); // leave the draft, it is not this step's subject
        mocks.push(await interceptApi(page, measurementRe(projectId), 'DELETE', failWith(500, 'INTERNAL_ERROR')));
        await page.getByRole('button', { name: `Xoá ${record.name}`, exact: true }).click();
        await expect.soft(toastWith(page, MT.deleteFailed).first()).toBeVisible({ timeout: 15_000 }); // UMT:215, MUT createOptimisticMutation restore
        await expect.soft(page.getByRole('button', { name: rowLabel(record.name) })).toHaveCount(1);
        await captureEvidence(page, 'E05m_25-C-035_delete_500.png');
      });

      await test.step('[25-C-037] real delete, then the undo POSTs -> 409 + 409: toast "Chưa hoàn tác được việc xoá phép đo"', async () => {
        await dropMocks();
        const post = await interceptApi(page, measurementsRe(projectId), 'POST', failWith(409, 'MEASUREMENT_ID_TAKEN'));
        mocks.push(post);
        const removed = waitForApi(page, 'DELETE', measurementRe(projectId), [200, 204]);
        await page.getByRole('button', { name: `Xoá ${record.name}`, exact: true }).click();
        await removed;
        await expect(toastWith(page, 'Hoàn tác xoá').first()).toBeVisible(); // the 8 s undo toast (A8)
        await page.getByRole('button', { name: MT.undo, exact: true }).click();
        await expect.soft(toastWith(page, MT.undoFailed).first()).toBeVisible({ timeout: 15_000 }); // UMT:218,370-376, MUT:189-200
        expect.soft(post.calls(), 'the undo POSTed, re-read and POSTed again').toBeGreaterThanOrEqual(2);
        await captureEvidence(page, 'E05m_25-C-037_undo_failed.png');
      });
    } finally {
      for (const mock of mocks) await mock.off().catch(() => undefined);
      await closePage(open);
      if (projectId !== '') await deleteSeededProject(admin, projectId);
      await admin.dispose();
    }
  });

  test('SCR-25 · FL-25-M3 · [mocked response] gate, loading, crumb name, axes — pairs FL-25-01 [25-G-001] [25-G-004] [25-B-002]', async ({ browser }) => {
    test.setTimeout(240_000);
    const admin = await adminApi();
    let open: OpenPage | undefined;
    let projectId = '';
    const mocks: Intercept[] = [];
    try {
      projectId = await seedProject(admin, 'm25-m3');
      open = await openAdminPage(browser);
      const { page } = open;
      const dropMocks = async (): Promise<void> => {
        for (const mock of mocks.splice(0)) await mock.off();
      };
      const gateAlert = page.getByRole('alert').filter({ hasText: GATE.unknownText });
      const settled = async (): Promise<void> => {
        await expect(viewportOf(page)).toHaveAttribute('aria-busy', 'false', { timeout: SCENE_TIMEOUT_MS });
      };

      await test.step('[25-B-001] N15 held: main aria-busy="true", skeletons, live "Đang dựng mô hình…"; released afterwards', async () => {
        const hold = await holdFirst(page, (url, method) => method === 'GET' && spatialRe(projectId).test(url.pathname));
        await page.goto(ROUTES.project.measure(projectId));
        await hold.seen;
        await expect(viewportOf(page)).toHaveAttribute('aria-busy', 'true'); // VVP:111
        await expect.soft(viewportOf(page).locator('.animate-pulse').first(), 'canvas skeleton').toBeVisible(); // VVP:153-157
        await expect.soft(page.getByRole('complementary', { name: 'Thanh tra đối tượng', exact: true }).locator('.animate-pulse').first(), 'property skeleton').toBeVisible(); // VIN:76-80
        await expect.soft(page.getByText(MT.building, { exact: true })).toBeAttached(); // VSB:33-35 sr-only live region
        await captureEvidence(page, 'E05m_25-B-001_loading.png');
        await hold.release();
        await settled();
      });

      await test.step('[25-B-020] reload, N15 -> 500: alert "Có trục trặc" / "Hệ thống đã ghi nhận…" + retry, which recovers', async () => {
        mocks.push(await interceptApi(page, spatialRe(projectId), 'GET', failWith(500, 'INTERNAL_ERROR')));
        await page.reload();
        await expect.soft(gateAlert).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS }); // PSG:78-91
        await expect.soft(gateAlert).toContainText(GATE.unknownTitle);
        await captureEvidence(page, 'E05m_25-B-020_gate_500.png');
        await dropMocks();
        await gateAlert.getByRole('button', { name: MT.retry, exact: true }).click(); // a 5xx read is retryable (toAppError.ts:280)
        await settled();
        await expect.soft(gateAlert).toHaveCount(0);
      });

      await test.step('[25-B-021] reload, N15 aborted: "Mất kết nối" / "Không liên lạc được với máy chủ…"', async () => {
        mocks.push(await interceptApi(page, spatialRe(projectId), 'GET', abortRoute));
        await page.reload();
        const alert = page.getByRole('alert').filter({ hasText: GATE.networkText });
        await expect.soft(alert).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS }); // I18N errors.network
        await expect.soft(alert).toContainText(GATE.networkTitle);
        await captureEvidence(page, 'E05m_25-B-021_gate_network.png');
        await dropMocks();
      });

      await test.step('[25-B-022] SPA to the project settings and back with the second N15 -> 500: band "Không tải lại được mô hình." + "Thử lại", screen kept', async () => {
        await page.reload();
        await settled();
        mocks.push(await interceptApi(page, spatialRe(projectId), 'GET', failWith(500, 'INTERNAL_ERROR')));
        await spaGo(page, ROUTES.project.settings(projectId));
        await expect(viewportOf(page)).toHaveCount(0); // the measure screen unmounted, the graph stays in the store
        await page.goBack();
        await expect(viewportOf(page)).toBeVisible();
        await expect.soft(page.getByText(MT.refreshFailed, { exact: true })).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS }); // PSG:93-104, UPS refreshFailed
        await expect.soft(page.getByRole('button', { name: MT.retry, exact: true }).first()).toBeVisible();
        await captureEvidence(page, 'E05m_25-B-022_refetch_band.png');
        await dropMocks();
      });

      await test.step('[25-G-003] UNKNOWN — NEED VERIFICATION (which read is the 2nd): reload, 1st GET /api/projects/:id -> 500: crumb "Dự án"', async () => {
        // The 1st read is the shell's name read (it never throws: `readProjectName` answers null), the 2nd is the gate's own (E2-T2): only
        // the 1st is failed, so the gate stays up and the crumb falls back (UVS:1072). UNKNOWN — NEED VERIFICATION of that order.
        const project = await interceptApi(page, projectRe(projectId), 'GET', (route, n) => (n === 1 ? failWith(500, 'INTERNAL_ERROR')(route) : route.fallback()));
        mocks.push(project);
        await page.reload();
        await expect.soft(viewportOf(page)).toHaveAttribute('aria-busy', 'false', { timeout: SCENE_TIMEOUT_MS });
        expect.soft(project.calls(), 'both project reads happened').toBeGreaterThanOrEqual(2);
        await expect.soft(page.getByRole('navigation', { name: 'Đường dẫn màn hình', exact: true })).toContainText('Dự án'); // UVS:1072, VSG:289
        await captureEvidence(page, 'E05m_25-G-003_crumb_fallback.png');
        await dropMocks();
      });

      await test.step('[25-C-016] N15 answer + 2 axes (vertical x = 2000, horizontal y = 3000), top view, hover (2000,3000): chip "Giao trục"; pinned point (2000,3000)', async () => {
        mocks.push(await interceptApi(page, spatialRe(projectId), 'GET', (route) => fulfillPatched(route, withAxes)));
        await page.reload();
        await settled();
        await topView(page);
        await armMeasure(page);
        await page.mouse.move(5, 5);
        const points = await geometryPoints(await settledCanvas(page));
        // (2000,3000) -> pixel from the model's real pixel bounds, then a spiral hover until the chip says "Giao trục".
        const { pixelOf, scale } = modelMapper(points);
        const hit = await hoverUntilSnap(page, 'Giao trục', [pixelOf([2000, 3000])], Math.max(12, scale * 110), Math.max(2, scale * 50));
        expect.soft(hit, 'a hover near (2000,3000) reads "Giao trục"').not.toBeNull(); // MTG:248-269
        await captureEvidence(page, 'E05m_25-C-016_axis_snap.png');
        if (hit !== null) {
          const before = await discCount(page);
          await page.mouse.click(hit[0], hit[1]);
          await expect.poll(() => discCount(page), { message: 'first point picked' }).toBe(before + 1);
          // second point: a far outer corner of the model
          const second = await hoverUntilSnap(page, 'Đỉnh', [pixelOf([8000, 6000])], Math.max(12, scale * 110), Math.max(2, scale * 50));
          expect.soft(second, 'a vertex for the second point').not.toBeNull();
          if (second !== null) {
            await page.mouse.click(second[0], second[1]);
            await expect.poll(() => discCount(page), { message: 'second point picked' }).toBe(before + 2);
            const sent = page.waitForRequest((request) => request.method() === 'POST' && measurementsRe(projectId).test(new URL(request.url()).pathname));
            await pinButton(page).click();
            const body = (await sent).postDataJSON() as { points?: { x: number; y: number }[] };
            const first = body.points?.[0];
            expect.soft(Math.abs((first?.x ?? Number.NaN) - 2000), 'pinned x').toBeLessThanOrEqual(1);
            expect.soft(Math.abs((first?.y ?? Number.NaN) - 3000), 'pinned y').toBeLessThanOrEqual(1);
          }
        }
        await dropMocks();
      });
    } finally {
      for (const mock of mocks) await mock.off().catch(() => undefined);
      await closePage(open);
      if (projectId !== '') await deleteSeededProject(admin, projectId);
      await admin.dispose();
    }
  });
});
