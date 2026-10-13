import { useThree } from '@react-three/fiber'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { ClippingGroup, Plane, Vector3 } from 'three/webgpu'
import { create } from 'zustand'

/** Slider range of the cut, in metres above the ground plane. */
export const SECTION_PLANE_MIN_M = 0
// ponytail: fixed ceiling; derive from the tallest level if buildings above ~8 floors show up.
export const SECTION_PLANE_MAX_M = 30
export const SECTION_PLANE_STEP_M = 0.1

type SectionPlaneState = {
  enabled: boolean
  /** World Y of the cut. Everything ABOVE it is clipped away. */
  height: number
  setEnabled: (enabled: boolean) => void
  toggle: () => void
  setHeight: (height: number) => void
}

export const clampSectionHeight = (height: number): number =>
  Math.min(SECTION_PLANE_MAX_M, Math.max(SECTION_PLANE_MIN_M, height))

export const useSectionPlane = create<SectionPlaneState>((set) => ({
  enabled: false,
  height: 1.2,
  setEnabled: (enabled) => set({ enabled }),
  toggle: () => set((s) => ({ enabled: !s.enabled })),
  setHeight: (height) => set({ height: clampSectionHeight(height) }),
}))

/**
 * Plane that keeps what is below `height`: three keeps the side where
 * `normal·p + constant >= 0`, so a downward normal with `constant = height`
 * keeps `y <= height`.
 */
export function sectionPlaneAt(height: number, target = new Plane()): Plane {
  return target.set(new Vector3(0, -1, 0), height)
}

let sectionedSceneRoot: ClippingGroup | null = null

/** The group that holds the rendered building — the ViewCube frames its bounds. */
export const getSectionedSceneRoot = (): ClippingGroup | null => sectionedSceneRoot

/**
 * Wraps the rendered scene in a WebGPU `ClippingGroup` (the node renderer has
 * no global `renderer.clippingPlanes`). The group is ALWAYS mounted and only
 * its `enabled` flag flips — toggling the wrapper itself would remount every
 * mesh in the scene.
 */
export function SectionPlaneGroup({ children }: { children?: ReactNode }) {
  const [group] = useState(() => {
    const g = new ClippingGroup()
    g.name = 'section-plane'
    g.clippingPlanes = [new Plane()]
    return g
  })
  const enabled = useSectionPlane((s) => s.enabled)
  const height = useSectionPlane((s) => s.height)
  // The limiter only draws on demand (frame-limiter.tsx): a moved plane owes a frame.
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    group.enabled = enabled
    sectionPlaneAt(height, group.clippingPlanes[0])
    invalidate()
  }, [group, enabled, height, invalidate])

  useEffect(() => {
    sectionedSceneRoot = group
    return () => {
      if (sectionedSceneRoot === group) sectionedSceneRoot = null
    }
  }, [group])

  return <primitive object={group}>{children}</primitive>
}
