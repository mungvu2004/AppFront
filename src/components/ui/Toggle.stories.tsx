import type { Meta, StoryObj } from '@storybook/react';
import { Toggle } from './Toggle';

const meta: Meta<typeof Toggle> = {
  title: 'ui/Toggle',
  component: Toggle,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof Toggle>;

export const Off: Story = {
  args: { defaultChecked: false, 'aria-label': 'Bật/tắt' },
};

export const On: Story = {
  args: { defaultChecked: true, 'aria-label': 'Bật/tắt' },
};

export const WithLabel: Story = {
  args: { defaultChecked: true, label: 'Hiển thị lưới', 'aria-label': 'Hiển thị lưới' },
};

export const WithLabelAndDescription: Story = {
  args: {
    defaultChecked: false,
    label: 'Chế độ tối',
    description: 'Giảm độ chói màn hình trong môi trường tối',
    'aria-label': 'Chế độ tối',
  },
};

export const Disabled: Story = {
  args: { defaultChecked: false, disabled: true, label: 'Không khả dụng', 'aria-label': 'Vô hiệu' },
};

export const ReadOnly: Story = {
  args: { defaultChecked: true, isReadOnly: true, label: 'Chỉ đọc', 'aria-label': 'Chỉ đọc' },
};

export const Loading: Story = {
  args: { isLoading: true, label: 'Đang tải', 'aria-label': 'Đang tải' },
};
