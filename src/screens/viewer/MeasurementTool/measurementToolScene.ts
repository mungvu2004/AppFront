/**
 * Cảnh 3D của màn `MeasurementTool`: một canvas, một renderer, và **bề mặt thật
 * để bắn tia vào**.
 *
 * Cùng khuôn `ExplodedView/explodedViewScene.ts` — một module cảnh sống trong
 * thư mục màn, sở hữu renderer, và test được không cần dựng cây React. Vỏ chung
 * `ViewerShell` KHÔNG tạo renderer nào; cảnh 3D là một khe cắm và màn nội dung
 * tự vẽ.
 *
 * File này là cửa vào và vòng đời. Ba file anh em giữ phần còn lại, tách theo
 * trách nhiệm chứ không theo độ dài: `measurementToolSceneTypes.ts` là bảng kê,
 * `measurementToolSceneStage.ts` là cây cảnh + camera + đèn + vật liệu, và
 * `measurementToolSceneBuild.ts` là hàng dựng hình. Người gọi chỉ cần file này:
 * nó tái xuất mọi kiểu.
 *
 * ## Cảnh này KHÔNG đo gì cả
 *
 * Không một phép trừ toạ độ, không một lượt quy đổi đơn vị, không một chuỗi số
 * nào ra khỏi thư mục này. Đo là việc của `src/domain/measure`, định dạng là
 * việc của `src/lib/format`, và cả hai được hook gọi. Việc của cảnh là dựng một
 * cây có bề mặt rồi phơi ra đúng ba thứ `createScenePick` đòi — `camera`,
 * `root`, `viewport` (`lib/three/interaction/raycast.ts:168-180`) — để hook bắn
 * tia lấy `EntityHit`. Số đo cũng KHÔNG được ghi ngược vào mô hình: cảnh không
 * giữ một tham chiếu ghi nào tới `src/store`, và `update(frame)` là đường một
 * chiều.
 *
 * ## Vì sao phải là mặt, không phải đường kẻ
 *
 * `EntityHit.normal` (`hitTest.ts:104-113`) là `null` khi tia không trả về pháp
 * tuyến, và `worldNormalOf` (`hitTest.ts:180-195`) chỉ có cái để đổi khi hình
 * học mang thuộc tính `normal` — `Mesh.raycast` của three điền
 * `intersection.normal` đúng lúc ấy. Một cảnh toàn `Line` hay `Sprite` không có
 * mặt nào để lấy pháp tuyến, nên chế độ "vuông góc với bề mặt" mất hẳn mặt
 * phẳng để đo tới. Nên hình học ở đây đi qua đúng đường mà chín màn 3D đang đi:
 * `BuildQueue` → `toMesh` → `toGeometry`, và `toGeometry` đặt cả ba thuộc tính
 * `position`, `normal`, `uv` (`build/buildQueue.ts:176-188`).
 *
 * **Không một `BufferGeometry` nào sinh ra trong thư mục này**, cùng lý do
 * `explodedViewScene.ts` không sinh: hình học là việc của worker R-03.
 *
 * ## Quy ước `userData` — đọc chứ không đoán
 *
 * Cảnh này không gộp mesh, nên `resolveHit` không có bảng gộp để tra và rơi về
 * `readPartData(intersection.object)` (`hitTest.ts:216-218`); `readPartData`
 * đòi đúng ba trường `{ kind, entityId, levelId }` (`build/scene.ts:96-140`).
 * `tagPart` là đường DUY NHẤT gắn chúng, và `toMesh` gọi `tagPart` cho mọi mesh
 * nó dựng (`buildQueue.ts:200-214`) — nên cảnh này không tự viết một chữ nào
 * vào `userData`. Sau đó `resolveHit` còn đòi `selectableKindOf(entityId)` khác
 * `null` (`hitTest.ts:244-250`), tức mã thực thể phải mang tiền tố hợp lệ của
 * `src/domain/spatial/ids.ts:119-127`; mã ấy đến từ chính mô hình, không phải
 * từ đây.
 *
 * ## Vòng vẽ theo nhu cầu
 *
 * Cảnh này không có chuyển động tự thân nào: hướng nhìn đến từ vỏ, còn đường đo
 * là pixel do overlay vẽ. Nên cổng `motion` của `createFrameLoop` đóng ngay từ
 * đầu và không mở lại lần nào — vòng vẽ không tick, và mỗi khung hình được vẽ
 * là vì một thứ đã đổi (`update`, một tầng vừa dựng xong, hoặc canvas vừa đổi
 * cỡ) đã gọi `invalidate()`. `frame.reducedMotion` vì thế không có chuyển động
 * nào để tắt: cảnh đã ở trạng thái nghỉ cho MỌI người dùng, và tay cầm nói ra
 * điều đó qua `isResting()`. Ba cổng còn lại — tab ẩn, canvas ra khỏi màn, cửa
 * sổ mất focus — vẫn đóng vòng vẽ như ở chín màn kia.
 */

import { Box3, Mesh, Plane, Vector3, WebGLRenderer, type Group } from 'three';

import { readPartData, type PartUserData } from '@/lib/three/build/scene';
import { buildingExtent, type BuildingExtent } from '@/lib/three/camera/modes';
import type { ViewportSize } from '@/lib/three/interaction/raycast';
import { disposeFloor, ResourceLedger } from '@/lib/three/perf/dispose';
import { sharedMaterialCache } from '@/lib/three/perf/materialCache';
import { shadowMapTypeFor } from '@/lib/three/perf/monitor';
import { createFrameLoop } from '@/lib/three/present/frameLoop';
import { documentTokenReader, type TokenReader } from '@/lib/three/present/palette';
import type { ViewerSceneFrame } from '@/screens/viewer/ViewerShell/viewerShellTypes';

import { startSceneBuild, type SceneBuild } from './measurementToolSceneBuild';
import { createStage } from './measurementToolSceneStage';
import {
  MEASURE_MAX_FPS,
  UNIT_EXTENT,
  type MeasurementRendererLike,
  type MeasurementSceneHandle,
  type MeasurementSceneMount,
  type MeasurementSceneMountOptions,
} from './measurementToolSceneTypes';

export type {
  MeasurementRendererLike,
  MeasurementSceneHandle,
  MeasurementSceneInjections,
  MeasurementSceneMount,
  MeasurementSceneMountOptions,
  MeasurementScenePhase,
  MeasurementSceneStatus,
  MountMeasurementScene,
} from './measurementToolSceneTypes';

/* -------------------------------------------------------------------------- */
/* Cửa vào.                                                                    */
/* -------------------------------------------------------------------------- */

/** Renderer thật. Ném lỗi khi máy không cấp được WebGL — caller bắt, không để lọt. */
function createDefaultRenderer(canvas: HTMLCanvasElement): MeasurementRendererLike {
  return new WebGLRenderer({ canvas, antialias: true, alpha: false });
}

/**
 * Lắp cảnh lên một canvas và trả về tay cầm hook bắn tia qua.
 *
 * @param canvas Phần tử được đo và vẽ vào; module không đổi kích thước CSS của nó.
 * @param options Tầng cần dựng, khung nhìn đầu tiên, và các chỗ tiêm.
 *
 * @example
 * const mount = mountMeasurementScene(canvas, { levels, frame });
 * if (mount.ok) {
 *   const pick = createScenePick({
 *     camera: mount.handle.camera,
 *     root: mount.handle.root,
 *     viewport: mount.handle.viewport,
 *   });
 * }
 */
export function mountMeasurementScene(
  canvas: HTMLCanvasElement,
  options: MeasurementSceneMountOptions,
): MeasurementSceneMount {
  const readToken: TokenReader = options.readToken ?? documentTokenReader();
  let renderer: MeasurementRendererLike;

  try {
    renderer = (options.createRenderer ?? createDefaultRenderer)(canvas);
  } catch {
    // Không có WebGL là một nhánh hợp lệ, không phải một sự cố: hook đọc
    // `ok: false` rồi hiện một câu tiếng Việt bình thường, không mã lỗi, và
    // không màn trắng (A11).
    return { ok: false, reason: 'webglUnavailable' };
  }

  return { ok: true, handle: startScene(canvas, renderer, readToken, options) };
}

/* -------------------------------------------------------------------------- */
/* Thân cảnh.                                                                  */
/* -------------------------------------------------------------------------- */

function startScene(
  canvas: HTMLCanvasElement,
  renderer: MeasurementRendererLike,
  readToken: TokenReader,
  options: MeasurementSceneMountOptions,
): MeasurementSceneHandle {
  const ledger = options.ledger ?? new ResourceLedger();
  const stage = createStage(readToken);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = shadowMapTypeFor('soft');
  // Bản đồ bóng TĨNH: cảnh không tự chuyển động, nên nó chỉ phải vẽ lại khi tập
  // vật đổ bóng đổi — một tầng vừa dựng xong, hoặc khung vừa ẩn/hiện thứ gì.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  /* ---- Trạng thái sống --------------------------------------------------- */

  let currentFrame: ViewerSceneFrame = options.frame;
  let extent: BuildingExtent = UNIT_EXTENT;
  let lastWidthPx = 0;
  let lastHeightPx = 0;
  let disposed = false;

  /** Nhóm của mỗi tầng đã vào cây — `dispose()` đóng đúng những nhóm này. */
  const levelGroups: Group[] = [];

  const viewport = (): ViewportSize => ({
    width: canvas.clientWidth > 0 ? canvas.clientWidth : canvas.width,
    height: canvas.clientHeight > 0 ? canvas.clientHeight : canvas.height,
  });

  /** Đặt camera theo một khung, ở kích thước khung nhìn hiện tại. */
  const aimCamera = (frame: ViewerSceneFrame): void => {
    const { width, height } = viewport();

    stage.aimCamera(frame, extent, width, height);
  };

  /* ---- Hình dạng khung: tầng hiện, ẩn, cô lập, chọn, cắt ------------------ */

  const applyFrame = (frame: ViewerSceneFrame): void => {
    const selected = new Set(frame.selectedEntityIds);
    const hidden = new Set(frame.hiddenEntityIds);
    const visibleStoreys = new Set(frame.visibleStoreyIds);
    const isolated = frame.isolatedEntityIds === null ? null : new Set(frame.isolatedEntityIds);

    /**
     * `Raycaster` bước qua mọi vật vô hình, nên bảng này quyết luôn chấm được
     * điểm lên cái gì. Một sự thật, không phải hai: thứ người dùng ẩn đi không
     * được lặng lẽ nuốt mất cú chấm điểm vào bức tường phía sau nó.
     */
    const isVisible = (data: PartUserData): boolean =>
      visibleStoreys.has(data.levelId) &&
      !hidden.has(data.entityId) &&
      (isolated === null || isolated.has(data.entityId));

    stage.root.traverse((object) => {
      if (!(object instanceof Mesh)) {
        return;
      }

      const data = readPartData(object);
      const base = data === null ? undefined : stage.baseMaterialOf(object);

      if (data === null || base === undefined) {
        return;
      }

      object.visible = isVisible(data);
      object.material = selected.has(data.entityId)
        ? stage.selectionMaterial
        : data.entityId === frame.hoveredEntityId
          ? stage.hoverMaterial
          : base;
    });

    const clip = frame.sectionPlane;
    renderer.clippingPlanes =
      clip === null
        ? []
        : [new Plane(new Vector3(clip.normalX, clip.normalY, clip.normalZ), clip.constant)];
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

    stage.aimCamera(currentFrame, extent, width, height);
    renderer.render(stage.scene, stage.camera);
  };

  const loop = createFrameLoop({
    // Không có chuyển động tự thân nào để lấy mẫu — xem "Vòng vẽ theo nhu cầu" ở
    // đầu file. Cổng `motion` đóng ngay dưới đây, nên ba tham số này chỉ là hình
    // dạng `createFrameLoop` đòi, không phải một lượt đung đưa.
    headingAt: () => 0,
    restingHeading: 0,
    minStep: () => 0,
    render: renderOnce,
    maxFps: MEASURE_MAX_FPS,
    ...(options.schedule !== undefined ? { schedule: options.schedule } : {}),
    ...(options.cancel !== undefined ? { cancel: options.cancel } : {}),
  });

  loop.setGate('motion', false);

  /* ---- Dựng hình --------------------------------------------------------- */

  /**
   * Nhận một tầng vừa dựng xong: tô nó, gắn vào cây, rồi bắt lại đèn và hộp bao.
   *
   * Hàng dựng không biết gì về vật liệu hay ánh sáng, và đây là chỗ duy nhất hai
   * bên gặp nhau — xem `measurementToolSceneBuild.ts`.
   */
  const takeLevel = (_levelId: string, group: Group): void => {
    if (disposed) {
      return;
    }

    stage.paint(group);
    ledger.track(group);
    stage.root.add(group);
    levelGroups.push(group);
    // Cùng lý do `aimCamera` cập nhật ma trận của camera: `Raycaster` đọc
    // `matrixWorld` của từng vật và KHÔNG tự tính lại nó, còn phép tính ấy vốn
    // là việc `WebGLRenderer.render` làm. Một tầng vừa vào cây phải bắn trúng
    // được ngay, không phải đợi khung hình kế tiếp.
    stage.root.updateMatrixWorld(true);

    // Hộp bao chỉ đổi khi có tầng mới, nên đo ở đây thay vì ở mỗi khung hình.
    const box = new Box3().setFromObject(stage.root);
    extent = box.isEmpty() ? UNIT_EXTENT : buildingExtent(box);
    stage.lightExtent(extent);

    applyFrame(currentFrame);
    aimCamera(currentFrame);
    renderer.shadowMap.needsUpdate = true;
    loop.invalidate();
  };

  /* ---- Ba cổng còn lại của vòng vẽ --------------------------------------- */

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

  applyFrame(currentFrame);
  aimCamera(currentFrame);

  const build: SceneBuild = startSceneBuild({
    levels: options.levels,
    ...(options.createWorker !== undefined ? { createWorker: options.createWorker } : {}),
    onLevelReady: takeLevel,
    onStatusChange: (status) => options.onStatusChange?.(status),
  });

  loop.invalidate();

  /* ---- Tay cầm ----------------------------------------------------------- */

  return {
    camera: stage.camera,
    root: stage.root,
    viewport,

    update: (frame) => {
      if (disposed) {
        return;
      }

      currentFrame = frame;
      applyFrame(frame);
      aimCamera(frame);
      renderer.shadowMap.needsUpdate = true;
      loop.invalidate();
    },

    status: build.status,

    isResting: () => !loop.isOpen('motion'),

    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;

      loop.dispose();
      build.dispose();

      document.removeEventListener('visibilitychange', onVisibility);
      globalThis.removeEventListener('focus', onFocus);
      globalThis.removeEventListener('blur', onBlur);
      observer?.disconnect();

      // Trả vật liệu tô chọn/hover về đúng vật liệu gốc TRƯỚC khi đóng tầng:
      // `disposeFloor` giải phóng những gì nó tìm thấy trong cây, nên hai vật
      // liệu dùng chung phải rời khỏi cây rồi mới được trả tay.
      stage.root.traverse((object) => {
        if (object instanceof Mesh) {
          const base = stage.baseMaterialOf(object);

          if (base !== undefined) {
            object.material = base;
          }
        }
      });

      for (const group of levelGroups) {
        disposeFloor(group, { materials: sharedMaterialCache });
      }
      levelGroups.length = 0;

      stage.release();

      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
