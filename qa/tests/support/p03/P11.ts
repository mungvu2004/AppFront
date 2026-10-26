/**
 * QA-03d agent P11 helpers (X cross-screen journeys). Used by `phase03_journeys_edge.spec.ts` only; seeds live in
 * `../phase03Seed.ts`.
 *
 * - `openPoolPage`: own browser context signed in as a pool user (one `POST /api/auth/login`), API log + SSE watch.
 * - `spaGo`: client-side route change (history.pushState + popstate, what react-router 6.25 listens to) — no document
 *   load, so the app shell and its query cache stay; `markShell` / `shellKept` prove no reload happened.
 * - `uploadViaTray`: the real SCR-10 path (file → tray → "Gán cho tầng khác" = floor → #5 init / #6 / #7 complete).
 * - `screenState`: one comparable string per phase-3 screen, read once the screen has painted its server state.
 */
import { expect, type APIRequestContext, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { waitForApi, watchApi, watchSse, type ApiEntry, type SseWatch } from '../../../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../../../e2e/fullstack/env';
import { signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import { signInPoolUser, type PoolUser } from '../phase03Seed';

export const DESKTOP = { width: 1440, height: 900 } as const;

export interface OpenPage {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly api: ApiEntry[];
  readonly sse: SseWatch;
}

/** One real admin API login (`signedInApi`); caller disposes it. Only used to fill / read the user pool. */
export function adminApi(): Promise<APIRequestContext> {
  const { email, password } = readAdminCredentials();
  return signedInApi(email, password);
}

/** Pool user's own API client (one login); caller disposes it. */
export function poolApi(user: PoolUser): Promise<APIRequestContext> {
  return signedInApi(user.email, user.password);
}

export async function openPoolPage(browser: Browser, user: PoolUser, options: { readonly clipboard?: boolean } = {}): Promise<OpenPage> {
  const context = await browser.newContext({
    baseURL: readBaseUrl(),
    viewport: DESKTOP,
    ...(options.clipboard === true ? { permissions: ['clipboard-read', 'clipboard-write'] } : {}),
  });
  try {
    await signInPoolUser(context, user);
    const page = await context.newPage();
    const api = watchApi(page);
    const sse = await watchSse(page);
    return { context, page, api, sse };
  } catch (error) {
    await context.close();
    throw error;
  }
}

export async function closePage(open: OpenPage | undefined): Promise<void> {
  if (open === undefined) return;
  await open.context.close().catch(() => undefined);
}

export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
export const pathOf = (page: Page): string => new URL(page.url()).pathname;

/** Writes since `mark`, minus the session / telemetry chatter that is no screen's own action. */
export const writesSince = (log: readonly ApiEntry[], mark: number): string[] =>
  log
    .slice(mark)
    .filter((entry) => entry.method !== 'GET' && entry.path !== '/api/auth/refresh' && !entry.path.startsWith('/api/telemetry'))
    .map((entry) => `${entry.method} ${entry.path} ${String(entry.status)}`);

/* ---- client-side navigation ------------------------------------------------------------------- */

const SHELL_KEY = '__qaP11Shell';

/** Tags the current document; a full load (reload / page.goto) drops the tag. */
export async function markShell(page: Page): Promise<void> {
  await page.evaluate((key) => {
    (window as unknown as Record<string, unknown>)[key] = 'kept';
  }, SHELL_KEY);
}

export const shellKept = (page: Page): Promise<boolean> =>
  page.evaluate((key) => (window as unknown as Record<string, unknown>)[key] === 'kept', SHELL_KEY);

/** Route change inside the running app (react-router `createBrowserRouter` handles popstate as a POP navigation). */
export async function spaGo(page: Page, path: string): Promise<void> {
  await page.evaluate((to) => {
    const state = window.history.state as { idx?: number } | null;
    window.history.pushState({ usr: null, key: `qa${String(Date.now())}`, idx: (state?.idx ?? 0) + 1 }, '', to);
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state as unknown }));
  }, path);
  await expect.poll(() => pathOf(page)).toBe(path);
}

/* ---- SCR-09 floor table (FloorTableRow.tsx `<tr aria-label="{name}, cao độ …">`) ---------------- */

export const floorRows = (page: Page): Locator => page.getByRole('row', { name: /, cao độ /u });
export const floorRow = (page: Page, name: string): Locator =>
  page.getByRole('row', { name: new RegExp(`^${escapeRegExp(name)}, cao độ `, 'u') });

export async function floorRowLabels(page: Page): Promise<string[]> {
  return floorRows(page).evaluateAll((rows) => rows.map((row) => row.getAttribute('aria-label') ?? ''));
}

export async function floorRowNames(page: Page): Promise<string[]> {
  return (await floorRowLabels(page)).map((label) => label.replace(/, cao độ .*$/su, ''));
}

/* ---- SCR-10 upload (FloorUploadDropZone / FloorUploadTray / FloorUploadCard) ------------------- */

export const FILE_INPUT = 'floor-upload-file-input'; // FUD:33
export const COUNTER = 'floor-upload-counter-number'; // FUF:25
export const card = (page: Page, floorId: string): Locator => page.locator(`[data-floor-id="${floorId}"]`);
const tray = (page: Page): Locator => page.getByRole('region', { name: 'Tệp chưa gán tầng', exact: true }); // FUT:35

/** Floor ids of the SCR-10 cards in DOM order (each card carries `data-floor-id`, FUC:203). */
export async function cardOrder(page: Page): Promise<string[]> {
  const ids = await page.locator('[data-floor-id]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-floor-id') ?? ''));
  return ids.filter((id, index) => id !== '' && ids.indexOf(id) === index);
}

export type UploadFile = string | { readonly name: string; readonly mimeType: string; readonly buffer: Buffer };

/** Tray upload of `file` to `floor`; resolves with the #5 upload id once #7 answered 200 and the card says "Đã có bản vẽ". */
export async function uploadViaTray(
  page: Page,
  projectId: string,
  floor: { readonly id: string; readonly name: string },
  file: UploadFile,
): Promise<string> {
  const init = waitForApi(page, 'POST', new RegExp(`^/api/projects/${escapeRegExp(projectId)}/floors/${escapeRegExp(floor.id)}/drawings/uploads$`, 'u'), [200]);
  const complete = waitForApi(page, 'POST', new RegExp(`^/api/projects/${escapeRegExp(projectId)}/drawings/uploads/[^/]+/complete$`, 'u'), [200]);
  await page.getByTestId(FILE_INPUT).setInputFiles(typeof file === 'string' ? file : { ...file });
  await tray(page).getByRole('combobox', { name: 'Gán cho tầng khác' }).click(); // FUT:20
  await page.getByRole('option', { name: floor.name, exact: true }).click();
  const { json } = await init;
  await complete;
  await expect(card(page, floor.id).getByText('Đã có bản vẽ', { exact: true })).toBeVisible(); // UFU:123
  const id = (json as Record<string, unknown> | null)?.id;
  if (typeof id !== 'string') throw new Error('upload init (#5) answered without an id');
  return id;
}

/* ---- SCR-12 chips (ProcessingFloorChips.tsx `<ul aria-label="Tiến độ theo tầng">`) ------------- */

export const chips = (page: Page): Locator => page.getByRole('list', { name: 'Tiến độ theo tầng', exact: true }).getByRole('listitem');
export const chipTexts = async (page: Page): Promise<string[]> => (await chips(page).allInnerTexts()).map((text) => text.replace(/\s+/gu, ' ').trim());

/* ---- per-screen state ------------------------------------------------------------------------- */

export type ScreenKind = 'settings' | 'floors' | 'upload' | 'quality' | 'pipeline' | 'graph';

/** Upload ids whose progress the page read, through the SSE stream or the #8 progress GET. */
export function progressSeen(open: OpenPage, uploadId: string): { readonly sse: number; readonly read: number } {
  const sse = open.sse.messages.filter((message) => message.url.includes(`/uploads/${uploadId}/progress`)).length;
  const read = open.api.filter((entry) => entry.method === 'GET' && entry.path.endsWith(`/drawings/uploads/${uploadId}/progress`)).length;
  return { sse, read };
}

/** Reads `read` until two reads 1.5 s apart agree (reads land one by one: #24, floors, N7, #8 per floor), max ~15 s. */
async function settled(page: Page, read: () => Promise<string>): Promise<string> {
  let last = await read();
  for (let i = 0; i < 10; i += 1) {
    await page.waitForTimeout(1_500);
    const next = await read();
    if (next === last) return next;
    last = next;
  }
  return last;
}

const flat = (texts: readonly string[]): string => texts.map((t) => t.replace(/\s+/gu, ' ').trim()).join(' | ');

/**
 * What the screen shows from the server, once painted and settled: a heading / field / list read that a reload or a
 * history step must give back unchanged. Hard-waits for the screen's own landmark first.
 */
export async function screenState(page: Page, kind: ScreenKind): Promise<string> {
  switch (kind) {
    case 'settings': {
      const name = page.getByRole('textbox', { name: 'Tên dự án', exact: true }); // GT:40
      await expect(name).not.toHaveValue('');
      return settled(page, async () => `settings name=${await name.inputValue()}`);
    }
    case 'floors': {
      await expect(floorRows(page).first().or(page.getByText('Chưa có tầng nào', { exact: true }))).toBeVisible();
      return settled(page, async () => `floors ${(await floorRowNames(page)).join(' | ')}`);
    }
    case 'upload': {
      const counter = page.getByTestId(COUNTER);
      await expect(page.locator('[data-floor-id]').first().or(page.getByText('Dự án chưa có tầng nào', { exact: true }))).toBeVisible(); // FU:76
      return settled(page, async () => `upload ${await counter.innerText()}`);
    }
    case 'quality': {
      const report = page.getByRole('region', { name: 'Báo cáo chất lượng', exact: true }); // IQR:281
      await expect(report.getByRole('row').nth(1)).toBeVisible();
      return settled(page, async () => `quality ${flat(await report.getByRole('row').allInnerTexts())}`);
    }
    case 'pipeline': {
      const done = page.getByText(/^Đã xử lý xong \d+\/\d+ tầng/u); // UPR:172-178
      await expect(done.first()).toBeVisible();
      return settled(page, async () => `pipeline ${await done.first().innerText()} chips=${flat(await chipTexts(page))}`);
    }
    case 'graph': {
      const h1 = page.getByRole('heading', { level: 1, name: 'Bản vẽ được xử lý theo đường nào', exact: true }); // S-12
      await expect(h1).toBeVisible();
      const empty = page.getByText('Chưa có lượt xử lý nào để kể lại', { exact: true }); // PGT:208
      return settled(page, async () => `graph h1 empty=${String(await empty.isVisible())}`);
    }
  }
}
