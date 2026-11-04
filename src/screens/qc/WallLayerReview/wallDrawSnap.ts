/**
 * Bắt điểm cho công cụ "Vẽ tường": điểm bấm hút vào đầu tường hoặc thân tường gần nhất,
 * để tường mới NỐI vào tường có sẵn thay vì đứng trơ (3D ẩn tường không chạm gì).
 *
 * Thuần — dùng lại `snapToTargets` của `domain/units/snap.ts`, không viết hình học mới.
 */

import type { Point, Wall, WallId } from '@/domain/spatial/types';
import type { PointMm } from '@/domain/units/compare';
import { perpendicularFoot, snapToTargets, SNAP_THRESHOLDS, type SnapTarget } from '@/domain/units/snap';
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

/** `Point` của đồ thị mang số trơn; bộ bắt điểm cần `PointMm`. */
const toMm = (point: Point): PointMm => ({ x: millimetres(point.x), y: millimetres(point.y) });

/** Đích bắt của một tầng: hai đầu mỗi tường + tim tường (vuông góc). */
export function wallDrawSnapTargets(walls: readonly Wall[]): readonly SnapTarget[] {
  return walls.flatMap((wall): SnapTarget[] => [
    { kind: 'wallVertex', id: `${wall.id}${VERTEX_SUFFIX}start`, position: toMm(wall.centreline.start) },
    { kind: 'wallVertex', id: `${wall.id}${VERTEX_SUFFIX}end`, position: toMm(wall.centreline.end) },
    { kind: 'perpendicular', id: wall.id, segment: { start: toMm(wall.centreline.start), end: toMm(wall.centreline.end) } },
  ]);
}

const roundPoint = (point: Point): Point => ({
  x: millimetres(Math.round(point.x)),
  y: millimetres(Math.round(point.y)),
});

/** Bắt một điểm (mm) vào đầu/thân tường trong bán kính; không lưới. */
export function snapDrawPoint(point: Point, targets: readonly SnapTarget[], radiusMm: number): WallDrawSnap {
  const result = snapToTargets(toMm(point), targets, { captureRadiusMm: millimetres(radiusMm), gridEnabled: false });
  const kind = result.kind === 'wallVertex' || result.kind === 'perpendicular' ? result.kind : null;
  const id = result.targetId;
  const wallId =
    kind === null || id === null
      ? null
      : ((kind === 'wallVertex' ? id.slice(0, id.lastIndexOf(VERTEX_SUFFIX)) : id) as WallId);

  return { point: roundPoint(result.point), kind, wallId };
}

/** Lệch khỏi trục ngang/dọc dưới ngần này (độ) thì nét vẽ tự nắn thẳng. */
export const DRAW_AXIS_LOCK_DEG = 5;
/** Chân vuông góc chỉ dùng trong bán kính bắt × ngần này: bán kính 12 px màn → 24 px màn. */
const DRAW_FOOT_REACH = 2;

/**
 * Nắn `point` về đường ngang hoặc dọc qua `start`: trục gần hơn thắng.
 * `force` (giữ Shift) luôn nắn; không thì chỉ nắn khi lệch dưới {@link DRAW_AXIS_LOCK_DEG}.
 */
export function lockDrawAxis(start: Point, point: Point, force = false): Point {
  const dx = Math.abs(point.x - start.x);
  const dy = Math.abs(point.y - start.y);
  const offAxisDeg = (Math.atan2(Math.min(dx, dy), Math.max(dx, dy)) * 180) / Math.PI;

  if (!force && offAxisDeg >= DRAW_AXIS_LOCK_DEG) {
    return point;
  }

  return dx >= dy ? { x: point.x, y: start.y } : { x: start.x, y: point.y };
}

/**
 * Điểm thật của một lần bấm/xem trước khi vẽ. Thứ tự ưu tiên: đầu tường, rồi thân tường, rồi khoá trục.
 * Đã có điểm đầu mà bắt vào thân tường thì lấy chân vuông góc TÍNH TỪ điểm đầu nếu chân ấy gần con trỏ
 * (nhắm gần đúng thì nhánh chữ T thẳng); xa hơn hoặc rơi ngoài tường thì giữ hình chiếu của con trỏ,
 * để con trỏ không nhảy xa trên tường dài và vẫn vẽ được nhánh xiên.
 */
export function resolveDrawPoint(
  point: Point,
  start: Point | null,
  targets: readonly SnapTarget[],
  radiusMm: number,
  forceAxis = false,
): WallDrawSnap {
  const snap = snapDrawPoint(point, targets, radiusMm);

  if (start === null || snap.kind === 'wallVertex') {
    return snap;
  }

  if (snap.kind === 'perpendicular') {
    const body = targets.find((target) => target.kind === 'perpendicular' && target.id === snap.wallId);
    const foot = body?.kind === 'perpendicular' ? perpendicularFoot(toMm(start), body.segment) : null;

    return foot !== null && Math.hypot(foot.x - point.x, foot.y - point.y) <= radiusMm * DRAW_FOOT_REACH
      ? { ...snap, point: roundPoint(foot) }
      : snap;
  }

  return { point: roundPoint(lockDrawAxis(start, point, forceAxis)), kind: null, wallId: null };
}

/**
 * Tường mới đặt từ một tường có sẵn thì lấy độ dày, chiều cao, loại của tường đó.
 * `thicknessMm` (phím 1/2/3 lúc vẽ) thắng độ dày kế thừa.
 */
export function withInheritedWallStyle(outcome: ToolOutcome, source: Wall | null, thicknessMm: number | null = null): ToolOutcome {
  if ((source === null && thicknessMm === null) || outcome.kind !== 'command') {
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
      input: {
        ...request.input,
        ...(source === null ? {} : { thicknessMm: source.thicknessMm, heightMm: source.heightMm, kind: source.kind }),
        ...(thicknessMm === null ? {} : { thicknessMm }),
      },
    },
  };
}
