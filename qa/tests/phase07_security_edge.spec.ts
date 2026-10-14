/**
 * Phase 7 — EDGE flows, SCR-33 "Mật khẩu" block of `/tai-khoan` (QA-07b P7): FL-33S-01 .. FL-33S-04 of `flows-C3.md`.
 * One `test()` per flow, one `test.step('[<id>] …')` per catalog row, in flow order. Real stack, no mock.
 * ⚑ rows (33S-E-006, 33S-E-007) assert the CORRECT behaviour and stay red until the FE is fixed.
 *
 * Short names (FE master 1e1c16b7, under `src/screens/account/AccountSettings/`): PWS PasswordSection.tsx,
 * UAA useAccountAuth.ts, AAG accountAuthGateway.ts, AS AccountSettings.tsx, PS ProfileSection.tsx;
 * INP src/components/ui/Input.tsx, ALERT src/components/feedback/InlineAlert.tsx; MR BE:apps/api/me/router.py.
 *
 * Request budget per run (own pool engineer per flow, slots p07-security-1..4; `--workers 4` safe):
 * - `POST /api/auth/login`: admin API 1 + browser 1 per flow; FL-33S-04 +1 "other session" +2 probes (new, old password)
 *   +1 restore session +1 probe; FL-33S-03 +1 restore session +1 probe. LOGIN_IP_LIMIT 120 / 60 s is far away.
 * - `PATCH /api/me`, `PUT /api/me/avatar`: none (FL-33S-01/02 send no write at all).
 * - `POST /api/me/password` (me_password 5 / 900 s per user): FL-33S-01 0, FL-33S-02 0, FL-33S-03 4 (wrong, wrong,
 *   success, restore), FL-33S-04 3 (wrong for the secret-hygiene failure leg, success, restore).
 * - `POST /api/auth/refresh` 300 / 60 s per session: 1 per page load and per `meApi` call — a few per flow.
 */
import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { newApiContext, signedInApi } from './support/api';
import { captureEvidence } from './support/evidence';
import { ME_RE, PASSWORD_API, PW, heading, meApi, pwField, pwSubmit, recordWrites } from './support/p07/account';
import {
  PASSWORD_RE,
  TONE,
  collectSecrets,
  errorOf,
  fillPasswords,
  meterText,
  meterTones,
  openSecurity,
  regionOf,
  restorePassword,
  submitPassword,
  withSecurityUser,
} from './support/p07/P7';

const pathOf = (url: string): string => new URL(url).pathname;

test.describe('SCR-33 security edge', () => {
  test('SCR-33 · FL-33S-01 · local validation and strength meter (no request)', async ({ browser }) => {
    await withSecurityUser(browser, 'p07-security-1', async ({ page }) => {
      await openSecurity(page);
      const region = regionOf(page);
      const current = pwField(page, PW.current);
      const next = pwField(page, PW.next);
      const confirm = pwField(page, PW.confirm);
      const writes = recordWrites(page);
      try {
        await test.step('[33S-A-001] open /tai-khoan: the "Mật khẩu" block shows three empty fields and the button', async () => {
          // AS:150-157, PWS:153-204
          await expect(region.getByRole('heading', { level: 2, name: 'Mật khẩu', exact: true })).toBeVisible();
          await expect(region.getByText('Đổi mật khẩu đăng nhập.', { exact: true })).toBeVisible();
          for (const label of [PW.current, PW.next, PW.confirm]) {
            await expect(region.getByLabel(label, { exact: true })).toBeVisible();
            await expect(region.getByLabel(label, { exact: true })).toHaveValue('');
            await expect(region.getByLabel(label, { exact: true })).toHaveAttribute('type', 'password');
          }
          await expect(region.getByRole('button', { name: PW.submit, exact: true })).toBeVisible();
          await captureEvidence(page, 'E07_33S-A-001_local.png');
        });

        await test.step('[33S-B-001] initial state of the block', async () => {
          // UAA:327-334,653-658
          for (const field of [current, next, confirm]) await expect.soft(field).toHaveValue('');
          await expect.soft(meterText(page)).toHaveCount(0);
          await expect.soft(region.getByRole('alert')).toHaveCount(0);
          await expect.soft(pwSubmit(page)).toBeDisabled();
          await captureEvidence(page, 'E07_33S-B-001_local.png');
        });

        await test.step('[33S-B-005] strength meter hidden when empty, follows the typing live', async () => {
          // PWS:174, UAA:181-183
          await expect.soft(meterText(page)).toHaveCount(0);
          await next.fill('a');
          await expect.soft(meterText(page)).toHaveText('Độ mạnh: yếu');
          await next.fill('Abcdefg1');
          await expect.soft(meterText(page)).toHaveText('Độ mạnh: khá');
          await next.fill('Abcdefghijk1');
          await expect.soft(meterText(page)).toHaveText('Độ mạnh: mạnh');
          await next.fill('');
          await expect.soft(meterText(page)).toHaveCount(0);
          await captureEvidence(page, 'E07_33S-B-005_local.png');
        });

        await test.step('[33S-B-002] strength meter: weak', async () => {
          // PWS:74,107-128, UAA:186-188
          for (const value of ['abc1', 'abcdefgh', '12345678']) {
            await next.fill(value);
            await expect.soft(meterText(page), value).toHaveText(PW.strength('yếu'));
            expect.soft(await meterTones(page), `cells for ${value}`).toEqual([TONE.weak, TONE.off, TONE.off]);
          }
          await captureEvidence(page, 'E07_33S-B-002_local.png');
        });

        await test.step('[33S-B-003] strength meter: fair', async () => {
          // PWS:75, UAA:190
          for (const value of ['Abcdefg1', 'Abcdefg12', 'Abcdefghij1']) {
            await next.fill(value);
            await expect.soft(meterText(page), value).toHaveText(PW.strength('khá'));
            expect.soft(await meterTones(page), `cells for ${value}`).toEqual([TONE.fair, TONE.fair, TONE.off]);
          }
          await captureEvidence(page, 'E07_33S-B-003_local.png');
        });

        await test.step('[33S-B-004] strength meter: strong', async () => {
          // PWS:76, UAA:121,190
          await next.fill('Abcdefghijk1');
          await expect.soft(meterText(page)).toHaveText(PW.strength('mạnh'));
          expect.soft(await meterTones(page)).toEqual([TONE.strong, TONE.strong, TONE.strong]);
          await captureEvidence(page, 'E07_33S-B-004_local.png');
        });

        await test.step('[33S-B-006] field errors stay hidden until the first submit', async () => {
          // UAA:649-651 hasSubmitted false
          await fillPasswords(page, 'Qa-Current1', 'abc1', 'x');
          await expect.soft(meterText(page)).toHaveText(PW.strength('yếu')); // the form has rendered the typing
          await expect.soft(region.getByRole('alert')).toHaveCount(0);
          await expect.soft(pwSubmit(page)).toBeEnabled();
          await submitPassword(page);
          await expect.soft(page.getByText(PW.tooShort, { exact: true })).toBeVisible();
          await captureEvidence(page, 'E07_33S-B-006_local.png');
        });

        await test.step('[33S-C-002] new password shorter than 8', async () => {
          // UAA:82,163-165
          await fillPasswords(page, 'Qa-Current1', 'abc1', 'abc1');
          await expect.soft(page.getByText(PW.tooShort, { exact: true })).toBeVisible();
          await fillPasswords(page, 'Qa-Current1', 'Abcdef1', 'Abcdef1');
          await expect.soft(page.getByText(PW.tooShort, { exact: true })).toBeVisible();
          await fillPasswords(page, 'Qa-Current1', 'Abcdefg1', 'Abcdefg1');
          await expect.soft(meterText(page)).toHaveText(PW.strength('khá'));
          await expect.soft(page.getByText(PW.tooShort, { exact: true })).toHaveCount(0);
          expect.soft(writes.list(), 'no request').toEqual([]);
          await captureEvidence(page, 'E07_33S-C-002_local.png');
        });

        await test.step('[33S-C-003] new password without a digit or without a letter', async () => {
          // UAA:136-139,167-169
          for (const value of ['abcdefgh', '12345678', '        ']) {
            await fillPasswords(page, 'Qa-Current1', value, value);
            await expect.soft(page.getByText(PW.letterDigit, { exact: true }), JSON.stringify(value)).toBeVisible();
          }
          await fillPasswords(page, 'Qa-Current1', 'Mậtkhẩu1', 'Mậtkhẩu1'); // Unicode letters + digit
          await expect.soft(meterText(page)).toHaveText(PW.strength('khá'));
          await expect.soft(page.getByText(PW.letterDigit, { exact: true })).toHaveCount(0);
          expect.soft(writes.list(), 'no request').toEqual([]);
          await captureEvidence(page, 'E07_33S-C-003_local.png');
        });

        await test.step('[33S-C-004] new password equal to the current one', async () => {
          // UAA:372-375,388
          await fillPasswords(page, 'Qa-Current1', 'Qa-Current1', 'Qa-Current1');
          await expect.soft(page.getByText(PW.sameAsCurrent, { exact: true })).toBeVisible();
          await expect.soft(await errorOf(page, PW.next)).toHaveText(PW.sameAsCurrent);
          await captureEvidence(page, 'E07_33S-C-004_local.png');
        });

        await test.step('[33S-C-005] confirm differs (case and a trailing space count)', async () => {
          // UAA:376,389
          await fillPasswords(page, 'Qa-Current1', 'Abcdefg12', 'abcdefg12');
          await expect.soft(await errorOf(page, PW.confirm)).toHaveText(PW.mismatch);
          await confirm.fill('Abcdefg12 ');
          await expect.soft(await errorOf(page, PW.confirm)).toHaveText(PW.mismatch);
          await confirm.fill('Abcdefg12');
          await expect.soft(page.getByText(PW.mismatch, { exact: true })).toHaveCount(0);
          await captureEvidence(page, 'E07_33S-C-005_local.png');
        });

        await test.step('[33S-C-006] several local problems at once', async () => {
          // UAA:386-389,650-651
          await fillPasswords(page, 'abc1', 'abc1', 'abc2');
          await expect.soft(await errorOf(page, PW.next)).toHaveText(PW.tooShort);
          await expect.soft(await errorOf(page, PW.confirm)).toHaveText(PW.mismatch);
          await expect.soft(page.getByText(PW.sameAsCurrent, { exact: true })).toHaveCount(0);
          await captureEvidence(page, 'E07_33S-C-006_local.png');
        });

        await test.step('[33S-C-007] same-as-current only when the new password is otherwise valid', async () => {
          // UAA:650
          await fillPasswords(page, 'abc1', 'abc1', 'abc1');
          await expect.soft(page.getByText(PW.tooShort, { exact: true })).toBeVisible();
          await expect.soft(page.getByText(PW.sameAsCurrent, { exact: true })).toHaveCount(0);
          await captureEvidence(page, 'E07_33S-C-007_local.png');
        });

        await test.step('[33S-B-007] after a submit, the new field is cleared', async () => {
          // zod too_small minimum 1, UAA:163-172,650
          await fillPasswords(page, 'Qa-Current1', '', '');
          await expect.soft(await errorOf(page, PW.next)).toHaveText('Chưa nhập mật khẩu mới.');
          await expect.soft(pwSubmit(page)).toBeDisabled();
          await captureEvidence(page, 'E07_33S-B-007_local.png');
        });

        await test.step('[33S-C-001] after a submit, clearing "Mật khẩu hiện tại"', async () => {
          // UAA:644-646,653
          await fillPasswords(page, '', 'Qa-Next1234', 'Qa-Next1234');
          await expect.soft(await errorOf(page, PW.current)).toHaveText(PW.currentRequired);
          await expect.soft(pwSubmit(page)).toBeDisabled();
          expect.soft(writes.list(), 'no request in the whole flow').toEqual([]);
          await captureEvidence(page, 'E07_33S-C-001_local.png');
        });
      } finally {
        writes.stop();
      }
    });
  });

  test('SCR-33 · FL-33S-02 · keyboard, labels, aria, autosave never (no request)', async ({ browser }) => {
    await withSecurityUser(browser, 'p07-security-2', async ({ page }) => {
      await page.clock.install(); // B-012 jumps the 800 ms autosave debounce instead of waiting for it
      await openSecurity(page);
      const region = regionOf(page);
      const current = pwField(page, PW.current);
      const next = pwField(page, PW.next);
      const confirm = pwField(page, PW.confirm);
      const writes = recordWrites(page);
      try {
        await test.step('[33S-E-001] fields are reachable by label inside the labelled region', async () => {
          // AS:79, PWS:154-203
          await expect(region).toBeVisible();
          for (const label of [PW.current, PW.next, PW.confirm]) await expect(region.getByLabel(label, { exact: true })).toBeVisible();
          await expect(region.getByRole('button', { name: PW.submit, exact: true })).toBeVisible();
          await captureEvidence(page, 'E07_33S-E-001_keys.png');
        });

        await test.step('[33S-E-002] Tab order', async () => {
          // PWS:152-205: no eye toggle between the fields
          await fillPasswords(page, 'Qa-Current1', 'Abcdefg12', 'Abcdefg12');
          await current.focus();
          for (const stop of [next, confirm, pwSubmit(page)]) {
            await page.keyboard.press('Tab');
            await expect.soft(stop).toBeFocused();
          }
          for (const stop of [confirm, next, current]) {
            await page.keyboard.press('Shift+Tab');
            await expect.soft(stop).toBeFocused();
          }
          await captureEvidence(page, 'E07_33S-E-002_keys.png');
        });

        await test.step('[33S-E-005] password fields use the right autocomplete', async () => {
          // PWS:157,168,180
          await expect.soft(current).toHaveAttribute('autocomplete', 'current-password');
          await expect.soft(next).toHaveAttribute('autocomplete', 'new-password');
          await expect.soft(confirm).toHaveAttribute('autocomplete', 'new-password');
          await captureEvidence(page, 'E07_33S-E-005_keys.png');
        });

        await test.step('[33S-A-013] Enter in each filled field submits the form', async () => {
          // PWS:145-150; a fresh document per field so "no message yet" -> "messages" is a visible transition
          for (const label of [PW.current, PW.next, PW.confirm]) {
            await openSecurity(page);
            await fillPasswords(page, 'Qa-Current1', 'abc1', 'abc2');
            await expect.soft(region.getByRole('alert'), `before Enter in "${label}"`).toHaveCount(0);
            await pwField(page, label).press('Enter');
            await expect.soft(page.getByText(PW.tooShort, { exact: true }), `Enter in "${label}"`).toBeVisible();
            await expect.soft(page.getByText(PW.mismatch, { exact: true }), `Enter in "${label}"`).toBeVisible();
          }
          await captureEvidence(page, 'E07_33S-A-013_keys.png');
        });

        await test.step('[33S-A-014] Enter while a field is empty sends nothing', async () => {
          // PWS:196-203, UAA:653-658: the disabled default button blocks implicit submission
          await openSecurity(page);
          await fillPasswords(page, '', 'Abcdefg12', 'abc2');
          await expect.soft(pwSubmit(page)).toBeDisabled();
          await next.press('Enter');
          await expect.soft(region.getByRole('alert')).toHaveCount(0);
          await current.fill('Qa-Current1'); // marker: the form still reacts, and the Enter above left no message behind
          await expect.soft(pwSubmit(page)).toBeEnabled();
          await expect.soft(region.getByRole('alert')).toHaveCount(0);
          expect.soft(writes.list(), 'no request').toEqual([]);
          await captureEvidence(page, 'E07_33S-A-014_keys.png');
        });

        await test.step('[33S-E-008] Space on the focused submit button sends the form once', async () => {
          // type=submit, PWS:196-198
          await openSecurity(page);
          await fillPasswords(page, 'Qa-Current1', 'abc1', 'abc2');
          await page.locator('form').filter({ has: current }).evaluate((form) => {
            const holder = window as unknown as { __submits: number };
            holder.__submits = 0;
            form.addEventListener('submit', () => {
              holder.__submits += 1;
            });
          });
          await pwSubmit(page).focus();
          await page.keyboard.press('Space');
          await expect.soft(page.getByText(PW.tooShort, { exact: true })).toBeVisible();
          expect.soft(await page.evaluate(() => (window as unknown as { __submits: number }).__submits), 'submit events').toBe(1);
          await captureEvidence(page, 'E07_33S-E-008_keys.png');
        });

        await test.step('[33S-E-003] field errors are announced', async () => {
          // Input.tsx:91,99,117: role=alert, aria-describedby, aria-invalid
          await current.fill(''); // after the submit above: new + confirm + current problems
          const alerts = region.getByRole('alert');
          await expect.soft(alerts).toHaveCount(3);
          for (const label of [PW.current, PW.next, PW.confirm]) {
            const field = pwField(page, label);
            const error = await errorOf(page, label);
            await expect.soft(field, label).toHaveAttribute('aria-invalid', 'true');
            await expect.soft(error, label).toHaveAttribute('role', 'alert');
            await expect.soft(field, label).toHaveAttribute('aria-describedby', new RegExp(`${String(await field.getAttribute('id'))}-error`, 'u'));
          }
          await captureEvidence(page, 'E07_33S-E-003_keys.png');
        });

        await test.step('[33S-E-006] ⚑ strength meter readable without colour', async () => {
          // PWS:112,126 today; correct: the text is also announced while typing (aria-live) and linked to the new field
          const text = meterText(page);
          await expect.soft(text).toHaveText(PW.strength('yếu'));
          await expect.soft(text.locator('xpath=preceding-sibling::div[1]')).toHaveAttribute('aria-hidden', 'true');
          await expect.soft(text, 'meter text is a live region').toHaveAttribute('aria-live', /^(?:polite|assertive)$/u);
          const meterId = await text.getAttribute('id');
          expect.soft(meterId, 'meter text has an id the new field can point to').not.toBeNull();
          await expect.soft(next, 'new field is described by the meter').toHaveAttribute('aria-describedby', new RegExp(`(?:^|\\s)${String(meterId)}(?:\\s|$)`, 'u'));
          await captureEvidence(page, 'E07_33S-E-006_keys.png');
        });

        await test.step('[33S-E-009] global-shortcut characters are typed into the password fields', async () => {
          for (const field of [current, next, confirm]) {
            await field.fill('');
            await field.focus();
            await field.pressSequentially('g?/');
            await expect.soft(field).toHaveValue('g?/');
          }
          await expect.soft(page.getByRole('dialog')).toHaveCount(0);
          expect.soft(pathOf(page.url())).toBe(ROUTES.account);
          await captureEvidence(page, 'E07_33S-E-009_keys.png');
        });

        await test.step('[33S-B-012] the password is never auto-saved or sent while typing', async () => {
          // UAA:4-9: no AccountDraftPort; the fake clock jumps far past the 800 ms autosave debounce
          await fillPasswords(page, 'Qa-Current1', 'Abcdefg12', 'Abcdefg12');
          await page.clock.runFor(5_000);
          await page.evaluate(() => 0); // flush pending request events
          expect.soft(writes.list(), 'no PATCH /api/me, no POST /api/me/password').toEqual([]);
          await captureEvidence(page, 'E07_33S-B-012_keys.png');
        });
      } finally {
        writes.stop();
      }
    });
  });

  test('SCR-33 · FL-33S-03 · wrong current: 422, retry in place, double submit, then success', async ({ browser }) => {
    test.setTimeout(Math.max(120_000, 2 * 100_000));
    await withSecurityUser(browser, 'p07-security-3', async ({ user, context, page }) => {
      let changedTo: string | undefined;
      let nextPw = `Qa-${randomUUID()}`; // letters + digits, >= 8
      try {
        await openSecurity(page);
        const current = pwField(page, PW.current);
        const next = pwField(page, PW.next);
        const confirm = pwField(page, PW.confirm);
        const writes = recordWrites(page);
        const posts = (): string[] => writes.list().filter((line) => line === `POST ${PASSWORD_API}`);
        let rejected: { status: number; text: string } | undefined;

        await test.step('[33S-A-007] wrong current password: submit', async () => {
          // UAA:417-424, AAG:175-177
          await fillPasswords(page, `Wrong-${randomUUID()}`, nextPw, nextPw);
          const answer = waitForApi(page, 'POST', PASSWORD_RE, [422]);
          await submitPassword(page);
          const res = await answer;
          rejected = { status: res.response.status(), text: JSON.stringify(res.json) };
          expect(rejected.status).toBe(422);
          await expect(page.getByText(PW.currentWrong, { exact: true })).toBeVisible();
          await expect(current).toHaveAttribute('aria-invalid', 'true');
          expect(posts(), 'one POST').toHaveLength(1);
          await captureEvidence(page, 'E07_33S-A-007_pwchange.png');
        });

        await test.step('[33S-G-003] 422 CURRENT_PASSWORD_INCORRECT', async () => {
          // AAG:175-177
          expect.soft(rejected?.text).toContain('CURRENT_PASSWORD_INCORRECT');
          expect.soft(rejected?.text).toContain('currentPassword');
          await expect.soft(await errorOf(page, PW.current)).toHaveText(PW.currentWrong);
          await captureEvidence(page, 'E07_33S-G-003_pwchange.png');
        });

        await test.step('[33S-E-007] ⚑ focus stays inside the region after a rejected submit', async () => {
          // PWS:161: inputs are disabled while submitting; focus must not be lost to <body>
          await expect.soft(pwSubmit(page)).toBeEnabled();
          const inside = await regionOf(page).evaluate((region) => region.contains(document.activeElement));
          expect.soft(inside, 'document.activeElement is inside the "Mật khẩu" region').toBe(true);
          await captureEvidence(page, 'E07_33S-E-007_pwchange.png');
        });

        await test.step('[33S-A-008] after a wrong current the new/confirm values are kept', async () => {
          // UAA:415-425,444-447
          await expect.soft(next).toHaveValue(nextPw);
          await expect.soft(confirm).toHaveValue(nextPw);
          await expect.soft(page.getByText(PW.changed, { exact: true })).toHaveCount(0);
          await expect.soft(pwSubmit(page)).toBeEnabled();
          await captureEvidence(page, 'E07_33S-A-008_pwchange.png');
        });

        await test.step('[33S-A-010] editing new / confirm does NOT drop the server error', async () => {
          // UAA:361-365: only field=current clears it
          nextPw = `${nextPw}z`;
          await next.fill(nextPw);
          await confirm.fill(nextPw);
          await expect.soft(meterText(page)).toHaveText(PW.strength('mạnh'));
          await expect.soft(page.getByText(PW.currentWrong, { exact: true })).toBeVisible();
          await captureEvidence(page, 'E07_33S-A-010_pwchange.png');
        });

        await test.step('[33S-A-009] editing "Mật khẩu hiện tại" drops its server error', async () => {
          // UAA:361-365
          await current.fill('Wrong-again-1');
          await expect.soft(page.getByText(PW.currentWrong, { exact: true })).toHaveCount(0);
          await captureEvidence(page, 'E07_33S-A-009_pwchange.png');
        });

        await test.step('[33S-A-015] double click on "Đổi mật khẩu" sends exactly ONE POST', async () => {
          // inFlight ref, UAA:355,379,395
          const before = posts().length;
          const answer = waitForApi(page, 'POST', PASSWORD_RE, [422]);
          await pwSubmit(page).dblclick();
          await answer;
          await expect.soft(page.getByText(PW.currentWrong, { exact: true })).toBeVisible();
          expect.soft(posts().length - before, 'POSTs sent by the double click').toBe(1);
          await captureEvidence(page, 'E07_33S-A-015_pwchange.png');
        });

        await test.step('[33S-C-014] wrong current password never signs the user out', async () => {
          // K30, MR:231-234: 422, not 401
          const me = await (await meApi(context)).get();
          expect.soft(me.status(), 'GET /api/me after the 422').toBe(200);
          expect.soft(pathOf(page.url())).toBe(ROUTES.account);
          await expect.soft(heading(page)).toBeVisible();
          await captureEvidence(page, 'E07_33S-C-014_pwchange.png');
        });

        let success: { status: number; text: string } | undefined;
        await test.step('[33S-A-011] retry with the right current password in the same page', async () => {
          // UAA:397-411
          await current.fill(user.password);
          changedTo = nextPw;
          const answer = waitForApi(page, 'POST', PASSWORD_RE, [204]);
          await submitPassword(page);
          const res = await answer;
          success = { status: res.response.status(), text: await res.response.text().catch(() => '') }; // 204 has no body to read
          await expect.soft(page.getByText(PW.changed, { exact: true })).toBeVisible();
          await expect.soft(page.getByText(PW.currentWrong, { exact: true })).toHaveCount(0);
          await captureEvidence(page, 'E07_33S-A-011_pwchange.png');
        });

        await test.step('[33S-G-001] request body has exactly currentPassword and newPassword', async () => {
          // src/api/schemas/me.ts:86-91 strict, AAG:163
          const bodies = writes.bodies(PASSWORD_API);
          expect.soft(bodies).toHaveLength(3);
          for (const body of bodies) {
            expect.soft(Object.keys(body as Record<string, unknown>).sort()).toEqual(['currentPassword', 'newPassword']);
          }
          await captureEvidence(page, 'E07_33S-G-001_pwchange.png');
        });

        await test.step('[33S-G-002] 204 with an empty body is success', async () => {
          // src/api/client.ts:953-962, MR:157-160
          expect.soft(success?.status).toBe(204);
          expect.soft(success?.text).toBe('');
          await expect.soft(page.getByText(PW.changed, { exact: true })).toBeVisible();
          await captureEvidence(page, 'E07_33S-G-002_pwchange.png');
        });
        writes.stop();
      } finally {
        await restorePassword(user, changedTo);
      }
    });
  });

  test('SCR-33 · FL-33S-04 · happy path: success alert, fields cleared, session kept, old/new login, other session revoked, secret hygiene', async ({ browser }) => {
    test.setTimeout(Math.max(120_000, 2 * 100_000));
    await withSecurityUser(browser, 'p07-security-4', async ({ user, page }) => {
      const oldPw = user.password;
      const newPw = `Qa-${randomUUID()}`;
      const wrongPw = `Wrong-${randomUUID()}`;
      let changedTo: string | undefined;
      const other = await signedInApi(user.email, oldPw); // the "other session" of the same user
      try {
        const secrets = collectSecrets(page);
        await openSecurity(page);
        const current = pwField(page, PW.current);
        const next = pwField(page, PW.next);
        const confirm = pwField(page, PW.confirm);
        const writes = recordWrites(page);

        // Failure leg for 33S-G-007 (real 422, "after a success and a failure"); the current field is then corrected.
        await fillPasswords(page, wrongPw, newPw, newPw);
        const failure = waitForApi(page, 'POST', PASSWORD_RE, [422]);
        await submitPassword(page);
        await failure;
        await expect(page.getByText(PW.currentWrong, { exact: true })).toBeVisible();

        await test.step('[33S-A-002] fill the three fields correctly, click "Đổi mật khẩu"', async () => {
          // PWS:191-193, UAA:406-411
          await current.fill(oldPw);
          changedTo = newPw;
          const before = writes.list().filter((line) => line === `POST ${PASSWORD_API}`).length;
          const answer = waitForApi(page, 'POST', PASSWORD_RE, [204]);
          await submitPassword(page);
          await answer;
          await expect(page.getByText(PW.changed, { exact: true })).toBeVisible();
          expect(writes.list().filter((line) => line === `POST ${PASSWORD_API}`).length - before, 'one POST for the change').toBe(1);
          await captureEvidence(page, 'E07_33S-A-002_pwchange.png');
        });

        await test.step('[33S-B-009] success state is a "verified" InlineAlert', async () => {
          // PWS:191-193
          const alert = regionOf(page).getByRole('alert').filter({ hasText: PW.changed });
          await expect.soft(alert).toBeVisible();
          await expect.soft(alert).toHaveClass(/border-state-verified/u);
          await captureEvidence(page, 'E07_33S-B-009_pwchange.png');
        });

        await test.step('[33S-E-004] summary alerts are announced', async () => {
          // ALERT:44 role=alert
          await expect.soft(page.getByRole('alert').filter({ hasText: PW.changed })).toHaveCount(1);
          await captureEvidence(page, 'E07_33S-E-004_pwchange.png');
        });

        await test.step('[33S-A-003] after success the fields are emptied and the button is disabled again', async () => {
          // UAA:408-409,653-658
          for (const field of [current, next, confirm]) await expect.soft(field).toHaveValue('');
          await expect.soft(meterText(page)).toHaveCount(0);
          await expect.soft(pwSubmit(page)).toBeDisabled();
          await captureEvidence(page, 'E07_33S-A-003_pwchange.png');
        });

        await test.step('[33S-G-007] secrets do not leak', async () => {
          // after a success and a failure: console, request URLs, storage, URL, visible text
          expect.soft(await secrets.leaks([oldPw, newPw, wrongPw]), 'places holding a password').toEqual([]);
          await captureEvidence(page, 'E07_33S-G-007_pwchange.png');
        });

        await test.step('[33S-A-012] typing in a field after a success removes the success alert', async () => {
          // UAA:359
          await expect.soft(page.getByText(PW.changed, { exact: true })).toBeVisible();
          await next.fill('a');
          await expect.soft(page.getByText(PW.changed, { exact: true })).toHaveCount(0);
          await captureEvidence(page, 'E07_33S-A-012_pwchange.png');
        });

        await test.step('[33S-B-011] hasSubmitted resets after a success', async () => {
          // UAA:409,650
          await next.fill('abc1');
          await expect.soft(meterText(page)).toHaveText(PW.strength('yếu')); // typing has rendered
          await expect.soft(regionOf(page).getByRole('alert')).toHaveCount(0);
          await expect.soft(page.getByText(PW.tooShort, { exact: true })).toHaveCount(0);
          await captureEvidence(page, 'E07_33S-B-011_pwchange.png');
        });

        await test.step('[33S-A-004] after success this browser session survives (reload)', async () => {
          // MR:217 except_sid
          const reread = waitForApi(page, 'GET', ME_RE, [200]);
          await page.reload();
          const me = await reread;
          expect.soft(me.response.status()).toBe(200);
          expect.soft(pathOf(page.url())).toBe(ROUTES.account);
          await expect.soft(heading(page)).toBeVisible();
          await captureEvidence(page, 'E07_33S-A-004_pwchange.png');
        });

        await test.step('[33S-A-005] the NEW password signs in and the OLD one is refused', async () => {
          const anon = await newApiContext();
          try {
            const fresh = await anon.post('/api/auth/login', { data: { email: user.email, password: newPw, rememberMe: false } });
            expect.soft(fresh.status(), 'login with the new password').toBe(204);
            const stale = await anon.post('/api/auth/login', { data: { email: user.email, password: oldPw, rememberMe: false } });
            expect.soft(stale.status(), 'login with the old password').toBe(401);
            expect.soft(await stale.text()).toContain('INVALID_CREDENTIALS');
          } finally {
            await anon.dispose();
          }
          await captureEvidence(page, 'E07_33S-A-005_pwchange.png');
        });

        await test.step('[33S-A-006] after success another session of the same user is signed out', async () => {
          // MR:217 revoke_sessions except_sid
          const me = await other.get('/api/me');
          expect.soft(me.status(), 'other session GET /api/me').toBe(401);
          expect.soft(await me.text()).toContain('SESSION_REVOKED');
          const refreshed = await other.post('/api/auth/refresh');
          expect.soft(refreshed.status(), 'other session refresh').toBe(401);
          await captureEvidence(page, 'E07_33S-A-006_pwchange.png');
        });
        writes.stop();
      } finally {
        await other.dispose();
        await restorePassword(user, changedTo);
      }
    });
  });
});
