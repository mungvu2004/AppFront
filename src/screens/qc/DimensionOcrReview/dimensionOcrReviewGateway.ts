/**
 * Cổng dữ liệu và tầng lệnh của màn S-14 "Đọc kích thước OCR" — mọi lời gọi ra
 * khỏi màn đi qua đây.
 *
 * Cùng khuôn `objectLayerReviewGateway.ts` của màn QC anh em: một danh sách khả
 * năng, một bản kê nợ endpoint, một `interface` cho hình dạng cổng, một factory
 * dựng cổng thật và một factory dựng cổng có dữ liệu cho test và story (R-73).
 *
 * ## Đường ghi — `dispatch` chạy qua `commit` (S-07 + S-05 + A10)
 *
 * Sửa một giá trị và duyệt một chuỗi đều là LỆNH. Lệnh đi qua `dispatch` (năm
 * bước `validate → apply → history → rules → sync`) và `SpatialPort.applyPatches`
 * được cài bằng `commit(patches, label)` của `src/store/commit.ts`. Không một
 * dòng nào gọi `set()` hay `_applyPatches()`.
 *
 * ## Hai lệnh `dimension.*` còn thiếu — dựng bằng nguyên thuỷ công khai
 *
 * `.orca-notes/S14-T1-logic.contract.md` mục D xác nhận: repo KHÔNG có lệnh
 * `dimension.*` nào (`src/lib/commands/business/` chỉ có `openingCommands.ts`,
 * `roomFloorCommands.ts`, `wallCommands.ts`). Điều phối viên đã duyệt cách dựng
 * bằng `createCommand` + `changeForUpdate`, hợp lệ vì `CommandType` là `string`
 * mở và `validateCommands` (`dispatch.ts:220-328`) chỉ kiểm `command.type` khác
 * rỗng chứ không so với một bảng cho phép. Lệnh tự hoàn tác được vì
 * `changeForUpdate` mang ĐỦ ảnh chụp `before`/`after`, và `invertCommand` chỉ
 * hoán đổi hai ảnh đó — không cần thêm một dòng nào cho `Ctrl+Z`.
 *
 * **A5 ép ngay ở kiểu dựng lệnh:** {@link buildApproveDimensionCommand} là
 * đường DUY NHẤT đặt `reviewed: true`, và nó luôn đặt kèm `source: 'human'`.
 * Không có tham số nào cho phép người gọi truyền `source`, nên đầu ra OCR/AI
 * không có đường nào bật được cờ xanh "đã xác minh".
 * {@link buildOverrideDimensionCommand} cố ý KHÔNG chạm `reviewed`,
 * `confidence` hay `source`: một số người gõ đè là DỮ LIỆU, còn cờ xanh là
 * PHÁN QUYẾT của người duyệt — trộn hai thứ đó lại chính là điều A5 cấm.
 *
 * ## Độ lệch (M-02, QĐ-5) — GỌI LẠI, không tự tính
 *
 * `compareLengthToMeasured` của `src/domain/units/compare.ts` là nguồn DUY NHẤT
 * của độ lệch. Ngưỡng 2% nằm sẵn trong hàm đó
 * (`SCALE_THRESHOLDS.levelAgreementLimit`), nên cổng KHÔNG truyền ngưỡng và
 * KHÔNG so ngưỡng lại: nó chỉ đọc `exceedsLimit`. Không một phép trừ hay phép
 * chia nào ở file này ra một độ lệch.
 *
 * ## Đo lại từ hình học (M-15) — GỌI LẠI, không tự đo
 *
 * `measureDistance` của `src/domain/measure/measure.ts` đo `Dimension.line`.
 * `Dimension.line.start`/`.end` là `Point` với `Millimetres` KHÔNG branded của
 * `spatial/types.ts`, còn `measureDistance` đòi bản BRANDED của `units/types.ts`
 * — nên toạ độ luôn đi qua `toPointMm` và mọi độ dài đơn lẻ đi qua
 * `millimetres()`. **Không một chỗ nào ép kiểu bằng `as` cho hai kiểu đó**: ép
 * kiểu ở đây là nói dối đúng thứ mà kiểu branded sinh ra để chặn.
 *
 * ## Giá trị vô lý (QĐ-4) — `splitOutliers`, không ngưỡng viết tay
 *
 * Repo không có hàm nào phán một chiều dài ĐƠN LẺ là vô lý, và không có hằng
 * "chiều dài phòng tối đa" (hợp đồng T1, mục L). Thay vào đó
 * {@link implausibleDimensionIds} thay giá trị đang gõ vào đúng vị trí của nó
 * trong TẬP 34 chuỗi rồi gọi `splitOutliers` với
 * `SCALE_THRESHOLDS.outlierRejection` — chú thích của chính hằng đó gọi nó là
 * "modified z-score beyond which a sample is treated as an OCR failure". Nhờ
 * vậy "phòng dài 30 mét" bị bắt vì nó lệch khỏi các chuỗi còn lại, chứ không vì
 * một ngưỡng viết tay (R-71).
 *
 * ## Hai việc chưa có đường (NOT FOUND, ghi ra chứ không vá)
 *
 * - `persistDimensionLayer` — `ENDPOINTS.spatial.floor` nhận
 *   `Partial<FloorWriteBody>`, không có chỗ cho danh sách `Dimension`.
 * - `queryKeys.dimension` — `src/lib/query/queryKeys.ts` không có domain
 *   `dimension`. Màn KHÔNG được thêm domain vào `src/lib` (R-68), nên lượt đọc
 *   lớp kích thước dùng `queryKeys.space.byFloor` — đúng khoá mà
 *   `invalidationMap.editDimension` (`invalidation.ts:68-72`) đã khai là bị
 *   `editDimension` làm mất hiệu lực, nên hai bên không thể lệch nhau.
 */

import type { QueryClient, UseMutationOptions } from '@tanstack/react-query';

import type { ApiClient } from '@/api/client';
import { mockApiClient } from '@/api/__mocks__/client';
import { measureDistance } from '@/domain/measure/measure';
import { normalizeSpatial, type NormalizedSpatial } from '@/domain/spatial/normalize';
import type {
  Building,
  Dimension,
  DimensionId,
  Level,
  Point,
  ReviewMetadata,
  Wall as GraphWall,
} from '@/domain/spatial/types';
import { compareLengthToMeasured, type LengthDeviation } from '@/domain/units/compare';
import { splitOutliers } from '@/domain/units/outliers';
import {
  millimetresPerPixel,
  scaleFromRatio,
  SCALE_THRESHOLDS,
  type Scale,
} from '@/domain/units/scale';
import { millimetres, type Millimetres, type MillimetresPerPixel } from '@/domain/units/types';
import { entitiesOfKind, toPointMm } from '@/lib/commands/business/shared';
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
import { MERGE_WINDOW_MS } from '@/lib/commands/mergeCommands';
import { runTransaction } from '@/lib/commands/transaction';
import type { Command } from '@/lib/commands/types';
import type { AppError } from '@/lib/errors';
import { formatLength } from '@/lib/format/measure';
import { formatNumber, formatPercent } from '@/lib/format/number';
import { confidenceLevel } from '@/lib/format/semantic';
import { boxAround } from '@/lib/input/dragDrop';
import { createOptimisticMutation } from '@/lib/mutations/createOptimisticMutation';
import { createUndoTicket, UNDO_WINDOW_MS, type UndoTicket } from '@/lib/mutations/undoTicket';
import type { QueryKey } from '@/lib/query/queryKeys';
import type { ViewStatusCode } from '@/lib/viewmodel/types';
import { useStore } from '@/store';
import { commit } from '@/store/commit';

import {
  WALL_LAYER_FIXTURE_BUILDING,
  WALL_LAYER_FIXTURE_LEVEL,
  WALL_LAYER_FIXTURE_WALLS,
} from '../WallLayerReview/wallLayerReviewFixture';
import { DIMENSION_OCR_FIXTURE_DIMENSIONS } from './dimensionOcrFixture';
import {
  approveButtonAriaLabel,
  DIMENSION_OCR_TEXT,
  dimensionImageAlt,
  dimensionRowInputAriaLabel,
  lowConfidencePartialNotice,
  outlierHint,
  reviewProgressLabel as reviewProgressText,
  wallReferenceLabel,
} from './dimensionOcrText';
import {
  DIMENSION_CROP_DISPLAY_HEIGHT_PX,
  DIMENSION_CROP_DISPLAY_WIDTH_PX,
  type DimensionChainViewModel,
  type DimensionCompareViewModel,
  type DimensionCropViewModel,
  type DimensionPixelPoint,
  type DimensionPixelRect,
  type DimensionReviewCounter,
  type DimensionRowViewModel,
} from './dimensionOcrTypes';

/* -------------------------------------------------------------------------- */
/* Khả năng — những gì màn hỏi thế giới bên ngoài.                             */
/* -------------------------------------------------------------------------- */

/** Tên máy đọc của từng việc màn cần. Mỗi việc chưa làm được có một dòng nợ. */
export const DIMENSION_OCR_CAPABILITIES = [
  'readBackground',
  'readDimensionLayer',
  'readOcrProgress',
  'writeDimensionLayer',
  'persistDimensionLayer',
] as const;

export type DimensionOcrCapability = (typeof DIMENSION_OCR_CAPABILITIES)[number];

/** Việc trong danh sách trên mà bản cài đặt THẬT chưa làm được. Chỉ được ngắn đi. */
export const DIMENSION_OCR_MISSING_CAPABILITIES = ['persistDimensionLayer'] as const;

export type DimensionOcrMissingCapability = (typeof DIMENSION_OCR_MISSING_CAPABILITIES)[number];

/** Endpoint còn thiếu của từng khả năng, viết nguyên văn cho người nối dây sau. */
export const DIMENSION_OCR_MISSING_ENDPOINTS: Readonly<
  Record<DimensionOcrMissingCapability, string>
> = {
  persistDimensionLayer:
    'ENDPOINTS.spatial.floor chấp nhận Partial<FloorWriteBody> (src/api/client.ts), chỉ mang name/order/elevationMm/heightMm/drawings — không có chỗ cho danh sách Dimension, nên chưa có endpoint ghi lớp kích thước.',
};

/**
 * Nợ thứ hai. KHÔNG phải một khả năng của cổng nên không nằm trong bảng trên:
 * `src/lib/query/queryKeys.ts` không có domain `dimension`. Ghi ra ở đây cho
 * người nối dây sau, vì màn không được sửa `src/lib` (R-68).
 */
export const DIMENSION_OCR_MISSING_QUERY_DOMAIN =
  'queryKeys không có domain "dimension"; lớp kích thước tạm đọc chung khoá queryKeys.space.byFloor — đúng khoá mà invalidationMap.editDimension đã khai là bị lượt sửa kích thước làm mất hiệu lực.';

/** Một khả năng chưa tồn tại. `supported: false` là câu trả lời thật, không phải lỗi. */
export interface DimensionOcrUnsupported {
  readonly supported: false;
  readonly capability: DimensionOcrMissingCapability;
  /** Lấy nguyên từ {@link DIMENSION_OCR_MISSING_ENDPOINTS}. */
  readonly missing: string;
}

export interface DimensionOcrSupported<TValue> {
  readonly supported: true;
  readonly value: TValue;
}

export type DimensionOcrCapabilityResult<TValue> =
  | DimensionOcrSupported<TValue>
  | DimensionOcrUnsupported;

/** Dựng nhánh "chưa có đường làm việc này" — một chỗ duy nhất ghép tên với nợ. */
export function unsupported(capability: DimensionOcrMissingCapability): DimensionOcrUnsupported {
  return {
    supported: false,
    capability,
    missing: DIMENSION_OCR_MISSING_ENDPOINTS[capability],
  };
}

/* -------------------------------------------------------------------------- */
/* Mã máy và mã hiển thị.                                                      */
/* -------------------------------------------------------------------------- */

/** Số chữ số phần đếm trong thân mã — `COUNTER_LENGTH` của `src/domain/spatial/ids.ts:41`. */
const ID_COUNTER_LENGTH = 6;

/** Bề rộng nhãn người đọc: "M-014", không phải "M-14". */
const DISPLAY_CODE_DIGITS = 3;

/** Bốn ký tự đuôi của bộ mẫu — cùng hằng mà `dimensionOcrFixture.ts` sinh mã. */
const DIMENSION_ID_SUFFIX = 'DIMS';

/**
 * Nhãn người đọc của một mã: `M-000014DIMS` → `M-014`, `W-000014WALL` → `W-014`.
 *
 * Thuần cắt chuỗi, cùng khuôn `hostWallDisplayCode` của màn S-13: mã máy phải
 * dài (thân ≥ 10 ký tự) để `isIdOfKind` nhận, còn nhãn danh sách thì đặc tả đòi
 * đúng "#M-014".
 */
export function dimensionDisplayCode(id: string): string {
  const counter = id.slice(2).slice(0, ID_COUNTER_LENGTH).replace(/^0+/u, '');

  return `${id.slice(0, 1)}-${(counter === '' ? '0' : counter).padStart(DISPLAY_CODE_DIGITS, '0')}`;
}

/** Mã máy của một chuỗi kích thước: `M-014` → `M-000014DIMS`. */
export function dimensionEntityIdOf(displayId: string): DimensionId {
  return `M-${displayId.slice(2).padStart(ID_COUNTER_LENGTH, '0')}${DIMENSION_ID_SUFFIX}` as DimensionId;
}

/** Nhãn mono của một hàng — "#M-014". */
export const dimensionCodeLabel = (displayId: string): string => `#${displayId}`;

/** Nhãn mono của tường chủ — "#W-014". */
export const wallCodeLabel = (wallId: string): string => `#${dimensionDisplayCode(wallId)}`;

/* -------------------------------------------------------------------------- */
/* Bộ mẫu — 34 chuỗi kích thước của `dimensionOcrFixture.ts` thành một đồ thị.  */
/* -------------------------------------------------------------------------- */

/**
 * Tầng, toà nhà và tường của bộ mẫu.
 *
 * KHÔNG dựng một lưới tường thứ hai: `dimensionOcrFixture.ts` đã gắn
 * `referenceIds` của mỗi chuỗi vào một `WallId` THẬT của lưới 48 tường mà màn
 * QC anh em dùng, nên dựng lại lưới lần thứ hai chỉ tạo ra một chỗ để hai bộ số
 * lệch nhau.
 */
export const DIMENSION_OCR_SAMPLE_LEVEL: Level = WALL_LAYER_FIXTURE_LEVEL;

const DIMENSION_OCR_SAMPLE_BUILDING: Building = WALL_LAYER_FIXTURE_BUILDING;

/** Ảnh nền của bộ mẫu. Không phải đường dẫn thật, nên không phạm R-65. */
export const DIMENSION_OCR_SAMPLE_IMAGE = 'sample-floor-plan.png';

/** Khổ bản vẽ mẫu — bao trọn lưới 12.500 × 8.800 mm của bộ mẫu, có lề. */
export const DIMENSION_OCR_SAMPLE_DRAWING_WIDTH_MM = 13000;
export const DIMENSION_OCR_SAMPLE_DRAWING_HEIGHT_MM = 9300;

/**
 * Đồ thị bộ mẫu: 48 tường và những chuỗi kích thước được truyền vào.
 *
 * `normalizeSpatial` là hàm DUY NHẤT dựng dạng phẳng (R-61); màn không tự lập
 * chỉ mục.
 */
export function buildDimensionOcrGraph(
  dimensions: readonly Dimension[] = DIMENSION_OCR_FIXTURE_DIMENSIONS,
): NormalizedSpatial {
  return normalizeSpatial({
    building: DIMENSION_OCR_SAMPLE_BUILDING,
    levels: [DIMENSION_OCR_SAMPLE_LEVEL],
    walls: WALL_LAYER_FIXTURE_WALLS,
    openings: [],
    furniture: [],
    rooms: [],
    axes: [],
    dimensions,
    notes: [],
  });
}

/** Đồ thị bộ mẫu dựng sẵn — story, test và cổng giả cùng đọc một bản. */
export const DIMENSION_OCR_SAMPLE_GRAPH: NormalizedSpatial = buildDimensionOcrGraph();

/* -------------------------------------------------------------------------- */
/* Đọc đồ thị.                                                                 */
/* -------------------------------------------------------------------------- */

const NO_DIMENSIONS: readonly Dimension[] = [];

/** Tầng đang duyệt, hoặc tầng đầu tiên khi nơi gọi chưa chỉ định. */
export function levelOfGraph(graph: NormalizedSpatial | null): Level | null {
  return graph === null ? null : (entitiesOfKind(graph, 'level')[0] ?? null);
}

/** Mọi chuỗi kích thước của đồ thị, đúng thứ tự gốc của bộ mẫu. */
export const dimensionsOf = (graph: NormalizedSpatial | null): readonly Dimension[] =>
  graph === null ? NO_DIMENSIONS : entitiesOfKind(graph, 'dimension');

/**
 * Tường chủ suy từ `referenceIds`.
 *
 * `Dimension.referenceIds` là MẢNG (một chuỗi "chain" nối nhiều tường), nên
 * phép lọc dùng `.some()` chứ không so trường trực tiếp như `openingsOfWall`.
 * Đây là truy vấn dữ liệu, không phải công thức hình học — cùng bản chất
 * `openingsOfWall`/`wallsOnLevel` của `shared.ts` đã làm, nên không phạm R-61.
 */
export function hostWallOf(
  graph: NormalizedSpatial | null,
  dimension: Dimension,
): GraphWall | null {
  if (graph === null) {
    return null;
  }

  return (
    entitiesOfKind(graph, 'wall').find((wall) =>
      dimension.referenceIds.some((id) => id === wall.id),
    ) ?? null
  );
}

/* -------------------------------------------------------------------------- */
/* M-15 — đo lại từ hình học. Không tự đo, không tự quy đổi.                    */
/* -------------------------------------------------------------------------- */

/**
 * Chiều dài đo được từ bản vẽ của một chuỗi kích thước.
 *
 * `toPointMm` gắn nhãn đơn vị cho hai đầu đoạn, `measureDistance` của M-15 đo.
 * Không một phép căn bậc hai nào ở màn (R-61).
 */
export const measuredLengthOf = (dimension: Dimension): Millimetres =>
  measureDistance(toPointMm(dimension.line.start), toPointMm(dimension.line.end)).lengthMm;

/** Giá trị đang có hiệu lực: số người gõ đè nếu có, còn không thì số OCR đọc được. */
export const readValueOf = (dimension: Dimension): number =>
  dimension.overrideValueMm ?? dimension.valueMm;

/* -------------------------------------------------------------------------- */
/* M-02 — độ lệch. GỌI LẠI `compareLengthToMeasured`, không tự tính.            */
/* -------------------------------------------------------------------------- */

/**
 * Độ lệch giữa chuỗi đọc được và hình học đo lại.
 *
 * `readValueMm` để nơi gọi truyền được giá trị người duyệt ĐANG GÕ (chưa ghi
 * vào đồ thị) — đó là cách "sửa giá trị thì phép đối chiếu chạy lại NGAY" xảy
 * ra mà không cần một lệnh nào chạy trước. Ngưỡng 2% nằm sẵn trong
 * `compareLengthToMeasured`; ở đây không có tham số ngưỡng và không có phép so
 * sánh ngưỡng nào (R-71).
 */
export function deviationOf(dimension: Dimension, readValueMm?: number): LengthDeviation {
  return compareLengthToMeasured(
    millimetres(readValueMm ?? readValueOf(dimension)),
    measuredLengthOf(dimension),
  );
}

/* -------------------------------------------------------------------------- */
/* QĐ-4 — giá trị vô lý, đo bằng chính TẬP 34 chuỗi.                           */
/* -------------------------------------------------------------------------- */

/**
 * Những chuỗi có giá trị lệch khỏi phần còn lại của bản vẽ.
 *
 * Không có ngưỡng nào viết ở đây: cả tập giá trị (có thay giá trị người duyệt
 * đang gõ vào đúng vị trí của nó) đi qua `splitOutliers` với
 * `SCALE_THRESHOLDS.outlierRejection`, và `rejectedIndices` là câu trả lời.
 * Trả về TẬP MÃ MÁY để nơi gọi tra thẳng, không phải một mảng chỉ số dễ lệch.
 *
 * @param overrides Giá trị đang gõ dở, theo mã máy — chưa nằm trong đồ thị.
 */
export function implausibleDimensionIds(
  dimensions: readonly Dimension[],
  overrides: ReadonlyMap<string, number> = new Map<string, number>(),
): ReadonlySet<string> {
  if (dimensions.length === 0) {
    return new Set<string>();
  }

  const values = dimensions.map((entry) => overrides.get(entry.id) ?? readValueOf(entry));
  const { rejectedIndices } = splitOutliers(values, SCALE_THRESHOLDS.outlierRejection);
  const rejected = new Set<string>();

  for (const index of rejectedIndices) {
    const entry = dimensions[index];

    if (entry !== undefined) {
      rejected.add(entry.id);
    }
  }

  return rejected;
}

/** Một giá trị vừa gõ có bị chính tập chuỗi còn lại loại ra không? */
export function isImplausibleDimensionValue(
  dimensions: readonly Dimension[],
  dimensionId: string,
  valueMm: number,
): boolean {
  return implausibleDimensionIds(dimensions, new Map([[dimensionId, valueMm]])).has(dimensionId);
}

/* -------------------------------------------------------------------------- */
/* P-01 — định dạng. Mọi con số thành chuỗi TRƯỚC khi rời khỏi hook (A15).      */
/* -------------------------------------------------------------------------- */

/**
 * Một số đo, LUÔN ở milimét — "6.000 mm".
 *
 * `{ unit: 'mm' }` ép đơn vị thay vì để `formatLength` tự chọn theo độ lớn: đặc
 * tả nói "đơn vị là mm cố định hiển thị bên phải ô", nên một chuỗi 6.000 mm
 * không được tự đổi thành "6,00 m" khi nó vượt một mét.
 */
export const formatDimensionLength = (valueMm: number): string =>
  formatLength(valueMm, { unit: 'mm' });

/** Một số đếm — "34". Dấu nghìn là dấu chấm, dấu thập phân là dấu phẩy (A15). */
export const formatDimensionCount = (value: number): string =>
  formatNumber(value, { fractionDigits: 0 });

/**
 * Phần trăm lệch đã định dạng — "1,5%".
 *
 * `relativeDeviation` của `compareLengthToMeasured` là dạng `'ratio'`
 * (0,015 = 1,5%), nên `formatPercent` chạy với mặc định, không cần
 * `{ source: 'percent' }`. Xuất ra ngoài để T7 vẽ được từng khung của lượt chạy
 * số 260 ms mà không tự ghép dấu phần trăm (A15).
 */
export const formatDeviation = (relativeDeviation: number): string =>
  formatPercent(relativeDeviation);

/** Câu gợi ý giá trị vô lý của T4, với con số đã định dạng sẵn (A15). */
export const implausibleValueHint = (valueMm: number): string =>
  outlierHint(formatDimensionLength(valueMm));

/** Bộ đếm duyệt thành câu — "18/34 kích thước đã duyệt". */
export const dimensionProgressLabel = (counter: DimensionReviewCounter): string =>
  reviewProgressText(formatDimensionCount(counter.reviewed), formatDimensionCount(counter.total));

/** Câu của trạng thái một phần — "9 mục dưới ngưỡng tin cậy, đã lọc sẵn". */
export const lowConfidenceNotice = (count: number): string =>
  lowConfidencePartialNotice(formatDimensionCount(count));

/* -------------------------------------------------------------------------- */
/* P-06 — độ tin cậy. Ngưỡng lấy từ `confidenceLevel`, không đặt ngưỡng mới.    */
/* -------------------------------------------------------------------------- */

/**
 * Chuỗi này có dưới ngưỡng "cần chú ý" của màn không?
 *
 * KHÔNG có hằng ngưỡng riêng ở màn (R-71): `confidenceLevel` của
 * `src/lib/format/semantic.ts` trả `'needsReview'` đúng khi
 * `confidence < CONFIDENCE_SUGGESTED_THRESHOLD` (0,70) — và đó CHÍNH LÀ ngưỡng
 * mà `dimensionOcrFixture.ts` dùng để đếm ra 9 mục dưới ngưỡng của đặc tả. Hai
 * bên vì thế không thể lệch nhau, khác hẳn ca `OBJECT_LAYER_CONFIDENCE_THRESHOLD`
 * của màn S-13 vốn phải đặt một ngưỡng sản phẩm riêng mới ra đúng số.
 */
export const isLowConfidenceDimension = (confidence: number): boolean =>
  confidenceLevel(confidence) === 'needsReview';

/**
 * Mã trạng thái trung lập của một hàng (A5).
 *
 * `'verified'` CHỈ khi người duyệt đã duyệt. `'attention'` khi dưới ngưỡng mà
 * chưa duyệt. Không bao giờ `'violation'` ở màn này — màn không chạy rule QC.
 */
export function dimensionStatusCode(review: ReviewMetadata): ViewStatusCode {
  if (review.reviewed) {
    return 'verified';
  }

  return isLowConfidenceDimension(review.confidence) ? 'attention' : 'neutral';
}

/* -------------------------------------------------------------------------- */
/* Quy đổi mm → px, ảnh cắt và khung nhìn (R-07).                              */
/* -------------------------------------------------------------------------- */

/** Tỷ lệ dùng khi tầng CHƯA hiệu chỉnh: một milimét là một điểm ảnh. */
const UNCALIBRATED_SCALE: MillimetresPerPixel = millimetresPerPixel(1);

/** Tỷ lệ của tầng, dạng số mà hợp đồng canvas nhận. */
export const millimetresPerPixelOf = (level: Level | null): MillimetresPerPixel =>
  level?.scaleMillimetresPerPixel ?? UNCALIBRATED_SCALE;

/** Bộ quy đổi của một tầng — `scaleFromRatio` là hàm DUY NHẤT làm việc này (R-61). */
export const scaleOfLevel = (level: Level | null): Scale =>
  scaleFromRatio(millimetresPerPixelOf(level));

/** Một điểm milimét của bản vẽ, đọc bằng pixel đúng cách `<svg viewBox>` đọc nó. */
export const toPixelPoint = (point: Point, scale: Scale): DimensionPixelPoint => ({
  x: scale.millimetresToPixels(millimetres(point.x)),
  y: scale.millimetresToPixels(millimetres(point.y)),
});

/** Điểm giữa hai điểm — chỗ nhãn giá trị đứng. */
export const midpointPx = (
  from: DimensionPixelPoint,
  to: DimensionPixelPoint,
): DimensionPixelPoint => ({
  x: (from.x + to.x) / 2,
  y: (from.y + to.y) / 2,
});

/** Khung chữ nhật mà `flyToBounds` của R-07 nhận. */
export interface DimensionContentBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/**
 * Hộp bao của một dãy điểm.
 *
 * Repo chưa có hàm nào làm việc này ở `src/domain` hay `src/lib` — hai màn QC
 * anh em cũng phải tự viết (`objectLayerReviewGateway.ts#boundsOfPoints`). Viết
 * ở tầng cổng chứ không ở view, và là phép hình học DUY NHẤT của file này.
 */
export function boundsOfPoints(
  points: readonly DimensionPixelPoint[],
): DimensionContentBounds | null {
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

/** Hộp bao thành hình chữ nhật mà hợp đồng canvas của T3 nhận. */
export const toPixelRect = (bounds: DimensionContentBounds): DimensionPixelRect => ({
  x: bounds.minX,
  y: bounds.minY,
  width: bounds.maxX - bounds.minX,
  height: bounds.maxY - bounds.minY,
});

/** Hình chữ nhật thành khung mà `flyToBounds` nhận. */
export const toContentBounds = (rect: DimensionPixelRect): DimensionContentBounds => ({
  minX: rect.x,
  minY: rect.y,
  maxX: rect.x + rect.width,
  maxY: rect.y + rect.height,
});

/**
 * Ô nhãn giá trị, tính bằng pixel — cũng chính là khung ảnh cắt 1:1.
 *
 * `boxAround` của `src/lib/input/dragDrop.ts` dựng hộp quanh một tâm; nó không
 * biết đơn vị nào cả, nên dùng được nguyên cho toạ độ pixel. Bề rộng/cao lấy từ
 * hai hằng ĐÃ KHAI ở `dimensionOcrTypes.ts` (R-71), không viết lại 160/96.
 */
function labelBoxPx(centre: DimensionPixelPoint): DimensionContentBounds {
  const box = boxAround(centre, DIMENSION_CROP_DISPLAY_WIDTH_PX, DIMENSION_CROP_DISPLAY_HEIGHT_PX);

  return { minX: box.min.x, minY: box.min.y, maxX: box.max.x, maxY: box.max.y };
}

/**
 * Ảnh cắt 1:1 của vùng gốc đi kèm một số đọc được.
 *
 * CẤM TUYỆT ĐỐI của đặc tả: mỗi số đọc được PHẢI có ảnh cắt gốc nằm cạnh, nên
 * `crop` là trường bắt buộc của {@link DimensionRowViewModel}, không tuỳ chọn.
 * Khung cắt là ô nhãn giá trị trên ẢNH GỐC, và ô hiển thị đúng bằng khung cắt —
 * đó là điều "1:1" nghĩa là.
 */
export function cropOf(
  dimension: Dimension,
  scale: Scale,
  imageUrl: string,
): DimensionCropViewModel {
  const centre = midpointPx(
    toPixelPoint(dimension.line.start, scale),
    toPixelPoint(dimension.line.end, scale),
  );

  return {
    imageUrl,
    sourcePx: toPixelRect(labelBoxPx(centre)),
    displayWidthPx: DIMENSION_CROP_DISPLAY_WIDTH_PX,
    displayHeightPx: DIMENSION_CROP_DISPLAY_HEIGHT_PX,
    alt: dimensionImageAlt(dimensionCodeLabel(dimensionDisplayCode(dimension.id))),
  };
}

/* -------------------------------------------------------------------------- */
/* Dựng view model — mọi con số đã thành chuỗi trước khi rời khỏi đây (A15).    */
/* -------------------------------------------------------------------------- */

/** Một hàng của danh sách 34 chuỗi kích thước. */
export function toDimensionRow(
  dimension: Dimension,
  hostWall: GraphWall | null,
  scale: Scale,
  imageUrl: string,
  draftValueMm?: number,
): DimensionRowViewModel {
  const displayId = dimensionDisplayCode(dimension.id);
  const valueMm = draftValueMm ?? readValueOf(dimension);

  return {
    id: displayId,
    codeLabel: dimensionCodeLabel(displayId),
    valueMm,
    valueLabel: formatDimensionLength(valueMm),
    confidence: dimension.confidence,
    isReviewed: dimension.reviewed,
    isLowConfidence: isLowConfidenceDimension(dimension.confidence),
    statusCode: dimensionStatusCode(dimension),
    hostWallLabel: hostWall === null ? null : wallReferenceLabel(wallCodeLabel(hostWall.id)),
    hostWallId: hostWall === null ? null : hostWall.id,
    crop: cropOf(dimension, scale, imageUrl),
  };
}

/** Thứ canvas vẽ cho MỘT chuỗi kích thước — mọi toạ độ đã tính sẵn (R-60). */
export function toDimensionChain(
  dimension: Dimension,
  scale: Scale,
  isSelected: boolean,
): DimensionChainViewModel {
  const startPx = toPixelPoint(dimension.line.start, scale);
  const endPx = toPixelPoint(dimension.line.end, scale);
  const labelPositionPx = midpointPx(startPx, endPx);
  const label = labelBoxPx(labelPositionPx);
  const bounds = boundsOfPoints([
    startPx,
    endPx,
    { x: label.minX, y: label.minY },
    { x: label.maxX, y: label.maxY },
  ]);

  return {
    id: dimensionDisplayCode(dimension.id),
    startPx,
    endPx,
    labelPositionPx,
    boundsPx: toPixelRect(bounds ?? label),
    isSelected,
    isReviewed: dimension.reviewed,
    valueLabel: formatDimensionLength(readValueOf(dimension)),
  };
}

/**
 * Dải đối chiếu của chuỗi đang chọn.
 *
 * `isSignificant` đọc thẳng `exceedsLimit` của `compareLengthToMeasured` —
 * "độ lệch chỉ tô màu khi thật sự đáng kể" là câu trả lời của domain, không
 * phải một phép so `Math.abs(x) > 0.02` viết trong màn (R-71).
 *
 * `deviationLabel` nhận từ ngoài vì nó là KHUNG HÌNH đang chạy của lượt chạy số
 * 260 ms, chứ không phải giá trị đích: chỉ hook mới biết lượt chạy đang ở đâu.
 */
export function toCompareViewModel(
  dimension: Dimension,
  readValueMm: number,
  deviationLabel: string,
): DimensionCompareViewModel {
  return {
    ocrValueLabel: formatDimensionLength(readValueMm),
    measuredValueLabel: formatDimensionLength(measuredLengthOf(dimension)),
    deviationLabel,
    isSignificant: deviationOf(dimension, readValueMm).exceedsLimit,
  };
}

/** Bộ đếm duyệt, tính từ chính danh sách — không gõ tay 18 hay 34. */
export const reviewCounterOf = (dimensions: readonly Dimension[]): DimensionReviewCounter => ({
  reviewed: dimensions.filter((dimension) => dimension.reviewed).length,
  total: dimensions.length,
});

/** Những chuỗi dưới ngưỡng tin cậy và chưa duyệt — nhánh (a) của trạng thái một phần. */
export const lowConfidenceDimensionsOf = (
  dimensions: readonly Dimension[],
): readonly Dimension[] =>
  dimensions.filter(
    (dimension) => !dimension.reviewed && isLowConfidenceDimension(dimension.confidence),
  );

/* -------------------------------------------------------------------------- */
/* Hai lệnh `dimension.*` — dựng bằng nguyên thuỷ công khai (hợp đồng T1 mục D).*/
/* -------------------------------------------------------------------------- */

/** Loại của lệnh gõ đè giá trị. Viết đúng một chỗ (R-71). */
export const DIMENSION_OVERRIDE_COMMAND_TYPE = 'dimension.override';

/** Loại của lệnh duyệt một chuỗi kích thước. Cùng lý do đặt tên như trên. */
export const DIMENSION_APPROVE_COMMAND_TYPE = 'dimension.approve';

/**
 * Câu mô tả trên nút hoàn tác và nhật ký hoạt động.
 *
 * Lấy nguyên hai hàm chuỗi của `dimensionOcrText.ts` — T4 sở hữu mọi chữ người
 * dùng đọc, và `validateCommands` đòi `description` khác rỗng, nên cổng KHÔNG
 * tự gõ một câu tiếng Việt mới cho hai lệnh này.
 */
export const overrideDescription = (displayId: string): string =>
  dimensionRowInputAriaLabel(dimensionCodeLabel(displayId));

export const approveDescription = (displayId: string): string =>
  approveButtonAriaLabel(dimensionCodeLabel(displayId));

/**
 * Lệnh gõ đè giá trị.
 *
 * Chỉ `overrideValueMm` đổi. `reviewed`, `source` và `confidence` giữ NGUYÊN:
 * một số người gõ đè là dữ liệu, cờ xanh "đã xác minh" là phán quyết — A5 cấm
 * đúng việc trộn hai thứ đó, nên chỉ {@link buildApproveDimensionCommand} mới
 * chạm tới chúng.
 */
export function buildOverrideDimensionCommand(
  before: Dimension,
  valueMm: number,
  actorId: string,
): Command {
  return createCommand({
    type: DIMENSION_OVERRIDE_COMMAND_TYPE,
    actorId,
    description: overrideDescription(dimensionDisplayCode(before.id)),
    changes: [changeForUpdate('dimension', before, { ...before, overrideValueMm: valueMm })],
  });
}

/**
 * Lệnh duyệt — đường DUY NHẤT đặt cờ "đã xác minh" (A5).
 *
 * `source: 'human'` đi kèm `reviewed: true` cứng trong thân hàm. Không tham số
 * nào cho phép nơi gọi truyền `source`, nên đầu ra OCR/AI không có đường nào
 * bật được cờ xanh.
 */
export function buildApproveDimensionCommand(before: Dimension, actorId: string): Command {
  return createCommand({
    type: DIMENSION_APPROVE_COMMAND_TYPE,
    actorId,
    description: approveDescription(dimensionDisplayCode(before.id)),
    changes: [changeForUpdate('dimension', before, { ...before, reviewed: true, source: 'human' })],
  });
}

/* -------------------------------------------------------------------------- */
/* Đường ghi — `dispatch` chạy qua `commit`.                                   */
/* -------------------------------------------------------------------------- */

/** Cửa đọc đồ thị đang sửa. Mặc định là store; test cắm một đồ thị cố định. */
export interface DimensionOcrGraphPort {
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
  graph: DimensionOcrGraphPort,
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
export interface DimensionOcrDispatchDeps {
  readonly deps: DispatchDeps;
  readonly history: HistoryStack;
  /** Nhãn của lượt dispatch đang chạy — `SpatialPort` đọc nó để đặt tên cho `commit`. */
  readonly setLabel: (label: string) => void;
}

export interface CreateDimensionOcrDispatchOptions {
  readonly graph: DimensionOcrGraphPort;
  readonly selectionBefore: () => SelectionSnapshot;
  readonly selectionAfter: () => SelectionSnapshot;
  /** Bước `sync` — đánh dấu bản vẽ bẩn cho tự lưu (S-11). */
  readonly onSynced: () => void;
  readonly history?: HistoryStack;
}

/** Dựng `DispatchDeps` đầy đủ năm cổng. */
export function createDimensionOcrDispatchDeps(
  options: CreateDimensionOcrDispatchOptions,
): DimensionOcrDispatchDeps {
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

/** Chạy MỘT lệnh qua đủ năm bước. */
export async function runDimensionCommand(
  command: Command,
  bundle: DimensionOcrDispatchDeps,
): Promise<DispatchResult> {
  bundle.setLabel(command.description);

  return dispatch(command, bundle.deps);
}

/**
 * Chạy một khối lệnh như MỘT bước lịch sử — `runTransaction` của S-05.
 *
 * Lượt "gõ số rồi Enter" phát hai lệnh (`dimension.override` rồi
 * `dimension.approve`) và cả khối phải hoàn tác được bằng đúng một lần `Ctrl+Z`:
 * người duyệt đã yêu cầu chúng đi cùng nhau, nên chúng là một bước, không hai.
 */
export async function runDimensionTransaction(
  commands: readonly Command[],
  bundle: DimensionOcrDispatchDeps,
  label: string,
): Promise<DispatchResult> {
  bundle.setLabel(label);

  return runTransaction(commands, bundle.deps, { label });
}

/** Vùng chọn rỗng, cho lượt ghi không có gì được chọn trước đó. */
export const DIMENSION_OCR_NO_SELECTION: SelectionSnapshot = NO_SELECTION;

/* -------------------------------------------------------------------------- */
/* A8 — vé hoàn tác 8000 ms.                                                   */
/* -------------------------------------------------------------------------- */

export interface CreateDimensionUndoTicketOptions {
  readonly description: string;
  readonly undo: () => void;
  readonly now: () => number;
}

/**
 * Vé hoàn tác của một lượt sửa.
 *
 * `UNDO_WINDOW_MS` (8000 ms, A8) tới từ `src/lib/mutations/undoTicket.ts` — con
 * số không được viết lại ở màn (R-71), và `createUndoTicket` dùng nó làm mặc
 * định nên ở đây thậm chí không có tham số nào mang nó.
 */
export function createDimensionUndoTicket(options: CreateDimensionUndoTicketOptions): UndoTicket {
  return createUndoTicket({
    description: options.description,
    now: options.now,
    undo: options.undo,
  });
}

/** Cửa sổ hoàn tác, xuất lại để hook và bài kiểm đọc đúng một nguồn. */
export { UNDO_WINDOW_MS };

/* -------------------------------------------------------------------------- */
/* Cái seam — cổng dữ liệu.                                                    */
/* -------------------------------------------------------------------------- */

/** Ảnh nền của lớp kích thước — bản vẽ gốc đã tải lên, đọc qua `spatial.readFloor`. */
export interface DimensionOcrBackground {
  readonly imageUrl: string | null;
  readonly imageAlt: string;
  readonly widthMm: number | null;
  readonly heightMm: number | null;
}

/**
 * Mô tả ảnh nền cho trình đọc màn hình (R-72).
 *
 * Lấy nguyên nhãn aria của canvas mà T4 đã viết — cổng không tự gõ câu mới.
 */
export const backgroundImageAlt = (): string => DIMENSION_OCR_TEXT.screen.canvasAriaLabel;

/**
 * Tiến độ OCR của tầng.
 *
 * Đọc RIÊNG khỏi lớp kích thước, cùng lý do màn S-13 tách nhánh nội thất: "OCR
 * mới xong một phần bản vẽ" phải giữ màn ở `partial` chứ không được xoá sạch
 * những chuỗi đã đọc được khỏi màn hình.
 */
export interface DimensionOcrProgress {
  readonly isComplete: boolean;
}

export interface ReadDimensionLayerInput {
  readonly projectId: string;
  readonly floorId: string;
  readonly signal?: AbortSignal;
}

export interface PersistDimensionLayerInput {
  readonly projectId: string;
  readonly floorId: string;
  readonly graph: NormalizedSpatial;
}

/** Mỗi phương thức là một việc màn cần từ bên ngoài, và không có việc nào khác. */
export interface DimensionOcrReviewGateway {
  readonly supports: Readonly<Record<DimensionOcrCapability, boolean>>;
  /** Ảnh nền của tầng. Lỗi ở ĐÂY chỉ làm mất ảnh nền, không phải hỏng lớp kích thước. */
  readonly readBackground: (input: ReadDimensionLayerInput) => Promise<DimensionOcrBackground>;
  /** Lớp kích thước của tầng. Lỗi ở đây là trạng thái `error` — ảnh gốc VẪN xem được. */
  readonly readDimensionLayer: (
    input: ReadDimensionLayerInput,
  ) => Promise<NormalizedSpatial | null>;
  /** Tiến độ OCR, đọc riêng — xem {@link DimensionOcrProgress}. */
  readonly readOcrProgress: (input: ReadDimensionLayerInput) => Promise<DimensionOcrProgress>;
  /** Đồ thị đang sửa — nơi `commit` vừa ghi vào. */
  readonly graph: DimensionOcrGraphPort;
  /** NOT FOUND — `persistDimensionLayer`. Tự lưu nói ra sự thật này, không bịa một lượt lưu. */
  readonly persistDimensionLayer: (
    input: PersistDimensionLayerInput,
  ) => Promise<DimensionOcrCapabilityResult<void>>;
  /** Ai đang thao tác — đi vào `Command.actorId` và nhật ký hoạt động. */
  readonly actorId: string;
  /** Mốc giờ hiện tại. Tiêm được để test không phụ thuộc đồng hồ thật. */
  readonly now: () => number;
}

export interface CreateDimensionOcrReviewGatewayOptions {
  readonly apiClient?: ApiClient;
  readonly graph?: DimensionOcrGraphPort;
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
export const DIMENSION_OCR_DEFAULT_ACTOR_ID = 'dimension-ocr-reviewer';

/** Cổng thật — thứ container lớp 3 gọi. */
export function createDimensionOcrReviewGateway(
  options: CreateDimensionOcrReviewGatewayOptions = {},
): DimensionOcrReviewGateway {
  const apiClient = options.apiClient ?? mockApiClient;
  const graph: DimensionOcrGraphPort = options.graph ?? {
    read: () => useStore.getState().spatial,
  };

  return {
    supports: {
      readBackground: true,
      readDimensionLayer: true,
      readOcrProgress: true,
      writeDimensionLayer: true,
      persistDimensionLayer: false,
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
        imageAlt: backgroundImageAlt(),
        widthMm: drawing?.widthMm ?? null,
        heightMm: drawing?.heightMm ?? null,
      };
    },

    readDimensionLayer: () => Promise.resolve(graph.read()),
    readOcrProgress: () => Promise.resolve({ isComplete: true }),

    graph,

    persistDimensionLayer: () => Promise.resolve(unsupported('persistDimensionLayer')),

    actorId: options.actorId ?? DIMENSION_OCR_DEFAULT_ACTOR_ID,
    now: options.now ?? ((): number => Date.now()),
  };
}

/* -------------------------------------------------------------------------- */
/* Bộ mẫu — chỗ story và test cắm vào (R-73).                                  */
/* -------------------------------------------------------------------------- */

/** Cách bài kiểm ép một cảnh cụ thể, không sửa mã. */
export interface DimensionOcrGatewaySeed {
  /** Đồ thị cổng trả về. Vắng mặt thì cổng đọc đồ thị bộ mẫu 34 chuỗi. */
  readonly graph?: NormalizedSpatial | null;
  /** `true` thì `readBackground` ném — ảnh nền mất, lớp kích thước thì không. */
  readonly failReadBackground?: boolean;
  /** `true` thì `readDimensionLayer` ném — đúng cảnh `error` của bảy kịch bản. */
  readonly failReadDimensionLayer?: boolean;
  /** `true` thì OCR mới xong một phần bản vẽ — màn giữ ở `partial`. */
  readonly partialOcr?: boolean;
  /** `true` thì ảnh nền chưa có — canvas vẽ khung xám chờ. */
  readonly withoutImage?: boolean;
  /** `true` thì `persistDimensionLayer` chạy thật (bộ mẫu có đường lưu). */
  readonly canPersist?: boolean;
  readonly actorId?: string;
  readonly now?: () => number;
}

/** Cổng có dữ liệu — dùng chung giữa test và story, không bịa bảng dữ liệu thứ hai (R-70). */
export function createMockDimensionOcrReviewGateway(
  seed: DimensionOcrGatewaySeed = {},
): DimensionOcrReviewGateway {
  const canPersist = seed.canPersist ?? true;
  const readGraph = (): NormalizedSpatial | null =>
    seed.graph === undefined ? DIMENSION_OCR_SAMPLE_GRAPH : seed.graph;

  return {
    supports: {
      readBackground: true,
      readDimensionLayer: true,
      readOcrProgress: true,
      writeDimensionLayer: true,
      persistDimensionLayer: canPersist,
    },

    readBackground: () => {
      if (seed.failReadBackground === true) {
        return Promise.reject(new Error(DIMENSION_OCR_TEXT.states.error.description));
      }

      const hasImage = seed.withoutImage !== true;

      return Promise.resolve({
        imageUrl: hasImage ? DIMENSION_OCR_SAMPLE_IMAGE : null,
        imageAlt: backgroundImageAlt(),
        widthMm: hasImage ? DIMENSION_OCR_SAMPLE_DRAWING_WIDTH_MM : null,
        heightMm: hasImage ? DIMENSION_OCR_SAMPLE_DRAWING_HEIGHT_MM : null,
      });
    },

    readDimensionLayer: () => {
      if (seed.failReadDimensionLayer === true) {
        return Promise.reject(new Error(DIMENSION_OCR_TEXT.states.error.description));
      }

      return Promise.resolve(readGraph());
    },

    readOcrProgress: () => Promise.resolve({ isComplete: seed.partialOcr !== true }),

    graph: { read: readGraph },

    persistDimensionLayer: () =>
      Promise.resolve(
        canPersist ? { supported: true, value: undefined } : unsupported('persistDimensionLayer'),
      ),

    actorId: seed.actorId ?? DIMENSION_OCR_DEFAULT_ACTOR_ID,
    now: seed.now ?? ((): number => Date.now()),
  };
}

/* -------------------------------------------------------------------------- */
/* D-04 — một lượt ghi lạc quan, xếp hàng theo từng chuỗi kích thước.           */
/* -------------------------------------------------------------------------- */

/** Biến của một lượt ghi lạc quan trên đúng một chuỗi kích thước. */
export interface DimensionWriteVariables {
  /** Mã hiển thị — cũng là khoá `runExclusive` xếp hàng theo, một chuỗi một hàng. */
  readonly dimensionId: string;
  readonly projectId: string;
  readonly floorId: string;
}

export interface CreateDimensionOcrMutationOptions {
  readonly gateway: DimensionOcrReviewGateway;
  /** Áp lệnh ngay, trước khi máy chủ trả lời. */
  readonly applyOptimistic: (variables: DimensionWriteVariables) => void;
  /** Gỡ lượt áp lạc quan khi máy chủ từ chối — chạy trên ngăn xếp hoàn tác của S-06. */
  readonly rollback: (variables: DimensionWriteVariables) => void;
  /** Khoá cần dọn sau một lượt ghi thành công. */
  readonly affectedKeys: (variables: DimensionWriteVariables) => readonly QueryKey[];
  readonly afterSuccess: (variables: DimensionWriteVariables) => void;
}

/**
 * Cấu hình `useMutation` của một lượt ghi lạc quan (D-04).
 *
 * `callServer` KHÔNG ném khi `persistDimensionLayer` trả `supported: false`: đó
 * là một câu trả lời thật ("chưa có endpoint"), không phải một lượt ghi hỏng,
 * và biến nó thành lỗi sẽ khiến MỌI lượt sửa bị `rollback` gỡ ra ngay trước mắt
 * người duyệt.
 */
export function createDimensionOcrMutation(
  queryClient: QueryClient,
  options: CreateDimensionOcrMutationOptions,
): UseMutationOptions<DimensionOcrCapabilityResult<void>, AppError, DimensionWriteVariables> {
  return createOptimisticMutation<DimensionWriteVariables, DimensionOcrCapabilityResult<void>>(
    queryClient,
    {
      affectedKeys: options.affectedKeys,
      afterSuccess: (_result, variables) => {
        options.afterSuccess(variables);
      },
      applyOptimistic: options.applyOptimistic,
      callServer: (variables) =>
        options.gateway.persistDimensionLayer({
          floorId: variables.floorId,
          projectId: variables.projectId,
          graph: options.gateway.graph.read() ?? DIMENSION_OCR_SAMPLE_GRAPH,
        }),
      entityId: (variables) => variables.dimensionId,
      rollback: options.rollback,
    },
  );
}
