/**
 * `useAuthScreen` on its own: the decisions QA-01 found wrong, one block per bug.
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import viMessages from '@/i18n/vi.json';

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
