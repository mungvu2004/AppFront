/**
 * Scene 03's semantic layers, every one derived from the same plan as the ink:
 * blue wall outlines (with the review gap left out — the "AI" missed it), jade
 * room fills, opening markers at their real spans, and corner brackets around
 * furniture. Each layer is its own group so the restrained exploded view can
 * lift them apart by `explodeM × index`.
 */

import { Color, Group, Mesh, MeshBasicMaterial, Shape, ShapeGeometry, Vector2 } from 'three';

import type { LandingHouse } from '@/lib/landing/types';

import {
  along,
  cutAlong,
  dist,
  groundLevelId,
  groundWalls,
  mm,
  openingSpan,
  p2,
  wallFrame,
  type P2,
  type Seg,
  type WallFrame,
} from './geometry';
import { BLUE, flatStroke, JADE, lineMaterial, RevealLine, staticLine, windows, type P3 } from './lines';

/** Layer order, bottom to top; the index is the explode multiplier. */
export const LAYER = { rooms: 0, walls: 1, openings: 2, furniture: 3 } as const;

export const ROOM_FILL_ALPHA = 0.16;

export interface RoomFill {
  readonly mesh: Mesh<ShapeGeometry, MeshBasicMaterial>;
  /** Shares an edge with the gap wall: not a closed room until the gap is. */
  readonly bordersGap: boolean;
}

export interface Detect {
  readonly group: Group;
  readonly layers: readonly Group[];
  readonly walls: RevealLine;
  readonly rooms: RevealLine;
  readonly fills: readonly RoomFill[];
  readonly openings: RevealLine;
  readonly furniture: RevealLine;
  readonly gapWall: WallFrame | null;
  /** Anchor id → position on its layer (y = 0) and the layer index. */
  readonly anchors: ReadonlyMap<string, { readonly p: P3; readonly layer: number }>;
}

export function gapSpan(house: LandingHouse, w: WallFrame): readonly [number, number] {
  return [house.reviewGap.from * w.len, house.reviewGap.to * w.len];
}

function segDistance(p: P2, a: P2, b: P2): number {
  const ab: P2 = [b[0] - a[0], b[1] - a[1]];
  const l2 = ab[0] * ab[0] + ab[1] * ab[1] || 1;
  const t = Math.min(1, Math.max(0, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / l2));
  return dist(p, [a[0] + ab[0] * t, a[1] + ab[1] * t]);
}

function roomFills(house: LandingHouse, gapWall: WallFrame | null): RoomFill[] {
  const level = groundLevelId(house.plan);
  const gapMid = gapWall ? along(gapWall, ((house.reviewGap.from + house.reviewGap.to) / 2) * gapWall.len) : null;
  return house.plan.rooms
    .filter((room) => room.levelId === level && room.outline.length >= 3)
    .map((room) => {
      const pts = room.outline.map(p2);
      const shape = new Shape(pts.map((p) => new Vector2(p[0], -p[1])));
      const mesh = new Mesh(
        new ShapeGeometry(shape),
        new MeshBasicMaterial({ color: new Color(JADE), transparent: true, opacity: 0, depthWrite: false }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.name = `detect:room:${room.id}`;
      const bordersGap =
        gapWall !== null &&
        gapMid !== null &&
        pts.some((p, i) => segDistance(gapMid, p, pts[(i + 1) % pts.length] as P2) < gapWall.t / 2 + 0.08);
      return { mesh, bordersGap };
    });
}

function bracketStrokes(house: LandingHouse, anchors: Map<string, { p: P3; layer: number }>): P2[][] {
  const level = groundLevelId(house.plan);
  const labelled = new Set(house.detections.filter((d) => d.labelled).map((d) => d.furnitureId));
  const out: P2[][] = [];
  for (const item of house.plan.furniture) {
    if ((item.levelId ?? level) !== level) {
      continue;
    }
    const [cx, cz] = p2(item.centreMm);
    const sideways = item.facing === 'east' || item.facing === 'west';
    const w = mm(item.sizeMm[sideways ? 1 : 0] ?? 0);
    const d = mm(item.sizeMm[sideways ? 0 : 1] ?? 0);
    const x0 = cx - w / 2;
    const x1 = cx + w / 2;
    const z0 = cz - d / 2;
    const z1 = cz + d / 2;
    const leg = Math.min(0.18, 0.3 * Math.min(w, d));
    for (const [x, z, sx, sz] of [
      [x0, z0, 1, 1],
      [x1, z0, -1, 1],
      [x1, z1, -1, -1],
      [x0, z1, 1, -1],
    ] as const) {
      out.push([
        [x + sx * leg, z],
        [x, z],
        [x, z + sz * leg],
      ]);
    }
    if (labelled.has(item.id)) {
      anchors.set(`det:${item.id}`, { p: [x0, 0, z0], layer: LAYER.furniture });
    }
  }
  return out;
}

function timedFlat(polylines: readonly (readonly P2[])[], a: number, b: number, share: number) {
  const slot = windows(polylines.length, a, b, share);
  return polylines.map((pts, i) => {
    const [start, end] = slot(i);
    return { pts: flatStroke(pts), start, end };
  });
}

export function createDetect(house: LandingHouse, faces: ReadonlyMap<string, Seg[]>): Detect {
  const group = new Group();
  group.name = 'ink:detect';
  const layers = (['rooms', 'walls', 'openings', 'furniture'] as const).map((name) => {
    const layer = new Group();
    layer.name = `detect:${name}`;
    group.add(layer);
    return layer;
  });
  const anchors = new Map<string, { p: P3; layer: number }>();

  const wallById = new Map(groundWalls(house.plan).map((wall) => [wall.id, wallFrame(wall)]));
  const gapWall = wallById.get(house.reviewGap.wallId) ?? null;
  const wallSegs = [...faces.entries()].flatMap(([id, segs]) =>
    gapWall && id === gapWall.id ? cutAlong(segs, gapWall, [gapSpan(house, gapWall)]) : segs,
  );
  wallSegs.sort((x, y) => dist(y[0], y[1]) - dist(x[0], x[1]));
  const walls = new RevealLine(
    'detect:walls',
    timedFlat(
      wallSegs.map((seg) => [seg[0], seg[1]]),
      0,
      1,
      0.2,
    ),
    lineMaterial(BLUE, 1.5),
  );

  const fills = roomFills(house, gapWall);
  const level = groundLevelId(house.plan);
  const rooms = staticLine(
    'detect:roomEdges',
    house.plan.rooms
      .filter((room) => room.levelId === level)
      .map((room) => flatStroke([...room.outline.map(p2), p2(room.outline[0] ?? [0, 0])], 0.001)),
    lineMaterial(JADE, 1),
  );

  const markers: P2[][] = [];
  for (const opening of house.plan.openings) {
    const w = wallById.get(opening.wallId);
    if (!w) {
      continue;
    }
    const [s0, s1] = openingSpan(opening, w);
    const tick = w.t / 2 + 0.08;
    markers.push([along(w, s0), along(w, s1)], [along(w, s0, -tick), along(w, s0, tick)], [along(w, s1, -tick), along(w, s1, tick)]);
  }
  const openings = new RevealLine('detect:openings', timedFlat(markers, 0, 1, 0.25), lineMaterial(BLUE, 1.3));
  const furniture = new RevealLine(
    'detect:furniture',
    timedFlat(bracketStrokes(house, anchors), 0, 1, 0.2),
    lineMaterial(BLUE, 1.2),
  );

  for (const fill of fills) {
    layers[LAYER.rooms]?.add(fill.mesh);
  }
  layers[LAYER.rooms]?.add(rooms.object);
  layers[LAYER.walls]?.add(walls.object);
  layers[LAYER.openings]?.add(openings.object);
  layers[LAYER.furniture]?.add(furniture.object);

  return { group, layers, walls, rooms, fills, openings, furniture, gapWall, anchors };
}
