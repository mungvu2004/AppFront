// The snap math lives in core so the editor's wall drafting can use it too
// (editor cannot import nodes — nodes imports editor).
export {
  collectStructuralGridAxes,
  formatStructuralGridReference,
  resolveStructuralGridReference,
  resolveStructuralGridSnap,
  STRUCTURAL_GRID_REFERENCE_TOLERANCE_M,
  STRUCTURAL_GRID_SNAP_DISTANCE_M,
  type StructuralGridPoint,
  type StructuralGridSnap,
} from '@pascal-app/core'
