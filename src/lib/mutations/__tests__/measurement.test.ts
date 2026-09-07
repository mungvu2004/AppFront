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
