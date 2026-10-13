'use client'

import { type AnyNode, type AnyNodeId, type ReviewState, reviewStateOf, useScene } from '@pascal-app/core'
import { useCallback } from 'react'
import { controlsAndPanels as vi } from '../../../i18n/regions/controlsAndPanels'
import { ActionButton, ActionGroup } from '../controls/action-button'
import { PanelSection } from '../controls/panel-section'

/**
 * Review state of the selected node: how much its geometry is trusted, who
 * authored it, and the reviewer's sign-off (A5).
 *
 * Two invariants are load-bearing here, so neither is left to the caller:
 *
 * - **A5** — `reviewed: true` is only ever written by `approve`, which runs
 *   from a person's click. Nothing in this file derives the flag from
 *   `confidence` or from `source`, however high the model's score: the green
 *   state means "a reviewer looked at this", and a node reaching it without a
 *   reviewer would make the badge a lie. A geometry edit clears it elsewhere
 *   (`fromPascal.ts` on the AppFront side).
 * - **A4** — exactly three states, enumerated once in `REVIEW_STATES` below.
 *   A fourth colour is the thing A4 exists to refuse, so the states are a
 *   closed map keyed by the resolver's return value rather than a chain of
 *   conditional class names that a later edit could extend by one.
 */

/**
 * The three states, and the one colour each (A4). The resolver lives in core
 * (`reviewStateOf`) so the room-area table colours a zone exactly as this
 * panel does; keep this map at three entries.
 */
const REVIEW_STATES: Record<ReviewState, { dot: string; label: string }> = {
  reviewed: { dot: 'bg-emerald-400', label: vi.reviewInspector.stateReviewed },
  suspect: { dot: 'bg-amber-400', label: vi.reviewInspector.stateSuspect },
  trusted: { dot: 'bg-sky-400', label: vi.reviewInspector.stateTrusted },
}

export function ReviewSection({
  nodeId,
  onUpdate,
}: {
  nodeId: AnyNodeId
  onUpdate: (patch: Partial<AnyNode>) => void
}) {
  // Subscribe to the three primitives rather than the `review` object: the
  // object gets a new reference on every `updateNode` tick during a slider
  // drag, and this panel has no reason to re-render for a thickness change.
  const reviewed = useScene((s) => s.nodes[nodeId]?.review?.reviewed)
  const confidence = useScene((s) => s.nodes[nodeId]?.review?.confidence)
  const source = useScene((s) => s.nodes[nodeId]?.review?.source)

  // `reviewed` is the only field either button writes. `source` is who
  // authored the geometry, not who reviewed it, so approving an AI-drawn wall
  // keeps `source: 'ai'` — that is what lets the badge say "a person approved
  // this AI geometry" instead of erasing where it came from.
  const setReviewed = useCallback(
    (next: boolean) => {
      onUpdate({ review: { reviewed: next, confidence, source } } as Partial<AnyNode>)
    },
    [onUpdate, confidence, source],
  )

  const state = reviewStateOf({ reviewed, confidence, source })
  const { dot, label } = REVIEW_STATES[state]

  return (
    <PanelSection title={vi.reviewInspector.title}>
      <div className="flex flex-col gap-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
          <span className="truncate text-foreground text-xs">{label}</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs">{vi.reviewInspector.confidence}</span>
          <span className="font-medium text-foreground text-xs tabular-nums">
            {typeof confidence === 'number'
              ? vi.reviewInspector.confidencePercent(confidence)
              : vi.reviewInspector.confidenceUnknown}
          </span>
        </div>

        <div className="text-muted-foreground text-xs">
          {source === 'ai' ? vi.reviewInspector.sourceAi : vi.reviewInspector.sourceHuman}
        </div>

        <ActionGroup>
          <ActionButton
            aria-pressed={reviewed === true}
            className={
              reviewed === true ? 'border-emerald-500/40 text-emerald-200' : undefined
            }
            label={vi.reviewInspector.approve}
            onClick={() => setReviewed(true)}
          />
          <ActionButton
            aria-pressed={reviewed === false}
            label={vi.reviewInspector.reject}
            onClick={() => setReviewed(false)}
          />
        </ActionGroup>
      </div>
    </PanelSection>
  )
}
