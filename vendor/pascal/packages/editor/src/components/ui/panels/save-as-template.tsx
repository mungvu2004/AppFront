'use client'

import type { AnyNodeId } from '@pascal-app/core'
import { createContext, useContext, useState } from 'react'
import { controlsAndPanels as vi } from '../../../i18n/regions/controlsAndPanels'
import { ActionButton } from '../controls/action-button'

/** What the host says after trying to store the node as a property template. */
export type SaveAsTemplateResult = { ok: boolean; message: string }

/** Host callback (`EditorProps.onSaveAsTemplate`); null hides the button. */
export const SaveAsTemplateContext = createContext<
  ((nodeId: string) => Promise<SaveAsTemplateResult>) | null
>(null)

/**
 * "Lưu làm khuôn mẫu" (#25): hands the selected node to the host, which owns
 * the server call, and says the host's answer out loud. Hidden when the host
 * passed no callback; the panel manager already hides the inspector in
 * read-only mode.
 */
export function SaveAsTemplateButton({ nodeId }: { nodeId: AnyNodeId }) {
  const save = useContext(SaveAsTemplateContext)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  if (!save) return null

  const onClick = async () => {
    setBusy(true)
    try {
      setMessage((await save(nodeId)).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <ActionButton disabled={busy} label={vi.saveAsTemplate.label} onClick={onClick} />
      {message && (
        <p className="col-span-full px-1 text-muted-foreground text-xs" role="status">
          {message}
        </p>
      )}
    </>
  )
}
