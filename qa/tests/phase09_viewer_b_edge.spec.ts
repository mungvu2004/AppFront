/**
 * Phase 09 role matrix, pack P8 (flows-C4 FL-9V-04..06): viewer read-only rules/export/share, JSON + version history,
 * engineer can-edit controls (no real write) on the main chain. Real stack, pooled role users, desktop viewport only.
 */
import { expect, test } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { captureEvidence } from './support/evidence';
import { openRoleSession } from './support/p09/P8';
import { gotoAs } from './support/p09/roles';

const RULE_SETTINGS_HEADING = 'Cài đặt bộ luật không gian'; // RuleSettings.tsx
const RULE_SETTINGS_READ_ONLY = 'Chỉ quản trị viên đổi được bộ luật; bạn đang xem ở quyền chỉ đọc.'; // ruleSettingsGateway.ts:98
const OPENING_RULE_SWITCH = /^Bật hoặc tắt luật: lỗ mở nằm trọn/u; // RuleSettingsRow.tsx:100
const EXPORT_FORBIDDEN = 'Không có quyền xuất bản vẽ'; // ExportPanel.tsx:211
const EXPORT_CAPTION = 'Chỉ quản trị viên và kỹ sư của dự án xuất được mô hình; bạn đang xem ở quyền chỉ đọc.'; // exportPanelGateway.ts:260
const SHARE_FORBIDDEN =
  'Chỉ quản trị viên và kỹ sư của dự án tạo được liên kết chia sẻ; hãy nhờ một người trong hai vai đó tạo giúp'; // shareDialogGateway.ts:116
const JSON_SEARCH = 'Tìm theo khoá hoặc giá trị'; // SpatialJsonViewer
const JSON_FORBIDDEN = 'Không có quyền xem dữ liệu';
const VERSIONS_READ_ONLY = 'Vai trò của bạn trên dự án này chỉ đọc được lịch sử, nên nút phục hồi không hiện'; // versionHistoryModel.ts:494
const VERSION_LIST = 'Danh sách phiên bản';
const VERSION_RESTORE = 'Phục hồi phiên bản này';
const VERSION_LABEL = 'Gắn nhãn phiên bản này';
const VERSION_EXPORT = 'Xuất phiên bản này'; // VersionHistory.tsx:171
const RULES_HEADING = 'Kiểm tra luật không gian';

const unknown = (id: string, why: string): void => {
  test.info().annotations.push({ type: 'UNKNOWN', description: `[${id}] UNKNOWN — NEED VERIFICATION: ${why}` });
};

test.describe('Phase 09 viewer edge B', () => {
  test('SCR-29/30 + ShareDialog · FL-9V-04 · viewer · Cài đặt luật + Xuất + Chia sẻ bị khoá', async ({ browser }) => {
    test.setTimeout(180_000);
    const s = await openRoleSession(browser, 'viewer', 'viewer');
    const { page, rec } = s;
    try {
      const readOnly = page.getByText(RULE_SETTINGS_READ_ONLY, { exact: true });
      await test.step('[9V-D-030] rule settings read-only reason', async () => {
        await gotoAs(page, ROUTES.project.ruleSettings(s.projectId), RULE_SETTINGS_HEADING);
        await expect(readOnly).toBeVisible();
        await captureEvidence(page, 'E09_9V-D-030_rules_readonly');
      });
      await test.step('[9V-D-031] rule switch disabled', async () => {
        await expect.soft(page.getByRole('switch', { name: OPENING_RULE_SWITCH })).toBeDisabled(); // RuleSettingsRow.tsx:100,151
        await captureEvidence(page, 'E09_9V-D-031_switch_disabled');
      });
      await test.step('[9V-D-032] threshold inputs read-only', async () => {
        // Input.tsx:63 renders isReadOnly as plain text, so any remaining <input> must be disabled/readonly.
        const open = await page.locator('main input:not([disabled]):not([readonly])').count();
        expect.soft(open, 'editable inputs left for a viewer').toBe(0);
        await captureEvidence(page, 'E09_9V-D-032_thresholds_readonly');
      });
      await test.step('[9V-D-033] no rule-config write', async () => {
        expect.soft(rec.writes.filter((w) => /rule-config/u.test(w))).toEqual([]);
        await captureEvidence(page, 'E09_9V-D-033_no_put');
      });
      await test.step('[9V-D-050] switch disabled + reason is readable text', async () => {
        await expect.soft(page.getByRole('switch', { name: OPENING_RULE_SWITCH })).toBeDisabled();
        await expect.soft(readOnly).toBeVisible();
        await captureEvidence(page, 'E09_9V-D-050_a11y');
      });

      await test.step('[9V-E-030] export forbidden heading', async () => {
        await gotoAs(page, ROUTES.project.export(s.projectId), EXPORT_FORBIDDEN);
        await expect.soft(page.getByRole('heading', { name: EXPORT_FORBIDDEN, exact: true })).toBeVisible();
        await captureEvidence(page, 'E09_9V-E-030_forbidden');
      });
      await test.step('[9V-E-031] export caption', async () => {
        await expect.soft(page.getByText(EXPORT_CAPTION, { exact: true })).toBeVisible();
        await captureEvidence(page, 'E09_9V-E-031_caption');
      });
      await test.step('[9V-E-032] no Xuất button, no format cards', async () => {
        await expect.soft(page.getByRole('button', { name: 'Xuất', exact: true })).toHaveCount(0);
        unknown('9V-E-032', 'format card role not traced; radio count used');
        await expect.soft(page.getByRole('radio')).toHaveCount(0);
        await captureEvidence(page, 'E09_9V-E-032_no_export');
      });
      await test.step('[9V-E-033] no write/download request', async () => {
        expect.soft(rec.writes).toEqual([]);
        await captureEvidence(page, 'E09_9V-E-033_no_writes');
      });
      await test.step('[9V-E-050] lock icon aria-hidden, nothing interactive in panel', async () => {
        await expect.soft(page.locator('svg[aria-hidden="true"]').first()).toBeAttached(); // ExportPanel.tsx:209
        await expect.soft(page.locator('main').getByRole('button')).toHaveCount(0);
        await captureEvidence(page, 'E09_9V-E-050_a11y');
      });

      await test.step('[9V-H-030] no share opener on forbidden export', async () => {
        await expect.soft(page.getByRole('button', { name: 'Chia sẻ' })).toHaveCount(0); // ExportPanel.tsx:208 early return
        await captureEvidence(page, 'E09_9V-H-030_no_share');
      });
      await test.step('[9V-H-031] share no-permission reason', async () => {
        // No /share route in routes/paths.ts; dialog unmounted while SHARE_LINKS_SUPPORTED=false (lib/export/shareLink.ts:354).
        unknown('9V-H-031', 'no /share route; dialog unreachable on v1 (SHARE_LINKS_SUPPORTED=false)');
        await expect.soft(page.getByText(SHARE_FORBIDDEN, { exact: true })).toHaveCount(0);
        await captureEvidence(page, 'E09_9V-H-031_share_reason');
      });
      await test.step('[9V-H-032] no create-link control, no create request', async () => {
        unknown('9V-H-032', 'dialog unreachable on v1');
        await expect.soft(page.getByRole('button', { name: /tạo liên kết/iu })).toHaveCount(0);
        expect.soft(rec.writes.filter((w) => /share/u.test(w))).toEqual([]);
        await captureEvidence(page, 'E09_9V-H-032_no_create');
      });
      await test.step('[9V-H-033] default NO_ROLES is forbidden (covered by 9V-H-031)', async () => {
        unknown('9V-H-033', 'design note (partial); no observable surface');
        await expect.soft(page.getByRole('dialog')).toHaveCount(0);
        await captureEvidence(page, 'E09_9V-H-033_note');
      });
      await test.step('[9V-H-050] share reason readable as text', async () => {
        unknown('9V-H-050', 'dialog unreachable on v1');
        await expect.soft(page.getByRole('dialog')).toHaveCount(0);
        await captureEvidence(page, 'E09_9V-H-050_a11y');
      });
    } finally {
      await s.cleanup();
    }
  });

  test('SCR-31/32 · FL-9V-05 · viewer · JSON + Lịch sử phiên bản chỉ đọc', async ({ browser }) => {
    test.setTimeout(180_000);
    const s = await openRoleSession(browser, 'viewer', 'viewer');
    const { page, rec } = s;
    try {
      await test.step('[9V-F-030] JSON viewer loads, no forbidden title', async () => {
        await page.goto(ROUTES.project.data(s.projectId));
        await expect(page.getByLabel(JSON_SEARCH)).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText('"name": "Tầng').first()).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText(JSON_FORBIDDEN, { exact: true })).toHaveCount(0);
        await captureEvidence(page, 'E09_9V-F-030_json_loaded');
      });
      await test.step('[9V-F-031] no save/edit buttons', async () => {
        await expect.soft(page.getByRole('button', { name: /^(Lưu|Sửa)/u })).toHaveCount(0);
        await captureEvidence(page, 'E09_9V-F-031_no_edit');
      });
      await test.step('[9V-F-032] no write', async () => {
        expect.soft(rec.writes).toEqual([]);
        await captureEvidence(page, 'E09_9V-F-032_no_writes');
      });
      await test.step('[9V-F-050] tree opens by keyboard', async () => {
        const item = page.getByRole('treeitem').first();
        await item.focus();
        const before = (await item.getAttribute('aria-expanded')) ?? 'false';
        await page.keyboard.press(before === 'true' ? 'ArrowLeft' : 'ArrowRight');
        await expect.soft(item).not.toHaveAttribute('aria-expanded', before);
        await captureEvidence(page, 'E09_9V-F-050_keyboard');
      });

      await test.step('[9V-G-030] version history read-only reason', async () => {
        await page.goto(ROUTES.project.versions(s.projectId));
        await expect(page.getByRole('navigation', { name: VERSION_LIST })).toBeVisible({ timeout: 15_000 });
        await expect.soft(page.getByText(VERSIONS_READ_ONLY, { exact: true })).toBeVisible();
        await captureEvidence(page, 'E09_9V-G-030_readonly');
      });
      await test.step('[9V-G-031] no restore, no label control', async () => {
        await expect.soft(page.getByRole('button', { name: VERSION_RESTORE })).toHaveCount(0);
        await expect.soft(page.getByRole('button', { name: VERSION_LABEL })).toHaveCount(0);
        await captureEvidence(page, 'E09_9V-G-031_no_controls');
      });
      await test.step('[9V-G-032] list readable, version selectable', async () => {
        const nav = page.getByRole('navigation', { name: VERSION_LIST });
        const first = nav.getByRole('button').first();
        await expect.soft(first).toBeVisible();
        await first.click(); // selecting is a read
        await expect.soft(nav).toBeVisible();
        await captureEvidence(page, 'E09_9V-G-032_select');
      });
      await test.step('[9V-G-033] flag: version export button for viewer', async () => {
        // Correct behaviour: matrix model.export V=false, so the control must be absent (red while VH container ungates it).
        await expect.soft(page.getByRole('button', { name: VERSION_EXPORT })).toHaveCount(0);
        await captureEvidence(page, 'E09_9V-G-033_export_flag');
      });
      await test.step('[9V-G-034] no restore/label write', async () => {
        expect.soft(rec.writes).toEqual([]);
        await captureEvidence(page, 'E09_9V-G-034_no_writes');
      });
      await test.step('[9V-G-050] reason is text next to the list', async () => {
        await expect.soft(page.getByText(VERSIONS_READ_ONLY, { exact: true })).toBeVisible();
        await captureEvidence(page, 'E09_9V-G-050_a11y');
      });
    } finally {
      await s.cleanup();
    }
  });

  test('SCR-viewer/28/29/30/31 · FL-9V-06 · engineer · Được xem/sửa-không-ghi trên main chain', async ({ browser }) => {
    test.setTimeout(180_000);
    const s = await openRoleSession(browser, 'engineer', 'viewer');
    const { page, rec } = s;
    try {
      await test.step('[9V-A-001] /3d inspector not locked', async () => {
        await page.goto(ROUTES.project.viewer(s.projectId));
        await expect(page.getByLabel('Khung nhìn mô hình').first()).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText('Chỉ xem', { exact: true })).toHaveCount(0); // ViewerInspector.tsx:87
        await captureEvidence(page, 'E09_9V-A-001_inspector');
      });
      await test.step('[9V-A-036] furniture cards draggable, no upload control', async () => {
        unknown('9V-A-036', 'furniture panel entry point in /3d not traced; asserts only absent lock note + upload button');
        await expect.soft(page.getByText('Chỉ xem được, không kéo vào bản vẽ.')).toHaveCount(0); // FurnitureLibraryPanelCard.tsx:47
        await expect.soft(page.getByRole('button', { name: 'Tải lên mô hình' })).toHaveCount(0); // FurnitureLibraryPanel.tsx:76
        await captureEvidence(page, 'E09_9V-A-036_furniture');
      });
      await test.step('[9V-A-040] wall edit toggle available (no write)', async () => {
        unknown('9V-A-040', 'wall edit entry control name not traced (useWallGeometryEditor.ts:1073); only no-write asserted');
        expect.soft(rec.writes).toEqual([]);
        await captureEvidence(page, 'E09_9V-A-040_wall_edit');
      });
      await test.step('[9V-C-001] rule report rerun + confirm visible', async () => {
        await gotoAs(page, ROUTES.project.rules(s.projectId), RULES_HEADING);
        await expect.soft(page.getByRole('button', { name: 'Chạy kiểm tra lại' })).toBeVisible(); // RuleReport.tsx:305
        await expect.soft(page.getByRole('button', { name: 'Xác nhận đã xử lý' })).toBeVisible(); // :358
        await captureEvidence(page, 'E09_9V-C-001_rules_controls');
      });
      await test.step('[9V-D-034] rule settings same read-only text, switch disabled', async () => {
        await gotoAs(page, ROUTES.project.ruleSettings(s.projectId), RULE_SETTINGS_HEADING);
        await expect.soft(page.getByText(RULE_SETTINGS_READ_ONLY, { exact: true })).toBeVisible();
        await expect.soft(page.getByRole('switch', { name: OPENING_RULE_SWITCH })).toBeDisabled();
        await captureEvidence(page, 'E09_9V-D-034_engineer_rules');
      });
      await test.step('[9V-D-035] thresholds read-only', async () => {
        const open = await page.locator('main input:not([disabled]):not([readonly])').count();
        expect.soft(open, 'editable inputs left for an engineer').toBe(0);
        await captureEvidence(page, 'E09_9V-D-035_thresholds');
      });
      await test.step('[9V-F-001] JSON search + tree visible', async () => {
        await page.goto(ROUTES.project.data(s.projectId));
        await expect.soft(page.getByLabel(JSON_SEARCH)).toBeVisible({ timeout: 15_000 });
        await expect.soft(page.getByRole('tree')).toBeVisible();
        await captureEvidence(page, 'E09_9V-F-001_json');
      });
      await test.step('[9V-E-001] Xuất present and enabled, no forbidden title (not clicked)', async () => {
        await page.goto(ROUTES.project.export(s.projectId));
        await expect(page.getByRole('heading', { name: 'Xuất bản vẽ', exact: true })).toBeVisible({ timeout: 15_000 });
        await expect.soft(page.getByRole('button', { name: 'Xuất', exact: true })).toBeEnabled();
        await expect.soft(page.getByRole('heading', { name: EXPORT_FORBIDDEN, exact: true })).toHaveCount(0);
        expect.soft(rec.writes, 'engineer must not write on main chain').toEqual([]);
        await captureEvidence(page, 'E09_9V-E-001_export_enabled');
      });
    } finally {
      await s.cleanup();
    }
  });
});
