/**
 * `present` — showing a plan as a cutaway 3D floor plan.
 *
 * `../build` makes geometry from a plan and stops, on purpose: no material, no
 * furniture, no camera. This package is the layer on top that a screen calls
 * when it wants a plan to *look like a home*. It is organised as the three
 * things a presentation needs, each its own module and each testable alone:
 *
 * - **Dressing** — `palette`, `textures`, `materials`, `dressing`, `joinery`:
 *   every token the scene reads, the floors drawn from them, the assignment of
 *   a material to every built part by its role, and the doors, frames and
 *   rails that make openings legible.
 * - **Furniture** — `catalogue`, `assets`, `placement`: the procedural pieces,
 *   the late-loaded `.glb` models, and the rule that the procedural piece goes
 *   in first and is swapped only when a model arrives whole.
 * - **Direction** — `director`, `lighting`, `environment`: the axonometric rig,
 *   its sway, the framing fitted to that sway, and the lights.
 *
 * `assemble` runs a plan through the first two; `mount` adds the third and a
 * renderer. A screen passes a canvas and a plan, and keeps the handle.
 */

export { assembleHouse, type AssembledHouse, type AssembleOptions } from './assemble';
export {
  createAssetService,
  gltfParser,
  noAssetService,
  platformDownloader,
  type AssetService,
  type AssetServiceOptions,
  type ModelDownloader,
  type ModelParser,
} from './assets';
export {
  buildProceduralPiece,
  CATALOGUE,
  CATALOGUE_VARIANTS,
  isCatalogueVariant,
  LAMP_VARIANTS,
  LIGHT_POOL_KEY,
  type CatalogueEntry,
  type LightPoolSpec,
  type PieceBuilder,
} from './catalogue';
export {
  applyFieldOfView,
  applyFrustum,
  cameraPosition,
  DEFAULT_CAMERA_RIG,
  fitFieldOfView,
  fitFrustum,
  frameAim,
  headingAt,
  headingStep,
  resolveRig,
  restingHeading,
  rimRadius,
  screenForward,
  screenUp,
  swayExtents,
  swayPeriodMs,
  type CameraRig,
  type FrameExtents,
} from './director';
export { dressStorey, floorMaterialFor, isGlazed, type DressingPlan, type DressingReport } from './dressing';
export { applyRoomEnvironment, createStudioScene, disposeStudioScene, type EnvironmentHandle } from './environment';
export { createFrameLoop, LOOP_GATES, MAX_SWAY_FPS, type FrameLoop, type FrameLoopOptions, type LoopGate } from './frameLoop';
export {
  buildFrame,
  buildRailing,
  chooseSwing,
  DOOR_OPEN_RAD,
  fitJoinery,
  isHinged,
  swingDoor,
  turnedAboutY,
  wallRun,
  type JoineryReport,
  type WallRun,
} from './joinery';
export {
  addCeilingLights,
  budgetLights,
  createLighting,
  DEFAULT_LIGHT_BUDGET,
  lightPoolFor,
  lightPoolOf,
  roomArea,
  type LightBudgetReport,
  type SceneLighting,
} from './lighting';
export { createMaterials, disposeMaterials, type SceneMaterials, type SurfaceMaterials } from './materials';
export { concatGeometries, isBatchable, mergeStatic, type MergeReport } from './merge';
export { MAX_PIXEL_RATIO, mountPresentation, type PresentationHandle, type PresentationOptions } from './mount';
export {
  bakeVertexOcclusion,
  boxOcclusion,
  ensureWhiteVertexColors,
  meshOccluders,
  OCCLUSION_REACH,
  occlusionToShade,
  type Occluder,
} from './occlusion';
export {
  documentTokenReader,
  PALETTE_TOKENS,
  readPalette,
  tokenColour,
  type PaletteRole,
  type ScenePalette,
  type TokenReader,
} from './palette';
export {
  contactShadowFor,
  FACING_TURN,
  fitToSize,
  placeFurniture,
  type PieceSource,
  type PlacedPiece,
  type PlacementOptions,
} from './placement';
export {
  FACINGS,
  facingVector,
  FINISHES,
  furnitureCentre,
  furnitureLift,
  furnitureSize,
  isFacing,
  isFinish,
  isPresentationPlan,
  planPoint,
  roomCentre,
  type Facing,
  type Finish,
  type PlanCeilingLights,
  type PlanFurniture,
  type PlanLevel,
  type PlanOpening,
  type PlanRoom,
  type PlanWall,
  type PresentationPlan,
  type ScenePoint,
  type SceneSize,
} from './plan';
export { loadPlan, type PlanLoaderOptions } from './planLoader';
export { watchPresence, type PresenceHandle, type PresenceReporter } from './presence';
export { boardCells, createReliefTexture, gridCells, heightField, normalsFromHeights, RELIEF_PX } from './relief';
export { fitTrim, roomedSides, skirtingRuns, type TrimReport } from './trim';
export {
  contactShadowFalloff,
  createContactShadowTexture,
  createDeckingTexture,
  createEdgeShadeTexture,
  createLightPoolTexture,
  createMosaicTexture,
  createPlankTexture,
  createTileTexture,
  edgeShadeFalloff,
  lightPoolFalloff,
} from './textures';
