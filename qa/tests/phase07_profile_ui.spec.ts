/**
 * Phase 07 — SCR-33 Account Settings (`/tai-khoan`), profile + avatar UI-verify flows (QA-07b pack P4; flows-C1
 * `phase07_profile_ui.spec.ts`): FL-33P-U1 (page states), FL-33P-U2 (avatar states), FL-33P-U3 (long data, field errors,
 * read error). Every state goes through `verifyUi` at 1920 / 1440 / 1024 / 768 (never 375), which re-opens the state per
 * width, shoots `U07_<row id>_<slug>_<width>.png` + `.json`, and fails softly on overflow / off-screen / broken images.
 * Each `open` also records the row's own measurements, asserted after the shots.
 *
 * Request budget per run (limits: login 120 / 60 s per IP; `me_avatar` 10 / 900 s per user; `PATCH /api/me` has none):
 *   - U1: 1 admin login + 2 pool logins (viewer p07-profile-1, engineer p07-profile-ui) + 1 reset login; 4 x PATCH (F-013, one
 *     per width); the viewer page sends no write.
 *   - U2: 1 admin login + 1 pool login + 1 API login; 1 invitation (fresh user `uiav-<runId>`, admin limit 30 / h);
 *     PUT avatar: 1 real (F-007, the last width) + uploads until the 10-per-window bucket answers 429 + 4 refused (F-008).
 *   - U3: 1 admin login + 1 pool login + 1 API login; 1 PATCH setup, 4 x 2 PATCH 422 (F-012), reset PATCH; F-003 is the only
 *     mocked answer (GET /api/me 500) and ends on the real retry.
 * Source: src/screens/account/AccountSettings/* (AS AccountSettings.tsx, PS ProfileSection.tsx, ARD AvatarReplaceDialog.tsx,
 * UAP useAccountPreferences.ts, UAS useAccountSettings.ts), FieldRow / Modal / Toast under src/components.
 */
import { expect, test, type Page, type Response } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { TEST_DATA_PREFIX } from './support/evidence';
import { signedInApi } from './support/api';
import { poolUser } from './support/phase03Seed';
import {
  AVATAR,
  BLOCK_IDS,
  CHANGE_EMAIL,
  EMAIL_REASON_LONG,
  ERROR_PAINT_TIMEOUT_MS,
  IND,
  LANGUAGE,
  LOAD_ERROR_TITLE,
  ME_RE,
  OFFLINE_FLUSH_TIMEOUT_MS,
  PHONE_MAX,
  PROBLEM,
  RETRY,
  TEXT_MAX,
  avatarDialog,
  avatarInput,
  block,
  box,
  emailText,
  fieldError,
  heading,
  openAccount,
  recordWrites,
  saveIndicator,
  undoToast,
} from './support/p07/account';
import {
  type Box,
  AVATAR_ANY_CONFIRM,
  AVATAR_LOCKED,
  AVATAR_SENDING,
  AVATAR_SET_CONFIRM,
  CHIP_FIELD_REJECTED,
  FOUR,
  GIF_FILE,
  PNG_FILE,
  RUN,
  U,
  adminApi,
  answerJson,
  interceptRequests,
  intersects,
  openUserSession,
  rect,
  resetPoolProfile,
  exhaustAvatarBucket,
  stableRect,
  viewportOf,
  within,
} from './support/p07/P4';
import { verifyUi } from './support/ui-verify';

const profileCard = (page: Page) => block(page, 'account-profile');

/** `rect` of the profile card and the viewport it sits in, for the per-width record. */
async function frame(page: Page): Promise<{ readonly vw: number; readonly vh: number; readonly card: Box }> {
  const v = await viewportOf(page);
  return { vw: v.w, vh: v.h, card: await rect(profileCard(page)) };
}

/* ================================================================= FL-33P-U1 */

test('SCR-33 · FL-33P-U1 · page states: default, loading, e-mail reason, language list, save success, offline', async ({ browser }) => {
  test.setTimeout(Math.max(120_000, 2 * 100_000));
  const admin = await adminApi();
  const viewer = await poolUser(admin, 'viewer', 'p07-profile-1'); // PV
  const editor = await poolUser(admin, 'engineer', 'p07-profile-ui'); // U-ui
  await admin.dispose();
  const ro = await openUserSession(browser, viewer);
  const rw = await openUserSession(browser, editor);
  const editorApi = await signedInApi(editor.email, editor.password);
  const writes = recordWrites(ro.page);
  try {
    await test.step('[33P-F-001] default loaded page: chip + five cards, two columns >= 1024, labels stacked at 768, card <= 720 centred', async () => {
      const seen: Array<Awaited<ReturnType<typeof frame>> & { cards: boolean[]; label: Box; field: Box }> = [];
      await verifyUi(ro.page, U('33P-F-001', 'default'), async (p) => {
        await openAccount(p);
        await expect(saveIndicator(p)).toHaveText(IND.idle);
        const label = await rect(profileCard(p).getByText('Họ tên', { exact: true }).first());
        const field = await rect(box(p, 'Họ tên'));
        const cards = await Promise.all(BLOCK_IDS.map((id) => block(p, id).isVisible()));
        seen.push({ ...(await frame(p)), cards, label, field });
      }, FOUR);
      expect.soft(seen.map((m) => m.vw), 'every width was measured').toHaveLength(FOUR.length);
      for (const m of seen) {
        expect.soft(m.cards, `${String(m.vw)}: five cards`).toEqual([true, true, true, true, true]);
        expect.soft(m.card.width, `${String(m.vw)}: card <= 720`).toBeLessThanOrEqual(720);
        expect.soft(Math.abs((m.card.left + m.card.right) / 2 - m.vw / 2), `${String(m.vw)}: card centred`).toBeLessThanOrEqual(2);
        if (m.vw >= 1024) {
          expect.soft(m.label.right, `${String(m.vw)}: label left of the field (two columns)`).toBeLessThanOrEqual(m.field.left + 1);
          expect.soft(m.field.left - m.card.left, `${String(m.vw)}: field starts after the 40 % label column`).toBeGreaterThan(m.card.width * 0.35);
        } else {
          // BUG-502 (fix/qa07-a, FieldRow isStacked): label above the field, field the full card width (card padding 20 + 20).
          expect.soft(m.label.bottom, `${String(m.vw)}: label above the field`).toBeLessThanOrEqual(m.field.top + 1);
          expect.soft(m.field.width, `${String(m.vw)}: field spans the card`).toBeGreaterThanOrEqual(m.card.width - 42);
        }
      }
    });

    await test.step('[33P-F-002] loading (GET /api/me held): five skeleton cards, headings readable', async () => {
      const hold = await interceptRequests(ro.page, '/api/me', 'GET', (r) => r.continue(), { hold: true });
      const seen: Array<{ vw: number; headings: Array<Box> }> = [];
      try {
        await verifyUi(ro.page, U('33P-F-002', 'loading'), async (p) => {
          const before = hold.count();
          await p.goto(ROUTES.account);
          await expect(heading(p)).toBeVisible();
          await expect.poll(() => hold.count()).toBeGreaterThan(before);
          const headings: Box[] = [];
          for (const id of BLOCK_IDS) {
            const h2 = block(p, id).getByRole('heading', { level: 2 });
            await expect(h2).toBeVisible();
            headings.push(await rect(h2));
          }
          await expect(box(p, 'Chức danh')).toHaveCount(0); // the form is not drawn yet
          seen.push({ vw: (await viewportOf(p)).w, headings });
        }, FOUR);
      } finally {
        await hold.release();
      }
      for (const m of seen) {
        expect.soft(m.headings.length, `${String(m.vw)}: five headings`).toBe(BLOCK_IDS.length);
        expect.soft(m.headings.every((h) => h.width > 20 && h.height >= 12), `${String(m.vw)}: headings readable`).toBe(true);
      }
      // Paired real answer: the last parked GET is released and the real form paints.
      await expect(box(ro.page, 'Chức danh')).toBeVisible();
    });

    await test.step('[33P-F-009] "Đổi thư điện tử": the long reason wraps inside the row, the button stays inside the card', async () => {
      const seen: Array<{ vw: number; card: Box; reason: Box; button: Box }> = [];
      await verifyUi(ro.page, U('33P-F-009', 'email_reason'), async (p) => {
        await openAccount(p);
        const button = p.getByRole('button', { name: CHANGE_EMAIL, exact: true });
        await button.click();
        const reason = profileCard(p).getByText(EMAIL_REASON_LONG, { exact: true });
        await expect(reason).toBeVisible();
        const f = await frame(p);
        seen.push({ vw: f.vw, card: f.card, reason: await rect(reason), button: await rect(button) });
      }, FOUR);
      for (const m of seen) {
        expect.soft(within(m.reason, m.card), `${String(m.vw)}: reason inside the card`).toBe(true);
        expect.soft(within(m.button, m.card), `${String(m.vw)}: "${CHANGE_EMAIL}" inside the card`).toBe(true);
        expect.soft(m.reason.height, `${String(m.vw)}: the long reason wraps`).toBeGreaterThan(18);
      }
    });

    await test.step('[33P-F-010] language list open: a listbox with two options fully inside the viewport', async () => {
      const seen: Array<{ vw: number; vh: number; list: Box; options: number }> = [];
      await verifyUi(ro.page, U('33P-F-010', 'language_open'), async (p) => {
        await openAccount(p);
        const trigger = p.getByRole('combobox', { name: LANGUAGE.label, exact: true });
        await trigger.click();
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');
        const list = p.getByRole('listbox');
        await expect(list).toBeVisible();
        const v = await viewportOf(p);
        seen.push({ vw: v.w, vh: v.h, list: await stableRect(list), options: await list.getByRole('option').count() });
      }, FOUR);
      for (const m of seen) {
        expect.soft(m.options, `${String(m.vw)}: two options`).toBe(2);
        expect.soft(m.list.left >= 0 && m.list.top >= 0 && m.list.right <= m.vw && m.list.bottom <= m.vh, `${String(m.vw)}: listbox inside the viewport`).toBe(true);
      }
      expect.soft(writes.list(), 'the read-only states sent no write').toEqual([]);
    });

    await test.step('[33P-F-013] save success: chip "Đã lưu lúc" in the header, 320 px toast bottom-right clear of fields and chip', async () => {
      const seen: Array<{ vw: number; vh: number; toast: Box; field: Box; chip: Box }> = [];
      await verifyUi(rw.page, U('33P-F-013', 'saved_toast'), async (p) => {
        await openAccount(p);
        const saved = waitForApi(p, 'PATCH', ME_RE, [200]);
        await box(p, 'Chức danh').fill(`${TEST_DATA_PREFIX}ui-${String((await viewportOf(p)).w)}`); // a value that differs from the previous width
        await saved;
        await expect(saveIndicator(p)).toHaveText(IND.saved);
        const toast = undoToast(p);
        await expect(toast).toBeVisible();
        const v = await viewportOf(p);
        seen.push({ vw: v.w, vh: v.h, toast: await stableRect(toast), field: await rect(box(p, 'Chức danh')), chip: await rect(saveIndicator(p)) });
      }, FOUR, { fullPage: false });
      for (const m of seen) {
        expect.soft(Math.round(m.toast.width), `${String(m.vw)}: toast 320 px wide`).toBe(320);
        expect.soft(m.toast.left > m.vw / 2 && m.toast.top > m.vh / 2, `${String(m.vw)}: toast bottom-right`).toBe(true);
        expect.soft(intersects(m.toast, m.field), `${String(m.vw)}: toast clear of "Chức danh"`).toBe(false);
        expect.soft(intersects(m.toast, m.chip), `${String(m.vw)}: toast clear of the chip`).toBe(false);
      }
    });

    await test.step('[33P-F-014] offline chip: "Ngoại tuyến — sẽ lưu khi có mạng", the header wraps without overlap', async () => {
      const seen: Array<{ vw: number; h1: Box; chip: Box }> = [];
      await verifyUi(rw.page, U('33P-F-014', 'offline'), async (p) => {
        await rw.context.setOffline(false);
        await openAccount(p);
        await rw.context.setOffline(true);
        await box(p, 'Chức danh').fill(`${TEST_DATA_PREFIX}offline-${String((await viewportOf(p)).w)}`);
        await expect(saveIndicator(p)).toHaveText(IND.offline, { timeout: OFFLINE_FLUSH_TIMEOUT_MS });
        seen.push({ vw: (await viewportOf(p)).w, h1: await rect(heading(p)), chip: await rect(saveIndicator(p)) });
      }, FOUR);
      await rw.context.setOffline(false);
      for (const m of seen) {
        expect.soft(intersects(m.h1, m.chip), `${String(m.vw)}: chip clear of the title`).toBe(false);
        expect.soft(m.chip.right, `${String(m.vw)}: chip inside the viewport`).toBeLessThanOrEqual(m.vw);
      }
    });
  } finally {
    await rw.context.setOffline(false);
    await ro.context.close();
    await rw.context.close(); // before the reset: an unsent offline edit must die with the page
    await resetPoolProfile(editorApi, editor, (text) => test.info().annotations.push({ type: 'cleanup', description: text }));
    await editorApi.dispose();
    writes.stop();
  }
});

/* ================================================================= FL-33P-U2 */

test('SCR-33 · FL-33P-U2 · avatar states', async ({ browser }) => {
  test.setTimeout(Math.max(120_000, 2 * 90_000));
  const admin = await adminApi();
  const user = await poolUser(admin, 'engineer', `p07-profile-uiav-${RUN}`); // FA: no avatar yet
  await admin.dispose();
  const { context, page } = await openUserSession(browser, user);
  const api = await signedInApi(user.email, user.password);
  const avatarPut = (response: Response): boolean =>
    new URL(response.url()).pathname === '/api/me/avatar' && response.request().method() === 'PUT';
  try {
    await test.step('[33P-F-004] pick a PNG: dialog "Đặt ảnh đại diện?" 480 px, preview 96 px, "Huỷ" + "Đặt ảnh"', async () => {
      const seen: Array<{ vw: number; dialog: Box; preview: Box; buttons: string[] }> = [];
      await verifyUi(page, U('33P-F-004', 'avatar_set'), async (p) => {
        await openAccount(p);
        await avatarInput(p).setInputFiles(PNG_FILE);
        const dialog = avatarDialog(p);
        await expect(dialog).toBeVisible();
        const preview = dialog.getByRole('img', { name: AVATAR.preview, exact: true });
        await expect(preview).toBeVisible();
        seen.push({
          vw: (await viewportOf(p)).w,
          dialog: await stableRect(dialog),
          preview: await stableRect(preview),
          buttons: (await dialog.getByRole('button').allInnerTexts()).map((t) => t.trim()),
        });
      }, FOUR, { fullPage: false });
      for (const m of seen) {
        expect.soft(Math.round(m.dialog.width), `${String(m.vw)}: dialog 480 px`).toBe(480); // ARD:36 width={480}
        expect.soft([Math.round(m.preview.width), Math.round(m.preview.height)], `${String(m.vw)}: preview 96 px`).toEqual([96, 96]); // h-24 w-24
        // BUG-501 (fix/qa07-a): no avatar yet -> the confirm button reads "Đặt ảnh", not "Thay ảnh".
        expect.soft(m.buttons, `${String(m.vw)}: footer buttons`).toEqual([AVATAR.cancel, AVATAR_SET_CONFIRM]);
      }
    });

    await test.step('[33P-F-006] pick a GIF: "Chỉ nhận ảnh PNG hoặc JPEG." under the avatar row, clear of "Họ tên"', async () => {
      const seen: Array<{ vw: number; alert: Box; name: Box; dialogs: number }> = [];
      await verifyUi(page, U('33P-F-006', 'avatar_rejected'), async (p) => {
        await openAccount(p);
        await avatarInput(p).setInputFiles(GIF_FILE); // `accept` only filters the OS picker; UAP:onAvatarFileSelected checks the type
        const alert = p.getByRole('alert').filter({ hasText: AVATAR.typeUnsupported });
        await expect(alert).toBeVisible();
        seen.push({ vw: (await viewportOf(p)).w, alert: await rect(alert), name: await rect(box(p, 'Họ tên')), dialogs: await avatarDialog(p).count() });
      }, FOUR);
      for (const m of seen) {
        expect.soft(m.alert.bottom, `${String(m.vw)}: alert above "Họ tên"`).toBeLessThanOrEqual(m.name.top + 1);
        expect.soft(m.dialogs, `${String(m.vw)}: no dialog for a rejected type`).toBe(0);
      }
    });

    await test.step('[33P-F-007] confirm with the PUT held: "Đang tải ảnh lên…" beside the avatar, confirm button loading', async () => {
      const hold = await interceptRequests(page, '/api/me/avatar', 'PUT', (r) => r.continue(), { hold: true });
      const seen: Array<{ vw: number; status: Box; avatar: Box; confirmDisabled: boolean }> = [];
      try {
        await verifyUi(page, U('33P-F-007', 'avatar_sending'), async (p) => {
          const before = hold.count();
          await openAccount(p);
          await avatarInput(p).setInputFiles(PNG_FILE);
          const dialog = avatarDialog(p);
          await expect(dialog).toBeVisible();
          await dialog.getByRole('button', { name: AVATAR_ANY_CONFIRM }).click();
          await expect.poll(() => hold.count()).toBeGreaterThan(before);
          const status = p.getByRole('status').filter({ hasText: AVATAR_SENDING });
          await expect(status).toBeVisible();
          seen.push({
            vw: (await viewportOf(p)).w,
            status: await rect(status),
            avatar: await rect(profileCard(p).getByRole('img').first()),
            confirmDisabled: await dialog.getByRole('button').last().isDisabled(),
          });
        }, FOUR, { fullPage: false });
      } finally {
        // The parked PUT of the last width goes out now (the earlier ones died with their pages): one real upload, 200.
        const answered = page.waitForResponse(avatarPut);
        await hold.release();
        expect((await answered).status(), 'the released PUT /api/me/avatar').toBe(200);
      }
      for (const m of seen) {
        expect.soft(m.status.left, `${String(m.vw)}: status right of the avatar`).toBeGreaterThanOrEqual(m.avatar.right - 1);
        expect.soft(m.status.top < m.avatar.bottom && m.status.bottom > m.avatar.top, `${String(m.vw)}: status on the avatar row`).toBe(true);
        expect.soft(m.confirmDisabled, `${String(m.vw)}: confirm button loading (disabled)`).toBe(true);
      }
      await expect(avatarDialog(page)).toBeHidden();
    });

    await test.step('[33P-F-005] after the 200, pick again: "Thay ảnh đại diện?", "Ảnh cũ không khôi phục được.", "Thay ảnh"', async () => {
      const seen: Array<{ vw: number; warning: number; buttons: string[] }> = [];
      await verifyUi(page, U('33P-F-005', 'avatar_replace'), async (p) => {
        const me = await openAccount(p);
        expect(typeof me.avatarUrl, 'GET /api/me carries the avatar set by F-007').toBe('string');
        await avatarInput(p).setInputFiles(PNG_FILE);
        const dialog = p.getByRole('dialog', { name: AVATAR.replaceTitle, exact: true });
        await expect(dialog).toBeVisible();
        seen.push({
          vw: (await viewportOf(p)).w,
          warning: await dialog.getByText(AVATAR.replaceWarning, { exact: true }).count(),
          buttons: (await dialog.getByRole('button').allInnerTexts()).map((t) => t.trim()),
        });
      }, FOUR, { fullPage: false });
      for (const m of seen) {
        expect.soft(m.warning, `${String(m.vw)}: replace warning`).toBe(1);
        expect.soft(m.buttons, `${String(m.vw)}: footer buttons`).toEqual([AVATAR.cancel, AVATAR.confirm]);
      }
    });

    await test.step('[33P-F-008] 11th pick -> 429: "Đã thử nhiều lần…", input disabled, avatar row not clipped', async () => {
      await exhaustAvatarBucket(api); // F-007 spent some of the 10 per 900 s: fill the rest, the next PUT from the UI is refused
      const seen: Array<{ vw: number; alert: Box; card: Box; avatar: Box; disabled: boolean }> = [];
      await verifyUi(page, U('33P-F-008', 'avatar_locked'), async (p) => {
        await openAccount(p);
        await avatarInput(p).setInputFiles(PNG_FILE);
        const dialog = avatarDialog(p);
        await expect(dialog).toBeVisible();
        const limited = waitForApi(p, 'PUT', /^\/api\/me\/avatar$/u, [429]);
        await dialog.getByRole('button', { name: AVATAR_ANY_CONFIRM }).click();
        await limited;
        const alert = p.getByRole('alert').filter({ hasText: AVATAR_LOCKED });
        await expect(alert).toBeVisible();
        await expect(avatarInput(p)).toBeDisabled();
        seen.push({
          vw: (await viewportOf(p)).w,
          alert: await rect(alert),
          card: await rect(profileCard(p)),
          avatar: await rect(profileCard(p).getByRole('img').first()),
          disabled: await avatarInput(p).isDisabled(),
        });
      }, FOUR);
      for (const m of seen) {
        expect.soft(m.disabled, `${String(m.vw)}: avatar input disabled`).toBe(true);
        expect.soft(within(m.alert, m.card) && within(m.avatar, m.card), `${String(m.vw)}: avatar row inside the card, not clipped`).toBe(true);
      }
    });
  } finally {
    await context.close();
    await api.dispose();
  }
});

/* ================================================================= FL-33P-U3 */

const LONG_NAME = `${`${TEST_DATA_PREFIX}u07-long ${'Nguyễn Thị Phương Thảo Bình Minh '.repeat(5)}`.slice(0, TEXT_MAX - 1)}A`;
const LONG_JOB_TITLE = `${'Kiến trúc sư trưởng phụ trách thiết kế mặt bằng khu phức hợp văn phòng '.repeat(3).slice(0, TEXT_MAX - 1)}B`;
const LONG_PHONE = `+84 ${'9'.repeat(PHONE_MAX - 4)}`;

test('SCR-33 · FL-33P-U3 · [mocked response] only in step 3 · long data, field errors, read error', async ({ browser }) => {
  test.setTimeout(Math.max(120_000, 2 * 60_000));
  if (LONG_NAME.length !== TEXT_MAX || LONG_JOB_TITLE.length !== TEXT_MAX || LONG_PHONE.length !== PHONE_MAX) {
    throw new Error(`long data: name ${String(LONG_NAME.length)}, title ${String(LONG_JOB_TITLE.length)}, phone ${String(LONG_PHONE.length)}`);
  }
  const admin = await adminApi();
  const user = await poolUser(admin, 'engineer', `p07-profile-long-${'x'.repeat(30)}`); // FL: e-mail local part ~60 chars
  await admin.dispose();
  const { context, page } = await openUserSession(browser, user);
  const api = await signedInApi(user.email, user.password);
  try {
    const setup = await api.patch('/api/me', { data: { fullName: LONG_NAME, jobTitle: LONG_JOB_TITLE, phone: LONG_PHONE } });
    expect(setup.status(), 'setup: PATCH /api/me with the long values').toBe(200);

    await test.step('[33P-F-011] long data (name 120, title 120, phone 32, ~60-char e-mail): no overflow, "Đổi thư điện tử" inside the card', async () => {
      const seen: Array<{ vw: number; card: Box; button: Box; email: Box; fields: Array<Box> }> = [];
      await verifyUi(page, U('33P-F-011', 'long_data'), async (p) => {
        await openAccount(p);
        await expect(box(p, 'Họ tên')).toHaveValue(LONG_NAME);
        await expect(box(p, 'Chức danh')).toHaveValue(LONG_JOB_TITLE);
        await expect(box(p, 'Điện thoại')).toHaveValue(LONG_PHONE);
        const fields = [await rect(box(p, 'Họ tên')), await rect(box(p, 'Chức danh')), await rect(box(p, 'Điện thoại'))];
        seen.push({
          vw: (await viewportOf(p)).w,
          card: await rect(profileCard(p)),
          button: await rect(p.getByRole('button', { name: CHANGE_EMAIL, exact: true })),
          email: await rect(emailText(p, user.email)),
          fields,
        });
      }, FOUR);
      for (const m of seen) {
        // BUG-497 desktop part (fix/qa07-a: `min-w-0 flex-1` on the e-mail input wrapper): the long e-mail is cut with an ellipsis, the button stays in the card.
        expect.soft(within(m.button, m.card), `${String(m.vw)}: "${CHANGE_EMAIL}" inside the card`).toBe(true);
        expect.soft(m.email.right, `${String(m.vw)}: e-mail ends before the button`).toBeLessThanOrEqual(m.button.left + 1);
        expect.soft(m.fields.every((f) => within(f, m.card)), `${String(m.vw)}: the three long fields inside the card`).toBe(true);
      }
    });

    await test.step('[33P-F-012] "Chức danh" 121 and "Điện thoại" 33: both messages under their fields, chip "Chưa lưu vì còn ô cần sửa"', async () => {
      const seen: Array<{ vw: number; phoneMsg: Box; phone: Box; titleMsg: Box; title: Box; chip: string }> = [];
      await verifyUi(page, U('33P-F-012', 'field_errors'), async (p) => {
        await openAccount(p);
        // BE reports the FIRST invalid field in model order (fullName, jobTitle, phone), and the FE keeps a field's message until that
        // field is edited: the phone goes first (422 field phone), then the title (422 field jobTitle) so both messages end up on screen.
        const phoneRejected = waitForApi(p, 'PATCH', ME_RE, [422]);
        await box(p, 'Điện thoại').fill('9'.repeat(PHONE_MAX + 1));
        await phoneRejected;
        await expect(fieldError(p, PROBLEM.phone)).toBeVisible();
        const titleRejected = waitForApi(p, 'PATCH', ME_RE, [422]);
        await box(p, 'Chức danh').fill('A'.repeat(TEXT_MAX + 1));
        await titleRejected;
        await expect(fieldError(p, PROBLEM.jobTitle)).toBeVisible();
        await expect(fieldError(p, PROBLEM.phone)).toBeVisible();
        seen.push({
          vw: (await viewportOf(p)).w,
          phoneMsg: await rect(fieldError(p, PROBLEM.phone)),
          phone: await rect(box(p, 'Điện thoại')),
          titleMsg: await rect(fieldError(p, PROBLEM.jobTitle)),
          title: await rect(box(p, 'Chức danh')),
          chip: (await saveIndicator(p).innerText()).trim(),
        });
      }, FOUR);
      for (const m of seen) {
        expect.soft(m.phoneMsg.top, `${String(m.vw)}: phone message under the phone field`).toBeGreaterThanOrEqual(m.phone.bottom - 1);
        expect.soft(m.titleMsg.top, `${String(m.vw)}: title message under the title field`).toBeGreaterThanOrEqual(m.title.bottom - 1);
        expect.soft(m.chip, `${String(m.vw)}: rejected chip`).toBe(CHIP_FIELD_REJECTED); // BUG-503 (fix/qa07-a): no promise to retry a 422
      }
    });

    await test.step('[33P-F-003] [mocked response] GET /api/me 500: banner full card width with "Thử lại", no chip', async () => {
      // paired real: the "Thử lại" click below is answered by the real GET /api/me (route removed); read-error copy is also
      // exercised in phase07_profile_mocked_edge.spec.ts (FL-33P-11) and the real 200 in step [33P-F-011].
      const read500 = await interceptRequests(
        page,
        '/api/me',
        'GET',
        answerJson(500, { code: 'INTERNAL', message: 'qa mocked read error', requestId: 'qa-p4-u3-500' }),
        { hold: false },
      );
      const seen: Array<{ vw: number; banner: Box; header: Box; chips: number; retry: number }> = [];
      try {
        await verifyUi(page, U('33P-F-003', 'load_error'), async (p) => {
          await p.goto(ROUTES.account);
          const banner = p.getByRole('alert').filter({ hasText: LOAD_ERROR_TITLE });
          await expect(banner).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS }); // react-query retries a failed read once first
          seen.push({
            vw: (await viewportOf(p)).w,
            banner: await rect(banner),
            header: await rect(p.locator('header').filter({ has: heading(p) })),
            chips: await saveIndicator(p).count(),
            retry: await banner.getByRole('button', { name: RETRY, exact: true }).count(),
          });
        }, FOUR);
      } finally {
        await read500.release();
      }
      for (const m of seen) {
        expect.soft(m.banner.width, `${String(m.vw)}: banner spans the card width`).toBeGreaterThanOrEqual(m.header.width - 2);
        expect.soft(m.retry, `${String(m.vw)}: "${RETRY}" in the banner`).toBe(1);
        expect.soft(m.chips, `${String(m.vw)}: no save chip next to a load error`).toBe(0); // BUG-504 (fix/qa07-a)
      }
      await page.getByRole('button', { name: RETRY, exact: true }).click();
      await expect(box(page, 'Chức danh')).toBeVisible(); // the real answer
    });
  } finally {
    await context.close(); // before the reset: the invalid draft of F-012 must not be flushed
    await resetPoolProfile(api, user, (text) => test.info().annotations.push({ type: 'cleanup', description: text }));
    await api.dispose();
  }
});
