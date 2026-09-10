/**
 * Cảnh 3D của màn `/m/du-an/:projectId` — xem **chỉ đọc** trên điện thoại.
 *
 * Cùng khuôn `screens/viewer/Viewer3D/viewer3dScene.ts`: một module cảnh sống
 * trong thư mục màn, sở hữu renderer, và test được không cần dựng cây React.
 * Ba chỗ khác nó, và cả ba đều do đặc tả S-45 bắt:
 *
 * ## 1. Mức gọn dựng TRƯỚC, rồi mới nâng dần
 *
 * `Viewer3D` dựng full-detail qua `BuildQueue` (worker) rồi chỉ ẨN bớt loại bộ
 * phận khi R-04 hạ mức. Khuôn ấy không bao giờ có một hình **gọn** ở khung đầu
 * tiên: số tam giác luôn là số của mức đầy đủ, chỉ có phần được vẽ là ít đi.
 * Đặc tả di động đòi thứ khác — thấy khối nhà ngay, chi tiết đến sau — nên
 * module này đi đường còn lại mà khảo sát đã liệt kê: `buildFloorAtDetail(input,
 * 'block')` dựng thẳng một mức gọn, và một lượt nâng mức là một lượt **dựng
 * lại** ở mức mịn hơn (không có gì tái dùng được từ mức thô; khảo sát mục (b)
 * nói rõ điều đó).
 *
 * Cái giá đã biết và đã chấp nhận: hình dựng trên luồng chính. Mức `'block'` bỏ
 * cả ô mở lẫn trần nên nó là mức rẻ nhất có thể, và mỗi bậc nâng đi qua một lượt
 * `schedule` riêng để khung đầu tiên không phải đợi mức đầy đủ.
 *
 * ## 2. Ngân sách R-04 là ngưỡng DUY NHẤT, và nó đọc từ `SCENE_BUDGET`
 *
 * `PerfMonitor` với `profile: 'mobile'` — truyền tường minh, không gọi
 * `detectDeviceProfile()`: route này LÀ màn di động theo đường dẫn, không theo
 * phát hiện thiết bị, và một máy tính bảng giả lập `pointer: fine` sẽ bị đo bằng
 * sàn của máy tính nếu để nó tự đoán. Không một con số fps nào viết trong file
 * này; `DEGRADE_FRAME_RATE` của R-04 đọc thẳng `SCENE_BUDGET.minFrameRate.mobile`.
 *
 * Một lần hạ mức làm hai việc và cả hai đều được thi hành: bóng đổ chuyển sang
 * bộ lọc rẻ, và mức chi tiết tụt một bậc qua {@link coarserDetail}. Sau khi thi
 * hành xong, bộ đếm của monitor được nạp lại để một lần tụt NỮA còn hạ tiếp
 * được — `PerfMonitor` chỉ bắn `onDegrade` một lần cho mỗi phiên sống của nó.
 * Nạp lại KHÔNG bao giờ nâng mức trở lại: `activeDetail` sau lần hạ đầu tiên chỉ
 * còn đi một chiều.
 *
 * ## 3. Cử chỉ đa chạm, và không một phép toán camera nào của riêng mình
 *
 * `mobileViewerGestures.ts` đọc ngón tay và phát ra {@link MobileViewerGesture};
 * file này dịch bốn cử chỉ ấy sang bốn lời gọi có sẵn:
 *
 * | Cử chỉ | Gọi |
 * |---|---|
 * | `orbit` | `OrbitCameraMode.rotate(deltaXPx, deltaYPx)` |
 * | `pan`   | `OrbitCameraMode.pan(deltaXPx, deltaYPx, viewportHeightPx)` |
 * | `zoom`  | `OrbitCameraMode.dolly(notches)` |
 * | `tap`   | `PickAt` của `createScenePick` (R-09) |
 *
 * Ba hàm camera nhận **pixel thô** và tự lo giảm chấn, giới hạn, quy đổi. Phép
 * duy nhất file này làm là {@link notchesForScale} — đổi tỉ lệ khoảng cách hai
 * ngón thành số nấc — và nó nằm ở đây chứ không nằm trong bộ nhận cử chỉ vì
 * "nấc" là đơn vị của camera, đọc từ `CAMERA_SETTINGS.orbit.zoomFactorPerNotch`.
 *
 * `createPointerPicker` **không** được dùng: nó không giữ `pointerId` nào, nên
 * đẩy hai ngón vào nó sẽ làm hỏng trạng thái một-cú-nhấn nội bộ của nó (khảo sát
 * mục (e)). Cử chỉ `tap` đã tự phân biệt chạm với kéo bằng đúng `CLICK_SLOP_PX`
 * mà bộ chọn ấy dùng, nên nó gọi thẳng `PickAt` — hàm này tự gọi `resolveHit`.
 *
 * ## Vẽ khi nào
 *
 * Vòng vẽ theo nhu cầu, vì màn này chạy bằng pin. `CameraModeController.update`
 * trả `false` khi giảm chấn đã dừng hẳn, và lúc ấy cổng `motion` của
 * `createFrameLoop` đóng lại — không còn `requestAnimationFrame` nào. Một cử chỉ
 * mới, một lần đổi tầng, một lần hạ mức đều mở cổng lại.
 */

import {
  Box3,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  type Material,
} from 'three';

import type { MeasurePoint } from '@/domain/measure/measure';
import { metres, metresToMillimetres } from '@/domain/units/types';
import type { ColorTokenName } from '@/lib/coloring/scales';
import type { BuildFloorInput } from '@/lib/three/build/floor';
import { buildFloorAtDetail, DETAIL_LEVELS, type DetailLevel } from '@/lib/three/build/lod';
import type { BuildPartKind } from '@/lib/three/build/scene';
import {
  buildingExtent,
  createCameraMode,
  initialViewpoint,
  type BuildingExtent,
  type CameraModeController,
} from '@/lib/three/camera/modes';
import { CAMERA_SETTINGS } from '@/lib/three/camera/settings';
import type { EntityHit } from '@/lib/three/interaction/hitTest';
import { createScenePick } from '@/lib/three/interaction/raycast';
import { checkBudget, measureScene, readRenderInfo } from '@/lib/three/perf/budget';
import { disposeFloor } from '@/lib/three/perf/dispose';
import { paintByPartKind, sharedMaterialCache } from '@/lib/three/perf/materialCache';
import { coarserDetail, PerfMonitor, shadowMapTypeFor } from '@/lib/three/perf/monitor';
import { createFrameLoop } from '@/lib/three/present/frameLoop';
import { documentTokenReader, tokenColour, type TokenReader } from '@/lib/three/present/palette';

import { attachMobileViewerGestures } from './mobileViewerGestures';
import {
  MOBILE_VIEWER_MODEL_TOKEN,
  type MobileViewerGesture,
  type MobileViewerSceneHandle,
  type MobileViewerSceneMount,
  type MobileViewerSceneOptions,
} from './mobileViewerTypes';

/* -------------------------------------------------------------------------- */
/* Hằng số riêng của cảnh này.                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Trần khung hình. Một TẦN SỐ, không phải một thời lượng chuyển động — đúng phân
 * biệt mà `MAX_SWAY_FPS` của `frameLoop.ts` đã đặt ra, nên mục B không áp vào nó.
 *
 * Không đọc từ `SCENE_BUDGET`: ở đó `minFrameRate` là SÀN mà dưới nó R-04 hạ
 * chất lượng, còn đây là TRẦN mà trên nó vẽ thêm không ai thấy. Lấy sàn làm trần
 * thì cảnh chạy đúng ở ngưỡng hạ mức và R-04 sẽ hạ mức suốt ngày.
 */
const MOBILE_VIEWER_MAX_FPS = 60;

/** Hộp bao dùng khi chưa có hình nào — camera vẫn phải có chỗ để đứng. */
const UNIT_EXTENT: BuildingExtent = {
  centre: new Vector3(0, 0, 0),
  sizeM: new Vector3(1, 1, 1),
};

/** Độ sáng của hai đèn. Cùng ngân sách đèn với `Viewer3D`: hai, không hơn. */
const SKY_LIGHT_INTENSITY = 0.9;
const KEY_LIGHT_INTENSITY = 1.1;

/**
 * Cạnh bản đồ bóng, px.
 *
 * Nửa cạnh mà `Viewer3D` dùng: một phần tư số điểm ảnh của depth pass, trên một
 * máy có ngân sách bộ nhớ đồ hoạ nhỏ hơn hẳn và một màn hình nhỏ hơn hẳn.
 */
const SHADOW_MAP_SIZE_PX = 512;

/** Mức xám dự phòng khi một token màu chưa nạp được. */
const FALLBACK_SURFACE_LEVEL = 0.72;

/**
 * Một giây, tính bằng mili-giây.
 *
 * `CameraModeController.update` nhận GIÂY còn mọi đồng hồ ở đây trả mili-giây.
 * Tên cố ý không mang `_PER_`: `local/no-raw-number` đọc mọi ước số tên `*_PER_*`
 * là một phép quy đổi ĐƠN VỊ ĐO — thứ thuộc về `src/domain` — và đây là thời
 * gian của một vòng vẽ, không phải số đo của mô hình.
 */
const SECOND_IN_MS = 1000;

/* -------------------------------------------------------------------------- */
/* Kiểu công khai.                                                             */
/* -------------------------------------------------------------------------- */

/** Renderer mà cảnh cần đến — bài kiểm cấp một bản giả thay cho `WebGLRenderer`. */
export interface MobileViewerRendererLike {
  readonly info: { readonly render: { readonly calls: number; readonly triangles: number } };
  readonly shadowMap: { type: number; enabled: boolean; autoUpdate: boolean; needsUpdate: boolean };
  setSize(width: number, height: number, updateStyle?: boolean): void;
  render(scene: unknown, camera: unknown): void;
  dispose(): void;
  forceContextLoss(): void;
}

/**
 * Các chỗ tiêm cho bài kiểm. **Mọi trường ở đây đều tuỳ chọn**, nên một lời gọi
 * dùng đúng `MobileViewerSceneOptions` của hợp đồng vẫn hợp lệ.
 *
 * > **`levels` và `tokenOfPartKind` từng đứng ở đây, và nay đã về hợp đồng.**
 * > Mục 4 của `mobileViewerTypes.ts` bản đầu chỉ cấp `floorIds` — mã tầng, không
 * > phải hình — nên file này bù bằng hai trường TUỲ CHỌN để ba mảnh song song
 * > còn lại không phải sửa giữa chừng. Lớp gộp đã kéo cả hai về mục 4: `levels`
 * > thành trường **bắt buộc** (thiếu nó là một mô hình rỗng), `tokenOfPartKind`
 * > ở lại dạng tuỳ chọn với mặc định có tên. Không còn hai nguồn cho cùng một
 * > hình dạng.
 */
export interface MobileViewerSceneInjections {
  /** Thay `new WebGLRenderer(...)`. Ném lỗi được coi là "không có WebGL". */
  readonly createRenderer?: ((canvas: HTMLCanvasElement) => MobileViewerRendererLike) | undefined;
  /** Lên lịch một khung hình; `requestAnimationFrame` khi vắng mặt. */
  readonly schedule?: ((callback: (nowMs: number) => void) => number) | undefined;
  readonly cancel?: ((handle: number) => void) | undefined;
  /** Đồng hồ của `PerfMonitor` và của giảm chấn camera; `performance.now` khi vắng. */
  readonly now?: (() => number) | undefined;
  /** Đọc giá trị token màu; đọc từ `document` khi vắng mặt. */
  readonly readToken?: TokenReader | undefined;
}

/** Tuỳ chọn thật của {@link mountMobileViewerScene}. */
export interface MobileViewerSceneMountOptions
  extends MobileViewerSceneOptions,
    MobileViewerSceneInjections {}

/* -------------------------------------------------------------------------- */
/* Hàm thuần.                                                                  */
/* -------------------------------------------------------------------------- */

/** Bậc mịn hơn liền kề, hoặc chính nó khi đã ở bậc mịn nhất. */
export function finerDetail(detail: DetailLevel): DetailLevel {
  const index = DETAIL_LEVELS.indexOf(detail);

  return index <= 0 ? detail : (DETAIL_LEVELS[index - 1] ?? detail);
}

/**
 * Tỉ lệ khoảng cách hai ngón → số nấc mà `OrbitCameraMode.dolly` nhận.
 *
 * `dolly` NHÂN khoảng cách camera với `zoomFactorPerNotch ^ notches`, nên phép
 * đảo của nó là một lô-ga-rít cơ số ấy — liên tục, không giật cấp: bóp đi một
 * nửa cho ra cùng một lượng dù nửa ấy đi qua một sự kiện hay hai mươi.
 *
 * Dấu âm là vì hai đại lượng đi ngược chiều nhau: hai ngón **tách ra** (`scale`
 * lớn hơn 1) là phóng TO, mà phóng to nghĩa là camera lại GẦN, tức khoảng cách
 * nhỏ đi.
 *
 * @returns 0 khi tỉ lệ không phải một số dương hữu hạn — một cử chỉ đọc sai
 * không được phép ném camera đi đâu cả.
 */
export function notchesForScale(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) {
    return 0;
  }

  return -Math.log(scale) / Math.log(CAMERA_SETTINGS.orbit.zoomFactorPerNotch);
}

/** Renderer thật. Ném lỗi khi máy không cấp được WebGL — caller bắt, không để lọt. */
function createDefaultRenderer(canvas: HTMLCanvasElement): MobileViewerRendererLike {
  // `antialias: false` là lựa chọn của màn di động: khử răng cưa nhân số điểm ảnh
  // phải tô lên, và đây là màn phải giữ 30fps trên máy yếu nhất còn mở được nó.
  return new WebGLRenderer({ canvas, antialias: false, alpha: false });
}

/** Tỉ lệ khung nhìn; 1 khi canvas chưa có kích thước nào để đo. */
function aspectOf(width: number, height: number): number {
  return width > 0 && height > 0 ? width / height : 1;
}

/**
 * Ba lời gọi camera mà chế độ quỹ đạo cấp.
 *
 * `CameraModeController` không khai chúng — mỗi chế độ có bộ điều khiển riêng —
 * nên cùng phép thu hẹp mà `useViewerShell.ts:735-788` đã dùng được lặp lại ở đây.
 */
interface OrbitControls {
  rotate: (deltaXPx: number, deltaYPx: number) => void;
  pan: (deltaXPx: number, deltaYPx: number, viewportHeightPx: number) => void;
  dolly: (notches: number) => void;
}

function orbitControlsOf(controller: CameraModeController): OrbitControls | null {
  return 'rotate' in controller && 'pan' in controller && 'dolly' in controller
    ? (controller as unknown as OrbitControls)
    : null;
}

/* -------------------------------------------------------------------------- */
/* Cửa vào.                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Lắp cảnh lên một canvas và trả về tay cầm để đổi tầng, đo, và dọn.
 *
 * @example
 * const mount = mountMobileViewerScene(canvas, {
 *   floorIds, initialDetail: 'block', onPick, onDetailChange, onFrameRate, levels,
 * });
 * if (!mount.ok) {
 *   // 'webglUnavailable' hoặc 'deviceTooWeak' — cả hai là nhánh HỢP LỆ, hook
 *   // hiện một câu tiếng Việt và mời sang bản 2D. Không mã lỗi, không ném.
 * }
 */
export function mountMobileViewerScene(
  canvas: HTMLCanvasElement,
  options: MobileViewerSceneMountOptions,
): MobileViewerSceneMount {
  let renderer: MobileViewerRendererLike;

  try {
    renderer = (options.createRenderer ?? createDefaultRenderer)(canvas);
  } catch {
    // Không có WebGL là một nhánh hợp lệ, không phải một sự cố.
    return { ok: false, reason: 'webglUnavailable' };
  }

  return startScene(canvas, renderer, options);
}

/* -------------------------------------------------------------------------- */
/* Thân cảnh.                                                                  */
/* -------------------------------------------------------------------------- */

function startScene(
  canvas: HTMLCanvasElement,
  renderer: MobileViewerRendererLike,
  options: MobileViewerSceneMountOptions,
): MobileViewerSceneMount {
  const readToken: TokenReader = options.readToken ?? documentTokenReader();
  const now = options.now ?? ((): number => performance.now());
  const schedule =
    options.schedule ?? ((callback: (nowMs: number) => void): number => globalThis.requestAnimationFrame(callback));
  const cancel =
    options.cancel ??
    ((handle: number): void => {
      globalThis.cancelAnimationFrame(handle);
    });

  const tokenOfPartKind =
    options.tokenOfPartKind ?? ((): ColorTokenName => MOBILE_VIEWER_MODEL_TOKEN);
  const levelsById = new Map<string, BuildFloorInput>(
    options.levels.map((input) => [input.level.id, input]),
  );

  /* ---- Cảnh, đèn, camera ------------------------------------------------- */

  const scene = new Scene();
  const root = new Group();
  scene.add(root);

  const fallbackSurface = new Color(
    FALLBACK_SURFACE_LEVEL,
    FALLBACK_SURFACE_LEVEL,
    FALLBACK_SURFACE_LEVEL,
  );
  const white = tokenColour('--white', new Color(1, 1, 1), readToken);
  const ground = tokenColour('--canvas-3d-ground', fallbackSurface, readToken);
  scene.background = tokenColour('--canvas-3d', fallbackSurface, readToken);

  const skyLight = new HemisphereLight(white, ground, SKY_LIGHT_INTENSITY);
  const keyLight = new DirectionalLight(white, KEY_LIGHT_INTENSITY);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(SHADOW_MAP_SIZE_PX, SHADOW_MAP_SIZE_PX);
  scene.add(skyLight, keyLight);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = shadowMapTypeFor('soft');
  // Bản đồ bóng TĨNH: vẽ lại khi mô hình đổi, không phải mỗi khung hình.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  const camera = new PerspectiveCamera(
    CAMERA_SETTINGS.shared.fieldOfViewDeg,
    1,
    CAMERA_SETTINGS.shared.nearM,
    CAMERA_SETTINGS.shared.minFarM,
  );

  /* ---- Trạng thái sống --------------------------------------------------- */

  const groups = new Map<string, Group>();
  let activeDetail: DetailLevel = options.initialDetail;
  let activeFloorId: string | null = null;
  let extent: BuildingExtent = UNIT_EXTENT;
  let graphicsMemoryMb = 0;
  let lastWidthPx = 0;
  let lastHeightPx = 0;
  let lastFrameAtMs: number | null = null;
  let disposed = false;
  /** Đã hạ mức một lần rồi thì thôi nâng, mãi mãi. */
  let degraded = false;

  const viewport = (): { width: number; height: number } => ({
    width: canvas.clientWidth > 0 ? canvas.clientWidth : canvas.width,
    height: canvas.clientHeight > 0 ? canvas.clientHeight : canvas.height,
  });

  /* ---- Dựng hình --------------------------------------------------------- */

  const isFloorVisible = (floorId: string): boolean =>
    activeFloorId === null || activeFloorId === floorId;

  const buildFloor = (floorId: string, detail: DetailLevel): Group | null => {
    const input = levelsById.get(floorId);
    if (input === undefined) {
      return null;
    }

    const group = buildFloorAtDetail(input, detail);
    paintByPartKind(
      group,
      sharedMaterialCache,
      (kind: BuildPartKind): Material =>
        new MeshLambertMaterial({
          color: tokenColour(tokenOfPartKind(kind), fallbackSurface, readToken),
        }),
    );

    group.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    group.visible = isFloorVisible(floorId);

    return group;
  };

  /** Đo lại hộp bao, ngân sách bộ nhớ và chỗ đứng của đèn sau một lượt dựng. */
  const remeasure = (): void => {
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
  };

  /** Dựng lại MỌI tầng ở một mức khác, và trả lại hình của mức cũ. */
  const rebuildAt = (detail: DetailLevel): void => {
    for (const floorId of [...groups.keys()]) {
      const previous = groups.get(floorId);
      if (previous !== undefined) {
        root.remove(previous);
        disposeFloor(previous, { materials: sharedMaterialCache });
      }

      const next = buildFloor(floorId, detail);
      if (next === null) {
        groups.delete(floorId);
        continue;
      }

      groups.set(floorId, next);
      root.add(next);
    }

    activeDetail = detail;
    remeasure();
    renderer.shadowMap.needsUpdate = true;
  };

  for (const floorId of options.floorIds) {
    const group = buildFloor(floorId, activeDetail);
    if (group !== null) {
      groups.set(floorId, group);
      root.add(group);
    }
  }
  remeasure();

  /* ---- Máy yếu: ngân sách không đạt ngay cả ở mức thô nhất ---------------- */

  /** Vi phạm ngân sách TĨNH — số vẽ, tam giác, vật liệu, bộ nhớ; chưa có fps nào để đo. */
  const staticBreaches = (): number =>
    checkBudget(measureScene(root), 'mobile').filter((warning) => warning.metric !== 'frameRate')
      .length;

  const coarsestDetail = DETAIL_LEVELS.at(-1) ?? activeDetail;

  if (staticBreaches() > 0 && activeDetail !== coarsestDetail) {
    // Còn một bậc thô hơn để thử trước khi bỏ cuộc.
    rebuildAt(coarsestDetail);
  }

  if (staticBreaches() > 0) {
    for (const group of groups.values()) {
      disposeFloor(group, { materials: sharedMaterialCache });
    }
    groups.clear();
    renderer.dispose();
    renderer.forceContextLoss();

    return { ok: false, reason: 'deviceTooWeak' };
  }

  /* ---- Camera ------------------------------------------------------------ */

  const controller = createCameraMode('orbit', initialViewpoint(extent), { extent });
  const orbit = orbitControlsOf(controller);

  // Đặt camera vào chỗ NGAY, đừng đợi khung hình đầu tiên: một cú chạm tới trước
  // lượt vẽ đầu sẽ bắn tia từ một camera còn nằm ở gốc toạ độ, và trúng nhầm.
  const firstViewport = viewport();
  controller.applyTo(camera, aspectOf(firstViewport.width, firstViewport.height));

  /* ---- Vòng vẽ theo nhu cầu ---------------------------------------------- */

  /**
   * Cổng `motion` không được đóng NGAY TRONG lượt vẽ: `frameLoop.ts` lên lịch
   * tick kế tiếp SAU khi `render` trả về, nên một lệnh dừng phát ra giữa chừng
   * sẽ bị chính lượt tick ấy dựng dậy. Đóng nó ở lượt `schedule` liền sau thì
   * `stop()` huỷ đúng cái tick vừa được đặt.
   */
  let parkHandle: number | null = null;

  const parkLoop = (): void => {
    if (parkHandle !== null || disposed) {
      return;
    }

    parkHandle = schedule(() => {
      parkHandle = null;
      if (!disposed) {
        loop.setGate('motion', false);
      }
    });
  };

  const wake = (): void => {
    if (disposed) {
      return;
    }

    loop.setGate('motion', true);
    loop.invalidate();
  };

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

    const nowMs = now();
    const dtSeconds = lastFrameAtMs === null ? 0 : (nowMs - lastFrameAtMs) / SECOND_IN_MS;
    lastFrameAtMs = nowMs;

    const moving = controller.update(dtSeconds);
    controller.applyTo(camera, aspectOf(width, height));
    renderer.render(scene, camera);
    // Đúng một lần mỗi khung hình, SAU khi vẽ xong — R-04 không có API nào khác
    // để đo, và gọi trước lượt vẽ là đếm một khung chưa tồn tại.
    monitor.frame();

    if (!moving) {
      parkLoop();
    }
  };

  /* ---- Hiệu năng: R-04 quyết, module thi hành ---------------------------- */

  const monitor = new PerfMonitor({
    read: () => readRenderInfo(renderer.info, graphicsMemoryMb),
    // Tường minh, không `detectDeviceProfile()`: route quyết định, không phải thiết bị.
    profile: 'mobile',
    detail: options.initialDetail,
    onSample: (sample) => {
      options.onFrameRate(sample.frameRate);
    },
    onDegrade: (action) => {
      degraded = true;
      if (upgradeHandle !== null) {
        cancel(upgradeHandle);
        upgradeHandle = null;
      }

      // Cả hai vế của quyết định, không vế nào bị bỏ lại.
      renderer.shadowMap.type = shadowMapTypeFor(action.shadows);

      const next = coarserDetail(activeDetail);
      if (next !== activeDetail) {
        rebuildAt(next);
        options.onDetailChange(next);
      }

      // Nạp lại bộ đếm để một lần tụt NỮA còn hạ tiếp được: `PerfMonitor` chặn
      // lần bắn thứ hai cho cả phiên sống của nó. Đây KHÔNG phải một lượt thử
      // nâng mức trở lại — `degraded` đã khoá đường nâng vĩnh viễn.
      monitor.reset();
      wake();
    },
    ...(options.now !== undefined ? { now: options.now } : {}),
  });

  const loop = createFrameLoop({
    // Không có chuyển động tự thân: hướng nhìn đến từ giảm chấn của camera, nên
    // hướng của loop là hằng và mỗi tick đều đáng vẽ (minStep 0).
    headingAt: () => 0,
    restingHeading: 0,
    minStep: () => 0,
    render: renderOnce,
    maxFps: MOBILE_VIEWER_MAX_FPS,
    ...(options.schedule !== undefined ? { schedule: options.schedule } : {}),
    ...(options.cancel !== undefined ? { cancel: options.cancel } : {}),
  });

  /* ---- Mức gọn trước, rồi nâng dần --------------------------------------- */

  let upgradeHandle: number | null = null;

  const scheduleUpgrade = (): void => {
    if (disposed || degraded || upgradeHandle !== null) {
      return;
    }

    const next = finerDetail(activeDetail);
    if (next === activeDetail) {
      return;
    }

    // Mỗi bậc đi qua một lượt `schedule` riêng: dựng lại cả mô hình là việc của
    // luồng chính, và làm cả hai bậc trong một lượt là đóng băng màn hình hai lần.
    upgradeHandle = schedule(() => {
      upgradeHandle = null;
      if (disposed || degraded) {
        return;
      }

      rebuildAt(next);
      options.onDetailChange(next);
      wake();
      scheduleUpgrade();
    });
  };

  /* ---- Bắn tia theo chạm (R-09) ------------------------------------------ */

  const scenePick = createScenePick({ camera, root, viewport });

  /**
   * Bắn tia qua một điểm trên mặt kính.
   *
   * `Raycaster` đọc `matrixWorld`, và ma trận ấy chỉ được cập nhật bên trong một
   * lượt vẽ thật của `WebGLRenderer`. Một cú chạm có thể tới TRƯỚC khung hình đầu
   * tiên, nên hai lời gọi dưới đây là điều kiện để cú chạm ấy trúng chứ không
   * phải một phép phòng xa: three.js bỏ qua chúng ngay khi không có gì đổi.
   */
  const pickAt = (xPx: number, yPx: number): EntityHit | null => {
    camera.updateMatrixWorld();
    scene.updateMatrixWorld();

    return scenePick({ x: xPx, y: yPx });
  };

  const onGesture = (gesture: MobileViewerGesture): void => {
    if (disposed) {
      return;
    }

    if (gesture.kind === 'tap') {
      options.onPick(pickAt(gesture.xPx, gesture.yPx));
      return;
    }

    if (orbit === null) {
      return;
    }

    switch (gesture.kind) {
      case 'orbit':
        orbit.rotate(gesture.deltaXPx, gesture.deltaYPx);
        break;
      case 'pan':
        orbit.pan(gesture.deltaXPx, gesture.deltaYPx, viewport().height);
        break;
      case 'zoom':
        orbit.dolly(notchesForScale(gesture.scale));
        break;
    }

    wake();
  };

  const detachGestures = attachMobileViewerGestures(canvas, { onGesture });

  /* ---- Cổng của vòng vẽ -------------------------------------------------- */

  const onVisibility = (): void => {
    loop.setGate('visible', !document.hidden);
  };
  document.addEventListener('visibilitychange', onVisibility);

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

  wake();
  scheduleUpgrade();

  /* ---- Tay cầm ----------------------------------------------------------- */

  const handle: MobileViewerSceneHandle = {
    setActiveFloor: (floorId) => {
      if (disposed) {
        return;
      }

      activeFloorId = floorId;
      for (const [id, group] of groups) {
        group.visible = isFloorVisible(id);
      }
      // Tập vật đổ bóng vừa đổi.
      renderer.shadowMap.needsUpdate = true;
      wake();
    },

    currentDetail: () => activeDetail,

    /**
     * Điểm đo trên bề mặt, cho M-15.
     *
     * Chỉ đổi trục và đổi đơn vị: `scenePoint` của R-01 đặt `plan.x → x`, cao độ
     * → `y`, `plan.y → z`, nên đường về phải đảo đúng hai trục ấy. KHÔNG tính
     * khoảng cách nào — đó là việc của `src/domain/measure`.
     */
    pickMeasurePoint: (xPx, yPx): MeasurePoint | null => {
      if (disposed) {
        return null;
      }

      const hit = pickAt(xPx, yPx);
      if (hit === null) {
        return null;
      }

      return {
        x: metresToMillimetres(metres(hit.point.x)),
        y: metresToMillimetres(metres(hit.point.z)),
        z: metresToMillimetres(metres(hit.point.y)),
      };
    },

    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;

      if (upgradeHandle !== null) {
        cancel(upgradeHandle);
        upgradeHandle = null;
      }
      if (parkHandle !== null) {
        cancel(parkHandle);
        parkHandle = null;
      }

      loop.dispose();
      detachGestures();
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();

      for (const group of groups.values()) {
        disposeFloor(group, { materials: sharedMaterialCache });
      }
      groups.clear();

      renderer.dispose();
      renderer.forceContextLoss();
    },
  };

  return { ok: true, handle };
}
