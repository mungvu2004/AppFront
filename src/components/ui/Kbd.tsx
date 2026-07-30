import React from 'react';

export interface KbdProps {
  children: React.ReactNode;
  className?: string;
}

export function Kbd({ children, className = '' }: KbdProps) {
  return (
    <kbd
      className={`inline-flex items-center justify-center h-[20px] min-w-[20px] px-1 rounded-[6px] bg-bg-sunken border border-border-hairline font-mono text-[13px] text-text-muted select-none ${className}`}
    >
      {children}
    </kbd>
  );
}
