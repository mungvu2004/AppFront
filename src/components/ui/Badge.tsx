import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

type BadgeVariant = 'verified' | 'attention' | 'violation' | 'neutral';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant: BadgeVariant;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  verified: 'bg-state-verified-tint border-state-verified text-state-verified-text',
  attention: 'bg-state-attention-tint border-state-attention text-state-attention-text',
  violation: 'bg-state-violation-tint border-state-violation text-state-violation-text',
  neutral: 'bg-bg-sunken border-border-default text-text-secondary',
};

const dotStyles: Record<BadgeVariant, string> = {
  verified: 'bg-state-verified',
  attention: 'bg-state-attention',
  violation: 'bg-state-violation',
  neutral: 'bg-text-muted',
};

export function Badge({ variant, children, className, ...props }: BadgeProps) {
  return (
    <div
      className={twMerge(
        'inline-flex items-center h-6 px-2 rounded-md border text-[13px] font-medium leading-none gap-1.5',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      <div className={clsx('w-1.5 h-1.5 rounded-full', dotStyles[variant])} />
      {children}
    </div>
  );
}
