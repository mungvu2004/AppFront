/**
 * Phase 09 shared helper for the role matrix (admin / engineer / viewer) over the main QA project. Reuses phase03Seed
 * pool users, api.ts and state.ts; no spec imports another spec. Desktop + tablet only (no 375).
 *
 * Usage:
 *   const admin = await adminApi();
 *   const viewer = await roleUser(admin, 'viewer', 'nav');              // pool user, slot `p09-nav-viewer`
 *   const { projectId, workFloorId } = mainProject();
 *   const undo = await asMember(admin, projectId, viewer);              // BEFORE the test; undo() in finally
 *   await signInRole(context, viewer);
 *   const rec = recordWrites(page);
 *   await gotoAs(page, `/du-an/${projectId}`, /Bản vẽ/u);               // anchor first, then assert absence
 *   expect(rec.writes).toEqual([]);                                      // viewer sent no write
 */
import { expect } from '@playwright/test';
import type { APIRequestContext, BrowserContext, Page } from '@playwright/test';

import { signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import { poolUser, removeProjectMember, signInPoolUser, type PoolRole, type PoolUser } from '../phase03Seed';
import { requireState } from '../state';

export const DESKTOP_VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
] as const;
export const DESKTOP = { width: 1440, height: 900 } as const;

export type Role = PoolRole;

export const roleUser = (admin: APIRequestContext, role: Role, slot: string): Promise<PoolUser> =>
  poolUser(admin, role, `p09-${slot}-${role}`);

export const signInRole = (context: BrowserContext, user: PoolUser): Promise<void> => signInPoolUser(context, user);

export async function adminApi(): Promise<APIRequestContext> {
  const { email, password } = readAdminCredentials();
  return signedInApi(email, password);
}

export const apiAs = (user: PoolUser): Promise<APIRequestContext> => signedInApi(user.email, user.password);

/** Main QA project + work floor recorded by earlier phases (fails with a clear message when missing). */
export function mainProject(): { projectId: string; workFloorId: string; projectName: string } {
  return {
    projectId: requireState((s) => s.project.projectId, 'project.projectId', 'Phase 2 (SCR-05 create)'),
    workFloorId: requireState((s) => s.floors.workFloorId, 'floors.workFloorId', 'Phase 3 (upload)'),
    projectName: requireState((s) => s.project.projectName, 'project.projectName', 'Phase 2 (SCR-05 create)'),
  };
}

/**
 * Adds `user` to the project and returns the undo. BE N3 answers 201 when new, 200 when already a member
 * (project_members/router.py:42-70): in the 200 case undo is a no-op so a pre-existing membership survives.
 */
export async function asMember(admin: APIRequestContext, projectId: string, user: PoolUser): Promise<() => Promise<void>> {
  const res = await admin.post(`/api/projects/${projectId}/members`, { data: { email: user.email } });
  const status = res.status();
  if (status !== 201 && status !== 200) {
    throw new Error(`asMember: POST members → ${String(status)}: ${(await res.text()).slice(0, 200)}`);
  }
  if (status === 200) return async () => {};
  return async () => {
    const err = await removeProjectMember(admin, projectId, user.id);
    if (err !== null) throw new Error(`asMember undo: ${err}`);
  };
}

/** `METHOD path` of every non-safe `/api/` request the page sends (assert `writes` is empty for a viewer). */
export function recordWrites(page: Page): { writes: string[] } {
  const rec = { writes: [] as string[] };
  page.on('request', (req) => {
    const { pathname } = new URL(req.url());
    // /api/auth/refresh = session refresh, not a data write (R1: viewer edges saw only it).
    if (pathname.startsWith('/api/') && pathname !== '/api/auth/refresh' && !['GET', 'HEAD', 'OPTIONS'].includes(req.method())) {
      rec.writes.push(`${req.method()} ${pathname}`);
    }
  });
  return rec;
}

/** Navigate, then wait for a heading: the sure anchor before asserting that something is absent. */
export async function gotoAs(page: Page, path: string, heading: string | RegExp): Promise<void> {
  await page.goto(path);
  await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible({ timeout: 15_000 });
}
