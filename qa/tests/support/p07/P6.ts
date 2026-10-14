/**
 * QA-07b pack P6 helpers (SCR-33 `/tai-khoan`: persistence, notification matrix, undo on preferences, "Tìm phím tắt").
 * Owned by `phase07_prefs_b_edge.spec.ts` only; shared selectors/constants come from `./account.ts` (read only).
 * Short names for sources (FE under `src/screens/account/AccountSettings/`): NS NotificationsSection.tsx,
 * SS ShortcutsSection.tsx, UAT useAccountTables.ts, UAS useAccountSettings.ts, AP AppearanceSection.tsx.
 */
import { expect } from '@playwright/test';
import type { Browser, BrowserContext, Locator, Page, Request } from '@playwright/test';

import { readBaseUrl } from '../../../../e2e/fullstack/env';
import { signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import type { PoolRole, PoolUser } from '../phase03Seed';
import {
  CHANNELS,
  DENSITY,
  DESKTOP,
  IND,
  NOTIFICATION_DEFAULTS,
  REFRESH_API,
  SHORTCUTS,
  accountUser,
  block,
  cellName,
  saveIndicator,
  signInAccount,
} from './account';

export type ChannelKey = keyof typeof CHANNELS;

/** The pool user, its browser context (own `localStorage` + own module memory) and page handed to a flow body. */
export interface PrefsSession {
  readonly user: PoolUser;
  readonly context: BrowserContext;
  readonly page: Page;
}

/**
 * Admin API (1 login) -> pool user of `slot`/`role` -> fresh 1440x900 context signed in through the API (1 login) -> `body` -> close.
 * Profile restore stays with the flow (FL-33R-06 uses `snapshotProfile`/`resetProfile` from account.ts in its own `finally`).
 */
export async function asPrefsUser(
  browser: Browser,
  slot: string,
  role: PoolRole,
  body: (session: PrefsSession) => Promise<void>,
): Promise<void> {
  const { email, password } = readAdminCredentials();
  const admin = await signedInApi(email, password);
  let user: PoolUser;
  try {
    user = await accountUser(admin, slot, role);
  } finally {
    await admin.dispose();
  }
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport: DESKTOP });
  try {
    const page = await context.newPage();
    await signInAccount(context, user);
    await body({ user, context, page });
  } finally {
    await context.close();
  }
}

/**
 * "Settled" = the save chip rests on "Chỉ giữ trong phiên này" (the 800 ms autosave ran, UAS:103,315).
 * Used only as a deadline marker for "no request" claims. Call it right after a change: the chip is then dirty/saving,
 * so it cannot be the stale localOnly of an earlier change.
 */
export async function settle(page: Page): Promise<void> {
  await expect(saveIndicator(page)).toHaveText(IND.localOnly);
}

/** Every `/api/` request of ANY method from now on (session upkeep `POST /api/auth/refresh` excluded). */
// dup-of: prefs.ts recordAll
export function recordAll(page: Page): { readonly list: () => string[]; readonly stop: () => void } {
  const seen: string[] = [];
  const onRequest = (req: Request): void => {
    const path = new URL(req.url()).pathname;
    if (!path.startsWith('/api/')) return;
    if (req.method() === 'POST' && path === REFRESH_API) return;
    seen.push(`${req.method()} ${path}`);
  };
  page.on('request', onRequest);
  return { list: () => [...seen], stop: () => page.off('request', onRequest) };
}

/** Client-side navigation without a document load: `history.pushState` + `popstate` (react-router listens to it). */
// dup-of: prefs.ts spaNavigate
export async function spaNavigate(page: Page, path: string): Promise<void> {
  await page.evaluate((to) => {
    window.history.pushState({}, '', to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

/* ---------------------------------------------------------------- appearance */

/** "Mật độ hiển thị" radio (AP:236-241). */
export const densityRadio = (page: Page, which: keyof Pick<typeof DENSITY, 'comfortable' | 'compact'>): Locator =>
  page.getByRole('radiogroup', { name: DENSITY.group, exact: true }).getByRole('radio', { name: DENSITY[which], exact: true });

/* ---------------------------------------------------------------- notification matrix (NS:146-165) */

export const notificationsBlock = (page: Page): Locator => block(page, 'account-notifications');

/** The native checkbox of one cell, named "<event> — <channel>" (UAT:355). */
export const cell = (page: Page, event: string, channel: ChannelKey): Locator =>
  notificationsBlock(page).getByRole('checkbox', { name: cellName(event, CHANNELS[channel]), exact: true });

/** Clicks the VISIBLE box: the input is `sr-only`, the `<label htmlFor>` around the 18 px box is the click target (Checkbox.tsx). */
export async function clickCell(page: Page, event: string, channel: ChannelKey): Promise<void> {
  await notificationsBlock(page).locator('label').filter({ has: cell(page, event, channel) }).click();
}

/** The ten cell names in reading order: event 1 inApp, event 1 email, event 2 inApp, ... (UAT:117-143, NS:146-165). */
export const MATRIX_CELL_NAMES: readonly string[] = NOTIFICATION_DEFAULTS.flatMap((event) => [
  cellName(event.label, CHANNELS.inApp),
  cellName(event.label, CHANNELS.email),
]);

/** Soft check of all 10 cells: the defaults of 33R-B-002 with `overrides` (`"<event>|inApp"` -> value) applied. */
export async function expectMatrix(page: Page, overrides: Readonly<Record<string, boolean>> = {}): Promise<void> {
  for (const event of NOTIFICATION_DEFAULTS) {
    for (const channel of ['inApp', 'email'] as const) {
      const expected = overrides[`${event.label}|${channel}`] ?? event[channel];
      await expect.soft(cell(page, event.label, channel), `${event.label} — ${CHANNELS[channel]}`).toBeChecked({ checked: expected });
    }
  }
}

/** `aria-label` of the focused element (the checkbox cells carry their full name there, NS:158). */
export const activeLabel = (page: Page): Promise<string | null> =>
  page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? null);

/* ---------------------------------------------------------------- "Tìm phím tắt" (SS:100-181, UAT:364-399) */

/** Region "Phím tắt" with its search box, live status, data rows (rows holding a `<kbd>`; the empty sentence is a row too) and cells. */
export function shortcuts(page: Page): {
  readonly region: Locator;
  readonly search: Locator;
  readonly status: Locator;
  readonly rows: Locator;
  readonly descriptionCell: (text: string) => Locator;
} {
  const region = page.getByRole('region', { name: SHORTCUTS.region, exact: true });
  return {
    region,
    search: region.getByRole('searchbox', { name: SHORTCUTS.search, exact: true }),
    status: region.getByRole('status'),
    rows: region.locator('tbody tr:has(kbd)'),
    descriptionCell: (text) => region.getByRole('cell', { name: text, exact: true }),
  };
}

/** Soft check of a filtered list: the exact set of description cells, the row count and the "Đang hiện N trong T" sentence. */
export async function expectFiltered(page: Page, descriptions: readonly string[], total: number): Promise<void> {
  const s = shortcuts(page);
  await expect.soft(s.rows).toHaveCount(descriptions.length);
  await expect.soft(s.status).toHaveText(SHORTCUTS.filtered(descriptions.length, total));
  for (const text of descriptions) await expect.soft(s.descriptionCell(text)).toBeVisible();
}

/** Soft check of the unfiltered list: every row back and the plain "N phím tắt đang có hiệu lực." sentence. */
export async function expectAllShortcuts(page: Page, total: number): Promise<void> {
  const s = shortcuts(page);
  await expect.soft(s.rows).toHaveCount(total);
  await expect.soft(s.status).toHaveText(`${String(total)} phím tắt đang có hiệu lực.`);
}
