/**
 * Đèn trần và món `DRESS-` không phòng nhận nuôi: xoá và sửa đều nhớ được bằng `Room.dressingOff` có sẵn,
 * không đổi hợp đồng. Xoá = id vào danh sách; sửa món rời = thành `Furniture` thật; dời đèn = id mang toạ độ.
 */

import { describe, expect, it } from 'vitest';

import { createSampleBuilding, sampleLevelId } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { Furniture, Point, Room, SpatialGraph, Wall } from '@/domain/spatial/types';

import { createPascalEditCommand } from '../fromPascal';
import { dressNodeIdOf, lightOffIdOf } from '../sceneDressing';
import { toPascalScene } from '../toPascal';
import { dismissableNodeIdsOf, isLooseGenerated, type PascalIdBook } from '../toSpatial';
import type { PascalItemNode, PascalNode, PascalScene } from '../types';

const LEVEL = sampleLevelId(0);
const LIV = 'R-ROOM0000001';
const LOG = 'R-ROOM0000002';
const meta = { source: 'ai', reviewed: false, confidence: 0.9 } as const;
const square = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];
const room = (id: string, usage: Room['usage'], outline: Point[]): Room =>
  ({ ...meta, id, levelId: LEVEL, name: id, usage, outline, areaM2: 10, wallIds: [] }) as unknown as Room;
const wall = (id: string, start: Point, end: Point): Wall =>
  ({ ...meta, id, levelId: LEVEL, kind: 'envelope', centreline: { start, end }, thicknessMm: 200, heightMm: 2800 }) as unknown as Wall;

const base = createSampleBuilding();
/** Lô gia + phòng khách: tường bao `W-OUT` thành lan can `DRESS-railing-W-WALL0000001` (không `roomId`). */
const GRAPH: SpatialGraph = {
  ...base,
  furniture: [],
  openings: [],
  walls: [wall('W-WALL0000001', { x: 0, y: 0 }, { x: 3000, y: 0 }), wall('W-WALL0000002', { x: 0, y: 1500 }, { x: 3000, y: 1500 })],
  rooms: [room(LOG, 'loggia', square(0, 0, 3000, 1500)), room(LIV, 'livingRoom', square(0, 1500, 3000, 5000))],
};
const SCENE = toPascalScene(GRAPH).scene;
const RAIL = 'item_DRESS-railing-W-WALL0000001';
const LIGHT = `item_LIGHT-${LIV}`;

const without = (of: PascalScene, nodeId: string): PascalScene => ({
  ...of,
  nodes: Object.fromEntries(Object.entries(of.nodes).filter(([id]) => id !== nodeId)),
});
const moved = (of: PascalScene, nodeId: string, x: number, z: number): PascalScene => {
  const node = of.nodes[nodeId] as PascalItemNode;

  return { ...of, nodes: { ...of.nodes, [nodeId]: { ...node, position: [x, node.position[1], z] } as PascalNode } };
};
const edit = (
  graph: SpatialGraph,
  scene: PascalScene,
  changed: string,
  { removed = false, adopt = [] as string[], idBook = new Map() as PascalIdBook } = {},
) => {
  const result = createPascalEditCommand({
    graph: normalizeSpatial(graph),
    scene,
    commit: { origin: 'local', changedNodeIds: [changed], removedNodeIds: removed ? [changed] : [] },
    actorId: 'pascal-editor',
    adoptNodeIds: adopt,
    idBook,
  });

  if (!result.ok) throw new Error(result.error.code);

  return result.data.changes;
};
const roomAfter = (changes: ReturnType<typeof edit>, roomId: string) => changes.find((c) => c.id === roomId)?.after as Room | undefined;
const withOff = (dressingOff: string[], roomId: string): SpatialGraph => ({
  ...GRAPH,
  rooms: GRAPH.rooms.map((r) => (r.id === roomId ? ({ ...r, dressingOff } as Room) : r)),
});

describe('khai hộ: mọi món tự sinh đều có phòng nhớ', () => {
  it('đèn trần và lan can nằm trong `dressIds`; id đèn qua được luật `DRESS-` của hợp đồng', () => {
    const dismissable = dismissableNodeIdsOf(SCENE);

    expect(dismissable.has(LIGHT)).toBe(true);
    expect(dismissable.has(RAIL)).toBe(true);
    expect(dressNodeIdOf(lightOffIdOf(LIV))).toBe(LIGHT);
    // Khớp `DRESSING_ID` (schemas/spatial.ts) và `DressingId` của AppBack.
    expect(lightOffIdOf(LIV)).toMatch(/^DRESS-[A-Za-z0-9_.:-]{1,160}$/);
    expect(isLooseGenerated(SCENE.nodes[RAIL])).toBe(true);
    expect(isLooseGenerated(SCENE.nodes[LIGHT])).toBe(false);
  });
});

describe('đèn trần', () => {
  it('xoá: phòng nhớ, mở lại không còn đèn nhưng trần vẫn còn; Hoàn tác: không còn gì để ghi', () => {
    const changes = edit(GRAPH, without(SCENE, LIGHT), LIGHT, { removed: true });

    expect(roomAfter(changes, LIV)?.dressingOff).toEqual([lightOffIdOf(LIV)]);
    expect(changes.filter((c) => c.kind === 'furniture')).toEqual([]);

    const reopened = toPascalScene(withOff([lightOffIdOf(LIV)], LIV)).scene;
    expect(reopened.nodes[LIGHT]).toBeUndefined();
    expect(reopened.nodes[`ceiling_${LIV}`]).toMatchObject({ children: [] });
    expect(reopened.nodes[`item_LIGHT-${LOG}`]).toBeDefined();

    expect(() => edit(GRAPH, SCENE, LIGHT)).toThrow('PASCAL_NO_CHANGE');
  });

  it('xoá trần kéo theo đèn: không ghi là xoá đèn', () => {
    const gone = without(without(SCENE, `ceiling_${LIV}`), LIGHT);

    expect(() => edit(GRAPH, gone, LIGHT, { removed: true })).toThrow('PASCAL_NO_CHANGE');
  });
});

describe('món rời (lan can lô gia)', () => {
  const movedRail = () => {
    const rail = SCENE.nodes[RAIL] as PascalItemNode;

    return moved(SCENE, RAIL, rail.position[0], rail.position[2] + 0.2);
  };

  it('xoá: phòng nhớ, mở lại không sinh lại', () => {
    const changes = edit(GRAPH, without(SCENE, RAIL), RAIL, { removed: true });
    const holder = changes.find((c) => c.kind === 'room')?.after as Room;

    expect(holder.dressingOff).toEqual(['DRESS-railing-W-WALL0000001']);
    expect(toPascalScene(withOff(['DRESS-railing-W-WALL0000001'], holder.id)).scene.nodes[RAIL]).toBeUndefined();
  });

  it('dời: riêng nó thành Furniture, giữ mẫu + cao + kính, hộp quanh tâm mới; mở lại không còn bản tự sinh', () => {
    const idBook: PascalIdBook = new Map();
    const changes = edit(GRAPH, movedRail(), RAIL, { adopt: [RAIL], idBook });
    const furniture = changes.find((c) => c.kind === 'furniture')?.after as Furniture;
    const holder = changes.find((c) => c.kind === 'room')?.after as Room;
    const rail = SCENE.nodes[RAIL] as PascalItemNode;

    expect(furniture.id).toBe(idBook.get(RAIL));
    expect(furniture.centre).toEqual({ x: 1500, y: 200 });
    expect(furniture.boundingBox.min).toEqual({ x: 0, y: 100 });
    expect(furniture.boundingBox.max).toEqual({ x: 3000, y: 300 });
    expect(furniture.model?.src).toBe(rail.asset.src);
    expect(holder.dressingOff).toEqual(['DRESS-railing-W-WALL0000001']);

    const reopened = toPascalScene({
      ...GRAPH,
      furniture: [furniture],
      rooms: GRAPH.rooms.map((r) => (r.id === holder.id ? holder : r)),
    }).scene;
    const real = reopened.nodes[`item_${furniture.id}`] as PascalItemNode;

    expect(reopened.nodes[RAIL]).toBeUndefined();
    expect(real.asset.src).toBe(rail.asset.src);
    expect(real.asset.scale).toEqual(rail.asset.scale);
    expect(real.asset.dimensions).toEqual(rail.asset.dimensions);
    expect(real.slots).toEqual(rail.slots);
    expect(real.position).toEqual([1.5, 0, 0.2]);
    expect(real.rotation).toEqual(rail.rotation);
  });

  it('Hoàn tác: đồ thật đi, id gốc rời danh sách; xoá sau khi sửa: đồ thật đi, id gốc ở lại', () => {
    const idBook: PascalIdBook = new Map();
    const first = edit(GRAPH, movedRail(), RAIL, { adopt: [RAIL], idBook });
    const furniture = first.find((c) => c.kind === 'furniture')?.after as Furniture;
    const holder = first.find((c) => c.kind === 'room')?.after as Room;
    const saved: SpatialGraph = { ...GRAPH, furniture: [furniture], rooms: GRAPH.rooms.map((r) => (r.id === holder.id ? holder : r)) };

    const undo = edit(saved, SCENE, RAIL, { idBook });
    expect(undo.find((c) => c.kind === 'furniture')).toMatchObject({ id: furniture.id, after: null });
    // Cảnh nạp không mang `dressingOff`: hoàn tác trả phòng về danh sách rỗng.
    expect((undo.find((c) => c.kind === 'room')?.after as Room).dressingOff).toBeUndefined();

    const removed = edit(saved, without(movedRail(), RAIL), RAIL, { removed: true, idBook });
    expect(removed.find((c) => c.kind === 'furniture')).toMatchObject({ id: furniture.id, after: null });
    expect(removed.find((c) => c.kind === 'room')).toBeUndefined();
  });
});
