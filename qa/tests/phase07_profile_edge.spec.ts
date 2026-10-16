/**
 * Phase 7 SCR-33 `/tai-khoan` profile page, real stack (QA-07b P1): FL-33P-01 frame/roles/semantics (viewer),
 * FL-33P-02 anonymous entry/login return/deep links/loading (engineer), FL-33P-03 single-field saves/bodies/language/e-mail reason.
 *
 * Request budget (429 limits, per run): FL-33P-01: 1 `POST /api/auth/login` (API) + 1 refresh + 1 PATCH + 1 reset PATCH;
 * FL-33P-02: 2 form logins (`POST /api/auth/login`), 0 PATCH; FL-33P-03: 1 API login + 1 refresh, 9 PATCH + 1 reset PATCH.
 * No password change, no avatar upload. Pool users: `p07-profile-1` (viewer), `p07-profile-2` / `p07-profile-3` (engineers).
 * Every flow that edits a profile restores it in `finally` (`resetProfile`).
 */
import { expect, test } from '@playwright/test';
import type { APIRequestContext, Browser } from '@playwright/test';

import { ROUTES, loginUrl, pathOf } from '../../e2e/fixtures/routes';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { captureEvidence } from './support/evidence';
import {
  CHANGE_EMAIL,
  EMAIL_REASON_LONG,
  EMAIL_REASON_SHORT,
  IND,
  LANGUAGE,
  PLACEHOLDER,
  accountHeader,
  accountUser,
  asRecord,
  avatarInput,
  block,
  box,
  emailText,
  heading,
  openAccount,
  recordWrites,
  resetProfile,
  saveIndicator,
  signInAccount,
  snapshotProfile,
} from './support/p07/account';
import {
  BLOCKS,
  NAME_AN,
  avatarSpan,
  countMeReads,
  fieldRow,
  holdMeReads,
  initialsOf,
  patchAfter,
  signInViaForm,
  withPausedClock,
} from './support/p07/P1';

const DESKTOP = { width: 1440, height: 900 } as const;
const BACK_TO_DASHBOARD = 'Về bảng điều khiển'; // vi.json:432 account.backToDashboard
const softly = expect.configure({ soft: true });

/** Admin API context for the pool seed, disposed after `body`. */
async function withAdmin<T>(body: (admin: APIRequestContext) => Promise<T>): Promise<T> {
  const { email, password } = readAdminCredentials();
  const admin = await signedInApi(email, password);
  try {
    return await body(admin);
  } finally {
    await admin.dispose();
  }
}

const newContext = (browser: Browser) => browser.newContext({ baseURL: readBaseUrl(), viewport: DESKTOP });

test.describe('SCR-33 profile edge', () => {
  test('SCR-33 · FL-33P-01 · frame, roles, semantics of the loaded page (viewer)', async ({ browser }) => {
    test.setTimeout(120_000);
    const user = await withAdmin((admin) => accountUser(admin, 'p07-profile-1', 'viewer'));
    const context = await newContext(browser);
    const page = await context.newPage();
    try {
      await signInAccount(context, user);
      const snapshot = await snapshotProfile(context);
      const reads = countMeReads(page);
      const writes = recordWrites(page);
      let me: Record<string, unknown> = {};
      try {
        await test.step('[33P-B-003] loaded page, block order', async () => {
          me = await openAccount(page);
          await expect.soft(page.locator('section[aria-labelledby] h2')).toHaveText(BLOCKS.map((b) => b.title));
          await captureEvidence(page, 'E07_33P-B-003_block_order.png', { fullPage: true });
        });

        await test.step('[33P-B-004] block descriptions', async () => {
          for (const b of BLOCKS) await expect.soft(block(page, b.id).locator('h2 + p')).toHaveText(b.description);
          await captureEvidence(page, 'E07_33P-B-004_descriptions.png');
        });

        await test.step('[33P-G-001] N11 on open', async () => {
          expect.soft(reads.statuses(), 'GET /api/me on open').toEqual([200]);
          expect.soft(writes.list(), 'no non-GET /api/ request on mount').toEqual([]);
          await captureEvidence(page, 'E07_33P-G-001_one_read.png', { caption: `GET /api/me x${String(reads.statuses().length)}, writes ${String(writes.list().length)}` });
        });

        await test.step('[33P-G-002] mapping of an empty profile', async () => {
          await expect.soft(box(page, 'Chức danh')).toHaveValue('');
          await expect.soft(box(page, 'Điện thoại')).toHaveValue('');
          await expect.soft(page.getByRole('combobox', { name: LANGUAGE.label, exact: true })).toHaveText(LANGUAGE.vi);
          await expect.soft(block(page, 'account-profile').locator('img')).toHaveCount(0);
          await captureEvidence(page, 'E07_33P-G-002_empty_profile.png');
        });

        await test.step('[33P-B-014] idle chip', async () => {
          await expect.soft(saveIndicator(page)).toHaveText(IND.idle);
          await captureEvidence(page, 'E07_33P-B-014_idle_chip.png');
        });

        const fullName = typeof me.fullName === 'string' ? me.fullName : '';
        await test.step('[33P-B-026] initials avatar', async () => {
          const initials = avatarSpan(page, `Ảnh đại diện của ${fullName}`);
          await expect.soft(initials).toBeVisible();
          await expect.soft(initials).toHaveText(initialsOf(fullName));
          await expect.soft(initials).toHaveText(/^\p{Lu}{2}$/u);
          await expect.soft(block(page, 'account-profile').locator('img')).toHaveCount(0);
          await captureEvidence(page, 'E07_33P-B-026_initials_avatar.png');
        });

        await test.step('[33P-B-027] placeholders', async () => {
          await expect.soft(box(page, 'Chức danh')).toHaveAttribute('placeholder', PLACEHOLDER);
          await expect.soft(box(page, 'Điện thoại')).toHaveAttribute('placeholder', PLACEHOLDER);
          await captureEvidence(page, 'E07_33P-B-027_placeholders.png');
        });

        await test.step('[33P-B-028] e-mail row', async () => {
          await expect.soft(emailText(page, user.email)).toBeVisible();
          await expect.soft(box(page, 'Thư điện tử')).toHaveCount(0);
          await expect.soft(page.getByText(EMAIL_REASON_SHORT, { exact: true })).toBeVisible();
          await captureEvidence(page, 'E07_33P-B-028_email_row.png');
        });

        await test.step('[33P-A-009] no save button', async () => {
          await expect.soft(page.getByRole('button', { name: /^Lưu/u })).toHaveCount(0);
          await captureEvidence(page, 'E07_33P-A-009_no_save_button.png');
        });

        await test.step('[33P-A-010] a way out of the page', async () => {
          // Q1 = YES (2026-10-15): the page header holds a router <Link> to the dashboard, before the h1 (AS:107-113).
          const exit = accountHeader(page).getByRole('link', { name: BACK_TO_DASHBOARD, exact: true });
          await expect.soft(exit, 'a link back to the dashboard in the page header').toBeVisible();
          await expect.soft(exit).toHaveAttribute('href', ROUTES.dashboard);
          await captureEvidence(page, 'E07_33P-A-010_way_out.png');
        });

        await test.step('[33P-E-001] landmarks', async () => {
          await expect.soft(page.locator('main')).toHaveCount(1);
          await expect.soft(page.getByRole('heading', { level: 1 })).toHaveCount(1);
          await expect.soft(heading(page)).toBeVisible();
          await expect.soft(page.locator('section[aria-labelledby]')).toHaveCount(BLOCKS.length);
          // The toast stack is also role=region "Thông báo" (aria-live) inside <main> and shares the notifications block's name
          // (p07-rr after RF: 2 matches, BUG-P07-018): each block = a labelled <section> that is ALSO the region of that name.
          for (const b of BLOCKS) {
            const block = page.locator('main section[aria-labelledby]').and(page.getByRole('region', { name: b.title, exact: true }));
            await expect.soft(block).toBeVisible();
          }
          await captureEvidence(page, 'E07_33P-E-001_landmarks.png');
        });

        await test.step('[33P-E-002] tab order', async () => {
          await avatarInput(page).focus();
          await expect.soft(avatarInput(page)).toBeFocused();
          const order = [
            box(page, 'Họ tên'),
            box(page, 'Chức danh'),
            page.getByRole('button', { name: CHANGE_EMAIL, exact: true }),
            box(page, 'Điện thoại'),
            page.getByRole('combobox', { name: LANGUAGE.label, exact: true }),
          ];
          for (const next of order) {
            await page.keyboard.press('Tab');
            await expect.soft(next).toBeFocused();
          }
          await captureEvidence(page, 'E07_33P-E-002_tab_order.png');
        });

        await test.step('[33P-E-003] accessible names', async () => {
          for (const name of ['Họ tên', 'Chức danh', 'Điện thoại']) await expect.soft(box(page, name)).toBeVisible();
          await expect.soft(page.getByRole('combobox', { name: LANGUAGE.label, exact: true })).toBeVisible();
          await expect.soft(avatarInput(page)).toHaveAttribute('type', 'file');
          await expect.soft(page.getByRole('button', { name: CHANGE_EMAIL, exact: true })).toBeVisible();
          await captureEvidence(page, 'E07_33P-E-003_names.png');
        });

        await test.step('[33P-E-006] chip semantics', async () => {
          await expect.soft(accountHeader(page).locator('[role="status"]')).toHaveCount(1);
          await expect.soft(saveIndicator(page)).toHaveAttribute('aria-live', 'polite');
          await captureEvidence(page, 'E07_33P-E-006_chip_semantics.png');
        });

        await test.step('[33P-D-003] a viewer edits the name', async () => {
          await patchAfter(page, () => box(page, 'Họ tên').fill(`${fullName} QA`));
          await expect(saveIndicator(page)).toHaveText(IND.saved);
          await captureEvidence(page, 'E07_33P-D-003_viewer_edit.png');
        });
      } finally {
        reads.stop();
        writes.stop();
        await resetProfile(context, snapshot);
      }
    } finally {
      await context.close();
    }
  });

  test('SCR-33 · FL-33P-02 · anonymous entry, login return, deep links, loading (engineer)', async ({ browser }) => {
    test.setTimeout(140_000);
    const user = await withAdmin((admin) => accountUser(admin, 'p07-profile-2'));
    const context = await newContext(browser);
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    try {
      await test.step('[33P-D-001] anonymous visit', async () => {
        const reads = countMeReads(page);
        await page.goto(ROUTES.account);
        await expect.poll(() => pathOf(page.url())).toBe(loginUrl(ROUTES.account));
        await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeVisible();
        reads.stop();
        expect.soft(reads.statuses(), 'no GET /api/me without a session').toEqual([]);
        await captureEvidence(page, 'E07_33P-D-001_anonymous_redirect.png', { caption: loginUrl(ROUTES.account) });
      });

      await test.step('[33P-A-007] anonymous deep link, login, back to the block (flag)', async () => {
        // ⚑ the source builds `next` from pathname + search only (SB:406): the hash is dropped.
        await page.goto(`${ROUTES.account}#account-notifications`);
        await expect.poll(() => new URL(page.url()).pathname).toBe(ROUTES.login);
        await signInViaForm(page, user, pathOf(page.url()));
        await softly.poll(() => pathOf(page.url())).toBe(`${ROUTES.account}#account-notifications`);
        await expect.soft(page.locator('#account-notifications')).toBeFocused();
        await captureEvidence(page, 'E07_33P-A-007_deep_link_return.png');
      });

      await test.step('[33P-A-008] login from /login?next=%2Ftai-khoan', async () => {
        await context.clearCookies();
        await signInViaForm(page, user, loginUrl(ROUTES.account));
        await softly.poll(() => pathOf(page.url())).toBe(ROUTES.account);
        await expect.soft(heading(page)).toBeVisible();
        await expect.soft(box(page, 'Họ tên')).not.toHaveValue('');
        await captureEvidence(page, 'E07_33P-A-008_login_return.png');
      });

      await test.step('[33P-D-002] engineer sees the whole screen', async () => {
        await expect.soft(page.locator('section[aria-labelledby] h2')).toHaveText(BLOCKS.map((b) => b.title));
        await expect.soft(page.getByRole('heading', { name: 'Phiên đăng nhập', exact: true })).toHaveCount(0);
        await expect.soft(page.getByRole('heading', { name: 'Vùng nguy hiểm', exact: true })).toHaveCount(0);
        await expect.soft(saveIndicator(page)).toHaveText(IND.idle);
        await captureEvidence(page, 'E07_33P-D-002_engineer_screen.png', { fullPage: true });
      });

      // From here the GET /api/me of the next navigation is held (step 5), released in step 8.
      const gate = await holdMeReads(page);
      try {
        await test.step('[33P-B-001] loading: five skeleton blocks', async () => {
          await page.goto('about:blank'); // force a full reload: same URL + new hash would be a fragment jump
          await page.goto(`${ROUTES.account}#account-notifications`);
          await gate.seen;
          await expect(heading(page)).toBeVisible();
          for (const b of BLOCKS) {
            await expect.soft(page.getByRole('heading', { level: 2, name: b.title, exact: true })).toBeVisible();
            await expect.soft(block(page, b.id).locator('.animate-pulse').first()).toBeVisible();
          }
          const sections = page.locator('section[aria-labelledby]');
          await expect.soft(sections.getByRole('textbox')).toHaveCount(0);
          await expect.soft(sections.getByRole('combobox')).toHaveCount(0);
          await expect.soft(sections.getByRole('button')).toHaveCount(0);
          await captureEvidence(page, 'E07_33P-B-001_loading_skeleton.png', { caption: 'GET /api/me held' });
        });

        await test.step('[33P-B-002] loading is announced (flag)', async () => {
          // ⚑ Skeleton.tsx:19 leaves the signal to the caller and AS:86 gives none.
          const announced = page.locator('[aria-busy="true"]').or(page.getByRole('status').filter({ hasText: /đang tải/iu }));
          await expect.soft(announced.first(), 'aria-busy or a loading status while the skeleton shows').toBeAttached();
          await captureEvidence(page, 'E07_33P-B-002_loading_announced.png');
        });

        await test.step('[33P-A-006] hash present while loading: no focus move, no scroll', async () => {
          const state = await page.evaluate(() => ({ active: document.activeElement?.id ?? '', y: window.scrollY, hash: window.location.hash }));
          expect.soft(state.hash).toBe('#account-notifications');
          expect.soft(state.active, 'focus before the response').not.toBe('account-notifications');
          expect.soft(state.y, 'scroll before the response').toBe(0);
          await captureEvidence(page, 'E07_33P-A-006_hash_while_loading.png');
        });

        await test.step('[33P-A-003] release the response: heading focused', async () => {
          const read = page.waitForResponse((r) => r.request().method() === 'GET' && new URL(r.url()).pathname === '/api/me');
          gate.release();
          expect((await read).status(), 'GET /api/me').toBe(200);
          const target = page.locator('#account-notifications');
          await expect.soft(target).toBeFocused();
          await expect.soft(target).toHaveAttribute('tabindex', '-1');
          await expect.soft(target).toBeInViewport();
          await captureEvidence(page, 'E07_33P-A-003_hash_focus.png', { caption: 'focus: h2#account-notifications' });
        });
      } finally {
        await gate.dispose();
      }

      await test.step('[33P-A-004] hash change moves focus to "Mật khẩu"', async () => {
        await page.evaluate(() => {
          (window as unknown as { __p1Marker: number }).__p1Marker = 1;
          window.location.hash = 'account-password';
        });
        await expect.soft(page.locator('#account-password')).toBeFocused();
        const marker = await page.evaluate(() => (window as unknown as { __p1Marker?: number }).__p1Marker);
        expect.soft(marker, 'same document, no reload').toBe(1);
        await captureEvidence(page, 'E07_33P-A-004_hash_password.png');
      });

      await test.step('[33P-A-005] hashes that name nothing', async () => {
        const settle = (): Promise<void> => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        for (const hash of ['khong-co', 'account-sessions', 'account-danger']) {
          await page.evaluate((h) => {
            window.location.hash = h;
          }, hash);
          await settle();
          await expect.soft(page.locator('#account-password'), `focus stays after #${hash}`).toBeFocused();
        }
        expect.soft(pageErrors, 'no page error').toEqual([]);
        await expect.soft(page.locator('section[aria-labelledby]')).toHaveCount(BLOCKS.length);
        await expect.soft(page.locator('#account-sessions')).toHaveCount(0);
        await expect.soft(page.locator('#account-danger')).toHaveCount(0);
        await captureEvidence(page, 'E07_33P-A-005_unknown_hashes.png');
      });
    } finally {
      await context.close();
    }
  });

  test('SCR-33 · FL-33P-03 · single-field saves, bodies, language by keyboard, e-mail reason', async ({ browser }) => {
    test.setTimeout(180_000);
    const user = await withAdmin((admin) => accountUser(admin, 'p07-profile-3'));
    const context = await newContext(browser);
    const page = await context.newPage();
    const writes = recordWrites(page);
    try {
      await signInAccount(context, user);
      const snapshot = await snapshotProfile(context);
      try {
        await page.clock.install(); // before the first load; paused only around the flash steps
        await openAccount(page);
        const patches = (): unknown[] => writes.bodies('/api/me');
        const name = box(page, 'Họ tên');
        const phone = box(page, 'Điện thoại');
        const jobTitle = box(page, 'Chức danh');
        const language = page.getByRole('combobox', { name: LANGUAGE.label, exact: true });
        let enBody: unknown;

        await test.step('[33P-A-014] "Họ tên" valid edit', async () => {
          await patchAfter(page, () => name.fill(NAME_AN));
          await captureEvidence(page, 'E07_33P-A-014_fullname_saved.png');
        });

        await test.step('[33P-G-004] body: name only', async () => {
          expect.soft(patches()[0], 'PATCH body').toEqual({ fullName: NAME_AN });
        });

        await test.step('[33P-C-021] alt and initials', async () => {
          await withPausedClock(page, async () => {
            await name.fill('');
            await expect.soft(avatarSpan(page, 'Ảnh đại diện')).toBeVisible();
            await name.fill(NAME_AN);
            await expect.soft(avatarSpan(page, `Ảnh đại diện của ${NAME_AN}`)).toHaveText('NA');
          });
          await captureEvidence(page, 'E07_33P-C-021_alt_initials.png');
        });

        await test.step('[33P-B-025] row flash', async () => {
          await withPausedClock(page, async () => {
            await name.fill(`${NAME_AN}h`);
            await name.fill(NAME_AN); // back to the saved value: no PATCH, flash again
            await expect.soft(fieldRow(page, 'Họ tên')).toHaveClass(/bg-accent-wash/u);
            await page.clock.runFor(400);
            await expect.soft(fieldRow(page, 'Họ tên')).not.toHaveClass(/bg-accent-wash/u);
          });
          await captureEvidence(page, 'E07_33P-B-025_row_flash.png');
        });

        await test.step('[33P-A-015] "Điện thoại" valid edit', async () => {
          await patchAfter(page, () => phone.fill('0901234567'));
          await captureEvidence(page, 'E07_33P-A-015_phone_saved.png');
        });

        await test.step('[33P-G-005] body: phone only', async () => {
          expect.soft(patches()[1], 'PATCH body').toEqual({ phone: '0901234567' });
        });

        await test.step('[33P-A-016] "Điện thoại" cleared', async () => {
          await patchAfter(page, () => phone.fill(''));
          expect.soft(patches()[2], 'PATCH body').toEqual({ phone: '' });
          await expect.soft(phone).toHaveValue('');
          await expect.soft(phone).toHaveAttribute('placeholder', PLACEHOLDER);
          await captureEvidence(page, 'E07_33P-A-016_phone_cleared.png');
        });

        await test.step('[33P-A-017] "Chức danh" set then cleared', async () => {
          await patchAfter(page, () => jobTitle.fill('Kỹ sư'));
          const cleared = await patchAfter(page, () => jobTitle.fill(''));
          expect.soft(patches()[3], 'PATCH body').toEqual({ jobTitle: 'Kỹ sư' });
          expect.soft(patches()[4], 'PATCH body').toEqual({ jobTitle: '' });
          expect.soft(Object.keys(asRecord(await cleared.json(), 'PATCH /api/me')), 'response without jobTitle').not.toContain('jobTitle');
          await expect.soft(jobTitle).toHaveValue('');
          await expect.soft(jobTitle).toHaveAttribute('placeholder', PLACEHOLDER);
          await captureEvidence(page, 'E07_33P-A-017_jobtitle_cleared.png');
        });

        await test.step('[33P-E-008] "Ngôn ngữ" by keyboard', async () => {
          await language.focus();
          await page.keyboard.press('Enter');
          const list = page.getByRole('listbox');
          await expect.soft(list).toBeVisible();
          await expect.soft(list.getByRole('option', { name: LANGUAGE.vi, exact: true })).toHaveAttribute('aria-selected', 'true');
          await expect.soft(list.getByRole('option', { name: LANGUAGE.en, exact: true })).toHaveAttribute('aria-selected', 'false');
          await captureEvidence(page, 'E07_33P-E-008_listbox_open.png');
          const sent = await patchAfter(page, async () => {
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Enter');
          });
          enBody = sent.request().postDataJSON() as unknown;
          await expect.soft(list).toBeHidden();
          await page.keyboard.press('Enter'); // reopen: Esc must close it with no change
          await expect.soft(list).toBeVisible();
          await page.keyboard.press('Escape');
          await expect.soft(list).toBeHidden();
          await expect.soft(language).toHaveText(LANGUAGE.en);
        });

        await test.step('[33P-A-018] result of that selection, and back to Tiếng Việt', async () => {
          expect.soft(enBody, 'PATCH body').toEqual({ language: 'en' });
          await expect.soft(language).toHaveText(LANGUAGE.en);
          await patchAfter(page, async () => {
            await page.keyboard.press('Enter');
            await page.keyboard.press('ArrowDown'); // wraps from "Tiếng Anh" to "Tiếng Việt"
            await page.keyboard.press('Enter');
          });
          expect.soft(patches()[patches().length - 1], 'PATCH body').toEqual({ language: 'vi' });
          await expect.soft(language).toHaveText(LANGUAGE.vi);
          await captureEvidence(page, 'E07_33P-A-018_language_back.png');
        });

        await test.step('[33P-G-006] body: language only', async () => {
          expect.soft(enBody, 'first language PATCH body').toEqual({ language: 'en' });
        });

        await test.step('[33P-B-017] chip saved', async () => {
          await expect.soft(saveIndicator(page)).toHaveText(IND.saved);
          await captureEvidence(page, 'E07_33P-B-017_chip_saved.png');
        });

        await test.step('[33P-A-013] reload keeps the edit', async () => {
          await openAccount(page);
          await expect.soft(name).toHaveValue(NAME_AN);
          await expect.soft(phone).toHaveValue('');
          await expect.soft(jobTitle).toHaveValue('');
          await expect.soft(language).toHaveText(LANGUAGE.vi);
          await captureEvidence(page, 'E07_33P-A-013_after_reload.png');
        });

        await test.step('[33P-A-031] "Đổi thư điện tử" swaps the reason, sends nothing', async () => {
          const before = writes.list().length;
          await expect.soft(page.getByText(EMAIL_REASON_SHORT, { exact: true })).toBeVisible();
          await page.getByRole('button', { name: CHANGE_EMAIL, exact: true }).click();
          await expect.soft(page.getByText(EMAIL_REASON_LONG, { exact: true })).toBeVisible();
          await expect.soft(page.getByText(EMAIL_REASON_SHORT, { exact: true })).toHaveCount(0);
          await page.clock.runFor(1_000); // past the 800 ms debounce: a request would have gone out
          await page.evaluate(() => 0); // round trip: any request event has been delivered
          expect.soft(writes.list().length, 'no request').toBe(before);
          await captureEvidence(page, 'E07_33P-A-031_email_reason.png');
        });

        await test.step('[33P-G-007] no body carries email or avatarUrl', async () => {
          for (const body of patches()) {
            const keys = Object.keys(asRecord(body, 'PATCH body'));
            expect.soft(keys, 'PATCH keys').not.toContain('email');
            expect.soft(keys, 'PATCH keys').not.toContain('avatarUrl');
          }
          expect.soft(writes.list().every((line) => line === 'PATCH /api/me'), 'only PATCH /api/me was sent').toBe(true);
          await captureEvidence(page, 'E07_33P-G-007_bodies.png', { caption: `${String(patches().length)} PATCH bodies checked` });
        });
      } finally {
        await resetProfile(context, snapshot);
      }
    } finally {
      writes.stop();
      await context.close();
    }
  });
});
