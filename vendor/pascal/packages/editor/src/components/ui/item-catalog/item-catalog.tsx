'use client'

import type { AssetInput } from '@pascal-app/core'
import { resolveCdnUrl } from '@pascal-app/viewer'
import { useEffect } from 'react'
import { triggerSFX } from './../../../lib/sfx-bus'
import { cn } from './../../../lib/utils'
import useEditor, { type CatalogCategory } from './../../../store/use-editor'
import { resolveAssetSnapTarget, SnapTargetBadge } from '../snap-target-badge'
import { activateCatalogItem, filterCatalogItems, isCatalogItemSelected } from '../../../lib/catalog-panel-model'
import { CATALOG_DRAG_TYPE } from './batch-replace'

export function ItemCatalog({
  category,
  items: itemsOverride,
  activePlacementTag = null,
  activeFunctionalTag = null,
  search = '',
  overrideItems,
  leadingTile,
  emptyState,
  monochrome = false,
  readOnly = false,
}: {
  category: CatalogCategory
  items?: AssetInput[]
  activePlacementTag?: string | null
  activeFunctionalTag?: string | null
  search?: string
  /** When set, bypasses all filtering and displays these items directly (used for server search results) */
  overrideItems?: AssetInput[]
  /** Rendered as the first grid cell, always visible when there are items. */
  leadingTile?: React.ReactNode
  /** Rendered when there are no items to show. Replaces the empty grid. */
  emptyState?: React.ReactNode
  /**
   * Draw the thumbnails as one-colour silhouettes (AppFront A1 — #103).
   *
   * AppFront's palette is token-only at the UI layer, and a photographic
   * thumbnail smuggles a second palette into the sidebar: twenty product shots
   * are twenty accent colours competing with the one colour that is supposed to
   * mean "interactive" (A2). The image is kept — it is the only thing that says
   * what the item looks like — but it is reduced to the panel's own ink.
   */
  monochrome?: boolean
  /** Viewer role: a tile reads as locked and clicking it arms nothing (#108). */
  readOnly?: boolean
}) {
  const selectedItem = useEditor((state) => state.selectedItem)
  const filteredItems = filterCatalogItems({ category, items: itemsOverride, overrideItems, search, activePlacementTag, activeFunctionalTag })

  if (filteredItems.length === 0 && emptyState) {
    return <>{emptyState}</>
  }

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))' }}
    >
      {leadingTile}
      {filteredItems.map((item, index) => {
        const isSelected = isCatalogItemSelected(item, selectedItem)
        const snapTarget = resolveAssetSnapTarget(item?.attachTo)
        return (
          <button
            className={cn(
              'group relative flex flex-col gap-1.5 rounded-xl p-1.5 transition-colors hover:cursor-pointer hover:bg-sidebar-accent',
              isSelected && 'bg-sidebar-accent ring-2 ring-primary-foreground',
              readOnly && 'cursor-not-allowed opacity-60 hover:bg-transparent',
            )}
            disabled={readOnly}
            // #107: a tile can be dropped on a detected group to replace it.
            draggable={!readOnly}
            key={index}
            onDragStart={(event) => {
              event.dataTransfer.setData(CATALOG_DRAG_TYPE, item.id)
              event.dataTransfer.effectAllowed = 'copy'
            }}
            onClick={() => {
              if (readOnly) return
              triggerSFX('sfx:menu-click')
              activateCatalogItem(item)
            }}
            onMouseEnter={() => triggerSFX('sfx:menu-hover')}
            type="button"
          >
            <div className="relative aspect-square w-full overflow-hidden rounded-lg">
              <img
                alt={item.name}
                className={cn(
                  'h-full w-full object-cover',
                  monochrome && 'opacity-80 grayscale contrast-125',
                )}
                loading="eager"
                src={resolveCdnUrl(item.thumbnail) || ''}
              />
              {snapTarget && (
                <SnapTargetBadge className="absolute right-1 bottom-1" target={snapTarget} />
              )}
            </div>
            <span className="truncate px-0.5 text-left font-medium text-[11px] text-muted-foreground group-hover:text-foreground">
              {item.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}
