import type { QueryClient } from '@tanstack/react-query';

import { measurementKeys, queryKeys, type QueryKey } from './queryKeys';

export const WRITE_OPERATIONS = [
  'createProject',
  'editFloor',
  'editWall',
  'editOpening',
  'editRoom',
  'moveFurniture',
  'editDimension',
  'changeAxis',
  'rerunRules',
  'restoreVersion',
  'straightenDrawing',
  'setDrawingCorners',
  'persistSpatialLayer',
  'createPropertyTemplate',
  'saveMeasurement',
  'deleteMeasurement',
  'inviteUsers',
  'changeUserRole',
  'setUserEnabled',
  'removeUser',
  'resendInvite',
] as const;

export type WriteOperation = (typeof WRITE_OPERATIONS)[number];

interface FloorScopedParams {
  projectId: string;
  floorId: string;
}

interface ProjectScopedParams {
  projectId: string;
}

/**
 * Một lượt ghi đụng đúng MỘT người — T-04/T-05.
 *
 * Không có `projectId`: bảng người dùng là toàn cục (`ENDPOINTS.users` là đường
 * toàn cục, không lồng dưới `/projects`), nên phạm vi hẹp nhất mà một lượt đổi
 * vai hay vô hiệu làm cũ đi là chính người ấy cộng danh sách chứa họ.
 */
interface UserScopedParams {
  userId: string;
}

export interface WriteOperationParamsMap {
  createProject: Record<string, never>;
  editFloor: FloorScopedParams;
  editWall: FloorScopedParams;
  editOpening: FloorScopedParams;
  editRoom: FloorScopedParams;
  moveFurniture: FloorScopedParams;
  editDimension: FloorScopedParams;
  changeAxis: FloorScopedParams;
  rerunRules: FloorScopedParams;
  restoreVersion: FloorScopedParams;
  straightenDrawing: FloorScopedParams;
  setDrawingCorners: FloorScopedParams;
  /** A floor's whole spatial layer was just saved to the server (U4 gap #4) — same three read models as a single `editWall`, since any of the four entity lists could have changed. */
  persistSpatialLayer: FloorScopedParams;
  /** A property template was created (U4 gap #5) — project-scoped, not floor-scoped, since a template outlives any one floor. */
  createPropertyTemplate: ProjectScopedParams;
  /** A measurement was pinned and saved to the project record (LG-3) — project-scoped: a pinned measurement belongs to the project, not to any one floor. */
  saveMeasurement: ProjectScopedParams;
  /** A measurement was deleted from the project record (LG-3) — same scope as `saveMeasurement`. */
  deleteMeasurement: ProjectScopedParams;
  /** Lời mời vừa gửi cho một hoặc nhiều địa chỉ (T-05) — chưa người nào tồn tại để khoá theo, nên không tham số. */
  inviteUsers: Record<string, never>;
  /** Vai của một người vừa đổi (T-05). */
  changeUserRole: UserScopedParams;
  /** Một người vừa bị vô hiệu hoặc được bật lại (T-05) — hai đường API, cùng một hệ quả cache. */
  setUserEnabled: UserScopedParams;
  /** Một người vừa bị xoá hẳn (T-05). */
  removeUser: UserScopedParams;
  /** Lời mời vừa được gửi lại (T-05) — `inviteExpiresAt` đổi, nên dòng trong danh sách cũ đi. */
  resendInvite: Record<string, never>;
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

  /** Same three keys as `editWall`: an opening lives on a wall, and its edit can trip the same room/violation reads. */
  editOpening: ({ projectId, floorId }) => [
    queryKeys.space.byFloor(floorId),
    queryKeys.room.byFloor(floorId),
    queryKeys.violation.byProject(projectId),
  ],

  /** Same three keys as `editWall` — a room's own fields (name, usage) are read through the same `room.byFloor`/`violation.byProject` models. */
  editRoom: ({ projectId, floorId }) => [
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

  /** Same three keys as `editWall`: a full-layer save can change walls, openings, rooms or furniture at once. */
  persistSpatialLayer: ({ projectId, floorId }) => [
    queryKeys.space.byFloor(floorId),
    queryKeys.room.byFloor(floorId),
    queryKeys.violation.byProject(projectId),
  ],

  createPropertyTemplate: ({ projectId }) => [queryKeys.template.byProject(projectId)],

  /** Same key for both — a save and a delete change the exact same list (LG-3). */
  saveMeasurement: ({ projectId }) => [measurementKeys.all(projectId)],
  deleteMeasurement: ({ projectId }) => [measurementKeys.all(projectId)],

  /**
   * Năm lượt ghi của phần quản trị người dùng — T-05.
   *
   * Cả năm đều làm cũ `user.list()`: một dòng thêm vào, đổi vai, đổi trạng thái
   * hay biến mất đều là cùng một bảng đang hiện sai. Ba lượt khoá theo `userId`
   * thêm `user.memberships(userId)` vì vai TRONG dự án đọc từ chính lượt ghi ấy;
   * `user.activity(userId)` KHÔNG có trong ba danh sách đó — nhật ký là chuyện
   * đã xảy ra, và đổi vai hôm nay không viết lại việc người ta làm hôm qua.
   * `removeUser` là ngoại lệ đúng một chỗ: người không còn thì lượt đọc nhật ký
   * của họ cũng không còn nghĩa, nên nó đi cùng.
   *
   * `inviteUsers` và `resendInvite` không nhận tham số: lời mời chưa gắn với một
   * `userId` mà nơi gọi đang giữ, nên thứ duy nhất chúng làm cũ là danh sách.
   */
  inviteUsers: () => [queryKeys.user.list()],

  changeUserRole: ({ userId }) => [queryKeys.user.list(), queryKeys.user.memberships(userId)],

  setUserEnabled: ({ userId }) => [queryKeys.user.list(), queryKeys.user.memberships(userId)],

  removeUser: ({ userId }) => [
    queryKeys.user.list(),
    queryKeys.user.memberships(userId),
    queryKeys.user.activity(userId),
  ],

  resendInvite: () => [queryKeys.user.list()],
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
