import { normalizeSpatial, type NormalizedSpatial } from '@/domain/spatial/normalize';
import type { Building, SpatialGraph } from '@/domain/spatial/types';

import type { SpatialApi } from './client';
import type { FloorLayerDocument } from './schemas/spatialLayer';

/**
 * Đường nạp thật của màn QC: N16 (`GET …/floors/{floorId}/spatial/layer`) →
 * `NormalizedSpatial` mà kho `spatial` giữ — B-V6-01.
 *
 * Trước tệp này, cổng mặc định của màn QC đọc lại chính cái kho
 * (`read: () => useStore.getState().spatial`): kho rỗng thì `null` mãi, nên màn
 * treo skeleton vĩnh viễn và không có đường nào đưa dữ liệu vào.
 */

/**
 * Toà nhà của một đồ thị MỘT tầng.
 *
 * N16 nói về một tầng và không mang `building` — thứ ấy ở N15. `SpatialGraph`
 * thì bắt buộc có, nên đây là chỗ đứng chứ không phải dữ liệu: không màn QC nào
 * đọc toà nhà. Nguồn `human` + đã duyệt vì nó không phải đầu ra của AI (A5).
 */
export const FLOOR_LAYER_BUILDING: Building = Object.freeze({
  confidence: 1,
  datumElevationMm: 0,
  name: '',
  reviewed: true,
  source: 'human',
});

/** Tài liệu tầng N16 thành đồ thị một tầng. */
export const floorLayerToGraph = (document: FloorLayerDocument): SpatialGraph => ({
  axes: document.axes,
  building: FLOOR_LAYER_BUILDING,
  dimensions: document.dimensions,
  furniture: document.layer.furniture,
  levels: [document.level],
  notes: [],
  openings: document.layer.openings,
  rooms: document.layer.rooms,
  walls: document.layer.walls,
});

export interface ReadFloorLayerGraphInput {
  readonly floorId: string;
  readonly projectId: string;
  readonly signal?: AbortSignal | undefined;
}

/**
 * Đọc lớp một tầng và trả về dạng kho. Lỗi thì NÉM — đó là cách `useQuery` của
 * màn đi vào trạng thái `error` của A11, thay vì `loading` mãi.
 */
export async function readFloorLayerGraph(
  spatialApi: Pick<SpatialApi, 'readLayer'>,
  { floorId, projectId, signal }: ReadFloorLayerGraphInput,
): Promise<NormalizedSpatial> {
  const result = await spatialApi.readLayer(
    signal === undefined ? { floorId, projectId } : { floorId, projectId, signal },
  );

  if (!result.ok) {
    throw result.error;
  }

  return normalizeSpatial(floorLayerToGraph(result.data));
}

export interface ReadProjectLayerGraphInput {
  readonly floorIds: readonly string[];
  readonly projectId: string;
  readonly signal?: AbortSignal | undefined;
}

/**
 * Đồ thị của MỌI tầng trong dự án — thứ màn quản lý tầng vẽ (cao độ, số tường,
 * số phòng, diện tích theo tầng). Không có endpoint cả dự án, nên đọc N16 của
 * từng tầng rồi ghép. Một tầng hỏng thì cả lượt NÉM (A11 `error`), không vẽ nửa
 * dự án như thể đó là tất cả.
 *
 * ponytail: một lượt N16 cho mỗi tầng (trần `PROJECT_LIMITS.floorCountMax`); có
 * endpoint cả dự án thì thay đúng hàm này.
 */
export async function readProjectLayerGraph(
  spatialApi: Pick<SpatialApi, 'readLayer'>,
  { floorIds, projectId, signal }: ReadProjectLayerGraphInput,
): Promise<NormalizedSpatial> {
  const graphs = await Promise.all(
    floorIds.map(async (floorId) => {
      const result = await spatialApi.readLayer(
        signal === undefined ? { floorId, projectId } : { floorId, projectId, signal },
      );

      if (!result.ok) {
        throw result.error;
      }

      return floorLayerToGraph(result.data);
    }),
  );

  return normalizeSpatial({
    axes: graphs.flatMap((graph) => graph.axes),
    building: FLOOR_LAYER_BUILDING,
    dimensions: graphs.flatMap((graph) => graph.dimensions),
    furniture: graphs.flatMap((graph) => graph.furniture),
    levels: graphs.flatMap((graph) => graph.levels),
    notes: [],
    openings: graphs.flatMap((graph) => graph.openings),
    rooms: graphs.flatMap((graph) => graph.rooms),
    walls: graphs.flatMap((graph) => graph.walls),
  });
}
