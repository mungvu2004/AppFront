/**
 * Phase 7 - SCR-33 `/tai-khoan` avatar, EDGE layer, real stack (QA-07b pack P3): FL-33P-08 (set, cancel, keyboard, replace,
 * JPEG, persistence) and FL-33P-09 (rejects, local and server, and the 10 / 900 s rate limit). One `test()` per flow, one
 * `test.step('[<row id>] ...')` per catalog row in the flows order (`flows-C1.md`, `catalog-C1.md` of QA-07b).
 * Short names (FE, under `src/screens/account/AccountSettings/`): PS ProfileSection.tsx, ARD AvatarReplaceDialog.tsx,
 * UAP useAccountPreferences.ts. BE: apps/api/me/avatar.py.
 *
 * Users: each flow has its OWN fresh pool engineer without an avatar (the avatar cannot be deleted), slots
 * `p07-profile-av-<runId>-r<retry>` (FL-33P-08) and `p07-profile-rl-<runId>-r<retry>` (FL-33P-09, spends its own avatar rate bucket).
 * Both need a run id not used before (a slot already holding an avatar fails the "fresh user" precondition).
 * Nothing is mocked. Nothing edits the profile, so there is nothing to reset.
 *
 * Request budget per run (BE limits): `POST /api/auth/login` per IP 120 / 60 s: 2 admin API + 2 flow sessions = 4.
 * `POST /api/users/invitations` 30 / 3600 s per admin: 2 (one per fresh slot). `PUT /api/me/avatar` `me_avatar` 10 / 900 s
 * per user: FL-33P-08 3, FL-33P-09 10 (5 server rejects + 5 seeded) + the 11th that is answered 429.
 * `PATCH /api/me`: 0. `POST /api/auth/refresh`: ~1 per page load + 1 for the seeding.
 *
 * `page.clock` (installed, time flowing) only jumps the 800 ms debounce (FL-33P-08) and the 60 s avatar lock (FL-33P-09).
 */
import { expect, test } from '@playwright/test';

import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { RUN_FRESH, attachJson, captureEvidence } from './support/evidence';
import { corruptPng, oversizePng } from './support/phase03Seed';
import {
  AVATAR,
  AVATAR_API,
  AVATAR_MAX_FILE_BYTES,
  ME_RE,
  asRecord,
  avatarAltOf,
  avatarDialog,
  avatarInput,
  block,
  box,
  fieldError,
  heading,
  holdResponse,
  IND,
  saveIndicator,
  openAccount,
  recordWrites,
} from './support/p07/account';
import {
  AVATAR_MSG,
  DEBOUNCE_JUMP_MS,
  UPLOADING,
  cancelAvatarButton,
  closeP3Session,
  confirmAvatarButton,
  ev,
  gifAsPng,
  notAnImage,
  openP3Session,
  pickAvatar,
  seedAvatarUploads,
  tinyJpeg,
  tinyPng,
  type PickableFile,
} from './support/p07/P3';

const AVATAR_PUT = /^\/api\/me\/avatar$/u;
const PUT_LINE = `PUT ${AVATAR_API}`;

test('SCR-33 · FL-33P-08 · avatar: set, cancel, keyboard, replace, JPEG, persistence', async ({ browser }) => {
  test.setTimeout(180_000);
  const s = await openP3Session(browser, `p07-profile-av-${RUN_FRESH}-r${test.info().retry}`);
  const { page } = s;
  try {
    await page.clock.install();
    const me = await openAccount(page);
    const name = typeof me.fullName === 'string' ? me.fullName : '';
    expect(me.avatarUrl, 'precondition: a fresh user has no avatar (use a new E2E_RUN_ID)').toBeUndefined();
    const writes = recordWrites(page);
    const puts = (): number => writes.list().filter((w) => w === PUT_LINE).length;
    const patches = (): string[] => writes.list().filter((w) => w.startsWith('PATCH'));
    const dialog = avatarDialog(page);
    const profile = block(page, 'account-profile');
    const insideDialog = (): Promise<boolean> => page.evaluate(() => document.activeElement?.closest('[role="dialog"]') != null);
    let avatarUrl = '';
    let jpegBase64 = '';

    await test.step('[33P-A-032] pick TINY_PNG -> "Đặt ảnh đại diện?" dialog with warning and preview, no request', async () => {
      await pickAvatar(page, tinyPng());
      await expect(page.getByRole('dialog', { name: AVATAR.setTitle, exact: true })).toBeVisible(); // ARD:30
      await expect(dialog.getByText(AVATAR.setWarning, { exact: true })).toBeVisible(); // ARD:31-33
      await expect(dialog.getByRole('img', { name: AVATAR.preview, exact: true })).toBeVisible(); // ARD:43
      expect(writes.list(), 'a pick sends nothing').toEqual([]);
      await captureEvidence(page, ev('33P-A-032', 'set-dialog'));
    });

    await test.step('[33P-A-033] confirm button says "Đặt ảnh", not "Thay ảnh" (BUG-501, red until fix/qa07-a merges)', async () => {
      expect.soft(await dialog.getByRole('button', { name: 'Đặt ảnh', exact: true }).count(), 'button "Đặt ảnh"').toBe(1);
      expect.soft(await dialog.getByRole('button', { name: 'Thay ảnh', exact: true }).count(), 'no "Thay ảnh" before an avatar exists').toBe(0);
      await captureEvidence(page, ev('33P-A-033', 'confirm-label'));
    });

    await test.step('[33P-E-009] dialog semantics: role, aria-modal, name, focus inside, Tab and Shift+Tab stay inside', async () => {
      await expect.soft(dialog).toHaveAttribute('aria-modal', 'true'); // Modal.tsx:137-138
      await expect.soft(page.getByRole('dialog', { name: AVATAR.setTitle, exact: true })).toHaveCount(1);
      expect.soft(await insideDialog(), 'focus starts inside the dialog').toBe(true);
      for (let i = 0; i < 4; i += 1) {
        await page.keyboard.press('Tab');
        expect.soft(await insideDialog(), `Tab ${String(i + 1)} stays inside`).toBe(true);
      }
      for (let i = 0; i < 4; i += 1) {
        await page.keyboard.press('Shift+Tab');
        expect.soft(await insideDialog(), `Shift+Tab ${String(i + 1)} stays inside`).toBe(true);
      }
      await captureEvidence(page, ev('33P-E-009', 'dialog-focus'));
    });

    await test.step('[33P-A-036] "Huỷ": dialog gone, no PUT (evidence while open, then after)', async () => {
      await captureEvidence(page, ev('33P-A-036', 'dialog-open-before-cancel')); // BUG-505: the open state
      await cancelAvatarButton(page).click();
      await expect.soft(dialog).toBeHidden();
      expect.soft(puts(), 'Huỷ sends no PUT').toBe(0);
      await captureEvidence(page, ev('33P-A-036', 'dialog-closed-after-cancel'));
    });

    await test.step('[33P-E-010] after "Huỷ" focus is back on the "Đổi ảnh" file input', async () => {
      await expect.soft(avatarInput(page)).toBeFocused();
      await captureEvidence(page, ev('33P-E-010', 'focus-returned'));
    });

    await test.step('[33P-A-037] pick again, Esc closes the dialog, no PUT', async () => {
      await pickAvatar(page, tinyPng('p3-esc.png'));
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape'); // ARD:36 onClose = onCancel
      await expect.soft(dialog).toBeHidden();
      expect.soft(puts(), 'Esc sends no PUT').toBe(0);
      // Evidence only (no catalog row asserts the focus after Esc; 33P-E-010 covers Huỷ): Vite shows the focus back on the
      // file input after Esc, the stack did not once (p07-rr 16:25Z) - this attachment settles it.
      await attachJson('E07_33P-A-037_focus-after-esc.json', {
        active: await page.evaluate(() => {
          const a = document.activeElement as HTMLElement | null;
          return a ? { tag: a.tagName, id: a.id, label: a.getAttribute('aria-label'), text: (a.textContent ?? '').slice(0, 40) } : null;
        }),
      });
      await captureEvidence(page, ev('33P-A-037', 'escaped'));
    });

    // The chooser half of 33P-E-004 (Enter opens one single-file chooser) runs in e2e/qa07/avatar.vite.spec.ts: on the
    // stack one --repeat copy waited 30 s for "filechooser" with the focus already green (BUG-P07-019, qa-phase v4 rule 7).
    await test.step('[33P-E-004] Tab to the file input: overlay "Đổi ảnh" with ring (chooser: avatar.vite.spec.ts)', async () => {
      await box(page, 'Họ tên').focus();
      await page.keyboard.press('Shift+Tab'); // the file input is the focusable just before the first field (PS:133-160)
      await expect.soft(avatarInput(page)).toBeFocused();
      const overlay = profile.locator('label', { hasText: /^Đổi ảnh$/u });
      await expect.soft(overlay).toHaveCSS('opacity', '1'); // PS:150 peer-focus-visible:opacity-100
      await expect.soft(overlay).not.toHaveCSS('box-shadow', 'none'); // PS:151 peer-focus-visible:ring-2
      await captureEvidence(page, ev('33P-E-004', 'overlay-focus-ring'));
    });

    await test.step('[33P-B-029] confirm with the PUT held: status line, input and "Huỷ" disabled, Esc does not close', async () => {
      await pickAvatar(page, tinyPng('p3-set.png'));
      await expect(dialog).toBeVisible();
      const held = await holdResponse(page, '**/api/me/avatar', 'PUT');
      try {
        await confirmAvatarButton(page).dblclick(); // UAP:569 guard, ARD:54 loading: the 2nd click goes nowhere
        await held.seen;
        await expect.soft(page.getByRole('status').filter({ hasText: UPLOADING })).toBeVisible();
        await expect.soft(avatarInput(page)).toBeDisabled();
        await expect.soft(cancelAvatarButton(page)).toBeDisabled();
        await page.keyboard.press('Escape');
        await expect.soft(dialog, 'Esc does not close while sending').toBeVisible();
        await captureEvidence(page, ev('33P-B-029', 'uploading'));
        const done = waitForApi(page, 'PUT', AVATAR_PUT, [200]);
        await held.release();
        avatarUrl = String(asRecord((await done).json, 'PUT avatar').avatarUrl);
      } finally {
        await held.release(); // idempotent: frees the held response when an assertion above threw
      }
    });

    await test.step('[33P-A-034] double click sent ONE PUT 200; avatar image shown with its alt; dialog closed', async () => {
      expect.soft(avatarUrl, 'response carries avatarUrl').not.toBe('');
      await expect.soft(dialog).toBeHidden();
      await expect.soft(profile.getByRole('img', { name: avatarAltOf(name), exact: true })).toHaveAttribute('src', avatarUrl); // UAP:583,607
      expect.soft(puts(), 'double click -> one PUT').toBe(1);
      await captureEvidence(page, ev('33P-A-034', 'avatar-set'));
    });

    await test.step('[33P-B-030] after 200 the status line is gone and the input is enabled', async () => {
      await expect.soft(page.getByRole('status').filter({ hasText: UPLOADING })).toHaveCount(0);
      await expect.soft(avatarInput(page)).toBeEnabled();
      await captureEvidence(page, ev('33P-B-030', 'idle-after-upload'));
    });

    await test.step('[33P-C-020] 800 ms + 200 later (clock) no PATCH went out', async () => {
      await page.clock.runFor(DEBOUNCE_JUMP_MS);
      await expect.soft(saveIndicator(page), 'positive marker: the chip never left idle').toHaveText(IND.idle); // no dirty/saving
      expect.soft(patches(), 'an avatar change is not an autosave').toEqual([]);
      await captureEvidence(page, ev('33P-C-020', 'no-patch'));
    });

    await test.step('[33P-A-035] pick again -> "Thay ảnh đại diện?", "Ảnh cũ không khôi phục được.", button "Thay ảnh"', async () => {
      await pickAvatar(page, tinyPng('p3-replace.png'));
      await expect.soft(page.getByRole('dialog', { name: AVATAR.replaceTitle, exact: true })).toBeVisible();
      await expect.soft(dialog.getByText(AVATAR.replaceWarning, { exact: true })).toBeVisible();
      await expect.soft(dialog.getByRole('button', { name: AVATAR.confirm, exact: true })).toBeVisible();
      await captureEvidence(page, ev('33P-A-035', 'replace-dialog'));
    });

    await test.step('[33P-A-038] choose a .jpg -> the dialog opens (the input accepts image/jpeg)', async () => {
      await cancelAvatarButton(page).click(); // close the dialog of the previous step first
      await expect(dialog).toBeHidden();
      const jpeg = await tinyJpeg(page);
      jpegBase64 = jpeg.buffer.toString('base64');
      await pickAvatar(page, jpeg);
      await expect.soft(dialog).toBeVisible();
      await expect.soft(dialog.getByRole('img', { name: AVATAR.preview, exact: true })).toBeVisible();
      await captureEvidence(page, ev('33P-A-038', 'jpeg-dialog'));
    });

    await test.step('[33P-G-018] confirm -> PUT body {mimeType:image/jpeg, contentBase64 without a data: prefix}, 200', async () => {
      const done = waitForApi(page, 'PUT', AVATAR_PUT, [200]);
      await confirmAvatarButton(page).click();
      const res = await done;
      const sent = res.response.request().postDataJSON() as Record<string, unknown>;
      expect.soft(Object.keys(sent).sort(), 'body keys').toEqual(['contentBase64', 'mimeType']);
      expect.soft(sent.mimeType).toBe('image/jpeg'); // UAP:538-540
      expect.soft(String(sent.contentBase64)).not.toMatch(/^data:/u); // UAP:573-576
      expect.soft(sent.contentBase64, 'the bytes of the file').toBe(jpegBase64);
      await expect.soft(dialog).toBeHidden();
      avatarUrl = String(asRecord(res.json, 'PUT avatar').avatarUrl);
      await captureEvidence(page, ev('33P-G-018', 'jpeg-uploaded'));
    });

    await test.step('[33P-A-039] reload -> the avatar image src is the N11 avatarUrl and it decodes', async () => {
      const read = waitForApi(page, 'GET', ME_RE, [200]);
      await page.reload();
      const after = asRecord((await read).json, 'GET /api/me');
      await expect(heading(page)).toBeVisible();
      expect.soft(after.avatarUrl, 'N11 carries the avatar').toBe(avatarUrl);
      const img = profile.getByRole('img', { name: avatarAltOf(name), exact: true });
      await expect.soft(img).toHaveAttribute('src', String(after.avatarUrl));
      await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth), { message: 'naturalWidth' }).toBeGreaterThan(0);
      await captureEvidence(page, ev('33P-A-039', 'avatar-after-reload'));
    });
    writes.stop();
  } finally {
    await closeP3Session(s);
  }
});

test('SCR-33 · FL-33P-09 · avatar rejects (local and server) and rate limit', async ({ browser }) => {
  test.setTimeout(180_000);
  const s = await openP3Session(browser, `p07-profile-rl-${RUN_FRESH}-r${test.info().retry}`);
  const { page } = s;
  try {
    await page.clock.install();
    await openAccount(page);
    const writes = recordWrites(page);
    const puts = (): number => writes.list().filter((w) => w === PUT_LINE).length;
    const dialog = avatarDialog(page);

    /** Picks `file`, confirms, and expects the server `code` answered 422 and `message` shown with the dialog closed. */
    const serverReject = async (file: PickableFile, code: string, message: string, evidence: string): Promise<void> => {
      await pickAvatar(page, file);
      await expect(dialog).toBeVisible();
      const done = waitForApi(page, 'PUT', AVATAR_PUT, [422]);
      await confirmAvatarButton(page).click();
      const res = await done;
      expect.soft(JSON.stringify(res.json), `422 carries ${code}`).toContain(code);
      await expect.soft(dialog).toBeHidden();
      await expect.soft(fieldError(page, message)).toBeVisible();
      await captureEvidence(page, evidence);
    };

    await test.step('[33P-C-016] a .gif of type image/gif -> alert "Chỉ nhận ảnh PNG hoặc JPEG.", no dialog, no PUT', async () => {
      await pickAvatar(page, { name: 'p3.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a-p3') });
      await expect(fieldError(page, AVATAR.typeUnsupported)).toBeVisible(); // UAP:528-532, PS:170-174
      await expect(dialog).toHaveCount(0);
      expect(puts(), 'a local reject sends nothing').toBe(0);
      await captureEvidence(page, ev('33P-C-016', 'gif-rejected'));
    });

    await test.step('[33P-C-017] 524 289 bytes -> "Ảnh tối đa 512 KB…" replaces the previous alert, no PUT', async () => {
      await pickAvatar(page, { name: 'p3-big.png', mimeType: 'image/png', buffer: Buffer.alloc(AVATAR_MAX_FILE_BYTES + 1) });
      await expect.soft(fieldError(page, AVATAR.fileTooBig)).toBeVisible(); // UAP:534-538
      await expect.soft(fieldError(page, AVATAR.typeUnsupported)).toHaveCount(0); // UAP:526
      await expect.soft(dialog).toHaveCount(0);
      expect.soft(puts()).toBe(0);
      await captureEvidence(page, ev('33P-C-017', 'too-big'));
    });

    await test.step('[33P-C-018] exactly 524 288 bytes passes the local checks -> dialog with preview', async () => {
      await pickAvatar(page, { name: 'p3-512k.png', mimeType: 'image/png', buffer: Buffer.alloc(AVATAR_MAX_FILE_BYTES) });
      await expect.soft(dialog).toBeVisible(); // 524 288 bytes = 699 052 base64 chars = the cap (UAP:163,548)
      await expect.soft(dialog.getByRole('img', { name: AVATAR.preview, exact: true })).toHaveCount(1);
      await captureEvidence(page, ev('33P-C-018', '512k-dialog'));
      await cancelAvatarButton(page).click();
      await expect.soft(dialog).toBeHidden();
      expect.soft(puts()).toBe(0);
    });

    await test.step('[33P-B-031] the alert stayed until the next pick and is gone once the valid pick started', async () => {
      await expect.soft(fieldError(page, AVATAR.fileTooBig)).toHaveCount(0);
      await expect.soft(fieldError(page, AVATAR.typeUnsupported)).toHaveCount(0);
      await expect.soft(page.getByRole('alert')).toHaveCount(0);
      await captureEvidence(page, ev('33P-B-031', 'alert-cleared'));
    });

    await test.step('[33P-G-019] GIF bytes named .png -> 422 AVATAR_TYPE_UNSUPPORTED -> "Chỉ nhận ảnh PNG hoặc JPEG.", dialog closed', async () => {
      await serverReject(gifAsPng(), 'AVATAR_TYPE_UNSUPPORTED', AVATAR.typeUnsupported, ev('33P-G-019', 'gif-as-png'));
    });

    await test.step('[33P-G-020] oversizePng(5000, 100) -> 422 AVATAR_DIMENSIONS_EXCEEDED -> "Ảnh rộng hoặc cao quá 4096 điểm ảnh."', async () => {
      await serverReject({ name: 'p3-wide.png', mimeType: 'image/png', buffer: oversizePng(5_000, 100) }, 'AVATAR_DIMENSIONS_EXCEEDED', AVATAR_MSG.dimensions, ev('33P-G-020', 'dimensions'));
    });

    await test.step('[33P-G-021] oversizePng() 8000 x 6000 -> 422 IMAGE_TOO_LARGE -> "Ảnh quá lớn, hãy chọn ảnh nhỏ hơn."', async () => {
      await serverReject({ name: 'p3-huge.png', mimeType: 'image/png', buffer: oversizePng() }, 'IMAGE_TOO_LARGE', AVATAR_MSG.tooLarge, ev('33P-G-021', 'too-large'));
    });

    await test.step('[33P-G-022] corruptPng() -> 422 FILE_CORRUPT -> "Không đọc được ảnh này, tệp có thể đã hỏng."', async () => {
      await serverReject({ name: 'p3-corrupt.png', mimeType: 'image/png', buffer: corruptPng() }, 'FILE_CORRUPT', AVATAR_MSG.corrupt, ev('33P-G-022', 'corrupt'));
    });

    await test.step('[33P-G-023] random bytes as PNG -> 422 FILE_TYPE_MISMATCH -> "Nội dung tệp không khớp loại ảnh…"', async () => {
      await serverReject(notAnImage(), 'FILE_TYPE_MISMATCH', AVATAR.typeMismatch, ev('33P-G-023', 'type-mismatch'));
    });

    await test.step('[33P-G-025] 5 seeded uploads + reload + the 11th request -> 429 RATE_LIMITED -> alert, input disabled', async () => {
      await seedAvatarUploads(s.context, 5); // 5 rejected + 5 seeded = 10 of the 10 / 900 s bucket
      await openAccount(page);
      await pickAvatar(page, tinyPng('p3-11th.png'));
      await expect(dialog).toBeVisible();
      const done = waitForApi(page, 'PUT', AVATAR_PUT, [429]);
      await confirmAvatarButton(page).click();
      const res = await done;
      expect.soft(JSON.stringify(res.json), '429 carries RATE_LIMITED').toContain('RATE_LIMITED');
      await expect.soft(fieldError(page, AVATAR_MSG.rateLimited)).toBeVisible(); // UAP:216-220
      await expect.soft(avatarInput(page)).toBeDisabled();
      await captureEvidence(page, ev('33P-G-025', 'rate-limited'));
    });

    await test.step('[33P-B-032] locked: the input is disabled; a file forced into it opens no dialog and sends no second PUT', async () => {
      await expect.soft(avatarInput(page)).toBeDisabled();
      const putsBefore = puts();
      await avatarInput(page).setInputFiles(tinyPng('p3-locked.png')); // Playwright does not check `disabled`; the FE guard (UAP:~519) must hold
      await expect.soft(fieldError(page, AVATAR_MSG.rateLimited), 'positive marker: the lock alert is still shown').toBeVisible();
      await expect.soft(dialog).toHaveCount(0);
      expect.soft(puts(), 'no second PUT').toBe(putsBefore);
      await captureEvidence(page, ev('33P-B-032', 'locked'));
    });

    await test.step('[33P-G-026] 61 s later (clock) the input is enabled and a pick opens the dialog', async () => {
      await page.clock.runFor(61_000); // UAP:169 AVATAR_LOCK_MIN_SECONDS = 60
      await expect(avatarInput(page)).toBeEnabled();
      await pickAvatar(page, tinyPng('p3-unlocked.png'));
      await expect.soft(dialog).toBeVisible();
      await captureEvidence(page, ev('33P-G-026', 'unlocked-dialog'));
      await cancelAvatarButton(page).click();
    });
    writes.stop();
  } finally {
    await closeP3Session(s);
  }
});
