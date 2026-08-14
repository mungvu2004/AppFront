/**
 * Picking in a dense drawing, checked on the standard sample building.
 *
 * Three properties carry this file, and each is checked across the whole set of
 * operations rather than on a favourite one:
 *
 * - **The two drag directions disagree, and the box is not what separates
 *   them.** The same two corners are dragged left-to-right and right-to-left;
 *   `marqueeBox` is asserted identical for both, so the difference in what is
 *   caught can only come from the CAD rule.
 * - **A locked or hidden layer never lets an object in.** Not "the marquee
 *   skips it" — every exported operation is run against a locked layer in one
 *   loop, because a single door left open is the whole hole.
 * - **The floor being viewed is a wall, not a filter.** Same loop, same shape:
 *   with floor 0 active, no operation may return anything that lives on floor 1.
 *
 * Coordinates come from the sample fixture and are stated where a case depends
 * on them, so a failing expectation can be checked by hand.
 */

import { describe, expect, it } from 'vitest';

import {
  createSampleBuilding,
  SAMPLE_AXIS_COUNT,
  SAMPLE_DIMENSION_COUNT,
  SAMPLE_FURNITURE_COUNT,
  SAMPLE_LEVEL_COUNT,
  SAMPLE_ROOM_COUNT,
  SAMPLE_WALL_COUNT,
  sampleAxisId,
  sampleDimensionId,
  sampleDoorId,
  sampleFurnitureId,
  sampleLevelId,
  sampleRoomId,
  sampleWallId,
} from '@/domain/spatial/__fixtures__/sampleBuilding';
import { idsOnLevel, normalizeSpatial, type NormalizedSpatial } from '@/domain/spatial/normalize';
import type { EntityId, LevelId } from '@/domain/spatial/types';
import { applyMarquee, marqueeBox, marqueeHits, marqueeMode, type Marquee } from '../marquee';
import {
  clearSelection,
  combineSelection,
  invertSelection,
  isSelectable,
  isSelected,
  selectableIds,
  selectableKindOf,
  selectAllOfKind,
  selectSingle,
  toggleSelection,
  type LayerStates,
  type Selection,
  type SelectionContext,
} from '../selectionOps';

/* -------------------------------------------------------------------------- */
/* Fixture.                                                                    */
/* -------------------------------------------------------------------------- */

const SPATIAL: NormalizedSpatial = normalizeSpatial(createSampleBuilding());

const LEVEL_ZERO: LevelId = sampleLevelId(0);
const LEVEL_ONE: LevelId = sampleLevelId(1);

/**
 * How many entities of one kind land on floor 0.
 *
 * The fixture spreads entity `index` onto floor `index % 4`, so floor 0 takes
 * indices 0, 4, 8 … — one in four, rounded up.
 */
const onFirstFloor = (total: number): number => Math.ceil(total / SAMPLE_LEVEL_COUNT);

const EMPTY: Selection = [];

const NO_LAYER_STATES: LayerStates = {};
const LOCKED_WALLS: LayerStates = { wall: { locked: true, visible: true } };
const HIDDEN_FURNITURE: LayerStates = { furniture: { locked: false, visible: false } };

const contextOn = (activeLevelId: LevelId, layers: LayerStates = NO_LAYER_STATES): SelectionContext => ({
  activeLevelId,
  layers,
  spatial: SPATIAL,
});

const GROUND_FLOOR = contextOn(LEVEL_ZERO);
const FIRST_FLOOR = contextOn(LEVEL_ONE);

/*
 * Entities of floor 0, with the ground each covers:
 *
 *   wall 0        x 0 … 1 000,      y −110 … 110   (220 mm thick, on y = 0)
 *   door 0        x 300 … 1 200,    y −110 … 110   (offset 300, width 900)
 *   furniture 0   x 0 … 800,        y 0 … 800
 *   dimension 0   x 0 … 1 000,      y −500
 *   room 0        x 0 … 4 000,      y 0 … 4 250
 *   axis 0        x 0 … 48 000,     y 0
 */
const WALL_INSIDE = sampleWallId(0);
const DOOR_INSIDE = sampleDoorId(0);
const FURNITURE_INSIDE = sampleFurnitureId(0);
const DIMENSION_INSIDE = sampleDimensionId(0);
const ROOM_ACROSS = sampleRoomId(0);
const AXIS_ACROSS = sampleAxisId(0);

/** Something on floor 1: never selectable while floor 0 is being viewed. */
const WALL_UPSTAIRS = sampleWallId(1);

/**
 * The drag box: x −200 … 1 500, y −600 … 900.
 *
 * It swallows wall 0, door 0, furniture 0 and dimension 0 whole, and it cuts
 * across room 0 and axis 0, both of which run far past its right edge.
 */
const DRAG_RIGHTWARD: Marquee = { end: { x: 1500, y: 900 }, start: { x: -200, y: -600 } };
const DRAG_LEFTWARD: Marquee = { end: { x: -200, y: -600 }, start: { x: 1500, y: 900 } };

const ENCLOSED = [WALL_INSIDE, DOOR_INSIDE, FURNITURE_INSIDE, DIMENSION_INSIDE];
const TOUCHED = [...ENCLOSED, ROOM_ACROSS, AXIS_ACROSS];

const sorted = (ids: readonly EntityId[]): EntityId[] => [...ids].sort();

/* -------------------------------------------------------------------------- */
/* Eligibility.                                                                */
/* -------------------------------------------------------------------------- */

describe('eligibility', () => {
  it('accepts everything drawn on the floor being viewed when no layer is held back', () => {
    const onFloor = idsOnLevel(SPATIAL, LEVEL_ZERO);

    expect(selectableIds(GROUND_FLOOR)).toEqual([...onFloor]);
  });

  it('refuses an object on another floor', () => {
    expect(isSelectable(WALL_UPSTAIRS, GROUND_FLOOR)).toBe(false);
    expect(isSelectable(WALL_UPSTAIRS, FIRST_FLOOR)).toBe(true);
  });

  it('resolves an opening through its host wall rather than by its own field', () => {
    // Door 0 carries no level of its own; it is on floor 0 because wall 0 is.
    expect(isSelectable(DOOR_INSIDE, GROUND_FLOOR)).toBe(true);
    expect(isSelectable(DOOR_INSIDE, FIRST_FLOOR)).toBe(false);
  });

  it('refuses a locked layer and a hidden layer alike', () => {
    expect(isSelectable(WALL_INSIDE, contextOn(LEVEL_ZERO, LOCKED_WALLS))).toBe(false);
    expect(isSelectable(FURNITURE_INSIDE, contextOn(LEVEL_ZERO, HIDDEN_FURNITURE))).toBe(false);
  });

  it('refuses a level, which is a container rather than something drawn', () => {
    expect(selectableKindOf(LEVEL_ZERO)).toBeNull();
    expect(isSelectable(LEVEL_ZERO, GROUND_FLOOR)).toBe(false);
  });

  it('refuses an id the drawing does not hold', () => {
    expect(isSelectable('W-MISSING000' as EntityId, GROUND_FLOOR)).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Operations.                                                                 */
/* -------------------------------------------------------------------------- */

describe('picking', () => {
  it('replaces the selection with the one object picked', () => {
    const selection = selectSingle([ROOM_ACROSS, AXIS_ACROSS], WALL_INSIDE, GROUND_FLOOR);

    expect(selection).toEqual([WALL_INSIDE]);
  });

  it('clears the selection when the pick lands on something ineligible', () => {
    const held: Selection = [ROOM_ACROSS];

    expect(selectSingle(held, WALL_UPSTAIRS, GROUND_FLOOR)).toEqual([]);
    expect(selectSingle(held, WALL_INSIDE, contextOn(LEVEL_ZERO, LOCKED_WALLS))).toEqual([]);
  });

  it('adds with Ctrl when the object is absent and drops it when it is present', () => {
    const first = toggleSelection(EMPTY, WALL_INSIDE, GROUND_FLOOR);
    const second = toggleSelection(first, ROOM_ACROSS, GROUND_FLOOR);

    expect(second).toEqual([WALL_INSIDE, ROOM_ACROSS]);
    expect(toggleSelection(second, WALL_INSIDE, GROUND_FLOOR)).toEqual([ROOM_ACROSS]);
  });

  it('still drops an object whose layer was locked after it was selected', () => {
    const held: Selection = [WALL_INSIDE, ROOM_ACROSS];

    // Eligibility gates entry, never exit: a lock must not trap a selection.
    expect(toggleSelection(held, WALL_INSIDE, contextOn(LEVEL_ZERO, LOCKED_WALLS))).toEqual([
      ROOM_ACROSS,
    ]);
  });

  it('selects every object of one kind on the floor being viewed', () => {
    const walls = selectAllOfKind([ROOM_ACROSS], 'wall', GROUND_FLOOR);

    expect(walls).toHaveLength(onFirstFloor(SAMPLE_WALL_COUNT));
    expect(walls.every((id) => selectableKindOf(id) === 'wall')).toBe(true);
    expect(walls.every((id) => isSelectable(id, GROUND_FLOOR))).toBe(true);
    expect(selectAllOfKind(EMPTY, 'room', GROUND_FLOOR)).toHaveLength(
      onFirstFloor(SAMPLE_ROOM_COUNT),
    );
    expect(selectAllOfKind(EMPTY, 'furniture', GROUND_FLOOR)).toHaveLength(
      onFirstFloor(SAMPLE_FURNITURE_COUNT),
    );
    expect(selectAllOfKind(EMPTY, 'axis', GROUND_FLOOR)).toHaveLength(
      onFirstFloor(SAMPLE_AXIS_COUNT),
    );
    expect(selectAllOfKind(EMPTY, 'dimension', GROUND_FLOOR)).toHaveLength(
      onFirstFloor(SAMPLE_DIMENSION_COUNT),
    );
  });

  it('swaps what is selected for what is not', () => {
    const everything = selectableIds(GROUND_FLOOR);
    const inverted = invertSelection([WALL_INSIDE], GROUND_FLOOR);

    expect(inverted).toHaveLength(everything.length - 1);
    expect(isSelected(inverted, WALL_INSIDE)).toBe(false);
    expect(invertSelection(inverted, GROUND_FLOOR)).toEqual([WALL_INSIDE]);
  });

  it('leaves a locked layer out of both sides of an inversion', () => {
    const context = contextOn(LEVEL_ZERO, LOCKED_WALLS);
    const inverted = invertSelection(EMPTY, context);

    expect(inverted).toHaveLength(
      selectableIds(GROUND_FLOOR).length - onFirstFloor(SAMPLE_WALL_COUNT),
    );
    expect(inverted.some((id) => selectableKindOf(id) === 'wall')).toBe(false);
  });

  it('deselects everything', () => {
    expect(clearSelection([WALL_INSIDE, ROOM_ACROSS])).toEqual([]);
  });

  it('folds a batch of ids in, and keeps the selection a set', () => {
    const doubled = combineSelection(EMPTY, [WALL_INSIDE, WALL_INSIDE], 'replace', GROUND_FLOOR);

    expect(doubled).toEqual([WALL_INSIDE]);
    expect(combineSelection(doubled, [WALL_INSIDE, ROOM_ACROSS], 'add', GROUND_FLOOR)).toEqual([
      WALL_INSIDE,
      ROOM_ACROSS,
    ]);
    expect(combineSelection([WALL_INSIDE, ROOM_ACROSS], [WALL_INSIDE], 'subtract', GROUND_FLOOR)).toEqual(
      [ROOM_ACROSS],
    );
  });

  it('subtracts an object even once its layer is locked', () => {
    expect(
      combineSelection([WALL_INSIDE], [WALL_INSIDE], 'subtract', contextOn(LEVEL_ZERO, LOCKED_WALLS)),
    ).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* Marquee.                                                                    */
/* -------------------------------------------------------------------------- */

describe('marquee', () => {
  it('reads the rule from the drag direction, not from the box', () => {
    expect(marqueeMode(DRAG_RIGHTWARD)).toBe('window');
    expect(marqueeMode(DRAG_LEFTWARD)).toBe('crossing');
    // Same two corners either way: only the rule differs below.
    expect(marqueeBox(DRAG_RIGHTWARD)).toEqual(marqueeBox(DRAG_LEFTWARD));
  });

  it('reads a drag with no horizontal travel as the stricter window rule', () => {
    expect(marqueeMode({ end: { x: 500, y: 900 }, start: { x: 500, y: -600 } })).toBe('window');
  });

  it('catches only what it encloses when dragged left to right', () => {
    expect(sorted(marqueeHits(DRAG_RIGHTWARD, GROUND_FLOOR))).toEqual(sorted(ENCLOSED));
  });

  it('catches everything it touches when dragged right to left', () => {
    // Room 0 and axis 0 both run past the right edge of the box, so a window
    // leaves them and a crossing takes them.
    expect(sorted(marqueeHits(DRAG_LEFTWARD, GROUND_FLOOR))).toEqual(sorted(TOUCHED));
  });

  it('gives a crossing everything the window gave, and more', () => {
    const enclosed = marqueeHits(DRAG_RIGHTWARD, GROUND_FLOOR);
    const touched = marqueeHits(DRAG_LEFTWARD, GROUND_FLOOR);

    expect(enclosed.every((id) => touched.includes(id))).toBe(true);
    expect(touched.length).toBeGreaterThan(enclosed.length);
  });

  it('catches a room the drag happened entirely inside of', () => {
    // Room 0 spans x 0 … 4 000, y 0 … 4 250; this drag stays well within it and
    // crosses none of its edges.
    const inside: Marquee = { end: { x: 1000, y: 2000 }, start: { x: 2000, y: 3000 } };

    expect(marqueeHits(inside, GROUND_FLOOR)).toContain(ROOM_ACROSS);
    expect(marqueeHits({ end: inside.start, start: inside.end }, GROUND_FLOOR)).not.toContain(
      ROOM_ACROSS,
    );
  });

  it('returns hits in the order the floor holds them', () => {
    expect(marqueeHits(DRAG_LEFTWARD, GROUND_FLOOR)).toEqual([
      WALL_INSIDE,
      DOOR_INSIDE,
      FURNITURE_INSIDE,
      ROOM_ACROSS,
      AXIS_ACROSS,
      DIMENSION_INSIDE,
    ]);
  });

  it('never reaches onto another floor', () => {
    const onFloor = new Set(idsOnLevel(SPATIAL, LEVEL_ZERO));

    for (const id of marqueeHits(DRAG_LEFTWARD, GROUND_FLOOR)) {
      expect(onFloor.has(id)).toBe(true);
    }

    // Wall 1 (x 1 000 … 2 000) cuts the very same box, but it is upstairs.
    expect(marqueeHits(DRAG_LEFTWARD, GROUND_FLOOR)).not.toContain(WALL_UPSTAIRS);
    expect(marqueeHits(DRAG_LEFTWARD, FIRST_FLOOR)).toContain(WALL_UPSTAIRS);
  });

  it('encloses nothing on a floor whose objects only clip the box', () => {
    expect(marqueeHits(DRAG_RIGHTWARD, FIRST_FLOOR)).toEqual([]);
  });

  it('skips a locked layer and a hidden layer', () => {
    expect(marqueeHits(DRAG_LEFTWARD, contextOn(LEVEL_ZERO, LOCKED_WALLS))).not.toContain(
      WALL_INSIDE,
    );
    expect(marqueeHits(DRAG_LEFTWARD, contextOn(LEVEL_ZERO, HIDDEN_FURNITURE))).not.toContain(
      FURNITURE_INSIDE,
    );
  });

  it('folds its hits into the selection the modifier asked for', () => {
    expect(applyMarquee(EMPTY, DRAG_RIGHTWARD, 'replace', GROUND_FLOOR)).toEqual(ENCLOSED);
    expect(sorted(applyMarquee([ROOM_ACROSS], DRAG_RIGHTWARD, 'add', GROUND_FLOOR))).toEqual(
      sorted([ROOM_ACROSS, ...ENCLOSED]),
    );
    expect(applyMarquee(TOUCHED, DRAG_RIGHTWARD, 'subtract', GROUND_FLOOR)).toEqual([
      ROOM_ACROSS,
      AXIS_ACROSS,
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/* Invariants, checked across every operation at once.                         */
/* -------------------------------------------------------------------------- */

/** Every operation, applied to one selection, as `(selection) -> selection`. */
const everyOperation = (
  context: SelectionContext,
  intruder: EntityId,
): ((selection: Selection) => Selection)[] => [
  (selection) => selectSingle(selection, intruder, context),
  (selection) => toggleSelection(selection, intruder, context),
  (selection) => selectAllOfKind(selection, 'wall', context),
  (selection) => invertSelection(selection, context),
  (selection) => clearSelection(selection),
  (selection) => combineSelection(selection, [intruder], 'replace', context),
  (selection) => combineSelection(selection, [intruder], 'add', context),
  (selection) => applyMarquee(selection, DRAG_RIGHTWARD, 'replace', context),
  (selection) => applyMarquee(selection, DRAG_LEFTWARD, 'add', context),
];

describe('invariants', () => {
  it('never lets an object on a locked layer into the selection, whichever operation runs', () => {
    const context = contextOn(LEVEL_ZERO, LOCKED_WALLS);

    for (const operate of everyOperation(context, WALL_INSIDE)) {
      const result = operate([ROOM_ACROSS]);

      expect(result.filter((id) => selectableKindOf(id) === 'wall')).toEqual([]);
    }
  });

  it('never lets an object from another floor into the selection, whichever operation runs', () => {
    const upstairs = new Set(idsOnLevel(SPATIAL, LEVEL_ONE));

    for (const operate of everyOperation(GROUND_FLOOR, WALL_UPSTAIRS)) {
      const result = operate([ROOM_ACROSS]);

      expect(result.filter((id) => upstairs.has(id))).toEqual([]);
    }
  });

  it('returns ids the drawing holds, never entities', () => {
    for (const operate of everyOperation(GROUND_FLOOR, WALL_INSIDE)) {
      for (const id of operate([ROOM_ACROSS])) {
        expect(typeof id).toBe('string');
        expect(SPATIAL.byId[id]).toBeDefined();
      }
    }
  });

  it('holds each id at most once', () => {
    for (const operate of everyOperation(GROUND_FLOOR, WALL_INSIDE)) {
      const result = operate([ROOM_ACROSS, WALL_INSIDE]);

      expect(new Set(result).size).toBe(result.length);
    }
  });

  it('leaves the selection it was given untouched', () => {
    const held: Selection = Object.freeze([ROOM_ACROSS, WALL_INSIDE]);

    for (const operate of everyOperation(GROUND_FLOOR, AXIS_ACROSS)) {
      operate(held);
    }

    expect(held).toEqual([ROOM_ACROSS, WALL_INSIDE]);
  });

  it('returns the array it was given when nothing changed', () => {
    const picked = selectSingle(EMPTY, WALL_INSIDE, GROUND_FLOOR);

    expect(selectSingle(picked, WALL_INSIDE, GROUND_FLOOR)).toBe(picked);
    expect(clearSelection(EMPTY)).toBe(EMPTY);
    expect(combineSelection(picked, [WALL_INSIDE], 'add', GROUND_FLOOR)).toBe(picked);
    expect(toggleSelection(picked, WALL_UPSTAIRS, GROUND_FLOOR)).toBe(picked);
  });
});
