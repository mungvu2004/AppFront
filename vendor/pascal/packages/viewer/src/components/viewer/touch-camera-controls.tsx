'use client'

import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { type PerspectiveCamera, Vector3 } from 'three'
import {
  type OrbitPose,
  orbitPose,
  panPose,
  pinchDelta,
  poseFromPosition,
  positionFromPose,
  zoomPose,
} from '../../lib/camera-gesture'

const WHEEL_ZOOM_PER_DELTA = 0.0015

/**
 * Orbit / pinch-zoom / two-finger pan for the view-only `<Viewer>`
 * (`cameraControls` prop). Mouse: drag = orbit, wheel = zoom. No inertia.
 * Writes the camera directly; the viewer's frame limiter draws it next tick.
 */
export function TouchCameraControls() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const element = useThree((s) => s.gl.domElement)

  useEffect(() => {
    const pointers = new Map<number, { x: number; y: number }>()
    let pose: OrbitPose | null = null

    const current = (): OrbitPose => {
      if (pose) return pose
      // Target = where the view ray meets the ground (fallback: 10 m ahead).
      const dir = camera.getWorldDirection(new Vector3())
      const t = dir.y < -0.01 ? -camera.position.y / dir.y : 10
      pose = poseFromPosition(
        [camera.position.x, camera.position.y, camera.position.z],
        [
          camera.position.x + dir.x * t,
          camera.position.y + dir.y * t,
          camera.position.z + dir.z * t,
        ],
      )
      return pose
    }
    const apply = (next: OrbitPose) => {
      pose = next
      const [x, y, z] = positionFromPose(next)
      camera.position.set(x, y, z)
      camera.lookAt(...next.target)
      camera.updateMatrixWorld()
    }

    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      element.setPointerCapture?.(e.pointerId)
      pose = null // re-derive: hero framing may have moved the camera since
    }
    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId)
      if (!prev) return
      const next = { x: e.clientX, y: e.clientY }
      if (pointers.size === 1) {
        apply(orbitPose(current(), next.x - prev.x, next.y - prev.y))
      } else if (pointers.size === 2) {
        const before = [...pointers.values()] as [typeof prev, typeof prev]
        pointers.set(e.pointerId, next)
        const after = [...pointers.values()] as [typeof prev, typeof prev]
        const d = pinchDelta(before, after)
        apply(panPose(zoomPose(current(), d.scale), d.dx, d.dy, element.clientHeight, camera.fov))
        return
      }
      pointers.set(e.pointerId, next)
    }
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      apply(zoomPose(current(), Math.exp(-e.deltaY * WHEEL_ZOOM_PER_DELTA)))
    }

    const prevTouchAction = element.style.touchAction
    element.style.touchAction = 'none' // keep the page from scrolling under a drag
    element.addEventListener('pointerdown', onDown)
    element.addEventListener('pointermove', onMove)
    element.addEventListener('pointerup', onUp)
    element.addEventListener('pointercancel', onUp)
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      element.style.touchAction = prevTouchAction
      element.removeEventListener('pointerdown', onDown)
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerup', onUp)
      element.removeEventListener('pointercancel', onUp)
      element.removeEventListener('wheel', onWheel)
    }
  }, [camera, element])

  return null
}
