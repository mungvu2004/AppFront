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
 *
 * ## Two shading models
 *
 * A surface with nothing to reflect — plaster, fabric, the dark cut of a wall —
 * is Lambert: diffuse only, lit per fragment, no environment lookup and no
 * microfacet sum. A standard material costs every pixel a GGX evaluation per
 * light plus a filtered environment sample, and on a wall that is all matte
 * white it buys nothing anyone can see. The walls are most of the pixels, and
 * the difference is a fifth of the frame on an integrated GPU. Anything with
 * a sheen — floors, metal, porcelain, glass — stays standard.
 *
 * Every lit surface but glass multiplies by its vertex colour: that is where
 * `occlusion.ts` writes the baked ambient occlusion, and a geometry with no
 * such attribute draws black, so `dressing.ts` gives the built parts a white
 * one and the merge pass carries the attribute into every batch.
 */

import {
  AdditiveBlending,
  DoubleSide,
  Material,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Vector2,
  type Color,
  type Texture,
} from 'three';

import type { ScenePalette } from './palette';
import { boardCells, createReliefTexture, gridCells } from './relief';
import {
  createContactShadowTexture,
  createDeckingTexture,
  createEdgeShadeTexture,
  createLightPoolTexture,
  createMosaicTexture,
  createPlankTexture,
  createTileTexture,
} from './textures';

/* -------------------------------------------------------------------------- */
/* Types.                                                                      */
/* -------------------------------------------------------------------------- */

/** The lit materials, by role. Matte roles are Lambert; anything with a sheen is standard. */
export interface SurfaceMaterials {
  readonly plaster: MeshLambertMaterial;
  /** The outside face of an external wall: rendered grey, so the box reads as a box. */
  readonly exterior: MeshLambertMaterial;
  /** Painted joinery — doors, frames, fitted wardrobes, balcony rails. */
  readonly paint: MeshLambertMaterial;
  readonly cut: MeshLambertMaterial;
  readonly woodFloor: MeshStandardMaterial;
  readonly tileFloor: MeshStandardMaterial;
  readonly mosaicFloor: MeshStandardMaterial;
  readonly decking: MeshStandardMaterial;
  readonly wood: MeshStandardMaterial;
  readonly woodDark: MeshStandardMaterial;
  readonly fabric: MeshLambertMaterial;
  readonly textile: MeshLambertMaterial;
  /** The one warm accent — a cushion, a throw, the spine of a book. */
  readonly accent: MeshLambertMaterial;
  readonly linen: MeshLambertMaterial;
  readonly stone: MeshStandardMaterial;
  readonly metal: MeshStandardMaterial;
  /** A true reflector — a bathroom mirror. Needs the environment map to show anything. */
  readonly mirror: MeshStandardMaterial;
  readonly porcelain: MeshStandardMaterial;
  readonly foliage: MeshLambertMaterial;
  readonly clay: MeshLambertMaterial;
  readonly glass: MeshStandardMaterial;
  readonly lampShade: MeshStandardMaterial;
  readonly screen: MeshStandardMaterial;
}

/** Everything `createMaterials` made, so `disposeMaterials` can find it all. */
export interface SceneMaterials extends SurfaceMaterials {
  /** The unlit decal laid under heavy furniture; `null` where no canvas could draw it. */
  readonly contactShadow: MeshBasicMaterial | null;
  /**
   * The warm disc a drawn-not-lit lamp adds to the surface beneath it, blended
   * additively so it brightens whatever finish is there; `null` without a canvas.
   */
  readonly lightPool: MeshBasicMaterial | null;
  /** The dark strip a floor keeps along the foot of a wall; `null` without a canvas. */
  readonly edgeShade: MeshBasicMaterial | null;
  readonly textures: readonly Texture[];
}

/* -------------------------------------------------------------------------- */
/* Construction.                                                               */
/* -------------------------------------------------------------------------- */

/** How strongly a lamp shade glows. */
const LAMP_EMISSIVE_INTENSITY = 1.6;

/** How dark the floor gets directly under a heavy piece. */
const CONTACT_SHADOW_OPACITY = 0.42;

/** How much a drawn lamp brightens the centre of its pool. */
const LIGHT_POOL_OPACITY = 1;

/** How dark the floor gets right at the foot of a wall. */
const EDGE_SHADE_OPACITY = 0.38;

/** How strongly a floor's relief bends the light at its joints. */
const RELIEF_SCALE = 0.7;

/** The board and tile layouts the colour textures paint, for the relief to match. */
const PLANK_LAYOUT = { rows: 6, seed: 1 } as const;
const DECKING_LAYOUT = { rows: 8, seed: 5 } as const;
const TILE_COLUMNS = 3;
const MOSAIC_COLUMNS = 8;

/** A diffuse-only surface: nothing to reflect, so nothing spent reflecting. */
const matte = (color: Color): MeshLambertMaterial => new MeshLambertMaterial({ color, vertexColors: true });

/** A dielectric with a sheen the environment shows in. */
const satin = (color: Color, roughness: number): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, roughness, metalness: 0, vertexColors: true });

/** A floor material: the texture and its relief when the canvas could draw them, a flat tint otherwise. */
function floorMaterial(
  map: Texture | null,
  relief: Texture | null,
  tintWithMap: Color,
  tintWithout: Color,
  roughness: number,
): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: map === null ? tintWithout : tintWithMap,
    roughness,
    metalness: 0,
    vertexColors: true,
    ...(map === null ? {} : { map }),
    ...(relief === null ? {} : { normalMap: relief, normalScale: new Vector2(RELIEF_SCALE, RELIEF_SCALE) }),
  });
}

/** Build the full set from a palette. */
export function createMaterials(palette: ScenePalette): SceneMaterials {
  const plankMap = createPlankTexture(palette);
  const deckingMap = createDeckingTexture(palette);
  const tileMap = createTileTexture(palette);
  const mosaicMap = createMosaicTexture(palette);
  const shadowMap = createContactShadowTexture(palette);
  const poolMap = createLightPoolTexture(palette);
  const edgeMap = createEdgeShadeTexture(palette);
  const plankRelief = createReliefTexture(boardCells(PLANK_LAYOUT.rows, PLANK_LAYOUT.seed));
  const deckingRelief = createReliefTexture(boardCells(DECKING_LAYOUT.rows, DECKING_LAYOUT.seed));
  const tileRelief = createReliefTexture(gridCells(TILE_COLUMNS));
  const mosaicRelief = createReliefTexture(gridCells(MOSAIC_COLUMNS));

  const surfaces: SurfaceMaterials = {
    plaster: matte(palette.plaster),
    exterior: matte(palette.exterior),
    paint: matte(palette.plaster),
    cut: matte(palette.cut),
    // Lacquered parquet: low enough roughness to catch the lamps in the boards.
    woodFloor: floorMaterial(plankMap, plankRelief, palette.plaster, palette.wood, 0.4),
    decking: floorMaterial(deckingMap, deckingRelief, palette.plaster, palette.decking, 0.85),
    tileFloor: floorMaterial(tileMap, tileRelief, palette.plaster, palette.tile, 0.22),
    mosaicFloor: floorMaterial(mosaicMap, mosaicRelief, palette.plaster, palette.mosaic, 0.3),
    wood: satin(palette.wood, 0.5),
    woodDark: satin(palette.woodDark, 0.45),
    fabric: matte(palette.fabric),
    textile: matte(palette.textile),
    accent: matte(palette.ochre),
    linen: matte(palette.plaster),
    stone: satin(palette.stone, 0.25),
    // Polished enough to catch the studio's panels on a handle or a tap, not
    // so mirror-like that a dark backdrop turns it black.
    metal: new MeshStandardMaterial({
      color: palette.metal,
      roughness: 0.3,
      metalness: 0.8,
      envMapIntensity: 1.6,
      vertexColors: true,
    }),
    mirror: new MeshStandardMaterial({ color: palette.plaster, roughness: 0.04, metalness: 1, vertexColors: true }),
    porcelain: satin(palette.plaster, 0.15),
    foliage: matte(palette.foliage),
    clay: matte(palette.clay),
    glass: new MeshStandardMaterial({
      color: palette.glass,
      roughness: 0.05,
      metalness: 0,
      envMapIntensity: 2.2,
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
      vertexColors: true,
    }),
    screen: satin(palette.screen, 0.35),
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

  const lightPool =
    poolMap === null
      ? null
      : new MeshBasicMaterial({
          map: poolMap,
          color: palette.lamp,
          transparent: true,
          opacity: LIGHT_POOL_OPACITY,
          blending: AdditiveBlending,
          depthWrite: false,
        });

  const edgeShade =
    edgeMap === null
      ? null
      : new MeshBasicMaterial({ map: edgeMap, transparent: true, opacity: EDGE_SHADE_OPACITY, depthWrite: false });

  return {
    ...surfaces,
    contactShadow,
    lightPool,
    edgeShade,
    textures: [
      plankMap,
      deckingMap,
      tileMap,
      mosaicMap,
      shadowMap,
      poolMap,
      edgeMap,
      plankRelief,
      deckingRelief,
      tileRelief,
      mosaicRelief,
    ].filter((map): map is Texture => map !== null),
  };
}

/**
 * Every material's role name, by identity — how a batch's material is written
 * to the geometry cache, and how a cached batch finds its material again in a
 * later mount's fresh set (invert the map for that direction).
 */
export function materialRoles(materials: SceneMaterials): Map<Material, string> {
  const roles = new Map<Material, string>();
  for (const [role, value] of Object.entries(materials)) {
    if (value instanceof Material) {
      roles.set(value, role);
    }
  }
  return roles;
}

/** Release every material and texture the set holds. Safe to call once. */
export function disposeMaterials(materials: SceneMaterials): void {
  const { contactShadow, lightPool, edgeShade, textures, ...surfaces } = materials;

  for (const material of Object.values(surfaces)) {
    material.dispose();
  }
  contactShadow?.dispose();
  lightPool?.dispose();
  edgeShade?.dispose();
  for (const texture of textures) {
    texture.dispose();
  }
}
