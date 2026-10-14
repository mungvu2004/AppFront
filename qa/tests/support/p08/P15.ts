/**
 * QA-08 P15 helpers (FL-B08M-11..17, `phase08_ml_c_api.spec.ts`): ML admin API, datasets create/build + training jobs read/create/cancel.
 * Owned by P15 only. Shared constants live in mlApi.ts.
 * SAFETY: nothing here may start a training run or a dataset build. `guardCreate` / `guardCancel` throw BEFORE sending any request
 * that could pass validation (a job is never created) or cancel a queued/running job.
 */
import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';

import { captureExchange } from './../api';
import { RUN_ID, TEST_DATA_PREFIX } from './../evidence';
import { ML, NO_JOB, NO_DATASET, NO_DATASET_VERSION, OPENING, asJson, type Json } from './mlApi';

export { ML, NO_JOB, NO_DATASET, NO_DATASET_VERSION, OPENING, asJson, type Json };

const ULID0 = '0'.repeat(26);
export const NO_PROJECT = `prj_${ULID0}`;
export const WALLS = 'wallSegmentation';

export interface Sent {
  readonly res: APIResponse;
  readonly text: string;
  readonly body: unknown;
}

const tryJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};
export const itemsOf = (value: unknown, what: string): Json[] => {
  const items = asJson(value).items;
  if (!Array.isArray(items)) throw new Error(`${what}: items is not an array: ${JSON.stringify(value)?.slice(0, 200)}`);
  return items.map(asJson);
};

export const note = (description: string): void => {
  test.info().annotations.push({ type: 'note', description });
};

/** Run-unique dataset name `${TEST_DATA_PREFIX}b08m-${RUN_ID}-<n>` (+ `-r<retry>` on a retry); n <= 4 per run (S2 #5). */
export const datasetName = (n: number): string => `${TEST_DATA_PREFIX}b08m-${RUN_ID}-${n}${test.info().retry ? `-r${test.info().retry}` : ''}`;

const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** `count` distinct well-formed `prj_<ULID>` ids that no row carries (all start with 0). */
export function projectIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    let n = i + 1;
    let tail = '';
    for (let k = 0; k < 6; k += 1, n = Math.floor(n / 32)) tail = ULID_ALPHABET[n % 32]! + tail;
    return `prj_${'0'.repeat(20)}${tail}`;
  });
}

/** One exchange + its `A08_<row id>_<slug>.json` evidence. `raw` = bytes sent as application/json. */
// dup-of: mlApi.call
export async function call(api: APIRequestContext, name: string, method: string, path: string, body: unknown, assertions: readonly string[]): Promise<Sent> {
  const res = await api.fetch(path, { method, ...(body === undefined ? {} : { data: body }) });
  const text = await res.text();
  const parsed = await captureExchange(`A08_${name}.json`, { method, path, body }, res, assertions);
  return { res, text, body: parsed };
}

/** W7 error body: `code` + `requestId` (+ `field`/`resource`); `field: null` = key must be absent. Soft unless `hard`. */
// dup-of: mlApi.expectError
export function expectError(sent: Sent, status: number, code: string, o: { field?: string | null; resource?: string; hard?: boolean } = {}): Json {
  const ex = o.hard ? expect : expect.soft;
  ex(sent.res.status(), `${code}: status`).toBe(status);
  const parsed = tryJson(sent.text);
  ex(typeof parsed === 'object' && parsed !== null, `${code}: body is a JSON error object (got ${sent.text.slice(0, 120)})`).toBe(true);
  const body = typeof parsed === 'object' && parsed !== null ? (parsed as Json) : {};
  ex(body.code, `${code}: code`).toBe(code);
  ex(typeof body.requestId, `${code}: requestId`).toBe('string');
  if (o.field === null) ex(body, `${code}: no field`).not.toHaveProperty('field');
  else if (o.field !== undefined) ex(body.field, `${code}: field`).toBe(o.field);
  if (o.resource !== undefined) ex(body.resource, `${code}: resource`).toBe(o.resource);
  return body;
}

/** Success: status + a 200 list/read body. */
export function expectOk(sent: Sent, status: number, what: string, hard = false): Json {
  (hard ? expect : expect.soft)(sent.res.status(), `${what}: status`).toBe(status);
  const parsed = tryJson(sent.text);
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as Json) : {};
}

const TRAIN_FAMILIES = new Set([OPENING, WALLS]);
const DSV = /^dsv_[0-9A-HJKMNP-TV-Z]{26}$/u;
const KEYS = new Set(['family', 'datasetVersionId', 'baseModel', 'epochs']);
/** True when `body` would pass POST /training-jobs wire validation (families, dsv pattern, strict int 1..300, no extra keys). */
export function wireValid(body: Json): boolean {
  return (
    Object.keys(body).every((k) => KEYS.has(k)) &&
    typeof body.family === 'string' && TRAIN_FAMILIES.has(body.family) &&
    typeof body.datasetVersionId === 'string' && DSV.test(body.datasetVersionId) &&
    typeof body.baseModel === 'string' &&
    typeof body.epochs === 'number' && Number.isInteger(body.epochs) && body.epochs >= 1 && body.epochs <= 300
  );
}

/**
 * Guard: throws before a body that passes validation can be sent unless its dataset version is NO_DATASET_VERSION (404) or one in `refusable`
 * (a version verified by the caller to be not ready / of another family, so the BE refuses it before the insert).
 */
export function guardCreate(body: Json, refusable: ReadonlySet<string> = new Set()): void {
  if (wireValid(body) && body.datasetVersionId !== NO_DATASET_VERSION && !refusable.has(String(body.datasetVersionId))) {
    throw new Error(`guard: refusing to send a job-create body that could create a training job: ${JSON.stringify(body)}`);
  }
}

const JOB_ID = /^job_[0-9A-HJKMNP-TV-Z]{26}$/u;
export const TERMINAL = ['succeeded', 'failed', 'cancelling', 'cancelled'] as const;
/** Guard: a cancel may only target a malformed id, NO_JOB or a job id in `safe` (verified terminal: never queued/running). */
export function guardCancel(id: string, safe: ReadonlySet<string> = new Set()): void {
  if (JOB_ID.test(id) && id !== NO_JOB && !safe.has(id)) throw new Error(`guard: refusing to cancel ${id}: not verified terminal`);
}

/** The job list (default newest first), `query` appended after `?`. */
export async function jobList(api: APIRequestContext, name: string, query = 'limit=200'): Promise<{ sent: Sent; items: Json[] }> {
  const sent = await call(api, name, 'GET', `${ML}/training-jobs?${query}`, undefined, [`GET training-jobs?${query}`]);
  expect(sent.res.status(), `setup: GET training-jobs?${query}`).toBe(200);
  return { sent, items: itemsOf(sent.body, 'jobs') };
}
