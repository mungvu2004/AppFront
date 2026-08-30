/**
 * Hợp đồng props của màn Sơ đồ xử lý (`PipelineGraph`) — route
 * `ROUTE_PATTERNS.projectPipelineGraph` (`.../pipeline/graph`).
 *
 * File này là API công khai duy nhất giữa hook (`usePipelineGraph.ts`) và view
 * (`PipelineGraph.tsx` cộng ba phần con). View không được nhập `src/api`,
 * `src/store`, `src/domain` hay `src/lib/http` (mục D, R-60), nên mọi thứ khai ở
 * đây phải **đã quyết xong và viết xong**:
 *
 * - Mọi chuỗi người đọc là tiếng Việt có dấu và **đã định dạng sẵn** (A15).
 *   Ngoại lệ duy nhất là toạ độ `column` / `row` và `enterDelayMs`: chúng cấp
 *   cho chu kỳ vẽ của chính sơ đồ, không phải con số ai đọc.
 * - Tên thư viện kỹ thuật đi riêng ở {@link PipelineNodeViewModel.technicalLabel}
 *   chứ không trộn vào `name`. View vẽ nó trong `<code>` — vừa đúng "chữ đều" của
 *   đặc tả, vừa là thẻ mà `expectVietnamese` bỏ qua, nên `SegFormer` không bị
 *   báo là tiếng Anh sót lại.
 * - {@link PipelineGraphState} có đúng **bảy** giá trị của A11, lấy tên chính xác
 *   từ `src/lib/testing/sevenStateScenarios.ts`.
 *
 * ## Vì sao danh mục nút nằm ở đây chứ không ở view
 *
 * Bảy nút của chế độ chi tiết có ba mặt: **chỗ đứng** (cột, hàng, cạnh nối) là
 * việc của view; **tên tiếng Việt** là việc của bản dịch; **bước T-08 tương ứng**
 * là việc của hook. Tách ba mặt ra ba file thì mỗi lần thêm một nút phải sửa ba
 * chỗ và ba chỗ đó sẽ lệch nhau. Danh mục {@link PIPELINE_NODES} giữ cả ba trong
 * một bảng: hook đọc `stageId`, còn view đọc `column`, `row` và `edgeTargets`.
 */

import type { PipelineStageId } from '@/lib/realtime/pipeline';

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái (A11).                                                       */
/* -------------------------------------------------------------------------- */

/** Đúng bảy trạng thái của A11, tên lấy nguyên từ `SEVEN_STATES`. */
export type PipelineGraphState =
  | 'empty'
  | 'loading'
  | 'partial'
  | 'error'
  | 'success'
  | 'forbidden'
  | 'collapsed';

/* -------------------------------------------------------------------------- */
/* Hai chế độ, hai nhánh.                                                      */
/* -------------------------------------------------------------------------- */

/**
 * "Tổng quan" là màn tạo niềm tin cho mọi người dùng; "Chi tiết kỹ thuật" là nơi
 * gỡ lỗi, mở bằng khối gấp và chỉ vai Quản trị thấy.
 */
export type PipelineGraphMode = 'overview' | 'detail';

/** Hai nhánh xử lý: tệp CAD cho hình học chính xác, ảnh quét cho AI sáu bước. */
export type PipelineBranchId = 'cad' | 'ai';

/** Bốn trạng thái một nút có thể ở — cùng bảng với `PipelineStageStatus` của T-08. */
export type PipelineNodeStatus = 'queued' | 'running' | 'done' | 'failed';

/* -------------------------------------------------------------------------- */
/* Danh mục bảy nút của chế độ chi tiết.                                       */
/* -------------------------------------------------------------------------- */

export const PIPELINE_NODE_IDS = [
  'sourceImage',
  'preprocess',
  'wallSegmentation',
  'objectDetection',
  'dimensionReading',
  'thicknessExtraction',
  'simplify',
  'thicknessNormalise',
  'spatialJson',
] as const;

export type PipelineNodeId = (typeof PIPELINE_NODE_IDS)[number];

export interface PipelineNodeDefinition {
  readonly id: PipelineNodeId;
  /** Cột trái sang phải, bắt đầu từ 0. */
  readonly column: number;
  /** Hàng trong cột; điểm rẽ ba nhánh song song dùng ba hàng khác nhau. */
  readonly row: number;
  /** Các nút mà nút này nối tới. Cạnh vẽ bằng đường SVG 1px. */
  readonly edgeTargets: readonly PipelineNodeId[];
  /**
   * Bước T-08 mà nút này thuộc về. `undefined` nghĩa là pipeline **không báo**
   * một bước riêng cho nút — trạng thái của nó suy từ nút cha, và thời lượng
   * cùng số đầu ra để trống chứ không bịa.
   */
  readonly stageId?: PipelineStageId;
  /**
   * Nút cha khi `stageId` trống. Ba nút hậu xử lý tường đều nằm trong bước
   * "tách lớp tường" của T-08, nên chúng theo trạng thái của nút đó.
   */
  readonly inheritsFrom?: PipelineNodeId;
}

/**
 * Bảy nút, đúng thứ tự đặc tả nêu, cộng hai nút hậu xử lý tường mà đặc tả tách
 * riêng thành mục 5 và mục 6.
 */
export const PIPELINE_NODES: readonly PipelineNodeDefinition[] = [
  { id: 'sourceImage', column: 0, row: 1, edgeTargets: ['preprocess'] },
  {
    id: 'preprocess',
    column: 1,
    row: 1,
    edgeTargets: ['wallSegmentation', 'objectDetection', 'dimensionReading'],
    stageId: 'preprocess',
  },
  {
    id: 'wallSegmentation',
    column: 2,
    row: 0,
    edgeTargets: ['thicknessExtraction'],
    stageId: 'wallSegmentation',
  },
  {
    id: 'objectDetection',
    column: 2,
    row: 1,
    edgeTargets: ['spatialJson'],
    stageId: 'openingAndFurnitureDetection',
  },
  {
    id: 'dimensionReading',
    column: 2,
    row: 2,
    edgeTargets: ['spatialJson'],
    stageId: 'dimensionReading',
  },
  {
    id: 'thicknessExtraction',
    column: 3,
    row: 0,
    edgeTargets: ['simplify'],
    inheritsFrom: 'wallSegmentation',
  },
  {
    id: 'simplify',
    column: 4,
    row: 0,
    edgeTargets: ['thicknessNormalise'],
    inheritsFrom: 'wallSegmentation',
  },
  {
    id: 'thicknessNormalise',
    column: 5,
    row: 0,
    edgeTargets: ['spatialJson'],
    inheritsFrom: 'wallSegmentation',
  },
  { id: 'spatialJson', column: 6, row: 1, edgeTargets: [], stageId: 'spatialDataBuild' },
];

/* -------------------------------------------------------------------------- */
/* Chế độ Tổng quan.                                                           */
/* -------------------------------------------------------------------------- */

/** Một khối của sơ đồ Tổng quan. Khối rộng 200, bo 12, đệm 16, viền mảnh. */
export interface PipelineOverviewBlockViewModel {
  readonly id: string;
  /** Tiếng Việt, kiểu câu. */
  readonly label: string;
  /** Câu phụ một dòng dưới nhãn. */
  readonly caption: string;
  readonly column: number;
  readonly row: number;
  readonly edgeTargets: readonly string[];
  /** Khối của một nhánh; `undefined` với khối đầu vào, khối hợp và khối dựng 3D. */
  readonly branch?: PipelineBranchId;
}

/** Nhánh đang dùng: viền đậm và badge. Nhánh không dùng: mờ, **không đổi màu**. */
export interface PipelineBranchStateViewModel {
  readonly id: PipelineBranchId;
  readonly label: string;
  readonly isActive: boolean;
  /** Nhánh này báo hỏng ở ít nhất một tầng. */
  readonly hasFailed: boolean;
  /** Nhãn badge khi đang dùng — ví dụ `"đang dùng"`. `undefined` khi không dùng. */
  readonly activeBadgeLabel?: string;
}

/** Một dòng của bảng so sánh hai nhánh. Mỗi ô một câu ngắn, không biểu tượng màu. */
export interface PipelineComparisonRowViewModel {
  readonly id: string;
  readonly label: string;
  readonly cadText: string;
  readonly aiText: string;
}

/** Một dòng dẫn chứng theo tầng, dựng từ P-03. */
export interface PipelineEvidenceRowViewModel {
  readonly id: string;
  /** Tên tầng — ví dụ `"Tầng 2"`. */
  readonly floorLabel: string;
  /** Câu dẫn chứng đã ghép sẵn. */
  readonly sentence: string;
  readonly branch?: PipelineBranchId;
}

export interface PipelineOverviewViewModel {
  readonly blocks: readonly PipelineOverviewBlockViewModel[];
  readonly branches: readonly PipelineBranchStateViewModel[];
  readonly comparisonRows: readonly PipelineComparisonRowViewModel[];
  readonly evidenceRows: readonly PipelineEvidenceRowViewModel[];
  /** Câu nói vì sao hệ thống chọn nhánh đang dùng. */
  readonly reasonLine: string;
  /** Nút "Đổi sang nhánh AI" — vắng mặt khi không có quyền hoặc chưa nối được. */
  readonly switchAction?: PipelineSwitchActionViewModel;
}

/** Nút đổi nhánh, cộng cảnh báo ngay tại chỗ (A9 — việc này không hoàn tác được). */
export interface PipelineSwitchActionViewModel {
  readonly label: string;
  readonly targetBranch: PipelineBranchId;
  readonly isConfirming: boolean;
  readonly warningTitle: string;
  readonly warningMessage: string;
  readonly confirmLabel: string;
  readonly dismissLabel: string;
}

/* -------------------------------------------------------------------------- */
/* Chế độ Chi tiết kỹ thuật.                                                   */
/* -------------------------------------------------------------------------- */

/** Một hàng con hiện ngay trong nút — năm hàng của "Tiền xử lý". */
export interface PipelineNodeSubRowViewModel {
  readonly id: string;
  readonly label: string;
}

export interface PipelineNodeViewModel {
  readonly id: PipelineNodeId;
  /** Tên tiếng Việt, kiểu câu. */
  readonly name: string;
  /**
   * Tên thư viện hoặc thuật toán, viết nguyên văn — `SegFormer MIT-B5`,
   * `Zhang-Suen`. View vẽ trong `<code>`; **không bao giờ** xuất hiện ở chế độ
   * Tổng quan.
   */
  readonly technicalLabel?: string;
  /** Công thức viết bằng chữ đều — ví dụ `W_pixel = 2 × Distance_max`. */
  readonly formula?: string;
  readonly status: PipelineNodeStatus;
  /** Đã định dạng sẵn — ví dụ `"đang chạy"`. */
  readonly statusLabel: string;
  /** Chữ đều. `undefined` khi T-08 chưa báo thời lượng của nút này. */
  readonly durationLabel?: string;
  /** Đã định dạng sẵn — ví dụ `"48 đoạn tường"`. `undefined` khi chưa đếm được. */
  readonly outputCountLabel?: string;
  readonly subRows: readonly PipelineNodeSubRowViewModel[];
  readonly column: number;
  readonly row: number;
  readonly edgeTargets: readonly PipelineNodeId[];
  /** So le 24 ms mỗi nút lúc sơ đồ vào; 0 khi người dùng xin giảm chuyển động. */
  readonly enterDelayMs: number;
  readonly isSelected: boolean;
  /** Nút nằm sau nút vừa xin chạy lại — mờ xuống trong lúc chờ. */
  readonly isDownstreamOfRerun: boolean;
}

/** Một tham số của nút đang chọn, hiện ở panel phải. */
export interface PipelineParameterRowViewModel {
  readonly id: string;
  readonly label: string;
  /** Đã định dạng sẵn; chữ đều ở view. */
  readonly value: string;
}

/** Ảnh thu nhỏ của bước trung gian, khi bước đó có ảnh. */
export interface PipelineThumbnailViewModel {
  readonly url: string;
  readonly alt: string;
}

/** Cảnh báo của "Chạy lại từ bước này" — nêu đúng số mục QC đã duyệt bị ảnh hưởng. */
export interface PipelineRerunWarningViewModel {
  readonly title: string;
  /** Câu đã ghép sẵn, có số mục đã duyệt — ví dụ `"12 tường đã duyệt..."`. */
  readonly message: string;
  readonly keepApprovedLabel: string;
  readonly isKeepingApproved: boolean;
  readonly confirmLabel: string;
  readonly dismissLabel: string;
}

export interface PipelineNodePanelViewModel {
  readonly title: string;
  /** Đầu vào của nút đang chọn, mỗi dòng một câu. */
  readonly inputLines: readonly string[];
  readonly parameterRows: readonly PipelineParameterRowViewModel[];
  /** `undefined` khi T-08 chưa báo số đầu ra. */
  readonly outputCountLabel?: string;
  readonly thumbnail?: PipelineThumbnailViewModel;
  readonly logLines: readonly string[];
  readonly isLogOpen: boolean;
  readonly rerunLabel: string;
  /** Có cảnh báo nghĩa là người dùng vừa bấm "Chạy lại từ bước này". */
  readonly rerunWarning?: PipelineRerunWarningViewModel;
  /** Câu nói ra vì sao chưa chạy lại được, khi tầng dữ liệu chưa có lệnh đó. */
  readonly rerunUnavailableLine?: string;
}

export interface PipelineDetailViewModel {
  readonly nodes: readonly PipelineNodeViewModel[];
  readonly selectedNodeId: PipelineNodeId;
  readonly panel: PipelineNodePanelViewModel;
  /** Cạnh chạy nét đứt di chuyển khi đang chạy thật. */
  readonly isRunning: boolean;
  /** Kéo và thu phóng — trạng thái khung nhìn của riêng sơ đồ này. */
  readonly viewport: PipelineViewportViewModel;
}

export interface PipelineViewportViewModel {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
  /** Đã định dạng sẵn — ví dụ `"100%"`. */
  readonly zoomLabel: string;
}

/* -------------------------------------------------------------------------- */
/* Thông báo lỗi.                                                              */
/* -------------------------------------------------------------------------- */

export interface PipelineGraphAlertViewModel {
  readonly title: string;
  readonly message: string;
  /** Mã máy đọc của `APP_ERROR_KIND_CONFIG` — ví dụ `NETWORK`. */
  readonly technicalCode: string;
  readonly retryLabel: string;
}

/* -------------------------------------------------------------------------- */
/* Toàn màn.                                                                   */
/* -------------------------------------------------------------------------- */

export interface PipelineGraphViewModel {
  readonly state: PipelineGraphState;
  readonly mode: PipelineGraphMode;
  readonly title: string;
  /** Câu mở đầu giải thích màn này trả lời câu hỏi gì. */
  readonly leadLine: string;
  readonly overview: PipelineOverviewViewModel;
  /**
   * Chế độ chi tiết. `undefined` nghĩa là người xem **không có quyền** — khối gấp
   * biến mất hẳn chứ không hiện rồi khoá.
   */
  readonly detail?: PipelineDetailViewModel;
  /** Nhãn khối gấp mở chế độ chi tiết. `undefined` khi không có quyền. */
  readonly detailDisclosureLabel?: string;
  /** Câu giải thích vì sao không thấy chế độ chi tiết. */
  readonly forbiddenLine?: string;
  /** Câu nói xử lý vẫn đang tiếp tục, ở trạng thái một phần. */
  readonly partialNoticeLine?: string;
  readonly alert?: PipelineGraphAlertViewModel;
  /** Dưới 1024 thì sơ đồ xếp dọc thành danh sách bước. */
  readonly isCompact: boolean;
  readonly prefersReducedMotion: boolean;
}

export interface PipelineGraphActions {
  readonly onModeChange: (mode: PipelineGraphMode) => void;
  readonly onSelectNode: (nodeId: PipelineNodeId) => void;
  readonly onToggleLog: () => void;
  readonly onRequestRerun: () => void;
  readonly onToggleKeepApproved: () => void;
  readonly onConfirmRerun: () => void;
  readonly onDismissRerun: () => void;
  readonly onRequestSwitchBranch: () => void;
  readonly onConfirmSwitchBranch: () => void;
  readonly onDismissSwitchBranch: () => void;
  readonly onRetry: () => void;
  readonly onPanGraph: (deltaX: number, deltaY: number) => void;
  readonly onZoomGraph: (zoom: number) => void;
  readonly onResetViewport: () => void;
}

/** Màn Sơ đồ xử lý như một hàm của props (mục D). */
export interface PipelineGraphProps {
  readonly model: PipelineGraphViewModel;
  readonly actions: PipelineGraphActions;
}
