/**
 * What a storey is allowed to cost, stated as numbers instead of as an opinion.
 *
 * "The viewer feels slow" is not a defect report anybody can act on. A draw-call
 * count is. This module declares the ceiling a scene has to stay under, and the
 * arithmetic that reads a scene and says which part of the ceiling it went
 * through — nothing more. It renders nothing, owns no timers and holds no state,
 * so a caller can measure in a test as easily as in a running viewer.
 *
 * The ceiling is one constant, {@link SCENE_BUDGET}, and there is deliberately
 * only one. A budget spread over four files is a budget that drifts: somebody
 * raises the triangle cap for a heavy project and the number the tests assert
 * stays where it was, and after that neither number means anything. Every check
 * in this package and every test that names a limit reads it from that object.
 *
 * The four caps are per **scene**, per frame:
 *
 * - **150 draw calls.** A storey batched by `merge.ts` is one call per material,
 *   so 150 leaves room for several storeys, the selection overlay and the grid.
 *   A plan that arrives unbatched is around 110 calls for its walls and slabs
 *   alone, which is the case this cap is meant to catch.
 * - **900.000 triangles.** Roughly a full storey at the `full` rung with
 *   furniture, with the headroom a second visible storey needs.
 * - **40 materials.** Each distinct material is a shader program and a state
 *   change; the colouring modes in `src/lib/coloring` produce one per token, and
 *   forty is well above what any legend needs. Counted by object identity, which
 *   is the only reading that cannot under-report — but a scene the builders have
 *   made and nobody has painted yet carries one of three's default materials per
 *   mesh, so see {@link tokenMaterialKey} before measuring one of those.
 * - **350 MB of graphics memory.** Below what a five-year-old integrated card
 *   will hand out without swapping, which is the machine the product is used on.
 *
 * The two frame-rate floors — 45 on a desktop, 30 on a mobile device — are in the
 * same constant because they are the same promise. They are floors, not caps: a
 * reading *below* them is the breach.
 *
 * Graphics memory is an **estimate**, and says so. WebGL will not report what a
 * driver actually allocated, so {@link measureScene} sums the bytes of the vertex
 * buffers and textures the scene references and adds the usual mipmap third. The
 * number tracks the real one closely enough to catch a scene that doubled, which
 * is the question a budget is asked.
 */

import {
  InstancedMesh,
  Line,
  Mesh,
  Points,
  Texture,
  type BufferAttribute,
  type BufferGeometry,
  type InterleavedBufferAttribute,
  type Material,
  type Object3D,
} from 'three';

import { formatNumber } from '@/lib/format/number';

/* -------------------------------------------------------------------------- */
/* The budget.                                                                 */
/* -------------------------------------------------------------------------- */

/** The least a frame rate may be, per class of machine. */
export interface FrameRateFloors {
  /** Desktop and laptop, where the interface is used for review work. */
  readonly desktop: number;
  /** Phone and tablet, where a site visit reads a plan. */
  readonly mobile: number;
}

/** Everything one scene is allowed to cost. */
export interface SceneBudget {
  /** Draw calls issued for one frame. */
  readonly maxDrawCalls: number;
  /** Triangles submitted for one frame. */
  readonly maxTriangles: number;
  /** Distinct materials the scene references. */
  readonly maxMaterials: number;
  /** Estimated buffer and texture memory, in megabytes. */
  readonly maxGraphicsMemoryMb: number;
  /** The frame rates below which the viewer is considered broken. */
  readonly minFrameRate: FrameRateFloors;
}

/**
 * The one budget. Every limit in this package is read from here.
 *
 * Frozen so a caller cannot raise a cap at runtime and quietly pass a check the
 * repository meant to fail. Raising one of these numbers is an edit to this file
 * and a conversation with a reviewer, which is the point.
 */
export const SCENE_BUDGET: SceneBudget = Object.freeze({
  maxDrawCalls: 150,
  maxTriangles: 900_000,
  maxMaterials: 40,
  maxGraphicsMemoryMb: 350,
  minFrameRate: Object.freeze({ desktop: 45, mobile: 30 }),
});

/** Which machine the frame-rate floor is being judged against. */
export type DeviceProfile = 'desktop' | 'mobile';

/* -------------------------------------------------------------------------- */
/* Readings.                                                                   */
/* -------------------------------------------------------------------------- */

/** What one look at a scene reports. */
export interface SceneReading {
  readonly drawCalls: number;
  readonly triangles: number;
  readonly materials: number;
  /** Estimated, not measured — see the module note. */
  readonly graphicsMemoryMb: number;
}

/**
 * A scene reading, optionally with the frame rate that was achieved while
 * drawing it.
 *
 * The frame rate is optional because a scene can be measured before anything has
 * been rendered — an export path, a test, a build step — and a check that
 * demanded a frame rate there would have to be given a fake one.
 */
export interface BudgetReading extends SceneReading {
  /** Frames per second. Omit when nothing was rendered.*/
  readonly frameRate?: number;
}

/** Which part of the budget a warning is about. */
export type BudgetMetric =
  | 'drawCalls'
  | 'triangles'
  | 'materials'
  | 'graphicsMemory'
  | 'frameRate';

/** One breach of the budget, with the numbers that prove it. */
export interface BudgetWarning {
  readonly metric: BudgetMetric;
  /** What was read. */
  readonly measured: number;
  /** The cap it went over, or the floor it fell under. */
  readonly limit: number;
  /** Vietnamese sentence for the review log. */
  readonly message: string;
}

/* -------------------------------------------------------------------------- */
/* Checking a reading against the budget.                                      */
/* -------------------------------------------------------------------------- */

/** Vietnamese names for the four caps, used in the warning sentences. */
const CAP_NOUNS: Readonly<Record<'drawCalls' | 'triangles' | 'materials' | 'graphicsMemory', string>> =
  {
    drawCalls: 'lệnh vẽ',
    triangles: 'tam giác',
    materials: 'vật liệu',
    graphicsMemory: 'bộ nhớ đồ hoạ',
  };

/** Vietnamese names for the two machine classes. */
const PROFILE_NOUNS: Readonly<Record<DeviceProfile, string>> = {
  desktop: 'máy bàn',
  mobile: 'thiết bị di động',
};

/** Written after the number, for the one metric that has a unit. */
const MEGABYTE_SUFFIX = ' MB';

/**
 * Is this reading over its cap?
 *
 * A reading that is not a finite number counts as over. A counter that comes
 * back `NaN` means the measurement itself broke, and a budget check that stayed
 * silent about it would hide the very thing it exists to surface.
 */
function isOverCap(measured: number, cap: number): boolean {
  return !Number.isFinite(measured) || measured > cap;
}

function capWarning(
  metric: 'drawCalls' | 'triangles' | 'materials' | 'graphicsMemory',
  measured: number,
  limit: number,
  suffix = '',
): BudgetWarning {
  return {
    metric,
    measured,
    limit,
    message:
      `Vượt ngân sách ${CAP_NOUNS[metric]}: ${formatNumber(measured, { maxFractionDigits: 1 })}` +
      `${suffix} so với giới hạn ${formatNumber(limit)}${suffix}.`,
  };
}

function frameRateWarning(measured: number, floor: number, profile: DeviceProfile): BudgetWarning {
  return {
    metric: 'frameRate',
    measured,
    limit: floor,
    message:
      `Khung hình ${formatNumber(measured, { maxFractionDigits: 1 })} dưới mức tối thiểu ` +
      `${formatNumber(floor)} của ${PROFILE_NOUNS[profile]}.`,
  };
}

/**
 * Every part of the budget this reading breached, in a fixed order.
 *
 * One warning per metric at most, so a scene that is over on draw calls alone
 * produces exactly one — a caller can count the list and know how many distinct
 * things are wrong. An empty list means the scene is within budget.
 *
 * Never throws. This runs behind a render loop, where a thrown error takes the
 * viewer down with the measurement, and a monitor that can crash the thing it
 * measures is worse than no monitor.
 */
export function checkBudget(
  reading: BudgetReading,
  profile: DeviceProfile = 'desktop',
): readonly BudgetWarning[] {
  const warnings: BudgetWarning[] = [];

  if (isOverCap(reading.drawCalls, SCENE_BUDGET.maxDrawCalls)) {
    warnings.push(capWarning('drawCalls', reading.drawCalls, SCENE_BUDGET.maxDrawCalls));
  }
  if (isOverCap(reading.triangles, SCENE_BUDGET.maxTriangles)) {
    warnings.push(capWarning('triangles', reading.triangles, SCENE_BUDGET.maxTriangles));
  }
  if (isOverCap(reading.materials, SCENE_BUDGET.maxMaterials)) {
    warnings.push(capWarning('materials', reading.materials, SCENE_BUDGET.maxMaterials));
  }
  if (isOverCap(reading.graphicsMemoryMb, SCENE_BUDGET.maxGraphicsMemoryMb)) {
    warnings.push(
      capWarning(
        'graphicsMemory',
        reading.graphicsMemoryMb,
        SCENE_BUDGET.maxGraphicsMemoryMb,
        MEGABYTE_SUFFIX,
      ),
    );
  }

  const frameRate = reading.frameRate;
  if (frameRate !== undefined) {
    const floor = SCENE_BUDGET.minFrameRate[profile];
    if (!Number.isFinite(frameRate) || frameRate < floor) {
      warnings.push(frameRateWarning(frameRate, floor, profile));
    }
  }

  return warnings;
}

/** Did this reading stay inside every limit? */
export function isWithinBudget(reading: BudgetReading, profile: DeviceProfile = 'desktop'): boolean {
  return checkBudget(reading, profile).length === 0;
}

/**
 * Which frame-rate floor applies to the machine this is running on.
 *
 * A coarse pointer with touch points behind it is a phone or a tablet; anything
 * else is judged as a desktop, which is the stricter of the two floors. Outside a
 * browser — a unit test, a build step — the answer is `desktop` for the same
 * reason: guessing the lenient floor would let a regression through.
 */
export function detectDeviceProfile(): DeviceProfile {
  if (typeof navigator === 'undefined' || typeof matchMedia !== 'function') {
    return 'desktop';
  }
  return matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0
    ? 'mobile'
    : 'desktop';
}

/* -------------------------------------------------------------------------- */
/* Measuring a scene.                                                          */
/* -------------------------------------------------------------------------- */

/** Three vertices to a triangle, everywhere. */
const VERTICES_PER_TRIANGLE = 3;

/** RGBA, one byte a channel, which is what an uncompressed texture uploads as. */
const BYTES_PER_TEXEL = 4;

/** A full mipmap chain adds a third to a texture's size. */
const MIPMAP_FACTOR = 4 / 3;

/** Megabytes here are the binary sort, matching what a driver reports. */
const BYTES_PER_MEGABYTE = 1024 * 1024;

/**
 * What makes two materials the same one, for counting.
 *
 * The same hook `MergeOptions.materialKey` in `merge.ts` offers, and deliberately
 * the same name: a caller that groups its batches one way and measures them
 * another would be reading a number that describes a scene it is not drawing.
 */
export type MaterialKey = (material: Material) => string;

/**
 * Object identity, which is the default and the only reading that cannot
 * under-report.
 */
function identityMaterialKey(material: Material): string {
  return material.uuid;
}

/**
 * Materials as colour tokens: by name when it has one, by type when it does not.
 *
 * This exists for one specific and common case. `buildFloorMesh`, `buildWallMesh`
 * and `toMesh` deliberately assign no material — colour is a token decision and
 * belongs to the caller — and three's constructors default `material` to
 * `new MeshBasicMaterial()`, a **default parameter**, evaluated afresh on every
 * mesh. So a storey straight out of the builders carries one distinct material per
 * mesh: forty-eight walls measure as forty-eight materials, a full storey as a
 * hundred and ten, and the cap of forty is breached by materials that no viewer
 * will ever create.
 *
 * Keyed this way that same storey reads as **one** material, and the storey after
 * the colour tokens are applied reads as the number of tokens — which is what the
 * renderer will actually switch between.
 *
 * **It can under-report.** Forty distinct unnamed `MeshStandardMaterial`s are
 * forty state changes and this key calls them one. Use it to measure build output
 * before it is painted; measure a live scene with the default, which counts what
 * is really there.
 */
export function tokenMaterialKey(material: Material): string {
  return material.name !== '' ? material.name : material.type;
}

/** How a scene is to be counted. */
export interface MeasureSceneOptions {
  /**
   * What makes two materials the same. Defaults to object identity.
   *
   * Pass {@link tokenMaterialKey} to measure a scene whose meshes have not been
   * given their materials yet.
   */
  readonly materialKey?: MaterialKey;
}

/** Anything that turns into draw calls: meshes, point clouds, lines. */
type DrawnObject = Mesh | Points | Line;

function isDrawn(object: Object3D): object is DrawnObject {
  return object instanceof Mesh || object instanceof Points || object instanceof Line;
}

/**
 * How many calls one object costs.
 *
 * One, unless it carries several materials — then the card is asked once per
 * geometry group, which is exactly the cost `merge.ts` refuses to batch away and
 * therefore exactly the cost worth counting honestly.
 */
function drawCallsOf(object: DrawnObject): number {
  if (!Array.isArray(object.material)) {
    return 1;
  }
  const groups = object.geometry.groups;
  return groups.length === 0 ? 1 : groups.length;
}

/** Every material an object references, however many it carries. */
function materialsOf(object: DrawnObject): readonly Material[] {
  return Array.isArray(object.material) ? object.material : [object.material];
}

/**
 * Triangles one object submits.
 *
 * Points and lines submit none — they are draw calls without triangles, and
 * counting their vertices as triangles would make the two caps disagree about the
 * same scene. An instanced mesh submits its geometry once per placement, because
 * the card does: instancing saves the upload and the call, not the rasterising.
 */
function trianglesOf(object: DrawnObject): number {
  if (!(object instanceof Mesh)) {
    return 0;
  }

  const geometry = object.geometry;
  const index = geometry.getIndex();
  const vertices =
    index !== null
      ? index.count
      : geometry.hasAttribute('position')
        ? geometry.getAttribute('position').count
        : 0;

  const placements = object instanceof InstancedMesh ? object.count : 1;
  return Math.floor(vertices / VERTICES_PER_TRIANGLE) * placements;
}

/** The typed array behind an attribute, whether it is interleaved or not. */
function arrayOf(attribute: BufferAttribute | InterleavedBufferAttribute): ArrayBufferView {
  return 'data' in attribute ? attribute.data.array : attribute.array;
}

/**
 * Bytes a texture occupies once uploaded.
 *
 * Compression and internal formats are not modelled: this is an upper bound on
 * the uncompressed case, which is what the viewer uploads today.
 */
function textureBytes(texture: Texture): number {
  const image: unknown = texture.image;
  if (typeof image !== 'object' || image === null) {
    return 0;
  }

  const size = image as { readonly width?: unknown; readonly height?: unknown };
  const width = typeof size.width === 'number' ? size.width : 0;
  const height = typeof size.height === 'number' ? size.height : 0;
  const base = width * height * BYTES_PER_TEXEL;

  return texture.generateMipmaps ? Math.round(base * MIPMAP_FACTOR) : base;
}

/** Every texture a material references, found by looking at what it holds. */
function texturesOf(material: Material): readonly Texture[] {
  const found: Texture[] = [];
  for (const value of Object.values(material as unknown as Record<string, unknown>)) {
    if (value instanceof Texture) {
      found.push(value);
    }
  }
  return found;
}

/** Walk what would actually be drawn, skipping any subtree that is hidden. */
function visitVisible(object: Object3D, visit: (drawn: Object3D) => void): void {
  if (!object.visible) {
    return;
  }
  visit(object);
  for (const child of object.children) {
    visitVisible(child, visit);
  }
}

/**
 * What this scene costs, read straight off the objects in it.
 *
 * Nothing is written to and nothing is rendered, so this is safe to call on a
 * scene that is on screen and safe to call in a test with no WebGL context —
 * which is the whole reason the budget can be asserted in `pnpm test` rather than
 * only felt in a browser.
 *
 * Everything shared is counted once. Forty walls that share one geometry hold one
 * geometry's worth of memory, and counting it forty times would report a scene
 * four hundred megabytes over a budget it is comfortably inside. Hidden objects
 * are counted not at all: an invisible subtree costs nothing, and a viewer that
 * hides the storeys above the current one relies on that being true.
 *
 * Draw calls and triangles are what the scene *would* submit if all of it were in
 * front of the camera. Frustum culling only ever makes the real number smaller,
 * so a scene inside this budget is inside it from every angle.
 *
 * Materials are counted by object identity unless `options.materialKey` says
 * otherwise — see {@link tokenMaterialKey} for the case that needs it, a scene
 * built but not yet painted. The key changes only the **count**: memory is always
 * summed over the real material objects, so keying two materials together never
 * loses the textures of either.
 */
export function measureScene(root: Object3D, options: MeasureSceneOptions = {}): SceneReading {
  const keyOf = options.materialKey ?? identityMaterialKey;

  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const materialKeys = new Set<string>();
  const textures = new Set<Texture>();
  const arrays = new Set<ArrayBufferView>();

  let drawCalls = 0;
  let triangles = 0;

  visitVisible(root, (object) => {
    if (!isDrawn(object)) {
      return;
    }

    drawCalls += drawCallsOf(object);
    triangles += trianglesOf(object);
    geometries.add(object.geometry);

    for (const material of materialsOf(object)) {
      materials.add(material);
      materialKeys.add(keyOf(material));
    }

    if (object instanceof InstancedMesh) {
      arrays.add(object.instanceMatrix.array);
    }
  });

  for (const material of materials) {
    for (const texture of texturesOf(material)) {
      textures.add(texture);
    }
  }

  let bytes = 0;

  for (const geometry of geometries) {
    for (const attribute of Object.values(geometry.attributes)) {
      arrays.add(arrayOf(attribute));
    }
    const index = geometry.getIndex();
    if (index !== null) {
      arrays.add(index.array);
    }
  }

  for (const array of arrays) {
    bytes += array.byteLength;
  }
  for (const texture of textures) {
    bytes += textureBytes(texture);
  }

  return {
    drawCalls,
    triangles,
    materials: materialKeys.size,
    graphicsMemoryMb: bytes / BYTES_PER_MEGABYTE,
  };
}

/* -------------------------------------------------------------------------- */
/* Reading a live renderer.                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The little of `WebGLRenderer.info` a reading needs.
 *
 * A real renderer's `info` satisfies this without a cast. Stating it structurally
 * rather than importing the class keeps this module — and every test of it — free
 * of a WebGL context.
 */
export interface RenderInfoLike {
  readonly render: {
    /** Draw calls issued for the frame just rendered. */
    readonly calls: number;
    /** Triangles submitted for the frame just rendered. */
    readonly triangles: number;
  };
  /** One compiled program per distinct material, which is what we are counting. */
  readonly programs?: { readonly length: number } | null;
}

/**
 * What the renderer actually did last frame, with the memory estimate the
 * renderer cannot supply.
 *
 * Prefer this to {@link measureScene} for the two counters it provides: it reports
 * what survived frustum culling and what the material system really compiled,
 * where the scene walk reports the worst case. `graphicsMemoryMb` still has to
 * come from the scene, because WebGL will not say.
 */
export function readRenderInfo(info: RenderInfoLike, graphicsMemoryMb: number): SceneReading {
  return {
    drawCalls: info.render.calls,
    triangles: info.render.triangles,
    materials: info.programs?.length ?? 0,
    graphicsMemoryMb,
  };
}
