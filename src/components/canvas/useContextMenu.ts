import { useState, useCallback, useEffect } from 'react';

export interface ContextMenuItem {
  id: string;
  label: string;
  isDestructive?: boolean;
  action: () => void;
}

export function useContextMenu() {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [items, setItems] = useState<ContextMenuItem[]>([]);

  const openMenu = useCallback((x: number, y: number, menuItems: ContextMenuItem[]) => {
    setPosition({ x, y });
    setItems(menuItems);
    setIsVisible(true);
  }, []);

  const closeMenu = useCallback(() => {
    setIsVisible(false);
  }, []);

  // Close on global click
  useEffect(() => {
    if (!isVisible) return;
    
    const handleGlobalClick = () => closeMenu();
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [isVisible, closeMenu]);

  return {
    isVisible,
    position,
    items,
    openMenu,
    closeMenu,
  };
}
