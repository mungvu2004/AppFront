import { useState, useCallback, useEffect } from 'react';

export interface ContextMenuItem {
  id: string;
  label: string;
  kbd?: string | undefined;
  isDestructive?: boolean | undefined;
  isDisabled?: boolean | undefined;
  action: () => void;
}

export interface ContextMenuGroup {
  id: string;
  items: ContextMenuItem[];
}

export interface ContextMenuState {
  isVisible: boolean;
  position: { x: number; y: number };
  groups: ContextMenuGroup[];
  openMenu: (x: number, y: number, groups: ContextMenuGroup[]) => void;
  openMenuFlat: (x: number, y: number, items: ContextMenuItem[]) => void;
  closeMenu: () => void;
}

/**
 * Hook thuần — quản lý context menu: position, groups, keyboard dismiss.
 */
export function useContextMenu(): ContextMenuState {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [groups, setGroups] = useState<ContextMenuGroup[]>([]);

  const openMenu = useCallback((x: number, y: number, newGroups: ContextMenuGroup[]) => {
    setPosition({ x, y });
    setGroups(newGroups);
    setIsVisible(true);
  }, []);

  const openMenuFlat = useCallback(
    (x: number, y: number, items: ContextMenuItem[]) => openMenu(x, y, [{ id: 'default', items }]),
    [openMenu]
  );

  const closeMenu = useCallback(() => setIsVisible(false), []);

  useEffect(() => {
    if (!isVisible) return;
    const handle = () => closeMenu();
    const raf = requestAnimationFrame(() => {
      window.addEventListener('click', handle);
      window.addEventListener('contextmenu', handle);
    });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('click', handle);
      window.removeEventListener('contextmenu', handle);
    };
  }, [isVisible, closeMenu]);

  useEffect(() => {
    if (!isVisible) return;
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') closeMenu(); };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [isVisible, closeMenu]);

  return { isVisible, position, groups, openMenu, openMenuFlat, closeMenu };
}
