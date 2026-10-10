import { expect, type Page } from '@playwright/test';

import { ROUTES, loginUrl, pathOf } from '../../../e2e/fixtures/routes';
import { EMAIL_LABEL, PASSWORD_LABEL, SIGN_IN_LABEL } from '../../../e2e/fixtures/session';

/** Track B (mock dev server: `VITE_USE_MOCK_API=true pnpm exec vite --host 127.0.0.1 --port 5173`). */
export const MOCK_BASE_URL = process.env.E2E_MOCK_BASE_URL ?? `http://127.0.0.1:${process.env.E2E_PORT ?? '5173'}`;

export interface AdminCredentials {
  readonly email: string;
  readonly password: string;
}

/** Track A admin (CP-1). Same variables as F-14 (`e2e/fullstack/README.md`); the password is never logged. */
export function readAdminCredentials(): AdminCredentials {
  const email = process.env.E2E_ADMIN_EMAIL?.trim();
  const password = process.env.E2E_ADMIN_PASSWORD;
  const missing = [
    ...(email ? [] : ['E2E_ADMIN_EMAIL']),
    ...(password !== undefined && password !== '' ? [] : ['E2E_ADMIN_PASSWORD']),
  ];

  if (missing.length > 0 || email === undefined || password === undefined) {
    throw new Error(`Missing environment for Track A (CP-1): ${missing.join(', ')}. See e2e/fullstack/README.md.`);
  }

  return { email, password };
}

/**
 * UI sign-in as the Track A admin, for phases 2–11. Phase 1 tests the login itself in detail.
 * Proven contract (chain.fullstack.ts step 1): `POST /api/auth/login` → 204, then the destination.
 */
export async function signInAdmin(page: Page, destination: string = ROUTES.dashboard): Promise<void> {
  const { email, password } = readAdminCredentials();

  await page.goto(destination === ROUTES.dashboard ? ROUTES.login : loginUrl(destination));
  await page.getByLabel(EMAIL_LABEL, { exact: true }).fill(email);
  // `exact`: otherwise it also matches the "Hiện mật khẩu" button.
  await page.getByLabel(PASSWORD_LABEL, { exact: true }).fill(password);

  const login = page.waitForResponse(
    (response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/auth/login',
  );
  await page.getByRole('button', { name: SIGN_IN_LABEL, exact: true }).click();
  expect((await login).status(), 'POST /api/auth/login').toBe(204);
  await expect.poll(() => pathOf(page.url())).toBe(destination);
}

/** `ProjectDashboard.tsx` h1 — the dashboard screen has painted. */
export const DASHBOARD_TITLE = 'Dự án của tôi';

/**
 * BUG-089: the h1 paints before the project list; while `state === 'loading'` the list is six `Skeleton` cards
 * (`animate-pulse`, ProjectDashboard.tsx:245-250). Evidence of "signed in, on the dashboard" waits for them to go
 * (grid, list, empty state or error — whichever the account has).
 */
export async function dashboardLoaded(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name: DASHBOARD_TITLE, exact: true })).toBeVisible();
  await expect(page.locator('main .animate-pulse'), 'project list loaded (no skeleton card left)').toHaveCount(0);
}

/**
 * BUG-094: a password the FE lets through but the BE rejects as too short. Four astral characters are 8 UTF-16
 * units for zod `.min(8)` (`src/api/schemas/index.ts:74`, `schemas/auth.ts:21` measure `.length`) and 4 code
 * points for pydantic `min_length=8` (BE:apps/api/auth/router.py:72, auth_recovery/router.py:88,96), so the real
 * stack answers 422 VALIDATION on the password field. A mocked password 422 shows THIS value in the box — a state
 * a person can reach — and `phase01_auth_api.spec.ts` proves the real 422 with the same value.
 */
export const BE_SHORT_PASSWORD = '\u{1F511}'.repeat(4);
