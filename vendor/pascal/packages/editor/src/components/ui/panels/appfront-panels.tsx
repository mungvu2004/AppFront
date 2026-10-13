'use client'

import { Ruler } from 'lucide-react'
import { roomArea as vi } from '../../../i18n/regions/roomArea'
import type { ExtraPanel } from '../sidebar/icon-rail'
import { RoomAreaPanel } from './room-area-panel'

/**
 * The editor side-panels AppFront mounts (F-15 W2-D).
 *
 * The host cannot build this list itself: `ExtraPanel.component` is a React
 * component, and AppFront renders Pascal in a second React root with its own
 * copy of React (see `src/components/pascal/pascalMount.tsx`), so a component
 * built over there would be constructed by the wrong renderer. Declaring the
 * list here keeps every element inside Pascal's own React while leaving the
 * host in charge of whether the panels appear at all.
 */
export const appFrontEditorPanels: ExtraPanel[] = [
  {
    id: 'appfront-room-area',
    label: vi.title,
    icon: <Ruler className="size-4" />,
    component: RoomAreaPanel,
  },
]
