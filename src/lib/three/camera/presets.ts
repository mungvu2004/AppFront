/**
 * Six standard views on a number key, and the eased move that gets you there.
 *
 * An engineer checking a plan does not want to fly the camera. They want the
 * front elevation, then the top, then back to where they were, and they want the
 * selected wall filling the screen — each in one keystroke. This module is that:
 * six named viewpoints bound to `1`–`6`, a 340 ms move between any two, and a
 * frame-the-selection command that reuses the geometry in `frameObjects.ts`.
 *
 * ## Where the numbers live
 *
 * `modes.ts` reads every parameter from `CAMERA_SETTINGS`, and this file keeps
 * the same discipline in {@link PRESET_SETTINGS} — its sibling, not a second
 * opinion. The two are separate files only because `settings.ts` was closed to
 * this change; everything in `PRESET_SETTINGS` that has an equivalent over there
 * is *derived* from it rather than restated, so the elevation angle cannot drift
 * away from the orbit limit that enforces it.
 *
 * ## The move
 *
 * 340 ms, which is one of the five durations this repository allows, on an
 * ease-in-out cubic — it leaves and arrives at rest, which is what makes a camera
 * move read as a move rather than as a cut. Three things are interpolated, and
 * one of them is not a straight line: **distance is geometric**, so going from
 * 5 m out to 80 m spends as long crossing the first doubling as the last. Linear
 * distance would spend nine tenths of the move already far away, which looks like
 * a jump followed by a wait. The heading takes the short way round, so a move
 * from 350° to 10° turns twenty degrees rather than three hundred and forty.
 *
 * **Reduced motion makes it a cut.** With `reducedMotion` the duration is zero
 * and the transition is finished before it is returned, so the camera is at its
 * destination on the same tick the key was pressed — no frame of animation at
 * all, rather than a fast one.
 *
 * **Any input cancels it.** {@link CameraDirector.interrupt} stops the move where
 * it has got to and hands the camera straight back, with no settling and no
 * snap-back to either end. A caller wires it to pointer-down and to the keys that
 * drive the camera; a reviewer who grabs the model halfway through a flight keeps
 * exactly the view they grabbed.
 *
 * ## Which camera flies
 *
 * A move is flown with the perspective camera, whatever it is going to. Only a
 * move that starts *and* ends in the plan view stays orthographic — because an
 * orthographic camera has no angle to animate, and switching to it at the start
 * of a move would throw the whole rotation away and leave nothing on screen but a
 * change of scale. The destination mode takes over on the last frame.
 */

import type { Object3D } from 'three';

import { degrees, degreesToRadians, RADIANS_PER_TURN } from '@/domain/units/types';
import { MOTION_DURATIONS_MS } from '@/lib/motion';

import { CAMERA_SETTINGS } from './settings';
import {
  createCameraMode,
  type CameraMode,
  type CameraModeContext,
  type CameraModeController,
  type CameraPose,
  type Viewpoint,
} from './modes';
import {
  boxOfExtent,
  frameObjects as frameObjectsViewpoint,
  frameViewpoint,
} from './frameObjects';

/* -------------------------------------------------------------------------- */
/* Settings — the sibling of CAMERA_SETTINGS.                                  */
/* -------------------------------------------------------------------------- */

/** Every parameter of the presets, the move, and the framing. */
export interface PresetSettings {
  /** How long a move takes. Read from the motion table, never written here. */
  readonly transitionMs: number;
  /** How much of the viewport is left empty around a framed object. */
  readonly framePaddingFraction: number;
  /** How far clear of a solid the camera is parked, in metres. */
  readonly clearanceMarginM: number;
  /**
   * The vertical angle of the four elevations, in degrees from vertical.
   *
   * Dead level, read from the elevation mode rather than written again — which is
   * the whole reason that mode exists. The orbit camera stops 5° short of level
   * and is perspective, so an elevation taken with it is both tilted and
   * foreshortened, and a facade measured off it does not match the drawing.
   */
  readonly elevationPolarDeg: number;
  /** Heading the plan view is read at. Zero: the same way up as the front elevation. */
  readonly topAzimuthDeg: number;
  /** The viewport shape assumed when a caller has not said. */
  readonly defaultAspect: number;
}

export const PRESET_SETTINGS: PresetSettings = Object.freeze({
  transitionMs: MOTION_DURATIONS_MS.slow,
  framePaddingFraction: 0.15,
  clearanceMarginM: 0.5,
  elevationPolarDeg: CAMERA_SETTINGS.elevation.polarDeg,
  topAzimuthDeg: 0,
  defaultAspect: 16 / 9,
});

/* -------------------------------------------------------------------------- */
/* The six views.                                                              */
/* -------------------------------------------------------------------------- */

/** Which of the six standard views. */
export type CameraPresetId = 'top' | 'front' | 'back' | 'left' | 'right' | 'perspective';

/**
 * One standard view.
 *
 * The face names are scene-frame: **front** looks at the side of the building
 * facing +z, which is plan +y — the bottom edge of the drawing as it is read.
 * Back, right and left are the quarter turns from there.
 */
export interface CameraPreset {
  readonly id: CameraPresetId;
  /** `KeyboardEvent.code` values that select it — the digit row and the numpad. */
  readonly keys: readonly string[];
  /** The mode this view belongs in: the plan is orthographic, the rest are not. */
  readonly mode: CameraMode;
  readonly azimuthDeg: number;
  readonly polarDeg: number;
}

const ELEVATION_POLAR_DEG = PRESET_SETTINGS.elevationPolarDeg;

/**
 * Freeze one view.
 *
 * The parameter is typed, so each literal below is checked against
 * {@link CameraPreset} where it is written rather than widened to `string` by
 * `Object.freeze` and then failing somewhere less useful.
 */
function definePreset(preset: CameraPreset): CameraPreset {
  return Object.freeze({ ...preset, keys: Object.freeze([...preset.keys]) });
}

/** The six views, in key order. */
export const CAMERA_PRESETS: readonly CameraPreset[] = Object.freeze([
  definePreset({
    id: 'top',
    keys: ['Digit1', 'Numpad1'],
    mode: 'top',
    azimuthDeg: PRESET_SETTINGS.topAzimuthDeg,
    polarDeg: CAMERA_SETTINGS.top.polarDeg,
  }),
  definePreset({
    id: 'front',
    keys: ['Digit2', 'Numpad2'],
    mode: 'elevation',
    azimuthDeg: 0,
    polarDeg: ELEVATION_POLAR_DEG,
  }),
  definePreset({
    id: 'back',
    keys: ['Digit3', 'Numpad3'],
    mode: 'elevation',
    azimuthDeg: 180,
    polarDeg: ELEVATION_POLAR_DEG,
  }),
  definePreset({
    id: 'left',
    keys: ['Digit4', 'Numpad4'],
    mode: 'elevation',
    azimuthDeg: 270,
    polarDeg: ELEVATION_POLAR_DEG,
  }),
  definePreset({
    id: 'right',
    keys: ['Digit5', 'Numpad5'],
    mode: 'elevation',
    azimuthDeg: 90,
    polarDeg: ELEVATION_POLAR_DEG,
  }),
  definePreset({
    id: 'perspective',
    keys: ['Digit6', 'Numpad6'],
    mode: 'orbit',
    azimuthDeg: CAMERA_SETTINGS.orbit.initialAzimuthDeg,
    polarDeg: CAMERA_SETTINGS.orbit.initialPolarDeg,
  }),
]);

const BY_ID = new Map<CameraPresetId, CameraPreset>(
  CAMERA_PRESETS.map((preset) => [preset.id, preset]),
);

const BY_KEY = new Map<string, CameraPreset>(
  CAMERA_PRESETS.flatMap((preset) =>
    preset.keys.map((key): [string, CameraPreset] => [key, preset]),
  ),
);

/** The preset a key selects, or `null` when the key is not one of the six. */
export function presetForKey(code: string): CameraPreset | null {
  return BY_KEY.get(code) ?? null;
}

/**
 * The preset with this id.
 *
 * @throws RangeError when there is no such preset — an id that is not one of the
 * six is a programming mistake, and flying to a default would hide it.
 */
export function presetById(id: CameraPresetId): CameraPreset {
  const preset = BY_ID.get(id);
  if (preset === undefined) {
    throw new RangeError(`No such camera preset: ${id}`);
  }
  return preset;
}

/** Is this a flat, orthographic drawing rather than a perspective view? */
export function isFlatMode(mode: CameraMode): boolean {
  return mode === 'top' || mode === 'elevation';
}

/**
 * Where a preset puts the camera, for a building this size.
 *
 * Framed by the same arithmetic a selection is, against the whole building's box
 * — so a standard view leaves the same fifteen per cent of margin as everything
 * else, and cannot be parked inside the building it is looking at. The plan and
 * the elevations are fitted for the camera they are actually drawn with, which
 * is what stops a deep building from being framed as though its near face were
 * closer than its far one.
 */
export function presetViewpoint(
  preset: CameraPreset,
  extent: CameraModeContext['extent'],
  aspect: number = PRESET_SETTINGS.defaultAspect,
): Viewpoint {
  return frameViewpoint(boxOfExtent(extent), {
    azimuthRad: degreesToRadians(degrees(preset.azimuthDeg)),
    polarRad: degreesToRadians(degrees(preset.polarDeg)),
    aspect,
    paddingFraction: PRESET_SETTINGS.framePaddingFraction,
    clearanceMarginM: PRESET_SETTINGS.clearanceMarginM,
    orthographic: isFlatMode(preset.mode),
  });
}

/* -------------------------------------------------------------------------- */
/* Easing and interpolation.                                                   */
/* -------------------------------------------------------------------------- */

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/**
 * Ease in, ease out, cubic. Leaves at rest and arrives at rest.
 *
 * Symmetric about the halfway point, which is the property that makes a move
 * back look like the move out played in reverse rather than like a different
 * gesture.
 */
export function easeInOutCubic(time: number): number {
  const t = clamp01(time);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** The signed turn from one heading to another, never more than half a turn. */
export function shortestTurn(fromRad: number, toRad: number): number {
  const half = RADIANS_PER_TURN / 2;
  const delta = (toRad - fromRad) % RADIANS_PER_TURN;
  if (delta > half) {
    return delta - RADIANS_PER_TURN;
  }
  if (delta < -half) {
    return delta + RADIANS_PER_TURN;
  }
  return delta;
}

/**
 * A viewpoint part of the way from one to another. Pure.
 *
 * The distance is geometric rather than linear — see the module note — and the
 * two ends are returned exactly, so a move that has finished is at its
 * destination and not a rounding error away from it.
 */
export function interpolateViewpoint(from: Viewpoint, to: Viewpoint, fraction: number): Viewpoint {
  if (fraction <= 0) {
    return { ...from, target: from.target.clone() };
  }
  if (fraction >= 1) {
    return { ...to, target: to.target.clone() };
  }

  const geometric = from.distanceM > 0 && to.distanceM > 0;

  return {
    target: from.target.clone().lerp(to.target, fraction),
    azimuthRad: from.azimuthRad + shortestTurn(from.azimuthRad, to.azimuthRad) * fraction,
    polarRad: from.polarRad + (to.polarRad - from.polarRad) * fraction,
    distanceM: geometric
      ? from.distanceM * Math.pow(to.distanceM / from.distanceM, fraction)
      : from.distanceM + (to.distanceM - from.distanceM) * fraction,
  };
}

/* -------------------------------------------------------------------------- */
/* The move.                                                                   */
/* -------------------------------------------------------------------------- */

export interface TransitionOptions {
  /** How long the move takes. Defaults to {@link PresetSettings.transitionMs}. */
  readonly durationMs?: number;
  /** When true the move takes no time at all: it is finished before it starts. */
  readonly reducedMotion?: boolean;
  /** The curve. Defaults to {@link easeInOutCubic}; never linear by default. */
  readonly ease?: (time: number) => number;
}

/**
 * An eased move from one viewpoint to another, keeping its own time.
 *
 * It owns no camera and no controller: it is asked what the viewpoint is now, and
 * it says. That is what lets the same object serve a real render loop and a test
 * that steps it 34 ms at a time.
 */
export class ViewpointTransition {
  readonly from: Viewpoint;
  readonly to: Viewpoint;
  readonly durationMs: number;

  private readonly ease: (time: number) => number;
  private elapsed = 0;
  private stopped = false;

  constructor(from: Viewpoint, to: Viewpoint, options: TransitionOptions = {}) {
    this.from = { ...from, target: from.target.clone() };
    this.to = { ...to, target: to.target.clone() };
    this.ease = options.ease ?? easeInOutCubic;
    this.durationMs =
      options.reducedMotion === true ? 0 : (options.durationMs ?? PRESET_SETTINGS.transitionMs);
  }

  get elapsedMs(): number {
    return this.elapsed;
  }

  /** Time through the move, 0 to 1, before easing. */
  get fraction(): number {
    return this.durationMs <= 0 ? 1 : clamp01(this.elapsed / this.durationMs);
  }

  /** Distance through the move, 0 to 1, after easing. */
  get eased(): number {
    return this.ease(this.fraction);
  }

  /** Has it run its full time? A cancelled move has not, and never will. */
  get finished(): boolean {
    return !this.stopped && this.fraction >= 1;
  }

  /** Was it stopped part-way by the reviewer? */
  get cancelled(): boolean {
    return this.stopped;
  }

  /** Is it over, either way? */
  get done(): boolean {
    return this.stopped || this.fraction >= 1;
  }

  /** Where the camera is now, without moving time on. */
  viewpoint(): Viewpoint {
    return interpolateViewpoint(this.from, this.to, this.eased);
  }

  /** Move time on and report where that leaves the camera. */
  advance(dtSeconds: number): Viewpoint {
    if (!this.stopped && Number.isFinite(dtSeconds) && dtSeconds > 0) {
      this.elapsed += dtSeconds * 1000;
    }
    return this.viewpoint();
  }

  /** Stop here. The move does not finish and does not resume. */
  cancel(): void {
    this.stopped = true;
  }
}

/* -------------------------------------------------------------------------- */
/* The director.                                                               */
/* -------------------------------------------------------------------------- */

export interface CameraDirectorOptions {
  /** When true every move is a cut. Wire it to `prefers-reduced-motion`. */
  readonly reducedMotion?: boolean;
  /** The built scene, for {@link CameraDirector.frameObjects}. */
  readonly root?: Object3D;
  /** Viewport width over height. */
  readonly aspect?: number;
  /** Overrides the move duration, for a caller that has a reason. */
  readonly durationMs?: number;
}

/**
 * Owns the camera: which mode is driving it, and whether a move is in flight.
 *
 * The one piece of state that could not live in a mode, because it is about the
 * handover *between* modes. While a move is running the director rebuilds the
 * flight controller each frame at the interpolated viewpoint — a few small
 * objects over the twenty frames a 340 ms move lasts — rather than reimplementing
 * how a mode turns a viewpoint into a pose. `modes.ts` stays the only place that
 * knows.
 */
export class CameraDirector {
  private readonly context: CameraModeContext;
  private current: CameraModeController;
  private running: ViewpointTransition | null = null;
  private flightMode: CameraMode;
  private destinationMode: CameraMode;
  private reducedMotion: boolean;
  private root: Object3D | null;
  private aspect: number;
  private readonly durationMs: number;

  constructor(
    controller: CameraModeController,
    context: CameraModeContext,
    options: CameraDirectorOptions = {},
  ) {
    this.context = context;
    this.current = controller;
    this.flightMode = controller.mode;
    this.destinationMode = controller.mode;
    this.reducedMotion = options.reducedMotion ?? false;
    this.root = options.root ?? null;
    this.aspect = options.aspect ?? PRESET_SETTINGS.defaultAspect;
    this.durationMs = options.durationMs ?? PRESET_SETTINGS.transitionMs;
  }

  /** The mode driving the camera. During a move, the one flying it. */
  get controller(): CameraModeController {
    return this.current;
  }

  /** The move in flight, or `null`. */
  get transition(): ViewpointTransition | null {
    return this.running;
  }

  /** Is a move in flight? */
  get moving(): boolean {
    return this.running !== null;
  }

  /** Turn every move into a cut, or back. Wire it to the media query. */
  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  /** Tell it the viewport shape, so framing accounts for width as well as height. */
  setAspect(aspect: number): void {
    this.aspect = Number.isFinite(aspect) && aspect > 0 ? aspect : PRESET_SETTINGS.defaultAspect;
  }

  /** Point it at the scene a selection will be looked up in. */
  setRoot(root: Object3D | null): void {
    this.root = root;
  }

  /**
   * Start an eased move to a viewpoint.
   *
   * From wherever the camera is *now*, so retargeting mid-flight — pressing `2`
   * and then `3` — is smooth rather than a jump back to the first destination.
   * Under reduced motion the move is already finished when it is returned, and
   * the camera has arrived without a frame of animation.
   */
  goTo(destination: Viewpoint, mode: CameraMode = this.current.mode): ViewpointTransition {
    const source = this.current.mode;
    this.destinationMode = mode;
    // A move that stays inside one drawing stays in that drawing. Anything that
    // changes the angle is flown with a camera that has one — and never with the
    // walk mode, whose eye is pinned to the floor and cannot be flown at all.
    this.flightMode = source === mode && source !== 'walk' ? source : 'orbit';

    const transition = new ViewpointTransition(this.current.viewpoint(), destination, {
      durationMs: this.durationMs,
      reducedMotion: this.reducedMotion,
    });

    if (transition.finished) {
      this.running = null;
      this.current = createCameraMode(mode, transition.to, this.context);
    } else {
      this.running = transition;
    }
    return transition;
  }

  /** Start an eased move to one of the six standard views. */
  goToPreset(id: CameraPresetId): ViewpointTransition {
    const preset = presetById(id);
    return this.goTo(presetViewpoint(preset, this.context.extent, this.aspect), preset.mode);
  }

  /**
   * Frame the objects with these ids, keeping the heading already in use.
   *
   * `null` when there is no scene to look them up in, or when nothing in it
   * carries one of the ids — better to leave the camera alone than to fly it at
   * an empty box. A walker is lifted into the orbit mode, since framing a
   * selection is not something done on foot.
   */
  frameObjects(ids: Iterable<string>): ViewpointTransition | null {
    if (this.root === null) {
      return null;
    }

    const from = this.current.viewpoint();
    const mode = this.current.mode === 'walk' ? 'orbit' : this.current.mode;
    const destination = frameObjectsViewpoint(this.root, ids, {
      azimuthRad: from.azimuthRad,
      polarRad: from.polarRad,
      aspect: this.aspect,
      paddingFraction: PRESET_SETTINGS.framePaddingFraction,
      clearanceMarginM: PRESET_SETTINGS.clearanceMarginM,
      orthographic: isFlatMode(mode),
    });

    if (destination === null) {
      return null;
    }
    return this.goTo(destination, mode);
  }

  /** Select a view by key. `false` when the key was not one of `1`–`6`. */
  handleKey(code: string): boolean {
    const preset = presetForKey(code);
    if (preset === null) {
      return false;
    }
    this.goToPreset(preset.id);
    return true;
  }

  /**
   * Stop a move where it has got to and hand the camera back.
   *
   * Immediate: the controller is rebuilt at the viewpoint on screen before this
   * returns, so the very input that interrupted the move can be applied to it on
   * the same tick. Safe to call when nothing is moving.
   */
  interrupt(): void {
    const running = this.running;
    if (running === null) {
      return;
    }
    const stoppedAt = running.viewpoint();
    running.cancel();
    this.running = null;
    this.current = createCameraMode(this.flightMode, stoppedAt, this.context);
  }

  update(dtSeconds: number): boolean {
    const running = this.running;
    if (running === null) {
      return this.current.update(dtSeconds);
    }

    const sampled = running.advance(dtSeconds);
    if (running.finished) {
      this.running = null;
      this.current = createCameraMode(this.destinationMode, running.to, this.context);
    } else {
      this.current = createCameraMode(this.flightMode, sampled, this.context);
    }
    return true;
  }

  viewpoint(): Viewpoint {
    return this.current.viewpoint();
  }

  pose(): CameraPose {
    return this.current.pose();
  }

  applyTo(...args: Parameters<CameraModeController['applyTo']>): void {
    this.current.applyTo(...args);
  }
}
