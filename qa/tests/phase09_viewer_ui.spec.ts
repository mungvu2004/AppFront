/** Phase 09 viewer-shell UI (P11): FL-9V-U1 viewer read-only states at four widths. */
import { expect, test } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { openAt, uiState, withRoleUi } from './support/p09/P11';
import { pascalCanvas } from './support/p09/P7';

test('SCR-25..32 · FL-9V-U1 · viewer · verifyUi 4 khổ trạng thái chỉ đọc', async ({ browser }) => {
  test.setTimeout(480_000);
  await withRoleUi(browser, 'viewer', 'ui-viewer', true, async ({ page, projectId }) => {
    const P = ROUTES.project;
    await test.step('[9V-A-060] viewer viewer_inspector 4 kho', async () => {
      // /3d = Pascal since F-15 (router.tsx:382): the ViewerShell alert is gone, the read-only state is the Pascal canvas for a viewer role.
      await uiState(page, '9V-A-060', 'viewer_inspector', openAt(P.viewer(projectId), (p) => pascalCanvas(p)), true);
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
      // 768 opens the tree tab (key as <code>name</code>, SpatialJsonTree.tsx:151); wider widths show the raw pane (`"name"`).
      await uiState(page, '9V-F-060', 'json_viewer', openAt(P.data(projectId), (p) => p.getByText(/"name"|^name$/u)));
    });
    await test.step('[9V-G-060] viewer versions_readonly 4 kho', async () => {
      await uiState(page, '9V-G-060', 'versions_readonly', openAt(P.versions(projectId), (p) => p.getByText(/Vai trò của bạn trên dự án này chỉ đọc được lịch sử/u)));
    });
    await test.step('[9V-H-060] viewer share dialog blocked 4 kho', async () => {
      // feature off: shareLink.ts:354 (SHARE_LINKS_SUPPORTED=false); the forbidden branch returns early (ExportPanel.tsx:207-215),
      // so a four-width shot would duplicate 9V-E-060. N/A for the shot; the opener must still be absent.
      test.info().annotations.push({ type: 'n/a', description: '9V-H-060: share feature off, same screen as 9V-E-060' });
      await page.goto(P.export(projectId));
      await expect(page.getByRole('heading', { name: 'Không có quyền xuất bản vẽ' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Chia sẻ', exact: true })).toHaveCount(0);
    });
  });
});
