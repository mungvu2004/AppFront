/**
 * Cổng dữ liệu của màn Hiệu chỉnh tỷ lệ — mọi lời gọi ra khỏi màn đi qua đây.
 *
 * Cùng khuôn `processingGateway.ts`: một `interface` cho hình dạng, một factory
 * nhận `ApiClient` để test cắm `createMockApiClient()` vào đúng phép ánh xạ bản
 * sản phẩm dùng (R-70), và một factory thứ hai dựng client thật cho container.
 *
 * ## Phần NỐI ĐƯỢC THẬT
 *
 * Đúng một lượt đọc có endpoint hôm nay: `ENDPOINTS.quality.assess`, qua
 * `client.quality.assess`. Nó trả về đủ ba thứ màn cần để mở được:
 *
 * - `sourceUrl` — ảnh bản vẽ đã nắn, thứ canvas vẽ;
 * - `measurement.widthPx` / `.heightPx` — độ phân giải thật của ảnh, thứ duy
 *   nhất cho phép quy một toạ độ tỉ lệ `0..1` của khung ảnh về pixel ảnh;
 * - `frame.isFound` — máy có tìm được khung bản vẽ hay không. `false` chính là
 *   "nắn ảnh thất bại, bản vẽ có thể méo", tức trạng thái `'error'` của A11 trên
 *   màn này. Nó KHÔNG chặn hiệu chỉnh, chỉ nói ra hậu quả.
 *
 * Tên tầng đọc từ cùng lượt đó (`floorName`), nên màn không cần lượt gọi thứ hai.
 *
 * ## Phần KHÔNG CÓ — và vì sao vẫn khai
 *
 * Năm việc màn cần mà tầng dữ liệu chưa có. Mỗi việc vẫn nằm trong
 * {@link ScaleCalibrationGateway} với một kết quả `supported: false` nói rõ
 * endpoint nào còn thiếu, thay vì bị bỏ trắng: một cổng im lặng thì màn không
 * phân biệt được "chưa có dữ liệu" với "không có đường lấy dữ liệu", và người
 * đọc mã sau này không biết chỗ nào cần nối khi endpoint xuất hiện.
 *
 * Hệ quả nói thẳng: trong bản sản phẩm hôm nay, không lượt OCR nào về, nên màn
 * đứng ở trạng thái `'empty'` — đúng nghĩa "OCR không đọc được chuỗi kích thước
 * nào" mà bảng bảy trạng thái của `types.ts` đã khai. Test và story cắm cổng giả
 * để dựng đủ bảy trạng thái. Đây là quyết định của điều phối viên (R-69), không
 * phải chỗ tự thêm endpoint.
 *
 * ## Ghi tỷ lệ — không có máy chủ, và đó là quyết định
 *
 * `FloorWriteBody` không có trường tỷ lệ nào, và không endpoint nào nhận nó.
 * Nguồn sự thật của tỷ lệ là store (`Level.scaleMillimetresPerPixel`, ghi qua
 * `commit()`); {@link ScaleCalibrationGateway.persistScale} chỉ giữ lượt ghi
 * trong phiên, đúng khuôn "bảy trường chưa có dây" của
 * `projectSettingsGateway.ts`. Nó trả `ok` thật vì nó thật sự đã giữ giá trị —
 * cho tới khi tải lại trang. Không có gì được hứa hơn thế.
 */

import type { ApiClient, ApiResult } from '@/api/client';
import { toAppError } from '@/lib/errors';
import { createAppApiClient } from '@/api/appClient';
import { createMockApiClient } from '@/api/__mocks__/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { FloorImageQuality } from '@/api/schemas/quality';
import { pixels, type MillimetresPerPixel, type Pixels } from '@/domain/units/scale';
import { millimetres, type Millimetres } from '@/domain/units/types';

import type { ImageRatioBox } from './types';

/* -------------------------------------------------------------------------- */
/* Việc làm được và việc chưa có đường.                                         */
/* -------------------------------------------------------------------------- */

/** Mã máy đọc của một phát hiện "không tìm thấy khung bản vẽ". */
export const FRAME_NOT_FOUND_CODE = 'FRAME_NOT_FOUND';

/** Năm việc màn cần mà tầng dữ liệu chưa có đường nào để làm. */
export const SCALE_MISSING_CAPABILITIES = [
  'dimensionStrings',
  'referenceWallWidth',
  'typicalDoorWidth',
  'largestRoomBox',
  'snapTargets',
] as const;

export type ScaleMissingCapability = (typeof SCALE_MISSING_CAPABILITIES)[number];

/**
 * Endpoint còn thiếu của từng việc, viết ra để lần sau ai nối thì biết nối vào
 * đâu. Chuỗi ở đây là mô tả đường dẫn còn thiếu, không phải đường dẫn có thật.
 */
export const SCALE_MISSING_ENDPOINTS: Readonly<Record<ScaleMissingCapability, string>> = {
  dimensionStrings: 'GET .../floors/:floorId/dimension-strings',
  referenceWallWidth: 'GET .../floors/:floorId/detected-geometry (bề rộng nét tường)',
  typicalDoorWidth: 'GET .../floors/:floorId/detected-geometry (bề rộng cửa đi)',
  largestRoomBox: 'GET .../floors/:floorId/detected-geometry (hộp bao phòng lớn nhất)',
  snapTargets: 'GET .../floors/:floorId/detected-geometry (đỉnh tường, giao điểm)',
};

/** Một việc chưa có đường làm, kèm endpoint còn thiếu. */
export interface ScaleUnsupported {
  readonly supported: false;
  readonly capability: ScaleMissingCapability;
  readonly missingEndpoint: string;
}

/** Một việc làm được, kèm kết quả. */
export interface ScaleSupported<TValue> {
  readonly supported: true;
  readonly value: TValue;
}

export type ScaleCapabilityResult<TValue> = ScaleSupported<TValue> | ScaleUnsupported;

/** Dựng câu trả lời "chưa có đường làm việc này". */
export function unsupported(capability: ScaleMissingCapability): ScaleUnsupported {
  return { supported: false, capability, missingEndpoint: SCALE_MISSING_ENDPOINTS[capability] };
}

/* -------------------------------------------------------------------------- */
/* Hình dạng dữ liệu thô.                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Bản vẽ đã nắn của một tầng, ở dạng thô.
 *
 * `widthPx`/`heightPx` là `null` khi tầng chưa được đo (`isMeasured === false`):
 * chưa biết độ phân giải thì không quy được toạ độ tỉ lệ về pixel, và màn phải
 * nói ra điều đó chứ không đoán một con số.
 */
export interface ScaleDrawingSnapshot {
  readonly floorId: string;
  readonly floorName: string;
  readonly imageUrl: string | null;
  readonly widthPx: Pixels | null;
  readonly heightPx: Pixels | null;
  /** `true` khi máy không tìm được khung bản vẽ — bản vẽ có thể méo. */
  readonly isWarped: boolean;
}

/** Một chuỗi kích thước OCR đọc được, ở dạng thô. */
export interface ScaleRawDimensionString {
  readonly id: string;
  readonly pixelLength: Pixels;
  readonly realLength: Millimetres;
  /** Độ tin cậy của lần đọc, `0..1`. */
  readonly confidence: number;
  readonly boundingBox: ImageRatioBox;
}

/** Hộp bao của phòng lớn nhất, đo trên ảnh bằng pixel. */
export interface ScaleRoomBoxPx {
  readonly widthPx: Pixels;
  readonly heightPx: Pixels;
}

export interface ReadFloorDrawingInput {
  readonly projectId: string;
  readonly floorId: string;
  readonly signal?: AbortSignal;
}

export interface ReadFloorGeometryInput {
  readonly projectId: string;
  readonly floorId: string;
}

export interface PersistScaleInput {
  readonly projectId: string;
  readonly floorId: string;
  readonly millimetresPerPixel: MillimetresPerPixel;
  /** `true` khi người dùng chọn áp cho mọi tầng. */
  readonly appliesToEveryFloor: boolean;
}

/* -------------------------------------------------------------------------- */
/* Cổng.                                                                        */
/* -------------------------------------------------------------------------- */

export interface ScaleCalibrationGateway {
  /** Việc nào có đường làm hôm nay. Màn đọc cờ này chứ không đoán. */
  readonly supports: Readonly<Record<ScaleMissingCapability, boolean>>;
  readonly readFloorDrawing: (
    input: ReadFloorDrawingInput,
  ) => Promise<ApiResult<ScaleDrawingSnapshot>>;
  readonly readDimensionStrings: (
    input: ReadFloorGeometryInput,
  ) => Promise<ScaleCapabilityResult<readonly ScaleRawDimensionString[]>>;
  /**
   * Bề rộng của một nét tường điển hình trên ảnh, tính bằng pixel.
   *
   * Đây là số đo cần để `inferWallThicknessFromScale` nói được "tỷ lệ này cho
   * ra bức tường dày ba mét". Nó là một PHÉP ĐO, không phải hằng số suy ra từ
   * độ phân giải: màn không được tự dựng nó (R-69).
   */
  readonly readReferenceWallWidth: (
    input: ReadFloorGeometryInput,
  ) => Promise<ScaleCapabilityResult<Pixels>>;
  /** Bề rộng một ô cửa đi điển hình trên ảnh, tính bằng pixel. */
  readonly readTypicalDoorWidth: (
    input: ReadFloorGeometryInput,
  ) => Promise<ScaleCapabilityResult<Pixels>>;
  /** Hộp bao của phòng lớn nhất trên ảnh, tính bằng pixel. */
  readonly readLargestRoomBox: (
    input: ReadFloorGeometryInput,
  ) => Promise<ScaleCapabilityResult<ScaleRoomBoxPx>>;
  /** Điểm bắt được trên bản vẽ: đỉnh tường, giao điểm, trung điểm, cạnh tường. */
  readonly readSnapTargets: (
    input: ReadFloorGeometryInput,
  ) => Promise<ScaleCapabilityResult<readonly ScaleRawSnapTarget[]>>;
  /** Giữ tỷ lệ vừa áp. Xem ghi chú "Ghi tỷ lệ" ở đầu file. */
  readonly persistScale: (input: PersistScaleInput) => Promise<ApiResult<void>>;
  readonly now: () => number;
}

/**
 * Một điểm bắt thô, toạ độ theo pixel ảnh.
 *
 * Cổng không trả `SnapTarget` của `src/domain/units/snap` sẵn: `SnapTarget` mang
 * toạ độ `PointMm`, mà mm chỉ có nghĩa sau khi đã biết tỷ lệ — thứ màn này đang
 * đi tìm. Hook quy đổi khi nó có một tỷ lệ để quy đổi bằng.
 */
export interface ScaleRawSnapTarget {
  readonly id: string;
  readonly kind: 'wallVertex' | 'intersection' | 'midpoint';
  readonly xPx: Pixels;
  readonly yPx: Pixels;
}

/* -------------------------------------------------------------------------- */
/* Chuyển đổi.                                                                  */
/* -------------------------------------------------------------------------- */

/** Một tầng trong lượt đọc chất lượng, chuyển sang hình dạng màn dùng. */
function toDrawingSnapshot(floor: FloorImageQuality): ScaleDrawingSnapshot {
  const measurement = floor.measurement;
  const frameMissing = floor.frame !== undefined && !floor.frame.isFound;
  const findingSaysFrameMissing = floor.findings.some(
    (finding) => finding.code === FRAME_NOT_FOUND_CODE,
  );

  return {
    floorId: floor.floorId,
    floorName: floor.floorName,
    imageUrl: floor.sourceUrl,
    widthPx: measurement === undefined ? null : pixels(measurement.widthPx),
    heightPx: measurement === undefined ? null : pixels(measurement.heightPx),
    isWarped: frameMissing || findingSaysFrameMissing,
  };
}

/* -------------------------------------------------------------------------- */
/* Lượt ghi giữ trong phiên.                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Tỷ lệ đã ghi, khoá theo `projectId::floorId`.
 *
 * Cùng khuôn `unwiredByProject` của `projectSettingsGateway.ts`: một bản đồ ở
 * mức module, sống đúng bằng phiên trình duyệt. Không endpoint thì đây là thứ
 * trung thực nhất một lượt "đã lưu" có thể là.
 */
const persistedScales = new Map<string, MillimetresPerPixel>();

const persistKey = (projectId: string, floorId: string): string => `${projectId}::${floorId}`;

/** Tỷ lệ đã ghi trong phiên cho một tầng, nếu có. Dùng bởi test và story. */
export function readPersistedScale(
  projectId: string,
  floorId: string,
): MillimetresPerPixel | undefined {
  return persistedScales.get(persistKey(projectId, floorId));
}

/** Xoá mọi lượt ghi trong phiên. Test gọi giữa hai lượt kiểm. */
export function clearPersistedScales(): void {
  persistedScales.clear();
}

/* -------------------------------------------------------------------------- */
/* Factory.                                                                     */
/* -------------------------------------------------------------------------- */

export interface CreateScaleCalibrationGatewayOptions {
  /** Đồng hồ tiêm được. */
  readonly now?: () => number;
}

export function createScaleCalibrationGateway(
  client: ApiClient,
  options: CreateScaleCalibrationGatewayOptions = {},
): ScaleCalibrationGateway {
  const now = options.now ?? ((): number => Date.now());

  return {
    // Một việc làm được hôm nay: đọc bản vẽ đã nắn. Năm việc còn lại `false`
    // cho tới khi có endpoint — xem `SCALE_MISSING_ENDPOINTS`.
    supports: {
      dimensionStrings: false,
      referenceWallWidth: false,
      typicalDoorWidth: false,
      largestRoomBox: false,
      snapTargets: false,
    },

    readFloorDrawing: async ({ floorId, projectId, signal }) => {
      const result = await client.quality.assess({
        floorId,
        projectId,
        ...(signal !== undefined ? { signal } : {}),
      });

      if (!result.ok) {
        return result;
      }

      const floor = result.data.floors.find((entry) => entry.floorId === floorId);

      if (floor === undefined) {
        // Lượt đọc trả về mọi tầng của dự án, nên không thấy tầng đang mở nghĩa
        // là đường dẫn trỏ vào một tầng không thuộc dự án này. Nói ra bằng lỗi
        // hợp đồng chứ không dựng một bản ghi rỗng giả vờ là dữ liệu. `toAppError`
        // dựng lỗi để mã và câu chữ đi qua đúng bảng của `src/lib/errors`.
        return {
          ok: false,
          error: toAppError(
            new Error(
              `${ENDPOINTS.quality.assess(projectId, floorId)} không trả về tầng ${floorId}.`,
            ),
          ),
        };
      }

      return { ok: true, data: toDrawingSnapshot(floor) };
    },

    readDimensionStrings: async () => unsupported('dimensionStrings'),
    readReferenceWallWidth: async () => unsupported('referenceWallWidth'),
    readTypicalDoorWidth: async () => unsupported('typicalDoorWidth'),
    readLargestRoomBox: async () => unsupported('largestRoomBox'),
    readSnapTargets: async () => unsupported('snapTargets'),

    persistScale: async ({ floorId, millimetresPerPixel: ratio, projectId }) => {
      persistedScales.set(persistKey(projectId, floorId), ratio);
      return { ok: true, data: undefined };
    },

    now,
  };
}

/** Cổng thật cho container. */
export function createAppScaleCalibrationGateway(): ScaleCalibrationGateway {
  return createScaleCalibrationGateway(createAppApiClient());
}

/**
 * Cổng chạy trên bộ mẫu — story và test dùng, không chạm mạng.
 *
 * Bốn tầng của `createMockApiClient()` là dữ liệu thật của bộ mẫu, nên story
 * không phải bịa một tầng tại chỗ (R-70).
 */
export function createMockScaleCalibrationGateway(
  options: CreateScaleCalibrationGatewayOptions = {},
): ScaleCalibrationGateway {
  return createScaleCalibrationGateway(createMockApiClient(), options);
}

/**
 * Bọc một cổng, thay đúng những việc người gọi đưa vào.
 *
 * Test dựng nhánh "có chuỗi kích thước" hay "đo được bề rộng nét tường" bằng
 * hàm này thay vì viết lại cả cổng — cùng lý lẽ `makeScriptedClient` của
 * `useProcessingScreen.test.ts`: chỉ thứ đang kiểm mới bị thay.
 */
export function withScaleCapabilities(
  base: ScaleCalibrationGateway,
  overrides: Partial<Omit<ScaleCalibrationGateway, 'supports'>> & {
    readonly supports?: Partial<Record<ScaleMissingCapability, boolean>>;
  },
): ScaleCalibrationGateway {
  const { supports, ...rest } = overrides;

  return {
    ...base,
    ...rest,
    supports: { ...base.supports, ...supports },
  };
}

/** Đại lượng độ dài đã gắn nhãn, cho story và test dựng dữ liệu thô. */
export const scaleMillimetres = millimetres;
