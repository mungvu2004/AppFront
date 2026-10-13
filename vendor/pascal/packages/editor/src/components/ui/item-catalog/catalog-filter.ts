import type { CatalogItem } from './catalog-items'

/**
 * The nine fixed furniture groups and the accent-blind search behind them —
 * AppFront F-15 W2-D (#104).
 *
 * `lib/catalog-panel-model.ts` already filters the catalog by category, tag and
 * substring, but its search is `toLowerCase().includes()`: typing "ghe" finds
 * nothing when the item is called "Ghế", and a Vietnamese keyboard is exactly
 * where that typing comes from. Rather than change that shared filter (other
 * surfaces depend on its category semantics), this module computes the item
 * list the AppFront furniture panel hands over as `overrideItems`.
 *
 * The groups are AppFront's, not Pascal's: Pascal sorts its catalog by where an
 * item goes (`furniture`, `appliance`, `bathroom`…) while the panel sorts it by
 * what the item is (bàn, ghế, giường…). The map below is the join, and it is a
 * list of tags on purpose — an item carries many tags and only one category.
 */

export const FURNITURE_GROUP_IDS = [
  'all',
  'table',
  'chair',
  'bed',
  'sofa',
  'cabinet',
  'sanitary',
  'kitchen',
  'equipment',
  'mine',
] as const

export type FurnitureGroupId = (typeof FURNITURE_GROUP_IDS)[number]

/** Tags that put an item in a group. `all` and `mine` are answered separately. */
const GROUP_TAGS: Record<Exclude<FurnitureGroupId, 'all' | 'mine'>, readonly string[]> = {
  table: ['table', 'desk', 'nightstand', 'coffee-table'],
  chair: ['chair', 'stool', 'seat', 'bench', 'armchair'],
  bed: ['bed', 'mattress', 'bunk'],
  sofa: ['sofa', 'couch', 'sectional', 'loveseat'],
  cabinet: ['cabinet', 'shelf', 'shelving', 'storage', 'rack', 'wardrobe', 'dresser', 'organizer'],
  sanitary: ['toilet', 'sink', 'bathtub', 'shower', 'basin', 'bidet', 'bathroom'],
  kitchen: ['kitchen', 'stove', 'oven', 'fridge', 'refrigerator', 'dishwasher', 'cooktop'],
  equipment: ['appliance', 'equipment', 'hvac', 'machine', 'washer', 'dryer', 'heater'],
}

/** Categories that put an item in a group even when its tags say nothing. */
const GROUP_CATEGORIES: Partial<Record<FurnitureGroupId, readonly string[]>> = {
  sanitary: ['bathroom'],
  kitchen: ['kitchen'],
  equipment: ['appliance'],
}

const DIACRITICS = /[̀-ͯ]/g

/**
 * Lowercase and strip tone marks, so "Ghế" and "ghe" are the same key.
 *
 * `đ` survives NFD decomposition as its own letter, so it is replaced by hand —
 * without that line, "do" never finds "Đồ bếp".
 */
export function foldDiacritics(text: string): string {
  return text
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
}

function matchesGroup(item: CatalogItem, group: FurnitureGroupId): boolean {
  if (group === 'all') return true
  // ponytail: "mine" is "an id the system catalog does not use". A real owner
  // field on the asset would be better; there isn't one on `AssetInput` yet.
  if (group === 'mine') return item.id.startsWith('user')
  const tags = item.tags ?? []
  if (tags.some((tag) => GROUP_TAGS[group].includes(tag))) return true
  const categories = GROUP_CATEGORIES[group]
  return categories !== undefined && categories.includes(item.category ?? '')
}

function matchesSearch(item: CatalogItem, folded: string): boolean {
  if (!folded) return true
  if (foldDiacritics(item.name).includes(folded)) return true
  return (item.tags ?? []).some((tag) => foldDiacritics(tag).includes(folded))
}

/** The items a group chip plus a search box should show, in catalog order. */
export function filterFurnitureItems(
  items: readonly CatalogItem[],
  options: { group?: FurnitureGroupId; search?: string } = {},
): CatalogItem[] {
  const group = options.group ?? 'all'
  const folded = foldDiacritics((options.search ?? '').trim())
  return items.filter((item) => matchesGroup(item, group) && matchesSearch(item, folded))
}

/** How many items each chip would show, so a chip can carry its own count. */
export function furnitureGroupCounts(
  items: readonly CatalogItem[],
  search = '',
): Record<FurnitureGroupId, number> {
  const counts = {} as Record<FurnitureGroupId, number>
  for (const group of FURNITURE_GROUP_IDS) {
    counts[group] = filterFurnitureItems(items, { group, search }).length
  }
  return counts
}
