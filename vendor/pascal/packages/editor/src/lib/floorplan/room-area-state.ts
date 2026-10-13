import type { InspectorState } from '../../components/ui/panels/inspector-state'

/**
 * The room-area panel's seven screen states (AppFront A11 — #69/#82), the same
 * set the inspector uses (`inspector-state.ts`) so one vocabulary covers both.
 *
 * | state       | rendered as                                              |
 * |-------------|----------------------------------------------------------|
 * | `loading`   | skeleton rows — the scene has no nodes yet                |
 * | `empty`     | the "no measurable room" card with its next step          |
 * | `error`     | notice: every room failed to measure, no rows at all      |
 * | `partial`   | table plus a notice listing the rooms that did not measure|
 * | `forbidden` | table plus a notice: read-only role, nothing is editable  |
 * | `collapsed` | the table folded to its first rows                        |
 * | `success`   | the full table                                            |
 */
export type RoomAreaState = InspectorState

export interface RoomAreaStateInput {
  sceneLoaded: boolean
  rowCount: number
  issueCount: number
  readOnly: boolean
  collapsed: boolean
}

export function roomAreaStateOf(input: RoomAreaStateInput): RoomAreaState {
  if (!input.sceneLoaded) return 'loading'
  if (input.rowCount === 0) return input.issueCount > 0 ? 'error' : 'empty'
  if (input.issueCount > 0) return 'partial'
  if (input.readOnly) return 'forbidden'
  return input.collapsed ? 'collapsed' : 'success'
}
