import { SpatialGraphDocumentSchema } from '@/api/schemas/spatialGraph';

import { fixtureF0, fixtureF1, fixtureF2, fixtureF3, fixtureF4, fixtureF5, type Fixture } from '../__fixtures__';
import { house, stableId } from '../__fixtures__/houseModelSpatial';
import { toPascalScene } from '../toPascal';

const counts = (f: Fixture) => {
  const g = SpatialGraphDocumentSchema.parse(f.doc).graph;
  return { furniture: g.furniture.length, levels: g.levels.length, openings: g.openings.length, rooms: g.rooms.length, walls: g.walls.length };
};

const ID_W4 = /^[A-Z]-[0-9A-Z]{10,64}$/;

describe('bộ đề F0–F5 (I7)', () => {
  it.each([
    ['F0', fixtureF0()],
    ['F1', fixtureF1({ ext: false })],
    ['F2', fixtureF2()],
    ['F3', fixtureF3()],
    ['F4', fixtureF4()],
    ['F5', fixtureF5()],
  ])('%s qua SpatialGraphDocumentSchema, số đếm đúng expected', (_name, fixture) => {
    expect(counts(fixture)).toEqual(fixture.expected);
  });

  it('F1: đông → 270°, tây → 90° (yaw Pascal = −rotationDeg = FACING_TURN)', () => {
    const rotationOf = new Map(fixtureF1({ ext: false }).doc.graph.furniture.map((f) => [f['id'], f['rotationDeg']]));
    const expectedDeg = { east: 270, north: 0, south: 180, west: 90 } as const;
    const sides = new Set<string>();
    for (const f of house.furniture) {
      const facing = f.facing as keyof typeof expectedDeg;
      sides.add(facing);
      expect(rotationOf.get(stableId('F', `D1:${f.id}`)), f.id).toBe(expectedDeg[facing]);
    }
    expect(sides).toContain('east');
    expect(sides).toContain('west');
  });

  it('F1/F2: mã thực thể theo W4, không trùng', () => {
    for (const doc of [fixtureF1({ ext: false }).doc, fixtureF2().doc]) {
      const ids = [doc.graph.levels, doc.graph.walls, doc.graph.openings, doc.graph.rooms, doc.graph.furniture].flatMap((list) =>
        list.map((e) => String(e['id'])),
      );
      expect(ids.every((id) => ID_W4.test(id))).toBe(true);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('F2: phủ đủ 8 usage, 3 WallKind, 5 swing cửa đi + 5 cửa sổ, 8 kind × 4 góc quay, w = 1,5·d', () => {
    const g = SpatialGraphDocumentSchema.parse(fixtureF2().doc).graph;
    expect(new Set(g.rooms.map((r) => r.usage)).size).toBe(8);
    expect(new Set(g.walls.map((w) => w.kind)).size).toBe(3);
    for (const kind of ['door', 'window'] as const)
      expect(new Set(g.openings.filter((o) => o.kind === kind).map((o) => o.swing)).size).toBe(5);
    expect(new Set(g.furniture.map((f) => `${f.kind}@${f.rotationDeg}`)).size).toBe(32);
    for (const f of g.furniture)
      expect(f.boundingBox.max.x - f.boundingBox.min.x).toBe(1.5 * (f.boundingBox.max.y - f.boundingBox.min.y));
  });

  it('F1 ext:false không mang trường I1 nào', () => {
    const g = fixtureF1({ ext: false }).doc.graph;
    expect(g.rooms.some((r) => 'finish' in r)).toBe(false);
    expect(g.furniture.some((f) => 'variant' in f || 'heightMm' in f || 'liftMm' in f)).toBe(false);
  });

  it('F1 ext:true qua schema và giữ finish/variant/heightMm/liftMm', () => {
    const fixture = fixtureF1({ ext: true });
    expect(counts(fixture)).toEqual(fixture.expected);
    const g = SpatialGraphDocumentSchema.parse(fixture.doc).graph;
    expect(g.furniture.every((f) => 'variant' in f && 'heightMm' in f)).toBe(true);
    expect(g.furniture.some((f) => 'liftMm' in f)).toBe(true);
    expect(g.rooms.every((r) => 'finish' in r)).toBe(true);
  });

  it.each([
    ['F1 ext:false', fixtureF1({ ext: false })],
    ['F1 ext:true', fixtureF1({ ext: true })],
    ['F2', fixtureF2()],
    ['F4', fixtureF4()],
  ])('%s: toPascalScene không bỏ qua đối tượng nào', (_name, fixture) => {
    const { skipped } = toPascalScene(SpatialGraphDocumentSchema.parse(fixture.doc).graph);
    expect(skipped).toEqual([]);
  });
});
