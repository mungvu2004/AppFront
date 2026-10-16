'use client'

import { useLevelExplode, useViewer } from '@pascal-app/viewer'
import { Layers, Layers2 } from 'lucide-react'
import { editorAndViewer as vi } from '../../../i18n/regions/editorAndViewer'
import { ActionButton } from './action-button'

const levelModeLabels = {
  stacked: vi.viewerControlsBar.levelStacked,
  exploded: vi.viewerControlsBar.levelExploded,
  solo: vi.viewerControlsBar.levelSolo,
  manual: vi.viewerControlsBar.levelManual,
} as const

/**
 * Xếp ↔ tách tầng (AppFront 24-A-013). Bố cục v1 không có điều khiển chế độ tầng
 * nào (thanh trượt chỉ ở v2, nút vòng chỉ ở chế độ xem trước), nên vào tách tầng
 * qua `?view=exploded` rồi thì không có đường về trên màn.
 */
export function LevelModeAction() {
  const levelMode = useViewer((s) => s.levelMode)
  const exploded = levelMode === 'exploded'
  const label = vi.viewerControlsBar.levelMode(levelModeLabels[levelMode])

  return (
    <ActionButton
      aria-label={label}
      aria-pressed={exploded}
      className={exploded ? 'bg-amber-500/20 text-amber-400' : 'hover:bg-white/5'}
      label={label}
      onClick={() => {
        if (!exploded) useLevelExplode.getState().setAmount(1)
        useViewer.getState().setLevelMode(exploded ? 'stacked' : 'exploded')
      }}
      size="icon"
      variant="ghost"
    >
      {exploded ? <Layers2 className="h-6 w-6" /> : <Layers className="h-6 w-6" />}
    </ActionButton>
  )
}
