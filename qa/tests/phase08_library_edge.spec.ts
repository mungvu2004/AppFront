/**
 * Phase 08 - SCR-34 Model Library edge flows FL-34L-01..08 (read-only screen, no cleanup needed).
 * Sources under src/screens/admin/ModelLibrary: ML ModelLibrary.tsx, MLT ...Toolbar, MLB ...Table, MLD ...Detail, UML useModelLibrary.ts.
 * Request budget: 7 admin UI logins (FL-01..06, FL-08), 1 admin API login in FL-07, 0 invitations ever sent here
 * (shared read-only pool users p08-eng / p08-view; created once at most, by the admin API).
 * Oracles come from GET /api/library read first in every flow (never literals).
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { signInAdmin } from './support/auth';
import { poolUser, signInPoolUser } from './support/phase03Seed';
import { adminApi, holdResponse } from './support/p08/admin';
import {
  TEXT, bodyRows, boundsLabel, categoryBox, columnTexts, detailAside, ev, expectRows, foldForSearch, formatFileSize, formatNumber,
  head, isNonDecreasing, matchesFilter, nameBtn, nameButtons, openLibrary, recordRequests, searchBox, selectCategory,
  shownNames, summaryValue, viSort, viewRadio, type Item,
} from './support/p08/P2';

test.use({ viewport: { width: 1440, height: 900 } });

const openAdmin = async (page: Page) => {
  const rec = recordRequests(page);
  const opened = await openLibrary(page, () => signInAdmin(page, ROUTES.adminModels));
  return { rec, ...opened };
};
/** n-th item whose name is unique in the list. */
const pick = (items: readonly Item[], n = 0): Item => items.filter((i) => items.filter((j) => j.name === i.name).length === 1)[n] as Item;

test('SCR-34 · FL-34L-01 · search and category logic, summary strip, one GET', async ({ page }) => {
  const { rec, items, status, search } = await openAdmin(page);
  const openCalls = rec.list().filter((r) => r.method === 'GET' && r.path === '/api/library').length;
  expect(items.length, 'environment: library has models').toBeGreaterThan(0);
  const x = pick(items);
  const part = x.name.slice(0, Math.min(4, x.name.length));
  await test.step('[34L-A-014] search and category AND', async () => {
    await selectCategory(page, x.group);
    await searchBox(page).fill(part);
    await expectRows(page, items, part, x.group, false);
    await ev(page, '34L-A-014', 'and');
  });
  await test.step('[34L-B-007] no match: one empty row', async () => {
    await searchBox(page).fill(`zz-no-model-${Date.now()}`);
    await expect(page.getByText(TEXT.noMatch, { exact: true })).toBeVisible();
    await expect(bodyRows(page)).toHaveCount(1);
    await ev(page, '34L-B-007', 'empty');
  });
  await test.step('[34L-B-010] no match: summary zeros', async () => {
    await expect.soft(summaryValue(page, 'Tổng số model')).toHaveText('0');
    await expect.soft(summaryValue(page, 'Tổng dung lượng')).toHaveText(formatFileSize(0));
    await expect.soft(summaryValue(page, 'Model nặng')).toHaveText('0');
    await ev(page, '34L-B-010', 'zeros');
  });
  await selectCategory(page, 'all');
  await test.step('[34L-C-001] case-insensitive', async () => {
    await searchBox(page).fill(x.name.toUpperCase());
    await expectRows(page, items, x.name.toUpperCase());
    await expect.soft(nameBtn(page, x.name)).toBeVisible();
    await ev(page, '34L-C-001', 'case');
  });
  await test.step('[34L-C-002] diacritics and d', async () => {
    const folded = foldForSearch(x.name);
    await searchBox(page).fill(folded);
    await expectRows(page, items, folded);
    await expect.soft(nameBtn(page, x.name)).toBeVisible();
    await searchBox(page).fill('dien');
    await expectRows(page, items, 'dien');
    await ev(page, '34L-C-002', 'fold');
  });
  await test.step('[34L-C-003] outer spaces trimmed, blanks = all', async () => {
    await searchBox(page).fill(`  ${part}  `);
    await expectRows(page, items, part);
    await searchBox(page).fill('   ');
    await expectRows(page, items, '');
    await ev(page, '34L-C-003', 'trim');
  });
  await test.step('[34L-C-004] substring not prefix', async () => {
    const mid = x.name.slice(1, Math.min(x.name.length, 4));
    await searchBox(page).fill(mid);
    await expectRows(page, items, mid);
    await expect.soft(nameBtn(page, x.name)).toBeVisible();
    await ev(page, '34L-C-004', 'substring');
  });
  await searchBox(page).fill('');
  await test.step('[34L-C-005] category counts', async () => {
    await categoryBox(page).click();
    const texts = (await page.getByRole('option').allInnerTexts()).map((t) => t.trim());
    for (const id of ['all', ...new Set(items.map((i) => i.group)), 'mine']) {
      const n = items.filter((i) => matchesFilter(i, id)).length;
      expect.soft(texts.some((t) => t.endsWith(`(${n})`)), `option for ${id} has count ${n}: ${texts.join(' | ')}`).toBe(true);
    }
    expect.soft(texts[0], 'Tất cả (n)').toContain(`(${items.length})`);
    await ev(page, '34L-C-005', 'counts');
    await page.keyboard.press('Escape');
  });
  await test.step('[34L-C-006] "Của tôi" lists only own', async () => {
    await selectCategory(page, 'mine');
    await expectRows(page, items, '', 'mine');
    await ev(page, '34L-C-006', 'mine');
  });
  await test.step('[34L-C-007] summary count follows filtered rows', async () => {
    await selectCategory(page, x.group);
    await expect.soft(summaryValue(page, 'Tổng số model')).toHaveText(formatNumber(items.filter((i) => matchesFilter(i, x.group)).length));
    await ev(page, '34L-C-007', 'count');
  });
  await test.step('[34L-C-008] summary size = sum of visible', async () => {
    const rows = items.filter((i) => matchesFilter(i, x.group));
    await expect.soft(summaryValue(page, 'Tổng dung lượng')).toHaveText(formatFileSize(rows.reduce((s, i) => s + i.fileSizeBytes, 0)));
    await ev(page, '34L-C-008', 'size');
  });
  await test.step('[34L-G-001] one GET /api/library, bare array, 200, no query', async () => {
    expect(openCalls, 'GET /api/library count after open').toBe(1);
    expect(status).toBe(200);
    expect(search).toBe('');
    await ev(page, '34L-G-001', 'one_get');
  });
});

test('SCR-34 · FL-34L-02 · sort every column, header keyboard, reload resets', async ({ page }) => {
  const { items } = await openAdmin(page);
  expect(items.length, 'environment: library has models').toBeGreaterThan(0);
  const byName = new Map(items.map((i) => [i.name, i]));
  const valuesOf = async (key: (i: Item) => number): Promise<number[]> => (await shownNames(page)).map((n) => key(byName.get(n) as Item));
  const nameHead = head(page, 'Tên');
  await test.step('[34L-A-004] Tên header toggles', async () => {
    await expect(nameHead).toHaveAttribute('aria-sort', 'ascending');
    await nameHead.click();
    await expect(nameHead).toHaveAttribute('aria-sort', 'descending');
    await nameHead.click();
    await expect(nameHead).toHaveAttribute('aria-sort', 'ascending');
    await ev(page, '34L-A-004', 'name');
  });
  await test.step('[34L-A-015] sort survives filter', async () => {
    await head(page, 'Số tam giác').click();
    await selectCategory(page, 'all');
    await searchBox(page).fill((items[0] as Item).name.slice(0, 1));
    await expect.soft(head(page, 'Số tam giác')).toHaveAttribute('aria-sort', 'ascending');
    await searchBox(page).fill('');
    await ev(page, '34L-A-015', 'survives');
  });
  await test.step('[34L-C-010] Tên vi order', async () => {
    await nameHead.click();
    await expect.poll(async () => shownNames(page)).toEqual(viSort(items.map((i) => i.name)));
    await ev(page, '34L-C-010', 'name_vi');
  });
  await test.step('[34L-C-011] Danh mục by label', async () => {
    await head(page, 'Danh mục').click();
    const labels = await columnTexts(page, 3);
    expect.soft(isNonDecreasing(labels, (a, b) => a.localeCompare(b, 'vi')), labels.join(',')).toBe(true);
    await ev(page, '34L-C-011', 'group');
  });
  await test.step('[34L-C-012] bounds by volume', async () => {
    await head(page, 'Kích thước bao').click();
    const v = await valuesOf((i) => i.widthMm * i.depthMm * i.heightMm);
    expect.soft(isNonDecreasing(v, (a, b) => a - b), v.join(',')).toBe(true);
    await ev(page, '34L-C-012', 'bounds');
  });
  await test.step('[34L-C-013] Dung lượng by bytes', async () => {
    await head(page, 'Dung lượng').click();
    const v = await valuesOf((i) => i.fileSizeBytes);
    expect.soft(isNonDecreasing(v, (a, b) => a - b), v.join(',')).toBe(true);
    await ev(page, '34L-C-013', 'size');
  });
  await test.step('[34L-C-014] triangles numeric asc then desc', async () => {
    const tri = head(page, 'Số tam giác');
    await tri.click();
    const asc = await valuesOf((i) => i.triangleCount);
    expect.soft(isNonDecreasing(asc, (a, b) => a - b), asc.join(',')).toBe(true);
    await tri.click();
    await expect.soft(tri).toHaveAttribute('aria-sort', 'descending');
    const desc = await valuesOf((i) => i.triangleCount);
    expect.soft(isNonDecreasing(desc, (a, b) => b - a), desc.join(',')).toBe(true);
    await ev(page, '34L-C-014', 'triangles');
  });
  await test.step('[34L-C-015] only the active header has aria-sort', async () => {
    const values = await page.getByRole('columnheader').evaluateAll((els) => els.map((e) => e.getAttribute('aria-sort')));
    expect.soft(values.filter((v) => v === 'ascending' || v === 'descending')).toHaveLength(1);
    await ev(page, '34L-C-015', 'aria_sort');
  });
  await test.step('[34L-E-005] ⚑ headers operable with keyboard', async () => {
    // Real keyboard path: from the search box, Tab until focus is inside the Tên header (max 30), then Enter.
    await searchBox(page).focus();
    let inHeader = false;
    for (let i = 0; i < 30 && !inHeader; i += 1) {
      await page.keyboard.press('Tab');
      inHeader = await nameHead.evaluate((el) => el.contains(document.activeElement));
    }
    expect.soft(inHeader, 'Tab reaches a control inside the Tên header (TBL:166-176)').toBe(true);
    await page.keyboard.press('Enter');
    await expect.soft(nameHead).toHaveAttribute('aria-sort', 'ascending');
    await ev(page, '34L-E-005', 'keyboard');
  });
});

test('SCR-34 · FL-34L-03 · view modes, grid keyboard, no writes', async ({ page }) => {
  const { rec, items } = await openAdmin(page);
  // rec also saw the UI sign-in (POST /api/auth/login, support/auth.ts:43-47): G-003 only counts what this flow sends.
  const fromOpen = rec.list().length;
  expect(items.length, 'environment: library has models').toBeGreaterThan(0);
  const x = pick(items);
  const part = x.name.slice(0, Math.min(3, x.name.length));
  await test.step('[34L-A-007] Bảng again: same rows and sort', async () => {
    await head(page, 'Số tam giác').click();
    const before = await shownNames(page);
    await viewRadio(page, 'Lưới').click();
    await viewRadio(page, 'Bảng').click();
    await expect(head(page, 'Số tam giác')).toHaveAttribute('aria-sort', 'ascending');
    expect(await shownNames(page)).toEqual(before);
    await ev(page, '34L-A-007', 'table_back');
  });
  await test.step('[34L-A-016] switching view keeps filters', async () => {
    await searchBox(page).fill(part);
    await selectCategory(page, x.group);
    await viewRadio(page, 'Lưới').click();
    await expect.soft(searchBox(page)).toHaveValue(part);
    await expect.soft(categoryBox(page)).toContainText(`(${items.filter((i) => matchesFilter(i, x.group)).length})`);
    await viewRadio(page, 'Bảng').click();
    await expect.soft(head(page, 'Số tam giác')).toHaveAttribute('aria-sort', 'ascending');
    await ev(page, '34L-A-016', 'keeps');
  });
  await test.step('[34L-B-008] grid no match: paragraph', async () => {
    await viewRadio(page, 'Lưới').click();
    await searchBox(page).fill(`zz-none-${Date.now()}`);
    await expect.soft(page.getByText(TEXT.noMatch, { exact: true })).toBeVisible();
    await expect.soft(page.getByRole('list', { name: TEXT.gridList })).toHaveCount(0);
    await ev(page, '34L-B-008', 'grid_empty');
  });
  await test.step('[34L-E-003] ArrowRight picks Lưới', async () => {
    await searchBox(page).fill('');
    await viewRadio(page, 'Bảng').click();
    await viewRadio(page, 'Bảng').focus();
    await page.keyboard.press('ArrowRight');
    await expect.soft(viewRadio(page, 'Lưới')).toHaveAttribute('aria-checked', 'true');
    await ev(page, '34L-E-003', 'arrow');
  });
  await test.step('[34L-E-004] grid list semantics, Enter opens', async () => {
    await selectCategory(page, 'all');
    const grid = page.getByRole('list', { name: TEXT.gridList });
    await expect.soft(grid).toBeVisible();
    const card = grid.getByRole('listitem', { name: x.name, exact: true });
    await expect.soft(card).toHaveAttribute('tabindex', '0');
    await card.focus();
    await page.keyboard.press('Enter');
    await expect.soft(detailAside(page)).toBeVisible();
    await ev(page, '34L-E-004', 'grid_enter');
  });
  await test.step('[34L-G-003] no non-GET request', async () => {
    await page.keyboard.press('Escape');
    expect.soft(rec.list().slice(fromOpen).filter((r) => r.method !== 'GET'), 'non-GET requests').toEqual([]);
    await ev(page, '34L-G-003', 'no_writes');
  });
});

test('SCR-34 · FL-34L-04 · detail panel: content, close paths, focus, filter independence', async ({ page }) => {
  const { rec, items } = await openAdmin(page);
  expect(items.length, 'environment: at least 2 models').toBeGreaterThan(1);
  const x = pick(items, 0);
  const y = pick(items, 1);
  const aside = detailAside(page);
  const section = (label: string) => aside.locator(`section[aria-label="${label}"]`);
  await test.step('[34L-A-008] name button opens detail + GET /api/library/:id', async () => {
    await nameBtn(page, x.name).click();
    await expect(aside).toBeVisible();
    await expect(aside.getByRole('heading', { level: 2 })).toHaveText(x.name);
    await expect.poll(() => rec.list().some((r) => r.method === 'GET' && r.path === `/api/library/${x.id}`)).toBe(true);
    await ev(page, '34L-A-008', 'open');
  });
  await test.step('[34L-A-011] close button removes panel', async () => {
    const before = await shownNames(page);
    await aside.getByRole('button', { name: TEXT.close }).click();
    await expect.soft(aside).toHaveCount(0);
    expect.soft(await shownNames(page)).toEqual(before);
    await ev(page, '34L-A-011', 'closed');
  });
  await test.step('[34L-A-012] second model switches panel', async () => {
    await nameBtn(page, x.name).click();
    await expect(aside).toBeVisible();
    await nameBtn(page, y.name).click();
    await expect.soft(aside).toHaveCount(1);
    await expect.soft(aside.getByRole('heading', { level: 2 })).toHaveText(y.name);
    await ev(page, '34L-A-012', 'switch');
  });
  await nameBtn(page, x.name).click();
  const heavy = (await bodyRows(page).filter({ hasText: x.name }).first().innerText()).includes('Nặng');
  await test.step('[34L-B-018] normal model: no heavy section', async () => {
    expect(heavy, 'environment: first model is within budget').toBe(false);
    await expect(section('Cảnh báo model nặng')).toHaveCount(0);
    await ev(page, '34L-B-018', 'no_heavy');
  });
  await test.step('[34L-B-019] detail structure', async () => {
    await expect(aside.getByRole('heading', { level: 2 })).toHaveText(x.name);
    for (const l of ['Xem trước mô hình', 'Số tam giác', 'Siêu dữ liệu model']) await expect(section(l)).toBeVisible();
    await ev(page, '34L-B-019', 'structure');
  });
  const cell = async (n: number): Promise<string> => (await columnTexts(page, n))[(await shownNames(page)).indexOf(x.name)] ?? '';
  await test.step('[34L-B-020] metadata rows in order', async () => {
    const text = await section('Siêu dữ liệu model').innerText();
    const at = ['Kích thước bao', 'Số tam giác', 'dung lượng', 'nhóm'].map((l) => text.indexOf(l));
    expect.soft(at.every((n, i) => n >= 0 && (i === 0 || n > (at[i - 1] as number))), text).toBe(true);
    for (const v of [boundsLabel(x), await cell(5), await cell(6), await cell(3)]) expect.soft(text).toContain(v);
    await ev(page, '34L-B-020', 'metadata');
  });
  await test.step('[34L-B-021] Máy chủ khai = list count', async () => {
    await expect.soft(section('Số tam giác').locator('dt', { hasText: 'Máy chủ khai' }).locator('xpath=following-sibling::dd[1]')).toHaveText(await cell(5));
    await ev(page, '34L-B-021', 'declared');
  });
  await test.step('[34L-B-022] auto-spin note', async () => {
    await expect.soft(aside.getByText('Khung xem trước không tự quay; kéo chuột trong khung để xoay model', { exact: true })).toBeVisible();
    await ev(page, '34L-B-022', 'note');
  });
  await test.step('[34L-B-028] panel stays when search hides its row', async () => {
    await searchBox(page).fill(`zz-none-${Date.now()}`);
    await expect.soft(aside).toBeVisible();
    await expect.soft(page.getByText(TEXT.noMatch, { exact: true })).toBeVisible();
    await ev(page, '34L-B-028', 'independent');
  });
  await test.step('[34L-E-006] aria attributes', async () => {
    await expect.soft(aside).toHaveAttribute('aria-label', TEXT.detail);
    await expect.soft(aside.getByRole('button', { name: TEXT.close })).toBeVisible();
    await expect.soft(aside.locator('canvas')).toHaveAttribute('aria-hidden', 'true');
    await expect.soft(section('Xem trước mô hình')).toBeVisible();
    await ev(page, '34L-E-006', 'aria');
  });
  await searchBox(page).fill('');
  await test.step('[34L-E-007] ⚑ closing returns focus to opener', async () => {
    await aside.getByRole('button', { name: TEXT.close }).click();
    await nameBtn(page, y.name).focus();
    await page.keyboard.press('Enter');
    await expect(aside).toBeVisible();
    await aside.getByRole('button', { name: TEXT.close }).click();
    await expect.soft(nameBtn(page, y.name), 'opener has focus after close').toBeFocused();
    await ev(page, '34L-E-007', 'focus');
  });
  await test.step('[34L-E-008] keyboard open: Tab reaches close', async () => {
    await nameBtn(page, x.name).focus();
    await page.keyboard.press('Enter');
    await expect(aside).toBeVisible();
    let reached = false;
    for (let i = 0; i < 40 && !reached; i += 1) {
      await page.keyboard.press('Tab');
      reached = await aside.getByRole('button', { name: TEXT.close }).evaluate((el) => el === document.activeElement);
    }
    expect.soft(reached, 'Tab reaches the close button').toBe(true);
    await ev(page, '34L-E-008', 'tab');
  });
  await test.step('[34L-G-002] GET /api/library/<id> with the clicked id', async () => {
    const reads = rec.list().filter((r) => r.method === 'GET' && r.path.startsWith('/api/library/'));
    expect.soft(reads.map((r) => r.path)).toContain(`/api/library/${x.id}`);
    await ev(page, '34L-G-002', 'get_id');
  });
});

test('SCR-34 · FL-34L-05 · 3D preview loads the signed GLB and measures triangles', async ({ page }) => {
  const { items } = await openAdmin(page);
  expect(items.length, 'environment: library has models').toBeGreaterThan(0);
  const x = pick(items);
  const modelPath = new URL(x.modelUrl).pathname;
  const hold = await holdResponse(page, `**${modelPath}*`, 'GET'); // holds the REAL response, not a mock
  const glb = page.waitForResponse((r) => new URL(r.url()).pathname === modelPath);
  const aside = detailAside(page);
  await nameBtn(page, x.name).click();
  await test.step('[34L-B-023] loading skeleton over canvas', async () => {
    await expect(aside).toBeVisible();
    await hold.seen;
    await expect.soft(aside.locator('canvas')).toHaveClass(/opacity-0/);
    await ev(page, '34L-B-023', 'loading');
    await hold.release();
  });
  await test.step('[34L-B-024] ready: measured count and caption', async () => {
    const webgl = await page.evaluate(() => {
      const c = document.createElement('canvas');
      return c.getContext('webgl2') !== null || c.getContext('webgl') !== null;
    });
    expect.soft(webgl, 'environment: WebGL available').toBe(true);
    await expect.soft(aside.locator('dt', { hasText: 'Đo lại từ tệp' })).toBeVisible({ timeout: 30_000 });
    await expect.soft(aside.getByText('Hai số lệch nhau là chuyện thường: số đo lại đọc thẳng từ hình học trong tệp.', { exact: true })).toBeVisible();
    await ev(page, '34L-B-024', 'ready');
  });
  await test.step('[34L-C-016] bounds label W x D x H in metres', async () => {
    await expect.soft(aside.locator('section[aria-label="Siêu dữ liệu model"]')).toContainText(boundsLabel(x));
    await ev(page, '34L-C-016', 'bounds');
  });
  await test.step('[34L-G-012] preview fetches signed modelUrl', async () => {
    expect.soft((await glb).status()).toBe(200);
    await ev(page, '34L-G-012', 'glb');
  });
});

test('SCR-34 · FL-34L-06 · below 1024 px: card list, no-match, detail from a card', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  const { items } = await openAdmin(page);
  expect(items.length, 'environment: library has models').toBeGreaterThan(0);
  const x = pick(items);
  // icon-only "Thử tải lại ảnh xem trước…" (MLB:66-76) has no text: drop it so only name buttons are compared.
  const cardNames = async () => (await page.locator('main ul > li button').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
  await test.step('[34L-A-013] reload resets to defaults', async () => {
    await searchBox(page).fill(x.name.slice(0, 2));
    await selectCategory(page, x.group);
    const read = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/library' && r.request().method() === 'GET');
    await page.reload();
    await read;
    await expect(searchBox(page)).toHaveValue('');
    await expect.soft(viewRadio(page, 'Bảng')).toHaveAttribute('aria-checked', 'true');
    await expect.soft(categoryBox(page)).toContainText(`(${items.length})`);
    await expect.poll(cardNames, { message: 'default sort Tên ascending (cards)' }).toEqual(viSort(items.map((i) => i.name)));
    await ev(page, '34L-A-013', 'defaults');
  });
  await test.step('[34L-B-009] no match: paragraph', async () => {
    await searchBox(page).fill(`zz-none-${Date.now()}`);
    await expect.soft(page.getByText(TEXT.noMatch, { exact: true })).toBeVisible();
    await expect.soft(page.locator('main ul > li')).toHaveCount(0);
    await ev(page, '34L-B-009', 'empty');
  });
  await test.step('[34L-B-029] cards with four fields', async () => {
    await searchBox(page).fill('');
    await viewRadio(page, 'Lưới').click();
    const card = page.locator('main ul > li').first();
    await expect.soft(card).toBeVisible();
    expect.soft(await card.locator('dt').allInnerTexts()).toEqual(['Danh mục', 'Kích thước bao', 'Số tam giác', 'Dung lượng']);
    await expect.soft(page.getByRole('list', { name: TEXT.gridList })).toHaveCount(0);
    await ev(page, '34L-B-029', 'cards');
  });
  await test.step('[34L-B-030] card name opens detail', async () => {
    await page.getByRole('button', { name: x.name, exact: true }).first().click();
    await expect.soft(detailAside(page)).toBeVisible();
    await ev(page, '34L-B-030', 'detail');
  });
});

test('SCR-34 · FL-34L-07 · engineer and viewer: read-only alert, list readable', async ({ browser }) => {
  const admin = await adminApi();
  const contexts: { close: () => Promise<void> }[] = [];
  try {
    const sessions = new Map<string, { page: Page; status: number; items: Item[] }>();
    for (const [role, slot] of [['engineer', 'p08-eng'], ['viewer', 'p08-view']] as const) {
      const user = await poolUser(admin, role, slot);
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      contexts.push(context);
      await signInPoolUser(context, user);
      const page = await context.newPage();
      const opened = await openLibrary(page, () => page.goto(ROUTES.adminModels));
      sessions.set(role, { page, status: opened.status, items: opened.items });
    }
    const alertOk = async (role: string, id: string, slug: string) => {
      const s = sessions.get(role) as { page: Page; items: Item[] };
      await expect.soft(s.page.getByText(TEXT.readOnly, { exact: true })).toBeVisible();
      expect.soft(await shownNames(s.page)).toHaveLength(s.items.length);
      await ev(s.page, id, slug);
    };
    await test.step('[34L-B-011] engineer alert', async () => {
      const s = sessions.get('engineer') as { page: Page };
      await expect(s.page.getByText(TEXT.readOnly, { exact: true })).toBeVisible();
      await expect(nameButtons(s.page).first()).toBeVisible();
      await ev(s.page, '34L-B-011', 'engineer');
    });
    await test.step('[34L-B-012] viewer alert', () => alertOk('viewer', '34L-B-012', 'viewer'));
    await test.step('[34L-D-002] engineer library readable', () => alertOk('engineer', '34L-D-002', 'engineer_read'));
    await test.step('[34L-D-003] viewer library readable', () => alertOk('viewer', '34L-D-003', 'viewer_read'));
    await test.step('[34L-D-004] anonymous redirected, no library call', async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      contexts.push(context);
      const page = await context.newPage();
      const rec = recordRequests(page);
      await page.goto(ROUTES.adminModels);
      await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fmodels/u);
      await expect(page.getByLabel('Mật khẩu', { exact: true })).toBeVisible();
      expect(rec.list().filter((r) => r.path === '/api/library')).toEqual([]);
      await ev(page, '34L-D-004', 'anonymous');
    });
    await test.step('[34L-G-011] engineer and viewer read 200', async () => {
      expect.soft((sessions.get('engineer') as { status: number }).status).toBe(200);
      expect.soft((sessions.get('viewer') as { status: number }).status).toBe(200);
      await ev((sessions.get('viewer') as { page: Page }).page, '34L-G-011', 'status');
    });
  } finally {
    for (const c of contexts) await c.close();
    await admin.dispose();
  }
});

test('SCR-34 · FL-34L-08 · admin gate and accessible names/landmarks', async ({ page }) => {
  const { items } = await openAdmin(page);
  expect(items.length, 'environment: library has models').toBeGreaterThan(0);
  await test.step('[34L-B-013] no alert and no write control', async () => {
    await expect(page.getByText(TEXT.readOnly, { exact: true })).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
    const names = await page.getByRole('button').evaluateAll((els) => els.map((e) => `${e.textContent ?? ''} ${e.getAttribute('aria-label') ?? ''}`));
    expect(names.filter((n) => /tải lên|upload|xoá|xóa|đổi nhóm|ngừng|delete|deprecate/iu.test(n))).toEqual([]);
    await ev(page, '34L-B-013', 'no_write');
  });
  await test.step('[34L-D-001] admin full screen', async () => {
    await expect.soft(page.getByText(TEXT.readOnly, { exact: true })).toHaveCount(0);
    await expect.soft(page.locator('table')).toBeVisible();
    await expect.soft(searchBox(page)).toBeVisible();
    await ev(page, '34L-D-001', 'full');
  });
  await test.step('[34L-E-001] search accessible name', async () => {
    await expect.soft(page.getByRole('textbox', { name: 'Tìm model', exact: true })).toBeVisible();
    await ev(page, '34L-E-001', 'search');
  });
  await test.step('[34L-E-002] category accessible name', async () => {
    await expect.soft(categoryBox(page)).toBeVisible();
    await ev(page, '34L-E-002', 'category');
  });
  await test.step('[34L-E-009] ⚑ level-1 heading', async () => {
    await expect.soft(page.getByRole('heading', { level: 1 })).not.toHaveCount(0);
    await ev(page, '34L-E-009', 'h1');
  });
  await test.step('[34L-E-010] breadcrumb nav landmark', async () => {
    await expect.soft(page.getByRole('navigation', { name: TEXT.breadcrumb, exact: true })).toBeVisible();
    await ev(page, '34L-E-010', 'breadcrumb');
  });
});
