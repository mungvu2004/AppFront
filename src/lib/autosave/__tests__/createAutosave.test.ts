import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAutosave } from '../createAutosave';
import { RETRY_SCHEDULE_MS } from '../retrySchedule';

interface Draft {
  text: string;
}

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('createAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in the saved state', () => {
    const autosave = createAutosave<Draft>({ getChanges: () => undefined, save: vi.fn() });

    expect(autosave.getState()).toBe('saved');
  });

  it('typing continuously for 12s produces exactly 2 saves, capped by maxWaitMs', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const getChanges = vi.fn((): Draft | undefined => ({ text: 'draft' }));
    const autosave = createAutosave<Draft>({ getChanges, save });

    const keystrokeIntervalMs = 100;
    const typingDurationMs = 12_000;

    autosave.notifyChange();

    for (let elapsed = keystrokeIntervalMs; elapsed <= typingDurationMs; elapsed += keystrokeIntervalMs) {
      await vi.advanceTimersByTimeAsync(keystrokeIntervalMs);
      autosave.notifyChange();
    }

    expect(save).toHaveBeenCalledTimes(2);
  });

  it('flushes after debounceMs of silence when typing stops', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const getChanges = vi.fn((): Draft | undefined => ({ text: 'draft' }));
    const autosave = createAutosave<Draft>({ debounceMs: 800, getChanges, maxWaitMs: 5_000, save });

    autosave.notifyChange();
    await vi.advanceTimersByTimeAsync(799);
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(autosave.getState()).toBe('saved');
  });

  it('does not call save when there is no real change', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const getChanges = vi.fn((): Draft | undefined => undefined);
    const autosave = createAutosave<Draft>({ getChanges, save });

    autosave.notifyChange();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(save).not.toHaveBeenCalled();
    expect(autosave.getState()).toBe('saved');
  });

  it('retries a failed save at exactly 5000ms, 15000ms, then 45000ms, then gives up', async () => {
    expect(RETRY_SCHEDULE_MS).toEqual([5_000, 15_000, 45_000]);

    const save = vi.fn().mockRejectedValue(new Error('network down'));
    const getChanges = vi.fn((): Draft | undefined => ({ text: 'draft' }));
    const autosave = createAutosave<Draft>({ getChanges, isOnline: () => true, save });

    autosave.notifyChange();
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledTimes(1);
    expect(autosave.getState()).toBe('dirty');

    await vi.advanceTimersByTimeAsync(4_999);
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(14_999);
    expect(save).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(44_999);
    expect(save).toHaveBeenCalledTimes(3);
    expect(autosave.getState()).toBe('dirty');
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(4);
    expect(autosave.getState()).toBe('failed');

    await vi.advanceTimersByTimeAsync(100_000);
    expect(save).toHaveBeenCalledTimes(4);
    expect(autosave.getState()).toBe('failed');
  });

  it('keeps the unsaved changes available after failing so a later saveNow can succeed', async () => {
    let shouldFail = true;
    const save = vi.fn().mockImplementation(async () => {
      if (shouldFail) {
        throw new Error('network down');
      }
    });
    const getChanges = vi.fn((): Draft | undefined => ({ text: 'draft' }));
    const autosave = createAutosave<Draft>({ getChanges, isOnline: () => true, save });

    autosave.notifyChange();
    await vi.advanceTimersByTimeAsync(800);
    await vi.advanceTimersByTimeAsync(5_000);
    await vi.advanceTimersByTimeAsync(15_000);
    await vi.advanceTimersByTimeAsync(45_000);
    expect(autosave.getState()).toBe('failed');
    expect(save).toHaveBeenCalledTimes(4);

    shouldFail = false;
    await autosave.saveNow();

    expect(save).toHaveBeenCalledTimes(5);
    expect(autosave.getState()).toBe('saved');
  });

  it('never overlaps two saves: a save requested mid-flight runs only after the first settles', async () => {
    const callOrder: string[] = [];
    let resolveFirstSave: (() => void) | undefined;
    const save = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            callOrder.push('start-1');
            resolveFirstSave = () => {
              callOrder.push('end-1');
              resolve();
            };
          }),
      )
      .mockImplementationOnce(async () => {
        callOrder.push('start-2');
      });
    const getChanges = vi.fn((): Draft | undefined => ({ text: 'draft' }));
    const autosave = createAutosave<Draft>({ getChanges, save });

    const first = autosave.saveNow();
    await flushMicrotasks();
    expect(save).toHaveBeenCalledTimes(1);

    const second = autosave.saveNow();
    await flushMicrotasks();
    expect(save).toHaveBeenCalledTimes(1);

    resolveFirstSave?.();
    await first;
    await second;

    expect(save).toHaveBeenCalledTimes(2);
    expect(callOrder).toEqual(['start-1', 'end-1', 'start-2']);
  });

  it('reports offline instead of retrying against the network, then recovers once back online', async () => {
    let online = false;
    const save = vi.fn().mockResolvedValue(undefined);
    const getChanges = vi.fn((): Draft | undefined => ({ text: 'draft' }));
    const autosave = createAutosave<Draft>({ getChanges, isOnline: () => online, save });

    autosave.notifyChange();
    await vi.advanceTimersByTimeAsync(800);

    expect(save).not.toHaveBeenCalled();
    expect(autosave.getState()).toBe('offline');

    online = true;
    await vi.advanceTimersByTimeAsync(5_000);

    expect(save).toHaveBeenCalledTimes(1);
    expect(autosave.getState()).toBe('saved');
  });

  it('saveNow saves immediately and getLastSavedAt reports when it happened', async () => {
    const now = vi.fn().mockReturnValue(0);
    const save = vi.fn().mockResolvedValue(undefined);
    const getChanges = vi.fn((): Draft | undefined => ({ text: 'draft' }));
    const autosave = createAutosave<Draft>({ getChanges, now, save });

    expect(autosave.getLastSavedAt()).toBeUndefined();

    now.mockReturnValue(1_755_000_000_000);
    await autosave.saveNow();

    expect(save).toHaveBeenCalledTimes(1);
    expect(autosave.getLastSavedAt()).toBe(1_755_000_000_000);
  });

  it('notifies subscribers as the state transitions', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const getChanges = vi.fn((): Draft | undefined => ({ text: 'draft' }));
    const autosave = createAutosave<Draft>({ getChanges, save });
    const states: string[] = [];
    const unsubscribe = autosave.subscribe((state) => states.push(state));

    autosave.notifyChange();
    await vi.advanceTimersByTimeAsync(800);

    expect(states).toEqual(['dirty', 'saving', 'saved']);

    unsubscribe();
    autosave.notifyChange();
    await vi.advanceTimersByTimeAsync(800);

    expect(states).toEqual(['dirty', 'saving', 'saved']);
  });
});
