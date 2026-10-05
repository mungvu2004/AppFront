import { describe, expect, it } from 'vitest';

import { createSampleBuilding, sampleLevelId } from '../__fixtures__/sampleBuilding';
import { idsOnLevel, normalizeSpatial } from '../normalize';
import { replaceLevelEntities } from '../replaceLevelEntities';

const graph = createSampleBuilding();
const normalized = normalizeSpatial(graph);
const L0 = sampleLevelId(0);
const L1 = sampleLevelId(1);
const wallsOf = (levelId: typeof L0) => graph.walls.filter((wall) => wall.levelId === levelId);

describe('replaceLevelEntities', () => {
  it('keeps every other level by reference', () => {
    const next = replaceLevelEntities(normalized, L0, { walls: wallsOf(L0).slice(1) });

    expect(next.byLevel[L1]).toBe(normalized.byLevel[L1]);
    for (const id of idsOnLevel(normalized, L1)) {
      expect(next.byId[id]).toBe(normalized.byId[id]);
    }
    expect(next.byLevel[L0]).not.toBe(normalized.byLevel[L0]);
  });

  it('replaces walls and drops the old ones from byId and byKind', () => {
    const [first, ...kept] = wallsOf(L0);
    const dropped = first as (typeof graph.walls)[number];
    const next = replaceLevelEntities(normalized, L0, { walls: kept });

    expect(next.byId[dropped.id]).toBeUndefined();
    expect(next.byKind.wall).not.toContain(dropped.id);
    expect(next.byKind.wall).toHaveLength(normalized.byKind.wall.length - 1);
  });

  it('replaces openings of the level through their walls and leaves other levels alone', () => {
    const wallIds = new Set<string>(wallsOf(L0).map((wall) => wall.id));
    const mine = graph.openings.filter((opening) => wallIds.has(opening.wallId));
    const next = replaceLevelEntities(normalized, L0, { openings: [] });

    expect(mine.length).toBeGreaterThan(0);
    expect(next.byKind.opening).toHaveLength(normalized.byKind.opening.length - mine.length);
    for (const opening of mine) {
      expect(next.byId[opening.id]).toBeUndefined();
      expect(next.byLevel[L0]).not.toContain(opening.id);
    }
  });

  it('keeps kinds whose key is absent', () => {
    const next = replaceLevelEntities(normalized, L0, { rooms: [], furniture: [] });

    expect(next.byKind.wall).toBe(normalized.byKind.wall);
    expect(wallsOf(L0).every((wall) => next.byId[wall.id] === wall)).toBe(true);
    expect(next.byKind.room.length).toBeLessThan(normalized.byKind.room.length);
    expect(next.byKind.furniture.length).toBeLessThan(normalized.byKind.furniture.length);
  });

  it('adds a level that was missing and registers the entities placed on it', () => {
    const base = replaceLevelEntities(normalized, L0, {});
    const level = { ...(graph.levels[0] as (typeof graph.levels)[number]), id: sampleLevelId(9), name: 'Mới' };
    const wall = { ...(graph.walls[0] as (typeof graph.walls)[number]), id: 'W-NEWWALL001' as const, levelId: level.id };
    const next = replaceLevelEntities(base, level.id, { level, walls: [wall] });

    expect(next.byId[level.id]).toBe(level);
    expect(next.byKind.level).toContain(level.id);
    expect(next.byLevel[level.id]).toEqual([wall.id]);

    const again = replaceLevelEntities(next, level.id, { level });

    expect(again.byKind.level.filter((id) => id === level.id)).toHaveLength(1);
  });

  it('does not list an opening whose wall sits on another level', () => {
    const wallOnL1 = wallsOf(L1)[0] as (typeof graph.walls)[number];
    const stray = { ...(graph.openings[0] as (typeof graph.openings)[number]), wallId: wallOnL1.id };
    const next = replaceLevelEntities(normalized, L0, { openings: [stray] });

    expect(next.byId[stray.id]).toBe(stray);
    expect(next.byLevel[L0]).not.toContain(stray.id);
  });

  it('replaces axes and dimensions of the level only', () => {
    const next = replaceLevelEntities(normalized, L0, { axes: [], dimensions: [] });
    const onL0 = (items: readonly { readonly levelId: string }[]): number =>
      items.filter((item) => item.levelId === L0).length;

    expect(onL0(graph.axes) + onL0(graph.dimensions)).toBeGreaterThan(0);
    expect(next.byKind.axis).toHaveLength(normalized.byKind.axis.length - onL0(graph.axes));
    expect(next.byKind.dimension).toHaveLength(normalized.byKind.dimension.length - onL0(graph.dimensions));
    expect(next.byLevel[L1]).toBe(normalized.byLevel[L1]);
  });
});
