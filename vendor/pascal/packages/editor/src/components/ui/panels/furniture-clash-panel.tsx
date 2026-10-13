'use client'

import { type AnyNodeId, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useMemo } from 'react'
import { furnitureClash as vi } from '../../../i18n/regions/furnitureClash'
import { findFurnitureClashes } from '../../../lib/floorplan/furniture-clash'

/**
 * "Va chạm đồ đạc" (#22): every pair of floor items whose footprints overlap,
 * by name, with the AppFront rule code. A row selects the first item so the
 * person can move it straight away.
 */
export function FurnitureClashPanel() {
  const nodes = useScene((s) => s.nodes)
  const setSelection = useViewer((s) => s.setSelection)
  const clashes = useMemo(() => findFurnitureClashes(nodes), [nodes])

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 text-sm">
      <h2 className="font-semibold">{vi.title}</h2>
      {clashes.length === 0 ? (
        <p className="text-muted-foreground text-xs" role="status">
          {vi.none}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {clashes.map((clash) => (
            <li className="flex flex-col gap-0.5" key={`${clash.a.id}:${clash.b.id}`}>
              <button
                aria-label={vi.select(clash.a.name)}
                className="flex w-full flex-col gap-0.5 rounded-md border border-border/60 px-2.5 py-1.5 text-left hover:bg-accent/50"
                onClick={() => setSelection({ selectedIds: [clash.a.id as AnyNodeId] })}
                type="button"
              >
                <span>{vi.row(clash.a.name, clash.b.name)}</span>
                <span className="text-muted-foreground text-xs">
                  {vi.ruleLabel}: <code>{clash.ruleCode}</code>
                </span>
              </button>
              {/* Relative to `/projects/:id/3d` → the project's rule screen. */}
              <a
                className="self-end px-1 text-primary text-xs underline-offset-2 hover:underline"
                href={`rules?rule=${encodeURIComponent(clash.ruleCode)}`}
              >
                {vi.viewRule}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
