/**
 * QA-10 P1 helpers (SCR-39 NotFound, real stack). Usage:
 *   const dp3 = await seedDp3('edge');            // beforeAll: 3 own projects (admin API), created one after another
 *   const { context, page } = await openAdminPage(browser, VIEWPORT_1920);   // signed-in admin, own context
 *   await dp3.cleanup();                          // afterAll
 */
import { type APIRequestContext, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { readBaseUrl } from '../../../../e2e/fullstack/env';
import { signedInApi } from '../api';
import { readAdminCredentials, signInAdmin } from '../auth';
import { createProject, deleteSeededProject, type SeededProject } from '../phase03Seed';

export const NOT_FOUND_PATH = '/khong-ton-tai';
export const NOT_FOUND_TITLE = 'Không tìm thấy trang này'; // useNotFound.ts TITLE_BY_REASON.missing
export const RECENT_HEADING = 'Dự án gần đây'; // useNotFound.ts
export const FLOORS_HREF = /^\/projects\/[^/]+\/floors$/u; // notFoundGateway.ts toRecentProjectVm
export const VIEWPORT_1920 = { width: 1920, height: 1080 } as const;

export interface Dp3 {
  readonly api: APIRequestContext;
  readonly projects: readonly SeededProject[];
  cleanup(): Promise<void>;
}

/** DP3: three own projects own projects nf-<slug>-<n>, created sequentially so `updatedAt` differs. */
export async function seedDp3(slug: string): Promise<Dp3> {
  const { email, password } = readAdminCredentials();
  const api = await signedInApi(email, password);
  const projects: SeededProject[] = [];
  try {
    for (let n = 1; n <= 3; n += 1) projects.push(await createProject(api, `nf-${slug}-${String(n)}-`));
  } catch (error) {
    for (const p of projects) await deleteSeededProject(api, p.projectId);
    await api.dispose();
    throw error;
  }
  return {
    api,
    projects,
    cleanup: async () => {
      for (const p of projects) await deleteSeededProject(api, p.projectId);
      await api.dispose();
    },
  };
}

/** Own browser context + page, signed in as the admin (one login). */
export async function openAdminPage(
  browser: Browser,
  viewport: { readonly width: number; readonly height: number } = VIEWPORT_1920,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport });
  const page = await context.newPage();
  await signInAdmin(page);
  return { context, page };
}

/** NotFound title: h2 inside ScreenMain's `<main>` (NotFound.tsx:104). */
export const notFoundHeading = (page: Page): Locator =>
  page.getByRole('heading', { name: NOT_FOUND_TITLE, exact: true, level: 2 });

export const recentHeading = (page: Page): Locator =>
  page.getByRole('heading', { name: RECENT_HEADING, exact: true, level: 3 });

/** The recent-project rows (NotFound.tsx: `<ul><li><a>`). */
export const recentLinks = (page: Page): Locator => page.getByRole('main').getByRole('list').getByRole('link');
