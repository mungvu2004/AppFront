import type { Meta, StoryObj } from '@storybook/react';
import { SegmentedControl } from './SegmentedControl';

const meta: Meta<typeof SegmentedControl> = {
  title: 'ui/SegmentedControl',
  component: SegmentedControl,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof SegmentedControl>;

const twoOptions = [
  { label: '2D', value: '2d' },
  { label: '3D', value: '3d' },
];

const threeOptions = [
  { label: 'Tường', value: 'wall' },
  { label: 'Đối tượng', value: 'object' },
  { label: 'Kích thước', value: 'dim' },
];

const fiveOptions = [
  { label: 'Tường', value: 'wall' },
  { label: 'Đối tượng', value: 'object' },
  { label: 'Kích thước', value: 'dim' },
  { label: 'Lưới', value: 'grid' },
  { label: 'Phòng', value: 'room' },
];

export const TwoItems: Story = {
  args: { options: twoOptions, defaultValue: '2d', 'aria-label': 'Chế độ xem' },
};

export const ThreeItems: Story = {
  args: { options: threeOptions, defaultValue: 'wall', 'aria-label': 'Lớp' },
};

export const FiveItems: Story = {
  args: { options: fiveOptions, defaultValue: 'wall', 'aria-label': 'Lớp đầy đủ' },
};

export const WithDisabledItem: Story = {
  args: {
    options: [
      { label: '110', value: '110' },
      { label: '220', value: '220' },
      { label: '330', value: '330', disabled: true },
    ],
    defaultValue: '110',
    'aria-label': 'Độ dày',
  },
};

export const AllDisabled: Story = {
  args: { options: twoOptions, defaultValue: '2d', disabled: true, 'aria-label': 'Vô hiệu' },
};

export const Loading: Story = {
  args: { options: twoOptions, defaultValue: '2d', isLoading: true, 'aria-label': 'Đang tải' },
};
