/**
 * Dữ liệu mẫu dùng chung cho `ExportPanel.test.tsx` và `ExportPanel.stories.tsx`.
 *
 * Khuôn theo `ruleSettingsFixtures.ts`: số liệu không viết tay tại chỗ mà lấy từ
 * bộ mẫu chuẩn A14 (`SAMPLE_BUILDING` — 4 tầng, 48 tường) và từ chính các module
 * mà `useExportPanel` (chưa tồn tại) sẽ gọi tới — `buildPdfDocument` cho số trang
 * PDF thật, `APP_ERROR_KIND_CONFIG.export` cho mã lỗi thật (R-70).
 *
 * Năm công năng của {@link ExportCapabilities} đều `false` — tầng logic không
 * cung cấp ước tính dung lượng trước khi xuất, lưu lịch sử qua lần tải lại, đổi
 * đơn vị, đặt tên bước theo tầng, hay đính nút tải vào toast. Đây không phải một
 * biến thể theo trạng thái: cả bảy kịch bản dùng ĐÚNG MỘT hằng số
 * {@link FIXED_EXPORT_CAPABILITIES}, vì đây là giới hạn của tầng logic, không
 * phải quyền hạn của người dùng (khác `permissionCaption`, đổi theo `forbidden`).
 */

import { SAMPLE_BUILDING, SAMPLE_ROOM_COUNT } from '@/domain/spatial/__fixtures__/sampleBuilding';
import type { Level } from '@/domain/spatial/types';
import { APP_ERROR_KIND_CONFIG } from '@/lib/errors/kinds';
import { buildPdfDocument } from '@/lib/export/exportPdf';
import { CAPTURE_WIDTH_PX } from '@/lib/export/screenshot';
import { formatFileSize } from '@/lib/format/bytes';
import { formatClockTime } from '@/lib/format/datetime';
import { formatNumber } from '@/lib/format/number';
import { FAKE_CLOCK_START } from '@/lib/testing/fakeClock';
import { VIOLATED_BUILDING_SCENARIO } from '@/lib/testing/fixtures';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';
import { ROUTES } from '@/routes/paths';

import { EXPORT_FORMAT_IDS } from './types';
import type {
  ExportCapabilities,
  ExportedFileRow,
  ExportErrorView,
  ExportFloorChoice,
  ExportFormatCard,
  ExportFormatId,
  ExportOptionsView,
  ExportPanelProps,
  ExportProgressView,
  PreflightRow,
} from './types';

/* ==========================================================================
 * 0. Hằng số chung.
 * ========================================================================== */

/** Id dự án mẫu, dùng để dựng `fixHref` từ `ROUTES`. */
export const SAMPLE_PROJECT_ID = 'P-SAMPLE';

const TIME_ZONE = 'Asia/Ho_Chi_Minh';

const wholeNumber = (value: number): string => formatNumber(value, { fractionDigits: 0, grouping: false });

/* ==========================================================================
 * 1. Bốn định dạng — cột trái.
 * ========================================================================== */

const FORMAT_EXTENSION: Readonly<Record<ExportFormatId, string>> = {
  glb: '.glb',
  image: '.png',
  pdf: '.pdf',
  'spatial-json': '.json',
};

/** Mỗi định dạng nói rõ dành cho ai, bằng tiếng thường — không thêm định dạng thứ năm. */
const FORMAT_AUDIENCE_SENTENCE: Readonly<Record<ExportFormatId, string>> = {
  glb: 'dành cho ai cần mở mô hình 3D trong phần mềm dựng hình khác.',
  image: 'dành cho ai cần một ảnh chụp nhanh để trình bày.',
  pdf: 'dành cho ai cần in hoặc gửi hồ sơ kiểm tra bản vẽ.',
  'spatial-json': 'dành cho ai cần dữ liệu thô để tích hợp vào hệ thống khác.',
};

/** Số trang PDF THẬT, đếm từ `buildPdfDocument` trên bộ mẫu chuẩn — không viết tay (R-70). */
export const SAMPLE_PDF_PAGE_COUNT = buildPdfDocument({
  exportedAt: FAKE_CLOCK_START,
  graph: SAMPLE_BUILDING,
  preparer: { name: 'Đội kiểm tra chất lượng' },
  sections: ['levelSummary', 'roomAreas', 'violations'],
  timeZone: TIME_ZONE,
  dataVersion: 'v-mau',
  violations: VIOLATED_BUILDING_SCENARIO.violations,
}).pages.length;

function buildFormatCard(id: ExportFormatId, overrides: Partial<ExportFormatCard> = {}): ExportFormatCard {
  return {
    id,
    extensionLabel: FORMAT_EXTENSION[id],
    audienceSentence: FORMAT_AUDIENCE_SENTENCE[id],
    // canEstimateSize là false trong mọi kịch bản — không có dòng ước tính dung
    // lượng nào trước khi xuất, ở bất cứ định dạng nào.
    sizeLabel: null,
    sizeState: 'unavailable',
    pageCountLabel: id === 'pdf' ? `${wholeNumber(SAMPLE_PDF_PAGE_COUNT)} trang` : null,
    isSelected: id === 'glb',
    ...overrides,
  };
}

/** Đủ bốn thẻ định dạng, đúng thứ tự `EXPORT_FORMAT_IDS`. */
export const DEFAULT_FORMATS: readonly ExportFormatCard[] = EXPORT_FORMAT_IDS.map((id) => buildFormatCard(id));

/* ==========================================================================
 * 2. Phạm vi — chọn nhiều tầng, từ chính `SAMPLE_BUILDING`.
 * ========================================================================== */

function toFloorChoice(level: Level, overrides: Partial<ExportFloorChoice> = {}): ExportFloorChoice {
  return {
    id: level.id,
    name: level.name,
    order: level.order,
    isSelected: true,
    isApproved: level.reviewed,
    ...overrides,
  };
}

/** Bốn tầng thật của `SAMPLE_BUILDING`, đã sắp theo `order`. Mọi tầng đã duyệt (A14). */
export const DEFAULT_FLOORS: readonly ExportFloorChoice[] = SAMPLE_BUILDING.levels
  .slice()
  .sort((left, right) => left.order - right.order)
  .map((level) => toFloorChoice(level));

/**
 * Bản sao `DEFAULT_FLOORS` với tầng đầu tiên đổi thành CHƯA DUYỆT — vẫn chọn
 * được, chỉ khác `isApproved`. Dùng cho test "tầng chưa duyệt vẫn chọn được".
 */
export function floorsWithOneUnapproved(): readonly ExportFloorChoice[] {
  const [first, ...rest] = DEFAULT_FLOORS;

  if (first === undefined) {
    throw new Error('DEFAULT_FLOORS rỗng — SAMPLE_BUILDING.levels lỗi');
  }

  return [{ ...first, isApproved: false, isSelected: true }, ...rest];
}

/* ==========================================================================
 * 3. Tuỳ chọn theo từng định dạng.
 * ========================================================================== */

export const DEFAULT_OPTIONS: ExportOptionsView = {
  glb: { detail: 'high', includeFurniture: true, includeAxisGrid: true },
  pdf: { includeFloorPlans: true, includeRoomTable: true, includeViolations: true, includeRender3d: false },
  image: { viewId: 'viewer-3d-front', widthLabel: `${wholeNumber(CAPTURE_WIDTH_PX)} px` },
  spatialJson: { includeConfidence: true },
  isExpanded: false,
};

/* ==========================================================================
 * 4. Công năng — cố định, không đổi theo trạng thái (xem docblock đầu file).
 * ========================================================================== */

export const FIXED_EXPORT_CAPABILITIES: ExportCapabilities = {
  canEstimateSize: false,
  canPersistHistory: false,
  canChooseUnit: false,
  canNameFloorStep: false,
  canPutDownloadInToast: false,
};

/* ==========================================================================
 * 5. Khối "Kiểm tra trước khi xuất" — CHỈ THÔNG TIN, KHÔNG BAO GIỜ CHẶN.
 * ========================================================================== */

const APPROVAL_OK_LABEL = 'Toàn bộ mô hình đã được người dùng duyệt.';
const UNREVIEWED_OK_LABEL = 'Không còn đối tượng nào do AI phát hiện mà chưa xem qua.';

/** Số vi phạm THẬT của bộ mẫu "toà nhà có lỗi" — không viết tay (R-70). */
export const SAMPLE_VIOLATION_COUNT = VIOLATED_BUILDING_SCENARIO.violations.length;

/** Ba dòng, không dòng nào chặn nút "Xuất" — đúng dòng còn vi phạm. */
export function buildPreflightWithViolations(): readonly PreflightRow[] {
  return [
    { id: 'approval', label: APPROVAL_OK_LABEL, tone: 'ok', fixHref: null },
    {
      id: 'violations',
      label: `Còn ${wholeNumber(SAMPLE_VIOLATION_COUNT)} vi phạm chưa xử lý.`,
      tone: 'attention',
      fixHref: ROUTES.project.rules(SAMPLE_PROJECT_ID),
    },
    { id: 'unreviewed', label: UNREVIEWED_OK_LABEL, tone: 'ok', fixHref: null },
  ];
}

/** Ba dòng, tất cả "ok" — dự án sạch, không có gì cần chú ý. */
export function buildCleanPreflight(): readonly PreflightRow[] {
  return [
    { id: 'approval', label: APPROVAL_OK_LABEL, tone: 'ok', fixHref: null },
    { id: 'violations', label: 'Không còn vi phạm nào chưa xử lý.', tone: 'ok', fixHref: null },
    { id: 'unreviewed', label: UNREVIEWED_OK_LABEL, tone: 'ok', fixHref: null },
  ];
}

/* ==========================================================================
 * 6. Tiến trình THẬT — chỉ khác `null` khi đang xuất.
 * ========================================================================== */

/** Dịch từ hai pha thật của `ExportPhase` (`glb.worker.ts`): "build" / "encode". */
export const BUILD_STEP_LABEL = 'đang dựng hình';
export const ENCODE_STEP_LABEL = 'đang mã hoá';

export function buildSampleProgress(overrides: Partial<ExportProgressView> = {}): ExportProgressView {
  const completed = 8;
  const total = SAMPLE_ROOM_COUNT;

  return {
    formatId: 'glb',
    stepLabel: BUILD_STEP_LABEL,
    countLabel: `${wholeNumber(completed)}/${wholeNumber(total)} phòng`,
    ratio: completed / total,
    ...overrides,
  };
}

/* ==========================================================================
 * 7. Tệp đã xuất.
 * ========================================================================== */

export function buildSampleExportedFile(overrides: Partial<ExportedFileRow> = {}): ExportedFileRow {
  return {
    id: 'EXPORT-0001',
    fileName: 'chung-cu-hoang-anh_toan-bo.glb',
    sizeLabel: formatFileSize(5_242_880),
    momentLabel: formatClockTime(FAKE_CLOCK_START, { timeZone: TIME_ZONE }),
    formatId: 'glb',
    ...overrides,
  };
}

/* ==========================================================================
 * 8. Lỗi — mã thật từ `APP_ERROR_KIND_CONFIG.export` (chữ đều).
 * ========================================================================== */

export const SAMPLE_EXPORT_ERROR: ExportErrorView = {
  message: 'Xuất dữ liệu chưa xong. Kiểm tra tệp đích rồi thử lại.',
  code: APP_ERROR_KIND_CONFIG.export.code,
  hint: 'Giảm mức chi tiết trong mục Tuỳ chọn rồi thử lại, hoặc chọn ít tầng hơn.',
};

/* ==========================================================================
 * 9. Câu chú thích dùng chung.
 * ========================================================================== */

export const DESTINATION_CAPTION = 'Tệp xuất sẽ lưu vào thư mục Tải xuống trên máy bạn.';
export const PARTIAL_NOTICE_CAPTION = 'Đang xuất bản vẽ — đừng đóng tab này.';
export const FORBIDDEN_PERMISSION_CAPTION = 'Chỉ chủ dự án hoặc thành viên được mời mới xuất được bản vẽ này.';

/* ==========================================================================
 * 10. Hành động không làm gì — mỗi test tự ghi đè bằng `vi.fn()` khi cần.
 * ========================================================================== */

/** Bảy hành động view phát ra, tách riêng khỏi phần dữ liệu của props. */
export type ExportPanelActionHandlers = Pick<
  ExportPanelProps,
  | 'onSelectFormat'
  | 'onToggleFloor'
  | 'onChangeOptions'
  | 'onToggleOptionsExpanded'
  | 'onExport'
  | 'onCancel'
  | 'onRetry'
  | 'onDownload'
  | 'onFollowFix'
>;

export const NOOP_EXPORT_PANEL_ACTIONS: ExportPanelActionHandlers = {
  onSelectFormat: () => undefined,
  onToggleFloor: () => undefined,
  onChangeOptions: () => undefined,
  onToggleOptionsExpanded: () => undefined,
  onExport: () => undefined,
  onCancel: () => undefined,
  onRetry: () => undefined,
  onDownload: () => undefined,
  onFollowFix: () => undefined,
};

/* ==========================================================================
 * 11. Props mặc định theo từng trạng thái trong bảy trạng thái (A11).
 * ========================================================================== */

/** Phần dữ liệu của `ExportPanelProps`, mọi thứ trừ `status` và bảy hành động. */
export type ExportPanelDataOverrides = Partial<Omit<ExportPanelProps, 'status' | keyof ExportPanelActionHandlers>>;

function dataDefaultsForStatus(
  status: SevenState,
): Omit<ExportPanelProps, 'status' | 'capabilities' | keyof ExportPanelActionHandlers> {
  const base = {
    formats: DEFAULT_FORMATS,
    floors: DEFAULT_FLOORS,
    options: DEFAULT_OPTIONS,
    preflight: buildCleanPreflight(),
    exportedFiles: [] as readonly ExportedFileRow[],
    progress: null as ExportProgressView | null,
    error: null as ExportErrorView | null,
    destinationCaption: DESTINATION_CAPTION,
    noticeCaption: null as string | null,
    permissionCaption: null as string | null,
    isCollapsed: false,
  };

  switch (status) {
    case 'empty':
      // Dự án chưa có tầng nào — chưa có gì để xuất, nhưng bốn thẻ định dạng
      // vẫn hiện (chúng không phụ thuộc dữ liệu dự án).
      return { ...base, floors: [] };
    case 'loading':
      // Ngưỡng "không trắng" của expectSevenStates là khung xương — không cần
      // dữ liệu thật ở khung hình này.
      return { ...base, floors: [], exportedFiles: [] };
    case 'partial':
      // "một phần" = đang xuất giữa chừng (giống RuleSettings dùng "một phần"
      // cho "đang lưu"): tiến trình THẬT khác null, có tệp đã xuất từ trước.
      return {
        ...base,
        progress: buildSampleProgress(),
        exportedFiles: [buildSampleExportedFile()],
        noticeCaption: PARTIAL_NOTICE_CAPTION,
      };
    case 'error':
      return { ...base, error: SAMPLE_EXPORT_ERROR };
    case 'success':
      return {
        ...base,
        preflight: buildPreflightWithViolations(),
        exportedFiles: [buildSampleExportedFile()],
      };
    case 'forbidden':
      return {
        ...base,
        floors: [],
        formats: DEFAULT_FORMATS.map((format) => ({ ...format, isSelected: false })),
        permissionCaption: FORBIDDEN_PERMISSION_CAPTION,
      };
    case 'collapsed':
      return { ...base, isCollapsed: true };
    default:
      return base;
  }
}

/**
 * Một `ExportPanelProps` hợp lệ cho một trong bảy trạng thái, cộng hàm phủ
 * từng phần cho dữ liệu (`overrides`) và cho hành động (`actionOverrides`) —
 * đúng khuôn `buildRuleSettingsProps`.
 */
export function buildExportPanelProps(
  status: SevenState,
  overrides: ExportPanelDataOverrides = {},
  actionOverrides: Partial<ExportPanelActionHandlers> = {},
): ExportPanelProps {
  return {
    status,
    capabilities: FIXED_EXPORT_CAPABILITIES,
    ...dataDefaultsForStatus(status),
    ...overrides,
    ...NOOP_EXPORT_PANEL_ACTIONS,
    ...actionOverrides,
  };
}
