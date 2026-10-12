/**
 * QA-03d agent P4 helpers (SCR-09 floors: mocked, roles, UI verify). Used by `phase03_floors_mocked_edge.spec.ts`,
 * `phase03_floors_roles_edge.spec.ts` and `phase03_floors_ui.spec.ts` only. Seeds live in `../phase03Seed.ts`.
 *
 * - `openAdminPage`: own browser context with its own admin login (no shared session file: files run in parallel).
 * - `openPoolPage`: own browser context signed in as a pool user (one `POST /api/auth/login`).
 * - `holdFirst`: delays the FIRST matching request until released (not a mock: the real request then goes through).
 * - Floor-table locators as the main chain (`<tr aria-label="{name}, cao độ …">`, FloorTableRow.tsx).
 */
import { expect, type APIRequestContext, type Browser, type BrowserContext, type Locator, type Page, type Route } from '@playwright/test';

import { watchApi, type ApiEntry } from '../../../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../../../e2e/fullstack/env';
import { signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import { signInPoolUser, type PoolUser } from '../phase03Seed';

export const DESKTOP = { width: 1440, height: 900 } as const;

export interface OpenPage {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly api: ApiEntry[];
}

/** One real admin API login (`signedInApi`); caller disposes it. */
export function adminApi(): Promise<APIRequestContext> {
  const { email, password } = readAdminCredentials();
  return signedInApi(email, password);
}

/**
 * Own admin browser session: one `POST /api/auth/login` in a fresh context. Not the stored admin session: files run in
 * parallel (`--workers`), and every refresh of one shared cookie rotates it under the other files.
 */
export async function openAdminPage(browser: Browser, viewport: { width: number; height: number } = DESKTOP): Promise<OpenPage> {
  const { email, password } = readAdminCredentials();
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport });
  try {
    const res = await context.request.post('/api/auth/login', {
      data: { email, password, rememberMe: false },
      headers: { Origin: readBaseUrl() },
    });
    expect(res.status(), 'setup: POST /api/auth/login as admin').toBe(204);
    const page = await context.newPage();
    return { context, page, api: watchApi(page) };
  } catch (error) {
    await context.close();
    throw error;
  }
}

export async function openPoolPage(browser: Browser, user: PoolUser, viewport: { width: number; height: number } = DESKTOP): Promise<OpenPage> {
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport });
  try {
    await signInPoolUser(context, user);
    const page = await context.newPage();
    return { context, page, api: watchApi(page) };
  } catch (error) {
    await context.close();
    throw error;
  }
}

export async function closePage(open: OpenPage | undefined): Promise<void> {
  if (open === undefined) return;
  await open.context.close().catch(() => undefined);
}

/** Holds the first request `match` accepts until `release()`; every other request passes. */
export async function holdFirst(
  page: Page,
  match: (url: URL, method: string) => boolean,
): Promise<{ readonly seen: Promise<void>; release: () => Promise<void> }> {
  let open: () => void = () => undefined;
  let seenResolve: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => (open = resolve));
  const seen = new Promise<void>((resolve) => (seenResolve = resolve));
  let held = false;
  const handler = async (route: Route): Promise<void> => {
    const request = route.request();
    if (held || !match(new URL(request.url()), request.method())) {
      await route.fallback();
      return;
    }
    held = true;
    seenResolve();
    await gate;
    await route.continue().catch(() => undefined);
  };
  await page.route('**/api/**', handler);
  return {
    seen,
    release: async () => {
      open();
      await page.unroute('**/api/**', handler).catch(() => undefined);
    },
  };
}

export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

export const floorRows = (page: Page): Locator => page.getByRole('row', { name: /, cao độ /u });
export const floorRow = (page: Page, name: string): Locator =>
  page.getByRole('row', { name: new RegExp(`^${escapeRegExp(name)}, cao độ `, 'u') });

export async function floorRowNames(page: Page): Promise<string[]> {
  const labels = await floorRows(page).evaluateAll((rows) => rows.map((row) => row.getAttribute('aria-label') ?? ''));
  return labels.map((label) => label.replace(/, cao độ .*$/su, ''));
}

export const writesSince = (log: readonly ApiEntry[], mark: number): string[] =>
  log.slice(mark).filter((entry) => entry.method !== 'GET').map((entry) => `${entry.method} ${entry.path} ${String(entry.status)}`);

/** A project id that is not `prj_<ULID>`: BE answers 404 before any DB read (projects/access.py). */
export const unknownProjectId = (): string => `prj_qa-p4-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** #34 `PATCH /api/projects/:id/floors/:fid/spatial` (BE floors/router.py:67, FloorPatchIn) — fixture write. */
export async function patchFloor(
  api: APIRequestContext,
  projectId: string,
  floorId: string,
  body: Readonly<Record<string, unknown>>,
): Promise<void> {
  const res = await api.patch(`/api/projects/${projectId}/floors/${floorId}/spatial`, { data: body });
  expect(res.status(), `setup: PATCH floors/${floorId}/spatial ${JSON.stringify(body)}: ${(await res.text()).slice(0, 200)}`).toBe(200);
}

/** JSON error envelope as the BE sends it (`code` + `requestId`). */
export const errorBody = (code: string): string => JSON.stringify({ code, message: `qa-p4 mocked ${code}`, requestId: 'qa-p4-mock' });
