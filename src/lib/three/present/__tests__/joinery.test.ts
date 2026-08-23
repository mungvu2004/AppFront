import { Box3, Group, Mesh, Vector3 } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildFloorMesh } from '../../build/floor';
import { readPartData } from '../../build/scene';
import { dressStorey } from '../dressing';
import {
  buildRailing,
  chooseSwing,
  DOOR_OPEN_RAD,
  fitJoinery,
  isHinged,
  turnedAboutY,
  wallRun,
} from '../joinery';
import { createMaterials, type SceneMaterials } from '../materials';
import { readPalette } from '../palette';
import { toBuildableLevel, toBuildableRoom, toDomainOpening, toDomainWall, type PresentationPlan } from '../plan';

import { FIXTURE_PLAN, stubNoCanvas } from './fixtures';

let materials: SceneMaterials;

beforeEach(() => {
  stubNoCanvas();
  materials = createMaterials(readPalette(() => ''));
});

afterEach(() => {
  vi.restoreAllMocks();
});

function buildDressedStorey(plan: PresentationPlan = FIXTURE_PLAN): Group {
  const level = plan.levels[0]!;
  const storey = buildFloorMesh({
    level: toBuildableLevel(level),
    walls: plan.walls.map((wall) => toDomainWall(wall, level)),
    rooms: plan.rooms.map(toBuildableRoom),
    openings: plan.openings.map(toDomainOpening),
  });
  dressStorey(storey, plan, materials);
  return storey;
}

function meshNamed(root: Group, id: string): Mesh {
  const found = root.getObjectByName(id);
  if (!(found instanceof Mesh)) {
    throw new Error(`No mesh named ${id}`);
  }
  return found;
}

/** The fixture's door, which opens towards the room on `-x` of its wall. */
function withDoorOpening(towards: string): PresentationPlan {
  return {
    ...FIXTURE_PLAN,
    openings: FIXTURE_PLAN.openings.map((opening) =>
      opening.id === 'D-1' ? { ...opening, opensTowards: towards } : opening,
    ),
  };
}

describe('wallRun', () => {
  it('reads a wall as a start, a unit direction, a length and a turn', () => {
    const run = wallRun(FIXTURE_PLAN.walls[1]!); // W-E: (6000, 0) → (6000, 4000), along +z

    expect(run.start.x).toBeCloseTo(6);
    expect(run.along.z).toBeCloseTo(1);
    expect(run.length).toBeCloseTo(4);
    expect(run.thickness).toBeCloseTo(0.3);
    // `rotation.y = turn` carries local +x onto the wall's direction.
    expect(turnedAboutY(new Vector3(1, 0, 0), run.turn).z).toBeCloseTo(1);
  });

  it('gives a degenerate wall a direction rather than NaN', () => {
    const run = wallRun({ ...FIXTURE_PLAN.walls[0]!, end: FIXTURE_PLAN.walls[0]!.start });

    expect(run.length).toBe(0);
    expect(run.along.x).toBe(1);
    expect(Number.isNaN(run.turn)).toBe(false);
  });
});

describe('chooseSwing', () => {
  const free = new Vector3(0, 0, 1);

  it('turns positive when nothing is asked', () => {
    expect(chooseSwing(free, null)).toBe(DOOR_OPEN_RAD);
  });

  it('picks whichever turn brings the leaf nearer the side asked for', () => {
    const east = new Vector3(1, 0, 0);
    const west = new Vector3(-1, 0, 0);

    expect(turnedAboutY(free, chooseSwing(free, east)).x).toBeGreaterThan(0);
    expect(turnedAboutY(free, chooseSwing(free, west)).x).toBeLessThan(0);
  });
});

describe('fitJoinery — doors', () => {
  it('calls only a left- or right-hung door hinged', () => {
    expect(isHinged(FIXTURE_PLAN.openings[0]!)).toBe(true);
    expect(isHinged(FIXTURE_PLAN.openings[1]!)).toBe(false);
    expect(isHinged(FIXTURE_PLAN.openings[2]!)).toBe(false);
    expect(isHinged(FIXTURE_PLAN.openings[3]!)).toBe(false);
  });

  it('stands a hinged door open on its hinge edge and leaves glazing still', () => {
    const storey = buildDressedStorey();
    const leaf = meshNamed(storey, 'D-1');
    const before = new Box3().setFromObject(leaf);

    fitJoinery(storey, FIXTURE_PLAN, materials);

    // D-1 is a left-hung 800 mm door at the middle of W-P, which runs along +z
    // from (3000, 0): the hinge is on the edge nearer the wall's start.
    expect(leaf.position.x).toBeCloseTo(3);
    expect(leaf.position.z).toBeCloseTo(2 - 0.4);
    expect(Math.abs(leaf.rotation.y)).toBeCloseTo(DOOR_OPEN_RAD);

    // Open, the leaf's footprint is no longer the flat panel's.
    const after = new Box3().setFromObject(leaf);
    expect(after.max.x - after.min.x).toBeGreaterThan(before.max.x - before.min.x + 0.5);
    expect(after.min.y).toBeCloseTo(before.min.y);

    expect(meshNamed(storey, 'D-2').rotation.y).toBe(0);
    expect(meshNamed(storey, 'D-3').rotation.y).toBe(0);
  });

  it('opens the leaf towards the compass point the plan names', () => {
    for (const towards of ['west', 'east'] as const) {
      const plan = withDoorOpening(towards);
      const storey = buildDressedStorey(plan);
      fitJoinery(storey, plan, materials);

      const centre = new Box3().setFromObject(meshNamed(storey, 'D-1')).getCenter(new Vector3());
      expect(centre.x < 3, towards).toBe(towards === 'west');
    }
  });

  it('hangs a handle on both faces of the leaf', () => {
    const storey = buildDressedStorey();
    fitJoinery(storey, FIXTURE_PLAN, materials);

    const handles = meshNamed(storey, 'D-1').children.filter((child) => child instanceof Mesh);
    expect(handles).toHaveLength(2);
    expect(handles.every((handle) => (handle as Mesh).material === materials.metal)).toBe(true);
  });
});

describe('fitJoinery — frames and rails', () => {
  it('frames every panel in paint, with a sill under a window and a mullion in sliding glass', () => {
    const storey = buildDressedStorey();
    const report = fitJoinery(storey, FIXTURE_PLAN, materials);

    const frames = report.added.filter((piece) => readPartData(piece) === null);
    // One frame per hung panel: the door, the window and the sliding door.
    expect(frames).toHaveLength(3);
    for (const frame of frames) {
      frame.traverse((object) => {
        if (object instanceof Mesh) {
          expect(object.material).toBe(materials.paint);
        }
      });
    }

    // Two jambs and a head for the door; the window adds a sill and a mullion;
    // the sliding door adds a mullion only.
    const counts = frames.map((frame) => frame.children.length).sort();
    expect(counts).toEqual([3, 4, 5]);
  });

  it('replaces a balustrade with posts, bars and a handrail that carry the wall tag', () => {
    const storey = buildDressedStorey();
    const wall = meshNamed(storey, 'W-R');
    const wallBounds = new Box3().setFromObject(wall);

    const report = fitJoinery(storey, FIXTURE_PLAN, materials);

    expect(report.removed).toEqual([wall]);
    expect(wall.parent).toBeNull();

    const rail = storey.getObjectByName('W-R');
    expect(rail).toBeInstanceOf(Group);
    expect(readPartData(rail!)?.kind).toBe('wall');

    const railBounds = new Box3().setFromObject(rail!);
    expect(railBounds.min.y).toBeCloseTo(wallBounds.min.y, 1);
    expect(railBounds.max.y).toBeCloseTo(wallBounds.max.y, 1);
    expect(railBounds.min.x).toBeCloseTo(wallBounds.min.x, 0);
    expect(railBounds.max.x).toBeCloseTo(wallBounds.max.x, 0);
  });

  it('spaces posts along the run and hangs three bars between them', () => {
    const run = wallRun(FIXTURE_PLAN.walls[5]!); // 6 m balustrade
    const rail = buildRailing(run, 0, 1.05, materials);

    const meshes = rail.children.filter((child): child is Mesh => child instanceof Mesh);
    // ceil(6 / 1.2) = 5 bays → 6 posts, 3 bars, 1 handrail.
    expect(meshes).toHaveLength(10);
    expect(meshes.every((mesh) => mesh.material === materials.paint)).toBe(true);
  });

  it('leaves a stranger mesh and a void alone', () => {
    const storey = buildDressedStorey();
    const stranger = new Mesh();
    storey.add(stranger);

    const report = fitJoinery(storey, FIXTURE_PLAN, materials);

    expect(stranger.parent).toBe(storey);
    expect(storey.getObjectByName('D-4')).toBeUndefined();
    expect(report.added.some((piece) => piece.name === 'D-4')).toBe(false);
  });
});
