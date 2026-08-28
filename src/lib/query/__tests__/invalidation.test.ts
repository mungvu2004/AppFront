import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { applyInvalidation, invalidationMap, WRITE_OPERATIONS } from '../invalidation';
import { prefetchOnHover } from '../prefetch';
import { queryKeys } from '../queryKeys';

const projectId = 'project-48';
const floorId = 'floor-21';
const otherFloorId = 'floor-99';

describe('invalidationMap', () => {
  it('lists every write operation', () => {
    expect(Object.keys(invalidationMap).sort()).toEqual([...WRITE_OPERATIONS].sort());
  });

  it('is pure data: same input always returns equal keys, no side effects', () => {
    const params = { floorId, projectId };

    expect(invalidationMap.editWall(params)).toEqual(invalidationMap.editWall(params));
  });

  it('scopes createProject to the project list only', () => {
    expect(invalidationMap.createProject({})).toEqual([queryKeys.project.list()]);
  });

  it('scopes editWall to the space, room, and violation keys of that floor/project', () => {
    expect(invalidationMap.editWall({ floorId, projectId })).toEqual([
      queryKeys.space.byFloor(floorId),
      queryKeys.room.byFloor(floorId),
      queryKeys.violation.byProject(projectId),
    ]);
  });

  it('scopes straightenDrawing to the quality reading and the drawing of that floor', () => {
    expect(invalidationMap.straightenDrawing({ floorId, projectId })).toEqual([
      queryKeys.quality.assessment(floorId),
      queryKeys.drawing.byFloor(floorId),
    ]);
  });

  it('scopes setDrawingCorners to the same two keys as straightenDrawing', () => {
    expect(invalidationMap.setDrawingCorners({ floorId, projectId })).toEqual(
      invalidationMap.straightenDrawing({ floorId, projectId }),
    );
  });

  it('leaves the detection read models alone after a straighten, since no detection has re-run', () => {
    const keys = invalidationMap.straightenDrawing({ floorId, projectId });

    expect(keys).not.toContainEqual(queryKeys.space.byFloor(floorId));
    expect(keys).not.toContainEqual(queryKeys.room.byFloor(floorId));
    expect(keys).not.toContainEqual(queryKeys.violation.byProject(projectId));
  });

  it('scopes restoreVersion to every read model of that floor/project', () => {
    expect(invalidationMap.restoreVersion({ floorId, projectId })).toEqual([
      queryKeys.floor.detail(floorId),
      queryKeys.drawing.byFloor(floorId),
      queryKeys.space.byFloor(floorId),
      queryKeys.room.byFloor(floorId),
      queryKeys.violation.byProject(projectId),
      queryKeys.version.byFloor(floorId),
    ]);
  });
});

describe('applyInvalidation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();

    queryClient.setQueryData(queryKeys.space.byFloor(floorId), { walls: [] });
    queryClient.setQueryData(queryKeys.room.byFloor(floorId), { rooms: [] });
    queryClient.setQueryData(queryKeys.violation.byProject(projectId), { violations: [] });
    queryClient.setQueryData(queryKeys.space.byFloor(otherFloorId), { walls: [] });
    queryClient.setQueryData(queryKeys.room.byFloor(otherFloorId), { rooms: [] });
    queryClient.setQueryData(queryKeys.quality.assessment(floorId), { floors: [] });
    queryClient.setQueryData(queryKeys.quality.assessment(otherFloorId), { floors: [] });
  });

  it('invalidates the quality reading of the straightened floor only', () => {
    applyInvalidation(queryClient, 'straightenDrawing', { floorId, projectId });

    expect(queryClient.getQueryState(queryKeys.quality.assessment(floorId))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.quality.assessment(otherFloorId))?.isInvalidated).toBeFalsy();
  });

  it('invalidates the quality reading after the four corners are set by hand', () => {
    applyInvalidation(queryClient, 'setDrawingCorners', { floorId, projectId });

    expect(queryClient.getQueryState(queryKeys.quality.assessment(floorId))?.isInvalidated).toBe(true);
  });

  it('invalidates space, room, and violation keys of the edited floor on editWall', () => {
    applyInvalidation(queryClient, 'editWall', { floorId, projectId });

    expect(queryClient.getQueryState(queryKeys.space.byFloor(floorId))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.room.byFloor(floorId))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.violation.byProject(projectId))?.isInvalidated).toBe(true);
  });

  it('does not invalidate another floor on editWall', () => {
    applyInvalidation(queryClient, 'editWall', { floorId, projectId });

    expect(queryClient.getQueryState(queryKeys.space.byFloor(otherFloorId))?.isInvalidated).toBeFalsy();
    expect(queryClient.getQueryState(queryKeys.room.byFloor(otherFloorId))?.isInvalidated).toBeFalsy();
  });

  it('never calls invalidateQueries without a queryKey', () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    for (const operation of WRITE_OPERATIONS) {
      applyInvalidation(queryClient, operation, { floorId, projectId });
    }

    expect(invalidateQueriesSpy).toHaveBeenCalled();
    for (const [filters] of invalidateQueriesSpy.mock.calls) {
      expect(filters).toMatchObject({ queryKey: expect.any(Array) });
    }
  });
});

describe('prefetchOnHover', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('prefetches once the pointer stays past the delay and no data is cached', async () => {
    const fetcher = vi.fn().mockResolvedValue('fetched');
    const key = queryKeys.floor.detail(floorId);
    const { onPointerEnter } = prefetchOnHover(queryClient, key, fetcher, 200);

    onPointerEnter();
    await vi.advanceTimersByTimeAsync(200);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not prefetch when the pointer leaves before the delay elapses', async () => {
    const fetcher = vi.fn().mockResolvedValue('fetched');
    const key = queryKeys.floor.detail(floorId);
    const { onPointerEnter, onPointerLeave } = prefetchOnHover(queryClient, key, fetcher, 200);

    onPointerEnter();
    await vi.advanceTimersByTimeAsync(100);
    onPointerLeave();
    await vi.advanceTimersByTimeAsync(200);

    expect(fetcher).not.toHaveBeenCalled();
  });

  it('skips the fetch when data is already in the cache', async () => {
    const key = queryKeys.floor.detail(floorId);
    queryClient.setQueryData(key, { id: floorId });
    const fetcher = vi.fn().mockResolvedValue('fetched');
    const { onPointerEnter } = prefetchOnHover(queryClient, key, fetcher, 200);

    onPointerEnter();
    await vi.advanceTimersByTimeAsync(200);

    expect(fetcher).not.toHaveBeenCalled();
  });

  it('cancels the pending timer on pointer leave so a later leave call is a no-op', async () => {
    const fetcher = vi.fn().mockResolvedValue('fetched');
    const key = queryKeys.floor.detail(floorId);
    const { onPointerLeave } = prefetchOnHover(queryClient, key, fetcher, 200);

    expect(() => onPointerLeave()).not.toThrow();
    await vi.advanceTimersByTimeAsync(200);

    expect(fetcher).not.toHaveBeenCalled();
  });
});
