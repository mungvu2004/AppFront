import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDebouncedJSONStorage, PERSIST_DEBOUNCE_MS } from '../debouncedStorage';

const KEY = 'perf-p7-test';
const value = (zoom: number) => ({ state: { zoom }, version: 2 });

describe('P7 — persist storage gathers writes', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function setup() {
    const storage = createDebouncedJSONStorage<{ zoom: number }>(() => window.localStorage);
    if (!storage) throw new Error('localStorage phải có trong jsdom');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    return { storage, write };
  }

  it('writes once, with the latest value, after many sets', () => {
    const { storage, write } = setup();

    for (let zoom = 1; zoom <= 100; zoom += 1) void storage.setItem(KEY, value(zoom));

    expect(write).not.toHaveBeenCalled();
    vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS);

    expect(write).toHaveBeenCalledTimes(1);
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? '{}')).toEqual(value(100));
  });

  it('does not write when the string equals what storage already holds', () => {
    const { storage, write } = setup();
    void storage.setItem(KEY, value(2));
    vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS);
    write.mockClear();

    void storage.setItem(KEY, value(2));
    vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS);

    expect(write).not.toHaveBeenCalled();
  });

  it('flushes the pending value on pagehide and when the tab goes hidden', () => {
    const { storage, write } = setup();

    void storage.setItem(KEY, value(3));
    window.dispatchEvent(new Event('pagehide'));
    expect(write).toHaveBeenCalledTimes(1);
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? '{}')).toEqual(value(3));

    void storage.setItem(KEY, value(4));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? '{}')).toEqual(value(4));

    // Nothing left for the timer to write.
    write.mockClear();
    vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS);
    expect(write).not.toHaveBeenCalled();
  });

  it('reads back what was stored and removeItem drops a pending write', () => {
    const { storage } = setup();
    window.localStorage.setItem(KEY, JSON.stringify(value(5)));

    expect(storage.getItem(KEY)).toEqual(value(5));

    void storage.setItem(KEY, value(6));
    void storage.removeItem(KEY);
    vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS);

    expect(window.localStorage.getItem(KEY)).toBeNull();
  });
});
