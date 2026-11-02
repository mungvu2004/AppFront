/**
 * AppFront addition (đợt sửa 2 H1, C2; đợt 3 nhóm D), not an upstream file. In Select mode Pascal
 * hands a click (and the hover outline) to the NEAREST mesh the ray hits. That is often not the
 * piece of furniture the user points at:
 *   - cutaway / 'down' walls keep an invisible full-height collision mesh, and a hidden wall only
 *     yields to things within 0.35 m of it (`nodes/wall/pointer-transparency.ts`), so a bed or
 *     chair in the room behind it loses to a wall the user cannot see;
 *   - furniture is not solid: the ray slips between chair legs, under a bed frame or through a
 *     plant's leaves and lands on the slab, the wall, the rug or the cabinet behind, which then wins.
 * Rule here, over the items whose box the ray enters before the first surface that actually blocks
 * the view (+ a small tolerance; hidden walls and ceilings do not block):
 *   1. rugs and other flat items (< 5 cm tall) are see-through like the floor: they win only when
 *      no other item is on the ray;
 *   2. a box the ray only passes through (no mesh hit) never shadows a smaller-or-equal item whose
 *      mesh the ray really hits (lamp on a nightstand seen across the empty space above a bed);
 *   3. the nearest item wins (real hit distance when the ray hits its mesh, else its box entry);
 *      items within OVERLAP_WINDOW of the nearest overlap and the smallest box wins, so a plant /
 *      lamp / pillow beats the cabinet / table / bed it stands against.
 * A spot with no item on the ray keeps Pascal's choice. Pure so the rule is testable;
 * `select-priority-install.ts` feeds it from the live scene.
 */

/** Kinds whose click may be handed over to an item standing in front of / behind them. */
export const SURFACE_KINDS: ReadonlySet<string> = new Set(['wall', 'slab', 'ceiling', 'door', 'window'])

/**
 * Tolerance past the first opaque surface, in metres along the ray. Same value Pascal uses for
 * "at the wall face": an item flush with a wall or sunk a little into the floor still counts.
 */
export const BEHIND_SURFACE_EPSILON = 0.35

/** Two items whose distances along the ray differ by less than this overlap: the smaller box wins. */
export const OVERLAP_WINDOW = 0.15

/** Items lower than this (m) are see-through like the floor (rugs, bath mats). */
export const FLAT_HEIGHT = 0.05

export type ClickedSurface = {
  /** Pascal node kind of the node that got the click. */
  readonly kind: string
  /** Click came from a handle (ceiling corner …): the user meant that node, never swap. */
  readonly viaHandle?: boolean
}

/** One candidate item on the ray. Distances in metres from the ray origin. */
export type ItemRayEntry = {
  readonly id: string
  /** Where the ray enters the item's box. */
  readonly entry: number
  /** Where the ray hits the item's own mesh, when it does. */
  readonly hit?: number | undefined
  /** Box volume in m³ (unknown = largest). */
  readonly volume?: number
  /** Box height in m (unknown = not flat). */
  readonly height?: number
}

/** False when the clicked node is never handed over (handles, stairs, roofs, zones …). */
export function canPreferItem(clicked: ClickedSurface): boolean {
  return !clicked.viaHandle && (clicked.kind === 'item' || SURFACE_KINDS.has(clicked.kind))
}

const volumeOf = (item: ItemRayEntry): number => item.volume ?? Number.POSITIVE_INFINITY
const distanceOf = (item: ItemRayEntry): number => item.hit ?? item.entry
const isFlat = (item: ItemRayEntry): boolean => item.height !== undefined && item.height < FLAT_HEIGHT

/**
 * Id of the item that should get the click, or null to keep Pascal's pick. It may be the clicked
 * item itself (the caller then keeps the original event).
 * `opaque`: distances of hits that block the view (visible walls, slabs, doors, windows),
 * including the clicked node's own hit when it is itself opaque.
 */
export function pickItemOnRay(
  clicked: ClickedSurface,
  opaque: readonly number[],
  items: readonly ItemRayEntry[],
  epsilon: number = BEHIND_SURFACE_EPSILON,
): string | null {
  if (!canPreferItem(clicked)) return null
  const limit = opaque.reduce((min, d) => Math.min(min, d), Number.POSITIVE_INFINITY) + epsilon
  // entry 0 = the ray starts inside the box (camera inside the item): not a click on it.
  const onRay = items.filter((item) => item.entry > 1e-6 && item.entry <= limit)
  const solid = onRay.filter((item) => !isFlat(item))
  let pool = solid.length > 0 ? solid : onRay

  let struck: ItemRayEntry | null = null
  for (const item of pool) {
    if (item.hit !== undefined && (!struck || item.hit < (struck.hit as number))) struck = item
  }
  if (struck) {
    const struckVolume = volumeOf(struck)
    pool = pool.filter((item) => item.hit !== undefined || volumeOf(item) < struckVolume)
  }

  const nearest = pool.reduce((min, item) => Math.min(min, distanceOf(item)), Number.POSITIVE_INFINITY)
  let best: ItemRayEntry | null = null
  for (const item of pool) {
    if (distanceOf(item) > nearest + OVERLAP_WINDOW) continue
    const smaller = !best || volumeOf(item) < volumeOf(best)
    const tieNearer = best !== null && volumeOf(item) === volumeOf(best) && distanceOf(item) < distanceOf(best)
    if (smaller || tieNearer) best = item
  }
  return best ? best.id : null
}
