import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { TreeItem } from './TreeItem';
import { Layers, Square, Home, DoorOpen } from 'lucide-react';

const meta: Meta<typeof TreeItem> = {
  title: 'ui/TreeItem',
  component: TreeItem,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof TreeItem>;

export const Default: Story = {
  args: {
    label: 'Tầng 1',
    hasChildren: true,
    expanded: false,
    count: 21,
  },
};

export const Expanded: Story = {
  args: {
    label: 'Tầng 1',
    hasChildren: true,
    expanded: true,
    count: 21,
    typeIcon: <Layers size={14} />,
  },
};

export const Selected: Story = {
  args: {
    label: 'Tường #W-014',
    selected: true,
    hasChildren: false,
    typeIcon: <Square size={14} />,
  },
};

export const Hidden: Story = {
  name: 'Ẩn (visible=false)',
  args: {
    label: 'Phòng khách',
    visible: false,
    hasChildren: false,
    typeIcon: <Home size={14} />,
  },
};

export const Leaf: Story = {
  name: 'Nút lá (không có con)',
  args: {
    label: 'Cửa #D-001',
    hasChildren: false,
    typeIcon: <DoorOpen size={14} />,
  },
};

export const Nested: Story = {
  name: 'Cây lồng nhau (level 0–2)',
  render: () => (
    <div className="w-64 space-y-0.5" role="tree">
      <TreeItem label="Tầng 1" hasChildren expanded count={48} typeIcon={<Layers size={14} />} level={0} />
      <TreeItem label="Tường" hasChildren expanded count={21} typeIcon={<Square size={14} />} level={1} />
      <TreeItem label="#W-001" hasChildren={false} level={2} />
      <TreeItem label="#W-002" hasChildren={false} level={2} selected />
      <TreeItem label="Phòng" hasChildren={false} count={14} typeIcon={<Home size={14} />} level={1} />
    </div>
  ),
};

// 7 states
export const Loading: Story = {
  name: 'Đang tải (skeleton)',
  render: () => (
    <div className="w-64 space-y-1">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-8 rounded-lg bg-bg-sunken overflow-hidden relative" style={{ paddingLeft: i * 16 + 8 }}>
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,var(--tw-gradient-stops),transparent_100%)] from-transparent via-border-default/50 to-transparent animate-skeleton-scan motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  ),
};

export const ErrorState: Story = {
  name: 'Lỗi',
  render: () => (
    <TreeItem label="Lỗi tải cây tầng" hasChildren={false} className="text-state-violation-text" />
  ),
};

export const NoPermission: Story = {
  name: 'Không có quyền',
  render: () => (
    <div className="opacity-50 pointer-events-none">
      <TreeItem label="Tầng 1 (bị khoá)" hasChildren count={21} />
    </div>
  ),
};
