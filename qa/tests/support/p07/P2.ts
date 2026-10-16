/**
 * QA-07b P2 helpers for `phase07_profile_b_edge.spec.ts` (SCR-33 autosave timing, field errors, undo toast, rules).
 * Owned by P2 only; shared helpers stay in `./account.ts` (read only).
 *
 * Sources (FE master 1e1c16b7): CA src/lib/autosave/createAutosave.ts, USI src/hooks/useSaveIndicator.ts,
 * UAS src/screens/account/AccountSettings/useAccountSettings.ts, TST src/components/feedback/Toast.tsx,
 * ANN src/lib/input/announcer.ts.
 */
import { expect, type APIRequestContext, type Browser, type BrowserContext, type Page, type Request } from '@playwright/test';

import { readBaseUrl } from '../../../../e2e/fullstack/env';
import { waitForApi, type ApiResult } from '../../../../e2e/fullstack/apiWatch';
import type { PoolUser } from '../phase03Seed';
import {
  DESKTOP,
  ME_RE,
  accountUser,
  openAccount,
  resetProfile,
  signInAccount,
  snapshotProfile,
  type ProfileSnapshot,
} from './account';

/** UAS ACCOUNT_FIELD_REJECTED_LABEL (branch fix/qa07-a, BUG-503): chip + assertive announcer after a field 422. */
export const FIELD_REJECTED = 'Chưa lưu vì còn ô cần sửa';
/** I18N autosave.dirty / autosave.saving. */
export const CHIP_DIRTY = 'Có thay đổi chờ đồng bộ';
export const CHIP_SAVING = 'Đang lưu…';
/** UAS ACCOUNT_AUTOSAVE_DEBOUNCE_MS (800) + a margin: one `runFor` of this runs the debounce. */
export const FLUSH_MS = 1_000;
/** CA DEFAULT_MAX_WAIT_MS. */
export const MAX_WAIT_MS = 5_000;
/** TST UNDO_WINDOW_MS = 8 s, plus the exit animation. */
export const TOAST_GONE_MS = 9_000;

export interface P2Flow {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly user: PoolUser;
  readonly snapshot: ProfileSnapshot;
  /** Every PATCH /api/me request body, in order. */
  readonly patches: unknown[];
  /** Set when the flow deleted the user: no profile reset then. */
  deleted: boolean;
  close: () => Promise<void>;
}

const isMePatch = (req: Request): boolean => req.method() === 'PATCH' && ME_RE.test(new URL(req.url()).pathname);

/**
 * One pool user (own `slot`), one context signed in through the API (1 login), the profile snapshot, the page open on
 * `/tai-khoan`. `clock` installs `page.clock` (time flowing) before the page loads.
 */
export async function openFlow(browser: Browser, admin: APIRequestContext, slot: string, options: { clock?: boolean } = {}): Promise<P2Flow> {
  const user = await accountUser(admin, slot);
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport: DESKTOP });
  try {
    await signInAccount(context, user);
    const snapshot = await snapshotProfile(context);
    const page = await context.newPage();
    const patches: unknown[] = [];
    page.on('request', (req) => {
      if (isMePatch(req)) patches.push(req.postDataJSON() as unknown);
    });
    if (options.clock === true) await page.clock.install();
    await openAccount(page);
    const flow: P2Flow = {
      context,
      page,
      user,
      snapshot,
      patches,
      deleted: false,
      close: async () => {
        if (!flow.deleted) await resetProfile(context, snapshot);
        await context.close();
      },
    };
    return flow;
  } catch (error) {
    await context.close();
    throw error;
  }
}

/** Waits for the next PATCH /api/me answered with one of `statuses`. */
export const nextPatch = (page: Page, statuses: readonly number[] = [200]): Promise<ApiResult> => waitForApi(page, 'PATCH', ME_RE, statuses);

/** Request body of an answered call. */
export const bodyOf = (result: ApiResult): unknown => result.response.request().postDataJSON() as unknown;

const frozen = new WeakSet<Page>();

/**
 * Stops the page clock (pause up to 2 s ahead: timers inside run first). Idempotent. Never take evidence or navigate
 * while frozen: rAF / setTimeout(0) are fake, so `captureEvidence` hangs and a loaded page stays on its skeleton.
 */
export async function freeze(page: Page): Promise<void> {
  if (frozen.has(page)) return;
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 2_000));
  frozen.add(page);
}

/** Lets the page clock flow again. Idempotent. */
export async function thaw(page: Page): Promise<void> {
  if (!frozen.has(page)) return;
  frozen.delete(page);
  await page.clock.resume();
}

/** Live region of the app announcer: polite (`role=status`) or assertive (`role=alert`), ANN:55-58. */
export const announcerRegion = (page: Page, urgency: 'polite' | 'assertive') => page.locator(`[data-announcer="${urgency}"]`);

/** Count of PATCH bodies seen so far; `expect.poll` on it for "one more request arrived". */
export const waitForPatchCount = (flow: P2Flow, count: number) =>
  expect.poll(() => flow.patches.length, { message: `PATCH /api/me count -> ${String(count)}` }).toBe(count);
