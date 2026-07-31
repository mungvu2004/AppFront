import type { Meta, StoryObj } from '@storybook/react';
import { TableActionBar } from './TableActionBar';

const meta: Meta<typeof TableActionBar> = {
  title: 'ui/TableActionBar',
  component: TableActionBar,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="relative h-24 border border-border-default rounded-lg overflow-hidden bg-bg-app">
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof TableActionBar>;

export const Hidden: Story = {
  name: 'Rỗng (ẩn)',
  args: { selectedCount: 0, entityName: 'tường' },
};

export const OneSelected: Story = {
  name: '1 mục được chọn',
  args: {
    selectedCount: 1,
    entityName: 'tường',
    onApprove: () => {},
    onReject: () => {},
    onChangeThickness: () => {},
    onDeselect: () => {},
  },
};

export const ManySelected: Story = {
  name: '12 mục được chọn',
  args: {
    selectedCount: 12,
    entityName: 'tường',
    onApprove: () => {},
    onReject: () => {},
    onChangeThickness: () => {},
    onDeselect: () => {},
  },
};

export const Approving: Story = {
  name: 'Đang duyệt (loading)',
  args: {
    selectedCount: 5,
    entityName: 'tường',
    isApproving: true,
    onApprove: () => {},
    onReject: () => {},
    onDeselect: () => {},
  },
};

export const NoActions: Story = {
  name: 'Không có nút hành động',
  args: {
    selectedCount: 3,
    entityName: 'phòng',
    onDeselect: () => {},
  },
};
