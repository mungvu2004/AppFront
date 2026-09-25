import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMeasurementNoteId } from '@/domain/measure/measure';
import { millimetres } from '@/domain/units/types';
import type { HttpClient, HttpError, Result } from '@/lib/http';
import type { MeasurementRecord } from '@/types/measurement';

import { measurementKeys } from '../../query/queryKeys';
import { deleteMeasurement, saveMeasurement } from '../measurement';

const ok = <T>(data: T): Result<T, HttpError> => ({ data, ok: true });

const networkError: HttpError = {
  kind: 'network',
  raw: undefined,
  requestId: 'req-1',
  retryable: false,
};

const err = (): Result<never, HttpError> => ({ error: networkError, ok: false });

interface HttpMockOverrides {
  readonly delete?: HttpClient['delete'];
  readonly post?: HttpClient['post'];
}

const createHttpMock = (overrides: HttpMockOverrides = {}): HttpClient => {
  const post = overrides.post ?? ((vi.fn(() => ok(measurement))) as unknown as HttpClient['post']);
  const del = overrides.delete ?? ((vi.fn(() => ok(undefined))) as unknown as HttpClient['delete']);

  return {
    delete: del,
    events: { emit: () => undefined, on: () => () => undefined },
    get: vi.fn() as unknown as HttpClient['get'],
    getRecentRequests: () => [],
    patch: vi.fn() as unknown as HttpClient['patch'],
    post,
    put: vi.fn() as unknown as HttpClient['put'],
  };
};

const projectId = 'project-9';

const measurement: MeasurementRecord = {
  id: createMeasurementNoteId(1),
  mode: 'pointToPoint',
  name: 'Phép đo 1',
  points: [
    { x: millimetres(0), y: millimetres(0) },
    { x: millimetres(3450), y: millimetres(0) },
  ],
  rawValueMm: millimetres(3450),
};

describe('saveMeasurement', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
  });

  it('updates the cache optimistically and keeps it once the server confirms', async () => {
    const http = createHttpMock();
    const options = saveMeasurement({ http, queryClient });

    const result = await options.mutationFn?.({ measurement, projectId });

    expect(result).toEqual(measurement);
    expect(queryClient.getQueryData(measurementKeys.all(projectId))).toEqual([measurement]);
    expect(http.post).toHaveBeenCalledWith(
      expect.stringContaining(projectId),
      expect.objectContaining({ body: measurement }),
    );
  });

  it('overwrites an existing measurement in the cache instead of duplicating it', async () => {
    queryClient.setQueryData(measurementKeys.all(projectId), [measurement]);
    const renamed: MeasurementRecord = { ...measurement, name: 'Phép đo 1 (đổi tên)' };
    const http = createHttpMock({ post: vi.fn(() => ok(renamed)) as unknown as HttpClient['post'] });
    const options = saveMeasurement({ http, queryClient });

    await options.mutationFn?.({ measurement: renamed, projectId });

    expect(queryClient.getQueryData(measurementKeys.all(projectId))).toEqual([renamed]);
  });

  it('reverts the optimistic update when the server call fails', async () => {
    queryClient.setQueryData(measurementKeys.all(projectId), []);
    const http = createHttpMock({ post: vi.fn(() => err()) as unknown as HttpClient['post'] });
    const options = saveMeasurement({ http, queryClient });

    await expect(options.mutationFn?.({ measurement, projectId })).rejects.toMatchObject({
      kind: expect.any(String),
    });

    expect(queryClient.getQueryData(measurementKeys.all(projectId))).toEqual([]);
  });
});

describe('deleteMeasurement', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    queryClient.setQueryData(measurementKeys.all(projectId), [measurement]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('removes the measurement optimistically and returns a usable undo ticket', async () => {
    const http = createHttpMock();
    const options = deleteMeasurement({ http, queryClient });

    const ticket = await options.mutationFn?.({ measurement, projectId });

    expect(queryClient.getQueryData(measurementKeys.all(projectId))).toEqual([]);
    expect(ticket?.getStatus()).toBe('active');

    expect(ticket?.undo()).toEqual({ data: undefined, ok: true });

    await vi.waitFor(() => {
      expect(http.post).toHaveBeenCalledWith(
        expect.stringContaining(projectId),
        expect.objectContaining({ body: measurement }),
      );
    });
    await vi.waitFor(() => {
      expect(queryClient.getQueryData(measurementKeys.all(projectId))).toEqual([measurement]);
    });
  });

  it('reverts the optimistic removal when the server delete fails', async () => {
    const http = createHttpMock({ delete: vi.fn(() => err()) as unknown as HttpClient['delete'] });
    const options = deleteMeasurement({ http, queryClient });

    await expect(options.mutationFn?.({ measurement, projectId })).rejects.toMatchObject({
      kind: expect.any(String),
    });

    expect(queryClient.getQueryData(measurementKeys.all(projectId))).toEqual([measurement]);
  });

  it('an expired ticket never runs the restore action (undo() is a no-op past the window)', async () => {
    vi.useFakeTimers();

    const http = createHttpMock();
    const options = deleteMeasurement({ http, queryClient });

    const ticket = await options.mutationFn?.({ measurement, projectId });

    vi.advanceTimersByTime(8000);

    expect(ticket?.undo()).toEqual({ error: 'expired', ok: false });
    expect(http.post).not.toHaveBeenCalled();
  });
});

describe('deleteMeasurement — undo that meets a taken id', () => {
  const taken: HttpError = {
    code: 'MEASUREMENT_ID_TAKEN',
    kind: 'http',
    raw: { code: 'MEASUREMENT_ID_TAKEN', requestId: 'req-2' },
    requestId: 'req-2',
    retryable: false,
    status: 409,
  };
  const takenResult = (): Result<never, HttpError> => ({ error: taken, ok: false });
  const renumbered: MeasurementRecord = { ...measurement, id: createMeasurementNoteId(2), name: 'Phép đo 2' };

  /** Answers each POST in turn, then repeats the last answer; no type assertion. */
  const queuePost = (...answers: readonly Result<unknown, HttpError>[]) => {
    const spy = vi.fn();
    answers.forEach((answer) => spy.mockResolvedValueOnce(answer));
    spy.mockResolvedValue(answers[answers.length - 1]);
    const post: HttpClient['post'] = (path, options) => spy(path, options);

    return { post, spy };
  };

  const setup = (post: HttpClient['post'], extra: Partial<Parameters<typeof deleteMeasurement>[0]> = {}) => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(measurementKeys.all(projectId), [measurement]);
    const http = createHttpMock({ post });

    return { http, queryClient, options: deleteMeasurement({ http, queryClient, ...extra }) };
  };

  it('resends once under the new id and puts the measurement back with it', async () => {
    const { post, spy } = queuePost(takenResult(), ok(renumbered));
    const resolveUndoConflict = vi.fn(() => Promise.resolve(renumbered));
    const onUndoFailed = vi.fn();
    const { queryClient, options } = setup(post, {
      onUndoFailed,
      resolveUndoConflict,
    });

    const ticket = await options.mutationFn?.({ measurement, projectId });
    ticket?.undo();

    await vi.waitFor(() => {
      expect(queryClient.getQueryData(measurementKeys.all(projectId))).toEqual([renumbered]);
    });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[1]?.[1]).toMatchObject({ body: renumbered });
    expect(resolveUndoConflict).toHaveBeenCalledWith(projectId, measurement);
    expect(onUndoFailed).not.toHaveBeenCalled();
  });

  it('reports the ORIGINAL error when the second attempt fails differently', async () => {
    const limit: HttpError = { ...taken, code: 'MEASUREMENT_LIMIT_REACHED', status: 422 };
    const { post, spy } = queuePost(takenResult(), { error: limit, ok: false });
    const onUndoFailed = vi.fn();
    const { options } = setup(post, {
      onUndoFailed,
      resolveUndoConflict: () => Promise.resolve(renumbered),
    });

    const ticket = await options.mutationFn?.({ measurement, projectId });
    ticket?.undo();

    await vi.waitFor(() => {
      expect(onUndoFailed).toHaveBeenCalledTimes(1);
    });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(onUndoFailed.mock.calls[0]?.[0]).toBe(taken);
  });

  it('sends a 409 straight to onUndoFailed when nothing resolves conflicts', async () => {
    const { post, spy } = queuePost(takenResult());
    const onUndoFailed = vi.fn();
    const { options } = setup(post, { onUndoFailed });

    const ticket = await options.mutationFn?.({ measurement, projectId });
    ticket?.undo();

    await vi.waitFor(() => {
      expect(onUndoFailed).toHaveBeenCalledTimes(1);
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('reports a server error on undo without a retry', async () => {
    const { post } = queuePost(err());
    const onUndoFailed = vi.fn();
    const resolveUndoConflict = vi.fn();
    const { options } = setup(post, { onUndoFailed, resolveUndoConflict });

    const ticket = await options.mutationFn?.({ measurement, projectId });
    ticket?.undo();

    await vi.waitFor(() => {
      expect(onUndoFailed).toHaveBeenCalledTimes(1);
    });
    expect(resolveUndoConflict).not.toHaveBeenCalled();
  });
});
