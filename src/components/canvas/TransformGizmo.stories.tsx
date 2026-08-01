import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { TransformGizmo } from './TransformGizmo';

const meta: Meta<typeof TransformGizmo> = {
  title: 'Canvas / TransformGizmo',
  component: TransformGizmo,
  parameters: {
    layout: 'centered',
  },
};
export default meta;

export const Idle: StoryObj = {
  name: 'Idle',
  render: () => (
    <div className="relative bg-canvas-3d" style={{ width: 400, height: 300 }}>
      <TransformGizmo cx={200} cy={150} />
    </div>
  ),
};
