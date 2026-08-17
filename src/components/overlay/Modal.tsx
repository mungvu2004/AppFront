import React, { createContext, useContext, useEffect, useRef, forwardRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Z_INDEX } from '../../lib/zIndex';
import { DURATION, EASE } from '../../lib/motion';
import { useShortcut } from '../../hooks/useShortcut';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';

// ─── Context ──────────────────────────────────────────────────────────────────

interface ModalContextValue {
  onClose: () => void;
  titleId: string;
}

const ModalContext = createContext<ModalContextValue | null>(null);

function useModalContext(name: string) {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error(`<${name}> phải dùng bên trong <Modal.Root>`);
  return ctx;
}

// ─── Modal.Root ───────────────────────────────────────────────────────────────

export interface ModalRootProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Chiều rộng: 480 (nhỏ) | 560 (vừa) | 720 (lớn) */
  width?: 480 | 560 | 720;
  titleId?: string;
}

function ModalRoot({ isOpen, onClose, children, width = 480, titleId: externalTitleId }: ModalRootProps) {
  const prefersReducedMotion = useReducedMotion();
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const autoTitleId = React.useId();
  const titleId = externalTitleId || `modal-title-${autoTitleId}`;

  // Focus management: lưu focus cũ, đưa focus vào modal, trả lại khi đóng
  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement;
    // Delay để animation bắt đầu trước khi focus
    const raf = requestAnimationFrame(() => modalRef.current?.focus());

    return () => {
      cancelAnimationFrame(raf);
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  // Esc khi focus nằm ngoài modal (trường hợp hiếm) — qua trọng tài phím tắt.
  // Binding scope 'dialog' cũng là thứ làm tầng dialog thành modal: phím công
  // cụ (V/W/M/L…) phía sau bị nuốt chừng nào modal còn mở.
  useShortcut(
    { id: 'modal.close', combo: 'Escape', scope: 'dialog', preventDefault: false, onTrigger: onClose },
    { enabled: isOpen },
  );

  // Esc + bẫy Tab xử lý tại chính modal: focus đang ở trong modal (kể cả trong
  // ô nhập liệu) thì Esc vẫn đóng được, và stopPropagation để trọng tài không
  // xử lý cùng một phím lần thứ hai.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === 'Tab' && modalRef.current) {
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
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

  // Animation variants — slide lên 8px + fade, đúng spec
  const overlayVariants = {
    hidden:  { opacity: 0 },
    visible: { opacity: 1 },
  };

  const modalVariants = prefersReducedMotion
    ? {
        hidden:  { opacity: 0 },
        visible: { opacity: 1 },
        exit:    { opacity: 0 },
      }
    : {
        hidden:  { opacity: 0, y: 8 },
        visible: { opacity: 1, y: 0 },
        exit:    { opacity: 0, y: 8 },
      };

  return (
    <ModalContext.Provider value={{ onClose, titleId }}>
      <AnimatePresence>
        {isOpen && (
          <div
            className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
            style={{ zIndex: Z_INDEX.modal }}
          >
            {/* Lớp phủ */}
            <motion.div
              initial="hidden" animate="visible" exit="hidden"
              variants={overlayVariants}
              transition={{ duration: DURATION.default, ease: EASE.out }}
              className="absolute inset-0 bg-bg-overlay pointer-events-auto"
              onClick={onClose}
              aria-hidden="true"
            />

            {/* Modal */}
            <motion.div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              onKeyDown={handleKeyDown}
              initial="hidden" animate="visible" exit="exit"
              variants={modalVariants}
              transition={{
                duration: prefersReducedMotion ? DURATION.fast : DURATION.default,
                ease: EASE.out,
              }}
              className="relative bg-bg-surface rounded-[16px] shadow-modal pointer-events-auto flex flex-col max-h-[90vh] outline-none"
              style={{ width: `${width}px` }}
            >
              {children}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ModalContext.Provider>
  );
}
ModalRoot.displayName = 'Modal.Root';

// ─── Modal.Header ─────────────────────────────────────────────────────────────

export interface ModalHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  showClose?: boolean;
}

const ModalHeader = forwardRef<HTMLDivElement, ModalHeaderProps>(
  ({ children, showClose = true, className, ...props }, ref) => {
    const { onClose, titleId } = useModalContext('Modal.Header');
    return (
      <div
        ref={ref}
        className={cn('flex items-center justify-between px-8 pt-8 pb-4', className)}
        {...props}
      >
        <h2 id={titleId} className="text-[18px] font-semibold text-text-primary leading-tight">
          {children}
        </h2>
        {showClose && (
          <IconButton
            size="sm"
            icon={<X size={18} aria-hidden="true" />}
            aria-label="Đóng hộp thoại"
            onClick={onClose}
            tooltip={false}
            className="-mr-2"
          />
        )}
      </div>

    );
  }
);
ModalHeader.displayName = 'Modal.Header';

// ─── Modal.Body ───────────────────────────────────────────────────────────────

const ModalBody = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('px-8 overflow-y-auto flex-1 text-[14px] text-text-primary leading-relaxed', className)}
      {...props}
    >
      {children}
    </div>
  )
);
ModalBody.displayName = 'Modal.Body';

// ─── Modal.Footer ─────────────────────────────────────────────────────────────

const ModalFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center justify-end gap-3 px-8 py-6 mt-2 border-t border-border-default',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
ModalFooter.displayName = 'Modal.Footer';

// ─── Modal.CloseButton ────────────────────────────────────────────────────────

const ModalCloseButton = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ children, className, ...props }, ref) => {
    const { onClose } = useModalContext('Modal.CloseButton');
    return (
      <Button
        ref={ref}
        type="button"
        variant="ghost"
        onClick={onClose}
        className={className}
        {...props}
      >
        {children}
      </Button>
    );
  }
);
ModalCloseButton.displayName = 'Modal.CloseButton';

// ─── Namespace ────────────────────────────────────────────────────────────────

export const Modal = Object.assign(
  // Legacy API — backward compatible
  function ModalLegacy({
    isOpen,
    onClose,
    title,
    width = 480,
    children,
    primaryAction,
    secondaryAction,
  }: LegacyModalProps) {
    return (
      <ModalRoot isOpen={isOpen} onClose={onClose} width={width}>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody>{children}</ModalBody>
        {(primaryAction || secondaryAction) && (
          <ModalFooter>
            {secondaryAction && (
              <Button
                variant="ghost"
                onClick={secondaryAction.onClick}
                disabled={secondaryAction.disabled}
              >
                {secondaryAction.label}
              </Button>
            )}
            {primaryAction && (
              <Button
                variant="primary"
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled ?? false}
                loading={primaryAction.loading ?? false}
              >

                {primaryAction.label}
              </Button>
            )}
          </ModalFooter>
        )}
      </ModalRoot>
    );
  },
  {
    Root:        ModalRoot,
    Header:      ModalHeader,
    Body:        ModalBody,
    Footer:      ModalFooter,
    CloseButton: ModalCloseButton,
  }
);

// ─── Legacy Types ─────────────────────────────────────────────────────────────

export interface LegacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  width?: 480 | 560 | 720;
  children: React.ReactNode;
  primaryAction?: { label: string; onClick: () => void; disabled?: boolean; loading?: boolean };
  secondaryAction?: { label: string; onClick: () => void; disabled?: boolean };
}

export type { LegacyModalProps as ModalProps };
