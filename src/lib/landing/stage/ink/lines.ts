/**
 * Stroke-drawn line work: one `LineSegments2` per layer whose segments are
 * pre-sorted by the moment the pen reaches them.
 *
 * A stroke is a polyline with a reveal window `[start, end]` on the layer's
 * 0..1 control. It is cut into short pieces and each piece gets the time the pen
 * passes its far end (start + (end − start) × arc / length). Sorting all pieces
 * by that time means "draw up to x" is just `instanceCount = #pieces with time
 * ≤ x` — a binary search, no shader patch, no allocation per frame — and strokes
 * still overlap and grow along their length rather than fading in.
 */

import { Color, type Material, type Object3D } from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';

import { LANDING_PALETTE } from '@/lib/landing/palette';

import type { P2, Seg } from './geometry';

export const PAPER = LANDING_PALETTE.paper;
export const GRAPHITE = LANDING_PALETTE.graphite;
export const BLUE = LANDING_PALETTE.signal;
export const JADE = LANDING_PALETTE.jade;
export const AMBER = LANDING_PALETTE.amber;
export const CORAL = LANDING_PALETTE.coral;

export type P3 = readonly [number, number, number];

export interface Stroke {
  readonly pts: readonly P3[];
  readonly start: number;
  readonly end: number;
}

/** A floor-plane point lifted to height `y`. */
export const at = (p: P2, y = 0): P3 => [p[0], y, p[1]];
export const flatStroke = (pts: readonly P2[], y = 0): P3[] => pts.map((p) => at(p, y));
export const segPts = (seg: Seg): P2[] => [seg[0], seg[1]];

const PIECE_M = 0.08;

export function lineMaterial(color: string, widthPx: number): LineMaterial {
  return new LineMaterial({
    color: new Color(color).getHex(),
    linewidth: widthPx,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    alphaToCoverage: false,
  });
}

/**
 * Spread `count` strokes over `[a, b]` in order, each taking `share` of the
 * window, so neighbours overlap the way a hand draws.
 */
export function windows(count: number, a: number, b: number, share = 0.3): (i: number) => readonly [number, number] {
  const dur = (b - a) * share;
  return (i) => {
    const start = a + (b - a - dur) * (count > 1 ? i / (count - 1) : 0);
    return [start, start + dur];
  };
}

export class RevealLine {
  readonly object: LineSegments2;
  readonly material: LineMaterial;
  private readonly times: Float32Array;
  private readonly base: Float32Array;
  private capY = Infinity;

  constructor(name: string, strokes: readonly Stroke[], material: LineMaterial) {
    const pieces: { t: number; a: P3; b: P3 }[] = [];
    for (const stroke of strokes) {
      const lengths = stroke.pts.slice(1).map((p, i) => length3(stroke.pts[i] as P3, p));
      const total = lengths.reduce((sum, l) => sum + l, 0) || 1;
      let run = 0;
      lengths.forEach((l, i) => {
        const a = stroke.pts[i] as P3;
        const b = stroke.pts[i + 1] as P3;
        const n = Math.max(1, Math.ceil(l / PIECE_M));
        for (let k = 0; k < n; k++) {
          const t = stroke.start + ((stroke.end - stroke.start) * (run + (l * (k + 1)) / n)) / total;
          pieces.push({ t, a: mix3(a, b, k / n), b: mix3(a, b, (k + 1) / n) });
        }
        run += l;
      });
    }
    pieces.sort((x, y) => x.t - y.t);
    const positions = new Float32Array(Math.max(1, pieces.length) * 6);
    pieces.forEach((piece, i) => positions.set([...piece.a, ...piece.b], i * 6));
    this.base = positions.slice();
    this.times = Float32Array.from(pieces, (piece) => piece.t);

    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(positions);
    this.material = material;
    this.object = new LineSegments2(geometry, material);
    this.object.name = name;
    this.object.frustumCulled = false;
    this.reveal(0);
  }

  get geometry(): LineSegmentsGeometry {
    return this.object.geometry;
  }

  /** Draw every piece the pen has reached by `x`. */
  reveal(x: number): void {
    let lo = 0;
    let hi = this.times.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((this.times[mid] as number) <= x + 1e-6) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    this.object.geometry.instanceCount = lo;
  }

  /** Flatten every point above maxY onto it (visible wall top); redraws only when the cap moves. Allocation-free. */
  clampY(maxY: number): void {
    if (Math.abs(maxY - this.capY) < 1e-4) {
      return;
    }
    this.capY = maxY;
    const data = (this.object.geometry.attributes['instanceStart'] as unknown as { data: { array: Float32Array; needsUpdate: boolean } }).data;
    for (let i = 1; i < this.base.length; i += 3) {
      data.array[i] = Math.min(this.base[i] as number, maxY);
    }
    data.needsUpdate = true;
  }

  setOpacity(opacity: number): void {
    this.material.opacity = opacity;
    this.object.visible = opacity > 1e-3 && this.object.geometry.instanceCount > 0;
  }
}

/** A line layer that is always fully drawn (opacity is its only control). */
export function staticLine(name: string, polylines: readonly (readonly P3[])[], material: LineMaterial): RevealLine {
  const line = new RevealLine(
    name,
    polylines.map((pts) => ({ pts, start: 0, end: 0 })),
    material,
  );
  line.reveal(1);
  return line;
}

export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
export const smooth = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Free every geometry, material and texture under `root`. */
export function disposeTree(root: Object3D): void {
  root.traverse((node) => {
    const holder = node as Object3D & { geometry?: { dispose(): void }; material?: Material | Material[] };
    holder.geometry?.dispose();
    const materials = Array.isArray(holder.material) ? holder.material : holder.material ? [holder.material] : [];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value && typeof value === 'object' && 'isTexture' in value) {
          (value as { dispose(): void }).dispose();
        }
      }
      material.dispose();
    }
  });
}

function length3(a: P3, b: P3): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
}

function mix3(a: P3, b: P3, t: number): P3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
