/**
 * Phase 6 — SCR-29 Rule Settings, EDGE layer, MOCKED RESPONSES (QA-06b P3, `flows-C2.md`
 * "phase06_rulesettings_mocked_edge.spec.ts"): 3 flows, 18 steps. Every flow title carries `[mocked response]` and names its real
 * pair in `phase06_rulesettings_edge.spec.ts` (the pairing table is read by `tools/mock-pairs.mjs`).
 *
 * What is real: the admin session, the project, its floor, N21 until a step replaces it, every other endpoint.
 * What is answered by `route.fulfill` / `route.abort` (only the rule-config call, only the status named in the step):
 *  - FL-29-M1 GET rule-config: held behind a promise (loading), 500, 403 — a 5xx/403 on N21 cannot be produced on the shared stack
 *    (every member reads N21, a non-member gets 404 before it).
 *  - FL-29-M2 PUT rule-config: 403 FORBIDDEN and five 422 codes — the screen refuses out-of-range values before sending and a demoted
 *    role has no entry point mid-session, so the server's refusals cannot be reached.
 *  - FL-29-M3 PUT rule-config: 500 with no code, an aborted connection, four 503s then the real server — 5xx and a cut mid-flight
 *    cannot be produced on the real stack.
 * The error envelope is the BE's `{ code, message, requestId[, field] }` (support/p03/P9.ts wireError).
 *
 * ## Waiting
 * The held GET is released by a promise, never a timer. Autosave steps wait for the real (mocked) request; the 503 retry waits for the
 * real 5 s schedule (AUT retrySchedule) — no `page.clock`, no fixed wait.
 *
 * ## Request budget per full run
 * - `POST /api/auth/login` 6 (page session + admin API per flow); `POST /api/projects` 3, `DELETE` 3.
 * - FL-29-M1: 1 held GET + 2–4 mocked GETs per width pass; FL-29-M3: ≤ 12 aborted/failed PUT attempts (HTTP ladder 1 + 3 retries each)
 *   and 3 real PUTs. No upload, no pipeline, no pool user.
 */
import { expect, test, type Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { RETRY_DELAYS_MS } from '../../src/lib/http/retry';
import { verifyUi } from './support/ui-verify';
import {
  DESKTOP,
  DOOR_WIDTH,
  GROUPS,
  RS,
  ROOM_HAS_DOOR,
  ROOM_UNNAMED,
  WALL_LENGTH,
  WALL_OVERLAP,
  WALL_THICKNESS,
  LEVEL_ELEVATION,
  allRuleSwitches,
  asRecord,
  frames,
  groupCard,
  heading,
  indicator,
  openSettings,
  ownProject,
  putOf,
  revisionOf,
  ruleConfigRe,
  ruleSwitch,
  shot,
  waitRulePut,
  withAdmin,
} from './support/p06/ruleSettings';

/** The BE error envelope the FE reads with `readWireError` (support/p03/P9.ts wireError, plus an optional `field`). */
const wire = (status: number, code: string, field?: string): { status: number; body: Record<string, unknown> } => ({
  status,
  body: { code, message: `qa-06b mocked ${code}`, requestId: `qa-${code.toLowerCase()}`, ...(field === undefined ? {} : { field }) },
});
const json = (route: Route, answer: { status: number; body: unknown }): Promise<void> =>
  route.fulfill({ status: answer.status, contentType: 'application/json', body: JSON.stringify(answer.body) });
const ruleConfigGlob = (projectId: string): string => `**/api/projects/${projectId}/rule-config`;

test.describe('SCR-29 Rule Settings · edge (mocked responses)', () => {
  test('SCR-29 · FL-29-M1 · [mocked response] tải: loading, 500, Thử lại, 403 — cặp thật: FL-29-01 (29-G-001, 29-B-002)', async ({ browser }) => {
    test.setTimeout(240_000);
    await withAdmin(browser, async (c) => {
      const { page } = c;
      const { projectId: id } = await ownProject(c, '29-m1-load');
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let mode: 'gate' | 'e500' | 'e403' | 'real' = 'gate';
      await page.route(ruleConfigGlob(id), async (route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        if (mode === 'gate') {
          await gate; // the real answer, only later
          return route.fallback();
        }
        if (mode === 'e500') return json(route, { status: 500, body: { detail: 'qa-06b mocked 500' } });
        if (mode === 'e403') return json(route, wire(403, 'FORBIDDEN'));
        return route.fallback();
      });
      const retry = page.getByRole('button', { name: RS.retry, exact: true });

      try {
        await test.step('[29-B-001] GET bị giữ sau cổng: Skeleton "property-panel"; không số luật bật, không chỉ báo lưu', async () => {
          await page.goto(ROUTES.project.ruleSettings(id), { waitUntil: 'commit' });
          await expect(heading(page)).toBeVisible();
          const panel = heading(page).locator('xpath=ancestor::div[contains(@class,"max-w-[960px]")][1]');
          // S5-confirm: 9 pulsing blocks. Skeleton.tsx property-panel: one h-6 bar + four rows of two bars.
          await expect(panel.locator('.animate-pulse')).toHaveCount(9);
          await expect.soft(page.getByText(RS.enabledCount)).toHaveCount(0);
          await expect.soft(indicator(page)).toHaveCount(0);
          await expect.soft(allRuleSwitches(page)).toHaveCount(0);
          await shot(page, '29-B-001', 'loading_skeleton');
          release();
          await expect(ruleSwitch(page, WALL_THICKNESS.name)).toBeVisible();
        });

        await test.step('[29-B-005] GET 500: tiêu đề + mô tả chung + "Thử lại"; không switch, số đếm, chỉ báo lưu', async () => {
          mode = 'e500';
          await page.reload({ waitUntil: 'commit' });
          await expect.soft(page.getByText(RS.loadErrorTitle, { exact: true })).toBeVisible({ timeout: 30_000 }); // react-query retries a failed read once
          await expect.soft(page.getByText(RS.generic, { exact: true })).toBeVisible();
          await expect.soft(retry).toBeVisible();
          await expect.soft(page.getByRole('switch')).toHaveCount(0);
          await expect.soft(page.getByText(RS.enabledCount)).toHaveCount(0);
          await expect.soft(page.getByText(RS.idle, { exact: true })).toHaveCount(0);
          await shot(page, '29-B-005', 'load_500');
        });

        await test.step('[29-F-011] ảnh 4 khổ trạng thái lỗi tải (verifyUi)', async () => {
          const metrics = await verifyUi(page, 'U06s_29-F-011_load_error', async (p) => {
            await p.goto(ROUTES.project.ruleSettings(id), { waitUntil: 'commit' });
            await expect(p.getByText(RS.loadErrorTitle, { exact: true })).toBeVisible({ timeout: 30_000 });
            await expect(p.getByRole('button', { name: RS.retry, exact: true })).toBeVisible();
          });
          expect.soft(metrics.length, 'one measurement per viewport').toBe(4);
        });

        await test.step('[29-B-006] bỏ mock rồi "Thử lại": GET lần hai 200; switch hiện; tiêu đề lỗi mất', async () => {
          await page.setViewportSize(DESKTOP);
          mode = 'real';
          const reread = waitForApi(page, 'GET', ruleConfigRe(id), [200]);
          await retry.click();
          expect((await reread).response.status()).toBe(200);
          await expect.soft(ruleSwitch(page, WALL_THICKNESS.name)).toBeVisible();
          await expect.soft(page.getByText(RS.loadErrorTitle, { exact: true })).toHaveCount(0);
          await shot(page, '29-B-006', 'retry_recovers');
        });

        await test.step('[29-B-007] GET 403: "Không có quyền xem cài đặt bộ luật" + mô tả quản trị', async () => {
          mode = 'e403';
          await page.reload({ waitUntil: 'commit' });
          await expect.soft(page.getByText(RS.forbiddenTitle, { exact: true })).toBeVisible({ timeout: 30_000 });
          await expect.soft(page.getByText(RS.forbiddenBody, { exact: true })).toBeVisible();
          await expect.soft(page.getByRole('switch')).toHaveCount(0);
          await shot(page, '29-B-007', 'forbidden');
        });

        await test.step('[29-F-012] ảnh 4 khổ trạng thái forbidden (verifyUi)', async () => {
          const metrics = await verifyUi(page, 'U06s_29-F-012_forbidden', async (p) => {
            await p.goto(ROUTES.project.ruleSettings(id), { waitUntil: 'commit' });
            await expect(p.getByText(RS.forbiddenTitle, { exact: true })).toBeVisible({ timeout: 30_000 });
          });
          expect.soft(metrics.length, 'one measurement per viewport').toBe(4);
        });
      } finally {
        release(); // never leave a request parked behind the gate
      }
    });
  });

  test('SCR-29 · FL-29-M2 · [mocked response] lỗi lưu có mã — cặp thật: FL-29-07 (29-B-015) và FL-29-10 (29-D-002)', async ({ browser }) => {
    test.setTimeout(180_000);
    await withAdmin(browser, async (c) => {
      const { page } = c;
      const { projectId: id } = await ownProject(c, '29-m2-save-errors');
      let answer = wire(403, 'FORBIDDEN');
      let answered = 0;
      await page.route(ruleConfigGlob(id), async (route) => {
        if (route.request().method() !== 'PUT') return route.fallback();
        answered += 1;
        return json(route, answer);
      });
      await openSettings(page, id);
      /** Answers the next save with `next`, edits `rule`, waits for that very request. */
      const fail = async (next: typeof answer, rule: string): Promise<void> => {
        answer = next;
        const pending = waitRulePut(page, id, undefined, [next.status]);
        await ruleSwitch(page, rule).click();
        await pending;
      };
      const message = (text: string) => page.getByRole('alert').filter({ hasText: text });

      await test.step('[29-G-005] PUT 403 FORBIDDEN: "Vai của bạn không còn quyền đổi bộ luật."; chỉ báo "Lưu thất bại…"', async () => {
        await fail(wire(403, 'FORBIDDEN'), ROOM_UNNAMED.name);
        await expect(message('Vai của bạn không còn quyền đổi bộ luật.')).toBeVisible();
        await expect.soft(indicator(page)).toHaveText(RS.failed);
        await shot(page, '29-G-005', 'put_403');
      });

      await test.step('[29-D-008] hạ vai giữa phiên: không PUT thứ hai tự động sau lỗi 403', async () => {
        await expect(indicator(page)).toHaveText(RS.failed);
        await frames(page);
        // AUT:runAttempt — a permanent error (403) goes to 'failed' without scheduling a retry, so nothing more is on its way.
        expect.soft(answered, 'one PUT only').toBe(1);
        await shot(page, '29-D-008', 'no_auto_retry');
      });

      await test.step('[29-G-006] 422 RULE_THRESHOLD_OUT_OF_RANGE (field GENERAL): câu nằm ngay trên thẻ "Ngưỡng chung", không ở đầu trang', async () => {
        const text = 'Một ngưỡng nằm ngoài khoảng máy chủ cho phép nên thay đổi chưa được lưu.';
        await fail(wire(422, 'RULE_THRESHOLD_OUT_OF_RANGE', 'body.overrides.GENERAL.thresholds.general.parallelAngleDeg'), WALL_LENGTH.name);
        const alert = message(text);
        await expect(alert).toBeVisible();
        await expect.soft(alert).toHaveCount(1);
        const [alertBox, generalBox, lastGroupBox] = await Promise.all([
          alert.boundingBox(),
          groupCard(page, RS.generalNav).boundingBox(),
          groupCard(page, GROUPS[GROUPS.length - 1]?.label ?? '').boundingBox(),
        ]);
        expect.soft(alertBox !== null && generalBox !== null && alertBox.y + alertBox.height <= generalBox.y + 2, 'the alert sits right above the "Ngưỡng chung" card').toBe(true);
        expect.soft(alertBox !== null && lastGroupBox !== null && alertBox.y >= lastGroupBox.y + lastGroupBox.height - 2, 'and below the last group card, not at the top of the page').toBe(true);
        await shot(page, '29-G-006', 'put_422_general');
      });

      await test.step('[29-G-007] 422 RULE_CODE_UNKNOWN', async () => {
        await fail(wire(422, 'RULE_CODE_UNKNOWN'), WALL_OVERLAP.name);
        await expect.soft(message('Máy chủ không nhận ra một luật trong bộ luật này nên thay đổi chưa được lưu.')).toBeVisible();
        await shot(page, '29-G-007', 'put_422_rule_code');
      });

      await test.step('[29-G-008] 422 RULE_THRESHOLD_UNKNOWN', async () => {
        await fail(wire(422, 'RULE_THRESHOLD_UNKNOWN'), DOOR_WIDTH.name);
        await expect.soft(message('Máy chủ không nhận ra một ngưỡng trong bộ luật này nên thay đổi chưa được lưu.')).toBeVisible();
        await shot(page, '29-G-008', 'put_422_threshold');
      });

      await test.step('[29-G-009] 422 RULE_GENERAL_NOT_TOGGLEABLE', async () => {
        await fail(wire(422, 'RULE_GENERAL_NOT_TOGGLEABLE'), LEVEL_ELEVATION.name);
        await expect.soft(message('Ngưỡng chung chỉ đổi được con số, không bật, tắt hay đổi mức được.')).toBeVisible();
        await shot(page, '29-G-009', 'put_422_general_toggle');
      });

      await test.step('[29-G-010] 422 VALIDATION', async () => {
        await fail(wire(422, 'VALIDATION'), ROOM_HAS_DOOR.name);
        await expect.soft(message('Máy chủ từ chối bộ luật vì dữ liệu không hợp lệ nên thay đổi chưa được lưu.')).toBeVisible();
        await shot(page, '29-G-010', 'put_422_validation');
      });
    });
  });

  test('SCR-29 · FL-29-M3 · [mocked response] 500 không mã, mất kết nối, 503 tự thử lại, gửi lại thân đã mất — cặp thật: FL-29-02 (29-A-026), FL-29-02 bước 13 (29-B-017)', async ({ browser }) => {
    test.setTimeout(300_000);
    await withAdmin(browser, async (c) => {
      const { page } = c;
      const { projectId: id } = await ownProject(c, '29-m3-transport');
      let mode: 'e500' | 'abort' | 'e503' | 'real' = 'e500';
      let served503 = 0;
      const aborted: string[] = [];
      await page.route(ruleConfigGlob(id), async (route) => {
        const request = route.request();
        if (request.method() !== 'PUT') return route.fallback();
        if (mode === 'e500') return json(route, { status: 500, body: { detail: 'qa-06b mocked 500' } });
        if (mode === 'abort') {
          aborted.push(request.postData() ?? '');
          return route.abort('connectionreset');
        }
        if (mode === 'e503' && served503 < RETRY_DELAYS_MS.length + 1) {
          // HTTP client ladder: 1 try + 3 retries (src/lib/http/retry.ts RETRY_DELAYS_MS); only after all four does the autosave retry.
          served503 += 1;
          return json(route, wire(503, 'DEPENDENCY_UNAVAILABLE'));
        }
        return route.fallback();
      });
      await openSettings(page, id);
      let duringRetry = -1;
      let held: { baseVersion: unknown; body: Record<string, unknown> } = { baseVersion: undefined, body: {} };

      await test.step('[29-G-011] PUT 500 không code: "Chưa lưu được bộ luật của dự án này."', async () => {
        const pending = waitRulePut(page, id, undefined, [500]);
        await ruleSwitch(page, ROOM_UNNAMED.name).click();
        await pending;
        await expect(page.getByRole('alert').filter({ hasText: 'Chưa lưu được bộ luật của dự án này.' })).toBeVisible();
        await shot(page, '29-G-011', 'put_500');
      });

      await test.step('[29-G-012] PUT bị abort: "Mất kết nối nên bộ luật chưa được lưu."', async () => {
        mode = 'abort';
        await ruleSwitch(page, WALL_LENGTH.name).click();
        // the HTTP ladder retries a cut connection three times (≈ 4.5 s) before the error reaches the screen
        await expect(page.getByRole('alert').filter({ hasText: 'Mất kết nối nên bộ luật chưa được lưu.' })).toBeVisible({ timeout: 45_000 });
        expect.soft(aborted.length, 'the cut requests').toBeGreaterThan(0);
        const first = JSON.parse(aborted[0] ?? '{}') as Record<string, unknown>;
        held = { baseVersion: first.baseVersion, body: asRecord(first.body, 'aborted body') };
        await shot(page, '29-G-012', 'put_aborted');
      });

      await test.step('[29-C-026] PUT kế sau lượt mất kết nối: gửi lại ĐÚNG thân cũ, rồi thân mới với baseVersion = revision vừa nhận', async () => {
        mode = 'real';
        const sameAsHeld = (sent: { baseVersion: unknown; body: Record<string, unknown> }): boolean =>
          sent.baseVersion === held.baseVersion && JSON.stringify(sent.body) === JSON.stringify(held.body);
        // After the cut the autosave is parked on a 5 s retry timer (the 500 above was permanent, so the retry attempt restarted at 0;
        // AUT:notifyChange does not re-arm while it waits), so the next send carries this edit too and starts with the held body
        // (RSW:264-280). 30 s is only the cap of the real-request wait.
        const resent = waitRulePut(page, id, sameAsHeld, [200], 30_000);
        const fresh = waitRulePut(page, id, (sent) => !sameAsHeld(sent), [200], 30_000);
        await ruleSwitch(page, WALL_OVERLAP.name).click();
        const [first, second] = [await resent, await fresh];
        expect.soft(putOf(first).baseVersion, 'the lost body is sent again as it was').toBe(held.baseVersion);
        expect.soft(putOf(second).baseVersion, 'then the new body, on the revision just received').toBe(revisionOf(first));
        expect.soft(JSON.stringify(putOf(second).body), 'a different body').not.toBe(JSON.stringify(held.body));
        await expect.soft(indicator(page)).toHaveText(RS.savedAt);
        await shot(page, '29-C-026', 'resend_held_body');
      });

      await test.step('[29-B-018] PUT 503 (cả bậc thang HTTP) rồi 200: chỉ báo "Có thay đổi chờ đồng bộ"; PUT tự đến sau lịch 5 s; "Đã lưu lúc …"', async () => {
        mode = 'e503';
        served503 = 0;
        const ok = waitRulePut(page, id, undefined, [200], 60_000);
        await ruleSwitch(page, DOOR_WIDTH.name).click();
        await expect.poll(() => served503, { timeout: 30_000 }).toBe(RETRY_DELAYS_MS.length + 1);
        await expect(indicator(page)).toHaveText(RS.dirty);
        duringRetry = await page.getByRole('alert').count();
        await shot(page, '29-B-018', 'transient_dirty');
        expect((await ok).response.status()).toBe(200); // the 5 s retry reaches the real server
        await expect.soft(indicator(page)).toHaveText(RS.savedAt);
      });

      await test.step('[29-G-013] cùng lượt 503: không alert lỗi vĩnh viễn trong lúc thử lại', async () => {
        // URS:589 sets the save problem for every error, a transient one included → the screen says "Chưa lưu được bộ luật…" while it retries.
        expect.soft(duringRetry, 'alerts on screen while the autosave was retrying').toBe(0);
        await expect.soft(page.getByRole('alert')).toHaveCount(0);
        await shot(page, '29-G-013', 'no_permanent_alert');
      });
    });
  });
});
