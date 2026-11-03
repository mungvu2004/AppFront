/**
 * Bắt điểm cho công cụ "Vẽ tường": điểm bấm hút vào đầu tường hoặc thân tường gần nhất,
 * để tường mới NỐI vào tường có sẵn thay vì đứng trơ (3D ẩn tường không chạm gì).
 *
 * Thuần — dùng lại `snapToTargets` của `domain/units/snap.ts`, không viết hình học mới.
 */

import type { Point, Wall, WallId } from '@/domain/spatial/types';
import { snapToTargets, SNAP_THRESHOLDS, type SnapTarget } from '@/domain/units/snap';
import { millimetres } from '@/domain/units/types';
import { WALL_COMMAND_TYPES } from '@/lib/commands/business/commandTypes';
import type { ToolOutcome } from '@/lib/tools/toolMachine';

/** Thứ điểm vẽ bắt được: đầu tường, hoặc chân đường vuông góc trên thân tường. */
export type WallDrawSnapKind = 'wallVertex' | 'perpendicular';

export interface WallDrawSnap {
  /** Điểm cuối cùng, số nguyên mm (hợp đồng `WallSchema`). */
  readonly point: Point;
  readonly kind: WallDrawSnapKind | null;
  /** Tường bắt được; `null` khi điểm không chạm tường nào. */
  readonly wallId: WallId | null;
}

/** Bán kính bắt khi chưa biết mức phóng (mm). */
export const DEFAULT_DRAW_SNAP_RADIUS_MM: number = SNAP_THRESHOLDS.captureRadiusMm;

const VERTEX_SUFFIX = '#';

/** Đích bắt của một tầng: hai đầu mỗi tường + tim tường (vuông góc). */
export function wallDrawSnapTargets(walls: readonly Wall[]): readonly SnapTarget[] {
  return walls.flatMap((wall): SnapTarget[] => [
    { kind: 'wallVertex', id: `${wall.id}${VERTEX_SUFFIX}start`, position: wall.centreline.start },
    { kind: 'wallVertex', id: `${wall.id}${VERTEX_SUFFIX}end`, position: wall.centreline.end },
    { kind: 'perpendicular', id: wall.id, segment: wall.centreline },
  ]);
}

const roundPoint = (point: Point): Point => ({
  x: millimetres(Math.round(point.x)),
  y: millimetres(Math.round(point.y)),
});

/** Bắt một điểm (mm) vào đầu/thân tường trong bán kính; không lưới. */
export function snapDrawPoint(point: Point, targets: readonly SnapTarget[], radiusMm: number): WallDrawSnap {
  const result = snapToTargets(point, targets, { captureRadiusMm: millimetres(radiusMm), gridEnabled: false });
  const kind = result.kind === 'wallVertex' || result.kind === 'perpendicular' ? result.kind : null;
  const id = result.targetId;
  const wallId =
    kind === null || id === null
      ? null
      : ((kind === 'wallVertex' ? id.slice(0, id.lastIndexOf(VERTEX_SUFFIX)) : id) as WallId);

  return { point: roundPoint(result.point), kind, wallId };
}

/** Tường mới đặt từ một tường có sẵn thì lấy độ dày, chiều cao, loại của tường đó. */
export function withInheritedWallStyle(outcome: ToolOutcome, source: Wall | null): ToolOutcome {
  if (source === null || outcome.kind !== 'command') {
    return outcome;
  }

  const request = outcome.request;

  if (request.type !== WALL_COMMAND_TYPES.draw) {
    return outcome;
  }

  return {
    kind: 'command',
    request: {
      type: WALL_COMMAND_TYPES.draw,
      input: { ...request.input, thicknessMm: source.thicknessMm, heightMm: source.heightMm, kind: source.kind },
    },
  };
}
