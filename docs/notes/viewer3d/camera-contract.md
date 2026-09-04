# Camera & Interaction Contract for Viewer3D

## Overview

This document defines the public API for camera modes, interaction picking, tool state machine, and keyboard shortcuts that will be used by the Viewer3D screen. All functions/classes/constants are documented with their file location, full signature, and brief description.

---

## camera/modes.ts — Four ways of looking

**File**: `src/lib/three/camera/modes.ts`

### Types & Interfaces

| Name | Line | Signature | Description |
|------|------|-----------|-------------|
| `CameraMode` | 92 | `type CameraMode = 'orbit' \| 'top' \| 'elevation' \| 'walk'` | Enum of four viewing modes: perspective orbit around building, orthographic plan (top-down), orthographic elevation (level), first-person walk-through. |
| `Viewpoint` | 102 | `interface Viewpoint { target: Vector3; azimuthRad: number; polarRad: number; distanceM: number; }` | The point being looked at, heading, vertical angle, and framing distance; the handover currency between modes. |
| `CameraPose` | 122 | `interface CameraPose { eye: Vector3; target: Vector3; up: Vector3; orthographicHalfHeightM: number \| null; }` | Where the camera is right now: eye position, target, up vector, and orthographic half-height (null for perspective). |
| `BuildingExtent` | 138 | `interface BuildingExtent { centre: Vector3; sizeM: Vector3; }` | How big the thing being looked at is: centre and width/height/depth in metres. |
| `LengthLimits` | 145 | `interface LengthLimits { minM: number; maxM: number; }` | A closed range of lengths in metres. |
| `ClipPlanes` | 151 | `interface ClipPlanes { nearM: number; farM: number; }` | Near and far clip planes in metres. |
| `CameraModeContext` | 163 | `interface CameraModeContext { extent: BuildingExtent; floorElevationM?: number; }` | Everything a mode needs beyond the viewpoint: building extent and optional walk-mode floor elevation. |
| `CameraModeController` | 173 | `interface CameraModeController { mode: CameraMode; viewpoint(): Viewpoint; pose(): CameraPose; update(dtSeconds: number): boolean; settle(): void; applyTo(camera, aspect): void; }` | A camera you can drive. Every mode implements this, the differences are in input methods. |

### Orbit Mode — Perspective, rotating

| Name | Line | Signature | Description |
|------|------|-----------|-------------|
| `OrbitCameraMode` | 457 | `class OrbitCameraMode implements CameraModeController` | Turn around the building looking in. Has damped rotation, pan, and zoom. Respects 5°–85° vertical angle limits. |
| `OrbitCameraMode.distanceLimits` | 489 | `get distanceLimits(): LengthLimits` | The range this camera's distance is held to. |
| `OrbitCameraMode.rotate` | 504 | `rotate(deltaXPx: number, deltaYPx: number): void` | Turn by pointer pixels. Rightward sends building right; downward tips roof into view. |
| `OrbitCameraMode.pan` | 520 | `pan(deltaXPx: number, deltaYPx: number, viewportHeightPx: number): void` | Slide the point being looked at across the screen plane. Rate adjusts with distance. |
| `OrbitCameraMode.dolly` | 534 | `dolly(notches: number): void` | Wheel notches in and out, clamped to building limits. |

### Flat Modes — Orthographic, plan & elevation

| Name | Line | Signature | Description |
|------|------|-----------|-------------|
| `FlatCameraMode` | 629 | `abstract class FlatCameraMode implements CameraModeController` | A measured drawing: locked angle & heading, orthographic, pan and zoom. Base for plan & elevation. |
| `FlatCameraMode.halfHeightLimits` | 672 | `get halfHeightLimits(): LengthLimits` | How far in and out this view may zoom, as half-heights. |
| `FlatCameraMode.halfHeightM` | 677 | `get halfHeightM(): number` | Half the visible height of the drawing in metres — the zoom level. |
| `FlatCameraMode.pan` | 688 | `pan(deltaXPx: number, deltaYPx: number, viewportHeightPx: number): void` | Slide drawing under pointer in the view plane. Horizontal and vertical both pan within the plane. |
| `FlatCameraMode.zoom` | 702 | `zoom(notches: number): void` | Wheel notches zoom in/out, held to limits. |
| `TopCameraMode` | 762 | `class TopCameraMode extends FlatCameraMode` | The plan: straight down, orthographic. Angle locked at 0°. |
| `ElevationCameraMode` | 781 | `class ElevationCameraMode extends FlatCameraMode` | An elevation: dead level (90°), orthographic. One of four cardinal directions. |

### Walk Mode — First-person, eye at 1.6m

| Name | Line | Signature | Description |
|------|------|-----------|-------------|
| `WalkCameraMode` | 810 | `class WalkCameraMode implements CameraModeController` | Standing in the building at eye height (1.6 m). No damping, exact pace, normalised diagonals. No vertical bob. |
| `WalkCameraMode.floorM` | 862 | `get floorM(): number` | The floor elevation this walker is on in metres. |
| `WalkCameraMode.pitch` | 867 | `get pitch(): number` | How far the view is tilted from horizontal in radians; positive is up. Clamped ±85°. |
| `WalkCameraMode.press` | 872 | `press(code: string): void` | Take a key down by `KeyboardEvent.code`. |
| `WalkCameraMode.release` | 877 | `release(code: string): void` | Let a key up. |
| `WalkCameraMode.releaseAll` | 888 | `releaseAll(): void` | Let every key up for focus loss. |
| `WalkCameraMode.running` | 893 | `get running(): boolean` | Is the run key down? |
| `WalkCameraMode.speedMps` | 898 | `get speedMps(): number` | The pace being walked at right now in metres/second. |
| `WalkCameraMode.look` | 903 | `look(deltaXPx: number, deltaYPx: number): void` | Turn and tilt by pointer pixels. Tilt held to ±85°. |

### Creating & Switching Modes

| Name | Line | Signature | Description |
|------|------|-----------|-------------|
| `createCameraMode` | 991 | `function createCameraMode(mode: CameraMode, viewpoint: Viewpoint, context: CameraModeContext): CameraModeController` | Build a mode looking at what a viewpoint says under a context's limits. |
| `switchCameraMode` | 1020 | `function switchCameraMode(current: CameraModeController, next: CameraMode, context: CameraModeContext): CameraModeController` | Change mode without changing what is being looked at. The point stays still; the heading carries over. |

### Supporting Functions (pure geometry helpers)

| Name | Line | Signature | Description |
|------|------|-----------|-------------|
| `buildingExtent` | 283 | `function buildingExtent(box: Box3): BuildingExtent` | Extract an extent from a three.js bounding box. |
| `extentFloorM` | 299 | `function extentFloorM(extent: BuildingExtent): number` | The bottom of the extent; the default walk-mode floor. |
| `boundingRadiusM` | 312 | `function boundingRadiusM(extent: BuildingExtent): number` | Radius of sphere the building fits in, never smaller than `CAMERA_SETTINGS.shared.smallestPlanRadiusM`. |
| `orbitDistanceLimits` | 318 | `function orbitDistanceLimits(extent: BuildingExtent): LengthLimits` | How near and how far the orbit camera may stand for a building this size. |
| `flatHalfHeightLimits` | 328 | `function flatHalfHeightLimits(extent: BuildingExtent, settings: FlatCameraSettings): LengthLimits` | How far in and out a flat view may zoom. |
| `topHalfHeightLimits` | 338 | `function topHalfHeightLimits(extent: BuildingExtent): LengthLimits` | The zoom range of the plan view. |
| `elevationHalfHeightLimits` | 343 | `function elevationHalfHeightLimits(extent: BuildingExtent): LengthLimits` | The zoom range of an elevation. |
| `clipPlanes` | 348 | `function clipPlanes(extent: BuildingExtent): ClipPlanes` | Clip planes wide enough for the far limit of a building this size. |
| `frameDistanceM` | 359 | `function frameDistanceM(halfHeightM: number): number` | The perspective distance that frames what an orthographic half-height shows. |
| `frameHalfHeightM` | 364 | `function frameHalfHeightM(distanceM: number): number` | The orthographic half-height that shows what a perspective distance frames. |
| `viewpointEye` | 369 | `function viewpointEye(viewpoint: Viewpoint): Vector3` | Where the eye of a viewpoint sits in world space. |
| `initialViewpoint` | 383 | `function initialViewpoint(extent: BuildingExtent): Viewpoint` | The view a project opens on: whole building from a corner and above, with margin. |

---

## camera/settings.ts — Every number declared once

**File**: `src/lib/three/camera/settings.ts`

All parameters from this single constant `CAMERA_SETTINGS`. **Unchanged at runtime.**

| Name | Line | Type | Description |
|------|------|------|-------------|
| `CAMERA_SETTINGS` | 276 | `CameraSettings` | The complete settings object (frozen). Contains `shared`, `orbit`, `top`, `elevation`, `walk`. |
| `CAMERA_SETTINGS.shared.fieldOfViewDeg` | 278 | `50` (degrees) | Vertical field of view. Exchange rate between two projections. |
| `CAMERA_SETTINGS.shared.nearM` | 279 | `0.1` (metres) | Near plane. Allows a person 300mm from a wall to still see it. |
| `CAMERA_SETTINGS.shared.minFarM` | 280 | `200` (metres) | Far plane never comes closer than this. |
| `CAMERA_SETTINGS.shared.farRadiusFactor` | 281 | `8` | Far plane as multiple of building radius. |
| `CAMERA_SETTINGS.shared.dampingReferenceHz` | 282 | `60` (Hz) | Damping factor is per 1/60 s; raised to actual elapsed time to keep motion frame-rate-independent. |
| `CAMERA_SETTINGS.shared.restEpsilon` | 283 | `1e-4` (metres & radians) | How close to goal a damped value must be to count as still. 1/10 mm and sub-pixel rotation. |
| `CAMERA_SETTINGS.shared.smallestPlanRadiusM` | 284 | `5` (metres) | Smallest building limits are worked out for. Empty projects get this size. |
| `CAMERA_SETTINGS.orbit.damping` | 288 | `0.08` | Per-frame damping (1/60 s basis). 0.08 means coast smoothly; view reaches goal in ~1/3 second. |
| `CAMERA_SETTINGS.orbit.minPolarDeg` | 289 | `5` (degrees) | Closest to straight-down the orbit camera may look. Not zero; straight down is top-mode's job. |
| `CAMERA_SETTINGS.orbit.maxPolarDeg` | 290 | `85` (degrees) | Closest to horizon the orbit camera may look. Not 90°; at 90° eye is level with target and inside floor. |
| `CAMERA_SETTINGS.orbit.rotatePixelsPerTurn` | 291 | `900` (pixels) | Pointer travel for a full circle. |
| `CAMERA_SETTINGS.orbit.panSpeedFactor` | 292 | `1.0` | Multiplier on natural drag mapping (plan follows pointer exactly × this). |
| `CAMERA_SETTINGS.orbit.zoomFactorPerNotch` | 293 | `1.12` | One wheel notch multiplies distance by this. |
| `CAMERA_SETTINGS.orbit.minDistanceM` | 294 | `1.2` (metres) | Nearest the eye may get, whatever building size says. About arm's length. |
| `CAMERA_SETTINGS.orbit.minRadiusFactor` | 295 | `0.04` | Near limit as fraction of building radius when larger. |
| `CAMERA_SETTINGS.orbit.maxRadiusFactor` | 296 | `3` | Far limit as multiple of building radius. Past 3× the building is a mark on empty screen. |
| `CAMERA_SETTINGS.orbit.initialAzimuthDeg` | 297 | `45` (degrees) | Heading the first view is taken from. |
| `CAMERA_SETTINGS.orbit.initialPolarDeg` | 298 | `60` (degrees) | Vertical angle the first view is taken from. |
| `CAMERA_SETTINGS.orbit.fitMargin` | 299 | `1.15` | Slack left around building when framing it. |
| `CAMERA_SETTINGS.top.damping` | 303 | `0.08` | Same as orbit; sliding feels consistent across modes. |
| `CAMERA_SETTINGS.top.polarDeg` | 304 | `0` (degrees) | Angle: straight down. No input changes this. |
| `CAMERA_SETTINGS.top.panSpeedFactor` | 305 | `1.0` | Multiplier on natural drag. |
| `CAMERA_SETTINGS.top.zoomFactorPerNotch` | 306 | `1.12` | Zoom multiplier. |
| `CAMERA_SETTINGS.top.minHalfHeightM` | 307 | `0.5` (metres) | Smallest half-height the frustum may shrink to. |
| `CAMERA_SETTINGS.top.minHalfHeightFactor` | 308 | `0.04` | Near limit as fraction of radius. |
| `CAMERA_SETTINGS.top.maxHalfHeightFactor` | 309 | `1.5` | Far limit as multiple of radius. At 1.5× the drawing sits in middle half of viewport. |
| `CAMERA_SETTINGS.top.clearanceM` | 310 | `5` (metres) | How far clear of building the camera is parked. Keeps near plane outside tallest thing. |
| `CAMERA_SETTINGS.elevation.*` | 315–323 | Same as `top` with `polarDeg: 90` | Elevation is plan at 90°. Numbers identical except angle. |
| `CAMERA_SETTINGS.walk.eyeHeightM` | 327 | `1.6` (metres) | Eye height above floor. Pinned and never moves. |
| `CAMERA_SETTINGS.walk.walkSpeedMps` | 328 | `1.4` (m/s) | Walking pace held for one second. Exactly this distance. |
| `CAMERA_SETTINGS.walk.runSpeedMps` | 329 | `3.5` (m/s) | Pace while run key is held. Exactly this distance. |
| `CAMERA_SETTINGS.walk.maxPitchDeg` | 330 | `85` (degrees) | How far the view may tilt from horizontal. Wide; must fit handover from top view (straight down). |
| `CAMERA_SETTINGS.walk.lookPixelsPerTurn` | 331 | `1200` (pixels) | Pointer travel for a full rotation. |
| `CAMERA_SETTINGS.walk.focusDistanceM` | 332 | `3` (metres) | Fallback distance when arrival viewpoint has eye ≈ target. |
| `CAMERA_SETTINGS.walk.keys.forward` | 334 | `['KeyW', 'ArrowUp']` | Keys that make walker advance. WASD + arrows. |
| `CAMERA_SETTINGS.walk.keys.back` | 335 | `['KeyS', 'ArrowDown']` | Keys that make walker retreat. |
| `CAMERA_SETTINGS.walk.keys.left` | 336 | `['KeyA', 'ArrowLeft']` | Keys that make walker strafe left. |
| `CAMERA_SETTINGS.walk.keys.right` | 337 | `['KeyD', 'ArrowRight']` | Keys that make walker strafe right. |
| `CAMERA_SETTINGS.walk.keys.run` | 338 | `['ShiftLeft', 'ShiftRight']` | Keys that speed up the walker. Held, not toggled. |

---

## camera/presets.ts — Six standard views & animated transitions

**File**: `src/lib/three/camera/presets.ts`

### Preset Types & Data

| Name | Line | Type | Description |
|------|------|------|-------------|
| `CameraPresetId` | 111 | `'top' \| 'front' \| 'back' \| 'left' \| 'right' \| 'perspective'` | The six standard views. |
| `CameraPreset` | 120 | `interface { id: CameraPresetId; keys: readonly string[]; mode: CameraMode; azimuthDeg: number; polarDeg: number; }` | One standard view: id, keybindings (digit row & numpad), mode, and angles. |
| `CAMERA_PRESETS` | 144 | `readonly CameraPreset[]` | The six presets in key order: top (1/Numpad1), front (2/Numpad2), back (3/Numpad3), left (4/Numpad4), right (5/Numpad5), perspective (6/Numpad6). |
| `PRESET_SETTINGS` | 97 | `PresetSettings` | Sibling of `CAMERA_SETTINGS`. Contains `transitionMs: 340`, `framePaddingFraction: 0.15`, `clearanceMarginM: 0.5`, `elevationPolarDeg: 90`, `topAzimuthDeg: 0`, `defaultAspect: 16/9`. |

### Preset Lookup

| Name | Line | Signature | Description |
|------|------|-----------|-------------|
| `presetForKey` | 200 | `function presetForKey(code: string): CameraPreset \| null` | The preset a key selects (digit row or numpad). `null` when not one of the six. |
| `presetById` | 210 | `function presetById(id: CameraPresetId): CameraPreset` | The preset with this id. Throws RangeError if unknown (programming error). |
| `isFlatMode` | 219 | `function isFlatMode(mode: CameraMode): boolean` | Is this a flat orthographic drawing rather than perspective? (top or elevation) |
| `presetViewpoint` | 233 | `function presetViewpoint(preset: CameraPreset, extent: BuildingExtent, aspect?: number): Viewpoint` | Where a preset puts the camera for a building this size. Framed with 15% margin. |

### Easing & Interpolation

| Name | Line | Signature | Description |
|------|------|-----------|-------------|
| `easeInOutCubic` | 263 | `function easeInOutCubic(time: number): number` | Ease in, ease out, cubic. Leaves at rest, arrives at rest. Symmetric. |
| `shortestTurn` | 269 | `function shortestTurn(fromRad: number, toRad: number): number` | The signed turn from one heading to another, never more than half a turn. |
| `interpolateViewpoint` | 288 | `function interpolateViewpoint(from: Viewpoint, to: Viewpoint, fraction: number): Viewpoint` | Viewpoint part-way between two. Distance is geometric (log scale). |

### Animated Transition

| Name | Line | Signature | Description |
|------|------|-----------|-------------|
| `TransitionOptions` | 312 | `interface { durationMs?: number; reducedMotion?: boolean; ease?: (time) => number; }` | Options for a move: duration (default `PRESET_SETTINGS.transitionMs`), reduced-motion flag, easing function. |
| `ViewpointTransition` | 328 | `class ViewpointTransition` | An eased move from one viewpoint to another, keeping its own time. Owns no camera. |
| `ViewpointTransition.from` | 329 | `readonly Viewpoint` | Start viewpoint. |
| `ViewpointTransition.to` | 330 | `readonly Viewpoint` | End viewpoint. |
| `ViewpointTransition.durationMs` | 331 | `readonly number` | How long the move takes (0 if reduced motion). |
| `ViewpointTransition.elapsedMs` | 345 | `get elapsedMs(): number` | Time elapsed so far. |
| `ViewpointTransition.fraction` | 350 | `get fraction(): number` | 0–1 before easing. |
| `ViewpointTransition.eased` | 355 | `get eased(): number` | 0–1 after easing. |
| `ViewpointTransition.finished` | 360 | `get finished(): boolean` | Has it run its full time? (Not cancelled) |
| `ViewpointTransition.cancelled` | 365 | `get cancelled(): boolean` | Was it stopped part-way? |
| `ViewpointTransition.done` | 370 | `get done(): boolean` | Is it over either way? |
| `ViewpointTransition.viewpoint()` | 375 | `viewpoint(): Viewpoint` | Where the camera is now without moving time. |
| `ViewpointTransition.advance` | 380 | `advance(dtSeconds: number): Viewpoint` | Move time on and report where that leaves the camera. |
| `ViewpointTransition.cancel` | 388 | `cancel(): void` | Stop here. Move does not finish. |

### Camera Director — Owns the camera

| Name | Line | Signature | Description |
|------|------|-----------|-------------|
| `CameraDirectorOptions` | 397 | `interface { reducedMotion?: boolean; root?: Object3D; aspect?: number; durationMs?: number; }` | Options: reduced motion, 3D scene root for framing, viewport aspect, move duration override. |
| `CameraDirector` | 418 | `class CameraDirector` | Owns which mode is driving and whether a move is in flight. The one piece of state that bridges modes. |
| `CameraDirector.controller` | 445 | `get controller(): CameraModeController` | The mode driving the camera (or the flight mode during a move). |
| `CameraDirector.transition` | 450 | `get transition(): ViewpointTransition \| null` | The move in flight, or `null`. |
| `CameraDirector.moving` | 455 | `get moving(): boolean` | Is a move in flight? |
| `CameraDirector.setReducedMotion` | 460 | `setReducedMotion(reduced: boolean): void` | Turn every move into a cut or back. Wire to media query. |
| `CameraDirector.setAspect` | 465 | `setAspect(aspect: number): void` | Tell it the viewport shape so framing accounts for width & height. |
| `CameraDirector.setRoot` | 470 | `setRoot(root: Object3D \| null): void` | Point it at the scene for `frameObjects`. |
| `CameraDirector.goTo` | 482 | `goTo(destination: Viewpoint, mode?: CameraMode): ViewpointTransition` | Start an eased move to a viewpoint from wherever the camera is now. |
| `CameraDirector.goToPreset` | 505 | `goToPreset(id: CameraPresetId): ViewpointTransition` | Start an eased move to one of the six standard views. |
| `CameraDirector.frameObjects` | 518 | `frameObjects(ids: Iterable<string>): ViewpointTransition \| null` | Frame objects with these ids, keeping the heading in use. Lifts a walker into orbit. |
| `CameraDirector.handleKey` | 541 | `handleKey(code: string): boolean` | Select a view by key (1–6). `false` when key was not one of them. |
| `CameraDirector.interrupt` | 557 | `interrupt(): void` | Stop a move where it has got to and hand the camera back immediately. Safe to call when nothing is moving. |
| `CameraDirector.update` | 568 | `update(dtSeconds: number): boolean` | Advance the move (if running) or the controller. Returns whether anything moved. |
| `CameraDirector.viewpoint()` | 584 | `viewpoint(): Viewpoint` | The camera's current viewpoint. |
| `CameraDirector.pose()` | 588 | `pose(): CameraPose` | The camera's current pose. |
| `CameraDirector.applyTo()` | 592 | `applyTo(camera, aspect): void` | Write the current pose onto a three camera with projection. |

---

## camera/frameObjects.ts — Framing a selection to fill the screen

**File**: `src/lib/three/camera/frameObjects.ts`

| Name | Line | Signature | Description |
|------|------|-----------|-------------|
| `ViewBasis` | 68 | `interface { forward: Vector3; right: Vector3; up: Vector3; }` | Camera's own axes at a heading & vertical angle. |
| `FrameOptions` | 78 | `interface { azimuthRad: number; polarRad: number; aspect: number; paddingFraction: number; clearanceMarginM: number; avoid?: Box3; orthographic?: boolean; }` | Everything `frameViewpoint` needs: angles, viewport ratio, margin (15%), clearance, optional avoid-box, orthographic flag. |
| `boxOfExtent` | 108 | `function boxOfExtent(extent: BuildingExtent): Box3` | The box a building extent describes. Pure. |
| `unionBounds` | 120 | `function unionBounds(boxes: readonly Box3[]): Box3 \| null` | Smallest box containing all of them. `null` when none. |
| `viewBasis` | 146 | `function viewBasis(azimuthRad: number, polarRad: number): ViewBasis` | Camera's axes at this heading & angle. Derived from spherical coords. |
| `boxExitDistance` | 164 | `function boxExitDistance(box: Box3, origin: Vector3, direction: Vector3): number` | How far along a ray the box is finally behind you (metres). Zero if ray never meets box. |
| `frameViewpoint` | 203 | `function frameViewpoint(box: Box3, options: FrameOptions): Viewpoint` | Where to stand to see a box with padding left empty. Camera never ends up inside solids. |
| `boundsOfIds` | 280 | `function boundsOfIds(root: Object3D, ids: Iterable<string>): Box3 \| null` | The box around every tagged object carrying one of these ids. Only function that walks the scene. |
| `frameObjects` | 303 | `function frameObjects(root: Object3D, ids: Iterable<string>, options: FrameOptions): Viewpoint \| null` | Frame the objects with these ids: the whole job in one call. `null` when nothing found. |

---

## camera/collision.ts — Walk through without crossing walls

**File**: `src/lib/three/camera/collision.ts`

### Settings & Types

| Name | Line | Type | Description |
|------|------|------|-------------|
| `WALK_COLLISION_SETTINGS` | 144 | `WalkCollisionSettings` | Every number the walk collision is made of (frozen). `bodyRadiusM: 0.3`, `headClearanceM: 0.1`, `stepOverM: 0.2`, `skinM: 0.001`, `resolveIterations: 4`, `gridCellM: 2`, `maxGridAxisCells: 256`, `maxTravelRadii: 256`. |
| `WalkCollisionSettings` | 84 | `interface` | Configuration for walk-mode collision detection. |
| `walkerHeightM` | 162 | `function walkerHeightM(settings?: WalkCollisionSettings): number` | How tall the walker is (eye height + crown). Derived from `CAMERA_SETTINGS`. |
| `PlanPointM` | 177 | `interface { xM: number; zM: number; }` | A point on the floor of the scene in metres. Plan view from above. |
| `WallSolid` | 194 | `interface { wallId: WallId; start: PlanPointM; end: PlanPointM; halfThicknessM: number; baseM: number; topM: number; }` | One unbroken stretch of wall the collision sees. Doors are removed from geometry. |
| `Storey` | 205 | `interface { levelId: LevelId; floorElevationM: number; }` | One storey as the walker needs to see it. |
| `Stairway` | 222 | `interface { id: string; lowerLevelId: LevelId; upperLevelId: LevelId; lowerEnd: PlanPointM; upperEnd: PlanPointM; halfWidthM: number; }` | A flight of stairs as a line on the plan between two storeys. |
| `WalkGround` | 236 | `interface { storeys: readonly Storey[]; stairs: readonly Stairway[]; }` | The storeys and flights joining them. |
| `GroundState` | 248 | `interface { levelId: LevelId; floorElevationM: number; stairId: string \| null; stairProgress: number; }` | Which storey the walker is on, floor height, and flight progress if climbing. |
| `WalkStep` | 259 | `interface { position: PlanPointM; ground: GroundState; blockedM: number; changedLevel: boolean; }` | What one move came to: position, ground state, how much a wall blocked, whether storey changed. |
| `WalkStart` | 270 | `interface { position: PlanPointM; levelId: LevelId; }` | Where a walk starts. |
| `BarrierOptions` | 276 | `interface { openDoorIds?: ReadonlySet<OpeningId>; settings?: WalkCollisionSettings; }` | Which door leaves are open; optional custom collision settings. |
| `planPointOf` | 302 | `function planPointOf(position: Vector3): PlanPointM` | A plan point from a scene position, dropping height. |
| `walkEyePosition` | 307 | `function walkEyePosition(step: WalkStep): Vector3` | Where the walker's eye sits for a caller writing it onto a camera. |

### Barrier — Wall collision geometry

| Name | Line | Signature | Description |
|------|------|-----------|-------------|
| `WallBarrier` | 516 | `class WallBarrier` | Every solid stretch of wall in the building. Immutable; rebuild when plan changes. |
| `WallBarrier.solids` | 517 | `readonly WallSolid[]` | The solid stretches. |
| `WallBarrier.settings` | 518 | `WalkCollisionSettings` | The settings used. |
| `WallBarrier.nearbySolids` | 539 | `nearbySolids(from: PlanPointM, to: PlanPointM, footElevationM: number): readonly WallSolid[]` | The solids a move could possibly touch. For testing the broad phase. |
| `WallBarrier.blocked` | 561 | `blocked(at: PlanPointM, footElevationM: number): boolean` | Is the walker's body inside a wall at this spot? |
| `WallBarrier.slide` | 594 | `slide(from: PlanPointM, to: PlanPointM, footElevationM: number): PlanPointM` | Move towards a spot, stopping at whatever is in the way. Slides along walls. |
| `buildWallBarrier` | 794 | `function buildWallBarrier(walls: readonly Wall[], openings: readonly Opening[], options?: BarrierOptions): WallBarrier` | Turn a plan into the thing the walker bumps into. Run once per plan. |

### Navigator — Following the floor & stairs

| Name | Line | Signature | Description |
|------|------|-----------|-------------|
| `stairProgressAt` | 871 | `function stairProgressAt(stair: Stairway, at: PlanPointM): number \| null` | How far up a flight the walker is (0–1), or `null` if off the flight. |
| `WalkNavigator` | 918 | `class WalkNavigator` | Walking a building floor by floor. Owns position and ground state. No camera. |
| `WalkNavigator.barrier` | 919 | `WallBarrier` | The barrier this navigator uses. |
| `WalkNavigator.position` | 946 | `get position(): PlanPointM` | Where the walker is on the plan. |
| `WalkNavigator.ground` | 951 | `get ground(): GroundState` | Which storey they are on and how high the floor is. |
| `WalkNavigator.eyeElevationM` | 956 | `get eyeElevationM(): number` | Where the eye sits in metres above datum. |
| `WalkNavigator.moveTo` | 967 | `moveTo(desired: PlanPointM): WalkStep` | Try to walk to a spot. Walls have their say; floor is read where reached. |
| `WalkNavigator.teleportTo` | 993 | `teleportTo(at: PlanPointM, levelId: LevelId): WalkStep` | Put the walker down somewhere else outright, storey included. Wall pushes clear. |

---

## camera/viewpointCodec.ts — Viewpoints as URL-safe codes

**File**: `src/lib/three/camera/viewpointCodec.ts`

| Name | Line | Signature | Description |
|------|------|-----------|-------------|
| `SharedViewpoint` | 89 | `interface extends Viewpoint { mode: CameraMode; levelId: LevelId; coloring: ColoringModeId; }` | A camera plus the three screen things a colleague has to arrive in. |
| `VIEWPOINT_CODE_VERSION` | 103 | `'1'` | Version character every code starts with. |
| `MAX_VIEWPOINT_CODE_LENGTH` | 106 | `120` | The longest code this module will produce or accept (characters). |
| `MAX_LEVEL_CODE_LENGTH` | 109 | `12` | The longest storey code (`L-` plus up to 12 more). |
| `CODE_BYTES_WITHOUT_LEVEL` | 131 | `22` | Bytes of payload before storey code and checksum. |
| `ViewpointCodeProblem` | 200 | `type` | Why a code could not be read: `'empty' \| 'tooLong' \| 'version' \| 'alphabet' \| 'truncated' \| 'checksum' \| 'field'`. |
| `VIEWPOINT_CODE_PROBLEM_LABELS` | 222 | `Record<ViewpointCodeProblem, string>` | Vietnamese sentence for each problem (for display). |
| `ViewpointDecodeResult` | 233 | `type` | Either `{ ok: true; viewpoint: SharedViewpoint }` or `{ ok: false; problem; message }`. |
| `isEncodableLevelId` | 458 | `function isEncodableLevelId(levelId: string): boolean` | Can this storey be named in a link? (Must be `L-` + alphanumeric/_/-.) |
| `quantiseViewpoint` | 413 | `function quantiseViewpoint(shared: SharedViewpoint): SharedViewpoint` | The view a code really carries after quantisation loss (mm & 1/200°). |
| `encodeViewpoint` | 482 | `function encodeViewpoint(shared: SharedViewpoint): string` | Pack a viewpoint into a code to paste into a link. Throws RangeError on invalid input. |
| `decodeViewpoint` | 535 | `function decodeViewpoint(code: unknown): ViewpointDecodeResult` | Read a code back or say why it cannot be read. Never throws. |

---

## interaction/raycast.ts — Pointer, metered

**File**: `src/lib/three/interaction/raycast.ts`

### Constants

| Name | Line | Value | Description |
|------|------|-------|-------------|
| `MAX_RAYCASTS_PER_SECOND` | 69 | `30` | Ceiling on hover casts. 30/sec is rate a highlight stops lagging. |
| `MIN_RAYCAST_INTERVAL_MS` | 82 | `Math.ceil(1000 / 30)` = `34` (ms) | Shortest gap between hover casts, rounded up to avoid floating-point edge case. |
| `CLICK_SLOP_PX` | 91 | `4` (pixels) | How far pointer may travel press→release and still be a click. Exclusive threshold. |

### Types & Interfaces

| Name | Line | Signature | Description |
|------|------|-----------|-------------|
| `PointerPosition` | 98 | `interface { x: number; y: number; }` | A point on the canvas in CSS pixels from top-left. |
| `ViewportSize` | 104 | `interface { width: number; height: number; }` | The size of the canvas in pixels. |
| `PointerInput` | 110 | `interface PointerPosition { additive?: boolean; }` | One pointer event reduced to what a pick needs. Additive flag carried through. |
| `PickEvent` | 121 | `type` | Union of `{ type: 'hover'; hit: EntityHit \| null; pointer: PointerPosition; }` or `{ type: 'pick'; hit; pointer; additive: boolean; }`. |
| `PickListener` | 137 | `(event: PickEvent) => void` | Callback for pick events. |
| `PickAt` | 140 | `(pointer: PointerPosition) => EntityHit \| null` | Function that answers "what is under this canvas point?". |
| `TimerHandle` | 142 | `number` | Opaque timer handle from `PickerTimers`. |
| `PickerTimers` | 150 | `interface { setTimeout(...); clearTimeout(...); }` | Port through which a cast is deferred. Timers, not frames. |
| `defaultTimers` | 156 | `PickerTimers` | The host's timers (real `setTimeout`/`clearTimeout`). |
| `ScenePickOptions` | 168 | `interface { camera: Camera; root: Object3D; viewport: () => ViewportSize; merge?: () => MergeResult \| null; layers?: () => LayerStates; raycaster?: Raycaster; }` | What `createScenePick` needs. |
| `toNormalizedDevice` | 201 | `function toNormalizedDevice(pointer: PointerPosition, viewport: ViewportSize): Vector2` | Canvas pixels to NDC: `(-1, -1)` bottom-left, `(1, 1)` top-right. |
| `createScenePick` | 217 | `function createScenePick(options: ScenePickOptions): PickAt` | The usual cast: ray from camera through pixel, resolved against range table. |
| `PointerPickerOptions` | 247 | `interface { pick: PickAt; onEvent: PickListener; now?: () => number; timers?: PickerTimers; minIntervalMs?: number; clickSlopPx?: number; }` | Options for picker: pick function, event callback, clock, timers, metering params. |
| `PointerPicker` | 269 | `interface { pointerDown(input): void; pointerMove(input): void; pointerUp(input): void; pointerLeave(input): void; dispose(): void; }` | Four event handlers plus teardown. Wire canvas straight to it. |
| `createPointerPicker` | 298 | `function createPointerPicker(options: PointerPickerOptions): PointerPicker` | The pointer half of picking. Four handlers + deferred casting. |

---

## interaction/hitTest.ts — Turning rays into entities

**File**: `src/lib/three/interaction/hitTest.ts`

| Name | Line | Signature | Description |
|------|------|-----------|-------------|
| `RayIntersection` | 61 | `interface HitLike { distance: number; point: Vector3; }` | One crossing of the ray, in shape three.js `Raycaster` hands back (structural). |
| `EntityHit` | 76 | `interface { entityId: BuildEntityId; kind: SelectableKind; levelId: LevelId; point: Vector3; distance: number; object: Object3D; }` | What the pointer is over: model entity id, layer kind, storey, touch point, distance. |
| `HitTestOptions` | 91 | `interface { merge?: MergeResult \| null; layers?: LayerStates; }` | Range table for batched scene; layer visibility/lock state. |
| `isPickableKind` | 116 | `function isPickableKind(kind: SelectableKind \| null, layers: LayerStates): boolean` | May something of this layer be picked right now? (visible & unlocked) |
| `resolveHit` | 167 | `function resolveHit(intersection: RayIntersection, options?: HitTestOptions): EntityHit \| null` | The entity one crossing stands for, or `null`. Filters for eligible layers. |
| `firstEntityHit` | 202 | `function firstEntityHit(intersections: readonly RayIntersection[], options?: HitTestOptions): EntityHit \| null` | Nearest entity the ray met that may be picked. Walks list in order (nearest first). |

---

## tools/toolMachine.ts — The one lifecycle every canvas tool runs on

**File**: `src/lib/tools/toolMachine.ts`

### Types

| Name | Line | Type | Description |
|------|------|------|-------------|
| `ToolId` | 84 | `'select' \| 'pan' \| 'drawWall' \| 'placeOpening' \| 'placeFurniture' \| 'measure' \| 'splitWall' \| 'annotate'` | The eight tools of the toolbar. |
| `TOOL_IDS` | 95 | `const array` | Every tool in order: select, pan, drawWall, placeOpening, placeFurniture, measure, splitWall, annotate. |
| `ToolPhase` | 111 | `'ready' \| 'drawing' \| 'confirming'` | Where a gesture is in its lifecycle. |
| `TOOL_PHASES` | 114 | `const array` | The phases in the only order visited: ready, drawing, confirming. |
| `TOOL_PHASE_LABELS` | 122 | `Record<ToolPhase, string>` | Vietnamese label for each phase: sẵn sàng, đang vẽ, xác nhận. |
| `ToolStepKind` | 133 | `'point' \| 'entity' \| 'drag' \| 'text'` | Kinds of input a step can ask for. |
| `ToolStep` | 136 | `interface { kind: ToolStepKind; hint: string; }` | One thing a tool needs: input kind + Vietnamese prompt. |
| `ToolInputValue` | 149 | `type` | One filled-in step, tagged: point with location, entity with id, drag with offset, text with string. |
| `ToolPreview` | 168 | `type` | The ghost the draft layer draws: highlight, pan, wall/opening/furniture ghosts, tape, cut marker, note. |
| `ToolCommandRequest` | 215 | `type` | A business command a tool asks for by type & input. Road from toolbar to data. |
| `PendingNote` | 222 | `interface { entityId: EntityId; body: string; }` | A note a person wrote against an entity. |
| `ToolOutcome` | 236 | `type` | What a finished gesture hands back: command, selection, viewport pan, measurement, note. |
| `ToolSettings` | 254 | `interface` | The sizes a tool draws with: wall thickness/height/kind, opening kind/size/sill/swing, furniture kind/size/rotation. |
| `DEFAULT_TOOL_SETTINGS` | 270 | `ToolSettings` | Defaults: 110mm walls, 2800mm height, partition; 900×2200mm door, 0mm sill, left swing; 1200×700mm table, 0°. |
| `ToolContext` | 292 | `interface { levelId: LevelId; settings: ToolSettings; nextId: <K>(kind: K) => IdByKind[K]; }` | Everything a tool reads: storey, sizes, id minter. |

---

## tools/shortcuts.ts — The keyboard, declared once

**File**: `src/lib/tools/shortcuts.ts`

### Key Bindings

| Name | Line | Binding | Vietnamese Name | Description |
|------|------|---------|-----------------|-------------|
| `TOOL_SHORTCUTS` | 81 | Object | công cụ | Eight tool keys (V, H, W, D, F, M, X, G): select, pan, drawWall, placeOpening, placeFurniture, measure, splitWall, annotate. |
| `RESERVED_KEYS` | 66 | `['ESCAPE', 'ENTER', 'TAB']` | — | Keys no binding may take (Esc closes, Enter confirms, Tab navigates). |

### Modifiers (Held, Not Toggled)

| Name | Line | Code | Label | Description |
|------|------|------|-------|-------------|
| `MODIFIER_SHORTCUTS` | 124 | Array | phím bổ trợ | Three held modifiers: Shift (lock axis), Alt (suspend snap), Space (pan override). |

### Functions

| Name | Line | Signature | Description |
|------|------|-----------|-------------|
| `normaliseKey` | 49 | `function normaliseKey(key: string): ShortcutCode` | Upper-case raw `KeyboardEvent.key`. Space → `SPACE`. |
| `isTextEntryTarget` | 200 | `function isTextEntryTarget(target: ShortcutTarget \| null): boolean` | Is somebody typing in an input, textarea, select, or contenteditable? |
| `resolveKeyDown` | 246 | `function resolveKeyDown(input: ShortcutInput, target: ShortcutTarget \| null): ShortcutAction \| null` | What a key press meant: activate tool, hold modifier, or `null`. Refuses repeat, focus-in-field, Ctrl/Cmd chords, Alt+letter. |
| `resolveKeyUp` | 283 | `function resolveKeyUp(input: ShortcutInput): ShortcutAction \| null` | What letting a key go meant: release modifier or `null`. Blind to focus. |
| `shortcutForTool` | 162 | `function shortcutForTool(tool: ToolId): ShortcutCode` | The key that reaches a tool. |
| `toolForShortcut` | 165 | `function toolForShortcut(code: ShortcutCode): ToolId \| null` | The tool a key reaches, or `null`. |
| `modifierForShortcut` | 169 | `function modifierForShortcut(code: ShortcutCode): ModifierShortcut \| null` | The modifier a key holds, or `null`. |

---

## input/shortcutRegistry.ts — The arbiter every shortcut answers to

**File**: `src/lib/input/shortcutRegistry.ts`

### Global Shortcuts (Six total)

Built with `buildGlobalShortcuts(handlers)`:

1. **Ctrl+Z**: `undo()` — Undo the operation nearest
2. **Ctrl+Shift+Z**: `redo()` — Redo just-undone operation
3. **Ctrl+S**: `save()` — Save now instead of waiting for autosave
4. **Ctrl+F**: `openSearch()` — Open project search
5. **?**: `openShortcutHelp()` — Open shortcut help screen
6. **Escape**: `closeTopLayer()` — Close top layer (modal or modeless)

### Types & Functions

| Name | Line | Signature | Description |
|------|------|-----------|-------------|
| `ShortcutScope` | 53 | `'dialog' \| 'sidePanel' \| 'canvas' \| 'global'` | Four floors a binding can live on. Dialog is modal. |
| `SCOPE_PRIORITY` | 59 | `const array` | Resolution order: dialog, sidePanel, canvas, global. Dialog answers first. |
| `ParsedCombo` | 82 | `interface { code: ShortcutCode; mod: boolean; alt: boolean; shift: boolean; }` | A combo taken apart. `mod` matches Ctrl *or* Cmd. |
| `parseCombo` | 110 | `function parseCombo(combo: string): ParsedCombo` | Read a combo like `'Ctrl+Shift+Z'`, `'?'`, `'Escape'`. Throws on malformed. |
| `formatCombo` | 160 | `function formatCombo(parsed: ParsedCombo): string` | Print a parsed combo back as `'Mod+Shift+Z'`, `'?'`. |
| `ShortcutKeyEvent` | 188 | `interface` | A key press as much as registry reads. Real `KeyboardEvent` satisfies it. |
| `ShortcutDefinition` | 200 | `interface { id: string; combo: string; scope: ShortcutScope; description?: string; allowRepeat?: boolean; preventDefault?: boolean; onTrigger(event): void; }` | One binding declared by owning component. |
| `ShortcutOverlap` | 220 | `interface { scope: ShortcutScope; combo: string; registrantIds: readonly string[]; }` | One key two registrants both want. |
| `ShortcutRegistry` | 236 | `interface` | Registers & arbitrates shortcuts. One listener. Upper floor answers first. |
| `createShortcutRegistry` | 354 | `function createShortcutRegistry(options?: ShortcutRegistryOptions): ShortcutRegistry` | Create a registry. Options: `isDev`, `warn`. |
| `buildGlobalShortcuts` | 585 | `function buildGlobalShortcuts(handlers: GlobalShortcutHandlers): readonly ShortcutDefinition[]` | Six global bindings: Ctrl+Z/Ctrl+Shift+Z/Ctrl+S/Ctrl+F/?/Escape. |
| `registerGlobalShortcuts` | 651 | `function registerGlobalShortcuts(registry: ShortcutRegistry, handlers: GlobalShortcutHandlers): () => void` | Register the whole global group; returned function removes all. |
| `appShortcutRegistry` | 676 | `ShortcutRegistry` | The one registry the application shares. Attached to `window` once. |

---

## ViewerShell Shortcuts (Viewer3D-specific)

**File**: `src/screens/viewer/ViewerShell/viewerShellShortcuts.ts`

| Name | Combo | Canvas/Global | Description |
|------|-------|----------------|-------------|
| `STOREY_COMBOS` | 1, 2, 3, 4 | canvas | Select storey (0 is lowest) |
| `FIT_ALL_COMBO` | 0 | canvas | Fit whole model in frame |
| `ORTHOGRAPHIC_COMBO` | O | canvas | Toggle orthographic projection |
| `HIDE_COMBO` | Shift+H | canvas | Hide selected object |
| `ISOLATE_COMBO` | Alt+H | canvas | Show only selected object |
| `FRAME_COMBO` | F | canvas | Frame selected object in view |
| `SEPARATION_COMBO` | E | canvas | Toggle storey separation |
| `MEASURE_COMBO` | M | canvas | Activate measure tool (also tool key) |
| `SEARCH_COMBO` | / | canvas | Open entity search |
| `DESELECT_COMBO` | Escape | canvas (conditional) | Deselect (only registered when something is selected) |

**Section Plane** (file: `viewerSectionPlane.ts`):
- `ViewerSectionAxis`: `'horizontal' \| 'longitudinal' \| 'transverse'` — Three cut axes
- `DEFAULT_SECTION_AXIS`: `'horizontal'` — Default
- `DEFAULT_SECTION_POSITION`: `0.5` — Middle of bounding box
- `MIN_SECTION_POSITION`: `0`, `MAX_SECTION_POSITION`: `1` — Range [0, 1]
- `clampSectionPosition(value)` — Clamp position to valid range

---

## tools/tools.ts — Tool registry

**File**: `src/lib/tools/tools.ts`

| Name | Line | Signature | Description |
|------|------|-----------|-------------|
| `TOOLS` | 531 | `ToolRegistry` | Map of all eight tools: select, pan, drawWall, placeOpening, placeFurniture, measure, splitWall, annotate. |
| `toolById` | 543 | `function toolById(id: ToolId): ToolDefinition` | Get the definition of a tool by id. |

---

## tools/shortcutTable.ts — Help screen bindings

**File**: `src/lib/tools/shortcutTable.ts`

| Name | Line | Signature | Description |
|------|------|-----------|-------------|
| `ShortcutSectionId` | 34 | `'tools' \| 'modifiers'` | Section of the shortcut help table. |
| `SHORTCUT_SECTION_LABELS` | 42 | `Record<ShortcutSectionId, string>` | Vietnamese labels for sections: công cụ, phím bổ trợ. |
| `ShortcutSubject` | 48 | `type` | What a shortcut row describes: tool or modifier. |
| `ShortcutRow` | 53 | `interface { subject: ShortcutSubject; keys: readonly string[]; label: string; description: string; }` | One row in the help table. |
| `ShortcutSection` | 68 | `interface { id: ShortcutSectionId; rows: readonly ShortcutRow[]; }` | A section with its rows. |
| `buildShortcutTable` | 100 | `function buildShortcutTable(tools: ToolRegistry = TOOLS): readonly ShortcutSection[]` | Build the complete help table from tool definitions. |
| `SHORTCUT_TABLE` | 123 | `readonly ShortcutSection[]` | The prebuilt table used by the help screen. |
| `shortcutRows` | 130 | `function shortcutRows(sections: readonly ShortcutSection[]): readonly ShortcutRow[]` | Flatten sections into rows. |
| `shortcutRowFor` | 135 | `function shortcutRowFor(sections: readonly ShortcutSection[], subject: ShortcutSubject): ShortcutRow \| null` | Find a row by subject. |

---

## Five Questions Answered

**Question 1:** Đổi giữa bốn chế độ camera thì `Viewpoint` bàn giao qua hàm nào? Có hàm nào làm sẵn việc "giữ nguyên chỗ đang nhìn khi đổi chế độ" không?

**Answer:** 
- Function: `switchCameraMode` at `modes.ts:1020`
- Signature: `function switchCameraMode(current: CameraModeController, next: CameraMode, context: CameraModeContext): CameraModeController`
- Guarantee: The `target` (point being looked at) does not move between modes; only the camera's position and orientation shift to accommodate the new mode's constraints.

---

**Question 2:** "Khuôn vào đối tượng đang chọn" (R-07) gọi hàm nào, nhận gì, trả gì?

**Answer:**
- Function: `CameraDirector.frameObjects` at `presets.ts:518`
- Receives: `ids: Iterable<string>` — entity IDs to frame
- Returns: `ViewpointTransition | null` — the animated move, or `null` if no objects found
- Implementation path: calls `frameObjects` from `frameObjects.ts:303` to compute the viewpoint, then animates there via `goTo`

---

**Question 3:** Bắn tia từ toạ độ pixel của canvas ra `EntityId` đi qua đúng những hàm nào, theo thứ tự nào? Ai chịu trách nhiệm lọc theo tầng đang hiện?

**Answer:**
Full pipeline from pixel to entity:
1. `createPointerPicker` (raycast.ts:298) — sets up pointer event handlers
2. `createScenePick` (raycast.ts:217) — creates the ray-casting function
3. `toNormalizedDevice` (raycast.ts:201) — converts canvas pixels to NDC (normalized device coordinates)
4. Ray cast via three.js `Raycaster` against the scene
5. `resolveHit` (hitTest.ts:167) — converts `Raycaster` intersection to `EntityHit`, **filters by layer visibility/lock**
6. `isPickableKind` (hitTest.ts:116) — helper that checks if a layer's kind is visible & unlocked
7. `firstEntityHit` (hitTest.ts:202) — finds the nearest hit from the list

Layer filtering responsibility: **`resolveHit` and `isPickableKind`** in `hitTest.ts`

---

**Question 4:** `toolMachine` có trạng thái nào ứng với "đang kéo mặt phẳng cắt" và "đang chọn" không? Màn nối vào bằng API nào?

**Answer:**
- `ToolPhase` (toolMachine.ts:111): `'ready' | 'drawing' | 'confirming'`
- Selectable states: `'ready'` (idle), `'drawing'` (gesture in flight), `'confirming'` (awaiting user confirmation)
- Select tool: `'select'` in `ToolId` (toolMachine.ts:84)
- **Cutting/section plane state**: **NOT FOUND** — no distinct tool state for dragging a cut plane. The ViewerShell has `viewerSectionPlane.ts` for section management but it is separate from `ToolPhase`.
- Integration API: Screen reads `phase` from the tool machine to drive UI and preview rendering.

---

**Question 5:** Đăng ký phím tắt cho một màn thì gọi gì? Huỷ đăng ký lúc rời màn thì gọi gì?

**Answer:**
- Register: `ShortcutRegistry.register(definition)` at `shortcutRegistry.ts:238`
- Signature: `register(definition: ShortcutDefinition): () => void`
- Returns: A dispose function `() => void` that removes the binding
- Unregister: Call the returned dispose function when the screen unmounts
- Pattern: `useEffect` in the screen calls `register`, captures the disposer, calls it in cleanup

Example flow:
```typescript
const dispose = registry.register({ id: '...', combo: '...', scope: 'canvas', onTrigger: ... });
return () => { dispose(); }; // in useEffect cleanup
```

---

## Known Pitfalls

| Pitfall | Impact | Mitigation |
|---------|--------|-----------|
| **Angles: radians vs. degrees** | Camera methods use radians internally; `CAMERA_SETTINGS` uses degrees. Mix them and the camera spins unexpectedly. | `degreesToRadians()` is called once at the top of `modes.ts`. Settings always convert; never use raw degree values in mode implementations. |
| **Distance units: metres** | All scene units are metres (per `build/scene.ts`). Eye heights, collision radii, zoom limits are all in metres. | Always scale from plan millimetres to metres before creating an extent or limits. |
| **Viewpoint handover** | `switchCameraMode` guarantees the target doesn't move, but **does not promise the heading or distance stay unchanged**. | Accept that orbit and flat modes recompute heading and distance from the same target; don't expect them to match. |
| **Walk mode floor elevation** | `CameraModeContext.floorElevationM` is optional; defaults to the bottom of the extent. An empty building has a huge negative floor. | Always provide `floorElevationM` when building walk mode, or lock the walker into one storey. |
| **Orthographic half-height** | `CameraPose.orthographicHalfHeightM` is null for perspective modes and non-null for flat modes. Forgetting to check null breaks projection. | Always check: `pose.orthographicHalfHeightM !== null` before using it as an ortho camera parameter. |
| **Raycast metering** | `MAX_RAYCASTS_PER_SECOND` is 30 Hz. Hover casts are debounced; click still happens immediately. Over-frequent manual casts waste GPU. | Use `createPointerPicker` to handle debouncing automatically; don't cast on every mouse move. |
| **Hit test filtering** | `resolveHit` filters by layer visibility but **returns the nearest hit first**. If multiple entities overlap, only the closest is returned. | Caller must walk the intersection list with `firstEntityHit` if layering matters more than distance. |
| **Tool phase transitions** | A tool moves `ready` → `drawing` → `confirming` → `ready`. Skipping a phase breaks the invariant. | Never write to `phase` directly; let the tool machine drive it through `update()` and user input. |
| **Shortcut registry scope** | Scopes are resolved `dialog` → `sidePanel` → `canvas` → `global`, first answer wins. A canvas binding shadows the global one. | Plan key bindings by scope; don't assume global shortcuts work when canvas shortcuts are registered. |
| **Pointer picker disposal** | `PointerPicker` holds timers. Calling `dispose()` is essential to prevent memory leaks and dangling timer refs. | Always capture the disposer from `createPointerPicker` and call it in `useEffect` cleanup. |

---

## Question (a): Clipping Planes

**Search command result**: `rg -n "clippingPlanes|localClipping|new Plane\(" src`

**Answer**: **NOT FOUND** — No clipping planes implementation exists in the current codebase.

**ViewerShell status**: The merged ViewerShell does have `src/screens/viewer/ViewerShell/viewerSectionPlane.ts`, which exports section plane management (`ViewerSectionAxis`, `DEFAULT_SECTION_AXIS`, `clampSectionPosition`, etc.), but this is **not a clipping plane** — it is a section plane tool for cutting drawings. It stores only four numbers (plane equation in three.js convention), not three.js `Plane` objects.

---

## Question (b): Keys Already Occupied

All keyboard bindings currently defined:

### Tool Keys (canvas scope)
| Key | Tool | File |
|-----|------|------|
| V | select | shortcuts.ts:82 |
| H | pan | shortcuts.ts:83 |
| W | drawWall | shortcuts.ts:84 |
| D | placeOpening | shortcuts.ts:85 |
| F | placeFurniture | shortcuts.ts:86 |
| M | measure | shortcuts.ts:87 |
| X | splitWall | shortcuts.ts:88 |
| G | annotate | shortcuts.ts:89 |

### ViewerShell Canvas Shortcuts
| Key/Combo | Function | File |
|-----------|----------|------|
| 1 | selectStorey(0) | viewerShellShortcuts.ts:44 |
| 2 | selectStorey(1) | viewerShellShortcuts.ts:44 |
| 3 | selectStorey(2) | viewerShellShortcuts.ts:44 |
| 4 | selectStorey(3) | viewerShellShortcuts.ts:44 |
| 0 | fitAll | viewerShellShortcuts.ts:47 |
| O | toggleOrthographic | viewerShellShortcuts.ts:50 |
| Shift+H | hideSelection | viewerShellShortcuts.ts:53 |
| Alt+H | isolateSelection | viewerShellShortcuts.ts:56 |
| F | frameSelection | viewerShellShortcuts.ts:59 |
| E | toggleSeparation | viewerShellShortcuts.ts:62 |
| M | activateMeasure | viewerShellShortcuts.ts:65 |
| / | openSearch | viewerShellShortcuts.ts:68 |
| Escape | clearSelection (conditional) | viewerShellShortcuts.ts:71 |

### Global Shortcuts (global scope)
| Key/Combo | Function | File |
|-----------|----------|------|
| Ctrl+Z | undo | shortcutRegistry.ts:590 |
| Ctrl+Shift+Z | redo | shortcutRegistry.ts:600 |
| Ctrl+S | save | shortcutRegistry.ts:610 |
| Ctrl+F | openSearch | shortcutRegistry.ts:619 |
| ? | openShortcutHelp | shortcutRegistry.ts:628 |
| Escape | closeTopLayer | shortcutRegistry.ts:637 |

### Reserved Keys (cannot be bound)
| Key | Reason |
|-----|--------|
| Escape | Closes top layer (A12 invariant) |
| Enter | Confirms (A12 invariant) |
| Tab | Keyboard navigation (A12 invariant) |

### Camera Preset Keys (not yet registered — available in modes.ts only)
| Key/Combo | Preset | File |
|-----------|--------|------|
| Digit1, Numpad1 | top | presets.ts:147 |
| Digit2, Numpad2 | front | presets.ts:154 |
| Digit3, Numpad3 | back | presets.ts:161 |
| Digit4, Numpad4 | left | presets.ts:168 |
| Digit5, Numpad5 | right | presets.ts:175 |
| Digit6, Numpad6 | perspective | presets.ts:182 |

### Key Conflicts to Avoid
- **F** is occupied by both `placeFurniture` tool (tools) and `frameSelection` (viewer). Will need coordination.
- **M** is occupied by both `measure` tool (tools) and `activateMeasure` (viewer). Same scope (canvas), so one must move.
- **Escape** is global, but ViewerShell conditionally registers its own in canvas scope (correct per A12).
- **1–4, 0** are free in canvas scope for ViewerShell storey selection.
- **Digit1–6, Numpad1–6** (camera presets) are declared but not registered anywhere, so they are available.

---

## Summary

- **213 public functions, types, interfaces, and constants** documented across camera, interaction, tools, and input modules.
- **Clipping planes**: NOT FOUND — only section plane feature exists in ViewerShell.
- **Key occupation**: 13 tool/viewer canvas keys, 6 global keys, 4 reserved. Conflicts on F and M in canvas scope.
