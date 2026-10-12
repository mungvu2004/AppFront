import { useInteractive, useScene } from '@pascal-app/core'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { isLiveFrameHeld } from '../../lib/live-frame-hold'
import { timeSpan } from '../../lib/perf-tracks'
import useViewer from '../../store/use-viewer'

type FrameLimiterProps = {
  fps?: number
  paused?: boolean
  onFrameError?: (cause: unknown) => void
}

export type FrameClock = {
  sample: (wallTimeMs: number, intervalMs: number) => number | null
  step: (seconds: number) => number
}

/**
 * How long after the last pointer/wheel/key event the loop keeps running at
 * full rate. Interaction moves the camera, the hover highlight and the tools
 * by mutating three objects directly — no React render, so nothing calls
 * `invalidate()` — and the eased transitions those start (zone fade, item
 * lerp, camera damping) outlive the event itself.
 */
export const INTERACTION_TAIL_MS = 500

/**
 * Does this rAF tick owe a frame?
 *
 * The limiter drives R3F by hand (`frameloop: 'never'`), and before this gate
 * it advanced every tick forever: a scene standing still still paid ~50
 * frames/second of systems plus a draw, which is where AppFront measured
 * Pascal at ~1.6x the main-thread CPU of its own on-demand viewer
 * (docs/pascal/01-ho-so-cong-T4.1.md §8d).
 *
 * `frames` is R3F's own demand counter: every prop update invalidates
 * (`invalidateInstance`), drei's camera controls invalidate on every control
 * event, and the viewer's own systems (scene-ready, atmosphere, materials,
 * node batches) call `invalidate()` when they leave work behind. `render()`
 * decrements it, so one invalidate buys exactly one frame.
 */
export function frameDemanded({
  frames,
  hotUntilMs,
  liveFrameHeld,
  now,
  pendingWork,
}: {
  frames: number
  hotUntilMs: number
  liveFrameHeld: boolean
  now: number
  pendingWork: boolean
}): boolean {
  return frames > 0 || pendingWork || liveFrameHeld || now < hotUntilMs
}

/**
 * Work the viewer owes that no `invalidate()` announces: nodes waiting to be
 * built, and door/window animations, which deliberately do NOT mark dirty per
 * tick (a mark is one-shot work, not a needs-frame signal — see
 * door-animation-system.tsx).
 */
function hasPendingFrameWork(): boolean {
  if (useScene.getState().dirtyNodes.size > 0) return true
  const interactive = useInteractive.getState()
  for (const _ in interactive.doorAnimations) return true
  for (const _ in interactive.windowAnimations) return true
  return false
}

/**
 * Keeps R3F's manual clock monotonic while each limiter effect owns a fresh
 * wall-time baseline. The first rAF sample establishes that baseline instead
 * of treating the browser's process uptime as elapsed frame time.
 */
export function createFrameClock(initialTime = 0): FrameClock {
  let frameTime = initialTime
  let previousWallTime: number | null = null

  return {
    sample(wallTimeMs, intervalMs) {
      if (previousWallTime === null) {
        previousWallTime = wallTimeMs
        return null
      }

      const elapsedMs = wallTimeMs - previousWallTime
      if (elapsedMs < intervalMs) return null

      const remainderMs = elapsedMs % intervalMs
      frameTime += (elapsedMs - remainderMs) / 1000
      previousWallTime = wallTimeMs - remainderMs
      return frameTime
    },
    step(seconds) {
      frameTime += seconds
      return frameTime
    },
  }
}

// `?disable=draw` (see post-processing.tsx): the page renders no real frames,
// and Chromium's no-damage scheduler then throttles requestAnimationFrame to
// 1Hz on Linux (measured in the headless bake worker — every useFrame system
// ticked once per second and a heavy scene took 300+ seconds to settle). A
// plain timer is never throttled on a visible page, so drive the loop with
// setInterval instead of rAF when nothing is drawn.
const DRAW_DISABLED =
  typeof window !== 'undefined' &&
  new Set(
    (new URLSearchParams(window.location.search).get('disable') ?? '')
      .split(',')
      .map((s) => s.trim()),
  ).has('draw')

/**
 * `?frameloop=always` — advance every tick the way the limiter did before the
 * demand gate, so the two behaviours can be measured against each other in one
 * build, on one page, on one machine (scripts/pascal-perf, e2e/pascal-perf.spec.ts).
 * It is a measurement switch, not a supported viewer mode.
 */
const FRAMELOOP_ALWAYS =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('frameloop') === 'always'

const INTERACTION_EVENTS = [
  'pointerdown',
  'pointermove',
  'pointerup',
  'pointercancel',
  'wheel',
] as const

const FrameLimiter: React.FC<FrameLimiterProps> = ({ fps = 50, paused = false, onFrameError }) => {
  const { advance: advanceFrame, set, frameloop: initFrameloop } = useThree()
  const onFrameErrorRef = useRef(onFrameError)
  onFrameErrorRef.current = onFrameError
  const nextFrameTimeRef = useRef(0)
  const internal = useThree((state) => state.internal)
  const renderer = useThree((state) => state.gl)
  const size = useThree((state) => state.size)
  const dpr = useThree((state) => state.viewport.dpr)
  // Fully covered canvas (e.g. studio gallery) → stop advancing frames
  const renderPaused = useViewer((s) => s.renderPaused)

  useLayoutEffect(() => {
    if (renderPaused || paused) return
    const clock = createFrameClock(nextFrameTimeRef.current)
    let raf: number | null = null
    let timer: ReturnType<typeof setInterval> | null = null
    let sizeSynced = false
    // A system that throws inside useFrame runs outside React's error
    // boundaries: report the first failure to the host and keep the loop alive.
    let frameErrorReported = false
    function advance(frameTime: number) {
      try {
        advanceFrame(frameTime)
      } catch (error) {
        if (frameErrorReported) return
        frameErrorReported = true
        if (onFrameErrorRef.current) onFrameErrorRef.current(error)
        else console.error('[viewer] a frame callback threw', error)
      }
    }
    const effectiveFps = Number.isFinite(fps) && fps > 0 ? fps : 50
    const interval = 1000 / effectiveFps
    function syncSize() {
      if (sizeSynced) return
      renderer.setPixelRatio(dpr)
      renderer.setSize(size.width, size.height, false)
      sizeSynced = true
    }
    let hotUntilMs = 0
    function heatUp() {
      hotUntilMs = performance.now() + INTERACTION_TAIL_MS
    }
    function tick(t: DOMHighResTimeStamp) {
      raf = requestAnimationFrame(tick)
      syncSize()
      const frameTime = clock.sample(t, interval)
      if (frameTime === null) return
      if (
        !FRAMELOOP_ALWAYS &&
        !frameDemanded({
          frames: internal.frames,
          hotUntilMs,
          liveFrameHeld: isLiveFrameHeld(),
          now: t,
          pendingWork: hasPendingFrameWork(),
        })
      ) {
        return
      }
      nextFrameTimeRef.current = frameTime
      timeSpan('frame-cpu', () => advance(frameTime))
    }
    function kick() {
      syncSize()
      const frameTime = clock.step(1 / 1000)
      nextFrameTimeRef.current = frameTime
      timeSpan('frame-cpu', () => advance(frameTime))
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') kick()
    }
    // Set frameloop to never, it will shut down the default render loop
    set({ frameloop: 'never' })
    if (DRAW_DISABLED) {
      timer = setInterval(() => {
        const frameTime = clock.step(interval / 1000)
        nextFrameTimeRef.current = frameTime
        timeSpan('frame-cpu', () => advance(frameTime))
      }, interval)
    } else {
      // Kick off custom render loop. The first interaction tail starts open so
      // the scene's first frames are never gated behind an invalidate that
      // the initial mount may have fired before this effect ran.
      heatUp()
      raf = requestAnimationFrame(tick)
      for (const type of INTERACTION_EVENTS) {
        renderer.domElement.addEventListener(type, heatUp, { passive: true })
      }
      window.addEventListener('keydown', heatUp, { passive: true })
      // rAF can stall while a tab is hidden, unfocused, or occluded. With the
      // default loop disabled, force one current frame as soon as it resumes.
      document.addEventListener('visibilitychange', onVisibilityChange)
      window.addEventListener('focus', kick)
      window.addEventListener('pageshow', kick)
    }
    // Restore initial setting
    return () => {
      if (raf) {
        cancelAnimationFrame(raf)
      }
      if (timer) {
        clearInterval(timer)
      }
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', kick)
      window.removeEventListener('pageshow', kick)
      window.removeEventListener('keydown', heatUp)
      for (const type of INTERACTION_EVENTS) {
        renderer.domElement.removeEventListener(type, heatUp)
      }
      set({ frameloop: initFrameloop })
    }
  }, [
    advanceFrame,
    dpr,
    fps,
    initFrameloop,
    internal,
    paused,
    renderPaused,
    renderer,
    set,
    size.height,
    size.width,
  ])

  return null
}

export default FrameLimiter
