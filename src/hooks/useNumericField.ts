import { useState, useEffect, useRef, useCallback } from 'react';

import { formatNumber, parseNumber } from '@/lib/format/number';
import { durationMs } from '@/lib/motion';

import { useCountUp } from './useCountUp';

/**
 * How long typing must stop before the value is committed.
 *
 * The same 800 ms as invariant A7's autosave, and for the same reason: it is how
 * long a person is given to keep typing, not how fast anything moves.
 */
const COMMIT_DEBOUNCE_MS = 800;

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

  // `from: value` mounts at rest; an external change then runs from the shown
  // value. A missing value maps to NaN, which the count-up treats as "no run".
  const { value: animatedValue } = useCountUp(value ?? Number.NaN, { from: value ?? Number.NaN });
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

  // The shared formatter, with one field-specific reading: an editable input
  // shows a missing value as an empty box, not as the read-only `—` placeholder.
  const displayText = (num: number | undefined): string =>
    num === undefined ? '' : formatNumber(num, { maxFractionDigits: 2 });

  const commit = useCallback((valStr: string) => {
    const parsed = parseNumber(valStr);
    const err = validate(parsed);
    setError(err);

    if (!err && parsed !== lastCommittedRef.current) {
      lastCommittedRef.current = parsed;
      onChange?.(parsed);
      setFlash(true);
      // The same off-ladder 400 ms `useListReview` carried, for the same kind
      // of commit flash. Both are now the ladder's slowest speed.
      setTimeout(() => setFlash(false), durationMs('slow'));
    }
    setIsTyping(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max, onChange]);

  useEffect(() => {
    if (isTyping) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        commit(localValue);
      }, COMMIT_DEBOUNCE_MS);
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
      setLocalValue(displayText(lastCommittedRef.current));
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
      setLocalValue(displayText(lastCommittedRef.current));
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
      
      const newStr = displayText(current);
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
    
    setLocalValue(displayText(current));
    setIsTyping(true);
    setError(validate(current));
    // Keep focus
    const input = e.currentTarget.parentElement?.querySelector('input');
    input?.focus();
  };

  const displayValue =
    isTyping || isFocused
      ? localValue
      : displayText(Number.isFinite(animatedValue) ? animatedValue : undefined);

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
