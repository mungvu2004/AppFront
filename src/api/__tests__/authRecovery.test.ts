/**
 * N8–N10 (F-09a): the three public POSTs on the `auth` group, and the one thing the
 * group no longer has — `register`.
 */

import { describe, expect, it, vi } from 'vitest';

import { readWireError } from '@/lib/errors/wireError';
import type { HttpClient, HttpError, HttpRequestOptions, Result } from '@/lib/http';

import { createApiClient } from '../client';
import { ApiErrorBodySchema } from '../schemas/errors';
import { ENDPOINTS } from '../endpoints';
import {
  AcceptInvitationSchema,
  PasswordResetConfirmSchema,
  PasswordResetRequestSchema,
} from '../schemas/auth';

interface PostCall {
  readonly path: string;
  readonly options: HttpRequestOptions<unknown> | undefined;
}

/** A 422 shaped the way `src/lib/http` returns it: status and `code` at the top, the body under `raw`. */
const wireFailure = (status: number, body: { code: string }): Result<never, HttpError> => ({
  ok: false,
  error: {
    kind: 'http',
    status,
    code: body.code,
    requestId: 'req-test',
    retryable: false,
    raw: ApiErrorBodySchema.parse({ code: body.code, requestId: 'req-test' }),
  },
});

function makeHttp(reply: Result<unknown, HttpError> = { ok: true, data: undefined }) {
  const calls: PostCall[] = [];
  const post = vi.fn(async (path: string, options?: HttpRequestOptions<unknown>) => {
    calls.push({ path, options });

    return reply as Result<never, HttpError>;
  });
  const unused = vi.fn(async () => reply as Result<never, HttpError>);
  const http: HttpClient = {
    delete: unused,
    events: { emit: () => undefined, on: () => () => undefined },
    get: unused,
    getRecentRequests: () => [],
    patch: unused,
    post,
    put: unused,
  };

  return { calls, http, post };
}

function makeClient(reply?: Result<unknown, HttpError>) {
  const plain = makeHttp(reply);
  const tokenBearing = makeHttp();

  return { client: createApiClient(tokenBearing.http, { authHttp: plain.http }), plain, tokenBearing };
}

describe('auth recovery endpoints', () => {
  it('posts a password-reset request to the right path with a schema-valid body', async () => {
    const { client, plain, tokenBearing } = makeClient();
    const body = PasswordResetRequestSchema.parse({ email: 'thu.ha@vidu.vn' });

    const result = await client.auth.requestPasswordReset({ body });

    expect(result).toEqual({ ok: true, data: undefined });
    expect(plain.calls).toHaveLength(1);
    expect(plain.calls[0]?.path).toBe('/auth/password-reset');
    expect(plain.calls[0]?.path).toBe(ENDPOINTS.auth.passwordReset);
    expect(PasswordResetRequestSchema.safeParse(plain.calls[0]?.options?.body).success).toBe(true);
    expect(tokenBearing.post).not.toHaveBeenCalled();
  });

  it('posts a password-reset confirmation to the right path with a schema-valid body', async () => {
    const { client, plain } = makeClient();
    const body = PasswordResetConfirmSchema.parse({ token: 'abc', newPassword: 'mat-khau-moi-1' });

    expect((await client.auth.confirmPasswordReset({ body })).ok).toBe(true);
    expect(plain.calls[0]?.path).toBe('/auth/password-reset/confirm');
    expect(plain.calls[0]?.path).toBe(ENDPOINTS.auth.passwordResetConfirm);
    expect(PasswordResetConfirmSchema.safeParse(plain.calls[0]?.options?.body).success).toBe(true);
  });

  it('posts an invitation acceptance to the right path with a schema-valid body', async () => {
    const { client, plain } = makeClient();
    const body = AcceptInvitationSchema.parse({
      token: 'abc',
      fullName: '  Nguyễn Thu Hà  ',
      password: 'mat-khau-moi-1',
    });

    expect((await client.auth.acceptInvitation({ body })).ok).toBe(true);
    expect(plain.calls[0]?.path).toBe('/auth/invitations/accept');
    expect(plain.calls[0]?.path).toBe(ENDPOINTS.auth.invitationAccept);
    expect(AcceptInvitationSchema.safeParse(plain.calls[0]?.options?.body).success).toBe(true);
  });

  it('sends no Authorization header on any of the three', async () => {
    const { client, plain } = makeClient();

    await client.auth.requestPasswordReset({ body: { email: 'thu.ha@vidu.vn' } });
    await client.auth.confirmPasswordReset({ body: { token: 'abc', newPassword: 'mat-khau-moi-1' } });
    await client.auth.acceptInvitation({
      body: { token: 'abc', fullName: 'Hà', password: 'mat-khau-moi-1' },
    });

    expect(plain.calls).toHaveLength(3);

    for (const call of plain.calls) {
      expect(new Headers(call.options?.headers).has('authorization')).toBe(false);
    }
  });

  it('exposes the wire code of a 422 through readWireError', async () => {
    const { client } = makeClient(wireFailure(422, { code: 'PASSWORD_RESET_TOKEN_INVALID' }));

    const result = await client.auth.confirmPasswordReset({
      body: { token: 'abc', newPassword: 'mat-khau-moi-1' },
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(readWireError(result.error)?.code).toBe('PASSWORD_RESET_TOKEN_INVALID');
      expect(readWireError(result.error)?.status).toBe(422);
    }
  });

  it('has no register method any more, in the client or in the endpoint table', () => {
    const { client } = makeClient();

    expect('register' in client.auth).toBe(false);
    expect('register' in ENDPOINTS.auth).toBe(false);
  });
});
