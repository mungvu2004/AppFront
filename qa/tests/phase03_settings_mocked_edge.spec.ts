/**
 * Phase 3 — SCR-08 project settings, MOCKED branches (QA-03d flow plan, agent P2): FL-08-13 … FL-08-16.
 * One `test()` per flow, one `test.step('[<row id>] …')` per catalog row, in the user's order. Copy, routes and the
 * sessions live in `support/p03/P2.ts`; seeds in `support/phase03Seed.ts`.
 *
 * ## Mocks ("[mocked response]" in every title; each needs its pairing row in `coverage/phase03-be.md`)
 * - FL-08-13: GET /api/projects/:id → 503 DEPENDENCY_UNAVAILABLE every try; GET …/settings → 500 INTERNAL. Unpairable: 5xx.
 *   The held settings read (08-B-001) is a delay of the real request, not a mock.
 * - FL-08-14: PUT …/settings → 422 VALIDATION field body.buildingType; 428 PRECONDITION_REQUIRED; 500 INTERNAL; 503 ×4
 *   (the HTTP client retries a keyed PUT 3 times, HTTP retry.ts, so the autosave engine only sees the 4th); aborted ×4;
 *   context offline. 422 paired by the API spec's settings validation case; 428 paired by the API spec (no baseVersion);
 *   500/503/abort/offline unpairable.
 * - FL-08-15: GET /api/projects/:id → 30 members with 80-char names (real body + 29 fake members); POST /members → 500, 503
 *   (then the client's own retry reaches the real BE), 429 RATE_LIMITED Retry-After 5 (every try); DELETE /members/:uid →
 *   500 ×2. Unpairable: 5xx; 429 unpairable (per-actor hourly window shared with phase 2). Held POST / DELETE are delays.
 * - FL-08-16: DELETE /api/floors/:id (2nd floor) → 500; DELETE /api/projects/:id → 500 once. Unpairable: 5xx.
 *
 * ## Real-backend budget per run
 * - `POST /api/auth/login`: 4 admin (own login per flow, no shared session file); 1 more for the pool engineer's
 *   first fill only (invitation + accept, see below). `POST /api/auth/refresh`: 2 per flow + 1 per page load.
 * - `POST /api/projects`: 4 (one per flow), each deleted in `finally`.
 * - `POST /api/projects/:id/members` (`members_add` 60 / 3600 s per actor): 2 real (FL-08-15 steps 3 and 7).
 * - `POST /api/users/invitations`: 0, or 1 the first time the pool slot `engineer:shared` is filled (shared with P-agents).
 * - `drawings_init`: 0. `PUT …/settings`: ~6 real. `DELETE /api/floors/:id`: 1 real. No mail except the member-added notice.
 */
import { expect, test, type Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { captureEvidence, testEmail } from './support/evidence';
import { createProject, deleteSeededProject, poolUser } from './support/phase03Seed';
import {
  COPY,
  DANGER,
  LABEL,
  MEMBER,
  TAB,
  alertWith,
  asRecord,
  bodyOf,
  boxOf,
  chooseTab,
  closeSession,
  fulfillError,
  hold,
  memberRe,
  membersPath,
  membersRe,
  openSession,
  openSettings,
  pathOf,
  projectPath,
  projectRe,
  recordRequests,
  saveIndicator,
  settingsPath,
  settingsRe,
  textbox,
  toastWith,
  uniq,
} from './support/p03/P2';

/* ================================================================= FL-08-13 */

test('FL-08-13 · SCR-08 · [mocked response] settings screen load: skeleton, 503 project read, 500 settings read, retry', async ({ browser }) => {
  test.setTimeout(120_000);
  const s = await openSession(browser, 'admin');
  const project = await createProject(s.api, '08-b-001');
  try {
    const { page } = s;

    await test.step('[08-B-001] settings read held → "property-panel" skeleton, no tabs, save indicator shown; release → form', async () => {
      const held = await hold(page, (url, method) => method === 'GET' && url.pathname === settingsPath(project.projectId));
      try {
        await page.goto(ROUTES.project.settings(project.projectId));
        await held.seen;
        await expect(page.locator('.animate-pulse').first()).toBeVisible(); // PS:108-109 Skeleton preset
        await expect(page.getByRole('tablist')).toHaveCount(0);
        await expect(textbox(page, LABEL.name)).toHaveCount(0);
        await expect(saveIndicator(page)).toBeVisible(); // PS:59 shown unless state === 'error'
        await captureEvidence(page, 'E03_08-B-001_skeleton.png');
      } finally {
        await held.release();
      }
      await expect(textbox(page, LABEL.name)).toHaveValue(project.name);
    });

    await test.step('[08-B-004] GET project 503 past retries → load error + sentence + "Thử lại"; unroute, retry → form', async () => {
      const matcher = (url: URL): boolean => url.pathname === projectPath(project.projectId);
      const handler = (route: Route): Promise<void> =>
        route.request().method() === 'GET' ? fulfillError(route, 503, 'DEPENDENCY_UNAVAILABLE') : route.fallback();
      await page.route(matcher, handler);
      await page.reload();
      const alert = alertWith(page, COPY.loadError);
      await expect(alert).toBeVisible({ timeout: 45_000 }); // HTTP retry.ts 300/900/2700 ms, then the query's own retry
      await expect.soft(alert).toContainText(new RegExp(`${COPY.networkError}|${COPY.unknownError}`, 'u'));
      const retry = alert.getByRole('button', { name: COPY.retry, exact: true });
      await expect.soft(retry, 'PS:61-66 canRetryLoad: a 503 offers "Thử lại"').toBeVisible({ timeout: 2_000 });
      await expect(textbox(page, LABEL.name)).toHaveCount(0);
      await captureEvidence(page, 'E03_08-B-004_project-503.png');
      await page.unroute(matcher, handler);
      // Without the button (app finding above) the only way back is a reload; either way the form must come back.
      if (await retry.isVisible()) await retry.click();
      else await page.reload();
      await expect(textbox(page, LABEL.name)).toHaveValue(project.name);
    });

    await test.step('[08-B-005] GET settings 500 only → same alert, no partial form, no save indicator; retry → form', async () => {
      const matcher = (url: URL): boolean => url.pathname === settingsPath(project.projectId);
      const handler = (route: Route): Promise<void> =>
        route.request().method() === 'GET' ? fulfillError(route, 500, 'INTERNAL') : route.fallback();
      await page.route(matcher, handler);
      await page.reload();
      const alert = alertWith(page, COPY.loadError);
      await expect(alert).toBeVisible({ timeout: 45_000 });
      const retry = alert.getByRole('button', { name: COPY.retry, exact: true });
      await expect.soft(retry, 'a 500 settings read offers "Thử lại"').toBeVisible({ timeout: 2_000 });
      await expect.soft(alert.getByRole('button', { name: COPY.backToProjects })).toHaveCount(0);
      await expect.soft(textbox(page, LABEL.name)).toHaveCount(0); // PSG:410-427 no partial form
      await expect.soft(page.getByRole('tablist')).toHaveCount(0);
      await expect.soft(saveIndicator(page)).toHaveCount(0); // PS:59 (BUG-078)
      await captureEvidence(page, 'E03_08-B-005_settings-500.png');
      await page.unroute(matcher, handler);
      if (await retry.isVisible()) await retry.click();
      else await page.reload();
      await expect(textbox(page, LABEL.name)).toHaveValue(project.name);
    });
  } finally {
    await deleteSeededProject(s.api, project.projectId);
    await closeSession(s);
  }
});

/* ================================================================= FL-08-14 */

test('FL-08-14 · SCR-08 · [mocked response] autosave failures: 422 no-field, 428, 500, 503 retry, abort, offline', async ({ browser }) => {
  test.setTimeout(240_000);
  const s = await openSession(browser, 'admin');
  const project = await createProject(s.api, '08-b-019');
  try {
    const { page, context } = s;
    const path = settingsPath(project.projectId);
    const puts = recordRequests(page, 'PUT', settingsRe(project.projectId));
    await page.clock.install();
    await openSettings(page, project.projectId, project.name);
    const notes = textbox(page, LABEL.notes);
    const failure = alertWith(page, COPY.saveFailure);

    /** Answers the next `count` PUT settings with `answer`, then lets PUTs through. */
    const failNextPuts = async (count: number, answer: (route: Route) => Promise<void>): Promise<() => Promise<void>> => {
      let left = count;
      const handler = async (route: Route): Promise<void> => {
        if (route.request().method() !== 'PUT' || left <= 0) return route.fallback();
        left -= 1;
        await answer(route);
      };
      const matcher = (url: URL): boolean => url.pathname === path;
      await page.route(matcher, handler);
      return () => page.unroute(matcher, handler);
    };

    await test.step('[08-B-019] "Loại công trình" → 422 body.buildingType → "Chưa lưu hết" sentence; next choice saves', async () => {
      const select = page.getByRole('combobox', { name: LABEL.buildingType, exact: true });
      const current = (await select.textContent()) ?? '';
      const [first, second] = ['Thương mại', 'Hỗn hợp', 'Khác'].filter((label) => !current.includes(label));
      const unroute = await failNextPuts(1, (route) => fulfillError(route, 422, 'VALIDATION', { field: 'body.buildingType' }));
      const refused = waitForApi(page, 'PUT', settingsRe(project.projectId), [422]);
      await select.click();
      await page.getByRole('option', { name: String(first), exact: true }).click();
      await refused;
      await expect.soft(failure).toContainText('Chưa lưu được loại công trình. Sửa lại giá trị đó, hệ thống sẽ tự lưu tiếp.'); // SE:160-172
      await captureEvidence(page, 'E03_08-B-019_buildingtype-422.png');
      await unroute();
      const saved = waitForApi(page, 'PUT', settingsRe(project.projectId), [200]);
      await select.click();
      await page.getByRole('option', { name: String(second), exact: true }).click();
      await saved;
      await expect.soft(failure).toHaveCount(0);
    });

    await test.step('[08-B-020] notes → 428 → "Chưa lưu được ghi chú. Tải lại trang để lưu tiếp." + reload chip; reload', async () => {
      const unroute = await failNextPuts(1, (route) => fulfillError(route, 428, 'PRECONDITION_REQUIRED'));
      const refused = waitForApi(page, 'PUT', settingsRe(project.projectId), [428]);
      await notes.fill(`qa 428 ${uniq()}`);
      await refused;
      await expect.soft(failure).toContainText('Chưa lưu được ghi chú. Tải lại trang để lưu tiếp.'); // SE:141
      await expect.soft(saveIndicator(page)).toContainText(COPY.reloadChip); // SE chipReload (BUG-300)
      await captureEvidence(page, 'E03_08-B-020_notes-428.png');
      await unroute();
      await page.reload();
      await expect(notes).toBeVisible();
    });

    await test.step('[08-B-021] notes → 500 → "Chưa lưu được ghi chú." + failed chip; +60 s no PUT; next edit saves', async () => {
      const unroute = await failNextPuts(1, (route) => fulfillError(route, 500, 'INTERNAL'));
      const refused = waitForApi(page, 'PUT', settingsRe(project.projectId), [500]);
      await notes.fill(`qa 500 ${uniq()}`);
      await refused;
      await expect.soft(failure).toContainText('Chưa lưu được ghi chú.');
      await expect.soft(saveIndicator(page)).toContainText(COPY.failedChip); // I18N autosave.failed, no auto retry
      await captureEvidence(page, 'E03_08-B-021_notes-500.png');
      await unroute();
      const mark = puts.length;
      await page.clock.fastForward(60_000);
      await page.waitForTimeout(1_000);
      expect.soft(puts.length - mark, '500 is permanent: no automatic PUT within 60 s').toBe(0);
      const saved = waitForApi(page, 'PUT', settingsRe(project.projectId), [200]);
      await notes.fill(`qa after 500 ${uniq()}`);
      await saved;
      await expect.soft(saveIndicator(page)).toHaveText(COPY.savedAt);
    });

    await test.step('[08-B-022] notes → 503 (each HTTP try) → engine retries after 5 s → real 200 → "Đã lưu lúc …"', async () => {
      const unroute = await failNextPuts(4, (route) => fulfillError(route, 503, 'DEPENDENCY_UNAVAILABLE'));
      const mark = puts.length;
      const saved = waitForApi(page, 'PUT', settingsRe(project.projectId), [200], 30_000);
      await notes.fill(`qa 503 ${uniq()}`);
      await expect.poll(() => puts.length - mark, { timeout: 15_000 }).toBeGreaterThanOrEqual(4);
      await page.clock.fastForward(5_000); // createAutosave retrySchedule 5 s
      await saved;
      await unroute();
      await expect.soft(saveIndicator(page)).toHaveText(COPY.savedAt);
      await expect.soft(failure).toHaveCount(0);
      await captureEvidence(page, 'E03_08-B-022_notes-503-retried.png');
    });

    await test.step('[08-B-024] PUT aborted (each HTTP try), newer edit → held body replayed with its baseVersion first', async () => {
      const unroute = await failNextPuts(4, (route) => route.abort('failed'));
      const mark = puts.length;
      const first = `qa abort ${uniq()}`;
      const newer = `qa newer ${uniq()}`;
      await notes.fill(first);
      await expect.poll(() => puts.length - mark, { timeout: 15_000 }).toBeGreaterThanOrEqual(4);
      await unroute();
      const aborted = puts[mark];
      if (aborted === undefined) throw new Error('no aborted PUT recorded');
      const heldBase = bodyOf(aborted).baseVersion;
      await notes.fill(newer);
      const sent = (): { baseVersion: unknown; notes: unknown }[] =>
        puts.slice(mark + 4).map((r) => ({ baseVersion: bodyOf(r).baseVersion, notes: asRecord(bodyOf(r).body, 'PUT body').notes }));
      await expect.poll(() => sent().some((p) => p.notes === newer), { timeout: 20_000 }).toBe(true);
      const after = sent();
      // PSG:360-407: the held body (first notes, held baseVersion) goes before the newer body.
      expect.soft(after[0], 'first PUT after the aborts replays the held body').toEqual({ baseVersion: heldBase, notes: first });
      expect.soft(after.findIndex((p) => p.notes === newer), 'newer body comes after the replay').toBeGreaterThan(0);
      await expect(saveIndicator(page)).toHaveText(COPY.savedAt, { timeout: 15_000 });
    });

    await test.step('[08-B-023] offline edit → chip "Ngoại tuyến — sẽ lưu khi có mạng"; online → PUT 200', async () => {
      await context.setOffline(true);
      await notes.fill(`qa offline ${uniq()}`);
      await expect.soft(saveIndicator(page)).toContainText(COPY.offlineChip, { timeout: 10_000 });
      await captureEvidence(page, 'E03_08-B-023_offline.png');
      const saved = waitForApi(page, 'PUT', settingsRe(project.projectId), [200], 20_000);
      await context.setOffline(false);
      await page.clock.fastForward(5_000); // OFFLINE_RECHECK_MS
      await saved;
    });
  } finally {
    await s.context.setOffline(false).catch(() => undefined);
    await deleteSeededProject(s.api, project.projectId);
    await closeSession(s);
  }
});

/* ================================================================= FL-08-15 */

test('FL-08-15 · SCR-08 · [mocked response] member add / undo / remove failures, in-flight states, 429 lock', async ({ browser }) => {
  test.setTimeout(240_000);
  const s = await openSession(browser, 'admin');
  const engineer = await poolUser(s.api, 'engineer');
  const project = await createProject(s.api, '08-b-029');
  try {
    const { page } = s;
    const id = project.projectId;
    const posts = recordRequests(page, 'POST', membersRe(id));
    const keyOf = (index: number): string | undefined => posts[index]?.headers()['idempotency-key'];
    await page.clock.install();
    await openSettings(page, id, project.name);
    await chooseTab(page, TAB.members);
    const email = textbox(page, MEMBER.email);
    const add = page.getByRole('button', { name: MEMBER.add, exact: true });
    const removeEngineer = page.getByRole('button', { name: `${MEMBER.remove} ${engineer.name}`, exact: true }); // UPS:1271
    const dialog = page.getByRole('dialog', { name: `Gỡ ${engineer.name} khỏi dự án?`, exact: true }); // UPM:266

    await test.step('[08-B-029] 30 members with 80-char names: names truncate, each "Gỡ" stays on its row', async () => {
      const matcher = (url: URL): boolean => url.pathname === projectPath(id);
      const handler = async (route: Route): Promise<void> => {
        if (route.request().method() !== 'GET') return route.fallback();
        const response = await route.fetch();
        const json = (await response.json()) as { members: Record<string, unknown>[] };
        const real = json.members[0] ?? {};
        const extra = Array.from({ length: 29 }, (_, i) => ({
          ...real,
          id: `usr_qa_p2_${String(i)}`,
          email: `qa-p2-${String(i)}@example.test`,
          name: `${String(i).padStart(2, '0')} ${'Nguyễn Thị Phương Thảo Hoàng '.repeat(3)}`.slice(0, 80),
          role: 'engineer',
        }));
        await route.fulfill({ response, json: { ...json, members: [...json.members, ...extra] } });
      };
      await page.route(matcher, handler);
      await page.reload();
      await chooseTab(page, TAB.members);
      await expect(page.getByText('30 thành viên', { exact: true })).toBeVisible();
      const rows = page.getByRole('listitem').filter({ has: page.getByRole('button', { name: /^Gỡ / }) });
      await expect.soft(rows).toHaveCount(30);
      const last = rows.last();
      const name = last.locator('span.truncate');
      expect.soft(await name.evaluate((el) => el.scrollWidth > el.clientWidth), 'an 80-char name is truncated').toBe(true);
      const row = await boxOf(last);
      const btn = await boxOf(last.getByRole('button', { name: /^Gỡ / }));
      expect.soft(btn.x + btn.width <= row.x + row.width + 1 && btn.y >= row.y - 1 && btn.y + btn.height <= row.y + row.height + 1, '"Gỡ" inside its row').toBe(true);
      await captureEvidence(page, 'E03_08-B-029_30-members.png', { fullPage: true });
      await page.unroute(matcher, handler);
      await page.reload();
      await chooseTab(page, TAB.members);
      await expect(page.getByText('1 thành viên', { exact: true })).toBeVisible();
    });

    await test.step('[08-B-034] add → POST 500 → describeError sentence under the input', async () => {
      await page.route((url) => url.pathname === membersPath(id), (route) => fulfillError(route, 500, 'INTERNAL'), { times: 1 });
      const failed = waitForApi(page, 'POST', membersRe(id), [500]);
      await email.fill(engineer.email);
      await add.click();
      await failed;
      await expect.soft(page.getByText(COPY.unknownError, { exact: true })).toBeVisible(); // UPM:111 describeError
      await captureEvidence(page, 'E03_08-B-034_add-500.png');
    });

    await test.step('[08-B-035] POST 503 → client retry → real 201 with the SAME Idempotency-Key as the 500 try', async () => {
      await page.route((url) => url.pathname === membersPath(id), (route) => fulfillError(route, 503, 'DEPENDENCY_UNAVAILABLE'), { times: 1 });
      const mark = posts.length;
      const created = waitForApi(page, 'POST', membersRe(id), [201]);
      await add.click();
      await created;
      const keys = [keyOf(mark - 1), ...posts.slice(mark).map((r) => r.headers()['idempotency-key'])];
      expect(keys.length, '500 try + 503 try + its retry').toBeGreaterThanOrEqual(3);
      expect(new Set(keys).size, `one key for the same email after a 5xx: ${keys.join(', ')}`).toBe(1); // PSG:471-491
      expect(keys[0]).toBeTruthy();
      await expect(page.getByText('2 thành viên', { exact: true })).toBeVisible();
    });

    await test.step('[08-B-036] toast "Hoàn tác" → DELETE 500 → "Không gỡ lại được người vừa thêm."; member stays', async () => {
      await page.route((url) => memberRe(id).test(url.pathname), (route) => fulfillError(route, 500, 'INTERNAL'), { times: 1 });
      const toast = toastWith(page, `Đã thêm ${engineer.name}`).first();
      const failed = waitForApi(page, 'DELETE', memberRe(id), [500]);
      await toast.getByRole('button', { name: COPY.undo, exact: true }).click();
      await failed;
      await expect.soft(toastWith(page, MEMBER.undoFailed).first()).toBeVisible(); // UPM:214 violation toast
      await expect.soft(page.getByText('2 thành viên', { exact: true })).toBeVisible();
      await captureEvidence(page, 'E03_08-B-036_undo-500.png');
    });

    await test.step('[08-B-039] "Gỡ {engineer}" → DELETE 500 → describeError sentence in the dialog; "Gỡ" usable again', async () => {
      await page.route((url) => memberRe(id).test(url.pathname), (route) => fulfillError(route, 500, 'INTERNAL'), { times: 1 });
      await removeEngineer.click();
      await expect(dialog).toBeVisible();
      const failed = waitForApi(page, 'DELETE', memberRe(id), [500]);
      await dialog.getByRole('button', { name: MEMBER.remove, exact: true }).click();
      await failed;
      await expect.soft(dialog.getByRole('alert')).toHaveText(COPY.unknownError); // MRD:26-30, UPM:292
      await expect(dialog.getByRole('button', { name: MEMBER.remove, exact: true })).toBeEnabled();
      await captureEvidence(page, 'E03_08-B-039_remove-500.png');
    });

    await test.step('[08-B-040] DELETE held: "Để nguyên" disabled, "Gỡ" loading, Esc ignored; release → removed', async () => {
      const held = await hold(page, (url, method) => method === 'DELETE' && memberRe(id).test(url.pathname));
      try {
        await dialog.getByRole('button', { name: MEMBER.remove, exact: true }).click();
        await held.seen;
        await expect.soft(dialog.getByRole('button', { name: MEMBER.keep, exact: true })).toBeDisabled(); // MRD:35-38
        const confirm = dialog.getByRole('button', { name: MEMBER.remove, exact: true });
        await expect.soft(confirm).toBeDisabled();
        await expect.soft(confirm.locator('.animate-spin')).toBeVisible(); // Button loading
        await page.keyboard.press('Escape'); // UPM:402-404 cancel ignored while running
        await expect.soft(dialog).toBeVisible();
        await captureEvidence(page, 'E03_08-B-040_remove-in-flight.png');
      } finally {
        await held.release();
      }
      await expect(dialog).toHaveCount(0);
      await expect(page.getByText('1 thành viên', { exact: true })).toBeVisible();
    });

    await test.step('[08-B-030] POST held: email input disabled, "Thêm thành viên" loading; release → added', async () => {
      const held = await hold(page, (url, method) => method === 'POST' && url.pathname === membersPath(id));
      try {
        await email.fill(engineer.email);
        await add.click();
        await held.seen;
        await expect.soft(email).toBeDisabled(); // AMF:34
        await expect.soft(add).toBeDisabled();
        await expect.soft(add.locator('.animate-spin')).toBeVisible(); // AMF:42 loading
        await captureEvidence(page, 'E03_08-B-030_add-in-flight.png');
      } finally {
        await held.release();
      }
      await expect(page.getByText('2 thành viên', { exact: true })).toBeVisible();
    });

    // QA-03e (BUG-510, FIX-2344, R-src): members.add sends `failFastOnRateLimit: true` (projectSettingsGateway.ts:487), so the
    // client returns the 429 on the first answer (src/lib/http/client.ts:503) with retryAfterSeconds: ONE POST, the quota
    // sentence and the lock appear at once; the lock stays max(Retry-After, 60) s.
    await test.step('[08-B-033] other email → 429 → rate sentence + locked button at once, one POST, a new key; +60 s → enabled', async () => {
      const handler = (route: Route): Promise<void> =>
        route.request().method() === 'POST' ? fulfillError(route, 429, 'RATE_LIMITED', {}, { 'Retry-After': '5' }) : route.fallback();
      const matcher = (url: URL): boolean => url.pathname === membersPath(id);
      await page.route(matcher, handler);
      const mark = posts.length;
      await email.fill(testEmail('p2-429'));
      await add.click();
      const errorLine = page.getByRole('alert').filter({ hasNotText: COPY.loadError }).last();
      await expect(errorLine).toBeVisible({ timeout: 5_000 });
      await expect.soft(errorLine).toHaveText(MEMBER.rateLimited); // UPM:268-272
      await expect.soft(add).toBeDisabled(); // UPM:320-326 lock max(Retry-After, 60) s
      const key = posts[mark]?.headers()['idempotency-key'];
      expect.soft(key, 'another email gets another Idempotency-Key').not.toBe(keyOf(mark - 1));
      await captureEvidence(page, 'E03_08-B-033_add-429.png');
      await page.unroute(matcher, handler);
      await page.clock.fastForward(61_000);
      await expect.soft(add).toBeEnabled();
      expect.soft(posts.length - mark, 'one POST for that email: a clicked add is not retried on 429').toBe(1);
    });
  } finally {
    await deleteSeededProject(s.api, project.projectId);
    await closeSession(s);
  }
});

/* ================================================================= FL-08-16 */

test('FL-08-16 · SCR-08 · [mocked response] danger actions: partial floor delete, project delete 500, in-flight', async ({ browser }) => {
  test.setTimeout(120_000);
  const s = await openSession(browser, 'admin');
  const project = await createProject(s.api, '08-b-046', 2);
  try {
    const { page } = s;
    const id = project.projectId;
    await openSettings(page, id, project.name);
    await chooseTab(page, TAB.danger);
    // The panel's buttons sit under the modal (aria-hidden) while a dialog is open, so not by role; `includeHidden` would
    // also read Button's aria-hidden label copy into the name. The portal dialog comes later in the DOM: `.first()`.
    const panelButton = (name: string) => page.locator('button', { hasText: name }).first();

    await test.step('[08-B-046] "Xoá mọi tầng", 2nd floor DELETE 500 → attention toast "Đã xoá 1 tầng; còn 1 tầng chưa xoá được."', async () => {
      const second = project.floors[1]?.id ?? '';
      const matcher = (url: URL): boolean => url.pathname === `/api/floors/${second}`;
      const handler = (route: Route): Promise<void> =>
        route.request().method() === 'DELETE' ? fulfillError(route, 500, 'INTERNAL') : route.fallback();
      await page.route(matcher, handler);
      await panelButton(DANGER.deleteFloors).click();
      const dialog = page.getByRole('dialog', { name: DANGER.deleteFloorsTitle, exact: true });
      await dialog.getByRole('button', { name: DANGER.deleteFloors, exact: true }).click();
      await expect.soft(toastWith(page, 'Đã xoá 1 tầng; còn 1 tầng chưa xoá được.').first()).toBeVisible(); // UPS:1235-1242
      await captureEvidence(page, 'E03_08-B-046_floors-partial.png');
      await page.unroute(matcher, handler);
      await expect(dialog).toHaveCount(0);
    });

    const dialog = page.getByRole('dialog', { name: DANGER.deleteProjectTitle, exact: true });
    const confirm = dialog.getByRole('button', { name: DANGER.deleteProject, exact: true });

    await test.step('[08-B-045] "Xoá dự án" exact name → 500 → describeError sentence in the dialog; dialog stays', async () => {
      let left = 1; // `times` would also count the GETs that fall back, so count the DELETE itself
      await page.route((url) => url.pathname === projectPath(id), (route) => {
        if (route.request().method() !== 'DELETE' || left <= 0) return route.fallback();
        left -= 1;
        return fulfillError(route, 500, 'INTERNAL');
      });
      await panelButton(DANGER.deleteProject).click();
      await dialog.getByRole('textbox', { name: DANGER.typeName, exact: true }).fill(project.name);
      const failed = waitForApi(page, 'DELETE', projectRe(id), [500]);
      await confirm.click();
      await failed;
      await expect.soft(dialog).toContainText(COPY.unknownError); // UPS:1250-1253
      await expect(dialog).toBeVisible();
      expect(pathOf(page)).toBe(ROUTES.project.settings(id));
      await captureEvidence(page, 'E03_08-B-045_delete-500.png');
    });

    await test.step('[08-B-043] DELETE held: danger buttons, input, "Để nguyên" disabled, confirm loading, Esc ignored; release → "/"', async () => {
      const held = await hold(page, (url, method) => method === 'DELETE' && url.pathname === projectPath(id));
      try {
        await confirm.click();
        await held.seen;
        await expect.soft(panelButton(DANGER.deleteProject)).toBeDisabled(); // DZ:62-67
        await expect.soft(panelButton(DANGER.deleteFloors)).toBeDisabled();
        await expect.soft(dialog.getByRole('textbox', { name: DANGER.typeName, exact: true })).toBeDisabled(); // PS:167
        await expect.soft(dialog.getByRole('button', { name: DANGER.keep, exact: true })).toBeDisabled();
        await expect.soft(confirm).toBeDisabled();
        await expect.soft(confirm.locator('.animate-spin')).toBeVisible();
        await page.keyboard.press('Escape'); // UPS:1213 cancelDanger ignored while running
        await expect.soft(dialog).toBeVisible();
        await captureEvidence(page, 'E03_08-B-043_delete-in-flight.png');
      } finally {
        await held.release();
      }
      await expect.poll(() => pathOf(page), { timeout: 20_000 }).toBe(ROUTES.dashboard);
    });
  } finally {
    await deleteSeededProject(s.api, project.projectId);
    await closeSession(s);
  }
});
