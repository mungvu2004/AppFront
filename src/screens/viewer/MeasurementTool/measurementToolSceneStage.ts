/**
 * Sân khấu của cảnh đo: cây cảnh, camera, hai đèn, và ba vật liệu.
 *
 * Tách khỏi `measurementToolScene.ts` vì R-22, và đường cắt chọn theo trách
 * nhiệm: file này dựng và chăm những thứ ĐỨNG YÊN qua cả đời một lượt xem, còn
 * file kia lo vòng đời — renderer, vòng vẽ, khung hình, tay cầm. Sân khấu không
 * biết `WebGLRenderer` là gì và không lên lịch một khung hình nào.
 *
 * ## Một camera, và vì sao chỉ một
 *
 * `createScenePick` nhận `camera` một lần rồi bắn tia qua nó suốt đời của nó
 * (`lib/three/interaction/raycast.ts:217-228`). Một sân khấu phơi ra hai camera
 * đổi chỗ cho nhau theo `frame.isOrthographic` là một sân khấu mà người gọi cầm
 * nhầm được — và cầm nhầm thì tia bắn bằng phép chiếu của khung hình trước, im
 * lặng, sai vài chục centimét. Nên ở đây có đúng một `PerspectiveCamera`; hướng
 * nhìn của khung — kể cả nhìn thẳng từ trên xuống — vẫn được tôn trọng qua chế
 * độ camera của `createCameraMode`.
 */

import {
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
  type Material,
} from 'three';

import {
  createCameraMode,
  type BuildingExtent,
  type CameraMode,
  type Viewpoint,
} from '@/lib/three/camera/modes';
import { CAMERA_SETTINGS } from '@/lib/three/camera/settings';
import { sharedMaterialCache } from '@/lib/three/perf/materialCache';
import { tokenColour, type TokenReader } from '@/lib/three/present/palette';
import type { ViewerSceneFrame } from '@/screens/viewer/ViewerShell/viewerShellTypes';

import {
  FALLBACK_ACCENT_LEVEL,
  FALLBACK_SURFACE_LEVEL,
  HOVER_MATERIAL_KEY,
  KEY_LIGHT_DISTANCE_FACTOR,
  KEY_LIGHT_INTENSITY,
  ORTHOGRAPHIC_TOP_POLAR_RAD,
  SELECTION_MATERIAL_KEY,
  SHADOW_FAR_FACTOR,
  SHADOW_MAP_SIZE_PX,
  SKY_LIGHT_INTENSITY,
  SURFACE_MATERIAL_KEY,
  SURFACE_TOKEN,
} from './measurementToolSceneTypes';

/* -------------------------------------------------------------------------- */
/* Phép thuần.                                                                 */
/* -------------------------------------------------------------------------- */

/** Vật liệu Lambert của một token màu. */
function materialOfToken(colour: Color): Material {
  return new MeshLambertMaterial({ color: colour });
}

/**
 * Chế độ camera ứng với một khung của vỏ.
 *
 * Cùng ranh giới `ExplodedView` dùng, và cùng lý lẽ: một khung trực giao chúc
 * gần thẳng đứng là một lượt nhìn từ trên xuống, còn lại là mặt đứng.
 */
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

/* -------------------------------------------------------------------------- */
/* Sân khấu.                                                                   */
/* -------------------------------------------------------------------------- */

/** Mọi thứ đứng yên qua cả đời một lượt xem. */
export interface SceneStage {
  readonly scene: Scene;
  /** Gốc cây cảnh — `Raycaster.intersectObject(root, true)` dò từ đây. */
  readonly root: Group;
  /** Camera bắn tia đi qua. Một tham chiếu, đứng yên cả đời của sân khấu. */
  readonly camera: PerspectiveCamera;
  /** Vật liệu tô đối tượng đang chọn, và đối tượng con trỏ đang trỏ vào. */
  readonly selectionMaterial: Material;
  readonly hoverMaterial: Material;
  /** Đặt camera vào chỗ của một khung, quanh một hộp bao. */
  readonly aimCamera: (
    frame: ViewerSceneFrame,
    extent: BuildingExtent,
    width: number,
    height: number,
  ) => void;
  /** Đưa đèn chính và bản đồ bóng bao lấy một hộp bao mới. */
  readonly lightExtent: (extent: BuildingExtent) => void;
  /** Tô mọi mesh của một nhóm bằng vật liệu bề mặt dùng chung. */
  readonly paint: (group: Group) => void;
  /** Vật liệu gốc của một mesh; `undefined` khi nó chưa qua {@link paint}. */
  readonly baseMaterialOf: (mesh: Mesh) => Material | undefined;
  /** Trả hai vật liệu tô chọn/hover về cache. Gọi SAU khi cây đã đóng. */
  readonly release: () => void;
}

/**
 * Dựng sân khấu.
 *
 * @param readToken Đọc giá trị token màu. A1: không một mã màu thô nào ở đây.
 */
export function createStage(readToken: TokenReader): SceneStage {
  const scene = new Scene();
  const root = new Group();
  scene.add(root);

  const white = tokenColour('--white', new Color(1, 1, 1), readToken);
  const fallbackSurface = new Color(
    FALLBACK_SURFACE_LEVEL,
    FALLBACK_SURFACE_LEVEL,
    FALLBACK_SURFACE_LEVEL,
  );
  const fallbackAccent = new Color(
    FALLBACK_ACCENT_LEVEL,
    FALLBACK_ACCENT_LEVEL,
    FALLBACK_ACCENT_LEVEL,
  );

  scene.background = tokenColour('--canvas-3d', fallbackSurface, readToken);

  const skyLight = new HemisphereLight(
    white,
    tokenColour('--canvas-3d-ground', fallbackSurface, readToken),
    SKY_LIGHT_INTENSITY,
  );
  const keyLight = new DirectionalLight(white, KEY_LIGHT_INTENSITY);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(SHADOW_MAP_SIZE_PX, SHADOW_MAP_SIZE_PX);
  scene.add(skyLight, keyLight);

  const camera = new PerspectiveCamera(
    CAMERA_SETTINGS.shared.fieldOfViewDeg,
    1,
    CAMERA_SETTINGS.shared.nearM,
    CAMERA_SETTINGS.shared.minFarM,
  );

  const selectionMaterial = sharedMaterialCache.acquire(SELECTION_MATERIAL_KEY, () =>
    // A1 + A2: màu nhấn là màu của thứ tương tác được, và nó đến từ token. Không
    // đỏ, không vàng — hai họ màu ấy không có mặt trong cảnh này.
    materialOfToken(tokenColour('--accent', fallbackAccent, readToken)),
  );
  const hoverMaterial = sharedMaterialCache.acquire(HOVER_MATERIAL_KEY, () =>
    materialOfToken(tokenColour('--accent-hover', fallbackAccent, readToken)),
  );

  /** Vật liệu gốc của mỗi mesh, để trả lại sau khi bỏ chọn. */
  const baseMaterials = new WeakMap<Mesh, Material>();

  /**
   * Camera do VỎ lái: hướng, góc chúc và khoảng cách của khung, nhìn vào tâm hộp
   * bao. `ViewerSceneFrame` không mang điểm ngắm, nên tâm hộp bao là điểm ngắm
   * duy nhất suy ra được từ khung.
   */
  const viewpointOf = (frame: ViewerSceneFrame, extent: BuildingExtent): Viewpoint => ({
    target: extent.centre,
    azimuthRad: frame.azimuthRad,
    polarRad: frame.polarRad,
    distanceM: frame.distanceM,
  });

  return {
    scene,
    root,
    camera,
    selectionMaterial,
    hoverMaterial,

    aimCamera: (frame, extent, width, height) => {
      createCameraMode(cameraModeOf(frame), viewpointOf(frame, extent), { extent }).applyTo(
        camera,
        aspectOf(width, height),
      );
      // `applyTo` chỉ đặt vị trí, hướng và ma trận chiếu; ma trận THẾ GIỚI thì
      // `WebGLRenderer.render` mới cập nhật. Nhưng `Raycaster.setFromCamera` đọc
      // đúng ma trận ấy, và hook bắn tia lúc con trỏ nhúc nhích — tức giữa hai
      // khung hình, có thể trước cả khung hình đầu tiên sau một lượt xoay. Thiếu
      // dòng dưới đây thì tia bắn bằng tư thế camera của khung TRƯỚC, im lặng và
      // sai. Nên sân khấu tự lo, và không ai phải vẽ một khung hình trước khi
      // chấm được một điểm.
      camera.updateMatrixWorld(true);
    },

    lightExtent: (extent) => {
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
    },

    paint: (group) => {
      const meshes: Mesh[] = [];

      group.traverse((object) => {
        if (object instanceof Mesh) {
          meshes.push(object);
        }
      });

      // Một vật liệu cho cả cảnh, và một lượt `acquire` cho mỗi cây con GIỮ nó —
      // đúng phép đếm `disposeFloor` trả lại (`perf/materialCache.ts:21-26`).
      // Đếm mesh TRƯỚC khi xin vật liệu chính vì phép đếm ấy: một tầng mà mọi
      // job đều hỏng vẫn tới đây với một nhóm rỗng, và `disposeFloor` trên một
      // nhóm rỗng không tìm thấy vật liệu nào để trả — nên một lượt `acquire` ở
      // đó là một tham chiếu không bao giờ về.
      //
      // Không tô theo loại bộ phận: đo là chuyện hình học, và một bảng màu phân
      // loại ở đây chỉ nói một điều mà phép đo không hỏi.
      if (meshes.length === 0) {
        return;
      }

      const surface = sharedMaterialCache.acquire(SURFACE_MATERIAL_KEY, () =>
        materialOfToken(tokenColour(SURFACE_TOKEN, fallbackSurface, readToken)),
      );

      for (const mesh of meshes) {
        mesh.material = surface;
        baseMaterials.set(mesh, surface);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    },

    baseMaterialOf: (mesh) => baseMaterials.get(mesh),

    release: () => {
      sharedMaterialCache.release(selectionMaterial);
      sharedMaterialCache.release(hoverMaterial);
    },
  };
}
