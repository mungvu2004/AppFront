'use client'

import { controlsAndPanels as vi } from '../../../i18n/regions/controlsAndPanels'

/**
 * The two inspector states that used to render nothing (`inspector-state.ts`):
 * a read-only viewer who selects something, and a selection whose node is
 * gone. A blank panel tells the person nothing; this says why.
 */
export function InspectorNotice({ state }: { state: 'forbidden' | 'error' }) {
  return (
    <div
      className="pointer-events-auto fixed top-20 right-4 z-50 w-72 rounded-lg border border-border bg-background/95 px-3 py-2 text-foreground text-xs shadow-lg"
      role="status"
    >
      {state === 'forbidden' ? vi.inspectorNotice.forbidden : vi.inspectorNotice.missing}
    </div>
  )
}
