import type { Meta, StoryObj } from '@storybook/react';
import { Settings, Bell, Search, Trash2 } from 'lucide-react';
import { IconButton } from './IconButton';

const meta: Meta<typeof IconButton> = {
  title: 'ui/IconButton',
  component: IconButton,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof IconButton>;

export const Default: Story = {
  args: { icon: <Settings size={18} />, 'aria-label': 'Cài đặt' },
};

export const Active: Story = {
  args: { icon: <Bell size={18} />, 'aria-label': 'Thông báo', isActive: true },
};

export const Loading: Story = {
  args: { icon: <Search size={18} />, 'aria-label': 'Tìm kiếm', loading: true },
};

export const Disabled: Story = {
  args: { icon: <Trash2 size={18} />, 'aria-label': 'Xoá', disabled: true },
};

export const SizeSm: Story = {
  args: { icon: <Settings size={16} />, 'aria-label': 'Cài đặt nhỏ', size: 'sm' },
};

export const SizeMd: Story = {
  args: { icon: <Settings size={18} />, 'aria-label': 'Cài đặt trung', size: 'md' },
};

export const SizeLg: Story = {
  args: { icon: <Settings size={18} />, 'aria-label': 'Cài đặt lớn', size: 'lg' },
};

export const NoTooltip: Story = {
  args: { icon: <Settings size={18} />, 'aria-label': 'Không tooltip', tooltip: false },
};
