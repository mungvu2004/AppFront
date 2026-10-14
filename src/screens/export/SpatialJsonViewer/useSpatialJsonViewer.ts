/**
 * S-36 — toàn bộ logic của màn xem Spatial JSON.
 *
 * ## Vì sao thư mục này KHÔNG có `spatialJsonViewerGateway.ts`
 *
 * Mọi màn khác trong `src/screens/export` đều có một tệp cổng, vì chúng đọc dữ
 * liệu qua mạng. Màn này thì không: đồ thị không gian của tầng đang mở **đã nằm
 * trong kho** (`spatialSlice.spatial`, kiểu `NormalizedSpatial`), và đặc tả nói
 * rõ màn chỉ đọc. Dựng một cổng gọi mạng cho dữ liệu đã có sẵn tại chỗ là thêm
 * một tầng không chở gì — R-69.
 *
 * Nên ranh giới ở đây là **props**: container đọc kho và quyền rồi truyền
 * xuống; hook không chạm `useStore`, nên nó test được bằng `renderHook` thuần
 * không cần dựng kho.
 *
 * ## Bảy trạng thái suy ra từ dữ liệu, không phải từ một cờ rời
 *
 * | Trạng thái | Điều kiện |
 * |---|---|
 * | không có quyền | `canView === false` — xét TRƯỚC mọi thứ khác |
 * | lỗi | `error !== null` |
 * | đang tải | chưa có đồ thị và đang tải |
 * | rỗng | có đồ thị nhưng không thực thể nào, hoặc chưa có đồ thị và không tải |
 * | một phần | đã có đồ thị **và** vẫn đang tải |
 * | thu gọn | `isNarrow` — dưới 1024, nửa phải ẩn đi |
 * | thành công | còn lại |
 *
 * Thứ tự xét là thứ tự nghiêm trọng giảm dần: không quyền che lỗi, lỗi che
 * đang tải. Một màn hiện cả "lỗi" lẫn "đang tải" cùng lúc là một màn nói hai
 * câu trái nhau.
 */

import { useCallback, useMemo, useState } from 'react';

import type { SpatialGraph } from '@/domain/spatial/types';
import { formatFileSize } from '@/lib/format/bytes';
import { formatNumber } from '@/lib/format/number';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';

import {
  ancestorsOf,
  byteLengthOf,
  countEntities,
  describeCounts,
  findMatches,
  flattenJson,
  summariseValidity,
  toRawText,
  valueAtPath,
  visibleNodes,
} from './spatialJsonModel';
import type {
  SpatialJsonIssue,
  SpatialJsonTabId,
  SpatialJsonViewerActions,
  SpatialJsonViewerModel,
  SpatialJsonViewMode,
} from './types';

/**
 * Khoá gốc mở sẵn khi màn vừa dựng.
 *
 * Đặc tả nói "mọi khoá gốc gấp lại trừ `project_metadata`". Trong mô hình thật
 * khoá ấy tên là `building` (`domain/spatial/types.ts`), nên đây là cùng một
 * quyết định, chỉ khác tên trường.
 */
const DEFAULT_EXPANDED_ROOT = 'building';

const FORBIDDEN_MESSAGE =
  'Bạn không có quyền xem dữ liệu không gian của dự án này. Hãy hỏi quản trị viên dự án để được cấp quyền xem.';

const EMPTY_ISSUES: readonly SpatialJsonIssue[] = [];

/** Thứ container truyền xuống. Không có gì ở đây là hàm gọi mạng. */
export interface UseSpatialJsonViewerOptions {
  /** Đồ thị đã dựng lại từ dạng phẳng của kho; `null` khi chưa có tầng nào mở. */
  readonly graph: SpatialGraph | null;
  readonly issues: readonly SpatialJsonIssue[];
  readonly isLoading: boolean;
  readonly canView: boolean;
  readonly isNarrow: boolean;
  readonly errorMessage: string | null;
  readonly onReopenFloors: () => void;
  readonly onDownload?: (() => void) | undefined;
  readonly onCopy?: ((text: string) => void) | undefined;
}

/** Câu của bộ đếm khi ô tìm kiếm không khớp hàng nào. */
const NO_MATCH_LABEL = 'Không tìm thấy kết quả';

/** Mô hình và hành động của S-36. */
export type UseSpatialJsonViewerResult = readonly [SpatialJsonViewerModel, SpatialJsonViewerActions];

export function useSpatialJsonViewer(options: UseSpatialJsonViewerOptions): UseSpatialJsonViewerResult {
  const {
    canView,
    errorMessage,
    graph,
    isLoading,
    isNarrow,
    issues,
    onCopy,
    onDownload,
    onReopenFloors,
  } = options;

  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
    () => new Set([DEFAULT_EXPANDED_ROOT]),
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeTabId, setActiveTabId] = useState<SpatialJsonTabId>('json');
  const [viewMode, setViewMode] = useState<SpatialJsonViewMode>('tree');

  const allNodes = useMemo(() => flattenJson(graph), [graph]);
  const rawText = useMemo(() => (graph === null ? '' : toRawText(graph)), [graph]);
  const counts = useMemo(() => countEntities(graph), [graph]);
  const validity = useMemo(() => summariseValidity(canView ? issues : EMPTY_ISSUES), [canView, issues]);

  const matchIds = useMemo(() => findMatches(allNodes, searchQuery), [allNodes, searchQuery]);

  /**
   * Ô tìm kiếm mở sẵn tổ tiên của mọi kết quả.
   *
   * Không mở thì bộ đếm "3 / 12" nói về những hàng người dùng không nhìn thấy,
   * và phím `n` nhảy tới chỗ trống.
   */
  const effectiveExpanded = useMemo(() => {
    if (matchIds.length === 0) {
      return expandedIds;
    }

    const next = new Set(expandedIds);

    for (const id of matchIds) {
      for (const ancestor of ancestorsOf(id)) {
        next.add(ancestor);
      }
    }

    return next;
  }, [expandedIds, matchIds]);

  const nodes = useMemo(
    () => visibleNodes(allNodes, effectiveExpanded, new Set(matchIds)),
    [allNodes, effectiveExpanded, matchIds],
  );

  const entityCount =
    counts.walls + counts.openings + counts.rooms + counts.furniture + counts.axes + counts.dimensions + counts.notes;

  const state: SevenState = useMemo(() => {
    if (!canView) {
      return 'forbidden';
    }

    if (errorMessage !== null) {
      return 'error';
    }

    if (graph === null) {
      return isLoading ? 'loading' : 'empty';
    }

    if (entityCount === 0) {
      return 'empty';
    }

    if (isLoading) {
      return 'partial';
    }

    return isNarrow ? 'collapsed' : 'success';
  }, [canView, entityCount, errorMessage, graph, isLoading, isNarrow]);

  const matchLabel = useMemo(() => {
    if (searchQuery.trim().length === 0) {
      return null;
    }

    // "0 / 0" trơn trông như tìm kiếm không làm gì (BUG-448): nói thẳng là không khớp.
    if (matchIds.length === 0) {
      return NO_MATCH_LABEL;
    }

    return `${formatNumber(matchIndex + 1)} / ${formatNumber(matchIds.length)}`;
  }, [matchIds.length, matchIndex, searchQuery]);

  const onToggleNode = useCallback((nodeId: string) => {
    setExpandedIds((previous) => {
      const next = new Set(previous);

      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }

      return next;
    });
  }, []);

  /** "Mở rộng tất cả" là TỨC THÌ theo đặc tả — không hoạt cảnh dây chuyền. */
  const onExpandAll = useCallback(() => {
    setExpandedIds(new Set(allNodes.filter((node) => node.isExpandable).map((node) => node.id)));
  }, [allNodes]);

  const onCollapseAll = useCallback(() => {
    setExpandedIds(new Set<string>());
  }, []);

  /** Chọn một nút mở mọi nút cha của nó — cùng hành vi đặc tả đòi khi bấm một lỗi. */
  const onSelectNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setExpandedIds((previous) => {
      const next = new Set(previous);

      for (const ancestor of ancestorsOf(nodeId)) {
        next.add(ancestor);
      }

      return next;
    });
  }, []);

  const onSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      setMatchIndex(0);

      // Bộ đếm "1 / N" phải nói về hàng đang chọn (31-C-006).
      const first = findMatches(allNodes, query)[0];

      if (first !== undefined) {
        onSelectNode(first);
      }
    },
    [allNodes, onSelectNode],
  );

  const stepMatch = useCallback(
    (delta: number) => {
      setMatchIndex((previous) => {
        if (matchIds.length === 0) {
          return 0;
        }

        return (previous + delta + matchIds.length) % matchIds.length;
      });

      const nextId = matchIds[(matchIndex + delta + matchIds.length) % Math.max(matchIds.length, 1)];

      if (nextId !== undefined) {
        onSelectNode(nextId);
      }
    },
    [matchIds, matchIndex, onSelectNode],
  );

  const onNextMatch = useCallback(() => {
    stepMatch(1);
  }, [stepMatch]);

  const onPreviousMatch = useCallback(() => {
    stepMatch(-1);
  }, [stepMatch]);

  /** `issue.path` là mã thực thể, không phải đường dẫn nút: tìm nút của thực thể rồi chọn (31-A-024). */
  const onSelectIssue = useCallback(
    (path: string) => {
      const target = allNodes.find((node) => node.entityId === path) ?? allNodes.find((node) => node.id === path);

      if (target !== undefined) {
        setViewMode('tree');
        onSelectNode(target.id);
      }
    },
    [allNodes, onSelectNode],
  );

  /** Chép nhánh đang chọn; chưa chọn gì thì chép cả đồ thị. Không cấp `onCopy` thì ghi vào clipboard. */
  const onCopyBranch = useCallback(() => {
    const branch = selectedNodeId === null ? undefined : valueAtPath(graph, selectedNodeId);
    const text = branch === undefined ? rawText : toRawText(branch);

    if (onCopy !== undefined) {
      onCopy(text);
    } else {
      void navigator.clipboard?.writeText(text);
    }
  }, [graph, onCopy, rawText, selectedNodeId]);

  /** Không cấp `onDownload` thì tải chính chữ thô thành tệp `.json` (31-A-023). */
  const downloadRaw = useCallback(() => {
    const url = URL.createObjectURL(new Blob([rawText], { type: 'application/json' }));
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = 'spatial.json';
    anchor.rel = 'noopener';
    anchor.click();
    URL.revokeObjectURL(url);
  }, [rawText]);

  const model: SpatialJsonViewerModel = {
    activeTabId,
    canDownload: canView && graph !== null,
    counts,
    countsLabel: describeCounts(counts),
    errorMessage,
    forbiddenMessage: canView ? null : FORBIDDEN_MESSAGE,
    isNarrow,
    isRefreshing: graph !== null && isLoading,
    matchLabel,
    nodes: canView ? nodes : [],
    rawText: canView ? rawText : '',
    searchQuery,
    selectedNodeId,
    sizeLabel: formatFileSize(byteLengthOf(rawText)),
    state,
    validity,
    viewMode,
  };

  const actions: SpatialJsonViewerActions = {
    onChangeTab: setActiveTabId,
    onChangeViewMode: setViewMode,
    onCollapseAll,
    onCopyBranch,
    onDownload: onDownload ?? downloadRaw,
    onExpandAll,
    onNextMatch,
    onPreviousMatch,
    onReopenFloors,
    onSearchChange,
    onSelectIssue,
    onSelectNode,
    onToggleNode,
  };

  return [model, actions];
}
