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
 */

import { Editor, ItemsPanel, useEditor, useViewer } from '@pascal-app/editor'
import { Hammer, Layers, Package, Settings } from 'lucide-react'
import Image from 'next/image'
import { type ComponentProps, type ReactNode, useCallback, useEffect } from 'react'
import { BuildTab } from './components/build-tab'
import {
  CommunityViewerToolbarLeft,
  CommunityViewerToolbarRight,
  fitWholeModel,
} from './components/viewer-toolbar'

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
  // G5-06: frame the model once the camera controls have mounted (the editor's own auto-frame
  // can fire before them). ponytail: fixed 600 ms delay, hook a 'controls ready' event if flaky.
  setTimeout(fitWholeModel, 600)
}

/** AppFront edit (P40, G5-15 / N5-11 / G5-14): Esc leaves Preview, then Delete or Measure. */
function useEscapeExits() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const ed = useEditor.getState()
      if (ed.isPreviewMode) ed.setPreviewMode(false)
      else if (ed.mode === 'delete' || (ed.mode === 'build' && ed.tool === 'measurement'))
        ed.armToolMode({ mode: 'select' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/** AppFront edit (P40, G5-14): say so while the Delete tool (X) is armed. */
function DeleteModeBanner() {
  const isDelete = useEditor((state) => state.mode === 'delete')
  if (!isDelete) return null
  return (
    <div
      className="pointer-events-none fixed top-16 left-1/2 z-50 -translate-x-1/2 rounded-full bg-red-600 px-4 py-1.5 font-medium text-sm text-white shadow-lg"
      role="status"
    >
      Đang ở chế độ xoá: bấm vào đối tượng sẽ xoá nó · Esc để thoát
    </div>
  )
}

export default function Home({ projectId, onLoad, onSave, backCard }: HomeProps) {
  useEscapeExits()
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
        projectId={projectId}
        sidebarTabs={SIDEBAR_TABS}
        viewerToolbarLeft={
          <>
            {backCard}
            <CommunityViewerToolbarLeft />
          </>
        }
        viewerToolbarRight={<CommunityViewerToolbarRight vrButton={null} vrLabel="Enter VR" />}
      />
      <DeleteModeBanner />
    </div>
  )
}
