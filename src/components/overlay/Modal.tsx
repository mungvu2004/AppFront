import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  width?: 480 | 560 | 640;
  children: React.ReactNode;
  primaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
}

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  width = 480, 
  children,
  primaryAction,
  secondaryAction
}: ModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Focus trap setup - just focusing the modal container for now
      if (modalRef.current) {
        modalRef.current.focus();
      }
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        } else if (e.key === 'Tab') {
          // Basic focus trap
          if (!modalRef.current) return;
          const focusableElements = modalRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          const firstElement = focusableElements[0] as HTMLElement;
          const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              lastElement.focus();
              e.preventDefault();
            }
          } else {
            if (document.activeElement === lastElement) {
              firstElement.focus();
              e.preventDefault();
            }
          }
        }
      };
      
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        // Restore focus on unmount/close
        if (previousFocusRef.current) {
          previousFocusRef.current.focus();
        }
      };
    }
  }, [isOpen, onClose]);

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 }
  };

  const modalVariants = {
    hidden: prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 },
    visible: prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 },
    exit: prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
          <motion.div
            ref={overlayRef}
            initial="hidden"
            animate="visible"
            exit="hidden"
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
            aria-labelledby="modal-title"
            tabIndex={-1}
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalVariants}
            transition={{ 
              duration: prefersReducedMotion ? 0.12 : 0.26
            }}
            className="relative bg-bg-surface rounded-[16px] shadow-modal pointer-events-auto flex flex-col max-h-[90vh] outline-none"
            style={{ width: `${width}px` }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-[32px] pt-[32px] pb-[16px]">
              <h2 id="modal-title" className="text-[20px] font-semibold text-text-primary">
                {title}
              </h2>
              <button
                onClick={onClose}
                className="w-[32px] h-[32px] flex items-center justify-center rounded-full text-text-secondary hover:bg-bg-hover transition-colors duration-120 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 -mr-2"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Body */}
            <div className="px-[32px] overflow-y-auto flex-1">
              {children}
            </div>
            
            {/* Footer */}
            {(primaryAction || secondaryAction) && (
              <div className="flex items-center justify-between px-[32px] py-[24px] mt-4 border-t border-border-hairline">
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
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
