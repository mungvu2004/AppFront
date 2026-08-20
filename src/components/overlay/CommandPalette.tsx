import React, { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { AnimatePresence, motion } from '../motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '../../lib/utils';
import { Kbd } from '../ui/Kbd';
import { Input } from '../ui/Input';
import {
  useCommandPalette,
  filterCommands,
  groupCommands,
} from '../../hooks/useCommandPalette';
import type { CommandItem } from '../../hooks/useCommandPalette';
import { useShortcut } from '../../hooks/useShortcut';
import { DURATION, EASE } from '../../lib/motion';

// Re-export để consumers dùng từ đây
export type { CommandItem };


// ─── Mock commands (sẽ được truyền từ ngoài vào) ──────────────────────────────

const DEFAULT_COMMANDS: CommandItem[] = [
  // Điều hướng
  { id: 'nav-walls',      group: 'Điều hướng', label: 'Đi đến lớp tường',     shortcut: 'W',   keywords: ['wall', 'tường'],  onSelect: () => {} },
  { id: 'nav-dims',       group: 'Điều hướng', label: 'Đi đến lớp kích thước', shortcut: 'M',   keywords: ['dim', 'kích thước'], onSelect: () => {} },
  { id: 'nav-2d',         group: 'Điều hướng', label: 'Chuyển sang chế độ 2D',  shortcut: '2',   onSelect: () => {} },
  { id: 'nav-3d',         group: 'Điều hướng', label: 'Chuyển sang chế độ 3D',  shortcut: '3',   onSelect: () => {} },
  // Hành động
  { id: 'act-undo',       group: 'Hành động',  label: 'Hoàn tác',              shortcut: '⌘Z',  onSelect: () => {} },
  { id: 'act-export',     group: 'Hành động',  label: 'Xuất bản bản vẽ',                        onSelect: () => {} },
  { id: 'act-new-floor',  group: 'Hành động',  label: 'Tạo tầng mới',                           onSelect: () => {} },
  // Hệ thống
  { id: 'sys-help',       group: 'Hệ thống',   label: 'Xem phím tắt',          shortcut: '?',   onSelect: () => {} },
  { id: 'sys-theme',      group: 'Hệ thống',   label: 'Chuyển giao diện sáng/tối', onSelect: () => {} },
];

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CommandPaletteProps {
  /** Danh sách lệnh tùy chỉnh — mặc định dùng DEFAULT_COMMANDS */
  commands?: CommandItem[];
}

// ─── CommandPalette View ──────────────────────────────────────────────────────

export function CommandPalette({ commands = DEFAULT_COMMANDS }: CommandPaletteProps) {
  const {
    isOpen, query, selectedIndex,
    open, close, handleQueryChange, setSelectedIndex, moveSelection, zIndex,
  } = useCommandPalette();

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const titleId = React.useId();

  // Cmd/Ctrl+K qua trọng tài phím tắt: mở là binding global, đóng là binding
  // scope 'dialog' (chỉ chạy khi focus không nằm trong ô nhập liệu — trường
  // hợp đang gõ trong ô tìm kiếm do handleKeyDown bên dưới xử lý). Binding
  // 'dialog' đồng thời làm tầng dialog thành modal khi palette mở.
  useShortcut(
    { id: 'commandPalette.open', combo: 'Ctrl+K', scope: 'global', onTrigger: open },
    { enabled: !isOpen },
  );
  useShortcut(
    { id: 'commandPalette.close', combo: 'Ctrl+K', scope: 'dialog', onTrigger: close },
    { enabled: isOpen },
  );
  useShortcut(
    { id: 'commandPalette.closeOnEscape', combo: 'Escape', scope: 'dialog', preventDefault: false, onTrigger: close },
    { enabled: isOpen },
  );

  // Focus input khi mở
  useEffect(() => {
    if (!isOpen) return;
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [isOpen]);

  // Lọc và nhóm kết quả
  const filtered = filterCommands(commands, query);
  const groups   = groupCommands(filtered);
  const flatItems = filtered; // dùng để tính selectedIndex tuyến tính

  // Scroll item được chọn vào view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const selected = list.querySelector('[aria-selected="true"]') as HTMLElement | null;
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Đóng bằng Cmd/Ctrl+K ngay cả khi đang gõ trong ô tìm kiếm — trọng tài
    // vô hiệu phím tắt trong ô nhập liệu nên lớp này tự xử lý phím của mình.
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        moveSelection(1, flatItems.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveSelection(-1, flatItems.length);
        break;
      case 'Enter':
        e.preventDefault();
        flatItems[selectedIndex]?.onSelect();
        close();
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        close();
        break;
    }
  };

  // Animation variants
  const overlayVariants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
  const paletteVariants = prefersReducedMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } }
    : { hidden: { opacity: 0, y: -8, scale: 0.98 }, visible: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: -4, scale: 0.99 } };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 flex items-start justify-center pt-[15vh] pointer-events-none"
          style={{ zIndex }}
        >
          {/* Overlay */}
          <motion.div
            initial="hidden" animate="visible" exit="hidden"
            variants={overlayVariants}
            transition={{ duration: DURATION.quick, ease: EASE.out }}
            className="absolute inset-0 bg-bg-overlay pointer-events-auto"
            onClick={close}
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div
            initial="hidden" animate="visible" exit="exit"
            variants={paletteVariants}
            transition={{ duration: prefersReducedMotion ? DURATION.fast : DURATION.default, ease: EASE.out }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative w-full max-w-[560px] bg-bg-surface rounded-[16px] shadow-modal pointer-events-auto flex flex-col overflow-hidden"
            onKeyDown={handleKeyDown}
          >
            <h2 id={titleId} className="sr-only">Tìm kiếm lệnh và điều hướng</h2>

            {/* Input tìm kiếm */}
            <Input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-autocomplete="list"
              aria-controls="cmd-results"
              aria-activedescendant={flatItems[selectedIndex] ? `cmd-item-${flatItems[selectedIndex].id}` : undefined}
              prefix={<Search className="w-4 h-4" aria-hidden="true" />}
              suffix={<Kbd>Esc</Kbd>}
              placeholder="Tìm lệnh, dự án, tầng, lớp..."
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              wrapperClassName="px-3 pt-3 pb-2 border-b border-border-default shrink-0"
            />


            {/* Kết quả */}
            <div
              ref={listRef}
              id="cmd-results"
              role="listbox"
              aria-label="Kết quả tìm kiếm"
              className="overflow-y-auto p-2"
              style={{ maxHeight: '340px' }}
            >
              {flatItems.length === 0 ? (
                /* Trạng thái rỗng */
                <div className="py-10 text-center">
                  <p className="text-[14px] text-text-secondary mb-1">
                    Không tìm thấy "{query}"
                  </p>
                  <p className="text-[12px] text-text-muted">
                    Thử tìm: lớp tường, tầng, xuất bản, hoàn tác
                  </p>
                </div>
              ) : (
                groups.map(group => {

                    return (
                    <div key={group.key} className="mb-1" role="group" aria-label={group.label}>
                      {/* Nhãn nhóm — viết thường */}
                      <div className="px-3 py-1.5 text-[11px] font-medium text-text-muted select-none">
                        {group.label}
                      </div>

                      {group.items.map((item) => {
                        const flatIdx = flatItems.indexOf(item);
                        const isSelected = flatIdx === selectedIndex;

                        return (
                          <button
                            key={item.id}
                            id={`cmd-item-${item.id}`}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => { item.onSelect(); close(); }}
                            onMouseEnter={() => setSelectedIndex(flatIdx)}
                            className={cn(
                              'w-full text-left px-3 py-2 rounded-[8px]',
                              'text-[13px] text-text-primary',
                              'flex items-center justify-between gap-3',
                              'transition-colors duration-120',
                              'outline-none',
                              isSelected ? 'bg-bg-selected' : 'hover:bg-bg-hover'
                            )}
                          >
                            <span className="truncate">{item.label}</span>
                            {item.shortcut && (
                              <Kbd>{item.shortcut}</Kbd>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer gợi ý phím */}
            <div className="flex items-center gap-4 px-4 py-2 border-t border-border-default text-[11px] text-text-muted select-none">
              <span className="flex items-center gap-1">
                <Kbd>↑</Kbd><Kbd>↓</Kbd> Di chuyển
              </span>
              <span className="flex items-center gap-1">
                <Kbd>↵</Kbd> Chọn
              </span>
              <span className="flex items-center gap-1">
                <Kbd>Esc</Kbd> Đóng
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
