/**
 * Phần KHÔNG phải JSX của lớp canvas màn Duyệt lớp tường: hợp đồng props mở
 * rộng, token màu theo độ dày, mẫu gạch chéo cho mục dưới ngưỡng tin cậy, và
 * bộ nối chuỗi toạ độ cho `<polygon>`.
 *
 * Tên file nói "hatch" vì gạch chéo là phần chưa từng có trong repo (mục
 * NOT FOUND #4 của `docs/contracts/canvas.md`) và vì danh sách file T7 được
 * phép tạo chỉ có ba tên, trong đó đây là tên `.ts` duy nhất. Mọi thứ dựng
 * được mà không cần một thẻ nào đều ở đây, để `WallLayerCanvas.tsx` chỉ còn
 * việc dựng thẻ và ở dưới trần 400 dòng của R-22.
 *
 * ## Vì sao gạch chéo phải viết mới
 *
 * Repo có đúng một tiền lệ kỹ thuật — `ScaleCalibrationCanvas.tsx:366`, một
 * `repeating-linear-gradient(45deg, var(--state-attention) 0 1px, transparent 1px 6px)`
 * — nhưng tham số của nó (nét 1px, chu kỳ 6px, không có độ mờ riêng) KHÁC đặc
 * tả màn này (nét 2px, độ mờ 6%). Ở đây vẽ bằng `<pattern>` của SVG thay vì
 * gradient CSS vì lớp tường là `<polygon>` trong SVG chứ không phải `<div>`:
 * `fill="url(#…)"` bám theo đúng hình đa giác, gradient CSS thì chỉ bám theo
 * hộp chữ nhật bao ngoài.
 *
 * ## Vì sao KHÔNG BAO GIỜ đổi sang màu khác
 *
 * Thang cần chú ý (`--state-attention`) là thang P-06 dành cho "cần người xem
 * lại". Đỏ đặc (`--state-violation`) là màu của VI PHẠM — một tường mà máy chưa
 * chắc chắn thì không phải một tường sai. Đây là cấm tuyệt đối của đặc tả, và
 * cũng là lý do `WallRowViewModel.statusCode` của `types.ts` ghi rõ "không bao
 * giờ `'violation'` ở màn này".
 */

import { wallStrokeToken } from '@/components/canvas/materialMap';
import type { Point, WallId } from '@/domain/spatial/types';
import type { MeasurementState, Point as PointPx } from '@/hooks/useMeasurementLabel';

import type {
  WallLayerCanvasProps,
  WallLayerScreenState,
  WallShapeViewModel,
  WallThicknessChoice,
} from './types';
import { WALL_THICKNESS_CHOICES } from './types';

/* -------------------------------------------------------------------------- */
/* Màu tô theo ĐỘ DÀY.                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Ba băng độ dày, dạng `number[]` để `includes` nhận một số bất kỳ.
 *
 * `WALL_THICKNESS_CHOICES` là `readonly [110, 220, 330]`, nên `includes` của nó
 * chỉ nhận đúng ba giá trị đó — vô dụng cho việc đang cần, là hỏi "số này có
 * thuộc ba băng không" về một `thicknessMm` thô có thể là 175 hay 90 (xem
 * `wallLayerReviewFixture.ts`, W-006..W-008).
 */
const THICKNESS_BANDS: readonly number[] = WALL_THICKNESS_CHOICES;

/**
 * Token của tường có độ dày KHÔNG thuộc ba băng.
 *
 * Cùng giá trị với nhánh `default` của `wallStrokeToken`
 * (`src/components/canvas/materialMap.ts`), thứ mà kiểu `WallThickness` khiến
 * không gọi tới được: hàm đó chỉ nhận `110 | 220 | 330 | 'CONCRETE_COLUMN'`, nên
 * một tường 175 mm không qua được typecheck nếu truyền thẳng vào.
 */
const UNBANDED_WALL_TOKEN = 'var(--wall-idle)';

/**
 * Tim tường — mảnh 1px, vẽ chồng lên đa giác, bật tắt bằng cờ của props.
 *
 * `docs/contracts/ui.md` mục I liệt kê `--wall-centerline` nhưng token đó
 * KHÔNG tồn tại trong `src/styles/globals.css` (đã grep toàn repo: chỉ một
 * kết quả, chính dòng tài liệu đó). `src/styles/**` nằm ngoài danh sách file
 * T7 được sửa, nên ở đây dùng cú pháp dự phòng của CSS: lấy `--wall-centerline`
 * nếu ngày nào đó nó được thêm vào, còn hôm nay rơi về `--wall-idle` — sáng
 * hơn cả ba băng tường nên nhìn thấy trên mọi nền tường. Vẫn là token, không
 * mã màu thô (A1).
 */
/*
 * Tim tường vẽ bằng `--wall-idle`, KHÔNG phải `--wall-centerline`.
 *
 * Đặc tả nêu tên token `--wall-centerline`, nhưng token đó KHÔNG TỒN TẠI: không
 * có trong `src/styles/globals.css` (bốn token tường khai ở dòng 180-183 là
 * `--wall-110/220/330/idle`) và không có trong `tailwind.config.ts:66-69`. Bản
 * trước viết `var(--wall-centerline, var(--wall-idle))`, tức là LUÔN rơi về dự
 * phòng — một tham chiếu chết đội lốt một lựa chọn.
 *
 * `--wall-idle` là token SÁNG NHẤT trong bốn token tường của
 * `src/styles/globals.css` — sáng hơn cả ba băng độ dày — nên tim tường đọc
 * được trên cả ba nền. Thêm một token mới vào `src/styles/**` nằm ngoài phạm vi
 * lượt này.
 */
export const WALL_CENTRELINE_TOKEN = 'var(--wall-idle)';

/** `true` khi độ dày thuộc đúng một trong ba băng hệ thiết kế sơn được. */
export function isThicknessBand(thicknessMm: number): thicknessMm is WallThicknessChoice {
  return THICKNESS_BANDS.includes(thicknessMm);
}

/**
 * Token màu tô của một tường, theo ĐỘ DÀY.
 *
 * Ba băng cho ra ba độ sáng tương đối 0,4166 / 0,2297 / 0,0947 (bảng đo thật ở
 * `docs/contracts/canvas.md` mục E.1) — mỗi bậc giảm gần một nửa, nên ba băng
 * phân biệt được cả khi ảnh chuyển thang xám. Đây là lớp phân biệt THỨ NHẤT;
 * lớp thứ hai là bề rộng hình học của chính đa giác và không nằm ở file này.
 */
export function wallThicknessFillToken(thicknessMm: number): string {
  return isThicknessBand(thicknessMm) ? wallStrokeToken(thicknessMm) : UNBANDED_WALL_TOKEN;
}

/* -------------------------------------------------------------------------- */
/* Gạch chéo cho mục dưới ngưỡng tin cậy.                                      */
/* -------------------------------------------------------------------------- */

/** `id` của `<pattern>` gạch chéo; `fill="url(#…)"` trỏ vào đây. */
export const WALL_HATCH_PATTERN_ID = 'wall-layer-review-hatch';

/** Cạnh một ô lát của mẫu, tính bằng đơn vị người dùng của SVG (= px bản vẽ). */
export const WALL_HATCH_TILE_PX = 12;

/** Nét gạch 2px — đúng đặc tả. */
export const WALL_HATCH_LINE_WIDTH_PX = 2;

/** Độ mờ 6% — đúng đặc tả. Gạch chéo là gợi ý, không phải cảnh báo. */
export const WALL_HATCH_OPACITY = 0.06;

/** Phép quay của mẫu lát, chuỗi đã dựng sẵn cho `patternTransform`. 45 độ. */
export const WALL_HATCH_PATTERN_TRANSFORM = 'rotate(45)';

/** Thang cần chú ý của P-06 — dùng cho cả nét gạch lẫn chấm cần chú ý. */
export const ATTENTION_TOKEN = 'var(--state-attention)';

/** Bán kính chấm cần chú ý, đơn vị người dùng của SVG. */
export const ATTENTION_DOT_RADIUS_PX = 5;

/* -------------------------------------------------------------------------- */
/* Ảnh bản vẽ gốc.                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Ảnh gốc nằm dưới ở 20% độ mờ — lớp dữ liệu vẽ đè lên.
 *
 * 0,2 là số bố cục, không phải màu (A1) và không phải số nghiệp vụ cần định
 * dạng (A15); repo không có hằng độ mờ nào đặt tên sẵn cho việc này
 * (`docs/contracts/canvas.md` mục NOT FOUND #5), nên nó được đặt tên ở đây.
 */
export const BACKGROUND_IMAGE_OPACITY = 0.2;

/* -------------------------------------------------------------------------- */
/* Đa giác.                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Đa giác đã tính sẵn → thuộc tính `points` của `<polygon>`.
 *
 * Nối chuỗi, KHÔNG tính hình học: từng điểm đi thẳng từ `WallShape.outline` mà
 * hook đã dựng bằng `resolveWallShapes`, không lệch một đơn vị. Canvas không
 * tự offset theo độ dày, không tự tìm giao điểm hai tường, không tự tính pháp
 * tuyến — toàn bộ việc đó đã xong trước khi mảng điểm này tới đây.
 */
export function toSvgPoints(outline: readonly Point[]): string {
  return outline.map((point) => `${point.x},${point.y}`).join(' ');
}

/* -------------------------------------------------------------------------- */
/* MỞ RỘNG HỢP ĐỒNG PROPS — đọc trước khi nối hook vào canvas.                 */
/* -------------------------------------------------------------------------- */

/*
 * `WallLayerCanvasProps` của `types.ts` là hợp đồng ĐÓNG BĂNG và không file nào
 * ở lớp canvas sửa nó. Nhưng nó KHÔNG ĐỦ để dựng những gì đặc tả màn đòi, và
 * phần thiếu không bù được bằng cách tự tính — tự tính đúng là thứ luật "không
 * một phép hình học nào trong màn" cấm. Cách mở rộng hợp lệ mà chính `types.ts`
 * chỉ ra ("MỞ RỘNG kiểu ở file riêng, đúng khuôn `UseScaleCalibrationHookOptions
 * extends UseScaleCalibrationOptions`") được dùng ở đây: `WallLayerCanvasViewProps`
 * `extends WallLayerCanvasProps`, thuần cộng thêm, không đổi một trường nào đã
 * khai.
 *
 * Từng trường thêm vào, và lý do canvas không tự dựng được nó:
 *
 * - `WallLayerCanvasShape.thicknessMm` — màu tô theo độ dày cần con số đó. Suy
 *   ngược từ `outline` là đo bề rộng một đa giác, tức là hình học.
 * - `WallLayerCanvasShape.centrelinePx` — `showCentrelines` đã có trong hợp
 *   đồng gốc nhưng ĐƯỜNG tim thì không. Suy ra từ `outline` là hình học.
 * - `WallLayerCanvasShape.boundsPx` — `SelectionHalo` nhận x/y/rộng/cao bằng px.
 *   Tìm hộp bao của một đa giác là hình học.
 * - `WallLayerCanvasShape.isLowConfidence` — cổng bật gạch chéo. Ngưỡng sống ở
 *   `materialMap.isLowConfidence`, và R-71 cấm viết lại ngưỡng trong màn.
 * - `WallLayerCanvasShape.codeLabel` — tên đọc được của từng tường ("#W-014")
 *   cho trình đọc màn hình; ghép chuỗi từ `id` ở view là định dạng, A15 cấm.
 * - `state` — canvas phải phân biệt `loading` (khung xương) với `empty` (lưới)
 *   với `error` (ảnh gốc, không tường). Ba nhánh đó không đọc ra được từ việc
 *   `shapes` rỗng hay không.
 * - `viewport`, `drawingSizePx`, `contentBoundsPx` — khung nhìn dịch chuyển
 *   bằng chuyển động dịu chứ không nhảy, và bản đồ nhỏ cần biết vẽ vùng nào.
 *   Cả ba là kết quả của phép khớp khung, tức là hình học.
 * - `canvasLabel` — nhãn `aria-label` có số liệu ("… — 48 tường"); ghép số vào
 *   chuỗi ở view là định dạng, A15 cấm.
 * - `isWallLayerVisible`, `legendLevels` — chú giải hiện theo cờ lớp Tường của
 *   cây lớp, nội dung sinh từ P-07 (`generateLegend`).
 * - `measurement` — nhãn đo của công cụ đo; `MeasurementLabel` nhận chuỗi
 *   khoảng cách ĐÃ định dạng, không tự tính.
 * - `prefersReducedMotion` — cùng khuôn `ScaleCalibrationCanvasProps`.
 * - `onApprove` / `onRequestThicknessChange` / `onRequestSplit` / `onDelete` —
 *   bốn mục menu chuột phải. Hai mục giữa là YÊU CẦU chứ không phải lệnh:
 *   `WallLayerViewProps.onChangeThickness` cần một `thicknessMm`, `onSplit` cần
 *   một điểm cắt, và canvas không có cách nào biết hai thứ đó mà không tự tính.
 *   Nên menu chỉ nói "tường này, việc này", còn việc chọn độ dày nào hay cắt ở
 *   đâu thuộc về thanh tra và công cụ tách đoạn.
 *
 * MỌI TOẠ ĐỘ trong hợp đồng mở rộng này đã là PIXEL của ảnh bản vẽ — canvas
 * không quy đổi mm↔px. `WallLayerCanvasProps.millimetresPerPixel` đi thẳng
 * xuống `GridLayer.scaleRatioMmPerPx` để lưới kỹ thuật biết bước 100/1000 mm
 * dài bao nhiêu pixel, và không dùng vào việc gì khác ở lớp canvas.
 */

/** Một hình chữ nhật trên ảnh bản vẽ, đơn vị pixel. */
export interface WallLayerRectPx {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Kích thước ảnh bản vẽ, đơn vị pixel. */
export interface WallLayerSizePx {
  readonly width: number;
  readonly height: number;
}

/** Khung nhìn: dịch bao nhiêu pixel và phóng bao nhiêu lần. */
export interface WallLayerViewportPx {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

/** Nhãn đo của công cụ đo — mọi toạ độ bằng px, khoảng cách đã thành chuỗi. */
export interface WallLayerMeasurementPx {
  readonly state: MeasurementState;
  readonly startPx: PointPx | null;
  readonly currentPx: PointPx | null;
  readonly midPx: PointPx | null;
  /** Ví dụ `"4.250,00 mm"` — đã định dạng ở hook (A15). */
  readonly distanceLabel: string;
}

/** {@link WallShapeViewModel} cộng năm trường canvas không tự dựng được. */
export interface WallLayerCanvasShape extends WallShapeViewModel {
  /** Ví dụ `"#W-014"`. */
  readonly codeLabel: string;
  /** Độ dày thô, mm — có thể ngoài ba băng (fixture có 175/235/90). */
  readonly thicknessMm: number;
  /** Tim tường, hai đầu bằng px. Vẽ khi `showCentrelines` bật. */
  readonly centrelinePx: { readonly start: PointPx; readonly end: PointPx };
  /** Hộp bao của đa giác, px — `SelectionHalo` bám vào nó. */
  readonly boundsPx: WallLayerRectPx;
  /** Tâm chấm cần chú ý, px. Tính ở hook (`centreOfBounds`), view chỉ đọc. */
  readonly attentionDotPx: PointPx;
  /** Cổng bật gạch chéo; ngưỡng sống ở `materialMap.isLowConfidence`. */
  readonly isLowConfidence: boolean;
}

/** Mọi thứ view canvas nhận. Thuần cộng thêm lên `WallLayerCanvasProps`. */
export interface WallLayerCanvasViewProps extends WallLayerCanvasProps {
  readonly shapes: readonly WallLayerCanvasShape[];
  readonly state: WallLayerScreenState;
  /** `aria-label` của khung, có số liệu — ví dụ `"Mặt bằng tầng 1 — 48 tường"`. */
  readonly canvasLabel: string;
  readonly viewport: WallLayerViewportPx;
  /** Kích thước ảnh bản vẽ. `null` khi chưa có ảnh. */
  readonly drawingSizePx: WallLayerSizePx | null;
  /** Vùng chứa hết đa giác, cho bản đồ nhỏ. `null` khi chưa có tường nào. */
  readonly contentBoundsPx: WallLayerRectPx | null;
  /** Cờ lớp Tường của cây lớp — chú giải hiện theo cờ này. */
  readonly isWallLayerVisible: boolean;
  /** Những băng độ dày có thật trên tầng, sinh từ P-07 (`generateLegend`). */
  readonly legendLevels: readonly WallThicknessChoice[];
  /** `null` khi công cụ đo không chạy. */
  readonly measurement: WallLayerMeasurementPx | null;
  readonly prefersReducedMotion: boolean;
  readonly onApprove: (wallId: WallId) => void;
  /** Xin đổi độ dày: đưa tiêu điểm về điều khiển ba lựa chọn của thanh tra. */
  readonly onRequestThicknessChange: (wallId: WallId) => void;
  /** Xin tách đoạn: bật công cụ tách đoạn trên tường này. */
  readonly onRequestSplit: (wallId: WallId) => void;
  /** Xoá dùng vé hoàn tác (A8) — không hộp thoại. */
  readonly onDelete: (wallId: WallId) => void;

  /* -- Khung nhìn: cụm thu phóng và bản đồ nhỏ (T8) ----------------------- */

  /*
   * Bảy trường dưới đây đến sau bản đầu của file này, và có lý do.
   *
   * Bản đầu ghi nhận `ZoomCluster`/`MiniMap` "chưa nhận props để lái ngược
   * lại", nên canvas dựng chúng trần: bấm được mà không đổi được gì. A2 nói
   * màu nhấn dành cho thứ THỰC SỰ tương tác được, nên một cụm nút chết là đúng
   * thứ A2 tồn tại để chặn. Người duyệt đã chấp thuận một ngoại lệ R-68 có chủ
   * đích và hai component đó nay nhận props (`ZoomCluster.tsx:16-20`,
   * `MiniMap.tsx:15-22`, thuần cộng thêm, tương thích ngược).
   *
   * Hai trường cuối đi NGƯỢC — canvas báo lên hook, không phải hook truyền
   * xuống — và đó là cách giữ lời hứa "không hình học trong màn": view chỉ
   * chuyển tiếp những con số do TRÌNH DUYỆT cấp (`ResizeObserver`,
   * `getBoundingClientRect`), còn mọi phép quy đổi px↔mm và mọi phép so sánh
   * khung đều xảy ra ở hook.
   */

  /** Mức phóng theo phần trăm, đã tính ở hook — cụm thu phóng chỉ hiển thị (A15). */
  readonly zoomPercent: number;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onResetZoom: () => void;
  /** Phím `F` và nút "vừa khung": phủ khắp vùng đang chọn, hoặc cả bản vẽ khi chưa chọn gì. */
  readonly onFitToScreen: () => void;
  /** Vùng nhìn bản đồ nhỏ, đơn vị PHẦN TRĂM khổ bản vẽ — đúng đơn vị `useMiniMap` dùng. */
  readonly miniMapViewport: WallLayerViewportRectPercent;
  /** Người dùng kéo/bấm trên bản đồ nhỏ; hook dịch tâm nhìn theo. */
  readonly onMiniMapViewportChange: (rect: WallLayerViewportRectPercent) => void;
  /** Khung canvas đổi kích thước — hook cần số này để "vừa khung" khớp thật. */
  readonly onFrameResize: (size: WallLayerSizePx) => void;
  /** Con trỏ trên bản vẽ, số thô của trình duyệt. `null` khi con trỏ rời khung. */
  readonly onPointerMove: (position: WallLayerPointerReading | null) => void;

  /* -- Cử chỉ của máy công cụ: vẽ tường, tách đoạn, đo -------------------- */

  /*
   * Trước lượt sửa này máy công cụ chỉ nhận `{ type: 'activate' }`, nên ba
   * trong bốn công cụ của ray là nút chết: bấm `W` đổi được biểu tượng đang
   * sáng và KHÔNG vẽ được gì, `M` cũng vậy, còn mục "Tách đoạn" của menu chuột
   * phải chỉ bật công cụ rồi đứng im. Thứ thiếu là một đường cho CỬ CHỈ đi từ
   * canvas lên máy công cụ, và nó chỉ cần đúng một hàm: một điểm đã bấm.
   *
   * Điểm vào đây là PIXEL BẢN VẼ, cùng đơn vị và cùng cách đọc với
   * `onPointerMove` (`getScreenCTM().inverse()`), nên view vẫn không trừ,
   * không chia, không nhân. Hook quy nó ra milimét bằng `scale.pixelsToMillimetres`
   * rồi giao cho `reduceTool`; chọn tường (bước `entity` của công cụ tách đoạn)
   * đi qua `onSelect` sẵn có, không cần một hàm thứ hai.
   *
   * KHÔNG có `onCanvasCommit` riêng: `reduceTool` chuyển sang `confirming`
   * ngay khi đủ số điểm, và hook chốt luôn trong cùng lượt — một cử chỉ hai
   * điểm không có bước xác nhận nào để người dùng bấm. KHÔNG có
   * `onCanvasCancel` riêng: huỷ là đổi công cụ (`activate` reset máy), đường
   * đã có sẵn trên ray công cụ và trên phím `V`. Thêm hai prop mà không nơi
   * gọi nào truyền là đúng thứ R-73 chặn.
   */

  /** Một điểm vừa bấm trên bản vẽ, pixel. Máy công cụ nhận nó làm bước kế tiếp. */
  readonly onCanvasPoint: (at: WallLayerPointerReading) => void;
  /** Ctrl/Cmd-bấm một hình tường: thêm/bớt khỏi vùng chọn (S-10), không thay cả vùng. */
  readonly onToggleSelect: (wallId: WallId) => void;
}

/**
 * Vùng nhìn của bản đồ nhỏ, đơn vị phần trăm (0..100) khổ bản vẽ.
 *
 * Cùng hình dạng và cùng đơn vị với `ViewportRect` của `src/hooks/useMiniMap.ts`
 * — chép lại ở đây để lớp canvas không phải nhập một kiểu từ `src/hooks/**`, và
 * để nơi gọi đọc được đơn vị ngay tại chỗ khai.
 */
export interface WallLayerViewportRectPercent {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Một lượt đọc con trỏ, ĐÃ LÀ PIXEL BẢN VẼ.
 *
 * Việc đổi toạ độ chuột sang pixel bản vẽ do CHÍNH TRÌNH DUYỆT làm, qua ma trận
 * biến đổi của `<svg>` (`getScreenCTM().inverse()`): `<svg>` mang `viewBox`
 * đúng bằng khổ ảnh bản vẽ tính theo pixel, nên một đơn vị người dùng của nó là
 * đúng một pixel bản vẽ — và ma trận đó đã gộp sẵn cả phép dịch lẫn mức phóng
 * của khung nhìn.
 *
 * Vì thế view KHÔNG trừ, KHÔNG chia, KHÔNG nhân một phép nào: nó hỏi trình
 * duyệt một câu và chuyển tiếp câu trả lời. Đây là lý do thư mục màn qua được
 * cả `local/no-raw-number` (cấm quy đổi đơn vị bằng phép chia trong
 * `src/screens`) lẫn `grep "Math\."` rỗng, mà thanh trạng thái vẫn có toạ độ
 * thật để hiện. Hook chỉ còn một việc: pixel → milimét bằng
 * `scale.pixelsToMillimetres` của `src/domain/units/scale.ts`.
 */
export interface WallLayerPointerReading {
  readonly xPx: number;
  readonly yPx: number;
}

/* -------------------------------------------------------------------------- */
/* GHI CHÚ THIẾT KẾ CỦA LỚP CANVAS                                             */
/* -------------------------------------------------------------------------- */

/*
 * ## Vẽ bằng SVG
 *
 * Theo đúng kết luận mục H của `docs/contracts/canvas.md`: `GridLayer`,
 * `CadLayerPreviewCanvas` và `CanvasIntegration.stories` đều là SVG, và không
 * nơi nào trong repo dùng `getContext('2d')` để vẽ mặt bằng. Khối biến đổi
 * (`<div>` mang `transform`) có kích thước đúng bằng ảnh bản vẽ tính theo px,
 * và `<svg>` bên trong lấy `viewBox` cùng số đó — nên một đơn vị người dùng của
 * SVG là đúng một pixel bản vẽ, và toạ độ trong props rơi đúng chỗ mà không cần
 * một phép quy đổi nào ở lớp view.
 *
 * Gốc `<svg>` mang `role="img"` cộng `aria-label` tiếng Việt có số liệu, đúng
 * khuôn `CadLayerPreviewCanvas.tsx:256-260` đã đi qua `expectAccessible`. Bàn
 * phím đi qua danh sách tường ở panel phải (A12) chứ không qua từng đa giác:
 * `role="img"` biến cả cây con thành một khối không focus được, nên nhét nút
 * bấm vào trong nó là tự phá chính khuôn vừa chép.
 *
 * ## Hai lớp phân biệt ba độ dày, độc lập nhau
 *
 * 1. **Màu** — `wallThicknessFillToken` cho ba token `--wall-110/220/330`, độ
 *    sáng tương đối 0,4166 / 0,2297 / 0,0947. Mỗi bậc giảm gần một nửa, nên ba
 *    băng vẫn tách nhau khi ảnh chuyển thang xám.
 * 2. **Bề rộng hình học** — đa giác rộng đúng độ dày thật, nên 110 : 220 : 330
 *    ra tỉ lệ bề rộng 1 : 2 : 3 trên màn. Lớp này đúng kể cả khi mất sạch màu.
 *
 * Hai lớp KHÔNG hợp nhất: mất lớp nào cũng còn lớp kia, đó là điều kiện của
 * nghiệm thu "che hết chữ vẫn phân biệt được ba độ dày".
 *
 * Màu tô nói ĐỘ DÀY, không nói trạng thái duyệt. Trạng thái duyệt nói bằng kênh
 * khác: chấm cần chú ý và gạch chéo cho mục dưới ngưỡng tin cậy. Xanh "đã xác
 * minh" không xuất hiện trên đa giác nào — A5 dành màu đó cho việc người duyệt.
 *
 * ## Bảy trạng thái, phần thuộc canvas
 *
 * | Trạng thái  | Canvas |
 * |-------------|--------|
 * | `loading`   | khung xương `Skeleton preset="canvas"`; chú giải vẫn hiện |
 * | `error`     | **ảnh gốc vẫn xem được**; chỉ lớp dữ liệu tường vắng mặt |
 * | `empty`     | ảnh gốc + lưới, không đa giác nào |
 * | `partial`   | trạng thái chính |
 * | `success`   | như `partial` |
 * | `collapsed` | canvas chiếm hết khung; chú giải và cụm nổi vẫn hiện |
 * | `forbidden` | `isInteractive: false` — không menu chuột phải, không chọn |
 *
 * Điểm dễ sai nhất là `error`: canvas KHÔNG bị thay bằng một thông báo lỗi. Ảnh
 * gốc đến từ một truy vấn khác (`queryKeys.drawing.byFloor`) với lớp hình học
 * (`queryKeys.space.byFloor`), nên nó đứng nguyên khi lớp kia hỏng. Câu thông
 * báo lỗi thuộc về panel, không thuộc về canvas. Chú giải độ dày thì hiện ở CẢ
 * BẢY nhánh khi lớp Tường bật — xem `WallLayerLegend.tsx`.
 *
 * ## Hai hạn chế đã biết của component dùng chung, KHÔNG phải nợ của lớp canvas
 *
 * - `ZoomCluster` giữ mức thu phóng trong `useZoomCluster` của chính nó và
 *   không nhận props nào để nối ra ngoài, nên nút của nó chưa lái được
 *   `viewport` truyền vào canvas. Nối được đòi thêm props cho
 *   `src/components/canvas/ZoomCluster.tsx` — ngoài danh sách file T7 được sửa.
 * - `MiniMap` cũng vậy với `useMiniMap`; nó nhận nội dung thu nhỏ thật qua
 *   `children`, nhưng khung nhìn của nó chưa đi theo `viewport`.
 */
