/** Phase 09 upload UI (P11): FL-9U-U1 viewer read-only layouts at four widths. */
import { test } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { openAt, uiState, withRoleUi } from './support/p09/P11';
import { addProjectMember, createFailedRunProject, deleteSeededProject } from './support/phase03Seed';

test('giao diện · FL-9U-U1 · viewer · viewer bo cuc chi-doc o 4 kho', async ({ browser }) => {
  test.setTimeout(420_000);
  await withRoleUi(browser, 'viewer', 'up', true, async ({ page, admin, user, projectId, floorId }) => {
    const P = ROUTES.project;
    // Screen mapping follows catalog-C2 rows 9U-D-*: F-003/F-005/F-008/F-009 UNKNOWN — NEED VERIFICATION.
    await test.step('[9U-F-001] viewer upload_readonly 4 kho', async () => {
      await uiState(page, '9U-F-001', 'upload_readonly', openAt(P.upload(projectId)), true);
    });
    await test.step('[9U-F-002] viewer floors_readonly 4 kho', async () => {
      await uiState(page, '9U-F-002', 'floors_readonly', openAt(P.floors(projectId)));
    });
    await test.step('[9U-F-003] viewer quality_forbidden 4 kho', async () => {
      await uiState(page, '9U-F-003', 'quality_forbidden', openAt(P.quality(projectId)));
    });
    await test.step('[9U-F-004] viewer pipeline_forbidden 4 kho', async () => {
      await uiState(page, '9U-F-004', 'pipeline_forbidden', openAt(P.pipeline(projectId)));
    });
    await test.step('[9U-F-005] viewer graph_forbidden 4 kho', async () => {
      await uiState(page, '9U-F-005', 'graph_forbidden', openAt(P.pipelineGraph(projectId)));
    });
    // PF: own project whose run FAILED (corrupt PNG); the viewer joins it; deleted in finally.
    const pf = await createFailedRunProject(admin, '9u-f-006', 'FILE_CORRUPT');
    try {
      await addProjectMember(admin, pf.projectId, user.email);
      await test.step('[9U-F-006] viewer lỗi-forbidden 4 khổ', async () => {
        await uiState(page, '9U-F-006', 'failed_forbidden', openAt(P.pipeline(pf.projectId)));
      });
      await test.step('[9U-F-007] viewer scale forbidden (canvas + thông báo)', async () => {
        await uiState(page, '9U-F-007', 'scale_forbidden', openAt(P.scale(projectId, floorId)));
      });
      await test.step('[9U-F-008] viewer bảng cảnh báo', async () => {
        await uiState(page, '9U-F-008', 'quality_warnings', openAt(P.quality(projectId)));
      });
      await test.step('[9U-F-009] viewer cad-confirm forbidden (PC)', async () => {
        // UNKNOWN — NEED VERIFICATION: no CAD (.dxf) seed helper exists; the main-project floor stands in until createCadProject lands.
        await uiState(page, '9U-F-009', 'cad_forbidden', openAt(P.cadConfirm(projectId, floorId)));
      });
    } finally {
      await deleteSeededProject(admin, pf.projectId);
    }
  });
});
