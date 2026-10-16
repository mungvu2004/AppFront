/** Phase 09 upload UI (P11): FL-9U-U1 viewer read-only layouts at four widths. */
import { expect, test } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { openAt, uiState, withRoleUi } from './support/p09/P11';
import { GRAPH } from './support/p03/P10';
import { addProjectMember, createFailedRunProject, deleteSeededProject } from './support/phase03Seed';

test('giao diện · FL-9U-U1 · viewer · viewer bo cuc chi-doc o 4 kho', async ({ browser }) => {
  test.setTimeout(420_000);
  await withRoleUi(browser, 'viewer', 'ui-up', true, async ({ page, admin, user, projectId, floorId }) => {
    const P = ROUTES.project;
    // Screen mapping follows catalog-C2 rows 9U-D-*: F-003/F-005/F-008/F-009 UNKNOWN — NEED VERIFICATION.
    await test.step('[9U-F-001] viewer upload_readonly 4 kho', async () => {
      await uiState(page, '9U-F-001', 'upload_readonly', openAt(P.upload(projectId), (p) => p.getByText(/Vai hiện tại chỉ được xem danh sách tệp/u)), true);
    });
    await test.step('[9U-F-002] viewer floors_readonly 4 kho', async () => {
      await uiState(page, '9U-F-002', 'floors_readonly', openAt(P.floors(projectId), (p) => p.getByRole('heading', { name: 'Không có quyền sửa tầng' })));
    });
    await test.step('[9U-F-003] viewer quality_forbidden 4 kho', async () => {
      await uiState(page, '9U-F-003', 'quality_forbidden', openAt(P.quality(projectId), (p) => p.getByRole('heading', { name: 'Các tầng đã đo' }), ['Tiếp tục xử lý', 'Tải bản vẽ khác']));
    });
    await test.step('[9U-F-004] viewer pipeline_forbidden 4 kho', async () => {
      await uiState(page, '9U-F-004', 'pipeline_forbidden', openAt(P.pipeline(projectId), // At 768 the list sits inside <details>; anchor on its summary there (ProcessingScreen.tsx:200-212, BUG-294).
(p) => p.getByRole('list', { name: 'Các bước xử lý' }).or(p.getByText('Xem tất cả các bước', { exact: true })), ['Huỷ xử lý']));
    });
    // 9U-F-005: the real route passes no `run` and the gateway answers branchReport unsupported (PipelineGraph.container.tsx:140-146,
    // pipelineGraphGateway.ts:364), so EVERY role gets the empty state; questions.md Q4 (F9U-4, usePipelineGraph.ts:545-547): empty wins over forbidden.
    // RR deciding value (U09-9U-F-005 shot @1920): title "Chưa có lượt xử lý nào để kể lại", no forbidden line. Forbidden copy is vitest-only (PipelineGraph.test.tsx:121).
    // PF: own project whose run FAILED (corrupt PNG); the viewer joins it; deleted in finally.
    const pf = await createFailedRunProject(admin, '9u-f-006', 'FILE_CORRUPT');
    try {
      await addProjectMember(admin, pf.projectId, user.email);
      await test.step('[9U-F-005] viewer graph_empty (empty before forbidden, Q4) 4 kho', async () => {
        await uiState(page, '9U-F-005', 'graph_forbidden', openAt(P.pipelineGraph(projectId), (p) => p.getByText(GRAPH.emptyTitle, { exact: true })));
        await expect.soft(page.getByText(GRAPH.forbiddenLine, { exact: true })).toHaveCount(0);
      });
      await test.step('[9U-F-006] viewer lỗi-forbidden 4 khổ', async () => {
        await uiState(page, '9U-F-006', 'failed_forbidden', openAt(P.pipeline(pf.projectId), (p) => p.getByRole('alert').filter({ hasText: /không hoàn tất được/u }), ['Thử lại với ngưỡng thấp hơn', 'Tải lên bản vẽ rõ hơn', 'Bỏ qua tầng đó']));
      });
      await test.step('[9U-F-007] viewer scale forbidden (canvas + thông báo)', async () => {
        await uiState(page, '9U-F-007', 'scale_forbidden', openAt(P.scale(projectId, floorId), (p) => p.getByRole('heading', { name: 'Bạn không có quyền hiệu chỉnh tỷ lệ' })));
      });
      await test.step('[9U-F-008] viewer bảng cảnh báo', async () => {
        await uiState(page, '9U-F-008', 'overlay_readonly_notice', openAt(P.overlay(projectId, floorId), (p) => p.getByText('Bạn chỉ được xem; việc đổi căn chỉnh dành cho người có quyền sửa.')));
      });
      await test.step('[9U-F-009] viewer cad-confirm forbidden (PC)', async () => {
        // UNKNOWN — NEED VERIFICATION: no CAD (.dxf) seed. The main floor is a PNG: useCadBranchConfirm.ts:601-606 yields 'error'
        // before the !canEdit check, so the forbidden sentence cannot show. N/A until createCadProject exists; no shot taken.
        test.info().annotations.push({ type: 'n/a', description: '9U-F-009: needs a real .dxf seed (PC)' });
        await page.goto(P.cadConfirm(projectId, floorId));
        await expect(page).toHaveURL(/cad-confirm/u);
      });
    } finally {
      await deleteSeededProject(admin, pf.projectId);
    }
  });
});
