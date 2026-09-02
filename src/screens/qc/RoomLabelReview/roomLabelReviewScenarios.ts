/**
 * Bảy kịch bản của màn "Duyệt tên phòng", dựng sẵn để story (T8) và bài kiểm
 * dùng chung.
 *
 * Theo đúng khuôn `wallLayerReviewScenarios.ts` của màn QC anh em: đúng bảy
 * kịch bản, tên nhánh lấy nguyên từ `SEVEN_STATES`, nhãn tiếng Việt lấy nguyên
 * từ `SEVEN_STATE_LABELS` chứ không tự đặt một bản dịch thứ hai có thể trôi
 * khỏi bản gốc.
 *
 * Mỗi kịch bản mang RAW DATA đúng hình dạng đồ thị — `Room[]`/`Wall[]` của
 * `src/domain/spatial/types` — chứ KHÔNG phải `RoomLabelReviewProps` đã tính
 * sẵn. Lý do giống hệt màn tường: viewmodel là kết quả của
 * `useRoomLabelReview.ts`, và dựng sẵn nó ở đây nghĩa là chép lại logic của
 * hook vào một chỗ thứ hai để hai bên trôi khỏi nhau (R-61/R-70). Nơi gọi cắm
 * `scenario.rooms`/`scenario.walls` vào `normalizeSpatial(...)` rồi đưa cho
 * `createMockRoomLabelReviewGateway({ graph })` — cùng một cổng cho cả story
 * lẫn bài kiểm.
 *
 * ## Vòng tường hở — bộ tường nhỏ nhất nói được điều cần nói
 *
 * `roomLabelFixture.ts` CHỦ Ý không kèm tường (xem ghi chú đầu file đó), nhưng
 * hai kịch bản `empty` và `partial` của đặc tả đòi "vòng hở kèm kích thước".
 * {@link ROOM_LABEL_SCENARIO_GAP_WALLS} là bốn đoạn tường bao quanh MỘT phòng,
 * trong đó đoạn cuối dừng sớm đúng {@link ROOM_LABEL_SCENARIO_GAP_MM} milimét
 * trước góc — dưới `DEFAULT_WELD_GAP_MM` (80 mm) của
 * `src/domain/rooms/graph.ts`, nên `buildWallGraph` HÀN hai đầu lại và báo khe
 * hở đó trong `weldedGaps`, kèm đúng bề rộng. Con số 62 không phải một ngưỡng
 * tự chế: nó là một khoảng cách DỮ LIỆU, chọn dưới ngưỡng có sẵn để phép hàn
 * chắc chắn xảy ra, và bài kiểm đọc lại nó từ hằng này chứ không gõ tay.
 */

import type { Confidence, Level, LevelId, Point, Room, Wall, WallId, WallKind } from '@/domain/spatial/types';
import { millimetres } from '@/domain/units/types';
import { SEVEN_STATE_LABELS, type SevenState } from '@/lib/testing/sevenStateScenarios';

import {
  ROOM_LABEL_FIXTURE_EMPTY,
  ROOM_LABEL_FIXTURE_LEVEL,
  ROOM_LABEL_FIXTURE_ROOMS,
} from './roomLabelFixture';
import { ROOM_LABEL_SAMPLE_IMAGE } from './roomLabelReviewGateway';
import type { RoomLabelScreenState } from './roomLabelTypes';

/* -------------------------------------------------------------------------- */
/* Bộ tường nhỏ của hai kịch bản có vòng hở.                                   */
/* -------------------------------------------------------------------------- */

/** Số chữ số của phần đếm trong thân mã — `COUNTER_LENGTH` của `ids.ts:41`. */
const COUNTER_LENGTH = 6;

/** Đuôi cố định của mã tường trong bộ mẫu này — bộ mẫu phải TẤT ĐỊNH. */
const WALL_ID_SUFFIX = 'GAPW';

/** `'W-101'` → `'W-000101GAPW'`. Thuần cắt chuỗi, không một phép tính nào. */
const wallIdOf = (code: string): WallId =>
  `W-${code.slice(2).padStart(COUNTER_LENGTH, '0')}${WALL_ID_SUFFIX}` as WallId;

const GAP_LEVEL_ID: LevelId = ROOM_LABEL_FIXTURE_LEVEL.id;

/** Chiều cao và độ dày của bốn đoạn tường mẫu — trong dải `detectRooms` nhận. */
const WALL_HEIGHT_MM = 3000;
const WALL_THICKNESS_MM = 220;
const WALL_KIND: WallKind = 'envelope';
const WALL_CONFIDENCE: Confidence = 0.74;

/**
 * Bề rộng khe hở của kịch bản có vòng hở, tính bằng milimét.
 *
 * DƯỚI `DEFAULT_WELD_GAP_MM` (80 mm, `src/domain/rooms/graph.ts:63`) nên
 * `buildWallGraph` chắc chắn hàn hai đầu lại và báo lại đúng con số này trong
 * `weldedGaps[].gapMm` — đó là cách kịch bản "vòng hở kèm kích thước" có một
 * kích thước THẬT chứ không phải một chuỗi ghép sẵn.
 */
export const ROOM_LABEL_SCENARIO_GAP_MM = 62;

/** Khổ của phòng mẫu bốn tường — dữ liệu, không phải ngưỡng. */
const GAP_ROOM_WIDTH_MM = 5000;
const GAP_ROOM_DEPTH_MM = 3400;

const point = (x: number, y: number): Point => ({ x, y });

/** Dựng một `Wall` hợp lệ của `src/domain/spatial/types.ts`. */
function gapWall(code: string, start: Point, end: Point): Wall {
  return {
    id: wallIdOf(code),
    levelId: GAP_LEVEL_ID,
    centreline: { start, end },
    thicknessMm: millimetres(WALL_THICKNESS_MM),
    heightMm: millimetres(WALL_HEIGHT_MM),
    kind: WALL_KIND,
    openingIds: [],
    confidence: WALL_CONFIDENCE,
    source: 'ai',
    reviewed: false,
  };
}

/**
 * Bốn đoạn tường quanh một phòng, đoạn cuối dừng sớm 62 mm trước góc gốc.
 *
 * Vòng chạy ngược chiều kim đồng hồ; `W-104` đáng lẽ về tới `(0; 0)` nhưng dừng
 * ở `(0; 62)`. Đó là toàn bộ khiếm khuyết — vừa đủ để M-06 báo một khe hàn
 * được, không đủ để đồ thị hỏng.
 */
export const ROOM_LABEL_SCENARIO_GAP_WALLS: readonly Wall[] = [
  gapWall('W-101', point(0, 0), point(GAP_ROOM_WIDTH_MM, 0)),
  gapWall('W-102', point(GAP_ROOM_WIDTH_MM, 0), point(GAP_ROOM_WIDTH_MM, GAP_ROOM_DEPTH_MM)),
  gapWall('W-103', point(GAP_ROOM_WIDTH_MM, GAP_ROOM_DEPTH_MM), point(0, GAP_ROOM_DEPTH_MM)),
  gapWall('W-104', point(0, GAP_ROOM_DEPTH_MM), point(0, ROOM_LABEL_SCENARIO_GAP_MM)),
];

/** Không tường nào — ba kịch bản không nói gì về vòng hở dùng mảng này. */
const NO_WALLS: readonly Wall[] = [];

/* -------------------------------------------------------------------------- */
/* Biến thể phòng.                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Tên tạm của ba phòng chưa đặt tên, CHỈ dùng ở kịch bản `success`.
 *
 * Kịch bản đó cần một tầng không còn phòng nào trống tên; đặt tên bằng một từ
 * chung kèm số thứ tự là cách ngắn nhất làm điều đó mà không phạm luật trùng
 * tên trong cùng một tầng (`validateRenameRoom`).
 */
const ROOM_LABEL_SCENARIO_PLACEHOLDER_NAME = 'phòng phụ';

/**
 * Toàn bộ 14 phòng, nhưng ĐÃ ĐẶT TÊN VÀ ĐÃ DUYỆT HẾT — chỉ cho kịch bản `success`.
 *
 * A5: `reviewed: true` đi kèm `source: 'human'`, đúng cách
 * `buildApproveRoomCommand` đặt hai cờ đó; không phòng nào ở đây giữ
 * `source: 'ai'` cùng lúc với cờ xanh "đã xác minh".
 */
function allNamedAndReviewed(rooms: readonly Room[]): readonly Room[] {
  return rooms.map((room, index) => ({
    ...room,
    name:
      room.name.trim() === ''
        ? `${ROOM_LABEL_SCENARIO_PLACEHOLDER_NAME} ${String(index + 1)}`
        : room.name,
    reviewed: true,
    source: 'human',
    confidence: 1,
  }));
}

/* -------------------------------------------------------------------------- */
/* Một kịch bản.                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Nguyên liệu đồ thị cho một trong bảy trạng thái, cộng vài cờ ngoài đồ thị
 * (vai trò, thu gọn, ảnh nền, lỗi) mà đồ thị tự nó không mang.
 *
 * Mọi trường có mặt ở MỌI kịch bản (đúng tinh thần `SevenStateScenario`): một
 * nơi gọi đọc `scenario.error` không phải đoán xem trường đó có tồn tại không.
 */
export interface RoomLabelReviewScenario {
  readonly state: RoomLabelScreenState;
  /** Nhãn tiếng Việt của trạng thái, nguyên từ `SEVEN_STATE_LABELS`. */
  readonly label: string;
  readonly level: Level;
  readonly rooms: readonly Room[];
  /** Tường của tầng — chỉ hai kịch bản có vòng hở mới cần tới. */
  readonly walls: readonly Wall[];
  /** Nguồn ảnh nền. `null` khi chưa có ảnh nào để xem. */
  readonly backgroundImageUrl: string | null;
  /** `true` ở kịch bản `forbidden` — vai Người xem. */
  readonly isViewerRole: boolean;
  /** `true` ở kịch bản `collapsed`. */
  readonly isCollapsed: boolean;
  /** `true` ở kịch bản `partial` — chip "Chưa đặt tên" đang tắt, ba phòng trống tên vẫn hiện. */
  readonly showOnlyUnnamed: boolean;
  /** Non-null CHỈ ở kịch bản `error`, cùng quy ước với `SevenStateScenario.error`. */
  readonly error: unknown;
}

const labelOf = (state: SevenState): string => SEVEN_STATE_LABELS[state];

/**
 * 1. Rỗng — M-06 chưa khép được vòng nào, nên tầng chưa có phòng.
 *
 * Bốn đoạn tường CÓ mặt và một trong bốn còn hở 62 mm: đó là lý do màn rỗng, và
 * là hai lời mời đi tiếp mà `emptyNotice` phải nói ra (sang lớp tường khép đoạn
 * hở, rồi bấm "Kiểm tra vòng hở" để dò lại).
 */
export const ROOM_LABEL_SCENARIO_EMPTY: RoomLabelReviewScenario = {
  state: 'empty',
  label: labelOf('empty'),
  level: ROOM_LABEL_FIXTURE_LEVEL,
  rooms: ROOM_LABEL_FIXTURE_EMPTY,
  walls: ROOM_LABEL_SCENARIO_GAP_WALLS,
  backgroundImageUrl: ROOM_LABEL_SAMPLE_IMAGE,
  isViewerRole: false,
  isCollapsed: false,
  showOnlyUnnamed: false,
  error: null,
};

/** 2. Đang tải — chưa có dữ liệu, kể cả ảnh nền. */
export const ROOM_LABEL_SCENARIO_LOADING: RoomLabelReviewScenario = {
  state: 'loading',
  label: labelOf('loading'),
  level: ROOM_LABEL_FIXTURE_LEVEL,
  rooms: ROOM_LABEL_FIXTURE_EMPTY,
  walls: NO_WALLS,
  backgroundImageUrl: null,
  isViewerRole: false,
  isCollapsed: false,
  showOnlyUnnamed: false,
  error: null,
};

/**
 * 3. Một phần — TRẠNG THÁI CHÍNH của màn.
 *
 * Cả hai điều kiện của đặc tả cùng đúng ở đây: đúng ba phòng chưa đặt tên
 * (`ROOM_LABEL_FIXTURE_UNNAMED_COUNT`) VÀ còn một vòng hở 62 mm để danh sách
 * vòng hở có một dòng kèm kích thước.
 */
export const ROOM_LABEL_SCENARIO_PARTIAL: RoomLabelReviewScenario = {
  state: 'partial',
  label: labelOf('partial'),
  level: ROOM_LABEL_FIXTURE_LEVEL,
  rooms: ROOM_LABEL_FIXTURE_ROOMS,
  walls: ROOM_LABEL_SCENARIO_GAP_WALLS,
  backgroundImageUrl: ROOM_LABEL_SAMPLE_IMAGE,
  isViewerRole: false,
  isCollapsed: false,
  showOnlyUnnamed: false,
  error: null,
};

/**
 * 4. Lỗi — lớp phòng hỏng, nhưng ẢNH GỐC vẫn xem được.
 *
 * Điều khoản bắt buộc của kịch bản này: canvas không được trắng dù danh sách
 * trắng. `backgroundImageUrl` khác `null` chính là điều khoản đó viết ra.
 */
export const ROOM_LABEL_SCENARIO_ERROR: RoomLabelReviewScenario = {
  state: 'error',
  label: labelOf('error'),
  level: ROOM_LABEL_FIXTURE_LEVEL,
  rooms: ROOM_LABEL_FIXTURE_EMPTY,
  walls: NO_WALLS,
  backgroundImageUrl: ROOM_LABEL_SAMPLE_IMAGE,
  isViewerRole: false,
  isCollapsed: false,
  showOnlyUnnamed: false,
  error: new Error('Không tải được lớp phòng của tầng.'),
};

/** 5. Xong — 14/14 phòng đã có tên và đã được người duyệt xác nhận. */
export const ROOM_LABEL_SCENARIO_SUCCESS: RoomLabelReviewScenario = {
  state: 'success',
  label: labelOf('success'),
  level: ROOM_LABEL_FIXTURE_LEVEL,
  rooms: allNamedAndReviewed(ROOM_LABEL_FIXTURE_ROOMS),
  walls: NO_WALLS,
  backgroundImageUrl: ROOM_LABEL_SAMPLE_IMAGE,
  isViewerRole: false,
  isCollapsed: false,
  showOnlyUnnamed: false,
  error: null,
};

/** 6. Không có quyền — vai Người xem, chỉ xem; dữ liệu như `partial`. */
export const ROOM_LABEL_SCENARIO_FORBIDDEN: RoomLabelReviewScenario = {
  state: 'forbidden',
  label: labelOf('forbidden'),
  level: ROOM_LABEL_FIXTURE_LEVEL,
  rooms: ROOM_LABEL_FIXTURE_ROOMS,
  walls: ROOM_LABEL_SCENARIO_GAP_WALLS,
  backgroundImageUrl: ROOM_LABEL_SAMPLE_IMAGE,
  isViewerRole: true,
  isCollapsed: false,
  showOnlyUnnamed: false,
  error: null,
};

/** 7. Thu gọn — ẩn panel trái và thanh tra; dữ liệu như `partial`. */
export const ROOM_LABEL_SCENARIO_COLLAPSED: RoomLabelReviewScenario = {
  state: 'collapsed',
  label: labelOf('collapsed'),
  level: ROOM_LABEL_FIXTURE_LEVEL,
  rooms: ROOM_LABEL_FIXTURE_ROOMS,
  walls: ROOM_LABEL_SCENARIO_GAP_WALLS,
  backgroundImageUrl: ROOM_LABEL_SAMPLE_IMAGE,
  isViewerRole: false,
  isCollapsed: true,
  showOnlyUnnamed: false,
  error: null,
};

/** Bảy kịch bản, đúng thứ tự `SEVEN_STATES` — cho `expectSevenStates` và cho story. */
export const ROOM_LABEL_REVIEW_SCENARIOS: readonly RoomLabelReviewScenario[] = [
  ROOM_LABEL_SCENARIO_EMPTY,
  ROOM_LABEL_SCENARIO_LOADING,
  ROOM_LABEL_SCENARIO_PARTIAL,
  ROOM_LABEL_SCENARIO_ERROR,
  ROOM_LABEL_SCENARIO_SUCCESS,
  ROOM_LABEL_SCENARIO_FORBIDDEN,
  ROOM_LABEL_SCENARIO_COLLAPSED,
];
