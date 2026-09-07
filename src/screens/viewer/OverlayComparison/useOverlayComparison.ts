/**
 * Nửa "suy nghĩ" của màn Đối chiếu bản vẽ — mọi thứ bốn file view cần, đã xong.
 *
 * `types.ts` là hợp đồng props DUY NHẤT của màn; hook này trả về đúng
 * {@link UseOverlayComparisonResult}, không hơn không kém. Mọi chuỗi người đọc
 * được ghép và định dạng ở đây (A15), nên view không còn con số thô nào phải làm
 * tròn, chia, hay đổi đơn vị.
 *
 * ## Không một phép đo nào trong file này (R-61)
 *
 * Trung bình, lớn nhất, đếm vượt ngưỡng, và cả phép so sánh ngặt `> dung sai`
 * đều nằm sau {@link OverlayComparisonGateway.evaluateTolerance} — hôm nay trả
 * `supported: false`, ngày mai gọi `src/domain/overlay`. Hook chỉ **định dạng**
 * thứ nó nhận được: `formatLength` cho độ lệch, `formatPercent` cho độ mờ, và
 * `MISSING_VALUE` (`'—'`) khi chưa đo được — **không phải `'0 mm'`**. Số không
 * là một phép đo; gạch ngang là sự vắng mặt của phép đo.
 *
 * Việc duy nhất hook tự làm với bộ vùng lệch là **sắp tệ nhất lên đầu**, đúng
 * chỗ `DeviationRowViewModel` giao cho nó. Sắp xếp không phải một phép đo, và
 * khoá phụ theo `id` giữ cho bốn vùng 1 mm của bộ mẫu không đảo chỗ giữa hai
 * lượt render.
 *
 * ## Trạng thái máy chủ (R-64)
 *
 * Không một ô trạng thái tự viết nào cho việc đang tải, cũng không cho lỗi đọc:
 * cả hai thuộc về `useQuery`. Lượt ghi xác nhận đi qua `useMutation`.
 * `hooks/useShareLinks.ts` tự viết `isLoading`/`error` bằng tay là **ngoại lệ đi
 * trước, không phải khuôn mẫu**. `useState` ở đây chỉ giữ trạng thái của riêng
 * giao diện: kiểu đối chiếu, độ mờ, đường chia đôi, khoá căn, dung sai, vùng
 * đang chọn, và tập vùng vừa vượt ngưỡng.
 *
 * ## Thứ tự bảy trạng thái
 *
 * Bảy trạng thái của A11 không loại trừ nhau: một tầng có thể vừa hẹp khung vừa
 * thiếu ảnh vừa không cho sửa. Thứ tự ở đây chọn nghĩa dùng được, mỗi bậc là
 * "thứ chặn đường người dùng trước nhất":
 *
 * `loading` → `error` → `empty` → `forbidden` → `collapsed` → `success` →
 * `partial`.
 *
 * `partial` đứng cuối vì nó là trạng thái *còn việc phải làm*, tức nghĩa đúng
 * của mọi lượt đối chiếu chưa sạch vùng vượt ngưỡng. Nhờ vậy phép nghiệm thu
 * "đổi dung sai 20 → 50 mm" **chính là** phép chuyển `partial` → `success`.
 *
 * ## Xác nhận là chữ ký của người (A5)
 *
 * `confirmation.isConfirmed` chỉ đọc từ cổng, và `confirmMatch()` là NGƯỜI GHI
 * DUY NHẤT của chỗ đó. Không nhánh nào trong file này suy `isConfirmed` từ
 * `overToleranceCount === 0`: một tầng khớp hoàn hảo mà chưa ai bấm thì vẫn chưa
 * được xác nhận. `'verified'` xuất hiện đúng một lần, trên `confirmedNotice`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { idsOnLevel, isEntityOfKind } from '@/domain/spatial/normalize';
import type { Level, LevelId, Point } from '@/domain/spatial/types';
import { createScale, pixels, type Scale } from '@/domain/units/scale';
import { millimetres } from '@/domain/units/types';
import { useCanvasViewport, type ViewportState } from '@/hooks/useCanvasViewport';
import { useCountUp } from '@/hooks/useCountUp';
import { can } from '@/lib/auth/permissions';
import { formatLength } from '@/lib/format/measure';
import { formatNumber, formatPercent, MISSING_VALUE } from '@/lib/format/number';
import { MOTION_DURATIONS_MS } from '@/lib/motion/tokens';
import { queryKeys } from '@/lib/query/queryKeys';
import { ROUTES } from '@/routes/paths';
import { useStore } from '@/store';
import type { ProjectRole } from '@/types/project';

import {
  createAppOverlayComparisonGateway,
  unsupported,
  type OverlayComparisonGateway,
  type OverlayDeviationRegion,
  type OverlayScanSnapshot,
  type OverlayToleranceEvaluation,
} from './overlayComparisonGateway';
import type {
  CompareModeId,
  ConfirmationViewModel,
  GeometryPolyline,
  DeviationMarkViewModel,
  DeviationMeasurementViewModel,
  DeviationRowViewModel,
  FloorOptionViewModel,
  MatchMetricsViewModel,
  OverlayComparisonActions,
  OverlayComparisonProps,
  OverlayComparisonState,
  OverlayComparisonViewModel,
  OverlayLayerId,
  OverlayLayerViewModel,
  OverlayUnsupported,
} from './types';
import { OVERLAY_MISSING_CAPABILITIES } from './types';

/* -------------------------------------------------------------------------- */
/* Chuỗi tiếng Việt của riêng hook.                                            */
/* Bản sao khai báo nằm ở vi.hook.fragment.json (mục F của phần chung).         */
/* -------------------------------------------------------------------------- */

const COPY = {
  confirmButton: 'xác nhận mô hình khớp bản vẽ',
  confirmedWithinTolerance:
    'mọi vùng nằm trong dung sai, và bạn đã xác nhận tầng này khớp bản vẽ.',
  confirmedWithDeviations:
    'bạn đã xác nhận tầng này khớp bản vẽ, dù vẫn còn vùng vượt dung sai.',
  emptyNotice: 'tầng này nhập từ CAD nên không có ảnh bản vẽ gốc để đối chiếu.',
  errorFrameNotice: 'không tìm được khung bản vẽ nên chưa căn được ảnh quét vào mô hình.',
  errorReadNotice: 'không đọc được ảnh bản vẽ gốc của tầng này.',
  errorScaleNotice: 'không căn được vì hai tầng đang dùng tỷ lệ khác nhau.',
  forbiddenNotice: 'bạn chỉ được xem; việc đổi căn chỉnh dành cho người có quyền sửa.',
  layerDeviation: 'vùng lệch',
  layerGeometry: 'hình học sinh ra',
  layerScan: 'ảnh quét gốc',
  loadingNotice: 'đang tải ảnh bản vẽ gốc.',
  metricMax: 'sai số lớn nhất',
  metricMean: 'sai số trung bình',
  metricOverTolerance: 'số vùng vượt ngưỡng',
  noFloorNotice: 'dự án này chưa có tầng nào để đối chiếu.',
  sideBySideDisabled: 'khung quá hẹp để đặt hai khung nhìn cạnh nhau; hãy dùng trượt.',
  toleranceLabel: 'dung sai',
} as const;

/** Ví dụ `"chỉ 2 trong 4 tầng có ảnh gốc để đối chiếu."`. */
const partialScanNotice = (withScan: string, total: string): string =>
  `chỉ ${withScan} trong ${total} tầng có ảnh gốc để đối chiếu.`;

/** Ví dụ `"còn 1 tầng chưa dựng hình học."`. */
const partialGeometryNotice = (pending: string): string =>
  `còn ${pending} tầng chưa dựng hình học.`;

/** Ví dụ `"còn 3 vùng vượt dung sai."`. */
const partialDeviationNotice = (overTolerance: string): string =>
  `còn ${overTolerance} vùng vượt dung sai.`;

/* -------------------------------------------------------------------------- */
/* Hằng số của màn.                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Độ mờ mặc định của hai lớp, theo đặc tả: nguồn 25%, hình học 60%.
 *
 * Chúng được viết lại ở đây thay vì nhập từ `overlayComparisonScenarios.ts`:
 * file kia là **dữ liệu mẫu cho test và story**, và bản sản phẩm không đọc nó.
 */
const DEFAULT_SCAN_OPACITY_PERCENT = 25;
const GEOMETRY_LAYER_OPACITY = 0.6;
const DEVIATION_LAYER_OPACITY = 1;

/** Dung sai mặc định khi mở màn, theo milimét — con số đặc tả nêu. */
const DEFAULT_TOLERANCE_MM = 20;

/** Đường chia đôi của kiểu `swipe` bắt đầu ở giữa khung. */
const DEFAULT_SWIPE_POSITION = 0.5;

/** Phần trăm đầy đủ, để quy `0..100` của thanh trượt về `0..1` của `style.opacity`. */
const FULL_PERCENT = 100;

/** Một khung đối chiếu, đơn vị lớn của `frameScaleOf`. */
const ONE_COMPARISON_FRAME = 1;

/** Kiểu "Cạnh nhau" cần đủ 1280 để đặt hai khung nhìn. */
const NARROW_VIEWPORT_QUERY = '(max-width: 1279px)';

/** Vai mạnh nhất đứng trước; `role` của viewmodel lấy vai đầu tiên khớp. */
const ROLE_PRECEDENCE: readonly ProjectRole[] = Object.freeze(['admin', 'engineer', 'viewer']);

const EMPTY_REGIONS: readonly OverlayDeviationRegion[] = Object.freeze([]);
const EMPTY_SCANS: readonly OverlayScanSnapshot[] = Object.freeze([]);
const EMPTY_IDS: readonly string[] = Object.freeze([]);
const EMPTY_ROWS: readonly DeviationRowViewModel[] = Object.freeze([]);
const EMPTY_MARKS: readonly DeviationMarkViewModel[] = Object.freeze([]);
const EMPTY_FLOORS: readonly Level[] = Object.freeze([]);
const EMPTY_GEOMETRY: readonly GeometryPolyline[] = Object.freeze([]);
const EMPTY_ROLES: readonly ProjectRole[] = Object.freeze([]);

const METRIC_LABELS = Object.freeze({
  mean: COPY.metricMean,
  max: COPY.metricMax,
  overTolerance: COPY.metricOverTolerance,
});

/**
 * Ba con số của một trạng thái chưa đo được: gạch ngang, không phải số không.
 *
 * Cùng giá trị với `UNMEASURED_METRICS` của bộ kịch bản, viết lại ở đây vì bản
 * sản phẩm không đọc file dữ liệu mẫu.
 */
const UNMEASURED_METRICS: MatchMetricsViewModel = Object.freeze({
  meanText: MISSING_VALUE,
  maxText: MISSING_VALUE,
  overToleranceCount: null,
  labels: METRIC_LABELS,
});

/** Số nguyên đếm được, viết theo đúng bảng định dạng chung. */
const countText = (value: number): string => formatNumber(value, { fractionDigits: 0 });

/* -------------------------------------------------------------------------- */
/* Chiếu hình học mô hình xuống khung đối chiếu.                               */
/* -------------------------------------------------------------------------- */

/**
 * Một cạnh của khung đối chiếu, đã thành một phép đổi đơn vị.
 *
 * Cùng khuôn `frameScaleOf` của `useScaleCalibration`: quy một khoảng mi-li-mét
 * về tỉ lệ `0..1` của khung **là một phép đổi đơn vị**, và phép đổi đơn vị đi qua
 * `createScale` của M-02 chứ không qua một dấu chia viết tay ở màn (A15). "Một
 * khung đối chiếu" đóng vai đơn vị lớn, "một mi-li-mét" đóng vai đơn vị nhỏ.
 */
function frameScaleOf(spanMm: number): Scale {
  return createScale({
    pixelLength: pixels(spanMm),
    realLength: millimetres(ONE_COMPARISON_FRAME),
  });
}

/** Biên của mô hình, tức biên của khung đối chiếu. */
interface ModelFrame {
  readonly minX: number;
  readonly minY: number;
  readonly acrossScale: Scale;
  readonly upScale: Scale;
}

/**
 * `null` khi tầng chưa có nét nào, hoặc khi mọi nét nằm trên một đường thẳng —
 * một khung rộng 0 thì không quy đổi được, và đoán một bề rộng là bịa dữ liệu.
 */
function modelFrameOf(points: readonly Point[]): ModelFrame | null {
  if (points.length === 0) {
    return null;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  const spanX = maxX - minX;
  const spanY = maxY - minY;

  if (spanX <= 0 || spanY <= 0) {
    return null;
  }

  return { minX, minY, acrossScale: frameScaleOf(spanX), upScale: frameScaleOf(spanY) };
}

/* -------------------------------------------------------------------------- */
/* Bản ghi một lượt đọc.                                                       */
/* -------------------------------------------------------------------------- */

interface OverlayComparisonRecord {
  /** Ảnh quét của mọi tầng trong dự án — nguồn của `hasScan` từng tầng. */
  readonly scans: readonly OverlayScanSnapshot[];
  /** Vùng lệch của tầng đang mở. Rỗng khi `deviationRegions` chưa có đường. */
  readonly regions: readonly OverlayDeviationRegion[];
}

/* -------------------------------------------------------------------------- */
/* Tham số vào và kiểu trả về.                                                 */
/* -------------------------------------------------------------------------- */

export interface UseOverlayComparisonOptions {
  readonly projectId: string;
  /**
   * Tầng của đường dẫn. Store là nguồn sự thật của tầng đang chọn; đây là giá
   * trị mở màn.
   *
   * Kiểu là `string`, không phải `LevelId`: giá trị này tới từ một đoạn URL mà
   * không ai kiểm trước, đúng như mọi container khác của repo khai nó
   * (`ScaleCalibrationContainerProps.floorId`, `ROUTES.project.scale`). Thu hẹp
   * ở đây chỉ đẩy một lượt `as LevelId` lên router — một lời khẳng định sai về
   * dữ liệu chưa kiểm. Nhãn `L-` không mua được gì bên trong hook: `floorId`
   * chỉ được đem SO SÁNH với `floor.id`, còn `activeFloorId` mà hook phát ra
   * luôn lấy từ chính `floors[].id` nên vẫn là `LevelId` thật.
   */
  readonly floorId: string;
  /** Vai của người đang xem. Bỏ trống thì đọc từ store (`ProjectSlice.userRoles`). */
  readonly roles?: readonly ProjectRole[];
  /** Ép thanh công cụ xếp hai hàng — cho story và test muốn một câu trả lời cố định. */
  readonly forceCollapsed?: boolean;
  /** Cổng dữ liệu. Có mặc định thật bên trong; test và story cắm bản giả vào. */
  readonly gateway?: OverlayComparisonGateway;
}

/**
 * Kiểu trả về của `useOverlayComparison` — đúng bộ props view gốc cần.
 *
 * `scanUrl` mà canvas đòi nằm ngay trong viewmodel, nên container không phải
 * chuyền thêm gì bên cạnh `model` và `actions`.
 */
export type UseOverlayComparisonResult = OverlayComparisonProps;

/* -------------------------------------------------------------------------- */
/* Hai hook phụ.                                                               */
/* -------------------------------------------------------------------------- */

function useNarrowViewport(): boolean {
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(NARROW_VIEWPORT_QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(NARROW_VIEWPORT_QUERY);
    setIsNarrow(media.matches);
    const listener = (event: MediaQueryListEvent): void => {
      setIsNarrow(event.matches);
    };
    media.addEventListener('change', listener);
    return () => {
      media.removeEventListener('change', listener);
    };
  }, []);

  return isNarrow;
}

/** Cổng đã tiêm, hoặc bản thật dựng đúng một lần và chỉ khi cần. */
function useResolvedGateway(injected?: OverlayComparisonGateway): OverlayComparisonGateway {
  const fallbackRef = useRef<OverlayComparisonGateway | null>(null);

  if (injected !== undefined) {
    return injected;
  }

  fallbackRef.current ??= createAppOverlayComparisonGateway();
  return fallbackRef.current;
}

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

/** `(options) => UseOverlayComparisonResult` cho `OverlayComparison.container.tsx`. */
export function useOverlayComparison(
  options: UseOverlayComparisonOptions,
): UseOverlayComparisonResult {
  const { floorId, projectId } = options;
  const gateway = useResolvedGateway(options.gateway);
  const detectedNarrow = useNarrowViewport();
  const isCollapsed = options.forceCollapsed ?? detectedNarrow;

  /* ---------------------------------------------------------------------- */
  /* Nguồn từ store: danh sách tầng, tầng đang chọn, vai, và hình học.        */
  /* ---------------------------------------------------------------------- */

  const storeFloors = useStore((state) => state.floors);
  const storeActiveFloorId = useStore((state) => state.activeFloorId);
  const storeRoles = useStore((state) => state.userRoles);
  const spatial = useStore((state) => state.spatial);

  const floors = storeFloors.length === 0 ? EMPTY_FLOORS : storeFloors;
  const roles = options.roles ?? (storeRoles.length === 0 ? EMPTY_ROLES : storeRoles);
  const activeFloorId: LevelId | null =
    floors.some((floor) => floor.id === storeActiveFloorId) && storeActiveFloorId !== null
      ? storeActiveFloorId
      : (floors.find((floor) => floor.id === floorId)?.id ?? floors[0]?.id ?? null);

  const canEdit = can('edit', 'layer', { roles });
  const role = ROLE_PRECEDENCE.find((candidate) => roles.includes(candidate)) ?? null;

  /* ---------------------------------------------------------------------- */
  /* Trạng thái máy chủ (R-64) — một khoá đệm cho lượt đo của tầng.           */
  /* ---------------------------------------------------------------------- */

  const query = useQuery({
    queryKey: queryKeys.quality.assessment(activeFloorId ?? ''),
    queryFn: async (): Promise<OverlayComparisonRecord> => {
      const readFloorId = activeFloorId ?? floorId;
      const scans = await gateway.readFloorScans({ floorId: readFloorId, projectId });

      if (!scans.ok) {
        throw scans.error;
      }

      const regions = await gateway.readDeviationRegions({ floorId: readFloorId, projectId });

      return {
        scans: scans.data,
        regions: regions.supported ? regions.value : EMPTY_REGIONS,
      };
    },
    enabled: activeFloorId !== null,
  });

  const scans = query.data?.scans ?? EMPTY_SCANS;
  const regions = query.data?.regions ?? EMPTY_REGIONS;
  const activeScan = scans.find((scan) => scan.floorId === activeFloorId) ?? null;

  /* ---------------------------------------------------------------------- */
  /* Trạng thái của riêng giao diện.                                         */
  /* ---------------------------------------------------------------------- */

  const [requestedCompareMode, setRequestedCompareMode] = useState<CompareModeId>('overlay');
  const [scanOpacityPercent, setScanOpacityPercent] = useState(DEFAULT_SCAN_OPACITY_PERCENT);
  const [swipePosition, setSwipePosition] = useState(DEFAULT_SWIPE_POSITION);
  const [isLockedByUser, setIsLockedByUser] = useState(false);
  const [toleranceMm, setToleranceMmState] = useState(DEFAULT_TOLERANCE_MM);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [justCrossedIds, setJustCrossedIds] = useState<readonly string[]>(EMPTY_IDS);

  /**
   * Một lượt gọi `useCanvasViewport` cho CẢ MÀN.
   *
   * Hook đó giữ state trong `useState` của riêng từng lượt gọi, nên gọi nó hai
   * lần cho kiểu `sideBySide` sẽ cho hai khung kéo rời nhau. Gọi đúng một lần và
   * phát giá trị xuống hai khung thì chúng đi cùng nhau theo cấu trúc.
   */
  const { viewport, pan, zoomTo } = useCanvasViewport();
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  /* ---------------------------------------------------------------------- */
  /* Tầng: ảnh có hay không, hình học có hay không.                          */
  /* ---------------------------------------------------------------------- */

  const floorOptions = useMemo<readonly FloorOptionViewModel[]>(
    () =>
      floors.map((floor) => {
        const scan = scans.find((candidate) => candidate.floorId === floor.id);

        return {
          levelId: floor.id,
          label: floor.name,
          hasScan: scan !== undefined && scan.imageUrl !== null,
          hasGeometry: spatial === null ? false : idsOnLevel(spatial, floor.id).length > 0,
        };
      }),
    [floors, scans, spatial],
  );

  /**
   * Nét của lớp `geometry`, chiếu xuống hệ tỉ lệ `0..1`.
   *
   * Lớp này KHÔNG thiếu gì: tường và phòng đã nằm trong store từ trước, nên nó
   * vẽ được ở mọi trạng thái — kể cả `empty` và `error`. Thứ còn thiếu là
   * `imageToModelTransform`, và nó chỉ làm hỏng việc đặt **ảnh**, không làm mất
   * **mô hình**. Chính lớp này định nghĩa khung đối chiếu: biên của mô hình là
   * biên của khung.
   */
  const geometry = useMemo<readonly GeometryPolyline[]>(() => {
    if (spatial === null || activeFloorId === null) {
      return EMPTY_GEOMETRY;
    }

    const outlines = idsOnLevel(spatial, activeFloorId).flatMap((entityId) => {
      const entity = spatial.byId[entityId];

      if (entity === undefined) {
        return [];
      }

      if (isEntityOfKind('room', entity)) {
        return [{ id: entity.id as string, points: entity.outline, isClosed: true }];
      }

      if (isEntityOfKind('wall', entity)) {
        return [
          {
            id: entity.id as string,
            points: [entity.centreline.start, entity.centreline.end],
            isClosed: false,
          },
        ];
      }

      return [];
    });

    const frame = modelFrameOf(outlines.flatMap((outline) => [...outline.points]));

    if (frame === null) {
      return EMPTY_GEOMETRY;
    }

    return outlines.map((outline) => ({
      id: outline.id,
      isClosed: outline.isClosed,
      points: outline.points.map((point) => ({
        x: frame.acrossScale.pixelsToMillimetres(pixels(point.x - frame.minX)),
        y: frame.upScale.pixelsToMillimetres(pixels(point.y - frame.minY)),
      })),
    }));
  }, [activeFloorId, spatial]);

  const floorsWithScan = floorOptions.filter((floor) => floor.hasScan).length;
  const floorsWithoutGeometry = floorOptions.filter((floor) => !floor.hasGeometry).length;
  const activeFloor = floorOptions.find((floor) => floor.levelId === activeFloorId) ?? null;
  const activeHasScan = activeFloor?.hasScan ?? false;

  /**
   * Tỷ lệ mm/px của M-02 đặt theo TỪNG TẦNG, nên hai tầng có thể không đồng ý
   * với nhau — và hai bản vẽ ở hai tỷ lệ khác nhau thì không căn chồng được.
   */
  const hasScaleConflict = useMemo(() => {
    const ratios = new Set<number>();

    for (const floor of floors) {
      if (floor.scaleMillimetresPerPixel !== undefined) {
        ratios.add(floor.scaleMillimetresPerPixel);
      }
    }

    return ratios.size > 1;
  }, [floors]);

  /* ---------------------------------------------------------------------- */
  /* Đo: một lời gọi cổng, không một phép tính nào ở đây (R-61).             */
  /* ---------------------------------------------------------------------- */

  const evaluation = useMemo<OverlayToleranceEvaluation | null>(() => {
    if (regions.length === 0) {
      return null;
    }

    const result = gateway.evaluateTolerance({ regions, toleranceMm });

    return result.supported ? result.value : null;
  }, [gateway, regions, toleranceMm]);

  /* ---------------------------------------------------------------------- */
  /* Bảy trạng thái (A11).                                                   */
  /* ---------------------------------------------------------------------- */

  const isFrameMissing = activeScan !== null && !activeScan.isFrameFound;
  const hasReadFailed = query.isError;

  const state = useMemo<OverlayComparisonState>(() => {
    if (query.isLoading) {
      return 'loading';
    }

    if (hasReadFailed || isFrameMissing || hasScaleConflict) {
      return 'error';
    }

    if (activeFloorId === null || !activeHasScan) {
      return 'empty';
    }

    if (!canEdit) {
      return 'forbidden';
    }

    if (isCollapsed) {
      return 'collapsed';
    }

    if (evaluation !== null && evaluation.overToleranceCount === 0) {
      return 'success';
    }

    return 'partial';
  }, [
    activeFloorId,
    activeHasScan,
    canEdit,
    evaluation,
    hasReadFailed,
    hasScaleConflict,
    isCollapsed,
    isFrameMissing,
    query.isLoading,
  ]);

  /**
   * Phép đo, đã lọc theo trạng thái.
   *
   * `MatchMetricsViewModel` nói thẳng: ở `empty`, `loading` và `error` thì cả ba
   * chuỗi là `'—'`. Một cổng vẫn còn giữ kết quả của tầng trước không được phép
   * làm màn hiển thị "8 mm" cho một tầng chưa có ảnh nào — đó là hiển thị phép đo
   * của tầng khác dưới tên tầng này.
   */
  const measured: OverlayToleranceEvaluation | null =
    state === 'empty' || state === 'loading' || state === 'error' ? null : evaluation;

  const overToleranceIds = measured?.overToleranceIds ?? EMPTY_IDS;

  /**
   * Vùng vừa vượt ngưỡng sau một lượt đổi dung sai.
   *
   * Cờ này do hook giữ và do hook hạ xuống — view không được tự nhớ nó. Nó sống
   * đúng một nhịp `slow` (340 ms) chứ không đúng một lượt render: một cờ tắt
   * ngay ở lượt render kế tiếp thì không đủ để bắt đầu ba nhịp đập viền mà đặc
   * tả đòi. 340 ms là một giá trị của `MOTION_DURATIONS_MS`, không phải hằng số
   * viết tay (R-71).
   */
  const previousOverIdsRef = useRef<readonly string[] | null>(null);

  useEffect(() => {
    const previous = previousOverIdsRef.current;
    previousOverIdsRef.current = overToleranceIds;

    if (previous === null) {
      return undefined;
    }

    const crossed = overToleranceIds.filter((id) => !previous.includes(id));

    if (crossed.length === 0) {
      return undefined;
    }

    setJustCrossedIds(crossed);
    const handle = window.setTimeout(() => {
      setJustCrossedIds(EMPTY_IDS);
    }, MOTION_DURATIONS_MS.slow);

    return () => {
      window.clearTimeout(handle);
    };
  }, [overToleranceIds]);


  /* ---------------------------------------------------------------------- */
  /* Số vùng vượt ngưỡng chạy số khi dung sai đổi.                           */
  /* ---------------------------------------------------------------------- */

  const countSample = useCountUp(measured?.overToleranceCount ?? 0, {
    format: { fractionDigits: 0 },
  });

  const metrics = useMemo<MatchMetricsViewModel>(() => {
    if (measured === null) {
      return UNMEASURED_METRICS;
    }

    return {
      meanText: formatLength(measured.meanMm),
      maxText: formatLength(measured.maxMm),
      overToleranceCount: Math.round(countSample.value),
      labels: METRIC_LABELS,
    };
  }, [countSample.value, measured]);

  /* ---------------------------------------------------------------------- */
  /* Vùng lệch: sắp tệ nhất lên đầu, rồi định dạng.                          */
  /* ---------------------------------------------------------------------- */

  const sortedRegions = useMemo<readonly OverlayDeviationRegion[]>(() => {
    // Khoá phụ theo `id` giữ thứ tự tất định: bộ mẫu có bốn vùng 1 mm và ba
    // vùng 2 mm, nên hai vùng bằng nhau đảo chỗ là chuyện xảy ra thật.
    return [...regions].sort((left, right) => {
      if (left.deviationMm !== right.deviationMm) {
        return right.deviationMm - left.deviationMm;
      }

      return left.id.localeCompare(right.id);
    });
  }, [regions]);

  const rows = useMemo<readonly DeviationRowViewModel[]>(() => {
    if (measured === null) {
      // Chưa đo được thì chưa biết hàng nào vượt dung sai, và một hàng không
      // mang được `statusCode` trung thực thì không được vẽ ra.
      return EMPTY_ROWS;
    }

    return sortedRegions.map((region) => ({
      id: region.id,
      referenceLabel: region.referenceLabel,
      deviationText: formatLength(region.deviationMm),
      affectedObjectCode: region.affectedObjectCode,
      statusCode: overToleranceIds.includes(region.id) ? 'attention' : 'neutral',
      isSelected: region.id === selectedRegionId,
    }));
  }, [measured, overToleranceIds, selectedRegionId, sortedRegions]);

  const marks = useMemo<readonly DeviationMarkViewModel[]>(() => {
    if (measured === null) {
      return EMPTY_MARKS;
    }

    return sortedRegions.map((region) => ({
      id: region.id,
      box: region.box,
      isOverTolerance: overToleranceIds.includes(region.id),
      isSelected: region.id === selectedRegionId,
      hasJustCrossedTolerance: justCrossedIds.includes(region.id),
    }));
  }, [justCrossedIds, measured, overToleranceIds, selectedRegionId, sortedRegions]);

  const measurement = useMemo<DeviationMeasurementViewModel | null>(() => {
    if (selectedRegionId === null) {
      return null;
    }

    const region = sortedRegions.find((candidate) => candidate.id === selectedRegionId);

    if (region === undefined) {
      return null;
    }

    return {
      from: region.measurement.from,
      to: region.measurement.to,
      valueText: formatLength(region.deviationMm),
    };
  }, [selectedRegionId, sortedRegions]);

  const stateNotice = useMemo<string | null>(() => {
    if (state === 'loading') {
      return COPY.loadingNotice;
    }

    if (state === 'error') {
      if (hasScaleConflict) {
        return COPY.errorScaleNotice;
      }

      return isFrameMissing ? COPY.errorFrameNotice : COPY.errorReadNotice;
    }

    if (state === 'empty') {
      return activeFloorId === null ? COPY.noFloorNotice : COPY.emptyNotice;
    }

    if (state === 'forbidden') {
      return COPY.forbiddenNotice;
    }

    if (state !== 'partial') {
      return null;
    }

    const sentences: string[] = [];

    if (floorsWithScan < floorOptions.length) {
      sentences.push(partialScanNotice(countText(floorsWithScan), countText(floorOptions.length)));
    }

    if (floorsWithoutGeometry > 0) {
      sentences.push(partialGeometryNotice(countText(floorsWithoutGeometry)));
    }

    if (measured !== null && measured.overToleranceCount > 0) {
      sentences.push(partialDeviationNotice(countText(measured.overToleranceCount)));
    }

    return sentences.length === 0 ? null : sentences.join(' ');
  }, [
    activeFloorId,
    floorOptions.length,
    floorsWithScan,
    floorsWithoutGeometry,
    hasScaleConflict,
    isFrameMissing,
    measured,
    state,
  ]);

  /**
   * Lối sang màn Hiệu chỉnh tỷ lệ (S-11).
   *
   * Chỉ hai nguyên nhân sửa được ở đó — tỷ lệ hai tầng lệch nhau, và khung bản
   * vẽ không tìm ra — mới có lối đi. Một lượt đọc hỏng vì mạng thì không, vì
   * màn kia không chữa được nó.
   */
  const scaleFixHref = useMemo<string | null>(() => {
    if (state !== 'error' || activeFloorId === null) {
      return null;
    }

    if (!hasScaleConflict && !isFrameMissing) {
      return null;
    }

    return ROUTES.project.scale(projectId, activeFloorId);
  }, [activeFloorId, hasScaleConflict, isFrameMissing, projectId, state]);

  /* ---------------------------------------------------------------------- */
  /* Ba lớp thị giác, và kiểu đối chiếu còn dùng được.                       */
  /* ---------------------------------------------------------------------- */

  const compareMode: CompareModeId =
    requestedCompareMode === 'sideBySide' && isCollapsed ? 'swipe' : requestedCompareMode;

  const disabledCompareModes = useMemo<Readonly<Partial<Record<CompareModeId, string>>>>(
    () => (isCollapsed ? { sideBySide: COPY.sideBySideDisabled } : {}),
    [isCollapsed],
  );

  const layers = useMemo<Readonly<Record<OverlayLayerId, OverlayLayerViewModel>>>(() => {
    const hasScanLayer = activeScan !== null && activeScan.imageUrl !== null;
    const layer = (
      id: OverlayLayerId,
      label: string,
      opacity: number,
      isVisible: boolean,
    ): OverlayLayerViewModel => ({ id, isVisible, opacity, label });

    return {
      scan: layer(
        'scan',
        COPY.layerScan,
        scanOpacityPercent / FULL_PERCENT,
        hasScanLayer,
      ),
      geometry: layer('geometry', COPY.layerGeometry, GEOMETRY_LAYER_OPACITY, true),
      deviation: layer('deviation', COPY.layerDeviation, DEVIATION_LAYER_OPACITY, marks.length > 0),
    };
  }, [activeScan, marks.length, scanOpacityPercent]);

  /* ---------------------------------------------------------------------- */
  /* Xác nhận — chữ ký của người, ghi qua tầng mutation (R-64).              */
  /* ---------------------------------------------------------------------- */

  const confirmMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (activeFloorId === null) {
        return;
      }

      const result = await gateway.confirmFloorMatch({ floorId: activeFloorId, projectId });

      if (!result.ok) {
        throw result.error;
      }
    },
  });

  // Lượt xác nhận sống trong phiên và `confirmFloorMatch` là NGƯỜI GHI DUY NHẤT
  // của chỗ đó, nên đọc thẳng từ cổng là đọc đúng nguồn — và không có đường nào
  // khác đặt được cờ này (A5). Lượt render mang giá trị mới xuống là chính lượt
  // `useMutation` gây ra khi nó về.
  const isConfirmed =
    activeFloorId !== null && gateway.hasConfirmedMatch({ floorId: activeFloorId, projectId });

  const confirmation = useMemo<ConfirmationViewModel>(() => {
    const canConfirm =
      canEdit &&
      !isConfirmed &&
      !confirmMutation.isPending &&
      !query.isLoading &&
      measured !== null;

    return {
      buttonLabel: COPY.confirmButton,
      isConfirmed,
      canConfirm,
      confirmedNotice: isConfirmed
        ? {
            text:
              measured !== null && measured.overToleranceCount === 0
                ? COPY.confirmedWithinTolerance
                : COPY.confirmedWithDeviations,
            statusCode: 'verified',
          }
        : null,
    };
  }, [canEdit, confirmMutation.isPending, isConfirmed, measured, query.isLoading]);

  /* ---------------------------------------------------------------------- */
  /* Việc cổng chưa làm được.                                                */
  /* ---------------------------------------------------------------------- */

  const unsupportedCapabilities = useMemo<readonly OverlayUnsupported[]>(
    () =>
      OVERLAY_MISSING_CAPABILITIES.filter((capability) => !gateway.supports[capability]).map(
        (capability) => unsupported(capability),
      ),
    [gateway],
  );

  /* ---------------------------------------------------------------------- */
  /* Hành động.                                                              */
  /* ---------------------------------------------------------------------- */

  const selectFloor = useCallback((levelId: LevelId): void => {
    useStore.getState().setActiveFloor(levelId);
    setSelectedRegionId(null);
  }, []);

  const setCompareMode = useCallback((mode: CompareModeId): void => {
    setRequestedCompareMode(mode);
  }, []);

  const setScanOpacity = useCallback((percent: number): void => {
    setScanOpacityPercent(Math.min(FULL_PERCENT, Math.max(0, Math.round(percent))));
  }, []);

  const setSwipe = useCallback((ratio: number): void => {
    setSwipePosition(Math.min(1, Math.max(0, ratio)));
  }, []);

  const toggleAlignmentLock = useCallback((): void => {
    setIsLockedByUser((locked) => !locked);
  }, []);

  const setToleranceMm = useCallback((millimetres: number): void => {
    setToleranceMmState(Math.max(0, millimetres));
  }, []);

  const selectRegion = useCallback((id: string | null): void => {
    setSelectedRegionId(id);
  }, []);

  /**
   * Đặt viewport về một giá trị tuyệt đối.
   *
   * `useCanvasViewport` chỉ mở ra `pan` (tương đối) và `zoomTo`, nên một lượt đặt
   * tuyệt đối là hai lời gọi của chính nó — không phải một `useState` thứ hai
   * chạy song song, thứ sẽ tách làm hai nguồn sự thật cho cùng một khung.
   */
  const setViewport = useCallback(
    (next: ViewportState): void => {
      const current = viewportRef.current;

      zoomTo(next.zoom);
      pan(next.x - current.x, next.y - current.y);
    },
    [pan, zoomTo],
  );

  const confirmMatch = useCallback((): void => {
    confirmMutation.mutate();
  }, [confirmMutation]);

  const actions = useMemo<OverlayComparisonActions>(
    () => ({
      selectFloor,
      setCompareMode,
      setScanOpacity,
      setSwipePosition: setSwipe,
      toggleAlignmentLock,
      setToleranceMm,
      selectRegion,
      setViewport,
      confirmMatch,
    }),
    [
      confirmMatch,
      selectFloor,
      selectRegion,
      setCompareMode,
      setScanOpacity,
      setSwipe,
      setToleranceMm,
      setViewport,
      toggleAlignmentLock,
    ],
  );

  /* ---------------------------------------------------------------------- */
  /* Viewmodel.                                                              */
  /* ---------------------------------------------------------------------- */

  const model = useMemo<OverlayComparisonViewModel>(
    () => ({
      state,
      stateNotice,
      scaleFixHref,
      floors: floorOptions,
      activeFloorId,
      compareMode,
      disabledCompareModes,
      scanUrl: activeScan?.imageUrl ?? null,
      scanOpacityPercent,
      scanOpacityText: formatPercent(scanOpacityPercent, {
        source: 'percent',
        fractionDigits: 0,
      }),
      swipePosition,
      isAlignmentLocked: isLockedByUser || !canEdit,
      layers,
      geometry,
      marks,
      measurement,
      metrics,
      toleranceMm,
      toleranceLabel: COPY.toleranceLabel,
      rows,
      confirmation,
      role,
      viewport,
      unsupported: unsupportedCapabilities,
    }),
    [
      activeFloorId,
      activeScan,
      canEdit,
      compareMode,
      confirmation,
      disabledCompareModes,
      floorOptions,
      geometry,
      isLockedByUser,
      layers,
      marks,
      measurement,
      metrics,
      role,
      rows,
      scaleFixHref,
      scanOpacityPercent,
      state,
      stateNotice,
      swipePosition,
      toleranceMm,
      unsupportedCapabilities,
      viewport,
    ],
  );

  return { model, actions };
}
