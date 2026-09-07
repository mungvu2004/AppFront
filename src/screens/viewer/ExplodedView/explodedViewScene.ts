/**
 * Cảnh 3D của màn `ExplodedView`: một canvas, một renderer, và các tầng tách ra
 * theo trục đứng.
 *
 * Cùng khuôn `screens/viewer/Viewer3D/viewer3dScene.ts` — một module cảnh sống
 * trong thư mục màn, sở hữu renderer, và test được không cần dựng cây React.
 * Khác nó ở đúng bốn chỗ, và cả bốn là lý do màn này tồn tại:
 *
 * 1. **Độ tách được HOẠT CẢNH, không nhảy.** `viewer3dScene` đặt `position.y`
 *    theo `frame.separation` ngay trong khung hình nhận được. Ở đây một lượt đổi
 *    độ tách mở một `ScenePlan` và các tầng chạy tới chỗ mới, tầng dưới đi trước.
 * 2. **So le** lấy từ `staggerDelaysMs()` — không phải một bảng độ trễ viết tay.
 * 3. **Ba nấc chi tiết theo ĐỘ TÁCH**, không theo lượt hạ chất lượng của R-04:
 *    tầng bị đẩy xa mắt thì vẽ rẻ hơn. Vẫn là `applyDetailLevel` — ẩn/hiện trên
 *    cây đã dựng — chứ KHÔNG `buildFloorLod`/`buildFloorAtDetail`, vì cả hai dựng
 *    hình học trên luồng chính.
 * 4. **Fps nhỏ nhất được cộng dồn** qua `onSample` của `PerfMonitor`. Lớp đo
 *    không giữ giá trị ấy (nó chỉ có `lastSample` và một trung bình cộng dồn),
 *    nên nó được cộng ở đây và phơi ra trên tay cầm để bước nghiệm thu đọc được.
 *
 * ## Cái gì được tạo ở đây, cái gì thì không
 *
 * `WebGLRenderer` và `Material` được tạo ở đây: vỏ chung KHÔNG tạo renderer nào
 * (đã soát cả `ViewerShell/**` — không có một lời gọi `WebGLRenderer` nào), cảnh
 * 3D là một khe cắm và màn nội dung tự vẽ.
 *
 * **Hình học thì không.** Không một `BufferGeometry` nào sinh ra trong file này:
 * mọi mesh đến từ worker của R-03 qua `BuildQueue` → `toMesh`.
 *
 * ## Không một lượt hẹn khung hình nào của riêng thư mục màn
 *
 * Vòng vẽ là của `createFrameLoop` (`src/lib/three/present/frameLoop.ts`); tiến
 * độ hoạt cảnh là của `createSceneOrchestrator` + `frameAt`
 * (`src/lib/motion/orchestrate.ts`). Thư mục màn không gọi hàm hẹn khung hình của
 * trình duyệt lần nào, và không có một bộ đếm thời gian lặp nào: file này chỉ đọc
 * `frameAt(...)` rồi đặt `position.y`. Bốn cổng của vòng vẽ đóng lại khi tab ẩn,
 * canvas ra khỏi màn, cửa sổ mất focus, hoặc người dùng xin giảm chuyển động.
 *
 * ## Vì sao hai đồng hồ, không phải một
 *
 * `SceneOrchestrator` kẹp thời gian ở `plan.totalMs`, và đó là đúng cho một lượt
 * handover không so le. Nhưng tầng cuối của một chồng so le bắt đầu MUỘN hơn tầng
 * đầu đúng `staggerDelaysMs` của nó, nên nó còn phải chạy sau khi đồng hồ chung
 * đã bão hoà. Nên orchestrator giữ KẾ HOẠCH (mở, thay, huỷ, và pha), còn
 * {@link frameAt} được gọi thẳng với `elapsed − độ trễ của tầng ấy` để mỗi tầng
 * đọc đúng tiến độ của chính nó. Hai hàm, hai việc, không việc nào chép việc kia.
 *
 * ## Không tô màu theo tầng
 *
 * `tokenOfPartKind` do hook cấp và nó KHÔNG nhận `levelId`: chữ ký ấy là cách
 * cấu trúc chặn "tô màu theo tầng" — thứ đặc tả cấm — chứ không phải một lời hứa
 * suông. Khoảng cách và đường nối là thứ truyền đạt sự tách.
 */

import {
  Box3,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  Plane,
  Scene,
  Vector3,
  WebGLRenderer,
  type Camera,
  type Material,
  type Object3D,
} from 'three';

import type { CaptureRendererLike, CaptureViewportSize } from '@/lib/export/screenshot';
import {
  createSceneOrchestrator,
  frameAt,
  type MotionConditions,
  type ScenePhase,
  type ScenePlan,
  type SceneTransitionKind,
} from '@/lib/motion/orchestrate';
import { staggerDelaysMs } from '@/lib/motion/stagger';
import {
  BuildQueue,
  planFullBuild,
  toMesh,
  type BuildWorkerLike,
} from '@/lib/three/build/buildQueue';
import type { BuildFloorInput } from '@/lib/three/build/floor';
import { DETAIL_LEVELS, detailLevelAt, type DetailLevel } from '@/lib/three/build/lod';
import { readPartData, type BuildPartKind, type PartUserData } from '@/lib/three/build/scene';
import {
  buildingExtent,
  createCameraMode,
  type BuildingExtent,
  type CameraMode,
  type Viewpoint,
} from '@/lib/three/camera/modes';
import { CAMERA_SETTINGS } from '@/lib/three/camera/settings';
import type { ColorTokenName } from '@/lib/coloring/scales';
import {
  createPointerPicker,
  createScenePick,
  type PointerInput,
} from '@/lib/three/interaction/raycast';
import { detectDeviceProfile, measureScene, readRenderInfo } from '@/lib/three/perf/budget';
import { disposeFloor, ResourceLedger } from '@/lib/three/perf/dispose';
import { paintByPartKind, sharedMaterialCache } from '@/lib/three/perf/materialCache';
import { PerfMonitor, shadowMapTypeFor } from '@/lib/three/perf/monitor';
import { createFrameLoop } from '@/lib/three/present/frameLoop';
import { documentTokenReader, tokenColour, type TokenReader } from '@/lib/three/present/palette';
// `applyDetailLevel` là hàm ẩn/hiện theo nấc chi tiết, và nó đã có một chủ:
// `viewer3dScene.ts` tái xuất qua cửa nhập của màn ấy. Ba kiểu tiến độ dựng cũng
// vậy — dựng bản thứ hai của chúng là hai bảng luật sẽ lệch nhau (R-61).
import {
  applyDetailLevel,
  type ViewerScenePhase,
  type ViewerSceneProgress,
  type ViewerSceneStatus,
} from '@/screens/viewer/Viewer3D';
import { stackStoreys } from '@/screens/viewer/ViewerShell';
import { MIN_SEPARATION } from '@/screens/viewer/ViewerShell/viewerStoreyStack';
import type {
  ViewerSceneActions,
  ViewerSceneFrame,
} from '@/screens/viewer/ViewerShell/viewerShellTypes';

import type { ExplodedFloorProbe } from './explodedViewTypes';

/* -------------------------------------------------------------------------- */
/* Hằng số của riêng module.                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Trần khung hình của khung nhìn.
 *
 * Một TẦN SỐ, không phải một thời lượng: thang 120/180/260/340/700 ms nói một
 * chuyển động kéo dài bao lâu, con số này nói bức tranh được lấy mẫu bao nhiêu
 * lần một giây. Cùng con số `VIEWER_MAX_FPS` của khung nhìn 3D, và cùng lý do:
 * một trần 30 nằm ngay trên ngưỡng hạ chất lượng của R-04 nên mọi phiên bình
 * thường sẽ bị đọc nhầm là chậm.
 */
export const EXPLODED_MAX_FPS = 60;

/**
 * Một lượt đổi độ tách là một lượt đổi GÓC NHÌN, không phải một lượt đổi tầng.
 *
 * Ba bậc của `SCENE_TIMINGS` là `view` / `screen` / `floor`, và bậc `floor` nói
 * về việc chuyển từ tầng này sang tầng khác — chuyện màn này không làm. Cả toà
 * nhà giãn ra là một lượt đổi cách xem cùng một mô hình, nên nó lấy bậc `view`
 * (tổng 340 ms, đúng một giá trị trên thang của mục B).
 */
const SEPARATION_TRANSITION_KIND: SceneTransitionKind = 'view';

/** Ranh giới chọn giữa hai chế độ trực giao của R-06 — cùng lý lẽ khung nhìn 3D. */
const ORTHOGRAPHIC_TOP_POLAR_RAD = Math.PI / 4;

/** Khoá vật liệu tô đối tượng đang chọn trong `sharedMaterialCache`. */
const SELECTION_MATERIAL_KEY = 'explodedView:selection';

/** Khoá vật liệu tô đối tượng con trỏ đang trỏ vào. */
const HOVER_MATERIAL_KEY = 'explodedView:hover';

/** Hộp bao dùng khi chưa có hình nào — camera vẫn phải có chỗ để đứng. */
const UNIT_EXTENT: BuildingExtent = {
  centre: new Vector3(0, 0, 0),
  sizeM: new Vector3(1, 1, 1),
};

/** Độ sáng của hai đèn. Đủ để vật liệu Lambert đọc được khối, không hơn. */
const SKY_LIGHT_INTENSITY = 0.9;
const KEY_LIGHT_INTENSITY = 1.1;

/** Mức xám dự phòng khi một token màu chưa nạp được. */
const FALLBACK_SURFACE_LEVEL = 0.72;
const FALLBACK_ACCENT_LEVEL = 0.45;

/** Cạnh bản đồ bóng. Bóng mềm, không gắt — R-04 mới được đổi nó sang cứng. */
const SHADOW_MAP_SIZE_PX = 1024;

/** Đèn chính đứng cách tâm bao nhiêu lần bán kính mô hình. */
const KEY_LIGHT_DISTANCE_FACTOR = 1;

/** Bao xa thì bản đồ bóng thôi phủ tới — bốn lần bán kính là đủ cho một chồng tách. */
const SHADOW_FAR_FACTOR = 4;

/** Chưa đo được khung hình nào thì không có fps nhỏ nhất nào để nói. */
const NO_FRAME_RATE = 0;

/* -------------------------------------------------------------------------- */
/* Kiểu của module cảnh.                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Phần tối thiểu của `WebGLRenderer` mà module cảnh dùng.
 *
 * Nó KẾ THỪA `CaptureRendererLike` chứ không khai lại: nút chụp ảnh của màn gọi
 * `captureViewport` với đúng renderer này, và hai bản kê khai rời nhau sẽ lệch
 * nhau vào đúng lúc không ai nhìn (R-61).
 */
export interface ExplodedRendererLike extends CaptureRendererLike {
  readonly info: { readonly render: { readonly calls: number; readonly triangles: number } };
  /** Bản đồ bóng của khung nhìn là bản đồ TĨNH — xem `viewer3dTypes.ts`. */
  readonly shadowMap: { type: number; enabled: boolean; autoUpdate: boolean; needsUpdate: boolean };
  clippingPlanes: unknown[];
  setSize(width: number, height: number, updateStyle?: boolean): void;
  setPixelRatio(value: number): void;
  dispose(): void;
  forceContextLoss(): void;
}

/** Tuỳ chọn dành riêng cho bài kiểm — mọi thứ mặc định là bản thật. */
export interface ExplodedSceneInjections {
  /** Thay `new WebGLRenderer(...)`. Ném lỗi được coi là "không có WebGL". */
  readonly createRenderer?: ((canvas: HTMLCanvasElement) => ExplodedRendererLike) | undefined;
  /** Thay worker thật của R-03; `BuildQueue` nhận thẳng cái này. */
  readonly createWorker?: (() => BuildWorkerLike) | undefined;
  /** Lên lịch một khung hình; hàm hẹn khung hình của trình duyệt khi vắng mặt. */
  readonly schedule?: ((callback: (nowMs: number) => void) => number) | undefined;
  readonly cancel?: ((handle: number) => void) | undefined;
  /** Đồng hồ của `PerfMonitor` và của hoạt cảnh; `performance.now` khi vắng mặt. */
  readonly now?: (() => number) | undefined;
  /** Đọc giá trị token màu; đọc từ `document` khi vắng mặt. */
  readonly readToken?: TokenReader | undefined;
  /** Sổ tài nguyên để bài kiểm chứng minh `dispose()` trả hết. */
  readonly ledger?: ResourceLedger | undefined;
}

/** Mọi thứ module cảnh cần để lắp lên một canvas. */
export interface ExplodedSceneMountOptions extends ExplodedSceneInjections {
  /** Một `BuildFloorInput` cho mỗi tầng — hook dựng sẵn qua `toBuildFloorInput`. */
  readonly levels: readonly BuildFloorInput[];
  /**
   * Tầng của chồng, đã sắp từ dưới lên.
   *
   * Riêng khỏi {@link ExplodedSceneMountOptions.levels}: `stackStoreys` cần
   * `order`/`elevationMm`/`heightMm`, và thứ tự so le đọc từ `order` chứ không từ
   * chỗ đứng trong mảng — một tầng bị lọc ra khỏi lượt dựng không được làm tầng
   * trên nó đi trước.
   */
  readonly storeys: readonly ExplodedFloorProbe[];
  /** Điểm nhìn đầu tiên. Đổi về sau đi qua {@link ExplodedSceneHandle.update}. */
  readonly frame: ViewerSceneFrame;
  /** Chọn/hover báo ngược lên vỏ. Vắng mặt thì cảnh không báo cho ai. */
  readonly actions?: ViewerSceneActions | undefined;
  /**
   * Token màu của từng LOẠI BỘ PHẬN — cố ý không nhận `levelId`.
   *
   * Đặc tả cấm tô màu theo tầng, và một chữ ký không nhận tầng là cách chặn ấy
   * bằng cấu trúc.
   */
  readonly tokenOfPartKind: (kind: BuildPartKind) => ColorTokenName;
  /** Vai chỉ xem thì tắt bắn tia chọn — panel vẫn hiện, cảnh không chọn được. */
  readonly canSelect: boolean;
  /** Tiến độ và pha dựng hình đổi. */
  readonly onStatusChange?: ((status: ViewerSceneStatus) => void) | undefined;
}

/**
 * Bốn con số khung hình của một lượt xem.
 *
 * `minFps` là con số `PerfMonitor` KHÔNG giữ: lớp đo chỉ có `lastSample` (cửa sổ
 * 500 ms gần nhất) và một trung bình cộng dồn, nên nhỏ nhất được cộng ở đây qua
 * `onSample` — chính callback mà `PerfMonitorOptions` đã mở ra cho việc này.
 */
export interface ExplodedSceneFrameRate {
  readonly averageFps: number;
  /** Fps của cửa sổ 500 ms tệ nhất trong cả lượt; 0 khi chưa đóng cửa sổ nào. */
  readonly minFps: number;
  readonly durationMs: number;
  readonly triangleCount: number;
}

/** Mọi thứ `captureViewport` cần, đọc ra từ cảnh đang chạy. */
export interface ExplodedCaptureSource {
  readonly renderer: CaptureRendererLike;
  readonly scene: Object3D;
  readonly camera: Camera;
  readonly viewport: CaptureViewportSize;
}

/** Trạng thái hoạt cảnh tách, đọc được bất cứ lúc nào. */
export interface ExplodedMotionStatus {
  /** Độ tách đang được VẼ — giữa hai mức khi hoạt cảnh còn chạy. */
  readonly shownSeparation: number;
  /** Độ tách hoạt cảnh đang chạy tới. */
  readonly targetSeparation: number;
  readonly phase: ScenePhase;
  readonly isRunning: boolean;
  /** Số lượt hoạt cảnh bị một lượt mới cắt ngang — `SceneOrchestrator` đếm. */
  readonly supersededCount: number;
}

/** Tay cầm caller giữ để cập nhật, để đọc số, và để trả tài nguyên về. */
export interface ExplodedSceneHandle {
  /** Vỏ vừa đổi điểm nhìn / tầng / độ tách: chạy tới khung mới. */
  readonly update: (frame: ViewerSceneFrame) => void;
  /** Trạng thái dựng ngay lúc này. */
  readonly status: () => ViewerSceneStatus;
  /** Hoạt cảnh tách đang ở đâu. */
  readonly motion: () => ExplodedMotionStatus;
  /** Bốn con số khung hình, đọc lúc rời màn hoặc lúc nghiệm thu. */
  readonly frameRate: () => ExplodedSceneFrameRate;
  /** Nấc chi tiết đang vẽ cho từng tầng — bước nghiệm thu đọc ba nấc ở đây. */
  readonly detailByStorey: () => ReadonlyMap<string, DetailLevel>;
  /** Nguồn cho `captureViewport`; `null` khi canvas chưa có kích thước nào. */
  readonly capture: () => ExplodedCaptureSource | null;
  /** R-05: trả geometry, material, texture và cả GL context. An toàn gọi hai lần. */
  readonly dispose: () => void;
}

/**
 * Kết quả lắp cảnh.
 *
 * Không có WebGL KHÔNG ném lỗi và không mang mã lỗi: nó là một nhánh hợp lệ mà
 * hook đọc được để bật trạng thái lỗi với một câu tiếng Việt bình thường.
 */
export type ExplodedSceneMount =
  | { readonly ok: true; readonly handle: ExplodedSceneHandle }
  | { readonly ok: false; readonly reason: 'webglUnavailable' };

/** Chữ ký của `mountExplodedScene`, để hook tiêm được bản giả khi test. */
export type MountExplodedScene = (
  canvas: HTMLCanvasElement,
  options: ExplodedSceneMountOptions,
) => ExplodedSceneMount;

/* -------------------------------------------------------------------------- */
/* Bản dựng mặc định của những thứ tiêm được.                                  */
/* -------------------------------------------------------------------------- */

/** Renderer thật. Ném lỗi khi máy không cấp được WebGL — caller bắt, không để lọt. */
function createDefaultRenderer(canvas: HTMLCanvasElement): ExplodedRendererLike {
  return new WebGLRenderer({ canvas, antialias: true, alpha: false });
}

/* -------------------------------------------------------------------------- */
/* Cửa vào.                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Lắp cảnh lên một canvas và trả về tay cầm để cập nhật, đọc số, và dọn.
 *
 * @param canvas Phần tử được đo và vẽ vào; module không đổi kích thước CSS của nó.
 * @param options Tầng cần dựng, chồng tầng, khung nhìn đầu tiên, và các chỗ tiêm.
 *
 * @example
 * const mount = mountExplodedScene(canvas, { levels, storeys, frame, tokenOfPartKind, canSelect });
 * if (!mount.ok) {
 *   // Không có WebGL — hook bật trạng thái lỗi, không có mã lỗi nào để hiện.
 * }
 */
export function mountExplodedScene(
  canvas: HTMLCanvasElement,
  options: ExplodedSceneMountOptions,
): ExplodedSceneMount {
  const readToken: TokenReader = options.readToken ?? documentTokenReader();
  let renderer: ExplodedRendererLike;

  try {
    renderer = (options.createRenderer ?? createDefaultRenderer)(canvas);
  } catch {
    // Không có WebGL là một nhánh hợp lệ, không phải một sự cố: hook đọc
    // `ok: false` rồi hiện một câu tiếng Việt bình thường, không mã lỗi.
    return { ok: false, reason: 'webglUnavailable' };
  }

  return { ok: true, handle: startScene(canvas, renderer, readToken, options) };
}

/* -------------------------------------------------------------------------- */
/* Phép thuần dùng trong thân cảnh.                                            */
/* -------------------------------------------------------------------------- */

/** Vật liệu Lambert của một token màu — một vật liệu cho mỗi loại bộ phận. */
function materialOfToken(colour: Color): Material {
  return new MeshLambertMaterial({ color: colour });
}

/** Chế độ camera ứng với một khung của vỏ. */
function cameraModeOf(frame: ViewerSceneFrame): CameraMode {
  if (!frame.isOrthographic) {
    return 'orbit';
  }

  return frame.polarRad <= ORTHOGRAPHIC_TOP_POLAR_RAD ? 'top' : 'elevation';
}

/** Tỉ lệ khung nhìn; 1 khi canvas chưa có kích thước nào để đo. */
function aspectOf(width: number, height: number): number {
  return width > 0 && height > 0 ? width / height : 1;
}

/**
 * Nấc rẻ hơn trong hai nấc.
 *
 * `DETAIL_LEVELS` xếp từ giàu nhất tới rẻ nhất, nên "rẻ hơn" là chỉ số lớn hơn.
 * Bảng ấy là nơi DUY NHẤT biết thứ tự các nấc; đọc lại nó thay vì chép một thứ tự
 * thứ hai vào đây (R-61).
 */
function coarserOf(left: DetailLevel, right: DetailLevel): DetailLevel {
  const index = Math.max(DETAIL_LEVELS.indexOf(left), DETAIL_LEVELS.indexOf(right));

  return DETAIL_LEVELS[index] ?? left;
}

/** Độ tách giữa hai mức, tại một tiến độ [0, 1]. */
function separationAt(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

/* -------------------------------------------------------------------------- */
/* Thân cảnh.                                                                  */
/* -------------------------------------------------------------------------- */

function startScene(
  canvas: HTMLCanvasElement,
  renderer: ExplodedRendererLike,
  readToken: TokenReader,
  options: ExplodedSceneMountOptions,
): ExplodedSceneHandle {
  const ledger = options.ledger ?? new ResourceLedger();
  const scene = new Scene();
  const root = new Group();
  scene.add(root);

  const white = tokenColour('--white', new Color(1, 1, 1), readToken);
  const fallbackSurface = new Color(
    FALLBACK_SURFACE_LEVEL,
    FALLBACK_SURFACE_LEVEL,
    FALLBACK_SURFACE_LEVEL,
  );
  const ground = tokenColour('--canvas-3d-ground', fallbackSurface, readToken);

  scene.background = tokenColour('--canvas-3d', fallbackSurface, readToken);

  const skyLight = new HemisphereLight(white, ground, SKY_LIGHT_INTENSITY);
  const keyLight = new DirectionalLight(white, KEY_LIGHT_INTENSITY);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(SHADOW_MAP_SIZE_PX, SHADOW_MAP_SIZE_PX);
  scene.add(skyLight, keyLight);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = shadowMapTypeFor('soft');
  // Vẽ lại khi mô hình đổi, không phải mỗi khung hình. Một lượt tách LÀ một lượt
  // mô hình đổi, nên `needsUpdate` được bật ở cuối mỗi khung hình có hoạt cảnh.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  const perspective = new PerspectiveCamera(
    CAMERA_SETTINGS.shared.fieldOfViewDeg,
    1,
    CAMERA_SETTINGS.shared.nearM,
    CAMERA_SETTINGS.shared.minFarM,
  );
  const orthographic = new OrthographicCamera(
    -1,
    1,
    1,
    -1,
    CAMERA_SETTINGS.shared.nearM,
    CAMERA_SETTINGS.shared.minFarM,
  );

  /* ---- Vật liệu ---------------------------------------------------------- */

  const fallbackAccent = new Color(
    FALLBACK_ACCENT_LEVEL,
    FALLBACK_ACCENT_LEVEL,
    FALLBACK_ACCENT_LEVEL,
  );

  const selectionMaterial = sharedMaterialCache.acquire(SELECTION_MATERIAL_KEY, () =>
    materialOfToken(tokenColour('--accent', fallbackAccent, readToken)),
  );
  const hoverMaterial = sharedMaterialCache.acquire(HOVER_MATERIAL_KEY, () =>
    materialOfToken(tokenColour('--accent-hover', fallbackAccent, readToken)),
  );

  /** Vật liệu gốc của mỗi mesh, để trả lại sau khi bỏ chọn. */
  const baseMaterials = new WeakMap<Mesh, Material>();

  /* ---- Trạng thái sống --------------------------------------------------- */

  let currentFrame: ViewerSceneFrame = options.frame;
  let extent: BuildingExtent = UNIT_EXTENT;
  let graphicsMemoryMb = 0;
  let lastWidthPx = 0;
  let lastHeightPx = 0;
  let disposed = false;

  /** Nấc chi tiết R-04 đang bảo vẽ. Chỉ `onDegrade` đổi nó. */
  let degradedDetail: DetailLevel = 'full';

  /** Nấc thật của từng tầng sau khi tính cả độ tách — bước nghiệm thu đọc nó. */
  const detailByStorey = new Map<string, DetailLevel>();

  let settledCount = 0;
  let failedCount = 0;
  let totalCount = 0;
  const readyLevelIds: string[] = [];
  const levelGroups = new Map<string, Group>();
  const remainingByLevel = new Map<string, number>();

  let totalFrames = 0;
  let totalDurationMs = 0;
  let triangleCount = 0;
  let minFps: number | null = null;

  /** Chồng tầng, sắp từ dưới lên: so le đọc thứ tự ở đây. */
  const storeys = [...options.storeys].sort((left, right) => left.order - right.order);

  const viewport = (): { width: number; height: number } => ({
    width: canvas.clientWidth > 0 ? canvas.clientWidth : canvas.width,
    height: canvas.clientHeight > 0 ? canvas.clientHeight : canvas.height,
  });

  /** Cùng đồng hồ mà `PerfMonitor` dùng, nên bài kiểm chỉ phải tiêm một cái. */
  const now = options.now ?? ((): number => performance.now());

  /* ---- Hoạt cảnh tách ---------------------------------------------------- */

  const orchestrator = createSceneOrchestrator();

  /** Kế hoạch đang chạy, hoặc `null` khi các tầng đang đứng yên. */
  let plan: ScenePlan | null = null;
  /** Độ tách của khung hình đang vẽ. */
  let shownSeparation = options.frame.separation;
  /** Độ tách hoạt cảnh chạy tới. */
  let targetSeparation = options.frame.separation;
  /** Độ tách lúc hoạt cảnh bắt đầu. */
  let fromSeparation = options.frame.separation;
  /** Đồng hồ của riêng lượt so le — xem "Vì sao hai đồng hồ" ở đầu file. */
  let elapsedMs = 0;
  /** Mốc đọc đồng hồ của khung hình trước; `null` ở khung hình đầu của một lượt. */
  let tickedAtMs: number | null = null;
  /** Độ trễ so le của từng tầng, chỉ số theo chỗ đứng trong `storeys`. */
  let staggerMs: readonly number[] = [];

  const motionConditionsOf = (frame: ViewerSceneFrame): MotionConditions => ({
    reducedMotion: frame.reducedMotion,
  });

  /**
   * Mở một lượt chạy tới độ tách mới.
   *
   * Giảm chuyển động làm mọi thời lượng về 0 (`conditionedDurationMs`) và mọi độ
   * trễ so le về 0 (`staggerDelaysMs`), nên cùng đoạn mã này NHẢY THẲNG tới mức
   * mới — không có nhánh thứ hai để hai đường đi lệch nhau.
   */
  const beginSeparation = (frame: ViewerSceneFrame): void => {
    const conditions = motionConditionsOf(frame);

    fromSeparation = shownSeparation;
    targetSeparation = frame.separation;
    staggerMs = staggerDelaysMs(storeys.length, conditions);
    elapsedMs = 0;
    tickedAtMs = null;
    plan = orchestrator.begin({
      kind: SEPARATION_TRANSITION_KIND,
      from: String(fromSeparation),
      to: String(targetSeparation),
      ...conditions,
    });
  };

  /** Khi nào lượt chạy kết thúc: tầng cuối cũng phải tới đích, không chỉ tầng đầu. */
  const runsUntilMs = (running: ScenePlan): number =>
    running.totalMs + (staggerMs.length === 0 ? 0 : Math.max(...staggerMs));

  /** Nấc chi tiết của một tầng ở khoảng cách này. */
  const detailAt = (spreadM: number, separation: number): DetailLevel => {
    if (separation <= MIN_SEPARATION) {
      return degradedDetail;
    }

    const distanceM = currentFrame.distanceM + Math.abs(spreadM);

    if (!Number.isFinite(distanceM) || distanceM < 0) {
      return degradedDetail;
    }

    // Tầng bị đẩy xa mắt thì vẽ rẻ hơn — `detailLevelAt` là nơi duy nhất biết
    // ngưỡng nào ứng với nấc nào, và một lượt hạ chất lượng của R-04 vẫn thắng.
    return coarserOf(degradedDetail, detailLevelAt(distanceM));
  };

  /* ---- Hình dạng khung: tầng hiện, ẩn, cô lập, chọn, tách, cắt ------------ */

  /**
   * Đặt lại vị trí, cờ hiện và vật liệu của mọi tầng theo một khung và một tiến độ.
   *
   * `separationOf` nhận chỗ đứng của tầng trong chồng và trả độ tách của riêng nó
   * — đó là chỗ so le đi vào. Một khung không có hoạt cảnh thì mọi tầng cùng một
   * độ tách, và cùng đoạn mã chạy.
   */
  const applyFrame = (
    frame: ViewerSceneFrame,
    separationOf: (index: number) => number,
  ): void => {
    const selected = new Set(frame.selectedEntityIds);
    const hidden = new Set(frame.hiddenEntityIds);
    const visibleStoreys = new Set(frame.visibleStoreyIds);
    const isolated = frame.isolatedEntityIds === null ? null : new Set(frame.isolatedEntityIds);

    /** Vật này có được hiện không, nếu bỏ nấc chi tiết ra ngoài. */
    const baseVisible = (data: PartUserData): boolean =>
      visibleStoreys.has(data.levelId) &&
      !hidden.has(data.entityId) &&
      (isolated === null || isolated.has(data.entityId));

    storeys.forEach((storey, index) => {
      const separation = separationOf(index);
      // Một tầng một lượt `stackStoreys`: hàm ấy là chủ của công thức
      // `elevation + order × separation × …`, và độ tách của từng tầng khác nhau
      // trong lúc so le nên không gọi được một lượt cho cả chồng.
      const stacked = stackStoreys([storey], separation)[0];

      if (stacked === undefined) {
        return;
      }

      const group = levelGroups.get(storey.id);
      const detail = detailAt(stacked.spreadM, separation);

      detailByStorey.set(storey.id, detail);

      if (group === undefined) {
        return;
      }

      // `toMesh` đã đặt hình ở cao độ thật của tầng, nên nhóm chỉ mang phần dịch
      // THÊM do độ tách — `separation === 0` để mọi tầng nguyên chỗ.
      group.position.setY(stacked.spreadM);

      // Ẩn/hiện, KHÔNG dựng lại hình: mesh của cả ba nấc đã nằm sẵn trên cây, nên
      // hạ chi tiết là phép ẩn và nâng lại là phép thôi ẩn.
      applyDetailLevel(group, detail, baseVisible);
    });

    root.traverse((object) => {
      if (!(object instanceof Mesh)) {
        return;
      }

      const data = readPartData(object);
      const base = data === null ? undefined : baseMaterials.get(object);

      if (data === null || base === undefined) {
        return;
      }

      object.material = selected.has(data.entityId)
        ? selectionMaterial
        : data.entityId === frame.hoveredEntityId
          ? hoverMaterial
          : base;
    });

    const clip = frame.sectionPlane;
    renderer.clippingPlanes =
      clip === null
        ? []
        : [new Plane(new Vector3(clip.normalX, clip.normalY, clip.normalZ), clip.constant)];

    loop.setGate('motion', !frame.reducedMotion);
  };

  /** Mọi tầng ở cùng một độ tách — dùng khi không có hoạt cảnh nào đang chạy. */
  const applyStill = (frame: ViewerSceneFrame, separation: number): void => {
    shownSeparation = separation;
    applyFrame(frame, () => separation);
  };

  /**
   * Một bước hoạt cảnh.
   *
   * @returns `true` khi lượt chạy còn dở, nên khung hình sau vẫn đáng vẽ.
   */
  const advanceSeparation = (running: ScenePlan, nowMs: number): boolean => {
    const deltaMs = tickedAtMs === null ? 0 : nowMs - tickedAtMs;
    tickedAtMs = nowMs;

    const endsAtMs = runsUntilMs(running);
    elapsedMs = Math.min(endsAtMs, elapsedMs + deltaMs);
    // Orchestrator giữ pha và sổ ghi lượt bị cắt ngang; `frameAt` ở dưới mới là
    // thứ đọc tiến độ của từng tầng — xem "Vì sao hai đồng hồ" ở đầu file.
    orchestrator.advance(deltaMs);

    applyFrame(currentFrame, (index) => {
      const progress = frameAt(running, elapsedMs - (staggerMs[index] ?? 0)).enter;

      return separationAt(fromSeparation, targetSeparation, progress);
    });

    if (elapsedMs < endsAtMs) {
      return true;
    }

    applyStill(currentFrame, targetSeparation);
    plan = null;
    tickedAtMs = null;

    return false;
  };

  /* ---- Camera ------------------------------------------------------------ */

  let activeCamera: Camera = perspective;

  /**
   * Camera do VỎ lái: hướng, góc chúc và khoảng cách của khung, nhìn vào tâm hộp
   * bao. `ViewerSceneFrame` không mang điểm ngắm, nên tâm hộp bao là điểm ngắm duy
   * nhất suy ra được từ khung.
   */
  const shellViewpointOf = (frame: ViewerSceneFrame): Viewpoint => ({
    target: extent.centre,
    azimuthRad: frame.azimuthRad,
    polarRad: frame.polarRad,
    distanceM: frame.distanceM,
  });

  const applyCamera = (frame: ViewerSceneFrame, width: number, height: number): void => {
    const camera = frame.isOrthographic ? orthographic : perspective;
    const controller = createCameraMode(cameraModeOf(frame), shellViewpointOf(frame), { extent });

    controller.applyTo(camera, aspectOf(width, height));
    activeCamera = camera;
  };

  /* ---- Vòng vẽ ----------------------------------------------------------- */

  const renderOnce = (): void => {
    if (disposed) {
      return;
    }

    const running = plan;

    if (running !== null && advanceSeparation(running, now())) {
      // Tập vật đổ bóng vừa dịch chỗ, nên bản đồ bóng tĩnh phải vẽ lại.
      renderer.shadowMap.needsUpdate = true;
    }

    const { width, height } = viewport();

    if (width > 0 && height > 0 && (width !== lastWidthPx || height !== lastHeightPx)) {
      renderer.setSize(width, height, false);
      lastWidthPx = width;
      lastHeightPx = height;
    }

    applyCamera(currentFrame, width, height);
    renderer.render(scene, activeCamera);
    monitor.frame();
  };

  /* ---- Hiệu năng --------------------------------------------------------- */

  const monitor = new PerfMonitor({
    read: () => readRenderInfo(renderer.info, graphicsMemoryMb),
    profile: detectDeviceProfile(),
    onSample: (sample) => {
      // Trung bình cộng dồn từ chính phép đếm của R-04, không phải một công thức
      // thứ hai viết lại ở đây. Nhỏ nhất thì lớp đo KHÔNG giữ, nên nó cộng ở đây.
      totalFrames += sample.frames;
      totalDurationMs += sample.durationMs;
      triangleCount = sample.triangles;
      minFps = minFps === null ? sample.frameRate : Math.min(minFps, sample.frameRate);
    },
    onDegrade: (action) => {
      // R-04 quyết, module thi hành — cả hai vế của quyết định. Không dựng lại một
      // milimét hình nào cho nấc rẻ hơn.
      renderer.shadowMap.type = shadowMapTypeFor(action.shadows);
      degradedDetail = action.detail;
      applyStill(currentFrame, shownSeparation);
      renderer.shadowMap.needsUpdate = true;
      loop.invalidate();
    },
    ...(options.now !== undefined ? { now: options.now } : {}),
  });

  const loop = createFrameLoop({
    // Không có chuyển động tự thân nào để lấy mẫu: hướng nhìn đến từ vỏ, và tiến
    // độ tách đến từ `frameAt`. Bốn cổng và trần khung hình là thứ giữ cho vòng
    // vẽ không đốt máy.
    headingAt: () => 0,
    restingHeading: 0,
    minStep: () => 0,
    render: renderOnce,
    maxFps: EXPLODED_MAX_FPS,
    ...(options.schedule !== undefined ? { schedule: options.schedule } : {}),
    ...(options.cancel !== undefined ? { cancel: options.cancel } : {}),
  });

  /* ---- Tiến độ dựng ------------------------------------------------------ */

  const progressOf = (): ViewerSceneProgress => ({
    settledCount,
    totalCount,
    failedCount,
    readyLevelIds: [...readyLevelIds],
  });

  const phaseOf = (): ViewerScenePhase => {
    if (totalCount === 0) {
      return 'idle';
    }
    if (settledCount < totalCount) {
      return 'building';
    }
    return failedCount > 0 && readyLevelIds.length === 0 ? 'failed' : 'ready';
  };

  const statusOf = (): ViewerSceneStatus => ({ phase: phaseOf(), progress: progressOf() });

  const announce = (): void => {
    options.onStatusChange?.(statusOf());
  };

  /* ---- Dựng hình --------------------------------------------------------- */

  const queue = new BuildQueue(
    options.createWorker !== undefined ? { createWorker: options.createWorker } : {},
  );

  const finishLevel = (levelId: string): void => {
    const group = levelGroups.get(levelId);

    if (group === undefined || disposed) {
      return;
    }

    const painted = paintByPartKind(group, sharedMaterialCache, (kind: BuildPartKind) =>
      materialOfToken(tokenColour(options.tokenOfPartKind(kind), fallbackSurface, readToken)),
    );

    group.traverse((object) => {
      if (!(object instanceof Mesh)) {
        return;
      }

      const kind = readPartData(object)?.kind;
      const material = kind === undefined ? undefined : painted.get(kind);

      if (material !== undefined) {
        baseMaterials.set(object, material);
      }

      object.castShadow = true;
      object.receiveShadow = true;
    });

    ledger.track(group);
    root.add(group);
    readyLevelIds.push(levelId);

    // Hộp bao và ước lượng bộ nhớ chỉ đổi khi có tầng mới, nên đo ở đây thay vì ở
    // mỗi lần `PerfMonitor` đọc.
    const box = new Box3().setFromObject(root);
    extent = box.isEmpty() ? UNIT_EXTENT : buildingExtent(box);
    graphicsMemoryMb = measureScene(root).graphicsMemoryMb;

    const radiusM = Math.max(extent.sizeM.x, extent.sizeM.y, extent.sizeM.z);
    keyLight.position.set(
      extent.centre.x + radiusM * KEY_LIGHT_DISTANCE_FACTOR,
      extent.centre.y + radiusM * KEY_LIGHT_DISTANCE_FACTOR,
      extent.centre.z + radiusM * KEY_LIGHT_DISTANCE_FACTOR,
    );
    keyLight.target.position.copy(extent.centre);
    keyLight.target.updateMatrixWorld();
    keyLight.shadow.camera.far = radiusM * SHADOW_FAR_FACTOR;
    keyLight.shadow.camera.updateProjectionMatrix();

    applyStill(currentFrame, shownSeparation);
    renderer.shadowMap.needsUpdate = true;
    loop.invalidate();
  };

  const startBuild = (): void => {
    for (const model of options.levels) {
      const jobs = planFullBuild(model);
      const levelId = model.level.id;

      if (jobs.length === 0) {
        continue;
      }

      levelGroups.set(levelId, new Group());
      remainingByLevel.set(levelId, jobs.length);

      for (const job of jobs) {
        totalCount += 1;

        // Từng job một, không `enqueueAll`: đó là cách DUY NHẤT có phần trăm thật.
        void queue.enqueue(job).then((outcome) => {
          settledCount += 1;

          if (outcome.status === 'done') {
            const group = levelGroups.get(levelId);

            for (const part of outcome.parts) {
              group?.add(toMesh(part));
            }
          } else if (outcome.status === 'failed') {
            failedCount += 1;
          }

          const remaining = (remainingByLevel.get(levelId) ?? 0) - 1;
          remainingByLevel.set(levelId, remaining);

          if (remaining === 0 && outcome.status !== 'cancelled') {
            finishLevel(levelId);
          }

          announce();
        });
      }
    }

    announce();
  };

  /* ---- Chọn đối tượng ---------------------------------------------------- */

  const picker = options.canSelect
    ? createPointerPicker({
        pick: createScenePick({
          get camera(): Camera {
            return activeCamera;
          },
          root,
          viewport,
        }),
        onEvent: (event) => {
          if (event.type === 'hover') {
            options.actions?.hoverEntity(event.hit?.entityId ?? null);
            return;
          }
          options.actions?.selectEntity(event.hit?.entityId ?? null, event.additive);
        },
      })
    : null;

  const toPointerInput = (event: PointerEvent): PointerInput => {
    const rect = canvas.getBoundingClientRect();

    return { x: event.clientX - rect.left, y: event.clientY - rect.top, additive: event.shiftKey };
  };

  const onPointerDown = (event: PointerEvent): void => picker?.pointerDown(toPointerInput(event));
  const onPointerMove = (event: PointerEvent): void => picker?.pointerMove(toPointerInput(event));
  const onPointerUp = (event: PointerEvent): void => picker?.pointerUp(toPointerInput(event));
  const onPointerLeave = (event: PointerEvent): void => picker?.pointerLeave(toPointerInput(event));

  if (picker !== null) {
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
  }

  /* ---- Bốn cổng của vòng vẽ ---------------------------------------------- */

  const onVisibility = (): void => loop.setGate('visible', !document.hidden);
  const onFocus = (): void => loop.setGate('focused', true);
  const onBlur = (): void => loop.setGate('focused', false);

  document.addEventListener('visibilitychange', onVisibility);
  globalThis.addEventListener('focus', onFocus);
  globalThis.addEventListener('blur', onBlur);

  const observer =
    typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver((entries) => {
          const entry = entries.at(-1);

          if (entry !== undefined) {
            loop.setGate('onScreen', entry.isIntersecting);
          }
        });
  observer?.observe(canvas);

  /* ---- Khởi động --------------------------------------------------------- */

  applyStill(currentFrame, currentFrame.separation);
  startBuild();
  loop.invalidate();

  /* ---- Tay cầm ----------------------------------------------------------- */

  return {
    update: (frame) => {
      if (disposed) {
        return;
      }

      const wasSeparation = targetSeparation;
      currentFrame = frame;

      if (frame.separation === wasSeparation) {
        // Không phải một lượt tách: camera, chọn, ẩn hay mặt cắt vừa đổi. Giữ
        // nguyên tiến độ đang có thay vì mở một lượt chạy tới cùng một chỗ.
        if (plan === null) {
          applyStill(frame, shownSeparation);
        }
      } else {
        beginSeparation(frame);
      }

      renderer.shadowMap.needsUpdate = true;
      loop.invalidate();
    },

    status: statusOf,

    motion: (): ExplodedMotionStatus => ({
      shownSeparation,
      targetSeparation,
      phase: orchestrator.phase,
      isRunning: plan !== null,
      supersededCount: orchestrator.supersededCount,
    }),

    frameRate: (): ExplodedSceneFrameRate => ({
      averageFps: totalDurationMs > 0 ? (totalFrames * 1000) / totalDurationMs : NO_FRAME_RATE,
      minFps: minFps ?? NO_FRAME_RATE,
      durationMs: totalDurationMs,
      triangleCount,
    }),

    detailByStorey: (): ReadonlyMap<string, DetailLevel> => new Map(detailByStorey),

    capture: (): ExplodedCaptureSource | null => {
      const { width, height } = viewport();

      if (disposed || width <= 0 || height <= 0) {
        return null;
      }

      // Camera phải đứng đúng chỗ khung hiện tại trước khi ai chụp nó:
      // `captureViewport` render LẠI một lượt riêng vào target ngoài màn, nó
      // không đọc pixel của canvas đang hiện.
      applyCamera(currentFrame, width, height);

      return {
        renderer,
        scene,
        camera: activeCamera,
        viewport: { widthPx: width, heightPx: height },
      };
    },

    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;

      orchestrator.cancel();
      plan = null;

      loop.dispose();
      queue.dispose();
      picker?.dispose();

      if (picker !== null) {
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointerleave', onPointerLeave);
      }

      document.removeEventListener('visibilitychange', onVisibility);
      globalThis.removeEventListener('focus', onFocus);
      globalThis.removeEventListener('blur', onBlur);
      observer?.disconnect();

      // Trả vật liệu tô chọn/hover về đúng vật liệu gốc TRƯỚC khi đóng tầng:
      // `disposeFloor` giải phóng những gì nó tìm thấy trong cây, nên hai vật liệu
      // dùng chung phải rời khỏi cây rồi mới được trả tay.
      root.traverse((object) => {
        if (object instanceof Mesh) {
          const base = baseMaterials.get(object);

          if (base !== undefined) {
            object.material = base;
          }
        }
      });

      for (const group of levelGroups.values()) {
        disposeFloor(group, { materials: sharedMaterialCache });
      }
      levelGroups.clear();
      detailByStorey.clear();

      sharedMaterialCache.release(selectionMaterial);
      sharedMaterialCache.release(hoverMaterial);

      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
