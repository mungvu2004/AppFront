/** P9 helpers: locators of DataEntryDemo (src/screens/DataEntryDemo.tsx) and ListReviewDemo (src/screens/ListReviewDemo.tsx). */
import type { Locator, Page } from '@playwright/test';

export const DATA_ENTRY = '/data-entry-demo';
export const LIST_REVIEW = '/list-review-demo';

/** The grid cell of a demo block: `<div><h3>title</h3>control</div>` (DataEntryDemo.tsx:30-80). */
export function cell(page: Page, title: string): Locator {
  return page.locator(`div:has(> h3:text-is("${title}"))`);
}

/** NumericField #3 "3. Invalid (Min: 50)" — its input (DataEntryDemo.tsx:42-45). */
export function numeric3(page: Page): Locator {
  return cell(page, '3. Invalid (Min: 50)').getByRole('textbox');
}

/** Select (Standard) trigger: only `Select` renders `role=combobox` on a button (Select.tsx:121); Combobox's trigger has none. */
export function selectTrigger(page: Page): Locator {
  return page.locator('button[role="combobox"]');
}

/** Combobox (Fuzzy Search) trigger button (ComboboxRoot.tsx:105). */
export function comboTrigger(page: Page): Locator {
  return cell(page, 'Combobox (Fuzzy Search)').getByRole('button');
}

/** The search box inside the open Combobox panel (ComboboxDropdown.tsx:98-106). */
export function comboSearch(page: Page): Locator {
  return page.locator('input[role="combobox"]');
}

/** ListReviewDemo state-bar button (ListReviewDemo.tsx:74-82). */
export function stateButton(page: Page, state: string): Locator {
  return page.getByRole('button', { name: state, exact: true });
}

/** Data rows (not header, not partial banner) and skeleton rows of the list table. */
export function dataRows(page: Page): Locator {
  return page.locator('tbody tr').filter({ hasText: /W-\d{3}/u });
}

/** Full-area overlay of the empty/error/permission/success states (ListReviewDemo.tsx:101-135). */
export function overlay(page: Page): Locator {
  return page.locator('div.absolute.inset-0.z-20');
}
