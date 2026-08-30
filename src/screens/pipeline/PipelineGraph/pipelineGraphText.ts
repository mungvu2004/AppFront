/**
 * Mọi câu tiếng Việt của màn Sơ đồ xử lý, gom về một chỗ.
 *
 * Không phải bảng dịch lúc chạy — `src/i18n/vi.json` cũng không phải (xem
 * CLAUDE.md). Đây là chỗ hook lấy chuỗi để ghép vào view model, và là bản đối
 * chiếu một-một với khoá `pipelineGraph` của `vi.json` mà `expectVietnamese`
 * dùng làm từ điển (R-67).
 *
 * Tên thư viện kỹ thuật (`SegFormer MIT-B5`, `YOLOv8m`, `PaddleOCR`,
 * `Zhang-Suen`, `Douglas-Peucker`, `distanceTransform L2`) nằm ở
 * {@link PipelineNodeText.technicalLabel} chứ **không** trộn vào `name`. Hai lý
 * do, cả hai đều là luật: mục [CẤM TUYỆT ĐỐI] của đặc tả cấm chúng xuất hiện ở
 * chế độ Tổng quan, và view vẽ `technicalLabel` trong `<code>` — thẻ mà
 * `expectVietnamese` bỏ qua, đúng như nó bỏ qua `Ctrl` và `Esc`.
 */

import type {
  PipelineBranchId,
  PipelineNodeId,
  PipelineNodeStatus,
  PipelineOverviewBlockViewModel,
} from './types';

export interface PipelineNodeText {
  /** Tiếng Việt, kiểu câu. */
  readonly name: string;
  /** Tên thư viện hoặc thuật toán, viết nguyên văn. */
  readonly technicalLabel?: string;
  /** Công thức, viết bằng chữ đều. */
  readonly formula?: string;
  /** Các hàng con hiện ngay trong nút. */
  readonly subRows: readonly string[];
}

/** Chín nút của sơ đồ kỹ thuật, đúng thứ tự đặc tả nêu. */
export const PIPELINE_NODE_TEXT: Readonly<Record<PipelineNodeId, PipelineNodeText>> = {
  sourceImage: {
    name: 'Ảnh gốc',
    subRows: [],
  },
  preprocess: {
    name: 'Tiền xử lý',
    subRows: [
      'chuyển xám',
      'làm mờ Gauss',
      'dò cạnh Canny',
      'tìm đường biên',
      'nắn phối cảnh 3000×3000',
    ],
  },
  wallSegmentation: {
    name: 'Phân vùng tường',
    technicalLabel: 'SegFormer MIT-B5',
    subRows: [],
  },
  objectDetection: {
    name: 'Nhận diện đối tượng',
    technicalLabel: 'YOLOv8m',
    subRows: [],
  },
  dimensionReading: {
    name: 'Đọc kích thước',
    technicalLabel: 'PaddleOCR',
    subRows: [],
  },
  thicknessExtraction: {
    name: 'Trích xuất độ dày',
    technicalLabel: 'distanceTransform L2',
    formula: 'W_pixel = 2 × Distance_max',
    subRows: [],
  },
  simplify: {
    name: 'Làm mỏng và đơn giản hoá',
    technicalLabel: 'Zhang-Suen · Douglas-Peucker',
    subRows: [],
  },
  thicknessNormalise: {
    name: 'Chuẩn hoá độ dày',
    subRows: ['quy về 110 / 220 / 330 mm', 'hoặc nhận là cột bê tông'],
  },
  spatialJson: {
    name: 'Dựng dữ liệu không gian',
    technicalLabel: 'Spatial JSON',
    subRows: [],
  },
};

/**
 * Năm khối của sơ đồ Tổng quan: tệp đầu vào → hai nhánh → hợp lại → dựng 3D.
 *
 * Không một tên thư viện kỹ thuật nào ở đây, và đó là chủ ý: đây là màn tạo niềm
 * tin, không phải màn gỡ lỗi.
 */
export const PIPELINE_OVERVIEW_BLOCKS: readonly PipelineOverviewBlockViewModel[] = [
  {
    id: 'input',
    label: 'Tệp đầu vào',
    caption: 'bản vẽ kiến trúc của hồ sơ',
    column: 0,
    row: 1,
    edgeTargets: ['cad', 'ai'],
  },
  {
    id: 'cad',
    label: 'Nhánh tệp CAD',
    caption: 'đường hình học đọc thẳng từ tệp',
    column: 1,
    row: 0,
    edgeTargets: ['merge'],
    branch: 'cad',
  },
  {
    id: 'ai',
    label: 'Nhánh ảnh quét',
    caption: 'sáu bước nhận dạng chạy trên ảnh',
    column: 1,
    row: 2,
    edgeTargets: ['merge'],
    branch: 'ai',
  },
  {
    id: 'merge',
    label: 'Dữ liệu không gian đa tầng',
    caption: 'hai nhánh hợp lại ở một tệp duy nhất',
    column: 2,
    row: 1,
    edgeTargets: ['model'],
  },
  {
    id: 'model',
    label: 'Dựng mô hình 3D',
    caption: 'mặt bằng và khối nhà dựng từ tệp đó',
    column: 3,
    row: 1,
    edgeTargets: [],
  },
];

/** Mọi câu còn lại của màn. */
export const PIPELINE_GRAPH_TEXT = {
  title: 'Sơ đồ xử lý',
  leadLine:
    'Hồ sơ này đi qua nhánh nào, và vì sao hệ thống chọn nhánh đó cho từng tầng.',

  branchOrder: ['cad', 'ai'] as readonly PipelineBranchId[],
  branchLabels: {
    cad: 'Nhánh tệp CAD',
    ai: 'Nhánh ảnh quét',
  } as Readonly<Record<PipelineBranchId, string>>,
  activeBadge: 'đang dùng',

  reasonByBranch: {
    cad: 'Hồ sơ có tệp CAD còn nguyên lớp, nên đường hình học lấy thẳng từ tệp thay vì dò lại bằng ảnh.',
    ai: 'Hồ sơ chỉ có bản quét, nên mỗi tầng đi qua sáu bước nhận dạng rồi mới hợp lại.',
  } as Readonly<Record<PipelineBranchId, string>>,
  reasonUnknown:
    'Mỗi tầng đang đi một nhánh khác nhau, nên chưa có một câu trả lời chung cho cả hồ sơ.',

  statusLabels: {
    queued: 'chờ chạy',
    running: 'đang chạy',
    done: 'đã xong',
    failed: 'hỏng',
  } as Readonly<Record<PipelineNodeStatus, string>>,

  comparisonCaption: 'So sánh hai nhánh',
  comparisonAspectHeader: 'Mặt so sánh',
  evidenceCaption: 'Dẫn chứng theo tầng',
  evidenceFloorHeader: 'Tầng',
  evidenceReasonHeader: 'Vì sao chọn nhánh này',

  switchLabel: 'Đổi sang nhánh ảnh quét',
  switchWarningTitle: 'Việc này không hoàn tác được',
  switchWarningMessage:
    'Đổi nhánh sẽ bỏ toàn bộ kết quả đang có của hồ sơ và chạy lại từ đầu bằng ảnh quét.',
  switchConfirmLabel: 'Xác nhận đổi nhánh',
  dismissLabel: 'Giữ nguyên',

  detailDisclosureLabel: 'Chi tiết kỹ thuật',
  detailGraphAriaLabel: 'Sơ đồ các bước xử lý',
  detailPanelAriaLabel: 'Chi tiết bước đang chọn',
  detailStepListAriaLabel: 'Danh sách các bước xử lý',

  panelInputHeader: 'Đầu vào',
  panelParameterHeader: 'Tham số',
  panelOutputHeader: 'Số đầu ra',
  panelThumbnailHeader: 'Ảnh của bước',
  panelLogLabel: 'Nhật ký',
  thumbnailAltPrefix: 'Ảnh trung gian của bước ',
  defaultOutputUnit: 'đối tượng',
  unknownValue: 'chưa có số liệu',

  rerunLabel: 'Chạy lại từ bước này',
  rerunWarningTitle: 'Chạy lại sẽ động vào việc đã duyệt',
  rerunWarningMessage: (approvedCount: string, nodeName: string): string =>
    `Chạy lại từ bước ${nodeName} sẽ dựng lại ${approvedCount} tường đã duyệt. Giữ lại phần đã duyệt thì các tường đó không bị ghi đè.`,
  keepApprovedLabel: 'Giữ lại phần đã duyệt',
  rerunConfirmLabel: 'Xác nhận chạy lại',
  rerunUnavailableLine:
    'Chưa phát được lệnh chạy lại: tầng dữ liệu chưa có đường gọi cho việc này.',

  zoomInLabel: 'Phóng to sơ đồ',
  zoomOutLabel: 'Thu nhỏ sơ đồ',
  zoomResetLabel: 'Về tỷ lệ gốc',

  emptyTitle: 'Chưa có lượt xử lý nào để kể lại',
  emptyDescription: 'Khi một bản vẽ được đưa vào xử lý, sơ đồ và nhánh đã chọn sẽ hiện ở đây.',
  partialNotice: 'Xử lý vẫn đang chạy, nên vài bước còn chưa có kết quả cuối.',
  forbiddenLine:
    'Chế độ chi tiết kỹ thuật chỉ mở cho vai quản trị, nên phần đó và nút đổi nhánh không hiện ở đây.',
  retryLabel: 'Thử lại',
} as const;
