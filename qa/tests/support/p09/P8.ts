/** P8 helper: one signed-in role page on the main QA project with write recording; `cleanup` undoes membership. */
import type { Browser, Page } from '@playwright/test';

import { adminApi, asMember, DESKTOP, mainProject, recordWrites, roleUser, signInRole, type Role } from './roles';

export interface RoleSession {
  readonly page: Page;
  readonly rec: { writes: string[] };
  readonly projectId: string;
  readonly cleanup: () => Promise<void>;
}

export async function openRoleSession(browser: Browser, role: Role, slot: string): Promise<RoleSession> {
  const admin = await adminApi();
  const user = await roleUser(admin, role, slot);
  const { projectId } = mainProject();
  const undo = await asMember(admin, projectId, user);
  const context = await browser.newContext({ viewport: DESKTOP });
  const cleanup = async (): Promise<void> => {
    await context.close();
    await undo();
    await admin.dispose();
  };
  try {
    await signInRole(context, user);
    const page = await context.newPage();
    return { page, rec: recordWrites(page), projectId, cleanup };
  } catch (e) {
    await cleanup();
    throw e;
  }
}
