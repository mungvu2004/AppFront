import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Autosave, AutosaveState } from '@/lib/autosave/createAutosave';

import { useSaveIndicator } from './useSaveIndicator';

interface FakeAutosave extends Autosave {
  emit: (state: AutosaveState) => void;
  setLastSavedAt: (value: number | undefined) => void;
}

const createFakeAutosave = (): FakeAutosave => {
  let state: AutosaveState = 'saved';
  let lastSavedAt: number | undefined;
  const listeners = new Set<(next: AutosaveState) => void>();

  return {
    emit: (next) => {
      state = next;
      listeners.forEach((listener) => listener(state));
    },
    getLastSavedAt: () => lastSavedAt,
    getState: () => state,
    notifyChange: vi.fn(),
    saveNow: vi.fn().mockResolvedValue(undefined),
    setLastSavedAt: (value) => {
      lastSavedAt = value;
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
};

describe('useSaveIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the idle label when nothing has been saved yet', () => {
    const autosave = createFakeAutosave();
    const { result } = renderHook(() => useSaveIndicator(autosave));

    expect(result.current.state).toBe('saved');
    expect(result.current.label).toBe('Chưa có thay đổi');
    expect(result.current.detail).toBe('Chưa có thay đổi');
  });

  it('shows the dirty label', () => {
    const autosave = createFakeAutosave();
    autosave.emit('dirty');
    const { result } = renderHook(() => useSaveIndicator(autosave));

    expect(result.current.label).toBe('Có thay đổi chưa lưu');
    expect(result.current.state).toBe('dirty');
  });

  it('shows the saving label', () => {
    const autosave = createFakeAutosave();
    autosave.emit('saving');
    const { result } = renderHook(() => useSaveIndicator(autosave));

    expect(result.current.label).toBe('Đang lưu…');
  });

  it('shows a failed label that does not fabricate a retry countdown the engine cannot honor', () => {
    const autosave = createFakeAutosave();
    autosave.emit('failed');
    const { result } = renderHook(() => useSaveIndicator(autosave));

    expect(result.current.label).toBe('Lưu thất bại sau nhiều lần thử. Chỉnh sửa hoặc lưu lại thủ công.');
  });

  it('shows the offline label', () => {
    const autosave = createFakeAutosave();
    autosave.emit('offline');
    const { result } = renderHook(() => useSaveIndicator(autosave));

    expect(result.current.label).toBe('Ngoại tuyến — sẽ lưu khi có mạng');
  });

  it('shows the absolute save time right after saving', () => {
    const autosave = createFakeAutosave();
    const savedAt = new Date(2026, 7, 13, 14, 32).getTime();
    autosave.setLastSavedAt(savedAt);

    const { result } = renderHook(() => useSaveIndicator(autosave, { now: () => savedAt }));

    expect(result.current.label).toBe('Đã lưu lúc 14:32');
    expect(result.current.detail).toBe('Đã lưu lúc 14:32');
  });

  it('updates the label to a relative form after 61 seconds while keeping the precise time in detail', () => {
    const autosave = createFakeAutosave();
    const savedAt = new Date(2026, 7, 13, 14, 32).getTime();
    autosave.setLastSavedAt(savedAt);

    let currentTime = savedAt;
    const { result } = renderHook(() => useSaveIndicator(autosave, { now: () => currentTime }));

    expect(result.current.label).toBe('Đã lưu lúc 14:32');

    currentTime = savedAt + 61_000;
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(result.current.label).toBe('Đã lưu 1 phút trước');
    expect(result.current.detail).toBe('Đã lưu lúc 14:32');
  });

  it('announces a completed save politely', () => {
    const autosave = createFakeAutosave();
    const announcer = { announce: vi.fn(), destroy: vi.fn() };
    const savedAt = new Date(2026, 7, 13, 14, 32).getTime();

    autosave.emit('saving');
    renderHook(() => useSaveIndicator(autosave, { now: () => savedAt, announcer }));

    act(() => {
      autosave.setLastSavedAt(savedAt);
      autosave.emit('saved');
    });

    expect(announcer.announce).toHaveBeenCalledWith('Đã lưu lúc 14:32');
  });

  it('announces a failed save assertively', () => {
    const autosave = createFakeAutosave();
    const announcer = { announce: vi.fn(), destroy: vi.fn() };

    autosave.emit('saving');
    renderHook(() => useSaveIndicator(autosave, { announcer }));

    act(() => {
      autosave.emit('failed');
    });

    expect(announcer.announce).toHaveBeenCalledWith(
      'Lưu thất bại sau nhiều lần thử. Chỉnh sửa hoặc lưu lại thủ công.',
      'assertive',
    );
  });

  it('stays silent about the state already on screen at mount and about dirty typing', () => {
    const autosave = createFakeAutosave();
    const announcer = { announce: vi.fn(), destroy: vi.fn() };

    renderHook(() => useSaveIndicator(autosave, { announcer }));

    act(() => {
      autosave.emit('dirty');
      autosave.emit('saving');
    });

    expect(announcer.announce).not.toHaveBeenCalled();
  });

  it('never calls into the autosave engine itself', () => {
    const autosave = createFakeAutosave();
    autosave.emit('dirty');
    const { result } = renderHook(() => useSaveIndicator(autosave));

    expect(result.current.label).toBe('Có thay đổi chưa lưu');
    expect(autosave.notifyChange).not.toHaveBeenCalled();
    expect(autosave.saveNow).not.toHaveBeenCalled();
  });
});
