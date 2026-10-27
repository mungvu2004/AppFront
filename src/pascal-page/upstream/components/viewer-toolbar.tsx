'use client'
/**
 * VERBATIM copy of upstream Pascal apps/editor/components/viewer-toolbar.tsx (F:\pascal-editor, commit cd14090, MIT).
 * Edits: import paths only (`@/components/*`, `@/lib/*` -> relative).
 * pascal-polish T3: className/presentation only (AppFront surface/selected/accent tokens, label collapse thresholds).
 * UX-R1: camera buttons always in the "Góc nhìn" menu; the level toggle is lit when not "một tầng".
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
  getSceneTheme,
  SCENE_THEMES,
  useViewer,
} from '@pascal-app/viewer'
import {
  ArrowDownToDot,
  Box,
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
  PenLine,
  RotateCcw,
  RotateCw,
  Ruler,
  ScanLine,
  SlidersHorizontal,
  Sparkles,
  SquareUserRound,
  SwatchBook,
  Tag,
} from 'lucide-react'
import { emitter, useScene } from '@pascal-app/core'
import Image from 'next/image'
import { computeSceneBoundsXZ, type SceneBoundsXZ } from '../../../../vendor/pascal/packages/editor/src/lib/scene-bounds'
import { type ReactNode, useCallback, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import { isTopDown, topViewPose } from '../lib/top-view-pose'
import { planBoundsXZ } from '../lib/fit-on-ready'
import { cn } from '../lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from './toolbar-tooltip'
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
const LABEL_MID = 'sr-only @min-[1200px]/appbar:not-sr-only'

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
  solo: 'Tầng: một tầng',
}

const wallModeOrder = ['cutaway', 'up', 'down', 'translucent'] as const
const wallModeConfig: Record<string, { icon: string; label: string }> = {
  up: { icon: '/icons/room.webp', label: 'Tường: cao đủ' },
  cutaway: { icon: '/icons/wallcut.webp', label: 'Tường: cắt' },
  down: { icon: '/icons/walllow.webp', label: 'Tường: thấp' },
  translucent: { icon: '/icons/wall.webp', label: 'Tường: trong mờ' },
}

const SHADING_OPTIONS = [
  { id: 'solid', name: 'Phẳng', detail: 'Nhanh, không đổ bóng môi trường', icon: Box },
  { id: 'rendered', name: 'Đầy đủ', detail: 'Có đổ bóng môi trường', icon: Sparkles },
] as const

const FLOORPLAN_ANNOTATION_OPTIONS = [
  { id: 'automaticDimensions', name: 'Kích thước tự động', icon: Ruler },
  { id: 'manualDimensions', name: 'Kích thước thủ công', icon: Ruler },
  { id: 'measurements', name: 'Số đo', icon: ScanLine },
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

function ViewModeControl() {
  const viewMode = useEditor((state) => state.viewMode)
  const setViewMode = useEditor((state) => state.setViewMode)

  return (
    <div className={TOOLBAR_CONTAINER}>
      {VIEW_MODES.map((mode) => {
        const isActive = viewMode === mode.id
        return (
          <ToolbarTooltip key={mode.id} label={mode.label}>
            <button
              aria-label={mode.label}
              aria-pressed={isActive}
              className={cn(
                'flex min-w-8 items-center justify-center gap-1.5 px-2 font-medium text-[13px]',
                BTN_GHOST,
                isActive && BTN_ON,
              )}
              onClick={() => setViewMode(mode.id)}
              type="button"
            >
              {mode.icon}
              <span className={LABEL_MID}>{mode.label}</span>
            </button>
          </ToolbarTooltip>
        )
      })}
    </div>
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

/** impeccable D1: a menu (chồng / tách / một tầng) instead of a blind 3-way cycle; the button names the current state. */
function LevelModeToggle() {
  const levelMode = useViewer((state) => state.levelMode)
  const setLevelMode = useViewer((state) => state.setLevelMode)
  // AppFront edit (UX-R1 K19): one floor is the default now (page.tsx `applyStartParams`).
  const isDefault = levelMode === 'solo'
  const current = levelMode === 'manual' ? 'Tầng: tuỳ chỉnh' : (levelModeLabels[levelMode] ?? 'Tầng: chồng')
  const icon = levelMode === 'solo' || levelMode === 'exploded' ? LEVEL_MODE_ICONS[levelMode] : LEVEL_MODE_ICONS.stacked
  const label = `Cách xếp tầng, đang chọn: ${current.replace('Tầng: ', '')} (cần từ 2 tầng)`

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

function WallModeToggle() {
  const wallMode = useViewer((state) => state.wallMode)
  const setWallMode = useViewer((state) => state.setWallMode)
  const config = wallModeConfig[wallMode] ?? wallModeConfig.cutaway!

  const cycle = () => {
    const index = wallModeOrder.indexOf(wallMode as (typeof wallModeOrder)[number])
    const next = wallModeOrder[(index + 1) % wallModeOrder.length]
    if (next) setWallMode(next)
  }

  return (
    <ToolbarTooltip label={`${config.label} (bấm để đổi)`}>
      <button
        className={cn(
          TOOLBAR_BTN,
          'w-auto min-w-8 gap-1.5 px-2',
          wallMode !== 'cutaway' ? BTN_ON : 'opacity-70 hover:opacity-100',
        )}
        onClick={cycle}
        type="button"
      >
        <Image alt="" className="h-4 w-4 object-contain" height={16} src={config.icon} width={16} />
        <span className={`font-medium text-[13px] ${LABEL_WIDE}`}>{config.label}</span>
      </button>
    </ToolbarTooltip>
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

function DisplayMenu() {
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
      <ToolbarTooltip label="Cài đặt hiển thị">
        <DropdownMenuTrigger asChild>
          <button
            aria-label="Cài đặt hiển thị"
            className={cn(TOOLBAR_BTN, 'w-auto min-w-8 gap-1.5 px-2')}
            type="button"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
            <span className={`font-medium text-[13px] ${LABEL_WIDE}`}>Hiển thị</span>
          </button>
        </DropdownMenuTrigger>
      </ToolbarTooltip>
      <DropdownMenuContent
        align="end"
        className="w-60 rounded-xl border-[var(--pa-border)] bg-[var(--pa-surface)] shadow-[var(--pa-shadow-overlay)]"
        side="bottom"
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
          >
            <Ruler className="h-4 w-4" />
            <span>{viewMode === 'split' ? 'Số đo 3D' : 'Số đo'}</span>
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

/** Biên theo tường + vùng phòng (như khung mở đầu), đổi về dạng min/max của Pascal; không có thì biên của Pascal. */
function sceneBoundsOfPlan(nodes: ReturnType<typeof useScene.getState>['nodes']) {
  const plan = planBoundsXZ(nodes)
  if (plan === null) return computeSceneBoundsXZ(nodes)
  const [cx, cz] = plan.center
  const [w, d] = plan.size
  const bounds: SceneBoundsXZ = {
    min: [cx - w / 2, cz - d / 2],
    max: [cx + w / 2, cz + d / 2],
    center: [cx, cz],
    size: [w, d],
  }
  return bounds
}

/**
 * AppFront edit (P40, G5-06 / G5-07 / G5-48): frame the whole model, using the editor's own
 * `camera-controls:fit-scene` event (the one `useAutoFrame` emits after a load).
 */
export function fitWholeModel() {
  const bounds = sceneBoundsOfPlan(useScene.getState().nodes)
  emitter.emit('camera-controls:fit-scene', bounds ? { bounds } : {})
}

function FitViewButton() {
  return (
    <ToolbarTooltip label="Xem toàn bộ mô hình">
      <button aria-label="Xem toàn bộ mô hình" className={TOOLBAR_BTN} onClick={fitWholeModel} type="button">
        <Maximize className="h-4 w-4" />
      </button>
    </ToolbarTooltip>
  )
}

/**
 * AppFront edit (G5-12 / G5-48): Vietnamese-labelled replacements for the vendor `CameraActions`
 * group (hidden by scoped CSS in `canvas-help.tsx`). They emit the same public camera events;
 * "Nhìn từ trên" frames the whole model straight from above via `apply-pose`, and a second press
 * hands back to upstream `top-view`, which returns to 45° when already looking down.
 */
export function topViewToggle() {
  let pose = null as Parameters<typeof isTopDown>[0]
  subscribeCameraPose((current) => {
    pose = current
  })()
  if (isTopDown(pose)) {
    emitter.emit('camera-controls:top-view')
    return
  }
  const bounds = sceneBoundsOfPlan(useScene.getState().nodes)
  const aspect = window.innerWidth / Math.max(1, window.innerHeight)
  emitter.emit(
    'camera-controls:apply-pose',
    topViewPose(bounds, useViewer.getState().cameraMode, aspect),
  )
}

const CAMERA_BUTTONS = [
  { label: 'Xoay trái 90°', icon: RotateCcw, onClick: () => emitter.emit('camera-controls:orbit-ccw') },
  { label: 'Xoay phải 90°', icon: RotateCw, onClick: () => emitter.emit('camera-controls:orbit-cw') },
] as const

/**
 * AppFront edit (UX-R1 K38/K49): the rotate / top-view / walk buttons always live in this "Góc nhìn"
 * menu (before: only below 1200px), so the bar fits 1920px with the scene cards and step strip.
 */
function MoreCameraMenu() {
  const is2dOnly = useEditor((state) => state.viewMode === '2d')
  const walkthrough = () => {
    const { isFirstPersonMode, setFirstPersonMode } = useEditor.getState()
    if (isFirstPersonMode) {
      setFirstPersonMode(false)
      return
    }
    flushSync(() => setFirstPersonMode(true))
    requestWalkthroughPointerLock()
  }
  return (
    <div className="contents">
      <DropdownMenu>
        <ToolbarTooltip label="Góc nhìn: xoay, nhìn từ trên, đi bộ">
          <DropdownMenuTrigger asChild>
            <button aria-label="Góc nhìn" className={TOOLBAR_BTN} type="button">
              <Ellipsis className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
        </ToolbarTooltip>
        <DropdownMenuContent align="end" className={SUBMENU_CONTENT_CLASS} side="bottom" sideOffset={8}>
          {CAMERA_BUTTONS.map(({ label, icon: ItemIcon, onClick }) => (
            <DropdownMenuItem key={label} onSelect={onClick}>
              <ItemIcon className="h-4 w-4" />
              <span>{label}</span>
            </DropdownMenuItem>
          ))}
          {is2dOnly ? null : (
            <DropdownMenuItem onSelect={topViewToggle}>
              <ArrowDownToDot className="h-4 w-4" />
              <span>Nhìn từ trên</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={walkthrough}>
            <Footprints className="h-4 w-4" />
            <span>Đi bộ trong nhà</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
        <span aria-hidden="true" className="hidden @min-[1200px]/appbar:inline">Xem trước</span>
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

export function CommunityViewerToolbarLeft() {
  return (
    <>
      <CollapseSidebarButton />
      <ViewModeControl />
    </>
  )
}

export function CommunityViewerToolbarRight({
  onVRToggle,
  vrButton,
  vrActive = false,
  vrDisabled = false,
  vrLabel = vrActive ? 'Exit VR' : 'Enter VR',
}: {
  onVRToggle?: () => void
  vrButton?: ReactNode
  vrActive?: boolean
  vrDisabled?: boolean
  vrLabel?: string
}) {
  return (
    <div className={TOOLBAR_CONTAINER} data-appfront-bar="">
      <LevelModeToggle />
      <WallModeToggle />
      <div className="my-1.5 w-px bg-[var(--pa-border)]" />
      <DisplayMenu />
      <div className="my-1.5 w-px bg-[var(--pa-border)]" />
      <FitViewButton />
      <MoreCameraMenu />
      {onVRToggle || vrButton
        ? (vrButton ??
          (onVRToggle ? (
            <VRButton
              active={vrActive}
              disabled={vrDisabled}
              label={vrLabel}
              onToggle={onVRToggle}
            />
          ) : null))
        : null}
      <PreviewButton />
    </div>
  )
}
