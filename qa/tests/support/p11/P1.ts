/**
 * QA-11 P1 helpers for `phase11_floors_edge.spec.ts` (SCR-09/10/11/21/25, real stack).
 * Pool users are per SPEC FILE: slot `p11Slot('floors')` for engineer and viewer. The admin owns every project and
 * deletes it in `finally`; nothing shared (main chain, CP-2, admin.storage.json) is touched.
 * Sources: UFU src/screens/upload/FloorUploadScreen/useFloorUploadScreen.ts, FUT …/FloorUploadTray.tsx,
 * FM src/screens/qc/FloorManager/*, UIQ src/screens/upload/InputQualityGate/useInputQualityGate.ts.
 */
import { expect, type APIRequestContext, type Browser, type Locator, type Page } from '@playwright/test';

import { signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import { addProjectMember, deleteSeededProject, poolUser, type PoolRole, type PoolUser } from '../phase03Seed';
import { closeFlow, openFlow, type Flow } from '../p03/P5';

export interface MemberFlow {
  readonly flow: Flow;
  readonly user: PoolUser;
  readonly admin: APIRequestContext;
}

/** Admin API + a pool user of `role` in `slot`, added to `projectIds`, with a fresh browser session. Caller closes via {@link endMember}. */
export async function startMember(
  browser: Browser,
  admin: APIRequestContext,
  role: PoolRole,
  slot: string,
  projectIds: readonly string[],
): Promise<MemberFlow> {
  const user = await poolUser(admin, role, slot);
  for (const id of projectIds) await addProjectMember(admin, id, user.email);
  const flow = await openFlow(browser, user);
  return { flow, user, admin };
}

export const endMember = async (member: MemberFlow | undefined): Promise<void> => {
  if (member !== undefined) await closeFlow(member.flow);
};

export const adminApi = async (): Promise<APIRequestContext> => {
  const { email, password } = readAdminCredentials();
  return signedInApi(email, password);
};

export { deleteSeededProject };

/* ---- locators ---- */
export const esc = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
export const TRAY = 'Tệp chưa gán tầng'; // UFU:104
export const tray = (page: Page): Locator => page.getByRole('region', { name: TRAY, exact: true });
/** Tray row by its summary line `{name} · {size}` (UFU:1079-1081). */
export const trayItem = (page: Page, name: string): Locator =>
  tray(page).getByRole('listitem').filter({ has: page.getByText(new RegExp(`^${esc(name)} · `, 'u')) });
export const card = (page: Page, floorId: string): Locator => page.locator(`[data-floor-id="${floorId}"]`);
export const cardSummary = (page: Page, floorId: string, name: string): Locator =>
  card(page, floorId).getByText(new RegExp(`^${esc(name)}( · |$)`, 'u'));
export const toastWith = (page: Page, text: string): Locator => page.getByRole('status').filter({ hasText: text }); // TST:120
export const removedToast = (name: string): string => `Đã xoá bản vẽ ${name}`; // UFU:977

/** What has keyboard focus, as "<TAG> <name>". */
export const focusName = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (el === null || el === document.body) return 'BODY';
    const name = el.getAttribute('aria-label') ?? (el.textContent ?? '');
    return `${el.tagName} ${name.trim().replace(/\s+/gu, ' ').slice(0, 80)}`;
  });

/** Texts written to the app announcer (`[data-announcer]`) — call before `goto`. */
export async function recordAnnouncements(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __p11Announced: string[] }).__p11Announced = seen;
    const watch = (): void => {
      const root = document.querySelector('[data-announcer]');
      if (root === null) return;
      new MutationObserver(() => {
        const text = (root.textContent ?? '').trim();
        if (text !== '' && seen[seen.length - 1] !== text) seen.push(text);
      }).observe(root, { childList: true, characterData: true, subtree: true });
    };
    new MutationObserver(() => {
      const root = document.querySelector('[data-announcer]');
      if (root !== null && !(root as HTMLElement & { __w?: boolean }).__w) {
        (root as HTMLElement & { __w?: boolean }).__w = true;
        watch();
      }
    }).observe(document, { childList: true, subtree: true });
  });
  return () => page.evaluate(() => (window as unknown as { __p11Announced?: string[] }).__p11Announced ?? []);
}

/** Waits for the response of `method` `re` registered BEFORE `act`, then returns its status. */
export async function statusOf(page: Page, method: string, re: RegExp, act: () => Promise<void>): Promise<number> {
  const waiting = page.waitForResponse((r) => r.request().method() === method && re.test(new URL(r.url()).pathname));
  await act();
  const res = await waiting;
  expect(res.status()).toBeLessThan(500);
  return res.status();
}
