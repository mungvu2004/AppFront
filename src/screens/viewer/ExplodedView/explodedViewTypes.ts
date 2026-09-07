/**
 * Hợp đồng kiểu của màn `ExplodedView` — tách các tầng theo trục đứng.
 *
 * File `.ts` THUẦN: không JSX, không React ở thân hàm, không `src/api` /
 * `src/store` / `src/lib/http`. Cùng khuôn `viewerShellTypes.ts` của vỏ chung và
 * `viewer3dTypes.ts` của S-11.
 *
 * ## Màn này là MÀN NỘI DUNG của vỏ chung, không phải một màn 3D riêng
 *
 * `src/screens/viewer/ViewerShell` là vỏ chung của chín màn 3D và nó ĐÃ sở hữu:
 * thanh trượt "Độ tách" (`ViewerStoreyRail`), trạng thái `separation`, phím `E`,
 * ray tầng với con mắt ẩn/hiện, camera, bảy trạng thái, và phép tách tầng
 * (`stackStoreys`). Màn này KHÔNG dựng lại một thứ nào trong đó — R-61 và R-64.
 *
 * Khuôn lắp ráp chép nguyên từ S-11 (`Viewer3D.container.tsx`):
 *
 * ```text
 * ExplodedViewContainer
 *   └─ ScreenErrorBoundary            (bản @/components/feedback — R-62)
 *       └─ <ViewerShell {...shell} /> (shell props do useExplodedView dựng)
 *             └─ renderScene(frame, actions) → <ExplodedView ... />
 * ```
 *
 * ## Vì sao hàng ba mức sẵn KHÔNG nằm trong `ViewerSceneActions`
 *
 * `ViewerSceneActions` — đối số thứ hai của `renderScene` — chỉ có `selectEntity`,
 * `hoverEntity`, `setSectionPosition?`. **Không có setter cho độ tách.** Cái đặt
 * được độ tách là `ViewerShellProps.onSeparationChange`, và nó chỉ có trong tay
 * người GỌI `useViewerShell`. Nên `useExplodedView` gọi `useViewerShell` rồi
 * đóng gói `onSeparationChange` vào {@link ExplodedViewActions}, và chính hook
 * dựng closure `renderScene` để view trong khung nhìn bấm được ba mức sẵn.
 *
 * ## Ba mức sẵn là 0 · 0,5 · 1
 *
 * `MIN_SEPARATION = 0` và `MAX_SEPARATION = 1` là hai đầu thanh trượt của
 * `viewerStoreyStack.ts`, và "tách vừa" là ĐIỂM GIỮA hai đầu ấy — không phải một
 * con số mới (R-71). Nó rơi đúng vào `SEPARATION_STEP = 0.5`, mức phím `E` của vỏ
 * nhảy tới, nên hai đường vào cùng một cảnh; hằng ấy không nhập thẳng vì nó nằm
 * trong `useViewerShell.ts` và kéo cả React vào một file kiểu thuần.
 *
 * Hai hằng kia nhập thẳng từ `viewerStoreyStack` chứ không qua `index.ts` của vỏ:
 * cửa nhập chung không xuất chúng, và một file kiểu thuần không nên kéo cả barrel
 * (có React) vào chỉ để lấy hai con số.
 *
 * ## Chỉ báo thẳng hàng chạy trên TRỤC, không chạy trên lõi thang
 *
 * Đặc tả nói "phần tử phải liên tục qua các tầng như lõi thang hay hộp kỹ thuật".
 * Đã khảo sát: **không có** cơ chế nào trong `src/domain` liên kết một phần tử cụ
 * thể xuyên tầng — `Room`/`Wall`/`Furniture` đều mang `levelId` riêng và không có
 * trường nối chéo tầng. Thứ DUY NHẤT so được giữa hai tầng là TRỤC:
 * `alignFloors()` của `src/domain/axes/alignFloors.ts` khớp `DetectedAxis` với
 * `DetectedAxis` và trả `FloorIssue` khi phần dư vượt `ALIGNMENT_WARNING_THRESHOLD_MM`
 * (150 mm). Lõi thang và hộp kỹ thuật đứng TRÊN trục, nên chỉ báo dựng trên trục
 * là thứ gần nhất với đặc tả mà dữ liệu hôm nay đỡ được — và caption nói rõ nó
 * đang nói về trục nào, chứ không giả vờ biết đó là lõi thang.
 *
 * **Một lệch ĐỀU tuyệt đối không sinh cảnh báo, và đó là đúng.** `alignFloors`
 * được phép tịnh tiến tự do, nên một tầng bị dời cả khối 180 mm sẽ được kéo về
 * đúng chỗ và phần dư bằng 0. Cái nó bắt là lệch TƯƠNG ĐỐI: một trục xê dịch so
 * với các trục còn lại của chính tầng đó. Bài kiểm 180 mm phải dựng đúng kiểu
 * lệch ấy, nếu không nó khẳng định một điều không có thật.
 *
 * ## Cao độ và diện tích trên thẻ nhãn
 *
 * - Cao độ: `formatLength(millimetres(elevationMm), { unit: 'm' })` — đúng hàm
 *   `useViewerShell.ts:528` dùng cho `elevationLabel`. Nó KHÔNG thêm dấu `+`
 *   (docblock của vỏ nói có, mã thì không); màn này dùng đúng chuỗi vỏ đưa ra và
 *   không tự chế một định dạng thứ hai.
 * - Diện tích từng tầng: `ViewerShellData.totalAreaM2` là tổng CẢ TOÀ NHÀ, và
 *   `ViewerStorey` không mang diện tích. Nên `ExplodedViewGateway.readFloorAreas`
 *   gom `Room.outline` theo `levelId` rồi gọi `totalArea()` của
 *   `src/domain/rooms/area.ts` — gọi lại hàm đã có, không tự tính đa giác (R-61).
 *
 * ## Chuyển động: ba con số của đặc tả không có trên thang, nên không dùng
 *
 * Thang chuyển động có đúng năm giá trị (`MOTION_DURATIONS_MS` = 120/180/260/340
 * và `AMBIENT_LOOP_MS` = 700). Đặc tả xin 60 ms so le, 240 ms hoà tan và 1,2 s cho
 * một lượt tách-rồi-hợp; cả ba đều không có nguồn, và R-71 cấm viết tay. Thay thế:
 * so le lấy từ `staggerDelaysMs()` (bước 24 ms, trần 200 ms), hoà tan dùng
 * `standard` (260 ms), một lượt tách-rồi-hợp là hai chặng `AMBIENT_LOOP_MS`.
 *
 * ## Không một `requestAnimationFrame` nào trong thư mục màn
 *
 * Vòng vẽ là của `createFrameLoop` (`src/lib/three/present/frameLoop.ts`); tiến độ
 * hoạt cảnh là của `createSceneOrchestrator` + `frameAt`
 * (`src/lib/motion/orchestrate.ts`). Module cảnh của màn chỉ đọc `frameAt(...)` rồi
 * đặt `position.y`.
 */

import type { Millimetres } from '@/domain/units/types';
import { AMBIENT_LOOP_MS, MOTION_DURATIONS_MS } from '@/lib/motion/tokens';
import type { StackableStorey } from '@/screens/viewer/ViewerShell';
import {
  MAX_SEPARATION,
  MIN_SEPARATION,
} from '@/screens/viewer/ViewerShell/viewerStoreyStack';
import type {
  ViewerSceneFrame,
  ViewerScreenState,
  ViewerShellProps,
} from '@/screens/viewer/ViewerShell/viewerShellTypes';

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái — cùng bảng chữ với vỏ.                                      */
/* -------------------------------------------------------------------------- */

/** Bảy trạng thái của A11; mượn thẳng bảng của vỏ để hai bên không trôi khỏi nhau. */
export type ExplodedViewState = ViewerScreenState;

/* -------------------------------------------------------------------------- */
/* Ba mức sẵn.                                                                 */
/* -------------------------------------------------------------------------- */

/** Mã một mức tách sẵn. */
export type ExplodePresetId = 'merged' | 'medium' | 'full';

/** Một ô trên hàng ba mức sẵn, đã đủ chữ để vẽ. */
export interface ExplodePresetViewModel {
  readonly id: ExplodePresetId;
  /** Nhãn tiếng Việt, viết thường kiểu câu (A6). */
  readonly label: string;
  /** Độ tách mức này nhảy tới, không thứ nguyên trong đoạn [0, 1]. */
  readonly separation: number;
}

/**
 * Ba mức, dựng từ hai đầu thanh trượt của `viewerStoreyStack.ts`.
 *
 * Không có mức thứ tư, và "tách vừa" không phải một con số mới: nó là điểm giữa
 * `MIN_SEPARATION` và `MAX_SEPARATION`, rơi đúng vào mức phím `E` của vỏ nhảy tới.
 */
export const EXPLODE_PRESETS: readonly ExplodePresetViewModel[] = Object.freeze([
  Object.freeze({ id: 'merged' as const, label: 'gộp', separation: MIN_SEPARATION }),
  Object.freeze({
    id: 'medium' as const,
    label: 'tách vừa',
    separation: (MIN_SEPARATION + MAX_SEPARATION) / 2,
  }),
  Object.freeze({ id: 'full' as const, label: 'tách hết', separation: MAX_SEPARATION }),
]);

/* -------------------------------------------------------------------------- */
/* Số đo của lớp nổi — bố cục, không phải hằng số nghiệp vụ.                    */
/* -------------------------------------------------------------------------- */

/**
 * Số đo bằng pixel giao diện, cùng lý lẽ `VIEWER_LAYOUT` của vỏ: R-71 cấm chép
 * lại mã lỗi, thời gian chờ, ngưỡng số nghiệp vụ và thời lượng chuyển động — bề
 * rộng một thẻ không nằm trong danh sách đó và không có nguồn nào khác trong repo.
 */
export const EXPLODED_LAYOUT = Object.freeze({
  /** Bề rộng thẻ nhãn tầng. */
  cardWidthPx: 200,
  /** Bo góc thẻ nhãn tầng. */
  cardRadiusPx: 12,
  /** Chiều cao vệt thang cao độ dọc mép trái khung nhìn. */
  railHeightPx: 240,
  /** Bề rộng vạch đánh dấu trên đường nối dọc. */
  tickWidthPx: 12,
});

/**
 * Độ tách phải vượt ngưỡng này thì thẻ nhãn tầng mới hiện.
 *
 * Không thứ nguyên, cùng thang với `separation` (0…1). Đây là một ngưỡng TRÌNH
 * BÀY — nó quyết định lúc nào cảnh đủ thưa để chữ không đè lên hình — chứ không
 * phải một ngưỡng nghiệp vụ như dung sai căn tầng, nên nó sống ở đây chứ không ở
 * `src/domain`.
 */
export const LABEL_REVEAL_SEPARATION = 0.2;

/** Các tầng khác mờ xuống mức này khi con trỏ đậu trên một thẻ tầng. */
export const DIMMED_FLOOR_OPACITY = 0.25;

/* -------------------------------------------------------------------------- */
/* Thời lượng — mọi giá trị đều mượn, không có số nào mới.                      */
/* -------------------------------------------------------------------------- */

/**
 * Bốn thời lượng màn này dùng, gọi tên để nơi dùng không phải nhớ vì sao.
 *
 * `revealMs` là `standard` (260 ms) chứ không phải 240 ms như đặc tả xin — 240
 * không có trên thang. `cycleHalfMs` là `AMBIENT_LOOP_MS`, và một lượt
 * tách-rồi-hợp của phím `Space` là hai chặng ấy nối nhau.
 */
export const EXPLODED_MOTION_MS = Object.freeze({
  /** Thẻ nhãn tầng hoà tan vào/ra. */
  revealMs: MOTION_DURATIONS_MS.standard,
  /** Các tầng khác mờ xuống khi trỏ vào một thẻ. */
  dimMs: MOTION_DURATIONS_MS.fast,
  /** Giảm chuyển động: chỉ còn một lần hoà tan ngắn, không chạy vị trí. */
  reducedMs: MOTION_DURATIONS_MS.instant,
  /** Một chặng của lượt tách (và của lượt hợp) khi bấm một mức sẵn. */
  cycleHalfMs: AMBIENT_LOOP_MS,
});

/* -------------------------------------------------------------------------- */
/* Thẻ nhãn tầng.                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Một thẻ nhãn nổi ở mép phải khung nhìn.
 *
 * Mọi số hiển thị ĐÃ LÀ CHUỖI (A15): view không định dạng gì.
 */
export interface ExplodedFloorViewModel {
  /** Mã tầng của đồ thị không gian, ví dụ `L-01`. */
  readonly id: string;
  /** Tên người đọc, ví dụ "Tầng 01". */
  readonly name: string;
  /** Cao độ ĐÃ ĐỊNH DẠNG, ví dụ "3,20 m". Vỏ dựng chuỗi này. */
  readonly elevationLabel: string;
  /** Diện tích ĐÃ ĐỊNH DẠNG, ví dụ "62,40 m²"; "—" khi tầng chưa có phòng nào. */
  readonly areaLabel: string;
  /** Con mắt đang mở. */
  readonly isVisible: boolean;
  /** Đã dựng xong hình; `false` thì tầng vẽ khung dây (trạng thái một phần). */
  readonly isReady: boolean;
  /** Tầng này chưa được người duyệt xác nhận. */
  readonly needsReview: boolean;
  /** Caption cần chú ý trên thẻ, hoặc `null`. Câu tiếng Việt dựng sẵn. */
  readonly attentionCaption: string | null;
  /** Vị trí thẻ theo trục đứng của khung nhìn, tỉ lệ [0, 1] từ dưới lên. */
  readonly railFraction: number;
}

/* -------------------------------------------------------------------------- */
/* Chỉ báo thẳng hàng.                                                         */
/* -------------------------------------------------------------------------- */

/** Đường dẫn dọc vẽ ở màu nào — đúng ba trạng thái của A4, không có màu thứ tư. */
export type AlignmentTone = 'aligned' | 'attention';

/**
 * Một đường dẫn dọc chạy qua các tầng.
 *
 * `tone === 'attention'` thì view đổi sang `--state-attention` và hiện
 * {@link caption}; `'aligned'` thì nét đứt `--accent` và không có caption.
 * View KHÔNG tự quyết màu từ con số — hook quyết, view chỉ đọc `tone` (A1, A15).
 */
export interface ExplodedAlignmentPath {
  /** Mã trục, ví dụ `A-03`. */
  readonly id: string;
  /** Vị trí ngang trong khung nhìn, tỉ lệ [0, 1] từ trái sang. */
  readonly xFraction: number;
  readonly tone: AlignmentTone;
  /**
   * Câu ghi độ lệch, ví dụ "Tầng 02 còn lệch 180 mm so với tầng chuẩn Tầng 01".
   * `null` khi trục thẳng hàng. Câu này đến từ `FloorIssue.message` của
   * `alignFloors`, KHÔNG dựng lại ở màn.
   */
  readonly caption: string | null;
  /** Độ lệch thô, để bài kiểm khẳng định con số chứ không khẳng định câu chữ. */
  readonly residualMm: Millimetres;
}

/* -------------------------------------------------------------------------- */
/* Đường nối dọc.                                                              */
/* -------------------------------------------------------------------------- */

/** Một vạch đánh dấu trên đường nối dọc, tại cao độ của một tầng. */
export interface ExplodedElevationTick {
  readonly storeyId: string;
  /** Vị trí theo trục đứng của khung nhìn, tỉ lệ [0, 1] từ dưới lên. */
  readonly fraction: number;
  /** Cao độ ĐÃ ĐỊNH DẠNG. */
  readonly label: string;
}

/* -------------------------------------------------------------------------- */
/* Mô hình của màn.                                                            */
/* -------------------------------------------------------------------------- */

/** Mọi thứ view trong khung nhìn cần để vẽ. */
export interface ExplodedViewModel {
  readonly state: ExplodedViewState;
  /** Độ tách hiện tại, đọc từ `ViewerSceneFrame.separation`. */
  readonly separation: number;
  /** Mức sẵn đang khớp, hoặc `null` khi người dùng đang kéo tự do. */
  readonly activePresetId: ExplodePresetId | null;
  readonly presets: readonly ExplodePresetViewModel[];
  /** Nhãn hai đầu thang, ví dụ "0 m" và "12,80 m". Đã định dạng (A15). */
  readonly minLabel: string;
  readonly maxLabel: string;
  /** Thẻ nhãn có được hiện không — `separation > LABEL_REVEAL_SEPARATION`. */
  readonly areLabelsVisible: boolean;
  readonly floors: readonly ExplodedFloorViewModel[];
  readonly ticks: readonly ExplodedElevationTick[];
  readonly alignmentPaths: readonly ExplodedAlignmentPath[];
  /** Mã tầng con trỏ đang đậu trên thẻ; các tầng khác mờ xuống. */
  readonly hoveredStoreyId: string | null;
  /** Người dùng đã xin giảm chuyển động — nhảy thẳng, không chạy vị trí. */
  readonly reducedMotion: boolean;
  /** Điều khiển gom vào cụm trôi ngang (trạng thái thu gọn). */
  readonly isCollapsed: boolean;
  /** Câu cho trình đọc màn hình khi độ tách đổi. */
  readonly liveMessage: string;
  /** Đang chụp ảnh — nút khoá lại để không xếp hàng hai lượt. */
  readonly isCapturing: boolean;
  /** Câu lỗi của lượt chụp gần nhất, hoặc `null`. */
  readonly captureError: string | null;
}

/** Những việc view báo ngược lên hook. */
export interface ExplodedViewActions {
  /** Bấm một mức sẵn. Hook gọi `ViewerShellProps.onSeparationChange`. */
  readonly onPresetSelect: (id: ExplodePresetId) => void;
  /** Kéo thanh trượt — liên tục, không trễ, thả ra KHÔNG bắt về mức sẵn. */
  readonly onSeparationChange: (value: number) => void;
  /** Con trỏ vào/ra một thẻ tầng; `null` là vừa rời. */
  readonly onFloorHover: (storeyId: string | null) => void;
  /** Bấm một thẻ tầng: kích hoạt tầng đó, panel trái đổi theo. */
  readonly onFloorActivate: (storeyId: string) => void;
  /** Con mắt trên thẻ. */
  readonly onFloorVisibilityToggle: (storeyId: string) => void;
  /** Chụp một khung nhìn — gọi `captureViewport`, không tự dựng ảnh. */
  readonly onCapture: () => void;
}

/** Props của view trong khung nhìn. Test được CHỈ từ props (R-60). */
export interface ExplodedViewProps extends ExplodedViewModel {
  readonly actions: ExplodedViewActions;
  /** Canvas của cảnh 3D; hook lắp `mountExplodedScene` lên nó. */
  readonly canvasRef: (canvas: HTMLCanvasElement | null) => void;
}

/* -------------------------------------------------------------------------- */
/* Cổng dữ liệu.                                                               */
/* -------------------------------------------------------------------------- */

/** Đầu vào của một phép dò thẳng hàng: một tầng, kèm trục đã dò. */
export interface ExplodedFloorProbe extends StackableStorey {
  readonly name: string;
  /** Tầng đã được người duyệt xác nhận chưa. */
  readonly reviewed: boolean;
}

/**
 * Cổng dữ liệu riêng của màn.
 *
 * Vỏ đã đưa tầng, cao độ và chiều cao qua `ViewerShellData`; cổng này chỉ bù hai
 * thứ vỏ không có: diện tích TỪNG tầng và báo cáo thẳng hàng. Cả hai đều gọi lại
 * hàm đã có của `src/domain`, không tự tính.
 */
export interface ExplodedViewGateway {
  /** Diện tích từng tầng, m². Gom `Room.outline` theo tầng rồi gọi `totalArea()`. */
  readonly readFloorAreas: () => ReadonlyMap<string, number>;
  /**
   * Báo cáo thẳng hàng của cả chồng tầng.
   *
   * Dựng `FloorPlan[]` bằng `detectAxes(walls của từng tầng)` rồi gọi
   * `alignFloors()`. Trả `null` khi có ít hơn hai tầng — không có gì để so.
   */
  readonly readAlignment: () => AlignmentReportLike | null;
}

/**
 * Hình dạng tối thiểu của báo cáo thẳng hàng mà màn đọc.
 *
 * Cố ý hẹp hơn `FloorAlignmentReport`: màn chỉ cần biết trục nào lệch bao nhiêu
 * và câu tiếng Việt đi kèm, nên bài kiểm dựng được bằng ba trường thay vì bằng cả
 * một đồ thị không gian.
 */
export interface AlignmentReportLike {
  readonly baseLevelId: string | null;
  readonly issues: readonly {
    readonly levelId: string;
    readonly severity: 'attention' | 'violation';
    readonly amountMm: number;
    readonly message: string;
  }[];
}

/* -------------------------------------------------------------------------- */
/* Tuỳ chọn của hook.                                                          */
/* -------------------------------------------------------------------------- */

/** Cùng khuôn `UseViewerShellOptions`; mọi chỗ tiêm là để story và bài kiểm dựng được. */
export interface UseExplodedViewOptions {
  readonly projectId: string;
  /** Cổng riêng của màn. Vắng mặt thì hook dựng cổng thật từ đồ thị của vỏ. */
  readonly gateway?: ExplodedViewGateway;
  /** Ép một trong bảy trạng thái, cho story và bài kiểm A11. */
  readonly forceState?: ExplodedViewState;
  /** Khung của vỏ. Hook nhận nó qua closure `renderScene`. */
  readonly frame: ViewerSceneFrame;
  /** Đặt độ tách — chính là `ViewerShellProps.onSeparationChange`. */
  readonly onSeparationChange: ViewerShellProps['onSeparationChange'];
  /** Kích hoạt một tầng — chính là `ViewerShellProps.onStoreyActivate`. */
  readonly onStoreyActivate: ViewerShellProps['onStoreyActivate'];
  /** Bật/tắt con mắt — chính là `ViewerShellProps.onStoreyVisibilityToggle`. */
  readonly onStoreyVisibilityToggle: ViewerShellProps['onStoreyVisibilityToggle'];
  /** Danh sách tầng của vỏ, đã sắp từ dưới lên. */
  readonly storeys: ViewerShellProps['storeys'];
}
