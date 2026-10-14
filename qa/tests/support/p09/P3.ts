/**
 * QA-09 P3 helpers (viewer on SCR-09..16, FL-9U-01..04). Seeds are admin-owned own projects the pool viewer is added to;
 * deleting the project drops the membership, so no `asMember` undo is needed.
 */
import type { APIRequestContext, Browser, BrowserContext, Page } from '@playwright/test';

import { addProjectMember } from '../phase03Seed';
import { DESKTOP, roleUser, signInRole } from './roles';

export const UP_SLOT = 'up';

export interface ViewerSession {
  readonly page: Page;
  readonly context: BrowserContext;
}

/** Pool viewer `p09-up-viewer`, added to `projectIds`, signed in on a fresh 1440 context. */
export async function openViewer(browser: Browser, admin: APIRequestContext, projectIds: readonly string[]): Promise<ViewerSession> {
  const viewer = await roleUser(admin, 'viewer', UP_SLOT);
  for (const id of projectIds) await addProjectMember(admin, id, viewer.email);
  const context = await browser.newContext({ viewport: DESKTOP });
  await signInRole(context, viewer);
  return { context, page: await context.newPage() };
}

export const closeViewer = async (session: ViewerSession | undefined): Promise<void> => {
  await session?.context.close();
};

/**
 * Project the CAD branch screen (SCR-16) can open: the repo has no real .dxf seed (createDrawingProject only uploads png),
 * so this is a plain own project with floors. UNKNOWN — NEED VERIFICATION: "Có tệp CAD" rows are not producible here.
 */
export { createProject as createCadProject } from '../phase03Seed';
