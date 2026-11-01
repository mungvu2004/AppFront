/**
 * AppFront addition (đợt sửa 2 H1, C2), not an upstream file. In Select mode Pascal hands a click
 * to the NEAREST mesh the ray hits. Two things make that the wall or the floor when the user clicks
 * a piece of furniture:
 *   - cutaway / 'down' walls keep an invisible full-height collision mesh, and a hidden wall only
 *     yields to things within 0.35 m of it (`nodes/wall/pointer-transparency.ts`), so a bed or
 *     chair in the room behind it loses to a wall the user cannot see;
 *   - furniture is not solid: the ray slips between chair legs or under a bed frame and lands on
 *     the slab (or the wall behind), which then wins.
 * Rule here: an item wins when the ray enters its box before the first surface that actually
 * blocks the view (+ a small tolerance). Hidden walls and ceilings do not block; visible walls,
 * slabs, doors and windows do. Clicking a spot with no item in front keeps Pascal's choice.
 * Pure so the rule is testable; `select-priority-install.ts` feeds it from the live scene.
 */

/** Kinds whose click may be handed over to an item standing in front of / behind them. */
export const SURFACE_KINDS: ReadonlySet<string> = new Set(['wall', 'slab', 'ceiling', 'door', 'window'])

/**
 * Tolerance past the first opaque surface, in metres along the ray. Same value Pascal uses for
 * "at the wall face": an item flush with a wall or sunk a little into the floor still counts.
 */
export const BEHIND_SURFACE_EPSILON = 0.35

export type ClickedSurface = {
  /** Pascal node kind of the node that got the click. */
  readonly kind: string
  /** Click came from a handle (ceiling corner …): the user meant that node, never swap. */
  readonly viaHandle?: boolean
}

/** Where the ray enters one candidate item's box, in metres from the ray origin. */
export type ItemRayEntry = { readonly id: string; readonly entry: number }

/**
 * Id of the item that should get the click instead of `clicked`, or null to keep Pascal's pick.
 * `opaque`: distances of hits that block the view (visible walls, slabs, doors, windows),
 * including the clicked node's own hit when it is itself opaque.
 */
export function pickItemOnRay(
  clicked: ClickedSurface,
  opaque: readonly number[],
  items: readonly ItemRayEntry[],
  epsilon: number = BEHIND_SURFACE_EPSILON,
): string | null {
  if (clicked.viaHandle || !SURFACE_KINDS.has(clicked.kind)) return null
  const limit = opaque.reduce((min, d) => Math.min(min, d), Number.POSITIVE_INFINITY) + epsilon
  let best: ItemRayEntry | null = null
  for (const item of items) {
    // entry 0 = the ray starts inside the box (camera inside the item): not a click on it.
    if (!(item.entry > 1e-6) || item.entry > limit) continue
    if (!best || item.entry < best.entry) best = item
  }
  return best ? best.id : null
}
