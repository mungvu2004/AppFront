import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Kbd } from '../ui/Kbd';
import { IconButton } from '../ui/IconButton';
import { Z_INDEX } from '../../lib/zIndex';
import { DURATION, EASE } from '../../lib/motion';
import { useShortcut } from '../../hooks/useShortcut';


// ─── Dữ liệu phím tắt ────────────────────────────────────────────────────────

interface ShortcutEntry {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  entries: ShortcutEntry[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Công cụ',
    entries: [
      { keys: ['V'],   description: 'Chọn đối tượng' },
      { keys: ['W'],   description: 'Vẽ tường' },
      { keys: ['M'],   description: 'Thêm kích thước' },
      { keys: ['L'],   description: 'Cửa / lỗ mở' },
    ],
  },
  {
    title: 'Chế độ xem',
    entries: [
      { keys: ['2'],   description: 'Chuyển sang 2D' },
      { keys: ['3'],   description: 'Chuyển sang 3D' },
      { keys: ['['],   description: 'Thu nhỏ' },
      { keys: [']'],   description: 'Phóng to' },
    ],
  },
  {
    title: 'Hệ thống',
    entries: [
      { keys: ['⌘', 'K'], description: 'Mở bảng tìm kiếm lệnh' },
      { keys: ['⌘', 'Z'], description: 'Hoàn tác thay đổi' },
      { keys: ['?'],       description: 'Hiện bảng phím tắt này' },
      { keys: ['Esc'],     description: 'Đóng lớp hiện tại' },
    ],
  },
];

// ─── ShortcutHelp View ────────────────────────────────────────────────────────


export interface ShortcutHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutHelp({ isOpen, onClose }: ShortcutHelpProps) {
  const prefersReducedMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = React.useId();

  // Việc MỞ bảng bằng phím ? thuộc về shell (AppShell đăng ký '?' scope
  // global). Ở đây chỉ đăng ký các phím ĐÓNG khi bảng đang mở; hai binding
  // scope 'dialog' này đồng thời làm tầng dialog thành modal.
  useShortcut(
    { id: 'shortcutHelp.close', combo: 'Escape', scope: 'dialog', preventDefault: false, onTrigger: onClose },
    { enabled: isOpen },
  );
  useShortcut(
    { id: 'shortcutHelp.toggleClose', combo: '?', scope: 'dialog', onTrigger: onClose },
    { enabled: isOpen },
  );

  // Đưa focus vào dialog khi mở
  useEffect(() => {
    if (!isOpen) return;
    const raf = requestAnimationFrame(() => dialogRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [isOpen]);

  // Bẫy Tab xử lý tại chính dialog
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { last?.focus(); e.preventDefault(); }
    } else {
      if (document.activeElement === last) { first?.focus(); e.preventDefault(); }
    }
  };

  const overlayVariants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
  const dialogVariants = prefersReducedMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } }
    : { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 8 } };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
          style={{ zIndex: Z_INDEX.modal }}
        >
          {/* Overlay */}
          <motion.div
            initial="hidden" animate="visible" exit="hidden"
            variants={overlayVariants}
            transition={{ duration: DURATION.quick, ease: EASE.out }}
            className="absolute inset-0 bg-bg-overlay pointer-events-auto"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            initial="hidden" animate="visible" exit="exit"
            variants={dialogVariants}
            transition={{ duration: prefersReducedMotion ? DURATION.fast : DURATION.default, ease: EASE.out }}
            className={cn(
              'relative bg-bg-surface rounded-[16px] shadow-modal pointer-events-auto',
              'w-full max-w-[480px] max-h-[80vh] overflow-y-auto outline-none'
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 sticky top-0 bg-bg-surface border-b border-border-default">
              <h2 id={titleId} className="text-[16px] font-semibold text-text-primary">
                Phím tắt
              </h2>
              <IconButton
                size="sm"
                icon={<X size={18} aria-hidden="true" />}
                aria-label="Đóng bảng phím tắt"
                onClick={onClose}
                tooltip={false}
              />
            </div>


            {/* Nội dung */}
            <div className="px-6 pb-6 pt-4 flex flex-col gap-6">
              {SHORTCUT_GROUPS.map(group => (
                <section key={group.title} aria-labelledby={`shortcut-group-${group.title}`}>
                  <h3
                    id={`shortcut-group-${group.title}`}
                    className="text-[11px] font-medium text-text-muted mb-3 select-none"
                  >
                    {group.title}
                  </h3>
                  <dl className="flex flex-col gap-1">
                    {group.entries.map(entry => (
                      <div
                        key={entry.description}
                        className="flex items-center justify-between py-1.5"
                      >
                        <dt className="text-[13px] text-text-primary">{entry.description}</dt>
                        <dd className="flex items-center gap-1">
                          {entry.keys.map((key, i) => (
                            <React.Fragment key={i}>
                              <Kbd>{key}</Kbd>
                              {i < entry.keys.length - 1 && (
                                <span className="text-[11px] text-text-muted mx-0.5" aria-hidden="true">+</span>
                              )}
                            </React.Fragment>
                          ))}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}

              {/* Footer */}
              <p className="text-[11px] text-text-muted text-center pt-2 border-t border-border-default">
                Nhấn <Kbd>?</Kbd> hoặc <Kbd>Esc</Kbd> để đóng
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
