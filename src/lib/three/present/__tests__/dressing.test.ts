import { Mesh, type Material } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildFloorMesh } from '../../build/floor';
import { readPartData } from '../../build/scene';
import { dressStorey, floorMaterialFor, insideOutline, isGlazed, outwardSide, splitOutwardFaces } from '../dressing';
import { createMaterials, type SceneMaterials } from '../materials';
import { readPalette } from '../palette';
import { toBuildableLevel, toBuildableRoom, toDomainOpening, toDomainWall } from '../plan';

import { FIXTURE_PLAN, stubNoCanvas } from './fixtures';

let materials: SceneMaterials;

beforeEach(() => {
  stubNoCanvas();
  materials = createMaterials(readPalette(() => ''));
});

afterEach(() => {
  vi.restoreAllMocks();
});

function buildFixtureStorey(): ReturnType<typeof buildFloorMesh> {
  const level = FIXTURE_PLAN.levels[0]!;

  return buildFloorMesh({
    level: toBuildableLevel(level),
    walls: FIXTURE_PLAN.walls.map((wall) => toDomainWall(wall, level)),
    rooms: FIXTURE_PLAN.rooms.map(toBuildableRoom),
    openings: FIXTURE_PLAN.openings.map(toDomainOpening),
  });
}

function meshNamed(storey: ReturnType<typeof buildFloorMesh>, id: string): Mesh {
  const found = storey.getObjectByName(id);
  if (!(found instanceof Mesh)) {
    throw new Error(`No mesh named ${id}`);
  }
  return found;
}

const materialsOf = (mesh: Mesh): Material[] => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]);

describe('dressStorey', () => {
  it('paints a partition plaster with a dark cut, and a railing as glass', () => {
    const storey = buildFixtureStorey();
    dressStorey(storey, FIXTURE_PLAN, materials);

    expect(materialsOf(meshNamed(storey, 'W-P'))).toEqual([materials.plaster, materials.cut]);
    expect(meshNamed(storey, 'W-P').castShadow).toBe(true);
    expect(materialsOf(meshNamed(storey, 'W-R'))).toEqual([materials.glass]);
    expect(meshNamed(storey, 'W-R').castShadow).toBe(false);
  });

  it('renders the outside face of an external wall grey and keeps the inside plaster', () => {
    const storey = buildFixtureStorey();
    dressStorey(storey, FIXTURE_PLAN, materials);

    const wall = meshNamed(storey, 'W-S');
    expect(materialsOf(wall)).toEqual([materials.plaster, materials.cut, materials.exterior]);

    const groups = wall.geometry.groups;
    const byMaterial = (index: number): number =>
      groups.filter((group) => group.materialIndex === index).reduce((sum, group) => sum + group.count, 0);
    // The two big faces split evenly between inside and outside; the cut stays its own group.
    expect(byMaterial(2)).toBeGreaterThan(0);
    expect(byMaterial(0)).toBe(byMaterial(2));
    expect(byMaterial(1)).toBeGreaterThan(0);

    // W-S runs along +x at y = 0 with room R-A on +y: outside is -y.
    const outward = outwardSide(FIXTURE_PLAN.walls[0]!, FIXTURE_PLAN.rooms);
    expect(outward?.y).toBeCloseTo(-1);
    expect(outward?.x).toBeCloseTo(0);
  });

  it('gives each slab the finish its room declares', () => {
    const storey = buildFixtureStorey();
    dressStorey(storey, FIXTURE_PLAN, materials);

    expect(materialsOf(meshNamed(storey, 'R-A'))[0]).toBe(materials.woodFloor);
    expect(materialsOf(meshNamed(storey, 'R-B'))[0]).toBe(materials.tileFloor);
    expect(materialsOf(meshNamed(storey, 'R-C'))[0]).toBe(materials.decking);
    expect(materialsOf(meshNamed(storey, 'R-C'))[1]).toBe(materials.cut);
  });

  it('paints an unknown finish as tile and says so', () => {
    const storey = buildFixtureStorey();
    const plan = {
      ...FIXTURE_PLAN,
      rooms: FIXTURE_PLAN.rooms.map((room) => (room.id === 'R-A' ? { ...room, finish: 'carpet' } : room)),
    };

    const report = dressStorey(storey, plan, materials);

    expect(report.unknownFinishes).toEqual(['R-A']);
    expect(materialsOf(meshNamed(storey, 'R-A'))[0]).toBe(materials.tileFloor);
  });

  it('hangs glass in windows and sliding doors, paint in a swing door', () => {
    const storey = buildFixtureStorey();
    dressStorey(storey, FIXTURE_PLAN, materials);

    expect(materialsOf(meshNamed(storey, 'D-2'))).toEqual([materials.glass]);
    expect(materialsOf(meshNamed(storey, 'D-3'))).toEqual([materials.glass]);
    expect(meshNamed(storey, 'D-3').castShadow).toBe(false);
    expect(materialsOf(meshNamed(storey, 'D-1'))).toEqual([materials.paint]);
    expect(meshNamed(storey, 'D-1').castShadow).toBe(true);
  });

  it('takes every ceiling out and hands it back for disposal', () => {
    const storey = buildFixtureStorey();
    const before = countKind(storey, 'ceiling');

    const report = dressStorey(storey, FIXTURE_PLAN, materials);

    expect(before).toBe(FIXTURE_PLAN.rooms.length);
    expect(report.removed).toHaveLength(before);
    expect(countKind(storey, 'ceiling')).toBe(0);
    expect(report.removed.every((ceiling) => ceiling.parent === null)).toBe(true);
  });

  it('leaves a mesh that carries no part tag alone', () => {
    const storey = buildFixtureStorey();
    const stranger = new Mesh();
    storey.add(stranger);

    dressStorey(storey, FIXTURE_PLAN, materials);

    expect(stranger.parent).toBe(storey);
    expect(stranger.material).not.toBe(materials.plaster);
  });
});

describe('which way is outside', () => {
  const square = [
    [0, 0],
    [1000, 0],
    [1000, 1000],
    [0, 1000],
  ];

  it('tells a point inside an outline from one outside', () => {
    expect(insideOutline({ x: 500, y: 500 }, square)).toBe(true);
    expect(insideOutline({ x: 1500, y: 500 }, square)).toBe(false);
    expect(insideOutline({ x: 500, y: -1 }, square)).toBe(false);
  });

  it('finds no outside for a partition between two rooms, or a wall with rooms on neither side', () => {
    expect(outwardSide(FIXTURE_PLAN.walls[4]!, FIXTURE_PLAN.rooms)).toBeNull();
    expect(outwardSide(FIXTURE_PLAN.walls[0]!, [])).toBeNull();
    expect(outwardSide({ ...FIXTURE_PLAN.walls[0]!, end: FIXTURE_PLAN.walls[0]!.start }, FIXTURE_PLAN.rooms)).toBeNull();
  });

  it('leaves indexed geometry alone', () => {
    const storey = buildFixtureStorey();
    const wall = meshNamed(storey, 'W-S');
    // The extruder's geometry is non-indexed; index a copy of it by hand.
    const indexed = wall.geometry.clone();
    indexed.setIndex([...Array(indexed.getAttribute('position').count).keys()]);
    const before = indexed.groups.length;

    splitOutwardFaces(indexed, { x: 0, y: -1 });

    expect(indexed.groups).toHaveLength(before);
    indexed.dispose();
  });
});

describe('helpers', () => {
  it('maps every finish to a floor material', () => {
    expect(floorMaterialFor(materials, 'wood')).toBe(materials.woodFloor);
    expect(floorMaterialFor(materials, 'tile')).toBe(materials.tileFloor);
    expect(floorMaterialFor(materials, 'decking')).toBe(materials.decking);
    expect(floorMaterialFor(materials, 'mosaic')).toBe(materials.mosaicFloor);
  });

  it('calls windows and sliding doors glazed, and nothing else', () => {
    expect(isGlazed(FIXTURE_PLAN.openings[1])).toBe(true);
    expect(isGlazed(FIXTURE_PLAN.openings[2])).toBe(true);
    expect(isGlazed(FIXTURE_PLAN.openings[0])).toBe(false);
    expect(isGlazed(undefined)).toBe(false);
  });
});

function countKind(storey: ReturnType<typeof buildFloorMesh>, kind: string): number {
  let count = 0;
  storey.traverse((object) => {
    if (object instanceof Mesh && readPartData(object)?.kind === kind) {
      count += 1;
    }
  });
  return count;
}
