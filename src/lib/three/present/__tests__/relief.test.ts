import { CanvasTexture, NoColorSpace, RepeatWrapping } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { boardCells, createReliefTexture, gridCells, heightField, normalsFromHeights, RELIEF_PX } from '../relief';
import { noise } from '../textures';

import { stubCanvasContext, stubNoCanvas } from './fixtures';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('boardCells', () => {
  it('lays two boards a row at the same staggered seams the colour texture paints', () => {
    const rows = 6;
    const cells = boardCells(rows, 1);

    expect(cells).toHaveLength(rows * 2);
    const firstSeam = noise(0 + 1) * RELIEF_PX;
    expect(cells[0]?.w).toBeCloseTo(firstSeam);
    expect(cells[1]?.x).toBeCloseTo(firstSeam);
    expect((cells[0]?.w ?? 0) + (cells[1]?.w ?? 0)).toBeCloseTo(RELIEF_PX);
  });
});

describe('gridCells', () => {
  it('tiles the metre into a square grid', () => {
    const cells = gridCells(3);
    expect(cells).toHaveLength(9);
    expect(cells.every((cell) => Math.abs(cell.w - RELIEF_PX / 3) < 0.001)).toBe(true);
  });
});

describe('heightField', () => {
  it('is high inside a cell, low in the joint, with a bevel between', () => {
    const heights = heightField(gridCells(2));
    const at = (x: number, y: number) => heights[y * RELIEF_PX + x] ?? -1;
    const mid = Math.floor(RELIEF_PX / 4);

    expect(at(mid, mid)).toBe(1);
    expect(at(Math.floor(RELIEF_PX / 2), mid)).toBe(0);
    const bevel = at(Math.floor(RELIEF_PX / 2) - 3, mid);
    expect(bevel).toBeGreaterThan(0);
    expect(bevel).toBeLessThanOrEqual(1);
  });
});

describe('normalsFromHeights', () => {
  it('points straight up on the flats and leans at the joints', () => {
    const heights = heightField(gridCells(2));
    const pixels = normalsFromHeights(heights);
    const mid = Math.floor(RELIEF_PX / 4);
    const flat = (mid * RELIEF_PX + mid) * 4;

    expect(pixels[flat]).toBe(128);
    expect(pixels[flat + 1]).toBe(128);
    expect(pixels[flat + 2]).toBe(255);

    // Just left of a vertical joint the surface slopes down to the right: red below half.
    const joint = (mid * RELIEF_PX + Math.floor(RELIEF_PX / 2) - 2) * 4;
    expect(pixels[joint]).not.toBe(128);
    expect(pixels[joint + 2]).toBeLessThan(255);
  });
});

describe('createReliefTexture', () => {
  it('wraps, stays linear, and is null without a canvas', () => {
    stubCanvasContext();
    const texture = createReliefTexture(gridCells(3));

    expect(texture).toBeInstanceOf(CanvasTexture);
    expect(texture?.wrapS).toBe(RepeatWrapping);
    expect(texture?.colorSpace).toBe(NoColorSpace);

    vi.restoreAllMocks();
    stubNoCanvas();
    expect(createReliefTexture(gridCells(3))).toBeNull();
  });
});
