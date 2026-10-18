/**
 * VERBATIM copy of upstream Pascal apps/editor/lib/build-tab-state.ts (F:\pascal-editor, commit cd14090, MIT).
 * Edits: none.
 */
import type { RoofType } from '@pascal-app/core'

export type RoofFeatureIdentity = {
  id: string
  kind?: string
}

const ROOF_FOOTPRINT_SOURCES = [
  { label: 'Phòng', value: 'room' },
  { label: 'Tường', value: 'walls' },
  { label: 'Vẽ', value: 'draw' },
] as const

export type RoofFootprintSource = (typeof ROOF_FOOTPRINT_SOURCES)[number]['value']

const CONICAL_ROOF_FOOTPRINT_SOURCES = [ROOF_FOOTPRINT_SOURCES[1]] as const
const STANDARD_ROOF_FOOTPRINT_SOURCES = [
  ROOF_FOOTPRINT_SOURCES[2],
  ROOF_FOOTPRINT_SOURCES[0],
] as const

export function getRoofFootprintSources(roofType: RoofType) {
  return roofType === 'conical' ? CONICAL_ROOF_FOOTPRINT_SOURCES : STANDARD_ROOF_FOOTPRINT_SOURCES
}

export function getRoofFootprintSource(roofType: RoofType, value: unknown): RoofFootprintSource {
  const sources = getRoofFootprintSources(roofType)
  return sources.some((source) => source.value === value)
    ? (value as RoofFootprintSource)
    : sources[0].value
}

export const ROOF_TYPE_OPTIONS: ReadonlyArray<{ label: string; value: RoofType }> = [
  { label: 'Bốn mái', value: 'hip' },
  { label: 'Hai mái', value: 'gable' },
  { label: 'Một mái', value: 'shed' },
  { label: 'Mái bằng', value: 'flat' },
  { label: 'Mái gãy', value: 'gambrel' },
  { label: 'Kiểu Hà Lan', value: 'dutch' },
  { label: 'Mansard', value: 'mansard' },
  { label: 'Nón', value: 'conical' },
]

export function getActiveRoofFeatureId(
  features: readonly RoofFeatureIdentity[],
  activeTool: string | null | undefined,
): string | null {
  if (!activeTool) return null
  return features.find((feature) => feature.kind === activeTool)?.id ?? null
}
