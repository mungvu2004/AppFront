import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiErrorBodySchema } from '@/api/schemas/errors';
import type { HttpError } from '@/lib/http';
import type { SessionSnapshot } from '@/lib/auth';

import { createAutosave } from '../createAutosave';
import { RETRY_SCHEDULE_MS } from '../retrySchedule';

// `createAutosave` hỏi phiên để biết một 401 là tạm (token vừa hết hạn) hay vĩnh
// viễn (đã đăng xuất). `src/lib/auth/**` là mã của F-01b nên nó bị giả ở đây chứ
// không bị sửa.
let session: SessionSnapshot = { roles: [], status: 'authenticated', user: null };

vi.mock('@/lib/auth/state', () => ({
  getSessionSnapshot: (): SessionSnapshot => session,
}));

const REQUEST_ID = 'req_01J8Z0000000000000000000';

const wireError = (status: number, code: string): HttpError => ({
  code,
  kind: 'http',
  raw: ApiErrorBodySchema.parse({ code, requestId: REQUEST_ID }),
  requestId: REQUEST_ID,
  retryable: false,
  status,
});

const authError = (): HttpError => ({
  code: 'UNAUTHENTICATED',
  kind: 'auth',
  raw: ApiErrorBodySchema.parse({ code: 'UNAUTHENTICATED', requestId: REQUEST_ID }),
  requestId: REQUEST_ID,
  retryable: false,
  status: 401,
});

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
    session = { roles: [], status: 'authenticated', user: null };
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

  it.each([400, 403, 404, 409, 413, 422, 428])(
    'gives up at once on a permanent %i, saving exactly once in the first 60s',
    async (status) => {
      const error = wireError(status, 'PERMANENT');
      const save = vi.fn().mockRejectedValue(error);
      const getChanges = vi.fn((): Draft | undefined => ({ text: 'draft' }));
      const autosave = createAutosave<Draft>({ getChanges, isOnline: () => true, save });

      autosave.notifyChange();
      await vi.advanceTimersByTimeAsync(800);

      expect(autosave.getState()).toBe('failed');
      expect(autosave.getLastError()).toBe(error);

      await vi.advanceTimersByTimeAsync(60_000);

      expect(save).toHaveBeenCalledTimes(1);
      expect(autosave.getState()).toBe('failed');
    },
  );

  it.each([
    ['429 rate limited', 429, 'RATE_LIMITED'],
    ['503 idempotency in progress', 503, 'IDEMPOTENCY_IN_PROGRESS'],
  ])('still retries a transient %s at the 5000ms mark', async (_label, status, code) => {
    const save = vi.fn().mockRejectedValue(wireError(status, code));
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
  });

  it('retries a 401 while the session is still authenticated', async () => {
    session = { roles: [], status: 'authenticated', user: null };
    const save = vi.fn().mockRejectedValue(authError());
    const getChanges = vi.fn((): Draft | undefined => ({ text: 'draft' }));
    const autosave = createAutosave<Draft>({ getChanges, isOnline: () => true, save });

    autosave.notifyChange();
    await vi.advanceTimersByTimeAsync(800);
    expect(autosave.getState()).toBe('dirty');

    await vi.advanceTimersByTimeAsync(5_000);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('gives up at once on a 401 when the session is already anonymous', async () => {
    session = { roles: [], status: 'anonymous', user: null };
    const error = authError();
    const save = vi.fn().mockRejectedValue(error);
    const getChanges = vi.fn((): Draft | undefined => ({ text: 'draft' }));
    const autosave = createAutosave<Draft>({ getChanges, isOnline: () => true, save });

    autosave.notifyChange();
    await vi.advanceTimersByTimeAsync(800);

    expect(autosave.getState()).toBe('failed');
    expect(autosave.getLastError()).toBe(error);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('clears the last error once a later save succeeds after a permanent failure', async () => {
    let shouldFail = true;
    const save = vi.fn().mockImplementation(async () => {
      if (shouldFail) {
        throw wireError(422, 'VALIDATION');
      }
    });
    const getChanges = vi.fn((): Draft | undefined => ({ text: 'draft' }));
    const autosave = createAutosave<Draft>({ getChanges, isOnline: () => true, save });

    autosave.notifyChange();
    await vi.advanceTimersByTimeAsync(800);
    expect(autosave.getState()).toBe('failed');
    expect(autosave.getLastError()).toBeDefined();

    shouldFail = false;
    autosave.notifyChange();
    expect(autosave.getState()).toBe('dirty');

    await vi.advanceTimersByTimeAsync(800);

    expect(save).toHaveBeenCalledTimes(2);
    expect(autosave.getState()).toBe('saved');
    expect(autosave.getLastError()).toBeUndefined();
  });

  it('lets the caller inject its own isTransientError rule', async () => {
    const save = vi.fn().mockRejectedValue(new Error('network down'));
    const getChanges = vi.fn((): Draft | undefined => ({ text: 'draft' }));
    const isTransientError = vi.fn().mockReturnValue(false);
    const autosave = createAutosave<Draft>({
      getChanges,
      isOnline: () => true,
      isTransientError,
      save,
    });

    autosave.notifyChange();
    await vi.advanceTimersByTimeAsync(800);

    expect(isTransientError).toHaveBeenCalledTimes(1);
    expect(autosave.getState()).toBe('failed');

    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).toHaveBeenCalledTimes(1);
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
