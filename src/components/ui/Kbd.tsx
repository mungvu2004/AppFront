import React from 'react';

import { cn } from '../../lib/utils';

// ─── Kbd ──────────────────────────────────────────────────────────────────────
// Keyboard shortcut display: hairline border, bg-sunken, mono 13px.

export interface KbdProps {
  children: React.ReactNode;
  className?: string;
}

export function Kbd({ children, className = '' }: KbdProps) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center',
        'h-[20px] min-w-[20px] px-1',
        'rounded-[6px]',
        'bg-bg-sunken',
        'border border-border-default',
        'font-mono text-[13px] text-text-muted',
        'select-none',
        'leading-none',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
