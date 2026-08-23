import { CanvasTexture, RepeatWrapping } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMaterials, disposeMaterials } from '../materials';
import { readPalette } from '../palette';
import {
  contactShadowFalloff,
  createContactShadowTexture,
  createPlankTexture,
  createTileTexture,
  noise,
} from '../textures';

import { stubCanvasContext, stubNoCanvas } from './fixtures';

const palette = readPalette(() => '');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('drawn textures without a canvas', () => {
  it('return null rather than throwing, so a flat tint can stand in', () => {
    stubNoCanvas();

    expect(createPlankTexture(palette)).toBeNull();
    expect(createTileTexture(palette)).toBeNull();
    expect(createContactShadowTexture(palette)).toBeNull();
  });
});

describe('drawn textures with a canvas', () => {
  it('paint boards and tiles as repeating metre tiles', () => {
    stubCanvasContext();

    const planks = createPlankTexture(palette);
    const tiles = createTileTexture(palette);

    expect(planks).toBeInstanceOf(CanvasTexture);
    expect(planks?.wrapS).toBe(RepeatWrapping);
    expect(planks?.wrapT).toBe(RepeatWrapping);
    expect(tiles).toBeInstanceOf(CanvasTexture);
    expect(tiles?.wrapS).toBe(RepeatWrapping);
  });

  it('writes the contact shadow pixel by pixel, darkest in the middle', () => {
    stubCanvasContext();

    const texture = createContactShadowTexture(palette);

    expect(texture).toBeInstanceOf(CanvasTexture);
    expect(texture?.wrapS).not.toBe(RepeatWrapping);
  });
});

describe('contactShadowFalloff', () => {
  it('is solid at the centre, gone at the rim, and smooth between', () => {
    expect(contactShadowFalloff(0)).toBe(1);
    expect(contactShadowFalloff(0.35)).toBe(1);
    expect(contactShadowFalloff(1)).toBe(0);
    expect(contactShadowFalloff(1.5)).toBe(0);

    const middle = contactShadowFalloff(0.675);
    expect(middle).toBeGreaterThan(0.4);
    expect(middle).toBeLessThan(0.6);
    expect(contactShadowFalloff(0.5)).toBeGreaterThan(contactShadowFalloff(0.8));
  });
});

describe('noise', () => {
  it('is repeatable and stays in [0, 1)', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const value = noise(seed);
      expect(value).toBe(noise(seed));
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('createMaterials', () => {
  it('tints floors flat when nothing could be drawn, and has no contact shadow', () => {
    stubNoCanvas();

    const materials = createMaterials(palette);

    expect(materials.woodFloor.map).toBeNull();
    expect(materials.tileFloor.map).toBeNull();
    expect(materials.contactShadow).toBeNull();
    expect(materials.textures).toHaveLength(0);
    expect(materials.woodFloor.color.getHex()).toBe(palette.wood.getHex());
  });

  it('attaches the drawn maps and shares the plank map between parquet and decking', () => {
    stubCanvasContext();

    const materials = createMaterials(palette);

    expect(materials.woodFloor.map).not.toBeNull();
    expect(materials.decking.map).toBe(materials.woodFloor.map);
    expect(materials.tileFloor.map).not.toBeNull();
    expect(materials.contactShadow?.transparent).toBe(true);
    expect(materials.contactShadow?.depthWrite).toBe(false);
    expect(materials.textures).toHaveLength(3);
    expect(materials.glass.transparent).toBe(true);
    expect(materials.lampShade.emissiveIntensity).toBeGreaterThan(0);
  });

  it('disposes every material and texture once', () => {
    stubCanvasContext();

    const materials = createMaterials(palette);
    const spies = [
      vi.spyOn(materials.plaster, 'dispose'),
      vi.spyOn(materials.glass, 'dispose'),
      vi.spyOn(materials.contactShadow!, 'dispose'),
      ...materials.textures.map((texture) => vi.spyOn(texture, 'dispose')),
    ];

    disposeMaterials(materials);

    for (const spy of spies) {
      expect(spy).toHaveBeenCalledTimes(1);
    }
  });
});
