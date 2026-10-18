/** Nút "Thêm ▾" ở đầu màn Kiểm tra tầng: lối vào ba màn cấp dự án chưa có chỗ nào dẫn tới. */
import type { MouseEvent } from 'react';

import { ContextMenu } from '@/components/canvas/ContextMenu';
import { Button } from '@/components/ui/Button';
import { useContextMenu } from '@/hooks/useContextMenu';

import { PROJECT_MORE_SCREENS, type ProjectMoreScreen } from './floorManagerTypes';

export function ProjectMoreMenu({ onOpen }: { readonly onOpen: (screen: ProjectMoreScreen) => void }) {
  const menu = useContextMenu();

  const open = (event: MouseEvent) => {
    // Mở bằng phím thì clientX/Y = 0: neo menu vào chính nút.
    const anchor = event.currentTarget.getBoundingClientRect();
    menu.openMenu(anchor.left, anchor.bottom, [
      {
        id: 'project-screens',
        items: PROJECT_MORE_SCREENS.map((screen) => ({
          id: screen.id,
          label: screen.label,
          action: () => onOpen(screen.id),
        })),
      },
    ]);
  };

  return (
    <>
      <Button aria-haspopup="menu" aria-label="Các màn của dự án" onClick={open} size="sm" variant="ghost">
        Màn dự án ▾
      </Button>
      <ContextMenu groups={menu.groups} isVisible={menu.isVisible} onClose={menu.closeMenu} position={menu.position} />
    </>
  );
}
