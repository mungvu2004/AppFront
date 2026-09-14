/**
 * S-36 — dữ liệu mẫu dùng chung cho story và test.
 *
 * Dựng trên **bộ mẫu chuẩn** `createSampleBuilding()`
 * (`domain/spatial/__fixtures__/sampleBuilding.ts`), không phải một bộ số tự
 * chế: người kiểm đi từ màn QC sang màn 3D rồi tới đây phải thấy cùng một công
 * trình (mục 3.0 của bộ prompt, và A14).
 *
 * Story không gọi hook — chúng dựng `model` thẳng từ các hàm thuần của
 * `./spatialJsonModel`, nên một story hỏng là hỏng ở view, không phải ở trạng
 * thái nội bộ của hook.
 */

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { formatFileSize } from '@/lib/format/bytes';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';

import {
  byteLengthOf,
  countEntities,
  describeCounts,
  flattenJson,
  summariseValidity,
  toRawText,
  visibleNodes,
} from './spatialJsonModel';
import type {
  SpatialJsonIssue,
  SpatialJsonViewerActions,
  SpatialJsonViewerModel,
  SpatialJsonViewerProps,
} from './types';

/** Đồ thị mẫu, dựng một lần cho cả tệp. */
export const SAMPLE_GRAPH = createSampleBuilding();

/** Khoá gốc mở sẵn, khớp mặc định của hook. */
const DEFAULT_EXPANDED = new Set(['building']);

const NO_MATCHES = new Set<string>();

/** Hai lỗi toàn vẹn mẫu, dùng cho story "lỗi" và cho dải kiểm tra không hợp lệ. */
export const SAMPLE_ISSUES: readonly SpatialJsonIssue[] = [
  {
    id: 'missingReference:D-DOOR00030',
    path: 'openings[2].wallId',
    problem: 'Cửa #D-DOOR00030 gắn vào bức tường không có trong dữ liệu của tầng này.',
    severity: 'critical',
  },
  {
    id: 'roomOutline:R-ROOM00070',
    path: 'rooms[6].outline',
    problem: 'Phòng #R-ROOM00070 có đường bao dưới ba điểm nên không khép thành hình.',
    severity: 'warning',
  },
];

/** Không hành động nào trong story làm gì cả — màn này chỉ đọc. */
export const NOOP_ACTIONS: SpatialJsonViewerActions = {
  onChangeTab: () => undefined,
  onChangeViewMode: () => undefined,
  onCollapseAll: () => undefined,
  onCopyBranch: () => undefined,
  onDownload: () => undefined,
  onExpandAll: () => undefined,
  onNextMatch: () => undefined,
  onPreviousMatch: () => undefined,
  onReopenFloors: () => undefined,
  onSearchChange: () => undefined,
  onSelectNode: () => undefined,
  onToggleNode: () => undefined,
};

const EMPTY_GRAPH = {
  axes: [],
  building: SAMPLE_GRAPH.building,
  dimensions: [],
  furniture: [],
  levels: [],
  notes: [],
  openings: [],
  rooms: [],
  walls: [],
};

/** Dựng `model` cho đúng một trong bảy trạng thái. */
export function buildSpatialJsonViewerModel(state: SevenState): SpatialJsonViewerModel {
  const isEmpty = state === 'empty' || state === 'loading' || state === 'forbidden';
  const graph = isEmpty ? EMPTY_GRAPH : SAMPLE_GRAPH;
  const rawText = state === 'forbidden' ? '' : toRawText(graph);
  const allNodes = flattenJson(graph);
  const counts = countEntities(graph);
  const issues = state === 'error' || state === 'partial' ? SAMPLE_ISSUES : [];

  return {
    activeTabId: 'json',
    canDownload: true,
    counts,
    countsLabel: describeCounts(counts),
    errorMessage:
      state === 'error'
        ? 'Máy chủ trả về dữ liệu không gian hỏng, nên không dựng được cây cấu trúc. Mã yêu cầu 8f2a-41.'
        : null,
    forbiddenMessage:
      state === 'forbidden'
        ? 'Bạn không có quyền xem dữ liệu không gian của dự án này. Hãy hỏi quản trị viên dự án để được cấp quyền xem.'
        : null,
    isNarrow: state === 'collapsed',
    isRefreshing: state === 'partial',
    matchLabel: null,
    nodes: state === 'forbidden' ? [] : visibleNodes(allNodes, DEFAULT_EXPANDED, NO_MATCHES),
    rawText,
    searchQuery: '',
    selectedNodeId: null,
    sizeLabel: formatFileSize(byteLengthOf(rawText)),
    state,
    validity: summariseValidity(issues),
    viewMode: 'tree',
  };
}

/** Props đủ bộ cho một story hoặc một lượt render trong test. */
export function buildSpatialJsonViewerProps(state: SevenState): SpatialJsonViewerProps {
  return { actions: NOOP_ACTIONS, model: buildSpatialJsonViewerModel(state) };
}
