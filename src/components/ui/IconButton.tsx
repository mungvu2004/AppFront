import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  isActive?: boolean;
  loading?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, icon, isActive, loading, disabled, ...props }, ref) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          // 40px hit area (36 content + 4 padding), -2px margin restores 36px layout footprint
          'group relative box-content flex h-9 w-9 -m-0.5 p-0.5 items-center justify-center outline-none',
          'rounded-xl bg-clip-content transition-all duration-120',
          'motion-reduce:transition-colors motion-reduce:active:scale-100',
          'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface focus-visible:animate-focus-ring',
          !isActive && !isDisabled && 'hover:bg-bg-hover active:scale-[0.985]',
          isActive && !isDisabled && 'bg-accent-wash text-accent active:scale-[0.985]',
          !isActive && 'text-text-secondary hover:text-text-primary',
          isDisabled && 'opacity-40 cursor-not-allowed pointer-events-none',
          className
        )}
        {...props}
      >
        <span className="flex h-[18px] w-[18px] items-center justify-center [&>svg]:stroke-[1.5px]">
          {loading ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : icon}
        </span>
      </button>
    );
  }
);
IconButton.displayName = 'IconButton';
