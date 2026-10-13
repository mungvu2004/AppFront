import { sceneRegistry, useScene } from '@pascal-app/core'
import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Box3, Vector3 } from 'three'
import { heroCameraPose } from '../../lib/hero-pose'
import useViewer from '../../store/use-viewer'
import { getLevelPresentationY } from './level-utils'

/**
 * Bounds of everything that renders on one level, in world space.
 *
 * Read from the level's own Object3D — it holds the whole subtree, so one
 * `setFromObject` covers every wall, slab and item on the floor without
 * walking the scene graph. The Y comes from `getLevelPresentationY` instead
 * of the mesh, because `LevelSystem` lerps a level into place over several
 * frames: framing the mesh mid-lerp aims at where the floor WAS.
 */
export function levelBounds(levelId: string): Box3 | null {
  const object = sceneRegistry.nodes.get(levelId)
  if (!object) return null

  const bounds = new Box3().setFromObject(object)
  if (bounds.isEmpty()) return null

  const presentationY = getLevelPresentationY(
    levelId,
    useScene.getState().nodes,
    useViewer.getState().levelMode,
  )
  const liveY = object.position.y
  if (Number.isFinite(presentationY) && presentationY !== liveY) {
    const shift = presentationY - liveY
    bounds.min.y += shift
    bounds.max.y += shift
  }

  return bounds
}

export type LevelFraming = {
  position: [number, number, number]
  target: [number, number, number]
}

/**
 * Camera pose that frames one level, or null when the level has nothing in it.
 *
 * Same fit as the hero shot (`heroCameraPose`) so a level frame and a whole-
 * building frame read as the same camera, only closer.
 */
export function fitToBounds(
  levelId: string,
  { aspect, fovDeg }: { aspect: number; fovDeg: number },
): LevelFraming | null {
  const bounds = levelBounds(levelId)
  if (!bounds) return null

  const center = bounds.getCenter(new Vector3())
  return heroCameraPose({
    aim: [center.x, center.y, center.z],
    aspect,
    boxes: bounds,
    fovDeg,
  })
}

/**
 * Frames the camera on the level the user just switched to.
 *
 * Only on a CHANGE, never on mount: on mount the host has usually just posed
 * the camera for the whole model, and stealing that pose one frame later is
 * the kind of jump that reads as a bug. The first selection a session sees is
 * therefore recorded, not acted on.
 */
export function LevelCameraFocus() {
  const camera = useThree((state) => state.camera)
  const width = useThree((state) => state.size.width)
  const height = useThree((state) => state.size.height)
  const levelId = useViewer((state) => state.selection.levelId)

  const seen = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    const previous = seen.current
    seen.current = levelId
    if (previous === undefined || previous === levelId) return
    if (!levelId || width === 0 || height === 0) return

    const fovDeg = 'fov' in camera ? (camera as { fov: number }).fov : 50
    const pose = fitToBounds(levelId, { aspect: width / height, fovDeg })
    if (!pose) return

    camera.position.set(...pose.position)
    camera.lookAt(...pose.target)
    camera.updateMatrixWorld()
  }, [camera, height, levelId, width])

  return null
}
