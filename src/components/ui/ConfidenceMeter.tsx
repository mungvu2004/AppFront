import React from 'react';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';

interface ConfidenceMeterProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0 to 1
}

export function ConfidenceMeter({ value, className, ...props }: ConfidenceMeterProps) {
  const isAttention = value < 0.75;
  const percentage = Math.min(100, Math.max(0, value * 100));
  
  return (
    <div className={twMerge('flex items-center gap-2', className)} {...props}>
      <div
        role="meter"
        aria-valuenow={Math.round(percentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Độ tin cậy AI"
        className="relative w-16 h-1 bg-border-default rounded-full overflow-hidden shrink-0"
      >
        <div 
          className={clsx(
            'absolute top-0 left-0 h-full rounded-full transition-all duration-340',
            isAttention ? 'bg-state-attention' : 'bg-text-muted'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="font-mono text-[13px] text-text-secondary leading-none w-8" aria-hidden="true">
        {value.toFixed(2)}
      </span>
    </div>
  );
}
