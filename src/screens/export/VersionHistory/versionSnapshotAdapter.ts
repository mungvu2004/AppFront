/**
 * N18 (`{ layer, dimensions }`) thành `VersionSnapshot` mà `diffVersions` so — đúng bảng tên
 * HOP-DONG-MOI §1.3, cùng bảng mà B3-03 ghi nhật ký (`packages/domain/spatial/diff.py`).
 *
 * Thuần, không React. Chỉ trường trong bảng được chép, đơn vị giữ nguyên (mm, độ), và trường
 * miền vắng thì khoá vắng — không `undefined`, không `null`: một khoá mang `undefined` là một
 * "thay đổi" mà `diffVersions` sẽ đếm.
 */

import type { SpatialLayer } from '@/api/client';
import type { Dimension } from '@/domain/spatial/types';
import type { EntityRecord, VersionSnapshot } from '@/lib/versioning/diff';

export interface VersionSnapshotSource {
  readonly layer: SpatialLayer;
  readonly dimensions: readonly Dimension[];
}

/** Id của một đầu tường, đúng `vertex_id` của BE. */
export const vertexIdOf = (wallId: string, end: 'start' | 'end'): string => `V-${wallId}-${end}`;

/** Bỏ khoá mang `undefined` — trường miền vắng thì khoá vắng. */
function present(record: Readonly<Record<string, unknown>>): EntityRecord {
  const out: EntityRecord = {};

  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined) {
      out[key] = value;
    }
  }

  return out;
}

export function toVersionSnapshot({ dimensions, layer }: VersionSnapshotSource): VersionSnapshot {
  const snapshot: VersionSnapshot = {
    dimension: {},
    door: {},
    furniture: {},
    room: {},
    vertex: {},
    wall: {},
    window: {},
  };

  for (const wall of layer.walls) {
    snapshot.wall[wall.id] = present({ thickness_mm: wall.thicknessMm, height_mm: wall.heightMm, kind: wall.kind });
    snapshot.vertex[vertexIdOf(wall.id, 'start')] = { x: wall.centreline.start.x, y: wall.centreline.start.y };
    snapshot.vertex[vertexIdOf(wall.id, 'end')] = { x: wall.centreline.end.x, y: wall.centreline.end.y };
  }

  for (const opening of layer.openings) {
    snapshot[opening.kind][opening.id] = present({
      width_mm: opening.widthMm,
      height_mm: opening.heightMm,
      sill_height_mm: opening.sillHeightMm,
      offset_mm: opening.offsetMm,
      swing: opening.swing,
      wall_id: opening.wallId,
    });
  }

  for (const room of layer.rooms) {
    snapshot.room[room.id] = present({ name: room.name, usage: room.usage, outline: room.outline });
  }

  for (const item of layer.furniture) {
    snapshot.furniture[item.id] = present({
      kind: item.kind,
      centre: item.centre,
      rotation_deg: item.rotationDeg,
      room_id: item.roomId,
    });
  }

  for (const dimension of dimensions) {
    snapshot.dimension[dimension.id] = present({
      value_mm: dimension.valueMm,
      override_value_mm: dimension.overrideValueMm,
      reference_ids: dimension.referenceIds,
    });
  }

  return snapshot;
}
