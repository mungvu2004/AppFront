import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { ZoomCluster } from './ZoomCluster';

const meta: Meta<typeof ZoomCluster> = {
  title: 'Canvas / ZoomCluster',
  component: ZoomCluster,
  parameters: {
    layout: 'centered',
  },
};
export default meta;

export const Default: StoryObj = {
  name: 'Mặc định',
  render: () => (
    <div className="relative bg-canvas-2d" style={{ width: 600, height: 200 }}>
      <ZoomCluster />
      <div className="absolute top-2 left-2 font-mono text-xs text-text-muted">
        Hover vào góc dưới phải để hiện
      </div>
    </div>
  ),
};
