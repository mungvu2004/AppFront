import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  __resetFeatureFlagsForTests,
  configureFeatureFlags,
  setFeatureFlagOverride,
  setServerFeatureFlags,
  type FeatureFlagKey,
} from '@/lib/telemetry/flags';

import { useFeatureFlag, useFeatureFlagResolution, useFeatureFlags } from './useFeatureFlag';

const SHADOWS: FeatureFlagKey = 'scene.soft-shadows';

beforeEach(() => {
  __resetFeatureFlagsForTests();
  configureFeatureFlags({ allowOverrides: true, storage: null });
});

afterEach(() => {
  __resetFeatureFlagsForTests();
});

describe('useFeatureFlag', () => {
  it('renders the default before any server has spoken', () => {
    const { result } = renderHook(() => useFeatureFlag(SHADOWS));

    expect(result.current).toBe(false);
  });

  it('re-renders when the server answers', () => {
    const { result } = renderHook(() => useFeatureFlag(SHADOWS));

    act(() => {
      setServerFeatureFlags({ [SHADOWS]: true });
    });

    expect(result.current).toBe(true);
  });

  it('re-renders when a development override arrives', () => {
    const { result } = renderHook(() => useFeatureFlagResolution(SHADOWS));

    act(() => {
      setServerFeatureFlags({ [SHADOWS]: true });
    });
    expect(result.current.source).toBe('server');

    act(() => {
      setFeatureFlagOverride(SHADOWS, false);
    });

    expect(result.current).toEqual({ key: SHADOWS, value: false, source: 'override' });
  });

  it('stays on the default when the server never answers', () => {
    const { result } = renderHook(() => useFeatureFlags());

    expect(result.current.serverStatus).toBe('pending');
    expect(result.current.values[SHADOWS]).toBe(false);
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useFeatureFlag(SHADOWS));

    unmount();

    expect(() => {
      setServerFeatureFlags({ [SHADOWS]: true });
    }).not.toThrow();
  });
});
