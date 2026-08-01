/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Meta, StoryObj } from '@storybook/react';
import { Textarea } from './Textarea';

const meta: Meta<typeof Textarea> = {
  title: 'ui/Textarea',
  component: Textarea,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [(Story: any) => <div style={{ width: 360 }}><Story /></div>],
};
export default meta;
type Story = StoryObj<typeof Textarea>;

export const Empty: Story = {
  args: { placeholder: 'Nhập ghi chú...' },
};

export const WithLabel: Story = {
  args: { label: 'Ghi chú kiểm tra', placeholder: 'Nhập ghi chú...' },
};

export const WithValue: Story = {
  args: {
    label: 'Mô tả dự án',
    value: 'Chung cư Hoàng Anh – 48 tường, 21 đối tượng, 34 kích thước, 14 lưới, 4 phòng. Tổng diện tích 248,60 m².',
  },
};

export const WithCharCount: Story = {
  args: {
    label: 'Ghi chú',
    value: 'Kiểm tra lại tường khu vực A.',
    maxLength: 200,
  },
};

export const WithError: Story = {
  args: {
    label: 'Ghi chú bắt buộc',
    value: '',
    error: 'Ghi chú không được để trống',
  },
};

export const WithHint: Story = {
  args: {
    label: 'Ghi chú',
    placeholder: 'Nhập ghi chú...',
    hint: 'Nội dung sẽ được hiển thị trong báo cáo QC',
  },
};

export const Disabled: Story = {
  args: { label: 'Vô hiệu', value: 'Không thể chỉnh sửa', disabled: true },
};

export const ReadOnly: Story = {
  args: { label: 'Chỉ đọc', value: 'Giá trị tham chiếu', isReadOnly: true },
};

export const Loading: Story = {
  args: { label: 'Đang tải', isLoading: true },
};
