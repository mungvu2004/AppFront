import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Drawer } from './Drawer';
import { Button } from '../ui/Button';

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: 'overlay/Drawer',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Trên desktop (≥ 1024px): trượt từ phải. Dưới 1024px: tự động chuyển sang bottom-sheet 3 mức snap. Dùng Storybook viewport controls để thử.',
      },
    },
  },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

// ── Nội dung mẫu ──────────────────────────────────────────────────────────────

const DrawerContent = () => (
  <div className="flex flex-col gap-4 text-[14px] text-text-primary">
    <h2 className="text-[16px] font-semibold text-text-primary">Thuộc tính lớp tường</h2>
    <div className="flex flex-col gap-2">
      <div className="flex justify-between">
        <span className="text-text-secondary">Tổng diện tích</span>
        <span className="font-mono tabular-nums">248,60 m²</span>
      </div>
      <div className="flex justify-between">
        <span className="text-text-secondary">Số phòng</span>
        <span className="font-mono tabular-nums">48</span>
      </div>
      <div className="flex justify-between">
        <span className="text-text-secondary">Tường ngoài</span>
        <span className="font-mono tabular-nums">21 mm</span>
      </div>
      <div className="flex justify-between">
        <span className="text-text-secondary">Tường trong</span>
        <span className="font-mono tabular-nums">34 mm</span>
      </div>
      <div className="flex justify-between">
        <span className="text-text-secondary">Số đối tượng</span>
        <span className="font-mono tabular-nums">14 · 4 loại</span>
      </div>
    </div>
  </div>
);

// ── Helper ─────────────────────────────────────────────────────────────────────

function DrawerStory({ size, initialOpen = true }: { size?: 320 | 400; initialOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  return (
    <div className="relative h-screen w-screen bg-bg-app flex items-center justify-center">
      <Button variant="secondary" onClick={() => setIsOpen(true)}>
        Mở drawer
      </Button>
      <Drawer.Root isOpen={isOpen} onClose={() => setIsOpen(false)} size={size}>
        <Drawer.Handle />
        <Drawer.Header>
          <h2 className="text-[16px] font-semibold text-text-primary">Chi tiết lớp</h2>
        </Drawer.Header>
        <Drawer.Body>
          <DrawerContent />
        </Drawer.Body>
      </Drawer.Root>
    </div>
  );
}

// ── 1. Open320 ────────────────────────────────────────────────────────────────

export const Open320: Story = {
  render: () => <DrawerStory size={320} initialOpen />,
  parameters: {
    viewport: { defaultViewport: 'desktop' },
    docs: { description: { story: 'Drawer nhỏ 320px — mở sẵn. Đổi viewport < 1024px để thấy bottom-sheet.' } },
  },
};

// ── 2. Open400 ────────────────────────────────────────────────────────────────

export const Open400: Story = {
  render: () => <DrawerStory size={400} initialOpen />,
  parameters: {
    viewport: { defaultViewport: 'desktop' },
    docs: { description: { story: 'Drawer lớn 400px (mặc định) — mở sẵn.' } },
  },
};

// ── 3. Closed ─────────────────────────────────────────────────────────────────

export const Closed: Story = {
  render: () => <DrawerStory size={400} initialOpen={false} />,
  parameters: {
    viewport: { defaultViewport: 'desktop' },
    docs: { description: { story: 'Trạng thái đóng — nhấn nút để mở.' } },
  },
};
