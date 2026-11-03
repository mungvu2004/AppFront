/**
 * Chốt một nét "Vẽ tường" thành lệnh: tường mới PHẢI nối vào tường có sẵn (#9), và đầu nào bắt vào
 * THÂN một tường thì tường đó được cắt đôi tại đúng điểm ấy (nút chữ T, #5) — để mạng tường khép kín
 * và phòng tạo được. Đầu bắt vào ĐẦU tường thì chỉ dùng chung đỉnh, không cắt gì.
 *
 * Mọi lệnh (cắt + vẽ) đi chung một lượt `runTransaction` → một bước hoàn tác (Ctrl+Z gỡ cả nét).
 * Thuần: đọc đồ thị trong `context`, không ghi gì.
 */

import { createDrawWallCommand, createSplitWallCommand, type DrawWallInput } from '@/lib/commands/business/wallCommands';
import { buildCommand, type CommandContext } from '@/lib/commands/business/shared';
import type { DispatchResult } from '@/lib/commands/dispatch';
import { runTransaction } from '@/lib/commands/transaction';
import type { Command, EntityChange } from '@/lib/commands/types';
import type { Point, Segment, Wall, WallId } from '@/domain/spatial/types';
import { millimetres } from '@/domain/units/types';

import type { WallDrawSnap } from './wallDrawSnap';
import type { WallLayerDispatchDeps } from './wallLayerReviewGateway';

export const WALL_DRAW_MUST_CONNECT_TEXT =
  'Tường mới phải nối vào một tường có sẵn — bấm điểm đầu hoặc điểm cuối lên đầu hay thân một tường.';
export const WALL_DRAW_ALONG_TEXT = 'Hai đầu tường mới bắt vào cùng một tường — tường mới sẽ nằm đè lên tường đó.';

export interface WallDrawSnaps {
  readonly start: WallDrawSnap | null;
  readonly end: WallDrawSnap | null;
}

export type ConnectedDrawPlan =
  | { readonly ok: true; readonly commands: readonly Command[]; readonly label: string }
  | { readonly ok: false; readonly reason: string };

const roundPoint = (point: Point): Point => ({ x: millimetres(Math.round(point.x)), y: millimetres(Math.round(point.y)) });

/**
 * Dây ghi (`FloorLayerWriteSchema`) đòi mm nguyên; chân vuông góc trên tường xiên và vị trí ô mở sau
 * khi cắt có thể lẻ, nên làm tròn ở đây. Hai mảnh chung một điểm cắt → tròn ra cùng một điểm.
 */
const withIntegerGeometry = (change: EntityChange): EntityChange => {
  if (change.kind === 'wall' && change.after !== null) {
    const { start, end } = change.after.centreline;

    return { ...change, after: { ...change.after, centreline: { start: roundPoint(start), end: roundPoint(end) } } };
  }

  if (change.kind === 'opening' && change.after !== null) {
    return { ...change, after: { ...change.after, offsetMm: Math.max(0, Math.round(change.after.offsetMm)) } };
  }

  return change;
};

const distanceSq = (a: Point, b: Point): number => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/**
 * Đầu nét bắt vào thân `wallId` tại `at`: cắt tường đó, trả lệnh cắt + điểm cắt (mm nguyên).
 * Cắt bị từ chối (sát đầu tường hơn đoạn tối thiểu) → không cắt, dùng chung đầu gần nhất.
 */
function joinAtBody(
  wallId: WallId,
  at: Point,
  context: CommandContext,
  nextWallId: () => WallId,
): { readonly command: Command | null; readonly point: Point } {
  const built = createSplitWallCommand({ wallId, at, secondWallId: nextWallId() }, context);

  if (!built.ok) {
    const wall = context.graph.byId[wallId] as Wall | undefined;

    if (wall === undefined) {
      return { command: null, point: at };
    }

    const { start, end } = wall.centreline;

    return { command: null, point: distanceSq(start, at) <= distanceSq(end, at) ? start : end };
  }

  const command = built.data;
  const changes = command.changes.map(withIntegerGeometry);
  const first = changes.find((change) => change.kind === 'wall' && change.id === wallId);
  const point = first?.kind === 'wall' && first.after !== null ? first.after.centreline.end : roundPoint(at);

  return { command: buildCommand(command.type, command.description, changes, context), point };
}

/** Lệnh cho một nét vẽ đã đủ hai điểm, hoặc câu từ chối tiếng Việt. */
export function planConnectedDraw(
  input: DrawWallInput,
  snaps: WallDrawSnaps,
  context: CommandContext,
  nextWallId: () => WallId,
): ConnectedDrawPlan {
  const startWall = snaps.start?.wallId ?? null;
  const endWall = snaps.end?.wallId ?? null;

  if (startWall === null && endWall === null) {
    return { ok: false, reason: WALL_DRAW_MUST_CONNECT_TEXT };
  }

  // ponytail: chỉ bắt trường hợp hai đầu báo cùng một mã tường; đè lên tường qua đỉnh chung của tường bên cạnh thì chưa bắt.
  if (startWall !== null && startWall === endWall) {
    return { ok: false, reason: WALL_DRAW_ALONG_TEXT };
  }

  const splits: Command[] = [];
  let centreline: Segment = input.centreline;

  for (const which of ['start', 'end'] as const) {
    const snap = snaps[which];

    if (snap === null || snap.kind !== 'perpendicular' || snap.wallId === null) {
      continue;
    }

    const joined = joinAtBody(snap.wallId, centreline[which], context, nextWallId);

    if (joined.command !== null) {
      splits.push(joined.command);
    }

    centreline = { ...centreline, [which]: joined.point };
  }

  const draw = createDrawWallCommand({ ...input, centreline }, context);

  if (!draw.ok) {
    return { ok: false, reason: draw.error.reasons.join(' ') };
  }

  return { ok: true, commands: [...splits, draw.data], label: draw.data.description };
}

/** Chạy cả lô như MỘT bước hoàn tác, nhãn hoàn tác = câu của lệnh vẽ. */
export function runWallCommands(
  commands: readonly Command[],
  bundle: WallLayerDispatchDeps,
  label: string,
): Promise<DispatchResult> {
  bundle.setLabel(label);

  return runTransaction(commands, bundle.deps, { label });
}
