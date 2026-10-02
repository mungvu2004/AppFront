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
