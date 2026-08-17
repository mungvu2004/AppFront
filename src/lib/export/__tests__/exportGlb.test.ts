import { describe, expect, it, vi } from 'vitest';

import { millimetres } from '@/domain/units/types';
import type { PointMm } from '@/domain/units/compare';
import type { AttachedOpening } from '@/domain/openings/types';
import type { Wall } from '@/domain/walls/types';
import type { Furniture, FurnitureId, LevelId, OpeningId, RoomId, WallId } from '@/domain/spatial/types';
import type { BuildableRoom } from '@/lib/three/build/floor';

import {
  DEFAULT_EXPORT_OPTIONS,
  EXPORT_CANCELLED_MESSAGE,
  exportToGlb,
  type ExportFloor,
  type ExportGlbOptions,
  type ExportGlbRequest,
  type ExportLevel,
  type ExportProgress,
  type ExportRequestMessage,
  type ExportResponseMessage,
  type ExportRunHooks,
} from '../glb.worker';
import {
  buildGlbFileName,
  exportGlb,
  formatExportTimestamp,
  GLB_MIME_TYPE,
  stripDiacritics,
  toFileSlug,
  type ExportWorkerLike,
} from '../exportGlb';

/* -------------------------------------------------------------------------- */
/* Fixtures: the standard sample plan, 48 / 21 / 34 / 14 / 4.                  */
/* -------------------------------------------------------------------------- */

const FLOOR_COUNT = 4;
const WALLS_PER_FLOOR = 12; // 48 walls across the 4 floors.
const ROOMS_PER_FLOOR = [4, 4, 3, 3] as const; // 14 rooms.
const FURNITURE_PER_FLOOR = [6, 5, 5, 5] as const; // 21 items.

const LEVEL_HEIGHT_MM = 3000;
const WALL_LENGTH_MM = 4000;
const PROJECT_NAME = 'Chung cư Hoàng Anh';
const PROJECT_VERSION = '1.4.0';
const EXPORTED_AT = '2026-08-17T07:32:05.000Z';

function pointAt(x: number, y: number): PointMm {
  return { x: millimetres(x), y: millimetres(y) };
}

function levelAt(index: number): ExportLevel {
  return {
    id: `L-0${String(index)}` as LevelId,
    name: `Level ${String(index)}`,
    order: index,
    elevationMm: millimetres(index * LEVEL_HEIGHT_MM),
    heightMm: millimetres(LEVEL_HEIGHT_MM),
  };
}

function wallsOf(floorIndex: number, level: ExportLevel): readonly Wall[] {
  return Array.from({ length: WALLS_PER_FLOOR }, (_unused, index): Wall => {
    const acrossMm = index * 5000;
    return {
      id: `W-${String(floorIndex)}${String(index).padStart(2, '0')}` as WallId,
      kind: 'partition',
      centreline: { start: pointAt(0, acrossMm), end: pointAt(WALL_LENGTH_MM, acrossMm) },
      thicknessMm: millimetres(200),
      baseElevationMm: level.elevationMm,
      topElevationMm: millimetres(level.elevationMm + LEVEL_HEIGHT_MM),
    };
  });
}

/** One door per floor, hung in the middle of the floor's first wall. */
function openingsOf(floorIndex: number, walls: readonly Wall[]): readonly AttachedOpening[] {
  const host = walls[0];
  if (host === undefined) {
    throw new Error('The fixture floor has no wall to hang a door in.');
  }
  return [
    {
      id: `D-${String(floorIndex)}00` as OpeningId,
      kind: 'door',
      widthMm: millimetres(900),
      heightMm: millimetres(2100),
      sillHeightMm: millimetres(0),
      swing: 'left',
      wallId: host.id,
      relativePosition: 0.5,
    },
  ];
}

function roomsOf(floorIndex: number): readonly BuildableRoom[] {
  const count = ROOMS_PER_FLOOR[floorIndex] ?? 0;
  return Array.from({ length: count }, (_unused, index): BuildableRoom => {
    const offsetMm = index * 6000;
    return {
      id: `R-${String(floorIndex)}${String(index).padStart(2, '0')}` as RoomId,
      outline: [
        pointAt(offsetMm, 0),
        pointAt(offsetMm + 5000, 0),
        pointAt(offsetMm + 5000, 4000),
        pointAt(offsetMm, 4000),
      ],
    };
  });
}

function furnitureOf(floorIndex: number, level: ExportLevel): readonly Furniture[] {
  const count = FURNITURE_PER_FLOOR[floorIndex] ?? 0;
  return Array.from({ length: count }, (_unused, index): Furniture => {
    const originMm = index * 2000;
    return {
      id: `F-${String(floorIndex)}${String(index).padStart(2, '0')}` as FurnitureId,
      levelId: level.id,
      kind: 'table',
      centre: { x: originMm + 400, y: 400 },
      boundingBox: { min: { x: originMm, y: 0 }, max: { x: originMm + 800, y: 800 } },
      rotationDeg: index === 0 ? 45 : 0,
      confidence: 0.9,
      source: 'ai',
      reviewed: false,
    };
  });
}

function sampleFloors(): readonly ExportFloor[] {
  return Array.from({ length: FLOOR_COUNT }, (_unused, index): ExportFloor => {
    const level = levelAt(index);
    const walls = wallsOf(index, level);
    return {
      level,
      walls,
      rooms: roomsOf(index),
      openings: openingsOf(index, walls),
      furniture: furnitureOf(index, level),
    };
  });
}

function requestWith(options: Partial<ExportGlbOptions> = {}): ExportGlbRequest {
  return {
    projectName: PROJECT_NAME,
    projectVersion: PROJECT_VERSION,
    exportedAt: EXPORTED_AT,
    floors: sampleFloors(),
    options: { ...DEFAULT_EXPORT_OPTIONS, ...options },
  };
}

/** Hooks that never cancel and never leave the microtask queue. */
function immediateHooks(onProgress: (progress: ExportProgress) => void = () => undefined): ExportRunHooks {
  return {
    onProgress,
    shouldCancel: () => false,
    yieldToQueue: () => Promise.resolve(),
  };
}

/* -------------------------------------------------------------------------- */
/* A tiny GLB reader, so the tests check the file and not the implementation.  */
/* -------------------------------------------------------------------------- */

interface GlbJson {
  readonly asset: {
    readonly version: string;
    readonly generator: string;
    readonly extras: {
      readonly projectName: string;
      readonly projectVersion: string;
      readonly exportedAt: string;
      readonly unit: string;
    };
  };
  readonly scene: number;
  readonly scenes: readonly { readonly name: string; readonly nodes: readonly number[] }[];
  readonly nodes: readonly {
    readonly name: string;
    readonly mesh?: number;
    readonly children?: readonly number[];
    readonly extras?: { readonly levelId?: string; readonly entityId?: string; readonly kind?: string };
  }[];
  readonly meshes: readonly {
    readonly name: string;
    readonly primitives: readonly { readonly attributes: Record<string, number>; readonly indices?: number }[];
  }[];
  readonly accessors: readonly { readonly count: number }[];
  readonly buffers: readonly { readonly byteLength: number }[];
}

interface ParsedGlb {
  readonly magic: number;
  readonly version: number;
  readonly totalLength: number;
  readonly json: GlbJson;
  readonly binByteLength: number;
}

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;

function parseGlb(glb: ArrayBuffer): ParsedGlb {
  const view = new DataView(glb);
  const magic = view.getUint32(0, true);
  const version = view.getUint32(4, true);
  const totalLength = view.getUint32(8, true);

  const jsonLength = view.getUint32(12, true);
  const jsonChunkType = view.getUint32(16, true);
  if (jsonChunkType !== JSON_CHUNK_TYPE) {
    throw new Error('The first chunk is not the JSON chunk.');
  }
  const jsonText = new TextDecoder().decode(new Uint8Array(glb, 20, jsonLength));
  const json = JSON.parse(jsonText) as GlbJson;

  let binByteLength = 0;
  const binHeaderOffset = 20 + jsonLength;
  if (binHeaderOffset < glb.byteLength) {
    const binChunkType = view.getUint32(binHeaderOffset + 4, true);
    if (binChunkType !== BIN_CHUNK_TYPE) {
      throw new Error('The second chunk is not the binary chunk.');
    }
    binByteLength = view.getUint32(binHeaderOffset, true);
  }

  return { magic, version, totalLength, json, binByteLength };
}

/** The part nodes of a parsed file, meaning every node that carries a mesh. */
function partNodes(json: GlbJson): readonly GlbJson['nodes'][number][] {
  return json.nodes.filter((node) => node.mesh !== undefined);
}

/* -------------------------------------------------------------------------- */
/* exportToGlb: the worker's pure core.                                        */
/* -------------------------------------------------------------------------- */

describe('exportToGlb', () => {
  it('exports the four sample floors as a non-empty GLB with one group per level', async () => {
    const glb = await exportToGlb(requestWith(), immediateHooks());
    const parsed = parseGlb(glb);

    expect(glb.byteLength).toBeGreaterThan(0);
    expect(parsed.magic).toBe(GLB_MAGIC);
    expect(parsed.version).toBe(2);
    expect(parsed.totalLength).toBe(glb.byteLength);
    expect(parsed.binByteLength).toBeGreaterThan(0);

    const sceneNodeIndices = parsed.json.scenes[0]?.nodes ?? [];
    expect(sceneNodeIndices).toHaveLength(FLOOR_COUNT);

    const levelIds = sceneNodeIndices.map(
      (nodeIndex) => parsed.json.nodes[nodeIndex]?.extras?.levelId,
    );
    expect(levelIds).toEqual(['L-00', 'L-01', 'L-02', 'L-03']);
  });

  it('writes the project metadata and tags every part node with its level id', async () => {
    const glb = await exportToGlb(requestWith(), immediateHooks());
    const { json } = parseGlb(glb);

    expect(json.asset.version).toBe('2.0');
    expect(json.asset.extras).toEqual({
      projectName: PROJECT_NAME,
      projectVersion: PROJECT_VERSION,
      exportedAt: EXPORTED_AT,
      unit: 'metre',
    });

    const parts = partNodes(json);
    expect(parts.length).toBeGreaterThan(0);
    for (const node of parts) {
      expect(node.extras?.levelId).toMatch(/^L-0[0-3]$/);
      expect(node.extras?.entityId).toBeDefined();
      expect(node.extras?.kind).toBeDefined();
    }
  });

  it('covers walls, rooms, openings and furniture in the exported kinds', async () => {
    const glb = await exportToGlb(requestWith(), immediateHooks());
    const { json } = parseGlb(glb);

    const kinds = new Set(partNodes(json).map((node) => node.extras?.kind));
    expect(kinds).toEqual(new Set(['wall', 'floorSlab', 'ceiling', 'opening', 'furniture']));
  });

  it('keeps furniture out of the file when includeFurniture is off', async () => {
    const glb = await exportToGlb(requestWith({ includeFurniture: false }), immediateHooks());
    const { json } = parseGlb(glb);

    const furniture = partNodes(json).filter((node) => node.extras?.kind === 'furniture');
    expect(furniture).toHaveLength(0);
  });

  it('drops attribute streams and opening panels as the detail level falls', async () => {
    const high = parseGlb(await exportToGlb(requestWith({ detail: 'high' }), immediateHooks()));
    const medium = parseGlb(await exportToGlb(requestWith({ detail: 'medium' }), immediateHooks()));
    const low = parseGlb(await exportToGlb(requestWith({ detail: 'low' }), immediateHooks()));

    const attributeNames = (parsed: ParsedGlb): Set<string> =>
      new Set(
        parsed.json.meshes.flatMap((mesh) =>
          mesh.primitives.flatMap((primitive) => Object.keys(primitive.attributes)),
        ),
      );

    expect(attributeNames(high)).toEqual(new Set(['POSITION', 'NORMAL', 'TEXCOORD_0']));
    expect(attributeNames(medium)).toEqual(new Set(['POSITION', 'NORMAL']));
    expect(attributeNames(low)).toEqual(new Set(['POSITION']));

    const openingCount = (parsed: ParsedGlb): number =>
      partNodes(parsed.json).filter((node) => node.extras?.kind === 'opening').length;
    expect(openingCount(high)).toBeGreaterThan(0);
    expect(openingCount(low)).toBe(0);
  });

  it('welds vertices into indexed primitives and shrinks the file when compression is on', async () => {
    const compressed = await exportToGlb(requestWith({ compress: true }), immediateHooks());
    const raw = await exportToGlb(requestWith({ compress: false }), immediateHooks());

    expect(compressed.byteLength).toBeLessThan(raw.byteLength);

    const { json } = parseGlb(compressed);
    for (const mesh of json.meshes) {
      for (const primitive of mesh.primitives) {
        expect(primitive.indices).toBeDefined();
      }
    }

    const { json: rawJson } = parseGlb(raw);
    for (const mesh of rawJson.meshes) {
      for (const primitive of mesh.primitives) {
        expect(primitive.indices).toBeUndefined();
      }
    }
  });

  it('reports progress phase by phase with counters that end at their totals', async () => {
    const seen: ExportProgress[] = [];
    await exportToGlb(requestWith(), immediateHooks((progress) => seen.push(progress)));

    const phases = [...new Set(seen.map((progress) => progress.phase))];
    expect(phases).toEqual(['build', 'encode']);

    for (const phase of phases) {
      const ofPhase = seen.filter((progress) => progress.phase === phase);
      const first = ofPhase[0];
      const last = ofPhase[ofPhase.length - 1];
      expect(first?.completed).toBe(0);
      expect(last?.completed).toBe(last?.total);
      expect(last?.total).toBeGreaterThan(0);
      for (let index = 1; index < ofPhase.length; index += 1) {
        expect(ofPhase[index]?.completed).toBeGreaterThanOrEqual(ofPhase[index - 1]?.completed ?? 0);
      }
    }
  });

  it('throws cancelled at the first checkpoint once shouldCancel turns true', async () => {
    await expect(
      exportToGlb(requestWith(), {
        onProgress: () => undefined,
        shouldCancel: () => true,
        yieldToQueue: () => Promise.resolve(),
      }),
    ).rejects.toThrow(EXPORT_CANCELLED_MESSAGE);
  });

  it('stops part-way through the build once a later checkpoint sees the cancel', async () => {
    let checkpoints = 0;
    const seen: ExportProgress[] = [];

    await expect(
      exportToGlb(requestWith(), {
        onProgress: (progress) => seen.push(progress),
        shouldCancel: () => {
          checkpoints += 1;
          return checkpoints > 10;
        },
        yieldToQueue: () => Promise.resolve(),
      }),
    ).rejects.toThrow(EXPORT_CANCELLED_MESSAGE);

    const lastBuild = seen.filter((progress) => progress.phase === 'build').pop();
    expect(lastBuild).toBeDefined();
    expect(lastBuild?.completed).toBeLessThan(lastBuild?.total ?? 0);
  });

  it('rejects an export with no floors at all', async () => {
    await expect(
      exportToGlb({ ...requestWith(), floors: [] }, immediateHooks()),
    ).rejects.toThrow(RangeError);
  });
});

/* -------------------------------------------------------------------------- */
/* exportGlb: the main thread host.                                            */
/* -------------------------------------------------------------------------- */

/**
 * A stand-in worker that runs the real export against the real message
 * protocol, minus the thread: `start` runs `exportToGlb`, `cancel` sets the
 * flag its checkpoints read, and every response goes through `onmessage`.
 */
class ExportWorkerHarness implements ExportWorkerLike {
  onmessage: ((event: MessageEvent<ExportResponseMessage>) => void) | null = null;
  terminated = false;
  private readonly cancelled = new Set<number>();

  postMessage(message: ExportRequestMessage): void {
    if (message.kind === 'cancel') {
      this.cancelled.add(message.ticket);
      return;
    }
    void this.run(message.ticket, message.request);
  }

  terminate(): void {
    this.terminated = true;
  }

  private emit(message: ExportResponseMessage): void {
    this.onmessage?.({ data: message } as MessageEvent<ExportResponseMessage>);
  }

  private async run(ticket: number, request: ExportGlbRequest): Promise<void> {
    try {
      const glb = await exportToGlb(request, {
        onProgress: (progress) => {
          this.emit({ kind: 'progress', ticket, ...progress });
        },
        shouldCancel: () => this.cancelled.has(ticket),
        yieldToQueue: () =>
          new Promise((resolve) => {
            setTimeout(resolve, 0);
          }),
      });
      this.emit({ kind: 'done', ticket, glb });
    } catch (cause) {
      if (cause instanceof Error && cause.message === EXPORT_CANCELLED_MESSAGE) {
        this.emit({ kind: 'cancelled', ticket });
      } else {
        this.emit({ kind: 'error', ticket, message: String(cause) });
      }
    }
  }
}

describe('exportGlb', () => {
  const exportMoment = new Date(2026, 7, 17, 14, 32, 5);

  it('resolves with a non-empty blob and the prescribed file name', async () => {
    const harness = new ExportWorkerHarness();
    const task = exportGlb(
      { projectName: PROJECT_NAME, projectVersion: PROJECT_VERSION, floors: sampleFloors() },
      { createWorker: () => harness, now: () => exportMoment },
    );

    const result = await task.result;
    expect(result.blob.size).toBeGreaterThan(0);
    expect(result.blob.type).toBe(GLB_MIME_TYPE);
    expect(result.byteLength).toBe(result.blob.size);
    expect(result.fileName).toBe('chung-cu-hoang-anh_T0-T3_2026-08-17_14-32-05.glb');
    expect(harness.terminated).toBe(true);
  });

  it('forwards progress from the worker to the caller', async () => {
    const harness = new ExportWorkerHarness();
    const onProgress = vi.fn<(progress: ExportProgress) => void>();
    const task = exportGlb(
      { projectName: PROJECT_NAME, projectVersion: PROJECT_VERSION, floors: sampleFloors() },
      { createWorker: () => harness, onProgress, now: () => exportMoment },
    );

    await task.result;
    expect(onProgress).toHaveBeenCalled();
    const phases = new Set(onProgress.mock.calls.map(([progress]) => progress.phase));
    expect(phases).toEqual(new Set(['build', 'encode']));
  });

  it('rejects with cancelled and closes the worker when cancel is called mid-flight', async () => {
    const harness = new ExportWorkerHarness();
    const task = exportGlb(
      { projectName: PROJECT_NAME, projectVersion: PROJECT_VERSION, floors: sampleFloors() },
      { createWorker: () => harness, now: () => exportMoment },
    );

    task.cancel();

    await expect(task.result).rejects.toThrow(EXPORT_CANCELLED_MESSAGE);
    expect(harness.terminated).toBe(true);
  });

  it('rejects an empty floor list without ever starting a worker', async () => {
    const createWorker = vi.fn<() => ExportWorkerLike>(() => new ExportWorkerHarness());
    const task = exportGlb(
      { projectName: PROJECT_NAME, projectVersion: PROJECT_VERSION, floors: [] },
      { createWorker, now: () => exportMoment },
    );

    await expect(task.result).rejects.toThrow(RangeError);
    expect(createWorker).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/* The file name helpers.                                                      */
/* -------------------------------------------------------------------------- */

describe('buildGlbFileName', () => {
  const exportMoment = new Date(2026, 7, 17, 14, 32, 5);

  it('strips diacritics, slugs the name and spans the floor range', () => {
    expect(buildGlbFileName('Chung cư Hoàng Anh — Quận 1', [0, 3, 1, 2], exportMoment)).toBe(
      'chung-cu-hoang-anh-quan-1_T0-T3_2026-08-17_14-32-05.glb',
    );
  });

  it('names a single floor without a range', () => {
    expect(buildGlbFileName('Nhà mẫu', [2], exportMoment)).toBe(
      'nha-mau_T2_2026-08-17_14-32-05.glb',
    );
  });

  it('turns the letter đ into d rather than dropping it', () => {
    expect(toFileSlug('Dự án Đông Đô')).toBe('du-an-dong-do');
    expect(stripDiacritics('đường Đà Nẵng')).toBe('duong Da Nang');
  });

  it('refuses to name an export with no floors', () => {
    expect(() => buildGlbFileName('Nhà mẫu', [], exportMoment)).toThrow(RangeError);
  });

  it('pads every timestamp field to two digits', () => {
    expect(formatExportTimestamp(new Date(2026, 0, 3, 4, 5, 6))).toBe('2026-01-03_04-05-06');
  });
});
