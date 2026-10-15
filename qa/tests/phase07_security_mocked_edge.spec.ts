/**
 * Phase 7 SCR-33 "Mật khẩu", MOCKED branches (QA-07b pack P8): FL-33S-08. Plan: QA-07b/flows-C3.md; copy/lines: catalog-C3.md.
 *
 * ## Mocks ("[mocked response]" in the title; each has its real pairing)
 * `page.route(/api/me/password)` fulfils the designed N13 answer ONCE per queued entry, then `route.continue()` reaches the real BE:
 * 503 DEPENDENCY_UNAVAILABLE, aborted request, 422 VALIDATION, 429 without code, 429 + Retry-After 120. Pairing: 422 CURRENT_PASSWORD_INCORRECT
 * = FL-33S-03, 204 = FL-33S-04, real 429 = FL-33S-05 (5xx / network / Retry-After 120 are not creatable: Redis/hash executor down, BE clamps 1..10).
 *
 * ## Request budget per run
 * - `POST /api/me/password` (me_password 5 / 900 s): real ones only: wrong current (A-023), success (A-024), wrong current (A-024 suffix check),
 *   restore = 4 (flows said 3; the "next wrong-current has no suffix" check is a 4th real POST). Mocked answers never reach the BE.
 * - `POST /api/auth/login`: admin 1, pool user 1, restore 1 + probe 1. Pool slot `p07-security-8`: invitation only when empty.
 */
import { expect, test } from '@playwright/test';

import { signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { poolUser } from './support/phase03Seed';
import { PW, fieldError, pwField, pwSubmit } from './support/p07/account';
import {
  COPY,
  abortRequest,
  advanceTo,
  designedAnswers,
  fillPasswords,
  freshPassword,
  newSession,
  openSecurity,
  pageNow,
  regionOf,
  respond,
  restorePassword,
  settle,
  slotOf,
  shot,
} from './support/p07/P8';

test('SCR-33 · FL-33S-08 · [mocked response] 5xx / network / 429 / 422 VALIDATION / Retry-After, with real continuation', async ({ browser }) => {
  test.setTimeout(Math.max(120_000, 2 * 100_000));
  const { email, password } = readAdminCredentials();
  const admin = await signedInApi(email, password);
  const user = await poolUser(admin, 'engineer', slotOf('p07-security-8'));
  const { context, page } = await newSession(browser, user);
  let current = user.password;
  let answers: Awaited<ReturnType<typeof designedAnswers>> | undefined;
  try {
    const routed = await designedAnswers(page);
    answers = routed;
    await page.clock.install(); // the 60 s / 120 s locks are run forward, never waited
    await openSecurity(page);
    const unavailable = fieldError(page, COPY.unavailable);
    const limited = fieldError(page, COPY.rateLimited);
    const next = freshPassword();
    const wrong = `Wrong-${freshPassword()}`;

    await test.step('[33S-A-021] 5xx (503) on submit: unavailable alert, fields keep values, button enabled', async () => {
      await fillPasswords(page, current, next, next);
      routed.once(respond(503, { code: 'DEPENDENCY_UNAVAILABLE' }));
      await pwSubmit(page).click(); // UAA:441-442
      await expect.soft(unavailable).toBeVisible();
      await expect.soft(pwField(page, PW.current)).toHaveValue(current);
      await expect.soft(pwField(page, PW.next)).toHaveValue(next);
      await expect.soft(pwField(page, PW.confirm)).toHaveValue(next);
      await expect.soft(pwSubmit(page)).toBeEnabled();
      await shot(page, 'A-021', 'mock');
    });

    await test.step('[33S-C-015] Client does not retry the POST on 5xx even with Retry-After', async () => {
      const before = routed.hits();
      routed.once(respond(503, { code: 'DEPENDENCY_UNAVAILABLE' }, { 'Retry-After': '5' }));
      await pwSubmit(page).click(); // RT:34-35 POST without Idempotency-Key is not retryable
      await expect.soft(unavailable).toBeVisible();
      await page.clock.runFor(10_000); // past Retry-After
      await settle(page);
      expect.soft(routed.hits() - before, 'exactly one request per submit').toBe(1);
      await shot(page, 'C-015', 'mock');
    });

    await test.step('[33S-A-023] Wrong current right after an unavailable answer: suffix "Có thể mật khẩu đã đổi…"', async () => {
      await pwField(page, PW.current).fill(wrong);
      await pwSubmit(page).click(); // real 422 (route.continue)
      await expect.soft(page.getByText(`${PW.currentWrong} ${COPY.afterFailure}`, { exact: true })).toBeVisible(); // UAA:337,403,417-421
      await expect.soft(pwField(page, PW.current)).toHaveAttribute('aria-invalid', 'true');
      await shot(page, 'A-023', 'mock');
    });

    await test.step('[33S-A-022] Network failure (request aborted) on submit: unavailable alert', async () => {
      routed.once(abortRequest);
      await pwSubmit(page).click();
      await expect.soft(unavailable).toBeVisible(); // http network error -> AAG:191
      await shot(page, 'A-022', 'mock');
    });

    await test.step('[33S-A-024] Success right after an unavailable answer; the next wrong-current has no suffix', async () => {
      await pwField(page, PW.current).fill(current);
      await pwSubmit(page).click(); // real 204
      await expect.soft(page.getByRole('alert').filter({ hasText: PW.changed })).toBeVisible();
      current = next; // the real password changed; restored in finally
      await shot(page, 'A-024', 'mock');
      const again = freshPassword();
      await fillPasswords(page, wrong, again, again);
      await pwSubmit(page).click(); // real 422, flag reset (UAA:403-405)
      await expect.soft(page.getByText(PW.currentWrong, { exact: true })).toBeVisible();
      await expect.soft(page.getByText(COPY.afterFailure)).toHaveCount(0);
    });

    await test.step('[33S-C-013] Server 422 VALIDATION (not the wrong-current code) is mapped to "unavailable"', async () => {
      const again = freshPassword();
      await fillPasswords(page, current, again, again);
      routed.once(respond(422, { code: 'VALIDATION', field: 'newPassword' }));
      await pwSubmit(page).click();
      await expect.soft(unavailable).toBeVisible(); // AAG:191
      await expect.soft(pwField(page, PW.current)).not.toHaveAttribute('aria-invalid', 'true');
      await expect.soft(regionOf(page).getByRole('alert'), 'only the summary alert, no field error').toHaveCount(1);
      await shot(page, 'C-013', 'mock');
    });

    await test.step('[33S-C-012] 429 recognised by status alone (body without code): same alert and lock', async () => {
      routed.once(respond(429, {}));
      const before = routed.hits();
      await pwSubmit(page).click(); // AAG:179 wire.status === 429
      await expect.soft(limited).toBeVisible();
      await expect.soft(pwSubmit(page)).toBeDisabled();
      const lockedAt = await pageNow(page);
      await shot(page, 'C-012', 'mock');
      await advanceTo(page, lockedAt, 62_000);
      await expect.soft(pwSubmit(page), 'locked at +62 s (Q5: lock is the 900 s BE window)').toBeDisabled();
      await advanceTo(page, lockedAt, 898_000);
      await expect.soft(pwSubmit(page), 'locked at +898 s').toBeDisabled();
      await advanceTo(page, lockedAt, 902_000);
      await expect.soft(pwSubmit(page), 'open after 900 s').toBeEnabled();
      await expect.soft(limited).toHaveCount(0);
      expect.soft(routed.hits() - before, 'one request, no client retry on 429').toBe(1);
    });

    await test.step('[33S-C-011] Lock length is max(Retry-After, 900 s) (Q5): Retry-After 1000 opens at +1000 s', async () => {
      routed.once(respond(429, { code: 'RATE_LIMITED' }, { 'Retry-After': '1000' }));
      await pwSubmit(page).click(); // UAA:208,430-436
      await expect.soft(limited).toBeVisible();
      const lockedAt = await pageNow(page);
      await shot(page, 'C-011', 'mock');
      await advanceTo(page, lockedAt, 998_000);
      await expect.soft(pwSubmit(page), 'still locked at +998 s').toBeDisabled();
      await advanceTo(page, lockedAt, 1_002_000);
      await expect.soft(pwSubmit(page), 'open at +1000 s').toBeEnabled();
      await expect.soft(limited).toHaveCount(0);
    });

  } finally {
    await answers?.stop().catch(() => undefined);
    await restorePassword(user, current);
    await context.close();
    await admin.dispose();
  }
});
