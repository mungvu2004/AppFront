'use client'

import { useScene } from '@pascal-app/core'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { furnitureLibrary as vi } from '../../../i18n/regions/furnitureLibrary'
import { cn } from '../../../lib/utils'
import {
  filterFurnitureItems,
  FURNITURE_GROUP_IDS,
  type FurnitureGroupId,
  furnitureGroupCounts,
} from '../item-catalog/catalog-filter'
import { CATALOG_ITEMS } from '../item-catalog/catalog-items'
import { ItemCatalog } from '../item-catalog/item-catalog'

/**
 * "Thư viện đồ đạc" — AppFront F-15 W2-D (#103, #104, #108).
 *
 * Pascal's own catalog sidebar sorts by where a thing goes; AppFront's reviewer
 * looks for what a thing is. So this panel keeps Pascal's grid and placement
 * behaviour and replaces only the two things above it: the nine fixed groups
 * and a search box that ignores tone marks (`catalog-filter.ts`).
 *
 * The grid is handed `overrideItems` rather than a category, because the group
 * chips are a different axis from `CatalogCategory` — see `catalog-filter.ts`.
 */
export function FurnitureLibraryPanel() {
  const readOnly = useScene((state) => state.readOnly)
  const [group, setGroup] = useState<FurnitureGroupId>('all')
  const [search, setSearch] = useState('')

  const items = useMemo(
    () => filterFurnitureItems(CATALOG_ITEMS, { group, search }),
    [group, search],
  )
  const counts = useMemo(() => furnitureGroupCounts(CATALOG_ITEMS, search), [search])

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 text-sm">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">{vi.title}</h2>
        <span className="text-muted-foreground text-xs tabular-nums">
          {vi.count(items.length)}
        </span>
      </header>

      <label className="relative block">
        <span className="sr-only">{vi.searchLabel}</span>
        <Search className="pointer-events-none absolute top-2 left-2 size-4 text-muted-foreground" />
        <input
          className="w-full rounded-md border border-border/60 bg-background py-1.5 pr-2 pl-8 text-sm"
          onChange={(event) => setSearch(event.target.value)}
          placeholder={vi.searchPlaceholder}
          type="search"
          value={search}
        />
      </label>

      <div aria-label={vi.groupLabel} className="flex flex-wrap gap-1.5" role="group">
        {FURNITURE_GROUP_IDS.map((id) => (
          <button
            aria-pressed={group === id}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs transition-colors',
              group === id
                ? 'border-transparent bg-accent font-medium text-foreground'
                : 'border-border/60 text-muted-foreground hover:bg-accent/50',
              counts[id] === 0 && group !== id && 'opacity-50',
            )}
            key={id}
            onClick={() => setGroup(id)}
            type="button"
          >
            {vi.group[id]}
          </button>
        ))}
      </div>

      {readOnly && <p className="text-muted-foreground text-xs">{vi.readOnlyNotice}</p>}

      <ItemCatalog
        category="furniture"
        emptyState={
          <div className="rounded-lg border border-border/60 border-dashed px-3 py-6 text-center">
            <p className="font-medium">{vi.emptyTitle}</p>
            <p className="mt-1 text-muted-foreground text-xs">{vi.emptyBody}</p>
          </div>
        }
        items={items}
        monochrome
        overrideItems={items}
        readOnly={readOnly}
      />

      <p className="mt-auto border-border/50 border-t pt-2 text-muted-foreground text-xs">
        {vi.monochromeNotice}
      </p>
    </div>
  )
}
