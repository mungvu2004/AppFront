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
  { id: 'm-an', name: 'Phạm An', roleLabel: 'Quản trị', initials: 'PA', removeLabel: 'Gỡ Phạm An' },
  { id: 'm-binh', name: 'Nguyễn Bình', roleLabel: 'Kỹ sư', initials: 'NB', removeLabel: 'Gỡ Nguyễn Bình' },
  { id: 'm-chi', name: 'Trần Chi', roleLabel: 'Người xem', initials: 'TC', removeLabel: 'Gỡ Trần Chi' },
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
  isProjectMissing: false,
  canRetryLoad: false,
  saveState: 'saved',
  saveLabel: 'Đã lưu lúc 14:32',
  conflictMessage: null,
  saveFailureMessage: null,
  isReloadDialogOpen: false,
  memberEmail: '',
  memberError: null,
  isAddingMember: false,
  isAddMemberLocked: false,
  memberRemoveDialog: null,
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
    { value: 'residential', label: 'Nhà ở' },
    { value: 'commercial', label: 'Thương mại' },
  ],
  notes: 'Bản vẽ do nhà thầu gửi, đã soát tầng hầm.',
  notesCountLabel: '38 / 500 ký tự',
  problems: NO_PROBLEMS,
  lengthUnit: 'mm',
  lengthUnitOptions: [
    { value: 'mm', label: 'Milimét (mm)' },
    { value: 'm', label: 'Mét (m)' },
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
  backToProjects: null,
  reloadSettings: noop,
  confirmReload: noop,
  cancelReload: noop,
  setMemberEmail: noop,
  addMember: noop,
  requestRemoveMember: noop,
  confirmRemoveMember: noop,
  cancelRemoveMember: noop,
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
    canRetryLoad: true,
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

/** Thẻ thành viên, người sửa được: ô email, nút thêm và nút gỡ trên từng dòng. */
export const MembersEditable: Story = { args: { ...base, activeTab: 'members' } };

/** Thêm thành viên lỗi — địa chỉ chưa có tài khoản đang hoạt động. */
export const AddMemberError: Story = {
  args: {
    ...base,
    activeTab: 'members',
    memberEmail: 'khach@example.com',
    memberError: 'Không thêm được: địa chỉ này chưa có tài khoản đang hoạt động.',
  },
};

/** Thêm thành viên bị giới hạn tần suất — nút khoá, câu không có số giây. */
export const AddMemberRateLimited: Story = {
  args: {
    ...base,
    activeTab: 'members',
    memberEmail: 'khach@example.com',
    memberError: 'Bạn đã thêm nhiều thành viên trong giờ này; hãy thử lại sau.',
    isAddMemberLocked: true,
  },
};

/** Gỡ thành viên — hộp thoại A9, lỗi hiện ngay trong hộp. */
export const RemoveMemberDialog: Story = {
  args: {
    ...base,
    activeTab: 'members',
    memberRemoveDialog: {
      title: 'Gỡ Phạm An khỏi dự án?',
      message: 'Bạn sẽ mất quyền xem dự án này. Muốn quay lại phải nhờ người khác thêm lại.',
      error: 'Không gỡ được: dự án cần ít nhất một người sửa được cài đặt.',
      confirmLabel: 'Gỡ',
      cancelLabel: 'Để nguyên',
      isRunning: false,
    },
  },
};

/** Chỉ xem — thẻ thành viên không có ô thêm và nút gỡ. */
export const MembersReadOnly: Story = {
  args: {
    ...base,
    activeTab: 'members',
    state: 'forbidden',
    canEdit: false,
    canDelete: false,
    isReadOnly: true,
    tabs: base.tabs.filter((tab) => tab.id !== 'danger'),
  },
};

/** Lưu dở — thông tin chung đã lưu, đơn vị đo chưa; có ô lỗi từ máy chủ. */
export const PartialSave: Story = {
  args: {
    ...base,
    state: 'partial',
    saveState: 'error',
    saveFailureMessage: 'Đã lưu thông tin chung, chưa lưu đơn vị đo.',
    activeTab: 'units',
    problems: { ...NO_PROBLEMS, snapToleranceMm: 'Máy chủ không nhận giá trị này. Kiểm tra lại ô này.' },
  },
};

/** Tải lại khi còn thay đổi chưa lưu — hộp thoại A9. */
export const ReloadDialog: Story = {
  args: {
    ...base,
    conflictMessage: 'Cài đặt dự án vừa được đổi ở nơi khác. Tải lại để xem bản mới nhất.',
    isReloadDialogOpen: true,
  },
};
