import React, { useState, useRef, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Kbd } from './Kbd';
import { durationSeconds } from '../../lib/motion';

// ─── Tooltip ──────────────────────────────────────────────────────────────────
// Delay: 400ms. Nền text-primary, chữ trắng, 13px, bo 6px, bóng md, mũi nhọn.

export interface TooltipProps {
  label: string;
  kbd?: string;
  children: React.ReactElement;
  disabled?: boolean;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ label, kbd, children, disabled = false, side = 'top' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const timeoutRef = useRef<number | null>(null);
  const tooltipId = useId();

  const ARROW_SIZE = 6;
  const GAP = 8;

  const updateCoords = () => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const cx = rect.left + window.scrollX + rect.width / 2;
    const cy = rect.top + window.scrollY + rect.height / 2;

    switch (side) {
      case 'top':
        setCoords({ top: rect.top + window.scrollY - GAP, left: cx });
        break;
      case 'bottom':
        setCoords({ top: rect.bottom + window.scrollY + GAP, left: cx });
        break;
      case 'left':
        setCoords({ top: cy, left: rect.left + window.scrollX - GAP });
        break;
      case 'right':
        setCoords({ top: cy, left: rect.right + window.scrollX + GAP });
        break;
    }
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

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  if (disabled) return children;

  const getTransform = () => {
    switch (side) {
      case 'top':    return 'translate(-50%, -100%)';
      case 'bottom': return 'translate(-50%, 0)';
      case 'left':   return 'translate(-100%, -50%)';
      case 'right':  return 'translate(0, -50%)';
    }
  };

  const getMotionY = () => {
    if (side === 'top') return 4;
    if (side === 'bottom') return -4;
    return 0;
  };
  const getMotionX = () => {
    if (side === 'left') return 4;
    if (side === 'right') return -4;
    return 0;
  };

  // Arrow pseudo-element position
  const arrowClass = {
    top:    'bottom-[-5px] left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-0 border-t-text-primary',
    bottom: 'top-[-5px] left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-0 border-b-text-primary',
    left:   'right-[-5px] top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-0 border-l-text-primary',
    right:  'left-[-5px] top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-0 border-r-text-primary',
  }[side];

  const tooltipEl = (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          id={tooltipId}
          role="tooltip"
          initial={{ opacity: 0, y: getMotionY(), x: getMotionX() }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, transition: { duration: 0 } }}
          transition={{ duration: durationSeconds('instant') }}
          className="pointer-events-none z-[9999]"
          style={{
            position: 'absolute',
            top: coords.top,
            left: coords.left,
            transform: getTransform(),
          }}
        >
          {/* Tooltip body */}
          <div className="relative flex items-center gap-1.5 bg-text-primary text-white rounded-[6px] shadow-overlay px-2.5 py-1.5 whitespace-nowrap">
            <span className="text-[13px] leading-[18px]">{label}</span>
            {kbd && <Kbd className="bg-white/10 border-white/20 text-white">{kbd}</Kbd>}
            {/* Arrow */}
            <span
              className={`absolute w-0 h-0 border-[${ARROW_SIZE}px] border-solid ${arrowClass}`}
              aria-hidden="true"
              style={{
                borderWidth: ARROW_SIZE,
              }}
            />
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
