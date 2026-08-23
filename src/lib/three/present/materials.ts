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
import { createContactShadowTexture, createPlankTexture, createTileTexture } from './textures';

/* -------------------------------------------------------------------------- */
/* Types.                                                                      */
/* -------------------------------------------------------------------------- */

/** The standard materials, by role. */
export interface SurfaceMaterials {
  readonly plaster: MeshStandardMaterial;
  readonly cut: MeshStandardMaterial;
  readonly woodFloor: MeshStandardMaterial;
  readonly tileFloor: MeshStandardMaterial;
  readonly decking: MeshStandardMaterial;
  readonly wood: MeshStandardMaterial;
  readonly woodDark: MeshStandardMaterial;
  readonly fabric: MeshStandardMaterial;
  readonly textile: MeshStandardMaterial;
  readonly linen: MeshStandardMaterial;
  readonly stone: MeshStandardMaterial;
  readonly metal: MeshStandardMaterial;
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
  const tileMap = createTileTexture(palette);
  const shadowMap = createContactShadowTexture(palette);

  const surfaces: SurfaceMaterials = {
    plaster: matte(palette.plaster, 0.92),
    cut: matte(palette.cut, 1),
    woodFloor: floorMaterial(plankMap, palette.plaster, palette.wood, 0.55),
    // Same boards, tinted darker: the balcony is decking, not parquet.
    decking: floorMaterial(plankMap, palette.stone, palette.woodDark, 0.8),
    tileFloor: floorMaterial(tileMap, palette.plaster, palette.tile, 0.25),
    wood: matte(palette.wood, 0.55),
    woodDark: matte(palette.woodDark, 0.5),
    fabric: matte(palette.fabric, 1),
    textile: matte(palette.textile, 1),
    linen: matte(palette.plaster, 1),
    stone: matte(palette.stone, 0.25),
    // Brushed rather than mirror: with the backdrop dark, a shinier metal would
    // reflect nothing but the environment's few bright patches.
    metal: new MeshStandardMaterial({ color: palette.metal, roughness: 0.45, metalness: 0.5 }),
    porcelain: matte(palette.plaster, 0.15),
    foliage: matte(palette.foliage, 0.8),
    clay: matte(palette.clay, 0.9),
    glass: new MeshStandardMaterial({
      color: palette.glass,
      roughness: 0.05,
      metalness: 0,
      transparent: true,
      opacity: 0.3,
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
    textures: [plankMap, tileMap, shadowMap].filter((map): map is Texture => map !== null),
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
