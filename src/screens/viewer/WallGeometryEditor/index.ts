/**
 * Cửa nhập ổn định của `WallGeometryEditor`.
 *
 * Màn cha viết `@/screens/viewer/WallGeometryEditor` và không phải biết lớp
 * phủ này gồm mấy file — cùng khuôn `PropertyInspector/index.ts`.
 *
 * Ba nhóm đi ra khỏi đây:
 *
 * - `WallGeometryEditorContainer` — lớp phủ ĐÃ NỐI DÂY, gắn được bằng đúng một
 *   thẻ (R-73); `WALL_GEOMETRY_EDITOR_SCREEN_ID` đi cùng nó cho ranh giới lỗi
 *   và cho nhật ký. `WallGeometryEditorContainerInput` là props thật của nó:
 *   hợp đồng của T5 cộng chỗ tiêm cổng của T6.
 * - `WallGeometryEditor` — view thuần, thứ story và bài kiểm bảy trạng thái
 *   dựng thẳng; `useWallGeometryEditor` — nửa "suy nghĩ", cho màn cha muốn tự
 *   dựng view thay vì dùng container.
 * - Mọi hằng số và kiểu dùng chung của `wallGeometryEditorTypes.ts`: bảy trạng
 *   thái, sáu công cụ, ba loại bắt điểm, số đo bố cục cố định.
 */

export { WallGeometryEditor } from './WallGeometryEditor';
export {
  WallGeometryEditorContainer,
  WALL_GEOMETRY_EDITOR_SCREEN_ID,
  type WallGeometryEditorContainerInput,
} from './WallGeometryEditor.container';
export { useWallGeometryEditor, type UseWallGeometryEditorInput } from './useWallGeometryEditor';

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
