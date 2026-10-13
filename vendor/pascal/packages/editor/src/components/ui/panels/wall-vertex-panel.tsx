'use client'

import { type AnyNodeId, runAsSingleSceneHistoryStep, useScene, type WallNode } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { type KeyboardEvent, useEffect, useState } from 'react'
import { toFixedVi } from '../../../i18n/format'
import { wallMeasure } from '../../../i18n/regions/wallMeasure'
import {
  moveWallCorner,
  parseCoordinate,
  planAddVertex,
  planRemoveVertex,
  type WallVertexEnd,
} from './wall-vertex-table'

const vi = wallMeasure.vertexTable

/** Arrow-key / button nudge, meters. Shift multiplies it by ten. */
const NUDGE_M = 0.01

type Axis = 0 | 1

/**
 * "Bảng đỉnh" — edit the two corners of the selected wall by number (F-15 W2-B #11).
 * Every change is one `updateNodes` call, i.e. one undo step that goes down the
 * host's save path (`validateCommit` → `onSave`). Joined walls follow the corner.
 */
export function WallVertexPanel() {
  const nodes = useScene((state) => state.nodes)
  const readOnly = useScene((state) => state.readOnly)
  const selectedIds = useViewer((state) => state.selection.selectedIds)
  const [error, setError] = useState<string | null>(null)

  const selected = selectedIds.length === 1 ? nodes[selectedIds[0] as AnyNodeId] : undefined
  const wall = selected?.type === 'wall' ? selected : null

  if (!wall) {
    return <p className="p-3 text-muted-foreground text-sm">{vi.empty}</p>
  }

  const move = (end: WallVertexEnd, axis: Axis, value: number) => {
    const next: [number, number] = [...(wall[end] as [number, number])]
    next[axis] = value
    const patches = moveWallCorner(useScene.getState().nodes, wall, end, next)
    if (patches.length > 0) useScene.getState().updateNodes(patches)
  }

  // One history step each: the plan goes down the same save path as any edit.
  const reshape = (plan: ReturnType<typeof planAddVertex>) => {
    if ('error' in plan) return setError(vi.cannotChange)
    setError(null)
    const scene = useScene.getState()
    runAsSingleSceneHistoryStep(useScene, () => scene.applyNodeChanges(plan.changes))
  }
  const addVertex = () => {
    const length = Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1])
    reshape(planAddVertex(useScene.getState().nodes, wall, length / 2))
  }

  return (
    <div className="flex flex-col gap-3 p-3 text-sm">
      {readOnly && <p className="text-muted-foreground">{vi.readOnly}</p>}
      <table className="w-full border-separate border-spacing-y-1">
        <thead>
          <tr className="text-left text-muted-foreground text-xs">
            <th className="font-medium">{vi.corner}</th>
            <th className="font-medium">{vi.x}</th>
            <th className="font-medium">{vi.y}</th>
          </tr>
        </thead>
        <tbody>
          {(['start', 'end'] as const).map((end) => (
            <tr key={end}>
              <th className="pr-2 text-left font-medium">
                {vi.cornerName[end]}
                <button
                  aria-label={vi.removeVertex(vi.cornerName[end])}
                  className="ml-1 rounded px-1 text-xs hover:bg-accent disabled:opacity-40"
                  disabled={readOnly}
                  onClick={() => reshape(planRemoveVertex(useScene.getState().nodes, wall, end))}
                  type="button"
                >
                  ×
                </button>
              </th>
              {([0, 1] as const).map((axis) => (
                <td key={axis}>
                  <CoordinateField
                    disabled={readOnly}
                    label={vi.fieldLabel(vi.cornerName[end], axis === 0 ? 'x' : 'y')}
                    onCommit={(value) => {
                      setError(null)
                      move(end, axis, value)
                    }}
                    onInvalid={() => setError(vi.invalid)}
                    value={(wall as WallNode)[end][axis]}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <button
        className="self-start rounded border border-border px-2 py-1 text-xs hover:bg-accent disabled:opacity-40"
        disabled={readOnly}
        onClick={addVertex}
        type="button"
      >
        {vi.addVertex}
      </button>
      {error && (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      )}
      <p className="text-muted-foreground text-xs">{vi.hint}</p>
    </div>
  )
}

function CoordinateField({
  disabled,
  label,
  onCommit,
  onInvalid,
  value,
}: {
  disabled: boolean
  label: string
  onCommit: (value: number) => void
  onInvalid: () => void
  value: number
}) {
  const shown = toFixedVi(value, 2)
  const [draft, setDraft] = useState(shown)
  useEffect(() => setDraft(shown), [shown])

  const commit = () => {
    const parsed = parseCoordinate(draft)
    if (parsed === null) {
      // The field goes back to the old number; nothing is written.
      setDraft(shown)
      onInvalid()
      return
    }
    if (parsed !== value) onCommit(parsed)
  }

  const nudge = (direction: 1 | -1, large: boolean) =>
    onCommit(value + direction * NUDGE_M * (large ? 10 : 1))

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') commit()
    else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      nudge(event.key === 'ArrowUp' ? 1 : -1, event.shiftKey)
    }
  }

  return (
    <div className="flex items-center gap-0.5">
      <input
        aria-label={label}
        className="w-20 rounded border border-border bg-background px-1.5 py-1 font-mono text-xs"
        disabled={disabled}
        inputMode="decimal"
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        value={draft}
      />
      <div className="flex flex-col">
        <button
          aria-label={vi.nudgeUp(label)}
          className="rounded p-0.5 hover:bg-accent disabled:opacity-40"
          disabled={disabled}
          onClick={() => nudge(1, false)}
          type="button"
        >
          <ChevronUp className="size-3" />
        </button>
        <button
          aria-label={vi.nudgeDown(label)}
          className="rounded p-0.5 hover:bg-accent disabled:opacity-40"
          disabled={disabled}
          onClick={() => nudge(-1, false)}
          type="button"
        >
          <ChevronDown className="size-3" />
        </button>
      </div>
    </div>
  )
}
