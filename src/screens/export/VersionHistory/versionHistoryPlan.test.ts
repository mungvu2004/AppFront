import { describe, expect, it } from 'vitest';

import type { SpatialLayer } from '@/api/client';
import { diffVersions } from '@/lib/versioning/diff';

import { WIRE_CURRENT_WALLS, WIRE_V2_WALLS, wireLayer, wireWall } from './versionHistoryFixtures';
import { buildPlanDiffModel, planEntityIdOf } from './versionHistoryPlan';
import { toVersionSnapshot, type VersionSnapshotSource } from './versionSnapshotAdapter';

const sourceOf = (walls: readonly Record<string, unknown>[], extra: Partial<SpatialLayer> = {}): VersionSnapshotSource => ({
  dimensions: [],
  layer: { ...(wireLayer(walls) as unknown as SpatialLayer), ...extra },
});

function planOf(left: VersionSnapshotSource, right: VersionSnapshotSource, focusId: string | null = null) {
  return buildPlanDiffModel({
    diff: diffVersions(toVersionSnapshot(left), toVersionSnapshot(right)),
    floorLabel: 'Tầng 1',
    focusId,
    left,
    right,
  });
}

const toneById = (shapes: readonly { readonly id: string; readonly tone: string }[]) =>
  Object.fromEntries(shapes.map((shape) => [shape.id, shape.tone]));

describe('buildPlanDiffModel', () => {
  const v2 = sourceOf(WIRE_V2_WALLS);
  const current = sourceOf(WIRE_CURRENT_WALLS);

  it('v2 → hiện tại: tường đổi độ dày là sửa (vẽ theo bản phải), tường mới là thêm', () => {
    const plan = planOf(v2, current);

    expect(toneById(plan.walls)).toEqual({ 'W-WALL000001': 'changed', 'W-WALL000002': 'added' });
    expect(plan.walls.find((wall) => wall.id === 'W-WALL000001')?.thickness).toBe(220);
    expect(plan.legend).toEqual([
      { count: 1, label: 'Thêm', tone: 'added' },
      { count: 0, label: 'Xoá', tone: 'removed' },
      { count: 1, label: 'Sửa', tone: 'changed' },
    ]);
  });

  it('hiện tại → v2: tường không còn ở bản phải là xoá, hình lấy từ bản trái', () => {
    const plan = planOf(current, v2);
    const removed = plan.walls.find((wall) => wall.id === 'W-WALL000002');

    expect(toneById(plan.walls)).toEqual({ 'W-WALL000001': 'changed', 'W-WALL000002': 'removed' });
    expect(removed).toMatchObject({ thickness: 150, x1: 5000, x2: 9000 });
  });

  it('chỉ dời đầu tường thì tường vẫn là sửa (mã V-…-start quy về mã tường)', () => {
    const moved = sourceOf([wireWall('W-WALL000001', 200, 1000)]);
    const plan = planOf(v2, moved, 'V-W-WALL000001-start');

    expect(planEntityIdOf('V-W-WALL000001-end')).toBe('W-WALL000001');
    expect(plan.walls).toEqual([expect.objectContaining({ focused: true, id: 'W-WALL000001', tone: 'changed', x1: 1000 })]);
  });

  it('ô mở trên tường bị xoá vẽ theo bản trái, tone xoá', () => {
    const door = { heightMm: 2100, id: 'D-1', kind: 'door', offsetMm: 1000, sillHeightMm: 0, swing: 'left', widthMm: 900, wallId: 'W-WALL000002' };
    const plan = planOf(sourceOf(WIRE_CURRENT_WALLS, { openings: [door] } as unknown as Partial<SpatialLayer>), v2);

    expect(plan.openings).toEqual([expect.objectContaining({ id: 'D-1', tone: 'removed', x1: 6000, x2: 6900, y1: 0 })]);
  });

  it('hai bản giống nhau: mọi hình là same, chú giải đếm 0; viewBox bao trọn mọi đỉnh', () => {
    const plan = planOf(current, current);

    expect(plan.walls.every((wall) => wall.tone === 'same' && !wall.focused)).toBe(true);
    expect(plan.legend.map((item) => item.count)).toEqual([0, 0, 0]);
    expect(plan.viewBox).toBe('-500 -500 10000 1000');
  });
});
