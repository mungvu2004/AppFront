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
  'straightenDrawing',
  'setDrawingCorners',
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
  straightenDrawing: FloorScopedParams;
  setDrawingCorners: FloorScopedParams;
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

  /**
   * Nắn ảnh và cắt lại bốn góc đổi cùng hai thứ, nên chúng làm mất hiệu lực
   * cùng hai khoá.
   *
   * Phép đo là thứ hiển nhiên: cả hai thao tác chạy lại nó. Bản vẽ thì kém hiển
   * nhiên hơn — nhưng nắn xong thì đúng những pixel mà `drawing.byFloor` đang
   * giữ đã xoay đi, và cắt lại khung thì chúng đã bị xén; giữ lại bản cũ nghĩa
   * là màn kế tiếp vẽ một tấm ảnh không còn tồn tại. Không đụng tới
   * `space`/`room`/`violation`: chưa bước dò nào chạy trên ảnh mới, nên các mô
   * hình đó vẫn đúng như trước, và làm mất hiệu lực chúng chỉ tốn một lượt gọi
   * trả về đúng dữ liệu vừa vứt đi.
   */
  straightenDrawing: ({ floorId }) => [
    queryKeys.quality.assessment(floorId),
    queryKeys.drawing.byFloor(floorId),
  ],

  setDrawingCorners: ({ floorId }) => [
    queryKeys.quality.assessment(floorId),
    queryKeys.drawing.byFloor(floorId),
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
