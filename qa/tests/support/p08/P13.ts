/**
 * QA-08 P13 helpers for `phase08_ml_api.spec.ts` (FL-B08M-01..05, read + refuse only, nothing written).
 */
import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';

import { captureExchange } from '../api';
import { ML, NO_DATASET, NO_JOB, NO_MODEL_VERSION, OPENING, FAMILIES, asJson, type Json } from './mlApi';

export { ML, NO_DATASET, NO_JOB, NO_MODEL_VERSION, OPENING, FAMILIES, asJson, type Json };



export const itemsOf = (value: unknown): Json[] => {
  const items = asJson(value).items;
  if (!Array.isArray(items)) throw new Error(`expected items[], got ${JSON.stringify(value)?.slice(0, 200)}`);
  return items.map(asJson);
};

export interface Sent {
  readonly res: APIResponse;
  readonly text: string;
  readonly body: unknown;
}

export interface CallOptions {
  readonly headers?: Record<string, string>;
  /** Raw bytes sent as `application/json` (malformed JSON / non-object). */
  readonly raw?: string;
}

/** One exchange + its `A08_<id>_<slug>.json` evidence. */
export async function call(
  api: APIRequestContext,
  id: string,
  slug: string,
  method: string,
  path: string,
  body: unknown,
  assertions: readonly string[],
  options: CallOptions = {},
): Promise<Sent> {
  const headers = { ...(options.raw === undefined ? {} : { 'Content-Type': 'application/json' }), ...options.headers };
  const res = await api.fetch(path, {
    method,
    headers,
    ...(options.raw !== undefined ? { data: Buffer.from(options.raw) } : body === undefined ? {} : { data: body }),
  });
  const text = await res.text();
  const parsed = await captureExchange(`A08_${id}_${slug}.json`, { method, path, body: options.raw ?? body }, res, assertions);
  return { res, text, body: parsed };
}

/** W7 error body (BE core/errors.py:82-88): `code` + `requestId` (+ `field`/`resource`); `null` = the key must be absent. */
export function expectError(sent: Sent, status: number, code: string, field?: string | null, resource?: string | null, hard = false): Json {
  const check = hard ? expect : expect.soft;
  check(sent.res.status(), `${code} status`).toBe(status);
  let body: Json = {};
  try {
    body = asJson(JSON.parse(sent.text));
  } catch {
    check(false, `${code}: body is a JSON object (got ${sent.text.slice(0, 120)})`).toBe(true);
    return body;
  }
  check(body.code, `${code} code`).toBe(code);
  check(typeof body.requestId, `${code}: requestId`).toBe('string');
  if (field === null) check(body, `${code}: no field`).not.toHaveProperty('field');
  else if (field !== undefined) check(body.field, `${code}: field`).toBe(field);
  if (resource === null) check(body, `${code}: no resource`).not.toHaveProperty('resource');
  else if (resource !== undefined) check(body.resource, `${code}: resource`).toBe(resource);
  return body;
}

export interface MlRoute {
  readonly slug: string;
  readonly method: 'GET' | 'POST' | 'PUT';
  readonly path: string;
  /** Body for an authenticated caller; the 403 must come before it is read. */
  readonly body?: unknown;
  /** Non-multipart / non-JSON raw body for N26. */
  readonly raw?: string;
}

/** Registry N23-N27 (admin_ml_registry/router.py:38-90). */
export const REGISTRY_ROUTES: readonly MlRoute[] = [
  { slug: 'families', method: 'GET', path: `${ML}/model-families` },
  { slug: 'activate', method: 'PUT', path: `${ML}/model-families/${OPENING}/active`, body: { baseVersion: 0, body: { versionId: NO_MODEL_VERSION } } },
  { slug: 'versions', method: 'GET', path: `${ML}/model-versions` },
  { slug: 'upload', method: 'POST', path: `${ML}/model-versions`, raw: '{}' },
  { slug: 'version', method: 'GET', path: `${ML}/model-versions/${NO_MODEL_VERSION}` },
];
/** Jobs N32-N37 (admin_ml_jobs/router.py:40-89). */
export const JOBS_ROUTES: readonly MlRoute[] = [
  { slug: 'jobs', method: 'GET', path: `${ML}/training-jobs` },
  { slug: 'job_create', method: 'POST', path: `${ML}/training-jobs`, body: {} },
  { slug: 'job', method: 'GET', path: `${ML}/training-jobs/${NO_JOB}` },
  { slug: 'job_cancel', method: 'POST', path: `${ML}/training-jobs/${NO_JOB}/cancel`, body: {} },
  { slug: 'job_metrics', method: 'GET', path: `${ML}/training-jobs/${NO_JOB}/metrics` },
  { slug: 'job_logs', method: 'GET', path: `${ML}/training-jobs/${NO_JOB}/logs` },
];
/** Datasets N28-N31 (admin_ml_datasets/router.py:33-59). */
export const DATASET_ROUTES: readonly MlRoute[] = [
  { slug: 'datasets', method: 'GET', path: `${ML}/datasets` },
  { slug: 'dataset_create', method: 'POST', path: `${ML}/datasets`, body: {} },
  { slug: 'dataset_versions', method: 'GET', path: `${ML}/datasets/${NO_DATASET}/versions` },
  { slug: 'dataset_build', method: 'POST', path: `${ML}/datasets/${NO_DATASET}/versions`, body: {} },
];

export const readPage = async (api: APIRequestContext, path: string): Promise<Json[]> => {
  const res = await api.get(path);
  expect(res.status(), `setup: GET ${path}`).toBe(200);
  return itemsOf(await res.json());
};
