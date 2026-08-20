/* eslint-disable @typescript-eslint/no-explicit-any -- `any` trong file này chỉ nằm ở
 * `args` của story, nơi `Meta<typeof X>` đòi đủ props mà story lại dựng cây riêng trong
 * `render`. Không chỗ nào trong đây vào bản dựng sản phẩm. Đây là món nợ đã ghi ở mục 3
 * của BAO_CAO_DO_LECH.md: xoá dòng này khi có type helper cho `args`. */
import type { Meta, StoryObj } from '@storybook/react';
import { Slider } from './Slider';

const meta: Meta<typeof Slider> = {
  title: 'ui/Slider',
  component: Slider,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [(Story: any) => <div style={{ width: 320, padding: '16px 0' }}><Story /></div>],
};
export default meta;
type Story = StoryObj<typeof Slider>;

export const Default: Story = {
  args: { value: 50, onChange: () => {}, 'aria-label': 'Giá trị' },
};

export const WithLabels: Story = {
  args: {
    value: 48,
    min: 0,
    max: 100,
    onChange: () => {},
    endLabels: ['0', '100'],
    'aria-label': 'Số tường',
  },
};

export const WithSnapPoints: Story = {
  args: {
    value: 110,
    min: 0,
    max: 330,
    onChange: () => {},
    snapPoints: [110, 220, 330],
    'aria-label': 'Độ dày',
  },
};

export const Disabled: Story = {
  args: { value: 30, onChange: () => {}, disabled: true, 'aria-label': 'Vô hiệu' },
};

export const ReadOnly: Story = {
  args: { value: 70, onChange: () => {}, readOnly: true, 'aria-label': 'Chỉ đọc' },
};

export const Loading: Story = {
  args: { value: 0, onChange: () => {}, isLoading: true, 'aria-label': 'Đang tải' },
};
