import React, { createContext, useContext, useEffect, useRef, forwardRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

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
  width?: 480 | 560 | 640;
  /** ID cho aria-labelledby — mặc định tạo tự động */
  titleId?: string;
}

function ModalRoot({ isOpen, onClose, children, width = 480, titleId: externalTitleId }: ModalRootProps) {
  const prefersReducedMotion = useReducedMotion();
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const autoTitleId = React.useId();
  const titleId = externalTitleId || `modal-title-${autoTitleId}`;

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement;
    modalRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
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
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  const overlayVariants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
  const modalVariants = {
    hidden: prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 },
    visible: prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 },
    exit: prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 },
  };

  return (
    <ModalContext.Provider value={{ onClose, titleId }}>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
            <motion.div
              initial="hidden" animate="visible" exit="hidden"
              variants={overlayVariants}
              transition={{ duration: 0.26 }}
              className="absolute inset-0 bg-bg-overlay pointer-events-auto"
              onClick={onClose}
              aria-hidden="true"
            />
            <motion.div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              initial="hidden" animate="visible" exit="exit"
              variants={modalVariants}
              transition={{ duration: prefersReducedMotion ? 0.12 : 0.26 }}
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
  /** Nếu true, render close button ở phải */
  showClose?: boolean;
}

const ModalHeader = forwardRef<HTMLDivElement, ModalHeaderProps>(
  ({ children, showClose = true, className, ...props }, ref) => {
    const { onClose, titleId } = useModalContext('Modal.Header');
    return (
      <div
        ref={ref}
        className={cn('flex items-center justify-between px-[32px] pt-[32px] pb-[16px]', className)}
        {...props}
      >
        <h2 id={titleId} className="text-[20px] font-semibold text-text-primary">
          {children}
        </h2>
        {showClose && (
          <button
            onClick={onClose}
            aria-label="Đóng hộp thoại"
            className="w-[32px] h-[32px] flex items-center justify-center rounded-full text-text-secondary hover:bg-bg-hover transition-colors duration-120 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 -mr-2"
          >
            <X size={20} />
          </button>
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
      className={cn('px-[32px] overflow-y-auto flex-1', className)}
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
      className={cn('flex items-center justify-between px-[32px] py-[24px] mt-4 border-t border-border-hairline', className)}
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
      <button
        ref={ref}
        type="button"
        onClick={onClose}
        className={cn(
          'px-4 py-2 rounded-[8px] text-[14px] font-medium text-text-secondary hover:bg-bg-hover',
          'transition-colors duration-120 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
ModalCloseButton.displayName = 'Modal.CloseButton';

// ─── Namespace ────────────────────────────────────────────────────────────────

export const Modal = Object.assign(
  // Legacy API — backward compatible
  function ModalLegacy({ isOpen, onClose, title, width = 480, children, primaryAction, secondaryAction }: LegacyModalProps) {
    return (
      <ModalRoot isOpen={isOpen} onClose={onClose} width={width}>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody>{children}</ModalBody>
        {(primaryAction || secondaryAction) && (
          <ModalFooter>
            <div>
              {secondaryAction && (
                <button
                  onClick={secondaryAction.onClick}
                  disabled={secondaryAction.disabled}
                  className="px-4 py-2 rounded-[8px] text-[14px] font-medium text-text-secondary hover:bg-bg-hover transition-colors duration-120 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {secondaryAction.label}
                </button>
              )}
            </div>
            <div>
              {primaryAction && (
                <button
                  onClick={primaryAction.onClick}
                  disabled={primaryAction.disabled || primaryAction.loading}
                  className="px-4 py-2 rounded-[8px] text-[14px] font-medium bg-accent text-white hover:bg-accent-hover transition-colors duration-120 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {primaryAction.label}
                </button>
              )}
            </div>
          </ModalFooter>
        )}
      </ModalRoot>
    );
  },
  {
    Root: ModalRoot,
    Header: ModalHeader,
    Body: ModalBody,
    Footer: ModalFooter,
    CloseButton: ModalCloseButton,
  }
);

// ─── Legacy Types ─────────────────────────────────────────────────────────────

export interface LegacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  width?: 480 | 560 | 640;
  children: React.ReactNode;
  primaryAction?: { label: string; onClick: () => void; disabled?: boolean; loading?: boolean };
  secondaryAction?: { label: string; onClick: () => void; disabled?: boolean };
}

export type { LegacyModalProps as ModalProps };
