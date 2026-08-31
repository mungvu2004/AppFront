/**
 * Nửa "suy nghĩ" của màn S-12 "Duyệt lớp tường" — mọi thứ hai view của màn cần,
 * đã xong.
 *
 * `types.ts` là hợp đồng props DUY NHẤT của màn và nó ĐÃ ĐÓNG BĂNG; hook này
 * trả về đúng {@link WallLayerReviewProps} (`panel` + `canvas`), cộng đúng hai
 * trường thoả thuận thêm với người viết view — {@link WallLayerToolRailProps} và
 * {@link WallLayerStatusBarProps} — khai và xuất tại file này để T8 đối chiếu hai
 * bên lúc tích hợp.
 *
 * ## Đường ghi (A10)
 *
 * Không một dòng nào gọi `set()` hay `_applyPatches()`. Mọi thay đổi đi:
 * lệnh S-07 (hoặc lệnh duyệt dựng bằng nguyên thuỷ công khai) → `dispatch` →
 * `SpatialPort.applyPatches` = `commit(patches, label)` → store. Xem
 * `wallLayerReviewGateway.ts` để có lý do và trích dẫn.
 *
 * ## Trạng thái máy chủ (R-64)
 *
 * Không `useState` nào giữ cờ đang-tải hay cờ hỏng. Ảnh nền — dữ liệu máy chủ
 * duy nhất của màn — đi qua `useQuery` dưới khoá `queryKeys.drawing.byFloor`;
 * mọi lượt ghi gọi `applyInvalidation(queryClient, 'editWall', …)`, tức đúng ba
 * khoá `invalidationMap.editWall` khai (`space`/`room`/`violation`), không gọi
 * `invalidateQueries` trần. `useState` ở đây chỉ giữ trạng thái của riêng giao
 * diện: ba cờ lọc, cờ thu gọn, tường đang chọn, và trạng thái máy công cụ.
 *
 * ## Không công thức tự chế (R-61)
 *
 * - Đa giác tường: `resolveWallShapes` (`src/domain/walls/joints.ts`).
 * - Chiều dài tim tường: `centrelineLength` (`src/domain/walls/types.ts`).
 * - Tách/nối: `splitWall`/`mergeWalls` (`src/domain/walls/edit.ts`), gọi qua
 *   chính hai hàm dựng lệnh của S-07.
 * - Ngưỡng độ tin cậy: `confidenceLevel` (`@/lib/format/semantic`) — cùng hàm
 *   `toWallViewModel` dùng, nên trạng thái màu và cờ lọc không thể lệch nhau.
 * - Số: `formatLength`, `formatNumber`, `formatPoint`, `formatElevationM`,
 *   `formatScaleDensity`. Không một hàm định dạng số dựng sẵn nào của JavaScript
 *   được gọi thẳng trong màn — A15 đặt việc đó ở `src/lib/format`.
 * - **Không một lời gọi nào tới đối tượng toán học toàn cục**, ở đây hay ở bất
 *   cứ file nào trong thư mục màn — nghiệm thu grep rỗng.
 *
 * ## Chuyển động (mục B, R-71)
 *
 * Bộ đếm duyệt chạy 12 → 13 qua `useCountUp`, và `COUNT_UP_DURATION` của
 * `src/lib/motion/useCountUp.ts` là nấc `'standard'` = **260 ms**. Đặc tả viết
 * 240 ms; 240 không có trên thang năm giá trị (120/180/260/340/700) và
 * `local/no-raw-duration` chặn nó ở mức lỗi, nên màn đi theo luật nhà. Cùng lý
 * do, nháy nền hàng vừa hoàn tác dùng nấc `'slow'` = **340 ms** thay cho 400 ms,
 * và hai lượt 180 ms (cuộn hàng vào tầm nhìn, tô sáng chéo canvas ↔ danh sách)
 * là đúng nấc `'fast'` — không con số nào viết tay.
 *
 * ## Tự lưu (D-07 / A7) — chọn HỆ 2
 *
 * Repo có hai hệ tự lưu độc lập. Màn này dùng **`createAutosave` +
 * `useSaveIndicator`** (hệ 2), không dùng `useAutosave` (hệ 1), vì ba lý do:
 *
 * 1. `types.ts` đã đóng băng và KHÔNG có trường nào mang nhãn lưu, nên chuỗi hệ
 *    1 trả về sẽ không tới được người dùng. `useSaveIndicator` tự nói trạng thái
 *    ra `Announcer` (`useSaveIndicator.ts:88-121`) — đó là cách duy nhất còn lại
 *    để giữ vế thứ hai của A7 ("nói ra trạng thái đó cho trình đọc màn hình").
 * 2. Thanh trạng thái cần đúng chuỗi "Đã lưu lúc 14:32"; hệ 2 dựng nó từ
 *    `viMessages.common.saved_at`, và tự chuyển sang "Đã lưu N phút trước" sau
 *    một phút.
 * 3. `persistWallLayer` hôm nay chưa có endpoint. Chỉ hệ 2 có trạng thái
 *    `failed`/`offline` để NÓI RA sự thật đó; hệ 1 chỉ có một chuỗi
 *    "Lưu thất bại" sau khi `console.error`.
 *
 * Cả hai hệ dùng chung 800 ms của A7 (`DEFAULT_DEBOUNCE_MS`), nên không con số
 * nào phải viết lại ở đây.
 *
 * ## Bàn phím (I-01, A12, R-72)
 *
 * Không một `addEventListener('keydown')` nào. Mọi phím đăng ký qua
 * `useShortcut` → `appShortcutRegistry`. Sáu phím `J K Backspace 1 2 3` đã được
 * khảo sát xác nhận chưa ai chiếm. `Enter` KHÔNG được đăng ký làm phím tắt
 * toàn cục (nó nằm trong `RESERVED_KEYS`): hàng danh sách và nút "Duyệt đoạn
 * này" là phần tử focus được, và Enter kích hoạt hành động mặc định của phần tử
 * đang có tiêu điểm — đúng ngữ nghĩa bàn phím chuẩn, đúng cách đi qua
 * `expectAccessible`, và giữ nguyên lời hứa "Esc đóng lớp trên cùng".
 *
 * Ba phím công cụ `V`/`W`/`M` lấy tổ hợp từ `shortcutForTool` chứ không gõ tay,
 * và đăng ký ở tầng `canvas` với mã `wallLayerReview.*`. `Ctrl+Z` cũng đăng ký ở
 * tầng `canvas`: `buildGlobalShortcuts` khai nó ở tầng `global`, mà `canvas`
 * đứng TRÊN `global` trong `SCOPE_PRIORITY`, nên khi màn đang mở thì hoàn tác
 * chạy trên ngăn xếp 100 bước của chính màn, và không có hai đăng ký nào cùng
 * một tầng để `findOverlaps` phải kêu.
 *
 * `Space` (giữ để tạm di chuyển khung nhìn) và `F` (phủ khắp vùng chọn) KHÔNG
 * được đăng ký ở đây: cả hai là việc của khung nhìn canvas, và
 * `WallLayerCanvasProps` đã đóng băng không có hàm xử lý nào cho chúng — thêm
 * một phím không có đường ra là dựng một cái nút không nối vào đâu (R-73).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { createId, type EntityKind, type IdByKind } from '@/domain/spatial/ids';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import type { EntityId, Level, LevelId, Point, Wall, WallId } from '@/domain/spatial/types';
import { millimetresPerPixel } from '@/domain/units/scale';
import { useCountUp } from '@/hooks/useCountUp';
import { appNotificationBus } from '@/hooks/useNotifications';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useSaveIndicator } from '@/hooks/useSaveIndicator';
import { useShortcut } from '@/hooks/useShortcut';
import { createAutosave, type Autosave } from '@/lib/autosave/createAutosave';
import { can } from '@/lib/auth/permissions';
import { describeError, toAppError } from '@/lib/errors';
import type { ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import type { NotificationBus } from '@/lib/mutations/notificationBus';
import { createSelectionChannel } from '@/lib/selection/syncChannel';
import { planReveals, revealAnchor, describeSelection } from '@/lib/selection/revealPolicy';
import { selectSingle, toggleSelection, type SelectionContext } from '@/lib/selection/selectionOps';
import { applyInvalidation } from '@/lib/query/invalidation';
import { queryKeys } from '@/lib/query/queryKeys';
import { durationMs } from '@/lib/motion';
import { shortcutForTool } from '@/lib/tools/shortcuts';
import { createToolState, reduceTool, DEFAULT_TOOL_SETTINGS } from '@/lib/tools/toolMachine';
import type {
  ToolContext,
  ToolEvent,
  ToolId,
  ToolInputValue,
  ToolMachineState,
  ToolTransition,
} from '@/lib/tools/toolMachine';
import { TOOLS } from '@/lib/tools/tools';
import { useStore } from '@/store';
import type { ProjectRole } from '@/types/project';

import {
  buildApproveWallCommand,
  buildChangeThicknessCommand,
  buildDeleteWallCommand,
  buildMergeWallsCommand,
  buildSplitWallCommand,
  commandContextOf,
  createMockWallLayerReviewGateway,
  createWallLayerDispatchDeps,
  createWallLayerReviewGateway,
  createWallUndoTicket,
  centreOfBounds,
  clampZoom,
  cursorLabelOf,
  DEFAULT_ZOOM,
  fitZoomFor,
  formatScaleLabel,
  isLowConfidence,
  measurementOutcomeToPx,
  miniMapCentreMm,
  isStandardThickness,
  reviewProgressLabel,
  runWallCommand,
  toWallInspector,
  toWallRow,
  canvasLabelOf,
  drawingSizeOf,
  legendLevelsOf,
  scaleOfLevel,
  toCanvasShapes,
  toolOutcomeToCommand,
  toMeasurementPx,
  toMillimetrePoint,
  toPixelPoint,
  unionOfBounds,
  wallStatusCode,
  zoomPercentOf,
  WALL_LAYER_THICKNESS_CHOICES,
  ZOOM_STEP,
  type WallLayerBackground,
  type WallLayerCanvasShape,
  type WallLayerGraphPort,
  type WallLayerPointerReading,
  type WallLayerRectPx,
  type WallLayerReviewGateway,
  type WallLayerSizePx,
  type WallLayerViewportPx,
  type WallLayerViewportRectPercent,
} from './wallLayerReviewGateway';
import type { WallLayerLeftPanelExtras } from './WallLayerLeftPanel';
import type { WallLayerStatusBarProps } from './WallLayerStatusBar';
import type { WallLayerCanvasViewProps, WallLayerMeasurementPx } from './wallLayerHatch';
import type { WallLayerToolId, WallLayerToolRailProps } from './WallLayerToolRail';
import type {
  WallLayerFilterKey,
  WallLayerFilters,
  WallLayerReviewProps,
  WallLayerScreenState,
  WallLayerViewProps,
  WallReviewCounter,
  WallRowViewModel,
  WallThicknessChoice,
} from './types';

/* -------------------------------------------------------------------------- */
/* Chuỗi của màn.                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Mọi câu người dùng đọc, gom một chỗ.
 *
 * Viết thẳng tiếng Việt như mọi màn khác của repo (`src/i18n/vi.json` là từ
 * điển kiểm tra, không phải bảng dịch lúc chạy). Chữ thường kiểu câu theo A6,
 * trừ mã tường và tên phím — hai ngoại lệ A6 cho phép.
 */
export const WALL_LAYER_TEXT = {
  /*
   * Bốn câu dưới đây từng TRÔI khỏi `src/i18n/vi.json`: mã nói một đằng, từ
   * điển kiểm tra nói một nẻo, và không cổng nào bắt được vì `vi.json` không
   * phải bảng dịch lúc chạy. Bản trong từ điển là bản khớp đặc tả, nên mã đi
   * theo từ điển — xem `vi.json#wallLayerReview.state`.
   */
  emptyNotice:
    'Chưa phát hiện được đoạn tường nào ở tầng này. Bạn có thể vẽ tường thủ công bằng phím W, hoặc chạy lại với ngưỡng thấp hơn.',
  viewerRoleNotice:
    'Bạn đang xem với vai người xem, nên không duyệt hay sửa được đoạn tường nào. Nhờ người có quyền sửa dự án duyệt giúp.',
  mergeLabel: 'nối đoạn',
  mergeDescription: 'Nối hai đoạn tường đang chọn thành một.',
  /** Nhãn ô đánh dấu bật/tắt tim tường (BC-17). */
  centrelinesLabel: 'Hiện tim tường',
  /** Nhãn khối điều hướng tầng của panel trái (BC-05). */
  floorNavLabel: 'Tầng của bản vẽ',
  /** Nhãn nút con mắt của hàng cây lớp "Tường" (BC-19). */
  showWallLayerLabel: 'Hiện lớp Tường',
  hideWallLayerLabel: 'Ẩn lớp Tường',
  /** Nhãn nút thu gọn / mở lại hai panel (BT-16). */
  collapsePanelsLabel: 'Thu gọn hai panel',
  expandPanelsLabel: 'Mở lại hai panel',
  shortcutNext: 'Xuống tường tiếp theo.',
  shortcutPrevious: 'Lên tường phía trên.',
  /*
   * `shortcutApprove` đã BỊ XOÁ, không phải bỏ quên.
   *
   * Nó mô tả một phím duyệt chưa từng được đăng ký: `rg 'shortcutApprove'`
   * chỉ ra đúng một chỗ khai và không một `useShortcut` nào dùng. Đặc tả không
   * đòi phím duyệt, và `Enter` trên nút "Duyệt đoạn này" đang có tiêu điểm đã
   * là đường bàn phím đúng (xem ghi chú "Bàn phím" ở đầu file) — nên chỗ sửa
   * là xoá câu mô tả, không phải dựng thêm một phím để câu mô tả có việc.
   * Khoá `wallLayerReview.shortcuts.approve` trong `vi.json` để nguyên: lượt
   * này chỉ được THÊM khoá vào từ điển, không được xoá.
   */
  shortcutDelete: 'Xoá đoạn tường đang chọn.',
  shortcutUndo: 'Hoàn tác thao tác gần nhất.',
  shortcutThickness: 'Đặt độ dày cho đoạn tường đang chọn.',
  shortcutTool: 'Chuyển công cụ.',
  shortcutFit: 'Phủ khắp đoạn tường đang chọn.',
} as const;

/* -------------------------------------------------------------------------- */
/* Hai trường thoả thuận thêm với người viết view — NAY ĐỌC TỪ CHÍNH VIEW.     */
/* -------------------------------------------------------------------------- */

/*
 * `WallLayerToolRailProps` và `WallLayerStatusBarProps` từng được khai HAI BẢN:
 * một ở đây, một trong file của mỗi view, vì hook và view được viết song song
 * trên hai nhánh chưa gộp. Hai bản đã LỆCH NHAU thật:
 *
 * - ray công cụ: bản hook là một danh sách ô chung
 *   (`{ items, activeToolId }`), bản view là hợp đồng điều phối viên chốt
 *   (`{ activeTool, onSelectTool, canMerge, onMerge, readOnly }`);
 * - thanh trạng thái: bản hook có `saveState`/`reviewProgressLabel` nhưng
 *   THIẾU `cursorLabel`, thứ hợp đồng chốt đòi.
 *
 * Hợp đồng đã chốt thắng, và cách chắc chắn nhất để hai bên không lệch lần nữa
 * là bỏ hẳn bản thứ hai: hook đọc kiểu TỪ view. `import type` bị xoá lúc biên
 * dịch nên không dòng nhập nào kéo một component vào bản dựng của hook.
 *
 * `reviewProgressLabel` không mất đi — nó vẫn ở `WallLayerViewProps` của panel,
 * đúng một chỗ. `saveState` cũng vậy: nhãn `saveLabel` đã nói ra trạng thái tự
 * lưu bằng tiếng Việt, nên một mã máy đọc song song chỉ là chỗ thứ hai để lệch.
 */

/* -------------------------------------------------------------------------- */
/* Tham số vào và giá trị ra.                                                  */
/* -------------------------------------------------------------------------- */

export interface UseWallLayerReviewOptions {
  readonly projectId: string;
  readonly floorId: string;
  /** Tầng đang duyệt. Vắng mặt thì hook lấy tầng đầu tiên của đồ thị. */
  readonly levelId?: LevelId;
  readonly roles?: readonly ProjectRole[];
  /** Cổng dữ liệu tiêm được. Vắng mặt thì hook dựng cổng thật, đúng một lần. */
  readonly gateway?: WallLayerReviewGateway;
  /** Sổ phím tiêm được — bài kiểm dựng sổ riêng để không đụng sổ dùng chung. */
  readonly registry?: ShortcutRegistry;
  /** Ép thu gọn hai panel — cho story và bài kiểm muốn một câu trả lời cố định. */
  readonly forceCollapsed?: boolean;
  /**
   * Bus thông báo — chỗ toast hoàn tác của A8 đi ra.
   *
   * Bỏ trống là bus của cả phiên (`appNotificationBus`), thứ `NotificationHost`
   * ở `src/main.tsx` đang vẽ. Test và story tiêm bus riêng để hai lượt kiểm
   * không thấy thông báo của nhau — cùng khuôn `useProcessingScreen`.
   */
  readonly notifications?: NotificationBus;
}

/*
 * Hợp đồng canvas: ĐỌC TỪ `wallLayerHatch.ts`, không khai lại.
 *
 * Hai khai báo từng đứng ở đây (`WallLayerMeasurementPx`,
 * `WallLayerCanvasViewProps`) là bản chép tay của hợp đồng lớp canvas, viết khi
 * nhánh canvas chưa gộp vào worktree này — cách duy nhất để hook biên dịch được
 * lúc đó. Nhánh đã gộp, nên bản chép biến mất theo đúng kế hoạch người viết nó
 * để lại: một hợp đồng, một chỗ khai.
 */
export type { WallLayerCanvasViewProps, WallLayerMeasurementPx } from './wallLayerHatch';

/** Đúng hợp đồng đã đóng băng, cộng bốn nhóm thoả thuận thêm với hai worker view. */
export interface UseWallLayerReviewResult extends WallLayerReviewProps {
  readonly canvas: WallLayerCanvasViewProps;
  readonly toolRail: WallLayerToolRailProps;
  readonly statusBar: WallLayerStatusBarProps;
  /** Những gì panel trái cần mà `WallLayerViewProps` (đã đóng băng) không mang. */
  readonly leftPanel: WallLayerLeftPanelExtras;
}

/* -------------------------------------------------------------------------- */
/* Hằng của riêng hook.                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Loại thông báo của một lượt xoá tường.
 *
 * `notificationBus` gộp các thông báo CÙNG LOẠI trong một cửa sổ năm giây và
 * dựng một vé hoàn tác gộp cho cả nhóm, nên xoá năm tường liên tiếp cho ra một
 * toast "hoàn tác 5 thay đổi" chứ không phải năm toast chồng nhau. Chuỗi này
 * viết đúng một chỗ (R-71).
 */
const WALL_DELETE_NOTIFICATION_TYPE = 'wallLayerReview.deleteWall';

/** Ba cờ lọc lúc mở màn: chưa lọc gì. */
const NO_FILTERS: WallLayerFilters = {
  onlyUnreviewed: false,
  onlyLowConfidence: false,
  onlyNonStandardThickness: false,
};

const NO_WALLS: readonly Wall[] = [];
const NO_LEVELS: readonly Level[] = [];

/**
 * Tỷ lệ dùng khi tầng CHƯA hiệu chỉnh.
 *
 * `WallLayerCanvasProps.millimetresPerPixel` không nhận `null`, nên phải có một
 * giá trị; một milimét trên một điểm ảnh là phép biến đổi đồng nhất — canvas vẽ
 * đúng toạ độ đồ thị, không phóng đại cũng không thu nhỏ theo một tỷ lệ bịa.
 * Thanh trạng thái thì nói thẳng rằng chưa có tỷ lệ (xem {@link formatScaleLabel}).
 */
const UNCALIBRATED_SCALE = millimetresPerPixel(1);

/** Mã tầng rỗng khi đồ thị chưa tới — máy công cụ chưa dựng được gì ở trạng thái này. */
const NO_LEVEL_ID = '';
const NO_ROWS: readonly WallRowViewModel[] = [];

/**
 * Bốn công cụ của ray, theo đúng thứ tự đặc tả đọc chúng.
 *
 * `WallLayerToolId` (hợp đồng ray, khai ở `WallLayerToolRail.tsx`) là ĐÚNG bốn
 * mục này, và cả bốn có mặt trong `ToolId` của `toolMachine` — nên phép gán hai
 * chiều dưới đây không mất mát gì. "Nối đoạn" cố ý KHÔNG nằm trong danh sách:
 * `toolMachine` không có chế độ nào cho việc gộp, nó là một hành động theo vùng
 * chọn (`canMerge`/`onMerge` của hợp đồng ray), không phải một công cụ.
 */
const RAIL_TOOL_IDS: readonly WallLayerToolId[] = ['select', 'drawWall', 'splitWall', 'measure'];

/**
 * Vùng nhìn khởi tạo của bản đồ nhỏ, phần trăm khổ bản vẽ.
 *
 * Cùng bộ số mà `useMiniMap` vốn tự đặt (`useMiniMap.ts:36-39`), viết ra đây để
 * nó là một quyết định đọc được chứ không phải một mặc định ẩn của component.
 */
const MINIMAP_INITIAL_VIEWPORT: WallLayerViewportRectPercent = {
  x: 20,
  y: 20,
  width: 40,
  height: 30,
};

/** Công cụ đang chọn của máy công cụ, đọc về đúng bốn mã ray. */
const railToolOf = (tool: ToolId): WallLayerToolId =>
  RAIL_TOOL_IDS.includes(tool as WallLayerToolId) ? (tool as WallLayerToolId) : 'select';

/* -------------------------------------------------------------------------- */
/* Phép ghép thuần — kiểm được mà không cần dựng hook.                          */
/* -------------------------------------------------------------------------- */

/** Tường của một tầng, theo đúng thứ tự đồ thị giữ chúng. */
export function wallsOfLevel(
  graph: NormalizedSpatial | null,
  levelId: LevelId | null,
): readonly Wall[] {
  if (graph === null || levelId === null) {
    return NO_WALLS;
  }

  const walls: Wall[] = [];

  for (const id of graph.byKind.wall) {
    const entity = graph.byId[id];

    if (entity !== undefined && 'centreline' in entity && entity.levelId === levelId) {
      walls.push(entity);
    }
  }

  return walls;
}

/** Tầng đang duyệt, hoặc tầng đầu tiên khi nơi gọi chưa chỉ định. */
export function levelOf(graph: NormalizedSpatial | null, levelId: LevelId | undefined): Level | null {
  if (graph === null) {
    return null;
  }

  const id = levelId ?? graph.byKind.level[0];

  if (id === undefined) {
    return null;
  }

  const entity = graph.byId[id];

  return entity !== undefined && 'elevationMm' in entity ? entity : null;
}

/**
 * Mọi tầng của bản vẽ, theo đúng thứ tự đồ thị giữ chúng (BC-05).
 *
 * Cùng khuôn {@link levelOf} — đọc `graph.byKind.level` rồi lọc ra thực thể có
 * `elevationMm`. KHÔNG một `useQuery` thứ hai nào: danh sách tầng đã nằm trong
 * chính đồ thị mà màn đang sửa.
 */
export function levelsOf(graph: NormalizedSpatial | null): readonly Level[] {
  if (graph === null) {
    return NO_LEVELS;
  }

  const levels: Level[] = [];

  for (const id of graph.byKind.level) {
    const entity = graph.byId[id];

    if (entity !== undefined && 'elevationMm' in entity) {
      levels.push(entity);
    }
  }

  return levels;
}

/** Ba cờ lọc áp lên danh sách. Cờ tắt thì không loại gì. */
export function applyWallFilters(
  walls: readonly Wall[],
  filters: WallLayerFilters,
): readonly Wall[] {
  return walls.filter((wall) => {
    if (filters.onlyUnreviewed && wall.reviewed) {
      return false;
    }

    if (filters.onlyLowConfidence && !isLowConfidence(wall)) {
      return false;
    }

    return !(filters.onlyNonStandardThickness && isStandardThickness(wall.thicknessMm));
  });
}

/** Tường CHƯA DUYỆT kế tiếp sau `fromId`, quay vòng về đầu danh sách. */
export function nextUnreviewedWallId(
  walls: readonly Wall[],
  fromId: WallId | null,
): WallId | null {
  if (walls.length === 0) {
    return null;
  }

  const start = fromId === null ? -1 : walls.findIndex((wall) => wall.id === fromId);
  const after = walls.slice(start + 1).find((wall) => !wall.reviewed);

  if (after !== undefined) {
    return after.id;
  }

  const wrapped = walls.slice(0, start + 1).find((wall) => !wall.reviewed);

  return wrapped?.id ?? null;
}

/** Hàng xóm của tường đang chọn theo một bước — `J` xuống, `K` lên. */
export function neighbourWallId(
  rows: readonly WallRowViewModel[],
  fromId: WallId | null,
  step: 1 | -1,
): WallId | null {
  if (rows.length === 0) {
    return null;
  }

  const current = fromId === null ? -1 : rows.findIndex((row) => row.id === fromId);
  const target = current + step;

  if (target < 0 || target >= rows.length) {
    return rows[current === -1 ? 0 : current]?.id ?? null;
  }

  return rows[target]?.id ?? null;
}

/**
 * Bảy trạng thái của A11, DẪN XUẤT từ dữ liệu chứ không phải bảy cờ rời rạc.
 *
 * Thứ tự quyết định là thứ tự trả lời: quyền trước (không có quyền thì mọi thứ
 * khác không đổi được gì), rồi vỏ màn, rồi mới tới dữ liệu. Bảy kịch bản của
 * `wallLayerReviewScenarios.ts` rơi đúng vào bảy nhánh này.
 */
export function deriveScreenState(input: {
  readonly isViewerRole: boolean;
  readonly isCollapsed: boolean;
  readonly hasError: boolean;
  readonly isLoading: boolean;
  readonly counter: WallReviewCounter;
}): WallLayerScreenState {
  if (input.isViewerRole) {
    return 'forbidden';
  }

  if (input.isCollapsed) {
    return 'collapsed';
  }

  if (input.hasError) {
    return 'error';
  }

  if (input.isLoading) {
    return 'loading';
  }

  if (input.counter.total === 0) {
    return 'empty';
  }

  return input.counter.reviewed === input.counter.total ? 'success' : 'partial';
}

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

/** Cổng thật dựng đúng một lần cho suốt đời component. */
function useResolvedGateway(injected: WallLayerReviewGateway | undefined): WallLayerReviewGateway {
  const fallbackRef = useRef<WallLayerReviewGateway | null>(null);

  if (injected !== undefined) {
    return injected;
  }

  fallbackRef.current ??= createWallLayerReviewGateway();

  return fallbackRef.current;
}

export function useWallLayerReview(
  options: UseWallLayerReviewOptions,
): UseWallLayerReviewResult {
  const { floorId, projectId } = options;
  const gateway = useResolvedGateway(options.gateway);
  const queryClient = useQueryClient();

  /* ---------------------------------------------------------------------- */
  /* Vai trò — trạng thái 6 vô hiệu MỌI hàm sửa, ở tầng hook.                */
  /* ---------------------------------------------------------------------- */

  const roles = options.roles ?? [];
  const canEdit = can('edit', 'layer', { roles });
  const isViewerRole = !canEdit;

  /* ---------------------------------------------------------------------- */
  /* Trạng thái của riêng giao diện.                                         */
  /* ---------------------------------------------------------------------- */

  const [filters, setFilters] = useState<WallLayerFilters>(NO_FILTERS);
  const [ownCollapsed, setOwnCollapsed] = useState(false);
  const [toolState, setToolState] = useState<ToolMachineState>(() => createToolState('select'));
  /** Hàng vừa đổi (TT-02) — nháy nền rồi tự tắt; xem khối "Xoá (D-05)" bên dưới. */
  const [flashingWallId, setFlashingWallId] = useState<WallId | null>(null);
  const isCollapsed = options.forceCollapsed ?? ownCollapsed;

  const onToggleCollapsed = useCallback(() => {
    setOwnCollapsed((previous) => !previous);
  }, []);

  /*
   * Trạng thái máy công cụ đọc được từ MỌI hàm xử lý, kể cả những hàm dựng
   * trước nó trong file — hai ref này đứng ngay cạnh `useState` vì `onSelect`
   * (dựng sớm hơn nhiều) phải hỏi máy công cụ đang chờ bước gì.
   */
  const toolStateRef = useRef(toolState);
  toolStateRef.current = toolState;
  const sendToolInputRef = useRef<((value: ToolInputValue) => void) | null>(null);

  /* ---------------------------------------------------------------------- */
  /* Hai lượt đọc máy chủ, TÁCH BẠCH (R-64).                                  */
  /* ---------------------------------------------------------------------- */

  /*
   * Ảnh nền và lớp tường là HAI lượt đọc, dưới hai khoá khác nhau, và trạng
   * thái 4 của A11 chỉ nghe lượt thứ hai. Bản trước gộp chúng làm một
   * (`hasError = backgroundQuery.isError`), nên "ảnh nền hỏng" bị đọc thành
   * "lớp tường hỏng" VÀ canvas mất luôn ảnh gốc — đúng hai điều
   * `wallLayerReviewScenarios.ts` gọi là không được phép.
   */

  const backgroundQuery = useQuery({
    queryKey: queryKeys.drawing.byFloor(floorId),
    queryFn: ({ signal }) => gateway.readBackground({ floorId, projectId, signal }),
  });

  const wallLayerQuery = useQuery({
    queryKey: queryKeys.space.byFloor(floorId),
    queryFn: ({ signal }) => gateway.readWallLayer({ floorId, projectId, signal }),
  });

  /*
   * Lần đọc ảnh nền THÀNH CÔNG gần nhất, giữ lại qua mọi lượt hỏng sau đó.
   *
   * `backgroundQuery.data` là `undefined` ngay khi lượt đọc hỏng, nên canvas
   * rơi về ô xám và kỹ sư mất ảnh gốc đúng lúc cần nó nhất để đối chiếu. Một
   * ref là đủ và trung thực: nó không bịa ra ảnh nào, chỉ không quên ảnh vừa
   * xem được.
   */
  const lastBackgroundRef = useRef<WallLayerBackground | null>(null);

  if (backgroundQuery.data !== undefined) {
    lastBackgroundRef.current = backgroundQuery.data;
  }

  const background = backgroundQuery.data ?? lastBackgroundRef.current;

  /* ---------------------------------------------------------------------- */
  /* Đồ thị đang sửa — nơi `commit` ghi vào.                                  */
  /* ---------------------------------------------------------------------- */

  const graph = useStore((state) => state.spatial);
  const setSpatial = useStore((state) => state.setSpatial);
  const selectedIds = useStore((state) => state.selectedIds);
  const hoveredId = useStore((state) => state.hoveredId);
  const setSelection = useStore((state) => state.setSelection);
  const setHovered = useStore((state) => state.setHovered);

  /* Nạp đồ thị của tầng vào kho một lần, nếu kho còn trống. */
  useEffect(() => {
    if (graph !== null) {
      return;
    }

    const seed = gateway.graph.read();

    if (seed !== null) {
      setSpatial(seed, null);
    }
  }, [gateway, graph, setSpatial]);

  const level = useMemo(() => levelOf(graph, options.levelId), [graph, options.levelId]);
  const levelId = level?.id ?? null;
  const walls = useMemo(() => wallsOfLevel(graph, levelId), [graph, levelId]);

  /* ---------------------------------------------------------------------- */
  /* Cổng ghi — `dispatch` chạy qua `commit`, hoàn tác 100 bước của S-06.     */
  /* ---------------------------------------------------------------------- */

  const storePort = useMemo<WallLayerGraphPort>(
    () => ({ read: () => useStore.getState().spatial }),
    [],
  );

  const autosaveRef = useRef<Autosave | null>(null);
  const persistRef = useRef({ floorId, gateway, projectId });
  persistRef.current = { floorId, gateway, projectId };

  autosaveRef.current ??= createAutosave<NormalizedSpatial>({
    getChanges: () => useStore.getState().spatial ?? undefined,
    save: async (changes) => {
      const current = persistRef.current;
      const result = await current.gateway.persistWallLayer({
        floorId: current.floorId,
        projectId: current.projectId,
        graph: changes,
      });

      if (!result.supported) {
        // Một khả năng chưa có endpoint KHÔNG được biến thành một lượt lưu đã
        // xong: ném ra là cách duy nhất để thanh trạng thái nói ra sự thật
        // thay vì hiện "Đã lưu lúc …" cho một lượt chưa hề rời khỏi máy.
        throw new Error(result.missing);
      }
    },
  });

  const autosave = autosaveRef.current;
  const saveIndicator = useSaveIndicator(autosave);

  const selectionSnapshotRef = useRef<readonly EntityId[]>(selectedIds);
  selectionSnapshotRef.current = selectedIds;
  const selectionBeforeRef = useRef<readonly EntityId[]>(selectedIds);

  const dispatchBundle = useMemo(
    () =>
      createWallLayerDispatchDeps({
        graph: storePort,
        selectionBefore: () => ({ selectedIds: selectionBeforeRef.current }),
        selectionAfter: () => ({ selectedIds: selectionSnapshotRef.current }),
        onSynced: () => {
          autosave.notifyChange();
        },
      }),
    [autosave, storePort],
  );

  /* ---------------------------------------------------------------------- */
  /* Vùng chọn (S-10) và đồng bộ hai chiều (S-11).                            */
  /* ---------------------------------------------------------------------- */

  const channel = useMemo(() => createSelectionChannel(), []);

  useEffect(() => () => channel.dispose(), [channel]);

  const selectionContext = useMemo<SelectionContext | null>(
    () => (graph === null || levelId === null ? null : { spatial: graph, activeLevelId: levelId, layers: {} }),
    [graph, levelId],
  );

  const selectedWallId = useMemo<WallId | null>(() => {
    const last = selectedIds[selectedIds.length - 1];

    return last !== undefined && walls.some((wall) => wall.id === last) ? (last as WallId) : null;
  }, [selectedIds, walls]);

  const pushSelection = useCallback(
    (next: readonly EntityId[]) => {
      selectionBeforeRef.current = selectionSnapshotRef.current;
      setSelection([...next]);
      /* S-11: một lượt đẩy cho cả canvas và danh sách, gộp trong một khung hình. */
      channel.push([...next]);
    },
    [channel, setSelection],
  );

  const onSelect = useCallback(
    (wallId: WallId | null) => {
      if (wallId === null) {
        pushSelection([]);

        return;
      }

      /*
       * Công cụ tách đoạn hỏi TƯỜNG trước, rồi mới hỏi điểm cắt
       * (`SPLIT_WALL_TOOL.steps`), nên một lượt bấm vào tường lúc nó đang chờ
       * bước `entity` là câu trả lời cho máy công cụ, không chỉ là một lượt
       * chọn. Chỉ `splitWall` đi đường này: `select` cũng có bước `entity`,
       * nhưng kết quả của nó là một `selection` quay ngược lại đúng hàm này.
       */
      const toolNow = toolStateRef.current;

      if (
        toolNow.tool === 'splitWall' &&
        TOOLS[toolNow.tool].steps[toolNow.values.length]?.kind === 'entity'
      ) {
        sendToolInputRef.current?.({ kind: 'entity', id: wallId });
      }

      const context = selectionContext;
      const next =
        context === null ? [wallId] : selectSingle(selectionSnapshotRef.current, wallId, context);

      pushSelection(next);
    },
    [pushSelection, selectionContext],
  );

  /**
   * Ctrl/Cmd-bấm: thêm hoặc bớt một tường khỏi vùng chọn (S-10).
   *
   * `selectSingle` luôn thay CẢ vùng chọn bằng đúng một mã, nên trước lượt sửa
   * này không có cách nào chọn được hai tường — và nút "nối đoạn", vốn bật theo
   * `selectedWallIds.length === 2`, là một nút chết vĩnh viễn. `toggleSelection`
   * của `src/lib/selection/selectionOps.ts` đã có sẵn đúng phép cần dùng.
   */
  const onToggleSelect = useCallback(
    (wallId: WallId) => {
      const context = selectionContext;

      if (context === null) {
        return;
      }

      pushSelection(toggleSelection(selectionSnapshotRef.current, wallId, context));
    },
    [pushSelection, selectionContext],
  );

  const onHover = useCallback(
    (wallId: WallId | null) => {
      setHovered(wallId);
    },
    [setHovered],
  );

  /* Ai còn phải cuộn để thấy tường vừa chọn — `planReveals` quyết, không phải màn. */
  useEffect(() => {
    if (selectedIds.length === 0) {
      return;
    }

    const anchor = revealAnchor(selectedIds);

    if (anchor === null) {
      return;
    }

    channel.reportVisible('list', selectedIds);
    planReveals(selectedIds, describeSelection(selectedIds), { list: selectedIds });
  }, [channel, selectedIds]);

  /* ---------------------------------------------------------------------- */
  /* Lệnh — mọi hàm sửa đi qua đây, và tắt hẳn ở vai Người xem.               */
  /* ---------------------------------------------------------------------- */

  const wallById = useCallback(
    (wallId: WallId): Wall | null => walls.find((wall) => wall.id === wallId) ?? null,
    [walls],
  );

  const invalidate = useCallback(() => {
    applyInvalidation(queryClient, 'editWall', { floorId, projectId });
  }, [floorId, projectId, queryClient]);

  const run = useCallback(
    async (build: (context: ReturnType<typeof commandContextOf>) => ReturnType<typeof buildApproveWallCommand> | null) => {
      const current = useStore.getState().spatial;

      if (!canEdit || current === null) {
        return;
      }

      const command = build(commandContextOf(current, gateway.actorId));

      if (command === null) {
        return;
      }

      const result = await runWallCommand(command, dispatchBundle);

      if (result.ok) {
        invalidate();
      }
    },
    [canEdit, dispatchBundle, gateway, invalidate],
  );

  const onApprove = useCallback(
    (wallId: WallId) => {
      const wall = wallById(wallId);

      if (wall === null || wall.reviewed) {
        return;
      }

      /* Tự chuyển mục: tìm tường chưa duyệt kế tiếp TRƯỚC khi tường này đổi cờ. */
      const nextId = nextUnreviewedWallId(walls, wallId);

      void run(() => buildApproveWallCommand(wall, gateway.actorId)).then(() => {
        if (nextId !== null && nextId !== wallId) {
          onSelect(nextId);
        }
      });
    },
    [gateway, onSelect, run, wallById, walls],
  );

  const onSkip = useCallback(
    (wallId: WallId) => {
      const nextId = nextUnreviewedWallId(walls, wallId);

      if (nextId !== null && nextId !== wallId) {
        onSelect(nextId);
      }
    },
    [onSelect, walls],
  );

  const onChangeThickness = useCallback(
    (wallId: WallId, thicknessMm: WallThicknessChoice) => {
      void run((context) => {
        const result = buildChangeThicknessCommand({ wallId, thicknessMm }, context);

        return result.ok ? result.data : null;
      }).then(() => {
        /* TT-02: đổi độ dày là lượt nháy nền chính, không phải một ngoại lệ. */
        setFlashingWallId(wallId);
      });
    },
    [run],
  );

  const onSplit = useCallback(
    (wallId: WallId, at: Point) => {
      const secondWallId = gateway.nextWallId();

      void run((context) => {
        const result = buildSplitWallCommand({ wallId, at, secondWallId }, context);

        return result.ok ? result.data : null;
      });
    },
    [gateway, run],
  );

  const onMerge = useCallback(
    (wallId: WallId, otherWallId: WallId) => {
      void run((context) => {
        const result = buildMergeWallsCommand({ wallId, otherWallId }, context);

        return result.ok ? result.data : null;
      });
    },
    [run],
  );

  /* ---------------------------------------------------------------------- */
  /* Hoàn tác — ngăn xếp 100 bước của S-06, KHÔNG phải zundo.                 */
  /* ---------------------------------------------------------------------- */

  const applyUndo = useCallback(() => {
    if (!canEdit) {
      return;
    }

    const transition = dispatchBundle.history.undo();

    if (transition === null) {
      return;
    }

    dispatchBundle.deps.spatial.applyPatches(transition.patches);
    setSelection(transition.selection.selectedIds);
    autosave.notifyChange();
    invalidate();
  }, [autosave, canEdit, dispatchBundle, invalidate, setSelection]);

  const onUndo = useCallback(() => {
    applyUndo();
  }, [applyUndo]);

  /* ---------------------------------------------------------------------- */
  /* Xoá (D-05) — tức thì, không hộp thoại, kèm vé hoàn tác 8000 ms.          */
  /* ---------------------------------------------------------------------- */

  const undoTicketRef = useRef<ReturnType<typeof createWallUndoTicket> | null>(null);
  const notifications = options.notifications ?? appNotificationBus;

  /*
   * Nháy nền một hàng — bật ở đây, và TỰ TẮT.
   *
   * Bản trước bật cờ đúng một chỗ (lượt hoàn tác sau khi xoá) và không có một
   * lượt gọi nào đưa nó về `null`, nên hàng đó sáng vĩnh viễn. Nay cả hai lối
   * vào của TT-02 đều bật nó — đổi độ dày và hoàn tác-sau-khi-xoá — và một hẹn
   * giờ ở nấc `'slow'` của thang chuyển động tắt nó (không một con số mili-giây
   * nào viết tay, R-71).
   */
  useEffect(() => {
    if (flashingWallId === null) {
      return undefined;
    }

    const timer = setTimeout(() => setFlashingWallId(null), durationMs('slow'));

    return () => clearTimeout(timer);
  }, [flashingWallId]);

  const onDelete = useCallback(
    (wallId: WallId) => {
      void run((context) => {
        const result = buildDeleteWallCommand({ wallId }, context);

        return result.ok ? result.data : null;
      }).then(() => {
        const ticket = createWallUndoTicket({
          wallId,
          now: gateway.now,
          undo: () => {
            applyUndo();
            /* Mục quay lại thì nháy nền — cờ do hook trả ra, view lo phần hiện. */
            setFlashingWallId(wallId);
          },
        });

        undoTicketRef.current = ticket;

        /*
         * A8: mọi thay đổi hoàn tác được, KÈM TOAST hoàn tác.
         *
         * Vé đã dựng đúng từ đầu, chỉ thiếu chỗ hiện. `NotificationHost` của
         * `src/main.tsx` vẽ bus này bằng `Toast.Item`, và nút "Hoàn tác" của nó
         * gọi thẳng `undoTicket.undo()` — tức đúng vé ở trên, chạy trên ngăn xếp
         * 100 bước của S-06. Cửa sổ tám giây do chính vé mang
         * (`UNDO_WINDOW_MS`), nên không có thời lượng nào phải truyền (R-71).
         *
         * `description` để rỗng có chủ đích: `NotificationHost` ghép tiêu đề với
         * mô tả bằng " — " khi hai câu khác nhau, và ở đây chỉ có MỘT câu.
         */
        notifications.publish({
          type: WALL_DELETE_NOTIFICATION_TYPE,
          title: ticket.description,
          description: '',
          undoTicket: ticket,
        });
      });
    },
    [applyUndo, gateway, notifications, run],
  );

  /* ---------------------------------------------------------------------- */
  /* Công cụ (S-08) — máy công cụ thật, không một bản sao thứ hai.            */
  /* ---------------------------------------------------------------------- */

  const toolContext = useMemo<ToolContext>(
    () => ({
      levelId: (levelId ?? NO_LEVEL_ID) as LevelId,
      settings: DEFAULT_TOOL_SETTINGS,
      nextId: <K extends EntityKind>(kind: K): IdByKind[K] =>
        (kind === 'wall' ? gateway.nextWallId() : createId(kind)) as IdByKind[K],
    }),
    [gateway, levelId],
  );

  const toolContextRef = useRef(toolContext);
  toolContextRef.current = toolContext;
  const levelRef = useRef(level);
  levelRef.current = level;

  /** Số đo ĐÃ CHỐT của công cụ đo; `null` cho tới khi có một lượt đo thật. */
  const [committedMeasurement, setCommittedMeasurement] =
    useState<WallLayerMeasurementPx | null>(null);

  /**
   * Một sự kiện của máy công cụ, và kết quả nó sinh ra.
   *
   * `reduceTool` thuần và không bao giờ ghi; kết quả `kind: 'command'` là con
   * đường DUY NHẤT từ thanh công cụ tới dữ liệu, và {@link toolOutcomeToCommand}
   * là chỗ tên lệnh thành hàm dựng lệnh thật (`wall.draw` →
   * `createDrawWallCommand`, `wall.split` → `createSplitWallCommand`). Kết quả
   * `kind: 'selection'` đi thẳng vào vùng chọn của S-10.
   */
  const runToolEvent = useCallback(
    (event: ToolEvent): ToolTransition => {
      const transition = reduceTool(toolStateRef.current, event, {
        tools: TOOLS,
        context: toolContextRef.current,
      });

      toolStateRef.current = transition.state;
      setToolState(transition.state);

      /* Đổi công cụ là bỏ cử chỉ đang dở — nhãn đo cũ đi theo nó. */
      if (event.type === 'activate' || event.type === 'cancel') {
        setCommittedMeasurement(null);
      }

      const outcome = transition.outcome;

      if (outcome === null) {
        return transition;
      }

      if (outcome.kind === 'selection') {
        const last = outcome.ids[outcome.ids.length - 1];

        onSelect(last === undefined ? null : (last as WallId));

        return transition;
      }

      /*
       * Một lượt đo KHÔNG phải một lệnh: nó không đổi bản vẽ, nên
       * `toolOutcomeToCommand` trả `null` cho nó và trước lượt sửa này kết quả
       * bị bỏ im lặng — đó là toàn bộ lý do `canvas.measurement` từng là `null`
       * cứng. Nay nó vào một `useState` và đi thẳng ra `MeasurementLabel`.
       */
      if (outcome.kind === 'measurement') {
        setCommittedMeasurement(
          measurementOutcomeToPx(outcome.measurement, scaleOfLevel(levelRef.current)),
        );

        return transition;
      }

      void run((context) => toolOutcomeToCommand(outcome, context));

      return transition;
    },
    [onSelect, run],
  );

  /**
   * Một bước đã điền, rồi CHỐT LUÔN khi cử chỉ đã đủ bước.
   *
   * `reduceTool` dừng ở `confirming` và chỉ phát kết quả khi nhận `commit`, vì
   * có công cụ cần một bước xác nhận. Ba công cụ của màn này thì không: vẽ
   * tường là hai lần bấm, tách đoạn là chọn tường rồi bấm chỗ cắt, đo là hai
   * lần bấm — lần bấm cuối CHÍNH LÀ lời xác nhận. Nên hook chốt trong cùng
   * lượt, và không có nút "xong" nào phải dựng ra chỉ để bấm.
   */
  const sendToolInput = useCallback(
    (value: ToolInputValue) => {
      const transition = runToolEvent({ type: 'input', value });

      if (transition.state.phase === 'confirming') {
        runToolEvent({ type: 'commit' });
      }
    },
    [runToolEvent],
  );

  sendToolInputRef.current = sendToolInput;

  const activateTool = useCallback(
    (tool: ToolId) => {
      runToolEvent({ type: 'activate', tool });
    },
    [runToolEvent],
  );

  /**
   * Canvas báo một điểm vừa bấm; máy công cụ nhận nó làm bước kế tiếp (NL-06,
   * NL-10, TT-10).
   *
   * Toạ độ vào ĐÃ là pixel bản vẽ (trình duyệt đổi giúp qua ma trận của
   * `<svg>`), và `reduceTool` làm việc bằng milimét công trình, nên ở đây có
   * đúng một phép quy đổi — `toMillimetrePoint`, tức `scale.pixelsToMillimetres`
   * của `src/domain/units/scale.ts`. Không một công thức hình học nào viết mới:
   * điểm cắt, chiều dài tường mới và khoảng cách đo đều do
   * `src/lib/tools/tools.ts` và `src/domain` tính.
   */
  const onCanvasPoint = useCallback(
    (at: WallLayerPointerReading) => {
      const currentLevel = levelRef.current;

      if (currentLevel === null) {
        return;
      }

      /* Bắt đầu một cử chỉ mới thì nhãn đo cũ nhường chỗ. */
      if (toolStateRef.current.values.length === 0) {
        setCommittedMeasurement(null);
      }

      sendToolInput({
        kind: 'point',
        at: toMillimetrePoint({ x: at.xPx, y: at.yPx }, scaleOfLevel(currentLevel)),
      });
    },
    [sendToolInput],
  );

  /* ---------------------------------------------------------------------- */
  /* Danh sách, thanh tra, hình canvas.                                       */
  /* ---------------------------------------------------------------------- */

  /* Trạng thái 4 nghe LỚP TƯỜNG, không nghe ảnh nền — xem khối hai lượt đọc trên. */
  const hasError = wallLayerQuery.isError;
  const isLoading = backgroundQuery.isPending || wallLayerQuery.isPending || graph === null;

  const counter = useMemo<WallReviewCounter>(
    () => ({
      reviewed: walls.filter((wall) => wall.reviewed).length,
      total: walls.length,
    }),
    [walls],
  );

  const visibleWalls = useMemo(() => applyWallFilters(walls, filters), [filters, walls]);

  const rows = useMemo<readonly WallRowViewModel[]>(
    () => (hasError ? NO_ROWS : visibleWalls.map(toWallRow)),
    [hasError, visibleWalls],
  );

  const shapes = useMemo<readonly WallLayerCanvasShape[]>(
    () => (level === null ? [] : toCanvasShapes(walls, level, wallStatusCode)),
    [level, walls],
  );

  const inspector = useMemo(() => {
    if (selectedWallId === null || level === null) {
      return null;
    }

    const wall = wallById(selectedWallId);

    return wall === null ? null : toWallInspector(wall, level);
  }, [level, selectedWallId, wallById]);

  /* Bộ đếm chạy 12 → 13 ở nấc `standard` (260 ms) — xem ghi chú đầu file. */
  const reviewedCount = useCountUp(counter.reviewed, { format: { fractionDigits: 0 } });
  const progressLabel = reviewProgressLabel(reviewedCount.text, counter.total);

  const state = deriveScreenState({ isViewerRole, isCollapsed, hasError, isLoading, counter });

  const errorMessage = useMemo(() => {
    if (!hasError) {
      return null;
    }

    return describeError(toAppError(wallLayerQuery.error)).description;
  }, [hasError, wallLayerQuery.error]);

  /* ---------------------------------------------------------------------- */
  /* Phím tắt (I-01) — không một `addEventListener` nào ở đây (R-72).         */
  /* ---------------------------------------------------------------------- */

  const shortcutOptions = useMemo(
    () => (options.registry === undefined ? {} : { registry: options.registry }),
    [options.registry],
  );

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const selectedRef = useRef(selectedWallId);
  selectedRef.current = selectedWallId;

  const step = useCallback(
    (direction: 1 | -1) => {
      const target = neighbourWallId(rowsRef.current, selectedRef.current, direction);

      if (target !== null) {
        onSelect(target);
      }
    },
    [onSelect],
  );

  useShortcut(
    {
      id: 'wallLayerReview.next',
      combo: 'J',
      scope: 'canvas',
      description: WALL_LAYER_TEXT.shortcutNext,
      onTrigger: () => step(1),
    },
    shortcutOptions,
  );
  useShortcut(
    {
      id: 'wallLayerReview.previous',
      combo: 'K',
      scope: 'canvas',
      description: WALL_LAYER_TEXT.shortcutPrevious,
      onTrigger: () => step(-1),
    },
    shortcutOptions,
  );
  useShortcut(
    {
      id: 'wallLayerReview.delete',
      combo: 'Backspace',
      scope: 'canvas',
      description: WALL_LAYER_TEXT.shortcutDelete,
      onTrigger: () => {
        if (selectedRef.current !== null) {
          onDelete(selectedRef.current);
        }
      },
    },
    { ...shortcutOptions, enabled: canEdit },
  );
  useShortcut(
    {
      id: 'wallLayerReview.undo',
      combo: 'Mod+Z',
      scope: 'canvas',
      description: WALL_LAYER_TEXT.shortcutUndo,
      onTrigger: onUndo,
    },
    { ...shortcutOptions, enabled: canEdit },
  );

  const thicknessRef = useRef(onChangeThickness);
  thicknessRef.current = onChangeThickness;

  const setThickness = useCallback((choice: WallThicknessChoice) => {
    if (selectedRef.current !== null) {
      thicknessRef.current(selectedRef.current, choice);
    }
  }, []);

  useShortcut(
    {
      id: 'wallLayerReview.thickness.1',
      combo: '1',
      scope: 'canvas',
      description: WALL_LAYER_TEXT.shortcutThickness,
      onTrigger: () => setThickness(WALL_LAYER_THICKNESS_CHOICES[0] as WallThicknessChoice),
    },
    { ...shortcutOptions, enabled: canEdit },
  );
  useShortcut(
    {
      id: 'wallLayerReview.thickness.2',
      combo: '2',
      scope: 'canvas',
      description: WALL_LAYER_TEXT.shortcutThickness,
      onTrigger: () => setThickness(WALL_LAYER_THICKNESS_CHOICES[1] as WallThicknessChoice),
    },
    { ...shortcutOptions, enabled: canEdit },
  );
  useShortcut(
    {
      id: 'wallLayerReview.thickness.3',
      combo: '3',
      scope: 'canvas',
      description: WALL_LAYER_TEXT.shortcutThickness,
      onTrigger: () => setThickness(WALL_LAYER_THICKNESS_CHOICES[2] as WallThicknessChoice),
    },
    { ...shortcutOptions, enabled: canEdit },
  );

  useShortcut(
    {
      id: 'wallLayerReview.tool.select',
      combo: shortcutForTool('select'),
      scope: 'canvas',
      description: WALL_LAYER_TEXT.shortcutTool,
      onTrigger: () => activateTool('select'),
    },
    shortcutOptions,
  );
  useShortcut(
    {
      id: 'wallLayerReview.tool.drawWall',
      combo: shortcutForTool('drawWall'),
      scope: 'canvas',
      description: WALL_LAYER_TEXT.shortcutTool,
      onTrigger: () => activateTool('drawWall'),
    },
    { ...shortcutOptions, enabled: canEdit },
  );
  useShortcut(
    {
      id: 'wallLayerReview.tool.measure',
      combo: shortcutForTool('measure'),
      scope: 'canvas',
      description: WALL_LAYER_TEXT.shortcutTool,
      onTrigger: () => activateTool('measure'),
    },
    shortcutOptions,
  );

  /* ---------------------------------------------------------------------- */
  /* Ray công cụ và thanh trạng thái.                                        */
  /* ---------------------------------------------------------------------- */

  const selectedWallIds = useMemo(
    () => selectedIds.filter((id) => walls.some((wall) => wall.id === id)),
    [selectedIds, walls],
  );
  const mergePair = selectedWallIds.length === 2 ? selectedWallIds : null;

  const onSelectTool = useCallback(
    (tool: WallLayerToolId) => {
      activateTool(tool);
    },
    [activateTool],
  );

  const onMergeSelection = useCallback(() => {
    if (mergePair !== null) {
      onMerge(mergePair[0] as WallId, mergePair[1] as WallId);
    }
  }, [mergePair, onMerge]);

  /**
   * Ray công cụ, đúng hợp đồng điều phối viên chốt.
   *
   * `canMerge` là "đã chọn >= 2 tường" CỘNG quyền sửa: ở vai Người xem nút phải
   * tắt dù có chọn đủ hai đoạn, vì mọi hàm sửa đã bị vô hiệu ở tầng hook. A2 —
   * một nút bấm được mà không có tác dụng là thứ A2 tồn tại để chặn.
   */
  const toolRail = useMemo<WallLayerToolRailProps>(
    () => ({
      activeTool: railToolOf(toolState.tool),
      onSelectTool,
      canMerge: canEdit && mergePair !== null,
      onMerge: onMergeSelection,
      readOnly: isViewerRole,
      isCollapsed,
      onToggleCollapsed,
    }),
    [
      canEdit,
      isCollapsed,
      isViewerRole,
      mergePair,
      onMergeSelection,
      onSelectTool,
      onToggleCollapsed,
      toolState.tool,
    ],
  );

  /* ---------------------------------------------------------------------- */
  /* Giá trị ra.                                                             */
  /* ---------------------------------------------------------------------- */

  /* ---------------------------------------------------------------------- */
  /* Hợp đồng mở rộng của lớp canvas — mọi toạ độ đã là pixel bản vẽ.         */
  /* ---------------------------------------------------------------------- */

  const prefersReducedMotion = useReducedMotion();
  const zoom = useStore((current) => current.zoom);
  const viewCenter = useStore((current) => current.viewCenter);
  const hiddenLayers = useStore((current) => current.hiddenLayers);

  const isWallLayerVisible = !hiddenLayers.includes('wall');
  const toggleLayerVisibility = useStore((current) => current.toggleLayerVisibility);

  /**
   * Bật/tắt lớp Tường của cây lớp (BC-19).
   *
   * View KHÔNG gọi thẳng kho (R-60): cờ sống ở `viewSlice.hiddenLayers` và đi
   * ra qua đúng hàm này. Chú giải độ dày đọc cùng cờ đó, nên câu "chú giải luôn
   * hiện KHI LỚP TƯỜNG BẬT" giữ được cả hai vế.
   */
  const onToggleWallLayer = useCallback(() => {
    toggleLayerVisibility('wall');
  }, [toggleLayerVisibility]);

  /*
   * Tim tường: hành vi cũ là GIÁ TRỊ KHỞI TẠO, người dùng đè lên được (BC-17).
   *
   * `null` nghĩa là "chưa ai đè", nên bật công cụ vẽ/tách vẫn tự hiện tim tường
   * như trước; một lượt bấm ô đánh dấu ghim lấy câu trả lời của người dùng.
   */
  const [centrelineOverride, setCentrelineOverride] = useState<boolean | null>(null);
  const showCentrelines =
    centrelineOverride ?? (toolState.tool === 'drawWall' || toolState.tool === 'splitWall');
  const showCentrelinesRef = useRef(showCentrelines);
  showCentrelinesRef.current = showCentrelines;

  const onToggleCentrelines = useCallback(() => {
    setCentrelineOverride(!showCentrelinesRef.current);
  }, []);

  /** Danh sách tầng cho khối điều hướng của panel trái (BC-05). */
  const floors = useMemo(
    () =>
      levelsOf(graph).map((item) => ({
        id: item.id,
        label: item.name,
        isCurrent: item.id === levelId,
      })),
    [graph, levelId],
  );

  const drawingSizePx = useMemo<WallLayerSizePx | null>(
    () => drawingSizeOf(background ?? undefined, level),
    [background, level],
  );

  const contentBoundsPx = useMemo<WallLayerRectPx | null>(
    () => unionOfBounds(shapes.map((shape) => shape.boundsPx)),
    [shapes],
  );

  /*
   * Khung nhìn: tâm nhìn của kho, đọc bằng pixel bản vẽ, cộng mức phóng.
   *
   * Nay là đường HAI CHIỀU: kho vẫn quyết những gì canvas vẽ, nhưng cụm thu
   * phóng, phím `F` và bản đồ nhỏ đã lái ngược được qua `setZoom`/`setViewCenter`
   * (xem khối "Lái khung nhìn" ngay dưới).
   */
  const viewport = useMemo<WallLayerViewportPx>(() => {
    const centre = toPixelPoint(viewCenter, scaleOfLevel(level));

    return { x: centre.x, y: centre.y, zoom };
  }, [level, viewCenter, zoom]);

  const legendLevels = useMemo(() => legendLevelsOf(walls), [walls]);

  /* ---------------------------------------------------------------------- */
  /* Lái khung nhìn: cụm thu phóng, phím F, bản đồ nhỏ.                       */
  /* ---------------------------------------------------------------------- */

  /*
   * Trước lượt gộp này, `ZoomCluster` và `MiniMap` được dựng TRẦN trong canvas:
   * bấm được, không đổi được gì. Người duyệt đã chấp thuận một ngoại lệ R-68 để
   * hai component đó nhận props, nên bốn nút và bản đồ nhỏ giờ nối vào đúng
   * `zoom`/`viewCenter` của kho — cùng hai trường mà `viewport` ở trên đọc ra.
   *
   * Khổ khung do canvas báo lên (`onFrameResize`): "vừa khung" không tính được
   * nếu không biết khung rộng bao nhiêu, và khung là thứ chỉ view đo được.
   */

  const setZoom = useStore((current) => current.setZoom);
  const setViewCenter = useStore((current) => current.setViewCenter);

  const [frameSizePx, setFrameSizePx] = useState<WallLayerSizePx | null>(null);

  const onFrameResize = useCallback((size: WallLayerSizePx) => {
    setFrameSizePx((previous) =>
      previous !== null && previous.width === size.width && previous.height === size.height
        ? previous
        : size,
    );
  }, []);

  const onZoomIn = useCallback(() => {
    setZoom(clampZoom(zoom + ZOOM_STEP));
  }, [setZoom, zoom]);

  const onZoomOut = useCallback(() => {
    setZoom(clampZoom(zoom - ZOOM_STEP));
  }, [setZoom, zoom]);

  const onResetZoom = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
  }, [setZoom]);

  /** Hộp mà phím `F` phủ: tường đang chọn nếu có, không thì cả lớp tường. */
  const fitBoundsPx = useMemo<WallLayerRectPx | null>(() => {
    if (selectedWallId !== null) {
      const selected = shapes.find((shape) => shape.id === selectedWallId);

      if (selected !== undefined) {
        return selected.boundsPx;
      }
    }

    return contentBoundsPx;
  }, [contentBoundsPx, selectedWallId, shapes]);

  /**
   * "Vừa khung" (nút bốn mũi tên và phím `F`) — phủ khắp vùng đang chọn.
   *
   * Đổi CẢ mức phóng lẫn tâm nhìn. Không có gì để phủ (chưa có tường, hoặc khung
   * chưa đo xong) thì KHÔNG làm gì — nhảy về một khung nhìn bịa còn tệ hơn là
   * đứng yên.
   */
  const onFitToScreen = useCallback(() => {
    if (fitBoundsPx === null) {
      return;
    }

    const nextZoom = fitZoomFor(frameSizePx, fitBoundsPx);

    if (nextZoom !== null) {
      setZoom(nextZoom);
    }

    setViewCenter(toMillimetrePoint(centreOfBounds(fitBoundsPx), scaleOfLevel(level)));
  }, [fitBoundsPx, frameSizePx, level, setViewCenter, setZoom]);

  /** Bản đồ nhỏ: kéo hoặc bấm một chỗ thì tâm nhìn đi theo. */
  const onMiniMapViewportChange = useCallback(
    (rect: WallLayerViewportRectPercent) => {
      if (drawingSizePx === null) {
        return;
      }

      setViewCenter(miniMapCentreMm(rect, drawingSizePx, scaleOfLevel(level)));
    },
    [drawingSizePx, level, setViewCenter],
  );

  /*
   * Vùng nhìn ban đầu của bản đồ nhỏ, phần trăm khổ bản vẽ.
   *
   * `MiniMap` giữ vùng nhìn của riêng nó sau lượt đầu (`useMiniMap` là kho cục
   * bộ của component), nên đây đúng là giá trị KHỞI TẠO chứ không phải một điều
   * khiển có chủ — tên prop của component nói thẳng như vậy (`initialViewport`).
   */
  const miniMapViewport = MINIMAP_INITIAL_VIEWPORT;

  /*
   * Phím `F` — phủ khắp vùng đang chọn.
   *
   * Bản đầu của file này cố ý KHÔNG đăng ký `F`: hợp đồng canvas lúc đó không có
   * đường ra nào cho nó, và một phím tắt không làm gì là đúng thứ A2/R-73 chặn.
   * Nay `onFitToScreen` là một đường ra thật, nên phím được đăng ký.
   *
   * `Space` (giữ để tạm kéo khung nhìn) VẪN chưa được đăng ký, và vì đúng lý do
   * cũ: kéo khung nhìn cần lớp canvas theo dõi cả một cử chỉ kéo, thứ hợp đồng
   * canvas không có chỗ nhận. Ghi vào mục việc còn nợ, không dựng một phím câm.
   */
  useShortcut(
    {
      id: 'wallLayerReview.fitToScreen',
      combo: 'F',
      description: WALL_LAYER_TEXT.shortcutFit,
      scope: 'canvas',
      onTrigger: onFitToScreen,
    },
    shortcutOptions,
  );

  /* ---------------------------------------------------------------------- */
  /* Thanh trạng thái — ba chuỗi ĐÃ định dạng, view không tính gì (A15).      */
  /* ---------------------------------------------------------------------- */

  const [pointerReading, setPointerReading] = useState<WallLayerPointerReading | null>(null);

  /**
   * Canvas báo lên toạ độ ĐÃ là pixel bản vẽ (trình duyệt đổi giúp qua ma trận
   * của `<svg>`); `cursorLabelOf` chỉ còn quy px → mm và định dạng. Đây là cách
   * thanh trạng thái có toạ độ THẬT mà thư mục màn vẫn không có một phép chia
   * quy đổi đơn vị nào (`local/no-raw-number`).
   */
  const onPointerMove = useCallback((reading: WallLayerPointerReading | null) => {
    setPointerReading(reading);
  }, []);

  /**
   * Nhãn đo của canvas: đang đo thì đi theo con trỏ, đo xong thì đứng yên.
   *
   * Vế "đang đo" DẪN XUẤT từ chính máy công cụ — một điểm đã chấm cộng vị trí
   * con trỏ hiện tại — nên không có bản sao trạng thái thứ hai để lệch. Vế "đã
   * chốt" là kết quả `kind: 'measurement'` mà `runToolEvent` vừa cất. Khoảng
   * cách của cả hai vế đều do `measureDistance` của `src/domain/measure` tính.
   */
  const measurement = useMemo<WallLayerMeasurementPx | null>(() => {
    if (toolState.tool === 'measure' && toolState.values.length === 1 && pointerReading !== null) {
      const first = toolState.values[0];

      if (first !== undefined && first.kind === 'point') {
        const scale = scaleOfLevel(level);

        return toMeasurementPx(
          first.at,
          toMillimetrePoint({ x: pointerReading.xPx, y: pointerReading.yPx }, scale),
          scale,
          'measuring',
        );
      }
    }

    return committedMeasurement;
  }, [committedMeasurement, level, pointerReading, toolState.tool, toolState.values]);

  const statusBar = useMemo<WallLayerStatusBarProps>(
    () => ({
      cursorLabel: cursorLabelOf(pointerReading, scaleOfLevel(level)),
      scaleLabel: formatScaleLabel(level),
      saveLabel: saveIndicator.label,
    }),
    [level, pointerReading, saveIndicator.label],
  );

  /** Menu chuột phải "Đổi độ dày": đưa tường vào thanh tra, nơi có ba lựa chọn. */
  const onRequestThicknessChange = useCallback(
    (wallId: WallId) => {
      onSelect(wallId);
    },
    [onSelect],
  );

  /**
   * Menu chuột phải "Tách đoạn": chọn tường, bật công cụ, và ĐIỀN LUÔN bước
   * đầu.
   *
   * Người dùng vừa chỉ đúng tường cần tách, nên bắt họ bấm lại lần nữa để trả
   * lời bước `entity` là hỏi một câu đã có câu trả lời. Sau lượt này máy công
   * cụ chỉ còn chờ điểm cắt, và một lần bấm trên canvas là tách xong.
   */
  const onRequestSplit = useCallback(
    (wallId: WallId) => {
      onSelect(wallId);
      activateTool('splitWall');
      sendToolInput({ kind: 'entity', id: wallId });
    },
    [activateTool, onSelect, sendToolInput],
  );

  const onToggleFilter = useCallback((filter: WallLayerFilterKey) => {
    setFilters((previous) => ({ ...previous, [filter]: !previous[filter] }));
  }, []);

  const panel: WallLayerViewProps = {
    state,
    rows,
    reviewCounter: counter,
    reviewProgressLabel: progressLabel,
    filters,
    thicknessChoices: WALL_LAYER_THICKNESS_CHOICES,
    selectedWallId,
    hoveredWallId: hoveredId as WallId | null,
    inspector,
    isCompact: isCollapsed,
    isCollapsed,
    isViewerRole,
    viewerRoleNotice: isViewerRole ? WALL_LAYER_TEXT.viewerRoleNotice : null,
    emptyNotice: state === 'empty' ? WALL_LAYER_TEXT.emptyNotice : null,
    errorMessage,
    onApprove,
    onSkip,
    onChangeThickness,
    onDelete,
    onSplit,
    onMerge,
    onSelect,
    onHover,
    onToggleFilter,
    onUndo,
    onToggleCollapsed,
  };

  const canvas: WallLayerCanvasViewProps = {
    shapes,
    selectedWallId,
    hoveredWallId: (hoveredId as WallId | null) ?? null,
    showCentrelines,
    millimetresPerPixel: level?.scaleMillimetresPerPixel ?? UNCALIBRATED_SCALE,
    /*
     * BT-06/BT-07: ở trạng thái `error` canvas VẪN xem được ảnh gốc. `background`
     * là lượt đọc thành công gần nhất, nên một lượt đọc hỏng sau đó không xoá
     * mất bản vẽ mà kỹ sư đang đối chiếu.
     */
    backgroundImageUrl: background?.imageUrl ?? null,
    backgroundImageAlt: background?.imageAlt ?? '',
    isInteractive: canEdit,
    onSelect,
    onHover,

    /* -- Hợp đồng mở rộng của lớp canvas (T7) ------------------------------ */
    state,
    canvasLabel: canvasLabelOf(level, counter.total),
    viewport,
    drawingSizePx,
    contentBoundsPx,
    isWallLayerVisible,
    legendLevels,
    measurement,
    prefersReducedMotion,
    onApprove,
    onRequestThicknessChange,
    onRequestSplit,
    onDelete,

    /* -- Khung nhìn lái ngược được (T8) ---------------------------------- */
    zoomPercent: zoomPercentOf(zoom),
    onZoomIn,
    onZoomOut,
    onResetZoom,
    onFitToScreen,
    miniMapViewport,
    onMiniMapViewportChange,
    onFrameResize,
    onPointerMove,
    onCanvasPoint,
    onToggleSelect,
  };

  const leftPanel: WallLayerLeftPanelExtras = {
    floors,
    showCentrelines,
    onToggleCentrelines,
    isWallLayerVisible,
    onToggleWallLayer,
    flashingWallId,
    onToggleSelect,
  };

  return { panel, canvas, toolRail, statusBar, leftPanel };
}

/** Cổng có dữ liệu, xuất lại để story và bài kiểm cắm vào cùng một chỗ (R-73). */
export { createMockWallLayerReviewGateway, normalizeSpatial };
