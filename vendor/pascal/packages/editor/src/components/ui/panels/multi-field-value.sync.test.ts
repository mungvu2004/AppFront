import { afterEach, beforeEach, expect, test } from 'bun:test'
import {
  type AnyNodeId,
  clearSceneHistory,
  getEffectiveNode,
  useLiveNodeOverrides,
  useScene,
  WallNode,
} from '@pascal-app/core'
import {
  commitMultiNodeFields,
  previewMultiNodeFields,
  reduceFieldValue,
} from './multi-field-value'

globalThis.requestAnimationFrame ??= (cb) => {
  cb(0)
  return 0
}
globalThis.cancelAnimationFrame ??= () => {}

const A = WallNode.parse({ start: [0, 0], end: [4, 0], thickness: 0.1 })
const B = WallNode.parse({ start: [4, 0], end: [4, 3], thickness: 0.2 })
const ids = [A.id, B.id] as AnyNodeId[]
const read = (id: AnyNodeId) => useScene.getState().nodes[id] as WallNode

beforeEach(() => {
  useScene.setState({
    nodes: { [A.id]: A, [B.id]: B },
    dirtyNodes: new Set<AnyNodeId>(),
    readOnly: false,
  } as never)
  clearSceneHistory()
  useLiveNodeOverrides.getState().clearAll()
})
afterEach(() => useLiveNodeOverrides.getState().clearAll())

test('#16 — two real walls with different thickness reduce to mixed, same height to a value', () => {
  const nodes = useScene.getState().nodes
  expect(reduceFieldValue(ids, 'thickness', nodes)).toEqual({ kind: 'mixed' })
  expect(reduceFieldValue(ids, 'height', nodes).kind).toBe('same')
})

test('#17 — multi-select thickness drag previews live without touching the document', () => {
  previewMultiNodeFields(ids.map((id) => [id, { thickness: 0.3 }] as const))
  expect(getEffectiveNode(read(A.id)).thickness).toBe(0.3)
  expect(getEffectiveNode(read(B.id)).thickness).toBe(0.3)
  expect(read(A.id).thickness).toBe(0.1)
  expect(read(B.id).thickness).toBe(0.2)
  expect(useScene.temporal.getState().pastStates).toHaveLength(0)
})

test('#18 — commit writes the model and the panel reads the same value back (no more mixed)', () => {
  previewMultiNodeFields(ids.map((id) => [id, { thickness: 0.3 }] as const))
  commitMultiNodeFields(ids, () => ({ thickness: 0.3 }))
  expect(reduceFieldValue(ids, 'thickness', useScene.getState().nodes)).toEqual({
    kind: 'same',
    value: 0.3,
  })
  expect(useLiveNodeOverrides.getState().get(A.id)?.thickness).toBeUndefined()
  expect(useScene.temporal.getState().pastStates).toHaveLength(1)
})
