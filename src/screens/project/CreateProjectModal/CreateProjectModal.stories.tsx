import type { Meta, StoryObj } from '@storybook/react';

import type { SelectOption } from '@/components/ui/Select';

import { CreateProjectModalView, type CreateProjectModalViewProps } from './CreateProjectModal';
import type { CreateProjectFloorRowModel } from './useCreateProjectModal';

/**
 * The create-project dialog in each of invariant A11's seven states, plus the
 * two overlays that sit outside that precedence: the discard confirmation and
 * an in-progress collision.
 *
 * Every story renders {@link CreateProjectModalView} — no hook, no gateway, no
 * router — because the view is a function of its props, invariant D's point.
 */
const meta = {
  title: 'Screens/Project/CreateProjectModal',
  component: CreateProjectModalView,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof CreateProjectModalView>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = (): void => undefined;

const BUILDING_TYPE_OPTIONS: SelectOption[] = [
  { value: 'residential', label: 'nhà ở' },
  { value: 'commercial', label: 'thương mại' },
  { value: 'industrial', label: 'công nghiệp' },
  { value: 'mixed', label: 'hỗn hợp' },
  { value: 'other', label: 'khác' },
];

/** The acceptance case: a basement plus three floors, stacked from the ground floor's 0,0. */
const STACKED_FLOOR_ROWS: CreateProjectFloorRowModel[] = [
  { id: 'row-basement', name: 'Tầng hầm', kind: 'basement', clearHeightM: 3, elevationLabel: '-3,0 m', problem: null },
  { id: 'row-ground', name: 'Tầng trệt', kind: 'floor', clearHeightM: 3.9, elevationLabel: '0,0 m', problem: null },
  { id: 'row-1', name: 'Tầng 1', kind: 'floor', clearHeightM: 3.6, elevationLabel: '3,9 m', problem: null },
  { id: 'row-2', name: 'Tầng 2', kind: 'floor', clearHeightM: 3, elevationLabel: '7,5 m', problem: null },
];

const base: CreateProjectModalViewProps = {
  isOpen: true,
  state: 'success',
  isCompact: false,
  canCreate: true,
  step: 3,
  stepLabel: 'bước 3 / 3',
  isSubmitting: false,
  isConfirmingDiscard: false,
  isSelectOpen: false,
  name: 'Chung cư Bình Minh',
  address: '12 Nguyễn Trãi, Hà Nội',
  code: 'DA-CHUNGCUBINHMINH',
  buildingType: 'residential',
  notes: '',
  buildingTypeOptions: BUILDING_TYPE_OPTIONS,
  problems: { name: null },
  notice: null,
  floorRows: STACKED_FLOOR_ROWS,
  hasBasement: true,
  collision: null,
  collisionRowId: null,
  focusFloorId: null,
  canAddFloor: true,
  applyHeightM: null,
  canApplyHeight: false,
  canGoNext: true,
  canSubmit: true,
  setName: noop,
  setAddress: noop,
  setCode: noop,
  setBuildingType: noop,
  setNotes: noop,
  setSelectOpen: noop,
  setHasBasement: noop,
  addFloor: noop,
  removeFloor: noop,
  setFloorName: noop,
  setFloorHeight: noop,
  setApplyHeightM: noop,
  applyHeightToAllFloors: noop,
  focusFloor: noop,
  acknowledgeFocus: noop,
  goNext: noop,
  goBack: noop,
  requestClose: noop,
  confirmDiscard: noop,
  submit: noop,
};

/** thành công — bước 3, mọi thứ sạch, bốn tầng đã xếp cao độ. */
export const Success: Story = { args: { ...base } };

/** bước 1 — biểu mẫu thông tin công trình còn trống. */
export const StepInfo: Story = {
  args: {
    ...base,
    state: 'partial',
    step: 1,
    stepLabel: 'bước 1 / 3',
    name: '',
    address: '',
    code: '',
    notes: '',
    floorRows: [],
    hasBasement: false,
    problems: { name: 'Chưa nhập tên dự án.' },
    canGoNext: false,
    canSubmit: false,
  },
};

/** bước 2 — bốn tầng mặc định, cao độ tính đủ, sẵn sàng qua bước xem lại. */
export const FloorsFilled: Story = {
  args: {
    ...base,
    step: 2,
    stepLabel: 'bước 2 / 3',
  },
};

/** rỗng — bước 2, chưa thêm tầng nào. */
export const Empty: Story = {
  args: {
    ...base,
    state: 'empty',
    step: 2,
    stepLabel: 'bước 2 / 3',
    floorRows: [],
    hasBasement: false,
    canGoNext: false,
    canSubmit: false,
  },
};

/** đang tải — đang gửi yêu cầu tạo dự án, mọi trường bị khoá. */
export const Loading: Story = { args: { ...base, state: 'loading', isSubmitting: true } };

/** một phần — một tầng còn thiếu chiều cao thông thuỷ. */
export const Partial: Story = {
  args: {
    ...base,
    state: 'partial',
    step: 2,
    stepLabel: 'bước 2 / 3',
    canGoNext: false,
    canSubmit: false,
    floorRows: [
      STACKED_FLOOR_ROWS[0] as CreateProjectFloorRowModel,
      STACKED_FLOOR_ROWS[1] as CreateProjectFloorRowModel,
      { id: 'row-1', name: 'Tầng 1', kind: 'floor', clearHeightM: null, elevationLabel: null, problem: 'Chưa nhập chiều cao thông thuỷ.' },
    ],
  },
};

/** một phần — hai tầng chồng lấn nhau, InlineAlert dẫn thẳng tới tầng trên. */
export const Collision: Story = {
  args: {
    ...base,
    state: 'partial',
    step: 2,
    stepLabel: 'bước 2 / 3',
    canGoNext: false,
    canSubmit: false,
    collision:
      'Tầng Tầng 1 bắt đầu ở cao độ 3,000 m, thấp hơn trần tầng Tầng trệt ở 3,900 m: hai tầng chồng lấn 900 mm.',
    collisionRowId: 'row-1',
    floorRows: STACKED_FLOOR_ROWS.map((row) =>
      row.id === 'row-1' || row.id === 'row-ground'
        ? {
            ...row,
            problem:
              'Tầng Tầng 1 bắt đầu ở cao độ 3,000 m, thấp hơn trần tầng Tầng trệt ở 3,900 m: hai tầng chồng lấn 900 mm.',
          }
        : row,
    ),
  },
};

/** lỗi — máy chủ từ chối vì tên dự án đã trùng; thông báo gắn thẳng vào ô tên. */
export const ErrorState: Story = {
  args: {
    ...base,
    state: 'error',
    step: 1,
    stepLabel: 'bước 1 / 3',
    problems: { name: 'Tên dự án đã trùng với một dự án khác. Đổi tên rồi thử lại.' },
    notice: { level: 'violation', message: 'Tên dự án đã trùng với một dự án khác. Đổi tên rồi thử lại.' },
  },
};

/** không có quyền — vai người xem, không tạo được dự án. */
export const Forbidden: Story = { args: { ...base, state: 'forbidden', canCreate: false } };

/** thu gọn — dưới 1024px: bước 1 dồn một cột. */
export const Collapsed: Story = {
  args: { ...base, state: 'collapsed', isCompact: true, step: 1, stepLabel: 'bước 1 / 3' },
};

/** Esc lần đầu trên biểu mẫu có thay đổi: cảnh báo trước khi đóng thật. */
export const DiscardConfirm: Story = {
  args: { ...base, isConfirmingDiscard: true, step: 1, stepLabel: 'bước 1 / 3' },
};
