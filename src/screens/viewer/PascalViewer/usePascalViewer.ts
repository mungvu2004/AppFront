/**
 * Toàn bộ phần khó của màn xem Pascal, để view ở bên cạnh còn thuần.
 *
 * Ba việc nó làm, và mỗi việc có một cái bẫy đã đo được:
 *
 * 1. **Nạp gói vách ngăn lúc chạy.** Pascal không đi qua gói chính: cổng "chi
 *    phí thêm cho một màn" còn dư 0,4 KiB / 280 và màn Pascal nặng ~1,5 MB
 *    gzip, nên nó là một lượt dựng riêng ra `/assets/pascal/`. Vì vậy đây là
 *    một `import()` tới **đường dẫn tĩnh**, không phải một `import` mà bundler
 *    thấy được — nếu bundler thấy, nó kéo Pascal vào gói chính và cổng đỏ.
 *
 * 2. **Bắt lỗi xuyên gốc React.** Khung nhúng dựng gốc thứ hai, mà
 *    `ScreenErrorBoundary` không với tới đó được. Lỗi đi ngược lên bằng
 *    `onFatal`, và nó đẩy màn sang trạng thái `error` — chứ không ném, vì ném
 *    ở gốc kia thì không ai bắt.
 *
 * 3. **Dọn khi rời màn.** `dispose()` gỡ gốc thứ hai và trả store Pascal về
 *    rỗng. Thiếu bước ấy thì lượt vào sau thấy cảnh của lượt trước — một lỗi
 *    im lặng, không ai báo.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useShortcut } from '@/hooks/useShortcut';
import { formatNumber } from '@/lib/format/number';
import type { PascalScene, SkippedEntity } from '@/lib/pascal/types';
import type { SpatialGraph } from '@/domain/spatial/types';

import {
  PASCAL_VIEWER_CAPTIONS,
  PASCAL_VIEWER_TITLE,
  type PascalViewerErrorCode,
  type PascalViewerState,
  type PascalViewerViewModel,
  type SkippedSummary,
} from './pascalViewerTypes';

/** Đường dẫn tĩnh của gói vách ngăn. Xem `vite.pascal.config.ts`. */
const MOUNT_URL = '/assets/pascal/pascal-mount.js';

/** Số node vào store Pascal và số node store dọn đi. */
interface PascalSceneCensus {
  readonly nodeCount: number;
  readonly droppedIds: readonly string[];
}

/** Hình dạng tối thiểu của gói vách ngăn mà màn này dựa vào. */
interface MountModule {
  readonly mount: (
    element: HTMLElement,
    options: {
      readonly scene: PascalScene;
      readonly onReadyChange?: (ready: boolean) => void;
      readonly onFatal?: (error: Error) => void;
      readonly onSceneLoaded?: (census: PascalSceneCensus) => void;
      readonly onRendererUnavailable?: () => void;
    },
  ) => { readonly dispose: () => void };
}

export interface UsePascalViewerOptions {
  /** Bản vẽ cần dựng. `null` nghĩa là chưa có dữ liệu — màn ở trạng thái nạp. */
  readonly graph: SpatialGraph | null;
  /** Khung xem có đang thu gọn không. Thu gọn thì KHÔNG dựng 3D, để đỡ tốn máy. */
  readonly collapsed?: boolean;
  /**
   * Cửa nạp gói, tách ra để bài kiểm thay được. Mặc định là `import()` thật.
   * Không đặt kiểu trả về là `Promise<MountModule>` cứng ở đây vì `import()`
   * một đường dẫn tĩnh trả về `unknown` với `vite-ignore`.
   */
  readonly loadMount?: () => Promise<MountModule>;
}

export interface UsePascalViewerResult {
  readonly viewModel: PascalViewerViewModel;
  readonly canvasRef: React.RefObject<HTMLDivElement | null>;
  readonly onRetry: () => void;
  readonly onExpand: () => void;
}

/** Lượt nạp đang chạy hoặc đã xong; gói chỉ được kéo về một lần cho cả phiên. */
let mountModulePromise: Promise<MountModule> | null = null;

/**
 * Số lượt nạp đã hỏng — để lượt sau xin một URL KHÁC.
 *
 * Trình duyệt giữ kết quả của một module script theo URL suốt đời trang, kể cả
 * khi kết quả ấy là lỗi: thêm lại thẻ `<script>` cùng `src` thì nó trả lỗi cũ
 * mà không gửi request nào. Đo 2026-10-03 (`e2e/pascal-viewer.spec.ts`, B-V10-01):
 * gói hỏng rồi trở lại, bấm "thử lại" hay phím R bao nhiêu lần cũng chỉ có đúng
 * một request — nút thử lại là một lối thoát giả.
 *
 * ponytail: chỉ đổi URL của tệp vào; chunk con hỏng thì vẫn bị giữ lỗi theo URL
 * của chunk, và chỉ tải lại trang mới gỡ được.
 */
let failedLoads = 0;

/** Cờ toàn cục mà zod 4 đọc lúc nạp — cùng khuôn `pascalMount.tsx` khai `__pascalMount`. */
declare global {
  interface Window {
    __zod_globalConfig?: { jitless?: boolean };
  }
}

/**
 * Nạp gói vách ngăn bằng thẻ `<script src>`, KHÔNG bằng `import()`.
 *
 * Đã đo: `import()` tới đường dẫn tĩnh bị bộ phân tích của `vite dev` viết lại
 * thành `…/pascal-mount.js?import`, và Vite trả **500** khi cố dịch một gói
 * 14 MB đã dựng sẵn — màn rơi vào `PASCAL-01` dù tệp nằm đúng chỗ. Thẻ script
 * đi thẳng qua tầng phục vụ tệp tĩnh, giống nhau ở dev và bản sản phẩm.
 *
 * `type="module"` vì gói là ES module có chia chunk; nó tự treo `mount` lên
 * `window.__pascalMount` (xem `components/pascal/pascalMount.tsx`).
 *
 * Trước khi thêm thẻ script, bật `window.__zod_globalConfig.jitless` (B-V10-05).
 */
const defaultLoadMount = (): Promise<MountModule> => {
  if (mountModulePromise !== null) {
    return mountModulePromise;
  }

  mountModulePromise = new Promise<MountModule>((resolve, reject) => {
    const existing = window.__pascalMount;

    if (existing !== undefined) {
      resolve(existing as MountModule);

      return;
    }

    // B-V10-05: zod 4 trong gói Pascal dò `new Function` để chọn đường JIT — một
    // vi phạm CSP `script-src eval` mỗi lần nạp. `jitless` bỏ hẳn phép dò. Sửa
    // TẠI CHỖ, không thay đối tượng: zod giữ tham chiếu tới nó lúc nạp
    // (`zod/v4/core/core.js:135-136`), nên một đối tượng mới sẽ không tới được nó.
    (window.__zod_globalConfig ??= {}).jitless = true;

    const script = document.createElement('script');
    script.type = 'module';
    script.src = failedLoads === 0 ? MOUNT_URL : `${MOUNT_URL}?attempt=${String(failedLoads)}`;
    script.addEventListener('load', () => {
      const loaded = window.__pascalMount;

      if (loaded === undefined) {
        reject(new Error('Gói vách ngăn nạp xong nhưng không treo `mount` lên window.'));

        return;
      }

      resolve(loaded as MountModule);
    });
    script.addEventListener('error', () => {
      script.remove();
      reject(new Error(`Không tải được ${MOUNT_URL}.`));
    });

    document.head.append(script);
  }).catch((cause: unknown) => {
    // Hỏng một lần không được khoá vĩnh viễn: nút "thử lại" phải nạp lại được.
    mountModulePromise = null;
    failedLoads += 1;

    throw cause instanceof Error ? cause : new Error(String(cause));
  });

  return mountModulePromise;
};

/** Gộp danh sách bỏ qua thành mỗi loại một dòng, đếm sẵn thành chuỗi (A15). */
const summariseSkipped = (skipped: readonly SkippedEntity[]): readonly SkippedSummary[] => {
  const byKind = new Map<string, { count: number; reason: string }>();

  for (const item of skipped) {
    const current = byKind.get(item.kind);
    if (current === undefined) byKind.set(item.kind, { count: 1, reason: item.reason });
    else current.count += 1;
  }

  return [...byKind.entries()].map(([kind, { count, reason }]) => ({
    kind,
    countLabel: formatNumber(count),
    reason,
  }));
};

export function usePascalViewer({
  graph,
  collapsed = false,
  loadMount = defaultLoadMount,
}: UsePascalViewerOptions): UsePascalViewerResult {
  const enabled = useFeatureFlag('scene.pascal-viewer');
  const canvasRef = useRef<HTMLDivElement>(null);

  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState<PascalViewerErrorCode | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  /**
   * Node mà store Pascal dọn đi trong im lặng.
   *
   * Nó dọn node mồ côi và node không với tới được từ `rootNodeIds`, không báo
   * ai. Một tấm sàn bị dọn là một mặt sàn biến mất trong khi màn hình vẫn nói
   * "xong" — nên số này đi vào cùng danh sách "chưa chuyển sang được" mà bản vẽ
   * dùng cho trục định vị và kích thước. Luật ở đây giống luật của
   * `lib/pascal/toPascal.ts`: không đối tượng nào rơi không dấu vết.
   */
  const [droppedCount, setDroppedCount] = useState(0);
  /** Người dùng tự thu khung lại bằng Esc. Khác `collapsed` do nơi gọi truyền vào. */
  const [selfCollapsed, setSelfCollapsed] = useState(false);

  const isCollapsed = selfCollapsed || (collapsed && !expanded);

  /**
   * Bản vẽ rỗng: không có gì để dựng.
   *
   * Đếm theo ĐỒ THỊ chứ không theo số node của cảnh Pascal: cảnh luôn có khu
   * đất, công trình và các tầng, nên đếm node thì một bản vẽ trống vẫn ra sáu
   * node và không bao giờ rỗng. Tầng không có tường thì không dựng ra hình gì.
   */
  const isEmpty =
    graph !== null &&
    graph.walls.length === 0 &&
    graph.rooms.length === 0 &&
    graph.openings.length === 0 &&
    graph.furniture.length === 0;

  /**
   * Cảnh Pascal, dựng trong hiệu ứng chứ không trong `useMemo`.
   *
   * `toPascalScene` nhập ở tầng module thì nó rơi vào chunk DÙNG CHUNG của các
   * route, và cổng "chi phí thêm cho một màn" đo được đúng điều đó: 280,0 / 280,
   * vượt. Nhập muộn đẩy nó sang chunk riêng của màn này — thứ chỉ tải khi ai đó
   * thật sự mở màn.
   */
  const [result, setResult] = useState<{
    readonly scene: PascalScene;
    readonly skipped: readonly SkippedEntity[];
  } | null>(null);

  useEffect(() => {
    // Cờ tắt thì không ai xem cảnh — đổi bản vẽ là việc thừa (B-V10-03).
    if (!enabled || graph === null || isEmpty) {
      setResult(null);

      return;
    }

    let cancelled = false;

    import('@/lib/pascal/toPascal')
      .then(({ toPascalScene }) => {
        if (!cancelled) setResult(toPascalScene(graph));
      })
      .catch(() => {
        if (!cancelled) setFailure('PASCAL-01');
      });

    return () => {
      cancelled = true;
    };
    /* `attempt` có mặt vì "thử lại" phải chạy lại CẢ lượt nạp này: thiếu nó thì
       nạp hỏng → thử lại → `result` vẫn `null` và màn kẹt "đang nạp" mãi (B-V10-04). */
  }, [enabled, graph, isEmpty, attempt]);

  const shouldMount = enabled && !isCollapsed && result !== null && !isEmpty;

  useEffect(() => {
    if (!shouldMount) return;

    const element = canvasRef.current;
    if (element === null || result === null) return;

    let disposed = false;
    let handle: { dispose: () => void } | null = null;

    setReady(false);
    setFailure(null);
    /* Số của lượt trước KHÔNG được sống sang lượt này: thử lại xong mà dòng
       "phần mô hình" vẫn đứng đó thì nó đang nói về một lượt nạp đã chết. */
    setDroppedCount(0);

    loadMount()
      .then((module) => {
        if (disposed) return;
        handle = module.mount(element, {
          scene: result.scene,
          onReadyChange: (value) => {
            if (!disposed) setReady(value);
          },
          onFatal: () => {
            // Thông điệp thô KHÔNG lên màn hình — xem `PascalViewerErrorCode`.
            if (!disposed) setFailure('PASCAL-02');
          },
          onSceneLoaded: (census) => {
            if (!disposed) setDroppedCount(census.droppedIds.length);
          },
          onRendererUnavailable: () => {
            if (!disposed) setFailure('PASCAL-03');
          },
        });
      })
      .catch(() => {
        if (!disposed) setFailure('PASCAL-01');
      });

    return () => {
      disposed = true;
      handle?.dispose();
    };
  }, [shouldMount, result, loadMount, attempt]);

  const onRetry = useCallback(() => {
    setFailure(null);
    setAttempt((value) => value + 1);
  }, []);

  const onExpand = useCallback(() => {
    setSelfCollapsed(false);
    setExpanded(true);
  }, []);

  /**
   * Bàn phím là đường đi hạng nhất, không phải phương án dự phòng (A12).
   *
   * Ba phím, mỗi phím có nút chuột song song — không phím nào là cách DUY NHẤT
   * làm được việc gì:
   *
   * - **Esc** thu khung xem lại. Đây là lời hứa "Esc đóng lớp trên cùng" mà A12
   *   nói không tính năng nào được lấy mất; khung 3D là lớp trên cùng của màn
   *   này. Nó chỉ nhận khi khung đang mở, nên không giành Esc của hộp thoại.
   * - **R** thử lại, chỉ khi đang lỗi.
   * - **E** mở lại khung xem, chỉ khi đang thu gọn.
   */
  useShortcut(
    {
      id: 'pascalViewer.collapse',
      combo: 'Escape',
      scope: 'canvas',
      description: 'thu khung xem 3d lại',
      onTrigger: () => setSelfCollapsed(true),
    },
    { enabled: enabled && !isCollapsed },
  );

  useShortcut(
    {
      id: 'pascalViewer.retry',
      combo: 'R',
      scope: 'canvas',
      description: 'thử nạp lại khung dựng hình',
      onTrigger: onRetry,
    },
    { enabled: enabled && failure !== null },
  );

  useShortcut(
    {
      id: 'pascalViewer.expand',
      combo: 'E',
      scope: 'canvas',
      description: 'mở lại khung xem 3d',
      onTrigger: onExpand,
    },
    { enabled: enabled && isCollapsed },
  );

  const skipped = useMemo(() => {
    const fromAdapter = result === null ? [] : summariseSkipped(result.skipped);

    if (droppedCount === 0) return fromAdapter;

    return [
      ...fromAdapter,
      {
        kind: 'phần mô hình',
        countLabel: formatNumber(droppedCount),
        reason: 'Khung dựng hình dọn đi vì không nối được vào cây của cảnh.',
      },
    ];
  }, [result, droppedCount]);

  const state: PascalViewerState = !enabled
    ? 'forbidden'
    : isCollapsed
      ? 'collapsed'
      : failure !== null
        ? 'error'
        : isEmpty
          ? 'empty'
          : result === null
            ? 'loading'
            : !ready
              ? 'loading'
              : skipped.length > 0
                ? 'partial'
                : 'success';

  const summary = useMemo(() => {
    if (graph === null || (state !== 'success' && state !== 'partial')) return null;
    return {
      levelLabel: formatNumber(graph.levels.length),
      wallLabel: formatNumber(graph.walls.length),
      openingLabel: formatNumber(graph.openings.length),
      roomLabel: formatNumber(graph.rooms.length),
    };
  }, [graph, state]);

  return {
    viewModel: {
      state,
      title: PASCAL_VIEWER_TITLE,
      caption: PASCAL_VIEWER_CAPTIONS[state],
      summary,
      skipped: state === 'partial' ? skipped : [],
      errorCode: failure,
    },
    canvasRef,
    onRetry,
    onExpand,
  };
}
