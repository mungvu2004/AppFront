import { AmbientLight, DirectionalLight, Group, HemisphereLight, SpotLight, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { addCeilingLights, CEILING_LIGHT_INTENSITY, createLighting, SHADOW_MAP_SIZE } from '../lighting';
import { readPalette } from '../palette';

import { FIXTURE_PLAN } from './fixtures';

const palette = readPalette(() => '');

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
