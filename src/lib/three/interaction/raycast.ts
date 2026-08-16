/**
 * The pointer, metered.
 *
 * A raycast against a batched storey is not free: it walks the scene graph,
 * tests a bounding sphere per batch and then every triangle of the ones it
 * cannot reject. Doing that **once per drawn frame** is the version of this file
 * that must never exist — at 120 Hz on a plan of forty-eight walls it competes
 * with the renderer for the one thread they share, and the frames it steals are
 * frames the user paid for. So there is no `requestAnimationFrame` in this
 * module and no hook into anyone's render loop. Rays are shot in reply to
 * pointer input and to nothing else.
 *
 * Even that is too often. A mouse reports movement at the display's rate or
 * better, and a hover highlight that updates thirty times a second is one no eye
 * can tell from sixty. Hence the two gates every hover cast passes:
 *
 * - **Did the pointer actually move?** A pointer event carrying the coordinates
 *   of the previous one — a modifier pressed, a coalesced resend — is dropped
 *   without a cast. This is a cheaper gate than the clock and it comes first.
 * - **Has {@link MIN_RAYCAST_INTERVAL_MS} passed?** Leading edge, so the first
 *   move of a gesture is answered at once; trailing edge, so the *last* move
 *   before the pointer stops is answered too. Without the trailing edge a
 *   pointer that comes to rest inside a doorway keeps the label of whatever it
 *   crossed a frame earlier, which is the one moment a person is actually
 *   reading it. Positions arriving while the gate is shut coalesce: the newest
 *   wins, the ones it overtook are discarded unshot.
 *
 * The result is at most {@link MAX_RAYCASTS_PER_SECOND} hover casts in any one
 * second, however hard the pointer is moved.
 *
 * **A press is not a pick until it is released.** Orbiting a camera starts with
 * the same event as selecting a wall, and the two are told apart the way every
 * drawing tool tells them apart: by how far the pointer travelled in between.
 * Under {@link CLICK_SLOP_PX} it was a click; from there on it was a drag, the
 * flag latches, and a gesture that wanders out and comes back to where it
 * started stays a drag — nobody who has just spun a camera means to select what
 * is under the cursor when they let go. While a drag is in progress no hover
 * cast is scheduled at all, which is the largest single saving here: dragging is
 * exactly when the pointer moves fastest and when the frame budget is tightest.
 *
 * **Nothing is written.** The picker emits {@link PickEvent} and stops. It holds
 * no selection, calls no store, knows no `commit()`. What a hover means — a
 * floating label, a soft outline — and what a pick means — replace the
 * selection, add to it — are decisions for the layer above, which is also the
 * only layer allowed to make them.
 *
 * Clock and timers are ports, so the metering is testable on a hand-cranked
 * clock rather than by watching a wall clock and hoping.
 */

import { Raycaster, Vector2, type Camera, type Object3D } from 'three';

import type { LayerStates } from '@/lib/selection/selectionOps';

import type { MergeResult } from '../build/merge';
import { firstEntityHit, type EntityHit, type RayIntersection } from './hitTest';

/* -------------------------------------------------------------------------- */
/* Constants.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The ceiling on hover casts.
 *
 * Thirty a second is the rate at which a highlight stops reading as a highlight
 * that lags. It is also half of the cheapest display's frame rate, so a cast and
 * the frame it informs never queue behind each other twice in a row.
 */
export const MAX_RAYCASTS_PER_SECOND = 30;

/**
 * The shortest gap between two hover casts: 34 ms.
 *
 * Rounded **up** from the exact 33⅓, and the rounding is the whole point. A gap
 * of `1000 / 30` admits a thirty-first cast in some one-second window — thirty
 * gaps come to a thousand milliseconds precisely, so whether the last one lands
 * inside the window or on its edge is decided by the last bit of a float. A gap
 * of 34 ms puts thirty of them at 1020 ms, and the ceiling holds by twenty
 * milliseconds rather than by luck. The cost is that the meter runs at 29.4 Hz
 * instead of 30; nobody has ever seen that difference.
 */
export const MIN_RAYCAST_INTERVAL_MS = Math.ceil(1_000 / MAX_RAYCASTS_PER_SECOND);

/**
 * How far the pointer may travel between press and release and still be a click.
 *
 * Four pixels is about the wobble a hand puts into a mouse button and well under
 * the smallest deliberate drag. The boundary is exclusive — a travel of exactly
 * four pixels is a drag — so "under four pixels is a click" is true as written.
 */
export const CLICK_SLOP_PX = 4;

/* -------------------------------------------------------------------------- */
/* Vocabulary.                                                                 */
/* -------------------------------------------------------------------------- */

/** A point on the canvas, in CSS pixels from its top-left corner. */
export interface PointerPosition {
  readonly x: number;
  readonly y: number;
}

/** The size of the canvas those pixels are measured against. */
export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

/** One pointer event, reduced to what a pick needs to know. */
export interface PointerInput extends PointerPosition {
  /**
   * Was a modifier held that means "add to what is already selected"?
   *
   * Carried through to the pick event rather than acted on: which modifier, and
   * whether it adds or toggles, is the caller's rule to write.
   */
  readonly additive?: boolean;
}

/** What the picker reports. It reports nothing else, and changes nothing. */
export type PickEvent =
  /** The pointer settled over something, or over nothing. For the floating label. */
  | {
      readonly type: 'hover';
      readonly hit: EntityHit | null;
      /** Where the ray was shot from, for placing a label next to the cursor. */
      readonly pointer: PointerPosition;
    }
  /** A press and release in the same place: the user chose this object. */
  | {
      readonly type: 'pick';
      readonly hit: EntityHit | null;
      readonly pointer: PointerPosition;
      readonly additive: boolean;
    };

export type PickListener = (event: PickEvent) => void;

/** Answers "what is under this point of the canvas?". `createScenePick` builds one. */
export type PickAt = (pointer: PointerPosition) => EntityHit | null;

export type TimerHandle = number;

/**
 * The port through which a cast is deferred to the end of the metering window.
 *
 * Deliberately timers and not frames: a frame callback would put this work back
 * inside the render loop the module exists to stay out of.
 */
export interface PickerTimers {
  setTimeout: (run: () => void, delayMs: number) => TimerHandle;
  clearTimeout: (handle: TimerHandle) => void;
}

/** The host's timers, for everyone who is not a test. */
export const defaultTimers: PickerTimers = {
  clearTimeout: (handle) => {
    clearTimeout(handle);
  },
  setTimeout: (run, delayMs) => setTimeout(run, delayMs) as unknown as TimerHandle,
};

/* -------------------------------------------------------------------------- */
/* Casting.                                                                    */
/* -------------------------------------------------------------------------- */

/** What `createScenePick` needs to turn canvas pixels into an entity. */
export interface ScenePickOptions {
  readonly camera: Camera;
  /** The subtree to test — the batched storey, not the whole scene. */
  readonly root: Object3D;
  /** The canvas size, read at cast time so a resize needs no rewiring. */
  readonly viewport: () => ViewportSize;
  /** The range table of the current batching, read at cast time for the same reason. */
  readonly merge?: () => MergeResult | null;
  /** Which layers are drawn and which are locked, read at cast time. */
  readonly layers?: () => LayerStates;
  /** An existing caster to reuse; one is made when none is given. */
  readonly raycaster?: Raycaster;
}

/** The mapping itself, written into a vector the caller already owns. */
function writeNormalizedDevice(
  target: Vector2,
  pointer: PointerPosition,
  viewport: ViewportSize,
): Vector2 {
  return target.set(
    (pointer.x / viewport.width) * 2 - 1,
    -(pointer.y / viewport.height) * 2 + 1,
  );
}

/**
 * Canvas pixels to normalised device coordinates: `(-1, -1)` bottom-left,
 * `(1, 1)` top-right.
 *
 * The `y` axis flips because a canvas counts down from its top edge and clip
 * space counts up from its middle.
 */
export function toNormalizedDevice(pointer: PointerPosition, viewport: ViewportSize): Vector2 {
  return writeNormalizedDevice(new Vector2(), pointer, viewport);
}

/**
 * The usual cast: a ray from the camera through a canvas pixel, resolved against
 * the range table.
 *
 * One `Raycaster` and one `Vector2` are made here and reused for every cast.
 * Thirty allocations a second would not sink anything on their own, but they
 * fall due during pointer movement, which is when the collector is least welcome.
 *
 * Layer eligibility is applied inside `firstEntityHit`, not by `Raycaster`: a
 * hidden *layer* is the application's idea, quite separate from three's
 * `object.visible`, and a locked one is still drawn.
 */
export function createScenePick(options: ScenePickOptions): PickAt {
  const raycaster = options.raycaster ?? new Raycaster();
  const device = new Vector2();

  return (pointer) => {
    const viewport = options.viewport();

    // A canvas of no width has no clip space; every pixel would map to infinity.
    if (viewport.width <= 0 || viewport.height <= 0) {
      return null;
    }

    raycaster.setFromCamera(writeNormalizedDevice(device, pointer, viewport), options.camera);

    const intersections: readonly RayIntersection[] = raycaster.intersectObject(
      options.root,
      true,
    );

    return firstEntityHit(intersections, {
      layers: options.layers?.() ?? {},
      merge: options.merge?.() ?? null,
    });
  };
}

/* -------------------------------------------------------------------------- */
/* The picker.                                                                 */
/* -------------------------------------------------------------------------- */

export interface PointerPickerOptions {
  /** What is under a point of the canvas. Usually `createScenePick(…)`. */
  readonly pick: PickAt;
  /** Where hover and pick events go. */
  readonly onEvent: PickListener;
  /** The clock. Defaults to `performance.now`; a test passes its own. */
  readonly now?: () => number;
  readonly timers?: PickerTimers;
  /** The shortest gap between hover casts. Defaults to {@link MIN_RAYCAST_INTERVAL_MS}. */
  readonly minIntervalMs?: number;
  /** The press-to-release travel a click may have. Defaults to {@link CLICK_SLOP_PX}. */
  readonly clickSlopPx?: number;
}

/**
 * The pointer half of picking: four event handlers and a teardown.
 *
 * Wire the canvas straight to it — `onPointerDown`, `onPointerMove`,
 * `onPointerUp`, `onPointerLeave` — and read the results off `onEvent`. The
 * picker owns no DOM listener of its own, so it works the same under React,
 * under a plain canvas and under a test that calls the four methods by hand.
 */
export interface PointerPicker {
  pointerDown: (input: PointerInput) => void;
  pointerMove: (input: PointerInput) => void;
  pointerUp: (input: PointerInput) => void;
  /** The pointer left the canvas: drop the label and forget the gesture. */
  pointerLeave: (input: PointerInput) => void;
  /** Cancel any deferred cast. The picker is not usable afterwards. */
  dispose: () => void;
}

function defaultNow(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

/** Did the pointer travel far enough for this gesture to be a drag? */
function isDrag(from: PointerPosition, to: PointerPosition, slopPx: number): boolean {
  const alongX = to.x - from.x;
  const alongY = to.y - from.y;

  // Compared squared, so the threshold costs no square root on every move.
  return alongX * alongX + alongY * alongY >= slopPx * slopPx;
}

/** A press in progress, and whether it has already become a drag. */
interface Press {
  readonly from: PointerPosition;
  dragging: boolean;
}

export function createPointerPicker(options: PointerPickerOptions): PointerPicker {
  const now = options.now ?? defaultNow;
  const timers = options.timers ?? defaultTimers;
  const minIntervalMs = options.minIntervalMs ?? MIN_RAYCAST_INTERVAL_MS;
  const clickSlopPx = options.clickSlopPx ?? CLICK_SLOP_PX;

  /** The last position handed in, so a resend of it can be dropped uncast. */
  let seen: PointerPosition | null = null;
  /** When the last ray was shot, or `null` before the first. */
  let lastCastMs: number | null = null;
  /** A position waiting out the metering window; the newest one only. */
  let deferred: PointerPosition | null = null;
  let timer: TimerHandle | null = null;
  let press: Press | null = null;
  /** Whether the last hover event said "nothing", so it is not said twice. */
  let hoveringNothing = false;

  const cancelDeferred = (): void => {
    if (timer !== null) {
      timers.clearTimeout(timer);
      timer = null;
    }
    deferred = null;
  };

  /**
   * Shoot, and report — unless the report would be the second "nothing" in a row.
   *
   * `lastCastMs` moves whether or not an event is emitted: the ray was shot, and
   * the ray is what is being rationed.
   */
  const castHover = (pointer: PointerPosition, atMs: number): void => {
    lastCastMs = atMs;

    const hit = options.pick(pointer);

    if (hit === null && hoveringNothing) {
      return;
    }

    hoveringNothing = hit === null;
    options.onEvent({ hit, pointer, type: 'hover' });
  };

  /** Cast now if the window is open, otherwise queue for the moment it opens. */
  const meterHover = (pointer: PointerPosition): void => {
    const atMs = now();

    if (lastCastMs === null || atMs - lastCastMs >= minIntervalMs) {
      castHover(pointer, atMs);

      return;
    }

    deferred = pointer;

    if (timer !== null) {
      return;
    }

    timer = timers.setTimeout(() => {
      timer = null;

      const pending = deferred;
      deferred = null;

      if (pending !== null) {
        castHover(pending, now());
      }
    }, minIntervalMs - (atMs - lastCastMs));
  };

  const pointerDown = (input: PointerInput): void => {
    const from: PointerPosition = { x: input.x, y: input.y };

    press = { dragging: false, from };
    seen = from;
  };

  const pointerMove = (input: PointerInput): void => {
    // The cheapest gate first: an event that repeats the last position tells us
    // nothing a ray could add.
    if (seen !== null && seen.x === input.x && seen.y === input.y) {
      return;
    }

    const pointer: PointerPosition = { x: input.x, y: input.y };

    seen = pointer;

    if (press !== null) {
      if (!press.dragging && isDrag(press.from, pointer, clickSlopPx)) {
        press.dragging = true;
      }

      // A drag belongs to the camera. Nothing is hovered during one, and the cast
      // that was already queued is dropped rather than shot at a stale position.
      if (press.dragging) {
        cancelDeferred();

        return;
      }
    }

    meterHover(pointer);
  };

  const pointerUp = (input: PointerInput): void => {
    const held = press;

    press = null;

    // A release with no press behind it — the button went down outside the
    // canvas — decides nothing.
    if (held === null) {
      return;
    }

    const pointer: PointerPosition = { x: input.x, y: input.y };

    seen = pointer;

    if (held.dragging || isDrag(held.from, pointer, clickSlopPx)) {
      return;
    }

    // A pick is never metered away. The rate limit exists to keep hovering off
    // the frame budget; a click that was dropped to save a third of a
    // millisecond is a broken interface. It still marks the clock, so the hover
    // that follows waits its turn behind it.
    cancelDeferred();
    lastCastMs = now();

    options.onEvent({
      additive: input.additive ?? false,
      hit: options.pick(pointer),
      pointer,
      type: 'pick',
    });
  };

  const pointerLeave = (input: PointerInput): void => {
    cancelDeferred();
    press = null;
    seen = null;

    if (hoveringNothing) {
      return;
    }

    // No cast: the pointer is off the canvas, so there is nothing to hit and
    // nothing to ask. The label is told to go, and that is all.
    hoveringNothing = true;
    options.onEvent({ hit: null, pointer: { x: input.x, y: input.y }, type: 'hover' });
  };

  const dispose = (): void => {
    cancelDeferred();
    press = null;
    seen = null;
    lastCastMs = null;
    hoveringNothing = false;
  };

  return { dispose, pointerDown, pointerLeave, pointerMove, pointerUp };
}
