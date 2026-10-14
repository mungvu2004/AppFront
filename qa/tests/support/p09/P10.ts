/** P10 helpers (phase 09 admin screens x roles). */
import type { Page } from '@playwright/test';

/** `METHOD pathname` of every request the page sends whose path matches `pattern`. */
export function recordRequests(page: Page, pattern: RegExp): { urls: () => string[] } {
  const seen: string[] = [];
  page.on('request', (req) => {
    const { pathname } = new URL(req.url());
    if (pattern.test(pathname)) seen.push(`${req.method()} ${pathname}`);
  });
  return { urls: () => [...seen] };
}

/** Settle marker for forbidden screens: the page's own requests have drained. */
export const settle = (page: Page): Promise<void> => page.waitForLoadState('networkidle');

/** Requests logged after `mark` whose path matches `pattern`. */
export const since = (urls: string[], mark: number, pattern: RegExp): string[] =>
  urls.slice(mark).filter((u) => pattern.test(u.split(' ')[1] ?? ''));
