import { Mesh, PointLight } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readPartData } from '../../build/scene';
import { assembleHouse } from '../assemble';
import { createMaterials, type SceneMaterials } from '../materials';
import { readPalette, type ScenePalette } from '../palette';

import { fakeAssets, FIXTURE_PLAN, stubNoCanvas, withModel } from './fixtures';

let palette: ScenePalette;
let materials: SceneMaterials;

beforeEach(() => {
  stubNoCanvas();
  palette = readPalette(() => '');
  materials = createMaterials(palette);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function idsOfKind(root: Parameters<typeof readPartData>[0], kind: string): string[] {
  const found: string[] = [];
  root.traverse((object) => {
    const part = readPartData(object);
    if (part?.kind === kind && (kind !== 'wall' || object instanceof Mesh)) {
      found.push(part.entityId);
    }
  });
  return found;
}

describe('assembleHouse', () => {
  it('builds the fixture without a single refusal', () => {
    const { refusals, unknownFinishes } = assembleHouse(FIXTURE_PLAN, palette, materials);

    expect(refusals).toEqual([]);
    expect(unknownFinishes).toEqual([]);
  });

  it('has a wall, a slab and a panel for everything the plan declares, and no ceiling', () => {
    const { house } = assembleHouse(FIXTURE_PLAN, palette, materials);

    expect(idsOfKind(house, 'wall').sort()).toEqual(FIXTURE_PLAN.walls.map((wall) => wall.id).sort());
    expect(idsOfKind(house, 'floorSlab').sort()).toEqual(FIXTURE_PLAN.rooms.map((room) => room.id).sort());
    expect(idsOfKind(house, 'opening').sort()).toEqual(
      FIXTURE_PLAN.openings.filter((opening) => opening.kind !== 'void').map((opening) => opening.id).sort(),
    );
    expect(idsOfKind(house, 'ceiling')).toEqual([]);
  });

  it('places every piece and hangs every light', () => {
    const { house, pieces } = assembleHouse(FIXTURE_PLAN, palette, materials);

    expect(pieces).toHaveLength(FIXTURE_PLAN.furniture.length);
    expect(idsOfKind(house, 'furniture').sort()).toEqual(FIXTURE_PLAN.furniture.map((entry) => entry.id).sort());

    let lights = 0;
    house.traverse((object) => {
      if (object instanceof PointLight) {
        lights += 1;
      }
    });
    // Two ceiling lights from the plan, one from the floor lamp.
    expect(lights).toBe(3);
  });

  it('reports a refused opening rather than hiding it', () => {
    const plan = {
      ...FIXTURE_PLAN,
      openings: [
        ...FIXTURE_PLAN.openings,
        { id: 'D-TOO-TALL', wallId: 'W-S', kind: 'window', relativePosition: 0.75, widthMm: 1000, heightMm: 3000, sillHeightMm: 500, swing: 'fixed' },
      ],
    };

    const { refusals } = assembleHouse(plan, palette, materials);

    expect(refusals.map((refusal) => refusal.openingId)).toEqual(['D-TOO-TALL']);
    expect(refusals[0]?.reason).toBe('aboveWallTop');
  });

  it('puts furniture on the storey it names, and on the first storey by default', () => {
    const plan = {
      ...FIXTURE_PLAN,
      levels: [...FIXTURE_PLAN.levels, { id: 'L-1', elevationMm: 2550, heightMm: 2400 }],
      walls: [
        ...FIXTURE_PLAN.walls,
        ...FIXTURE_PLAN.walls.slice(0, 4).map((wall) => ({ ...wall, id: `${wall.id}-1`, levelId: 'L-1' })),
      ],
      rooms: [...FIXTURE_PLAN.rooms, { ...FIXTURE_PLAN.rooms[0]!, id: 'R-A-1', levelId: 'L-1' }],
      furniture: [
        ...FIXTURE_PLAN.furniture,
        { ...FIXTURE_PLAN.furniture[0]!, id: 'F-BED-UP', levelId: 'L-1' },
      ],
    };

    const { house, pieces } = assembleHouse(plan, palette, materials);

    expect(pieces).toHaveLength(plan.furniture.length);
    const upstairs = house.getObjectByName('F-BED-UP');
    expect(readPartData(upstairs!)?.levelId).toBe('L-1');
    expect(readPartData(house.getObjectByName('F-BED')!)?.levelId).toBe('L-G');
  });

  it('hands model loading through to placement, with the abort signal', async () => {
    const assets = fakeAssets('resolve');
    const aborter = new AbortController();
    const plan = { ...FIXTURE_PLAN, furniture: [withModel(FIXTURE_PLAN.furniture[1]!, '/chair.glb')] };

    const { pieces } = assembleHouse(plan, palette, materials, { assets, signal: aborter.signal });

    expect(assets.load).toHaveBeenCalledWith('/chair.glb', aborter.signal);
    await expect(pieces[0]!.ready).resolves.toBe('model');
  });

  it('fails loudly on a plan typo', () => {
    const plan = { ...FIXTURE_PLAN, furniture: [{ ...FIXTURE_PLAN.furniture[0]!, variant: 'hammock' }] };

    expect(() => assembleHouse(plan, palette, materials)).toThrow(RangeError);
  });
});
