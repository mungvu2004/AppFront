/**
 * Bảng phím tắt của vỏ ứng dụng thật — mở bằng `?`, đóng bằng `?` hoặc Esc.
 *
 * ## Vì sao KHÔNG dùng lại `ShortcutHelp.tsx`
 *
 * `components/shell/ShortcutHelp.tsx` đã có sẵn đúng khuôn (Kbd, focus trap,
 * lớp phủ) nhưng nó thuộc về `AppShell` — vỏ của bảy màn demo trong
 * `src/App.tsx`, không phải ba mươi route thật (`src/routes/router.tsx`) —
 * và danh sách của nó (`SHORTCUT_GROUPS`) là **viết tay**: đúng thứ nguồn
 * thứ hai mà đặc tả K1 cấm ("đọc từ chính shortcutRegistry, không phải một
 * danh sách viết tay sẽ lệch"). Sửa lại danh sách viết tay đó có nguy cơ làm
 * lệch mô tả trong `ShortcutHelp.stories.tsx` của bản demo mà không phải việc
 * của lượt này. Nên thành phần này CHÉP khuôn (lớp phủ, focus trap, Kbd,
 * `useShortcut` phạm vi `dialog`) sang một bản dựng riêng cho vỏ thật, đọc
 * danh sách qua `appShortcutRegistry.listShortcuts()` — hàm mới thêm ở
 * `shortcutRegistry.ts` đúng cho việc này.
 *
 * ## Chỉ hiện thứ ĐANG đăng ký
 *
 * Danh sách tính lại mỗi lần mở, chia theo phạm vi: một phím `canvas` (ví dụ
 * Ctrl+F của `ObjectSearch`) chỉ hiện khi màn xem mô hình đang gắn — đúng
 * tinh thần "liệt kê phím tắt ĐANG ĐƯỢC ĐĂNG KÝ". Phạm vi `dialog` bị bỏ qua:
 * khi bảng này đang mở, mục `dialog` DUY NHẤT có thể có là hai binding đóng
 * của chính nó — tự liệt kê chính mình không giúp được ai, và (như
 * `shortcutRegistry.ts` viết) một phạm vi `dialog` khác đang mở sẽ nuốt `?`
 * trước khi nó tới được đây, nên tình huống ấy không xảy ra.
 *
 * ## Esc đóng được nó (A12)
 *
 * Hai binding phạm vi `dialog` dưới đây — Esc và `?` lần hai — làm tầng
 * `dialog` thành modal chừng nào bảng còn mở, đúng cơ chế
 * `shortcutRegistry.ts` dùng cho `Modal.tsx`/`Drawer.tsx`: phím công cụ phía
 * sau bị nuốt, còn Esc luôn được nghe (ngoại lệ dành riêng cho Escape ở
 * `handleKeyDown`).
 */
import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

import { AnimatePresence, motion } from '@/components/motion';
import { IconButton } from '@/components/ui/IconButton';
import { Kbd } from '@/components/ui/Kbd';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useShortcut } from '@/hooks/useShortcut';
import { createFocusTrap } from '@/lib/input/focusTrap';
import {
  appShortcutRegistry,
  type RegisteredShortcut,
  type ShortcutScope,
} from '@/lib/input/shortcutRegistry';
import { DURATION, EASE } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { Z_INDEX } from '@/lib/zIndex';

/** Thứ tự hiển thị — toàn cục trước vì nó đúng ở mọi màn, `dialog` không vào bảng này. */
const DISPLAY_SCOPES: readonly Exclude<ShortcutScope, 'dialog'>[] = ['global', 'canvas', 'sidePanel'];

const SCOPE_LABELS: Readonly<Record<Exclude<ShortcutScope, 'dialog'>, string>> = {
  global: 'Toàn cục',
  canvas: 'Khung nhìn 3D',
  sidePanel: 'Bảng bên',
};

interface ShortcutHelpRow extends RegisteredShortcut {
  readonly description: string;
}

interface ShortcutHelpGroup {
  readonly scope: Exclude<ShortcutScope, 'dialog'>;
  readonly rows: readonly ShortcutHelpRow[];
}

const hasDescription = (row: RegisteredShortcut): row is ShortcutHelpRow =>
  row.description !== undefined;

/** Đọc registry sống — không có bản chép nào của danh sách này ở nơi khác. */
function buildGroups(): readonly ShortcutHelpGroup[] {
  const rows = appShortcutRegistry.listShortcuts().filter(hasDescription);

  return DISPLAY_SCOPES.map((scope) => ({
    scope,
    rows: rows.filter((row) => row.scope === scope),
  })).filter((group) => group.rows.length > 0);
}

export interface GlobalShortcutHelpProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function GlobalShortcutHelp({ isOpen, onClose }: GlobalShortcutHelpProps) {
  const prefersReducedMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = React.useId();

  // Việc MỞ bảng bằng phím `?` thuộc về vỏ (`routes/router.tsx` đăng ký `?`
  // phạm vi `global`). Ở đây chỉ đăng ký các phím ĐÓNG khi bảng đang mở; hai
  // binding scope 'dialog' này đồng thời làm tầng dialog thành modal.
  useShortcut(
    {
      id: 'globalShortcutHelp.close',
      combo: 'Escape',
      scope: 'dialog',
      preventDefault: false,
      onTrigger: onClose,
    },
    { enabled: isOpen },
  );
  useShortcut(
    { id: 'globalShortcutHelp.toggleClose', combo: '?', scope: 'dialog', onTrigger: onClose },
    { enabled: isOpen },
  );

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const container = dialogRef.current;

    if (!container) {
      return undefined;
    }

    const trap = createFocusTrap(container, { onEscape: onClose });
    const raf = requestAnimationFrame(() => trap.activate());

    return (): void => {
      cancelAnimationFrame(raf);
      trap.release();
    };
  }, [isOpen, onClose]);

  const groups = isOpen ? buildGroups() : [];

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
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={overlayVariants}
            transition={{ duration: DURATION.quick, ease: EASE.out }}
            className="absolute inset-0 bg-bg-overlay pointer-events-auto"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={dialogVariants}
            transition={{
              duration: prefersReducedMotion ? DURATION.fast : DURATION.default,
              ease: EASE.out,
            }}
            className={cn(
              'relative bg-bg-surface rounded-[16px] shadow-modal pointer-events-auto',
              'w-full max-w-[480px] max-h-[80vh] overflow-y-auto',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              'focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface',
            )}
          >
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

            <div className="px-6 pb-6 pt-4 flex flex-col gap-6">
              {groups.map((group) => (
                <section key={group.scope} aria-labelledby={`shortcut-group-${group.scope}`}>
                  <h3
                    id={`shortcut-group-${group.scope}`}
                    className="text-[11px] font-medium text-text-muted mb-3 select-none"
                  >
                    {SCOPE_LABELS[group.scope]}
                  </h3>
                  <dl className="flex flex-col gap-1">
                    {group.rows.map((row) => {
                      const keys = row.combo.split('+');

                      return (
                        <div key={row.id} className="flex items-center justify-between py-1.5">
                          <dt className="text-[13px] text-text-primary">{row.description}</dt>
                          <dd className="flex items-center gap-1">
                            {keys.map((key, index) => (
                              <React.Fragment key={key}>
                                <Kbd>{key}</Kbd>
                                {index < keys.length - 1 && (
                                  <span
                                    className="text-[11px] text-text-muted mx-0.5"
                                    aria-hidden="true"
                                  >
                                    +
                                  </span>
                                )}
                              </React.Fragment>
                            ))}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </section>
              ))}

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
