/**
 * The inspector's seven screen states (AppFront A11), resolved in one place so
 * no selection shape falls through to a blank panel.
 *
 * Five of the seven already have a home in the panel manager; this resolver
 * names them so the mapping is checkable, and the two that used to render
 * nothing (`forbidden`, `error`) get a notice in `InspectorNotice`:
 *
 * | state       | rendered as                                               |
 * |-------------|-----------------------------------------------------------|
 * | `empty`     | no panel — nothing is selected, the canvas is the screen  |
 * | `loading`   | the editor's own scene loader                             |
 * | `partial`   | `MultiSelectionPanel` (mixed kinds, shared actions only)  |
 * | `error`     | notice: the selected node is gone from the scene          |
 * | `success`   | the node's inspector, expanded                            |
 * | `forbidden` | notice: read-only role, nothing here is editable          |
 * | `collapsed` | the node's inspector folded to its header                 |
 */
export type InspectorState =
  | 'empty'
  | 'loading'
  | 'partial'
  | 'error'
  | 'success'
  | 'forbidden'
  | 'collapsed'

export interface InspectorStateInput {
  readOnly: boolean
  sceneLoaded: boolean
  /** Selected node ids plus the selected zone, if any. */
  selectedCount: number
  /** Selected ids that no longer resolve to a node. */
  missingCount: number
  /** Multi-selection shares one kind (edited together) or not. */
  homogeneous: boolean
  collapsed: boolean
}

export function inspectorStateOf(input: InspectorStateInput): InspectorState {
  if (!input.sceneLoaded) return 'loading'
  if (input.selectedCount === 0) return 'empty'
  if (input.readOnly) return 'forbidden'
  if (input.missingCount > 0) return 'error'
  if (input.selectedCount > 1 && !input.homogeneous) return 'partial'
  return input.collapsed ? 'collapsed' : 'success'
}
