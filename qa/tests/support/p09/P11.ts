/**
 * P11 helpers (phase 09 `_ui` specs): sign in a pool user of one role (optionally a member of the main QA project) and
 * run `verifyUi` at 1920/1440/1024/768. Desktop + tablet only: `DESKTOP_VIEWPORTS` is always passed (verifyUi defaults to 375).
 */
import { expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';

import type { PoolUser } from '../phase03Seed';
import { verifyUi } from '../ui-verify';
import { adminApi, asMember, DESKTOP_VIEWPORTS, mainProject, roleUser, signInRole, type Role } from './roles';

export interface RoleCtx {
  readonly page: Page;
  readonly admin: APIRequestContext;
  readonly user: PoolUser;
  readonly projectId: string;
  readonly floorId: string;
}

/** One pool user of `role` in slot `p09-<slot>-<role>`; member of the main QA project when `member`, undone in `finally`. */
export async function withRoleUi(
  browser: Browser,
  role: Role,
  slot: string,
  member: boolean,
  fn: (ctx: RoleCtx) => Promise<void>,
): Promise<void> {
  const admin = await adminApi();
  const user = await roleUser(admin, role, slot);
  const { projectId, workFloorId } = mainProject();
  const context = await browser.newContext();
  let undo = async (): Promise<void> => {};
  try {
    if (member) undo = await asMember(admin, projectId, user);
    await signInRole(context, user);
    await fn({ page: await context.newPage(), admin, user, projectId, floorId: workFloorId });
  } finally {
    await context.close();
    await undo();
    await admin.dispose();
  }
}

/** `goto(path)`, wait for `anchor` (row's own text), then assert the named buttons are absent (only after the anchor). */
export const openAt =
  (path: string, anchor: (p: Page) => ReturnType<Page['locator']>, absentButtons: readonly string[] = []) =>
  async (p: Page): Promise<void> => {
    await p.goto(path);
    // Hard wait for the row's own read-only / forbidden text, so a loading / error / admin view never gets shot.
    await expect(anchor(p).first()).toBeVisible();
    for (const name of absentButtons) await expect(p.getByRole('button', { name, exact: true })).toHaveCount(0);
  };

/**
 * One screen state at four widths. `hard` (H rows): the state must open at every width. Always: no horizontal page
 * scroll at any width. Shots + `<name>.json` come from verifyUi (`U09_<id>_<slug>_<w>.png`).
 */
export async function uiState(
  page: Page,
  id: string,
  slug: string,
  open: (p: Page) => Promise<void>,
  hard = false,
): Promise<void> {
  const all = await verifyUi(page, `U09_${id}_${slug}`, open, DESKTOP_VIEWPORTS);
  expect(all).toHaveLength(DESKTOP_VIEWPORTS.length);
  const failed = all.filter((m) => m.openError !== undefined).map((m) => `${m.viewport}: ${m.openError ?? ''}`);
  if (hard) expect(failed).toEqual([]);
  else expect.soft(failed).toEqual([]);
  expect.soft(all.filter((m) => m.horizontalOverflowPx > 1).map((m) => `${m.viewport}: ${String(m.horizontalOverflowPx)}px`)).toEqual([]);
}
