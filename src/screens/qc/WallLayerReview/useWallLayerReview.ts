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
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useSaveIndicator } from '@/hooks/useSaveIndicator';
import { useShortcut } from '@/hooks/useShortcut';
import { createAutosave, type Autosave } from '@/lib/autosave/createAutosave';
import { can } from '@/lib/auth/permissions';
import { describeError, toAppError } from '@/lib/errors';
import type { ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import { createSelectionChannel } from '@/lib/selection/syncChannel';
import { planReveals, revealAnchor, describeSelection } from '@/lib/selection/revealPolicy';
import { selectSingle, type SelectionContext } from '@/lib/selection/selectionOps';
import { applyInvalidation } from '@/lib/query/invalidation';
import { queryKeys } from '@/lib/query/queryKeys';
import { shortcutForTool } from '@/lib/tools/shortcuts';
import { createToolState, reduceTool, DEFAULT_TOOL_SETTINGS } from '@/lib/tools/toolMachine';
import type { ToolContext, ToolEvent, ToolId, ToolMachineState } from '@/lib/tools/toolMachine';
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
  toMillimetrePoint,
  toPixelPoint,
  unionOfBounds,
  wallStatusCode,
  zoomPercentOf,
  WALL_LAYER_THICKNESS_CHOICES,
  ZOOM_STEP,
  type WallLayerCanvasShape,
  type WallLayerGraphPort,
  type WallLayerPointerReading,
  type WallLayerRectPx,
  type WallLayerReviewGateway,
  type WallLayerSizePx,
  type WallLayerViewportPx,
  type WallLayerViewportRectPercent,
} from './wallLayerReviewGateway';
import type { WallLayerStatusBarProps } from './WallLayerStatusBar';
import type { WallLayerCanvasViewProps } from './wallLayerHatch';
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
  emptyNotice:
    'Chưa phát hiện được đoạn tường nào ở tầng này. Kiểm tra lại bản vẽ gốc hoặc chạy lại bước tách lớp tường.',
  viewerRoleNotice:
    'Bạn đang xem với vai Người xem nên không duyệt hay sửa được lớp tường. Xin quyền Kỹ sư từ chủ dự án để chỉnh sửa.',
  mergeLabel: 'nối đoạn',
  mergeDescription: 'Nối hai đoạn tường đang chọn thành một.',
  shortcutNext: 'Xuống tường tiếp theo.',
  shortcutPrevious: 'Lên tường phía trên.',
  shortcutApprove: 'Duyệt đoạn tường đang chọn.',
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

/** Đúng hợp đồng đã đóng băng, cộng ba nhóm thoả thuận thêm với hai worker view. */
export interface UseWallLayerReviewResult extends WallLayerReviewProps {
  readonly canvas: WallLayerCanvasViewProps;
  readonly toolRail: WallLayerToolRailProps;
  readonly statusBar: WallLayerStatusBarProps;
}

/* -------------------------------------------------------------------------- */
/* Hằng của riêng hook.                                                        */
/* -------------------------------------------------------------------------- */

/** Ba cờ lọc lúc mở màn: chưa lọc gì. */
const NO_FILTERS: WallLayerFilters = {
  onlyUnreviewed: false,
  onlyLowConfidence: false,
  onlyNonStandardThickness: false,
};

const NO_WALLS: readonly Wall[] = [];

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
  const isCollapsed = options.forceCollapsed ?? ownCollapsed;

  /* ---------------------------------------------------------------------- */
  /* Ảnh nền — dữ liệu máy chủ duy nhất của màn (R-64).                       */
  /* ---------------------------------------------------------------------- */

  const backgroundQuery = useQuery({
    queryKey: queryKeys.drawing.byFloor(floorId),
    queryFn: ({ signal }) => gateway.readBackground({ floorId, projectId, signal }),
  });

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

  const onSelect = useCallback(
    (wallId: WallId | null) => {
      if (wallId === null) {
        selectionBeforeRef.current = selectionSnapshotRef.current;
        setSelection([]);
        channel.push([]);

        return;
      }

      const context = selectionContext;
      const next =
        context === null ? [wallId] : selectSingle(selectionSnapshotRef.current, wallId, context);

      selectionBeforeRef.current = selectionSnapshotRef.current;
      setSelection(next);
      /* S-11: một lượt đẩy cho cả canvas và danh sách, gộp trong một khung hình. */
      channel.push(next);
    },
    [channel, selectionContext, setSelection],
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

  const [flashingWallId, setFlashingWallId] = useState<WallId | null>(null);
  const undoTicketRef = useRef<ReturnType<typeof createWallUndoTicket> | null>(null);

  const onDelete = useCallback(
    (wallId: WallId) => {
      void run((context) => {
        const result = buildDeleteWallCommand({ wallId }, context);

        return result.ok ? result.data : null;
      }).then(() => {
        undoTicketRef.current = createWallUndoTicket({
          wallId,
          now: gateway.now,
          undo: () => {
            applyUndo();
            /* Mục quay lại thì nháy nền — cờ do hook trả ra, view lo phần hiện. */
            setFlashingWallId(wallId);
          },
        });
      });
    },
    [applyUndo, gateway, run],
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

  const toolStateRef = useRef(toolState);
  toolStateRef.current = toolState;
  const toolContextRef = useRef(toolContext);
  toolContextRef.current = toolContext;

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
    (event: ToolEvent) => {
      const transition = reduceTool(toolStateRef.current, event, {
        tools: TOOLS,
        context: toolContextRef.current,
      });

      toolStateRef.current = transition.state;
      setToolState(transition.state);

      const outcome = transition.outcome;

      if (outcome === null) {
        return;
      }

      if (outcome.kind === 'selection') {
        const last = outcome.ids[outcome.ids.length - 1];

        onSelect(last === undefined ? null : (last as WallId));

        return;
      }

      void run((context) => toolOutcomeToCommand(outcome, context));
    },
    [onSelect, run],
  );

  const activateTool = useCallback(
    (tool: ToolId) => {
      runToolEvent({ type: 'activate', tool });
    },
    [runToolEvent],
  );

  /* ---------------------------------------------------------------------- */
  /* Danh sách, thanh tra, hình canvas.                                       */
  /* ---------------------------------------------------------------------- */

  const hasError = backgroundQuery.isError;
  const isLoading = backgroundQuery.isPending || graph === null;

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

    return describeError(toAppError(backgroundQuery.error)).description;
  }, [backgroundQuery.error, hasError]);

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
    }),
    [canEdit, isViewerRole, mergePair, onMergeSelection, onSelectTool, toolState.tool],
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

  const drawingSizePx = useMemo<WallLayerSizePx | null>(
    () => drawingSizeOf(backgroundQuery.data, level),
    [backgroundQuery.data, level],
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

  /** Menu chuột phải "Tách đoạn": chọn tường rồi bật đúng công cụ tách đoạn. */
  const onRequestSplit = useCallback(
    (wallId: WallId) => {
      onSelect(wallId);
      activateTool('splitWall');
    },
    [activateTool, onSelect],
  );

  const onToggleFilter = useCallback((filter: WallLayerFilterKey) => {
    setFilters((previous) => ({ ...previous, [filter]: !previous[filter] }));
  }, []);

  const onToggleCollapsed = useCallback(() => {
    setOwnCollapsed((previous) => !previous);
  }, []);

  const panel: WallLayerViewProps = {
    state,
    rows,
    reviewCounter: counter,
    reviewProgressLabel: progressLabel,
    filters,
    thicknessChoices: WALL_LAYER_THICKNESS_CHOICES,
    selectedWallId,
    hoveredWallId: (hoveredId as WallId | null) ?? flashingWallId,
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
    showCentrelines: toolState.tool === 'drawWall' || toolState.tool === 'splitWall',
    millimetresPerPixel: level?.scaleMillimetresPerPixel ?? UNCALIBRATED_SCALE,
    backgroundImageUrl: backgroundQuery.data?.imageUrl ?? null,
    backgroundImageAlt: backgroundQuery.data?.imageAlt ?? '',
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
    /*
     * Công cụ đo chưa chạy được từ màn này: `WallLayerCanvasProps` đã đóng băng
     * không có hàm xử lý con trỏ nào, nên không cử chỉ đo nào tới được máy công
     * cụ. `null` là câu trả lời THẬT — một nhãn đo bịa ra sẽ là một số đo không
     * ai đo (R-69).
     */
    measurement: null,
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
  };

  return { panel, canvas, toolRail, statusBar };
}

/** Cổng có dữ liệu, xuất lại để story và bài kiểm cắm vào cùng một chỗ (R-73). */
export { createMockWallLayerReviewGateway, normalizeSpatial };
