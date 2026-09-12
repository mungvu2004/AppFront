/**
 * A wall carries its openings between floors — on the branch the application
 * really uses.
 *
 * `changeToPatch` (`lib/commands/invert.ts`) emits `op:'add'` for every change
 * whose `after` is not null, which is every edit and every undo of an existing
 * entity. `add` replaces as well as inserts, so that is the branch a wall moving
 * floors travels through; only `update` used to carry the openings along, and
 * `update` is the branch nothing in the application emits. A wall that changed
 * level therefore left its doors indexed on the floor it had left, and
 * `toBuildFloorInput` threw on the old floor while quietly missing them on the
 * new one.
 */

import { describe, expect, it } from 'vitest';

import { applyPatch } from '../applyPatch';
import { normalizeSpatial, type NormalizedSpatial } from '../normalize';
import type { Level, Opening, SpatialGraph, Wall } from '../types';

const GROUND = 'L-000001AAAA' as const;
const FIRST = 'L-000002AAAA' as const;
const WALL = 'W-000001AAAA' as const;
const DOOR = 'D-000001AAAA' as const;
const WINDOW = 'D-000002AAAA' as const;

const APPROVED = { confidence: 1, source: 'human', reviewed: true } as const;

const levels: Level[] = [
  { ...APPROVED, id: GROUND, name: 'Tầng 1', order: 0, elevationMm: 0, heightMm: 3600 },
  { ...APPROVED, id: FIRST, name: 'Tầng 2', order: 1, elevationMm: 3600, heightMm: 3600 },
];

const wall: Wall = {
  ...APPROVED,
  id: WALL,
  levelId: GROUND,
  centreline: { start: { x: 0, y: 0 }, end: { x: 6000, y: 0 } },
  thicknessMm: 220,
  heightMm: 3400,
  kind: 'loadBearing',
  openingIds: [DOOR, WINDOW],
};

const door: Opening = {
  ...APPROVED,
  id: DOOR,
  wallId: WALL,
  kind: 'door',
  offsetMm: 1000,
  widthMm: 900,
  heightMm: 2200,
  sillHeightMm: 0,
  swing: 'left',
};

const window: Opening = { ...door, id: WINDOW, kind: 'window', offsetMm: 3000, sillHeightMm: 900 };

const graphFixture: SpatialGraph = {
  building: { ...APPROVED, name: 'Nhà hai tầng', datumElevationMm: 0, grossFloorAreaM2: 248.6 },
  levels,
  walls: [wall],
  openings: [door, window],
  furniture: [],
  rooms: [],
  axes: [],
  dimensions: [],
  notes: [],
};

const base = (): NormalizedSpatial => normalizeSpatial(graphFixture);

/** The ids indexed on a level, sorted so the assertion is about membership. */
const onLevel = (graph: NormalizedSpatial, levelId: string): string[] =>
  [...(graph.byLevel[levelId] ?? [])].sort();

describe('applyPatch — openings follow their wall between floors', () => {
  it('starts with the wall and both openings on the ground floor', () => {
    expect(onLevel(base(), GROUND)).toEqual([DOOR, WINDOW, WALL].sort());
    expect(onLevel(base(), FIRST)).toEqual([]);
  });

  it('moves the openings with the wall on an `add` patch, not only on `update`', () => {
    const moved = applyPatch(base(), [
      { op: 'add', kind: 'wall', entity: { ...wall, levelId: FIRST } },
    ]);

    expect(onLevel(moved, GROUND)).toEqual([]);
    expect(onLevel(moved, FIRST)).toEqual([DOOR, WINDOW, WALL].sort());
  });

  it('reaches the same index whichever branch the move travels through', () => {
    const viaAdd = applyPatch(base(), [
      { op: 'add', kind: 'wall', entity: { ...wall, levelId: FIRST } },
    ]);
    const viaUpdate = applyPatch(base(), [
      { op: 'update', kind: 'wall', id: WALL, changes: { levelId: FIRST } },
    ]);

    expect(onLevel(viaAdd, FIRST)).toEqual(onLevel(viaUpdate, FIRST));
    expect(onLevel(viaAdd, GROUND)).toEqual(onLevel(viaUpdate, GROUND));
  });

  it('puts a deleted wall and its openings back on their floor when the delete is undone', () => {
    // The order the inverse replays in: `createDeleteWallCommand` removes the
    // openings before the wall, so undoing it adds the openings first — while
    // they still have no host to find a level through.
    const deleted = applyPatch(base(), [
      { op: 'remove', kind: 'opening', id: DOOR },
      { op: 'remove', kind: 'opening', id: WINDOW },
      { op: 'remove', kind: 'wall', id: WALL },
    ]);

    expect(onLevel(deleted, GROUND)).toEqual([]);

    const restored = applyPatch(deleted, [
      { op: 'add', kind: 'opening', entity: window },
      { op: 'add', kind: 'opening', entity: door },
      { op: 'add', kind: 'wall', entity: wall },
    ]);

    expect(onLevel(restored, GROUND)).toEqual([DOOR, WINDOW, WALL].sort());
  });

  it('indexes each opening once when the wall is re-added where it already is', () => {
    const again = applyPatch(base(), [{ op: 'add', kind: 'wall', entity: { ...wall, heightMm: 2800 } }]);

    expect(onLevel(again, GROUND)).toEqual([DOOR, WINDOW, WALL].sort());
    expect(again.byLevel[GROUND]).toHaveLength(3);
  });

  it('leaves the openings of every other wall where they are', () => {
    const otherWall: Wall = { ...wall, id: 'W-000002AAAA', openingIds: [] };
    const otherDoor: Opening = { ...door, id: 'D-000003AAAA', wallId: otherWall.id };
    const withTwoWalls = normalizeSpatial({
      ...graphFixture,
      walls: [wall, otherWall],
      openings: [door, window, otherDoor],
    });

    const moved = applyPatch(withTwoWalls, [
      { op: 'add', kind: 'wall', entity: { ...wall, levelId: FIRST } },
    ]);

    expect(onLevel(moved, FIRST)).toEqual([DOOR, WINDOW, WALL].sort());
    expect(onLevel(moved, GROUND)).toEqual([otherDoor.id, otherWall.id].sort());
  });
});
