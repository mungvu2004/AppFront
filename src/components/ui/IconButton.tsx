import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';
import { Tooltip } from './Tooltip';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  /** aria-label is REQUIRED per spec */
  'aria-label': string;
  isActive?: boolean;
  loading?: boolean;
  /** Size: 32 | 36 | 40 px. Default 36 */
  size?: 'sm' | 'md' | 'lg';
  /** Show tooltip on hover after 400ms delay */
  tooltip?: boolean;
}

const sizeMap = {
  sm: 'h-8 w-8',
  md: 'h-9 w-9',
  lg: 'h-10 w-10',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, icon, isActive, loading, disabled, size = 'md', tooltip = true, 'aria-label': ariaLabel, ...props }, ref) => {
    const isDisabled = disabled || loading;

    const btn = (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-label={ariaLabel}
        className={cn(
          'group relative box-content flex -m-0.5 p-0.5 items-center justify-center outline-none',
          sizeMap[size],
          'rounded-xl bg-clip-content transition-all duration-120',
          'motion-reduce:transition-colors motion-reduce:active:scale-100',
          'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface focus-visible:animate-focus-ring',
          !isActive && !isDisabled && 'hover:bg-bg-hover active:scale-[0.985]',
          // active: bg-selected + accent text — NO solid black background
          isActive && !isDisabled && 'bg-bg-selected text-accent-active active:scale-[0.985]',
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

    if (!tooltip || isDisabled) return btn;

    return (
      <Tooltip label={ariaLabel}>
        {btn}
      </Tooltip>
    );
  }
);
IconButton.displayName = 'IconButton';
