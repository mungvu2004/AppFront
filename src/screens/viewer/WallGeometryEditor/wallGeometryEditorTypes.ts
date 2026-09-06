/**
 * Hợp đồng kiểu của `WallGeometryEditor` — mọi thứ view, hook, gateway và bài
 * kiểm dùng chung, viết ra một lần ở đây.
 *
 * File `.ts` thuần: không JSX, không logic, không import `@/api`, `@/store`,
 * `@/domain` hay `@/lib/http` — cùng khuôn `propertyInspectorTypes.ts` và
 * `viewerShellTypes.ts` bên cạnh. Màn này không cần biết `Wall` của domain là
 * hình gì: mọi con số người dùng ĐỌC đã thành CHUỖI ở tầng viewmodel trước khi
 * tới đây (A15), và mọi con số người dùng KHÔNG đọc — toạ độ tay nắm — đã là
 * pixel khung nhìn do hook chiếu sẵn. View không chiếu, không quy đổi, không
 * tính giao điểm.
 *
 * Hai chỗ trong file này được khai để CHỊU ĐƯỢC THAY ĐỔI, xem
 * `notes/wall-geometry-editor/contract-screen.md` mục 7:
 * {@link WallGeometryEditorContent.comparisonChip} nhận `null` như một câu trả
 * lời hợp lệ, và {@link WallGeometrySnapModel.kinds} là một DANH SÁCH chứ không
 * phải bốn trường cứng.
 *
 * `WallGeometryEditorGateway` KHÔNG nằm ở đây — cổng là của T6
 * (`wallGeometryEditorGateway.ts`); file này không nhập ngược sang đó, cùng lý
 * do `viewerShellTypes.ts` không nhắc tới `ViewerShellGateway`.
 */

import type { MotionDurationName } from '@/lib/motion/tokens';
import type { ViewStatusCode } from '@/lib/viewmodel/types';

/* -------------------------------------------------------------------------- */
/* 3.1 — Bố cục và chuyển động.                                                */
/* -------------------------------------------------------------------------- */

/**
 * Số đo của màn, bằng pixel giao diện.
 *
 * Bố cục, không phải hằng số nghiệp vụ — cùng lý lẽ `VIEWER_LAYOUT`
 * (`viewerShellTypes.ts:59-66`): R-71 cấm chép lại mã lỗi, thời gian chờ, ngưỡng
 * số và thời lượng chuyển động; bề rộng một tay nắm không nằm trong danh sách
 * đó và không có nguồn nào khác trong repo để đọc ra.
 */
export const WALL_GEOMETRY_EDITOR_LAYOUT = Object.freeze({
  /** Dải chế độ sửa trên cùng canvas. */
  editBandHeightPx: 36,
  /** Bo góc thanh công cụ nổi — viên thuốc. */
  toolbarRadiusPx: 999,
  /** Tay nắm đỉnh: vòng tròn trắng, viền `--accent` (A1/A2 — token, không mã màu). */
  vertexHandlePx: 8,
  /** Cùng tay nắm ấy khi con trỏ trỏ vào. */
  vertexHandleHoverPx: 12,
  /** Bề dày viền tay nắm đỉnh. */
  vertexHandleStrokePx: 2,
  /** Tay nắm cạnh: ô vuông. */
  edgeHandlePx: 6,
  /** Đường bắt điểm: nét đứt mảnh. */
  snapGuideStrokePx: 1,
  /**
   * Bán kính bắt điểm của đặc tả.
   *
   * HOOK đọc con số này để hỏi cổng (mục 5, `findSnapCandidates`); VIEW không
   * bao giờ đọc nó, vì view không quyết định cái gì bắt vào cái gì.
   */
  snapRadiusPx: 8,
  /** Hai nửa hé ra chừng này khi tách tường, để người dùng THẤY vết cắt. */
  splitRevealGapPx: 2,
});

/** Bốn lúc màn này chuyển động. */
export type WallGeometryMotionSlot = 'cancelDrag' | 'joinWalls' | 'splitReveal' | 'snapSettle';

/**
 * Ô nào của thang chuyển động cho việc nào — TÊN ô, không phải con số.
 *
 * Đặc tả đòi "nối hai tường trong 240ms". `MOTION_DURATIONS_MS`
 * (`lib/motion/tokens.ts:62-67`) không có 240 và R-71 cấm viết nó vào màn, nên
 * việc ấy chạy ở `standard` (260 ms) — ô dành cho "thứ có diện tích riêng của
 * nó". Huỷ kéo giữa chừng chạy ở `fast`, đúng 180 ms đặc tả đòi.
 */
export const WALL_GEOMETRY_MOTION: Readonly<Record<WallGeometryMotionSlot, MotionDurationName>> =
  Object.freeze({
    cancelDrag: 'fast',
    joinWalls: 'standard',
    splitReveal: 'fast',
    snapSettle: 'instant',
  });

/* -------------------------------------------------------------------------- */
/* 3.2 — Toạ độ.                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Một điểm trong khung nhìn, bằng pixel.
 *
 * Đây là đơn vị DUY NHẤT view biết. Toạ độ mô hình (milimét) không đi qua props:
 * chiếu từ mô hình sang pixel là việc của cảnh 3D và của hook, còn view chỉ đặt
 * một vòng tròn vào chỗ được bảo. Đặt tên `xPx`/`yPx` chứ không `x`/`y` để một
 * chỗ gọi lỡ truyền milimét vào là lỗi biên dịch chứ không phải một tay nắm
 * lệch ba mét.
 */
export interface WallGeometryPointPx {
  readonly xPx: number;
  readonly yPx: number;
}

/* -------------------------------------------------------------------------- */
/* 3.3 — Dải chế độ sửa.                                                       */
/* -------------------------------------------------------------------------- */

/** Dải cao `editBandHeightPx` trên cùng canvas. */
export interface WallGeometryEditBand {
  /**
   * Đã ghép sẵn: "Đang sửa: #W-014". Mã tường viết hoa là ngoại lệ chữ hoa của
   * A6; phần còn lại viết thường kiểu câu.
   */
  readonly label: string;
  /** Nhãn nút thoát chế độ sửa. */
  readonly doneLabel: string;
  readonly onDone: () => void;
}

/* -------------------------------------------------------------------------- */
/* 3.4 — Thanh công cụ sửa.                                                    */
/* -------------------------------------------------------------------------- */

/** Sáu công cụ của thanh nổi, đúng thứ tự trái sang phải. */
export const WALL_GEOMETRY_TOOL_IDS = [
  'moveVertex',
  'addVertex',
  'removeVertex',
  'splitWall',
  'joinWalls',
  'resetHeight',
] as const;

export type WallGeometryToolId = (typeof WALL_GEOMETRY_TOOL_IDS)[number];

/**
 * Biểu tượng của một nút — mã đóng, không phải một chuỗi tự do.
 *
 * Khai riêng khỏi {@link WallGeometryToolId} (dù hôm nay sáu mã trùng tên sáu
 * công cụ) vì bảng biểu tượng của view khoá theo BIỂU TƯỢNG: hai công cụ dùng
 * chung một hình về sau sẽ không phải đổi kiểu của bảng. Cùng lý lẽ `ViewIconCode`
 * (`lib/viewmodel/types.ts:78`): bảng là một `Record` đầy đủ, nên thiếu một mã
 * là lỗi biên dịch chứ không phải một ô vuông trắng.
 */
export type WallGeometryToolIconCode =
  | 'moveVertex'
  | 'addVertex'
  | 'removeVertex'
  | 'splitWall'
  | 'joinWalls'
  | 'resetHeight';

/** Một nút trên thanh công cụ, đã đủ chữ để vẽ. */
export interface WallGeometryToolButton {
  readonly id: WallGeometryToolId;
  /** Nhãn tiếng Việt, viết thường kiểu câu (A6). */
  readonly label: string;
  readonly iconCode: WallGeometryToolIconCode;
  /** Phím tắt in trên gợi ý, ví dụ "V". Chữ hoa là ngoại lệ A6 cho tên phím. */
  readonly keyLabel: string;
  /** Gợi ý đầy đủ, nhãn và phím đã ghép — view không tự nối chuỗi. */
  readonly tooltip: string;
  /** Bấm được không. `false` là làm mờ, KHÁC với bị gỡ khỏi thanh — xem `toolbar.buttons`. */
  readonly isEnabled: boolean;
  /** Đang là công cụ hiện hành. */
  readonly isActive: boolean;
  readonly onSelect: () => void;
}

export interface WallGeometryToolbar {
  /**
   * Các nút hiện trên thanh.
   *
   * Ở trạng thái `forbidden` mảng này RỖNG: đặc tả nói công cụ sửa "bị gỡ khỏi
   * thanh", không phải làm mờ. Một nút mờ vẫn là một lời hứa; một thanh không có
   * nút là một câu trả lời.
   */
  readonly buttons: readonly WallGeometryToolButton[];
  /**
   * Câu gợi ý hiện THAY CHO các nút — trạng thái `empty` dùng nó, và chỉ nó.
   * `null` khi thanh đang có nút để hiện.
   */
  readonly hint: string | null;
}

/* -------------------------------------------------------------------------- */
/* 3.5 — Chuỗi kích thước sống.                                                */
/* -------------------------------------------------------------------------- */

/** Một đoạn của chuỗi kích thước chạy dọc bức tường đang sửa. */
export interface WallGeometryDimensionSegment {
  readonly id: string;
  /**
   * Số đo ĐÃ định dạng ở viewmodel (A15) — "4.250,00 mm", dấu thập phân là dấu
   * phẩy. View không gọi `toFixed`, không nối đơn vị (`local/no-raw-number`).
   */
  readonly lengthLabel: string;
  /** Giữa đoạn, pixel khung nhìn — chỗ đặt chữ. */
  readonly midpointPx: WallGeometryPointPx;
  /**
   * Số của đoạn này đang đổi trong lượt kéo hiện tại — view cho nó chạy số.
   * Đoạn của các tường phụ thuộc cũng bật cờ này khi chiều dài chúng đổi theo.
   */
  readonly isLive: boolean;
}

export interface WallGeometryDimensionChain {
  readonly segments: readonly WallGeometryDimensionSegment[];
  /** Tổng chiều dài đã định dạng; `null` khi chuỗi rỗng. */
  readonly totalLabel: string | null;
}

/* -------------------------------------------------------------------------- */
/* 3.6 — Bảng đỉnh.                                                            */
/* -------------------------------------------------------------------------- */

/** Trạng thái sửa của MỘT ô toạ độ. */
export type WallGeometryCellStatus = 'idle' | 'editing' | 'invalid';

/**
 * Một ô toạ độ sửa được ngay trong bảng.
 *
 * Hai chuỗi chứ không một: `displayValue` là số đã định dạng để ĐỌC (A15),
 * `draftValue` là đúng những ký tự người dùng đang gõ. Gộp làm một thì hoặc là
 * view phải tự bỏ dấu phân nhóm khi vào chế độ gõ — một phép quy đổi trong view,
 * đúng thứ `local/no-raw-number` chặn — hoặc là người dùng gõ "1.2" và thấy nó
 * bị định dạng lại giữa chừng.
 */
export interface WallGeometryVertexCell {
  readonly displayValue: string;
  readonly draftValue: string;
  readonly status: WallGeometryCellStatus;
  /**
   * Câu giải thích khi `status === 'invalid'`; `null` ở hai trạng thái kia.
   * Hình học không hợp lệ KHÔNG BAO GIỜ bị từ chối im lặng — đây là chỗ câu ấy
   * hiện ra tại đúng ô gây lỗi.
   */
  readonly message: string | null;
  readonly onDraftChange: (nextValue: string) => void;
  /** Enter, hoặc rời ô. */
  readonly onCommit: () => void;
  /** Esc trong ô — trả về `displayValue`, không đụng tới hình học. */
  readonly onCancel: () => void;
}

/** Một hàng của bảng đỉnh. */
export interface WallGeometryVertexRow {
  readonly id: string;
  /** Mã đỉnh, chữ đều — "V-03". Chữ hoa là ngoại lệ A6 cho mã. */
  readonly code: string;
  readonly x: WallGeometryVertexCell;
  readonly y: WallGeometryVertexCell;
  readonly isSelected: boolean;
  /** Chỉ đọc — vai chỉ xem, hoặc đỉnh thuộc tường khác trong lượt chọn nhiều. */
  readonly isLocked: boolean;
  readonly onSelect: () => void;
}

/** Nhãn ba cột. Ở đây chứ không viết thẳng trong JSX vì bài kiểm của T7 đối chiếu chúng. */
export interface WallGeometryVertexTableColumns {
  readonly code: string;
  readonly x: string;
  readonly y: string;
}

export interface WallGeometryVertexTable {
  readonly columns: WallGeometryVertexTableColumns;
  /**
   * Số hàng là DỮ LIỆU, không phải hai.
   *
   * Hôm nay một `Wall` của domain là một `Segment` hai đầu mút
   * (`domain/spatial/types.ts:123-132`); đặc tả màn thì nói tới thêm và xoá đỉnh.
   * Một mảng đúng ở cả hai thế giới, hai trường `start`/`end` thì không.
   */
  readonly rows: readonly WallGeometryVertexRow[];
  /** Câu hiện khi `rows` rỗng; `null` khi có hàng. */
  readonly emptyMessage: string | null;
}

/* -------------------------------------------------------------------------- */
/* 3.7 — Tay nắm, bắt điểm, tô sáng.                                           */
/* -------------------------------------------------------------------------- */

export type WallGeometryHandleKind = 'vertex' | 'edge';

/** Bốn hướng của đường bàn phím (A12 — bàn phím là đường đi hạng nhất). */
export type WallGeometryNudgeDirection = 'left' | 'right' | 'up' | 'down';

/** Một tay nắm trên lớp phủ: vòng tròn của một đỉnh, hoặc ô vuông của một cạnh. */
export interface WallGeometryHandle {
  readonly id: string;
  readonly kind: WallGeometryHandleKind;
  readonly atPx: WallGeometryPointPx;
  readonly isHovered: boolean;
  readonly isDragging: boolean;
  readonly isEnabled: boolean;
  /** Tiếng Việt, cho `aria-label` — `expectVietnamese` soát cả nhãn trợ năng (R-72). */
  readonly ariaLabel: string;
  readonly onPointerDown: (atPx: WallGeometryPointPx) => void;
  readonly onPointerEnter: () => void;
  readonly onPointerLeave: () => void;
  /**
   * Đường bàn phím của A12: mũi tên dời tay nắm.
   *
   * `isCoarse` là "người dùng đang giữ Shift"; BƯỚC DỜI bao nhiêu milimét là
   * việc của hook, không phải của view — R-71 cấm màn tự đặt ngưỡng số.
   */
  readonly onNudge: (direction: WallGeometryNudgeDirection, isCoarse: boolean) => void;
}

/**
 * Mã một loại bắt điểm.
 *
 * `string`, KHÔNG phải một union bốn nhánh — đây là chỗ để mở #2 (mục 7). Số
 * loại có thể là 4 hoặc 3, và view không bao giờ rẽ nhánh theo mã này: nó chỉ
 * vẽ `label`.
 */
export type SnapKindId = string;

/**
 * Những mã đang tồn tại, để hook và bài kiểm gọi tên chúng mà không gõ chuỗi.
 *
 * Không phải một union kiểu, mà là DỮ LIỆU. Xoá `aiTrace` khỏi bảng này là một
 * dòng, và không một trường nào ở mục 3 hay mục 4 phải đổi theo.
 */
export const KNOWN_SNAP_KIND_IDS = {
  axis: 'axis',
  otherVertex: 'otherVertex',
  perpendicular: 'perpendicular',
  aiTrace: 'aiTrace',
} as const;

/** Một loại bắt điểm, như nó hiện ra trên màn. */
export interface WallGeometrySnapKind {
  readonly id: SnapKindId;
  /**
   * Tên loại bắt điểm, HIỆN TRÊN MÀN — "vuông góc", "đỉnh khác", "trục B".
   * Điều cấm tuyệt đối: mỗi loại phải được GỌI TÊN, không chỉ cảm nhận được.
   */
  readonly label: string;
  readonly isEnabled: boolean;
  /** Tắt/bật riêng loại này; `null` khi loại này không tắt riêng được. */
  readonly onToggle: (() => void) | null;
}

/** Một đường bắt điểm đang hiện: nét đứt 1px `--accent` kèm nhãn chữ đều. */
export interface WallGeometrySnapGuide {
  readonly id: string;
  readonly kindId: SnapKindId;
  /** Nhãn gọi tên loại bắt điểm này, đặt cạnh đường. */
  readonly label: string;
  readonly fromPx: WallGeometryPointPx;
  readonly toPx: WallGeometryPointPx;
  readonly labelAtPx: WallGeometryPointPx;
}

export interface WallGeometrySnapModel {
  /**
   * BA hoặc BỐN phần tử — chỗ để mở #2. Danh sách, không phải bốn trường cứng.
   * View lặp qua nó; nó không hỏi "có `aiTrace` không".
   */
  readonly kinds: readonly WallGeometrySnapKind[];
  /** Đường đang hiện lúc này; rỗng khi không bắt vào gì. */
  readonly activeGuides: readonly WallGeometrySnapGuide[];
  /** Người dùng đang giữ Alt — bắt điểm tắt tạm. */
  readonly isSuppressed: boolean;
  /** Người dùng đang giữ Shift — khoá trục. */
  readonly isAxisLocked: boolean;
  /** Câu nói ra hai trạng thái trên cho trình đọc màn hình; `null` khi không giữ phím nào. */
  readonly modifierNotice: string | null;
}

/**
 * Sắc thái của một dấu hiệu trên màn này.
 *
 * `Exclude<…, 'verified'>` chứ không phải chép lại ba chuỗi: A5 nói xanh "đã xác
 * minh" CHỈ đánh dấu việc người duyệt, và trên màn này không có việc duyệt nào.
 * Loại nó ở tầng kiểu nghĩa là đầu ra của bộ so hình học không có đường nào bật
 * được cờ xanh, kể cả khi ai đó muốn.
 */
export type WallGeometryTone = Exclude<ViewStatusCode, 'verified'>;

/** Lớp tô sáng cạnh gây lỗi. */
export interface WallGeometryEdgeHighlight {
  readonly edgeId: string;
  readonly fromPx: WallGeometryPointPx;
  readonly toPx: WallGeometryPointPx;
  readonly tone: WallGeometryTone;
  /** Tiếng Việt, cho trình đọc màn hình — cạnh tô sáng không được chỉ nói bằng màu (A2). */
  readonly ariaLabel: string;
}

/**
 * Chip đối chiếu ở góc: "Lệch so với bản vẽ gốc: 12 mm".
 *
 * Chỗ để mở #1 nằm ở NƠI GỌI kiểu này, không ở đây — xem
 * {@link WallGeometryEditorContent.comparisonChip}.
 */
export interface WallGeometryComparisonChip {
  /** Câu đã ghép và đã định dạng (A15). */
  readonly label: string;
  /** Chuyển sang `attention` khi vượt ngưỡng; ngưỡng là việc của hook (R-71). */
  readonly tone: WallGeometryTone;
}

/* -------------------------------------------------------------------------- */
/* 3.8 — Phiên kéo.                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Một phiên kéo đang diễn ra. `null` khi tay đang rời.
 *
 * Ba callback nằm ở ĐÂY chứ không ở tay nắm, và đó là điều cấm tuyệt đối "một
 * phiên kéo chỉ sinh MỘT bước hoàn tác" được viết thành kiểu: con trỏ rời khỏi
 * tay nắm ngay khi bắt đầu kéo, nên `pointermove` phải gắn vào cả lớp phủ. Một
 * phiên kéo có đúng một `onPointerUp` và đúng một `onCancel`, nên không có cách
 * nào để hai lượt ghi cùng chạy ra từ một lần kéo.
 */
export interface WallGeometryDragSession {
  readonly handleId: string;
  readonly onPointerMove: (atPx: WallGeometryPointPx) => void;
  readonly onPointerUp: (atPx: WallGeometryPointPx) => void;
  /** Esc giữa lúc kéo. Sau lời gọi này `drag` thành `null` và `returningHandleId` bật lên. */
  readonly onCancel: () => void;
}

/* -------------------------------------------------------------------------- */
/* 3.9 — Nội dung chung và props.                                              */
/* -------------------------------------------------------------------------- */

/**
 * Thứ bốn trạng thái `partial` / `error` / `success` / `forbidden` cùng có —
 * bốn trạng thái duy nhất có một bức tường đang mở ra để sửa.
 */
export interface WallGeometryEditorContent {
  readonly band: WallGeometryEditBand;
  readonly toolbar: WallGeometryToolbar;
  readonly dimensionChain: WallGeometryDimensionChain;
  readonly vertexTable: WallGeometryVertexTable;
  /**
   * Chip đối chiếu, hoặc `null` khi KHÔNG CÓ vết vẽ gốc để so.
   *
   * Chỗ để mở #1 (mục 7). `| null` bắt buộc chứ không phải `?:` tuỳ chọn: một
   * trường tuỳ chọn để người ta quên truyền, còn một trường `| null` bắt T5 vẽ
   * nhánh vắng mặt và bắt T6 nói ra rằng mình không có gì để so. Vắng mặt là
   * MỘT CÂU TRẢ LỜI, không phải một chỗ trống phải lấp bằng dữ liệu bịa.
   */
  readonly comparisonChip: WallGeometryComparisonChip | null;
  readonly handles: readonly WallGeometryHandle[];
  readonly snap: WallGeometrySnapModel;
  /** Rỗng khi không cạnh nào bị tô sáng. */
  readonly edgeHighlights: readonly WallGeometryEdgeHighlight[];
  readonly drag: WallGeometryDragSession | null;
  /**
   * Tay nắm vừa bị huỷ kéo, để view cho nó về chỗ cũ bằng
   * `WALL_GEOMETRY_MOTION.cancelDrag`; `null` khi không có.
   *
   * Cùng khuôn `PropertyInspectorProps.recentlyCommittedRowId`
   * (`propertyInspectorTypes.ts:483`): tín hiệu do hook sinh, hiệu ứng do view
   * chạy, và THỜI LƯỢNG không đi kèm — nó đã ở `WALL_GEOMETRY_MOTION`, và một
   * con số thứ hai chạy dọc props chỉ là một chỗ nữa để hai bên trôi khỏi nhau.
   */
  readonly returningHandleId: string | null;
}

/**
 * Toàn bộ props của `WallGeometryEditor.tsx`.
 *
 * Đúng HAI trường. Mọi dữ liệu và callback của cả bảy trạng thái đã nằm trong
 * chính `state`; view đọc `state.kind` rồi vẽ đúng nhánh.
 */
export interface WallGeometryEditorProps {
  readonly state: WallGeometryEditorState;
  /**
   * Callback ref nhận lớp phủ sau khi view gắn, để CONTAINER đưa nó vào hook.
   *
   * Hook không cấp trường này — phần tử DOM chỉ tồn tại sau lượt gắn đầu tiên,
   * nên nó không nằm trong {@link UseWallGeometryEditorResult}. Cùng cách
   * `Viewer3DProps.canvasRef` (`viewer3dTypes.ts:44-66`).
   */
  readonly overlayRef?: ((element: HTMLDivElement | null) => void) | undefined;
}

/* -------------------------------------------------------------------------- */
/* 3.10 — Chuỗi tiếng Việt dùng chung.                                         */
/* -------------------------------------------------------------------------- */

/**
 * Mọi chuỗi màn này hiện ra, viết một lần.
 *
 * Trong `wallGeometryEditorTypes.ts` chứ không trong hook: story và kịch bản là
 * của T5, hook là của T6, hai người ở hai worktree. `PropertyInspector` để
 * `PROPERTY_INSPECTOR_TEXT` trong hook và `propertyInspectorScenarios.ts` nhập
 * ngược lên hook để lấy chữ — ở đây làm thế là T5 không dựng nổi story cho tới
 * khi T6 đẩy mã lên.
 *
 * Chỗ nào có chỗ trống thì là HÀM, không phải chuỗi có `{{…}}`: `vi.json` không
 * phải bảng dịch lúc chạy, nên không có bộ nội suy nào để chạy các dấu ngoặc ấy.
 */
export const WALL_GEOMETRY_EDITOR_TEXT = Object.freeze({
  regionLabel: 'Sửa hình học tường',

  band: {
    editing: (wallCode: string): string => `Đang sửa: ${wallCode}`,
    done: 'Xong',
  },

  /** Nhãn và phím tắt của sáu công cụ, khoá theo `WallGeometryToolId`. */
  tools: {
    moveVertex: { label: 'Di chuyển đỉnh', key: 'V' },
    addVertex: { label: 'Thêm đỉnh', key: 'A' },
    removeVertex: { label: 'Xoá đỉnh', key: 'X' },
    splitWall: { label: 'Tách tường', key: 'T' },
    joinWalls: { label: 'Nối tường', key: 'N' },
    resetHeight: { label: 'Đặt lại chiều cao', key: 'H' },
    tooltip: (label: string, key: string): string => `${label} · phím ${key}`,
  },

  dimensionChain: {
    regionLabel: 'Chuỗi kích thước của tường đang sửa',
    total: (length: string): string => `Tổng chiều dài: ${length}`,
  },

  vertexTable: {
    title: 'Bảng đỉnh',
    columnCode: 'Đỉnh',
    columnX: 'Toạ độ x',
    columnY: 'Toạ độ y',
    empty: 'Chưa có đỉnh nào để sửa.',
    cellInvalid: 'Giá trị chưa hợp lệ nên toạ độ đã trở về số cũ.',
  },

  comparison: {
    deviation: (deviation: string): string => `Lệch so với bản vẽ gốc: ${deviation}`,
  },

  /**
   * Nhãn của các loại bắt điểm — CHỖ ĐỂ MỞ #2.
   *
   * `aiTrace` có mặt ở đây không có nghĩa là loại thứ tư tồn tại: hook chỉ đưa
   * nhãn nào nó thật sự dựng được vào `WallGeometrySnapModel.kinds`. Bốn khoá
   * này là một TỪ ĐIỂN, không phải một danh sách bắt buộc phải dùng hết.
   */
  snap: {
    axis: (axisCode: string): string => `Trục ${axisCode}`,
    otherVertex: 'Đỉnh khác',
    perpendicular: 'Vuông góc',
    aiTrace: 'Vết vẽ gốc',
    axisLocked: 'Đang khoá trục theo phím Shift',
    suppressed: 'Đang tắt bắt điểm theo phím Alt',
  },

  handles: {
    vertex: (vertexCode: string): string => `Đỉnh ${vertexCode}`,
    edge: (edgeCode: string): string => `Cạnh ${edgeCode}`,
    nudgeHint: 'Dùng phím mũi tên để dời đỉnh, giữ Shift để dời bước lớn.',
    offendingEdge: (edgeCode: string): string => `Cạnh ${edgeCode} đang gây lỗi hình học`,
  },

  states: {
    empty: {
      message: 'Chưa chọn tường nào để sửa.',
      hint: 'Chọn một bức tường trong khung nhìn, hoặc nhấn Tab để duyệt qua các tường.',
    },
    loading: { message: 'Đang tính lại hình học…' },
    partial: {
      heightOnly: 'Đang chọn nhiều tường nên chỉ đổi được chiều cao.',
      gapSize: (gap: string): string => `Khe hở: ${gap}`,
      closeGap: 'Đóng khe hở',
    },
    error: {
      selfIntersecting:
        'Đa giác tự cắt nên hình mới bị từ chối. Toạ độ đã trở về giá trị trước đó.',
      dismiss: 'Đã hiểu',
    },
    forbidden: {
      viewerRole: 'Bạn không có quyền sửa hình học nên các công cụ sửa đã được gỡ khỏi thanh.',
      sectionOrthographic:
        'Đang ở chế độ trực giao lát cắt nên hình học chưa sửa được. Thoát lát cắt rồi thử lại.',
    },
    collapsed: {
      summary: (wallCode: string): string => `Tường ${wallCode}`,
      notice: 'Trên màn hình nhỏ, hình học chỉ xem được chứ không sửa được.',
      exit: 'Thoát chế độ sửa',
    },
  },

  /** Câu nói ra khi một lượt ghi bị từ chối — không bao giờ từ chối im lặng. */
  refusal: {
    vertexFloor: 'Một bức tường cần ít nhất hai đỉnh nên đỉnh này chưa xoá được.',
    joinNeedsTwoEnds: 'Nối tường cần đúng hai đầu mút đang chọn.',
    splitOffWall: 'Điểm tách nằm ngoài bức tường nên chưa tách được.',
    heightBelowOpening:
      'Chiều cao mới thấp hơn đỉnh một ô mở trên tường này nên chưa đặt được.',
    noSaveTarget:
      'Chưa mở dự án và tầng nào nên chưa có nơi để lưu. Bản vẽ của bạn không có lỗi nào ở đây.',
    serverRejected: (kind: string): string =>
      `Máy chủ chưa nhận được hình học mới (${kind}). Thay đổi vẫn còn trên máy này.`,
  },

  /** Phần mô tả việc vừa làm của toast hoàn tác (A8). Nhãn nút lấy từ `common.undo`. */
  undo: {
    vertexMoved: (vertexCode: string): string => `Đã dời đỉnh ${vertexCode}`,
    vertexAdded: 'Đã thêm một đỉnh',
    vertexRemoved: 'Đã xoá một đỉnh',
    wallSplit: (wallCode: string): string => `Đã tách tường ${wallCode}`,
    wallsJoined: 'Đã nối hai tường',
    heightChanged: 'Đã đổi chiều cao tường',
    gapClosed: 'Đã đóng khe hở',
  },
});

/* -------------------------------------------------------------------------- */
/* 4 — `UseWallGeometryEditorResult` và tuỳ chọn hook / container.             */
/* -------------------------------------------------------------------------- */

/**
 * Đúng những gì `useWallGeometryEditor` trả về.
 *
 * Bằng props của view TRỪ `overlayRef` (xem lý do ở
 * {@link WallGeometryEditorProps.overlayRef}), nên
 * `<WallGeometryEditor {...useWallGeometryEditor(options)} overlayRef={ref} />`
 * là một dòng đúng kiểu, không dư trường nào và không thiếu trường nào.
 *
 * Khai bằng `Omit` chứ không gõ lại `{ state: … }`: T5 thêm một trường vào props
 * thì hàm của T6 lập tức không gán được nữa, và `tsc` chỉ đúng vào dòng ấy. Đó
 * là toàn bộ lý do mối nối này tồn tại.
 */
export type UseWallGeometryEditorResult = Omit<WallGeometryEditorProps, 'overlayRef'>;

/** Tuỳ chọn container truyền vào `useWallGeometryEditor`. */
export interface UseWallGeometryEditorOptions {
  /** Bức tường đang sửa. `null` khi chưa chọn gì — hook trả `kind: 'empty'`. */
  readonly wallId: string | null;
  /**
   * Mọi tường đang chọn. Nhiều hơn một phần tử ⇒ hook trả `kind: 'partial'` với
   * `isHeightOnly: true`.
   */
  readonly selectedWallIds: readonly string[];
  /** Vai hiện tại có sửa được không — `false` buộc hook trả `kind: 'forbidden'`. */
  readonly canEdit: boolean;
  /**
   * Camera đang ở phép chiếu trực giao của lát cắt.
   *
   * Điều cấm tuyệt đối: "không cho sửa khi đang ở chế độ trực giao lát cắt".
   * `true` ⇒ hook trả `kind: 'forbidden'` với câu giải thích riêng của tình
   * huống này, không phải câu của vai chỉ xem.
   */
  readonly isSectionOrthographic: boolean;
  /** Khung nhìn đang thu gọn (di động) ⇒ hook trả `kind: 'collapsed'`. */
  readonly isCollapsed: boolean;
  /** Lớp phủ, để đổi toạ độ con trỏ sang toạ độ khung nhìn. `null` trước lượt gắn đầu. */
  readonly overlayElement: HTMLElement | null;
  /** Người dùng bấm "Xong", hoặc Esc ở lớp ngoài cùng (A12) — thoát chế độ sửa. */
  readonly onExitEditMode: () => void;
  /**
   * Hình học vừa đổi thật. Nơi gọi (Viewer3D, mặt bằng 2D) dựng lại theo.
   *
   * Hook KHÔNG tự gọi vào Viewer3D: `Viewer3D` là màn đã xong, nằm trong danh
   * sách cấm sửa. Đây là sợi dây để nó cắm vào sau, không phải một lời gọi
   * ngược.
   */
  readonly onGeometryChanged: (wallId: string) => void;
}

/**
 * Props của `WallGeometryEditorContainer` — thứ MỘT MÀN KHÁC truyền vào để mở
 * màn này mà không phải viết thêm một dòng logic nào (R-73).
 *
 * KHÔNG có `canEdit`: container tự đọc vai người xem, đúng khuôn
 * `PropertyInspectorContainerProps`. Màn gọi nó không cần biết chuyện phân quyền.
 */
export interface WallGeometryEditorContainerProps {
  readonly wallId: string | null;
  readonly selectedWallIds: readonly string[];
  readonly onExitEditMode: () => void;
  readonly onGeometryChanged?: ((wallId: string) => void) | undefined;
  readonly isSectionOrthographic?: boolean | undefined;
  readonly isCollapsed?: boolean | undefined;

  /** Chỗ tiêm của story và bài kiểm — R-73 đòi bản giả cắm được vào. */
  readonly forceState?: WallGeometryEditorStateKind | undefined;
}

/* -------------------------------------------------------------------------- */
/* 6.1 — Bảy trạng thái.                                                       */
/* -------------------------------------------------------------------------- */

/** 1. Rỗng — chưa chọn tường nào. Thanh công cụ hiện MỘT CÂU GỢI Ý thay cho sáu nút. */
export interface WallGeometryEditorEmptyState {
  readonly kind: 'empty';
  readonly message: string;
  /** Câu nhắc phím — "Tab" viết hoa là ngoại lệ A6 cho tên phím. */
  readonly hint: string;
}

/** 2. Đang tải — đang tính lại hình học. Không có gì khác để mang. */
export interface WallGeometryEditorLoadingState {
  readonly kind: 'loading';
  readonly message: string;
}

/** Khe hở của một vòng hở, và nút đóng nó. */
export interface WallGeometryGap {
  /** Kích thước khe hở ĐÃ định dạng, chữ đều (A15) — "12,00 mm". */
  readonly sizeLabel: string;
  readonly closeLabel: string;
  readonly onCloseGap: () => void;
}

/**
 * 3. Một phần — HAI tình huống, và một trạng thái mang được cả hai cùng lúc:
 * chọn nhiều tường (chỉ cho đổi chiều cao), và/hoặc tường có vòng hở.
 *
 * Hai trường độc lập chứ không phải một union hai nhánh: ba bức tường đang chọn
 * mà một trong ba có vòng hở là một tình huống thật, và một union sẽ bắt hook
 * chọn kể một nửa.
 */
export interface WallGeometryEditorPartialState extends WallGeometryEditorContent {
  readonly kind: 'partial';
  /** Chỉ đổi được chiều cao — năm nút kia đã bị gỡ khỏi `toolbar.buttons`. */
  readonly isHeightOnly: boolean;
  /** Vòng hở; `null` khi mọi vòng đều khép. */
  readonly gap: WallGeometryGap | null;
  /** Một câu nói vì sao màn đang bị giới hạn. */
  readonly notice: string;
}

/**
 * 4. Lỗi — hình mới bị từ chối (đa giác tự cắt).
 *
 * Giá trị đã TỰ TRẢ VỀ số cũ trước khi tới view: `vertexTable` và `handles` ở
 * đây mô tả hình HỢP LỆ, không phải hình bị từ chối. `edgeHighlights` mang các
 * cạnh gây lỗi để tô sáng; `offendingEdgeIds` lặp lại mã của chúng để view cuộn
 * / focus mà không phải dò cả cây.
 */
export interface WallGeometryEditorErrorState extends WallGeometryEditorContent {
  readonly kind: 'error';
  /** Vì sao bị từ chối. Không bao giờ rỗng — không có từ chối im lặng. */
  readonly explanation: string;
  readonly offendingEdgeIds: readonly string[];
  readonly onDismissError: () => void;
}

/** 5. Xong — một bức tường, sửa được, không có gì bị chặn. */
export interface WallGeometryEditorSuccessState extends WallGeometryEditorContent {
  readonly kind: 'success';
}

/**
 * 6. Không có quyền — công cụ sửa KHÔNG BẬT ĐƯỢC, bị gỡ khỏi thanh
 * (`toolbar.buttons` rỗng), mọi hàng đỉnh `isLocked`, mọi tay nắm
 * `isEnabled: false`.
 *
 * Hai đường vào đây, và `notice` nói ra đường nào: vai chỉ xem, hoặc camera
 * đang ở chế độ trực giao lát cắt (điều cấm tuyệt đối #3). Hai câu khác nhau,
 * vì người dùng làm được hai việc khác nhau để thoát ra.
 */
export interface WallGeometryEditorForbiddenState extends WallGeometryEditorContent {
  readonly kind: 'forbidden';
  readonly notice: string;
}

/**
 * 7. Thu gọn — khoá sửa trên di động, chỉ xem.
 *
 * KHÔNG mở rộng `WallGeometryEditorContent` (lệch có chủ đích #3, mục 0): mang
 * theo sáu nút, tay nắm kéo được và bảng đỉnh sửa được là mang theo đúng thứ
 * trạng thái này tồn tại để chặn.
 */
export interface WallGeometryEditorCollapsedState {
  readonly kind: 'collapsed';
  /** Nhãn tóm tắt, ví dụ "Tường W-014". */
  readonly summaryLabel: string;
  readonly notice: string;
  readonly onExit: () => void;
}

/** Bảy trạng thái, đúng một trong bảy interface trên. */
export type WallGeometryEditorState =
  | WallGeometryEditorEmptyState
  | WallGeometryEditorLoadingState
  | WallGeometryEditorPartialState
  | WallGeometryEditorErrorState
  | WallGeometryEditorSuccessState
  | WallGeometryEditorForbiddenState
  | WallGeometryEditorCollapsedState;

/**
 * Suy ra từ chính bảy interface trên, không gõ lại bảy chuỗi — không có cách nào
 * để bảng này trôi khỏi `WallGeometryEditorState`. PHẢI khớp đúng bảy chuỗi của
 * `SEVEN_STATES` (`src/lib/testing/sevenStateScenarios.ts:26-34`).
 */
export type WallGeometryEditorStateKind = WallGeometryEditorState['kind'];
