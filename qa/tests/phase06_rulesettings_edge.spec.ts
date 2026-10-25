/**
 * Phase 6 — SCR-29 Rule Settings, EDGE layer, REAL stack (QA-06b P3, `flows-C2.md` "phase06_rulesettings_edge.spec.ts"):
 * 11 flows, one `test()` per flow, one `test.step('[<row id>] …')` per catalog row in plan order. `H` rows use a hard
 * `expect`, `S` rows `expect.soft`; ⚑ rows state the CORRECT behaviour and stay red while the bug is open. Each step ends
 * with `E06s_<row id>_<slug>.png`. No `[mocked response]` here (those are in `_mocked_edge`); the visual pass is in `_ui`.
 *
 * Source (FE, master d50bb248): RSV RuleSettings.tsx · RSG …Groups.tsx · RSP …Presets.tsx · RSD …ReloadDialog.tsx · RSR …Row.tsx ·
 * RSW ruleSettingsGateway.ts · URS useRuleSettings.ts (all `src/screens/rules/RuleSettings/`) · CFG `src/domain/rules/config.ts` ·
 * AUT `src/lib/autosave/createAutosave.ts` · NF `src/hooks/useNumericField.ts` · PSG `src/components/feedback/ProjectSpatialGate.tsx`.
 *
 * ## Waiting
 * No fixed waits. "Autosave" = wait for the real request (`waitRulePut`, 800 ms debounce + round trip). A "no PUT" claim is
 * judged only after a sure mark: the answer of the next deliberate write (`strayPuts`: serial autosave sends a stray PUT
 * first), a state the autosave only reaches after its run (`settled`), or the in-page recorder (`recordUi`).
 *
 * ## Request budget per full run (BE defaults; QA stack override `qa-limits.override.yml`)
 * - `POST /api/auth/login`: 2 per flow (page session + admin API) = 22, plus the pool users' sessions in FL-29-09 (1),
 *   FL-29-10 (2) = 25 (limit 120 / 60 s per IP). `POST /api/auth/refresh`: ~1 per page load (≈ 40 loads).
 * - `POST /api/projects` 12 (+1 FL-29-08 second project), `DELETE` 13. `POST …/members` 2 (FL-29-10).
 * - `PUT …/rule-config`: ≈ 90 from the screen, ≈ 60 by API ("+X" writers, FL-29-04 `[29-C-009]` = 52 PUTs). No rate limit on
 *   N21/N22 (BE rules/router.py has no `rate_limit(`).
 * - Pool users `p06-settings1..3` (engineer / viewer / engineer): 3 invitations on a cold pool (`users_invite` 30 / 3600 s), 0 warm.
 * - No upload, no drawing, no pipeline run.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { navigateThenWaitForApi, waitForApi } from '../../e2e/fullstack/apiWatch';
import type { ApiResult } from '../../e2e/fullstack/apiWatch';
import { RULE_THRESHOLD_SPECS } from '../../src/domain/rules/thresholdSpecs';
import { addProjectMember, poolUser } from './support/phase03Seed';
import {
  DEFAULT_ON,
  DOOR_WIDTH,
  GROUPS,
  MIN_THICKNESS,
  NOID,
  ROOM_AREA_BELOW,
  ROOM_HAS_DOOR,
  ROOM_MIN_AREA,
  ROOM_NO_DOOR,
  ROOM_UNNAMED,
  RS,
  TOTAL_RULES,
  WALL_LENGTH,
  WALL_OVERLAP,
  WALL_THICKNESS,
  allRuleSwitches,
  asRecord,
  clearRecorded,
  closeSession,
  dialogReload,
  frames,
  getsSince,
  groupCard,
  groupSwitch,
  groupSwitchName,
  heading,
  indicator,
  inOrder,
  numberField,
  openSession,
  openSettings,
  overrideOf,
  ownProject,
  putOf,
  readRevision,
  recordUi,
  recorded,
  revisionOf,
  ruleConfigRe,
  ruleSwitch,
  ruleSwitchName,
  settled,
  severityCombo,
  shot,
  spaNavigate,
  spatialRe,
  stickyFooter,
  strayPuts,
  thresholdOf,
  toast,
  toastRegion,
  typeNum,
  waitRulePut,
  withAdmin,
  withApi,
  writeElsewhere,
  putRuleConfig,
  type Ctx,
  type Session,
} from './support/p06/ruleSettings';

const pathOf = (page: Page): string => new URL(page.url()).pathname;
const REGION_LABELS = [...GROUPS.map((group) => group.label), RS.generalNav] as const;
const rulesIn = (card: Locator): Locator => card.getByRole('switch', { name: /^Bật hoặc tắt luật: / });

/** The "Kiểm tra luật không gian" screen (SCR-28), opened as the old edge spec did (RRV:287,305). */
async function openRules(page: Page, projectId: string): Promise<void> {
  await navigateThenWaitForApi(page, () => page.goto(ROUTES.project.rules(projectId), { waitUntil: 'commit' }), 'GET', spatialRe(projectId), [200]);
  await expect(page.getByRole('heading', { name: 'Kiểm tra quy chuẩn', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kiểm tra lại', exact: true })).toBeEnabled();
}

test.describe('SCR-29 Rule Settings · edge (real stack)', () => {
  test('SCR-29 · FL-29-01 · mở màn, đọc mô hình, bố cục dữ liệu, landmark, nav', async ({ browser }) => {
    await withAdmin(browser, async (c) => {
      const { page } = c;
      const { projectId: id } = await ownProject(c, '29-01-open');
      const mark0 = c.sent.length;
      const logMark = c.log.length;

      await test.step('[29-G-001] mở route: đúng một GET rule-config 200 {revision:0, overrides:{}}', async () => {
        const got = await openSettings(page, id);
        expect(got.response.status()).toBe(200);
        const body = asRecord(got.json, 'N21');
        expect(body.revision).toBe(0);
        expect(body.overrides).toEqual({});
        expect.soft(getsSince(c.log, logMark, id), 'one GET rule-config on open').toBe(1);
        await shot(page, '29-G-001', 'get_once');
      });

      await test.step('[29-G-014] chưa sửa gì → 0 PUT (kiểm lại ở bước cuối)', async () => {
        await frames(page);
        expect.soft(c.sent.slice(mark0), 'no PUT before any edit').toEqual([]);
        await shot(page, '29-G-014', 'no_put');
      });

      await test.step('[29-A-002] sáu thẻ trong DOM, 25 switch luật', async () => {
        for (const label of REGION_LABELS) await expect.soft(groupCard(page, label)).toBeVisible();
        await expect.soft(allRuleSwitches(page)).toHaveCount(TOTAL_RULES);
        await shot(page, '29-A-002', 'six_cards');
      });

      await test.step('[29-B-003] impact dự án trống: mọi hàng "Đang ảnh hưởng 0 đối tượng"', async () => {
        await expect.soft(page.getByText('Đang ảnh hưởng 0 đối tượng', { exact: true })).toHaveCount(TOTAL_RULES);
        await shot(page, '29-B-003', 'impact_zero');
      });

      await test.step('[29-B-012] luật bị thay thế: ghi chú + switch tắt', async () => {
        await expect.soft(page.getByText(`Đã được thay thế bởi ${ROOM_NO_DOOR.name}`, { exact: true })).toHaveCount(1);
        await expect.soft(page.getByText(`Đã được thay thế bởi ${ROOM_AREA_BELOW.name}`, { exact: true })).toHaveCount(1);
        await expect.soft(ruleSwitch(page, ROOM_HAS_DOOR.name)).toHaveAttribute('aria-checked', 'false');
        await expect.soft(ruleSwitch(page, ROOM_MIN_AREA.name)).toHaveAttribute('aria-checked', 'false');
        await shot(page, '29-B-012', 'superseded');
      });

      await test.step('[29-B-014] mô tả hàng "Soi trên từng tầng · …" / "Soi trên cả công trình · …"', async () => {
        await expect.soft(page.getByText(/^Soi trên (từng tầng|cả công trình) · /u)).toHaveCount(TOTAL_RULES);
        await shot(page, '29-B-014', 'row_description');
      });

      await test.step('[29-C-010] số luật bật = số switch luật aria-checked=true', async () => {
        const on = await page.getByRole('switch', { name: /^Bật hoặc tắt luật: /u, checked: true }).count();
        expect.soft(on).toBe(DEFAULT_ON);
        await expect.soft(page.getByText(RS.enabledCount)).toHaveText(`${String(on)}/${String(TOTAL_RULES)} luật đang bật`);
        await shot(page, '29-C-010', 'enabled_count');
      });

      await test.step('[29-C-011] mô tả nhóm "N luật, M đang bật." tính từ hàng', async () => {
        for (const group of GROUPS) {
          const card = groupCard(page, group.label);
          const n = await rulesIn(card).count();
          const m = await card.getByRole('switch', { name: /^Bật hoặc tắt luật: /u, checked: true }).count();
          await expect.soft(card.getByText(`${String(n)} luật, ${String(m)} đang bật.`, { exact: true }), group.label).toBeVisible();
        }
        await shot(page, '29-C-011', 'group_description');
      });

      await test.step('[29-C-027] nhãn tiếng Việt hạ chữ đầu', async () => {
        await expect.soft(page.getByRole('switch', { name: 'Bật hoặc tắt luật: bề dày tường nằm trong khoảng dựng được', exact: true })).toBeVisible();
        await expect.soft(page.getByRole('switch', { name: 'Bật hoặc tắt cả nhóm: cao độ tầng', exact: true })).toBeVisible();
        await shot(page, '29-C-027', 'lower_first');
      });

      await test.step('[29-E-001] landmark: h2, navigation, mỗi thẻ region tên = h3', async () => {
        await expect.soft(heading(page)).toBeVisible();
        await expect.soft(page.getByRole('navigation', { name: RS.nav, exact: true })).toBeVisible();
        for (const label of REGION_LABELS) {
          await expect.soft(groupCard(page, label).getByRole('heading', { level: 3, name: label, exact: true }), label).toBeVisible();
        }
        await shot(page, '29-E-001', 'landmarks');
      });

      await test.step('[29-D-001] admin sửa được: không điều khiển nào disabled, không alert chỉ-đọc', async () => {
        await expect.soft(page.getByRole('switch', { disabled: true })).toHaveCount(0);
        await expect.soft(page.locator('input[readonly]')).toHaveCount(0);
        const presets = page.getByRole('region', { name: RS.presets, exact: true }).getByRole('button');
        await expect.soft(presets).toHaveCount(3);
        expect.soft(await presets.evaluateAll((buttons) => buttons.every((button) => !(button as HTMLButtonElement).disabled))).toBe(true);
        await expect.soft(page.getByText(RS.readOnly, { exact: true })).toHaveCount(0);
        await shot(page, '29-D-001', 'admin_editable');
      });

      await test.step('[29-A-024] nav "Ngưỡng chung": aria-current, hash, thẻ trong khung nhìn', async () => {
        const nav = page.getByRole('navigation', { name: RS.nav, exact: true });
        const general = nav.getByRole('link', { name: RS.generalNav, exact: true });
        await general.click();
        await expect.soft(general).toHaveAttribute('aria-current', 'true');
        await expect.poll(() => new URL(page.url()).hash).toBe(RS.generalHash);
        await expect.soft(groupCard(page, RS.generalNav)).toBeInViewport();
        await shot(page, '29-A-024', 'nav_general');
      });

      await test.step('[29-A-025] sáu link nav → đúng hash và thẻ; link đầu aria-current lúc mở', async () => {
        await openSettings(page, id); // fresh document: no hash, first link current
        const nav = page.getByRole('navigation', { name: RS.nav, exact: true });
        await expect.soft(nav.getByRole('link', { name: GROUPS[0].label, exact: true })).toHaveAttribute('aria-current', 'true');
        for (const target of [...GROUPS.map((group) => ({ hash: `#rule-settings-${group.id}`, label: group.label })), { hash: RS.generalHash, label: RS.generalNav }]) {
          await nav.getByRole('link', { name: target.label, exact: true }).click();
          await expect.poll(() => new URL(page.url()).hash, target.label).toBe(target.hash);
          await expect.soft(groupCard(page, target.label), target.label).toBeInViewport();
        }
        expect.soft(c.sent.slice(mark0), '[29-G-014] still no PUT after the whole read-only tour').toEqual([]);
        await shot(page, '29-A-025', 'nav_all_links');
      });
    });
  });

  test('SCR-29 · FL-29-02 · bật/tắt luật → nhịp tự lưu → hoàn tác → ngoại tuyến', async ({ browser }) => {
    test.setTimeout(240_000);
    await withAdmin(browser, async (c) => {
      const { page } = c;
      const { projectId: id } = await ownProject(c, '29-02-autosave');
      await recordUi(page);
      await openSettings(page, id);
      const sw = ruleSwitch(page, WALL_THICKNESS.name);
      // The layout's own N21 read (useProjectSpatial, after the spatial graph hydrates) can land after the screen's GET:
      // let the open settle so only a read caused by the save is counted (BUG-718).
      await page.waitForLoadState('networkidle');
      const logBeforeFirstPut = c.log.length;
      let put1!: ApiResult;
      let put2!: ApiResult;
      let put3!: ApiResult;

      await test.step('[29-A-026] tắt một luật: chỉ báo dirty → "Đang lưu…" → "Đã lưu lúc"; PUT#1 200', async () => {
        await expect(sw).toHaveAttribute('aria-checked', 'true');
        const pending = waitRulePut(page, id);
        await sw.click();
        await expect(sw).toHaveAttribute('aria-checked', 'false');
        put1 = await pending;
        expect(put1.response.status()).toBe(200);
        await expect(indicator(page)).toHaveText(RS.savedAt);
        const seen = await recorded(page);
        expect.soft(inOrder(seen.indicator, [RS.dirty, RS.saving, RS.savedAt]), `indicator sequence: ${seen.indicator.join(' → ')}`).toBe(true);
        await shot(page, '29-A-026', 'indicator_cycle');
      });

      await test.step('[29-G-002] đường + thân PUT#1: đúng hai khoá baseVersion, body.overrides; không version', async () => {
        const request = put1.response.request();
        expect.soft(request.method()).toBe('PUT');
        expect.soft(new URL(request.url()).pathname).toBe(`/api/projects/${id}/rule-config`);
        const sent = putOf(put1);
        expect.soft(sent.topKeys).toEqual(['baseVersion', 'body']);
        expect.soft(Object.keys(sent.body)).toEqual(['overrides']);
        expect.soft(sent.topKeys).not.toContain('version');
        await shot(page, '29-G-002', 'put_shape');
      });

      await test.step('[29-C-019] thân gọn: chỉ {enabled:false}, không mục rỗng, không thresholds:{}', async () => {
        expect.soft(putOf(put1).overrides).toEqual({ [WALL_THICKNESS.code]: { enabled: false } });
        await shot(page, '29-C-019', 'compact_body');
      });

      await test.step('[29-G-003] trả lời PUT#1: revision 1; không GET rule-config thêm (cache setQueryData)', async () => {
        expect.soft(revisionOf(put1)).toBe(1);
        expect.soft(getsSince(c.log, logBeforeFirstPut, id), 'no re-read after a save').toBe(0);
        await shot(page, '29-G-003', 'revision_cache');
      });

      await test.step('[29-A-005] bật lại bằng switch: PUT#2 200; toast "Bật luật …."', async () => {
        const pending = waitRulePut(page, id);
        await sw.click();
        put2 = await pending;
        expect.soft(put2.response.status()).toBe(200);
        await expect.soft(sw).toHaveAttribute('aria-checked', 'true');
        await expect.soft(toast(page, `Bật luật ${WALL_THICKNESS.name}.`).first()).toBeVisible();
        await shot(page, '29-A-005', 'toggle_back');
      });

      await test.step('[29-C-018] chuỗi baseVersion: PUT#1 = 0, PUT#2 = revision của PUT#1', async () => {
        expect.soft(putOf(put1).baseVersion).toBe(0);
        expect.soft(putOf(put2).baseVersion).toBe(revisionOf(put1));
        await shot(page, '29-C-018', 'base_chain');
      });

      await test.step('[29-C-013] ⚑ về trạng thái mặc định: PUT#2 overrides {}; chân dính biến mất', async () => {
        // CFG:276-283 isEmptyOverride keeps `{enabled:true}` — the correct body is `overrides:{}` and no sticky footer.
        expect.soft(putOf(put2).overrides, 'on→off→on is the default config').toEqual({});
        await expect.soft(stickyFooter(page)).toHaveCount(0);
        await shot(page, '29-C-013', 'back_to_default');
      });

      await test.step('[29-A-006] tắt lại rồi "Hoàn tác": PUT#3 (tắt) và PUT#4 (hoàn tác) nối baseVersion', async () => {
        const offPut = waitRulePut(page, id);
        await sw.click();
        put3 = await offPut;
        const offToast = toast(page, `Tắt luật ${WALL_THICKNESS.name}.`).first();
        await expect(offToast).toBeVisible();
        const undoPut = waitRulePut(page, id);
        await offToast.getByRole('button', { name: RS.undo, exact: true }).click();
        const put4 = await undoPut;
        expect.soft(putOf(put4).baseVersion).toBe(revisionOf(put3));
        await expect.soft(sw).toHaveAttribute('aria-checked', 'true');
        // not `toBeUndefined()`: whether an `{enabled:true}` stub stays is [29-C-013]'s question, not this step's.
        expect.soft(overrideOf(putOf(put4), WALL_THICKNESS.code)?.enabled ?? true, 'the rule is back on').toBe(true);
        await shot(page, '29-A-006', 'undo_put');
      });

      await test.step('[29-A-008] bật + Hoàn tác trong cửa sổ 800 ms → không PUT', async () => {
        // same-kind toasts group for 5 s and one "Hoàn tác" undoes the whole group (notificationBus.ts:157-181): start from an empty region
        await page.mouse.move(2, 2);
        await expect(toastRegion(page).getByRole('status')).toHaveCount(0, { timeout: 20_000 });
        const mark = c.sent.length;
        // click + undo inside ONE page task (< 100 ms), so the 800 ms debounce cannot elapse whatever the runner's pace (slowMo 0 or 400)
        await sw.evaluate(async (el) => {
          (el as HTMLElement).click();
          const undoButton = (): HTMLElement | undefined =>
            [...document.querySelectorAll<HTMLElement>('[aria-label="Thông báo"] button')].find((button) => /^Hoàn tác/u.test(button.textContent ?? ''));
          const found =
            undoButton() ??
            (await new Promise<HTMLElement>((resolve) => {
              const observer = new MutationObserver(() => {
                const button = undoButton();
                if (button !== undefined) {
                  observer.disconnect();
                  resolve(button);
                }
              });
              observer.observe(document.body, { subtree: true, childList: true });
            }));
          found.click();
        });
        await expect(sw).toHaveAttribute('aria-checked', 'true');
        // the autosave ran and found nothing to send; an earlier save in this session makes the resting label "Đã lưu lúc …" (useSaveIndicator.ts:69-70)
        await expect(indicator(page)).toHaveText(RS.savedAt);
        expect.soft(c.sent.slice(mark), 'undo inside the debounce window sends nothing').toEqual([]);
        await shot(page, '29-A-008', 'undo_in_window');
      });

      await test.step('[29-A-009] ba lần bấm liên tiếp gộp thành một PUT với trạng thái cuối', async () => {
        const mark = c.sent.length;
        const lengthSwitch = ruleSwitch(page, WALL_LENGTH.name);
        const pending = waitRulePut(page, id);
        // one JS task, so the three clicks land inside the 800 ms window whatever the runner's pace (slowMo).
        await lengthSwitch.evaluate((el) => {
          (el as HTMLElement).click();
          (el as HTMLElement).click();
          (el as HTMLElement).click();
        });
        await pending;
        await settled(page);
        await expect.soft(lengthSwitch).toHaveAttribute('aria-checked', 'false');
        const sent = c.sent.slice(mark);
        expect.soft(sent.length, 'one coalesced PUT').toBe(1);
        expect.soft(overrideOf(sent[0] ?? putOf(put1), WALL_LENGTH.code)).toEqual({ enabled: false });
        await shot(page, '29-A-009', 'coalesced');
      });

      await test.step('[29-A-007] hết cửa sổ hoàn tác: toast và nút "Hoàn tác" biến mất', async () => {
        await page.mouse.move(2, 2); // a pointer resting on a toast holds its 8 s clock (Toast.tsx isHeld)
        await expect.soft(toastRegion(page).getByRole('button', { name: /^Hoàn tác/u })).toHaveCount(0, { timeout: 20_000 });
        await expect.soft(toastRegion(page).getByRole('status')).toHaveCount(0, { timeout: 20_000 });
        await expect.soft(ruleSwitch(page, WALL_LENGTH.name)).toHaveAttribute('aria-checked', 'false');
        await shot(page, '29-A-007', 'undo_window_over');
      });

      await test.step('[29-A-028] mở lại màn: trạng thái từ máy chủ; "Chưa có thay đổi"', async () => {
        await openSettings(page, id);
        await expect.soft(ruleSwitch(page, WALL_LENGTH.name)).toHaveAttribute('aria-checked', 'false');
        await expect.soft(sw).toHaveAttribute('aria-checked', 'true');
        await expect.soft(indicator(page)).toHaveText(RS.idle);
        await shot(page, '29-A-028', 'reopened');
      });

      await test.step('[29-B-017] ngoại tuyến: "Ngoại tuyến — sẽ lưu khi có mạng"; không PUT; có mạng lại → PUT 200', async () => {
        const mark = c.sent.length;
        await c.context.setOffline(true);
        let back: Promise<ApiResult> | undefined;
        try {
          await ruleSwitch(page, WALL_OVERLAP.name).click();
          await expect(indicator(page)).toHaveText(RS.offline); // AUT:runAttempt isOnline → 'offline'
          expect.soft(c.sent.slice(mark), 'nothing is sent while offline').toEqual([]);
          await shot(page, '29-B-017', 'offline');
        } finally {
          back = waitRulePut(page, id);
          await c.context.setOffline(false);
        }
        const resumed = await back; // AUT OFFLINE_RECHECK_MS = 5 s
        expect.soft(resumed.response.status()).toBe(200);
        await expect.soft(indicator(page)).toHaveText(RS.savedAt);
      });
    });
  });

  test('SCR-29 · FL-29-03 · mức độ và ngưỡng một luật', async ({ browser }) => {
    test.setTimeout(180_000);
    await withAdmin(browser, async (c) => {
      const { page } = c;
      const { projectId: id } = await ownProject(c, '29-03-threshold');
      await openSettings(page, id);
      const severity = severityCombo(page, WALL_THICKNESS.name);
      const field = numberField(page, MIN_THICKNESS.label);
      const alert = (text: string): Locator => page.getByRole('alert').filter({ hasText: text });
      let markRefused = 0;

      await test.step('[29-A-013] mức "Gợi ý": PUT severity "suggestion"; toast "Đổi mức của luật …."', async () => {
        await expect(severity).toContainText('Cảnh báo'); // registry.ts:449 default warning
        const pending = waitRulePut(page, id);
        await severity.click();
        await page.getByRole('option', { name: 'Gợi ý', exact: true }).click();
        const sent = putOf(await pending);
        expect(overrideOf(sent, WALL_THICKNESS.code)?.severity).toBe('suggestion');
        await expect(toast(page, `Đổi mức của luật ${WALL_THICKNESS.name}.`).first()).toBeVisible();
        await shot(page, '29-A-013', 'severity_suggestion');
      });

      await test.step('[29-C-014] ⚑ đổi lại "Cảnh báo": chân dính biến mất, PUT không còn severity', async () => {
        const pending = waitRulePut(page, id);
        await severity.click();
        await page.getByRole('option', { name: 'Cảnh báo', exact: true }).click();
        const sent = putOf(await pending);
        // CFG:276-283: the default severity is left behind as `{severity:'warning'}`; correct = no `severity` key at all.
        expect.soft(overrideOf(sent, WALL_THICKNESS.code)?.severity, 'default severity is not an override').toBeUndefined();
        await expect.soft(stickyFooter(page)).toHaveCount(0);
        await shot(page, '29-C-014', 'severity_back');
      });

      await test.step('[29-E-004] chọn mức bằng phím (Enter mở, ↑, Enter) → "Nghiêm trọng"', async () => {
        // useSelect.ts:handleOpen highlights the selected option (Cảnh báo, index 1); Nghiêm trọng is index 0 → ArrowUp (plan said ↓).
        const pending = waitRulePut(page, id);
        await severity.focus();
        await severity.press('Enter');
        await severity.press('ArrowUp');
        await severity.press('Enter');
        const sent = putOf(await pending);
        await expect.soft(severity).toContainText('Nghiêm trọng');
        expect.soft(overrideOf(sent, WALL_THICKNESS.code)?.severity).toBe('critical');
        await shot(page, '29-E-004', 'severity_keyboard');
      });

      await test.step('[29-A-015] "Bề dày tường tối thiểu" = 45: PUT thresholds + toast "Đổi ngưỡng …."', async () => {
        const pending = waitRulePut(page, id);
        await typeNum(field, MIN_THICKNESS.valid);
        const sent = putOf(await pending);
        expect.soft(thresholdOf(sent, WALL_THICKNESS.code, MIN_THICKNESS.key)).toBe(Number(MIN_THICKNESS.valid));
        await expect.soft(toast(page, `Đổi ngưỡng ${MIN_THICKNESS.label}.`).first()).toBeVisible();
        await shot(page, '29-A-015', 'threshold_saved');
      });

      await test.step('[29-C-001] 250: alert "Giá trị không quá 200 mm."; không PUT (kết luận ở [29-A-016])', async () => {
        markRefused = c.sent.length;
        await typeNum(field, '250');
        await expect.soft(alert('Giá trị không quá 200 mm.')).toBeVisible();
        await shot(page, '29-C-001', 'above_max');
      });

      await test.step('[29-B-010] ⚑ trong lúc ô lỗi: không có "Đang tải thêm dữ liệu bộ luật…"', async () => {
        await expect.soft(alert('Giá trị không quá 200 mm.')).toBeVisible();
        await expect.soft(page.getByText(RS.partial, { exact: true })).toHaveCount(0);
        await shot(page, '29-B-010', 'no_loading_text_on_error');
      });

      await test.step('[29-E-005] ô số có tên "Bề dày tường tối thiểu"; lỗi là role=alert', async () => {
        await expect.soft(field).toBeVisible();
        await expect.soft(alert('Giá trị không quá 200 mm.')).toBeVisible();
        await shot(page, '29-E-005', 'field_name_alert');
      });

      await test.step('[29-C-002] 10: alert "Giá trị không nhỏ hơn 30 mm."; không PUT', async () => {
        await typeNum(field, '10');
        await expect.soft(alert('Giá trị không nhỏ hơn 30 mm.')).toBeVisible();
        await shot(page, '29-C-002', 'below_min');
      });

      await test.step('[29-C-003] Esc: ô về giá trị đã cam kết (45); alert biến mất', async () => {
        await field.focus();
        await page.keyboard.press('Escape'); // NF:144-148
        await expect.soft(field).toHaveValue(MIN_THICKNESS.valid);
        await expect.soft(alert('Giá trị không nhỏ hơn 30 mm.')).toHaveCount(0);
        expect.soft(c.sent.slice(markRefused), 'refused values and Esc send nothing').toEqual([]);
        await shot(page, '29-C-003', 'escape_restores');
      });

      await test.step('[29-A-016] gõ lại 60 (mặc định): PUT không còn khoá ngưỡng; footer theo override còn lại', async () => {
        const pending = waitRulePut(page, id);
        await typeNum(field, MIN_THICKNESS.dflt);
        const sent = putOf(await pending);
        expect.soft(thresholdOf(sent, WALL_THICKNESS.code, MIN_THICKNESS.key), 'default threshold is pruned').toBeUndefined();
        await expect.soft(stickyFooter(page)).toHaveCount(Object.keys(sent.overrides).length > 0 ? 1 : 0);
        // sure mark for [29-C-001]/[29-C-002]/[29-C-003]: since the refused values this is the only PUT
        expect.soft(c.sent.slice(markRefused).length, 'the only PUT since the refused values is this one').toBe(1);
        await shot(page, '29-A-016', 'default_pruned');
      });

      await test.step('[29-C-008] xoá trắng ô rồi blur: ô hiện lại giá trị cũ; không PUT', async () => {
        const mark = c.sent.length;
        await typeNum(field, '');
        await expect.soft(field).toHaveValue(MIN_THICKNESS.dflt);
        const strays = await strayPuts(c, id, mark);
        expect.soft(strays, 'an emptied field sends nothing').toEqual([]);
        // the debounce merges a stray change into the deliberate PUT, so also look inside it: the emptied field left no threshold behind
        const deliberate = c.sent[c.sent.length - 1];
        expect.soft(deliberate === undefined ? 'no PUT' : thresholdOf(deliberate, WALL_THICKNESS.code, MIN_THICKNESS.key), 'the deliberate PUT carries no threshold').toBeUndefined();
        await shot(page, '29-C-008', 'empty_restored');
      });
    });
  });

  test('SCR-29 · FL-29-04 · đơn vị, phím mũi tên, blur, ngưỡng chung, khoảng khớp BE', async ({ browser }) => {
    test.setTimeout(240_000);
    await withAdmin(browser, async (c) => {
      const { page } = c;
      const { projectId: id } = await ownProject(c, '29-04-units');
      await openSettings(page, id);
      const alert = (text: string): Locator => page.getByRole('alert').filter({ hasText: text });
      const areaSpec = RULE_THRESHOLD_SPECS.find((spec) => spec.key.startsWith('room.minArea.') && spec.defaultValue > 0);
      // S5-confirm: the minimum-area spec with a default > 0 exists; wall.minThicknessMm default is 60 (MIN_THICKNESS.dflt)
      const lengthSpec = RULE_THRESHOLD_SPECS.find((spec) => spec.key === 'wall.minLengthMm');
      const angleSpec = RULE_THRESHOLD_SPECS.find((spec) => spec.key === 'general.parallelAngleDeg');
      if (areaSpec === undefined || lengthSpec === undefined || angleSpec === undefined) throw new Error('setup: threshold spec missing');
      const other = (current: number, a: number, b: number): string => String(current === a ? b : a);
      let markBlur = 0;

      await test.step('[29-C-004] tỉ lệ hiển thị %: 40 bị chặn "…không nhỏ hơn 50 %."; 95 gửi 0,95', async () => {
        const field = numberField(page, 'Phần tường chịu lực phải có điểm tựa ở tầng dưới');
        await typeNum(field, '40');
        await expect(alert('Giá trị không nhỏ hơn 50 %.')).toHaveCount(1);
        const pending = waitRulePut(page, id);
        await typeNum(field, '95');
        const sent = putOf(await pending);
        expect(thresholdOf(sent, 'WALL-UNSUPPORTED', 'wallSupport.minSupportShare')).toBeCloseTo(0.95, 5);
        await shot(page, '29-C-004', 'percent_unit');
      });

      await test.step('[29-C-005] diện tích m²: 61 bị chặn "…không quá 60 m²."; 0 được nhận', async () => {
        const field = numberField(page, areaSpec.label);
        await typeNum(field, '61');
        await expect.soft(alert('Giá trị không quá 60 m².')).toBeVisible();
        const pending = waitRulePut(page, id);
        await typeNum(field, '0');
        const sent = putOf(await pending);
        expect.soft(thresholdOf(sent, areaSpec.ruleCode, areaSpec.key)).toBe(0);
        await expect.soft(alert('Giá trị không quá 60 m².')).toHaveCount(0);
        await shot(page, '29-C-005', 'area_unit');
      });

      await test.step('[29-C-006] ↑ = +1; Shift+↓ = −10 kẹp ≥ 600; sau debounce có PUT', async () => {
        const door = numberField(page, 'Bề rộng cửa đi tối thiểu');
        const v0 = Number(await door.inputValue());
        const afterUp = v0 + 1;
        const afterShiftDown = Math.max(600, afterUp - 10);
        const pending = waitRulePut(page, id, (sent) => thresholdOf(sent, DOOR_WIDTH.code, 'door.minWidthMm') === afterShiftDown);
        await door.focus();
        await door.press('ArrowUp');
        await expect.soft(door).toHaveValue(String(afterUp));
        await door.press('Shift+ArrowDown');
        await expect.soft(door).toHaveValue(String(afterShiftDown));
        await door.press('Tab');
        const sent = putOf(await pending);
        expect.soft(thresholdOf(sent, DOOR_WIDTH.code, 'door.minWidthMm')).toBe(afterShiftDown);
        await shot(page, '29-C-006', 'arrow_keys');
      });

      await test.step('[29-C-007] gõ rồi Tab: PUT sau blur, đúng 1 PUT (kết luận ở bước kế)', async () => {
        const field = numberField(page, lengthSpec.label);
        markBlur = c.sent.length;
        const value = other(lengthSpec.defaultValue, 150, 160);
        const pending = waitRulePut(page, id, (sent) => thresholdOf(sent, lengthSpec.ruleCode, lengthSpec.key) === Number(value));
        await typeNum(field, value);
        const sent = putOf(await pending);
        expect.soft(thresholdOf(sent, lengthSpec.ruleCode, lengthSpec.key)).toBe(Number(value));
        expect.soft(c.sent.slice(markBlur).length, 'one PUT for one typed value').toBe(1);
        await shot(page, '29-C-007', 'blur_commits');
      });

      await test.step('[29-A-017] thẻ "Ngưỡng chung": 12 → PUT overrides.GENERAL.thresholds; toast "Đổi ngưỡng …."', async () => {
        const value = other(angleSpec.defaultValue, 12, 11);
        const pending = waitRulePut(page, id, (sent) => thresholdOf(sent, 'GENERAL', angleSpec.key) === Number(value));
        await typeNum(numberField(page, RS.generalField), value);
        const sent = putOf(await pending);
        expect.soft(thresholdOf(sent, 'GENERAL', angleSpec.key)).toBe(Number(value));
        await expect.soft(toast(page, `Đổi ngưỡng ${RS.generalField}.`).first()).toBeVisible();
        // sure mark for [29-C-007]: blur made exactly one PUT, then this step made the second.
        expect.soft(c.sent.slice(markBlur).length, '[29-C-007] blur + this step = two PUTs').toBe(2);
        await shot(page, '29-A-017', 'general_threshold');
      });

      await test.step('[29-C-009] mọi khoá ở min và ở max qua N22: 26 khoá × 2 đều 200 (khoảng FE ≡ BE)', async () => {
        const failures: string[] = [];
        let revision = await readRevision(c.api, id);
        for (const spec of RULE_THRESHOLD_SPECS) {
          for (const value of [spec.min, spec.max]) {
            const done = await putRuleConfig(c.api, id, revision, { [spec.ruleCode]: { thresholds: { [spec.key]: value } } });
            if (done.status === 200) {
              revision = done.revision;
            } else {
              failures.push(`${spec.key}=${String(value)} → ${String(done.status)}`);
              revision = await readRevision(c.api, id);
            }
          }
        }
        expect.soft(RULE_THRESHOLD_SPECS.length, 'threshold specs').toBe(26);
        expect.soft(failures, 'FE bands accepted by the BE').toEqual([]);
        await shot(page, '29-C-009', 'fe_equals_be');
      });
    });
  });

  test('SCR-29 · FL-29-05 · nhóm luật: tắt/bật, nhóm hỗn hợp, luật bị thay thế, tắt hết', async ({ browser }) => {
    test.setTimeout(240_000);
    await withAdmin(browser, async (c) => {
      const { page } = c;
      const { projectId: id } = await ownProject(c, '29-05-groups');
      await recordUi(page);
      await openSettings(page, id);
      const geometry = groupCard(page, GROUPS[0].label);
      const geometrySwitch = groupSwitch(page, GROUPS[0].label);
      const geometryRules = rulesIn(geometry);
      const lengthSwitch = ruleSwitch(page, WALL_LENGTH.name);
      const total = await geometryRules.count();

      await test.step('[29-A-010] tắt nhóm "Hình học": mọi luật tắt; "N luật, 0 đang bật."; toast "Tắt nhóm hình học."', async () => {
        await geometrySwitch.click();
        await expect(geometrySwitch).toHaveAttribute('aria-checked', 'false');
        await expect(geometry.getByRole('switch', { name: /^Bật hoặc tắt luật: /u, checked: true })).toHaveCount(0);
        await expect.soft(geometry.getByText(`${String(total)} luật, 0 đang bật.`, { exact: true })).toBeVisible();
        await expect.soft(toast(page, 'Tắt nhóm hình học.').first()).toBeVisible();
        await shot(page, '29-A-010', 'group_off');
      });

      await test.step('[29-B-009] ⚑ trong lúc lưu không có "Đang tải thêm dữ liệu bộ luật…"', async () => {
        await expect(indicator(page)).toHaveText(RS.savedAt); // the save of the click above has finished
        const seen = await recorded(page);
        // URS:866 + RSV:194-196 show the line while the save is pending/running; the recorder saw every frame of it.
        expect.soft(seen.partial, `"loading more" line shown while the indicator said: ${seen.partial.join(' | ')}`).toEqual([]);
        await shot(page, '29-B-009', 'no_loading_text_while_saving');
      });

      await test.step('[29-C-012] nhóm hỗn hợp: bật lẻ một luật → switch nhóm bật; bấm → tắt hết', async () => {
        await lengthSwitch.click();
        await expect(lengthSwitch).toHaveAttribute('aria-checked', 'true');
        await expect.soft(geometrySwitch).toHaveAttribute('aria-checked', 'true');
        await geometrySwitch.click();
        await expect.soft(geometry.getByRole('switch', { name: /^Bật hoặc tắt luật: /u, checked: true })).toHaveCount(0);
        await expect.soft(geometrySwitch).toHaveAttribute('aria-checked', 'false');
        await shot(page, '29-C-012', 'mixed_group');
      });

      await test.step('[29-A-011] bật lại nhóm "Hình học": toast "Bật nhóm hình học."; "N luật, N đang bật."', async () => {
        await geometrySwitch.click();
        await expect(geometrySwitch).toHaveAttribute('aria-checked', 'true');
        await expect.soft(toast(page, 'Bật nhóm hình học.').first()).toBeVisible();
        await expect.soft(geometry.getByText(`${String(total)} luật, ${String(total)} đang bật.`, { exact: true })).toBeVisible();
        await shot(page, '29-A-011', 'group_on');
      });

      await test.step('[29-C-015] ⚑ tắt rồi bật "Lưu thông" và "Diện tích": luật bị thay thế vẫn tắt; PUT cuối overrides {}', async () => {
        for (const label of [GROUPS[1].label, GROUPS[2].label]) {
          const sw = groupSwitch(page, label);
          await sw.click();
          await expect(sw).toHaveAttribute('aria-checked', 'false');
          await sw.click();
          await expect(sw).toHaveAttribute('aria-checked', 'true');
        }
        await settled(page);
        // CFG:456-478 setGroupEnabled switches every rule of the group on, the superseded ones included.
        await expect.soft(ruleSwitch(page, ROOM_HAS_DOOR.name)).toHaveAttribute('aria-checked', 'false');
        await expect.soft(ruleSwitch(page, ROOM_MIN_AREA.name)).toHaveAttribute('aria-checked', 'false');
        // [29-C-013] owns "overrides is {}"; here only the superseded rules matter: none may be switched on by the group toggle
        const last = c.sent[c.sent.length - 1];
        for (const rule of [ROOM_HAS_DOOR, ROOM_MIN_AREA]) {
          expect.soft(last === undefined ? 'no PUT' : overrideOf(last, rule.code)?.enabled, `${rule.code} is not forced on`).not.toBe(true);
        }
        await shot(page, '29-C-015', 'superseded_stay_off');
      });

      await test.step('[29-A-012] tắt mọi nhóm: alert "Mọi luật đều đang tắt…"; "0/25 luật đang bật"', async () => {
        // earlier toasts would join the 5 s group; start empty, then switch all five groups off inside ONE page task so the five toasts
        // always fall in one group whatever the runner's pace (slowMo 0 or 400)
        await page.mouse.move(2, 2);
        await expect(toastRegion(page).getByRole('status')).toHaveCount(0, { timeout: 20_000 });
        // one macrotask yield between clicks: React re-renders after each (a handler still on the old render would overwrite the previous toggle)
        await page.evaluate(async (labels) => {
          for (const label of labels) {
            const sw = document.querySelector<HTMLElement>(`[role="switch"][aria-label="${label}"]`);
            if (sw?.getAttribute('aria-checked') === 'true') sw.click();
            await new Promise((resolve) => setTimeout(resolve, 0)); // fixed-wait-ok: one macrotask so React re-renders between clicks
          }
        }, GROUPS.map((group) => groupSwitchName(group.label)));
        for (const group of GROUPS) await expect(groupSwitch(page, group.label), group.label).toHaveAttribute('aria-checked', 'false');
        await expect.soft(page.getByText(RS.disableAll, { exact: true })).toBeVisible();
        await expect.soft(page.getByText(RS.enabledCount)).toHaveText(`0/${String(TOTAL_RULES)} luật đang bật`);
        await shot(page, '29-A-012', 'all_off');
      });

      await test.step('[29-A-030] ⚑ toast sau nhiều thay đổi không lặp ý ("Tắt nhóm cao độ tầng." + "Hoàn tác N thay đổi")', async () => {
        // hard: without a toast the check below could only pass vacuously
        const merged = toast(page, 'Tắt nhóm cao độ tầng.');
        await expect(merged.first()).toBeVisible();
        const text = (await toastRegion(page).innerText()).replace(/\s+/gu, ' ');
        // BUG-462: one sentence for N changes, not the last sentence beside a count of the rest.
        expect.soft(/Tắt nhóm cao độ tầng\./u.test(text) && /Hoàn tác \d+ thay đổi/u.test(text), `toast region: ${text}`).toBe(false);
        await shot(page, '29-A-030', 'toast_summary');
      });
    });
  });

  test('SCR-29 · FL-29-06 · bộ luật sẵn, nhãn hậu quả, hoàn tác khôi phục', async ({ browser }) => {
    test.setTimeout(180_000);
    await withAdmin(browser, async (c) => {
      const { page } = c;
      const { projectId: id } = await ownProject(c, '29-06-presets');
      await openSettings(page, id);
      const presets = page.getByRole('region', { name: RS.presets, exact: true });
      const presetButton = (label: string): Locator => presets.getByRole('button').filter({ has: page.getByText(label, { exact: true }) });
      const restore = page.getByRole('button', { name: RS.restoreDefaults, exact: true });

      await test.step('[29-A-021] nhãn nút: 0 / 3 / 8 luật sẽ đổi ở cấu hình mặc định', async () => {
        await expect(presetButton('Nhà ở')).toContainText('0 luật sẽ đổi');
        await expect(presetButton('Văn phòng')).toContainText('3 luật sẽ đổi');
        await expect(presetButton('Nhà xưởng')).toContainText('8 luật sẽ đổi');
        await shot(page, '29-A-021', 'preset_labels');
      });

      await test.step('[29-C-016] ⚑ áp "Nhà ở" khi đang là mặc định: không PUT, hoặc toast không hứa "0 luật đã đổi"', async () => {
        const mark = c.sent.length;
        await presetButton('Nhà ở').click();
        await frames(page);
        await settled(page);
        const text = (await toastRegion(page).innerText()).replace(/\s+/gu, ' ');
        // URS:1054-1076 writes anyway (PRE diffPreset says 0); correct = nothing written, or no promise of "0 luật đã đổi".
        expect.soft(c.sent.slice(mark).length === 0 || !/0 luật đã đổi/u.test(text), `sent ${String(c.sent.length - mark)} PUT(s); toasts: ${text}`).toBe(true);
        await shot(page, '29-C-016', 'zero_change_preset');
      });

      await test.step('[29-A-019] áp "Nhà xưởng": PUT 200; toast "…: 8 luật đã đổi."; "Cửa đi đủ rộng…" thành "Nghiêm trọng"', async () => {
        const pending = waitRulePut(page, id);
        await presetButton('Nhà xưởng').click();
        expect((await pending).response.status()).toBe(200);
        await expect.soft(toast(page, 'Áp bộ luật nhà xưởng: 8 luật đã đổi.').first()).toBeVisible();
        await expect.soft(severityCombo(page, DOOR_WIDTH.name)).toContainText('Nghiêm trọng');
        await shot(page, '29-A-019', 'industrial');
      });

      await test.step('[29-C-017] ⚑ đã sửa ngưỡng chung rồi áp "Văn phòng": ngưỡng chung được giữ (hoặc được tính vào "luật sẽ đổi")', async () => {
        const general = numberField(page, RS.generalField);
        const saved = waitRulePut(page, id);
        await typeNum(general, '12');
        await saved;
        const count = async (): Promise<number> => Number(/(\d+) luật sẽ đổi/u.exec(await presetButton('Văn phòng').innerText())?.[1] ?? 'NaN');
        await expect(presetButton('Văn phòng')).toContainText('luật sẽ đổi');
        const labelBefore = await count();
        await presetButton('Văn phòng').click();
        await settled(page);
        // PRE:201-250 diffPreset walks rules only and the preset replaces the whole config, so the 12 is silently lost.
        // Either fix is right: the value survives, or the "N luật sẽ đổi" label counted it (more than the 3 rule changes of the preset).
        const kept = (await general.inputValue()) === '12';
        expect.soft(kept || labelBefore > 3, `the shared tolerance ${kept ? 'survived' : 'was lost'}; the label said ${String(labelBefore)}`).toBe(true);
        await shot(page, '29-C-017', 'general_kept');
      });

      await test.step('[29-A-020] áp "Nhà ở" khi đang khác mặc định: PUT overrides {}; toast "Áp bộ luật nhà ở: N luật đã đổi."', async () => {
        const pending = waitRulePut(page, id);
        await presetButton('Nhà ở').click();
        const sent = putOf(await pending);
        expect.soft(sent.overrides).toEqual({});
        await expect.soft(toast(page, /Áp bộ luật nhà ở: [1-9]\d* luật đã đổi\./u).first()).toBeVisible();
        await shot(page, '29-A-020', 'residential');
      });

      await test.step('[29-A-023] "Khôi phục mặc định" rồi "Hoàn tác": cấu hình trước khôi phục quay lại; PUT thứ hai', async () => {
        const applied = waitRulePut(page, id);
        await presetButton('Nhà xưởng').click();
        await applied;
        // "Nhà xưởng" and the restore toasts are the same kind: within 5 s one "Hoàn tác" would undo both → start the restore as its own group
        await page.mouse.move(2, 2);
        await expect(toastRegion(page).getByRole('status')).toHaveCount(0, { timeout: 20_000 });
        const resetPut = waitRulePut(page, id);
        await restore.click();
        expect(putOf(await resetPut).overrides).toEqual({});
        const resetToast = toast(page, 'Đã trả bộ luật về mặc định.').first();
        await expect(resetToast).toBeVisible();
        const backPut = waitRulePut(page, id);
        await resetToast.getByRole('button', { name: RS.undo, exact: true }).click();
        const back = putOf(await backPut);
        expect.soft(overrideOf(back, DOOR_WIDTH.code)?.severity).toBe('critical');
        await expect.soft(severityCombo(page, DOOR_WIDTH.name)).toContainText('Nghiêm trọng');
        await shot(page, '29-A-023', 'restore_undone');
      });
    });
  });

  test('SCR-29 · FL-29-07 · xung đột phiên bản: 409, hộp thoại tải lại, bỏ sửa dở', async ({ browser }) => {
    test.setTimeout(180_000);
    await withAdmin(browser, async (c) => {
      const { page } = c;
      const { projectId: id } = await ownProject(c, '29-07-conflict');
      await openSettings(page, id); // store revision 0
      const thickness = ruleSwitch(page, WALL_THICKNESS.name);
      const reloadButton = page.getByRole('button', { name: RS.reload, exact: true });
      const dialog = dialogReload(page);
      let conflict!: ApiResult;

      await test.step('[29-B-015] người khác ghi (WALL-LENGTH tắt, rev 1); mình tắt "Bề dày tường…": alert 409 + chỉ báo "Chưa lưu — tải lại…"', async () => {
        await writeElsewhere(c.api, id, { [WALL_LENGTH.code]: { enabled: false } });
        const rejected = waitRulePut(page, id, undefined, [409]);
        await thickness.click();
        conflict = await rejected;
        await expect(page.getByText(RS.conflict, { exact: true })).toBeVisible();
        await expect.soft(indicator(page)).toHaveText(RS.conflictCaption);
        await expect.soft(heading(page)).toBeVisible(); // the screen did not swap to an error state
        await shot(page, '29-B-015', 'conflict_alert');
      });

      await test.step('[29-G-004] trả lời PUT: 409 code VERSION_CONFLICT, remoteChanges []', async () => {
        const body = asRecord(conflict.json, '409');
        expect.soft(body.code).toBe('VERSION_CONFLICT');
        expect.soft(body.remoteChanges).toEqual([]);
        await shot(page, '29-G-004', 'conflict_body');
      });

      await test.step('[29-C-020] ⚑ sửa lần hai sau xung đột: không PUT lại bản cũ (đến khi "Tải lại"); chỉ báo không hứa thử lại', async () => {
        const mark = c.sent.length;
        await ruleSwitch(page, ROOM_UNNAMED.name).click();
        await page.waitForTimeout(2_500); // fixed-wait-ok: negative check (no PUT) needs a window past the autosave debounce
        await settled(page);
        const label = await indicator(page).innerText();
        // useRuleSettings.ts conflictRef: after a 409 nothing is sent until "Tải lại"; the caption is CONFLICT_CAPTION.
        expect.soft(c.sent.length, 'no PUT after the 409 until reload').toBe(mark);
        expect.soft(label, 'indicator after the second edit').toBe(RS.conflictCaption);
        expect.soft(label).not.toContain('thử lưu lại');
        await expect.soft(reloadButton).toBeVisible();
        await shot(page, '29-C-020', 'second_edit_after_409');
      });

      await test.step('[29-B-016] "Tải lại" với sửa dở: dialog "Tải lại bộ luật?" + thân + "Để sau" / "Bỏ thay đổi và tải lại"', async () => {
        await reloadButton.click();
        await expect(dialog).toBeVisible();
        await expect.soft(dialog.getByText(RS.reloadBody, { exact: true })).toBeVisible();
        await expect.soft(dialog.getByRole('button', { name: RS.reloadLater, exact: true })).toBeVisible();
        await expect.soft(dialog.getByRole('button', { name: RS.reloadConfirm, exact: true })).toBeVisible();
        await shot(page, '29-B-016', 'reload_dialog');
      });

      await test.step('[29-E-006] a11y hộp thoại: role=dialog aria-modal; focus vào trong; Tab giữ trong hộp', async () => {
        await expect.soft(dialog).toHaveAttribute('aria-modal', 'true');
        const inside = (): Promise<boolean> => dialog.evaluate((el) => el.contains(document.activeElement));
        expect.soft(await inside(), 'focus starts inside the dialog').toBe(true);
        for (let i = 0; i < 4; i += 1) {
          await page.keyboard.press('Tab');
          expect.soft(await inside(), `Tab ${String(i + 1)} stays in the dialog`).toBe(true);
        }
        await shot(page, '29-E-006', 'dialog_a11y');
      });

      await test.step('[29-C-024] Esc đóng hộp thoại; alert 409 còn', async () => {
        await page.keyboard.press('Escape');
        await expect.soft(dialog).toHaveCount(0);
        await expect.soft(page.getByText(RS.conflict, { exact: true })).toBeVisible();
        await shot(page, '29-C-024', 'escape_closes');
      });

      await test.step('[29-C-021] mở lại + "Để sau": hộp thoại đóng; switch vẫn ở giá trị mình đặt', async () => {
        await reloadButton.click();
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', { name: RS.reloadLater, exact: true }).click();
        await expect.soft(dialog).toHaveCount(0);
        await expect.soft(thickness).toHaveAttribute('aria-checked', 'false');
        await shot(page, '29-C-021', 'later_keeps_edit');
      });

      await test.step('[29-C-022] sửa mới rồi "Bỏ thay đổi và tải lại": GET 200; WALL-LENGTH tắt, mọi luật mình sửa về bật; alert mất', async () => {
        // F2 29-C-020: after a 409 nothing is sent until the reload, so this fresh edit sends no PUT (no 409 to wait for)
        await ruleSwitch(page, WALL_OVERLAP.name).click(); // a fresh edit → a fresh undo toast, so [29-C-023] is not vacuous
        await expect(toast(page, `Tắt luật ${WALL_OVERLAP.name}.`).first()).toBeVisible();
        await reloadButton.click();
        await expect(dialog).toBeVisible();
        const reread = waitForApi(page, 'GET', ruleConfigRe(id), [200]);
        await dialog.getByRole('button', { name: RS.reloadConfirm, exact: true }).click();
        await reread;
        await expect.soft(ruleSwitch(page, WALL_LENGTH.name)).toHaveAttribute('aria-checked', 'false');
        await expect.soft(thickness).toHaveAttribute('aria-checked', 'true');
        await expect.soft(ruleSwitch(page, WALL_OVERLAP.name)).toHaveAttribute('aria-checked', 'true');
        await expect.soft(page.getByText(RS.conflict, { exact: true })).toHaveCount(0);
        await shot(page, '29-C-022', 'discard_and_reload');
      });

      await test.step('[29-C-023] toast hoàn tác của thay đổi đã bỏ (BUG-463) không còn', async () => {
        await expect.soft(toast(page, `Tắt luật ${WALL_OVERLAP.name}.`)).toHaveCount(0);
        await expect.soft(toast(page, `Tắt luật ${WALL_THICKNESS.name}.`)).toHaveCount(0);
        await shot(page, '29-C-023', 'discarded_toast_gone');
      });
    });
  });

  test('SCR-29 · FL-29-08 · rời màn khi đang chờ lưu, ghi từ nơi khác, đổi dự án', async ({ browser }) => {
    test.setTimeout(180_000);
    await withAdmin(browser, async (c) => {
      const { page } = c;
      const a = await ownProject(c, '29-08-a');
      const b = await ownProject(c, '29-08-b');
      const sw = ruleSwitch(page, WALL_THICKNESS.name);

      await test.step('[29-A-027] từ /rules vào cài đặt, tắt một luật, goBack ngay: PUT 200 vẫn xong; mở lại luật tắt', async () => {
        await openRules(page, a.projectId);
        await page.getByRole('link', { name: 'Cài đặt bộ luật', exact: true }).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.ruleSettings(a.projectId));
        await expect(sw).toBeEnabled();
        const pending = waitRulePut(page, a.projectId);
        await sw.click();
        await page.goBack(); // URS:592-619 unmount while pending → flush
        expect((await pending).response.status()).toBe(200);
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.rules(a.projectId));
        await openSettings(page, a.projectId);
        await expect(sw).toHaveAttribute('aria-checked', 'false');
        await shot(page, '29-A-027', 'flush_on_back');
      });

      await test.step('[29-C-025] bên khác tắt WALL-LENGTH rồi tải lại màn: bản máy chủ', async () => {
        await writeElsewhere(c.api, a.projectId, { [WALL_LENGTH.code]: { enabled: false } });
        await openSettings(page, a.projectId);
        await expect.soft(ruleSwitch(page, WALL_LENGTH.name)).toHaveAttribute('aria-checked', 'false');
        await shot(page, '29-C-025', 'server_state');
      });

      await test.step('[29-A-029] sang dự án B (WALL-OVERLAP tắt): không nháy cấu hình A; "Chưa có thay đổi"', async () => {
        await writeElsewhere(c.api, b.projectId, { [WALL_OVERLAP.code]: { enabled: false } });
        await page.evaluate(([name, bId]) => {
          const w = window as unknown as { __qaFlash: string[] };
          w.__qaFlash = [];
          new MutationObserver(() => {
            if (!location.pathname.includes(bId ?? '')) return; // only what is drawn once the route is B's counts
            const el = document.querySelector(`[role="switch"][aria-label="${name}"]`);
            if (el?.getAttribute('aria-checked') === 'false') w.__qaFlash.push(name ?? '');
          }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-checked'] });
        }, [ruleSwitchName(WALL_LENGTH.name), b.projectId] as const);
        const reread = waitForApi(page, 'GET', ruleConfigRe(b.projectId), [200]);
        await spaNavigate(page, ROUTES.project.ruleSettings(b.projectId)); // in-app, no reload: the store still holds A's config
        await reread;
        await expect(ruleSwitch(page, WALL_OVERLAP.name)).toHaveAttribute('aria-checked', 'false');
        await expect.soft(ruleSwitch(page, WALL_LENGTH.name)).toHaveAttribute('aria-checked', 'true');
        const flash = await page.evaluate(() => (window as unknown as { __qaFlash: string[] }).__qaFlash);
        expect.soft(flash, 'A\'s "WALL-LENGTH off" was never drawn under B').toEqual([]);
        await expect.soft(indicator(page)).toHaveText(RS.idle);
        await shot(page, '29-A-029', 'other_project');
      });
    });
  });

  test('SCR-29 · FL-29-09 · truy cập: dự án không tồn tại, không thành viên', async ({ browser }) => {
    test.setTimeout(180_000);
    await withAdmin(browser, async (c) => {
      const { page } = c;
      const noid = NOID();
      const { projectId: id } = await ownProject(c, '29-09-access');

      await test.step('[29-B-019] mở dự án không tồn tại: "Không tìm thấy dự án này" + mô tả + biểu tượng', async () => {
        await page.goto(ROUTES.project.ruleSettings(noid));
        await expect(page.getByText(RS.notFoundTitle, { exact: true })).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText(RS.notFoundBody, { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: RS.backToProjects, exact: true })).toBeVisible();
        await expect(page.getByRole('alert').locator('svg').first(), 'the icon is drawn (BUG-461)').toBeVisible();
        await shot(page, '29-B-019', 'unknown_project');
      });

      await test.step('[29-G-015] GET dự án 404: màn không ở trạng thái lỗi "Không tải được cài đặt bộ luật"', async () => {
        expect.soft(c.log.some((entry) => entry.status === 404 && entry.path.includes(noid)), 'the project read answered 404').toBe(true);
        await expect.soft(page.getByText(RS.loadErrorTitle, { exact: true })).toHaveCount(0);
        await shot(page, '29-G-015', 'not_error_state');
      });

      await test.step('[29-B-020] nút "Về danh sách dự án": tới dashboard, h1 "Dự án của tôi"', async () => {
        await page.getByRole('button', { name: RS.backToProjects, exact: true }).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
        await expect.soft(page.getByRole('heading', { level: 1, name: RS.dashboardTitle, exact: true })).toBeVisible();
        await shot(page, '29-B-020', 'back_to_dashboard');
      });

      await test.step('[29-D-007] kỹ sư không thành viên mở route của B1: "Không tìm thấy dự án này"; không lộ cấu hình', async () => {
        const stranger = await poolUser(c.api, 'engineer', 'p06-settings3');
        const s = await openSession(browser, stranger);
        try {
          await s.page.goto(ROUTES.project.ruleSettings(id));
          await expect(s.page.getByText(RS.notFoundTitle, { exact: true })).toBeVisible({ timeout: 30_000 });
          await expect.soft(s.page.getByRole('switch')).toHaveCount(0);
          expect.soft(s.log.filter((entry) => ruleConfigRe(id).test(entry.path) && entry.status === 200), 'N21 never answered 200').toEqual([]);
          await shot(s.page, '29-D-007', 'non_member');
        } finally {
          await closeSession(s);
        }
      });
    });
  });

  test('SCR-29 · FL-29-10 · chỉ đọc: kỹ sư và người xem', async ({ browser }) => {
    test.setTimeout(180_000);
    await withApi(browser, async (c) => {
      const { projectId: id } = await ownProject(c, '29-10-readonly');
      // S5-confirm: pool slots p06-settings1 (engineer, this flow) / 2 (viewer) / 3 (non-member, FL-29-09); FL-29-U3 uses p06-settings4
      const engineer = await poolUser(c.api, 'engineer', 'p06-settings1');
      const viewer = await poolUser(c.api, 'viewer', 'p06-settings2');
      await addProjectMember(c.api, id, engineer.email);
      await addProjectMember(c.api, id, viewer.email);
      await writeElsewhere(c.api, id, { [WALL_LENGTH.code]: { enabled: false } }); // "+X": WALL-LENGTH off before anybody opens the screen
      const eng = await openSession(browser, engineer);
      let view: Session | undefined;
      const lengthSwitch = ruleSwitch(eng.page, WALL_LENGTH.name);
      const thickness = ruleSwitch(eng.page, WALL_THICKNESS.name);
      try {
        await test.step('[29-D-002] kỹ sư mở route: alert chỉ-đọc; mức hiện là chữ "Cảnh báo" (không combobox)', async () => {
          await openSettings(eng.page, id);
          await expect(eng.page.getByText(RS.readOnly, { exact: true })).toBeVisible();
          await expect(eng.page.getByRole('combobox')).toHaveCount(0);
          await expect(eng.page.getByText('Cảnh báo', { exact: true }).first()).toBeVisible();
          await shot(eng.page, '29-D-002', 'engineer_read_only');
        });

        await test.step('[29-D-005] thấy cấu hình của admin: "Tường đủ dài để dựng" hiện tắt; GET 200', async () => {
          await expect.soft(lengthSwitch).toHaveAttribute('aria-checked', 'false');
          expect.soft(eng.log.some((entry) => entry.method === 'GET' && ruleConfigRe(id).test(entry.path) && entry.status === 200)).toBe(true);
          await shot(eng.page, '29-D-005', 'sees_admin_config');
        });

        await test.step('[29-D-004] không bộ luật sẵn, không "Khôi phục mặc định"', async () => {
          await expect.soft(eng.page.getByRole('region', { name: RS.presets, exact: true })).toHaveCount(0);
          await expect.soft(eng.page.getByRole('button', { name: RS.restoreDefaults, exact: true })).toHaveCount(0);
          await shot(eng.page, '29-D-004', 'no_presets_no_footer');
        });

        await test.step('[29-D-006] bấm switch: không PUT', async () => {
          const mark = eng.sent.length;
          await thickness.click({ force: true }); // a disabled button takes no click
          await frames(eng.page);
          expect.soft(eng.sent.slice(mark), 'read-only click sends nothing').toEqual([]);
          await expect.soft(thickness).toHaveAttribute('aria-checked', 'true');
          await shot(eng.page, '29-D-006', 'click_no_put');
        });

        await test.step('[29-E-011] switch chỉ đọc: thuộc tính disabled (không chỉ mờ)', async () => {
          expect.soft(await thickness.evaluate((el) => (el as HTMLButtonElement).disabled), 'disabled attribute').toBe(true);
          await expect.soft(thickness).toBeDisabled();
          await shot(eng.page, '29-E-011', 'switch_disabled');
        });

        await test.step('[29-D-003] người xem (context thứ hai): cùng alert; switch/ô số disabled / readOnly', async () => {
          view = await openSession(browser, viewer);
          await openSettings(view.page, id);
          await expect.soft(view.page.getByText(RS.readOnly, { exact: true })).toBeVisible();
          await expect.soft(view.page.getByRole('switch', { disabled: false })).toHaveCount(0);
          // Input.tsx:73-78 — isReadOnly draws the value as plain text: no <input> at all, so no textbox may exist while the labels and values still show.
          await expect.soft(groupCard(view.page, RS.generalNav), 'the number values still show').toContainText(RS.generalField);
          await expect.soft(view.page.getByRole('textbox'), 'no editable number field').toHaveCount(0);
          await expect.soft(view.page.locator('input:not([readonly]):not([disabled])'), 'no editable <input>').toHaveCount(0);
          await shot(view.page, '29-D-003', 'viewer_read_only');
        });
      } finally {
        await closeSession(eng);
        if (view !== undefined) await closeSession(view);
      }
    });
  });

  test('SCR-29 · FL-29-11 · bàn phím, trình đọc, so thuật ngữ với báo cáo', async ({ browser }) => {
    test.setTimeout(180_000);
    await withAdmin(browser, async (c: Ctx) => {
      const { page } = c;
      const { projectId: id } = await ownProject(c, '29-11-keyboard');
      await recordUi(page);
      await openSettings(page, id);
      const unnamed = ruleSwitch(page, ROOM_UNNAMED.name);

      await test.step('[29-E-002] Tab từ đầu trang: bộ luật sẵn ×3, nav ×6, switch nhóm, switch luật, combobox; vết focus', async () => {
        await heading(page).click(); // Chrome starts sequential focus navigation at the click point
        const stops: { cat: string; ring: boolean; pos: number }[] = [];
        for (let i = 0; i < 12; i += 1) {
          await page.keyboard.press('Tab');
          stops.push(
            await page.evaluate(() => {
              const el = document.activeElement as HTMLElement | null;
              if (el === null) return { cat: 'none', ring: false, pos: -1 };
              const label = el.getAttribute('aria-label') ?? '';
              let cat = 'other';
              if (el.tagName === 'BUTTON' && el.closest('section[aria-label="Bộ luật sẵn"]') !== null) cat = 'preset';
              else if (el.tagName === 'A' && el.closest('nav[aria-label="Mục cài đặt bộ luật"]') !== null) cat = 'nav';
              else if (el.getAttribute('role') === 'switch') cat = label.startsWith('Bật hoặc tắt cả nhóm') ? 'groupSwitch' : 'ruleSwitch';
              else if (el.getAttribute('role') === 'combobox') cat = 'combobox';
              else if (el.tagName === 'INPUT') cat = 'textbox';
              const style = getComputedStyle(el);
              const ring = style.boxShadow !== 'none' || (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0);
              return { cat, ring, pos: Array.from(document.querySelectorAll('*')).indexOf(el) };
            }),
          );
        }
        // DOM order (RSV:206-222): the preset row sits ABOVE the nav column, so presets come first (plan listed nav first).
        const expected = [...Array<string>(3).fill('preset'), ...Array<string>(6).fill('nav'), 'groupSwitch', 'ruleSwitch', 'combobox'];
        expect(stops.map((stop) => stop.cat), 'tab order').toEqual(expected);
        expect.soft(stops.every((stop, index) => index === 0 || stop.pos > (stops[index - 1]?.pos ?? -1)), 'tab order follows the DOM order').toBe(true);
        expect.soft(stops.filter((stop) => stop.cat === 'preset' || stop.cat === 'nav').every((stop) => stop.ring), 'visible focus ring on presets and nav').toBe(true);
        await shot(page, '29-E-002', 'tab_order');
      });

      await test.step('[29-E-003] Space trên switch luật: aria-checked đổi; PUT 200', async () => {
        const pending = waitRulePut(page, id);
        await unnamed.focus();
        await page.keyboard.press('Space');
        expect((await pending).response.status()).toBe(200);
        await expect.soft(unnamed).toHaveAttribute('aria-checked', 'false');
        await shot(page, '29-E-003', 'space_toggles');
      });

      await test.step('[29-E-007] vùng live: "Đang lưu…" rồi "Đã lưu lúc HH:MM" được xướng', async () => {
        const live = indicator(page);
        await expect.soft(live).toHaveAttribute('aria-live', 'polite'); // SaveIndicator.tsx role=status aria-live=polite
        const seen = await recorded(page);
        expect.soft(inOrder(seen.indicator, [RS.saving, RS.savedAt]), `live region texts: ${seen.indicator.join(' → ')}`).toBe(true);
        // useSaveIndicator.ts: dirty/saving stay silent in the app announcer; the finished save is announced.
        expect.soft(seen.announced.some((text) => RS.savedAt.test(text)), `announcer said: ${seen.announced.join(' | ')}`).toBe(true);
        await shot(page, '29-E-007', 'live_region');
      });

      await test.step('[29-E-008] toast bằng bàn phím: "Hoàn tác" focus được; giữ focus thì toast đứng; Enter hoàn tác', async () => {
        await clearRecorded(page);
        // the E-003 toast and this one are the same kind: within 5 s they would be one group and Enter would undo both
        await page.mouse.move(2, 2);
        await expect(toastRegion(page).getByRole('status')).toHaveCount(0, { timeout: 20_000 });
        await unnamed.click(); // on again → fresh toast "Bật luật …."
        const t = toast(page, `Bật luật ${ROOM_UNNAMED.name}.`).first();
        await expect(t).toBeVisible();
        const undo = t.getByRole('button', { name: RS.undo, exact: true });
        await undo.focus();
        await expect.soft(undo).toBeFocused();
        const bar = t.locator('div.bg-accent').first(); // Toast.tsx countdown bar: width % of the 8 s window
        const before = await bar.evaluate((el) => (el as HTMLElement).style.width);
        await frames(page, 12);
        const after = await bar.evaluate((el) => (el as HTMLElement).style.width);
        expect.soft(after, 'the countdown holds while the button has focus (Toast.tsx isHeld)').toBe(before);
        await settled(page);
        const pending = waitRulePut(page, id);
        await page.keyboard.press('Enter');
        await pending;
        await expect.soft(unnamed).toHaveAttribute('aria-checked', 'false');
        await shot(page, '29-E-008', 'toast_keyboard');
      });

      await test.step('[29-C-028] ⚑ "Nghiêm trọng" ở cài đặt so với bộ lọc /rules: thống nhất hoặc có chú thích đối ứng', async () => {
        await openRules(page, id);
        // SCR-28 strip label "Nghiêm trọng" (RuleReportSummary.tsx:84, RuleReportLabels.tsx:97); SCR-29 severity label (RuleSettingsRow.tsx:27).
        const word: string = 'Nghiêm trọng';
        await expect.soft(page.getByText(word, { exact: true }).first(), 'SCR-28 names the violating bucket "Nghiêm trọng"').toBeVisible();
        await openSettings(page, id);
        await expect.soft(page.getByRole('main').getByText(word, { exact: true }).first(), 'SCR-29 uses the same word').toBeVisible();
        await shot(page, '29-C-028', 'severity_wording');
      });

      await test.step('[29-E-009] khổ 768, chọn "Ngưỡng chung" trong Select "Mục cài đặt": thẻ nhận focus, trong khung nhìn', async () => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await openSettings(page, id);
        const select = page.getByRole('combobox', { name: RS.collapsedSelect, exact: true });
        await expect(select).toBeVisible();
        await select.click();
        await page.getByRole('option', { name: RS.generalNav, exact: true }).click();
        const card = groupCard(page, RS.generalNav);
        await expect.soft(card).toBeFocused(); // RSG tabIndex={-1} + RSV:98-107 goToSection
        await expect.soft(card).toBeInViewport();
        await shot(page, '29-E-009', 'collapsed_jump');
      });
    });
  });
});
