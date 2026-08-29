/**
 * Hợp đồng props của màn Hiệu chỉnh tỷ lệ (`ScaleCalibration`) — route
 * `ROUTE_PATTERNS.projectScale` (`/projects/:id/floors/:floorId/scale`).
 *
 * Đây là XƯƠNG SỐNG của màn: file này là API công khai DUY NHẤT giữa người viết
 * hook (`useScaleCalibration.ts`) và ba người viết view
 * (`ScaleCalibration.tsx`, `ScaleCalibrationCanvas.tsx`,
 * `ScaleCalibrationPanel.tsx` + hai phần con theo phương pháp). Không ai trong
 * số họ được sửa file này; thiếu một kiểu thì DỪNG và hỏi điều phối viên
 * (R-69), không tự thêm.
 *
 * Ba luật định hình mọi trường bên dưới:
 *
 * - **A15 — định dạng xảy ra ở hook, không ở view.** Mọi chuỗi người đọc ở đây
 *   đã là tiếng Việt có dấu và đã ghép xong; dấu thập phân là dấu phẩy. View
 *   không còn con số nào phải làm tròn, chia, hay đổi đơn vị.
 * - **R-60 — view thuần.** View chỉ được `import type` từ `src/domain`, không
 *   gọi hàm ở đó. Nên mọi giá trị view *tạo ra* (toạ độ con trỏ, điểm kéo) đi
 *   ra ngoài dưới dạng **tỉ lệ 0..1 của khung ảnh** ({@link ImageRatioPoint}) —
 *   thứ view đọc thẳng từ sự kiện DOM — còn mọi giá trị view *nhận vào* mà là
 *   một phép đo thì mang nhãn đơn vị của `src/domain/units` ({@link Pixels},
 *   {@link Millimetres}, {@link MillimetresPerPixel}). View không bao giờ phải
 *   gắn nhãn cho một con số, vì nó không import được `pixels()`.
 * - **A11 — đúng bảy trạng thái**, tên lấy nguyên văn từ `SEVEN_STATES`
 *   (`src/lib/testing/sevenStateScenarios.ts`), kể cả `'success'`.
 *
 * ## Nguyên tắc riêng của màn này: HIỆN PHÉP TÍNH RA
 *
 * `4.800 mm ÷ 400 px = 12 mm/px` là lý do màn tồn tại. Vì vậy
 * {@link ScaleComputationViewModel} tách phép tính làm **ba phần** thay vì một
 * câu đã ghép: view buộc phải đặt cả tử số, cả mẫu số và cả kết quả xuống, và
 * không có cách nào rút gọn nó thành mỗi kết quả.
 *
 * ## Cảnh báo KHÔNG CHẶN
 *
 * `panel.canApply` **không** phụ thuộc vào {@link ScaleWarningNotice}. Một tỷ lệ
 * vô lý, hay lệch quá 15% so với ước tính của AI, vẫn áp được — người dùng là
 * kỹ sư và họ có thể đúng. Cảnh báo nói ra hậu quả, không khoá nút.
 *
 * ## Vì sao không có `ScaleCalibrationStatusBarProps`
 *
 * Thanh trạng thái 32px là `src/components/shell/StatusBar.tsx` đã có sẵn
 * (`h-8`, ba mục). "Không tạo component mới" nghĩa là màn này TÁI SỬ DỤNG nó,
 * nên chỗ hợp đồng cần không phải một bộ props thứ hai mà là một mảnh viewmodel
 * khớp đúng chữ ký của nó: {@link ScaleStatusBarViewModel}. `ScaleCalibration.tsx`
 * viết `<StatusBar {...model.statusBar} />`, không hơn.
 *
 * ## KHOÁ SAU KHI XONG
 *
 * File này đóng băng. Muốn đổi hình dạng một trường thì `orca orchestration ask`
 * điều phối viên trước.
 */

import type {
  ManualCalibrationReason,
  MillimetresPerPixel,
  Pixels,
  Scale,
  ScaleInference,
  ScaleMeasurement,
} from '@/domain/units/scale';
import type { SnapTargetKind } from '@/domain/units/snap';
import type { Millimetres } from '@/domain/units/types';
import type { ViewportState } from '@/hooks/useCanvasViewport';
import type { ViewStatusCode } from '@/lib/viewmodel/types';
import type { ProjectRole } from '@/types/project';

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái (A11).                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Đúng bảy trạng thái của A11, tên lấy nguyên từ `SEVEN_STATES`.
 *
 * Ý nghĩa của từng nhánh trên màn này:
 *
 * | Trạng thái  | Nghĩa ở màn Hiệu chỉnh tỷ lệ                                     |
 * |-------------|------------------------------------------------------------------|
 * | `empty`     | OCR không đọc được chuỗi kích thước nào                           |
 * | `loading`   | đang tải ảnh bản vẽ đã nắn                                        |
 * | `partial`   | đã kéo đoạn nhưng chưa nhập chiều dài, HOẶC có chuỗi tin cậy thấp  |
 * | `error`     | nắn ảnh thất bại, bản vẽ có thể méo                               |
 * | `success`   | tỷ lệ đã áp, badge chuyển sang đã duyệt                           |
 * | `forbidden` | không có quyền, canvas không kéo được                             |
 * | `collapsed` | panel phải thu gọn                                                |
 */
export type ScaleCalibrationState =
  | 'empty'
  | 'loading'
  | 'partial'
  | 'error'
  | 'success'
  | 'forbidden'
  | 'collapsed';

/* -------------------------------------------------------------------------- */
/* Hai cách xác định tỷ lệ.                                                    */
/* -------------------------------------------------------------------------- */

/** Hai mục của SegmentedControl "Cách xác định". */
export type ScaleCalibrationMethod = 'dimensionString' | 'referenceLine';

/** Một mục của SegmentedControl, đã có nhãn tiếng Việt. */
export interface ScaleMethodOption {
  readonly value: ScaleCalibrationMethod;
  readonly label: string;
  /**
   * `true` cho `'dimensionString'` khi OCR không đọc được chuỗi nào (trạng thái
   * `empty`). Mục vẫn hiện — người dùng phải thấy phương pháp kia tồn tại —
   * nhưng không chọn được, và {@link ScalePanelViewModel.methodNotice} nói vì sao.
   */
  readonly isDisabled: boolean;
}

/** Ba bước của phương pháp "vẽ đường tham chiếu". */
export type ScaleReferenceStep = 'draw' | 'enterLength' | 'result';

/* -------------------------------------------------------------------------- */
/* Hình học trên khung ảnh — TỈ LỆ, không phải pixel.                          */
/* -------------------------------------------------------------------------- */

/**
 * Một điểm trên khung ảnh, theo tỉ lệ `0..1` của khung.
 *
 * Cùng lý lẽ `InputQualityRegion`: view chỉ nhân với kích thước đã render, nên
 * nó không cần biết ảnh gốc là 3000×3000 px và không phải quy đổi gì. Chiều đi
 * ngược lại cũng vậy — view báo vị trí con trỏ dưới dạng tỉ lệ, hook mới gắn
 * nhãn {@link Pixels}, vì view không import được `pixels()` (R-60).
 */
export interface ImageRatioPoint {
  readonly x: number;
  readonly y: number;
}

/** Hộp bao trên khung ảnh, theo tỉ lệ `0..1`. Dùng để bay khung nhìn tới. */
export interface ImageRatioBox {
  readonly min: ImageRatioPoint;
  readonly max: ImageRatioPoint;
}

/** Cờ phím bổ trợ đang giữ lúc kéo. `Shift` khoá đoạn theo trục. */
export interface ScalePointerModifiers {
  readonly isAxisLocked: boolean;
}

/** Hướng nhích một đầu đoạn bằng phím mũi tên. */
export type NudgeDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Bước nhích: `'fine'` là một pixel (mũi tên), `'coarse'` là mười
 * (Shift + mũi tên).
 *
 * Tên chứ không phải số, vì view không được viết hằng số (R-71) — con số thật
 * nằm ở hook, một chỗ duy nhất.
 */
export type NudgeStep = 'fine' | 'coarse';

/* -------------------------------------------------------------------------- */
/* Phương pháp 1 — chuỗi kích thước OCR đọc được.                              */
/* -------------------------------------------------------------------------- */

/**
 * Một chuỗi kích thước OCR đọc được, sẵn sàng để vẽ và để chọn.
 *
 * Mở rộng {@link ScaleMeasurement} của `src/domain/units/scale` chứ không khai
 * lại `id`/`pixelLength`/`realLength`: cùng một hàng này là thứ hook nạp thẳng
 * vào `inferScale()`, nên hai hình dạng phải là một.
 */
export interface DimensionStringRow extends ScaleMeasurement {
  /** Độ tin cậy của lần đọc, `0..1`. Cấp thẳng cho `ConfidenceMeter`. */
  readonly confidence: number;
  /**
   * `true` khi độ tin cậy dưới ngưỡng `CONFIDENCE_SUGGESTED_THRESHOLD`. View gạch
   * chéo hàng và tô mức cần chú ý — đây là nửa thứ hai của trạng thái `partial`.
   */
  readonly isLowConfidence: boolean;
  /** Hộp bao trên khung ảnh, để tô sáng và để bay khung nhìn tới (340 ms). */
  readonly boundingBox: ImageRatioBox;
  /** Giá trị chữ đều đã định dạng — ví dụ `"4.800"`. Không kèm đơn vị. */
  readonly valueLabel: string;
  /** Chiều dài pixel đo được, đã định dạng — ví dụ `"400 px"`. */
  readonly pixelLengthLabel: string;
  /**
   * Mức màu của hàng. `'attention'` khi {@link DimensionStringRow.isLowConfidence},
   * `'neutral'` còn lại. **Không bao giờ `'verified'`** — đây là đầu ra của AI,
   * và A5 dành xanh đã xác minh cho việc người duyệt làm.
   */
  readonly statusCode: ViewStatusCode;
}

/** Mọi thứ khối "từ chuỗi kích thước" cần. */
export interface ScaleDimensionMethodViewModel {
  readonly rows: readonly DimensionStringRow[];
  readonly selectedRowId: string | null;
  /** Câu giải thích khi không đọc được chuỗi nào. `null` khi có ít nhất một hàng. */
  readonly emptyNotice: string | null;
  /** Câu báo có bao nhiêu chuỗi tin cậy thấp. `null` khi không có hàng nào thấp. */
  readonly lowConfidenceNotice: string | null;
  /**
   * Vì sao `inferScale()` chưa cho phép áp tự động, khi nó chưa cho phép.
   * `null` khi suy ra được tỷ lệ. Lấy nguyên từ `ScaleInference`, không đặt lại tên.
   */
  readonly manualCalibrationReason: ManualCalibrationReason | null;
}

/* -------------------------------------------------------------------------- */
/* Phương pháp 2 — đường tham chiếu vẽ tay.                                    */
/* -------------------------------------------------------------------------- */

/** Đầu nào của đoạn đang được nói tới. */
export type ReferenceLineEndpoint = 'start' | 'end';

/**
 * Đoạn tham chiếu đang được vẽ hoặc đã vẽ xong.
 *
 * `null` ở {@link ScaleReferenceMethodViewModel.draft} nghĩa là chưa kéo lần nào.
 */
export interface ReferenceLineDraft {
  readonly start: ImageRatioPoint;
  readonly end: ImageRatioPoint;
  /** Chiều dài đoạn trên ảnh gốc. Gắn nhãn, nên không trộn được với mm. */
  readonly pixelLength: Pixels;
  /**
   * Loại điểm mà đầu đang kéo bắt được, theo bảng ưu tiên của
   * `src/domain/units/snap` (M-03). `null` khi không bắt vào đâu cả.
   */
  readonly snappedKind: SnapTargetKind | null;
  /** Đầu vừa bắt điểm. `null` khi {@link ReferenceLineDraft.snappedKind} là `null`. */
  readonly snappedEndpoint: ReferenceLineEndpoint | null;
  /** Đang giữ chuột kéo. Lúc này số pixel chạy theo thời gian thực (120 ms). */
  readonly isDragging: boolean;
  /** Đang giữ Shift, đoạn bị khoá theo trục ngang hoặc dọc. */
  readonly isAxisLocked: boolean;
}

/** Mọi thứ khối "vẽ đường tham chiếu" cần. */
export interface ScaleReferenceMethodViewModel {
  readonly draft: ReferenceLineDraft | null;
  /** Bước nào của ba bước đang mở. */
  readonly activeStep: ScaleReferenceStep;
  /**
   * Số pixel chữ đều hiện theo thời gian thực khi kéo — ví dụ `"400 px"`.
   * `null` khi chưa có đoạn nào.
   */
  readonly livePixelLengthLabel: string | null;
  /** Nội dung thô của ô "Chiều dài thật" — ô có kiểm soát, view không giữ state. */
  readonly realLengthText: string;
  /** Gợi ý sẵn trong ô — ví dụ `"4800"`. */
  readonly realLengthPlaceholder: string;
  /**
   * Chú giải lấy từ OCR — ví dụ `"OCR đọc được 4.800 ngay cạnh đoạn này"`.
   * `null` khi OCR không có gì để gợi.
   */
  readonly realLengthHint: string | null;
  /** Kết quả chữ đều lớn của bước 3 — ví dụ `"12 mm/px"`. `null` khi chưa đủ dữ liệu. */
  readonly resultLabel: string | null;
  /**
   * Gợi ý hiện **ngay khi gõ**, không đợi rời ô. `null` khi giá trị đang gõ hợp lý.
   * Đây là cùng một cảnh báo với {@link ScalePanelViewModel.warnings}, đặt cạnh ô
   * nhập để người dùng thấy hậu quả trước khi rời tay.
   */
  readonly inlineWarning: ScaleWarningNotice | null;
  /** `false` khi chưa có đoạn nào để đo lại. Phím `R`. */
  readonly canRemeasure: boolean;
}

/* -------------------------------------------------------------------------- */
/* Cảnh báo — dữ liệu ở đây, câu tiếng Việt ở hook.                            */
/* -------------------------------------------------------------------------- */

/** Hai loại cảnh báo màn này biết dựng. */
export type ScaleWarningKind = 'implausible' | 'deviatesFromEstimate';

/**
 * Cảnh báo dưới dạng DỮ LIỆU, không phải câu.
 *
 * Không chuỗi tiếng Việt nào nằm trong file này: câu được ghép ở hook (A15) và
 * đi kèm ở {@link ScaleWarningNotice.message}. Union phân biệt được theo `kind`
 * nên view chọn được cách trình bày mà không phải đọc chuỗi.
 */
export type ScaleWarning =
  | {
      readonly kind: 'implausible';
      /** Tỷ lệ đang xét, thứ sinh ra hậu quả vô lý. */
      readonly proposed: MillimetresPerPixel;
      /**
       * Độ dày tường suy ra từ tỷ lệ đó — con số làm câu cảnh báo có sức thuyết
       * phục (`"cho ra bức tường dày 3 mét"`), và cũng là con số dòng kiểm chứng
       * `'wallThickness'` đang hiện.
       */
      readonly impliedWallThickness: Millimetres;
    }
  | {
      readonly kind: 'deviatesFromEstimate';
      readonly proposed: MillimetresPerPixel;
      /** Ước tính của AI, tức `ScaleInference.suggestedMillimetresPerPixel`. */
      readonly estimated: MillimetresPerPixel;
      /** Chênh lệch tương đối so với ước tính, `0..1`. `0,15` là ngưỡng cảnh báo. */
      readonly relativeDifference: number;
    };

/** Một cảnh báo đã có câu chữ và mức màu, sẵn sàng để vẽ. */
export interface ScaleWarningNotice {
  readonly warning: ScaleWarning;
  /** Câu tiếng Việt đã ghép sẵn ở hook. */
  readonly message: string;
  /**
   * `'attention'` cho cả hai loại. **Không bao giờ `'violation'`** — cảnh báo ở
   * màn này không chặn ai (xem đầu file), và `'verified'` thì A5 cấm.
   */
  readonly statusCode: ViewStatusCode;
}

/* -------------------------------------------------------------------------- */
/* Khối đối chiếu — ba phần, để không giấu được phép tính.                      */
/* -------------------------------------------------------------------------- */

/**
 * `"4.800 mm ÷ 400 px = 12 mm/px"`, tách làm ba mảnh.
 *
 * Ba trường thay vì một câu đã ghép là cố ý: view phải đặt cả ba xuống, nên
 * không có cách nào rút gọn khối này thành mỗi kết quả.
 */
export interface ScaleComputationViewModel {
  /** Tử số đã định dạng, kèm đơn vị — ví dụ `"4.800 mm"`. */
  readonly numeratorLabel: string;
  /** Mẫu số đã định dạng, kèm đơn vị — ví dụ `"400 px"`. */
  readonly denominatorLabel: string;
  /** Kết quả đã định dạng — ví dụ `"12 mm/px"`. */
  readonly resultLabel: string;
  /**
   * `false` khi còn thiếu một vế (đã kéo đoạn nhưng chưa nhập chiều dài — đúng
   * nửa thứ nhất của trạng thái `partial`). Lúc đó vế thiếu vẫn có chỗ đứng:
   * hook đặt vào một chỗ trống đọc được, và view **vẫn vẽ đủ ba phần**.
   */
  readonly isComplete: boolean;
}

/* -------------------------------------------------------------------------- */
/* Ba dòng kiểm chứng.                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Ba đại lượng dẫn xuất từ tỷ lệ, đủ để một kỹ sư liếc qua là biết đúng hay sai.
 *
 * `'wallThickness'` là dòng nối thẳng với cảnh báo `'implausible'`: nếu tỷ lệ
 * cho ra bức tường dày ba mét thì chính dòng này hiện con số đó.
 */
export type ScaleCrossCheckId = 'wallThickness' | 'doorWidth' | 'largestRoomArea';

/** Một dòng kiểm chứng. Mọi con số đã thành chuỗi ở hook (A15). */
export interface ScaleCrossCheckRow {
  readonly id: ScaleCrossCheckId;
  /** Nhãn tiếng Việt viết thường, kiểu câu — ví dụ `"độ dày tường điển hình"`. */
  readonly label: string;
  /** Giá trị đã định dạng, kèm đơn vị — ví dụ `"220 mm"`, `"24,80 m²"`. */
  readonly valueLabel: string;
  /** Khoảng hợp lý đã định dạng — ví dụ `"khoảng hợp lý 80 – 400 mm"`. */
  readonly expectedRangeLabel: string;
  /**
   * `'attention'` khi giá trị nằm ngoài khoảng hợp lý, `'neutral'` khi trong.
   * **Không bao giờ `'verified'`** — đây là phép đo máy tính ra, không ai duyệt (A5).
   */
  readonly statusCode: ViewStatusCode;
}

/* -------------------------------------------------------------------------- */
/* Phạm vi áp tỷ lệ.                                                           */
/* -------------------------------------------------------------------------- */

/** Áp cho mọi tầng, hay riêng tầng đang mở. */
export type ScaleApplyScope = 'allFloors' | 'thisFloor';

/** Một lựa chọn phạm vi, đã có nhãn tiếng Việt. */
export interface ScaleApplyScopeOption {
  readonly value: ScaleApplyScope;
  readonly label: string;
}

/* -------------------------------------------------------------------------- */
/* Phím tắt.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Một dòng nhắc phím tắt.
 *
 * Phím tắt thật đăng ký qua `src/lib/input/shortcutRegistry` ở hook (R-54);
 * đây chỉ là chữ để đọc.
 */
export interface ScaleShortcutHint {
  readonly id: string;
  /**
   * Tổ hợp đã định dạng bởi `formatCombo` — ví dụ `"Shift + ←"`. Chữ hoa ở tên
   * phím là ngoại lệ được A6 cho phép.
   */
  readonly comboLabel: string;
  /** Việc phím đó làm, viết thường kiểu câu — ví dụ `"huỷ đoạn đang kéo"`. */
  readonly description: string;
}

/* -------------------------------------------------------------------------- */
/* Canvas giữa.                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Mọi thứ canvas vẽ.
 *
 * `viewport` là `ViewportState` của `hooks/useCanvasViewport` chứ không phải một
 * hình dạng thứ hai: hook lái thu phóng bằng đúng hook đó (R-61), và view chỉ
 * đặt nó vào `transform`. Khung nhìn bay tới một chuỗi kích thước là một lần
 * `viewport` đổi giá trị — canvas chuyển tiếp nó trong 340 ms
 * (`cssDurationMs('slow')`, không viết số).
 */
export interface ScaleCanvasViewModel {
  /** Ảnh bản vẽ đã nắn. `null` khi đang tải hoặc khi nắn thất bại. */
  readonly imageUrl: string | null;
  readonly altText: string;
  readonly viewport: ViewportState;
  /** Chuỗi kích thước OCR để tô `--data-dimension` lên ảnh. */
  readonly dimensionRows: readonly DimensionStringRow[];
  /** Hàng đang được rê chuột qua, ở panel hoặc trên chính canvas. */
  readonly highlightedRowId: string | null;
  readonly selectedRowId: string | null;
  /** Hộp vừa được bay tới. `null` khi chưa chọn hàng nào. */
  readonly focusBox: ImageRatioBox | null;
  readonly referenceLine: ReferenceLineDraft | null;
  /** Số pixel chữ đều vẽ cạnh đoạn khi đang kéo. `null` khi không kéo. */
  readonly liveLengthLabel: string | null;
  /** `false` ở trạng thái `forbidden`: canvas xem được, kéo thì không. */
  readonly isInteractive: boolean;
  readonly isImageLoading: boolean;
  /**
   * Câu báo bản vẽ có thể méo vì nắn ảnh thất bại. `null` ngoài trạng thái
   * `error`. Liên kết quay lại bước tiền xử lý là
   * {@link ScaleCalibrationActions.onGoToPreprocessing}.
   */
  readonly warpingNotice: string | null;
}

/* -------------------------------------------------------------------------- */
/* Panel phải.                                                                 */
/* -------------------------------------------------------------------------- */

/** Mọi thứ panel phải 344px vẽ, từ trên xuống đúng thứ tự đặc tả. */
export interface ScalePanelViewModel {
  /** Số chữ đều mono-lg của khối 1 — ví dụ `"12 mm/px"`. */
  readonly currentScaleLabel: string;
  /** Dòng dẫn xuất — ví dụ `"1 pixel = 12 mm · bản vẽ ở tỷ lệ khoảng 1:100"`. */
  readonly derivedLine: string;
  readonly method: ScaleCalibrationMethod;
  readonly methodOptions: readonly ScaleMethodOption[];
  /**
   * Câu giải thích vì sao một phương pháp bị khoá, hoặc vì sao phương pháp vẽ
   * tay được chọn sẵn. `null` khi cả hai phương pháp đều dùng được.
   */
  readonly methodNotice: string | null;
  readonly dimension: ScaleDimensionMethodViewModel;
  readonly reference: ScaleReferenceMethodViewModel;
  readonly computation: ScaleComputationViewModel;
  /** Đúng ba dòng, luôn đủ ba — thứ tự là thứ tự của {@link ScaleCrossCheckId}. */
  readonly crossChecks: readonly ScaleCrossCheckRow[];
  /** Rỗng khi không có gì đáng nói. Không bao giờ hạ {@link ScalePanelViewModel.canApply}. */
  readonly warnings: readonly ScaleWarningNotice[];
  readonly applyScope: ScaleApplyScope;
  readonly applyScopeOptions: readonly ScaleApplyScopeOption[];
  /**
   * `false` chỉ khi CHƯA CÓ TỶ LỆ để áp (chưa chọn hàng, chưa vẽ xong đoạn).
   * Cảnh báo không bao giờ hạ cờ này xuống.
   */
  readonly canApply: boolean;
  readonly isApplying: boolean;
  /**
   * `true` đúng khi và chỉ khi màn ở `'forbidden'`: nút "áp dụng tỷ lệ" và ô
   * chọn phạm vi biến mất hẳn, không phải mờ đi — cùng lý lẽ
   * `InputQualityFooterModel.areActionsHidden`.
   */
  readonly areActionsHidden: boolean;
  /** Caption cảnh báo đổi tỷ lệ sẽ tính lại mọi kích thước dẫn xuất. */
  readonly recalculationCaption: string;
  /**
   * Badge của panel. `'verified'` **chỉ** ở trạng thái `'success'`, vì lúc đó
   * chính người dùng vừa bấm áp — đúng thứ A5 dành xanh đã xác minh cho.
   */
  readonly statusCode: ViewStatusCode;
  readonly shortcutHints: readonly ScaleShortcutHint[];
}

/* -------------------------------------------------------------------------- */
/* Thanh trạng thái 32px — khớp đúng `StatusBarProps` của components/shell.     */
/* -------------------------------------------------------------------------- */

/**
 * Ba mục của `src/components/shell/StatusBar.tsx`, đã dựng sẵn.
 *
 * Tên trường khớp từng chữ với `StatusBarProps` để `ScaleCalibration.tsx` viết
 * được `<StatusBar {...model.statusBar} />` — không ánh xạ lại, không đặt tên
 * lần thứ hai cho cùng một thứ.
 */
export interface ScaleStatusBarViewModel {
  /** Toạ độ con trỏ trên ảnh gốc. Điểm cuối cùng biết được khi con trỏ rời canvas. */
  readonly x: Pixels;
  readonly y: Pixels;
  /** Tỷ lệ nguyên đồ — ví dụ `"1:100"`. */
  readonly scaleRatio: string;
  /** Mật độ — ví dụ `"12 mm/px"`. */
  readonly scaleDensity: string;
  /** Trạng thái tự lưu, A7 — ví dụ `"đã lưu lúc 14:32"`. */
  readonly saveText: string;
}

/* -------------------------------------------------------------------------- */
/* Toàn màn.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Mọi thứ view vẽ.
 *
 * Bất biến đi kèm, cùng khuôn `InputQualityGateModel`:
 *
 * 1. `errorMessage !== null` ⟺ `state === 'error'`, và `errorCode` đi cùng nó.
 * 2. `state === 'loading'` ⟺ `canvas.isImageLoading`.
 * 3. `state === 'empty'` ⟺ `panel.dimension.rows` rỗng; lúc đó
 *    `panel.method === 'referenceLine'` và mục `'dimensionString'` bị khoá.
 * 4. `state === 'partial'` ⟺ (`panel.computation.isComplete === false` khi đã có
 *    `panel.reference.draft`) HOẶC có ít nhất một hàng `isLowConfidence`.
 * 5. `state === 'forbidden'` ⟺ `canvas.isInteractive === false` ⟺
 *    `panel.areActionsHidden === true`.
 * 6. `state === 'collapsed'` ⟺ `isPanelCollapsed === true`.
 * 7. `state === 'success'` ⟺ `panel.statusCode === 'verified'`.
 */
export interface ScaleCalibrationViewModel {
  readonly state: ScaleCalibrationState;
  readonly canvas: ScaleCanvasViewModel;
  readonly panel: ScalePanelViewModel;
  readonly statusBar: ScaleStatusBarViewModel;
  /** Dưới 1024px panel phải thành tấm trượt đáy — cùng mốc các màn đã dựng. */
  readonly isCompact: boolean;
  readonly isPanelCollapsed: boolean;
  /** Có thì bỏ chạy số và bỏ bay khung nhìn, đổi giá trị tức thì (mục B). */
  readonly prefersReducedMotion: boolean;
  /** Lỗi nắn ảnh. `null` ở mọi trạng thái khác `'error'`. */
  readonly errorMessage: string | null;
  /** Mã máy đọc, giữ nguyên dạng (A6). Không bao giờ đứng một mình. */
  readonly errorCode: string | null;
  /** Câu của trạng thái `'empty'`. `null` ở trạng thái khác. */
  readonly emptyNotice: string | null;
  /** Câu của trạng thái `'partial'`. `null` ở trạng thái khác. */
  readonly partialNotice: string | null;
  /** Câu của trạng thái `'forbidden'`. `null` ở trạng thái khác. */
  readonly forbiddenNotice: string | null;
  /** Câu của trạng thái `'success'`. `null` ở trạng thái khác. */
  readonly successNotice: string | null;
}

/* -------------------------------------------------------------------------- */
/* Hành động.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Mọi hàm view gọi. Không hàm nào trả về gì: view bắn sự kiện, hook quyết định.
 *
 * Mọi toạ độ đi VÀO đây là {@link ImageRatioPoint} (tỉ lệ `0..1` của khung ảnh),
 * không phải pixel — xem ghi chú R-60 ở đầu file.
 */
export interface ScaleCalibrationActions {
  /* -- Cách xác định ------------------------------------------------------- */
  readonly onChangeMethod: (method: ScaleCalibrationMethod) => void;

  /* -- Phương pháp 1: chuỗi kích thước ------------------------------------- */
  /** Chọn một hàng: tính ngay, bay khung nhìn tới hộp bao 340 ms, tô sáng. */
  readonly onSelectDimensionRow: (rowId: string) => void;
  /** Rê chuột qua một hàng ở panel hoặc một chuỗi trên canvas. `null` khi rời. */
  readonly onHoverDimensionRow: (rowId: string | null) => void;

  /* -- Phương pháp 2: đoạn tham chiếu -------------------------------------- */
  readonly onStartDrag: (point: ImageRatioPoint) => void;
  /** Mỗi lần con trỏ dịch khi đang kéo. Số pixel và tỷ lệ chạy số 120 ms. */
  readonly onMoveDrag: (point: ImageRatioPoint, modifiers: ScalePointerModifiers) => void;
  readonly onEndDrag: (point: ImageRatioPoint) => void;
  /** Phím `Esc`, hoặc con trỏ rời canvas giữa chừng. */
  readonly onCancelDrag: () => void;
  /** Phím mũi tên (`'fine'`) và Shift + mũi tên (`'coarse'`). */
  readonly onNudgeEndpoint: (
    endpoint: ReferenceLineEndpoint,
    direction: NudgeDirection,
    step: NudgeStep,
  ) => void;
  /** Mỗi lần gõ vào ô "Chiều dài thật". Gợi ý vô lý hiện NGAY, không đợi rời ô. */
  readonly onChangeRealLength: (text: string) => void;
  /** Phím `Enter` trong ô "Chiều dài thật". */
  readonly onConfirmRealLength: () => void;
  /** Phím `R` — xoá đoạn hiện tại và kéo lại từ đầu. */
  readonly onRemeasure: () => void;

  /* -- Canvas -------------------------------------------------------------- */
  /**
   * Kéo nền canvas. `dx`/`dy` là độ dịch của con trỏ trên màn, view đọc thẳng từ
   * sự kiện — hook mới quy nó về hệ ảnh.
   */
  readonly onPan: (dx: number, dy: number) => void;
  /** Lăn chuột hoặc nút thu phóng. `focus` là điểm neo, `null` thì neo vào tâm. */
  readonly onZoom: (nextZoom: number, focus: ImageRatioPoint | null) => void;
  /** Con trỏ dịch trên canvas, để thanh trạng thái đổi toạ độ. `null` khi rời canvas. */
  readonly onMoveCursor: (point: ImageRatioPoint | null) => void;
  /**
   * Kích thước canvas ĐÃ RENDER, tính bằng pixel CSS.
   *
   * Thêm sau khi file đóng băng, bằng một ngoại lệ hẹp điều phối viên cấp
   * thành văn bản, và CHỈ THÊM — không kiểu nào đã có bị đổi.
   *
   * Vì sao phải có: bay khung nhìn (R-07) chạy qua `flyToBounds` của
   * `hooks/useCanvasViewport`, và hàm đó nhận bề rộng/bề cao canvas bằng pixel
   * để tính ra `ViewportState`. `ScaleCalibrationCanvas` đã đo sẵn kích thước
   * đó bằng `ResizeObserver` nhưng giữ riêng cho mình; không có đường này thì
   * hook chỉ đoán được, và một `viewport.x` sai đơn vị dịch khung nhìn chưa tới
   * một pixel — R-07 hỏng âm thầm chứ không kêu.
   *
   * View gọi mỗi lần kích thước đổi, kể cả lần đo đầu tiên.
   */
  readonly onCanvasSizeChange: (widthPx: number, heightPx: number) => void;

  /* -- Chân panel ---------------------------------------------------------- */
  /** Áp tỷ lệ. Sinh toast có Hoàn tác (A8) và cho nhãn kích thước chạy số 260 ms. */
  readonly onApply: () => void;
  readonly onChangeApplyScope: (scope: ScaleApplyScope) => void;

  /* -- Vỏ màn -------------------------------------------------------------- */
  readonly onToggleCollapsed: () => void;
  /** Liên kết quay lại bước tiền xử lý, ở trạng thái `'error'`. */
  readonly onGoToPreprocessing: () => void;
  /** Tải lại ảnh sau khi nắn thất bại. */
  readonly onRetry: () => void;
}

/* -------------------------------------------------------------------------- */
/* Props của view và ba phần con.                                              */
/* -------------------------------------------------------------------------- */

/** Mọi prop `ScaleCalibration.tsx` nhận — mô hình cộng hành động (mục D). */
export interface ScaleCalibrationProps {
  readonly model: ScaleCalibrationViewModel;
  readonly actions: ScaleCalibrationActions;
}

/** Props của `ScaleCalibrationCanvas` — canvas giữa, bo 16, thụt 12. */
export interface ScaleCalibrationCanvasProps {
  readonly canvas: ScaleCanvasViewModel;
  readonly prefersReducedMotion: boolean;
  readonly actions: Pick<
    ScaleCalibrationActions,
    | 'onCancelDrag'
    | 'onEndDrag'
    | 'onHoverDimensionRow'
    | 'onMoveCursor'
    | 'onMoveDrag'
    | 'onPan'
    | 'onSelectDimensionRow'
    | 'onStartDrag'
    | 'onZoom'
  >;
}

/** Props của `ScaleCalibrationPanel` — panel phải 344px, hoặc tấm trượt đáy khi hẹp. */
export interface ScaleCalibrationPanelProps {
  readonly panel: ScalePanelViewModel;
  readonly state: ScaleCalibrationState;
  readonly isCompact: boolean;
  readonly isCollapsed: boolean;
  readonly prefersReducedMotion: boolean;
  readonly actions: Pick<
    ScaleCalibrationActions,
    | 'onApply'
    | 'onChangeApplyScope'
    | 'onChangeMethod'
    | 'onChangeRealLength'
    | 'onConfirmRealLength'
    | 'onHoverDimensionRow'
    | 'onNudgeEndpoint'
    | 'onRemeasure'
    | 'onSelectDimensionRow'
    | 'onToggleCollapsed'
  >;
}

/** Props của `ScaleCalibrationMethodDimension` — khối "từ chuỗi kích thước". */
export interface ScaleCalibrationMethodDimensionProps {
  readonly dimension: ScaleDimensionMethodViewModel;
  readonly actions: Pick<ScaleCalibrationActions, 'onHoverDimensionRow' | 'onSelectDimensionRow'>;
}

/** Props của `ScaleCalibrationMethodReference` — khối "vẽ đường tham chiếu", ba bước. */
export interface ScaleCalibrationMethodReferenceProps {
  readonly reference: ScaleReferenceMethodViewModel;
  readonly actions: Pick<
    ScaleCalibrationActions,
    'onChangeRealLength' | 'onConfirmRealLength' | 'onNudgeEndpoint' | 'onRemeasure'
  >;
}

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Tham số của `useScaleCalibration`.
 *
 * Cổng dữ liệu **không** nằm ở đây, vì `scaleCalibrationGateway.ts` chưa tồn tại
 * lúc file này đóng băng và types.ts không được import ngược lên nó. Người viết
 * hook MỞ RỘNG kiểu này trong file của mình thay vì sửa file này:
 *
 * ```ts
 * interface UseScaleCalibrationHookOptions extends UseScaleCalibrationOptions {
 *   readonly gateway?: ScaleCalibrationGateway;
 * }
 * ```
 *
 * Đó là cách hợp lệ duy nhất để thêm tham số, và nó giữ cho container gọi được
 * hook chỉ với `projectId` + `floorId` (R-73).
 */
export interface UseScaleCalibrationOptions {
  readonly projectId: string;
  readonly floorId: string;
  /** Vai trò của người đang xem. Không có quyền sửa thì màn ở `'forbidden'`. */
  readonly roles?: readonly ProjectRole[];
  /** Điều hướng ra khỏi màn — quay lại bước tiền xử lý, sang màn kế. */
  readonly onNavigate?: (path: string) => void;
  /** Ép panel thu gọn — cho story và test muốn một câu trả lời cố định. */
  readonly forceCollapsed?: boolean;
}

/**
 * Kiểu trả về của `useScaleCalibration`.
 *
 * Ngoài đúng bộ props view cần, hook trả thêm hai thứ **container** dùng chứ
 * view không dùng:
 *
 * - `appliedScale` là `Scale` thật của `src/domain/units/scale` — có sẵn hai
 *   phép đổi `pixelsToMillimetres` / `millimetresToPixels`, nên màn sau nhận nó
 *   là dùng được ngay, không phải dựng lại từ một con số (R-73).
 * - `aiInference` là kết quả `inferScale()` thô, tức chuẩn mà cảnh báo lệch 15%
 *   đối chiếu vào. Story và test cắm thẳng vào đây để dựng nhánh cảnh báo.
 */
export interface UseScaleCalibrationResult extends ScaleCalibrationProps {
  /** `null` cho tới khi người dùng bấm áp. */
  readonly appliedScale: Scale | null;
  /** `null` khi OCR không đọc được chuỗi kích thước nào. */
  readonly aiInference: ScaleInference | null;
}
