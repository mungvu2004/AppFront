/**
 * Hình học KÝ HIỆU KIẾN TRÚC của màn QC "Lớp đối tượng", cộng phần mở rộng hợp
 * đồng props mà ba view của lớp này cần.
 *
 * File `.ts` thuần: không một thẻ JSX nào, không React, nên nó kiểm được bằng
 * cách so chuỗi `d` chứ không cần dựng cây DOM. `ObjectLayerCanvas.tsx` chỉ còn
 * việc đổ những chuỗi đó vào `<path>`, và nhờ vậy nó ở dưới trần 400 dòng của
 * R-22.
 *
 * ## Vẽ bằng ký hiệu, KHÔNG bằng khung bao
 *
 * "Vẽ bằng ký hiệu kiến trúc, không phải khung bao" là CẤM TUYỆT ĐỐI của đặc tả
 * gốc, và nó không phải chuyện thẩm mỹ: một khung chữ nhật quanh một cửa nói
 * đúng hai điều — có một cái gì đó ở đây, nó rộng chừng này — trong khi người
 * duyệt cần biết cánh cửa mở về phía nào, cửa sổ là hai vạch hay một mảng đặc,
 * cái giường quay đầu vào tường nào. Nên mỗi loại con dựng một hình riêng:
 *
 * - **Cửa đi** — một CÁNH cửa vuông góc với tường, cộng một CUNG MỞ bán kính
 *   đúng bằng chiều dài cánh. Bốn hướng mở ra bốn hình khác nhau: bản lề trái,
 *   bản lề phải, hai cánh (hai cung đối xứng), và cửa lùa (hai cánh chồng nhau
 *   cộng mũi tên đường trượt — một cửa lùa KHÔNG quét cung nào, vẽ cung cho nó
 *   là nói dối về cách nó hoạt động và về khoảng trống nó đòi).
 * - **Cửa sổ** — HAI VẠCH SONG SONG chạy suốt ô mở, nét đứt 4-2
 *   ({@link WINDOW_DASH_ARRAY}). Cửa sổ lùa có thêm thanh đứng giữa.
 * - **Nội thất** — ký hiệu mặt bằng quy ước, VIỀN NÉT: giường có gối và nếp
 *   chăn, sofa có lưng tựa và hai tay vịn, bàn ăn có bốn ghế, bồn cầu có két
 *   nước và lòng bồn, chậu rửa có lòng chậu và vòi.
 *
 * Không ký hiệu nào TÔ ĐẦY màu (CẤM TUYỆT ĐỐI). Chỗ duy nhất được tô là
 * {@link ObjectSymbol.footprint} — nền ở {@link SYMBOL_WASH_OPACITY} = 6% của
 * chính màu dữ liệu của lớp, đúng chữ đặc tả ("viền 1px màu dữ liệu của lớp,
 * nền 6%"). 6% là một vệt để mắt bắt được chỗ, không phải một mảng màu.
 *
 * ## Hệ toạ độ cục bộ — và vì sao view không tự đặt chỗ
 *
 * Mọi hình ở đây dựng trong hệ CỤC BỘ của một đối tượng: gốc ở tâm ký hiệu,
 * trục x chạy dọc tường, `-y` là hướng VÀO PHÒNG. Canvas đặt nó vào đúng chỗ
 * bằng `translate(centrePx) rotate(angleDeg)`, hai con số lấy thẳng từ
 * {@link ObjectPlacementViewModel} — do HOOK dựng bằng `placeOnWall(wall,
 * relativePosition)` của M-08 (`src/domain/openings/attach.ts:312`).
 *
 * View KHÔNG suy toạ độ từ `wallOutlines`: suy tâm một ô cửa ra từ một đa giác
 * tường là tìm tim tường rồi nội suy dọc nó, tức là hình học, tức là đúng thứ
 * "màn không tự tính vị trí gắn" cấm — và hàm làm đúng việc đó đã có sẵn ở
 * M-08, chỉ hook gọi được vì chỉ hook mới cầm `Wall` thật.
 *
 * ## Mở rộng hợp đồng props
 *
 * `objectLayerTypes.ts` là hợp đồng ĐÓNG BĂNG của T4 và không file nào ở lớp
 * này sửa nó. Ba interface `…ViewProps` dưới đây `extends` ba interface của T4,
 * THUẦN CỘNG THÊM, không đổi và không xoá một trường nào — đúng khuôn đã được
 * duyệt của màn anh em (`wallLayerHatch.ts`, `WallLayerCanvasViewProps extends
 * WallLayerCanvasProps`). Hợp đồng đầy đủ kèm chữ ký nguyên văn nằm ở
 * `.orca-notes/T6-props.contract.md` cho T5 (phía sản xuất) và T8 (phía ghép
 * màn).
 */

import type { SwingDirection } from '@/domain/spatial/types';
import type { ContextMenuItem } from '@/hooks/useContextMenu';
import type { MeasurementState } from '@/hooks/useMeasurementLabel';

import type {
  ObjectLayerCanvasProps,
  ObjectLayerId,
  ObjectLayerLeftPanelProps,
  ObjectLayerListProps,
  ObjectLayerVisibility,
  ObjectSubtype,
} from './objectLayerTypes';
import { OBJECT_LAYER_IDS } from './objectLayerTypes';

/* -------------------------------------------------------------------------- */
/* Màu dữ liệu — ĐÚNG BA, không bao giờ bốn.                                   */
/* -------------------------------------------------------------------------- */

/**
 * Ba lớp con, ba màu dữ liệu. Không có màu thứ tư ở màn này.
 *
 * Ba bậc lấy từ `SEQUENTIAL_RAMP` của `src/lib/coloring/scales.ts` — một họ
 * trung tính ấm giảm độ sáng đều, nên ba lớp phân biệt được cả khi in đen trắng
 * và cả với người không phân biệt được màu. Chúng KHÔNG phải ba màu trạng thái
 * của A4 (`--state-verified/attention/violation`) và KHÔNG phải màu nhấn của
 * A2: màu nhấn dành riêng cho thứ tương tác được, còn một cái giường không
 * tương tác được chỉ vì nó là cái giường.
 *
 * Độ tin cậy KHÔNG được đếm thêm một màu thứ tư vào đây — nó nói bằng
 * `ConfidenceMeter` và bằng chip cần chú ý ở danh sách, không bằng màu ký hiệu.
 */
export const OBJECT_LAYER_COLOR_TOKENS: Readonly<Record<ObjectLayerId, string>> = {
  door: 'var(--wall-330)',
  window: 'var(--wall-220)',
  furniture: 'var(--wall-110)',
};

/**
 * Tường hạ xuống đây để đối tượng nổi lên (đặc tả gốc, nguyên văn).
 *
 * `--wall-idle` là bậc SÁNG NHẤT trong bốn token tường của
 * `src/styles/globals.css`, sáng hơn cả ba màu dữ liệu ở trên, nên nền tường
 * lùi lại sau mà không biến mất.
 */
export const WALL_IDLE_TOKEN = 'var(--wall-idle)';

/** Màu dữ liệu của một lớp con. */
export function objectLayerColorToken(layer: ObjectLayerId): string {
  return OBJECT_LAYER_COLOR_TOKENS[layer];
}

/**
 * Những màu dữ liệu đang hiện, không trùng lặp.
 *
 * Bật cả ba lớp → đúng ba phần tử. Đây là con số nghiệm thu ("đếm màu dữ liệu
 * hiện cùng lúc khi bật cả ba lớp → đúng 3") tính ra được, chứ không phải một
 * lời hứa suông trong tài liệu.
 */
export function visibleDataColorTokens(visibility: ObjectLayerVisibility): readonly string[] {
  const tokens: string[] = [];

  for (const layer of OBJECT_LAYER_IDS) {
    const token = OBJECT_LAYER_COLOR_TOKENS[layer];

    if (visibility[layer] && !tokens.includes(token)) {
      tokens.push(token);
    }
  }

  return tokens;
}

/* -------------------------------------------------------------------------- */
/* Hằng vẽ.                                                                    */
/* -------------------------------------------------------------------------- */

/** Viền 1px — đúng đặc tả. `vector-effect="non-scaling-stroke"` giữ nó 1px ở mọi mức phóng. */
export const SYMBOL_STROKE_WIDTH_PX = 1;

/** Nền 6% của chính màu dữ liệu — đúng đặc tả. Một vệt, không phải một mảng màu. */
export const SYMBOL_WASH_OPACITY = 0.06;

/** Nét đứt 4-2 của cửa sổ: gạch 4, trống 2 — đúng đặc tả. */
export const WINDOW_DASH_ARRAY = '4 2';

/** Cạnh một tay cầm của hộp chọn, px — đặc tả: "hộp chọn có 4 tay cầm 6px". */
export const SELECTION_HANDLE_SIZE_PX = 6;

/** Bốn góc hộp chọn, theo chiều kim đồng hồ từ góc trên trái. */
export const SELECTION_HANDLE_CORNERS = [
  'topLeft',
  'topRight',
  'bottomRight',
  'bottomLeft',
] as const;

/** Một góc của hộp chọn. */
export type SelectionHandleCorner = (typeof SELECTION_HANDLE_CORNERS)[number];

/* -------------------------------------------------------------------------- */
/* Toạ độ — mọi con số dưới đây đã là PIXEL bản vẽ, view không quy đổi.        */
/* -------------------------------------------------------------------------- */

/** Một điểm trên ảnh bản vẽ, đơn vị pixel. */
export interface ObjectPointPx {
  readonly x: number;
  readonly y: number;
}

/** Một hình chữ nhật trên ảnh bản vẽ, đơn vị pixel. */
export interface ObjectRectPx {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Một đối tượng ĐÃ ĐƯỢC ĐẶT CHỖ SẴN bởi hook — view không suy một toạ độ nào.
 *
 * Từng trường, và lý do canvas không tự dựng được nó:
 *
 * - `centrePx` — tâm ký hiệu, do `placeOnWall(wall, relativePosition)` của M-08
 *   dựng từ `Wall` thật. View chỉ cầm `readonly Point[]` của `wallOutlines`, và
 *   suy tâm ra từ một đa giác là hình học.
 * - `angleDeg` — góc tường chủ. Suy từ đa giác cũng là hình học.
 * - `widthPx` / `depthPx` — bề rộng dọc tường và bề sâu vào phòng. `widthMm`
 *   quy ra pixel là quy đổi đơn vị, `local/no-raw-number` cấm ở tầng view; còn
 *   bề sâu của một ô mở là BỀ DÀY TƯỜNG CHỦ, một con số view không hề có.
 * - `boundsPx` — `SelectionHalo` nhận x/y/rộng/cao px. Hộp bao của một ký hiệu
 *   ĐÃ XOAY là hình học.
 * - `codeLabel` — `"#D-007"`. Ghép chuỗi từ `id` ở view là định dạng, A15 cấm.
 * - `isOrphan` — đối tượng chưa gắn tường vẽ ở `tracedCentre` của nó; view
 *   không phân biệt được hai nhánh của `ReviewObject` mà không đụng `@/domain`
 *   (R-60).
 */
export interface ObjectPlacementViewModel {
  readonly id: string;
  readonly layer: ObjectLayerId;
  readonly subtype: ObjectSubtype;
  readonly swing: SwingDirection;
  readonly centrePx: ObjectPointPx;
  readonly angleDeg: number;
  readonly widthPx: number;
  readonly depthPx: number;
  readonly boundsPx: ObjectRectPx;
  readonly codeLabel: string;
  readonly isOrphan: boolean;
}

/**
 * Nhãn đo lúc kéo Slider vị trí — khoảng cách tới HAI ĐẦU tường chủ.
 *
 * Hai khoảng cách tới nơi ĐÃ THÀNH CHUỖI (`"1.240 mm"`), không phải hai con số:
 * `MeasurementLabel` nhận `distanceFormatted` là chuỗi, và A15 đặt việc định
 * dạng ở viewmodel chứ không ở view. Ba điểm mốc và hai điểm giữa cũng tới sẵn
 * — trung điểm của hai điểm là một phép tính, và ở lớp canvas thì phép tính nào
 * cũng là phép tính.
 */
export interface ObjectDragMeasurement {
  readonly objectId: string;
  readonly state: MeasurementState;
  /** Đầu `start` của tường chủ. */
  readonly wallStartPx: ObjectPointPx;
  /** Đầu `end` của tường chủ. */
  readonly wallEndPx: ObjectPointPx;
  /** Tâm đối tượng đang kéo. */
  readonly objectPx: ObjectPointPx;
  /** Điểm treo nhãn của đoạn "tới đầu start". */
  readonly midToStartPx: ObjectPointPx;
  /** Điểm treo nhãn của đoạn "tới đầu end". */
  readonly midToEndPx: ObjectPointPx;
  /** Ví dụ `"1.240 mm"` — đã định dạng ở hook (A15). */
  readonly distanceToStartLabel: string;
  /** Ví dụ `"860 mm"` — đã định dạng ở hook (A15). */
  readonly distanceToEndLabel: string;
}

/* -------------------------------------------------------------------------- */
/* Ba hợp đồng props mở rộng.                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Canvas: hợp đồng T4 cộng phần đặt chỗ, phần đo lúc kéo, và bốn hành động của
 * menu chuột phải. Thuần cộng thêm.
 *
 * Bốn callback menu là TUỲ CHỌN vì trạng thái `forbidden` (vai Người xem) không
 * có hành động nào để mà mở menu — vắng cả bốn thì bấm chuột phải không mở gì,
 * chứ không mở một menu rỗng.
 */
export interface ObjectLayerCanvasViewProps extends ObjectLayerCanvasProps {
  /** 21 đối tượng đã đặt chỗ sẵn, cùng thứ tự với `objects`. */
  readonly placements: readonly ObjectPlacementViewModel[];
  /** `null` khi không ai đang kéo Slider vị trí. */
  readonly dragMeasurement: ObjectDragMeasurement | null;
  readonly onApprove?: ((objectId: string) => void) | undefined;
  readonly onDelete?: ((objectId: string) => void) | undefined;
  readonly onChangeSubtype?: ((objectId: string, subtype: ObjectSubtype) => void) | undefined;
  readonly onAttachToNearestWall?: ((objectId: string) => void) | undefined;
}

/**
 * Panel trái: hợp đồng T4 cộng hàng cần chú ý của lớp nội thất (trạng thái 3b).
 *
 * Chuỗi tới sẵn, không ghép ở view: đặc tả gốc ghi nguyên văn "nhận diện nội
 * thất lỗi, cửa vẫn xong", và hàng này KHÔNG chặn cả màn — nó nằm trong nhánh
 * "nội thất" của cây lớp, hai lớp cửa bên trên vẫn duyệt bình thường.
 */
export interface ObjectLayerLeftPanelViewProps extends ObjectLayerLeftPanelProps {
  readonly furnitureAttentionNotice: string | null;
}

/**
 * Danh sách: hợp đồng T4 cộng hành động "Gắn vào tường gần nhất".
 *
 * Hành động gọi M-08 ở tầng hook; view chỉ GỌI, không tự tìm tường nào gần nhất
 * (CẤM TUYỆT ĐỐI).
 */
export interface ObjectLayerListViewProps extends ObjectLayerListProps {
  readonly onAttachToNearestWall: (objectId: string) => void;
}

/* -------------------------------------------------------------------------- */
/* GHI CHÚ THIẾT KẾ CỦA LỚP CANVAS — đọc trước khi sửa `ObjectLayerCanvas.tsx`. */
/* -------------------------------------------------------------------------- */

/*
 * Phần tài liệu của lớp canvas ở đây chứ không ở file `.tsx`, đúng cách màn
 * tường anh em đã làm với `wallLayerHatch.ts`: mọi thứ dựng được mà không cần
 * một thẻ nào đều nằm ở file `.ts`, để file view chỉ còn việc dựng thẻ và ở
 * dưới trần 400 dòng của R-22.
 *
 * ## Vì sao `<svg>` KHÔNG có `viewBox`
 *
 * Một đơn vị SVG là một pixel của khung vẽ, và mọi toạ độ trong props đã là
 * pixel bản vẽ. Nhờ vậy `SelectionHalo` — vốn là một `<div>` định vị tuyệt đối,
 * không phải một thẻ SVG — nằm chồng đúng lên ký hiệu mà không cần một phép quy
 * đổi nào giữa hai hệ. Đặt `viewBox` vào sẽ tạo ra hệ thứ hai, và view sẽ phải
 * tự đổi qua lại: đúng thứ "không một phép hình học nào ở lớp canvas" cấm.
 *
 * ## Ba màu, không bao giờ bốn
 *
 * Ba lớp con dùng ba token của {@link OBJECT_LAYER_COLOR_TOKENS}. Độ tin cậy
 * KHÔNG được đếm thêm một màu: nó nói bằng `ConfidenceMeter` ở danh sách. Màu
 * nhấn của vòng chọn cũng không phải màu dữ liệu — theo A2 nó là màu của "thứ
 * đang tương tác", nên nó không vào bảng chú giải và không vào phép đếm.
 *
 * ## Chuyển động — 260 ms, không phải 240 ms
 *
 * Đặc tả gốc ghi 240 ms ba lần. Thang chuyển động có đúng năm giá trị
 * (120/180/260/340/700) và `local/no-raw-duration` chặn mọi con số khác, nên
 * QĐ-4 của `.orca-notes/S13-SPEC-GOC.md` chốt dùng **260 ms**
 * (`MOTION_DURATIONS_MS.standard`, đọc qua lớp `duration-260` của
 * `tailwind.config.ts` — cùng một bảng). Độ so le 24 ms là *stagger* chứ không
 * phải *duration*, và nó đã có tên sẵn: `staggerDelayMs` của `@/lib/motion`
 * dùng `STAGGER_STEP_MS = 24`, nên không con số thô nào phải viết ra.
 *
 * Bật/tắt một lớp: nhóm mờ dần kèm dịch dọc 4px trong 260 ms, so le 24 ms theo
 * thứ tự TRONG LỚP. Đối tượng bị ẩn KHÔNG bị tháo khỏi cây — tháo ra thì nó
 * biến mất tức thì và không còn gì để mà mờ dần; nó ở lại với `opacity-0`,
 * `pointer-events-none` và `aria-hidden`.
 *
 * Đổi loại: ký hiệu mới vào bằng một nhịp 260 ms (mờ + phóng nhẹ) trong khi màu
 * viền chạy sang màu lớp mới ở đúng nhịp đó. Thuộc tính `d` của SVG không phải
 * thuộc tính CSS chuyển tiếp được, nên "biến hình" dựng bằng một khung hình
 * `requestAnimationFrame` đặt trạng thái vào rồi thả ra — không hẹn giờ, nên
 * không có một con số mili-giây thô nào.
 */

/** Chuỗi tiếng Việt tĩnh của canvas — chép từ `.orca-notes/S13-SPEC-GOC.md` phần IV (A6). */
export const OBJECT_CANVAS_TEXT = {
  canvasLabel: 'mặt bằng lớp đối tượng',
  objectCountSuffix: ' đối tượng',
  legendLabel: 'chú giải màu lớp',
  nothingToDraw: 'chưa có đối tượng nào để vẽ trên mặt bằng.',
  readOnlyNotice:
    'Mặt bằng vẫn xem và phóng to được, nhưng không chọn hay sửa được đối tượng nào. Nhờ người có quyền sửa dự án duyệt giúp.',
  orphanTitle: 'Chưa gắn vào tường nào',
} as const;

/** Năm mục của menu chuột phải. */
export const OBJECT_CANVAS_MENU_LABELS = {
  approve: 'Duyệt',
  toWindow: 'Đổi thành cửa sổ',
  toDoor: 'Đổi thành cửa đi',
  attach: 'Gắn vào tường gần nhất',
  remove: 'Xoá',
} as const;

/** `id` của câu giải thích vai Người xem, cho `aria-describedby`. */
export const OBJECT_CANVAS_READ_ONLY_ID = 'object-layer-canvas-read-only';

/**
 * Số màu dữ liệu đang hiện, đọc được từ bài kiểm.
 *
 * Nghiệm thu đòi "đếm màu dữ liệu hiện cùng lúc khi bật cả ba lớp → đúng 3", và
 * một con số mà chỉ mắt người đếm được thì không phải một cổng. Ô mang khoá này
 * là `sr-only`: không thêm gì vào mặt bằng, nhưng đếm được bằng máy.
 */
export const OBJECT_CANVAS_COLOR_COUNT_TEST_ID = 'object-layer-canvas-color-count';

/** Khung canvas: tối thiểu 640, bo 16, thụt 12 — cùng khuôn màn tường anh em. */
export const OBJECT_CANVAS_FRAME_CLASSES =
  'relative min-h-[640px] w-full overflow-hidden rounded-[16px] border border-border-default bg-canvas-2d p-3';

/* -------------------------------------------------------------------------- */
/* Ký hiệu.                                                                    */
/* -------------------------------------------------------------------------- */

/** Một nét viền của ký hiệu. */
export interface ObjectSymbolStroke {
  /** Khoá React, duy nhất trong một ký hiệu. */
  readonly id: string;
  readonly d: string;
  /** `'4 2'` cho vạch cửa sổ, `null` cho nét liền. */
  readonly dashArray: string | null;
}

/** Một ký hiệu kiến trúc hoàn chỉnh, trong hệ toạ độ cục bộ của đối tượng. */
export interface ObjectSymbol {
  /** Đường bao khép kín — chỗ DUY NHẤT được tô, và chỉ ở 6%. */
  readonly footprint: string;
  /** Các nét viền 1px. */
  readonly strokes: readonly ObjectSymbolStroke[];
  /** Ký hiệu này có cung mở không: cửa bản lề thì có, cửa lùa và cửa sổ thì không. */
  readonly hasSwingArc: boolean;
}

/** Đầu vào của {@link buildObjectSymbol}. Mọi kích thước đã là pixel bản vẽ. */
export interface ObjectSymbolRequest {
  readonly subtype: ObjectSubtype;
  readonly swing: SwingDirection;
  /** Bề rộng dọc theo tường. */
  readonly width: number;
  /** Bề sâu vào phòng — với một ô mở là bề dày tường chủ. */
  readonly depth: number;
}

/**
 * Làm tròn về hai chữ số cho chuỗi `d`.
 *
 * KHÔNG phải việc định dạng số mà A15 nói tới: không ai đọc con số này, nó là
 * một toạ độ bên trong thuộc tính `d` của SVG. Hai hàm định dạng số của thư
 * viện chuẩn vừa bị `local/no-raw-number` cấm ở tầng này, vừa trả về chuỗi
 * trong khi phép cộng dưới đây cần số.
 */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Một đoạn thẳng. */
function line(x1: number, y1: number, x2: number, y2: number): string {
  return `M ${round(x1)},${round(y1)} L ${round(x2)},${round(y2)}`;
}

/** Một hình chữ nhật khép kín. */
function rect(x: number, y: number, width: number, height: number): string {
  return `M ${round(x)},${round(y)} H ${round(x + width)} V ${round(y + height)} H ${round(x)} Z`;
}

/** Một hình bầu dục khép kín, dựng bằng hai nửa cung. */
function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  const left = round(cx - rx);
  const right = round(cx + rx);
  const middle = round(cy);
  const radii = `${round(rx)},${round(ry)}`;

  return `M ${left},${middle} A ${radii} 0 1 0 ${right},${middle} A ${radii} 0 1 0 ${left},${middle} Z`;
}

/**
 * Cung mở của một cánh cửa: bán kính bằng đúng chiều dài cánh, quét 90°.
 *
 * `sweep` là cờ chiều quét của SVG. Trong hệ toạ độ y-hướng-xuống, `0` quét
 * ngược chiều kim đồng hồ trên màn hình — đó là chiều một cánh bản lề TRÁI mở
 * vào phòng — và `1` là chiều đối xứng của bản lề phải.
 */
function arcTo(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  radius: number,
  sweep: 0 | 1,
): string {
  const r = round(radius);

  return `M ${round(fromX)},${round(fromY)} A ${r},${r} 0 0 ${sweep} ${round(toX)},${round(toY)}`;
}

/** Hai má ô mở — hai nét ngắn cắt ngang bề dày tường ở hai đầu ký hiệu. */
function jambs(halfWidth: number, halfDepth: number): readonly ObjectSymbolStroke[] {
  return [
    { id: 'jamb-start', d: line(-halfWidth, -halfDepth, -halfWidth, halfDepth), dashArray: null },
    { id: 'jamb-end', d: line(halfWidth, -halfDepth, halfWidth, halfDepth), dashArray: null },
  ];
}

/** Cửa đi một cánh bản lề. `isLeft` đặt bản lề ở má trái của ô mở. */
function hingedDoor(halfWidth: number, halfDepth: number, isLeft: boolean): ObjectSymbol {
  const leaf = halfWidth * 2;
  const hingeX = isLeft ? -halfWidth : halfWidth;
  const jambX = isLeft ? halfWidth : -halfWidth;
  const sweep = isLeft ? 0 : 1;

  return {
    footprint: `M ${round(hingeX)},0 L ${round(jambX)},0 A ${round(leaf)},${round(leaf)} 0 0 ${sweep} ${round(hingeX)},${round(-leaf)} Z`,
    strokes: [
      ...jambs(halfWidth, halfDepth),
      { id: 'leaf', d: line(hingeX, 0, hingeX, -leaf), dashArray: null },
      { id: 'arc', d: arcTo(jambX, 0, hingeX, -leaf, leaf, sweep), dashArray: null },
    ],
    hasSwingArc: true,
  };
}

/** Cửa đi hai cánh — hai cung đối xứng, mỗi cánh dài nửa ô mở. */
function doubleDoor(halfWidth: number, halfDepth: number): ObjectSymbol {
  const half = round(halfWidth);

  return {
    footprint: [
      `M ${-half},0 L 0,0 A ${half},${half} 0 0 0 ${-half},${-half} Z`,
      `M ${half},0 L 0,0 A ${half},${half} 0 0 1 ${half},${-half} Z`,
    ].join(' '),
    strokes: [
      ...jambs(halfWidth, halfDepth),
      { id: 'leaf-left', d: line(-halfWidth, 0, -halfWidth, -halfWidth), dashArray: null },
      { id: 'leaf-right', d: line(halfWidth, 0, halfWidth, -halfWidth), dashArray: null },
      { id: 'arc-left', d: arcTo(0, 0, -halfWidth, -halfWidth, halfWidth, 0), dashArray: null },
      { id: 'arc-right', d: arcTo(0, 0, halfWidth, -halfWidth, halfWidth, 1), dashArray: null },
    ],
    hasSwingArc: true,
  };
}

/**
 * Cửa lùa — hai cánh chồng nhau cộng mũi tên đường trượt, KHÔNG có cung mở.
 *
 * Một cửa lùa không quét cung nào; vẽ cung cho nó là nói dối về cách nó hoạt
 * động, và người duyệt sẽ đi tìm một khoảng trống trước cánh mà cánh này không
 * cần. {@link ObjectSymbol.hasSwingArc} nói ra điều đó thành một cờ đọc được,
 * không phải một chuyện phải nhớ.
 */
function slidingDoor(halfWidth: number, halfDepth: number): ObjectSymbol {
  const offset = halfDepth * 0.5;
  const arrowY = -halfWidth;
  const tip = halfWidth * 0.55;
  const back = tip - halfWidth * 0.22;
  const spread = halfDepth * 0.7;

  return {
    footprint: rect(-halfWidth, -halfDepth, halfWidth * 2, halfDepth * 2),
    strokes: [
      ...jambs(halfWidth, halfDepth),
      { id: 'panel-near', d: line(-halfWidth, -offset, halfWidth * 0.1, -offset), dashArray: null },
      { id: 'panel-far', d: line(-halfWidth * 0.1, offset, halfWidth, offset), dashArray: null },
      { id: 'travel', d: line(-tip, arrowY, tip, arrowY), dashArray: null },
      {
        id: 'travel-head',
        d: `${line(tip, arrowY, back, arrowY - spread)} ${line(tip, arrowY, back, arrowY + spread)}`,
        dashArray: null,
      },
    ],
    hasSwingArc: false,
  };
}

/** Cửa sổ — hai vạch song song nét đứt 4-2, chạy suốt ô mở. */
function windowSymbol(halfWidth: number, halfDepth: number, isSliding: boolean): ObjectSymbol {
  const strokes: ObjectSymbolStroke[] = [
    ...jambs(halfWidth, halfDepth),
    {
      id: 'pane-outer',
      d: line(-halfWidth, -halfDepth, halfWidth, -halfDepth),
      dashArray: WINDOW_DASH_ARRAY,
    },
    {
      id: 'pane-inner',
      d: line(-halfWidth, halfDepth, halfWidth, halfDepth),
      dashArray: WINDOW_DASH_ARRAY,
    },
  ];

  if (isSliding) {
    strokes.push({ id: 'mullion', d: line(0, -halfDepth, 0, halfDepth), dashArray: null });
  }

  return {
    footprint: rect(-halfWidth, -halfDepth, halfWidth * 2, halfDepth * 2),
    strokes,
    hasSwingArc: false,
  };
}

/** Giường — đầu giường quay vào tường, có gối và nếp chăn. */
function bedSymbol(halfWidth: number, halfDepth: number): ObjectSymbol {
  const width = halfWidth * 2;
  const depth = halfDepth * 2;
  const inset = width * 0.08;
  const pillowNear = halfDepth - depth * 0.05;
  const pillowFar = halfDepth - depth * 0.2;
  const foldY = halfDepth - depth * 0.42;

  return {
    footprint: rect(-halfWidth, -halfDepth, width, depth),
    strokes: [
      { id: 'frame', d: rect(-halfWidth, -halfDepth, width, depth), dashArray: null },
      {
        id: 'pillow',
        d: rect(-halfWidth + inset, pillowFar, width - inset * 2, pillowNear - pillowFar),
        dashArray: null,
      },
      { id: 'fold', d: line(-halfWidth, foldY, halfWidth, foldY), dashArray: null },
    ],
    hasSwingArc: false,
  };
}

/** Sofa — lưng tựa áp tường, hai tay vịn. */
function sofaSymbol(halfWidth: number, halfDepth: number): ObjectSymbol {
  const width = halfWidth * 2;
  const depth = halfDepth * 2;
  const backY = halfDepth - depth * 0.28;
  const armX = halfWidth - width * 0.14;

  return {
    footprint: rect(-halfWidth, -halfDepth, width, depth),
    strokes: [
      { id: 'frame', d: rect(-halfWidth, -halfDepth, width, depth), dashArray: null },
      { id: 'back', d: line(-halfWidth, backY, halfWidth, backY), dashArray: null },
      { id: 'arm-left', d: line(-armX, backY, -armX, -halfDepth), dashArray: null },
      { id: 'arm-right', d: line(armX, backY, armX, -halfDepth), dashArray: null },
    ],
    hasSwingArc: false,
  };
}

/** Bàn ăn — mặt bàn và bốn ghế, hai ghế mỗi cạnh dài. */
function diningTableSymbol(halfWidth: number, halfDepth: number): ObjectSymbol {
  const width = halfWidth * 2;
  const depth = halfDepth * 2;
  const chairWidth = width * 0.22;
  const chairDepth = depth * 0.16;
  const gap = depth * 0.06;
  const columnX = width * 0.2;
  const strokes: ObjectSymbolStroke[] = [
    { id: 'top', d: rect(-halfWidth, -halfDepth, width, depth), dashArray: null },
  ];

  for (const side of [-1, 1]) {
    for (const column of [-1, 1]) {
      const y = side < 0 ? -halfDepth - gap - chairDepth : halfDepth + gap;

      strokes.push({
        id: `chair-${side}-${column}`,
        d: rect(column * columnX - chairWidth * 0.5, y, chairWidth, chairDepth),
        dashArray: null,
      });
    }
  }

  return {
    footprint: rect(-halfWidth, -halfDepth, width, depth),
    strokes,
    hasSwingArc: false,
  };
}

/** Bồn cầu — két nước áp tường, lòng bồn hướng ra phòng. */
function toiletSymbol(halfWidth: number, halfDepth: number): ObjectSymbol {
  const width = halfWidth * 2;
  const depth = halfDepth * 2;
  const cisternDepth = depth * 0.22;
  const cisternY = halfDepth - cisternDepth;
  const cistern = rect(-width * 0.42, cisternY, width * 0.84, cisternDepth);
  const bowlRy = depth * 0.34;
  const bowl = ellipse(0, cisternY - bowlRy, width * 0.36, bowlRy);

  return {
    footprint: `${cistern} ${bowl}`,
    strokes: [
      { id: 'cistern', d: cistern, dashArray: null },
      { id: 'bowl', d: bowl, dashArray: null },
    ],
    hasSwingArc: false,
  };
}

/** Chậu rửa — mặt bàn, lòng chậu, vòi nước phía tường. */
function basinSymbol(halfWidth: number, halfDepth: number): ObjectSymbol {
  const width = halfWidth * 2;
  const depth = halfDepth * 2;
  const tapRadius = Math.min(width, depth) * 0.06;

  return {
    footprint: rect(-halfWidth, -halfDepth, width, depth),
    strokes: [
      { id: 'counter', d: rect(-halfWidth, -halfDepth, width, depth), dashArray: null },
      { id: 'bowl', d: ellipse(0, 0, width * 0.34, depth * 0.3), dashArray: null },
      { id: 'tap', d: ellipse(0, halfDepth - depth * 0.15, tapRadius, tapRadius), dashArray: null },
    ],
    hasSwingArc: false,
  };
}

/**
 * Ký hiệu kiến trúc của một đối tượng, trong hệ toạ độ cục bộ của nó.
 *
 * Hàm THUẦN: cùng đầu vào ra cùng chuỗi, không đọc đồng hồ, không đọc kho,
 * không có số ngẫu nhiên — nên nó so được từng ký tự trong bài kiểm.
 *
 * `swing` thắng `subtype` ở nhánh cửa đi: một `singleDoor` mang `swing:
 * 'double'` là dữ liệu tự mâu thuẫn, và hình vẽ phải nói đúng cái hướng mở mà
 * người duyệt sẽ sửa, chứ không phải cái tên loại mà họ chưa sửa.
 */
export function buildObjectSymbol(request: ObjectSymbolRequest): ObjectSymbol {
  const halfWidth = request.width / 2;
  const halfDepth = request.depth / 2;

  switch (request.subtype) {
    case 'singleDoor':
    case 'doubleDoor': {
      if (request.swing === 'sliding') {
        return slidingDoor(halfWidth, halfDepth);
      }

      if (request.swing === 'double' || request.subtype === 'doubleDoor') {
        return doubleDoor(halfWidth, halfDepth);
      }

      return hingedDoor(halfWidth, halfDepth, request.swing !== 'right');
    }
    case 'window':
      return windowSymbol(halfWidth, halfDepth, request.swing === 'sliding');
    case 'bed':
      return bedSymbol(halfWidth, halfDepth);
    case 'sofa':
      return sofaSymbol(halfWidth, halfDepth);
    case 'diningTable':
      return diningTableSymbol(halfWidth, halfDepth);
    case 'toilet':
      return toiletSymbol(halfWidth, halfDepth);
    case 'basin':
      return basinSymbol(halfWidth, halfDepth);
    default:
      return windowSymbol(halfWidth, halfDepth, false);
  }
}

/* -------------------------------------------------------------------------- */
/* Menu chuột phải — dựng ra DỮ LIỆU, không dựng ra thẻ.                       */
/* -------------------------------------------------------------------------- */

/** Bốn hành động menu chuột phải có thể gọi. Vắng mặt cái nào thì mục đó không hiện. */
export interface ObjectContextMenuActions {
  readonly onApprove?: ((objectId: string) => void) | undefined;
  readonly onDelete?: ((objectId: string) => void) | undefined;
  readonly onChangeSubtype?: ((objectId: string, subtype: ObjectSubtype) => void) | undefined;
  readonly onAttachToNearestWall?: ((objectId: string) => void) | undefined;
}

/**
 * Các mục menu chuột phải của một đối tượng.
 *
 * Hàm THUẦN, và nằm ở file `.ts` chứ không ở view, vì một menu là DỮ LIỆU: nó
 * kiểm được bằng cách đếm mục và đọc nhãn, không cần dựng một cây DOM nào.
 *
 * Mỗi mục chỉ nói "đối tượng này, việc này". "Gắn vào tường gần nhất" KHÔNG tìm
 * tường nào — việc đó thuộc M-08 ở tầng hook (CẤM TUYỆT ĐỐI). "Đổi loại" chỉ
 * hiện cho hai lớp cửa và luôn đổi sang lớp còn lại: một món nội thất không đổi
 * thành một cái cửa được, và mời người duyệt làm thế là mời họ vào một lệnh sẽ
 * bị M-08 từ chối.
 *
 * Mảng rỗng có nghĩa "không mở menu": ở vai Người xem không callback nào được
 * truyền vào, và một menu rỗng còn khó hiểu hơn là không có menu.
 */
export function buildObjectContextMenuItems(
  placement: ObjectPlacementViewModel,
  actions: ObjectContextMenuActions,
): readonly ContextMenuItem[] {
  const items: ContextMenuItem[] = [];
  const { onApprove, onChangeSubtype, onAttachToNearestWall, onDelete } = actions;

  if (onApprove !== undefined) {
    items.push({
      id: 'approve',
      label: OBJECT_CANVAS_MENU_LABELS.approve,
      action: () => onApprove(placement.id),
    });
  }

  if (onChangeSubtype !== undefined && placement.layer === 'door') {
    items.push({
      id: 'to-window',
      label: OBJECT_CANVAS_MENU_LABELS.toWindow,
      action: () => onChangeSubtype(placement.id, 'window'),
    });
  }

  if (onChangeSubtype !== undefined && placement.layer === 'window') {
    items.push({
      id: 'to-door',
      label: OBJECT_CANVAS_MENU_LABELS.toDoor,
      action: () => onChangeSubtype(placement.id, 'singleDoor'),
    });
  }

  if (onAttachToNearestWall !== undefined && placement.isOrphan) {
    items.push({
      id: 'attach',
      label: OBJECT_CANVAS_MENU_LABELS.attach,
      action: () => onAttachToNearestWall(placement.id),
    });
  }

  if (onDelete !== undefined) {
    items.push({
      id: 'remove',
      label: OBJECT_CANVAS_MENU_LABELS.remove,
      isDestructive: true,
      action: () => onDelete(placement.id),
    });
  }

  return items;
}

/** Toạ độ bốn tay cầm 6px của hộp chọn, mỗi tay cầm căn giữa lên một góc. */
export function selectionHandleRects(bounds: ObjectRectPx): readonly ObjectRectPx[] {
  const half = SELECTION_HANDLE_SIZE_PX * 0.5;

  return SELECTION_HANDLE_CORNERS.map((corner) => ({
    x:
      (corner === 'topRight' || corner === 'bottomRight' ? bounds.x + bounds.width : bounds.x) -
      half,
    y:
      (corner === 'bottomLeft' || corner === 'bottomRight' ? bounds.y + bounds.height : bounds.y) -
      half,
    width: SELECTION_HANDLE_SIZE_PX,
    height: SELECTION_HANDLE_SIZE_PX,
  }));
}
