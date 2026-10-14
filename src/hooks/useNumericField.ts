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
  /** Named in the range message ("Giá trị không quá 10 m."), so a refusal says what it measures. */
  unit?: string | undefined;
  /**
   * Bump it when the caller writes a value that may equal the stored one ("Áp cho mọi tầng" twice): the
   * `value` effect sees no change then, so a refusal still typed in the box would stay. A new key drops it.
   */
  resetKey?: number | undefined;
  /** Pad to exactly this many decimals ("4,0"), so the box reads like a table cell beside it (BUG-306). */
  fractionDigits?: number | undefined;
}

export function useNumericField({ value, onChange, min, max, unit, resetKey, fractionDigits }: UseNumericFieldProps) {
  const [localValue, setLocalValue] = useState<string>('');
  const [isFocused, setIsFocused] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  // The value this field committed itself: it is shown as typed, not counted up from the old one (BUG-198).
  const [ownCommit, setOwnCommit] = useState<number | undefined | null>(null);

  // `from: value` mounts at rest; an external change then runs from the shown
  // value. A missing value maps to NaN, which the count-up treats as "no run".
  const { value: animatedValue } = useCountUp(value ?? Number.NaN, { from: value ?? Number.NaN });
  const timerRef = useRef<number | null>(null);
  const lastCommittedRef = useRef<number | undefined>(value);

  // Sync prop value to last committed when it changes from outside. A value
  // written from outside (an "apply to all", an undo) replaces whatever text
  // the field was still showing for a refusal, so the refusal goes with it.
  useEffect(() => {
    if (value !== lastCommittedRef.current) {
      setError(null);
      setOwnCommit(null);
    }
    lastCommittedRef.current = value;
  }, [value]);

  const resetKeyRef = useRef(resetKey);
  useEffect(() => {
    if (resetKey === resetKeyRef.current) return;
    resetKeyRef.current = resetKey;
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsTyping(false);
    setError(null);
  }, [resetKey]);

  // A sentence with the unit, not a bare operator: "Giá trị phải <= 10" told
  // nobody what was measured (BUG-160).
  const bound = (limit: number): string => `${formatNumber(limit)}${unit === undefined ? '' : ` ${unit}`}`;
  const validate = (val: number | undefined, text = ''): string | null => {
    // G61: chữ không phải số thì nói ra, không im lặng (ô trống vẫn là "xoá giá trị").
    if (val === undefined) return text.trim() === '' ? null : 'Nhập một số.';
    if (min !== undefined && val < min) return `Giá trị không nhỏ hơn ${bound(min)}.`;
    if (max !== undefined && val > max) return `Giá trị không quá ${bound(max)}.`;
    return null;
  };

  // The shared formatter, with one field-specific reading: an editable input
  // shows a missing value as an empty box, not as the read-only `—` placeholder.
  const displayText = (num: number | undefined): string =>
    num === undefined ? '' : formatNumber(num, fractionDigits === undefined ? { maxFractionDigits: 2 } : { fractionDigits });

  const commit = useCallback((valStr: string) => {
    const parsed = parseNumber(valStr);
    const err = validate(parsed, valStr);
    setError(err);

    if (!err && parsed !== lastCommittedRef.current) {
      lastCommittedRef.current = parsed;
      setOwnCommit(parsed);
      onChange?.(parsed);
      setFlash(true);
      // The same off-ladder 400 ms `useListReview` carried, for the same kind
      // of commit flash. Both are now the ladder's slowest speed.
      setTimeout(() => setFlash(false), durationMs('slow'));
    }
    setIsTyping(false);
    /* eslint-disable-next-line react-hooks/exhaustive-deps -- thân hàm gọi `validate`,
       một hàm thường được dựng lại mỗi render và chỉ đọc `min` với `max`. Mảng phụ
       thuộc kê thẳng hai giá trị đó, tức ĐÚNG tập phụ thuộc thật mà luật không nhìn
       xuyên qua `validate` để thấy (`unit` cũng vậy, qua `bound`). Kê `validate` vào thì `commit` đổi định danh mỗi
       render và `useCallback` mất tác dụng. */
  }, [min, max, unit, onChange]);

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
    setError(validate(parsed, e.target.value));
  };

  const handleFocus = () => {
    setIsFocused(true);
    // Coming back to a refused value keeps it as typed, beside its message (BUG-160): swapping in
    // the stored value left "3" next to "Giá trị không quá 10 m." and raced the next keystrokes
    // ("2.500" became "32.500", BUG-198). Otherwise the field edits what was last committed.
    if (!isTyping && error === null) {
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

  // A refused value stays in the box beside its message (BUG-160): blanking it
  // left the error under a field that looked empty. Only a value written from
  // outside counts up: counting the user's own "2" down from 3,5 made a Tab
  // straight back swap "2,6" for "2" and drop the keyboard select-all, so "10"
  // typed next read "210" (BUG-198, run-17).
  const shown = value === ownCommit ? value : Number.isFinite(animatedValue) ? animatedValue : undefined;
  const displayValue = isTyping || isFocused || error !== null ? localValue : displayText(shown);

  return {
    displayValue,
    error,
    flash,
    handleChange,
    handleFocus,
    handleBlur,
    handleKeyDown,
  };
}
