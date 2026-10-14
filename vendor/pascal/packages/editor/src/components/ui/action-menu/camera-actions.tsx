'use client'

import { emitter } from '@pascal-app/core'
import { useLevelExplode, useViewer } from '@pascal-app/viewer'
import { Layers, Layers2 } from 'lucide-react'
import Image from 'next/image'
import { editorAndViewer as vi } from '../../../i18n/regions/editorAndViewer'
import useEditor from '../../../store/use-editor'
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
function LevelModeAction() {
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

export function CameraActions({ hideOrbit = false }: { hideOrbit?: boolean }) {
  // Orbit stays useful in 2D-only (it spins the synced floorplan view), but
  // top view only tilts the hidden 3D camera — pointless without the canvas.
  const is2dOnly = useEditor((s) => s.viewMode === '2d')

  const goToTopView = () => {
    emitter.emit('camera-controls:top-view')
  }

  const orbitCW = () => {
    emitter.emit('camera-controls:orbit-cw')
  }

  const orbitCCW = () => {
    emitter.emit('camera-controls:orbit-ccw')
  }

  return (
    <div className="flex items-center gap-1">
      {!hideOrbit && (
        <>
          {/* Orbit CCW */}
          <ActionButton
            className="group hover:bg-white/5"
            label="Orbit Left"
            onClick={orbitCCW}
            size="icon"
            variant="ghost"
          >
            <Image
              alt="Orbit Left"
              className="h-[28px] w-[28px] -scale-x-100 object-contain opacity-70 transition-opacity group-hover:opacity-100"
              height={28}
              src="/icons/rotate.webp"
              width={28}
            />
          </ActionButton>

          {/* Orbit CW */}
          <ActionButton
            className="group hover:bg-white/5"
            label="Orbit Right"
            onClick={orbitCW}
            size="icon"
            variant="ghost"
          >
            <Image
              alt="Orbit Right"
              className="h-[28px] w-[28px] object-contain opacity-70 transition-opacity group-hover:opacity-100"
              height={28}
              src="/icons/rotate.webp"
              width={28}
            />
          </ActionButton>
        </>
      )}

      {!is2dOnly && <LevelModeAction />}

      {/* Top View */}
      {!is2dOnly && (
        <ActionButton
          className="group hover:bg-white/5"
          label="Top View"
          onClick={goToTopView}
          size="icon"
          variant="ghost"
        >
          <Image
            alt="Top View"
            className="h-[28px] w-[28px] object-contain opacity-70 transition-opacity group-hover:opacity-100"
            height={28}
            src="/icons/topview.webp"
            width={28}
          />
        </ActionButton>
      )}
    </div>
  )
}
