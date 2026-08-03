import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createManagedAbortSignal, REQUEST_TIMEOUT_MS, resolveTimeoutMs } from '../timeout';

describe('http/timeout.ts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves default timeout values by mode', () => {
    expect(resolveTimeoutMs('default')).toBe(REQUEST_TIMEOUT_MS.default);
    expect(resolveTimeoutMs('file')).toBe(REQUEST_TIMEOUT_MS.file);
    expect(resolveTimeoutMs('stream')).toBe(REQUEST_TIMEOUT_MS.stream);
  });

  it('aborts when timeout elapses', async () => {
    const managed = createManagedAbortSignal({
      timeoutMs: 15000,
    });

    expect(managed.signal.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(15000);

    expect(managed.signal.aborted).toBe(true);
    expect(managed.isTimeout()).toBe(true);

    managed.cleanup();
  });

  it('releases external listeners when timeout fires', async () => {
    const external = new AbortController();
    const removeSpy = vi.spyOn(external.signal, 'removeEventListener');

    const managed = createManagedAbortSignal({
      externalSignal: external.signal,
      timeoutMs: 1,
    });

    await vi.advanceTimersByTimeAsync(1);

    expect(managed.signal.aborted).toBe(true);
    expect(removeSpy).toHaveBeenCalled();

    managed.cleanup();
  });
});
