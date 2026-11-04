/**
 * AppFront addition (đợt sửa 2 H1, C2; đợt 3 nhóm D): live side of `select-priority.ts`. Pascal's
 * Select-mode handlers (`selection-manager.tsx`, patched by `scripts/pascal-ui-patch.mjs`) call
 * `globalThis.__appfrontPreferItemHit(event, phase)` first; a returned event replaces the original,
 * so the item goes through Pascal's own path (phase switch, panel, undo; hover outline).
 *   - no phase: click;
 *   - 'hover': pointer enter / move — same rule, so the outline shows what a click would select;
 *   - 'leave': pointer left a mesh — hands back the item that mesh's hover was swapped to, so the
 *     outline is cleared instead of sticking on the item.
 * Only Select mode subscribes those handlers, so wall / door / paint tools keep Pascal's behaviour.
 */
import { type AnyNode, type NodeEvent, resolveLevelId, sceneRegistry, useScene } from '@pascal-app/core'
import { useEditor, useViewer } from '@pascal-app/editor'
import { Box3, type Intersection, Matrix4, type Mesh, type Object3D, Ray, Vector3 } from 'three'
import { clippedAway } from '../../realism/cut'
import { canPreferItem, type ItemRayEntry, pickItemOnRay } from './select-priority'

export const PREFER_ITEM_HOOK = '__appfrontPreferItemHit'

export type PreferPhase = 'hover' | 'leave'

type ItemLike = AnyNode & { asset?: { category?: string } }

/** Kinds that hide what is behind them (a wall only while drawn, see `wallHidden` below). */
const OPAQUE_KINDS = new Set(['wall', 'slab', 'door', 'window'])

const isShown = (object: Object3D): boolean => {
  for (let o: Object3D | null = object; o; o = o.parent) {
    if (!o.visible) return false
  }
  return true
}

/** Cutaway / 'down' walls: `WallCutout` stamps `userData.wallHidden` on the registered wall mesh. */
const isHiddenWall = (id: string): boolean =>
  sceneRegistry.nodes.get(id)?.userData?.wallHidden === true

/** Object3D → registered node id, rebuilt only when the registry changes (hover runs per move). */
let owners: { revision: number; byRoot: Map<Object3D, string> } | null = null
function ownerOf(object: Object3D): string | null {
  let current = owners
  if (!current || current.revision !== sceneRegistry.revision) {
    const byRoot = new Map<Object3D, string>()
    for (const [id, root] of sceneRegistry.nodes.entries()) byRoot.set(root, id)
    current = { revision: sceneRegistry.revision, byRoot }
    owners = current
  }
  for (let o: Object3D | null = object; o; o = o.parent) {
    const id = current.byRoot.get(o)
    if (id !== undefined) return id
  }
  return null
}

/**
 * Item box in its root's own frame. Kept until the node changes (move / resize / swap) or the set
 * of drawn meshes changes (GLB replaces the loading placeholder, a part is hidden).
 */
type BoxCache = { node: AnyNode; meshes: Mesh[]; box: Box3 }
const boxCache = new WeakMap<Object3D, BoxCache>()
const tmpBox = new Box3()
const tmpMatrix = new Matrix4()
const inverse = new Matrix4()

function localBox(root: Object3D, node: AnyNode): Box3 {
  const meshes: Mesh[] = []
  root.traverse((child) => {
    const mesh = child as Mesh
    if (mesh.isMesh && mesh.visible && mesh.name !== 'cutout' && mesh.geometry) meshes.push(mesh)
  })
  const cached = boxCache.get(root)
  if (cached && cached.node === node && cached.meshes.length === meshes.length && cached.meshes.every((m, i) => m === meshes[i])) {
    return cached.box
  }
  root.updateWorldMatrix(true, true)
  inverse.copy(root.matrixWorld).invert()
  const box = new Box3()
  for (const mesh of meshes) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
    const bb = mesh.geometry.boundingBox
    if (bb) box.union(tmpBox.copy(bb).applyMatrix4(tmpMatrix.multiplyMatrices(inverse, mesh.matrixWorld)))
  }
  boxCache.set(root, { node, meshes, box })
  return box
}

const localRay = new Ray()
const size = new Vector3()
const scale = new Vector3()

/** Where `ray` enters the item's oriented box (its own frame), plus the box's world volume/height. */
function rayEntry(root: Object3D, node: AnyNode, ray: Ray): { entry: number; point: Vector3; volume: number; height: number } | null {
  const box = localBox(root, node)
  if (box.isEmpty()) return null
  inverse.copy(root.matrixWorld).invert()
  const hit = localRay.copy(ray).applyMatrix4(inverse).intersectBox(box, new Vector3())
  if (!hit) return null
  const point = hit.applyMatrix4(root.matrixWorld)
  box.getSize(size)
  scale.setFromMatrixScale(root.matrixWorld)
  return {
    entry: point.distanceTo(ray.origin),
    point,
    volume: size.x * scale.x * size.y * scale.y * size.z * scale.z,
    height: size.y * scale.y,
  }
}

/** Last hover swap: the mesh the pointer is over (raw node id) and the item event shown instead. */
let hoverSwap: { from: string; event: NodeEvent } | null = null

export function preferItemHit(event: NodeEvent, phase?: PreferPhase): NodeEvent | null {
  if (phase === 'leave') {
    const swap = hoverSwap
    if (!swap || swap.from !== event.node.id) return null
    hoverSwap = null
    return swap.event
  }
  const swapped = computePreferredHit(event)
  if (phase === 'hover') hoverSwap = swapped ? { from: event.node.id, event: swapped } : null
  return swapped
}

function computePreferredHit(event: NodeEvent): NodeEvent | null {
  if (useEditor.getState().mode !== 'select') return null
  const clicked = event.node
  if (!canPreferItem({ kind: clicked.type, viaHandle: event.viaHandle })) return null
  const native = event.nativeEvent as unknown as {
    ray?: Ray
    distance?: number
    intersections?: Intersection[]
  }
  const ray = native.ray
  if (!ray || typeof native.distance !== 'number') return null

  const nodes = useScene.getState().nodes as Record<string, AnyNode | undefined>

  const opaque: number[] = []
  const clickedHit = native as { object?: Object3D; point?: Vector3 }
  const clickedSeeThrough =
    clicked.type === 'item' ||
    clicked.type === 'ceiling' ||
    (clicked.type === 'wall' && isHiddenWall(clicked.id)) ||
    (clickedHit.object !== undefined && clippedAway(clickedHit.object, clickedHit.point))
  if (!clickedSeeThrough) opaque.push(native.distance)
  const itemHit = new Map<string, Intersection>()
  for (const hit of native.intersections ?? []) {
    const id = ownerOf(hit.object)
    const kind = id ? nodes[id]?.type : undefined
    if (!id || !kind) continue
    if (kind === 'item') {
      if (!itemHit.has(id)) itemHit.set(id, hit)
    } else if (OPAQUE_KINDS.has(kind) && !(kind === 'wall' && isHiddenWall(id)) && !clippedAway(hit.object, hit.point)) {
      opaque.push(hit.distance)
    }
  }

  const levelId = useViewer.getState().selection.levelId
  const entries: ItemRayEntry[] = []
  const points = new Map<string, Vector3>()
  for (const id of sceneRegistry.byType.item ?? []) {
    const node = nodes[id] as ItemLike | undefined
    const root = sceneRegistry.nodes.get(id)
    if (!node || node.type !== 'item' || !root || !isShown(root)) continue
    const category = node.asset?.category
    if (category === 'door' || category === 'window') continue
    if (levelId && resolveLevelId(node, useScene.getState().nodes) !== levelId) continue
    const box = rayEntry(root, node, ray)
    if (!box) continue
    entries.push({ id, entry: box.entry, hit: itemHit.get(id)?.distance, volume: box.volume, height: box.height })
    points.set(id, box.point)
  }

  const pickedId = pickItemOnRay({ kind: clicked.type, viaHandle: event.viaHandle }, opaque, entries)
  if (!pickedId || pickedId === clicked.id) return null
  const item = nodes[pickedId]
  const root = sceneRegistry.nodes.get(pickedId)
  if (!item || !root) return null

  // Prefer the item's real mesh hit (paint-slot lookup reads its material groups); else its box.
  const meshHit = itemHit.get(pickedId)
  const point = meshHit?.point ?? (points.get(pickedId) as Vector3)
  const local = root.worldToLocal(point.clone())
  return {
    ...event,
    node: item,
    position: [point.x, point.y, point.z],
    localPosition: [local.x, local.y, local.z],
    normal: meshHit?.face ? [meshHit.face.normal.x, meshHit.face.normal.y, meshHit.face.normal.z] : undefined,
    faceIndex: meshHit?.faceIndex ?? undefined,
    object: meshHit?.object ?? root,
  }
}

/** Registers the hook for the patched selection manager; returns the cleanup (useEffect-ready). */
export function installSelectPriority(): () => void {
  const g = globalThis as Record<string, unknown>
  g[PREFER_ITEM_HOOK] = preferItemHit
  return () => {
    hoverSwap = null
    if (g[PREFER_ITEM_HOOK] === preferItemHit) delete g[PREFER_ITEM_HOOK]
  }
}
