import type { FloorLayerDocument } from '@/api/schemas/spatialLayer';
import { isEntityOfKind, type NormalizedSpatial } from '@/domain/spatial/normalize';

/** Hình dây của 404 `resource:"floor"` — đúng thứ `readWireError` đọc. */
const floorNotFound = (): unknown => ({
  kind: 'notFound',
  raw: { resource: 'floor' },
  requestId: 'mock',
  retryable: false,
  status: 404,
});

/**
 * N16 giả dựng từ đồ thị bộ mẫu, revision 0. Bộ mẫu chưa có đồ thị → lượt đọc treo
 * (màn ở `loading`, như trước khi có N16); tầng vắng trong đồ thị → 404 tầng, như
 * máy chủ thật. `spatialLayerOf` nạp lười: module của nó kéo zod, mà cổng này nằm
 * trong gói sản phẩm (ngân sách "một màn").
 */
export async function mockFloorLayerDocument(
  graph: NormalizedSpatial | null,
  floorId: string,
  scaleStatus?: 'unresolved',
): Promise<FloorLayerDocument> {
  if (graph === null) {
    return new Promise<never>(() => undefined);
  }

  const level = graph.byId[floorId];

  if (level === undefined || !isEntityOfKind('level', level)) {
    throw floorNotFound();
  }

  const { spatialLayerOf } = await import('@/lib/autosave/spatialLayerSave');

  return {
    axes: [],
    dimensions: [],
    layer: spatialLayerOf(graph, level.id),
    level,
    revision: 0,
    ...(scaleStatus === undefined ? {} : { scaleStatus }),
  };
}
