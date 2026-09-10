/**
 * Hook của màn `/m/du-an/:projectId` — xem 3D **chỉ đọc** trên điện thoại.
 *
 * Nó nối lại logic đã có và không phát minh thêm cái nào. Mỗi việc dưới đây đã
 * có chủ ở tầng dưới, và hook chỉ đưa dữ liệu đi qua đúng chủ của nó:
 *
 * | Việc | Ai làm |
 * |---|---|
 * | tên dự án (trạng thái máy chủ) | `projectDetailQueryOptions` → khoá của `src/lib/query` |
 * | tầng · phòng · phần thiếu | `shellDataOf` / `storeysOf` của vỏ Viewer |
 * | tấm thông tin chỉ đọc | `toViewModel` + `src/lib/format`, lọc tập con ở `mobileViewerGateway` |
 * | đo | sáu hàm của `src/domain/measure` |
 * | mạng yếu (T-09) | `createNetworkMonitor` của `src/lib/offline` |
 * | ngưỡng fps (R-04) | `SCENE_BUDGET.minFrameRate.mobile` + `DEGRADE_WINDOW_MS` |
 * | liên kết chia sẻ (X-04) | `createShareLink` / `revokeShareLink` / `shareLinkUrl` |
 * | toast hoàn tác (A8) | `createUndoTicket` + `NotificationBus` |
 * | đường dẫn bản 2D | `ROUTES.project.floors` |
 *
 * ## `loading` và `error` KHÔNG phải `useState` — R-64
 *
 * Tên dự án là trạng thái máy chủ, nên nó đến từ `useQuery` với khoá của
 * `src/lib/query`; tạo liên kết là một lượt ghi, nên nó đến từ `useMutation`.
 * `hooks/useShareLinks.ts` tự giữ `isLoading`/`error` bằng tay — đó là NGOẠI LỆ
 * ĐI TRƯỚC, không phải khuôn mẫu, và chép nó là vi phạm. Những `useState` còn
 * lại trong file này KHÔNG phải trạng thái truy vấn: chúng là mức chi tiết mà
 * cảnh 3D đang dựng, việc máy có dựng nổi cảnh hay không, tầng đang xem, công
 * cụ đang mở, thứ đang chọn, và những phép đo người dùng vừa chấm — không lượt
 * HTTP nào đứng sau chúng để `useQuery` theo dõi.
 *
 * ## Cổng mặc định là cổng THẬT
 *
 * `useViewerShell.ts:409-410` mặc định dùng cổng GIẢ và vì thế hiện đúng bộ mẫu
 * bốn tầng trên MỌI dự án thật mà không báo gì. `useViewer3D.ts:386-388` mặc
 * định ngược lại. Màn này theo `useViewer3D`.
 *
 * ## Cảnh 3D đi vào bằng cách TIÊM, không bằng `import`
 *
 * `mobileViewerScene.ts` là của một người khác trong cùng lượt dựng màn, và một
 * hook không thể `import` thứ chưa có mặt. Nên `mountScene` là một tham số BẮT
 * BUỘC: thiếu nó là lỗi biên dịch chứ không phải một màn im lặng không có hình.
 * Cùng lý do với `notifications` — A8 đòi mọi thay đổi có toast hoàn tác, và
 * `MobileViewerProps` không có chỗ nào cho toast, nên nơi nhận toast phải do
 * người gọi cấp. Thứ THIẾU không hiện ra trong diff, nên nó đóng bằng cấu trúc.
 *
 * ## Hình của tầng đi xuống cảnh, không chỉ mã tầng
 *
 * `MobileViewerSceneOptions` bản đầu chỉ có `floorIds` — mã tầng — và với riêng
 * mã tầng thì `mobileViewerScene.ts` không dựng được một tam giác nào. Hợp đồng
 * đã sửa (mục 4: `levels` là trường **bắt buộc**), và hook là nơi dựng mảng ấy:
 * `toBuildFloorInput(spatial, levelId)` cho từng tầng của `data.storeys`, đúng
 * phép chuyển mà `useViewer3D.ts:401-424` dùng trên máy tính. Một đồ thị không
 * chuyển được thành trạng thái `error`, không thành một mô hình rỗng im lặng.
 *
 * ## Một chỗ hợp đồng chưa phủ, và cách bắc qua
 *
 * `MobileViewerSceneOptions.onPick` đưa lên một `EntityHit` mà KHÔNG kèm toạ độ
 * pixel, còn `MobileViewerSceneHandle.pickMeasurePoint` lại nhận pixel. Nên hook
 * tự ghi lại điểm chạm cuối bằng MỘT listener `pointerdown` thụ động trên chính
 * canvas nó được trao — đúng việc mà `useViewerShell.ts:735-788` làm trên máy
 * tính. Listener này không `preventDefault`, không `stopPropagation`, không đọc
 * nhiều ngón và không chứa một phép toán camera nào: bộ nhận cử chỉ của
 * `mobileViewerGestures.ts` vẫn là chủ duy nhất của ba cử chỉ R-06.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useMutation, useQuery } from '@tanstack/react-query';

import { measureDistance, type MeasurePoint } from '@/domain/measure/measure';
import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import { toBuildFloorInput } from '@/domain/spatial/toBuildFloorInput';
import { can } from '@/lib/auth/permissions';
import {
  createShareLink,
  revokeShareLink,
  shareLinkUrl,
  type ShareLink,
  type ShareLinkGateway,
} from '@/lib/export/shareLink';
import type { ColorTokenName } from '@/lib/coloring/scales';
import { createUuid } from '@/lib/http/ids';
import type { BuildFloorInput } from '@/lib/three/build/floor';
import { createUndoTicket } from '@/lib/mutations/undoTicket';
import type { NotificationBus } from '@/lib/mutations/notificationBus';
import type { NetworkMonitorStatus } from '@/lib/offline/networkMonitor';
import { DETAIL_LEVELS, type DetailLevel } from '@/lib/three/build/lod';
import type { EntityHit } from '@/lib/three/interaction/hitTest';
import { SCENE_BUDGET } from '@/lib/three/perf/budget';
import { DEGRADE_WINDOW_MS } from '@/lib/three/perf/monitor';
import { ROUTES } from '@/routes/paths';
import { useStore } from '@/store';
import { useShareLinkGateway } from '@/hooks/useShareLinkGateway';
import { shellDataOf } from '@/screens/viewer/ViewerShell';
import type { ProjectRole } from '@/types/project';

import {
  createMobileViewerGateway,
  desktopLinkMailtoHref,
  floorsOf,
  isNetworkDegraded,
  selectionOf,
  toMobileMeasurement,
  type MobileViewerGateway,
} from './mobileViewerGateway';
import { projectDetailQueryOptions } from './mobileViewerQueries';
import {
  MOBILE_VIEWER_COMPACT_WIDTH_PX,
  MOBILE_VIEWER_MODEL_TOKEN,
  type MobileViewerMeasurement,
  type MobileViewerModel,
  type MobileViewerSceneHandle,
  type MobileViewerSceneMount,
  type MobileViewerSceneOptions,
  type MobileViewerSelection,
  type MobileViewerState,
  type MobileViewerToolId,
} from './mobileViewerTypes';

/* -------------------------------------------------------------------------- */
/* Chuỗi tiếng Việt của màn. Bản sao để soát nằm ở `i18n.hook.fragment.json`.  */
/* -------------------------------------------------------------------------- */

/** Nhãn mức chi tiết trong lúc còn đang nâng dần lên. `full` là "hết chuyện để nói". */
const RISING_DETAIL_LABELS: Readonly<Record<DetailLevel, string | null>> = Object.freeze({
  block: 'đang tải mức gọn',
  reduced: 'đang tải mức vừa',
  full: null,
});

/** Nhãn mức chi tiết sau khi R-04 vừa HẠ xuống vì máy không theo kịp. */
const DEGRADED_DETAIL_LABELS: Readonly<Record<DetailLevel, string | null>> = Object.freeze({
  block: 'đã hạ xuống mức gọn để hình chạy mượt',
  reduced: 'đã hạ xuống mức vừa để hình chạy mượt',
  full: null,
});

/** Tên hiện trên thanh trên khi đồ thị và máy chủ đều chưa cho biết tên nào. */
const UNNAMED_PROJECT = 'dự án chưa có tên';

/** Loại của mọi toast màn này phát ra — `NotificationBus` gộp theo trường này. */
const SHARE_NOTIFICATION_TYPE = 'shareLink';

const SHARE_COPIED_TITLE = 'đã tạo liên kết chia sẻ';
const SHARE_COPIED_BODY = 'liên kết chỉ xem đã được chép vào bộ nhớ tạm.';
const SHARE_COPY_BLOCKED_BODY = 'máy không cho chép tự động, hãy mở liên kết rồi chép thủ công.';
const SHARE_MAILED_TITLE = 'đã tạo liên kết cho máy tính';
const SHARE_MAILED_BODY = 'ứng dụng thư đã mở sẵn một thư kèm liên kết và câu giải thích.';
const SHARE_FAILED_TITLE = 'chưa tạo được liên kết chia sẻ';
const SHARE_FAILED_BODY = 'chưa gọi được máy chủ chia sẻ, hãy thử lại khi mạng khá hơn.';
const SHARE_UNDO_LABEL = 'thu hồi liên kết vừa tạo';

/* -------------------------------------------------------------------------- */
/* Tham số và những kiểu riêng của hook.                                       */
/* -------------------------------------------------------------------------- */

/** Không tầng nào dựng được — một hằng đông cứng, để mọi lượt trả về cùng một mảng. */
const EMPTY_LEVELS: readonly BuildFloorInput[] = Object.freeze([]);

/** Chữ ký lắp cảnh của `mobileViewerScene.ts`, tiêm vào chứ không `import`. */
export type MountMobileViewerScene = (
  canvas: HTMLCanvasElement,
  options: MobileViewerSceneOptions,
) => MobileViewerSceneMount;

/** Vì sao cảnh không dựng được — cả ba đều dẫn tới trạng thái `error`. */
type SceneFailure = 'webglUnavailable' | 'deviceTooWeak' | 'frameRateTooLow';

/** Hai kiểu chia sẻ, cùng một lượt tạo liên kết. */
type ShareIntent = 'copy' | 'mail';

/** Kết quả một lượt tạo liên kết; `link === null` là "máy chủ không cho". */
interface ShareOutcome {
  readonly intent: ShareIntent;
  readonly link: ShareLink | null;
}

export interface UseMobileViewerOptions {
  readonly projectId: string;
  /** Canvas do container cấp; `null` khi cây chưa gắn xong. */
  readonly canvas: HTMLCanvasElement | null;
  /** `mountMobileViewerScene` của `mobileViewerScene.ts`. */
  readonly mountScene: MountMobileViewerScene;
  /** Nơi nhận toast hoàn tác của A8. */
  readonly notifications: Pick<NotificationBus, 'publish'>;
  /** Vai của người đang xem. Vắng mặt là "chưa biết vai", KHÁC với "không có vai". */
  readonly roles?: readonly ProjectRole[] | undefined;
  /** Cổng dữ liệu; vắng thì dùng cổng THẬT, không phải cổng giả. */
  readonly gateway?: MobileViewerGateway | undefined;
  /** Cổng chia sẻ; vắng thì lấy cổng của phiên đăng nhập hiện tại. */
  readonly shareLinks?: ShareLinkGateway | null | undefined;
  /** Đồ thị; vắng thì đọc kho. Truyền vào để test và story không cần dựng kho. */
  readonly spatial?: NormalizedSpatial | null | undefined;
  /** Đồng hồ của phép đếm "fps thấp bao lâu rồi". */
  readonly now?: (() => number) | undefined;
}

/* -------------------------------------------------------------------------- */
/* Phép đọc thuần.                                                             */
/* -------------------------------------------------------------------------- */

/**
 * `next` có thô hơn `previous` không.
 *
 * `DETAIL_LEVELS` xếp từ mịn tới thô (`full` → `reduced` → `block`), nên "thô
 * hơn" là "đứng sau trong danh sách ấy". Không có bảng thứ hạng nào viết tay ở
 * đây: thứ tự là của `src/lib/three/build/lod`.
 */
function isCoarser(next: DetailLevel, previous: DetailLevel): boolean {
  return DETAIL_LEVELS.indexOf(next) > DETAIL_LEVELS.indexOf(previous);
}

/**
 * Truy vấn phương tiện cho bề ngang gọn.
 *
 * Viết bằng cú pháp dải (`width < …`) chứ không `max-width: … - 1px`: đặc tả nói
 * "nhỏ HƠN", và cú pháp dải nói đúng điều đó mà không phải trừ một pixel ra khỏi
 * một hằng số bố cục.
 */
const COMPACT_MEDIA_QUERY = `(width < ${String(MOBILE_VIEWER_COMPACT_WIDTH_PX)}px)`;

/** Máy có `matchMedia` không — jsdom và worker thì không, và đó không phải sự cố. */
function hasMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Mọi thứ `MobileViewer.tsx` cần, và không gì hơn.
 *
 * @param options Dự án, canvas, cảnh để lắp, và các chỗ tiêm.
 * @returns Đúng {@link MobileViewerModel} — `MobileViewerProps` trừ `canvasRef`.
 */
export function useMobileViewer(options: UseMobileViewerOptions): MobileViewerModel {
  const { canvas, mountScene, notifications, projectId, roles } = options;

  /* ---- Cổng và kho ------------------------------------------------------ */

  const gateway = useMemo(
    () => options.gateway ?? createMobileViewerGateway(),
    [options.gateway],
  );

  const sessionShareLinks = useShareLinkGateway();
  const shareLinks = options.shareLinks !== undefined ? options.shareLinks : sessionShareLinks;

  const storeSpatial = useStore((state) => state.spatial);
  const spatial = options.spatial !== undefined ? options.spatial : storeSpatial;

  const nowRef = useRef<() => number>(Date.now);
  nowRef.current = options.now ?? Date.now;

  /* ---- Trạng thái máy chủ: nguồn DUY NHẤT của loading và error (R-64) ---- */

  const projectQuery = useQuery(projectDetailQueryOptions(gateway.projectsApi, projectId));

  const projectName = useMemo(() => {
    const name = projectQuery.data?.name.trim() ?? '';

    return name === '' ? UNNAMED_PROJECT : name;
  }, [projectQuery.data]);

  /* ---- Tầng, đọc từ đồ thị chứ không từ mạng ---------------------------- */

  const data = useMemo(() => shellDataOf(spatial), [spatial]);
  const floors = useMemo(() => floorsOf(spatial, data.storeys), [spatial, data.storeys]);
  const floorIds = useMemo(() => floors.map((floor) => floor.id), [floors]);

  /**
   * Đồ thị → đầu vào của R-01, cùng phép chuyển mà `useViewer3D.ts:401-424` dùng.
   *
   * **Vì sao đoạn này tồn tại.** `floorIds` là MÃ tầng, và với riêng mã tầng thì
   * `mobileViewerScene.ts` không dựng được một tam giác nào — cảnh lắp xong,
   * mọi cổng xanh, người dùng nhìn vào một mô hình rỗng. Hợp đồng nay khai
   * `levels` là trường bắt buộc (mục 4), nên chỗ dựng nó là ở đây, cạnh nơi dải
   * tầng được đọc ra, chứ không phải một `useEffect` thứ hai.
   *
   * `toBuildFloorInput` ném khi đồ thị hỏng chỉ mục hoặc mang số đo không hữu
   * hạn. Đó là một mô hình không dựng được, không phải một sự cố kỹ thuật để
   * hiện mã lỗi: nó thành trạng thái `error`, và `error` của màn này mời người
   * dùng sang bản 2D — lối thoát đúng cho cả hai lý do.
   */
  const conversion = useMemo((): { levels: readonly BuildFloorInput[]; failed: boolean } => {
    if (spatial === null) {
      return { levels: EMPTY_LEVELS, failed: false };
    }

    try {
      const built: BuildFloorInput[] = [];

      for (const storey of data.storeys) {
        const input = toBuildFloorInput(spatial, storey.id);

        if (input !== null) {
          built.push(input);
        }
      }

      return { levels: built, failed: false };
    } catch {
      return { levels: EMPTY_LEVELS, failed: true };
    }
  }, [spatial, data.storeys]);

  const levels = conversion.levels;

  /**
   * Một token cho cả mô hình — màn chỉ đọc này không có bộ chọn chế độ tô.
   *
   * Trị số đến từ {@link MOBILE_VIEWER_MODEL_TOKEN} của hợp đồng, cùng hằng mà
   * cảnh dùng làm mặc định; hook truyền nó tường minh để cái seam này nhìn thấy
   * được ở một chỗ, thay vì đúng nhờ hai bên tình cờ mặc định giống nhau.
   */
  const tokenOfPartKind = useCallback((): ColorTokenName => MOBILE_VIEWER_MODEL_TOKEN, []);

  const [activeFloorId, setActiveFloorId] = useState<string | null>(null);

  // Tầng đang xem luôn là một tầng CÓ THẬT trong đồ thị đang mở. Đồ thị đổi thì
  // tầng cũ có thể không còn, và giữ lại một mã tầng đã biến mất là cách nhanh
  // nhất để dải tầng không tô sáng gì cả.
  useEffect(() => {
    setActiveFloorId((current) =>
      current !== null && floorIds.includes(current) ? current : (floorIds[0] ?? null),
    );
  }, [floorIds]);

  /* ---- Bề ngang: `collapsed` do khung nhìn quyết định, không do dữ liệu -- */

  const [isCompact, setIsCompact] = useState(
    () => hasMatchMedia() && window.matchMedia(COMPACT_MEDIA_QUERY).matches,
  );

  useEffect(() => {
    if (!hasMatchMedia()) {
      return undefined;
    }

    const media = window.matchMedia(COMPACT_MEDIA_QUERY);

    setIsCompact(media.matches);

    const listen = (event: MediaQueryListEvent): void => setIsCompact(event.matches);

    media.addEventListener('change', listen);

    return () => media.removeEventListener('change', listen);
  }, []);

  /* ---- Mạng yếu — T-09 --------------------------------------------------- */

  const [isNetworkWeak, setIsNetworkWeak] = useState(false);

  useEffect(() => {
    const monitor = gateway.createMonitor();

    const read = (status: NetworkMonitorStatus): void => setIsNetworkWeak(isNetworkDegraded(status));

    read(monitor.getStatus());

    const unsubscribe = monitor.subscribe(read);

    monitor.start();

    return () => {
      unsubscribe();
      monitor.stop();
    };
  }, [gateway]);

  /* ---- Quyền ------------------------------------------------------------- */

  // Không có năng lực "xem" nào trong `permissionMatrix` — cả mười mục ở đó đều
  // là năng lực GHI, và cả ba vai (kể cả `viewer`) đều mở được màn này. Nên
  // "không có quyền" ở đây nghĩa là biết chắc người này KHÔNG mang vai nào trên
  // dự án. Vắng `roles` là "chưa biết vai", một cảnh khác hẳn mà A11 phân biệt.
  const isForbidden = roles !== undefined && roles.length === 0;

  const canEditOnDesktop = useMemo(
    () => can('edit', 'layer', roles === undefined ? {} : { roles }),
    [roles],
  );

  /* ---- Cảnh 3D ----------------------------------------------------------- */

  const handleRef = useRef<MobileViewerSceneHandle | null>(null);
  const [isSceneMounted, setIsSceneMounted] = useState(false);
  const [sceneFailure, setSceneFailure] = useState<SceneFailure | null>(null);

  const [detail, setDetail] = useState<DetailLevel>('block');
  const [isDegraded, setIsDegraded] = useState(false);
  const detailRef = useRef<DetailLevel>('block');
  const lowFrameSinceRef = useRef<number | null>(null);

  const [selection, setSelection] = useState<MobileViewerSelection | null>(null);
  const [measurements, setMeasurements] = useState<readonly MobileViewerMeasurement[]>([]);
  const pendingMeasureRef = useRef<MeasurePoint | null>(null);
  const lastTapRef = useRef<{ readonly xPx: number; readonly yPx: number } | null>(null);

  const [activeTool, setActiveTool] = useState<MobileViewerToolId | null>(null);

  /**
   * R-04 vừa đổi mức chi tiết.
   *
   * Hạ xuống là tin cần nói ra ("đã hạ xuống mức gọn"), nâng lên thì không —
   * mở màn ở `block` rồi lên `full` là đường đi bình thường của "mức gọn trước,
   * rồi nâng dần", không phải một sự cố để báo.
   */
  const handleDetailChange = useCallback((next: DetailLevel): void => {
    setIsDegraded(isCoarser(next, detailRef.current));
    detailRef.current = next;
    setDetail(next);
  }, []);

  /**
   * fps mới nhất từ cảnh.
   *
   * Ngưỡng đọc từ `SCENE_BUDGET.minFrameRate.mobile` và cửa sổ chờ từ
   * `DEGRADE_WINDOW_MS` — hai hằng của `src/lib/three/perf`, không phải hai con
   * số gõ tay (R-71). Thứ tự phản ứng đúng như đặc tả cấm bỏ qua: hạ mức chi
   * tiết TRƯỚC, và chỉ khi đã ở mức gọn nhất mà vẫn không kịp trong suốt cả cửa
   * sổ thì mới nhận là máy không dựng nổi và mời sang bản 2D.
   */
  const handleFrameRate = useCallback((fps: number): void => {
    if (fps >= SCENE_BUDGET.minFrameRate.mobile) {
      lowFrameSinceRef.current = null;

      return;
    }

    const timestamp = nowRef.current();

    if (lowFrameSinceRef.current === null) {
      lowFrameSinceRef.current = timestamp;

      return;
    }

    if (timestamp - lowFrameSinceRef.current < DEGRADE_WINDOW_MS) {
      return;
    }

    if (detailRef.current !== 'block') {
      return;
    }

    setSceneFailure('frameRateTooLow');
  }, []);

  /**
   * Chạm trúng một đối tượng.
   *
   * Công cụ đo đang mở thì cú chạm là một điểm đo, không phải một lượt chọn:
   * hai điểm liên tiếp thành một phép `measureDistance` của `src/domain/measure`.
   * Ngoài lúc ấy, cú chạm mở tấm thông tin CHỈ ĐỌC.
   */
  const handleScenePick = useCallback(
    (hit: EntityHit | null): void => {
      if (activeTool !== 'measure') {
        setSelection(selectionOf(hit, spatial, canEditOnDesktop));

        return;
      }

      const tap = lastTapRef.current;
      const point = tap === null ? null : (handleRef.current?.pickMeasurePoint(tap.xPx, tap.yPx) ?? null);

      if (point === null) {
        return;
      }

      const pending = pendingMeasureRef.current;

      if (pending === null) {
        pendingMeasureRef.current = point;

        return;
      }

      pendingMeasureRef.current = null;

      const measurement = measureDistance(pending, point);

      setMeasurements((current) => [...current, toMobileMeasurement(measurement, createUuid())]);
    },
    [activeTool, canEditOnDesktop, spatial],
  );

  // Ba lời gọi ngược của cảnh đi qua một ô nhớ, để việc chúng đổi theo mỗi lượt
  // vẽ KHÔNG kéo theo một lượt dọn cảnh và dựng lại từ đầu.
  const sceneCallbacksRef = useRef({
    onPick: handleScenePick,
    onDetailChange: handleDetailChange,
    onFrameRate: handleFrameRate,
  });

  useEffect(() => {
    sceneCallbacksRef.current = {
      onPick: handleScenePick,
      onDetailChange: handleDetailChange,
      onFrameRate: handleFrameRate,
    };
  }, [handleScenePick, handleDetailChange, handleFrameRate]);

  // Toạ độ cú chạm cuối, tính theo góc trên trái của canvas — thứ
  // `pickMeasurePoint` nhận. Listener thụ động: nó chỉ ĐỌC, nên bộ nhận cử chỉ
  // của T5 vẫn thấy nguyên vẹn mọi sự kiện.
  useEffect(() => {
    if (canvas === null) {
      return undefined;
    }

    const record = (event: PointerEvent): void => {
      const box = canvas.getBoundingClientRect();

      lastTapRef.current = { xPx: event.clientX - box.left, yPx: event.clientY - box.top };
    };

    canvas.addEventListener('pointerdown', record, { passive: true });

    return () => canvas.removeEventListener('pointerdown', record);
  }, [canvas]);

  useEffect(() => {
    if (canvas === null || floorIds.length === 0) {
      return undefined;
    }

    const mount = mountScene(canvas, {
      floorIds,
      // Hình THẬT của từng tầng. Thiếu mảng này thì cảnh lắp xong mà không có gì
      // để vẽ, và không một cổng nào bắt được điều đó.
      levels,
      tokenOfPartKind,
      // "Mức gọn trước, rồi nâng dần" — R-04. Mở màn ở `full` trên một máy ở
      // công trường là cách chắc chắn nhất để khung hình đầu tiên đến muộn.
      initialDetail: 'block',
      onPick: (hit) => sceneCallbacksRef.current.onPick(hit),
      onDetailChange: (next) => sceneCallbacksRef.current.onDetailChange(next),
      onFrameRate: (fps) => sceneCallbacksRef.current.onFrameRate(fps),
    });

    if (!mount.ok) {
      setSceneFailure(mount.reason);

      return undefined;
    }

    handleRef.current = mount.handle;
    setSceneFailure(null);
    setIsSceneMounted(true);

    return () => {
      // R-05: mọi tài nguyên GPU trả lại đúng một lần.
      mount.handle.dispose();
      handleRef.current = null;
      setIsSceneMounted(false);
    };
  }, [canvas, floorIds, levels, tokenOfPartKind, mountScene]);

  useEffect(() => {
    handleRef.current?.setActiveFloor(activeFloorId);
  }, [activeFloorId, isSceneMounted]);

  /* ---- Chia sẻ — X-04, và toast hoàn tác của A8 -------------------------- */

  const shareMutation = useMutation<ShareOutcome, Error, ShareIntent>({
    mutationFn: async (intent: ShareIntent): Promise<ShareOutcome> => {
      if (shareLinks === null) {
        return { intent, link: null };
      }

      const made = await createShareLink(shareLinks, {
        projectId,
        // Màn chỉ đọc chia sẻ một lối xem chỉ đọc; bình luận là việc của máy tính.
        permission: 'view',
        expiresAt: null,
      });

      return { intent, link: made.ok ? made.data : null };
    },
    onSuccess: async ({ intent, link }: ShareOutcome): Promise<void> => {
      if (link === null || shareLinks === null) {
        notifications.publish({
          type: SHARE_NOTIFICATION_TYPE,
          title: SHARE_FAILED_TITLE,
          description: SHARE_FAILED_BODY,
        });

        return;
      }

      const url = shareLinkUrl(link);

      // A8: tạo liên kết là một thay đổi, nên nó đi kèm vé hoàn tác. Hoàn tác
      // của "tạo" là "thu hồi" — đúng cửa thứ ba của `ShareLinkGateway`.
      const undoTicket = createUndoTicket({
        description: SHARE_UNDO_LABEL,
        undo: () => {
          void revokeShareLink(shareLinks, { projectId, linkId: link.id });
        },
      });

      if (intent === 'mail') {
        gateway.openMail(desktopLinkMailtoHref(projectName, url));

        notifications.publish({
          type: SHARE_NOTIFICATION_TYPE,
          title: SHARE_MAILED_TITLE,
          description: SHARE_MAILED_BODY,
          undoTicket,
        });

        return;
      }

      const copied = await gateway.copyText(url);

      notifications.publish({
        type: SHARE_NOTIFICATION_TYPE,
        title: SHARE_COPIED_TITLE,
        description: copied ? SHARE_COPIED_BODY : SHARE_COPY_BLOCKED_BODY,
        undoTicket,
      });
    },
  });

  const { mutate: share } = shareMutation;

  const onShare = useCallback((): void => share('copy'), [share]);
  const onSendDesktopLink = useCallback((): void => share('mail'), [share]);

  /* ---- Thanh dưới và tấm thông tin --------------------------------------- */

  const onSelectTool = useCallback(
    (tool: MobileViewerToolId | null): void => {
      // Ở bề ngang gọn, `view` không biến mất mà GỘP vào tấm "tầng" — nên bấm
      // vào nó ở đó vẫn mở đúng tấm ấy, không rơi vào khoảng không.
      setActiveTool(isCompact && tool === 'view' ? 'floors' : tool);
    },
    [isCompact],
  );

  const onSelectFloor = useCallback((floorId: string): void => setActiveFloorId(floorId), []);

  const onDismissSelection = useCallback((): void => setSelection(null), []);

  /* ---- Bảy trạng thái — A11 / R-63 --------------------------------------- */

  /**
   * Bảy nhánh, không nhánh nào bỏ sót — màn trắng là thất bại DUY NHẤT mà A11
   * tồn tại để chặn, và nó chỉ xảy ra khi một tổ hợp rơi ra khỏi bảng này.
   *
   * Thứ tự có lý do: hỏng và đang chạy dở đứng TRƯỚC bố cục, vì `collapsed` chỉ
   * nói bề ngang màn hình chứ không nói được rằng dữ liệu chưa về. Nên
   * `collapsed` thay chỗ của `success`, không thay chỗ của sáu nhánh kia.
   */
  const state = useMemo((): MobileViewerState => {
    if (isForbidden) {
      return 'forbidden';
    }
    if (sceneFailure !== null || conversion.failed || projectQuery.isError) {
      return 'error';
    }
    if (projectQuery.isLoading || (canvas !== null && floorIds.length > 0 && !isSceneMounted)) {
      return 'loading';
    }
    if (data.storeys.length === 0) {
      return 'empty';
    }
    if (data.isPartial || isNetworkWeak || floors.some((floor) => !floor.isLoaded)) {
      return 'partial';
    }
    if (isCompact) {
      return 'collapsed';
    }

    return 'success';
  }, [
    isForbidden,
    sceneFailure,
    conversion.failed,
    projectQuery.isError,
    projectQuery.isLoading,
    canvas,
    floorIds.length,
    isSceneMounted,
    data.storeys.length,
    data.isPartial,
    isNetworkWeak,
    floors,
    isCompact,
  ]);

  /* ---- Nhãn mức chi tiết -------------------------------------------------- */

  const detailLabel = useMemo(
    () => (isDegraded ? DEGRADED_DETAIL_LABELS[detail] : RISING_DETAIL_LABELS[detail]),
    [detail, isDegraded],
  );

  return {
    state,
    projectName,
    onShare,
    isCompact,
    activeTool,
    onSelectTool,
    floors,
    activeFloorId,
    onSelectFloor,
    selection,
    onDismissSelection,
    onSendDesktopLink,
    measurements,
    detailLabel,
    // Bản 2D của cùng dự án là danh sách tầng — lối thoát luôn hợp lệ, kể cả
    // khi đồ thị chưa có tầng nào để đặt tên vào đường dẫn.
    fallback2dHref: ROUTES.project.floors(projectId),
  };
}
