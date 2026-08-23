/**
 * Every material a presentation hands out, built once from a palette.
 *
 * The builders in `../build` assign no material — colour is a token decision
 * and belongs to the caller — and this is the caller's answer: one material per
 * surface role, created together so they can be disposed together, with the
 * drawn textures from `textures.ts` attached where a finish needs one.
 *
 * Roughness values assume an environment map is present (see `environment.ts`).
 * Without one, a glossy tile or a pane of glass has nothing to reflect and reads
 * as flat; with one, the same numbers give the tile its sheen and the glass its
 * highlight. The numbers are tuned for that pairing and not meant to be read on
 * their own.
 */

import { DoubleSide, MeshBasicMaterial, MeshStandardMaterial, type Color, type Texture } from 'three';

import type { ScenePalette } from './palette';
import {
  createContactShadowTexture,
  createDeckingTexture,
  createMosaicTexture,
  createPlankTexture,
  createTileTexture,
} from './textures';

/* -------------------------------------------------------------------------- */
/* Types.                                                                      */
/* -------------------------------------------------------------------------- */

/** The standard materials, by role. */
export interface SurfaceMaterials {
  readonly plaster: MeshStandardMaterial;
  /** The outside face of an external wall: rendered grey, so the box reads as a box. */
  readonly exterior: MeshStandardMaterial;
  /** Painted joinery — doors, frames, fitted wardrobes, balcony rails. */
  readonly paint: MeshStandardMaterial;
  readonly cut: MeshStandardMaterial;
  readonly woodFloor: MeshStandardMaterial;
  readonly tileFloor: MeshStandardMaterial;
  readonly mosaicFloor: MeshStandardMaterial;
  readonly decking: MeshStandardMaterial;
  readonly wood: MeshStandardMaterial;
  readonly woodDark: MeshStandardMaterial;
  readonly fabric: MeshStandardMaterial;
  readonly textile: MeshStandardMaterial;
  /** The one warm accent — a cushion, a throw, the spine of a book. */
  readonly accent: MeshStandardMaterial;
  readonly linen: MeshStandardMaterial;
  readonly stone: MeshStandardMaterial;
  readonly metal: MeshStandardMaterial;
  /** A true reflector — a bathroom mirror. Needs the environment map to show anything. */
  readonly mirror: MeshStandardMaterial;
  readonly porcelain: MeshStandardMaterial;
  readonly foliage: MeshStandardMaterial;
  readonly clay: MeshStandardMaterial;
  readonly glass: MeshStandardMaterial;
  readonly lampShade: MeshStandardMaterial;
  readonly screen: MeshStandardMaterial;
}

/** Everything `createMaterials` made, so `disposeMaterials` can find it all. */
export interface SceneMaterials extends SurfaceMaterials {
  /** The unlit decal laid under heavy furniture; `null` where no canvas could draw it. */
  readonly contactShadow: MeshBasicMaterial | null;
  readonly textures: readonly Texture[];
}

/* -------------------------------------------------------------------------- */
/* Construction.                                                               */
/* -------------------------------------------------------------------------- */

/** How strongly a lamp shade glows. */
const LAMP_EMISSIVE_INTENSITY = 1.6;

/** How dark the floor gets directly under a heavy piece. */
const CONTACT_SHADOW_OPACITY = 0.42;

const matte = (color: Color, roughness: number): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, roughness, metalness: 0 });

/** A floor material: the texture when the canvas could draw one, a flat tint otherwise. */
function floorMaterial(
  map: Texture | null,
  tintWithMap: Color,
  tintWithout: Color,
  roughness: number,
): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: map === null ? tintWithout : tintWithMap,
    roughness,
    metalness: 0,
    ...(map === null ? {} : { map }),
  });
}

/** Build the full set from a palette. */
export function createMaterials(palette: ScenePalette): SceneMaterials {
  const plankMap = createPlankTexture(palette);
  const deckingMap = createDeckingTexture(palette);
  const tileMap = createTileTexture(palette);
  const mosaicMap = createMosaicTexture(palette);
  const shadowMap = createContactShadowTexture(palette);

  const surfaces: SurfaceMaterials = {
    plaster: matte(palette.plaster, 0.92),
    exterior: matte(palette.exterior, 0.95),
    paint: matte(palette.plaster, 0.5),
    cut: matte(palette.cut, 1),
    // Lacquered parquet: low enough roughness to catch the lamps in the boards.
    woodFloor: floorMaterial(plankMap, palette.plaster, palette.wood, 0.4),
    decking: floorMaterial(deckingMap, palette.plaster, palette.decking, 0.85),
    tileFloor: floorMaterial(tileMap, palette.plaster, palette.tile, 0.22),
    mosaicFloor: floorMaterial(mosaicMap, palette.plaster, palette.mosaic, 0.3),
    wood: matte(palette.wood, 0.5),
    woodDark: matte(palette.woodDark, 0.45),
    fabric: matte(palette.fabric, 1),
    textile: matte(palette.textile, 1),
    accent: matte(palette.ochre, 0.95),
    linen: matte(palette.plaster, 1),
    stone: matte(palette.stone, 0.25),
    // Brushed rather than mirror: with the backdrop dark, a shinier metal would
    // reflect nothing but the environment's few bright patches.
    metal: new MeshStandardMaterial({ color: palette.metal, roughness: 0.45, metalness: 0.5 }),
    mirror: new MeshStandardMaterial({ color: palette.plaster, roughness: 0.04, metalness: 1 }),
    porcelain: matte(palette.plaster, 0.15),
    foliage: matte(palette.foliage, 0.8),
    clay: matte(palette.clay, 0.9),
    glass: new MeshStandardMaterial({
      color: palette.glass,
      roughness: 0.05,
      metalness: 0,
      transparent: true,
      opacity: 0.22,
      side: DoubleSide,
    }),
    lampShade: new MeshStandardMaterial({
      color: palette.lamp,
      emissive: palette.lamp,
      emissiveIntensity: LAMP_EMISSIVE_INTENSITY,
      roughness: 1,
      metalness: 0,
    }),
    screen: matte(palette.screen, 0.35),
  };

  const contactShadow =
    shadowMap === null
      ? null
      : new MeshBasicMaterial({
          map: shadowMap,
          transparent: true,
          opacity: CONTACT_SHADOW_OPACITY,
          depthWrite: false,
        });

  return {
    ...surfaces,
    contactShadow,
    textures: [plankMap, deckingMap, tileMap, mosaicMap, shadowMap].filter((map): map is Texture => map !== null),
  };
}

/** Release every material and texture the set holds. Safe to call once. */
export function disposeMaterials(materials: SceneMaterials): void {
  const { contactShadow, textures, ...surfaces } = materials;

  for (const material of Object.values(surfaces)) {
    material.dispose();
  }
  contactShadow?.dispose();
  for (const texture of textures) {
    texture.dispose();
  }
}
