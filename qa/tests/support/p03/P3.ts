/**
 * QA-03d agent P3 helpers for `phase03_floors_edge.spec.ts` (SCR-09 real flows). Not shared: only P3's file imports it.
 *
 * - `withFloorsAdmin`: own browser context with its own admin login (1 per flow, parallel-safe) + a Bearer API context
 *   for seeds (`phase03Seed.ts` takes an `APIRequestContext`).
 *   Every project id pushed to `cleanup` is deleted in `finally`.
 * - `watchWrites`: every `/api/` response of a page with its REQUEST body (FE bodies are asserted, not only statuses).
 * - Floor API "elsewhere" writes (#10 POST, #11 DELETE, #34 PATCH) and stacks with free elevations (#25 `floors`).
 */
import { randomUUID } from 'node:crypto';

import { expect, type APIRequestContext, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { readBaseUrl } from '../../../../e2e/fullstack/env';
import { newApiContext } from '../api';
import { readAdminCredentials } from '../auth';
import { TEST_DATA_PREFIX } from '../evidence';
import { deleteSeededProject } from '../phase03Seed';

type Json = Record<string, unknown>;

export const DESKTOP = { width: 1440, height: 900 } as const;
export const PHONE = { width: 375, height: 812 } as const;

const REFRESH_API = '/api/auth/refresh';

/* ---- request log -------------------------------------------------------------------------------- */

export interface Write {
  readonly method: string;
  readonly path: string;
  readonly status: number;
  /** Request JSON body (`null` when none / not JSON). */
  readonly body: Json | null;
  /** Response JSON body, filled when read (`undefined` until then, and for a body that is not JSON). */
  json?: unknown;
  /** Settles once the response body was read (or found unreadable). */
  ready: Promise<void>;
}

/** Every `/api/` response of `page` (refresh + telemetry left out), in arrival order, with the request body. */
export function watchWrites(page: Page): Write[] {
  const log: Write[] = [];
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (!url.pathname.startsWith('/api/') || url.pathname === REFRESH_API || url.pathname.startsWith('/api/telemetry')) return;
    let body: Json | null = null;
    try {
      const parsed: unknown = response.request().postDataJSON();
      body = typeof parsed === 'object' && parsed !== null ? (parsed as Json) : null;
    } catch {
      body = null;
    }
    const entry: Write = { method: response.request().method(), path: url.pathname, status: response.status(), body, ready: Promise.resolve() };
    entry.ready = response
      .json()
      .then((json: unknown) => {
        entry.json = json;
      })
      .catch(() => undefined);
    log.push(entry);
  });
  // Diagnostics: a request that never got a response, and console errors, land in the same log (method FAILED / CONSOLE).
  page.on('requestfailed', (request) => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) return;
    log.push({ method: 'FAILED', path: `${request.method()} ${url.pathname} ${request.failure()?.errorText ?? ''}`, status: 0, body: null, ready: Promise.resolve() });
  });
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    log.push({ method: 'CONSOLE', path: message.text().slice(0, 300), status: 0, body: null, ready: Promise.resolve() });
  });
  return log;
}

/** Non-GET calls since `mark` as `"METHOD path status"` lines (evidence JSON). */
export const writesSince = (log: readonly Write[], mark: number): string[] =>
  log
    .slice(mark)
    .filter((entry) => entry.method !== 'GET' && entry.method !== 'CONSOLE')
    .map((entry) => `${entry.method} ${entry.path} ${String(entry.status)}`);

/** Calls since `mark` matching `method` + `path`. */
export const callsSince = (log: readonly Write[], mark: number, method: string, path: RegExp): Write[] =>
  log.slice(mark).filter((entry) => entry.method === method && path.test(entry.path));

/**
 * Waits for the `nth` (1-based) call matching `method` + `path` since `mark`, its body read; returns it.
 * `timeout` default 30 s (API_TIMEOUT_MS of the F-14 harness).
 */
export async function nthCall(log: readonly Write[], mark: number, method: string, path: RegExp, nth = 1, timeout = 30_000): Promise<Write> {
  await expect
    .poll(() => callsSince(log, mark, method, path).length, { message: `${method} ${path.source} #${String(nth)}`, timeout })
    .toBeGreaterThanOrEqual(nth);
  const call = callsSince(log, mark, method, path)[nth - 1];
  if (call === undefined) throw new Error(`${method} ${path.source} #${String(nth)} missing`);
  await call.ready;
  return call;
}

/** Non-GET floor writes since `mark` (POST/PATCH/DELETE on floors, reorder, spatial). */
export const floorWritesSince = (log: readonly Write[], mark: number): Write[] =>
  log.slice(mark).filter((entry) => ['POST', 'PATCH', 'PUT', 'DELETE'].includes(entry.method) && /\/floors(\/|$)/u.test(entry.path));

/* ---- admin session ------------------------------------------------------------------------------ */

export interface FloorsAdmin {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly log: Write[];
  /** Bearer API context (seeds, "elsewhere" writes). */
  readonly api: APIRequestContext;
  /** Project ids deleted when the session closes. */
  readonly cleanup: string[];
}

function accessTokenOf(json: unknown): string {
  const body = (typeof json === 'object' && json !== null ? json : {}) as Json;
  const root = (typeof body.data === 'object' && body.data !== null ? body.data : body) as Json;
  const token = typeof root.accessToken === 'string' ? root.accessToken : typeof root.access_token === 'string' ? root.access_token : '';
  if (token === '') throw new Error('POST /api/auth/refresh: no access token');
  return token;
}

/**
 * Runs `body` with an admin context at `viewport`; closes it and deletes `cleanup` projects.
 * Parallel-safe (files run with `--workers 4`): the context signs in with its OWN `POST /api/auth/login` (1 login per
 * flow) instead of sharing the rotating refresh cookie of `ADMIN_STORAGE_STATE_FILE`, and writes no shared file.
 */
export async function withFloorsAdmin(
  browser: Browser,
  body: (admin: FloorsAdmin) => Promise<void>,
  viewport: { readonly width: number; readonly height: number } = DESKTOP,
): Promise<void> {
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport });
  let api: APIRequestContext | null = null;
  const cleanup: string[] = [];
  try {
    const { email, password } = readAdminCredentials();
    const login = await context.request.post('/api/auth/login', {
      data: { email, password, rememberMe: false },
      headers: { Origin: readBaseUrl() },
    });
    expect(login.status(), 'setup: POST /api/auth/login (admin, own session)').toBe(204);
    const refreshed = await context.request.post(REFRESH_API, { headers: { Origin: readBaseUrl() } });
    expect(refreshed.status(), 'setup: POST /api/auth/refresh (fixture token)').toBe(200);
    api = await newApiContext({ Authorization: `Bearer ${accessTokenOf(await refreshed.json())}` });
    const page = await context.newPage();
    await body({ context, page, log: watchWrites(page), api, cleanup });
  } finally {
    if (api !== null) {
      for (const id of cleanup) await deleteSeededProject(api, id);
      await api.dispose().catch(() => undefined);
    }
    await context.close().catch(() => undefined);
  }
}

/* ---- floors through the real API ---------------------------------------------------------------- */

export interface FloorDraft {
  readonly name: string;
  readonly elevationMm: number;
  readonly heightMm: number;
}

export interface FloorFull extends FloorDraft {
  readonly id: string;
  readonly order: number;
}

/** W4 level id `L-<base36 UPPER>` (BE packages/core/ids.py), as the API spec's `newLevelId`. */
export const newLevelId = (): string => `L-${randomUUID().replace(/-/gu, '').toUpperCase().slice(0, 24)}`;

/** Own project `qa-<runId>-<slug>-<uniq>` whose floors are `drafts` (order = index), pushed to `cleanup`. */
export async function createStack(admin: FloorsAdmin, slug: string, drafts: readonly FloorDraft[]): Promise<{ id: string; floors: FloorFull[] }> {
  const name = `${TEST_DATA_PREFIX}${slug}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const res = await admin.api.post('/api/projects', {
    data: { name, ...(drafts.length > 0 ? { floors: drafts.map((floor, order) => ({ ...floor, order })) } : {}) },
  });
  expect(res.status(), `setup: POST /api/projects "${name}": ${(await res.text()).slice(0, 300)}`).toBe(201);
  const id = String(((await res.json()) as Json).id);
  admin.cleanup.push(id);
  return { id, floors: await readFloors(admin.api, id) };
}

/** `GET /api/projects/:id/floors` (the screen's own list read), sorted by `order`. */
export async function readFloors(api: APIRequestContext, projectId: string): Promise<FloorFull[]> {
  const res = await api.get(`/api/projects/${projectId}/floors`);
  expect(res.status(), `GET /api/projects/${projectId}/floors`).toBe(200);
  const raw = (await res.json()) as unknown;
  const rows = (Array.isArray(raw) ? raw : Array.isArray((raw as Json).data) ? ((raw as Json).data as unknown[]) : []) as Json[];
  return rows
    .map((row) => ({
      id: String(row.id),
      name: String(row.name),
      order: Number(row.order),
      elevationMm: Number(row.elevationMm),
      heightMm: Number(row.heightMm),
    }))
    .sort((a, b) => a.order - b.order);
}

/** #10 `POST /api/projects/:id/floors` from "elsewhere"; returns the response (status asserted by the caller). */
export async function apiAddFloor(
  api: APIRequestContext,
  projectId: string,
  floor: FloorDraft & { readonly order: number; readonly id?: string },
): Promise<{ status: number; id: string }> {
  const id = floor.id ?? newLevelId();
  const res = await api.post(`/api/projects/${projectId}/floors`, { data: { ...floor, id } });
  return { status: res.status(), id };
}

/** #11 `DELETE /api/floors/:id` from "elsewhere". */
export async function apiDeleteFloor(api: APIRequestContext, floorId: string): Promise<number> {
  return (await api.delete(`/api/floors/${floorId}`)).status();
}

/** #34 `PATCH /api/projects/:id/floors/:fid/spatial` from "elsewhere". */
export async function apiPatchFloor(api: APIRequestContext, projectId: string, floorId: string, body: Partial<FloorDraft>): Promise<number> {
  return (await api.patch(`/api/projects/${projectId}/floors/${floorId}/spatial`, { data: body })).status();
}

/* ---- page helpers ------------------------------------------------------------------------------- */

/**
 * Every text the app announcer regions (`[data-announcer]`, src/lib/input/announcer.ts:52-57) are given, in order,
 * repeats included (a repeat is written with a trailing NBSP so it changes). Install before `goto`.
 */
export async function recordAllAnnouncements(page: Page): Promise<() => Promise<{ urgency: string; text: string }[]>> {
  await page.addInitScript(() => {
    const seen: { urgency: string; text: string }[] = [];
    const last = new WeakMap<Node, string>();
    (window as unknown as { __qaP3Announced: typeof seen }).__qaP3Announced = seen;
    new MutationObserver(() => {
      for (const node of document.querySelectorAll<HTMLElement>('[data-announcer]')) {
        const raw = node.textContent ?? '';
        if (raw === '' || last.get(node) === raw) continue;
        last.set(node, raw);
        seen.push({ urgency: node.dataset.announcer ?? '', text: raw.trim() });
      }
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
  return () =>
    page.evaluate(() => (window as unknown as { __qaP3Announced?: { urgency: string; text: string }[] }).__qaP3Announced ?? []);
}

/**
 * Clicks "Hoàn tác" of the toast reading `text`. Older toasts are 4 px "peeks" under the newest (Toast.tsx:107-128),
 * so a pointer click would land on the newest one; the button's own click event is dispatched instead.
 */
export async function undoFromToast(page: Page, text: string): Promise<void> {
  const button = page
    .getByRole('status')
    .filter({ hasText: text })
    .first()
    .getByRole('button', { name: 'Hoàn tác', exact: true });
  await button.dispatchEvent('click');
}

/** Class list of `locator` (soft checks on state classes such as `bg-bg-selected`). */
export const classOf = (locator: Locator): Promise<string> => locator.evaluate((element) => element.className);
