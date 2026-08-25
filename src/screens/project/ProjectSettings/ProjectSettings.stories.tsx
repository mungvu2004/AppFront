import type { Meta, StoryObj } from '@storybook/react';

import { ProjectSettingsView } from './ProjectSettings';
import type { ProjectSettingsViewProps } from './useProjectSettings';

/**
 * Màn cài đặt dự án trong đủ bảy trạng thái của bất biến A11 (R-63).
 *
 * Mọi story dựng thẳng {@link ProjectSettingsView} chứ không dựng
 * `ProjectSettings` — không query client, không router, không cổng dữ liệu —
 * vì view là một hàm của props, đúng điều mục D tồn tại để giữ.
 */
const meta = {
  title: 'Screens/Project/ProjectSettings',
  component: ProjectSettingsView,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof ProjectSettingsView>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = (): void => undefined;

const MEMBERS = [
  { id: 'm-an', name: 'Phạm An', roleLabel: 'quản trị', initials: 'PA' },
  { id: 'm-binh', name: 'Nguyễn Bình', roleLabel: 'kỹ sư', initials: 'NB' },
  { id: 'm-chi', name: 'Trần Chi', roleLabel: 'người xem', initials: 'TC' },
];

const NO_PROBLEMS = {
  name: null,
  code: null,
  address: null,
  notes: null,
  snapToleranceMm: null,
  confidenceThreshold: null,
  scaleMmPerPx: null,
};

const base: ProjectSettingsViewProps = {
  state: 'success',
  canEdit: true,
  canDelete: true,
  isReadOnly: false,
  errorMessage: null,
  saveState: 'saved',
  saveLabel: 'Đã lưu lúc 14:32',
  conflictMessage: null,
  activeTab: 'general',
  tabs: [
    { id: 'general', label: 'chung', problemCount: 0 },
    { id: 'units', label: 'đơn vị đo', problemCount: 0 },
    { id: 'members', label: 'thành viên', problemCount: 0 },
    { id: 'danger', label: 'vùng nguy hiểm', problemCount: 0 },
  ],
  name: 'Chung cư Bình Minh',
  code: 'DA-BINHMINH',
  address: '12 Nguyễn Trãi, Hà Nội',
  buildingType: 'residential',
  buildingTypeOptions: [
    { value: 'residential', label: 'nhà ở' },
    { value: 'commercial', label: 'thương mại' },
  ],
  notes: 'Bản vẽ do nhà thầu gửi, đã soát tầng hầm.',
  notesCountLabel: '38 / 500 ký tự',
  problems: NO_PROBLEMS,
  lengthUnit: 'mm',
  lengthUnitOptions: [
    { value: 'mm', label: 'milimét (mm)' },
    { value: 'm', label: 'mét (m)' },
  ],
  areaUnitLabel: 'mét vuông — ví dụ 248,60 m²',
  snapToleranceMm: 50,
  snapToleranceLabel: '50 mm',
  snapToleranceMinMm: 1,
  snapToleranceMaxMm: 120,
  confidenceThreshold: 0.75,
  confidenceThresholdLabel: '75%',
  scaleMmPerPx: 2.5,
  scaleLabel: '2,5 milimét trên mỗi điểm ảnh',
  scalePreviewLabel: '100 điểm ảnh ứng với 250 mm ngoài thực tế.',
  members: MEMBERS,
  memberCountLabel: '3 thành viên',
  floorCount: 4,
  deleteAllFloorsLabel:
    'Xoá toàn bộ 4 tầng cùng bản vẽ và mô hình của chúng. Không hoàn tác được.',
  deleteProjectLabel: 'Xoá dự án cùng mọi tầng, bản vẽ và mô hình bên trong. Không hoàn tác được.',
  pendingDanger: null,
  dangerDialogTitle: null,
  dangerDialogMessage: null,
  dangerConfirmLabel: null,
  dangerConfirmationExpected: null,
  dangerConfirmationText: '',
  canConfirmDanger: false,
  isDangerRunning: false,
  setActiveTab: noop,
  setName: noop,
  setCode: noop,
  setAddress: noop,
  setBuildingType: noop,
  setNotes: noop,
  setLengthUnit: noop,
  setSnapToleranceMm: noop,
  setConfidenceThreshold: noop,
  setScaleMmPerPx: noop,
  saveNow: noop,
  retryLoad: noop,
  reloadSettings: noop,
  requestDeleteAllFloors: noop,
  requestDeleteProject: noop,
  setDangerConfirmationText: noop,
  confirmDanger: noop,
  cancelDanger: noop,
};

/** rỗng — dự án chưa có tầng nào, nên vùng nguy hiểm chỉ còn một việc. */
export const Empty: Story = {
  args: { ...base, state: 'empty', activeTab: 'danger', floorCount: 0, deleteAllFloorsLabel: 'Dự án chưa có tầng nào để xoá.' },
};

/** đang tải — khung xương, mọi ô mang mặc định rỗng. */
export const Loading: Story = {
  args: {
    ...base,
    state: 'loading',
    name: '',
    code: '',
    address: '',
    notes: '',
    notesCountLabel: '0 / 500 ký tự',
    snapToleranceMm: null,
    scaleMmPerPx: null,
    members: [],
    memberCountLabel: '0 thành viên',
    floorCount: 0,
    saveState: 'idle',
    saveLabel: 'Chưa có thay đổi',
  },
};

/** một phần — đang lưu, và tên dự án còn một lời phàn nàn chưa gỡ. */
export const Partial: Story = {
  args: {
    ...base,
    state: 'partial',
    saveState: 'saving',
    saveLabel: 'Đang lưu…',
    name: 'Ch',
    problems: { ...NO_PROBLEMS, name: 'Tên dự án cần ít nhất 3 ký tự.' },
    tabs: [
      { id: 'general', label: 'chung', problemCount: 1 },
      { id: 'units', label: 'đơn vị đo', problemCount: 0 },
      { id: 'members', label: 'thành viên', problemCount: 0 },
      { id: 'danger', label: 'vùng nguy hiểm', problemCount: 0 },
    ],
  },
};

/** lỗi — không đọc được cài đặt, kèm nút thử lại. */
export const ErrorState: Story = {
  args: {
    ...base,
    state: 'error',
    errorMessage: 'Mất kết nối máy chủ. Kiểm tra mạng rồi thử lại.',
  },
};

/** thành công — mọi thứ đã lưu, không còn gì phải sửa. */
export const Success: Story = { args: { ...base } };

/** không có quyền — vai người xem: dữ liệu vẫn đủ, mất quyền sửa và mất luôn thẻ nguy hiểm. */
export const Forbidden: Story = {
  args: {
    ...base,
    state: 'forbidden',
    canEdit: false,
    canDelete: false,
    isReadOnly: true,
    tabs: base.tabs.filter((tab) => tab.id !== 'danger'),
  },
};

/** thu gọn — dưới 1024px: dải thẻ gấp thành một ô chọn. */
export const Collapsed: Story = { args: { ...base, state: 'collapsed' } };

/** Hộp thoại xoá dự án — chỗ duy nhất A9 cho phép chặn trước một thao tác. */
export const DeleteProjectConfirm: Story = {
  args: {
    ...base,
    activeTab: 'danger',
    pendingDanger: 'deleteProject',
    dangerDialogTitle: 'Xoá dự án này?',
    dangerDialogMessage:
      'Dự án cùng toàn bộ tầng, bản vẽ và mô hình bên trong sẽ bị xoá vĩnh viễn. Không hoàn tác được.',
    dangerConfirmLabel: 'Xoá dự án',
    dangerConfirmationExpected: 'Chung cư Bình Minh',
  },
};

/** Xung đột 409 — chỉ còn một hành động: nạp lại. */
export const Conflict: Story = {
  args: {
    ...base,
    conflictMessage: 'Bản vẽ đã được người khác cập nhật. Tải lại để xem phiên bản mới nhất.',
  },
};
