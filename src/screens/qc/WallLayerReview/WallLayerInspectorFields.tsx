/** Hai ô nhập của thanh tra đoạn tường (tách khỏi `WallLayerInspector.tsx` cho gọn): độ dày "Khác…" và chiều dài. */

import { useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';

import { CUSTOM_MAX_MM, CUSTOM_MIN_MM, parseCustomThickness } from './customThickness';

const LENGTH_INPUT_LABEL = 'Chiều dài tường';
const LENGTH_ERROR = 'Nhập một số lớn hơn 0.';
const CUSTOM_INPUT_LABEL = 'Độ dày khác, mm';
const CUSTOM_APPLY_LABEL = 'Áp dụng';
const CUSTOM_RANGE_ERROR = `Nhập số từ ${CUSTOM_MIN_MM} đến ${CUSTOM_MAX_MM} mm.`;

export function CustomThicknessField({
  text,
  errorId,
  onTextChange,
  onApply,
}: {
  readonly text: string;
  readonly errorId: string;
  readonly onTextChange: (text: string) => void;
  readonly onApply: (value: number) => void;
}) {
  const value = parseCustomThickness(text);
  const isInvalid = text.trim() !== '' && value === null;

  return (
    <form
      className="mt-2 flex flex-col gap-1"
      onSubmit={(event) => {
        event.preventDefault();

        if (value !== null) {
          onApply(value);
        }
      }}
    >
      <div className="flex items-center gap-2">
        <input
          aria-describedby={isInvalid ? errorId : undefined}
          aria-invalid={isInvalid}
          aria-label={CUSTOM_INPUT_LABEL}
          className="h-9 min-w-0 flex-1 rounded-md border border-border-default bg-bg-surface px-2 text-[14px] tabular-nums text-text-primary focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          inputMode="numeric"
          max={CUSTOM_MAX_MM}
          min={CUSTOM_MIN_MM}
          onChange={(event) => onTextChange(event.target.value)}
          step={1}
          type="number"
          value={text}
        />
        <span className="text-body-sm text-text-secondary">mm</span>
        <Button disabled={value === null} type="submit" variant="secondary">
          {CUSTOM_APPLY_LABEL}
        </Button>
      </div>
      {isInvalid ? (
        <p className="text-caption text-state-violation" id={errorId}>
          {CUSTOM_RANGE_ERROR}
        </p>
      ) : null}
    </form>
  );
}

/**
 * Ô "Chiều dài" sửa được (P03): Enter hoặc rời ô thì áp, Esc trả số cũ. Số theo đơn vị dự án
 * (mm hoặc m, dấu phẩy thập phân được); `onCommit` nhận mm.
 */
export function LengthField({
  edit,
  onCommit,
}: {
  readonly edit: { readonly valueText: string; readonly unit: 'mm' | 'm' };
  readonly onCommit: (lengthMm: number) => void;
}) {
  const [text, setText] = useState(edit.valueText);
  const [error, setError] = useState<string | null>(null);
  const committedRef = useRef(edit.valueText);
  const errorId = useId();

  const commit = () => {
    if (text === committedRef.current) {
      setError(null);
      return;
    }

    /* mm: "4.250" là bốn nghìn hai trăm năm mươi (dấu chấm nghìn); dấu phẩy luôn là thập phân. */
    const compact = text.replace(/\s/g, '');
    const value = Number((edit.unit === 'mm' ? compact.replace(/\./g, '') : compact).replace(',', '.'));

    if (text.trim() === '' || !Number.isFinite(value) || value <= 0) {
      setError(LENGTH_ERROR);
      return;
    }

    setError(null);
    committedRef.current = text;
    onCommit(edit.unit === 'm' ? value * 1000 : value);
  };

  return (
    <div className="flex flex-col gap-1 py-1">
      <div className="flex items-center gap-2">
        <input
          aria-describedby={error === null ? undefined : errorId}
          aria-invalid={error !== null}
          aria-label={LENGTH_INPUT_LABEL}
          className="h-9 min-w-0 flex-1 rounded-md border border-border-default bg-bg-surface px-2 text-[14px] tabular-nums text-text-primary focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          inputMode="decimal"
          onBlur={commit}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            } else if (event.key === 'Escape') {
              /* Esc chỉ huỷ số đang gõ, không bỏ chọn đoạn. */
              event.stopPropagation();
              setText(committedRef.current);
              setError(null);
            }
          }}
          type="text"
          value={text}
        />
        <span className="text-body-sm text-text-secondary">{edit.unit}</span>
      </div>
      {error === null ? null : (
        <p className="text-caption text-state-violation" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}
