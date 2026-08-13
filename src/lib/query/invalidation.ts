import type { QueryClient } from '@tanstack/react-query';

import { queryKeys, type QueryKey } from './queryKeys';

export const WRITE_OPERATIONS = [
  'createProject',
  'editFloor',
  'editWall',
  'moveFurniture',
  'editDimension',
  'changeAxis',
  'rerunRules',
  'restoreVersion',
] as const;

export type WriteOperation = (typeof WRITE_OPERATIONS)[number];

interface FloorScopedParams {
  projectId: string;
  floorId: string;
}

export interface WriteOperationParamsMap {
  createProject: Record<string, never>;
  editFloor: FloorScopedParams;
  editWall: FloorScopedParams;
  moveFurniture: FloorScopedParams;
  editDimension: FloorScopedParams;
  changeAxis: FloorScopedParams;
  rerunRules: FloorScopedParams;
  restoreVersion: FloorScopedParams;
}

type InvalidationMap = {
  [TOperation in WriteOperation]: (
    params: WriteOperationParamsMap[TOperation],
  ) => readonly QueryKey[];
};

/**
 * Pure data: for each write operation, the exact query keys it makes stale.
 * No wildcard/no-argument entries — every key is scoped to the ids that changed.
 */
export const invalidationMap: InvalidationMap = {
  createProject: () => [queryKeys.project.list()],

  editFloor: ({ projectId, floorId }) => [
    queryKeys.floor.detail(floorId),
    queryKeys.floor.list(projectId),
  ],

  editWall: ({ projectId, floorId }) => [
    queryKeys.space.byFloor(floorId),
    queryKeys.room.byFloor(floorId),
    queryKeys.violation.byProject(projectId),
  ],

  moveFurniture: ({ projectId, floorId }) => [
    queryKeys.drawing.byFloor(floorId),
    queryKeys.space.byFloor(floorId),
    queryKeys.violation.byProject(projectId),
  ],

  editDimension: ({ projectId, floorId }) => [
    queryKeys.space.byFloor(floorId),
    queryKeys.room.byFloor(floorId),
    queryKeys.violation.byProject(projectId),
  ],

  changeAxis: ({ projectId, floorId }) => [
    queryKeys.drawing.byFloor(floorId),
    queryKeys.space.byFloor(floorId),
    queryKeys.room.byFloor(floorId),
    queryKeys.violation.byProject(projectId),
  ],

  rerunRules: ({ projectId, floorId }) => [
    queryKeys.violation.byProject(projectId),
    queryKeys.progress.byFloor(floorId),
  ],

  restoreVersion: ({ projectId, floorId }) => [
    queryKeys.floor.detail(floorId),
    queryKeys.drawing.byFloor(floorId),
    queryKeys.space.byFloor(floorId),
    queryKeys.room.byFloor(floorId),
    queryKeys.violation.byProject(projectId),
    queryKeys.version.byFloor(floorId),
  ],
};

/**
 * Invalidates exactly the query keys `invalidationMap` lists for `operation`.
 * Never calls invalidateQueries without a queryKey.
 */
export function applyInvalidation<TOperation extends WriteOperation>(
  queryClient: QueryClient,
  operation: TOperation,
  params: WriteOperationParamsMap[TOperation],
): void {
  const resolveKeys = invalidationMap[operation];

  for (const queryKey of resolveKeys(params)) {
    queryClient.invalidateQueries({ queryKey });
  }
}
