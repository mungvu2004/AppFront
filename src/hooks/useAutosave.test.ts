import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizeSpatial } from '@/domain/spatial/normalize';
import { RETRY_SCHEDULE_MS } from '@/lib/autosave/retrySchedule';
import { CLEAN_BUILDING_SCENARIO } from '@/lib/testing/fixtures';
import { useStore } from '@/store';

import { useAutosave, useAutosaveFlush } from './useAutosave';

const setSpatial = (value: ReturnType<typeof normalizeSpatial> | null): void => {
  /* eslint-disable-next-line local/no-direct-set -- dựng cảnh giữa hai lần
     render trong test, không phải một thao tác ghi của người dùng; đúng
     ngoại lệ `SaveIndicator.test.tsx` đã dùng. */
  useStore.setState({ spatial: value });
};

const SAMPLE_SPATIAL = normalizeSpatial(CLEAN_BUILDING_SCENARIO.graph);

describe('useAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setSpatial(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    setSpatial(null);
  });

  it('returns null before anything has been saved', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave(onSave));

    expect(result.current).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves 800ms after a store change and formats the label — the one debounce in the repo, not a second one', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave(onSave));

    act(() => {
      setSpatial(SAMPLE_SPATIAL);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(799);
    });
    expect(onSave).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(SAMPLE_SPATIAL);
    expect(result.current).toMatch(/^Đã lưu lúc \d{2}:\d{2}$/);
  });

  it('retries a failing save on the shared retry schedule before reporting failure, using the exact short string ConnectedSaveIndicator matches', async () => {
    expect(RETRY_SCHEDULE_MS).toEqual([5_000, 15_000, 45_000]);

    const onSave = vi.fn().mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useAutosave(onSave));

    act(() => {
      setSpatial(SAMPLE_SPATIAL);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(result.current).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(onSave).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(onSave).toHaveBeenCalledTimes(3);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000);
    });
    expect(onSave).toHaveBeenCalledTimes(4);
    expect(result.current).toBe('Lưu thất bại');
  });

  it('does not fabricate a failure label while offline — stays sticky instead of lying', async () => {
    const originalOnLine = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });

    try {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() => useAutosave(onSave));

      act(() => {
        setSpatial(SAMPLE_SPATIAL);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(800);
      });

      expect(onSave).not.toHaveBeenCalled();
      expect(result.current).toBeNull();
    } finally {
      // jsdom defines `onLine` on the `Navigator` prototype, not as the
      // instance's own property, so `originalOnLine` is `undefined` here —
      // restoring would silently no-op and leave `onLine: false` shadowing
      // the prototype for every test that runs afterward. Delete the
      // override we added instead, so the prototype's real value shows
      // through again.
      if (originalOnLine) {
        Object.defineProperty(window.navigator, 'onLine', originalOnLine);
      } else {
        delete (window.navigator as { onLine?: boolean }).onLine;
      }
    }
  });

  it('never calls onSave twice for the same change merely because the component re-rendered', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(() => useAutosave(onSave));

    act(() => {
      setSpatial(SAMPLE_SPATIAL);
    });
    act(() => {
      rerender();
      rerender();
      rerender();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
  });
});

describe('useAutosaveFlush', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setSpatial(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    setSpatial(null);
  });

  it('is safe to call with nothing pending: resolves without calling onSave', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosaveFlush(onSave));

    await act(async () => {
      await result.current.flush();
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves immediately, skipping the rest of the 800ms debounce window', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosaveFlush(onSave));

    act(() => {
      setSpatial(SAMPLE_SPATIAL);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(onSave).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.flush();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(result.current.label).toMatch(/^Đã lưu lúc \d{2}:\d{2}$/);
  });
});
