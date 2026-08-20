import React, { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { CommandPalette } from './CommandPalette';
import { useCommandPalette } from '../../hooks/useCommandPalette';

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: 'overlay/CommandPalette',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'CommandPalette tự quản lý trạng thái isOpen qua useCommandPalette store. Mở bằng Cmd/Ctrl+K hoặc nút trong story. Đóng bằng Esc.',
      },
    },
  },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

// ── Helper: opener tự động khi mount ─────────────────────────────────────────

function AutoOpenPalette({ query = '' }: { query?: string }) {
  const { open, handleQueryChange } = useCommandPalette();

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      open();
      if (query) handleQueryChange(query);
    });
    return () => cancelAnimationFrame(raf);
    /* eslint-disable-next-line react-hooks/exhaustive-deps -- mở bảng lệnh đúng một lần
       sau khung hình đầu, và effect đã có hàm dọn `cancelAnimationFrame`. `open` cùng
       `handleQueryChange` đổi định danh mỗi render nên kê vào sẽ mở lại liên tục. */
  }, []);

  return (
    <div className="h-screen w-screen bg-bg-app flex items-center justify-center">
      <p className="text-[13px] text-text-muted select-none">
        Nhấn <kbd className="px-1.5 py-0.5 rounded-[4px] bg-bg-hover text-text-secondary font-mono text-[11px]">⌘K</kbd> để mở lại
      </p>
      <CommandPalette />
    </div>
  );
}

// ── Closed wrapper ─────────────────────────────────────────────────────────────

function ClosedPalette() {
  return (
    <div className="h-screen w-screen bg-bg-app flex items-center justify-center">
      <p className="text-[13px] text-text-muted select-none">
        Nhấn <kbd className="px-1.5 py-0.5 rounded-[4px] bg-bg-hover text-text-secondary font-mono text-[11px]">⌘K</kbd> để mở bảng lệnh
      </p>
      <CommandPalette />
    </div>
  );
}

// ── 1. Open (Cmd+K) ───────────────────────────────────────────────────────────

export const Open: Story = {
  render: () => <AutoOpenPalette />,
  parameters: {
    docs: { description: { story: 'Bảng lệnh mở sẵn — hiển thị toàn bộ lệnh mặc định nhóm theo chủ đề.' } },
  },
};

// ── 2. WithQuery ──────────────────────────────────────────────────────────────

export const WithQuery: Story = {
  render: () => <AutoOpenPalette query="tường" />,
  parameters: {
    docs: { description: { story: 'Đã nhập query "tường" — chỉ hiện kết quả liên quan.' } },
  },
};

// ── 3. EmptyState ─────────────────────────────────────────────────────────────

export const EmptyState: Story = {
  render: () => <AutoOpenPalette query="xyzabc123" />,
  parameters: {
    docs: { description: { story: 'Không tìm thấy kết quả — hiện trạng thái rỗng với gợi ý tìm kiếm.' } },
  },
};

// ── 4. Closed ─────────────────────────────────────────────────────────────────

export const Closed: Story = {
  render: () => <ClosedPalette />,
  parameters: {
    docs: { description: { story: 'Trạng thái đóng — nhấn ⌘K hoặc Ctrl+K để mở.' } },
  },
};
