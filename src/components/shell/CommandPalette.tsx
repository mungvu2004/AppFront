import React, { useEffect, useRef } from 'react';
import { useCommandPalette } from '../../hooks/useCommandPalette';
import { Search } from 'lucide-react';

export function CommandPalette() {
  const { isOpen, query, handleQueryChange, close } = useCommandPalette();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Overlay - fades in 260ms */}
      <div 
        className="fixed inset-0 bg-bg-overlay transition-opacity duration-260"
        onClick={close}
      />
      
      {/* Modal - animates in 180ms */}
      <div 
        className="relative bg-bg-surface w-full max-w-[560px] rounded-[16px] shadow-modal overflow-hidden flex flex-col animate-dropdown-open"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center px-4 border-b border-border-default h-14 shrink-0">
          <Search className="w-5 h-5 text-text-muted mr-3" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-[15px] placeholder:text-text-muted text-text-primary"
            placeholder="Search projects, floors, layers, objects..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
          />
          <div className="text-[12px] font-mono text-text-muted bg-bg-sunken px-1.5 py-0.5 rounded-[4px]">Esc</div>
        </div>

        <div className="max-h-[340px] overflow-y-auto p-2">
          {/* Example Group */}
          <div className="mb-2">
            <div className="px-3 py-1.5 text-[12px] font-medium text-text-secondary capitalize-first">
              Projects
            </div>
            <button className="w-full text-left px-3 py-2 text-[14px] text-text-primary rounded-[8px] hover:bg-bg-hover focus:bg-bg-selected focus:outline-none flex justify-between items-center group">
              <span>Landmark 81</span>
              <span className="text-[12px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">Jump</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
