/* eslint-disable @typescript-eslint/no-explicit-any -- `any` trong file này chỉ nằm ở
 * `args` của story, nơi `Meta<typeof X>` đòi đủ props mà story lại dựng cây riêng trong
 * `render`. Không chỗ nào trong đây vào bản dựng sản phẩm. Đây là món nợ đã ghi ở mục 3
 * của BAO_CAO_DO_LECH.md: xoá dòng này khi có type helper cho `args`. */
import type { Meta, StoryObj } from '@storybook/react';
import { Select } from './Select';

const options = [
  { label: 'Tầng 1', value: 'floor-1' },
  { label: 'Tầng 2', value: 'floor-2' },
  { label: 'Tầng 3', value: 'floor-3' },
  { label: 'Tầng lửng', value: 'floor-m' },
  { label: 'Tầng hầm', value: 'floor-b' },
];

const meta: Meta<typeof Select> = {
  title: 'ui/Select',
  component: Select,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [(Story: any) => <div style={{ width: 280 }}><Story /></div>],
};
export default meta;
type Story = StoryObj<typeof Select>;

export const Empty: Story = {
  args: { options, placeholder: 'Chọn tầng...', label: 'Tầng' },
};

export const WithValue: Story = {
  args: { options, value: 'floor-2', label: 'Tầng' },
};

export const NoOptions: Story = {
  args: { options: [], label: 'Loại phòng', placeholder: 'Chọn loại...' },
};

export const Disabled: Story = {
  args: { options, value: 'floor-1', disabled: true, label: 'Vô hiệu' },
};

export const ReadOnly: Story = {
  args: { options, value: 'floor-2', isReadOnly: true, label: 'Chỉ đọc' },
};

export const Loading: Story = {
  args: { options, isLoading: true, label: 'Đang tải' },
};
