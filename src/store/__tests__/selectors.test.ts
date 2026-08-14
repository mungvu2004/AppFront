import { describe, it, expect, beforeEach } from 'vitest';
import { computeArea, totalArea } from '../../domain/rooms/area';
import { applySinglePatch } from '../../domain/spatial/applyPatch';
import { normalizeSpatial } from '../../domain/spatial/normalize';
import type { LevelId, Room, Wall } from '../../domain/spatial/types';
import type { PointMm } from '../../domain/units/compare';
import { millimetres } from '../../domain/units/types';
import {
  createSampleBuilding,
  SAMPLE_ROOM_COUNT,
} from '../../domain/spatial/__fixtures__/sampleBuilding';
import { useStore, type RootState } from '../index';
import {
  getRuleRunDiagnostics,
  resetSelectorCaches,
  selectFloorViolations,
  selectRoomsWithArea,
  selectSelectedEntities,
  selectTotalAreaM2,
  selectViolations,
  selectViolationsByFloor,
} from '../selectors';

const referenceGraph = createSampleBuilding();

const outlineInMm = (room: Room): readonly PointMm[] =>
  room.outline.map((point) => ({ x: millimetres(point.x), y: millimetres(point.y) }));

const levelIdAt = (index: number): LevelId => {
  const level = referenceGraph.levels.at(index);

  if (level === undefined) {
    throw new Error(`sample building has no level at index ${index}`);
  }

  return level.id;
};

const wallOnLevel = (levelId: LevelId): Wall => {
  const wall = referenceGraph.walls.find((candidate) => candidate.levelId === levelId);

  if (wall === undefined) {
    throw new Error(`sample building has no wall on level ${levelId}`);
  }

  return wall;
};

/** Applies one wall-thickness change to the loaded graph and returns the new state. */
const thickenWall = (state: RootState, wall: Wall): RootState => {
  const { spatial } = state;

  if (spatial === null) {
    throw new Error('spatial data is not loaded');
  }

  useStore.setState({
    spatial: applySinglePatch(spatial, {
      changes: { thicknessMm: wall.thicknessMm + 10 },
      id: wall.id,
      kind: 'wall',
      op: 'update',
    }),
  });

  return useStore.getState();
};

describe('store/selectors', () => {
  beforeEach(() => {
    resetSelectorCaches();
    useStore.setState({
      selectedIds: [],
      selectionMode: 'single',
      spatial: normalizeSpatial(createSampleBuilding()),
    });
  });

  it('returns the same reference when called twice with the same state', () => {
    const state = useStore.getState();

    expect(selectRoomsWithArea(state)).toBe(selectRoomsWithArea(state));
    expect(selectViolations(state)).toBe(selectViolations(state));
    expect(selectViolationsByFloor(state)).toBe(selectViolationsByFloor(state));
    expect(selectSelectedEntities(state)).toBe(selectSelectedEntities(state));
    expect(selectTotalAreaM2(state)).toBe(selectTotalAreaM2(state));
  });

  it('computes room areas and the total through the domain functions', () => {
    const state = useStore.getState();
    const rooms = selectRoomsWithArea(state);

    expect(rooms).toHaveLength(SAMPLE_ROOM_COUNT);

    for (const entry of rooms) {
      expect(entry.areaM2).toBe(computeArea(outlineInMm(entry.room)));
      expect(entry.areaM2).toBeGreaterThan(0);
    }

    expect(selectTotalAreaM2(state)).toBe(
      totalArea(rooms.map((entry) => outlineInMm(entry.room)))
    );
  });

  it('does not re-evaluate another floor when a wall changes', () => {
    const changedFloor = levelIdAt(0);
    const untouchedFloor = levelIdAt(1);
    const firstState = useStore.getState();
    const untouchedBefore = selectFloorViolations(firstState, untouchedFloor);

    const secondState = thickenWall(firstState, wallOnLevel(changedFloor));

    expect(selectFloorViolations(secondState, untouchedFloor)).toBe(untouchedBefore);

    const diagnostics = getRuleRunDiagnostics();

    expect(diagnostics).not.toBeNull();
    expect(diagnostics?.evaluated.length ?? 0).toBeGreaterThan(0);
    expect(diagnostics?.reusedTaskCount ?? 0).toBeGreaterThan(0);

    for (const task of diagnostics?.evaluated ?? []) {
      expect(task.levelId).not.toBe(untouchedFloor);
    }
  });

  it('keeps the rooms list reference when an unrelated wall changes', () => {
    const firstState = useStore.getState();
    const roomsBefore = selectRoomsWithArea(firstState);
    const totalBefore = selectTotalAreaM2(firstState);

    const secondState = thickenWall(firstState, wallOnLevel(levelIdAt(0)));

    expect(selectRoomsWithArea(secondState)).toBe(roomsBefore);
    expect(selectTotalAreaM2(secondState)).toBe(totalBefore);
  });

  it('resolves selected entities and keeps their identity while they are untouched', () => {
    const selectedWall = wallOnLevel(levelIdAt(0));
    const otherWall = wallOnLevel(levelIdAt(1));

    useStore.getState().setSelection([selectedWall.id]);

    const firstState = useStore.getState();
    const selectedBefore = selectSelectedEntities(firstState);

    expect(selectedBefore.map((entity) => entity.id)).toEqual([selectedWall.id]);

    const secondState = thickenWall(firstState, otherWall);

    expect(selectSelectedEntities(secondState)).toBe(selectedBefore);

    const thirdState = thickenWall(secondState, selectedWall);
    const selectedAfter = selectSelectedEntities(thirdState);

    expect(selectedAfter).not.toBe(selectedBefore);
    expect(selectedAfter.at(0)?.id).toBe(selectedWall.id);
  });

  it('returns shared empties when no spatial data is loaded', () => {
    useStore.setState({ spatial: null });

    const state = useStore.getState();

    expect(selectRoomsWithArea(state)).toHaveLength(0);
    expect(selectViolations(state)).toHaveLength(0);
    expect(selectViolationsByFloor(state)).toEqual({});
    expect(selectSelectedEntities(state)).toHaveLength(0);
  });
});
