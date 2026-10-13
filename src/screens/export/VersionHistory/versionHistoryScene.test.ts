import { describe, expect, it } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';

import { buildVisualModel, convertScene, graphOfVersion } from './versionHistoryScene';

const current = normalizeSpatial(createSampleBuilding());
const wall = current.byKind.wall[0] as string;
const walls = [current.byId[wall]] as never;
const source = { dimensions: [], layer: { furniture: [], openings: [], rooms: [], walls } } as never;

describe('cảnh của phiên bản cũ', () => {
  it('dựng đồ thị từ lớp của bản cũ, không phải mô hình hiện tại', () => {
    const old = graphOfVersion(current, source);

    expect(old?.byKind.wall).toEqual([wall]);
    expect(old?.byKind.room).toHaveLength(0);
    expect(graphOfVersion(null, source)).toBeNull();
  });

  it('caption nêu đích danh phiên bản cũ khi cảnh là của nó', () => {
    const graph = graphOfVersion(current, source);
    const model = buildVisualModel({
      capabilities: { canShowCurrentModel3d: true, canHighlightEntity: true } as never,
      graph,
      scene: convertScene(graph),
      diff: null,
      leftVersionLabel: 'v3',
      hoveredEntityId: null,
      isFetchingDiff: false,
      isOldVersion: true,
    });

    expect(model.caption).toBe('Đây là phiên bản v3; 0 đối tượng đã đổi đang được tô sáng');
  });
});
