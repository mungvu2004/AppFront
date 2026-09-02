/**
 * Cổng dữ liệu và tầng lệnh của màn S-17 "Duyệt tên phòng" — mọi lời gọi ra
 * khỏi màn đi qua đây.
 *
 * Cùng khuôn `wallLayerReviewGateway.ts` của màn QC anh em: một danh sách khả
 * năng, một bản kê nợ endpoint, một `interface` cho hình dạng, một factory
 * dựng cổng thật và một factory dựng cổng có dữ liệu cho test và story (R-73).
 *
 * ## Đường ghi — `dispatch` chạy qua `commit`
 *
 * Bốn lệnh S-07 của nhóm phòng (`room.rename`, `room.changeUsage`,
 * `room.merge`, `room.split`) đi qua `dispatch` (S-05, năm bước
 * `validate → apply → history → rules → sync`), và `SpatialPort.applyPatches`
 * của `dispatch` được cài bằng `commit(patches, label)` của
 * `src/store/commit.ts`. Nhờ vậy màn có đủ rule chạy lại sau mỗi lệnh, ngăn xếp
 * hoàn tác 100 bước của S-06 (`createHistoryStack`, KHÔNG phải `zundo`), bước
 * đồng bộ S-11 — và **không phạm A10**: không một dòng nào gọi `set()` hay
 * `_applyPatches()`.
 *
 * ## Hai lệnh dựng bằng nguyên thuỷ công khai
 *
 * `ROOM_FLOOR_COMMAND_TYPES` chỉ có bốn lệnh phòng và **không có lệnh duyệt**,
 * cũng không có lệnh đổi tên hàng loạt. Điều phối viên đã duyệt cách dựng bằng
 * `createCommand` + `changeForUpdate`, đúng tiền lệ `wall.approve` của S-12:
 * `CommandType` là `string` mở, `validateCommands` chỉ đòi `type` khác rỗng, và
 * `changeForUpdate` mang ĐỦ ảnh chụp `before`/`after` nên `invertCommand` hoàn
 * tác được mà không cần biết lệnh nghĩa là gì.
 *
 * - {@link buildApproveRoomCommand} — **A5 ép ngay ở kiểu dựng lệnh**: đây là
 *   đường DUY NHẤT đặt `reviewed: true`, và nó luôn đặt kèm `source: 'human'`.
 *   Không có tham số nào cho phép người gọi truyền `source`, nên không tồn tại
 *   đường để đầu ra AI bật cờ xanh "đã xác minh".
 * - {@link buildNormalizeNamesCommand} — MỘT lệnh mang nhiều `changeForUpdate`,
 *   nên cả lượt chuẩn hoá là MỘT bước hoàn tác. `mergeCommands` của
 *   `src/lib/commands/mergeCommands.ts` KHÔNG dùng được cho việc này: nó chỉ
 *   gộp hai lệnh cùng `type`, cùng `actorId` **và cùng tập thực thể**
 *   (`targetKey`), mà chuẩn hoá hàng loạt chạm nhiều phòng khác nhau.
 *
 * ## QUYẾT ĐỊNH CỦA ĐIỀU PHỐI VIÊN — phép quy chiếu tên nằm TRONG cổng của màn
 *
 * Khảo sát tầng logic (T1) đã tìm và **không có** hàm chuẩn hoá tên nào trong
 * `src/domain` hay `src/lib`:
 *
 * ```
 * grep -rniE "normalize|canonical|slugify|deburr|NFD|toLowerCase" src/domain src/lib
 * ```
 *
 * Mọi chỗ khớp đều là việc khác — `describeOpeningKind(...).toLowerCase()` hạ
 * chữ đầu một câu tiếng Việt, `.normalize('NFD')` của `exportGlb`/`upload` đặt
 * tên tệp an toàn, `normalizeSpatial` đổi CẤU TRÚC đồ thị chứ không đụng chuỗi.
 * Vì thế **không có chủ sở hữu nào ở tầng logic** cho việc "quy biến thể chữ tự
 * do về từ vựng chuẩn".
 *
 * Điều phối viên quyết: T5 dựng phép quy chiếu ngay trong cổng của màn, theo
 * đúng tiền lệ `wall.approve` (dùng nguyên thuỷ công khai + được duyệt trước).
 * Ràng buộc, và mã dưới đây tuân đủ:
 *
 * 1. Đích đến CHỈ được là tám nhãn của `ROOM_USAGE_LABELS`
 *    (`src/domain/rules/registry.ts`) — {@link ROOM_NAME_TARGETS} đọc thẳng
 *    bảng đó, không chép lại một danh sách thứ hai và không thêm nhãn mới.
 * 2. Phép so sánh CHỈ làm việc với VĂN BẢN: thường hoá, bỏ dấu, gom khoảng
 *    trắng, bỏ số thứ tự ở cuối — xem {@link roomNameKey}. Không một lời gọi
 *    hình học, diện tích, làm tròn hay quy đổi đơn vị nào tham gia.
 * 3. Kết quả là một BẢNG XEM TRƯỚC, không đổi gì cả — xem
 *    {@link buildNormalizePreview}.
 *
 * **Điều kiện để chuyển xuống `src/domain` sau này:** khi có màn thứ hai cần
 * cùng phép quy chiếu (ví dụ một bước hậu xử lý OCR), thì {@link roomNameKey} và
 * {@link canonicalRoomName} chuyển nguyên xuống `src/domain/rooms/classify.ts`
 * — chúng đã thuần, không chạm React, không chạm store, không chạm mạng — và
 * cổng này chỉ còn một dòng gọi lại. Chừng nào chỉ một màn dùng, chuyển xuống
 * sớm chỉ tạo một API `src/domain` không ai gọi.
 *
 * **Số thứ tự ở cuối tên được GIỮ LẠI trong kết quả**, không bị nuốt: bỏ nó thì
 * `"PHÒNG NGỦ 1"` và `"PHÒNG NGỦ 2"` cùng ra `"phòng ngủ"` — hai phòng trùng
 * tên trên cùng một tầng, đúng thứ `validateRenameRoom` (`roomFloorCommands.ts`)
 * từ chối. Số thứ tự lấy nguyên văn từ tên cũ, không sinh mới.
 *
 * ## Hình học của gộp và tách — QUYẾT ĐỊNH CỦA ĐIỀU PHỐI VIÊN
 *
 * `MergeRoomsInput` đòi `outline` của phòng sau khi gộp; `SplitRoomInput` đòi
 * cả `firstOutline` lẫn `secondOutline`. Không có hàm hợp/cắt đa giác nào trong
 * `src/domain` hay `src/lib` (grep `union|clip|splitPolygon|cutPolygon` ra
 * rỗng), nên hai hình dạng đó phải tới từ chỗ khác — và chỗ đó là **M-06
 * `detectRooms`, chạy lại trên đồ thị tường HIỆN TẠI**:
 *
 * - {@link buildMergeRoomCommand} — chọn phòng dò được mà outline chứa CẢ HAI
 *   trọng tâm (`computeCentroid` + `outlineContains`), rồi chốt an toàn bằng
 *   diện tích: phòng gộp thật phải nuốt cả phần móng tường ngăn nên diện tích
 *   của nó luôn ≥ tổng hai phần, trừ `AREA_TOLERANCE_M2`. Không thoả thì **từ
 *   chối có kiểu** kèm một bước đi tiếp cụ thể, không phát lệnh nào.
 * - {@link buildSplitRoomCommandFromWalls} — chỉ chấp nhận khi đúng HAI phòng
 *   dò được có trọng tâm nằm trong outline phòng gốc, và tổng diện tích hai
 *   phần không vượt diện tích phòng gốc cộng `AREA_TOLERANCE_M2`. Điểm cắt `at`
 *   dùng để xếp thứ tự: phần chứa `at` đứng SAU, vì `createSplitRoomCommand`
 *   chuyển đồ đạc trong `secondOutline` sang phòng mới.
 *
 * Cả hai chỉ GHÉP các hàm sẵn có của `src/domain/rooms/area.ts` và dùng đúng
 * hằng `AREA_TOLERANCE_M2` đã có; không một dung sai mới, không một phép so
 * sánh hình học tự chế nào (R-61).
 *
 * ## Ba việc chưa có đường
 *
 * - `persistRoomLabels` — **NOT FOUND**. `ENDPOINTS.spatial.floor` có thật,
 *   nhưng `PatchSpatialFloorInput.body` là `Partial<FloorWriteBody>` và
 *   `FloorWriteBody` chỉ mang `name`/`order`/`elevationMm`/`heightMm`/
 *   `drawings` — không có chỗ nào cho mảng phòng. Cổng thật trả nhánh
 *   `supported: false` có kiểu, và tự lưu nói ra sự thật đó thay vì bịa một
 *   lượt lưu đã xong.
 * - `readClearHeight` — **NOT FOUND**. `Room` không có `heightMm`; chỉ
 *   `Level.heightMm` có, và đó là CHIỀU CAO TẦNG, khác chiều cao thông thuỷ
 *   đúng bằng chiều dày sàn/trần. Hiện số chiều cao tầng dưới nhãn "thông thuỷ"
 *   là nói dối, nên `clearHeightText` luôn `null` và panel hiện nhánh "chưa có
 *   số đo" — đúng phán quyết của điều phối viên.
 * - `readRoomLayer` — phòng sống trong `src/store` (nơi `commit` ghi vào),
 *   không có endpoint nào trả về chúng (`ENDPOINTS` không có nhóm `room`).
 *   Cổng đọc chúng qua một cửa tiêm được, mặc định là chính store, dưới khoá
 *   `queryKeys.room.byFloor` — cùng cách `wallLayerReviewGateway` đọc đồ thị
 *   tường. Ảnh nền thì đọc THẬT qua `spatial.readFloor`.
 */

import type { ApiClient } from '@/api/client';
import { mockApiClient } from '@/api/__mocks__/client';
import {
  computeArea,
  computeCentroid,
  computeLargestInnerRectangle,
  computePerimeter,
  outlineContains,
  totalArea,
  type LabelRectangle,
} from '@/domain/rooms/area';
import { detectRooms, type DetectRoomsResult } from '@/domain/rooms/detect';
import { registerFunctionRules } from '@/domain/rules/function';
import {
  createRuleRegistry,
  ROOM_USAGE_LABELS,
  type RuleRegistry,
  type Violation,
} from '@/domain/rules/registry';
import { runRules } from '@/domain/rules/runner';
import { createId } from '@/domain/spatial/ids';
import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import type {
  Level,
  LevelId,
  Point,
  Room,
  RoomId,
  RoomUsage,
  SquareMetres,
  Wall,
} from '@/domain/spatial/types';
import type { PointMm } from '@/domain/units/compare';
import { millimetresPerPixel, pixels, scaleFromRatio, type Scale } from '@/domain/units/scale';
import { millimetres } from '@/domain/units/types';
import { createColoringMode, type PaintSubject } from '@/lib/coloring/modes';
import type { ColorTokenName } from '@/lib/coloring/scales';
import {
  AREA_TOLERANCE_M2,
  createChangeRoomUsageCommand,
  createMergeRoomsCommand,
  createRenameRoomCommand,
  createSplitRoomCommand,
  ROOM_FLOOR_COMMAND_TYPES,
  validateChangeRoomUsage,
  validateRenameRoom,
  type ChangeRoomUsageInput,
  type RenameRoomInput,
} from '@/lib/commands/business/roomFloorCommands';
import {
  entitiesOfKind,
  formatCount,
  readOf,
  refuse,
  toPoint,
  toPointMm,
  toSolidWall,
  type CommandContext,
  type CommandResult,
} from '@/lib/commands/business/shared';
import { changeForUpdate, createCommand } from '@/lib/commands/createCommand';
import {
  createIncrementalRuleRunner,
  dispatch,
  type DispatchDeps,
  type DispatchResult,
  type SpatialPort,
} from '@/lib/commands/dispatch';
import {
  createHistoryStack,
  NO_SELECTION,
  type HistoryStack,
  type SelectionSnapshot,
} from '@/lib/commands/history';
import type { Command } from '@/lib/commands/types';
import { fitText } from '@/lib/export/screenshot';
import { formatArea, formatLength } from '@/lib/format/measure';
import { formatNumber } from '@/lib/format/number';
import { describeConfidence } from '@/lib/format/semantic';
import { boxAround } from '@/lib/input/dragDrop';
import { createUndoTicket, UNDO_WINDOW_MS, type UndoTicket } from '@/lib/mutations/undoTicket';
import { commit } from '@/store/commit';
import { useStore } from '@/store';

import {
  ROOM_LABEL_CROP_DISPLAY_HEIGHT_PX,
  ROOM_LABEL_CROP_DISPLAY_WIDTH_PX,
  ROOM_LABEL_MIN_LABEL_BOX_HEIGHT_PX,
  ROOM_LABEL_CODE_FONT_SIZE_PX,
  ROOM_LABEL_NAME_FONT_SIZE_PX,
  type RoomLabelCropViewModel,
  type RoomLabelGapViewModel,
  type RoomLabelNoticeViewModel,
  type RoomLabelNormalizePreview,
  type RoomLabelNormalizeRow,
  type RoomLabelStatus,
  type RoomLabelSummaryViewModel,
  type RoomLabelViewModel,
} from './roomLabelTypes';
import {
  ROOM_LABEL_FIXTURE_LEVEL,
  ROOM_LABEL_FIXTURE_ROOMS,
} from './roomLabelFixture';

/* -------------------------------------------------------------------------- */
/* Chuỗi của cổng — mọi câu người dùng đọc, gom một chỗ.                       */
/* -------------------------------------------------------------------------- */

/**
 * Mọi câu tiếng Việt cổng này sinh ra.
 *
 * Chữ thường kiểu câu (A6), trừ mã phòng — một trong hai ngoại lệ A6 cho phép.
 * Hai câu từ chối của gộp/tách BẮT BUỘC nói ra bước đi tiếp cụ thể: một lời từ
 * chối không kèm việc phải làm thì người duyệt đứng lại giữa màn.
 */
export const ROOM_LABEL_TEXT = {
  mergeNeedsWallRemoved:
    'Chưa gộp được: giữa hai phòng vẫn còn một đoạn tường ngăn. Sang lớp tường xoá đoạn tường đó rồi quay lại đây gộp.',
  mergeAreaMismatch:
    'Chưa gộp được: vùng dò lại được không nuốt trọn hai phòng đang chọn. Kiểm tra lại ranh tường quanh hai phòng ở lớp tường rồi quay lại.',
  splitNeedsDividingWall:
    'Chưa tách được: chưa có tường ngăn nào chia đôi phòng này. Sang lớp tường vẽ đoạn tường ngăn rồi quay lại đây tách.',
  splitAreaMismatch:
    'Chưa tách được: hai phần dò lại được không khớp với ranh phòng hiện tại. Kiểm tra lại đoạn tường ngăn vừa vẽ ở lớp tường rồi quay lại.',
  roomNotFound: 'Không tìm thấy phòng trong bản vẽ đang mở.',
  wallsNotReadable:
    'Chưa đọc được đồ thị tường của tầng này. Sang lớp tường kiểm tra các đoạn tường lỗi rồi quay lại.',
} as const;

/** Mô tả ảnh nền cho trình đọc màn hình (R-72), ghép từ tên tầng đã có. */
export const backgroundImageAlt = (floorName: string): string =>
  `Bản vẽ gốc của ${floorName}, dùng làm nền để đối chiếu lớp phòng.`;

/** Mô tả ảnh cắt tên phòng cho trình đọc màn hình (R-72). */
export const roomImageAlt = (codeLabel: string): string =>
  `Ảnh cắt tên phòng ${codeLabel} trên bản vẽ gốc.`;

/* -------------------------------------------------------------------------- */
/* Khả năng — những gì màn hỏi thế giới bên ngoài.                             */
/* -------------------------------------------------------------------------- */

/** Tên máy đọc của từng việc màn cần. Mỗi việc chưa làm được có một dòng nợ. */
export const ROOM_LABEL_CAPABILITIES = [
  'readBackground',
  'readRoomLayer',
  'writeRoomLayer',
  'readClearHeight',
  'persistRoomLabels',
] as const;

export type RoomLabelCapability = (typeof ROOM_LABEL_CAPABILITIES)[number];

/** Việc trong danh sách trên mà bản cài đặt THẬT chưa làm được. Chỉ được ngắn đi. */
export const ROOM_LABEL_MISSING_CAPABILITIES = [
  'readClearHeight',
  'persistRoomLabels',
] as const;

export type RoomLabelMissingCapability = (typeof ROOM_LABEL_MISSING_CAPABILITIES)[number];

/** Nợ của từng khả năng, viết nguyên văn cho người nối dây sau. */
export const ROOM_LABEL_MISSING_ENDPOINTS: Readonly<
  Record<RoomLabelMissingCapability, string>
> = {
  readClearHeight:
    'Room (src/domain/spatial/types.ts:188-197) không có trường heightMm; chỉ Level.heightMm (types.ts:110) tồn tại và đó là CHIỀU CAO TẦNG, khác chiều cao thông thuỷ đúng bằng chiều dày sàn/trần — hiện nó dưới nhãn "thông thuỷ" là nói dối, nên trường này để null',
  persistRoomLabels:
    'ENDPOINTS.spatial.floor chấp nhận một danh sách phòng trong thân yêu cầu — chưa có; PatchSpatialFloorInput.body là Partial<FloorWriteBody> (src/api/client.ts:87-92,144-148), chỉ mang name/order/elevationMm/heightMm/drawings, không có chỗ cho mảng phòng',
};

/** Một khả năng chưa tồn tại. `supported: false` là câu trả lời thật, không phải lỗi. */
export interface RoomLabelUnsupported {
  readonly supported: false;
  readonly capability: RoomLabelMissingCapability;
  /** Lấy nguyên từ {@link ROOM_LABEL_MISSING_ENDPOINTS}. */
  readonly missing: string;
}

export interface RoomLabelSupported<TValue> {
  readonly supported: true;
  readonly value: TValue;
}

export type RoomLabelCapabilityResult<TValue> =
  | RoomLabelSupported<TValue>
  | RoomLabelUnsupported;

/** Dựng nhánh "chưa có đường làm việc này" — một chỗ duy nhất ghép tên với nợ. */
export function unsupported(capability: RoomLabelMissingCapability): RoomLabelUnsupported {
  return {
    supported: false,
    capability,
    missing: ROOM_LABEL_MISSING_ENDPOINTS[capability],
  };
}

/* -------------------------------------------------------------------------- */
/* Dữ liệu thô.                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Ảnh nền của lớp phòng — bản vẽ gốc đã tải lên, đọc qua `spatial.readFloor`.
 *
 * Đây là dữ liệu MÁY CHỦ duy nhất của màn, nên nó là thứ duy nhất đi qua một
 * lượt gọi mạng thật (R-64). Phòng thì sống trong store, xem
 * {@link RoomLabelGraphPort}.
 */
export interface RoomLabelBackground {
  /** `null` khi tầng chưa có bản vẽ nào — canvas vẽ khung xám chờ, không phải màn trắng. */
  readonly imageUrl: string | null;
  readonly imageAlt: string;
  readonly widthMm: number | null;
  readonly heightMm: number | null;
}

/**
 * Cửa đọc đồ thị đang sửa. Mặc định là store; test cắm một đồ thị cố định.
 *
 * Kiểu RIÊNG của màn này, cùng *hình dạng* với `WallLayerGraphPort` của S-12
 * nhưng không nhập chéo từ thư mục màn khác — đúng phán quyết của điều phối
 * viên cho mục NOT FOUND #6 của khảo sát T1.
 */
export interface RoomLabelGraphPort {
  readonly read: () => NormalizedSpatial | null;
}

export interface ReadRoomLayerInput {
  readonly projectId: string;
  readonly floorId: string;
  readonly signal?: AbortSignal;
}

export interface PersistRoomLabelsInput {
  readonly projectId: string;
  readonly floorId: string;
  readonly graph: NormalizedSpatial;
}

/* -------------------------------------------------------------------------- */
/* Cái seam.                                                                   */
/* -------------------------------------------------------------------------- */

/** Mỗi phương thức là một việc màn cần từ bên ngoài, và không có việc nào khác. */
export interface RoomLabelReviewGateway {
  /** Khả năng nào cổng này làm được, trả lời ĐỒNG BỘ — màn phải biết trước lượt vẽ đầu. */
  readonly supports: Readonly<Record<RoomLabelCapability, boolean>>;
  /** Ảnh nền của tầng. Lỗi ở ĐÂY chỉ làm mất ảnh nền, không phải hỏng lớp phòng. */
  readonly readBackground: (input: ReadRoomLayerInput) => Promise<RoomLabelBackground>;
  /** Lớp phòng của tầng. Lỗi ở đây là trạng thái `error` — ảnh gốc VẪN xem được. */
  readonly readRoomLayer: (input: ReadRoomLayerInput) => Promise<NormalizedSpatial | null>;
  /** Đồ thị đang sửa — nơi `commit` vừa ghi vào. */
  readonly graph: RoomLabelGraphPort;
  /** NOT FOUND — `persistRoomLabels`. Tự lưu nói ra sự thật này, không bịa một lượt lưu. */
  readonly persistRoomLabels: (
    input: PersistRoomLabelsInput,
  ) => Promise<RoomLabelCapabilityResult<void>>;
  /** Mã phòng mới, cho lượt tách phòng. */
  readonly nextRoomId: () => RoomId;
  /** Ai đang thao tác — đi vào `Command.actorId` và nhật ký hoạt động. */
  readonly actorId: string;
  /** Mốc giờ hiện tại. Tiêm được để test không phụ thuộc đồng hồ thật. */
  readonly now: () => number;
}

/* -------------------------------------------------------------------------- */
/* Nhãn mã phòng — mã máy dài, nhãn người đọc ngắn.                            */
/* -------------------------------------------------------------------------- */

/** Số chữ số phần đếm trong thân mã — `COUNTER_LENGTH` của `src/domain/spatial/ids.ts:41`. */
const ID_COUNTER_LENGTH = 6;

/** Bề rộng nhãn người đọc: "#R-005", không phải "#R-5". */
const DISPLAY_CODE_DIGITS = 3;

/**
 * Nhãn người đọc của một mã phòng: `R-000005ROOM` → `R-005`.
 *
 * Mã máy phải dài (thân ≥ 10 ký tự) để tầng lệnh nhận; nhãn thanh tra thì đặc
 * tả đòi đúng "#R-005". Đọc ngược sáu chữ số đếm mà `createId` sinh ra, nên nó
 * đúng cho cả phòng của bộ mẫu lẫn phòng người dùng vừa tách — không có bảng
 * tra nào phải giữ đồng bộ. Thuần cắt chuỗi: không một phép số học nào.
 */
export function roomDisplayCode(id: string): string {
  const counter = id.slice(2).slice(0, ID_COUNTER_LENGTH).replace(/^0+/u, '');

  return `${id.slice(0, 1)}-${(counter === '' ? '0' : counter).padStart(DISPLAY_CODE_DIGITS, '0')}`;
}

/** Nhãn mono của một hàng — "#R-005". */
export const roomCodeLabel = (id: string): string => `#${roomDisplayCode(id)}`;

/* -------------------------------------------------------------------------- */
/* Cửa vào — cổng thật.                                                        */
/* -------------------------------------------------------------------------- */

export interface CreateRoomLabelReviewGatewayOptions {
  /** Client tiêm được. Vắng mặt thì cổng dùng client giả dùng chung của repo. */
  readonly apiClient?: ApiClient;
  /** Cửa đọc đồ thị. Vắng mặt thì cổng đọc thẳng store. */
  readonly graph?: RoomLabelGraphPort;
  readonly actorId?: string;
  readonly now?: () => number;
  readonly nextRoomId?: () => RoomId;
}

/**
 * Người thực hiện mặc định khi nơi gọi chưa truyền ai.
 *
 * Một chuỗi ĐẶT TÊN chứ không phải chuỗi rỗng: `validateCommands` từ chối lệnh
 * thiếu `actorId`, nên một mặc định rỗng sẽ làm mọi lệnh hỏng ở bước `validate`
 * thay vì hỏng ở chỗ người nối dây quên truyền.
 */
export const ROOM_LABEL_DEFAULT_ACTOR_ID = 'room-label-reviewer';

/** Cổng thật — thứ container lớp sau gọi. */
export function createRoomLabelReviewGateway(
  options: CreateRoomLabelReviewGatewayOptions = {},
): RoomLabelReviewGateway {
  const apiClient = options.apiClient ?? mockApiClient;
  const graph: RoomLabelGraphPort = options.graph ?? {
    read: () => useStore.getState().spatial,
  };

  return {
    supports: {
      readBackground: true,
      readRoomLayer: true,
      writeRoomLayer: true,
      readClearHeight: false,
      persistRoomLabels: false,
    },

    readBackground: async ({ floorId, projectId, signal }) => {
      const result = await apiClient.spatial.readFloor(
        signal === undefined ? { floorId, projectId } : { floorId, projectId, signal },
      );

      if (!result.ok) {
        throw result.error;
      }

      const drawing = result.data.drawings[0];

      return {
        imageUrl: drawing?.url ?? null,
        imageAlt: backgroundImageAlt(result.data.name),
        widthMm: drawing?.widthMm ?? null,
        heightMm: drawing?.heightMm ?? null,
      };
    },

    readRoomLayer: () => Promise.resolve(graph.read()),

    graph,

    persistRoomLabels: () => Promise.resolve(unsupported('persistRoomLabels')),

    nextRoomId: options.nextRoomId ?? ((): RoomId => createId('room')),
    actorId: options.actorId ?? ROOM_LABEL_DEFAULT_ACTOR_ID,
    now: options.now ?? ((): number => Date.now()),
  };
}

/* -------------------------------------------------------------------------- */
/* Bộ mẫu — chỗ story và test cắm vào (R-73).                                  */
/* -------------------------------------------------------------------------- */

/** Ảnh nền của bộ mẫu. Không phải đường dẫn thật, nên không phạm R-65. */
export const ROOM_LABEL_SAMPLE_IMAGE = 'sample-floor-plan.png';

/**
 * Khổ bản vẽ mẫu — bao trọn dãy 14 phòng của `roomLabelFixture.ts`, có lề.
 *
 * Hai con số này là DỮ LIỆU của bộ mẫu (khổ tờ bản vẽ), không phải ngưỡng hay
 * thời lượng, nên chúng thuộc về bảng dữ liệu này chứ không phải một hằng rải
 * trong thân hàm.
 */
export const ROOM_LABEL_SAMPLE_DRAWING_WIDTH_MM = 70600;
export const ROOM_LABEL_SAMPLE_DRAWING_HEIGHT_MM = 6000;

/** Cách bài kiểm ép một cảnh cụ thể, không sửa mã. */
export interface RoomLabelGatewaySeed {
  /** Đồ thị cổng trả về. Vắng mặt thì cổng đọc store thật. */
  readonly graph?: NormalizedSpatial | null;
  /** `true` thì `readBackground` ném — ảnh nền mất, lớp phòng thì không. */
  readonly failReadBackground?: boolean;
  /** `true` thì `readRoomLayer` ném — đúng cảnh `error` của bảy kịch bản. */
  readonly failReadRoomLayer?: boolean;
  /** `true` thì ảnh nền chưa có — canvas vẽ khung xám chờ, ảnh cắt thành `null`. */
  readonly withoutImage?: boolean;
  /** `true` thì `persistRoomLabels` chạy thật (bộ mẫu có đường lưu), cho nhãn "Đã lưu lúc…". */
  readonly canPersist?: boolean;
  readonly actorId?: string;
  readonly now?: () => number;
  readonly nextRoomId?: () => RoomId;
}

/** Cổng có dữ liệu — dùng chung giữa test và story, không bịa bảng dữ liệu thứ hai (R-70). */
export function createMockRoomLabelReviewGateway(
  seed: RoomLabelGatewaySeed = {},
): RoomLabelReviewGateway {
  const canPersist = seed.canPersist ?? true;
  let counter = 0;

  return {
    supports: {
      readBackground: true,
      readRoomLayer: true,
      writeRoomLayer: true,
      readClearHeight: false,
      persistRoomLabels: canPersist,
    },

    readBackground: () => {
      if (seed.failReadBackground === true) {
        return Promise.reject(new Error('Không tải được bản vẽ gốc của tầng.'));
      }

      const hasImage = seed.withoutImage !== true;

      return Promise.resolve({
        imageUrl: hasImage ? ROOM_LABEL_SAMPLE_IMAGE : null,
        imageAlt: backgroundImageAlt(ROOM_LABEL_FIXTURE_LEVEL.name),
        widthMm: hasImage ? ROOM_LABEL_SAMPLE_DRAWING_WIDTH_MM : null,
        heightMm: hasImage ? ROOM_LABEL_SAMPLE_DRAWING_HEIGHT_MM : null,
      });
    },

    readRoomLayer: () => {
      if (seed.failReadRoomLayer === true) {
        return Promise.reject(new Error('Không tải được lớp phòng của tầng.'));
      }

      return Promise.resolve(seed.graph ?? useStore.getState().spatial);
    },

    graph: { read: () => seed.graph ?? useStore.getState().spatial },

    persistRoomLabels: () =>
      Promise.resolve(
        canPersist ? { supported: true, value: undefined } : unsupported('persistRoomLabels'),
      ),

    /*
     * Mã phòng mới của bộ mẫu — cùng khuôn `createId`, KHÔNG phải "R-M1".
     *
     * Thân mã phải dài ít nhất 10 ký tự `[0-9A-Z]` hoặc `dispatch` từ chối lệnh
     * tách ngay ở bước kiểm (xem đầu `roomLabelFixture.ts`). Vẫn tất định: số
     * đếm chạy trong phạm vi một cổng giả, đuôi là hằng.
     */
    nextRoomId:
      seed.nextRoomId ??
      ((): RoomId => {
        counter += 1;

        return `R-${formatNumber(counter, { grouping: false, fractionDigits: 0 }).padStart(
          ID_COUNTER_LENGTH,
          '0',
        )}MOCK` as RoomId;
      }),
    actorId: seed.actorId ?? ROOM_LABEL_DEFAULT_ACTOR_ID,
    now: seed.now ?? ((): number => Date.now()),
  };
}

/** Bộ mẫu đầy đủ, đúng 14 phòng / 248,60 m² — xem `roomLabelFixture.ts`. */
export const ROOM_LABEL_SAMPLE_ROOMS = ROOM_LABEL_FIXTURE_ROOMS;

/* -------------------------------------------------------------------------- */
/* Đọc đồ thị.                                                                 */
/* -------------------------------------------------------------------------- */

const NO_ROOMS: readonly Room[] = [];
const NO_WALLS: readonly Wall[] = [];

/** Phòng của một tầng, theo đúng thứ tự đồ thị giữ chúng. */
export function roomsOfLevel(
  graph: NormalizedSpatial | null,
  levelId: LevelId | null,
): readonly Room[] {
  if (graph === null || levelId === null) {
    return NO_ROOMS;
  }

  return entitiesOfKind(graph, 'room').filter((room) => room.levelId === levelId);
}

/** Tường của một tầng — nguyên liệu của `detectRooms` và của danh sách vòng hở. */
export function wallsOfLevel(
  graph: NormalizedSpatial | null,
  levelId: LevelId | null,
): readonly Wall[] {
  if (graph === null || levelId === null) {
    return NO_WALLS;
  }

  return entitiesOfKind(graph, 'wall').filter((wall) => wall.levelId === levelId);
}

/** Tầng đang duyệt, hoặc tầng đầu tiên khi nơi gọi chưa chỉ định. */
export function levelOf(
  graph: NormalizedSpatial | null,
  levelId: LevelId | undefined,
): Level | null {
  if (graph === null) {
    return null;
  }

  const id = levelId ?? graph.byKind.level[0];

  return id === undefined ? null : readOf(graph, 'level', id as LevelId);
}

/** Tỷ lệ của tầng; tầng chưa hiệu chỉnh thì một milimét trên một điểm ảnh. */
export const scaleOfLevel = (level: Level | null): Scale =>
  scaleFromRatio(level?.scaleMillimetresPerPixel ?? millimetresPerPixel(1));

/** Một điểm milimét của đồ thị, đọc trên ảnh bản vẽ. */
export const toPixelPoint = (point: Point, scale: Scale): Point => ({
  x: scale.millimetresToPixels(millimetres(point.x)),
  y: scale.millimetresToPixels(millimetres(point.y)),
});

/* -------------------------------------------------------------------------- */
/* Vòng hở — GỌI LẠI M-06, không tự dò.                                        */
/* -------------------------------------------------------------------------- */

/**
 * Chạy lại M-06 trên tường của tầng.
 *
 * `detectRooms` ném `RangeError` khi một tường không dùng được (dày ngoài
 * 60–600 mm, dài 0) và `Error` khi hai tường trùng mã. Một bản vẽ hỏng không
 * được làm trắng màn (A11), nên lỗi đó thành `null` — "không dò lại được" — và
 * phần còn lại của màn vẫn đọc được.
 */
export function detectRoomsOfLevel(
  walls: readonly Wall[],
  level: Level | null,
): DetectRoomsResult | null {
  if (walls.length === 0 || level === null) {
    return null;
  }

  try {
    return detectRooms(walls.map((wall) => toSolidWall(wall, level)));
  } catch {
    return null;
  }
}

/**
 * Vòng tường hở, đã định dạng kích thước khe hở.
 *
 * `gapMm`/`position` chuyền tay từ `WeldedGap` của `buildWallGraph` (mà
 * `detectRooms` trả lại nguyên trong `.graph`), không tính lại (R-61).
 */
export function gapsOf(detected: DetectRoomsResult | null): readonly RoomLabelGapViewModel[] {
  if (detected === null) {
    return [];
  }

  return detected.graph.weldedGaps.map((gap) => ({
    wallIds: [...gap.wallIds].sort(),
    gapText: formatLength(gap.gapMm),
    positionMm: gap.position,
  }));
}

/** Mã các tường có đầu tự do — nguồn thứ hai của "vòng tường chưa khép kín". */
export function deadEndsOf(detected: DetectRoomsResult | null): readonly string[] {
  return detected === null ? [] : detected.graph.deadEndWallIds;
}

/* -------------------------------------------------------------------------- */
/* Đo phòng — GỌI M-07, màn KHÔNG tự tính diện tích.                            */
/* -------------------------------------------------------------------------- */

/** Bốn góc của hộp nhãn, đọc thẳng từ `LabelRectangle` — không một phép tính nào. */
const cornersOfRectangle = (rect: LabelRectangle): readonly PointMm[] => [
  rect.min,
  { x: rect.max.x, y: rect.min.y },
  rect.max,
  { x: rect.min.x, y: rect.max.y },
];

/** Hộp nhãn quy sang pixel ảnh — `null` khi phòng không có ô nào đủ chỗ. */
export interface RoomLabelBoxPx {
  readonly widthPx: number;
  readonly heightPx: number;
}

/**
 * Mọi số đo HÌNH HỌC của một phòng.
 *
 * Tách riêng khỏi phần chữ nghĩa (tên, công năng, trạng thái) vì đây là phần
 * DUY NHẤT phải tính lại khi hình học đổi — đổi tên không đụng tới nó. Hook giữ
 * bảng này trong một `useMemo` khoá theo hình học, xem `useRoomLabelReview.ts`.
 */
export interface RoomLabelMeasures {
  readonly areaM2: SquareMetres;
  readonly areaText: string;
  readonly perimeterText: string;
  readonly labelAnchorMm: PointMm;
  readonly labelBoxPx: RoomLabelBoxPx | null;
}

/**
 * Đo một phòng bằng M-07, không một công thức nào của màn.
 *
 * - diện tích: `computeArea` — **màn không tự cộng, không tự nhân**;
 * - chu vi: `computePerimeter`;
 * - tâm nhãn: `computeLargestInnerRectangle` cho hộp chữ nhật trong lớn nhất,
 *   rồi `computeCentroid` trên đúng bốn góc của hộp đó (tâm của một hình chữ
 *   nhật chính là trọng tâm của nó, và `computeCentroid` là hàm domain làm việc
 *   ấy — màn không viết `(min + max) / 2`). Phòng không có hộp nào lọt thì rơi
 *   về trọng tâm của chính đa giác.
 */
export function measureRoom(room: Room, scale: Scale): RoomLabelMeasures {
  const outlineMm = room.outline.map(toPointMm);
  const rect = computeLargestInnerRectangle(outlineMm);

  return {
    areaM2: computeArea(outlineMm),
    areaText: formatArea(computeArea(outlineMm)),
    perimeterText: formatLength(computePerimeter(outlineMm)),
    labelAnchorMm:
      rect === null ? computeCentroid(outlineMm) : computeCentroid(cornersOfRectangle(rect)),
    labelBoxPx:
      rect === null
        ? null
        : {
            widthPx: scale.millimetresToPixels(rect.widthMm),
            heightPx: scale.millimetresToPixels(rect.heightMm),
          },
  };
}

/**
 * Nhãn tên có vừa hộp lớn nhất bên trong phòng không.
 *
 * Không có hằng "diện tích tối thiểu để hiện nhãn" nào trong repo và bịa một
 * ngưỡng mét vuông là phạm R-71, nên phép quyết định ở đây là **so hai kích
 * thước**: hộp chữ nhật trong lớn nhất (M-07 tính) với hộp chữ mà hai dòng nhãn
 * cần. So sánh hai kích thước là việc TRÌNH BÀY, không phải một công thức hình
 * học mới — đúng phán quyết của điều phối viên cho mục NOT FOUND #7.
 *
 * Bề rộng hỏi `fitText` (`src/lib/export/screenshot.ts`), hàm duy nhất trong
 * repo trả lời "chuỗi này có vừa bề rộng này không": nó cắt chuỗi khi không
 * vừa, nên "không bị cắt" chính là "vừa". Chiều cao so với
 * {@link ROOM_LABEL_MIN_LABEL_BOX_HEIGHT_PX} — tổng hai cỡ chữ của lớp giao
 * diện, cận dưới của hai dòng chữ.
 */
export function labelFitsIn(
  box: RoomLabelBoxPx | null,
  name: string,
  codeLabel: string,
): boolean {
  if (box === null || box.heightPx < ROOM_LABEL_MIN_LABEL_BOX_HEIGHT_PX) {
    return false;
  }

  return (
    fitText(name, ROOM_LABEL_NAME_FONT_SIZE_PX, box.widthPx) === name &&
    fitText(codeLabel, ROOM_LABEL_CODE_FONT_SIZE_PX, box.widthPx) === codeLabel
  );
}

/**
 * Dòng tóm tắt đầu panel trái.
 *
 * Tổng diện tích tính bằng `totalArea` — cộng ở đơn vị mm² rồi làm tròn MỘT
 * lần, KHÔNG cộng các `areaText` đã làm tròn của từng phòng.
 */
export function summaryOf(rooms: readonly Room[]): RoomLabelSummaryViewModel {
  return {
    totalAreaText: formatArea(totalArea(rooms.map((room) => room.outline.map(toPointMm)))),
    roomCount: rooms.length,
    unnamedCount: rooms.filter((room) => room.name.trim() === '').length,
  };
}

/* -------------------------------------------------------------------------- */
/* Nhắc công năng M-14 — NHẮC, không bao giờ CHẶN.                             */
/* -------------------------------------------------------------------------- */

/**
 * Sổ luật của màn, có đủ bảy luật công năng.
 *
 * `defaultRuleRegistry()` dùng chung của ứng dụng CHƯA có bảy luật này và
 * không nơi nào trong `src/main.tsx`/`src/App.tsx` gọi `registerFunctionRules`
 * (khảo sát T1, mục NOT FOUND #5). Điều phối viên quyết: cổng của màn tự gọi
 * `registerFunctionRules` trên sổ NÓ DỰNG — sửa `src/main.tsx` để đăng ký toàn
 * cục thì không, R-68 cấm. Sổ riêng cũng có nghĩa một lượt bật/tắt luật ở màn
 * này không rò sang màn khác.
 */
export function createRoomRuleRegistry(): RuleRegistry {
  const registry = createRuleRegistry();

  registerFunctionRules(registry);

  return registry;
}

/** Chạy bảy luật công năng trên đồ thị hiện tại. Kết quả là NHẮC, không phải cổng chặn. */
export function runRoomRules(
  graph: NormalizedSpatial,
  registry: RuleRegistry,
): readonly Violation[] {
  return runRules(graph, { registry }).violations;
}

/**
 * Nhắc của MỘT phòng.
 *
 * Không có hàm lọc `Violation[]` theo `roomId` nào trong repo (khảo sát T1,
 * mục NOT FOUND #1; `groupViolationsByLevel` nhóm theo TẦNG). Điều phối viên
 * quyết: lọc bằng `entityId === room.id` ngay tại đây — một phép lọc mảng, tức
 * là GHÉP LẠI chứ không phải một công thức mới, nên không phạm R-61.
 */
export function noticesOfRoom(
  violations: readonly Violation[],
  roomId: RoomId,
  ruleRouteHref: string,
): readonly RoomLabelNoticeViewModel[] {
  return violations
    .filter((violation) => violation.entityId === roomId)
    .map((violation) => ({
      ruleCode: violation.ruleCode,
      severity: violation.severity,
      message: violation.message,
      suggestion: violation.suggestion,
      ruleRouteHref,
    }));
}

/* -------------------------------------------------------------------------- */
/* Ảnh cắt gốc — khuôn của `DimensionCropViewModel`, KHÔNG nhập chéo.          */
/* -------------------------------------------------------------------------- */

/**
 * Ảnh cắt 1:1 của vùng ghi tên phòng, đặt cạnh `ConfidenceMeter`.
 *
 * Khung cắt là ô nhãn trên ẢNH GỐC, tâm đúng tại tâm nhãn mà M-07 chọn; ô hiển
 * thị đúng bằng khung cắt — đó là điều "1:1" nghĩa là. `boxAround`
 * (`src/lib/input/dragDrop.ts`) dựng hộp quanh một tâm và không biết đơn vị
 * nào cả, nên dùng nguyên được cho toạ độ pixel; hai cỡ ô lấy từ hằng đã khai ở
 * `roomLabelTypes.ts` (R-71), không viết lại 160/96.
 */
export function cropOfRoom(
  room: Room,
  measures: RoomLabelMeasures,
  scale: Scale,
  imageUrl: string,
): RoomLabelCropViewModel {
  const centre = toPixelPoint(measures.labelAnchorMm, scale);
  const box = boxAround(
    centre,
    ROOM_LABEL_CROP_DISPLAY_WIDTH_PX,
    ROOM_LABEL_CROP_DISPLAY_HEIGHT_PX,
  );

  return {
    imageUrl,
    sourcePx: {
      x: box.min.x,
      y: box.min.y,
      width: ROOM_LABEL_CROP_DISPLAY_WIDTH_PX,
      height: ROOM_LABEL_CROP_DISPLAY_HEIGHT_PX,
    },
    displayWidthPx: ROOM_LABEL_CROP_DISPLAY_WIDTH_PX,
    displayHeightPx: ROOM_LABEL_CROP_DISPLAY_HEIGHT_PX,
    alt: roomImageAlt(roomCodeLabel(room.id)),
  };
}

/* -------------------------------------------------------------------------- */
/* Màu nền theo công năng — GỌI LẠI bộ tô màu, không dựng bảng thứ hai.        */
/* -------------------------------------------------------------------------- */

/**
 * Chế độ tô "theo công năng phòng" của `src/lib/coloring`.
 *
 * Dựng đúng một lần: `paint` của chế độ này là một bảng tra thuần, không đọc
 * `subjects`, nên một ngữ cảnh rỗng là đủ và kết quả không đổi theo màn hình.
 *
 * **CẤM TUYỆT ĐỐI của đặc tả — màu công năng phải rất nhạt** — thoả bằng cách
 * dùng lại đúng bảng này: năm bậc của `SEQUENTIAL_RAMP` là năm màu trung tính
 * nhạt của bảng token, KHÔNG phải màu nhấn và KHÔNG phải ba màu trạng thái
 * (A2/A4). Màn không tự chọn một mã màu nào, nên không có đường nào để một màu
 * đậm lọt vào nền phòng.
 */
const USAGE_COLORING_MODE = createColoringMode('roomUsage', { subjects: [] });

/** Token nền của một phòng, theo công năng. */
export function fillTokenOf(room: Room): ColorTokenName {
  const subject: PaintSubject = {
    id: room.id,
    levelId: room.levelId,
    review: { confidence: room.confidence, source: room.source, reviewed: room.reviewed },
    usage: room.usage,
    areaM2: room.areaM2,
    worstSeverity: null,
  };

  return USAGE_COLORING_MODE.paint(subject);
}

/* -------------------------------------------------------------------------- */
/* Một dòng phòng — mọi con số đã thành chuỗi trước khi rời khỏi đây (A15).    */
/* -------------------------------------------------------------------------- */

/**
 * Ba chấm trạng thái.
 *
 * `'confirmed'` CHỈ khi `reviewed === true` (A5): đổi tên không tự bật cờ này.
 */
export function statusOfRoom(room: Room): RoomLabelStatus {
  if (room.name.trim() === '') {
    return 'unnamed';
  }

  return room.reviewed ? 'confirmed' : 'suggested';
}

export interface ToRoomLabelRowOptions {
  readonly measures: RoomLabelMeasures;
  readonly notices: readonly RoomLabelNoticeViewModel[];
  /** Ảnh nền của tầng; `null` thì không có gì để cắt. */
  readonly backgroundImageUrl: string | null;
  readonly scale: Scale;
}

/** Một dòng phòng đã sẵn sàng để VẼ, không còn phép tính nào. */
export function toRoomLabelRow(room: Room, options: ToRoomLabelRowOptions): RoomLabelViewModel {
  const codeLabel = roomCodeLabel(room.id);
  const nameFromOcr = room.source === 'ai';
  const hasName = room.name.trim() !== '';

  return {
    id: room.id,
    codeLabel,
    name: room.name,
    hasName,
    usage: room.usage,
    usageLabel: ROOM_USAGE_LABELS[room.usage],
    areaText: options.measures.areaText,
    perimeterText: options.measures.perimeterText,
    /*
     * NOT FOUND — `readClearHeight`. `Level.heightMm` là chiều cao TẦNG, không
     * phải chiều cao thông thuỷ; hiện nó dưới nhãn "thông thuỷ" là nói dối, nên
     * trường này luôn `null` và panel hiện nhánh "chưa có số đo".
     */
    clearHeightText: null,
    outlineMm: room.outline,
    labelAnchorMm: options.measures.labelAnchorMm,
    labelFits: labelFitsIn(options.measures.labelBoxPx, room.name, codeLabel),
    fillToken: fillTokenOf(room),
    confidence: room.confidence,
    confidenceLabel: describeConfidence(room.confidence).label,
    nameFromOcr,
    crop:
      nameFromOcr && hasName && options.backgroundImageUrl !== null
        ? cropOfRoom(room, options.measures, options.scale, options.backgroundImageUrl)
        : null,
    status: statusOfRoom(room),
    notices: options.notices,
  };
}

/* -------------------------------------------------------------------------- */
/* Chuẩn hoá tên — phép quy chiếu VĂN BẢN, xem khối chú thích đầu file.        */
/* -------------------------------------------------------------------------- */

/**
 * Tám nhãn công năng của `ROOM_USAGE_LABELS`, đọc thẳng — KHÔNG chép lại.
 *
 * Đặc tả gốc liệt kê mười mục (thêm gara, kho, văn phòng, phòng họp); định
 * nghĩa một danh sách mười mục riêng trong màn là "định nghĩa lại danh mục" nên
 * bị cấm, và điều phối viên đã chốt: danh mục công năng VÀ danh sách gợi ý tên
 * đều lấy từ `ROOM_USAGE_LABELS`. Chữ tự do LUÔN được chấp nhận: một tên không
 * khớp nhãn nào chỉ đơn giản không xuất hiện trong bảng xem trước.
 */
export const ROOM_NAME_TARGETS: readonly string[] = Object.values(ROOM_USAGE_LABELS);

/** Cặp `RoomUsage` ↔ nhãn, cho danh sách gợi ý tên và ô chọn công năng. */
export const ROOM_USAGE_CHOICES: readonly { readonly usage: RoomUsage; readonly label: string }[] =
  (Object.keys(ROOM_USAGE_LABELS) as readonly RoomUsage[]).map((usage) => ({
    usage,
    label: ROOM_USAGE_LABELS[usage],
  }));

/** Dấu tổ hợp của tiếng Việt sau khi tách bằng `NFD`. */
const COMBINING_MARKS = /[̀-ͯ]/gu;

/** Số thứ tự ở CUỐI tên: `"phòng ngủ 1"` → phần `" 1"`. */
const TRAILING_ORDINAL = /\s+(\d+)$/u;

/**
 * Khoá so sánh của một tên phòng — thuần VĂN BẢN.
 *
 * Thường hoá, bỏ dấu (`NFD` rồi bỏ dấu tổ hợp, `đ` → `d`), gom khoảng trắng, bỏ
 * số thứ tự ở cuối. Không một phép hình học, diện tích, làm tròn hay quy đổi
 * đơn vị nào tham gia — đúng ràng buộc của điều phối viên.
 */
export function roomNameKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(TRAILING_ORDINAL, '')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/đ/gu, 'd')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** Bảng tra khoá → nhãn chuẩn, dựng một lần từ tám nhãn. */
const TARGET_BY_KEY: ReadonlyMap<string, string> = new Map(
  ROOM_NAME_TARGETS.map((target) => [roomNameKey(target), target]),
);

/**
 * Tên chuẩn của một tên tự do, hoặc `null` khi không có gì để đổi.
 *
 * `null` có nghĩa: tên rỗng, tên không khớp nhãn nào (chữ tự do — luôn được
 * chấp nhận, không bao giờ bị ép), hoặc tên đã đúng chuẩn rồi. Số thứ tự ở cuối
 * được GIỮ nguyên văn, xem lý do ở khối chú thích đầu file.
 */
export function canonicalRoomName(raw: string): string | null {
  const trimmed = raw.trim();

  if (trimmed === '') {
    return null;
  }

  const target = TARGET_BY_KEY.get(roomNameKey(trimmed));

  if (target === undefined) {
    return null;
  }

  const ordinal = TRAILING_ORDINAL.exec(trimmed);
  const next = ordinal === null ? target : `${target} ${ordinal[1] ?? ''}`.trim();

  return next === trimmed ? null : next;
}

/**
 * Bảng xem trước "Chuẩn hoá tên" — KHÔNG đổi gì cả.
 *
 * Hai lượt lọc, theo đúng thứ tự: quy chiếu từng tên, rồi bỏ những dòng có tên
 * mới ĐỤNG một tên đang dùng trên cùng tầng (kể cả một dòng khác của chính bảng
 * này). `validateRenameRoom` từ chối trùng tên trong cùng một tầng, nên một
 * dòng như vậy là một lệnh chắc chắn hỏng — bỏ nó ở đây trung thực hơn là để
 * người dùng bấm "Áp dụng" rồi mới thấy nó rơi.
 */
export function buildNormalizePreview(rooms: readonly Room[]): RoomLabelNormalizePreview {
  const taken = new Set(
    rooms.map((room) => room.name.trim().toLowerCase()).filter((name) => name !== ''),
  );
  const rows: RoomLabelNormalizeRow[] = [];

  for (const room of rooms) {
    const next = canonicalRoomName(room.name);

    if (next === null || taken.has(next.toLowerCase())) {
      continue;
    }

    taken.delete(room.name.trim().toLowerCase());
    taken.add(next.toLowerCase());
    rows.push({
      roomId: room.id,
      codeLabel: roomCodeLabel(room.id),
      from: room.name,
      to: next,
    });
  }

  return { rows, changedCount: rows.length };
}

/* -------------------------------------------------------------------------- */
/* Tầng lệnh — bốn lệnh S-07 gọi lại, hai lệnh dựng bằng nguyên thuỷ.          */
/* -------------------------------------------------------------------------- */

/** Ngữ cảnh mà bốn hàm dựng lệnh của S-07 đọc. */
export const commandContextOf = (
  graph: NormalizedSpatial,
  actorId: string,
): CommandContext => ({ graph, actorId });

/** Đổi tên một phòng — gọi lại S-07, không dựng lại. */
export const buildRenameRoomCommand = (
  input: RenameRoomInput,
  context: CommandContext,
): CommandResult => createRenameRoomCommand(input, context);

/** Lý do một lượt đổi tên bị từ chối, cho ô nhập nói ra ngay khi gõ. */
export const renameRoomProblems = (
  input: RenameRoomInput,
  context: CommandContext,
): readonly string[] => validateRenameRoom(input, context);

/** Đổi công năng — gọi lại S-07. */
export const buildChangeUsageCommand = (
  input: ChangeRoomUsageInput,
  context: CommandContext,
): CommandResult => createChangeRoomUsageCommand(input, context);

/** Lý do một lượt đổi công năng bị từ chối. */
export const changeUsageProblems = (
  input: ChangeRoomUsageInput,
  context: CommandContext,
): readonly string[] => validateChangeRoomUsage(input, context);

/**
 * Gộp hai phòng — hình học tới từ M-06 chạy lại, xem khối chú thích đầu file.
 *
 * Hai điều kiện, cả hai bắt buộc: outline dò lại được phải chứa CẢ HAI trọng
 * tâm, và diện tích của nó không được nhỏ hơn tổng hai phòng cũ trừ
 * `AREA_TOLERANCE_M2`. Không thoả thì từ chối kèm một bước đi tiếp cụ thể.
 */
export function buildMergeRoomCommand(
  input: { readonly targetRoomId: RoomId; readonly absorbedRoomId: RoomId },
  context: CommandContext,
  walls: readonly Wall[],
  level: Level | null,
): CommandResult {
  const type = ROOM_FLOOR_COMMAND_TYPES.mergeRooms;
  const target = readOf(context.graph, 'room', input.targetRoomId);
  const absorbed = readOf(context.graph, 'room', input.absorbedRoomId);

  if (target === null || absorbed === null) {
    return refuse(type, [ROOM_LABEL_TEXT.roomNotFound]);
  }

  const detected = detectRoomsOfLevel(walls, level);

  if (detected === null) {
    return refuse(type, [ROOM_LABEL_TEXT.wallsNotReadable]);
  }

  const targetCentre = computeCentroid(target.outline.map(toPointMm));
  const absorbedCentre = computeCentroid(absorbed.outline.map(toPointMm));
  const candidate = detected.rooms.find(
    (room) =>
      outlineContains(room.outline, targetCentre) && outlineContains(room.outline, absorbedCentre),
  );

  if (candidate === undefined) {
    return refuse(type, [ROOM_LABEL_TEXT.mergeNeedsWallRemoved]);
  }

  /*
   * Chốt an toàn về diện tích, theo yêu cầu của điều phối viên: phòng gộp thật
   * nuốt cả phần móng tường ngăn, nên diện tích của nó LUÔN ≥ tổng hai phần.
   * Nhỏ hơn nghĩa là vùng vừa chọn không phải phòng gộp.
   */
  if (computeArea(candidate.outline) < target.areaM2 + absorbed.areaM2 - AREA_TOLERANCE_M2) {
    return refuse(type, [ROOM_LABEL_TEXT.mergeAreaMismatch]);
  }

  return createMergeRoomsCommand(
    {
      targetRoomId: input.targetRoomId,
      absorbedRoomId: input.absorbedRoomId,
      outline: candidate.outline.map(toPoint),
    },
    context,
  );
}

/**
 * Tách một phòng — hình học tới từ M-06 chạy lại, xem khối chú thích đầu file.
 *
 * Chỉ chạy khi đúng HAI phòng dò được có trọng tâm nằm trong outline phòng gốc
 * (ba phòng trở lên nghĩa là đang nhìn nhầm vùng), và tổng diện tích hai phần
 * không vượt diện tích phòng gốc cộng `AREA_TOLERANCE_M2`. Điểm cắt `at` xếp
 * thứ tự: phần chứa nó đứng SAU, vì `createSplitRoomCommand` chuyển đồ đạc
 * trong `secondOutline` sang phòng mới.
 */
export function buildSplitRoomCommandFromWalls(
  input: { readonly roomId: RoomId; readonly newRoomId: RoomId; readonly at: Point },
  context: CommandContext,
  walls: readonly Wall[],
  level: Level | null,
): CommandResult {
  const type = ROOM_FLOOR_COMMAND_TYPES.splitRoom;
  const room = readOf(context.graph, 'room', input.roomId);

  if (room === null) {
    return refuse(type, [ROOM_LABEL_TEXT.roomNotFound]);
  }

  const detected = detectRoomsOfLevel(walls, level);

  if (detected === null) {
    return refuse(type, [ROOM_LABEL_TEXT.wallsNotReadable]);
  }

  const outlineMm = room.outline.map(toPointMm);
  const parts = detected.rooms.filter((part) =>
    outlineContains(outlineMm, computeCentroid(part.outline)),
  );

  if (parts.length !== 2) {
    return refuse(type, [ROOM_LABEL_TEXT.splitNeedsDividingWall]);
  }

  if (totalArea(parts.map((part) => part.outline)) > room.areaM2 + AREA_TOLERANCE_M2) {
    return refuse(type, [ROOM_LABEL_TEXT.splitAreaMismatch]);
  }

  const cut = toPointMm(input.at);
  const [first, second] = outlineContains(parts[0]?.outline ?? [], cut)
    ? [parts[1], parts[0]]
    : [parts[0], parts[1]];

  if (first === undefined || second === undefined) {
    return refuse(type, [ROOM_LABEL_TEXT.splitNeedsDividingWall]);
  }

  return createSplitRoomCommand(
    {
      roomId: input.roomId,
      newRoomId: input.newRoomId,
      firstOutline: first.outline.map(toPoint),
      secondOutline: second.outline.map(toPoint),
    },
    context,
  );
}

/* -------------------------------------------------------------------------- */
/* Hai lệnh dựng bằng nguyên thuỷ công khai.                                   */
/* -------------------------------------------------------------------------- */

/**
 * Loại của lệnh duyệt.
 *
 * Không nằm trong `ROOM_FLOOR_COMMAND_TYPES` vì lệnh này không tồn tại ở S-07;
 * hằng đặt tên ở đây là chỗ DUY NHẤT chuỗi đó được viết (R-71).
 */
export const ROOM_APPROVE_COMMAND_TYPE = 'room.approve';

/** Loại của lệnh chuẩn hoá tên hàng loạt — MỘT lệnh, MỘT bước hoàn tác. */
export const ROOM_NORMALIZE_COMMAND_TYPE = 'room.normalizeNames';

/** Câu mô tả trên nút hoàn tác và nhật ký hoạt động — `validateCommands` đòi nó khác rỗng. */
export const approveDescription = (roomId: RoomId): string =>
  `Duyệt tên phòng ${roomCodeLabel(roomId)}.`;

/** Câu mô tả của lượt chuẩn hoá — cũng là câu trên toast hoàn tác. */
export const normalizeDescription = (changedCount: number): string =>
  `Chuẩn hoá tên ${formatCount(changedCount)} phòng.`;

/**
 * Lệnh duyệt một phòng.
 *
 * A5: đây là đường DUY NHẤT đặt `reviewed: true`, và nó luôn đặt kèm
 * `source: 'human'` — không có tham số nào cho phép nơi gọi truyền `source`,
 * nên đầu ra AI không có đường nào bật được cờ xanh "đã xác minh".
 */
export function buildApproveRoomCommand(before: Room, actorId: string): Command {
  const after: Room = { ...before, reviewed: true, source: 'human' };

  return createCommand({
    type: ROOM_APPROVE_COMMAND_TYPE,
    actorId,
    description: approveDescription(before.id),
    changes: [changeForUpdate('room', before, after)],
  });
}

/**
 * Lệnh chuẩn hoá tên hàng loạt — MỘT lệnh mang nhiều thay đổi.
 *
 * Một lệnh nghĩa là MỘT mục trong ngăn xếp hoàn tác: người duyệt bấm hoàn tác
 * một lần thì cả lượt chuẩn hoá quay lại. `changeForUpdate` mang đủ ảnh chụp
 * `before`/`after` cho từng phòng nên `invertCommand` trả lại đúng tên cũ.
 *
 * A5: lệnh này KHÔNG đụng `reviewed` — đổi tên không phải duyệt.
 * Trả `null` khi bảng xem trước rỗng: một lệnh không thay đổi gì không đáng một
 * mục hoàn tác.
 */
export function buildNormalizeNamesCommand(
  rooms: readonly Room[],
  preview: RoomLabelNormalizePreview,
  actorId: string,
): Command | null {
  const byId = new Map(rooms.map((room) => [room.id, room]));
  const changes = preview.rows.flatMap((row) => {
    const before = byId.get(row.roomId);

    return before === undefined ? [] : [changeForUpdate('room', before, { ...before, name: row.to })];
  });

  if (changes.length === 0) {
    return null;
  }

  return createCommand({
    type: ROOM_NORMALIZE_COMMAND_TYPE,
    actorId,
    description: normalizeDescription(changes.length),
    changes,
  });
}

/* -------------------------------------------------------------------------- */
/* Đường ghi — `dispatch` chạy qua `commit`.                                   */
/* -------------------------------------------------------------------------- */

/**
 * Cổng ghi của `dispatch`, cài bằng `commit`.
 *
 * `commit` nhận `SpatialPatch[]` và một nhãn tiếng Việt, đúng hai thứ
 * `applyPatches` có trong tay. Nhãn lấy từ chính `label` của lượt dispatch, nên
 * nút hoàn tác và nhật ký hoạt động đọc cùng một câu. Đây là dòng duy nhất của
 * màn chạm tới kho, và nó KHÔNG gọi `set()` (A10).
 */
export function createCommitSpatialPort(
  graph: RoomLabelGraphPort,
  labelOf: () => string,
): SpatialPort {
  return {
    read: () => graph.read(),
    applyPatches: (patches) => {
      commit(patches, labelOf());
    },
  };
}

/** Bộ phụ thuộc năm bước của `dispatch`, gắn với ngăn xếp hoàn tác 100 bước của S-06. */
export interface RoomLabelDispatchDeps {
  readonly deps: DispatchDeps;
  readonly history: HistoryStack;
  /** Nhãn của lượt dispatch đang chạy — `SpatialPort` đọc nó để đặt tên cho `commit`. */
  readonly setLabel: (label: string) => void;
}

export interface CreateRoomLabelDispatchOptions {
  readonly graph: RoomLabelGraphPort;
  /** Vùng chọn TRƯỚC lượt ghi; `stack.undo()` khôi phục lại đúng nó. */
  readonly selectionBefore: () => SelectionSnapshot;
  readonly selectionAfter: () => SelectionSnapshot;
  /** Bước `sync` — đánh dấu bản vẽ bẩn cho tự lưu (S-11/A7). */
  readonly onSynced: () => void;
  readonly history?: HistoryStack;
}

/**
 * Dựng `DispatchDeps` đầy đủ năm cổng.
 *
 * `history` là ngăn xếp thật của `src/lib/commands/history.ts` (mặc định
 * `MAX_HISTORY_STEPS` = 100 bước), KHÔNG phải `temporal` của zundo: hoàn tác
 * của màn phải hoàn tác đúng những lệnh màn đã chạy, kèm cả vùng chọn trước đó.
 */
export function createRoomLabelDispatchDeps(
  options: CreateRoomLabelDispatchOptions,
): RoomLabelDispatchDeps {
  const history = options.history ?? createHistoryStack();
  let label = '';

  const deps: DispatchDeps = {
    spatial: createCommitSpatialPort(options.graph, () => label),
    history: {
      push: (entry) => {
        history.push({
          entry,
          selectionBefore: options.selectionBefore(),
          selectionAfter: options.selectionAfter(),
        });
      },
      drop: (entryId) => {
        history.drop(entryId);
      },
    },
    rules: createIncrementalRuleRunner(),
    sync: {
      enqueue: () => {
        options.onSynced();
      },
    },
  };

  return {
    deps,
    history,
    setLabel: (next) => {
      label = next;
    },
  };
}

/** Chạy một lệnh qua đủ năm bước. Nhãn của lượt là mô tả của chính lệnh. */
export async function runRoomCommand(
  command: Command,
  bundle: RoomLabelDispatchDeps,
): Promise<DispatchResult> {
  bundle.setLabel(command.description);

  return dispatch(command, bundle.deps);
}

/** Vùng chọn rỗng, cho lượt ghi không có gì được chọn trước đó. */
export const NO_ROOM_SELECTION: SelectionSnapshot = NO_SELECTION;

/* -------------------------------------------------------------------------- */
/* Vé hoàn tác (D-05) — tám giây, con số do chính vé mang.                     */
/* -------------------------------------------------------------------------- */

export interface CreateRoomLabelUndoTicketOptions {
  readonly description: string;
  readonly undo: () => void;
  readonly now: () => number;
}

/**
 * Vé hoàn tác của một lượt ghi.
 *
 * `UNDO_WINDOW_MS` (8000 ms, A8) tới từ `src/lib/mutations/undoTicket.ts` — con
 * số KHÔNG được viết lại ở màn (R-71), và `createUndoTicket` dùng nó làm mặc
 * định nên ở đây thậm chí không có tham số nào mang nó.
 */
export function createRoomLabelUndoTicket(
  options: CreateRoomLabelUndoTicketOptions,
): UndoTicket {
  return createUndoTicket({
    description: options.description,
    now: options.now,
    undo: options.undo,
  });
}

/** Cửa sổ hoàn tác, xuất lại để hook và bài kiểm đọc đúng một nguồn. */
export { UNDO_WINDOW_MS };

/** Dung sai diện tích, xuất lại để bài kiểm đọc đúng nguồn của hai chốt an toàn. */
export { AREA_TOLERANCE_M2 };

/** Đơn vị pixel, xuất lại cho nơi gọi cần dựng một số đo pixel có nhãn. */
export { pixels };
