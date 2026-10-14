/**
 * QA-11 P12 helpers (phase11_session_c_edge.spec.ts): form sign-in and a POST /api/auth/logout counter.
 * Copy: e2e/fixtures/session.ts (labels); notices VI auth.notices.* (SessionBootstrap.tsx:299-304).
 */
import { expect, type Page } from '@playwright/test';

import { EMAIL_LABEL, PASSWORD_LABEL, SIGN_IN_LABEL } from '../../../../e2e/fixtures/session';
import type { PoolUser } from '../phase03Seed';

export const SESSION_ENDED = 'Phiên đăng nhập đã kết thúc. Hãy đăng nhập lại.';
export const SIGN_IN_REQUIRED = 'Hãy đăng nhập để tiếp tục.';

/** Fills the /login form already on screen as `user` and waits for `POST /api/auth/login` = 204 (as support/auth.ts signInAdmin). */
export async function formSignIn(page: Page, user: PoolUser): Promise<void> {
  await page.getByLabel(EMAIL_LABEL, { exact: true }).fill(user.email);
  await page.getByLabel(PASSWORD_LABEL, { exact: true }).fill(user.password);
  const login = page.waitForResponse(
    (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/auth/login',
  );
  await page.getByRole('button', { name: SIGN_IN_LABEL, exact: true }).click();
  expect((await login).status(), 'POST /api/auth/login').toBe(204);
}

/** Counts every logout POST sent by `page` (read after a certain milestone, never right after the click). */
export function countLogouts(page: Page): { readonly count: () => number } {
  let n = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/auth/logout') n += 1;
  });
  return { count: () => n };
}
