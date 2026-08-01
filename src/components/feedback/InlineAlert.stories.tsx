import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { InlineAlert } from './InlineAlert';

const meta = {
  title: 'Feedback/InlineAlert',
  component: InlineAlert,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="p-8 bg-bg-surface flex flex-col gap-4 max-w-2xl w-full mx-auto">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InlineAlert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Verified: Story = {
  args: {
    level: 'verified',
    title: 'Mô hình đã được duyệt',
    message: 'Toàn bộ 45/45 đối tượng trên mặt bằng đã vượt qua bài kiểm tra tự động.',
  },
};

export const Attention: Story = {
  args: {
    level: 'attention',
    title: 'Phát hiện tường mỏng',
    message: 'Có 3 đoạn tường có độ dày dưới 110mm. Hãy kiểm tra lại trước khi xuất bản.',
    action: {
      label: 'Kiểm tra',
      onClick: () => console.log('Action clicked'),
    },
  },
};

export const Violation: Story = {
  args: {
    level: 'violation',
    title: 'Giao cắt không hợp lệ',
    message: 'Cửa sổ C-02 đang đè lên vị trí của cột bê tông cốt thép (Cột-1). Hệ thống không thể xuất file 3D.',
    action: {
      label: 'Sửa lỗi',
      onClick: () => console.log('Action clicked'),
    },
  },
};

export const NoTitle: Story = {
  args: {
    level: 'attention',
    message: 'Bạn đang chỉnh sửa mặt bằng ở chế độ offline. Dữ liệu sẽ được đồng bộ khi có mạng.',
  },
};
