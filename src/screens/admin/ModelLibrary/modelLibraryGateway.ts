/**
 * Cổng dữ liệu của S-25 — thư viện model dùng chung. Một file thuần: không React, không
 * JSX, nên nó chạy và test được ngoài một cây React, đúng khuôn
 * `VersionHistory/versionHistoryGateway.ts` và `viewer/HistoryPanel/historyPanelGateway.ts`.
 *
 * Ba việc ở đây, cả ba đều là **nối lại** logic đã có (R-61):
 *
 * 1. `capabilities` — dựng {@link ModelLibraryCapabilities} của hợp đồng. Chín trường là
 *    `false` cố định, lý do đã ghi trong docblock `types.ts` và KHÔNG được dò lại ở đây.
 *    `canManage` là trường duy nhất tính lúc chạy, qua `can('manage', 'library', …)` —
 *    cùng lời gọi mà `FurnitureLibraryPanel.container.tsx:109-112` đang dùng.
 * 2. `listModels` / `readModel` — đi qua `libraryListQueryOptions` /
 *    `libraryDetailQueryOptions` (`src/lib/query/libraryQueries.ts`). Không `fetch` nào
 *    được viết ở đây, và không `isLoading`/`error` nào được nuôi bằng tay (R-64).
 * 3. `openPreview` — nạp MỘT model `.glb` vào một canvas, đo lại số tam giác, và trả một
 *    phiên có `dispose()` chứng minh không rò rỉ.
 *
 * ## Vì sao mọi thứ chạm `three` ở đây đều nằm sau `import()` động
 *
 * `scripts/check-bundle-size.mjs` đo chi phí THÊM của mỗi đích `import()` động và chặn ở
 * 280 KiB gzip. `three` + `GLTFLoader` + `DRACOLoader` nằm trên đường nhập tĩnh của một
 * route là chi phí người dùng trả ngay cả khi họ không mở panel chi tiết lần nào. Nên
 * {@link mountModelPreview} nhập TẤT CẢ phần ba.js của nó bằng `import()` bên trong thân
 * hàm, đúng khuôn `useMeasurementToolScene.ts:140-148` và `useExplodedView.ts:711`. Kiểu
 * (`type`) thì nhập tĩnh được — TypeScript xoá chúng trước khi Rollup nhìn thấy.
 *
 * **Giới hạn đã biết, không giấu:** `useModelLibrary.ts` nhập TĨNH
 * `@/lib/three/perf/budget` để có `checkBudget` cho cột "Nặng", và module ấy nhập `three`
 * ở dạng giá trị (`budget.ts:44-55`, cần `instanceof` cho `measureScene`). Nên lõi `three`
 * vẫn vào bao đóng tĩnh của màn; thứ `import()` động ở đây thật sự giữ được ngoài là
 * `GLTFLoader`, `DRACOLoader`, `camera/*` và `present/*`. Muốn lõi `three` cũng ra ngoài
 * thì phải đổi cách `isHeavy` được tính, và đó là một quyết định của hợp đồng chứ không
 * phải của file này.
 *
 * ## Đường tải lên KHÔNG tồn tại, và cổng này không giả vờ có
 *
 * `LibraryApi` chỉ có `list`/`read` (`src/api/client.ts:399-402`). Không có phương thức
 * ghi nào ở bất kỳ tầng nào — xem mục 1 docblock của `types.ts`. Vì thế cổng này KHÔNG có
 * `uploadModel`, `deprecateModel`, `deleteModel`: khả năng vắng mặt thì phương thức cũng
 * vắng mặt, chứ không phải một hàm ném lỗi (R-69), cùng khuôn
 * `VersionHistoryGateway.tagVersion?`.
 */

import type { LibraryApi, LibraryItem } from '@/api/client';
import { can } from '@/lib/auth/permissions';
import {
  libraryDetailQueryOptions,
  libraryListQueryOptions,
  type LibraryDetailQueryKey,
  type LibraryListQueryKey,
  type LibraryQueryOptions,
} from '@/lib/query/libraryQueries';
import { queryKeys } from '@/lib/query/queryKeys';
import type { ResourceLedger } from '@/lib/three/perf/dispose';
import type { ProjectRole } from '@/types/project';

import type { ModelLibraryCapabilities, ModelLibraryGateway, ModelPreviewSession } from './types';

/* -------------------------------------------------------------------------- */
/* 1 — Khoá bộ nhớ đệm (R-64)                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Khoá của hai lượt đọc, lấy thẳng từ `libraryQueries.ts` chứ không khai lại.
 *
 * `createQueryClient` đã đặt `setQueryDefaults(['library'], …)` cho mọi khoá bắt đầu bằng
 * `'library'` (bậc `'static'`, `cachePolicy.ts`), nên viết một khoá thứ hai ở đây là dựng
 * nguồn sự thật thứ hai cho cùng một chính sách (R-71). Cùng khuôn `versionsQueryKey` của
 * `versionHistoryGateway.ts`: một lớp bọc mỏng quanh `queryKeys`, không phải một nhánh
 * khoá mới.
 */
export function modelLibraryListKey(): LibraryListQueryKey {
  return queryKeys.library.list();
}

/** Khoá của một mục, cùng nguồn với {@link modelLibraryListKey}. */
export function modelLibraryDetailKey(modelId: string): LibraryDetailQueryKey {
  return queryKeys.library.detail(modelId);
}

/* -------------------------------------------------------------------------- */
/* 2 — Cổng năng lực                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Chín phán quyết `false`, đông lạnh.
 *
 * Mỗi dòng đã có lý do đo được trong docblock của `types.ts`; chép lại lý do ở đây sẽ là
 * nguồn thứ hai cho cùng một quyết định. Ngày một endpoint xuất hiện, đúng MỘT dòng dưới
 * đây đổi sang `true`.
 */
const UNAVAILABLE_CAPABILITIES = Object.freeze({
  canUploadModel: false,
  canChangeGroup: false,
  canDeprecate: false,
  canDelete: false,
  canOptimizeMesh: false,
  canCountUsage: false,
  canListAliases: false,
  canShowProvenance: false,
  canAutoSpin: false,
} as const);

/**
 * Người dùng có quyền quản trị thư viện không.
 *
 * `library.manage` là capability CÓ THẬT (`src/lib/auth/permissions.ts:17-25`), và nơi gọi
 * thật đầu tiên là `FurnitureLibraryPanel.container.tsx:109-112`. Màn này là nơi gọi thứ
 * hai, cùng một lời gọi, không có bảng vai trò nào được viết lại.
 */
export function canManageLibrary(roles: readonly ProjectRole[]): boolean {
  return can('manage', 'library', { roles });
}

/** Cổng năng lực đầy đủ của màn, cho một tập vai trò. */
export function modelLibraryCapabilities(
  roles: readonly ProjectRole[],
): ModelLibraryCapabilities {
  return {
    ...UNAVAILABLE_CAPABILITIES,
    // `createAssetService` + `measureScene` + `disposeFloor` đều có thật — xem mục 3.
    canPreview3d: true,
    // `checkBudget` + `SCENE_BUDGET` đều có thật — `src/lib/three/perf/budget.ts:92,219`.
    canFlagHeavy: true,
    canManage: canManageLibrary(roles),
  };
}

/* -------------------------------------------------------------------------- */
/* 3 — Xem trước 3D một model                                                 */
/* -------------------------------------------------------------------------- */

/** Thứ {@link mountModelPreview} cần ngoài canvas và đường dẫn model. */
interface PreviewSceneOptions {
  readonly signal?: AbortSignal;
  readonly dracoDecoderPath?: string;
  readonly ledger?: ResourceLedger;
}

/** Khung nhìn hiện tại của canvas, tính bằng pixel CSS. */
function viewportOf(canvas: HTMLCanvasElement): { readonly width: number; readonly height: number } {
  return {
    width: canvas.clientWidth > 0 ? canvas.clientWidth : canvas.width,
    height: canvas.clientHeight > 0 ? canvas.clientHeight : canvas.height,
  };
}

/**
 * Nạp một `.glb` lên canvas và trả phiên xem trước.
 *
 * Bốn điều bắt buộc, theo khảo sát 3D mục 2.1 và 2.4:
 *
 * 1. **Số tam giác đo LẠI.** `measureScene(root)` chạy SAU khi model nạp xong và đọc thẳng
 *    buffer đã parse, nên nó là sự thật cuối cùng — khác `LibraryItem.triangleCount`, vốn
 *    là con số máy chủ khai. Hai số lệch nhau là thông tin thật, không phải lỗi.
 * 2. **`dispose()` dọn cả hình học lẫn ngữ cảnh WebGL.** `disposeFloor(root)` giải phóng
 *    geometry/material/texture của cây model, `assets.dispose()` giải phóng bản gốc còn
 *    nằm trong bộ nhớ đệm theo URL của chính dịch vụ (`load()` trả một `clone()`, nên có
 *    HAI cây phải dọn), rồi `renderer.dispose()` + `forceContextLoss()` trả ngữ cảnh —
 *    cùng đôi lệnh mà `measurementToolScene.ts:392-393` và `viewer3dScene.ts:993-994` dùng.
 * 3. **Huỷ được giữa chừng.** `signal` đi thẳng vào `AssetService.load`, và nếu panel đã
 *    đóng trước lúc model về thì lượt nạp mồ côi được dọn ngay tại chỗ thay vì lắp lên một
 *    canvas không còn ai xem.
 * 4. **Vòng vẽ theo nhu cầu.** `capabilities.canAutoSpin` là `false`, nên cổng `motion`
 *    của `createFrameLoop` đóng ngay và không mở lại lần nào; mỗi khung hình được vẽ là vì
 *    một thứ đã đổi (kéo chuột, canvas đổi cỡ) đã gọi `invalidate()`. Ba tham số
 *    `headingAt`/`restingHeading`/`minStep` chỉ là hình dạng hàm đòi — chép đúng cách
 *    `measurementToolScene.ts:250-263` làm cho một cảnh không tự chuyển động.
 *
 * Người dùng vẫn quay tay được: kéo chuột đổi phương vị và góc ngẩng, trong đúng giới hạn
 * `CAMERA_SETTINGS.orbit` (`minPolarDeg`/`maxPolarDeg`/`rotatePixelsPerTurn`) — không có
 * tốc độ quay nào được nghĩ ra ở đây (R-71).
 */
async function mountModelPreview(
  canvas: HTMLCanvasElement,
  modelUrl: string,
  options: PreviewSceneOptions,
): Promise<ModelPreviewSession> {
  const [
    { Box3, DirectionalLight, HemisphereLight, PerspectiveCamera, Scene, WebGLRenderer },
    { createAssetService },
    { measureScene },
    { disposeFloor, ResourceLedger: Ledger },
    { buildingExtent, clipPlanes, viewpointEye },
    { frameViewpoint },
    { PRESET_SETTINGS },
    { CAMERA_SETTINGS },
    { createFrameLoop },
    { degrees, degreesToRadians, RADIANS_PER_TURN },
  ] = await Promise.all([
    import('three'),
    import('@/lib/three/present/assets'),
    import('@/lib/three/perf/budget'),
    import('@/lib/three/perf/dispose'),
    import('@/lib/three/camera/modes'),
    import('@/lib/three/camera/frameObjects'),
    import('@/lib/three/camera/presets'),
    import('@/lib/three/camera/settings'),
    import('@/lib/three/present/frameLoop'),
    import('@/domain/units/types'),
  ]);

  const assets = createAssetService(
    options.dracoDecoderPath === undefined ? {} : { dracoDecoderPath: options.dracoDecoderPath },
  );

  let root;
  try {
    root = await assets.load(modelUrl, options.signal);
  } catch (error) {
    assets.dispose();
    throw error;
  }

  if (options.signal?.aborted === true) {
    // Đóng panel giữa lúc đang nạp: dọn ngay tại chỗ thay vì để một lượt nạp mồ côi treo
    // trên canvas không còn ai xem.
    disposeFloor(root);
    assets.dispose();
    throw new DOMException('Đã đóng khung xem trước trước khi model nạp xong.', 'AbortError');
  }

  const ledger = options.ledger ?? new Ledger();
  ledger.track(root);

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  const scene = new Scene();
  scene.add(root);
  // Không màu nào được viết ở đây (A1): cả hai đèn dùng màu mặc định của ba.js, và nền
  // trong suốt (`alpha: true`) để nền token của panel hiện qua.
  scene.add(new HemisphereLight());
  const keyLight = new DirectionalLight();
  keyLight.position.set(1, 1, 1);
  scene.add(keyLight);

  const box = new Box3().setFromObject(root);
  const planes = clipPlanes(buildingExtent(box));
  const camera = new PerspectiveCamera(
    CAMERA_SETTINGS.shared.fieldOfViewDeg,
    PRESET_SETTINGS.defaultAspect,
    planes.nearM,
    planes.farM,
  );

  const toRadians = (value: number): number => degreesToRadians(degrees(value));
  const minPolarRad = toRadians(CAMERA_SETTINGS.orbit.minPolarDeg);
  const maxPolarRad = toRadians(CAMERA_SETTINGS.orbit.maxPolarDeg);
  const radiansPerPixel = RADIANS_PER_TURN / CAMERA_SETTINGS.orbit.rotatePixelsPerTurn;

  let azimuthRad = toRadians(CAMERA_SETTINGS.orbit.initialAzimuthDeg);
  let polarRad = toRadians(CAMERA_SETTINGS.orbit.initialPolarDeg);

  const renderOnce = (): void => {
    const { width, height } = viewportOf(canvas);
    const aspect = height > 0 ? width / height : PRESET_SETTINGS.defaultAspect;
    // `frameViewpoint` khung đúng hộp bao của model — không dùng `initialViewpoint`, vì
    // hàm ấy đi qua `boundingRadiusM`, thứ có sàn `smallestPlanRadiusM` = 5 m dành cho
    // một CÔNG TRÌNH và sẽ đẩy một chiếc bàn 1,8 m ra xa tới mức không nhìn thấy gì.
    const viewpoint = frameViewpoint(box, {
      azimuthRad,
      polarRad,
      aspect,
      paddingFraction: PRESET_SETTINGS.framePaddingFraction,
      clearanceMarginM: PRESET_SETTINGS.clearanceMarginM,
    });

    camera.aspect = aspect;
    camera.position.copy(viewpointEye(viewpoint));
    camera.lookAt(viewpoint.target);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    renderer.render(scene, camera);
  };

  const loop = createFrameLoop({
    headingAt: () => 0,
    restingHeading: 0,
    minStep: () => 0,
    render: renderOnce,
  });

  loop.setGate('motion', false);
  loop.invalidate();

  /* ---- Quay tay ---------------------------------------------------------- */

  let dragPointerId: number | null = null;
  let lastX = 0;
  let lastY = 0;

  const onPointerDown = (event: PointerEvent): void => {
    dragPointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (dragPointerId !== event.pointerId) {
      return;
    }

    const nextPolar = polarRad - (event.clientY - lastY) * radiansPerPixel;

    azimuthRad -= (event.clientX - lastX) * radiansPerPixel;
    polarRad = Math.min(maxPolarRad, Math.max(minPolarRad, nextPolar));
    lastX = event.clientX;
    lastY = event.clientY;
    loop.invalidate();
  };

  const endDrag = (event: PointerEvent): void => {
    if (dragPointerId === event.pointerId) {
      dragPointerId = null;
    }
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  let disposed = false;

  return {
    measuredTriangleCount: measureScene(root).triangles,
    dispose: (): void => {
      if (disposed) {
        return;
      }

      disposed = true;
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', endDrag);
      canvas.removeEventListener('pointercancel', endDrag);
      loop.dispose();
      disposeFloor(root);
      assets.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

/* -------------------------------------------------------------------------- */
/* 4 — Tham số dựng cổng                                                      */
/* -------------------------------------------------------------------------- */

export interface CreateModelLibraryGatewayOptions {
  /**
   * Cổng vào hẹp, cùng khuôn `libraryQueries.ts`: chỉ hai phương thức cổng này thật sự
   * gọi, nên test dựng hai hàm giả thay vì cả tám nhóm của `ApiClient`.
   */
  readonly libraryApi: Pick<LibraryApi, 'list' | 'read'>;
  /** Vai trò của phiên đang mở. `canManage` đọc đúng danh sách này, không đọc store. */
  readonly roles: readonly ProjectRole[];
  /**
   * Thư mục chứa bộ giải mã Draco, khi nơi ráp có.
   *
   * `public/draco/` bị `.gitignore` loại (`pnpm draco` chép nó về), và hằng `'/draco/'`
   * hiện là biến CỤC BỘ của `AuthScreen/houseScene.ts:62`, không xuất khẩu. Nên đường dẫn
   * ấy đi vào đây từ nơi ráp thay vì được gõ lại lần thứ hai (R-71). Không truyền thì một
   * model nén Draco rớt ở bước parse và panel hiện "không tải được" — một nhánh hợp lệ,
   * không phải màn trắng (A11).
   */
  readonly dracoDecoderPath?: string;
  /** Sổ tài nguyên để bài kiểm rò rỉ đếm mở/đóng nhiều lượt. Không truyền thì cổng tự dựng. */
  readonly ledger?: ResourceLedger;
  /** Đường xem trước giả, cho story và bài kiểm chạy trong jsdom không có WebGL. */
  readonly openPreview?: ModelLibraryGateway['openPreview'];
}

/* -------------------------------------------------------------------------- */
/* 5 — Cổng                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Cổng thật.
 *
 * `queryFn` của `libraryQueries` được gọi với đúng ba trường `QueryFunctionContext` bắt
 * buộc (`queryKey`, `signal`, `meta`); cả hai hàm ấy chỉ đọc `signal`, nên không có trường
 * nào bị bịa ra. Khi nơi gọi không đưa `signal`, một `AbortController` mới đứng vào chỗ đó
 * — đúng cách `createAssetService` xử lý cùng chỗ thiếu (`assets.ts:206`).
 */
export function createModelLibraryGateway(
  options: CreateModelLibraryGatewayOptions,
): ModelLibraryGateway {
  const { libraryApi } = options;

  const run = async <TData, TKey extends readonly unknown[]>(
    query: LibraryQueryOptions<TData, TKey>,
    signal: AbortSignal | undefined,
  ): Promise<TData> =>
    query.queryFn({
      queryKey: query.queryKey,
      signal: signal ?? new AbortController().signal,
      meta: undefined,
    });

  const openPreview =
    options.openPreview ??
    ((canvas: HTMLCanvasElement, modelUrl: string, signal?: AbortSignal) =>
      mountModelPreview(canvas, modelUrl, {
        ...(signal === undefined ? {} : { signal }),
        ...(options.dracoDecoderPath === undefined
          ? {}
          : { dracoDecoderPath: options.dracoDecoderPath }),
        ...(options.ledger === undefined ? {} : { ledger: options.ledger }),
      }));

  return {
    capabilities: modelLibraryCapabilities(options.roles),
    listModels: async (signal?: AbortSignal): Promise<readonly LibraryItem[]> =>
      run(libraryListQueryOptions(libraryApi), signal),
    readModel: async (modelId: string, signal?: AbortSignal): Promise<LibraryItem> =>
      run(libraryDetailQueryOptions(libraryApi, modelId), signal),
    openPreview,
  };
}
