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

  it('appends persistFloorScale at the end and scopes it to drawing, floor, graph and that floor layer', () => {
    expect(WRITE_OPERATIONS[WRITE_OPERATIONS.length - 1]).toBe('persistFloorScale');
    expect(invalidationMap.persistFloorScale({ floorId, projectId })).toEqual([
      queryKeys.drawing.byFloor(floorId),
      queryKeys.floor.detail(floorId),
      queryKeys.layer.graph(projectId),
      queryKeys.layer.byFloor(projectId, floorId),
    ]);
  });

  it('makes the floor layer stale on editFloor, but not on persistSpatialLayer (own save, R14)', () => {
    expect(invalidationMap.editFloor({ floorId, projectId })).toEqual([
      queryKeys.floor.detail(floorId),
      queryKeys.floor.list(projectId),
      queryKeys.layer.byFloor(projectId, floorId),
    ]);
    expect(invalidationMap.persistSpatialLayer({ floorId, projectId })).not.toContainEqual(
      queryKeys.layer.byFloor(projectId, floorId),
    );
  });

  it('is pure data: same input always returns equal keys, no side effects', () => {
    const params = { floorId, projectId };

    expect(invalidationMap.editWall(params)).toEqual(invalidationMap.editWall(params));
  });

  it('scopes createProject to the project list and the dashboard summaries', () => {
    expect(invalidationMap.createProject({})).toEqual([queryKeys.project.list(), queryKeys.project.summaries()]);
  });

  it('scopes renameProject and deleteProject to summaries, list and that project detail', () => {
    const expected = [queryKeys.project.summaries(), queryKeys.project.list(), queryKeys.project.detail(projectId)];

    expect(invalidationMap.renameProject({ projectId })).toEqual(expected);
    expect(invalidationMap.deleteProject({ projectId })).toEqual(expected);
  });

  it('invalidates detail, members and summaries for addProjectMember and removeProjectMember', () => {
    const expected = [
      queryKeys.project.detail(projectId),
      queryKeys.project.members(projectId),
      queryKeys.project.summaries(),
    ];

    expect(invalidationMap.addProjectMember({ projectId })).toEqual(expected);
    expect(invalidationMap.removeProjectMember({ projectId })).toEqual(expected);
  });

  it("scopes activateModelVersion to the family list and that family's versions only", () => {
    expect(invalidationMap.activateModelVersion({ family: 'wallSegmentation' })).toEqual([
      queryKeys.adminMl.families(),
      queryKeys.adminMl.versions('wallSegmentation'),
    ]);
  });

  it('scopes createTrainingJob to every filter of the job list', () => {
    expect(invalidationMap.createTrainingJob({})).toEqual([queryKeys.adminMl.jobs.root()]);
  });

  it('scopes cancelTrainingJob to that job and every filter of the job list', () => {
    expect(invalidationMap.cancelTrainingJob({ jobId: 'job_1' })).toEqual([
      queryKeys.adminMl.job('job_1'),
      queryKeys.adminMl.jobs.root(),
    ]);
  });

  it('cancelTrainingJob marks every job filter and that job stale, not another job', () => {
    const queryClient = new QueryClient();

    queryClient.setQueryData(queryKeys.adminMl.jobs({}), { pages: [] });
    queryClient.setQueryData(queryKeys.adminMl.jobs({ status: 'running' }), { pages: [] });
    queryClient.setQueryData(queryKeys.adminMl.job('job_1'), {});
    queryClient.setQueryData(queryKeys.adminMl.job('job_2'), {});

    applyInvalidation(queryClient, 'cancelTrainingJob', { jobId: 'job_1' });

    expect(queryClient.getQueryState(queryKeys.adminMl.jobs({}))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.adminMl.jobs({ status: 'running' }))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.adminMl.job('job_1'))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.adminMl.job('job_2'))?.isInvalidated).toBeFalsy();
  });

  it("leaves another family's versions and every single-version read fresh on activateModelVersion", () => {
    const queryClient = new QueryClient();
    const versionKey = queryKeys.adminMl.version('mdl_01JA0000000000000000000001');

    queryClient.setQueryData(queryKeys.adminMl.families(), { items: [] });
    queryClient.setQueryData(queryKeys.adminMl.versions('wallSegmentation'), { pages: [] });
    queryClient.setQueryData(queryKeys.adminMl.versions('dimensionReading'), { pages: [] });
    queryClient.setQueryData(versionKey, {});
    applyInvalidation(queryClient, 'activateModelVersion', { family: 'wallSegmentation' });

    expect(queryClient.getQueryState(queryKeys.adminMl.families())?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.adminMl.versions('wallSegmentation'))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.adminMl.versions('dimensionReading'))?.isInvalidated).toBeFalsy();
    expect(queryClient.getQueryState(versionKey)?.isInvalidated).toBeFalsy();
  });

  it('marks the summaries query stale through applyInvalidation(renameProject)', () => {
    const queryClient = new QueryClient();

    queryClient.setQueryData(queryKeys.project.summaries(), { items: [] });
    applyInvalidation(queryClient, 'renameProject', { projectId });

    expect(queryClient.getQueryState(queryKeys.project.summaries())?.isInvalidated).toBe(true);
  });

  it('scopes editWall to the space, room, and violation keys of that floor/project', () => {
    expect(invalidationMap.editWall({ floorId, projectId })).toEqual([
      queryKeys.space.byFloor(floorId),
      queryKeys.room.byFloor(floorId),
      queryKeys.violation.byProject(projectId),
    ]);
  });

  it('scopes editOpening to the same three keys as editWall', () => {
    expect(invalidationMap.editOpening({ floorId, projectId })).toEqual(
      invalidationMap.editWall({ floorId, projectId }),
    );
  });

  it('scopes editRoom to the same three keys as editWall', () => {
    expect(invalidationMap.editRoom({ floorId, projectId })).toEqual(
      invalidationMap.editWall({ floorId, projectId }),
    );
  });

  it('scopes persistSpatialLayer to the same three keys as editWall, since a full-layer save can touch any of the four entity lists', () => {
    expect(invalidationMap.persistSpatialLayer({ floorId, projectId })).toEqual(
      invalidationMap.editWall({ floorId, projectId }),
    );
  });

  it('scopes createPropertyTemplate to the template list of that project only', () => {
    expect(invalidationMap.createPropertyTemplate({ projectId })).toEqual([
      queryKeys.template.byProject(projectId),
    ]);
  });

  it('scopes straightenDrawing to the quality reading, the drawing and the pipeline progress of that floor', () => {
    expect(invalidationMap.straightenDrawing({ floorId, projectId })).toEqual([
      queryKeys.quality.assessment(floorId),
      queryKeys.drawing.byFloor(floorId),
      queryKeys.progress.byFloor(floorId),
    ]);
  });

  it('scopes setDrawingCorners to the same three keys as straightenDrawing', () => {
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

  it('scopes markNotificationRead to the notification list only', () => {
    expect(invalidationMap.markNotificationRead({})).toEqual([queryKeys.notification.list()]);
  });

  it('scopes markAllNotificationsRead to the same key as markNotificationRead', () => {
    expect(invalidationMap.markAllNotificationsRead({})).toEqual(invalidationMap.markNotificationRead({}));
  });

  it('carries acceptInvite past the inbox: membership changed, not just a label', () => {
    expect(invalidationMap.acceptInvite({ projectId })).toEqual([
      queryKeys.notification.list(),
      queryKeys.project.members(projectId),
      queryKeys.user.memberships.root(),
    ]);
  });

  it('does not reduce acceptInvite to the two mark-read operations', () => {
    expect(invalidationMap.acceptInvite({ projectId })).not.toEqual(
      invalidationMap.markNotificationRead({}),
    );
  });

  it('invalidates every membership entry this browser holds, not one named user', () => {
    const keys = invalidationMap.acceptInvite({ projectId });

    // Người vừa đổi tư cách là người đang đăng nhập, và bảng này là dữ liệu
    // thuần — nó không đọc phiên. Tiền tố phủ đúng những mục đang giữ.
    expect(keys).toContainEqual(['user', 'memberships']);
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
    queryClient.setQueryData(queryKeys.notification.list(), []);
  });

  it('invalidates the notification list on markNotificationRead', () => {
    applyInvalidation(queryClient, 'markNotificationRead', {});

    expect(queryClient.getQueryState(queryKeys.notification.list())?.isInvalidated).toBe(true);
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

  it('invalidates space, room, and violation keys of the edited floor on editOpening', () => {
    applyInvalidation(queryClient, 'editOpening', { floorId, projectId });

    expect(queryClient.getQueryState(queryKeys.space.byFloor(floorId))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.room.byFloor(floorId))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.violation.byProject(projectId))?.isInvalidated).toBe(true);
  });

  it('invalidates space, room, and violation keys of the edited floor on editRoom', () => {
    applyInvalidation(queryClient, 'editRoom', { floorId, projectId });

    expect(queryClient.getQueryState(queryKeys.space.byFloor(floorId))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.room.byFloor(floorId))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.violation.byProject(projectId))?.isInvalidated).toBe(true);
  });

  it('invalidates space, room, and violation keys of the saved floor on persistSpatialLayer', () => {
    applyInvalidation(queryClient, 'persistSpatialLayer', { floorId, projectId });

    expect(queryClient.getQueryState(queryKeys.space.byFloor(floorId))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.room.byFloor(floorId))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.violation.byProject(projectId))?.isInvalidated).toBe(true);
  });

  it('does not invalidate another floor on editOpening, editRoom, or persistSpatialLayer', () => {
    applyInvalidation(queryClient, 'editOpening', { floorId, projectId });
    applyInvalidation(queryClient, 'editRoom', { floorId, projectId });
    applyInvalidation(queryClient, 'persistSpatialLayer', { floorId, projectId });

    expect(queryClient.getQueryState(queryKeys.space.byFloor(otherFloorId))?.isInvalidated).toBeFalsy();
    expect(queryClient.getQueryState(queryKeys.room.byFloor(otherFloorId))?.isInvalidated).toBeFalsy();
  });

  it('invalidates only the template list of the given project on createPropertyTemplate', () => {
    queryClient.setQueryData(queryKeys.template.byProject(projectId), []);

    applyInvalidation(queryClient, 'createPropertyTemplate', { projectId });

    expect(queryClient.getQueryState(queryKeys.template.byProject(projectId))?.isInvalidated).toBe(true);
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
