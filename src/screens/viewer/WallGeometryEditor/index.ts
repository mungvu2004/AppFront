/**
 * Cửa nhập ổn định của `WallGeometryEditor`.
 *
 * Chỉ xuất phần T5 sở hữu — view thuần và toàn bộ kiểu dùng chung
 * (`wallGeometryEditorTypes.ts`). `WallGeometryEditorContainer` và
 * `useWallGeometryEditor` là của T6, đang được dựng song song ở một worktree
 * khác; khi hai nhánh hợp nhất, chỗ hợp nhất (T7) thêm hai dòng xuất đó vào
 * đây mà không phải sửa gì trong file này — cùng khuôn
 * `PropertyInspector/index.ts`.
 */

export { WallGeometryEditor } from './WallGeometryEditor';

export {
  KNOWN_SNAP_KIND_IDS,
  WALL_GEOMETRY_EDITOR_LAYOUT,
  WALL_GEOMETRY_EDITOR_TEXT,
  WALL_GEOMETRY_MOTION,
  WALL_GEOMETRY_TOOL_IDS,
  type SnapKindId,
  type UseWallGeometryEditorOptions,
  type UseWallGeometryEditorResult,
  type WallGeometryCellStatus,
  type WallGeometryComparisonChip,
  type WallGeometryDimensionChain,
  type WallGeometryDimensionSegment,
  type WallGeometryDragSession,
  type WallGeometryEditBand,
  type WallGeometryEditorCollapsedState,
  type WallGeometryEditorContainerProps,
  type WallGeometryEditorContent,
  type WallGeometryEditorEmptyState,
  type WallGeometryEditorErrorState,
  type WallGeometryEditorForbiddenState,
  type WallGeometryEditorLoadingState,
  type WallGeometryEditorPartialState,
  type WallGeometryEditorProps,
  type WallGeometryEditorState,
  type WallGeometryEditorStateKind,
  type WallGeometryEditorSuccessState,
  type WallGeometryEdgeHighlight,
  type WallGeometryGap,
  type WallGeometryHandle,
  type WallGeometryHandleKind,
  type WallGeometryMotionSlot,
  type WallGeometryNudgeDirection,
  type WallGeometryPointPx,
  type WallGeometrySnapGuide,
  type WallGeometrySnapKind,
  type WallGeometrySnapModel,
  type WallGeometryTone,
  type WallGeometryToolButton,
  type WallGeometryToolId,
  type WallGeometryToolIconCode,
  type WallGeometryToolbar,
  type WallGeometryVertexCell,
  type WallGeometryVertexRow,
  type WallGeometryVertexTable,
  type WallGeometryVertexTableColumns,
} from './wallGeometryEditorTypes';
