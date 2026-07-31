import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './Badge';

const meta: Meta<typeof Badge> = {
  title: 'ui/Badge',
  component: Badge,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof Badge>;

export const Verified: Story = {
  args: { variant: 'verified', children: 'Đã duyệt' },
};

export const Attention: Story = {
  args: { variant: 'attention', children: 'Cần kiểm tra' },
};

export const Violation: Story = {
  args: { variant: 'violation', children: 'Vi phạm' },
};

export const Neutral: Story = {
  args: { variant: 'neutral', children: 'Chờ duyệt' },
};

export const NoDot: Story = {
  name: 'Không chấm (noDot)',
  args: { variant: 'verified', children: 'Đã duyệt', noDot: true },
};

// All 4 variants together
export const AllVariants: Story = {
  name: 'Tất cả biến thể',
  render: () => (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge variant="verified">Đã duyệt</Badge>
      <Badge variant="attention">Cần kiểm tra</Badge>
      <Badge variant="violation">Vi phạm</Badge>
      <Badge variant="neutral">Chờ duyệt</Badge>
    </div>
  ),
};
