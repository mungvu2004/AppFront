/**
 * QA-07b pack P5 helpers: SCR-33 local preferences edge flows (FL-33R-01..04). Owned by P5 only; the shared
 * `account.ts` is read-only. Sources (FE master 1e1c16b7, under `src/screens/account/AccountSettings/` unless a path is
 * given): AP AppearanceSection.tsx, UAP useAccountPreferences.ts, FR src/components/ui/FieldRow.tsx,
 * TG src/components/ui/Toggle.tsx, SEG src/components/ui/SegmentedControl.tsx, CB src/components/ui/Checkbox.tsx.
 */
import { expect } from '@playwright/test';
import type { Browser, Locator, Page } from '@playwright/test';

import { ROUTES } from '../../../../e2e/fixtures/routes';
import { readBaseUrl } from '../../../../e2e/fullstack/env';
import { signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import { DESKTOP, IND, accountUser, box, heading, recordWrites, saveIndicator, signInAccount } from './account';

/** The one pool user of the pack (flows-C2 seed P1): an engineer that never writes to the server. */
export const PREFS_SLOT = 'p07-prefs-1';

/** Row evidence file stem: `E07_<row id>_<slug>`. */
export const evName = (id: string, slug: string): string => `E07_${id}_${slug}`;

type PrefsWindow = Window & {
  __p5Chip?: string[];
  __p5Flash?: { gained: string[]; lost: string[] };
};

/** Segmented "Mật độ hiển thị" radio (AP:238-246). */
export const densityGroup = (page: Page): Locator => page.getByRole('radiogroup', { name: 'Mật độ hiển thị', exact: true });
export const densityRadio = (page: Page, label: 'Gọn' | 'Thoải mái'): Locator => densityGroup(page).getByRole('radio', { name: label, exact: true });

/**
 * The FieldRow root around a control (FR:62-70 `flex items-start min-h-[36px] py-2`). `account.ts#rowOf` stops at the
 * Toggle wrapper (`flex items-start gap-3`, TG:140), so this one also demands `py-2`.
 */
export const prefRow = (control: Locator): Locator =>
  control.locator('xpath=ancestor::div[contains(@class,"items-start") and contains(@class,"py-2")][1]');

/** Records every change of the save chip text (header `role=status`, AS:110) from now on, inside the page. */
async function watchChip(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as PrefsWindow;
    const chip = (): string => document.querySelector('h1')?.closest('header')?.querySelector('[role="status"]')?.textContent?.trim() ?? '';
    const seen = [chip()];
    w.__p5Chip = seen;
    new MutationObserver(() => {
      const text = chip();
      if (text !== seen[seen.length - 1]) seen.push(text);
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
}

/** Waits until `/tai-khoan` shows its title and the "Chức danh" textbox, then starts the chip history. */
export async function waitPrefs(page: Page): Promise<void> {
  await expect(heading(page)).toBeVisible();
  await expect(box(page, 'Chức danh')).toBeVisible();
  await watchChip(page);
}

/** Fresh document of `/tai-khoan`. */
export async function openPrefs(page: Page): Promise<void> {
  await page.goto(ROUTES.account);
  await waitPrefs(page);
}

/** Reload (module memory and the chip history restart empty). */
export async function reloadPrefs(page: Page): Promise<void> {
  await page.reload();
  await waitPrefs(page);
}

/**
 * Runs `act`, then waits for the chip to go through its autosave cycle and rest on "Chỉ giữ trong phiên này"
 * (UAS:103,315). A deadline marker for "no request" claims, not an assertion about the chip copy.
 */
export async function settle(page: Page, act: () => Promise<void>): Promise<void> {
  const from = await page.evaluate(() => (window as PrefsWindow).__p5Chip?.length ?? 0);
  await act();
  await expect
    .poll(() => page.evaluate((n) => (window as PrefsWindow).__p5Chip?.slice(n) ?? [], from), { message: 'save chip never settled on the local-only text' })
    .toContain(IND.localOnly);
  await expect(saveIndicator(page)).toHaveText(IND.localOnly);
}

/** Emulates the OS colour scheme and waits for the browser (matchMedia) and two frames, so React saw the change. */
export async function osScheme(page: Page, colorScheme: 'light' | 'dark'): Promise<void> {
  await page.emulateMedia({ colorScheme });
  await expect.poll(() => page.evaluate(() => window.matchMedia('(prefers-color-scheme: dark)').matches)).toBe(colorScheme === 'dark');
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
}

/** Clicks all `targets` inside one task (well under the 800 ms autosave debounce, whatever the machine speed). */
export async function clickTogether(page: Page, targets: readonly Locator[]): Promise<void> {
  const handles = await Promise.all(targets.map((t) => t.elementHandle()));
  await page.evaluate((els) => els.forEach((el) => (el as HTMLElement).click()), handles);
}

/** Sorted `Object.keys(localStorage)`. */
export const storageKeys = (page: Page): Promise<string[]> => page.evaluate(() => Object.keys(window.localStorage).sort());

/** `role:name` of the focused element (aria-label, else its text). */
export const activeStop = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (el === null) return 'none';
    return `${el.getAttribute('role') ?? el.tagName.toLowerCase()}:${el.getAttribute('aria-label') ?? el.textContent?.trim() ?? ''}`;
  });

/** Presses Tab `n` times; after each press returns `role:name` of `document.activeElement`. */
export async function focusOrder(page: Page, n: number): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < n; i += 1) {
    await page.keyboard.press('Tab');
    out.push(await activeStop(page));
  }
  return out;
}

/** SPA navigation without a document load (history.pushState + popstate). */
export async function spaNavigate(page: Page, path: string): Promise<void> {
  await page.evaluate((to) => {
    window.history.pushState({}, '', to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

/** Starts recording which Giao diện rows gain / lose `bg-accent-wash` (FR:66 flash), by their label text. */
export async function watchFlash(page: Page): Promise<void> {
  await page.evaluate(() => {
    const root = document.querySelector('section[aria-labelledby="account-appearance"]');
    if (root === null) throw new Error('watchFlash: appearance block not found');
    const flash: { gained: string[]; lost: string[] } = { gained: [], lost: [] };
    (window as PrefsWindow).__p5Flash = flash;
    new MutationObserver((records) => {
      for (const r of records) {
        const el = r.target as Element;
        const had = (r.oldValue ?? '').split(/\s+/u).includes('bg-accent-wash');
        const has = el.classList.contains('bg-accent-wash');
        const label = el.querySelector('span')?.textContent?.trim() ?? '';
        if (!had && has) flash.gained.push(label);
        if (had && !has) flash.lost.push(label);
      }
    }).observe(root, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  });
}

export const flashes = (page: Page): Promise<{ gained: string[]; lost: string[] }> =>
  page.evaluate(() => {
    const f = (window as PrefsWindow).__p5Flash;
    return f === undefined ? { gained: [], lost: [] } : { gained: [...f.gained], lost: [...f.lost] };
  });

export interface Ring {
  readonly boxShadow: string;
  readonly outlineStyle: string;
  readonly outlineWidth: string;
}

/**
 * Focus ring of a control as painted: the element that carries `ring-2` (box-shadow) or an outline.
 * radio = itself (SEG:73); switch = the track span (TG:108); checkbox = the box after the hidden input (CB:70).
 */
export function ringOf(control: Locator, kind: 'radio' | 'switch' | 'checkbox'): Promise<Ring> {
  return control.evaluate((el, which) => {
    const target = which === 'radio' ? el : which === 'switch' ? el.firstElementChild : el.nextElementSibling;
    if (target === null) throw new Error(`ringOf: no ring element for ${which}`);
    const css = getComputedStyle(target);
    return { boxShadow: css.boxShadow, outlineStyle: css.outlineStyle, outlineWidth: css.outlineWidth };
  }, kind);
}

/** True when a ring exists: a box-shadow, or a visible outline. */
export const hasRing = (r: Ring): boolean => r.boxShadow !== 'none' || (r.outlineStyle !== 'none' && r.outlineWidth !== '0px');

/**
 * One fresh browser context signed in as the pool user (1 login), `/tai-khoan` open, writes recorded.
 * No server state is changed by these flows, so there is nothing to restore.
 */
export async function asPrefsUser(
  browser: Browser,
  fn: (page: Page, writes: ReturnType<typeof recordWrites>) => Promise<void>,
): Promise<void> {
  const { email, password } = readAdminCredentials();
  const admin = await signedInApi(email, password);
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport: DESKTOP });
  try {
    await signInAccount(context, await accountUser(admin, PREFS_SLOT));
    const page = await context.newPage();
    const writes = recordWrites(page);
    try {
      await openPrefs(page);
      await fn(page, writes);
    } finally {
      writes.stop();
    }
  } finally {
    await context.close();
    await admin.dispose();
  }
}
