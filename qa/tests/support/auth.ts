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
