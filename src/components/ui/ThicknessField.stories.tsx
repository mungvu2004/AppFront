/* eslint-disable @typescript-eslint/no-explicit-any -- `any` trong file này chỉ nằm ở
 * `args` của story, nơi `Meta<typeof X>` đòi đủ props mà story lại dựng cây riêng trong
 * `render`. Không chỗ nào trong đây vào bản dựng sản phẩm. Đây là món nợ đã ghi ở mục 3
 * của BAO_CAO_DO_LECH.md: xoá dòng này khi có type helper cho `args`. */
import type { Meta, StoryObj } from '@storybook/react';
import { ThicknessField } from './ThicknessField';

const meta: Meta<typeof ThicknessField> = {
  title: 'ui/ThicknessField',
  component: ThicknessField,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [(Story: any) => <div style={{ width: 400 }}><Story /></div>],
};
export default meta;
type Story = StoryObj<typeof ThicknessField>;

export const Default: Story = {
  args: { value: '220' },
};

export const WithAiCaption: Story = {
  args: { value: '220', aiOriginalMm: 215 },
};

export const Unselected: Story = {
  args: {},
};

export const BTCT: Story = {
  args: { value: 'btct', aiOriginalMm: 300 },
};

export const WithError: Story = {
  args: { value: '110', error: 'Giá trị không khớp với thiết kế kỹ thuật', aiOriginalMm: 220 },
};

export const Disabled: Story = {
  args: { value: '220', disabled: true, aiOriginalMm: 220 },
};

export const ReadOnly: Story = {
  args: { value: '330', isReadOnly: true, aiOriginalMm: 330 },
};

export const Loading: Story = {
  args: { isLoading: true },
};
