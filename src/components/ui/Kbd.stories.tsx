import type { Meta, StoryObj } from '@storybook/react';
import { Kbd } from './Kbd';

const meta: Meta<typeof Kbd> = {
  title: 'ui/Kbd',
  component: Kbd,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof Kbd>;

// Tên phím được phép viết hoa — ngoại lệ của A6 (mã trục, mã lỗi, tên phím).

export const SingleKey: Story = {
  name: 'Một phím',
  args: { children: 'W' },
};

export const Modifier: Story = {
  name: 'Tổ hợp phím',
  args: { children: '⌘Z' },
};

export const NamedKey: Story = {
  name: 'Tên phím dài',
  args: { children: 'Esc' },
};

export const Arrow: Story = {
  name: 'Phím mũi tên',
  args: { children: '↑' },
};

// Cách dùng thật trong sản phẩm — dòng gợi ý phím tắt như trong CommandPalette.
export const InShortcutRow: Story = {
  name: 'Trong một dòng gợi ý phím tắt',
  render: () => (
    <div className="flex items-center gap-4 text-[11px] text-text-muted select-none">
      <span className="flex items-center gap-1">
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd> di chuyển
      </span>
      <span className="flex items-center gap-1">
        <Kbd>↵</Kbd> chọn
      </span>
      <span className="flex items-center gap-1">
        <Kbd>Esc</Kbd> đóng
      </span>
    </div>
  ),
};
