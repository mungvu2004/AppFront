/**
 * `useAuthScreen` on its own: the decisions QA-01 found wrong, one block per bug.
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import viMessages from '@/i18n/vi.json';

import { wireFailure } from '../authTestKit';

import { useAuthScreen, type AuthGateway, type UseAuthScreenOptions } from './useAuthScreen';

const AUTH = viMessages.auth;
const EMAIL = 'thu.ha@vidu.vn';
const PASSWORD = 'khong-doan-duoc';

function gatewayReplying(reply: Awaited<ReturnType<AuthGateway['signIn']>>): AuthGateway {
  return {
    signIn: vi.fn<AuthGateway['signIn']>(async () => reply),
    requestPasswordReset: vi.fn<AuthGateway['requestPasswordReset']>(async () => ({ ok: true, data: undefined })),
  };
}

function setup(options: Partial<UseAuthScreenOptions> = {}) {
  return renderHook(() =>
    useAuthScreen({
      gateway: gatewayReplying({ ok: true, data: undefined }),
      onAuthenticated: () => undefined,
      reducedMotion: true,
      ...options,
    }),
  );
}

describe('useAuthScreen — partial (BUG-001)', () => {
  it('is not "partial" while the typed address is malformed', () => {
    const { result } = setup();

    act(() => {
      result.current.actions.setEmail('khong-hop-le');
    });

    expect(result.current.model.state).not.toBe('partial');

    act(() => {
      result.current.actions.setEmail(EMAIL);
    });

    expect(result.current.model.state).toBe('partial');
  });
});

describe('useAuthScreen — leaving an empty box (BUG-009)', () => {
  it('says nothing on blur of a box never typed in, and still says "chưa nhập" on submit', () => {
    const { result } = setup();

    act(() => {
      result.current.actions.blurField('email');
      result.current.actions.blurField('password');
    });

    expect(result.current.model.problems).toEqual({});

    act(() => {
      result.current.actions.submit();
    });

    expect(result.current.model.problems).toEqual({
      email: AUTH.problems.emailRequired,
      password: AUTH.problems.passwordRequired,
    });
  });

  it('keeps the complaint submit left behind when the empty box is left again', () => {
    const { result } = setup();

    act(() => {
      result.current.actions.submit();
    });
    act(() => {
      result.current.actions.blurField('email');
    });

    expect(result.current.model.problems.email).toBe(AUTH.problems.emailRequired);
  });
});

describe('useAuthScreen — an address past 254 characters (BUG-010)', () => {
  it('stops it before sending and says it is too long, not malformed', () => {
    const gateway = gatewayReplying({ ok: true, data: undefined });
    const { result } = setup({ gateway });
    const longEmail = `${'a'.repeat(64)}@${'b'.repeat(240)}.vn`;

    act(() => {
      result.current.actions.setEmail(longEmail);
      result.current.actions.setPassword(PASSWORD);
    });
    act(() => {
      result.current.actions.submit();
    });

    expect(gateway.signIn).not.toHaveBeenCalled();
    expect(result.current.model.problems.email).toBe(AUTH.problems.emailTooLong.replace('{{count}}', '254'));
  });
});

describe('useAuthScreen — 422 VALIDATION on a field the form does not have (BUG-018)', () => {
  it('says the request was refused without pointing at marked fields', async () => {
    const gateway = gatewayReplying(wireFailure(422, { code: 'VALIDATION', field: 'rememberMe' }));
    const { result } = setup({ gateway });

    act(() => {
      result.current.actions.setEmail(EMAIL);
      result.current.actions.setPassword(PASSWORD);
    });
    await act(async () => {
      result.current.actions.submit();
    });

    expect(result.current.model.problems).toEqual({});
    expect(result.current.model.notice).toEqual({
      tone: 'violation',
      title: AUTH.errors.validationOther.title,
      message: AUTH.errors.validationOther.description,
    });
    expect(result.current.model.notice?.message).not.toBe(viMessages.errors.validation.description);
  });
});
