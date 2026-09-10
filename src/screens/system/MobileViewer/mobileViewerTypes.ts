/**
 * Hợp đồng kiểu của màn `/m/du-an/:projectId` — xem 3D **chỉ đọc** trên điện thoại.
 *
 * File `.ts` thuần, **không nhập React**, cùng lý do `viewer3dTypes.ts` của màn
 * Viewer3D là `.ts`: module cảnh phải test được không cần dựng cây React, và một
 * kiểu mà cả hai phía đọc thì không được kéo theo tầng nào của phía kia.
 *
 * ## File này là hợp đồng của bốn người viết song song
 *
 * Bốn worker dựng bốn mảnh của màn cùng lúc và **không đọc mã của nhau**:
 *
 * | Mảnh | Chủ | Đọc gì ở đây |
 * |---|---|---|
 * | `mobileViewerScene.ts` + `mobileViewerGestures.ts` | T5 | mục 4 |
 * | `useMobileViewer.ts` + `mobileViewerGateway.ts`    | T6 | mục 3, 5 |
 * | `MobileViewer.tsx` + thanh dưới + tấm thông tin    | T7 | mục 2, 6 |
 * | test + story + `mobileViewerScenarios.ts`          | T8 | mục 2, 6 |
 *
 * Đổi hình dạng ở đây là bắt ba người kia sửa lại việc đã xong. Cần đổi thì
 * **hỏi điều phối viên**, đừng tự sửa rồi đi tiếp.
 *
 * > **Khi ghi chú khảo sát và file này nói khác nhau, GHI CHÚ KHẢO SÁT THẮNG.**
 * > File này viết trước lúc ghi chú về; nó chốt *ranh giới giữa bốn mảnh*, không
 * > chốt chữ ký của tầng logic. Thấy lệch thì báo, đừng lặng lẽ chiều theo file này.
 *
 * ## Vì sao màn này chỉ đọc
 *
 * Chủ đầu tư và kỹ sư mở nó ở công trường, một tay cầm máy. Không cho sửa dữ
 * liệu là **hạn chế có ý thức**, không phải phần còn thiếu: mọi ô nhập vắng mặt
 * là cố ý, và bài kiểm của T8 khẳng định đúng điều đó.
 */

import type { MeasurePoint } from '@/domain/measure/measure';
import type { DetailLevel } from '@/lib/three/build/lod';
import type { EntityHit } from '@/lib/three/interaction/hitTest';

/* -------------------------------------------------------------------------- */
/* 1. Kích thước bố cục — đặc tả S-45.                                         */
/* -------------------------------------------------------------------------- */

/**
 * Con số bố cục sống ở đây, không rải trong JSX.
 *
 * Cùng khuôn `viewerShellTypes.ts` mục "Kích thước bố cục". R-71 cấm hằng số
 * viết tay trong màn vì repo đã có nguồn cho từng loại (thời lượng, đơn vị,
 * ngưỡng); các số dưới đây **không** có nguồn nào như thế — chúng là kích thước
 * do đặc tả S-45 đặt ra — nên chỗ đúng của chúng là một hằng có tên, đúng một chỗ.
 */

/** Chiều cao thanh trên, px. Tên dự án và nút chia sẻ. */
export const MOBILE_VIEWER_TOP_BAR_PX = 48;

/** Chiều cao thanh dưới, px. */
export const MOBILE_VIEWER_BOTTOM_BAR_PX = 56;

/**
 * Vùng bấm nhỏ nhất, px — sàn tuyệt đối của đặc tả.
 *
 * Không phải gợi ý. Bộ đo nghiệm thu liệt kê từng vùng bấm và một cái dưới số
 * này là hỏng cả lượt.
 */
export const MOBILE_VIEWER_MIN_HIT_TARGET_PX = 44;

/** Bề ngang mà dưới nó thanh dưới rút còn ba biểu tượng, px. */
export const MOBILE_VIEWER_COMPACT_WIDTH_PX = 360;

/** Chiều cao tấm thông tin ở nấc giữa — 45% chiều cao khung nhìn. */
export const MOBILE_VIEWER_SHEET_MID_RATIO = 0.45;

/* -------------------------------------------------------------------------- */
/* 2. Bảy trạng thái, và công cụ ở thanh dưới.                                 */
/* -------------------------------------------------------------------------- */

/**
 * Bảy trạng thái của A11 — cùng bộ chữ `SEVEN_STATES` của
 * `lib/testing/sevenStateScenarios`, khai lại ở đây vì mã sản phẩm không nhập
 * từ thư mục testing. `ViewerScreenState` của vỏ Viewer làm y hệt.
 *
 * Ý nghĩa riêng của màn này, theo đặc tả:
 * - `loading`  — đang tải, **hiện mức gọn trước** rồi mới nâng dần.
 * - `partial`  — mạng yếu, chỉ tải được 2 tầng.
 * - `error`    — máy yếu: mời xem bản 2D thay vì cố dựng.
 * - `collapsed`— màn rất nhỏ (320): thanh dưới còn ba biểu tượng.
 */
export type MobileViewerState =
  | 'empty'
  | 'loading'
  | 'partial'
  | 'error'
  | 'success'
  | 'forbidden'
  | 'collapsed';

/** Bốn biểu tượng của thanh dưới: tầng · chế độ xem · đo · thông tin. */
export type MobileViewerToolId = 'floors' | 'view' | 'measure' | 'info';

/** Thứ tự ở 390 — đủ bốn. */
export const MOBILE_VIEWER_TOOLS: readonly MobileViewerToolId[] = Object.freeze([
  'floors',
  'view',
  'measure',
  'info',
]);

/**
 * Thứ tự ở 320 — gộp còn ba.
 *
 * `view` là cái bị gộp vào, không phải cái bị bỏ: chế độ xem chuyển thành một
 * hàng bên trong tấm "tầng", nên không mất chức năng nào — chỉ mất một biểu
 * tượng. Đây là quyết định của điều phối viên; đặc tả nói "gộp còn ba" mà không
 * nói gộp cái nào.
 */
export const MOBILE_VIEWER_TOOLS_COMPACT: readonly MobileViewerToolId[] = Object.freeze([
  'floors',
  'measure',
  'info',
]);

/* -------------------------------------------------------------------------- */
/* 3. Dữ liệu đã gọn cho di động — hook cấp, view chỉ đọc.                     */
/* -------------------------------------------------------------------------- */

/**
 * Một tầng, rút về đúng thứ dải tầng vẽ.
 */
export interface MobileViewerFloor {
  readonly id: string;
  /** Nhãn tiếng Việt, viết thường kiểu câu (A6) — ví dụ "tầng 2". */
  readonly label: string;
  /** Đã dựng xong hình thật chưa. `false` ở trạng thái `partial`. */
  readonly isLoaded: boolean;
}

/**
 * Một dòng của tấm thông tin. **Chỉ đọc** — không có `onChange`, và đó là điểm chính.
 *
 * `value` đã là chuỗi đã định dạng. View không tính, không làm tròn, không đổi
 * đơn vị (A15 + `local/no-raw-number`).
 */
export interface MobileViewerInfoRow {
  readonly id: string;
  readonly label: string;
  readonly value: string;
}

/** Thứ đang chọn, đã rút về đúng thứ tấm thông tin hiện. */
export interface MobileViewerSelection {
  readonly entityId: string;
  /** Tên tiếng Việt của loại đối tượng — "tường", "phòng", "ô mở". */
  readonly kindLabel: string;
  readonly title: string;
  readonly rows: readonly MobileViewerInfoRow[];
  /**
   * Mục này là thứ chỉ sửa được trên máy tính.
   *
   * `true` thì tấm thông tin hiện một câu giải thích kèm nút gửi liên kết —
   * **không phải một nút xám không giải thích**.
   */
  readonly needsDesktopToEdit: boolean;
}

/** Một phép đo đã xong, đã định dạng để hiện. */
export interface MobileViewerMeasurement {
  readonly id: string;
  readonly kindLabel: string;
  /** Kết quả đã định dạng, ví dụ "3,45 m". */
  readonly valueLabel: string;
}

/* -------------------------------------------------------------------------- */
/* 4. Module cảnh — T5 sở hữu.                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Cử chỉ mà bộ nhận chạm dịch ra.
 *
 * **Vì sao mục này tồn tại:** đặc tả gốc nói ba cử chỉ "tất cả do R-06". Khảo
 * sát cho thấy `src/lib/three/camera` **không có mặt tiếp nhận sự kiện nào** —
 * `CameraModeController` chỉ có `viewpoint/pose/update/settle/applyTo`. Nên phần
 * nghe DOM nằm ở `mobileViewerGestures.ts` trong thư mục màn, còn **toán camera
 * vẫn hoàn toàn của R-06**. Đây là quyết định đã được duyệt, không phải đường tắt.
 */
export type MobileViewerGesture =
  | { readonly kind: 'orbit'; readonly deltaXPx: number; readonly deltaYPx: number }
  | { readonly kind: 'zoom'; readonly scale: number }
  | { readonly kind: 'pan'; readonly deltaXPx: number; readonly deltaYPx: number }
  | { readonly kind: 'tap'; readonly xPx: number; readonly yPx: number };

/** Tuỳ chọn lắp cảnh di động. */
export interface MobileViewerSceneOptions {
  /** Các tầng cần dựng, theo thứ tự từ dưới lên. */
  readonly floorIds: readonly string[];
  /**
   * Mức chi tiết dựng ĐẦU TIÊN. Đặc tả bắt "mức gọn trước rồi mới nâng dần",
   * nên giá trị mở màn là `'block'`, không phải `'full'`.
   */
  readonly initialDetail: DetailLevel;
  /** Chạm trúng một đối tượng. `null` khi chạm vào chỗ trống. */
  readonly onPick: (hit: EntityHit | null) => void;
  /** R-04 vừa hạ mức chi tiết — hook hiện điều đó ra cho người dùng biết. */
  readonly onDetailChange: (detail: DetailLevel) => void;
  /** Số khung hình mỗi giây, báo đều để hook quyết định trạng thái. */
  readonly onFrameRate: (fps: number) => void;
}

/** Tay cầm cảnh đã lắp. */
export interface MobileViewerSceneHandle {
  /** Đổi tầng đang hiện. */
  setActiveFloor: (floorId: string | null) => void;
  /** Mức chi tiết đang dùng thật, sau mọi lần R-04 hạ. */
  currentDetail: () => DetailLevel;
  /** Điểm đo trên bề mặt, cho M-15. */
  pickMeasurePoint: (xPx: number, yPx: number) => MeasurePoint | null;
  /** R-05: trả lại mọi tài nguyên GPU. Gọi đúng một lần. */
  dispose: () => void;
}

/** Kết quả lắp — không có WebGL là một nhánh hợp lệ, không phải sự cố. */
export type MobileViewerSceneMount =
  | { readonly ok: true; readonly handle: MobileViewerSceneHandle }
  | { readonly ok: false; readonly reason: 'webglUnavailable' | 'deviceTooWeak' };

/* -------------------------------------------------------------------------- */
/* 5. Props của view — T7 dựng, T8 kiểm.                                       */
/* -------------------------------------------------------------------------- */

/**
 * Props của `MobileViewer.tsx`.
 *
 * View thuần: test được **chỉ từ props**, không chạm store, không chạm mạng
 * (R-60). Mọi chuỗi ở đây đã là tiếng Việt đã định dạng.
 */
export interface MobileViewerProps {
  readonly state: MobileViewerState;

  /* Thanh trên. */
  readonly projectName: string;
  readonly onShare: () => void;

  /* Khung 3D. Container cấp, không phải hook — story và test bỏ trống. */
  readonly canvasRef?: ((element: HTMLCanvasElement | null) => void) | undefined;

  /* Thanh dưới. */
  readonly isCompact: boolean;
  readonly activeTool: MobileViewerToolId | null;
  readonly onSelectTool: (tool: MobileViewerToolId | null) => void;

  /* Tầng. */
  readonly floors: readonly MobileViewerFloor[];
  readonly activeFloorId: string | null;
  readonly onSelectFloor: (floorId: string) => void;

  /* Tấm thông tin — chỉ đọc. */
  readonly selection: MobileViewerSelection | null;
  readonly onDismissSelection: () => void;
  /** Câu mời sửa trên máy tính, kèm nút gửi liên kết. */
  readonly onSendDesktopLink: () => void;

  /* Đo. */
  readonly measurements: readonly MobileViewerMeasurement[];

  /**
   * Mức chi tiết đang dựng, đã thành nhãn tiếng Việt — ví dụ "đang tải mức gọn".
   * `null` khi không có gì để nói.
   */
  readonly detailLabel: string | null;

  /** Liên kết sang bản 2D — lối thoát của trạng thái `error` (máy yếu). */
  readonly fallback2dHref: string;
}

/* -------------------------------------------------------------------------- */
/* 6. Hook — T6 sở hữu.                                                        */
/* -------------------------------------------------------------------------- */

/** Những gì `useMobileViewer` trả về: đúng props của view, không thừa trường nào. */
export type MobileViewerModel = Omit<MobileViewerProps, 'canvasRef'>;
