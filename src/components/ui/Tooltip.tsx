import React, { useState, useRef, useEffect, useId, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from '../motion';
import { Kbd } from './Kbd';
import { durationSeconds } from '../../lib/motion';

/**
 * How long a pointer must rest before the tooltip appears.
 *
 * A dwell time, not a movement: it is the pause before the animation, so it is
 * not on the four-speed ladder and must not be shortened to one. Named rather
 * than typed inline so the number is a decision somebody can find and argue with.
 */
const TOOLTIP_DWELL_MS = 400;

/** Khoảng tối thiểu giữa tooltip và mép khung nhìn khi nó bị đẩy vào trong. */
const VIEWPORT_EDGE_PX = 8;

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
  const [shiftX, setShiftX] = useState(0);
  // Không đủ chỗ phía trên (anchor sát mép trên): lật xuống dưới, không để chữ ra ngoài khung nhìn.
  const [isFlipped, setIsFlipped] = useState(false);
  const placedSide = isFlipped && side === 'top' ? 'bottom' : side;
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);
  const tooltipId = useId();

  const ARROW_SIZE = 6;
  const GAP = 8;

  const updateCoords = (placed: typeof side = placedSide) => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const cx = rect.left + window.scrollX + rect.width / 2;
    const cy = rect.top + window.scrollY + rect.height / 2;

    switch (placed) {
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
    setIsFlipped(false);
    updateCoords(side);
    // Đo lại lúc hiện, không chỉ lúc bắt đầu chờ: anchor có thể còn đang trượt vào
    // (bánh răng nhận focus ngay khi ngăn thông báo mở) — toạ độ cũ làm tooltip rơi
    // ra ngoài khung nhìn (BUG-114).
    timeoutRef.current = window.setTimeout(() => {
      updateCoords(side);
      setIsVisible(true);
    }, TOOLTIP_DWELL_MS);
  };

  const handleHide = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsFlipped(false);
    setIsVisible(false);
  };

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  // Anchor sát mép phải/trái (bánh răng cuối ngăn thông báo): tooltip căn giữa sẽ tràn
  // ra ngoài và sinh thanh cuộn ngang — đẩy nó vào trong, mũi tên vẫn chỉ đúng anchor (BUG-114).
  useLayoutEffect(() => {
    const el = tipRef.current;
    // Hidden: nothing to place, and no state write — a hidden tooltip whose label changes
    // (an upload's percent) must not cost its screen an extra render per tick.
    if (!isVisible || !el) return;
    if (side === 'top' && !isFlipped && el.getBoundingClientRect().top < VIEWPORT_EDGE_PX) {
      setIsFlipped(true);
      updateCoords('bottom');
      return;
    }
    if (placedSide !== 'top' && placedSide !== 'bottom') {
      setShiftX(0);
      return;
    }
    const half = el.offsetWidth / 2;
    const centre = coords.left - window.scrollX;
    const max = document.documentElement.clientWidth - VIEWPORT_EDGE_PX - half;
    const clamped = Math.max(VIEWPORT_EDGE_PX + half, Math.min(centre, max));
    setShiftX(clamped - centre);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `updateCoords` đọc ref và `placedSide`, không phải giá trị phản ứng
  }, [isVisible, coords, side, isFlipped, label, kbd]);

  if (disabled) return children;

  const getTransform = () => {
    switch (placedSide) {
      case 'top':    return 'translate(-50%, -100%)';
      case 'bottom': return 'translate(-50%, 0)';
      case 'left':   return 'translate(-100%, -50%)';
      case 'right':  return 'translate(0, -50%)';
    }
  };

  const getMotionY = () => {
    if (placedSide === 'top') return 4;
    if (placedSide === 'bottom') return -4;
    return 0;
  };
  const getMotionX = () => {
    if (placedSide === 'left') return 4;
    if (placedSide === 'right') return -4;
    return 0;
  };

  // Arrow pseudo-element position
  const arrowClass = {
    top:    'bottom-[-5px] left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-0 border-t-text-primary',
    bottom: 'top-[-5px] left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-0 border-b-text-primary',
    left:   'right-[-5px] top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-0 border-l-text-primary',
    right:  'left-[-5px] top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-0 border-r-text-primary',
  }[placedSide];

  const tooltipEl = (
    <AnimatePresence>
      {isVisible && (
        <div
          key="tooltip"
          ref={tipRef}
          className="pointer-events-none z-[9999]"
          style={{
            position: 'absolute',
            top: coords.top,
            left: coords.left + shiftX,
            transform: getTransform(),
          }}
        >
          {/* `transform` của framer-motion ghi đè `transform` trên cùng phần tử, nên căn
              giữa (translate) nằm ở lớp ngoài và hoạt ảnh nằm ở lớp trong. */}
          <motion.div
            id={tooltipId}
            role="tooltip"
            initial={{ opacity: 0, y: getMotionY(), x: getMotionX() }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, transition: { duration: 0 } }}
            transition={{ duration: durationSeconds('instant') }}
          >
            {/* Tooltip body */}
            <div className="relative flex items-center gap-1.5 bg-text-primary text-white rounded-[6px] shadow-overlay px-2.5 py-1.5 whitespace-nowrap">
              <span className="text-[13px] leading-[18px]">{label}</span>
              {kbd && <Kbd className="bg-white-10 border-white-20 text-white">{kbd}</Kbd>}
              {/* Arrow */}
              <span
                className={`absolute w-0 h-0 border-[${ARROW_SIZE}px] border-solid ${arrowClass}`}
                aria-hidden="true"
                style={{
                  borderWidth: ARROW_SIZE,
                  ...(shiftX === 0 ? {} : { left: `calc(50% - ${String(shiftX)}px)` }),
                }}
              />
            </div>
          </motion.div>
        </div>
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
