import type { Meta, StoryObj } from '@storybook/react';
import { StatusBar } from './StatusBar';

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<typeof StatusBar> = {
  title: 'shell/StatusBar',
  component: StatusBar,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  args: {
    x: 124.5,
    y: 89.12,
    scaleRatio: '1:100',
    scaleDensity: '12 mm/px',
    saveText: 'Đã lưu lúc 14:32',
  },
};
export default meta;
type Story = StoryObj<typeof StatusBar>;

// ── 1. Default ────────────────────────────────────────────────────────────────

export const Default: Story = {
  parameters: {
    docs: { description: { story: 'Trạng thái mặc định — toạ độ X: 124,50 Y: 89,12, tỷ lệ 1:100.' } },
  },
};

// ── 2. Saving ─────────────────────────────────────────────────────────────────

export const Saving: Story = {
  args: { saveText: 'Đang lưu...' },
  parameters: {
    docs: { description: { story: 'Hệ thống đang ghi dữ liệu — thông báo tạm thời trước khi hoàn tất.' } },
  },
};

// ── 3. Saved ──────────────────────────────────────────────────────────────────

export const Saved: Story = {
  args: { saveText: 'Đã lưu lúc 14:32' },
  parameters: {
    docs: { description: { story: 'Xác nhận lưu thành công, hiển thị mốc thời gian theo quy tắc bất biến #7.' } },
  },
};

// ── 4. Error ──────────────────────────────────────────────────────────────────

export const Error: Story = {
  args: { saveText: 'Lỗi — không thể lưu' },
  parameters: {
    docs: { description: { story: 'Trạng thái lỗi lưu — người dùng cần biết hành động tiếp theo.' } },
  },
};
