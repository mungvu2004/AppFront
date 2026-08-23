import { Box3, Mesh, PointLight, Vector3 } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildProceduralPiece, CATALOGUE, CATALOGUE_VARIANTS, isCatalogueVariant } from '../catalogue';
import { createMaterials, type SceneMaterials } from '../materials';
import { readPalette } from '../palette';

import { stubNoCanvas } from './fixtures';

let materials: SceneMaterials;

beforeEach(() => {
  stubNoCanvas();
  materials = createMaterials(readPalette(() => ''));
});

afterEach(() => {
  vi.restoreAllMocks();
});

const SIZE = { w: 1.2, d: 0.8, h: 0.9 };

/** Pieces that hang or stand on something else, so their base is not the floor. */
const OFF_THE_FLOOR = new Set(['pendant', 'tableLamp', 'upperRun', 'hob', 'sink']);

describe('the catalogue', () => {
  it('builds every variant into a non-empty piece', () => {
    for (const variant of CATALOGUE_VARIANTS) {
      const piece = buildProceduralPiece(variant, SIZE, materials);
      let meshes = 0;
      piece.traverse((object) => {
        if (object instanceof Mesh) {
          meshes += 1;
        }
      });
      expect(meshes, variant).toBeGreaterThan(0);
    }
  });

  it('stands every floor-standing piece on y = 0, centred on its footprint', () => {
    for (const variant of CATALOGUE_VARIANTS) {
      if (OFF_THE_FLOOR.has(variant)) {
        continue;
      }

      const piece = buildProceduralPiece(variant, SIZE, materials);
      const bounds = new Box3().setFromObject(piece);
      const centre = bounds.getCenter(new Vector3());

      expect(bounds.min.y, `${variant} base`).toBeCloseTo(0, 1);
      expect(Math.abs(centre.x), `${variant} centre x`).toBeLessThan(0.2);
      expect(Math.abs(centre.z), `${variant} centre z`).toBeLessThan(0.35);
    }
  });

  it('gives every lamp its own light', () => {
    for (const variant of ['floorLamp', 'tableLamp', 'pendant']) {
      const piece = buildProceduralPiece(variant, SIZE, materials);
      const lights = piece.children.filter((child) => child instanceof PointLight);
      expect(lights, variant).toHaveLength(1);
    }
  });

  it('marks heavy pieces for a contact shadow and light ones not', () => {
    expect(CATALOGUE.bed?.contactShadow).toBe(true);
    expect(CATALOGUE.sofa?.contactShadow).toBe(true);
    expect(CATALOGUE.pendant?.contactShadow).toBe(false);
    expect(CATALOGUE.rug?.contactShadow).toBe(false);
  });

  it('refuses a variant it does not know, including inherited object keys', () => {
    expect(isCatalogueVariant('bed')).toBe(true);
    expect(isCatalogueVariant('hammock')).toBe(false);
    expect(isCatalogueVariant('constructor')).toBe(false);
    expect(() => buildProceduralPiece('hammock', SIZE, materials)).toThrow(RangeError);
    expect(() => buildProceduralPiece('constructor', SIZE, materials)).toThrow(RangeError);
  });
});
