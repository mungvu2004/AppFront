'use client'
/**
 * VERBATIM copy of upstream Pascal apps/editor/app/page.tsx (F:\pascal-editor, commit cd14090, MIT).
 * Edits (the only ones):
 *   1. import paths: `@/components/*` -> relative `./components/*`.
 *   2. WebXR plugin gate removed (`vr` treated as null): no `@webxr/plugin` / `webxr-feature-gate`
 *      imports, no WebXRFeatureRuntime/Consumer wrappers, no PascalWebXRButton, no `immersive` prop
 *      (`vr?.session` was always undefined), `vrButton={null}`; `useWebXRInstalled` dropped.
 *   3. "Blank canvas - saved scenes are under Scenes" banner removed (/scenes does not exist here);
 *      with it the now-unused `next/link` import and the `PROJECT_ID` constant.
 *   4. `Home` takes props `{ projectId, onLoad, onSave, readOnly }` and passes
 *      `projectId` / `onLoad` / `onSave` to `<Editor>` (upstream Editor supports them). `readOnly`
 *      is accepted for the caller's contract; the read-only lease is taken in ../main.tsx.
 *   5. Optional `backCard` prop rendered first inside the `viewerToolbarLeft` slot (AppFront's
 *      only addition: a small "back to project" card, ../BackToProjectCard.tsx).
 *   6-8. AppFront UX edits from UI review P40 (Vietnamese labels, start in Select, ?tool/?view,
 *      Esc, delete-mode banner, frame model on load) - listed in ./README.md.
 *   9. UI review fix R3d: registry strings in Vietnamese (G5-03, ./lib/pascal-vi.ts), saved
 *      preferences (BUG-648, ./lib/editor-preferences.ts), sidebar auto-collapses under 1100 px
 *      (G5-11), Preview header shows the project name (G5-15), one-time orbit hint (G5-08).
 *   10. FE3D WP8: ../scaleBanner.tsx (drawing-scale warning) heads the CanvasHelp column - see ./README.md.
 */

import { emitter, nodeRegistry, onRegistryChange, useScene } from '@pascal-app/core'
import {
  Editor,
  ItemsPanel,
  subscribeCameraPose,
  useEditor,
  useSidebarStore,
  useViewer,
  ViewerSceneHeader,
} from '@pascal-app/editor'
import { Hammer, Layers, Package, Settings, X } from 'lucide-react'
import Image from 'next/image'
import { type ComponentProps, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { downloadSnapshot } from '../realism/snapshot'
import { ScaleBanner } from '../scaleBanner'
import { BuildTab } from './components/build-tab'
import { CanvasHelp, MeasureClearButton } from './components/canvas-help'
import {
  CommunityViewerToolbarLeft,
  CommunityViewerToolbarRight,
} from './components/viewer-toolbar'
import { computeSceneBoundsXZ } from '../../../vendor/pascal/packages/editor/src/lib/scene-bounds'
import { useEditorPreferencesPersistence } from './lib/editor-preferences'
import { fitPose, fitWhenControlsReady, planBoundsXZ } from './lib/fit-on-ready'
import { translateDefinition } from './lib/pascal-vi'
import { isMeasureActive } from './lib/select-exits-measure'
import { useSelectExitsMeasure } from './lib/use-select-exits-measure'

// The open-source editor only ships the built-in catalog (no uploaded items),
// so the Library/Community/Mine source chips and tag filters add nothing —
// drop them and keep the panel to plain categories.
function EditorItemsPanel() {
  return <ItemsPanel showSourceFilter={false} showTagFilters={false} />
}

const SIDEBAR_TABS = [
  {
    id: 'site',
    label: 'Cảnh',
    component: () => null,
    mobileDefaultSnap: 0.5,
    mobileIcon: <Layers className="h-5 w-5" />,
    icon: (
      <Image
        alt=""
        className="h-8 w-8 object-contain"
        height={32}
        src="/icons/scene.webp"
        width={32}
      />
    ),
  },
  {
    id: 'build',
    label: 'Dựng',
    component: BuildTab,
    mobileDefaultSnap: 0.5,
    mobileIcon: <Hammer className="h-5 w-5" />,
    icon: (
      <Image
        alt=""
        className="h-8 w-8 object-contain"
        height={32}
        src="/icons/build.webp"
        width={32}
      />
    ),
  },
  {
    id: 'items',
    label: 'Đồ vật',
    component: EditorItemsPanel,
    mobileDefaultSnap: 0.5,
    mobileIcon: <Package className="h-5 w-5" />,
    icon: (
      <Image
        alt=""
        className="h-8 w-8 object-contain"
        height={32}
        src="/icons/couch.webp"
        width={32}
      />
    ),
  },
  {
    id: 'settings',
    label: 'Cài đặt',
    component: () => null,
    mobileDefaultSnap: 0.5,
    mobileIcon: <Settings className="h-5 w-5" />,
    icon: (
      <Image
        alt=""
        className="h-8 w-8 object-contain"
        height={32}
        src="/icons/settings.webp"
        width={32}
      />
    ),
  },
]

type EditorProps = ComponentProps<typeof Editor>

export interface HomeProps {
  projectId: string
  onLoad: NonNullable<EditorProps['onLoad']>
  onSave?: EditorProps['onSave']
  readOnly: boolean
  backCard?: ReactNode
  /** Shown in the Preview header (G5-15); from the bridge. */
  projectName?: string | undefined
}

/**
 * AppFront edit (P40): start state after the scene is applied. Always open in Select
 * (G5-05), honour `?tool=measure` (G5-44) and `?view=exploded` (G5-43) from the 3D links.
 */
function applyStartParams() {
  const params = new URLSearchParams(window.location.search)
  const ed = useEditor.getState()
  if (params.get('tool') === 'measure') {
    ed.setPhase('structure')
    ed.armToolMode({ mode: 'build', tool: 'measurement' })
  } else {
    ed.armToolMode({ mode: 'select' })
  }
  if (params.get('view') === 'exploded') useViewer.getState().setLevelMode('exploded')
  // G5-06 / QA-2 L2: frame the model once the camera controls have mounted (a cold first open
  // mounts them after the editor's own auto-frame and after any fixed delay).
  fitWhenControlsReady(subscribeCameraPose, fitModel)
}

/** Frame the whole model; `apply-pose`, because upstream's `fit-scene` is ignored in Preview. */
function fitModel() {
  // FE3D-FIX-004 V14: frame walls + zones; vendor bounds only for a scene without either.
  const { nodes } = useScene.getState()
  const bounds = planBoundsXZ(nodes) ?? computeSceneBoundsXZ(nodes)
  emitter.emit('camera-controls:apply-pose', fitPose(bounds, useViewer.getState().cameraMode))
}

/** Only poses published after subscribing (the current one belongs to the canvas being replaced). */
function subscribeNextCameraPose(listener: () => void) {
  let initial = true
  const unsubscribe = subscribeCameraPose(() => {
    if (!initial) listener()
  })
  initial = false
  return unsubscribe
}

/**
 * QA-2 L2: entering or leaving Preview swaps the canvas, and the new camera controls start at a
 * fixed pose close to one corner. Re-frame the model once they are up.
 */
function useFitOnPreviewToggle() {
  const isPreview = useEditor((state) => state.isPreviewMode)
  const seen = useRef(isPreview)
  useEffect(() => {
    if (seen.current === isPreview) return
    seen.current = isPreview
    return fitWhenControlsReady(subscribeNextCameraPose, fitModel)
  }, [isPreview])
}

/** Select tool, the same public calls `use-select-exits-measure.ts` makes for V. */
function armSelect() {
  const ed = useEditor.getState()
  ed.armToolMode({ mode: 'select' })
  ed.setFloorplanSelectionTool('click')
}

/**
 * AppFront edit (Q4, D1a): leaving Preview (Esc or the header's back arrow) came back with the
 * Wall tool armed — the sidebar "Tường" tile lit, "Chọn (V)" not. Land in Select instead. Runs
 * on the state change, so every exit path (Esc in `useEscapeExits`, the back arrow) is covered.
 */
function useSelectAfterPreview() {
  const isPreview = useEditor((state) => state.isPreviewMode)
  const seen = useRef(isPreview)
  useEffect(() => {
    const left = seen.current && !isPreview
    seen.current = isPreview
    if (!left) return
    armSelect()
  }, [isPreview])
}

/**
 * AppFront edit (P40, G5-15 / N5-11 / G5-14): Esc leaves Preview, then Delete or Measure (both
 * measure tools, the same test V uses, RV3 #8). The Delete banner lives in `CanvasHelp`.
 */
function useEscapeExits() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const ed = useEditor.getState()
      if (ed.isPreviewMode) ed.setPreviewMode(false)
      else if (ed.mode === 'delete' || isMeasureActive(ed))
        ed.armToolMode({ mode: 'select' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}


let viInstalled = false

/**
 * AppFront edit (R3d, G5-03): Vietnamese registry strings, now and whenever a kind or plugin
 * registers later. Runs during render, before the HUD first reads them. Idempotent.
 */
function usePascalVi() {
  if (viInstalled) return
  viInstalled = true
  const run = () => {
    for (const [, def] of nodeRegistry.entries()) translateDefinition(def)
  }
  run()
  onRegistryChange(run)
}

const NARROW_PX = 1100

/**
 * AppFront edit (R3d, G5-11): under 1100 px the 344 px sidebar pushes the toolbars off screen.
 * Collapse it once the saved state is loaded and whenever the window narrows past 1100 px.
 * Never re-opens it: a user who opens it again on a tablet keeps it open.
 */
function useAutoCollapseSidebar() {
  useEffect(() => {
    const collapse = () => useSidebarStore.getState().setIsCollapsed(true)
    let wasNarrow = window.innerWidth < NARROW_PX
    const onHydrated = () => {
      if (window.innerWidth < NARROW_PX) collapse()
    }
    const onResize = () => {
      const narrow = window.innerWidth < NARROW_PX
      if (narrow && !wasNarrow) collapse()
      wasNarrow = narrow
    }
    const unsubscribe = useSidebarStore.persist.onFinishHydration(onHydrated)
    if (useSidebarStore.persist.hasHydrated()) onHydrated()
    window.addEventListener('resize', onResize)
    return () => {
      unsubscribe()
      window.removeEventListener('resize', onResize)
    }
  }, [])
}

// Pascal's own Preview header (the only node with these classes) is hidden while ours shows.
const HIDE_VENDOR_HEADER =
  '.dark.absolute.top-4.left-4.z-20:not([data-appfront-header] > *) { display: none !important; }'

/**
 * AppFront edit (R3d, G5-15): `<Editor>` never passes `projectName` to its Preview overlay, so
 * the header read "Untitled". Render the exported `ViewerSceneHeader` with the bridge's name.
 */
function PreviewHeader({ projectName }: { projectName?: string | undefined }) {
  const isPreview = useEditor((state) => state.isPreviewMode)
  if (!isPreview) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-30" data-appfront-header="">
      <style>{HIDE_VENDOR_HEADER}</style>
      <ViewerSceneHeader
        onBack={() => useEditor.getState().setPreviewMode(false)}
        projectName={projectName ?? null}
      />
    </div>
  )
}

const ORBIT_HINT_KEY = 'appfront.pascal.orbit-hint-seen'

function orbitHintSeen(): boolean {
  try {
    return localStorage.getItem(ORBIT_HINT_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * AppFront edit (R3d, G5-08): left-drag on empty canvas is Pascal's box select (kept on
 * purpose). The first time such a drag selects nothing, say how to orbit. Shown once per browser.
 */
function OrbitHint() {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (orbitHintSeen()) return
    let start: { x: number; y: number } | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    const onDown = (event: PointerEvent) => {
      start =
        event.button === 0 && event.target instanceof HTMLCanvasElement
          ? { x: event.clientX, y: event.clientY }
          : null
    }
    const onUp = (event: PointerEvent) => {
      if (!start) return
      const dragged = Math.hypot(event.clientX - start.x, event.clientY - start.y) > 40
      start = null
      const ed = useEditor.getState()
      if (!dragged || ed.mode !== 'select' || ed.isPreviewMode) return
      // Let the box selection commit before reading it.
      timer = setTimeout(() => {
        if (useViewer.getState().selection.selectedIds.length > 0) return
        try {
          localStorage.setItem(ORBIT_HINT_KEY, '1')
        } catch {
          // Private mode: the hint may show again next visit.
        }
        setShown(true)
      }, 100)
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointerup', onUp, true)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointerup', onUp, true)
    }
  }, [])
  useEffect(() => {
    if (!shown) return
    const timer = setTimeout(() => setShown(false), 10_000)
    return () => clearTimeout(timer)
  }, [shown])
  if (!shown) return null
  return (
    <div
      className="fixed bottom-28 left-1/2 z-50 flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-background/95 py-2 pr-2 pl-4 text-foreground text-sm shadow-lg backdrop-blur-md"
      role="status"
    >
      <span>
        Kéo chuột trái trên vùng trống là chọn bằng khung. Muốn xoay mô hình: giữ chuột phải và
        kéo.
      </span>
      <button
        aria-label="Đóng gợi ý"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-accent"
        onClick={() => setShown(false)}
        type="button"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

/** V1 (viewer-measure): người xem không dựng/đặt đồ — bỏ tab Dựng + Đồ vật; đo nằm ở thanh hành động. */
const READ_ONLY_SIDEBAR_TABS = SIDEBAR_TABS.filter((tab) => tab.id !== 'build' && tab.id !== 'items')

export default function Home({ projectId, onLoad, onSave, readOnly, backCard, projectName }: HomeProps) {
  useEditorPreferencesPersistence()
  usePascalVi()
  useEscapeExits()
  useSelectExitsMeasure()
  useAutoCollapseSidebar()
  useFitOnPreviewToggle()
  useSelectAfterPreview()
  const handleLoad = useCallback(async () => {
    const graph = await onLoad()
    // After Editor's own continuation has applied the graph (it awaits this promise).
    setTimeout(applyStartParams, 0)
    return graph
  }, [onLoad])
  return (
    <div className="relative h-screen w-screen">
      <Editor
        layoutVersion="v2"
        onLoad={handleLoad}
        {...(onSave ? { onSave } : {})}
        // F2: không có API lưu snapshot -> nút chụp tải ảnh về máy (trước đây báo "Snapshot storage is unavailable").
        // Overlay chỉ đóng khi nghe `snapshot:saved` — không phát thì nút chụp khoá mãi.
        onThumbnailCapture={(blob) => {
          downloadSnapshot(blob, projectName)
          emitter.emit('snapshot:saved', { projectId, id: 'download', url: '', width: 0, height: 0 })
        }}
        projectId={projectId}
        sidebarTabs={readOnly ? READ_ONLY_SIDEBAR_TABS : SIDEBAR_TABS}
        viewerToolbarLeft={
          <>
            {backCard}
            <CommunityViewerToolbarLeft />
          </>
        }
        viewerToolbarRight={<CommunityViewerToolbarRight vrButton={null} vrLabel="Enter VR" />}
      />
      <PreviewHeader projectName={projectName} />
      <OrbitHint />
      <CanvasHelp banner={<ScaleBanner projectId={projectId} />} />
      <MeasureClearButton />
    </div>
  )
}
