import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Kbd } from './Kbd';

export interface TooltipProps {
  label: string;
  kbd?: string;
  children: React.ReactElement;
  disabled?: boolean;
}

export function Tooltip({ label, kbd, children, disabled = false }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const handleMouseEnter = () => {
    if (disabled) return;
    timeoutRef.current = window.setTimeout(() => {
      setIsVisible(true);
    }, 400);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Tooltips never appear on disabled controls as per UX rules
  if (disabled) {
    return children;
  }

  return (
    <div 
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {children}
      
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0 } }}
            transition={{ duration: 0.12 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none"
          >
            <div className="flex items-center gap-2 bg-bg-surface rounded-[12px] shadow-float px-[12px] py-[8px] whitespace-nowrap">
              <span className="text-[13px] leading-[18px] text-text-primary">
                {label}
              </span>
              {kbd && <Kbd>{kbd}</Kbd>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
