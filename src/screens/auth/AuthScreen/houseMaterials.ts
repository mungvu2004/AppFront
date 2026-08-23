/**
 * Every surface the apartment on `/login` is painted with.
 *
 * The scene has no colour of its own. Each material below is resolved from a
 * CSS custom property at mount — the ten `--scene-*` tokens `globals.css`
 * declares for this screen, plus the surface and text tokens the rest of the
 * page already uses — so the model follows the theme, and `local/no-raw-color`
 * has nothing to find here: there is no hex, no `rgb()`, and no `hsl()` in this
 * file, only token names and the numbers a fallback needs when a token is
 * missing from the document (a test with no stylesheet).
 *
 * Two finishes are textures rather than flat colours, and both are **drawn**
 * rather than loaded: a 2D canvas paints planks or tiles in token colours, and
 * three wraps it as a `CanvasTexture`. That keeps the route free of image
 * assets, keeps the floors on-theme, and — because an extruded slab's UVs are
 * its plan coordinates in metres — lets one texture tile stand for exactly one
 * square metre of floor with no UV work at all.
 */

import {
  CanvasTexture,
  Color,
  DoubleSide,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three';

/* -------------------------------------------------------------------------- */
/* Tokens.                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A design token, resolved to a colour the renderer understands.
 *
 * Read off the document rather than written down, so the model follows the theme
 * the rest of the screen is painted in. The fallback is a neutral grey in linear
 * components — only ever reached when the stylesheet is absent.
 */
export function tokenColour(name: string, fallback: Color): Color {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  if (raw === '') {
    return fallback;
  }

  try {
    return new Color(raw);
  } catch {
    return fallback;
  }
}

/** Mid grey, the fallback for every token; the scene is still legible in it. */
const FALLBACK = new Color(0.6, 0.6, 0.6);
const FALLBACK_DARK = new Color(0.15, 0.15, 0.15);
const FALLBACK_LIGHT = new Color(0.95, 0.95, 0.95);

/** The colours the scene is built from, read once per mount. */
export interface ScenePalette {
  readonly backdrop: Color;
  readonly plaster: Color;
  readonly cut: Color;
  readonly wood: Color;
  readonly woodDark: Color;
  readonly tile: Color;
  readonly grout: Color;
  readonly fabric: Color;
  readonly textile: Color;
  readonly stone: Color;
  readonly metal: Color;
  readonly foliage: Color;
  readonly clay: Color;
  readonly glass: Color;
  readonly lamp: Color;
  readonly screen: Color;
}

/** Resolve the whole palette from the document. */
export function readPalette(): ScenePalette {
  return {
    backdrop: tokenColour('--scene-backdrop', FALLBACK_DARK),
    plaster: tokenColour('--bg-surface', FALLBACK_LIGHT),
    cut: tokenColour('--text-primary', FALLBACK_DARK),
    wood: tokenColour('--scene-wood', FALLBACK),
    woodDark: tokenColour('--scene-wood-dark', FALLBACK),
    tile: tokenColour('--scene-tile', FALLBACK_LIGHT),
    grout: tokenColour('--scene-tile-grout', FALLBACK),
    fabric: tokenColour('--canvas-3d', FALLBACK_LIGHT),
    textile: tokenColour('--scene-textile', FALLBACK),
    stone: tokenColour('--canvas-3d-horizon', FALLBACK),
    metal: tokenColour('--wall-110', FALLBACK),
    foliage: tokenColour('--scene-foliage', FALLBACK),
    clay: tokenColour('--scene-clay', FALLBACK),
    glass: tokenColour('--scene-glass', FALLBACK_LIGHT),
    lamp: tokenColour('--scene-lamp', FALLBACK_LIGHT),
    screen: tokenColour('--text-primary', FALLBACK_DARK),
  };
}

/* -------------------------------------------------------------------------- */
/* Drawn textures.                                                             */
/* -------------------------------------------------------------------------- */

/** Pixels per metre of floor in a drawn texture. */
const TEXTURE_SIZE_PX = 256;

/** Rows of boards in one metre-square tile — 167 mm planks. */
const PLANK_ROWS = 6;

/** Tiles along each edge of one metre-square tile — 333 mm tiles. */
const TILE_COLUMNS = 3;

/** Grout and board gaps, as a fraction of the texture. */
const JOINT_FRACTION = 0.012;

/**
 * A deterministic pseudo-random in `[0, 1)`, so the floor looks the same on
 * every mount and a visual snapshot stays stable. Plain integer hashing —
 * nothing about it needs to be good, it only needs to be repeatable.
 */
function noise(seed: number): number {
  const scrambled = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return scrambled - Math.floor(scrambled);
}

/** Mix two token colours, as a CSS string for the 2D canvas. */
function blend(first: Color, second: Color, amount: number): string {
  return first.clone().lerp(second, amount).getStyle();
}

function createFloorCanvas(): CanvasRenderingContext2D | null {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_SIZE_PX;
  canvas.height = TEXTURE_SIZE_PX;
  return canvas.getContext('2d');
}

function wrapTexture(context: CanvasRenderingContext2D): Texture {
  const texture = new CanvasTexture(context.canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * One square metre of boards: six planks across, each its own shade, with the
 * end joints staggered so the floor does not read as stripes.
 */
export function createPlankTexture(palette: ScenePalette): Texture | null {
  const context = createFloorCanvas();

  if (context === null) {
    return null;
  }

  const size = TEXTURE_SIZE_PX;
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

  return wrapTexture(context);
}

/** One square metre of tiles: a three-by-three grid with grout between. */
export function createTileTexture(palette: ScenePalette): Texture | null {
  const context = createFloorCanvas();

  if (context === null) {
    return null;
  }

  const size = TEXTURE_SIZE_PX;
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

  return wrapTexture(context);
}

/* -------------------------------------------------------------------------- */
/* Materials.                                                                  */
/* -------------------------------------------------------------------------- */

/** Every material the scene hands out, so `dispose` can find them all. */
export interface SceneMaterials {
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
  readonly all: readonly MeshStandardMaterial[];
}

const matte = (color: Color, roughness = 0.9): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, roughness, metalness: 0 });

/** Build the full set from a palette. */
export function createMaterials(palette: ScenePalette): SceneMaterials {
  const plankMap = createPlankTexture(palette);
  const tileMap = createTileTexture(palette);

  const woodFloor = new MeshStandardMaterial({
    color: plankMap === null ? palette.wood : palette.plaster,
    roughness: 0.7,
    metalness: 0,
    ...(plankMap === null ? {} : { map: plankMap }),
  });

  // Same boards, tinted darker: the balcony is decking, not parquet.
  const decking = new MeshStandardMaterial({
    color: plankMap === null ? palette.woodDark : palette.stone,
    roughness: 0.85,
    metalness: 0,
    ...(plankMap === null ? {} : { map: plankMap }),
  });

  const tileFloor = new MeshStandardMaterial({
    color: tileMap === null ? palette.tile : palette.plaster,
    roughness: 0.35,
    metalness: 0,
    ...(tileMap === null ? {} : { map: tileMap }),
  });

  const glass = new MeshStandardMaterial({
    color: palette.glass,
    roughness: 0.05,
    metalness: 0,
    transparent: true,
    opacity: 0.35,
    side: DoubleSide,
  });

  const lampShade = new MeshStandardMaterial({
    color: palette.lamp,
    emissive: palette.lamp,
    emissiveIntensity: 1.6,
    roughness: 1,
    metalness: 0,
  });

  const set = {
    plaster: matte(palette.plaster, 0.95),
    cut: matte(palette.cut, 1),
    woodFloor,
    tileFloor,
    decking,
    wood: matte(palette.wood, 0.6),
    woodDark: matte(palette.woodDark, 0.6),
    fabric: matte(palette.fabric, 1),
    textile: matte(palette.textile, 1),
    linen: matte(palette.plaster, 1),
    stone: matte(palette.stone, 0.3),
    // Brushed rather than mirror: with the backdrop dark, a shinier metal would
    // reflect nothing and read as black.
    metal: new MeshStandardMaterial({ color: palette.metal, roughness: 0.55, metalness: 0.3 }),
    porcelain: matte(palette.plaster, 0.2),
    foliage: matte(palette.foliage, 0.8),
    clay: matte(palette.clay, 0.9),
    glass,
    lampShade,
    screen: matte(palette.screen, 0.4),
  };

  return { ...set, all: Object.values(set) };
}
