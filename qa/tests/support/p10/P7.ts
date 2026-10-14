/** P7 helpers: /design-system/states (SCR-40, S-47) locators shared by FL-10D-07 and FL-10D-08. */
import type { Page } from '@playwright/test';

import { expect } from './devServer';

export const STATES_PATH = '/design-system/states';
export const SELECTED_LABEL = 'Cài đặt tài khoản'; // stateGalleryManifest.ts:70-73
export const EMPTY_TITLE = 'Chưa chọn màn nào'; // StateGallery.tsx:EMPTY_TITLE
export const CHECK_CAPTION = 'Kết quả bốn phép kiểm theo từng màn'; // StateGalleryToolbar.tsx:CHECK_TABLE_CAPTION

export const tree = (page: Page) => page.getByRole('navigation', { name: 'Cây màn theo nhóm' });
export const searchBox = (page: Page) => page.getByRole('searchbox', { name: 'Tìm màn' });
export const toggle = (page: Page, name: string) => page.getByRole('switch', { name });
export const runButton = (page: Page) => page.getByRole('button', { name: 'Chạy kiểm nhanh' });
export const emptyTitle = (page: Page) => page.getByText(EMPTY_TITLE, { exact: true });
export const checkPanelHeading = (page: Page) => page.getByRole('heading', { name: CHECK_CAPTION, level: 2 });
export const resultTable = (page: Page) => page.getByRole('table', { name: CHECK_CAPTION });
export const preview = (page: Page) => page.getByRole('region', { name: 'Khung xem trước bảy trạng thái' });

/** Open the states page and wait for its named h1 (landmark before any absence assertion). */
export async function openStates(page: Page): Promise<void> {
  await page.goto(STATES_PATH);
  await expect(page.getByRole('heading', { name: 'Duyệt bảy trạng thái', level: 1 })).toBeVisible();
}

export async function pickScreen(page: Page, label: string): Promise<void> {
  await tree(page).getByRole('button', { name: new RegExp(`^${label}`) }).click();
  await expect(page.getByRole('heading', { name: label, level: 2 })).toBeVisible();
}

/** Name of the focused element (aria-label, else text) — for the focus-after-collapse check. */
export const activeName = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return el === null || el === document.body ? 'BODY' : (el.getAttribute('aria-label') ?? el.textContent ?? '');
  });
