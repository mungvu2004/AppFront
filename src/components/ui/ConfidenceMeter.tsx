import React from 'react';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';
import { Tooltip } from './Tooltip';

// ─── ConfidenceMeter ──────────────────────────────────────────────────────────
// Track: 4px tall, 48px wide.
// Value < 0.75 → attention color + diagonal stripe overlay (6% opacity 45°).
// Tooltip: "Độ tin cậy AI 0,71 — cần kiểm tra"

interface ConfidenceMeterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0 to 1 */
  value: number;
  /** Suppress tooltip (e.g. in dense table cells) */
  noTooltip?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ConfidenceMeterInner({ value, className, noTooltip: _, ...props }: ConfidenceMeterProps) {
  const isAttention = value < 0.75;
  const percentage = Math.min(100, Math.max(0, value * 100));
  // Format with Vietnamese decimal separator (comma)
  const displayValue = value.toFixed(2).replace('.', ',');

  return (
    <div className={twMerge('flex items-center gap-2', className)} {...props}>
      <div
        role="meter"
        aria-valuenow={Math.round(percentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Độ tin cậy AI: ${displayValue}`}
        className="relative w-12 h-1 bg-border-default rounded-full overflow-hidden shrink-0"
      >
        {/* Fill bar */}
        <div
          className={clsx(
            'absolute top-0 left-0 h-full rounded-full transition-all duration-340',
            isAttention ? 'bg-state-attention' : 'bg-text-muted'
          )}
          style={{ width: `${percentage}%` }}
        />
        {/* Diagonal stripe for attention state — 6% opacity 45° pattern */}
        {isAttention && (
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              backgroundImage: 'repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 1px, transparent 4px)',
              opacity: 0.06,
            }}
            aria-hidden="true"
          />
        )}
      </div>
      <span
        className={clsx(
          'font-mono text-[13px] leading-none w-8 shrink-0',
          isAttention ? 'text-state-attention-text' : 'text-text-secondary'
        )}
        aria-hidden="true"
      >
        {displayValue}
      </span>
    </div>
  );
}

export function ConfidenceMeter({ value, noTooltip = false, ...props }: ConfidenceMeterProps) {
  const isAttention = value < 0.75;
  const displayValue = value.toFixed(2).replace('.', ',');
  const tooltipLabel = isAttention
    ? `Độ tin cậy AI ${displayValue} — cần kiểm tra`
    : `Độ tin cậy AI ${displayValue}`;

  if (noTooltip) {
    return <ConfidenceMeterInner value={value} {...props} />;
  }

  return (
    <Tooltip label={tooltipLabel} side="top">
      <ConfidenceMeterInner value={value} noTooltip {...props} />
    </Tooltip>
  );
}
