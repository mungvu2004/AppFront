/**
 * Phase 07 — SCR-33 Account Settings (`/tai-khoan`), password block UI-verify flows (QA-07b pack P4; flows-C3
 * `phase07_security_ui.spec.ts`): FL-33S-09 (real states: default / filled strong / invalid / current cleared) and FL-33S-10
 * ([mocked response] states: wrong 422 / success / 429 / unavailable / loading). Every state goes through `verifyUi` at
 * 1920 / 1440 / 1024 / 768 (the default `UI_VIEWPORTS` list: 1440 / 1920 / 1024 / 768) and records its own measurements in `open`.
 *
 * Request budget per run: one pool login per flow (engineer `p07-security-9`, own jar). `POST /api/me/password` is limited to
 * 5 per 900 s per user, so NOTHING here sends it for real: FL-33S-09 types values but its only submits are stopped by the
 * form's own validation (no request, asserted), and every FL-33S-10 answer is a route fulfilment (4 widths x 5 states would
 * burn the bucket four times over, and a real success changes the password). Mocked states and their real pairs:
 *   422 wrong current -> FL-33S-03 · success 204 -> FL-33S-04 · 429 -> FL-33S-05 (all in phase07_security_edge.spec.ts);
 *   unavailable (5xx) and loading (held answer) are unpairable (a 5xx cannot be produced on demand; a real answer cannot be held
 *   across four measurements).
 * Source: PWS PasswordSection.tsx, UAA useAccountAuth.ts (MESSAGES, submitPassword), accountAuthGateway.ts changePassword,
 * Input.tsx (role=alert error, aria-invalid), InlineAlert.tsx (role=alert), Button.tsx (loading -> disabled).
 */
import { expect, test, type Locator, type Page, type Response } from '@playwright/test';

import { PASSWORD_API, PW, fieldError, openAccount, pwField, pwSubmit, recordWrites } from './support/p07/account';
import {
  type Box,
  FOUR,
  PWV,
  U,
  adminApi,
  answerJson,
  fillPasswords,
  interceptRequests,
  openPasswordBlock,
  openUserSession,
  overlappingPairs,
  passwordBlock,
  rect,
  viewportOf,
  within,
} from './support/p07/P4';
import { poolUser } from './support/phase03Seed';
import { verifyUi } from './support/ui-verify';

const strengthWord = (page: Page, word: 'yếu' | 'khá' | 'mạnh'): Locator => passwordBlock(page).getByText(PW.strength(word), { exact: true });
const alertIn = (page: Page, text: string): Locator => passwordBlock(page).getByRole('alert').filter({ hasText: text });
const isPasswordPost = (response: Response): boolean =>
  new URL(response.url()).pathname === PASSWORD_API && response.request().method() === 'POST';

/** Rects of the three inputs, the button and the card, plus the layout viewport: what every state is judged against. */
async function formFrame(page: Page): Promise<{ vw: number; vh: number; card: Box; current: Box; next: Box; confirm: Box; button: Box }> {
  const v = await viewportOf(page);
  return {
    vw: v.w,
    vh: v.h,
    card: await rect(passwordBlock(page)),
    current: await rect(pwField(page, PW.current)),
    next: await rect(pwField(page, PW.next)),
    confirm: await rect(pwField(page, PW.confirm)),
    button: await rect(pwSubmit(page)),
  };
}

type Frame = Awaited<ReturnType<typeof formFrame>>;

/** Shared expectations: the frame fits the viewport and the card, and the button sits at the right end of the card content. */
function expectFits(m: Frame): void {
  const tag = String(m.vw);
  for (const [name, b] of [['current', m.current], ['new', m.next], ['confirm', m.confirm], ['button', m.button]] as const) {
    expect.soft(within(b, m.card), `${tag}: ${name} inside the card`).toBe(true);
    expect.soft(b.left >= 0 && b.right <= m.vw, `${tag}: ${name} inside the viewport`).toBe(true);
  }
  expect.soft(Math.abs(m.button.right - m.next.right), `${tag}: button right-aligned with the fields`).toBeLessThanOrEqual(2);
}

/* ================================================================= FL-33S-09 */

test('SCR-33 · FL-33S-09 · password block states, real (default / filled strong / invalid), 4 viewports', async ({ browser }) => {
  test.setTimeout(Math.max(120_000, 2 * 150_000));
  const admin = await adminApi();
  const user = await poolUser(admin, 'engineer', 'p07-security-9'); // S9
  await admin.dispose();
  const { context, page } = await openUserSession(browser, user);
  const writes = recordWrites(page);
  const open = (p: Page): Promise<void> => openPasswordBlock(p, openAccount);
  try {
    await test.step('[33S-F-001] default (empty form): card with 3 labelled inputs and a right-aligned button, no overflow, controls inside the viewport', async () => {
      const seen: Frame[] = [];
      await verifyUi(page, U('33S-F-001', 'default'), async (p) => {
        await open(p);
        for (const label of [PW.current, PW.next, PW.confirm]) await expect(pwField(p, label)).toHaveValue('');
        seen.push(await formFrame(p));
      }, FOUR);
      expect.soft(seen, 'every width measured').toHaveLength(FOUR.length);
      seen.forEach(expectFits);
    });

    await test.step('[33S-F-002] filled, strong meter: three filled inputs (dots), "Độ mạnh: mạnh" with 3 filled cells, button enabled', async () => {
      const seen: Array<{ frame: Frame; cells: number; types: Array<string | null>; enabled: boolean }> = [];
      await verifyUi(page, U('33S-F-002', 'filled_strong'), async (p) => {
        await open(p);
        await fillPasswords(p, PWV.current, PWV.strongNew, PWV.strongNew);
        await expect(strengthWord(p, 'mạnh')).toBeVisible();
        await expect(pwSubmit(p)).toBeEnabled();
        seen.push({
          frame: await formFrame(p),
          cells: await passwordBlock(p).locator('div[aria-hidden="true"] > span.bg-state-verified').count(), // PWS StrengthMeter: 3 cells, tone bg-state-verified
          types: await Promise.all([PW.current, PW.next, PW.confirm].map((l) => pwField(p, l).getAttribute('type'))),
          enabled: await pwSubmit(p).isEnabled(),
        });
      }, FOUR);
      for (const m of seen) {
        expectFits(m.frame);
        expect.soft(m.cells, `${String(m.frame.vw)}: three filled cells`).toBe(3);
        expect.soft(m.types, `${String(m.frame.vw)}: values shown as dots`).toEqual(['password', 'password', 'password']);
        expect.soft(m.enabled, `${String(m.frame.vw)}: button enabled`).toBe(true);
      }
    });

    await test.step('[33S-F-003] validation errors (too short + mismatch): messages fit the width, no overlap with the meter', async () => {
      const seen: Array<{ frame: Frame; boxes: Box[]; weak: number }> = [];
      await verifyUi(page, U('33S-F-003', 'invalid'), async (p) => {
        await open(p);
        await fillPasswords(p, PWV.current, PWV.weakNew, PWV.weakConfirm);
        await pwSubmit(p).click(); // stopped by the form's own validation (UAA submitPassword): no request
        await expect(fieldError(p, PW.tooShort)).toBeVisible();
        await expect(fieldError(p, PW.mismatch)).toBeVisible();
        await expect(strengthWord(p, 'yếu')).toBeVisible();
        const frame = await formFrame(p);
        // PWS:164-185: order top to bottom = new input, its message, the meter, confirm input, its message.
        const boxes = [frame.next, await rect(fieldError(p, PW.tooShort)), await rect(strengthWord(p, 'yếu')), frame.confirm, await rect(fieldError(p, PW.mismatch)), frame.button];
        seen.push({ frame, boxes, weak: await strengthWord(p, 'yếu').count() });
      }, FOUR);
      for (const m of seen) {
        const tag = String(m.frame.vw);
        expect.soft(overlappingPairs(m.boxes), `${tag}: no overlap between inputs, messages, meter and button`).toEqual([]);
        expect.soft(m.boxes.every((b) => within(b, m.frame.card)), `${tag}: messages fit the card width`).toBe(true);
        expect.soft(m.weak, `${tag}: weak meter`).toBe(1);
      }
    });

    await test.step('[33S-F-009] after a submit with "Mật khẩu hiện tại" cleared: "Chưa nhập mật khẩu hiện tại.", weak meter, button disabled, no overlap', async () => {
      const seen: Array<{ frame: Frame; boxes: Box[]; disabled: boolean }> = [];
      await verifyUi(page, U('33S-F-009', 'current_cleared'), async (p) => {
        await open(p);
        await fillPasswords(p, PWV.current, PWV.weakNew, PWV.weakNew);
        await pwSubmit(p).click(); // the weak new password stops the submit (hasSubmitted = true, no request)
        await expect(fieldError(p, PW.tooShort)).toBeVisible();
        await pwField(p, PW.current).fill('');
        await expect(fieldError(p, PW.currentRequired)).toBeVisible();
        await expect(strengthWord(p, 'yếu')).toBeVisible();
        await expect(pwSubmit(p)).toBeDisabled();
        const frame = await formFrame(p);
        const boxes = [frame.current, await rect(fieldError(p, PW.currentRequired)), frame.next, await rect(fieldError(p, PW.tooShort)), await rect(strengthWord(p, 'yếu')), frame.confirm, frame.button];
        seen.push({ frame, boxes, disabled: await pwSubmit(p).isDisabled() });
      }, FOUR);
      for (const m of seen) {
        const tag = String(m.frame.vw);
        expect.soft(m.disabled, `${tag}: button disabled`).toBe(true);
        expect.soft(overlappingPairs(m.boxes), `${tag}: no overlap`).toEqual([]);
        expect.soft(m.boxes.every((b) => within(b, m.frame.card)), `${tag}: messages fit the card`).toBe(true);
      }
    });
    expect(writes.list(), 'FL-33S-09 sends no POST /api/me/password (nor any other write)').toEqual([]);
  } finally {
    writes.stop();
    await context.close();
  }
});

/* ================================================================= FL-33S-10 */

test('SCR-33 · FL-33S-10 · [mocked response] password block states, 4 viewports (wrong 422 / success / 429 / unavailable / loading)', async ({ browser }) => {
  test.setTimeout(Math.max(120_000, 2 * 200_000));
  const admin = await adminApi();
  const user = await poolUser(admin, 'engineer', 'p07-security-9'); // S9 (a different jar from FL-33S-09's context)
  await admin.dispose();
  const { context, page } = await openUserSession(browser, user);
  const open = (p: Page): Promise<void> => openPasswordBlock(p, openAccount);

  /** Opens the form, types valid values and submits; resolves with the (mocked) answer's status. */
  const submitValid = async (p: Page): Promise<number> => {
    await open(p);
    await fillPasswords(p, PWV.current, PWV.strongNew, PWV.strongNew);
    const answered = p.waitForResponse(isPasswordPost);
    await pwSubmit(p).click();
    return (await answered).status();
  };

  try {
    await test.step('[33S-F-004] [mocked response] wrong current (422): "Mật khẩu hiện tại không đúng." under the current field, field outlined', async () => {
      // paired real: FL-33S-03 (phase07_security_edge.spec.ts) sends the real wrong current password once.
      const mock = await interceptRequests(page, PASSWORD_API, 'POST', answerJson(422, { code: 'CURRENT_PASSWORD_INCORRECT', message: 'qa mocked', requestId: 'qa-p4-422' }), { hold: false });
      const seen: Array<{ frame: Frame; message: Box; invalid: string | null; status: number }> = [];
      try {
        await verifyUi(page, U('33S-F-004', 'wrong_current'), async (p) => {
          const status = await submitValid(p);
          await expect(fieldError(p, PW.currentWrong)).toBeVisible();
          seen.push({ frame: await formFrame(p), message: await rect(fieldError(p, PW.currentWrong)), invalid: await pwField(p, PW.current).getAttribute('aria-invalid'), status });
        }, FOUR);
      } finally {
        await mock.release();
      }
      for (const m of seen) {
        const tag = String(m.frame.vw);
        expect.soft(m.status, `${tag}: mocked status`).toBe(422);
        expect.soft(m.message.top, `${tag}: message under the current field`).toBeGreaterThanOrEqual(m.frame.current.bottom - 1);
        expect.soft(m.message.bottom, `${tag}: message above the new field`).toBeLessThanOrEqual(m.frame.next.top + 1);
        expect.soft(m.invalid, `${tag}: current field outlined (aria-invalid)`).toBe('true');
      }
    });

    await test.step('[33S-F-005] [mocked response] success (204): green alert above the button, fields empty', async () => {
      // paired real: FL-33S-04 changes the password for real and puts it back.
      const mock = await interceptRequests(page, PASSWORD_API, 'POST', (route) => route.fulfill({ status: 204 }), { hold: false });
      const seen: Array<{ frame: Frame; alert: Box; values: string[] }> = [];
      try {
        await verifyUi(page, U('33S-F-005', 'success'), async (p) => {
          await submitValid(p);
          await expect(alertIn(p, PW.changed)).toBeVisible();
          seen.push({
            frame: await formFrame(p),
            alert: await rect(alertIn(p, PW.changed)),
            values: await Promise.all([PW.current, PW.next, PW.confirm].map((l) => pwField(p, l).inputValue())),
          });
        }, FOUR);
      } finally {
        await mock.release();
      }
      for (const m of seen) {
        const tag = String(m.frame.vw);
        expect.soft(m.alert.bottom, `${tag}: alert above the button`).toBeLessThanOrEqual(m.frame.button.top + 1);
        expect.soft(m.values, `${tag}: fields emptied`).toEqual(['', '', '']);
        expect.soft(within(m.alert, m.frame.card), `${tag}: alert inside the card`).toBe(true);
      }
    });

    await test.step('[33S-F-006] [mocked response] 429: "Đã thử nhiều lần. Hãy đợi vài phút rồi thử lại." and a disabled button', async () => {
      // paired real: FL-33S-05 (6th POST in 900 s -> 429 RATE_LIMITED).
      const mock = await interceptRequests(page, PASSWORD_API, 'POST', answerJson(429, { code: 'RATE_LIMITED', message: 'qa mocked', requestId: 'qa-p4-429' }, { 'Retry-After': '900' }), { hold: false });
      const seen: Array<{ frame: Frame; alert: Box; disabled: boolean }> = [];
      try {
        await verifyUi(page, U('33S-F-006', 'rate_limited'), async (p) => {
          await submitValid(p);
          const alert = alertIn(p, 'Đã thử nhiều lần. Hãy đợi vài phút rồi thử lại.');
          await expect(alert).toBeVisible();
          await expect(pwSubmit(p)).toBeDisabled();
          seen.push({ frame: await formFrame(p), alert: await rect(alert), disabled: await pwSubmit(p).isDisabled() });
        }, FOUR);
      } finally {
        await mock.release();
      }
      for (const m of seen) {
        const tag = String(m.frame.vw);
        expect.soft(m.disabled, `${tag}: button disabled`).toBe(true);
        expect.soft(within(m.alert, m.frame.card), `${tag}: alert inside the card`).toBe(true);
      }
    });

    await test.step('[33S-F-007] [mocked response] unavailable (500): "Không đổi được mật khẩu lúc này. Thử lại sau ít phút." above the button', async () => {
      // unpairable: a 5xx cannot be produced on demand on the real stack.
      const mock = await interceptRequests(page, PASSWORD_API, 'POST', answerJson(500, { code: 'INTERNAL', message: 'qa mocked', requestId: 'qa-p4-500' }), { hold: false });
      const seen: Array<{ frame: Frame; alert: Box }> = [];
      try {
        await verifyUi(page, U('33S-F-007', 'unavailable'), async (p) => {
          await submitValid(p);
          const alert = alertIn(p, 'Không đổi được mật khẩu lúc này. Thử lại sau ít phút.');
          await expect(alert).toBeVisible();
          seen.push({ frame: await formFrame(p), alert: await rect(alert) });
        }, FOUR);
      } finally {
        await mock.release();
      }
      for (const m of seen) {
        const tag = String(m.frame.vw);
        expect.soft(m.alert.bottom, `${tag}: alert above the button`).toBeLessThanOrEqual(m.frame.button.top + 1);
        expect.soft(within(m.alert, m.frame.card), `${tag}: alert inside the card`).toBe(true);
      }
    });

    await test.step('[33S-F-008] [mocked response] loading (request held): spinner button, three disabled inputs, width stable', async () => {
      // unpairable: a held real answer cannot persist across four measurements. The parked answer is released (204) at the end.
      const hold = await interceptRequests(page, PASSWORD_API, 'POST', (route) => route.fulfill({ status: 204 }), { hold: true });
      const seen: Array<{ vw: number; before: Box; during: Box; buttonDisabled: boolean; inputsDisabled: boolean[] }> = [];
      try {
        await verifyUi(page, U('33S-F-008', 'loading'), async (p) => {
          const count = hold.count();
          await open(p);
          await fillPasswords(p, PWV.current, PWV.strongNew, PWV.strongNew);
          const before = await rect(pwSubmit(p));
          await pwSubmit(p).click();
          await expect.poll(() => hold.count()).toBeGreaterThan(count);
          await expect(pwField(p, PW.current)).toBeDisabled();
          seen.push({
            vw: (await viewportOf(p)).w,
            before,
            during: await rect(pwSubmit(p)),
            buttonDisabled: await pwSubmit(p).isDisabled(),
            inputsDisabled: await Promise.all([PW.current, PW.next, PW.confirm].map((l) => pwField(p, l).isDisabled())),
          });
        }, FOUR);
      } finally {
        await hold.release();
      }
      for (const m of seen) {
        expect.soft(m.buttonDisabled, `${String(m.vw)}: spinner button disabled`).toBe(true);
        expect.soft(m.inputsDisabled, `${String(m.vw)}: three inputs disabled`).toEqual([true, true, true]);
        expect.soft(Math.abs(m.during.width - m.before.width), `${String(m.vw)}: button width stable`).toBeLessThanOrEqual(1);
      }
    });
  } finally {
    await context.close();
  }
});
