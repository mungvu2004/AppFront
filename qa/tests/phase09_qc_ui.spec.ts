/** Phase 09 QC UI (P11): FL-9Q-10 viewer read-only layer screens at four widths. */
import { test } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { openAt, uiState, withRoleUi } from './support/p09/P11';

test('SCR-16..21 · FL-9Q-10 · viewer · 4 khổ trạng thái chỉ-xem', async ({ browser }) => {
  test.setTimeout(420_000);
  await withRoleUi(browser, 'viewer', 'ui-qc', true, async ({ page, projectId, floorId }) => {
    const P = ROUTES.project;
    await test.step('[9Q-A-013] viewer walls_readonly 4 kho', async () => {
      // the viewer sentence only shows once a segment is selected (WallLayerInspector.tsx:122,213); anchor on the panel heading.
      await uiState(page, '9Q-A-013', 'walls_readonly', openAt(P.walls(projectId, floorId), (p) => p.getByRole('heading', { name: 'Đoạn tường' })), true);
    });
    await test.step('[9Q-B-011] viewer objects_readonly 4 kho', async () => {
      await uiState(page, '9Q-B-011', 'objects_readonly', openAt(P.objects(projectId, floorId), (p) => p.getByRole('region', { name: 'Lớp đối tượng' })));
    });
    await test.step('[9Q-C-010] viewer dimensions_readonly 4 kho', async () => {
      await uiState(page, '9Q-C-010', 'dimensions_readonly', openAt(P.dimensions(projectId, floorId), (p) => p.getByText(/Vai trò hiện tại chỉ được xem, không được chỉnh sửa lớp kích thước OCR/u)));
    });
    await test.step('[9Q-D-009] viewer grids_readonly 4 kho', async () => {
      await uiState(page, '9Q-D-009', 'grids_readonly', openAt(P.grids(projectId, floorId), (p) => p.getByText('Không có quyền sửa trục')));
    });
    await test.step('[9Q-E-010] viewer rooms_readonly 4 kho', async () => {
      await uiState(page, '9Q-E-010', 'rooms_readonly', openAt(P.rooms(projectId, floorId), (p) => p.getByText('Không có quyền sửa lớp phòng')));
    });
    await test.step('[9Q-F-009] viewer thickness_readonly 4 kho', async () => {
      await uiState(page, '9Q-F-009', 'thickness_readonly', openAt(P.thickness(projectId, floorId), (p) => p.getByText('Không có quyền sửa độ dày tường')));
    });
  });
});
