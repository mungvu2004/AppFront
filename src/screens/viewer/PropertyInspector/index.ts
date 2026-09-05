/**
 * Cửa nhập ổn định của panel `PropertyInspector`.
 *
 * Màn cha viết `@/screens/viewer/PropertyInspector` và không phải biết panel
 * này gồm mấy file. Khi view hoặc hook vượt trần 400 dòng của R-22 và phải
 * tách thêm file anh em, không nơi gọi nào phải sửa theo (mục D) — cùng khuôn
 * `ViewerShell/index.ts` và `Viewer3D/index.ts`.
 *
 * Ba nhóm đi ra khỏi đây:
 *
 * - `PropertyInspectorContainer` — panel đã nối dây, gắn được bằng một thẻ
 *   (R-73); `PROPERTY_INSPECTOR_SCREEN_ID` đi cùng nó cho ranh giới lỗi/nhật ký.
 * - `PropertyInspector` — view thuần, thứ story và bài kiểm bảy trạng thái
 *   dựng thẳng; `usePropertyInspector` — nửa "suy nghĩ", cho màn cha muốn tự
 *   dựng view thay vì dùng container.
 * - Mọi hằng số và kiểu dùng chung của `propertyInspectorTypes.ts`: bảy trạng
 *   thái, năm nhóm, ngân sách năm trường mặc định, số đo bố cục cố định.
 */

export { PropertyInspector } from './PropertyInspector';
export {
  PropertyInspectorContainer,
  PROPERTY_INSPECTOR_SCREEN_ID,
} from './PropertyInspector.container';
export { usePropertyInspector } from './usePropertyInspector';

export {
  ADVANCED_FIELD_IDS,
  COLLAPSIBLE_GROUP_ID,
  DEFAULT_FURNITURE_FIELD_IDS,
  DEFAULT_OPENING_FIELD_IDS,
  DEFAULT_ROOM_FIELD_IDS,
  DEFAULT_VISIBLE_FIELD_COUNT,
  DEFAULT_WALL_FIELD_IDS,
  OBJECT_KIND_LABELS,
  PROPERTY_GROUP_IDS,
  PROPERTY_GROUP_LABELS,
  PROPERTY_INSPECTOR_LAYOUT,
  type ObjectKind,
  type PropertyControlType,
  type PropertyGroup,
  type PropertyGroupId,
  type PropertyInspectorCollapsedState,
  type PropertyInspectorCollapsedVariant,
  type PropertyInspectorContainerProps,
  type PropertyInspectorEmptyState,
  type PropertyInspectorErrorState,
  type PropertyInspectorForbiddenState,
  type PropertyInspectorFooter,
  type PropertyInspectorHeader,
  type PropertyInspectorLoadingState,
  type PropertyInspectorPanelContent,
  type PropertyInspectorPartialState,
  type PropertyInspectorProps,
  type PropertyInspectorState,
  type PropertyInspectorStateKind,
  type PropertyInspectorSuccessState,
  type PropertyRow,
  type PropertyRowOption,
  type PropertyRowWarning,
  type PropertyRowWarningLevel,
  type PropertyStatusBadge,
  type PropertyStatusBadgeTone,
  type PropertyThumbnail,
  type PropertyValue,
  type UsePropertyInspectorOptions,
  type UsePropertyInspectorResult,
} from './propertyInspectorTypes';
