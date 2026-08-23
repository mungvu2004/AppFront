/**
 * Normal maps that are drawn, not loaded — the relief under `textures.ts`.
 *
 * A plank floor painted flat reads as a print of a floor. What makes it
 * boards is that each board is a hair proud of its joints, so a lamp's
 * reflection breaks at every seam and every grout line. That is a normal
 * map's job, and here it is computed rather than photographed: a height
 * field with a bevel at every joint, turned into normals by finite
 * differences and written as a tangent-space map. The layout is the same one
 * the colour texture is painted from, so the seams line up.
 *
 * Everything returns `null` where there is no 2D canvas, like the textures.
 */

import { CanvasTexture, NoColorSpace, RepeatWrapping, type Texture } from 'three';

import { noise } from './textures';

/* -------------------------------------------------------------------------- */
/* Constants.                                                                  */
/* -------------------------------------------------------------------------- */

/** Pixels across one metre of relief; the colour textures are the same size. */
export const RELIEF_PX = 256;

/** How wide the bevel at a joint is, in pixels: the slope the light catches. */
const BEVEL_PX = 3;

/** How steep the relief is: the gradient is scaled by this before it becomes a normal. */
const RELIEF_STRENGTH = 2.5;

/** Joints as a fraction of the tile, matching the painted textures. */
const JOINT_FRACTION = 0.012;

/* -------------------------------------------------------------------------- */
/* Height fields.                                                              */
/* -------------------------------------------------------------------------- */

/** A rectangle of the tile, in pixels. */
interface Cell {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Boards in `rows`, two per row split at a staggered seam — the same seams `textures.ts` paints. */
export function boardCells(rows: number, seed: number, size = RELIEF_PX): Cell[] {
  const height = size / rows;
  const cells: Cell[] = [];
  for (let row = 0; row < rows; row += 1) {
    const seam = noise(row + seed) * size;
    cells.push({ x: 0, y: row * height, w: seam, h: height }, { x: seam, y: row * height, w: size - seam, h: height });
  }
  return cells;
}

/** A grid of `columns` square tiles. */
export function gridCells(columns: number, size = RELIEF_PX): Cell[] {
  const side = size / columns;
  const cells: Cell[] = [];
  for (let row = 0; row < columns; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      cells.push({ x: column * side, y: row * side, w: side, h: side });
    }
  }
  return cells;
}

/**
 * A height field from cells: one inside a cell, falling to zero across the
 * joint, with a bevel `BEVEL_PX` wide inside each cell's edge.
 */
export function heightField(cells: readonly Cell[], size = RELIEF_PX): Float32Array {
  const heights = new Float32Array(size * size);
  const joint = (size * JOINT_FRACTION) / 2;

  for (const cell of cells) {
    const left = cell.x + joint;
    const right = cell.x + cell.w - joint;
    const top = cell.y + joint;
    const bottom = cell.y + cell.h - joint;
    for (let y = Math.max(0, Math.floor(top)); y < Math.min(size, Math.ceil(bottom)); y += 1) {
      for (let x = Math.max(0, Math.floor(left)); x < Math.min(size, Math.ceil(right)); x += 1) {
        const inset = Math.min(x + 0.5 - left, right - x - 0.5, y + 0.5 - top, bottom - y - 0.5);
        heights[y * size + x] = Math.max(0, Math.min(1, inset / BEVEL_PX));
      }
    }
  }

  return heights;
}

/* -------------------------------------------------------------------------- */
/* Normals.                                                                    */
/* -------------------------------------------------------------------------- */

/** Tangent-space normals from a height field, wrapped at the edges, as RGB bytes. */
export function normalsFromHeights(heights: Float32Array, size = RELIEF_PX): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(size * size * 4);
  const at = (x: number, y: number): number => heights[((y + size) % size) * size + ((x + size) % size)] ?? 0;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * RELIEF_STRENGTH;
      // Image rows run down; a tangent-space map's green runs up.
      const dy = (at(x, y - 1) - at(x, y + 1)) * RELIEF_STRENGTH;
      const length = Math.hypot(dx, dy, 1);
      const offset = (y * size + x) * 4;
      pixels[offset] = Math.round(((-dx / length) * 0.5 + 0.5) * 255);
      pixels[offset + 1] = Math.round(((-dy / length) * 0.5 + 0.5) * 255);
      pixels[offset + 2] = Math.round((1 / length) * 255);
      pixels[offset + 3] = 255;
    }
  }

  return pixels;
}

/** A repeating, linear-space normal map from cells, or `null` without a canvas. */
export function createReliefTexture(cells: readonly Cell[]): Texture | null {
  const canvas = document.createElement('canvas');
  canvas.width = RELIEF_PX;
  canvas.height = RELIEF_PX;
  const context = canvas.getContext('2d');
  if (context === null) {
    return null;
  }

  const image = context.createImageData(RELIEF_PX, RELIEF_PX);
  image.data.set(normalsFromHeights(heightField(cells)));
  context.putImageData(image, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = NoColorSpace;
  texture.anisotropy = 4;
  return texture;
}
