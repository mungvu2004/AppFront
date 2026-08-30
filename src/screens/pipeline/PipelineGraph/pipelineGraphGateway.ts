/**
 * Cổng dữ liệu của màn Sơ đồ xử lý (`PipelineGraph`) — mọi lời gọi ra khỏi màn
 * đi qua đây.
 *
 * Cùng khuôn `processingGateway.ts` / `scaleCalibrationGateway.ts`: một
 * `interface` cho hình dạng, một factory nhận cổng thật để dựng bản sản phẩm, và
 * một factory thứ hai dựng bản giả có dữ liệu đầy đủ cho story và test (R-70,
 * R-73).
 *
 * ## Phần NỐI ĐƯỢC THẬT
 *
 * Đúng một việc: trạng thái sáu bước của T-08 cho một lượt xử lý. File này KHÔNG
 * dựng lại dòng sự kiện — nó nhận nguyên {@link ProcessingGateway} của màn Xử lý
 * và gọi `subscribeProgress` / `readProgressOnce` / `toStageBreakdown` đã có sẵn
 * ở đó. Hai màn cùng đọc một nguồn thì phải cùng đọc qua một đường; dựng bản thứ
 * hai của cùng phép ánh xạ là tạo hai sự thật sẽ lệch nhau (R-61).
 *
 * Kèm theo đó là **giả định C3** của `toStageBreakdown`, và nó được thừa kế
 * nguyên vẹn: mọi bước đứng trước bước đang chạy coi như đã xong. Ai đọc số liệu
 * của màn này phải biết điều đó.
 *
 * ## Phần KHÔNG CÓ — và vì sao vẫn khai
 *
 * Đã soát toàn bộ `src/api/endpoints.ts`, `src/api/schemas/**` và
 * `src/lib/realtime/**`: **không có khái niệm nhánh CAD / nhánh AI ở tầng dữ
 * liệu**. `DrawingSchema` chỉ mang `heightMm, id, name, scale?, uploadedAt,
 * uploaderId, url, widthMm` — không trường nào nói bản vẽ là tệp CAD hay ảnh
 * quét. `Progress` mang `progressPercent, status, step, startedAt?, endedAt?,
 * error?` — không thời lượng theo bước, không số đầu ra theo bước, không tham
 * số, không ảnh trung gian, không nhật ký.
 *
 * Sáu việc màn cần mà tầng dữ liệu chưa có vẫn nằm trong
 * {@link PipelineGraphGateway} — giao diện là thứ nơi gọi lập trình theo, và
 * story cắm bản giả vào đúng chỗ đó để phần giao diện tương ứng vẫn kiểm được
 * (R-73) — nhưng **bản cài đặt thật trả nhánh `supported: false` có kiểu rõ
 * ràng**, kèm tên endpoint hoặc trường dữ liệu còn thiếu. Không giá trị bịa,
 * không `0`, không mảng rỗng giả vờ là dữ liệu thật. Hook đọc nhánh đó và phản
 * ánh trung thực ra props: chưa biết nhánh nào thì không nút nào được viền đậm,
 * chưa có thời lượng thì ô thời lượng để trống.
 *
 * Đây KHÔNG phải cái R-69 cấm: R-69 cấm bịa dữ liệu và cấm ghi chú nợ im lặng.
 * Ở đây một khả năng chưa tồn tại được khai báo rõ ràng, có tên, và sự thật đó
 * được truyền lên tới giao diện.
 */

import { describeError, toAppError } from '@/lib/errors';
import type { AppError } from '@/lib/errors';
import type { PipelineStageId, PipelineStageState } from '@/lib/realtime/pipeline';
import {
  createAppProcessingGateway,
  toStageBreakdown,
  type ProcessingGateway,
  type ProcessingProgressSnapshot,
} from '@/screens/pipeline/ProcessingScreen/processingGateway';

import type { PipelineBranchId, PipelineNodeId } from './types';

/* -------------------------------------------------------------------------- */
/* Khả năng chưa tồn tại — kết quả CÓ KIỂU, không phải giá trị bịa.             */
/* -------------------------------------------------------------------------- */

/** Tên máy đọc của từng việc màn cần. Mỗi tên có một dòng trong bản kê dưới đây. */
export const PIPELINE_GRAPH_CAPABILITIES = [
  'stageBreakdown',
  'branchReport',
  'branchComparison',
  'nodeDetail',
  'switchBranch',
  'rerunFromNode',
] as const;

export type PipelineGraphCapability = (typeof PIPELINE_GRAPH_CAPABILITIES)[number];

/** Những việc bản cài đặt thật CHƯA làm được. Danh sách này chỉ được ngắn đi. */
export const PIPELINE_GRAPH_MISSING_CAPABILITIES = [
  'branchReport',
  'branchComparison',
  'nodeDetail',
  'switchBranch',
  'rerunFromNode',
] as const;

export type PipelineGraphMissingCapability =
  (typeof PIPELINE_GRAPH_MISSING_CAPABILITIES)[number];

/**
 * Cái còn thiếu, viết ra bằng tên thật để lần sau ai bổ sung tầng dữ liệu biết
 * phải thêm gì. Không câu nào ở đây là lời hứa; chúng là bản mô tả hiện trạng.
 */
export const PIPELINE_GRAPH_MISSING_ENDPOINTS: Readonly<
  Record<PipelineGraphMissingCapability, string>
> = {
  branchReport:
    'nhánh xử lý theo tầng (CAD hay AI) — chưa có; DrawingSchema không mang trường nào phân biệt tệp CAD với ảnh quét',
  branchComparison:
    'số liệu so sánh hai nhánh (độ chính xác, thời gian, mức QC, rủi ro) — chưa có endpoint nào trả về',
  nodeDetail:
    'tham số, số đầu ra, ảnh trung gian và nhật ký của từng bước — Progress chỉ mang một luồng tiến độ tổng',
  switchBranch: 'lệnh đổi nhánh xử lý của một tầng — chưa có endpoint',
  rerunFromNode: 'lệnh chạy lại pipeline từ một bước — chưa có endpoint',
};

export interface PipelineGraphUnsupported {
  readonly supported: false;
  readonly capability: PipelineGraphMissingCapability;
  /** Câu tiếng Việt nói ra cái còn thiếu, lấy từ bản kê trên. */
  readonly missing: string;
}

export interface PipelineGraphSupported<TValue> {
  readonly supported: true;
  readonly value: TValue;
}

export type PipelineGraphCapabilityResult<TValue> =
  | PipelineGraphSupported<TValue>
  | PipelineGraphUnsupported;

export function unsupported(
  capability: PipelineGraphMissingCapability,
): PipelineGraphUnsupported {
  return {
    supported: false,
    capability,
    missing: PIPELINE_GRAPH_MISSING_ENDPOINTS[capability],
  };
}

/* -------------------------------------------------------------------------- */
/* Dữ liệu thô cổng trả về.                                                    */
/* -------------------------------------------------------------------------- */

/** Một thất bại, đã thành câu người đọc được. */
export interface PipelineGraphFailure {
  readonly title: string;
  readonly sentence: string;
  /** Mã máy đọc của `APP_ERROR_KIND_CONFIG` — ví dụ `NETWORK`. */
  readonly technicalCode: string;
  readonly kind: AppError['kind'];
  readonly isRetryable: boolean;
}

/** Nhánh mà một tầng đã đi qua, cùng câu dẫn chứng của tầng đó. */
export interface PipelineRawFloorBranch {
  readonly floorId: string;
  readonly floorName: string;
  readonly branch: PipelineBranchId;
  /** Vì sao hệ thống chọn nhánh này cho tầng này. Câu tiếng Việt đã viết sẵn. */
  readonly reason: string;
  readonly hasFailed: boolean;
}

export interface PipelineRawBranchReport {
  /** Nhánh đang dùng cho cả hồ sơ; `undefined` khi các tầng dùng nhánh khác nhau. */
  readonly activeBranch?: PipelineBranchId;
  readonly floors: readonly PipelineRawFloorBranch[];
}

/** Một dòng của bảng so sánh. Mỗi ô là một câu ngắn, không con số cần định dạng. */
export interface PipelineRawComparisonRow {
  readonly id: string;
  readonly label: string;
  readonly cadText: string;
  readonly aiText: string;
}

export interface PipelineRawParameter {
  readonly id: string;
  readonly label: string;
  readonly value: string;
}

/** Chi tiết một nút của sơ đồ kỹ thuật. */
export interface PipelineRawNodeDetail {
  readonly nodeId: PipelineNodeId;
  readonly inputLines: readonly string[];
  readonly parameters: readonly PipelineRawParameter[];
  /** Số đối tượng bước này sinh ra. `undefined` khi pipeline không đếm. */
  readonly outputCount?: number;
  /** Đơn vị của số đầu ra — ví dụ `"đoạn tường"`. */
  readonly outputUnit?: string;
  /** Thời lượng chạy, tính bằng mi-li-giây. `undefined` khi chưa đo. */
  readonly durationMs?: number;
  readonly thumbnailUrl?: string;
  readonly logLines: readonly string[];
}

/* -------------------------------------------------------------------------- */
/* Tham số vào.                                                                */
/* -------------------------------------------------------------------------- */

export interface ReadRunInput {
  readonly projectId: string;
  readonly uploadId: string;
  readonly signal?: AbortSignal;
}

export interface SubscribeRunInput {
  readonly projectId: string;
  readonly floorId: string;
  readonly uploadId: string;
}

export interface SubscribeRunHandlers {
  readonly onStages: (stages: readonly PipelineStageState[]) => void;
  readonly onFailure?: (failure: PipelineGraphFailure) => void;
}

export interface ReadBranchReportInput {
  readonly projectId: string;
}

export interface ReadNodeDetailInput {
  readonly projectId: string;
  readonly nodeId: PipelineNodeId;
  readonly stageId?: PipelineStageId;
}

export interface SwitchBranchInput {
  readonly projectId: string;
  readonly targetBranch: PipelineBranchId;
}

export interface RerunFromNodeInput {
  readonly projectId: string;
  readonly nodeId: PipelineNodeId;
  /** Giữ lại các mục QC đã duyệt thay vì bỏ đi cùng lượt chạy lại. */
  readonly keepApproved: boolean;
}

/* -------------------------------------------------------------------------- */
/* Cổng.                                                                       */
/* -------------------------------------------------------------------------- */

export interface PipelineGraphGateway {
  readonly supports: Readonly<Record<PipelineGraphCapability, boolean>>;
  readonly readRunOnce: (
    input: ReadRunInput,
  ) => Promise<PipelineGraphCapabilityResult<readonly PipelineStageState[]>>;
  readonly subscribeRun: (input: SubscribeRunInput, handlers: SubscribeRunHandlers) => () => void;
  readonly readBranchReport: (
    input: ReadBranchReportInput,
  ) => Promise<PipelineGraphCapabilityResult<PipelineRawBranchReport>>;
  readonly readBranchComparison: () => Promise<
    PipelineGraphCapabilityResult<readonly PipelineRawComparisonRow[]>
  >;
  readonly readNodeDetail: (
    input: ReadNodeDetailInput,
  ) => Promise<PipelineGraphCapabilityResult<PipelineRawNodeDetail>>;
  readonly switchBranch: (
    input: SwitchBranchInput,
  ) => Promise<PipelineGraphCapabilityResult<undefined>>;
  readonly rerunFromNode: (
    input: RerunFromNodeInput,
  ) => Promise<PipelineGraphCapabilityResult<undefined>>;
  readonly describeApiFailure: (error: unknown) => PipelineGraphFailure;
  readonly now: () => number;
}

export interface CreatePipelineGraphGatewayOptions {
  /** Đồng hồ tiêm được. */
  readonly now?: () => number;
}

function toFailure(error: unknown): PipelineGraphFailure {
  const appError = toAppError(error);
  const described = describeError(appError);

  return {
    title: described.title,
    sentence: described.description,
    technicalCode: appError.code,
    kind: appError.kind,
    isRetryable: appError.retryable,
  };
}

/**
 * Cổng dựng trên cổng của màn Xử lý.
 *
 * Nhận `ProcessingGateway` chứ không nhận `ApiClient`: phần nối được thật của
 * màn này là đúng phần màn Xử lý đã nối, nên cách rẻ nhất để hai màn không lệch
 * nhau là dùng lại chính nó.
 */
export function createPipelineGraphGateway(
  processing: ProcessingGateway,
  options: CreatePipelineGraphGatewayOptions = {},
): PipelineGraphGateway {
  const now = options.now ?? processing.now;

  return {
    supports: {
      stageBreakdown: true,
      branchReport: false,
      branchComparison: false,
      nodeDetail: false,
      switchBranch: false,
      rerunFromNode: false,
    },

    readRunOnce: async ({ projectId, signal, uploadId }) => {
      const result = await processing.readProgressOnce({
        projectId,
        uploadId,
        ...(signal !== undefined ? { signal } : {}),
      });

      if (!result.ok) {
        throw result.error;
      }

      const breakdown = toStageBreakdown(result.data, [], now());

      return breakdown.supported
        ? { supported: true, value: breakdown.value }
        : { supported: true, value: [] };
    },

    subscribeRun: ({ floorId, projectId, uploadId }, handlers) => {
      let stages: readonly PipelineStageState[] = [];

      return processing.subscribeProgress(
        { floorId, projectId, uploadId },
        {
          onSnapshot: (snapshot: ProcessingProgressSnapshot) => {
            const breakdown = toStageBreakdown(snapshot.progress, stages, snapshot.observedAtMs);

            if (!breakdown.supported) {
              return;
            }

            stages = breakdown.value;
            handlers.onStages(stages);
          },
          // `ProcessingFailure` và `PipelineGraphFailure` là cùng một hình dạng
          // (tiêu đề, câu, mã kỹ thuật, loại, có thử lại được không): cả hai
          // đều dựng thẳng từ `describeError`, nên chuyển tiếp là đủ.
          ...(handlers.onFailure !== undefined ? { onFailure: handlers.onFailure } : {}),
        },
      );
    },

    readBranchReport: () => Promise.resolve(unsupported('branchReport')),
    readBranchComparison: () => Promise.resolve(unsupported('branchComparison')),
    readNodeDetail: () => Promise.resolve(unsupported('nodeDetail')),
    switchBranch: () => Promise.resolve(unsupported('switchBranch')),
    rerunFromNode: () => Promise.resolve(unsupported('rerunFromNode')),

    describeApiFailure: (error) => toFailure(error),

    now,
  };
}

/** Cổng dựng trên cổng thật của ứng dụng — thứ container gọi. */
export function createAppPipelineGraphGateway(): PipelineGraphGateway {
  return createPipelineGraphGateway(createAppProcessingGateway());
}

/* -------------------------------------------------------------------------- */
/* Bản giả — chỗ story và test cắm vào để kiểm nhánh "có hỗ trợ".               */
/* -------------------------------------------------------------------------- */

/**
 * Nội dung của bản giả.
 *
 * Đây là dữ liệu MẪU, và nó nằm ở đây chứ không ở bản thật vì đúng một lý do:
 * bản thật không có nguồn nào để lấy nó. Story và test dựng giao diện trên bộ
 * này để nhánh "đã có dữ liệu" vẫn được kiểm (R-73), còn bản sản phẩm vẫn nói
 * ra sự thật là chưa nối được.
 */
export const PIPELINE_GRAPH_SAMPLE_BRANCH_REPORT: PipelineRawBranchReport = {
  activeBranch: 'cad',
  floors: [
    {
      floorId: 'floor-1',
      floorName: 'Tầng 1',
      branch: 'cad',
      reason: 'hồ sơ có tệp CAD còn nguyên lớp, nên đường hình học lấy thẳng từ tệp',
      hasFailed: false,
    },
    {
      floorId: 'floor-2',
      floorName: 'Tầng 2',
      branch: 'cad',
      reason: 'cùng tệp CAD với tầng 1, không phải dò lại bằng ảnh',
      hasFailed: false,
    },
    {
      floorId: 'floor-3',
      floorName: 'Tầng 3',
      branch: 'ai',
      reason: 'tầng này chỉ có bản quét, nên đi qua sáu bước nhận dạng',
      hasFailed: false,
    },
  ],
};

export const PIPELINE_GRAPH_SAMPLE_COMPARISON: readonly PipelineRawComparisonRow[] = [
  {
    id: 'accuracy',
    label: 'Độ chính xác',
    cadText: 'đường hình học lấy đúng từ tệp, sai số bằng sai số của người vẽ',
    aiText: 'đường hình học do mô hình dò, còn lệch ở chỗ nét mờ và chỗ chồng lớp',
  },
  {
    id: 'duration',
    label: 'Thời gian xử lý',
    cadText: 'nhanh, vì không phải nhận dạng gì',
    aiText: 'lâu hơn, do phải chạy đủ sáu bước nhận dạng',
  },
  {
    id: 'review',
    label: 'Có cần soát nhiều không',
    cadText: 'soát nhẹ, chủ yếu là đối chiếu tên phòng',
    aiText: 'soát kỹ, nhất là tường mỏng và ô mở nằm sát nhau',
  },
  {
    id: 'risk',
    label: 'Rủi ro',
    cadText: 'tệp thiếu lớp thì thiếu hẳn một phần mặt bằng',
    aiText: 'bản quét mờ hoặc nghiêng thì kết quả lệch mà không báo lỗi',
  },
];

export const PIPELINE_GRAPH_SAMPLE_NODE_DETAILS: Readonly<Partial<Record<PipelineNodeId, PipelineRawNodeDetail>>> = {
  sourceImage: {
    nodeId: 'sourceImage',
    inputLines: ['ban-ve-tang-3.png · 4.096 × 4.096 điểm ảnh'],
    parameters: [{ id: 'dpi', label: 'Mật độ quét', value: '300 dpi' }],
    outputCount: 1,
    outputUnit: 'ảnh',
    logLines: ['nhận ảnh gốc, chưa đổi kích thước'],
  },
  preprocess: {
    nodeId: 'preprocess',
    inputLines: ['ảnh gốc 4.096 × 4.096'],
    parameters: [
      { id: 'blur', label: 'Bán kính làm mờ', value: '3' },
      { id: 'canny', label: 'Ngưỡng Canny', value: '80 / 160' },
      { id: 'warp', label: 'Khung nắn', value: '3000 × 3000' },
    ],
    outputCount: 1,
    outputUnit: 'ảnh đã nắn',
    durationMs: 4200,
    thumbnailUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    logLines: [
      'chuyen xam: xong',
      'lam mo Gauss r=3: xong',
      'do canh Canny 80/160: xong',
      'tim duong bien: 1 khung',
      'nan phoi canh 3000x3000: xong',
    ],
  },
  wallSegmentation: {
    nodeId: 'wallSegmentation',
    inputLines: ['ảnh đã nắn 3000 × 3000'],
    parameters: [{ id: 'threshold', label: 'Ngưỡng nhận', value: '0,55' }],
    outputCount: 48,
    outputUnit: 'đoạn tường',
    durationMs: 21400,
    logLines: ['mask tuong: 48 vung lien thong'],
  },
  objectDetection: {
    nodeId: 'objectDetection',
    inputLines: ['ảnh đã nắn 3000 × 3000'],
    parameters: [{ id: 'iou', label: 'Ngưỡng trùng khung', value: '0,45' }],
    outputCount: 26,
    outputUnit: 'đối tượng',
    durationMs: 9800,
    logLines: ['cua: 14, cua so: 9, thiet bi: 3'],
  },
  dimensionReading: {
    nodeId: 'dimensionReading',
    inputLines: ['ảnh đã nắn 3000 × 3000'],
    parameters: [{ id: 'lang', label: 'Bộ ký tự', value: 'số và dấu chấm' }],
    outputCount: 34,
    outputUnit: 'chuỗi kích thước',
    durationMs: 7600,
    logLines: ['doc duoc 34 chuoi kich thuoc'],
  },
  thicknessExtraction: {
    nodeId: 'thicknessExtraction',
    inputLines: ['mặt nạ tường của bước tách lớp'],
    parameters: [{ id: 'metric', label: 'Phép đo khoảng cách', value: 'L2' }],
    outputCount: 48,
    outputUnit: 'giá trị độ dày',
    durationMs: 1800,
    logLines: ['do day trung vi: 218 px'],
  },
  simplify: {
    nodeId: 'simplify',
    inputLines: ['mặt nạ tường đã có độ dày'],
    parameters: [{ id: 'epsilon', label: 'Sai số cho phép', value: '2 px' }],
    outputCount: 48,
    outputUnit: 'trục tường',
    durationMs: 2400,
    logLines: ['lam mong: xong', 'don dinh: 1.284 -> 312 dinh'],
  },
  thicknessNormalise: {
    nodeId: 'thicknessNormalise',
    inputLines: ['48 trục tường kèm độ dày đo được'],
    parameters: [{ id: 'steps', label: 'Bậc chuẩn', value: '110 / 220 / 330' }],
    outputCount: 48,
    outputUnit: 'tường đã quy chuẩn',
    durationMs: 900,
    logLines: ['110mm: 12, 220mm: 31, 330mm: 3, cot be tong: 2'],
  },
  spatialJson: {
    nodeId: 'spatialJson',
    inputLines: ['48 tường, 26 đối tượng, 34 chuỗi kích thước'],
    parameters: [{ id: 'version', label: 'Bản dữ liệu', value: '2' }],
    outputCount: 1,
    outputUnit: 'tệp dữ liệu không gian',
    durationMs: 1200,
    logLines: ['dung Spatial JSON: 1 tep, 3 tang'],
  },
};

export interface CreateMockPipelineGraphGatewayOptions {
  /** Ép nhánh nào đang dùng — story "nhánh AI" đổi đúng trường này. */
  readonly branchReport?: PipelineRawBranchReport;
  /** Bật hoặc tắt từng khả năng, để kiểm nhánh "chưa nối được". */
  readonly supports?: Partial<Record<PipelineGraphCapability, boolean>>;
  /** Trạng thái sáu bước trả về ngay, không cần dòng sự kiện nào. */
  readonly stages?: readonly PipelineStageState[];
  readonly now?: () => number;
}

/**
 * Cổng giả có đủ dữ liệu — story và test cắm cái này vào để phần giao diện phụ
 * thuộc dữ liệu chưa nối được vẫn kiểm được (R-73).
 */
export function createMockPipelineGraphGateway(
  options: CreateMockPipelineGraphGatewayOptions = {},
): PipelineGraphGateway {
  const stages = options.stages ?? [];
  const branchReport = options.branchReport ?? PIPELINE_GRAPH_SAMPLE_BRANCH_REPORT;
  const supports: Readonly<Record<PipelineGraphCapability, boolean>> = {
    stageBreakdown: true,
    branchReport: true,
    branchComparison: true,
    nodeDetail: true,
    switchBranch: true,
    rerunFromNode: true,
    ...options.supports,
  };

  const guard = <TValue>(
    capability: PipelineGraphMissingCapability,
    value: TValue,
  ): PipelineGraphCapabilityResult<TValue> =>
    supports[capability] ? { supported: true, value } : unsupported(capability);

  return {
    supports,

    readRunOnce: () => Promise.resolve({ supported: true, value: stages }),

    subscribeRun: (_input, handlers) => {
      handlers.onStages(stages);
      return () => undefined;
    },

    readBranchReport: () => Promise.resolve(guard('branchReport', branchReport)),
    readBranchComparison: () =>
      Promise.resolve(guard('branchComparison', PIPELINE_GRAPH_SAMPLE_COMPARISON)),
    readNodeDetail: ({ nodeId }) =>
      Promise.resolve(
        guard(
          'nodeDetail',
          PIPELINE_GRAPH_SAMPLE_NODE_DETAILS[nodeId] ?? {
            nodeId,
            inputLines: [],
            parameters: [],
            logLines: [],
          },
        ),
      ),
    switchBranch: () => Promise.resolve(guard('switchBranch', undefined)),
    rerunFromNode: () => Promise.resolve(guard('rerunFromNode', undefined)),

    describeApiFailure: (error) => toFailure(error),

    now: options.now ?? ((): number => Date.now()),
  };
}
