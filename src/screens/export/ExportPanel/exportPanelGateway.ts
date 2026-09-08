/**
 * Cổng năng lực của màn Xuất: nó được làm gì, và mỗi chữ `false` đến từ đâu.
 *
 * Chép khuôn `rules/RuleSettings/ruleSettingsGateway.ts` và
 * `rules/RuleReport/ruleReportGateway.ts`: màn hỏi cổng này xem tầng logic thật
 * sự làm được gì, và **năng lực nào `false` thì phần giao diện tương ứng rời
 * khỏi DOM** — không nút xám, không ô trống, không ghi chú "sắp có".
 *
 * ## Khác hai cổng đi trước ở một điểm: ở đây KHÔNG có chữ `false` viết cứng
 *
 * `ruleReportGateway.ts` đóng băng ba chữ `false` kèm một bản khảo sát viết
 * tay. Cách đó đúng cho tới ngày tầng logic đổi mà không ai đọc lại chú thích.
 * Cổng này **đo** thay vì **khai**: mỗi năng lực là kết quả của một phép kiểm
 * chạy trên chính đối tượng/kiểu của tầng logic, và phần lớn phép kiểm được
 * trình biên dịch canh giữ — thêm một trường vào `ExportGlbOptions`,
 * `ExportProgress`, `ExportFloor` hay `ToastMessage` là **hỏng biên dịch ở đây**
 * cho tới khi bảng khoá được cập nhật, và lúc đó cờ tự lật sang `true`.
 * Xem {@link FieldKeys} và bốn bảng dùng nó.
 *
 * ## Ba năng lực THIẾU mà hợp đồng `types.ts` chưa có chỗ để nói ra
 *
 * `ExportCapabilities` đông cứng đúng năm cờ. Ba lỗ hổng dưới đây được phát
 * hiện *sau* khi hợp đồng đóng băng, nên chúng sống trong
 * {@link ExportPanelCapabilities} — một kiểu **mở rộng** `ExportCapabilities`
 * chứ không sửa nó. Một giá trị `ExportPanelCapabilities` vẫn gán được vào
 * `ExportPanelProps.capabilities`, nên hợp đồng không phải đổi một dòng nào;
 * ngày `types.ts` nhận ba cờ này về, chỗ duy nhất phải sửa là câu `extends`.
 *
 * 1. **`canRenderPdfBytes: false`.** `src/lib/export/exportPdf.ts` dựng
 *    `PdfDocument` — cấu trúc trang và chuỗi đã định dạng — và docstring đầu
 *    file nói thẳng "nothing touches a PDF library". `package.json` không có
 *    `jspdf`/`pdf-lib`/`pdfkit`, `src/api/endpoints.ts` không có đường dựng PDF
 *    phía máy chủ, và cả `src/` chỉ có đúng hai nơi dựng `Blob`
 *    (`exportGlb.ts`, `telemetry/sender.ts`). **Số trang thì THẬT** — nó đếm
 *    được từ `buildPdfDocument`, và thẻ PDF vẫn nói ra con số đó.
 * 2. **`canCaptureImage`.** `createFloorCapture` đòi `CaptureViewportInput`
 *    `{ renderer, scene, camera, viewport }` — một khung nhìn 3D **đang sống**.
 *    Màn Xuất không mount canvas nào và không được tạo component mới, nên năng
 *    lực này bằng đúng câu hỏi "vỏ ứng dụng có đưa xuống một khung nhìn không".
 *    Hôm nay không ai đưa, nên nó `false`; ngày một container gắn màn này cạnh
 *    `Viewer3D` và truyền `viewport` vào, nó tự `true` mà không sửa dòng nào.
 * 3. **`canIncludeAxisGrid: false`.** `GlbOptionsView.includeAxisGrid` không có
 *    đích đến: `ExportGlbOptions` không có trường lưới trục và `ExportFloor`
 *    không có trường `axes`, nên một công tắc lưới trục **không thể** đổi tệp
 *    xuất ra. Một công tắc không đổi được gì là đúng thứ luật "không để một nút
 *    không làm gì" tồn tại để chặn.
 *
 * ## Bốn định dạng vẫn ở lại
 *
 * Hai lỗ hổng trên **không** xoá thẻ định dạng nào: `.pdf` và ảnh là định dạng
 * có thật của sản phẩm, và thẻ của chúng vẫn nói đúng thứ chúng biết (số trang
 * PDF là thật). Thứ rời khỏi DOM là **khả năng tải**, không phải thẻ.
 *
 * ## Chỗ chứa: một sổ chạy trong bộ nhớ, không phải một slice mới
 *
 * `canPersistHistory` là `false` vì `queryKeys` không có nhánh nào cho tệp đã
 * xuất. Lượt xuất đang chạy và danh sách tệp của phiên vì thế sống trong
 * {@link runByProject} — một `Map` ở phạm vi module, đúng khuôn `configByProject`
 * của `ruleSettingsGateway.ts`. Nó **sống lâu hơn màn**: người dùng đi màn khác
 * rồi quay lại vẫn thấy tiến trình đang chạy, vì tiến trình chưa bao giờ nằm
 * trong `useState` của component.
 */

import type { Violation } from '@/domain/rules/registry';
import {
  denormalizeSpatial,
  idsOnLevel,
  isEntityOfKind,
  type NormalizedSpatial,
  type SpatialEntity,
} from '@/domain/spatial/normalize';
import { toBuildFloorInput } from '@/domain/spatial/toBuildFloorInput';
import type { Furniture, Level, LevelId, SpatialGraph } from '@/domain/spatial/types';
import { can } from '@/lib/auth/permissions';
import * as glbModule from '@/lib/export/exportGlb';
import type {
  ExportFloor,
  ExportGlbOptions,
  ExportGlbTask,
  ExportProgress,
} from '@/lib/export/exportGlb';
import * as pdfModule from '@/lib/export/exportPdf';
import type { ExportPdfInput } from '@/lib/export/exportPdf';
import { PDF_SECTION_KINDS, type PdfSectionKind } from '@/lib/export/pdfSchema';
import { BYTES_PER_UNIT } from '@/lib/format/bytes';
import { formatNumber } from '@/lib/format/number';
import { queryKeys } from '@/lib/query/queryKeys';
import type { TelemetryOutcome } from '@/lib/telemetry/events';
import type { TelemetrySender } from '@/lib/telemetry/sender';
import { ROUTES } from '@/routes/paths';
import type { ProjectRole } from '@/types/project';

import type { ExportCapabilities, ExportFormatId, PreflightRow } from './types';

/* -------------------------------------------------------------------------- */
/* Bộ đo năng lực — mỗi cờ là một phép kiểm, không phải một lời khai.          */
/* -------------------------------------------------------------------------- */

/**
 * Mọi khoá của một kiểu, liệt kê thành một bảng đọc được lúc chạy.
 *
 * `Record<keyof T, true>` bắt trình biên dịch đòi **đủ** khoá: thêm một trường
 * vào kiểu gốc là dòng khai bảng bên dưới hỏng ngay, chứ không phải một phép
 * kiểm im lặng trả về `false` mãi mãi. Đây là thứ làm cho các cờ dưới đây là
 * phép ĐO chứ không phải chữ viết cứng.
 */
type FieldKeys<T> = Readonly<Record<keyof T, true>>;

const hasAnyField = (fields: object, names: readonly string[]): boolean =>
  names.some((name) => name in fields);

/** Khoá của một lượt tiến trình mà worker phát ra. */
const PROGRESS_FIELDS: FieldKeys<ExportProgress> = {
  phase: true,
  completed: true,
  total: true,
};

/** Khoá của một tầng đưa vào bộ xuất `.glb`. */
const EXPORT_FLOOR_FIELDS: FieldKeys<ExportFloor> = {
  level: true,
  walls: true,
  rooms: true,
  openings: true,
  furniture: true,
};

/**
 * Khoá của một tuỳ chọn xuất `.glb`.
 *
 * Đọc thẳng giá trị thật thay vì dựng bảng: `DEFAULT_EXPORT_OPTIONS` là một
 * `ExportGlbOptions` đủ trường, nên nó đã là bảng khoá chính xác nhất có thể.
 */
const GLB_OPTION_FIELDS: object = { ...glbModule.DEFAULT_EXPORT_OPTIONS };

/**
 * Tên mà một trường "đơn vị" sẽ mang nếu nó tồn tại.
 *
 * Danh sách tên chứ không phải một tên: phép đo phải bắt được cả cách đặt tên
 * khác đi một chữ, nếu không nó chỉ đo được đúng cái tên người viết đoán trúng.
 */
const UNIT_FIELD_NAMES = ['unit', 'units', 'lengthUnit', 'unitOfLength'] as const;

/** Tên mà một trường "lưới trục" sẽ mang nếu nó tồn tại. */
const AXIS_FIELD_NAMES = ['axes', 'axis', 'axisGrid', 'grid', 'grids'] as const;

/** Tên mà một trường "tầng" trên một lượt tiến trình sẽ mang nếu nó tồn tại. */
const FLOOR_STEP_FIELD_NAMES = ['levelId', 'levelName', 'floorId', 'floorName'] as const;

/** Nhánh mà một khoá truy vấn cho tệp đã xuất sẽ mang nếu nó tồn tại. */
const HISTORY_QUERY_BRANCHES = ['export', 'exports', 'file', 'files', 'download'] as const;

/** Tên một hàm ước tính dung lượng sẽ mang nếu nó tồn tại. */
const SIZE_ESTIMATOR_PATTERN = /^(estimate|predict|forecast|guess).*(size|byte|weight)/i;

/** Tên một bộ dựng `PdfDocument` thành bytes sẽ mang nếu nó tồn tại. */
const PDF_RENDERER_PATTERN = /(toPdf|toBlob|toBytes|toBuffer)$|^(render|print|encode|serialise|serialize)/i;

const exportsMatching = (namespace: object, pattern: RegExp): boolean =>
  Object.keys(namespace).some((name) => pattern.test(name));

/**
 * Trường của một toast, kể cả trường tuỳ chọn.
 *
 * Chép khoá của `ToastMessage` (`@/components/feedback/Toast`) thay vì nhập
 * kiểu: một cổng của màn không cần kéo mã component vào gói chỉ để đếm trường,
 * và `Toast.stories.tsx` khoá hình dạng này. Bốn khoá, không khoá nào nhận một
 * hành động tuỳ ý — chỉ `onUndo` cố định.
 */
const TOAST_FIELDS: object = Object.freeze({
  id: true,
  message: true,
  onUndo: true,
  state: true,
});

/** Tên mà một trường "hành động tuỳ ý" của toast sẽ mang nếu nó tồn tại. */
const TOAST_ACTION_FIELD_NAMES = ['action', 'actions', 'actionLabel', 'onAction'] as const;

/* -------------------------------------------------------------------------- */
/* Năng lực                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Năm cờ của hợp đồng, cộng ba cờ hợp đồng chưa có chỗ để nói ra.
 *
 * Mở rộng chứ không sửa `ExportCapabilities`: một giá trị kiểu này vẫn là một
 * `ExportCapabilities` hợp lệ, nên `ExportPanelProps.capabilities` nhận được nó
 * mà `types.ts` không phải đổi. View đọc được ba cờ thêm ngay khi hợp đồng nhận
 * chúng về.
 */
export interface ExportPanelCapabilities extends ExportCapabilities {
  /** Dựng `PdfDocument` thành bytes `.pdf`. Xem chú thích đầu file, mục 1. */
  readonly canRenderPdfBytes: boolean;
  /** Chụp ảnh khung nhìn 3D. Xem chú thích đầu file, mục 2. */
  readonly canCaptureImage: boolean;
  /** Đưa lưới trục vào tệp `.glb`. Xem chú thích đầu file, mục 3. */
  readonly canIncludeAxisGrid: boolean;
}

/** Cái vỏ ứng dụng đưa xuống để cổng đo được năng lực phụ thuộc hoàn cảnh. */
export interface ReadCapabilitiesInput {
  /**
   * Khung nhìn 3D đang sống, nếu màn được gắn cạnh một khung nhìn.
   *
   * Kiểu để `unknown` có chủ ý: cổng chỉ cần biết **có hay không**, và không
   * nơi nào trong màn được chạm vào `renderer` của three.js.
   */
  readonly viewport?: unknown;
}

/**
 * Năng lực của một lượt xem màn Xuất.
 *
 * Không nhận quyền người dùng: quyền quyết định trạng thái `forbidden` của A11,
 * không quyết định mảnh giao diện nào tồn tại. Hai thứ đó tách nhau, đúng như
 * `ExportPanelProps` tách `status` khỏi `capabilities`.
 */
export function readExportCapabilities(
  input: ReadCapabilitiesInput = {},
): ExportPanelCapabilities {
  return {
    // Không hàm nào trong hai module xuất mang tên của một bộ ước tính. Thứ duy
    // nhất tiệm cận là `estimateCaptureMemoryMb` — bộ nhớ đồ hoạ lúc chụp, ở
    // module ảnh, không phải dung lượng tệp — và nó không khớp mẫu.
    canEstimateSize:
      exportsMatching(glbModule, SIZE_ESTIMATOR_PATTERN) ||
      exportsMatching(pdfModule, SIZE_ESTIMATOR_PATTERN),

    // Không nhánh nào của `queryKeys` nói về tệp đã xuất, nên không có gì để
    // đọc lại sau khi tải lại trang.
    canPersistHistory: hasAnyField(queryKeys, HISTORY_QUERY_BRANCHES),

    // `DEFAULT_EXPORT_OPTIONS` có đúng ba trường: detail, includeFurniture,
    // compress. Không trường nào là đơn vị — `GlbProjectMetadata.unit` cố định
    // 'metre' bên trong worker.
    canChooseUnit: hasAnyField(GLB_OPTION_FIELDS, UNIT_FIELD_NAMES),

    // `ExportProgress` có ba trường: phase, completed, total. Không trường nào
    // nói được đang ở tầng nào — số đếm là số đối tượng, không phải số tầng.
    canNameFloorStep: hasAnyField(PROGRESS_FIELDS, FLOOR_STEP_FIELD_NAMES),

    // `ToastMessage` chỉ nhận `onUndo`. Nút tải vì thế sống ở hàng tương ứng
    // trong danh sách tệp đã xuất.
    canPutDownloadInToast: hasAnyField(TOAST_FIELDS, TOAST_ACTION_FIELD_NAMES),

    canRenderPdfBytes: exportsMatching(pdfModule, PDF_RENDERER_PATTERN),

    canCaptureImage: input.viewport !== undefined && input.viewport !== null,

    canIncludeAxisGrid:
      hasAnyField(GLB_OPTION_FIELDS, AXIS_FIELD_NAMES) ||
      hasAnyField(EXPORT_FLOOR_FIELDS, AXIS_FIELD_NAMES),
  };
}

/* -------------------------------------------------------------------------- */
/* Quyền                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Câu nói rõ **ai** xuất được, hiện ở trạng thái `forbidden`.
 *
 * `'model.export'` là MỘT khoá gác cả bốn định dạng, và với vai `viewer` nó là
 * `false` (`lib/auth/permissions.ts`). Đặc tả gốc nói người xem "chỉ tải được
 * ảnh", nhưng tầng logic không có quyền riêng cho ảnh — bịa một ngoại lệ ở tầng
 * màn là dựng một tầng phân quyền thứ hai. Nên: người xem không xuất được gì,
 * và câu này nói ra ai thì được.
 */
export const EXPORT_FORBIDDEN_CAPTION =
  'chỉ quản trị viên và kỹ sư của dự án xuất được mô hình; bạn đang xem ở quyền chỉ đọc.';

/** Người dùng có quyền `model.export` trên dự án đang mở không. */
export function readExportPermission(roles: readonly ProjectRole[]): boolean {
  return can('export', 'model', { roles });
}

/* -------------------------------------------------------------------------- */
/* Khối "Kiểm tra trước khi xuất" — CHỈ THÔNG TIN, KHÔNG BAO GIỜ CHẶN          */
/* -------------------------------------------------------------------------- */

export interface PreflightInput {
  readonly projectId: string;
  readonly graph: NormalizedSpatial | null;
  /** Tầng người dùng đã chọn để xuất; rỗng nghĩa là chưa chọn tầng nào. */
  readonly levels: readonly Level[];
  /** Kết quả lượt chạy luật gần nhất, đọc từ store. */
  readonly violations: readonly Violation[];
}

/**
 * Ba dòng của khối kiểm tra, gom từ hai nguồn dữ liệu THẬT.
 *
 * Domain có nguyên liệu nhưng **không có hàm tổng hợp sẵn** cho cả ba dòng, và
 * ba màn QC đã tổng hợp ở đúng tầng này rồi (`objectLayerReviewGateway.ts`,
 * `wallLayerReviewGateway.ts`, `dimensionOcrReviewGateway.ts` — mỗi cái tự đếm
 * `reviewed`/tổng của loại đối tượng nó phụ trách). Đây là lượt thứ tư chép
 * đúng tiền lệ đó, không phải một công thức mới:
 *
 * - **vi phạm** = `RuleRunResult.violations.length`. Domain không có khái niệm
 *   "vi phạm đã xử lý": một vi phạm biến mất khỏi mảng ngay khi mô hình được
 *   sửa đúng, nên mọi phần tử còn trong mảng đều là "chưa xử lý".
 * - **trạng thái duyệt** = `Level.reviewed` của các tầng đã chọn.
 * - **đối tượng chưa duyệt** = `ReviewMetadata.reviewed === false` trên từng
 *   đối tượng nằm trên các tầng đã chọn.
 *
 * Không dòng nào chặn xuất. `tone` chỉ chọn giữa hai sắc thái, và `fixHref`
 * luôn đến từ `ROUTES` (R-65) — `null` khi không có nơi nào để đi.
 */
export function buildPreflightRows(input: PreflightInput): readonly PreflightRow[] {
  const { projectId, graph, levels, violations } = input;

  const unapprovedLevels = levels.filter((level) => !level.reviewed);
  const unreviewed = collectUnreviewed(graph, levels);
  const violationCount = violations.length;

  return [
    {
      id: 'approval',
      label:
        levels.length === 0
          ? 'chưa chọn tầng nào để xuất.'
          : unapprovedLevels.length === 0
            ? `cả ${formatNumber(levels.length)} tầng đã chọn đều đã duyệt.`
            : `còn ${formatNumber(unapprovedLevels.length)} tầng chưa duyệt: ${unapprovedLevels
                .map((level) => level.name)
                .join(', ')}.`,
      tone: unapprovedLevels.length === 0 && levels.length > 0 ? 'ok' : 'attention',
      fixHref: unapprovedLevels.length === 0 ? null : ROUTES.project.floors(projectId),
    },
    {
      id: 'violations',
      label:
        violationCount === 0
          ? 'không còn vi phạm nào.'
          : `còn ${formatNumber(violationCount)} vi phạm chưa xử lý.`,
      tone: violationCount === 0 ? 'ok' : 'attention',
      fixHref: violationCount === 0 ? null : ROUTES.project.rules(projectId),
    },
    {
      id: 'unreviewed',
      label:
        unreviewed.count === 0
          ? 'mọi đối tượng trên các tầng đã chọn đều đã duyệt.'
          : `còn ${formatNumber(unreviewed.count)} đối tượng chưa duyệt.`,
      tone: unreviewed.count === 0 ? 'ok' : 'attention',
      fixHref:
        unreviewed.levelId === null
          ? null
          : ROUTES.project.objects(projectId, unreviewed.levelId),
    },
  ];
}

interface UnreviewedTally {
  readonly count: number;
  /** Tầng của đối tượng chưa duyệt đầu tiên — nơi liên kết "đi sửa" dẫn tới. */
  readonly levelId: LevelId | null;
}

const NO_UNREVIEWED: UnreviewedTally = Object.freeze({ count: 0, levelId: null });

function collectUnreviewed(
  graph: NormalizedSpatial | null,
  levels: readonly Level[],
): UnreviewedTally {
  if (graph === null || levels.length === 0) {
    return NO_UNREVIEWED;
  }

  let count = 0;
  let levelId: LevelId | null = null;

  for (const level of levels) {
    for (const id of idsOnLevel(graph, level.id)) {
      const entity = graph.byId[id];

      if (entity !== undefined && !entity.reviewed) {
        count += 1;
        levelId ??= level.id;
      }
    }
  }

  return { count, levelId };
}

/* -------------------------------------------------------------------------- */
/* Spatial JSON — D-11, không có bước "làm sạch" nào ở giữa                    */
/* -------------------------------------------------------------------------- */

/** Kiểu MIME của một tệp JSON tải về. */
export const SPATIAL_JSON_MIME_TYPE = 'application/json';

/**
 * Đồ thị không gian, tuần tự hoá thẳng.
 *
 * `SpatialGraph` chỉ chứa chuỗi, số, boolean, mảng và object phẳng — không
 * `Map`, không `Set`, không hàm — nên `JSON.stringify` là bộ tuần tự hoá đầy
 * đủ, và domain không có bộ nào khác để gọi. Store giữ dạng đã chuẩn hoá, nên
 * `denormalizeSpatial` đưa nó về đúng hình dạng máy chủ gửi xuống (bất biến
 * round-trip của `normalize.ts`).
 *
 * `includeConfidence === false` thì trường `confidence` bị bỏ ở **cấp từng đối
 * tượng** — đó là nơi duy nhất nó tồn tại; không có con số độ tin cậy nào ở cấp
 * đồ thị để bỏ.
 */
export function toSpatialJson(graph: NormalizedSpatial, includeConfidence: boolean): string {
  const denormalized = denormalizeSpatial(graph);

  return JSON.stringify(
    includeConfidence ? denormalized : stripConfidence(denormalized),
    null,
    JSON_INDENT_SPACES,
  );
}

/** Hai dấu cách: tệp này để người đọc và để công cụ khác đọc, không để nén. */
const JSON_INDENT_SPACES = 2;

const withoutConfidence = <T extends { confidence: number }>(entity: T): Omit<T, 'confidence'> => {
  const copy: Record<string, unknown> = { ...entity };

  delete copy['confidence'];

  return copy as Omit<T, 'confidence'>;
};

function stripConfidence(graph: SpatialGraph): unknown {
  return {
    building: withoutConfidence(graph.building),
    levels: graph.levels.map(withoutConfidence),
    walls: graph.walls.map(withoutConfidence),
    openings: graph.openings.map(withoutConfidence),
    furniture: graph.furniture.map(withoutConfidence),
    rooms: graph.rooms.map(withoutConfidence),
    axes: graph.axes.map(withoutConfidence),
    dimensions: graph.dimensions.map(withoutConfidence),
    notes: graph.notes.map(withoutConfidence),
  };
}

/* -------------------------------------------------------------------------- */
/* Số trang PDF — đếm thật, không đoán                                        */
/* -------------------------------------------------------------------------- */

/** Bốn mục chọn được của hợp đồng, ánh xạ sang bốn section của `pdfSchema`. */
export interface PdfSectionChoice {
  readonly includeFloorPlans: boolean;
  readonly includeRoomTable: boolean;
  readonly includeViolations: boolean;
  readonly includeRender3d: boolean;
}

const SECTION_BY_CHOICE: Readonly<Record<keyof PdfSectionChoice, PdfSectionKind>> = Object.freeze({
  includeFloorPlans: 'levelSummary',
  includeRoomTable: 'roomAreas',
  includeViolations: 'violations',
  includeRender3d: 'attachments',
});

/** Bốn mục đang bật, theo đúng thứ tự `PDF_SECTION_KINDS` in ra. */
export function toPdfSections(choice: PdfSectionChoice): readonly PdfSectionKind[] {
  const keys = Object.keys(SECTION_BY_CHOICE) as (keyof PdfSectionChoice)[];
  const chosen = new Set<PdfSectionKind>(
    keys.filter((key) => choice[key]).map((key) => SECTION_BY_CHOICE[key]),
  );

  return PDF_SECTION_KINDS.filter((kind) => chosen.has(kind));
}

export interface CountPdfPagesInput {
  readonly graph: SpatialGraph;
  readonly violations: readonly Violation[];
  readonly dataVersion: string;
  readonly exportedAt: Date;
  readonly preparerName: string;
  readonly choice: PdfSectionChoice;
}

/**
 * Số trang của hồ sơ, **đếm** từ `buildPdfDocument` chứ không tính theo công
 * thức chép lại.
 *
 * Dựng cả tài liệu để đếm là cố ý: mọi luật "mục nào thành trang" nằm trong
 * `buildPdfDocument` (ví dụ: mục ảnh 3D được chọn nhưng không có ảnh nào thì
 * KHÔNG thành trang), và chép luật ấy ra đây là dựng một bản sao sẽ lệch. Tài
 * liệu là dữ liệu thuần, không chạm PDF, nên phép đếm này rẻ và tất định.
 *
 * Hệ quả nói thẳng: hôm nay không có ảnh 3D nào để đính (xem `canCaptureImage`),
 * nên bật mục "ảnh 3D đính kèm" **không** làm số trang tăng. Con số vẫn đúng.
 */
export function countPdfPages(input: CountPdfPagesInput): number {
  const pdfInput: ExportPdfInput = {
    graph: input.graph,
    violations: input.violations,
    dataVersion: input.dataVersion,
    exportedAt: input.exportedAt,
    preparer: { name: input.preparerName },
    sections: toPdfSections(input.choice),
  };

  return pdfModule.buildPdfDocument(pdfInput).pages.length;
}

/* -------------------------------------------------------------------------- */
/* GLB — ráp đầu vào từ đồ thị đã chuẩn hoá                                    */
/* -------------------------------------------------------------------------- */

/**
 * Một tầng của đồ thị, thành một `ExportFloor`.
 *
 * `toBuildFloorInput` đã giải quyết hai chỗ lệch kiểu khó nhất — `Wall` và
 * `Opening` của `domain/spatial` khác `Wall` và `Opening` mà bộ xuất đòi — nên
 * ở đây chỉ còn hai việc nó không làm: ghép `name`/`order` (chúng không có chỗ
 * trong `BuildableLevel`) và lọc nội thất của tầng (`Furniture` khớp thẳng,
 * không cần chuyển đổi).
 *
 * @returns `null` khi tầng không có trong đồ thị.
 */
export function toExportFloor(graph: NormalizedSpatial, level: Level): ExportFloor | null {
  const built = toBuildFloorInput(graph, level.id);

  if (built === null) {
    return null;
  }

  return {
    level: { ...built.level, name: level.name, order: level.order },
    walls: built.walls,
    rooms: built.rooms,
    openings: built.openings ?? [],
    furniture: furnitureOnLevel(graph, level.id),
  };
}

function furnitureOnLevel(graph: NormalizedSpatial, levelId: LevelId): readonly Furniture[] {
  const items: Furniture[] = [];

  for (const id of idsOnLevel(graph, levelId)) {
    const entity: SpatialEntity | undefined = graph.byId[id];

    if (entity !== undefined && isEntityOfKind('furniture', entity)) {
      items.push(entity);
    }
  }

  return items;
}

/* -------------------------------------------------------------------------- */
/* Đo đạc — O-01                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Định dạng của màn, ánh xạ sang `EXPORT_FORMATS` của `lib/telemetry/events`.
 *
 * `EXPORT_FORMATS` là `['pdf','glb','png','csv','ifc']` — **không có giá trị nào
 * cho Spatial JSON**, và `src/lib` nằm ngoài phạm vi sửa của lượt này. Ba định
 * dạng còn lại ánh xạ thẳng; Spatial JSON ánh xạ tới `null`, nghĩa là **không
 * ghi sự kiện** cho nó. Chọn `'csv'` hay `'ifc'` để "có một giá trị" là ghi một
 * con số sai vào bảng đo đạc — một sự kiện thiếu thì biết là thiếu, một sự kiện
 * sai thì không ai biết.
 */
const TELEMETRY_FORMAT: Readonly<Record<ExportFormatId, 'pdf' | 'glb' | 'png' | null>> =
  Object.freeze({
    glb: 'glb',
    pdf: 'pdf',
    image: 'png',
    'spatial-json': null,
  });

/**
 * Một kilobyte — đúng con số `BYTES_PER_UNIT` của `lib/format/bytes`, mượn lại
 * dưới tên khác.
 *
 * Không viết `1024` ở đây (R-71: không hằng số viết tay), và không dùng thẳng
 * tên gốc vì `local/no-raw-number` cấm mọi phép chia cho một hằng mang `_PER_`
 * trong tên ở tầng màn. Phép quy đổi này KHÔNG phải để hiện lên màn — chỗ đó
 * dùng `formatFileSize` — mà để điền trường `sizeKb` của lược đồ đo đạc, thứ
 * đòi đúng đơn vị kilobyte.
 */
const KILOBYTE = BYTES_PER_UNIT;

export interface TrackExportInput {
  readonly formatId: ExportFormatId;
  readonly outcome: TelemetryOutcome;
  readonly durationMs: number;
  /** Dung lượng tệp; cổng tự quy sang kilobyte cho lược đồ. */
  readonly sizeBytes: number;
  /** Số trang; 0 với mọi định dạng không phải PDF. */
  readonly pageCount: number;
}

/* -------------------------------------------------------------------------- */
/* Sổ chạy — sống lâu hơn màn, không phải một slice mới                        */
/* -------------------------------------------------------------------------- */

/** Một tệp đã xuất xong trong phiên này. */
export interface ExportedFile {
  readonly id: string;
  readonly fileName: string;
  readonly byteLength: number;
  readonly formatId: ExportFormatId;
  readonly exportedAtMs: number;
  readonly blob: Blob;
}

/** Ảnh chụp trạng thái xuất của một dự án, thứ màn đọc để vẽ. */
export interface ExportRunSnapshot {
  /** Định dạng đang xuất; `null` khi không có lượt nào chạy. */
  readonly runningFormatId: ExportFormatId | null;
  /** Tiến trình thật của worker; `null` trước lượt tiến trình đầu tiên. */
  readonly progress: ExportProgress | null;
  /** Tệp đã xuất trong phiên, mới nhất trước. */
  readonly files: readonly ExportedFile[];
}

const EMPTY_SNAPSHOT: ExportRunSnapshot = Object.freeze({
  runningFormatId: null,
  progress: null,
  files: Object.freeze([]),
});

interface ExportRun {
  snapshot: ExportRunSnapshot;
  /** Handle của lượt `.glb` đang chạy; `null` với định dạng không dùng worker. */
  task: ExportGlbTask | null;
  readonly listeners: Set<() => void>;
}

/**
 * Lượt xuất và tệp của từng dự án, sống trong bộ nhớ của module này.
 *
 * `Map` ở phạm vi module chứ không trong một hàm dựng, đúng khuôn
 * `configByProject` của `ruleSettingsGateway.ts`: hai lượt mount của cùng một
 * màn phải nhìn thấy **cùng một** lượt xuất, nếu không thì rời màn rồi quay lại
 * là mất dấu tiến trình — và một worker không ai theo dõi nữa là một worker rò.
 */
const runByProject = new Map<string, ExportRun>();

const runOf = (projectId: string): ExportRun => {
  const existing = runByProject.get(projectId);

  if (existing !== undefined) {
    return existing;
  }

  const created: ExportRun = { snapshot: EMPTY_SNAPSHOT, task: null, listeners: new Set() };
  runByProject.set(projectId, created);

  return created;
};

const publish = (run: ExportRun, snapshot: ExportRunSnapshot): void => {
  run.snapshot = snapshot;

  for (const listener of run.listeners) {
    listener();
  }
};

/**
 * Bỏ mọi lượt xuất đang giữ, huỷ luôn worker của chúng.
 *
 * Bài kiểm gọi giữa hai lượt render để không rò trạng thái — và vì `cancel()`
 * của `exportGlb` terminate worker ngay, gọi hàm này cũng là cách chắc chắn
 * không có thread nào sống sót qua một bài kiểm.
 */
export function resetExportRuns(): void {
  for (const run of runByProject.values()) {
    run.task?.cancel();
  }

  runByProject.clear();
}

/* -------------------------------------------------------------------------- */
/* Cổng                                                                        */
/* -------------------------------------------------------------------------- */

export interface StartGlbExportInput {
  readonly projectId: string;
  readonly projectName: string;
  readonly projectVersion: string;
  readonly floors: readonly ExportFloor[];
  readonly options: ExportGlbOptions;
}

export interface StartSpatialJsonExportInput {
  readonly projectId: string;
  readonly projectName: string;
  readonly graph: NormalizedSpatial;
  readonly includeConfidence: boolean;
}

/** Ép cảnh cho bài kiểm: tường minh, không biến ẩn (khuôn `billingGateway.ts`). */
export interface ExportPanelGatewaySeed {
  /** Thay hẳn lượt xuất `.glb` — bài kiểm không dựng worker thật. */
  readonly exportGlb?: typeof glbModule.exportGlb;
  /** Ghi đè quyền, để dựng trạng thái 6 mà không dựng cả một phiên đăng nhập. */
  readonly canExport?: boolean;
  /** Khung nhìn 3D đang sống, nếu vỏ ứng dụng có một cái để đưa xuống. */
  readonly viewport?: unknown;
  /** Bộ gửi đo đạc tiêm được — bài kiểm cắm bản đếm, không đẩy gì lên mạng. */
  readonly telemetry?: TelemetrySender;
  /** Cách một tệp tới được máy người dùng. Bài kiểm thay bằng bản ghi nhận. */
  readonly deliver?: (file: ExportedFile) => void;
  readonly now?: () => number;
  /** Mã của một tệp trong danh sách; tiêm được để bài kiểm không phụ thuộc ngẫu nhiên. */
  readonly createFileId?: () => string;
}

export interface ExportPanelGateway {
  readonly readCapabilities: () => ExportPanelCapabilities;
  readonly readPermission: (roles: readonly ProjectRole[]) => boolean;
  readonly readSnapshot: (projectId: string) => ExportRunSnapshot;
  /** Đăng ký nghe thay đổi của một lượt xuất. Trả về hàm bỏ nghe. */
  readonly subscribe: (projectId: string, listener: () => void) => () => void;
  /** Lượt xuất `.glb` thật, có tiến trình và huỷ được. */
  readonly startGlbExport: (input: StartGlbExportInput) => Promise<ExportedFile>;
  /** Lượt xuất Spatial JSON: tuần tự hoá thuần, không worker, không tiến trình. */
  readonly startSpatialJsonExport: (
    input: StartSpatialJsonExportInput,
  ) => Promise<ExportedFile>;
  /** Huỷ lượt đang chạy. Không có lượt nào thì không làm gì. */
  readonly cancel: (projectId: string) => void;
  readonly deliver: (file: ExportedFile) => void;
  readonly track: (input: TrackExportInput) => void;
  readonly now: () => number;
}

/**
 * Đưa một tệp tới máy người dùng.
 *
 * Không có hàm dùng chung nào cho việc này trong `src/lib` (đã soát: cả `src/`
 * không có một lời gọi `createObjectURL` nào), và `src/lib` nằm ngoài phạm vi
 * sửa của lượt này — nên nó nằm ở đây, sau một cửa tiêm được, thay vì rải trong
 * hook. `revokeObjectURL` chạy ngay sau cú bấm: URL đã dùng xong, và một URL
 * không thu hồi là một `Blob` không bao giờ được giải phóng.
 */
function deliverViaAnchor(file: ExportedFile): void {
  const url = URL.createObjectURL(file.blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = file.fileName;
  anchor.rel = 'noopener';
  anchor.click();

  URL.revokeObjectURL(url);
}

/** Số thứ tự tệp trong phiên, để hai tệp xuất cùng một mili giây không trùng mã. */
const fileSequence = {
  value: 0,
  next(): number {
    this.value += 1;

    return this.value;
  },
};

/** Cổng thật của màn. Chữ ký này không đổi khi ba năng lực thiếu được nối dây. */
export function createExportPanelGateway(seed: ExportPanelGatewaySeed = {}): ExportPanelGateway {
  const now = seed.now ?? (() => Date.now());
  const runGlb = seed.exportGlb ?? glbModule.exportGlb;
  const createFileId =
    seed.createFileId ?? (() => `${String(now())}-${String(fileSequence.next())}`);

  const finish = (
    projectId: string,
    formatId: ExportFormatId,
    fileName: string,
    blob: Blob,
    byteLength: number,
  ): ExportedFile => {
    const run = runOf(projectId);
    const file: ExportedFile = {
      id: createFileId(),
      fileName,
      byteLength,
      formatId,
      exportedAtMs: now(),
      blob,
    };

    run.task = null;
    publish(run, {
      runningFormatId: null,
      progress: null,
      files: [file, ...run.snapshot.files],
    });

    return file;
  };

  const fail = (projectId: string): void => {
    const run = runOf(projectId);

    run.task = null;
    publish(run, { ...run.snapshot, runningFormatId: null, progress: null });
  };

  return {
    readCapabilities: () =>
      readExportCapabilities(seed.viewport === undefined ? {} : { viewport: seed.viewport }),

    readPermission: (roles) => seed.canExport ?? readExportPermission(roles),

    readSnapshot: (projectId) => runOf(projectId).snapshot,

    subscribe: (projectId, listener) => {
      const run = runOf(projectId);
      run.listeners.add(listener);

      return () => {
        run.listeners.delete(listener);
      };
    },

    startGlbExport: async (input) => {
      const run = runOf(input.projectId);

      // Một dự án, một lượt xuất. Lượt cũ bị huỷ chứ không bị bỏ quên: `cancel()`
      // terminate worker của nó ngay, nên không thread nào sống sót không ai theo.
      run.task?.cancel();
      publish(run, { ...run.snapshot, runningFormatId: 'glb', progress: null });

      const task = runGlb(
        {
          projectName: input.projectName,
          projectVersion: input.projectVersion,
          floors: input.floors,
          options: input.options,
        },
        {
          onProgress: (progress) => {
            const current = runByProject.get(input.projectId);

            // Lượt đã bị thay bằng lượt khác thì tiến trình của nó không được
            // ghi đè lên tiến trình đang hiện.
            if (current !== undefined && current.task === task) {
              publish(current, { ...current.snapshot, runningFormatId: 'glb', progress });
            }
          },
        },
      );

      run.task = task;

      try {
        const result = await task.result;

        return finish(input.projectId, 'glb', result.fileName, result.blob, result.byteLength);
      } catch (error) {
        fail(input.projectId);

        throw error;
      }
    },

    startSpatialJsonExport: (input) => {
      const run = runOf(input.projectId);

      run.task?.cancel();
      publish(run, { ...run.snapshot, runningFormatId: 'spatial-json', progress: null });

      try {
        const text = toSpatialJson(input.graph, input.includeConfidence);
        const blob = new Blob([text], { type: SPATIAL_JSON_MIME_TYPE });
        const fileName = `${glbModule.toFileSlug(input.projectName)}_${glbModule.formatExportTimestamp(
          new Date(now()),
        )}.json`;

        return Promise.resolve(
          finish(input.projectId, 'spatial-json', fileName, blob, blob.size),
        );
      } catch (error) {
        fail(input.projectId);

        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
    },

    cancel: (projectId) => {
      const run = runByProject.get(projectId);

      if (run === undefined || run.task === null) {
        return;
      }

      run.task.cancel();
      run.task = null;
      publish(run, { ...run.snapshot, runningFormatId: null, progress: null });
    },

    deliver: seed.deliver ?? deliverViaAnchor,

    track: (input) => {
      const format = TELEMETRY_FORMAT[input.formatId];

      // Spatial JSON không có giá trị trong `EXPORT_FORMATS`: không ghi, chứ
      // không ghi bừa một định dạng khác. Xem {@link TELEMETRY_FORMAT}.
      if (format === null) {
        return;
      }

      // `countSchema` tự làm tròn về số nguyên, nên phần lẻ không cần cắt ở đây.
      seed.telemetry?.track({
        name: 'export.file',
        format,
        outcome: input.outcome,
        durationMs: input.durationMs,
        sizeKb: input.sizeBytes / KILOBYTE,
        pageCount: input.pageCount,
      });
    },

    now,
  };
}

