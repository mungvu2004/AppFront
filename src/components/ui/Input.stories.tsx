import type { Meta, StoryObj } from '@storybook/react';
import { Search, AtSign } from 'lucide-react';
import { Input } from './Input';

const meta: Meta<typeof Input> = {
  title: 'ui/Input',
  component: Input,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [(Story: any) => <div style={{ width: 320 }}><Story /></div>],
};
export default meta;
type Story = StoryObj<typeof Input>;

export const Empty: Story = {
  args: { placeholder: 'Nhập văn bản...' },
};

export const WithLabel: Story = {
  args: { label: 'Tên dự án', placeholder: 'Nhập tên dự án...' },
};

export const WithValue: Story = {
  args: { label: 'Tên dự án', value: 'Chung cư Hoàng Anh', readOnly: true },
};

export const WithPrefix: Story = {
  args: { label: 'Tìm kiếm', prefix: <Search size={16} />, placeholder: 'Tìm kiếm...' },
};

export const WithSuffix: Story = {
  args: { label: 'Email', suffix: <AtSign size={16} />, placeholder: 'ten@email.com' },
};

export const Error: Story = {
  args: {
    label: 'Tên dự án',
    value: '',
    error: 'Tên dự án không được để trống',
    'aria-invalid': true,
  },
};

export const Disabled: Story = {
  args: { label: 'Vô hiệu', value: 'Không thể chỉnh sửa', disabled: true },
};

export const ReadOnly: Story = {
  args: { label: 'Chỉ đọc', value: '248,60 m²', isReadOnly: true },
};

export const Loading: Story = {
  args: { label: 'Đang tải', isLoading: true },
};

export const Flash: Story = {
  args: { label: 'Vừa lưu', value: 'Đã cập nhật', flash: true },
};
