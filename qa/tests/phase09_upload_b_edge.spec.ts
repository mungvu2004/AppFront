/**
 * Phase 09 — role matrix, upload group b (SCR-09..16): FL-9U-05..09. Real stack (f14), pool users, no mocks.
 * Source: QA-09 flows-C2.md FL-9U-05..09; BE gates floors/router.py:26-67, drawings/router.py:36-80, quality/router.py:25-49,
 * spatial_write/router.py:45-50 (the gate runs before body validation, so a 403 comes from the role).
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { signInAdmin } from './support/auth';
import { attachJson, captureEvidence } from './support/evidence';
import { FOUR_CORNERS, expectLoginRedirect, openRole, statusCode, uploadRoutes } from './support/p09/P4';
import { GRAPH } from './support/p03/P10';
import { PF } from './support/p03/P8';
import { DESKTOP, adminApi, apiAs, mainProject, roleUser } from './support/p09/roles';
import {
  addProjectMember,
  createDrawingProject,
  createFailedRunProject,
  createProject,
  deleteSeededProject,
  envDrawingPng,
  listFloors,
} from './support/phase03Seed';

const ADD_FLOOR = 'Thêm tầng'; // FloorManager toolbar
const NOT_FOUND = 'Không tìm thấy dự án này'; // ProjectSpatialGate
const BACK = 'Về danh sách dự án';
const READ_ONLY = 'Vai hiện tại chỉ được xem danh sách tệp, không tải lên và không sửa.'; // UFU COPY.readOnly
const DROPZONE = 'floor-upload-dropzone';
const CANCEL_RUN = 'Huỷ xử lý';
const NO_RUN = 'Chưa có lượt xử lý nào để kể lại';
const APPLY_SCALE = 'Áp dụng tỷ lệ';
const NEED_EDIT = 'Chỉ người có quyền sửa mới xác nhận được.';
const USE_CAD = 'Dùng đường từ CAD';
const USE_AI = 'Vẫn dùng AI';
const IMPORT_GEO = 'Nhập hình học';
const TECH = 'Chi tiết kỹ thuật';
const CONTINUE = 'Tiếp tục xử lý';
const OTHER_DRAWING = 'Tải bản vẽ khác';
const FAILED_ALERT = /không hoàn tất được/u; // failed-run alert of the pipeline screen
const OVERLAY_REGION = 'Màn đối chiếu bản vẽ';
const CONFIRM_MODEL = 'Xác nhận mô hình khớp bản vẽ';

const ev = (page: Page, id: string, slug: string): Promise<unknown> => captureEvidence(page, `E09_${id}_${slug}.png`);
const btn = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const unknown = (what: string): void => {
  test.info().annotations.push({ type: 'unknown', description: `UNKNOWN — NEED VERIFICATION: ${what}` });
};
const floorIds = async (api: APIRequestContext, projectId: string): Promise<string[]> =>
  (await listFloors(api, projectId)).map((f) => f.id);

test('SCR-09 · SCR-10 · SCR-11 · FL-9U-05 · engineer · engineer ghi tren du an rieng: tang + tai len + chat luong', async ({ browser }) => {
  test.setTimeout(240_000);
  const admin = await adminApi();
  const engineer = await roleUser(admin, 'engineer', 'up-b');
  const proj = await createDrawingProject(admin, 'p09-up-e', envDrawingPng(), ['Tầng 1', 'Tầng 2']);
  const { projectId } = proj;
  let session: Awaited<ReturnType<typeof openRole>> | undefined;
  let api: APIRequestContext | undefined;
  try {
    await addProjectMember(admin, projectId, engineer.email);
    session = await openRole(browser, engineer);
    api = await apiAs(engineer);
    const { page } = session;
    const [f1, f2] = await floorIds(admin, projectId);
    if (f1 === undefined || f2 === undefined) throw new Error('setup: 2 floors expected');
    let addedId = '';

    await test.step('[9U-D-013] engineer: "Thêm tầng" → POST 201, new row', async () => {
      await page.goto(ROUTES.project.floors(projectId));
      const add = btn(page, ADD_FLOOR);
      await expect(add).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText('Không có quyền sửa tầng', { exact: true })).toHaveCount(0);
      const created = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith(`/api/projects/${projectId}/floors`));
      await add.click();
      expect((await created).status()).toBe(201); // floors/router.py:30
      const ids = await floorIds(admin, projectId);
      expect(ids).toHaveLength(3);
      addedId = ids.find((id) => id !== f1 && id !== f2) ?? '';
      expect(addedId).not.toBe('');
      await ev(page, '9U-D-013', 'engineer_add_floor');
    });

    await test.step('[9U-D-014] engineer: delete the new floor → 2xx, not 403', async () => {
      unknown('9U-D-014 kebab "Xoá tầng" menu not driven; DELETE /api/floors/:id issued as the engineer');
      const res = await api!.delete(`/api/floors/${addedId}`);
      expect.soft(res.status(), 'DELETE /floors/:id (FloorAccess layer.edit)').toBeLessThan(300);
      expect.soft(res.status()).not.toBe(403);
      await ev(page, '9U-D-014', 'engineer_delete_floor');
    });

    await test.step('[9U-D-015] engineer: PATCH /floors/reorder accepted', async () => {
      const res = await api!.patch('/api/floors/reorder', { data: { floorIds: [f2, f1] } });
      expect.soft(res.status(), 'ListAccess layer.edit').toBe(200);
      await ev(page, '9U-D-015', 'engineer_reorder');
    });

    await test.step('[9U-D-026] engineer: drop zone + upload init 200', async () => {
      await page.goto(ROUTES.project.upload(projectId));
      await expect.soft(page.getByTestId(DROPZONE)).toBeVisible({ timeout: 20_000 });
      await expect.soft(page.getByText(READ_ONLY, { exact: true })).toHaveCount(0);
      const res = await api!.post(`/api/projects/${projectId}/floors/${f2}/drawings/uploads`, {
        data: { fileName: 'ban-ve.png', floorId: f2, mimeType: 'image/png', projectId, sizeBytes: 16 },
      });
      expect.soft(res.status(), 'init (FL-10-12)').toBe(200);
      await ev(page, '9U-D-026', 'engineer_upload');
    });

    await test.step('[9U-D-035] engineer: "Tiếp tục xử lý" / "Tải bản vẽ khác" on quality', async () => {
      await page.goto(ROUTES.project.quality(projectId));
      await expect.soft(page.getByText(CONTINUE, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
      await expect.soft(page.getByText(OTHER_DRAWING, { exact: true }).first()).toBeVisible();
      unknown('9U-D-035 "Tải bản vẽ khác" → /upload navigation not clicked (control role unverified)');
      await ev(page, '9U-D-035', 'engineer_quality_actions');
    });

    await test.step('[9U-D-036] engineer: POST corners accepted', async () => {
      const res = await api!.post(`/api/projects/${projectId}/floors/${f1}/quality/corners`, { data: FOUR_CORNERS });
      await attachJson('E09_9U-D-036_corners.json', await statusCode(res));
      expect.soft(res.status(), 'quality/router.py:40 floor.upload').toBeLessThan(300);
      await ev(page, '9U-D-036', 'engineer_corners');
    });
  } finally {
    await session?.context.close();
    await api?.dispose();
    await deleteSeededProject(admin, projectId);
    await admin.dispose();
  }
});

test('SCR-12 · SCR-13 · SCR-14 · SCR-15 · SCR-16 · FL-9U-06 · engineer · engineer: pipeline/do thi/ti le/doi chieu/CAD + non-member', async ({ browser }) => {
  test.setTimeout(240_000);
  const admin = await adminApi();
  const engineer = await roleUser(admin, 'engineer', 'up-b');
  const nm = await createProject(admin, 'p09-up-nm', 1); // NM: the engineer is NOT a member
  const pe = await createProject(admin, 'p09-up-pe', 1); // PE: never ran
  const pf = await createFailedRunProject(admin, 'p09-up-pf', 'FILE_CORRUPT'); // PF
  const pc = await createDrawingProject(admin, 'p09-up-pc', envDrawingPng(), ['Tầng 1']); // PC (image-only: no CAD seed helper)
  const ids = [nm.projectId, pe.projectId, pf.projectId, pc.projectId];
  let session: Awaited<ReturnType<typeof openRole>> | undefined;
  let api: APIRequestContext | undefined;
  try {
    for (const id of ids.slice(1)) await addProjectMember(admin, id, engineer.email);
    session = await openRole(browser, engineer);
    api = await apiAs(engineer);
    const { page } = session;
    const peFloor = pe.floors[0]?.id ?? '';

    await test.step('[9U-D-017] non-member: floors → not found + back button', async () => {
      await page.goto(ROUTES.project.floors(nm.projectId));
      await expect(page.getByText(NOT_FOUND, { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect.soft(btn(page, BACK)).toBeVisible();
      await ev(page, '9U-D-017', 'non_member_floors');
    });

    await test.step('[9U-D-028] non-member: upload → not found', async () => {
      await page.goto(ROUTES.project.upload(nm.projectId));
      await expect.soft(page.getByText(NOT_FOUND, { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect.soft(page.getByTestId(DROPZONE)).toHaveCount(0);
      await ev(page, '9U-D-028', 'non_member_upload');
    });

    await test.step('[9U-D-042] engineer: no "Huỷ xử lý" (cancelProcessing:false)', async () => {
      await page.goto(ROUTES.project.pipeline(pf.projectId));
      await expect(page.getByRole('alert').filter({ hasText: FAILED_ALERT })).toBeVisible({ timeout: 45_000 });
      // weak control: a failed run has no cancel for any role (UPS:870); kept as the cancelProcessing:false observation
      await expect.soft(btn(page, CANCEL_RUN)).toHaveCount(0);
      await ev(page, '9U-D-042', 'engineer_no_cancel');
    });

    // Expectation changed per questions.md Q1 (QA-09, F9U-3): engineer MAY open detail mode (DETAIL_MODE_ROLES admin+engineer, UPG:81).
    await test.step('[9U-D-047] engineer: graph screen offers detail mode, no forbidden line', async () => {
      // evidence (R1: detail button absent, screen showed the empty state for a FAILED-run project): DOM facts + API log, before/after
      const graphLog: Array<{ url: string; status: number; body: string }> = [];
      page.on('response', (r) => {
        const url = r.url();
        if (!url.includes('/api/') || !/pipeline|run|branch|compar|stage|upload/u.test(url)) return;
        void r.text().then((t) => graphLog.push({ url: url.replace(/^https?:\/\/[^/]+/u, ''), status: r.status(), body: t.slice(0, 400) }), () => undefined);
      });
      const graphFacts = async (): Promise<Record<string, unknown>> => ({
        url: page.url(),
        projectId: pf.projectId,
        uploadId: pf.uploadId,
        detailButtonCount: await page.getByRole('button', { name: GRAPH.detail, exact: true }).count(),
        emptyStateCount: await page.getByText(NO_RUN, { exact: false }).count(),
        forbiddenLineCount: await page.getByText(GRAPH.forbiddenLine, { exact: true }).count(),
        headings: await page.getByRole('heading').allInnerTexts(),
        requestsSinceMark: graphLog.length,
      });
      await attachJson('E09_9U-D-047_graph_before.json', await graphFacts());
      await page.goto(ROUTES.project.pipelineGraph(pf.projectId));
      await expect(page.getByRole('heading', { name: GRAPH.title }).first()).toBeVisible({ timeout: 30_000 });
      await expect.soft(page.getByText(GRAPH.forbiddenLine, { exact: true })).toHaveCount(0);
      await expect.soft(page.getByText(GRAPH.detail, { exact: true })).toBeVisible();
      await attachJson('E09_9U-D-047_graph_after.json', { ...(await graphFacts()), apiLog: graphLog });
      await ev(page, '9U-D-047', 'engineer_detail_allowed');
    });

    // Expectation changed per questions.md Q4 (QA-09, F9U-4): empty wins over forbidden (UPG:546-550).
    await test.step('[9U-D-048] engineer, project never ran: "Chưa có lượt xử lý nào", no forbidden line', async () => {
      await page.goto(ROUTES.project.pipelineGraph(pe.projectId));
      await expect(page.getByRole('heading', { name: GRAPH.title }).first()).toBeVisible({ timeout: 30_000 });
      await expect.soft(page.getByText(NO_RUN, { exact: true })).toBeVisible();
      await expect.soft(page.getByText(GRAPH.forbiddenLine, { exact: true })).toHaveCount(0);
      await ev(page, '9U-D-048', 'engineer_empty_before_forbidden');
    });

    await test.step('[9U-D-054] engineer: 3 next-step actions on the failed run', async () => {
      await page.goto(ROUTES.project.pipeline(pf.projectId));
      await expect(page.getByRole('alert').filter({ hasText: FAILED_ALERT })).toBeVisible({ timeout: 45_000 });
      for (const name of [PF.lower, PF.upload, PF.skip]) await expect.soft(btn(page, name)).toBeVisible(); // PFT:58-60
      await ev(page, '9U-D-054', 'engineer_next_steps');
    });

    await test.step('[9U-D-060] engineer: "Áp dụng tỷ lệ" shown; PUT spatial/layer 200 on own project', async () => {
      await page.goto(ROUTES.project.scale(pe.projectId, peFloor));
      await expect.soft(btn(page, APPLY_SCALE)).toBeVisible({ timeout: 20_000 });
      unknown('9U-D-060 baseVersion 0 for a fresh floor assumed');
      const res = await api!.put(`/api/projects/${pe.projectId}/floors/${peFloor}/spatial/layer`, {
        data: { baseVersion: 0, body: { scaleMillimetresPerPixel: 10 } },
      });
      await attachJson('E09_9U-D-060_put.json', await statusCode(res));
      expect.soft(res.status()).toBe(200);
      await ev(page, '9U-D-060', 'engineer_scale');
    });

    await test.step('[9U-D-069] engineer: confirm not locked by role', async () => {
      await page.goto(ROUTES.project.overlay(pe.projectId, peFloor));
      await expect(page.getByRole('region', { name: OVERLAY_REGION })).toBeVisible({ timeout: 30_000 });
      await expect.soft(btn(page, CONFIRM_MODEL)).toBeVisible();
      await expect.soft(page.getByText(NEED_EDIT, { exact: true })).toHaveCount(0);
      await ev(page, '9U-D-069', 'engineer_overlay');
    });

    await test.step('[9U-D-076] engineer: CAD choices clickable', async () => {
      await page.goto(ROUTES.project.cadConfirm(pc.projectId, pc.floorId));
      await expect.soft(btn(page, USE_CAD)).toBeEnabled({ timeout: 20_000 });
      await expect.soft(btn(page, USE_AI)).toBeEnabled();
      unknown(`9U-D-076 no .dxf seed helper (createCadProject); "${IMPORT_GEO}" after layer mapping not driven`);
      await ev(page, '9U-D-076', 'engineer_cad_choices');
    });
  } finally {
    await session?.context.close();
    await api?.dispose();
    for (const id of ids) await deleteSeededProject(admin, id);
    await admin.dispose();
  }
});

test('SCR-09..16 · FL-9U-07 · admin · admin doi chung duong 1 dong/man', async ({ browser }) => {
  test.setTimeout(240_000);
  const admin = await adminApi();
  const main = mainProject();
  const pf = await createFailedRunProject(admin, 'p09-up-af', 'FILE_CORRUPT');
  const pc = await createDrawingProject(admin, 'p09-up-ac', envDrawingPng(), ['Tầng 1']);
  const context = await browser.newContext({ viewport: DESKTOP });
  try {
    const page = await context.newPage();
    await signInAdmin(page);

    await test.step('[9U-D-016] admin: "Thêm tầng", no read-only notice', async () => {
      await page.goto(ROUTES.project.floors(main.projectId));
      await expect(btn(page, ADD_FLOOR)).toBeVisible({ timeout: 20_000 });
      await expect.soft(page.getByText('Không có quyền sửa tầng', { exact: true })).toHaveCount(0);
      await ev(page, '9U-D-016', 'admin_floors');
    });

    await test.step('[9U-D-027] admin: drop zone, no read-only line', async () => {
      await page.goto(ROUTES.project.upload(main.projectId));
      await expect.soft(page.getByTestId(DROPZONE)).toBeVisible({ timeout: 20_000 });
      await expect.soft(page.getByText(READ_ONLY, { exact: true })).toHaveCount(0);
      await ev(page, '9U-D-027', 'admin_upload');
    });

    await test.step('[9U-D-037] admin: quality action buttons', async () => {
      await page.goto(ROUTES.project.quality(main.projectId));
      await expect.soft(page.getByText(CONTINUE, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
      await expect.soft(page.getByText(OTHER_DRAWING, { exact: true }).first()).toBeVisible();
      await ev(page, '9U-D-037', 'admin_quality_actions');
    });

    await test.step('[9U-D-043] admin: pipeline loads, no forbidden', async () => {
      await page.goto(ROUTES.project.pipeline(main.projectId));
      await expect(page.getByRole('tablist').first()).toBeVisible({ timeout: 30_000 });
      await expect.soft(page.getByText(/không có quyền/iu)).toHaveCount(0);
      await ev(page, '9U-D-043', 'admin_pipeline');
    });

    await test.step('[9U-D-049] admin: detail block opens', async () => {
      await page.goto(ROUTES.project.pipeline(pf.projectId));
      await expect(page.getByRole('alert').filter({ hasText: FAILED_ALERT })).toBeVisible({ timeout: 45_000 });
      await expect.soft(page.getByText(/không có quyền/iu)).toHaveCount(0);
      const toggle = page.getByText(TECH, { exact: true }).first();
      await expect.soft(toggle).toBeVisible({ timeout: 20_000 });
      await toggle.click();
      await ev(page, '9U-D-049', 'admin_detail');
    });

    await test.step('[9U-D-055] admin: next-step actions on the failed run', async () => {
      for (const name of [PF.lower, PF.upload, PF.skip]) await expect.soft(btn(page, name)).toBeVisible(); // PFT:58-60
      await ev(page, '9U-D-055', 'admin_next_steps');
    });

    await test.step('[9U-D-061] admin: "Áp dụng tỷ lệ" shown', async () => {
      await page.goto(ROUTES.project.scale(main.projectId, main.workFloorId));
      await expect.soft(btn(page, APPLY_SCALE)).toBeVisible({ timeout: 20_000 });
      await ev(page, '9U-D-061', 'admin_scale');
    });

    await test.step('[9U-D-070] admin: confirm not locked by role', async () => {
      await page.goto(ROUTES.project.overlay(main.projectId, main.workFloorId));
      await expect(page.getByRole('region', { name: OVERLAY_REGION })).toBeVisible({ timeout: 30_000 });
      await expect.soft(btn(page, CONFIRM_MODEL)).toBeVisible();
      await expect.soft(page.getByText(NEED_EDIT, { exact: true })).toHaveCount(0);
      await ev(page, '9U-D-070', 'admin_overlay');
    });

    await test.step('[9U-D-077] admin: CAD choices enabled', async () => {
      await page.goto(ROUTES.project.cadConfirm(pc.projectId, pc.floorId));
      await expect.soft(btn(page, USE_CAD)).toBeEnabled({ timeout: 20_000 });
      await expect.soft(btn(page, USE_AI)).toBeEnabled();
      unknown('9U-D-077 image-only project stands in for the CAD project (no createCadProject helper)');
      await ev(page, '9U-D-077', 'admin_cad_choices');
    });
  } finally {
    await context.close();
    await deleteSeededProject(admin, pf.projectId);
    await deleteSeededProject(admin, pc.projectId);
    await admin.dispose();
  }
});

test('SCR-09..16 · FL-9U-08 · an danh · an danh 8 route -> /login?next=', async ({ browser }) => {
  const context = await browser.newContext({ viewport: DESKTOP });
  try {
    const page = await context.newPage();
    const { projectId, workFloorId } = mainProject();
    const routes = uploadRoutes(projectId, workFloorId);
    await test.step('[9U-D-018] anonymous → /login?next=', async () => {
      await expectLoginRedirect(page, routes[0] ?? '');
      expect.soft(decodeURIComponent(new URL(page.url()).searchParams.get('next') ?? '')).toContain(routes[0] ?? '');
      await ev(page, '9U-D-018', 'anon_floors');
    });
    await test.step('[9U-D-029] anonymous → /login?next=', async () => {
      await expectLoginRedirect(page, routes[1] ?? '');
      expect.soft(decodeURIComponent(new URL(page.url()).searchParams.get('next') ?? '')).toContain(routes[1] ?? '');
      await ev(page, '9U-D-029', 'anon_upload');
    });
    await test.step('[9U-D-038] anonymous → /login?next=', async () => {
      await expectLoginRedirect(page, routes[2] ?? '');
      expect.soft(decodeURIComponent(new URL(page.url()).searchParams.get('next') ?? '')).toContain(routes[2] ?? '');
      await ev(page, '9U-D-038', 'anon_quality');
    });
    await test.step('[9U-D-044] anonymous → /login?next=', async () => {
      await expectLoginRedirect(page, routes[3] ?? '');
      expect.soft(decodeURIComponent(new URL(page.url()).searchParams.get('next') ?? '')).toContain(routes[3] ?? '');
      await ev(page, '9U-D-044', 'anon_pipeline');
    });
    await test.step('[9U-D-050] anonymous → /login?next=', async () => {
      await expectLoginRedirect(page, routes[4] ?? '');
      expect.soft(decodeURIComponent(new URL(page.url()).searchParams.get('next') ?? '')).toContain(routes[4] ?? '');
      await ev(page, '9U-D-050', 'anon_graph');
    });
    await test.step('[9U-D-062] anonymous → /login?next=', async () => {
      await expectLoginRedirect(page, routes[5] ?? '');
      expect.soft(decodeURIComponent(new URL(page.url()).searchParams.get('next') ?? '')).toContain(routes[5] ?? '');
      await ev(page, '9U-D-062', 'anon_scale');
    });
    await test.step('[9U-D-071] anonymous → /login?next=', async () => {
      await expectLoginRedirect(page, routes[6] ?? '');
      expect.soft(decodeURIComponent(new URL(page.url()).searchParams.get('next') ?? '')).toContain(routes[6] ?? '');
      await ev(page, '9U-D-071', 'anon_overlay');
    });
    await test.step('[9U-D-078] anonymous → /login?next=', async () => {
      await expectLoginRedirect(page, routes[7] ?? '');
      expect.soft(decodeURIComponent(new URL(page.url()).searchParams.get('next') ?? '')).toContain(routes[7] ?? '');
      await ev(page, '9U-D-078', 'anon_cad_confirm');
    });
  } finally {
    await context.close();
  }
});

test('BE truc tiep · FL-9U-09 · viewer · viewer goi thang BE: floors / drawings / quality / spatial', async () => {
  test.setTimeout(120_000);
  const admin = await adminApi();
  // own throw-away project: the viewer never sends a write to the main chain project
  const own = await createDrawingProject(admin, 'p09-up-be', envDrawingPng(), ['Tầng 1', 'Tầng 2']);
  const { projectId } = own;
  const workFloorId = own.floorId;
  const viewer = await roleUser(admin, 'viewer', 'up-b');
  await addProjectMember(admin, projectId, viewer.email);
  const api = await apiAs(viewer);
  const base = `/api/projects/${projectId}`;
  const floorBase = `${base}/floors/${workFloorId}`;
  const forbidden = async (id: string, slug: string, res: Awaited<ReturnType<APIRequestContext['get']>>, hard: boolean): Promise<number> => {
    const got = await statusCode(res);
    await attachJson(`E09_${id}_${slug}.json`, got);
    const check = hard ? expect : expect.soft;
    check(got.status).toBe(403);
    check(got.code).toBe('FORBIDDEN'); // access/deps.py: FORBIDDEN.error()
    return got.status;
  };
  try {
    const before = await floorIds(admin, projectId);

    await test.step('[9U-D-009] viewer: POST floors → 403 FORBIDDEN', async () => {
      await forbidden('9U-D-009', 'post_floor', await api.post(`${base}/floors`, {
        data: { name: 'Tầng p09', order: before.length, elevationMm: 99_000, heightMm: 3_000 },
      }), true);
      expect(await floorIds(admin, projectId)).toEqual(before);
    });
    await test.step('[9U-D-010] viewer: DELETE floor → 403', async () => {
      expect.soft(await forbidden('9U-D-010', 'delete_floor', await api.delete(`/api/floors/${workFloorId}`), false)).toBe(403);
      expect.soft(await floorIds(admin, projectId)).toEqual(before);
    });
    await test.step('[9U-D-011] viewer: PATCH reorder → 403', async () => {
      expect.soft(await forbidden('9U-D-011', 'reorder', await api.patch('/api/floors/reorder', { data: { floorIds: before } }), false)).toBe(403);
      expect.soft(await floorIds(admin, projectId)).toEqual(before);
    });
    await test.step('[9U-D-012] viewer: PATCH floor spatial → 403', async () => {
      expect.soft(await forbidden('9U-D-012', 'patch_spatial', await api.patch(`${floorBase}/spatial`, { data: { name: 'Tầng p09' } }), false)).toBe(403);
      expect.soft(await floorIds(admin, projectId)).toEqual(before);
    });
    await test.step('[9U-D-024] viewer: upload init → 403', async () => {
      expect.soft(await forbidden('9U-D-024', 'upload_init', await api.post(`${floorBase}/drawings/uploads`, {
        data: { fileName: 'ban-ve.png', floorId: workFloorId, mimeType: 'image/png', projectId, sizeBytes: 16 },
      }), false)).toBe(403);
    });
    await test.step('[9U-D-025] viewer: chunk + complete → 403 (not 404 for a fake upload id)', async () => {
      const fake = `${base}/drawings/uploads/upl_01JZZZZZZZZZZZZZZZZZZZZZZZ`;
      expect.soft(await forbidden('9U-D-025', 'chunk', await api.post(`${fake}/chunks`, {
        headers: { 'content-type': 'application/octet-stream' },
        data: Buffer.from('qa'),
      }), false)).toBe(403);
      expect.soft(await forbidden('9U-D-025', 'complete', await api.post(`${fake}/complete`, { data: {} }), false)).toBe(403);
    });
    await test.step('[9U-D-032] viewer: POST corners → 403', async () => {
      expect.soft(await forbidden('9U-D-032', 'corners', await api.post(`${floorBase}/quality/corners`, { data: FOUR_CORNERS }), false)).toBe(403);
    });
    await test.step('[9U-D-033] viewer: POST straighten → 403', async () => {
      expect.soft(await forbidden('9U-D-033', 'straighten', await api.post(`${floorBase}/quality/straighten`, { data: {} }), false)).toBe(403);
    });
    await test.step('[9U-D-034] viewer: GET quality → 200 (member gate)', async () => {
      const res = await api.get(`${floorBase}/quality`);
      await attachJson('E09_9U-D-034_quality.json', await statusCode(res));
      expect.soft(res.status()).toBe(200);
    });
    await test.step('[9U-D-059] viewer: PUT spatial/layer (scale) → 403', async () => {
      expect.soft(await forbidden('9U-D-059', 'put_scale', await api.put(`${floorBase}/spatial/layer`, {
        data: { baseVersion: 0, body: { scaleMillimetresPerPixel: 10 } },
      }), false)).toBe(403);
    });
    await test.step('[9U-D-068] viewer: PUT spatial/layer (overlay result) → 403', async () => {
      expect.soft(await forbidden('9U-D-068', 'put_layer', await api.put(`${floorBase}/spatial/layer`, {
        data: { baseVersion: 0, body: { layer: { walls: [] } } },
      }), false)).toBe(403);
    });
  } finally {
    await api.dispose();
    await deleteSeededProject(admin, projectId);
    await admin.dispose();
  }
});
