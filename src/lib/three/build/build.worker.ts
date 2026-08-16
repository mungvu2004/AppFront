/**
 * Generating a storey's geometry off the main thread, as plain numbers.
 *
 * Rebuilding a building is arithmetic, and arithmetic is exactly the kind of work
 * that must not happen where the interface lives: forty-eight extrusions in one
 * synchronous pass freezes the pointer for as long as it takes, and no amount of
 * optimising changes the fact that the browser has one thread to draw with. So
 * the arithmetic moves here, and what crosses back is a set of typed arrays that
 * transfer in constant time rather than a graph of objects that has to be cloned.
 *
 * **No three.js in this file.** Not as a convenience but as the constraint that
 * shapes everything below: a worker that imported three would drag the renderer
 * into a context that cannot render, and would start a second copy of it. Every
 * `import` here is either a type — erased before the bundle is written — or a
 * pure function from `src/domain` and `./plan`. What comes out is `Float32Array`s
 * of positions, normals and texture coordinates; turning those into a
 * `BufferGeometry` is the main thread's job, in `buildQueue.ts`.
 *
 * What it does **not** do is decide what the building is. Which openings are cut,
 * which are refused and with what sentence, where the elevation steps up over a
 * doorway, how thick a slab is: all of that comes from `plan.ts`, the same module
 * `wall.ts` and `floor.ts` read on the main thread. A wall rebuilt here is not
 * "checked to match" the one built there — the two share the plan and differ only
 * in how a triangle gets made.
 *
 * Which means the extrusion has to be written out by hand, and it is, in three
 * pieces that between them cover every part this package builds:
 *
 * - **Cap triangles.** The face of a wall is a rectangle with rectangular pieces
 *   missing, so it decomposes exactly into vertical strips — no general
 *   triangulator needed, and no triangle is ever wrong. A room outline is an
 *   arbitrary simple polygon, so that one is ear-clipped.
 * - **Side quads.** Every boundary loop — the outline and each hole — contributes
 *   one quad per edge. This is what makes the solid closed, and what a hole in a
 *   wall is actually made of.
 * - **One frame.** The flat result is carried into the scene by a frame of three
 *   orthonormal axes, so a wall drawn along its own length lands wherever the
 *   centreline runs without a single trigonometric special case.
 *
 * The triangles come out matching `wall.ts` one for one — a solid wall is twelve,
 * a wall with a door is twenty-eight, a wall with a window is thirty-two — which
 * is checked in the tests, because an incremental rebuild that looked different
 * from a full one would be worse than no incremental rebuild at all.
 *
 * Lengths are millimetres right up to `metresOf`, which is the one place this
 * file divides, and it divides by calling the domain's own conversion.
 */

import { compareNearly } from '@/domain/units/compare';
import { millimetres, millimetresToMetres } from '@/domain/units/types';
import { openingSpan } from '@/domain/openings/validate';
import type { AttachedOpening, Opening } from '@/domain/openings/types';
import { signedAreaMm2 } from '@/domain/rooms/area';
import { assertUsableWall, centrelineLength, type Wall } from '@/domain/walls/types';
import type { LevelId, OpeningId, RoomId, WallId } from '@/domain/spatial/types';

import {
  openingsOnWall,
  OPENING_PANEL_THICKNESS_MM,
  panelHoles,
  panelOutline,
  panelRects,
  planCuts,
  planPanels,
  SLAB_THICKNESS_MM,
  type Corner,
  type CutRefusal,
  type FaceRect,
  type OpeningCut,
} from './plan';
import type { BuildEntityId, BuildPartKind } from './scene';
import type { BuildableLevel, BuildableRoom } from './floor';

/* -------------------------------------------------------------------------- */
/* The protocol.                                                               */
/* -------------------------------------------------------------------------- */

/** Rebuild one wall, together with the panels hung in its openings. */
export interface WallBuildJob {
  readonly kind: 'wall';
  /** The entity the job is about; the queue coalesces on this. */
  readonly key: WallId;
  readonly levelId: LevelId;
  readonly wall: Wall;
  /** Openings anywhere on the plan; only the ones on this wall are used. */
  readonly openings: readonly Opening[];
}

/** Rebuild one room's floor slab and its ceiling. */
export interface RoomBuildJob {
  readonly kind: 'room';
  readonly key: RoomId;
  readonly levelId: LevelId;
  readonly room: BuildableRoom;
  readonly level: BuildableLevel;
  readonly slabThicknessMm?: number;
}

/** One unit of work: everything that has to be rebuilt when one entity changes. */
export type BuildJob = WallBuildJob | RoomBuildJob;

/** One mesh's worth of geometry, as buffers that transfer rather than copy. */
export interface BuiltPartBuffers {
  readonly kind: BuildPartKind;
  readonly entityId: BuildEntityId;
  readonly levelId: LevelId;
  /** Triangles, three floats a vertex, already in scene units and scene axes. */
  readonly position: Float32Array;
  readonly normal: Float32Array;
  readonly uv: Float32Array;
  /** Openings really cut into this part; empty for everything but a wall. */
  readonly openingIds: readonly OpeningId[];
  /** Openings refused; empty for everything but a wall. */
  readonly refusals: readonly CutRefusal[];
}

/** What the main thread sends. */
export interface BuildRequestMessage {
  readonly ticket: number;
  readonly job: BuildJob;
}

/** What comes back: the parts, or the reason nothing could be built. */
export type BuildResponseMessage =
  | { readonly ticket: number; readonly parts: readonly BuiltPartBuffers[] }
  | { readonly ticket: number; readonly error: string };

/* -------------------------------------------------------------------------- */
/* Internals: numbers only.                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Where a flat face sits in the scene.
 *
 * `along`, `up` and `across` are orthonormal and right-handed, so the winding
 * rules the emitter relies on hold whichever way the frame is turned. `originM`
 * is already in scene units; everything else arrives in millimetres.
 */
interface Frame {
  readonly originM: readonly [number, number, number];
  readonly along: readonly [number, number, number];
  readonly up: readonly [number, number, number];
  readonly across: readonly [number, number, number];
}

/** Triangles as they accumulate, before they become typed arrays. */
interface Sink {
  readonly position: number[];
  readonly normal: number[];
  readonly uv: number[];
}

/** Millimetres to scene units. The one division in this file. */
function metresOf(valueMm: number): number {
  return millimetresToMetres(millimetres(valueMm));
}

function emptySink(): Sink {
  return { position: [], normal: [], uv: [] };
}

/** A flat-face point carried into the scene. */
function toScene(
  frame: Frame,
  alongMm: number,
  heightMm: number,
  acrossMm: number,
): readonly [number, number, number] {
  const along = metresOf(alongMm);
  const up = metresOf(heightMm);
  const across = metresOf(acrossMm);

  return [
    frame.originM[0] + frame.along[0] * along + frame.up[0] * up + frame.across[0] * across,
    frame.originM[1] + frame.along[1] * along + frame.up[1] * up + frame.across[1] * across,
    frame.originM[2] + frame.along[2] * along + frame.up[2] * up + frame.across[2] * across,
  ];
}

/** A flat-face direction carried into the scene; the frame has no scale. */
function directionToScene(
  frame: Frame,
  along: number,
  up: number,
  across: number,
): readonly [number, number, number] {
  return [
    frame.along[0] * along + frame.up[0] * up + frame.across[0] * across,
    frame.along[1] * along + frame.up[1] * up + frame.across[1] * across,
    frame.along[2] * along + frame.up[2] * up + frame.across[2] * across,
  ];
}

function pushTriangle(
  sink: Sink,
  corners: readonly (readonly [number, number, number])[],
  normal: readonly [number, number, number],
  uvs: readonly (readonly [number, number])[],
): void {
  for (let index = 0; index < 3; index += 1) {
    const corner = corners[index] ?? [0, 0, 0];
    const uv = uvs[index] ?? [0, 0];
    sink.position.push(corner[0], corner[1], corner[2]);
    sink.normal.push(normal[0], normal[1], normal[2]);
    sink.uv.push(uv[0], uv[1]);
  }
}

/** Three corners of the flat face, counter-clockwise. */
type CapTriangle = readonly [Corner, Corner, Corner];

/** A rectangle of the flat face, as the two triangles that cover it. */
function rectTriangles(rect: FaceRect): readonly CapTriangle[] {
  const bottomLeft: Corner = { alongMm: rect.lowMm, heightMm: rect.bottomMm };
  const bottomRight: Corner = { alongMm: rect.highMm, heightMm: rect.bottomMm };
  const topRight: Corner = { alongMm: rect.highMm, heightMm: rect.topMm };
  const topLeft: Corner = { alongMm: rect.lowMm, heightMm: rect.topMm };

  return [
    [bottomLeft, bottomRight, topRight],
    [bottomLeft, topRight, topLeft],
  ];
}

/**
 * One cap triangle, on both faces of the extrusion.
 *
 * The near cap faces `+across` and the far one `-across`, and the far one is
 * wound the other way round so that both point out of the solid rather than one
 * of them pointing into it. Get this wrong and the mesh stops enclosing a volume,
 * which is exactly what the tests measure.
 */
function pushCap(
  sink: Sink,
  frame: Frame,
  triangle: CapTriangle,
  lowMm: number,
  highMm: number,
): void {
  const uvOf = (corner: Corner): readonly [number, number] => [
    metresOf(corner.alongMm),
    metresOf(corner.heightMm),
  ];
  const at = (corner: Corner, acrossMm: number) =>
    toScene(frame, corner.alongMm, corner.heightMm, acrossMm);

  const [first, second, third] = triangle;

  pushTriangle(
    sink,
    [at(first, highMm), at(second, highMm), at(third, highMm)],
    directionToScene(frame, 0, 0, 1),
    [uvOf(first), uvOf(second), uvOf(third)],
  );
  pushTriangle(
    sink,
    [at(first, lowMm), at(third, lowMm), at(second, lowMm)],
    directionToScene(frame, 0, 0, -1),
    [uvOf(first), uvOf(third), uvOf(second)],
  );
}

/**
 * The side wall along one boundary edge.
 *
 * A loop keeps the solid on its left, so the outward normal is the right-hand
 * normal of the direction of travel — for the outline, which runs
 * counter-clockwise, and for a hole, which runs clockwise, by the same formula.
 */
function pushSide(
  sink: Sink,
  frame: Frame,
  from: Corner,
  to: Corner,
  lowMm: number,
  highMm: number,
  travelledMm: number,
): number {
  const runAlong = to.alongMm - from.alongMm;
  const runUp = to.heightMm - from.heightMm;
  const length = Math.hypot(runAlong, runUp);

  if (length === 0) {
    return travelledMm;
  }

  const normal = directionToScene(frame, runUp / length, -runAlong / length, 0);

  const nearFrom = toScene(frame, from.alongMm, from.heightMm, highMm);
  const nearTo = toScene(frame, to.alongMm, to.heightMm, highMm);
  const farTo = toScene(frame, to.alongMm, to.heightMm, lowMm);
  const farFrom = toScene(frame, from.alongMm, from.heightMm, lowMm);

  const startUv: readonly [number, number] = [metresOf(travelledMm), metresOf(highMm)];
  const endUv: readonly [number, number] = [metresOf(travelledMm + length), metresOf(highMm)];
  const endFarUv: readonly [number, number] = [metresOf(travelledMm + length), metresOf(lowMm)];
  const startFarUv: readonly [number, number] = [metresOf(travelledMm), metresOf(lowMm)];

  pushTriangle(sink, [nearFrom, farFrom, farTo], normal, [startUv, startFarUv, endFarUv]);
  pushTriangle(sink, [nearFrom, farTo, nearTo], normal, [startUv, endFarUv, endUv]);

  return travelledMm + length;
}

/**
 * Extrude a flat face: caps from the rectangles, sides from the loops.
 *
 * The two halves are independent on purpose. The rectangles say what the face
 * covers, the loops say where it stops; a triangulator would have to work both
 * out from one description, and for the shapes this package makes, both are
 * already known.
 */
function extrude(
  frame: Frame,
  caps: readonly CapTriangle[],
  loops: readonly (readonly Corner[])[],
  lowMm: number,
  highMm: number,
): Sink {
  const sink = emptySink();

  for (const triangle of caps) {
    pushCap(sink, frame, triangle, lowMm, highMm);
  }

  for (const loop of loops) {
    let travelledMm = 0;
    for (let index = 0; index < loop.length; index += 1) {
      const from = loop[index];
      const to = loop[(index + 1) % loop.length];
      if (from !== undefined && to !== undefined) {
        travelledMm = pushSide(sink, frame, from, to, lowMm, highMm, travelledMm);
      }
    }
  }

  return sink;
}

/** The frame a wall's own coordinates live in: along, up, across the centreline. */
function wallFrameOf(wall: Wall): Frame {
  const { start, end } = wall.centreline;
  const lengthMm = centrelineLength(wall);
  const alongX = (end.x - start.x) / lengthMm;
  const alongY = (end.y - start.y) / lengthMm;

  return {
    originM: [metresOf(start.x), metresOf(wall.baseElevationMm), metresOf(start.y)],
    along: [alongX, 0, alongY],
    up: [0, 1, 0],
    across: [-alongY, 0, alongX],
  };
}

/* -------------------------------------------------------------------------- */
/* Internals: room outlines.                                                   */
/* -------------------------------------------------------------------------- */

/** Twice the signed area of a triangle; positive when the corners run CCW. */
function turn(first: Corner, second: Corner, third: Corner): number {
  return (
    (second.alongMm - first.alongMm) * (third.heightMm - first.heightMm) -
    (second.heightMm - first.heightMm) * (third.alongMm - first.alongMm)
  );
}

/** Is the point inside the triangle, edges included? */
function insideTriangle(first: Corner, second: Corner, third: Corner, point: Corner): boolean {
  const alpha = turn(first, second, point);
  const beta = turn(second, third, point);
  const gamma = turn(third, first, point);
  return (alpha >= 0 && beta >= 0 && gamma >= 0) || (alpha <= 0 && beta <= 0 && gamma <= 0);
}

/**
 * Triangulate a simple polygon by clipping ears.
 *
 * A room outline is not rectilinear the way a wall elevation is — a bay or a
 * splayed corner is an ordinary thing to draw — so the strip decomposition that
 * covers a wall does not cover a floor, and this does. The polygon is assumed
 * simple and counter-clockwise, which `roomLoop` guarantees.
 *
 * The loop gives up rather than spinning when no ear can be found, which can only
 * happen on an outline that crosses itself. Half a floor is a visible bug; a
 * hung worker is not.
 */
function earClip(polygon: readonly Corner[]): readonly CapTriangle[] {
  const origin: Corner = { alongMm: millimetres(0), heightMm: millimetres(0) };
  const remaining = polygon.map((_unused, index) => index);
  const triangles: CapTriangle[] = [];
  const at = (index: number): Corner => polygon[index] ?? origin;

  let guard = polygon.length * polygon.length;

  while (remaining.length > 3 && guard > 0) {
    guard -= 1;
    let clipped = false;

    for (let index = 0; index < remaining.length; index += 1) {
      const previous = remaining[(index + remaining.length - 1) % remaining.length];
      const current = remaining[index];
      const next = remaining[(index + 1) % remaining.length];
      if (previous === undefined || current === undefined || next === undefined) {
        continue;
      }

      const ear: readonly [Corner, Corner, Corner] = [at(previous), at(current), at(next)];
      if (turn(ear[0], ear[1], ear[2]) <= 0) {
        continue;
      }

      const swallowsAnother = remaining.some(
        (other) =>
          other !== previous &&
          other !== current &&
          other !== next &&
          insideTriangle(ear[0], ear[1], ear[2], at(other)),
      );
      if (swallowsAnother) {
        continue;
      }

      triangles.push(ear);
      remaining.splice(index, 1);
      clipped = true;
      break;
    }

    if (!clipped) {
      break;
    }
  }

  const [first, second, third] = remaining;
  if (remaining.length === 3 && first !== undefined && second !== undefined && third !== undefined) {
    triangles.push([at(first), at(second), at(third)]);
  }

  return triangles;
}

/** The room outline as a counter-clockwise loop of flat-face corners. */
function roomLoop(room: BuildableRoom): readonly Corner[] {
  const corners = room.outline.map((point) => ({ alongMm: point.x, heightMm: point.y }));
  return signedAreaMm2(room.outline) < 0 ? [...corners].reverse() : corners;
}

/**
 * Where a slab sits: flat on the plan, with its top face at the elevation given.
 *
 * The face's `across` axis points **down**, so the extrusion runs from the top
 * face into the slab. That keeps the same emitter — and the same winding rules —
 * working for something lying flat as for something standing up.
 */
function slabFrame(topElevationMm: number): Frame {
  return {
    originM: [0, metresOf(topElevationMm), 0],
    along: [1, 0, 0],
    up: [0, 0, 1],
    across: [0, -1, 0],
  };
}

/* -------------------------------------------------------------------------- */
/* Internals: assembling a part.                                               */
/* -------------------------------------------------------------------------- */

function toBuffers(
  sink: Sink,
  kind: BuildPartKind,
  entityId: BuildEntityId,
  levelId: LevelId,
  openingIds: readonly OpeningId[],
  refusals: readonly CutRefusal[],
): BuiltPartBuffers {
  return {
    kind,
    entityId,
    levelId,
    position: new Float32Array(sink.position),
    normal: new Float32Array(sink.normal),
    uv: new Float32Array(sink.uv),
    openingIds,
    refusals,
  };
}

/**
 * A hole as a loop, wound the opposite way round from the outline.
 *
 * A loop keeps the solid on its left, so a hole runs clockwise where the outline
 * runs counter-clockwise; that is what makes one formula for the outward normal
 * work for both. `wall.ts` winds its `THREE.Path` holes the same way.
 */
function holeLoop(cut: OpeningCut): readonly Corner[] {
  return [
    { alongMm: cut.lowMm, heightMm: cut.sillMm },
    { alongMm: cut.lowMm, heightMm: cut.headMm },
    { alongMm: cut.highMm, heightMm: cut.headMm },
    { alongMm: cut.highMm, heightMm: cut.sillMm },
  ];
}

/** The panel hung in one opening: a plain box in the wall's own frame. */
function buildOpeningPanel(
  frame: Frame,
  wall: Wall,
  opening: AttachedOpening,
  levelId: LevelId,
): BuiltPartBuffers {
  const span = openingSpan(wall, opening);
  const halfThicknessMm = OPENING_PANEL_THICKNESS_MM / 2;
  const rect: FaceRect = {
    lowMm: span.lowMm,
    highMm: span.highMm,
    bottomMm: opening.sillHeightMm,
    topMm: millimetres(opening.sillHeightMm + opening.heightMm),
  };
  const loop: readonly Corner[] = [
    { alongMm: rect.lowMm, heightMm: rect.bottomMm },
    { alongMm: rect.highMm, heightMm: rect.bottomMm },
    { alongMm: rect.highMm, heightMm: rect.topMm },
    { alongMm: rect.lowMm, heightMm: rect.topMm },
  ];

  const sink = extrude(frame, rectTriangles(rect), [loop], -halfThicknessMm, halfThicknessMm);
  return toBuffers(sink, 'opening', opening.id, levelId, [], []);
}

function buildWallParts(job: WallBuildJob): readonly BuiltPartBuffers[] {
  assertUsableWall(job.wall);

  const lengthMm = centrelineLength(job.wall);
  const heightMm = millimetres(job.wall.topElevationMm - job.wall.baseElevationMm);
  const frame = wallFrameOf(job.wall);

  const onThisWall = openingsOnWall(job.wall, job.openings);
  const { cuts, refusals } = planCuts(job.wall, onThisWall, lengthMm, heightMm);

  const caps: CapTriangle[] = [];
  const loops: (readonly Corner[])[] = [];
  for (const panel of planPanels(cuts, lengthMm)) {
    for (const rect of panelRects(panel, heightMm)) {
      caps.push(...rectTriangles(rect));
    }
    loops.push(panelOutline(panel, heightMm), ...panelHoles(panel).map(holeLoop));
  }

  const halfThicknessMm = job.wall.thicknessMm / 2;
  const body = toBuffers(
    extrude(frame, caps, loops, -halfThicknessMm, halfThicknessMm),
    'wall',
    job.wall.id,
    job.levelId,
    cuts.map((cut) => cut.openingId),
    refusals,
  );

  const cutIds = new Set(cuts.map((cut) => cut.openingId));
  const panelsBuilt = onThisWall
    .filter((opening) => opening.kind !== 'void' && cutIds.has(opening.id))
    .map((opening) => buildOpeningPanel(frame, job.wall, opening, job.levelId));

  return [body, ...panelsBuilt];
}

function buildRoomParts(job: RoomBuildJob): readonly BuiltPartBuffers[] {
  const thicknessMm = job.slabThicknessMm ?? SLAB_THICKNESS_MM;

  if (job.room.outline.length < 3) {
    throw new RangeError(`Room ${job.room.id} has too few corners for a slab.`);
  }
  if (compareNearly(thicknessMm, 0) <= 0) {
    throw new RangeError(`Slab thickness must be a positive length: ${String(thicknessMm)}`);
  }

  const loop = roomLoop(job.room);
  const triangles = earClip(loop);
  const soffitMm = job.level.elevationMm + job.level.heightMm;

  const buildSlab = (kind: 'floorSlab' | 'ceiling', topElevationMm: number): BuiltPartBuffers => {
    // The slab's `across` axis points down, so the extrusion runs from the top
    // face into the slab: `0` is the finished surface, `thicknessMm` the soffit.
    const sink = extrude(slabFrame(topElevationMm), triangles, [loop], 0, thicknessMm);
    return toBuffers(sink, kind, job.room.id, job.levelId, [], []);
  };

  return [
    buildSlab('floorSlab', job.level.elevationMm),
    buildSlab('ceiling', soffitMm + thicknessMm),
  ];
}

/* -------------------------------------------------------------------------- */
/* Public entry point.                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Everything one job has to rebuild, as transferable buffers.
 *
 * Exported so it can be measured and compared against the main-thread builders
 * without a worker in the way; the message handler below is a thin wrapper round
 * this and nothing else.
 *
 * @throws RangeError when the wall or the room is one the geometry cannot work
 * with.
 */
export function buildParts(job: BuildJob): readonly BuiltPartBuffers[] {
  return job.kind === 'wall' ? buildWallParts(job) : buildRoomParts(job);
}

/** The buffers of a response, so `postMessage` can hand them over rather than copy. */
export function transferablesOf(parts: readonly BuiltPartBuffers[]): Transferable[] {
  return parts.flatMap((part) => [part.position.buffer, part.normal.buffer, part.uv.buffer]);
}

/** Answer one request, turning a bad model into a message rather than a silence. */
export function respondTo(message: BuildRequestMessage): BuildResponseMessage {
  try {
    return { ticket: message.ticket, parts: buildParts(message.job) };
  } catch (cause) {
    return { ticket: message.ticket, error: cause instanceof Error ? cause.message : String(cause) };
  }
}

/* -------------------------------------------------------------------------- */
/* Worker plumbing.                                                            */
/* -------------------------------------------------------------------------- */

/** The little of a worker global this file uses. */
interface WorkerScope {
  onmessage: ((event: { data: BuildRequestMessage }) => void) | null;
  postMessage: (message: BuildResponseMessage, transfer: Transferable[]) => void;
}

/**
 * Install the handler, but only in a worker.
 *
 * A test imports this module to measure `buildParts`, and a document context has
 * its own `onmessage` that nothing here has any business claiming. The absence of
 * a `document` is what tells the two apart.
 */
if (typeof document === 'undefined') {
  const scope = globalThis as unknown as WorkerScope;

  scope.onmessage = (event) => {
    const response = respondTo(event.data);
    scope.postMessage(response, 'parts' in response ? transferablesOf(response.parts) : []);
  };
}
