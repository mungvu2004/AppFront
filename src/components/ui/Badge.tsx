import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ─── Badge ────────────────────────────────────────────────────────────────────
// h-[22px], bo-[6px], text-[13px], light tint bg + strong text token
// No solid color blocks. No uppercase labels.

type BadgeVariant = 'verified' | 'attention' | 'violation' | 'neutral';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: BadgeVariant;
  children: React.ReactNode;
  /** Suppress the leading dot indicator */
  noDot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  verified: 'bg-state-verified-tint text-state-verified-text',
  attention: 'bg-state-attention-tint text-state-attention-text',
  violation: 'bg-state-violation-tint text-state-violation-text',
  neutral:   'bg-bg-sunken text-text-secondary',
};

const dotStyles: Record<BadgeVariant, string> = {
  verified: 'bg-state-verified',
  attention: 'bg-state-attention',
  violation: 'bg-state-violation',
  neutral:   'bg-text-muted',
};

export function Badge({ variant, children, noDot = false, className, ...props }: BadgeProps) {
  return (
    <span
      className={twMerge(
        'inline-flex items-center h-[22px] px-2 rounded-[6px] text-[13px] font-medium leading-none gap-1.5',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {!noDot && (
        <span
          className={clsx('w-1.5 h-1.5 rounded-full shrink-0', dotStyles[variant])}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
