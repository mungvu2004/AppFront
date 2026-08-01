import type { Meta, StoryObj } from '@storybook/react';
import React, { useCallback } from 'react';
import { ContextMenu } from './ContextMenu';
import { useContextMenu } from '../../hooks/useContextMenu';

const meta: Meta<typeof ContextMenu> = {
  title: 'Canvas / ContextMenu',
  component: ContextMenu,
  parameters: {
    layout: 'fullscreen',
  },
};
export default meta;

function ContextMenuDemo() {
  const { isVisible, position, groups, openMenu, closeMenu } = useContextMenu();

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    openMenu(e.clientX, e.clientY, [
      {
        id: 'edit',
        items: [
          { id: 'copy',  label: 'Sao chép',   kbd: '⌘C',   action: () => {} },
          { id: 'paste', label: 'Dán',         kbd: '⌘V',   action: () => {} },
          { id: 'cut',   label: 'Cắt',         kbd: '⌘X',   action: () => {} },
        ],
      },
      {
        id: 'actions',
        items: [
          { id: 'approve', label: 'Phê duyệt',  kbd: 'A',    action: () => {} },
          { id: 'reject',  label: 'Từ chối',    kbd: 'R',    isDestructive: true, action: () => {} },
        ],
      },
      {
        id: 'danger',
        items: [
          { id: 'delete', label: 'Xoá phần tử', kbd: '⌫',   isDestructive: true, action: () => {} },
        ],
      },
    ]);
  }, [openMenu]);

  return (
    <div
      className="relative bg-canvas-2d flex items-center justify-center"
      style={{ width: 800, height: 500 }}
      onContextMenu={handleContextMenu}
    >
      <span className="font-mono text-sm text-text-muted">Chuột phải để mở menu</span>
      <ContextMenu isVisible={isVisible} position={position} groups={groups} onClose={closeMenu} />
    </div>
  );
}

export const WithGroups: StoryObj = {
  name: 'Nhóm + Kbd',
  render: () => <ContextMenuDemo />,
};
