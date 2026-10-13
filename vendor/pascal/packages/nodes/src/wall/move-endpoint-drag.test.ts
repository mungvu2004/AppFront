import { afterEach, beforeEach, expect, test } from 'bun:test'
import {
  clearSceneHistory,
  LevelNode,
  pauseSceneHistory,
  resumeSceneHistory,
  runAsSingleSceneHistoryStep,
  useLiveNodeOverrides,
  useScene,
  WallNode,
} from '@pascal-app/core'

// Reproduces the store protocol of `move-endpoint-tool.tsx` (pause history →
// live overrides per tick → on release: clear overrides, resume, one
// `runAsSingleSceneHistoryStep` write; on Esc: clear overrides, resume, no
// write). The React tool itself needs a WebGL canvas, so the protocol is
// exercised against the real scene store instead.

const raf = globalThis as unknown as { requestAnimationFrame?: (cb: () => void) => number }
raf.requestAnimationFrame ??= (cb) => {
  cb()
  return 0
}
;(globalThis as unknown as { cancelAnimationFrame?: () => void }).cancelAnimationFrame ??= () => {}

const initial = useScene.getState()
const level = LevelNode.parse({ height: 3 })
// Corner A→B and B→C share B=[4,0]; dragging B must carry both walls.
const wallAB = WallNode.parse({ parentId: level.id, start: [0, 0], end: [4, 0] })
const wallBC = WallNode.parse({ parentId: level.id, start: [4, 0], end: [4, 3] })
const moved: [number, number] = [5, 1]

beforeEach(() => {
  level.children = [wallAB.id, wallBC.id]
  useScene.setState({
    nodes: { [level.id]: level, [wallAB.id]: wallAB, [wallBC.id]: wallBC },
    rootNodeIds: [level.id],
  })
  clearSceneHistory()
})
afterEach(() => {
  useLiveNodeOverrides.getState().clearAll()
  resumeSceneHistory(useScene)
  useScene.setState(initial)
})

const wall = (id: string) => useScene.getState().nodes[id as never] as WallNode
const pastCount = () => useScene.temporal.getState().pastStates.length

function dragTicks() {
  const overrides = useLiveNodeOverrides.getState()
  for (const [x, z] of [[4.2, 0.1], [4.7, 0.6], moved]) {
    overrides.setMany([
      [wallAB.id, { start: [0, 0], end: [x, z] }],
      [wallBC.id, { start: [x, z], end: [4, 3] }],
    ])
  }
}

function release() {
  const overrides = useLiveNodeOverrides.getState()
  overrides.clear(wallAB.id)
  overrides.clear(wallBC.id)
  resumeSceneHistory(useScene)
  runAsSingleSceneHistoryStep(useScene, () => {
    useScene.getState().updateNodes([
      { id: wallAB.id, data: { end: moved } },
      { id: wallBC.id, data: { start: moved } },
    ])
  })
}

test('#2 #4 dragging a corner writes once and carries the connected wall', () => {
  pauseSceneHistory(useScene)
  dragTicks()
  // Mid-drag the store is untouched: only overrides moved.
  expect(wall(wallAB.id).end).toEqual([4, 0])
  expect(pastCount()).toBe(0)

  release()
  expect(wall(wallAB.id).end).toEqual(moved)
  expect(wall(wallBC.id).start).toEqual(moved)
  expect(pastCount()).toBe(1)
})

test('#3 Esc mid-drag restores the original and records nothing', () => {
  pauseSceneHistory(useScene)
  dragTicks()
  const overrides = useLiveNodeOverrides.getState()
  overrides.clear(wallAB.id)
  overrides.clear(wallBC.id)
  resumeSceneHistory(useScene)

  expect(wall(wallAB.id).end).toEqual([4, 0])
  expect(wall(wallBC.id).start).toEqual([4, 0])
  expect(useLiveNodeOverrides.getState().overrides.size).toBe(0)
  expect(pastCount()).toBe(0)
})

test('#19 one Ctrl+Z reverts the whole drag session, both walls', () => {
  pauseSceneHistory(useScene)
  dragTicks()
  release()
  expect(pastCount()).toBe(1)

  useScene.temporal.getState().undo()
  expect(wall(wallAB.id).end).toEqual([4, 0])
  expect(wall(wallBC.id).start).toEqual([4, 0])
  expect(pastCount()).toBe(0)

  useScene.temporal.getState().redo()
  expect(wall(wallAB.id).end).toEqual(moved)
  expect(wall(wallBC.id).start).toEqual(moved)
})
