/**
 * Phase 10 P3 helpers (SCR-41 global shortcut help): shared by `phase10_shortcuts_b_edge.spec.ts` and
 * `phase10_shortcuts_ui.spec.ts`. Real stack only; nothing here writes to the project.
 *
 * Keyboard source: the shell registers ONE `window` keydown listener (src/lib/input/shortcutRegistry.ts:611,
 * src/hooks/useShortcut.ts:52); a listener added later on `window` runs after it (bubble, same target), so its
 * `defaultPrevented` is the shell's verdict.
 */
import { expect, type Locator, type Page } from '@playwright/test';

export const HELP_TITLE = 'Phím tắt'; // GlobalShortcutHelp.tsx:176 (h2)
export const HELP_CLOSE_LABEL = 'Đóng bảng phím tắt'; // GlobalShortcutHelp.tsx:182

export const helpDialog = (page: Page): Locator => page.getByRole('dialog', { name: HELP_TITLE, exact: true });

/** One painted frame, twice: a synchronous key handler has run and React has re-rendered by then. */
export async function nextFrame(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
}

/**
 * Focus a non-input element so a following `?` is not typed into a field. A heading gets `tabindex=-1` (script-only
 * focus, like a skip-link target): no focusable element is common to every screen here, and the registry only
 * looks at the event target's tag (SR:409), not its tabindex.
 */
export async function focusAnchor(target: Locator): Promise<void> {
  await target.evaluate((el) => {
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    (el as HTMLElement).focus();
  });
}

// dup-of: recordApiRequests (phase01_auth_edge.spec.ts:276), kept here so this pack owns its copy.
export function recordApi(page: Page): { readonly sent: string[]; readonly stop: () => void } {
  const sent: string[] = [];
  const onRequest = (request: { url(): string; method(): string }): void => {
    const { pathname } = new URL(request.url());

    if (pathname.startsWith('/api/')) sent.push(`${request.method()} ${pathname}`);
  };

  page.on('request', onRequest);
  return { sent, stop: () => page.off('request', onRequest) };
}

/** Requests that change server state, minus the session refresh the app does by itself. */
export const writesOf = (sent: readonly string[]): string[] =>
  sent.filter((line) => !/^(GET|HEAD|OPTIONS) /u.test(line) && line !== 'POST /api/auth/refresh');

/** Uncaught page errors and `console.error` lines, from now on. */
export function recordPageErrors(page: Page): { readonly errors: string[]; readonly stop: () => void } {
  const errors: string[] = [];
  const onError = (error: Error): void => void errors.push(`pageerror: ${error.message}`);
  const onConsole = (message: { type(): string; text(): string }): void => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  };

  page.on('pageerror', onError);
  page.on('console', onConsole);
  return {
    errors,
    stop: () => {
      page.off('pageerror', onError);
      page.off('console', onConsole);
    },
  };
}

interface KeyLogWindow {
  __p10Keys?: { key: string; defaultPrevented: boolean }[];
}

/** Log every keydown's `defaultPrevented` after the shell listener ran. Call once the page has loaded. */
export async function trackKeys(page: Page): Promise<{ readonly verdict: (key: string) => Promise<boolean | undefined> }> {
  await page.evaluate(() => {
    const w = window as unknown as KeyLogWindow;

    w.__p10Keys = [];
    window.addEventListener('keydown', (event) => {
      w.__p10Keys?.push({ key: event.key.toLowerCase(), defaultPrevented: event.defaultPrevented });
    });
  });
  return {
    verdict: (key) =>
      page.evaluate(
        (wanted) => (window as unknown as KeyLogWindow).__p10Keys?.filter((entry) => entry.key === wanted).at(-1)?.defaultPrevented,
        key.toLowerCase(),
      ),
  };
}

/** `<kbd>` caps of the help row whose `<dt>` reads `description` (rows are `div > dt + dd`, GlobalShortcutHelp.tsx:206-228). */
export const rowCaps = (dialog: Locator, description: string): Locator =>
  dialog.locator('dt').filter({ hasText: new RegExp(`^${description}$`, 'u') }).locator('xpath=..').locator('kbd');

/**
 * True when the dialog stays present and fully opaque for ~45 frames (a toggle-closed help would start its
 * exit fade within that window). Waits for the enter animation first. Frames, not a fixed wait.
 */
export async function stayedOpen(page: Page): Promise<boolean> {
  await expect(helpDialog(page)).toHaveCSS('opacity', '1');
  return page.evaluate(
    () =>
      new Promise<boolean>((done) => {
        let frames = 0;
        const tick = (): void => {
          const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');

          if (dialog === null || getComputedStyle(dialog).opacity !== '1') return done(false);
          frames += 1;
          if (frames >= 45) return done(true);
          requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
      }),
  );
}
