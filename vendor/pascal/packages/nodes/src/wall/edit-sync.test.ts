import { afterEach, expect, mock, test } from 'bun:test'
import {
  type FloorplanGeometry,
  type GeometryContext,
  getEffectiveNode,
  useLiveNodeOverrides,
  useScene,
  type WallNode,
  WallNode as WallSchema,
} from '@pascal-app/core'

// The editor barrel pulls Next.js-only modules that bun cannot resolve; stub them (UI-only).
mock.module('next/image', () => ({ default: () => null }))
mock.module('next/link', () => ({ default: () => null }))
const { createFloorplanContextExtensions } = await import('@pascal-app/editor')
const { buildWallFloorplan } = await import('./floorplan')
const { createWallPropertyPreview } = await import('./property-preview')

globalThis.requestAnimationFrame ??= (callback) => {
  callback(0)
  return 0
}
globalThis.cancelAnimationFrame ??= () => {}

const initial = useScene.getState()
afterEach(() => {
  useLiveNodeOverrides.getState().clearAll()
  useScene.setState(initial)
  useScene.temporal.getState().clear()
})

const context = {
  resolve: () => undefined,
  children: [],
  siblings: [],
  parent: null,
  viewState: { selected: false, unit: 'metric', highlighted: false, hovered: false, moving: false },
  extensions: createFloorplanContextExtensions({
    automaticDimensions: false,
    metricNotation: 'meters',
    purpose: 'document',
    wallDimensionReference: 'finished-faces',
  }),
} as unknown as GeometryContext

function drawnThickness(node: WallNode): number {
  const flat = (g: FloorplanGeometry): FloorplanGeometry[] =>
    g.kind === 'group' ? [g, ...g.children.flatMap(flat)] : [g]
  const polygon = flat(buildWallFloorplan(node, context)!).find((g) => g.kind === 'polygon')
  if (polygon?.kind !== 'polygon') throw new Error('no wall polygon')
  const ys = polygon.points.map((p) => p[1])
  return Math.max(...ys) - Math.min(...ys)
}

function setup() {
  const wall = WallSchema.parse({ start: [0, 0], end: [4, 0], thickness: 0.1 })
  useScene.setState({ nodes: { [wall.id]: wall }, dirtyNodes: new Set() })
  useScene.temporal.getState().resume()
  useScene.temporal.getState().clear()
  return { wall, edit: createWallPropertyPreview(wall.id) }
}

test('#8 — the 2D plan is built from the same WallNode the 3D edit writes to', () => {
  const { wall, edit } = setup()
  expect(drawnThickness(wall)).toBeCloseTo(0.1)
  edit.commit({ thickness: 0.3 })
  const stored = useScene.getState().nodes[wall.id] as WallNode
  expect(stored.thickness).toBe(0.3)
  expect(drawnThickness(stored)).toBeCloseTo(0.3)
})

test('#17 — dragging thickness previews live in 2D/3D before any commit', () => {
  const { wall, edit } = setup()
  for (const t of [0.15, 0.2, 0.25]) edit.preview({ thickness: t })
  expect((useScene.getState().nodes[wall.id] as WallNode).thickness).toBe(0.1)
  expect(useScene.temporal.getState().pastStates).toHaveLength(0)
  expect(useScene.getState().dirtyNodes.has(wall.id)).toBe(true)
  const live = getEffectiveNode(wall)
  expect(live.thickness).toBe(0.25)
  expect(drawnThickness(live)).toBeCloseTo(0.25)
  edit.commit()
  expect((useScene.getState().nodes[wall.id] as WallNode).thickness).toBe(0.25)
  expect(useScene.temporal.getState().pastStates).toHaveLength(1)
})
