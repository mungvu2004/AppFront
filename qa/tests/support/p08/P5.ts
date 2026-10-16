/**
 * QA-08 P5 helpers: mocked `/api/admin/ml/**` for SCR-35 (Training Jobs), FL-35T-05..08.
 * // dup-of: phase08Training.ts mockTrainingApi, jobFixture, jobsPage, datasetFixture, versionFixture, wireError (P6 writes a parallel copy; S4 merges)
 *
 * Wire shapes copied from src/api/schemas/adminMl.ts (TrainingJobSchema :370, DatasetSchema :261, DatasetVersionSchema :300, strict objects)
 * and src/api/endpoints.ts:65-78 (paths). Error bodies are read by `readWireError` (src/lib/errors/wireError.ts) from `code`, `field`, `resource`.
 *
 * `mockTrainingApi(page)` answers every `/api/admin/ml/**` request from `mock.on.*` (re-assign mid-flow), records all calls, and
 * ABORTS (and records in `mock.stray`) any POST/PUT/DELETE and any path it does not know: no real write can leave the page.
 * GET 5xx/429 are retried by the HTTP client (src/lib/http/retry.ts, 3 retries); `Retry-After: 0` makes the retries immediate.
 */
import { readBaseUrl } from '../../../../e2e/fullstack/env';
import { expect } from '@playwright/test';
import type { Browser, BrowserContext, Page, Route } from '@playwright/test';

import { readAdminCredentials } from '../auth';

/* ---------------------------------------------------------------- session */

/** One admin session (1 `POST /api/auth/login`) in a fresh 1440x900 context. Caller closes the context in `finally`. */
export async function adminSession(browser: Browser): Promise<{ readonly context: BrowserContext; readonly page: Page }> {
  const { email, password } = readAdminCredentials();
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport: { width: 1440, height: 900 } });
  try {
    const res = await context.request.post('/api/auth/login', {
      data: { email, password, rememberMe: false },
      headers: { Origin: readBaseUrl() },
    });
    expect(res.status(), 'setup: POST /api/auth/login (P5 flow session)').toBe(204);
    return { context, page: await context.newPage() };
  } catch (error) {
    await context.close();
    throw error;
  }
}

/* ---------------------------------------------------------------- ids and fixtures */

const CROCKFORD_PAD = '0';
/** `<prefix>_` + 26 Crockford chars; `tail` (Crockford only) is right-aligned, e.g. fakeId('dsv', 'ABCDEF123456') ends in 123456. */
export const fakeId = (prefix: 'job' | 'dsv' | 'dst' | 'mdl' | 'usr', tail: string): string =>
  `${prefix}_${tail.padStart(26, CROCKFORD_PAD)}`;

export const iso = (offsetMs = 0): string => new Date(Date.parse('2026-10-01T08:00:00.000Z') + offsetMs).toISOString();

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelling' | 'cancelled';
export type Family = 'wallSegmentation' | 'openingAndFurnitureDetection';

export interface JobOpts {
  readonly tail?: string;
  readonly status?: JobStatus;
  readonly family?: Family;
  readonly baseModel?: string;
  readonly epochs?: number;
  readonly currentEpoch?: number;
  readonly failureCode?: string;
  readonly datasetVersionId?: string;
  readonly resultModelVersionId?: string;
}

/** Body valid for TrainingJobSchema (adminMl.ts:370-430 refinements: ended iff succeeded|failed|cancelled, result iff succeeded, failureCode iff failed). */
export function jobFixture(o: JobOpts = {}): Record<string, unknown> {
  const status = o.status ?? 'queued';
  const family = o.family ?? 'wallSegmentation';
  const ended = status === 'succeeded' || status === 'failed' || status === 'cancelled';
  const started = status === 'running' || status === 'succeeded' || status === 'cancelling';
  return {
    baseModel: o.baseModel ?? (family === 'wallSegmentation' ? 'mitB0' : 'yolov8n'),
    createdAt: iso(0),
    creatorId: fakeId('usr', '1'),
    ...(o.currentEpoch !== undefined ? { currentEpoch: o.currentEpoch } : {}),
    datasetVersionId: o.datasetVersionId ?? fakeId('dsv', o.tail ?? '1'),
    ...(ended ? { endedAt: iso(120_000) } : {}),
    epochs: o.epochs ?? 50,
    ...(status === 'failed' ? { failureCode: o.failureCode ?? 'TRAINING_TIMEOUT' } : {}),
    family,
    id: fakeId('job', o.tail ?? '1'),
    ...(status === 'succeeded' ? { resultModelVersionId: o.resultModelVersionId ?? fakeId('mdl', o.tail ?? '1') } : {}),
    ...(started ? { startedAt: iso(60_000) } : {}),
    status,
  };
}

export const jobsPage = (items: readonly Record<string, unknown>[], nextCursor?: string): Record<string, unknown> => ({
  items,
  ...(nextCursor !== undefined ? { nextCursor } : {}),
});

export function datasetFixture(o: { readonly tail?: string; readonly family?: string; readonly name?: string } = {}): Record<string, unknown> {
  return { createdAt: iso(0), family: o.family ?? 'wallSegmentation', id: fakeId('dst', o.tail ?? '1'), name: o.name ?? 'qa-dataset-1' };
}

export interface VersionOpts {
  readonly tail?: string;
  readonly datasetTail?: string;
  readonly status?: 'building' | 'ready' | 'failed';
  readonly sequence?: number;
  readonly source?: 'approvedFloors' | 'cubicasa5k';
  readonly splitCounts?: { readonly train: number; readonly validation: number; readonly test: number };
  readonly failureCode?: string;
}

/** Body valid for DatasetVersionSchema (adminMl.ts:300-338: splitCounts + manifestSha256 iff ready, failureCode iff failed). */
export function versionFixture(o: VersionOpts = {}): Record<string, unknown> {
  const status = o.status ?? 'ready';
  return {
    createdAt: iso(0),
    datasetId: fakeId('dst', o.datasetTail ?? '1'),
    ...(status === 'failed' ? { failureCode: o.failureCode ?? 'DATASET_EMPTY' } : {}),
    id: fakeId('dsv', o.tail ?? String(o.sequence ?? 1)),
    ...(status === 'ready' ? { manifestSha256: 'a'.repeat(64) } : {}),
    sequence: o.sequence ?? 1,
    source: o.source ?? 'approvedFloors',
    ...(status === 'ready' ? { splitCounts: o.splitCounts ?? { test: 100, train: 800, validation: 100 } } : {}),
    status,
  };
}

/* ---------------------------------------------------------------- answers */

export interface Answer {
  readonly status?: number;
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
  readonly abort?: true;
}
export const ok = (body: unknown): Answer => ({ body, status: 200 });
/** `{ code, requestId, ...extra }` (extra: `field`, `resource`); `Retry-After: 0` so the client's GET retries are immediate. */
export const wireError = (status: number, code: string, extra: Record<string, string> = {}): Answer => ({
  body: { code, requestId: `qa-${code.toLowerCase()}`, ...extra },
  headers: { 'Retry-After': '0' },
  status,
});
export const aborted: Answer = { abort: true };

export interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}
export function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/* ---------------------------------------------------------------- the mock */

export interface Call {
  readonly method: string;
  readonly url: URL;
  readonly path: string; // after `/api/admin/ml/`
}
type Responder = (call: Call) => Answer | Promise<Answer>;
export interface Handlers {
  list: Responder; // GET training-jobs
  job: Responder; // GET training-jobs/:id
  metrics: Responder;
  logs: Responder;
  datasets: Responder; // GET datasets
  versions: Responder; // GET datasets/:id/versions
}
export interface TrainingMock {
  readonly on: Handlers;
  readonly calls: Call[];
  /** Writes and unknown paths that were aborted. */
  readonly stray: Call[];
  count(method: string, pathRe: RegExp, search?: (q: URLSearchParams) => boolean): number;
}

const EMPTY = ok({ items: [] });

export async function mockTrainingApi(page: Page, init: Partial<Handlers> = {}): Promise<TrainingMock> {
  const on: Handlers = { datasets: () => EMPTY, job: () => wireError(404, 'NOT_FOUND', { resource: 'trainingJob' }), list: () => EMPTY, logs: () => EMPTY, metrics: () => EMPTY, versions: () => EMPTY, ...init };
  const calls: Call[] = [];
  const stray: Call[] = [];
  const respond = async (route: Route, answer: Answer): Promise<void> => {
    if (answer.abort === true) return route.abort('failed');
    return route.fulfill({ body: JSON.stringify(answer.body ?? {}), contentType: 'application/json', headers: answer.headers ?? {}, status: answer.status ?? 200 });
  };
  await page.route('**/api/admin/ml/**', async (route) => {
    const url = new URL(route.request().url());
    const call: Call = { method: route.request().method(), path: url.pathname.replace(/^\/api\/admin\/ml\//u, ''), url };
    calls.push(call);
    if (call.method !== 'GET') {
      stray.push(call);
      return route.abort('failed');
    }
    const p = call.path;
    const handler =
      p === 'training-jobs' ? on.list
      : /^training-jobs\/[^/]+$/u.test(p) ? on.job
      : /^training-jobs\/[^/]+\/metrics$/u.test(p) ? on.metrics
      : /^training-jobs\/[^/]+\/logs$/u.test(p) ? on.logs
      : p === 'datasets' ? on.datasets
      : /^datasets\/[^/]+\/versions$/u.test(p) ? on.versions
      : undefined;
    if (handler === undefined) {
      stray.push(call);
      return route.abort('failed');
    }
    return respond(route, await handler(call));
  });
  return {
    calls,
    count: (method, pathRe, search) => calls.filter((c) => c.method === method && pathRe.test(c.path) && (search?.(c.url.searchParams) ?? true)).length,
    on,
    stray,
  };
}
