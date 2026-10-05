/**
 * Hợp đồng giữa `useTrainingJobs` và view thuần của màn huấn luyện (mục D).
 *
 * Mọi chuỗi và số đã định dạng sẵn ở hook (A15): view chỉ đặt chúng vào chỗ.
 */

import type { SevenState } from '@/lib/testing/sevenStateScenarios';

/** Hai họ huấn luyện được (`TRAINABLE_MODEL_FAMILIES`). */
export type TrainableFamilyId = 'wallSegmentation' | 'openingAndFurnitureDetection';
/** Ba họ có bộ dữ liệu (`ML_MODEL_FAMILIES`). */
export type DatasetFamilyId = TrainableFamilyId | 'dimensionReading';

export type TrainingTabId = 'jobs' | 'datasets';

/** A4: ba sắc trạng thái, không `verified` (A5). */
export type StatusBadgeVariant = 'neutral' | 'attention' | 'violation';

/** Giá trị "tất cả" của hai ô lọc. */
export const FILTER_ALL = 'all';

export interface Option<TValue extends string = string> {
  readonly value: TValue;
  readonly label: string;
}

export interface JobRowModel {
  readonly id: string;
  readonly familyLabel: string;
  readonly baseModelLabel: string;
  /** Mã phiên bản bộ dữ liệu, rút gọn. */
  readonly datasetVersionLabel: string;
  /** "12/50". */
  readonly epochLabel: string;
  readonly statusLabel: string;
  readonly statusVariant: StatusBadgeVariant;
  readonly startedLabel: string;
  readonly endedLabel: string;
  readonly isSelected: boolean;
}

export interface MetricRowModel {
  readonly id: string;
  readonly step: string;
  readonly epoch: string;
  readonly split: string;
  readonly loss: string;
  readonly score: string;
  readonly at: string;
}

export interface LogRowModel {
  readonly id: string;
  readonly at: string;
  readonly levelLabel: string;
  readonly levelVariant: StatusBadgeVariant;
  readonly message: string;
}

export interface DetailFieldModel {
  readonly label: string;
  readonly value: string;
  readonly isCode: boolean;
}

export interface LinkModel {
  readonly label: string;
  readonly href: string;
}

export interface JobDetailModel {
  readonly title: string;
  readonly statusLabel: string;
  readonly statusVariant: StatusBadgeVariant;
  readonly fields: readonly DetailFieldModel[];
  readonly failureText: string | null;
  readonly resultLink: LinkModel | null;
  readonly canCancel: boolean;
  /** 409 của N35, hoặc lỗi đọc N34/N36/N37: câu báo trong cột chi tiết. */
  readonly notice: string | null;
  /** Tên cột số đo: "IoU" hoặc "mAP50". */
  readonly scoreName: string;
  readonly metricsSummary: string | null;
  readonly metricRows: readonly MetricRowModel[];
  readonly logRows: readonly LogRowModel[];
  readonly isLoading: boolean;
  /**
   * Tăng sau mỗi lượt huỷ thành công. Nút "Huỷ lượt" biến mất, nên view đưa tiêu điểm về
   * tiêu đề chi tiết thay vì để nó rơi về `body` (A12).
   */
  readonly focusKey: number;
}

export interface FormModel {
  readonly families: readonly Option<TrainableFamilyId>[];
  readonly family: TrainableFamilyId;
  readonly datasets: readonly Option[];
  readonly datasetId: string | null;
  readonly versions: readonly Option[];
  readonly versionId: string | null;
  readonly isLoadingOptions: boolean;
  /** "Bộ dữ liệu này chưa có phiên bản sẵn sàng." hoặc lỗi 422/404 của ô phiên bản. */
  readonly versionError: string | null;
  readonly baseModels: readonly Option[];
  readonly baseModel: string | null;
  readonly baseModelError: string | null;
  readonly epochs: number | undefined;
  readonly epochsMin: number;
  readonly epochsMax: number;
  readonly epochsError: string | null;
  readonly formError: string | null;
  readonly canSubmit: boolean;
  readonly isSubmitting: boolean;
}

export interface CancelDialogModel {
  readonly isSubmitting: boolean;
  readonly errorMessage: string | null;
}

export interface DatasetVersionRowModel {
  readonly id: string;
  readonly sequenceLabel: string;
  readonly statusLabel: string;
  readonly statusVariant: StatusBadgeVariant;
  readonly sourceLabel: string;
  /** "huấn luyện / kiểm định / kiểm tra". */
  readonly splitLabel: string;
  readonly createdLabel: string;
  readonly failureText: string | null;
}

export interface DatasetsTabModel {
  readonly families: readonly Option<DatasetFamilyId>[];
  readonly family: DatasetFamilyId;
  readonly datasets: readonly (Option & { readonly isSelected: boolean })[];
  readonly versionRows: readonly DatasetVersionRowModel[];
  readonly isLoadingVersions: boolean;
  readonly versionsError: string | null;
}

export interface TrainingJobsViewModel {
  readonly state: SevenState;
  readonly activeTab: TrainingTabId;
  readonly familyFilters: readonly Option[];
  readonly familyFilter: string;
  readonly statusFilters: readonly Option[];
  readonly statusFilter: string;
  readonly rows: readonly JobRowModel[];
  readonly hasMore: boolean;
  readonly isLoadingMore: boolean;
  readonly loadMoreError: string | null;
  readonly partialNotice: string | null;
  readonly emptyMessage: string;
  readonly errorMessage: string | null;
  readonly detail: JobDetailModel | null;
  readonly form: FormModel | null;
  readonly cancelDialog: CancelDialogModel | null;
  readonly datasets: DatasetsTabModel;
  readonly relatedLink: LinkModel;
  readonly isCollapsed: boolean;
  readonly skeletonRowCount: number;
}

export interface TrainingJobsActions {
  readonly onSelectTab: (tab: TrainingTabId) => void;
  readonly onFilterFamily: (value: string) => void;
  readonly onFilterStatus: (value: string) => void;
  readonly onSelectJob: (jobId: string | null) => void;
  readonly onLoadMore: () => void;
  readonly onRetry: () => void;
  readonly onOpenForm: () => void;
  readonly onCloseForm: () => void;
  readonly onFormFamily: (family: TrainableFamilyId) => void;
  readonly onFormDataset: (datasetId: string) => void;
  readonly onFormVersion: (versionId: string) => void;
  readonly onFormBaseModel: (baseModel: string) => void;
  readonly onFormEpochs: (epochs: number | undefined) => void;
  readonly onSubmitForm: () => void;
  readonly onRequestCancel: () => void;
  readonly onConfirmCancel: () => void;
  readonly onCloseCancel: () => void;
  readonly onSelectDatasetFamily: (family: DatasetFamilyId) => void;
  readonly onSelectDataset: (datasetId: string) => void;
}

export interface TrainingJobsProps {
  readonly model: TrainingJobsViewModel;
  readonly actions: TrainingJobsActions;
}
