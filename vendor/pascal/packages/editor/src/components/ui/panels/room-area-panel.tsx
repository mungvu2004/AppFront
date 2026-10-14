'use client'

import { type AnyNode, emitter, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { Copy, ExternalLink, Maximize2, Minimize2, ScanSearch, Undo2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { roomArea as vi } from '../../../i18n/regions/roomArea'
import {
  closedRoomCount,
  levelNamesOf,
  type RoomAreaGrouping,
  type RoomAreaRow,
  type RoomAreaSort,
  type RoomAreaStatus,
  roomAreaTable,
  roomAreaTableToText,
} from '../../../lib/floorplan/room-area'
import { roomAreaStateOf } from '../../../lib/floorplan/room-area-state'
import { cn } from '../../../lib/utils'
import { RoomAreaFullPage } from './room-area-full-page'

/**
 * "Diện tích phòng" — the room-area panel of AppFront F-15 W2-D (#71–86).
 *
 * The numbers all come from `lib/floorplan/room-area.ts`; this file only lays
 * them out and wires the three things a panel can do that a table cannot:
 * select and frame a room in 3D (#77), mirror hover both ways (#78), and
 * rename a room in place with one undo step (#79/#80).
 *
 * Hover and selection go through the viewer store rather than a new event,
 * because that store is already what the 3D hover highlight reads — a panel
 * event would have had to be mirrored into it anyway.
 */

/** #84: how many rooms the collapsed mode keeps. */
const COLLAPSED_LIMIT = 5
/** A7: the autosave window AppFront promises for an edit. */
const RENAME_AUTOSAVE_MS = 800
/** A8: how long the undo affordance stays reachable. */
const UNDO_WINDOW_MS = 8000

/** A4: exactly three states, and the fourth is what this map exists to prevent. */
const STATUS_CLASS: Record<RoomAreaStatus, string> = {
  trusted: 'bg-muted-foreground',
  suspect: 'bg-amber-500',
  reviewed: 'bg-emerald-500',
}

const STATUS_LABEL: Record<RoomAreaStatus, string> = {
  trusted: vi.statusTrusted,
  suspect: vi.statusSuspect,
  reviewed: vi.statusReviewed,
}

const BAND_CLASS = ['bg-sky-500', 'bg-violet-500', 'bg-muted-foreground'] as const

type PendingRename = { id: string; previous: string; next: string }

function StatusDot({ status }: { status: RoomAreaStatus }) {
  return (
    // AppFront 23R-E-005: `role="img"` — an `aria-label` on a role-less span is ignored.
    <span
      aria-label={STATUS_LABEL[status]}
      className={cn('inline-block size-2 shrink-0 rounded-full', STATUS_CLASS[status])}
      role="img"
      title={STATUS_LABEL[status]}
    />
  )
}

export function RoomAreaPanel() {
  const nodes = useScene((state) => state.nodes)
  const readOnly = useScene((state) => state.readOnly)
  const updateNode = useScene((state) => state.updateNode)
  const setSelection = useViewer((state) => state.setSelection)
  const setHoveredId = useViewer((state) => state.setHoveredId)
  const hoveredId = useViewer((state) => state.hoveredId)
  const selectedZoneId = useViewer((state) => state.selection.zoneId)

  const [grouping, setGrouping] = useState<RoomAreaGrouping>('level')
  const [sort, setSort] = useState<RoomAreaSort>('area-desc')
  const [levelId, setLevelId] = useState<string>('')
  const [collapsed, setCollapsed] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [pendingRename, setPendingRename] = useState<PendingRename | null>(null)
  const [copied, setCopied] = useState(false)
  const [gapReport, setGapReport] = useState<string | null>(null)
  const [fullPage, setFullPage] = useState(false)
  const fullPageButtonRef = useRef<HTMLButtonElement | null>(null)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const closeFullPage = useCallback(() => setFullPage(false), [])
  const levelNames = useMemo(() => levelNamesOf(nodes), [nodes])
  const table = useMemo(
    () =>
      roomAreaTable(nodes, {
        grouping,
        sort,
        ...(levelId ? { levelIds: [levelId] } : {}),
        ...(collapsed ? { limit: COLLAPSED_LIMIT } : {}),
      }),
    [nodes, grouping, sort, levelId, collapsed],
  )

  // The full-page view lists every room; only the level filter carries over.
  const fullTable = useMemo(
    () => roomAreaTable(nodes, { grouping, sort, ...(levelId ? { levelIds: [levelId] } : {}) }),
    [nodes, grouping, sort, levelId],
  )

  useEffect(
    () => () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    },
    [],
  )

  // #77: one click both selects the room and frames the camera on it, so the
  // table row and the 3D view never disagree about what is being looked at.
  const selectRow = useCallback(
    (row: RoomAreaRow) => {
      setSelection({ zoneId: row.id, selectedIds: [row.id] })
      emitter.emit('camera-controls:focus', { nodeId: row.id })
    },
    [setSelection],
  )

  const commitRename = useCallback(
    (id: string, previous: string, next: string) => {
      const trimmed = next.trim()
      if (!trimmed || trimmed === previous) return
      updateNode(id, { name: trimmed } as Partial<AnyNode>)
      setPendingRename({ id, previous, next: trimmed })
    },
    [updateNode],
  )

  // A7: no save button — the edit lands 800 ms after the last keystroke, and
  // the editor's own autosave carries it to the host from there.
  const scheduleRename = useCallback(
    (id: string, previous: string, next: string) => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
      autosaveTimer.current = setTimeout(() => {
        commitRename(id, previous, next)
      }, RENAME_AUTOSAVE_MS)
    },
    [commitRename],
  )

  // A8: every change is undoable, and the way back stays visible for 8 s.
  useEffect(() => {
    if (!pendingRename) return
    const timer = setTimeout(() => setPendingRename(null), UNDO_WINDOW_MS)
    return () => clearTimeout(timer)
  }, [pendingRename])

  const undoRename = useCallback(() => {
    if (!pendingRename) return
    updateNode(pendingRename.id, { name: pendingRename.previous } as Partial<AnyNode>)
    setPendingRename(null)
  }, [pendingRename, updateNode])

  const copyTable = useCallback(() => {
    void navigator.clipboard?.writeText(roomAreaTableToText(table)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), UNDO_WINDOW_MS)
    })
  }, [table])

  // #83: the empty state's own next step. Detection already runs on every scene
  // change, so the button answers the question the empty table raises — are the
  // walls closed at all — instead of re-running a sync that is already running.
  const checkWallGaps = useCallback(() => {
    const rooms = closedRoomCount(nodes, levelId ? [levelId] : [...levelNames.keys()])
    setGapReport(rooms > 0 ? vi.gapsClosed(rooms) : vi.gapsOpen)
  }, [nodes, levelId, levelNames])

  const hasRows = table.groups.length > 0
  const state = roomAreaStateOf({
    sceneLoaded: Object.keys(nodes).length > 0,
    rowCount: table.groups.reduce((sum, group) => sum + group.rows.length, 0),
    issueCount: table.issues.length,
    readOnly,
    collapsed,
  })

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 text-sm">
      <header className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{vi.title}</h2>
        <div className="flex items-center gap-1">
          <button
            aria-label={vi.copyTable}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={copyTable}
            title={copied ? vi.copied : vi.copyTable}
            type="button"
          >
            <Copy className="size-4" />
          </button>
          {/* AppFront 23R-E-004: the swapped `title` is never announced. */}
          <span className="sr-only" role="status">
            {copied ? vi.copied : ''}
          </span>
          <button
            aria-label={vi.openFullPage}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => setFullPage(true)}
            ref={fullPageButtonRef}
            title={vi.openFullPage}
            type="button"
          >
            <ExternalLink className="size-4" />
          </button>
          <button
            aria-label={collapsed ? vi.fullTable : vi.collapsed}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => setCollapsed((value) => !value)}
            title={collapsed ? vi.fullTable : vi.collapsed}
            type="button"
          >
            {collapsed ? <Maximize2 className="size-4" /> : <Minimize2 className="size-4" />}
          </button>
        </div>
      </header>

      {/* A15: the total is its own element and its unit is split off, so a
          screen reader reads a number and a unit, not one glued string. */}
      <div className="rounded-lg border border-border/60 bg-accent/30 px-3 py-2">
        <div className="text-muted-foreground text-xs">{vi.total}</div>
        <div className="font-semibold text-lg tabular-nums">{table.totalText}</div>
        {collapsed && (
          <div className="text-muted-foreground text-xs">
            {vi.collapsedHint(COLLAPSED_LIMIT)}
          </div>
        )}
      </div>

      {table.bands.length > 0 && (
        <div>
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            {table.bands.map((band, index) => (
              <div
                className={cn(BAND_CLASS[index] ?? BAND_CLASS[2])}
                key={band.key}
                style={{ width: `${band.percent}%` }}
                title={`${band.label} · ${band.percent}%`}
              />
            ))}
          </div>
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground text-xs">
            {table.bands.map((band, index) => (
              <li className="flex items-center gap-1.5" key={band.key}>
                <span
                  className={cn(
                    'inline-block size-2 rounded-full',
                    BAND_CLASS[index] ?? BAND_CLASS[2],
                  )}
                />
                {band.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-muted-foreground text-xs">
          {vi.groupBy}
          <select
            className="rounded-md border border-border/60 bg-background px-2 py-1 text-foreground text-sm"
            onChange={(event) => setGrouping(event.target.value as RoomAreaGrouping)}
            value={grouping}
          >
            <option value="level">{vi.groupByLevel}</option>
            <option value="occupancy">{vi.groupByOccupancy}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-muted-foreground text-xs">
          {vi.sortBy}
          <select
            className="rounded-md border border-border/60 bg-background px-2 py-1 text-foreground text-sm"
            onChange={(event) => setSort(event.target.value as RoomAreaSort)}
            value={sort}
          >
            <option value="area-desc">{vi.sortAreaDesc}</option>
            <option value="area-asc">{vi.sortAreaAsc}</option>
            <option value="name">{vi.sortName}</option>
          </select>
        </label>
        {/* #75: this filter narrows the table only. The app-wide active level
            stays where the user left it. */}
        <label className="col-span-2 flex flex-col gap-1 text-muted-foreground text-xs">
          {vi.levelFilter}
          <select
            className="rounded-md border border-border/60 bg-background px-2 py-1 text-foreground text-sm"
            onChange={(event) => setLevelId(event.target.value)}
            value={levelId}
          >
            <option value="">{vi.allLevels}</option>
            {[...levelNames.entries()].map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {pendingRename && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-accent/40 px-2 py-1.5 text-xs">
          <span>{vi.renamed(pendingRename.next)}</span>
          <button
            className="flex items-center gap-1 rounded-md px-1.5 py-1 font-medium hover:bg-accent"
            onClick={undoRename}
            type="button"
          >
            <Undo2 className="size-3.5" />
            {vi.undoRename}
          </button>
        </div>
      )}

      {state === 'forbidden' && (
        <div className="rounded-md border border-border/60 bg-accent/40 px-2 py-1.5 text-xs" role="status">
          {vi.forbiddenNotice}
        </div>
      )}

      {state === 'loading' ? (
        <div aria-busy="true" className="flex flex-col gap-2" role="status">
          <span className="sr-only">{vi.loading}</span>
          {[0, 1, 2].map((index) => (
            <div className="h-10 animate-pulse rounded-md bg-muted" key={index} />
          ))}
        </div>
      ) : state === 'error' ? (
        <div className="rounded-lg border border-border/60 border-dashed px-3 py-6 text-center" role="alert">
          <p className="font-medium">{vi.errorTitle}</p>
          <ul className="mt-1 text-muted-foreground text-xs">
            {table.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : hasRows ? (
        <div className="flex flex-col gap-3">
          {table.groups.map((group) => (
            <section key={group.key}>
              <div className="flex items-baseline justify-between border-border/50 border-b pb-1">
                <h3 className="font-medium text-xs uppercase tracking-wide">{group.label}</h3>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {vi.subtotal} {group.subtotalText}
                </span>
              </div>
              <ul>
                {group.rows.map((row) => (
                  <li key={row.id}>
                    <div
                      className={cn(
                        'flex w-full items-start gap-2 rounded-md px-1.5 py-1.5 text-left',
                        hoveredId === row.id && 'bg-accent/60',
                        selectedZoneId === row.id && 'bg-accent',
                      )}
                      onMouseEnter={() => setHoveredId(row.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      <span className="mt-1.5">
                        <StatusDot status={row.status} />
                      </span>
                      <div className="min-w-0 flex-1">
                        {editingId === row.id ? (
                          <input
                            aria-label={vi.renameLabel(row.name)}
                            autoFocus
                            className="w-full rounded-sm border border-border bg-background px-1 py-0.5 text-sm"
                            onBlur={() => {
                              commitRename(row.id, row.name, draftName)
                              setEditingId(null)
                            }}
                            onChange={(event) => {
                              setDraftName(event.target.value)
                              scheduleRename(row.id, row.name, event.target.value)
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') event.currentTarget.blur()
                              if (event.key === 'Escape') {
                                setDraftName(row.name)
                                setEditingId(null)
                              }
                            }}
                            value={draftName}
                          />
                        ) : (
                          /* The name is the button, so the rename input never
                             ends up nested inside one. */
                          <button
                            className="w-full text-left font-medium"
                            onClick={() => selectRow(row)}
                            onDoubleClick={(event) => {
                              event.stopPropagation()
                              if (readOnly) return
                              setDraftName(row.name)
                              setEditingId(row.id)
                            }}
                            title={readOnly ? vi.readOnlyRename : vi.renameLabel(row.name)}
                            type="button"
                          >
                            {row.number ? `${row.number} · ` : ''}
                            {row.name}
                          </button>
                        )}
                        <div className="text-muted-foreground text-xs">
                          {vi.openings(row.doorCount, row.windowCount)} · {vi.perimeter}{' '}
                          {row.perimeterText} · {vi.ceilingHeight} {row.ceilingHeightText}
                        </div>
                      </div>
                      <span className="mt-0.5 shrink-0 tabular-nums">{row.areaText}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 border-dashed px-3 py-6 text-center">
          <p className="font-medium">{vi.emptyTitle}</p>
          <p className="mt-1 text-muted-foreground text-xs">{vi.emptyBody}</p>
          <button
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-accent px-2.5 py-1.5 font-medium text-xs hover:bg-accent/80"
            onClick={checkWallGaps}
            type="button"
          >
            <ScanSearch className="size-4" />
            {vi.detectSpaces}
          </button>
          {gapReport && <p className="mt-2 text-muted-foreground text-xs">{gapReport}</p>}
        </div>
      )}

      {fullPage && (
        <RoomAreaFullPage
          copied={copied}
          grouping={grouping}
          onClose={closeFullPage}
          onCopy={() => {
            void navigator.clipboard?.writeText(roomAreaTableToText(fullTable)).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), UNDO_WINDOW_MS)
            })
          }}
          onGroupingChange={setGrouping}
          onSortChange={setSort}
          returnFocusTo={fullPageButtonRef}
          sort={sort}
          table={fullTable}
        />
      )}

      <footer className="mt-auto border-border/50 border-t pt-2 text-muted-foreground text-xs">
        <div className="font-medium">{vi.statusLegend}</div>
        <ul className="mt-1 flex flex-col gap-1">
          {(['trusted', 'suspect', 'reviewed'] as const).map((status) => (
            <li className="flex items-center gap-1.5" key={status}>
              <StatusDot status={status} />
              {STATUS_LABEL[status]}
            </li>
          ))}
        </ul>
        <p className="mt-2">{vi.areaFormula}</p>
        {table.issues.length > 0 && state !== 'error' && (
          <ul className="mt-2 flex flex-col gap-1" role="status">
            <li className="font-medium">{vi.partialTitle}</li>
            {table.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
      </footer>
    </div>
  )
}
