import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { EmptyState } from './EmptyState';
import { Box, Search, CheckCircle } from 'lucide-react';

const meta = {
  title: 'Feedback/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="h-[400px] bg-bg-surface flex flex-col justify-center border border-border-default rounded-[8px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    icon: <Box />,
    title: 'Chưa có dự án nào',
    description: 'Bắt đầu bằng cách tạo một dự án mới để upload mặt bằng và dựng không gian 3D.',
    action: {
      label: 'Tạo dự án mới',
      onClick: () => console.log('Action clicked'),
    },
  },
};

export const NoResults: Story = {
  args: {
    icon: <Search />,
    title: 'Không tìm thấy kết quả',
    description: 'Thử kiểm tra lại từ khóa hoặc xóa bộ lọc để xem toàn bộ danh sách dự án.',
    action: {
      label: 'Xóa bộ lọc',
      variant: 'secondary',
      onClick: () => console.log('Clear filters'),
    },
  },
};

export const NoAction: Story = {
  args: {
    icon: <CheckCircle />,
    title: 'Không có lỗi nào',
    description: 'Tất cả các mô hình tường và cửa đều đáp ứng tiêu chuẩn an toàn.',
  },
};
