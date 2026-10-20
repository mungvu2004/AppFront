/**
 * Vách mới vẽ trong Pascal cắt ngang một phòng thì phòng ấy tách đôi trong CÙNG lệnh.
 *
 * Pascal không bao giờ tách vùng sàn (EDIT.md "Partition split"), nên tường mới
 * lưu được mà phòng vẫn một ranh — bản 2D không đổi. Ở đây: mỗi phòng có tâm một
 * tường mới nằm hẳn bên trong được dò lại bằng đúng đường của màn Phòng
 * (`buildSplitRoomCommandFromWalls`). Ra đúng hai phần thì lệnh tách (kèm chuyển
 * đồ đạc) gộp vào lệnh Pascal — một bước hoàn tác. Không tách gọn được thì để
 * nguyên và trả một câu báo cho người dùng.
 */

import { outlineContains } from '@/domain/rooms/area';
import { applyPatch } from '@/domain/spatial/applyPatch';
import { createId } from '@/domain/spatial/ids';
import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import type { Level, Point, Room, RoomId, Wall } from '@/domain/spatial/types';
import {
  entitiesOfKind,
  readOf,
  toPointMm,
  wallsOnLevel,
  type CommandContext,
  type CommandResult,
} from '@/lib/commands/business/shared';
import { commandToPatches } from '@/lib/commands/invert';
import { mergeCommands } from '@/lib/commands/mergeCommands';
import type { Command } from '@/lib/commands/types';

/**
 * `buildSplitRoomCommandFromWalls` của màn Phòng (roomLabelReviewGateway.ts) — tầng lib không
 * được import screens, nên nơi gọi (usePascalEdits) truyền nó vào.
 */
export type SplitRoomFromWalls = (
  input: { readonly roomId: RoomId; readonly newRoomId: RoomId; readonly at: Point },
  context: CommandContext,
  walls: readonly Wall[],
  level: Level | null,
) => CommandResult;

export interface RoomSplitAfterWalls {
  /** Lệnh Pascal, đã gộp các lượt tách (hoặc chính nó khi không tách gì). */
  readonly command: Command;
  /** "Phòng X có vách mới — mở màn Phòng để tách." cho phòng không tách gọn được. */
  readonly notices: readonly string[];
}

export const roomSplitNotice = (room: Room): string => `Phòng "${room.name}" có vách mới — mở màn Phòng để tách.`;

const distanceToSegment = (point: Point, from: Point, to: Point): number => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSq));

  return Math.hypot(point.x - (from.x + t * dx), point.y - (from.y + t * dy));
};

/**
 * Tâm tường nằm hẳn trong phòng: trong ranh VÀ cách mọi cạnh hơn một bề dày tường.
 * Tường thay thế khi Pascal nối chữ T nằm trên ranh phòng — không phải vách mới.
 */
const crosses = (wall: Wall, room: Room): boolean => {
  const { start, end } = wall.centreline;
  const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 } as Point;

  return (
    outlineContains(room.outline.map(toPointMm), toPointMm(middle)) &&
    room.outline.every(
      (corner, index) =>
        distanceToSegment(middle, corner, room.outline[(index + 1) % room.outline.length] ?? corner) > wall.thicknessMm,
    )
  );
};

export function splitRoomsAfterWalls(
  graph: NormalizedSpatial,
  command: Command,
  splitRoom: SplitRoomFromWalls,
  nextRoomId: () => RoomId = () => createId('room'),
): RoomSplitAfterWalls {
  const newWalls = command.changes.flatMap((change) =>
    change.kind === 'wall' && change.before === null && change.after !== null ? [change.after] : [],
  );

  if (newWalls.length === 0) return { command, notices: [] };

  let current = applyPatch(graph, commandToPatches(command));
  let merged = command;
  const notices: string[] = [];
  const done = new Set<string>();

  for (const wall of newWalls) {
    for (const room of entitiesOfKind(current, 'room')) {
      if (done.has(room.id) || room.levelId !== wall.levelId || !crosses(wall, room)) continue;
      done.add(room.id);

      const split = splitRoom(
        { roomId: room.id, newRoomId: nextRoomId(), at: wall.centreline.start },
        { graph: current, actorId: command.actorId },
        wallsOnLevel(current, room.levelId),
        readOf(current, 'level', room.levelId),
      );

      if (!split.ok) {
        notices.push(roomSplitNotice(room));
        continue;
      }

      current = applyPatch(current, commandToPatches(split.data));
      merged = {
        ...mergeCommands(merged, { ...split.data, type: merged.type }),
        description: `${merged.description} — ${split.data.description}`,
      };
    }
  }

  return { command: merged, notices };
}
