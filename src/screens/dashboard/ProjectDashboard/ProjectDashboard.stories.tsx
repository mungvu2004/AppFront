import type { Meta, StoryObj } from '@storybook/react';

import { ProjectDashboardView, type ProjectDashboardViewProps } from './ProjectDashboard';
import type { ProjectCardModel } from './useProjectDashboard';

/**
 * The dashboard in each of invariant A11's seven states.
 *
 * Every story renders {@link ProjectDashboardView} rather than
 * {@link import('./ProjectDashboard').ProjectDashboard} — no query client, no
 * router, no telemetry sender — because the view is a function of its props,
 * invariant D's whole point.
 */
const meta = {
  title: 'Screens/Dashboard/ProjectDashboard',
  component: ProjectDashboardView,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof ProjectDashboardView>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = (): void => undefined;

const hqRenovation: ProjectCardModel = {
  id: 'p-hq-renovation',
  name: 'Tòa nhà HQ Renovation',
  statsLabel: '4 tầng · 1.860,00 m²',
  updatedLabel: '2 giờ trước',
  statusVariant: 'attention',
  statusLabel: 'cần QC',
  progressLabel: '30/48 tường đã duyệt',
  progressRatio: 30 / 48,
  progressPercentLabel: '63%',
  members: [
    { id: 'm-an', initials: 'PA' },
    { id: 'm-binh', initials: 'NB' },
  ],
  planVariant: 0,
};

const sunriseBlockB: ProjectCardModel = {
  id: 'p-sunrise-block-b',
  name: 'Chung cư Sunrise Block B',
  statsLabel: '12 tầng · 8.420,00 m²',
  updatedLabel: '25 phút trước',
  statusVariant: 'neutral',
  statusLabel: 'đang xử lý',
  progressLabel: '0/132 tường đã duyệt',
  progressRatio: 0,
  progressPercentLabel: '0%',
  members: [
    { id: 'm-an', initials: 'PA' },
    { id: 'm-binh', initials: 'NB' },
    { id: 'm-chi', initials: 'TC' },
  ],
  planVariant: 1,
};

const bacNinhFactory: ProjectCardModel = {
  id: 'p-bac-ninh-factory',
  name: 'Nhà máy Bắc Ninh',
  statsLabel: '2 tầng · 5.200,00 m²',
  updatedLabel: '26/08/2026 07:00',
  statusVariant: 'verified',
  statusLabel: 'hoàn thành',
  progressLabel: '26/26 tường đã duyệt',
  progressRatio: 1,
  progressPercentLabel: '100%',
  members: [{ id: 'm-binh', initials: 'NB' }],
  planVariant: 2,
};

const base: ProjectDashboardViewProps = {
  state: 'success',
  canCreate: true,
  canDelete: true,
  errorMessage: null,
  viewMode: 'grid',
  searchQuery: '',
  statusFilter: 'all',
  sortBy: 'updated',
  statusCounts: { all: 3, processing: 1, qc: 1, done: 1 },
  pulseKey: 0,
  shouldStagger: true,
  rows: [hqRenovation, sunriseBlockB, bacNinhFactory],
  renamingId: null,
  renameDraft: '',
  pendingDeleteId: null,
  pendingDeleteName: null,
  setSearchQuery: noop,
  setStatusFilter: noop,
  setSortBy: noop,
  setViewMode: noop,
  clearFilters: noop,
  openProject: noop,
  startRename: noop,
  setRenameDraft: noop,
  commitRename: noop,
  cancelRename: noop,
  duplicateProject: noop,
  requestDelete: noop,
  cancelDelete: noop,
  confirmDelete: noop,
  createProject: noop,
  retryLoad: noop,
  onCardPointerEnter: noop,
  onCardPointerLeave: noop,
};

/** thành công — ba dự án mẫu, một mỗi trạng thái pipeline. */
export const Success: Story = { args: { ...base } };

/** thành công, kiểu bảng. */
export const TableView: Story = { args: { ...base, viewMode: 'table' } };

/** rỗng — chưa từng tạo dự án nào. */
export const Empty: Story = { args: { ...base, state: 'empty', rows: [] } };

/** đang tải — sáu khung xương, danh sách chưa về. */
export const Loading: Story = { args: { ...base, state: 'loading', rows: [] } };

/** một phần — bộ lọc/tìm kiếm không khớp dự án nào. */
export const Partial: Story = {
  args: { ...base, state: 'partial', rows: [], searchQuery: 'không tồn tại' },
};

/** lỗi — không tải được danh sách, kèm nút thử lại. */
export const ErrorState: Story = {
  args: { ...base, state: 'error', errorMessage: 'không kết nối được máy chủ' },
};

/** không có quyền — vai người xem: mất nút "Dự án mới" và mục "Xoá", giữ lưới. */
export const Forbidden: Story = {
  args: { ...base, state: 'forbidden', canCreate: false, canDelete: false },
};

/** thu gọn — dưới 1024px: hai cột, dải lọc gấp lại. */
export const Collapsed: Story = { args: { ...base, state: 'collapsed' } };

/** Đang đổi tên một dự án ngay trên thẻ. */
export const Renaming: Story = {
  args: { ...base, renamingId: hqRenovation.id, renameDraft: 'Tòa nhà HQ Renovation (Q3)' },
};

/** Hộp thoại xác nhận xoá — nơi duy nhất A9 cho phép chặn bằng hộp thoại trên màn này. */
export const DeleteConfirm: Story = {
  args: { ...base, pendingDeleteId: hqRenovation.id, pendingDeleteName: hqRenovation.name },
};
