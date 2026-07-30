import React from 'react';
import { cn } from '../../lib/utils';

export interface FieldRowProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  children: React.ReactNode;
  isLast?: boolean;
}

export const FieldRow = ({ label, children, isLast, className, ...props }: FieldRowProps) => {
  return (
    <div
      className={cn(
        'flex items-start min-h-[36px] py-2',
        !isLast && 'border-b border-border-default',
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
        {/* We use a wrapper to override the child's label if any, but ideally the child shouldn't have a label in FieldRow */}
        {children}
      </div>
    </div>
  );
};
FieldRow.displayName = 'FieldRow';
