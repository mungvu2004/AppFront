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
 */

import { Editor, ItemsPanel } from '@pascal-app/editor'
import { Hammer, Layers, Package, Settings } from 'lucide-react'
import Image from 'next/image'
import type { ComponentProps, ReactNode } from 'react'
import { BuildTab } from './components/build-tab'
import {
  CommunityViewerToolbarLeft,
  CommunityViewerToolbarRight,
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
    label: 'Scene',
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
    label: 'Build',
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
    label: 'Items',
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
    label: 'Settings',
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

export default function Home({ projectId, onLoad, onSave, backCard }: HomeProps) {
  return (
    <div className="relative h-screen w-screen">
      <Editor
        layoutVersion="v2"
        onLoad={onLoad}
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
    </div>
  )
}
