import type { Meta, StoryObj } from '@storybook/react';
import { ConfidenceMeter } from './ConfidenceMeter';

const meta: Meta<typeof ConfidenceMeter> = {
  title: 'ui/ConfidenceMeter',
  component: ConfidenceMeter,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof ConfidenceMeter>;

export const High: Story = {
  name: 'AI chắc chắn (≥ 0,90)',
  args: { value: 0.90 },
};

export const Suggested: Story = {
  name: 'AI đề xuất (0,70–0,90)',
  args: { value: 0.78 },
};

export const AttentionState: Story = {
  name: 'Cần kiểm tra (< 0,70)',
  args: { value: 0.62 },
};

export const Borderline: Story = {
  name: 'Biên giới (0,70)',
  args: { value: 0.70 },
};

export const VeryLow: Story = {
  name: 'Rất thấp (< 0,5)',
  args: { value: 0.42 },
};

export const Maximum: Story = {
  name: 'Tối đa (1,00)',
  args: { value: 1.0 },
};

export const Minimum: Story = {
  name: 'Tối thiểu (0,00)',
  args: { value: 0.0 },
};

export const NoTooltip: Story = {
  name: 'Không tooltip',
  args: { value: 0.71, noTooltip: true },
};

export const AllInTable: Story = {
  name: 'Trong bảng — bộ dữ liệu chuẩn',
  render: () => (
    <div className="space-y-2 p-4">
      {[0.90, 0.85, 0.71, 0.88, 0.62].map((v) => (
        <ConfidenceMeter key={v} value={v} />
      ))}
    </div>
  ),
};
