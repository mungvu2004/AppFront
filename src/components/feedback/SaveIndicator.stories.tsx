import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { SaveIndicator } from './SaveIndicator';

const meta = {
  title: 'Feedback/SaveIndicator',
  component: SaveIndicator,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="p-8 bg-bg-app flex flex-col items-start gap-4 max-w-sm mx-auto">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SaveIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  args: {
    saveState: 'idle',
  },
};

export const Pending: Story = {
  args: {
    saveState: 'pending',
  },
};

export const Saving: Story = {
  args: {
    saveState: 'saving',
  },
};

export const Saved: Story = {
  args: {
    saveState: 'saved',
    label: 'Đã lưu lúc 14:32',
  },
};

export const ErrorState: Story = {
  args: {
    saveState: 'error',
    label: 'Lưu thất bại',
  },
};

export const Flashing: Story = {
  args: {
    saveState: 'pending',
    flash: true,
  },
};
