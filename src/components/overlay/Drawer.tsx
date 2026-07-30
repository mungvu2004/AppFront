import React, { createContext, useContext, useEffect, useRef, forwardRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/utils';

// ─── Media Query Hook ─────────────────────────────────────────────────────────

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);
  return matches;
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface DrawerContextValue {
  onClose: () => void;
  isMobile: boolean;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

function useDrawerContext(name: string) {
  const ctx = useContext(DrawerContext);
  if (!ctx) throw new Error(`<${name}> phải dùng bên trong <Drawer.Root>`);
  return ctx;
}

// ─── Drawer.Root ──────────────────────────────────────────────────────────────

export interface DrawerRootProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

function DrawerRoot({ isOpen, onClose, children }: DrawerRootProps) {
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    containerRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && containerRef.current) {
        const focusable = containerRef.current.querySelectorAll<HTMLElement>(
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

  const drawerVariants = {
    hidden: prefersReducedMotion ? { opacity: 0 } : { x: '100%', opacity: 1 },
    visible: prefersReducedMotion ? { opacity: 1 } : { x: 0, opacity: 1 },
    exit: prefersReducedMotion ? { opacity: 0 } : { x: '100%', opacity: 1 },
  };

  const sheetVariants = {
    hidden: prefersReducedMotion ? { opacity: 0 } : { y: '100%', opacity: 1 },
    visible: prefersReducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 },
    exit: prefersReducedMotion ? { opacity: 0 } : { y: '100%', opacity: 1 },
  };

  return (
    <DrawerContext.Provider value={{ onClose, isMobile }}>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-40 pointer-events-none flex justify-end">
            <motion.div
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={overlayVariants}
              transition={{ duration: 0.26 }}
              className="absolute inset-0 bg-bg-overlay pointer-events-auto"
              onClick={onClose}
              aria-hidden="true"
            />

            {!isMobile ? (
              <motion.div
                ref={containerRef}
                role="dialog"
                aria-modal="true"
                tabIndex={-1}
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={drawerVariants}
                transition={{ duration: prefersReducedMotion ? 0.12 : 0.34, ease: 'easeOut' }}
                className="relative w-[480px] my-[8px] mr-[8px] bg-bg-surface rounded-[16px] shadow-modal pointer-events-auto flex flex-col outline-none overflow-hidden"
              >
                <motion.div
                  className="flex-1 overflow-y-auto"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.12, duration: 0.22 }}
                >
                  {children}
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                ref={containerRef}
                role="dialog"
                aria-modal="true"
                tabIndex={-1}
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={sheetVariants}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={0.2}
                onDragEnd={(_e, { offset, velocity }) => {
                  if (offset.y > 100 || velocity.y > 500) onClose();
                }}
                className="absolute bottom-0 left-0 right-0 h-[90vh] bg-bg-surface rounded-t-[16px] shadow-modal pointer-events-auto flex flex-col outline-none"
              >
                {children}
              </motion.div>
            )}
          </div>
        )}
      </AnimatePresence>
    </DrawerContext.Provider>
  );
}
DrawerRoot.displayName = 'Drawer.Root';

// ─── Drawer.Handle ────────────────────────────────────────────────────────────

const DrawerHandle = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { isMobile } = useDrawerContext('Drawer.Handle');
    if (!isMobile) return null;
    return (
      <div
        ref={ref}
        className={cn(
          'w-full flex justify-center py-3 shrink-0 cursor-grab active:cursor-grabbing',
          className,
        )}
        aria-hidden="true"
        {...props}
      >
        <div className="w-[40px] h-[4px] rounded-full bg-border-default" />
      </div>
    );
  },
);
DrawerHandle.displayName = 'Drawer.Handle';

// ─── Drawer.Header ────────────────────────────────────────────────────────────

const DrawerHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className, ...props }, ref) => (
    <div ref={ref} className={cn('px-[32px] pt-[24px] pb-[16px] shrink-0', className)} {...props}>
      {children}
    </div>
  ),
);
DrawerHeader.displayName = 'Drawer.Header';

// ─── Drawer.Body ──────────────────────────────────────────────────────────────

const DrawerBody = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex-1 overflow-y-auto px-[32px] pb-[32px]', className)}
      {...props}
    >
      {children}
    </div>
  ),
);
DrawerBody.displayName = 'Drawer.Body';

// ─── Namespace ────────────────────────────────────────────────────────────────

export const Drawer = Object.assign(
  // Legacy API — backward compatible: <Drawer isOpen={...} onClose={...}>{children}</Drawer>
  function DrawerLegacy({ isOpen, onClose, children }: LegacyDrawerProps) {
    return (
      <DrawerRoot isOpen={isOpen} onClose={onClose}>
        <DrawerHandle />
        <DrawerBody>{children}</DrawerBody>
      </DrawerRoot>
    );
  },
  {
    Root: DrawerRoot,
    Handle: DrawerHandle,
    Header: DrawerHeader,
    Body: DrawerBody,
  },
);

// ─── Legacy Types ─────────────────────────────────────────────────────────────

export interface LegacyDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export type { LegacyDrawerProps as DrawerProps };
