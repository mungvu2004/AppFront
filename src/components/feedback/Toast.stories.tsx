import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Toast, useToast } from './Toast';
import { Button } from '../ui/Button';
import { useStore } from '../../store';

const meta = {
  title: 'Feedback/Toast',
  component: Toast.Provider,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="h-[400px] w-full bg-bg-app relative p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Toast.Provider>;

export default meta;
type Story = StoryObj<typeof meta>;

function ToastTrigger() {
  const { addToast } = useToast();

  return (
    <div className="flex gap-2 flex-wrap">
      <Button
        onClick={() => addToast({ message: 'Đã thêm tường mới', state: 'verified', onUndo: () => console.log('Undo!') })}
      >
        Show Verified
      </Button>
      <Button
        onClick={() => addToast({ message: 'Tường bị giao cắt', state: 'attention', onUndo: () => console.log('Undo!') })}
      >
        Show Attention
      </Button>
      <Button
        onClick={() => addToast({ message: 'Không thể xóa dầm', state: 'violation' })}
      >
        Show Violation (No Undo)
      </Button>
      <Button
        variant="secondary"
        onClick={() => {
          addToast({ message: 'Đã sửa 1 tường', state: 'verified', onUndo: () => console.log('Undo 1') });
          addToast({ message: 'Đã sửa 2 tường', state: 'verified', onUndo: () => console.log('Undo 2') });
          addToast({ message: 'Đã sửa 3 tường', state: 'verified', onUndo: () => console.log('Undo 3') });
          addToast({ message: 'Đã sửa 4 tường', state: 'verified', onUndo: () => console.log('Undo 4') });
        }}
      >
        Show Grouped (&gt;3)
      </Button>
    </div>
  );
}

export const Default: Story = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: {} as any,
  render: () => (
    <Toast.Provider>
      <ToastTrigger />
    </Toast.Provider>
  ),
};

export const Grouping: Story = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: {} as any,
  render: () => (
    <Toast.Provider>
      <ToastTrigger />
    </Toast.Provider>
  ),
};

function StoreTrigger() {
  const triggerCommit = () => {
    // eslint-disable-next-line local/no-direct-set
    useStore.setState({
      lastCommitTimestamp: Date.now(),
      lastCommitLabel: 'Cập nhật thuộc tính',
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-text-secondary text-sm">
        This triggers a commit in the global store to demonstrate the useUndoableToast hook integration.
      </p>
      <Button onClick={triggerCommit}>
        Trigger Store Commit
      </Button>
    </div>
  );
}

export const StoreIntegration: Story = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: {} as any,
  render: () => (
    <Toast.Provider>
      <StoreTrigger />
    </Toast.Provider>
  ),
};
