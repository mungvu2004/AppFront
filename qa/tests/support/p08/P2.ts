/**
 * P2 helpers for phase08_library_edge.spec.ts (SCR-34 Model Library, read-only screen).
 * Sources: ML ModelLibrary.tsx, MLT ...Toolbar.tsx, MLB ...Table.tsx, MLD ...Detail.tsx, UML useModelLibrary.ts (src/screens/admin/ModelLibrary).
 */
import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { LIBRARY_FILTER_IDS, type LibraryFilterId } from '../../../../src/api/schemas/library';
import { foldForSearch } from '../../../../src/lib/format/fold';
import { formatFileSize } from '../../../../src/lib/format/bytes';
import { formatLength } from '../../../../src/lib/format/measure';
import { formatNumber } from '../../../../src/lib/format/number';
import { captureEvidence } from '../evidence';

export { formatFileSize, formatNumber, foldForSearch, LIBRARY_FILTER_IDS };
export type { LibraryFilterId };

/** Wire item of GET /api/library (src/api/schemas/library.ts:124-137, camelCase). */
export interface Item {
  readonly id: string;
  readonly name: string;
  readonly group: string;
  readonly source: string;
  readonly widthMm: number;
  readonly depthMm: number;
  readonly heightMm: number;
  readonly fileSizeBytes: number;
  readonly triangleCount: number;
  readonly modelUrl: string;
  readonly previewUrl?: string;
}

export const TEXT = {
  noMatch: 'Không tìm thấy model phù hợp.', // MLB:31
  readOnly: 'Vai trò của bạn chỉ xem được thư viện, nên mọi hành động sửa danh mục không hiện', // UML:102-103
  detail: 'Chi tiết model', // MLD:293
  close: 'Đóng panel chi tiết model', // MLD:306
  gridList: 'lưới model', // MLB:33
  viewMode: 'Chế độ xem', // MLT:20
  breadcrumb: 'Đường dẫn trang', // ML:36
} as const;

/** Logs every /api/ request with its method. */
export function recordRequests(page: Page): { list: () => { method: string; path: string }[] } {
  const seen: { method: string; path: string }[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.pathname.startsWith('/api/')) seen.push({ method: req.method(), path: url.pathname });
  });
  return { list: () => [...seen] };
}

/** dup-of: library.ts readLibrary — runs `navigate`, waits GET /api/library 200, returns the items and the response status/search. */
export async function openLibrary(page: Page, navigate: () => Promise<unknown>): Promise<{ items: Item[]; status: number; search: string }> {
  const read = page.waitForResponse((r) => r.request().method() === 'GET' && new URL(r.url()).pathname === '/api/library');
  await navigate();
  const res = await read;
  const body: unknown = await res.json();
  expect(Array.isArray(body), 'GET /api/library is a bare array').toBe(true);
  await expect(searchBox(page)).toBeVisible();
  return { items: body as Item[], status: res.status(), search: new URL(res.url()).search };
}

export const searchBox = (page: Page): Locator => page.getByRole('textbox', { name: 'tìm model', exact: true });
export const categoryBox = (page: Page): Locator => page.getByRole('combobox', { name: 'danh mục', exact: true });
export const viewRadio = (page: Page, name: 'Bảng' | 'Lưới'): Locator =>
  page.locator(`[aria-label="${TEXT.viewMode}"]`).getByRole('radio', { name, exact: true });
export const head = (page: Page, name: string): Locator => page.getByRole('columnheader', { name, exact: true });
export const detailAside = (page: Page): Locator => page.locator(`aside[aria-label="${TEXT.detail}"]`);
export const nameButtons = (page: Page): Locator => page.locator('tbody tr td:nth-child(2) button');
export const bodyRows = (page: Page): Locator => page.locator('tbody tr');
export const summaryValue = (page: Page, caption: string): Locator =>
  page.locator('dt', { hasText: caption }).locator('xpath=following-sibling::dd[1]');
export const nameBtn = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true }).first();

export const viSort = (names: readonly string[]): string[] => [...names].sort((a, b) => a.localeCompare(b, 'vi'));
export const matchesFilter = (item: Item, id: string): boolean => (id === 'all' ? true : id === 'mine' ? item.source === 'mine' : item.group === id);
export const matchesText = (item: Item, term: string): boolean => {
  const needle = foldForSearch(term).trim();
  return needle === '' || foldForSearch(item.name).includes(needle); // UML:217-221
};
export const boundsLabel = (i: Item): string => [i.widthMm, i.depthMm, i.heightMm].map((v) => formatLength(v, { unit: 'm' })).join(' × '); // UML:155-159

/** Picks the category by its position in LIBRARY_FILTER_IDS (UML filterOptions follow it). */
export async function selectCategory(page: Page, id: string): Promise<void> {
  await categoryBox(page).click();
  await page.getByRole('option').nth(LIBRARY_FILTER_IDS.indexOf(id as LibraryFilterId)).click();
}

export const shownNames = async (page: Page): Promise<string[]> => (await nameButtons(page).allInnerTexts()).map((t) => t.trim());

/** Rows (table) shown must equal the items that match `term` and `filterId` (order ignored). */
export async function expectRows(page: Page, items: readonly Item[], term: string, filterId = 'all', soft = true): Promise<void> {
  const want = viSort(items.filter((i) => matchesFilter(i, filterId) && matchesText(i, term)).map((i) => i.name));
  const check = soft ? expect.configure({ soft: true }) : expect;
  await check.poll(async () => viSort(await shownNames(page)), { message: `rows for "${term}" / ${filterId}` }).toEqual(want);
}

export const ev = (page: Page, id: string, slug: string): Promise<string> => captureEvidence(page, `E08_${id}_${slug}.png`);

/** Text of column `n` (1-based) of every table row. */
export const columnTexts = async (page: Page, n: number): Promise<string[]> =>
  (await page.locator(`tbody tr td:nth-child(${n})`).allInnerTexts()).map((t) => t.trim());

export const isNonDecreasing = <T>(values: readonly T[], cmp: (a: T, b: T) => number): boolean => values.every((v, i) => i === 0 || cmp(values[i - 1] as T, v) <= 0);
