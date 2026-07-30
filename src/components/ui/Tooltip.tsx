import React, { useState, useRef, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Kbd } from './Kbd';

export interface TooltipProps {
  label: string;
  kbd?: string;
  children: React.ReactElement;
  disabled?: boolean;
  /** Hướng hiển thị tooltip. Mặc định: 'top' */
  side?: 'top' | 'bottom';
}

export function Tooltip({ label, kbd, children, disabled = false, side = 'top' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const timeoutRef = useRef<number | null>(null);
  const tooltipId = useId();

  const updateCoords = () => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setCoords({
      top: side === 'top'
        ? rect.top + window.scrollY - 8        // sẽ bị offset thêm bởi mb-2 trong motion
        : rect.bottom + window.scrollY + 8,
      left: rect.left + window.scrollX + rect.width / 2,
    });
  };

  const handleShow = () => {
    if (disabled) return;
    updateCoords();
    timeoutRef.current = window.setTimeout(() => setIsVisible(true), 400);
  };

  const handleHide = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (disabled) return children;

  const tooltipEl = (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          id={tooltipId}
          role="tooltip"
          initial={{ opacity: 0, y: side === 'top' ? 4 : -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0 } }}
          transition={{ duration: 0.12 }}
          className="pointer-events-none z-[9999]"
          style={{
            position: 'absolute',
            top: coords.top,
            left: coords.left,
            transform: side === 'top'
              ? 'translate(-50%, -100%) translateY(-8px)'
              : 'translate(-50%, 0)',
          }}
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
  );

  return (
    <>
      <span
        ref={wrapperRef}
        className="inline-flex"
        onMouseEnter={handleShow}
        onMouseLeave={handleHide}
        onFocus={handleShow}
        onBlur={handleHide}
        aria-describedby={isVisible ? tooltipId : undefined}
      >
        {children}
      </span>
      {typeof document !== 'undefined' && createPortal(tooltipEl, document.body)}
    </>
  );
}
