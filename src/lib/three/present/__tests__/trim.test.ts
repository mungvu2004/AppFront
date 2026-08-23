import { Group, Mesh } from 'three';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { wallRun } from '../joinery';
import { createMaterials, type SceneMaterials } from '../materials';
import { readPalette } from '../palette';
import type { PlanOpening } from '../plan';
import { fitTrim, roomedSides, skirtingRuns } from '../trim';

import { FIXTURE_PLAN, stubCanvasContext } from './fixtures';

const palette = readPalette(() => '');
let materials: SceneMaterials;

beforeEach(() => {
  stubCanvasContext();
  materials = createMaterials(palette);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const plan = { walls: FIXTURE_PLAN.walls, openings: FIXTURE_PLAN.openings, rooms: FIXTURE_PLAN.rooms };
const wallById = (id: string) => FIXTURE_PLAN.walls.find((wall) => wall.id === id)!;

describe('roomedSides', () => {
  it('gives an external wall one side, a partition two, and a wall in the open none', () => {
    expect(roomedSides(wallById('W-S'), plan)).toHaveLength(1);
    expect(roomedSides(wallById('W-P'), plan)).toHaveLength(2);
    // The fixture's railing stands past the balcony outline's far edge, in the open.
    expect(
      roomedSides({ ...wallById('W-R'), start: [0, 8000], end: [6000, 8000] }, plan),
    ).toHaveLength(0);
  });

  it('points the side into the room: the south wall faces its room northward', () => {
    const [side] = roomedSides(wallById('W-S'), plan);
    // W-S runs +x along y=0; its left normal is +y (into the flat), where the rooms are.
    expect(side).toBe(1);
  });
});

describe('skirtingRuns', () => {
  const run = wallRun(wallById('W-P'));

  it('is one full run on a wall with no door', () => {
    expect(skirtingRuns(run, [])).toEqual([[0, run.length]]);
  });

  it('cuts a door out and keeps windows', () => {
    const door: PlanOpening = { id: 'D', wallId: 'W-P', kind: 'door', relativePosition: 0.5, widthMm: 800, heightMm: 2050, sillHeightMm: 0, swing: 'left' };
    const window: PlanOpening = { ...door, id: 'W', kind: 'window', sillHeightMm: 900 };

    const runs = skirtingRuns(run, [door, window]);

    expect(runs).toHaveLength(2);
    expect(runs[0]?.[1]).toBeCloseTo(run.length / 2 - 0.4);
    expect(runs[1]?.[0]).toBeCloseTo(run.length / 2 + 0.4);
  });

  it('drops a sliver between two doors', () => {
    const doors: PlanOpening[] = [0.3, 0.32].map((at, index) => ({
      id: `D${index}`,
      wallId: 'W-P',
      kind: 'door',
      relativePosition: at,
      widthMm: 700,
      heightMm: 2050,
      sillHeightMm: 0,
      swing: 'left',
    }));

    const runs = skirtingRuns(run, doors);
    expect(runs).toHaveLength(2);
  });
});

describe('fitTrim', () => {
  it('adds skirting, cornice, floor shade, sill, threshold and kerb groups to the storey', () => {
    const storey = new Group();

    const report = fitTrim(storey, plan, FIXTURE_PLAN.levels[0]!, materials);

    // One group per wall with a run.
    expect(report.added).toHaveLength(plan.walls.length);
    expect(storey.children).toHaveLength(plan.walls.length);

    let paints = 0;
    let metals = 0;
    let shades = 0;
    storey.traverse((object) => {
      if (!(object instanceof Mesh)) {
        return;
      }
      if (object.material === materials.paint) {
        paints += 1;
      } else if (object.material === materials.metal) {
        metals += 1;
      } else if (object.material === materials.edgeShade) {
        shades += 1;
      }
    });

    // Skirtings and cornices on every roomed side, one sill, one sliding
    // threshold, one kerb under the railing; a floor shade per skirting run.
    expect(paints).toBeGreaterThan(plan.walls.length);
    expect(metals).toBe(1);
    expect(shades).toBeGreaterThanOrEqual(plan.walls.length - 2);
    expect(report.added.every((group) => group.parent === storey)).toBe(true);
  });

  it('gives a railing a kerb and nothing else', () => {
    const storey = new Group();
    const railingOnly = { ...plan, walls: [wallById('W-R')] };

    fitTrim(storey, railingOnly, FIXTURE_PLAN.levels[0]!, materials);

    const meshes: Mesh[] = [];
    storey.traverse((object) => {
      if (object instanceof Mesh) {
        meshes.push(object);
      }
    });
    expect(meshes).toHaveLength(1);
    expect(meshes[0]?.material).toBe(materials.paint);
  });

  it('stands without a canvas: no floor shades, everything else intact', () => {
    vi.restoreAllMocks();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const bare = createMaterials(palette);
    const storey = new Group();

    const report = fitTrim(storey, plan, FIXTURE_PLAN.levels[0]!, bare);

    expect(report.added.length).toBeGreaterThan(0);
    let shades = 0;
    storey.traverse((object) => {
      if (object instanceof Mesh && object.material === bare.edgeShade) {
        shades += 1;
      }
    });
    expect(shades).toBe(0);
  });
});
