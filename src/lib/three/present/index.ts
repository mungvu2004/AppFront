/**
 * `present` — showing a plan as a cutaway 3D floor plan.
 *
 * `../build` makes geometry from a plan and stops, on purpose: no material, no
 * furniture, no camera. This package is the layer on top that a screen calls
 * when it wants a plan to *look like a home*. It is organised as the three
 * things a presentation needs, each its own module and each testable alone:
 *
 * - **Dressing** — `palette`, `textures`, `materials`, `dressing`: every token
 *   the scene reads, the floors drawn from them, and the assignment of a
 *   material to every built part by its role.
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
  type CatalogueEntry,
  type PieceBuilder,
} from './catalogue';
export {
  applyFrustum,
  cameraPosition,
  DEFAULT_CAMERA_RIG,
  fitFrustum,
  headingAt,
  resolveRig,
  restingHeading,
  swayExtents,
  swayPeriodMs,
  type CameraRig,
  type FrameExtents,
} from './director';
export { dressStorey, floorMaterialFor, isGlazed, type DressingPlan, type DressingReport } from './dressing';
export { applyRoomEnvironment, type EnvironmentHandle } from './environment';
export { addCeilingLights, createLighting, type SceneLighting } from './lighting';
export { createMaterials, disposeMaterials, type SceneMaterials, type SurfaceMaterials } from './materials';
export { mountPresentation, type PresentationHandle, type PresentationOptions } from './mount';
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
  FINISHES,
  furnitureCentre,
  furnitureSize,
  isFacing,
  isFinish,
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
export {
  contactShadowFalloff,
  createContactShadowTexture,
  createPlankTexture,
  createTileTexture,
} from './textures';
