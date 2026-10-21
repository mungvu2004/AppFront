/**
 * W3a — sơn sàn (`slab_<phòng>`) và sơn tường trong Pascal được lưu vào phòng/tường,
 * và đọc lại ra đúng cảnh ấy. Cảnh không ai đụng: không có lệnh nào.
 */

import { describe, expect, it } from 'vitest';

import { SpatialGraphDocumentSchema } from '@/api/schemas/spatialGraph';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { MaterialRef, Room, SpatialGraph, Wall } from '@/domain/spatial/types';

import { fixtureF1 } from '../__fixtures__';
import { LIBRARY_MATERIAL_IDS } from '../libraryMaterialIds';
import { createPascalEditCommand } from '../fromPascal';
import { sceneStyleOf } from '../sceneStyles';
import { toPascalScene } from '../toPascal';
import { saveableRef } from '../toSpatial';
import type { PascalNode, PascalScene } from '../types';

const graph: SpatialGraph = SpatialGraphDocumentSchema.parse(fixtureF1({ ext: true }).doc).graph;
const style = sceneStyleOf(undefined);
const room = graph.rooms[0] as Room;
const wall = graph.walls.find((candidate) => candidate.heightMm > 1200) as Wall;
const slabId = `slab_${room.id}`;
const wallId = `wall_${wall.id}`;
const CUSTOM = 'scene:mat_user_pink';
const WALL_REF = style.wall.interior as MaterialRef;

const sceneOf = (of: SpatialGraph): PascalScene => toPascalScene(of).scene;

const paint = (of: PascalScene, nodeId: string, slots: Record<string, string>): PascalScene => {
  const node = of.nodes[nodeId] as PascalNode & { slots?: Record<string, string> };

  return { ...of, nodes: { ...of.nodes, [nodeId]: { ...node, slots: { ...node.slots, ...slots } } as PascalNode } };
};

const commit = (of: SpatialGraph, scene: PascalScene, ...ids: string[]) =>
  createPascalEditCommand({
    graph: normalizeSpatial(of),
    scene,
    commit: { origin: 'local', changedNodeIds: ids },
    actorId: 'U-1',
  });

const afterOf = <T>(result: ReturnType<typeof commit>): T => {
  if (!result.ok) throw new Error(result.error.reasons.join(' '));
  expect(result.data.changes).toHaveLength(1);

  return result.data.changes[0]?.after as T;
};

/** Thay phòng/tường trong bản vẽ bằng bản sau lượt sửa — như store làm sau khi lưu. */
const withRoom = (next: Room): SpatialGraph => ({
  ...graph,
  rooms: graph.rooms.map((candidate) => (candidate.id === next.id ? next : candidate)),
});
const withWall = (next: Wall): SpatialGraph => ({
  ...graph,
  walls: graph.walls.map((candidate) => (candidate.id === next.id ? next : candidate)),
});

const surfaceOf = (scene: PascalScene): string | undefined =>
  (scene.nodes[slabId] as { slots?: Record<string, string> }).slots?.['surface'];

describe('W3a — sơn sàn và tường', () => {
  it('cảnh không đụng tới: không có lệnh (không sửa ma)', () => {
    const result = commit(graph, sceneOf(graph), slabId, wallId);

    expect(result.ok ? 'ok' : result.error.code).toBe('PASCAL_NO_CHANGE');
  });

  it('sàn đổi sang sàn của một finish trong phong cách: ghi finish, không floorMaterial', () => {
    const current = surfaceOf(sceneOf(graph));
    const finish = (['wood', 'tile', 'mosaic', 'decking', 'concrete'] as const).find(
      (key) => style.floor[key] !== current,
    );

    if (finish === undefined) throw new Error('phong cách phải có hơn một mặt sàn');

    const after = afterOf<Room>(commit(graph, paint(sceneOf(graph), slabId, { surface: style.floor[finish] }), slabId));

    expect(after.finish).toBe(finish);
    expect(after.floorMaterial).toBeUndefined();
  });

  it('sàn đổi sang vật liệu ngoài bộ sàn: ghi floorMaterial; mở lại ra đúng sàn ấy, đọc lại không đổi', () => {
    const after = afterOf<Room>(commit(graph, paint(sceneOf(graph), slabId, { surface: WALL_REF }), slabId));

    expect(after.floorMaterial).toBe(WALL_REF);

    const reopened = sceneOf(withRoom(after));

    expect(surfaceOf(reopened)).toBe(WALL_REF);

    const again = commit(withRoom(after), reopened, slabId);

    expect(again.ok ? 'ok' : again.error.code).toBe('PASCAL_NO_CHANGE');
  });

  it('sơn sàn về lại mặt phong cách cho: bỏ floorMaterial', () => {
    const painted = withRoom({ ...room, floorMaterial: WALL_REF });
    const styleSurface = surfaceOf(sceneOf(graph)) as string;
    const after = afterOf<Room>(commit(painted, paint(sceneOf(painted), slabId, { surface: styleSurface }), slabId));

    expect(after.floorMaterial).toBeUndefined();
  });

  it('mặt tường sơn lại: ghi Wall.paint đúng mặt; mở lại giữ màu, đọc lại không đổi', () => {
    const ref = style.floor.wood;
    const after = afterOf<Wall>(commit(graph, paint(sceneOf(graph), wallId, { interior: ref }), wallId));

    expect(after.paint).toEqual({ interior: ref });

    const reopened = sceneOf(withWall(after));

    expect((reopened.nodes[wallId] as { slots?: Record<string, string> }).slots?.['interior']).toBe(ref);

    const again = commit(withWall(after), reopened, wallId);

    expect(again.ok ? 'ok' : again.error.code).toBe('PASCAL_NO_CHANGE');
  });

  it('vật liệu thư viện ngoài bộ phong cách (`library:<id>` của MATERIAL_CATALOG): lưu được', () => {
    const ref = `library:${LIBRARY_MATERIAL_IDS.at(-1) ?? ''}` as MaterialRef;
    const after = afterOf<Wall>(commit(graph, paint(sceneOf(graph), wallId, { exterior: ref }), wallId));

    expect(saveableRef(ref)).toBe(true);
    expect(saveableRef('library:khong-co-trong-thu-vien')).toBe(false);
    expect(after.paint).toEqual({ exterior: ref });
  });

  it('màu tự pha (scene.materials của người dùng) chưa lưu: không có lệnh', () => {
    const scene = paint(paint(sceneOf(graph), slabId, { surface: CUSTOM }), wallId, { exterior: CUSTOM });
    const result = commit(graph, scene, slabId, wallId);

    expect(result.ok ? 'ok' : result.error.code).toBe('PASCAL_NO_CHANGE');
  });
});
