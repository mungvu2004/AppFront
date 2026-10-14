/**
 * Phase 09 · viewer-side edge flows on the real stack (pack P9): FL-9V-07 engineer real writes on an own project,
 * FL-9V-08 admin positive control, FL-9V-09 engineer who is not a project member. Pool users `p09-viewer-engineer` /
 * `p09-viewer-admin`; own projects deleted in `finally`. UNKNOWN — NEED VERIFICATION marks selectors not checked against a live stack.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { captureEvidence } from './support/evidence';
import { pinOneMeasurement, withOwnProject } from './support/p09/P9';
import { adminApi, gotoAs, mainProject, recordWrites, roleUser, signInRole } from './support/p09/roles';

const shot = (page: Page, id: string, slug: string) => captureEvidence(page, `E09_${id}_${slug}.png`);
const layerPut = (page: Page) =>
  page.waitForResponse((r) => r.request().method() === 'PUT' && /\/spatial\/layer$/u.test(new URL(r.url()).pathname));
const ruleConfigPut = (page: Page) =>
  page.waitForResponse((r) => r.request().method() === 'PUT' && /\/rule-config$/u.test(new URL(r.url()).pathname));

test.describe('phase 09 viewer edge (real stack)', () => {
  test('SCR-viewer/25/28/30/32 + ShareDialog · FL-9V-07 · engineer · Ghi thật trên dự án riêng', async ({ browser }) => {
    test.setTimeout(480_000);
    await withOwnProject(browser, 'engineer', 'viewer-c', 'p09-v07', async ({ page, projectId }) => {
      const room = (n: string) => page.getByRole('textbox', { name: `Tên phòng ${n}` });
      await test.step('[9V-A-002] engineer đổi tên phòng rồi đổi lại', async () => {
        await page.goto(ROUTES.project.viewer(projectId));
        await expect(room('Bếp')).toBeEnabled({ timeout: 60_000 }); // RA/useRoomAreaPanel.ts:459-477; label RoomAreaPanel.rows.tsx:153
        const first = layerPut(page);
        await room('Bếp').fill('Bếp qa09');
        await room('Bếp qa09').blur();
        expect((await first).status()).toBe(200);
        const back = layerPut(page);
        await room('Bếp qa09').fill('Bếp');
        await room('Bếp').blur();
        expect((await back).status()).toBe(200);
        await shot(page, '9V-A-002', 'room_rename');
      });
      await test.step('[9V-A-038] HistoryPanel: nút nhảy trạng thái có mặt và bật', async () => {
        // HP/historyPanelGateway.ts:246; label HistoryPanel.rows.tsx:53 (visible on hover/focus only: attached is enough)
        const jump = page.getByRole('button', { name: 'Quay lại trạng thái này' }).first();
        await expect.soft(jump).toBeAttached();
        await expect.soft(jump).toBeEnabled();
        await shot(page, '9V-A-038', 'history_jump');
      });
      await test.step('[9V-B-035] đo: nút ghim bật, không caption chặn', async () => {
        await page.goto(ROUTES.project.measure(projectId));
        await expect(page.getByLabel('Khung nhìn mô hình')).toHaveAttribute('aria-busy', 'false', { timeout: 60_000 });
        await expect.soft(page.getByRole('alert').filter({ hasText: 'chỉ có quyền xem' })).toHaveCount(0); // useMeasurementTool.ts:202
        await shot(page, '9V-B-035', 'pin_enabled');
      });
      await test.step('[9V-B-001] ghim rồi xoá phép đo', async () => {
        await pinOneMeasurement(page);
        const del = page.getByRole('button', { name: /^Xoá / }); // MeasurementList.tsx:154
        await expect.soft(del).toHaveCount(1);
        const gone = page.waitForResponse((r) => r.request().method() === 'DELETE' && /\/measurements\/[^/]+$/u.test(new URL(r.url()).pathname));
        await del.first().click();
        expect.soft((await gone).status()).toBe(204);
        await expect.soft(page.getByRole('button', { name: /^Xoá / })).toHaveCount(0);
        await shot(page, '9V-B-001', 'pin_delete');
      });
      await test.step('[9V-C-034] "Xác nhận đã xử lý" xong không lỗi', async () => {
        await gotoAs(page, ROUTES.project.rules(projectId), 'Kiểm tra luật không gian');
        const confirm = page.getByRole('button', { name: 'Xác nhận đã xử lý' }); // RuleReport.tsx:358
        await expect(confirm).toBeEnabled({ timeout: 30_000 }); // disabled while violations > 0 (RuleReport.tsx:353)
        await confirm.click();
        await expect.soft(page.getByRole('alert')).toHaveCount(0);
        await shot(page, '9V-C-034', 'confirm');
      });
      await test.step('[9V-G-001] gắn nhãn phiên bản rồi gỡ', async () => {
        await page.goto(ROUTES.project.versions(projectId));
        const tag = page.getByRole('button', { name: 'Gắn nhãn phiên bản này' }); // VHV:173
        // a version must be reviewed first (VersionHistory.tsx:174 needs reviewedRow): tick the oldest row (not current)
        const oldest = page.getByRole('navigation', { name: 'Danh sách phiên bản' }).getByRole('listitem').last();
        await expect(oldest).toBeVisible({ timeout: 30_000 });
        await oldest.getByRole('checkbox').locator('xpath=ancestor::label[1]').click();
        await expect(oldest.getByRole('checkbox')).toBeChecked();
        await expect(tag.first()).toBeVisible();
        await expect.soft(page.getByRole('button', { name: 'Phục hồi phiên bản này' }).first()).toBeVisible();
        const dialog = page.getByRole('dialog', { name: /^Gắn nhãn phiên bản/u }); // VHD:37
        await tag.first().click();
        await dialog.getByRole('textbox', { name: 'Nhãn' }).fill('qa09');
        await dialog.getByRole('button', { name: 'Gắn nhãn' }).click();
        await expect.soft(page.getByText('Đã gắn nhãn')).toBeVisible();
        await tag.first().click(); // remove: empty label (VHD:42)
        await dialog.getByRole('textbox', { name: 'Nhãn' }).fill('');
        await dialog.getByRole('button', { name: 'Gắn nhãn' }).click();
        await shot(page, '9V-G-001', 'label_unlabel');
      });
      await test.step('[9V-G-002] khôi phục phiên bản (ghi thật)', async () => {
        const restored = page.waitForResponse((r) => r.request().method() === 'POST' && /\/versions\/[^/]+\/restore$/u.test(new URL(r.url()).pathname));
        await page.getByRole('button', { name: 'Phục hồi phiên bản này' }).first().click();
        await page.getByRole('button', { name: 'Phục hồi', exact: true }).click(); // VHM:541
        expect.soft((await restored).status()).toBeLessThan(300);
        await expect.soft(page.getByText(/Đã phục hồi phiên bản/u)).toBeVisible();
        await shot(page, '9V-G-002', 'restore');
      });
      await test.step('[9V-E-035] xuất .json: tải về bắt được', async () => {
        await page.goto(ROUTES.project.export(projectId));
        // UNKNOWN — NEED VERIFICATION: option role/name for ".json" and the file name pattern (ExportPanel).
        await page.getByRole('radio', { name: /json/iu }).first().check();
        const dl = page.waitForEvent('download', { timeout: 30_000 });
        await page.getByRole('button', { name: 'Xuất', exact: true }).click();
        expect.soft((await dl).suggestedFilename()).toMatch(/\.json$/u);
        await shot(page, '9V-E-035', 'export_json');
      });
      await test.step('[9V-H-001] hộp chia sẻ: nút Chia sẻ VẮNG (tính năng tắt)', async () => {
        // feature off: shareLink.ts:354 (SHARE_LINKS_SUPPORTED=false); anchor = export heading, then absence
        await gotoAs(page, ROUTES.project.export(projectId), 'Xuất bản vẽ');
        await expect(page.getByRole('button', { name: 'Chia sẻ', exact: true })).toHaveCount(0);
        await shot(page, '9V-H-001', 'share_absent');
      });
    });
  });

  test('SCR-viewer/25/29/30 · FL-9V-08 · admin · Đối chứng dương (ngắn)', async ({ browser }) => {
    test.setTimeout(300_000);
    await withOwnProject(browser, 'admin', 'viewer-c', 'p09-v08', async ({ page, projectId }) => {
      await test.step('[9V-A-003] viewer 3D tải, không "Chỉ xem"', async () => {
        await page.goto(ROUTES.project.viewer(projectId));
        await expect(page.getByLabel('Khung nhìn mô hình')).toHaveAttribute('aria-busy', 'false', { timeout: 60_000 });
        await expect(page.getByText('Chỉ xem', { exact: true })).toHaveCount(0); // ViewerInspector.tsx:87
        await shot(page, '9V-A-003', 'admin_viewer');
      });
      await test.step('[9V-B-002] admin ghim được', async () => {
        await page.goto(ROUTES.project.measure(projectId));
        await pinOneMeasurement(page);
        await shot(page, '9V-B-002', 'admin_pin');
      });
      await test.step('[9V-D-001] bật/tắt một luật rồi khôi phục', async () => {
        await gotoAs(page, ROUTES.project.ruleSettings(projectId), 'Cài đặt bộ luật không gian');
        const sw = page.getByRole('switch', { name: /^Bật hoặc tắt luật: lỗ mở nằm trọn/u });
        const was = await sw.isChecked();
        try {
          const put = ruleConfigPut(page);
          await sw.click();
          expect((await put).status()).toBe(200);
          await expect(sw).toBeChecked({ checked: !was });
        } finally {
          if ((await sw.isChecked()) !== was) {
            const back = ruleConfigPut(page);
            await sw.click();
            await back;
          }
        }
        await shot(page, '9V-D-001', 'toggle_restore');
      });
      await test.step('[9V-D-036] dải lý do chỉ đọc KHÔNG hiện', async () => {
        await expect.soft(page.getByText('Chỉ quản trị viên đổi được bộ luật; bạn đang xem ở quyền chỉ đọc.', { exact: true })).toHaveCount(0);
        await shot(page, '9V-D-036', 'no_readonly_strip');
      });
      await test.step('[9V-E-002] như 9V-E-001: màn Xuất mở được với nút Xuất', async () => {
        // UNKNOWN — NEED VERIFICATION: catalog 9V-E-001 text is not in the pack's flow; control = export panel renders.
        await gotoAs(page, ROUTES.project.export(projectId), 'Xuất bản vẽ');
        await expect.soft(page.getByRole('button', { name: 'Xuất', exact: true })).toBeVisible();
        await shot(page, '9V-E-002', 'admin_export');
      });
    });
  });

  test('SCR-29/31/32 · FL-9V-09 · engineer · Không phải thành viên dự án', async ({ browser }) => {
    const admin = await adminApi();
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const { projectId } = mainProject();
      const user = await roleUser(admin, 'engineer', 'viewer-c-outsider'); // never asMember'd (policy 3)
      await signInRole(context, user);
      const page = await context.newPage();
      const rec = recordWrites(page);
      const seen: { status: number; path: string }[] = [];
      page.on('response', (r) => {
        const { pathname } = new URL(r.url());
        if (pathname.startsWith(`/api/projects/${projectId}`)) seen.push({ status: r.status(), path: pathname });
      });
      // oracle: AppBack projects/access.py:5,90 — a non-member gets 404 (wins over 403), so the FE shows not-found, not "no permission"
      const notFound = async (path: string): Promise<void> => {
        const from = seen.length;
        const got = page.waitForResponse((r) => r.request().method() === 'GET' && new URL(r.url()).pathname.startsWith(`/api/projects/${projectId}`));
        await page.goto(path);
        expect((await got).status()).toBe(404);
        await expect(page.getByRole('button', { name: 'Về danh sách dự án', exact: true })).toBeVisible({ timeout: 30_000 });
        expect(seen.slice(from).some((x) => x.status === 403)).toBe(false);
        await expect(page.getByText(mainProject().projectName, { exact: false })).toHaveCount(0);
      };
      await test.step('[9V-D-011] cài đặt bộ luật: người ngoài nhận 404', async () => {
        await notFound(ROUTES.project.ruleSettings(projectId));
        await shot(page, '9V-D-011', 'rules_not_found');
      });
      await test.step('[9V-F-011] dữ liệu không gian: người ngoài nhận 404', async () => {
        await notFound(ROUTES.project.data(projectId));
        await shot(page, '9V-F-011', 'json_not_found');
      });
      await test.step('[9V-G-011] lịch sử phiên bản: người ngoài nhận 404, không ghi', async () => {
        await notFound(ROUTES.project.versions(projectId));
        expect(rec.writes).toEqual([]);
        await shot(page, '9V-G-011', 'versions_not_found');
      });
    } finally {
      await context.close();
      await admin.dispose();
    }
  });
});
