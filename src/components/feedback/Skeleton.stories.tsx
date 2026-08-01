import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Skeleton } from './Skeleton';

const meta = {
  title: 'Feedback/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="p-8 bg-bg-surface flex flex-col gap-8 w-full max-w-4xl mx-auto">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TableRow: Story = {
  args: {
    preset: 'table-row',
  },
};

export const ProjectCard: Story = {
  args: {
    preset: 'project-card',
  },
};

export const PropertyPanel: Story = {
  args: {
    preset: 'property-panel',
  },
};

export const Canvas: Story = {
  args: {
    preset: 'canvas',
  },
};
