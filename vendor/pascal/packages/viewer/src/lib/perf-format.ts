import { vi } from '../i18n/vi'

/** Triangle count for the perf chip: Vietnamese decimal comma ("12,3 nghìn"). */
export function formatTriangles(triangles: number): string {
  return `${(triangles / 1000).toFixed(1).replace('.', ',')} ${vi.perfPanel.thousand}`
}
