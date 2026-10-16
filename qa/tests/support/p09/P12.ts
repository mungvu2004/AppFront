/**
 * P12 helper (phase 09, anonymous BE authz). One call = one denied request + JSON evidence `A09_<id>_<slug>`.
 * order: `newApiContext()` sends `Origin: <base>` (support/api.ts), so `require_origin` / `reject_foreign_origin`
 * (AppBack core/origin.py) pass; `AppRoute.get_route_handler` (core/routing.py:263) calls `_principal_of` before the
 * body / path params are parsed, so `{}` payloads and fake ids still get 401 `UNAUTHENTICATED` (not 422 / 404).
 * Stream GETs (streams/router.py:128,147) pass `reject_foreign_origin` then `authenticate_stream` -> 401 without the stream cookie.
 */
import { expect, type APIRequestContext } from '@playwright/test';

import { captureExchange } from '../api';

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Shape-valid fake ids (ULID body); never resolved because auth runs first. */
export const FAKE = {
  id: 'ml_01J0000000000000000000000A',
  family: 'detector',
  pid: 'prj_01J0000000000000000000000A',
  fid: 'flr_01J0000000000000000000000A',
  uid: 'usr_01J0000000000000000000000A',
  upl: 'upl_01J0000000000000000000000A',
  mid: 'msr_01J0000000000000000000000A',
  vid: 'ver_01J0000000000000000000000A',
} as const;

export interface Denied {
  readonly status: number;
  readonly code: string;
}

/** Calls `method path` (writes carry `{}`) and asserts status + body.code; `hard` = `expect` (step H), else `expect.soft`. */
export async function expectDenied(
  ctx: APIRequestContext,
  method: Method,
  path: string,
  want: Denied,
  opts: { id: string; slug: string; hard?: boolean },
): Promise<void> {
  const write = method !== 'GET' && method !== 'DELETE';
  const data = write ? {} : undefined;
  const res = await ctx.fetch(path, { method, ...(write ? { data } : {}) });
  const body = (await captureExchange(
    `A09_${opts.id}_${opts.slug}.json`,
    { method, path, body: data },
    res,
    [`${method} ${path} anonymous -> ${want.status} ${want.code}`],
  )) as { code?: string } | null;
  const check = opts.hard ? expect : expect.soft;
  check(res.status(), `${method} ${path}`).toBe(want.status);
  check(body?.code, `${method} ${path} body.code`).toBe(want.code);
}
