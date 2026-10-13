'use client'

import { Icon } from '../../lib/offline-icons'
import { Copy, Group, Move, PencilRuler, Search, Spline, Trash2, Ungroup } from 'lucide-react'
import type { MouseEventHandler, PointerEventHandler } from 'react'
import { editorAndViewer as vi } from '../../i18n/regions/editorAndViewer'
import { RegistryActionContributions } from './registry-action-contributions'

type NodeActionMenuProps = {
  onFind?: MouseEventHandler<HTMLButtonElement>
  onAddHole?: MouseEventHandler<HTMLButtonElement>
  onDelete?: MouseEventHandler<HTMLButtonElement>
  onDuplicate?: MouseEventHandler<HTMLButtonElement>
  onMove?: MouseEventHandler<HTMLButtonElement>
  onEditMesh?: MouseEventHandler<HTMLButtonElement>
  onCurve?: MouseEventHandler<HTMLButtonElement>
  /** Session group (Ctrl/Cmd+G) — multi-selection floating pill. */
  onGroup?: MouseEventHandler<HTMLButtonElement>
  /** Dissolve session group (Ctrl/Cmd+Shift+G). */
  onUngroup?: MouseEventHandler<HTMLButtonElement>
  onPointerDown?: PointerEventHandler<HTMLDivElement>
  onPointerUp?: PointerEventHandler<HTMLDivElement>
  onPointerEnter?: PointerEventHandler<HTMLDivElement>
  onPointerLeave?: PointerEventHandler<HTMLDivElement>
}

export function NodeActionMenu({
  onFind,
  onAddHole,
  onDelete,
  onDuplicate,
  onMove,
  onEditMesh,
  onCurve,
  onGroup,
  onUngroup,
  onPointerDown,
  onPointerUp,
  onPointerEnter,
  onPointerLeave,
}: NodeActionMenuProps) {
  return (
    <div
      className="pointer-events-auto flex items-center gap-1 rounded-lg border border-border bg-background/95 p-1 shadow-xl backdrop-blur-md"
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerUp={onPointerUp}
    >
      {onFind && (
        <button
          aria-label={vi.nodeActionMenu.findInCatalog}
          className="tooltip-trigger rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={onFind}
          title={vi.nodeActionMenu.findInCatalog}
          type="button"
        >
          <Search className="h-4 w-4" />
        </button>
      )}
      {onMove && (
        <button
          aria-label={vi.nodeActionMenu.move}
          className="tooltip-trigger rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={onMove}
          title={vi.nodeActionMenu.move}
          type="button"
        >
          <Move className="h-4 w-4" />
        </button>
      )}
      {onEditMesh && (
        <button
          aria-label={vi.nodeActionMenu.editMesh}
          className="tooltip-trigger rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={onEditMesh}
          title={vi.nodeActionMenu.editMesh}
          type="button"
        >
          <PencilRuler className="h-4 w-4" />
        </button>
      )}
      {onGroup && (
        <button
          aria-label={vi.nodeActionMenu.groupSelection}
          className="tooltip-trigger rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={onGroup}
          title={vi.nodeActionMenu.group}
          type="button"
        >
          <Group className="h-4 w-4" />
        </button>
      )}
      {onUngroup && (
        <button
          aria-label={vi.nodeActionMenu.ungroupSelection}
          className="tooltip-trigger rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={onUngroup}
          title={vi.nodeActionMenu.ungroup}
          type="button"
        >
          <Ungroup className="h-4 w-4" />
        </button>
      )}
      {onCurve && (
        <button
          aria-label={vi.nodeActionMenu.curve}
          className="tooltip-trigger rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={onCurve}
          title={vi.nodeActionMenu.curve}
          type="button"
        >
          <Spline className="h-4 w-4" />
        </button>
      )}
      <RegistryActionContributions />
      {onDuplicate && (
        <button
          aria-label={vi.nodeActionMenu.duplicate}
          className="tooltip-trigger rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={onDuplicate}
          title={vi.nodeActionMenu.duplicate}
          type="button"
        >
          <Copy className="h-4 w-4" />
        </button>
      )}
      {onAddHole && (
        <button
          aria-label={vi.nodeActionMenu.cutOut}
          className="tooltip-trigger rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={onAddHole}
          title={vi.nodeActionMenu.cutOut}
          type="button"
        >
          <Icon height={16} icon="carbon:cut-out" width={16} />
        </button>
      )}
      {onDelete && (
        <button
          aria-label={vi.nodeActionMenu.delete}
          className="tooltip-trigger rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          onClick={onDelete}
          title={vi.nodeActionMenu.delete}
          type="button"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
