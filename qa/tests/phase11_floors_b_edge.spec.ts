/**
 * Phase 11 — SCR-11 input quality gate, destructive dialogs (QA-11 P2; plan `flows-C1.md` FL-11F-02, 07, 08).
 * One `test()` per flow, one step per catalog row (id in brackets), in flows order. `H` rows hard `expect`, `S` rows `expect.soft`.
 * Data: own projects owned by the pool admin of slot `p11-floors-b`, deleted in `finally`. FL-11F-08 lowers the global role of its OWN
 * pool engineer (slot `p11-floors-b-flip`) and restores it in `finally` (status asserted). No shared project, no admin storage state.
 * Source (FE master 5fcaf502): UIQ/IQD/IQE/IQ under src/screens/upload/InputQualityGate/.
 */
import { expect, test } from '@playwright/test';

import { createPipelineDrawingProject } from './support/drawingSeed';
import { captureEvidence } from './support/evidence';
import { qcLayer, writeLayer } from './support/layerSeed';
import { addProjectMember, framelessPng } from './support/phase03Seed';
import { announced, floorOf, readQuality, seedQualityProject, skewedEnvPng } from './support/p03/P7';
import {
  button,
  COPY,
  cornersBtn,
  cornersDialog,
  dragTo,
  FLIP_SLOT,
  flow,
  handle,
  inside,
  openQuality,
  pool,
  qualityPosts,
  recordWrites,
  row,
  session,
  SLOT,
  straightenBtn,
  straightenDialog,
  writeBand,
} from './support/p11/P2';

const SKEW = 8; // poor skew (>= 5 deg) -> SKEW_DETECTED
const SETUP_TIMEOUT_MS = 330_000;

test.describe('phase 11 · floors B edge', () => {
  test('SCR-11 · FL-11F-02 · engineer · nắn thẳng + cắt và nắn, mọi hộp thoại', async ({ browser }) => {
    test.setTimeout(SETUP_TIMEOUT_MS + 300_000);
    await flow(async (f) => {
      const engineer = await pool(f, 'engineer', SLOT);
      const project = await seedQualityProject(f.ownerApi, '11f-fl02', [
        { name: 'Tầng 1', png: await skewedEnvPng(browser, SKEW) },
        { name: 'Tầng 2', png: await framelessPng(browser) },
        { name: 'Tầng 3', png: await framelessPng(browser) },
        { name: 'Tầng 4', png: await skewedEnvPng(browser, SKEW) },
      ]);
      f.projects.push(project.projectId);
      await addProjectMember(f.ownerApi, project.projectId, engineer.email);
      const s = await session(f, browser, engineer);
      const { page } = s;
      const writes = recordWrites(page);
      await openQuality(page, project.projectId);
      await expect(row(page, 'Tầng 1')).toHaveAttribute('aria-current', 'true');

      await test.step('[11F-A-101] "Tự động nắn" chỉ MỞ hộp thoại, chưa có POST', async () => { // UIQ:1142-1150
        await expect(button(page, COPY.straighten)).toBeVisible();
        await button(page, COPY.straighten).click();
        await expect(straightenDialog(page)).toBeVisible();
        expect(writes.list.map((r) => `${r.method()} ${new URL(r.url()).pathname}`), 'writes after opening the dialog').toEqual([]);
        await captureEvidence(page, 'E11_11F-A-101_floors.png');
      });

      await test.step('[11F-A-102] hộp thoại nắn đúng chữ', async () => { // UIQ:156-160
        const dlg = straightenDialog(page);
        await expect.soft(dlg).toHaveAccessibleName('Nắn thẳng bản vẽ tầng Tầng 1?'); // vi.json:857 straightenTitle ends with "?"; useInputQualityGate.test.ts:340
        await expect.soft(dlg).toContainText(COPY.straightenBody);
        await expect.soft(button(dlg, COPY.cancel)).toBeVisible();
        await expect.soft(button(dlg, COPY.confirmStraighten)).toBeVisible();
        await captureEvidence(page, 'E11_11F-A-102_floors.png');
      });

      await test.step('[11F-A-103] "Huỷ" đóng hộp thoại, không POST, tiêu điểm về nút mở', async () => { // UIQ:1249-1253
        await button(straightenDialog(page), COPY.cancel).click();
        await expect(straightenDialog(page)).toBeHidden();
        expect.soft(qualityPosts(writes, '/quality/straighten'), 'POST after Huỷ').toHaveLength(0);
        await expect.soft(straightenBtn(page)).toBeFocused();
        await captureEvidence(page, 'E11_11F-A-103_floors.png');
      });

      await test.step('[11F-A-104] Esc đóng hộp thoại, không POST', async () => { // IQD:22
        await button(page, COPY.straighten).click();
        await expect(straightenDialog(page)).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(straightenDialog(page)).toBeHidden();
        expect.soft(qualityPosts(writes, '/quality/straighten'), 'POST after Esc').toHaveLength(0);
        await captureEvidence(page, 'E11_11F-A-104_floors.png');
      });

      await test.step('[11F-A-105] Enter khi tiêu điểm ở "Huỷ" KHÔNG xác nhận', async () => { // IQD:30
        await button(page, COPY.straighten).click();
        const dlg = straightenDialog(page);
        await expect(dlg).toBeVisible();
        await button(dlg, COPY.cancel).focus();
        await expect(button(dlg, COPY.cancel)).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(dlg).toBeHidden();
        expect.soft(qualityPosts(writes, '/quality/straighten'), 'POST after Enter on Huỷ').toHaveLength(0);
        await captureEvidence(page, 'E11_11F-A-105_floors.png');
      });

      await test.step('[11F-A-106] "Nắn thẳng" → đúng MỘT POST straighten có Idempotency-Key, 200', async () => { // IQGW:177-181
        await button(page, COPY.straighten).click();
        const answered = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/quality/straighten'), { timeout: 120_000 });
        await button(straightenDialog(page), COPY.confirmStraighten).click();
        const response = await answered;
        expect.soft(response.status(), 'straighten answer').toBe(200);
        expect.soft(response.request().headers()['idempotency-key'] ?? '', 'Idempotency-Key').not.toBe('');
        await expect(straightenDialog(page)).toBeHidden();
        expect.soft(qualityPosts(writes, '/quality/straighten'), 'POST count').toHaveLength(1);
        await captureEvidence(page, 'E11_11F-A-106_floors.png');
      });

      await test.step('[11F-A-107] sau nắn: đọc "Đã nắn thẳng bản vẽ", phát hiện nghiêng biến mất', async () => { // UIQ:170
        await expect.poll(() => announced(page), { timeout: 30_000 }).toContain(COPY.straightened);
        await expect.soft(page.getByRole('listitem').filter({ hasText: 'Ảnh bị nghiêng' })).toHaveCount(0, { timeout: 30_000 });
        await captureEvidence(page, 'E11_11F-A-107_floors.png');
      });

      await test.step('[11F-A-108] không có toast "Hoàn tác" sau nắn', async () => { // UIQ:25,417 (milestone: announcement above)
        await expect.soft(button(page, COPY.undo)).toHaveCount(0);
        await captureEvidence(page, 'E11_11F-A-108_floors.png');
      });

      await test.step('[11F-A-109] hộp thoại cắt đúng chữ', async () => { // UIQ:161-165
        await row(page, 'Tầng 2').click();
        await expect(row(page, 'Tầng 2')).toHaveAttribute('aria-current', 'true');
        await cornersBtn(page).click(); // enters corner mode
        await cornersBtn(page).click(); // "Gửi bốn góc đã chọn" -> dialog
        const dlg = cornersDialog(page);
        await expect(dlg).toBeVisible();
        await expect.soft(dlg).toHaveAccessibleName('Cắt và nắn bản vẽ tầng Tầng 2 theo bốn góc?'); // vi.json:854 cornersTitle ends with "?"
        await expect.soft(dlg).toContainText(COPY.cornersBody);
        await expect.soft(button(dlg, COPY.confirmCorners)).toBeVisible();
        await captureEvidence(page, 'E11_11F-A-109_floors.png');
      });

      await test.step('[11F-A-110] "Huỷ" ở hộp thoại cắt → tay nắm góc còn, không POST', async () => { // UIQ:1250
        await button(cornersDialog(page), COPY.cancel).click();
        await expect(cornersDialog(page)).toBeHidden();
        await expect.soft(page.getByRole('group', { name: COPY.cornerGroup, exact: true })).toBeVisible();
        expect.soft(qualityPosts(writes, '/quality/corners'), 'POST after Huỷ').toHaveLength(0);
        await captureEvidence(page, 'E11_11F-A-110_floors.png');
      });

      await test.step('[11F-A-111] "Cắt và nắn" → POST corners có Idempotency-Key + 4 tỉ lệ, 200', async () => { // IQGW:183-191
        await cornersBtn(page).click();
        const answered = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/quality/corners'), { timeout: 120_000 });
        await button(cornersDialog(page), COPY.confirmCorners).click();
        const response = await answered;
        expect.soft(response.status(), 'corners answer').toBe(200);
        expect.soft(response.request().headers()['idempotency-key'] ?? '', 'Idempotency-Key').not.toBe('');
        const body = response.request().postDataJSON() as { corners: unknown[] };
        expect.soft(body.corners, 'four corner ratios').toHaveLength(4);
        await expect.soft(page.getByRole('group', { name: COPY.cornerGroup, exact: true })).toHaveCount(0);
        await expect.soft(page.getByRole('listitem').filter({ hasText: 'Không tìm thấy khung bản vẽ' })).toHaveCount(0, { timeout: 30_000 });
        await captureEvidence(page, 'E11_11F-A-111_floors.png');
      });

      await test.step('[11F-C-103] bốn góc không hợp lệ → 422 VALIDATION field=corners', async () => { // IQE:25,67
        await row(page, 'Tầng 3').click();
        await expect(row(page, 'Tầng 3')).toHaveAttribute('aria-current', 'true');
        await cornersBtn(page).click();
        await dragTo(page, handle(page, 'Góc trên bên trái'), 0.95, 0.1);
        await cornersBtn(page).click();
        const answered = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/quality/corners'), { timeout: 60_000 });
        await button(cornersDialog(page), COPY.confirmCorners).click();
        const response = await answered;
        expect.soft(response.status(), 'corners answer').toBe(422);
        const err = (await response.json()) as { code?: string };
        expect.soft(err.code, 'error code').toBe('VALIDATION');
        await expect.soft(writeBand(page)).toContainText(COPY.invalidCorners);
        await captureEvidence(page, 'E11_11F-C-103_floors.png', { caption: JSON.stringify(err) });
      });

      await test.step('[11F-E-101] hộp thoại: aria-modal, có nhãn, tiêu điểm bị nhốt', async () => { // IQD:22
        await row(page, 'Tầng 4').click();
        await expect(row(page, 'Tầng 4')).toHaveAttribute('aria-current', 'true');
        await button(page, COPY.straighten).click();
        const dlg = straightenDialog(page);
        await expect(dlg).toBeVisible();
        await expect.soft(dlg).toHaveAttribute('aria-modal', 'true');
        await expect.soft(dlg).toHaveAccessibleName('Nắn thẳng bản vẽ tầng Tầng 4?'); // vi.json:857 straightenTitle = "...{{name}}?" (RR2: Received "...Tầng 4?")
        for (let i = 0; i < 5; i += 1) {
          await page.keyboard.press('Tab');
          expect.soft(await inside(dlg), `Tab ${String(i + 1)} stays inside`).toBe(true);
        }
        await captureEvidence(page, 'E11_11F-E-101_floors.png');
      });

      await test.step('[11F-E-102] tiêu điểm vào hộp thoại và trả về nút mở khi đóng bằng Esc', async () => { // Modal
        const dlg = straightenDialog(page);
        await button(dlg, COPY.cancel).focus();
        expect.soft(await inside(dlg), 'focus inside the open dialog').toBe(true);
        await page.keyboard.press('Escape');
        await expect(dlg).toBeHidden();
        await expect.soft(straightenBtn(page)).toBeFocused();
        await captureEvidence(page, 'E11_11F-E-102_floors.png');
      });
    });
  });

  test('SCR-11 · FL-11F-07 · admin · tầng đã chỉnh tay không nắn lại được', async ({ browser }) => {
    test.setTimeout(SETUP_TIMEOUT_MS + 120_000);
    await flow(async (f) => {
      const seeded = await createPipelineDrawingProject(f.ownerApi, '11f-fl07', await skewedEnvPng(browser, SKEW));
      f.projects.push(seeded.projectId);
      // One human-marked wall → QUALITY_LAYER_REVIEWED (BE quality/service.py:114-120).
      await writeLayer({ request: f.ownerApi, headers: {} }, seeded.projectId, seeded.floorId, (levelId) => {
        const layer = qcLayer(levelId) as { walls: Record<string, unknown>[] };
        layer.walls[0] = { ...layer.walls[0], source: 'human', reviewed: true };
        return layer;
      });
      const { page } = await session(f, browser);

      await test.step('[11F-C-101] tầng đã có chỉnh tay → từ chối với câu đúng', async () => { // IQE:23-24
        await openQuality(page, seeded.projectId);
        await button(page, COPY.straighten).click();
        const answered = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/quality/straighten'), { timeout: 60_000 });
        await button(straightenDialog(page), COPY.confirmStraighten).click();
        const response = await answered;
        expect(response.status()).toBe(422);
        expect(((await response.json()) as { code?: string }).code).toBe('QUALITY_LAYER_REVIEWED');
        await expect(writeBand(page)).toContainText(COPY.layerReviewed);
        await captureEvidence(page, 'E11_11F-C-101_floors.png');
      });
    });
  });

  test('SCR-11 · FL-11F-08 · engineer->viewer · vai bị hạ giữa phiên, 403', async ({ browser }) => {
    test.setTimeout(SETUP_TIMEOUT_MS + 120_000);
    await flow(async (f) => {
      const engineer = await pool(f, 'engineer', FLIP_SLOT);
      const setRole = async (role: 'engineer' | 'viewer'): Promise<number> =>
        (await f.admin.patch(`/api/users/${engineer.id}/role`, { data: { userId: engineer.id, role } })).status();
      f.cleanups.push(async () => expect(await setRole('engineer'), 'restore role engineer').toBe(200));
      const project = await seedQualityProject(f.ownerApi, '11f-fl08', [{ name: 'Tầng 1', png: await skewedEnvPng(browser, SKEW) }]);
      f.projects.push(project.projectId);
      await addProjectMember(f.ownerApi, project.projectId, engineer.email);
      const floorId = project.floors[0]!.id;
      const before = floorOf(await readQuality(f.ownerApi, project.projectId, floorId), floorId).measurement;
      const { page } = await session(f, browser, engineer);

      await test.step('[11F-D-102] vai bị hạ giữa phiên → "Nắn thẳng" nhận 403, câu từ chối, dữ liệu nguyên', async () => { // BE quality/router.py:25
        await openQuality(page, project.projectId);
        await expect(button(page, COPY.straighten)).toBeVisible();
        expect(await setRole('viewer'), 'PATCH role -> viewer').toBe(200);
        await button(page, COPY.straighten).click();
        const answered = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/quality/straighten') && r.status() !== 401, { timeout: 60_000 });
        await button(straightenDialog(page), COPY.confirmStraighten).click();
        const response = await answered;
        expect(response.status(), 'straighten after the role drop').toBe(403);
        await expect(writeBand(page)).toContainText(COPY.forbidden);
        const after = floorOf(await readQuality(f.ownerApi, project.projectId, floorId), floorId).measurement;
        expect(after, 'drawing measurement unchanged').toEqual(before);
        await captureEvidence(page, 'E11_11F-D-102_floors.png');
      });
    });
  });
});
