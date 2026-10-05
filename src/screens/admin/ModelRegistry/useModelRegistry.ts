/**
 * Hook của màn registry model (`/admin/training/models`, F-11).
 *
 * View thuần chỉ nhận `model` + `actions` (mục D); toàn bộ phần còn lại ở đây. Trạng thái
 * máy chủ đọc thẳng từ `useQuery`/`useInfiniteQuery`/`useMutation` — `useState` chỉ giữ lựa
 * chọn của người dùng (họ, bản đang xem, hộp thoại) và hai dải phủ (409, 403 của lượt ghi).
 *
 * ## Bậc thang bảy trạng thái
 *
 * `loading` (phiên chưa rõ, chưa truy vấn) → `forbidden` (vai, hoặc 403) → `loading` (truy
 * vấn đang chạy) → `error` → `collapsed` → `empty` → `partial` → `success`. Phiên `unknown`
 * mang `roles: []`, nên xét vai trước khi phiên rõ sẽ nháy `forbidden` — vì thế nó đứng
 * đầu. Không phải quản trị viên thì mọi truy vấn `enabled: false`: không gọi mạng.
 *
 * ## Không cập nhật lạc quan
 *
 * Kích hoạt đổi bản model cho mọi lượt xử lý mới — màn chỉ đổi sau khi máy chủ trả.
 * `baseVersion` đọc từ bộ đệm N23 lúc bấm xác nhận, không lúc mở hộp thoại.
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';

import type { ModelFamily, ModelVersion } from '@/api/schemas/adminMl';
import { useSession } from '@/hooks/useSession';
import { formatTimestamp } from '@/lib/format/datetime';
import { formatNumber, MISSING_VALUE } from '@/lib/format/number';
import { applyInvalidation } from '@/lib/query/invalidation';
import { queryKeys } from '@/lib/query/queryKeys';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';

import {
  describeReadError,
  describeWriteError,
  isConflictError,
  isCursorInvalidError,
  isForbiddenError,
} from './modelRegistryErrors';
import { canManageModels, type ModelRegistryGateway } from './modelRegistryGateway';
import type {
  ActivateDialogModel,
  ActiveCardModel,
  EvaluationBadgeVariant,
  FamilyOption,
  ModelFamilyId,
  ModelRegistryActions,
  ModelRegistryViewModel,
  RelatedLinkModel,
  VersionDetailModel,
  VersionRowModel,
} from './types';

/** Dưới ngưỡng này bảng thành thẻ, cột phải thành `Drawer`. */
export const COLLAPSE_BREAKPOINT_PX = 1024;

/** Tám hàng khung xương lúc đang tải; kịch bản và story dùng chung số này. */
export const SKELETON_ROW_COUNT = 8;

/** Ba họ, đúng thứ tự `PIPELINE_STAGES` (`src/lib/realtime/pipeline.ts`). */
export const MODEL_FAMILY_ORDER: readonly ModelFamilyId[] = [
  'wallSegmentation',
  'openingAndFurnitureDetection',
  'dimensionReading',
];

const WALL_FAMILY: ModelFamilyId = 'wallSegmentation';

/** Nhãn của ô chọn họ (A6: viết hoa chữ đầu), cùng chữ với khối `pipeline` của `vi.json`. */
export const FAMILY_LABELS: Readonly<Record<ModelFamilyId, string>> = {
  wallSegmentation: 'Tách lớp tường',
  openingAndFurnitureDetection: 'Nhận diện cửa và đồ đạc',
  dimensionReading: 'Đọc kích thước',
};

/** Cùng tên, đứng giữa câu. */
const FAMILY_NAMES: Readonly<Record<ModelFamilyId, string>> = {
  wallSegmentation: 'tách lớp tường',
  openingAndFurnitureDetection: 'nhận diện cửa và đồ đạc',
  dimensionReading: 'đọc kích thước',
};

/** Mỗi họ đo bằng đúng một số. */
const METRIC_BY_FAMILY: Readonly<Record<ModelFamilyId, { readonly key: 'iou' | 'map50' | 'cer'; readonly name: string }>> = {
  wallSegmentation: { key: 'iou', name: 'IoU' },
  openingAndFurnitureDetection: { key: 'map50', name: 'mAP50' },
  dimensionReading: { key: 'cer', name: 'CER' },
};

const METRIC_FRACTION_DIGITS = 3;

const SEED_LABEL = 'gốc';
const SYSTEM_PIPELINE = 'system:pipeline';

export const MODEL_REGISTRY_TEXT = {
  classic: 'Đường cổ điển',
  noActive: 'Chưa kích hoạt bản nào',
  evaluation: {
    pending: 'Chờ đánh giá',
    running: 'Đang đánh giá',
    completed: 'Đã đánh giá',
    failed: 'Đánh giá không thành công',
  },
  sourceTrained: 'Huấn luyện tại chỗ',
  sourceSeed: 'Bản gốc',
  sourceUploaded: 'Tải lên',
  blockedNotEvaluated: 'Chỉ kích hoạt được bản đã đánh giá.',
  blockedFormat: 'Chỉ kích hoạt được bản định dạng onnx.',
  fieldId: 'Mã',
  fieldChecksum: 'Mã băm',
  fieldFormat: 'Định dạng',
  fieldMetric: 'Số đo',
  fieldTrainingJob: 'Lượt huấn luyện',
  fieldDatasetVersion: 'Phiên bản bộ dữ liệu',
  fieldCreator: 'Người tạo',
  fieldCreatedAt: 'Ngày tạo',
  creatorSystem: 'Hệ thống AI',
  creatorAdmin: 'Quản trị viên',
  failureNote: 'Lượt đánh giá không thành công. Lý do chi tiết chỉ có trong nhật ký máy chủ.',
  seedNote: 'Số đo trên tập kiểm tổng hợp cố định, không so thẳng với bản huấn luyện.',
  emptyBase: 'Họ này chưa có phiên bản nào. Tải trọng số bằng công cụ dòng lệnh, hoặc chờ một lượt huấn luyện xong.',
  emptyClassic: 'Đang dùng đường cổ điển.',
  dialogBody: 'Lượt xử lý mới dùng bản này ngay; lượt đang chạy giữ model đã ghim.',
  revertBody: 'Chuỗi xử lý sẽ tách tường bằng thuật toán cổ điển, không dùng model nào.',
  dialogWarning: 'Bản đang dùng chưa đánh giá xong nên sau khi đổi sẽ chưa kích hoạt lại được.',
  confirmActivate: 'Kích hoạt',
  confirmRevert: 'Quay về đường cổ điển',
  activatedDescription: 'Lượt xử lý mới dùng bản này ngay.',
  revertedDescription: 'Chuỗi xử lý tách tường bằng thuật toán cổ điển.',
  noUndoDescription: 'Bản trước chưa đánh giá xong nên lượt đổi này không hoàn tác được.',
  noUndoEmptyDescription: 'Họ này trước đó chưa có bản nào nên lượt đổi này không hoàn tác được.',
  undoDescription: 'Hoàn tác lượt đổi model',
  undoneTitle: 'Đã hoàn tác lượt đổi model',
  undoFailedTitle: 'Chưa hoàn tác được lượt đổi model',
} as const;

const EVALUATION_VARIANT: Readonly<Record<ModelVersion['evaluationStatus'], EvaluationBadgeVariant>> = {
  pending: 'neutral',
  running: 'attention',
  completed: 'neutral',
  failed: 'violation',
};

export const FAMILY_OPTIONS: readonly FamilyOption[] = MODEL_FAMILY_ORDER.map((value) => ({
  label: FAMILY_LABELS[value],
  value,
}));

/* -------------------------------------------------------------------------- */
/* Câu và nhãn — định dạng xảy ra ở đây, không ở view (A15).                   */
/* -------------------------------------------------------------------------- */

export function activateTitle(label: string, family: ModelFamilyId): string {
  return `Kích hoạt ${label} cho ${FAMILY_NAMES[family]}?`;
}

export function revertTitle(family: ModelFamilyId): string {
  return `Quay về đường cổ điển cho ${FAMILY_NAMES[family]}?`;
}

export function activatedTitle(label: string | null, family: ModelFamilyId): string {
  return label === null
    ? `Đã quay về đường cổ điển cho ${FAMILY_NAMES[family]}`
    : `Đã kích hoạt ${label} cho ${FAMILY_NAMES[family]}`;
}

export function conflictNotice(family: ModelFamilyId): string {
  return `${FAMILY_LABELS[family]} vừa được đổi ở nơi khác. Tải lại để thấy bản đang dùng.`;
}

export function partialNotice(count: number): string {
  return `${formatNumber(count)} phiên bản đang chờ hoặc đang đánh giá; chỉ kích hoạt được bản đã đánh giá.`;
}

function metricLabel(version: ModelVersion): string {
  const metric = METRIC_BY_FAMILY[version.family];
  const value = version.metrics?.[metric.key];

  return value === undefined
    ? MISSING_VALUE
    : `${metric.name} ${formatNumber(value, { fractionDigits: METRIC_FRACTION_DIGITS })}`;
}

const isSeed = (version: ModelVersion): boolean =>
  version.label === SEED_LABEL && version.creatorId === SYSTEM_PIPELINE;

function sourceLabel(version: ModelVersion): string {
  if (version.trainingJobId !== undefined) return MODEL_REGISTRY_TEXT.sourceTrained;
  if (isSeed(version)) return MODEL_REGISTRY_TEXT.sourceSeed;

  return MODEL_REGISTRY_TEXT.sourceUploaded;
}

function activateBlockedReason(version: ModelVersion): string | null {
  if (version.evaluationStatus !== 'completed') return MODEL_REGISTRY_TEXT.blockedNotEvaluated;
  if (version.weightsFormat !== 'onnx') return MODEL_REGISTRY_TEXT.blockedFormat;

  return null;
}

export function buildVersionRow(
  version: ModelVersion,
  context: { readonly activeId: string | null; readonly selectedId: string | null; readonly nowMs: number },
): VersionRowModel {
  return {
    id: version.id,
    label: version.label,
    formatLabel: version.weightsFormat,
    evaluationLabel: MODEL_REGISTRY_TEXT.evaluation[version.evaluationStatus],
    evaluationVariant: EVALUATION_VARIANT[version.evaluationStatus],
    metricLabel: metricLabel(version),
    sourceLabel: sourceLabel(version),
    createdLabel: formatTimestamp(Date.parse(version.createdAt), context.nowMs),
    isActive: version.id === context.activeId,
    isSelected: version.id === context.selectedId,
    activateBlockedReason: activateBlockedReason(version),
  };
}

export function buildActiveCard(
  family: ModelFamilyId,
  record: ModelFamily | undefined,
  activeVersion: ModelVersion | undefined,
  nowMs: number,
): ActiveCardModel | null {
  if (record === undefined) return null;

  if (record.activeVersionId === undefined) {
    return {
      canRevert: false,
      createdLabel: null,
      formatLabel: null,
      hasVersion: false,
      label: family === WALL_FAMILY ? MODEL_REGISTRY_TEXT.classic : MODEL_REGISTRY_TEXT.noActive,
      metricLabel: null,
    };
  }

  return {
    canRevert: family === WALL_FAMILY,
    createdLabel: activeVersion === undefined ? null : formatTimestamp(Date.parse(activeVersion.createdAt), nowMs),
    formatLabel: activeVersion?.weightsFormat ?? null,
    hasVersion: true,
    label: activeVersion?.label ?? MISSING_VALUE,
    metricLabel: activeVersion === undefined ? null : metricLabel(activeVersion),
  };
}

export function buildDetail(
  version: ModelVersion | undefined,
  status: { readonly isLoading: boolean; readonly error: unknown },
  nowMs: number,
): VersionDetailModel {
  const base = {
    errorMessage: status.error === null || status.error === undefined ? null : describeReadError(status.error),
    isLoading: status.isLoading,
  };

  if (version === undefined) {
    return { ...base, evaluationLabel: null, evaluationVariant: 'neutral', failureNote: null, fields: [], seedNote: null, title: MISSING_VALUE };
  }

  const field = (label: string, value: string, isCode = false) => ({ isCode, label, value });

  return {
    ...base,
    evaluationLabel: MODEL_REGISTRY_TEXT.evaluation[version.evaluationStatus],
    evaluationVariant: EVALUATION_VARIANT[version.evaluationStatus],
    failureNote: version.evaluationStatus === 'failed' ? MODEL_REGISTRY_TEXT.failureNote : null,
    fields: [
      field(MODEL_REGISTRY_TEXT.fieldId, version.id, true),
      field(MODEL_REGISTRY_TEXT.fieldChecksum, version.checksumSha256, true),
      field(MODEL_REGISTRY_TEXT.fieldFormat, version.weightsFormat),
      field(MODEL_REGISTRY_TEXT.fieldMetric, metricLabel(version)),
      ...(version.trainingJobId === undefined
        ? []
        : [field(MODEL_REGISTRY_TEXT.fieldTrainingJob, version.trainingJobId, true)]),
      ...(version.datasetVersionId === undefined
        ? []
        : [field(MODEL_REGISTRY_TEXT.fieldDatasetVersion, version.datasetVersionId, true)]),
      // Mọi đường tạo bản đều qua `require_admin`, nên người tạo không phải hệ thống là
      // một quản trị viên; mã người dùng không in ra.
      field(
        MODEL_REGISTRY_TEXT.fieldCreator,
        version.creatorId === SYSTEM_PIPELINE ? MODEL_REGISTRY_TEXT.creatorSystem : MODEL_REGISTRY_TEXT.creatorAdmin,
      ),
      field(MODEL_REGISTRY_TEXT.fieldCreatedAt, formatTimestamp(Date.parse(version.createdAt), nowMs)),
    ],
    seedNote: isSeed(version) ? MODEL_REGISTRY_TEXT.seedNote : null,
    title: version.label,
  };
}

/** Lượt kích hoạt đang hỏi: một bản, hoặc quay về đường cổ điển. */
export type DialogTarget = { readonly kind: 'activate'; readonly versionId: string } | { readonly kind: 'revert' };

export function buildDialog(input: {
  readonly target: DialogTarget;
  readonly family: ModelFamilyId;
  readonly targetLabel: string;
  readonly activeVersion: ModelVersion | undefined;
  readonly hasActive: boolean;
  /** N27 của bản đang dùng còn chạy — chưa biết nó đã đánh giá chưa. */
  readonly isActiveLoading: boolean;
  readonly errorMessage: string | null;
  readonly isSubmitting: boolean;
}): ActivateDialogModel {
  const isRevert = input.target.kind === 'revert';
  // N27 còn chạy: chưa cảnh báo vội, nút xác nhận chờ (`isWaiting`) tới khi biết. N27 đã
  // hỏng: không bao giờ biết được, nên đi lối thận trọng — cảnh báo như bản chưa đánh giá,
  // không hoàn tác, nhưng vẫn xác nhận được.
  const isActiveWaiting = input.hasActive && input.activeVersion === undefined && input.isActiveLoading;
  const activeNotCompleted =
    input.activeVersion !== undefined
      ? input.activeVersion.evaluationStatus !== 'completed'
      : input.hasActive && !input.isActiveLoading;

  return {
    body: isRevert ? MODEL_REGISTRY_TEXT.revertBody : MODEL_REGISTRY_TEXT.dialogBody,
    confirmLabel: isRevert ? MODEL_REGISTRY_TEXT.confirmRevert : MODEL_REGISTRY_TEXT.confirmActivate,
    errorMessage: input.errorMessage,
    isSubmitting: input.isSubmitting,
    isWaiting: isActiveWaiting,
    title: isRevert ? revertTitle(input.family) : activateTitle(input.targetLabel, input.family),
    warning: activeNotCompleted ? MODEL_REGISTRY_TEXT.dialogWarning : null,
  };
}

export function emptyMessage(family: ModelFamilyId, record: ModelFamily | undefined): string {
  return family === WALL_FAMILY && record?.activeVersionId === undefined
    ? `${MODEL_REGISTRY_TEXT.emptyBase} ${MODEL_REGISTRY_TEXT.emptyClassic}`
    : MODEL_REGISTRY_TEXT.emptyBase;
}

export const countPending = (versions: readonly ModelVersion[]): number =>
  versions.filter((version) => version.evaluationStatus === 'pending' || version.evaluationStatus === 'running').length;

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

export interface UseModelRegistryOptions {
  readonly gateway: ModelRegistryGateway;
  /** Khung hẹp hơn {@link COLLAPSE_BREAKPOINT_PX}. Nơi ráp đo, hook không đọc `window`. */
  readonly isNarrow?: boolean;
  readonly relatedLink?: RelatedLinkModel | null;
}

export interface ModelRegistryResult {
  readonly model: ModelRegistryViewModel;
  readonly actions: ModelRegistryActions;
}

interface ActivateVariables {
  readonly family: ModelFamilyId;
  readonly baseVersion: number;
  readonly versionId: string | null;
  /** Bản đang dùng trước lượt này — đích của "Hoàn tác". `null` = đường cổ điển. */
  readonly previousVersionId: string | null;
  /** Nhãn của bản được gửi lên; `null` = đường cổ điển. */
  readonly label: string | null;
  /** Nhãn của bản trước — câu của lượt hoàn tác nói đúng bản được kích hoạt lại. */
  readonly previousLabel: string | null;
  readonly undoable: boolean;
  readonly isUndo: boolean;
}

export function useModelRegistry({
  gateway,
  isNarrow = false,
  relatedLink = null,
}: UseModelRegistryOptions): ModelRegistryResult {
  const session = useSession();
  const queryClient = useQueryClient();

  const [family, setFamily] = useState<ModelFamilyId>(WALL_FAMILY);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [dialogTarget, setDialogTarget] = useState<DialogTarget | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [conflictFamily, setConflictFamily] = useState<ModelFamilyId | null>(null);
  const [writeForbidden, setWriteForbidden] = useState(false);
  /** Tăng sau mỗi lượt kích hoạt thành công: view đưa tiêu điểm về thẻ "Đang dùng". */
  const [activeCardFocusKey, setActiveCardFocusKey] = useState(0);
  /** `CURSOR_INVALID`: đọc lại từ trang đầu đúng một lần cho mỗi họ. */
  const [cursorRetried, setCursorRetried] = useState(false);

  const isSessionUnknown = session.status === 'unknown';
  const isAdmin = canManageModels(session.roles);
  const enabled = !isSessionUnknown && isAdmin && !writeForbidden;

  const familiesQuery = useQuery({
    enabled,
    queryFn: ({ signal }) => gateway.listFamilies(signal),
    queryKey: queryKeys.adminMl.families(),
  });

  const versionsQuery = useInfiniteQuery({
    enabled,
    getNextPageParam: (lastPage: { readonly nextCursor?: string }) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => gateway.listVersions({ cursor: pageParam, family, signal }),
    queryKey: queryKeys.adminMl.versions(family),
  });

  const familyRecord = familiesQuery.data?.find((candidate) => candidate.family === family);
  const activeId = familyRecord?.activeVersionId ?? null;

  const activeQuery = useQuery({
    enabled: enabled && activeId !== null,
    queryFn: ({ signal }) => gateway.readVersion(activeId ?? '', signal),
    queryKey: queryKeys.adminMl.version(activeId ?? ''),
  });

  const selectedQuery = useQuery({
    enabled: enabled && selectedVersionId !== null,
    queryFn: ({ signal }) => gateway.readVersion(selectedVersionId ?? '', signal),
    queryKey: queryKeys.adminMl.version(selectedVersionId ?? ''),
  });

  const versions = useMemo(
    (): readonly ModelVersion[] => versionsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [versionsQuery.data],
  );

  const activeVersion = activeQuery.data ?? versions.find((version) => version.id === activeId);

  /* ---- Bảy trạng thái --------------------------------------------------- */

  // "Xem thêm" hỏng không thay cả bảng đã nạp bằng lỗi: nó chỉ báo cạnh nút (`loadMoreError`).
  const versionsReadError = versionsQuery.data === undefined ? versionsQuery.error : null;
  // `CURSOR_INVALID` lần đầu không phải lỗi người đọc cần thấy: màn tự đọc lại trang đầu.
  const isSilentCursorRetry = isCursorInvalidError(versionsQuery.error) && !cursorRetried;
  const loadMoreError = versionsQuery.isFetchNextPageError && !isSilentCursorRetry ? versionsQuery.error : null;
  // Lượt làm mới trang đầu hỏng khi bảng đã có hàng: giữ hàng cũ nhưng nói ra, không nuốt.
  const refreshError = versionsQuery.isRefetchError && versionsQuery.data !== undefined ? versionsQuery.error : null;
  const isActiveLoading = activeId !== null && activeQuery.data === undefined && activeQuery.isFetching;
  const readError = familiesQuery.error ?? versionsReadError ?? null;
  const isForbiddenByServer = isForbiddenError(familiesQuery.error) || isForbiddenError(versionsQuery.error);
  const pendingCount = countPending(versions);

  const state = useMemo((): SevenState => {
    if (isSessionUnknown) return 'loading';
    if (!isAdmin || writeForbidden || isForbiddenByServer) return 'forbidden';
    if (familiesQuery.isPending || versionsQuery.isPending) return 'loading';
    if (readError !== null) return 'error';
    if (isNarrow) return 'collapsed';
    if (versions.length === 0) return 'empty';

    return pendingCount > 0 ? 'partial' : 'success';
  }, [
    isSessionUnknown,
    isAdmin,
    writeForbidden,
    isForbiddenByServer,
    familiesQuery.isPending,
    versionsQuery.isPending,
    readError,
    isNarrow,
    versions.length,
    pendingCount,
  ]);

  /* ---- Kích hoạt -------------------------------------------------------- */

  const mutateRef = useRef<(variables: ActivateVariables) => void>(() => undefined);

  const activateMutation = useMutation({
    mutationFn: (variables: ActivateVariables) =>
      gateway.activateVersion({
        baseVersion: variables.baseVersion,
        family: variables.family,
        versionId: variables.versionId,
      }),
    onError: (error, variables) => {
      if (isForbiddenError(error)) {
        setDialogTarget(null);
        setWriteForbidden(true);
        return;
      }

      if (isConflictError(error)) {
        setDialogTarget(null);
        setConflictFamily(variables.family);
        return;
      }

      if (variables.isUndo) {
        gateway.notify({
          description: describeWriteError(error),
          title: MODEL_REGISTRY_TEXT.undoFailedTitle,
          type: 'modelRegistry.undoFailed',
        });
        return;
      }

      setDialogError(describeWriteError(error));
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMl.versions(variables.family) });
    },
    onSuccess: (response, variables) => {
      applyInvalidation(queryClient, 'activateModelVersion', { family: variables.family });

      if (variables.isUndo) {
        gateway.notify({
          description: activatedTitle(variables.label, variables.family),
          title: MODEL_REGISTRY_TEXT.undoneTitle,
          type: 'modelRegistry.undone',
        });
        return;
      }

      setDialogTarget(null);
      setDialogError(null);
      setActiveCardFocusKey((key) => key + 1);

      const undoTicket = variables.undoable
        ? gateway.createUndoTicket({
            description: MODEL_REGISTRY_TEXT.undoDescription,
            undo: () => {
              mutateRef.current({
                baseVersion: response.revision,
                family: variables.family,
                isUndo: true,
                label: variables.previousLabel,
                previousLabel: variables.label,
                previousVersionId: variables.versionId,
                undoable: false,
                versionId: variables.previousVersionId,
              });
            },
          })
        : undefined;

      gateway.notify({
        description: !variables.undoable
          ? variables.previousVersionId === null
            ? MODEL_REGISTRY_TEXT.noUndoEmptyDescription
            : MODEL_REGISTRY_TEXT.noUndoDescription
          : variables.versionId === null
            ? MODEL_REGISTRY_TEXT.revertedDescription
            : MODEL_REGISTRY_TEXT.activatedDescription,
        title: activatedTitle(variables.label, variables.family),
        type: 'modelRegistry.activated',
        ...(undoTicket === undefined ? {} : { undoTicket }),
      });
    },
  });

  mutateRef.current = activateMutation.mutate;

  /* ---- Việc làm được ---------------------------------------------------- */

  const rows = useMemo(
    () =>
      versions.map((version) =>
        buildVersionRow(version, { activeId, nowMs: gateway.now(), selectedId: selectedVersionId }),
      ),
    [versions, activeId, selectedVersionId, gateway],
  );

  const onSelectFamily = useCallback((next: ModelFamilyId): void => {
    setFamily(next);
    setSelectedVersionId(null);
    setDialogTarget(null);
    setDialogError(null);
    setCursorRetried(false);
  }, []);

  const onRequestActivate = useCallback(
    (versionId: string): void => {
      const row = rows.find((candidate) => candidate.id === versionId);

      if (row === undefined || row.isActive || row.activateBlockedReason !== null) return;

      setDialogError(null);
      setDialogTarget({ kind: 'activate', versionId });
    },
    [rows],
  );

  const onRequestRevert = useCallback((): void => {
    if (family !== WALL_FAMILY || activeId === null) return;

    setDialogError(null);
    setDialogTarget({ kind: 'revert' });
  }, [family, activeId]);

  const onCloseDialog = useCallback((): void => {
    setDialogTarget(null);
    setDialogError(null);
  }, []);

  const onConfirmDialog = useCallback((): void => {
    if (dialogTarget === null || activateMutation.isPending) return;

    // `revision` đọc NGAY LÚC BẤM, từ bộ đệm N23 — không phải bản chụp lúc mở hộp thoại.
    const latest = queryClient
      .getQueryData<readonly ModelFamily[]>(queryKeys.adminMl.families())
      ?.find((candidate) => candidate.family === family);

    if (latest === undefined) return;
    if (latest.activeVersionId !== undefined && activeVersion === undefined && isActiveLoading) return;

    const versionId = dialogTarget.kind === 'revert' ? null : dialogTarget.versionId;
    const previousVersionId = latest.activeVersionId ?? null;

    activateMutation.mutate({
      baseVersion: latest.revision,
      family,
      isUndo: false,
      label: versionId === null ? null : (versions.find((version) => version.id === versionId)?.label ?? MISSING_VALUE),
      previousLabel: previousVersionId === null ? null : (activeVersion?.label ?? MISSING_VALUE),
      previousVersionId,
      // Hoàn tác về "không bản nào" là gửi `null` — chỉ họ tường được (đường cổ điển, khối
      // [9]); họ khác đang trống thì lượt đổi không hoàn tác được. Một bản thì chỉ khi nó đã
      // đánh giá xong, vì N24 từ chối bản chưa đánh giá.
      undoable:
        previousVersionId === null ? family === WALL_FAMILY : activeVersion?.evaluationStatus === 'completed',
      versionId,
    });
  }, [dialogTarget, activateMutation, queryClient, family, versions, activeVersion, isActiveLoading]);

  const onLoadMore = useCallback((): void => {
    void versionsQuery.fetchNextPage().then(async (result) => {
      if (!isCursorInvalidError(result.error) || cursorRetried) return;

      setCursorRetried(true);
      await queryClient.resetQueries({ exact: true, queryKey: queryKeys.adminMl.versions(family) });
    });
  }, [versionsQuery, queryClient, family, cursorRetried]);

  const onRetry = useCallback((): void => {
    setCursorRetried(false);
    void familiesQuery.refetch();
    void versionsQuery.refetch();
  }, [familiesQuery, versionsQuery]);

  const onReloadAfterConflict = useCallback((): void => {
    if (conflictFamily === null) return;

    applyInvalidation(queryClient, 'activateModelVersion', { family: conflictFamily });
    setConflictFamily(null);
  }, [conflictFamily, queryClient]);

  /* ---- View model ------------------------------------------------------- */

  const model = useMemo((): ModelRegistryViewModel => {
    const nowMs = gateway.now();
    const targetLabel =
      dialogTarget?.kind === 'activate'
        ? (versions.find((version) => version.id === dialogTarget.versionId)?.label ?? MISSING_VALUE)
        : MISSING_VALUE;

    return {
      activeCard: buildActiveCard(family, familyRecord, activeVersion, nowMs),
      activeCardFocusKey,
      conflictNotice: conflictFamily === null ? null : conflictNotice(conflictFamily),
      detail:
        selectedVersionId === null
          ? null
          : buildDetail(
              selectedQuery.data ?? versions.find((version) => version.id === selectedVersionId),
              { error: selectedQuery.error, isLoading: selectedQuery.isPending },
              nowMs,
            ),
      dialog:
        dialogTarget === null
          ? null
          : buildDialog({
              activeVersion,
              errorMessage: dialogError,
              family,
              hasActive: activeId !== null,
              isActiveLoading,
              isSubmitting: activateMutation.isPending,
              target: dialogTarget,
              targetLabel,
            }),
      emptyMessage: emptyMessage(family, familyRecord),
      errorMessage: readError === null ? null : describeReadError(readError),
      families: FAMILY_OPTIONS,
      hasMore: versionsQuery.hasNextPage,
      isCollapsed: isNarrow,
      isLoadingMore: versionsQuery.isFetchingNextPage,
      loadMoreError: loadMoreError === null ? null : describeReadError(loadMoreError),
      refreshError: refreshError === null ? null : describeReadError(refreshError),
      partialNotice: pendingCount > 0 ? partialNotice(pendingCount) : null,
      relatedLink,
      rows,
      selectedFamily: family,
      skeletonRowCount: SKELETON_ROW_COUNT,
      state,
    };
  }, [
    gateway,
    dialogTarget,
    versions,
    family,
    familyRecord,
    activeVersion,
    conflictFamily,
    selectedVersionId,
    selectedQuery.data,
    selectedQuery.error,
    selectedQuery.isPending,
    dialogError,
    activeId,
    activateMutation.isPending,
    readError,
    activeCardFocusKey,
    loadMoreError,
    refreshError,
    isActiveLoading,
    versionsQuery.hasNextPage,
    versionsQuery.isFetchingNextPage,
    isNarrow,
    pendingCount,
    relatedLink,
    rows,
    state,
  ]);

  const actions = useMemo(
    (): ModelRegistryActions => ({
      onCloseDialog,
      onConfirmDialog,
      onLoadMore,
      onReloadAfterConflict,
      onRequestActivate,
      onRequestRevert,
      onRetry,
      onSelectFamily,
      onSelectVersion: setSelectedVersionId,
    }),
    [
      onCloseDialog,
      onConfirmDialog,
      onLoadMore,
      onReloadAfterConflict,
      onRequestActivate,
      onRequestRevert,
      onRetry,
      onSelectFamily,
    ],
  );

  return { actions, model };
}
