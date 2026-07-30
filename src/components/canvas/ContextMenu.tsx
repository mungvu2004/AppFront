import React from 'react';
import { ContextMenuItem } from './useContextMenu';

interface ContextMenuProps {
  isVisible: boolean;
  position: { x: number; y: number };
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ isVisible, position, items, onClose }: ContextMenuProps) {
  if (!isVisible) return null;

  return (
    <div
      className="absolute bg-bg-surface rounded-[12px] shadow-float py-1 z-50 flex flex-col min-w-[160px] animate-dropdown-open"
      style={{
        left: position.x,
        top: position.y,
      }}
      onContextMenu={(e) => {
        e.preventDefault(); // Prevent native menu over our menu
      }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          onClick={(e) => {
            e.stopPropagation();
            item.action();
            onClose();
          }}
          className={`h-[36px] px-4 flex items-center text-sm transition-colors hover:bg-bg-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent text-left ${
            item.isDestructive ? 'text-[var(--state-violation-text)]' : 'text-text-primary'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
