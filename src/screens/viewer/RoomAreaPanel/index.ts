/**
 * Cửa nhập ổn định của `RoomAreaPanel` (S-33).
 *
 * Màn cha viết `@/screens/viewer/RoomAreaPanel` và không phải biết bảng này
 * gồm mấy file — cùng khuôn `WallGeometryEditor/index.ts` và
 * `PropertyInspector/index.ts`. Mục D của CLAUDE.md nói đúng lý do: khi một
 * view vượt trần 400 dòng của R-22 thì phần con tách ra file anh em, và file
 * này giữ nguyên đường nhập để không nơi gọi nào phải sửa theo. Bảng này đã
 * tách bốn lần — `RoomAreaPanel.chrome.tsx`, `RoomAreaPanel.rows.tsx`,
 * `RoomAreaTable.Row.tsx`, `useRoomAreaPanel.model.ts` — và không lần nào đổi
 * chữ nào ở đây.
 *
 * Bốn nhóm đi ra khỏi đây:
 *
 * - `RoomAreaPanelContainer` — bảng ĐÃ NỐI DÂY, gắn được bằng đúng một thẻ
 *   (R-73); `ROOM_AREA_PANEL_SCREEN_ID` đi cùng nó cho ranh giới lỗi và cho
 *   nhật ký, `RoomAreaPanelContainerProps` là props thật của nó.
 * - `RoomAreaPanel` và `RoomAreaTable` — hai view THUẦN, thứ story và bài kiểm
 *   bảy trạng thái dựng thẳng từ props.
 * - `useRoomAreaPanel` — nửa "suy nghĩ", cho màn cha muốn tự dựng view thay vì
 *   dùng container; `RoomAreaPanelModel` là đầu ra của nó.
 * - Toàn bộ kiểu dùng chung của `roomAreaTypes.ts` — hợp đồng ba phía cùng đọc.
 */

export {
  ROOM_AREA_PANEL_SCREEN_ID,
  RoomAreaPanelContainer,
  type RoomAreaPanelContainerProps,
} from './RoomAreaPanel.container';

export { RoomAreaPanel } from './RoomAreaPanel';
export { RoomAreaTable } from './RoomAreaTable';

export {
  ROOM_AREA_DEFAULT_ACTOR_ID,
  useRoomAreaPanel,
  type RoomAreaPanelModel,
  type UseRoomAreaPanelOptions,
} from './useRoomAreaPanel';

export type {
  RoomAreaBand,
  RoomAreaCommonProps,
  RoomAreaGroup,
  RoomAreaGrouping,
  RoomAreaLevelOption,
  RoomAreaMode,
  RoomAreaPanelProps,
  RoomAreaRow,
  RoomAreaScreenState,
  RoomAreaSort,
  RoomAreaStatus,
  RoomAreaTableProps,
  RoomAreaTone,
  RoomAreaTotals,
} from './roomAreaTypes';
