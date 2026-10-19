import { describe, expect, it } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { VersionDiff } from '@/lib/versioning/diff';

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

describe('tô sáng trên cảnh bản gốc', () => {
  const graph = graphOfVersion(current, source);
  const modelOf = (diff: VersionDiff, hoveredEntityId: string | null = null) =>
    buildVisualModel({
      capabilities: { canShowCurrentModel3d: true, canHighlightEntity: true } as never,
      graph,
      scene: convertScene(graph),
      diff,
      leftVersionLabel: 'v2',
      hoveredEntityId,
      isFetchingDiff: false,
      isOldVersion: true,
    });

  it('tường chỉ bị dời đầu được tô bằng mã tường, không phải mã đầu tường', () => {
    const moved = { entityId: `V-${wall}-start`, entityType: 'vertex', kind: 'changed', field: 'x' } as const;
    const model = modelOf({ added: [], changed: [moved, { ...moved, field: 'y' }], removed: [] }, `V-${wall}-end`);

    expect(model.changedEntityIds).toEqual([wall]);
    expect(model.hoveredEntityId).toBe(wall);
    expect(model.caption).toBe('Đây là phiên bản v2; 1 đối tượng đã đổi đang được tô sáng');
  });

  it('phần thêm không có trong cảnh bản gốc: không tô, nhưng caption đếm và chỉ sang 2D', () => {
    const added = { entityId: 'W-NEW', entityType: 'wall', kind: 'added' } as const;
    const changed = { entityId: wall, entityType: 'wall', kind: 'changed', field: 'thickness_mm' } as const;
    const model = modelOf({ added: [added], changed: [changed], removed: [] });

    expect(model.changedEntityIds).toEqual([wall]);
    expect(model.caption).toBe(
      'Đây là phiên bản v2; 1 đối tượng đã đổi đang được tô sáng; 1 đối tượng không có trong bản này nên không tô được, xem ở mặt bằng 2D',
    );
  });
});
