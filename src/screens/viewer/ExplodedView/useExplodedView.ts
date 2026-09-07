/**
 * Hook của màn `ExplodedView`: nối lại logic đã có, không phát minh thêm cái nào.
 *
 * Mỗi việc dưới đây đã có chủ, và hook chỉ đưa dữ liệu đi qua đúng chủ của nó:
 *
 * | Việc | Ai làm |
 * |---|---|
 * | Chrome, camera, ray tầng, thanh trượt độ tách, phím `E` | `useViewerShell` của vỏ |
 * | Đồ thị → đầu vào của R-01 | `toBuildFloorInput` (`@/domain/spatial`) |
 * | Tầng, cao độ, chiều cao, tổng diện tích | `shellDataOf` của vỏ |
 * | Cao độ thành chuỗi | `formatLength` — ĐÚNG hàm vỏ dùng cho `elevationLabel` |
 * | Diện tích từng tầng | `readFloorAreas` của cổng màn → `totalArea` của `src/domain` |
 * | Thẳng hàng giữa các tầng | `readAlignment` của cổng màn → `alignFloors` của `src/domain` |
 * | Vị trí tầng khi tách | `stackStoreys` / `storeySpreadMm` / `stackedHeightMm` của vỏ |
 * | Tô màu | `createColoringMode('default', …)` — một token cho cả mô hình |
 * | Chụp ảnh | `captureViewport` (`src/lib/export/screenshot`) |
 * | Phím tắt | `useShortcut` → `shortcutRegistry` (R-54, A12) |
 * | `isLoading` / `error` | `useQuery` / `useMutation` của `@tanstack/react-query` (R-64) |
 *
 * ## Hai hàm, và vì sao hai
 *
 * - {@link useExplodedView} là hook màn: nó gọi `useViewerShell`, giữ canvas, lắp
 *   cảnh, đăng ký phím `Space`, và trả về `ViewerShellProps` ĐỦ để container dựng
 *   `<ViewerShell {...props} />` bằng đúng một thẻ.
 * - {@link explodedViewPropsOf} là phép THUẦN dựng `ExplodedViewProps` từ
 *   `UseExplodedViewOptions` của hợp đồng cộng phần chỉ hook biết. Nó tách ra vì
 *   `renderScene` được gọi TRONG lượt vẽ của `ViewerViewport`, tức sau khi hook đã
 *   trả về — nên phép dựng props không được là một hook, và một phép thuần thì bài
 *   kiểm gọi được không cần dựng cây React.
 *
 * ## `onSeparationChange` chỉ có ở đây, không có trong `renderScene`
 *
 * `ViewerSceneActions` — đối số thứ hai của `renderScene` — chỉ có `selectEntity`,
 * `hoverEntity`, `setSectionPosition?`. Setter thật của độ tách là
 * `ViewerShellProps.onSeparationChange`, thứ chỉ người GỌI `useViewerShell` cầm
 * được. Nên hàng ba mức sẵn đi qua {@link ExplodedViewActions} mà hook đóng gói,
 * và closure `renderScene` do chính hook dựng.
 *
 * ## Thả thanh trượt KHÔNG bắt về mức sẵn
 *
 * `activePresetId` là `null` khi độ tách không khớp mức nào — một câu trả lời,
 * không phải một lệnh. Không nơi nào trong file này gọi `onSeparationChange` để
 * kéo một giá trị tự do về mức gần nhất.
 *
 * ## Phím: `E` là của vỏ, `Space` là của màn
 *
 * Vỏ đã đăng ký `E` (bật tắt tách) qua `buildViewerShortcuts`. Đăng ký lại nó ở
 * đây là hai người trả lời một phím. `Space` chạy một lượt tách rồi hợp: hai chặng
 * `EXPLODED_MOTION_MS.cycleHalfMs` nối nhau, hẹn bằng `setTimeout` với thời lượng
 * lấy từ hằng ấy — không một con số viết tay nào (R-71), không một bộ đếm thời
 * gian lặp nào, và không một lượt hẹn khung hình nào (vòng vẽ là của cảnh).
 *
 * ## Giảm chuyển động
 *
 * `frame.reducedMotion` đi thẳng xuống cảnh, và ở đó `conditionedDurationMs` cùng
 * `staggerDelaysMs` làm mọi thời lượng và mọi độ trễ về 0 — mức sẵn NHẢY THẲNG,
 * không chạy vị trí. Hook không có nhánh thứ hai cho ca ấy, vì một nhánh thứ hai
 * là chỗ hai đường đi bắt đầu lệch nhau.
 */

import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { useMutation } from '@tanstack/react-query';

import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import { toBuildFloorInput } from '@/domain/spatial/toBuildFloorInput';
import { compareNearly } from '@/domain/units/compare';
import { millimetres } from '@/domain/units/types';
import { useShortcut, useShortcutListener } from '@/hooks/useShortcut';
import { createColoringMode } from '@/lib/coloring/modes';
import type { PaintSubject } from '@/lib/coloring/modes';
import { UNPAINTED_TOKEN, type ColorTokenName } from '@/lib/coloring/scales';
import type { CaptureResult } from '@/lib/export/screenshot';
import { formatArea, formatLength } from '@/lib/format/measure';
import { formatPercent } from '@/lib/format/number';
import type { ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import type { BuildFloorInput } from '@/lib/three/build/floor';
import type { ViewerSceneStatus } from '@/screens/viewer/Viewer3D/viewer3dTypes';
import { useStore } from '@/store';
import {
  createViewerShellGateway,
  shellDataOf,
  stackedHeightMm,
  storeySpreadMm,
  useViewerShell,
  type ViewerShellGateway,
} from '@/screens/viewer/ViewerShell';
import {
  MAX_SEPARATION,
  MIN_SEPARATION,
} from '@/screens/viewer/ViewerShell/viewerStoreyStack';
import type {
  ViewerSceneFrame,
  ViewerShellProps,
} from '@/screens/viewer/ViewerShell/viewerShellTypes';
import type { ProjectRole } from '@/types/project';

import { ExplodedView } from './ExplodedView';
import {
  axisProbesOf,
  createExplodedViewGateway,
  floorProbesOf,
  type ExplodedAxisProbe,
} from './explodedViewGateway';
import {
  mountExplodedScene,
  type ExplodedSceneHandle,
  type MountExplodedScene,
} from './explodedViewScene';
import {
  EXPLODE_PRESETS,
  EXPLODED_MOTION_MS,
  LABEL_REVEAL_SEPARATION,
  type AlignmentReportLike,
  type ExplodedAlignmentPath,
  type ExplodedElevationTick,
  type ExplodedFloorProbe,
  type ExplodedFloorViewModel,
  type ExplodePresetId,
  type ExplodedViewActions,
  type ExplodedViewGateway,
  type ExplodedViewProps,
  type ExplodedViewState,
  type UseExplodedViewOptions,
} from './explodedViewTypes';

/* -------------------------------------------------------------------------- */
/* Hằng số.                                                                    */
/* -------------------------------------------------------------------------- */

/** Phím chạy một lượt tách rồi hợp. `E` đã là của vỏ và không được đăng ký lại. */
export const EXPLODE_CYCLE_COMBO = 'Space';

/** Mã binding — cái tên mà cảnh báo trùng phím của registry in ra. */
const EXPLODE_CYCLE_ID = 'explodedView.separation.cycle';

/** Câu tiếng Việt cho bảng phím tắt. Khoá `explodedView.logic.cycleShortcut`. */
const EXPLODE_CYCLE_DESCRIPTION = 'tách các tầng ra rồi hợp lại';

/** Ít hơn số này thì không có gì để tách — một tầng không tách khỏi chính nó. */
const MIN_EXPLODABLE_STOREYS = 2;

/** Khoá `explodedView.logic.liveSeparation`. */
const LIVE_SEPARATION_PREFIX = 'đã tách ';

/** Khoá `explodedView.logic.captureError`. */
const CAPTURE_ERROR_MESSAGE =
  'Chưa chụp được khung nhìn. Đợi mô hình dựng xong rồi bấm chụp lại.';

/** Khoá `explodedView.logic.captureUnavailable`. */
const CAPTURE_UNAVAILABLE_MESSAGE = 'Khung nhìn chưa có gì để chụp.';

const NO_LEVELS: readonly BuildFloorInput[] = Object.freeze([]);
const NO_SUBJECTS: readonly PaintSubject[] = Object.freeze([]);
const NO_TICKS: readonly ExplodedElevationTick[] = Object.freeze([]);
const NO_FLOORS: readonly ExplodedFloorViewModel[] = Object.freeze([]);
const NO_PATHS: readonly ExplodedAlignmentPath[] = Object.freeze([]);

/** Không tầng nào có diện tích — một bảng rỗng, dùng chung. */
const NO_AREAS: ReadonlyMap<string, number> = new Map<string, number>();

/** Chưa dựng gì cả — cùng hình dạng `IDLE_STATUS` của khung nhìn 3D. */
const IDLE_STATUS: ViewerSceneStatus = Object.freeze({
  phase: 'idle',
  progress: Object.freeze({
    settledCount: 0,
    totalCount: 0,
    failedCount: 0,
    readyLevelIds: Object.freeze([]),
  }),
});

/* -------------------------------------------------------------------------- */
/* Phép thuần: từ hợp đồng ra props.                                           */
/* -------------------------------------------------------------------------- */

/**
 * Những gì CHỈ hook biết, ngoài {@link UseExplodedViewOptions}.
 *
 * Bốn nhóm: cờ đã duyệt của từng tầng và trục của đồ thị (cả hai đọc từ đồ thị,
 * và `ExplodedViewGateway` cố ý hẹp hơn thế), trạng thái con trỏ và lượt chụp, và
 * ba callback mà chỉ vòng đời React dựng được.
 */
export interface ExplodedViewRuntime {
  /** Bảy trạng thái đã tính từ vỏ, cảnh và dữ liệu. `forceState` vẫn thắng nó. */
  readonly state: ExplodedViewState;
  /** Tầng của đồ thị, kèm cờ người duyệt. */
  readonly floors: readonly ExplodedFloorProbe[];
  /** Trục của đồ thị, đã đặt lên khung nhìn. */
  readonly axes: readonly ExplodedAxisProbe[];
  readonly hoveredStoreyId: string | null;
  readonly isCapturing: boolean;
  readonly captureError: string | null;
  readonly onFloorHover: (storeyId: string | null) => void;
  readonly onCapture: () => void;
  readonly canvasRef: (canvas: HTMLCanvasElement | null) => void;
}

/** Mức sẵn nào khớp độ tách này, hoặc `null` khi người dùng đang kéo tự do. */
export function activePresetIdOf(separation: number): ExplodePresetId | null {
  const preset = EXPLODE_PRESETS.find(
    (candidate) => compareNearly(candidate.separation, separation) === 0,
  );

  return preset?.id ?? null;
}

/**
 * Chỗ đứng của một tầng trên thang cao độ của khung nhìn, tỉ lệ [0, 1] từ dưới lên.
 *
 * Đo theo cao độ ĐANG TÁCH, không theo cao độ thật: thẻ nhãn đi cùng tầng của nó
 * nên khi chồng tầng giãn ra, thẻ giãn theo. Mẫu số là chiều cao của chính chồng
 * ấy ở cùng độ tách, nên tỉ lệ không bao giờ ra ngoài đoạn.
 */
function railFractionOf(
  storey: ExplodedFloorProbe,
  storeys: readonly ExplodedFloorProbe[],
  separation: number,
): number {
  const topMm = stackedHeightMm(storeys, separation);

  if (!Number.isFinite(topMm) || topMm <= 0) {
    return 0;
  }

  return Math.min(1, Math.max(0, (storey.elevationMm + storeySpreadMm(storey, separation)) / topMm));
}

/**
 * Câu cần chú ý của một tầng, hoặc `null`.
 *
 * Câu lấy NGUYÊN VĂN từ `FloorIssue.message` — nó đã nói đúng tên tầng, đúng số
 * milimét và đúng ngưỡng, và dựng lại nó ở đây là dựng bản thứ hai của một câu đã
 * có test (R-61).
 */
function attentionCaptionOf(levelId: string, alignment: AlignmentReportLike | null): string | null {
  const issue = alignment?.issues.find(
    (candidate) => candidate.levelId === levelId && candidate.severity === 'attention',
  );

  return issue?.message ?? null;
}

/** Thẻ nhãn của từng tầng, mọi con số ĐÃ là chuỗi (A15). */
function floorsOf(
  options: UseExplodedViewOptions,
  probes: readonly ExplodedFloorProbe[],
  areas: ReadonlyMap<string, number>,
  alignment: AlignmentReportLike | null,
): readonly ExplodedFloorViewModel[] {
  const separation = options.frame.separation;
  const shellById = new Map(options.storeys.map((storey) => [storey.id, storey]));

  return probes.map((probe): ExplodedFloorViewModel => {
    const shell = shellById.get(probe.id);

    return {
      id: probe.id,
      name: shell?.name ?? probe.name,
      // Chuỗi cao độ của VỎ, không một định dạng thứ hai: `useViewerShell` đã gọi
      // `formatLength(…, { unit: 'm' })` và hai bản sẽ lệch nhau vào đúng lúc
      // không ai nhìn.
      elevationLabel:
        shell?.elevationLabel ?? formatLength(millimetres(probe.elevationMm), { unit: 'm' }),
      // Tầng chưa có phòng nào KHÔNG có mục trong bảng, và `formatArea(null)` là
      // "—" — đúng thứ hợp đồng nói.
      areaLabel: formatArea(areas.get(probe.id) ?? null),
      isVisible: shell?.isVisible ?? true,
      isReady: shell?.isReady ?? true,
      needsReview: !probe.reviewed,
      attentionCaption: attentionCaptionOf(probe.id, alignment),
      railFraction: railFractionOf(probe, probes, separation),
    };
  });
}

/** Vạch đánh dấu trên đường nối dọc, một vạch cho mỗi tầng. */
function ticksOf(
  floors: readonly ExplodedFloorViewModel[],
): readonly ExplodedElevationTick[] {
  return floors.map((floor) => ({
    storeyId: floor.id,
    fraction: floor.railFraction,
    label: floor.elevationLabel,
  }));
}

/**
 * Một đường dẫn dọc cho mỗi trục.
 *
 * `tone` và `caption` do HOOK quyết, không do view: view chỉ đọc `tone` và không
 * bao giờ suy màu từ một con số (A1, A15). `residualMm` đi kèm để bài kiểm khẳng
 * định con số chứ không khẳng định câu chữ.
 */
function alignmentPathsOf(
  axes: readonly ExplodedAxisProbe[],
  alignment: AlignmentReportLike | null,
): readonly ExplodedAlignmentPath[] {
  return axes.map((axis): ExplodedAlignmentPath => {
    const issue = alignment?.issues.find(
      (candidate) => candidate.levelId === axis.levelId && candidate.severity === 'attention',
    );

    return {
      id: axis.id,
      xFraction: axis.xFraction,
      tone: issue === undefined ? 'aligned' : 'attention',
      caption: issue?.message ?? null,
      residualMm: millimetres(issue?.amountMm ?? 0),
    };
  });
}

/**
 * `ExplodedViewProps` đầy đủ, dựng từ hợp đồng cộng phần chỉ hook biết.
 *
 * Phép THUẦN: không hook, không kho, không mạng. Đó là lý do closure `renderScene`
 * gọi được nó ngay trong lượt vẽ của `ViewerViewport`, và bài kiểm gọi được nó
 * không cần dựng cây React.
 */
export function explodedViewPropsOf(
  options: UseExplodedViewOptions,
  runtime: ExplodedViewRuntime,
): ExplodedViewProps {
  const separation = options.frame.separation;
  const state = options.forceState ?? runtime.state;

  const areas = options.gateway?.readFloorAreas() ?? NO_AREAS;
  const alignment = options.gateway?.readAlignment() ?? null;

  const floors = floorsOf(options, runtime.floors, areas, alignment);

  const lowest = runtime.floors[0];
  const topMm = stackedHeightMm(runtime.floors, MIN_SEPARATION);

  const actions: ExplodedViewActions = {
    onPresetSelect: (id: ExplodePresetId): void => {
      const preset = EXPLODE_PRESETS.find((candidate) => candidate.id === id);

      if (preset !== undefined) {
        options.onSeparationChange(preset.separation);
      }
    },
    // Liên tục, không trễ, và thả ra KHÔNG bắt về mức sẵn: đây là đúng cái setter
    // của vỏ, gọi thẳng.
    onSeparationChange: options.onSeparationChange,
    onFloorHover: runtime.onFloorHover,
    onFloorActivate: (storeyId: string): void => {
      options.onStoreyActivate(storeyId, false);
    },
    onFloorVisibilityToggle: options.onStoreyVisibilityToggle,
    onCapture: runtime.onCapture,
  };

  return {
    state,
    separation,
    activePresetId: activePresetIdOf(separation),
    presets: EXPLODE_PRESETS,
    minLabel:
      lowest === undefined
        ? formatLength(millimetres(0), { unit: 'm' })
        : formatLength(millimetres(lowest.elevationMm), { unit: 'm' }),
    maxLabel: formatLength(millimetres(topMm), { unit: 'm' }),
    areLabelsVisible: separation > LABEL_REVEAL_SEPARATION,
    floors: floors.length === 0 ? NO_FLOORS : floors,
    ticks: floors.length === 0 ? NO_TICKS : ticksOf(floors),
    alignmentPaths: runtime.axes.length === 0 ? NO_PATHS : alignmentPathsOf(runtime.axes, alignment),
    hoveredStoreyId: runtime.hoveredStoreyId,
    reducedMotion: options.frame.reducedMotion,
    isCollapsed: state === 'collapsed',
    liveMessage: `${LIVE_SEPARATION_PREFIX}${formatPercent(separation, { fractionDigits: 0 })}`,
    isCapturing: runtime.isCapturing,
    captureError: runtime.captureError,
    actions,
    canvasRef: runtime.canvasRef,
  };
}

/* -------------------------------------------------------------------------- */
/* Tuỳ chọn của hook màn.                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Tuỳ chọn của {@link useExplodedView}.
 *
 * Cố ý KHÔNG phải `UseExplodedViewOptions`: năm trường kia của hợp đồng
 * (`frame`, `storeys`, và ba callback của ray tầng) là thứ `useViewerShell` TRẢ
 * VỀ, nên đòi chúng ở đầu vào là đòi người gọi cấp một thứ chỉ có sau khi hook đã
 * chạy. Hook tự ghép chúng vào rồi đưa cả gói cho {@link explodedViewPropsOf}.
 */
export interface UseExplodedViewScreenOptions {
  readonly projectId: string;
  /** Cổng riêng của màn. Vắng mặt thì hook dựng cổng THẬT đọc kho. */
  readonly gateway?: ExplodedViewGateway;
  /** Cổng của vỏ. Vắng mặt thì hook dựng cổng THẬT đọc kho, không phải cổng giả. */
  readonly shellGateway?: ViewerShellGateway;
  /** Đồ thị tiêm cho story/bài kiểm; vắng mặt thì đọc kho. */
  readonly spatial?: NormalizedSpatial | null;
  /** Vai người xem. Vắng mặt KHÔNG vào `forbidden` — "chưa biết vai" khác "không có quyền". */
  readonly roles?: readonly ProjectRole[];
  /** Ép một trong bảy trạng thái, cho story và bài kiểm A11. */
  readonly forceState?: ExplodedViewState;
  readonly isDev?: boolean;
  readonly perf?: { readonly frameRate: number; readonly triangles: number } | null;
  readonly registry?: ShortcutRegistry;
  /** Thay module cảnh, cho bài kiểm không cần WebGL. */
  readonly mountScene?: MountExplodedScene;
  /** Khe `/` của vỏ; vỏ gọi nó khi người dùng bấm phím tìm. */
  readonly onOpenSearch?: () => void;
}

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Mọi thứ container của `ExplodedView` cần, và không gì hơn.
 *
 * @param options Dự án, hai cổng, và các chỗ tiêm cho story và bài kiểm.
 * @returns `ViewerShellProps` đủ để dựng `<ViewerShell {...props} />` bằng đúng
 * một thẻ, `renderScene` đã cắm sẵn.
 */
export function useExplodedView(options: UseExplodedViewScreenOptions): ViewerShellProps {
  /* A12: giữ listener bàn phím sống suốt lúc màn còn gắn. Thiếu nó thì phím vỏ
     đăng ký — kể cả `E` — không bao giờ tới được sổ phím. `useShortcut` cũng tự
     thuê listener, nên gọi ở đây không attach hai lần: sổ thuê đếm người giữ. */
  useShortcutListener(options.registry !== undefined ? { registry: options.registry } : {});

  /* ---- Kho: đọc một lần -------------------------------------------------- */

  const storeSpatial = useStore((state) => state.spatial);
  const spatial = options.spatial !== undefined ? options.spatial : storeSpatial;

  /* ---- Hai cổng ---------------------------------------------------------- */

  const shellGateway = useMemo(
    () => options.shellGateway ?? createViewerShellGateway(() => useStore.getState().spatial),
    [options.shellGateway],
  );

  /**
   * Đồ thị mà cổng đọc là đồ thị ĐÃ PHÂN GIẢI ở trên, không phải kho.
   *
   * Đọc thẳng `useStore.getState().spatial` ở đây là một lỗi im lặng: khi người
   * gọi truyền `spatial` bằng props — story, bài kiểm, và bất kỳ màn cha nào biết
   * rõ hơn kho — thì vỏ dùng props còn cổng này vẫn dùng kho, nên thẻ nhãn mất
   * sạch diện tích (`—` ở mọi tầng) và báo cáo thẳng hàng ra rỗng, trong khi thanh
   * trạng thái ngay bên cạnh vẫn nói "4 tầng · 14 phòng · 248,60 m²". Hai nguồn
   * cho cùng một màn, và chỉ lộ ra khi mở màn thật bằng dữ liệu thật.
   *
   * Đọc qua ref chứ không đưa `spatial` vào mảng phụ thuộc: cổng giữ nguyên danh
   * tính qua các lượt vẽ (`renderScene` chạy lại mỗi khung hình), còn lớp nhớ bọc
   * ngoài mới là chỗ dựng lại theo `spatial` — đúng chỗ nó đã làm sẵn.
   */
  const spatialRef = useRef(spatial);
  spatialRef.current = spatial;

  const gateway = useMemo(
    () => options.gateway ?? createExplodedViewGateway(() => spatialRef.current),
    [options.gateway],
  );

  /**
   * Cổng bọc thêm một lượt nhớ, và nó không phải một tối ưu tuỳ hứng.
   *
   * `renderScene` chạy lại MỖI KHUNG HÌNH trong lúc camera của vỏ còn đang bay, và
   * {@link explodedViewPropsOf} đọc cổng ở mỗi lượt. Không có lớp nhớ này thì mỗi
   * khung hình kéo theo một lượt cộng diện tích đa giác của mọi phòng cộng một lượt
   * `detectAxes` + `alignFloors` cho cả chồng tầng. Lớp nhớ được dựng LẠI khi đồ
   * thị đổi, nên nó không bao giờ trả một câu trả lời của mô hình cũ.
   */
  const cachedGateway = useMemo((): ExplodedViewGateway => {
    // Không có đồ thị thì không có gì để đọc — cùng câu trả lời mà `floorProbesOf`
    // và `axisProbesOf` đưa ra cho cùng một đồ thị rỗng. Ba nguồn của cùng một màn
    // không được nói ba chuyện khác nhau.
    const empty = spatial === null;
    let areas: ReadonlyMap<string, number> | null = null;
    let alignment: AlignmentReportLike | null | undefined;

    return {
      readFloorAreas: (): ReadonlyMap<string, number> =>
        (areas ??= empty ? NO_AREAS : gateway.readFloorAreas()),
      readAlignment: (): AlignmentReportLike | null => {
        if (alignment === undefined) {
          alignment = empty ? null : gateway.readAlignment();
        }

        return alignment;
      },
    };
  }, [gateway, spatial]);

  /* ---- Truy vấn: nguồn DUY NHẤT của loading và error (R-64) --------------- */

  /*
   * Không có `useQuery` thứ hai ở đây, và đó là cố ý. `useViewerShell` đã đọc tên
   * dự án qua `useQuery` với khoá `queryKeys.project.detail(projectId)` và ĐÚNG
   * cổng mà hook này truyền vào, nên `isLoading`/`isError` của lượt đọc ấy tới màn
   * qua `shell.state`. Một lượt `useQuery` nữa cùng khoá chỉ là một cái tên thứ
   * hai cho cùng một câu trả lời. Lượt GHI duy nhất của màn — chụp ảnh — đi qua
   * `useMutation` ở dưới, cũng của `@tanstack/react-query` chứ không phải hai
   * `useState` viết tay (R-64).
   */

  /* ---- Tầng, trục, hình học ---------------------------------------------- */

  const data = useMemo(() => shellDataOf(spatial), [spatial]);
  const probes = useMemo(() => floorProbesOf(spatial), [spatial]);
  const axes = useMemo(() => axisProbesOf(spatial), [spatial]);

  const conversion = useMemo((): { levels: readonly BuildFloorInput[]; failed: boolean } => {
    if (spatial === null) {
      return { levels: NO_LEVELS, failed: false };
    }

    try {
      const levels: BuildFloorInput[] = [];

      for (const storey of data.storeys) {
        const input = toBuildFloorInput(spatial, storey.id);

        if (input !== null) {
          levels.push(input);
        }
      }

      return { levels, failed: false };
    } catch {
      // `toBuildFloorInput` ném khi đồ thị hỏng chỉ mục hoặc mang số đo không hữu
      // hạn. Đó là một mô hình không dựng được, không phải một sự cố kỹ thuật để
      // hiện mã lỗi: nó thành trạng thái `error` với nút thử lại của vỏ.
      return { levels: NO_LEVELS, failed: true };
    }
  }, [spatial, data.storeys]);

  /* ---- Tô màu: MỘT token cho cả mô hình --------------------------------- */

  /**
   * Đặc tả cấm tô màu theo tầng, nên màn này không dùng chế độ `level` của P-06 —
   * nó dùng chế độ `default`, thứ có đúng MỘT bậc. Token đọc từ `bands` của chính
   * chế độ ấy chứ không viết tay một tên biến CSS (A1).
   */
  const untintedToken = useMemo((): ColorTokenName => {
    const mode = createColoringMode('default', { subjects: NO_SUBJECTS });

    return mode.bands[0]?.token ?? UNPAINTED_TOKEN;
  }, []);

  const tokenOfPartKind = useCallback((): ColorTokenName => untintedToken, [untintedToken]);

  /* ---- Vòng đời cảnh ---------------------------------------------------- */

  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [sceneStatus, setSceneStatus] = useState<ViewerSceneStatus>(IDLE_STATUS);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [hoveredStoreyId, setHoveredStoreyId] = useState<string | null>(null);

  const handleRef = useRef<ExplodedSceneHandle | null>(null);

  /* ---- Vỏ chung --------------------------------------------------------- */

  /**
   * Closure dựng nội dung khe cắm cảnh.
   *
   * Ổn định qua mọi lượt vẽ (`useCallback` không phụ thuộc gì) và đọc phép dựng
   * props qua một ref: `renderScene` phải đi VÀO `useViewerShell`, còn `frame` và
   * ba callback của ray tầng chỉ có sau khi hook ấy trả về. Ref là chỗ nối hai đầu
   * dây ấy mà không dựng một component trung gian nào.
   */
  const buildPropsRef = useRef<(frame: ViewerSceneFrame) => ExplodedViewProps>(() => {
    throw new Error('renderScene được gọi trước khi hook dựng xong phép dựng props.');
  });

  const renderScene = useCallback(
    (frame: ViewerSceneFrame): ReactNode =>
      createElement(ExplodedView, buildPropsRef.current(frame)),
    [],
  );

  const shell = useViewerShell({
    projectId: options.projectId,
    gateway: shellGateway,
    spatial,
    renderScene,
    ...(options.roles !== undefined ? { roles: options.roles } : {}),
    ...(options.forceState !== undefined ? { forceState: options.forceState } : {}),
    ...(options.isDev !== undefined ? { isDev: options.isDev } : {}),
    ...(options.perf !== undefined ? { perf: options.perf } : {}),
    ...(options.registry !== undefined ? { registry: options.registry } : {}),
    ...(options.onOpenSearch !== undefined ? { onOpenSearch: options.onOpenSearch } : {}),
  });

  /* ---- Lắp cảnh --------------------------------------------------------- */

  const levels = conversion.levels;
  const mountScene = options.mountScene ?? mountExplodedScene;

  const latest = useRef({ frame: shell.frame, sceneActions: shell.sceneActions, tokenOfPartKind });

  useEffect(() => {
    latest.current = { frame: shell.frame, sceneActions: shell.sceneActions, tokenOfPartKind };
  });

  useEffect(() => {
    if (canvas === null || levels.length === 0) {
      return undefined;
    }

    const current = latest.current;
    const mount = mountScene(canvas, {
      levels,
      storeys: probes,
      frame: current.frame,
      actions: current.sceneActions,
      tokenOfPartKind: () => latest.current.tokenOfPartKind(),
      // Cảnh này chỉ để XEM sự tách: không có công cụ sửa nào cắm vào nó, nên tia
      // chọn luôn bật và quyền sửa không đi qua đây (vai chỉ-xem vẫn chọn được để
      // panel phải nói ra tên tầng — đúng nghĩa `forbidden` của A11).
      canSelect: true,
      onStatusChange: setSceneStatus,
    });

    if (!mount.ok) {
      setWebglUnavailable(true);
      return undefined;
    }

    setWebglUnavailable(false);
    handleRef.current = mount.handle;

    return (): void => {
      mount.handle.dispose();
      handleRef.current = null;
      setSceneStatus(IDLE_STATUS);
    };
  }, [canvas, levels, probes, mountScene]);

  useEffect(() => {
    handleRef.current?.update(shell.frame);
  }, [shell.frame]);

  /* ---- Chụp ảnh: một lượt ghi, nên một `useMutation` (R-64) -------------- */

  const captureMutation = useMutation({
    mutationFn: async (): Promise<CaptureResult> => {
      const source = handleRef.current?.capture() ?? null;

      if (source === null) {
        throw new Error(CAPTURE_UNAVAILABLE_MESSAGE);
      }

      // Nạp MUỘN, và đây là một quyết định về kích thước gói chứ không phải một
      // thói quen. `src/lib/export/screenshot` nặng 7,4 KiB gzip và không cần một
      // byte nào để VẼ màn — nó chỉ chạy khi có người bấm nút chụp. Nhập tĩnh thì
      // 7,4 KiB ấy nằm trong chunk mọi người tải khi bước vào màn, và cổng kích
      // thước gói bắt đúng chuyện đó (280 KiB cho một màn; màn này 284,7 KiB khi
      // còn nhập tĩnh).
      //
      // Ranh giới của lập luận này: module CẢNH thì KHÔNG được nạp muộn kiểu ấy —
      // cảnh chính là màn, dời nó sang sau chỉ làm đẹp con số chứ người dùng vẫn
      // phải tải nó mới thấy gì. Chụp ảnh thì khác thật.
      const { captureViewport } = await import('@/lib/export/screenshot');

      // `captureViewport` render LẠI một khung vào target ngoài màn rồi trả
      // renderer về y nguyên — màn không tự dựng ảnh (X-03).
      return captureViewport(source);
    },
  });

  const { isError: captureFailed, isPending: isCapturing, mutate: startCapture } = captureMutation;

  const onCapture = useCallback((): void => {
    // Khoá lại trong lúc còn một lượt chưa xong: hợp đồng nói nút không được xếp
    // hàng hai lượt, và `mutate` của react-query thì sẵn lòng nhận lượt thứ hai.
    if (!isCapturing) {
      startCapture();
    }
  }, [isCapturing, startCapture]);

  /* ---- Phím `Space`: một lượt tách rồi hợp ------------------------------- */

  const cycleRef = useRef({ separation: shell.separation, onSeparationChange: shell.onSeparationChange });

  useEffect(() => {
    cycleRef.current = {
      separation: shell.separation,
      onSeparationChange: shell.onSeparationChange,
    };
  });

  const cycleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => (): void => {
      if (cycleTimeoutRef.current !== null) {
        clearTimeout(cycleTimeoutRef.current);
        cycleTimeoutRef.current = null;
      }
    },
    [],
  );

  const runCycle = useCallback((): void => {
    // Một lượt tại một thời điểm: giữ phím không xếp hàng năm lượt tách chồng nhau.
    if (cycleTimeoutRef.current !== null) {
      return;
    }

    const back = cycleRef.current.separation;

    cycleRef.current.onSeparationChange(MAX_SEPARATION);

    cycleTimeoutRef.current = setTimeout(() => {
      cycleTimeoutRef.current = null;
      cycleRef.current.onSeparationChange(back === MAX_SEPARATION ? MIN_SEPARATION : back);
    }, EXPLODED_MOTION_MS.cycleHalfMs);
  }, []);

  useShortcut(
    {
      id: EXPLODE_CYCLE_ID,
      combo: EXPLODE_CYCLE_COMBO,
      scope: 'canvas',
      description: EXPLODE_CYCLE_DESCRIPTION,
      onTrigger: runCycle,
    },
    options.registry !== undefined ? { registry: options.registry } : {},
  );

  /* ---- Bảy trạng thái --------------------------------------------------- */

  const buildFailed = conversion.failed || sceneStatus.phase === 'failed';
  const readyCount = sceneStatus.progress.readyLevelIds.length;

  const state = useMemo((): ExplodedViewState => {
    if (options.forceState !== undefined) {
      return options.forceState;
    }
    if (webglUnavailable || buildFailed || shell.state === 'error') {
      return 'error';
    }
    if (shell.state === 'forbidden' || shell.state === 'collapsed') {
      return shell.state;
    }
    if (shell.state === 'loading' || sceneStatus.phase === 'building') {
      return 'loading';
    }
    // Một tầng thì không có gì để tách, và đó là trạng thái `empty` của MÀN NÀY —
    // khác `empty` của vỏ, thứ nói "chưa có tầng nào".
    if (data.storeys.length < MIN_EXPLODABLE_STOREYS) {
      return 'empty';
    }
    if (shell.state === 'partial' || readyCount < levels.length) {
      return 'partial';
    }

    return 'success';
  }, [
    options.forceState,
    webglUnavailable,
    buildFailed,
    shell.state,
    sceneStatus.phase,
    data.storeys.length,
    readyCount,
    levels.length,
  ]);

  /* ---- Phép dựng props, chốt lại mỗi lượt vẽ ---------------------------- */

  const runtime = useMemo(
    (): ExplodedViewRuntime => ({
      state,
      floors: probes,
      axes,
      hoveredStoreyId,
      isCapturing,
      captureError: captureFailed ? CAPTURE_ERROR_MESSAGE : null,
      onFloorHover: setHoveredStoreyId,
      onCapture,
      canvasRef: setCanvas,
    }),
    [
      state,
      probes,
      axes,
      hoveredStoreyId,
      isCapturing,
      captureFailed,
      onCapture,
    ],
  );

  buildPropsRef.current = (frame: ViewerSceneFrame): ExplodedViewProps =>
    explodedViewPropsOf(
      {
        projectId: options.projectId,
        gateway: cachedGateway,
        frame,
        onSeparationChange: shell.onSeparationChange,
        onStoreyActivate: shell.onStoreyActivate,
        onStoreyVisibilityToggle: shell.onStoreyVisibilityToggle,
        storeys: shell.storeys,
        ...(options.forceState !== undefined ? { forceState: options.forceState } : {}),
      },
      runtime,
    );

  /* ---- `ViewerShellProps`, trạng thái của MÀN thắng trạng thái của vỏ ---- */

  return { ...shell, state };
}
