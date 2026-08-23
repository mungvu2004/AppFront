/**
 * Textures that are drawn, not loaded.
 *
 * Three finishes need more than a flat colour — boards, tiles, and the soft
 * shadow a heavy piece of furniture casts on the floor around it — and all three
 * are painted onto a 2D canvas in token colours and wrapped as a
 * `CanvasTexture`. No image assets ship with the route, every texture follows
 * the theme, and because an extruded slab's UVs are its plan coordinates in
 * metres, one floor tile stands for exactly one square metre of floor with no
 * UV work at all.
 *
 * Every function returns `null` where there is no 2D canvas — jsdom, a worker —
 * and the caller paints a flat colour instead. That is the whole of the fallback
 * and it is why these can be exercised in a test that has no canvas at all.
 */

import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Color, type Texture } from 'three';

import type { ScenePalette } from './palette';

/* -------------------------------------------------------------------------- */
/* Constants.                                                                  */
/* -------------------------------------------------------------------------- */

/** Pixels across one metre-square floor tile. */
const FLOOR_TEXTURE_PX = 256;

/** Rows of boards in one metre-square tile — 167 mm planks. */
const PLANK_ROWS = 6;

/** Tiles along each edge of one metre-square tile — 333 mm tiles. */
const TILE_COLUMNS = 3;

/** Grout and board gaps, as a fraction of the tile. */
const JOINT_FRACTION = 0.012;

/** Pixels across a contact-shadow blob. */
const SHADOW_TEXTURE_PX = 128;

/* -------------------------------------------------------------------------- */
/* Helpers.                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A deterministic pseudo-random in `[0, 1)`, so a floor looks the same on every
 * mount and a visual snapshot stays stable. Plain hashing — nothing about it
 * needs to be good, it only needs to be repeatable.
 */
export function noise(seed: number): number {
  const scrambled = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return scrambled - Math.floor(scrambled);
}

/** Mix two token colours, as a CSS string for the 2D canvas. */
function blend(first: Color, second: Color, amount: number): string {
  return first.clone().lerp(second, amount).getStyle();
}

function createContext(sizePx: number): CanvasRenderingContext2D | null {
  const canvas = document.createElement('canvas');
  canvas.width = sizePx;
  canvas.height = sizePx;
  return canvas.getContext('2d');
}

function wrapFloorTexture(context: CanvasRenderingContext2D): Texture {
  const texture = new CanvasTexture(context.canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/* -------------------------------------------------------------------------- */
/* Floors.                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * One square metre of boards: six planks across, each its own shade, with the
 * end joints staggered so the floor does not read as stripes.
 */
export function createPlankTexture(palette: ScenePalette): Texture | null {
  const context = createContext(FLOOR_TEXTURE_PX);

  if (context === null) {
    return null;
  }

  const size = FLOOR_TEXTURE_PX;
  const plankHeight = size / PLANK_ROWS;
  const joint = size * JOINT_FRACTION;

  context.fillStyle = palette.woodDark.getStyle();
  context.fillRect(0, 0, size, size);

  for (let row = 0; row < PLANK_ROWS; row += 1) {
    const top = row * plankHeight;
    const seam = noise(row + 1) * size;

    // Two boards per row, split at a staggered seam; each gets its own shade.
    const segments: readonly (readonly [number, number])[] = [
      [0, seam],
      [seam, size],
    ];

    segments.forEach(([from, to], index) => {
      const shade = noise(row * 7 + index * 3 + 11) * 0.55;
      context.fillStyle = blend(palette.wood, palette.woodDark, shade);
      context.fillRect(from + joint / 2, top + joint / 2, to - from - joint, plankHeight - joint);

      // A few faint grain lines along the board.
      context.fillStyle = blend(palette.wood, palette.woodDark, shade + 0.25);
      for (let line = 0; line < 3; line += 1) {
        const y = top + plankHeight * (0.2 + 0.3 * line) + noise(row * 13 + line) * 4;
        context.fillRect(from + joint, y, to - from - joint * 2, 1);
      }
    });
  }

  return wrapFloorTexture(context);
}

/** One square metre of tiles: a three-by-three grid with grout between. */
export function createTileTexture(palette: ScenePalette): Texture | null {
  const context = createContext(FLOOR_TEXTURE_PX);

  if (context === null) {
    return null;
  }

  const size = FLOOR_TEXTURE_PX;
  const tile = size / TILE_COLUMNS;
  const joint = size * JOINT_FRACTION;

  context.fillStyle = palette.grout.getStyle();
  context.fillRect(0, 0, size, size);

  for (let row = 0; row < TILE_COLUMNS; row += 1) {
    for (let column = 0; column < TILE_COLUMNS; column += 1) {
      const shade = noise(row * 5 + column * 3 + 2) * 0.18;
      context.fillStyle = blend(palette.tile, palette.grout, shade);
      context.fillRect(column * tile + joint / 2, row * tile + joint / 2, tile - joint, tile - joint);
    }
  }

  return wrapFloorTexture(context);
}

/* -------------------------------------------------------------------------- */
/* Contact shadow.                                                             */
/* -------------------------------------------------------------------------- */

/**
 * A soft dark blob, opaque at the centre and clear at the edge.
 *
 * Laid flat under a sofa or a bed it does what a shadow map cannot at this
 * size: it darkens the floor where the piece meets it, which is the cue that
 * tells an eye the piece is standing rather than floating. The colour is the
 * palette's cut black; the alpha is the whole of the effect, and it is written
 * pixel by pixel so that no colour string is ever composed here.
 */
export function createContactShadowTexture(palette: ScenePalette): Texture | null {
  const context = createContext(SHADOW_TEXTURE_PX);

  if (context === null) {
    return null;
  }

  const size = SHADOW_TEXTURE_PX;
  const half = size / 2;
  const image = context.createImageData(size, size);
  const tint = palette.cut.clone().convertLinearToSRGB();
  const channels = [tint.r, tint.g, tint.b].map((value) => Math.round(value * 255));

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x + 0.5 - half, y + 0.5 - half) / half;
      const alpha = contactShadowFalloff(distance);
      const offset = (y * size + x) * 4;

      image.data[offset] = channels[0] ?? 0;
      image.data[offset + 1] = channels[1] ?? 0;
      image.data[offset + 2] = channels[2] ?? 0;
      image.data[offset + 3] = Math.round(alpha * 255);
    }
  }

  context.putImageData(image, 0, 0);

  const texture = new CanvasTexture(context.canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Fully dark to a third of the way out, then a smooth fade to nothing at the rim. */
export function contactShadowFalloff(distance: number): number {
  const fadeFrom = 0.35;

  if (distance <= fadeFrom) {
    return 1;
  }
  if (distance >= 1) {
    return 0;
  }

  const t = (distance - fadeFrom) / (1 - fadeFrom);
  return 1 - t * t * (3 - 2 * t);
}
