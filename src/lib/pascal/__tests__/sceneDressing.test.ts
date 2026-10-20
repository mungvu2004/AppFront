import { describe, expect, it } from 'vitest';

import { SpatialGraphDocumentSchema } from '@/api/schemas/spatialGraph';
import type { RoomUsage } from '@/domain/spatial/types';
import { millimetres } from '@/domain/units/types';

import { fixtureF1, fixtureF2, type Fixture } from '../__fixtures__';
import { SITE_NODE_ID, toPascalId } from '../ids';
import { floorMaterialOf, itemSlotsOf, SCENE_MATERIALS, wallDressingOf } from '../sceneDressing';
import { SCENE_STYLE_IDS, SCENE_STYLE_MATERIALS, SCENE_STYLES, sceneStyleOf } from '../sceneStyles';
import { toPascalScene } from '../toPascal';
import type { PascalSlabNode, PascalWallNode } from '../types';

const DEFAULT = sceneStyleOf(undefined);
const GLASS = 'library:preset-glass';

const run = (fixture: Fixture) => {
  const graph = SpatialGraphDocumentSchema.parse(fixture.doc).graph;
  const { scene } = toPascalScene(graph);
  const slabOf = (roomId: string) => scene.nodes[toPascalId('slab', roomId)] as PascalSlabNode;
  const wallOf = (wallId: string) => scene.nodes[toPascalId('wall', wallId)] as PascalWallNode;
  return { graph, scene, slabOf, wallOf };
};

describe('sceneDressing (I3) — sàn, tường, vật liệu cảnh', () => {
  it('F2: mặt sàn theo công năng khi phòng không khai finish (phong cách mặc định)', () => {
    const { graph, slabOf } = run(fixtureF2());
    const byUsage: Record<RoomUsage, string> = {
      livingRoom: DEFAULT.floor.wood,
      bedroom: DEFAULT.floor.wood,
      corridor: DEFAULT.floor.wood,
      other: DEFAULT.floor.wood,
      kitchen: DEFAULT.floor.tile,
      utility: DEFAULT.floor.tile,
      bathroom: DEFAULT.floor.mosaic,
      stairwell: DEFAULT.floor.concrete,
    };
    expect(graph.rooms.length).toBeGreaterThan(0);
    for (const room of graph.rooms) expect(slabOf(room.id).slots['surface']).toBe(byUsage[room.usage]);
  });

  it('F1 ext: mặt sàn theo finish — gỗ dùng chung một id, tắm mosaic, bếp gạch, ban công decking', () => {
    const { graph, slabOf } = run(fixtureF1({ ext: true }));
    for (const room of graph.rooms) {
      expect(room.finish).toBeDefined();
      expect(slabOf(room.id).slots['surface']).toBe(DEFAULT.floor[room.finish ?? 'concrete']);
    }
    const surfaces = graph.rooms.map((room) => slabOf(room.id).slots['surface']);
    expect(surfaces.filter((s) => s === DEFAULT.floor.wood)).toHaveLength(5);
    expect(surfaces).toEqual(expect.arrayContaining([DEFAULT.floor.mosaic, DEFAULT.floor.tile, DEFAULT.floor.decking]));
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
        expect(node.slots?.['interior']).toBe(DEFAULT.wall.interior);
        expect(node.slots?.['exterior']).toBe(wall.kind === 'partition' ? DEFAULT.wall.interior : DEFAULT.wall.exterior);
        expect(node.skirting).toEqual({ enabled: true, sides: 'interior', height: 0.1, proud: 0.015, profile: 'flat' });
        expect(node.crown).toEqual({ enabled: true, sides: 'interior', height: 0.05, proud: 0.02, profile: 'flat' });
      }
    }
  });

  it('lan can 1,1 m là kính ở mọi phong cách', () => {
    for (const id of SCENE_STYLE_IDS) {
      expect(wallDressingOf({ kind: 'partition', heightMm: millimetres(1100) }, SCENE_STYLES[id])).toEqual({
        slots: { interior: GLASS, exterior: GLASS },
      });
    }
  });

  it('phong cách mặc định ổn định: bỏ tham số = truyền mặc định, gọi lại cho cùng kết quả', () => {
    const room = { usage: 'bedroom' } as const;
    const wall = { kind: 'envelope', heightMm: millimetres(2700) } as const;
    expect(floorMaterialOf(room)).toBe(floorMaterialOf(room, DEFAULT));
    expect(floorMaterialOf(room)).toBe(DEFAULT.floor.wood);
    expect(wallDressingOf(wall)).toEqual(wallDressingOf(wall, DEFAULT));
    expect(itemSlotsOf('bookshelf')).toEqual(itemSlotsOf('bookshelf', DEFAULT));
    expect(itemSlotsOf('bookshelf')).toEqual({ body: DEFAULT.families.wood, shelf: DEFAULT.families.wood });
    expect(itemSlotsOf('indoor-plant')?.['trunk']).toBe('scene:mat_appfront_bark');
    expect(itemSlotsOf('double-bed')).toBeUndefined();
  });

  it('tủ cố định không thành khối be trơn: thân tủ áo vân gỗ, tủ bếp tay nắm kim loại + mặt đá khác thân', () => {
    for (const style of Object.values(SCENE_STYLES)) {
      expect(itemSlotsOf('closet', style)).toEqual({ body: style.families.wood });
      const kitchen = itemSlotsOf('kitchen-cabinet', style);
      expect(kitchen).toEqual({
        cabinet: style.families.cabinetry,
        countertop: style.families.countertop,
        handle: style.families.metal,
      });
      expect(kitchen?.['countertop']).not.toBe(kitchen?.['cabinet']);
      expect(itemSlotsOf('kitchen-shelf', style)?.['handle']).toBe(style.families.metal);
    }
  });

  it('hai phong cách cho sàn phòng gỗ và gỗ đồ đạc khác nhau', () => {
    const room = { usage: 'livingRoom', finish: 'wood' } as const;
    const refs = new Set(SCENE_STYLE_IDS.map((id) => floorMaterialOf(room, SCENE_STYLES[id])));
    expect(refs.size).toBeGreaterThan(1);
    expect(floorMaterialOf(room, SCENE_STYLES['go-am'])).not.toBe(floorMaterialOf(room));
    expect(itemSlotsOf('dresser', SCENE_STYLES['go-am'])).not.toEqual(itemSlotsOf('dresser'));
  });

  it('scene.materials chứa mọi id `scene:` được tham chiếu, khoá theo id', () => {
    for (const fixture of [fixtureF2(), fixtureF1({ ext: true })]) {
      const { scene } = run(fixture);
      expect(Object.keys(scene.materials ?? {}).sort()).toEqual(
        [...SCENE_MATERIALS, ...SCENE_STYLE_MATERIALS].map((m) => m.id).sort(),
      );
      for (const [id, material] of Object.entries(scene.materials ?? {})) expect(material.id).toBe(id);
      const refs = Object.values(scene.nodes).flatMap((node) =>
        'slots' in node && node.slots !== undefined ? Object.values(node.slots) : [],
      );
      for (const ref of refs.filter((r) => r.startsWith('scene:')))
        expect(scene.materials?.[ref.slice('scene:'.length)]).toBeDefined();
    }
  });

  it('khu đất hiện làm đế (ranh vàng tắt lúc dựng) và giữ đường bao cho bộ vẽ', () => {
    const { scene } = run(fixtureF1({ ext: true }));
    const site = scene.nodes[SITE_NODE_ID];

    expect(site).toMatchObject({ type: 'site' });
    expect((site as { visible?: boolean } | undefined)?.visible).not.toBe(false);
    expect(site?.type === 'site' && site.polygon.points.length).toBeGreaterThanOrEqual(3);
  });
});
