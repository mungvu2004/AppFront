/**
 * Cảnh 3D của màn `Viewer3D`: một canvas, một renderer, và mô hình do worker dựng.
 *
 * Cùng khuôn `screens/auth/AuthScreen/houseScene.ts` — một module cảnh sống
 * trong thư mục màn, sở hữu renderer, và test được không cần dựng cây React.
 * Khác một điểm quan trọng: `/login` trình diễn một bản vẽ cố định qua
 * `src/lib/three/present`, còn màn này dựng mô hình của người dùng, nên nó đi
 * đường `src/lib/three/build` + `perf` + `camera` + `interaction`.
 *
 * ## Cái gì được tạo ở đây, cái gì thì không
 *
 * `WebGLRenderer` và `Material` được tạo ở đây, vì `src/lib` không có API nào
 * làm hộ (`paintByPartKind` nói thẳng: `create` là của caller, vì màu đến từ
 * token qua `src/lib/coloring` và một module trong `src/lib/three` mà tự chọn
 * màu là tự phát minh một màu design system chưa duyệt).
 *
 * **Hình học thì không.** Không một `BufferGeometry` nào sinh ra trong file
 * này: mọi mesh đến từ worker của R-03 qua `BuildQueue` → `toMesh`. Đó là lý do
 * file này không import `buildFloorMesh`, `buildFloorAtDetail` hay
 * `buildFloorLod` — cả ba dựng hình trên luồng chính.
 *
 * ## Phần trăm dựng là phép đếm thật
 *
 * `BuildQueue` không phát tiến độ và `enqueueAll` chỉ resolve khi mọi job xong
 * (`three-contract.md` mục (a)), nên từng job được `enqueue()` riêng và mỗi
 * promise settle làm tăng một biến đếm. `totalCount` là tổng độ dài các mảng
 * `planFullBuild` trả về — một lần cho mỗi tầng, vì `planFullBuild` chỉ dựng
 * MỘT tầng.
 *
 * ## Vẽ khi nào
 *
 * `createFrameLoop` của `src/lib/three/present/frameLoop.ts` giữ vòng vẽ; file
 * này không gọi `requestAnimationFrame` lần nào. Bốn cổng của nó đóng lại khi
 * tab ẩn, canvas ra khỏi màn, cửa sổ mất focus, hoặc người dùng xin giảm chuyển
 * động — cổng đóng thì loop dừng hẳn chứ không tick không tải.
 *
 * ## Hạ chất lượng
 *
 * `PerfMonitor` quyết định, module chỉ thi hành. Ngưỡng, cửa sổ đo và thời điểm
 * hạ đều là của R-04; ở đây không có một con số hiệu năng nào của riêng mình
 * ngoài trần khung hình {@link VIEWER_MAX_FPS}, vốn là một tần số chứ không
 * phải một thời lượng chuyển động (đúng phân biệt mà `MAX_SWAY_FPS` của
 * `frameLoop.ts` đã đặt ra).
 *
 * `DegradeAction` có hai vế và cả hai được thi hành: bóng đổ đi thẳng vào
 * `renderer.shadowMap.type` qua `shadowMapTypeFor`, còn nấc chi tiết đi qua
 * {@link applyDetailLevel} — ẩn đúng những loại bộ phận mà `droppedKindsAt` nói
 * nấc ấy bỏ. Hình học KHÔNG dựng lại cho một nấc rẻ hơn: mọi mesh của cả ba nấc
 * đã nằm sẵn trên cây, nên hạ chi tiết là một phép ẩn và nâng lại là phép thôi
 * ẩn — đảo ngược được, không mất một buffer nào.
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

import { CameraDirector } from '@/lib/three/camera/presets';
import { CAMERA_SETTINGS } from '@/lib/three/camera/settings';
import {
  buildingExtent,
  createCameraMode,
  type BuildingExtent,
  type CameraMode,
  type Viewpoint,
} from '@/lib/three/camera/modes';
import { BuildQueue, planFullBuild, toMesh } from '@/lib/three/build/buildQueue';
import { droppedKindsAt, type DetailLevel } from '@/lib/three/build/lod';
import { readPartData, type BuildPartKind, type PartUserData } from '@/lib/three/build/scene';
import { createPointerPicker, createScenePick, type PointerInput } from '@/lib/three/interaction/raycast';
import { detectDeviceProfile, measureScene, readRenderInfo } from '@/lib/three/perf/budget';
import { disposeFloor, ResourceLedger } from '@/lib/three/perf/dispose';
import { paintByPartKind, sharedMaterialCache } from '@/lib/three/perf/materialCache';
import { PerfMonitor, shadowMapTypeFor } from '@/lib/three/perf/monitor';
import { createFrameLoop } from '@/lib/three/present/frameLoop';
import { documentTokenReader, tokenColour, type TokenReader } from '@/lib/three/present/palette';
import {
  stackStoreys,
  type StackableStorey,
} from '@/screens/viewer/ViewerShell/viewerStoreyStack';
import type { ViewerSceneFrame } from '@/screens/viewer/ViewerShell/viewerShellTypes';

import type {
  ViewerRendererLike,
  ViewerSceneFrameRate,
  ViewerSceneHandle,
  ViewerSceneMount,
  ViewerSceneMountOptions,
  ViewerSceneProgress,
  ViewerScenePhase,
  ViewerSceneStatus,
} from './viewer3dTypes';

/* -------------------------------------------------------------------------- */
/* Hằng số của riêng module.                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Trần khung hình của khung nhìn.
 *
 * Một TẦN SỐ, không phải một thời lượng: thang 120/180/260/340/700 ms của mục B
 * nói một chuyển động kéo dài bao lâu, con số này nói bức tranh được lấy mẫu bao
 * nhiêu lần một giây. `frameLoop.ts` đặt ra chính phân biệt ấy cho `MAX_SWAY_FPS`.
 *
 * 60 chứ không phải 30 của cảnh đăng nhập: người dùng ở đây đang xoay một toà
 * nhà bằng chuột, và một trần 30 nằm ngay trên ngưỡng hạ chất lượng của R-04
 * (`DEGRADE_FRAME_RATE` = 30) nên mọi phiên bình thường sẽ bị đọc nhầm là chậm.
 */
export const VIEWER_MAX_FPS = 60;

/**
 * Ranh giới chọn giữa hai chế độ trực giao của R-06.
 *
 * Thư viện camera có đúng hai chế độ trực giao và cả hai KHOÁ góc chúc: `top`
 * nhìn thẳng xuống (0°), `elevation` nhìn ngang (90°). Khung của vỏ thì mang một
 * góc chúc tự do, nên phải chọn một trong hai — và chọn theo nửa đường giữa
 * chúng là cách duy nhất không thiên vị bên nào.
 */
const ORTHOGRAPHIC_TOP_POLAR_RAD = Math.PI / 4;

/** Khoá vật liệu tô đối tượng đang chọn trong `sharedMaterialCache`. */
const SELECTION_MATERIAL_KEY = 'viewer3d:selection';

/** Khoá vật liệu tô đối tượng con trỏ đang trỏ vào. */
const HOVER_MATERIAL_KEY = 'viewer3d:hover';

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

/**
 * Một giây, tính bằng mili-giây.
 *
 * `CameraDirector.update` nhận GIÂY còn mọi đồng hồ ở đây trả mili-giây, nên
 * phép đổi phải viết ra một lần. Tên cố ý không mang `_PER_`: `local/no-raw-number`
 * đọc mọi ước số tên `*_PER_*` là một phép quy đổi ĐƠN VỊ ĐO — thứ thuộc về
 * `src/domain` — và đây là thời gian của một vòng vẽ, không phải số đo của mô
 * hình.
 */
const SECOND_IN_MS = 1000;

/* -------------------------------------------------------------------------- */
/* Bản dựng mặc định của những thứ tiêm được.                                  */
/* -------------------------------------------------------------------------- */

/** Renderer thật. Ném lỗi khi máy không cấp được WebGL — caller bắt, không để lọt. */
function createDefaultRenderer(canvas: HTMLCanvasElement): ViewerRendererLike {
  return new WebGLRenderer({ canvas, antialias: true, alpha: false });
}

/* -------------------------------------------------------------------------- */
/* Cửa vào.                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Lắp cảnh lên một canvas và trả về tay cầm để cập nhật, đọc số, và dọn.
 *
 * @param canvas Phần tử được đo và vẽ vào; module không đổi kích thước CSS của nó.
 * @param options Tầng cần dựng, khung nhìn đầu tiên, và các chỗ tiêm cho bài kiểm.
 *
 * @example
 * const mount = mountViewerScene(canvas, { levels, frame, tokenOfPartKind, canSelect });
 * if (!mount.ok) {
 *   // Không có WebGL — hook bật trạng thái lỗi, không có mã lỗi nào để hiện.
 * }
 */
export function mountViewerScene(
  canvas: HTMLCanvasElement,
  options: ViewerSceneMountOptions,
): ViewerSceneMount {
  const readToken: TokenReader = options.readToken ?? documentTokenReader();
  let renderer: ViewerRendererLike;

  try {
    renderer = (options.createRenderer ?? createDefaultRenderer)(canvas);
  } catch {
    // Không có WebGL là một nhánh hợp lệ, không phải một sự cố: hook đọc
    // `ok: false` rồi hiện một câu tiếng Việt bình thường, không mã lỗi.
    return { ok: false, reason: 'webglUnavailable' };
  }

  const handle = startScene(canvas, renderer, readToken, options);

  return { ok: true, handle };
}

/* -------------------------------------------------------------------------- */
/* Thân cảnh.                                                                  */
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

/**
 * Áp một nấc chi tiết của R-04 lên cây đã dựng.
 *
 * Hạ chi tiết ở đây KHÔNG dựng lại gì. Mesh của mọi bộ phận đã nằm sẵn trên cây
 * — worker R-03 dựng chúng một lần — nên "nấc rẻ hơn" là ẩn đúng những loại bộ
 * phận mà nấc ấy bỏ, và "nấc đầy đủ" là thôi ẩn chúng. `droppedKindsAt`
 * (`src/lib/three/build/lod.ts`) là nơi DUY NHẤT biết nấc nào bỏ loại nào; bảng
 * ấy không được chép lại ở đây, vì hai bản sao của một luật sẽ lệch nhau vào
 * đúng lúc không ai nhìn.
 *
 * **Đảo ngược được, và đó là điều kiện.** Không `remove()`, không `dispose()`,
 * không nhớ lần trước đã ẩn những gì: mỗi lần gọi tính lại cờ `visible` từ đầu
 * cho mọi vật có thẻ, nên nấc quay về `full` hiện lại đủ mà không cần một buffer
 * nào được dựng lần thứ hai.
 *
 * Làm việc trên mọi `Object3D` mang {@link PartUserData}, không riêng `Mesh`:
 * thẻ mới là thứ nói một vật thuộc loại nào, và ẩn một nút thì cả nhánh dưới nó
 * cùng biến mất — đúng nghĩa "bỏ" của một nấc.
 *
 * @param baseVisible Vật này có được hiện không NẾU bỏ nấc chi tiết ra ngoài:
 * tầng của nó đang bật, người dùng chưa ẩn tay, và nó không bị cô lập ra rìa.
 * @returns số vật mà chính nấc này bỏ đi.
 */
export function applyDetailLevel(
  root: Object3D,
  detail: DetailLevel,
  baseVisible: (data: PartUserData) => boolean,
): number {
  const dropped = new Set<BuildPartKind>(droppedKindsAt(detail));
  let droppedCount = 0;

  root.traverse((object) => {
    const data = readPartData(object);

    if (data === null) {
      return;
    }

    const isDropped = dropped.has(data.kind);
    object.visible = baseVisible(data) && !isDropped;

    if (isDropped) {
      droppedCount += 1;
    }
  });

  return droppedCount;
}

/** Tỉ lệ khung nhìn; 1 khi canvas chưa có kích thước nào để đo. */
function aspectOf(width: number, height: number): number {
  return width > 0 && height > 0 ? width / height : 1;
}

function startScene(
  canvas: HTMLCanvasElement,
  renderer: ViewerRendererLike,
  readToken: TokenReader,
  options: ViewerSceneMountOptions,
): ViewerSceneHandle {
  const ledger = options.ledger ?? new ResourceLedger();
  const scene = new Scene();
  const root = new Group();
  scene.add(root);

  const white = tokenColour('--white', new Color(1, 1, 1), readToken);
  const ground = tokenColour(
    '--canvas-3d-ground',
    new Color(FALLBACK_SURFACE_LEVEL, FALLBACK_SURFACE_LEVEL, FALLBACK_SURFACE_LEVEL),
    readToken,
  );

  // Một màu token cho nền, không gradient — đặc tả nói thẳng.
  scene.background = tokenColour(
    '--canvas-3d',
    new Color(FALLBACK_SURFACE_LEVEL, FALLBACK_SURFACE_LEVEL, FALLBACK_SURFACE_LEVEL),
    readToken,
  );

  const skyLight = new HemisphereLight(white, ground, SKY_LIGHT_INTENSITY);
  const keyLight = new DirectionalLight(white, KEY_LIGHT_INTENSITY);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(SHADOW_MAP_SIZE_PX, SHADOW_MAP_SIZE_PX);
  scene.add(skyLight, keyLight);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = shadowMapTypeFor('soft');

  const perspective = new PerspectiveCamera(
    CAMERA_SETTINGS.shared.fieldOfViewDeg,
    1,
    CAMERA_SETTINGS.shared.nearM,
    CAMERA_SETTINGS.shared.minFarM,
  );
  const orthographic = new OrthographicCamera(-1, 1, 1, -1, CAMERA_SETTINGS.shared.nearM, CAMERA_SETTINGS.shared.minFarM);

  /* ---- Vật liệu ---------------------------------------------------------- */

  const selectionMaterial = sharedMaterialCache.acquire(SELECTION_MATERIAL_KEY, () =>
    materialOfToken(
      tokenColour(
        '--accent',
        new Color(FALLBACK_ACCENT_LEVEL, FALLBACK_ACCENT_LEVEL, FALLBACK_ACCENT_LEVEL),
        readToken,
      ),
    ),
  );
  const hoverMaterial = sharedMaterialCache.acquire(HOVER_MATERIAL_KEY, () =>
    materialOfToken(
      tokenColour(
        '--accent-hover',
        new Color(FALLBACK_ACCENT_LEVEL, FALLBACK_ACCENT_LEVEL, FALLBACK_ACCENT_LEVEL),
        readToken,
      ),
    ),
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
  let activeDetail: DetailLevel = 'full';

  let settledCount = 0;
  let failedCount = 0;
  let totalCount = 0;
  const readyLevelIds: string[] = [];
  const levelGroups = new Map<string, Group>();
  const remainingByLevel = new Map<string, number>();

  let totalFrames = 0;
  let totalDurationMs = 0;
  let triangleCount = 0;

  const stackable: readonly StackableStorey[] = options.levels.map((model, index) => ({
    id: model.level.id,
    order: index,
    elevationMm: model.level.elevationMm,
    heightMm: model.level.heightMm,
  }));

  const viewport = (): { width: number; height: number } => ({
    width: canvas.clientWidth > 0 ? canvas.clientWidth : canvas.width,
    height: canvas.clientHeight > 0 ? canvas.clientHeight : canvas.height,
  });

  /** Cùng đồng hồ mà `PerfMonitor` dùng, nên bài kiểm chỉ phải tiêm một cái. */
  const now = options.now ?? ((): number => performance.now());

  /* ---- Camera ------------------------------------------------------------ */

  let activeCamera: Camera = perspective;

  /**
   * Camera do VỎ lái: hướng, góc chúc và khoảng cách của khung, nhìn vào tâm
   * hộp bao. `ViewerSceneFrame` không mang điểm ngắm, nên tâm hộp bao là điểm
   * ngắm duy nhất suy ra được từ khung.
   */
  const shellViewpointOf = (frame: ViewerSceneFrame): Viewpoint => ({
    target: extent.centre,
    azimuthRad: frame.azimuthRad,
    polarRad: frame.polarRad,
    distanceM: frame.distanceM,
  });

  /**
   * Lượt khuôn đối tượng đang chạy hoặc đang giữ, và số của khung vỏ lúc nó bắt
   * đầu — xem {@link ViewerSceneHandle.frameEntities}.
   *
   * Giữ lại sau khi bay xong là cố ý: khuôn xong rồi mà khung kế tiếp của vỏ
   * kéo camera về tâm nhà thì phòng vừa tìm ra lại biến mất. Người dùng lấy
   * quyền lái lại bằng cách động vào camera — và lúc ấy ba con số của khung đổi,
   * đúng dấu hiệu {@link releaseFramingIfMoved} đọc.
   */
  let framing: CameraDirector | null = null;
  let framingFrom: Viewpoint | null = null;
  let framingAtMs: number | null = null;

  const sameCameraNumbers = (left: Viewpoint, right: Viewpoint): boolean =>
    left.azimuthRad === right.azimuthRad &&
    left.polarRad === right.polarRad &&
    left.distanceM === right.distanceM;

  /** Vỏ vừa lái camera: trả quyền về cho vỏ. */
  const releaseFramingIfMoved = (frame: ViewerSceneFrame): void => {
    if (framingFrom !== null && !sameCameraNumbers(framingFrom, shellViewpointOf(frame))) {
      framing = null;
      framingFrom = null;
      framingAtMs = null;
    }
  };

  const applyCamera = (frame: ViewerSceneFrame, width: number, height: number): void => {
    const camera = frame.isOrthographic ? orthographic : perspective;
    const aspect = aspectOf(width, height);

    if (framing !== null) {
      const nowMs = now();
      const dtSeconds = framingAtMs === null ? 0 : (nowMs - framingAtMs) / SECOND_IN_MS;
      framingAtMs = nowMs;

      framing.update(dtSeconds);
      framing.applyTo(camera, aspect);
      activeCamera = camera;

      return;
    }

    const controller = createCameraMode(cameraModeOf(frame), shellViewpointOf(frame), { extent });

    controller.applyTo(camera, aspect);
    activeCamera = camera;
  };

  /* ---- Vòng vẽ ----------------------------------------------------------- */

  const renderOnce = (): void => {
    if (disposed) {
      return;
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
      // Trung bình O-01 cộng dồn từ chính phép đếm của R-04, không phải một
      // công thức thứ hai viết lại ở đây.
      totalFrames += sample.frames;
      totalDurationMs += sample.durationMs;
      triangleCount = sample.triangles;
    },
    onDegrade: (action) => {
      // R-04 quyết, module thi hành — cả hai vế của quyết định, không vế nào bị
      // bỏ lại. Không ngưỡng riêng, không lần hạ thứ hai, và không dựng lại một
      // milimét hình nào cho nấc rẻ hơn.
      renderer.shadowMap.type = shadowMapTypeFor(action.shadows);
      activeDetail = action.detail;
      applyFrame(currentFrame);
      loop.invalidate();
    },
    ...(options.now !== undefined ? { now: options.now } : {}),
  });

  const loop = createFrameLoop({
    // Không có chuyển động tự thân nào để lấy mẫu: hướng nhìn đến từ vỏ, nên
    // hướng của loop là hằng và mỗi tick đều đáng vẽ (minStep 0). Bốn cổng và
    // trần khung hình là thứ giữ cho nó không đốt máy.
    headingAt: () => 0,
    restingHeading: 0,
    minStep: () => 0,
    render: renderOnce,
    maxFps: VIEWER_MAX_FPS,
    ...(options.schedule !== undefined ? { schedule: options.schedule } : {}),
    ...(options.cancel !== undefined ? { cancel: options.cancel } : {}),
  });

  /* ---- Tiến độ ----------------------------------------------------------- */

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

  /* ---- Hình dạng khung: tầng hiện, ẩn, cô lập, chọn, tách, cắt ------------ */

  const applyFrame = (frame: ViewerSceneFrame): void => {
    const selected = new Set(frame.selectedEntityIds);
    const hidden = new Set(frame.hiddenEntityIds);
    const visibleStoreys = new Set(frame.visibleStoreyIds);
    const isolated = frame.isolatedEntityIds === null ? null : new Set(frame.isolatedEntityIds);

    for (const stacked of stackStoreys(stackable, frame.separation)) {
      // `toMesh` đã đặt hình ở cao độ thật của tầng, nên nhóm chỉ mang phần
      // dịch THÊM do độ tách — `separation === 0` để mọi tầng nguyên chỗ.
      levelGroups.get(stacked.id)?.position.setY(stacked.spreadM);
    }

    // Một nơi duy nhất ghi `visible`, và nó đã tính cả nấc chi tiết của R-04 —
    // nên một `update()` sau khi hạ chất lượng không vô tình dựng lại những gì
    // nấc ấy vừa bỏ.
    applyDetailLevel(
      root,
      activeDetail,
      (data) =>
        visibleStoreys.has(data.levelId) &&
        !hidden.has(data.entityId) &&
        (isolated === null || isolated.has(data.entityId)),
    );

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

    const plane = frame.sectionPlane;
    renderer.clippingPlanes =
      plane === null
        ? []
        : [new Plane(new Vector3(plane.normalX, plane.normalY, plane.normalZ), plane.constant)];

    loop.setGate('motion', !frame.reducedMotion);
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
      materialOfToken(
        tokenColour(
          options.tokenOfPartKind(kind),
          new Color(FALLBACK_SURFACE_LEVEL, FALLBACK_SURFACE_LEVEL, FALLBACK_SURFACE_LEVEL),
          readToken,
        ),
      ),
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

    // Hộp bao và ước lượng bộ nhớ chỉ đổi khi có tầng mới, nên đo ở đây thay vì
    // ở mỗi lần `PerfMonitor` đọc.
    const box = new Box3().setFromObject(root);
    extent = box.isEmpty() ? UNIT_EXTENT : buildingExtent(box);
    graphicsMemoryMb = measureScene(root).graphicsMemoryMb;

    const radiusM = Math.max(extent.sizeM.x, extent.sizeM.y, extent.sizeM.z);
    keyLight.position.set(
      extent.centre.x + radiusM,
      extent.centre.y + radiusM,
      extent.centre.z + radiusM,
    );
    keyLight.target.position.copy(extent.centre);
    keyLight.target.updateMatrixWorld();
    keyLight.shadow.camera.far = radiusM * 4;
    keyLight.shadow.camera.updateProjectionMatrix();

    applyFrame(currentFrame);
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

        // Từng job một, không `enqueueAll`: đó là cách DUY NHẤT có phần trăm
        // thật (`three-contract.md` mục (a)).
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
          // Getter chứ không phải giá trị: camera đổi khi vỏ bật/tắt trực giao,
          // và `createScenePick` đọc trường này ở mỗi lần bắn tia.
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

  /* ---- Khuôn đối tượng (R-07) -------------------------------------------- */

  /**
   * Dựng một `CameraDirector` đứng đúng chỗ camera đang đứng, CÓ gốc cảnh, rồi
   * bảo nó khuôn những mã này.
   *
   * Director được dựng mới mỗi lượt thay vì giữ một cái sống suốt đời cảnh: vỏ
   * mới là bên lái camera, nên giữa hai lượt khuôn thì hộp bao, tỉ lệ khung
   * hình và điểm nhìn đều đã đổi, và một director cũ sẽ bay đi từ một chỗ mà
   * camera không còn đứng.
   */
  const frameEntities = (entityIds: readonly string[]): boolean => {
    if (disposed) {
      return false;
    }

    const { width, height } = viewport();
    const from = shellViewpointOf(currentFrame);
    const director = new CameraDirector(
      createCameraMode(cameraModeOf(currentFrame), from, { extent }),
      { extent },
      {
        root,
        aspect: aspectOf(width, height),
        reducedMotion: currentFrame.reducedMotion,
      },
    );

    if (director.frameObjects(entityIds) === null) {
      // Không vật nào mang mã ấy — cảnh có thể chưa dựng xong tầng đó. Để
      // camera yên còn hơn bay tới một hộp rỗng.
      return false;
    }

    framing = director;
    framingFrom = from;
    framingAtMs = null;
    loop.invalidate();

    return true;
  };

  /* ---- Khởi động --------------------------------------------------------- */

  applyFrame(currentFrame);
  startBuild();
  loop.invalidate();

  /* ---- Tay cầm ----------------------------------------------------------- */

  return {
    update: (frame) => {
      if (disposed) {
        return;
      }
      releaseFramingIfMoved(frame);
      currentFrame = frame;
      applyFrame(frame);
      loop.invalidate();
    },

    status: statusOf,

    frameEntities,

    frameRate: (): ViewerSceneFrameRate => ({
      averageFps: totalDurationMs > 0 ? (totalFrames * 1000) / totalDurationMs : 0,
      durationMs: totalDurationMs,
      triangleCount,
    }),

    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;

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
      // `disposeFloor` giải phóng những gì nó tìm thấy trong cây, nên hai vật
      // liệu dùng chung phải rời khỏi cây rồi mới được trả tay.
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

      sharedMaterialCache.release(selectionMaterial);
      sharedMaterialCache.release(hoverMaterial);

      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
