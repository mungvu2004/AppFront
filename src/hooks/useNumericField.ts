import { useState, useEffect, useRef, useCallback } from 'react';
import { useNumberTween } from './useNumberTween';

export interface UseNumericFieldProps {
  value?: number | undefined;
  onChange?: ((val: number | undefined) => void) | undefined;
  min?: number | undefined;
  max?: number | undefined;
}

export function useNumericField({ value, onChange, min, max }: UseNumericFieldProps) {
  const [localValue, setLocalValue] = useState<string>('');
  const [isFocused, setIsFocused] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  const tweenedValue = useNumberTween(value, 260);
  const timerRef = useRef<number | null>(null);
  const lastCommittedRef = useRef<number | undefined>(value);

  // Sync prop value to last committed when it changes from outside
  useEffect(() => {
    lastCommittedRef.current = value;
  }, [value]);

  const validate = (val: number | undefined): string | null => {
    if (val === undefined) return null;
    if (min !== undefined && val < min) return `Giá trị phải >= ${min}`;
    if (max !== undefined && val > max) return `Giá trị phải <= ${max}`;
    return null;
  };

  const parseNumber = (str: string): number | undefined => {
    if (!str.trim()) return undefined;
    // Handle Vietnamese locale: "4.250,50" -> "4250.50", or raw "4250"
    const normalized = str.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? undefined : parsed;
  };

  const formatNumber = (num: number | undefined): string => {
    if (num === undefined) return '';
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(num);
  };

  const commit = useCallback((valStr: string) => {
    const parsed = parseNumber(valStr);
    const err = validate(parsed);
    setError(err);

    if (!err && parsed !== lastCommittedRef.current) {
      lastCommittedRef.current = parsed;
      onChange?.(parsed);
      setFlash(true);
      setTimeout(() => setFlash(false), 400);
    }
    setIsTyping(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max, onChange]);

  useEffect(() => {
    if (isTyping) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        commit(localValue);
      }, 800);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [localValue, isTyping, commit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    setIsTyping(true);
    
    // Immediate validation feedback without committing
    const parsed = parseNumber(e.target.value);
    setError(validate(parsed));
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (!isTyping) {
      // When focusing without typing, just show the raw value of what was last committed, or keep formatted?
      // For editing, usually it's better to show raw or just let them edit the formatted one.
      // We will set local to formatted for simplicity of editing.
      setLocalValue(formatNumber(lastCommittedRef.current));
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (isTyping) {
      if (timerRef.current) clearTimeout(timerRef.current);
      commit(localValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (timerRef.current) clearTimeout(timerRef.current);
      setIsTyping(false);
      setLocalValue(formatNumber(lastCommittedRef.current));
      setError(null);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      let current = parseNumber(localValue) ?? lastCommittedRef.current ?? 0;
      const step = e.shiftKey ? 10 : 1;
      const delta = e.key === 'ArrowUp' ? step : -step;
      current += delta;
      
      // Clamp for arrow keys
      if (min !== undefined) current = Math.max(min, current);
      if (max !== undefined) current = Math.min(max, current);
      
      const newStr = formatNumber(current);
      setLocalValue(newStr);
      setIsTyping(true);
      setError(validate(current));
    }
  };

  const handleStepper = (direction: 1 | -1, e: React.MouseEvent) => {
    e.preventDefault();
    let current = parseNumber(localValue) ?? lastCommittedRef.current ?? 0;
    const step = e.shiftKey ? 10 : 1;
    current += direction * step;
    
    if (min !== undefined) current = Math.max(min, current);
    if (max !== undefined) current = Math.min(max, current);
    
    setLocalValue(formatNumber(current));
    setIsTyping(true);
    setError(validate(current));
    // Keep focus
    const input = e.currentTarget.parentElement?.querySelector('input');
    input?.focus();
  };

  const displayValue = isTyping || isFocused ? localValue : formatNumber(tweenedValue);

  return {
    displayValue,
    error,
    flash,
    handleChange,
    handleFocus,
    handleBlur,
    handleKeyDown,
    handleStepper
  };
}
