/**
 * W3d (`src/lib/pascal/roomSplitAfterWalls.ts`; test ở đây vì lib không được import screens) — vách mới vẽ trong Pascal cắt đôi phòng 4×6 m: lệnh có hai phòng; không tách gọn: câu báo.
 */

import { describe, expect, it } from 'vitest';

import { createId } from '@/domain/spatial/ids';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { Furniture, Level, Point, Room, Wall } from '@/domain/spatial/types';
import { changeForAdd, createCommand } from '@/lib/commands/createCommand';
import { roomSplitNotice, splitRoomsAfterWalls } from '@/lib/pascal/roomSplitAfterWalls';
import { buildSplitRoomCommandFromWalls } from '@/screens/qc/RoomLabelReview/roomLabelReviewGateway';

const META = { confidence: 1, source: 'human', reviewed: true } as const;
const level = { ...META, id: createId('level'), name: 'Tầng 1', order: 0, elevationMm: 0, heightMm: 3000 } as Level;
const wallOf = (start: Point, end: Point, thicknessMm = 200): Wall =>
  ({ ...META, id: createId('wall'), levelId: level.id, centreline: { start, end }, thicknessMm, heightMm: 3000, kind: 'partition', openingIds: [] }) as Wall;
const corners: Point[] = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 6000 }, { x: 0, y: 6000 }];
const walls = corners.map((corner, index) => wallOf(corner, corners[(index + 1) % 4] as Point));
const room = {
  ...META,
  id: createId('room'),
  levelId: level.id,
  name: 'Phòng khách',
  usage: 'bedroom',
  outline: [{ x: 100, y: 100 }, { x: 3900, y: 100 }, { x: 3900, y: 5900 }, { x: 100, y: 5900 }],
  areaM2: 22.04,
  wallIds: walls.map((wall) => wall.id),
} as Room;
const bed = {
  ...META,
  id: createId('furniture'),
  levelId: level.id,
  roomId: room.id,
  kind: 'bed',
  centre: { x: 2000, y: 5000 },
  boundingBox: { min: { x: 1500, y: 4700 }, max: { x: 2500, y: 5300 } },
  rotationDeg: 0,
} as Furniture;
const graph = normalizeSpatial({
  building: { ...META, name: 'Nhà', datumElevationMm: 0 },
  levels: [level],
  walls,
  openings: [],
  furniture: [bed],
  rooms: [room],
  axes: [],
  dimensions: [],
  notes: [],
} as never);
const addWall = (wall: Wall) =>
  createCommand({ type: 'pascal.edit', actorId: 'U-1', description: 'Thêm tường', changes: [changeForAdd('wall', wall)] });

describe('tách phòng sau khi vẽ vách trong Pascal', () => {
  it('vách cắt ngang phòng 4×6 m: cùng một lệnh có tường mới, hai phòng, bed sang phòng mới', () => {
    const pascal = addWall(wallOf({ x: 0, y: 3000 }, { x: 4000, y: 3000 }, 100));
    const { command, notices } = splitRoomsAfterWalls(graph, pascal, buildSplitRoomCommandFromWalls);
    const rooms = command.changes.filter((change) => change.kind === 'room');
    const added = rooms.find((change) => change.before === null)?.after as Room | undefined;

    expect(notices).toEqual([]);
    expect(command.id).toBe(pascal.id);
    expect(command.type).toBe('pascal.edit');
    expect(command.changes.some((change) => change.kind === 'wall' && change.before === null)).toBe(true);
    expect(rooms).toHaveLength(2);
    expect(added).toBeDefined();
    expect(command.changes).toContainEqual(expect.objectContaining({ kind: 'furniture', after: expect.objectContaining({ roomId: added?.id }) }));
  });

  it('vách lửng không khép phòng: để nguyên, báo mở màn Phòng', () => {
    const pascal = addWall(wallOf({ x: 1000, y: 3000 }, { x: 3000, y: 3000 }, 100));
    const { command, notices } = splitRoomsAfterWalls(graph, pascal, buildSplitRoomCommandFromWalls);

    expect(command).toBe(pascal);
    expect(notices).toEqual([roomSplitNotice(room)]);
  });

  it('không có tường mới: không đụng gì', () => {
    const pascal = createCommand({ type: 'pascal.edit', actorId: 'U-1', description: 'x', changes: [changeForAdd('furniture', { ...bed, id: createId('furniture') })] });

    expect(splitRoomsAfterWalls(graph, pascal, buildSplitRoomCommandFromWalls)).toEqual({ command: pascal, notices: [] });
  });
});
