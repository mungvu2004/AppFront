import type { Meta, StoryObj } from '@storybook/react';
import { Checkbox } from './Checkbox';

const meta: Meta<typeof Checkbox> = {
  title: 'ui/Checkbox',
  component: Checkbox,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Unchecked: Story = {
  args: { label: 'Chưa chọn', checked: false },
};

export const Checked: Story = {
  args: { label: 'Đã chọn', checked: true },
};

export const Indeterminate: Story = {
  args: { label: 'Một phần', indeterminate: true },
};

export const Disabled: Story = {
  args: { label: 'Vô hiệu', disabled: true },
};

export const DisabledChecked: Story = {
  args: { label: 'Vô hiệu + đã chọn', disabled: true, checked: true },
};

export const WithError: Story = {
  args: { label: 'Lỗi', error: true },
};

export const ReadOnly: Story = {
  args: { label: 'Chỉ đọc', checked: true, readOnly: true },
};
