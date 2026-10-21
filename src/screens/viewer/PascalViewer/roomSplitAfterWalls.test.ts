/**
 * W3d (`src/lib/pascal/roomSplitAfterWalls.ts`; test ở đây vì lib không được import screens) — vách mới vẽ trong Pascal cắt đôi phòng 4×6 m: lệnh có hai phòng; không tách gọn: câu báo.
 */

import { describe, expect, it } from 'vitest';

import { createId } from '@/domain/spatial/ids';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { Furniture, Level, Point, Room, Wall } from '@/domain/spatial/types';
import { changeForAdd, createCommand } from '@/lib/commands/createCommand';
import { createPascalEditCommand } from '@/lib/pascal/fromPascal';
import { roomSplitNotice, splitRoomsAfterWalls } from '@/lib/pascal/roomSplitAfterWalls';
import { toPascalScene } from '@/lib/pascal/toPascal';
import type { PascalNode } from '@/lib/pascal/types';
import { buildSplitRoomCommandFromWalls } from '@/screens/qc/RoomLabelReview/roomLabelReviewGateway';

interface PascalWallLike {
  readonly id: string;
  readonly thickness?: number;
  readonly height?: number;
}

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

  it('V13 — qua đường Pascal: tường chủ bị Pascal cắt đôi (xoá + 2 tường thay), vách không thickness/height: phòng tách 2', () => {
    const raw = { building: { ...META, name: 'Nhà', datumElevationMm: 0 }, levels: [level], walls, openings: [], furniture: [bed], rooms: [room], axes: [], dimensions: [], notes: [] };
    const scene = toPascalScene(raw as never).scene;
    const levelNode = scene.nodes[`level_${level.id}`] as PascalNode & { readonly children: readonly string[] };
    const [left, right] = [walls[3], walls[1]].map((wall) => scene.nodes[`wall_${wall?.id ?? ''}`] as PascalNode & PascalWallLike);
    if (left === undefined || right === undefined) throw new Error('phòng phải có tường trái/phải');
    const piece = (from: PascalWallLike, id: string, start: [number, number], end: [number, number]) =>
      ({ ...from, id, children: [], metadata: {}, start, end }) as unknown as PascalNode;
    const partition = Object.fromEntries(
      Object.entries(piece(left, 'wall_qv1partition', [0, 3], [4, 3])).filter(([key]) => key !== 'thickness' && key !== 'height'),
    ) as Omit<PascalNode & PascalWallLike, 'thickness' | 'height'>;
    const added = [
      piece(left, 'wall_qv1leftlow', [0, 6], [0, 3]),
      piece(left, 'wall_qv1lefthigh', [0, 3], [0, 0]),
      piece(right, 'wall_qv1rightlow', [4, 0], [4, 3]),
      piece(right, 'wall_qv1righthigh', [4, 3], [4, 6]),
      partition as unknown as PascalNode,
    ];
    const nodes: Record<string, PascalNode> = { ...scene.nodes };
    delete nodes[left.id];
    delete nodes[right.id];
    for (const node of added) nodes[node.id] = node;
    nodes[levelNode.id] = {
      ...levelNode,
      children: [...levelNode.children.filter((id) => id !== left.id && id !== right.id), ...added.map((node) => node.id)],
    } as PascalNode;
    const edit = createPascalEditCommand({
      graph,
      scene: { ...scene, nodes },
      commit: { origin: 'local', changedNodeIds: [left.id, right.id, ...added.map((node) => node.id), levelNode.id], removedNodeIds: [left.id, right.id] },
      actorId: 'U-1',
    });

    if (!edit.ok) throw new Error(edit.error.reasons.join(' '));

    const { command, notices } = splitRoomsAfterWalls(graph, edit.data, buildSplitRoomCommandFromWalls);

    expect(notices).toEqual([]);
    expect(command.changes.filter((change) => change.kind === 'wall' && change.before === null)).toHaveLength(5);
    expect(command.changes.filter((change) => change.kind === 'room')).toHaveLength(2);
  });
});

