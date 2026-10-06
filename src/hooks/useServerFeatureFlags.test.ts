import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetFeatureFlagsForTests,
  configureFeatureFlags,
  getFeatureFlag,
  getFeatureFlagsSnapshot,
} from '@/lib/telemetry/flags';

import { useServerFeatureFlags } from './useServerFeatureFlags';

const session = vi.hoisted(() => ({
  current: { status: 'anonymous', user: null } as { status: string; user: { id: string } | null },
}));

vi.mock('./useSession', () => ({ useSession: () => session.current }));

const SHADOWS = 'scene.soft-shadows';
const signedIn = (id: string) => ({ status: 'authenticated', user: { id } });

beforeEach(() => {
  __resetFeatureFlagsForTests();
  configureFeatureFlags({ allowOverrides: false, storage: null });
  session.current = { status: 'anonymous', user: null };
});

afterEach(() => {
  __resetFeatureFlagsForTests();
});

describe('useServerFeatureFlags', () => {
  it('reads once for a signed-in user and hands the flags to the store', async () => {
    session.current = signedIn('u1');
    const read = vi.fn().mockResolvedValue({ [SHADOWS]: true });

    const { rerender } = renderHook(() => useServerFeatureFlags(read));
    await waitFor(() => expect(getFeatureFlag(SHADOWS)).toBe(true));
    rerender();

    expect(read).toHaveBeenCalledTimes(1);
  });

  it('sends nothing while anonymous', () => {
    const read = vi.fn();

    renderHook(() => useServerFeatureFlags(read));

    expect(read).not.toHaveBeenCalled();
  });

  it('goes back to defaults and reloads for a different user', async () => {
    session.current = signedIn('u1');
    const read = vi.fn().mockResolvedValueOnce({ [SHADOWS]: true }).mockResolvedValueOnce({ [SHADOWS]: false });

    const { rerender } = renderHook(() => useServerFeatureFlags(read));
    await waitFor(() => expect(getFeatureFlag(SHADOWS)).toBe(true));

    session.current = signedIn('u2');
    rerender();
    expect(getFeatureFlag(SHADOWS)).toBe(false);

    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(getFeatureFlagsSnapshot().serverStatus).toBe('ready'));
    expect(getFeatureFlag(SHADOWS)).toBe(false);
  });

  it('keeps defaults and does not throw when the read fails', async () => {
    session.current = signedIn('u1');
    const read = vi.fn().mockRejectedValue(new Error('network is down'));

    renderHook(() => useServerFeatureFlags(read));

    await waitFor(() => expect(getFeatureFlagsSnapshot().serverStatus).toBe('unavailable'));
    expect(getFeatureFlag(SHADOWS)).toBe(false);
  });

  it('ignores a late answer for the previous user', async () => {
    session.current = signedIn('u1');
    let answerU1: (payload: unknown) => void = () => undefined;
    const read = vi
      .fn()
      .mockReturnValueOnce(new Promise((resolve) => (answerU1 = resolve)))
      .mockResolvedValueOnce({ [SHADOWS]: false });

    const { rerender } = renderHook(() => useServerFeatureFlags(read));
    session.current = signedIn('u2');
    rerender();
    await waitFor(() => expect(getFeatureFlagsSnapshot().serverStatus).toBe('ready'));

    answerU1({ [SHADOWS]: true });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getFeatureFlag(SHADOWS)).toBe(false);
  });

  it('goes back to defaults on sign-out', async () => {
    session.current = signedIn('u1');
    const read = vi.fn().mockResolvedValue({ [SHADOWS]: true });

    const { rerender } = renderHook(() => useServerFeatureFlags(read));
    await waitFor(() => expect(getFeatureFlag(SHADOWS)).toBe(true));

    session.current = { status: 'anonymous', user: null };
    rerender();

    expect(getFeatureFlag(SHADOWS)).toBe(false);
    expect(getFeatureFlagsSnapshot().serverStatus).toBe('pending');
    expect(read).toHaveBeenCalledTimes(1);
  });
});
