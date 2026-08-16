/**
 * Every number the three camera modes are made of, declared once.
 *
 * A camera is the one part of a viewer whose defects are only ever described as
 * feelings — "it spins too fast", "it snaps", "you can walk through the wall".
 * None of those is actionable while the numbers behind them are scattered across
 * three controller classes as literals, because tuning one of them then means
 * finding it first, and the reviewer approving the change cannot see what else
 * moved with it.
 *
 * So there is exactly one constant, {@link CAMERA_SETTINGS}, and `modes.ts`
 * reads every parameter from it. Nothing in that file writes a speed, an angle,
 * a limit or a key code of its own. Two things follow:
 *
 * - **Changing the feel is a diff to this file.** A reviewer reads the numbers,
 *   not the control flow, to know what a change does.
 * - **A test can assert the promise rather than the implementation.** "The
 *   vertical angle stays between 5° and 85°" is a statement about
 *   `orbit.minPolarDeg` and `orbit.maxPolarDeg`, and the test names those fields
 *   rather than repeating the digits.
 *
 * This module imports nothing. It is data — angles in degrees, lengths in
 * metres, speeds in metres per second, key codes as `KeyboardEvent.code`
 * strings — and the conversion into radians happens once, at the top of
 * `modes.ts`, next to the arithmetic that needs it.
 *
 * **Metres, because a scene is metres.** `build/scene.ts` converts the plan out
 * of millimetres exactly once; everything downstream of that boundary, this file
 * included, is in scene units. An eye height of `1.6` is 1,6 m above the floor,
 * not 1,6 mm and not 1600 of anything.
 *
 * The object is frozen at every level, so a caller cannot raise a limit at
 * runtime and quietly pass a check the repository meant to fail — the same
 * reasoning, and the same mechanism, as `perf/budget.ts`.
 */

/* -------------------------------------------------------------------------- */
/* Shared.                                                                     */
/* -------------------------------------------------------------------------- */

/** What every mode agrees about: the lens, the clip planes, and how damping decays. */
export interface SharedCameraSettings {
  /**
   * Vertical field of view, in degrees.
   *
   * Also the exchange rate between the two projections: an orthographic view
   * showing a half-height of `h` is framed like a perspective camera standing
   * `h / tan(fov / 2)` away, which is what lets the top mode hand a distance to
   * the orbit mode and get the same apparent size back.
   */
  readonly fieldOfViewDeg: number;
  /**
   * Near plane, in metres.
   *
   * Set by the walk mode: a person standing 300 mm from a wall must still see
   * it, so the plane sits well inside that.
   */
  readonly nearM: number;
  /** The far plane never comes closer than this, however small the building. */
  readonly minFarM: number;
  /** Far plane as a multiple of the building radius, for everything larger. */
  readonly farRadiusFactor: number;
  /**
   * The frame rate the damping factor is quoted at.
   *
   * `damping` is a per-frame fraction — the convention every orbit control uses
   * — and a per-frame fraction applied to a 30 Hz frame damps half as much as
   * the same fraction at 60 Hz, so a scene that drops frames also changes feel.
   * `modes.ts` reads the factor as a decay per 1/60 s and raises it to the real
   * elapsed time, which keeps the motion identical at any frame rate.
   */
  readonly dampingReferenceHz: number;
  /**
   * How close to its goal a damped value has to be to be called still.
   *
   * In metres and in radians alike: 1/10 of a millimetre, and an angle far below
   * one pixel of rotation. Under it the value is snapped and the mode reports
   * that it has stopped, so a still scene stops asking to be redrawn.
   */
  readonly restEpsilon: number;
  /**
   * The smallest building the limits are worked out for, as a radius in metres.
   *
   * An empty project, or a plan with one wall in it, has a bounding radius near
   * zero, and limits derived from it would pin the camera inside a point. Below
   * this the limits behave as though the building were this big.
   */
  readonly smallestPlanRadiusM: number;
}

/* -------------------------------------------------------------------------- */
/* Orbit.                                                                      */
/* -------------------------------------------------------------------------- */

/** Turning around the building, looking in at it. */
export interface OrbitCameraSettings {
  /**
   * How much of the remaining distance to the goal is covered each 1/60 s.
   *
   * 0,08 is slow enough that a flick of the pointer coasts to a stop instead of
   * stopping with it, and fast enough that the view is where it was asked to be
   * inside about a third of a second.
   */
  readonly damping: number;
  /**
   * The closest the camera may come to looking straight down, in degrees from
   * vertical.
   *
   * Not zero, because straight down is the top mode's job, and an orbit camera
   * that reaches it loses the horizon it needs to say which way is up.
   */
  readonly minPolarDeg: number;
  /**
   * The closest the camera may come to the horizon, in degrees from vertical.
   *
   * Not 90°, because at 90° the eye is exactly level with the point it looks at,
   * which puts it inside the floor slab of any storey it is inspecting.
   */
  readonly maxPolarDeg: number;
  /** Pointer travel, in pixels, that turns the camera a full circle. */
  readonly rotatePixelsPerTurn: number;
  /** Multiplies the natural drag mapping, where the plan follows the pointer exactly. */
  readonly panSpeedFactor: number;
  /** One wheel notch multiplies the distance to the target by this. */
  readonly zoomFactorPerNotch: number;
  /**
   * The nearest the eye may get to its target, in metres, whatever the building
   * size says. About an arm's length: closer than this and a wall fills the
   * frame with no context around it.
   */
  readonly minDistanceM: number;
  /** The near limit as a fraction of the building radius, when that is larger. */
  readonly minRadiusFactor: number;
  /**
   * The far limit as a multiple of the building radius.
   *
   * Three radii still shows the building as a building; past that it is a mark
   * on an empty screen, which is a view with nothing in it to review.
   */
  readonly maxRadiusFactor: number;
  /** Heading the first view of a project is taken from, in degrees. */
  readonly initialAzimuthDeg: number;
  /** Vertical angle the first view of a project is taken from, in degrees. */
  readonly initialPolarDeg: number;
  /** Slack left around the building when a distance is chosen to frame it. */
  readonly fitMargin: number;
}

/* -------------------------------------------------------------------------- */
/* Top.                                                                        */
/* -------------------------------------------------------------------------- */

/** Straight down, orthographic — the drawing the plan was measured as. */
export interface TopCameraSettings {
  /** As {@link OrbitCameraSettings.damping}, so sliding feels the same in both modes. */
  readonly damping: number;
  /**
   * Vertical angle, in degrees from vertical. Zero, and there is no input that
   * changes it: a plan read at a tilt is a plan whose dimensions are foreshortened.
   */
  readonly polarDeg: number;
  /** Multiplies the natural drag mapping, where the plan follows the pointer exactly. */
  readonly panSpeedFactor: number;
  /** One wheel notch multiplies the visible half-height by this. */
  readonly zoomFactorPerNotch: number;
  /** The smallest half-height the frustum may shrink to, in metres. */
  readonly minHalfHeightM: number;
  /** The near limit as a fraction of the building radius, when that is larger. */
  readonly minHalfHeightFactor: number;
  /**
   * The largest half-height as a multiple of the building radius.
   *
   * At 1,5 the whole plan sits in the middle half of the viewport, which is as
   * far out as a plan is still legible.
   */
  readonly maxHalfHeightFactor: number;
  /**
   * How far above the roof the camera is parked, in metres.
   *
   * An orthographic projection does not change size with distance, so this
   * number decides nothing about the picture — only that the near plane is above
   * the tallest thing in the model rather than slicing through it.
   */
  readonly clearanceM: number;
}

/* -------------------------------------------------------------------------- */
/* Walk.                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Which `KeyboardEvent.code` values drive the walk.
 *
 * `code` rather than `key`: it names the physical key, so W A S D stay where the
 * fingers are on an AZERTY keyboard, and it is unaffected by a held modifier.
 * The arrows are listed beside the letters because invariant A12 asks for the
 * whole product to be usable from the keyboard, and a reviewer on a laptop
 * reaches for the arrows first.
 */
export interface WalkKeyBindings {
  readonly forward: readonly string[];
  readonly back: readonly string[];
  readonly left: readonly string[];
  readonly right: readonly string[];
  /** Held, not toggled: releasing it returns to walking pace immediately. */
  readonly run: readonly string[];
}

/** Standing inside the building, at the height of a person looking at it. */
export interface WalkCameraSettings {
  /** Eye height above the floor, in metres. */
  readonly eyeHeightM: number;
  /** Walking pace, in metres per second. */
  readonly walkSpeedMps: number;
  /** Pace while the run key is held, in metres per second. */
  readonly runSpeedMps: number;
  /**
   * How far the view may tilt from horizontal, in degrees, up or down.
   *
   * Wide, because it is also what the handover from the top mode has to fit
   * through: arriving from straight down, the walker has to be allowed to look
   * at the floor it was just above.
   */
  readonly maxPitchDeg: number;
  /** Pointer travel, in pixels, that turns the walker a full circle. */
  readonly lookPixelsPerTurn: number;
  /**
   * How far ahead the walker is taken to be looking, in metres.
   *
   * Only a fallback. The real distance is inherited from the mode the walk
   * started in, and it exists so that the point being looked at is defined even
   * when a caller hands over a viewpoint whose eye and target coincide.
   */
  readonly focusDistanceM: number;
  readonly keys: WalkKeyBindings;
}

/* -------------------------------------------------------------------------- */
/* The one constant.                                                           */
/* -------------------------------------------------------------------------- */

/** Every parameter of every camera mode. */
export interface CameraSettings {
  readonly shared: SharedCameraSettings;
  readonly orbit: OrbitCameraSettings;
  readonly top: TopCameraSettings;
  readonly walk: WalkCameraSettings;
}

/**
 * The settings. `modes.ts` reads all of them from here and declares none of its
 * own.
 *
 * Frozen at every level: an object frozen only at the root still lets
 * `CAMERA_SETTINGS.orbit.maxPolarDeg = 90` through, which would defeat the
 * clamp the whole orbit mode is built around.
 */
export const CAMERA_SETTINGS: CameraSettings = Object.freeze({
  shared: Object.freeze({
    fieldOfViewDeg: 50,
    nearM: 0.1,
    minFarM: 200,
    farRadiusFactor: 8,
    dampingReferenceHz: 60,
    restEpsilon: 1e-4,
    smallestPlanRadiusM: 5,
  }),

  orbit: Object.freeze({
    damping: 0.08,
    minPolarDeg: 5,
    maxPolarDeg: 85,
    rotatePixelsPerTurn: 900,
    panSpeedFactor: 1,
    zoomFactorPerNotch: 1.12,
    minDistanceM: 1.2,
    minRadiusFactor: 0.04,
    maxRadiusFactor: 3,
    initialAzimuthDeg: 45,
    initialPolarDeg: 60,
    fitMargin: 1.15,
  }),

  top: Object.freeze({
    damping: 0.08,
    polarDeg: 0,
    panSpeedFactor: 1,
    zoomFactorPerNotch: 1.12,
    minHalfHeightM: 0.5,
    minHalfHeightFactor: 0.04,
    maxHalfHeightFactor: 1.5,
    clearanceM: 5,
  }),

  walk: Object.freeze({
    eyeHeightM: 1.6,
    walkSpeedMps: 1.4,
    runSpeedMps: 3.5,
    maxPitchDeg: 85,
    lookPixelsPerTurn: 1200,
    focusDistanceM: 3,
    keys: Object.freeze({
      forward: Object.freeze(['KeyW', 'ArrowUp']),
      back: Object.freeze(['KeyS', 'ArrowDown']),
      left: Object.freeze(['KeyA', 'ArrowLeft']),
      right: Object.freeze(['KeyD', 'ArrowRight']),
      run: Object.freeze(['ShiftLeft', 'ShiftRight']),
    }),
  }),
});
