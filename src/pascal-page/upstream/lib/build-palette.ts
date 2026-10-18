/**
 * VERBATIM copy of upstream Pascal apps/editor/lib/build-palette.ts (F:\pascal-editor, commit cd14090, MIT).
 * Edits: import paths only (`@/components/*`, `@/lib/*` -> relative).
 */
import { emitter, nodeRegistry, type RoofType } from '@pascal-app/core'
import {
  CATALOG_ITEMS,
  type FloorplanMode,
  getFloorplanNodeExtension,
  isFloorplanToolAvailableInMode,
  useEditor,
  useFloorplanMode,
} from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { getRoofFootprintSource, type RoofFootprintSource } from './build-tab-state'

export type BuildType = {
  id: string
  label: string
  iconSrc: string
  kind?: string
  paletteOrder?: number
  mode?: 'material-paint' | 'terrain-sculpt'
}

export type MepItem = {
  id: string
  label: string
  iconSrc: string
  kind: string
}

export type RoofFeature = {
  id: string
  label: string
  iconSrc: string
  kind?: string
}

export const BASE_BUILD_TYPES: BuildType[] = [
  { id: 'wall', label: 'Tường', iconSrc: '/icons/wall.webp', kind: 'wall' },
  { id: 'fence', label: 'Hàng rào', iconSrc: '/icons/fence.webp', kind: 'fence' },
  { id: 'slab', label: 'Sàn', iconSrc: '/icons/floor.webp', kind: 'slab' },
  { id: 'ceiling', label: 'Trần', iconSrc: '/icons/ceiling.webp', kind: 'ceiling' },
  { id: 'roof', label: 'Mái', iconSrc: '/icons/roof.webp', kind: 'roof' },
  { id: 'stair', label: 'Cầu thang', iconSrc: '/icons/stairs.webp', kind: 'stair' },
  { id: 'elevator', label: 'Thang máy', iconSrc: '/icons/elevator.webp', kind: 'elevator' },
  { id: 'door', label: 'Cửa đi', iconSrc: '/icons/door.webp', kind: 'door' },
  { id: 'window', label: 'Cửa sổ', iconSrc: '/icons/window.webp', kind: 'window' },
  { id: 'column', label: 'Cột', iconSrc: '/icons/column.webp', kind: 'column' },
  { id: 'shelf', label: 'Kệ', iconSrc: '/icons/shelf.webp', kind: 'shelf' },
  { id: 'spawn', label: 'Điểm xuất phát', iconSrc: '/icons/spawn-point.webp', kind: 'spawn' },
  { id: 'kitchen', label: 'Bếp', iconSrc: '/icons/kitchen.webp' },
  { id: 'mep', label: 'Cơ điện', iconSrc: '/icons/HVAC.webp' },
  { id: 'painting', label: 'Sơn', iconSrc: '/icons/paint.webp', mode: 'material-paint' },
  { id: 'terrain', label: 'Địa hình', iconSrc: '/icons/mesh.webp', mode: 'terrain-sculpt' },
]

export const MEP_ITEMS: MepItem[] = [
  { id: 'duct-segment', label: 'Ống gió', iconSrc: '/icons/duct.webp', kind: 'duct-segment' },
  {
    id: 'duct-terminal',
    label: 'Miệng gió',
    iconSrc: '/icons/registers.webp',
    kind: 'duct-terminal',
  },
  { id: 'hvac-equipment', label: 'Máy điều hoà', iconSrc: '/icons/HVAC.webp', kind: 'hvac-equipment' },
  { id: 'lineset', label: 'Ống đồng', iconSrc: '/icons/lineset.webp', kind: 'lineset' },
  { id: 'liquid-line', label: 'Ống lỏng', iconSrc: '/icons/lineset.webp', kind: 'liquid-line' },
  { id: 'pipe-segment', label: 'Ống thoát', iconSrc: '/icons/dwv-pipes.webp', kind: 'pipe-segment' },
]

export const MEP_TOOL_KINDS = new Set<string>([
  ...MEP_ITEMS.map((item) => item.kind),
  'duct-fitting',
  'pipe-fitting',
  'pipe-trap',
])

const MODULAR_CABINET_CATALOG_ITEM = CATALOG_ITEMS.find((item) => item.id === 'cabinet')
export const MODULAR_CABINET_ICON = MODULAR_CABINET_CATALOG_ITEM?.thumbnail ?? '/icons/item.webp'

export function collectBuildTypes(floorplanMode: FloorplanMode): BuildType[] {
  const baseKinds = new Set(BASE_BUILD_TYPES.flatMap((type) => (type.kind ? [type.kind] : [])))
  const tools = BASE_BUILD_TYPES.filter((type) => type.kind).map((type, index) => ({
    ...type,
    paletteOrder:
      nodeRegistry.get(type.kind!)?.presentation?.paletteOrder ?? type.paletteOrder ?? index * 10,
  }))
  for (const [kind, definition] of nodeRegistry.entries()) {
    const presentation = definition.presentation
    const extension = getFloorplanNodeExtension(definition)
    if (
      baseKinds.has(kind) ||
      presentation?.paletteGroup === 'roof-features' ||
      !extension?.tool ||
      !isFloorplanToolAvailableInMode(extension.availableModes, floorplanMode) ||
      !presentation ||
      presentation.hidden ||
      presentation.paletteSection !== 'structure'
    )
      continue
    tools.push({
      id: kind,
      kind,
      label: presentation.label,
      iconSrc: presentation.icon.kind === 'url' ? presentation.icon.src : '/icons/spawn-point.webp',
      paletteOrder: presentation.paletteOrder ?? Number.MAX_SAFE_INTEGER,
    })
  }
  tools.sort((left, right) => (left.paletteOrder ?? 0) - (right.paletteOrder ?? 0))
  return [...tools, ...BASE_BUILD_TYPES.filter((type) => !type.kind)]
}

export function activateBuildTool(kind: string): void {
  const editor = useEditor.getState()
  const definition = nodeRegistry.get(kind)
  const extension = getFloorplanNodeExtension(definition)
  if (
    !isFloorplanToolAvailableInMode(extension?.availableModes, useFloorplanMode.getState().mode)
  ) {
    useFloorplanMode.getState().showExpertModeNotice(definition?.presentation?.label ?? kind)
    return
  }
  if (extension?.preferredView) editor.setViewMode(extension.preferredView)
  useViewer.getState().setSelection({ selectedIds: [], zoneId: null })
  editor.setPhase('structure')
  editor.setStructureLayer('elements')
  editor.setCatalogCategory(null)
  editor.setToolDefaults(kind, null)
  editor.setMode('build')
  editor.setTool(kind)
}

export function activateSelectMode(): void {
  emitter.emit('tool:cancel')
  useEditor.getState().setMode('select')
}

export function activateModularCabinetTool(): void {
  const editor = useEditor.getState()
  useViewer.getState().setSelection({ selectedIds: [], zoneId: null })
  if (MODULAR_CABINET_CATALOG_ITEM) editor.setSelectedItem(MODULAR_CABINET_CATALOG_ITEM)
  editor.setPhase('structure')
  editor.setStructureLayer('elements')
  editor.setCatalogCategory(null)
  editor.setMode('build')
  editor.setTool('cabinet')
}

export function activatePaintMode(): void {
  const editor = useEditor.getState()
  editor.setPhase('structure')
  editor.setStructureLayer('elements')
  editor.setMode('material-paint')
}

export function activateTerrainSculptMode(): void {
  useEditor.getState().setMode('terrain-sculpt')
}

export function collectRoofFeatures(): RoofFeature[] {
  const features: RoofFeature[] = []
  for (const [kind, definition] of nodeRegistry.entries()) {
    if (
      definition.capabilities.roofAccessory === undefined &&
      definition.presentation?.paletteGroup !== 'roof-features'
    )
      continue
    if (definition.capabilities.wallOpeningPlacement) continue
    const icon = definition.presentation?.icon
    features.push({
      id: kind,
      kind,
      label: definition.presentation?.label ?? kind,
      iconSrc: icon?.kind === 'url' ? icon.src : '/icons/roof.webp',
    })
  }
  return features
}

export function activateRoofFeatureTool(feature: RoofFeature): void {
  const editor = useEditor.getState()
  useViewer.getState().setSelection({ selectedIds: [], zoneId: null })
  editor.setPhase('structure')
  editor.setStructureLayer('elements')
  editor.setCatalogCategory(null)
  editor.setMode('build')
  if (feature.kind) editor.setTool(feature.kind)
}

export function activateRoofType(roofType: RoofType): void {
  const editor = useEditor.getState()
  if (!(editor.mode === 'build' && editor.tool === 'roof')) activateBuildTool('roof')
  const footprintSource = getRoofFootprintSource(
    roofType,
    editor.toolDefaults.roof?.footprintSource,
  )
  editor.setToolDefaults('roof', { ...editor.toolDefaults.roof, roofType, footprintSource })
}

export function activateRoofFootprintSource(footprintSource: RoofFootprintSource): void {
  const editor = useEditor.getState()
  if (!(editor.mode === 'build' && editor.tool === 'roof')) activateBuildTool('roof')
  editor.setToolDefaults('roof', { ...editor.toolDefaults.roof, footprintSource })
}
