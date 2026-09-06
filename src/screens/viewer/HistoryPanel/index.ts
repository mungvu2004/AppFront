/**
 * Cửa nhập ổn định của `HistoryPanel` (S-34).
 *
 * Màn cha viết `@/screens/viewer/HistoryPanel` và không phải biết panel này gồm
 * mấy file — cùng khuôn `RoomAreaPanel/index.ts` và `PropertyInspector/index.ts`.
 * Mục D của CLAUDE.md nói đúng lý do: khi một view vượt trần 400 dòng của R-22
 * thì phần con tách ra file anh em, và file này giữ nguyên đường nhập để không
 * nơi gọi nào phải sửa theo. Panel này đã tách ba lần —
 * `HistoryPanel.chrome.tsx`, `HistoryPanel.rows.tsx`, `useHistoryPanel.model.ts`
 * — và không lần nào đổi chữ nào ở đây.
 *
 * Bốn nhóm đi ra khỏi đây:
 *
 * - `HistoryPanelContainer` — panel ĐÃ NỐI DÂY, gắn được bằng đúng một thẻ
 *   (R-73); `HISTORY_PANEL_SCREEN_ID` đi cùng nó cho ranh giới lỗi và cho nhật
 *   ký, `HistoryPanelContainerProps` là props thật của nó.
 * - `HistoryPanel` — view THUẦN, thứ story và bài kiểm bảy trạng thái dựng
 *   thẳng từ props.
 * - `useHistoryPanel` — nửa "suy nghĩ", cho màn cha muốn tự dựng view thay vì
 *   dùng container; cổng của panel đi cùng nó, kể cả bản giả cho bài kiểm.
 * - Toàn bộ kiểu, hằng và nhãn dùng chung của `historyPanelTypes.ts` — hợp đồng
 *   bốn phía cùng đọc.
 */

export {
  HISTORY_PANEL_SCREEN_ID,
  HistoryPanelContainer,
  type HistoryPanelContainerProps,
} from './HistoryPanel.container';

export { HistoryPanel } from './HistoryPanel';

export {
  HISTORY_PANEL_SHORTCUT_DESCRIPTION,
  HISTORY_PANEL_SHORTCUT_ID,
  useHistoryPanel,
  type UseHistoryPanelOptions,
} from './useHistoryPanel';

export {
  createFakeHistoryPanelGateway,
  createHistoryPanelGateway,
  HISTORY_PANEL_DEFAULT_ACTOR_ID,
  type HistoryPanelGateway,
  type HistorySceneHandle,
  type HistoryScenePort,
} from './historyPanelGateway';

export {
  HISTORY_ANONYMOUS_ACTOR_LABEL,
  HISTORY_CATEGORY_LABELS,
  HISTORY_CATEGORY_ORDER,
  HISTORY_MAX_STEPS,
  HISTORY_PANEL_SHORTCUT,
  HISTORY_PANEL_TEST_IDS,
  HISTORY_SESSION_GAP_MS,
  HISTORY_UNDONE_ITEM_CLASS,
  type HistoryActor,
  type HistoryBatchItem,
  type HistoryCategory,
  type HistoryCategoryFilter,
  type HistoryDayGroup,
  type HistoryEntityRef,
  type HistoryFilters,
  type HistoryItemPosition,
  type HistoryPanelLayout,
  type HistoryPanelProps,
  type HistoryPanelState,
  type HistoryPartialReason,
  type HistorySessionGroup,
  type HistorySingleItem,
  type HistoryTimelineItem,
  type HistoryValueDiff,
  type UseHistoryPanelResult,
} from './historyPanelTypes';
