import React from 'react';
import { cn } from '../../lib/utils';
// import { Skeleton } from '../feedback/Skeleton';

export interface FieldRowProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  children: React.ReactNode;
  isLast?: boolean;
  /** Show "—" dash for mixed/undefined value */
  isMixed?: boolean;
  /** Read-only: disable interaction, show tooltip explaining why */
  isReadOnly?: boolean;
  readOnlyReason?: string;
  isLoading?: boolean;
  /** Flash accent-wash background after a write (340ms) */
  flash?: boolean;
  /** Collapsed state — renders nothing */
  collapsed?: boolean;
  /**
   * The value is plain text, not a 36 px control: the label drops its 9 px offset and both
   * columns share a 20 px line, so the first lines sit level (nợ B #3, BUG-121).
   */
  isText?: boolean;
}

export function FieldRow({
  label,
  children,
  isLast,
  isMixed,
  isReadOnly,
  isLoading,
  flash,
  collapsed,
  isText,
  className,
  ...props
}: FieldRowProps) {
  if (collapsed) return null;

  if (isLoading) {
    return (
      <div
        className={cn(
          'flex items-start min-h-9 py-2',
          !isLast && 'border-b border-border-default',
          className
        )}
        {...props}
      >
        <div className="flex-1 flex flex-col justify-center">
          <div className="h-4 w-24 rounded bg-border-default animate-pulse motion-reduce:animate-none" />
        </div>
        <div className="flex-1">
          <div className="h-4 w-full rounded bg-border-default animate-pulse motion-reduce:animate-none" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-start min-h-9 py-2 transition-colors duration-340',
        !isLast && 'border-b border-border-default',
        flash && 'bg-accent-wash',
        isReadOnly && 'opacity-60',
        className
      )}
      {...props}
    >
      {/*
        Nhãn 13 px, căn giữa trong đúng ô 36 px của giá trị (\`h-9\`) — \`pt-[9px]\` cũ lệch ~5 px so với
        giá trị căn giữa, và nhãn 14 px đậm trông to hơn giá trị (BUG-613).
      */}
      <div className={cn('w-[40%] flex-shrink-0 pr-4', !isText && 'flex min-h-9 items-center')}>
        <span className="text-[13px] leading-5 text-text-secondary">
          {label}
        </span>
      </div>
      <div className={cn('w-[60%] flex-shrink-0', isText && 'leading-5')}>
        {isMixed ? (
          <span className="flex h-9 items-center text-[14px] text-text-muted">—</span>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
FieldRow.displayName = 'FieldRow';
