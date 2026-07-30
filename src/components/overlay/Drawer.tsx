import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
}

export function Drawer({ isOpen, onClose, children }: DrawerProps) {
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      if (containerRef.current) {
        containerRef.current.focus();
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
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

  const drawerVariants = {
    hidden: prefersReducedMotion 
      ? { opacity: 0 } 
      : { x: '100%', opacity: 1 },
    visible: prefersReducedMotion 
      ? { opacity: 1 } 
      : { x: 0, opacity: 1 },
    exit: prefersReducedMotion 
      ? { opacity: 0 } 
      : { x: '100%', opacity: 1 }
  };

  const sheetVariants = {
    hidden: prefersReducedMotion 
      ? { opacity: 0 } 
      : { y: '100%', opacity: 1 },
    visible: prefersReducedMotion 
      ? { opacity: 1 } 
      : { y: 0, opacity: 1 },
    exit: prefersReducedMotion 
      ? { opacity: 0 } 
      : { y: '100%', opacity: 1 }
  };

  return (
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
            // Right Drawer
            <motion.div
              ref={containerRef}
              role="dialog"
              aria-modal="true"
              tabIndex={-1}
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={drawerVariants}
              transition={{ 
                duration: prefersReducedMotion ? 0.12 : 0.34,
                ease: "easeOut"
              }}
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
            // Bottom Sheet
            <motion.div
              ref={containerRef}
              role="dialog"
              aria-modal="true"
              tabIndex={-1}
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={sheetVariants}
              transition={{ 
                type: "spring",
                damping: 25,
                stiffness: 200
              }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={(e, { offset, velocity }) => {
                if (offset.y > 100 || velocity.y > 500) {
                  onClose();
                }
              }}
              className="absolute bottom-0 left-0 right-0 h-[90vh] bg-bg-surface rounded-t-[16px] shadow-modal pointer-events-auto flex flex-col outline-none"
            >
              <div className="w-full flex justify-center py-3 shrink-0 cursor-grab active:cursor-grabbing">
                <div className="w-[40px] h-[4px] rounded-full bg-border-default" />
              </div>
              <div className="flex-1 overflow-y-auto px-[32px] pb-[32px]">
                {children}
              </div>
            </motion.div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
}
