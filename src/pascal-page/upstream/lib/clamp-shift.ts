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
