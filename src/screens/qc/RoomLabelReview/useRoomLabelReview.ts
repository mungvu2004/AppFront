/**
 * Nửa "suy nghĩ" của màn S-17 "Duyệt tên phòng" — nơi cổng dữ liệu
 * (`roomLabelReviewGateway.ts`) gặp hợp đồng kiểu (`roomLabelTypes.ts`).
 *
 * View của màn thuần và kiểm được chỉ từ props (mục D của CLAUDE.md); mọi phép
 * đọc, mọi lượt ghi, mọi con số thành chuỗi đều xảy ra ở đây hoặc ở cổng, KHÔNG
 * ở view.
 *
 * ## Bảy thứ file này chịu trách nhiệm
 *
 * 1. **Hai lượt đọc máy chủ TÁCH BẠCH (R-64)** — ảnh nền dưới
 *    `queryKeys.drawing.byFloor`, lớp phòng dưới `queryKeys.room.byFloor`.
 *    `isLoading`/`error` do `@tanstack/react-query` giữ; file này KHÔNG có một
 *    `useState` nào cho hai thứ đó (CLAUDE.md gọi `useShareLinks.ts` là ngoại
 *    lệ đi trước, "không phải khuôn mẫu để chép").
 * 2. **Bảy trạng thái (A11/R-63)** — {@link deriveRoomLabelScreenState}, một
 *    hàm thuần kiểm được không cần dựng hook.
 * 3. **Diện tích CHỈ tính lại khi HÌNH HỌC đổi.** Đổi tên một phòng không đụng
 *    tới `measureRoom`: bộ nhớ đệm khoá theo ranh phòng, xem
 *    {@link outlineKeyOf} và khối "Đo phòng" bên dưới. Bài kiểm khẳng định
 *    bằng ĐỒNG NHẤT THAM CHIẾU (`toBe`) chứ không bằng chuỗi bằng nhau, nên
 *    một lượt tính lại lén cũng lộ.
 * 4. **Chuẩn hoá tên luôn XEM TRƯỚC rồi mới áp** — `onOpenNormalizePreview`
 *    dựng bảng và KHÔNG đổi gì; chỉ `onApplyNormalize` mới phát lệnh.
 * 5. **Mọi lượt ghi kèm vé hoàn tác tám giây (A8)** — một lệnh, một mục trong
 *    ngăn xếp 100 bước của S-06, một toast mang `UNDO_WINDOW_MS` do chính vé
 *    giữ (R-71: con số không viết lại ở đây).
 * 6. **Tự lưu (A7)** — `createAutosave` gọi `gateway.persistRoomLabels`; khả
 *    năng đó chưa có endpoint nên lượt lưu NÉM, và thanh trạng thái của vỏ ứng
 *    dụng nói ra sự thật thay vì hiện "Đã lưu lúc…" cho một lượt chưa rời máy.
 * 7. **Nhắc công năng M-14 không bao giờ CHẶN** — `notices` chỉ đi kèm từng
 *    dòng phòng; không một hàm `on…` nào dưới đây hỏi `notices` trước khi chạy.
 *
 * ## Bốn quyết định đáng ghi
 *
 * - **Bộ lọc "Chưa đặt tên" thu hẹp `rooms`, và trạng thái đọc theo `rooms`.**
 *   Bất biến #1 của hợp đồng (`state === 'empty'` ⟺ `rooms.length === 0` ⟺
 *   `emptyNotice !== null`) nói về CHÍNH mảng `rooms` mà view nhận, nên khi bộ
 *   lọc lọc sạch danh sách thì màn đúng là rỗng — và `emptyNotice` nói ra lý do
 *   thứ hai ("bộ lọc đang bật") kèm bước đi tiếp, thay vì để người duyệt nhìn
 *   một danh sách trắng không lời giải thích. `summary` thì luôn đếm TOÀN BỘ
 *   phòng của tầng: nó là dòng tóm tắt của tầng, không phải của bộ lọc.
 * - **Một lượt ghi phòng làm mất hiệu lực đúng ba khoá `editWall` liệt kê.**
 *   `WRITE_OPERATIONS` (`src/lib/query/invalidation.ts`) không có mục nào tên
 *   `editRoom`, và thêm một mục là sửa `src/lib` — ngoài phạm vi của màn. Ba
 *   khoá `editWall` làm mất hiệu lực (`space.byFloor`, `room.byFloor`,
 *   `violation.byProject`) đúng bằng ba thứ một lượt đổi tên/gộp/tách phòng
 *   làm cũ đi, nên đây là lượt gọi ĐÚNG dưới một cái tên hẹp hơn thực tế.
 * - **Điều hướng đi qua `onNavigate` tiêm được, không phải `useNavigate`.**
 *   Hook phải dựng được trong `renderHook` mà không cần một `<MemoryRouter>`;
 *   đường dẫn thì luôn ghép bằng `ROUTES` (R-65), không một chuỗi `/…` thô nào.
 * - **`isCompact` do nơi gọi quyết.** Repo chưa có hook truy vấn media nào và
 *   viết thẳng `1024` ở đây là đúng thứ R-71 cấm, nên hook nhận `forceCompact`
 *   và mặc định đi theo `isCollapsed` — cùng cách `useWallLayerReview` đã chốt.
 *
 * ## Ba cảnh báo của `roomLabelTypes.ts` đã được trả lời ở tầng cổng
 *
 * Cả ba (không có lệnh duyệt phòng; gộp/tách thiếu hình học; chưa có phép chuẩn
 * hoá tên) đã được điều phối viên phán quyết và cài trong
 * `roomLabelReviewGateway.ts` — `buildApproveRoomCommand`,
 * `buildMergeRoomCommand`/`buildSplitRoomCommandFromWalls`,
 * `buildNormalizePreview`. File này chỉ GỌI chúng; không một đường ghi tắt nào
 * đặt `reviewed: true` và không một công thức hình học nào viết ở đây (R-61).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { computeCentroid, explainRoom, outlineContains } from '@/domain/rooms/area';
import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import type {
  EntityId,
  Level,
  LevelId,
  Point,
  Room,
  RoomId,
  RoomUsage,
  Wall,
} from '@/domain/spatial/types';
import { millimetresPerPixel } from '@/domain/units/scale';
import { appNotificationBus } from '@/hooks/useNotifications';
import { createAutosave, type Autosave } from '@/lib/autosave/createAutosave';
import { can } from '@/lib/auth/permissions';
import { toPoint, toPointMm, type CommandContext } from '@/lib/commands/business/shared';
import type { Command } from '@/lib/commands/types';
import { describeError } from '@/lib/errors/describeError';
import { toAppError } from '@/lib/errors/toAppError';
import type { NotificationBus } from '@/lib/mutations/notificationBus';
import { applyInvalidation } from '@/lib/query/invalidation';
import { queryKeys } from '@/lib/query/queryKeys';
import { ROUTES } from '@/routes/paths';
import { useStore } from '@/store';
import type { ProjectRole } from '@/types/project';

import {
  buildApproveRoomCommand,
  buildChangeUsageCommand,
  buildMergeRoomCommand,
  buildNormalizeNamesCommand,
  buildNormalizePreview,
  buildRenameRoomCommand,
  buildSplitRoomCommandFromWalls,
  commandContextOf,
  createMockRoomLabelReviewGateway,
  createRoomLabelDispatchDeps,
  createRoomLabelReviewGateway,
  createRoomLabelUndoTicket,
  detectRoomsOfLevel,
  gapsOf,
  levelOf,
  measureRoom,
  noticesOfRoom,
  roomCodeLabel,
  roomsOfLevel,
  runRoomCommand,
  runRoomRules,
  scaleOfLevel,
  summaryOf,
  toRoomLabelRow,
  wallsOfLevel,
  ROOM_NAME_TARGETS,
  ROOM_USAGE_CHOICES,
  type RoomLabelBackground,
  type RoomLabelGraphPort,
  type RoomLabelMeasures,
  type RoomLabelReviewGateway,
} from './roomLabelReviewGateway';
import type {
  RoomLabelMergeCandidate,
  RoomLabelNormalizePreview,
  RoomLabelReviewProps,
  RoomLabelScreenState,
  RoomLabelSummaryViewModel,
  RoomLabelUsageOption,
  RoomLabelViewModel,
} from './roomLabelTypes';

/* -------------------------------------------------------------------------- */
/* Chuỗi của hook — mọi câu người dùng đọc mà cổng không sinh ra.              */
/* -------------------------------------------------------------------------- */

/**
 * Ba câu của riêng màn, chữ thường kiểu câu (A6).
 *
 * Hai câu `empty…` BẮT BUỘC kèm bước đi tiếp — CẤM TUYỆT ĐỐI của đặc tả nói về
 * vòng hở, và một màn rỗng không nói được phải làm gì tiếp là đúng thứ A11 tồn
 * tại để chặn.
 */
export const ROOM_LABEL_SCREEN_TEXT = {
  emptyNotice:
    'Chưa dò ra phòng nào ở tầng này: vòng tường bao quanh các phòng chưa khép kín. Sang lớp tường khép các đoạn còn hở, rồi bấm "Kiểm tra vòng hở" để dò lại.',
  emptyFilteredNotice:
    'Không còn phòng nào chưa đặt tên. Tắt bộ lọc "Chưa đặt tên" để xem lại toàn bộ phòng của tầng.',
  viewerRoleNotice:
    'Bạn đang xem với vai Người xem: đổi tên, đổi công năng, gộp, tách và duyệt đều tắt. Nhờ người quản trị dự án đổi vai nếu bạn cần sửa lớp phòng.',
} as const;

/* -------------------------------------------------------------------------- */
/* Tham số vào và giá trị ra.                                                  */
/* -------------------------------------------------------------------------- */

export interface UseRoomLabelReviewOptions {
  readonly projectId: string;
  readonly floorId: string;
  /** Tầng đang duyệt. Vắng mặt thì hook lấy tầng đầu tiên của đồ thị. */
  readonly levelId?: LevelId;
  readonly roles?: readonly ProjectRole[];
  /** Cổng dữ liệu tiêm được. Vắng mặt thì hook dựng cổng thật, đúng một lần. */
  readonly gateway?: RoomLabelReviewGateway;
  /** Ép thu gọn hai panel — cho story và bài kiểm muốn một câu trả lời cố định. */
  readonly forceCollapsed?: boolean;
  /** Ép chế độ hẹp. Xem ghi chú "isCompact do nơi gọi quyết" ở đầu file. */
  readonly forceCompact?: boolean;
  /**
   * Bus thông báo — chỗ toast hoàn tác của A8 đi ra.
   *
   * Bỏ trống là bus của cả phiên (`appNotificationBus`), thứ `NotificationHost`
   * ở `src/main.tsx` đang vẽ. Test và story tiêm bus riêng để hai lượt kiểm
   * không thấy thông báo của nhau.
   */
  readonly notifications?: NotificationBus;
  /**
   * Nơi màn đi tới khi người duyệt bấm "sang lớp tường".
   *
   * Container (T8) nối nó với `useNavigate`; hook không gọi `useNavigate` để
   * `renderHook` dựng được mà không cần một `<MemoryRouter>`. Bỏ trống thì màn
   * không đi đâu cả — và bài kiểm thấy đúng đường dẫn `ROUTES` ghép ra.
   */
  readonly onNavigate?: (href: string) => void;
}

/** Đúng hợp đồng đã đóng băng, không thêm một lát nào. */
export type UseRoomLabelReviewResult = RoomLabelReviewProps;

/* -------------------------------------------------------------------------- */
/* Hằng của riêng hook.                                                        */
/* -------------------------------------------------------------------------- */

const NO_CANDIDATES: readonly RoomLabelMergeCandidate[] = [];

/**
 * Tỷ lệ dùng khi tầng CHƯA hiệu chỉnh.
 *
 * `RoomLabelReviewProps.millimetresPerPixel` không nhận `null`, nên phải có một
 * giá trị; một milimét trên một điểm ảnh là phép biến đổi đồng nhất — canvas vẽ
 * đúng toạ độ đồ thị, không phóng đại cũng không thu nhỏ theo một tỷ lệ bịa.
 */
const UNCALIBRATED_SCALE = millimetresPerPixel(1);

/*
 * Đoạn thứ hai của `explainRoom` — câu nói CÁCH diện tích ra con số đó.
 *
 * `explainRoom` trả về nhiều đoạn ngăn bằng một dòng trống: đoạn đầu là tiêu đề
 * "tên phòng — 18,40 m²", đoạn thứ hai là lời giải thích phép tính (đúng ở cả
 * nhánh phòng chưa đủ ba đỉnh). Lấy đúng đoạn đó là ĐỌC LẠI câu của M-07, không
 * phải viết một câu thứ hai có thể trôi khỏi bản gốc.
 */
const EXPLAIN_PARAGRAPH_SEPARATOR = '\n\n';
const EXPLAIN_METHOD_PARAGRAPH_INDEX = 1;

/* -------------------------------------------------------------------------- */
/* Phép ghép thuần — kiểm được mà không cần dựng hook.                          */
/* -------------------------------------------------------------------------- */

/**
 * Chữ ký HÌNH HỌC của một phòng: mã phòng cộng ranh phòng.
 *
 * Đây là khoá của bộ nhớ đệm số đo. Nó CỐ Ý không mang `name`, `usage`,
 * `reviewed` hay `confidence` — đổi tên một phòng phải không làm `measureRoom`
 * chạy lại, và cách chắc chắn nhất để giữ lời hứa đó là khoá không biết tên
 * phòng tồn tại. Thuần nối chuỗi: không một phép tính, không một lượt định dạng
 * số nào (A15 — con số ra chuỗi người đọc là việc của `formatArea`).
 */
export function outlineKeyOf(room: Room): string {
  const corners = room.outline
    .map((corner) => `${String(corner.x)},${String(corner.y)}`)
    .join(' ');

  return `${room.id}|${corners}`;
}

/** Chỉ phòng chưa đặt tên, khi chip "Chưa đặt tên" đang bật. */
export function applyUnnamedFilter(
  rooms: readonly RoomLabelViewModel[],
  showOnlyUnnamed: boolean,
): readonly RoomLabelViewModel[] {
  return showOnlyUnnamed ? rooms.filter((room) => !room.hasName) : rooms;
}

/**
 * Bảy trạng thái của A11, theo đúng thứ tự ưu tiên `useWallLayerReview` đã chốt.
 *
 * Vai trò đi trước vì trạng thái 6 vô hiệu MỌI hàm sửa: một người xem nhìn màn
 * thu gọn vẫn là một người xem. `error` đi trước `loading` vì một lượt đọc đã
 * hỏng thì không còn "đang tải" nữa.
 */
export function deriveRoomLabelScreenState(input: {
  readonly isViewerRole: boolean;
  readonly isCollapsed: boolean;
  readonly hasError: boolean;
  readonly isLoading: boolean;
  readonly visibleRooms: readonly RoomLabelViewModel[];
  readonly unnamedCount: number;
}): RoomLabelScreenState {
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

  if (input.visibleRooms.length === 0) {
    return 'empty';
  }

  return input.unnamedCount === 0 && input.visibleRooms.every((room) => room.status === 'confirmed')
    ? 'success'
    : 'partial';
}

/** Phòng khác của cùng tầng — nguyên liệu của danh sách "gộp với…". */
export function mergeCandidatesOf(
  rooms: readonly Room[],
  selectedRoomId: RoomId | null,
): readonly RoomLabelMergeCandidate[] {
  if (selectedRoomId === null) {
    return NO_CANDIDATES;
  }

  return rooms
    .filter((room) => room.id !== selectedRoomId)
    .map((room) => ({ id: room.id, codeLabel: roomCodeLabel(room.id), name: room.name }));
}

/**
 * Điểm cắt của một lượt tách, do HOOK chọn (R-60).
 *
 * Chạy lại M-06 trên tường hiện tại và hỏi: có đúng HAI vùng dò được nằm trong
 * ranh phòng này không? Có thì điểm cắt là trọng tâm của vùng thứ hai —
 * `computeCentroid` của M-07 tính, hook chỉ chuyền tay. Không thì `null`, và
 * thanh tra nói ra cách vẽ đoạn tường ngăn thay vì hiện một nút tách chết.
 *
 * Đúng phép lọc mà `buildSplitRoomCommandFromWalls` dùng để nhận hai phần, nên
 * một điểm cắt khác `null` ở đây là một lượt tách chắc chắn qua được cổng.
 */
export function splitPointOf(
  room: Room | null,
  walls: readonly Wall[],
  level: Level | null,
): Point | null {
  if (room === null) {
    return null;
  }

  const detected = detectRoomsOfLevel(walls, level);

  if (detected === null) {
    return null;
  }

  const outlineMm = room.outline.map(toPointMm);
  const parts = detected.rooms.filter((part) =>
    outlineContains(outlineMm, computeCentroid(part.outline)),
  );

  const second = parts.length === 2 ? parts[1] : undefined;

  return second === undefined ? null : toPoint(computeCentroid(second.outline));
}

/**
 * Câu giải thích diện tích, LẤY LẠI từ `explainRoom` — không viết câu mới.
 *
 * `''` khi tầng chưa có phòng nào: không có ranh phòng thì không có phép tính
 * nào để giải thích, và bịa một câu chung chung là viết một câu thứ hai.
 */
export function areaCaptionOf(room: Room | null): string {
  if (room === null) {
    return '';
  }

  const paragraphs = explainRoom({
    outline: room.outline.map(toPointMm),
    name: room.name,
  }).split(EXPLAIN_PARAGRAPH_SEPARATOR);

  return paragraphs[EXPLAIN_METHOD_PARAGRAPH_INDEX] ?? '';
}

/** Tám nhãn công năng làm gợi ý tên — GỢI Ý, không bao giờ ép (CẤM TUYỆT ĐỐI). */
export const ROOM_LABEL_NAME_SUGGESTIONS: readonly string[] = ROOM_NAME_TARGETS;

/** Danh mục công năng dưới đúng hình dạng ô chọn cần. Nhãn tới từ tầng luật. */
export const ROOM_LABEL_USAGE_OPTIONS: readonly RoomLabelUsageOption[] = ROOM_USAGE_CHOICES.map(
  (choice) => ({ value: choice.usage, label: choice.label }),
);

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

/** Cổng thật dựng đúng một lần cho suốt đời component. */
function useResolvedGateway(injected: RoomLabelReviewGateway | undefined): RoomLabelReviewGateway {
  const fallbackRef = useRef<RoomLabelReviewGateway | null>(null);

  if (injected !== undefined) {
    return injected;
  }

  fallbackRef.current ??= createRoomLabelReviewGateway();

  return fallbackRef.current;
}

export function useRoomLabelReview(
  options: UseRoomLabelReviewOptions,
): UseRoomLabelReviewResult {
  const { floorId, projectId } = options;
  const gateway = useResolvedGateway(options.gateway);
  const queryClient = useQueryClient();
  const notifications = options.notifications ?? appNotificationBus;

  /* ---------------------------------------------------------------------- */
  /* Vai trò — trạng thái 6 vô hiệu MỌI hàm sửa, ở tầng hook.                */
  /* ---------------------------------------------------------------------- */

  const roles = options.roles ?? [];
  const canEdit = can('edit', 'layer', { roles });
  const isViewerRole = !canEdit;

  /* ---------------------------------------------------------------------- */
  /* Trạng thái của riêng giao diện — KHÔNG có isLoading/error ở đây (R-64). */
  /* ---------------------------------------------------------------------- */

  const [showOnlyUnnamed, setShowOnlyUnnamed] = useState(false);
  const [ownCollapsed, setOwnCollapsed] = useState(false);
  const [normalizePreview, setNormalizePreview] = useState<RoomLabelNormalizePreview | null>(null);
  const isCollapsed = options.forceCollapsed ?? ownCollapsed;
  const isCompact = options.forceCompact ?? isCollapsed;

  /* ---------------------------------------------------------------------- */
  /* Hai lượt đọc máy chủ, TÁCH BẠCH (R-64).                                 */
  /* ---------------------------------------------------------------------- */

  /*
   * Ảnh nền và lớp phòng là HAI lượt đọc dưới hai khoá khác nhau, và trạng thái
   * `error` chỉ nghe lượt thứ hai: "ảnh nền hỏng" KHÔNG được đọc thành "lớp
   * phòng hỏng", vì ở trạng thái 4 canvas vẫn phải xem được ảnh gốc.
   */

  const backgroundQuery = useQuery({
    queryKey: queryKeys.drawing.byFloor(floorId),
    queryFn: ({ signal }) => gateway.readBackground({ floorId, projectId, signal }),
  });

  const roomLayerQuery = useQuery({
    queryKey: queryKeys.room.byFloor(floorId),
    queryFn: ({ signal }) => gateway.readRoomLayer({ floorId, projectId, signal }),
  });

  /*
   * Lần đọc ảnh nền THÀNH CÔNG gần nhất, giữ lại qua mọi lượt hỏng sau đó.
   *
   * `backgroundQuery.data` là `undefined` ngay khi lượt đọc hỏng, nên canvas
   * rơi về ô xám và người duyệt mất ảnh gốc đúng lúc cần nó nhất để đối chiếu.
   */
  const lastBackgroundRef = useRef<RoomLabelBackground | null>(null);

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
  const rooms = useMemo(() => roomsOfLevel(graph, levelId), [graph, levelId]);
  const walls = useMemo(() => wallsOfLevel(graph, levelId), [graph, levelId]);
  const scale = useMemo(() => scaleOfLevel(level), [level]);

  /* ---------------------------------------------------------------------- */
  /* Đo phòng — CHỈ chạy lại khi hình học đổi.                                */
  /* ---------------------------------------------------------------------- */

  /*
   * Bộ nhớ đệm số đo, khoá bằng {@link outlineKeyOf}.
   *
   * Đây là chỗ lời hứa "đổi tên KHÔNG tính lại diện tích" được giữ. Một
   * `useMemo` khoá theo `rooms` không đủ: `commit` sinh một mảng phòng MỚI sau
   * mỗi lượt ghi, kể cả lượt chỉ đổi `name`, nên một memo như thế sẽ đo lại cả
   * mười bốn phòng sau mỗi lần đổi tên. Đệm theo ranh phòng thì lượt đổi tên
   * trả về ĐÚNG object số đo cũ — bài kiểm khẳng định bằng `toBe`.
   */
  const measuresRef = useRef(
    new Map<RoomId, { readonly key: string; readonly value: RoomLabelMeasures }>(),
  );

  const measures = useMemo(() => {
    const cache = measuresRef.current;
    const next = new Map<RoomId, RoomLabelMeasures>();

    for (const room of rooms) {
      const key = outlineKeyOf(room);
      const cached = cache.get(room.id);

      if (cached !== undefined && cached.key === key) {
        next.set(room.id, cached.value);
        continue;
      }

      const value = measureRoom(room, scale);

      cache.set(room.id, { key, value });
      next.set(room.id, value);
    }

    return next;
  }, [rooms, scale]);

  /* ---------------------------------------------------------------------- */
  /* Nhắc công năng M-14 — NHẮC, không bao giờ CHẶN.                          */
  /* ---------------------------------------------------------------------- */

  const ruleRouteHref = useMemo(() => ROUTES.project.rules(projectId), [projectId]);

  const violations = useMemo(() => (graph === null ? [] : runRoomRules(graph)), [graph]);

  /* ---------------------------------------------------------------------- */
  /* Vòng hở — GỌI LẠI M-06, kèm kích thước khe hở.                           */
  /* ---------------------------------------------------------------------- */

  const detected = useMemo(() => detectRoomsOfLevel(walls, level), [level, walls]);
  const gaps = useMemo(() => gapsOf(detected), [detected]);

  /* ---------------------------------------------------------------------- */
  /* Dòng phòng và tóm tắt.                                                  */
  /* ---------------------------------------------------------------------- */

  const backgroundImageUrl = background?.imageUrl ?? null;

  const allRows = useMemo<readonly RoomLabelViewModel[]>(
    () =>
      rooms.map((room) =>
        toRoomLabelRow(room, {
          measures: measures.get(room.id) ?? measureRoom(room, scale),
          notices: noticesOfRoom(violations, room.id, ruleRouteHref),
          backgroundImageUrl,
          scale,
        }),
      ),
    [backgroundImageUrl, measures, rooms, ruleRouteHref, scale, violations],
  );

  const summary = useMemo<RoomLabelSummaryViewModel>(() => summaryOf(rooms), [rooms]);

  const visibleRows = useMemo(
    () => applyUnnamedFilter(allRows, showOnlyUnnamed),
    [allRows, showOnlyUnnamed],
  );

  /* ---------------------------------------------------------------------- */
  /* Vùng chọn và rê chuột — kho dùng chung với canvas và danh sách.          */
  /* ---------------------------------------------------------------------- */

  const selectedRoomId = useMemo<RoomId | null>(() => {
    const last = selectedIds[selectedIds.length - 1];

    return last !== undefined && rooms.some((room) => room.id === last) ? (last as RoomId) : null;
  }, [rooms, selectedIds]);

  const selectedRoom = useMemo<Room | null>(
    () => rooms.find((room) => room.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId],
  );

  const selectionSnapshotRef = useRef<readonly EntityId[]>(selectedIds);
  selectionSnapshotRef.current = selectedIds;
  const selectionBeforeRef = useRef<readonly EntityId[]>(selectedIds);

  const onSelect = useCallback(
    (roomId: RoomId | null) => {
      selectionBeforeRef.current = selectionSnapshotRef.current;
      setSelection(roomId === null ? [] : [roomId]);
    },
    [setSelection],
  );

  const onHover = useCallback(
    (roomId: RoomId | null) => {
      setHovered(roomId);
    },
    [setHovered],
  );

  /* ---------------------------------------------------------------------- */
  /* Tự lưu (A7) — không có nút lưu, và không bịa một lượt lưu đã xong.       */
  /* ---------------------------------------------------------------------- */

  const storePort = useMemo<RoomLabelGraphPort>(
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
      const result = await current.gateway.persistRoomLabels({
        floorId: current.floorId,
        projectId: current.projectId,
        graph: changes,
      });

      if (!result.supported) {
        /*
         * Một khả năng chưa có endpoint KHÔNG được biến thành một lượt lưu đã
         * xong: ném ra là cách duy nhất để vỏ ứng dụng nói ra sự thật thay vì
         * hiện "Đã lưu lúc…" cho một lượt chưa hề rời khỏi máy.
         */
        throw new Error(result.missing);
      }
    },
  });

  const autosave = autosaveRef.current;

  /* ---------------------------------------------------------------------- */
  /* Đường ghi — `dispatch` chạy qua `commit`, hoàn tác 100 bước của S-06.    */
  /* ---------------------------------------------------------------------- */

  const dispatchBundle = useMemo(
    () =>
      createRoomLabelDispatchDeps({
        graph: storePort,
        selectionBefore: () => ({ selectedIds: selectionBeforeRef.current }),
        selectionAfter: () => ({ selectedIds: selectionSnapshotRef.current }),
        onSynced: () => {
          autosave.notifyChange();
        },
      }),
    [autosave, storePort],
  );

  const invalidate = useCallback(() => {
    applyInvalidation(queryClient, 'editWall', { floorId, projectId });
  }, [floorId, projectId, queryClient]);

  const applyUndo = useCallback(() => {
    if (!canEdit) {
      return;
    }

    const transition = dispatchBundle.history.undo();

    if (transition === null) {
      return;
    }

    dispatchBundle.deps.spatial.applyPatches(transition.patches);
    setSelection([...transition.selection.selectedIds]);
    autosave.notifyChange();
    invalidate();
  }, [autosave, canEdit, dispatchBundle, invalidate, setSelection]);

  const onUndo = useCallback(() => {
    applyUndo();
  }, [applyUndo]);

  /**
   * Chạy một lệnh qua đủ năm bước, rồi MỜI HOÀN TÁC (A8).
   *
   * Vai Người xem không đi qua đây được: `canEdit` chặn ngay dòng đầu, nên
   * trạng thái 6 vô hiệu mọi hàm sửa ở tầng hook chứ không phải bằng cách ẩn
   * nút ở view.
   *
   * Loại thông báo là CHÍNH `command.type`, nên `notificationBus` gộp các lượt
   * cùng loại trong cửa sổ năm giây của nó — đổi tên năm phòng liên tiếp cho
   * một toast "hoàn tác 5 thay đổi", không phải năm toast chồng nhau. Cửa sổ
   * tám giây do chính vé mang (`UNDO_WINDOW_MS`), nên không một thời lượng nào
   * phải truyền ở đây (R-71).
   */
  const run = useCallback(
    async (build: (context: CommandContext) => Command | null): Promise<Command | null> => {
      const current = useStore.getState().spatial;

      if (!canEdit || current === null) {
        return null;
      }

      const command = build(commandContextOf(current, gateway.actorId));

      if (command === null) {
        return null;
      }

      const result = await runRoomCommand(command, dispatchBundle);

      if (!result.ok) {
        return null;
      }

      invalidate();

      const ticket = createRoomLabelUndoTicket({
        description: command.description,
        now: gateway.now,
        undo: () => {
          applyUndo();
        },
      });

      notifications.publish({
        type: command.type,
        title: ticket.description,
        description: '',
        undoTicket: ticket,
      });

      return command;
    },
    [applyUndo, canEdit, dispatchBundle, gateway, invalidate, notifications],
  );

  /* ---------------------------------------------------------------------- */
  /* Bốn hành động trên một phòng, cộng lượt duyệt.                           */
  /* ---------------------------------------------------------------------- */

  const roomById = useCallback(
    (roomId: RoomId): Room | null => rooms.find((room) => room.id === roomId) ?? null,
    [rooms],
  );

  const onRename = useCallback(
    (roomId: RoomId, name: string) => {
      void run((context) => {
        const result = buildRenameRoomCommand({ roomId, name }, context);

        return result.ok ? result.data : null;
      });
    },
    [run],
  );

  const onChangeUsage = useCallback(
    (roomId: RoomId, usage: RoomUsage) => {
      void run((context) => {
        const result = buildChangeUsageCommand({ roomId, usage }, context);

        return result.ok ? result.data : null;
      });
    },
    [run],
  );

  /*
   * Gộp và tách: hình học tới từ M-06 chạy lại trên tường HIỆN TẠI, do cổng
   * suy ra (xem khối chú thích đầu `roomLabelReviewGateway.ts`). Hook chỉ
   * chuyền tay `walls`/`level`; không một phép hợp/cắt đa giác nào ở đây.
   */

  const onMerge = useCallback(
    (roomId: RoomId, otherRoomId: RoomId) => {
      void run((context) => {
        const result = buildMergeRoomCommand(
          { targetRoomId: roomId, absorbedRoomId: otherRoomId },
          context,
          walls,
          level,
        );

        return result.ok ? result.data : null;
      });
    },
    [level, run, walls],
  );

  const onSplit = useCallback(
    (roomId: RoomId, at: Point) => {
      const newRoomId = gateway.nextRoomId();

      void run((context) => {
        const result = buildSplitRoomCommandFromWalls(
          { roomId, newRoomId, at },
          context,
          walls,
          level,
        );

        return result.ok ? result.data : null;
      });
    },
    [gateway, level, run, walls],
  );

  const onApprove = useCallback(
    (roomId: RoomId) => {
      const room = roomById(roomId);

      if (room === null || room.reviewed) {
        return;
      }

      void run(() => buildApproveRoomCommand(room, gateway.actorId));
    },
    [gateway, roomById, run],
  );

  /* ---------------------------------------------------------------------- */
  /* Chuẩn hoá tên — XEM TRƯỚC rồi mới áp (CẤM TUYỆT ĐỐI).                    */
  /* ---------------------------------------------------------------------- */

  const onOpenNormalizePreview = useCallback(() => {
    /* Dựng BẢNG, không phát lệnh: không một tên nào đổi ở bước này. */
    setNormalizePreview(buildNormalizePreview(rooms));
  }, [rooms]);

  const onCancelNormalize = useCallback(() => {
    setNormalizePreview(null);
  }, []);

  const onApplyNormalize = useCallback(() => {
    const preview = normalizePreview;

    if (preview === null) {
      return;
    }

    setNormalizePreview(null);
    /* MỘT lệnh mang nhiều thay đổi → MỘT mục hoàn tác, MỘT toast tám giây. */
    void run(() => buildNormalizeNamesCommand(rooms, preview, gateway.actorId));
  }, [gateway, normalizePreview, rooms, run]);

  /* ---------------------------------------------------------------------- */
  /* Bộ lọc, vòng hở, điều hướng, vỏ màn.                                     */
  /* ---------------------------------------------------------------------- */

  const onToggleUnnamedFilter = useCallback(() => {
    setShowOnlyUnnamed((previous) => !previous);
  }, []);

  const onToggleCollapsed = useCallback(() => {
    setOwnCollapsed((previous) => !previous);
  }, []);

  const refetchRoomLayer = roomLayerQuery.refetch;

  /**
   * "Kiểm tra vòng hở" — đọc LẠI lớp phòng, rồi để M-06 chạy lại trên đồ thị mới.
   *
   * Phép dò là thuần và đã chạy trong một `useMemo` khoá theo tường, nên việc
   * duy nhất còn lại là làm mới nguyên liệu: một lượt đọc mới. Bấm lại khi
   * không có gì đổi thì cho đúng danh sách cũ — đúng, và trung thực.
   */
  const onCheckWallGaps = useCallback(() => {
    invalidate();
    void refetchRoomLayer();
  }, [invalidate, refetchRoomLayer]);

  const navigate = options.onNavigate;

  const onNavigateToWalls = useCallback(() => {
    navigate?.(ROUTES.project.walls(projectId, floorId));
  }, [floorId, navigate, projectId]);

  /* ---------------------------------------------------------------------- */
  /* Bảy trạng thái và ba câu đi kèm.                                        */
  /* ---------------------------------------------------------------------- */

  const roomLayerError: unknown = roomLayerQuery.error;

  const errorMessage = useMemo<string | null>(
    () =>
      roomLayerError === null || roomLayerError === undefined
        ? null
        : describeError(toAppError(roomLayerError)).description,
    [roomLayerError],
  );

  const state = deriveRoomLabelScreenState({
    isViewerRole,
    isCollapsed,
    hasError: errorMessage !== null,
    isLoading: roomLayerQuery.isPending,
    visibleRooms: visibleRows,
    unnamedCount: summary.unnamedCount,
  });

  /*
   * Bất biến #1: `emptyNotice` khác `null` ĐÚNG khi màn rỗng. Hai lý do rỗng,
   * hai câu — và cả hai câu nói ra bước đi tiếp.
   */
  const emptyFiltered = showOnlyUnnamed && allRows.length > 0;
  const emptyNotice =
    state === 'empty'
      ? emptyFiltered
        ? ROOM_LABEL_SCREEN_TEXT.emptyFilteredNotice
        : ROOM_LABEL_SCREEN_TEXT.emptyNotice
      : null;

  /* ---------------------------------------------------------------------- */
  /* Sáu trường thanh tra.                                                   */
  /* ---------------------------------------------------------------------- */

  const mergeCandidates = useMemo(
    () => mergeCandidatesOf(rooms, selectedRoomId),
    [rooms, selectedRoomId],
  );

  const splitPointMm = useMemo(
    () => splitPointOf(selectedRoom, walls, level),
    [level, selectedRoom, walls],
  );

  const areaCaption = useMemo(
    () => areaCaptionOf(selectedRoom ?? rooms[0] ?? null),
    [rooms, selectedRoom],
  );

  return {
    state,
    rooms: visibleRows,
    summary,
    gaps,
    selectedRoomId,
    hoveredRoomId: (hoveredId as RoomId | null) ?? null,
    showOnlyUnnamed,
    normalizePreview,
    backgroundImageUrl,
    backgroundImageAlt: background?.imageAlt ?? '',
    millimetresPerPixel: level?.scaleMillimetresPerPixel ?? UNCALIBRATED_SCALE,
    isCompact,
    isCollapsed,
    isViewerRole,
    viewerRoleNotice: isViewerRole ? ROOM_LABEL_SCREEN_TEXT.viewerRoleNotice : null,
    emptyNotice,
    errorMessage,

    nameSuggestions: ROOM_LABEL_NAME_SUGGESTIONS,
    usageOptions: ROOM_LABEL_USAGE_OPTIONS,
    areaCaption,
    mergeCandidates,
    splitPointMm,

    onRename,
    onChangeUsage,
    onMerge,
    onSplit,
    onApprove,
    onSelect,
    onHover,
    onOpenNormalizePreview,
    onApplyNormalize,
    onCancelNormalize,
    onToggleUnnamedFilter,
    onCheckWallGaps,
    onNavigateToWalls,
    onUndo,
    onToggleCollapsed,
  };
}

/** Cổng có dữ liệu, xuất lại để story và bài kiểm cắm vào cùng một chỗ (R-73). */
export { createMockRoomLabelReviewGateway };
