/** AppFront addition (P55, G5-09): keep a floating bar inside the window. */
const EDGE = 8
const TOP_RESERVED = 64 // viewer top toolbar
const BOTTOM_RESERVED = 72 // bottom tool bar

/** Pixel shift that brings `rect` inside the window margins (0 when it already fits). */
export function clampShift(
  rect: { left: number; right: number; top: number; bottom: number },
  width: number,
  height: number,
): { dx: number; dy: number } {
  const dx =
    rect.left < EDGE ? EDGE - rect.left : rect.right > width - EDGE ? width - EDGE - rect.right : 0
  const dy =
    rect.top < TOP_RESERVED
      ? TOP_RESERVED - rect.top
      : rect.bottom > height - BOTTOM_RESERVED
        ? height - BOTTOM_RESERVED - rect.bottom
        : 0
  return { dx, dy }
}

type Box = { left: number; right: number; top: number; bottom: number }

/**
 * AppFront addition (pascal-polish): rightward shift that keeps `rect` clear of `obstacle` (with `gap`)
 * when they overlap on both axes; 0 otherwise. Used to keep the centred help pill off the floor card.
 */
export function clearOfShift(rect: Box, obstacle: Box, gap = 12): number {
  const overlapY = rect.top < obstacle.bottom && rect.bottom > obstacle.top
  const overlapX = rect.left < obstacle.right + gap && rect.right > obstacle.left
  return overlapY && overlapX ? obstacle.right + gap - rect.left : 0
}
