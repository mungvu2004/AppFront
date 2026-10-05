/**
 * Bảy kịch bản của {@link ModelRegistryViewModel} (A11), dữ liệu thuần — không React, không
 * mạng, không `vitest` (Storybook không đóng gói được nó). `ModelRegistry.test.tsx` và
 * `ModelRegistry.stories.tsx` nhập chung file này.
 *
 * Dựng bằng CHÍNH các hàm dựng của `useModelRegistry.ts` trên CHÍNH bộ mẫu của
 * `src/api/__mocks__/adminMlClient.ts`, nên không chuỗi hay số nào được gõ lại ở đây.
 * Kịch bản `success` dùng họ cửa và đồ đạc trước lượt huấn luyện thứ tư (bỏ bản đang đánh
 * giá): bộ mẫu cố ý không có họ nào "sạch", vì BE tới W12 còn bản `pending`.
 */

import { MOCK_MODEL_FAMILIES, MOCK_MODEL_VERSIONS, MOCK_MODEL_VERSION_IDS } from '@/api/__mocks__/adminMlClient';
import type { ModelVersion } from '@/api/schemas/adminMl';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';

import { MODEL_REGISTRY_ERROR_TEXT } from './modelRegistryErrors';
import type { ModelFamilyId, ModelRegistryActions, ModelRegistryViewModel } from './types';
import {
  FAMILY_OPTIONS,
  buildActiveCard,
  buildDetail,
  buildVersionRow,
  countPending,
  emptyMessage,
  partialNotice,
} from './useModelRegistry';

/** Mốc cố định cho mọi nhãn thời gian, để ảnh chụp không đổi theo giờ máy chạy. */
export const MODEL_REGISTRY_SCENARIO_NOW = Date.parse('2026-10-05T03:00:00.000Z');

const versionsOf = (family: ModelFamilyId): readonly ModelVersion[] =>
  MOCK_MODEL_VERSIONS.filter((version) => version.family === family);

function scenario(
  state: SevenState,
  family: ModelFamilyId,
  options: {
    readonly versions?: readonly ModelVersion[];
    readonly selectedId?: string | null;
    readonly isCollapsed?: boolean;
    readonly errorMessage?: string | null;
  } = {},
): ModelRegistryViewModel {
  const versions = options.versions ?? versionsOf(family);
  const record = MOCK_MODEL_FAMILIES.find((candidate) => candidate.family === family);
  const activeId = record?.activeVersionId ?? null;
  const selectedId = options.selectedId ?? null;
  const selected = MOCK_MODEL_VERSIONS.find((version) => version.id === selectedId);
  const pending = countPending(versions);
  const hasData = state !== 'loading' && state !== 'error' && state !== 'forbidden';

  return {
    activeCard: hasData
      ? buildActiveCard(family, record, MOCK_MODEL_VERSIONS.find((version) => version.id === activeId), MODEL_REGISTRY_SCENARIO_NOW)
      : null,
    conflictNotice: null,
    detail:
      selectedId === null ? null : buildDetail(selected, { error: null, isLoading: false }, MODEL_REGISTRY_SCENARIO_NOW),
    dialog: null,
    emptyMessage: emptyMessage(family, record),
    errorMessage: options.errorMessage ?? null,
    families: FAMILY_OPTIONS,
    hasMore: false,
    isCollapsed: options.isCollapsed ?? false,
    isLoadingMore: false,
    partialNotice: hasData && pending > 0 ? partialNotice(pending) : null,
    relatedLink: null,
    rows: hasData
      ? versions.map((version) =>
          buildVersionRow(version, { activeId, nowMs: MODEL_REGISTRY_SCENARIO_NOW, selectedId }),
        )
      : [],
    selectedFamily: family,
    skeletonRowCount: 8,
    state,
  };
}

export const MODEL_REGISTRY_SCENARIO_EMPTY = scenario('empty', 'wallSegmentation');

export const MODEL_REGISTRY_SCENARIO_LOADING = scenario('loading', 'wallSegmentation');

export const MODEL_REGISTRY_SCENARIO_PARTIAL = scenario('partial', 'dimensionReading', {
  selectedId: MOCK_MODEL_VERSION_IDS.dimensionFailed,
});

export const MODEL_REGISTRY_SCENARIO_ERROR = scenario('error', 'wallSegmentation', {
  errorMessage: MODEL_REGISTRY_ERROR_TEXT.busy,
});

export const MODEL_REGISTRY_SCENARIO_SUCCESS = scenario('success', 'openingAndFurnitureDetection', {
  selectedId: MOCK_MODEL_VERSION_IDS.doorSeed,
  versions: versionsOf('openingAndFurnitureDetection').filter(
    (version) => version.id !== MOCK_MODEL_VERSION_IDS.doorRunning,
  ),
});

export const MODEL_REGISTRY_SCENARIO_FORBIDDEN = scenario('forbidden', 'wallSegmentation');

export const MODEL_REGISTRY_SCENARIO_COLLAPSED = scenario('collapsed', 'openingAndFurnitureDetection', {
  isCollapsed: true,
  selectedId: MOCK_MODEL_VERSION_IDS.doorTrained,
});

export const MODEL_REGISTRY_SCENARIOS: Readonly<Record<SevenState, ModelRegistryViewModel>> = {
  collapsed: MODEL_REGISTRY_SCENARIO_COLLAPSED,
  empty: MODEL_REGISTRY_SCENARIO_EMPTY,
  error: MODEL_REGISTRY_SCENARIO_ERROR,
  forbidden: MODEL_REGISTRY_SCENARIO_FORBIDDEN,
  loading: MODEL_REGISTRY_SCENARIO_LOADING,
  partial: MODEL_REGISTRY_SCENARIO_PARTIAL,
  success: MODEL_REGISTRY_SCENARIO_SUCCESS,
};

const noop = (): void => undefined;

/** Hành động không làm gì — cho story; bài kiểm cần đếm lời gọi thì tự dựng bằng `vi.fn()`. */
export const MODEL_REGISTRY_ACTIONS: ModelRegistryActions = {
  onCloseDialog: noop,
  onConfirmDialog: noop,
  onLoadMore: noop,
  onReloadAfterConflict: noop,
  onRequestActivate: noop,
  onRequestRevert: noop,
  onRetry: noop,
  onSelectFamily: noop,
  onSelectVersion: noop,
};
