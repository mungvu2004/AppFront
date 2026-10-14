/** P10 helpers for the ListReviewDemo dev flows (src/screens/ListReviewDemo.tsx). */
import type { Locator, Page } from '@playwright/test';

/** Body rows of the review table (48 in default state; no `partial` banner row here). */
export const bodyRows = (page: Page): Locator => page.locator('tbody tr');

/** Body row whose code cell reads `code` (e.g. `W-003`). */
export const rowOf = (page: Page, code: string): Locator =>
  bodyRows(page).filter({ has: page.getByRole('cell', { name: code, exact: true }) });

/** Row selection checkbox of `code` (bare `<input type=checkbox>`, ListReviewDemo.tsx:196). */
export const rowCheck = (page: Page, code: string): Locator => rowOf(page, code).locator('input[type="checkbox"]');

/** Header "select all" checkbox (ListReviewDemo.tsx:137). */
export const headCheck = (page: Page): Locator => page.locator('thead input[type="checkbox"]');

/** Keyboard-owning table region (ListReviewDemo.tsx:101). */
export const region = (page: Page): Locator => page.locator('div.relative[tabindex="0"]');

/** Code column text of every body row, in DOM order. */
export const codes = (page: Page): Promise<string[]> => bodyRows(page).locator('td:nth-child(2)').allTextContents();

/** Class test for the row focus ring `ring-2` (not the `focus-visible:ring-2` variant). */
export const RING = /(^|\s)ring-2(\s|$)/u;
