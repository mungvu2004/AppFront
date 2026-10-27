/**
 * AppFront addition (UX-R1 K38/K43), not an upstream file. A one-floor apartment needs walls,
 * openings and finishes; the other build tools (fence, roof, stair, elevator, terrain, MEP, …)
 * move behind the Build grid's "Thêm" tile. Pure (no `@pascal-app/*`) so vitest can load it.
 */

/** Tools kept on the grid, in this order. */
export const APARTMENT_TOOL_IDS = ['wall', 'door', 'window', 'slab', 'ceiling', 'column', 'kitchen', 'painting'] as const

const RANK = new Map<string, number>(APARTMENT_TOOL_IDS.map((id, index) => [id, index]))

/** Split the palette into the apartment set (`main`, fixed order) and the rest (`more`, palette order). */
export function splitApartmentTools<T extends { readonly id: string }>(types: readonly T[]): { main: T[]; more: T[] } {
  const main = types.filter((type) => RANK.has(type.id)).sort((a, b) => RANK.get(a.id)! - RANK.get(b.id)!)
  const more = types.filter((type) => !RANK.has(type.id))
  return { main, more }
}
