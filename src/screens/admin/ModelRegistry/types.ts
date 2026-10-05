/**
 * Hợp đồng giữa `useModelRegistry` và view thuần của màn registry model (mục D).
 *
 * Mọi chuỗi và số trong đây đã định dạng sẵn ở hook (A15): view chỉ đặt chúng vào chỗ.
 */

import type { SevenState } from '@/lib/testing/sevenStateScenarios';

/** Ba họ model của chuỗi xử lý, đúng thứ tự `PIPELINE_STAGES`. */
export type ModelFamilyId = 'wallSegmentation' | 'openingAndFurnitureDetection' | 'dimensionReading';

/** A4: ba sắc trạng thái, không `verified` (A5 — đầu ra AI không bao giờ "đã xác minh"). */
export type EvaluationBadgeVariant = 'neutral' | 'attention' | 'violation';

export interface FamilyOption {
  readonly value: ModelFamilyId;
  readonly label: string;
}

/** Thẻ "Đang dùng" của họ đang chọn. */
export interface ActiveCardModel {
  /** Nhãn bản đang dùng, hoặc "Đường cổ điển" / "Chưa kích hoạt bản nào". */
  readonly label: string;
  /** `false` khi họ không có bản kích hoạt nào. */
  readonly hasVersion: boolean;
  readonly formatLabel: string | null;
  readonly metricLabel: string | null;
  readonly createdLabel: string | null;
  /** Chỉ họ tường đang có bản kích hoạt mới quay về đường cổ điển được. */
  readonly canRevert: boolean;
}

export interface VersionRowModel {
  readonly id: string;
  readonly label: string;
  readonly formatLabel: string;
  readonly evaluationLabel: string;
  readonly evaluationVariant: EvaluationBadgeVariant;
  readonly metricLabel: string;
  readonly sourceLabel: string;
  readonly createdLabel: string;
  /** Bản đang dùng: không có nút "Kích hoạt" — gửi lại là một lệnh không đổi gì. */
  readonly isActive: boolean;
  readonly isSelected: boolean;
  /** Lý do nút "Kích hoạt" tắt; `null` khi kích hoạt được. */
  readonly activateBlockedReason: string | null;
}

export interface DetailFieldModel {
  readonly label: string;
  readonly value: string;
  /** Mã, mã băm: chữ đều, ngắt dòng ở mọi chỗ. */
  readonly isCode: boolean;
}

export interface VersionDetailModel {
  readonly title: string;
  readonly evaluationLabel: string | null;
  readonly evaluationVariant: EvaluationBadgeVariant;
  readonly fields: readonly DetailFieldModel[];
  /** Câu cố định khi đánh giá không thành công — lý do không lên dây. */
  readonly failureNote: string | null;
  /** Bản gốc: số đo trên tập kiểm tổng hợp, không so thẳng với bản huấn luyện. */
  readonly seedNote: string | null;
  readonly isLoading: boolean;
  readonly errorMessage: string | null;
}

/** Hộp thoại A9 — kích hoạt một bản, hoặc quay về đường cổ điển. */
export interface ActivateDialogModel {
  readonly title: string;
  readonly body: string;
  /** Bản đang dùng chưa đánh giá xong: đổi rồi thì không kích hoạt lại được. */
  readonly warning: string | null;
  /** Câu lỗi 422/404 của lượt gửi vừa rồi. */
  readonly errorMessage: string | null;
  readonly confirmLabel: string;
  readonly isSubmitting: boolean;
}

export interface RelatedLinkModel {
  readonly label: string;
  readonly href: string;
}

export interface ModelRegistryViewModel {
  readonly state: SevenState;
  readonly families: readonly FamilyOption[];
  readonly selectedFamily: ModelFamilyId;
  readonly activeCard: ActiveCardModel | null;
  /**
   * Tăng sau mỗi lượt kích hoạt thành công. Nút đã mở hộp thoại biến mất khi bảng làm mới
   * (hàng ấy thành "Đang dùng"), nên view đưa tiêu điểm về thẻ "Đang dùng" thay vì để nó
   * rơi về `body` (A12).
   */
  readonly activeCardFocusKey: number;
  readonly rows: readonly VersionRowModel[];
  readonly detail: VersionDetailModel | null;
  readonly hasMore: boolean;
  readonly isLoadingMore: boolean;
  /** "Xem thêm" hỏng: câu báo cạnh nút, bảng đã nạp giữ nguyên. */
  readonly loadMoreError: string | null;
  readonly partialNotice: string | null;
  readonly emptyMessage: string;
  readonly errorMessage: string | null;
  /** Dải 409 "vừa được đổi ở nơi khác": phủ lên trạng thái đang có, không là trạng thái thứ tám. */
  readonly conflictNotice: string | null;
  readonly dialog: ActivateDialogModel | null;
  /** F-12 điền; F-11 để `null`. */
  readonly relatedLink: RelatedLinkModel | null;
  readonly isCollapsed: boolean;
  readonly skeletonRowCount: number;
}

export interface ModelRegistryActions {
  readonly onSelectFamily: (family: ModelFamilyId) => void;
  readonly onSelectVersion: (versionId: string | null) => void;
  readonly onRequestActivate: (versionId: string) => void;
  readonly onRequestRevert: () => void;
  readonly onConfirmDialog: () => void;
  readonly onCloseDialog: () => void;
  readonly onLoadMore: () => void;
  readonly onRetry: () => void;
  readonly onReloadAfterConflict: () => void;
}

export interface ModelRegistryProps {
  readonly model: ModelRegistryViewModel;
  readonly actions: ModelRegistryActions;
}
