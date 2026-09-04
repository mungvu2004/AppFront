/**
 * Logic của VỎ CHUNG chín màn 3D — nối lại thứ đã có, không tự chế công thức
 * (R-61).
 *
 * Hook này là NGƯỜI GỌI ĐẦU TIÊN của `src/lib/three/camera`. Cả bốn file ở đó
 * (`modes`, `presets`, `frameObjects`, `settings`) đã có test đầy đủ và tính
 * vào ngưỡng độ phủ 80% của `src/lib`, nhưng `rg -ln "CAMERA_PRESETS|
 * switchCameraMode|frameViewpoint" src` trước lượt này chỉ ra chính chúng —
 * đúng thứ CLAUDE.md gọi là "tầng logic đã hoàn thành theo kế hoạch, chưa màn
 * nào gọi tới vì chưa có màn thật nào được dựng". Vỏ này cắm vào, không dựng
 * lại (R-64).
 *
 * | Việc | Hàm đã có | Ở đâu |
 * |---|---|---|
 * | quán tính, giảm chấn 0,08 | `CAMERA_SETTINGS.orbit.damping` | `camera/settings.ts:288` |
 * | quay, kéo màn, thu phóng | `OrbitCameraMode.rotate/pan/dolly` | `camera/modes.ts` |
 * | đổi chế độ, giữ nguyên điểm nhìn | `switchCameraMode` | `camera/modes.ts:1020` |
 * | bay 340 ms có gia tốc | `CameraDirector.goTo` | `camera/presets.ts:418` |
 * | khuôn đối tượng, chừa 15% | `CameraDirector.frameObjects` | `camera/presets.ts` |
 * | góc trục đo | `DEFAULT_CAMERA_RIG` + `restingHeading` | `present/director.ts:54,86` |
 * | chuyển 2D↔3D | `useSceneTransition` | `hooks/useSceneTransition.ts:66` |
 * | so le theo tầng | `staggerDelaysMs` | `lib/motion/stagger.ts:88` |
 * | vai Người xem | `can('edit', 'layer', …)` | `lib/auth/permissions.ts:127` |
 * | định dạng số | `formatArea`, `formatNumber`, `formatLength` | `lib/format/**` |
 *
 * ## Ba chỗ đặc tả nói khác luật, và vỏ theo luật
 *
 * LUAT_MAN_HINH.md xếp prompt SAU luật, và bắt báo lại chứ không im lặng chọn
 * bên. Ba chỗ đó:
 *
 * 1. **Đùn khối 2D→3D: 340 ms, không phải 700 ms.** `MOTION_DURATIONS_MS`
 *    (`lib/motion/tokens.ts:62`) chỉ có bốn giá trị 120/180/260/340, và 700 là
 *    `AMBIENT_LOOP_MS` với chú thích ngay tại chỗ: nó dành cho thứ LẶP, không
 *    cho thứ chuyển từ trạng thái này sang trạng thái kia. Handover 2D↔3D đã
 *    được khai sẵn ở `SCENE_TIMINGS.view = { total: 'slow' }` = 340 ms, và
 *    `PRESET_SETTINGS.transitionMs` cũng đọc đúng ô đó. Viết 700 vào màn sẽ
 *    làm `local/no-raw-duration` đỏ.
 * 2. **So le theo tầng: 24 ms, không phải 60 ms.** `STAGGER_STEP_MS`
 *    (`lib/motion/stagger.ts:49`) là nguồn duy nhất, và chú thích của nó nói
 *    rõ vì sao không lớn hơn.
 * 3. **"Dừng lại trong khoảng 400 ms" không phải một hằng số.** Nó là HỆ QUẢ
 *    của `damping = 0,08` ở 60 Hz. Vỏ không viết 400 ở đâu cả; nó để
 *    `OrbitCameraMode.update` giảm chấn và dừng khi `update` trả về `false`.
 *
 * ## Vì sao `E` nhớ độ tách cũ
 *
 * `E` là phím BẬT TẮT, nên tắt rồi bật lại phải trả về đúng chỗ người dùng đã
 * kéo tới, không nhảy về mặc định. {@link SEPARATION_STEP} chỉ dùng khi chưa
 * ai kéo thanh trượt lần nào.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Vector3 } from 'three';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useSceneTransition } from '@/hooks/useSceneTransition';
import { can } from '@/lib/auth/permissions';
import { formatArea, formatLength } from '@/lib/format/measure';
import { formatNumber, formatPercent } from '@/lib/format/number';
import {
  appShortcutRegistry,
  type ShortcutRegistry,
} from '@/lib/input/shortcutRegistry';
import { queryKeys } from '@/lib/query/queryKeys';
import { millimetres } from '@/domain/units/types';
import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import {
  CameraDirector,
  PRESET_SETTINGS,
  presetById,
  presetViewpoint,
  type CameraPresetId,
} from '@/lib/three/camera/presets';
import {
  createCameraMode,
  type BuildingExtent,
  type CameraMode,
  type Viewpoint,
} from '@/lib/three/camera/modes';
import { DEFAULT_CAMERA_RIG, restingHeading } from '@/lib/three/present/director';
import { toSceneLength } from '@/lib/three/build/scene';
import { useStore } from '@/store';
import type { ProjectRole } from '@/types/project';

import {
  createViewerShellFixtureGateway,
  footprintOf,
  shellDataOf,
  type ViewerShellData,
  type ViewerShellGateway,
} from './viewerShellGateway';
import {
  buildDeselectShortcut,
  buildViewerShortcuts,
  FRAME_COMBO,
  HIDE_COMBO,
  ISOLATE_COMBO,
  MEASURE_COMBO,
  ORTHOGRAPHIC_COMBO,
  type ViewerShortcutHandlers,
} from './viewerShellShortcuts';
import {
  clampSeparation,
  stackedHeightMm,
  type StackableStorey,
} from './viewerStoreyStack';
import {
  clampSectionPosition,
  DEFAULT_SECTION_AXIS,
  DEFAULT_SECTION_POSITION,
  sectionPlaneFor,
  type ViewerBoundsM,
} from './viewerSectionPlane';
import type {
  ViewerLegendItem,
  ViewerPointPx,
  ViewerPresetId,
  ViewerPresetViewModel,
  ViewerPropertyRow,
  ViewerScreenState,
  ViewerSectionPlaneValue,
  ViewerSelectionViewModel,
  ViewerShellProps,
  ViewerStoreyViewModel,
  ViewerToolId,
  ViewerToolViewModel,
} from './viewerShellTypes';

/* -------------------------------------------------------------------------- */
/* Hằng số của vỏ.                                                             */
/* -------------------------------------------------------------------------- */

/** Độ tách phím `E` nhảy tới khi chưa ai kéo thanh trượt lần nào. */
export const SEPARATION_STEP = 0.5;

/** Mỗi nấc cuộn chuột đổi bao nhiêu "nấc" của `OrbitCameraMode.dolly`. */
const DOLLY_NOTCH = 1;

/** Bước một lần bấm `+` / `−` của cụm thu phóng, theo nấc dolly. */
const ZOOM_BUTTON_NOTCHES = 2;

/** Sáu công cụ của ray trái, kèm phím của chúng. */
const VIEWER_TOOLS: readonly (ViewerToolViewModel & { readonly requiresEdit: boolean })[] =
  Object.freeze([
    { id: 'orbit', label: 'quay quanh mô hình', keyLabel: 'R', requiresEdit: false },
    { id: 'pan', label: 'kéo màn', keyLabel: 'H', requiresEdit: false },
    { id: 'measure', label: 'đo', keyLabel: MEASURE_COMBO, requiresEdit: true },
    { id: 'section', label: 'mặt cắt', keyLabel: 'C', requiresEdit: false },
    { id: 'select', label: 'chọn', keyLabel: 'V', requiresEdit: false },
    { id: 'isolate', label: 'cô lập', keyLabel: ISOLATE_COMBO, requiresEdit: false },
  ]);

/** Bốn góc nhìn của `Select` trên thanh trên. */
const VIEWER_PRESETS: readonly ViewerPresetViewModel[] = Object.freeze([
  { id: 'perspective', label: 'Phối cảnh' },
  { id: 'axonometric', label: 'Trục đo' },
  { id: 'top', label: 'Trên xuống' },
  { id: 'section', label: 'Mặt cắt' },
]);

/**
 * Chú giải góc trái dưới.
 *
 * `colorToken` là TÊN BIẾN CSS, không phải mã màu (A1). Ba độ dày tường cộng
 * ô cửa: đúng những gì một khung nhìn 3D của sản phẩm này phân biệt bằng màu.
 */
const VIEWER_LEGEND: readonly ViewerLegendItem[] = Object.freeze([
  { id: 'wall-110', label: 'tường 110', colorToken: '--wall-110' },
  { id: 'wall-220', label: 'tường 220', colorToken: '--wall-220' },
  { id: 'wall-330', label: 'tường 330', colorToken: '--wall-330' },
  { id: 'opening', label: 'ô mở', colorToken: '--accent' },
]);

/** Câu dạy của panel phải khi chưa chọn gì — đúng chữ đặc tả yêu cầu. */
export const INSPECTOR_HINT = 'Chọn một đối tượng trên mô hình để xem thuộc tính.';

/** Chữ trên thanh trạng thái lúc mô hình đang dựng. */
const BUILDING_MESSAGE = 'Đang dựng mô hình…';

/** Chữ trên thanh trạng thái khi mô hình đã dựng xong. */
const READY_MESSAGE = 'Mô hình đã dựng xong.';

/** Câu lỗi khi không dựng được mô hình. */
const ERROR_MESSAGE =
  'Không dựng được mô hình từ dữ liệu của dự án này. Thử lại, hoặc mở lại lớp tường để xem dữ liệu còn thiếu gì.';

/* -------------------------------------------------------------------------- */
/* Tuỳ chọn.                                                                   */
/* -------------------------------------------------------------------------- */

export interface UseViewerShellOptions {
  readonly projectId: string;
  /** Vai của người đang xem. Thiếu thì coi như chỉ xem được. */
  readonly roles?: readonly ProjectRole[];
  /** Cổng dữ liệu tiêm được. Vắng mặt thì dùng cổng bộ mẫu. */
  readonly gateway?: ViewerShellGateway;
  /** Đồ thị tiêm được. Vắng mặt thì đọc kho. */
  readonly spatial?: NormalizedSpatial | null;
  /** Ép một trạng thái — cho story và bài kiểm bảy trạng thái. */
  readonly forceState?: ViewerScreenState;
  /** Cờ nhà phát triển; quyết định chip hiệu năng có hiện không. */
  readonly isDev?: boolean;
  /** Số đo hiệu năng tiêm được; vắng mặt thì chưa có phép đo nào. */
  readonly perf?: { readonly frameRate: number; readonly triangles: number } | null;
  /** Cảnh 3D của màn nội dung. */
  readonly renderScene?: (
    frame: ViewerShellProps['frame'],
    actions: ViewerShellProps['sceneActions'],
  ) => React.ReactNode;
  /** Sổ đăng ký phím tiêm được — bài kiểm dùng sổ của riêng nó. */
  readonly registry?: ShortcutRegistry;
  /** Mở ô tìm đối tượng. Vỏ không tự dựng hộp thoại nào đè lên khung nhìn. */
  readonly onOpenSearch?: () => void;
}

/* -------------------------------------------------------------------------- */
/* Hình học của mô hình.                                                       */
/* -------------------------------------------------------------------------- */

/** Không có gì để nhìn — hộp bao suy biến, dùng khi đồ thị rỗng. */
const UNIT_EXTENT: BuildingExtent = {
  centre: new Vector3(0, 0, 0),
  sizeM: new Vector3(1, 1, 1),
};

/**
 * Hộp bao của mô hình, theo MÉT và theo trục của cảnh.
 *
 * `scene.ts` khai trục đúng một lần: bản vẽ `x → x`, cao độ `→ y`, bản vẽ
 * `y → z`. Hàm này theo đúng khai báo ấy thay vì tự chọn lại, nên hộp bao của
 * vỏ và hình mà màn nội dung dựng không thể lệch trục nhau.
 */
function extentOf(data: ViewerShellData, footprintMm: {
  readonly minXMm: number;
  readonly minYMm: number;
  readonly maxXMm: number;
  readonly maxYMm: number;
}, separation: number): BuildingExtent {
  const storeys: readonly StackableStorey[] = data.storeys.map((storey) => ({
    id: storey.id,
    order: storey.order,
    elevationMm: storey.elevationMm,
    heightMm: storey.heightMm,
  }));

  const heightMm = stackedHeightMm(storeys, separation);
  const widthMm = footprintMm.maxXMm - footprintMm.minXMm;
  const depthMm = footprintMm.maxYMm - footprintMm.minYMm;

  if (widthMm <= 0 || depthMm <= 0 || heightMm <= 0) {
    return UNIT_EXTENT;
  }

  return {
    centre: new Vector3(
      toSceneLength(millimetres((footprintMm.minXMm + footprintMm.maxXMm) / 2)),
      toSceneLength(millimetres(heightMm / 2)),
      toSceneLength(millimetres((footprintMm.minYMm + footprintMm.maxYMm) / 2)),
    ),
    sizeM: new Vector3(
      toSceneLength(millimetres(widthMm)),
      toSceneLength(millimetres(heightMm)),
      toSceneLength(millimetres(depthMm)),
    ),
  };
}

/** Hộp bao ấy, viết lại theo sáu mặt để `sectionPlaneFor` dùng. */
function boundsOf(extent: BuildingExtent): ViewerBoundsM {
  return {
    minX: extent.centre.x - extent.sizeM.x / 2,
    minY: extent.centre.y - extent.sizeM.y / 2,
    minZ: extent.centre.z - extent.sizeM.z / 2,
    maxX: extent.centre.x + extent.sizeM.x / 2,
    maxY: extent.centre.y + extent.sizeM.y / 2,
    maxZ: extent.centre.z + extent.sizeM.z / 2,
  };
}

/** Góc chúc xuống của giàn trục đo: `DEFAULT_CAMERA_RIG` đo TỪ đường chân trời. */
const AXONOMETRIC_POLAR_RAD = Math.PI / 2 - DEFAULT_CAMERA_RIG.elevationRad;

/** Góc nhìn nào của vỏ chạy ở chế độ camera nào. */
const MODE_BY_PRESET: Readonly<Record<ViewerPresetId, CameraMode>> = Object.freeze({
  perspective: 'orbit',
  axonometric: 'top',
  top: 'top',
  section: 'top',
});

/** Preset thư viện tương ứng, cho hai góc nhìn mượn thẳng được. */
const LIBRARY_PRESET: Readonly<Partial<Record<ViewerPresetId, CameraPresetId>>> = Object.freeze({
  perspective: 'perspective',
  top: 'top',
});

/**
 * Điểm nhìn của một góc nhìn vỏ.
 *
 * Hai góc mượn thẳng `presetViewpoint` của thư viện. Hai góc còn lại
 * (`axonometric`, `section`) dựng từ `DEFAULT_CAMERA_RIG` — giàn trục đo đã
 * tinh chỉnh của `present/director.ts`, chứ không phải hai con số góc gõ tay
 * trong màn (R-71).
 */
function viewpointForPreset(
  preset: ViewerPresetId,
  extent: BuildingExtent,
  aspect: number,
): Viewpoint {
  const library = LIBRARY_PRESET[preset];

  if (library !== undefined) {
    return presetViewpoint(presetById(library), extent, aspect);
  }

  return {
    target: extent.centre.clone(),
    azimuthRad: restingHeading(DEFAULT_CAMERA_RIG),
    polarRad: AXONOMETRIC_POLAR_RAD,
    distanceM: Math.max(extent.sizeM.x, extent.sizeM.y, extent.sizeM.z) * DEFAULT_CAMERA_RIG.margin,
  };
}

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

export function useViewerShell(options: UseViewerShellOptions): ViewerShellProps {
  const {
    projectId,
    roles,
    forceState,
    isDev = false,
    perf = null,
    renderScene,
    registry = appShortcutRegistry,
    onOpenSearch,
  } = options;

  const reducedMotion = useReducedMotion();

  /* ---- Dữ liệu ---------------------------------------------------------- */

  const gateway = useMemo(
    () => options.gateway ?? createViewerShellFixtureGateway(),
    [options.gateway],
  );

  const storeSpatial = useStore((state) => state.spatial);
  const spatial = options.spatial !== undefined ? options.spatial : storeSpatial;

  const projectQuery = useQuery({
    queryKey: queryKeys.project.detail(projectId),
    queryFn: (): Promise<string | null> => gateway.readProjectName(projectId),
  });

  const data = useMemo<ViewerShellData>(
    () => (options.spatial !== undefined ? shellDataOf(spatial) : gateway.readShellData()),
    [gateway, options.spatial, spatial],
  );

  const footprint = useMemo(() => footprintOf(spatial), [spatial]);

  /* ---- Trạng thái người dùng lái ---------------------------------------- */

  const [activeToolId, setActiveToolId] = useState<ViewerToolId>('orbit');
  const [activePresetId, setActivePresetId] = useState<ViewerPresetId>('perspective');
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('3d');
  const [activeStoreyIds, setActiveStoreyIds] = useState<readonly string[]>([]);
  const [hiddenStoreyIds, setHiddenStoreyIds] = useState<readonly string[]>([]);
  const [separation, setSeparation] = useState(0);
  const [rememberedSeparation, setRememberedSeparation] = useState(SEPARATION_STEP);
  const [sectionPosition, setSectionPositionState] = useState(DEFAULT_SECTION_POSITION);
  const [hiddenEntityIds, setHiddenEntityIds] = useState<readonly string[]>([]);
  const [isolatedEntityIds, setIsolatedEntityIds] = useState<readonly string[] | null>(null);
  const [hoverPointPx, setHoverPointPx] = useState<ViewerPointPx | null>(null);
  const [isOrthographic, setIsOrthographic] = useState(false);

  const selectedIds = useStore((state) => state.selectedIds);
  const hoveredId = useStore((state) => state.hoveredId);
  const setSelection = useStore((state) => state.setSelection);
  const clearSelection = useStore((state) => state.clearSelection);
  const setHovered = useStore((state) => state.setHovered);

  /* ---- Camera ------------------------------------------------------------ */

  const extent = useMemo(
    () => extentOf(data, footprint, separation),
    [data, footprint, separation],
  );

  const directorRef = useRef<CameraDirector | null>(null);
  const [cameraTick, setCameraTick] = useState(0);
  const bumpCamera = useCallback((): void => {
    setCameraTick((tick) => tick + 1);
  }, []);

  if (directorRef.current === null) {
    const initial = viewpointForPreset('perspective', extent, PRESET_SETTINGS.defaultAspect);
    directorRef.current = new CameraDirector(
      createCameraMode('orbit', initial, { extent }),
      { extent },
      { reducedMotion },
    );
  }

  const director = directorRef.current;

  useEffect(() => {
    director.setReducedMotion(reducedMotion);
  }, [director, reducedMotion]);

  /**
   * Vòng cập nhật theo nhu cầu.
   *
   * Chỉ chạy khi có gì đó còn đang chuyển động: `update` trả về `false` là
   * camera đã đứng yên và vòng dừng hẳn. Đây là chỗ quán tính "dừng lại trong
   * khoảng 400 ms" xảy ra — bằng giảm chấn 0,08 của `CAMERA_SETTINGS`, không
   * bằng một con số 400 viết ở đâu đó.
   */
  const [isSettling, setIsSettling] = useState(false);

  useEffect(() => {
    if (!isSettling || typeof requestAnimationFrame !== 'function') {
      return undefined;
    }

    let frame = 0;
    let previousMs = 0;
    let cancelled = false;

    const step = (nowMs: number): void => {
      if (cancelled) {
        return;
      }

      const dtSeconds = previousMs === 0 ? 0 : (nowMs - previousMs) / 1_000;
      previousMs = nowMs;

      const moved = director.update(dtSeconds);
      bumpCamera();

      if (moved) {
        frame = requestAnimationFrame(step);
      } else {
        setIsSettling(false);
      }
    };

    frame = requestAnimationFrame(step);

    return (): void => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [isSettling, director, bumpCamera]);

  /**
   * Đánh thức vòng cập nhật.
   *
   * Giảm chuyển động thì KHÔNG có quán tính: camera ngồi thẳng vào đích trên
   * chính lần bấm đó, đúng câu "tắt quán tính quay" của đặc tả.
   */
  const wake = useCallback((): void => {
    if (reducedMotion) {
      director.controller.settle();
      bumpCamera();
      return;
    }

    setIsSettling(true);
  }, [director, reducedMotion, bumpCamera]);

  /* ---- Chuyển 2D ↔ 3D ---------------------------------------------------- */

  const sceneTransition = useSceneTransition(viewMode, { kind: 'view' });

  /* ---- Quyền ------------------------------------------------------------- */

  const canEdit = can('edit', 'layer', roles === undefined ? {} : { roles });

  const state: ViewerScreenState = useMemo(() => {
    if (forceState !== undefined) {
      return forceState;
    }

    if (!canEdit && roles !== undefined) {
      return 'forbidden';
    }

    if (projectQuery.isError) {
      return 'error';
    }

    if (projectQuery.isLoading) {
      return 'loading';
    }

    if (data.storeys.length === 0) {
      return 'empty';
    }

    return data.isPartial ? 'partial' : 'success';
  }, [forceState, canEdit, roles, projectQuery.isError, projectQuery.isLoading, data]);

  const tools = useMemo(
    () =>
      VIEWER_TOOLS.filter((tool) => !tool.requiresEdit || state !== 'forbidden').map(
        ({ id, label, keyLabel }): ViewerToolViewModel => ({ id, label, keyLabel }),
      ),
    [state],
  );

  /* ---- Tầng -------------------------------------------------------------- */

  const visibleStoreyIds = useMemo(
    () => data.storeys.map((storey) => storey.id).filter((id) => !hiddenStoreyIds.includes(id)),
    [data.storeys, hiddenStoreyIds],
  );

  const storeys = useMemo<readonly ViewerStoreyViewModel[]>(
    () =>
      data.storeys.map((storey) => ({
        id: storey.id,
        name: storey.name,
        code: storey.id,
        elevationLabel: formatLength(millimetres(storey.elevationMm), { unit: 'm' }),
        isActive: activeStoreyIds.includes(storey.id),
        isVisible: !hiddenStoreyIds.includes(storey.id),
        isReady: state !== 'loading' && !(state === 'partial' && storey.order > 0),
      })),
    [data.storeys, activeStoreyIds, hiddenStoreyIds, state],
  );

  const onStoreyActivate = useCallback((id: string, additive: boolean): void => {
    setActiveStoreyIds((current) => {
      if (!additive) {
        return [id];
      }

      return current.includes(id) ? current.filter((each) => each !== id) : [...current, id];
    });
  }, []);

  const onStoreyVisibilityToggle = useCallback((id: string): void => {
    setHiddenStoreyIds((current) =>
      current.includes(id) ? current.filter((each) => each !== id) : [...current, id],
    );
  }, []);

  const onSeparationChange = useCallback((value: number): void => {
    const next = clampSeparation(value);
    setSeparation(next);

    if (next > 0) {
      setRememberedSeparation(next);
    }
  }, []);

  /* ---- Mặt cắt ----------------------------------------------------------- */

  const sectionPlane = useMemo<ViewerSectionPlaneValue | null>(() => {
    if (activePresetId !== 'section' && activeToolId !== 'section') {
      return null;
    }

    return sectionPlaneFor(boundsOf(extent), DEFAULT_SECTION_AXIS, sectionPosition);
  }, [activePresetId, activeToolId, extent, sectionPosition]);

  /**
   * Tay nắm mặt phẳng cắt gọi vào đây qua {@link ViewerSceneActions.setSectionPosition}.
   *
   * Giá trị luôn đi qua `clampSectionPosition` — không tự kẹp biên bằng tay ở
   * đây hay ở màn nội dung — nên `sectionPosition` không bao giờ rời [0, 1]
   * dù tay nắm kéo quá đầu thanh trượt.
   */
  const setSectionPosition = useCallback((value: number): void => {
    setSectionPositionState(clampSectionPosition(value));
  }, []);

  /* ---- Camera: hành động ------------------------------------------------- */

  const goToPreset = useCallback(
    (preset: ViewerPresetId): void => {
      setActivePresetId(preset);
      setIsOrthographic(MODE_BY_PRESET[preset] !== 'orbit');
      director.goTo(
        viewpointForPreset(preset, extent, PRESET_SETTINGS.defaultAspect),
        MODE_BY_PRESET[preset],
      );
      wake();
    },
    [director, extent, wake],
  );

  const onFitAll = useCallback((): void => {
    director.goTo(
      viewpointForPreset(activePresetId, extent, PRESET_SETTINGS.defaultAspect),
      MODE_BY_PRESET[activePresetId],
    );
    wake();
  }, [director, activePresetId, extent, wake]);

  const frameSelection = useCallback((): void => {
    if (selectedIds.length === 0) {
      onFitAll();
      return;
    }

    const transition = director.frameObjects(selectedIds);

    if (transition === null) {
      onFitAll();
      return;
    }

    wake();
  }, [director, selectedIds, onFitAll, wake]);

  const toggleOrthographic = useCallback((): void => {
    setIsOrthographic((current) => {
      const next = !current;
      director.goTo(director.viewpoint(), next ? 'top' : 'orbit');
      wake();
      return next;
    });
  }, [director, wake]);

  /* ---- Con trỏ ----------------------------------------------------------- */

  const dragRef = useRef<ViewerPointPx | null>(null);

  const onViewportPointerDown = useCallback(
    (point: ViewerPointPx): void => {
      dragRef.current = point;
      director.interrupt();
    },
    [director],
  );

  const onViewportPointerMove = useCallback(
    (point: ViewerPointPx, buttons: number): void => {
      setHoverPointPx(point);

      const previous = dragRef.current;

      if (previous === null || buttons === 0) {
        return;
      }

      const deltaX = point.x - previous.x;
      const deltaY = point.y - previous.y;
      dragRef.current = point;

      const controller = director.controller;

      if (activeToolId === 'pan' && 'pan' in controller) {
        (controller as { pan: (x: number, y: number, height: number) => void }).pan(
          deltaX,
          deltaY,
          window.innerHeight,
        );
      } else if ('rotate' in controller) {
        (controller as { rotate: (x: number, y: number) => void }).rotate(deltaX, deltaY);
      }

      wake();
    },
    [director, activeToolId, wake],
  );

  const onViewportPointerUp = useCallback((): void => {
    dragRef.current = null;
  }, []);

  const onViewportWheel = useCallback(
    (notches: number): void => {
      const controller = director.controller;

      if ('dolly' in controller) {
        (controller as { dolly: (n: number) => void }).dolly(notches * DOLLY_NOTCH);
        wake();
      }
    },
    [director, wake],
  );

  const onViewportDoubleClick = useCallback((): void => {
    frameSelection();
  }, [frameSelection]);

  /* ---- Bàn phím (I-01) --------------------------------------------------- */

  const handlersRef = useRef<ViewerShortcutHandlers | null>(null);

  handlersRef.current = {
    selectStorey: (index: number): void => {
      const storey = data.storeys[index];

      if (storey !== undefined) {
        onStoreyActivate(storey.id, false);
      }
    },
    fitAll: onFitAll,
    toggleOrthographic,
    hideSelection: (): void => {
      setHiddenEntityIds((current) => [
        ...current,
        ...selectedIds.filter((id) => !current.includes(id)),
      ]);
    },
    isolateSelection: (): void => {
      setIsolatedEntityIds((current) => (current === null ? [...selectedIds] : null));
    },
    frameSelection,
    toggleSeparation: (): void => {
      setSeparation((current) => (current > 0 ? 0 : rememberedSeparation));
    },
    activateMeasure: (): void => {
      setActiveToolId('measure');
    },
    openSearch: (): void => {
      onOpenSearch?.();
    },
    clearSelection,
  };

  useEffect(() => {
    const proxy: ViewerShortcutHandlers = {
      selectStorey: (index) => handlersRef.current?.selectStorey(index),
      fitAll: () => handlersRef.current?.fitAll(),
      toggleOrthographic: () => handlersRef.current?.toggleOrthographic(),
      hideSelection: () => handlersRef.current?.hideSelection(),
      isolateSelection: () => handlersRef.current?.isolateSelection(),
      frameSelection: () => handlersRef.current?.frameSelection(),
      toggleSeparation: () => handlersRef.current?.toggleSeparation(),
      activateMeasure: () => handlersRef.current?.activateMeasure(),
      openSearch: () => handlersRef.current?.openSearch(),
      clearSelection: () => handlersRef.current?.clearSelection(),
    };

    const disposers = buildViewerShortcuts(proxy).map((definition) =>
      registry.register(definition),
    );

    return (): void => {
      for (const dispose of disposers) {
        dispose();
      }
    };
  }, [registry]);

  useEffect(() => {
    if (selectedIds.length === 0) {
      return undefined;
    }

    return registry.register(
      buildDeselectShortcut({
        clearSelection: (): void => {
          handlersRef.current?.clearSelection();
        },
      }),
    );
  }, [registry, selectedIds.length]);

  /* ---- Viewmodel --------------------------------------------------------- */

  const viewpoint = director.viewpoint();

  const frame = useMemo(
    () => ({
      azimuthRad: viewpoint.azimuthRad,
      polarRad: viewpoint.polarRad,
      distanceM: viewpoint.distanceM,
      isOrthographic,
      visibleStoreyIds,
      separation,
      sectionPlane,
      selectedEntityIds: selectedIds,
      hoveredEntityId: hoveredId,
      isolatedEntityIds,
      hiddenEntityIds,
      reducedMotion,
    }),
    /* `cameraTick` là chỗ vòng cập nhật báo cho viewmodel biết camera đã dịch. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      cameraTick,
      viewpoint.azimuthRad,
      viewpoint.polarRad,
      viewpoint.distanceM,
      isOrthographic,
      visibleStoreyIds,
      separation,
      sectionPlane,
      selectedIds,
      hoveredId,
      isolatedEntityIds,
      hiddenEntityIds,
      reducedMotion,
    ],
  );

  const selection = useMemo<ViewerSelectionViewModel | null>(() => {
    const entityId = selectedIds[0];

    if (entityId === undefined || spatial === null) {
      return null;
    }

    const entity = spatial.byId[entityId];

    if (entity === undefined) {
      return null;
    }

    const rows: ViewerPropertyRow[] = [{ id: 'id', label: 'mã đối tượng', value: entityId }];

    if ('areaM2' in entity) {
      rows.push({
        id: 'area',
        label: 'diện tích',
        value: formatArea((entity as { areaM2: number }).areaM2),
      });
    }

    if ('thicknessMm' in entity) {
      rows.push({
        id: 'thickness',
        label: 'độ dày',
        value: formatLength(millimetres((entity as { thicknessMm: number }).thicknessMm)),
      });
    }

    if ('name' in entity) {
      rows.push({ id: 'name', label: 'tên', value: String((entity as { name: string }).name) });
    }

    const kindLabel = entityId.startsWith('R-') ? 'phòng' : entityId.startsWith('W-') ? 'tường' : 'đối tượng';

    return { entityId, kindLabel, title: `${kindLabel} ${entityId}`, rows };
  }, [selectedIds, spatial]);

  const status = useMemo(() => {
    const parts = [
      `${formatNumber(data.storeys.length)} tầng`,
      `${formatNumber(data.roomCount)} phòng`,
      formatArea(data.totalAreaM2),
    ];

    if (perf !== null) {
      parts.push(`${formatNumber(perf.frameRate)} fps`);
    }

    return {
      summary: parts.join(' · '),
      liveMessage: sceneTransition.isRunning || state === 'loading' ? BUILDING_MESSAGE : READY_MESSAGE,
    };
  }, [data, perf, sceneTransition.isRunning, state]);

  /**
   * Mức thu phóng, ĐÃ ĐỊNH DẠNG ở đây chứ không ở view (A15).
   *
   * Tỉ lệ giữa khoảng cách khuôn hình chuẩn và khoảng cách camera đang đứng:
   * đứng đúng chỗ khuôn thì là mức chuẩn, lại gần thì lớn hơn.
   * `formatPercent` của `src/lib/format/number` lo phần chữ, nên view không có
   * phép chia hay `toFixed` nào — thứ `local/no-raw-number` cấm.
   */
  const zoomLabel = useMemo(() => {
    const framed = viewpointForPreset(activePresetId, extent, PRESET_SETTINGS.defaultAspect);

    if (viewpoint.distanceM <= 0) {
      return formatPercent(1);
    }

    return formatPercent(framed.distanceM / viewpoint.distanceM);
  }, [activePresetId, extent, viewpoint.distanceM]);

  const hoverLabel = useMemo(() => {
    if (hoveredId === null || spatial === null) {
      return null;
    }

    const entity = spatial.byId[hoveredId];

    if (entity !== undefined && 'name' in entity) {
      return String((entity as { name: string }).name);
    }

    return hoveredId;
  }, [hoveredId, spatial]);

  /**
   * Hai việc cảnh 3D báo ngược lên vỏ.
   *
   * Đây là chiều "3D → panel" của S-11: chỉ cảnh biết con trỏ đang chỉ vào tam
   * giác của đối tượng nào, nên nó gọi vào đây, vỏ ghi vào KHO CHỌN DÙNG CHUNG
   * (`selectionSlice`), và cả panel phải lẫn mọi màn khác đang mở cùng đọc một
   * nguồn. Chiều ngược lại không cần dây riêng vì nó đi qua chính kho ấy.
   *
   * Ghi vào kho bằng action của slice (`setSelection`, `setHovered`), KHÔNG gọi
   * `set()` — A10 và `local/no-direct-set`.
   */
  const sceneActions = useMemo(
    () => ({
      selectEntity: (entityId: string | null, additive: boolean): void => {
        if (entityId === null) {
          clearSelection();
          return;
        }

        setSelection(
          additive && !selectedIds.includes(entityId as (typeof selectedIds)[number])
            ? [...selectedIds, entityId as (typeof selectedIds)[number]]
            : [entityId as (typeof selectedIds)[number]],
        );
      },
      hoverEntity: (entityId: string | null): void => {
        setHovered(entityId as (typeof selectedIds)[number] | null);
      },
      setSectionPosition,
    }),
    [clearSelection, setSelection, setHovered, selectedIds, setSectionPosition],
  );

  const breadcrumbs = useMemo(
    () => [
      { id: 'project', label: projectQuery.data ?? 'Dự án' },
      { id: 'viewer', label: 'Mô hình 3D' },
    ],
    [projectQuery.data],
  );

  return {
    state,

    breadcrumbs,
    viewMode,
    onViewModeChange: setViewMode,
    presets: VIEWER_PRESETS,
    activePresetId,
    onPresetChange: goToPreset,

    tools,
    activeToolId,
    onToolChange: setActiveToolId,

    storeys,
    onStoreyActivate,
    onStoreyVisibilityToggle,
    separation,
    onSeparationChange,
    separationLabel: 'Độ tách',

    frame,
    sceneActions,
    ...(renderScene !== undefined ? { renderScene } : {}),
    onViewportPointerMove,
    onViewportPointerDown,
    onViewportPointerUp,
    onViewportWheel,
    onViewportDoubleClick,
    hoverLabel,
    hoverPointPx,

    onCubeFaceSelect: goToPreset,
    zoomLabel,
    onZoomIn: (): void => {
      onViewportWheel(-ZOOM_BUTTON_NOTCHES);
    },
    onZoomOut: (): void => {
      onViewportWheel(ZOOM_BUTTON_NOTCHES);
    },
    onZoomReset: onFitAll,
    onFitAll,
    legend: VIEWER_LEGEND,
    perf: isDev && perf !== null ? { trianglesLabel: `${formatNumber(perf.triangles)} tam giác` } : null,

    selection,
    inspectorHint: INSPECTOR_HINT,
    scrollToEntityId: selectedIds[0] ?? null,

    status,

    errorMessage: state === 'error' ? ERROR_MESSAGE : null,
    onRetry: (): void => {
      void projectQuery.refetch();
    },
  };
}

/** Những phím vỏ đăng ký, để bảng phím tắt và bài kiểm đọc chung một nguồn. */
export const VIEWER_KEY_LABELS = Object.freeze({
  frame: FRAME_COMBO,
  hide: HIDE_COMBO,
  isolate: ISOLATE_COMBO,
  measure: MEASURE_COMBO,
  orthographic: ORTHOGRAPHIC_COMBO,
});

/** Danh sách công cụ chưa lọc theo vai — story và bài kiểm đếm trên nó. */
export const ALL_VIEWER_TOOLS = VIEWER_TOOLS;
