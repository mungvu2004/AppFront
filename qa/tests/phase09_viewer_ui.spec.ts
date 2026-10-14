/** Phase 09 viewer-shell UI (P11): FL-9V-U1 viewer read-only states at four widths. */
import { test } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { openAt, uiState, withRoleUi } from './support/p09/P11';

test('SCR-25..32 · FL-9V-U1 · viewer · verifyUi 4 khổ trạng thái chỉ đọc', async ({ browser }) => {
  test.setTimeout(480_000);
  await withRoleUi(browser, 'viewer', 'viewer', true, async ({ page, projectId }) => {
    const P = ROUTES.project;
    await test.step('[9V-A-060] viewer viewer_inspector 4 kho', async () => {
      await uiState(page, '9V-A-060', 'viewer_inspector', openAt(P.viewer(projectId), (p) => p.getByText('Bạn đang xem ở vai người xem nên không sửa được mô hình.')), true);
    });
    await test.step('[9V-B-060] viewer measure_pin_blocked 4 kho', async () => {
      await uiState(page, '9V-B-060', 'measure_pin_blocked', openAt(P.measure(projectId), (p) => p.getByRole('alert').filter({ hasText: 'Bạn chỉ có quyền xem dự án này' })));
    });
    await test.step('[9V-C-060] viewer rule_report 4 kho', async () => {
      await uiState(page, '9V-C-060', 'rule_report', openAt(P.rules(projectId), (p) => p.getByRole('heading', { name: 'Kiểm tra luật không gian' })));
    });
    await test.step('[9V-D-060] viewer rule_settings_readonly 4 kho', async () => {
      await uiState(page, '9V-D-060', 'rule_settings_readonly', openAt(P.ruleSettings(projectId), (p) => p.getByText('Chỉ quản trị viên đổi được bộ luật; bạn đang xem ở quyền chỉ đọc.')));
    });
    await test.step('[9V-E-060] viewer export_forbidden 4 kho', async () => {
      await uiState(page, '9V-E-060', 'export_forbidden', openAt(P.export(projectId), (p) => p.getByRole('heading', { name: 'Không có quyền xuất bản vẽ' })));
    });
    await test.step('[9V-F-060] viewer json_viewer 4 kho', async () => {
      await uiState(page, '9V-F-060', 'json_viewer', openAt(P.data(projectId), (p) => p.getByText(/"name"/u)));
    });
    await test.step('[9V-G-060] viewer versions_readonly 4 kho', async () => {
      await uiState(page, '9V-G-060', 'versions_readonly', openAt(P.versions(projectId), (p) => p.getByText(/Vai trò của bạn trên dự án này chỉ đọc được lịch sử/u)));
    });
    await test.step('[9V-H-060] viewer share_blocked 4 kho', async () => {
      // ShareDialog opens from the 'Chia sẻ' button of ExportPanel.tsx:249-251, rendered only after the forbidden early return
      // (:208-215); for a viewer the opener is absent (asserted in openAt), so there is no dialog to open.
      await uiState(page, '9V-H-060', 'share_blocked', openAt(P.export(projectId), (p) => p.getByRole('heading', { name: 'Không có quyền xuất bản vẽ' }), ['Chia sẻ']));
    });
  });
});
