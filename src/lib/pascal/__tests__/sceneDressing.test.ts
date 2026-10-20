import { describe, expect, it } from 'vitest';

import { SpatialGraphDocumentSchema } from '@/api/schemas/spatialGraph';
import { millimetres } from '@/domain/units/types';

import { fixtureF1, fixtureF2, type Fixture } from '../__fixtures__';
import { SITE_NODE_ID, toPascalId } from '../ids';
import { SCENE_MATERIALS, wallDressingOf } from '../sceneDressing';
import { toPascalScene } from '../toPascal';
import type { PascalSlabNode, PascalWallNode } from '../types';

const WOOD = 'scene:mat_appfront_wood';
const TILE = 'scene:mat_appfront_tile';
const MOSAIC = 'scene:mat_appfront_mosaic';
const DECKING = 'scene:mat_appfront_decking';
const CONCRETE = 'library:concrete-polished';
const GLASS = 'library:preset-glass';

const run = (fixture: Fixture) => {
  const graph = SpatialGraphDocumentSchema.parse(fixture.doc).graph;
  const { scene } = toPascalScene(graph);
  const slabOf = (roomId: string) => scene.nodes[toPascalId('slab', roomId)] as PascalSlabNode;
  const wallOf = (wallId: string) => scene.nodes[toPascalId('wall', wallId)] as PascalWallNode;
  return { graph, scene, slabOf, wallOf };
};

describe('sceneDressing (I3) — sàn, tường, vật liệu cảnh', () => {
  it('F2: mặt sàn theo công năng khi phòng không khai finish', () => {
    const { graph, slabOf } = run(fixtureF2());
    const byUsage = {
      livingRoom: WOOD,
      bedroom: WOOD,
      corridor: WOOD,
      other: WOOD,
      kitchen: TILE,
      utility: TILE,
      bathroom: MOSAIC,
      stairwell: CONCRETE,
    };
    expect(graph.rooms.length).toBeGreaterThan(0);
    for (const room of graph.rooms) expect(slabOf(room.id).slots['surface']).toBe(byUsage[room.usage]);
  });

  it('F1 ext: mặt sàn theo finish — gỗ dùng chung một id, tắm mosaic, bếp gạch, ban công decking', () => {
    const { graph, slabOf } = run(fixtureF1({ ext: true }));
    const byFinish = { wood: WOOD, tile: TILE, mosaic: MOSAIC, decking: DECKING, concrete: CONCRETE };
    for (const room of graph.rooms) {
      expect(room.finish).toBeDefined();
      expect(slabOf(room.id).slots['surface']).toBe(byFinish[room.finish ?? 'concrete']);
    }
    const surfaces = graph.rooms.map((room) => slabOf(room.id).slots['surface']);
    expect(surfaces.filter((s) => s === WOOD)).toHaveLength(5);
    expect(surfaces).toEqual(expect.arrayContaining([MOSAIC, TILE, DECKING]));
  });

  it('tường có đủ hai khe + len + phào; tường thấp là kính, không len phào', () => {
    for (const fixture of [fixtureF2(), fixtureF1({ ext: true })]) {
      const { graph, wallOf } = run(fixture);
      for (const wall of graph.walls) {
        const node = wallOf(wall.id);
        expect(Object.keys(node.slots ?? {}).sort()).toEqual(['exterior', 'interior']);
        if (wall.heightMm <= 1200) {
          expect(node.slots).toEqual({ interior: GLASS, exterior: GLASS });
          expect(node.skirting).toBeUndefined();
          expect(node.crown).toBeUndefined();
          continue;
        }
        expect(node.slots?.['interior']).toBe('scene:mat_appfront_plaster');
        expect(node.slots?.['exterior']).toBe(
          wall.kind === 'partition' ? 'scene:mat_appfront_plaster' : 'scene:mat_appfront_exterior',
        );
        expect(node.skirting).toEqual({ enabled: true, sides: 'interior', height: 0.1, proud: 0.015, profile: 'flat' });
        expect(node.crown).toEqual({ enabled: true, sides: 'interior', height: 0.05, proud: 0.02, profile: 'flat' });
      }
    }
  });

  it('lan can 1,1 m là kính', () => {
    expect(wallDressingOf({ kind: 'partition', heightMm: millimetres(1100) })).toEqual({
      slots: { interior: GLASS, exterior: GLASS },
    });
  });

  it('scene.materials chứa mọi id `scene:` được tham chiếu, khoá theo id', () => {
    for (const fixture of [fixtureF2(), fixtureF1({ ext: true })]) {
      const { scene } = run(fixture);
      expect(Object.keys(scene.materials ?? {}).sort()).toEqual(SCENE_MATERIALS.map((m) => m.id).sort());
      for (const [id, material] of Object.entries(scene.materials ?? {})) expect(material.id).toBe(id);
      const refs = Object.values(scene.nodes).flatMap((node) =>
        'slots' in node && node.slots !== undefined ? Object.values(node.slots) : [],
      );
      for (const ref of refs.filter((r) => r.startsWith('scene:')))
        expect(scene.materials?.[ref.slice('scene:'.length)]).toBeDefined();
    }
  });

  it('khu đất ẩn (không nền, không ranh vàng) nhưng vẫn giữ đường bao cho bộ vẽ', () => {
    const { scene } = run(fixtureF1({ ext: true }));
    const site = scene.nodes[SITE_NODE_ID];

    expect(site).toMatchObject({ type: 'site', visible: false });
    expect(site?.type === 'site' && site.polygon.points.length).toBeGreaterThanOrEqual(3);
  });
});
