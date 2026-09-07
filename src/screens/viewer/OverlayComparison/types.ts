/**
 * Hợp đồng props của màn Đối chiếu bản vẽ (`OverlayComparison`) — route
 * `ROUTE_PATTERNS.projectOverlay` (`/projects/:id/floors/:floorId/overlay`).
 *
 * Đây là XƯƠNG SỐNG của màn: file này là API công khai DUY NHẤT giữa người viết
 * hook (`useOverlayComparison.ts`), ba người viết view (`OverlayComparison.tsx`,
 * `OverlayComparisonCanvas.tsx`, `OverlayComparisonToolbar.tsx` +
 * `OverlayComparisonPanel.tsx`), và người viết logic đo ở `src/domain/overlay`.
 * Không ai trong số họ được sửa file này; thiếu một kiểu thì DỪNG và hỏi điều
 * phối viên (R-69), không tự thêm.
 *
 * Bốn luật định hình mọi trường bên dưới:
 *
 * - **A15 — định dạng xảy ra ở hook, không ở view.** Mọi chuỗi người đọc ở đây
 *   đã là tiếng Việt có dấu và đã ghép xong; dấu thập phân là dấu phẩy. View
 *   không còn con số nào phải làm tròn, chia, hay đổi đơn vị — nên phần lớn phép
 *   đo đi ra dưới dạng `…Text`, không phải dưới dạng số.
 * - **R-60 — view thuần.** View chỉ được `import type` từ `src/domain`, không gọi
 *   hàm ở đó. Nên mọi toạ độ view *nhận vào* là **tỉ lệ 0..1 của khung đối chiếu**
 *   ({@link RatioPoint}, {@link RatioBox}) — thứ view đặt thẳng vào `style` mà
 *   không cần biết milimét là gì — và mọi toạ độ view *tạo ra* (con trỏ, vị trí
 *   đường chia đôi) cũng là tỉ lệ 0..1, thứ nó đọc thẳng từ sự kiện DOM.
 * - **A11 — đúng bảy trạng thái**, tên lấy nguyên văn từ `SEVEN_STATES`
 *   (`src/lib/testing/sevenStateScenarios.ts`), kể cả `'success'`.
 * - **A4 + đặc tả "ba lớp thị giác, không được có lớp thứ tư".** Xem
 *   {@link OverlayLayerId} — ràng buộc này được ép ở tầng kiểu, không phải ở
 *   review.
 *
 * ## Nguyên tắc riêng của màn này: BẰNG CHỨNG THAY VÌ KHẲNG ĐỊNH
 *
 * Màn tồn tại để trưởng nhóm **nhìn thấy nguồn và kết quả cùng lúc** trước khi ký
 * duyệt. Vì vậy hai thứ không bao giờ được gộp làm một trong hợp đồng này:
 *
 * - {@link OverlayComparisonViewModel.metrics} là **phép đo của máy**;
 * - {@link OverlayComparisonViewModel.confirmation} là **chữ ký của người**.
 *
 * A5 nói xanh "đã xác minh" CHỈ đánh dấu việc người duyệt; đầu ra của phép đo
 * không bao giờ được đặt nó. Đó là lý do `statusCode` của một hàng vùng lệch chỉ
 * nhận `'attention'` hoặc `'neutral'` (xem {@link DeviationRowViewModel}), còn
 * `'verified'` chỉ xuất hiện trên {@link ConfirmationViewModel}.
 *
 * ## Ba mảnh logic CHƯA CÓ — và vì sao hợp đồng vẫn khai chúng
 *
 * Lượt khảo sát Lớp 1 đã kiểm và điều phối viên đã kiểm lại từng câu: phép biến
 * hình ảnh→mô hình, kiểu vùng lệch, và phép tổng hợp trung bình/lớn nhất/đếm vượt
 * ngưỡng đều **không tồn tại** trong `src/domain` hôm nay.
 *
 * - `alignFloors` (M-11) căn tầng↔tầng và `FloorTransform.scale` khai kiểu literal
 *   `1` (`src/domain/axes/alignFloors.ts:98-104`), nên nó không diễn đạt nổi một
 *   tỷ lệ mm/px;
 * - `splitOutliers` (`src/domain/units/outliers.ts:83`) nhận ngưỡng là **hệ số
 *   z-score so với trung vị**, không phải milimét, nên nó không đếm được "bao
 *   nhiêu vùng vượt 20 mm".
 *
 * Hợp đồng vẫn khai đủ hình dạng, vì hai lý do. Một: `src/domain/overlay` đang
 * được viết song song và phải khớp đúng những hình dạng này. Hai: cho tới khi nó
 * về, cổng dữ liệu trả `supported: false` kèm tên thứ còn thiếu
 * ({@link OverlayMissingCapability}) — đúng khuôn `scaleCalibrationGateway.ts`
 * đang chạy — thay vì bỏ trắng. Một cổng im lặng thì màn không phân biệt được
 * "chưa có dữ liệu" với "không có đường lấy dữ liệu".
 *
 * ## Một chỗ đặc tả bị luật ghi đè, đã báo lại
 *
 * Đặc tả nói chọn một vùng lệch thì hai khung "bay tới trong 700ms". Nhưng
 * `src/lib/motion/tokens.ts:80-87` giữ 700 ms **cố ý** nằm ngoài
 * `MotionDurationName`, với chú thích nguyên văn: *"Nothing travels from one state
 * to another at it… offering it as a fifth slot would invite someone to open a
 * panel over three quarters of a second."* Một cú bay camera **là** chuyển cảnh,
 * nên nó lấy `MOTION_DURATIONS_MS.slow` (340 ms). Thứ tự ưu tiên
 * LUAT_MAN_HINH → RULE → CLAUDE → prompt buộc như vậy; đã ghi để sửa prompt sau.
 *
 * ## KHOÁ SAU KHI XONG
 *
 * File này đóng băng. Muốn đổi hình dạng một trường thì `orca orchestration ask`
 * điều phối viên trước.
 */

import type { LevelId } from '@/domain/spatial/types';
import type { ViewportState } from '@/hooks/useCanvasViewport';
import type { ViewStatusCode } from '@/lib/viewmodel/types';
import type { ProjectRole } from '@/types/project';

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái (A11).                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Đúng bảy trạng thái của A11, tên lấy nguyên từ `SEVEN_STATES`.
 *
 * | Trạng thái  | Nghĩa ở màn Đối chiếu bản vẽ                                      |
 * |-------------|-------------------------------------------------------------------|
 * | `empty`     | tầng này không có ảnh gốc — ví dụ tầng nhập từ CAD                 |
 * | `loading`   | đang tải ảnh quét                                                 |
 * | `partial`   | chỉ một số tầng có ảnh, hoặc một số tầng chưa dựng hình học        |
 * | `error`     | không căn được vì tỷ lệ hai tầng khác nhau — có lối sang S-11      |
 * | `success`   | mọi vùng trong dung sai, badge đã duyệt, một câu xác nhận điềm đạm |
 * | `forbidden` | không có quyền đổi căn chỉnh                                      |
 * | `collapsed` | thanh công cụ xếp hai hàng, tắt kiểu cạnh nhau                    |
 */
export type OverlayComparisonState =
  | 'empty'
  | 'loading'
  | 'partial'
  | 'error'
  | 'success'
  | 'forbidden'
  | 'collapsed';

/* -------------------------------------------------------------------------- */
/* Ba lớp thị giác — ràng buộc ép ở tầng kiểu, không ở review.                  */
/* -------------------------------------------------------------------------- */

/**
 * Đúng ba lớp, không bao giờ bốn.
 *
 * Đặc tả cấm "lớp thị giác thứ tư". Một mảng `string[]` không chặn được điều đó,
 * nên đây là union đóng và mọi chỗ mô tả các lớp đều là `Record<OverlayLayerId, …>`
 * — thêm một lớp thì **hỏng build**, không phải hỏng lúc review.
 *
 * - `scan` — ảnh quét gốc, vẽ bằng `--text-primary` ở 25%, dưới dạng **nét thuần**.
 *   Không bao giờ là ảnh raster tô đầy.
 * - `geometry` — hình học sinh ra, vẽ bằng `--accent` ở 60%.
 * - `deviation` — vùng lệch, đánh dấu bằng **gạch chéo** `--state-attention`.
 *
 * Không có lớp bản đồ nhiệt và không có thang màu cầu vồng. Ba token trên là toàn
 * bộ bảng màu của canvas.
 */
export const OVERLAY_LAYER_IDS = ['scan', 'geometry', 'deviation'] as const;

/** Một trong đúng ba lớp. */
export type OverlayLayerId = (typeof OVERLAY_LAYER_IDS)[number];

/* -------------------------------------------------------------------------- */
/* Ba kiểu đối chiếu.                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Ba kiểu đặt nguồn cạnh kết quả.
 *
 * - `overlay` — **Chồng lớp**: cả hai đè lên nhau trong một khung.
 * - `swipe` — **Trượt**: một đường chia đôi dọc kéo được, gạt qua lại giữa hai bên.
 * - `sideBySide` — **Cạnh nhau**: hai khung nhìn đồng bộ, kéo và thu phóng cùng nhau.
 */
export const COMPARE_MODE_IDS = ['overlay', 'swipe', 'sideBySide'] as const;

/** Một trong ba kiểu đối chiếu. */
export type CompareModeId = (typeof COMPARE_MODE_IDS)[number];

/** Tên ba kiểu trên `SegmentedControl`. Tiếng Việt, viết thường, kiểu câu (A6). */
export const COMPARE_MODE_LABELS: Readonly<Record<CompareModeId, string>> = Object.freeze({
  overlay: 'chồng lớp',
  swipe: 'trượt',
  sideBySide: 'cạnh nhau',
});

/* -------------------------------------------------------------------------- */
/* Toạ độ view — tỉ lệ 0..1, không bao giờ milimét (R-60).                      */
/* -------------------------------------------------------------------------- */

/**
 * Một điểm trong khung đối chiếu, theo tỉ lệ `0..1` của chiều rộng và chiều cao.
 *
 * View không import được `millimetres()` nên nó không bao giờ phải gắn nhãn đơn vị
 * cho một con số. Nó đọc `event.clientX` ra tỉ lệ, và nhận tỉ lệ để đặt vào
 * `style.left`. Hook là nơi duy nhất biết một tỉ lệ đáng bao nhiêu milimét.
 */
export interface RatioPoint {
  readonly x: number;
  readonly y: number;
}

/** Một hình chữ nhật trong khung đối chiếu, cùng hệ tỉ lệ `0..1` với {@link RatioPoint}. */
export interface RatioBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Một nét của lớp `geometry` — hình học mô hình đã chiếu xuống khung đối chiếu.
 *
 * ## Vì sao lớp này CÓ dữ liệu ngay hôm nay, khác với lớp `scan`
 *
 * Hai lớp thiếu hai thứ khác nhau, và đây là chỗ dễ nhầm nhất của màn:
 *
 * - **`geometry` không thiếu gì.** Tường, phòng, ô mở đã nằm trong store từ trước
 *   (`spatialSlice`). Hook chiếu chúng xuống hệ tỉ lệ `0..1` của khung là vẽ được
 *   ngay. Chính lớp này **định nghĩa** khung đối chiếu: biên của mô hình là biên
 *   của khung.
 * - **`scan` mới là lớp thiếu.** Đặt ảnh quét vào đúng chỗ cần
 *   `imageToModelTransform`, thứ nằm trong {@link OVERLAY_MISSING_CAPABILITIES}.
 *
 * Nên "chưa có phép biến hình" **không** có nghĩa là lớp `geometry` rỗng. Một màn
 * chỉ vẽ được ảnh nguồn mà không vẽ được mô hình thì mất đúng nửa lý do nó tồn
 * tại — nguyên tắc của màn là cho người dùng **nhìn thấy nguồn và kết quả cùng
 * lúc**.
 *
 * `points` đã ở hệ tỉ lệ `0..1`; view đặt thẳng vào `path`/`polyline` mà không
 * cần biết milimét (R-60).
 */
export interface GeometryPolyline {
  /** Định danh tất định — thường là `WallId` / `RoomId` của đối tượng nguồn. */
  readonly id: string;
  readonly points: readonly RatioPoint[];
  /** Phòng thì khép kín; tường và nét dựng thì không. */
  readonly isClosed: boolean;
}

/* -------------------------------------------------------------------------- */
/* Vùng lệch — hàng trong panel, và dấu trên canvas.                            */
/* -------------------------------------------------------------------------- */

/**
 * Một hàng trong danh sách vùng lệch ở panel phải.
 *
 * Danh sách **sắp tệ nhất lên đầu**. Việc sắp xếp xảy ra ở hook; view chỉ vẽ đúng
 * thứ tự nó nhận được. `id` phải tất định để hai vùng lệch bằng nhau không đảo chỗ
 * giữa hai lượt render — bộ mẫu có bốn vùng 1 mm và ba vùng 2 mm, nên đây không
 * phải giả định lý thuyết.
 *
 * `statusCode` chỉ nhận `'attention'` (vượt dung sai) hoặc `'neutral'` (trong dung
 * sai). `'verified'` là việc của người duyệt (A5) và không bao giờ xuất hiện ở
 * đây; `'violation'` không dùng ở màn này.
 */
export interface DeviationRowViewModel {
  /** Khoá React, tất định. */
  readonly id: string;
  /** Vị trí tham chiếu, đã ghép sẵn — ví dụ `'trục A-3'`, `'phòng bếp'`. */
  readonly referenceLabel: string;
  /** Độ lệch đã định dạng, dấu phẩy thập phân — ví dụ `'41 mm'`. Chữ đều do CSS. */
  readonly deviationText: string;
  /** Mã đối tượng bị ảnh hưởng, giữ nguyên chữ hoa theo ngoại lệ của A6 — `'W-12'`. */
  readonly affectedObjectCode: string;
  /** `'attention'` khi vượt dung sai, `'neutral'` khi trong dung sai. */
  readonly statusCode: Extract<ViewStatusCode, 'attention' | 'neutral'>;
  /** Vùng đang được chọn, tức hai khung đã bay tới nó. */
  readonly isSelected: boolean;
}

/**
 * Một vùng lệch được vẽ trên canvas.
 *
 * Tách khỏi {@link DeviationRowViewModel} vì canvas cần hình, panel cần chữ, và
 * gộp lại thì view nào cũng phải bỏ qua một nửa số trường.
 */
export interface DeviationMarkViewModel {
  /** Cùng `id` với hàng tương ứng trong panel, để chọn một chỗ là sáng cả hai. */
  readonly id: string;
  /** Chỗ vẽ gạch chéo, theo tỉ lệ khung đối chiếu. */
  readonly box: RatioBox;
  /** Vượt dung sai thì mới được gạch chéo `--state-attention`. */
  readonly isOverTolerance: boolean;
  readonly isSelected: boolean;
  /**
   * Vùng vừa mới hiện ra sau một lượt đổi dung sai.
   *
   * Đặc tả: đập viền gạch chéo **ba nhịp** khi mới hiện, rồi **giữ tĩnh**. Cờ này
   * chỉ đúng ở lượt render ngay sau khi vùng chuyển sang vượt ngưỡng; hook tự hạ
   * nó xuống. View không được tự nhớ trạng thái này.
   */
  readonly hasJustCrossedTolerance: boolean;
}

/**
 * Đường đo vẽ ra khi một vùng lệch được chọn.
 *
 * Đặc tả: chọn một vùng thì hai khung bay tới và **vẽ một đường đo kèm giá trị
 * chữ đều**. Đây là dữ liệu của `MeasurementLabel`
 * (`src/components/canvas/MeasurementLabel.tsx` — nó tự vẽ đường nét đứt, hai tick
 * vuông góc, và nhãn giá trị, nên màn không vẽ lại đường nào).
 */
export interface DeviationMeasurementViewModel {
  readonly from: RatioPoint;
  readonly to: RatioPoint;
  /** Giá trị đã định dạng, ví dụ `'41 mm'`. */
  readonly valueText: string;
}

/* -------------------------------------------------------------------------- */
/* Ba con số khớp.                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Ba con số mono-lg ở đầu panel phải.
 *
 * Chúng là **phép đo của máy**, không phải phán quyết. Không có số nào ở đây làm
 * badge chuyển xanh; xem {@link ConfirmationViewModel}.
 *
 * Khi chưa đo được (trạng thái `empty`, `loading`, `error`) thì cả ba chuỗi là
 * `MISSING_VALUE` (`'—'` — `src/lib/format/number.ts:33`), **không phải `'0 mm'`**.
 * Số không là một phép đo; gạch ngang là sự vắng mặt của phép đo.
 */
export interface MatchMetricsViewModel {
  /** Sai số trung bình, đã định dạng — ví dụ `'8 mm'` hoặc `'—'`. */
  readonly meanText: string;
  /** Sai số lớn nhất, đã định dạng — ví dụ `'41 mm'` hoặc `'—'`. */
  readonly maxText: string;
  /**
   * Số vùng vượt ngưỡng, dạng số vì nó **chạy số** khi dung sai đổi
   * (`useCountUp`, `src/hooks/useCountUp.ts`). Đây là một phép đếm, không phải một
   * phép đo, nên nó không cần đơn vị và không vi phạm A15.
   *
   * `null` khi chưa đo được.
   */
  readonly overToleranceCount: number | null;
  /** Nhãn chữ thường đi kèm ba con số, đã ghép sẵn. */
  readonly labels: Readonly<{ mean: string; max: string; overTolerance: string }>;
}

/* -------------------------------------------------------------------------- */
/* Xác nhận — chữ ký của người, không phải kết luận của máy.                    */
/* -------------------------------------------------------------------------- */

/**
 * Nút "Xác nhận mô hình khớp bản vẽ" và hệ quả của nó.
 *
 * Đặc tả: xác nhận là **hành động rõ ràng của con người**, không tự động đánh dấu.
 * Vì vậy `isConfirmed` **chỉ** được bật bởi `onConfirm`, không bao giờ bởi
 * `overToleranceCount === 0`. Một tầng khớp hoàn hảo mà chưa ai bấm thì vẫn chưa
 * được xác nhận, và badge vẫn chưa xanh (A5).
 */
export interface ConfirmationViewModel {
  readonly buttonLabel: string;
  /** Người dùng đã bấm xác nhận cho tầng này chưa. */
  readonly isConfirmed: boolean;
  /** Bấm được không — sai khi không có quyền, khi chưa đo được, hoặc khi đang tải. */
  readonly canConfirm: boolean;
  /**
   * Câu điềm đạm hiện sau khi xác nhận, và `'verified'` là chỗ DUY NHẤT trong màn
   * mã trạng thái đó được phép xuất hiện. `null` khi chưa xác nhận.
   */
  readonly confirmedNotice: Readonly<{
    text: string;
    statusCode: Extract<ViewStatusCode, 'verified'>;
  }> | null;
}

/* -------------------------------------------------------------------------- */
/* Cổng dữ liệu — việc chưa có đường.                                          */
/* -------------------------------------------------------------------------- */

/**
 * Bốn việc màn cần mà tầng dữ liệu/logic chưa có đường nào để làm.
 *
 * Mỗi việc vẫn nằm trong cổng với một kết quả `supported: false` nói rõ thứ nào
 * còn thiếu, thay vì bị bỏ trắng — đúng khuôn `SCALE_MISSING_CAPABILITIES`
 * (`src/screens/pipeline/ScaleCalibration/scaleCalibrationGateway.ts:65`).
 *
 * - `imageToModelTransform` — đặt ảnh quét vào không gian mô hình. `alignFloors`
 *   không làm được: `FloorTransform.scale` khai kiểu literal `1`.
 * - `deviationRegions` — danh sách vùng lệch kèm vị trí tham chiếu và mã đối tượng.
 * - `matchMetrics` — trung bình, lớn nhất, đếm vượt ngưỡng theo milimét.
 * - `confirmFloorMatch` — ghi lại việc người duyệt đã xác nhận. Không endpoint nào
 *   nhận nó hôm nay; lượt ghi chỉ sống trong phiên.
 *
 * Ba mục đầu đang được viết ở `src/domain/overlay` song song với màn. Khi chúng
 * về, cổng đổi từ `supported: false` sang lời gọi thật và **màn không phải sửa** —
 * đó là lý do hình dạng ở trên được chốt trước.
 */
export const OVERLAY_MISSING_CAPABILITIES = [
  'imageToModelTransform',
  'deviationRegions',
  'matchMetrics',
  'confirmFloorMatch',
] as const;

/** Một trong bốn việc chưa có đường. */
export type OverlayMissingCapability = (typeof OVERLAY_MISSING_CAPABILITIES)[number];

/** Việc cổng chưa làm được, kèm tên thứ còn thiếu. */
export interface OverlayUnsupported {
  readonly supported: false;
  readonly capability: OverlayMissingCapability;
  /** Endpoint hoặc module còn thiếu, để người đọc mã sau này biết nối vào đâu. */
  readonly missing: string;
}

/* -------------------------------------------------------------------------- */
/* Tầng và chọn tầng.                                                          */
/* -------------------------------------------------------------------------- */

/** Một mục trong ô chọn tầng trên thanh công cụ. */
export interface FloorOptionViewModel {
  readonly levelId: LevelId;
  /** Tên tầng, giữ nguyên chữ hoa nếu là mã (ngoại lệ A6). */
  readonly label: string;
  /** Tầng này có ảnh quét gốc không. Tầng nhập từ CAD thì không. */
  readonly hasScan: boolean;
  /** Tầng này đã dựng hình học chưa. */
  readonly hasGeometry: boolean;
}

/* -------------------------------------------------------------------------- */
/* Viewmodel của cả màn — thứ hook trả ra.                                     */
/* -------------------------------------------------------------------------- */

/**
 * Toàn bộ những gì `useOverlayComparison` đưa cho view.
 *
 * Không trường nào ở đây là một con số phải định dạng, một token màu, hay một
 * đường dẫn. Hook đã làm hết.
 */
export interface OverlayComparisonViewModel {
  readonly state: OverlayComparisonState;
  /** Một câu tiếng Việt giải thích trạng thái hiện tại, cho trạng thái không có dữ liệu. */
  readonly stateNotice: string | null;
  /**
   * Lối sang màn Hiệu chỉnh tỷ lệ (S-11) khi không căn được vì tỷ lệ khác nhau.
   * `null` ở mọi trạng thái khác. Đường dẫn lấy từ `@/routes/paths` (R-65).
   */
  readonly scaleFixHref: string | null;

  readonly floors: readonly FloorOptionViewModel[];
  readonly activeFloorId: LevelId | null;

  /**
   * Ảnh quét gốc của tầng đang chọn. `null` khi tầng không có ảnh.
   *
   * Đến từ `FloorImageQuality.sourceUrl` (`quality.assess`) — **ảnh đã nắn**, nên
   * màn không phải xoay hay sửa méo gì thêm.
   *
   * `null` mang hai nghĩa khác nhau, và view phân biệt chúng bằng
   * {@link OverlayComparisonViewModel.state} chứ không bằng trường này: `empty` là
   * tầng **không có** ảnh (nhập từ CAD), `loading` là **chưa tải xong**. Ở `error`
   * thì ảnh vẫn có — thứ hỏng là phép căn, không phải ảnh.
   */
  readonly scanUrl: string | null;

  readonly compareMode: CompareModeId;
  /** Kiểu bị tắt kèm lý do — `sideBySide` dưới 1280 và ở trạng thái `collapsed`. */
  readonly disabledCompareModes: Readonly<Partial<Record<CompareModeId, string>>>;

  /** Độ mờ ảnh nguồn, `0..100`. Số nguyên; `Slider` và nhãn phần trăm cùng đọc nó. */
  readonly scanOpacityPercent: number;
  /** Phần trăm đã định dạng để vẽ cạnh thanh trượt — ví dụ `'25%'`. */
  readonly scanOpacityText: string;

  /** Đường chia đôi của kiểu `swipe`, tỉ lệ `0..1` chiều rộng khung. */
  readonly swipePosition: number;

  /** Khoá căn — chặn mọi thao tác đổi căn chỉnh. */
  readonly isAlignmentLocked: boolean;

  readonly layers: Readonly<Record<OverlayLayerId, OverlayLayerViewModel>>;
  /**
   * Nét của lớp `geometry`, đã chiếu xuống hệ tỉ lệ `0..1`. Xem
   * {@link GeometryPolyline} — lớp này CÓ dữ liệu ngay hôm nay, khác lớp `scan`.
   */
  readonly geometry: readonly GeometryPolyline[];
  readonly marks: readonly DeviationMarkViewModel[];
  readonly measurement: DeviationMeasurementViewModel | null;

  readonly metrics: MatchMetricsViewModel;
  readonly toleranceMm: number;
  readonly toleranceLabel: string;
  readonly rows: readonly DeviationRowViewModel[];

  readonly confirmation: ConfirmationViewModel;

  /** Vai của người đang xem, để view biết vì sao một nút bị tắt. */
  readonly role: ProjectRole | null;
  /** Việc cổng chưa làm được — rỗng khi mọi thứ đã nối. */
  /**
   * Kéo và thu phóng, **dùng chung cho mọi khung**.
   *
   * `useCanvasViewport` không chia sẻ state giữa hai lượt gọi — mỗi lượt là một
   * `useState` riêng (`src/hooks/useCanvasViewport.ts:82-86`). Nên kiểu
   * `sideBySide` **không** đồng bộ được bằng cách gọi hook hai lần. Hook gọi nó
   * đúng MỘT lần và phát giá trị xuống đây; hai khung cùng đọc một `viewport` nên
   * chúng kéo và thu phóng cùng nhau theo cấu trúc, không phải nhờ một lượt đồng
   * bộ chạy sau. Cùng khuôn `ScaleCalibration` đang chạy (`types.ts:418`).
   */
  readonly viewport: ViewportState;

  readonly unsupported: readonly OverlayUnsupported[];
}

/** Một lớp thị giác đã sẵn sàng để vẽ. */
export interface OverlayLayerViewModel {
  readonly id: OverlayLayerId;
  /** Lớp có được vẽ lượt này không. */
  readonly isVisible: boolean;
  /** Độ mờ `0..1`. View đặt thẳng vào `style.opacity`. */
  readonly opacity: number;
  /** Nhãn cho trình đọc màn hình, tiếng Việt. */
  readonly label: string;
}

/* -------------------------------------------------------------------------- */
/* Hành động — thứ hook đưa xuống, view chỉ gọi.                               */
/* -------------------------------------------------------------------------- */

/**
 * Mọi việc người dùng làm được trên màn.
 *
 * Tách khỏi viewmodel để story dựng được một màn tĩnh mà không phải bịa ra mười
 * hàm rỗng, và để test biết chính xác view gọi cái gì.
 */
export interface OverlayComparisonActions {
  readonly selectFloor: (levelId: LevelId) => void;
  readonly setCompareMode: (mode: CompareModeId) => void;
  /** `0..100`. */
  readonly setScanOpacity: (percent: number) => void;
  /** `0..1` theo chiều rộng khung. Kéo trực tiếp, KHÔNG hoạt cảnh trong lúc kéo. */
  readonly setSwipePosition: (ratio: number) => void;
  readonly toggleAlignmentLock: () => void;
  /** Dung sai theo milimét. Đổi nó thì danh sách sắp lại và số đếm chạy số ngay. */
  readonly setToleranceMm: (millimetres: number) => void;
  /** Chọn một vùng lệch: hai khung bay tới và vẽ đường đo. `null` để bỏ chọn. */
  readonly selectRegion: (id: string | null) => void;
  /** Kéo/thu phóng. Một lượt gọi đổi viewport của MỌI khung cùng lúc. */
  readonly setViewport: (viewport: ViewportState) => void;
  /** Hành động rõ ràng của con người. Không có đường nào khác đặt được `isConfirmed`. */
  readonly confirmMatch: () => void;
}

/* -------------------------------------------------------------------------- */
/* Props của bốn view.                                                         */
/* -------------------------------------------------------------------------- */

/** Props của view gốc `OverlayComparison.tsx`. */
export interface OverlayComparisonProps {
  readonly model: OverlayComparisonViewModel;
  readonly actions: OverlayComparisonActions;
}

/** Props của thanh công cụ nổi: cao 40, bo 12, nằm trên cùng giữa. */
export interface OverlayComparisonToolbarProps {
  readonly floors: readonly FloorOptionViewModel[];
  readonly activeFloorId: LevelId | null;
  readonly compareMode: CompareModeId;
  readonly disabledCompareModes: Readonly<Partial<Record<CompareModeId, string>>>;
  readonly scanOpacityPercent: number;
  readonly scanOpacityText: string;
  readonly isAlignmentLocked: boolean;
  /** Thanh xếp hai hàng ở trạng thái `collapsed`. */
  readonly isStacked: boolean;
  readonly canEdit: boolean;
  readonly onSelectFloor: (levelId: LevelId) => void;
  readonly onSetCompareMode: (mode: CompareModeId) => void;
  readonly onSetScanOpacity: (percent: number) => void;
  readonly onToggleAlignmentLock: () => void;
}

/** Props của panel phải rộng 344. */
export interface OverlayComparisonPanelProps {
  readonly metrics: MatchMetricsViewModel;
  readonly toleranceMm: number;
  readonly toleranceLabel: string;
  readonly rows: readonly DeviationRowViewModel[];
  readonly confirmation: ConfirmationViewModel;
  readonly canEdit: boolean;
  readonly onSetToleranceMm: (millimetres: number) => void;
  readonly onSelectRegion: (id: string | null) => void;
  readonly onConfirmMatch: () => void;
}

/** Props của canvas đối chiếu, rộng toàn vùng còn lại. */
export interface OverlayComparisonCanvasProps {
  readonly compareMode: CompareModeId;
  readonly layers: Readonly<Record<OverlayLayerId, OverlayLayerViewModel>>;
  /** URL ảnh quét gốc. `null` khi tầng không có ảnh. */
  readonly scanUrl: string | null;
  /** Nét của lớp `geometry`. Có dữ liệu ngay hôm nay — xem {@link GeometryPolyline}. */
  readonly geometry: readonly GeometryPolyline[];
  readonly marks: readonly DeviationMarkViewModel[];
  readonly measurement: DeviationMeasurementViewModel | null;
  readonly swipePosition: number;
  /** Dùng chung cho mọi khung, kể cả hai khung của `sideBySide`. */
  readonly viewport: ViewportState;
  readonly isInteractive: boolean;
  readonly onSetSwipePosition: (ratio: number) => void;
  readonly onSetViewport: (viewport: ViewportState) => void;
  readonly onSelectRegion: (id: string | null) => void;
}
