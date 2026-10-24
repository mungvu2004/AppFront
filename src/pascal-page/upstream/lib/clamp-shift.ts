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
 * AppFront addition (pascal-polish): shift that keeps `rect` clear of `obstacle` (with `gap`) when they
 * overlap on both axes. Prefer moving right; if that would leave the window (`width`), drop below instead.
 * Used to keep the centred help pill off the floor card.
 */
export function clearOfShift(rect: Box, obstacle: Box, width: number, gap = 12): { dx: number; dy: number } {
  const overlapY = rect.top < obstacle.bottom && rect.bottom > obstacle.top
  const overlapX = rect.left < obstacle.right + gap && rect.right > obstacle.left
  if (!overlapY || !overlapX) return { dx: 0, dy: 0 }
  const dx = obstacle.right + gap - rect.left
  return rect.right + dx <= width - EDGE ? { dx, dy: 0 } : { dx: 0, dy: obstacle.bottom + gap - rect.top }
}

/** Smallest box holding `box` and every `extra` (pascal-polish: floor card plus its outside "+" dots). */
export function unionBox(box: Box, extras: readonly Box[]): Box {
  return extras.reduce<Box>(
    (acc, r) => ({
      left: Math.min(acc.left, r.left),
      right: Math.max(acc.right, r.right),
      top: Math.min(acc.top, r.top),
      bottom: Math.max(acc.bottom, r.bottom),
    }),
    { left: box.left, right: box.right, top: box.top, bottom: box.bottom },
  )
}
