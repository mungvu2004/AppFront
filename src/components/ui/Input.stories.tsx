/* eslint-disable @typescript-eslint/no-explicit-any -- `any` trong file này chỉ nằm ở
 * `args` của story, nơi `Meta<typeof X>` đòi đủ props mà story lại dựng cây riêng trong
 * `render`. Không chỗ nào trong đây vào bản dựng sản phẩm. Đây là món nợ đã ghi ở mục 3
 * của BAO_CAO_DO_LECH.md: xoá dòng này khi có type helper cho `args`. */
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
