import React, { useEffect, useRef, useId } from 'react';
import { useCommandPalette } from '../../hooks/useCommandPalette';
import { Search } from 'lucide-react';

export function CommandPalette() {
  const { isOpen, query, handleQueryChange, close } = useCommandPalette();
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const contentRef = useRef<HTMLDivElement>(null);

  // Focus input khi mở — dùng requestAnimationFrame thay setTimeout magic number
  useEffect(() => {
    if (!isOpen) return;
    const raf = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [isOpen]);

  // Tab focus trap + Escape handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key === 'Tab' && contentRef.current) {
        const focusable = contentRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { last?.focus(); e.preventDefault(); }
        } else {
          if (document.activeElement === last) { first?.focus(); e.preventDefault(); }
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-bg-overlay transition-opacity duration-260"
        onClick={close}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative bg-bg-surface w-full max-w-[560px] rounded-[16px] shadow-modal overflow-hidden flex flex-col animate-dropdown-open"
      >
        {/* Visually hidden title cho screen readers */}
        <h2 id={titleId} className="sr-only">Tìm kiếm lệnh và điều hướng</h2>

        <div className="flex items-center px-4 border-b border-border-default h-14 shrink-0">
          <Search className="w-5 h-5 text-text-muted mr-3" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls="command-palette-results"
            className="flex-1 bg-transparent border-none outline-none text-[15px] placeholder:text-text-muted text-text-primary"
            placeholder="Tìm kiếm lệnh, dự án, tầng, lớp..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
          />
          <kbd
            className="text-[12px] font-mono text-text-muted bg-bg-sunken px-1.5 py-0.5 rounded-[4px] border border-border-default"
            aria-label="Nhấn Esc để đóng"
          >
            Esc
          </kbd>
        </div>

        <div
          id="command-palette-results"
          role="listbox"
          aria-label="Kết quả tìm kiếm"
          className="max-h-[340px] overflow-y-auto p-2"
        >
          {/* Nhóm kết quả */}
          <div className="mb-2" role="group" aria-labelledby="cmd-group-projects">
            <div
              id="cmd-group-projects"
              className="px-3 py-1.5 text-[12px] font-medium text-text-secondary"
            >
              Dự án
            </div>
            <button
              role="option"
              aria-selected={false}
              className="w-full text-left px-3 py-2 text-[14px] text-text-primary rounded-[8px] hover:bg-bg-hover focus:bg-bg-selected focus:outline-none flex justify-between items-center group"
            >
              <span>Landmark 81</span>
              <span className="text-[12px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity duration-120">
                Mở
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
