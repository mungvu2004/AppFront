/**
 * P9 helpers (phase 09, viewer edge + admin mid-session demotion). Real stack only; own projects / pool users, cleaned in `finally`.
 */
import { expect } from '@playwright/test';
import type { APIRequestContext, Browser, BrowserContext, Page } from '@playwright/test';

import { qcLayer, writeLayer } from '../layerSeed';
import { createPipelineProject, deleteSeededProject, envDrawingPng, removeProjectMember } from '../phase03Seed';
import type { PoolUser } from '../phase03Seed';
import { adminApi, asMember, DESKTOP, roleUser, signInRole, type Role } from './roles';

export interface OwnRun {
  readonly admin: APIRequestContext;
  readonly user: PoolUser;
  readonly context: BrowserContext;
  readonly page: Page;
  readonly projectId: string;
  readonly floorId: string;
}

/**
 * Own pipeline project (>= 2 versions, qcLayer written: rooms "Bếp" / "PHONG NGU 2") with pool user `p09-<slot>-<role>` as member
 * and a signed-in desktop page. Project deleted and membership removed in `finally`. ~60 s setup (one fake-ML run).
 */
export async function withOwnProject(
  browser: Browser,
  role: Role,
  slot: string,
  slug: string,
  body: (run: OwnRun) => Promise<void>,
): Promise<void> {
  const admin = await adminApi();
  let context: BrowserContext | undefined;
  let projectId: string | undefined;
  let undo: (() => Promise<void>) | undefined;
  try {
    const user = await roleUser(admin, role, slot);
    const seeded = await createPipelineProject(admin, slug, envDrawingPng());
    projectId = seeded.projectId;
    await writeLayer({ request: admin, headers: {} }, projectId, seeded.floorId, qcLayer);
    undo = await asMember(admin, projectId, user);
    context = await browser.newContext({ viewport: DESKTOP });
    await signInRole(context, user);
    const page = await context.newPage();
    await body({ admin, user, context, page, projectId, floorId: seeded.floorId });
  } finally {
    await context?.close();
    if (undo !== undefined) await undo().catch(() => undefined);
    if (projectId !== undefined) await deleteSeededProject(admin, projectId);
    await admin.dispose();
  }
}

/** Ensures `user` is NOT a member of `projectId` (an error / non-member answer is fine), for FL-9V-09. */
export async function ensureNotMember(admin: APIRequestContext, projectId: string, user: PoolUser): Promise<void> {
  await removeProjectMember(admin, projectId, user.id);
}

/** #17 measurement through the admin API (BE measurements/schemas.py: id `^MS-[0-9]{4,15}$`). */
export async function seedMeasurement(admin: APIRequestContext, projectId: string, name: string): Promise<string> {
  const id = `MS-${String(1000 + Math.floor(Math.random() * 8999))}`;
  const res = await admin.post(`/api/projects/${projectId}/measurements`, {
    data: { id, name, mode: 'pointToPoint', points: [{ x: 0, y: 0 }, { x: 4000, y: 0 }], rawValueMm: 4000 },
  });
  expect(res.status(), `setup: POST measurements ${(await res.text()).slice(0, 200)}`).toBe(201);
  return id;
}

/** Admin API role change on a pool user (PATCH /api/users/{id}/role, BE users/router.py:85). */
export async function setRole(admin: APIRequestContext, user: PoolUser, role: Role): Promise<void> {
  const res = await admin.patch(`/api/users/${user.id}/role`, { data: { role } });
  expect(res.status(), `setRole ${role}: ${(await res.text()).slice(0, 200)}`).toBe(200);
}

/** Waits for the 3D scene to stop being busy. */
export async function waitScene(page: Page): Promise<void> {
  await expect(page.getByLabel('Khung nhìn mô hình')).toHaveAttribute('aria-busy', 'false', { timeout: 60_000 });
}

/** Two scene clicks (M tool) then the pin button: draws and pins one measurement; returns after the POST answered 201. */
export async function pinOneMeasurement(page: Page): Promise<void> {
  await waitScene(page);
  await page.keyboard.press('m');
  const box = await page.locator('canvas').first().boundingBox();
  if (box === null) throw new Error('canvas has no bounding box');
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.5);
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.5);
  const pin = page.getByRole('button', { name: 'Ghim phép đo (phím Enter)' });
  await expect(pin).toBeEnabled();
  const posted = page.waitForResponse((r) => r.request().method() === 'POST' && /\/measurements$/u.test(new URL(r.url()).pathname));
  await pin.click();
  expect((await posted).status()).toBe(201);
}
