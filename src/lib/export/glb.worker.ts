/**
 * Exporting storeys to a GLB file, off the main thread.
 *
 * The deliverable of a QC session has to leave the system: one `.glb` that any
 * other viewer opens without knowing anything about this application. That file
 * is built here, in a worker, because building it means re-generating every
 * wall, slab and panel of every exported storey and then encoding the lot —
 * seconds of arithmetic that must not run where the pointer lives.
 *
 * **No three.js in this file**, for the same reason `build.worker.ts` gives:
 * a worker cannot render, so dragging the renderer in would only start a second
 * copy of it. The geometry comes from `buildParts`, the exact generator the
 * viewer's incremental rebuild uses, so the exported file shows the same
 * triangles the screen shows — the export is not a second interpretation of the
 * model. Furniture is the one part the viewer takes from a library instead of
 * generating, so the export stands in a plain box per item: the footprint the
 * plan records, extruded to a nominal height.
 *
 * The GLB container is written by hand — a 12-byte header, a JSON chunk and a
 * binary chunk — because that is all a GLB is, and the alternative is importing
 * an exporter written against the DOM into a thread that has none. Positions
 * are metres, which is the only unit glTF has; the file says so in its
 * metadata anyway, because a reader of `extras` should not need the spec.
 *
 * Cancellation is real, not advisory: the work is chunked, and between chunks
 * the worker yields to its own message queue, which is the only moment a
 * `cancel` message can arrive. A cancelled export throws before the container
 * is ever assembled, so there is no half-written file to leak — the file only
 * exists once the final `done` message carries it out.
 */

import { degrees, degreesToRadians, millimetres, millimetresToMetres } from '@/domain/units/types';
import type { Opening } from '@/domain/openings/types';
import type { Wall } from '@/domain/walls/types';
import type { Furniture, LevelId } from '@/domain/spatial/types';

import { buildParts } from '@/lib/three/build/buildCore';
import type { BuildPartKind } from '@/lib/three/build/scene';
import type { BuildableLevel, BuildableRoom } from '@/lib/three/build/floor';

/* -------------------------------------------------------------------------- */
/* Public types: what an export is asked for.                                  */
/* -------------------------------------------------------------------------- */

/**
 * How much of each mesh the file carries.
 *
 * - `high`: positions, normals and texture coordinates.
 * - `medium`: positions and normals; texture coordinates are dropped.
 * - `low`: positions only, and the panels hung in openings are left out —
 *   the holes stay, because the walls are cut before the panels are filtered.
 */
export type ExportDetail = 'high' | 'medium' | 'low';

export interface ExportGlbOptions {
  readonly detail: ExportDetail;
  /** Include the plain-box stand-ins for furniture items? */
  readonly includeFurniture: boolean;
  /**
   * Weld duplicated vertices into indexed primitives.
   *
   * The generators emit triangle soup — every corner is written once per
   * triangle that touches it — so welding routinely shrinks the vertex data
   * several times over while producing a file every viewer still opens.
   */
  readonly compress: boolean;
}

export const DEFAULT_EXPORT_OPTIONS: ExportGlbOptions = {
  detail: 'high',
  includeFurniture: true,
  compress: true,
};

/**
 * A level as the export needs it: the geometric fields the builders read, plus
 * the name a reader sees in the scene tree and the order the file name's floor
 * range is written from.
 */
export interface ExportLevel extends BuildableLevel {
  readonly name: string;
  /** Ordering from the bottom up; the ground level is 0. */
  readonly order: number;
}

/** Everything one storey contributes to the file. */
export interface ExportFloor {
  readonly level: ExportLevel;
  readonly walls: readonly Wall[];
  readonly rooms: readonly BuildableRoom[];
  /** Openings anywhere on the plan; only the ones on these walls are cut. */
  readonly openings: readonly Opening[];
  readonly furniture: readonly Furniture[];
}

/** One whole export, as the main thread hands it over. */
export interface ExportGlbRequest {
  readonly projectName: string;
  readonly projectVersion: string;
  /** ISO 8601. Stamped by the host, so this thread needs no clock. */
  readonly exportedAt: string;
  readonly floors: readonly ExportFloor[];
  readonly options: ExportGlbOptions;
}

/** What `asset.extras` of the exported file says about its origin. */
export interface GlbProjectMetadata {
  readonly projectName: string;
  readonly projectVersion: string;
  readonly exportedAt: string;
  readonly unit: 'metre';
}

/* -------------------------------------------------------------------------- */
/* Public types: progress and the message protocol.                            */
/* -------------------------------------------------------------------------- */

/** The two stretches of work an export is made of. */
export type ExportPhase = 'build' | 'encode';

export interface ExportProgress {
  readonly phase: ExportPhase;
  readonly completed: number;
  readonly total: number;
}

/** What the main thread sends. */
export type ExportRequestMessage =
  | { readonly kind: 'start'; readonly ticket: number; readonly request: ExportGlbRequest }
  | { readonly kind: 'cancel'; readonly ticket: number };

/** What comes back: progress along the way, then exactly one terminal message. */
export type ExportResponseMessage =
  | ({ readonly kind: 'progress'; readonly ticket: number } & ExportProgress)
  | { readonly kind: 'done'; readonly ticket: number; readonly glb: ArrayBuffer }
  | { readonly kind: 'cancelled'; readonly ticket: number }
  | { readonly kind: 'error'; readonly ticket: number; readonly message: string };

/** The message a cancelled export fails with, on both sides of the thread. */
export const EXPORT_CANCELLED_MESSAGE = 'cancelled';

/**
 * How `exportToGlb` talks to whoever is running it.
 *
 * In the worker these bridge to `postMessage` and the cancel set; in a test
 * they are plain functions, so the whole export runs without a thread.
 */
export interface ExportRunHooks {
  onProgress(progress: ExportProgress): void;
  shouldCancel(): boolean;
  /** Let queued messages — a cancel — be handled between chunks of work. */
  yieldToQueue(): Promise<void>;
}

/* -------------------------------------------------------------------------- */
/* Internals: constants.                                                       */
/* -------------------------------------------------------------------------- */

/** `glTF` in ASCII, little-endian, as the header magic. */
const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
/** `JSON` chunk type. */
const GLB_JSON_CHUNK_TYPE = 0x4e4f534a;
/** `BIN\0` chunk type. */
const GLB_BIN_CHUNK_TYPE = 0x004e4942;
const GLB_HEADER_BYTES = 12;
const GLB_CHUNK_HEADER_BYTES = 8;

const COMPONENT_TYPE_UNSIGNED_SHORT = 5123;
const COMPONENT_TYPE_UNSIGNED_INT = 5125;
const COMPONENT_TYPE_FLOAT = 5126;
const TARGET_ARRAY_BUFFER = 34962;
const TARGET_ELEMENT_ARRAY_BUFFER = 34963;

/** The most vertices a `Uint16Array` of indices can address. */
const MAX_UINT16_VERTEX_COUNT = 65535;

/** How many work units run between two yields to the message queue. */
const YIELD_INTERVAL = 8;

const GLB_GENERATOR = 'app-front';

/**
 * The plan stores a furniture footprint and no height, so the stand-in box
 * takes a nominal one — tabletop height, near enough for every kind the plan
 * records — rather than inventing a height per kind that nothing measured.
 */
export const FURNITURE_STAND_IN_HEIGHT_MM = millimetres(800);

/* -------------------------------------------------------------------------- */
/* Internals: collected geometry.                                              */
/* -------------------------------------------------------------------------- */

/** One mesh's worth of geometry, as the encoder consumes it. */
interface ExportPart {
  readonly kind: BuildPartKind;
  readonly entityId: string;
  readonly levelId: LevelId;
  readonly position: Float32Array;
  readonly normal: Float32Array;
  readonly uv: Float32Array;
}

/** Everything one storey contributed, kept with the storey it came from. */
interface FloorParts {
  readonly floor: ExportFloor;
  readonly parts: readonly ExportPart[];
}

type V3 = readonly [number, number, number];
type V2 = readonly [number, number];

interface TriangleSink {
  readonly position: number[];
  readonly normal: number[];
  readonly uv: number[];
}

/** Millimetres to scene units, through the domain's own conversion. */
function metresOf(valueMm: number): number {
  return millimetresToMetres(millimetres(valueMm));
}

function pushTriangle(
  sink: TriangleSink,
  first: V3,
  second: V3,
  third: V3,
  normal: V3,
  firstUv: V2,
  secondUv: V2,
  thirdUv: V2,
): void {
  sink.position.push(...first, ...second, ...third);
  sink.normal.push(...normal, ...normal, ...normal);
  sink.uv.push(...firstUv, ...secondUv, ...thirdUv);
}

/** A flat quad as two triangles, corners given in winding order. */
function pushQuad(sink: TriangleSink, a: V3, b: V3, c: V3, d: V3, normal: V3): void {
  pushTriangle(sink, a, b, c, normal, [0, 0], [1, 0], [1, 1]);
  pushTriangle(sink, a, c, d, normal, [0, 0], [1, 1], [0, 1]);
}

interface PlanPoint {
  readonly x: number;
  readonly y: number;
}

/** The four corners of the bounding box, turned about the centre. */
function rotatedFootprint(item: Furniture): readonly [PlanPoint, PlanPoint, PlanPoint, PlanPoint] {
  const angle = degreesToRadians(degrees(item.rotationDeg));
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const { centre, boundingBox } = item;

  const rotate = (x: number, y: number): PlanPoint => ({
    x: centre.x + (x - centre.x) * cos - (y - centre.y) * sin,
    y: centre.y + (x - centre.x) * sin + (y - centre.y) * cos,
  });

  return [
    rotate(boundingBox.min.x, boundingBox.min.y),
    rotate(boundingBox.max.x, boundingBox.min.y),
    rotate(boundingBox.max.x, boundingBox.max.y),
    rotate(boundingBox.min.x, boundingBox.max.y),
  ];
}

/**
 * A furniture item as a closed box: its rotated footprint, extruded from the
 * level's finished floor to the stand-in height. Plan axes map to the scene
 * the same way the wall and slab builders map them: plan x is scene x, plan y
 * is scene z, and up is scene y.
 */
function furniturePart(item: Furniture, level: ExportLevel): ExportPart {
  const [c0, c1, c2, c3] = rotatedFootprint(item);
  const baseM = metresOf(level.elevationMm);
  const topM = metresOf(level.elevationMm + FURNITURE_STAND_IN_HEIGHT_MM);
  const at = (corner: PlanPoint, heightM: number): V3 => [
    metresOf(corner.x),
    heightM,
    metresOf(corner.y),
  ];

  const sink: TriangleSink = { position: [], normal: [], uv: [] };

  pushQuad(sink, at(c0, baseM), at(c1, baseM), at(c2, baseM), at(c3, baseM), [0, -1, 0]);
  // The top runs the corners the other way round, so both caps face outwards.
  pushQuad(sink, at(c0, topM), at(c3, topM), at(c2, topM), at(c1, topM), [0, 1, 0]);

  const corners = [c0, c1, c2, c3] as const;
  for (let index = 0; index < corners.length; index += 1) {
    const from = corners[index] ?? c0;
    const to = corners[(index + 1) % corners.length] ?? c0;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) {
      continue;
    }
    const normal: V3 = [dy / length, 0, -dx / length];
    pushQuad(sink, at(from, baseM), at(to, baseM), at(to, topM), at(from, topM), normal);
  }

  return {
    kind: 'furniture',
    entityId: item.id,
    levelId: level.id,
    position: new Float32Array(sink.position),
    normal: new Float32Array(sink.normal),
    uv: new Float32Array(sink.uv),
  };
}

/* -------------------------------------------------------------------------- */
/* Internals: cancellation checkpoints.                                        */
/* -------------------------------------------------------------------------- */

type Checkpoint = () => Promise<void>;

/**
 * A checkpoint the work loops call once per unit.
 *
 * Every call checks for cancellation; every `YIELD_INTERVAL`th call also
 * yields to the message queue, which is the only moment the worker's `cancel`
 * handler can run at all — a worker that never yields can never be cancelled,
 * whatever flag it checks.
 */
function createCheckpoint(hooks: ExportRunHooks): Checkpoint {
  let unitsSinceYield = 0;

  return async () => {
    if (hooks.shouldCancel()) {
      throw new Error(EXPORT_CANCELLED_MESSAGE);
    }
    unitsSinceYield += 1;
    if (unitsSinceYield >= YIELD_INTERVAL) {
      unitsSinceYield = 0;
      await hooks.yieldToQueue();
      if (hooks.shouldCancel()) {
        throw new Error(EXPORT_CANCELLED_MESSAGE);
      }
    }
  };
}

/* -------------------------------------------------------------------------- */
/* Internals: the build phase.                                                 */
/* -------------------------------------------------------------------------- */

function countBuildUnits(floors: readonly ExportFloor[], options: ExportGlbOptions): number {
  return floors.reduce(
    (total, floor) =>
      total +
      floor.walls.length +
      floor.rooms.length +
      (options.includeFurniture ? floor.furniture.length : 0),
    0,
  );
}

/**
 * Re-generate the geometry of every exported storey.
 *
 * Walls and rooms go through `buildParts`, the same generator the viewer's
 * worker uses, so the file cannot disagree with the screen. One wall or one
 * room is one unit of progress and one cancellation checkpoint.
 */
async function collectParts(
  request: ExportGlbRequest,
  checkpoint: Checkpoint,
  hooks: ExportRunHooks,
): Promise<readonly FloorParts[]> {
  const total = countBuildUnits(request.floors, request.options);
  const { options } = request;
  let completed = 0;

  hooks.onProgress({ phase: 'build', completed, total });

  const collected: FloorParts[] = [];

  for (const floor of request.floors) {
    const parts: ExportPart[] = [];

    for (const wall of floor.walls) {
      await checkpoint();
      const built = buildParts({
        kind: 'wall',
        key: wall.id,
        levelId: floor.level.id,
        wall,
        openings: floor.openings,
      });
      // At low detail the panels are dropped but the holes stay: the wall was
      // cut before this filter runs, so a doorway still reads as a doorway.
      parts.push(...(options.detail === 'low' ? built.filter((part) => part.kind !== 'opening') : built));
      completed += 1;
      hooks.onProgress({ phase: 'build', completed, total });
    }

    for (const room of floor.rooms) {
      await checkpoint();
      parts.push(
        ...buildParts({
          kind: 'room',
          key: room.id,
          levelId: floor.level.id,
          room,
          level: floor.level,
        }),
      );
      completed += 1;
      hooks.onProgress({ phase: 'build', completed, total });
    }

    if (options.includeFurniture) {
      for (const item of floor.furniture) {
        await checkpoint();
        parts.push(furniturePart(item, floor.level));
        completed += 1;
        hooks.onProgress({ phase: 'build', completed, total });
      }
    }

    collected.push({ floor, parts });
  }

  return collected;
}

/* -------------------------------------------------------------------------- */
/* Internals: welding.                                                         */
/* -------------------------------------------------------------------------- */

interface EncodedGeometry {
  readonly position: Float32Array;
  readonly normal: Float32Array | null;
  readonly uv: Float32Array | null;
  readonly indices: Uint16Array | Uint32Array | null;
}

/**
 * Triangle soup into an indexed mesh.
 *
 * Two vertices are one vertex only when every attribute matches bit for bit,
 * so a crease keeps its two normals and welding never smooths anything — it
 * only stops the same corner being stored once per triangle that touches it.
 */
function weldGeometry(
  position: Float32Array,
  normal: Float32Array | null,
  uv: Float32Array | null,
): EncodedGeometry {
  const vertexCount = Math.floor(position.length / 3);
  const remap = new Map<string, number>();
  const outPosition: number[] = [];
  const outNormal: number[] = [];
  const outUv: number[] = [];
  const indexList: number[] = [];

  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const px = position[vertex * 3] ?? 0;
    const py = position[vertex * 3 + 1] ?? 0;
    const pz = position[vertex * 3 + 2] ?? 0;
    const nx = normal === null ? 0 : (normal[vertex * 3] ?? 0);
    const ny = normal === null ? 0 : (normal[vertex * 3 + 1] ?? 0);
    const nz = normal === null ? 0 : (normal[vertex * 3 + 2] ?? 0);
    const tu = uv === null ? 0 : (uv[vertex * 2] ?? 0);
    const tv = uv === null ? 0 : (uv[vertex * 2 + 1] ?? 0);

    const key = `${String(px)},${String(py)},${String(pz)},${String(nx)},${String(ny)},${String(nz)},${String(tu)},${String(tv)}`;
    let index = remap.get(key);
    if (index === undefined) {
      index = outPosition.length / 3;
      remap.set(key, index);
      outPosition.push(px, py, pz);
      if (normal !== null) {
        outNormal.push(nx, ny, nz);
      }
      if (uv !== null) {
        outUv.push(tu, tv);
      }
    }
    indexList.push(index);
  }

  const uniqueCount = outPosition.length / 3;

  return {
    position: new Float32Array(outPosition),
    normal: normal === null ? null : new Float32Array(outNormal),
    uv: uv === null ? null : new Float32Array(outUv),
    indices:
      uniqueCount <= MAX_UINT16_VERTEX_COUNT
        ? new Uint16Array(indexList)
        : new Uint32Array(indexList),
  };
}

/* -------------------------------------------------------------------------- */
/* Internals: the glTF document.                                               */
/* -------------------------------------------------------------------------- */

interface GltfBufferView {
  buffer: number;
  byteOffset: number;
  byteLength: number;
  target?: number;
}

interface GltfAccessor {
  bufferView: number;
  componentType: number;
  count: number;
  type: 'VEC3' | 'VEC2' | 'SCALAR';
  min?: readonly number[];
  max?: readonly number[];
}

interface GltfPrimitive {
  attributes: Record<string, number>;
  indices?: number;
}

interface GltfMesh {
  name: string;
  primitives: GltfPrimitive[];
}

interface GltfNodeExtras {
  levelId: LevelId;
  entityId?: string;
  kind?: BuildPartKind;
}

interface GltfNode {
  name: string;
  mesh?: number;
  children?: number[];
  extras: GltfNodeExtras;
}

interface GltfDocument {
  asset: { version: '2.0'; generator: string; extras: GlbProjectMetadata };
  scene: number;
  scenes: { name: string; nodes: number[] }[];
  nodes: GltfNode[];
  meshes: GltfMesh[];
  accessors: GltfAccessor[];
  bufferViews: GltfBufferView[];
  buffers: { byteLength: number }[];
}

/** The binary chunk as it accumulates, every view starting 4-byte aligned. */
class BinaryChunkWriter {
  private readonly chunks: Uint8Array[] = [];
  private lengthBytes = 0;

  append(bytes: Uint8Array): number {
    const padding = (4 - (this.lengthBytes % 4)) % 4;
    if (padding > 0) {
      this.chunks.push(new Uint8Array(padding));
      this.lengthBytes += padding;
    }
    const offset = this.lengthBytes;
    this.chunks.push(bytes);
    this.lengthBytes += bytes.byteLength;
    return offset;
  }

  concat(): Uint8Array {
    const joined = new Uint8Array(this.lengthBytes);
    let offset = 0;
    for (const chunk of this.chunks) {
      joined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return joined;
  }
}

interface EncodeContext {
  readonly bin: BinaryChunkWriter;
  readonly bufferViews: GltfBufferView[];
  readonly accessors: GltfAccessor[];
  readonly meshes: GltfMesh[];
}

function bytesOf(values: Float32Array | Uint16Array | Uint32Array): Uint8Array {
  return new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
}

function appendBufferView(context: EncodeContext, bytes: Uint8Array, target: number): number {
  const byteOffset = context.bin.append(bytes);
  context.bufferViews.push({ buffer: 0, byteOffset, byteLength: bytes.byteLength, target });
  return context.bufferViews.length - 1;
}

/** Per-component minima and maxima, which glTF requires on `POSITION`. */
function vectorBounds(
  values: Float32Array,
  itemSize: number,
): { min: number[]; max: number[] } {
  const min = new Array<number>(itemSize).fill(Number.POSITIVE_INFINITY);
  const max = new Array<number>(itemSize).fill(Number.NEGATIVE_INFINITY);

  for (let index = 0; index < values.length; index += 1) {
    const component = index % itemSize;
    const value = values[index] ?? 0;
    min[component] = Math.min(min[component] ?? value, value);
    max[component] = Math.max(max[component] ?? value, value);
  }

  return { min, max };
}

function appendFloatAccessor(
  context: EncodeContext,
  values: Float32Array,
  type: 'VEC3' | 'VEC2',
  withBounds: boolean,
): number {
  const itemSize = type === 'VEC3' ? 3 : 2;
  const bufferView = appendBufferView(context, bytesOf(values), TARGET_ARRAY_BUFFER);
  const accessor: GltfAccessor = {
    bufferView,
    componentType: COMPONENT_TYPE_FLOAT,
    count: values.length / itemSize,
    type,
  };
  if (withBounds) {
    const bounds = vectorBounds(values, itemSize);
    accessor.min = bounds.min;
    accessor.max = bounds.max;
  }
  context.accessors.push(accessor);
  return context.accessors.length - 1;
}

function appendIndexAccessor(context: EncodeContext, indices: Uint16Array | Uint32Array): number {
  const bufferView = appendBufferView(context, bytesOf(indices), TARGET_ELEMENT_ARRAY_BUFFER);
  context.accessors.push({
    bufferView,
    componentType:
      indices instanceof Uint16Array ? COMPONENT_TYPE_UNSIGNED_SHORT : COMPONENT_TYPE_UNSIGNED_INT,
    count: indices.length,
    type: 'SCALAR',
  });
  return context.accessors.length - 1;
}

/** One part as one mesh with one primitive; returns the mesh index. */
function encodePart(context: EncodeContext, part: ExportPart, options: ExportGlbOptions): number {
  const withNormal = options.detail !== 'low';
  const withUv = options.detail === 'high';

  const geometry: EncodedGeometry = options.compress
    ? weldGeometry(part.position, withNormal ? part.normal : null, withUv ? part.uv : null)
    : {
        position: part.position,
        normal: withNormal ? part.normal : null,
        uv: withUv ? part.uv : null,
        indices: null,
      };

  const attributes: Record<string, number> = {
    POSITION: appendFloatAccessor(context, geometry.position, 'VEC3', true),
  };
  if (geometry.normal !== null) {
    attributes['NORMAL'] = appendFloatAccessor(context, geometry.normal, 'VEC3', false);
  }
  if (geometry.uv !== null) {
    attributes['TEXCOORD_0'] = appendFloatAccessor(context, geometry.uv, 'VEC2', false);
  }

  const primitive: GltfPrimitive = { attributes };
  if (geometry.indices !== null) {
    primitive.indices = appendIndexAccessor(context, geometry.indices);
  }

  context.meshes.push({ name: `${part.kind} ${part.entityId}`, primitives: [primitive] });
  return context.meshes.length - 1;
}

function padToFourBytes(bytes: Uint8Array, fill: number): Uint8Array {
  const padding = (4 - (bytes.byteLength % 4)) % 4;
  if (padding === 0) {
    return bytes;
  }
  const padded = new Uint8Array(bytes.byteLength + padding);
  padded.set(bytes);
  padded.fill(fill, bytes.byteLength);
  return padded;
}

/** The container itself: header, JSON chunk padded with spaces, binary chunk. */
function assembleGlb(document: GltfDocument, bin: Uint8Array): ArrayBuffer {
  const binPadded = padToFourBytes(bin, 0x00);
  document.buffers = binPadded.byteLength === 0 ? [] : [{ byteLength: binPadded.byteLength }];

  const jsonPadded = padToFourBytes(new TextEncoder().encode(JSON.stringify(document)), 0x20);

  const totalLength =
    GLB_HEADER_BYTES +
    GLB_CHUNK_HEADER_BYTES +
    jsonPadded.byteLength +
    (binPadded.byteLength > 0 ? GLB_CHUNK_HEADER_BYTES + binPadded.byteLength : 0);

  const buffer = new ArrayBuffer(totalLength);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, GLB_VERSION, true);
  view.setUint32(8, totalLength, true);

  view.setUint32(GLB_HEADER_BYTES, jsonPadded.byteLength, true);
  view.setUint32(GLB_HEADER_BYTES + 4, GLB_JSON_CHUNK_TYPE, true);
  bytes.set(jsonPadded, GLB_HEADER_BYTES + GLB_CHUNK_HEADER_BYTES);

  if (binPadded.byteLength > 0) {
    const binHeaderOffset = GLB_HEADER_BYTES + GLB_CHUNK_HEADER_BYTES + jsonPadded.byteLength;
    view.setUint32(binHeaderOffset, binPadded.byteLength, true);
    view.setUint32(binHeaderOffset + 4, GLB_BIN_CHUNK_TYPE, true);
    bytes.set(binPadded, binHeaderOffset + GLB_CHUNK_HEADER_BYTES);
  }

  return buffer;
}

/**
 * The encode phase: every part becomes a mesh under its level's node, and the
 * levels become the scene. Each level node carries `extras.levelId`, and each
 * part node repeats it next to the entity id, so a reader of the file can
 * group by storey without parsing anybody's node names.
 */
async function encodeDocument(
  request: ExportGlbRequest,
  floorParts: readonly FloorParts[],
  checkpoint: Checkpoint,
  hooks: ExportRunHooks,
): Promise<ArrayBuffer> {
  const total = floorParts.reduce((sum, entry) => sum + entry.parts.length, 0);
  let completed = 0;

  hooks.onProgress({ phase: 'encode', completed, total });

  const context: EncodeContext = {
    bin: new BinaryChunkWriter(),
    bufferViews: [],
    accessors: [],
    meshes: [],
  };
  const nodes: GltfNode[] = [];
  const sceneNodes: number[] = [];

  for (const { floor, parts } of floorParts) {
    const children: number[] = [];

    for (const part of parts) {
      await checkpoint();
      if (part.position.length > 0) {
        const mesh = encodePart(context, part, request.options);
        nodes.push({
          name: `${part.kind} ${part.entityId}`,
          mesh,
          extras: { levelId: floor.level.id, entityId: part.entityId, kind: part.kind },
        });
        children.push(nodes.length - 1);
      }
      completed += 1;
      hooks.onProgress({ phase: 'encode', completed, total });
    }

    const levelNode: GltfNode = {
      name: floor.level.name,
      extras: { levelId: floor.level.id },
    };
    if (children.length > 0) {
      levelNode.children = children;
    }
    nodes.push(levelNode);
    sceneNodes.push(nodes.length - 1);
  }

  const document: GltfDocument = {
    asset: {
      version: '2.0',
      generator: GLB_GENERATOR,
      extras: {
        projectName: request.projectName,
        projectVersion: request.projectVersion,
        exportedAt: request.exportedAt,
        unit: 'metre',
      },
    },
    scene: 0,
    scenes: [{ name: request.projectName, nodes: sceneNodes }],
    nodes,
    meshes: context.meshes,
    accessors: context.accessors,
    bufferViews: context.bufferViews,
    buffers: [],
  };

  return assembleGlb(document, context.bin.concat());
}

/* -------------------------------------------------------------------------- */
/* Public entry point.                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The whole export, as one awaitable function with no thread in it.
 *
 * Exported so a test can run it to completion — or to a cancellation — without
 * a worker; the message handler below is a thin wrapper round this and nothing
 * else. Nothing is written anywhere until the returned buffer exists, which is
 * what makes cancellation clean: an export that throws leaves no file in any
 * state, because there was never a file.
 *
 * @throws Error with `EXPORT_CANCELLED_MESSAGE` at the first checkpoint after
 * `shouldCancel` turns true.
 * @throws RangeError when there is no floor to export, or when a wall or room
 * is one the geometry cannot work with.
 */
export async function exportToGlb(
  request: ExportGlbRequest,
  hooks: ExportRunHooks,
): Promise<ArrayBuffer> {
  if (request.floors.length === 0) {
    throw new RangeError('An export needs at least one floor.');
  }

  const checkpoint = createCheckpoint(hooks);
  const floorParts = await collectParts(request, checkpoint, hooks);
  return encodeDocument(request, floorParts, checkpoint, hooks);
}

/* -------------------------------------------------------------------------- */
/* Worker plumbing.                                                            */
/* -------------------------------------------------------------------------- */

/** The little of a worker global this file uses. */
interface ExportWorkerScope {
  onmessage: ((event: { data: ExportRequestMessage }) => void) | null;
  postMessage: (message: ExportResponseMessage, transfer?: Transferable[]) => void;
}

/**
 * Install the handler, but only in a worker.
 *
 * The absence of a `document` is what tells a worker from a test import, the
 * same way `build.worker.ts` tells them apart. The geometry comes from
 * `buildCore.ts` — the pure module, not the build worker's entry point — so no
 * other handler is ever installed in this thread to race this one.
 */
if (typeof document === 'undefined') {
  const scope = globalThis as unknown as ExportWorkerScope;
  const cancelledTickets = new Set<number>();

  scope.onmessage = (event) => {
    const message = event.data;

    if (message.kind === 'cancel') {
      cancelledTickets.add(message.ticket);
      return;
    }

    const { ticket, request } = message;
    void (async () => {
      try {
        const glb = await exportToGlb(request, {
          onProgress: (progress) => {
            scope.postMessage({ kind: 'progress', ticket, ...progress });
          },
          shouldCancel: () => cancelledTickets.has(ticket),
          yieldToQueue: () =>
            new Promise((resolve) => {
              setTimeout(resolve, 0);
            }),
        });
        scope.postMessage({ kind: 'done', ticket, glb }, [glb]);
      } catch (cause) {
        if (cause instanceof Error && cause.message === EXPORT_CANCELLED_MESSAGE) {
          scope.postMessage({ kind: 'cancelled', ticket });
        } else {
          scope.postMessage({
            kind: 'error',
            ticket,
            message: cause instanceof Error ? cause.message : String(cause),
          });
        }
      } finally {
        cancelledTickets.delete(ticket);
      }
    })();
  };
}
