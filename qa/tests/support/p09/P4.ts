/** P4 helpers (phase 09 upload b edge): role-gated browser session + viewer direct-BE probes. */
import { expect, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';

import { ROUTES } from '../../../../e2e/fixtures/routes';
import { signInRole } from './roles';
import type { PoolUser } from '../phase03Seed';

export interface RoleSession {
  readonly context: BrowserContext;
  readonly page: Page;
}

/** New desktop context signed in as `user` (close it in `finally`). */
export async function openRole(browser: Browser, user: PoolUser): Promise<RoleSession> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await signInRole(context, user);
  return { context, page: await context.newPage() };
}

/** `goto(path)` then the URL must be `/login?next=` (anonymous guard). */
export async function expectLoginRedirect(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page).toHaveURL(/\/login\?next=/u);
}

/** The 8 SCR-09..16 routes of a floor, in flow order. */
export const uploadRoutes = (projectId: string, floorId: string): readonly string[] => [
  ROUTES.project.floors(projectId),
  ROUTES.project.upload(projectId),
  ROUTES.project.quality(projectId),
  ROUTES.project.pipeline(projectId),
  ROUTES.project.pipelineGraph(projectId),
  ROUTES.project.scale(projectId, floorId),
  ROUTES.project.overlay(projectId, floorId),
];

/** Status + `code` of a response (body may be empty). */
export async function statusCode(res: Awaited<ReturnType<APIRequestContext['get']>>): Promise<{ status: number; code: unknown }> {
  const body = (await res.json().catch(() => ({}))) as { code?: unknown };
  return { status: res.status(), code: body.code ?? null };
}

export const FOUR_CORNERS = {
  corners: [
    { xRatio: 0.1, yRatio: 0.1 },
    { xRatio: 0.9, yRatio: 0.1 },
    { xRatio: 0.9, yRatio: 0.9 },
    { xRatio: 0.1, yRatio: 0.9 },
  ],
};
