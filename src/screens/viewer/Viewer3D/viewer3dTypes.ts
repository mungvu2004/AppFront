/**
 * Kiểu dùng chung giữa hook `useViewer3D` và module cảnh `viewer3dScene`.
 *
 * File `.ts` thuần, **không import React** — cùng lý do `viewerShellTypes.ts`
 * của vỏ là `.ts`: module cảnh phải test được không cần dựng cây React, và một
 * kiểu mà cả hai phía đọc thì không được kéo theo tầng nào của phía kia.
 *
 * Bốn nhóm ở đây:
 *
 * 1. {@link Viewer3DProps} — hình dạng props `shell-props-contract.md` mục D đã
 *    chốt, và `useViewer3D` trả về ĐÚNG hình dạng đó, không thêm một trường
 *    nào. V5 đã dựng view và bài kiểm của nó theo đúng hợp đồng này; đổi hình
 *    dạng bây giờ là bắt V6 sửa lại việc của V5.
 * 2. Tiến độ dựng thật (đếm job đã settle, `three-contract.md` mục (a)) và ba
 *    con số khung hình trung bình của O-01.
 * 3. Kiểu của module cảnh — tuỳ chọn khi lắp, tay cầm trả về, và kết quả lắp
 *    (có/không có WebGL).
 * 4. Tuỳ chọn của hook.
 */

import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import type { ColoringModeId } from '@/lib/coloring/modes';
import type { ColorTokenName } from '@/lib/coloring/scales';
import type { BuildWorkerLike } from '@/lib/three/build/buildQueue';
import type { BuildFloorInput } from '@/lib/three/build/floor';
import type { BuildPartKind } from '@/lib/three/build/scene';
import type { ResourceLedger } from '@/lib/three/perf/dispose';
import type { TokenReader } from '@/lib/three/present/palette';
import type { ViewerShellGateway } from '@/screens/viewer/ViewerShell';
import type {
  ViewerSceneActions,
  ViewerSceneFrame,
  ViewerScreenState,
} from '@/screens/viewer/ViewerShell/viewerShellTypes';
import type { ProjectRole } from '@/types/project';

/* -------------------------------------------------------------------------- */
/* 1. Props của view — hợp đồng đã chốt, chép nguyên hình dạng.                */
/* -------------------------------------------------------------------------- */

/**
 * Props của `Viewer3D.tsx` — view thuần cắm vào khe `renderScene` của vỏ.
 *
 * Nguồn: `docs/notes/viewer3d/shell-props-contract.md` mục D. Mỗi trường ghi rõ
 * ai cấp; `useViewer3D` cấp mọi trường không phải của vỏ hay của container.
 *
 * N2: trước đây file này và `Viewer3D.tsx` mỗi bên khai một `Viewer3DProps`
 * riêng, ăn khớp nhau chỉ nhờ kiểu cấu trúc (container spread cả model vào
 * view, JSX cho phép prop dư). Gộp về đây — file `.ts` thuần — vì
 * `Viewer3D.tsx` nhập nó bằng `import type`, bị xoá trước khi ra bundle
 * (`local/no-data-layer-in-view` coi import chỉ-kiểu là an toàn, xem docblock
 * luật đó), nên R-60 không bị phá dù file này có nhập `@/domain` ở chỗ khác.
 * Hai trường lệch giữa hai bản cũ được xử lý đúng sự thật hiện tại thay vì
 * cộng dồn:
 * - `canEdit` không còn ở đây. `useViewer3D` vẫn tính và dùng nó (làm
 *   `canSelect` cho `mountViewerScene`, và để quyết `forbidden`), nhưng không
 *   nơi nào phía dưới đọc `model.canEdit` — nút "Sửa hình học" đã gỡ vì
 *   `onClick` rỗng (R-69/R-73). Trả nó ra ngoài chỉ là trùng lặp không dùng.
 * - `canvasRef` được thêm vào đây (từ bản của view): `WiredViewer3DScene`
 *   thêm prop này SAU khi gọi `useViewer3D` (`Viewer3D.container.tsx:147`),
 *   nên hook không cấp nó nhưng view cần nhận nó.
 */
export interface Viewer3DProps {
  /**
   * Bảy trạng thái màn hình. `ViewerSceneFrame` KHÔNG mang `state` (chỉ mang
   * camera/tầng/chọn), nên `Viewer3D` phải nhận nó qua một prop riêng.
   */
  readonly state: ViewerScreenState;

  /** Điểm nhìn, tầng hiện, tách, cắt, chọn/hover/cô lập/ẩn — VỎ cấp. */
  readonly frame: ViewerSceneFrame;

  /**
   * Hai việc báo ngược lên vỏ. Khai tuỳ chọn để qua được kiểu MỘT tham số của
   * `ViewerShellContainerProps.renderScene` (shell-props-contract mục B).
   */
  readonly sceneActions?: ViewerSceneActions | undefined;

  /**
   * Phần trăm dựng THẬT của R-03, đã định dạng (A15) — "62%". `null` khi không
   * có gì đang dựng.
   */
  readonly buildProgressLabel: string | null;

  /** Tầng đã dựng xong hình thật; còn lại vẽ khung dây ở trạng thái `partial`. */
  readonly readyStoreyIds: readonly string[];

  /** Caption một câu cho một tầng khung dây, ví dụ "Tầng 02 — chưa dựng xong". */
  readonly wireframeCaptionOf: (storeyId: string) => string;

  /** Không có WebGL — `Viewer3D` vẽ card lỗi thân thiện thay vì gọi renderer. */
  readonly webglUnavailable: boolean;

  /** Liên kết sang bản 2D cùng dự án. */
  readonly fallback2dHref: string;

  /** Nút "sang xem lớp tường" của trạng thái rỗng. */
  readonly qcHref: string;

  /** Thử lại riêng bước DỰNG HÌNH của R-03 — khác `onRetry` của vỏ. */
  readonly onRetryBuild: () => void;

  /**
   * Callback ref nhận phần tử `<canvas>` sau khi view gắn xong, để container
   * đưa nó vào `useViewer3D` (mục 4 dưới: `canvas` chỉ tồn tại sau khi view
   * gắn, nên nó KHÔNG phải một trường hook cấp qua đây).
   *
   * Vắng mặt thì không có `<canvas>` nào được vẽ — đó là cách story và bài
   * kiểm dựng view thuần này một mình, không cần WebGL.
   */
  readonly canvasRef?: ((canvas: HTMLCanvasElement | null) => void) | undefined;
}

/* -------------------------------------------------------------------------- */
/* 2. Tiến độ và số đo của cảnh.                                              */
/* -------------------------------------------------------------------------- */

/**
 * Tiến độ dựng, đếm theo JOB đã settle.
 *
 * `BuildQueue` không có callback tiến độ và `enqueueAll` chỉ resolve khi mọi
 * job xong (`three-contract.md` mục (a)), nên phần trăm thật chỉ có một cách
 * lấy: enqueue từng job rồi đếm. Bốn con số ở đây là phép đếm ấy.
 */
export interface ViewerSceneProgress {
  /** Số job đã settle — xong, huỷ hay hỏng đều tính. */
  readonly settledCount: number;
  /** Tổng số job của mọi tầng: tổng độ dài các mảng `planFullBuild` trả về. */
  readonly totalCount: number;
  /** Số job settle ở trạng thái `failed`. */
  readonly failedCount: number;
  /** Tầng đã dựng xong hình thật và đã tô vật liệu. */
  readonly readyLevelIds: readonly string[];
}

/** Cảnh đang ở đâu trong vòng đời dựng hình. */
export type ViewerScenePhase = 'idle' | 'building' | 'ready' | 'failed';

/** Trạng thái cảnh, đọc được bất cứ lúc nào và phát ra mỗi lần đổi. */
export interface ViewerSceneStatus {
  readonly phase: ViewerScenePhase;
  readonly progress: ViewerSceneProgress;
}

/**
 * Ba con số của sự kiện telemetry `scene.frame-rate` (O-01).
 *
 * Trung bình lấy từ chính phép đếm của `PerfMonitor`: cộng `frames` và
 * `durationMs` của mọi cửa sổ 500 ms đã đóng, rồi chia — không phải một công
 * thức khác viết lại ở đây (R-61).
 */
export interface ViewerSceneFrameRate {
  readonly averageFps: number;
  readonly durationMs: number;
  readonly triangleCount: number;
}

/* -------------------------------------------------------------------------- */
/* 3. Module cảnh.                                                            */
/* -------------------------------------------------------------------------- */

/** Phần tối thiểu của `WebGLRenderer` mà module cảnh dùng. */
export interface ViewerRendererLike {
  readonly info: { readonly render: { readonly calls: number; readonly triangles: number } };
  readonly shadowMap: { type: number; enabled: boolean };
  clippingPlanes: unknown[];
  setSize(width: number, height: number, updateStyle?: boolean): void;
  setPixelRatio(value: number): void;
  render(scene: unknown, camera: unknown): void;
  dispose(): void;
  forceContextLoss(): void;
}

/** Tuỳ chọn dành riêng cho bài kiểm — mọi thứ mặc định là bản thật. */
export interface ViewerSceneInjections {
  /** Thay `new WebGLRenderer(...)`. Ném lỗi được coi là "không có WebGL". */
  readonly createRenderer?: ((canvas: HTMLCanvasElement) => ViewerRendererLike) | undefined;
  /** Thay worker thật của R-03; `BuildQueue` nhận thẳng cái này. */
  readonly createWorker?: (() => BuildWorkerLike) | undefined;
  /** Lên lịch một khung hình; `requestAnimationFrame` khi vắng mặt. */
  readonly schedule?: ((callback: (nowMs: number) => void) => number) | undefined;
  readonly cancel?: ((handle: number) => void) | undefined;
  /** Đồng hồ của `PerfMonitor`; `performance.now` khi vắng mặt. */
  readonly now?: (() => number) | undefined;
  /** Đọc giá trị token màu; đọc từ `document` khi vắng mặt. */
  readonly readToken?: TokenReader | undefined;
  /** Sổ tài nguyên để bài kiểm chứng minh `dispose()` trả hết. */
  readonly ledger?: ResourceLedger | undefined;
}

/** Mọi thứ module cảnh cần để lắp lên một canvas. */
export interface ViewerSceneMountOptions extends ViewerSceneInjections {
  /** Một `BuildFloorInput` cho mỗi tầng — hook dựng sẵn qua `toBuildFloorInput`. */
  readonly levels: readonly BuildFloorInput[];
  /** Điểm nhìn đầu tiên. Đổi về sau đi qua {@link ViewerSceneHandle.update}. */
  readonly frame: ViewerSceneFrame;
  /** Chọn/hover báo ngược lên vỏ. Vắng mặt thì cảnh không báo cho ai. */
  readonly actions?: ViewerSceneActions | undefined;
  /** Token màu của từng loại bộ phận, hook lấy theo P-06 và cấp xuống. */
  readonly tokenOfPartKind: (kind: BuildPartKind) => ColorTokenName;
  /** Vai chỉ xem thì tắt bắn tia chọn — panel vẫn hiện, cảnh không chọn được. */
  readonly canSelect: boolean;
  /** Tiến độ và pha đổi. */
  readonly onStatusChange?: ((status: ViewerSceneStatus) => void) | undefined;
}

/** Tay cầm caller giữ để cập nhật và để trả tài nguyên về. */
export interface ViewerSceneHandle {
  /** Vỏ vừa đổi điểm nhìn / tầng / chọn: vẽ lại theo khung mới. */
  readonly update: (frame: ViewerSceneFrame) => void;
  /** Trạng thái dựng ngay lúc này. */
  readonly status: () => ViewerSceneStatus;
  /** Ba con số O-01, đọc lúc rời màn. */
  readonly frameRate: () => ViewerSceneFrameRate;
  /** R-05: trả geometry, material, texture và cả GL context. An toàn gọi hai lần. */
  readonly dispose: () => void;
}

/**
 * Kết quả lắp cảnh.
 *
 * Không có WebGL KHÔNG ném lỗi và không mang mã lỗi: nó là một nhánh hợp lệ mà
 * hook đọc được để bật trạng thái lỗi với một câu tiếng Việt bình thường.
 */
export type ViewerSceneMount =
  | { readonly ok: true; readonly handle: ViewerSceneHandle }
  | { readonly ok: false; readonly reason: 'webglUnavailable' };

/** Chữ ký của `mountViewerScene`, để hook tiêm được bản giả khi test. */
export type MountViewerScene = (
  canvas: HTMLCanvasElement,
  options: ViewerSceneMountOptions,
) => ViewerSceneMount;

/* -------------------------------------------------------------------------- */
/* 4. Tuỳ chọn của hook.                                                      */
/* -------------------------------------------------------------------------- */

/** Sự kiện O-01, đúng hình dạng `SceneFrameRateEvent` của `src/lib/telemetry`. */
export interface ViewerFrameRateEvent extends ViewerSceneFrameRate {
  readonly name: 'scene.frame-rate';
}

/** Chỗ gửi một sự kiện telemetry — phần `TelemetrySender` hook thật sự dùng. */
export interface Viewer3DTelemetry {
  readonly track: (event: ViewerFrameRateEvent) => void;
  readonly flushOnClose: () => void;
}

/**
 * Tuỳ chọn của `useViewer3D`.
 *
 * `canvas` nằm ở ĐÂY chứ không ở {@link Viewer3DProps}: nó là thứ chỉ tồn tại
 * lúc chạy, không phải dữ liệu để vẽ, và hợp đồng props đã chốt không có nó.
 * View lấy phần tử canvas ra bằng một callback ref rồi đưa vào hook.
 */
export interface UseViewer3DOptions {
  readonly projectId: string;
  /** Canvas để vẽ; `null` trước khi view gắn xong. */
  readonly canvas: HTMLCanvasElement | null;
  /** Khung vỏ đưa xuống khe cắm cảnh. */
  readonly frame: ViewerSceneFrame;
  /** Hai việc của vỏ; hook bọc thêm đại số chọn S-10 rồi mới gọi tới. */
  readonly sceneActions?: ViewerSceneActions | undefined;
  /** Vai người xem. Vắng mặt KHÔNG vào `forbidden` — xem data-gateway mục D. */
  readonly roles?: readonly ProjectRole[] | undefined;
  /** Đồ thị tiêm cho story/bài kiểm; vắng mặt thì đọc kho một lần duy nhất. */
  readonly spatial?: NormalizedSpatial | null | undefined;
  /** Cổng dữ liệu; vắng mặt thì dùng cổng THẬT đọc kho, không phải cổng giả. */
  readonly gateway?: ViewerShellGateway | undefined;
  /** Ép một trong bảy trạng thái, cho story và bài kiểm A11. */
  readonly forceState?: ViewerScreenState | undefined;
  /** Chế độ tô màu P-06; `'default'` khi vắng mặt. */
  readonly coloringModeId?: ColoringModeId | undefined;
  /** Chỗ gửi O-01; vắng mặt thì hook tự dựng một sender. */
  readonly telemetry?: Viewer3DTelemetry | undefined;
  /** Thay module cảnh, cho bài kiểm không cần WebGL. */
  readonly mountScene?: MountViewerScene | undefined;
}
