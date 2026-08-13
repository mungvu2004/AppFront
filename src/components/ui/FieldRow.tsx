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
}

export const FieldRow = ({
  label,
  children,
  isLast,
  isMixed,
  isReadOnly,
  isLoading,
  flash,
  collapsed,
  className,
  ...props
}: FieldRowProps) => {
  if (collapsed) return null;

  if (isLoading) {
    return (
      <div
        className={cn(
          'flex items-start min-h-[36px] py-2',
          !isLast && 'border-b border-border-default',
          className
        )}
        {...props}
      >
        <div className="flex-1 flex flex-col justify-center">
          <div className="h-4 w-24 rounded bg-bg-sunken animate-pulse motion-reduce:animate-none" />
        </div>
        <div className="flex-1">
          <div className="h-4 w-full rounded bg-bg-sunken animate-pulse motion-reduce:animate-none" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-start min-h-[36px] py-2 transition-colors duration-340',
        !isLast && 'border-b border-border-default',
        flash && 'bg-accent-wash',
        isReadOnly && 'opacity-60',
        className
      )}
      {...props}
    >
      <div className="w-[40%] flex-shrink-0 pr-4 pt-[9px]">
        <span className="text-[14px] font-medium leading-[20px] text-text-secondary">
          {label}
        </span>
      </div>
      <div className="w-[60%] flex-shrink-0">
        {isMixed ? (
          <span className="flex h-[36px] items-center text-[14px] text-text-muted">—</span>
        ) : (
          children
        )}
      </div>
    </div>
  );
};
FieldRow.displayName = 'FieldRow';
