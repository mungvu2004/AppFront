/**
 * Phase 11 (P8) — SCR-32 restoring a version and SCR-29 resetting the rule set to its defaults, on own throw-away
 * projects (never the main chain project, CP-2 or the shared admin session). Real stack. Flows: FL-11P-07, FL-11P-08.
 * Sources (FE master 5fcaf502): VH/VHM/UVH = src/screens/export/VersionHistory/{VersionHistory.tsx,versionHistoryModel.ts,
 * useVersionHistory.ts}; RS/URS = src/screens/rules/RuleSettings/{RuleSettings.tsx,useRuleSettings.ts}.
 * UNKNOWN — NEED VERIFICATION: the walls-page thickness radio default selection used by 11P-A-029; the revert request shape of "Hoàn tác".
 */
import { expect, test, type Request } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { AUTOSAVE_TIMEOUT_MS } from '../../e2e/fullstack/env';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { createPipelineProject, deleteSeededProject } from './support/drawingSeed';
import { captureEvidence } from './support/evidence';
import { writeLayer, type LayerApi } from './support/layerSeed';
import { envDrawingPng } from './support/phase03Seed';
import { DESKTOP } from './support/p11/common';
import {
  RESTORE_CAPTION,
  UNDO_HISTORY_CLEARED,
  confirmDialog,
  footerText,
  layerWithWalls,
  openVersions,
  pickPair,
  readLayer,
  restoreViaApi,
  recordWrites,
  restoreButton,
  restoreDefaults,
  restorePathRe,
  rowLabels,
  ruleConfigRe,
  toastRegion,
  undoButton,
  versionList,
} from './support/p11/P8';
import { withAdminProject } from './support/p03/P10';
import { closeFlow, openFlow, type Flow } from './support/p03/P5';

test.describe('Phase 11 — version restore and rule reset (own projects)', () => {
  test('SCR-32 · FL-11P-07 · admin · phục hồi phiên bản', async ({ browser }) => {
    test.setTimeout(240_000);
    const admin = readAdminCredentials();
    const request = await signedInApi(admin.email, admin.password);
    const api: LayerApi = { request, headers: {} };
    let flow: Flow | undefined;
    let seededId: string | undefined;
    try {
      // Versions come only from the pipeline and restore (BE pipeline_persist/service.py:184,193; versions/service.py:270,288);
      // a layer PUT creates none. Seed (dup-of: P9.withVersionsProject, which cannot take the extra steps): pipeline run => v1 "before", v2 "after";
      // L9 + restore v1 => v3 (L9), v4; L8 + restore v3 => v5 (L8), v6 (L9). Every restore follows a layer write (K18 snapshots.py:237-247).
      const seeded = await createPipelineProject(request, 'p11-versions', envDrawingPng());
      seededId = seeded.projectId;
      const { projectId, floorId, floorName } = seeded;
      await writeLayer(api, projectId, floorId, layerWithWalls(9));
      await restoreViaApi(api, projectId, floorId, 1);
      const second = await readLayer(api, projectId, floorId); // v4 content
      await writeLayer(api, projectId, floorId, layerWithWalls(8));
      const third = await readLayer(api, projectId, floorId); // v5 content
      await restoreViaApi(api, projectId, floorId, 3);
      const fourth = await readLayer(api, projectId, floorId); // v6 content (current)
      expect(new Set([second.ids.join(), third.ids.join(), fourth.ids.join()]).size, 'three distinct layers').toBe(3);
      flow = await openFlow(browser, admin, { viewport: DESKTOP });
      const { page } = flow;
      const writes = recordWrites(page);
      const restores = (): number => writes.filter((r) => r.method() === 'POST' && restorePathRe(projectId).test(new URL(r.url()).pathname)).length;
      await page.clock.install(); // before the first goto: ticket windows use Date.now (undoTicket.ts:81)

      await test.step('[11P-A-021] nút "Phục hồi phiên bản này" bật cho bản không phải Hiện tại, ẩn cho bản hiện tại', async () => {
        await openVersions(page, projectId, floorId);
        const labels = await rowLabels(page);
        expect(labels.length, 'pipeline 2 + restores 4 = 6 version rows').toBeGreaterThanOrEqual(6);
        await expect(versionList(page).getByRole('listitem').first()).toContainText('Hiện tại');
        await pickPair(page, [labels[0] ?? '', labels[2] ?? '']);
        await expect(restoreButton(page)).toHaveCount(0); // VH:~182 reviewedRow.isCurrent
        await pickPair(page, [labels[1] ?? '', labels[2] ?? '']);
        await expect(restoreButton(page)).toBeEnabled(); // VH:179-189
        await captureEvidence(page, 'E11_11P-A-021_restore_button.png');
      });
      const labels = await rowLabels(page);
      const [, t1 = '', t2 = '', older = ''] = labels;

      await test.step('[11P-A-022] bấm → hộp phục hồi có tiêu đề, caption, câu Ctrl+Z, hai nút', async () => {
        await restoreButton(page).click();
        const dialog = confirmDialog(page);
        await expect.soft(dialog).toContainText(`Phục hồi phiên bản ${t1} của ${floorName}?`); // VHM:539
        await expect.soft(dialog).toContainText(RESTORE_CAPTION); // VHM:502
        await expect.soft(dialog).toContainText(UNDO_HISTORY_CLEARED); // VHM:509
        await expect.soft(dialog.getByRole('button', { name: 'Phục hồi', exact: true })).toBeVisible();
        await expect.soft(dialog.getByRole('button', { name: 'Để nguyên', exact: true })).toBeVisible();
        await captureEvidence(page, 'E11_11P-A-022_restore_dialog.png');
      });

      await test.step('[11P-A-023] "Để nguyên" và Esc: 0 request phục hồi, lớp không đổi', async () => {
        await confirmDialog(page).getByRole('button', { name: 'Để nguyên', exact: true }).click();
        await expect.soft(confirmDialog(page)).toBeHidden();
        await restoreButton(page).click();
        await expect(confirmDialog(page)).toBeVisible();
        await page.keyboard.press('Escape');
        await expect.soft(confirmDialog(page)).toBeHidden();
        expect.soft(restores(), 'POST restore count').toBe(0);
        expect.soft((await readLayer(api, projectId, floorId)).ids, 'layer unchanged').toEqual(fourth.ids);
        await captureEvidence(page, 'E11_11P-A-023_cancelled.png');
      });

      await test.step('[11P-A-029] tầng có sửa chưa lưu: hộp bỏ thay đổi; "Huỷ" giữ nguyên, không phục hồi', async () => {
        // The dirty edit must fail to save (PUT layer aborted) so flushFirst leaves the floor dirty (UVH:334-343).
        const layerRoute = new RegExp(`/api/projects/${projectId}/floors/${floorId}/spatial/layer$`, 'u');
        await page.route(layerRoute, (route) =>
          route.request().method() === 'PUT' ? route.abort() : route.continue(),
        );
        await page.goto(ROUTES.project.walls(projectId, floorId));
        const radio = page.getByRole('radiogroup', { name: 'Độ dày tường', exact: true }).getByRole('radio', { checked: false }).first(); // UNKNOWN: selected wall by default
        await radio.click();
        // No in-app nav link to /versions exists (grep src): client-side navigation via popstate keeps the dirty store.
        await page.evaluate((url) => { window.history.pushState({}, '', url); window.dispatchEvent(new PopStateEvent('popstate')); }, `/projects/${projectId}/versions?floorId=${floorId}`);
        await expect(versionList(page).getByRole('listitem').first()).toBeVisible();
        await pickPair(page, [t1, t2]);
        await restoreButton(page).click();
        await confirmDialog(page).getByRole('button', { name: 'Phục hồi', exact: true }).click();
        const title = new RegExp(`${floorName} còn thay đổi chưa lưu được; tiếp tục sẽ bỏ chúng`, 'u'); // VHM:522
        await expect(confirmDialog(page)).toContainText(title);
        await expect.soft(confirmDialog(page).getByRole('button', { name: 'Bỏ thay đổi và tiếp tục', exact: true })).toBeVisible();
        await confirmDialog(page).getByRole('button', { name: 'Huỷ', exact: true }).click();
        await expect.soft(confirmDialog(page)).toBeHidden();
        expect.soft(restores(), 'no POST restore after Huỷ').toBe(0);
        expect.soft((await readLayer(api, projectId, floorId)).ids).toEqual(fourth.ids);
        await captureEvidence(page, 'E11_11P-A-029_unsaved_discard.png');
        await page.unroute(layerRoute);
        await openVersions(page, projectId, floorId); // fresh load drops the dirty store
      });

      await test.step('[11P-A-025] phục hồi xoá mọi sửa lớp sau bản đích: lớp = nội dung bản đích', async () => {
        await pickPair(page, [t1, t2]);
        await restoreButton(page).click();
        const done = waitForApi(page, 'POST', restorePathRe(projectId), [200]);
        await confirmDialog(page).getByRole('button', { name: 'Phục hồi', exact: true }).click();
        await done;
        await expect(toastRegion(page)).toContainText('Đã phục hồi phiên bản');
        expect.soft((await readLayer(api, projectId, floorId)).ids, 'layer = target (v3) content').toEqual(third.ids);
        await captureEvidence(page, 'E11_11P-A-025_wiped.png');
      });

      await test.step('[11P-A-028] bản trùng hiện trạng: toast "trùng với hiện trạng", không thêm phiên bản', async () => {
        await openVersions(page, projectId, floorId);
        const before = (await rowLabels(page)).length;
        await pickPair(page, [t1, t2]);
        await restoreButton(page).click();
        const done = waitForApi(page, 'POST', restorePathRe(projectId), [200]);
        await confirmDialog(page).getByRole('button', { name: 'Phục hồi', exact: true }).click();
        await done;
        await expect.soft(toastRegion(page)).toContainText('Phiên bản này trùng với hiện trạng'); // UVH:433
        await expect.poll(async () => (await rowLabels(page)).length).toBe(before);
        await captureEvidence(page, 'E11_11P-A-028_same.png');
      });

      await test.step('[11P-A-026] "Hoàn tác" trong 8 s: toast "Đã hoàn tác lượt phục hồi", lớp về trước phục hồi', async () => {
        await openVersions(page, projectId, floorId);
        await pickPair(page, [t2, older]);
        await restoreButton(page).click();
        const done = waitForApi(page, 'POST', restorePathRe(projectId), [200]);
        await confirmDialog(page).getByRole('button', { name: 'Phục hồi', exact: true }).click();
        await done;
        await expect(undoButton(page).first()).toBeVisible();
        expect((await readLayer(api, projectId, floorId)).ids, 'restored to T2').toEqual(second.ids);
        await undoButton(page).first().click();
        await expect.soft(toastRegion(page)).toContainText('Đã hoàn tác lượt phục hồi'); // UVH:395
        await expect.poll(async () => (await readLayer(api, projectId, floorId)).ids).toEqual(third.ids);
        await captureEvidence(page, 'E11_11P-A-026_undone.png');
      });

      await test.step('[11P-A-027] hết 8 s: "Hoàn tác" không còn dùng được (đồng hồ giả, không ngủ)', async () => {
        await openVersions(page, projectId, floorId);
        await pickPair(page, [t2, older]);
        await restoreButton(page).click();
        const done = waitForApi(page, 'POST', restorePathRe(projectId), [200]);
        await confirmDialog(page).getByRole('button', { name: 'Phục hồi', exact: true }).click();
        await done;
        await expect(undoButton(page).first()).toBeVisible();
        const mark = writes.length;
        await page.clock.fastForward(9_000); // UNDO_WINDOW_MS 8000 (undoTicket.ts:18)
        await expect.soft(undoButton(page)).toHaveCount(0);
        expect.soft(writes.length, 'no write after expiry').toBe(mark);
        await captureEvidence(page, 'E11_11P-A-027_expired.png');
      });

      await test.step('[11P-C-011] bấm đúp "Phục hồi": đúng 1 POST', async () => {
        await openVersions(page, projectId, floorId);
        await pickPair(page, [t1, t2]);
        await restoreButton(page).click();
        const before = restores();
        const done = waitForApi(page, 'POST', restorePathRe(projectId), [200]);
        await confirmDialog(page).getByRole('button', { name: 'Phục hồi', exact: true }).dblclick();
        await done;
        await expect(toastRegion(page)).toContainText('Đã phục hồi phiên bản');
        expect.soft(restores() - before, 'POST restore per double click').toBe(1);
        await captureEvidence(page, 'E11_11P-C-011_double_click.png');
      });

      let restoreRequest: Request | undefined;
      await test.step('[11P-A-024] "Phục hồi" → POST restore (baseVersion = revision hiện tại), toast, bản mới ở đầu danh sách', async () => {
        await openVersions(page, projectId, floorId);
        const before = await rowLabels(page);
        const revision = (await readLayer(api, projectId, floorId)).revision;
        await pickPair(page, [t2, older]);
        await restoreButton(page).click();
        const done = waitForApi(page, 'POST', restorePathRe(projectId), [200]);
        await confirmDialog(page).getByRole('button', { name: 'Phục hồi', exact: true }).click();
        const { response } = await done;
        restoreRequest = response.request();
        expect((restoreRequest.postDataJSON() as { baseVersion?: number }).baseVersion, 'baseVersion = layer revision').toBe(revision);
        await expect(toastRegion(page)).toContainText(`Đã phục hồi phiên bản ${t2} của ${floorName}; hoàn tác được trong 8 giây`); // UVH:439-442
        await expect.poll(async () => (await rowLabels(page)).length).toBeGreaterThan(before.length);
        expect.soft((await rowLabels(page))[0], 'new head row').not.toBe(before[0]);
        await expect(versionList(page).getByRole('listitem').first()).toContainText('Hiện tại');
        await captureEvidence(page, 'E11_11P-A-024_restored.png');
      });

      await test.step('[11P-E-007] hộp phục hồi: focus vào, Tab giữ, Esc đóng, focus về nút', async () => {
        await pickPair(page, [t1, t2]);
        await restoreButton(page).focus();
        await page.keyboard.press('Enter');
        const dialog = confirmDialog(page);
        await expect(dialog).toBeVisible();
        await expect.soft(dialog.locator(':focus')).toHaveCount(1); // Modal.Root moves focus in (VH:195)
        for (let press = 0; press < 5; press += 1) {
          await page.keyboard.press('Tab');
          await expect.soft(dialog.locator(':focus')).toHaveCount(1); // Tab stays inside
        }
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        await expect.soft(restoreButton(page)).toBeFocused();
        await captureEvidence(page, 'E11_11P-E-007_focus.png');
      });

      await test.step('[11P-G-005] POST restore đúng path/method/baseVersion; không PUT lớp muộn ghi đè', async () => {
        if (restoreRequest === undefined) throw new Error('11P-A-024 captured no restore request');
        expect(restoreRequest.method()).toBe('POST');
        expect(restorePathRe(projectId).test(new URL(restoreRequest.url()).pathname)).toBe(true);
        expect(typeof (restoreRequest.postDataJSON() as { baseVersion?: unknown }).baseVersion).toBe('number');
        const index = writes.indexOf(restoreRequest);
        expect(index, 'restore request recorded').toBeGreaterThanOrEqual(0);
        const late = writes.slice(index + 1).filter((r) => r.method() === 'PUT' && /\/spatial\/layer$/u.test(new URL(r.url()).pathname));
        expect(late.map((r) => r.url()), 'layer PUT after restore').toEqual([]);
        await captureEvidence(page, 'E11_11P-G-005_no_late_writes.png');
      });
    } finally {
      if (flow !== undefined) await closeFlow(flow);
      const failure = seededId === undefined ? null : await deleteSeededProject(request, seededId);
      await request.dispose();
      expect(failure, 'cleanup deleteSeededProject').toBeNull();
    }
  });

  test('SCR-29 · FL-11P-08 · admin · khôi phục luật mặc định', async ({ browser }) => {
    test.setTimeout(180_000);
    await withAdminProject(browser, 'p11-project-rules', 1, async ({ flow, project, api }) => {
      const { page } = flow;
      const { projectId } = project;
      const writes = recordWrites(page);
      const puts = (): number => writes.filter((r) => r.method() === 'PUT' && ruleConfigRe(projectId).test(new URL(r.url()).pathname)).length;
      await page.clock.install();
      await page.goto(ROUTES.project.ruleSettings(projectId));
      await expect(page.getByRole('heading', { name: 'Cài đặt bộ luật không gian', level: 2 })).toBeVisible();
      const stripBase = (value: unknown): unknown => Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => !/^(revision|version|baseVersion|updatedAt|etag)$/u.test(key)));
      const defaultRes = await api.get(`/api/projects/${projectId}/rule-config`);
      expect(defaultRes.status(), 'GET rule-config of the fresh project').toBe(200);
      const defaultConfig = stripBase(await defaultRes.json());
      const toggle = page.getByRole('switch', { name: /^Bật hoặc tắt luật: /u }).first();
      const makeDirty = async (): Promise<void> => {
        const before = await toggle.getAttribute('aria-checked');
        const put = waitForApi(page, 'PUT', ruleConfigRe(projectId), [200], AUTOSAVE_TIMEOUT_MS);
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true');
        await put;
        await expect(restoreDefaults(page)).toBeVisible();
      };
      const resetViaClick = async (): Promise<void> => {
        const put = waitForApi(page, 'PUT', ruleConfigRe(projectId), [200], AUTOSAVE_TIMEOUT_MS);
        await restoreDefaults(page).click();
        await put;
      };

      await test.step('[11P-A-030] khác mặc định: footer + nút; đã mặc định thì ẩn', async () => {
        await expect(toggle).toBeEnabled();
        await expect.soft(footerText(page)).toHaveCount(0); // RS:257 fresh project = default
        await expect.soft(restoreDefaults(page)).toHaveCount(0);
        await makeDirty();
        await expect.soft(footerText(page)).toBeVisible(); // RS:324-328
        await captureEvidence(page, 'E11_11P-A-030_footer.png');
      });

      await test.step('[11P-E-008] nút bấm được bằng Enter/Space; "Hoàn tác" của toast tới được bằng Tab', async () => {
        await restoreDefaults(page).focus();
        const put = waitForApi(page, 'PUT', ruleConfigRe(projectId), [200], AUTOSAVE_TIMEOUT_MS);
        await page.keyboard.press('Enter');
        await put;
        await expect(toastRegion(page)).toContainText('Đã trả bộ luật về mặc định.');
        await expect(restoreDefaults(page)).toHaveCount(0);
        let reached = false;
        await page.locator('body').click({ position: { x: 1, y: 1 } });
        for (let press = 0; press < 40 && !reached; press += 1) {
          await page.keyboard.press('Tab');
          reached = await undoButton(page).first().evaluate((el) => el === document.activeElement);
        }
        expect(reached, 'toast "Hoàn tác" reached with Tab').toBe(true);
        await makeDirty();
        await restoreDefaults(page).focus();
        const second = waitForApi(page, 'PUT', ruleConfigRe(projectId), [200], AUTOSAVE_TIMEOUT_MS);
        await page.keyboard.press('Space');
        await second;
        await expect(restoreDefaults(page)).toHaveCount(0);
        await captureEvidence(page, 'E11_11P-E-008_keyboard.png');
      });

      await test.step('[11P-A-031] bấm "Khôi phục mặc định": không hộp xác nhận, áp ngay + toast', async () => {
        await makeDirty();
        await resetViaClick();
        await expect.soft(page.getByRole('dialog')).toHaveCount(0);
        await expect.soft(toastRegion(page)).toContainText('Đã trả bộ luật về mặc định.'); // URS:1079-1081
        await captureEvidence(page, 'E11_11P-A-031_no_confirm.png');
      });

      await test.step('[11P-A-032] PUT rule-config sau reset; GET lại = mặc định; footer biến mất', async () => {
        await makeDirty();
        const put = waitForApi(page, 'PUT', ruleConfigRe(projectId), [200], AUTOSAVE_TIMEOUT_MS);
        await restoreDefaults(page).click();
        const { response } = await put;
        expect(response.request().method()).toBe('PUT');
        await expect(footerText(page)).toHaveCount(0);
        const get = page.waitForResponse((res) => res.request().method() === 'GET' && ruleConfigRe(projectId).test(new URL(res.url()).pathname));
        await page.reload({ waitUntil: 'commit' });
        const stripRev = (value: unknown): unknown => Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => !/^(revision|version|baseVersion|updatedAt|etag)$/u.test(key)));
        const afterReset = (await get);
        expect(afterReset.status(), 'GET rule-config after reset').toBe(200);
        expect(stripRev(await afterReset.json()), 'config = default').toEqual(defaultConfig);
        await expect(page.getByRole('heading', { name: 'Cài đặt bộ luật không gian', level: 2 })).toBeVisible();
        await expect.soft(footerText(page)).toHaveCount(0); // server config is the default again
        await expect.soft(restoreDefaults(page)).toHaveCount(0);
        await captureEvidence(page, 'E11_11P-A-032_put_get.png');
      });

      await test.step('[11P-A-033] toast "Hoàn tác" trong 8 s khôi phục đúng cấu hình trước', async () => {
        await makeDirty();
        await resetViaClick();
        await expect(footerText(page)).toHaveCount(0);
        const put = waitForApi(page, 'PUT', ruleConfigRe(projectId), [200], AUTOSAVE_TIMEOUT_MS);
        await undoButton(page).first().click(); // URS:699-705
        await put;
        await expect.soft(footerText(page)).toBeVisible();
        await captureEvidence(page, 'E11_11P-A-033_undo.png');
        await resetViaClick(); // back to default for the next step
        await expect(footerText(page)).toHaveCount(0);
      });

      await test.step('[11P-A-034] hết 8 s: vé hết hạn, không PUT', async () => {
        await makeDirty();
        await resetViaClick();
        await expect(undoButton(page).first()).toBeVisible();
        const mark = puts();
        await page.clock.fastForward(9_000); // UNDO_WINDOW_MS (ticket reads Date.now, URS:693)
        await expect.soft(undoButton(page)).toHaveCount(0);
        expect.soft(puts(), 'no PUT after expiry').toBe(mark);
        await captureEvidence(page, 'E11_11P-A-034_expired.png');
      });

      await test.step('[11P-A-035] bộ luật sẵn rồi reset: mỗi lần một toast/vé riêng; vé cũ không ghi đè vé mới', async () => {
        const preset = page.getByRole('region', { name: 'Bộ luật sẵn', exact: true }).getByRole('button', { name: /^Văn phòng/u });
        const presetPut = waitForApi(page, 'PUT', ruleConfigRe(projectId), [200], AUTOSAVE_TIMEOUT_MS);
        await preset.click();
        const presetBody = ((await presetPut).response.request().postDataJSON() as { body: unknown }).body;
        await expect(restoreDefaults(page)).toBeVisible();
        await resetViaClick();
        await expect(footerText(page)).toHaveCount(0);
        await expect.soft(undoButton(page)).toHaveCount(2); // URS:688-693 one ticket per change
        const put = waitForApi(page, 'PUT', ruleConfigRe(projectId), [200], AUTOSAVE_TIMEOUT_MS);
        await undoButton(page).first().click(); // .first() = newest toast (Toast.tsx stacks newest first) => back to the preset state
        const undone = (await put).response.request().postDataJSON() as { body: unknown };
        expect(undone.body, 'newest ticket restores the preset config').toEqual(presetBody);
        await expect(footerText(page)).toBeVisible();
        const mark = puts();
        await undoButton(page).last().click(); // OLD ticket (pre-preset default): must not overwrite the newer state
        await expect.soft(footerText(page)).toBeVisible();
        expect.soft(puts(), 'old ticket sends no PUT').toBe(mark);
        await captureEvidence(page, 'E11_11P-A-035_preset_reset.png');
      });
    });
  });
});
