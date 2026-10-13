import {
  type AnyNode,
  type AnyNodeId,
  emitter,
  getHistoryDirtyNodeIds,
  useLiveNodeOverrides,
  useLiveTransforms,
  useScene,
} from '@pascal-app/core'
import { markPerfAction } from '@pascal-app/viewer'
import useInteractionScope from '../store/use-interaction-scope'
import { registeredDraftingConfig } from './interaction/registered-drafting'

export type HistoryCommandState = {
  canRedo: boolean
  canUndo: boolean
  mode: 'collaborative' | 'standalone'
  status: 'offline' | 'ready' | 'syncing' | 'unavailable'
}

export type HistoryCommandResult =
  | { kind: 'applied'; persistence: 'local' | 'queued' }
  | { kind: 'empty' }
  | { kind: 'unavailable' }

export type HistoryCommandDelegate = {
  getState: () => HistoryCommandState
  redo: () => HistoryCommandResult
  subscribe: (listener: () => void) => () => void
  undo: () => HistoryCommandResult
}

/**
 * A history jump the user actually made, as opposed to the internal rollbacks
 * `use-auto-save` and the selection affordance manager perform: those call
 * `useScene.temporal` straight and never reach `runUndo`/`runRedo`.
 *
 * AppFront needs this for invariant A8 — every change is undoable and says so
 * with a toast. The host cannot derive it from `subscribeHistoryCommandState`,
 * which fires on every scene commit and cannot tell a jump from an edit.
 */
export type HistoryJumpKind = 'undo' | 'redo'

export type HistoryJumpListener = (kind: HistoryJumpKind) => void

const historyJumpListeners = new Set<HistoryJumpListener>()

export function subscribeHistoryJumps(listener: HistoryJumpListener): () => void {
  historyJumpListeners.add(listener)
  return () => {
    historyJumpListeners.delete(listener)
  }
}

function emitHistoryJump(kind: HistoryJumpKind): void {
  for (const listener of [...historyJumpListeners]) {
    try {
      listener(kind)
    } catch (error) {
      console.error('[History] History jump listener failed', error)
    }
  }
}

let historyCommandDelegate: HistoryCommandDelegate | null = null
let historyCommandDelegateSubscription: (() => void) | null = null
const historyCommandListeners = new Set<() => void>()

export function installHistoryCommandDelegate(delegate: HistoryCommandDelegate): () => void {
  historyCommandDelegateSubscription?.()
  historyCommandDelegate = delegate
  historyCommandDelegateSubscription = delegate.subscribe(notifyHistoryCommandListeners)
  notifyHistoryCommandListeners()
  return () => {
    if (historyCommandDelegate !== delegate) return
    historyCommandDelegateSubscription?.()
    historyCommandDelegateSubscription = null
    historyCommandDelegate = null
    notifyHistoryCommandListeners()
  }
}

export function getHistoryCommandState(): HistoryCommandState {
  if (historyCommandDelegate) return historyCommandDelegate.getState()
  const temporal = useScene.temporal.getState()
  return {
    canRedo: temporal.futureStates.length > 0,
    canUndo: temporal.pastStates.length > 0,
    mode: 'standalone',
    status: 'ready',
  }
}

export function subscribeHistoryCommandState(listener: () => void): () => void {
  historyCommandListeners.add(listener)
  const unsubscribeTemporal = useScene.temporal.subscribe(listener)
  return () => {
    historyCommandListeners.delete(listener)
    unsubscribeTemporal()
  }
}

function notifyHistoryCommandListeners() {
  for (const listener of [...historyCommandListeners]) listener()
}

function capturePreviewLayout() {
  const overrides = useLiveNodeOverrides.getState().overrides
  if (overrides.size === 0) return null
  const nodes = { ...useScene.getState().nodes }
  for (const [id, values] of overrides) {
    const node = nodes[id as AnyNodeId]
    if (node) nodes[node.id] = { ...node, ...values } as AnyNode
  }
  return nodes
}

function refreshSceneAfterHistoryJump(previewLayout: Record<string, AnyNode> | null) {
  const target = useScene.getState().nodes
  const previewDirty = previewLayout
    ? getHistoryDirtyNodeIds(previewLayout, target)
    : new Set<AnyNodeId>()
  const previewIds = new Set([
    ...useLiveTransforms.getState().transforms.keys(),
    ...useLiveNodeOverrides.getState().overrides.keys(),
  ])
  const currentPreviewLayout = capturePreviewLayout()
  if (currentPreviewLayout) {
    for (const id of getHistoryDirtyNodeIds(currentPreviewLayout, target)) previewDirty.add(id)
  }
  useLiveNodeOverrides.getState().clearAll()
  useLiveTransforms.getState().clearAll()
  // Clearing overrides can republish stair holes while a live transform still
  // exists. Capture that final publication before clearing it too.
  const remainingOverrides = useLiveNodeOverrides.getState().overrides
  if (remainingOverrides.size > 0) {
    for (const id of remainingOverrides.keys()) previewIds.add(id)
    const remainingLayout = capturePreviewLayout()
    if (remainingLayout) {
      for (const id of getHistoryDirtyNodeIds(remainingLayout, target)) previewDirty.add(id)
    }
    useLiveNodeOverrides.getState().clearAll()
  }

  const state = useScene.getState()
  for (const id of previewDirty) {
    if (state.nodes[id]) state.markDirty(id)
  }
  for (const id of previewIds) {
    const node = state.nodes[id as AnyNodeId]
    if (!node) continue
    state.markDirty(node.id)
    if (node.parentId && state.nodes[node.parentId as AnyNodeId]) {
      state.markDirty(node.parentId as AnyNodeId)
    }
  }
}

export function shouldCancelDraftOnHistoryJump(): boolean {
  const scope = useInteractionScope.getState().scope
  return registeredDraftingConfig(scope)?.cancelOnHistoryJump === true
}

function doUndo(): HistoryCommandResult {
  if (shouldCancelDraftOnHistoryJump()) emitter.emit('tool:cancel')
  if (historyCommandDelegate) {
    const result = historyCommandDelegate.undo()
    // Mark only real jumps: a no-op undo must not open a receipt (or
    // interrupt one that is still settling).
    if (result.kind !== 'empty') {
      markPerfAction('undo')
      emitHistoryJump('undo')
    }
    return result
  }
  if (useScene.temporal.getState().pastStates.length === 0) return { kind: 'empty' }
  markPerfAction('undo')
  const previewLayout = capturePreviewLayout()
  useScene.temporal.getState().undo()
  refreshSceneAfterHistoryJump(previewLayout)
  emitHistoryJump('undo')
  return { kind: 'applied', persistence: 'local' }
}

function doRedo(): HistoryCommandResult {
  if (shouldCancelDraftOnHistoryJump()) emitter.emit('tool:cancel')
  if (historyCommandDelegate) {
    const result = historyCommandDelegate.redo()
    if (result.kind !== 'empty') {
      markPerfAction('redo')
      emitHistoryJump('redo')
    }
    return result
  }
  if (useScene.temporal.getState().futureStates.length === 0) return { kind: 'empty' }
  markPerfAction('redo')
  const previewLayout = capturePreviewLayout()
  useScene.temporal.getState().redo()
  refreshSceneAfterHistoryJump(previewLayout)
  emitHistoryJump('redo')
  return { kind: 'applied', persistence: 'local' }
}

function runAsJump(run: () => HistoryCommandResult): HistoryCommandResult {
  isHistoryJumping = true
  try {
    return run()
  } finally {
    isHistoryJumping = false
  }
}

export function runUndo(): HistoryCommandResult {
  return runAsJump(doUndo)
}

export function runRedo(): HistoryCommandResult {
  return runAsJump(doRedo)
}

/**
 * A measurement the user deleted (#63, AppFront A8). `ordinal` is its 1-based
 * position among the level's measurements before the delete, which is the "N"
 * in "Đã xoá phép đo N". Undo/redo jumps never fire this — they restore or
 * remove nodes without being a fresh delete.
 */
export type MeasurementDeleteListener = (event: { ordinal: number }) => void

const measurementDeleteListeners = new Set<MeasurementDeleteListener>()
let isHistoryJumping = false
let stopWatchingMeasurements: (() => void) | null = null

function watchMeasurementDeletes() {
  return useScene.subscribe((state, previous) => {
    if (isHistoryJumping || state.nodes === previous.nodes) return
    let ordinal = 0
    for (const [id, node] of Object.entries(previous.nodes)) {
      if (node.type !== 'measurement') continue
      ordinal += 1
      if (state.nodes[id as AnyNodeId]) continue
      for (const listener of [...measurementDeleteListeners]) listener({ ordinal })
    }
  })
}

export function subscribeMeasurementDeletes(listener: MeasurementDeleteListener): () => void {
  measurementDeleteListeners.add(listener)
  stopWatchingMeasurements ??= watchMeasurementDeletes()
  return () => {
    measurementDeleteListeners.delete(listener)
    if (measurementDeleteListeners.size > 0) return
    stopWatchingMeasurements?.()
    stopWatchingMeasurements = null
  }
}

/**
 * ⌘Z / ⌘⇧Z (undo/redo). Pointer-drag sessions intercept these in the capture
 * phase and cancel the gesture instead — mid-drag, "undo" means "abort what my
 * mouse is doing", never a history jump under a live pointer.
 */
export function isHistoryShortcut(e: KeyboardEvent) {
  return (e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')
}
