import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { MiniMap } from './MiniMap';

const meta: Meta<typeof MiniMap> = {
  title: 'Canvas / MiniMap',
  component: MiniMap,
  parameters: {
    layout: 'centered',
  },
};
export default meta;

export const Default: StoryObj = {
  name: 'Mặc định',
  render: () => (
    <div className="relative bg-canvas-2d" style={{ width: 600, height: 300 }}>
      <MiniMap />
      <div className="absolute top-32 left-2 font-mono text-xs text-text-muted">
        Hover để hiện đầy đủ, bấm để nhảy vùng
      </div>
    </div>
  ),
};
