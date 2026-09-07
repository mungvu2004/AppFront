/**
 * Cổng dữ liệu của màn Đối chiếu bản vẽ — mọi lời gọi ra khỏi màn đi qua đây.
 *
 * Cùng khuôn `scaleCalibrationGateway.ts`: một `interface` cho hình dạng, một
 * factory nhận `ApiClient` để test cắm `createMockApiClient()` vào đúng phép ánh
 * xạ bản sản phẩm dùng (R-70), và một factory thứ hai dựng client thật cho
 * container.
 *
 * ## Phần NỐI ĐƯỢC THẬT
 *
 * Đúng một lượt đọc có endpoint hôm nay: `ENDPOINTS.quality.assess`, qua
 * `client.quality.assess`. Nó trả về đủ ba thứ màn cần để mở được:
 *
 * - `sourceUrl` — ảnh bản vẽ ĐÃ NẮN, thứ lớp `scan` của canvas vẽ;
 * - `measurement.widthPx` / `.heightPx` — độ phân giải thật của ảnh, thứ duy
 *   nhất cho phép quy một toạ độ tỉ lệ `0..1` của khung đối chiếu về pixel ảnh;
 * - `frame.isFound` — máy có tìm được khung bản vẽ hay không. `false` nghĩa là
 *   không căn được, tức trạng thái `'error'` của A11 trên màn này.
 *
 * Tên tầng đọc từ cùng lượt đó (`floorName`), nên màn không cần lượt gọi thứ hai.
 *
 * Danh sách tầng thì KHÔNG đi qua cổng này: nguồn sự thật của nó là store
 * (`ProjectSlice.floors`, mỗi `Level` mang `scaleMillimetresPerPixel` của riêng
 * nó — M-02 đặt tỷ lệ theo TỪNG TẦNG), và hook đọc thẳng từ đó. Một lượt đọc
 * `/floors` ở đây sẽ dựng ý niệm thứ hai về cùng một danh sách.
 *
 * ## Bốn việc KHÔNG CÓ — và vì sao vẫn khai
 *
 * `types.ts` đã kiểm và chốt: phép biến hình ảnh→mô hình, danh sách vùng lệch,
 * và phép tổng hợp trung bình/lớn nhất/đếm vượt ngưỡng đều **không tồn tại**
 * trong `src/domain` hôm nay. Ba mảnh đó đang được viết ở `src/domain/overlay`
 * song song với màn.
 *
 * Mỗi việc vẫn nằm trong {@link OverlayComparisonGateway} với một kết quả
 * `supported: false` nói rõ thứ nào còn thiếu, thay vì bị bỏ trắng: một cổng im
 * lặng thì màn không phân biệt được "chưa có dữ liệu" với "không có đường lấy dữ
 * liệu", và người đọc mã sau này không biết chỗ nào cần nối khi module xuất hiện.
 *
 * Hệ quả nói thẳng: trong bản sản phẩm hôm nay không phép đo nào về, nên ba con
 * số ở đầu panel là `'—'` và danh sách vùng lệch rỗng — đúng nghĩa "chưa đo
 * được" mà `MatchMetricsViewModel` đã khai. Test và story cắm cổng giả để dựng
 * đủ bảy trạng thái. Đây là quyết định của điều phối viên (R-69), không phải chỗ
 * tự chế một phép đo.
 *
 * ## Đánh giá theo dung sai là hàm ĐỒNG BỘ, và đó là quyết định
 *
 * Đổi dung sai phải đánh giá lại **trực tiếp**: danh sách sắp lại và số đếm chạy
 * số ngay. Một lượt gọi bất đồng bộ theo mỗi giá trị dung sai sẽ nháy một trạng
 * thái "đang tải" giữa hai lần kéo thanh — nên {@link OverlayComparisonGateway.evaluateTolerance}
 * là hàm thuần, đồng bộ. Nó cũng là chỗ DUY NHẤT biết phép "vượt ngưỡng" là ngặt
 * (`> dung sai`, không phải `>=`): trả về cả con số đếm lẫn tập mã vùng vượt,
 * nên hook không thể nói "ba vùng vượt" mà lại tô đỏ bốn hàng.
 *
 * ## Xác nhận khớp — không có máy chủ, và đó là quyết định
 *
 * Không endpoint nào nhận một lượt "trưởng nhóm đã xác nhận tầng này khớp bản
 * vẽ" — đã kiểm cả `endpoints.ts` lẫn `client.ts`.
 * {@link OverlayComparisonGateway.confirmFloorMatch} chỉ giữ lượt ghi TRONG
 * PHIÊN, đúng khuôn `persistScale` của `scaleCalibrationGateway`. Nó trả `ok`
 * thật vì nó thật sự đã giữ giá trị — cho tới khi tải lại trang. Không có gì
 * được hứa hơn thế, và `supports.confirmFloorMatch` vẫn là `false` để màn nói ra
 * điều đó.
 */

import type { ApiClient, ApiResult } from '@/api/client';
import { createAppApiClient } from '@/api/appClient';
import { createMockApiClient } from '@/api/__mocks__/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { FloorImageQuality } from '@/api/schemas/quality';
import { pixels, type Pixels } from '@/domain/units/scale';
import { toAppError } from '@/lib/errors';

import type {
  OverlayMissingCapability,
  OverlayUnsupported,
  RatioBox,
  RatioPoint,
} from './types';

/* -------------------------------------------------------------------------- */
/* Việc làm được và việc chưa có đường.                                        */
/* -------------------------------------------------------------------------- */

/** Mã máy đọc của một phát hiện "không tìm thấy khung bản vẽ". */
export const FRAME_NOT_FOUND_CODE = 'FRAME_NOT_FOUND';

/**
 * Module hoặc endpoint còn thiếu của từng việc, viết ra để lần sau ai nối thì
 * biết nối vào đâu. Chuỗi ở đây là mô tả thứ còn thiếu, không phải đường dẫn có
 * thật — nên nó không vi phạm R-65.
 */
export const OVERLAY_MISSING_SOURCES: Readonly<Record<OverlayMissingCapability, string>> = {
  imageToModelTransform: 'src/domain/overlay — đặt ảnh quét vào không gian mô hình',
  deviationRegions: 'src/domain/overlay — vùng lệch kèm vị trí tham chiếu và mã đối tượng',
  matchMetrics: 'src/domain/overlay — trung bình, lớn nhất, đếm vượt ngưỡng theo milimét',
  confirmFloorMatch: 'POST .../projects/:projectId/floors/:floorId/overlay-confirmation',
};

/** Một việc làm được, kèm kết quả. */
export interface OverlaySupported<TValue> {
  readonly supported: true;
  readonly value: TValue;
}

export type OverlayCapabilityResult<TValue> = OverlaySupported<TValue> | OverlayUnsupported;

/** Dựng câu trả lời "chưa có đường làm việc này". */
export function unsupported(capability: OverlayMissingCapability): OverlayUnsupported {
  return { supported: false, capability, missing: OVERLAY_MISSING_SOURCES[capability] };
}

/* -------------------------------------------------------------------------- */
/* Hình dạng dữ liệu thô.                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Ảnh quét gốc của một tầng, ở dạng thô.
 *
 * `widthPx`/`heightPx` là `null` khi tầng chưa được đo (`isMeasured === false`):
 * chưa biết độ phân giải thì không quy được toạ độ tỉ lệ về pixel ảnh, và màn
 * phải nói ra điều đó chứ không đoán một con số.
 */
export interface OverlayScanSnapshot {
  readonly floorId: string;
  readonly floorName: string;
  /** Ảnh bản vẽ đã nắn. `null` khi tầng không có ảnh gốc — ví dụ tầng nhập từ CAD. */
  readonly imageUrl: string | null;
  readonly widthPx: Pixels | null;
  readonly heightPx: Pixels | null;
  /** `true` khi máy tìm được khung bản vẽ. `false` là "không căn được". */
  readonly isFrameFound: boolean;
}

/**
 * Một vùng lệch ở dạng thô, trước khi được định dạng thành hàng và dấu.
 *
 * Đây là hình dạng `src/domain/overlay` phải trả về. Nó mang **milimét thô**
 * (`deviationMm`) chứ không mang chuỗi: định dạng xảy ra ở hook, không ở đây và
 * cũng không ở view (A15). Hai toạ độ đi kèm đã ở hệ tỉ lệ `0..1` của khung đối
 * chiếu, cùng hệ với {@link RatioBox} — view đặt thẳng vào `style` mà không cần
 * biết milimét là gì (R-60).
 */
export interface OverlayDeviationRegion {
  /** Khoá tất định; hai vùng lệch bằng nhau không được đảo chỗ giữa hai lượt render. */
  readonly id: string;
  /** Vị trí tham chiếu — ví dụ `'trục A-3'`, `'phòng bếp'`. */
  readonly referenceLabel: string;
  /** Mã đối tượng bị ảnh hưởng, giữ nguyên chữ hoa theo ngoại lệ của A6. */
  readonly affectedObjectCode: string;
  /** Độ lệch đo được, milimét thô. */
  readonly deviationMm: number;
  /** Chỗ vẽ gạch chéo trên canvas. */
  readonly box: RatioBox;
  /** Hai đầu của đường đo vẽ ra khi vùng này được chọn. */
  readonly measurement: Readonly<{ from: RatioPoint; to: RatioPoint }>;
}

/**
 * Kết quả một lượt đánh giá bộ vùng lệch theo một dung sai.
 *
 * Cả `overToleranceCount` lẫn `overToleranceIds` cùng ra từ MỘT phép so sánh,
 * nên con số ở đầu panel và những hàng được tô `attention` không thể lệch nhau.
 */
export interface OverlayToleranceEvaluation {
  /** Sai số trung bình, milimét thô. */
  readonly meanMm: number;
  /** Sai số lớn nhất, milimét thô. */
  readonly maxMm: number;
  /** Số vùng vượt dung sai. Ngặt: `> dung sai`, không phải `>=`. */
  readonly overToleranceCount: number;
  /** Mã những vùng vượt dung sai. */
  readonly overToleranceIds: readonly string[];
}

export interface ReadFloorScanInput {
  readonly projectId: string;
  readonly floorId: string;
  readonly signal?: AbortSignal;
}

export interface ReadDeviationRegionsInput {
  readonly projectId: string;
  readonly floorId: string;
}

export interface EvaluateToleranceInput {
  readonly regions: readonly OverlayDeviationRegion[];
  readonly toleranceMm: number;
}

export interface ConfirmFloorMatchInput {
  readonly projectId: string;
  readonly floorId: string;
}

/* -------------------------------------------------------------------------- */
/* Cổng.                                                                       */
/* -------------------------------------------------------------------------- */

export interface OverlayComparisonGateway {
  /** Việc nào có đường làm hôm nay. Màn đọc cờ này chứ không đoán. */
  readonly supports: Readonly<Record<OverlayMissingCapability, boolean>>;
  /**
   * Ảnh quét gốc của MỌI tầng trong dự án. Việc duy nhất có endpoint hôm nay.
   *
   * Một lượt `quality.assess` trả về cả danh sách tầng, nên trả cả mảng là
   * trung thực hơn trả một phần tử: chính nó là nguồn duy nhất cho biết tầng
   * nào có ảnh và tầng nào không (`FloorOptionViewModel.hasScan`), và cắt bớt
   * ở đây thì màn phải gọi lượt thứ hai vào đúng endpoint vừa gọi.
   */
  readonly readFloorScans: (
    input: ReadFloorScanInput,
  ) => Promise<ApiResult<readonly OverlayScanSnapshot[]>>;
  /**
   * Chỗ ảnh quét nằm trong khung đối chiếu sau khi đặt vào không gian mô hình.
   *
   * `alignFloors` (M-11) không làm được việc này: `FloorTransform.scale` khai
   * kiểu literal `1`, nên nó không diễn đạt nổi một tỷ lệ mm/px.
   */
  readonly readScanPlacement: (
    input: ReadFloorScanInput,
  ) => Promise<OverlayCapabilityResult<RatioBox>>;
  /** Danh sách vùng lệch của tầng đang mở, chưa sắp và chưa định dạng. */
  readonly readDeviationRegions: (
    input: ReadDeviationRegionsInput,
  ) => Promise<OverlayCapabilityResult<readonly OverlayDeviationRegion[]>>;
  /**
   * Tổng hợp bộ vùng lệch tại một dung sai. Đồng bộ — xem ghi chú ở đầu file.
   *
   * `splitOutliers` (`src/domain/units/outliers.ts`) không làm được việc này:
   * ngưỡng của nó là hệ số z-score so với trung vị, không phải milimét, nên nó
   * không đếm được "bao nhiêu vùng vượt 20 mm".
   */
  readonly evaluateTolerance: (
    input: EvaluateToleranceInput,
  ) => OverlayCapabilityResult<OverlayToleranceEvaluation>;
  /** Ghi lại việc người duyệt đã xác nhận. Xem ghi chú "Xác nhận khớp" ở đầu file. */
  readonly confirmFloorMatch: (input: ConfirmFloorMatchInput) => Promise<ApiResult<void>>;
  /** Tầng này đã được xác nhận trong phiên chưa. */
  readonly hasConfirmedMatch: (input: ConfirmFloorMatchInput) => boolean;
  readonly now: () => number;
}

/* -------------------------------------------------------------------------- */
/* Chuyển đổi.                                                                 */
/* -------------------------------------------------------------------------- */

/** Một tầng trong lượt đọc chất lượng, chuyển sang hình dạng màn dùng. */
function toScanSnapshot(floor: FloorImageQuality): OverlayScanSnapshot {
  const measurement = floor.measurement;
  const frameMissing = floor.frame !== undefined && !floor.frame.isFound;
  const findingSaysFrameMissing = floor.findings.some(
    (finding) => finding.code === FRAME_NOT_FOUND_CODE,
  );

  return {
    floorId: floor.floorId,
    floorName: floor.floorName,
    // Tầng chưa đo thì chưa có ảnh đã nắn để đối chiếu: một `sourceUrl` của
    // tầng chưa đo là ảnh gốc chưa nắn, và chồng nó lên hình học là nói dối.
    imageUrl: floor.isMeasured ? floor.sourceUrl : null,
    widthPx: measurement === undefined ? null : pixels(measurement.widthPx),
    heightPx: measurement === undefined ? null : pixels(measurement.heightPx),
    isFrameFound: !frameMissing && !findingSaysFrameMissing,
  };
}

/* -------------------------------------------------------------------------- */
/* Lượt ghi giữ trong phiên.                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Những tầng đã được xác nhận, khoá theo `projectId::floorId`.
 *
 * Cùng khuôn `persistedScales` của `scaleCalibrationGateway`: một tập ở mức
 * module, sống đúng bằng phiên trình duyệt. Không endpoint thì đây là thứ trung
 * thực nhất một lượt "đã xác nhận" có thể là.
 */
const confirmedMatches = new Set<string>();

const confirmKey = (projectId: string, floorId: string): string => `${projectId}::${floorId}`;

/** Xoá mọi lượt xác nhận trong phiên. Test gọi giữa hai lượt kiểm. */
export function clearConfirmedMatches(): void {
  confirmedMatches.clear();
}

/* -------------------------------------------------------------------------- */
/* Factory.                                                                    */
/* -------------------------------------------------------------------------- */

export interface CreateOverlayComparisonGatewayOptions {
  /** Đồng hồ tiêm được. */
  readonly now?: () => number;
}

export function createOverlayComparisonGateway(
  client: ApiClient,
  options: CreateOverlayComparisonGatewayOptions = {},
): OverlayComparisonGateway {
  const now = options.now ?? ((): number => Date.now());

  return {
    // Một việc làm được hôm nay: đọc ảnh quét đã nắn. Bốn việc còn lại `false`
    // cho tới khi `src/domain/overlay` và endpoint xác nhận về — xem
    // `OVERLAY_MISSING_SOURCES`.
    supports: {
      imageToModelTransform: false,
      deviationRegions: false,
      matchMetrics: false,
      confirmFloorMatch: false,
    },

    readFloorScans: async ({ floorId, projectId, signal }) => {
      const result = await client.quality.assess({
        floorId,
        projectId,
        ...(signal !== undefined ? { signal } : {}),
      });

      if (!result.ok) {
        return result;
      }

      if (result.data.floors.length === 0) {
        // Lượt đọc luôn trả về mọi tầng của dự án, nên một danh sách rỗng nghĩa
        // là đường dẫn trỏ vào một dự án không có tầng nào. Nói ra bằng lỗi hợp
        // đồng chứ không dựng một bản ghi rỗng giả vờ là dữ liệu. `toAppError`
        // dựng lỗi để mã và câu chữ đi qua đúng bảng của `src/lib/errors`.
        return {
          ok: false,
          error: toAppError(
            new Error(
              `${ENDPOINTS.quality.assess(projectId, floorId)} không trả về tầng nào.`,
            ),
          ),
        };
      }

      return { ok: true, data: result.data.floors.map(toScanSnapshot) };
    },

    readScanPlacement: async () => unsupported('imageToModelTransform'),
    readDeviationRegions: async () => unsupported('deviationRegions'),
    evaluateTolerance: () => unsupported('matchMetrics'),

    confirmFloorMatch: async ({ floorId, projectId }) => {
      confirmedMatches.add(confirmKey(projectId, floorId));
      return { ok: true, data: undefined };
    },

    hasConfirmedMatch: ({ floorId, projectId }) =>
      confirmedMatches.has(confirmKey(projectId, floorId)),

    now,
  };
}

/** Cổng thật cho container. */
export function createAppOverlayComparisonGateway(): OverlayComparisonGateway {
  return createOverlayComparisonGateway(createAppApiClient());
}

/**
 * Cổng chạy trên bộ mẫu — story và test dùng, không chạm mạng.
 *
 * Bốn tầng của `createMockApiClient()` là dữ liệu thật của bộ mẫu, nên story
 * không phải bịa một tầng tại chỗ (R-70).
 */
export function createMockOverlayComparisonGateway(
  options: CreateOverlayComparisonGatewayOptions = {},
): OverlayComparisonGateway {
  return createOverlayComparisonGateway(createMockApiClient(), options);
}

/**
 * Bọc một cổng, thay đúng những việc người gọi đưa vào.
 *
 * Test dựng nhánh "đã có vùng lệch" hay "đã đo được" bằng hàm này thay vì viết
 * lại cả cổng — cùng lý lẽ `withScaleCapabilities` của `scaleCalibrationGateway`:
 * chỉ thứ đang kiểm mới bị thay.
 */
export function withOverlayCapabilities(
  base: OverlayComparisonGateway,
  overrides: Partial<Omit<OverlayComparisonGateway, 'supports'>> & {
    readonly supports?: Partial<Record<OverlayMissingCapability, boolean>>;
  },
): OverlayComparisonGateway {
  const { supports, ...rest } = overrides;

  return {
    ...base,
    ...rest,
    supports: { ...base.supports, ...supports },
  };
}
