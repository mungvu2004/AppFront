/**
 * The plan on `/login`, checked through the product's own builder.
 *
 * A WebGL context is not available here and not needed: `buildHouse` is the
 * part that turns `houseModel.json` into geometry, and it is the part a plan
 * edit can break. Three things are verified — every opening is cut into its
 * wall (the builder refuses rather than repairs, and a refusal shows on screen
 * as a window that is not there), every piece of furniture is a variant the
 * catalogue knows, and the ceilings the builder lays are gone again, since an
 * open box with a lid is a box.
 */

import { Mesh, PointLight, type Group } from 'three';
import { describe, expect, it, vi } from 'vitest';

import { readPartData } from '@/lib/three/build/scene';
import type { WallPartData } from '@/lib/three/build/wall';

import { buildFurniture } from './houseFurniture';
import { createMaterials, readPalette } from './houseMaterials';
import plan from './houseModel.json';
import { buildHouse } from './houseScene';

// jsdom has no 2D canvas and says so on the console every time it is asked;
// `null` is the answer the texture code is written for, so give it quietly.
vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

const materials = createMaterials(readPalette());

function partsOfKind(house: Group, kind: string): Mesh[] {
  const found: Mesh[] = [];

  house.traverse((object) => {
    if (object instanceof Mesh && readPartData(object)?.kind === kind) {
      found.push(object);
    }
  });

  return found;
}

describe('houseModel.json through buildHouse', () => {
  const house = buildHouse(materials);

  it('cuts every opening in the plan; nothing is refused', () => {
    const refusals = partsOfKind(house, 'wall').flatMap(
      (wall) => (wall.userData as WallPartData).refusals,
    );

    expect(refusals.map((refusal) => refusal.message)).toEqual([]);

    const cut = partsOfKind(house, 'wall').flatMap(
      (wall) => (wall.userData as WallPartData).openingIds,
    );

    expect(new Set(cut).size).toBe(plan.openings.length);
  });

  it('hangs a panel in every door and window, and none in the archway', () => {
    const panels = partsOfKind(house, 'opening').map((panel) => readPartData(panel)?.entityId);
    const expected = plan.openings.filter((opening) => opening.kind !== 'void').map((opening) => opening.id);

    expect([...panels].sort()).toEqual([...expected].sort());
  });

  it('lays a slab for every room and takes every ceiling away', () => {
    expect(partsOfKind(house, 'floorSlab')).toHaveLength(plan.rooms.length);
    expect(partsOfKind(house, 'ceiling')).toHaveLength(0);
  });

  it('places every piece of furniture the plan lists', () => {
    const placed: string[] = [];

    house.traverse((object) => {
      const part = readPartData(object);
      if (part?.kind === 'furniture') {
        placed.push(part.entityId);
      }
    });

    expect([...placed].sort()).toEqual(plan.furniture.map((entry) => entry.id).sort());
  });

  it('lights every room the plan names, plus each lamp on the plan', () => {
    let lights = 0;

    house.traverse((object) => {
      if (object instanceof PointLight) {
        lights += 1;
      }
    });

    const lamps = plan.furniture.filter((entry) =>
      ['floorLamp', 'tableLamp', 'pendant'].includes(entry.variant),
    ).length;

    expect(lights).toBe(plan.ceilingLights.roomIds.length + lamps);
  });
});

describe('buildFurniture', () => {
  it('refuses a variant the catalogue does not know', () => {
    expect(() =>
      buildFurniture(
        { id: 'F-X', variant: 'hammock', centreMm: [0, 0], sizeMm: [1, 1, 1], facing: 'north' },
        'L-G',
        materials,
      ),
    ).toThrow(RangeError);
  });

  it('refuses a facing that is not a compass point', () => {
    expect(() =>
      buildFurniture(
        { id: 'F-X', variant: 'chair', centreMm: [0, 0], sizeMm: [1, 1, 1], facing: 'up' },
        'L-G',
        materials,
      ),
    ).toThrow(RangeError);
  });
});
