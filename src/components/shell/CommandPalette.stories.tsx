import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { CommandPalette } from './CommandPalette';
import { useCommandPalette } from '../../hooks/useCommandPalette';

/**
 * LƯU Ý — MODULE TRÙNG LẶP (khiếm khuyết D8, ghi trong sổ theo dõi riêng).
 *
 * `src/components/shell/CommandPalette.tsx` chỉ dài 5 dòng: nó tái xuất thẳng
 * `src/components/overlay/CommandPalette.tsx` (260 dòng, có bộ story đầy đủ ở
 * `overlay/CommandPalette.stories.tsx` — Open, WithQuery, EmptyState, Closed).
 * File này KHÔNG gộp hay xoá gì — chỉ thêm story tối thiểu cho đúng yêu cầu R-50
 * rằng mọi component phải có `*.stories.tsx` đi kèm.
 */
const meta: Meta = {
  title: 'shell/CommandPalette',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Lớp tái xuất của `overlay/CommandPalette` — xem ghi chú trùng lặp ở đầu file story này. Ma trận trạng thái đầy đủ (mở, có query, rỗng, đóng) nằm ở story "overlay/CommandPalette".',
      },
    },
  },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

function AutoOpenPalette() {
  const { open } = useCommandPalette();

  useEffect(() => {
    const raf = requestAnimationFrame(() => open());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  return (
    <div className="h-screen w-screen bg-bg-app flex items-center justify-center">
      <p className="text-[13px] text-text-muted select-none">
        Nhấn{' '}
        <kbd className="px-1.5 py-0.5 rounded-[4px] bg-bg-hover text-text-secondary font-mono text-[11px]">
          ⌘K
        </kbd>{' '}
        để mở lại
      </p>
      <CommandPalette />
    </div>
  );
}

export const Open: Story = {
  name: 'Mở (qua lớp tái xuất shell/)',
  render: () => <AutoOpenPalette />,
};

export const Closed: Story = {
  name: 'Đóng',
  render: () => (
    <div className="h-screen w-screen bg-bg-app flex items-center justify-center">
      <p className="text-[13px] text-text-muted select-none">
        Nhấn{' '}
        <kbd className="px-1.5 py-0.5 rounded-[4px] bg-bg-hover text-text-secondary font-mono text-[11px]">
          ⌘K
        </kbd>{' '}
        để mở bảng lệnh
      </p>
      <CommandPalette />
    </div>
  ),
};
