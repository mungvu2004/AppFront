/**
 * Pack P3 helpers (QA-07b): avatar edge flows and mocked profile flows of SCR-33 `/tai-khoan`.
 * Only this pack imports it. Short names: ARD AvatarReplaceDialog.tsx, PS ProfileSection.tsx, UAP useAccountPreferences.ts,
 * UAS useAccountSettings.ts (all under `src/screens/account/AccountSettings/`), CA src/lib/autosave/createAutosave.ts.
 *
 * Usage:
 *   const s = await openP3Session(browser, 'p07-profile-2');          // 1 login (pool user, own context + page)
 *   try { ... } finally { await closeP3Session(s); }
 */
import { expect } from '@playwright/test';
import type { Browser, BrowserContext, Locator, Page, Route } from '@playwright/test';

import { readBaseUrl } from '../../../../e2e/fullstack/env';
import { apiBaseUrl, signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import { type PoolUser } from '../phase03Seed';
import {
  AVATAR,
  AVATAR_API,
  DESKTOP,
  TINY_PNG,
  accountUser,
  avatarDialog,
  avatarInput,
  meApi,
  signInAccount,
} from './account';

/** UAS:103 ACCOUNT_AUTOSAVE_DEBOUNCE_MS (800) + a margin: `page.clock.runFor` of this fires the debounce. */
export const DEBOUNCE_JUMP_MS = 1_000;
/** I18N autosave.dirty (src/hooks/useSaveIndicator.ts:46): shown while a retry is waiting. */
export const IND_DIRTY = 'Có thay đổi chờ đồng bộ';
/** UAP:159 */
export const UPLOADING = 'Đang tải ảnh lên…';
/** UAP:169-176 AVATAR_MESSAGES (I18N-free literals). */
export const AVATAR_MSG = {
  tooLarge: 'Ảnh quá lớn, hãy chọn ảnh nhỏ hơn.',
  dimensions: 'Ảnh rộng hoặc cao quá 4096 điểm ảnh.',
  corrupt: 'Không đọc được ảnh này, tệp có thể đã hỏng.',
  rateLimited: 'Đã thử nhiều lần. Hãy đợi vài phút rồi thử lại.',
} as const;
/** I18N errors.network.description (read by `describeError`). */
export const NETWORK_DESCRIPTION = 'Không liên lạc được với máy chủ. Kiểm tra mạng rồi thử lại.';

export interface P3Session {
  readonly user: PoolUser;
  readonly context: BrowserContext;
  readonly page: Page;
}

/** A pool engineer for `slot` signed in inside a fresh 1440 context (1 login; the admin API login is 1 more). */
export async function openP3Session(browser: Browser, slot: string): Promise<P3Session> {
  const { email, password } = readAdminCredentials();
  const admin = await signedInApi(email, password);
  let user: PoolUser;
  try {
    user = await accountUser(admin, slot);
  } finally {
    await admin.dispose();
  }
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport: DESKTOP });
  try {
    await signInAccount(context, user);
    return { user, context, page: await context.newPage() };
  } catch (error) {
    await context.close();
    throw error;
  }
}

export const closeP3Session = (s: P3Session): Promise<void> => s.context.close().catch(() => undefined);

/** Evidence name `E07_<row id>_<slug>.png` (the row id as written in the flows file). */
export const ev = (rowId: string, slug: string): string => `E07_${rowId}_${slug}.png`;

/* ---------------------------------------------------------------- avatar */

export interface PickableFile {
  readonly name: string;
  readonly mimeType: string;
  readonly buffer: Buffer;
}

/** GIF89a bytes (1x1) for a "file named .png": BE magic check -> 422 AVATAR_TYPE_UNSUPPORTED. */
export const gifAsPng = (): PickableFile => ({
  name: 'p3-gif-as.png',
  mimeType: 'image/png',
  buffer: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'),
});

/** Bytes that are no image at all, sent as PNG -> 422 FILE_TYPE_MISMATCH (BE:apps/api/me/avatar.py:158-167). */
export const notAnImage = (): PickableFile => ({
  name: 'p3-fake.png',
  mimeType: 'image/png',
  buffer: Buffer.from('qa-p3 these bytes are not an image'),
});

export const tinyPng = (name = 'p3.png'): PickableFile => ({ name, mimeType: 'image/png', buffer: TINY_PNG });

/** A real JPEG made by the page's own canvas (valid for the BE decoder; nothing hand-assembled). */
export async function tinyJpeg(page: Page): Promise<PickableFile> {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');
    if (ctx !== null) {
      ctx.fillStyle = '#3366cc';
      ctx.fillRect(0, 0, 8, 8);
    }
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1] ?? '';
  });
  return { name: 'p3.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(base64, 'base64') };
}

/** Focuses the avatar input first (a label click does that for a real user, and the dialog returns focus to it), then picks `file`. */
export async function pickAvatar(page: Page, file: PickableFile): Promise<void> {
  await avatarInput(page).focus();
  await avatarInput(page).setInputFiles(file);
}

/** The confirm button of the avatar dialog, whichever wording (UAP:618 hasExistingAvatar). */
export const confirmAvatarButton = (page: Page): Locator => avatarDialog(page).getByRole('button', { name: /^(?:Đặt|Thay) ảnh$/u });
export const cancelAvatarButton = (page: Page): Locator => avatarDialog(page).getByRole('button', { name: AVATAR.cancel, exact: true });

/** `n` real `PUT /api/me/avatar` with the context's own session (spends the 10 / 900 s `me_avatar` bucket). */
export async function seedAvatarUploads(context: BrowserContext, n: number): Promise<void> {
  const api = await meApi(context);
  const headers = { Origin: apiBaseUrl(), Authorization: `Bearer ${api.token}` };
  for (let i = 0; i < n; i += 1) {
    const res = await context.request.put(AVATAR_API, { headers, data: { mimeType: 'image/png', contentBase64: TINY_PNG.toString('base64') } });
    expect(res.status(), `seed PUT ${AVATAR_API} #${String(i + 1)}`).toBe(200);
  }
}

/* ---------------------------------------------------------------- scripted route (mock) */

export type Answer = 'continue' | 'abort' | { readonly status: number; readonly body?: unknown };

export interface ScriptedRoute {
  /** Requests of `method` that reached the handler since the last `use`. */
  readonly hits: () => number;
  /** Replaces the script; `fn(hit)` (1-based) says how that request is answered. Resets `hits`. */
  readonly use: (fn: (hit: number) => Answer) => void;
  readonly stop: () => Promise<void>;
}

/** Answers `method` requests of `glob` from a script (other methods fall through to the real stack). */
export async function scriptRoute(page: Page, glob: string, method: string): Promise<ScriptedRoute> {
  let hits = 0;
  let script: (hit: number) => Answer = () => 'continue';
  const handler = async (route: Route): Promise<void> => {
    if (route.request().method() !== method) {
      await route.fallback();
      return;
    }
    hits += 1;
    const answer = script(hits);
    if (answer === 'continue') await route.continue();
    else if (answer === 'abort') await route.abort('failed');
    else await route.fulfill({ status: answer.status, contentType: 'application/json', body: JSON.stringify(answer.body ?? {}) });
  };
  await page.route(glob, handler);
  return {
    hits: () => hits,
    use: (fn) => {
      hits = 0;
      script = fn;
    },
    stop: () => page.unroute(glob, handler),
  };
}
