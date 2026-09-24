import { describe, expect, it } from 'vitest';

import { ApiErrorBodySchema } from '@/api/schemas/errors';
import type { HttpError } from '@/lib/http';

import { toAppError } from '../toAppError';
import { isTransientWireError, readWireError, type WireErrorInfo } from '../wireError';

const REQUEST_ID = 'req_01J8Z0000000000000000000';

const body = (fields: Record<string, unknown>): unknown =>
  ApiErrorBodySchema.parse({ requestId: REQUEST_ID, ...fields });

const httpError = (overrides: Partial<HttpError> & Pick<HttpError, 'kind'>): HttpError => ({
  raw: undefined,
  requestId: REQUEST_ID,
  retryable: false,
  ...overrides,
});

const wire = (
  status: number,
  code: string,
  extra: Record<string, unknown> = {},
): HttpError =>
  httpError({
    code,
    kind: 'http',
    raw: body({ code, ...extra }),
    status,
  });

describe('readWireError', () => {
  it('reads status, code and field from a 422 validation error', () => {
    expect(readWireError(wire(422, 'VALIDATION', { field: 'body.baseVersion' }))).toStrictEqual({
      code: 'VALIDATION',
      field: 'body.baseVersion',
      status: 422,
    } satisfies WireErrorInfo);
  });

  it('reads the resource of a 404 error', () => {
    expect(readWireError(wire(404, 'NOT_FOUND', { resource: 'project' }))).toStrictEqual({
      code: 'NOT_FOUND',
      resource: 'project',
      status: 404,
    } satisfies WireErrorInfo);
  });

  it('reads retryAfterSeconds when the client parsed a Retry-After header', () => {
    const error = httpError({ code: 'RATE_LIMITED', kind: 'http', retryAfterSeconds: 30, status: 429 });

    expect(readWireError(error)).toStrictEqual({
      code: 'RATE_LIMITED',
      retryAfterSeconds: 30,
      status: 429,
    } satisfies WireErrorInfo);
  });

  it('drops a code that is not UPPER_SNAKE, keeping the status', () => {
    expect(readWireError(httpError({ code: 'not a code', kind: 'http', status: 500 }))).toStrictEqual({
      status: 500,
    } satisfies WireErrorInfo);
  });

  it('reads an error wrapped in .error', () => {
    expect(readWireError({ error: wire(409, 'VERSION_CONFLICT') })).toStrictEqual({
      code: 'VERSION_CONFLICT',
      status: 409,
    } satisfies WireErrorInfo);
  });

  it('reads an error wrapped in .cause', () => {
    expect(readWireError({ cause: wire(409, 'VERSION_CONFLICT') })).toStrictEqual({
      code: 'VERSION_CONFLICT',
      status: 409,
    } satisfies WireErrorInfo);
  });

  it.each([
    ['an AppError', toAppError(wire(422, 'VALIDATION'))],
    ['null', null],
    ['a string', 'không lưu được'],
    ['a plain Error', new Error('boom')],
  ])('returns null for %s', (_label, input) => {
    expect(readWireError(input)).toBeNull();
  });
});

describe('isTransientWireError', () => {
  it.each([
    ['a network failure', httpError({ kind: 'network', retryable: true })],
    ['a timeout', httpError({ kind: 'timeout', retryable: true })],
    ['408 request timeout', wire(408, 'TIMEOUT')],
    ['429 rate limited', wire(429, 'RATE_LIMITED')],
    ['502 bad gateway', wire(502, 'DEPENDENCY_UNAVAILABLE')],
    ['503 idempotency in progress', wire(503, 'IDEMPOTENCY_IN_PROGRESS')],
    ['504 gateway timeout', wire(504, 'DEPENDENCY_UNAVAILABLE')],
    ['a TypeError from fetch', new TypeError('Failed to fetch')],
    ['a bare Error with no wire shape', new Error('Không lưu được lớp không gian (http)')],
  ])('treats %s as transient', (_label, input) => {
    expect(isTransientWireError(input)).toBe(true);
  });

  it.each([
    ['400 bad request', wire(400, 'BAD_REQUEST')],
    ['403 forbidden', wire(403, 'FORBIDDEN')],
    ['404 not found', wire(404, 'NOT_FOUND')],
    ['409 version conflict', wire(409, 'VERSION_CONFLICT')],
    ['413 payload too large', wire(413, 'FILE_TOO_LARGE')],
    ['422 validation', wire(422, 'VALIDATION')],
    ['428 precondition required', wire(428, 'PRECONDITION_REQUIRED')],
    ['401 auth', httpError({ code: 'UNAUTHENTICATED', kind: 'auth', status: 401 })],
    ['a parse failure', httpError({ kind: 'parse' })],
    ['an aborted request', httpError({ kind: 'aborted' })],
  ])('treats %s as permanent', (_label, input) => {
    expect(isTransientWireError(input)).toBe(false);
  });

  it('still reads 503 DEPENDENCY_UNAVAILABLE as transient after toAppError flattens it to kind unknown', () => {
    const appError = toAppError(wire(503, 'DEPENDENCY_UNAVAILABLE'));

    expect(appError.kind).toBe('unknown');
    expect(isTransientWireError(appError)).toBe(true);
  });

  it('reads an AppError built from 422 VALIDATION as permanent', () => {
    expect(isTransientWireError(toAppError(wire(422, 'VALIDATION')))).toBe(false);
  });
});
