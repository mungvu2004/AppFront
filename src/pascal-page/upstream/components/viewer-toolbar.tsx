'use client'
/**
 * VERBATIM copy of upstream Pascal apps/editor/components/viewer-toolbar.tsx (F:\pascal-editor, commit cd14090, MIT).
 * Edits: import paths only (`@/components/*`, `@/lib/*` -> relative).
 * pascal-polish T3: className/presentation only (AppFront surface/selected/accent tokens, label collapse thresholds).
 * UX-R1: camera buttons always in the "Góc nhìn" menu; the level toggle is lit when not "một tầng".
 * Editor3D G2 (01/11): labelled Hoàn tác / Làm lại (left group, `runUndo`/`runRedo`); "Phòng ▾", "Nhìn từ
 * trên", "Đi bộ" and "Xem toàn bộ" are labelled buttons on the bar ("…" keeps the rotate pair); the level
 * toggle hides when the project has one floor.
 */

import { Icon as IconifyIcon } from '@iconify/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  getHistoryCommandState,
  runRedo,
  runUndo,
  subscribeHistoryCommandState,
  useEditor,
  useFloorplanAnnotationVisibility,
  useFloorplanMode,
  subscribeCameraPose,
  useSidebarStore,
  type ViewMode,
} from '@pascal-app/editor'
import {
  CLAY_PALETTE,
  type EdgeMode,
  getLevelPresentationY,
  getSceneTheme,
  SCENE_THEMES,
  useViewer,
} from '@pascal-app/viewer'
import {
  ArrowDownToDot,
  Box,
  Camera,
  Check,
  ChevronsLeft,
  ChevronsRight,
  Columns2,
  Contrast,
  Ellipsis,
  Eye,
  Footprints,
  Grid2X2,
  Layers3,
  Magnet,
  Maximize,
  ChevronDown,
  Redo2,
  Undo2,
  PenLine,
  RotateCcw,
  RotateCw,
  Ruler,
  ScanLine,
  Send,
  SlidersHorizontal,
  Sparkles,
  SquareUserRound,
  SwatchBook,
  Tag,
} from 'lucide-react'
import { emitter, useScene } from '@pascal-app/core'
import Image from 'next/image'
import { type ReactNode, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { isTopDown, topViewPose } from '../lib/top-view-pose'
import { cn } from '../lib/utils'
import { roomsOf } from '../lib/fit-on-ready'
import { barLayoutVars, type DockFit, dockLayout, toolsShift } from '../lib/dock-fit'
import { CanvasHelpButton } from './canvas-help'
import { fitModel, fitRoom, viewedFrame } from '../lib/view-frame'
import { isSeparateUnits } from '../../bridge'
import { QUICK_SHOT_REQUEST_ID } from '../../realism/snapshot'
import { editor3dHref, ROUTES } from '@/routes/paths'
import { Tooltip, TooltipContent, TooltipTrigger } from './toolbar-tooltip'
import { pickWalkRoom, walkStartPose } from './walk-start'
import { isSceneReady } from '../../tour/tourLogic'
import { rememberWallMode, type WallMode } from '../../applyFirstOpenLook'
// AppFront edit (P40, G5-11; QA-2 L1; impeccable D1): text labels of the level/wall/display buttons
// collapse to screen-reader text when the top bar itself is narrower than 1500px (container `appbar`,
// declared in pascal.css; the sidebar width counts, not just the viewport). The 3D/2D/Chia đôi and
// "Xem trước" labels go below 1200px. The camera group (rotate / top view / walk) always sits in the
// "Góc nhìn" menu (UX-R1 K38/K49: the bar clipped "Xem trước" at 1920), so the bar never overlaps or
// clips between 1024 and 1920. Tooltips/aria-labels keep every name.

// pascal-polish T3: AppFront float surface (solid, 1px border, 12px radius, float shadow); ghost buttons hover
// to --pa-sunken, the "on" state is --pa-selected + accent text; focus ring is inset (the group clips overflow).
const TOOLBAR_CONTAINER =
  'inline-flex h-8 shrink-0 items-stretch overflow-hidden whitespace-nowrap rounded-xl border border-[var(--pa-border)] bg-[var(--pa-surface)] shadow-[var(--pa-shadow-float)]'

const BTN_FOCUS =
  'outline-2 -outline-offset-2 outline-transparent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--pa-accent)]'
const BTN_GHOST =
  'text-[var(--pa-text-2)] transition-colors duration-[120ms] hover:bg-[var(--pa-sunken)] hover:text-[var(--pa-text)] active:bg-[var(--pa-selected)] disabled:opacity-40 motion-reduce:transition-none ' +
  BTN_FOCUS
const BTN_ON = 'bg-[var(--pa-selected)] text-[var(--pa-accent)] hover:bg-[var(--pa-selected)] hover:text-[var(--pa-accent)]'

const TOOLBAR_BTN = `flex w-8 items-center justify-center ${BTN_GHOST}`
// Label wrappers: icon-only (sr-only text) below the given bar width.
const LABEL_WIDE = 'sr-only @min-[1500px]/appbar:not-sr-only'
// Editor3D (01/11, K9): Hoàn tác/Làm lại and the camera group live in the bottom dock beside the tool bar
// (the top bar overlapped at 1440). Camera labels show from 1280 px of window; below, icons + tooltips.
const LABEL_CAMERA = 'dock-label sr-only xl:not-sr-only'

// Menu Hiển thị: mọi mục bật/tắt cùng một kiểu chữ trạng thái (Impeccable A5).
function OnOff({ on }: { on: boolean }) {
  return <span className="ml-auto text-muted-foreground text-xs">{on ? 'Bật' : 'Tắt'}</span>
}

// Tên giao diện cảnh của vendor là tiếng Anh; id lạ thì giữ tên gốc.
const THEME_VI: Record<string, string> = {
  studio: 'Studio',
  paper: 'Giấy',
  sunset: 'Hoàng hôn',
  overcast: 'Trời âm u',
  blueprint: 'Bản vẽ xanh',
  mediterranean: 'Địa Trung Hải',
  twilight: 'Chạng vạng',
  night: 'Ban đêm',
  verdant: 'Xanh cây',
}

function themeName(id: string, fallback: string): string {
  return THEME_VI[id] ?? fallback
}

function requestWalkthroughPointerLock() {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-pascal-viewer-3d] canvas')
  if (!canvas) return

  if (!canvas.hasAttribute('tabindex')) {
    canvas.tabIndex = -1
  }
  canvas.focus({ preventScroll: true })

  if (document.pointerLockElement === canvas) return

  try {
    canvas.requestPointerLock?.()
  } catch {
    return
  }
}

function ToolbarTooltip({ children, label }: { children: ReactNode; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

const VIEW_MODES: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
  {
    id: '3d',
    label: '3D',
    icon: (
      <Image
        alt=""
        className="h-3.5 w-3.5 object-contain"
        height={14}
        src="/icons/building.webp"
        width={14}
      />
    ),
  },
  {
    id: '2d',
    label: '2D',
    icon: (
      // The blueprint icon is solid white (made for a dark bar): draw it as a mask so it follows the text colour.
      <span
        aria-hidden="true"
        className="inline-block h-3.5 w-3.5 bg-current [mask:url(/icons/blueprint.webp)_center/contain_no-repeat]"
      />
    ),
  },
  {
    id: 'split',
    label: 'Chia đôi',
    icon: <Columns2 className="h-3 w-3" />,
  },
]

const levelModeOrder = ['stacked', 'exploded', 'solo'] as const
const levelModeLabels: Record<string, string> = {
  manual: 'Tầng: chồng',
  stacked: 'Tầng: chồng',
  exploded: 'Tầng: tách',
  // UX41 U52: "một tầng" bị đọc thành "dự án chỉ có một tầng"; đây là cách xem (từng tầng một).
  solo: 'Tầng: từng tầng',
}

// AppFront (wall-review-ux): segmented control, always labelled — the old cycle button was icon-only
// below 1500 px and users could not find "full-height walls".
const WALL_SEGMENTS: readonly { mode: WallMode; label: string; hint: string }[] = [
  { mode: 'down', label: 'Thấp', hint: 'Tường thấp: hạ hết tường, nhìn rõ đồ đạc' },
  { mode: 'cutaway', label: 'Cắt', hint: 'Tường cắt: ẩn các bức tường quay về phía camera' },
  { mode: 'up', label: 'Đầy đủ', hint: 'Tường cao đủ: dựng đủ chiều cao mọi bức tường' },
  { mode: 'translucent', label: 'Mờ', hint: 'Tường trong mờ: thấy xuyên qua mọi tường' },
]

const SHADING_OPTIONS = [
  { id: 'solid', name: 'Phẳng', detail: 'Nhanh, không đổ bóng môi trường', icon: Box },
  { id: 'rendered', name: 'Đầy đủ', detail: 'Có đổ bóng môi trường', icon: Sparkles },
] as const

const FLOORPLAN_ANNOTATION_OPTIONS = [
  { id: 'automaticDimensions', name: 'Kích thước tự động', icon: Ruler },
  { id: 'manualDimensions', name: 'Kích thước thủ công', icon: Ruler },
  { id: 'measurements', name: 'Thước đã đặt', icon: ScanLine },
  { id: 'openingMarks', name: 'Ký hiệu cửa', icon: Tag },
  { id: 'structuralGrids', name: 'Lưới trục và tâm cột', icon: Grid2X2 },
  { id: 'roomLabels', name: 'Tên phòng', icon: SquareUserRound },
  { id: 'stairAnnotations', name: 'Chú thích cầu thang', icon: Footprints },
] as const

const FLOORPLAN_MODE_OPTIONS = [
  {
    id: 'default',
    name: 'Mặc định',
    detail: 'Mặt bằng gọn; kích thước hiện khi chọn',
  },
  {
    id: 'expert',
    name: 'Chuyên sâu',
    detail: 'Đủ ký hiệu và điều khiển chú thích',
  },
] as const

const FLOORPLAN_WALL_DIMENSION_REFERENCE_OPTIONS = [
  { id: 'finished-faces', name: 'Mặt hoàn thiện', detail: 'Đủ bề dày tường' },
  { id: 'centerline', name: 'Tim tường', detail: 'Một trục tường' },
  { id: 'stud-faces', name: 'Mặt kết cấu', detail: 'Mặt lõi kết cấu' },
] as const

// wall-review-ux (fewer buttons): one "3D ▾" trigger instead of three side-by-side buttons.
function ViewModeControl() {
  const viewMode = useEditor((state) => state.viewMode)
  const setViewMode = useEditor((state) => state.setViewMode)
  const current = VIEW_MODES.find((mode) => mode.id === viewMode) ?? VIEW_MODES[0]!

  return (
    <DropdownMenu>
      <ToolbarTooltip label="Cách xem: 3D, 2D hoặc chia đôi">
        <DropdownMenuTrigger asChild>
          <button
            aria-label={`Cách xem: ${current.label}`}
            className={cn(TOOLBAR_BTN, 'w-auto min-w-8 gap-1.5 px-2 font-medium text-[13px]')}
            data-appfront-viewmode=""
            type="button"
          >
            {current.icon}
            <span>{current.label}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--pa-text-3)]" />
          </button>
        </DropdownMenuTrigger>
      </ToolbarTooltip>
      <DropdownMenuContent align="end" className={SUBMENU_CONTENT_CLASS} side="bottom" sideOffset={8}>
        {VIEW_MODES.map((mode) => (
          <DropdownMenuItem key={mode.id} onSelect={() => setViewMode(mode.id)}>
            {mode.icon}
            <span>{mode.label}</span>
            {viewMode === mode.id ? <Check className="ml-auto h-4 w-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function CollapseSidebarButton() {
  const isCollapsed = useSidebarStore((state) => state.isCollapsed)
  const setIsCollapsed = useSidebarStore((state) => state.setIsCollapsed)

  const toggle = useCallback(() => {
    setIsCollapsed(!isCollapsed)
  }, [isCollapsed, setIsCollapsed])

  return (
    <div className={TOOLBAR_CONTAINER}>
      <ToolbarTooltip label={isCollapsed ? 'Mở thanh bên' : 'Thu gọn thanh bên'}>
        <button
          aria-label={isCollapsed ? 'Mở thanh bên' : 'Thu gọn thanh bên'}
          className={TOOLBAR_BTN}
          onClick={toggle}
          type="button"
        >
          {isCollapsed ? (
            <ChevronsRight className="h-4 w-4" />
          ) : (
            <ChevronsLeft className="h-4 w-4" />
          )}
        </button>
      </ToolbarTooltip>
    </div>
  )
}

const LEVEL_MODE_ICONS: Record<(typeof levelModeOrder)[number], string> = {
  stacked: 'charm:stack-push',
  exploded: 'charm:stack-pop',
  solo: 'lucide:diamond',
}

/** True once the scene has two level nodes (stops counting there). */
function hasManyLevels(nodes: Record<string, unknown>): boolean {
  let count = 0
  for (const id in nodes) if ((nodes[id] as { type?: unknown } | undefined)?.type === 'level' && ++count > 1) return true
  return false
}

/** impeccable D1: a menu (chồng / tách / một tầng) instead of a blind 3-way cycle; the button names the current state. */
function LevelModeToggle() {
  const levelMode = useViewer((state) => state.levelMode)
  const setLevelMode = useViewer((state) => state.setLevelMode)
  // AppFront edit (UX-R1 K19): one floor is the default now (page.tsx `applyStartParams`).
  const isDefault = levelMode === 'solo'
  const current = levelMode === 'manual' ? 'Tầng: tuỳ chỉnh' : (levelModeLabels[levelMode] ?? 'Tầng: chồng')
  const icon = levelMode === 'solo' || levelMode === 'exploded' ? LEVEL_MODE_ICONS[levelMode] : LEVEL_MODE_ICONS.stacked
  const label = `Cách xem tầng, đang chọn: ${current.replace('Tầng: ', '')}. Chồng hoặc tách cần từ 2 tầng đã dựng`
  // Editor3D G2 (A1-06): one floor -> nothing to stack or split, so no menu.
  const manyLevels = useScene((state) => hasManyLevels(state.nodes))
  // UX-R2: "Đây là các căn hộ riêng" — floors never stack (page.tsx pins solo), so no menu to offer.
  if (isSeparateUnits() || !manyLevels) return null

  return (
    <DropdownMenu>
      <ToolbarTooltip label={label}>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={label}
            className={cn(TOOLBAR_BTN, 'w-auto min-w-8 gap-1.5 px-2', !isDefault && BTN_ON)}
            type="button"
          >
            <IconifyIcon height={14} icon={icon} width={14} />
            <span className={`font-medium text-[13px] ${LABEL_WIDE}`}>{current}</span>
          </button>
        </DropdownMenuTrigger>
      </ToolbarTooltip>
      <DropdownMenuContent align="start" className={SUBMENU_CONTENT_CLASS} side="bottom" sideOffset={8}>
        {levelModeOrder.map((mode) => (
          <DropdownMenuItem key={mode} onSelect={() => setLevelMode(mode)}>
            <IconifyIcon height={14} icon={LEVEL_MODE_ICONS[mode]} width={14} />
            <span>{levelModeLabels[mode]}</span>
            {levelMode === mode ? <Check className="ml-auto h-4 w-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// wall-review-ux (fewer buttons): one "Tường: Cắt ▾" trigger; each mode keeps its hint in the menu.
function WallModeToggle() {
  const wallMode = useViewer((state) => state.wallMode)
  const setWallMode = useViewer((state) => state.setWallMode)
  const current = WALL_SEGMENTS.find((segment) => segment.mode === wallMode)

  const choose = (mode: WallMode) => {
    setWallMode(mode)
    rememberWallMode(() => localStorage, mode)
  }

  return (
    <DropdownMenu>
      <ToolbarTooltip label={current?.hint ?? 'Cách hiện tường'}>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={`Tường: ${current?.label ?? 'khác'}`}
            className={cn(TOOLBAR_BTN, 'w-auto min-w-8 gap-1 px-2 font-medium text-[13px]')}
            type="button"
          >
            <span className="text-[var(--pa-text-3)] max-[899px]:sr-only">Tường:</span>
            <span className="text-[var(--pa-text)]">{current?.label ?? 'khác'}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--pa-text-3)]" />
          </button>
        </DropdownMenuTrigger>
      </ToolbarTooltip>
      <DropdownMenuContent align="end" className={SUBMENU_CONTENT_CLASS} side="bottom" sideOffset={8}>
        {WALL_SEGMENTS.map((segment) => (
          <DropdownMenuItem key={segment.mode} onSelect={() => choose(segment.mode)}>
            <div className="flex flex-col">
              <span className="text-foreground">{segment.label}</span>
              <span className="text-muted-foreground text-xs">{segment.hint}</span>
            </div>
            {wallMode === segment.mode ? <Check className="ml-auto h-4 w-4 text-foreground" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// One dropdown that gathers every "how the scene looks" control: grid, shadows,
// camera projection, units, render mode, edges and scene theme.

const EDGE_OPTIONS = [
  { id: 'off', name: 'Tắt', detail: 'Không vẽ đường cạnh' },
  { id: 'soft', name: 'Nhẹ', detail: 'Viền mờ ở các nếp gấp chính' },
  { id: 'strong', name: 'Đậm', detail: 'Đường cạnh rõ, không trong suốt' },
] as const satisfies readonly { id: EdgeMode; name: string; detail: string }[]

const SUBMENU_CONTENT_CLASS = 'min-w-56 rounded-xl border-[var(--pa-border)] bg-[var(--pa-surface)] shadow-[var(--pa-shadow-overlay)]'

/**
 * AppFront edit (UX-R4 U40): the 3D view names no room, so "Phòng ▾" lists the rooms of the
 * viewed floor (solo) or every floor, with their area; picking one flies the camera there.
 * Editor3D G2 (K2/K3): a labelled button on the bar (was "Đi tới phòng" inside "Hiển thị").
 * The list reads the scene once per menu open (content renders only while open), no subscription.
 */
/** Rooms of the viewed floor (solo) or every floor. */
function viewedRooms() {
  const { levelMode, selection } = useViewer.getState()
  return roomsOf(useScene.getState().nodes, levelMode === 'solo' ? selection.levelId : null)
}

/** Editor3D đợt 2: the room last picked in "Phòng ▾" or on a scene label — where "Đi bộ" starts. */
let pickedRoomId: string | null = null

function goToRoom(zoneId: string) {
  pickedRoomId = zoneId
  fitRoom(zoneId)
}

function RoomList() {
  const rooms = viewedRooms()
  if (rooms.length === 0) {
    return <DropdownMenuItem disabled>Chưa có phòng nào</DropdownMenuItem>
  }
  return (
    <>
      {rooms.map((room) => {
        const area = `${room.areaM2.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} m²`
        return (
          // Editor3D đợt 2 (N3): one readable name, "Phòng khách, 18 m²".
          <DropdownMenuItem aria-label={`${room.name}, ${area}`} key={room.id} onSelect={() => goToRoom(room.id)}>
            <span className="truncate">{room.name}</span>
            <span className="ml-auto shrink-0 text-muted-foreground text-xs">{area}</span>
          </DropdownMenuItem>
        )
      })}
    </>
  )
}

function RoomJumpMenu() {
  const is2dOnly = useEditor((state) => state.viewMode === '2d')
  if (is2dOnly) return null
  return (
    <DropdownMenu>
      <ToolbarTooltip label="Chọn một phòng để xem gần">
        <DropdownMenuTrigger asChild>
          <button aria-label="Phòng" className={cn(TOOLBAR_BTN, 'w-auto min-w-8 gap-1 px-2')} type="button">
            <Tag className="h-3.5 w-3.5 shrink-0" />
            <span className="dock-label font-medium text-[13px]">Phòng</span>
            <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--pa-text-3)]" />
          </button>
        </DropdownMenuTrigger>
      </ToolbarTooltip>
      <DropdownMenuContent
        align="end"
        className={cn(SUBMENU_CONTENT_CLASS, 'max-h-80 overflow-y-auto')}
        side="top"
        sideOffset={8}
      >
        <RoomList />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function DisplayMenu() {
  const viewMode = useEditor((state) => state.viewMode)
  const showGrid = useViewer((state) => state.showGrid)
  const setShowGrid = useViewer((state) => state.setShowGrid)
  const showMeasurements = useViewer((state) => state.showMeasurements)
  const setShowMeasurements = useViewer((state) => state.setShowMeasurements)
  const unit = useViewer((state) => state.unit)
  const setUnit = useViewer((state) => state.setUnit)
  const metricNotation = useViewer((state) => state.metricNotation)
  const setMetricNotation = useViewer((state) => state.setMetricNotation)
  const cameraMode = useViewer((state) => state.cameraMode)
  const setCameraMode = useViewer((state) => state.setCameraMode)
  const shading = useViewer((state) => state.shading)
  const setShading = useViewer((state) => state.setShading)
  const sceneTheme = useViewer((state) => state.sceneTheme)
  const setSceneTheme = useViewer((state) => state.setSceneTheme)
  const edges = useViewer((state) => state.edges)
  const setEdges = useViewer((state) => state.setEdges)
  const shadows = useViewer((state) => state.shadows)
  const setShadows = useViewer((state) => state.setShadows)
  const magneticSnap = useEditor((state) => state.magneticSnap)
  const setMagneticSnap = useEditor((state) => state.setMagneticSnap)
  const annotationVisibility = useFloorplanAnnotationVisibility((state) => state.visibility)
  const setAnnotationCategory = useFloorplanAnnotationVisibility((state) => state.setCategory)
  const wallDimensionReference = useFloorplanAnnotationVisibility(
    (state) => state.wallDimensionReference,
  )
  const setWallDimensionReference = useFloorplanAnnotationVisibility(
    (state) => state.setWallDimensionReference,
  )
  const floorplanMode = useFloorplanMode((state) => state.mode)
  const setFloorplanMode = useFloorplanMode((state) => state.setMode)

  const activeShading =
    SHADING_OPTIONS.find((option) => option.id === shading) ?? SHADING_OPTIONS[0]
  const activeEdges = EDGE_OPTIONS.find((option) => option.id === edges) ?? EDGE_OPTIONS[0]
  const activeTheme = getSceneTheme(sceneTheme)

  // Keep the menu open when flipping a toggle.
  const keepOpen = (event: Event, fn: () => void) => {
    event.preventDefault()
    fn()
  }

  return (
    <DropdownMenu>
      {/* wall-review-ux (fewer buttons): a row inside the page's "Xem" menu (../../ViewMenu.tsx), not a bar button. */}
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Cài đặt hiển thị: lưới, bóng, đơn vị, kết xuất"
          className={cn(
            'flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] text-[var(--pa-text-2)] hover:bg-[var(--pa-sunken)] hover:text-[var(--pa-text)]',
            BTN_FOCUS,
          )}
          type="button"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">Lưới, bóng, đơn vị, kết xuất</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 -rotate-90 text-[var(--pa-text-3)]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-60 rounded-xl border-[var(--pa-border)] bg-[var(--pa-surface)] shadow-[var(--pa-shadow-overlay)]"
        side="left"
        sideOffset={8}
      >
        <DropdownMenuItem onSelect={(e) => keepOpen(e, () => setShowGrid(!showGrid))}>
          <Grid2X2 className="h-4 w-4" />
          <span>Lưới</span>
          <OnOff on={showGrid} />
        </DropdownMenuItem>
        {viewMode !== '2d' ? (
          <DropdownMenuItem
            onSelect={(e) => keepOpen(e, () => setShowMeasurements(!showMeasurements))}
            // UX-R3 U41: cờ này chỉ hiện các thước người dùng đã đặt, không tự đo tường/phòng — nói đúng như vậy.
            title="Hiện các thước bạn đã đặt bằng công cụ đo (phím M)"
          >
            <Ruler className="h-4 w-4" />
            <span>{viewMode === 'split' ? 'Thước đã đặt (3D)' : 'Thước đã đặt'}</span>
            <OnOff on={showMeasurements} />
          </DropdownMenuItem>
        ) : null}
        {viewMode !== '3d' ? (
          <>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Layers3 className="h-4 w-4" />
                <span>Chế độ mặt bằng</span>
                <span className="ml-auto text-muted-foreground text-xs">
                  {floorplanMode === 'default' ? 'Mặc định' : 'Chuyên sâu'}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className={SUBMENU_CONTENT_CLASS}>
                {FLOORPLAN_MODE_OPTIONS.map((option) => (
                  <DropdownMenuItem key={option.id} onSelect={() => setFloorplanMode(option.id)}>
                    <div className="flex flex-col">
                      <span className="text-foreground">{option.name}</span>
                      <span className="text-muted-foreground text-xs">{option.detail}</span>
                    </div>
                    {floorplanMode === option.id ? (
                      <Check className="ml-auto h-4 w-4 text-foreground" />
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            {floorplanMode === 'expert' ? (
              <>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Layers3 className="h-4 w-4" />
                    <span>Chú thích mặt bằng</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className={SUBMENU_CONTENT_CLASS}>
                    {FLOORPLAN_ANNOTATION_OPTIONS.map((option) => {
                      const OptionIcon = option.icon
                      const visible = annotationVisibility[option.id]
                      return (
                        <DropdownMenuItem
                          key={option.id}
                          onSelect={(e) =>
                            keepOpen(e, () => setAnnotationCategory(option.id, !visible))
                          }
                        >
                          <OptionIcon className="h-4 w-4" />
                          <span>{option.name}</span>
                          <OnOff on={visible} />
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Ruler className="h-4 w-4" />
                    <span>Kích thước tường</span>
                    <span className="ml-auto text-muted-foreground text-xs">
                      {
                        FLOORPLAN_WALL_DIMENSION_REFERENCE_OPTIONS.find(
                          (option) => option.id === wallDimensionReference,
                        )?.name
                      }
                    </span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className={SUBMENU_CONTENT_CLASS}>
                    {FLOORPLAN_WALL_DIMENSION_REFERENCE_OPTIONS.map((option) => (
                      <DropdownMenuItem
                        key={option.id}
                        onSelect={(event) =>
                          keepOpen(event, () => setWallDimensionReference(option.id))
                        }
                      >
                        <div className="flex flex-col">
                          <span className="text-foreground">{option.name}</span>
                          <span className="text-muted-foreground text-xs">{option.detail}</span>
                        </div>
                        {wallDimensionReference === option.id ? (
                          <Check className="ml-auto h-4 w-4 text-foreground" />
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </>
            ) : null}
          </>
        ) : null}
        <DropdownMenuItem onSelect={(e) => keepOpen(e, () => setMagneticSnap(!magneticSnap))}>
          <Magnet className="h-4 w-4" />
          <span>Bắt dính</span>
          <OnOff on={magneticSnap} />
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => keepOpen(e, () => setShadows(!shadows))}>
          <Contrast className="h-4 w-4" />
          <span>Đổ bóng</span>
          <OnOff on={shadows} />
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) =>
            keepOpen(e, () =>
              setCameraMode(cameraMode === 'perspective' ? 'orthographic' : 'perspective'),
            )
          }
        >
          <IconifyIcon
            height={16}
            icon={cameraMode === 'perspective' ? 'icon-park-outline:perspective' : 'vaadin:grid'}
            width={16}
          />
          <span>Máy quay</span>
          <span className="ml-auto text-muted-foreground text-xs">
            {cameraMode === 'perspective' ? 'Phối cảnh' : 'Trực giao'}
          </span>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <span className="flex h-4 w-4 items-center justify-center font-semibold text-[10px]">
              {unit === 'imperial' ? 'ft' : metricNotation === 'millimeters' ? 'mm' : 'm'}
            </span>
            <span>Đơn vị</span>
            <span className="ml-auto text-muted-foreground text-xs">
              {unit === 'imperial'
                ? 'Feet và inch'
                : metricNotation === 'millimeters'
                  ? 'Mi-li-mét'
                  : 'Mét'}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className={SUBMENU_CONTENT_CLASS}>
            <DropdownMenuItem onSelect={() => setMetricNotation('meters')}>
              <span className="flex h-4 w-4 items-center justify-center font-semibold text-[10px]">
                m
              </span>
              <span>Mét</span>
              {unit === 'metric' && metricNotation === 'meters' ? (
                <Check className="ml-auto h-4 w-4 text-foreground" />
              ) : null}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setMetricNotation('millimeters')}>
              <span className="flex h-4 w-4 items-center justify-center font-semibold text-[10px]">
                mm
              </span>
              <span>Mi-li-mét</span>
              {unit === 'metric' && metricNotation === 'millimeters' ? (
                <Check className="ml-auto h-4 w-4 text-foreground" />
              ) : null}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setUnit('imperial')}>
              <span className="flex h-4 w-4 items-center justify-center font-semibold text-[10px]">
                ft
              </span>
              <span>Feet và inch</span>
              {unit === 'imperial' ? <Check className="ml-auto h-4 w-4 text-foreground" /> : null}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <activeShading.icon className="h-4 w-4" />
            <span>Kết xuất</span>
            <span className="ml-auto text-muted-foreground text-xs">{activeShading.name}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className={SUBMENU_CONTENT_CLASS}>
            {SHADING_OPTIONS.map((option) => {
              const OptionIcon = option.icon
              return (
                <DropdownMenuItem key={option.id} onSelect={() => setShading(option.id)}>
                  <OptionIcon className="h-4 w-4" />
                  <div className="flex flex-col">
                    <span className="text-foreground">{option.name}</span>
                    <span className="text-muted-foreground text-xs">{option.detail}</span>
                  </div>
                  {shading === option.id ? (
                    <Check className="ml-auto h-4 w-4 text-foreground" />
                  ) : null}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <PenLine className="h-4 w-4" />
            <span>Cạnh</span>
            <span className="ml-auto text-muted-foreground text-xs">{activeEdges.name}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className={SUBMENU_CONTENT_CLASS}>
            {EDGE_OPTIONS.map((option) => (
              <DropdownMenuItem key={option.id} onSelect={() => setEdges(option.id)}>
                <div className="flex flex-col">
                  <span className="text-foreground">{option.name}</span>
                  <span className="text-muted-foreground text-xs">{option.detail}</span>
                </div>
                {edges === option.id ? <Check className="ml-auto h-4 w-4 text-foreground" /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <SwatchBook className="h-4 w-4" />
            <span>Giao diện</span>
            <span className="ml-auto truncate text-muted-foreground text-xs">
              {themeName(activeTheme.id, activeTheme.name)}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-48 rounded-xl border-[var(--pa-border)] bg-[var(--pa-surface)] shadow-[var(--pa-shadow-overlay)]">
            {SCENE_THEMES.map((theme) => {
              const swatches = (['wall', 'roof', 'floor', 'glazing'] as const).map(
                (role) => theme.clayTints?.[role] ?? CLAY_PALETTE[role],
              )
              return (
                <DropdownMenuItem key={theme.id} onSelect={() => setSceneTheme(theme.id)}>
                  <span
                    className="grid h-5 w-5 shrink-0 grid-cols-2 overflow-hidden rounded-sm border border-[var(--pa-border)]"
                    style={{ backgroundColor: theme.background }}
                  >
                    {swatches.map((color, index) => (
                      <span key={`${theme.id}-${index}`} style={{ backgroundColor: color }} />
                    ))}
                  </span>
                  <span className="text-foreground">{themeName(theme.id, theme.name)}</span>
                  {sceneTheme === theme.id ? (
                    <Check className="ml-auto h-4 w-4 text-foreground" />
                  ) : null}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * AppFront edit (P40, G5-06 / G5-07 / G5-48): frame the model. UX-R2 K38: the same frame as the
 * first open (`../lib/view-frame.ts`) — in solo mode that is the floor being viewed, at its height.
 */
export function fitWholeModel() {
  fitModel()
}

function FitViewButton() {
  return (
    <ToolbarTooltip label="Xem toàn bộ mô hình">
      <button
        aria-label="Xem toàn bộ mô hình"
        className={cn(TOOLBAR_BTN, 'w-auto min-w-8 gap-1.5 px-2')}
        onClick={fitWholeModel}
        type="button"
      >
        <Maximize className="h-3.5 w-3.5 shrink-0" />
        <span className={`font-medium text-[13px] ${LABEL_CAMERA}`}>Xem toàn bộ</span>
      </button>
    </ToolbarTooltip>
  )
}

/**
 * AppFront edit (G5-12 / G5-48): Vietnamese-labelled replacements for the vendor `CameraActions`
 * group (hidden by scoped CSS in `canvas-help.tsx`). They emit the same public camera events;
 * "Nhìn từ trên" frames what is viewed (solo: the floor, at its height; UX-R2 K38, `../lib/view-frame.ts`)
 * straight from above via `apply-pose`, and a second press
 * hands back to upstream `top-view`, which returns to 45° when already looking down.
 */
const COVERED_PX = 160

export function topViewToggle() {
  let pose = null as Parameters<typeof isTopDown>[0]
  subscribeCameraPose((current) => {
    pose = current
  })()
  if (isTopDown(pose)) {
    emitter.emit('camera-controls:top-view')
    return
  }
  const { bounds, baseY } = viewedFrame()
  // Editor3D G2 (L1-09): the camera sizes the view by the canvas (narrower than the window while the
  // panel is open), and the top bar + bottom tool bar cover ~160 px of it: fit the plan into what stays seen.
  const rect = document.querySelector('[data-pascal-viewer-3d] canvas')?.getBoundingClientRect()
  const width = rect?.width || window.innerWidth
  const height = rect?.height || window.innerHeight
  const aspect = width / Math.max(1, height - COVERED_PX)
  emitter.emit(
    'camera-controls:apply-pose',
    topViewPose(bounds, useViewer.getState().cameraMode, aspect, baseY),
  )
}

const CAMERA_BUTTONS = [
  { label: 'Xoay trái 90°', icon: RotateCcw, onClick: () => emitter.emit('camera-controls:orbit-ccw') },
  { label: 'Xoay phải 90°', icon: RotateCw, onClick: () => emitter.emit('camera-controls:orbit-cw') },
] as const

function enterWalkthrough() {
  flushSync(() => useEditor.getState().setFirstPersonMode(true))
  requestWalkthroughPointerLock()
}

/** Camera eye within this many metres of the asked pose counts as arrived. */
const WALK_ARRIVED_M = 0.15
/** Give up waiting for the camera to land and start the walk anyway (pointer lock still needs the click's activation). */
const WALK_FLY_MAX_MS = 1500
const WALK_FLY_RETRIES = 4

/**
 * Editor3D đợt 2: with no spawn point the vendor starts the walk under the camera, facing its heading
 * (`deriveFirstPersonSpawn`) — from the orbit pose that was outside the home. Fly the camera to an eye
 * point inside the picked room (else the largest one), then start the walk there.
 */
function walkStartPoseNow() {
  const { nodes } = useScene.getState()
  if (Object.values(nodes).some((node) => node?.type === 'spawn')) return null
  const zoneId = pickWalkRoom(viewedRooms(), pickedRoomId)
  const zone = zoneId ? (nodes as unknown as Record<string, { parentId?: unknown; polygon?: unknown } | undefined>)[zoneId] : undefined
  if (!zone) return null
  const levelId = typeof zone.parentId === 'string' ? zone.parentId : null
  const baseY = levelId ? getLevelPresentationY(levelId, nodes, useViewer.getState().levelMode) : 0
  return walkStartPose(zone.polygon, baseY)
}

/** Enter or leave the walkthrough (first-person) mode. */
function toggleWalkthrough() {
  const { isFirstPersonMode, setFirstPersonMode } = useEditor.getState()
  if (isFirstPersonMode) {
    setFirstPersonMode(false)
    return
  }
  const pose = walkStartPoseNow()
  if (!pose) {
    enterWalkthrough()
    return
  }
  const [x, y, z] = pose.position
  let done = false
  let unsubscribe = () => {}
  let timer = 0
  let tries = 0
  const start = () => {
    if (done) return
    done = true
    window.clearTimeout(timer)
    unsubscribe()
    enterWalkthrough()
  }
  // Thử tay đợt 2: bấm lúc cảnh còn đang dựng thì camera chưa nhận lệnh bay → người đứng ngoài nhà.
  // Chưa tới nơi thì gửi lại lệnh bay (tối đa ~6 s) rồi mới vào đi bộ.
  const fly = () => {
    if (done) return
    if (tries++ >= WALK_FLY_RETRIES) {
      start()
      return
    }
    emitter.emit('camera-controls:apply-pose', pose)
    timer = window.setTimeout(fly, WALK_FLY_MAX_MS)
  }
  fly()
  unsubscribe = subscribeCameraPose(({ position: [px, py, pz] }) => {
    if (Math.hypot(px - x, py - y, pz - z) < WALK_ARRIVED_M) start()
  })
  // the current pose is reported synchronously: already there -> started before `unsubscribe` was set
  if (done) unsubscribe()
}

/** True once the model is drawn (same probe as the first-use tour); stays true afterwards. */
function useSceneDrawn(): boolean {
  const [drawn, setDrawn] = useState(() => isSceneReady(document))
  useEffect(() => {
    if (drawn) return
    const timer = window.setInterval(() => {
      if (isSceneReady(document)) setDrawn(true)
    }, 500)
    return () => window.clearInterval(timer)
  }, [drawn])
  return drawn
}

/** Editor3D G2 (K2): "Nhìn từ trên" and "Đi bộ" are labelled buttons on the bar (were inside "…"). */
function TopViewWalkButtons() {
  const is2dOnly = useEditor((state) => state.viewMode === '2d')
  // Thử tay đợt 2: bấm khi cảnh còn đang dựng thì camera chưa bay được → người đứng ngoài nhà.
  const walkReady = useSceneDrawn()
  const labelled = cn(TOOLBAR_BTN, 'w-auto min-w-8 gap-1.5 px-2')
  return (
    <>
      {is2dOnly ? null : (
        <ToolbarTooltip label="Nhìn từ trên xuống, bấm lần nữa để nhìn nghiêng">
          <button aria-label="Nhìn từ trên" className={labelled} onClick={topViewToggle} type="button">
            <ArrowDownToDot className="h-3.5 w-3.5 shrink-0" />
            <span className={`font-medium text-[13px] ${LABEL_CAMERA}`}>Nhìn từ trên</span>
          </button>
        </ToolbarTooltip>
      )}
      <ToolbarTooltip label={walkReady ? 'Đi bộ trong nhà (Esc để thoát)' : 'Chờ dựng xong mô hình để đi bộ'}>
        <button aria-label="Đi bộ" className={labelled} disabled={!walkReady} onClick={toggleWalkthrough} type="button">
          <Footprints className="h-3.5 w-3.5 shrink-0" />
          <span className={`font-medium text-[13px] ${LABEL_CAMERA}`}>Đi bộ</span>
        </button>
      </ToolbarTooltip>
    </>
  )
}

/**
 * AppFront edit (UX-R1 K38/K49): the rotate pair lives in this "Góc nhìn" menu.
 * HIG-A: with `projectId` (dock too narrow even as icons) the rest of the dock folds in here too.
 */
function MoreCameraMenu({ projectId }: { projectId?: string }) {
  const is2dOnly = useEditor((state) => state.viewMode === '2d')
  const walkReady = useSceneDrawn()
  return (
    <div className="contents">
      <DropdownMenu>
        <ToolbarTooltip label="Góc nhìn: xoay trái, xoay phải">
          <DropdownMenuTrigger asChild>
            <button aria-label="Góc nhìn" className={TOOLBAR_BTN} type="button">
              <Ellipsis className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
        </ToolbarTooltip>
        <DropdownMenuContent align="end" className={SUBMENU_CONTENT_CLASS} side="top" sideOffset={8}>
          {projectId ? (
            <>
              {is2dOnly ? null : (
                <DropdownMenuItem onSelect={topViewToggle}>
                  <ArrowDownToDot className="h-4 w-4" />
                  <span>Nhìn từ trên</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem disabled={!walkReady} onSelect={toggleWalkthrough}>
                <Footprints className="h-4 w-4" />
                <span>Đi bộ</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={fitWholeModel}>
                <Maximize className="h-4 w-4" />
                <span>Xem toàn bộ</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          {CAMERA_BUTTONS.map(({ label, icon: ItemIcon, onClick }) => (
            <DropdownMenuItem key={label} onSelect={onClick}>
              <ItemIcon className="h-4 w-4" />
              <span>{label}</span>
            </DropdownMenuItem>
          ))}
          {projectId ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => shootView(projectId)}>
                <Camera className="h-4 w-4" />
                <span>Ảnh</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void copyEditorLink(projectId).catch(() => undefined)}>
                <Send className="h-4 w-4" />
                <span>Chép liên kết trang 3D</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openShareLinkPage(projectId)}>
                <Send className="h-4 w-4" />
                <span>Tạo liên kết xem không cần tài khoản</span>
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

const canUndoNow = () => getHistoryCommandState().canUndo
const canRedoNow = () => getHistoryCommandState().canRedo

/**
 * Editor3D G2 (T13, A2-03, F-08): labelled Hoàn tác / Làm lại, always on the bar, disabled when the
 * history is empty. Same calls as Ctrl+Z / Ctrl+Shift+Z (`runUndo` / `runRedo`). "Hoàn tác" never collapses.
 */
function UndoRedoButtons({ compact = false }: { compact?: boolean }) {
  const canUndo = useSyncExternalStore(subscribeHistoryCommandState, canUndoNow)
  const canRedo = useSyncExternalStore(subscribeHistoryCommandState, canRedoNow)
  const btn = cn(TOOLBAR_BTN, 'w-auto min-w-8 gap-1.5 px-2 font-medium text-[13px] disabled:cursor-not-allowed')
  return (
    <div className={TOOLBAR_CONTAINER} data-appfront-undo="" data-compact={compact ? '' : undefined}>
      <ToolbarTooltip label={canUndo ? 'Hoàn tác (Ctrl+Z)' : 'Chưa có gì để hoàn tác'}>
        <button aria-label="Hoàn tác" className={btn} disabled={!canUndo} onClick={() => runUndo()} type="button">
          <Undo2 className="h-3.5 w-3.5 shrink-0" />
          <span className="dock-label">Hoàn tác</span>
        </button>
      </ToolbarTooltip>
      <div className="my-1.5 w-px bg-[var(--pa-border)]" />
      <ToolbarTooltip label={canRedo ? 'Làm lại (Ctrl+Shift+Z)' : 'Chưa có gì để làm lại'}>
        <button aria-label="Làm lại" className={btn} disabled={!canRedo} onClick={() => runRedo()} type="button">
          <Redo2 className="h-3.5 w-3.5 shrink-0" />
          <span className="dock-label">Làm lại</span>
        </button>
      </ToolbarTooltip>
    </div>
  )
}

function PreviewButton() {
  return (
    <ToolbarTooltip label="Xem trước (Esc để thoát)">
      <button
        aria-label="Xem trước"
        className={cn('flex min-w-8 items-center justify-center gap-1.5 px-2 font-medium text-[13px]', BTN_GHOST)}
        onClick={() => useEditor.getState().setPreviewMode(true)}
        type="button"
      >
        <Eye className="h-3.5 w-3.5 shrink-0" />
      </button>
    </ToolbarTooltip>
  )
}

function VRButton({
  active,
  disabled,
  label,
  onToggle,
}: {
  active: boolean
  disabled: boolean
  label: string
  onToggle: () => void
}) {
  return (
    <ToolbarTooltip label={label}>
      <button
        aria-label={label}
        aria-pressed={active}
        className={cn(TOOLBAR_BTN, active && BTN_ON)}
        disabled={disabled}
        onClick={onToggle}
        type="button"
      >
        <IconifyIcon
          className={cn('h-4 w-4', disabled && 'animate-pulse opacity-45')}
          icon="mdi:virtual-reality"
        />
      </button>
    </ToolbarTooltip>
  )
}

/** wall-review-ux (no top bar): only the sidebar toggle is left; it sits in the left panel's head (main.tsx). */
export function CommunityViewerToolbarLeft() {
  return <CollapseSidebarButton />
}

// ponytail: the vendor action menu has no hook to add buttons, so the dock finds it by its classes and
// polls its edges (it moves with the sidebar / measure menu); if the class changes the dock falls back to
// fixed offsets around the centre.
const ACTION_MENU = 'div.fixed.bottom-6.left-1\\/2'
const DOCK_GAP = 8

function useActionMenuEdges() {
  const [edges, setEdges] = useState<{ left: number; right: number } | null>(null)
  useEffect(() => {
    const read = () => {
      const rect = document.querySelector(ACTION_MENU)?.getBoundingClientRect()
      setEdges((prev) =>
        !rect ? null : prev && prev.left === rect.left && prev.right === rect.right ? prev : { left: rect.left, right: rect.right },
      )
    }
    read()
    const timer = window.setInterval(read, 250)
    return () => window.clearInterval(timer)
  }, [])
  return edges
}

/** The viewer column (the top bar's parent, vendor RightColumn); null when not mounted. */
function viewerColumn(): HTMLElement | null {
  return document.querySelector('[data-appfront-bar]')?.closest<HTMLElement>('.z-20')?.parentElement ?? null
}

/**
 * Đợt 2 (thử tay 1280 px, bảng Dựng mở) + chrome-layout 04/11: undo + tool bar + dock centre together on
 * the canvas (the vendor tool bar moves by `margin-left`, computed from widths only, so no measuring loop).
 * Labels collapse (`data-compact`, pascal-chrome.css) whenever the labelled widths — remembered while
 * labels show — do not fit the canvas; steps in `dockLayout`. HIG-A (768 px, bảng bên mở): level 2 folds into "…".
 */
function useDockFit(): { fit: DockFit; undoCompact: boolean } {
  const [fit, setFit] = useState<DockFit>(0)
  const [undoCompact, setUndoCompact] = useState(false)
  const widths = useRef({ full: 0, icons: 0, undo: 0, undoIcons: 0 })
  useEffect(() => {
    const check = () => {
      const tools = document.querySelector<HTMLElement>(ACTION_MENU)
      const dock = document.querySelector<HTMLElement>('[data-appfront-dock]')
      if (!tools) return
      if (!dock) {
        tools.style.marginLeft = ''
        return
      }
      const w = widths.current
      const dockWidth = dock.getBoundingClientRect().width
      if (!dock.hasAttribute('data-compact')) w.full = dockWidth
      else if (!dock.hasAttribute('data-tight')) w.icons = dockWidth
      const undo = document.querySelector<HTMLElement>('[data-appfront-undo]')
      const undoWidth = undo?.getBoundingClientRect().width ?? 0
      if (undo) w[undo.hasAttribute('data-compact') ? 'undoIcons' : 'undo'] = undoWidth
      const canvas = window.innerWidth - (viewerColumn()?.getBoundingClientRect().left ?? 0)
      const next = dockLayout({ ...w, canvas, tools: tools.getBoundingClientRect().width }, DOCK_GAP)
      setFit(next.fit)
      setUndoCompact(next.undoCompact)
      tools.style.marginLeft = `${toolsShift(undoWidth, dockWidth, DOCK_GAP)}px`
    }
    check()
    const timer = window.setInterval(check, 250)
    return () => window.clearInterval(timer)
  }, [])
  return { fit, undoCompact }
}

/**
 * HIG-A: the top bar wraps (pascal.css) and its height changes with the sidebar, selection cards and
 * width, so the floor card and the canvas-help pill read its bottom edge (and the viewer column's left
 * edge, to centre on the canvas rather than the window) from these variables instead of a fixed top-14.
 */
function useBarLayoutVars() {
  useEffect(() => {
    const style = document.documentElement.style
    const tick = () => {
      const column = viewerColumn()
      const bar = document.querySelector('[data-appfront-bar]')?.closest('.z-20')
      if (!column || !bar) return
      const vars = barLayoutVars(bar.getBoundingClientRect(), column.getBoundingClientRect())
      for (const [name, value] of Object.entries(vars)) style.setProperty(name, value)
      // chrome-layout: the floating left head has 1 or 2 rows; the floor card and help column sit below it.
      const head = document.querySelector('[data-appfront-panel-head="floating"]')
      if (head) style.setProperty('--appfront-head-bottom', `${Math.round(head.getBoundingClientRect().bottom)}px`)
    }
    tick()
    const timer = window.setInterval(tick, 250)
    return () => {
      window.clearInterval(timer)
      style.removeProperty('--appfront-head-bottom')
      style.removeProperty('--appfront-bar-bottom')
      style.removeProperty('--appfront-viewer-left')
    }
  }, [])
}

const shootView = (projectId: string) =>
  emitter.emit('camera-controls:generate-thumbnail', {
    projectId,
    requestId: QUICK_SHOT_REQUEST_ID,
    captureMode: 'viewport',
  })
const copyEditorLink = (projectId: string) =>
  navigator.clipboard.writeText(new URL(editor3dHref(projectId), window.location.origin).toString())
const openShareLinkPage = (projectId: string) =>
  window.open(`${ROUTES.project.export(projectId)}?share=1`, '_blank', 'noopener')

/** Editor3D đợt 2: "Ảnh" — the vendor capture of the current view; page.tsx saves it as `<tên>-3d.png`. */
function SnapshotButton({ projectId }: { projectId: string }) {
  const shoot = () => shootView(projectId)
  return (
    <ToolbarTooltip label="Chụp khung đang nhìn, tải ảnh PNG về máy">
      <button aria-label="Ảnh" className={cn(TOOLBAR_BTN, 'w-auto min-w-8 gap-1.5 px-2')} onClick={shoot} type="button">
        <Camera className="h-3.5 w-3.5 shrink-0" />
        <span className={`font-medium text-[13px] ${LABEL_CAMERA}`}>Ảnh</span>
      </button>
    </ToolbarTooltip>
  )
}

const MENU_DETAIL = 'text-muted-foreground text-xs leading-4 whitespace-normal'

/**
 * Editor3D đợt 2 (C5): "Gửi người nhà". The project has no invite endpoint (members are read-only,
 * `shareDialogGateway.ts`), but it has public view-only share links (`/share/:token`, made in the
 * Xuất step's "Chia sẻ" dialog). So: copy this page's address (members only), or open that dialog's page.
 */
function SendFamilyMenu({ projectId }: { projectId: string }) {
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null)
  const copy = (event: Event) => {
    event.preventDefault()
    copyEditorLink(projectId).then(
      () => setCopied('ok'),
      () => setCopied('failed'),
    )
  }
  return (
    <DropdownMenu onOpenChange={(open) => (open ? null : setCopied(null))}>
      <ToolbarTooltip label="Gửi mô hình cho người nhà xem">
        <DropdownMenuTrigger asChild>
          <button aria-label="Gửi người nhà" className={cn(TOOLBAR_BTN, 'w-auto min-w-8 gap-1.5 px-2')} type="button">
            <Send className="h-3.5 w-3.5 shrink-0" />
            <span className={`font-medium text-[13px] ${LABEL_CAMERA}`}>Gửi người nhà</span>
          </button>
        </DropdownMenuTrigger>
      </ToolbarTooltip>
      <DropdownMenuContent align="end" className={cn(SUBMENU_CONTENT_CLASS, 'w-80')} side="top" sideOffset={8}>
        <DropdownMenuItem onSelect={copy}>
          <div className="flex flex-col gap-0.5">
            <span className="text-foreground" role="status">
              {copied === 'ok' ? 'Đã chép liên kết trang 3D' : copied === 'failed' ? 'Chưa chép được, hãy thử lại' : 'Chép liên kết trang 3D'}
            </span>
            <span className={MENU_DETAIL}>Người nhận cần được mời vào dự án (quyền Xem) và đăng nhập mới mở được.</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => openShareLinkPage(projectId)}>
          <div className="flex flex-col gap-0.5">
            <span className="text-foreground">Tạo liên kết xem không cần tài khoản</span>
            <span className={MENU_DETAIL}>Mở trang Xuất ở thẻ mới, tạo liên kết chỉ xem có hạn dùng.</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** N1: a room label on the scene (scripts/realism/u40-room-labels.mjs) asks to fly to its room. */
function useFitRoomFromLabels() {
  useEffect(() => {
    const onFit = (event: Event) => {
      const zoneId = (event as CustomEvent<unknown>).detail
      if (typeof zoneId === 'string') goToRoom(zoneId)
    }
    window.addEventListener('appfront:fit-room', onFit)
    return () => window.removeEventListener('appfront:fit-room', onFit)
  }, [])
}

/**
 * Editor3D (01/11, T13 + K2): bottom dock — Hoàn tác / Làm lại left of the tool bar, the "go around the
 * home" group (Phòng ▾, Nhìn từ trên, Đi bộ, Xem toàn bộ, …) right of it. Hidden in Xem trước / Đi bộ.
 * Editor3D đợt 2: + "Ảnh" and "Gửi người nhà"; it also hosts the room-label listener (always mounted).
 */
export function BottomDock({ projectId, readOnly = false }: { projectId: string; readOnly?: boolean }) {
  const edges = useActionMenuEdges()
  const { fit, undoCompact } = useDockFit()
  useFitRoomFromLabels()
  const hidden = useEditor((state) => state.isPreviewMode || state.isFirstPersonMode)
  if (hidden) return null
  const leftStyle = edges ? { right: window.innerWidth - edges.left + DOCK_GAP } : { right: 'calc(50% + 72px)' }
  const rightStyle = edges ? { left: edges.right + DOCK_GAP } : { left: 'calc(50% + 72px)' }
  // In <body> like the Radix menus: inside the page, a press would also reach the scene's pointer source
  // and select the wall behind the dock.
  return createPortal(
    <>
      {readOnly ? null : (
        <div className="fixed bottom-6 z-50" style={leftStyle}>
          <UndoRedoButtons compact={undoCompact} />
        </div>
      )}
      <div className="fixed bottom-6 z-50" style={rightStyle}>
        <div
          className={TOOLBAR_CONTAINER}
          data-appfront-dock=""
          data-compact={fit > 0 ? '' : undefined}
          data-tight={fit === 2 ? '' : undefined}
        >
          <RoomJumpMenu />
          {fit === 2 ? (
            <MoreCameraMenu projectId={projectId} />
          ) : (
            <>
              <TopViewWalkButtons />
              <FitViewButton />
              <MoreCameraMenu />
              <div className="my-1.5 w-px bg-[var(--pa-border)]" />
              <SnapshotButton projectId={projectId} />
              <SendFamilyMenu projectId={projectId} />
            </>
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}

/**
 * wall-review-ux (no top bar, fewer buttons): the right group is a small "Xem" panel at the canvas's top
 * right, one row: "3D ▾", "Tường: Cắt ▾", `children` (the page's "Xem ▾" menu — style, lighting, quality,
 * bake and the display settings — plus the placement chip when there are issues, main.tsx), "Tầng ▾" (2+
 * floors only) and the Xem trước eye. The left group moved into the left panel's head.
 */
export function CommunityViewerToolbarRight({
  children,
  onVRToggle,
  vrButton,
  vrActive = false,
  vrDisabled = false,
  vrLabel = vrActive ? 'Exit VR' : 'Enter VR',
}: {
  children?: ReactNode
  onVRToggle?: () => void
  vrButton?: ReactNode
  vrActive?: boolean
  vrDisabled?: boolean
  vrLabel?: string
}) {
  useBarLayoutVars()
  return (
    <section
      aria-label="Xem"
      className="flex w-max max-w-[calc(100vw-2rem)] flex-wrap items-center justify-end gap-1 rounded-2xl border border-[var(--pa-border)] bg-[var(--pa-surface)] p-1 shadow-[var(--pa-shadow-float)]"
      data-appfront-bar=""
      data-appfront-viewpanel=""
    >
      <div className={TOOLBAR_CONTAINER}>
        <ViewModeControl />
        <div className="my-1.5 w-px bg-[var(--pa-border)]" />
        <WallModeToggle />
      </div>
      {children}
      <div className={TOOLBAR_CONTAINER}>
        <LevelModeToggle />
        <PreviewButton />
        {onVRToggle || vrButton
          ? (vrButton ??
            (onVRToggle ? (
              <VRButton active={vrActive} disabled={vrDisabled} label={vrLabel} onToggle={onVRToggle} />
            ) : null))
          : null}
        <CanvasHelpButton className={cn(TOOLBAR_BTN, 'aria-expanded:bg-[var(--pa-selected)] aria-expanded:text-[var(--pa-accent)]')} />
      </div>
    </section>
  )
}
