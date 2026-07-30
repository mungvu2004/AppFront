import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { getButtonStyles, ButtonVariant, ButtonSize } from './button-variants';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconOnly?: boolean;
  loading?: boolean;
  shortcut?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      icon,
      iconOnly = false,
      loading = false,
      disabled,
      shortcut,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={getButtonStyles({
          variant,
          size,
          iconOnly,
          disabled: isDisabled,
          className,
        })}
        title={shortcut ? `${props.title || ''} (${shortcut})`.trim() : props.title}
        {...props}
      >
        {iconOnly ? (
          loading ? (
            <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin" />
          ) : (
            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
              {icon}
            </span>
          )
        ) : (
          <span className="relative inline-grid place-items-center w-full">
            {/* Invisible layout constraint to prevent width shifting on loading */}
            <span className="invisible flex items-center gap-[8px]">
              {icon && <span className="w-[18px] shrink-0" />}
              <span className="whitespace-nowrap">{children}</span>
              {shortcut && <kbd className="text-[13px] font-mono">{shortcut}</kbd>}
            </span>

            {/* Visible content */}
            <span className="absolute inset-0 flex items-center justify-center gap-[8px]">
              {loading ? (
                <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin" />
              ) : (
                icon && (
                  <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                    {icon}
                  </span>
                )
              )}
              <span className="whitespace-nowrap">{children}</span>
              {shortcut && !loading && (
                <kbd className="text-[13px] font-mono text-text-muted">{shortcut}</kbd>
              )}
            </span>
          </span>
        )}
      </button>
    );
  }
);
Button.displayName = 'Button';
