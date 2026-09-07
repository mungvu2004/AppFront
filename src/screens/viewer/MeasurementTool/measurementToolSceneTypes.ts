/**
 * Kiểu và hằng số của module cảnh màn `MeasurementTool`.
 *
 * Tách khỏi `measurementToolScene.ts` vì R-22 và chỉ vì R-22: file kia là thân
 * cảnh — renderer, vòng vẽ, hàng dựng — còn file này là bảng kê. Cùng một chủ,
 * cùng một lượt đọc, nên đường nhập của người gọi vẫn là
 * `measurementToolScene.ts`: nó tái xuất mọi kiểu ở đây, và không ai phải biết
 * chỗ tách này tồn tại.
 */

import { Vector3 } from 'three';

import type { ColorTokenName } from '@/lib/coloring/scales';
import type { BuildWorkerLike } from '@/lib/three/build/buildQueue';
import type { BuildFloorInput } from '@/lib/three/build/floor';
import type { BuildingExtent } from '@/lib/three/camera/modes';
import type { ViewportSize } from '@/lib/three/interaction/raycast';
import type { ResourceLedger } from '@/lib/three/perf/dispose';
import type { TokenReader } from '@/lib/three/present/palette';
import type { ViewerSceneFrame } from '@/screens/viewer/ViewerShell/viewerShellTypes';

import type { Camera, Object3D } from 'three';

/* -------------------------------------------------------------------------- */
/* Hằng số của riêng module.                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Trần khung hình của khung nhìn.
 *
 * Một TẦN SỐ, không phải một thời lượng: thang 120/180/260/340/700 ms của mục B
 * nói một chuyển động kéo dài bao lâu, con số này nói bức tranh được lấy mẫu bao
 * nhiêu lần một giây. Cùng con số mà khung nhìn 3D và màn tách tầng dùng.
 */
export const MEASURE_MAX_FPS = 60;

/** Ranh giới chọn giữa hai chế độ trực giao của R-06 — cùng lý lẽ khung nhìn 3D. */
export const ORTHOGRAPHIC_TOP_POLAR_RAD = Math.PI / 4;

/**
 * Token màu của mọi bề mặt trong cảnh đo.
 *
 * Một token cho tất cả: đo là chuyện hình học, nên cảnh không phân loại bằng
 * màu. `--wall-idle` là màu trung tính của tầng vẽ, KHÔNG phải một trong ba màu
 * trạng thái của A4 và không phải màu nhấn của A2 — đặc tả cấm đỏ và vàng, và ở
 * đây không có màu nào trong hai họ ấy có mặt.
 */
export const SURFACE_TOKEN: ColorTokenName = '--wall-idle';

/** Khoá vật liệu bề mặt trong `sharedMaterialCache`. */
export const SURFACE_MATERIAL_KEY = 'measurementTool:surface';

/** Khoá vật liệu tô đối tượng đang chọn. */
export const SELECTION_MATERIAL_KEY = 'measurementTool:selection';

/** Khoá vật liệu tô đối tượng con trỏ đang trỏ vào. */
export const HOVER_MATERIAL_KEY = 'measurementTool:hover';

/** Hộp bao dùng khi chưa có hình nào — camera vẫn phải có chỗ để đứng. */
export const UNIT_EXTENT: BuildingExtent = {
  centre: new Vector3(0, 0, 0),
  sizeM: new Vector3(1, 1, 1),
};

/** Độ sáng của hai đèn. Đủ để vật liệu Lambert đọc được khối, không hơn. */
export const SKY_LIGHT_INTENSITY = 0.9;
export const KEY_LIGHT_INTENSITY = 1.1;

/** Mức xám dự phòng khi một token màu chưa nạp được. */
export const FALLBACK_SURFACE_LEVEL = 0.72;
export const FALLBACK_ACCENT_LEVEL = 0.45;

/** Cạnh bản đồ bóng. Bóng mềm, không gắt — R-04 mới được đổi nó sang cứng. */
export const SHADOW_MAP_SIZE_PX = 1024;

/** Đèn chính đứng cách tâm bao nhiêu lần bán kính mô hình. */
export const KEY_LIGHT_DISTANCE_FACTOR = 1;

/** Bao xa thì bản đồ bóng thôi phủ tới. */
export const SHADOW_FAR_FACTOR = 4;

/* -------------------------------------------------------------------------- */
/* Renderer.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Phần tối thiểu của `WebGLRenderer` mà module cảnh dùng.
 *
 * Kê ra thay vì nhận thẳng `WebGLRenderer` để một bài kiểm dựng được bản giả mà
 * không cần một GL context nào — cùng cách `viewer3dScene.ts` và
 * `explodedViewScene.ts` mở cửa cho bài kiểm của chúng.
 */
export interface MeasurementRendererLike {
  readonly shadowMap: { type: number; enabled: boolean; autoUpdate: boolean; needsUpdate: boolean };
  clippingPlanes: unknown[];
  render(scene: Object3D, camera: Camera): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  dispose(): void;
  forceContextLoss(): void;
}

/* -------------------------------------------------------------------------- */
/* Tuỳ chọn lắp cảnh.                                                          */
/* -------------------------------------------------------------------------- */

/** Tuỳ chọn dành riêng cho bài kiểm — mọi thứ mặc định là bản thật. */
export interface MeasurementSceneInjections {
  /** Thay `new WebGLRenderer(...)`. Ném lỗi được coi là "không có WebGL". */
  readonly createRenderer?: ((canvas: HTMLCanvasElement) => MeasurementRendererLike) | undefined;
  /** Thay worker thật của R-03; `BuildQueue` nhận thẳng cái này. */
  readonly createWorker?: (() => BuildWorkerLike) | undefined;
  /** Lên lịch một khung hình; hàm hẹn khung hình của trình duyệt khi vắng mặt. */
  readonly schedule?: ((callback: (nowMs: number) => void) => number) | undefined;
  readonly cancel?: ((handle: number) => void) | undefined;
  /** Đọc giá trị token màu; đọc từ `document` khi vắng mặt. */
  readonly readToken?: TokenReader | undefined;
  /** Sổ tài nguyên để bài kiểm chứng minh `dispose()` trả hết. */
  readonly ledger?: ResourceLedger | undefined;
}

/** Mọi thứ module cảnh cần để lắp lên một canvas. */
export interface MeasurementSceneMountOptions extends MeasurementSceneInjections {
  /**
   * Một `BuildFloorInput` cho mỗi tầng — hook dựng sẵn qua `toBuildFloorInput`.
   *
   * Đây là nguồn DUY NHẤT của hình học trong cảnh, và cũng là nguồn duy nhất
   * của mã thực thể: `toMesh` gắn `userData` từ chính dữ liệu này, nên không có
   * đường nào để một mesh mang mã bịa.
   */
  readonly levels: readonly BuildFloorInput[];
  /** Điểm nhìn đầu tiên. Đổi về sau đi qua {@link MeasurementSceneHandle.update}. */
  readonly frame: ViewerSceneFrame;
  /** Tiến độ và pha dựng hình đổi. */
  readonly onStatusChange?: ((status: MeasurementSceneStatus) => void) | undefined;
}

/* -------------------------------------------------------------------------- */
/* Trạng thái và tay cầm.                                                      */
/* -------------------------------------------------------------------------- */

/** Bốn pha của một lượt dựng hình. */
export type MeasurementScenePhase = 'idle' | 'building' | 'ready' | 'failed';

/** Lượt dựng hình đang ở đâu. */
export interface MeasurementSceneStatus {
  readonly phase: MeasurementScenePhase;
  readonly settledCount: number;
  readonly totalCount: number;
  readonly failedCount: number;
  readonly readyLevelIds: readonly string[];
}

/**
 * Tay cầm caller giữ.
 *
 * Ba trường đầu là đúng ba thứ `ScenePickOptions` đòi
 * (`lib/three/interaction/raycast.ts:168-180`), cùng tên và cùng hình dạng, nên
 * hook chuyền thẳng chúng vào `createScenePick` mà không phải bọc lại gì:
 *
 * ```ts
 * const pick = createScenePick({ camera: handle.camera, root: handle.root, viewport: handle.viewport });
 * ```
 */
export interface MeasurementSceneHandle {
  /** Camera bắn tia đi qua. Một tham chiếu, đứng yên cả đời của cảnh. */
  readonly camera: Camera;
  /** Gốc cây cảnh — `Raycaster.intersectObject(root, true)` dò từ đây. */
  readonly root: Object3D;
  /** Kích thước khung nhìn hiện tại, tính bằng pixel. */
  readonly viewport: () => ViewportSize;
  /** Vỏ vừa đổi điểm nhìn / tầng / chọn / mặt cắt. */
  readonly update: (frame: ViewerSceneFrame) => void;
  /** Trạng thái dựng ngay lúc này. */
  readonly status: () => MeasurementSceneStatus;
  /**
   * Cảnh đang đứng yên, tức vòng vẽ không tick và mỗi khung hình chỉ được vẽ khi
   * có thứ đổi. Luôn `true` ở cảnh này — xem "Vòng vẽ theo nhu cầu".
   */
  readonly isResting: () => boolean;
  /** R-05: trả geometry, material và cả GL context. An toàn gọi hai lần. */
  readonly dispose: () => void;
}

/**
 * Kết quả lắp cảnh.
 *
 * Không có WebGL KHÔNG ném lỗi và không mang mã lỗi: nó là một nhánh hợp lệ mà
 * hook đọc được để bật trạng thái lỗi với một câu tiếng Việt bình thường.
 */
export type MeasurementSceneMount =
  | { readonly ok: true; readonly handle: MeasurementSceneHandle }
  | { readonly ok: false; readonly reason: 'webglUnavailable' };

/** Chữ ký của `mountMeasurementScene`, để hook tiêm được bản giả khi test. */
export type MountMeasurementScene = (
  canvas: HTMLCanvasElement,
  options: MeasurementSceneMountOptions,
) => MeasurementSceneMount;
