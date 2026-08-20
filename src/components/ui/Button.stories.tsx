/* eslint-disable @typescript-eslint/no-explicit-any -- `any` trong file này chỉ nằm ở
 * `args` của story, nơi `Meta<typeof X>` đòi đủ props mà story lại dựng cây riêng trong
 * `render`. Không chỗ nào trong đây vào bản dựng sản phẩm. Đây là món nợ đã ghi ở mục 3
 * của BAO_CAO_DO_LECH.md: xoá dòng này khi có type helper cho `args`. */
import type { Meta, StoryObj } from '@storybook/react';
import { Plus, ArrowRight, Trash2 } from 'lucide-react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'ui/Button',
  component: Button,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof Button>;

// ── 1. Variants ──────────────────────────────────────────────────────────────

export const Primary: Story = {
  args: { children: 'Xác nhận', variant: 'primary' },
};

export const Secondary: Story = {
  args: { children: 'Huỷ', variant: 'secondary' },
};

export const Ghost: Story = {
  args: { children: 'Chi tiết', variant: 'ghost' },
};

export const Danger: Story = {
  args: { children: 'Xoá', variant: 'danger' },
};

// ── 2. Sizes ─────────────────────────────────────────────────────────────────

export const SizeSm: Story = {
  args: { children: 'Nhỏ', size: 'sm', variant: 'secondary' },
};

export const SizeMd: Story = {
  args: { children: 'Trung bình', size: 'md', variant: 'secondary' },
};

export const SizeLg: Story = {
  args: { children: 'Lớn', size: 'lg', variant: 'secondary' },
};

// ── 3. Icons ─────────────────────────────────────────────────────────────────

export const WithIconBefore: Story = {
  args: {
    children: 'Thêm mới',
    variant: 'primary',
    iconBefore: <Plus size={18} />,
  },
};

export const WithIconAfter: Story = {
  args: {
    children: 'Tiếp theo',
    variant: 'secondary',
    iconAfter: <ArrowRight size={18} />,
  },
};

export const IconOnly: Story = {
  args: {
    variant: 'secondary',
    icon: <Trash2 size={18} />,
    iconOnly: true,
    'aria-label': 'Xoá',
  },
};

// ── 4. States ────────────────────────────────────────────────────────────────

export const Loading: Story = {
  args: { children: 'Đang lưu...', variant: 'primary', loading: true },
};

export const Disabled: Story = {
  args: { children: 'Không khả dụng', variant: 'primary', disabled: true },
};

export const FullWidth: Story = {
  args: { children: 'Đăng nhập', variant: 'primary', fullWidth: true },
  decorators: [(Story: any) => <div style={{ width: 320 }}><Story /></div>],
};

// ── 5. With shortcut ─────────────────────────────────────────────────────────

export const WithShortcut: Story = {
  args: { children: 'Xuất bản', variant: 'primary', shortcut: '⌘↵' },
};
