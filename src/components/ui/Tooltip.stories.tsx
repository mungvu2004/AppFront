import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Tooltip } from './Tooltip';
import { Kbd } from './Kbd';
import { Button } from './Button';
import { Info } from 'lucide-react';

const meta: Meta = {
  title: 'ui/Tooltip',
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Top: Story = {
  name: 'Hướng trên (mặc định)',
  render: () => (
    <Tooltip label="Thêm tường mới" side="top">
      <Button variant="secondary" size="sm">Hover vào đây</Button>
    </Tooltip>
  ),
};

export const Bottom: Story = {
  name: 'Hướng dưới',
  render: () => (
    <Tooltip label="Thêm tường mới" side="bottom">
      <Button variant="secondary" size="sm">Hover vào đây</Button>
    </Tooltip>
  ),
};

export const WithKbd: Story = {
  name: 'Có phím tắt',
  render: () => (
    <Tooltip label="Xuất bản bản vẽ" kbd="⌘↵" side="top">
      <Button variant="primary" size="sm">Xuất bản</Button>
    </Tooltip>
  ),
};

export const OnIcon: Story = {
  name: 'Trên icon',
  render: () => (
    <Tooltip label="Thông tin chi tiết" side="right">
      <button
        className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-bg-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 outline-none"
        aria-label="Thông tin"
      >
        <Info size={16} className="text-text-secondary" />
      </button>
    </Tooltip>
  ),
};

export const Disabled: Story = {
  name: 'Tắt (disabled)',
  render: () => (
    <Tooltip label="Không hiển thị" disabled>
      <Button variant="secondary" size="sm">Hover — không có tooltip</Button>
    </Tooltip>
  ),
};

// Kbd standalone
export const KbdStory: Story = {
  name: 'Kbd — phím tắt',
  render: () => (
    <div className="flex items-center gap-2">
      <Kbd>⌘</Kbd>
      <Kbd>K</Kbd>
      <span className="text-text-secondary text-sm mx-2">→</span>
      <Kbd>⌘↵</Kbd>
      <Kbd>Esc</Kbd>
      <Kbd>⇧</Kbd>
    </div>
  ),
};
