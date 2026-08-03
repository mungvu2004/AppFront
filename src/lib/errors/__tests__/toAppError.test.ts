import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { APP_ERROR_KINDS } from '../kinds';
import { toAppError } from '../toAppError';

const makeHttpError = (overrides: Partial<{
  code: string;
  kind: 'network' | 'timeout' | 'auth' | 'http' | 'parse';
  raw: unknown;
  requestId: string;
  retryable: boolean;
  status: number;
}>): {
  code?: string;
  kind: 'network' | 'timeout' | 'auth' | 'http' | 'parse';
  raw: unknown;
  requestId: string;
  retryable: boolean;
  status?: number;
} => ({
  kind: 'http',
  raw: {},
  requestId: 'req-00000000',
  retryable: false,
  ...overrides,
});

describe('errors/toAppError.ts', () => {
  it('normalizes all 13 error kinds', () => {
    const cases: Array<[
      string,
      unknown,
      {
        kind: (typeof APP_ERROR_KINDS)[number];
        requestId?: string;
        retryable?: boolean;
      },
    ]> = [
      ['network', makeHttpError({ kind: 'network', requestId: 'req-network', retryable: true }), { kind: 'network', requestId: 'req-network', retryable: true }],
      ['timeout', makeHttpError({ kind: 'timeout', requestId: 'req-timeout' }), { kind: 'timeout', requestId: 'req-timeout', retryable: true }],
      ['unauthenticated', makeHttpError({ kind: 'auth', requestId: 'req-auth', status: 401 }), { kind: 'unauthenticated', requestId: 'req-auth' }],
      ['forbidden', makeHttpError({ kind: 'http', requestId: 'req-forbidden', status: 403 }), { kind: 'forbidden', requestId: 'req-forbidden' }],
      ['notFound', makeHttpError({ kind: 'http', requestId: 'req-not-found', status: 404 }), { kind: 'notFound', requestId: 'req-not-found' }],
      ['conflict', makeHttpError({ kind: 'http', requestId: 'req-conflict', status: 409 }), { kind: 'conflict', requestId: 'req-conflict', retryable: true }],
      ['validation', (() => {
        const schema = z.object({ floor: z.string().min(2) });
        const result = schema.safeParse({ floor: 'a' });
        if (result.success) {
          throw new Error('Expected validation failure');
        }
        return Object.assign(result.error, { requestId: 'req-validation' });
      })(), { kind: 'validation', requestId: 'req-validation' }],
      ['rateLimited', makeHttpError({ kind: 'http', requestId: 'req-rate', status: 429 }), { kind: 'rateLimited', requestId: 'req-rate', retryable: true }],
      ['upload', makeHttpError({ kind: 'http', requestId: 'req-upload', status: 413 }), { kind: 'upload', requestId: 'req-upload', retryable: true }],
      ['processing', Object.assign(new Error('Worker crashed while processing step 3'), { requestId: 'req-processing', step: '3' }), { kind: 'processing', requestId: 'req-processing', retryable: true }],
      ['geometry', Object.assign(new Error('WebGL context lost while rendering'), { requestId: 'req-geometry', count: 2, floor: '4' }), { kind: 'geometry', requestId: 'req-geometry', retryable: true }],
      ['export', Object.assign(new Error('Export worker stopped unexpectedly'), { requestId: 'req-export' }), { kind: 'export', requestId: 'req-export', retryable: true }],
      ['unknown', new Error('Điều gì đó rất lạ đã xảy ra'), { kind: 'unknown', retryable: false }],
    ];

    for (const [label, input, expected] of cases) {
      const actual = toAppError(input);

      expect(actual.kind, label).toBe(expected.kind);
      expect(actual.messageKey).toBe(`errors.${expected.kind}.description`);
      expect(actual.severity).toBeDefined();
      expect(actual.recovery).toBeDefined();

      if (expected.requestId !== undefined) {
        expect(actual.requestId).toBe(expected.requestId);
      }

      if (expected.retryable !== undefined) {
        expect(actual.retryable).toBe(expected.retryable);
      }
    }
  });

  it('keeps backend codes and extracted params', () => {
    const actual = toAppError(
      makeHttpError({
        code: 'RATE_LIMITED',
        kind: 'http',
        raw: { count: 6, floor: '2', step: 'Bước 4' },
        requestId: 'req-params',
        status: 429,
      }),
    );

    expect(actual.kind).toBe('rateLimited');
    expect(actual.code).toBe('RATE_LIMITED');
    expect(actual.requestId).toBe('req-params');
    expect(actual.params.count).toBe(6);
    expect(actual.params.floor).toBe('2');
    expect(actual.params.step).toBe('Bước 4');
  });
});
