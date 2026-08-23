/**
 * Textures that are drawn, not loaded.
 *
 * Four finishes need more than a flat colour — parquet boards, outdoor decking,
 * glazed tiles, a bathroom's mosaic — and so do the soft shadow a heavy piece
 * of furniture casts on the floor around it and the pool of light a lamp
 * throws on the surface beneath it. All of them are painted onto a 2D
 * canvas in token colours and wrapped as a `CanvasTexture`. No image assets
 * ship with the route, every texture follows the theme, and because an extruded
 * slab's UVs are its plan coordinates in metres, one floor tile stands for
 * exactly one square metre of floor with no UV work at all.
 *
 * Every function returns `null` where there is no 2D canvas — jsdom, a worker —
 * and the caller paints a flat colour instead. That is the whole of the fallback
 * and it is why these can be exercised in a test that has no canvas at all.
 */

import { CanvasTexture, LinearFilter, RepeatWrapping, SRGBColorSpace, type Color, type Texture } from 'three';

import type { ScenePalette } from './palette';

/* -------------------------------------------------------------------------- */
/* Constants.                                                                  */
/* -------------------------------------------------------------------------- */

/** Pixels across one metre-square floor tile. */
const FLOOR_TEXTURE_PX = 256;

/** Rows of boards in one metre-square tile — 167 mm parquet planks. */
const PLANK_ROWS = 6;

/** Rows of boards in one metre of decking — 125 mm outdoor boards. */
const DECKING_ROWS = 8;

/** Tiles along each edge of one metre-square tile — 333 mm tiles. */
const TILE_COLUMNS = 3;

/** Mosaic squares along each edge of one metre — 125 mm checks. */
const MOSAIC_COLUMNS = 8;

/** Grout and board gaps, as a fraction of the tile. */
const JOINT_FRACTION = 0.012;

/** Pixels across a contact-shadow blob, and across a lamp's pool of light. */
const SHADOW_TEXTURE_PX = 128;
const POOL_TEXTURE_PX = 128;

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
/* Boards.                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * One square metre of boards: `rows` planks across, each its own shade between
 * `light` and `dark`, with the end joints staggered so the floor does not read
 * as stripes, and a handful of grain lines along each board.
 */
function paintBoards(context: CanvasRenderingContext2D, light: Color, dark: Color, rows: number, seed: number): void {
  const size = FLOOR_TEXTURE_PX;
  const plankHeight = size / rows;
  const joint = size * JOINT_FRACTION;

  context.fillStyle = dark.getStyle();
  context.fillRect(0, 0, size, size);

  for (let row = 0; row < rows; row += 1) {
    const top = row * plankHeight;
    const seam = noise(row + seed) * size;

    // Two boards per row, split at a staggered seam; each gets its own shade.
    const segments: readonly (readonly [number, number])[] = [
      [0, seam],
      [seam, size],
    ];

    segments.forEach(([from, to], index) => {
      const shade = 0.1 + noise(row * 7 + index * 3 + seed) * 0.5;
      context.fillStyle = blend(light, dark, shade);
      context.fillRect(from + joint / 2, top + joint / 2, to - from - joint, plankHeight - joint);

      // Grain: a few darker lines running the length of the board, unevenly spaced.
      context.fillStyle = blend(light, dark, Math.min(1, shade + 0.35));
      for (let line = 0; line < 4; line += 1) {
        const y = top + plankHeight * (0.12 + 0.22 * line) + noise(row * 13 + line + seed) * 5;
        context.fillRect(from + joint, y, to - from - joint * 2, 1);
      }
    });
  }
}

/** One square metre of parquet: six planks across, in the palette's two woods. */
export function createPlankTexture(palette: ScenePalette): Texture | null {
  const context = createContext(FLOOR_TEXTURE_PX);

  if (context === null) {
    return null;
  }

  paintBoards(context, palette.wood, palette.woodDark, PLANK_ROWS, 1);
  return wrapFloorTexture(context);
}

/** One square metre of decking: narrower, darker boards than the parquet, with wider gaps. */
export function createDeckingTexture(palette: ScenePalette): Texture | null {
  const context = createContext(FLOOR_TEXTURE_PX);

  if (context === null) {
    return null;
  }

  paintBoards(context, palette.decking, palette.cut, DECKING_ROWS, 5);
  return wrapFloorTexture(context);
}

/* -------------------------------------------------------------------------- */
/* Tiles.                                                                      */
/* -------------------------------------------------------------------------- */

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

/** One square metre of bathroom mosaic: an eight-by-eight checkerboard of pale and slate squares. */
export function createMosaicTexture(palette: ScenePalette): Texture | null {
  const context = createContext(FLOOR_TEXTURE_PX);

  if (context === null) {
    return null;
  }

  const size = FLOOR_TEXTURE_PX;
  const check = size / MOSAIC_COLUMNS;
  const joint = size * JOINT_FRACTION;

  context.fillStyle = palette.grout.getStyle();
  context.fillRect(0, 0, size, size);

  for (let row = 0; row < MOSAIC_COLUMNS; row += 1) {
    for (let column = 0; column < MOSAIC_COLUMNS; column += 1) {
      const slate = (row + column) % 2 === 1;
      const shade = noise(row * 3 + column * 7 + 4) * 0.12;
      context.fillStyle = slate ? blend(palette.mosaic, palette.cut, shade) : blend(palette.tile, palette.grout, shade);
      context.fillRect(column * check + joint / 2, row * check + joint / 2, check - joint, check - joint);
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
  return paintRadial(SHADOW_TEXTURE_PX, palette.cut, contactShadowFalloff);
}

/**
 * A tint with an alpha decided per pixel — the shape of every decal here.
 * Written pixel by pixel so no colour string is ever composed. Magnified far
 * more than minified, so it carries no mipmaps.
 */
function paintAlpha(sizePx: number, tint: Color, alphaAt: (x: number, y: number) => number): Texture | null {
  const context = createContext(sizePx);

  if (context === null) {
    return null;
  }

  const image = context.createImageData(sizePx, sizePx);
  const srgb = tint.clone().convertLinearToSRGB();
  const channels = [srgb.r, srgb.g, srgb.b].map((value) => Math.round(value * 255));

  for (let y = 0; y < sizePx; y += 1) {
    for (let x = 0; x < sizePx; x += 1) {
      const offset = (y * sizePx + x) * 4;
      image.data[offset] = channels[0] ?? 0;
      image.data[offset + 1] = channels[1] ?? 0;
      image.data[offset + 2] = channels[2] ?? 0;
      image.data[offset + 3] = Math.round(alphaAt(x, y) * 255);
    }
  }

  context.putImageData(image, 0, 0);

  const texture = new CanvasTexture(context.canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  return texture;
}

/** A disc of `tint`, solid at the centre and fading to clear by `falloff` of the distance from it. */
function paintRadial(sizePx: number, tint: Color, falloff: (distance: number) => number): Texture | null {
  const half = sizePx / 2;
  return paintAlpha(sizePx, tint, (x, y) => falloff(Math.hypot(x + 0.5 - half, y + 0.5 - half) / half));
}

/* -------------------------------------------------------------------------- */
/* Pool of light.                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The warm pool a lamp throws on the surface under it, for lamps that are
 * drawn rather than lit.
 *
 * A real light costs every pixel of every frame, whether it lights a living
 * room or a nightstand; a pool is a disc of the lamp's colour, added over the
 * surface once, and costs nothing after. From above, on a floor, the two are
 * hard to tell apart — a pool is what a downlight *looks like* — and
 * `lighting.ts` keeps the real lights for the rooms that earn them.
 */
export function createLightPoolTexture(palette: ScenePalette): Texture | null {
  return paintRadial(POOL_TEXTURE_PX, palette.lamp, lightPoolFalloff);
}

/** Brightest at the centre, falling off as the square of a smooth step — a soft-edged disc. */
export function lightPoolFalloff(distance: number): number {
  if (distance >= 1) {
    return 0;
  }

  const remaining = 1 - distance * distance;
  return remaining * remaining;
}

/* -------------------------------------------------------------------------- */
/* Edge shade.                                                                 */
/* -------------------------------------------------------------------------- */

/** Pixels down the edge-shade gradient. */
const EDGE_TEXTURE_PX = 64;

/**
 * A strip that is dark along its top edge and clear by its bottom: the
 * shadow a floor keeps along the foot of a wall. `trim.ts` lays it flat
 * against every roomed wall base.
 */
export function createEdgeShadeTexture(palette: ScenePalette): Texture | null {
  return paintAlpha(EDGE_TEXTURE_PX, palette.cut, (_x, y) => edgeShadeFalloff((y + 0.5) / EDGE_TEXTURE_PX));
}

/** Solid at the wall, falling off as the square of the distance from it. */
export function edgeShadeFalloff(distance: number): number {
  const remaining = Math.max(0, 1 - distance);
  return remaining * remaining;
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
