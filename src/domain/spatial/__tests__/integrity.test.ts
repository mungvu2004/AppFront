import { describe, expect, it } from 'vitest';

import {
  createSampleBuilding,
  SAMPLE_BUILDING,
  SAMPLE_DIMENSION_COUNT,
  SAMPLE_DOOR_COUNT,
  SAMPLE_FURNITURE_COUNT,
  SAMPLE_LEVEL_COUNT,
  SAMPLE_ROOM_COUNT,
  SAMPLE_TOTAL_AREA_M2,
  SAMPLE_WALL_COUNT,
  SAMPLE_WINDOW_COUNT,
  sampleDoorId,
  sampleLevelId,
  sampleRoomId,
  sampleWallId,
} from '../__fixtures__/sampleBuilding';
import {
  checkIntegrity,
  countBySeverity,
  hasCriticalIssue,
  type IntegrityIssue,
  type IntegrityRule,
} from '../integrity';
import { normalizeSpatial, type NormalizedSpatial } from '../normalize';
import type { SpatialGraph } from '../types';

const issuesOfRule = (issues: readonly IntegrityIssue[], rule: IntegrityRule): IntegrityIssue[] =>
  issues.filter((issue) => issue.rule === rule);

const issuesFor = (issues: readonly IntegrityIssue[], entityId: string): IntegrityIssue[] =>
  issues.filter((issue) => issue.entityId === entityId);

const checkGraph = (graph: SpatialGraph): IntegrityIssue[] => checkIntegrity(normalizeSpatial(graph));

describe('the shared sample building', () => {
  it('counts 4 levels, 48 walls, 21 furniture items, 14 rooms and 34 dimensions', () => {
    expect(SAMPLE_BUILDING.levels).toHaveLength(4);
    expect(SAMPLE_BUILDING.walls).toHaveLength(48);
    expect(SAMPLE_BUILDING.furniture).toHaveLength(21);
    expect(SAMPLE_BUILDING.rooms).toHaveLength(14);
    expect(SAMPLE_BUILDING.dimensions).toHaveLength(34);
    expect(SAMPLE_BUILDING.levels).toHaveLength(SAMPLE_LEVEL_COUNT);
    expect(SAMPLE_BUILDING.walls).toHaveLength(SAMPLE_WALL_COUNT);
    expect(SAMPLE_BUILDING.furniture).toHaveLength(SAMPLE_FURNITURE_COUNT);
    expect(SAMPLE_BUILDING.rooms).toHaveLength(SAMPLE_ROOM_COUNT);
    expect(SAMPLE_BUILDING.dimensions).toHaveLength(SAMPLE_DIMENSION_COUNT);
    expect(SAMPLE_BUILDING.openings).toHaveLength(SAMPLE_DOOR_COUNT + SAMPLE_WINDOW_COUNT);
  });

  it('totals 248,60 m² of floor area', () => {
    const totalAreaM2 = SAMPLE_BUILDING.rooms.reduce((sum, room) => sum + room.areaM2, 0);

    expect(totalAreaM2).toBeCloseTo(SAMPLE_TOTAL_AREA_M2, 2);
    expect(SAMPLE_BUILDING.building.grossFloorAreaM2).toBeCloseTo(SAMPLE_TOTAL_AREA_M2, 2);
  });

  it('passes checkIntegrity with no issue at all', () => {
    expect(checkGraph(SAMPLE_BUILDING)).toEqual([]);
    expect(hasCriticalIssue(checkGraph(SAMPLE_BUILDING))).toBe(false);
  });

  it('hands out an independent copy from createSampleBuilding', () => {
    const first = createSampleBuilding();
    const second = createSampleBuilding();

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.walls[0]).not.toBe(second.walls[0]);
    expect(checkGraph(first)).toEqual([]);
  });
});

describe('checkIntegrity, rule 1: duplicate ids', () => {
  it('reports an id listed twice in a kind index as critical', () => {
    const normalized = normalizeSpatial(createSampleBuilding());
    const duplicated = sampleWallId(0);
    const broken: NormalizedSpatial = {
      ...normalized,
      byKind: { ...normalized.byKind, wall: [...normalized.byKind.wall, duplicated] },
    };

    const issues = issuesOfRule(checkIntegrity(broken), 'duplicateId');

    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('critical');
    expect(issues[0]?.entityId).toBe(duplicated);
    expect(issues[0]?.message).toContain(duplicated);
    expect(issues[0]?.message).toContain('2 lần');
  });
});

describe('checkIntegrity, rule 2: missing references', () => {
  it('reports every door of a deleted wall as critical', () => {
    const graph = createSampleBuilding();
    const removedWallId = sampleWallId(0);
    const doorId = sampleDoorId(0);
    const withoutWall: SpatialGraph = {
      ...graph,
      walls: graph.walls.filter((wall) => wall.id !== removedWallId),
    };

    const issues = checkGraph(withoutWall);
    const doorIssues = issuesFor(issues, doorId).filter((issue) => issue.rule === 'missingReference');

    expect(doorIssues).toHaveLength(1);
    expect(doorIssues[0]?.severity).toBe('critical');
    expect(doorIssues[0]?.message).toBe(`Lỗ mở ${doorId} trỏ tới tường ${removedWallId} không tồn tại.`);
    expect(hasCriticalIssue(issues)).toBe(true);
  });

  it('reports a wall pointing at a level that does not exist as critical', () => {
    const graph = createSampleBuilding();
    const orphanLevelId = sampleLevelId(SAMPLE_LEVEL_COUNT);
    const broken: SpatialGraph = {
      ...graph,
      walls: graph.walls.map((wall) =>
        wall.id === sampleWallId(0) ? { ...wall, levelId: orphanLevelId } : wall,
      ),
    };

    const issues = issuesFor(checkGraph(broken), sampleWallId(0)).filter(
      (issue) => issue.rule === 'missingReference',
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('critical');
    expect(issues[0]?.message).toContain(orphanLevelId);
  });

  it('reports a room referencing a missing wall as a warning only', () => {
    const graph = createSampleBuilding();
    const missingWallId = sampleWallId(SAMPLE_WALL_COUNT);
    const broken: SpatialGraph = {
      ...graph,
      rooms: graph.rooms.map((room) =>
        room.id === sampleRoomId(0) ? { ...room, wallIds: [missingWallId] } : room,
      ),
    };

    const issues = issuesFor(checkGraph(broken), sampleRoomId(0));

    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('warning');
    expect(issues[0]?.message).toContain(missingWallId);
  });

  it('reports a wall that does not list back an opening pointing at it', () => {
    const graph = createSampleBuilding();
    const wallId = sampleWallId(0);
    const broken: SpatialGraph = {
      ...graph,
      walls: graph.walls.map((wall) => (wall.id === wallId ? { ...wall, openingIds: [] } : wall)),
    };

    const issues = issuesFor(checkGraph(broken), wallId);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('warning');
    expect(issues[0]?.message).toContain(sampleDoorId(0));
  });
});

describe('checkIntegrity, rule 3: level membership', () => {
  it('reports an entity that sits on no level as critical', () => {
    const normalized = normalizeSpatial(createSampleBuilding());
    const orphanId = sampleWallId(0);
    const levelId = sampleLevelId(0);
    const broken: NormalizedSpatial = {
      ...normalized,
      byLevel: {
        ...normalized.byLevel,
        [levelId]: (normalized.byLevel[levelId] ?? []).filter((id) => id !== orphanId),
      },
    };

    const issues = issuesOfRule(checkIntegrity(broken), 'levelMembership');

    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('critical');
    expect(issues[0]?.message).toBe(`Đối tượng ${orphanId} không thuộc tầng nào.`);
  });

  it('reports an entity listed on two levels as critical', () => {
    const normalized = normalizeSpatial(createSampleBuilding());
    const sharedId = sampleWallId(0);
    const otherLevelId = sampleLevelId(1);
    const broken: NormalizedSpatial = {
      ...normalized,
      byLevel: {
        ...normalized.byLevel,
        [otherLevelId]: [...(normalized.byLevel[otherLevelId] ?? []), sharedId],
      },
    };

    const issues = issuesOfRule(checkIntegrity(broken), 'levelMembership');

    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('critical');
    expect(issues[0]?.message).toContain('2 tầng cùng lúc');
  });
});

describe('checkIntegrity, rule 4: zero-length walls', () => {
  it('reports a wall whose centreline collapses to a point as critical', () => {
    const graph = createSampleBuilding();
    const wallId = sampleWallId(3);
    const broken: SpatialGraph = {
      ...graph,
      walls: graph.walls.map((wall) =>
        wall.id === wallId ? { ...wall, centreline: { end: wall.centreline.start, start: wall.centreline.start } } : wall,
      ),
    };

    const issues = issuesOfRule(checkGraph(broken), 'zeroLengthWall');

    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('critical');
    expect(issues[0]?.message).toBe(`Tường ${wallId} có độ dài 0 mm.`);
  });
});

describe('checkIntegrity, rule 5: room outlines', () => {
  it('reports a room with no vertex as critical', () => {
    const graph = createSampleBuilding();
    const roomId = sampleRoomId(2);
    const broken: SpatialGraph = {
      ...graph,
      rooms: graph.rooms.map((room) => (room.id === roomId ? { ...room, outline: [] } : room)),
    };

    const issues = issuesOfRule(checkGraph(broken), 'roomOutline');

    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('critical');
    expect(issues[0]?.message).toBe(`Phòng ${roomId} chỉ có 0 đỉnh, không đủ để khép kín.`);
  });

  it('reports a repeated closing vertex as a warning', () => {
    const graph = createSampleBuilding();
    const roomId = sampleRoomId(2);
    const broken: SpatialGraph = {
      ...graph,
      rooms: graph.rooms.map((room) =>
        room.id === roomId && room.outline[0] !== undefined
          ? { ...room, outline: [...room.outline, room.outline[0]] }
          : room,
      ),
    };

    const issues = issuesOfRule(checkGraph(broken), 'roomOutline');

    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('warning');
  });
});

describe('checkIntegrity, rule 6: level elevations', () => {
  it('reports an elevation that does not rise above the level below', () => {
    const graph = createSampleBuilding();
    const brokenLevelId = sampleLevelId(2);
    const broken: SpatialGraph = {
      ...graph,
      levels: graph.levels.map((level) => (level.id === brokenLevelId ? { ...level, elevationMm: 0 } : level)),
    };

    const issues = issuesOfRule(checkGraph(broken), 'levelElevationOrder');

    // Only the pair below the broken level fails; the level above rises again.
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('warning');
    expect(issues[0]?.entityId).toBe(brokenLevelId);
    expect(issues[0]?.message).toContain('0 mm');
  });
});

describe('checkIntegrity, contract', () => {
  it('never touches the graph it inspects', () => {
    const normalized = normalizeSpatial(createSampleBuilding());
    const before = structuredClone(normalized);

    checkIntegrity(normalized);

    expect(normalized).toEqual(before);
  });

  it('groups issues by rule, in the order the rules are declared', () => {
    const graph = createSampleBuilding();
    const broken: SpatialGraph = {
      ...graph,
      levels: graph.levels.map((level) => (level.id === sampleLevelId(2) ? { ...level, elevationMm: 0 } : level)),
      rooms: graph.rooms.map((room) => (room.id === sampleRoomId(2) ? { ...room, outline: [] } : room)),
      walls: graph.walls.map((wall) =>
        wall.id === sampleWallId(3)
          ? { ...wall, centreline: { end: wall.centreline.start, start: wall.centreline.start } }
          : wall,
      ),
    };

    const rules = checkGraph(broken).map((issue) => issue.rule);

    expect(rules).toEqual(['zeroLengthWall', 'roomOutline', 'levelElevationOrder']);
  });

  it('counts issues per severity', () => {
    const graph = createSampleBuilding();
    const broken: SpatialGraph = {
      ...graph,
      rooms: graph.rooms.map((room) => (room.id === sampleRoomId(2) ? { ...room, outline: [] } : room)),
      walls: graph.walls.filter((wall) => wall.id !== sampleWallId(0)),
    };

    const issues = checkGraph(broken);
    const counts = countBySeverity(issues);

    expect(counts.critical).toBeGreaterThan(0);
    expect(counts.warning).toBeGreaterThan(0);
    expect(counts.critical + counts.warning).toBe(issues.length);
  });
});
