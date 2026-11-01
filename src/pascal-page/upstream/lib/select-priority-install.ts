/**
 * AppFront addition (đợt sửa 2 H1, C2): live side of `select-priority.ts`. Pascal's Select-mode
 * click handler (`selection-manager.tsx`, patched by `scripts/pascal-ui-patch.mjs`) calls
 * `globalThis.__appfrontPreferItemHit(event)` first; a returned event replaces the clicked one, so
 * the item is selected through Pascal's own path (phase switch, panel, undo). Only Select mode
 * subscribes that handler, so wall / door / paint tools keep Pascal's behaviour untouched.
 */
import { type AnyNode, type NodeEvent, resolveLevelId, sceneRegistry, useScene } from '@pascal-app/core'
import { useEditor, useViewer } from '@pascal-app/editor'
import { Box3, type Intersection, Matrix4, type Mesh, type Object3D, type Plane, type Ray, Vector3 } from 'three'
import { type ItemRayEntry, pickItemOnRay } from './select-priority'

export const PREFER_ITEM_HOOK = '__appfrontPreferItemHit'

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

type ClipGroupLike = Object3D & { isClippingGroup?: boolean; enabled?: boolean; clippingPlanes?: Plane[] }

/**
 * Hit on a part that is not drawn: "Tường: cắt" (`realism/cutSync.ts`) clips each level at 1 m with a
 * ClippingGroup, but raycasts still hit the full-height wall above the cut — the invisible top of the
 * wall in front of a bed stole the click (C2, thử tay 01/11).
 */
const clippedAway = (object: Object3D, point: Vector3 | undefined): boolean => {
  if (!point) return false
  for (let o: Object3D | null = object; o; o = o.parent) {
    const group = o as ClipGroupLike
    if (group.isClippingGroup && group.enabled !== false && group.clippingPlanes?.some((plane) => plane.distanceToPoint(point) < 0)) {
      return true
    }
  }
  return false
}

function ownerLookup(): (object: Object3D) => string | null {
  const reverse = new Map<Object3D, string>()
  for (const [id, root] of sceneRegistry.nodes.entries()) reverse.set(root, id)
  return (object) => {
    for (let o: Object3D | null = object; o; o = o.parent) {
      const id = reverse.get(o)
      if (id !== undefined) return id
    }
    return null
  }
}

const tmpBox = new Box3()
const toLocal = new Matrix4()

/** Distance along `ray` where it enters the item's oriented box (its own frame), or null. */
function rayEntry(root: Object3D, ray: Ray): { entry: number; point: Vector3 } | null {
  root.updateWorldMatrix(true, true)
  const inverse = root.matrixWorld.clone().invert()
  const box = new Box3()
  root.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh || !mesh.visible || mesh.name === 'cutout' || !mesh.geometry) return
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
    const bb = mesh.geometry.boundingBox
    if (!bb) return
    box.union(tmpBox.copy(bb).applyMatrix4(toLocal.multiplyMatrices(inverse, mesh.matrixWorld)))
  })
  if (box.isEmpty()) return null
  const local = ray.clone().applyMatrix4(inverse)
  const hit = local.intersectBox(box, new Vector3())
  if (!hit) return null
  const point = hit.applyMatrix4(root.matrixWorld)
  return { entry: point.distanceTo(ray.origin), point }
}

export function preferItemHit(event: NodeEvent): NodeEvent | null {
  if (useEditor.getState().mode !== 'select') return null
  const native = event.nativeEvent as unknown as {
    ray?: Ray
    distance?: number
    intersections?: Intersection[]
  }
  const ray = native.ray
  if (!ray || typeof native.distance !== 'number') return null

  const nodes = useScene.getState().nodes as Record<string, AnyNode | undefined>
  const clicked = event.node
  const ownerOf = ownerLookup()

  const opaque: number[] = []
  const clickedHit = native as { object?: Object3D; point?: Vector3 }
  const clickedSeeThrough =
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
    const hit = rayEntry(root, ray)
    if (!hit) continue
    entries.push({ id, entry: hit.entry })
    points.set(id, hit.point)
  }

  const pickedId = pickItemOnRay({ kind: clicked.type, viaHandle: event.viaHandle }, opaque, entries)
  const item = pickedId ? nodes[pickedId] : undefined
  const root = pickedId ? sceneRegistry.nodes.get(pickedId) : undefined
  if (!pickedId || !item || !root) return null

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
    if (g[PREFER_ITEM_HOOK] === preferItemHit) delete g[PREFER_ITEM_HOOK]
  }
}
