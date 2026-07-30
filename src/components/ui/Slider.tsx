import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface SliderProps {
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  readOnly?: boolean;
  endLabels?: [string, string];
  'aria-label'?: string;
}

export function Slider({
  min = 0,
  max = 100,
  step = 1,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  endLabels,
  'aria-label': ariaLabel,
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled || readOnly) return;
    setIsDragging(true);
    updateValue(e.clientX);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    updateValue(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const updateValue = (clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const rawValue = pos * (max - min) + min;
    const steppedValue = Math.round(rawValue / step) * step;
    const clampedValue = Math.max(min, Math.min(max, steppedValue));
    onChange(clampedValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || readOnly) return;
    let newValue = value;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      newValue = Math.min(max, value + step);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      newValue = Math.max(min, value - step);
    } else if (e.key === 'Home') {
      newValue = min;
    } else if (e.key === 'End') {
      newValue = max;
    }
    if (newValue !== value) {
      e.preventDefault();
      onChange(newValue);
    }
  };

  return (
    <div
      className={`relative flex items-center w-full h-8 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="group"
      aria-disabled={disabled}
    >
      {endLabels && (
        <span className="font-mono text-[13px] leading-none text-text-secondary mr-3 select-none">
          {endLabels[0]}
        </span>
      )}

      <div className="relative flex-1 flex items-center h-full" ref={trackRef}>
        {/* Track */}
        <div className="absolute w-full h-1 rounded-full bg-bg-sunken" />
        
        {/* Filled */}
        <div 
          className={`absolute h-1 rounded-full ${disabled ? 'bg-text-muted' : 'bg-accent'}`}
          style={{ width: `${percentage}%` }}
        />

        {/* Knob */}
        <div
          className="absolute flex items-center justify-center outline-none"
          style={{ left: `${percentage}%`, transform: 'translateX(-50%)' }}
        >
          <div
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            aria-label={ariaLabel || 'Slider'}
            aria-readonly={readOnly}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            className={`w-4 h-4 rounded-full bg-bg-surface border border-border-default shadow-rest outline-none ${
              isFocused ? 'ring-2 ring-accent ring-offset-2' : ''
            }`}
          />
          
          {/* Live value pill */}
          <AnimatePresence>
            {isDragging && !disabled && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.9 }}
                transition={{ duration: 0.12 }}
                className="absolute bottom-6 font-mono text-[13px] bg-bg-surface text-text-primary px-2 py-1 rounded shadow-float whitespace-nowrap pointer-events-none select-none border border-border-default"
              >
                {Number.isInteger(value) ? value : value.toFixed(2)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {endLabels && (
        <span className="font-mono text-[13px] leading-none text-text-secondary ml-3 select-none">
          {endLabels[1]}
        </span>
      )}
    </div>
  );
}
