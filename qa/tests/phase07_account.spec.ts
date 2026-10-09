/**
 * Phase 7: Account settings (E2E-TEST-PLAN.md v2, §4 Phase 7), Track A, SCR-33 `/tai-khoan`.
 *
 * Track A: compose build at `E2E_FULLSTACK_BASE_URL`, admin from CP-1 (`E2E_ADMIN_EMAIL` /
 * `E2E_ADMIN_PASSWORD`). No project state is read or written (runtime-session.json untouched).
 *
 * Contracts verified in source (c4978eb4):
 * - Profile: `GET /api/me` (N11) reads, `PATCH /api/me` (N12) sends ONLY the changed profile keys
 *   (`accountSettingsGateway.ts` `save`), response is the raw `Me` object (`schemas/me.ts`; `jobTitle`
 *   absent when empty). `PUT /api/me/avatar` (N14) only after "Thay ảnh" in the A9 dialog.
 * - Appearance + notifications have no endpoint in v1: kept in module memory; an autosave that only
 *   touches them sends nothing and the save indicator says "Chỉ giữ trong phiên này"
 *   (`useAccountSettings.ts` ACCOUNT_LOCAL_ONLY_LABEL).
 * - Theme: `useTheme` writes `localStorage['app-theme-mode']` and toggles `<html class="dark">`;
 *   the "Chủ đề" radiogroup items carry `data-value` = light | dark | system (`SegmentedControl.tsx`).
 * - R4: the "Chức danh" edit and the theme are reverted inside the same test.
 */
import { expect, test, type BrowserContext, type Locator, type Page, type Request } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { navigateThenWaitForApi, waitForApi } from '../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { signInAdmin } from './support/auth';
import { captureEvidence } from './support/evidence';

test.describe.configure({ mode: 'serial' });

const VIEWPORT = { width: 1440, height: 900 } as const;

const ME_PATH = /^\/api\/me$/u;
const AVATAR_PATH = '/api/me/avatar';
const AUTH_REFRESH_PATH = '/api/auth/refresh';

const JOB_TITLE_SUFFIX = '-e2e';
/** `useTheme.ts` THEME_KEY. */
const THEME_STORAGE_KEY = 'app-theme-mode';
const DARK_CLASS = /(?:^|\s)dark(?:\s|$)/u;
/** `useAccountSettings.ts` ACCOUNT_AUTOSAVE_DEBOUNCE_MS (A7). */
const AUTOSAVE_DEBOUNCE_MS = 800;
/** `useAccountSettings.ts` ACCOUNT_LOCAL_ONLY_LABEL. */
const LOCAL_ONLY_LABEL = 'Chỉ giữ trong phiên này';
/** `AppearanceSection.tsx` THEME_OPTIONS. */
const THEME_LABEL = { light: 'Sáng', dark: 'Tối', system: 'Theo hệ thống' } as const;
type ThemeChoice = keyof typeof THEME_LABEL;
/** `useAccountTables.ts`: cell label `${event.label} — ${channel.label}` (first event, first channel). */
const NOTIFICATION_CELL = 'AI xử lý xong — Trong ứng dụng';
/** 1×1 PNG, in memory (well under AVATAR_MAX_FILE_BYTES). */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/* ---- phase-local helpers ---- */

/** `Me.jobTitle`, `''` when absent (the screen shows `me.jobTitle ?? ''`, `profileDraftOf`). */
function jobTitleOf(json: unknown, what: string): string {
  if (typeof json !== 'object' || json === null) throw new Error(`${what}: expected a Me object, got ${JSON.stringify(json)}`);
  const value = (json as Record<string, unknown>).jobTitle;
  if (value === undefined) return '';
  if (typeof value !== 'string') throw new Error(`${what}: jobTitle is not a string: ${JSON.stringify(value)}`);
  return value;
}

const readStoredTheme = (page: Page): Promise<string | null> =>
  page.evaluate((key) => window.localStorage.getItem(key), THEME_STORAGE_KEY);

const themeGroup = (page: Page): Locator => page.getByRole('radiogroup', { name: 'Chủ đề', exact: true });
const themeRadio = (page: Page, choice: ThemeChoice): Locator =>
  themeGroup(page).getByRole('radio', { name: THEME_LABEL[choice], exact: true });

async function checkedTheme(page: Page): Promise<ThemeChoice> {
  const value = await themeGroup(page).locator('[role="radio"][aria-checked="true"]').getAttribute('data-value');
  if (value !== 'light' && value !== 'dark' && value !== 'system') {
    throw new Error(`"Chủ đề": no checked radio with a known data-value (got ${String(value)})`);
  }
  return value;
}

async function expectHtmlTheme(page: Page, stored: string | null): Promise<void> {
  const html = page.locator('html');
  if (stored === 'dark') await expect(html).toHaveClass(DARK_CLASS);
  else await expect(html).not.toHaveClass(DARK_CLASS);
}

/** Every mutating `/api/` request from now on (session upkeep `POST /api/auth/refresh` excluded). */
function recordWrites(page: Page): { readonly list: () => string[]; readonly stop: () => void } {
  const seen: string[] = [];
  const onRequest = (request: Request): void => {
    const { pathname } = new URL(request.url());
    if (!pathname.startsWith('/api/') || request.method() === 'GET') return;
    if (request.method() === 'POST' && pathname === AUTH_REFRESH_PATH) return;
    seen.push(`${request.method()} ${pathname}`);
  };
  page.on('request', onRequest);
  return { list: () => [...seen], stop: () => page.off('request', onRequest) };
}

/** The page header holding the h1 and the save indicator (`AccountSettings.tsx`, `SaveIndicator` role=status). */
const accountHeader = (page: Page): Locator =>
  page.locator('header').filter({ has: page.getByRole('heading', { level: 1, name: 'Cài đặt tài khoản', exact: true }) });
const saveIndicator = (page: Page): Locator => accountHeader(page).getByRole('status');

/**
 * Logs every text the save indicator shows from now on (pattern of `e2e/v12b/account.spec.ts` AC-1),
 * so a label that was already on screen before the action cannot satisfy the wait.
 */
async function watchSaveIndicator(page: Page): Promise<() => Promise<string[]>> {
  await accountHeader(page).evaluate((node) => {
    const log: string[] = [];
    (window as unknown as { __phase07SaveLog: string[] }).__phase07SaveLog = log;
    new MutationObserver(() => log.push(node.querySelector('[role="status"]')?.textContent ?? '')).observe(node, {
      subtree: true,
      characterData: true,
      childList: true,
    });
  });
  return () => page.evaluate(() => [...(window as unknown as { __phase07SaveLog: string[] }).__phase07SaveLog]);
}

/* -------------------------------------------------------------------------- */
/* SCR-33 Account Settings                                                    */
/* -------------------------------------------------------------------------- */

test.describe('SCR-33 Account Settings (/tai-khoan)', () => {
  let context: BrowserContext;
  let page: Page;
  /** From the `GET /api/me` the screen made on arrival. */
  let originalJobTitle: string;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ baseURL: readBaseUrl(), viewport: VIEWPORT });
    page = await context.newPage();
    const me = waitForApi(page, 'GET', ME_PATH, [200]);
    await signInAdmin(page, ROUTES.account);
    originalJobTitle = jobTitleOf((await me).json, 'GET /api/me');
    await expect(page.getByRole('heading', { level: 1, name: 'Cài đặt tài khoản', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Chức danh', exact: true })).toHaveValue(originalJobTitle);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('SCR-33 row 1+2: "Chức danh" + -e2e → PATCH /me (jobTitle only); "Chủ đề" → Tối; verify; revert both', async () => {
    const jobTitle = page.getByRole('textbox', { name: 'Chức danh', exact: true });

    // Original values, captured before any change.
    await expect(jobTitle).toHaveValue(originalJobTitle);
    await expect.poll(() => readStoredTheme(page)).not.toBeNull();
    const originalStored = await readStoredTheme(page);
    const originalTheme = await checkedTheme(page);
    // ponytail: an admin already on "Tối" would make the switch a no-op, so the flow flips to "Sáng" instead.
    const targetTheme: ThemeChoice = originalTheme === 'dark' ? 'light' : 'dark';
    if (targetTheme !== 'dark') {
      test.info().annotations.push({ type: 'note', description: 'Original theme is already "Tối"; flow switched to "Sáng" and back.' });
    }

    const edited = `${originalJobTitle}${JOB_TITLE_SUFFIX}`;
    /** What the server holds for jobTitle, as last confirmed by a PATCH response. */
    let serverJobTitle = originalJobTitle;
    let flowPassed = false;

    try {
      // (1) "Chức danh" + -e2e → one PATCH /api/me carrying only jobTitle.
      const patch = waitForApi(page, 'PATCH', ME_PATH, [200]);
      await jobTitle.fill(edited);
      const saved = await patch;
      expect(saved.response.request().postDataJSON(), 'PATCH /api/me body').toEqual({ jobTitle: edited });
      serverJobTitle = jobTitleOf(saved.json, 'PATCH /api/me');
      expect(serverJobTitle).toBe(edited);
      await expect(saveIndicator(page)).toHaveText(/^Đã lưu lúc/u);
      await captureEvidence(page, '33_account_autosave.png');

      // (2) "Chủ đề" → target; the autosave of an appearance-only change sends nothing.
      const saveLog = await watchSaveIndicator(page);
      const writes = recordWrites(page);
      try {
        await themeRadio(page, targetTheme).click();

        // (3) theme applied to <html>, persisted to localStorage, kept in memory only.
        await expect(themeRadio(page, targetTheme)).toHaveAttribute('aria-checked', 'true');
        await expect.poll(() => readStoredTheme(page)).toBe(targetTheme);
        await expectHtmlTheme(page, targetTheme);
        await expect.poll(saveLog, { message: 'local-only autosave ran' }).toContain(LOCAL_ONLY_LABEL);
        expect(writes.list(), 'theme change must not hit the network').toEqual([]);
      } finally {
        writes.stop();
      }
      await captureEvidence(page, '33_account_appearance.png');

      // (3) server value and theme persistence survive a reload.
      const reread = await navigateThenWaitForApi(page, () => page.reload({ waitUntil: 'commit' }), 'GET', ME_PATH, [200]);
      expect(jobTitleOf(reread.json, 'GET /api/me after reload')).toBe(edited);
      await expect(jobTitle).toHaveValue(edited);
      await expect.poll(() => readStoredTheme(page)).toBe(targetTheme);
      await expectHtmlTheme(page, targetTheme);
      await expect(themeRadio(page, targetTheme)).toHaveAttribute('aria-checked', 'true');

      flowPassed = true;
    } finally {
      try {
        // (4) revert the theme to the original choice.
        if ((await checkedTheme(page)) !== originalTheme) await themeRadio(page, originalTheme).click();

        // (4) revert jobTitle: a PATCH only when the server holds the edit.
        if (serverJobTitle !== originalJobTitle) {
          const revert = waitForApi(page, 'PATCH', ME_PATH, [200]);
          await jobTitle.fill(originalJobTitle);
          const reverted = await revert;
          expect(reverted.response.request().postDataJSON(), 'revert PATCH /api/me body').toEqual({ jobTitle: originalJobTitle });
          serverJobTitle = jobTitleOf(reverted.json, 'revert PATCH /api/me');
        } else if ((await jobTitle.inputValue()) !== originalJobTitle) {
          await jobTitle.fill(originalJobTitle); // draft equals the saved value: no PATCH
        }

        // (5) original state restored.
        expect(serverJobTitle).toBe(originalJobTitle);
        await expect(jobTitle).toHaveValue(originalJobTitle);
        await expect(themeRadio(page, originalTheme)).toHaveAttribute('aria-checked', 'true');
        await expect.poll(() => readStoredTheme(page)).toBe(originalStored);
        await expectHtmlTheme(page, originalStored);
      } catch (error) {
        if (flowPassed) throw error;
        // Keep the flow's own failure as the reported one; flag the account as possibly not reverted.
        test.info().annotations.push({ type: 'revert-failed', description: String(error) });
        console.error(`[phase07] revert after a failed flow also failed: ${String(error)}`);
      }
    }
  });

  test('SCR-33 row 2: "Giảm chuyển động" + one notification checkbox → memory only, no network', async () => {
    const motion = page.getByRole('switch', { name: 'Giảm chuyển động', exact: true });
    const cell = page.getByRole('checkbox', { name: NOTIFICATION_CELL, exact: true });
    // The input is `sr-only` inside its `<label htmlFor>`; the visible box is the label.
    const cellBox = cell.locator('xpath=ancestor::label[1]');

    const motionWas = (await motion.getAttribute('aria-checked')) === 'true';
    const cellWas = await cell.isChecked();
    const saveLog = await watchSaveIndicator(page);
    const writes = recordWrites(page);

    try {
      await motion.click();
      await expect(motion).toHaveAttribute('aria-checked', String(!motionWas));
      if (!motionWas) await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');

      await cellBox.click();
      await expect(cell).toBeChecked({ checked: !cellWas });

      // The autosave ran (local-only label) and sent nothing.
      await expect.poll(saveLog, { message: 'local-only autosave ran' }).toContain(LOCAL_ONLY_LABEL);
      expect(writes.list(), 'appearance/notification toggles must not hit the network').toEqual([]);
    } finally {
      if ((await motion.getAttribute('aria-checked')) !== String(motionWas)) await motion.click();
      if ((await cell.isChecked()) !== cellWas) await cellBox.click();
      await expect(motion).toHaveAttribute('aria-checked', String(motionWas));
      await expect(cell).toBeChecked({ checked: cellWas });
      // G5: no network signal exists for a local-only autosave; let the 800 ms debounce fire.
      await page.waitForTimeout(AUTOSAVE_DEBOUNCE_MS * 2);
      writes.stop();
      expect(writes.list(), 'revert of the toggles must not hit the network').toEqual([]);
    }
  });

  test('SCR-33 row 3: "Tìm phím tắt" = "Ctrl" → table filters', async () => {
    const region = page.getByRole('region', { name: 'Phím tắt', exact: true });
    const search = region.getByRole('searchbox', { name: 'Tìm phím tắt', exact: true });
    const count = region.getByRole('status');

    await expect(count).toHaveText(/^\d+ phím tắt đang có hiệu lực\.$/u);
    const total = Number(/^\d+/u.exec((await count.textContent()) ?? '')?.[0]);

    await search.fill('Ctrl');
    await expect(count).toHaveText(new RegExp(`^Đang hiện \\d+ trong ${String(total)} phím tắt\\.$`, 'u'));
    const shown = Number(/^Đang hiện (\d+)/u.exec((await count.textContent()) ?? '')?.[1]);
    expect(shown).toBeLessThan(total);

    if (shown === 0) {
      // Source: combos render as "Mod+…" (`formatCombo`) and no description contains "Ctrl".
      await expect(region.getByText('Không có phím tắt nào khớp với ô tìm.', { exact: true })).toBeVisible();
      test.info().annotations.push({ type: 'finding', description: '"Ctrl" matches 0 shortcuts: keys are shown as "Mod".' });
    } else {
      await expect(region.locator('tbody tr')).toHaveCount(shown);
    }
    await captureEvidence(page, '33_account_shortcuts.png');
  });

  test('SCR-33 row 4: "Đổi ảnh" ← png, then "Huỷ" → dialog closes, no PUT /me/avatar', async () => {
    const avatarPuts: string[] = [];
    const onRequest = (request: Request): void => {
      if (request.method() === 'PUT' && new URL(request.url()).pathname === AVATAR_PATH) avatarPuts.push(request.url());
    };
    page.on('request', onRequest);

    try {
      await page.getByLabel('Đổi ảnh', { exact: true }).setInputFiles({
        name: 'e2e-avatar.png',
        mimeType: 'image/png',
        buffer: TINY_PNG,
      });

      const dialog = page.getByRole('dialog', { name: /^(?:Đặt|Thay) ảnh đại diện\?$/u });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Huỷ', exact: true }).click();

      await expect(dialog).toBeHidden();
      expect(avatarPuts, 'cancel must not send PUT /api/me/avatar').toEqual([]);
      await captureEvidence(page, '33_account_avatar_cancel.png');
    } finally {
      page.off('request', onRequest);
    }
  });

  test('SCR-33 row 5: "Phiên đăng nhập" / "Vùng nguy hiểm" not rendered', async () => {
    // Anchor: the page is past its loading state once the password block is drawn.
    await expect(page.getByRole('region', { name: 'Mật khẩu', exact: true })).toBeVisible();

    for (const title of ['Phiên đăng nhập', 'Vùng nguy hiểm']) {
      await expect(page.getByRole('region', { name: title, exact: true })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: title, exact: true })).toHaveCount(0);
    }
    await expect(page.getByRole('button', { name: 'Xoá tài khoản', exact: true })).toHaveCount(0);
    await captureEvidence(page, '33_account_hidden_sections.png', { fullPage: true });
  });
});
