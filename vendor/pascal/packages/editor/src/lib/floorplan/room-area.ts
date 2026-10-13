import type { AnyNode, AnyNodeId, DoorNode, WindowNode, ZoneNode } from '@pascal-app/core'
import { deriveZoneQuantityReport, resolveAutoZonePolygon } from '@pascal-app/core'
import { formatNumberVi } from '../../i18n/format'
import { roomArea as vi } from '../../i18n/regions/roomArea'

/**
 * Room-area table DATA — AppFront F-15 W2-D (#71–86).
 *
 * `schedules.ts` already answers "one flat room schedule per level, sorted by
 * room number", which is what a construction document prints. The area panel
 * asks a different question: which rooms are big, grouped the way the reviewer
 * is thinking right now (by level, or by occupancy), with the subtotal that
 * makes the grand total checkable by eye. So the grouping, the subtotals, the
 * band split and the per-row opening counts live here, as a renderer-agnostic
 * model the panel only lays out.
 *
 * Areas are square metres throughout and only ever formatted with a comma
 * decimal separator (AppFront A15) — the imperial branch of `schedules.ts` has
 * no caller in this flow.
 */

/** Trust dot on a row (AppFront A4: exactly three states; A5: green is human-only). */
export type RoomAreaStatus = 'trusted' | 'suspect' | 'reviewed'

export type RoomAreaRow = {
  id: string
  /** The level this room hangs off (`parentId` of the zone node). */
  levelId: string
  name: string
  number: string
  /** Occupancy / công năng. An empty occupancy collapses into one shared bucket. */
  occupancy: string
  /** Square metres. */
  area: number
  areaText: string
  /** Metres. */
  perimeter: number
  perimeterText: string
  /** Metres. */
  ceilingHeight: number
  ceilingHeightText: string
  doorCount: number
  windowCount: number
  status: RoomAreaStatus
}

export type RoomAreaGroup = {
  key: string
  label: string
  rows: RoomAreaRow[]
  /** Square metres. */
  subtotal: number
  subtotalText: string
}

/** One band of the stacked bar. At most three exist — see `MAX_BANDS`. */
export type RoomAreaBand = {
  key: string
  label: string
  area: number
  /** 0–100, rounded to one decimal. */
  percent: number
}

export type RoomAreaTable = {
  groups: RoomAreaGroup[]
  bands: RoomAreaBand[]
  /** Square metres over every visible row. */
  total: number
  totalText: string
  /** Rooms the model could not measure, phrased for the panel's empty state. */
  issues: string[]
}

export type RoomAreaGrouping = 'level' | 'occupancy'
export type RoomAreaSort = 'area-desc' | 'area-asc' | 'name'

export type RoomAreaOptions = {
  grouping?: RoomAreaGrouping
  sort?: RoomAreaSort
  /** Keep only these levels. Empty or omitted means every level. */
  levelIds?: readonly string[]
  /** Collapsed panel mode: keep the N largest rooms overall (#84). */
  limit?: number
}

export type RoomAreaSceneInput =
  | { nodes: Readonly<Record<string, AnyNode>> }
  | Readonly<Record<string, AnyNode>>

/** A4: a fourth band is the thing this cap exists to prevent. */
const MAX_BANDS = 3
const SUSPECT_CONFIDENCE = 0.6

function formatArea(squareMetres: number): string {
  return `${formatNumberVi(squareMetres)} m²`
}

function formatMetres(metres: number): string {
  return `${formatNumberVi(metres)} m`
}

/**
 * A5: the green "reviewed" dot marks a person's verdict and nothing else, so it
 * is read from `reviewed` only. A model-produced row is `suspect` when it says
 * it is unsure and `trusted` otherwise — AI output can never reach `reviewed`.
 */
function readStatus(zone: ZoneNode): RoomAreaStatus {
  const metadata = (zone.metadata ?? {}) as Record<string, unknown>
  if (metadata.reviewed === true) return 'reviewed'
  const confidence = metadata.confidence
  if (typeof confidence === 'number' && confidence < SUSPECT_CONFIDENCE) return 'suspect'
  return 'trusted'
}

function normalizeNodes(scene: RoomAreaSceneInput): Readonly<Record<string, AnyNode>> {
  const candidate = scene as { nodes?: Readonly<Record<string, AnyNode>> }
  return candidate.nodes ?? (scene as Readonly<Record<string, AnyNode>>)
}

/** How many doors and windows sit in the walls that bound this room (#86). */
function countOpenings(
  nodes: Readonly<Record<string, AnyNode>>,
  boundaryWallIds: readonly string[],
): { doorCount: number; windowCount: number } {
  if (boundaryWallIds.length === 0) return { doorCount: 0, windowCount: 0 }
  const walls = new Set(boundaryWallIds)
  let doorCount = 0
  let windowCount = 0
  for (const node of Object.values(nodes)) {
    if (node.type !== 'door' && node.type !== 'window') continue
    const wallId = (node as DoorNode | WindowNode).wallId
    if (!wallId || !walls.has(wallId)) continue
    if (node.type === 'door') doorCount += 1
    else windowCount += 1
  }
  return { doorCount, windowCount }
}

/** Every room row in the scene, unsorted and ungrouped. */
export function roomAreaRows(scene: RoomAreaSceneInput): {
  rows: RoomAreaRow[]
  issues: string[]
} {
  const nodes = normalizeNodes(scene)
  const rows: RoomAreaRow[] = []
  const issues: string[] = []

  for (const node of Object.values(nodes)) {
    if (node.type !== 'zone') continue
    const zone = node as ZoneNode
    if (zone.spaceRole !== 'room') continue

    const polygon = resolveAutoZonePolygon(zone, (nodeId: AnyNodeId) => nodes[nodeId])
    const resolved = polygon === zone.polygon ? zone : { ...zone, polygon }
    const report = deriveZoneQuantityReport(resolved, nodes as Record<string, AnyNode>)
    const name = zone.name.trim()

    if (report.footprintArea <= 0) {
      issues.push(vi.unmeasurable(name || zone.id))
      continue
    }

    // The report only reports walls it proved geometrically. A zone that names
    // its own boundary walls is still entitled to have their openings counted,
    // so the declared list is the fallback.
    const boundaryWallIds =
      report.boundaryWallIds.length > 0 ? report.boundaryWallIds : (zone.boundaryWallIds ?? [])
    const { doorCount, windowCount } = countOpenings(nodes, boundaryWallIds)
    rows.push({
      id: zone.id,
      // A zone hangs off its level through `parentId`; there is no `levelId`
      // field on the node schema.
      levelId: zone.parentId ?? '',
      name: name || vi.unnamedRoom,
      number: zone.roomNumber.trim(),
      occupancy: zone.occupancy.trim(),
      area: report.footprintArea,
      areaText: formatArea(report.footprintArea),
      perimeter: report.perimeter,
      perimeterText: formatMetres(report.perimeter),
      ceilingHeight: zone.ceilingHeight,
      ceilingHeightText: formatMetres(zone.ceilingHeight),
      doorCount,
      windowCount,
      status: readStatus(zone),
    })
  }

  return { rows, issues }
}

function sortRows(rows: readonly RoomAreaRow[], sort: RoomAreaSort): RoomAreaRow[] {
  const sorted = [...rows]
  if (sort === 'name') {
    sorted.sort((left, right) => left.name.localeCompare(right.name, 'vi'))
    return sorted
  }
  const direction = sort === 'area-asc' ? 1 : -1
  sorted.sort((left, right) => direction * (left.area - right.area))
  return sorted
}

function groupKeyOf(row: RoomAreaRow, grouping: RoomAreaGrouping): string {
  return grouping === 'occupancy' ? row.occupancy : row.levelId
}

function groupLabelOf(
  key: string,
  grouping: RoomAreaGrouping,
  levelNames: ReadonlyMap<string, string>,
): string {
  if (grouping === 'occupancy') return key || vi.noOccupancy
  return levelNames.get(key) ?? vi.unknownLevel
}

/**
 * The two largest buckets plus everything else, so the bar never grows a fourth
 * band (A4). Percentages are of the table total, not of the bands, so a reader
 * can check them against the grand total.
 */
function buildBands(rows: readonly RoomAreaRow[], total: number): RoomAreaBand[] {
  if (total <= 0) return []
  const byOccupancy = new Map<string, number>()
  for (const row of rows) {
    byOccupancy.set(row.occupancy, (byOccupancy.get(row.occupancy) ?? 0) + row.area)
  }
  const ranked = [...byOccupancy.entries()].sort(([, left], [, right]) => right - left)
  const head = ranked.slice(0, MAX_BANDS - 1)
  const tail = ranked.slice(MAX_BANDS - 1)
  const bands: RoomAreaBand[] = head.map(([key, area]) => ({
    key: key || 'none',
    label: key || vi.noOccupancy,
    area,
    percent: Math.round((area / total) * 1000) / 10,
  }))
  if (tail.length > 0) {
    const area = tail.reduce((sum, [, value]) => sum + value, 0)
    bands.push({
      key: 'other',
      label: vi.otherBand,
      area,
      percent: Math.round((area / total) * 1000) / 10,
    })
  }
  return bands
}

/** Level display names, so a group header reads "Tầng 1" and not a node id. */
export function levelNamesOf(scene: RoomAreaSceneInput): Map<string, string> {
  const nodes = normalizeNodes(scene)
  const names = new Map<string, string>()
  for (const node of Object.values(nodes)) {
    if (node.type !== 'level') continue
    const name = (node as { name?: string }).name?.trim()
    names.set(node.id, name || vi.unknownLevel)
  }
  return names
}

/** The whole panel model: grouped rows, subtotals, bands and the grand total. */
export function roomAreaTable(
  scene: RoomAreaSceneInput,
  options: RoomAreaOptions = {},
): RoomAreaTable {
  const grouping = options.grouping ?? 'level'
  const sort = options.sort ?? 'area-desc'
  const levelNames = levelNamesOf(scene)
  const { rows: allRows, issues } = roomAreaRows(scene)

  const levelFilter = options.levelIds
  const filtered =
    levelFilter && levelFilter.length > 0
      ? allRows.filter((row) => levelFilter.includes(row.levelId))
      : allRows

  // The limit means "the N largest rooms in the table", so it is applied to the
  // flat list before grouping — a per-group slice would hide a big room just
  // because its group is crowded.
  const ranked = sortRows(filtered, sort)
  const visible =
    options.limit === undefined
      ? ranked
      : (() => {
          const keptIds = new Set(
            sortRows(filtered, 'area-desc')
              .slice(0, Math.max(0, options.limit))
              .map((row) => row.id),
          )
          return ranked.filter((row) => keptIds.has(row.id))
        })()

  const buckets = new Map<string, RoomAreaRow[]>()
  for (const row of visible) {
    const key = groupKeyOf(row, grouping)
    const bucket = buckets.get(key)
    if (bucket) bucket.push(row)
    else buckets.set(key, [row])
  }

  const groups: RoomAreaGroup[] = [...buckets.entries()].map(([key, groupRows]) => {
    const subtotal = groupRows.reduce((sum, row) => sum + row.area, 0)
    return {
      key,
      label: groupLabelOf(key, grouping, levelNames),
      rows: groupRows,
      subtotal,
      subtotalText: formatArea(subtotal),
    }
  })
  groups.sort((left, right) => left.label.localeCompare(right.label, 'vi'))

  const total = visible.reduce((sum, row) => sum + row.area, 0)
  return {
    groups,
    bands: buildBands(visible, total),
    total,
    totalText: formatArea(total),
    issues,
  }
}

/** The table as tab-separated text, for the panel's copy button (#85). */
export function roomAreaTableToText(table: RoomAreaTable): string {
  const lines: string[] = [
    [vi.column.number, vi.column.name, vi.column.occupancy, vi.column.area].join('\t'),
  ]
  for (const group of table.groups) {
    lines.push(group.label)
    for (const row of group.rows) {
      lines.push([row.number || '—', row.name, row.occupancy || '—', row.areaText].join('\t'))
    }
    lines.push([vi.subtotal, '', '', group.subtotalText].join('\t'))
  }
  lines.push([vi.total, '', '', table.totalText].join('\t'))
  return lines.join('\n')
}
