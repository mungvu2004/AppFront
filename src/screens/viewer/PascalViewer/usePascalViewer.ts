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
import { formatNumber } from '@/lib/format/number';
import { toPascalScene } from '@/lib/pascal/toPascal';
import type { SkippedEntity } from '@/lib/pascal/types';
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

/** Hình dạng tối thiểu của gói vách ngăn mà màn này dựa vào. */
interface MountModule {
  readonly mount: (
    element: HTMLElement,
    options: {
      readonly scene: ReturnType<typeof toPascalScene>['scene'];
      readonly onReadyChange?: (ready: boolean) => void;
      readonly onFatal?: (error: Error) => void;
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

const defaultLoadMount = async (): Promise<MountModule> =>
  (await import(/* @vite-ignore */ MOUNT_URL)) as MountModule;

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

  const isCollapsed = collapsed && !expanded;

  const result = useMemo(() => (graph === null ? null : toPascalScene(graph)), [graph]);

  /** Bản vẽ rỗng: không có node nào ngoài khu đất và công trình. */
  const isEmpty = result !== null && Object.keys(result.scene.nodes).length <= 2;

  const shouldMount = enabled && !isCollapsed && result !== null && !isEmpty;

  useEffect(() => {
    if (!shouldMount) return;

    const element = canvasRef.current;
    if (element === null || result === null) return;

    let disposed = false;
    let handle: { dispose: () => void } | null = null;

    setReady(false);
    setFailure(null);

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
    setExpanded(true);
  }, []);

  const skipped = useMemo(
    () => (result === null ? [] : summariseSkipped(result.skipped)),
    [result],
  );

  const state: PascalViewerState = !enabled
    ? 'forbidden'
    : isCollapsed
      ? 'collapsed'
      : failure !== null
        ? 'error'
        : result === null
          ? 'loading'
          : isEmpty
            ? 'empty'
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
