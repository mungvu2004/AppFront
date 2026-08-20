/* eslint-disable @typescript-eslint/no-explicit-any -- `any` trong file này chỉ nằm ở
 * `args` của story, nơi `Meta<typeof X>` đòi đủ props mà story lại dựng cây riêng trong
 * `render`. Không chỗ nào trong đây vào bản dựng sản phẩm. Đây là món nợ đã ghi ở mục 3
 * của BAO_CAO_DO_LECH.md: xoá dòng này khi có type helper cho `args`. */
import type { Meta, StoryObj } from '@storybook/react';
import { Combobox } from './Combobox';

const wallTypes = [
  { label: 'Tường gạch 110mm', value: 'brick-110' },
  { label: 'Tường gạch 220mm', value: 'brick-220' },
  { label: 'Tường cột BTCT', value: 'concrete' },
  { label: 'Tường kính', value: 'glass' },
  { label: 'Tường nhôm', value: 'aluminum' },
  { label: 'Vách thạch cao', value: 'drywall' },
];

const meta: Meta<typeof Combobox> = {
  title: 'ui/Combobox',
  component: Combobox,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [(Story: any) => <div style={{ width: 300 }}><Story /></div>],
};
export default meta;
type Story = StoryObj<typeof Combobox>;

export const Empty: Story = {
  args: { options: wallTypes, placeholder: 'Chọn loại tường...', label: 'Loại tường' },
};

export const WithValue: Story = {
  args: { options: wallTypes, value: 'brick-220', label: 'Loại tường' },
};

export const NoResults: Story = {
  // User would type something that doesn't match — shown via open state
  args: { options: wallTypes, label: 'Loại tường', placeholder: 'Thử tìm "kính cường lực"...' },
};

export const Disabled: Story = {
  args: { options: wallTypes, value: 'brick-110', disabled: true, label: 'Vô hiệu' },
};

export const ReadOnly: Story = {
  args: { options: wallTypes, value: 'brick-220', isReadOnly: true, label: 'Chỉ đọc' },
};

export const Loading: Story = {
  args: { options: wallTypes, isLoading: true, label: 'Đang tải' },
};
