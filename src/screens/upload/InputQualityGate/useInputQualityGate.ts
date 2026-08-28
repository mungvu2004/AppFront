/**
 * Khung tối thiểu của hook Cổng chất lượng đầu vào.
 *
 * Đây CHƯA phải logic thật — không đọc phép đo chất lượng, không cắm
 * `src/lib/query`/`src/lib/mutations` (R-64), không tự chế công thức đo ảnh
 * (R-61, R-69). Lớp Layer 2 phụ trách hook sẽ THAY TOÀN BỘ nội dung file này;
 * cái còn nguyên là chữ ký của `useInputQualityGate` và kiểu trả về, khớp
 * `InputQualityGateViewProps` của `types.ts`.
 *
 * Mô hình rỗng dựng sẵn ở `status: 'loading'` để `InputQualityGate.tsx` có
 * ngay một props hợp lệ mà không cần `useState` cho loading/error (R-64) —
 * chưa có logic thật thì "đang tải" là trạng thái trung thực duy nhất.
 */

import type { ProjectRole } from '@/types/project';

import type {
  InputQualityGateActions,
  InputQualityGateModel,
  InputQualityGateViewProps,
} from './types';

export interface UseInputQualityGateOptions {
  readonly projectId: string;
  readonly roles?: readonly ProjectRole[];
  /** Điều hướng sau khi bấm tiếp tục hoặc tải bản vẽ khác. */
  readonly onNavigate?: (path: string) => void;
  /** Ép cách xếp thu gọn — cho story hoặc test muốn một câu trả lời cố định. */
  readonly forceCollapsed?: boolean;
}

const EMPTY_MODEL: InputQualityGateModel = {
  status: 'loading',
  image: {
    src: '',
    altText: '',
    skewLine: null,
    regions: [],
    highlightedRegionId: null,
    rotationDeg: 0,
    corners: null,
    comparison: null,
  },
  metrics: [],
  forecast: { text: '' },
  findings: [],
  floors: [],
  footer: {
    canContinue: false,
    requiresAcknowledgement: false,
    isAcknowledged: false,
    acknowledgementLabel: '',
    primaryLabel: '',
    secondaryLabel: '',
    areActionsHidden: false,
  },
  errorMessage: null,
  partialNotice: null,
  remainingFindingCount: 0,
  passNotice: null,
};

const NOOP_ACTIONS: InputQualityGateActions = {
  onHoverRegion: () => {},
  onHoverFinding: () => {},
  onSelectFloor: () => {},
  onStraighten: () => {},
  onPickCorners: () => {},
  onDragCorner: () => {},
  onChangeReveal: () => {},
  onToggleAcknowledgement: () => {},
  onContinue: () => {},
  onUploadAnother: () => {},
};

/** `{ model, actions }` cho `InputQualityGate.tsx` — xem ghi chú đầu file. */
export function useInputQualityGate(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- khung tối thiểu chưa đọc options; Layer 2 dùng khi cắm logic thật.
  options: UseInputQualityGateOptions,
): InputQualityGateViewProps {
  return { model: EMPTY_MODEL, actions: NOOP_ACTIONS };
}
