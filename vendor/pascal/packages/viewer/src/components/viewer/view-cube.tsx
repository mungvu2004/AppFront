import { type CameraPose, emitter } from '@pascal-app/core'
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Box3, Vector3 } from 'three'
import { create } from 'zustand'
import { vi } from '../../i18n/vi'
import useViewer from '../../store/use-viewer'
import { getSectionedSceneRoot } from '../../systems/section-plane/section-plane'

export type ViewCubeFace = 'top' | 'front' | 'back' | 'left' | 'right' | 'iso'

/** Unit direction from the target TO the camera for each face. */
const FACE_DIRECTIONS: Record<ViewCubeFace, [number, number, number]> = {
  // A hair of +Z keeps `lookAt` from degenerating when looking straight down.
  top: [0, 1, 0.0001],
  front: [0, 0, 1],
  back: [0, 0, -1],
  left: [-1, 0, 0],
  right: [1, 0, 0],
  iso: [1, 1, 1],
}

export const VIEW_CUBE_FACES = Object.keys(FACE_DIRECTIONS) as ViewCubeFace[]

/** Camera pose looking at `center` from `face`, `distance` away. */
export function viewCubePose(
  face: ViewCubeFace,
  center: [number, number, number],
  distance: number,
  projection: CameraPose['projection'],
): CameraPose {
  const dir = new Vector3(...FACE_DIRECTIONS[face]).normalize().multiplyScalar(distance)
  return {
    position: [center[0] + dir.x, center[1] + dir.y, center[2] + dir.z],
    target: center,
    projection,
  }
}

const useViewCubeRequest = create<{ face: ViewCubeFace | null; seq: number }>(() => ({
  face: null,
  seq: 0,
}))

const requestFace = (face: ViewCubeFace) =>
  useViewCubeRequest.setState((s) => ({ face, seq: s.seq + 1 }))

/**
 * In-canvas half: turns a face click into a pose for the host's camera
 * controls (`camera-controls:apply-pose`, the same channel the floorplan sync
 * uses), so the editor's own controls animate the flight and keep their target.
 */
export function ViewCubeBridge() {
  const camera = useThree((s) => s.camera)
  const seq = useViewCubeRequest((s) => s.seq)

  useEffect(() => {
    const face = useViewCubeRequest.getState().face
    if (!face) return
    const root = getSectionedSceneRoot()
    const bounds = root ? new Box3().setFromObject(root) : new Box3()
    const center = bounds.isEmpty() ? new Vector3() : bounds.getCenter(new Vector3())
    const size = bounds.isEmpty() ? 10 : bounds.getSize(new Vector3()).length()
    const distance = Math.max(size * 1.2, camera.position.distanceTo(center) * 0.5, 2)
    emitter.emit(
      'camera-controls:apply-pose',
      viewCubePose(face, [center.x, center.y, center.z], distance, useViewer.getState().cameraMode),
    )
    // seq is the trigger; the face is read fresh from the store.
  }, [seq, camera])

  return null
}

/**
 * DOM half, outside <Canvas>. Buttons rather than a rotating 3D cube: each
 * face is a named, tabbable control (A12 keyboard path), and nothing here
 * needs a second render pass on the WebGPU limiter.
 * ponytail: the cube does not rotate with the camera; add a camera-synced CSS transform if users ask.
 */
export function ViewCube() {
  const labels = vi.viewCube
  return (
    <nav
      aria-label={labels.ariaLabel}
      className="pointer-events-auto absolute bottom-20 left-3 z-10 grid grid-cols-3 gap-1 rounded-lg border border-border bg-background/90 p-1.5 text-xs shadow-sm"
    >
      {VIEW_CUBE_FACES.map((face) => (
        <button
          className="rounded px-2 py-1 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
          key={face}
          onClick={() => requestFace(face)}
          type="button"
        >
          {labels.faces[face]}
        </button>
      ))}
    </nav>
  )
}
