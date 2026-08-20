import React, { useState, useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ProgressOverlay } from './ProgressOverlay';

const meta = {
  title: 'Feedback/ProgressOverlay',
  component: ProgressOverlay,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="relative h-[500px] w-full bg-bg-surface border border-border-default overflow-hidden">
        {/* Mock background content */}
        <div className="p-8 flex flex-col gap-4">
          <h1 className="text-xl font-bold">Mô hình 3D</h1>
          <div className="w-full h-32 bg-bg-sunken rounded-lg" />
          <div className="w-2/3 h-16 bg-bg-sunken rounded-lg" />
        </div>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProgressOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

function AnimatedProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) return 0;
        return Math.min(100, p + (Math.random() * 5 + 1));
      });
    }, 500);
    return () => clearInterval(timer);
  }, []);

  return (
    <ProgressOverlay
      title="Đang dựng mô hình 4 tầng..."
      progress={progress}
      onBackground={() => console.log('Run in background')}
    />
  );
}

export const Default: Story = {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- story này dựng cây
     riêng trong `render` nên không có `args` nào để khai, nhưng `Meta` vẫn đòi đủ props
     của component. `any` nằm trong story, không vào bản dựng sản phẩm. */
  args: {} as any,
  render: () => <AnimatedProgress />,
};

export const Determinate: Story = {
  args: {
    progress: 75,
    title: 'Đang xử lý dữ liệu...',
  },
};
