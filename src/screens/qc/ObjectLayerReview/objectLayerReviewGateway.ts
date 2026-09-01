/**
 * Cổng dữ liệu và tầng lệnh của màn S-13 "Lớp đối tượng" — mọi lời gọi ra khỏi
 * màn đi qua đây.
 *
 * Cùng khuôn `wallLayerReviewGateway.ts` của màn QC anh em: một danh sách khả
 * năng, một bản kê nợ endpoint, một `interface` cho hình dạng cổng, một factory
 * dựng cổng thật và một factory dựng cổng có dữ liệu cho test và story (R-73).
 *
 * ## Đường ghi — `dispatch` chạy qua `commit`
 *
 * Lệnh nghiệp vụ S-07 đi qua `dispatch` (S-05, năm bước
 * `validate → apply → history → rules → sync`), và `SpatialPort.applyPatches`
 * được cài bằng `commit(patches, label)` của `src/store/commit.ts`. Nhờ vậy màn
 * có rule chạy lại sau mỗi lệnh, ngăn xếp hoàn tác 100 bước của S-06, đồng bộ
 * S-11, và **không phạm A10**: không dòng nào gọi `set()` hay `_applyPatches()`.
 *
 * ## Ba lệnh còn thiếu — dựng bằng nguyên thuỷ công khai
 *
 * `OPENING_COMMAND_TYPES` (`openingCommands.ts:83-92`) chỉ có tám lệnh và
 * **không có** lệnh đổi loại, đổi chiều mở hay duyệt. Điều phối viên đã duyệt
 * (QĐ-3) cách dựng bằng `createCommand` + `changeForUpdate`, hợp lệ vì
 * `CommandType` là `string` mở và `validateCommands` chỉ kiểm `command.type`
 * khác rỗng, không so với một bảng cho phép. Lệnh tự hoàn tác được vì
 * `changeForUpdate` mang ĐỦ ảnh chụp `before`/`after`, và `invertCommand` chỉ
 * hoán đổi hai ảnh đó — không cần thêm một dòng nào cho `Ctrl+Z`.
 *
 * **A5 ép ngay ở kiểu dựng lệnh:** {@link buildApproveObjectCommand} là đường
 * DUY NHẤT đặt `reviewed: true`, và nó luôn đặt kèm `source: 'human'`. Không có
 * tham số nào cho phép người gọi truyền `source`, nên đầu ra AI không có đường
 * nào bật được cờ xanh "đã xác minh".
 *
 * ## Hình học: GỌI LẠI M-08 / M-09, không tự tính
 *
 * Không một phép gắn, kiểm chồng lấn hay chiếu vị trí nào viết mới ở đây.
 * `attachToWall`, `placeOnWall`, `openingCentre`, `validateOpening`,
 * `validateOpenings`, `openingSpan`, `findOrphans` của `src/domain/openings`
 * là nguồn duy nhất (M-08); `reflowOpenings` là nguồn duy nhất khi tường đổi
 * (M-09). Quy đổi giữa fraction của domain và `offsetMm` của đồ thị dùng
 * `relativePositionOf` / `offsetOnWall` / `toAttachedOpening` của
 * `src/lib/commands/business/shared.ts` — ba hàm đã có, không chép lại công
 * thức (R-61).
 *
 * ## Hai việc chưa có đường
 *
 * - `persistObjectLayer` — **NOT FOUND**, cùng lý do đã ghi ở màn tường:
 *   `PatchSpatialFloorInput.body` là `Partial<FloorWriteBody>` và không có chỗ
 *   nào cho một đồ thị không gian.
 * - `readObjectGraph` — đồ thị sống trong `src/store`, không có endpoint nào
 *   trả nó. Cổng đọc qua một cửa tiêm được, mặc định là chính store.
 */

import type { QueryClient, UseMutationOptions } from '@tanstack/react-query';

import type { ApiClient } from '@/api/client';
import { mockApiClient } from '@/api/__mocks__/client';
import { normalizeSpatial, type NormalizedSpatial } from '@/domain/spatial/normalize';
import type {
  Building,
  Furniture,
  FurnitureId,
  FurnitureKind,
  Level,
  Opening as GraphOpening,
  OpeningId,
  LevelId,
  Point,
  ReviewMetadata,
  SwingDirection,
  Wall as GraphWall,
  WallId,
} from '@/domain/spatial/types';
import { millimetresPerPixel, scaleFromRatio, type Scale } from '@/domain/units/scale';
import { millimetres, type MillimetresPerPixel } from '@/domain/units/types';
import {
  attachToWall,
  DEFAULT_ATTACH_RADIUS_MM,
  openingCentre,
  placeOnWall,
  type OpeningAttachment,
} from '@/domain/openings/attach';
import {
  findOrphans,
  openingSpan,
  OPENING_RULES,
  validateOpening,
  validateOpenings,
  type OpeningSpan,
  type OpeningViolation,
  type OrphanReport,
} from '@/domain/openings/validate';
import { reflowOpenings, type ReflowResult } from '@/domain/openings/reflow';
import type {
  AttachedOpening,
  Opening as DomainOpening,
  OpeningKind as DomainOpeningKind,
  OrphanOpening,
  RelativePosition,
  TracedOpening,
} from '@/domain/openings/types';
import { clampRelativePosition } from '@/domain/openings/types';
import { resolveWallShapes } from '@/domain/walls/joints';
import { centrelineLength, type Wall as SolidWall } from '@/domain/walls/types';
import {
  createAddOpeningCommand,
  createDeleteFurnitureCommand,
  createDeleteOpeningCommand,
  createMoveFurnitureCommand,
  createMoveOpeningCommand,
  createResizeOpeningCommand,
  createRotateFurnitureCommand,
  type AddOpeningInput,
  type DeleteFurnitureInput,
  type DeleteOpeningInput,
  type MoveFurnitureInput,
  type MoveOpeningInput,
  type ResizeOpeningInput,
  type RotateFurnitureInput,
} from '@/lib/commands/business/openingCommands';
import {
  accept,
  entitiesOfKind,
  offsetOnWall,
  openingsOfWall,
  refuse,
  relativePositionOf,
  toAttachedOpening,
  toPoint,
  toPointMm,
  toSolidWall,
  type CommandContext,
  type CommandResult,
} from '@/lib/commands/business/shared';
import { changeForUpdate, createCommand } from '@/lib/commands/createCommand';
import type { Command } from '@/lib/commands/types';
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
import { mergeCommandRun, MERGE_WINDOW_MS } from '@/lib/commands/mergeCommands';
import { runTransaction } from '@/lib/commands/transaction';
import {
  coalesce,
  COALESCE_WINDOW_MS,
  type CoalescedCommand,
  type Command as SyncCommand,
} from '@/lib/mutations/coalesce';
import { createOptimisticMutation } from '@/lib/mutations/createOptimisticMutation';
import { createUndoTicket, UNDO_WINDOW_MS, type UndoTicket } from '@/lib/mutations/undoTicket';
import { generateLegend, type Legend } from '@/lib/coloring/legend';
import { createColoringMode, type ColoringMode, type PaintSubject } from '@/lib/coloring/modes';
import { createLookupScale, type ColorTokenName } from '@/lib/coloring/scales';
import { wallBearing } from '@/domain/walls/edit';
import type { MeasurementState } from '@/hooks/useMeasurementLabel';
import { boxAround } from '@/lib/input/dragDrop';
import type { AppError } from '@/lib/errors';
import type { QueryKey } from '@/lib/query/queryKeys';
import { formatLength } from '@/lib/format/measure';
import { formatNumber } from '@/lib/format/number';
import { confidenceLevel } from '@/lib/format/semantic';
import type { ViewStatusCode } from '@/lib/viewmodel/types';
import { commit } from '@/store/commit';
import { useStore } from '@/store';

import {
  countObjectsByLayer,
  isOrphanObject,
  OBJECT_LAYER_IDS,
  OBJECT_SUBTYPE_LABELS,
  OBJECT_SUBTYPE_LAYER,
  type AttachedReviewObject,
  type HostWallOutlineViewModel,
  type ObjectInspectorViewModel,
  type ObjectLayerCounts,
  type ObjectLayerId,
  type ObjectLayerVisibility,
  type ObjectDragMeasurement,
  type ObjectListRowViewModel,
  type ObjectPlacementViewModel,
  type PixelPoint,
  type PixelRect,
  type ObjectReviewCounter,
  type ObjectSubtype,
  type OrphanReviewObject,
  type ReviewObject,
} from './objectLayerTypes';
import { OBJECT_LAYER_FIXTURE_OBJECTS } from './objectLayerFixture';
import {
  WALL_LAYER_FIXTURE_BUILDING,
  WALL_LAYER_FIXTURE_LEVEL,
  WALL_LAYER_FIXTURE_WALLS,
} from '../WallLayerReview/wallLayerReviewFixture';

/* -------------------------------------------------------------------------- */
/* Khả năng — những gì màn hỏi thế giới bên ngoài.                             */
/* -------------------------------------------------------------------------- */

/** Tên máy đọc của từng việc màn cần. Mỗi việc chưa làm được có một dòng nợ. */
export const OBJECT_LAYER_CAPABILITIES = [
  'readBackground',
  'readObjectGraph',
  'writeObjectGraph',
  'persistObjectLayer',
] as const;

export type ObjectLayerCapability = (typeof OBJECT_LAYER_CAPABILITIES)[number];

/** Việc trong danh sách trên mà bản cài đặt THẬT chưa làm được. Chỉ được ngắn đi. */
export const OBJECT_LAYER_MISSING_CAPABILITIES = ['persistObjectLayer'] as const;

export type ObjectLayerMissingCapability = (typeof OBJECT_LAYER_MISSING_CAPABILITIES)[number];

/** Endpoint còn thiếu của từng khả năng, viết nguyên văn cho người nối dây sau. */
export const OBJECT_LAYER_MISSING_ENDPOINTS: Readonly<
  Record<ObjectLayerMissingCapability, string>
> = {
  persistObjectLayer:
    'ENDPOINTS.spatial.floor chấp nhận một đồ thị không gian trong thân yêu cầu — chưa có; PatchSpatialFloorInput.body là Partial<FloorWriteBody> (src/api/client.ts:87-92,144-148), chỉ mang name/order/elevationMm/heightMm/drawings, không có chỗ cho lỗ mở hay đồ đạc',
};

/** Một khả năng chưa tồn tại. `supported: false` là câu trả lời thật, không phải lỗi. */
export interface ObjectLayerUnsupported {
  readonly supported: false;
  readonly capability: ObjectLayerMissingCapability;
  /** Lấy nguyên từ {@link OBJECT_LAYER_MISSING_ENDPOINTS}. */
  readonly missing: string;
}

export interface ObjectLayerSupported<TValue> {
  readonly supported: true;
  readonly value: TValue;
}

export type ObjectLayerCapabilityResult<TValue> =
  | ObjectLayerSupported<TValue>
  | ObjectLayerUnsupported;

/** Dựng nhánh "chưa có đường làm việc này" — một chỗ duy nhất ghép tên với nợ. */
export function unsupported(capability: ObjectLayerMissingCapability): ObjectLayerUnsupported {
  return {
    supported: false,
    capability,
    missing: OBJECT_LAYER_MISSING_ENDPOINTS[capability],
  };
}

/* -------------------------------------------------------------------------- */
/* Hằng của bộ mẫu — mã hiển thị, mã máy, và ba con số của đặc tả.             */
/* -------------------------------------------------------------------------- */

/** Số chữ số phần đếm trong thân mã — `COUNTER_LENGTH` của `src/domain/spatial/ids.ts:41`. */
const ID_COUNTER_LENGTH = 6;

/** Bề rộng nhãn người đọc: "#W-014", không phải "#W-14". */
const DISPLAY_CODE_DIGITS = 3;

/**
 * Bốn ký tự đuôi của mã máy, mỗi lớp con một đuôi.
 *
 * Cửa đi và cửa sổ CÙNG là `Opening` của đồ thị nên cùng tiền tố `D-`
 * (`ID_PREFIX_BY_KIND.opening`); hai đuôi khác nhau là thứ giữ cho `D-001` và
 * `S-001` không cùng một mã máy. Đuôi là hằng chứ không ngẫu nhiên — bộ mẫu
 * phải TẤT ĐỊNH, đúng khuôn `wallLayerReviewFixture.ts`.
 */
const ENTITY_ID_SUFFIX: Readonly<Record<ObjectLayerId, string>> = {
  door: 'DOOR',
  window: 'WNDW',
  furniture: 'FURN',
};

/** Tiền tố mã máy theo lớp con — `ID_PREFIX_BY_KIND.opening` / `.furniture`. */
const ENTITY_ID_PREFIX: Readonly<Record<ObjectLayerId, string>> = {
  door: 'D',
  window: 'D',
  furniture: 'F',
};

/**
 * Cao độ bệ cửa của một cửa sổ mới đổi loại — đặc tả gốc: "cửa sổ 900".
 *
 * `OPENING_RULES` chỉ có DẢI hợp lệ (`windowSillMinMm` 400 … `windowSillMaxMm`
 * 1500) chứ không có giá trị mặc định, nên con số này phải được đặt tên ở đây —
 * đúng một chỗ (R-71) — và nó nằm trong dải đó. Cửa đi thì lấy thẳng
 * `OPENING_RULES.doorSillHeightMm` (0), không viết lại.
 */
const WINDOW_SILL_HEIGHT_MM = 900;

/** Chiều mở mặc định của một lỗ mở vừa đổi thành cửa đi một cánh. */
const DEFAULT_DOOR_SWING: SwingDirection = 'left';

/** Chiều mở của một cửa đi hai cánh. */
const DOUBLE_DOOR_SWING: SwingDirection = 'double';

/** Cửa sổ không có cánh mở quay — nó cố định trên tường. */
const DEFAULT_WINDOW_SWING: SwingDirection = 'fixed';

/** Góc xoay của một món nội thất áp tường trong bộ mẫu. */
const FURNITURE_ROTATION_DEG = 0;

/**
 * Ngưỡng "cần chú ý" của màn — 0,75.
 *
 * Con số này là YÊU CẦU SẢN PHẨM, không phải một băng của hệ thiết kế: đặc tả
 * gốc và bản nghiệm thu đều đếm "5 mục dưới ngưỡng 0,75", và bộ mẫu
 * (`objectLayerFixture.ts`) dựng đúng năm mục đó. Hai băng có sẵn của
 * `confidenceLevel` (`@/lib/format/semantic`) cắt ở 0,90 và 0,70 nên không băng
 * nào cho ra năm — dùng chúng làm bộ lọc sẽ cho 10 hoặc 3, tức là một con số
 * KHÁC con số đặc tả đòi in ra.
 *
 * Nên ngưỡng được đặt tên ở đây, ĐÚNG MỘT CHỖ (R-71), và chỉ dùng cho câu hỏi
 * "mục nào cần người duyệt xem lại". Câu hỏi khác — MÀU của một đối tượng —
 * vẫn đi qua `confidenceLevel` (xem {@link objectStatusCode}), vì màu là việc
 * của hệ thiết kế còn bộ lọc là việc của quy trình duyệt.
 */
export const OBJECT_LAYER_CONFIDENCE_THRESHOLD = 0.75;

/** Đối tượng này có dưới ngưỡng "cần chú ý" của màn không? */
export const isLowConfidenceObject = (confidence: number): boolean =>
  confidence < OBJECT_LAYER_CONFIDENCE_THRESHOLD;

/**
 * Nhãn người đọc của một mã tường: `W-000014WALL` → `W-014`.
 *
 * Thuần cắt chuỗi, cùng khuôn `wallDisplayCode` của màn tường: mã máy phải dài
 * (thân ≥ 10 ký tự) để tầng lệnh nhận, còn nhãn thanh tra thì đặc tả đòi đúng
 * "#W-014".
 */
export function hostWallDisplayCode(id: string): string {
  const counter = id.slice(2).slice(0, ID_COUNTER_LENGTH).replace(/^0+/u, '');

  return `${id.slice(0, 1)}-${(counter === '' ? '0' : counter).padStart(DISPLAY_CODE_DIGITS, '0')}`;
}

/**
 * Mã máy của một đối tượng, suy từ mã hiển thị của bộ mẫu.
 *
 * `D-007` → `D-000007DOOR`, `S-003` → `D-000003WNDW`, `F-002` → `F-000002FURN`.
 * Ánh xạ TẤT ĐỊNH và một chiều đủ dùng: mã hiển thị là khoá của mọi hàm xử lý
 * mà view gọi, mã máy là khoá của đồ thị và của tầng lệnh.
 */
export function entityIdOf(displayId: string, layer: ObjectLayerId): string {
  const counter = displayId.slice(2).padStart(ID_COUNTER_LENGTH, '0');

  return `${ENTITY_ID_PREFIX[layer]}-${counter}${ENTITY_ID_SUFFIX[layer]}`;
}

/* -------------------------------------------------------------------------- */
/* Bộ mẫu — 21 đối tượng của `objectLayerFixture.ts` thành một đồ thị thật.     */
/* -------------------------------------------------------------------------- */

/**
 * Tầng và tường của bộ mẫu.
 *
 * KHÔNG dựng một lưới tường thứ hai: bộ mẫu 48 tường của màn QC anh em đã là
 * một mặt bằng hợp lệ (mọi nút giao khép 0 mm, `resolveWallShapes` giải được),
 * và `objectLayerFixture.ts` đã đặt `hostWallId` theo đúng mã hiển thị của lưới
 * đó — xem ghi chú "Mã tường chủ chỉ là mã HIỂN THỊ" ở đầu bộ mẫu. Dựng lại
 * lưới lần thứ hai chỉ tạo ra một chỗ để hai bộ số lệch nhau.
 */
export const OBJECT_LAYER_SAMPLE_LEVEL: Level = WALL_LAYER_FIXTURE_LEVEL;

/** Toà nhà của bộ mẫu — dùng lại, cùng lý do như tầng. */
const OBJECT_LAYER_SAMPLE_BUILDING: Building = WALL_LAYER_FIXTURE_BUILDING;

/** Tra tường thật theo mã hiển thị: `"W-014"` → tường `W-000014WALL`. */
const WALL_BY_DISPLAY_CODE: ReadonlyMap<string, GraphWall> = new Map(
  WALL_LAYER_FIXTURE_WALLS.map((wall) => [hostWallDisplayCode(wall.id), wall] as const),
);

/**
 * Loại đồ đạc của đồ thị cho từng loại con của màn.
 *
 * Ánh xạ KHÔNG một-một: `FurnitureKind` chỉ có tám giá trị và cả bồn cầu lẫn
 * chậu rửa đều là `sanitaryFixture`. Vì vậy `subtype` của một món nội thất
 * sống trong {@link OBJECT_LAYER_SEED} chứ không đọc ngược từ đồ thị — nó là
 * kết quả phân loại của AI, và màn này không có lệnh nào sửa nó (ba lệnh QĐ-3
 * đều là lệnh của LỖ MỞ).
 */
const FURNITURE_KIND_BY_SUBTYPE: Readonly<Record<ObjectSubtype, FurnitureKind>> = {
  singleDoor: 'other',
  doubleDoor: 'other',
  window: 'other',
  bed: 'bed',
  sofa: 'chair',
  diningTable: 'table',
  toilet: 'sanitaryFixture',
  basin: 'sanitaryFixture',
};

/**
 * Một dòng bộ mẫu đã nối được mã hiển thị với mã máy.
 *
 * Đây là NGUYÊN LIỆU, không phải viewmodel: `reviewed`, `confidence`, vị trí và
 * kích thước sau lượt sửa đầu tiên đọc từ ĐỒ THỊ chứ không từ đây. Cái duy nhất
 * chỉ có ở đây là `subtype` của nội thất (xem {@link FURNITURE_KIND_BY_SUBTYPE})
 * và toạ độ dò được của đối tượng chưa gắn tường.
 */
export interface ObjectSeedEntry {
  readonly displayId: string;
  readonly entityId: string;
  readonly layer: ObjectLayerId;
  readonly subtype: ObjectSubtype;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly sillHeightMm: number | null;
  readonly swing: SwingDirection;
  readonly confidence: number;
  readonly reviewed: boolean;
  /** Tường chủ lúc dò ra (mã máy). `null` ở đối tượng chưa gắn được vào tường nào. */
  readonly hostWallId: WallId | null;
  readonly relativePosition: RelativePosition | null;
  /** Toạ độ tuyệt đối lúc dò. `null` ở đối tượng đã gắn. */
  readonly tracedCentre: Point | null;
}

/** Tường chủ của một dòng bộ mẫu, hoặc `null` khi mã hiển thị không tra được. */
const hostWallOf = (object: ReviewObject): GraphWall | null =>
  object.hostWallId === null ? null : (WALL_BY_DISPLAY_CODE.get(object.hostWallId) ?? null);

/** Một dòng bộ mẫu, đã nối mã. */
function toSeedEntry(object: ReviewObject): ObjectSeedEntry {
  const host = hostWallOf(object);

  return {
    displayId: object.id,
    entityId: entityIdOf(object.id, object.layer),
    layer: object.layer,
    subtype: object.subtype,
    widthMm: object.widthMm,
    heightMm: object.heightMm,
    sillHeightMm: object.sillHeightMm,
    swing: object.swing,
    confidence: object.confidence,
    reviewed: object.reviewed,
    hostWallId: host?.id ?? null,
    relativePosition: isOrphanObject(object) ? null : object.relativePosition,
    tracedCentre: isOrphanObject(object) ? object.tracedCentre : null,
  };
}

/** 21 dòng bộ mẫu — 9 cửa đi, 7 cửa sổ, 5 nội thất. Thứ tự giữ nguyên của bộ mẫu. */
export const OBJECT_LAYER_SEED: readonly ObjectSeedEntry[] =
  OBJECT_LAYER_FIXTURE_OBJECTS.map(toSeedEntry);

/** Tra một dòng bộ mẫu theo mã hiển thị. */
export const seedOf = (displayId: string): ObjectSeedEntry | null =>
  OBJECT_LAYER_SEED.find((entry) => entry.displayId === displayId) ?? null;

/** Tra một dòng bộ mẫu theo mã máy — đường về từ đồ thị ra mã hiển thị. */
export const seedOfEntity = (entityId: string): ObjectSeedEntry | null =>
  OBJECT_LAYER_SEED.find((entry) => entry.entityId === entityId) ?? null;

/** Tường của bộ mẫu, dạng hình học của `src/domain/walls`. */
export const solidWallOf = (wall: GraphWall, level: Level): SolidWall => toSolidWall(wall, level);

/**
 * Ảnh chụp lỗ mở đúng như domain M-08 muốn, dựng từ một dòng bộ mẫu.
 *
 * `offsetMm` của đồ thị (khoảng cách từ đầu tim tường tới MÉP TRÁI) suy ra từ
 * fraction bằng `offsetOnWall` của `shared.ts` — hàm đã có, không viết lại phép
 * quy đổi (R-61, và cảnh báo số 6 của hợp đồng T1).
 */
function attachedOpeningOf(entry: ObjectSeedEntry, wall: SolidWall): AttachedOpening {
  return {
    id: entry.entityId as OpeningId,
    kind: entry.layer === 'window' ? 'window' : 'door',
    widthMm: millimetres(entry.widthMm),
    heightMm: millimetres(entry.heightMm),
    sillHeightMm: millimetres(entry.sillHeightMm ?? OPENING_RULES.doorSillHeightMm),
    swing: entry.swing,
    wallId: wall.id,
    relativePosition: entry.relativePosition ?? clampRelativePosition(0),
  };
}

/** Nguồn dữ liệu của một thực thể: đầu ra AI cho tới khi người duyệt chạm vào (A5). */
const reviewMetadataOf = (entry: ObjectSeedEntry): ReviewMetadata => ({
  confidence: entry.confidence,
  source: entry.reviewed ? 'human' : 'ai',
  reviewed: entry.reviewed,
});

/**
 * Đồ thị bộ mẫu: 48 tường, 15 lỗ mở đã gắn, 5 món nội thất.
 *
 * Đối tượng CHƯA GẮN (`D-009`) cố ý KHÔNG có mặt trong đồ thị: `Opening` của đồ
 * thị bắt buộc có `wallId`, nên "chưa gắn vào tường nào" không có chỗ đứng ở đó
 * — đúng lý do `src/domain/openings` mới là nơi mô hình hoá orphan. Nó sống
 * trong {@link OBJECT_LAYER_SEED} với `tracedCentre`, và `findOrphans` là hàm
 * báo cáo nó (M-08). Khi người duyệt bấm "Gắn vào tường gần nhất" thì lệnh
 * `opening.add` của S-07 tạo nó trong đồ thị VỚI ĐÚNG mã máy đã dành sẵn, nên
 * `Ctrl+Z` đưa nó về lại trạng thái chưa gắn mà không cần một bảng ánh xạ nào
 * phải giữ đồng bộ.
 */
export function buildObjectLayerGraph(
  seed: readonly ObjectSeedEntry[] = OBJECT_LAYER_SEED,
): NormalizedSpatial {
  const level = OBJECT_LAYER_SAMPLE_LEVEL;
  const openings: GraphOpening[] = [];
  const furniture: Furniture[] = [];
  const openingIdsByWall = new Map<WallId, OpeningId[]>();

  for (const entry of seed) {
    if (entry.hostWallId === null || entry.relativePosition === null) {
      continue;
    }

    const wall = WALL_LAYER_FIXTURE_WALLS.find((candidate) => candidate.id === entry.hostWallId);

    if (wall === undefined) {
      continue;
    }

    const solid = solidWallOf(wall, level);

    if (entry.layer === 'furniture') {
      const centre = toPoint(placeOnWall(solid, entry.relativePosition));

      furniture.push({
        id: entry.entityId as FurnitureId,
        levelId: level.id,
        kind: FURNITURE_KIND_BY_SUBTYPE[entry.subtype],
        centre,
        boundingBox: boxAround(centre, entry.widthMm, entry.heightMm),
        rotationDeg: FURNITURE_ROTATION_DEG,
        ...reviewMetadataOf(entry),
      });

      continue;
    }

    const openingId = entry.entityId as OpeningId;
    const bucket = openingIdsByWall.get(wall.id) ?? [];

    bucket.push(openingId);
    openingIdsByWall.set(wall.id, bucket);

    openings.push({
      id: openingId,
      wallId: wall.id,
      kind: entry.layer === 'window' ? 'window' : 'door',
      offsetMm: offsetOnWall(attachedOpeningOf(entry, solid), solid),
      widthMm: entry.widthMm,
      heightMm: entry.heightMm,
      sillHeightMm: entry.sillHeightMm ?? OPENING_RULES.doorSillHeightMm,
      swing: entry.swing,
      ...reviewMetadataOf(entry),
    });
  }

  const walls: GraphWall[] = WALL_LAYER_FIXTURE_WALLS.map((wall) => ({
    ...wall,
    openingIds: openingIdsByWall.get(wall.id) ?? [],
  }));

  return normalizeSpatial({
    building: OBJECT_LAYER_SAMPLE_BUILDING,
    levels: [level],
    walls,
    openings,
    furniture,
    rooms: [],
    axes: [],
    dimensions: [],
    notes: [],
  });
}

/** Đồ thị bộ mẫu dựng sẵn — story, test và cổng giả cùng đọc một bản. */
export const OBJECT_LAYER_SAMPLE_GRAPH: NormalizedSpatial = buildObjectLayerGraph();

/* -------------------------------------------------------------------------- */
/* Mã hiển thị — mã máy dài, nhãn người đọc ngắn.                              */
/* -------------------------------------------------------------------------- */

/**
 * Mã hiển thị của một thực thể: `D-000003WNDW` → `S-003`.
 *
 * Bảng tra là chính bộ mẫu, nên cửa sổ giữ được tiền tố `S-` mà đặc tả đòi dù
 * mã máy của nó phải mang tiền tố `D-` của `ID_PREFIX_BY_KIND.opening`. Một
 * thực thể không có trong bộ mẫu (người dùng vừa thêm) rơi về cách đọc chung
 * sáu chữ số đếm, cùng khuôn {@link hostWallDisplayCode}.
 */
export function displayIdOf(entityId: string): string {
  return seedOfEntity(entityId)?.displayId ?? hostWallDisplayCode(entityId);
}

/* -------------------------------------------------------------------------- */
/* Đọc đồ thị — tường, lỗ mở, đồ đạc của tầng đang duyệt.                      */
/* -------------------------------------------------------------------------- */

const NO_SOLID_WALLS: readonly SolidWall[] = [];
const NO_OBJECTS: readonly ReviewObject[] = [];

/** Tầng đang duyệt, hoặc tầng đầu tiên khi nơi gọi chưa chỉ định. */
export function levelOfGraph(graph: NormalizedSpatial | null): Level | null {
  if (graph === null) {
    return null;
  }

  const id = graph.byKind.level[0];

  if (id === undefined) {
    return null;
  }

  const entity = graph.byId[id];

  return entity !== undefined && 'elevationMm' in entity ? entity : null;
}

/** Tường của tầng, dạng đồ thị. */
export const graphWallsOf = (graph: NormalizedSpatial | null, level: Level | null): readonly GraphWall[] =>
  graph === null || level === null
    ? []
    : entitiesOfKind(graph, 'wall').filter((wall) => wall.levelId === level.id);

/** Tường của tầng, dạng hình học mà M-08/M-09 nhận. */
export function solidWallsOf(
  graph: NormalizedSpatial | null,
  level: Level | null,
): readonly SolidWall[] {
  if (level === null) {
    return NO_SOLID_WALLS;
  }

  return graphWallsOf(graph, level).map((wall) => solidWallOf(wall, level));
}

/** Lỗ mở của tầng, dạng đồ thị. */
export const graphOpeningsOf = (graph: NormalizedSpatial | null): readonly GraphOpening[] =>
  graph === null ? [] : entitiesOfKind(graph, 'opening');

/** Đồ đạc của tầng, dạng đồ thị. */
export const graphFurnitureOf = (graph: NormalizedSpatial | null): readonly Furniture[] =>
  graph === null ? [] : entitiesOfKind(graph, 'furniture');

/* -------------------------------------------------------------------------- */
/* M-08 — gắn, kiểm, đo. GỌI LẠI, không tự tính (CẤM TUYỆT ĐỐI).               */
/* -------------------------------------------------------------------------- */

/** Bán kính gắn mặc định, xuất lại để hook và bài kiểm đọc đúng một nguồn. */
export { DEFAULT_ATTACH_RADIUS_MM, OPENING_RULES };

/** Gắn một đối tượng vừa dò vào tường gần nhất — M-08, màn không tự tìm tường. */
export const attachObjectToWall = (
  traced: TracedOpening,
  walls: readonly SolidWall[],
  radiusMm: number = DEFAULT_ATTACH_RADIUS_MM,
): OpeningAttachment => attachToWall(traced, walls, millimetres(radiusMm));

/** Fraction dọc tim tường thành toạ độ tuyệt đối — M-08. */
export const positionOnWall = (wall: SolidWall, position: RelativePosition): Point =>
  toPoint(placeOnWall(wall, position));

/** Toạ độ hiện tại của một đối tượng ĐÃ gắn, trên đúng tường chủ — M-08. */
export const centreOfObject = (wall: SolidWall, opening: AttachedOpening): Point =>
  toPoint(openingCentre(wall, opening));

/** Đoạn tường mà một đối tượng chiếm — M-08, nguồn duy nhất của số đo hai đầu. */
export const spanOfObject = (wall: SolidWall, opening: AttachedOpening): OpeningSpan =>
  openingSpan(wall, opening);

/** Kiểm MỘT đối tượng trên tường chủ — M-08. */
export const violationsOfObject = (
  opening: AttachedOpening,
  wall: SolidWall,
  siblings: readonly DomainOpening[],
): readonly OpeningViolation[] => validateOpening(opening, wall, siblings);

/** Kiểm TOÀN BỘ lớp đối tượng — M-08. */
export const violationsOfLayer = (
  openings: readonly DomainOpening[],
  walls: readonly SolidWall[],
): readonly OpeningViolation[] => validateOpenings(openings, walls);

/** Đối tượng chưa gắn được vào tường nào, kèm tường đáng gợi ý — M-08. */
export const orphanReportsOf = (
  openings: readonly DomainOpening[],
  walls: readonly SolidWall[],
): readonly OrphanReport[] => findOrphans(openings, walls);

/**
 * Trôi lỗ mở khi tường đổi — M-09.
 *
 * Màn duyệt không tự kéo tường, nhưng lớp tường ở màn anh em thì có, và một
 * lượt hoàn tác trên tường cũng đổi hình tường dưới chân lỗ mở. Đây là đường
 * DUY NHẤT màn tính lại vị trí sau khi tường đổi — fraction giữ nguyên, lỗ mở
 * lồi ra ngoài bị kéo vào trong, lỗ mở rộng hơn cả tường rơi vào `needsDecision`.
 */
export const reflowObjectsOnWall = (
  previousWall: SolidWall,
  nextWall: SolidWall,
  openings: readonly DomainOpening[],
): ReflowResult => reflowOpenings(previousWall, nextWall, openings);

/**
 * Lỗ mở của đồ thị, đọc bằng vựng của domain M-08.
 *
 * Đối tượng CHƯA GẮN không có mặt trong đồ thị (xem {@link buildObjectLayerGraph}),
 * nên chúng được ghép thêm từ bộ mẫu dưới dạng `OrphanOpening` — đúng kiểu mà
 * `findOrphans` đọc.
 */
export function domainOpeningsOf(
  graph: NormalizedSpatial | null,
  level: Level | null,
  seed: readonly ObjectSeedEntry[] = OBJECT_LAYER_SEED,
): readonly DomainOpening[] {
  if (graph === null || level === null) {
    return [];
  }

  const solidById = new Map(solidWallsOf(graph, level).map((wall) => [wall.id, wall] as const));
  const openings: DomainOpening[] = [];

  for (const opening of graphOpeningsOf(graph)) {
    const solid = solidById.get(opening.wallId);

    if (solid !== undefined) {
      openings.push(toAttachedOpening(opening, solid));
    }
  }

  for (const entry of seed) {
    if (entry.tracedCentre === null || graph.byId[entry.entityId] !== undefined) {
      continue;
    }

    openings.push(orphanOpeningOf(entry));
  }

  return openings;
}

/** Lý do một đối tượng của bộ mẫu chưa gắn được: không có tường nào trong bán kính. */
const SEED_ORPHAN_REASON = 'noWallInRange';

/** Một dòng bộ mẫu chưa gắn, đọc bằng vựng của domain M-08. */
export function orphanOpeningOf(entry: ObjectSeedEntry): OrphanOpening {
  return {
    id: entry.entityId as OpeningId,
    kind: (entry.layer === 'window' ? 'window' : 'door') as DomainOpeningKind,
    widthMm: millimetres(entry.widthMm),
    heightMm: millimetres(entry.heightMm),
    sillHeightMm: millimetres(entry.sillHeightMm ?? OPENING_RULES.doorSillHeightMm),
    swing: entry.swing,
    wallId: null,
    centre: toPointMm(entry.tracedCentre ?? { x: 0, y: 0 }),
    orphanReason: SEED_ORPHAN_REASON,
  };
}

/** Một dòng bộ mẫu chưa gắn, đọc bằng vựng "vừa dò ra" mà `attachToWall` nhận. */
export function tracedOpeningOf(entry: ObjectSeedEntry): TracedOpening {
  const orphan = orphanOpeningOf(entry);

  return {
    id: orphan.id,
    kind: orphan.kind,
    widthMm: orphan.widthMm,
    heightMm: orphan.heightMm,
    sillHeightMm: orphan.sillHeightMm,
    swing: orphan.swing,
    centre: orphan.centre,
  };
}

/* -------------------------------------------------------------------------- */
/* Tầng lệnh — bảy lệnh S-07 gọi lại.                                          */
/* -------------------------------------------------------------------------- */

/** Ngữ cảnh mà các hàm dựng lệnh của S-07 đọc. */
export const commandContextOf = (
  graph: NormalizedSpatial,
  actorId: string,
): CommandContext => ({ graph, actorId });

/** 1. Thêm lỗ mở — gọi lại S-07. Chính nó gọi `attachToWall`, màn không tự gắn. */
export const buildAddOpeningCommand = (
  input: AddOpeningInput,
  context: CommandContext,
): CommandResult => createAddOpeningCommand(input, context);

/** 2. Di chuyển lỗ mở dọc tường chủ — gọi lại S-07. Đây là lệnh của lượt kéo Slider. */
export const buildMoveOpeningCommand = (
  input: MoveOpeningInput,
  context: CommandContext,
): CommandResult => createMoveOpeningCommand(input, context);

/** 3. Đổi kích thước lỗ mở — gọi lại S-07. Tâm giữ nguyên, mép trái tự bù. */
export const buildResizeOpeningCommand = (
  input: ResizeOpeningInput,
  context: CommandContext,
): CommandResult => createResizeOpeningCommand(input, context);

/** 4. Xoá lỗ mở — gọi lại S-07. Gỡ khỏi `wall.openingIds` trong CÙNG một lệnh. */
export const buildDeleteOpeningCommand = (
  input: DeleteOpeningInput,
  context: CommandContext,
): CommandResult => createDeleteOpeningCommand(input, context);

/** 5. Di chuyển đồ đạc — gọi lại S-07. */
export const buildMoveFurnitureCommand = (
  input: MoveFurnitureInput,
  context: CommandContext,
): CommandResult => createMoveFurnitureCommand(input, context);

/** 6. Xoay đồ đạc — gọi lại S-07. */
export const buildRotateFurnitureCommand = (
  input: RotateFurnitureInput,
  context: CommandContext,
): CommandResult => createRotateFurnitureCommand(input, context);

/** 7. Xoá đồ đạc — gọi lại S-07. */
export const buildDeleteFurnitureCommand = (
  input: DeleteFurnitureInput,
  context: CommandContext,
): CommandResult => createDeleteFurnitureCommand(input, context);

/* -------------------------------------------------------------------------- */
/* Ba lệnh còn thiếu — dựng bằng nguyên thuỷ công khai (QĐ-3).                 */
/* -------------------------------------------------------------------------- */

/*
 * Vì sao được phép dựng ở đây, chép nguyên khuôn của màn QC anh em
 * (`wallLayerReviewGateway.ts:22-35`):
 *
 * > `WALL_COMMAND_TYPES` (`wallCommands.ts:98-106`) chỉ có bảy lệnh và **không
 * > có lệnh duyệt**. Điều phối viên đã duyệt cách dựng bằng `createCommand` +
 * > `changeForUpdate` (hợp đồng lô-gic mục C.2), hợp lệ vì `CommandType` là
 * > `string` mở và `validateCommands` chỉ kiểm `command.type` khác rỗng, không
 * > so với một bảng cho phép (mục C.3). Lệnh tự hoàn tác được vì
 * > `changeForUpdate` mang ĐỦ ảnh chụp `before`/`after`, và `invertCommand` chỉ
 * > hoán đổi hai ảnh đó (mục C.5) — không cần thêm một dòng nào cho `Ctrl+Z`.
 *
 * Ở màn này con số là TÁM: `OPENING_COMMAND_TYPES` có tám lệnh và không lệnh
 * nào đổi loại, đổi chiều mở hay duyệt (hợp đồng T1, mục "KHÔNG TÌM THẤY").
 * Mọi lý lẽ còn lại giữ nguyên từng chữ.
 */

/**
 * Loại của lệnh đổi loại lỗ mở.
 *
 * Không nằm trong `OPENING_COMMAND_TYPES` vì lệnh này không tồn tại ở S-07;
 * hằng đặt tên ở đây là chỗ DUY NHẤT chuỗi đó được viết, nên nhật ký hoạt động,
 * đo đạc và bài kiểm cùng đọc một nguồn (R-71).
 */
export const OBJECT_CHANGE_KIND_COMMAND_TYPE = 'opening.changeKind';

/** Loại của lệnh đổi chiều mở. Cùng lý do đặt tên như trên. */
export const OBJECT_CHANGE_SWING_COMMAND_TYPE = 'opening.changeSwing';

/** Loại của lệnh duyệt một đối tượng. Cùng lý do đặt tên như trên. */
export const OBJECT_APPROVE_COMMAND_TYPE = 'opening.approve';

/** Nhãn tiếng Việt của một chiều mở — cho câu mô tả lệnh. */
export const SWING_LABELS: Readonly<Record<SwingDirection, string>> = {
  left: 'mở trái',
  right: 'mở phải',
  double: 'hai cánh',
  sliding: 'cửa lùa',
  fixed: 'cố định',
};

/** Nhãn tiếng Việt của một loại con — dùng lại bảng đã khai ở hợp đồng kiểu. */
const subtypeLabelOf = (subtype: ObjectSubtype): string => OBJECT_SUBTYPE_LABELS[subtype];

/** Câu mô tả trên nút hoàn tác — `validateCommands` đòi nó khác rỗng. */
export const changeKindDescription = (id: string, subtype: ObjectSubtype): string =>
  `Đổi loại ${id} thành ${subtypeLabelOf(subtype)}.`;

/** Câu mô tả của lượt đổi chiều mở. */
export const changeSwingDescription = (id: string, swing: SwingDirection): string =>
  `Đổi chiều mở ${id} thành ${SWING_LABELS[swing]}.`;

/** Câu mô tả của lượt duyệt. */
export const approveDescription = (id: string): string => `Duyệt đối tượng ${id}.`;

/** Hình dạng một lỗ mở sẽ có sau khi đổi sang một loại con. */
export interface OpeningShapeForSubtype {
  readonly kind: 'door' | 'window';
  readonly sillHeightMm: number;
  readonly swing: SwingDirection;
}

/**
 * Loại con đích quy ra ba trường của đồ thị.
 *
 * Đổi loại KÉO THEO cao độ bệ và chiều mở — đặc tả gốc nói thẳng ("cửa đi 0,
 * cửa sổ 900" và "đổi swing hợp lệ"), nên ba trường đi cùng nhau trong MỘT lệnh
 * chứ không phải ba lượt ghi rời để `Ctrl+Z` phải bấm ba lần.
 */
export function openingShapeForSubtype(
  subtype: ObjectSubtype,
  currentSwing: SwingDirection,
): OpeningShapeForSubtype | null {
  if (subtype === 'window') {
    return {
      kind: 'window',
      sillHeightMm: WINDOW_SILL_HEIGHT_MM,
      swing: currentSwing === 'sliding' ? 'sliding' : DEFAULT_WINDOW_SWING,
    };
  }

  if (subtype === 'doubleDoor') {
    return { kind: 'door', sillHeightMm: OPENING_RULES.doorSillHeightMm, swing: DOUBLE_DOOR_SWING };
  }

  if (subtype === 'singleDoor') {
    return {
      kind: 'door',
      sillHeightMm: OPENING_RULES.doorSillHeightMm,
      swing: currentSwing === 'left' || currentSwing === 'right' ? currentSwing : DEFAULT_DOOR_SWING,
    };
  }

  /* Năm loại con còn lại thuộc lớp nội thất — không phải lỗ mở, xem chú thích dưới. */
  return null;
}

/** Câu từ chối khi loại đích không phải một loại lỗ mở. */
export const NOT_AN_OPENING_SUBTYPE_REASON =
  'Chỉ lỗ mở mới đổi được loại: đồ đạc và lỗ mở là hai loại thực thể khác nhau của bản vẽ, và không lệnh nào của S-07 chuyển đổi giữa chúng.';

/** Câu từ chối khi loại đích trùng loại đang có. */
export const SAME_SUBTYPE_REASON = 'Đối tượng đã ở đúng loại đó nên không có gì thay đổi.';

/** Câu từ chối khi chiều mở đích trùng chiều mở đang có. */
export const SAME_SWING_REASON = 'Đối tượng đã mở đúng chiều đó nên không có gì thay đổi.';

export interface ChangeObjectKindInput {
  readonly before: GraphOpening;
  readonly wall: SolidWall;
  /** Lỗ mở khác trên CÙNG tường — `validateOpening` cần chúng để kiểm chồng lấn. */
  readonly siblings: readonly DomainOpening[];
  readonly subtype: ObjectSubtype;
  readonly actorId: string;
}

/**
 * Lệnh đổi loại một lỗ mở (cửa đi ↔ cửa sổ).
 *
 * Đi qua `validateOpening` của M-08 TRƯỚC khi nhận: màn không tự kiểm chồng
 * lấn, không tự đoán vị trí hợp lệ. Chỉ mức `critical` chặn lệnh — một cảnh báo
 * là bảng tiêu chuẩn đang nói, và người duyệt được phép nhận nó, đúng cách
 * `criticalReasonsFor` của `openingCommands.ts:169-181` xử lý bảy lệnh kia.
 */
export function buildChangeObjectKindCommand(input: ChangeObjectKindInput): CommandResult {
  const shape = openingShapeForSubtype(input.subtype, input.before.swing);

  if (shape === null) {
    return refuse(OBJECT_CHANGE_KIND_COMMAND_TYPE, [NOT_AN_OPENING_SUBTYPE_REASON]);
  }

  const after: GraphOpening = {
    ...input.before,
    kind: shape.kind,
    sillHeightMm: shape.sillHeightMm,
    swing: shape.swing,
  };

  if (
    after.kind === input.before.kind &&
    after.sillHeightMm === input.before.sillHeightMm &&
    after.swing === input.before.swing
  ) {
    return refuse(OBJECT_CHANGE_KIND_COMMAND_TYPE, [SAME_SUBTYPE_REASON]);
  }

  const reasons = violationsOfObject(
    toAttachedOpening(after, input.wall),
    input.wall,
    input.siblings.filter((sibling) => sibling.id !== after.id),
  )
    .filter((violation) => violation.severity === 'critical')
    .map((violation) => violation.message);

  if (reasons.length > 0) {
    return refuse(OBJECT_CHANGE_KIND_COMMAND_TYPE, reasons);
  }

  return accept(
    createCommand({
      type: OBJECT_CHANGE_KIND_COMMAND_TYPE,
      actorId: input.actorId,
      description: changeKindDescription(displayIdOf(input.before.id), input.subtype),
      changes: [changeForUpdate('opening', input.before, after)],
    }),
  );
}

export interface ChangeObjectSwingInput {
  readonly before: GraphOpening;
  readonly swing: SwingDirection;
  readonly actorId: string;
}

/**
 * Lệnh đổi chiều mở của một lỗ mở.
 *
 * `ResizeOpeningInput` không có trường `swing` (cảnh báo số 5 của hợp đồng T1),
 * nên không tái dùng được lệnh nào của S-07. Chiều mở không đổi hình học của lỗ
 * mở nên không có luật M-08 nào để vi phạm — lệnh chỉ từ chối một lượt ghi
 * không thay đổi gì.
 */
export function buildChangeObjectSwingCommand(input: ChangeObjectSwingInput): CommandResult {
  if (input.before.swing === input.swing) {
    return refuse(OBJECT_CHANGE_SWING_COMMAND_TYPE, [SAME_SWING_REASON]);
  }

  return accept(
    createCommand({
      type: OBJECT_CHANGE_SWING_COMMAND_TYPE,
      actorId: input.actorId,
      description: changeSwingDescription(displayIdOf(input.before.id), input.swing),
      changes: [
        changeForUpdate('opening', input.before, { ...input.before, swing: input.swing }),
      ],
    }),
  );
}

/**
 * Lệnh duyệt một đối tượng — lỗ mở hoặc đồ đạc.
 *
 * A5: đây là đường DUY NHẤT đặt `reviewed: true`, và nó luôn đặt kèm
 * `source: 'human'` — không có tham số nào cho phép nơi gọi truyền `source`,
 * nên đầu ra AI không có đường nào bật được cờ xanh "đã xác minh".
 *
 * Ảnh chụp `before`/`after` là ĐẦY ĐỦ (`changeForUpdate` giữ nguyên hai bản
 * ghi, không phải diff từng trường), nên `invertCommand` hoàn tác được lệnh này
 * mà không cần biết nó nghĩa là gì.
 */
export function buildApproveObjectCommand(
  before: GraphOpening | Furniture,
  actorId: string,
): Command {
  const isOpening = 'wallId' in before;
  const changes = isOpening
    ? [changeForUpdate('opening', before, { ...before, reviewed: true, source: 'human' })]
    : [changeForUpdate('furniture', before, { ...before, reviewed: true, source: 'human' })];

  return createCommand({
    type: OBJECT_APPROVE_COMMAND_TYPE,
    actorId,
    description: approveDescription(displayIdOf(before.id)),
    changes,
  });
}

/* -------------------------------------------------------------------------- */
/* Đường ghi — `dispatch` chạy qua `commit`.                                   */
/* -------------------------------------------------------------------------- */

/** Cửa đọc đồ thị đang sửa. Mặc định là store; test cắm một đồ thị cố định. */
export interface ObjectLayerGraphPort {
  readonly read: () => NormalizedSpatial | null;
}

/**
 * Cổng ghi của `dispatch`, cài bằng `commit`.
 *
 * `commit` nhận `SpatialPatch[]` và một nhãn tiếng Việt, đúng hai thứ
 * `applyPatches` có trong tay. Nhãn lấy từ chính `label` của lượt dispatch, nên
 * nút hoàn tác và nhật ký hoạt động đọc cùng một câu (A10: không `set()`).
 */
export function createCommitSpatialPort(
  graph: ObjectLayerGraphPort,
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
export interface ObjectLayerDispatchDeps {
  readonly deps: DispatchDeps;
  readonly history: HistoryStack;
  /** Nhãn của lượt dispatch đang chạy — `SpatialPort` đọc nó để đặt tên cho `commit`. */
  readonly setLabel: (label: string) => void;
}

export interface CreateObjectLayerDispatchOptions {
  readonly graph: ObjectLayerGraphPort;
  readonly selectionBefore: () => SelectionSnapshot;
  readonly selectionAfter: () => SelectionSnapshot;
  /** Bước `sync` — đánh dấu bản vẽ bẩn cho tự lưu (S-11). */
  readonly onSynced: () => void;
  readonly history?: HistoryStack;
}

/**
 * Dựng `DispatchDeps` đầy đủ năm cổng.
 *
 * D-06 nằm ngay ở đây: `createHistoryStack` gộp hai lệnh liên tiếp cùng loại,
 * cùng người, cùng tập thực thể khi chúng cách nhau dưới `MERGE_WINDOW_MS`
 * (= `COALESCE_WINDOW_MS` = 400 ms, cùng một hằng gốc). Hai mươi lượt kéo liên
 * tục vì thế thành ĐÚNG MỘT bước lịch sử mà không cần một dòng gộp tay nào.
 */
export function createObjectLayerDispatchDeps(
  options: CreateObjectLayerDispatchOptions,
): ObjectLayerDispatchDeps {
  const history = options.history ?? createHistoryStack({ mergeWindowMs: MERGE_WINDOW_MS });
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

/** Chạy MỘT lệnh qua đủ năm bước. Lệnh đơn là thứ D-06 gộp được. */
export async function runObjectCommand(
  command: Command,
  bundle: ObjectLayerDispatchDeps,
): Promise<DispatchResult> {
  bundle.setLabel(command.description);

  return dispatch(command, bundle.deps);
}

/**
 * Chạy một khối lệnh như MỘT bước lịch sử — `runTransaction` của S-05.
 *
 * Ba lệnh của QĐ-3 đi đường này: đổi loại kéo theo cao độ bệ và chiều mở, và cả
 * khối phải hoàn tác được bằng đúng một lần `Ctrl+Z`. Một giao dịch KHÔNG bao
 * giờ bị D-06 gộp vào lượt kéo kế bên (`history.ts:runInProgress` chỉ gộp bước
 * có đúng một lệnh) — đúng điều cần: người duyệt đã yêu cầu chúng đi cùng nhau.
 */
export async function runObjectTransaction(
  commands: readonly Command[],
  bundle: ObjectLayerDispatchDeps,
  label: string,
): Promise<DispatchResult> {
  bundle.setLabel(label);

  return runTransaction(commands, bundle.deps, { label });
}

/** Vùng chọn rỗng, cho lượt ghi không có gì được chọn trước đó. */
export const NO_OBJECT_SELECTION: SelectionSnapshot = NO_SELECTION;

/* -------------------------------------------------------------------------- */
/* D-06 — gộp lệnh trong cửa sổ 400 ms.                                        */
/* -------------------------------------------------------------------------- */

/** Cửa sổ gộp, xuất lại để hook và bài kiểm đọc đúng một nguồn (R-71). */
export { COALESCE_WINDOW_MS, MERGE_WINDOW_MS };

/** Gộp hàng đợi đồng bộ của một lượt kéo — `coalesce` của D-06, cửa sổ 400 ms. */
export const coalesceObjectDrags = <TValue,>(
  commands: readonly SyncCommand<TValue>[],
  windowMs: number = COALESCE_WINDOW_MS,
): CoalescedCommand<TValue>[] => coalesce(commands, windowMs);

/** Gộp một chuỗi lệnh thành các bước hoàn tác — `mergeCommandRun` của D-06. */
export const mergeObjectCommandRun = (
  commands: readonly Command[],
  windowMs: number = MERGE_WINDOW_MS,
): Command[] => mergeCommandRun(commands, windowMs);

/* -------------------------------------------------------------------------- */
/* D-04 — cập nhật lạc quan và vé hoàn tác.                                    */
/* -------------------------------------------------------------------------- */

/** Câu trên toast hoàn tác sau khi xoá. */
export const deleteToastDescription = (displayId: string): string =>
  `Đã xoá đối tượng ${displayId}.`;

export interface CreateObjectUndoTicketOptions {
  readonly displayId: string;
  readonly undo: () => void;
  readonly now: () => number;
}

/**
 * Vé hoàn tác của một lượt xoá.
 *
 * `UNDO_WINDOW_MS` (8000 ms, A8) tới từ `src/lib/mutations/undoTicket.ts` — con
 * số không được viết lại ở màn (R-71), và `createUndoTicket` dùng nó làm mặc
 * định nên ở đây thậm chí không có tham số nào mang nó.
 */
export function createObjectUndoTicket(options: CreateObjectUndoTicketOptions): UndoTicket {
  return createUndoTicket({
    description: deleteToastDescription(options.displayId),
    now: options.now,
    undo: options.undo,
  });
}

/** Cửa sổ hoàn tác, xuất lại để hook và bài kiểm đọc đúng một nguồn. */
export { UNDO_WINDOW_MS };

/* -------------------------------------------------------------------------- */
/* P-01 — định dạng. Mọi con số thành chuỗi TRƯỚC khi rời khỏi hook (A15).      */
/* -------------------------------------------------------------------------- */

/** Một số đo, luôn ở milimét để một cột số thẳng hàng — "2.200 mm". */
export const formatMillimetres = (valueMm: number): string => formatLength(valueMm, { unit: 'mm' });

/** Một số đếm — "21". Dấu nghìn là dấu chấm, dấu thập phân là dấu phẩy (A15). */
export const formatObjectCount = (value: number): string =>
  formatNumber(value, { fractionDigits: 0 });

/**
 * Kích thước một đối tượng — `"900 × 2.200 mm"` (P-01).
 *
 * Đơn vị viết đúng MỘT lần, ở cuối, đúng như đặc tả gốc in ra; con số thì đi
 * qua `formatLength`/`formatNumber` của `src/lib/format` nên dấu nghìn là dấu
 * chấm và dấu thập phân là dấu phẩy mà không màn nào phải tự nhớ.
 */
export const formatObjectSize = (widthMm: number, heightMm: number): string =>
  `${formatObjectCount(widthMm)} × ${formatMillimetres(heightMm)}`;

/** Bộ đếm duyệt thành câu — "9/21 đối tượng đã duyệt". */
export const reviewProgressLabel = (reviewed: number, total: number): string =>
  `${formatObjectCount(reviewed)}/${formatObjectCount(total)} đối tượng đã duyệt`;

/** Tổng của cây lớp — "tổng 21 đối tượng". */
export const layerTreeTotalLabel = (total: number): string =>
  `tổng ${formatObjectCount(total)} đối tượng`;

/** Câu của trạng thái một phần — "5 mục dưới ngưỡng tin cậy, đã lọc sẵn". */
export const lowConfidenceNotice = (count: number): string =>
  `${formatObjectCount(count)} mục dưới ngưỡng tin cậy, đã lọc sẵn`;

/**
 * Mọi chuỗi cố định người dùng đọc, đúng một chỗ (R-71).
 *
 * Chép nguyên văn, có dấu, từ Phần IV của đặc tả gốc. Chuỗi ghép theo số thì ở
 * bốn hàm ngay trên. Khoá i18n tương ứng nằm ở `.orca-notes/T5-i18n.fragment.md`
 * để T8 đưa vào `src/i18n/vi.json` (R-67).
 */
export const OBJECT_LAYER_TEXT = {
  emptyTitle: 'chưa nhận ra đối tượng nào',
  emptyExplanation:
    'nhận diện nội thất phụ thuộc kiểu vẽ của bản gốc, nên bản vẽ ít ký hiệu quy ước có thể không ra kết quả nào.',
  emptyAction: 'thêm thủ công',
  furnitureAttention: 'nhận diện nội thất lỗi, cửa vẫn xong',
  forbidden: 'bạn không có quyền xem lớp đối tượng của dự án này',
  unattachedBadge: 'Chưa gắn vào tường nào',
  attachNearestAction: 'Gắn vào tường gần nhất',
  errorMessage: 'Không tải được lớp đối tượng của tầng.',
  attachNoWall: 'Không có tường nào đủ gần để gắn đối tượng này.',
  attachRefused: 'Không gắn được vào tường gần nhất.',
  shortcutLayer: 'Đặt nhóm loại cho đối tượng đang chọn',
  shortcutSubtype: 'Đổi loại trong nhóm đang chọn',
  shortcutUndo: 'Hoàn tác thay đổi gần nhất',
} as const;

/* -------------------------------------------------------------------------- */
/* P-06 — màu độ tin cậy và màu lớp dữ liệu.                                   */
/* -------------------------------------------------------------------------- */

/**
 * Màu dữ liệu của ba lớp con — ĐÚNG BA, không hơn (CẤM TUYỆT ĐỐI).
 *
 * Ba bậc liền nhau của `SEQUENTIAL_RAMP` (`src/lib/coloring/scales.ts`), tức ba
 * token thật của hệ thiết kế chứ không phải ba mã màu thô (A1). Cố ý KHÔNG
 * dùng ba màu trạng thái của A4 (`state-verified` / `state-attention` /
 * `state-violation`): chúng nói về TRẠNG THÁI của một đối tượng, và mượn chúng
 * làm màu lớp sẽ để hai câu chuyện khác nhau dùng chung một màu.
 *
 * `createLookupScale` đòi bảng đủ mọi khoá của `ObjectLayerId`, nên thêm một
 * lớp con thứ tư sẽ hỏng bản dựng ngay tại đây — đúng chỗ phải hỏng.
 */
export const OBJECT_LAYER_TOKENS: Readonly<Record<ObjectLayerId, ColorTokenName>> = {
  door: '--wall-330',
  window: '--wall-220',
  furniture: '--wall-110',
};

/** Màu dữ liệu của một lớp con. */
export const objectLayerToken = createLookupScale<ObjectLayerId>(OBJECT_LAYER_TOKENS);

/**
 * Những màu dữ liệu ĐANG hiện, không trùng nhau.
 *
 * Bật cả ba lớp cho ra đúng ba màu; tắt một lớp thì màu của nó biến khỏi danh
 * sách. Đây là con số mà nghiệm thu đếm, nên nó được tính ra chứ không gõ tay.
 */
export function dataLayerTokens(visibility: ObjectLayerVisibility): readonly ColorTokenName[] {
  const tokens = OBJECT_LAYER_IDS.filter((layer) => visibility[layer]).map((layer) =>
    objectLayerToken(layer),
  );

  return [...new Set(tokens)];
}

/** Một đối tượng đọc bằng vựng của tầng tô màu P-06. */
export const toPaintSubject = (object: ReviewObject, levelId: LevelId): PaintSubject => ({
  id: object.id,
  levelId,
  review: { confidence: object.confidence, source: object.reviewed ? 'human' : 'ai', reviewed: object.reviewed },
  usage: null,
  areaM2: null,
  worstSeverity: null,
});

/** Bảng màu độ tin cậy, cắt theo đúng những đối tượng đang thấy — P-06. */
export const confidenceModeOf = (subjects: readonly PaintSubject[]): ColoringMode =>
  createColoringMode('aiConfidence', { subjects });

/** Chú giải của bảng màu độ tin cậy — P-06, đếm theo chính màu mode tô ra. */
export const confidenceLegendOf = (
  mode: ColoringMode,
  subjects: readonly PaintSubject[],
): Legend => generateLegend(mode, subjects);

/* -------------------------------------------------------------------------- */
/* Đọc 21 đối tượng ra khỏi đồ thị.                                            */
/* -------------------------------------------------------------------------- */

/**
 * Loại con của một lỗ mở, suy từ đồ thị.
 *
 * Cửa hai cánh nhận ra bằng chính `swing: 'double'` — không có trường thứ hai
 * để hai nơi nói khác nhau. Nội thất KHÔNG đọc bằng hàm này: `FurnitureKind`
 * không một-một với tám loại con (xem {@link FURNITURE_KIND_BY_SUBTYPE}).
 */
export const subtypeOfOpening = (opening: GraphOpening): ObjectSubtype => {
  if (opening.kind === 'window') {
    return 'window';
  }

  return opening.swing === 'double' ? 'doubleDoor' : 'singleDoor';
};

/**
 * Trạng thái màu của một đối tượng.
 *
 * Luật là luật của `toViewModel.ts:215-221`: `verified` tới TỪ `reviewed` và
 * từ không gì khác (A5), mọi thứ dưới mức AI-chắc-chắn là `attention`. Hàm
 * `reviewStatus` ở đó không được xuất và không có bộ dựng viewmodel nào cho đồ
 * đạc, nên luật được viết lại đúng một lần ở đây — và
 * `useObjectLayerReview.test.ts` khẳng định nó KHỚP `toOpeningViewModel` cho
 * từng lỗ mở của bộ mẫu, nên hai bản không trôi khỏi nhau trong im lặng.
 *
 * Thêm đúng một điều màn này biết mà viewmodel chung không biết: một đối tượng
 * chưa gắn được vào tường nào là thứ người duyệt đang đi tìm, nên nó lên
 * `attention` kể cả khi AI rất tự tin.
 */
export function objectStatusCode(review: ReviewMetadata, isOrphan: boolean): ViewStatusCode {
  if (review.reviewed) {
    return 'verified';
  }

  if (isOrphan) {
    return 'attention';
  }

  return confidenceLevel(review.confidence) === 'certain' ? 'neutral' : 'attention';
}

/** Ảnh chụp lỗ mở mà M-08 nhận, dựng từ một đối tượng ĐÃ gắn tường. */
export function attachedOpeningOfObject(
  object: AttachedReviewObject,
  wall: SolidWall,
): AttachedOpening {
  return {
    id: entityIdOf(object.id, object.layer) as OpeningId,
    kind: object.layer === 'window' ? 'window' : 'door',
    widthMm: millimetres(object.widthMm),
    heightMm: millimetres(object.heightMm),
    sillHeightMm: millimetres(object.sillHeightMm ?? OPENING_RULES.doorSillHeightMm),
    swing: object.swing,
    wallId: wall.id,
    relativePosition: object.relativePosition,
  };
}

/**
 * Vị trí một món đồ đạc dọc tường chủ, đo bằng M-08.
 *
 * Đồ thị lưu tâm món đồ bằng toạ độ tuyệt đối, còn màn hình cần fraction dọc
 * tim tường. Phép chiếu đó là việc của `attachToWall` — màn KHÔNG tự chiếu
 * (CẤM TUYỆT ĐỐI). Bán kính dùng `orphanSuggestionRadiusMm` vì món đồ đứng
 * cạnh tường chứ không nằm trong lòng tường như một lỗ mở.
 */
export function furniturePositionOnWall(
  furniture: Furniture,
  seed: ObjectSeedEntry,
  wall: SolidWall,
): RelativePosition | null {
  const attachment = attachToWall(
    {
      id: seed.entityId as OpeningId,
      kind: 'void',
      widthMm: millimetres(seed.widthMm),
      heightMm: millimetres(seed.heightMm),
      sillHeightMm: millimetres(OPENING_RULES.doorSillHeightMm),
      swing: seed.swing,
      centre: toPointMm(furniture.centre),
    },
    [wall],
    OPENING_RULES.orphanSuggestionRadiusMm,
  );

  return attachment.opening.wallId === null ? null : attachment.opening.relativePosition;
}

/**
 * 21 đối tượng của màn, đọc từ ĐỒ THỊ (không phải từ bộ mẫu).
 *
 * Bộ mẫu chỉ còn giữ hai thứ đồ thị không mang: loại con của một món nội thất,
 * và toạ độ dò được của đối tượng chưa gắn tường. Mọi thứ khác — vị trí, kích
 * thước, cờ duyệt, độ tin cậy — đọc từ đồ thị, nên một lượt `Ctrl+Z` là đủ để
 * cả màn quay lại đúng trạng thái cũ.
 */
export function objectsOf(
  graph: NormalizedSpatial | null,
  level: Level | null,
  seed: readonly ObjectSeedEntry[] = OBJECT_LAYER_SEED,
): readonly ReviewObject[] {
  if (graph === null || level === null) {
    return NO_OBJECTS;
  }

  const solidById = new Map(solidWallsOf(graph, level).map((wall) => [wall.id, wall] as const));
  const objects: ReviewObject[] = [];

  for (const entry of seed) {
    const entity = graph.byId[entry.entityId];

    if (entity === undefined) {
      if (entry.tracedCentre !== null) {
        objects.push(orphanObjectOf(entry));
      }

      continue;
    }

    if ('wallId' in entity) {
      const solid = solidById.get(entity.wallId);

      if (solid === undefined) {
        continue;
      }

      const subtype = subtypeOfOpening(entity);

      objects.push({
        id: entry.displayId,
        layer: OBJECT_SUBTYPE_LAYER[subtype],
        subtype,
        widthMm: millimetres(entity.widthMm),
        heightMm: millimetres(entity.heightMm),
        sillHeightMm: entity.kind === 'window' ? millimetres(entity.sillHeightMm) : null,
        swing: entity.swing,
        confidence: entity.confidence,
        reviewed: entity.reviewed,
        hostWallId: entity.wallId,
        relativePosition: relativePositionOf(entity, solid),
      });

      continue;
    }

    if ('boundingBox' in entity && entry.hostWallId !== null) {
      const solid = solidById.get(entry.hostWallId);
      const position = solid === undefined ? null : furniturePositionOnWall(entity, entry, solid);

      if (solid === undefined || position === null) {
        continue;
      }

      objects.push({
        id: entry.displayId,
        layer: 'furniture',
        subtype: entry.subtype,
        widthMm: millimetres(entry.widthMm),
        heightMm: millimetres(entry.heightMm),
        sillHeightMm: null,
        swing: entry.swing,
        confidence: entity.confidence,
        reviewed: entity.reviewed,
        hostWallId: solid.id,
        relativePosition: position,
      });
    }
  }

  return objects;
}

/** Một dòng bộ mẫu chưa gắn, đọc bằng vựng viewmodel của màn. */
export function orphanObjectOf(entry: ObjectSeedEntry): OrphanReviewObject {
  return {
    id: entry.displayId,
    layer: entry.layer,
    subtype: entry.subtype,
    widthMm: millimetres(entry.widthMm),
    heightMm: millimetres(entry.heightMm),
    sillHeightMm: entry.sillHeightMm === null ? null : millimetres(entry.sillHeightMm),
    swing: entry.swing,
    confidence: entry.confidence,
    reviewed: entry.reviewed,
    hostWallId: null,
    tracedCentre: entry.tracedCentre ?? { x: 0, y: 0 },
  };
}

/* -------------------------------------------------------------------------- */
/* Bộ đếm — 21 = 9 + 7 + 5, tính từ dữ liệu.                                   */
/* -------------------------------------------------------------------------- */

/** Ba lớp con và tổng, tính từ chính danh sách đối tượng. */
export const countsOf = (objects: readonly ReviewObject[]): ObjectLayerCounts =>
  countObjectsByLayer(objects);

/** Bộ đếm duyệt, tính từ chính danh sách đối tượng — không gõ tay 9 hay 21. */
export const reviewCounterOf = (objects: readonly ReviewObject[]): ObjectReviewCounter => ({
  reviewed: objects.filter((object) => object.reviewed).length,
  total: objects.length,
});

/** Những đối tượng dưới ngưỡng tin cậy và chưa duyệt — nhánh (a) của trạng thái một phần. */
export const lowConfidenceObjectsOf = (
  objects: readonly ReviewObject[],
): readonly ReviewObject[] =>
  objects.filter((object) => !object.reviewed && isLowConfidenceObject(object.confidence));

/* -------------------------------------------------------------------------- */
/* Viewmodel — một dòng danh sách, một thanh tra, một hình tường nền.           */
/* -------------------------------------------------------------------------- */

/** Một dòng của danh sách gộp theo ba nhóm. */
export function toObjectRow(object: ReviewObject): ObjectListRowViewModel {
  const attached = isOrphanObject(object) ? null : object;
  const isOrphan = attached === null;

  return {
    id: object.id,
    layer: object.layer,
    subtype: object.subtype,
    codeLabel: `#${object.id}`,
    sizeLabel: formatObjectSize(object.widthMm, object.heightMm),
    hostWallLabel: attached === null ? null : `#${hostWallDisplayCode(attached.hostWallId)}`,
    confidence: object.confidence,
    statusCode: objectStatusCode(
      { confidence: object.confidence, source: object.reviewed ? 'human' : 'ai', reviewed: object.reviewed },
      isOrphan,
    ),
    isReviewed: object.reviewed,
    isLowConfidence: isLowConfidenceObject(object.confidence),
    isOrphan,
  };
}

/**
 * Thanh tra đối tượng đang chọn.
 *
 * Khoảng cách tới HAI ĐẦU tường đo bằng `openingSpan` của M-08 và
 * `centrelineLength` của `src/domain/walls` — không một phép hình học nào viết
 * mới ở đây, và số đo trên `MeasurementLabel` vì thế không lệch được khỏi số
 * mà tầng lệnh dùng để kiểm.
 */
export function toObjectInspector(
  object: ReviewObject,
  wall: SolidWall | null,
): ObjectInspectorViewModel {
  const attached = isOrphanObject(object) ? null : object;
  const isOrphan = attached === null;
  const span =
    attached === null || wall === null ? null : spanOfObject(wall, attachedOpeningOfObject(attached, wall));

  return {
    id: object.id,
    codeLabel: `#${object.id}`,
    subtype: object.subtype,
    widthLabel: formatMillimetres(object.widthMm),
    heightLabel: formatMillimetres(object.heightMm),
    sillHeightLabel: object.sillHeightMm === null ? null : formatMillimetres(object.sillHeightMm),
    hostWallLabel: attached === null ? null : `#${hostWallDisplayCode(attached.hostWallId)}`,
    hostWallId: attached?.hostWallId ?? null,
    relativePosition: attached?.relativePosition ?? null,
    distanceToStartLabel: span === null ? null : formatMillimetres(span.lowMm),
    distanceToEndLabel:
      span === null || wall === null ? null : formatMillimetres(centrelineLength(wall) - span.highMm),
    swing: object.swing,
    confidence: object.confidence,
    isOrphan,
    reviewed: object.reviewed,
  };
}

/**
 * Đa giác của mọi tường trên tầng, qua `resolveWallShapes` — nguồn DUY NHẤT của
 * hình tường để vẽ.
 *
 * Một bản vẽ hỏng không được làm trắng màn (A11), nên lỗi của hàm hình học
 * thành "không có hình nào để vẽ" chứ không phải một ngoại lệ nổ ra giữa lượt
 * render.
 */
export function wallOutlinesOf(
  walls: readonly GraphWall[],
  level: Level,
): readonly HostWallOutlineViewModel[] {
  if (walls.length === 0) {
    return [];
  }

  try {
    const resolved = resolveWallShapes(walls.map((wall) => solidWallOf(wall, level)));

    return resolved.shapes.map((shape) => ({ id: shape.wallId, outline: shape.outline }));
  } catch {
    return [];
  }
}

/** Lỗ mở khác trên CÙNG tường — `validateOpening` cần chúng để kiểm chồng lấn. */
export function siblingOpeningsOf(
  graph: NormalizedSpatial,
  wall: SolidWall,
): readonly DomainOpening[] {
  return openingsOfWall(graph, wall.id).map((opening) => toAttachedOpening(opening, wall));
}

/* -------------------------------------------------------------------------- */
/* Cái seam — cổng dữ liệu.                                                    */
/* -------------------------------------------------------------------------- */

/** Ảnh nền của lớp đối tượng — bản vẽ gốc đã tải lên, đọc qua `spatial.readFloor`. */
export interface ObjectLayerBackground {
  readonly imageUrl: string | null;
  readonly imageAlt: string;
  readonly widthMm: number | null;
  readonly heightMm: number | null;
}

/** Mô tả ảnh nền cho trình đọc màn hình (R-72). */
export const backgroundImageAlt = (floorName: string): string =>
  `Bản vẽ gốc của ${floorName}, dùng làm nền để đối chiếu lớp đối tượng.`;

export interface ReadObjectLayerInput {
  readonly projectId: string;
  readonly floorId: string;
  readonly signal?: AbortSignal;
}

export interface PersistObjectLayerInput {
  readonly projectId: string;
  readonly floorId: string;
  readonly graph: NormalizedSpatial;
}

/** Mỗi phương thức là một việc màn cần từ bên ngoài, và không có việc nào khác. */
export interface ObjectLayerReviewGateway {
  readonly supports: Readonly<Record<ObjectLayerCapability, boolean>>;
  /** Ảnh nền của tầng. Lỗi ở ĐÂY chỉ làm mất ảnh nền, không phải hỏng lớp đối tượng. */
  readonly readBackground: (input: ReadObjectLayerInput) => Promise<ObjectLayerBackground>;
  /** Lớp đối tượng của tầng. Lỗi ở đây là trạng thái `error` — ảnh gốc VẪN xem được. */
  readonly readObjectLayer: (input: ReadObjectLayerInput) => Promise<NormalizedSpatial | null>;
  /**
   * Nhánh nội thất, đọc riêng.
   *
   * Đặc tả đòi "nhánh nội thất lỗi trong khi cửa vẫn xong" phải hiện MỘT hàng
   * cần chú ý chứ không chặn cả màn, nên nó phải là một lượt đọc RIÊNG: gộp nó
   * vào `readObjectLayer` thì một lỗi nhận diện ghế sofa sẽ xoá sạch chín cửa
   * đã duyệt khỏi màn hình.
   */
  readonly readFurnitureBranch: (input: ReadObjectLayerInput) => Promise<null>;
  /** Đồ thị đang sửa — nơi `commit` vừa ghi vào. */
  readonly graph: ObjectLayerGraphPort;
  /**
   * Dòng bộ mẫu của tầng.
   *
   * Đồ thị không mang được hai thứ: loại con của một món nội thất, và toạ độ dò
   * được của đối tượng CHƯA GẮN (`Opening` của đồ thị bắt buộc có `wallId`).
   * Chúng đi qua cổng cùng đường với đồ thị, nên một tầng không có đối tượng
   * nào thật sự đọc ra con số 0 — chứ không mượn một bảng toàn cục.
   */
  readonly seed: readonly ObjectSeedEntry[];
  /** NOT FOUND — `persistObjectLayer`. Tự lưu nói ra sự thật này, không bịa một lượt lưu. */
  readonly persistObjectLayer: (
    input: PersistObjectLayerInput,
  ) => Promise<ObjectLayerCapabilityResult<void>>;
  /** Ai đang thao tác — đi vào `Command.actorId` và nhật ký hoạt động. */
  readonly actorId: string;
  /** Mốc giờ hiện tại. Tiêm được để test không phụ thuộc đồng hồ thật. */
  readonly now: () => number;
}

export interface CreateObjectLayerReviewGatewayOptions {
  readonly apiClient?: ApiClient;
  readonly graph?: ObjectLayerGraphPort;
  /** Dòng bộ mẫu. Vắng mặt thì cổng dùng bộ mẫu 21 đối tượng của màn. */
  readonly seed?: readonly ObjectSeedEntry[];
  readonly actorId?: string;
  readonly now?: () => number;
}

/**
 * Người thực hiện mặc định khi nơi gọi chưa truyền ai.
 *
 * Một chuỗi ĐẶT TÊN chứ không phải chuỗi rỗng: `validateCommands` từ chối lệnh
 * thiếu `actorId`, nên một mặc định rỗng sẽ làm mọi lệnh hỏng ở bước `validate`
 * thay vì hỏng ở chỗ người nối dây quên truyền.
 */
export const OBJECT_LAYER_DEFAULT_ACTOR_ID = 'object-layer-reviewer';

/** Cổng thật — thứ container lớp 3 gọi. */
export function createObjectLayerReviewGateway(
  options: CreateObjectLayerReviewGatewayOptions = {},
): ObjectLayerReviewGateway {
  const apiClient = options.apiClient ?? mockApiClient;
  const graph: ObjectLayerGraphPort = options.graph ?? {
    read: () => useStore.getState().spatial,
  };

  return {
    supports: {
      readBackground: true,
      readObjectGraph: true,
      writeObjectGraph: true,
      persistObjectLayer: false,
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

    readObjectLayer: () => Promise.resolve(graph.read()),
    readFurnitureBranch: () => Promise.resolve(null),

    graph,
    seed: options.seed ?? OBJECT_LAYER_SEED,

    persistObjectLayer: () => Promise.resolve(unsupported('persistObjectLayer')),

    actorId: options.actorId ?? OBJECT_LAYER_DEFAULT_ACTOR_ID,
    now: options.now ?? ((): number => Date.now()),
  };
}

/* -------------------------------------------------------------------------- */
/* Bộ mẫu — chỗ story và test cắm vào (R-73).                                  */
/* -------------------------------------------------------------------------- */

/** Ảnh nền của bộ mẫu. Không phải đường dẫn thật, nên không phạm R-65. */
export const OBJECT_LAYER_SAMPLE_IMAGE = 'sample-floor-plan.png';

/** Khổ bản vẽ mẫu — bao trọn lưới 12.500 × 8.800 mm của bộ mẫu, có lề. */
export const OBJECT_LAYER_SAMPLE_DRAWING_WIDTH_MM = 13000;
export const OBJECT_LAYER_SAMPLE_DRAWING_HEIGHT_MM = 9300;

/** Cách bài kiểm ép một cảnh cụ thể, không sửa mã. */
export interface ObjectLayerGatewaySeed {
  /** Đồ thị cổng trả về. Vắng mặt thì cổng đọc đồ thị bộ mẫu. */
  readonly graph?: NormalizedSpatial | null;
  /** Dòng bộ mẫu đi kèm đồ thị đó. Vắng mặt thì dùng bộ mẫu 21 đối tượng. */
  readonly seed?: readonly ObjectSeedEntry[];
  /** `true` thì `readBackground` ném — ảnh nền mất, lớp đối tượng thì không. */
  readonly failReadBackground?: boolean;
  /** `true` thì `readObjectLayer` ném — đúng cảnh `error` của bảy kịch bản. */
  readonly failReadObjectLayer?: boolean;
  /** `true` thì riêng nhánh nội thất ném — cửa vẫn xong, màn KHÔNG bị chặn. */
  readonly failFurnitureBranch?: boolean;
  /** `true` thì ảnh nền chưa có — canvas vẽ khung xám chờ. */
  readonly withoutImage?: boolean;
  /** `true` thì `persistObjectLayer` chạy thật (bộ mẫu có đường lưu). */
  readonly canPersist?: boolean;
  readonly actorId?: string;
  readonly now?: () => number;
}

/** Cổng có dữ liệu — dùng chung giữa test và story, không bịa bảng dữ liệu thứ hai (R-70). */
export function createMockObjectLayerReviewGateway(
  seed: ObjectLayerGatewaySeed = {},
): ObjectLayerReviewGateway {
  const canPersist = seed.canPersist ?? true;
  const readGraph = (): NormalizedSpatial | null =>
    seed.graph === undefined ? OBJECT_LAYER_SAMPLE_GRAPH : seed.graph;

  return {
    supports: {
      readBackground: true,
      readObjectGraph: true,
      writeObjectGraph: true,
      persistObjectLayer: canPersist,
    },

    readBackground: () => {
      if (seed.failReadBackground === true) {
        return Promise.reject(new Error('Không tải được bản vẽ gốc của tầng.'));
      }

      const hasImage = seed.withoutImage !== true;

      return Promise.resolve({
        imageUrl: hasImage ? OBJECT_LAYER_SAMPLE_IMAGE : null,
        imageAlt: backgroundImageAlt(OBJECT_LAYER_SAMPLE_LEVEL.name),
        widthMm: hasImage ? OBJECT_LAYER_SAMPLE_DRAWING_WIDTH_MM : null,
        heightMm: hasImage ? OBJECT_LAYER_SAMPLE_DRAWING_HEIGHT_MM : null,
      });
    },

    readObjectLayer: () => {
      if (seed.failReadObjectLayer === true) {
        return Promise.reject(new Error(OBJECT_LAYER_TEXT.errorMessage));
      }

      return Promise.resolve(readGraph());
    },

    readFurnitureBranch: () => {
      if (seed.failFurnitureBranch === true) {
        return Promise.reject(new Error(OBJECT_LAYER_TEXT.furnitureAttention));
      }

      return Promise.resolve(null);
    },

    graph: { read: readGraph },
    seed: seed.seed ?? OBJECT_LAYER_SEED,

    persistObjectLayer: () =>
      Promise.resolve(
        canPersist ? { supported: true, value: undefined } : unsupported('persistObjectLayer'),
      ),

    actorId: seed.actorId ?? OBJECT_LAYER_DEFAULT_ACTOR_ID,
    now: seed.now ?? ((): number => Date.now()),
  };
}

/* -------------------------------------------------------------------------- */
/* D-04 — một lượt ghi lạc quan, xếp hàng theo đối tượng.                       */
/* -------------------------------------------------------------------------- */

/** Biến của một lượt ghi lạc quan trên đúng một đối tượng. */
export interface ObjectWriteVariables {
  /** Mã hiển thị — cũng là khoá `runExclusive` xếp hàng theo, một đối tượng một hàng. */
  readonly objectId: string;
  readonly projectId: string;
  readonly floorId: string;
}

export interface CreateObjectLayerMutationOptions {
  readonly gateway: ObjectLayerReviewGateway;
  /** Áp lệnh ngay, trước khi máy chủ trả lời. */
  readonly applyOptimistic: (variables: ObjectWriteVariables) => void;
  /** Gỡ lượt áp lạc quan khi máy chủ từ chối — chạy trên ngăn xếp hoàn tác của S-06. */
  readonly rollback: (variables: ObjectWriteVariables) => void;
  /** Khoá cần dọn sau một lượt ghi thành công. */
  readonly affectedKeys: (variables: ObjectWriteVariables) => readonly QueryKey[];
  readonly afterSuccess: (variables: ObjectWriteVariables) => void;
}

/**
 * Cấu hình `useMutation` của một lượt ghi lạc quan (D-04).
 *
 * `callServer` KHÔNG ném khi `persistObjectLayer` trả `supported: false`: đó là
 * một câu trả lời thật ("chưa có endpoint"), không phải một lượt ghi hỏng, và
 * biến nó thành lỗi sẽ khiến MỌI lượt sửa bị `rollback` gỡ ra ngay trước mắt
 * người duyệt. Nhánh đó đi ra ngoài dưới dạng kết quả để thanh trạng thái nói
 * đúng sự thật, còn `rollback` để dành cho lỗi truyền thật.
 */
export function createObjectLayerMutation(
  queryClient: QueryClient,
  options: CreateObjectLayerMutationOptions,
): UseMutationOptions<ObjectLayerCapabilityResult<void>, AppError, ObjectWriteVariables> {
  return createOptimisticMutation<ObjectWriteVariables, ObjectLayerCapabilityResult<void>>(
    queryClient,
    {
      affectedKeys: options.affectedKeys,
      afterSuccess: (_result, variables) => {
        options.afterSuccess(variables);
      },
      applyOptimistic: options.applyOptimistic,
      callServer: (variables) =>
        options.gateway.persistObjectLayer({
          floorId: variables.floorId,
          projectId: variables.projectId,
          graph: options.gateway.graph.read() ?? OBJECT_LAYER_SAMPLE_GRAPH,
        }),
      entityId: (variables) => variables.objectId,
      rollback: options.rollback,
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Quy đổi mm → px và khung nhìn (R-07).                                       */
/* -------------------------------------------------------------------------- */

/** Tỷ lệ dùng khi tầng CHƯA hiệu chỉnh: một milimét là một điểm ảnh. */
const UNCALIBRATED_SCALE: MillimetresPerPixel = millimetresPerPixel(1);

/** Tỷ lệ của tầng, dạng số mà hợp đồng canvas nhận. */
export const millimetresPerPixelOf = (level: Level | null): MillimetresPerPixel =>
  level?.scaleMillimetresPerPixel ?? UNCALIBRATED_SCALE;

/** Bộ quy đổi của một tầng — `scaleFromRatio` là hàm DUY NHẤT làm việc này (R-61). */
export const scaleOfLevel = (level: Level | null): Scale =>
  scaleFromRatio(millimetresPerPixelOf(level));

/** Khổ bản vẽ tính bằng pixel. `null` khi chưa có bản vẽ nào. */
export interface DrawingSizePx {
  readonly width: number;
  readonly height: number;
}

/** Khổ ảnh bản vẽ tính bằng pixel. `null` khi chưa có bản vẽ nào. */
export function drawingSizeOf(
  background: ObjectLayerBackground | undefined,
  level: Level | null,
): DrawingSizePx | null {
  if (background === undefined || background.widthMm === null || background.heightMm === null) {
    return null;
  }

  const scale = scaleOfLevel(level);

  return {
    width: scale.millimetresToPixels(millimetres(background.widthMm)),
    height: scale.millimetresToPixels(millimetres(background.heightMm)),
  };
}

/** Khung chữ nhật mà `flyToBounds` của R-07 nhận. */
export interface ObjectLayerBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/**
 * Hộp bao của một dãy điểm.
 *
 * Repo chưa có hàm nào làm việc này ở `src/domain` hay `src/lib` — màn QC anh em
 * cũng phải tự viết (`wallLayerReviewGateway.ts#boundsOfPoints`). Viết ở tầng
 * cổng chứ không ở view, và là phép hình học DUY NHẤT của file này.
 */
export function boundsOfPoints(points: readonly Point[]): ObjectLayerBounds | null {
  const first = points[0];

  if (first === undefined) {
    return null;
  }

  let minX = first.x;
  let minY = first.y;
  let maxX = first.x;
  let maxY = first.y;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return { minX, minY, maxX, maxY };
}

/** Khung nhìn của một tường chủ, tính bằng pixel — đích của lượt bay R-07. */
export function wallBoundsPx(outline: readonly Point[], level: Level | null): ObjectLayerBounds | null {
  const scale = scaleOfLevel(level);

  return boundsOfPoints(
    outline.map((point) => ({
      x: scale.millimetresToPixels(millimetres(point.x)),
      y: scale.millimetresToPixels(millimetres(point.y)),
    })),
  );
}

/* -------------------------------------------------------------------------- */
/* Hai phép quy đổi mà hook cần, và lượt gắn của đối tượng chưa có tường.       */
/* -------------------------------------------------------------------------- */

/**
 * Vị trí mới của Slider thành `offsetMm` mà `opening.move` của S-07 nhận.
 *
 * `offsetOnWall` của `shared.ts` là hàm DUY NHẤT làm phép quy đổi này trong
 * repo — hook không nhân chia gì, nó chỉ đưa fraction vào đây (R-61).
 */
export const offsetForPosition = (
  object: AttachedReviewObject,
  wall: SolidWall,
  position: RelativePosition,
): number =>
  offsetOnWall({ ...attachedOpeningOfObject(object, wall), relativePosition: position }, wall);

/**
 * Đầu vào của lệnh `opening.add` cho một đối tượng CHƯA GẮN, hoặc `null` khi
 * không có tường nào nhận nó.
 *
 * Ba bước, cả ba là M-08, màn không tự tìm tường và không tự tính vị trí gắn:
 *
 * 1. `findOrphans` nêu tường ĐÁNG GỢI Ý và fraction trên tường đó. Bán kính gợi
 *    ý (`OPENING_RULES.orphanSuggestionRadiusMm`, 1500 mm) rộng hơn bán kính
 *    gắn tự động (`DEFAULT_ATTACH_RADIUS_MM`, 150 mm) đúng như domain đã thiết
 *    kế: tự động thì phải chắc chắn, còn gợi ý thì có người xem lại.
 * 2. `placeOnWall` đổi fraction đó thành toạ độ tuyệt đối trên tim tường.
 * 3. `attachToWall` với BÁN KÍNH MẶC ĐỊNH xác nhận điểm ấy thật sự gắn được —
 *    đây là lượt kiểm mà đặc tả đòi ("hành động gọi `attachToWall` với
 *    `DEFAULT_ATTACH_RADIUS_MM`"), và cũng đúng lượt kiểm mà
 *    `createAddOpeningCommand` sẽ chạy lại bên trong nó.
 */
export function attachOrphanToNearestWall(
  entry: ObjectSeedEntry,
  graph: NormalizedSpatial,
  level: Level,
  seed: readonly ObjectSeedEntry[] = OBJECT_LAYER_SEED,
): AddOpeningInput | null {
  if (entry.layer === 'furniture' || entry.tracedCentre === null) {
    return null;
  }

  const walls = solidWallsOf(graph, level);
  const report = orphanReportsOf(domainOpeningsOf(graph, level, seed), walls).find(
    (candidate) => candidate.opening.id === entry.entityId,
  );

  if (report === undefined || report.suggestedWallId === null || report.suggestedPosition === null) {
    return null;
  }

  const wall = walls.find((candidate) => candidate.id === report.suggestedWallId);

  if (wall === undefined) {
    return null;
  }

  const centre = positionOnWall(wall, report.suggestedPosition);
  const traced = tracedOpeningOf(entry);
  const confirmed = attachObjectToWall(
    { ...traced, centre: toPointMm(centre) },
    walls,
    DEFAULT_ATTACH_RADIUS_MM,
  );

  if (confirmed.wallId === null) {
    return null;
  }

  return {
    id: entry.entityId as OpeningId,
    levelId: level.id,
    kind: entry.layer === 'window' ? 'window' : 'door',
    centre,
    widthMm: entry.widthMm,
    heightMm: entry.heightMm,
    sillHeightMm: entry.sillHeightMm ?? OPENING_RULES.doorSillHeightMm,
    swing: entry.swing,
  };
}

/* -------------------------------------------------------------------------- */
/* Toạ độ vẽ — phía sản xuất cho canvas (T6/T7).                               */
/* -------------------------------------------------------------------------- */

/*
 * Vì sao toạ độ vẽ được TÍNH SẴN ở đây.
 *
 * `ObjectLayerCanvas` vẽ bằng ký hiệu kiến trúc, không phải khung bao — và một
 * ký hiệu cần biết tâm, hướng chạy của tường chủ, bề rộng lỗ mở và BỀ DÀY
 * TƯỜNG. Cả bốn là hình học, và A15/R-60 đặt hình học ở viewmodel chứ không ở
 * view. Không một phép nào dưới đây được viết mới: tâm là `placeOnWall` của
 * M-08, hướng là `wallBearing` của `src/domain/walls/edit.ts`, hộp bao là
 * `boxAround` của `src/lib/input/dragDrop.ts`, quy đổi là `scale.millimetresToPixels`.
 */

/** Một điểm milimét của bản vẽ, đọc bằng pixel đúng cách `<svg viewBox>` đọc nó. */
export const toPixelPoint = (point: Point, scale: Scale): PixelPoint => ({
  x: scale.millimetresToPixels(millimetres(point.x)),
  y: scale.millimetresToPixels(millimetres(point.y)),
});

/** Điểm giữa hai điểm — chỗ `MeasurementLabel` đặt nhãn số đo. */
export const midpointPx = (from: PixelPoint, to: PixelPoint): PixelPoint => ({
  x: (from.x + to.x) / 2,
  y: (from.y + to.y) / 2,
});

/** Hộp bao chưa xoay của một đối tượng, tính bằng pixel. */
function boundsPxOf(centreMm: Point, widthMm: number, depthMm: number, scale: Scale): PixelRect {
  const box = boxAround(centreMm, widthMm, depthMm);
  const min = toPixelPoint(box.min, scale);
  const max = toPixelPoint(box.max, scale);

  return { x: min.x, y: min.y, width: max.x - min.x, height: max.y - min.y };
}

/**
 * Toạ độ vẽ của MỘT đối tượng.
 *
 * `depthPx` là BỀ DÀY TƯỜNG CHỦ, không phải `heightMm`: một ký hiệu cửa trên
 * mặt bằng cắt ngang hết bề dày tường, còn `heightMm` là chiều cao đứng và
 * không xuất hiện trên mặt bằng. Đối tượng CHƯA GẮN không có tường chủ để đọc
 * bề dày, nên nó rơi về chiều sâu của chính nó — và `isOrphan` nói rõ cho view
 * biết đó là trường hợp nào.
 */
export function toObjectPlacement(
  object: ReviewObject,
  wall: SolidWall | null,
  scale: Scale,
): ObjectPlacementViewModel {
  const attached = isOrphanObject(object) ? null : object;
  const centreMm =
    attached === null || wall === null
      ? (object as OrphanReviewObject).tracedCentre
      : positionOnWall(wall, attached.relativePosition);
  const depthMm = wall === null ? object.heightMm : wall.thicknessMm;

  return {
    id: object.id,
    layer: object.layer,
    subtype: object.subtype,
    swing: object.swing,
    centrePx: toPixelPoint(centreMm, scale),
    angleDeg: wall === null ? 0 : wallBearing(wall),
    widthPx: scale.millimetresToPixels(millimetres(object.widthMm)),
    depthPx: scale.millimetresToPixels(millimetres(depthMm)),
    boundsPx: boundsPxOf(centreMm, object.widthMm, depthMm, scale),
    codeLabel: `#${object.id}`,
    isOrphan: attached === null,
  };
}

/** Toạ độ vẽ của mọi đối tượng đang thấy. */
export function objectPlacementsOf(
  objects: readonly ReviewObject[],
  walls: readonly SolidWall[],
  level: Level | null,
): readonly ObjectPlacementViewModel[] {
  const scale = scaleOfLevel(level);
  const wallById = new Map(walls.map((wall) => [wall.id, wall] as const));

  return objects.map((object) =>
    toObjectPlacement(
      object,
      isOrphanObject(object) ? null : (wallById.get(object.hostWallId) ?? null),
      scale,
    ),
  );
}

/**
 * Số đo tới HAI ĐẦU tường trong lúc kéo Slider vị trí.
 *
 * Hai con số tới từ `openingSpan` của M-08 và `centrelineLength` của
 * `src/domain/walls` — cùng hai hàm mà tầng lệnh dùng để kiểm, nên nhãn trên
 * canvas không thể lệch khỏi thứ lệnh sẽ chấp nhận.
 */
export function toDragMeasurement(
  object: AttachedReviewObject,
  wall: SolidWall,
  level: Level | null,
  state: MeasurementState,
): ObjectDragMeasurement {
  const scale = scaleOfLevel(level);
  const span = spanOfObject(wall, attachedOpeningOfObject(object, wall));
  const wallStartPx = toPixelPoint(wall.centreline.start, scale);
  const wallEndPx = toPixelPoint(wall.centreline.end, scale);
  const objectPx = toPixelPoint(positionOnWall(wall, object.relativePosition), scale);

  return {
    objectId: object.id,
    state,
    wallStartPx,
    wallEndPx,
    objectPx,
    midToStartPx: midpointPx(wallStartPx, objectPx),
    midToEndPx: midpointPx(objectPx, wallEndPx),
    distanceToStartLabel: formatMillimetres(span.lowMm),
    distanceToEndLabel: formatMillimetres(centrelineLength(wall) - span.highMm),
  };
}
