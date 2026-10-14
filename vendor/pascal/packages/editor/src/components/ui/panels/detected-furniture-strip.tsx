'use client'

import { useScene } from '@pascal-app/core'
import { useMemo, useRef, useState } from 'react'
import { furnitureLibrary as vi } from '../../../i18n/regions/furnitureLibrary'
import { cn } from '../../../lib/utils'
import useEditor from '../../../store/use-editor'
import {
  applyReplaceAll,
  CATALOG_DRAG_TYPE,
  type DetectedGroup,
  groupDetectedItems,
  planReplaceAll,
  type ReplacePlan,
} from '../item-catalog/batch-replace'
import { CATALOG_ITEMS } from '../item-catalog/catalog-items'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../primitives/dialog'

/**
 * The "Đã phát hiện" strip pinned above the furniture grid — #105–#107.
 *
 * "Thay thế tất cả" uses the catalog item the reviewer last picked; dropping a
 * tile on a group does the same with the dragged item. Either way the batch
 * only opens a preview (`planReplaceAll`); the scene changes on confirm, as one
 * undo step (`applyReplaceAll`).
 */
export function DetectedFurnitureStrip({ readOnly }: { readOnly: boolean }) {
  const nodes = useScene((state) => state.nodes)
  const selectedItem = useEditor((state) => state.selectedItem)
  const groups = useMemo(() => groupDetectedItems(nodes), [nodes])
  const [plan, setPlan] = useState<ReplacePlan | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  // No Radix trigger here, so the dialog cannot return focus by itself (23F-E-005).
  const returnFocus = useRef<HTMLElement | null>(null)

  if (groups.length === 0 || readOnly) return null

  const handleDrop = (group: DetectedGroup, event: React.DragEvent) => {
    setDropTarget(null)
    returnFocus.current = event.currentTarget.querySelector('button')
    const id = event.dataTransfer.getData(CATALOG_DRAG_TYPE)
    const item = CATALOG_ITEMS.find((candidate) => candidate.id === id)
    if (item) setPlan(planReplaceAll(group, item))
  }

  return (
    <section aria-label={vi.detectedTitle} className="flex flex-col gap-1.5">
      <h3 className="font-medium text-xs">{vi.detectedTitle}</h3>
      <p className="text-muted-foreground text-xs">{vi.detectedHint}</p>
      <ul className="flex flex-col gap-1">
        {groups.map((group) => (
          <li
            className={cn(
              'flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5',
              dropTarget === group.assetId && 'border-primary bg-accent',
            )}
            key={group.assetId}
            onDragLeave={(event) => {
              // Crossing into the row's own label/button fires dragleave too; only leaving the row clears it.
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null)
            }}
            onDragOver={(event) => {
              if (!event.dataTransfer.types.includes(CATALOG_DRAG_TYPE)) return
              event.preventDefault()
              setDropTarget(group.assetId)
            }}
            onDrop={(event) => handleDrop(group, event)}
          >
            <span className="truncate">{vi.detectedGroup(group.name, group.itemIds.length)}</span>
            <button
              className="shrink-0 rounded-md px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
              disabled={!selectedItem}
              onClick={(event) => {
                returnFocus.current = event.currentTarget
                if (selectedItem) setPlan(planReplaceAll(group, selectedItem))
              }}
              title={selectedItem ? undefined : vi.replaceAllNeedsItem}
              type="button"
            >
              {vi.replaceAll}
            </button>
          </li>
        ))}
      </ul>

      <Dialog onOpenChange={(open) => !open && setPlan(null)} open={plan !== null}>
        <DialogContent
          className="sm:max-w-md"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            returnFocus.current?.focus()
          }}
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle>
              {plan && vi.previewTitle(plan.group.name, plan.rows.length)}
            </DialogTitle>
            <DialogDescription>{vi.previewBody}</DialogDescription>
          </DialogHeader>
          <ul aria-label={vi.previewList} className="flex max-h-60 flex-col gap-1 overflow-y-auto">
            {plan?.rows.map((row, index) => (
              <li className="rounded-md bg-accent/50 px-2 py-1 text-sm" key={row.itemId}>
                {vi.previewRow(row.from, index + 1, row.to)}
              </li>
            ))}
          </ul>
          <DialogFooter>
            <button
              className="rounded-full border border-border px-4 py-2 text-sm hover:bg-accent"
              onClick={() => setPlan(null)}
              type="button"
            >
              {vi.cancel}
            </button>
            <button
              className="rounded-full bg-primary px-4 py-2 text-primary-foreground text-sm"
              onClick={() => {
                if (plan) applyReplaceAll(plan)
                setPlan(null)
              }}
              type="button"
            >
              {vi.replaceAll}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
