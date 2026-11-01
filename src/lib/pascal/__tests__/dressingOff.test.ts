/**
 * H4 — xoá một món AppFront tự bày (`item_DRESS-…`) thì lưu được: phòng mang `dressingOff`,
 * lượt mở sau không bày lại; Hoàn tác (món về cảnh) thì rời danh sách.
 */

import { describe, expect, it } from 'vitest';

import { RoomSchema } from '@/api/schemas/spatial';
import { SpatialGraphDocumentSchema } from '@/api/schemas/spatialGraph';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { MaterialRef, Room, SpatialGraph } from '@/domain/spatial/types';

import { fixtureF2 } from '../__fixtures__';
import { createPascalEditCommand } from '../fromPascal';
import { bodyOfPascalId, toPascalId } from '../ids';
import { CEILING_DEFAULT } from '../sceneDressing';
import { SCENE_STYLES } from '../sceneStyles';
import { toPascalScene } from '../toPascal';
import { adoptableRoomOf, dismissableNodeIdsOf, toSpatialGraph } from '../toSpatial';
import type { PascalItemNode, PascalNode, PascalScene } from '../types';

const graph: SpatialGraph = SpatialGraphDocumentSchema.parse(fixtureF2().doc).graph;
const scene = toPascalScene(graph).scene;
const items = (of: PascalScene): PascalItemNode[] =>
  Object.values(of.nodes).filter((node): node is PascalItemNode => node.type === 'item');
const target = items(scene).find((node) => adoptableRoomOf(node) !== null);

if (target === undefined) throw new Error('F2 phải có ít nhất một món tự bày gắn phòng');

const roomId = adoptableRoomOf(target) as string;
const dressId = bodyOfPascalId(target.id);
const without = (of: PascalScene, nodeId: string): PascalScene => ({
  ...of,
  nodes: Object.fromEntries(Object.entries(of.nodes).filter(([id]) => id !== nodeId)),
});
const removed = without(scene, target.id);
const roomOf = (of: SpatialGraph): Room | undefined => of.rooms.find((room) => room.id === roomId);

describe('H4 — dressingOff khứ hồi', () => {
  it('zone khai món tự bày của phòng; món ấy xoá được (dismissableNodeIdsOf)', () => {
    expect(dismissableNodeIdsOf(scene).has(target.id)).toBe(true);
    expect(roomOf(toSpatialGraph(scene).graph)).not.toHaveProperty('dressingOff');
  });

  it('xoá món → phòng mang dressingOff → mở lại không còn node đó, các món khác vẫn bày', () => {
    const after = roomOf(toSpatialGraph(removed).graph);

    expect(after?.dressingOff).toEqual([dressId]);

    const saved: SpatialGraph = {
      ...graph,
      rooms: graph.rooms.map((room) => (room.id === roomId ? { ...room, dressingOff: [dressId] } : room)),
    };
    const reopened = toPascalScene(saved).scene;

    expect(reopened.nodes[target.id]).toBeUndefined();
    // Món đặt LÊN món đã xoá (gối trên giường tự bày) cũng không bày; phần còn lại của phòng vẫn có.
    const dressed = (of: PascalScene): number => items(of).filter((node) => adoptableRoomOf(node) !== null).length;

    expect(dressed(reopened)).toBeLessThan(dressed(scene));
    // Danh sách đã lưu đi qua lượt mở sau mà không đổi: không sinh lệnh từ hư không.
    expect(roomOf(toSpatialGraph(reopened).graph)?.dressingOff).toEqual([dressId]);
  });

  it('Hoàn tác (món về cảnh) thì rời danh sách', () => {
    expect(roomOf(toSpatialGraph(scene).graph)?.dressingOff).toBeUndefined();
  });

  it('lệnh: xoá món tự bày = một lượt sửa phòng mang dressingOff', () => {
    const result = createPascalEditCommand({
      graph: normalizeSpatial(graph),
      scene: removed,
      commit: { origin: 'local', changedNodeIds: [target.id], removedNodeIds: [target.id] },
      actorId: 'U-1',
    });

    if (!result.ok) throw new Error(result.error.reasons.join(' '));

    expect(result.data.changes).toHaveLength(1);
    expect(result.data.changes[0]?.kind).toBe('room');
    expect((result.data.changes[0]?.after as Room).dressingOff).toEqual([dressId]);
  });

  it('schema: nhận id DRESS-, từ chối id sai mẫu và danh sách quá 200; rỗng là vắng khoá', () => {
    const room = graph.rooms.find((r) => r.id === roomId) as Room;

    expect(RoomSchema.parse({ ...room, dressingOff: [dressId] }).dressingOff).toEqual([dressId]);
    expect(RoomSchema.parse({ ...room, dressingOff: [] })).not.toHaveProperty('dressingOff');
    expect(RoomSchema.safeParse({ ...room, dressingOff: ['F-1'] }).success).toBe(false);
    expect(RoomSchema.safeParse({ ...room, dressingOff: ['DRESS-'] }).success).toBe(false);
    expect(
      RoomSchema.safeParse({ ...room, dressingOff: Array.from({ length: 201 }, (_, n) => `DRESS-rug-R-${String(n)}`) })
        .success,
    ).toBe(false);
  });
});

describe('H4 — màu trần khứ hồi (Room.ceilingMaterial)', () => {
  const paint = SCENE_STYLES['am-ap'].wall.interior as MaterialRef;
  const ceilingId = toPascalId('ceiling', roomId);
  const ceiling = scene.nodes[ceilingId];

  it('trần mặc định: phòng vắng ceilingMaterial', () => {
    expect(ceiling?.type).toBe('ceiling');
    expect(ceiling?.type === 'ceiling' ? ceiling.slots['surface'] : null).toBe(CEILING_DEFAULT);
    expect(roomOf(toSpatialGraph(scene).graph)).not.toHaveProperty('ceilingMaterial');
  });

  it('sơn trần → lệnh sửa phòng mang ceilingMaterial → mở lại trần giữ màu', () => {
    const painted: PascalScene = {
      ...scene,
      nodes: { ...scene.nodes, [ceilingId]: { ...ceiling, slots: { surface: paint } } as PascalNode },
    };
    const result = createPascalEditCommand({
      graph: normalizeSpatial(graph),
      scene: painted,
      commit: { origin: 'local', changedNodeIds: [ceilingId] },
      actorId: 'U-1',
    });

    if (!result.ok) throw new Error(result.error.reasons.join(' '));
    const room = result.data.changes.find((change) => change.kind === 'room')?.after as Room | undefined;

    expect(room?.ceilingMaterial).toBe(paint);

    const reopened = toPascalScene({
      ...graph,
      rooms: graph.rooms.map((r) => (r.id === roomId ? { ...r, ceilingMaterial: paint } : r)),
    }).scene.nodes[ceilingId];

    expect(reopened?.type === 'ceiling' ? reopened.slots['surface'] : null).toBe(paint);
  });
});
