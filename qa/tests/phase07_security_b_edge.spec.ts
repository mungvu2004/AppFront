/**
 * Phase 7 SCR-33 "Mật khẩu" (QA-07b pack P8): FL-33S-05 (real 429 + 60 s lock, page.clock), FL-33S-06 (roles + loading),
 * FL-33S-07 (content edges + session revoked elsewhere). Plan: QA-07b/flows-C3.md, copy/lines: catalog-C3.md.
 * Source abbreviations: PWS PasswordSection.tsx, UAA useAccountAuth.ts, AAG accountAuthGateway.ts (src/screens/account/AccountSettings/),
 * HC src/lib/http/client.ts, MR AppBack apps/api/me/router.py.
 *
 * ## Request budget per run (BE limits; pool users, never E2E_ADMIN)
 * - `POST /api/me/password` (`me_password` 5 / 900 s per user, counted before body validation, MR:225):
 *   FL-33S-05 spends the whole bucket (5 wrong + 6th 429 + 1 more 429 = 7 sent, 6 counted) on a FRESH user per run (fixed slot, suffix `-r<retry>` only on a retry: a retry inside 900 s would exceed 5 / 900 s; FL-33S-06/07 use the same rule),
 *   nothing to restore. FL-33S-06: 2 per user (change, restore) x 3 users. FL-33S-07: content user 4 (spaces, 256 chars, astral 422,
 *   restore), revoke user 2 (B change, restore; A's POST dies at 401 before the limiter).
 * - `POST /api/auth/login`: admin 1 per flow, each pool user 1 per session (+ restore: 1 login + 1 probe; FL-33S-07 login probes 3, one 401).
 * - `POST /api/users/invitations`: at most 1 per pool slot when empty (FL-33S-05 slot is new every run).
 */
import { expect, test } from '@playwright/test';

import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { newApiContext, signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { attachJson } from './support/evidence';
import { poolUser } from './support/phase03Seed';
import { PASSWORD_API, PW, fieldError, holdResponse, pwField, pwSubmit, recordWrites } from './support/p07/account';
import {
  COPY,
  PWD_RE,
  advanceTo,
  changeViaUi,
  fillPasswords,
  freshPassword,
  newSession,
  openSecurity,
  pageNow,
  regionOf,
  restorePassword,
  settle,
  slotOf,
  shot,
} from './support/p07/P8';

const CHANGED = PW.changed;

/** Admin API (pool invitations only). */
async function adminApi(): Promise<Awaited<ReturnType<typeof signedInApi>>> {
  const { email, password } = readAdminCredentials();
  return signedInApi(email, password);
}

/** `POST /api/auth/login` status for exactly this password string. */
async function loginStatus(email: string, password: string): Promise<number> {
  const anon = await newApiContext();
  try {
    return (await anon.post('/api/auth/login', { data: { email, password, rememberMe: false } })).status();
  } finally {
    await anon.dispose();
  }
}

/* ================================================================= FL-33S-05 */

test('SCR-33 · FL-33S-05 · 6th attempt in 900 s: real 429, lock 60 s, re-lock (page.clock)', async ({ browser }) => {
  test.setTimeout(Math.max(120_000, 2 * 90_000));
  const admin = await adminApi();
  const user = await poolUser(admin, 'engineer', slotOf('p07-security-5')); // the 5 / 900 s bucket cannot be restored; a rerun after > 15 min finds it expired
  const { context, page } = await newSession(browser, user);
  const writes = recordWrites(page);
  try {
    const wrong = `Wrong-${freshPassword()}`;
    const next = freshPassword();
    let retryAfter: string | undefined;
    let lockedAt = 0;
    const alert = fieldError(page, COPY.rateLimited);

    await page.clock.install(); // lock = max(Retry-After, 60) s (UAA:208,430-436): the clock is run forward, never waited
    await openSecurity(page);

    await test.step('[33S-A-016] 6th submit in 900 s (5 earlier ones rejected): real 429', async () => {
      await fillPasswords(page, wrong, next, next);
      for (let i = 1; i <= 5; i += 1) {
        const rejected = waitForApi(page, 'POST', PWD_RE, [422]);
        await pwSubmit(page).click();
        const res = await rejected;
        expect(JSON.stringify(res.json), `attempt ${String(i)}`).toContain('CURRENT_PASSWORD_INCORRECT');
        await expect(pwSubmit(page)).toBeEnabled();
      }
      const limited = waitForApi(page, 'POST', PWD_RE, [429]);
      await pwSubmit(page).click(); // UAA:427-437, MR:45-46,225
      const res = await limited;
      retryAfter = res.response.headers()['retry-after'];
      expect(JSON.stringify(res.json)).toContain('RATE_LIMITED');
      await expect(alert).toBeVisible();
      await expect(pwSubmit(page)).toBeDisabled();
      lockedAt = await pageNow(page);
      await shot(page, 'A-016', 'ratelimit');
    });

    await test.step('[33S-G-004] 429 RATE_LIMITED with Retry-After 1..10', async () => {
      expect.soft(retryAfter, 'Retry-After header present').toBeDefined();
      expect.soft(Number(retryAfter)).toBeGreaterThanOrEqual(1);
      expect.soft(Number(retryAfter)).toBeLessThanOrEqual(10);
      await attachJson('E07_33S-G-004_ratelimit.json', { retryAfter: retryAfter ?? null });
      await shot(page, 'G-004', 'ratelimit');
    });

    await test.step('[33S-B-010] 429 summary is an attention InlineAlert (role=alert) between the fields and the button', async () => {
      await expect.soft(alert).toHaveCount(1); // PWS:187-189
      const order = await regionOf(page).evaluate((section, text) => {
        const form = section.querySelector('form');
        const kids = [...(form?.children ?? [])];
        const idx = (match: (el: Element) => boolean): number => kids.findIndex(match);
        return {
          confirm: idx((el) => el.querySelector('input[autocomplete="new-password"]') !== null && el.textContent?.includes('Nhắc lại') === true),
          alert: idx((el) => el.getAttribute('role') === 'alert' && el.textContent?.includes(text) === true),
          button: idx((el) => el.querySelector('button[type="submit"]') !== null),
        };
      }, COPY.rateLimited);
      expect.soft(order.alert, 'alert after the confirm field').toBeGreaterThan(order.confirm);
      expect.soft(order.alert, 'alert before the button row').toBeLessThan(order.button);
      await expect.soft(alert).toHaveClass(/border-state-attention/u); // InlineAlert.tsx:33 level attention
      await shot(page, 'B-010', 'ratelimit');
    });

    await test.step('[33S-B-013] Lock state: button disabled and alert visible together', async () => {
      await expect.soft(pwSubmit(page)).toBeDisabled(); // UAA:653-658
      await expect.soft(alert).toBeVisible();
      await shot(page, 'B-013', 'ratelimit');
    });

    await test.step('[33S-A-017] While locked, the fields stay editable and keep their values', async () => {
      const current = pwField(page, PW.current);
      await current.pressSequentially('x'); // UAA:379,653-658 isLocked gates submit only
      await expect.soft(current).toHaveValue(`${wrong}x`);
      await expect.soft(pwField(page, PW.next)).toHaveValue(next);
      await expect.soft(pwField(page, PW.confirm)).toHaveValue(next);
      await expect.soft(alert).toBeVisible();
      await expect.soft(pwSubmit(page)).toBeDisabled();
      await shot(page, 'A-017', 'ratelimit');
    });

    await test.step('[33S-A-018] While locked, Enter in a field sends nothing', async () => {
      const before = writes.list().length;
      await pwField(page, PW.next).press('Enter'); // UAA:379
      await settle(page);
      expect.soft(writes.list().length, 'no new POST while locked').toBe(before);
      await shot(page, 'A-018', 'ratelimit');
    });

    await test.step('[33S-A-019] After 60 s the lock lifts (fake clock)', async () => {
      await advanceTo(page, lockedAt, 58_000);
      await expect.soft(pwSubmit(page), 'still locked at +58 s').toBeDisabled();
      await advanceTo(page, lockedAt, 62_000); // UAA:430-436
      await expect.soft(alert).toHaveCount(0);
      await expect.soft(pwSubmit(page)).toBeEnabled();
      await expect.soft(pwField(page, PW.next)).toHaveValue(next);
      await shot(page, 'A-019', 'ratelimit');
    });

    await test.step('[33S-A-020] ⚑ After the BE answered 429 the button stays locked until the BE window ends, or the next POST is not 429', async () => {
      // Correct behaviour (decided in S4 review): the FE lock must respect the BE window (900 s, MR:45-46). Today it re-opens at +60 s
      // (UAA:208,430-436) and the next POST is a real 429 again -> red until fixed.
      if (await pwSubmit(page).isEnabled()) {
        const answered = waitForApi(page, 'POST', PWD_RE, [204, 422, 429]);
        await pwSubmit(page).click();
        const res = await answered;
        expect.soft(res.response.status(), 'a re-opened button must not meet 429 again').not.toBe(429);
      } else {
        await expect.soft(pwSubmit(page)).toBeDisabled();
      }
      await shot(page, 'A-020', 'ratelimit');
    });
  } finally {
    writes.stop();
    await context.close();
    await admin.dispose();
  }
});

/* ================================================================= FL-33S-06 */

test('SCR-33 · FL-33S-06 · roles: viewer (held request shows loading) / admin / engineer each change their own password', async ({ browser }) => {
  test.setTimeout(Math.max(120_000, 2 * 130_000));
  const admin = await adminApi();
  const viewer = await poolUser(admin, 'viewer', slotOf('p07-security-6v'));
  const second = await poolUser(admin, 'admin', slotOf('p07-security-6a')); // a second admin, NOT E2E_ADMIN
  const engineer = await poolUser(admin, 'engineer', slotOf('p07-security-6e'));
  const current = { viewer: viewer.password, admin: second.password, engineer: engineer.password };
  const vs = await newSession(browser, viewer);
  const as = await newSession(browser, second);
  const es = await newSession(browser, engineer);
  const viewerNew = freshPassword();
  let changed: ReturnType<typeof waitForApi> | undefined;
  let hold: Awaited<ReturnType<typeof holdResponse>> | undefined;
  try {
    await test.step('[33S-D-003] Viewer changes own password (block visible and enabled; POST is sent)', async () => {
      const { page } = vs;
      await openSecurity(page);
      hold = await holdResponse(page, '**/api/me/password', 'POST'); // the REAL answer is delayed, not mocked
      await fillPasswords(page, viewer.password, viewerNew, viewerNew);
      await expect.soft(regionOf(page)).toBeVisible(); // no role gate
      await expect.soft(pwSubmit(page)).toBeEnabled();
      changed = waitForApi(page, 'POST', PWD_RE, [204]);
      await pwSubmit(page).click();
      const req = await hold.seen;
      current.viewer = viewerNew; // the real request reached the BE: restore from the new password if anything below fails
      expect.soft(req.method()).toBe('POST');
      await shot(page, 'D-003', 'viewer');
      // The 204 + success alert of this same POST are asserted right after the release, in the next step.
    });

    await test.step('[33S-B-008] Loading: request in flight (spinner button and the three inputs disabled)', async () => {
      const { page } = vs;
      await expect(pwSubmit(page)).toBeDisabled(); // PWS:161,172,184,199-200, UAA:396-398
      await expect(pwSubmit(page).locator('svg.animate-spin')).toBeVisible(); // Button.tsx:87-88 spinner
      await expect(pwField(page, PW.current)).toBeDisabled();
      await expect(pwField(page, PW.next)).toBeDisabled();
      await expect(pwField(page, PW.confirm)).toBeDisabled();
      await shot(page, 'B-008', 'viewer');
      await hold?.release();
      await changed;
      await expect.soft(page.getByRole('alert').filter({ hasText: CHANGED })).toBeVisible(); // D-003 outcome
    });

    const adminNew = freshPassword();
    await test.step('[33S-D-001] Admin changes own password', async () => {
      const { page } = as;
      await openSecurity(page);
      await changeViaUi(page, second.password, adminNew); // no role check in MR:155-244
      current.admin = adminNew;
      await expect.soft(page.getByRole('alert').filter({ hasText: CHANGED })).toBeVisible();
      await shot(page, 'D-001', 'viewer');
    });

    const engineerNew = freshPassword();
    await test.step('[33S-D-002] Engineer changes own password', async () => {
      const { page } = es;
      await openSecurity(page);
      await changeViaUi(page, engineer.password, engineerNew);
      current.engineer = engineerNew;
      await expect.soft(page.getByRole('alert').filter({ hasText: CHANGED })).toBeVisible();
      await shot(page, 'D-002', 'viewer');
    });
  } finally {
    await hold0(vs.page, hold);
    await restorePassword(viewer, current.viewer);
    await restorePassword(second, current.admin);
    await restorePassword(engineer, current.engineer);
    await Promise.all([vs.context.close(), as.context.close(), es.context.close()]);
    await admin.dispose();
  }
});

/** Lets a still-held request go (failed step) so closing the context does not leave a pending route. */
async function hold0(page: import('@playwright/test').Page, hold: Awaited<ReturnType<typeof holdResponse>> | undefined): Promise<void> {
  await hold?.release().catch(() => undefined);
  await page.unrouteAll({ behavior: 'ignoreErrors' });
}

/* ================================================================= FL-33S-07 */

test('SCR-33 · FL-33S-07 · content edges (spaces, 256 chars, astral characters) and a session revoked elsewhere', async ({ browser }) => {
  test.setTimeout(Math.max(120_000, 2 * 150_000));
  const admin = await adminApi();
  const user = await poolUser(admin, 'engineer', slotOf('p07-security-7'));
  const revoked = await poolUser(admin, 'engineer', slotOf('p07-security-7r'));
  const content = await newSession(browser, user);
  const sessionA = await newSession(browser, revoked); // page session A of the revoke user
  let currentContent = user.password;
  let currentRevoked = revoked.password;
  let sessionB: Awaited<ReturnType<typeof signedInApi>> | undefined;
  try {
    const { page } = content;
    await openSecurity(page);
    const spaced = ' Qa Pw 12 ';
    const long = 'Aa1'.repeat(86).slice(0, 256);
    const astral = `Aaa1${'\u{1F600}'.repeat(2)}`; // 6 code points, 8 UTF-16 units

    await test.step('[33S-C-008] Passwords are sent verbatim (no trim), spaces at the edges allowed', async () => {
      await changeViaUi(page, currentContent, spaced);
      currentContent = spaced;
      await expect.soft(page.getByRole('alert').filter({ hasText: CHANGED })).toBeVisible();
      expect(await loginStatus(user.email, spaced), 'exact string signs in').toBe(204);
      expect(await loginStatus(user.email, spaced.trim()), 'trimmed string is refused').toBe(401);
      await shot(page, 'C-008', 'content');
    });

    await test.step('[33S-C-009] Very long password (256 chars): no maximum', async () => {
      await changeViaUi(page, currentContent, long);
      currentContent = long;
      await expect.soft(page.getByRole('alert').filter({ hasText: CHANGED })).toBeVisible();
      expect.soft(await loginStatus(user.email, long), 'login with 256 chars').toBe(204);
      await shot(page, 'C-009', 'content');
    });

    await test.step('[33S-C-010] ⚑ Astral characters: FE must count code points and block a 6-code-point password', async () => {
      const writes = recordWrites(page);
      try {
        await fillPasswords(page, currentContent, astral, astral);
        await pwSubmit(page).click();
        // Settled when either the local message (correct) or the unavailable alert (today, after BE 422) is shown.
        await expect(page.getByRole('alert').filter({ hasText: new RegExp(`${PW.tooShort}|${COPY.unavailable}`, 'u') }).first()).toBeVisible();
        await expect.soft(fieldError(page, PW.tooShort), 'FE blocks it as too short').toBeVisible();
        expect.soft(writes.list().filter((w) => w === `POST ${PASSWORD_API}`), 'no request for a 6-code-point password').toHaveLength(0);
        await shot(page, 'C-010', 'content');
      } finally {
        writes.stop();
      }
    });

    await test.step('[33S-G-005] ⚑ 401 on a revoked session during submit: refresh fails, user ends on /login, no stuck spinner', async () => {
      const a = sessionA.page;
      await openSecurity(a);
      sessionB = await signedInApi(revoked.email, revoked.password); // second session of the same user
      const bNew = freshPassword();
      const done = await sessionB.post(PASSWORD_API, { data: { currentPassword: revoked.password, newPassword: bNew } });
      expect(done.status(), 'B changes the password (A is revoked, MR:217)').toBe(204);
      currentRevoked = bNew;
      const aNew = freshPassword();
      await fillPasswords(a, revoked.password, aNew, aNew);
      const flashed: string[] = [];
      await a.exposeFunction('__qaSawUnavailable', (text: string) => void flashed.push(text));
      await a.evaluate((text) => {
        new MutationObserver(() => {
          if ([...document.querySelectorAll('[role="alert"]')].some((el) => el.textContent?.includes(text) === true)) void (window as unknown as { __qaSawUnavailable: (t: string) => void }).__qaSawUnavailable(text);
        }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
      }, COPY.unavailable);
      const rejected = waitForApi(a, 'POST', PWD_RE, [401]);
      await pwSubmit(a).click();
      const res = await rejected; // HC:459-466 one refresh try, then SESS:218-233 clears the session
      await attachJson('E07_33S-G-005_content.json', { status: res.response.status(), body: JSON.stringify(res.json).slice(0, 200) });
      await expect.soft(a, 'ends on /login').toHaveURL(/\/login/u, { timeout: 30_000 });
      expect.soft(flashed, 'the "Không đổi được…" alert never flashed before the redirect (AAG:191 vs SESS:218-233)').toHaveLength(0);
      await shot(a, 'G-005', 'content');
    });
  } finally {
    await sessionB?.dispose();
    await restorePassword(user, currentContent);
    await restorePassword(revoked, currentRevoked);
    await Promise.all([content.context.close(), sessionA.context.close()]);
    await admin.dispose();
  }
});
