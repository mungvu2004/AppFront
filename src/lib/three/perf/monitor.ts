/**
 * The meter, and the thing it does when the numbers go bad.
 *
 * `budget.ts` says what a scene may cost and can read what one does cost. This
 * file watches those readings over time: how many frames actually arrived, how
 * many draw calls and triangles each of them carried, and — when the answer stays
 * bad long enough to be a fact rather than a hiccup — it drops the scene to a
 * cheaper drawing rather than leaving a person to drag a wall at eleven frames a
 * second.
 *
 * **A meter that costs a frame has measured nothing.** That constraint decides the
 * whole shape of this class:
 *
 * - Nothing is scheduled. There is no `setInterval` and no `requestAnimationFrame`
 *   of its own, because a timer that fires between two frames competes with the
 *   renderer for the one thread they share, and the frame it delays is a frame it
 *   then reports as slow. The caller already has a render loop; {@link
 *   PerfMonitor.frame} hangs off it.
 * - The per-frame path is a counter increment and one clock read. No object is
 *   allocated, no scene is walked, no list is built — at 120 Hz this is a few
 *   nanoseconds and it never reaches the garbage collector.
 * - Everything expensive happens at a window boundary, **every 500 ms**: the scene
 *   is read once, the budget is checked once, one sample object is allocated. Two
 *   of those a second is a cost that does not show up in the number being
 *   measured.
 *
 * **Warnings are edge-triggered.** A scene that is 900 draw calls over budget is
 * over budget on every sample, and a monitor that said so twice a second would
 * produce a log nobody reads. A metric is reported the moment it goes over and
 * then stays quiet until it comes back inside and goes over again. So a scene that
 * is built wrong produces one warning per thing that is wrong, which is a number a
 * reviewer can act on.
 *
 * **Degrading is once, and it is deliberate.** Below 30 frames a second — the
 * mobile floor from {@link SCENE_BUDGET}, and the point at which dragging stops
 * feeling attached to the pointer — sustained for three full seconds, the monitor
 * drops one LOD rung and turns soft shadows off. Three seconds because a single
 * stalled frame is not a slow scene: a texture upload, a garbage collection or a
 * worker result landing will each cost one frame, and a monitor that halved the
 * detail every time one did would flicker between rungs for the whole session.
 * Once, because the second drop would be a decision made on numbers measured
 * before the first drop took effect.
 *
 * What it does *not* do is apply the change. {@link DegradeAction} says which rung
 * to draw and that soft shadows are off; switching `LOD.levels` and
 * `renderer.shadowMap.type` belongs to whoever owns the renderer, and a pure
 * module that reached into one could not be tested without a WebGL context.
 */

import { PCFShadowMap, PCFSoftShadowMap, type ShadowMapType } from 'three';

import { formatNumber } from '@/lib/format/number';

import { DETAIL_LEVELS, type DetailLevel } from '../build/lod';
import {
  checkBudget,
  SCENE_BUDGET,
  type BudgetMetric,
  type BudgetWarning,
  type DeviceProfile,
  type SceneReading,
} from './budget';

/* -------------------------------------------------------------------------- */
/* Constants.                                                                  */
/* -------------------------------------------------------------------------- */

/** How often a window is closed and the scene is read. */
export const SAMPLE_INTERVAL_MS = 500;

/** How long the frame rate must stay low before the scene is degraded. */
export const DEGRADE_WINDOW_MS = 3_000;

/**
 * The frame rate a scene has to fall under to be degraded.
 *
 * Read from the budget rather than written again, so the two cannot disagree: the
 * point at which the product calls itself broken on a phone is the point at which
 * it starts drawing less.
 */
export const DEGRADE_FRAME_RATE = SCENE_BUDGET.minFrameRate.mobile;

const MS_PER_SECOND = 1_000;

/* -------------------------------------------------------------------------- */
/* Public types.                                                               */
/* -------------------------------------------------------------------------- */

/** Whether shadows are filtered softly, or cheaply. */
export type ShadowQuality = 'soft' | 'hard';

/**
 * The three.js shadow map that draws a given quality.
 *
 * Turning soft shadows off means the cheaper filter, not no shadows at all: a
 * plan with its shadows removed reads as a flat drawing and stops showing which
 * wall stands in front of which, which is a worse loss than a hard edge.
 */
export function shadowMapTypeFor(quality: ShadowQuality): ShadowMapType {
  return quality === 'soft' ? PCFSoftShadowMap : PCFShadowMap;
}

/** The next rung down, or the same rung when there is nothing cheaper. */
export function coarserDetail(detail: DetailLevel): DetailLevel {
  const index = DETAIL_LEVELS.indexOf(detail);
  const next = DETAIL_LEVELS[Math.min(index + 1, DETAIL_LEVELS.length - 1)];
  return next ?? detail;
}

/** One 500 ms window, closed and measured. */
export interface PerfSample {
  /** The clock reading the window closed at. */
  readonly atMs: number;
  /** How long the window really was; 500 ms unless a frame stalled. */
  readonly durationMs: number;
  /** Frames that arrived in the window. */
  readonly frames: number;
  /** Frames per second over the window. */
  readonly frameRate: number;
  /** Draw calls for one frame. */
  readonly drawCalls: number;
  /** Triangles for one frame. */
  readonly triangles: number;
  readonly materials: number;
  readonly graphicsMemoryMb: number;
  /** Draw calls per second: what the frame cost, times how often it was paid. */
  readonly drawCallsPerSecond: number;
  /** Triangles per second, the throughput the card is actually being asked for. */
  readonly trianglesPerSecond: number;
  /** Every budget breach in this sample; empty when the scene is inside it. */
  readonly warnings: readonly BudgetWarning[];
}

/** What to draw instead, once the frame rate has proved it cannot afford more. */
export interface DegradeAction {
  /** The rung to drop to — one cheaper than the one in use. */
  readonly detail: DetailLevel;
  /** Always `hard`: soft shadows are the first thing switched off. */
  readonly shadows: ShadowQuality;
  /** The frame rate on the sample that tripped it. */
  readonly frameRate: number;
  /** How long the frame rate had been under the threshold. */
  readonly belowMs: number;
  /** Vietnamese sentence for the review log. */
  readonly message: string;
}

export interface PerfMonitorOptions {
  /**
   * How a scene reading is taken. Called once per window, never per frame.
   *
   * `measureScene(scene)` for a scene walk, or `readRenderInfo(renderer.info, mb)`
   * for what the renderer really drew.
   */
  readonly read: () => SceneReading;
  /** The clock. Defaults to `performance.now`; a test passes its own. */
  readonly now?: () => number;
  /** Which frame-rate floor the warnings are judged against. */
  readonly profile?: DeviceProfile;
  /** How long a window is. Defaults to {@link SAMPLE_INTERVAL_MS}. */
  readonly sampleIntervalMs?: number;
  /** How long the frame rate must stay low. Defaults to {@link DEGRADE_WINDOW_MS}. */
  readonly degradeWindowMs?: number;
  /** The rung the scene is being drawn at when the monitor starts. */
  readonly detail?: DetailLevel;
  /** Every closed window, in order. */
  readonly onSample?: (sample: PerfSample) => void;
  /** Metrics that have just gone over budget — never the ones already reported. */
  readonly onWarning?: (warnings: readonly BudgetWarning[], sample: PerfSample) => void;
  /** Fired at most once: the scene should now be drawn more cheaply. */
  readonly onDegrade?: (action: DegradeAction) => void;
}

/* -------------------------------------------------------------------------- */
/* Internals.                                                                  */
/* -------------------------------------------------------------------------- */

function defaultNow(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function degradeMessage(frameRate: number, belowMs: number, detail: DetailLevel): string {
  return (
    `Khung hình ${formatNumber(frameRate, { maxFractionDigits: 1 })} dưới ngưỡng ` +
    `${formatNumber(DEGRADE_FRAME_RATE)} suốt ` +
    `${formatNumber(belowMs / MS_PER_SECOND, { maxFractionDigits: 1 })} giây: ` +
    `hạ mức chi tiết xuống ${detail} và tắt bóng đổ mềm.`
  );
}

/* -------------------------------------------------------------------------- */
/* The monitor.                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Counts frames, samples the scene twice a second, and degrades it once when the
 * frame rate stays under 30 for three seconds.
 *
 * Drive it from the render loop:
 *
 * ```ts
 * const monitor = new PerfMonitor({ read: () => measureScene(scene) });
 * renderer.setAnimationLoop(() => {
 *   renderer.render(scene, camera);
 *   monitor.frame();
 * });
 * ```
 *
 * It owns no timers and no subscriptions, so there is nothing to tear down: an
 * instance that stops being called simply stops sampling.
 */
export class PerfMonitor {
  private readonly read: () => SceneReading;
  private readonly now: () => number;
  private readonly profile: DeviceProfile;
  private readonly sampleIntervalMs: number;
  private readonly degradeWindowMs: number;
  private readonly initialDetail: DetailLevel;
  private readonly onSample: ((sample: PerfSample) => void) | null;
  private readonly onWarning:
    | ((warnings: readonly BudgetWarning[], sample: PerfSample) => void)
    | null;
  private readonly onDegrade: ((action: DegradeAction) => void) | null;

  /** Metrics already reported, so a standing breach is not repeated. */
  private readonly reported = new Set<BudgetMetric>();

  private windowStartMs: number;
  private frames = 0;
  private latest: PerfSample | null = null;
  /** When the current run of low samples began, or `null` when there is none. */
  private lowSinceMs: number | null = null;
  private applied: DegradeAction | null = null;
  private detailLevel: DetailLevel;
  private shadowQuality: ShadowQuality = 'soft';

  constructor(options: PerfMonitorOptions) {
    this.read = options.read;
    this.now = options.now ?? defaultNow;
    this.profile = options.profile ?? 'desktop';
    this.sampleIntervalMs = options.sampleIntervalMs ?? SAMPLE_INTERVAL_MS;
    this.degradeWindowMs = options.degradeWindowMs ?? DEGRADE_WINDOW_MS;
    this.initialDetail = options.detail ?? 'full';
    this.onSample = options.onSample ?? null;
    this.onWarning = options.onWarning ?? null;
    this.onDegrade = options.onDegrade ?? null;

    this.detailLevel = this.initialDetail;
    this.windowStartMs = this.now();
  }

  /** The last closed window, or `null` before the first 500 ms have passed. */
  get lastSample(): PerfSample | null {
    return this.latest;
  }

  /** The rung the scene should be drawn at now. */
  get detail(): DetailLevel {
    return this.detailLevel;
  }

  /** The shadow filter the scene should use now. */
  get shadows(): ShadowQuality {
    return this.shadowQuality;
  }

  /** Has the scene been dropped to a cheaper drawing? */
  get isDegraded(): boolean {
    return this.applied !== null;
  }

  /** The degrade that was applied, or `null` while none has been. */
  get degradeAction(): DegradeAction | null {
    return this.applied;
  }

  /**
   * Count one rendered frame. Call it once per frame, after the render.
   *
   * A counter increment and a clock read; the window is closed on the frame that
   * crosses the boundary, so the sampling cost lands on one frame in thirty rather
   * than being spread over all of them.
   */
  frame(): void {
    this.frames += 1;
    const nowMs = this.now();
    if (nowMs - this.windowStartMs >= this.sampleIntervalMs) {
      this.closeWindow(nowMs);
    }
  }

  /**
   * Forget everything measured and start again at full detail.
   *
   * For a project change or a scene rebuild, where the readings from the old scene
   * say nothing about the new one — and where a degrade applied to a heavy plan
   * should not survive into a light one.
   */
  reset(): void {
    this.frames = 0;
    this.windowStartMs = this.now();
    this.latest = null;
    this.lowSinceMs = null;
    this.applied = null;
    this.detailLevel = this.initialDetail;
    this.shadowQuality = 'soft';
    this.reported.clear();
  }

  /** Close the window that ends at `nowMs`: read, check, report, decide. */
  private closeWindow(nowMs: number): void {
    const startMs = this.windowStartMs;
    const durationMs = nowMs - startMs;
    const frames = this.frames;

    this.windowStartMs = nowMs;
    this.frames = 0;

    const reading = this.read();
    // A window of no length has no rate. It cannot happen on a monotonic clock
    // — the boundary is a `>=` on a positive interval — but reporting `Infinity`
    // as a frame rate would be worse than reporting nothing.
    const frameRate = durationMs > 0 ? (frames * MS_PER_SECOND) / durationMs : 0;

    const sample: PerfSample = {
      atMs: nowMs,
      durationMs,
      frames,
      frameRate,
      drawCalls: reading.drawCalls,
      triangles: reading.triangles,
      materials: reading.materials,
      graphicsMemoryMb: reading.graphicsMemoryMb,
      drawCallsPerSecond: reading.drawCalls * frameRate,
      trianglesPerSecond: reading.triangles * frameRate,
      warnings: checkBudget({ ...reading, frameRate }, this.profile),
    };

    this.latest = sample;
    this.onSample?.(sample);
    this.report(sample);
    this.considerDegrade(sample, startMs, nowMs);
  }

  /** Report the metrics that have just gone over, and forget the ones that recovered. */
  private report(sample: PerfSample): void {
    const current = new Set<BudgetMetric>(sample.warnings.map((warning) => warning.metric));

    for (const metric of [...this.reported]) {
      if (!current.has(metric)) {
        this.reported.delete(metric);
      }
    }

    const fresh = sample.warnings.filter((warning) => !this.reported.has(warning.metric));
    if (fresh.length === 0) {
      return;
    }

    for (const warning of fresh) {
      this.reported.add(warning.metric);
    }
    this.onWarning?.(fresh, sample);
  }

  /**
   * Decide whether three seconds of low frames have now passed.
   *
   * The run is dated from the *start* of the first low window rather than its end,
   * so six 500 ms windows are three seconds and not three and a half. One long
   * stall closes one long window and is judged on its real length, which is why a
   * five-second freeze degrades on the sample that ends it.
   */
  private considerDegrade(sample: PerfSample, startMs: number, nowMs: number): void {
    if (sample.frameRate >= DEGRADE_FRAME_RATE) {
      this.lowSinceMs = null;
      return;
    }

    if (this.lowSinceMs === null) {
      this.lowSinceMs = startMs;
    }

    if (this.applied !== null) {
      return;
    }

    const belowMs = nowMs - this.lowSinceMs;
    if (belowMs < this.degradeWindowMs) {
      return;
    }

    const detail = coarserDetail(this.detailLevel);
    const action: DegradeAction = {
      detail,
      shadows: 'hard',
      frameRate: sample.frameRate,
      belowMs,
      message: degradeMessage(sample.frameRate, belowMs, detail),
    };

    this.detailLevel = detail;
    this.shadowQuality = 'hard';
    this.applied = action;
    this.onDegrade?.(action);
  }
}
