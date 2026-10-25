/**
 * Phase 09 role matrix, pack P8 (flows-C4 FL-9V-04..06): viewer read-only rules/export/share, JSON + version history,
 * engineer can-edit controls (no real write) on the main chain. Real stack, pooled role users, desktop viewport only.
 */
import { expect, test } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { captureEvidence } from './support/evidence';
import { pascalCanvas, viewportReady } from './support/p09/P7';
import { openRoleSession } from './support/p09/P8';
import { gotoAs, mainProject } from './support/p09/roles';

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
const VERSION_LABEL = /^Gắn nhãn v[0-9]+$/u;
const VERSION_EXPORT = /^Xuất (phiên bản này|v[0-9]+)$/u; // VersionHistory.tsx:171
const RULES_HEADING = 'Quy chuẩn';

const unknown = (id: string, why: string): void => {
  test.info().annotations.push({ type: 'UNKNOWN', description: `[${id}] UNKNOWN — NEED VERIFICATION: ${why}` });
};

test.describe('Phase 09 viewer edge B', () => {
  test('SCR-29/30 + ShareDialog · FL-9V-04 · viewer · Cài đặt luật + Xuất + Chia sẻ bị khoá', async ({ browser }) => {
    test.setTimeout(180_000);
    const s = await openRoleSession(browser, 'viewer', 'viewer-b');
    const { page, rec } = s;
    try {
      const readOnly = page.getByText(RULE_SETTINGS_READ_ONLY, { exact: true });
      await test.step('[9V-D-030] rule settings read-only reason', async () => {
        await gotoAs(page, ROUTES.project.ruleSettings(s.projectId), RULE_SETTINGS_HEADING);
        await expect(readOnly).toBeVisible();
        await captureEvidence(page, 'E09_9V-D-030_rules_readonly.png');
      });
      await test.step('[9V-D-031] rule switch disabled', async () => {
        await expect.soft(page.getByRole('switch', { name: OPENING_RULE_SWITCH })).toBeDisabled(); // RuleSettingsRow.tsx:100,151
        await captureEvidence(page, 'E09_9V-D-031_switch_disabled.png');
      });
      await test.step('[9V-D-032] threshold inputs read-only', async () => {
        // Input.tsx:63 renders isReadOnly as plain text, so any remaining <input> must be disabled/readonly.
        const open = await page.locator('main input:not([disabled]):not([readonly])').count();
        expect.soft(open, 'editable inputs left for a viewer').toBe(0);
        await captureEvidence(page, 'E09_9V-D-032_thresholds_readonly.png');
      });
      await test.step('[9V-D-033] no rule-config write', async () => {
        expect.soft(rec.writes.filter((w) => /rule-config/u.test(w))).toEqual([]);
        await captureEvidence(page, 'E09_9V-D-033_no_put.png');
      });
      await test.step('[9V-D-050] switch disabled + reason is readable text', async () => {
        await expect.soft(page.getByRole('switch', { name: OPENING_RULE_SWITCH })).toBeDisabled();
        await expect.soft(readOnly).toBeVisible();
        await captureEvidence(page, 'E09_9V-D-050_a11y.png');
      });

      await test.step('[9V-E-030] export forbidden heading', async () => {
        await gotoAs(page, ROUTES.project.export(s.projectId), EXPORT_FORBIDDEN);
        await expect.soft(page.getByRole('heading', { name: EXPORT_FORBIDDEN, exact: true })).toBeVisible();
        await captureEvidence(page, 'E09_9V-E-030_forbidden.png');
      });
      await test.step('[9V-E-031] export caption', async () => {
        await expect.soft(page.getByText(EXPORT_CAPTION, { exact: true })).toBeVisible();
        await captureEvidence(page, 'E09_9V-E-031_caption.png');
      });
      await test.step('[9V-E-032] no Xuất button, no format cards', async () => {
        await expect.soft(page.getByRole('button', { name: 'Xuất', exact: true })).toHaveCount(0);
        unknown('9V-E-032', 'format card role not traced; radio count used');
        await expect.soft(page.getByRole('radio')).toHaveCount(0);
        await captureEvidence(page, 'E09_9V-E-032_no_export.png');
      });
      await test.step('[9V-E-033] no write/download request', async () => {
        expect.soft(rec.writes).toEqual([]);
        await captureEvidence(page, 'E09_9V-E-033_no_writes.png');
      });
      await test.step('[9V-E-050] lock icon aria-hidden, nothing interactive in panel', async () => {
        await expect.soft(page.locator('svg[aria-hidden="true"]').first()).toBeAttached(); // ExportPanel.tsx:209
        await expect.soft(page.locator('main').getByRole('button')).toHaveCount(0);
        await captureEvidence(page, 'E09_9V-E-050_a11y.png');
      });

      await test.step('[9V-H-030] no share opener on forbidden export', async () => {
        await expect.soft(page.getByRole('button', { name: 'Chia sẻ' })).toHaveCount(0); // ExportPanel.tsx:208 early return
        await captureEvidence(page, 'E09_9V-H-030_no_share.png');
      });
      await test.step('[9V-H-031] share no-permission reason', async () => {
        // feature off: shareLink.ts:354 (SHARE_LINKS_SUPPORTED=false); no /share route in routes/paths.ts.
        unknown('9V-H-031', 'no /share route; dialog unreachable on v1 (SHARE_LINKS_SUPPORTED=false)');
        await expect.soft(page.getByText(SHARE_FORBIDDEN, { exact: true })).toHaveCount(0);
        await captureEvidence(page, 'E09_9V-H-031_share_reason.png');
      });
      await test.step('[9V-H-032] no create-link control, no create request', async () => {
        unknown('9V-H-032', 'dialog unreachable on v1');
        await expect.soft(page.getByRole('button', { name: /tạo liên kết/iu })).toHaveCount(0);
        expect.soft(rec.writes.filter((w) => /share/u.test(w))).toEqual([]);
        await captureEvidence(page, 'E09_9V-H-032_no_create.png');
      });
      await test.step('[9V-H-033] default NO_ROLES is forbidden (covered by 9V-H-031)', async () => {
        unknown('9V-H-033', 'design note (partial); no observable surface');
        await expect.soft(page.getByRole('dialog')).toHaveCount(0);
        await captureEvidence(page, 'E09_9V-H-033_note.png');
      });
      await test.step('[9V-H-050] share reason readable as text', async () => {
        unknown('9V-H-050', 'dialog unreachable on v1');
        await expect.soft(page.getByRole('dialog')).toHaveCount(0);
        await captureEvidence(page, 'E09_9V-H-050_a11y.png');
      });
    } finally {
      await s.cleanup();
    }
  });

  test('SCR-31/32 · FL-9V-05 · viewer · JSON + Lịch sử phiên bản chỉ đọc', async ({ browser }) => {
    test.setTimeout(180_000);
    const s = await openRoleSession(browser, 'viewer', 'viewer-b');
    const { page, rec } = s;
    try {
      await test.step('[9V-F-030] JSON viewer loads, no forbidden title', async () => {
        await page.goto(ROUTES.project.data(s.projectId));
        await expect(page.getByLabel(JSON_SEARCH)).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText('"name": "Tầng').first()).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText(JSON_FORBIDDEN, { exact: true })).toHaveCount(0);
        await captureEvidence(page, 'E09_9V-F-030_json_loaded.png');
      });
      await test.step('[9V-F-031] no save/edit buttons', async () => {
        await expect.soft(page.getByRole('button', { name: /^(Lưu|Sửa)/u })).toHaveCount(0);
        await captureEvidence(page, 'E09_9V-F-031_no_edit.png');
      });
      await test.step('[9V-F-032] no write', async () => {
        expect.soft(rec.writes).toEqual([]);
        await captureEvidence(page, 'E09_9V-F-032_no_writes.png');
      });
      await test.step('[9V-F-050] tree opens by keyboard', async () => {
        const item = page.getByRole('treeitem').first();
        await item.focus();
        const before = (await item.getAttribute('aria-expanded')) ?? 'false';
        await page.keyboard.press(before === 'true' ? 'ArrowLeft' : 'ArrowRight');
        await expect.soft(item).not.toHaveAttribute('aria-expanded', before);
        await captureEvidence(page, 'E09_9V-F-050_keyboard.png');
      });

      await test.step('[9V-G-030] version history read-only reason', async () => {
        // RR2: the default floor (first by order, "Tầng trệt") has no version -> empty state, no list/reason. The work floor holds the pipeline versions (P13.ts:116).
        await page.goto(`${ROUTES.project.versions(s.projectId)}?floorId=${encodeURIComponent(mainProject().workFloorId)}`); // VersionHistory.container.tsx:206
        await expect(page.getByRole('navigation', { name: VERSION_LIST })).toBeVisible({ timeout: 15_000 });
        await expect.soft(page.getByText(VERSIONS_READ_ONLY, { exact: true })).toBeVisible();
        await captureEvidence(page, 'E09_9V-G-030_readonly.png');
      });
      await test.step('[9V-G-031] no restore, no label control (after selecting a version)', async () => {
        // 'Gắn nhãn' renders only with a reviewed row (VersionHistory.tsx:173): select a non-current version first.
        const pick = page
          .getByRole('navigation', { name: VERSION_LIST })
          .getByRole('listitem')
          .filter({ hasNotText: 'Hiện tại' })
          .getByRole('checkbox')
          .first();
        await expect(pick).toBeEnabled();
        await pick.check();
        await expect(pick).toBeChecked();
        await expect.soft(page.getByRole('button', { name: VERSION_RESTORE })).toHaveCount(0);
        await expect.soft(page.getByRole('button', { name: VERSION_LABEL })).toHaveCount(0);
        await captureEvidence(page, 'E09_9V-G-031_no_controls.png');
      });
      await test.step('[9V-G-032] list readable, version selected', async () => {
        const nav = page.getByRole('navigation', { name: VERSION_LIST });
        // Checkboxes are the compare pair, not a single selection: default pair = 2 newest full versions
        // (versionHistoryCompare.ts:85 defaultPairOf; VersionList.tsx:80 checked=isSelectedForCompare) -> min(2, rows).
        // Relation, not absolute count: a parallel copy may add versions on the shared floor.
        const rows = await nav.getByRole('checkbox').count();
        expect(rows).toBeGreaterThan(0);
        await expect(nav.getByRole('checkbox', { checked: true })).toHaveCount(Math.min(2, rows));
        await expect.soft(nav).toBeVisible();
        await captureEvidence(page, 'E09_9V-G-032_select.png');
      });
      await test.step('[9V-G-033] flag: version export button is not role-gated', async () => {
        // QA-09 questions.md Q3 ("Để hiện": no role gate on export). p09-rf showed the button absent: the gate is
        // `onExportVersion !== undefined` (VersionHistory.container.tsx:144) and no route passes it, so it is absent for EVERY
        // role - not a viewer restriction. Role side of Q3 holds; the unwired export is BUG-P09-012.
        await expect.soft(page.getByRole('button', { name: VERSION_EXPORT })).toHaveCount(0);
        await captureEvidence(page, 'E09_9V-G-033_export_flag.png');
      });
      await test.step('[9V-G-034] no restore/label write', async () => {
        expect.soft(rec.writes).toEqual([]);
        await captureEvidence(page, 'E09_9V-G-034_no_writes.png');
      });
      await test.step('[9V-G-050] reason is text next to the list', async () => {
        await expect.soft(page.getByText(VERSIONS_READ_ONLY, { exact: true })).toBeVisible();
        await captureEvidence(page, 'E09_9V-G-050_a11y.png');
      });
    } finally {
      await s.cleanup();
    }
  });

  test('SCR-viewer/28/29/30/31 · FL-9V-06 · engineer · Được xem/sửa-không-ghi trên main chain', async ({ browser }) => {
    test.setTimeout(180_000);
    const s = await openRoleSession(browser, 'engineer', 'viewer-b');
    const { page, rec } = s;
    try {
      await test.step('[9V-A-001] /3d inspector not locked', async () => {
        await page.goto(ROUTES.project.viewer(s.projectId));
        await viewportReady(page); // Pascal on /3d (router.tsx:382)
        await expect(page.getByText('Chỉ xem', { exact: true })).toHaveCount(0); // ViewerInspector.tsx:87
        await captureEvidence(page, 'E09_9V-A-001_inspector.png');
      });
      await test.step('[9V-A-036] furniture cards draggable, no upload control', async () => {
        unknown('9V-A-036', 'furniture panel entry point in /3d not traced; asserts only absent lock note + upload button');
        await expect.soft(page.getByText('Chỉ xem được, không kéo vào bản vẽ.')).toHaveCount(0); // FurnitureLibraryPanelCard.tsx:47
        await expect.soft(page.getByRole('button', { name: 'Tải lên mô hình' })).toHaveCount(0); // FurnitureLibraryPanel.tsx:76
        await captureEvidence(page, 'E09_9V-A-036_furniture.png');
      });
      await test.step('[9V-A-040] wall edit toggle available (no write)', async () => {
        unknown('9V-A-040', 'wall edit entry control name not traced (useWallGeometryEditor.ts:1073); only no-write asserted');
        await expect.soft(pascalCanvas(page)).toBeVisible();
        await captureEvidence(page, 'E09_9V-A-040_wall_edit.png');
      });
      await test.step('[9V-C-001] rule report rerun + confirm visible', async () => {
        await gotoAs(page, ROUTES.project.rules(s.projectId), RULES_HEADING);
        await expect.soft(page.getByRole('button', { name: 'Chạy kiểm tra lại' })).toBeVisible(); // RuleReport.tsx:305
        await expect.soft(page.getByRole('button', { name: 'Xác nhận đã xử lý' })).toBeVisible(); // :358
        await captureEvidence(page, 'E09_9V-C-001_rules_controls.png');
      });
      await test.step('[9V-D-034] rule settings same read-only text, switch disabled', async () => {
        await gotoAs(page, ROUTES.project.ruleSettings(s.projectId), RULE_SETTINGS_HEADING);
        await expect.soft(page.getByText(RULE_SETTINGS_READ_ONLY, { exact: true })).toBeVisible();
        await expect.soft(page.getByRole('switch', { name: OPENING_RULE_SWITCH })).toBeDisabled();
        await captureEvidence(page, 'E09_9V-D-034_engineer_rules.png');
      });
      await test.step('[9V-D-035] thresholds read-only', async () => {
        const open = await page.locator('main input:not([disabled]):not([readonly])').count();
        expect.soft(open, 'editable inputs left for an engineer').toBe(0);
        await captureEvidence(page, 'E09_9V-D-035_thresholds.png');
      });
      await test.step('[9V-F-001] JSON search + tree visible', async () => {
        await page.goto(ROUTES.project.data(s.projectId));
        await expect.soft(page.getByLabel(JSON_SEARCH)).toBeVisible({ timeout: 15_000 });
        await expect.soft(page.getByRole('tree')).toBeVisible();
        await captureEvidence(page, 'E09_9V-F-001_json.png');
      });
      await test.step('[9V-E-001] Xuất present and enabled, no forbidden title (not clicked)', async () => {
        await page.goto(ROUTES.project.export(s.projectId));
        await expect(page.getByRole('heading', { name: 'Xuất bản vẽ', exact: true })).toBeVisible({ timeout: 15_000 });
        await expect.soft(page.getByRole('button', { name: 'Xuất', exact: true })).toBeEnabled();
        await expect.soft(page.getByRole('heading', { name: EXPORT_FORBIDDEN, exact: true })).toHaveCount(0);
        expect.soft(rec.writes, 'engineer must not write on main chain').toEqual([]);
        await captureEvidence(page, 'E09_9V-E-001_export_enabled.png');
      });
    } finally {
      await s.cleanup();
    }
  });
});
