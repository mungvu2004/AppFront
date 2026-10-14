'use client'

import { Copy, X } from 'lucide-react'
import { type RefObject, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { roomArea as vi } from '../../../i18n/regions/roomArea'
import { getPascalRoot } from '../../../lib/pascal-root'
import type {
  RoomAreaGrouping,
  RoomAreaSort,
  RoomAreaTable,
} from '../../../lib/floorplan/room-area'
import { cn } from '../../../lib/utils'

/**
 * Full-page "Diện tích phòng" table (#74): the same `roomAreaTable` model as the
 * collapsed panel, laid out as a real table with every column, group subtotals,
 * sortable headers and copy. The pure view is `RoomAreaFullTable` (renderable
 * from props alone); `RoomAreaFullPage` adds the dialog behaviour — Esc closes
 * (A12) and focus goes back to the button that opened it.
 */

export type RoomAreaFullTableProps = {
  table: RoomAreaTable
  grouping: RoomAreaGrouping
  sort: RoomAreaSort
  copied: boolean
  onGroupingChange: (value: RoomAreaGrouping) => void
  onSortChange: (value: RoomAreaSort) => void
  onCopy: () => void
  onClose: () => void
  closeRef?: RefObject<HTMLButtonElement | null>
}

const NEXT_AREA_SORT: Record<RoomAreaSort, RoomAreaSort> = {
  'area-desc': 'area-asc',
  'area-asc': 'area-desc',
  name: 'area-desc',
}

export function RoomAreaFullTable({
  table,
  grouping,
  sort,
  copied,
  onGroupingChange,
  onSortChange,
  onCopy,
  onClose,
  closeRef,
}: RoomAreaFullTableProps) {
  const areaSort = sort === 'area-asc' ? 'ascending' : sort === 'area-desc' ? 'descending' : 'none'
  return (
    <div
      aria-label={vi.title}
      aria-modal="true"
      className="fixed inset-0 z-[100] flex flex-col bg-background text-foreground text-sm"
      role="dialog"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-border/60 border-b px-4 py-3">
        <div>
          <h2 className="font-semibold text-base">{vi.title}</h2>
          <div className="text-muted-foreground text-xs">
            {vi.total} <span className="font-semibold tabular-nums">{table.totalText}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-muted-foreground text-xs">
            {vi.groupBy}
            <select
              className="rounded-md border border-border/60 bg-background px-2 py-1 text-foreground text-sm"
              onChange={(event) => onGroupingChange(event.target.value as RoomAreaGrouping)}
              value={grouping}
            >
              <option value="level">{vi.groupByLevel}</option>
              <option value="occupancy">{vi.groupByOccupancy}</option>
            </select>
          </label>
          <button
            className="flex items-center gap-1.5 rounded-md border border-border/60 px-2 py-1 text-xs hover:bg-accent"
            onClick={onCopy}
            type="button"
          >
            <Copy className="size-4" />
            {copied ? vi.copied : vi.copyTable}
          </button>
          <button
            aria-label={vi.closeFullTable}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={onClose}
            ref={closeRef}
            title={vi.closeFullTable}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto px-4 py-3">
        {table.groups.length === 0 ? (
          <div className="rounded-lg border border-border/60 border-dashed px-3 py-8 text-center">
            <p className="font-medium">{vi.emptyTitle}</p>
            <p className="mt-1 text-muted-foreground text-xs">{vi.emptyBody}</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-border border-b text-muted-foreground text-xs">
                <th className="py-1.5 pr-3 font-medium" scope="col">
                  {vi.column.number}
                </th>
                <th
                  aria-sort={sort === 'name' ? 'ascending' : 'none'}
                  className="py-1.5 pr-3"
                  scope="col"
                >
                  <button
                    className={cn('font-medium hover:text-foreground', sort === 'name' && 'text-foreground')}
                    onClick={() => onSortChange('name')}
                    type="button"
                  >
                    {vi.column.name}
                  </button>
                </th>
                <th className="py-1.5 pr-3 font-medium" scope="col">
                  {vi.column.occupancy}
                </th>
                <th aria-sort={areaSort} className="py-1.5 text-right" scope="col">
                  <button
                    className={cn('font-medium hover:text-foreground', sort !== 'name' && 'text-foreground')}
                    onClick={() => onSortChange(NEXT_AREA_SORT[sort])}
                    type="button"
                  >
                    {vi.column.area}
                  </button>
                </th>
              </tr>
            </thead>
            {table.groups.map((group) => (
              <tbody key={group.key}>
                <tr>
                  <th className="bg-accent/30 px-2 py-1.5 font-semibold" colSpan={4} scope="colgroup">
                    {group.label}
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <tr className="border-border/40 border-b" key={row.id}>
                    <td className="py-1.5 pr-3 tabular-nums">{row.number || '—'}</td>
                    <td className="py-1.5 pr-3">{row.name}</td>
                    <td className="py-1.5 pr-3">{row.occupancy || vi.noOccupancy}</td>
                    <td className="py-1.5 text-right tabular-nums">{row.areaText}</td>
                  </tr>
                ))}
                <tr className="font-medium">
                  <td className="py-1.5 pr-3" colSpan={3}>
                    {vi.subtotal}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{group.subtotalText}</td>
                </tr>
              </tbody>
            ))}
            <tfoot>
              <tr className="border-border border-t font-semibold">
                <td className="py-2 pr-3" colSpan={3}>
                  {vi.total}
                </td>
                <td className="py-2 text-right tabular-nums">{table.totalText}</td>
              </tr>
            </tfoot>
          </table>
        )}
        {table.issues.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1 text-muted-foreground text-xs">
            {table.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export function RoomAreaFullPage({
  returnFocusTo,
  ...props
}: RoomAreaFullTableProps & { returnFocusTo: RefObject<HTMLElement | null> }) {
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const { onClose } = props

  useEffect(() => {
    const opener = returnFocusTo.current
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // A12: Esc closes the top layer only — keep it from reaching tool shortcuts.
      event.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      opener?.focus()
    }
  }, [onClose, returnFocusTo])

  if (typeof document === 'undefined') return null
  // AppFront: into `.pascal-root`, where Pascal's scoped stylesheet applies —
  // portalled to `document.body` the dialog renders unstyled and see-through
  // over the host page (23R-B-016). `.pascal-root` contains layout, so
  // `fixed inset-0` covers the editor frame.
  return createPortal(
    <RoomAreaFullTable {...props} closeRef={closeRef} />,
    getPascalRoot() ?? document.body,
  )
}
