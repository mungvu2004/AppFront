/**
 * Phase 7 — SCR-33 `/tai-khoan`, EDGE layer, part B (QA-07b P2): FL-33P-04 autosave timing / offline / deleted session,
 * FL-33P-05 "Họ tên" validation and the field-error lifecycle, FL-33P-06 undo toast and local-only saves,
 * FL-33P-07 "Chức danh" / "Điện thoại" rules. Plan: `QA-07b/flows-C1.md`, rows: `QA-07b/catalog-C1.md`.
 * One `test()` = one flow = one pool user (slot `p07-profile-<n>`), one `test.step('[<row id>] …')` per row, in flow order.
 * Everything is real (no mock). `page.clock` only drives the 800 ms debounce, the 5 s max wait, the 5 s offline recheck,
 * the 30 s chip tick, the 8 s toast window and the 60 s "no retry on 422" window; every answer comes from the real stack.
 * With the clock frozen (`freeze`) nothing fires until `runFor`, so slowMo (400 ms per action) cannot shift a window.
 *
 * ## Request budget per run
 * - `POST /api/auth/login` (120 / 60 s per IP): 1 admin API (beforeAll) + 4 flow sessions = 5.
 * - `POST /api/users/invitations`: 0 normally (pool users exist); FL-33P-04 deletes its user, so +1 on the NEXT run (30 / h).
 * - `PATCH /api/me`: no rate limit; about 14 + 12 + 14 + 22 for the four flows, + 1 reset each.
 * - `PUT /api/me/avatar`: 0. `POST /api/me/password`: 0. `POST /api/auth/refresh`: 1 per page load and per reset.
 *
 * ## Suspected / unmerged behaviour (written as the CORRECT behaviour, red until fixed)
 * - BUG-503 (`fix/qa07-a`): a field 422 shows "Chưa lưu vì còn ô cần sửa" in the chip and the assertive live region.
 * - Ctrl+S (A-024), no "saved" toast for a local-only save (B-024), BUG-498 phone control chars (C-010).
 * Source short names: UAS useAccountSettings.ts, CA src/lib/autosave/createAutosave.ts, USI src/hooks/useSaveIndicator.ts,
 * TST src/components/feedback/Toast.tsx, INP src/components/ui/Input.tsx, BEs apps/api/me/schemas.py.
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { readAdminCredentials } from './support/auth';
import { signedInApi } from './support/api';
import { TEST_DATA_PREFIX, attachJson, captureEvidence } from './support/evidence';
import {
  IND,
  PHONE_MAX,
  PLACEHOLDER,
  PROBLEM,
  SHOW_GRID,
  TEXT_MAX,
  UNDO,
  asRecord,
  box,
  fieldError,
  holdResponse,
  openAccount,
  saveIndicator,
  toggle,
  undoToast,
} from './support/p07/account';
import {
  CHIP_DIRTY,
  CHIP_SAVING,
  FIELD_REJECTED,
  FLUSH_MS,
  MAX_WAIT_MS,
  TOAST_GONE_MS,
  announcerRegion,
  bodyOf,
  freeze,
  nextPatch,
  openFlow,
  thaw,
  waitForPatchCount,
} from './support/p07/P2';

const soft = expect.configure({ soft: true });
/** Evidence always on a flowing clock (the rAF wait in captureEvidence never ends on a paused one). */
const ev = async (page: Parameters<typeof captureEvidence>[0], id: string, slug: string): Promise<void> => {
  await thaw(page);
  await captureEvidence(page, `E07_${id}_${slug}.png`);
};

let admin: APIRequestContext;

test.beforeAll(async () => {
  const creds = readAdminCredentials();
  admin = await signedInApi(creds.email, creds.password);
});

test.afterAll(async () => {
  await admin.dispose();
});

/**
 * Evidence for FL-33P-06 (R1 red at A-030): what the undo toast is doing when the 9 s clock run does not remove it.
 * Attached BEFORE the expect, so it survives the failure. `hover` / `hasFocus` tell a hover- or focus-held window
 * (the mouse stays where the last "Hoàn tác" click was) from a real timer bug.
 */
async function attachToastSnapshot(page: Page, tag: string, patchCount: number): Promise<void> {
  const toasts = await undoToast(page).evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        text: (el.textContent ?? '').trim(),
        ariaLive: el.getAttribute('aria-live'),
        hover: el.matches(':hover'),
        hasFocus: el.contains(document.activeElement),
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      };
    }),
  );
  const clockNow = await page.evaluate(() => Date.now());
  await attachJson(`E07-33P-A-030_toast-${tag}.json`, { tag, patchCount, clockNow, toastCount: toasts.length, toasts, url: page.url() });
}

test.describe('SCR-33 profile B', () => {
  test('SCR-33 · FL-33P-04 · autosave timing, offline, session deleted', async ({ browser }) => {
    test.setTimeout(Math.max(120_000, 2 * 120_000));
    const flow = await openFlow(browser, admin, 'p07-profile-4', { clock: true });
    const { page, patches, context } = flow;
    const jobTitle = box(page, 'Chức danh');
    const chip = saveIndicator(page);
    const base = `${TEST_DATA_PREFIX}jt`;
    try {
      await test.step('[33P-B-015] one keystroke → chip dirty before 800 ms', async () => {
        await freeze(page);
        await jobTitle.fill(base);
        await expect(chip).toHaveText(CHIP_DIRTY);
        expect(patches.length, 'nothing sent before the debounce').toBe(0);
        const saved = nextPatch(page);
        await page.clock.runFor(FLUSH_MS);
        await saved;
        await expect(chip).toHaveText(IND.saved);
        // the dirty chip cannot be shot on a paused clock: the image shows the settled state after the assertions above
        await ev(page, '33P-B-015', 'chip-dirty-then-saved');
      });

      await test.step('[33P-A-020] ten keystrokes 100 ms apart → ONE PATCH with the last value', async () => {
        await freeze(page);
        const before = patches.length;
        await jobTitle.focus();
        await page.keyboard.press('End');
        for (const ch of 'abcdefghij') {
          await page.keyboard.type(ch);
          await page.clock.runFor(100);
        }
        soft(patches.length, 'no PATCH while the burst lasts').toBe(before);
        const saved = nextPatch(page);
        await page.clock.runFor(FLUSH_MS);
        await saved;
        const value = await jobTitle.inputValue();
        expect(patches.length).toBe(before + 1);
        soft(patches[before]).toEqual({ jobTitle: value }); // CA:231-238
        await ev(page, '33P-A-020', 'burst-one-patch');
      });

      const held = await holdResponse(page, '**/api/me', 'PATCH');
      await test.step('[33P-B-016] next edit, PATCH held → chip "Đang lưu…"', async () => {
        await jobTitle.fill(`${await jobTitle.inputValue()}1`);
        await page.clock.runFor(FLUSH_MS);
        await held.seen;
        await expect.soft(chip).toHaveText(CHIP_SAVING);
        await ev(page, '33P-B-016', 'chip-saving');
      });

      await test.step('[33P-A-023] typing while the PATCH is held → text kept, 2nd PATCH has the full text', async () => {
        await freeze(page);
        const first = nextPatch(page);
        await jobTitle.pressSequentially('xyz');
        const full = await jobTitle.inputValue();
        await held.release();
        await first;
        await expect.soft(jobTitle).toHaveValue(full); // UAS:214-218
        const second = nextPatch(page);
        await page.clock.runFor(FLUSH_MS);
        await second;
        soft(bodyOf(await second)).toEqual({ jobTitle: full });
        await ev(page, '33P-A-023', 'typed-while-saving');
      });

      await test.step('[33P-A-019] "Họ tên" and "Điện thoại" 200 ms apart → ONE PATCH with both keys', async () => {
        await freeze(page);
        const before = patches.length;
        const name = `${TEST_DATA_PREFIX}name4`;
        await box(page, 'Họ tên').fill(name);
        await page.clock.runFor(200);
        await box(page, 'Điện thoại').fill('0900000019');
        const saved = nextPatch(page);
        await page.clock.runFor(FLUSH_MS);
        await saved;
        soft(patches.length).toBe(before + 1); // ASG:136-155
        soft(patches[before]).toEqual({ fullName: name, phone: '0900000019' });
        await ev(page, '33P-A-019', 'two-fields-one-patch');
      });

      await test.step('[33P-A-021] a key every 700 ms for 6 s → a PATCH at the 5 s max wait, another after the last key', async () => {
        await freeze(page);
        const before = patches.length;
        const start = await jobTitle.inputValue();
        await jobTitle.focus();
        await page.keyboard.press('End');
        for (let i = 0; i < 9; i += 1) {
          await page.keyboard.type(String.fromCharCode(97 + i));
          await page.clock.runFor(700);
        }
        await waitForPatchCount(flow, before + 1); // CA:84 max wait 5 s (MAX_WAIT_MS)
        const typed = await jobTitle.inputValue();
        const first = asRecord(patches[before], 'max-wait PATCH');
        soft(String(first.jobTitle).startsWith(start)).toBe(true);
        soft(String(first.jobTitle).length).toBeLessThan(typed.length);
        soft(MAX_WAIT_MS).toBe(5_000);
        await page.clock.runFor(FLUSH_MS);
        await waitForPatchCount(flow, before + 2);
        soft(patches[before + 1]).toEqual({ jobTitle: typed });
        await expect(chip).toHaveText(IND.saved);
        await ev(page, '33P-A-021', 'max-wait');
      });

      await test.step('[33P-B-018] 90 s past the last save and a 30 s tick → "Đã lưu 1 phút trước"', async () => {
        await freeze(page);
        await page.clock.runFor(95_000); // USI:29-30,52-56
        await expect.soft(chip).toHaveText('Đã lưu 1 phút trước');
        await ev(page, '33P-B-018', 'chip-ages');
      });

      await test.step('[33P-A-022] "Z" then the saved value back inside the window → no PATCH, chip back', async () => {
        await freeze(page);
        const before = patches.length;
        const saved = await jobTitle.inputValue();
        await jobTitle.fill(`${saved}Z`);
        await expect.soft(chip).toHaveText(CHIP_DIRTY);
        await jobTitle.fill(saved);
        await page.clock.runFor(FLUSH_MS);
        await expect.soft(chip).toHaveText(/^(?:Chưa có thay đổi|Đã lưu)/u); // UAS:283-285
        soft(patches.length).toBe(before);
        await ev(page, '33P-A-022', 'typed-back');
      });

      await test.step('[33P-A-024] Ctrl+S right after typing → PATCH before 800 ms (⚑ red until useFlushOnSave is wired)', async () => {
        await freeze(page);
        const before = patches.length;
        await jobTitle.fill(`${await jobTitle.inputValue()}S`);
        await page.keyboard.press('Control+S');
        await soft.poll(() => patches.length, { timeout: 5_000, message: 'PATCH without advancing the clock' }).toBe(before + 1);
        await page.clock.runFor(FLUSH_MS); // let the pending autosave finish whatever happened
        await expect.soft(chip).toHaveText(IND.saved);
        await ev(page, '33P-A-024', 'ctrl-s');
      });

      await test.step('[33P-A-025] type, SPA back to the dashboard inside 800 ms → the PATCH is still sent', async () => {
        await thaw(page);
        await page.goto(ROUTES.dashboard);
        await page.getByRole('button', { name: 'Thông báo', exact: true }).click();
        await page
          .getByRole('dialog', { name: 'Thông báo', exact: true })
          .getByRole('button', { name: 'Mở cài đặt thông báo', exact: true })
          .click();
        await expect(jobTitle).toBeVisible();
        await freeze(page);
        const before = patches.length;
        const value = `${await jobTitle.inputValue()}Back`;
        await jobTitle.fill(value);
        await page.goBack();
        await expect.poll(() => new URL(page.url()).pathname).toBe(ROUTES.dashboard);
        const saved = nextPatch(page);
        await page.clock.runFor(FLUSH_MS); // UAS:251-259: the engine outlives the screen
        await saved;
        soft(patches[before]).toEqual({ jobTitle: value });
        await ev(page, '33P-A-025', 'left-before-debounce');
      });

      await test.step('[33P-B-020] offline edit → "Ngoại tuyến — sẽ lưu khi có mạng", nothing sent', async () => {
        await thaw(page);
        await openAccount(page);
        await freeze(page);
        const before = patches.length;
        await context.setOffline(true);
        await jobTitle.fill(`${await jobTitle.inputValue()}-off`);
        await page.clock.runFor(FLUSH_MS);
        await expect.soft(chip).toHaveText(IND.offline); // CA:164-169
        soft(patches.length).toBe(before);
        await ev(page, '33P-B-020', 'offline');
      });

      await test.step('[33P-B-021] back online → the same PATCH lands within the 5 s recheck', async () => {
        await freeze(page);
        const value = await jobTitle.inputValue();
        const landed = nextPatch(page);
        await context.setOffline(false);
        await page.clock.runFor(MAX_WAIT_MS + FLUSH_MS); // CA:85 recheck every 5 s
        const res = await landed;
        soft(bodyOf(res)).toEqual({ jobTitle: value });
        await expect.soft(chip).toHaveText(IND.saved);
        await ev(page, '33P-B-021', 'online-flushed');
      });

      await test.step('[33P-D-004] user deleted by the admin, then an edit → 401 SESSION_REVOKED → /login', async () => {
        await thaw(page);
        const chipTexts: string[] = [];
        await page.exposeFunction('__p2Chip', (text: string) => chipTexts.push(text));
        await page.evaluate(() => {
          const el = document.querySelector('header [role="status"]');
          if (el === null) throw new Error('no chip');
          const sink = (window as unknown as { __p2Chip: (t: string) => void }).__p2Chip;
          new MutationObserver(() => sink(el.textContent ?? '')).observe(el, { subtree: true, childList: true, characterData: true });
        });
        const del = await admin.delete(`/api/users/${flow.user.id}`);
        // Evidence for the R1 red (DELETE not ok): status + body, attached before the expect.
        await attachJson('E07-33P-D-004_delete-user.json', { status: del.status(), statusText: del.statusText(), body: (await del.text()).slice(0, 600), url: del.url() });
        expect(del.ok(), 'setup: DELETE /api/users/:id').toBe(true);
        flow.deleted = true;
        const rejected = nextPatch(page, [401]);
        await box(page, 'Họ tên').fill(`${TEST_DATA_PREFIX}gone`);
        const res = await rejected;
        soft(JSON.stringify(res.json)).toContain('SESSION_REVOKED'); // BEr:90-92
        await expect.soft(page).toHaveURL(/\/login\?next=%2Ftai-khoan/u);
        soft(chipTexts.filter((t) => /^Đã lưu/u.test(t))).toEqual([]);
        await ev(page, '33P-D-004', 'session-revoked');
      });
    } finally {
      await context.setOffline(false);
      await flow.close();
    }
  });

  test('SCR-33 · FL-33P-05 · "Họ tên" validation, field error lifecycle', async ({ browser }) => {
    test.setTimeout(Math.max(120_000, 2 * 70_000));
    const flow = await openFlow(browser, admin, 'p07-profile-5', { clock: true });
    const { page, patches } = flow;
    const fullName = box(page, 'Họ tên');
    const chip = saveIndicator(page);
    const original = flow.snapshot.fullName;
    const nameError = fieldError(page, PROBLEM.fullName);
    try {
      await test.step('[33P-C-001] "Họ tên" emptied → 422, error under the field', async () => {
        const rejected = nextPatch(page, [422]);
        await fullName.fill('');
        const res = await rejected;
        expect(bodyOf(res)).toEqual({ fullName: '' });
        expect(JSON.stringify(res.json)).toContain('"field":"fullName"');
        await expect(nameError).toBeVisible();
        await expect(nameError).toHaveAttribute('role', 'alert');
        await expect(fullName).toHaveAttribute('aria-invalid', 'true');
        await ev(page, '33P-C-001', 'fullname-empty');
      });

      await test.step('[33P-B-019] chip after the 422 → "Chưa lưu vì còn ô cần sửa" (⚑ BUG-503)', async () => {
        await expect.soft(chip).toHaveText(FIELD_REJECTED);
        await expect.soft(chip).not.toHaveText(IND.failed);
        await ev(page, '33P-B-019', 'chip-rejected');
      });

      await test.step('[33P-E-005] the field is linked to its error', async () => {
        const errorId = await nameError.getAttribute('id'); // INP:91,117
        soft(errorId).toMatch(/-error$/u);
        soft(await fullName.getAttribute('aria-describedby')).toContain(errorId ?? 'missing-id');
        await expect.soft(fullName).toHaveAttribute('aria-invalid', 'true');
        await ev(page, '33P-E-005', 'error-linked');
      });

      await test.step('[33P-E-007] announcer: assertive text equals the chip label (⚑ BUG-503)', async () => {
        await expect.soft(announcerRegion(page, 'assertive')).toHaveText(/^Chưa lưu vì còn ô cần sửa\s?$/u); // USI:127,133
        await expect.soft(announcerRegion(page, 'assertive')).not.toContainText('thử lưu lại');
        await ev(page, '33P-E-007', 'announcer-assertive');
      });

      await test.step('[33P-C-014] +60 s → no second PATCH (422 is not retried)', async () => {
        const before = patches.length;
        await page.clock.runFor(60_000); // CA:192-195
        await expect.soft(chip).toHaveText(FIELD_REJECTED);
        soft(patches.length).toBe(before);
        await ev(page, '33P-C-014', 'no-retry');
      });

      await test.step('[33P-C-015] one more character → the error text disappears before any request', async () => {
        await freeze(page);
        const before = patches.length;
        await fullName.focus();
        await page.keyboard.type('A');
        await expect.soft(nameError).toHaveCount(0); // UAS:366-376
        soft(patches.length).toBe(before);
        await fullName.fill(original); // back to the saved name, so thawing sends nothing
        await page.clock.runFor(FLUSH_MS);
        soft(patches.length).toBe(before);
        await ev(page, '33P-C-015', 'error-cleared');
      });

      await test.step('[33P-C-002] retype the saved name → no PATCH, no error', async () => {
        await freeze(page);
        const before = patches.length;
        await fullName.fill('Q');
        await fullName.fill(original);
        await page.clock.runFor(FLUSH_MS);
        await expect.soft(chip).toHaveText(IND.idle);
        await expect.soft(nameError).toHaveCount(0);
        soft(patches.length).toBe(before);
        await ev(page, '33P-C-002', 'saved-name-retyped');
      });

      await test.step('[33P-C-003] 121 characters → 422; 120 → 200', async () => {
        await freeze(page);
        const rejected = nextPatch(page, [422]);
        await fullName.fill('N'.repeat(TEXT_MAX + 1));
        await page.clock.runFor(FLUSH_MS);
        await rejected;
        await expect.soft(nameError).toBeVisible();
        await ev(page, '33P-C-003', 'fullname-121');
        await freeze(page);
        const ok = nextPatch(page);
        await fullName.fill('N'.repeat(TEXT_MAX));
        await page.clock.runFor(FLUSH_MS);
        await ok;
        await expect.soft(nameError).toHaveCount(0);
      });

      await test.step('[33P-C-013] fix after a 422 → PATCH with the fixed value, error gone, chip saved', async () => {
        await freeze(page);
        const rejected = nextPatch(page, [422]);
        await fullName.fill('');
        await page.clock.runFor(FLUSH_MS);
        await rejected;
        await expect(nameError).toBeVisible();
        const fixed = `${TEST_DATA_PREFIX}fixed`;
        const ok = nextPatch(page);
        await fullName.fill(fixed);
        await page.clock.runFor(FLUSH_MS);
        soft(bodyOf(await ok)).toEqual({ fullName: fixed }); // UAS:319
        await expect.soft(nameError).toHaveCount(0);
        await expect.soft(chip).toHaveText(IND.saved);
        await expect.soft(announcerRegion(page, 'polite')).toContainText('Đã lưu lúc'); // E-007, success half
        await ev(page, '33P-C-013', 'fixed-saved');
      });

      await test.step('[33P-C-004] spaces only, then U+0007 → 422 field fullName, same copy', async () => {
        await freeze(page);
        for (const [value, slug] of [['   ', 'spaces'], ['\u0007', 'bell']] as const) {
          const rejected = nextPatch(page, [422]);
          await fullName.fill(value);
          await page.clock.runFor(FLUSH_MS);
          expect(JSON.stringify((await rejected).json)).toContain('"field":"fullName"'); // BEs:42-52
          await expect.soft(nameError).toBeVisible();
          if (slug === 'bell') await ev(page, '33P-C-004', 'spaces-bell');
        }
      });

      await test.step('[33P-C-005] "  An  " → 200, after reload the field shows "An"', async () => {
        await freeze(page);
        const ok = nextPatch(page);
        await fullName.fill('  An  ');
        await page.clock.runFor(FLUSH_MS);
        await ok;
        await expect.soft(chip).toHaveText(IND.saved);
        await thaw(page);
        await openAccount(page);
        await expect.soft(fullName).toHaveValue('An');
        await ev(page, '33P-C-005', 'trimmed-after-reload');
      });
    } finally {
      await flow.close();
    }
  });

  test('SCR-33 · FL-33P-06 · undo toast and local-only saves', async ({ browser }) => {
    test.setTimeout(Math.max(120_000, 2 * 110_000));
    const flow = await openFlow(browser, admin, 'p07-profile-6', { clock: true });
    const { page, patches } = flow;
    const fullName = box(page, 'Họ tên');
    const chip = saveIndicator(page);
    const original = flow.snapshot.fullName;
    const undoButton = undoToast(page).getByRole('button', { name: UNDO, exact: true });
    const name = (tag: string): string => `${original}-${tag}`;
    let patchesBeforeLocal = 0;
    try {
      await test.step('[33P-A-026] save, then "Hoàn tác" → PATCH with the previous name, field restored', async () => {
        const saved = nextPatch(page);
        await fullName.fill(name('a'));
        await saved;
        await expect(undoToast(page)).toBeVisible();
        await expect(undoButton).toBeVisible();
        await ev(page, '33P-A-026', 'undo-toast');
        const restored = nextPatch(page);
        await undoButton.click();
        soft(bodyOf(await restored)).toEqual({ fullName: original }); // UAS:336-353
        await expect.soft(fullName).toHaveValue(original);
      });

      await test.step('[33P-A-027] after the click the toast leaves at once, no new toast', async () => {
        await expect.soft(undoToast(page)).toHaveCount(0, { timeout: 5_000 }); // TST:118-124
        await expect.soft(chip).toHaveText(IND.saved);
        await expect.soft(undoToast(page)).toHaveCount(0);
        await ev(page, '33P-A-027', 'toast-gone');
      });

      await test.step('[33P-E-011] second save → toast is a polite status; Tab to "Hoàn tác", Enter undoes', async () => {
        const saved = nextPatch(page);
        await fullName.fill(name('b'));
        await saved;
        const toast = undoToast(page);
        await expect.soft(toast).toHaveAttribute('aria-live', 'polite'); // TST:56-60
        await expect(undoButton).toBeVisible();
        await freeze(page); // a focused/frozen toast keeps its window while ~40 Tab presses (slowMo) go by
        await fullName.focus();
        let reached = false;
        for (let i = 0; i < 60 && !reached; i += 1) {
          await page.keyboard.press('Tab');
          reached = await undoButton.evaluate((el) => el === document.activeElement);
        }
        soft(reached, 'Tab reaches "Hoàn tác"').toBe(true);
        await thaw(page); // the focused toast keeps its window while time flows
        await ev(page, '33P-E-011', 'undo-by-keyboard');
        const restored = nextPatch(page);
        await page.keyboard.press('Enter');
        soft(bodyOf(await restored)).toEqual({ fullName: original });
        await expect.soft(fullName).toHaveValue(original);
      });

      await test.step('[33P-A-030] save A, wait past the 5 s group window, save B, undo → back to A', async () => {
        await attachToastSnapshot(page, 'before-save-a', patches.length);
        const savedA = nextPatch(page);
        await fullName.fill(name('A'));
        await savedA;
        await attachToastSnapshot(page, 'after-save-a', patches.length);
        await page.clock.runFor(TOAST_GONE_MS); // > 5 s: a new toast, and the first has left (TST 8 s)
        await attachToastSnapshot(page, 'after-clock-run', patches.length);
        await expect(undoToast(page)).toHaveCount(0);
        const savedB = nextPatch(page);
        await fullName.fill(name('B'));
        await savedB;
        await expect(undoButton).toBeVisible();
        const restored = nextPatch(page);
        await undoButton.click();
        soft(bodyOf(await restored)).toEqual({ fullName: name('A') }); // UAS:293,340
        await expect.soft(fullName).toHaveValue(name('A'));
        await ev(page, '33P-A-030', 'undo-to-a');
      });

      await test.step('[33P-A-028] save, 8 s with the mouse away → toast gone, no PATCH', async () => {
        await expect(undoToast(page)).toHaveCount(0, { timeout: 5_000 });
        const saved = nextPatch(page);
        await fullName.fill(name('C'));
        await saved;
        await expect(undoToast(page)).toBeVisible();
        await page.mouse.move(0, 0);
        const before = patches.length;
        await page.clock.runFor(TOAST_GONE_MS); // UT:18 UNDO_WINDOW_MS 8 s + exit
        await expect.soft(undoToast(page)).toHaveCount(0);
        soft(patches.length).toBe(before);
        await ev(page, '33P-A-028', 'toast-expired');
      });

      await test.step('[33P-A-029] hover holds the toast 12 s; mouse out → gone; "Hoàn tác" works while held', async () => {
        const savedD = nextPatch(page);
        await fullName.fill(name('D'));
        await savedD;
        await undoToast(page).hover();
        await page.clock.runFor(12_000); // TST:77-91, BUG-571
        await expect.soft(undoToast(page)).toBeVisible();
        await ev(page, '33P-A-029', 'toast-held');
        await page.mouse.move(0, 0);
        await page.clock.runFor(TOAST_GONE_MS);
        await expect.soft(undoToast(page)).toHaveCount(0);
        const savedE = nextPatch(page);
        await fullName.fill(name('E'));
        await savedE;
        await undoToast(page).hover();
        await page.clock.runFor(12_000);
        const restored = nextPatch(page);
        await undoButton.click(); // BUG-524: the ticket is held with the toast
        soft(bodyOf(await restored)).toEqual({ fullName: name('D') });
        await expect.soft(fullName).toHaveValue(name('D'));
      });

      await test.step('[33P-B-022] toggle "Hiện lưới 100 mm" → chip "Chỉ giữ trong phiên này"', async () => {
        await page.mouse.move(0, 0);
        await page.clock.runFor(TOAST_GONE_MS);
        patchesBeforeLocal = patches.length;
        await toggle(page, SHOW_GRID).click();
        await expect.soft(chip).toHaveText(IND.localOnly); // UAS:109
        await ev(page, '33P-B-022', 'chip-local-only');
      });

      await test.step('[33P-G-008] the same edit again sends no PATCH', async () => {
        await freeze(page);
        await toggle(page, SHOW_GRID).click();
        await page.clock.runFor(FLUSH_MS);
        await thaw(page);
        await expect.soft(chip).toHaveText(IND.localOnly);
        soft(patches.length).toBe(patchesBeforeLocal); // ASG:158-160
        await ev(page, '33P-G-008', 'no-patch');
      });

      await test.step('[33P-B-023] "Họ tên" + toggle in one window → PATCH with only fullName, chip "Đã lưu lúc"', async () => {
        const before = patches.length;
        await freeze(page);
        await fullName.fill(name('F'));
        await toggle(page, SHOW_GRID).click();
        const saved = nextPatch(page);
        await page.clock.runFor(FLUSH_MS);
        await thaw(page);
        soft(bodyOf(await saved)).toEqual({ fullName: name('F') }); // UAS:315
        soft(patches.length).toBe(before + 1);
        await expect.soft(chip).toHaveText(IND.saved);
        await expect.soft(chip).not.toHaveText(IND.localOnly);
        await expect.soft(undoToast(page)).toBeVisible(); // control: a profile save does publish the toast
        await ev(page, '33P-B-023', 'mixed-save');
      });

      await test.step('[33P-B-024] a save that touched only the toggle → no "saved" toast (⚑)', async () => {
        await page.mouse.move(0, 0);
        await page.clock.runFor(TOAST_GONE_MS);
        await expect(undoToast(page)).toHaveCount(0);
        await freeze(page);
        await toggle(page, SHOW_GRID).click();
        await page.clock.runFor(FLUSH_MS);
        await thaw(page);
        await expect.soft(chip).toHaveText(IND.localOnly);
        await expect.soft(undoToast(page)).toHaveCount(0); // UAS:105-108 vs 332-353
        await ev(page, '33P-B-024', 'no-toast');
      });
    } finally {
      await flow.close();
    }
  });

  test('SCR-33 · FL-33P-07 · "Chức danh" and "Điện thoại" rules', async ({ browser }) => {
    test.setTimeout(Math.max(120_000, 2 * 70_000));
    const flow = await openFlow(browser, admin, 'p07-profile-7');
    const { page } = flow;
    const jobTitle = box(page, 'Chức danh');
    const phone = box(page, 'Điện thoại');
    const chip = saveIndicator(page);
    const titleError = fieldError(page, PROBLEM.jobTitle);
    const phoneError = fieldError(page, PROBLEM.phone);
    const longPhone = '+84 (90) 123-4567';
    try {
      await test.step('[33P-C-006] "Chức danh" 121 characters → 422; 120 → 200', async () => {
        const tooLong = 'x'.repeat(TEXT_MAX + 1);
        const rejected = nextPatch(page, [422]);
        await jobTitle.fill(tooLong);
        const res = await rejected;
        expect(bodyOf(res)).toEqual({ jobTitle: tooLong });
        expect(JSON.stringify(res.json)).toContain('"field":"jobTitle"');
        await expect(titleError).toBeVisible();
        await expect(jobTitle).toHaveAttribute('aria-invalid', 'true');
        await ev(page, '33P-C-006', 'jobtitle-121');
        const atMax = 'y'.repeat(TEXT_MAX);
        const ok = nextPatch(page);
        await jobTitle.fill(atMax);
        expect(bodyOf(await ok)).toEqual({ jobTitle: atMax });
        await expect(titleError).toHaveCount(0);
      });

      await test.step('[33P-C-008] "Chức danh" with U+0007 → 422 field jobTitle', async () => {
        const rejected = nextPatch(page, [422]);
        await jobTitle.fill('ab\u0007c');
        expect(JSON.stringify((await rejected).json)).toContain('"field":"jobTitle"');
        await expect.soft(titleError).toBeVisible();
        await ev(page, '33P-C-008', 'jobtitle-bell');
      });

      await test.step('[33P-C-007] "Chức danh" spaces only → 200 clears it; reload shows empty + "Chưa đặt"', async () => {
        const ok = nextPatch(page);
        await jobTitle.fill('   ');
        const res = await ok;
        soft(asRecord(res.json, 'PATCH').jobTitle).toBeUndefined(); // BEs:58-66
        await openAccount(page);
        await expect.soft(jobTitle).toHaveValue('');
        await expect.soft(jobTitle).toHaveAttribute('placeholder', PLACEHOLDER);
        await ev(page, '33P-C-007', 'jobtitle-spaces');
      });

      await test.step('[33P-C-009] "Điện thoại" 33 characters → 422; 32 → 200', async () => {
        const rejected = nextPatch(page, [422]);
        await phone.fill('9'.repeat(PHONE_MAX + 1));
        await rejected;
        await expect.soft(phoneError).toBeVisible();
        await ev(page, '33P-C-009', 'phone-33');
        const ok = nextPatch(page);
        await phone.fill('8'.repeat(PHONE_MAX));
        soft(bodyOf(await ok)).toEqual({ phone: '8'.repeat(PHONE_MAX) });
        await expect.soft(phoneError).toHaveCount(0);
      });

      await test.step('[33P-C-010] "Điện thoại" with U+0000, U+0007, U+202E → 422 field phone (⚑ BUG-498)', async () => {
        for (const ch of ['\u0000', '\u0007', '‮']) {
          const answered = nextPatch(page, [422, 500]);
          await phone.fill(`0901${ch}234`);
          const res = await answered;
          soft(res.response.status()).toBe(422);
          soft(JSON.stringify(res.json)).toContain('"field":"phone"');
          await expect.soft(fieldError(page, PROBLEM.phone)).toBeVisible();
        }
        await ev(page, '33P-C-010', 'phone-control-chars');
      });

      await test.step('[33P-C-011] "Điện thoại" "+84 (90) 123-4567" → 200, same after reload', async () => {
        const ok = nextPatch(page);
        await phone.fill(longPhone);
        soft(bodyOf(await ok)).toEqual({ phone: longPhone });
        await openAccount(page);
        await expect.soft(phone).toHaveValue(longPhone);
        await ev(page, '33P-C-011', 'phone-free-format');
      });

      await test.step('[33P-C-012] "Chức danh" 121 kept, then a valid phone → both keys sent, 422 jobTitle again, old phone after reload', async () => {
        const tooLong = 'z'.repeat(TEXT_MAX + 1);
        const first = nextPatch(page, [422]);
        await jobTitle.fill(tooLong);
        await first;
        await expect(titleError).toBeVisible();
        const second = nextPatch(page, [422]);
        await phone.fill('0911222333');
        const res = await second;
        soft(bodyOf(res)).toEqual({ jobTitle: tooLong, phone: '0911222333' }); // ASG:134-157
        soft(JSON.stringify(res.json)).toContain('"field":"jobTitle"');
        await expect.soft(titleError).toBeVisible();
        await expect.soft(chip).toHaveText(/Chưa lưu|Lưu thất bại/u);
        await ev(page, '33P-C-012', 'batch-blocked');
        await openAccount(page);
        await expect.soft(phone).toHaveValue(longPhone);
      });
    } finally {
      await flow.close();
    }
  });
});
