/**
 * Hợp đồng kiểu của VỎ CHUNG chín màn 3D — mọi thứ view cần biết, viết ra một
 * lần ở đây.
 *
 * File `.ts` thuần: không JSX, không React ở thân hàm, không `src/api` /
 * `src/store` / `src/lib/http`. Cùng khuôn `thicknessTypes.ts` của S-18 và
 * `objectLayerTypes.ts` của lớp đối tượng.
 *
 * ## Vì sao vỏ giữ CAMERA nhưng không giữ TRÌNH VẼ
 *
 * Chín màn 3D dùng chung một bộ quy ước camera: quán tính, giảm chấn, nháy đúp
 * khuôn đối tượng, ViewCube, cụm thu phóng, bản đồ nhỏ — sáu điều khiển ấy đều
 * lái đúng MỘT điểm nhìn. Mỗi màn tự giữ camera nghĩa là nối lại sáu thứ đó
 * chín lần, và chúng sẽ lệch nhau ở lần thứ ba. Nên vỏ giữ `CameraDirector`
 * (`@/lib/three/camera/presets`) — một đối tượng THUẦN: không renderer, không
 * canvas, không DOM. Nó chỉ trả lời "điểm nhìn bây giờ là đây".
 *
 * Trình vẽ thì ngược lại: mỗi màn dựng một thứ khác nhau (lớp tường, lớp đối
 * tượng, mô hình đã ráp…), nên cảnh 3D là một KHE CẮM
 * ({@link ViewerShellProps.renderScene}) nhận điểm nhìn rồi tự vẽ. Vỏ vẫn vẽ
 * nền khung nhìn, mặt đất và đường chân trời của riêng nó, nên khe cắm để
 * trống vẫn ra một khung nhìn đúng chuẩn chứ không ra màn trắng (A11).
 *
 * ## Mọi con số hiển thị đã là CHUỖI ở đây
 *
 * A15: định dạng xảy ra ở viewmodel, không ở view. Nên `ViewerStatusViewModel`
 * mang `summary: string` chứ không mang bốn số rời để `.tsx` tự ghép, và
 * `ViewerStoreyViewModel.elevationLabel` đã là "+3,20 m" chứ không phải 3200.
 */

import type { ReactNode } from 'react';

import type { CameraPresetId } from '@/lib/three/camera/presets';

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái màn hình (A11).                                              */
/* -------------------------------------------------------------------------- */

/**
 * Bảy trạng thái, cùng bảng chữ với `SEVEN_STATES` của `src/lib/testing`.
 *
 * Khai lại ở đây thay vì nhập từ `lib/testing` vì đó là hạ tầng bài kiểm: một
 * kiểu của mã chạy thật không được phụ thuộc vào nó. Bài kiểm đối chiếu hai
 * bảng bằng một phép khẳng định, nên chúng không trôi khỏi nhau.
 */
export type ViewerScreenState =
  | 'empty'
  | 'loading'
  | 'partial'
  | 'error'
  | 'success'
  | 'forbidden'
  | 'collapsed';

/* -------------------------------------------------------------------------- */
/* Kích thước bố cục — spec VIEWER-SHELL.                                      */
/* -------------------------------------------------------------------------- */

/**
 * Số đo của vỏ, bằng pixel giao diện.
 *
 * Đây là bố cục, không phải hằng số nghiệp vụ: R-71 cấm chép lại mã lỗi, thời
 * gian chờ, ngưỡng số và thời lượng chuyển động — bề rộng một cột không nằm
 * trong danh sách đó và không có nguồn nào khác trong repo để đọc ra. Gom vào
 * một chỗ để chín màn dùng chung đúng một bộ số.
 */
export const VIEWER_LAYOUT = Object.freeze({
  /** Ray công cụ trái. */
  toolRailPx: 56,
  /** Ray tầng, ngay cạnh ray công cụ. */
  storeyRailPx: 56,
  /** Panel thanh tra bên phải. */
  inspectorPx: 344,
  /** Bo góc khung nhìn 3D. */
  viewportRadiusPx: 16,
  /** Thụt của khung nhìn so với khung ngoài. */
  viewportInsetPx: 12,
  /** Cạnh của ViewCube góc trên phải. */
  cubePx: 72,
  /** Chiều cao thanh trạng thái. */
  statusBarPx: 32,
});

/* -------------------------------------------------------------------------- */
/* Công cụ trên ray.                                                           */
/* -------------------------------------------------------------------------- */

/** Sáu công cụ của ray trái. */
export type ViewerToolId = 'orbit' | 'pan' | 'measure' | 'section' | 'select' | 'isolate';

/** Một ô trên ray công cụ, đã đủ chữ để vẽ. */
export interface ViewerToolViewModel {
  readonly id: ViewerToolId;
  /** Nhãn tiếng Việt, viết thường kiểu câu (A6). */
  readonly label: string;
  /** Phím tắt in trên gợi ý, ví dụ `M`. Chữ hoa là ngoại lệ A6 cho tên phím. */
  readonly keyLabel: string;
}

/* -------------------------------------------------------------------------- */
/* Góc nhìn sẵn.                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Bốn góc nhìn của `Select` trên thanh trên.
 *
 * `perspective` và `top` ánh xạ thẳng sang `CAMERA_PRESETS`; `axonometric`
 * dựng từ `DEFAULT_CAMERA_RIG` của `present/director` (giàn trục đo đã tinh
 * chỉnh — 50° trên đường chân trời, trực giao); `section` là góc `axonometric`
 * cộng một mặt phẳng cắt, xem `viewerSectionPlane.ts`.
 */
export type ViewerPresetId = 'perspective' | 'axonometric' | 'top' | 'section';

/** Góc nhìn của vỏ lấy điểm nhìn từ đâu. */
export type ViewerPresetSource =
  | { readonly kind: 'library'; readonly id: CameraPresetId }
  | { readonly kind: 'rig' }
  | { readonly kind: 'rigWithSection' };

/** Một mục trong `Select` góc nhìn. */
export interface ViewerPresetViewModel {
  readonly id: ViewerPresetId;
  readonly label: string;
}

/* -------------------------------------------------------------------------- */
/* Tầng.                                                                       */
/* -------------------------------------------------------------------------- */

/** Một tầng trên ray tầng và trên thang cao độ. */
export interface ViewerStoreyViewModel {
  /** Mã tầng của đồ thị không gian, ví dụ `L-01`. */
  readonly id: string;
  /** Tên người đọc, ví dụ "Tầng 01". */
  readonly name: string;
  /** Mã ngắn cho thang cao độ dọc mép trái. Chữ hoa là ngoại lệ A6. */
  readonly code: string;
  /** Cao độ ĐÃ ĐỊNH DẠNG, ví dụ "+3,20 m" (A15). */
  readonly elevationLabel: string;
  /** Người dùng đang chọn tầng này (bấm, hoặc giữ Shift chọn nhiều). */
  readonly isActive: boolean;
  /** Con mắt đang mở. */
  readonly isVisible: boolean;
  /** Đã dựng xong hình; `false` ở trạng thái một phần. */
  readonly isReady: boolean;
}

/* -------------------------------------------------------------------------- */
/* Thanh tra đối tượng.                                                        */
/* -------------------------------------------------------------------------- */

/** Một dòng thuộc tính trong panel phải. Giá trị đã định dạng (A15). */
export interface ViewerPropertyRow {
  readonly id: string;
  readonly label: string;
  readonly value: string;
}

/** Đối tượng đang chọn, hoặc `null` khi chưa chọn gì. */
export interface ViewerSelectionViewModel {
  readonly entityId: string;
  /** Ví dụ "tường", "phòng", "cửa" — viết thường kiểu câu (A6). */
  readonly kindLabel: string;
  /** Tiêu đề panel, ví dụ "Tường W-014". */
  readonly title: string;
  readonly rows: readonly ViewerPropertyRow[];
}

/* -------------------------------------------------------------------------- */
/* Chú giải, thanh trạng thái, chip hiệu năng.                                 */
/* -------------------------------------------------------------------------- */

/** Một ô chú giải góc trái dưới. `colorToken` LUÔN là tên biến CSS (A1). */
export interface ViewerLegendItem {
  readonly id: string;
  readonly label: string;
  /** Ví dụ `--wall-220`. Không bao giờ là mã màu thô. */
  readonly colorToken: string;
}

/** Thanh trạng thái 32 px. Một chuỗi đã ghép sẵn, không phải bốn số rời (A15). */
export interface ViewerStatusViewModel {
  /** Ví dụ "4 tầng · 14 phòng · 248,60 m² · 58 fps". */
  readonly summary: string;
  /** Câu cho trình đọc màn hình khi mô hình đang dựng. */
  readonly liveMessage: string;
}

/** Chip hiệu năng — chỉ hiện khi cờ nhà phát triển bật. */
export interface ViewerPerfViewModel {
  /** Ví dụ "51.700 tam giác". */
  readonly trianglesLabel: string;
}

/* -------------------------------------------------------------------------- */
/* Mặt phẳng cắt.                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Một mặt phẳng cắt, dạng số thuần.
 *
 * Cố ý KHÔNG phải `Plane` của three.js: kiểu này đi qua props của một view, và
 * một view không nên buộc phải nhập three.js để đọc kiểu của chính nó.
 * `viewerSectionPlane.ts` dựng ra nó; màn nội dung đổi sang `Plane` khi cần.
 */
export interface ViewerSectionPlaneValue {
  readonly normalX: number;
  readonly normalY: number;
  readonly normalZ: number;
  /** Theo quy ước `Plane` của three.js: `normal · p + constant = 0`. */
  readonly constant: number;
}

/* -------------------------------------------------------------------------- */
/* Điểm nhìn mà khe cắm cảnh nhận được.                                        */
/* -------------------------------------------------------------------------- */

/**
 * Những gì vỏ đưa cho màn nội dung mỗi lần vẽ lại.
 *
 * Đây là ranh giới giữa vỏ và chín màn: vỏ nói camera đang ở đâu, tầng nào
 * bật, tách bao nhiêu, cắt ở đâu; màn nội dung dựng hình theo đó. Không chiều
 * nào chạm store của chiều kia.
 */
export interface ViewerSceneFrame {
  /** Kinh độ camera quanh trục đứng, radian. */
  readonly azimuthRad: number;
  /** Góc chúc xuống tính từ +Y, radian. */
  readonly polarRad: number;
  /** Khoảng cách khuôn hình, mét. */
  readonly distanceM: number;
  /** Camera có đang ở phép chiếu trực giao không. */
  readonly isOrthographic: boolean;
  /** Mã những tầng đang hiện. */
  readonly visibleStoreyIds: readonly string[];
  /** Độ tách tầng; 0 là xếp đúng cao độ thật. */
  readonly separation: number;
  /** Mặt phẳng cắt đang bật, hoặc `null`. */
  readonly sectionPlane: ViewerSectionPlaneValue | null;
  /** Mã đối tượng đang chọn. */
  readonly selectedEntityIds: readonly string[];
  /** Mã đối tượng con trỏ đang trỏ vào. */
  readonly hoveredEntityId: string | null;
  /** Chỉ những đối tượng này được vẽ; `null` là không cô lập gì. */
  readonly isolatedEntityIds: readonly string[] | null;
  /** Đối tượng người dùng đã ẩn bằng `Shift+H`. */
  readonly hiddenEntityIds: readonly string[];
  /** Người dùng đã xin giảm chuyển động. */
  readonly reducedMotion: boolean;
}

/**
 * Hai việc màn nội dung BÁO NGƯỢC lên vỏ.
 *
 * Chỉ cảnh 3D biết con trỏ đang chỉ vào tam giác của đối tượng nào — vỏ không
 * giữ lưới nào để tự dò. Nên chiều "3D → panel" của S-11 đi qua đây: cảnh gọi
 * {@link ViewerSceneActions.selectEntity}, vỏ ghi vào kho chọn dùng chung, và
 * panel phải cuộn hàng tương ứng vào tầm nhìn. Chiều ngược lại đi qua chính
 * kho ấy, nên hai chiều không phải là hai đường dây riêng.
 */
export interface ViewerSceneActions {
  /** `null` là bỏ chọn. `additive` khi người dùng giữ Shift. */
  selectEntity(entityId: string | null, additive: boolean): void;
  /** `null` là con trỏ vừa rời khỏi mọi đối tượng. */
  hoverEntity(entityId: string | null): void;
}

/* -------------------------------------------------------------------------- */
/* Props của view.                                                             */
/* -------------------------------------------------------------------------- */

/** Một mắt xích breadcrumb. Cùng hình dạng `BreadcrumbItem` của `@/hooks/useBreadcrumb`. */
export interface ViewerBreadcrumbItem {
  readonly id: string;
  readonly label: string;
  readonly onClick?: (() => void) | undefined;
}

/** Toạ độ pixel trong khung nhìn. */
export interface ViewerPointPx {
  readonly x: number;
  readonly y: number;
}

/**
 * Mọi thứ `ViewerShell.tsx` cần.
 *
 * Chỉ khe cắm cảnh và chip hiệu năng được vắng mặt — một view phải vẽ được ở cả
 * bảy trạng thái mà không phải đoán người gọi có truyền trường nào không.
 */
export interface ViewerShellProps {
  readonly state: ViewerScreenState;

  /* Thanh trên. */
  readonly breadcrumbs: readonly ViewerBreadcrumbItem[];
  readonly viewMode: '2d' | '3d';
  readonly onViewModeChange: (mode: '2d' | '3d') => void;
  readonly presets: readonly ViewerPresetViewModel[];
  readonly activePresetId: ViewerPresetId;
  readonly onPresetChange: (id: ViewerPresetId) => void;

  /* Ray công cụ. */
  readonly tools: readonly ViewerToolViewModel[];
  readonly activeToolId: ViewerToolId;
  readonly onToolChange: (id: ViewerToolId) => void;

  /* Ray tầng. */
  readonly storeys: readonly ViewerStoreyViewModel[];
  readonly onStoreyActivate: (id: string, additive: boolean) => void;
  readonly onStoreyVisibilityToggle: (id: string) => void;
  readonly separation: number;
  readonly onSeparationChange: (value: number) => void;
  readonly separationLabel: string;

  /* Khung nhìn. */
  readonly frame: ViewerSceneFrame;
  /** Cảnh 3D của màn nội dung. Vắng mặt thì vỏ vẽ khung nhìn trống đúng chuẩn. */
  readonly renderScene?:
    | ((frame: ViewerSceneFrame, actions: ViewerSceneActions) => ReactNode)
    | undefined;
  /** Hai việc cảnh báo ngược lên vỏ — xem {@link ViewerSceneActions}. */
  readonly sceneActions: ViewerSceneActions;
  readonly onViewportPointerMove: (point: ViewerPointPx, buttons: number) => void;
  readonly onViewportPointerDown: (point: ViewerPointPx) => void;
  readonly onViewportPointerUp: () => void;
  readonly onViewportWheel: (notches: number) => void;
  readonly onViewportDoubleClick: () => void;
  /** Nhãn nhỏ bám con trỏ khi trỏ vào một đối tượng; `null` khi không trỏ gì. */
  readonly hoverLabel: string | null;
  readonly hoverPointPx: ViewerPointPx | null;

  /* Lớp nổi quanh khung nhìn. */
  readonly onCubeFaceSelect: (preset: ViewerPresetId) => void;
  /** Mức thu phóng ĐÃ ĐỊNH DẠNG, ví dụ "100%" (A15). */
  readonly zoomLabel: string;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onZoomReset: () => void;
  readonly onFitAll: () => void;
  readonly legend: readonly ViewerLegendItem[];
  readonly perf: ViewerPerfViewModel | null;

  /* Panel phải. */
  readonly selection: ViewerSelectionViewModel | null;
  /** Câu dạy khi chưa chọn gì. */
  readonly inspectorHint: string;
  /** Mã đối tượng cần cuộn vào tầm nhìn — S-11, đồng bộ hai chiều. */
  readonly scrollToEntityId: string | null;

  /* Thanh trạng thái. */
  readonly status: ViewerStatusViewModel;

  /* Trạng thái lỗi. */
  readonly errorMessage: string | null;
  readonly onRetry: () => void;
}
