/**
 * Phase 7 - SCR-33 `/tai-khoan` profile, EDGE layer, MOCKED RESPONSES (QA-07b pack P3): FL-33P-10 (N11 load failures),
 * FL-33P-11 (N12 autosave answers and the retry schedule), FL-33P-12 (N14 avatar answers and a FileReader fault).
 * One `test()` per flow, one `test.step('[<row id>] ...')` per catalog row in the flows order.
 * Short names (FE, under `src/screens/account/AccountSettings/`): AS AccountSettings.tsx, UAS useAccountSettings.ts,
 * UAP useAccountPreferences.ts. CA src/lib/autosave/createAutosave.ts, RS src/lib/autosave/retrySchedule.ts,
 * WE src/lib/errors/wireError.ts.
 *
 * Why mocked: 5xx, an aborted request, a 429 on N12, a body with an unknown key and a FileReader fault cannot be produced
 * on demand by the real stack. Paired real lines (each flow ends or is paired on a real answer):
 *   FL-33P-10 step 5 is the REAL `GET /api/me` after `page.unroute`; paired with FL-33P-02 (loaded state).
 *   FL-33P-11 steps 4-6 end on the REAL `PATCH /api/me` 200 (`route.continue`); paired with the real 422 of FL-33P-05 and FL-33P-03.
 *   FL-33P-12 is paired with the real `PUT /api/me/avatar` of FL-33P-08 / FL-33P-09 (same screen, same dialog).
 *
 * User: its own engineer `p07-profile-2m` (not shared with phase07_profile_edge, which runs in parallel) (flow 11 edits "Chức danh" and restores the profile in `finally`).
 * Request budget (BE limits): `POST /api/auth/login` 120 / 60 s per IP: 1 admin API + 3 flow sessions = 4; `PATCH /api/me`
 * has no rate limit (real PATCHes: 3, the rest are answered by the mock); `PUT /api/me/avatar` 0 real (all mocked);
 * `POST /api/auth/refresh` ~1 per page load.
 *
 * `page.clock` (installed, time flowing) jumps the 800 ms debounce and the 5 / 15 / 45 s retry ladder of FL-33P-11.
 */
import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { TEST_DATA_PREFIX, captureEvidence } from './support/evidence';
import {
  AVATAR,
  BLOCK_IDS,
  ERROR_PAINT_TIMEOUT_MS,
  GENERIC_UNKNOWN,
  IND,
  LOAD_ERROR_TITLE,
  ME_RE,
  RETRY,
  asRecord,
  avatarDialog,
  block,
  box,
  fieldError,
  heading,
  openAccount,
  resetProfile,
  saveIndicator,
  snapshotProfile,
} from './support/p07/account';
import {
  AVATAR_MSG,
  DEBOUNCE_JUMP_MS,
  IND_DIRTY,
  NETWORK_DESCRIPTION,
  closeP3Session,
  confirmAvatarButton,
  ev,
  openP3Session,
  pickAvatar,
  scriptRoute,
  tinyPng,
} from './support/p07/P3';

const ME_GLOB = '**/api/me';
const AVATAR_GLOB = '**/api/me/avatar';

/** The InlineAlert of the page-level read error (AS:184-193): `role="alert"` with the title. */
const loadBanner = (page: Page) => page.getByRole('alert').filter({ hasText: LOAD_ERROR_TITLE });
const retryButton = (page: Page) => page.getByRole('button', { name: RETRY, exact: true });

test('SCR-33 · FL-33P-10 · [mocked response] N11 failures → banner, "Thử lại" (pairs with FL-33P-02 loaded state and the success step 5 below)', async ({ browser }) => {
  test.setTimeout(180_000);
  const s = await openP3Session(browser, 'p07-profile-2m');
  const { page } = s;
  let mode: 'fail500' | 'abort' | 'unknownKey' = 'fail500';
  let gets = 0;
  let realBody: Record<string, unknown> = {};
  const handler = async (route: Route): Promise<void> => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    gets += 1;
    if (mode === 'abort') {
      await route.abort('failed');
    } else if (mode === 'unknownKey') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...realBody, foo: 1 }) });
    } else {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'qa-p3 mocked 500' }) });
    }
  };
  try {
    await page.route(ME_GLOB, handler);

    await test.step('[33P-B-007] GET /api/me 500 -> banner with title, message and "Thử lại"; the five blocks are gone', async () => {
      await page.goto(ROUTES.account);
      await expect(loadBanner(page)).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS }); // AS:184-193
      await expect(loadBanner(page).getByText(GENERIC_UNKNOWN, { exact: true })).toBeVisible(); // UAS:409-412
      await expect(retryButton(page)).toBeVisible();
      for (const id of BLOCK_IDS) await expect(block(page, id)).toHaveCount(0);
      await captureEvidence(page, ev('33P-B-007', 'load-500'));
    });

    await test.step('[33P-B-008] no "Chưa có thay đổi" chip beside the load error (BUG-504, red until fix/qa07-a merges)', async () => {
      await expect.soft(page.getByText(IND.idle, { exact: true })).toHaveCount(0);
      await expect.soft(saveIndicator(page)).toHaveCount(0);
      await captureEvidence(page, ev('33P-B-008', 'no-chip'));
    });

    await test.step('[33P-B-012] "Thử lại" while the mock still fails: one more GET, banner stays, button usable', async () => {
      const before = gets;
      await retryButton(page).click();
      await expect.poll(() => gets, { message: 'one GET per click' }).toBe(before + 1);
      await expect.soft(loadBanner(page)).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
      await expect.soft(retryButton(page)).toBeEnabled();
      await captureEvidence(page, ev('33P-B-012', 'retry-still-failing'));
    });

    await test.step('[33P-E-012] focus "Thử lại" and press Enter: another GET, the banner (role alert) stays', async () => {
      const before = gets;
      await retryButton(page).focus();
      await page.keyboard.press('Enter');
      await expect.poll(() => gets, { message: 'Enter refetches' }).toBe(before + 1);
      await expect.soft(loadBanner(page)).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
      await captureEvidence(page, ev('33P-E-012', 'retry-by-keyboard'));
    });

    await test.step('[33P-B-009] unroute + "Thử lại": REAL GET 200, banner gone, "Chức danh" back', async () => {
      await page.unroute(ME_GLOB, handler);
      const read = waitForApi(page, 'GET', ME_RE, [200]);
      await retryButton(page).click(); // UAS:417-420 retryLoad
      realBody = asRecord((await read).json, 'GET /api/me');
      await expect.soft(loadBanner(page)).toHaveCount(0);
      await expect.soft(box(page, 'Chức danh')).toBeVisible();
      await captureEvidence(page, ev('33P-B-009', 'retry-recovered'));
    });

    await test.step('[33P-B-010] the next load aborted -> "Không liên lạc được với máy chủ. Kiểm tra mạng rồi thử lại."', async () => {
      mode = 'abort';
      await page.route(ME_GLOB, handler);
      await page.goto(ROUTES.account);
      await expect.soft(loadBanner(page)).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
      await expect.soft(loadBanner(page).getByText(NETWORK_DESCRIPTION, { exact: true })).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS }); // I18N errors.network
      await captureEvidence(page, ev('33P-B-010', 'load-network'));
    });

    await test.step('[33P-B-011] 200 with an unknown key "foo" -> strict schema rejects it: banner + "Thử lại", page not blank', async () => {
      mode = 'unknownKey';
      await page.goto(ROUTES.account);
      await expect.soft(loadBanner(page)).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS }); // SCH me.ts:44 .strict()
      await expect.soft(retryButton(page)).toBeVisible();
      await expect.soft(heading(page)).toBeVisible();
      await captureEvidence(page, ev('33P-B-011', 'unknown-key'));
    });
  } finally {
    await page.unroute(ME_GLOB, handler).catch(() => undefined);
    await closeP3Session(s);
  }
});

test('SCR-33 · FL-33P-11 · [mocked response] N12 answers → chip, retry schedule (pairs with the real 422 in FL-33P-05 and the real PATCH of FL-33P-03)', async ({ browser }) => {
  test.setTimeout(240_000);
  const s = await openP3Session(browser, 'p07-profile-2m');
  const { page } = s;
  const snapshot = await snapshotProfile(s.context);
  let stopRoute: () => Promise<void> = () => Promise.resolve();
  try {
    await page.clock.install();
    await openAccount(page);
    const patch = await scriptRoute(page, ME_GLOB, 'PATCH');
    stopRoute = patch.stop;
    let seq = 0;
    /** Types a new "Chức danh" and jumps the debounce: the autosave attempt starts. */
    const edit = async (tag: string): Promise<void> => {
      seq += 1;
      await box(page, 'Chức danh').fill(`${TEST_DATA_PREFIX}-${tag}-${String(seq)}`);
      await page.clock.runFor(DEBOUNCE_JUMP_MS);
    };
    /** After the first answer: nothing more is sent for 60 s (a permanent error is not retried). */
    const noRetry = async (): Promise<void> => {
      await page.clock.runFor(60_000);
      expect.soft(patch.hits(), 'no retry after a permanent error').toBe(1);
    };
    /** The next attempt is NOT sent `delayMs - 1 s` after the previous answer, and IS sent shortly after. */
    const retryAt = async (delayMs: number, hitsBefore: number): Promise<void> => {
      await expect(saveIndicator(page)).toHaveText(IND_DIRTY); // the failure is processed: the retry timer is armed from now
      await page.clock.runFor(delayMs - 1_000);
      expect.soft(patch.hits(), `no request before ${String(delayMs)} ms`).toBe(hitsBefore);
      await page.clock.runFor(5_000);
      await expect.poll(() => patch.hits(), { message: `request after ${String(delayMs)} ms` }).toBe(hitsBefore + 1);
    };

    await test.step('[33P-G-009] 422 field "language" (not mapped) -> no field error; chip "Lưu thất bại…"; no retry after 60 s', async () => {
      patch.use(() => ({ status: 422, body: { code: 'VALIDATION', field: 'language', message: 'qa-p3 mocked' } }));
      await edit('g009');
      await expect.poll(() => patch.hits()).toBe(1);
      await expect(saveIndicator(page)).toHaveText(IND.failed); // UAS:304-309
      await expect.soft(block(page, 'account-profile').getByRole('alert'), 'no field error (the announcer region is outside the block)').toHaveCount(0);
      await noRetry(); // CA:192
      await captureEvidence(page, ev('33P-G-009', 'language-422'));
    });

    await test.step('[33P-G-010] 403 -> chip "Lưu thất bại…", no retry (403 is not transient)', async () => {
      patch.use(() => ({ status: 403, body: { code: 'FORBIDDEN' } }));
      await edit('g010');
      await expect.poll(() => patch.hits()).toBe(1);
      await expect.soft(saveIndicator(page)).toHaveText(IND.failed);
      await noRetry();
      await captureEvidence(page, ev('33P-G-010', 'forbidden-403'));
    });

    await test.step('[33P-G-014] 500 -> permanent: chip "Lưu thất bại…", exactly one request in total', async () => {
      patch.use(() => ({ status: 500, body: { code: 'INTERNAL' } })); // WE:11 transient = 408 429 502 503 504
      await edit('g014');
      await expect.poll(() => patch.hits()).toBe(1);
      await expect.soft(saveIndicator(page)).toHaveText(IND.failed);
      await noRetry();
      await captureEvidence(page, ev('33P-G-014', 'server-500'));
    });

    await test.step('[33P-G-013] 429 once, then the real stack -> chip dirty, 2nd request at +5 s, real 200 -> "Đã lưu lúc"', async () => {
      patch.use((hit) => (hit === 1 ? { status: 429, body: { code: 'RATE_LIMITED' } } : 'continue'));
      await edit('g013');
      await expect.poll(() => patch.hits()).toBe(1);
      await expect.soft(saveIndicator(page)).toHaveText(IND_DIRTY);
      await captureEvidence(page, ev('33P-G-013', 'rate-limited-dirty'));
      await retryAt(5_000, 1); // RS:1
      await expect.soft(saveIndicator(page)).toHaveText(IND.saved);
    });

    await test.step('[33P-G-015] 503 until released -> chip dirty, retry at +5 s; after release the real 200 -> "Đã lưu lúc"', async () => {
      let blocked = true;
      patch.use(() => (blocked ? { status: 503, body: { code: 'DEPENDENCY_UNAVAILABLE' } } : 'continue'));
      await edit('g015');
      await expect.poll(() => patch.hits()).toBe(1);
      await expect.soft(saveIndicator(page)).toHaveText(IND_DIRTY);
      await captureEvidence(page, ev('33P-G-015', 'unavailable-dirty'));
      blocked = false;
      await retryAt(5_000, 1);
      await expect.soft(saveIndicator(page)).toHaveText(IND.saved);
    });

    await test.step('[33P-G-016] request aborted once while online -> chip dirty, retry at +5 s, recovers', async () => {
      patch.use((hit) => (hit === 1 ? 'abort' : 'continue'));
      await edit('g016');
      await expect.poll(() => patch.hits()).toBe(1);
      await expect.soft(saveIndicator(page)).toHaveText(IND_DIRTY);
      await captureEvidence(page, ev('33P-G-016', 'aborted-dirty'));
      await retryAt(5_000, 1);
      await expect.soft(saveIndicator(page)).toHaveText(IND.saved);
    });

    await test.step('[33P-G-017] 503 for every attempt -> requests at 0, +5, +20, +65 s, then chip "Lưu thất bại…"', async () => {
      patch.use(() => ({ status: 503, body: { code: 'DEPENDENCY_UNAVAILABLE' } }));
      await edit('g017');
      await expect.poll(() => patch.hits()).toBe(1);
      await retryAt(5_000, 1); // RS:1 [5 000, 15 000, 45 000]
      await retryAt(15_000, 2);
      await retryAt(45_000, 3);
      await expect.soft(saveIndicator(page)).toHaveText(IND.failed); // CA:197-200
      await page.clock.runFor(120_000);
      expect.soft(patch.hits(), 'the ladder is exhausted: 4 requests in all').toBe(4);
      await captureEvidence(page, ev('33P-G-017', 'ladder-exhausted'));
    });
  } finally {
    await stopRoute().catch(() => undefined);
    await resetProfile(s.context, snapshot);
    await closeP3Session(s);
  }
});

test('SCR-33 · FL-33P-12 · [mocked response] N14 answers and a FileReader fault (pairs with the real PUT of FL-33P-08)', async ({ browser }) => {
  test.setTimeout(120_000);
  const s = await openP3Session(browser, 'p07-profile-2m');
  const { page } = s;
  let stopRoute: () => Promise<void> = () => Promise.resolve();
  try {
    // FileReader fault switch: read at call time, so the same document can read normally first (set by the last step).
    await page.addInitScript(() => {
      const original = FileReader.prototype.readAsDataURL;
      FileReader.prototype.readAsDataURL = function readAsDataURL(this: FileReader, blob: Blob): void {
        if ((window as unknown as { __qaFileReaderFault?: boolean }).__qaFileReaderFault === true) {
          queueMicrotask(() => this.dispatchEvent(new ProgressEvent('error')));
          return;
        }
        original.call(this, blob);
      };
    });
    await openAccount(page);
    const put = await scriptRoute(page, AVATAR_GLOB, 'PUT');
    stopRoute = put.stop;
    const dialog = avatarDialog(page);

    /** Picks a PNG, confirms, and expects the answered `put` to close the dialog with `message` shown. */
    const answered = async (message: string, evidence: string, hard = false): Promise<void> => {
      await pickAvatar(page, tinyPng());
      await expect(dialog).toBeVisible();
      const before = put.hits();
      await confirmAvatarButton(page).click();
      await expect.poll(() => put.hits()).toBe(before + 1);
      const check = hard ? expect : expect.soft;
      await check(dialog).toBeHidden();
      await check(fieldError(page, message)).toBeVisible();
      await captureEvidence(page, evidence);
    };

    await test.step('[33P-G-024] 422 VALIDATION field "contentBase64" -> alert "Không đọc được ảnh này…", dialog closed', async () => {
      put.use(() => ({ status: 422, body: { code: 'VALIDATION', field: 'contentBase64' } }));
      await answered(AVATAR_MSG.corrupt, ev('33P-G-024', 'validation-content'), true);
    });

    await test.step('[33P-G-027] 503 DEPENDENCY_UNAVAILABLE -> alert "Hệ thống đã ghi nhận và sẽ kiểm tra…", dialog closed', async () => {
      put.use(() => ({ status: 503, body: { code: 'DEPENDENCY_UNAVAILABLE' } }));
      await answered(GENERIC_UNKNOWN, ev('33P-G-027', 'unavailable-503'));
    });

    await test.step('[33P-G-028] 500 -> the same alert', async () => {
      put.use(() => ({ status: 500, body: { code: 'INTERNAL' } }));
      await answered(GENERIC_UNKNOWN, ev('33P-G-028', 'server-500'));
    });

    await test.step('[33P-G-029] network failure -> "Không liên lạc được với máy chủ. Kiểm tra mạng rồi thử lại."', async () => {
      put.use(() => 'abort');
      await answered(NETWORK_DESCRIPTION, ev('33P-G-029', 'network'));
    });

    await test.step('[33P-C-022] FileReader.readAsDataURL fails -> alert "Không đọc được ảnh này…", no dialog, no PUT', async () => {
      await page.evaluate(() => {
        (window as unknown as { __qaFileReaderFault?: boolean }).__qaFileReaderFault = true;
      });
      const before = put.hits();
      await pickAvatar(page, tinyPng('p3-reader.png'));
      await expect(fieldError(page, AVATAR_MSG.corrupt)).toBeVisible(); // UAP:179,556
      await expect.soft(dialog).toHaveCount(0);
      expect.soft(put.hits(), 'a read fault sends nothing').toBe(before);
      await expect.soft(page.getByRole('dialog', { name: AVATAR.setTitle })).toHaveCount(0);
      await captureEvidence(page, ev('33P-C-022', 'filereader-fault'));
    });
  } finally {
    await stopRoute().catch(() => undefined);
    await closeP3Session(s);
  }
});
