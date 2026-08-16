import {
  BoxGeometry,
  DataTexture,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  PCFShadowMap,
  PCFSoftShadowMap,
  Points,
  type Material,
} from 'three';
import { describe, expect, it, vi } from 'vitest';

import { millimetres } from '@/domain/units/types';
import type { PointMm } from '@/domain/units/compare';
import type { AttachedOpening } from '@/domain/openings/types';
import type { Wall } from '@/domain/walls/types';
import type { OpeningId, RoomId, WallId } from '@/domain/spatial/types';

import { readPartData } from '../../build/scene';
import {
  buildFloorMesh,
  type BuildFloorInput,
  type BuildableLevel,
  type BuildableRoom,
} from '../../build/floor';
import { collectMeshes, mergeByMaterial } from '../../build/merge';
import {
  checkBudget,
  detectDeviceProfile,
  isWithinBudget,
  measureScene,
  readRenderInfo,
  SCENE_BUDGET,
  tokenMaterialKey,
  type BudgetReading,
  type SceneReading,
} from '../budget';
import {
  coarserDetail,
  DEGRADE_FRAME_RATE,
  DEGRADE_WINDOW_MS,
  PerfMonitor,
  SAMPLE_INTERVAL_MS,
  shadowMapTypeFor,
  type DegradeAction,
  type PerfSample,
} from '../monitor';

/* -------------------------------------------------------------------------- */
/* Fixtures.                                                                   */
/* -------------------------------------------------------------------------- */

/** A unit box is twelve triangles, whichever mesh it is hung on. */
const TRIANGLES_PER_BOX = 12;

/** The draw-call count the verification case asks for: well over the cap of 150. */
const OVERSIZED_DRAW_CALLS = 1000;

/** Frames per second the fake render loop runs at when it is healthy. */
const FAST_FRAME_MS = 10;

/** Frames per second the fake render loop runs at when it is struggling: 20 fps. */
const SLOW_FRAME_MS = 50;

/** A clock a test drives by hand, so no sample depends on real time. */
interface FakeClock {
  ms: number;
}

function scene(meshCount: number): Group {
  const group = new Group();
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshStandardMaterial();

  for (let index = 0; index < meshCount; index += 1) {
    group.add(new Mesh(geometry, material));
  }

  return group;
}

function reading(overrides: Partial<SceneReading> = {}): SceneReading {
  return { drawCalls: 10, triangles: 1_000, materials: 4, graphicsMemoryMb: 20, ...overrides };
}

/** Push `count` frames through the monitor, `frameMs` apart. */
function runFrames(monitor: PerfMonitor, clock: FakeClock, count: number, frameMs: number): void {
  for (let index = 0; index < count; index += 1) {
    clock.ms += frameMs;
    monitor.frame();
  }
}

/** Frames needed to cover a span of time at a given frame length. */
function framesFor(durationMs: number, frameMs: number): number {
  return Math.round(durationMs / frameMs);
}

/* -------------------------------------------------------------------------- */
/* Fixtures: the standard sample plan, 48 / 21 / 34 / 14 / 4.                  */
/* -------------------------------------------------------------------------- */

const WALL_COUNT = 48;
const OPENING_COUNT = 34;
const ROOM_COUNT = 14;

/** Walls, opening panels, floor slabs and ceilings: what one storey draws. */
const STOREY_DRAW_CALLS = WALL_COUNT + OPENING_COUNT + 2 * ROOM_COUNT;

/** One material per part kind, the way a colour token is shared. */
const STOREY_MATERIALS = 4;

const LEVEL: BuildableLevel = {
  id: 'L-01',
  elevationMm: millimetres(0),
  heightMm: millimetres(3000),
};

function pointAt(x: number, y: number): PointMm {
  return { x: millimetres(x), y: millimetres(y) };
}

function twoDigits(value: number): string {
  return value < 10 ? `0${String(value)}` : String(value);
}

const WALLS: readonly Wall[] = Array.from({ length: WALL_COUNT }, (_unused, index): Wall => {
  const alongMm = Math.floor(index / 6) * 5000;
  const acrossMm = (index % 6) * 6000;

  return {
    id: `W-${twoDigits(index + 1)}` as WallId,
    kind: 'partition',
    centreline: { start: pointAt(alongMm, acrossMm), end: pointAt(alongMm + 4000, acrossMm) },
    thicknessMm: millimetres(200),
    baseElevationMm: millimetres(0),
    topElevationMm: millimetres(3000),
  };
});

const OPENINGS: readonly AttachedOpening[] = Array.from(
  { length: OPENING_COUNT },
  (_unused, index): AttachedOpening => ({
    id: `D-${twoDigits(index + 1)}` as OpeningId,
    kind: 'door',
    widthMm: millimetres(900),
    heightMm: millimetres(2100),
    sillHeightMm: millimetres(0),
    swing: 'left',
    wallId: `W-${twoDigits(index + 1)}` as WallId,
    relativePosition: 0.5,
  }),
);

const ROOMS: readonly BuildableRoom[] = Array.from(
  { length: ROOM_COUNT },
  (_unused, index): BuildableRoom => {
    const offsetMm = index * 6000;
    return {
      id: `R-${twoDigits(index + 1)}` as RoomId,
      outline: [
        pointAt(offsetMm, 0),
        pointAt(offsetMm + 5000, 0),
        pointAt(offsetMm + 5000, 4000),
        pointAt(offsetMm, 4000),
      ],
    };
  },
);

const STOREY: BuildFloorInput = { level: LEVEL, walls: WALLS, rooms: ROOMS, openings: OPENINGS };

/**
 * Give every part kind its own material, which is what a caller does.
 *
 * `buildFloorMesh` assigns none — colour is a token decision — and three hands an
 * unpainted mesh a fresh default material each, so an unpainted storey would
 * report a hundred and ten materials that no viewer ever creates.
 */
function paintByKind(root: Group): Group {
  const byKind = new Map<string, Material>();

  for (const mesh of collectMeshes(root)) {
    const kind = readPartData(mesh)?.kind ?? 'unknown';
    let material = byKind.get(kind);
    if (material === undefined) {
      material = new MeshStandardMaterial();
      material.name = kind;
      byKind.set(kind, material);
    }
    mesh.material = material;
  }

  return root;
}

/* -------------------------------------------------------------------------- */
/* The budget itself.                                                          */
/* -------------------------------------------------------------------------- */

describe('SCENE_BUDGET', () => {
  it('declares one scene budget: 150 draw calls, 900000 triangles, 40 materials, 350 MB', () => {
    expect(SCENE_BUDGET.maxDrawCalls).toBe(150);
    expect(SCENE_BUDGET.maxTriangles).toBe(900_000);
    expect(SCENE_BUDGET.maxMaterials).toBe(40);
    expect(SCENE_BUDGET.maxGraphicsMemoryMb).toBe(350);
  });

  it('declares the frame-rate floors: 45 on a desktop, 30 on a mobile device', () => {
    expect(SCENE_BUDGET.minFrameRate.desktop).toBe(45);
    expect(SCENE_BUDGET.minFrameRate.mobile).toBe(30);
  });

  it('cannot be raised at runtime', () => {
    expect(Object.isFrozen(SCENE_BUDGET)).toBe(true);
    expect(Object.isFrozen(SCENE_BUDGET.minFrameRate)).toBe(true);
  });

  it('is the only place the degrade threshold comes from', () => {
    expect(DEGRADE_FRAME_RATE).toBe(SCENE_BUDGET.minFrameRate.mobile);
  });
});

/* -------------------------------------------------------------------------- */
/* Measuring a scene.                                                          */
/* -------------------------------------------------------------------------- */

describe('measureScene', () => {
  it('counts one draw call per mesh and twelve triangles per box', () => {
    const measured = measureScene(scene(3));

    expect(measured.drawCalls).toBe(3);
    expect(measured.triangles).toBe(3 * TRIANGLES_PER_BOX);
    expect(measured.materials).toBe(1);
  });

  it('counts an instanced mesh as one draw call and every placement as triangles', () => {
    const group = new Group();
    const placements = 40;
    group.add(new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial(), placements));

    const measured = measureScene(group);

    expect(measured.drawCalls).toBe(1);
    expect(measured.triangles).toBe(placements * TRIANGLES_PER_BOX);
  });

  it('counts one draw call per geometry group when a mesh carries several materials', () => {
    const geometry = new BoxGeometry(1, 1, 1);
    const group = new Group();
    group.add(new Mesh(geometry, [new MeshStandardMaterial(), new MeshStandardMaterial()]));

    const measured = measureScene(group);

    expect(geometry.groups.length).toBeGreaterThan(1);
    expect(measured.drawCalls).toBe(geometry.groups.length);
    expect(measured.materials).toBe(2);
  });

  it('counts nothing for a hidden subtree', () => {
    const group = scene(4);
    const hidden = scene(6);
    hidden.visible = false;
    group.add(hidden);

    const measured = measureScene(group);

    expect(measured.drawCalls).toBe(4);
    expect(measured.triangles).toBe(4 * TRIANGLES_PER_BOX);
  });

  it('gives points and lines a draw call but no triangles', () => {
    const group = new Group();
    group.add(new Points(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()));

    const measured = measureScene(group);

    expect(measured.drawCalls).toBe(1);
    expect(measured.triangles).toBe(0);
  });

  it('counts materials by object identity unless it is told otherwise', () => {
    const group = new Group();
    group.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()));
    group.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()));

    expect(measureScene(group).materials).toBe(2);
    expect(measureScene(group, { materialKey: tokenMaterialKey }).materials).toBe(1);
  });

  it('keeps the textures of materials that a key groups together', () => {
    const texture = new DataTexture(new Uint8Array(4), 1, 1);
    texture.generateMipmaps = false;
    const first = new MeshStandardMaterial();
    const second = new MeshStandardMaterial();
    second.map = texture;

    const group = new Group();
    group.add(new Mesh(new BoxGeometry(1, 1, 1), first));
    group.add(new Mesh(new BoxGeometry(1, 1, 1), second));

    const plain = measureScene(group);
    const keyed = measureScene(group, { materialKey: tokenMaterialKey });

    expect(keyed.materials).toBe(1);
    expect(keyed.graphicsMemoryMb).toBe(plain.graphicsMemoryMb);
  });

  it('charges a shared geometry once, however many meshes borrow it', () => {
    const shared = measureScene(scene(2));
    const single = measureScene(scene(1));

    expect(shared.graphicsMemoryMb).toBeCloseTo(single.graphicsMemoryMb, 10);
    expect(single.graphicsMemoryMb).toBeGreaterThan(0);
  });

  it('charges two distinct geometries twice', () => {
    const group = new Group();
    group.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()));
    group.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()));

    const single = measureScene(scene(1));

    expect(measureScene(group).graphicsMemoryMb).toBeCloseTo(2 * single.graphicsMemoryMb, 10);
  });

  it('writes nothing to the scene it measures', () => {
    const group = scene(2);
    const before = JSON.stringify(group.toJSON());

    measureScene(group);

    expect(JSON.stringify(group.toJSON())).toBe(before);
  });
});

/* -------------------------------------------------------------------------- */
/* Checking a reading against the budget.                                      */
/* -------------------------------------------------------------------------- */

describe('checkBudget', () => {
  it('raises exactly one warning for a fake scene of 1000 draw calls', () => {
    const measured = measureScene(scene(OVERSIZED_DRAW_CALLS));
    const warnings = checkBudget(measured);

    expect(measured.drawCalls).toBe(OVERSIZED_DRAW_CALLS);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.metric).toBe('drawCalls');
    expect(warnings[0]?.measured).toBe(OVERSIZED_DRAW_CALLS);
    expect(warnings[0]?.limit).toBe(SCENE_BUDGET.maxDrawCalls);
    expect(warnings[0]?.message).toContain('1.000');
  });

  it('says nothing about a scene inside every limit', () => {
    expect(checkBudget(reading())).toHaveLength(0);
    expect(isWithinBudget(reading({ drawCalls: SCENE_BUDGET.maxDrawCalls }))).toBe(true);
  });

  it('treats a limit as reached, not breached', () => {
    expect(checkBudget(reading({ triangles: SCENE_BUDGET.maxTriangles }))).toHaveLength(0);
    expect(checkBudget(reading({ triangles: SCENE_BUDGET.maxTriangles + 1 }))).toHaveLength(1);
  });

  it('names every metric that went over, one warning each', () => {
    const warnings = checkBudget({
      drawCalls: 900,
      triangles: 2_000_000,
      materials: 90,
      graphicsMemoryMb: 512,
      frameRate: 12,
    });

    expect(warnings.map((warning) => warning.metric)).toEqual([
      'drawCalls',
      'triangles',
      'materials',
      'graphicsMemory',
      'frameRate',
    ]);
  });

  it('judges the frame rate against the floor of the machine it is given', () => {
    const slow: BudgetReading = { ...reading(), frameRate: 40 };

    expect(checkBudget(slow, 'desktop')).toHaveLength(1);
    expect(checkBudget(slow, 'mobile')).toHaveLength(0);
    expect(checkBudget({ ...reading(), frameRate: 20 }, 'mobile')).toHaveLength(1);
  });

  it('says nothing about a frame rate that was never measured', () => {
    expect(checkBudget(reading(), 'desktop')).toHaveLength(0);
  });

  it('reports a counter that came back unreadable rather than passing it', () => {
    expect(checkBudget(reading({ triangles: Number.NaN }))).toHaveLength(1);
    expect(checkBudget({ ...reading(), frameRate: Number.NaN })).toHaveLength(1);
  });

  it('writes the megabyte figure with a Vietnamese decimal comma', () => {
    const warnings = checkBudget(reading({ graphicsMemoryMb: 512.5 }));

    expect(warnings[0]?.metric).toBe('graphicsMemory');
    expect(warnings[0]?.message).toContain('512,5 MB');
  });
});

/* -------------------------------------------------------------------------- */
/* The standard sample storey against the budget.                              */
/* -------------------------------------------------------------------------- */

describe('the standard storey', () => {
  it('draws 48 walls, 34 openings and 14 rooms inside every limit', () => {
    const measured = measureScene(paintByKind(buildFloorMesh(STOREY)));

    expect(measured.drawCalls).toBe(STOREY_DRAW_CALLS);
    expect(measured.materials).toBe(STOREY_MATERIALS);
    expect(checkBudget(measured)).toHaveLength(0);
  });

  it('carries one of three default materials per mesh before it is painted', () => {
    const measured = measureScene(buildFloorMesh(STOREY));

    // Not a defect in the measurement: an unpainted storey really would cost this
    // many material switches. `buildFloorMesh` assigns no material and three's
    // constructors default it to a fresh `MeshBasicMaterial` on every mesh.
    expect(measured.materials).toBe(STOREY_DRAW_CALLS);
    expect(checkBudget(measured).map((warning) => warning.metric)).toEqual(['materials']);
  });

  it('reads as one material before it is painted when materials are keyed as tokens', () => {
    const measured = measureScene(buildFloorMesh(STOREY), { materialKey: tokenMaterialKey });

    expect(measured.materials).toBe(1);
    expect(checkBudget(measured)).toHaveLength(0);
  });

  it('counts one material per colour token once it is painted', () => {
    const painted = paintByKind(buildFloorMesh(STOREY));

    expect(measureScene(painted).materials).toBe(STOREY_MATERIALS);
    expect(measureScene(painted, { materialKey: tokenMaterialKey }).materials).toBe(
      STOREY_MATERIALS,
    );
  });

  it('counts the materials that mergeByMaterial groups by, and no others', () => {
    const painted = paintByKind(buildFloorMesh(STOREY));

    expect(measureScene(painted, { materialKey: tokenMaterialKey }).materials).toBe(
      mergeByMaterial(collectMeshes(painted)).batches.length,
    );
  });

  it('costs four draw calls once it is batched, and the same triangles', () => {
    const painted = paintByKind(buildFloorMesh(STOREY));
    const loose = measureScene(painted);

    const batched = new Group();
    for (const batch of mergeByMaterial(collectMeshes(painted)).batches) {
      batched.add(batch.mesh);
    }
    const merged = measureScene(batched);

    expect(merged.drawCalls).toBe(STOREY_MATERIALS);
    expect(merged.triangles).toBe(loose.triangles);
    expect(isWithinBudget(merged)).toBe(true);
  });
});

describe('readRenderInfo', () => {
  it('reads what the renderer really drew, and takes memory from the caller', () => {
    const measured = readRenderInfo(
      { render: { calls: 22, triangles: 48_000 }, programs: { length: 7 } },
      120,
    );

    expect(measured).toEqual({
      drawCalls: 22,
      triangles: 48_000,
      materials: 7,
      graphicsMemoryMb: 120,
    });
  });

  it('counts no materials when the renderer has compiled none', () => {
    expect(readRenderInfo({ render: { calls: 0, triangles: 0 }, programs: null }, 0).materials).toBe(
      0,
    );
  });
});

describe('detectDeviceProfile', () => {
  it('falls back to the stricter floor when the pointer is not coarse', () => {
    expect(detectDeviceProfile()).toBe('desktop');
  });
});

/* -------------------------------------------------------------------------- */
/* The monitor: sampling.                                                      */
/* -------------------------------------------------------------------------- */

describe('PerfMonitor sampling', () => {
  it('reads the scene once per 500 ms window, not once per frame', () => {
    const clock: FakeClock = { ms: 0 };
    const read = vi.fn(() => reading());
    const monitor = new PerfMonitor({ read, now: () => clock.ms });

    runFrames(monitor, clock, framesFor(SAMPLE_INTERVAL_MS, FAST_FRAME_MS), FAST_FRAME_MS);

    expect(read).toHaveBeenCalledTimes(1);
    expect(monitor.lastSample?.frames).toBe(framesFor(SAMPLE_INTERVAL_MS, FAST_FRAME_MS));
  });

  it('has no sample before the first window closes', () => {
    const clock: FakeClock = { ms: 0 };
    const monitor = new PerfMonitor({ read: () => reading(), now: () => clock.ms });

    runFrames(monitor, clock, 10, FAST_FRAME_MS);

    expect(monitor.lastSample).toBeNull();
  });

  it('reports the frame rate and the per-second throughput of the window', () => {
    const clock: FakeClock = { ms: 0 };
    const samples: PerfSample[] = [];
    const monitor = new PerfMonitor({
      read: () => reading({ drawCalls: 30, triangles: 20_000 }),
      now: () => clock.ms,
      onSample: (sample) => {
        samples.push(sample);
      },
    });

    runFrames(monitor, clock, framesFor(2 * SAMPLE_INTERVAL_MS, FAST_FRAME_MS), FAST_FRAME_MS);

    expect(samples).toHaveLength(2);
    const first = samples[0];
    expect(first?.durationMs).toBe(SAMPLE_INTERVAL_MS);
    expect(first?.frameRate).toBe(100);
    expect(first?.drawCallsPerSecond).toBe(30 * 100);
    expect(first?.trianglesPerSecond).toBe(20_000 * 100);
  });

  it('carries the budget warnings of the window on the sample', () => {
    const clock: FakeClock = { ms: 0 };
    const monitor = new PerfMonitor({
      read: () => reading({ drawCalls: OVERSIZED_DRAW_CALLS }),
      now: () => clock.ms,
    });

    runFrames(monitor, clock, framesFor(SAMPLE_INTERVAL_MS, FAST_FRAME_MS), FAST_FRAME_MS);

    expect(monitor.lastSample?.warnings.map((warning) => warning.metric)).toEqual(['drawCalls']);
  });
});

/* -------------------------------------------------------------------------- */
/* The monitor: warnings.                                                      */
/* -------------------------------------------------------------------------- */

describe('PerfMonitor warnings', () => {
  it('warns once for a scene that stays 1000 draw calls over budget', () => {
    const clock: FakeClock = { ms: 0 };
    const raised: string[] = [];
    const monitor = new PerfMonitor({
      read: () => reading({ drawCalls: OVERSIZED_DRAW_CALLS }),
      now: () => clock.ms,
      onWarning: (warnings) => {
        for (const warning of warnings) {
          raised.push(warning.metric);
        }
      },
    });

    runFrames(monitor, clock, framesFor(10 * SAMPLE_INTERVAL_MS, FAST_FRAME_MS), FAST_FRAME_MS);

    expect(monitor.lastSample?.drawCalls).toBe(OVERSIZED_DRAW_CALLS);
    expect(raised).toEqual(['drawCalls']);
  });

  it('warns again only after the metric has come back inside the budget', () => {
    const clock: FakeClock = { ms: 0 };
    const raised: string[] = [];
    let drawCalls = OVERSIZED_DRAW_CALLS;
    const monitor = new PerfMonitor({
      read: () => reading({ drawCalls }),
      now: () => clock.ms,
      onWarning: (warnings) => {
        for (const warning of warnings) {
          raised.push(warning.metric);
        }
      },
    });

    const windowFrames = framesFor(SAMPLE_INTERVAL_MS, FAST_FRAME_MS);
    runFrames(monitor, clock, 2 * windowFrames, FAST_FRAME_MS);
    drawCalls = 10;
    runFrames(monitor, clock, 2 * windowFrames, FAST_FRAME_MS);
    drawCalls = OVERSIZED_DRAW_CALLS;
    runFrames(monitor, clock, 2 * windowFrames, FAST_FRAME_MS);

    expect(raised).toEqual(['drawCalls', 'drawCalls']);
  });

  it('says nothing about a scene that stays inside the budget', () => {
    const clock: FakeClock = { ms: 0 };
    const onWarning = vi.fn();
    const monitor = new PerfMonitor({ read: () => reading(), now: () => clock.ms, onWarning });

    runFrames(monitor, clock, framesFor(4 * SAMPLE_INTERVAL_MS, FAST_FRAME_MS), FAST_FRAME_MS);

    expect(onWarning).not.toHaveBeenCalled();
    expect(monitor.lastSample?.warnings).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* The monitor: degrading.                                                     */
/* -------------------------------------------------------------------------- */

describe('PerfMonitor degrading', () => {
  it('degrades exactly once after three seconds under 30 frames a second', () => {
    const clock: FakeClock = { ms: 0 };
    const actions: DegradeAction[] = [];
    const monitor = new PerfMonitor({
      read: () => reading(),
      now: () => clock.ms,
      onDegrade: (action) => {
        actions.push(action);
      },
    });

    // Twenty frames a second for six seconds: twice as long as it takes to trip.
    runFrames(monitor, clock, framesFor(2 * DEGRADE_WINDOW_MS, SLOW_FRAME_MS), SLOW_FRAME_MS);

    expect(actions).toHaveLength(1);
    expect(actions[0]?.detail).toBe('reduced');
    expect(actions[0]?.shadows).toBe('hard');
    expect(actions[0]?.belowMs).toBe(DEGRADE_WINDOW_MS);
    expect(monitor.isDegraded).toBe(true);
    expect(monitor.detail).toBe('reduced');
    expect(monitor.shadows).toBe('hard');
  });

  it('waits the full three seconds before degrading', () => {
    const clock: FakeClock = { ms: 0 };
    const onDegrade = vi.fn();
    const monitor = new PerfMonitor({ read: () => reading(), now: () => clock.ms, onDegrade });

    runFrames(monitor, clock, framesFor(DEGRADE_WINDOW_MS - SAMPLE_INTERVAL_MS, SLOW_FRAME_MS), SLOW_FRAME_MS);
    expect(onDegrade).not.toHaveBeenCalled();

    runFrames(monitor, clock, framesFor(SAMPLE_INTERVAL_MS, SLOW_FRAME_MS), SLOW_FRAME_MS);
    expect(onDegrade).toHaveBeenCalledTimes(1);
  });

  it('does not degrade when the frame rate recovers inside the three seconds', () => {
    const clock: FakeClock = { ms: 0 };
    const onDegrade = vi.fn();
    const monitor = new PerfMonitor({ read: () => reading(), now: () => clock.ms, onDegrade });

    runFrames(monitor, clock, framesFor(2_000, SLOW_FRAME_MS), SLOW_FRAME_MS);
    runFrames(monitor, clock, framesFor(4_000, FAST_FRAME_MS), FAST_FRAME_MS);

    expect(onDegrade).not.toHaveBeenCalled();
    expect(monitor.isDegraded).toBe(false);
    expect(monitor.detail).toBe('full');
    expect(monitor.shadows).toBe('soft');
  });

  it('starts the three seconds again after a recovery', () => {
    const clock: FakeClock = { ms: 0 };
    const onDegrade = vi.fn();
    const monitor = new PerfMonitor({ read: () => reading(), now: () => clock.ms, onDegrade });

    runFrames(monitor, clock, framesFor(2_000, SLOW_FRAME_MS), SLOW_FRAME_MS);
    runFrames(monitor, clock, framesFor(SAMPLE_INTERVAL_MS, FAST_FRAME_MS), FAST_FRAME_MS);
    runFrames(monitor, clock, framesFor(2_500, SLOW_FRAME_MS), SLOW_FRAME_MS);
    expect(onDegrade).not.toHaveBeenCalled();

    runFrames(monitor, clock, framesFor(SAMPLE_INTERVAL_MS, SLOW_FRAME_MS), SLOW_FRAME_MS);
    expect(onDegrade).toHaveBeenCalledTimes(1);
  });

  it('degrades on the sample that ends a single long stall', () => {
    const clock: FakeClock = { ms: 0 };
    const onDegrade = vi.fn();
    const monitor = new PerfMonitor({ read: () => reading(), now: () => clock.ms, onDegrade });

    clock.ms += 5_000;
    monitor.frame();

    expect(onDegrade).toHaveBeenCalledTimes(1);
    expect(monitor.lastSample?.durationMs).toBe(5_000);
  });

  it('drops from the rung it was told the scene is on', () => {
    const clock: FakeClock = { ms: 0 };
    const actions: DegradeAction[] = [];
    const monitor = new PerfMonitor({
      read: () => reading(),
      now: () => clock.ms,
      detail: 'reduced',
      onDegrade: (action) => {
        actions.push(action);
      },
    });

    runFrames(monitor, clock, framesFor(DEGRADE_WINDOW_MS, SLOW_FRAME_MS), SLOW_FRAME_MS);

    expect(actions[0]?.detail).toBe('block');
  });

  it('has nothing left to drop below the cheapest rung', () => {
    const clock: FakeClock = { ms: 0 };
    const actions: DegradeAction[] = [];
    const monitor = new PerfMonitor({
      read: () => reading(),
      now: () => clock.ms,
      detail: 'block',
      onDegrade: (action) => {
        actions.push(action);
      },
    });

    runFrames(monitor, clock, framesFor(DEGRADE_WINDOW_MS, SLOW_FRAME_MS), SLOW_FRAME_MS);

    expect(actions).toHaveLength(1);
    expect(actions[0]?.detail).toBe('block');
    expect(actions[0]?.shadows).toBe('hard');
  });

  it('explains itself in the review log', () => {
    const clock: FakeClock = { ms: 0 };
    const actions: DegradeAction[] = [];
    const monitor = new PerfMonitor({
      read: () => reading(),
      now: () => clock.ms,
      onDegrade: (action) => {
        actions.push(action);
      },
    });

    runFrames(monitor, clock, framesFor(DEGRADE_WINDOW_MS, SLOW_FRAME_MS), SLOW_FRAME_MS);

    expect(actions[0]?.message).toContain('20');
    expect(actions[0]?.message).toContain('30');
    expect(actions[0]?.message).toContain('reduced');
  });

  it('goes back to full detail and soft shadows when it is reset', () => {
    const clock: FakeClock = { ms: 0 };
    const monitor = new PerfMonitor({ read: () => reading(), now: () => clock.ms });

    runFrames(monitor, clock, framesFor(DEGRADE_WINDOW_MS, SLOW_FRAME_MS), SLOW_FRAME_MS);
    expect(monitor.isDegraded).toBe(true);

    monitor.reset();

    expect(monitor.isDegraded).toBe(false);
    expect(monitor.detail).toBe('full');
    expect(monitor.shadows).toBe('soft');
    expect(monitor.lastSample).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* What a degrade means to the renderer.                                       */
/* -------------------------------------------------------------------------- */

describe('shadowMapTypeFor', () => {
  it('turns soft shadows into the cheap filter rather than into no shadows', () => {
    expect(shadowMapTypeFor('soft')).toBe(PCFSoftShadowMap);
    expect(shadowMapTypeFor('hard')).toBe(PCFShadowMap);
  });
});

describe('coarserDetail', () => {
  it('steps one rung down and stops at the cheapest', () => {
    expect(coarserDetail('full')).toBe('reduced');
    expect(coarserDetail('reduced')).toBe('block');
    expect(coarserDetail('block')).toBe('block');
  });
});
