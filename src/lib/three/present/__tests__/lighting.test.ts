import {
  AmbientLight,
  BackSide,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  PointLight,
  SpotLight,
  Vector3,
  type MeshBasicMaterial,
  type PlaneGeometry,
} from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildProceduralPiece } from '../catalogue';
import { createStudioScene, disposeStudioScene } from '../environment';
import {
  addCeilingLights,
  budgetLights,
  CEILING_LIGHT_ANGLE_RAD,
  CEILING_LIGHT_INTENSITY,
  createLighting,
  lightPoolOf,
  roomArea,
  SHADOW_MAP_SIZE,
} from '../lighting';
import { createMaterials, type SceneMaterials } from '../materials';
import { readPalette } from '../palette';

import { FIXTURE_PLAN, stubCanvasContext, stubNoCanvas } from './fixtures';

const palette = readPalette(() => '');
let materials: SceneMaterials;

beforeEach(() => {
  stubCanvasContext();
  materials = createMaterials(palette);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createLighting', () => {
  const size = new Vector3(12, 2.5, 8);
  const lighting = createLighting(palette, size);

  it('is a sky, an ambient, a sun and a fill', () => {
    expect(lighting.lights).toHaveLength(4);
    expect(lighting.lights.filter((light) => light instanceof HemisphereLight)).toHaveLength(1);
    expect(lighting.lights.filter((light) => light instanceof AmbientLight)).toHaveLength(1);
    expect(lighting.lights.filter((light) => light instanceof DirectionalLight)).toHaveLength(2);
  });

  it('lets only the sun cast a shadow, from high up, over a box that covers the model', () => {
    const { key } = lighting;
    const fill = lighting.lights.find((light) => light instanceof DirectionalLight && light !== key);

    expect(key.castShadow).toBe(true);
    expect(fill?.castShadow).toBe(false);
    expect(key.position.y).toBeGreaterThan(Math.max(key.position.x, key.position.z));
    expect(key.shadow.mapSize.x).toBe(SHADOW_MAP_SIZE);
    expect(key.shadow.bias).toBeLessThan(0);
    expect(key.shadow.normalBias).toBeGreaterThan(0);

    const halfDiagonal = Math.hypot(size.x, size.z) / 2;
    expect(key.shadow.camera.right).toBeGreaterThanOrEqual(halfDiagonal);
    expect(key.shadow.camera.far).toBeGreaterThan(key.position.length());
  });
});

describe('addCeilingLights', () => {
  it('hangs one warm downlight per named room, at the plan height, aimed at the floor', () => {
    const house = new Group();
    const level = FIXTURE_PLAN.levels[0]!;

    const added = addCeilingLights(house, palette, level, FIXTURE_PLAN.rooms, FIXTURE_PLAN.ceilingLights);

    expect(added).toHaveLength(2);
    expect(house.children.filter((child) => child instanceof SpotLight)).toHaveLength(2);
    expect(added[0]?.position.y).toBeCloseTo(2.3);
    expect(added[0]?.position.x).toBeCloseTo(1.5);
    expect(added[0]?.intensity).toBe(CEILING_LIGHT_INTENSITY);
    expect(added[0]?.color.getHex()).toBe(palette.lamp.getHex());
    // The target is in the graph under the house, so the spot points straight down.
    expect(added[0]?.target.parent).toBe(house);
    expect(added[0]?.target.position.x).toBeCloseTo(1.5);
    expect(added[0]?.target.position.y).toBe(0);
  });

  it('adds a downlight at every extra point the plan names', () => {
    const house = new Group();
    const level = FIXTURE_PLAN.levels[0]!;
    const lights = { ...FIXTURE_PLAN.ceilingLights, positionsMm: [[5000, 3000]] };

    const added = addCeilingLights(house, palette, level, FIXTURE_PLAN.rooms, lights);

    expect(added).toHaveLength(3);
    expect(added[2]?.position.x).toBeCloseTo(5);
    expect(added[2]?.position.z).toBeCloseTo(3);
  });
});

describe('roomArea', () => {
  it('is the area of the outline in square metres, whichever way it winds', () => {
    const room = FIXTURE_PLAN.rooms[0]!;
    expect(roomArea(room)).toBeCloseTo(12);
    expect(roomArea({ ...room, outline: [...room.outline].reverse() })).toBeCloseTo(12);
  });
});

describe('budgetLights', () => {
  function houseWithLights(): { house: Group; spots: readonly SpotLight[]; lamps: PointLight[] } {
    const house = new Group();
    const level = FIXTURE_PLAN.levels[0]!;
    const lights = { ...FIXTURE_PLAN.ceilingLights, positionsMm: [[4500, 2000]] };
    const spots = addCeilingLights(house, palette, level, FIXTURE_PLAN.rooms, lights);

    const lamps: PointLight[] = [];
    for (const variant of ['floorLamp', 'tableLamp', 'sconce', 'pendant']) {
      const piece = buildProceduralPiece(variant, { w: 0.4, d: 0.2, h: 1.2 }, materials);
      piece.position.set(1, 0, 1);
      house.add(piece);
      piece.traverse((object) => {
        if (object instanceof PointLight) {
          lamps.push(object);
        }
      });
    }
    return { house, spots, lamps };
  }

  it('worths a downlight by its room, an extra point by the room it falls in, and a lamp by its kind', () => {
    const { spots, lamps } = houseWithLights();

    expect(lightPoolOf(spots[0]!)?.priority).toBeCloseTo(12);
    expect(lightPoolOf(spots[2]!)?.priority).toBeCloseTo(12);
    expect(lightPoolOf(spots[0]!)?.radius).toBeCloseTo(2.3 * Math.tan(CEILING_LIGHT_ANGLE_RAD));
    const priorities = lamps.map((lamp) => lightPoolOf(lamp)?.priority ?? 0);
    expect(priorities).toEqual([4, 2, 1, 12]);
    expect(lightPoolOf(new Group())).toBeNull();
  });

  it('keeps the most valuable lights up to the budget and draws the rest as pools', () => {
    const { house, spots, lamps } = houseWithLights();

    const report = budgetLights(house, materials, 3);

    expect(report.kept).toHaveLength(3);
    expect(report.kept).toEqual([spots[0], spots[1], spots[2]]);
    expect(report.drawn.map(({ light }) => light)).toEqual([lamps[3], lamps[0], lamps[1], lamps[2]]);

    let real = 0;
    house.traverse((object) => {
      if (object instanceof SpotLight || object instanceof PointLight) {
        real += 1;
      }
    });
    expect(real).toBe(3);
    for (const { light, pool } of report.drawn) {
      expect(light.parent).toBeNull();
      expect(pool).toBeInstanceOf(Mesh);
      expect(pool?.material).toBe(materials.lightPool);
      expect(pool?.parent?.name).toBe('');
    }
  });

  it('takes a drawn spot out with its target, and lays its pool on the house floor', () => {
    const { house, spots } = houseWithLights();

    const report = budgetLights(house, materials, 0);

    for (const spot of spots) {
      expect(spot.parent).toBeNull();
      expect(spot.target.parent).toBeNull();
    }
    const pools = report.drawn.filter(({ light }) => light instanceof SpotLight).map(({ pool }) => pool!);
    expect(pools.every((pool) => pool.parent === house)).toBe(true);
    expect(pools[0]?.position.y).toBeCloseTo(0.004);
    expect(pools[0]?.rotation.x).toBeCloseTo(-Math.PI / 2);
  });

  it('stands a sconce pool against the wall, taller than wide', () => {
    const { house, lamps } = houseWithLights();
    const sconce = lamps[2]!;

    const report = budgetLights(house, materials, 0);
    const pool = report.drawn.find(({ light }) => light === sconce)?.pool;

    expect(pool?.rotation.x).toBe(0);
    expect(pool?.position.z).toBeLessThan(0);
    const plane = pool?.geometry as PlaneGeometry;
    expect(plane.parameters.height).toBeGreaterThan(plane.parameters.width);
  });

  it('draws nothing and removes nothing when every light fits the budget', () => {
    const { house, spots, lamps } = houseWithLights();

    const report = budgetLights(house, materials, 99);

    expect(report.kept).toHaveLength(spots.length + lamps.length);
    expect(report.drawn).toHaveLength(0);
    expect(spots.every((spot) => spot.parent === house)).toBe(true);
  });

  it('still removes a light when no canvas can draw its pool', () => {
    vi.restoreAllMocks();
    stubNoCanvas();
    const bare = createMaterials(palette);
    const { house, spots } = houseWithLights();

    const report = budgetLights(house, bare, 0);

    expect(report.drawn.every(({ pool }) => pool === null)).toBe(true);
    expect(spots.every((spot) => spot.parent === null)).toBe(true);
  });
});

describe('createStudioScene', () => {
  it('is a box seen from inside with six panels brighter than white, and disposes cleanly', () => {
    const studio = createStudioScene();
    const meshes: Mesh[] = [];
    studio.traverse((object) => {
      if (object instanceof Mesh) {
        meshes.push(object);
      }
    });

    expect(meshes).toHaveLength(7);
    const room = meshes[0]!;
    expect((room.material as MeshBasicMaterial).side).toBe(BackSide);
    const panels = meshes.slice(1).map((mesh) => (mesh.material as MeshBasicMaterial).color.r);
    expect(panels.every((radiance) => radiance > 1)).toBe(true);
    expect(Math.max(...panels)).toBe(70);
    // One geometry shared by all, so one dispose frees it.
    expect(new Set(meshes.map((mesh) => mesh.geometry)).size).toBe(1);

    const spy = vi.spyOn(room.geometry, 'dispose');
    disposeStudioScene(studio);
    expect(spy).toHaveBeenCalled();
  });
});
