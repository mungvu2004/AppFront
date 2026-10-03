import type { SpatialApi, SpatialLayer } from '@/api/client';
import { idsOnLevel, isEntityOfKind, type NormalizedSpatial } from '@/domain/spatial/normalize';
import type { Furniture, LevelId, Opening, Room, Wall } from '@/domain/spatial/types';

/**
 * What one autosave cycle of a floor's spatial layer needs to send: the
 * whole four-list write `WriteSpatialLayerInput` (`@/api/client`) expects,
 * per its own docblock — "the autosave flush of everything on this floor
 * right now", not a per-field patch.
 */
export interface SpatialLayerChanges {
  readonly floorId: string;
  readonly projectId: string;
  readonly layer: SpatialLayer;
  /** `revision` mà lớp này dựa trên — #35 là `PUT` có version (B-G-07). */
  readonly baseVersion: number;
}

/**
 * `Error` mang `HttpError` gốc ở `cause` — `isTransientWireError` đọc `cause`, nên
 * 409/422 dừng ngay còn rớt mạng thì thử lại. (`new Error(msg, { cause })` cần lib
 * ES2022 mà `tsconfig` chưa bật.)
 */
const failure = (message: string, cause: { readonly kind: string }): Error =>
  Object.assign(new Error(`${message} (${cause.kind})`), { cause });

/**
 * Wraps U4's `SpatialApi.writeLayer` (walls/openings/rooms/furniture, added
 * in `feat(api): endpoint luu lop khong gian`) as a `createAutosave`-shaped
 * `save` callback — resolves on a successful write, throws on failure so `createAutosave`'s own retry schedule
 * (`retrySchedule.ts`: 5s/15s/45s) and offline detection take over. The
 * `HttpError` rides along as `cause`, so `isTransientWireError` still tells a
 * 409/422 (stop) from a dropped connection (retry). No retry logic lives in
 * this file; duplicating it here would be the second independent retry
 * mechanism this task exists to remove.
 */
export function createSpatialLayerSave(
  spatialApi: Pick<SpatialApi, 'writeLayer'>,
): (changes: SpatialLayerChanges) => Promise<void> {
  return async (changes) => {
    const result = await spatialApi.writeLayer({
      baseVersion: changes.baseVersion,
      body: changes.layer,
      floorId: changes.floorId,
      projectId: changes.projectId,
    });

    if (!result.ok) {
      throw failure('Không lưu được lớp không gian', result.error);
    }
  };
}

/**
 * Bốn danh sách thực thể của MỘT tầng, đúng hình dạng `SpatialLayer` mà
 * `SpatialApi.writeLayer` nhận.
 *
 * Lọc theo tầng chứ không gửi cả toà nhà: `writeLayer` khoá theo
 * `projects/:id/floors/:floorId/spatial/layer`, nên gửi kèm tường của tầng
 * khác là ghi dữ liệu của tầng đó vào đường dẫn của tầng này. `idsOnLevel` là
 * chỉ mục `byLevel` mà `normalizeSpatial` đã dựng sẵn — không một phép duyệt
 * hình học nào ở đây, chỉ đọc id.
 */
export function spatialLayerOf(graph: NormalizedSpatial, floorId: LevelId): SpatialLayer {
  const furniture: Furniture[] = [];
  const openings: Opening[] = [];
  const rooms: Room[] = [];
  const walls: Wall[] = [];

  for (const id of idsOnLevel(graph, floorId)) {
    const entity = graph.byId[id];

    if (entity === undefined) {
      continue;
    }

    if (isEntityOfKind('wall', entity)) {
      walls.push(entity);
    } else if (isEntityOfKind('opening', entity)) {
      openings.push(entity);
    } else if (isEntityOfKind('room', entity)) {
      rooms.push(entity);
    } else if (isEntityOfKind('furniture', entity)) {
      furniture.push(entity);
    }
  }

  return { furniture, openings, rooms, walls };
}

/** Một lượt tự lưu của màn QC: đồ thị trong kho, và tầng mà URL của màn trỏ tới. */
export interface FloorLayerGraphChanges {
  readonly floorId: string;
  readonly projectId: string;
  readonly graph: NormalizedSpatial;
}

/**
 * `save` của tự lưu cho mọi màn QC sửa lớp tầng (tường, ô mở, phòng, nội thất) —
 * B-V6-03. Trước đây mỗi cổng trả `unsupported` nên màn nói "Có thay đổi chưa lưu"
 * mãi; #35 (B-G-07) nay nhận đúng bốn danh sách ấy.
 *
 * Giữ `revision` theo tầng làm `baseVersion` của lượt sau; lượt đầu đọc N16 một lần.
 * ponytail: lượt đầu lấy revision MỚI NHẤT nên không thấy một lượt sửa của người khác
 * xảy ra giữa lúc màn nạp và lúc lưu (cùng trần với `propertyInspectorGateway.ts`);
 * muốn chặn thì cổng phải giữ revision của chính lượt đọc mà màn dựa vào.
 *
 * Kho chỉ giữ MỘT đồ thị, có khi là đồ thị của tầng khác hay bộ mẫu bơm vào. Đồ thị
 * không có tầng của URL thì KHÔNG ghi: `spatialLayerOf` sẽ ra bốn danh sách rỗng, và
 * một `PUT` rỗng là xoá sạch tầng ấy trên máy chủ.
 */
export function createFloorLayerSave(
  spatialApi: Pick<SpatialApi, 'readLayer' | 'writeLayer'>,
): (changes: FloorLayerGraphChanges) => Promise<void> {
  const revisions = new Map<string, number>();

  return async ({ floorId, graph, projectId }) => {
    const levelId = floorId as LevelId;

    if (!graph.byKind.level.includes(levelId)) {
      throw new Error(`Đồ thị đang sửa không có tầng ${floorId} — không ghi đè lớp của tầng ấy.`);
    }

    let baseVersion = revisions.get(floorId);

    if (baseVersion === undefined) {
      const read = await spatialApi.readLayer({ floorId, projectId });

      if (!read.ok) {
        throw failure('Không đọc được revision của tầng', read.error);
      }

      baseVersion = read.data.revision;
    }

    const result = await spatialApi.writeLayer({
      baseVersion,
      body: spatialLayerOf(graph, levelId),
      floorId,
      projectId,
    });

    if (!result.ok) {
      throw failure('Không lưu được lớp không gian', result.error);
    }

    revisions.set(floorId, result.data.revision);
  };
}
