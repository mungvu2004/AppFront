import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ShortcutHelp } from './ShortcutHelp';
import { Button } from '../ui/Button';

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: 'shell/ShortcutHelp',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Bảng phím tắt — mở bằng phím ? hoặc nút trợ giúp. Đóng bằng Esc, click overlay, hoặc nút ✕.',
      },
    },
  },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

// ── 1. Open ───────────────────────────────────────────────────────────────────

function OpenDemo() {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div className="h-screen w-screen bg-bg-app flex items-center justify-center">
      <Button variant="secondary" onClick={() => setIsOpen(true)}>
        Mở bảng phím tắt
      </Button>
      <ShortcutHelp isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
}

export const Open: Story = {
  render: () => <OpenDemo />,
  parameters: {
    docs: { description: { story: 'Bảng phím tắt đang mở — 3 nhóm: Công cụ, Chế độ xem, Hệ thống.' } },
  },
};

// ── 2. Closed ─────────────────────────────────────────────────────────────────

function ClosedDemo() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="h-screen w-screen bg-bg-app flex items-center justify-center">
      <Button variant="secondary" onClick={() => setIsOpen(true)}>
        Mở bảng phím tắt
      </Button>
      <ShortcutHelp isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
}

export const Closed: Story = {
  render: () => <ClosedDemo />,
  parameters: {
    docs: { description: { story: 'Trạng thái đóng — nhấn nút hoặc phím ? để mở.' } },
  },
};
